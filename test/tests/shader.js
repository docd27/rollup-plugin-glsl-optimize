import {rollup} from 'rollup';
import {assert} from 'chai';


/** @param {typeof import('../../src/index.js').default} glslOptimize */
export function shaderTests(glslOptimize) {
  describe('Shader', function() {
    it('should throw an error with a .glsl lacking a shader stage file extension', async function() {
      assert.isRejected(rollup({
        input: 'test/fixtures/stageless.js',
        plugins: [glslOptimize()],
      }), /extension did not match a shader stage/);
    });
    it('should preserve all exports when just preprocessing', async function() {
      const bundle = await rollup({
          input: 'test/fixtures/basic.js',
          plugins: [glslOptimize({ optimize: false })],
      });
      const generated = await bundle.generate({ format: 'es' });
      const code = generated.output[0].code;
      assert.include(code, 'keepMe');
      assert.include(code, 'optimizeMeOut');
    });
    it('should optimize out unused exports', async function() {
      const bundle = await rollup({
          input: 'test/fixtures/basic.js',
          plugins: [glslOptimize({ optimize: true })],
      });
      const generated = await bundle.generate({ format: 'es' });
      const code = generated.output[0].code;
      assert.include(code, 'keepMe');
      assert.notInclude(code, 'optimizeMeOut');
    });
  });
}