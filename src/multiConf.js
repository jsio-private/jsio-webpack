const WebpackConfigurator = require('webpack-configurator');
const Promise = require('bluebird');

const serveGen = require('./multiConfGenerators/serve');
const productionGen = require('./multiConfGenerators/production');
const watchGen = require('./multiConfGenerators/watch');
const commonGen = require('./multiConfGenerators/common');


class MultiConf {
  constructor () {
    this.configurator = new WebpackConfigurator();
    this.options = {};
  }

  append (configFn) {
    return new Promise((resolve, reject) => {
      const res = configFn(this.configurator, this.options);
      if (res && res.then) {
        res.then(() => {
          resolve();
        });
      } else {
        resolve();
      }
    });
  }

  resolve () {
    return this.configurator.resolve();
  }
}


const CONFIG_FUNCTIONS = {
  common: commonGen,
  production: productionGen,
  serve: serveGen,
  watch: watchGen
};

const getConfigFn = (name) => {
  return CONFIG_FUNCTIONS[name];
};


module.exports = {
  MultiConf: MultiConf,
  getConfigFn: getConfigFn
};
