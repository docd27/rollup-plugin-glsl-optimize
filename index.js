/* eslint-disable */
// @ts-nocheck

/*
* DO NOT EDIT: Auto-generated bundle from sources in ./src
* For easier debugging you can include ./src/index.js directly instead
*/


import { createFilter } from '@rollup/pluginutils';
import MagicString from 'magic-string';
import { platform, arch, EOL } from 'os';
import * as path from 'path';
import * as fsSync from 'fs';
import { spawn } from 'child_process';
import { promisify, TextDecoder } from 'util';
import { once } from 'events';
import * as stream from 'stream';
import envPaths from 'env-paths';
import { fileURLToPath } from 'url';
import 'https-proxy-agent';
import TFileCache from '@derhuerst/http-basic/lib/FileCache.js';
import 'querystring';
import '@derhuerst/http-basic';
import 'progress';
import 'adm-zip';

function* simpleParse(input) {
  yield* parser(lexer(input));
}
function* iterateStringLookahead(input) {
  const inputGenerator = input[Symbol.iterator]();
  let cur = inputGenerator.next();
  let next = inputGenerator.next();
  while (!cur.done && !next.done) {
    yield [cur.value, next.value];
    cur = next;
    next = inputGenerator.next();
  }
  if (!cur.done) {
    yield [cur.value, undefined];
  }
}
const _T = (n) => (n);
const TOK = Object.freeze({EOL: _T(1), EOF: _T(2), Line: _T(3), Comment: _T(4),
  Version: _T(5), Extension: _T(6), LineNo: _T(7), Directive: _T(8)});
Object.freeze({1: 'EOL', 2: 'EOF', 3: 'Line', 4: 'Comment',
  5: 'Version', 6: 'Extension', 7: 'LineNo', 8: 'Directive'});
