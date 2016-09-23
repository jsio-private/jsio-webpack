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


let serve = false;

let arg = yargs
  .usage('usage: $0 <command>')
  .option('v', {
    description: 'Enable verbose logging',
    default: false,
    type: 'boolean'
  })
  .option('w', {
    alias: 'watch',
    description: 'Watch files, compile on change',
    type: 'boolean',
    default: false
  })
  .command('serve', 'Watch files, compile on change, serve from memory using webpack-dev-server', (yargs) => {
    arg = yargs
      .option('h', {
        alias: 'hot',
        description: 'Use webpacks HotModuleReplacementPlugin',
        default: false
      })
      .help('help');
    serve = true;
  })
  .help('help');
const mainArgv = arg.argv;


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
  // Add HMR plugin
  if (mainArgv.hot) {
    conf.plugin('webpackHMR', webpack.HotModuleReplacementPlugin);
  }
  // Add sourcemap rules and devServer configs
  conf.merge({
    devtool: DEFAULT_DEVTOOL,
    devServer: {
      inline: true,
      hot: mainArgv.hot
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
if (serve) {
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

  // Apply some stuff after
  if (serve) {
    _.forEach(conf._config.entry, (v, k) => {
      const newEntries = []
      if (mainArgv.hot) {
        newEntries.push('webpack/hot/only-dev-server');
      }
      newEntries.push('webpack-dev-server/client?http://localhost:8080/');
      // Put the old one back
      newEntries.push(v);
      conf._config.entry[k] = newEntries;
    });
  }

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

if (serve) {
  const server = new WebpackDevServer(compiler, {
    // webpack-dev-server options
    contentBase: process.env.PWD,
    hot: mainArgv.hot,
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