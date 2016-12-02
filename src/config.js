module.exports = {
  USER_CONFIG_NAME: 'jsio-webpack.config.js',

  DEFAULT_MULTI_CONF_OPTIONS: {},
  env: process.env.NODE_ENV || 'development',

  devtool: 'eval-source-map',
  // CLI options
  verbose: false,
  isServer: false,
  watch: false,
  useHMR: false,
  port: 8080
};
