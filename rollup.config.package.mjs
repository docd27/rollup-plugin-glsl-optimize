import internalDel from 'del';
import commonjs from '@rollup/plugin-commonjs';
import resolve from '@rollup/plugin-node-resolve';
import cleanup from 'rollup-plugin-cleanup';

let earlyDelDone = false;
// Runs sequentially before buildStart hooks:
function earlyDel(targets = [], deleteOptions = {}) {
  return {
    name: 'earlydel',
    options: function(options) {
      if (!earlyDelDone) {
        earlyDelDone = true;
        const paths = internalDel.sync(targets, deleteOptions);
        if (deleteOptions.verbose) {
          console.log(`Deleted files and folders: ${paths.length}`);
          if (paths.length > 0) {
            paths.forEach((path) => {
              console.log(path);
            });
          }
        }
      }
      return null;
    },
  };
}

const BANNER_MSG = `/*
* DO NOT EDIT: Auto-generated bundle from sources in ./src
* For easier debugging you can include ./src/index.js directly instead
*/`;

export default [{
  input: `src/index.js`,
  output: {
    file: `index.js`,
    format: 'esm',
    banner: `/* eslint-disable */\n// @ts-nocheck\n\n${BANNER_MSG}\n\n`,
  },
  plugins: [
    earlyDel(['index.js']),
    resolve(),
    commonjs(),
    cleanup({
      comments: 'sources',
    }),
  ],
  external: [
    '@derhuerst/http-basic',
    '@derhuerst/http-basic/lib/FileCache.js',
    '@rollup/pluginutils',
    'adm-zip',
    'env-paths',
    'https-proxy-agent',
    'magic-string',
    'progress',
  ],
},
];
