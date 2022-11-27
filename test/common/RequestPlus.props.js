import React from 'react';
import helper from './../helper';
import {RequestPlus} from "./../../index";

// RequestPlus 除 body 外的基本属性测试
const requestPlus_Props = async () => {
  const url = "https://postman-echo.com/post";
  const controller = new AbortController();
  const info = {
    credentials:"omit",
    method:"GET",
    mode:"cors",
    signal:controller.signal,
    referrer:"https://postman-echo.com",
    headers:{
      "user-agent": "Mozilla/5.0",
      "content-type": "image/jpeg"
    },
  };
  const callback=()=>{};
  const extend = {
    timeout:2,
    saveTo:"path",
    keepBlob:true,
    resText:true,
    onHeader:callback,
    onUpload:callback,
    onDownload:callback,
  }
  const options = {...info, ...extend};
  const fullInfo = {...options, url};
  const getHeaderAll = (header) => {
    const obj = {};
    for (var pair of header.entries()) {
      obj[pair[0]] = pair[1];
    }
    return obj;
  }
  const checkInfo = (title, req) => {
    helper.prtLog(req)
    let same=true, actual, expected;
    for (let k in fullInfo) {
      actual = req[k];
      expected = fullInfo[k];
      if ('headers' === k) {
        if (JSON.stringify(expected) != JSON.stringify(getHeaderAll(actual))) {
          same=false;
          helper.showLog(k, expected, actual, false);
        }
      } else if (actual !== expected) {
        same=false;
        helper.showLog(k, expected, actual, false);
      }
    }
    if (same) {
      helper.showLog('check ' + title, true);
    } else {
      helper.showLog('check ' + title, false);
    }
  };

  // check method: 有 body 的情况下自动设置为 POST
  let req, ex, ac;
  req = new RequestPlus('/');
  helper.showLog('req method', ex = null, ac = req.method, ex === ac);
  req = new RequestPlus('/', {body:'a'});
  helper.showLog('req method', ex = null, ac = req.method, ex === ac);
  req = new RequestPlus('/', {body:'a', method:'POST'});
  helper.showLog('req method', ex = 'POST', ac = req.method, ex === ac);
  req = new RequestPlus('/', {method:'GET'});
  helper.showLog('req method', ex = 'GET', ac = req.method, ex === ac);

  // check instance
  checkInfo('RequestPlus(url, options)', new RequestPlus(url, options));
  checkInfo('RequestPlus(options)', new RequestPlus(fullInfo));

  const basicReq = new RequestPlus(url, info);
  checkInfo('RequestPlus(req, options)', new RequestPlus(basicReq, extend));

  const orgReq = new Request(url, info);
  for (let ek in extend) {
    orgReq[ek] = extend[ek];
  }
  // 原始 Request 不支持 referrer
  orgReq.referrer = info.referrer;
  checkInfo('request+extend', orgReq);
}

export default () => {
  return <helper.TestButton title="RequestPlus.props" onPress={requestPlus_Props}/>
};