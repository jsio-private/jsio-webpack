import path from 'path';

import Promise from 'bluebird';
import chalk from 'chalk';
import fs from 'fs-extra';
import childProcessPromise from 'child-process-promise';


// See: http://stackoverflow.com/questions/18112204/get-all-directories-within-directory-nodejs
export const getDirectories = function(d: string): string[] {
  return fs.readdirSync(d).filter((file: string) => {
    return fs.statSync(path.join(d, file)).isDirectory();
  });
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
