import { WebpackConfig } from '../Configurator';
import _ from 'lodash';

import config from '../config';
import { getWebpackConfig, runCompiler } from './builderWebpackInterface';


process.on('message', function (data) {
  const webpackConfigIndex = data.webpackConfigIndex;
  console.log('Worker started for:', webpackConfigIndex);

  if (data.config) {
    // Merge in to this config
    _.forEach(data.config, (v, k) => {
      config[k] = v;
    });
  }

  getWebpackConfig()
  .then((finalWebpackConfigs: WebpackConfig[]) => {
    if (!Array.isArray(finalWebpackConfigs)) {
      throw new Error(`finalWebpackConfigs is not array: ${typeof finalWebpackConfigs}`);
    }

    const targetWebpackConfig: WebpackConfig = finalWebpackConfigs[webpackConfigIndex];
    console.log('Webpack config:', targetWebpackConfig);
    return runCompiler([targetWebpackConfig]);
  })
  .then(() => {
    process.send({ error: null });
  })
  .catch((err: Error) => {
    process.send({
      error: {
        name: err.name,
        message: err.message,
        stack: err.stack
      }
    });
  });
});
