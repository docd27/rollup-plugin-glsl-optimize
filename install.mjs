import {configurePlatformBinaries, getPkg, allToolInfo} from './src/lib/tools.js';
import {fixPerms, allFilesExist, downloadFile, downloadProgress,
  checkMakeFolder, unzipAndDelete} from './src/lib/download.js';
import * as path from 'path';

const fatalError = (err) => {
  console.error(err);
  console.error(`Installing required binary tools failed.`);
  console.error(`\n** Manual Khronos tool installation required **\n\n${allToolInfo()}`);
  installStatus.message = err;
  installStatus.error = true;
  installStatus.done = true;
  process.exitCode = 0; // Allow npm install to proceed
};

// For test instrumentation
export const installStatus = {
  done: false,
  installed: false,
  error: false,
  message: undefined,
};

(async function main() {
  const binSource = configurePlatformBinaries();

  if (!binSource || !binSource.tag) {
    fatalError('Prebuilt binaries not available for this platform');
    return;
  }

  if (allFilesExist(binSource.fileList)) {
    console.info('All binaries already installed');
    fixPerms(binSource.fileList);
    installStatus.done = true;
    return;
  }

  const downloadBaseURL = getPkg()?.installBinaries?.url;
  const downloadTag = getPkg()?.installBinaries?.tag;

  if (!downloadBaseURL || !downloadTag) {
    fatalError('No configured download URL');
    return;
  }

  try {
    checkMakeFolder(binSource.folderPath);
  } catch (err) {
    fatalError('Failed to create output folder');
    return;
  }

  const downloadArchiveName = `${binSource.tag}.zip`;
  const downloadURL = new URL(`${downloadTag}/${downloadArchiveName}`, downloadBaseURL).toString();

  const downloadArchivePath = path.join(binSource.folderPath, downloadArchiveName);

  try {
    await downloadFile(downloadURL, downloadArchivePath, downloadProgress(`binaries for ${binSource.tag}`));

    const unzippedFiles = unzipAndDelete(downloadArchivePath, binSource.folderPath);

    if (allFilesExist(binSource.fileList)) {
      fixPerms(binSource.fileList);
    } else {
      fatalError('Downloaded archive did not include the expected binaries');
      return;
    }

  } catch (err) {
    console.log(err);
    fatalError(`Failed to download binaries for ${binSource.tag}\n${err.message}`);
    return;
  }

  installStatus.installed = true;
  console.log('Install completed');
  installStatus.done = true;

})();

