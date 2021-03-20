# glslangValidator

```
Usage: glslangValidator [option]... [file]...

'file' can end in .<stage> for auto-stage classification, where <stage> is:
    .conf   to provide a config file that replaces the default configuration
            (see -c option below for generating a template)
    .vert   for a vertex shader
    .tesc   for a tessellation control shader
    .tese   for a tessellation evaluation shader
    .geom   for a geometry shader
    .frag   for a fragment shader
    .comp   for a compute shader
    .mesh   for a mesh shader
    .task   for a task shader
    .rgen    for a ray generation shader
    .rint    for a ray intersection shader
    .rahit   for a ray any hit shader
    .rchit   for a ray closest hit shader
    .rmiss   for a ray miss shader
    .rcall   for a ray callable shader
    .glsl   for .vert.glsl, .tesc.glsl, ..., .comp.glsl compound suffixes
    .hlsl   for .vert.hlsl, .tesc.hlsl, ..., .comp.hlsl compound suffixes

Options:
  -C          cascading errors; risk crash from accumulation of error recoveries
  -D          input is HLSL (this is the default when any suffix is .hlsl)
  -D<name[=def]> | --define-macro <name[=def]> | --D <name[=def]>
              define a pre-processor macro
  -E          print pre-processed GLSL; cannot be used with -l;
              errors will appear on stderr
  -G[ver]     create SPIR-V binary, under OpenGL semantics; turns on -l;
              default file name is <stage>.spv (-o overrides this);
              'ver', when present, is the version of the input semantics,
              which will appear in #define GL_SPIRV ver;
              '--client opengl100' is the same as -G100;
              a '--target-env' for OpenGL will also imply '-G';
              currently only supports GLSL
  -H          print human readable form of SPIR-V; turns on -V
  -I<dir>     add dir to the include search path; includer's directory
              is searched first, followed by left-to-right order of -I
  -Od         disables optimization; may cause illegal SPIR-V for HLSL
  -Os         optimizes SPIR-V to minimize size
  -S <stage>  uses specified stage rather than parsing the file extension
              choices for <stage> are vert, tesc, tese, geom, frag, or comp
  -U<name> | --undef-macro <name> | --U <name>
              undefine a pre-processor macro
  -V[ver]     create SPIR-V binary, under Vulkan semantics; turns on -l;
              default file name is <stage>.spv (-o overrides this)
              'ver', when present, is the version of the input semantics,
              which will appear in #define VULKAN ver
              '--client vulkan100' is the same as -V100
              a '--target-env' for Vulkan will also imply '-V'
  -c          configuration dump;
              creates the default configuration file (redirect to a .conf file)
  -d          default to desktop (#version 110) when there is no shader #version
              (default is ES version 100)
  -e <name> | --entry-point <name>
              specify <name> as the entry-point function name
  -f{hlsl_functionality1}
              'hlsl_functionality1' enables use of the
              SPV_GOOGLE_hlsl_functionality1 extension
  -g          generate debug information
  -g0         strip debug information
  -h          print this usage message
  -i          intermediate tree (glslang AST) is printed out
  -l          link all input files together to form a single module
  -m          memory leak mode
  -o <file>   save binary to <file>, requires a binary option (e.g., -V)
  -q          dump reflection query database; requires -l for linking
  -r | --relaxed-errors              relaxed GLSL semantic error-checking mode
  -s          silence syntax and semantic error reporting
  -t          multi-threaded mode
  -v | --version
              print version strings
  -w | --suppress-warnings
              suppress GLSL warnings, except as required by "#extension : warn"
  -x          save binary output as text-based 32-bit hexadecimal numbers
  -u<name>:<loc> specify a uniform location override for --aml
  --uniform-base <base> set a base to use for generated uniform locations
  --auto-map-bindings | --amb       automatically bind uniform variables
                                    without explicit bindings
  --auto-map-locations | --aml      automatically locate input/output lacking
                                    'location' (fragile, not cross stage)
  --client {vulkan<ver>|opengl<ver>} see -V and -G
  --dump-builtin-symbols            prints builtin symbol table prior each compile
  -dumpfullversion | -dumpversion   print bare major.minor.patchlevel
  --flatten-uniform-arrays | --fua  flatten uniform texture/sampler arrays to
                                    scalars
  --hlsl-offsets                    allow block offsets to follow HLSL rules
                                    works independently of source language
  --hlsl-iomap                      perform IO mapping in HLSL register space
  --hlsl-enable-16bit-types         allow 16-bit types in SPIR-V for HLSL
  --hlsl-dx9-compatible             interprets sampler declarations as a
                                    texture/sampler combo like DirectX9 would,
                                    and recognizes DirectX9-specific semantics
  --invert-y | --iy                 invert position.Y output in vertex shader
  --keep-uncalled | --ku            don't eliminate uncalled functions
  --nan-clamp                       favor non-NaN operand in min, max, and clamp
  --no-storage-format | --nsf       use Unknown image format
  --quiet                           do not print anything to stdout, unless
                                    requested by another option
  --reflect-strict-array-suffix     use strict array suffix rules when
                                    reflecting
  --reflect-basic-array-suffix      arrays of basic types will have trailing [0]
  --reflect-intermediate-io         reflection includes inputs/outputs of linked
                                    shaders rather than just vertex/fragment
  --reflect-separate-buffers        reflect buffer variables and blocks
                                    separately to uniforms
  --reflect-all-block-variables     reflect all variables in blocks, whether
                                    inactive or active
  --reflect-unwrap-io-blocks        unwrap input/output blocks the same as
                                    uniform blocks
  --resource-set-binding [stage] name set binding
                                    set descriptor set and binding for
                                    individual resources
  --resource-set-binding [stage] set
                                    set descriptor set for all resources
  --rsb                             synonym for --resource-set-binding
  --shift-image-binding [stage] num
                                    base binding number for images (uav)
  --shift-image-binding [stage] [num set]...
                                    per-descriptor-set shift values
  --sib                             synonym for --shift-image-binding
  --shift-sampler-binding [stage] num
                                    base binding number for samplers
  --shift-sampler-binding [stage] [num set]...
                                    per-descriptor-set shift values
  --ssb                             synonym for --shift-sampler-binding
  --shift-ssbo-binding [stage] num  base binding number for SSBOs
  --shift-ssbo-binding [stage] [num set]...
                                    per-descriptor-set shift values
  --sbb                             synonym for --shift-ssbo-binding
  --shift-texture-binding [stage] num
                                    base binding number for textures
  --shift-texture-binding [stage] [num set]...
                                    per-descriptor-set shift values
  --stb                             synonym for --shift-texture-binding
  --shift-uav-binding [stage] num   base binding number for UAVs
  --shift-uav-binding [stage] [num set]...
                                    per-descriptor-set shift values
  --suavb                           synonym for --shift-uav-binding
  --shift-UBO-binding [stage] num   base binding number for UBOs
  --shift-UBO-binding [stage] [num set]...
                                    per-descriptor-set shift values
  --sub                             synonym for --shift-UBO-binding
  --shift-cbuffer-binding | --scb   synonyms for --shift-UBO-binding
  --spirv-dis                       output standard-form disassembly; works only
                                    when a SPIR-V generation option is also used
  --spirv-val                       execute the SPIRV-Tools validator
  --source-entrypoint <name>        the given shader source function is
                                    renamed to be the <name> given in -e
  --sep                             synonym for --source-entrypoint
  --stdin                           read from stdin instead of from a file;
                                    requires providing the shader stage using -S
  --target-env {vulkan1.0 | vulkan1.1 | vulkan1.2 | opengl |
                spirv1.0 | spirv1.1 | spirv1.2 | spirv1.3 | spirv1.4 | spirv1.5}
                                    Set the execution environment that the
                                    generated code will be executed in.
                                    Defaults to:
                                     * vulkan1.0 under --client vulkan<ver>
                                     * opengl    under --client opengl<ver>
                                     * spirv1.0  under --target-env vulkan1.0
                                     * spirv1.3  under --target-env vulkan1.1
                                     * spirv1.5  under --target-env vulkan1.2
                                    Multiple --target-env can be specified.
  --variable-name <name>
  --vn <name>                       creates a C header file that contains a
                                    uint32_t array named <name>
                                    initialized with the shader binary code
```