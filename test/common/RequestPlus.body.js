import React from 'react';
import helper from './../helper';
import {utils, BlobPlus, RequestPlus, ResponsePlus} from "./../../index";

// RequestPlus/ResponsePlus body 功能同, 所以这里合并测试
export const checkPlusBody = async (isRequest) => {
  const create = (body) => {
    if (isRequest) {
      return new RequestPlus({
        method:'POST',
        body
      })
    }
    return new ResponsePlus(body);
  };
  const checkBody = async (body, str) => {
    let res, payload, temp;
    helper.prtLog('✸✸ init body ✸✸:', body);

    res = create(body);
    payload = await res.text();
    helper.showLog('text()', str, payload, str === payload);

    res = create(body);
    payload = await res.formData();
    helper.showLog('formData()', str, payload, payload instanceof FormData);

    res = create(body);
    payload = await res.blob();
    temp = payload instanceof BlobPlus ? await payload.text() : null;
    helper.showLog('blob()', str, payload, str === temp);

    res = create(body);
    payload = await res.arrayBuffer();
    temp = payload instanceof ArrayBuffer ? utils.arrayBufferToText(payload) : null;
    helper.showLog('arrayBuffer()', str, payload, str === temp);

    try {
      res = create(body);
      payload = await res.json();
      helper.showLog('json()', str, payload, str === JSON.stringify(payload));
    } catch(e) {
      helper.showLog('not support json()', str, e.message, true);
    }
  }
  const obj = {foo: "foo"};

  // string
  const payload = JSON.stringify(obj);
  await checkBody(payload, payload);

  // obj
  await checkBody(obj, payload);

  // URLSearchParams
  const us = new URLSearchParams();
  us.append('foo', 'foo');
  us.append('bar', 'bar');
  await checkBody(us, 'foo=foo&bar=bar');

  // blob
  const blob = new Blob([payload]);
  await checkBody(blob, payload);

  // ArrayBuffer
  const buff = utils.textToArrayBuffer(payload);
  await checkBody(buff, payload);

  // DataView
  const dataView = new DataView(utils.textToArrayBuffer(payload));
  await checkBody(dataView, payload);
}

const requestPlus_Body = async () => {
  await checkPlusBody(true);
}

export default () => {
  return <helper.TestButton title="RequestPlus.body" onPress={requestPlus_Body}/>
};