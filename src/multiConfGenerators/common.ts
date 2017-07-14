import { default as Configurator, WebpackConfig } from '../Configurator';
import { ConfigFunction, MultiConfOptions } from '../multiConf';
import path from 'path';
import querystring from 'querystring';

import fs from 'fs-extra';
import Promise from 'bluebird';
import nib from 'nib';
import { default as webpack } from 'webpack';
import ExtractTextPlugin from 'extract-text-webpack-plugin';
import ProgressBarPlugin from 'progress-bar-webpack-plugin';
import WebpackErrorNotificationPlugin from 'webpack-error-notification';
import CircularDependencyPlugin from 'circular-dependency-plugin';
import chalk from 'chalk';
import npm from 'npm';
import _ from 'lodash';
import debug from 'debug';
import nodeExternals from 'webpack-node-externals';
import GitRevisionPlugin from 'git-revision-webpack-plugin';
import Visualizer from 'webpack-visualizer-plugin';
import { CheckerPlugin } from 'awesome-typescript-loader';

import EncryptedBuildPlugin from 'encrypted-build-webpack-plugin';

import config from '../config';
import { getLibDirs } from '../installLibs/utils';
import dynamicRequire from '../dynamicRequire';


const log = debug('jsio-webpack:multiConf:common');


// See: http://stackoverflow.com/a/38733864
const isExternal = function(moduleItem) {
  const userRequest = moduleItem.userRequest;
  if (typeof userRequest !== 'string') {
    return false;
  }
  return userRequest.indexOf('/node_modules/') >= 0;
};


const resolveBabelPresets = function(preset: string): string {
  if (Array.isArray(preset)) {
    preset[0] = dynamicRequire.resolve(preset[0]);
    return preset;
  }
  return dynamicRequire.resolve(preset);
};


const _handleModule = function(
  options: MultiConfOptions,
  modulePath: string,
  packageContents: NpmListResult,
  moduleOpts: ModuleOpts
): Promise<void> {
  log('handleModule:', modulePath);
  // TODO: Promise type error
  return (<any>Promise.resolve()).then(() => {
    if (options.useModuleAliases) {
      const _aliases = _.get(packageContents, 'jsioWebpack.alias');
      _.forEach(_aliases, (v, k) => {
        if (moduleOpts.aliases[k]) {
          throw new Error(
            'Alias collision: ' + k + ' (from ' + (modulePath) + ').' +
            ' Existing alias: ' + moduleOpts.aliases[k]
          );
        }
        log(`Adding alias from ${packageContents.name}: ${k} -> ${v}`);
        moduleOpts.aliases[k] = path.join(modulePath, v);
      });
    }

    const _envWhitelist = _.get(packageContents, 'jsioWebpack.envWhitelist');
    if (_envWhitelist) {
      log(`Adding envWhitelist from ${packageContents.name}: -> ${_envWhitelist}`);
      _.forEach(_envWhitelist, (v, k) => {
        if (moduleOpts.envWhitelist[k]) {
          console.warn('Overwriting existing envWhitelist entry:', moduleOpts.envWhitelist[k]);
        }
        moduleOpts.envWhitelist[k] = v;
      });
    }

    // Handle nested module dependencies
    if (_.size(packageContents.dependencies) === 0) {
      return;
    }
    return Promise.map(
      Object.keys(packageContents.dependencies),
      (depKey) => {
        const dep: string|NpmListResult = packageContents.dependencies[depKey];
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
        return _handleModule(options, depPath, depPackage, moduleOpts)
      },
      { concurrency: 1 }
    );
  })
  .then(() => {
    // Handle nested libs
    return Promise.resolve().then(() => {
      return getLibDirs(modulePath);
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
        return _handleModule(options, libDir.dir, libDir.package, moduleOpts);
      }, { concurrency: 1 });
    });
  });
};


type NpmListResult = {
  path: string;
  name: string;
  dependencies: { [key: string]: NpmListResult; };
};


type ModuleOpts = {
  aliases: { [key: string]: string; };
  envWhitelist: { [key: string]: string; };
};


const getModuleOpts = function(options: MultiConfOptions, projectDir: string): Promise<ModuleOpts> {
  console.log('\n' + chalk.green('Getting module aliases...') + '\n');
  const moduleOpts: ModuleOpts = {
    aliases: {},
    envWhitelist: {}
  };
  log('Loading npm');
  return Promise.resolve().then(() => {
    log('> Handle npm deps');
    // TODO: More promise type errors
    return (<any>Promise.promisify)(npm.load, npm)({});
  })
  .then((npm) => {
    return new Promise((resolve, reject) => {
      log('Running npm.list');
      npm.list((stringList, res: NpmListResult) => {
        resolve(res);
      });
    })
    .then((res: NpmListResult) => {
      return _handleModule(options, res.path, res, moduleOpts);
    });
  })
  .then(() => {
    log('> moduleOpts=', moduleOpts);
    return moduleOpts;
  });
};


