import React from 'react';
import helper from './../helper';
import {fs, dirs} from "./../../index";

const getShareUri = async () => {
  let file, uri, content;
  file = dirs.Temporary + '/_arch_test_667_.txt';
  await fs.writeFile(file, 'abc');
  uri = await fs.getShareUri(file);
  helper.prtLog('share uri:', uri);
  content = await fs.readFile(uri, 'text');
  helper.showLog('read', content, 'abc', 'abc' === content)
  await fs.writeFile(uri, '123', true)
  content = await fs.readFile(uri, 'text');
  helper.showLog('read', content, 'abc123', 'abc123' === content)
  await fs.unlink(file);
}

export default () => {
  return <helper.TestButton title="fs.getShareUri" onPress={getShareUri} android={true}/>
};