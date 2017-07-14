import path from 'path';

import Promise from 'bluebird';
import fs from 'fs-extra';
import debug from 'debug';
import chalk from 'chalk';

import config from '../config';
import { getLibDirs } from './utils';
import { runChildProcess } from '../utils';


const log = debug('jsio-webpack:installLibs');

export const ERRORS = {
  MISSING_LIB_DIR: 'MISSING_LIB_DIR',
  LIB_IS_DIRTY: 'LIB_IS_DIRTY'
};


const updateGitSubmodules = function(
  cwd: string
): Promise<void> {
  console.log('\nUpdating git submodules...\n');
  return Promise.resolve().then(() => {
    return runChildProcess('git', ['diff', '--quiet', 'HEAD'], { cwd })
    .then(() => {
      return true;
    })
    .catch((err) => {
      if (err.code === 129) {
        console.warn('> Not a git project');
        return false;
      }

      if (err.code === 1) {
        console.error(chalk.yellow(`Changes detected in git project: ${cwd}`));
        return true;
      }

      throw new Error(`Unexpected return code: ${err.code}`);
    });
  })
  .then((updateSubmodules) => {
    if (!updateSubmodules) {
      return;
    }

    return runChildProcess('git', ['submodule', 'sync', '--recursive'], { cwd })
    .then(() => {
      return runChildProcess('git', ['submodule', 'update', '--init'], { cwd });
    });
  });
};


export const run = function(): Promise<void> {
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
    return updateGitSubmodules(projectDir);
  })
  .then(() => {
    // Find all libs (a fn exists somewhere...)
    return getLibDirs(projectDir);
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
      return runChildProcess('npm', ['install'], { cwd: libDir.dir })
    }, { concurrency: 1 });
  })
  .then(() => {
    console.log('\n' + chalk.green('installLibs complete!') + '\n');
  })
  .catch((err) => {
    console.error(chalk.red('Error while installing libs:'));
    console.error(err.stack);
    process.exit(1);
  });
};
