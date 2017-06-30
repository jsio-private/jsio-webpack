import webpack from 'webpack';

import { ConfigFunction, Configurator, MultiConfOptions } from '../multiConf';
import config from '../config';


const buildConfig: ConfigFunction = function(configurator: Configurator, options: MultiConfOptions) {
  // Add HMR plugin
  if (config.serve.useHMR) {
    configurator.plugin('webpackHMR', webpack.HotModuleReplacementPlugin);
  }
  // Add sourcemap rules and devServer configs
  configurator.merge({
    devtool: options.devtool || config.devtool,
    devServer: {
      inline: true,
      hot: config.serve.useHMR
    },
    output: {
      pathinfo: true
    }
  });
};

export default buildConfig;
