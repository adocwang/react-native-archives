
import {NativeModules} from 'react-native';
import utils from './src/utils';
import fs from './src/fileSystem';
import HttpService from './src/HttpService';
import {BlobPlus, RequestPlus, ResponsePlus, fetchPlus} from './src/fetchPlus';
const {status, dirs, external} = NativeModules.ArchivesModule;

module.exports = {
  dirs,
  status,
  external,
  fs,
  utils,
  BlobPlus,
  fetchPlus,
  RequestPlus,
  ResponsePlus,
  HttpService,
};
