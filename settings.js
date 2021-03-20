import {fileURLToPath} from 'url';
import * as path from 'path';
const __dirname = path.dirname(fileURLToPath(import.meta.url));

/**
 * Used for locating the project root + bin directories
 * This file MUST be located at the project root
 */
export const settings = {
  PROJECT_ROOT: __dirname,
  BIN_PATH: path.resolve(__dirname, `./bin`),
};
