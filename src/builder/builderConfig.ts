'use strict';
import { WebpackConfig } from './builderWebpackInterface';
import { default as MultiConf, getConfigFn, ConfigFunction } from '../multiConf';
import fs from 'fs';
import path from 'path';

import Promise from 'bluebird';
import _ from 'lodash';

import config from '../config';
import multiConf from '../multiConf';

import dynamicRequire from '../dynamicRequire';


export type Configurator = {};


export type UserConfig = {
  configure: ConfigFunction;
  postConfigure: ConfigFunction;
};


export const getUserConfigs = (dir: string): UserConfig[] => {
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


export const buildMultiConfs = function(userConfigs: UserConfig[]): Promise<MultiConf[]> {
  return Promise.map(userConfigs, (userConfig: UserConfig) => {
    const _multiConf = new MultiConf(userConfig);

    const userConfiguratorFn = userConfig.configure || userConfig;
    const configs = [
      userConfiguratorFn,
      getConfigFn('common')
    ];

    if (config.env === 'production') {
      configs.push(getConfigFn('production'));
    }
    if (config.isServer) {
      configs.push(getConfigFn('serve'));
    } else if (config.watch) {
      configs.push(getConfigFn('watch'));
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
  })
  .then((multiConfs: MultiConf[]) => {
    return Promise.map(multiConfs, (multiConf: MultiConf) => {
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
