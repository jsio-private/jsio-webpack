'use strict';
const builder = require('./builder');


const configure = (opts) => {
  throw new Error('TODO');
};

module.exports = {
  configure: configure,
  build: builder.start
};
