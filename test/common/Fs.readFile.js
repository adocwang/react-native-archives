import React from 'react';
import helper from './../helper';
import {utils, fs, dirs} from "./../../index";

const readFile = async () => {
  // test speical file
  let path, str;
  helper.prtLog('✸✸ read speical file ✸✸');
  const temp = await helper.getTestPaths();
  for (path of temp.files) {
    str = await fs.readFile(path, 'text', 0, 1);
    helper.showLog('read file', path, str.length, true);
  }
  await helper.makeTmpDir(true);
  str = await fs.readFile(helper.Assets.LocalPng, 'text', 0, 1);
  helper.showLog('read file', "require('.png')", str.length, true);

  // test read method
  const expected = 'abcdefg';
  const checkRead = async (file, raw) => {
    let base64, middle, content, excpt;
    const miniType = raw ? 'text/html' : 'text/plain';

    content = await fs.readFile(file);
    helper.showLog('read string', expected, content, expected === content);

    content = await fs.readFile(file, 'text', 3);
    helper.showLog('read string offset', excpt = 'defg', content, excpt === content);

    content = await fs.readFile(file, 'text', 3, 2);
    helper.showLog('read string offset+len', excpt = 'de', content, excpt === content);

    content = await fs.readFile(file, 'text', -5);
    helper.showLog('read string -offset', excpt = 'cdefg', content, excpt === content);

    content = await fs.readFile(file, 'text', -5, 3);
    helper.showLog('read string -offset+len', excpt = 'cde', content, excpt === content);

    base64 = await fs.readFile(file, 'base64');
    content = utils.arrayBufferToText(utils.base64ToArrayBuffer(base64));
    helper.showLog('read base64', expected, base64, expected === content);

    content = await fs.readFile(file, 'uri');
    helper.showLog('read uri', excpt = 'data:'+miniType+';base64,' + base64, content, excpt === content);

    base64 = await fs.readFile(file, 'base64', 3);
    content = utils.arrayBufferToText(utils.base64ToArrayBuffer(base64));
    helper.showLog('read base64 offset', excpt = 'defg', base64, excpt === content);

    content = await fs.readFile(file, 'uri', 3);
    helper.showLog('read uri offset', excpt = 'data:'+miniType+';base64,' + base64, content, excpt === content);

    middle = await fs.readFile(file, 'blob');
    content = await middle.text();
    helper.showLog('read blob', expected, middle, expected === content);

    middle = await fs.readFile(file, 'blob', 3);
    content = await middle.text();
    helper.showLog('read blob offset', excpt = 'defg', middle, excpt === content);

    middle = await fs.readFile(file, 'buffer');
    content = utils.arrayBufferToText(middle);
    helper.showLog('read buffer', expected, middle, expected === content);

    middle = await fs.readFile(file, 'buffer', 3);
    content = utils.arrayBufferToText(middle);
    helper.showLog('read buffer offset', excpt = 'defg', middle, excpt === content);
  };

  // require file
  helper.prtLog("✸✸ read require('.html') file ✸✸");
  await checkRead(helper.Assets.LocalRaw, true);

  // file
  helper.prtLog('✸✸ read local file ✸✸');
  const file = dirs.Temporary + '/_test_.txt';
  await fs.writeFile(file, expected);
  await checkRead(file);
  const rm = await fs.unlink(file);
  helper.showLog('unlink file', rm, '', null === rm);

  // remote file
  helper.prtLog('✸✸ read remote file ✸✸');
  await checkRead(helper.Assets.RemoteTxt);
}

export default () => {
  return <helper.TestButton title="fs.readFile" onPress={readFile}/>
};