function* lexer(input) {
  let skipOne = false;
  let line = 1, col = 0;
  let afterLineContinuation = false, inCommentSingleLine = false, inCommentMultiLine = false;
  let curToken = undefined;
  let curText = undefined;
  const setTokenIf = (type) => {
    if (!curToken) {
      setToken(type);
    }
  };
  const setToken = (type) => {
    curToken = {type, col, line, value: '', text: ''};
  };
  const emitToken = function* () {
    if (curToken.type === TOK.Line) {
      yield curToken;
    } else {
      yield curToken;
    }
    curToken = undefined;
  };
  const emitTokenIf = function* () {
    if (curToken) {
      yield* emitToken();
    }
  };
  const appendTokenValue = () => {
    curToken.text += curText;
    curToken.value += curText;
  };
  const appendToken = () => {
    curToken.text += curText;
  };
  const handleEOL = function* () {
    if (afterLineContinuation) {
      appendToken();
      afterLineContinuation = false;
    } else if (inCommentMultiLine) {
      appendToken();
      curToken.value += '\n';
    } else {
      yield* emitTokenIf();
      inCommentSingleLine = false;
      yield {type: TOK.EOL, text: curText, col, line, value: '\n'};
    }
    line++; col = 0;
  };
  for (const [cur, next] of iterateStringLookahead(input)) {
 col++;
    if (skipOne) {
      skipOne = false;
      continue;
    }
    curText = cur;
    switch (cur) {
      case '\\':
        switch (next) {
          case '\r': case '\n':
            setTokenIf(TOK.Line);
            appendToken();
            afterLineContinuation = true;
            break;
          default:
            setTokenIf(TOK.Line);
            appendTokenValue();
        }
        break;
      case '\r':
        if (next === '\n') {
          curText += next; skipOne = true;
        }
        yield* handleEOL();
        break;
      case '\n':
        if (next === '\r') {
          curText += next; skipOne = true;
        }
        yield* handleEOL();
        break;
      default:
        if (inCommentSingleLine) {
          appendTokenValue();
        } else if (inCommentMultiLine) {
          if (cur === '*' && next === '/') {
            curText += next; skipOne = true;
            appendToken();
            yield* emitToken();
            inCommentMultiLine = false;
          } else {
            appendTokenValue();
          }
        } else {
          switch (cur) {
            case '/':
              switch (next) {
                case '/':
                  curText += next; skipOne = true;
                  yield* emitTokenIf();
                  setToken(TOK.Comment);
                  appendToken();
                  inCommentSingleLine = true;
                  break;
                case '*':
                  curText += next; skipOne = true;
                  yield* emitTokenIf();
                  setToken(TOK.Comment);
                  appendToken();
                  inCommentMultiLine = true;
                  break;
                default:
                  setTokenIf(TOK.Line);
                  appendTokenValue();
              }
              break;
            default:
              setTokenIf(TOK.Line);
              appendTokenValue();
          }
        }
    }
  }
  yield* emitTokenIf();
  yield {type: TOK.EOF, text: '', col, line, value: ''};
}
function* parser(input) {
  let LineTokens = [];
  for (const token of input) {
    switch (token.type) {
      case TOK.Line:
        LineTokens.push(token);
        break;
      case TOK.Comment:
        if (LineTokens.length > 0) {
          LineTokens.push(token);
        } else {
          yield token;
        }
        break;
      case TOK.EOL: case TOK.EOF:
        if (LineTokens.length > 0) {
          const combinedToken = {...LineTokens[0], type: TOK.Line,
            value: LineTokens.map((token) => token.type === TOK.Comment ? ' ' : token.value).join(''),
            text: LineTokens.map((token) => token.text).join(''),
          };
          const matchPreprocessor = /^[ \t]*#[ \t]*([^ \t].*)?$/u.exec(combinedToken.value);
          if (matchPreprocessor && matchPreprocessor.length === 2) {
            const directiveLine = matchPreprocessor[1];
            if (directiveLine !== undefined) {
              const directiveParts = directiveLine.split(/[ \t]+/u);
              if (directiveParts.length > 0) {
                let [directive, ...body] = directiveParts;
                body = body.filter(Boolean);
                switch (directive.toLowerCase()) {
                  case 'version':
                    combinedToken.type = TOK.Version;
                    combinedToken.Version = body.join(' ');
                    break;
                  case 'line':
                    combinedToken.type = TOK.LineNo;
                    break;
                  case 'extension': {
                    combinedToken.type = TOK.Extension;
                    if (body.length === 3 && body[1] === ':') {
                      combinedToken.ExtensionName = body[0];
                      const extensionBehavior = body[2].toLowerCase();
                      switch (extensionBehavior) {
                        case 'require': case 'enable': case 'warn': case 'disable':
                          combinedToken.ExtensionBehavior = extensionBehavior;
                          break;
                        default:
                          combinedToken.ExtensionBehavior = body[2];
                          warnParse(`#extension directive: unknown behavior '${body[2]}'`, combinedToken);
                      }
                    } else {
                      warnParse('#extension directive: parse error', combinedToken);
                    }
                  }
                    break;
                  default:
                    combinedToken.type = TOK.Directive;
                    break;
                }
              }
            }
          }
          yield combinedToken;
          LineTokens = [];
        }
        yield token;
        break;
      default:
        yield token;
    }
  }
}
const warnParse = (message, token) => console.error(formatParseError(message, token));
const formatParseError = (message, token) => `Warning: ${message}\nLine ${
  token.line} col ${token.col}:\n${formatLine(token.text)}`;
const formatLine = (line) => {
  let lineF = '';
  for (let i = 0; i < line.length; i++) {
    switch (line[i]) {
      case '\r':
        lineF += '<CR>';
        break;
      case '\n':
        lineF += '<EOL>';
        break;
      case '\t':
        lineF += '<TAB>';
        break;
      default:
        lineF += line[i];
    }
  }
  return lineF;
};

