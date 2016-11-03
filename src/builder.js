'use strict';
const fs = require('fs');
const path = require('path');
const util = require('util');

const Promise = require('bluebird');
const webpack = require('webpack');
const WebpackDevServer = require('webpack-dev-server');
const _ = require('lodash');

const config = require('./config');
const multiConf = require('./multiConf');
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


const buildMultiConfs = (userConfigs) => {
  return Promise.map(userConfigs, (userConfig) => {
    const _multiConf = new multiConf.MultiConf();
    _multiConf.userConfig = userConfig;

    const userConfiguratorFn = userConfig.configure || userConfig;
    const configs = [
      userConfiguratorFn,
      multiConf.getConfigFn('common')
    ];

    if (config.env === 'production') {
      configs.push('production');
    }
    if (config.isServer) {
      configs.push('serve');
    } else if (config.watch) {
      configs.push('watch');
    }

    return Promise.map(configs, c => {
      return _multiConf.append(c);
    }, { concurrency: 1 }).then(() => {
      return _multiConf;
    });
  }, { concurrency: 1 }).then(multiConfs => {
    return Promise.map(multiConfs, (multiConf) => {
      // Apply some stuff after
      if (config.isServer) {
        _.forEach(multiConf._config.entry, (v, k) => {
          const newEntries = []
          newEntries.push('webpack-dev-server/client?http://localhost:8080/');
          if (config.useHMR) {
            newEntries.push('webpack/hot/only-dev-server');
          }
          // Put the old one back
          newEntries.push(v);
          multiConf._config.entry[k] = newEntries;
        });
      }
      return multiConf;
    });
  }).then(multiConfs => {
    return Promise.map(multiConfs, (multiConf) => {
      // Let the project customize the final config before generation
      const postConfigureFn = multiConf.userConfig.postConfigure;
      if (postConfigureFn) {
        return multiConf.append(postConfigureFn).then(() => multiConf);
      }

      // Finalize
      return multiConf;
    });
  });
};


const printConfig = (title, data) => {
  console.log(title);
  console.log(util.inspect(data, { colors: true, depth: 5 }));
  console.log('');
};


const getWebpackConfig = (userConfigs) => {
  return (new Promise((resolve, reject) => {
    if (!userConfigs) {
      userConfigs = getUserConfigs(process.env.PWD);
    } else {
      if (!Array.isArray(userConfigs)) {
        userConfigs = [userConfigs];
      }
    }
    resolve(buildMultiConfs(userConfigs));
  })).then(userDefinitions => {
    const finalWebpackConfig = _.map(userDefinitions, mc => mc.resolve());
    printConfig('Webpack Config:', finalWebpackConfig);
    return finalWebpackConfig;
  });
};


const start = (userConfigs, cb) => {
  return getWebpackConfig(userConfigs).then((finalWebpackConfig) => {
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
      // const watcher =
      compiler.watch({
        aggregateTimeout: 300 // wait so long for more changes
      }, onComplete);
    } else {
      compiler.run(onComplete);
    }
  });
}


module.exports = {
  start: start,
  getWebpackConfig: getWebpackConfig
};
