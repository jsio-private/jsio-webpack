import { WebpackConfig } from '../Configurator';
import MultiConf from '../multiConf';
import util from 'util';

import debug from 'debug';
import _ from 'lodash';
import Promise from 'bluebird';
import { default as webpack } from 'webpack';
import WebpackDevServer from 'webpack-dev-server';

import config from '../config';
import compilerLogger from '../compilerLogger';
import { buildMultiConfs, getUserConfigs, UserConfig } from './builderConfig';


const log: Function = debug('jsio-webpack:builderWebpackInterface');


const printConfig = (title, data) => {
  console.log(title);
  console.log(util.inspect(data, { colors: true, depth: 10 }));
  console.log('');
};


export const getWebpackConfig = function(
  userConfigs?: UserConfig[]
): Promise<WebpackConfig[]> {
  return new Promise<MultiConf[]>((resolve, reject) => {
    if (!userConfigs) {
      userConfigs = getUserConfigs(process.env.PWD);
    } else {
      if (!Array.isArray(userConfigs)) {
        userConfigs = [userConfigs];
      }
    }
    resolve(buildMultiConfs(userConfigs));
  })
  .then((userDefinitions: MultiConf[]) => {
    const finalWebpackConfig: WebpackConfig[] = userDefinitions.map((mc: MultiConf) => mc.resolve());
    printConfig('Webpack Config:', finalWebpackConfig);
    return finalWebpackConfig;
  });
};


export const runCompiler = function(
  finalWebpackConfig: WebpackConfig[]
): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    log('runCompiler: finalWebpackConfig', finalWebpackConfig, 'config=', config);
    const compiler = webpack(finalWebpackConfig);

    const onComplete = function () {
      compilerLogger.apply(null, arguments);
      if (!config.watch) {
        resolve();
      }
    };

    if (config.isServer) {
      const mainConf = finalWebpackConfig[0];
      const publicPath = (
        mainConf &&
        mainConf.output &&
        mainConf.output.publicPath
      );
      if (!publicPath) {
        throw new Error('First webpack config must specify output.publicPath');
      }

      const devServerOpts = {
        // webpack-dev-server options
        contentBase: process.env.PWD,
        hot: config.serve.useHMR,
        historyApiFallback: false,

        // webpack-dev-middleware options
        quiet: false,
        noInfo: false,
        lazy: false,
        // watchOptions: {
        //   aggregateTimeout: 300,
        //   poll: 1000
        // },
        // It's a required option.
        // FIXME: What happens if there is more than one chunk?
        publicPath: publicPath,
        stats: { colors: true }
      };
      printConfig('Dev Server Config:', devServerOpts);
      const server = new WebpackDevServer(compiler, devServerOpts);

      const listenHost = 'localhost';
      const listenPort = config.serve.port;
      console.log(`\n\nStarting server on http://${listenHost}:${listenPort}\n\n`);
      server.listen(listenPort, listenHost, () => {
        console.log('> Server ready');
      });
    } else if (config.watch) {
      log('Starting watcher');
      compiler.watch({
        aggregateTimeout: 300 // wait so long for more changes
      }, onComplete);
    } else {
      compiler.run(onComplete);
    }
  });
};
