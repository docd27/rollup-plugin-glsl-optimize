
import {default as fetch} from 'node-fetch';
import {default as he} from 'he';
import {fixPerms, allFilesExist, zipAll, rmDir, rmFile,
  checkMakeFolder, curlDownloadFile, untargzFile, unzipFile} from './src/lib/download.js';
import {getPlatTag, runToolBuffered} from './src/lib/tools.js';
import * as path from 'path';
import {fileURLToPath} from 'url';
import * as fsSync from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const buildFolder = path.resolve(__dirname, './build');
const buildInfoFile = path.resolve(__dirname, './build.txt');

/**
 * @typedef {{[P in import('./src/lib/tools.js').PlatformTag]: RegExp}} PlatformReleaseMatcher
 * @typedef {{name: string, url: string}} MatchedAsset
 * @typedef {{[P in import('./src/lib/tools.js').PlatformTag]: MatchedAsset}} PlatformMatchedAssets
 * @typedef {{[P in import('./src/lib/tools.js').PlatformTag]: string[]}} PlatformFileList
 * @typedef {{[P in import('./src/lib/tools.js').PlatformTag]: string}} PlatformURLs
 */

/**
 * @typedef {object} SourceConfigBase
 * @property {string} name
 * @property {string[]} verargs
 * @property {RegExp} vermatch
 * @property {PlatformReleaseMatcher} matchers
 * @property {PlatformFileList} filelist
 * @typedef {SourceConfigBase & {type:'githubrelease', repo:string}} SourceConfigGithubRelease
 * @typedef {SourceConfigBase & {type:'spirvtoolsci', urls:PlatformURLs}} SourceConfigSpirvToolsCI
 */
/**
 * @typedef {SourceConfigGithubRelease|SourceConfigSpirvToolsCI} SourceConfig
 */

/**
 * @typedef {'unzip'|'untargz'} BuildFetchStepAction
 * @typedef {object} BuildFetchStep
 * @property {string} name
 * @property {string} url
 * @property {BuildFetchStepAction} [action]
 * @property {string[]} fileList
 * @typedef {Object<string,BuildFetchStep[]>} BuildTargets
 * @typedef {object} BuildConfig
 * @property {string[]} targets
 * @property {SourceConfig[]} sources
 * @property {BuildFetchStep[]} include
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

/**
 * @param {string} url
 * @return {Promise<any>}
 */
async function jsonRequest(url) {
  try {
    const response = await fetch(url, {
      method: 'GET',
    });
    if (!response.ok) throw new Error(`Bad response code: ${response.status}`);
    return response.json();
  } catch (err) {
    throw new Error(`JSON request ${url} failed\n${err.message}`);
  }
}

/**
 * @param {string} repo
 * @param {PlatformReleaseMatcher} releaseMatchers platform -> regex matching
 */
async function fetchMatchingGithubRelease(repo, releaseMatchers) {
  /** @type {Array<object>} */
  const releaseInfos = await jsonRequest(`https://api.github.com/repos/${repo}/releases?per_page=100`);
  if (!releaseInfos || !releaseInfos.length) {
    throw new Error(`Invalid release info for ${repo}`);
  }
  // Sort by created_at (required since glslang's CI replaces assets on the same release ID)
  releaseInfos.sort(({created_at: a}, {created_at: b}) => a ? b ? (new Date(b) - new Date(a)) : -1 : 1);
  let foundReleaseInfo;
  for (const releaseInfo of releaseInfos) {
    if (releaseInfo.draft || // Skip draft releases
      !releaseInfo.html_url || !releaseInfo.created_at || !releaseInfo.target_commitish || // Missing info
      !releaseInfo.assets || !releaseInfo.assets.length // No assets
    ) continue;

    const matchAssets = new Set(releaseInfo.assets);
    const matchPreds = new Map(Object.entries(releaseMatchers));
    /** @type {PlatformMatchedAssets} */
    const matchedPlats = {};
    nextAssset:
    for (const testAsset of matchAssets) {
      if (!testAsset.name || !testAsset.browser_download_url) continue;
      for (const [platName, testPred] of matchPreds) { // Try each matcher on this asset
        if (testAsset.name.match(testPred)) {
          matchedPlats[platName] = /** @type {MatchedAsset} */(
            {name: testAsset.name, url: testAsset.browser_download_url}
          );
          matchPreds.delete(platName);
          continue nextAssset;
        }
      }
    }
    if (matchPreds.size === 0) {
      foundReleaseInfo = {
        url: releaseInfo.html_url,
        hash: releaseInfo.target_commitish,
        date: releaseInfo.created_at,
        tag: new Date(releaseInfo.created_at).toISOString().split('T')[0] +
            '-' + releaseInfo.target_commitish.slice(0, 7),
        platforms: matchedPlats,
      };
      break;
    } else {
      // We could continue searching down releases, but better to throw an error in case
      // naming scheme changes in future
      throw new Error(`Release ${releaseInfo.html_url} failed to match ${[...matchPreds.keys()].join(', ')}`);
    }
  }
  if (!foundReleaseInfo) {
    throw new Error(`Could not find candidate release for ${repo}`);
  }
  return foundReleaseInfo;
}

/**
 * Fetch spirv tools CI badge page and extract meta redirect url
 * @param {string} url
 */
