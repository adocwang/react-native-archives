const run = require('./local-cli/run');
const api = require('./local-cli/api');
const utils = require('./local-cli/utils');
const makeBundle = require('./local-cli/bundle');
const {diffPackage, diffPPK} = require('./local-cli/diff');

module.exports = {
  makeBundle,
  diffPackage,
  diffPPK,
  utils,
  api,
  run
};