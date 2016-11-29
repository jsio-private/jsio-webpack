const webpack = require('webpack');

const config = require('../config');

module.exports = (conf, options) => {
  // Add HMR plugin
  if (config.useHMR) {
    conf.plugin('webpackHMR', webpack.HotModuleReplacementPlugin);
  }
  // Add sourcemap rules and devServer configs
  conf.merge({
    devtool: options.devtool || config.devtool,
    devServer: {
      inline: true,
      hot: config.useHMR
    },
    output: {
      pathinfo: true
    }
  });
  return conf;
};
