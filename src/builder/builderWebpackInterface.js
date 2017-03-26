'use strict';
const util = require('util');

const _ = require('lodash');
const Promise = require('bluebird');
const webpack = require('webpack');
const WebpackDevServer = require('webpack-dev-server');

const config = require('../config');
const compilerLogger = require('../compilerLogger');
const builderConfig = require('./builderConfig');


const printConfig = (title, data) => {
  console.log(title);
  console.log(util.inspect(data, { colors: true, depth: 5 }));
  console.log('');
};


const getWebpackConfig = (userConfigs) => {
  return (new Promise((resolve, reject) => {
    if (!userConfigs) {
      userConfigs = builderConfig.getUserConfigs(process.env.PWD);
    } else {
      if (!Array.isArray(userConfigs)) {
        userConfigs = [userConfigs];
      }
    }
    resolve(builderConfig.buildMultiConfs(userConfigs));
  })).then(userDefinitions => {
    const finalWebpackConfig = _.map(userDefinitions, mc => mc.resolve());
    printConfig('Webpack Config:', finalWebpackConfig);
    return finalWebpackConfig;
  });
};


/**
 * @returns Promise<>
 */
const runCompiler = function (
  finalWebpackConfig
) {
  return new Promise((resolve, reject) => {
    let compiler = webpack(finalWebpackConfig);

    const onComplete = function () {
      compilerLogger.apply(null, arguments);
      if (!config.watch) {
        resolve();
      }
    };

    if (config.isServer) {
      const mainConf = finalWebpackConfig[0];
      const publicPath = (
        mainConf &&
        mainConf.output &&
        mainConf.output.publicPath
      );
      if (!publicPath) {
        throw new Error('First webpack config must specify output.publicPath');
      }

      const devServerOpts = {
        // webpack-dev-server options
        contentBase: process.env.PWD,
        hot: config.serve.useHMR,
        historyApiFallback: false,

        // webpack-dev-middleware options
        quiet: false,
        noInfo: false,
        lazy: false,
        // watchOptions: {
        //   aggregateTimeout: 300,
        //   poll: 1000
        // },
        // It's a required option.
        // FIXME: What happens if there is more than one chunk?
        publicPath: publicPath,
        stats: { colors: true }
      };
      printConfig('Dev Server Config:', devServerOpts);
      const server = new WebpackDevServer(compiler, devServerOpts);

      const listenHost = 'localhost';
      const listenPort = config.serve.port;
      console.log(`\n\nStarting server on http://${listenHost}:${listenPort}\n\n`);
      server.listen(listenPort, listenHost, () => {
        console.log('> Server ready');
      });
    } else if (config.watch) {
      // const watcher =
      compiler.watch({
        aggregateTimeout: 300 // wait so long for more changes
      }, onComplete);
    } else {
      compiler.run(onComplete);
    }
  });
};


module.exports = {
  getWebpackConfig: getWebpackConfig,
  runCompiler: runCompiler
};
