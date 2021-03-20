import {platform, arch} from 'os';
import {fileURLToPath} from 'url';
import {spawn} from 'child_process';
import * as path from 'path';
import * as fsSync from 'fs';
import {bufferAndErrLines, bufferAndOutLines, bufferLines, parseLines, writeLines} from './lines.js';
import {default as envPaths} from 'env-paths';

// @ts-ignore
const __dirname = path.dirname(fileURLToPath(import.meta.url));
const binFolder = path.resolve(__dirname, '../bin');

let _pkg;
/**
 * Workaround since node won't ES6 import json
 * @return {any} Contents of package.json
 */
export const getPkg = () => {
  if (!_pkg) {
    try {
      _pkg = loadJSON('package.json');
    } catch (err) {
      _pkg = {name: 'unknown'};
    }
  }
  return _pkg;
};

/**
 * @param {string} file relative to package root
 * @return {any}
 */
export const loadJSON = (file) => JSON.parse(fsSync.readFileSync(
    // @ts-ignore
    path.resolve(__dirname, '../', file), {encoding: 'utf8'}));

/**
 * @typedef {'Validator'|'Optimizer'|'Cross'} GLSLToolVals
 * @typedef {'glslangValidatorPath'|'glslangOptimizerPath'|'glslangCrossPath'} GLSLToolPathKeys
 * @typedef {{[P in GLSLToolPathKeys]?: string}} GLSLToolPathConfig
 * @typedef {{name: string, optionKey: GLSLToolPathKeys, envKey: string, url: string, distPath?: string, path?: string}} GLSLSingleToolConfig
 * @typedef {{[P in GLSLToolVals]: GLSLSingleToolConfig}} GLSLToolConfig
 * @type {GLSLToolConfig}
 */
const ToolConfig = {
  Validator: {
    name: 'glslangValidator',
    optionKey: 'glslangValidatorPath',
    envKey: 'GLSLANG_VALIDATOR',
    url: 'https://github.com/KhronosGroup/glslang',
  },
  Optimizer: {
    name: 'spirv-opt',
    optionKey: 'glslangOptimizerPath',
    envKey: 'GLSLANG_OPTIMIZER',
    url: 'https://github.com/KhronosGroup/SPIRV-Tools',
  },
  Cross: {
    name: 'spriv-cross',
    optionKey: 'glslangCrossPath',
    envKey: 'GLSLANG_CROSS',
    url: 'https://github.com/KhronosGroup/SPIRV-Cross',
  },
};
/**
 * @typedef {Object} BinarySource
 * @property {string} folderPath
 * @property {string} tag
 * @property {string[]} fileList
 */
/**
 * @return {BinarySource?}
 */
export function configurePlatformBinaries() {
  let tag = undefined;
  if (arch() === 'x64') {
    switch (platform()) {
      case 'win32':
        tag = 'win64';
        ToolConfig.Validator.distPath = `win64${path.sep}glslangValidator.exe`;
        ToolConfig.Optimizer.distPath = `win64${path.sep}spirv-opt.exe`;
        ToolConfig.Cross.distPath = `win64${path.sep}spirv-cross.exe`;
        break;
      case 'linux': // TODO: check actually ubuntu
        tag = 'ubuntu64';
        ToolConfig.Validator.distPath = `ubuntu64${path.sep}glslangValidator`;
        ToolConfig.Optimizer.distPath = `ubuntu64${path.sep}spirv-opt`;
        ToolConfig.Cross.distPath = `ubuntu64${path.sep}spirv-cross`;
        break;
      case 'darwin':
        tag = 'macos64';
        ToolConfig.Validator.distPath = `macos64${path.sep}glslangValidator`;
        ToolConfig.Optimizer.distPath = `macos64${path.sep}spirv-opt`;
        ToolConfig.Cross.distPath = `macos64${path.sep}spirv-cross`;
        break;
    }
  }
  return tag ? {
    folderPath: path.join(binFolder, tag),
    tag,
    fileList: Object.values(ToolConfig).map((tool) => path.join(binFolder, tool.distPath) ?? ''),
  } : null;
}
/**
 * @param {GLSLToolVals[]} kinds
 */
function errorMissingTools(kinds) {
  let errMsg = `Khronos tool binaries could not be found:\n`;
  for (const kind of kinds) {
    const config = ToolConfig[kind];
    errMsg += `${config.name} not found, searched path: '${config.path ?? ''}'\n` +
    toolInfo(config);
  }
  throw new Error(errMsg);
}
/** @param {GLSLSingleToolConfig} config */
const toolInfo = (config) => `${config.name} : configure with the environment variable ${config.envKey} (or the option ${config.optionKey})\n${config.url}\n`;

export const allToolInfo = () => Object.values(ToolConfig).map(toolInfo).join('\n');

/**
 * @param {Partial<import('./glslProcess').GLSLToolOptions>} options
 * @param {GLSLToolVals[]} [required]
 */
