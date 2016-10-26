'use strict';
const util = require('util');
const crypto = require('crypto');

const webpack = require('webpack');
const debug = require('debug');

const builder = require('../builder');
const PersistentRunner = require('./PersistentRunner');

/**
 * https://github.com/webpack/webpack/blob/master/lib/webpack.js#L13
 */
const fakeWebpack = (options) => {
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

const getRunner = (id) => {
  return _RUNNERS[id];
};

const setRunner = (id, runner) => {
  _RUNNERS[id] = runner;
};


const hashConfig = (config) => {
  const md5 = crypto.createHash('md5');
  const s = util.inspect(config);
  md5.update(s);
  return md5.digest('hex');
};


const getCompiler = (config) => {
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


const getMultiUseRunner = (id, config) => {
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


/**
 * @param  {Object} conf - goes to the runner
 * @return {PersistentRunner}
 */
// const getMultiUseRunner = (id, userConfigs) => {
//   const webpackConfig = builder.getWebpackConfig(userConfigs);
//   const newConfigHash = hashConfig(webpackConfig);

//   const existingRunner = getRunner(id);
//   let needsNewRunner = !(
//     existingRunner &&
//     existingRunner.configHash === newConfigHash
//   );

//   let runner;
//   if (needsNewRunner) {
//     const compiler = getCompiler(webpackConfig);
//     // const compiler = webpack(webpackConfig);
//     runner = new PersistentRunner(compiler);
//     setRunner(id, {
//       runner: runner,
//       // TODO: setRunner should know how to generate the hash
//       configHash: newConfigHash
//     });
//   } else {
//     runner = existingRunner.runner;
//   }

//   return runner;
// };


module.exports = {
  // getMultiUseRunner: getMultiUseRunner
  // getMultiUseRunner: (id, userConfigs) => {
  //   if (!Array.isArray(userConfigs)) {
  //     userConfigs = [userConfigs];
  //   }
  //   const webpackConfig = builder.getWebpackConfig(userConfigs);
  //   return fakeWebpack(webpackConfig);
  // }
  getMultiUseRunner: (id, userConfigs) => {
    if (!Array.isArray(userConfigs)) {
      userConfigs = [userConfigs];
    }
    const webpackConfig = builder.getWebpackConfig(userConfigs);

    const runner = new PersistentRunner();

    return { run: cb => {

    }};
  }
  // getMultiUseRunner: (id, userConfigs) => {
  //   if (!Array.isArray(userConfigs)) {
  //     userConfigs = [userConfigs];
  //   }
  //   const webpackConfig = builder.getWebpackConfig(userConfigs);
  //   const compiler = webpack(webpackConfig);

  //   return {
  //     run: (cb) => {
  //       const watcher = compiler.watch({}, (err, stats) => {
  //         watcher.close(() => {
  //           cb && cb(err, stats);
  //         });
  //       });
  //     }
  //   };
  // }
};
