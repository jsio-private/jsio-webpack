'use strict';
const _ = require('lodash');

const config = require('../config');
const builderWebpackInterface = require('./builderWebpackInterface');


process.on('message', function (data) {
  const webpackConfigIndex = data.webpackConfigIndex;
  console.log('Worker started for:', webpackConfigIndex);

  if (data.config) {
    // Merge in to this config
    _.forEach(data.config, (v, k) => {
      config[k] = v;
    });
  }

  builderWebpackInterface.getWebpackConfig()
  .then((finalWebpackConfigs) => {
    if (!Array.isArray(finalWebpackConfigs)) {
      throw new Error(`finalWebpackConfigs is not array: ${typeof finalWebpackConfigs}`);
    }

    const targetWebpackConfig = finalWebpackConfigs[webpackConfigIndex];
    console.log('Webpack config:', targetWebpackConfig);
    return builderWebpackInterface.runCompiler(targetWebpackConfig);
  })
  .then(() => {
    process.send({ error: null });
  })
  .catch((err) => {
    process.send({
      error: {
        name: err.name,
        message: err.message,
        stack: err.stack
      }
    });
  });
});
