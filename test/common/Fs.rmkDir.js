import React from 'react';
import helper from './../helper';
import {fs, dirs} from "./../../index";

const rmkDir = async () => {
  const dir = dirs.Temporary + '/_arch_rmk_test_967_';
  let exist, rm, crt, subdir;
  exist = await fs.isDir(dir);
  helper.showLog('isDir', dir, exist, true);
  if (false === exist) {
    helper.showLog('test dir is a file, jump test', false)
    return;
  }
  if (exist) {
    rm = await fs.rmDir(dir, true);
    helper.showLog('rmDir', dir, rm, null === rm);
    exist = await fs.isDir(dir);
    helper.showLog('isDir', dir, exist, null === exist);
  }
  crt = await fs.mkDir(dir);
  helper.showLog('mkDir', dir, crt, null === crt);
  exist = await fs.isDir(dir);
  helper.showLog('isDir', dir, exist, exist);

  subdir = dir + '/a/b';
  try {
    crt = await fs.mkDir(subdir, false);
    helper.showLog('mkSubDir should failed', dir, false);
  } catch(e) {
    helper.showLog('mkSubDir should failed', dir, true);
  }
  
  crt = await fs.mkDir(subdir);
  helper.showLog('mkSubDir', dir, crt, null === crt);
  exist = await fs.isDir(subdir);
  helper.showLog('isSubDir', dir, exist, exist);

  try {
    rm = await fs.rmDir(dir);
    helper.showLog('rm recursive should failed', dir, false);
  } catch(e) {
    helper.showLog('rm recursive should failed', dir, true);
  }

  rm = await fs.rmDir(dir, true);
  helper.showLog('rmDir', dir, rm, null === rm);
  exist = await fs.isDir(dir);
  helper.showLog('isDir', dir, exist, null === exist);
}

export default () => {
  return <helper.TestButton title="fs.rmkDir" onPress={rmkDir}/>
};