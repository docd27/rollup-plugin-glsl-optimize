# rollup-plugin-glsl-optimize
[![NPM Package][npm]][npm-url]
[![Node.js CI][ci]][ci-url]
[![NPM Publish][npm-publish]][npm-publish-url]
[![Tool Binaries][tool-binaries]][tool-binaries-url]

[![Maintainability][cc-maintainability]][cc-maintainability-url]
[![Coverage Status][coverage]][coverage-url]
[![Dependencies][dependencies]][dependencies-url]
[![Dev Dependencies][dev-dependencies]][dev-dependencies-url]

Import GLSL source files as strings. Pre-processed, validated and optimized with [Khronos Group SPIRV-Tools](https://github.com/KhronosGroup/SPIRV-Tools).

Primary use-case is processing WebGL2 / GLSL ES 300 shaders.

*Plugin supports node >= 14.x*

```js
import frag from './shaders/myShader.frag';
console.log(frag);
```
## Installation

```sh
npm i rollup-plugin-glsl-optimize -D
```

### Khronos tool binaries
This plugin uses binaries from the [Khronos Glslang Validator](https://github.com/KhronosGroup/glslang), [Khronos SPIRV-Tools Optimizer](https://github.com/KhronosGroup/SPIRV-Tools) and [Khronos SPIRV Cross compiler](https://github.com/KhronosGroup/SPIRV-Cross).

They are automatically installed for:
* Windows 64bit (MSVC 2017)
* MacOS x86_64 (clang)
* Ubuntu Trusty / Debian Buster amd64 (clang)
* Untested: Other amd64 Linux distros, arm64 MacOS


Paths can also be manually provided / overridden with the ``GLSLANG_VALIDATOR``, ``GLSLANG_OPTIMIZER``, ``GLSLANG_CROSS`` environment variables.

## Usage
```js
// rollup.config.js
import {default as glslOptimize} from 'rollup-plugin-glsl-optimize';

export default {
    // ...
    plugins: [
        glslOptimize(),
    ]
};
```

## Features

### Preprocessing and Validation
Shaders are pre-processed and validated using the [Khronos Glslang Validator](https://github.com/KhronosGroup/glslang).

Macros are run at build time with support for C-style ``#include`` directives: \*

```glsl
#version 300 es

#include "postProcessingShared.glsl"
#include "dofCircle.glsl"

void main() {
  outColor = CircleDof(UVAndScreenPos, Color, ColorCoc);
}
```
*\* Via the ``GL_GOOGLE_include_directive`` extension. But an ``#extension`` directive is not required nor recommended in your final inlined code.*

### Optimization
**Requires WebGL2 / GLSL ES >= 300**

With ``optimize: true`` (default) shaders will also be compiled to SPIR-V (opengl semantics) and optimized for performance using the [Khronos SPIR-V Tools Optimizer](https://github.com/KhronosGroup/SPIRV-Tools) before being cross-compiled back to GLSL.

#### Known Issues / Caveats
* ``lowp`` precision qualifier - emitted as ``mediump`` \*

  *\* Since SPIR-V has a single ``RelaxedPrecision`` decoration for 16-32bit precision. However most implementations now treat ``mediump`` and ``lowp`` equivalently, hence the lack of need for it in SPIR-V.*

## Shader stages

The following shader stages are supported by the Khronos tools and recognized by file extension:

| Shader Stage | File Extensions                       |
| ------------ | ------------------------------------- |
| Vertex       | ``.vs, .vert, .vs.glsl, .vert.glsl``  |
| Fragment     | ``.fs, .frag, .fs.glsl, .frag.glsl``  |
| Geometry*     | ``.geom, .geom.glsl``                |
| Compute*      | ``.comp, .comp.glsl``                |
| Tess Control* | ``.tesc, .tesc.glsl``                |
| Tess Eval*    | ``.tese, .tese.glsl``                |

*\* Unsupported in WebGL2*

## Options
- `include` : `PathFilter` (default table above) File extensions within rollup to include. Though this option can be reconfigured, shader stage detection still operates based on the table above.
- `exclude` : `PathFilter` (default ``undefined``) File extensions within rollup to exclude.
- `optimize` : ``boolean`` (default true) Optimize via SPIR-V as described in the Optimization section [requires WebGL2 / GLSL ES >= 300]. When disabled simply runs the preprocessor [all supported GLSL versions].
- ``compress`` : ``boolean`` (default true) Strip all whitespace in the sources
- ``includePaths`` : ``string[]`` (default undefined) Additional search paths for ``#include`` directive (source file directory is always searched)
- ``sourceMap`` : ``boolean`` (default true) Emit source maps. These contain the final preprocessed/optimized GLSL source (but not stripped of whitespace) to aid debugging.
- ``emitLineDirectives`` : ``boolean`` (default false) Emit ``#line NN "original.file"`` directives for debugging - useful with ``#include``. Note this requires the ``GL_GOOGLE_cpp_style_line_directive`` extension so the shader will fail to run in drivers that lack support.
- ``optimizerPreserveUnusedBindings`` : ``boolean`` (default true) Ensure that the optimizer preserves all declared bindings, even when those bindings are unused.
- ``preamble`` : ``string`` (default undefined) Prepended to the shader source (after the #version directive, before the preprocessor runs)
### Advanced Options
- ``optimizerDebugSkipOptimizer`` : ``boolean`` (default false) When ``optimize`` enabled, skip the SPIR-V optimizer - compiles to SPIR-V then cross-compiles back to GLSL immediately.
- ``suppressLineExtensionDirective`` : ``boolean`` (default false) When `emitLineDirectives` enabled, suppress the ``GL_GOOGLE_cpp_style_line_directive`` directive.
- ``extraValidatorParams``, ``extraOptimizerParams``, ``extraCrossParams`` : ``string[]`` (default undefined) Additional parameters for the Khronos Glslang Validator [here](doc/glslangValidator.md), the Khronos SPIR-V Optimizer [here](doc/spirv-opt.md), and the Khronos SPIR-V Cross compiler [here](doc/spirv-cross.md).
- ``glslangValidatorPath``, ``glslangOptimizerPath``, ``glslangCrossPath`` : ``string`` (default undefined) Provide / override binary tool paths. Note the environment variables always take precedence if set.

## License

Released under the [MIT license](LICENSE).

*Khronos tool binaries (built by the upstream projects) are distributed and installed with this plugin under the terms of the Apache License Version 2.0. See the corresponding LICENSE files in the ``bin`` folder.*

## See also

* [rollup-plugin-glsl](https://github.com/vwochnik/rollup-plugin-glsl)

[ci]: https://github.com/docd27/rollup-plugin-glsl-optimize/actions/workflows/node-ci.yml/badge.svg
[ci-url]: https://github.com/docd27/rollup-plugin-glsl-optimize/actions/workflows/node-ci.yml
[tool-binaries]: https://github.com/docd27/rollup-plugin-glsl-optimize/actions/workflows/khronos-binaries.yml/badge.svg
[tool-binaries-url]: https://github.com/docd27/rollup-plugin-glsl-optimize/actions/workflows/khronos-binaries.yml
[npm-publish]: https://github.com/docd27/rollup-plugin-glsl-optimize/actions/workflows/npm-publish.yml/badge.svg
[npm-publish-url]: https://github.com/docd27/rollup-plugin-glsl-optimize/actions/workflows/npm-publish.yml
[npm]: https://img.shields.io/npm/v/rollup-plugin-glsl-optimize.svg
[npm-url]: https://www.npmjs.com/package/rollup-plugin-glsl-optimize
[dependencies]: https://img.shields.io/david/docd27/rollup-plugin-glsl-optimize.svg
[dependencies-url]: https://david-dm.org/docd27/rollup-plugin-glsl-optimize
[dev-dependencies]: https://img.shields.io/david/dev/docd27/rollup-plugin-glsl-optimize.svg
[dev-dependencies-url]: https://david-dm.org/docd27/rollup-plugin-glsl-optimize?type=dev
[cc-maintainability]: https://api.codeclimate.com/v1/badges/b1dfc39fd650dd54f730/maintainability
[cc-maintainability-url]: https://codeclimate.com/github/docd27/rollup-plugin-glsl-optimize/maintainability
[coverage]: https://img.shields.io/coveralls/github/docd27/rollup-plugin-glsl-optimize
[coverage-url]: https://coveralls.io/github/docd27/rollup-plugin-glsl-optimize?branch=master
