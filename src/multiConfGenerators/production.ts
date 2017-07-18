import { ConfigFunction, MultiConfOptions } from '../multiConf';
import Configurator from '../Configurator';
import webpack from 'webpack';
// import BabiliPlugin from 'babili-webpack-plugin';
// import babelCore from 'babel-core';


const buildConfig: ConfigFunction = function(configurator: Configurator, options: MultiConfOptions) {
  // TODO: Babili fails to mangle with a memory exception.  For now just use uglify.
  // See: https://github.com/babel/babili/issues/332
  // configurator.plugin('babili', BabiliPlugin, [{
  //   mangle: {
  //     keepFnName: true,
  //     keepClassName: true
  //   }
  // }, {
  //   babel: babelCore
  // }]);

  configurator.plugin('uglify', webpack.optimize.UglifyJsPlugin, [{
    mangle: {
      keep_fnames: true
    }
  }]);
};

export default buildConfig;
