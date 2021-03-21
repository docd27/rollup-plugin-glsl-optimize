import {assert} from 'chai';
import {settings} from '../../settings.js';
import {default as rimraf} from 'rimraf';

export function installTests() {
  describe('Installer', function() {
    before('cleanup bin folder', function() {
      assert.isNotEmpty(settings.BIN_PATH, 'Bin path set');
      rimraf.sync(settings.BIN_PATH);
    });
    it('should install binaries successfully', async function() {
      try {
        const installStatus = (await import('../../install.mjs')).installStatus;
        // We have to do this polling because top-level await is flagged in node <= 14.8.0
        for (let c = 0; !installStatus.done && c < 300; c++) { // Timeout after 30 secs
          await new Promise(resolve => setTimeout(resolve, 100));
        }
        assert.isTrue(installStatus.done, 'Install script finished');
        assert.isTrue(installStatus.installed, 'Install completed');
      } catch (err) {
        console.error(err);
        assert.fail(err.message);
      }
    });
  });
}