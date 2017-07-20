'use strict';
const path = require('path');
// const jsioWebpack = require('@blackstormlabs/jsio-webpack-v1');


const mainConfigure = function (configurator, options) {
  const backendBuild = true;

  configurator.merge({
    entry: {
      jsioWebpack: path.resolve(__dirname, 'src', 'index')
    },
    output: {
      filename: '[name].js',
      path: path.resolve(__dirname, 'dist'),
      publicPath: '/dist/',
      libraryTarget: 'commonjs'
    }
  });

  options.backendBuild = backendBuild;
  options.devtool = 'source-map';

  options.nodeExternalsOpts.modulesFromFile = true;

  options.useDefinePlugin = false;
  options.envWhitelist = [];

  options.ifdefOpts = {
    GCF_BUILD: backendBuild
  };

  return configurator;
};


const mainPostConfigure = function (configurator, options) {};


const mainConf = {
  configure: mainConfigure,
  postConfigure: mainPostConfigure
};


module.exports = [
  mainConf
];
