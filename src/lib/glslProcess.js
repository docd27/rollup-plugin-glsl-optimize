import {EOL} from 'os';
import * as path from 'path';
import * as fsSync from 'fs';
import {insertExtensionPreamble, fixupDirectives, insertPreamble} from './preamble.js';
import {argQuote, configureTools, getCachePath, launchTool, printToolDiagnostic, waitForToolBuffered} from './tools.js';
import {checkMakeFolder, rmDir} from './download.js';
import {compressShader} from './minify.js';
import * as crypto from 'crypto';
import MagicString from 'magic-string';

/**
 * @typedef {'vert'|'tesc'|'tese'|'geom'|'frag'|'comp'} GLSLStageName
 *
 * @typedef {Object} GLSLToolSharedOptions
 * @property {boolean} sourceMap
 *   Emit source maps
 * @property {boolean} compress
 *  Strip whitespace
 * @property {boolean} optimize
 *  true: Preprocess and Compile GLSL to SPIR-V, optimize, then cross-compile to GLSL
 *  false: Preprocess (and Validate) GLSL only
 * @property {boolean} emitLineDirectives
 *  Emit #line directives. Useful for debugging #include. Note these may cause problems with certain drivers.
 * @property {boolean} suppressLineExtensionDirective
 *  When emitLineDirectives enabled, suppress the GL_GOOGLE_cpp_style_line_directive extension directive
 * @property {boolean} optimizerPreserveUnusedBindings
 *  Ensure that the optimizer preserves all declared bindings, even when those bindings are unused.
 * @property {boolean} optimizerDebugSkipOptimizer
 *  Debugging: skip the SPIR-V optimizer (compiles then cross-compiles directly)
 * @property {string} preamble
 *  Prepend to the shader (after the #version directive)
 * @property {string[]} includePaths
 *  Additional search paths for #include directive (source file directory is always searched)
 * @property {string[]} extraValidatorParams
 * @property {string[]} extraOptimizerParams
 * @property {string[]} extraCrossParams
 * @typedef {GLSLToolSharedOptions & import('./tools').GLSLToolPathConfig} GLSLToolOptions
 */

/**
 * @internal
 * @param {import('./tools.js').GLSLToolVals} kind
 * @param {string} title
 * @param {string} name
 * @param {string} workingDir
 * @param {string} input
 * @param {string[]} params
 */
async function glslRunTool(kind, title, name, workingDir, input, params) {
  const result = await waitForToolBuffered(launchTool(kind, workingDir, params), input);
  if (result.error) {
    printToolDiagnostic(result.outLines);
    printToolDiagnostic(result.errLines);
    const errMsg = `${title}: ${name} failed, ${result.exitMessage}`;
    console.error(errMsg);
    throw new Error(errMsg);
  }
  return result.outLines ? result.outLines.join(EOL) : '';
}

/**
 * @internal
 * @param {string} name
 * @param {string} workingDir
 * @param {string} stageName
 * @param {string} input
 * @param {string[]} params
 * @param {string[]} extraParams
 */
async function glslRunValidator(name, workingDir, stageName, input, params, extraParams) {
  return glslRunTool('Validator', 'Khronos glslangValidator', name, workingDir, input, [
    '--stdin',
    '-C', // cascading errors (don't stop after first)
    '-t', // Multithreaded
    '-S', stageName, // Shader type
    ...params,
    ...extraParams,
  ]);
}

/**
 * @internal
 * @param {string} name
 * @param {string} workingDir
 * @param {string} inputFile
 * @param {string} outputFile
 * @param {string} input
 * @param {boolean} preserveUnusedBindings
 * @param {string[]} params
 * @param {string[]} extraParams
 */
async function glslRunOptimizer(name, workingDir, inputFile, outputFile, input,
    preserveUnusedBindings = true, params, extraParams) {
  return glslRunTool('Optimizer', 'Khronos spirv-opt', name, workingDir, input, [
    '-O', // optimize for performance
    '--target-env=opengl4.0', // One of opengl4.0|opengl4.1|opengl4.2|opengl4.3|opengl4.5
    ...(preserveUnusedBindings ? ['--preserve-bindings'] : []),
    ...params,
    ...extraParams,
    ...argQuote(inputFile),
    '-o', ...argQuote(outputFile),
  ]);
}

/**
 * @internal
 * @param {string} name
 * @param {string} workingDir
 * @param {string} stageName
 * @param {string} inputFile
 * @param {string} input
 * @param {boolean} emitLineInfo
 * @param {string[]} params
 * @param {string[]} extraParams
 */
async function glslRunCross(name, workingDir, stageName, inputFile, input, emitLineInfo, params, extraParams) {
  return glslRunTool('Cross', 'Khronos spirv-cross', name, workingDir, input, [
    ...argQuote(inputFile),
    ...(emitLineInfo ? ['--emit-line-directives'] : []),
    `--stage`, stageName,
    ...params,
    ...extraParams,
  ]);
}

/**
 * Generate unique build path
 * @param {string} id
 * @return {string}
 */
function getBuildDir(id) {
  const sanitizeID = path.basename(id).replace(/([^a-z0-9]+)/gi, '-').toLowerCase();
  const uniqID = ((Date.now()>>>0) + crypto.randomBytes(4).readUInt32LE())>>>0; // +ve 4 byte unique ID
  const uniqIDHex = uniqID.toString(16).padStart(8, '0'); // 8 char random hex
  return path.join(getCachePath(), 'glslBuild', `${sanitizeID}-${uniqIDHex}`);
}

/**
 * @internal
 * @param {string} id File path
 * @param {string} source Source code
 * @param {GLSLStageName} stageName
 * @param {Partial<GLSLToolOptions>} [glslOptions]
 * @param {(message: string) => void} [errorLog]
 * @return {Promise<import('rollup').SourceDescription>}
 */
