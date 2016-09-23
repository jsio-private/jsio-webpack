const webpackMultiConfigurator = require('webpack-multi-configurator');

const config = require('./config');

const serveGen = require('./multiConfGenerators/serve');
const productionGen = require('./multiConfGenerators/production');
const watchGen = require('./multiConfGenerators/watch');
const commonGen = require('./multiConfGenerators/common');


const newMultiConf = () => {
  const multiConf = webpackMultiConfigurator(config.DEFAULT_MULTI_CONF_OPTIONS);

  multiConf
    .define('serve')
      .append(serveGen)
    .define('production')
      .append(productionGen)
    .define('watch')
      .append(watchGen);

  const commonMConf = multiConf
    .define('common')
      .append(commonGen);

  if (config.env === 'production') {
    commonMConf.append('production');
  }
  if (config.isServer) {
    commonMConf.append('serve');
  } else if (config.watch) {
    commonMConf.append('watch');
  }

  return multiConf;
};


module.exports = {
  newMultiConf: newMultiConf
};
