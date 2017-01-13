const path = require('path');

const Promise = require('bluebird');
// const gitState = Promise.promisifyAll(require('git-state'));
const fs = require('fs-extra');
const debug = require('debug');
const chalk = require('chalk');

const config = require('../config');
const utils = require('../utils');
const installLibsUtils = require('./utils');


const log = debug('jsio-webpack:installLibs');

const ERRORS = {
  MISSING_LIB_DIR: 'MISSING_LIB_DIR',
  LIB_IS_DIRTY: 'LIB_IS_DIRTY',
  GIT_DIRTY: 'GIT_DIRTY'
};


const run = function () {
  let projectDir;
  return Promise.resolve().then(() => {
    projectDir = process.env.PWD;
    console.log('installLibs for:', projectDir);
    if (!fs.existsSync(projectDir)) {
      throw new Error(ERRORS.MISSING_LIB_DIR);
    }
  })
  .then(() => {
    if (!config.installLibs.submodules) {
      return;
    }
    console.log('\nUpdating git submodules...\n');
    // Check for changes
    return utils.runChildProcess('git', ['diff', '--quiet', 'HEAD'], { cwd: projectDir })
    .catch((result) => {
      console.error(chalk.yellow(`Changes detected in git project: ${projectDir}`));
      throw new Error(ERRORS.GIT_DIRTY);
    })
    .then(() => {
      return utils.runChildProcess('git', ['submodule', 'update', '--init'], { cwd: projectDir })
    })
    .then(() => {
      return utils.runChildProcess('git', ['submodule', 'sync', '--recursive'], { cwd: projectDir });
    });
  })
  .then(() => {
    // Find all libs (a fn exists somewhere...)
    return installLibsUtils.getLibDirs(projectDir);
  })
  .then((libDirs) => {
    return Promise.map(libDirs, (libDir) => {
      log('> processing:', libDir.dir);

      // npm install it!
      if (!libDir.package) {
        log('> > no package');
        return;
      }

      console.log(`\nRunning npm install for: ${libDir.dir}\n`);
      return utils.runChildProcess('npm', ['install'], { cwd: libDir.dir })
    }, { concurrency: 1 });
  })
  .then(() => {
    console.log('\n' + chalk.green('installLibs complete!') + '\n');
  });
};


module.exports = {
  run: run,
  ERRORS: ERRORS
};
