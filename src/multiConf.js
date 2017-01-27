const WebpackConfigurator = require('webpack-configurator');
const Promise = require('bluebird');

const serveGen = require('./multiConfGenerators/serve');
const productionGen = require('./multiConfGenerators/production');
const watchGen = require('./multiConfGenerators/watch');
const commonGen = require('./multiConfGenerators/common');


class MultiConf {
  constructor () {
    this.configurator = new WebpackConfigurator();
    this.options = {
      useStylusExtractText: false,
      useVendorChunk: false,
      useBase64FontLoader: false,
      useReactHot: false,
      backendBuild: false,
      useCircularDependencyPlugin: false,
      useNotifications: false,
      useJsonSchema: false,
      useShaders: false,
      es2015: 'default',
      useGitRevisionPlugin: 'never',
      useVisualizerPlugin: false,
      typescriptIgnoreDiagnostics: [
        // Module 'xxx' has no default export.
        1192,
        // Module 'xxx' has no exported member 'default'.
        2305,
        // Cannot find module
        2307
      ],
      nodeExternalsOpts: {
        modulesFromFile: true
      },
      scanLibs: false,
      useModuleAliases: false,
      envWhitelist: [],
      flatProcessEnv: true
    };
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
