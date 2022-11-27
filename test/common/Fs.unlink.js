import React from 'react';
import helper from './../helper';
import {fs, dirs} from "./../../index";

const testUnlink = async (file) => {
  let exist = await fs.isDir(file);
  helper.prtLog('file exist:', exist === false);
  if (true === exist) {
    helper.showLog('test file is dir', false);
    return;
  }
  if (null === exist) {
    await fs.writeFile(file, '1');
    helper.showLog('create file', true);
  }
  exist = await fs.isDir(file);
  helper.showLog('file exist', exist === false);

  await fs.unlink(file);
  exist = await fs.isDir(file);
  helper.showLog('unlink->file', exist === null);
}

const unlink = async () => {
  const file = dirs.Temporary + '/_arch_test_unlink_687_.txt';
  await testUnlink(file);
}

export default () => {
  return <helper.TestButton title="fs.unlink" onPress={unlink}/>
};