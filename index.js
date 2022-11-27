
import {NativeModules} from 'react-native';
import utils from './src/utils';
import fs from './src/fileSystem';
import HttpService from './src/HttpService';
const {dirs, external, status} = NativeModules.ArchivesModule;
import {BlobPlus, RequestPlus, ResponsePlus, fetchPlus} from './src/fetchPlus';

module.exports = {
  dirs,
  external,
  status,
  fs,
  fetchPlus,
  HttpService,

  // 主要是在内部使用, 这里也导出
  utils,
  BlobPlus,
  RequestPlus,
  ResponsePlus,
};
