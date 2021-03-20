
/**
 * @internal
 * Very basic GLSL parsing handling #version and #extension preprocessor directives
 * @param {string} input
 */
export function* simpleParse(input) {
  yield* parser(lexer(input));
}

/**
 * @internal
 * @param {string} input
 * @return {Generator<[string,string],void,void>}
 */
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

/**
 * @typedef {1|2|3|4|5|6|7|8} TokenID Token ID
 * @return {TokenID}
 * @param {Number} n
 */
const _T = (n) => /** @type {TokenID} */(n);
/** @internal */
export const TOK = Object.freeze({EOL: _T(1), EOF: _T(2), Line: _T(3), Comment: _T(4),
  Version: _T(5), Extension: _T(6), LineNo: _T(7), Directive: _T(8)});
/** @internal */
export const TOKENNAMES = Object.freeze({1: 'EOL', 2: 'EOF', 3: 'Line', 4: 'Comment',
  5: 'Version', 6: 'Extension', 7: 'LineNo', 8: 'Directive'});

/**
 * @typedef {Object} LexerToken
 * @property {TokenID} type
 * @property {string} text
 * @property {string} value
 * @property {number} line
 * @property {number} col
 */

/**
 *
 * @param {string} input
 * @return {Generator<LexerToken>}
 */
function* lexer(input) {
  let skipOne = false;
  let c = -1, line = 1, col = 0, lineStart = 0;
  let afterLineContinuation = false, inCommentSingleLine = false, inCommentMultiLine = false;
  /** @type {LexerToken} */
  let curToken = undefined;
  /** @type {string} */
  let curText = undefined;
  /** @param {TokenID} type */
  const setTokenIf = (type) => {
    if (!curToken) {
      setToken(type);
    }
  };
  /** @param {TokenID} type */
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
    c++; col++;
    if (skipOne) {
      skipOne = false;
      continue;
    }
    /** Current char */
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

    } // End main switch
  } // End for
  yield* emitTokenIf();
  yield {type: TOK.EOF, text: '', col, line, value: ''};
}

/**
 * @typedef {Object} ExtensionToken
 * @property {string} ExtensionName
 * @property {string} ExtensionBehavior
 * @typedef {Object} VersionToken
 * @property {string} Version
 * @typedef {LexerToken & Partial<ExtensionToken> & Partial<VersionToken>} ParserToken
 */

/**
 *
 * @param {Generator<LexerToken>} input
 * @return {Generator<ParserToken>}
 */
function* parser(input) {

  /* Coalesce comment tokens, since we could have
  #directive <COMMENT> value1 value2  */

  /** @type {ParserToken[]} */
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
          /** @type {ParserToken} */
          const combinedToken = {...LineTokens[0], type: TOK.Line,
            // Comments are treated syntactically as a single space:
            value: LineTokens.map((token) => token.type === TOK.Comment ? ' ' : token.value).join(''),
            text: LineTokens.map((token) => token.text).join(''),
          };
          const matchPreprocessor = /^[ \t]*#[ \t]*([^ \t].*)?$/u.exec(combinedToken.value);
          if (matchPreprocessor && matchPreprocessor.length === 2) {
            // Preprocessor directive
            const directiveLine = matchPreprocessor[1];
            if (directiveLine !== undefined) {
              const directiveParts = directiveLine.split(/[ \t]+/u);
              if (directiveParts.length > 0) {
                let [directive, ...body] = directiveParts;
                body = body.filter(Boolean); // Filter whitespace
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

/**
 * @internal
 * @param {string} message
 * @param {LexerToken} token
 */
export const formatParseError = (message, token) => `Warning: ${message}\nLine ${
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


/**
 * @return {string}
 * @param {ParserToken} t
 */
const printToken = (t) => {
  const {type, line, col, value, text, ...rest} = t;
  const restKV = Object.entries(rest);
  return `<${TOKENNAMES[type]} L${line}:${col}> v:'${
    formatLine(value)}' t:'${formatLine(text)}'${
      restKV.length ? ` | ${restKV.map(([k, v]) => `${k} : '${v}'`).join(' | ')}`: ''}`;
};

/** @internal */
export function parseDump(input) {
  for (const token of simpleParse(input)) {
    console.log(printToken(token));
  }
}
