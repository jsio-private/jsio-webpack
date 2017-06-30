'use strict';
import webpack from 'webpack';

import * as builder from './builder';
import * as builderWebpackInterface from './builder/builderWebpackInterface';
import * as persistentRunner from './persistentRunner/index';
import * as compilerLogger from './compilerLogger';
import * as config from './config';
import * as envLoader from './envLoader';
import * as installLibs from './installLibs/index';
import * as karmaIntegration from './karmaIntegration/index';


export {
  // Exports
  config,
  envLoader,
  installLibs,
  builder,
  builderWebpackInterface,
  persistentRunner,
  compilerLogger,
  karmaIntegration,
  // Libraries
  webpack
};

// Functions
export const build = builder.start;
