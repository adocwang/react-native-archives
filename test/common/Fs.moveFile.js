import React from 'react';
import helper from './../helper';
import {fs, dirs} from "./../../index";

const moveFile = async () => {
  let excpt, exist, exist2, rm, cp, content, excon, excon2;
  const file = dirs.Temporary + '/_test_.txt';
  const file2 = dirs.Temporary + '/_test_2.txt';

  // 确认文件
  exist = await fs.isDir(file);
  helper.showLog('file isDir', exist, '', true);
  exist2 = await fs.isDir(file2);
  helper.showLog('file2 isDir', exist2, '', true);
  if (null !== exist2) {
    rm = await fs.unlink(file2);
    helper.showLog('unlink file2', rm, '', null === rm);
  }
  excon = '*&^';
  await fs.writeFile(file, excon);

  // 移动(不存在)
  cp = await fs.moveFile(file, file2);
  helper.showLog('moveFile', excpt = null, cp, excpt === cp);
  content = await fs.readFile(file2);
  helper.showLog('check move', excon, content, excon === content);
  exist = await fs.isDir(file);
  helper.showLog('old file exist', exist, '', exist === null);

  // 移动(不覆盖)
  excon2 = '@#$';
  await fs.writeFile(file, excon2);
  try {
    await fs.moveFile(file, file2, false);
    helper.showLog('move overwrite should failed', false)
  } catch(e) {
    helper.showLog('move overwrite should failed', true)
  }
  content = await fs.readFile(file2);
  helper.showLog('check move', excon, content, excon === content);

  // 移动(覆盖)
  await fs.moveFile(file, file2);
  helper.showLog('move overwrite:', true);
  content = await fs.readFile(file2);
  helper.showLog('check move', excon2, content, excon2 === content);
  exist = await fs.isDir(file);
  helper.showLog('old file exist', exist, '', exist === null);

  // 删除临时文件
  await fs.unlink(file2);
}

export default () => {
  return <helper.TestButton title="fs.moveFile" onPress={moveFile}/>
};