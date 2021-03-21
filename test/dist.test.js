import {default as glslOptimize} from '../dist/index.js';
import {default as runTests} from './shader.js';

runTests(glslOptimize);
