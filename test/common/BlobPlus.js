import React from 'react';
import helper from './../helper';
import {utils, BlobPlus} from "./../../index";

const blobPlus = async () => {
  let actual, str = 'abcdeft', blob = new BlobPlus([str], {type: 'text/plain'});
  helper.prtLog(blob);

  actual = await blob.text();
  helper.showLog('blob text()', str, actual, actual === str);

  actual = await blob.arrayBuffer();
  helper.showLog('blob arrayBuffer()', str, actual, utils.arrayBufferToText(actual) === str);

  actual = await blob.base64();
  helper.showLog(
    'blob base64()', str, actual,
    utils.arrayBufferToText( utils.base64ToArrayBuffer(actual) ) ===  str
  );

  actual = await blob.dataUrl();
  helper.showLog(
    'blob dataUrl()', str, actual,
    actual === 'data:text/plain;base64,' + utils.arrayBufferToBase64( utils.textToArrayBuffer(str) )
  );

  const blobSlice = blob.slice(2, 5);
  actual = await blobSlice.text();
  helper.showLog('blob slice()', 'cde', actual, 'cde' === actual);

  actual = await blob.text();
  helper.showLog('blob text()', str, actual, actual === str);
  
  actual = await (new BlobPlus([blob])).text();
  helper.showLog('blob->blobPlus', str, actual, actual === str);
  blob.close();
}

export default () => {
  return <helper.TestButton title="BlobPlus" onPress={blobPlus}/>
};