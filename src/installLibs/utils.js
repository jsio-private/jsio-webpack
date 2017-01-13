const path = require('path');

const fs = require('fs-extra');
const debug = require('debug');
const Promise = require('bluebird');

const utils = require('../utils');


const log = debug('jsio-webpack:installLibs:utils');


const getLibDirs = function (
  projectDir
) {
  return Promise.resolve().then(() => {
    const libDir = path.join(projectDir, 'lib');
    log('> getLibDirs:', libDir);
    if (!fs.existsSync(libDir)) {
      return [];
    }
    const dirs = utils.getDirectories(libDir);
    log('> > Checking dirs:', dirs);
    return Promise.map(dirs, (dir) => {
      const moduleDir = path.join(libDir, dir);
      const result = {
        dir: moduleDir,
        package: null
      };
      const packagePath = path.join(moduleDir, 'package.json');
      if (fs.existsSync(packagePath)) {
        result.package = fs.readJsonSync(packagePath);
      }
      return result;
    }, { concurrency: 1 });
  });
};


module.exports = {
  getLibDirs: getLibDirs
};
