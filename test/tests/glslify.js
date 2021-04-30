import {npmCommand} from '../../src/lib/tools.js';
import {rollup} from 'rollup';
import {assert} from 'chai';
import * as fsSync from 'fs';

async function glslifyUninstall() {
  await npmCommand(['uninstall', 'glslify', 'glsl-noise']);
  assert.isFalse(fsSync.existsSync('node_modules/glslify'), 'glslify failed to uninstall');
}

async function glslifyInstall() {
  await npmCommand(['install', '--no-save', 'glslify', 'glsl-noise']);
      assert.isTrue(fsSync.existsSync('node_modules/glslify'), 'glslify failed to install');
}


/**
 * @param {typeof import('../../src/index.js').default} glslOptimize
 */
export function glslifyTests(glslOptimize) {
  describe('glslify uninstalled test', function() {
    this.timeout(30000);
    before('uninstall glslify', glslifyUninstall);
    it('should not have glslify available when uninstalled', async function() {
      assert.isRejected(rollup({
        input: 'test/fixtures/basic.js',
        plugins: [glslOptimize({ optimize: false, glslify: true })],
      }), /glslify could not be found/);
    });
  });

  describe('glslify installed test', function() {
    this.timeout(30000);
    before('install glslify', glslifyInstall);
    after('uninstall glslify', glslifyUninstall);
    it('should pass with glslify enabled but unused', async function() {
      const bundle = await rollup({
        input: 'test/fixtures/basic.js',
        plugins: [glslOptimize({ glslify: true })],
      });
      const generated = await bundle.generate({ format: 'es' });
      const code = generated.output[0].code;
      assert.include(code, 'keepMe');
      assert.notInclude(code, 'optimizeMeOut');
    });
    it('should include basic unoptimized glslify', async function() {
      const bundle = await rollup({
        input: 'test/fixtures/glslify.js',
        plugins: [glslOptimize({optimize: false, glslify: true})],
      });
      const generated = await bundle.generate({ format: 'es' });
      const code = generated.output[0].code;
      assert.include(code, 'sub1');
      assert.include(code, 'sub2');
    });
    it('should inline pure glslify functions', async function() {
      const bundle = await rollup({
        input: 'test/fixtures/glslify.js',
        plugins: [glslOptimize({glslify: true})],
      });
      const generated = await bundle.generate({ format: 'es' });
      const code = generated.output[0].code;
      assert.notInclude(code, 'sub1', 'sub1 was not inlined');
      assert.notInclude(code, 'sub2', 'sub2 was not inlined');
    });
    it('should import glsl-noise correctly', async function() {
      const bundle = await rollup({
        input: 'test/fixtures/glslify-noise.js',
        plugins: [glslOptimize({glslify: true, optimize: false, compress: false})],
      });
      const generated = await bundle.generate({ format: 'es' });
      const code = generated.output[0].code;
      assert.include(code, 'taylorInvSqrt', 'taylorInvSqrt was not included');
      assert.notInclude(code, 'pragma glslify', 'pragma glslify was left in');
    });
  });
}
