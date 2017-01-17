'use strict';
const path = require('path');

const Promise = require('bluebird');
const colors = require('colors');
const nib = require('nib');
const webpack = require('webpack');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const ProgressBarPlugin = require('progress-bar-webpack-plugin');
const WebpackErrorNotificationPlugin = require('webpack-error-notification');
const CircularDependencyPlugin = require('circular-dependency-plugin');
const chalk = require('chalk');
const npm = require('npm');
const _ = require('lodash');
const debug = require('debug');
const nodeExternals = require('webpack-node-externals');
const GitRevisionPlugin = require('git-revision-webpack-plugin');
const Visualizer = require('webpack-visualizer-plugin');

const EncryptedBuildPlugin = require('encrypted-build-webpack-plugin');

const config = require('../config');
const utils = require('../utils');
const installLibsUtils = require('../installLibs/utils');


const log = debug('jsio-webpack:multiConf:common');


// See: http://stackoverflow.com/a/38733864
const isExternal = (module) => {
  const userRequest = module.userRequest;
  if (typeof userRequest !== 'string') {
    return false;
  }
  return userRequest.indexOf('/node_modules/') >= 0;
};


const resolveBabelPresets = (preset) => {
  if (Array.isArray(preset)) {
    preset[0] = require.resolve(preset[0]);
    return preset;
  }
  return require.resolve(preset);
};


const _handleModule = (modulePath, npmModule, aliases) => {
  return new Promise((resolve, reject) => {
    const _aliases = _.get(npmModule, 'jsioWebpack.alias');
    _.forEach(_aliases, (v, k) => {
      if (aliases[k]) {
        throw new Error(
          'Alias collision: ' + k + ' (from ' + (modulePath) + ').' +
          ' Existing alias: ' + aliases[k]
        );
      }
      log('Adding alias from ' + npmModule.name + ': ' + k + ' -> ' + v);
      aliases[k] = path.join(modulePath, v);
    });

    if (_.size(npmModule.dependencies) > 0) {
      resolve(Promise.map(
        Object.keys(npmModule.dependencies),
        (depKey) => {
          const dep = npmModule.dependencies[depKey];
          return _handleModule(dep.path, dep, aliases)
        },
        { concurrency: 1 }
      ));
      return;
    }

    resolve();
  });
};


const getModuleAliases = (projectDir) => {
  console.log('\n' + colors.green('Getting module aliases...') + '\n');
  const aliases = {};
  log('Loading npm');
  return Promise.resolve().then(() => {
    log('> Handle npm deps');
    return Promise.promisify(npm.load, npm)({});
  })
  .then((npm) => {
    return new Promise((resolve, reject) => {
      log('Running npm.list');
      npm.list((stringList, res) => {
        resolve(res);
      });
    })
    .then((res) => {
      return _handleModule(res.path, res, aliases);
    });
  })
  .then(() => {
    return installLibsUtils.getLibDirs(projectDir);
  })
  .then((libDirs) => {
    log('> Handle lib dirs:', libDirs);
    return Promise.map(libDirs, (libDir) => {
      if (!libDir.package) {
        log('> > package not found');
        return;
      }
      return _handleModule(libDir.dir, libDir.package, aliases);
    }, { concurrency: 1 });
  })
  .then(() => {
    log('> aliases=', aliases);
    return aliases;
  });
};



