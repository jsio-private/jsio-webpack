import { default as Configurator, WebpackConfig } from './Configurator';
import { UserConfig } from './builder/builderConfig';
import Promise from 'bluebird';

import serveGen from './multiConfGenerators/serve';
import productionGen from './multiConfGenerators/production';
import watchGen from './multiConfGenerators/watch';
import commonGen from './multiConfGenerators/common';
import { LoaderRule } from 'webpack';


export type MultiConfOptions = {
  useStylus: boolean;
  useStylusExtractText: boolean;
  useVendorChunk: boolean;
  useFonts: boolean;
  useBase64FontLoader: boolean;
  useReactHot: boolean;
  backendBuild: boolean;
  backendOptions: {
    useSourceMapSupport: boolean|'development';
    useNodeExternals: boolean;
  };
  devtool: string|false;
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
  ifdefOpts: { [key: string]: any; },
  useTypescript: boolean;
  tsLoader: 'awesome-typescript-loader'|'ts-loader';
  useJSX: boolean;
  useEsLint: boolean;
  useLodashIntegrations: boolean;
};


export type ConfigFunction = {
  (configurator: Configurator, options: MultiConfOptions): void|Promise<void>;
};


export default class MultiConf {
  public configurator: Configurator;
  public options: MultiConfOptions;
  public userConfig: UserConfig;

  constructor(userConfig: UserConfig) {
    this.userConfig = userConfig;

    this.configurator = new Configurator();

    this.options = {
      // Stylus
      useStylus: false,
      useStylusExtractText: false,
      // Fonts
      useFonts: false,
      useBase64FontLoader: false,
      // Typescript
      useTypescript: true,
      tsLoader: 'awesome-typescript-loader',
      typescriptIgnoreDiagnostics: [
        // Module 'xxx' has no default export.
        1192,
        // Module 'xxx' has no exported member 'default'.
        2305,
        // Cannot find module
        2307
      ],
      // Misc
      useVendorChunk: false,
      useReactHot: false,
      backendBuild: false,
      backendOptions: {
        useSourceMapSupport: 'development',
        useNodeExternals: true
      },
      useCircularDependencyPlugin: false,
      useNotifications: false,
      useJsonSchema: false,
      useShaders: false,
      devtool: false,
      es2015: 'default',
      useGitRevisionPlugin: 'never',
      useVisualizerPlugin: false,
      nodeExternalsOpts: {
        modulesFromFile: true,
        whitelist: []
      },
      scanLibs: false,
      useModuleAliases: false,
      envWhitelist: [],
      flatProcessEnv: true,
      ifdefOpts: {},
      useJSX: false,
      useEsLint: false,
      useLodashIntegrations: false
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


const CONFIG_FUNCTIONS: {
  [key: string]: ConfigFunction;
} = {
  common: commonGen,
  production: productionGen,
  serve: serveGen,
  watch: watchGen
};

export const getConfigFn = function(name: string): ConfigFunction {
  return CONFIG_FUNCTIONS[name];
};
