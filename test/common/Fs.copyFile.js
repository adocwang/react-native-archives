import React from 'react';
import helper from './../helper';
import {fs, dirs} from "./../../index";

const copyFile = async () => {
  helper.prtLog('✸✸ check copy special file ✸✸');
  const files = [
    ...(await helper.getTestPaths()).files,
    [helper.Assets.LocalPng, "require('.png')"],
    [helper.Assets.LocalRaw, "require('.html')"],
    helper.Assets.RemoteTxt,
  ];
  let pathName, checkPath;
  const destPath = dirs.Temporary + '/_special_dest_file_';
  for (let path of files) {
    if (Array.isArray(path)) {
      [path, pathName] = path;
    } else {
      pathName = path;
    }
    await fs.copyFile(path, destPath);
    checkPath = await fs.isDir(destPath);
    helper.showLog('copy '+pathName, false === checkPath);
    await fs.unlink(destPath);
  }
  await helper.makeTmpDir(true);

  // copy 方法
  helper.prtLog('✸✸ check copy method ✸✸');
  let excpt, exist, exist2, rm, cp, content, excon, excon2;
  const file = dirs.Temporary + '/_test_.txt';
  const file2 = dirs.Temporary + '/_test_2.txt';

  // 确认文件
  exist = await fs.isDir(file);
  helper.prtLog('source file exist:', exist === false);
  exist2 = await fs.isDir(file2);
  helper.prtLog('dest file exist:', exist === false);
  if (null !== exist2) {
    rm = await fs.unlink(file2);
    helper.showLog('unlink dest file', excpt = null, rm, excpt === rm);
  }
  excon = '*&^';
  await fs.writeFile(file, excon);

  // 复制(不存在)
  cp = await fs.copyFile(file, file2);
  helper.showLog('copy file', excpt = null, cp, excpt === cp);
  content = await fs.readFile(file2);
  helper.showLog('check copy', excon, content, excon === content);

  // 复制(不覆盖)
  excon2 = '@#$';
  await fs.writeFile(file, excon2);
  try {
    await fs.copyFile(file, file2, false);
    helper.showLog('copy overwrite should failed', false)
  } catch(e) {
    helper.showLog('copy overwrite should failed', true)
  }
  content = await fs.readFile(file2);
  helper.showLog('check copy', excon, content, excon === content);

  // 复制(覆盖)
  await fs.copyFile(file, file2);
  helper.showLog('copy overwrite', true);
  content = await fs.readFile(file2);
  helper.showLog('check copy', excon2, content, excon2 === content);

  // 删除临时文件
  await fs.unlink(file);
  await fs.unlink(file2);
}

export default () => {
  return <helper.TestButton title="fs.copyFile" onPress={copyFile}/>
};