import path from 'path';

import _ from 'lodash';
import fs from 'fs-extra';
import debug from 'debug';
import Promise from 'bluebird';

import utils from '../utils';


const log = debug('jsio-webpack:installLibs:utils');


export type LibDirResult = {
  dir: string;
  package: any;
};


export const getLibDirs = function(
  projectDir: string
): Promise<LibDirResult[]> {
  return Promise.resolve().then(() => {
    log('> getLibDirs:', projectDir);
    const dirNames = ['lib', 'modules'];
    return Promise.map(dirNames, (dirName: string) => {
      const libDir = path.join(projectDir, dirName);
      if (!fs.existsSync(libDir)) {
        return [];
      }
      const dirs: string[] = utils.getDirectories(libDir);
      log('> > Checking dirs:', libDir, dirs);
      return Promise.map(dirs, (dir: string) => {
        const moduleDir = path.join(libDir, dir);
        const result: LibDirResult = {
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
    .then((dirListList: LibDirResult[][]) => {
      // Flatten the list of lists in to a single list [['a'], ['b']] -> ['a', 'b']
      return _.flatten(dirListList);
    });
  });
};
