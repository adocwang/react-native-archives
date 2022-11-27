import React from 'react';
import helper from './../helper';
import {fs, external, fetchPlus} from "./../../index";
import {PermissionsAndroid} from 'react-native';

const scanFile = async () => {
  if (helper.IsAndroid) {
    // 读取 Android content 目录需要权限
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
  }
  const file = external.Picture + '/_arch_test_scanFile_.jpeg';
  await fetchPlus({
    url: helper.Assets.RemoteJpg,
    saveTo: file
  })
  await fs.scanFile(file);
  helper.prtLog('open file success')
}

export default () => {
  return <helper.TestButton title="fs.scanFile" onPress={scanFile} android={true}/>
};