'use strict';
const fs = require('fs');
const path = require('path');

const nib = require('nib');
const webpack = require('webpack');
const ExtractTextPlugin = require('extract-text-webpack-plugin');
const ProgressBarPlugin = require('progress-bar-webpack-plugin');
const CircularDependencyPlugin = require('circular-dependency-plugin');
const chalk = require('chalk');

const config = require('../config');


// See: http://stackoverflow.com/a/38733864
const isExternal = (module) => {
  const userRequest = module.userRequest;
  if (typeof userRequest !== 'string') {
    return false;
  }
  return userRequest.indexOf('/node_modules/') >= 0;
};


const findNodeModules = (dir) => {
  const nodeModules = {};
  fs.readdirSync(path.resolve(dir, 'node_modules'))
    .filter((x) => {
      return ['.bin'].indexOf(x) === -1;
    })
    .forEach((mod) => {
      nodeModules[mod] = 'commonjs ' + mod;
    });
  return nodeModules;
};


const resolveBabelPresets = (preset) => {
  if (Array.isArray(preset)) {
    preset[0] = require.resolve(preset[0]);
    return preset;
  }
  return require.resolve(preset);
};


module.exports = (conf, options) => {
  // BASE CONFIG
  conf.merge((current) => {
    current.resolve = current.resolve || {};
    current.resolve.extensions = [
      '', '.webpack.js', '.web.js', '.ts', '.tsx', '.js', '.jsx', '.vert', '.frag', '.glsl'
    ];
    const nodeModulesPath = path.resolve(__dirname, '..', '..', 'node_modules');
    current.resolve.fallback = nodeModulesPath;
    current.resolveLoader = current.resolveLoader || {};
    current.resolve.root = current.resolveLoader.root = [
      path.resolve(process.env.PWD, 'node_modules'), // Project node_modules
      nodeModulesPath // jsio-webpack node_modules
    ];
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

    if (options.backendBuild) {
      current.target = 'node';
      current.externals = findNodeModules(process.env.PWD);
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
  // Note: this throws weird errors sometimes.  First thing to try if it
  // fails to parse your file: `import x from '!json!x';`
  conf.loader('json', { test: /\.json$/ });

  conf.loader('worker', {
    test: /\.worker\.js$/,
    loader: 'worker-loader?inline=true'
  });

  const babelPresets = [
    ['babel-preset-es2015', { loose: true }],
    'babel-preset-react'
  ];
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

  conf.loader('ts', {
    test: /\.tsx?$/,
    exclude: /node_modules/,
    // loader: tsLoaderString
    loaders: [
      babelLoaderString,
      'ts-loader?ignoreDiagnostics[]=2307'
    ]
  });

  conf.loader('babel', {
    test: /\.jsx?$/,
    // include: path.join(__dirname, 'src'),
    exclude: /(node_modules)/,
    loaders: [babelLoaderString]
  });

  conf.loader('file', {
    test: /\.(jpe?g|gif|png|wav|mp3|ogv|ogg|mp4|webm)$/
  });
  conf.loader('glsl', {
    test: /\.(glsl|vert|frag)$/,
    loader: 'glsl-template-loader'
  });

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
  conf.plugin('webpackDefine', webpack.DefinePlugin, [{
    'process.env.NODE_ENV': JSON.stringify(config.env)
  }]);

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

  return conf;
};
