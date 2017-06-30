'use strict';
import webpack from 'webpack';

import { startBuild } from './builder';
import builderWebpackInterface from './builder/builderWebpackInterface';
import persistentRunner from './persistentRunner/index';
import compilerLogger from './compilerLogger';
import config from './config';
import envLoader from './envLoader';
import installLibs from './installLibs/index';
import karmaIntegration from './karmaIntegration/index';


export {
  // Exports
  config,
  envLoader,
  installLibs,
  builderWebpackInterface,
  persistentRunner,
  compilerLogger,
  karmaIntegration,
  // Libraries
  webpack
};

// Functions
export const build = startBuild;
