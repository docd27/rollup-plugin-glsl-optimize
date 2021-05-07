import {assert} from 'chai';
import * as parse from '../../src/lib/parse.js';

const consoleOrig = global.console;
let outBuf;
function mockConsoleError() {
  outBuf = '';
  global.console = {...consoleOrig};
  global.console.error = (...args) => {
    outBuf += `${args.map(String).join(' ')}\n`;
  };
  global.console.warn = global.console.error;
}
function unMockConsoleError() {
  global.console = consoleOrig;
  return outBuf;
}

export function parserTests() {
  describe('Parser', function() {
    describe('#lexer()', function() {
      const lexerTest = (input) => [...parse.test.lexer(input)].map(parse.test.printToken);
      it('should lex empty input', function() {
        const input = ``;
        const expected = [
          `<EOF L1:0> v:'' t:''`,
        ];
        assert.deepStrictEqual(lexerTest(input), expected);
      });
      it('should lex input without terminating newline', function() {
        const input = `A`;
        const expected = [
          `<Line L1:1> v:'A' t:'A'`,
          `<EOF L1:1> v:'' t:''`,
        ];
        assert.deepStrictEqual(lexerTest(input), expected);
      });
      it('should lex newlines correctly', function() {
        /* GLSL ES 300 spec:
          Lines are relevant for compiler diagnostic messages and the preprocessor.
          They are terminated by carriage-return or line-feed.
          If both are used together, it will count as only a single line termination.
        */
        const input = `A\nB\rC\r\nD\n\rE\n\r\nF\r\n\rG`;
        const expected = [
          `<Line L1:1> v:'A' t:'A'`,
          `<EOL L1:2> v:'<EOL>' t:'<EOL>'`,
          `<Line L2:1> v:'B' t:'B'`,
          `<EOL L2:2> v:'<EOL>' t:'<CR>'`,
          `<Line L3:1> v:'C' t:'C'`,
          `<EOL L3:2> v:'<EOL>' t:'<CR><EOL>'`,
          `<Line L4:2> v:'D' t:'D'`,
          `<EOL L4:3> v:'<EOL>' t:'<EOL><CR>'`,
          `<Line L5:2> v:'E' t:'E'`,
          `<EOL L5:3> v:'<EOL>' t:'<EOL><CR>'`,
          `<EOL L6:2> v:'<EOL>' t:'<EOL>'`,
          `<Line L7:1> v:'F' t:'F'`,
          `<EOL L7:2> v:'<EOL>' t:'<CR><EOL>'`,
          `<EOL L8:2> v:'<EOL>' t:'<CR>'`,
          `<Line L9:1> v:'G' t:'G'`,
          `<EOF L9:1> v:'' t:''`,
        ];
        assert.deepStrictEqual(lexerTest(input), expected);
      });
      it('should lex line continuations correctly', function() {
        /* GLSL ES 300 spec:
          Lines separated by the line-continuation character preceding a new line are concatenated together before
          either comment processing or preprocessing.  This means that no white space is substituted for the
          line-continuation character.  That is, a single token could be formed by the concatenation by taking the
          characters at the end of one line concatenating them with the characters at the beginning of the next line.
        */
        const input = `A\\\nB\\\rC\\\r\nD\\\n\rE\\\n\r\\\nF\\\r\n\\\rG/*test\\\ntest*/`;
        const expected = [
          `<Line L1:1> v:'ABCDEFG' t:'A\\<EOL>B\\<CR>C\\<CR><EOL>D\\<EOL><CR>E\\<EOL><CR>\\<EOL>F\\<CR><EOL>\\<CR>G'`,
          `<Comment L9:2> v:'testtest' t:'/*test\\<EOL>test*/'`,
          `<EOF L10:6> v:'' t:''`,
        ];
        assert.deepStrictEqual(lexerTest(input), expected);
      });
      it('should lex comments correctly', function() {
        const input = `/*A*/\n` +
                      `X\n` +
                      `//B\n` +
                      `Y\n` +
                      `/*C//D*/\n` +
                      `Z`;
        const expected = [
          `<Comment L1:1> v:'A' t:'/*A*/'`,
          `<EOL L1:6> v:'<EOL>' t:'<EOL>'`,
          `<Line L2:1> v:'X' t:'X'`,
          `<EOL L2:2> v:'<EOL>' t:'<EOL>'`,
          `<Comment L3:1> v:'B' t:'//B'`,
          `<EOL L3:4> v:'<EOL>' t:'<EOL>'`,
          `<Line L4:1> v:'Y' t:'Y'`,
          `<EOL L4:2> v:'<EOL>' t:'<EOL>'`,
          `<Comment L5:1> v:'C//D' t:'/*C//D*/'`,
          `<EOL L5:9> v:'<EOL>' t:'<EOL>'`,
          `<Line L6:1> v:'Z' t:'Z'`,
          `<EOF L6:1> v:'' t:''`,
        ];
        assert.deepStrictEqual(lexerTest(input), expected);
      });
      it('should lex multi-line comments correctly', function() {
        const input = `/*A\n` +
                      `B\tC*/\n` +
                      `X\n`;
        const expected = [
          `<Comment L1:1> v:'A<EOL>B<TAB>C' t:'/*A<EOL>B<TAB>C*/'`,
          `<EOL L2:6> v:'<EOL>' t:'<EOL>'`,
          `<Line L3:1> v:'X' t:'X'`,
          `<EOL L3:2> v:'<EOL>' t:'<EOL>'`,
          `<EOF L4:0> v:'' t:''`,
        ];
        assert.deepStrictEqual(lexerTest(input), expected);
      });
      it('should lex non-tokens correctly', function() {
        const input = `/A\n` +
                      `\\B\tC*/\n` +
                      `//X\n`;
        const expected = [
          `<Line L1:1> v:'/A' t:'/A'`,
          `<EOL L1:3> v:'<EOL>' t:'<EOL>'`,
          `<Line L2:1> v:'\\B<TAB>C*/' t:'\\B<TAB>C*/'`,
          `<EOL L2:7> v:'<EOL>' t:'<EOL>'`,
          `<Comment L3:1> v:'X' t:'//X'`,
          `<EOL L3:4> v:'<EOL>' t:'<EOL>'`,
          `<EOF L4:0> v:'' t:''`,
        ];
        assert.deepStrictEqual(lexerTest(input), expected);
      });
    });
    describe('#simpleParse()', function() {
      const parserTest = (input) => [...parse.simpleParse(input)].map(parse.test.printToken);
      const parserDirectTest = (input) => [...parse.test.parser(input)].map(parse.test.printToken);
      it('should parse empty input', function() {
        const input = ``;
        const expected = [
          `<EOF L1:0> v:'' t:''`,
        ];
        assert.deepStrictEqual(parserTest(input), expected);
      });
      it('should pass-through existing tokens', function() {
        const input = [{type: 8, text: '', col: 1, line: 1, value: '', test: 'test'}];
        const expected = [
          `<Directive L1:1> v:'' t:'' | test : 'test'`,
        ];
        assert.deepStrictEqual(parserDirectTest(input), expected);
      });
      it('should parse inline comments as a single space', function() {
        /* GLSL ES 300 spec:
         * All comments are replaced with a single space
         */
        const input = `#pragma/* A B \n C */test`;
        const expected = [
          `<Directive L1:1> v:'#pragma test' t:'#pragma/* A B <EOL> C */test'`,
          `<EOF L2:9> v:'' t:''`,
        ];
        assert.deepStrictEqual(parserTest(input), expected);
      });
      it('should yield top level comments', function() {
        const input = `#pragma test\n/* A B \n C */\ntest`;
        const expected = [
          `<Directive L1:1> v:'#pragma test' t:'#pragma test'`,
          `<EOL L1:13> v:'<EOL>' t:'<EOL>'`,
          `<Comment L2:1> v:' A B <EOL> C ' t:'/* A B <EOL> C */'`,
          `<EOL L3:6> v:'<EOL>' t:'<EOL>'`,
          `<Line L4:1> v:'test' t:'test'`,
          `<EOF L4:4> v:'' t:''`,
        ];
        assert.deepStrictEqual(parserTest(input), expected);
      });
      it('should parse directives', function() {
        const input = `#version test\n#line test\n#extension test : require\n`;
        const expected = [
          `<Version L1:1> v:'#version test' t:'#version test' | Version : 'test'`,
          `<EOL L1:14> v:'<EOL>' t:'<EOL>'`,
          `<LineNo L2:1> v:'#line test' t:'#line test'`,
          `<EOL L2:11> v:'<EOL>' t:'<EOL>'`,
          `<Extension L3:1> v:'#extension test : require' t:` +
            `'#extension test : require' | ExtensionName : 'test' | ExtensionBehavior : 'require'`,
          `<EOL L3:26> v:'<EOL>' t:'<EOL>'`,
          `<EOF L4:0> v:'' t:''`,
        ];
        assert.deepStrictEqual(parserTest(input), expected);
      });
      it('should warn about invalid extension directives', function() {
        mockConsoleError();
        parserTest('#extension test');
        assert.include(unMockConsoleError(), 'Warning: #extension directive: parse error');

        mockConsoleError();
        parserTest('#extension test : potato');
        assert.include(unMockConsoleError(), `unknown behavior 'potato'`);
      });
    });
  });
}