const GLSL_INCLUDE_EXT = 'GL_GOOGLE_include_directive';
const GLSL_LINE_EXT = 'GL_GOOGLE_cpp_style_line_directive';
function insertExtensionPreamble(code, filePath, versionReplacer = (v) => v, extraPreamble) {
  const tokens = [...(function* () {
    for (const token of simpleParse(code)) {
      if (token.type === TOK.Extension) {
        if (token?.ExtensionName === GLSL_INCLUDE_EXT || token?.ExtensionName === GLSL_LINE_EXT) {
          if (token?.ExtensionBehavior === 'enable' || token?.ExtensionBehavior === 'require') ; else {
            throw new Error(formatParseError(`Error: extension ${token.ExtensionName} cannot be disabled`, token));
          }
        }
      }
      yield token;
    }
  })()];
  const preambleToken = (fixupLineNo) => ({col: 0, line: fixupLineNo, type: TOK.Directive, value: '', text:
  `#extension ${GLSL_INCLUDE_EXT} : require\n${
    extraPreamble ? `${extraPreamble}\n` : ''}#line ${fixupLineNo} "${filePath}"\n`});
  const versionToken = function* (token) {
    yield {type: TOK.Version, Version: versionReplacer(undefined), col: token.col, line: token.line,
      text: `#version ${versionReplacer(undefined)}`, value: ''};
    yield {type: TOK.EOL, col: token.col, line: token.line, text: '\n', value: '\n'};
  };
  return {code: [...( function* () {
    let insertNext = false, acceptVersion = true, foundVersion = false, didInsertion = false;
    for (const token of tokens) {
      if (insertNext) {
        insertNext = false;
        yield preambleToken(token.line);
      }
      switch (token.type) {
        case TOK.Comment: break;
        case TOK.EOF:
          if (!didInsertion) {
            didInsertion = true;
            if (acceptVersion) yield* versionToken(token);
            yield {type: TOK.EOL, col: token.col, line: token.line, text: '\n', value: '\n'};
            yield preambleToken(token.line + 1);
          }
          break;
        case TOK.EOL:
          if (acceptVersion) yield* versionToken(token);
          acceptVersion = false;
          if (!didInsertion) {
            didInsertion = true; insertNext = true;
          }
          break;
        case TOK.Version:
          if (acceptVersion) {
            acceptVersion = false; foundVersion = true;
            const newVersion = versionReplacer(token.Version);
            token.Version = newVersion;
            token.text = `#version ${newVersion}`;
          } else {
            throw new Error(formatParseError(`Parse error: #version directive must be on first line`, token));
          }
          break;
        default:
          if (acceptVersion) yield* versionToken(token);
          acceptVersion = false;
      }
      yield token;
    }
    if (!foundVersion) {
      console.warn(`Warning: #version directive missing`);
      return code;
    }
  })()].map((tok) => tok.text).join(''), didInsertion: true};
}
function fixupDirectives(code, preserve = false, required = true, searchLineDirective = false,
  stripLineDirectives = false, versionReplacer = (v) => v) {
  const STRIP_EXT = searchLineDirective ? GLSL_LINE_EXT : GLSL_INCLUDE_EXT;
  return [...(function* () {
    let found = false;
    let skipNextEOL = false;
    nextToken:
    for (const token of simpleParse(code)) {
      if (skipNextEOL) {
        skipNextEOL = false;
        if (token.type === TOK.EOL) {
          continue nextToken;
        }
      }
      switch (token.type) {
        case TOK.Extension:
          if (token?.ExtensionName === STRIP_EXT) {
            if (token?.ExtensionBehavior === 'enable' || token?.ExtensionBehavior === 'require') {
              if (!found) {
                found = true;
              }
              if (preserve) {
                token.text = `#extension ${GLSL_LINE_EXT} : require`;
              } else {
                skipNextEOL = true;
                continue nextToken;
              }
            } else {
              console.warn(formatParseError(`Warning: extension ${STRIP_EXT} disabled`, token));
            }
          }
          break;
        case TOK.Version:
          const newVersion = versionReplacer(token.Version);
          token.Version = newVersion;
          token.text = `#version ${newVersion}`;
          break;
        case TOK.LineNo:
          if (stripLineDirectives && token.type === TOK.LineNo) {
            skipNextEOL = true;
            continue nextToken;
          }
          break;
      }
      yield token;
    }
    if (required && !found) {
      console.warn(`Warning: couldn't find ${STRIP_EXT} directive`);
      return code;
    }
  })()].map((tok) => tok.text).join('');
}

