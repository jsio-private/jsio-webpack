'use strict';
const fs = require('fs');
const path = require('path');

const Promise = require('bluebird');
const _ = require('lodash');

const config = require('../config');
const multiConf = require('../multiConf');

import dynamicRequire from '../dynamicRequire';


const getUserConfigs = (dir) => {
  const userWebpackPath = path.resolve(dir, config.USER_CONFIG_NAME);

  if (!fs.existsSync(userWebpackPath)) {
    throw new Error('Missing user webpack config: ' + userWebpackPath);
  }

  const userWebpackConfig = dynamicRequire(userWebpackPath);
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
      configs.push(multiConf.getConfigFn('production'));
    }
    if (config.isServer) {
      configs.push(multiConf.getConfigFn('serve'));
    } else if (config.watch) {
      configs.push(multiConf.getConfigFn('watch'));
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
        const webpackConfig = multiConf.configurator._config;
        _.forEach(webpackConfig.entry, (v, k) => {
          const newEntries = []
          newEntries.push(`webpack-dev-server/client?http://${config.serve.host}:${config.serve.port}/`);
          if (config.serve.useHMR) {
            newEntries.push('webpack/hot/only-dev-server');
          }
          // Put the old one back
          newEntries.push(v);
          webpackConfig.entry[k] = newEntries;
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


module.exports = {
  getUserConfigs: getUserConfigs,
  buildMultiConfs: buildMultiConfs
};
