import {assert} from 'chai';
import {compressShader} from '../../src/lib/minify.js';

export function minifyTests() {
  describe('Minify', function() {
    describe('#compressShader()', function() {
      it('should minify basic', function() {
        const input = `AAA;\n` +
                      `\n` +
                      `BBB;\n`;
        const expected = `AAA;BBB;`;
        assert.strictEqual(compressShader(input), expected);
      });
      it('should minify preprocessor directives', function() {
        const input = `AAA;\n\n` +
                      `#C\n` +
                      `BBB;\n\n`;
        const expected = `AAA;\n#C\nBBB;`;
        assert.strictEqual(compressShader(input), expected);
      });
    });
  });
}
