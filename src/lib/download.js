import * as fsSync from 'fs';
import {default as createHttpsProxyAgent} from 'https-proxy-agent';
import {default as TFileCache} from '@derhuerst/http-basic/lib/FileCache.js';
import * as querystring from 'querystring';
import {default as request} from '@derhuerst/http-basic';
import {default as ProgressBar} from 'progress';
import {default as AdmZip} from 'adm-zip';

import {URL} from 'url';
import {argQuote, getCachePath, launchToolPath, runTool} from './tools.js';

/**
 * @typedef {import('@derhuerst/http-basic/lib/FileCache.js').default} FileCacheInst
 * @type {typeof import('@derhuerst/http-basic/lib/FileCache.js').default} */
const FileCache = (
  /** @type {any} */(TFileCache).default);

/**
 * @param {import('@derhuerst/http-basic').HttpVerb} method
 * @param {string | URL} url
 * @param {import('@derhuerst/http-basic').Options | null} options
 * @return {Promise<import('@derhuerst/http-basic').Response<NodeJS.ReadableStream>>}
 */
const requestAsync = (method, url, options = null) => new Promise((resolve, reject) =>
  request(method, url, options, (err, response) => {
    if (err) reject(err);
    else resolve(response);
  }));

const normalizeS3Url = (url) => {
  url = new URL(url);
  if (url.hostname.slice(-17) !== '.s3.amazonaws.com') return url.href;
  const query = Array.from(url.searchParams.entries())
      .filter(([key]) => key.slice(0, 6).toLowerCase() !== 'x-amz-')
      .reduce((query, [key, val]) => ({...query, [key]: val}), {});
  url.search = querystring.stringify(query);
  return url.href;
};

/** @type {{proxyAgent: false|import('https-proxy-agent').HttpsProxyAgent, cache: FileCacheInst}} */
let httpHelpers = null;
function initHTTP() {
  if (httpHelpers) return;
  httpHelpers = {proxyAgent: false, cache: null};
  const proxyUrl = (
    process.env.HTTPS_PROXY ||
    process.env.https_proxy ||
    process.env.HTTP_PROXY ||
    process.env.http_proxy
  );
  if (proxyUrl) {
    const {hostname, port, protocol} = new URL(proxyUrl);
    httpHelpers.proxyAgent = createHttpsProxyAgent({hostname, port, protocol});
  }
  httpHelpers.cache = new FileCache(getCachePath());
  httpHelpers.cache.getCacheKey = (url) => {
    return FileCache.prototype.getCacheKey(normalizeS3Url(url));
  };
}

/** @internal */
export const downloadProgress = (taskName) => {
  let progressBar = null;
  return (deltaBytes, totalBytes) => {
    if (totalBytes === null) return;
    if (!progressBar) {
      progressBar = new ProgressBar(`Downloading ${taskName} [:bar] :percent :etas `, {
        complete: '|',
        incomplete: ' ',
        width: 20,
        total: totalBytes,
      });
    }
    progressBar.tick(deltaBytes);
  };
};

/** @internal */
export async function downloadFile(url, destinationPath, progressCallback = undefined) {
  if (!httpHelpers) initHTTP();
  let totalBytes = 0;
  let response;
  try {
    response = await requestAsync('GET', url, {
      agent: httpHelpers.proxyAgent,
      followRedirects: true,
      maxRedirects: 3,
      gzip: true,
      cache: httpHelpers.cache,
      timeout: 30 * 1000, // 30s
      retry: true,
    });
    if (response.statusCode !== 200) throw new Error(`Bad response code: ${response.statusCode}`);
  } catch (err) {
    throw new Error(`Download failed\n${err.message}`);
  }

  return new Promise((resolve, reject) => {
    try {
      const file = fsSync.createWriteStream(destinationPath);
      file.on('finish', () => resolve());
      file.on('error', (error) => reject(error));
      response.body.pipe(file);

      if (!response.fromCache && progressCallback) {
        const cLength = response.headers['content-length'];
        totalBytes = cLength ? parseInt(cLength, 10) : null;
        response.body.on('data', (chunk) => {
          progressCallback(chunk.length, totalBytes);
        });
      }
    } catch (err) {
      reject(err);
    }
  });
}

