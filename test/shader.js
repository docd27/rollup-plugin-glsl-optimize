import {rollup} from 'rollup';
import {assert} from 'chai';


/** @param {typeof import('../src/index.js').default} glslOptimize */
export default function runTests(glslOptimize) {
  process.chdir('test');
  describe('Shader', function() {
    it('should preserve all exports when just preprocessing', async function() {
      const bundle = await rollup({
          input: 'fixtures/basic.js',
          plugins: [glslOptimize({ optimize: false })],
      });
      const generated = await bundle.generate({ format: 'es' });
      const code = generated.output[0].code;
      assert.include(code, 'keepMe');
      assert.include(code, 'optimizeMeOut');
    });
    it('should optimize out unused exports', async function() {
      const bundle = await rollup({
          input: 'fixtures/basic.js',
          plugins: [glslOptimize({ optimize: true })],
      });
      const generated = await bundle.generate({ format: 'es' });
      const code = generated.output[0].code;
      assert.include(code, 'keepMe');
      assert.notInclude(code, 'optimizeMeOut');
    });
  });
}
