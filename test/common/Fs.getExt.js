import React from 'react';
import helper from './../helper';
import {fs} from "./../../index";

const getExt = async () => {
  let ext, except;
  ext = await fs.getExt('text/plain');
  helper.showLog('getExt', except = 'txt', ext, except === ext);
  
  ext = await fs.getExt(['text/plain;utf-8', 'image/png']);
  helper.showLog(
    'getExt', except = ['txt', 'png'], ext,
    JSON.stringify(except) === JSON.stringify(ext)
  );
}

export default () => {
  return <helper.TestButton title="fs.getExt" onPress={getExt}/>
};