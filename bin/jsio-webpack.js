#!/usr/bin/env node
'use strict';

const yargs = require('yargs');

const config = require('../src/config');
const builder = require('../src/builder');


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
    type: 'boolean',
    default: false
  })
  .command('serve', 'Watch files, compile on change, serve from memory using webpack-dev-server', (yargs) => {
    arg = yargs
      .option('h', {
        alias: 'hot',
        description: 'Use webpacks HotModuleReplacementPlugin',
        default: config.useHMR
      })
      .option('p', {
        alias: 'port',
        description: 'Port for the webpack-dev-server to listen on',
        default: config.port
      })
      .help('help');
    config.isServer = true;
  })
  .help('help');
const mainArgv = arg.argv;

// Update config
config.verbose = mainArgv.v;
config.watch = mainArgv.watch;
config.useHMR = mainArgv.hot;
config.port = mainArgv.port;

// Start it up!
builder.start();
