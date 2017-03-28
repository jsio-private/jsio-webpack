'use strict';
const webpack = require('webpack');

const builder = require('./builder');
const builderWebpackInterface = require('./builder/builderWebpackInterface');
const persistentRunner = require('./persistentRunner');
const compilerLogger = require('./compilerLogger');

const configure = (opts) => {
  throw new Error('TODO');
};

module.exports = {
  configure: configure,
  builder: builder,
  builderWebpackInterface: builderWebpackInterface,
  build: builder.start,
  persistentRunner: persistentRunner,
  compilerLogger: compilerLogger,
  webpack: webpack
};
