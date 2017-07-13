import webpack from 'webpack';

import * as builderWebpackInterface from './builder/builderWebpackInterface';
import * as persistentRunner from './persistentRunner/index';
import compilerLogger from './compilerLogger';
import config from './config';
import * as installLibs from './installLibs/index';
import * as karmaIntegration from './karmaIntegration/index';
import * as buildDTS from './typescript/buildDTS';
// import { DLLDedupePlugin } from '@blackstormlabs/webpack-dll-dedupe-plugin';
const DLLDedupePlugin = null;

export {
  // Exports
  config,
  installLibs,
  builderWebpackInterface,
  persistentRunner,
  compilerLogger,
  karmaIntegration,
  buildDTS,
  DLLDedupePlugin,
  // Libraries
  webpack
};

// Functions
export { startBuild as build } from './builder';
export { loadEnv } from './envLoader';
