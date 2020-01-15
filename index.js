import {NativeModules} from 'react-native';
const {ArchivesModule} = NativeModules;
const {status, dirs, external} = ArchivesModule;

module.exports = {
  status, 
  dirs, 
  external,
  get utils() {
    return require('./src/utils').default;
  },
  get fs() {
    return require('./src/fileSystem');
  },
  get fetchPlus() {
    return require('./src/fetchPlus').fetchPlus;
  },
  get HttpService() {
    return require('./src/HttpService');
  },
};
