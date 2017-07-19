# jsio-webpack

This project aims to make working with webpack easy at js.io.



## Usage


### `package.json`

This is an example of what your `package.json` should contain (in relation to jsio-webpack):

```json
{
  "scripts": {
    "build": "NODE_ENV=production jsio-webpack",
    "build-dts": "jsio-webpack build-dts",
    "watch": "jsio-webpack --watch",
    "serve": "jsio-webpack serve --hot",
    "postinstall": "jsio-webpack install-libs --submodules"
  },
  "devDependencies": {
    "jsio-webpack": "git+https://github.com/jsio-private/jsio-webpack"
  }
}
```


### `jsio-webpack.config.js`

This is very similar to a standard `webpack.config.js`, except you do not need to worry about configuring loaders or plugins (unless you want to).

You must either export a configure function, or an object:

- `{function} configure`
- `{function} [postConfigure]`


```js
'use strict';
const path = require('path');

const configure = (configurator, options) => {
  // Add your project specific config!
  configurator.merge({
    entry: {
      test: path.resolve(__dirname, 'testIndex.js')
    },
    output: {
      filename: '[name].js',
      path: path.resolve(__dirname, 'dist'),
      publicPath: '/'
    }
  });

  // Set options for the jsio-webpack config generators
  options.useStylusExtractText = true;

  return configurator;
};


const postConfigure = (configurator, options) => {
  // If you want to remove a plugin provided by jsio-webpack
  configurator.removePreLoader('eslint');
};

module.exports = {
  configure: configure,
  postConfigure: postConfigure
};
```


### Configure options

A brief explanation of the options available:


#### `useStylus`

Default: `true`


#### `useStylusExtractText`

This only effects production builds.  The ExtractTextPlugin is used to move all stylus code in to a separate built file, to be included in your pages `<head>`.


#### `useVendorChunk`

This will cause all imported files from `node_modules` to be included in a separate `vendor` chunk.


#### `useFonts`

Default: `false`


#### `useBase64FontLoader`

Uses [base64-font-loader](https://www.npmjs.com/package/base64-font-loader) to inline fonts.


#### `useReactHot`

Turns on [react-hot-loader](https://github.com/gaearon/react-hot-loader) for react component hot loading.


#### `backendBuild`

Builds your bundle to be used from command line with `node`.


#### `backendOptions.useSourceMapSupport`

Default: `true`

Make sure to install [source-map-support](https://github.com/evanw/node-source-map-support) with `npm install --save source-map-support`.


#### `useCircularDependencyPlugin`

Turns on [CircularDependencyPlugin](https://github.com/aackerman/circular-dependency-plugin).  Default behavior is to not fail on circular dependencies.


#### `useNotifications`

Will enable the [webpack-error-notification](https://www.npmjs.com/package/webpack-error-notification) plugin, which will create system notifications when the build status changes.

_Note: Taken from the webpack-error-notification readme:_

For Mac OS (10.8+) you need to install terminal-notifier, the easy way is to use Homebrew:

```bash
brew install terminal-notifier
```


#### `es2015`

Can be any of the following:

| Value | Description |
| ---- | ---- |
| `'default'` | [babel-preset-es2015](https://www.npmjs.com/package/babel-preset-es2015) |
| `'without-strict'` | [babel-preset-es2015-without-strict](https://www.npmjs.com/package/babel-preset-es2015-without-strict) |


#### `useJSX`

Default: `false`


#### `useTypescript`

Default: `true`


#### `tsLoader`

Default: `'awesome-typescript-loader'`

`awesome-typescript-loader` provides faster compiles with multi-process type checking.  `ts-loader` is the more official option.


#### `typescriptIgnoreDiagnostics`

Should be an array of numbers. Example:

``` js
options.typescriptIgnoreDiagnostics = options.typescriptIgnoreDiagnostics.concat([
  // Module 'xxx' has no default export.
  1192,
  // Module 'xxx' has no exported member 'default'.
  2305
]);
```


#### `nodeExternalsOpts`

Passed to [webpack-node-externals](https://www.npmjs.com/package/webpack-node-externals#configuration).


#### `useGitRevisionPlugin`

| Value | Default | Description |
| ---- | ---- | ---- |
| `'never'` | yes |  |
| `'always'` |  |  |
| `'production'` |  | Only when `NODE_ENV=production`. |

When active, this will define `process.env.COMMITHASH`.  The constant will contain a string representation of the curring HEAD hash.

All other builds the constant will contain `'<DISABLED>'`.


#### `useVisualizerPlugin`

Will output a `stats.html` in your project directory, using [webpack-visualizer-plugin](https://www.npmjs.com/package/webpack-visualizer-plugin);


#### `useJsonSchema`

Adds resolve extensions: `.schema.json`
Adds loader: `json-schema`

Json schema files can contain comments.


#### `useShaders`

Adds resolve extensions: `.vert`, `.frag`, `.glsl`
Adds loader: `glsl`


#### `scanLibs`

Required for:

- `useModuleAliases`
- `envWhitelist`


#### `useModuleAliases`

Lets modules define their own aliases.  Modules need to have a `package.json`, and need to follow this format:

```json
{
  "jsioWebpack": {
    "alias": {
      "libName": "src"
    }
  }
}
```

All dependencies will be checked (specified in `package.json`).  The directory `lib` will also be checked for packages.


#### `envWhitelist`

Default: `[]`
This is a list of strings, the strings are environment variables (`process.env.____`) to inject in to the build (using webpacks DefinePlugin).

```json
{
  "jsioWebpack": {
    "envWhitelist": [
      "MY_CONF"
    ]
  }
}
```

Or using a default value

```json
"envWhitelist": {
  "MY_CONF": "defaultValue"
}
```

Or using NODE_ENV to choose a default value

```json
"envWhitelist": {
  "MY_CONF": {
    "development": "devValue",
    "production": "prodValue"
  }
}
```


#### `flatProcessEnv`

Default: `true`
Default behavior is to send whitelisted env vars as `'process.env.MY_VAR': '123'`, set to false to send `'process.env': {'MY_VAR': '123}`.


#### `ifdefOpts`

Adds loader: `ifdef-loader`
Default: `{}`

Optionally include blocks of code at build time.  Is applied to `.js`, `.jsx`, `.ts`, `.tsx`, and `.worker.js` files.

Example source code:

```js
/// #if MY_VAR
console.log('MY_VAR is set')
/// #endif
```



### Subcommand: `install-libs`

This will run `npm install` in all `lib/*` directories, if the directory has a `package.json`.  If your libs are git submodules, add the `--submodules` option to update and init submodules in your project first.



### Subcommand: `build-dts`

This will generate a single `dist/<library name>.d.ts` file.  First all individual `<file name>.d.ts` declaration files will be built to `dist/declarations/src/<file name>.d.ts` using the typescript compiler.  Then individual `.d.ts` files will be combined using `dts-bundle`.  Finally the `dist/declarations` directory is removed.
