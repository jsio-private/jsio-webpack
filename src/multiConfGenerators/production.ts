import { ConfigFunction, MultiConfOptions } from '../multiConf';
import Configurator from '../Configurator';
import webpack from 'webpack';
import BabiliPlugin from 'babili-webpack-plugin';
import dynamicRequire from '../dynamicRequire';
import babelCore from 'babel-core';


const buildConfig: ConfigFunction = function(configurator: Configurator, options: MultiConfOptions) {
  configurator.plugin('babili', BabiliPlugin, [{
    mangle: {
      keepFnName: true,
      keepClassName: true
    }
  }, {
    babel: babelCore
  }]);
};

export default buildConfig;
