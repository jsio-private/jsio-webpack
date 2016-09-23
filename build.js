#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const webpack = require('webpack');
const webpackMultiConfigurator = require('webpack-multi-configurator');

const jsioWebpack = require('./index');

const NODE_ENV = process.env.NODE_ENV || 'development';


const pwd = process.env.PWD;
const userWebpackPath = path.resolve(pwd, 'jsio-webpack.config.js');
let userWebpackConfig;

if (fs.existsSync(userWebpackPath)) {
  userWebpackConfig = require(userWebpackPath);
}


const DEFAULT_OPTIONS = {};
const multiConf = webpackMultiConfigurator(DEFAULT_OPTIONS);


multiConf.define('production')
  .append((conf) => {
    conf.plugin('webpackUglify', webpack.optimize.UglifyJsPlugin);
    conf.plugin('webpackDedupe', webpack.optimize.DedupePlugin);
    return conf;
  });


const common = multiConf.define('common')
  .append(jsioWebpack.generateCommonConfig);
if (NODE_ENV === 'production') {
  common.append('production');
}


multiConf.define('app')
  .generate(appGenerator)
  .append('common');



function appGenerator (factory, options) {
  return userWebpackConfig(factory(), options);
};


multiConf.otherwise('app');

const finalWebpackConfig = multiConf.resolve();
console.log('Final config:', finalWebpackConfig);

console.log('\nBuilding...\n');
const compiler = webpack(finalWebpackConfig);
compiler.run((err, stats) => {
  if (err) {
    console.error('Error while building');
    console.error(err.stack);
    return;
  }
  console.log('stats', stats.toString({ colors: true }));
});