export function configureTools(options, required = /** @type {GLSLToolVals[]} */(Object.keys(ToolConfig))) {
  configurePlatformBinaries();

  /** @type {GLSLToolVals[]} */
  const missingKinds = [];

  for (const kind of required) {
    const tool = ToolConfig[kind];
    const toolPath = process.env[tool.envKey] || options[tool.optionKey] || tool.distPath;
    if (!toolPath) {
      console.warn(`Khronos ${tool.name} binary not shipped for this platform`);
    } else {
      tool.path = path.resolve(binFolder, toolPath);
    }
    if (!tool.path || !fsSync.existsSync(tool.path)) {
      missingKinds.push(kind);
    }
  }
  if (missingKinds.length) {
    errorMissingTools(missingKinds);
  }
}
/**
 * @param {GLSLToolVals} kind
 * @return {string} Path to tool if found
 */
function getToolPath(kind) {
  const validatorPath = ToolConfig[kind].path;
  if (!validatorPath) errorMissingTools([kind]);
  return validatorPath;
}

/**
 * @param {GLSLToolVals} kind
 * @param {string} workingDir
 * @param {string[]} args
 */
export function launchTool(kind, workingDir, args) {
  const toolBin = getToolPath(kind);
  return launchToolPath(toolBin, workingDir, args);
}

/**
 * @typedef {{code: number, signal: NodeJS.Signals}} ToolExitStatus
 */
/**
 * @param {string} path
 * @param {string} workingDir
 * @param {string[]} args
 */
export function launchToolPath(path, workingDir, args) {
  const toolProcess = spawn(path,
      args,
      {
        cwd: workingDir,
        stdio: ['pipe', 'pipe', 'pipe'],
        shell: false,
        windowsVerbatimArguments: true,
      },
  );
  toolProcess.on('error', (err) => {
    throw new Error(`${path}: failed to launch${err?.message?` : ${err.message}`:''}`);
  });
  /** @type {Promise<ToolExitStatus>} */
  // @ts-ignore
  const exitPromise = new Promise((resolve, reject) => {
    toolProcess.on('exit', (code, signal) => {
      // @ts-ignore
      resolve({code, signal});
    });
  });
  return {toolProcess, exitPromise};
}

/**
 * @param {{toolProcess: import('child_process').ChildProcess, exitPromise: Promise<ToolExitStatus>}} param0
 * @param {string} [input]
 * @param {boolean} [echo]
 */
export async function runToolBuffered({toolProcess, exitPromise}, input = undefined, echo = false) {
  const stderrPromise = echo ? bufferAndErrLines(parseLines(toolProcess.stderr)) :
    bufferLines(parseLines(toolProcess.stderr));
  const stdoutPromise = echo ? bufferAndOutLines(parseLines(toolProcess.stdout)) :
    bufferLines(parseLines(toolProcess.stdout));
  if (input !== undefined) {
    await writeLines(toolProcess.stdin, input);
  }
  const exitStatus = await exitPromise;
  const outLines = await stdoutPromise;
  const errLines = await stderrPromise;
  return {
    error: exitStatus.signal !== null || (exitStatus.code && exitStatus.code !== 0),
    exitMessage: `exit status: ${exitStatus.code || 'n/a'} ${exitStatus.signal || ''}`,
    exitStatus,
    outLines,
    errLines,
  };
}

/**
 * @param {{toolProcess: import('child_process').ChildProcess, exitPromise: Promise<ToolExitStatus>}} param0
 * @param {string} [input]
 */
export async function runTool({toolProcess, exitPromise}, input = undefined) {
  toolProcess.stderr.pipe(process.stderr);
  toolProcess.stdout.pipe(process.stdout);
  if (input !== undefined) {
    await writeLines(toolProcess.stdin, input);
  }
  const exitStatus = await exitPromise;
  return {
    error: exitStatus.signal !== null || (exitStatus.code && exitStatus.code !== 0),
    exitMessage: `exit status: ${exitStatus.code || 'n/a'} ${exitStatus.signal || ''}`,
    exitStatus,
  };
}

const argEscapeWindows = (pattern) => {
  const buf = [];
  for (const char of pattern) {
    switch (char) {
      case '"': buf.push('\\', '"'); break;
      // case '"': buf.push('\''); break;
      // case ' ': buf.push('\\', 's'); break;
      default: buf.push(char);
    }
  }
  return buf.join('');
};
const argQuoteWindows = (val) => `"${argEscapeWindows(val)}"`.split(' ');
const argVerbatim = (val) => [val];

export const argQuote = platform() === 'win32' ? argQuoteWindows : argVerbatim;

let _cachePath;
export const getCachePath = () => {
  if (!_cachePath) {
    _cachePath = envPaths(getPkg().name).cache;
  }
  return _cachePath;
};
