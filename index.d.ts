
export type GLSLToolPathConfig = {
  glslangValidatorPath?: string;
  glslangOptimizerPath?: string;
  glslangCrossPath?: string;
};

export type GLSLToolSharedOptions = {
  /**
   * Strip whitespace
   */
  compress: boolean;
  /**
   * true: Preprocess and Compile GLSL to SPIR-V, optimize, then cross-compile to GLSL
   * false: Preprocess (and Validate) GLSL only
   */
  optimize: boolean;
  /**
   * Emit #line directives. Useful for debugging #include. Note these may cause problems with certain drivers.
   */
  emitLineDirectives: boolean;
  /**
   * When emitLineDirectives enabled, suppress the GL_GOOGLE_cpp_style_line_directive extension directive
   */
  suppressLineExtensionDirective: boolean;
  /**
   * Ensure that the optimizer preserves all declared bindings, even when those bindings are unused.
   */
  optimizerPreserveUnusedBindings: boolean;
  /**
   * Debugging: skip the SPIR-V optimizer (compiles then cross-compiles directly)
   */
  optimizerDebugSkipOptimizer: boolean;
  /**
   * Prepend to the shader (after the #version directive)
   */
  preamble: string;
  /**
   * Additional search paths for #include directive (source file directory is always searched)
   */
  includePaths: string[];
  extraValidatorParams: string[];
  extraOptimizerParams: string[];
  extraCrossParams: string[];
};
export type GLSLToolOptions = GLSLToolSharedOptions & GLSLToolPathConfig;
export type PathFilter = Array<string | RegExp> | string | RegExp | null;
export type GLSLPluginGlobalOptions = {
    /**
     * File extensions within rollup to include.
     */
    include?: PathFilter;
    /**
     * File extensions within rollup to exclude.
     */
    exclude?: PathFilter;
    /**
     * Emit source maps
     */
    sourceMap?: boolean;
};
export type GLSLPluginOptions = GLSLPluginGlobalOptions & Partial<GLSLToolOptions>;
export type GLSLStageName = 'vert' | 'tesc' | 'tese' | 'geom' | 'frag' | 'comp';
export type GLSLStageDefs = {
    vert: string[];
    tesc: string[];
    tese: string[];
    geom: string[];
    frag: string[];
    comp: string[];
};

export default function glslOptimize(userOptions?: Partial<GLSLPluginOptions>): import('rollup').Plugin;