const buildConfig: ConfigFunction = function(conf: Configurator, options: MultiConfOptions) {
  const pwd = path.resolve(process.cwd());
  const resolveExtensions = [];

  // BASE CONFIG
  conf.merge((current: WebpackConfig) => {
    current.resolve = current.resolve || {};
    const nodeModulesPath = path.resolve(__dirname, '..', 'node_modules');
    // TODO: what is this in webpack v2?
    // current.resolve.fallback = nodeModulesPath;
    current.resolveLoader = current.resolveLoader || {};

    current.resolve.modules = current.resolveLoader.modules = [
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
        current.resolveLoader.modules.push(testPath);
        testPath = path.dirname(testPath);
      }
    }

    // If the user wants, forward one, otherwise no devtool
    console.log('options.devtool=', options.devtool);
    current.devtool = <any>options.devtool;

    if (options.backendBuild) {
      current.target = 'node';
      if (!current.externals) {
        current.externals = [];
      }
      (<any[]>current.externals).push(nodeExternals(options.nodeExternalsOpts));
      // const importType = 'commonjs';
      // current.externals.push(function (context, request, callback) {
      //   const relativePath = path.relative(pwd, context);
      //   if (relativePath.match(/^node_modules/)) {
      //     console.log('Marking as external: context=', context, 'request=', request);
      //     return callback(null, importType + ' ' + request);
      //   }
      //   callback();
      // });
      current.node = {
        __dirname: false,
        __filename: false
      };
    }

    return current;
  });

  // PRELOADERS
  if (options.useEsLint) {
    conf.loader('eslint', {
      test: /\.jsx?$/,
      exclude: /(node_modules)/,
      loader: 'eslint-loader',
      enforce: 'pre'
    });
  }

  // TODO: stylint loader is no longer maintained: https://github.com/guerrero/stylint-loader/issues/9
  // current.stylint = {
  //   options: {
  //     config: {
  //       colons: 'never'
  //     }
  //   }
  // };
  // conf.loader('stylint', {
  //   test: /\.styl$/,
  //   use: 'stylint-loader',
  //   enforce: 'pre'
  // });

  // conf.preLoader('tslint', {})

  // LOADERS
  if (options.useJsonSchema) {
    resolveExtensions.push('.schema.json');
    conf.loader('json-schema', {
      test: /\.schema\.json$/,
      use: [
        {
          loader: 'json-schema-loader',
          options: {
            useSource: true
          }
        },
        {
          loader: 'webpack-comment-remover-loader'
        }
      ]
    });
  }

  // Note: this throws weird errors sometimes.  First thing to try if it
  // fails to parse your file: `import x from '!json!x';`
  conf.loader('json', {
    // Ugly regex to exclude schema.json files
    test: /^[^\.]+?(?!\.schema)\.json$/,
    // test: /\.json$/,
    use: [
      'json-loader',
      'webpack-comment-remover-loader'
    ]
  });

  const ifdefLoader = {
    loader: 'ifdef-loader',
    options: _.merge({}, options.ifdefOpts)
  };

  conf.loader('worker', {
    test: /\.worker\.js$/,
    use: [
      {
        loader: 'worker-loader',
        options: {
          inline: true
        }
      },
      ifdefLoader
    ]
  });

  const babelPresets = [];
  if (options.es2015 === 'default') {
    babelPresets.push(['babel-preset-es2015', {
      loose: true,
      modules: false
    }]);
  } else if (options.es2015 === 'without-strict') {
    babelPresets.push('babel-preset-es2015-without-strict');
  } else {
    throw new Error(`Unknown es2015 value: ${options.es2015}`);
  }

  if (options.useJSX) {
    babelPresets.push('babel-preset-react');
  }

  // TODO: Add babelPresets.push('babel-preset-babili')

  const resolvedBabelPresets = babelPresets.map(resolveBabelPresets);

  const babelPlugins = [
    'babel-plugin-transform-object-assign',
    'babel-plugin-transform-object-rest-spread'
  ];
  if (options.useReactHot) {
    babelPlugins.push('react-hot-loader/babel');
  }
  const resolvedBabelPlugins = babelPlugins.map(resolveBabelPresets);


  let babelLoader = {
    loader: 'babel-loader',
    options: {
      presets: resolvedBabelPresets,
      plugins: resolvedBabelPlugins,
      cacheDirectory: true
    }
  };

  if (options.useTypescript) {
    resolveExtensions.push('.ts');
    if (options.useJSX) {
      resolveExtensions.push('.tsx');
    }

    let typescriptLoader;
    if (options.tsLoader === 'ts-loader') {
      typescriptLoader = {
        loader: 'ts-loader',
        options: {
          visualStudioErrorFormat: true,
          ignoreDiagnostics: options.typescriptIgnoreDiagnostics
        }
      };
    } else if (options.tsLoader === 'awesome-typescript-loader') {
      const babelCoreDir = dynamicRequire.resolve('babel-core');
      typescriptLoader = {
        loader: 'awesome-typescript-loader',
        options: {
          visualStudioErrorFormat: true,
          ignoreDiagnostics: options.typescriptIgnoreDiagnostics,
          // awesome-typescript-loader specific
          useBabel: true,
          useCache: true,
          babelCore: babelCoreDir,
          cacheDirectory: path.resolve(pwd, 'node_modules', '.cache', 'awesome-typescript-loader', 'awcache'),
          reportFiles: [
            'src/*.{ts,tsx}',
            'src/**/*.{ts,tsx}'
          ]
        }
      };
      conf.plugin('atl-CheckerPlugin', CheckerPlugin, []);
    } else {
      throw new Error(`Unknown options.tsLoader: "${options.tsLoader}"`);
    }

    conf.loader('ts', {
      test: options.useJSX ? /\.tsx?$/ : /\.ts$/,
      // exclude: /node_modules/,
      use: [
        babelLoader,
        typescriptLoader,
        ifdefLoader
      ]
    });
  }

  resolveExtensions.push('.js');
  if (options.useJSX) {
    resolveExtensions.push('.jsx');
  }
  conf.loader('babel', {
    test: options.useJSX ? /\.jsx?$/ : /\.js$/,
    // include: path.join(__dirname, 'src'),
    exclude: /(node_modules)/,
    use: [
      babelLoader,
      ifdefLoader
    ]
  });

  conf.loader('dsv', {
    test: /\.(csv)$/,
    loader: 'dsv-loader'
  });

  conf.loader('xml', {
    test: /\.(xml)$/,
    loader: 'xml-loader'
  });

  conf.loader('file', {
    test: /\.(jpe?g|gif|png|wav|mp3|ogv|ogg|mp4|webm)$/,
    loader: 'file-loader'
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

  if (options.useFonts) {
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
        use: [{
          loader: 'url-loader',
          options: {
            limit: 10000,
            mimetype: 'application/font-woff'
          }
        }]
      });
    }
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
    conf.plugin('sourceMapSupport', webpack.BannerPlugin, [{
      banner: 'require("source-map-support").install();',
      raw: true,
      entryOnly: false
    }]);
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

  if (options.useStylus) {
    const stylusOptions = {
      use: [nib()],
      import: ['~nib/lib/nib/index.styl'],
      preferPathResolver: 'webpack'
    };

    if (config.env === 'production' && options.useStylusExtractText) {
      // Use ExtractTextPlugin for production
      const stylusLoader = ExtractTextPlugin.extract({
        fallback: { loader: 'style-loader' },
        use: [
          { loader: 'css-loader' },
          {
            loader: 'stylus-loader',
            options: stylusOptions
          }
        ]
      });
      conf.loader('stylus', {
        test: /\.styl$/,
        loader: stylusLoader
      });
      conf.plugin('stylusExtractText', ExtractTextPlugin, ['[name].css']);
    } else {
      // Use normal style-loader in dev (hot reload css)
      conf.loader('stylus', {
        test: /\.styl$/,
        use: [
          { loader: 'style-loader' },
          { loader: 'css-loader' },
          {
            loader: 'stylus-loader',
            options: stylusOptions
          }
        ]
      });
    }
  }

  const encryptionKey = process.env.WEBPACK_ENCRYPTION_KEY;
  if (encryptionKey) {
    conf.plugin('BuildEncryption', EncryptedBuildPlugin, [{
      encryptionKey: encryptionKey
    }]);
  }

  conf.merge((current: WebpackConfig) => {
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
      return getModuleOpts(options, pwd)
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
    log('envWhitelist=', envWhitelist);
    _.forEach(envWhitelist, (v: string, k: string) => {
      defines[k] = v ? '' + v : '';
    });

    let defineOpts = {};
    if (options.flatProcessEnv) {
      _.forEach(defines, (v: any, k: string) => {
        defineOpts['process.env.' + k] = JSON.stringify(v);
      });
    } else {
      defineOpts['process.env'] = _.mapValues(defines, (v: any) => JSON.stringify(v));
    }
    conf.plugin('webpackDefine', webpack.DefinePlugin, [defineOpts]);
  });
};

export default buildConfig;


/** Merges `envWhitelist`s */
const addTowhitelist = function (
  envWhitelistMain: { [key: string]: string; },
  envWhitelist: string[]|{ [key: string]: string; }
) {
  log('addTowhitelist', envWhitelist);
  // Support older api where you can whitelist an array without default values
  if (Array.isArray(envWhitelist)) {
    const envWhitelistObject = {};
    _.forEach(envWhitelist, (v: string, i: number) => {
      envWhitelistObject[v] = '';
    });
    addTowhitelist(envWhitelistMain, envWhitelistObject);
    return;
  }

  _.forEach(envWhitelist, (defaultValue: string, k: string) => {
    if (envWhitelistMain[k]) {
      console.log('Overwriting existing envWhitelistMain entry:', envWhitelistMain[k]);
    }
    if (process.env[k]) {
      envWhitelistMain[k] = process.env[k];
    } else {
      if (typeof defaultValue === 'string') {
        envWhitelistMain[k] = defaultValue;
      } else {
        envWhitelistMain[k] = defaultValue[process.env.NODE_ENV];
      }
    }
  });
}
