import React from 'react';
import helper from './../helper';
import {utils, ResponsePlus, HttpService} from "./../../index";

// 判断 actual 是否包含 sub 设置的值
const isContains = (sub, actual, eq) => {
  if (!actual) {
    return false;
  }
  let contains = true, index = 0;
  for (let k in sub) {
    if (!actual.hasOwnProperty(k) || actual[k] !== sub[k]) {
      contains = false;
      break;
    }
    index++;
  }
  if (contains && eq && Object.keys(actual).length !== index) {
    contains = false;
  }
  return contains;
}

const showContains = (tit, sub, actual, eq) => {
  helper.showLog(tit+' contains', sub, actual, isContains(sub, actual, eq));
}

// 基本测试
const testBasicService = async () => {
  let send, res;
  const getServer = 'https://postman-echo.com/get'
  const service = new helper.TestService('https://postman-echo.com/post');

  // header+query
  let header, query;
  send = await service.request(getServer)
    .withToken('tt')
    .header(header = {x:"x", y:"y"})
    .query(query = {foo:"foo", bar:"bar"})
    .send();
  helper.showLog('response', send, ResponsePlus.prototype.isPrototypeOf(send));
  res = await send.json();
  header['x-token'] = 'tt';
  showContains('header', header, res.headers);
  showContains('query', query, res.args);

  // cookie
  res = await service.request(getServer).json();
  helper.showLog('cookie contains', 'cookie', res.headers, 'cookie' in res.headers);

  res = await service.request(getServer).credentials(false).json();
  helper.showLog('cookie not contains', 'cookie', res.headers, !('cookie' in res.headers));

  res = await service.request(getServer).cookie('z', 'z').json();
  helper.showLog('cookie contains custom', 'cookie', res.headers, res.headers.cookie === 'z=z');

  res = await service.request(getServer).credentials(true).cookie('z', 'z').json();
  helper.showLog('cookie not contains custom', 'cookie', res.headers, 'cookie' in res.headers && res.headers.cookie !== 'z=z');

  // param/file
  let params,files;
  res = await service.request().param(params = {foo:'f', bar:'b'}).json();
  showContains('params', params, res.form, true);
  res = await service.request()
    .param(params)
    .file({img: helper.Assets.RemotePng})
    .json();
  showContains('params', params, res.form, true);
  helper.showLog(
    'files contains', files = Object.keys(res.files),
    JSON.stringify(files) === JSON.stringify(['logo.png'])
  );

  // payload 优先
  let payload;
  res = await service.request()
    .param(params)
    .file({img: helper.Assets.RemotePng})
    .payload(payload = 'str')
    .json();
  helper.showLog('payload priority', payload, res.data, res.data === payload); 

  // service 内部函数
  let rjson = {t:"test"};
  res = await service.test();
  helper.showLog(
    'service custom func', rjson, res.json, 
    JSON.stringify(rjson) === JSON.stringify(res.json)
  );
}

// Mock 数据
const MockData = {
  'http://foo.dev/mock': async (res) => {
    res.send({code:0, msg:'ok'}, 20)
  },
  '/getmock': async (res, req) => {
    const data = {url: req.url, args:{}, headers:{}};
    const index = req.url.indexOf('?');
    if (index > -1) {
      data.args = utils.parseQuery(req.url.substring(index+1))
    }
    req.headers.forEach((val, key) => {
      data.headers[key] = val
    })
    res.send(data)
  },
}

// Mock 测试, 根据 hold 值进行 hook 处理
class MockService extends HttpService {
  async onRequest(req){
    const hold = req.query('hold');
    if (hold === 'req' || hold === 'both') {
      req.header('fighter', 'J20');
    }
    return req
  }
  async onResponse(res){
    const copy = res.clone();
    try {
      const json = await res.json();
      if (json.args && (json.args.hold === 'res' || json.args.hold === 'both')) {
        json.injection = true;
        return new ResponsePlus(json, {
          status: res.status,
          statusText: res.statusText,
          headers: new Headers(res.headers),
          url: res.url
        })
      }
      return copy
    } catch {
      return copy
    }
  }
}

const testMockService = async () => {
  const service = new MockService('https://postman-echo.com', MockData);

  // onRequest/onResponse | skipOnRequest/skipOnResponse
  const testHook = async (uri, req, res) => {
    const skip = typeof req === 'string' ? req : false;
    if (skip) {
      req = res = true;
    }
    const bHeader = {x:"x", y:"y"}, cHeader = {fighter:"J20"};
    const hold = req ? (res ? 'both' : 'req') : (res ? 'res' : 'none');
    const net = service.request(uri).query('hold', hold).header(bHeader);
    if (skip === 'req') {
      req = false;
      net.skipOnRequest();
    } else if (skip === 'res') {
      res = false;
      net.skipOnResponse();
    } else if (skip === 'both') {
      req = res = false;
      net.skipOnRequest().skipOnResponse();
    }
    const json = await net.json();
    const headers = json.headers;
    const hookRes = json && json.injection;
    const hookReq = isContains(cHeader, headers);
    let tit = 'hook none', equal = isContains(bHeader, headers);
    if (req && res) {
      tit = 'hook both'
      equal = equal && hookReq && hookRes;
    } else if (req) {
      tit = 'hook request'
      equal = equal && hookReq && !hookRes;
    } else if (res) {
      tit = 'hook response'
      equal = equal && !hookReq && hookRes;
    }
    helper.showLog(tit, headers, equal);
  }
  const testHookBatch = async (uri) => {
    await testHook(uri, false, false);   // hook none
    await testHook(uri, true, false);    // hook request
    await testHook(uri, false, true);    // hook response
    await testHook(uri, true, true);    // hook both
    await testHook(uri, 'req');    // skip request hook
    await testHook(uri, 'res');    // skip response hook
    await testHook(uri, 'both');    // skip both hook
  }
  helper.prtLog('✸✸ Test Service Hook ✸✸');
  await testHookBatch('/get');
  helper.prtLog('✸✸ Test Mock Hook ✸✸');
  await testHookBatch('/getmock');

  // test full url
  const res = await service.request(helper.Assets.RemoteTxt).send();
  const text = await res.text();
  helper.showLog('full url', text, text === 'abcdefg');

  // test mock url
  const json = await service.request('http://foo.dev/mock').json();
  showContains('mock url', {code:0, msg:'ok'}, json, true);
}

const httpService = async () => {
  await testBasicService();
  await testMockService();
}

export default () => {
  return <helper.TestButton title="HttpService" onPress={httpService}/>
};