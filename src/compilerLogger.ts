import chalk from 'chalk';


const handleFatalError = function(error): void {
  console.error('Fatal Error:');
  console.error(error.stack);
};


const handleSoftErrors = function(errors: any[]): void {
  console.error('Soft Errors:')
  errors.forEach((err) => {
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


const handleWarnings = (warnings: any[]) => {
  console.warn('Warnings:');
  warnings.forEach((warning) => console.warn(warning.message));
};


export const DETAIL_LEVEL = {
  NONE: 0,
  NORMAL: 1,
  DETAILS: 2,
  MORE_DETAILS: 3
};


const successfullyCompiled = function(
  stats,
  detailLevel: number = 0
) {
  // See: https://webpack.js.org/configuration/stats/
  console.log('Stats:');
  const toStringOptions = {
    colors: false,
    maxModules: 15,
    usedExports: false
  };
  if (detailLevel >= DETAIL_LEVEL.NORMAL) {
    toStringOptions.colors = true;
  }
  if (detailLevel >= DETAIL_LEVEL.DETAILS) {
    toStringOptions.maxModules = 100;
  }
  if (detailLevel >= DETAIL_LEVEL.MORE_DETAILS) {
    toStringOptions.maxModules = 1000;
    toStringOptions.usedExports = true;
  }
  console.log(stats.toString(toStringOptions));
};


const pprintStats = function(stats: any|any[]) {
  // Handle multistats
  if (Array.isArray(stats.stats)) {
    stats.stats.forEach(pprintStats);
    return;
  }
  successfullyCompiled(stats, DETAIL_LEVEL.MORE_DETAILS);

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

const onBuild = function(err: Error, stats: any|any[]): void {
  if (err) {
    return handleFatalError(err);
  }
  pprintStats(stats);
};

export default onBuild;