module.exports = (conf, options) => {
  const pwd = path.resolve(process.cwd());
  const resolveExtensions = [''];

  // BASE CONFIG
  conf.merge((current) => {
    current.resolve = current.resolve || {};
    const nodeModulesPath = path.resolve(__dirname, '..', '..', 'node_modules');
    current.resolve.fallback = nodeModulesPath;
    current.resolveLoader = current.resolveLoader || {};

    current.resolve.root = current.resolveLoader.root = [
      path.join(pwd, 'node_modules'), // Project node_modules
      nodeModulesPath // jsio-webpack node_modules
    ];

    // If jsio-webpack is installed as a dependency of the project being built,
    // ensure that all parent directories are also used when loking for loaders.
    // npm will install at the top most directory it can within a project
    if (nodeModulesPath.indexOf(pwd) === 0) {
      let testPath = path.dirname(nodeModulesPath);
      let i = 0;
      while (testPath !== pwd) {
        if (i++ > 50) {
          throw new Error('max depth exceeded');
        }
        current.resolveLoader.root.push(testPath);
        testPath = path.dirname(testPath);
      }
    }

    current.stylus = {
      use: [nib()],
      import: ['~nib/lib/nib/index.styl'],
      preferPathResolver: 'webpack'
    }
    current.stylint = {
      options: {
        config: {
          colons: 'never'
        }
      }
    };

    // If the user wants, forward one, otherwise no devtool
    current.devtool = options.devtool;

    if (options.backendBuild) {
      current.target = 'node';
      current.externals = [nodeExternals(options.nodeExternalsOpts)];
      current.node = {
        __dirname: false,
        __filename: false
      };
    }

    return current;
  });

  // PRELOADERS
  conf.preLoader('eslint', {
    test: /\.jsx?$/,
    exclude: /(node_modules)/
  });
  conf.preLoader('stylint', {
    test: /\.styl$/
  });
  // conf.preLoader('tslint', {})

  // LOADERS
  if (options.useJsonSchema) {
    resolveExtensions.push('.schema.json');
    conf.loader('json-schema', {
      test: /\.schema\.json$/,
      loaders: ['json-schema-loader?useSource=true', 'webpack-comment-remover-loader']
    });
  }

  // Note: this throws weird errors sometimes.  First thing to try if it
  // fails to parse your file: `import x from '!json!x';`
  conf.loader('json', {
    // Ugly regex to exclude schema.json files
    test: /^[^\.]+?(?!\.schema)\.json$/,
    // test: /\.json$/,
    loaders: ['json-loader', 'webpack-comment-remover-loader']
  });

  conf.loader('worker', {
    test: /\.worker\.js$/,
    loader: 'worker-loader?inline=true'
  });

  const babelPresets = [];
  if (options.es2015 === 'default') {
    babelPresets.push(['babel-preset-es2015', { loose: true }]);
  } else if (options.es2015 === 'without-strict') {
    babelPresets.push('babel-preset-es2015-without-strict');
  } else {
    throw new Error(`Unknown es2015 value: ${options.es2015}`);
  }
  babelPresets.push('babel-preset-react');
  const resolvedBabelPresets = babelPresets.map(resolveBabelPresets);

  const babelPlugins = [
    'babel-plugin-transform-object-assign',
    'babel-plugin-transform-object-rest-spread'
  ];
  if (options.useReactHot) {
    babelPlugins.push('react-hot-loader/babel');
  }
  const resolvedBabelPlugins = babelPlugins.map(resolveBabelPresets);

  let babelLoaderString = 'babel-loader?' + JSON.stringify({
    presets: resolvedBabelPresets,
    plugins: resolvedBabelPlugins
  });

  resolveExtensions.push('.ts');
  resolveExtensions.push('.tsx');
  conf.loader('ts', {
    test: /\.tsx?$/,
    exclude: /node_modules/,
    // loader: tsLoaderString
    loaders: [
      babelLoaderString,
      'ts-loader?' + JSON.stringify({
        visualStudioErrorFormat: true,
        ignoreDiagnostics: options.typescriptIgnoreDiagnostics
      })
    ]
  });

  resolveExtensions.push('.js');
  resolveExtensions.push('.jsx');
  conf.loader('babel', {
    test: /\.jsx?$/,
    // include: path.join(__dirname, 'src'),
    exclude: /(node_modules)/,
    loaders: [babelLoaderString]
  });

  conf.loader('xml', {
    test: /\.(xml)$/
  });

  conf.loader('file', {
    test: /\.(jpe?g|gif|png|wav|mp3|ogv|ogg|mp4|webm)$/
  });

  if (options.useShaders) {
    resolveExtensions.push('.vert');
    resolveExtensions.push('.frag');
    resolveExtensions.push('.glsl');
    conf.loader('glsl', {
      test: /\.(glsl|vert|frag)$/,
      loader: 'glsl-template-loader'
    });
  }

  if (options.useBase64FontLoader) {
    conf.loader('base64Fonts', {
      test: /\.(eot|svg|ttf|woff|woff2|otf)?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
      loader: 'base64-font-loader'
    });
  } else {
    conf.loader('ttf', {
      test: /\.(ttf|eot|svg)(\?v=[0-9]\.[0-9]\.[0-9])?$/,
      loader: 'file-loader'
    })
    conf.loader('woff', {
      test: /\.woff(2)?(\?v=[0-9]\.[0-9]\.[0-9])?$/,
      loader: 'url-loader?limit=10000&mimetype=application/font-woff'
    });
  }

  // PLUGINS
  const defines = {
    'process.env.NODE_ENV': config.env,
    'process.env.COMMITHASH': '<DISABLED>'
  };

  if (
    (
      options.useGitRevisionPlugin === 'production' &&
      process.env.NODE_ENV === 'production'
    ) ||
    (
      options.useGitRevisionPlugin === 'always'
    )
  ) {
    const gitRevisionPlugin = new GitRevisionPlugin();
    defines['process.env.COMMITHASH'] = gitRevisionPlugin.commithash();
  }

  conf.plugin('webpackDefine', webpack.DefinePlugin, [
    _.mapValues(defines, v => JSON.stringify(v))
  ]);

  conf.plugin('progressBar', ProgressBarPlugin, [{
    renderThrottle: 100,
    format: '  Building [:bar] ' + chalk.green.bold(':percent') + ' (:elapsed seconds)'
  }]);

  if (options.useVendorChunk) {
    conf.plugin('vendorChunk', webpack.optimize.CommonsChunkPlugin, [{
      name: 'vendors',
      minChunks: isExternal
    }]);
  }

  if (options.backendBuild) {
    conf.plugin('sourceMapSupport', webpack.BannerPlugin, [
      'require("source-map-support").install();',
      { raw: true, entryOnly: false }
    ]);
  }

  if (options.useCircularDependencyPlugin) {
    conf.plugin('CircularDependencyPlugin', CircularDependencyPlugin, [{
      failOnError: false
    }]);
  }

  if (options.useNotifications) {
    conf.plugin('Notification', WebpackErrorNotificationPlugin, []);
  }

  if (options.useVisualizerPlugin) {
    conf.plugin('Visualizer', Visualizer, []);
  }

  if (config.env === 'production' && options.useStylusExtractText) {
    // Use ExtractTextPlugin for production
    const stylusLoader = ExtractTextPlugin.extract(
      'style-loader',
      'css-loader!stylus-loader'
    );
    conf.loader('stylus', {
      test: /\.styl$/,
      loader: stylusLoader
    });
    conf.plugin('stylusExtractText', ExtractTextPlugin, ['[name].css']);
  } else {
    // Use normal style-loader in dev (hot reload css)
    conf.loader('stylus', {
      test: /\.styl$/,
      loader: 'style-loader!css-loader!stylus-loader'
    });
  }

  const encryptionKey = process.env.WEBPACK_ENCRYPTION_KEY;
  if (encryptionKey) {
    conf.plugin('BuildEncryption', EncryptedBuildPlugin, [{
      encryptionKey: encryptionKey
    }]);
  }

  conf.merge((current) => {
    current.resolve.extensions = resolveExtensions;
    return current;
  });

  // TODO: Better promise support -- this whole function should be in a promise
  // for proper error propagation
  return new Promise((resolve, reject) => {
    // module aliases
    if (options.useModuleAliases) {
      return getModuleAliases(pwd)
        .then((aliases) => {
          log('Found aliases:', aliases);
          conf.merge({
            resolve: {
              alias: aliases
            }
          });
          return conf;
        })
        .then(() => {
          resolve();
        });
    } else {
      resolve();
    }
  });
};
