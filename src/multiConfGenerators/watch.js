const config = require('../config');


module.exports = (conf, options) => {
  conf.merge({
    devtool: options.devtool || config.devtool,
    watch: true,
    output: {
      pathinfo: true
    }
  });
  return conf;
};
