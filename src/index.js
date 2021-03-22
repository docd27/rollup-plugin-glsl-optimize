import {createFilter} from '@rollup/pluginutils';
import { glslProcessSource } from './lib/glslProcess.js';
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

const extsInclude = Object.values(stageDefs).flatMap(
  (exts) => exts.map((ext) => `**/*${ext}`));

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
 * @property {PathFilter} [include]
 *   File extensions within rollup to include.
 * @property {PathFilter} [exclude]
 *   File extensions within rollup to exclude.
 * @typedef {GLSLPluginGlobalOptions & Partial<import('./lib/glslProcess').GLSLToolOptions>} GLSLPluginOptions
 */
/**
 * @param {Partial<GLSLPluginOptions>} userOptions
 * @return {import('rollup').Plugin}
 */
export default function glslOptimize(userOptions = {}) {
  /** @type {GLSLPluginOptions} */
  const options = {
    include: extsInclude,
    ...userOptions,
  };

  const filter = createFilter(options.include, options.exclude);

  return {
    name: 'glsl-optimize',

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
        return;
      }

      try {
        const result = await glslProcessSource(id, source, stage, options);
        result.code = generateCode(result.code);
        return result;
      } catch (err) {
        this.error({ message: `Error processing GLSL source:\n${err.message}` });
        return;
      }
    },
  };
}

