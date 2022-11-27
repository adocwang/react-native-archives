import React from 'react';
import helper from './../helper';
import {PermissionsAndroid} from 'react-native';

const readDir = async () => {
  if (helper.IsAndroid) {
    // 读取 Android content 目录需要权限
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
  }
  await helper.getTestPaths(true);
  await helper.makeTmpDir(true);
}

export default () => {
  return <helper.TestButton title="fs.readDir" onPress={readDir}/>
};