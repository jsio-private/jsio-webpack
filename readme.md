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
