import {EOL} from 'os';
import * as path from 'path';
import * as fsSync from 'fs';
import {insertExtensionPreamble, fixupDirectives} from './preamble.js';
import {argQuote, configureTools, getCachePath, launchTool, runTool, runToolBuffered} from './tools.js';
import {checkMakeFolder, rmDir} from './download.js';
import { compressShader } from './minify.js';


/**
 * @typedef {'vert'|'tesc'|'tese'|'geom'|'frag'|'comp'} GLSLStageName
 *
 * @typedef {Object} GLSLToolSharedOptions
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
 * @param {string} name
 * @param {string} workingDir
 * @param {string} stageName
 * @param {string} input
 * @param {string[]} params
 * @param {string[]} extraParams
 */
async function glslRunValidator(name, workingDir, stageName, input, params, extraParams) {
  const validator = await runToolBuffered(launchTool('Validator',
      workingDir, [
        '--stdin',
        '-C', // cascading errors (don't stop after first)
        '-t', // Multithreaded
        '-S', stageName, // Shader type
        ...params,
        ...extraParams,
      ]), input);
  if (validator.error) {
    printValidatorDiagnostic(validator.outLines);
    printValidatorDiagnostic(validator.errLines);
    const errMsg = `Khronos glslangValidator: ${name} failed, ${validator.exitMessage}`;
    console.error(errMsg);
    throw new Error(errMsg);
  }
  return validator.outLines.join(EOL);
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
  const optimizer = await runToolBuffered(launchTool('Optimizer',
      workingDir, [
        '-O', // optimize for performance
        '--target-env=opengl4.0', // One of opengl4.0|opengl4.1|opengl4.2|opengl4.3|opengl4.5
        ...(preserveUnusedBindings ? ['--preserve-bindings'] : []),
        ...params,
        ...extraParams,
        ...argQuote(inputFile),
        '-o', ...argQuote(outputFile),
      ]), input);
  if (optimizer.error) {
    printValidatorDiagnostic(optimizer.outLines);
    printValidatorDiagnostic(optimizer.errLines);
    const errMsg = `Khronos spirv-opt: ${name} failed, ${optimizer.exitMessage}`;
    console.error(errMsg);
    throw new Error(errMsg);
  }
  return optimizer.outLines ? optimizer.outLines.join(EOL) : '';
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
  const cross = await runToolBuffered(launchTool('Cross',
      workingDir, [
        ...argQuote(inputFile),
        ...(emitLineInfo ? ['--emit-line-directives'] : []),
        `--stage`, stageName,
        ...params,
        ...extraParams,
      ]), input);
  if (cross.error) {
    printValidatorDiagnostic(cross.outLines);
    printValidatorDiagnostic(cross.errLines);
    const errMsg = `Khronos spirv-cross: ${name} failed, ${cross.exitMessage}`;
    console.error(errMsg);
    throw new Error(errMsg);
  }
  return cross.outLines ? cross.outLines.join(EOL) : '';
}

/**
 * @internal
 * @param {string} id File path
 * @param {string} source Source code
 * @param {GLSLStageName} stageName
 * @param {Partial<GLSLToolOptions>} [glslOptions]
 * @param {(message: string) => void} [errorLog]
 */
export async function glslProcessSource(id, source, stageName, glslOptions = {}, errorLog = console.error) {

  /** @type {GLSLToolOptions} */
  const options = {
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
    tempBuildDir = path.join(getCachePath(), 'glslBuild');
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
        throw new Error(`Only GLSL ES shaders version 300 (WebGL2) or higher can be optimized`)
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

  let outputGLSL;

  if (options.optimize) {
    const outputBuild = await glslRunValidator('Build spirv', targetDir, stageName,
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
      const outputOptimize = await glslRunOptimizer('Optimize spirv', targetDir,
          outputFileAbs, optimizedFileAbs, undefined, options.optimizerPreserveUnusedBindings, [
            // '--print-all', // Print spirv for debugging
          ], options.extraOptimizerParams);
      if (!fsSync.existsSync(optimizedFileAbs)) {
        throw new Error(`Optimize spirv failed: no output file`);
      }
    }

    outputGLSL = await glslRunCross('Build spirv to GLSL', targetDir, stageName,
      options.optimizerDebugSkipOptimizer ? outputFileAbs : optimizedFileAbs, undefined, options.emitLineDirectives, [
        '--es', // WebGL is always ES
        `--version ${targetGlslVersion}`,
        // '--disable-storage-image-qualifier-deduction',
        // '--glsl-es-default-float-precision highp',
        // '--glsl-es-default-int-precision highp',
      ], options.extraCrossParams);

    // Cleanup:
    rmDir(tempBuildDir);



  } else {
    outputGLSL = await glslRunValidator('Preprocessing', targetDir, stageName, code, [
      '-E', // print pre-processed GLSL
    ], extraValidatorParams);
    const outputValidated = await glslRunValidator('Validation', targetDir, stageName,
      outputGLSL, [], extraValidatorParams);
  }

  outputGLSL = fixupDirectives(outputGLSL,
    options.emitLineDirectives && !options.suppressLineExtensionDirective,
    didInsertion && (!options.optimize || options.emitLineDirectives),
    options.optimize, !options.emitLineDirectives, undefined);

  if (options.compress) {
    outputGLSL = compressShader(outputGLSL);
  }

  return outputGLSL;

}

function printValidatorDiagnostic(lines) {
  for (const line of lines) {
    if (line.length && line !== 'stdin') {
      console.error(line);
    }
  }
}
