import React from 'react';
import helper from './../helper';
import {fs, dirs} from "./../../index";
import {PermissionsAndroid} from 'react-native';

const isDir = async () => {
  if (helper.IsAndroid) {
    // 读取 Android content 目录需要权限
    await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
  }

  // require file
  let loclFile = await fs.isDir(helper.Assets.LocalPng);
  helper.showLog("require('.png')", loclFile, false === loclFile);
  loclFile = await fs.isDir(helper.Assets.LocalRaw);
  helper.showLog("require('.html')", loclFile, false === loclFile);

  // scheme file
  let path, rs, err;
  const temp = await helper.getTestPaths();
  const existDirs = [...temp.dirs];
  const existFiles = temp.files;

  // 测试下 Android shareUri
  let providerDir, providerPath;
  if (helper.IsAndroid) {
    providerDir = dirs.Temporary + '/_isDir_test_empty';
    providerPath = await fs.getShareUri(providerDir);
    await fs.mkDir(providerDir);
    existDirs.push(providerPath);
  }

  // exist dirs
  helper.prtLog('✸✸ test exist dirs ✸✸');
  for (path of existDirs) {
    err = null;
    try {
      rs = await fs.isDir(path);
    } catch (e) {
      rs = null;
      err = e;
    }
    if (err) {
      helper.showLog(path, err.message, false);
    } else {
      helper.showLog(path, rs, rs === true);
    }
  }
  // 移除 Android shareUri 临时目录
  if (helper.IsAndroid) {
    await fs.rmDir(providerDir);
  }

  // exist files
  helper.prtLog('✸✸ test exist files ✸✸');
  for (path of existFiles) {
    err = null;
    try {
      rs = await fs.isDir(path);
    } catch (e) {
      rs = null;
      err = e;
    }
    if (err) {
      helper.showLog(path, err.message, false);
    } else {
      helper.showLog(path, rs, rs === false);
    }
  }
  await helper.makeTmpDir(true);

  // not exist
  helper.prtLog('✸✸ test noneExist path ✸✸');
  const nonePahts = [
    dirs.Document + '/_test_none_'
  ];
  if (helper.IsAndroid) {
    // android 特殊目录
    nonePahts.push(
      'drawable://none', 'raw://none', 
      'asset://_none_', 'content://_none_',
      providerPath
    );
  } else {
    // ios 特殊目录

  }
  for (path of nonePahts) {
    rs = await fs.isDir(path);
    helper.showLog(path, rs, rs === null);
  }
}

export default () => {
  return <helper.TestButton title="fs.isDir" onPress={isDir}/>
};