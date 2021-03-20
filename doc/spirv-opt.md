# SPIR-V Tools Optimizer

```
Optimize a SPIR-V binary file.

USAGE: spirv-opt [options] [<input>] -o <output>

The SPIR-V binary is read from <input>. If no file is specified,
or if <input> is "-", then the binary is read from standard input.
if <output> is "-", then the optimized output is written to
standard output.

NOTE: The optimizer is a work in progress.

Options (in lexicographical order):
  --amd-ext-to-khr
               Replaces the extensions VK_AMD_shader_ballot, VK_AMD_gcn_shader,
               and VK_AMD_shader_trinary_minmax with equivalent code using core
               instructions and capabilities.
  --before-hlsl-legalization
               Forwards this option to the validator.  See the validator help
               for details.
  --ccp
               Apply the conditional constant propagation transform.  This will
               propagate constant values throughout the program, and simplify
               expressions and conditional jumps with known predicate
               values.  Performed on entry point call tree functions and
               exported functions.
  --cfg-cleanup
               Cleanup the control flow graph. This will remove any unnecessary
               code from the CFG like unreachable code. Performed on entry
               point call tree functions and exported functions.
  --combine-access-chains
               Combines chained access chains to produce a single instruction
               where possible.
  --compact-ids
               Remap result ids to a compact range starting from %1 and without
               any gaps.
  --convert-local-access-chains
               Convert constant index access chain loads/stores into
               equivalent load/stores with inserts and extracts. Performed
               on function scope variables referenced only with load, store,
               and constant index access chains in entry point call tree
               functions.
  --convert-relaxed-to-half
               Convert all RelaxedPrecision arithmetic operations to half
               precision, inserting conversion operations where needed.
               Run after function scope variable load and store elimination
               for better results. Simplify-instructions, redundancy-elimination
               and DCE should be run after this pass to eliminate excess
               conversions. This conversion is useful when the target platform
               does not support RelaxedPrecision or ignores it. This pass also
               removes all RelaxedPrecision decorations.
  --copy-propagate-arrays
               Does propagation of memory references when an array is a copy of
               another.  It will only propagate an array if the source is never
               written to, and the only store to the target is the copy.
  --decompose-initialized-variables
               Decomposes initialized variable declarations into a declaration
               followed by a store of the initial value. This is done to work
               around known issues with some Vulkan drivers for initialize
               variables.
  --descriptor-scalar-replacement
               Replaces every array variable |desc| that has a DescriptorSet
               and Binding decorations with a new variable for each element of
               the array.  Suppose |desc| was bound at binding |b|.  Then the
               variable corresponding to |desc[i]| will have binding |b+i|.
               The descriptor set will be the same.  All accesses to |desc|
               must be in OpAccessChain instructions with a literal index for
               the first index.
  --eliminate-dead-branches
               Convert conditional branches with constant condition to the
               indicated unconditional branch. Delete all resulting dead
               code. Performed only on entry point call tree functions.
  --eliminate-dead-code-aggressive
               Delete instructions which do not contribute to a function's
               output. Performed only on entry point call tree functions.
  --eliminate-dead-const
               Eliminate dead constants.
  --eliminate-dead-functions
               Deletes functions that cannot be reached from entry points or
               exported functions.
  --eliminate-dead-inserts
               Deletes unreferenced inserts into composites, most notably
               unused stores to vector components, that are not removed by
               aggressive dead code elimination.
  --eliminate-dead-variables
               Deletes module scope variables that are not referenced.
  --eliminate-insert-extract
               DEPRECATED.  This pass has been replaced by the simplification
               pass, and that pass will be run instead.
               See --simplify-instructions.
  --eliminate-local-multi-store
               Replace stores and loads of function scope variables that are
               stored multiple times. Performed on variables referenceed only
               with loads and stores. Performed only on entry point call tree
               functions.
  --eliminate-local-single-block
               Perform single-block store/load and load/load elimination.
               Performed only on function scope variables in entry point
               call tree functions.
  --eliminate-local-single-store
               Replace stores and loads of function scope variables that are
               only stored once. Performed on variables referenceed only with
               loads and stores. Performed only on entry point call tree
               functions.
  --flatten-decorations
               Replace decoration groups with repeated OpDecorate and
               OpMemberDecorate instructions.
  --fold-spec-const-op-composite
               Fold the spec constants defined by OpSpecConstantOp or
               OpSpecConstantComposite instructions to front-end constants
               when possible.
  --freeze-spec-const
               Freeze the values of specialization constants to their default
               values.
  --graphics-robust-access
               Clamp indices used to access buffers and internal composite
               values, providing guarantees that satisfy Vulkan's
               robustBufferAccess rules.
  --if-conversion
               Convert if-then-else like assignments into OpSelect.
  --inline-entry-points-exhaustive
               Exhaustively inline all function calls in entry point call tree
               functions. Currently does not inline calls to functions with
               early return in a loop.
  --legalize-hlsl
               Runs a series of optimizations that attempts to take SPIR-V
               generated by an HLSL front-end and generates legal Vulkan SPIR-V.
               The optimizations are:

		wrap-opkill
		eliminate-dead-branches
		merge-return
		inline-entry-points-exhaustive
		eliminate-dead-functions
		private-to-local
		fix-storage-class
		eliminate-local-single-block
		eliminate-local-single-store
		eliminate-dead-code-aggressive
		scalar-replacement=0
		eliminate-local-single-block
		eliminate-local-single-store
		eliminate-dead-code-aggressive
		ssa-rewrite
		eliminate-dead-code-aggressive
		ccp
		loop-unroll
		eliminate-dead-branches
		simplify-instructions
		eliminate-dead-code-aggressive
		copy-propagate-arrays
		vector-dce
		eliminate-dead-inserts
		reduce-load-size
		eliminate-dead-code-aggressive

               Note this does not guarantee legal code. This option passes the
               option --relax-logical-pointer to the validator.
  --local-redundancy-elimination
               Looks for instructions in the same basic block that compute the
               same value, and deletes the redundant ones.
  --loop-fission
               Splits any top level loops in which the register pressure has
               exceeded a given threshold. The threshold must follow the use of
               this flag and must be a positive integer value.
  --loop-fusion
               Identifies adjacent loops with the same lower and upper bound.
               If this is legal, then merge the loops into a single loop.
               Includes heuristics to ensure it does not increase number of
               registers too much, while reducing the number of loads from
               memory. Takes an additional positive integer argument to set
               the maximum number of registers.
  --loop-invariant-code-motion
               Identifies code in loops that has the same value for every
               iteration of the loop, and move it to the loop pre-header.
  --loop-unroll
               Fully unrolls loops marked with the Unroll flag
  --loop-unroll-partial
               Partially unrolls loops marked with the Unroll flag. Takes an
               additional non-0 integer argument to set the unroll factor, or
               how many times a loop body should be duplicated
  --loop-peeling
               Execute few first (respectively last) iterations before
               (respectively after) the loop if it can elide some branches.
  --loop-peeling-threshold
               Takes a non-0 integer argument to set the loop peeling code size
               growth threshold. The threshold prevents the loop peeling
               from happening if the code size increase created by
               the optimization is above the threshold.
  --max-id-bound=<n>
               Sets the maximum value for the id bound for the module.  The
               default is the minimum value for this limit, 0x3FFFFF.  See
               section 2.17 of the Spir-V specification.
  --merge-blocks
               Join two blocks into a single block if the second has the
               first as its only predecessor. Performed only on entry point
               call tree functions.
  --merge-return
               Changes functions that have multiple return statements so they
               have a single return statement.

               For structured control flow it is assumed that the only
               unreachable blocks in the function are trivial merge and continue
               blocks.

               A trivial merge block contains the label and an OpUnreachable
               instructions, nothing else.  A trivial continue block contain a
               label and an OpBranch to the header, nothing else.

               These conditions are guaranteed to be met after running
               dead-branch elimination.
  --loop-unswitch
               Hoists loop-invariant conditionals out of loops by duplicating
               the loop on each branch of the conditional and adjusting each
               copy of the loop.
  -O
               Optimize for performance. Apply a sequence of transformations
               in an attempt to improve the performance of the generated
               code. For this version of the optimizer, this flag is equivalent
               to specifying the following optimization code names:

		wrap-opkill
		eliminate-dead-branches
		merge-return
		inline-entry-points-exhaustive
		eliminate-dead-functions
		eliminate-dead-code-aggressive
		private-to-local
		eliminate-local-single-block
		eliminate-local-single-store
		eliminate-dead-code-aggressive
		scalar-replacement=100
		convert-local-access-chains
		eliminate-local-single-block
		eliminate-local-single-store
		eliminate-dead-code-aggressive
		ssa-rewrite
		eliminate-dead-code-aggressive
		ccp
		eliminate-dead-code-aggressive
		loop-unroll
		eliminate-dead-branches
		redundancy-elimination
		combine-access-chains
		simplify-instructions
		scalar-replacement=100
		convert-local-access-chains
		eliminate-local-single-block
		eliminate-local-single-store
		eliminate-dead-code-aggressive
		ssa-rewrite
		eliminate-dead-code-aggressive
		vector-dce
		eliminate-dead-inserts
		eliminate-dead-branches
		simplify-instructions
		if-conversion
		copy-propagate-arrays
		reduce-load-size
		eliminate-dead-code-aggressive
		merge-blocks
		redundancy-elimination
		eliminate-dead-branches
		merge-blocks
		simplify-instructions
  -Os
               Optimize for size. Apply a sequence of transformations in an
               attempt to minimize the size of the generated code. For this
               version of the optimizer, this flag is equivalent to specifying
               the following optimization code names:

		wrap-opkill
		eliminate-dead-branches
		merge-return
		inline-entry-points-exhaustive
		eliminate-dead-functions
		private-to-local
		scalar-replacement=0
		ssa-rewrite
		ccp
		loop-unroll
		eliminate-dead-branches
		simplify-instructions
		scalar-replacement=0
		eliminate-local-single-store
		if-conversion
		simplify-instructions
		eliminate-dead-code-aggressive
		eliminate-dead-branches
		merge-blocks
		convert-local-access-chains
		eliminate-local-single-block
		eliminate-dead-code-aggressive
		copy-propagate-arrays
		vector-dce
		eliminate-dead-inserts
		eliminate-dead-members
		eliminate-local-single-store
		merge-blocks
		ssa-rewrite
		redundancy-elimination
		simplify-instructions
		eliminate-dead-code-aggressive
		cfg-cleanup

               NOTE: The specific transformations done by -O and -Os change
                     from release to release.
  -Oconfig=<file>
               Apply the sequence of transformations indicated in <file>.
               This file contains a sequence of strings separated by whitespace
               (tabs, newlines or blanks). Each string is one of the flags
               accepted by spirv-opt. Optimizations will be applied in the
               sequence they appear in the file. This is equivalent to
               specifying all the flags on the command line. For example,
               given the file opts.cfg with the content:

                --inline-entry-points-exhaustive
                --eliminate-dead-code-aggressive

               The following two invocations to spirv-opt are equivalent:

               $ spirv-opt -Oconfig=opts.cfg program.spv

               $ spirv-opt --inline-entry-points-exhaustive \
                    --eliminate-dead-code-aggressive program.spv

               Lines starting with the character '#' in the configuration
               file indicate a comment and will be ignored.

               The -O, -Os, and -Oconfig flags act as macros. Using one of them
               is equivalent to explicitly inserting the underlying flags at
               that position in the command line. For example, the invocation
               'spirv-opt --merge-blocks -O ...' applies the transformation
               --merge-blocks followed by all the transformations implied by
               -O.
  --preserve-bindings
               Ensure that the optimizer preserves all bindings declared within
               the module, even when those bindings are unused.
  --preserve-spec-constants
               Ensure that the optimizer preserves all specialization constants declared
               within the module, even when those constants are unused.
  --print-all
               Print SPIR-V assembly to standard error output before each pass
               and after the last pass.
  --private-to-local
               Change the scope of private variables that are used in a single
               function to that function.
  --reduce-load-size
               Replaces loads of composite objects where not every component is
               used by loads of just the elements that are used.
  --redundancy-elimination
               Looks for instructions in the same function that compute the
               same value, and deletes the redundant ones.
  --relax-block-layout
               Forwards this option to the validator.  See the validator help
               for details.
  --relax-float-ops
               Decorate all float operations with RelaxedPrecision if not already
               so decorated. This does not decorate types or variables.
  --relax-logical-pointer
               Forwards this option to the validator.  See the validator help
               for details.
  --relax-struct-store
               Forwards this option to the validator.  See the validator help
               for details.
  --remove-duplicates
               Removes duplicate types, decorations, capabilities and extension
               instructions.
  --replace-invalid-opcode
               Replaces instructions whose opcode is valid for shader modules,
               but not for the current shader stage.  To have an effect, all
               entry points must have the same execution model.
  --ssa-rewrite
               Replace loads and stores to function local variables with
               operations on SSA IDs.
  --scalar-block-layout
               Forwards this option to the validator.  See the validator help
               for details.
  --scalar-replacement[=<n>]
               Replace aggregate function scope variables that are only accessed
               via their elements with new function variables representing each
               element.  <n> is a limit on the size of the aggregates that will
               be replaced.  0 means there is no limit.  The default value is
               100.
  --set-spec-const-default-value "<spec id>:<default value> ..."
               Set the default values of the specialization constants with
               <spec id>:<default value> pairs specified in a double-quoted
               string. <spec id>:<default value> pairs must be separated by
               blank spaces, and in each pair, spec id and default value must
               be separated with colon ':' without any blank spaces in between.
               e.g.: --set-spec-const-default-value "1:100 2:400"
  --simplify-instructions
               Will simplify all instructions in the function as much as
               possible.
  --skip-block-layout
               Forwards this option to the validator.  See the validator help
               for details.
  --skip-validation
               Will not validate the SPIR-V before optimizing.  If the SPIR-V
               is invalid, the optimizer may fail or generate incorrect code.
               This options should be used rarely, and with caution.
  --strength-reduction
               Replaces instructions with equivalent and less expensive ones.
  --strip-atomic-counter-memory
               Removes AtomicCountMemory bit from memory semantics values.
  --strip-debug
               Remove all debug instructions.
  --strip-reflect
               Remove all reflection information.  For now, this covers
               reflection information defined by SPV_GOOGLE_hlsl_functionality1
               and SPV_KHR_non_semantic_info
  --target-env=<env>
               Set the target environment. Without this flag the target
               environment defaults to spv1.5. <env> must be one of
               {vulkan1.1spv1.4|vulkan1.0|vulkan1.1|vulkan1.2|spv1.0|spv1.1
                |spv1.2|spv1.3|spv1.4|spv1.5|opencl1.2embedded|opencl1.2
                |opencl2.0embedded|opencl2.0|opencl2.1embedded|opencl2.1
                |opencl2.2embedded|opencl2.2|opengl4.0|opengl4.1|opengl4.2
                |opengl4.3|opengl4.5}
  --time-report
               Print the resource utilization of each pass (e.g., CPU time,
               RSS) to standard error output. Currently it supports only Unix
               systems. This option is the same as -ftime-report in GCC. It
               prints CPU/WALL/USR/SYS time (and RSS if possible), but note that
               USR/SYS time are returned by getrusage() and can have a small
               error.
  --upgrade-memory-model
               Upgrades the Logical GLSL450 memory model to Logical VulkanKHR.
               Transforms memory, image, atomic and barrier operations to conform
               to that model's requirements.
  --vector-dce
               This pass looks for components of vectors that are unused, and
               removes them from the vector.  Note this would still leave around
               lots of dead code that a pass of ADCE will be able to remove.
  --workaround-1209
               Rewrites instructions for which there are known driver bugs to
               avoid triggering those bugs.
               Current workarounds: Avoid OpUnreachable in loops.
  --workgroup-scalar-block-layout
               Forwards this option to the validator.  See the validator help
               for details.
  --wrap-opkill
               Replaces all OpKill instructions in functions that can be called
               from a continue construct with a function call to a function
               whose only instruction is an OpKill.  This is done to enable
               inlining on these functions.

  --unify-const
               Remove the duplicated constants.
  --validate-after-all
               Validate the module after each pass is performed.
  -h, --help
               Print this help.
  --version
               Display optimizer version information.
```