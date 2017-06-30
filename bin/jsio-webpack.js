#!/usr/bin/env node
'use strict';

const yargs = require('yargs');

const jsioWebpack = require('../dist/jsioWebpack');

const config = jsioWebpack.config;
const envLoader = jsioWebpack.envLoader;


let arg = yargs
  .usage('usage: $0 <command>')
  .option('v', {
    description: 'Enable verbose logging',
    default: false,
    type: 'boolean'
  })
  .option('env', {
    description: 'Set NODE_ENV and load this env (if possible) from $PWD/envs/$NODE_ENV',
    default: 'development',
    type: 'string'
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
  .command('install-libs', '', (yargs2) => {
    arg = yargs2
      .option('s', {
        alias: 'submodules',
        description: 'Update (and init) submodules in the parent project before running npm install on lib directories.',
        type: 'boolean',
        default: config.installLibs.submodules
      })
      .help('help');
    config.isInstallLibs = true;
  })
  .help('help');
const mainArgv = arg.argv;


// Update config
config.verbose = mainArgv.v;
config.watch = mainArgv.watch;


// Handle env
if (mainArgv.env) {
  config.env = mainArgv.env;
}
envLoader.loadEnv(config.env);


if (config.isKarma) {
  // Karma support
  config.karma.port = mainArgv.port;
  config.karma.files = mainArgv.files;
  config.karma.configFilePath = mainArgv.config;
  const karmaIntegration = jsioWebpack.karmaIntegration;
  karmaIntegration.runKarma();
} else if (config.isInstallLibs) {
  config.installLibs.submodules = mainArgv.submodules;
  const installLibs = jsioWebpack.installLibs;
  installLibs.run();
} else {
  // Normal
  config.serve.useHMR = mainArgv.hot;
  config.serve.port = mainArgv.port;
  // Start it up!
  jsioWebpack.build();
}
