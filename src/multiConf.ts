import { UserConfig } from './builder/builderConfig';
import { WebpackConfig } from './builder/builderWebpackInterface';
import WebpackConfigurator from 'webpack-configurator';
import Promise from 'bluebird';

import serveGen from './multiConfGenerators/serve';
import productionGen from './multiConfGenerators/production';
import watchGen from './multiConfGenerators/watch';
import commonGen from './multiConfGenerators/common';


export type MultiConfOptions = {
  useStylusExtractText: boolean;
  useVendorChunk: boolean;
  useBase64FontLoader: boolean;
  useReactHot: boolean;
  backendBuild: boolean;
  useCircularDependencyPlugin: boolean;
  useNotifications: boolean;
  useJsonSchema: boolean;
  useShaders: boolean;
  es2015: string;
  useGitRevisionPlugin: string;
  useVisualizerPlugin: boolean;
  typescriptIgnoreDiagnostics: number[];
  nodeExternalsOpts: {
    modulesFromFile: true,
    whitelist: string[];
  };
  scanLibs: boolean;
  useModuleAliases: boolean;
  envWhitelist: string[];
  flatProcessEnv: true,
  ifdefOpts: { [key: string]: any; }
};


export type Configurator = {};


export type ConfigFunction = {
  (configurator: Configurator, options: MultiConfOptions): void|Promise<void>;
};


export default class MultiConf {
  public configurator;
  public options: MultiConfOptions;
  public userConfig: UserConfig;

  constructor(userConfig: UserConfig) {
    this.userConfig = userConfig;

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
        modulesFromFile: true,
        whitelist: []
      },
      scanLibs: false,
      useModuleAliases: false,
      envWhitelist: [],
      flatProcessEnv: true,
      ifdefOpts: {}
    };
  }

  public append(configFn: ConfigFunction): Promise<void> {
    return new Promise<void>((resolve, reject) => {
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

  public resolve(): WebpackConfig {
    return this.configurator.resolve();
  }
}


const CONFIG_FUNCTIONS = {
  common: commonGen,
  production: productionGen,
  serve: serveGen,
  watch: watchGen
};

export const getConfigFn = (name) => {
  return CONFIG_FUNCTIONS[name];
};
