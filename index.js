'use strict';
const path = require('path');
const nib = require('nib');
const webpack = require('webpack');
const ExtractTextPlugin = require('extract-text-webpack-plugin');


const NODE_ENV = process.env.NODE_ENV || 'development';


const generateCommonConfig = (conf, options) => {
  conf.merge((current) => {
    current.resolve = current.resolve || {};
    current.resolve.extensions = [
      '', '.webpack.js', '.web.js', '.ts', '.tsx', '.js', '.vert', '.frag', '.glsl'
    ];
    current.resolveLoader = current.resolveLoader || {};
    current.resolveLoader.root = [
      path.resolve(process.env.PWD, 'node_modules'), // Project node_modules
      path.resolve(__dirname, 'node_modules') // jsio-webpack node_modules
    ];
    current.stylus = {
      use: [nib()],
      import: ['~nib/lib/nib/index.styl'],
      preferPathResolver: 'webpack'
    }
    return current;
  });

  conf.loader('json', { test: /\.json$/ });
  conf.loader('worker', {
    test: /\.worker\.js$/,
    loader: 'worker-loader?inline=true'
  });
  conf.loader('ts', {
    test: /\.tsx?$/,
    exclude: /node_modules/,
    loader: 'babel-loader?presets[]=es2015&presets[]=react!ts-loader?ignoreDiagnostics[]=2307'
  });
  conf.loader('babel', {
    test: /\.js$/,
    // include: path.join(__dirname, 'src'),
    exclude: /(node_modules)/,
    query: {
      presets: ['es2015', 'react']
    }
  });
  conf.loader('file', {
    test: /\.(jpe?g|gif|png|svg|woff|ttf|wav|mp3|ogv|mp4|webm)$/
  });
  conf.loader('glsl', {
    test: /\.(glsl|vert|frag)$/,
    loader: 'glsl-template-loader'
  })

  conf.plugin('webpackDefine', webpack.DefinePlugin, [{
    'process.env.NODE_ENV': JSON.stringify(NODE_ENV)
  }]);

  if (NODE_ENV === 'production') {
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



module.exports = {
  generateCommonConfig: generateCommonConfig
};
