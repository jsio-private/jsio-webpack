# jsio-webpack

This project aims to make working with webpack easy at js.io.

Read up on how to use [webpack-configurator](https://www.npmjs.com/package/webpack-configurator) if you are unfamiliar.



## Usage


### `package.json`

This is an example of what your `package.json` should contain (in relation to jsio-webpack):

```json
{
  "scripts": {
    "build": "NODE_ENV=production jsio-webpack",
    "watch": "jsio-webpack --watch",
    "serve": "jsio-webpack serve --hot"
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


#### `useStylusExtractText`

This only effects production builds.  The ExtractTextPlugin is used to move all stylus code in to a separate built file, to be included in your pages `<head>`.


#### `useVendorChunk`

This will cause all imported files from `node_modules` to be included in a separate `vendor` chunk.


#### `useBase64FontLoader`

Uses [base64-font-loader](https://www.npmjs.com/package/base64-font-loader) to inline fonts.


#### `useReactHot`

Turns on [react-hot-loader](https://github.com/gaearon/react-hot-loader) for react component hot loading.


#### `backendBuild`

Builds your bundle to be used from command line with `node`.

Make sure to install [source-map-support](https://github.com/evanw/node-source-map-support).


#### `useCircularDependencyPlugin`

Turns on [CircularDependencyPlugin](https://github.com/aackerman/circular-dependency-plugin).  Default behavior is to not fail on circular dependencies.


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


#### `useNotifications`

Will enable the [webpack-error-notification](https://www.npmjs.com/package/webpack-error-notification) plugin, which will create system notifications when the build status changes.

_Note: Taken from the webpack-error-notification readme:_

For Mac OS (10.8+) you need to install terminal-notifier, the easy way is to use Homebrew:

```bash
brew install terminal-notifier
```


#### `es2015WithoutStrict`

Will use `babel-preset-es2015-without-strict` instead of `babel-preset-es2015`.


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