promisify(stream.finished);
function chunkWriterAsync(outputStream) {
  outputStream.setDefaultEncoding('utf8');
  outputStream.addListener('error', (err) => {
    throw new Error(`Output stream error: ${err?.message ?? ''}`);
  });
  return {
    write: async (strChunk) => {
      if (!outputStream.write(strChunk, 'utf8')) {
        await once(outputStream, 'drain');
      }
    },
    done: async () => {
      outputStream.end();
      await once(outputStream, 'finish');
    },
  };
}
async function writeLines(stream, lines) {
  const chunkWriter = chunkWriterAsync(stream);
  await chunkWriter.write(lines);
  await chunkWriter.done();
}
async function* parseLines(stream) {
  stream.addListener('error', (err) => {
    throw new Error(`Input stream error: ${err?.message ?? ''}`);
  });
  const utf8Decoder = new TextDecoder('utf-8');
  let outputBuffer = Buffer.from([]);
  let outputBufferPos = 0;
  for await (const chunk of stream) {
    outputBuffer = outputBuffer.length > 0 ? Buffer.concat([outputBuffer, chunk]) : chunk;
    while (outputBufferPos < outputBuffer.length) {
      if (outputBuffer[outputBufferPos] === 0xA) {
        const outputEndPos = (outputBufferPos > 0 && outputBuffer[outputBufferPos-1] === 0xD) ?
          outputBufferPos - 1 : outputBufferPos;
        const nextChunk = outputBuffer.slice(0, outputEndPos);
        outputBuffer = outputBuffer.slice(outputBufferPos+1);
        outputBufferPos = 0;
        const nextChunkString = utf8Decoder.decode(nextChunk, {stream: false});
        yield nextChunkString;
      } else {
        outputBufferPos++;
      }
    }
  }
  if (outputBuffer.length > 0) {
    const nextChunkString = utf8Decoder.decode(outputBuffer, {stream: false});
    yield nextChunkString;
  }
}
async function bufferLines(lines) {
  const output = [];
  for await (const line of lines) {
    output.push(line);
  }
  return output;
}
async function bufferAndOutLines(lines, prefix = '') {
  const output = [];
  for await (const line of lines) {
    output.push(line);
    console.log(`${prefix}${line}`);
  }
  return output;
}
async function bufferAndErrLines(lines, prefix = '') {
  const output = [];
  for await (const line of lines) {
    output.push(line);
    console.error(`${prefix}${line}`);
  }
  return output;
}

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const settings = {
  PROJECT_ROOT: __dirname,
  BIN_PATH: path.resolve(__dirname, `./bin`),
};

