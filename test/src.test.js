import {default as glslOptimize} from '../src/index.js';
import {default as runTests} from './shader.js';

runTests(glslOptimize);
