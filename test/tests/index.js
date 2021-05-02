import * as util from 'util';
import chai from 'chai';
import chaiAsPromised from 'chai-as-promised';

import {installTests} from './install.js';
import {glslifyTests} from './glslify.js';
import {shaderTests} from './shader.js';
import {settings} from '../../settings.js';

/**
 * Log to console without mocking
 * @param  {...any} args
 */
export function log(...args) {
  const res = args.map((v) => typeof v === 'string' ? v : util.inspect(v, false, null)).join(' ');
  process.stdout.write(`${res}\n`);
}

/** @param {typeof import('../../src/index.js').default} glslOptimize */
export function runTests(glslOptimize) {
  process.chdir(settings.PROJECT_ROOT);
  chai.use(chaiAsPromised);

  installTests();
  shaderTests(glslOptimize);
  glslifyTests(glslOptimize);
}

