/**
 * react-native-archives 的 local-cli 为 easypush 提供了可用的命令行
 * 运行 easypush 的命令, 实际调是由当前包的 local-cli 进行执行
 * 
 * 此处导出一些 local-cli 所用的工具函数, 若需自行开发功能, 可使用这些函数
 *  
 *    import epush from 'react-native-archives/cli';
 * 
 *    epush.makeBundle()
 * 
 */
const api = require('./local-cli/api');
const run = require('./local-cli/index');
const utils = require('./local-cli/utils');
const Shell = require('./local-cli/shell');
const {makeApk, makeIpa, makeBundle} = require('./local-cli/pack');
const {diff, diffPackage, diffBundle} = require('./local-cli/patch');

module.exports = {
  api,
  run,
  utils,
  Shell,
  makeApk,
  makeIpa,
  makeBundle,
  diff,
  diffPackage,
  diffBundle,
};