import {rollup} from 'rollup';
import {assert} from 'chai';
import {glslProcessSource} from '../../src/lib/glslProcess.js';

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

/** @param {typeof import('../../src/index.js').default} glslOptimize */
export function shaderTests(glslOptimize) {
  describe('glslProcessSource', function() {
    it('should warn about failing to find includes', async function() {
      const input = `#version 300 es
      precision mediump float;

      in vec3 vpos;
      out vec4 outColor;

      void main() {
        outColor = vec4(vpos, 1.0);
      }`;

      mockConsoleError();
      await glslProcessSource('does/not/exist', input, 'frag');
      assert.include(unMockConsoleError(), 'may fail to find includes');
    });
    it('should throw an error for GLSL < 300 es', async function() {
      const input = `#version 100
      precision mediump float;

      in vec3 vpos;
      out vec4 outColor;

      void main() {
        outColor = vec4(vpos, 1.0);
      }`;

      await assert.isRejected(glslProcessSource('.', input, 'frag'), /shaders version/);
    });
  });
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
        plugins: [glslOptimize({optimize: false})],
      });
      const generated = await bundle.generate({format: 'es'});
      const code = generated.output[0].code;
      assert.include(code, 'keepMe');
      assert.include(code, 'optimizeMeOut');
    });
    it('should optimize out unused exports', async function() {
      const bundle = await rollup({
        input: 'test/fixtures/basic.js',
        plugins: [glslOptimize({optimize: true})],
      });
      const generated = await bundle.generate({format: 'es'});
      const code = generated.output[0].code;
      assert.include(code, 'keepMe');
      assert.notInclude(code, 'optimizeMeOut');
    });
  });
}
