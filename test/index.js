import {rollup} from 'rollup';
import {default as test} from 'tape';

import {default as glslOptimize} from '../index.js';


process.chdir('test');

test('preprocessed', assert => rollup({
    input: 'fixtures/basic.js',
    plugins: [glslOptimize({ optimize: false })],
}).then(bundle => bundle.generate({ format: 'es' })).then(generated => {
    const code = generated.output[0].code;
    assert.true(code.includes('keepMe'));
    assert.true(code.includes('optimizeMeOut'));
    assert.end();
}).catch(err => {
    assert.error(err);
    assert.end();
}));

test('optimized', assert => rollup({
    input: 'fixtures/basic.js',
    plugins: [glslOptimize()]
}).then(bundle => bundle.generate({ format: 'es' })).then(generated => {

    const code = generated.output[0].code;
    assert.true(code.includes('keepMe'));
    assert.true(!code.includes('optimizeMeOut'));
    assert.end();
}).catch(err => {
    assert.error(err);
    assert.end();
}));
