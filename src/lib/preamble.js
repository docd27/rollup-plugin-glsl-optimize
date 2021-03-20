
import {formatParseError, simpleParse, TOK, TOKENNAMES} from './parse.js';

const GLSL_INCLUDE_EXT = 'GL_GOOGLE_include_directive';
const GLSL_LINE_EXT = 'GL_GOOGLE_cpp_style_line_directive';
/**
 * @internal
 * @param {string} code
 * @param {string} filePath
 * @param {(version: string) => string} [versionReplacer]
 * @param {string} [extraPreamble]
 * @return {{code: string, didInsertion: boolean, foundVersionString?: string}}
 */
export function insertExtensionPreamble(code, filePath, versionReplacer = (v) => v, extraPreamble) {
  // let extensionDirectiveRequired = true;
  const tokens = [...(function* () {
    // Check for an existing #extension GL_GOOGLE_include_directive : require
    for (const token of simpleParse(code)) {
      if (token.type === TOK.Extension) {
        if (token?.ExtensionName === GLSL_INCLUDE_EXT || token?.ExtensionName === GLSL_LINE_EXT) {
          if (token?.ExtensionBehavior === 'enable' || token?.ExtensionBehavior === 'require') {
            // extensionDirectiveRequired = false;
          } else {
            throw new Error(formatParseError(`Error: extension ${token.ExtensionName} cannot be disabled`, token));
          }
        }
      }
      yield token;
    }
  })()];

  /**
   * @param {number} fixupLineNo
   * @return {import('./parse.js').ParserToken}
   * Preamble with correct #line directive fixup
   */
  const preambleToken = (fixupLineNo) => ({col: 0, line: fixupLineNo, type: TOK.Directive, value: '', text:
  `#extension ${GLSL_INCLUDE_EXT} : require\n${
    extraPreamble ? `${extraPreamble}\n` : ''}#line ${fixupLineNo} "${filePath}"\n`});

  const versionToken = function* (token) {
    yield {type: TOK.Version, Version: versionReplacer(undefined), col: token.col, line: token.line,
      text: `#version ${versionReplacer(undefined)}`, value: ''};
    yield {type: TOK.EOL, col: token.col, line: token.line, text: '\n', value: '\n'};
  };

  return {code: [...(/** @return {Generator<import('./parse.js').ParserToken>} */ function* () {
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
            // Needs a new line
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


/**
 * @internal
 * @param {string} code
 * @param {boolean} preserve
 * @param {boolean} required
 * @param {boolean} searchLineDirective whether to search GL_GOOGLE_cpp_style_line_directive or GL_GOOGLE_include_directive
 * @param {boolean} stripLineDirectives
 * @param {(version: string) => string} [versionReplacer]
 * @return {string}
 */
export function fixupDirectives(code, preserve = false, required = true, searchLineDirective = false,
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
          continue nextToken; // Skip this token
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
                continue nextToken; // Skip this token
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
            continue nextToken; // Skip this token
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
