import {createFilter} from '@rollup/pluginutils';
import { glslProcessSource } from './lib/glslProcess.js';
import {dirname} from 'path';
import * as fsSync from 'fs';

/**
 * @typedef {import('./lib/glslProcess').GLSLStageName} GLSLStageName
 * @typedef {{[P in GLSLStageName]: string[]}} GLSLStageDefs */
/** @type {GLSLStageDefs} */
const stageDefs = {
  'vert': [ '.vs', '.vert', '.vs.glsl', '.vert.glsl' ],
  'frag': [ '.fs', '.frag', '.fs.glsl', '.frag.glsl' ],
  // The following are untested:
  'geom': [ '.geom', '.geom.glsl' ],
  'comp': [ '.comp', '.comp.glsl' ],
  'tesc': [ '.tesc', '.tesc.glsl' ],
  'tese': [ '.tese', '.tese.glsl' ],
};

const extsIncludeDefault = [...Object.values(stageDefs).flatMap(
  (exts) => exts.map((ext) => `**/*${ext}`)),
  '**/*.glsl',
  // Additionally include all *.glsl by default so we throw an error
  // if the user includes a file extension without a stage
];

/** @type {[GLSLStageName, RegExp][]} */
const stageRegexes = (
  /** @type {[GLSLStageName, string[]][]} */(Object.entries(stageDefs))
  .map(([st, exts]) => [st,
    new RegExp(`(?:${exts.map(ext => ext.replace('.', '\\.')).join('|')})$`, 'i')
  ]));

function generateCode(source) {
  return `export default ${JSON.stringify(source)}; // eslint-disable-line`;
}

/**
 * @typedef {Array<string | RegExp> | string | RegExp | null} PathFilter
 * @typedef {Object} GLSLPluginGlobalOptions
 * @property {PathFilter} include
 *   File extensions within rollup to include.
 * @property {PathFilter} exclude
 *   File extensions within rollup to exclude.
 * @property {boolean} glslify
 *   Process sources using glslify prior to all preprocessing, validation and optimization.
 * @property {Partial<GlslifyOptions>} glslifyOptions
 *   When glslify enabled, pass these additional options to glslify.compile()
 * @typedef {GLSLPluginGlobalOptions & Partial<import('./lib/glslProcess').GLSLToolOptions>} GLSLPluginOptions
 */
/**
 * @typedef {Object} GlslifyBaseOptions
 * @property {string} basedir
 * @typedef {{[key: string]: any} & GlslifyBaseOptions} GlslifyOptions
 */
/**
 * @param {Partial<GLSLPluginOptions>} userOptions
 * @return {import('rollup').Plugin}
 */
export default function glslOptimize(userOptions = {}) {
  /** @type {GLSLPluginOptions} */
  const pluginOptions = {
    include: extsIncludeDefault,
    exclude: [],
    glslify: false,
    glslifyOptions: {},
    ...userOptions,
  };

  const filter = createFilter(pluginOptions.include, pluginOptions.exclude);

  /** @type {{(src:string, opts:GlslifyOptions):string}} */
  let glslifyCompile;

  return {
    name: 'glsl-optimize',

    async options(options) {
      if (pluginOptions.glslify) { // Try to dynamically load glslify if installed
        try {
          // @ts-ignore
          const glslify = await import('glslify');
          if (glslify && glslify.compile && typeof glslify.compile === 'function') {
            glslifyCompile = glslify.compile;
          }
        } catch {}
      }
      return options;
    },

    async load(id) {
      if (!id || !filter(id)) return;

      /*
        We use a load hook instead of transform because we want sourcemaps
        to reflect the optimized shader source.
      */
      if (!fsSync.existsSync(id)) return;
      let source;
      try {
        source = fsSync.readFileSync(id, {encoding: 'utf8'});
      } catch (err) {
        this.warn(`Failed to load file '${id}' : ${err.message}`);
        return;
      }

      /** @type {GLSLStageName} */
      const stage = stageRegexes.find(([, regex]) => id.match(regex))?.[0];
      if (!stage) {
        this.error({ message: `File '${id}' : extension did not match a shader stage.` });
      }

      if (pluginOptions.glslify) {
        if (!glslifyCompile) {
          this.error({ message: `glslify could not be found. Install it with npm i -D glslify`});
        }
        /** @type {GlslifyOptions} */
        const glslifyOptions = {
          basedir: dirname(id),
          ...pluginOptions.glslifyOptions,
        }
        try {
          source = glslifyCompile(source, glslifyOptions);
        } catch (err) {
          this.error({ message: `Error processing GLSL source with glslify:\n${err.message}` });
        }
      }

      try {
        const result = await glslProcessSource(id, source, stage, pluginOptions);
        result.code = generateCode(result.code);
        return result;
      } catch (err) {
        this.error({ message: `Error processing GLSL source:\n${err.message}` });
      }
    },
  };
}

