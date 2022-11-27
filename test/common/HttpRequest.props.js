import React from 'react';
import helper from './../helper';

const httpRequest_Props = async () => {
  const service = new helper.TestService('https://postman-echo.com');
  helper.prtLog('✸✸ check request prop init ✸✸');
  const req = service.request();
  const check = (method, stand) => {
    let v,obj,val;
    v = 'val';
    obj = req.init(method, v);
    val = req.init(method);
    helper.showLog('init '+method, v, val, v === val && obj === req);
    if (stand) {
      v = 'val2';
      obj = req[method](v);
      val = req[method]();
      helper.showLog(method+'()', v, val, v === val && obj === req);
    }
  };
  for (let m of [
    'url', 'method', 'timeout', 'credentials', 'referrer', 'payload',
    'onHeader', 'onUpload', 'onDownload',
    'saveTo', 'keepBlob', 'resBlob', 'signal'
  ]) {
    check(m, true);
  }
  for (let m of ['mode', 'diy']) {
    check(m);
  }
  let v, obj, val;
  obj = req.auth(v = 'auth');
  val = req.header('Authorization');
  helper.showLog('auth()', v, val, v === val && obj === req);

  helper.prtLog('✸✸ check request original ✸✸');
  const init = {
    url:'/ttt',
    mode:'a',
    method:'POST',
    timeout:2,
    credentials:'ab',
    referrer:'ccc',
  };
  const org = service.request(init);
  for (let k in init) {
    helper.showLog(k, init[k], org.init(k), org.init(k) === init[k]);
  }
}

export default () => {
  return <helper.TestButton title="HttpRequest.props" onPress={httpRequest_Props}/>
};