const binFolder = settings.BIN_PATH;
const rootFolder = settings.PROJECT_ROOT;
let _pkg;
const getPkg = () => {
  if (!_pkg) {
    try {
      _pkg = loadJSON('package.json');
    } catch (err) {
      _pkg = {name: 'unknown'};
    }
  }
  return _pkg;
};
const loadJSON = (file) => JSON.parse(fsSync.readFileSync(
    path.resolve(rootFolder, file), {encoding: 'utf8'}));
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
function configurePlatformBinaries() {
  let tag = undefined;
  if (arch() === 'x64') {
    switch (platform()) {
      case 'win32':
        tag = 'win64';
        ToolConfig.Validator.distPath = `win64${path.sep}glslangValidator.exe`;
        ToolConfig.Optimizer.distPath = `win64${path.sep}spirv-opt.exe`;
        ToolConfig.Cross.distPath = `win64${path.sep}spirv-cross.exe`;
        break;
      case 'linux':
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
function errorMissingTools(kinds) {
  let errMsg = `Khronos tool binaries could not be found:\n`;
  for (const kind of kinds) {
    const config = ToolConfig[kind];
    errMsg += `${config.name} not found, searched path: '${config.path ?? ''}'\n` +
    toolInfo(config);
  }
  throw new Error(errMsg);
}
const toolInfo = (config) => `${config.name} : configure with the environment variable ${config.envKey} (or the option ${config.optionKey})\n${config.url}\n`;
function configureTools(options, required = (Object.keys(ToolConfig))) {
  configurePlatformBinaries();
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
function getToolPath(kind) {
  const validatorPath = ToolConfig[kind].path;
  if (!validatorPath) errorMissingTools([kind]);
  return validatorPath;
}
function launchTool(kind, workingDir, args) {
  const toolBin = getToolPath(kind);
  return launchToolPath(toolBin, workingDir, args);
}
function launchToolPath(path, workingDir, args) {
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
  const exitPromise = new Promise((resolve, reject) => {
    toolProcess.on('exit', (code, signal) => {
      resolve({code, signal});
    });
  });
  return {toolProcess, exitPromise};
}
async function runToolBuffered({toolProcess, exitPromise}, input = undefined, echo = false) {
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
const argEscapeWindows = (pattern) => {
  const buf = [];
  for (const char of pattern) {
    switch (char) {
      case '"': buf.push('\\', '"'); break;
      default: buf.push(char);
    }
  }
  return buf.join('');
};
const argQuoteWindows = (val) => `"${argEscapeWindows(val)}"`.split(' ');
const argVerbatim = (val) => [val];
const argQuote = platform() === 'win32' ? argQuoteWindows : argVerbatim;
let _cachePath;
const getCachePath = () => {
  if (!_cachePath) {
    _cachePath = envPaths(getPkg().name).cache;
  }
  return _cachePath;
};

(
  (TFileCache).default);
function checkMakeFolder(path) {
  if (!fsSync.existsSync(path)) {
    fsSync.mkdirSync(path, {recursive: true});
  }
  return true;
}
const rmDir = (path) => fsSync.existsSync(path) && fsSync.rmdirSync(path, {recursive: true});

function compressShader(code) {
  let needNewline = false;
  return code.replace(/\\(?:\r\n|\n\r|\n|\r)|\/\*.*?\*\/|\/\/(?:\\(?:\r\n|\n\r|\n|\r)|[^\n\r])*/g, '')
      .split(/\n+/).reduce((result, line) => {
        line = line.trim().replace(/\s{2,}|\t/, ' ');
        if (line.charAt(0) === '#') {
          if (needNewline) {
            result.push('\n');
          }
          result.push(line, '\n');
          needNewline = false;
        } else {
          result.push(line.replace(/\s*({|}|=|\*|,|\+|\/|>|<|&|\||\[|\]|\(|\)|-|!|;)\s*/g, '$1'));
          needNewline = true;
        }
        return result;
      }, []).join('').replace(/\n+/g, '\n');
}

async function glslRunValidator(name, workingDir, stageName, input, params, extraParams) {
  const validator = await runToolBuffered(launchTool('Validator',
      workingDir, [
        '--stdin',
        '-C',
        '-t',
        '-S', stageName,
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
async function glslRunOptimizer(name, workingDir, inputFile, outputFile, input,
    preserveUnusedBindings = true, params, extraParams) {
  const optimizer = await runToolBuffered(launchTool('Optimizer',
      workingDir, [
        '-O',
        '--target-env=opengl4.0',
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
async function glslProcessSource(id, source, stageName, glslOptions = {}, errorLog = console.error) {
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
  let targetGlslVersion = 300;
  if (options.optimize) {
    outputFileAbs = path.join(tempBuildDir, `${outputFile}.spv`);
    optimizedFileAbs = path.join(tempBuildDir, `${outputFile}-opt.spv`);
    versionReplacer = (version) => {
      const versionParts = version && version.match(/^\s*(\d+)(?:\s+(es))?\s*$/i);
      if (versionParts && versionParts.length === 3) {
        targetGlslVersion = +versionParts[1];
      }
      if (targetGlslVersion < 300) {
        throw new Error(`Only GLSL ES shaders version 300 (WebGL2) or higher can be optimized`)
      }
      return `${Math.max(targetGlslVersion, 310)} es`;
    };
  }
  const {code, didInsertion} = insertExtensionPreamble(source, targetID, versionReplacer, options.preamble);
  const extraValidatorParams = [
    ...options.includePaths.map((path) => `-I${path}`),
    ...options.extraValidatorParams,
  ];
  let outputGLSL;
  if (options.optimize) {
    await glslRunValidator('Build spirv', targetDir, stageName,
        code, [
          '-G',
          '-g',
          '--auto-map-locations',
          '--auto-map-bindings',
          '-o', ...argQuote(outputFileAbs),
        ], extraValidatorParams);
    if (!fsSync.existsSync(outputFileAbs)) {
      throw new Error(`Build spirv failed: no output file`);
    }
    if (!options.optimizerDebugSkipOptimizer) {
      await glslRunOptimizer('Optimize spirv', targetDir,
          outputFileAbs, optimizedFileAbs, undefined, options.optimizerPreserveUnusedBindings, [
          ], options.extraOptimizerParams);
      if (!fsSync.existsSync(optimizedFileAbs)) {
        throw new Error(`Optimize spirv failed: no output file`);
      }
    }
    outputGLSL = await glslRunCross('Build spirv to GLSL', targetDir, stageName,
      options.optimizerDebugSkipOptimizer ? outputFileAbs : optimizedFileAbs, undefined, options.emitLineDirectives, [
        '--es',
        `--version ${targetGlslVersion}`,
      ], options.extraCrossParams);
    rmDir(tempBuildDir);
  } else {
    outputGLSL = await glslRunValidator('Preprocessing', targetDir, stageName, code, [
      '-E',
    ], extraValidatorParams);
    await glslRunValidator('Validation', targetDir, stageName,
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

const stageDefs = {
  'vert': [ '.vs', '.vert', '.vs.glsl', '.vert.glsl' ],
  'frag': [ '.fs', '.frag', '.fs.glsl', '.frag.glsl' ],
  'geom': [ '.geom', '.geom.glsl' ],
  'comp': [ '.comp', '.comp.glsl' ],
  'tesc': [ '.tesc', '.tesc.glsl' ],
  'tese': [ '.tese', '.tese.glsl' ],
};
const extsInclude = Object.values(stageDefs).flatMap(
  (exts) => exts.map((ext) => `**/*${ext}`));
const stageRegexes = new Map(
  (Object.entries(stageDefs))
  .map(([st, exts]) => [st,
    new RegExp(`(?:${exts.map(ext => ext.replace('.', '\\.')).join('|')})$`, 'i')
  ]));
function generateCode(source) {
  return `export default ${JSON.stringify(source)}; // eslint-disable-line`;
}
function glslOptimize(userOptions = {}) {
  const options = {
    include: extsInclude,
    sourceMap: true,
    ...userOptions,
  };
  const filter = createFilter(options.include, options.exclude);
  return {
    name: 'glsl-optimize',
    async transform(code, id) {
      if (!id || !filter(id)) return;
      let stage;
      for (const [checkStage, regex] of stageRegexes) {
        if (id.match(regex)) {
          stage = checkStage;
          break;
        }
      }
      if (!stage) {
        this.error({ message: `File '${id}' : extension did not match a shader stage.` });
        return;
      }
      try {
        code = await glslProcessSource(id, code, stage, options);
      } catch (err) {
        this.error({ message: `Error processing GLSL source:\n${err.message}` });
        return;
      }
      code = generateCode(code);
      if (options.sourceMap !== false) {
        const magicString = new MagicString(code);
        return {
          code: magicString.toString(),
          map: magicString.generateMap({hires: true}),
        };
      } else {
        return {
          code,
          map: {mappings: ''},
        };
      }
    },
  };
}

export default glslOptimize;