/**
 * @internal
 * @param {string[]} paths */
export function fixPerms(paths) {
  for (const path of paths) {
    if (path && fsSync.existsSync(path)) {
      fsSync.chmodSync(path, 0o755); // executable
    }
  }
}

/**
 * @internal
 * @param {string[]} paths */
export const allFilesExist = (paths) => paths.every((path) => !path || fsSync.existsSync(path));

/** @param {string} path */
export function checkMakeFolder(path) {
  if (!fsSync.existsSync(path)) {
    fsSync.mkdirSync(path, {recursive: true});
  }
  return true;
}

/**
 * @internal
 * Extracts zip then deletes it
 * @param {string} zipPath
 * @param {string} destFolder
 */
export function unzipAndDelete(zipPath, destFolder) {
  if (!fsSync.existsSync(zipPath)) {
    throw new Error('Archive does not exist');
  }
  if (!fsSync.existsSync(destFolder)) {
    throw new Error('Destination does not exist');
  }
  const zip = new AdmZip(zipPath);
  const entries = zip.getEntries().map((entry) => entry.entryName);
  zip.extractAllTo(destFolder, true);
  fsSync.unlinkSync(zipPath);
  return entries;
}


/**
 * @internal
 * @param {string} url
 * @param {string} dest
 * @param {string} workingDir
 */
export async function curlDownloadFile(url, dest, workingDir) {
  const curlResult = await runTool(launchToolPath('curl', workingDir, [
    '--progress-bar', // Simple progress bar
    '--location', // Follow redirects
    '--compressed', // gzip compression of text resources
    '--user-agent', ...argQuote('Build script'),
    '--output', ...argQuote(dest),
    ...argQuote(url),
  ]));
  if (curlResult.error) {
    // printDiagnostic(curlResult.outLines);
    // printDiagnostic(curlResult.errLines);
    const errMsg = `Download failed: curl ${curlResult.exitMessage}`;
    console.error(errMsg);
    throw new Error(errMsg);
  }
}

/**
 * @internal
 * @param {string} archiveFile
 * @param {string[]} fileList
 * @param {string} workingDir
 */
export async function untargzFile(archiveFile, fileList, workingDir) {
  const curlResult = await runTool(launchToolPath('tar', workingDir, [
    '-x', // extract
    '-z', // gzip
    '--skip-old-files', // never overwrite (skip)
    `--transform=s,.*/,,`, // Strip directory structure
    '-f', ...argQuote(archiveFile),
    ...(fileList.map((path) => argQuote(path)).flat()),
  ]));
  if (curlResult.error) {
    const errMsg = `Extract failed: tar ${curlResult.exitMessage}`;
    console.error(errMsg);
    throw new Error(errMsg);
  }
}

/**
 * @internal
 * @param {string} archiveFile
 * @param {string[]} fileList
 * @param {string} workingDir
 */
export async function unzipFile(archiveFile, fileList, workingDir) {
  const curlResult = await runTool(launchToolPath('unzip', workingDir, [
    '-j', // strip directory structure
    '-n', // never overwrite (skip)
    ...argQuote(archiveFile),
    ...(fileList.map((path) => argQuote(path)).flat()),
  ]));
  if (curlResult.error) {
    const errMsg = `Extract failed: tar ${curlResult.exitMessage}`;
    console.error(errMsg);
    throw new Error(errMsg);
  }
}

/**
 * @internal
 * @param {string} archiveFile
 * @param {string} workingDir
 */
export async function zipAll(archiveFile, workingDir) {
  const curlResult = await runTool(launchToolPath('7z', workingDir, [
    'a',
    ...argQuote(archiveFile),
    '*',
  ]));
  if (curlResult.error) {
    const errMsg = `Zip failed: 7z ${curlResult.exitMessage}`;
    console.error(errMsg);
    throw new Error(errMsg);
  }
}

/** @internal */
export const rmDir = (path) => fsSync.existsSync(path) && fsSync.rmdirSync(path, {recursive: true});
