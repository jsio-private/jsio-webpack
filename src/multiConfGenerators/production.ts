import { ConfigFunction, Configurator, MultiConfOptions } from '../multiConf';
import webpack from 'webpack';


const buildConfig: ConfigFunction = function(configurator: Configurator, options: MultiConfOptions) {
  configurator.plugin('webpackUglify', webpack.optimize.UglifyJsPlugin, [{
    mangle: {
      keep_fnames: true
    }
  }]);
  configurator.plugin('webpackDedupe', webpack.optimize.DedupePlugin);
};

export default buildConfig;
