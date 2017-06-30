import { getWebpackConfig } from '../builder/builderWebpackInterface';
import util from 'util';
import crypto from 'crypto';

import webpack from 'webpack';
import debug from 'debug';

import PersistentRunner from './PersistentRunner';


/**
 * https://github.com/webpack/webpack/blob/master/lib/webpack.js#L13
 */
const fakeWebpack = function(options) {
  const WebpackOptionsDefaulter = webpack.WebpackOptionsDefaulter;
  const MultiCompiler = webpack.MultiCompiler;
  // const validateWebpackOptions = webpack.validate;
  // const WebpackOptionsValidationError = require('webpack/WebpackOptionsValidationError');

  // var webpackOptionsValidationErrors = validateWebpackOptions(options);
  // if (webpackOptionsValidationErrors.length) {
  //   // throw new WebpackOptionsValidationError(webpackOptionsValidationErrors);
  //   throw new Error(webpackOptionsValidationErrors);
  // }
  var compiler;
  if (Array.isArray(options)) {
    compiler = new MultiCompiler(options.map((options) => {
      return fakeWebpack(options);
    }));
  } else if (typeof options === 'object') {
    new WebpackOptionsDefaulter().process(options);

    const id = hashConfig(options);
    compiler = getMultiUseRunner(id, options);
  } else {
    throw new Error('Invalid argument: options');
  }
  return compiler;
};


const _RUNNERS = {};

const getRunner = function(id) {
  return _RUNNERS[id];
};

const setRunner = function(id, runner) {
  _RUNNERS[id] = runner;
};


const hashConfig = function(config) {
  const md5 = crypto.createHash('md5');
  const s = util.inspect(config);
  md5.update(s);
  return md5.digest('hex');
};


const getCompiler = function(config) {
  const Compiler = webpack.Compiler;
  const NodeEnvironmentPlugin = webpack.NodeEnvironmentPlugin;
  const WebpackOptionsApply = webpack.WebpackOptionsApply;

  const compiler = new Compiler();
  compiler.options = config;
  compiler.options = new WebpackOptionsApply().process(config, compiler);
  new NodeEnvironmentPlugin().apply(compiler);
  compiler.applyPlugins('environment');
  compiler.applyPlugins('after-environment');

  return compiler;
};


const getMultiUseRunner = function(id, config) {
  const newConfigHash = hashConfig(config);

  const existingRunner = getRunner(id);
  let needsNewRunner = !(
    existingRunner &&
    existingRunner.configHash === newConfigHash
  );

  let runner;
  if (needsNewRunner) {
    const compiler = getCompiler(config);
    runner = new PersistentRunner(compiler);
    setRunner(id, {
      runner: runner,
      // TODO: setRunner should know how to generate the hash
      configHash: newConfigHash
    });
  } else {
    runner = existingRunner.runner;
  }

  return runner;
};
