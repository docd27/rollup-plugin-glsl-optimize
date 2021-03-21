import {installTests} from './install.js';
import {shaderTests} from './shader.js';

/** @param {typeof import('../../src/index.js').default} glslOptimize */
export function runTests(glslOptimize) {
  installTests();
  shaderTests(glslOptimize);
}

