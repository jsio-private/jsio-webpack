import { WebpackConfig } from './Configurator';
import { UserConfig } from './builder/builderConfig';
import os from 'os';
import path from 'path';
import childProcess from 'child_process';

import Promise from 'bluebird';
import chalk from 'chalk';

import config from './config';
import { getWebpackConfig, runCompiler } from './builder/builderWebpackInterface';


const WORKER_PATH = path.resolve(__dirname, './builder/builderWorker.js');


const printHeader = function (s: string): void {
  console.log('\n**** ****');
  console.log(s);
  console.log('**** ****\n');
};


const runWorkerFor = function (name: string, webpackConfigIndex: number): Promise<void> {
  return new Promise<void>((resolve: Function, reject: Function) => {
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
      const error: Error = data.error;
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


export const startBuild = function (userConfigs: UserConfig[]): Promise<void> {
  printHeader('Getting config');
  // TODO: <any> to supress weird TS Promise generic error
  return (<any>getWebpackConfig(userConfigs))
  .then((finalWebpackConfig: WebpackConfig[]) => {
    console.log('\nBuilding...\n');

    if (Array.isArray(finalWebpackConfig) && config.enableChildProcess) {
      const cores = os.cpus().length / 2;
      printHeader(`Running compilers in multithreaded mode across ${cores} cores`);
      return Promise.map(finalWebpackConfig, (webpackConfig, i: number) => {
        return runWorkerFor(`thread_${i}`, i);
      }, { concurrency: cores });
    }

    printHeader('Running compiler');
    return runCompiler(finalWebpackConfig);
  })
  .then(() => {
    printHeader('Done');
  })
  .catch((err: Error) => {
    console.log(chalk.red('Error:'), err);
    throw err;
  });
};
