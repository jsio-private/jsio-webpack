'use strict';
const builder = require('./builder');
const persistentRunner = require('./persistentRunner');
const compilerLogger = require('./compilerLogger');

const configure = (opts) => {
  throw new Error('TODO');
};

module.exports = {
  configure: configure,
  builder: builder,
  build: builder.start,
  persistentRunner: persistentRunner,
  compilerLogger: compilerLogger
};
