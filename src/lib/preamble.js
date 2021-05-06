
import {formatParseError, simpleParse, TOK} from './parse.js';

const GLSL_INCLUDE_EXT = 'GL_GOOGLE_include_directive';
const GLSL_LINE_EXT = 'GL_GOOGLE_cpp_style_line_directive';
/**
 * @internal
 * @param {string} code
 * @param {string} filePath
 * @param {(version: string) => string} [versionReplacer]
 * @param {string} [extraPreamble]
 * @return {{code: string, didInsertion: boolean}}
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

  return insertPreambleTokens(tokens,
      (fixupLineNo) => ({col: 0, line: fixupLineNo, type: TOK.Directive, value: '', text:
      `#extension ${GLSL_INCLUDE_EXT} : require${
      extraPreamble ? `\n${extraPreamble}` : ''}\n#line ${fixupLineNo} "${filePath}"\n`}),
      versionReplacer);
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
        case TOK.Version: {
          const newVersion = versionReplacer(token.Version);
          token.Version = newVersion;
          token.text = `#version ${newVersion}`;
          break;
        }
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

/**
 * @internal
 * @param {Iterable<import('./parse.js').ParserToken>} tokens
 * @param {(fixupLineNo: number) => import('./parse.js').ParserToken} preambleToken
 * PRE: emits trailing \n
 * @param {(version: string) => string} [versionReplacer]
 * If versionReplacer(undefined) !== undefined also inserts a version token when an existing one is not found
 * @return {{code: string, didInsertion: boolean}}
 */
function insertPreambleTokens(tokens, preambleToken, versionReplacer = (v) => v) {
  /** @param {import('./parse.js').ParserToken} token */
  const newVersionToken = function* (token) {
    const newVersion = versionReplacer(undefined);
    if (newVersion !== undefined) {
      yield {type: TOK.Version, Version: newVersion, col: token.col, line: token.line,
        text: `#version ${newVersion}`, value: ''};
      yield {type: TOK.EOL, col: token.col, line: token.line, text: '\n', value: '\n'};
    }
  };

  return {code: [...(/** @return {Generator<import('./parse.js').ParserToken>} */ function* () {
    let insertNext = false, acceptVersion = true, foundVersion = false, didInsertion = false;
    /** @param {import('./parse.js').ParserToken} token */
    const newVersionPreambleTokens = function* (token) {
      acceptVersion = false; didInsertion = true;
      yield* newVersionToken(token);
      yield preambleToken(token.line);
    };
    for (const token of tokens) {
      if (insertNext) {
        insertNext = false;
        yield preambleToken(token.line);
      }
      switch (token.type) {
        case TOK.Comment: break;
        case TOK.EOF:
          if (acceptVersion) { // Zero-length input
            yield* newVersionPreambleTokens(token);
          } else {
            if (!didInsertion) { // EOF directly after version directive
              didInsertion = true;
              // Needs a new line
              yield {type: TOK.EOL, col: token.col, line: token.line, text: '\n', value: '\n'};
              yield preambleToken(token.line + 1);
            }
          }
          break;
        case TOK.EOL:
          if (acceptVersion) { // Zero-length first line
            yield* newVersionPreambleTokens(token);
          } else {
            if (!didInsertion) { // Newline after version directive, insert after this EOL
              insertNext = true; didInsertion = true;
            }
          }
          break;
        case TOK.Version:
          if (acceptVersion) {
            acceptVersion = false; foundVersion = true;
            const newVersion = versionReplacer(token.Version);
            token.Version = newVersion;
            /*
            Even though the parser may parse a line like "#version{COMMENT}300"
            The following is legal because per the spec:
            The #version directive must be present in the first line of a shader
            and must be followed by a newline. It may contain optional white-space as specified below
            but no other characters are allowed.
            */
            token.text = `#version ${newVersion}`;
          } else {
            throw new Error(formatParseError(`Parse error: #version directive must be on first line`, token));
          }
          break;
        default:
          if (acceptVersion) { // Some other token on first line
            yield* newVersionPreambleTokens(token);
          }
      }
      yield token;
    }
    if (!foundVersion) {
      console.warn(`Warning: #version directive missing`);
    }
  })()].map((tok) => tok.text).join(''), didInsertion: true};
}

/**
 * @internal
 * @param {string} code
 * @param {string} preamble
 */
export function insertPreamble(code, preamble) {
  return insertPreambleTokens(simpleParse(code),
      (fixupLineNo) => ({col: 0, line: fixupLineNo, type: TOK.Comment, value: '', text:
      `${preamble}\n`}));
}

export const test = {
  insertPreambleTokens,
};