async function fetchSpirvToolsCIPage(url) {
  let resultHTML;
  try {
    const response = await fetch(url, {
      method: 'GET',
    });
    if (!response.ok) throw new Error(`Bad response code: ${response.status}`);
    resultHTML = await response.text();
  } catch (err) {
    throw new Error(`Download CI page ${url} failed\n${err.message}`);
  }
  const redirMatch = resultHTML.match(/<meta\s+http-equiv\s*=\s*"refresh"\s+content\s*=\s*"([^"]*)"[^>]*>/i);
  if (redirMatch && redirMatch.length === 2) {
    const redirContent = he.decode(redirMatch[1]);
    const redirURLMatch = redirContent.match(/url\s*=\s*(\S+)\s*$/i);
    if (redirURLMatch && redirURLMatch.length === 2) {
      return redirURLMatch[1];
    }
  }
  throw new Error(`Failed to parse CI Page ${url}`);
}

/**
 * @typedef {{[P in import('./src/lib/tools.js').PlatformTag]: string}} SpirvToolsCIUrls
 */
/**
 * @param {SpirvToolsCIUrls} urls platform -> CI badge download urls
 * @param {PlatformReleaseMatcher} releaseMatchers platform -> regex matching [version, filename]
 */
async function fetchMatchingSpirvToolsCI(urls, releaseMatchers) {
  /** @type {PlatformMatchedAssets} */
  const platforms = {};
  let version;
  for (const [platform, url] of Object.entries(urls)) {
    const downloadURL = await fetchSpirvToolsCIPage(url);
    if (!releaseMatchers[platform]) throw new Error(`Release matcher missing ${platform}`);
    const matchResult = downloadURL.match(releaseMatchers[platform]);
    if (!matchResult || matchResult.length !== 3) {
      throw new Error(`CI platform ${platform} URL ${downloadURL} failed to match`);
    }
    const assetVersion = matchResult[1], name = matchResult[2];
    platforms[platform] = /** @type {MatchedAsset} */({name, url: downloadURL});
    if (version !== undefined && assetVersion !== version) {
      throw new Error(`Detected version mismatch platform ${platform} : '${assetVersion}' !== '${version}'`);
    }
    version = assetVersion;
  }
  return {version, tag: version, url: '', platforms};
}

(async function main() {
  const thisPlat = getPlatTag();
  if (!thisPlat) throw new Error(`Couldn't identify this platform's tag`);

  const buildConfig = /** @type {BuildConfig} */((await import('./build.binaries.config.mjs')).default);
  if (!buildConfig || !buildConfig.targets || !buildConfig.sources || !buildConfig.include) {
    throw new Error(`Bad build config`);
  }

  rmFile(buildInfoFile);
  rmDir(buildFolder);
  checkMakeFolder(buildFolder);

  const sources = [];

  for (const source of buildConfig.sources) {
    let sourceResult;
    switch (source.type) {
      case 'githubrelease':
        sourceResult = await fetchMatchingGithubRelease(source.repo, source.matchers);
        break;
      case 'spirvtoolsci':
        sourceResult = await fetchMatchingSpirvToolsCI(source.urls, source.matchers);
        break;
      default: throw new Error(`build config error: Unknown type '${source.type}' for source '${source.name}'`);
    }
    for (const target of buildConfig.targets) {
      if (!sourceResult.platforms[target]) throw new Error(`source '${source.name}' missing target '${target}'`);
    }
    console.log(`source '${source.name}' - chose '${sourceResult.tag}' (${sourceResult.url})`);
    sources.push({...sourceResult, name: source.name, filelist: source.filelist,
      verargs: source.verargs, vermatch: source.vermatch});
  }

  const includeFiles = [];
  // Fetch includes (License files)
  for (const includeStep of buildConfig.include) {
    includeFiles.push(...await runBuildFetchStep(includeStep, buildFolder));
  }
  const buildArtefacts = [...includeFiles];

  for (const target of buildConfig.targets) {
    const targetPath = path.join(buildFolder, target);
    console.log(`\n-----\nTarget: ${target} -> ${targetPath}\n-----\n`);
    checkMakeFolder(targetPath);

    for (const includeFile of includeFiles) {
      fsSync.copyFileSync(path.join(buildFolder, includeFile), path.join(targetPath, includeFile),
          fsSync.constants.COPYFILE_EXCL); // Don't overwrite
    }

    for (const source of sources) {
      const url = source.platforms[target].url;
      const extMatch = url.match(/\.(tar\.gz|tgz|zip)$/i) || ['', ''];
      let action;
      switch (extMatch[1].toLowerCase()) {
        case 'tar.gz': case 'tgz': action = 'untargz'; break;
        case 'zip': action = 'unzip'; break;
        default: throw new Error(`Unknown file extension for ${url}`);
      }
      await runBuildFetchStep({
        name: source.name,
        fileList: source.filelist[target],
        url,
        action,
      }, targetPath);
      if (target === thisPlat) { // Run the tool and get version
        const toolBinPath = path.join(targetPath, path.basename(source.filelist[target][0]));
        const toolRunResult = await runToolBuffered(toolBinPath, targetPath, source.name, source.verargs);
        const toolOutput = toolRunResult.out || toolRunResult.err;
        const toolOutputMatch = toolOutput.match(source.vermatch);
        if (!toolOutputMatch || toolOutputMatch.length !== 2) {
          console.log(toolOutput);
          throw new Error(`Couldn't extract version string from ${source.name}`);
        }
        const toolVersion = toolOutputMatch[1];
        source.veroutput = toolVersion;
      }
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

  const versionLines = [];
  for (const source of sources) {
    versionLines.push(`${source.name} ${source.veroutput} (${source.tag})`);
  }
  const versionInfo = versionLines.join('\n');
  fsSync.writeFileSync(buildInfoFile, versionInfo);

  console.log(`\nDescription:\n${versionInfo}`);

  process.exit(0);
})();

