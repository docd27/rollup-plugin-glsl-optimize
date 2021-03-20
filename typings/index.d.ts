/// <reference types="node" />
import * as rollup from 'rollup';

type GLSLToolPathConfig = {
    glslangValidatorPath?: string;
    glslangOptimizerPath?: string;
    glslangCrossPath?: string;
};

type GLSLStageName$1 = 'vert' | 'tesc' | 'tese' | 'geom' | 'frag' | 'comp';
type GLSLToolSharedOptions = {
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
type GLSLToolOptions = GLSLToolSharedOptions & GLSLToolPathConfig;

/**
 * @typedef {Array<string | RegExp> | string | RegExp | null} PathFilter
 * @typedef {Object} GLSLPluginGlobalOptions
 * @property {PathFilter} [include]
 *   File extensions within rollup to include.
 * @property {PathFilter} [exclude]
 *   File extensions within rollup to exclude.
 * @property {boolean} [sourceMap]
 *   Emit source maps
 * @typedef {GLSLPluginGlobalOptions & Partial<import('./lib/glslProcess').GLSLToolOptions>} GLSLPluginOptions
 */
/**
 * @param {Partial<GLSLPluginOptions>} userOptions
 * @return {import('rollup').Plugin}
 */
declare function glslOptimize(userOptions?: Partial<GLSLPluginOptions>): rollup.Plugin;
type PathFilter = Array<string | RegExp> | string | RegExp | null;
type GLSLPluginGlobalOptions = {
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
type GLSLPluginOptions = GLSLPluginGlobalOptions & Partial<GLSLToolOptions>;
type GLSLStageName = GLSLStageName$1;
type GLSLStageDefs = {
    vert: string[];
    tesc: string[];
    tese: string[];
    geom: string[];
    frag: string[];
    comp: string[];
};

export default glslOptimize;
export { GLSLPluginGlobalOptions, GLSLPluginOptions, GLSLStageDefs, GLSLStageName, PathFilter };
