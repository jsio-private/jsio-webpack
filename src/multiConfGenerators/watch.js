const config = require('../config');


module.exports = (conf) => {
  conf.merge({
    devtool: config.devtool,
    watch: true,
    output: {
      pathinfo: true
    }
  });
  return conf;
};
