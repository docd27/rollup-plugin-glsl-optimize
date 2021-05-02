import {platform, arch, EOL} from 'os';
import {spawn} from 'child_process';
import * as path from 'path';
import * as fsSync from 'fs';
import {bufferAndErrLines, bufferAndOutLines, bufferLines, parseLines, writeLines} from './lines.js';
import {default as envPaths} from 'env-paths';

import {settings} from '../../settings.js';

const binFolder = settings.BIN_PATH;
const rootFolder = settings.PROJECT_ROOT;

let _pkg;
/**
 * @internal
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
 * @internal
 * @param {string} file relative to package root
 * @return {any}
 */
export const loadJSON = (file) => JSON.parse(fsSync.readFileSync(
    path.resolve(rootFolder, file), {encoding: 'utf8'}));

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
 * @typedef {'win64'|'ubuntu64'|'macos64'} PlatformTag
 * @typedef {{[P in GLSLToolVals]: string}} PerPlatformDistPaths
 * @typedef {{[P in PlatformTag]: PerPlatformDistPaths}} PlatformDistPaths
 * @type {PlatformDistPaths}
 */
const ToolDistPaths = {
  win64: {
    Validator: `glslangValidator.exe`,
    Optimizer: `spirv-opt.exe`,
    Cross: `spirv-cross.exe`,
  },
  ubuntu64: {
    Validator: `glslangValidator`,
    Optimizer: `spirv-opt`,
    Cross: `spirv-cross`,
  },
  macos64: {
    Validator: `glslangValidator`,
    Optimizer: `spirv-opt`,
    Cross: `spirv-cross`,
  },
}
/**
 * @typedef {Object} BinarySource
 * @property {string} folderPath
 * @property {string} tag
 * @property {string[]} fileList
 */

/** @type {PlatformTag} */
let _platTag = undefined;
let _platConfigured = false;

/**
 * @internal
 * @return {string?}
 */
export function getPlatTag() {
  if (!_platTag) {
    if (arch() === 'x64') {
      switch (platform()) {
        case 'win32': _platTag = 'win64'; break;
        case 'linux': _platTag = 'ubuntu64'; break;
        case 'darwin': _platTag = 'macos64'; break;
      }
    }
  }
  return _platTag;
}

/**
 * @internal
 * @return {BinarySource?}
 */
export function configurePlatformBinaries() {
  if (!_platConfigured) {
    _platConfigured = true;
    getPlatTag();
    if (_platTag) {
      (/** @type {[GLSLToolVals, string][]} */(Object.entries(ToolDistPaths[_platTag])))
        .forEach(([tool, file]) => ToolConfig[tool].distPath = `${_platTag}${path.sep}${file}`);
    }
  }
  return _platTag ? {
    folderPath: path.join(binFolder, _platTag),
    tag: _platTag,
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

/** @internal */
export const allToolInfo = () => Object.values(ToolConfig).map(toolInfo).join('\n');

/**
 * @internal
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
 * @internal
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
 * @internal
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
  const exitPromise = new Promise((resolve, reject) => {
    toolProcess.on('exit', (code, signal) => {
      resolve({code, signal});
    });
  });
  return {toolProcess, exitPromise};
}

/**
 * @internal
 * @param {{toolProcess: import('child_process').ChildProcess, exitPromise: Promise<ToolExitStatus>}} param0
 * @param {string} [input]
 * @param {boolean} [echo]
 */
export async function waitForToolBuffered({toolProcess, exitPromise}, input = undefined, echo = false) {
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
 * @internal
 * @param {{toolProcess: import('child_process').ChildProcess, exitPromise: Promise<ToolExitStatus>}} param0
 * @param {string} [input]
 */
export async function waitForTool({toolProcess, exitPromise}, input = undefined) {
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

export function printToolDiagnostic(lines) {
  for (const line of lines) {
    if (line.length && line !== 'stdin') {
      console.error(line);
    }
  }
}

/**
 * @internal
 * @param {string} path
 * @param {string} workingDir
 * @param {string} title
 * @param {string[]} args
 */
export async function runTool(path, workingDir, title, args) {
  const toolResult = await waitForTool(launchToolPath(path, workingDir,args));
  if (toolResult.error) {
    const errMsg = `${title} failed: ${path} ${toolResult.exitMessage}`;
    console.error(errMsg);
    throw new Error(errMsg);
  }
  return toolResult;
}

/**
 * @internal
 * @param {string} path
 * @param {string} workingDir
 * @param {string} title
 * @param {string[]} args
 */
 export async function runToolBuffered(path, workingDir, title, args) {
  const toolResult = await waitForToolBuffered(launchToolPath(path, workingDir,args));
  if (toolResult.error) {
    printToolDiagnostic(toolResult.outLines);
    printToolDiagnostic(toolResult.errLines);
    const errMsg = `${title} failed: ${path} ${toolResult.exitMessage}`;
    console.error(errMsg);
    throw new Error(errMsg);
  }
  return {
    out: toolResult.outLines ? toolResult.outLines.join(EOL) : '',
    err: toolResult.errLines ? toolResult.errLines.join(EOL) : '',
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

/** @internal */
export const argQuote = platform() === 'win32' ? argQuoteWindows : argVerbatim;

let _cachePath;
/** @internal */
export const getCachePath = () => {
  if (!_cachePath) {
    _cachePath = envPaths(getPkg().name).cache;
  }
  return _cachePath;
};


let _npmCommand;
/**
 * @internal
 * @param {string[]} args
 * @param {string} [workingDir]
 */
export async function npmCommand(args, workingDir = settings.PROJECT_ROOT) {
  if (!_npmCommand) {
    _npmCommand = platform() === 'win32' ? 'npm.cmd' : 'npm';
  }
  return runTool(_npmCommand, workingDir, 'npm', args);
}

