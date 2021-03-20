import {createFilter} from '@rollup/pluginutils';
import MagicString from 'magic-string';
import { glslProcessSource } from './lib/glslProcess.js';

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
const stageRegexes = new Map(
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
 * @property {boolean} [sourceMap]
 *   Emit source maps
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
    sourceMap: true,
    ...userOptions,
  };

  const filter = createFilter(options.include, options.exclude);

  return {
    name: 'glsl-optimize',

    async transform(code, id) {
      if (!id || !filter(id)) return;

      /** @type {GLSLStageName} */
      let stage;
      for (const [checkStage, regex] of stageRegexes) {
        if (id.match(regex)) {
          stage = checkStage;
          break;
        }
      }
      if (!stage) {
        this.error({ message: `File '${id}' : extension did not match a shader stage.` });
        return;
      }
      try {
        code = await glslProcessSource(id, code, stage, options);
      } catch (err) {
        this.error({ message: `Error processing GLSL source:\n${err.message}` });
        return;
      }

      code = generateCode(code);

      if (options.sourceMap !== false) {
        const magicString = new MagicString(code);
        return {
          code: magicString.toString(),
          map: magicString.generateMap({hires: true}),
        };
      } else {
        return {
          code,
          map: {mappings: ''},
        };
      }
    },
  };
}

