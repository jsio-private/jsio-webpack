'use strict';
const path = require('path');
const querystring = require('querystring');

const fs = require('fs-extra');
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


const _handleModule = (modulePath, npmModule, moduleOpts) => {
  log('handleModule:', modulePath);
  return Promise.resolve().then(() => {
    const _aliases = _.get(npmModule, 'jsioWebpack.alias');
    _.forEach(_aliases, (v, k) => {
      if (moduleOpts.aliases[k]) {
        throw new Error(
          'Alias collision: ' + k + ' (from ' + (modulePath) + ').' +
          ' Existing alias: ' + moduleOpts.aliases[k]
        );
      }
      log(`Adding alias from ${npmModule.name}: ${k} -> ${v}`);
      moduleOpts.aliases[k] = path.join(modulePath, v);
    });

    const _envWhitelist = _.get(npmModule, 'jsioWebpack.envWhitelist');
    if (_envWhitelist) {
      log(`Adding envWhitelist from ${npmModule.name}: -> ${_envWhitelist}`);
      moduleOpts.envWhitelist = _.uniq(moduleOpts.envWhitelist.concat(_envWhitelist));
    }

    // Handle nested module dependencies
    if (_.size(npmModule.dependencies) === 0) {
      return;
    }
    return Promise.map(
      Object.keys(npmModule.dependencies),
      (depKey) => {
        const dep = npmModule.dependencies[depKey];
        let depPath;
        if (dep.path) {
          depPath = dep.path;
        } else {
          log('> > Inferring dep path');
          depPath = path.join(modulePath, 'node_modules', depKey);
        }
        const depPackagePath = path.join(depPath, 'package.json');
        if (!fs.existsSync(depPackagePath)) {
          log('> > package not found, skipping:', depPackagePath);
          return;
        }
        const depPackage = fs.readJsonSync(depPackagePath);
        return _handleModule(depPath, depPackage, moduleOpts)
      },
      { concurrency: 1 }
    );
  })
  .then(() => {
    // Handle nested libs
    return Promise.resolve().then(() => {
      return installLibsUtils.getLibDirs(modulePath);
    })
    .then((libDirs) => {
      log('> Handle lib dirs:', libDirs);
      if (_.size(libDirs) === 0) {
        return;
      }
      return Promise.map(libDirs, (libDir) => {
        if (!libDir.package) {
          log('> > package not found');
          return;
        }
        return _handleModule(libDir.dir, libDir.package, moduleOpts);
      }, { concurrency: 1 });
    });
  });
};


const getModuleOpts = (projectDir) => {
  console.log('\n' + colors.green('Getting module aliases...') + '\n');
  const moduleOpts = {
    aliases: {},
    envWhitelist: []
  };
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
      return _handleModule(res.path, res, moduleOpts);
    });
  })
  .then(() => {
    log('> moduleOpts=', moduleOpts);
    return moduleOpts;
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
      if (!current.externals) {
        current.externals = [];
      }
      current.externals.push(nodeExternals(options.nodeExternalsOpts));
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


  const ifdefOpts = _.merge({}, options.ifdefOpts);
  const ifdefLoaderString = 'ifdef-loader?' + querystring.encode({ json: JSON.stringify(ifdefOpts) });


  conf.loader('worker', {
    test: /\.worker\.js$/,
    loaders: [
      'worker-loader?inline=true',
      ifdefLoaderString
    ]
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
      }),
      ifdefLoaderString
    ]
  });

  resolveExtensions.push('.js');
  resolveExtensions.push('.jsx');
  conf.loader('babel', {
    test: /\.jsx?$/,
    // include: path.join(__dirname, 'src'),
    exclude: /(node_modules)/,
    loaders: [
      babelLoaderString,
      ifdefLoaderString
    ]
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
    NODE_ENV: config.env,
    COMMITHASH: '<DISABLED>'
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
    defines.COMMITHASH = gitRevisionPlugin.commithash();
  }

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
  let envWhitelist = {};
  return new Promise((resolve, reject) => {
    addTowhitelist(envWhitelist, options.envWhitelist);
    // module aliases
    if (options.scanLibs) {
      return getModuleOpts(pwd)
        .then((moduleOpts) => {
          log('Found module opts:', moduleOpts);
          if (options.useModuleAliases) {
            conf.merge({
              resolve: {
                alias: moduleOpts.aliases
              }
            });
          }

          addTowhitelist(envWhitelist, moduleOpts.envWhitelist);
        })
        .then(() => {
          resolve();
        });
    } else {
      resolve();
    }
  })
  .then(() => {
    // Define plugin
    _.forEach(envWhitelist, (v, k) => {
      defines[k] = v ? '' + v : '';
    });

    let defineOpts = {};
    if (options.flatProcessEnv) {
      _.forEach(defines, (v, k) => {
        defineOpts['process.env.' + k] = JSON.stringify(v);
      });
    } else {
      defineOpts['process.env'] = _.mapValues(defines, v => JSON.stringify(v));
    }
    conf.plugin('webpackDefine', webpack.DefinePlugin, [defineOpts]);
  });
};


/** Merges `envWhitelist`s */
const addTowhitelist = function (
  envWhitelistMain,
  envWhitelist
) {
  log('addTowhitelist', envWhitelist);
  if (Array.isArray(envWhitelist)) {
    // Add array
    _.forEach(envWhitelist, (envVar, i) => {
      if (typeof envVar === 'string') {
        envWhitelistMain[envVar] = process.env[envVar];
      } else {
        // Objects in array?!
        addTowhitelist(envWhitelistMain, envVar);
      }
    });
  } else {
    // Add object (with defaults)
    _.forEach(envWhitelist, (defaultValue, envVar) => {
      envWhitelistMain[envVar] = '' + _.get(process.env, envVar, defaultValue);
    });
  }
}