export async function glslProcessSource(id, source, stageName, glslOptions = {}, errorLog = console.error) {

  /** @type {GLSLToolOptions} */
  const options = {
    sourceMap: true,
    compress: true,
    optimize: true,
    emitLineDirectives: false,
    suppressLineExtensionDirective: false,
    optimizerPreserveUnusedBindings: true,
    optimizerDebugSkipOptimizer: false,
    preamble: undefined,
    includePaths: [],
    extraValidatorParams: [],
    extraOptimizerParams: [],
    extraCrossParams: [],
    ...glslOptions,
  };

  configureTools({}, options.optimize ? ['Validator', 'Optimizer', 'Cross'] : ['Validator']);

  let tempBuildDir;
  if (options.optimize) {
    tempBuildDir = getBuildDir(id);
    rmDir(tempBuildDir);
    checkMakeFolder(tempBuildDir);
  }

  const baseDir = path.dirname(id);
  const baseName = path.basename(id);
  let targetID = `./${baseName}`;
  let targetDir = baseDir;

  let outputFile = targetID;

  if (!fsSync.existsSync(targetDir)) {
    errorLog(`Error resolving path: '${id}' : Khronos glslangValidator may fail to find includes`);
    targetDir = process.cwd();
    targetID = id;
    outputFile = `temp`;
  }

  let outputFileAbs;
  let optimizedFileAbs;
  let versionReplacer;
  let targetGlslVersion = 300; // WebGL2
  if (options.optimize) {
    outputFileAbs = path.join(tempBuildDir, `${outputFile}.spv`);
    optimizedFileAbs = path.join(tempBuildDir, `${outputFile}-opt.spv`);
    versionReplacer = (version) => {
      // Try and parse the #version directive if present
      const versionParts = version && version.match(/^\s*(\d+)(?:\s+(es))?\s*$/i);
      if (versionParts && versionParts.length === 3) {
        targetGlslVersion = +versionParts[1];
      }
      if (targetGlslVersion < 300) {
        throw new Error(`Only GLSL ES shaders version 300 (WebGL2) or higher can be optimized`);
      }
      // SPIR-V compilation requires >= 310 es
      // and we run the optimizer under OpenGL 4.0 (GLSL 400) semantics
      // though the emitted code is compatible with 300 es
      return `${Math.max(targetGlslVersion, 310)} es`;
    };
  }
  const {code, didInsertion} = insertExtensionPreamble(source, targetID, versionReplacer, options.preamble);

  // if (options.optimizeBuild) {
  //   console.log(`Target GLSL version: ${targetGlslVersion}`);
  // }

  const extraValidatorParams = [
    ...options.includePaths.map((path) => `-I${path}`),
    ...options.extraValidatorParams,
  ];

  let processedGLSL;

  if (options.optimize) {
    await glslRunValidator('Build spirv', targetDir, stageName,
        code, [
          '-G', // opengl
          '-g', // debug info (required for cross --emit-line-directives)
          '--auto-map-locations', // avoid "SPIR-V requires location for user input/output"
          '--auto-map-bindings',
          // '-Od', // disable optimizations (in validator)
          // '--no-storage-format',
          '-o', ...argQuote(outputFileAbs),
          // '-H', // Human-readable spirv
        ], extraValidatorParams);

    if (!fsSync.existsSync(outputFileAbs)) {
      throw new Error(`Build spirv failed: no output file`);
    }
    if (!options.optimizerDebugSkipOptimizer) {
      await glslRunOptimizer('Optimize spirv', targetDir,
          outputFileAbs, optimizedFileAbs, undefined, options.optimizerPreserveUnusedBindings, [
            // '--print-all', // Print spirv for debugging
          ], options.extraOptimizerParams);
      if (!fsSync.existsSync(optimizedFileAbs)) {
        throw new Error(`Optimize spirv failed: no output file (${optimizedFileAbs})`);
      }
    }

    processedGLSL = await glslRunCross('Build spirv to GLSL', targetDir, stageName,
      options.optimizerDebugSkipOptimizer ? outputFileAbs : optimizedFileAbs, undefined, options.emitLineDirectives, [
        '--es', // WebGL is always ES
        '--version', `${targetGlslVersion}`,
        // '--disable-storage-image-qualifier-deduction',
        // '--glsl-es-default-float-precision highp',
        // '--glsl-es-default-int-precision highp',
      ], options.extraCrossParams);

    // Cleanup:
    rmDir(tempBuildDir);



  } else {
    processedGLSL = await glslRunValidator('Preprocessing', targetDir, stageName, code, [
      '-E', // print pre-processed GLSL
    ], extraValidatorParams);
    await glslRunValidator('Validation', targetDir, stageName,
        processedGLSL, [], extraValidatorParams);
  }

  processedGLSL = fixupDirectives(processedGLSL,
      options.emitLineDirectives && !options.suppressLineExtensionDirective,
      didInsertion && (!options.optimize || options.emitLineDirectives),
      options.optimize, !options.emitLineDirectives, undefined);


  const outputCode = options.compress ? compressShader(processedGLSL) : processedGLSL;

  /** @type {import('rollup').LoadResult} */
  const result = {
    code: outputCode,
    map: {mappings: ''},
  };

  if (options.sourceMap) {
    const sourceMapSource = insertPreamble(processedGLSL,
        '/*\n' +
        `* Preprocessed${options.optimize?' + Optimized':''} from '${targetID}'\n` +
        (options.compress ? '* [Embedded string is compressed]\n':'') +
        '*/',
    ).code;
    const magicString = new MagicString(sourceMapSource);
    result.map = magicString.generateMap({
      source: id,
      includeContent: true,
      hires: true,
    });
  }

  return result;

}
