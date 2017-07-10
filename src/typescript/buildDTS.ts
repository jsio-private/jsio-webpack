import chalk from 'chalk';
import { runChildProcess } from '../utils';
import dynamicRequire from '../dynamicRequire';
import Promise from 'bluebird';
import path from 'path';
import debug from 'debug';
import * as dts from 'dts-bundle';
import fs from 'fs-extra';
import config from '../config';


const log = debug('jsio-webpack:buildDTS');


const buildDeclarations = function(
  projectDir: string,
  entryPath: string,
  declarationDir: string
): Promise<void> {
  return Promise.resolve().then(() => {
    const tscPath: string = path.resolve(
      dynamicRequire.resolve('typescript'),
      '..', '..', 'bin', 'tsc'
    );
    return runChildProcess(tscPath, [
      // entryPath,
      '--outDir', '/dev/null',
      '--declarationDir', declarationDir,
      '--declaration', 'true',
      '--allowJs', 'false',
      '--project', projectDir,
      '--rootDir', projectDir
    ], { cwd: projectDir })
    .catch((error: Error) => {
      // Ignore error code 2, throws all the time, we are doing janky stuff anyways
      if ((<any>error).code === 2) {
        log('> Ignoring tsc error code 2');
        return;
      }
      throw error;
    });
  });
};


export const bundleDefinitions = function(
  projectDir: string,
  entryPath: string,
  declarationDir: string
): Promise<string> {
  return Promise.resolve().then(() => {
    const packagePath: string = path.join(projectDir, 'package.json');
    const packageJson = fs.readJsonSync(packagePath);
    // Remove scope from name
    const packageName: string = packageJson.name;
    const packageNameNoScope: string = packageName.replace(/^@.*\//, '');
    const outDir: string = path.join(projectDir, 'dist');
    const renamedEntryFile: string = path.basename(entryPath).replace(/\.ts$/, '.d.ts');
    const renamedEntryPath: string = path.join(
      path.dirname(entryPath),
      renamedEntryFile
    );
    const outPath: string = path.join(outDir, `${packageNameNoScope}.d.ts`);
    const mainPath: string = path.join(declarationDir, renamedEntryPath);
    const dtsConfig = {
      name: packageName,
      main: mainPath,
      out: outPath,
      baseDir: declarationDir
      // Note: Cannot use this, will cause naming collisions given `src/a export Z` and `src/b export Z`
      // outputAsModuleFolder: true
    };
    log('> dtsConfig=', dtsConfig);
    dts.bundle(dtsConfig);
    return outPath;
  });
};


export const cleanupDeclarations = function(
  declarationDir: string
): Promise<void> {
  return Promise.resolve().then(() => {
    log('cleanupDeclarations: declarationDir=', declarationDir);
    return fs.remove(declarationDir);
  });
};


export const run = function(): Promise<string> {
  const projectDir: string = process.env.PWD;
  const entryPath: string = config.buildDTS.entrypoint;
  const declarationDir: string = 'dist/declarations';
  let bundlePath: string;
  console.log(`Building .d.ts bundle for project ${chalk.cyan(projectDir)} entry ${chalk.cyan(entryPath)}`);
  return buildDeclarations(projectDir, entryPath, declarationDir)
  .then(() => {
    console.log(`Declarations for ${entryPath} built to: ${declarationDir}`);
    console.log('Bundling declarations')
    return bundleDefinitions(projectDir, entryPath, declarationDir);
  })
  .then((bundlePath_: string) => {
    bundlePath = bundlePath_;
    return cleanupDeclarations(declarationDir);
  })
  .then(() => {
    console.log('Output bundle at:', chalk.cyan(bundlePath));
    return bundlePath;
  });
};
