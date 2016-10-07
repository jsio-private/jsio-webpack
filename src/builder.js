'use strict';

const fs = require('fs');
const path = require('path');
const util = require('util');

const webpack = require('webpack');
const WebpackDevServer = require('webpack-dev-server');
const _ = require('lodash');

const config = require('./config');
const newMultiConf = require('./multiConf').newMultiConf;
const compilerLogger = require('./compilerLogger');


const getUserConfigs = (dir) => {
  const userWebpackPath = path.resolve(dir, config.USER_CONFIG_NAME);

  if (!fs.existsSync(userWebpackPath)) {
    throw new Error('Missing user webpack config: ' + userWebpackPath);
  }

  const userWebpackConfig = require(userWebpackPath);
  if (Array.isArray(userWebpackConfig)) {
    return userWebpackConfig;
  } else {
    return [userWebpackConfig];
  }
};


const appGenerator = (userConfig) => {
  return (factory, options) => {
    const userConfigurator = factory();
    let userConfiguratorFn = userConfig.configure || userConfig;
    const conf = userConfiguratorFn(userConfigurator, options);

    // Apply some stuff after
    if (config.isServer) {
      _.forEach(conf._config.entry, (v, k) => {
        const newEntries = []
        newEntries.push('webpack-dev-server/client?http://localhost:8080/');
        if (config.useHMR) {
          newEntries.push('webpack/hot/only-dev-server');
        }
        // Put the old one back
        newEntries.push(v);
        conf._config.entry[k] = newEntries;
      });
    }

    return conf;
  };
};


const buildUserDefinitions = (multiConf, userConfigs) => {
  return _.map(userConfigs, (userConfig, i) => {
    const appConfName = 'app' + i;
    const appConf = multiConf.define(appConfName);
    appConf.generate(appGenerator(userConfig));
    appConf.append('common');

    // Let the project customize the final config before generation
    const postConfigure = userConfig.postConfigure;
    if (postConfigure) {
      appConf.append(postConfigure);
    }

    return {
      name: appConfName,
      appConf: appConf
    }
  });
};


const printConfig = (title, data) => {
  console.log(title);
  console.log(util.inspect(data, { colors: true, depth: 5 }));
  console.log('');
};


const start = (userConfigs, cb) => {
  if (!userConfigs) {
    userConfigs = getUserConfigs(process.env.PWD);
  } else {
    if (!Array.isArray(userConfigs)) {
      userConfigs = [userConfigs];
    }
  }

  const multiConf = newMultiConf();

  const userDefinitions = buildUserDefinitions(multiConf, userConfigs);

  multiConf.otherwise(_.map(userDefinitions, o => o.name).join('+'));

  const finalWebpackConfig = multiConf.resolve();
  printConfig('Webpack Config:', finalWebpackConfig);

  console.log('\nBuilding...\n');

  let compiler = webpack(finalWebpackConfig);

  const onComplete = function () {
    compilerLogger.apply(null, arguments);
    cb && cb();
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
      hot: config.useHMR,
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

    console.log('Starting server');
    server.listen(8080, 'localhost', () => {
      console.log('> Server ready');
    });
  } else if (config.watch) {
    compiler = webpack(finalWebpackConfig);
    // const watcher =
    compiler.watch({
      aggregateTimeout: 300 // wait so long for more changes
    }, onComplete);
  } else {
    compiler = webpack(finalWebpackConfig);
    compiler.run(onComplete);
  }
}


module.exports = {
  start: start
};
