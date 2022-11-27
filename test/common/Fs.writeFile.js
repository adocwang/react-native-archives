import React from 'react';
import helper from './../helper';
import {utils, fs, dirs} from "./../../index";

const writeFile = async () => {
  const file = dirs.Temporary + '/_test_.txt';
  const getWriteContent = (type) => {
    let contents = [
      ['overwrite', 'abcd', 'abcd'], // 覆盖写
      ['overwrite', '123', '123'], // 覆盖写
      ['write append', '456', '123456', true], // 追加写
      ['write offset', 'abc', '12abc6', 2], // 在指定位置写(从开头数)
      ['write -offset', 'xyz', '12abxyz', -2], // 在指定位置写(从结尾数)
    ];
    if ('arr' === type || 'base64' === type) {
      let rs = [], isBase = 'base64' === type;
      contents.forEach(([tit, c, e, flag]) => {
        c = utils.textToArrayBuffer(c);
        if (isBase) {
          c = [utils.arrayBufferToBase64(c)];
        }
        rs.push([tit, c, e, flag]);
      });
      return rs;
    }
    if ('blob' === type) {
      let rs = [];
      const qblob = new Blob(['abcd']);
      const sblob = qblob.slice(0, 3);
      contents.forEach(([tit, c, e, flag], index) => {
        if (0 === index) {
          c = qblob;
        } else if (3 === index) {
          c = sblob;
        } else {
          c = new Blob([c]);
        }
        rs.push([tit, c, e, flag]);
      });
      return rs;
    }
    return contents;
  };
  const checkWrite = async (type) => {
    helper.prtLog('✸✸ write file '+type+' ✸✸');
    const arr = getWriteContent(type);
    let item, tit, str, expected, flag, writeRs, content;
    for (item of arr) {
      [tit, str, expected, flag] = item;
      writeRs = await fs.writeFile(file, str, flag);
      helper.showLog(tit, writeRs, null === writeRs);
      content = await fs.readFile(file);
      helper.showLog('content', expected, content, expected === content);
    }
  };
  await checkWrite('str');
  await checkWrite('arr');
  await checkWrite('base64');
  await checkWrite('blob');

  let writeRs, content, expected;
  if (helper.IsAndroid) {
    // android 特殊路径
    helper.prtLog('✸✸ write writable content://file ✸✸');
    const uri = await fs.getShareUri(file);
    writeRs = await fs.writeFile(uri, expected = 'content_test');
    helper.showLog('write cotent uri', writeRs, null === writeRs);
    content = await fs.readFile(file);
    helper.showLog('content', expected, content, expected === content);
  } else {
    // iOS 特殊路径

  }
  const rm = await fs.unlink(file);
  helper.showLog('unlink file', rm, null === rm);
}

export default () => {
  return <helper.TestButton title="fs.writeFile" onPress={writeFile}/>
};