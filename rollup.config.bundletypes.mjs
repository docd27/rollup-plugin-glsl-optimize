import internalDel from 'del';
import del from 'rollup-plugin-delete';
import dts from 'rollup-plugin-dts';

const IN_DIR = 'typings-autogen';
const OUT_DIR = 'typings';

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

export default [{
  input: `${IN_DIR}/src/index.d.ts`,
  output: {
    file: `${OUT_DIR}/index.d.ts`,
    format: 'es',
  },
  plugins: [
    earlyDel([OUT_DIR]),
    dts(),
    del({hook: 'buildEnd', targets: [IN_DIR]}),
  ],
  external: [ 'child_process' ],
}];
