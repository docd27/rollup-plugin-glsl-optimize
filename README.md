# rollup-plugin-glsl-optimize
[![NPM Package][npm]][npm-url]
[![Tool Binaries][tool-binaries]][tool-binaries-url]
[![Dependencies][dependencies]][dependencies-url]
[![Dev Dependencies][dev-dependencies]][dev-dependencies-url]

Import GLSL source files. Pre-processed, validated and optimized with [Khronos Group SPIRV-Tools](https://github.com/KhronosGroup/SPIRV-Tools).

```js
import frag from './shaders/myShader.frag';
console.log(frag);
```
## Installation

```sh
npm i rollup-plugin-glsl-optimize -D
```
### Khronos tool binaries
This plugin requires binaries from the [Khronos Glslang Validator](https://github.com/KhronosGroup/glslang), [Khronos SPIRV-Tools Optimizer](https://github.com/KhronosGroup/SPIRV-Tools) and [Khronos SPIRV Cross compiler](https://github.com/KhronosGroup/SPIRV-Cross).

Upstream builds are automatically installed for:
* Windows 64bit (MSVC 2017)
* Ubuntu Trusty / Debian amd64 (clang)
* MacOS x86_64 (clang)

Otherwise tool paths are provided / overridden with the ``GLSLANG_VALIDATOR``, ``GLSLANG_OPTIMIZER``, ``GLSLANG_CROSS`` environment variables.

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
Shaders are pre-processed and validated using the [Khronos Glslang Validator](https://github.com/KhronosGroup/glslang) which helps identify syntactic and semantic errors.

Macros like ``#define`` are now run at build time. There's also support for C-style ``#include`` directives*:

```glsl
#version 300 es

#include "postProcessingShared.glsl"
#include "dofCircle.glsl"

void main() {
  outColor = CircleDof(UVAndScreenPos, Color, ColorCoc);
}
```
*Via the ``GL_GOOGLE_include_directive`` extension. But an ``#extension`` directive is neither required nor recommended since most browsers/drivers will throw an error.*

### Optimization
**Requires WebGL2 / GLSL ES >= 300**

With ``optimize: true`` (default) shaders will also be compiled to SPIR-V (opengl semantics) and optimized for performance using the [Khronos SPIR-V Tools Optimizer](https://github.com/KhronosGroup/SPIRV-Tools) before being cross-compiled back to GLSL.

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

*\* Unsupported in WebGL and therefore untested*

## Options
- `include` : `PathFilter` (default table above) File extensions within rollup to include. Though this option can be reconfigured, shader stage detection still operates based on the table above.
- `exclude` : `PathFilter` (default ``undefined``) File extensions within rollup to exclude.
- `optimize` : ``boolean`` (default true) Optimize via SPIR-V as described in the Optimization section [requires WebGL2 / GLSL ES >= 300]. When disabled simply runs the preprocessor [all supported GLSL versions].
- ``compress`` : ``boolean`` (default true) Strip all whitespace in the sources
- ``includePaths`` : ``string[]`` (default undefined) Additional search paths for ``#include`` directive (source file directory is always searched)
- ``sourceMap`` : ``boolean`` (default true) Emit source maps (for the final GLSL source within Javascript)
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

*Khronos tool binaries (built and made available by the upstream projects) are distributed and installed with this plugin under the terms of the Apache License Version 2.0 (consult the corresponding LICENSE files in the ``bin`` folder).*

## See also

* [rollup-plugin-glsl](https://github.com/vwochnik/rollup-plugin-glsl)

[tool-binaries]: https://github.com/docd27/rollup-plugin-glsl-optimize/actions/workflows/khronos-binaries.yml/badge.svg
[tool-binaries-url]: https://github.com/docd27/rollup-plugin-glsl-optimize/actions/workflows/khronos-binaries.yml
[npm]: https://img.shields.io/npm/v/rollup-plugin-glsl-optimize.svg
[npm-url]: https://www.npmjs.com/package/rollup-plugin-glsl-optimize
[dependencies]: https://img.shields.io/david/docd27/rollup-plugin-glsl-optimize.svg
[dependencies-url]: https://david-dm.org/docd27/rollup-plugin-glsl-optimize
[dev-dependencies]: https://img.shields.io/david/dev/docd27/rollup-plugin-glsl-optimize.svg
[dev-dependencies-url]: https://david-dm.org/docd27/rollup-plugin-glsl-optimize?type=dev