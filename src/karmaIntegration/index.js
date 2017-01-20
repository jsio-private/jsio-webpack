'use strict';
const util = require('util');
const path = require('path');

const _ = require('lodash');
const Server = require('karma').Server;

const builder = require('../builder');
const config = require('../config');


const runKarma = function () {
  // First we need to generate a webpack config for this build
  const preprocessorKeys = {};
  config.karma.preprocessorKeys.split(',').forEach(preprocessorKey => {
    let key;
    if (preprocessorKey) {
      key = process.env.PWD + '/' + preprocessorKey + '/**/*.*';
    } else {
      key = process.env.PWD + '/**/*.*';
    }
    preprocessorKeys[key] = [
      // 'webpack',
      'coverage'
    ];
  });

  return builder.getWebpackConfig()
  .then((webpackConfig) => {
    const webpackConfigForKarma = _.cloneDeep(webpackConfig[0]);
    console.log('(stripping webpack config entry, not required for karma)');
    // Remove entry because we dont need
    delete webpackConfigForKarma.entry;
    delete webpackConfigForKarma.output;
    // webpackConfigForKarma.module.preLoaders = webpackConfigForKarma.module.preLoaders || [];
    // webpackConfigForKarma.module.preLoaders.push({
    //   test: /\.(js|ts)$/,
    //   exclude: /(tests|node_modules)\//,
    //   loader: 'istanbul-instrumenter'
    // });

    // Pass config to karma
    let karmaConfig = {
      browsers: ['Chrome'], // run in Chrome

      browserNoActivityTimeout: 15000,
      browserDisconnectTimeout: 60000,
      browserDisconnectTolerance: 4,
      captureTimeout: 60000,

      files: config.karma.files.split(',').map(filePath => {
        return process.env.PWD + path.sep + filePath;
      }),

      frameworks: ['mocha'], // use the mocha test framework

      preprocessors: preprocessorKeys,

      reporters: [
        'dots',
        'progress',
        'coverage',
        'remap-coverage',
        'junit'
      ], // report results in this format

      mochaReporter: {
        output: 'full'
      },

      junitReporter: {
        outputDir: 'testResults/junitReporter'
      },

      plugins: [
        'karma-mocha',
        'karma-requirejs',
        'karma-chrome-launcher',
        'karma-mocha-reporter',
        'karma-webpack',
        'karma-coverage',
        'karma-remap-coverage',
        'karma-junit-reporter'
      ],

      // coverageReporter: {
      //   instrumenterOptions: {
      //     istanbul: { noCompact: true }
      //   },
      //   reporters: [
      //     // remap
      //     {
      //       type: 'in-memory'
      //     },
      //     // console
      //     {
      //       type: 'text'
      //     },
      //     {
      //       type: 'text-summary'
      //     },
      //     // File
      //     {
      //       dir: 'coverage',
      //       type: 'text',
      //       file: 'coverage.txt'
      //     },
      //     {
      //       dir: 'coverage',
      //       type: 'text-summary',
      //       file: 'coverage-summary.txt'
      //     },
      //     {
      //       dir: 'coverage',
      //       type: 'json',
      //       file: 'coverage.json'
      //     },
      //     {
      //       dir: 'coverage',
      //       type: 'json-summary',
      //       file: 'coverage-summary.json'
      //     },
      //     {
      //       dir: 'coverage/html',
      //       type: 'html'
      //     },
      //     {
      //       type: 'lcov',
      //       dir: 'coverage/lcov'
      //     }
      //   ]
      // },

      // remapCoverageReporter: {
      //   html: './coverage/remap-html'
      // },

      // save interim raw coverage report in memory
      coverageReporter: {
        type: 'in-memory'
      },

      // define where to save final remaped coverage reports
      remapCoverageReporter: {
        'text-summary': null,
        html: './testResults/coverage/html',
        cobertura: './testResults/coverage/cobertura.xml'
      },

      colors: true,

      singleRun: true, // just run once by default

      webpack: webpackConfigForKarma,

      webpackMiddleware: {
        // noInfo: true // please don't spam the console when running in karma!
        stats: 'errors-only'
      },

      port: config.karma.port
    };

    if (config.karma.configFilePath) {
      const userConfig = require(path.resolve(process.env.PWD, config.karma.configFilePath));
      karmaConfig = userConfig(karmaConfig);
    }

    return new Promise((resolve, reject) => {
      console.log(
        '\n\nKarma config:',
        util.inspect(karmaConfig, { colors: true, depth: 6 })
      );
      const server = new Server(karmaConfig, function (exitCode) {
        console.log('Karma has exited with ' + exitCode);
        process.exit(exitCode);
      });
      console.log('----\nStarting server...');
      server.start();
    });
  });
};


module.exports = {
  runKarma: runKarma
};
