import React from 'react';
import helper from './../helper';
import {utils, fetchPlus} from "./../../index";

const onFetchPlus = async () => {
  let json;
  const postFetch = async (body, headers, props) => {
    headers = headers||{};
    const res = await fetchPlus('https://postman-echo.com/post', {
      resText: true,
      headers,
      body,
      ...props
    });
    return await res.json();
  };

  // customeHeader / referrer / string body
  let hd = 'custom', reurl = 'http://www.react.com';
  json = await postFetch('payload', {'x-custome': hd, referrer: reurl});
  helper.prtLog('✸✸ post string ✸✸', json);
  helper.showLog('res header', hd, json.headers['x-custome'], json.headers['x-custome'] === hd);
  helper.showLog('res referrer', reurl, json.headers['referrer'], json.headers['referrer'] === reurl);
  helper.showLog('res body', 'payload', json.data, json.data === 'payload');

  // object body
  const obj = {foo:"bar", bar:['b', 'z']};
  json = await postFetch(obj);
  helper.prtLog('✸✸ post object ✸✸', json);
  helper.showLog('res json', obj, json.json, JSON.stringify(json.json) === JSON.stringify(obj));

  // Blob body
  const blob = new Blob(['blob'], {type: 'text/html'})
  json = await postFetch(blob);
  helper.prtLog('✸✸ post Blob ✸✸', blob);
  helper.showLog('res header', 'text/html', json.headers['content-type'], json.headers['content-type'] === 'text/html');
  helper.showLog('res body', 'blob', json.data, json.data === 'blob');

  // ArrayBuffer/DataView body
  const checkBuffer = async (buffer, d) => {
    json = await postFetch(buffer);
    helper.prtLog('✸✸ post '+(d ? 'DataView' : 'ArrayBuffer')+' ✸✸', json);
    let resData = 'object' === typeof json.data && 'data' in json.data ? json.data.data : null;
    if (resData) {
      resData = utils.arrayBufferToText(new Uint8Array(json.data.data));
    }
    helper.showLog('res body', 'buffer', resData, resData === 'buffer');
  }
  const buffer = utils.textToArrayBuffer('buffer');
  await checkBuffer(buffer);
  await checkBuffer(new DataView(buffer), true);

  // URLSearchParams
  const foobar = {foo:"foo", 'bar[]':['b', 'r']};
  const us = new URLSearchParams();
  us.append('foo', 'foo');
  us.append('bar[]', 'b');
  us.append('bar[]', 'r');
  json = await postFetch(us);
  helper.prtLog('✸✸ post URLSearchParams ✸✸', json);
  helper.showLog('res form', foobar, json.form, JSON.stringify(json.form) === JSON.stringify(foobar));

  // FormData
  const form = new FormData();
  form.append('foo', 'foo');
  form.append('bar[]', 'b');
  form.append('bar[]', 'r');
  form.append('logo', {
    uri: helper.Assets.RemotePng,
    type: 'image/png',
    name: 'logo.jpg',
  });
  let trigger = {header:false, upload:false, download:false}, props = {};
  props.onHeader = () => {
    trigger.header = true;
  };
  props.onUpload = () => {
    trigger.upload = true;
  };
  props.onDownload = () => {
    trigger.download = true;
  };
  json = await postFetch(form, {}, props);
  helper.prtLog('✸✸ post FormData ✸✸', form);
  helper.showLog('res form', foobar, json.form, JSON.stringify(json.form) === JSON.stringify(foobar));
  helper.showLog('res file', 'logo.jpg', Object.keys(json.files), 'logo.jpg' in json.files);
  helper.showLog('res onHeader trigged', 'Y', trigger.header);
  helper.showLog('res onUpload trigged', 'Y', trigger.upload);
  helper.showLog('res onDownload trigged', 'Y', trigger.download);
}

export default () => {
  return <helper.TestButton title="fetchPlus" onPress={onFetchPlus}/>
};