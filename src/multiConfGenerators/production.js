const webpack = require('webpack');


module.exports = (conf) => {
  conf.plugin('webpackUglify', webpack.optimize.UglifyJsPlugin, [{
    mangle: {
      keep_fnames: true
    }
  }]);
  conf.plugin('webpackDedupe', webpack.optimize.DedupePlugin);
  return conf;
};
