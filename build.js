#!/usr/bin/env node
'use strict';

const fs = require('fs');
const path = require('path');
const util = require('util');

const webpack = require('webpack');
const webpackMultiConfigurator = require('webpack-multi-configurator');
const WebpackDevServer = require('webpack-dev-server');
const yargs = require('yargs');
const chalk = require('chalk');
const _ = require('lodash');

const jsioWebpack = require('./index');

const NODE_ENV = process.env.NODE_ENV || 'development';



let arg = yargs
  .option('v', {
    description: 'Enable verbose logging',
    default: false,
    type: 'boolean'
  }).option('w', {
    alias: 'watch',
    description: 'Watch files, compile on change',
    type: 'boolean',
    default: false
  }).option('s', {
    alias: 'serve',
    description: 'Watch files, compile on change, serve from memory using webpack-dev-server',
    type: 'boolean',
    default: false
  })
  .help('h');
let mainArgv = arg.argv;



const pwd = process.env.PWD;
const userWebpackPath = path.resolve(pwd, 'jsio-webpack.config.js');
let userWebpackConfig;

if (fs.existsSync(userWebpackPath)) {
  userWebpackConfig = require(userWebpackPath);
}


const DEFAULT_DEVTOOL = 'eval-source-map';


const DEFAULT_OPTIONS = {};
const multiConf = webpackMultiConfigurator(DEFAULT_OPTIONS);


const prodConf = multiConf.define('production');
prodConf.append((conf) => {
  conf.plugin('webpackUglify', webpack.optimize.UglifyJsPlugin);
  conf.plugin('webpackDedupe', webpack.optimize.DedupePlugin);
  return conf;
});


const serveConf = multiConf.define('serve');
serveConf.append((conf) => {
  _.forEach(conf.entry, (v, k) => {
    // 'webpack/hot/only-dev-server', 'webpack-dev-server/client?http://0.0.0.0:8080'
    conf.entry[k] = [
      'webpack/hot/only-dev-server',
      'webpack-dev-server/client?http://localhost:8080/',
      v
    ];
  });
  // Add HMR plugin
  conf.plugin('webpackHMR', webpack.HotModuleReplacementPlugin);
  // Add sourcemap rules and devServer configs
  conf.merge({
    devtool: DEFAULT_DEVTOOL,
    devServer: {
      inline: true,
      hot: true
    },
    output: {
      pathinfo: true
    }
  });
  return conf;
});


const watchConf = multiConf.define('watch');
watchConf.append((conf) => {
  conf.merge({
    devtool: DEFAULT_DEVTOOL,
    watch: true,
    output: {
      pathinfo: true
    }
  });
  return conf;
});


const commonConf = multiConf.define('common');
commonConf.append(jsioWebpack.generateCommonConfig);
// 'common' gets 'production' automatically
if (NODE_ENV === 'production') {
  commonConf.append('production');
}
if (mainArgv.serve) {
  commonConf.append('serve');
} else if (mainArgv.watch) {
  commonConf.append('watch');
}


const appConf = multiConf.define('app');
appConf.generate(appGenerator);
appConf.append('common');


// Let the project customize the final config before generation
if (typeof userWebpackConfig === 'object') {
  if (userWebpackConfig.postConfigure) {
    appConf.append(userWebpackConfig.postConfigure);
  }
}


function appGenerator (factory, options) {
  const userConfigurator = factory();
  let userConfiguratorFn;
  if (typeof userWebpackConfig === 'object') {
    userConfiguratorFn = userWebpackConfig.configure;
  } else {
    userConfiguratorFn = userWebpackConfig;
  }
  const conf = userConfiguratorFn(userConfigurator, options);
  return conf;
};


multiConf.otherwise('app');

const finalWebpackConfig = multiConf.resolve();
console.log('Config ready:');
console.log(util.inspect(finalWebpackConfig, { colors: true, depth: 4 }));


// LOGGING UTILS
const handleFatalError = (err) => {
  console.error('Fatal Error:');
  console.error(err.stack);
};

const handleSoftErrors = (errors) => {
  console.error('Soft Errors:')
  errors.forEach(err => {
    let s = chalk.red(err.message);
    if(err.details) {
      s += '\n' + chalk.yellow(err.details);
    }
    s += '\n';
    console.error(s);
  });
};

const handleWarnings = (warnings) => {
  console.warn('Warnings:');
  warnings.forEach(warning => console.warn(warning.message));
};

const successfullyCompiled = (stats) => {
  console.log('Stats:');
  console.log(stats.toString({ colors: true }));
};

const pprintStats = (stats) => {
  // Handle multistats
  if (Array.isArray(stats.stats)) {
    stats.stats.forEach(pprintStats);
    return;
  }

  const compilation = stats.compilation;

  if (stats.hasErrors()) {
    return handleSoftErrors(compilation.errors);
  }
  // NOTE: Warnings are handled by stats.toString()
  // If we stop using that, add this back
  // if (stats.hasWarnings()) {
  //   handleWarnings(compilation.warnings);
  // }
  successfullyCompiled(stats);
};

const onBuild = (err, stats) => {
  if (err) {
    return handleFatalError(err);
  }
  pprintStats(stats);
};
//



console.log('\nBuilding...\n');

let compiler = webpack(finalWebpackConfig);

if (mainArgv.serve) {
  const server = new WebpackDevServer(compiler, {
    // webpack-dev-server options
    contentBase: process.env.PWD,
    hot: true,
    historyApiFallback: false,

    // webpack-dev-middleware options
    quiet: false,
    noInfo: false,
    lazy: false,
    filename: 'bundle.js',
    // watchOptions: {
    //   aggregateTimeout: 300,
    //   poll: 1000
    // },
    // It's a required option.
    publicPath: '/',
    stats: { colors: true }
  });

  console.log('Starting server');
  server.listen(8080, 'localhost', function () {
    console.log('> Server ready');
  });
} else if (mainArgv.watch) {
  compiler = webpack(finalWebpackConfig);
  const watcher = compiler.watch({
    aggregateTimeout: 300 // wait so long for more changes
  }, onBuild);
} else {
  compiler = webpack(finalWebpackConfig);
  compiler.run(onBuild);
}