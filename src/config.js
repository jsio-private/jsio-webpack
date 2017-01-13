module.exports = {
  USER_CONFIG_NAME: 'jsio-webpack.config.js',

  DEFAULT_MULTI_CONF_OPTIONS: {},
  env: process.env.NODE_ENV || 'development',

  devtool: 'eval-source-map',
  // CLI options
  verbose: false,
  watch: false,
  isServer: false,
  serve: {
    useHMR: false,
    host: 'localhost',
    port: 8080
  },
  // Karma
  isKarma: false,
  karma: {
    port: 9876,
    files: 'tests/index.js',
    preprocessorKeys: 'tests,src'
  },
  // postinstall libs
  isInstallLibs: false,
  installLibs: {
    submodules: false
  }
};
