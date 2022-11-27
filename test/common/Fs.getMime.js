import React from 'react';
import helper from './../helper';
import {fs} from "./../../index";

const getMime = async () => {
  let mime, except;
  mime = await fs.getMime('foo.txt');
  helper.showLog('getMime', except = 'text/plain', mime, except === mime);
  
  mime = await fs.getMime(['path/foo.txt', 'foo.png']);
  helper.showLog(
    'getMime', except = ['text/plain', 'image/png'], mime,
    JSON.stringify(except) === JSON.stringify(mime)
  );
}

export default () => {
  return <helper.TestButton title="fs.getMime" onPress={getMime}/>
};