import path from 'path';

import debug from 'debug';
import Promise from 'bluebird';
import chalk from 'chalk';
import fs from 'fs-extra';
import childProcessPromise from 'child-process-promise';


const log: Function = debug('jsio-webpack:utils');


// See: http://stackoverflow.com/questions/18112204/get-all-directories-within-directory-nodejs
export const getDirectories = function(d: string): string[] {
  return fs.readdirSync(d).filter((file: string) => {
    return fs.statSync(path.join(d, file)).isDirectory();
  });
};


// See: https://github.com/kribblo/npm-list-linked/blob/master/npm-list-linked.js
// See: https://github.com/ryanve/symlinked/blob/master/index.js
const searchDir = function(
  dir: string
): string[] {
  log('searchDir:', dir);
  let results: string[] = [];
  if (!fs.existsSync(dir)) {
    log('> Cannot find dir');
    return results;
  }

  const children: string[] = fs.readdirSync(dir);
  log('> children=', children)
  for (let i = 0; i < children.length; i++) {
    const childPath = path.join(dir, children[i]);
    if (fs.existsSync(childPath)) {
      const stat = fs.lstatSync(childPath);
      if (path.basename(childPath).indexOf('@') === 0 && stat.isDirectory()) {
        // Recurse
        const scopedChildren: string[] = searchDir(childPath);
        results = results.concat(scopedChildren);
        continue;
      }
      if (stat.isSymbolicLink()) {
        results.push(childPath);
        continue;
      }
    }
  }

  return results;
};

export const getLinkedModules = function(
  dir: string
): string[] {
  let results: string[];
  log('getLinkedModules:', dir);
  dir = path.resolve(dir, 'node_modules');
  results = searchDir(dir);
  log('> results=', results);
  return results;
};


export type RunChildProcessOptions = {
  cwd: string;
};


export const runChildProcess = function(
  cmd: string,
  args: string[],
  options: RunChildProcessOptions
): Promise<void> {
  return Promise.resolve().then(() => {
    const prefix = chalk.gray('[spawn]');
    console.log(prefix, 'Spawning:', cmd, args, options);
    const promise = childProcessPromise.spawn(cmd, args, options);
    const childProcess = promise.childProcess;
    console.log(prefix, chalk.gray(`childProcess.pid= ${childProcess.pid}`));
    childProcess.stdout.on('data', (data) => {
      console.log(prefix, chalk.bgBlack('stdout'), data.toString().trim());
    });
    childProcess.stderr.on('data', (data) => {
      console.log(prefix, chalk.bgRed('stderr'), data.toString().trim());
    });
    // TODO: Promise type error
    return (<any>Promise.resolve(promise)).tap(() => {
      console.log(prefix, chalk.gray(`childProcess ${childProcess.pid} exited`));
    });
  });
};
