'use strict';
const os = require('os');
const path = require('path');
const childProcess = require('child_process');

const Promise = require('bluebird');
const chalk = require('chalk');

const config = require('./config');
const builderWebpackInterface = require('./builder/builderWebpackInterface');


const WORKER_PATH = path.resolve(__dirname, './builder/builderWorker.js');


const printHeader = function (s) {
  console.log('\n**** ****');
  console.log(s);
  console.log('**** ****\n');
};


const runWorkerFor = function (name, webpackConfigIndex) {
  return new Promise((resolve, reject) => {
    const child = childProcess.fork(WORKER_PATH, [], {
      silent: true
    });
    child.stdout.on('data', (data) => {
      console.log(`${chalk.gray(name)} STDOUT:\t ${data}`);
    });
    child.stderr.on('data', (data) => {
      console.log(`${chalk.gray(name)} ${chalk.red('STDERR')}:\t ${data}`);
    });
    child.on('message', (data) => {
      child.kill();
      const error = data.error;
      if (error) {
        console.log(chalk.red('Child process error:'), name, error);
        reject(error);
      } else {
        resolve();
      }
    });
    child.send({
      webpackConfigIndex: webpackConfigIndex,
      config: config
    });
  });
};


const start = function (userConfigs, cb) {
  printHeader('Getting config');
  return builderWebpackInterface.getWebpackConfig(userConfigs)
  .then((finalWebpackConfig) => {
    console.log('\nBuilding...\n');

    if (Array.isArray(finalWebpackConfig) && config.enableChildProcess) {
      const cores = os.cpus().length / 2;
      printHeader(`Running compilers in multithreaded mode across ${cores} cores`);
      return Promise.map(finalWebpackConfig, (webpackConfig, i) => {
        return runWorkerFor(`thread_${i}`, i);
      }, { concurrency: cores });
    }

    printHeader('Running compiler');
    return builderWebpackInterface.runCompiler(finalWebpackConfig);
  })
  .then(() => {
    printHeader('Done');
    cb && cb(null);
  })
  .catch((err) => {
    cb && cb(err);
    console.log(chalk.red('Error:'), err);
  });
};


module.exports = {
  start: start
};
