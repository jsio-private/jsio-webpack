const path = require('path');

const _ = require('lodash');
const fs = require('fs-extra');
const debug = require('debug');
const Promise = require('bluebird');

const utils = require('../utils');


const log = debug('jsio-webpack:installLibs:utils');


const getLibDirs = function (
  projectDir
) {
  return Promise.resolve().then(() => {
    log('> getLibDirs:', projectDir);
    const dirNames = ['lib', 'modules'];
    return Promise.map(dirNames, (dirName) => {
      const libDir = path.join(projectDir, dirName);
      if (!fs.existsSync(libDir)) {
        return [];
      }
      const dirs = utils.getDirectories(libDir);
      log('> > Checking dirs:', libDir, dirs);
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
    }, { concurrency: 1 })
    .then((dirListList) => {
      // Flatten the list of lists in to a single list [['a'], ['b']] -> ['a', 'b']
      return _.flatten(dirListList);
    });
  });
};


module.exports = {
  getLibDirs: getLibDirs
};
