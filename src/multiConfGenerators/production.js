const webpack = require('webpack');


module.exports = (conf) => {
  conf.plugin('webpackUglify', webpack.optimize.UglifyJsPlugin);
  conf.plugin('webpackDedupe', webpack.optimize.DedupePlugin);
  return conf;
};
