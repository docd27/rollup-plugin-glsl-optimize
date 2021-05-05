import {assert} from 'chai';
import * as download from '../../src/lib/download.js';
import * as tools from '../../src/lib/tools.js';

export function utilTests() {
  describe('Utility functions', function() {
    it('should correctly normalize a github release URL', function() {

      const baseURL = 'https://github-releases.githubusercontent.com/123456/123456-123456';
      const baseParams = 'actor_id=0&key_id=0&repo_id=123456&' +
      'response-content-disposition=attachment%3B+filename%3DglslangValidator&' +
      'response-content-type=application%2Foctet-stream';
      const amzParams = 'X-Amz-Algorithm=AWS4-HMAC-SHA256' +
      '&X-Amz-Credential=A123456%2Fus-east-1%2Fs3%2Faws4_request&' +
      'X-Amz-Date=123456Z&X-Amz-Expires=123&' +
      'X-Amz-Signature=123456&' +
      'X-Amz-SignedHeaders=host';
      const cleanURL = `${baseURL}?${baseParams}`;
      const testURL = `${baseURL}?${baseParams}&${amzParams}`;

      assert.strictEqual(download.normalizeGithubReleaseURL(testURL), cleanURL);
    });
    it('should warn about missing Khronos binaries', function() {
      process.env.GLSLANG_VALIDATOR = process.env.GLSLANG_OPTIMIZER = process.env.GLSLANG_CROSS = '/does/not/exist';
      assert.throws(() => tools.configureTools({}), /Khronos tool binaries could not be found/i);
      delete process.env.GLSLANG_VALIDATOR; delete process.env.GLSLANG_OPTIMIZER; delete process.env.GLSLANG_CROSS;
    });
    it('should output stderr from failing command', async function() {
      // Mock console output:
      const consoleOrig = global.console;
      let outBuf = '';
      global.console = {
        log: (...args) => {
          outBuf += `${args.map(String).join(' ')}\n`;
        },
      };
      global.console.error = global.console.warn = global.console.log;

      await assert.isRejected(tools.runToolBuffered('ping', '.', 'ping', ['-']), /failed/i);

      // Unmock:
      global.console = consoleOrig;

      assert.isNotEmpty(outBuf, 'stdout/stderr empty');
    });
  });
}
