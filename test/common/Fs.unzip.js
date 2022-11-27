import React from 'react';
import helper from './../helper';
import {fs, dirs, fetchPlus} from "./../../index";

const unzipFile = async (zipFile) => {
  const dir = dirs.Temporary + '/_unzip_test_';
  await fs.unzip(zipFile, dir);

  // 直接解压
  let files;
  let actual={};
  let except = {
    "foo.txt": false,
    "sub": true,
  };

  files = await fs.readDir(dir);
  for (let f of files) {
    actual[f.name] = f.isDir;
  }
  helper.showLog('check list', except, actual, JSON.stringify(except) === JSON.stringify(actual));

  // 子文件夹
  actual={};
  except = {
    "bar.txt": false,
  };
  files = await fs.readDir(dir+'/sub');
  for (let f of files) {
    actual[f.name] = f.isDir;
  }
  helper.showLog('check deep list', except, actual, JSON.stringify(except) === JSON.stringify(actual));

  // 读取文件
  actual = await fs.readFile(dir+'/foo.txt');
  helper.showLog('check file', except = 'foo', actual, except === actual);

  actual = await fs.readFile(dir+'/sub/bar.txt');
  helper.showLog('check deep file', except = 'bar', actual, except === actual);

  // 移除解压的文件夹
  await fs.rmDir(dir, true);
  let isDir = await fs.isDir(dir);
  helper.showLog('rm unzip dir', isDir, null === isDir);

  // 校验 md5 后解压
  try {
    await fs.unzip(zipFile, dir, '13d36a40f4a77225b7a9f41fd1b9b9dd');
    helper.showLog('unzip by error md5 shold exception', false);
  } catch(e) {
    isDir = await fs.isDir(dir);
    helper.showLog('unzip by error md5 shold exception', isDir, null === isDir);
  }
  await fs.unzip(zipFile, dir, '13d36a40f4a77225b7a9f41fd1b9b9e9');
  isDir = await fs.isDir(dir);
  helper.showLog('unzip by correct md5', isDir, true === isDir);

  // 移除临时文件
  await fs.rmDir(dir, true);
}

const unzip = async () => {
  const tmpFile = dirs.Temporary + '/_unzip_test_.zip';
  await fetchPlus({
    url: helper.Assets.RemoteZip,
    saveTo: tmpFile
  });
  await unzipFile(tmpFile);
  await fs.unlink(tmpFile);

  // unzip require file
  helper.prtLog('✸✸ test unzip require file ✸✸');
  await unzipFile(helper.Assets.LocalZip);
}

export default () => {
  return <helper.TestButton title="fs.unzip" onPress={unzip}/>
};