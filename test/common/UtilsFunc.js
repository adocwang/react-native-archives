import React from 'react';
import helper from './../helper';
import {utils} from "./../../index";

const utilsFunc = async () => {
  // data convert
  let test, buffer, u8, u8int;
  test = 'test';
  buffer = utils.textToArrayBuffer(test);
  u8 = new Uint8Array(buffer);
  u8int = [];
  for (let i=0; i<u8.length; i++) {
    u8int.push(u8[i])
  }
  helper.showLog('textToArrayBuffer()', test, buffer, u8int.join('') === [116, 101, 115, 116].join(''));

  let txt = utils.arrayBufferToText(buffer);
  helper.showLog('arrayBufferToText()', test, txt, txt === test);

  let b64 = utils.arrayBufferToBase64(buffer), base64 = 'dGVzdA==';
  helper.showLog('arrayBufferToBase64()', base64, b64, b64 === base64);

  buffer = utils.base64ToArrayBuffer(base64);
  txt = utils.arrayBufferToText(buffer);
  helper.showLog('base64ToArrayBuffer()', test, buffer, test === txt);

  //getNumber
  let expected, actual;
  helper.showLog(
    'getNumber()',
    expected = 3,
    actual = utils.getNumber(3),
    expected === actual
  );
  helper.showLog(
    'getNumber()',
    expected = 1,
    actual = utils.getNumber('1.2'),
    expected === actual
  );
  helper.showLog(
    'getNumber()',
    expected = undefined,
    actual = utils.getNumber('x'),
    expected === actual
  );
  helper.showLog(
    'getNumber()',
    expected = null,
    actual = utils.getNumber('v', null),
    expected === actual
  );

  //normalizeMethod
  helper.showLog(
    'normalizeMethod()',
    expected = 'GET',
    actual = utils.normalizeMethod('get'),
    expected === actual
  );
  helper.showLog(
    'normalizeMethod()',
    expected = 'none',
    actual = utils.normalizeMethod('none'),
    expected === actual
  );

  //ltrim
  helper.showLog(
    'ltrim()',
    expected = 'str ',
    actual = utils.ltrim('   str '),
    expected === actual
  );
  helper.showLog(
    'ltrim()',
    expected = 'str~',
    actual = utils.ltrim('~~~str~', '~'),
    expected === actual
  );

  //rtrim
  helper.showLog(
    'rtrim()',
    expected = ' str',
    actual = utils.rtrim(' str   '),
    expected === actual
  );
  helper.showLog(
    'rtrim()',
    expected = '~str',
    actual = utils.rtrim('~str~~~', '~'),
    expected === actual
  );

  //parseQuery
  let expected2={
    foo:['f', 'o'],
    bar:"bar"
  };
  let actual2 = utils.parseQuery('foo[]=f&foo[]=o&bar=bar');
  helper.showLog('parseQuery()', expected2, actual2,
    JSON.stringify(expected2) === JSON.stringify(actual2)
  );

  //parseCookie
  let expected3={
    foo:['f', 'o'],
    bar:"bar"
  };
  let actual3 = utils.parseCookie('foo[]=f; foo[]=o; bar=bar');
  helper.showLog('parseCookie()', expected3, actual3,
    JSON.stringify(expected3) === JSON.stringify(actual3)
  );

  //parseHeader
  u8 = {
    Connection: "keep-alive",
    Pragma: "no-cache",
  };
  u8int = [];
  let expected4={};
  for (let k in u8) {
    u8int.push(k+':'+u8[k]);
    expected4[k.toLocaleLowerCase()] = u8[k];
  }
  let actual4 = {};
  let header = utils.parseHeader(u8int.join("\n"));
  for (let k of header.entries()) {
    actual4[k[0]] = k[1];
  }
  helper.showLog('parseHeader()', expected4, actual4,
    JSON.stringify(expected4) === JSON.stringify(actual4)
  );

  //makeParam
  u8 = {
    key:"key",
    arr:["a", "中"],
    哈:"t"
  };
  actual = utils.makeParam(u8);
  expected='key=key&arr[]=a&arr[]=%E4%B8%AD&%E5%93%88=t';
  helper.showLog('makeParams()', expected, actual, expected === actual);

  //makeUrl
  helper.showLog(
    'makeUrl()', 
    expected = 'http://d.com',
    actual = utils.makeUrl(expected),
    expected === actual
  );
  helper.showLog(
    'makeUrl()', 
    '',
    actual = utils.makeUrl('http://d.com', 'path'),
    'http://d.com/path' === actual
  );
  helper.showLog(
    'makeUrl()', 
    '',
    actual = utils.makeUrl('http://d.com', 'path', {foo:"foo"}),
    'http://d.com/path?foo=foo' === actual
  );

  // readBlob
  let middle, content;
  const testTxt = 'abcdefg';
  const testBlob = new Blob([testTxt], {type: 'text/plain'});

  middle = await utils.readBlob(testBlob);
  content = utils.arrayBufferToText(middle);
  helper.showLog("readBlob()", testTxt, middle, testTxt === content);

  content = await utils.readBlob(testBlob, 'text');
  helper.showLog("readBlob(,'text')", testTxt, content, testTxt === content);

  middle = 'YWJjZGVmZw==';
  content = await utils.readBlob(testBlob, 'base64');
  helper.showLog("readBlob(,'base64')", middle, content, middle === content);

  middle = 'data:text/plain;base64,YWJjZGVmZw==';
  content = await utils.readBlob(testBlob, 'uri');
  helper.showLog("readBlob(,'uri')", middle, content, middle === content);
}

export default () => {
  return <helper.TestButton title="utilsFunc" onPress={utilsFunc}/>
};