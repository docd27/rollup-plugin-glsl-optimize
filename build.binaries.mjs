
import {loadJSON} from './lib/tools.js';
import {fixPerms, allFilesExist, zipAll, rmDir,
  checkMakeFolder, curlDownloadFile, untargzFile, unzipFile} from './lib/download.js';
import * as path from 'path';
import {fileURLToPath} from 'url';
import * as fsSync from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const buildFolder = path.resolve(__dirname, './build');

/**
 * @typedef {'unzip'|'untargz'} BuildFetchStepAction
 * @typedef {Object} BuildFetchStep
 * @property {string} name
 * @property {string} url
 * @property {BuildFetchStepAction} [action]
 * @property {string[]} fileList
 *
 * @typedef {Object<string,BuildFetchStep[]>} BuildTargets
 * @typedef {Object} BuildConfig
 * @property {BuildFetchStep[]} include
 * @property {BuildTargets} targets
 */

/**
 * @param {BuildFetchStep} buildStep
 * @param {string} targetDir
 * @return {string[]} resultant files
*/
const runBuildFetchStep = async (buildStep, targetDir) => {
  let targetFile = '';
  if (buildStep.action) {
    targetFile = buildStep.action === 'untargz' ? 'temp.tar.gz' : 'temp.zip';
  } else {
    if (buildStep.fileList.length !== 1) throw new Error('buildStep.fileList.length !== 1');
    targetFile = buildStep.fileList[0];
  }
  const targetFileAbs = path.join(targetDir, targetFile);
  console.log(`Fetch ${buildStep.name}`);
  await curlDownloadFile(buildStep.url, targetFile, targetDir);

  if (!fsSync.existsSync(targetFileAbs)) {
    throw new Error(`No file downloaded`);
  }

  if (buildStep.action) {
    if (buildStep.action === 'untargz') {
      await untargzFile(targetFile, buildStep.fileList, targetDir);
    } else if (buildStep.action === 'unzip') {
      await unzipFile(targetFile, buildStep.fileList, targetDir);
    }

    fsSync.unlinkSync(targetFileAbs); // clean temp archive

    const fileList = buildStep.fileList.map((file) => path.basename(file));
    const absFileList = fileList.map((file) => path.join(targetDir, file));
    if (!allFilesExist(absFileList)) {
      throw new Error(`Archive did not extract expected files`);
    }
    fixPerms(absFileList);
    return fileList;
  } else {
    return [targetFile];
  }

};

(async function main() {
  const buildConfig = /** @type {BuildConfig} */(loadJSON('build.binaries.json'));
  if (!buildConfig || !buildConfig.include || !buildConfig.targets) throw new Error(`Bad build config`);

  rmDir(buildFolder);
  checkMakeFolder(buildFolder);


  const includeFiles = [];
  // Fetch includes (License files)
  for (const includeStep of buildConfig.include) {
    includeFiles.push(...await runBuildFetchStep(includeStep, buildFolder));
  }
  const buildArtefacts = [...includeFiles];

  for (const [target, targetSteps] of Object.entries(buildConfig.targets)) {
    const targetPath = path.join(buildFolder, target);
    console.log(`\n-----\nTarget: ${target} -> ${targetPath}\n-----\n`);
    checkMakeFolder(targetPath);

    for (const includeFile of includeFiles) {
      fsSync.copyFileSync(path.join(buildFolder, includeFile), path.join(targetPath, includeFile),
          fsSync.constants.COPYFILE_EXCL); // Don't overwrite
    }

    for (const fetchStep of targetSteps) {
      await runBuildFetchStep(fetchStep, targetPath);
    }

    console.log('Creating archive');
    const targetArchive = `${target}.zip`;
    const targetArchiveAbs = path.join(buildFolder, targetArchive);
    await zipAll(targetArchiveAbs, targetPath);

    if (!fsSync.existsSync(targetArchiveAbs)) {
      throw new Error(`No archive created`);
    }
    buildArtefacts.push(targetArchive);

    rmDir(targetPath);
    console.log(`\nTarget completed\n`);
  }

  console.log('Build completed');

  console.log(`\nListing:\n${buildArtefacts.join('\n')}`);

  process.exit(0);
})();

