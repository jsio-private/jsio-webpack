'use strict';
const chalk = require('chalk');

const handleFatalError = (err) => {
  console.error('Fatal Error:');
  console.error(err.stack);
};

const handleSoftErrors = (errors) => {
  console.error('Soft Errors:')
  errors.forEach(err => {
    let s = chalk.red(err.message);
    if (err.details) {
      s += '\n' + chalk.yellow(err.details);
    } else if (err.stack) {
      s += '\n' + chalk.yellow(err.stack);
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
  successfullyCompiled(stats);

  // const compilation = stats.compilation;
  // if (stats.hasErrors()) {
  //   handleSoftErrors(compilation.errors);
  // }
  // // NOTE: Warnings are handled by stats.toString()
  // // If we stop using that, add this back
  // if (stats.hasWarnings()) {
  //   handleWarnings(compilation.warnings);
  // }
};

const onBuild = (err, stats) => {
  if (err) {
    return handleFatalError(err);
  }
  pprintStats(stats);
};

module.exports = onBuild;
