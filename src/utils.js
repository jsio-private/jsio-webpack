const path = require('path');

const Promise = require('bluebird');
const chalk = require('chalk');
const fs = require('fs-extra');
const childProcessPromise = require('child-process-promise');


// See: http://stackoverflow.com/questions/18112204/get-all-directories-within-directory-nodejs
const getDirectories = function (d) {
  return fs.readdirSync(d).filter((file) => {
    return fs.statSync(path.join(d, file)).isDirectory();
  });
};


const runChildProcess = function (cmd, args, options) {
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
    return Promise.resolve(promise).tap(() => {
      console.log(prefix, chalk.gray(`childProcess ${childProcess.pid} exited`));
    });
  });
};


module.exports = {
  getDirectories: getDirectories,
  runChildProcess: runChildProcess
};
