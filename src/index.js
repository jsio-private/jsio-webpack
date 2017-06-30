'use strict';
const webpack = require('webpack');

const builder = require('./builder');
const builderWebpackInterface = require('./builder/builderWebpackInterface');
const persistentRunner = require('./persistentRunner');
const compilerLogger = require('./compilerLogger');
const config = require('./config');
const envLoader = require('./envLoader');
const installLibs = require('./installLibs');
const karmaIntegration = require('./karmaIntegration');


const configure = (opts) => {
  throw new Error('TODO');
};


module.exports = {
  // Exports
  config: config,
  envLoader: envLoader,
  configure: configure,
  installLibs: installLibs,
  builder: builder,
  builderWebpackInterface: builderWebpackInterface,
  persistentRunner: persistentRunner,
  compilerLogger: compilerLogger,
  karmaIntegration: karmaIntegration,
  // Libraries
  webpack: webpack,
  // Functions
  build: builder.start
};
