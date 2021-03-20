# SPIRV-Cross

```
Usage: spirv-cross <...>

Basic:
	[SPIR-V file] (- is stdin)
	[--output <output path>]: If not provided, prints output to stdout.
	[--dump-resources]:
		Prints a basic reflection of the SPIR-V module along with other output.
	[--help]:
		Prints this help message.

Select backend:
	By default, OpenGL-style GLSL is the target, with #version and GLSL/ESSL information inherited from the SPIR-V module if present.
	[--vulkan-semantics] or [-V]:
		Emit Vulkan GLSL instead of plain GLSL. Makes use of Vulkan-only features to match SPIR-V.
	[--msl]:
		Emit Metal Shading Language (MSL).
	[--hlsl]:
		Emit HLSL.
	[--reflect]:
		Emit JSON reflection.
	[--cpp]:
		DEPRECATED. Emits C++ code.

Common options:
	[--entry name]:
		Use a specific entry point. By default, the first entry point in the module is used.
	[--stage <stage (vert, frag, geom, tesc, tese comp)>]:
		Forces use of a certain shader stage.
		Can disambiguate the entry point if more than one entry point exists with same name, but different stage.
	[--emit-line-directives]:
		If SPIR-V has OpLine directives, aim to emit those accurately in output code as well.
	[--rename-entry-point <old> <new> <stage>]:
		Renames an entry point from what is declared in SPIR-V to code output.
		Mostly relevant for HLSL or MSL.
	[--rename-interface-variable <in|out> <location> <new_variable_name>]:
		Rename an interface variable based on location decoration.
	[--force-zero-initialized-variables]:
		Forces temporary variables to be initialized to zero.
		Can be useful in environments where compilers do not allow potentially uninitialized variables.
		This usually comes up with Phi temporaries.
	[--fixup-clipspace]:
		Fixup Z clip-space at the end of a vertex shader. The behavior is backend-dependent.
		GLSL: Rewrites [0, w] Z range (D3D/Metal/Vulkan) to GL-style [-w, w].
		HLSL/MSL: Rewrites [-w, w] Z range (GL) to D3D/Metal/Vulkan-style [0, w].
	[--flip-vert-y]:
		Inverts gl_Position.y (or equivalent) at the end of a vertex shader. This is equivalent to using negative viewport height.

GLSL options:
	[--es]:
		Force ESSL.
	[--no-es]:
		Force desktop GLSL.
	[--version <GLSL version>]:
		E.g. --version 450 will emit '#version 450' in shader.
		Code generation will depend on the version used.
	[--flatten-ubo]:
		Emit UBOs as plain uniform arrays which are suitable for use with glUniform4*v().
		This can be an optimization on GL implementations where this is faster or works around buggy driver implementations.
		E.g.: uniform MyUBO { vec4 a; float b, c, d, e; }; will be emitted as uniform vec4 MyUBO[2];
		Caveat: You cannot mix and match floating-point and integer in the same UBO with this option.
		Legacy GLSL/ESSL (where this flattening makes sense) does not support bit-casting, which would have been the obvious workaround.
	[--extension ext]:
		Add #extension string of your choosing to GLSL output.
		Useful if you use variable name remapping to something that requires an extension unknown to SPIRV-Cross.
	[--remove-unused-variables]:
		Do not emit interface variables which are not statically accessed by the shader.
	[--separate-shader-objects]:
		Redeclare gl_PerVertex blocks to be suitable for desktop GL separate shader objects.
	[--glsl-emit-push-constant-as-ubo]:
		Instead of a plain uniform of struct for push constants, emit a UBO block instead.
	[--glsl-emit-ubo-as-plain-uniforms]:
		Instead of emitting UBOs, emit them as plain uniform structs.
	[--glsl-remap-ext-framebuffer-fetch input-attachment color-location]:
		Remaps an input attachment to use GL_EXT_shader_framebuffer_fetch.
		gl_LastFragData[location] is read from. The attachment to read from must be declared as an output in the shader.
	[--vulkan-glsl-disable-ext-samplerless-texture-functions]:
		Do not allow use of GL_EXT_samperless_texture_functions, even in Vulkan GLSL.
		Use of texelFetch and similar might have to create dummy samplers to work around it.
	[--combined-samplers-inherit-bindings]:
		Inherit binding information from the textures when building combined image samplers from separate textures and samplers.
	[--no-support-nonzero-baseinstance]:
		When using gl_InstanceIndex with desktop GL,
		assume that base instance is always 0, and do not attempt to fix up gl_InstanceID to match Vulkan semantics.
	[--pls-in format input-name]:
		Remaps a subpass input with name into a GL_EXT_pixel_local_storage input.
		Entry in PLS block is ordered where first --pls-in marks the first entry. Can be called multiple times.
		Formats allowed: r11f_g11f_b10f, r32f, rg16f, rg16, rgb10_a2, rgba8, rgba8i, rgba8ui, rg16i, rgb10_a2ui, rg16ui, r32ui.
		Requires ESSL.
	[--pls-out format output-name]:
		Remaps a color output with name into a GL_EXT_pixel_local_storage output.
		Entry in PLS block is ordered where first --pls-output marks the first entry. Can be called multiple times.
		Formats allowed: r11f_g11f_b10f, r32f, rg16f, rg16, rgb10_a2, rgba8, rgba8i, rgba8ui, rg16i, rgb10_a2ui, rg16ui, r32ui.
		Requires ESSL.
	[--remap source_name target_name components]:
		Remaps a variable to a different name with N components.
		Main use case is to remap a subpass input to gl_LastFragDepthARM.
		E.g.:
		uniform subpassInput uDepth;
		--remap uDepth gl_LastFragDepthARM 1 --extension GL_ARM_shader_framebuffer_fetch_depth_stencil
	[--no-420pack-extension]:
		Do not make use of GL_ARB_shading_language_420pack in older GL targets to support layout(binding).
	[--remap-variable-type <variable_name> <new_variable_type>]:
		Remaps a variable type based on name.
		Primary use case is supporting external samplers in ESSL for video rendering on Android where you could remap a texture to a YUV one.
	[--glsl-force-flattened-io-blocks]:
		Always flatten I/O blocks and structs.

MSL options:
	[--msl-version <MMmmpp>]:
		Uses a specific MSL version, e.g. --msl-version 20100 for MSL 2.1.
	[--msl-capture-output]:
		Writes geometry varyings to a buffer instead of as stage-outputs.
	[--msl-swizzle-texture-samples]:
		Works around lack of support for VkImageView component swizzles.
		This has a massive impact on performance and bloat. Do not use this unless you are absolutely forced to.
		To use this feature, the API side must pass down swizzle buffers.
		Should only be used by translation layers as a last resort.
		Recent Metal versions do not require this workaround.
	[--msl-ios]:
		Target iOS Metal instead of macOS Metal.
	[--msl-pad-fragment-output]:
		Always emit color outputs as 4-component variables.
		In Metal, the fragment shader must emit at least as many components as the render target format.
	[--msl-domain-lower-left]:
		Use a lower-left tessellation domain.
	[--msl-argument-buffers]:
		Emit Indirect Argument buffers instead of plain bindings.
		Requires MSL 2.0 to be enabled.
	[--msl-texture-buffer-native]:
		Enable native support for texel buffers. Otherwise, it is emulated as a normal texture.
	[--msl-framebuffer-fetch]:
		Implement subpass inputs with frame buffer fetch.
		Emits [[color(N)]] inputs in fragment stage.
		Requires an Apple GPU.
	[--msl-emulate-cube-array]:
		Emulate cube arrays with 2D array and manual math.
	[--msl-discrete-descriptor-set <index>]:
		When using argument buffers, forces a specific descriptor set to be implemented without argument buffers.
		Useful for implementing push descriptors in emulation layers.
		Can be used multiple times for each descriptor set in question.
	[--msl-device-argument-buffer <descriptor set index>]:
		Use device address space to hold indirect argument buffers instead of constant.
		Comes up when trying to support argument buffers which are larger than 64 KiB.
	[--msl-multiview]:
		Enable SPV_KHR_multiview emulation.
	[--msl-multiview-no-layered-rendering]:
		Don't set [[render_target_array_index]] in multiview shaders.
		Useful for devices which don't support layered rendering. Only effective when --msl-multiview is enabled.
	[--msl-view-index-from-device-index]:
		Treat the view index as the device index instead.
		For multi-GPU rendering.
	[--msl-dispatch-base]:
		Add support for vkCmdDispatchBase() or similar APIs.
		Offsets the workgroup ID based on a buffer.
	[--msl-dynamic-buffer <set index> <binding>]:
		Marks a buffer as having dynamic offset.
		The offset is applied in the shader with pointer arithmetic.
		Useful for argument buffers where it is non-trivial to apply dynamic offset otherwise.
	[--msl-inline-uniform-block <set index> <binding>]:
		In argument buffers, mark an UBO as being an inline uniform block which is embedded into the argument buffer itself.
	[--msl-decoration-binding]:
		Use SPIR-V bindings directly as MSL bindings.
		This does not work in the general case as there is no descriptor set support, and combined image samplers are split up.
		However, if the shader author knows of binding limitations, this option will avoid the need for reflection on Metal side.
	[--msl-force-active-argument-buffer-resources]:
		Always emit resources which are part of argument buffers.
		This makes sure that similar shaders with same resource declarations can share the argument buffer as declaring an argument buffer implies an ABI.
	[--msl-force-native-arrays]:
		Rather than implementing array types as a templated value type ala std::array<T>, use plain, native arrays.
		This will lead to worse code-gen, but can work around driver bugs on certain driver revisions of certain Intel-based Macbooks where template arrays break.
	[--msl-disable-frag-depth-builtin]:
		Disables FragDepth output. Useful if pipeline does not enable depth, as pipeline creation might otherwise fail.
	[--msl-disable-frag-stencil-ref-builtin]:
		Disable FragStencilRef output. Useful if pipeline does not enable stencil output, as pipeline creation might otherwise fail.
	[--msl-enable-frag-output-mask <mask>]:
		Only selectively enable fragment outputs. Useful if pipeline does not enable fragment output for certain locations, as pipeline creation might otherwise fail.
	[--msl-no-clip-distance-user-varying]:
		Do not emit user varyings to emulate gl_ClipDistance in fragment shaders.
	[--msl-shader-input <index> <format> <size>]:
		Specify the format of the shader input at <index>.
		<format> can be 'any32', 'any16', 'u16', 'u8', or 'other', to indicate a 32-bit opaque value, 16-bit opaque value, 16-bit unsigned integer, 8-bit unsigned integer, or other-typed variable. <size> is the vector length of the variable, which must be greater than or equal to that declared in the shader.
		Useful if shader stage interfaces don't match up, as pipeline creation might otherwise fail.
	[--msl-multi-patch-workgroup]:
		Use the new style of tessellation control processing, where multiple patches are processed per workgroup.
		This should increase throughput by ensuring all the GPU's SIMD lanes are occupied, but it is not compatible with the old style.
		In addition, this style also passes input variables in buffers directly instead of using vertex attribute processing.
		In a future version of SPIRV-Cross, this will become the default.
	[--msl-vertex-for-tessellation]:
		When handling a vertex shader, marks it as one that will be used with a new-style tessellation control shader.
		The vertex shader is output to MSL as a compute kernel which outputs vertices to the buffer in the order they are received, rather than in index order as with --msl-capture-output normally.
	[--msl-additional-fixed-sample-mask <mask>]:
		Set an additional fixed sample mask. If the shader outputs a sample mask, then the final sample mask will be a bitwise AND of the two.
	[--msl-arrayed-subpass-input]:
		Assume that images of dimension SubpassData have multiple layers. Layered input attachments are accessed relative to BuiltInLayer.
		This option has no effect if multiview is also enabled.
	[--msl-r32ui-linear-texture-align <alignment>]:
		The required alignment of linear textures of format MTLPixelFormatR32Uint.
		This is used to align the row stride for atomic accesses to such images.
	[--msl-r32ui-linear-texture-align-constant-id <id>]:
		The function constant ID to use for the linear texture alignment.
		On MSL 1.2 or later, you can override the alignment by setting this function constant.
	[--msl-texture-1d-as-2d]:
		Emit Image variables of dimension Dim1D as texture2d.
		In Metal, 1D textures do not support all features that 2D textures do. Use this option if your code relies on these features.
	[--msl-ios-use-simdgroup-functions]:
		Use simd_*() functions for subgroup ops instead of quad_*().
		Recent Apple GPUs support SIMD-groups larger than a quad. Use this option to take advantage of this support.
	[--msl-emulate-subgroups]:
		Assume subgroups of size 1.
		Intended for Vulkan Portability implementations where Metal support for SIMD-groups is insufficient for true subgroups.
	[--msl-fixed-subgroup-size <size>]:
		Assign a constant <size> to the SubgroupSize builtin.
		Intended for Vulkan Portability implementations where VK_EXT_subgroup_size_control is not supported or disabled.
		If 0, assume variable subgroup size as actually exposed by Metal.
	[--msl-force-sample-rate-shading]:
		Force fragment shaders to run per sample.
		This adds a [[sample_id]] parameter if none is already present.

HLSL options:
	[--shader-model]:
		Enables a specific shader model, e.g. --shader-model 50 for SM 5.0.
	[--hlsl-enable-compat]:
		Allow point size and point coord to be used, even if they won't work as expected.
		PointSize is ignored, and PointCoord returns (0.5, 0.5).
	[--hlsl-support-nonzero-basevertex-baseinstance]:
		Support base vertex and base instance by emitting a special cbuffer declared as:
		cbuffer SPIRV_Cross_VertexInfo { int SPIRV_Cross_BaseVertex; int SPIRV_Cross_BaseInstance; };
	[--hlsl-auto-binding (push, cbv, srv, uav, sampler, all)]
		Do not emit any : register(#) bindings for specific resource types, and rely on HLSL compiler to assign something.
	[--hlsl-force-storage-buffer-as-uav]:
		Always emit SSBOs as UAVs, even when marked as read-only.
		Normally, SSBOs marked with NonWritable will be emitted as SRVs.
	[--hlsl-nonwritable-uav-texture-as-srv]:
		Emit NonWritable storage images as SRV textures instead of UAV.
		Using this option messes with the type system. SPIRV-Cross cannot guarantee that this will work.
		One major problem area with this feature is function arguments, where we won't know if we're seeing a UAV or SRV.
		Shader must ensure that read/write state is consistent at all call sites.
	[--set-hlsl-vertex-input-semantic <location> <semantic>]:
		Emits a specific vertex input semantic for a given location.
		Otherwise, TEXCOORD# is used as semantics, where # is location.
	[--hlsl-enable-16bit-types]:
		Enables native use of half/int16_t/uint16_t and ByteAddressBuffer interaction with these types. Requires SM 6.2.
	[--hlsl-flatten-matrix-vertex-input-semantics]:
		Emits matrix vertex inputs with input semantics as if they were independent vectors, e.g. TEXCOORD{2,3,4} rather than matrix form TEXCOORD2_{0,1,2}.

Obscure options:
	These options are not meant to be used on a regular basis. They have some occasional uses in the test suite.
	[--force-temporary]:
		Aggressively emit temporary expressions instead of forwarding expressions. Very rarely used and under-tested.
	[--revision]:
		Prints build timestamp and Git commit information (updated when cmake is configured).
	[--iterations iter]:
		Recompiles the same shader over and over, benchmarking related.
	[--disable-storage-image-qualifier-deduction]:
		If storage images are received without any nonwritable or nonreadable information,
		do not attempt to analyze usage, and always emit read/write state.
	[--flatten-multidimensional-arrays]:
		Do not support multi-dimensional arrays and flatten them to one dimension.
	[--cpp-interface-name <name>]:
		Emit a specific class name in C++ codegen.
```