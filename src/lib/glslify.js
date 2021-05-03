import * as path from 'path';
import * as fsSync from 'fs';

/**
 * @typedef {Object} GlslifyBaseOptions
 * @property {string} basedir
 * @typedef {{[key: string]: any} & GlslifyBaseOptions} GlslifyOptions
 */

/** @type {{(src:string, opts:GlslifyOptions):string}} glslify.compile */
let glslifyCompile;

/**
 * Try to dynamically load glslify if installed
 */
export async function glslifyInit() {
  if (glslifyCompile) return;
  try {
    // @ts-ignore
    const glslify = await import('glslify');
    if (glslify && glslify.compile && typeof glslify.compile === 'function') {
      glslifyCompile = glslify.compile;
    }
  } catch {
    // do nothing
  }
}

/**
 * Process source with glslify
 * @param {string} id File path
 * @param {string} source Source code
 * @param {Partial<GlslifyOptions>} options
 * @param {(message: string) => never} failError
 * @param {(message: string) => void} [warnLog]
 */
export async function glslifyProcessSource(id, source, options, failError, warnLog = console.error) {
  if (!glslifyCompile) {
    failError(`glslify could not be found. Install it with npm i -D glslify`);
  }

  let basedir = path.dirname(id);
  if (!fsSync.existsSync(basedir)) {
    warnLog(`Error resolving path: '${id}' : glslify may fail to find includes`);
    basedir = process.cwd();
  }

  return glslifyCompile(source, /** @type {GlslifyOptions} */({basedir, ...options}));
}
