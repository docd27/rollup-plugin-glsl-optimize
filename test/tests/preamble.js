import {assert} from 'chai';
import * as preamble from '../../src/lib/preamble.js';
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

export function preambleTests() {
  describe('Preamble', function() {
    describe('#insertPreamble()', function() {
      const preambleTest = (input, insert) => preamble.insertPreamble(input, insert).code;
      const preambleTokenTest = (input, insert) => preamble.test.insertPreambleTokens(
          parse.simpleParse(input),
          (fixupLineNo) => ({col: 0, line: fixupLineNo, type: 4, value: '', text:
      `@${fixupLineNo}:${insert}\n`})).code;
      it('should throw error with version directive on wrong line', function() {
        const input = '\n#version 200';
        assert.throws(() => preambleTest(input, 'test'), /#version directive must be on first line/);
      });
      it('should insert preamble after version directive', function() {
        const input = '#version 200\nA\n';
        const expected = '#version 200\n@2:test\nA\n';
        assert.strictEqual(preambleTokenTest(input, 'test'), expected);
      });
      it('should insert preamble after version directive with inline comment', function() {
        const input = '#version 200/*test\ntest*/\nA\n';
        const expected = '#version 200\n@3:test\nA\n';
        assert.strictEqual(preambleTokenTest(input, 'test'), expected);
      });
      it('should insert preamble after version directive with comment', function() {
        const input = '/*test\ntest*/#version 200';
        const expected = '/*test\ntest*/#version 200\n@3:test\n';
        assert.strictEqual(preambleTokenTest(input, 'test'), expected);
      });
      it('should insert preamble after version directive without newline', function() {
        const input = '#version 200';
        const expected = '#version 200\n@2:test\n';
        assert.strictEqual(preambleTokenTest(input, 'test'), expected);
      });
      it('should append preamble to zero length input', function() {
        const input = '';
        const expected = '@1:test\n';
        mockConsoleError();
        const result = preambleTokenTest(input, 'test');
        unMockConsoleError();
        assert.strictEqual(result, expected);
      });
      it('should append preamble to input without version directive', function() {
        const input = 'A\nB\n';
        const expected = '@1:test\nA\nB\n';
        mockConsoleError();
        const result = preambleTokenTest(input, 'test');
        unMockConsoleError();
        assert.strictEqual(result, expected);
      });
      it('should append preamble to input without version directive, empty first line', function() {
        const input = '\nA\nB\n';
        const expected = '@1:test\n\nA\nB\n';
        mockConsoleError();
        const result = preambleTokenTest(input, 'test');
        unMockConsoleError();
        assert.strictEqual(result, expected);
      });
    });
    describe('#insertExtensionPreamble()', function() {
      const preambleExtTest = (input) => preamble.insertExtensionPreamble(input, 'test.frag',
          () => '300 es', 'preamble').code;
      const extTest = (input) => preamble.insertExtensionPreamble(input, 'test.frag').code;
      it('should insert preamble with no version directive', function() {
        const input = 'B\nA\n';
        const expected = '#version 300 es\n' +
        '#extension GL_GOOGLE_include_directive : require\n' +
        'preamble\n' +
        '#line 1 "test.frag"\n' +
        'B\n' +
        'A\n';
        mockConsoleError();
        const result = preambleExtTest(input);
        unMockConsoleError();
        assert.strictEqual(result, expected);
      });
      it('should insert preamble after version directive', function() {
        const input = '#version 200\nA\n';
        const expected = '#version 300 es\n' +
        '#extension GL_GOOGLE_include_directive : require\n' +
        'preamble\n' +
        '#line 2 "test.frag"\n' +
        'A\n';
        assert.strictEqual(preambleExtTest(input), expected);
      });
      it('should preserve existing matching #extension directive', function() {
        const input = '#version 100\n' +
        '#extension GL_GOOGLE_include_directive : enable\n' +
        'A\n';
        const expected = '#version 300 es\n' +
        '#extension GL_GOOGLE_include_directive : require\n' +
        'preamble\n' +
        '#line 2 "test.frag"\n' +
        '#extension GL_GOOGLE_include_directive : enable\n' +
        'A\n';
        assert.strictEqual(preambleExtTest(input), expected);
      });
      it('should error with disabled #extension directive', function() {
        const input = '#version 100\n' +
        '#extension GL_GOOGLE_include_directive : disable\n' +
        'A\n';
        assert.throws(() => preambleExtTest(input), /extension GL_GOOGLE_include_directive cannot be disabled/);
      });
      it('should insert without version or preamble replacer and handle line_directive', function() {
        const input = '#version 100\n' +
        '#extension GL_GOOGLE_cpp_style_line_directive : enable\n' +
        'A\n';
        const expected = '#version 100\n' +
        '#extension GL_GOOGLE_include_directive : require\n' +
        '#line 2 "test.frag"\n' +
        '#extension GL_GOOGLE_cpp_style_line_directive : enable\n' +
        'A\n';
        assert.strictEqual(extTest(input), expected);
      });
    });
    describe('#fixupDirectives()', function() {
      it('should strip include and line directives', function() {
        const input = '#version 300 es\n' +
        '#extension GL_GOOGLE_include_directive : require\n' +
        'preamble\n' +
        '#line 1 "test.frag"\n' +
        'B\n' +
        'A\n';
        const expected = '#version 300 es\n' +
        'preamble\n' +
        'B\n' +
        'A\n';
        const result = preamble.fixupDirectives(input, false, true, false, true);
        assert.strictEqual(result, expected);
      });
      it('should strip line ext and preserve line directives', function() {
        const input = '#version 300 es\n' +
        '#extension GL_GOOGLE_cpp_style_line_directive : require\n' +
        'preamble\n' +
        '#line 1 "test.frag"\n' +
        'B\n' +
        'A\n';
        const expected = '#version 300 es\n' +
        'preamble\n' +
        '#line 1 "test.frag"\n' +
        'B\n' +
        'A\n';
        const result = preamble.fixupDirectives(input, false, true, true, false);
        assert.strictEqual(result, expected);
      });
      it('should warn about missing extension directives', function() {
        const input = '#version 300 es\n' +
        'preamble\n' +
        '#line 1 "test.frag"\n' +
        'B\n' +
        'A\n';
        const expected = '#version 300 es\n' +
        'preamble\n' +
        '#line 1 "test.frag"\n' +
        'B\n' +
        'A\n';
        mockConsoleError();
        const result = preamble.fixupDirectives(input, false, true, true, false);
        assert.include(unMockConsoleError(), `couldn't find GL_GOOGLE_cpp_style_line_directive`);
        assert.strictEqual(result, expected);
      });
      it('should preserve and warn about disabled extension directives', function() {
        const input = '#version 300 es\n' +
        'preamble\n' +
        '#extension GL_GOOGLE_cpp_style_line_directive : require\n' +
        '#extension GL_GOOGLE_cpp_style_line_directive : disabled\n' +
        '#line 1 "test.frag"\n' +
        'B\n' +
        'A\n';
        const expected = '#version 300 es\n' +
        'preamble\n' +
        '#extension GL_GOOGLE_cpp_style_line_directive : require\n' +
        '#extension GL_GOOGLE_cpp_style_line_directive : disabled\n' +
        '#line 1 "test.frag"\n' +
        'B\n' +
        'A\n';
        mockConsoleError();
        const result = preamble.fixupDirectives(input, true, true, true, false);
        assert.include(unMockConsoleError(), `extension GL_GOOGLE_cpp_style_line_directive disabled`);
        assert.strictEqual(result, expected);
      });
    });
  });
}
