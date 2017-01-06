#!/usr/bin/env node
'use strict';

const yargs = require('yargs');

const config = require('../src/config');


let arg = yargs
  .usage('usage: $0 <command>')
  .option('v', {
    description: 'Enable verbose logging',
    default: false,
    type: 'boolean'
  })
  .option('w', {
    alias: 'watch',
    description: 'Watch files, compile on change',
    default: false,
    type: 'boolean'
  })
  .command('serve', 'Watch files, compile on change, serve from memory using webpack-dev-server', (yargs2) => {
    arg = yargs2
      .option('h', {
        alias: 'hot',
        description: 'Use webpacks HotModuleReplacementPlugin',
        type: 'boolean',
        default: config.serve.useHMR
      })
      .option('p', {
        alias: 'port',
        description: 'Port for the webpack-dev-server to listen on',
        type: 'number',
        default: config.serve.port
      })
      .help('help');
    config.isServer = true;
  })
  .command('karma', 'Set up project testing using karma', (yargs2) => {
    arg = yargs2
      .option('p', {
        alias: 'port',
        description: 'Port for karma server',
        default: config.karma.port,
        type: 'number'
      })
      .option('f', {
        alias: 'files',
        default: config.karma.files,
        description: 'Files to include in karma config, separated with ",".',
        type: 'string'
      })
      .option('c', {
        alias: 'config',
        description: 'This should be a relative path to PWD for the karma.conf.js for this project',
        type: 'string'
      })
      .help('help');
    config.isKarma = true;
  })
  .help('help');
const mainArgv = arg.argv;


// Update config
config.verbose = mainArgv.v;
config.watch = mainArgv.watch;


if (config.isKarma) {
  config.karma.port = mainArgv.port;
  config.karma.files = mainArgv.files;
  config.karma.configFilePath = mainArgv.config;
  const karmaIntegration = require('../src/karmaIntegration');
  karmaIntegration.runKarma();
} else {
  config.serve.useHMR = mainArgv.hot;
  config.serve.port = mainArgv.port;
  const builder = require('../src/builder');
  // Start it up!
  builder.start();
}
