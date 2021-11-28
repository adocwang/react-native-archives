import utils from './utils';
import {getMime} from './fileSystem';
import {RequestPlus, fetchExtend, fetchPlus} from './fetchPlus';
const requestInit = fetchExtend.concat([
  'url', 'mode', 'method', 'signal', 'credentials', 'referrer'
]);

/** 
 * Reqeust kv 数据管理
 * 用于 header/cookie/query/param/file
 * 其中 header 的 key 值不区分大小写
 * 
 * 设置指定 key
 * 1. header(String key, any value) 重置 key-value
 * 2. header(String key, any value, true) 追加 key-value
 * 3. header(String key, null) 删除指定 key
 * 4. header(Array keys, null) 批量删除 key
 * 
 * 批量设置
 * 1. header({a:1}) 批量设置所给 kv
 * 2. header({a:1}, true) 批量设置(追加) 所给 kv
 * 3. header({a:1}, false) 清空所有已设置,并重置为指定值
 * 4. header(null) 清空
 * 
 * 获取
 * 1. header() 获取所有值
 * 2. header(String key) 获取指定 key 值
 * 3. header(Array keys) 批量获取值
 */
function manageProps(req, prop, args) {
  const len = args.length;
  const supportArr = true;
  const isHeader = '_headers' === prop;
  const pskey = key => {
    return isHeader ? key.toLowerCase() : key;
  };
  // get all
  if (len < 1) {
    return req[prop];
  }
  let key = args[0];
  const nullKey = key === null;
  // clear
  if (nullKey) {
    req[prop] = {};
    return req;
  }
  const attrs = req[prop];
  const arrKey = Array.isArray(key);
  const objKey = !arrKey && typeof key === 'object';
  if (len < 2) {
    // get batch
    if (arrKey) {
      const someAttr = {};
      key.forEach(k => {
        k = pskey(k);
        someAttr[k] = attrs[k];
      })
      return someAttr;
    }
    // get one
    if (!objKey) {
      return attrs[pskey(key)];
    }
  }
  // batch set
  if (objKey) {
    let add = false;
    const flag = len > 1 ? Boolean(args[1]) : null;
    if (flag !== null) {
      if (flag) {
        // 追加
        add = supportArr;
      } else {
        // 重置
        req[prop] = {};
      }
    }
    let sk;
    for (let k in key) {
      if (key.hasOwnProperty(k)) {
        sk = pskey(k);
        addProps(
          req[prop],
          sk,
          key[k],
          flag !== false && sk in attrs,
          add
        );
      }
    }
    return req;
  }
  // batch delete
  if (arrKey) {
    key.forEach(k => {
      k = pskey(k);
      if (k in attrs) {
        delete attrs[k];
      }
    })
    return req;
  }
  key = pskey(key);
  const value = args[1],
        exist = key in attrs,
        add = len > 2 && supportArr && args[2];
  if (value !== null) {
    // set|add
    addProps(attrs, key, value, exist, add);
  } else if (exist) {
    // delete
    delete attrs[key];
  }
  return req;
}

function addProps(attrs, key, value, exist, add) {
  if (!add || !exist){
    attrs[key] = value;
  } else if (Array.isArray(attrs[key])) {
    attrs[key].push(value);
  } else {
    attrs[key] = [attrs[key], value];
  }
}

// 发送请求
async function sendRequest(req, method) {
  const request = {...req._request};
  // method
  if (method) {
    request.method = method;
  }
  // url + query
  request.url = utils.makeUrl(
    req.service.baseUrl, request.url||'', req._queries
  );
  // headers, cookie
  const headers = req._headers;
  const cookie = utils.makeCookie(req._cookies);
  if (cookie) {
    headers.cookie = cookie;
  }
  request.headers = headers;
  //credentials
  const credentials = request.credentials||'';
  if (cookie && 'include' !== credentials && 'omit' !== credentials) {
    request.credentials = 'omit';
  }
  // timeout
  if (request.timeout) {
    request.timeout = utils.getNumber(request.timeout, 0);
  }
  // res blob
  if (request.resBlob) {
    delete request.resBlob;
  } else {
    request.resText = true;
  }
  // send body (payload 优先 > params & files 次之)
  if ('payload' in request) {
    const payload = request.payload;
    delete request.payload;
    if (null !== request.payload) {
      request.body = payload;
      return fetchPlus(request);
    }
  }
  // 是否有 params/files
  const params = req._params,
    files = req._files,
    pkeys = Object.keys(params),
    fkeys = Object.keys(files),
    form = fkeys.length ? new FormData() : (
      pkeys.length ? new URLSearchParams() : null
    );
  if (!form) {
    return fetchPlus(request);
  }
  // params
  pkeys.forEach(k => {
    let param = params[k];
    if (Array.isArray(param)) {
      k = k + '[]';
    } else {
      param = [param];
    }
    param.forEach(v => {
      form.append(k, v)
    })
  });
  if (!fkeys.length) {
    request.body = form;
    return fetchPlus(request);
  }
  // files
  let index = 0;
  const mimeIndexs = [];
  const mimeNames = [];
  const sendFiles = [];
  fkeys.forEach(k => {
    let file = files[k];
    if (Array.isArray(file)) {
      k = k + '[]';
    } else {
      file = [file];
    }
    file.forEach(v => {
      v = typeof v === 'string' ? {uri: v} : v;
      let {uri, type, name} = v||{};
      if (!uri) {
        throw 'File `' + k + '` does not has uri field';
      }
      if (!/^[a-zA-Z]+:\/\//.test(uri)) {
        uri = 'file://' + uri;
      }
      if (!name) {
        name = uri.substr(uri.lastIndexOf('/') + 1);
      }
      if (!type){
        mimeIndexs.push(index);
        mimeNames.push(uri);
      }
      sendFiles.push({key:k, uri, type, name})
      index++;
    })
  });
  if (mimeIndexs.length) {
    const types = await getMime(mimeNames);
    types.forEach((t, i) => {
      sendFiles[mimeIndexs[i]].type = t;
    })
  }
  sendFiles.forEach(file => {
    const key = file.key;
    delete file.key;
    form.append(key, file);
  })
  request.body = form;
  return fetchPlus(request);
}

/* 
一、使用说明
  1.request 创建器, 可链式调用设置各种参数
    const request = new HttpRequest(service, input, options)
      .url('')
      .method('GET')
      .credentials(true)
      .timeout(30)
      .referrer('http')
      .header('a', 'a')
      .query('a','a')
      .cookie('c', 'c')
      .param('x', 'x')
      .file('img', {})
      .payload('aa')
      .onHeader(h => {});

  2.可在中途通过 request 获取参数以便进一步操作, 如
    const query = request.query();
    const method = request.method();

  3.最后发送请求, 可以不设置 method, 会自动根据是否有 body 使用 POST 或 GET
    request.send();
    request.send('PUT');

二、如果是 POST, 设置的 body 的优先级将按照以下顺序
  1.payload(
      null|string|URLSearchParams|FormData|Blob|ArrayBuffer|DataView
    )
    发送 body 为所设之值

  2.通过 param() / file() 设置 post 键值对 
    如果 new HttpRequest() 初始化的 body 参数为 URLSearchParams|FormData
    那么通过 param() / file() 所设键值对将与初始化参数合并后作为 post body
    否则将忽略初始化的参数, 仅以 param() / file() 所设值最为 post body

三、关于 cookie
   RN 请求网站后, 会将网站响应的 set-cookie 缓存起来, 下次请求会携带缓存的 cookie;
   也可以通过 cookie() 或 header() 方法手动设置的 header cookie.
   但二者只能发送其一, 而不能合并后发送。默认情况下，手动设置的 header cookie 优先级高.
   可以通过 credentials(true|false) 强制设置是否发送缓存的 cookie

四、关于使用 file() 方法上传文件
  1.在已知情况下, 尽量完整设置
    request.file('fileName', {
      uri: (String) fileUri,
      type: mini 类型, 如 "image/jpeg“,
      name: 文件名,
    })

  2.也可直接设置 uri,会根据后缀自动设置 type
    request.file('fileName', uri);

  3.参数 uri 允许
    1. 绝对路径 /data/
    2. file://
    3. content:// (android only)
    4. assets-library:// (iOS only)
*/
class HttpRequest {
  constructor(service, input, options) {
    options = options||{};
    this.service = service;
    this._onError = service.onError.bind(service);
    this._onResponse = service.onResponse.bind(service);

    // request
    const request = {};
    if (options.cache) {
      delete options.cache;
      request.cache = options.cache;
    }
    const original = new RequestPlus(input||'', options);
    requestInit.forEach(k => {
      if (original.hasOwnProperty(k)) {
        request[k] = original[k];
      }
    });
    this._request = request;

    // headers & cookies
    const headers = {};
    let pair, key, val, cookies = '';
    for (pair of original.headers.entries()) {
      key = pair[0];
      if ('cookie' === key) {
        cookies = pair[1];
        continue;
      }
      val = pair[1].split(',').map(v => v.trim());
      headers[key] = val.length > 1 ? val : val[0]; 
    }
    this._headers = headers;
    this._cookies = utils.parseCookie(cookies);

    // queries & params & files
    let parts, form;
    const files = {};
    const params = {};
    const body = original._bodyInit;
    if (URLSearchParams.prototype.isPrototypeOf(body)) {
      parts = body;
    } else if (FormData.prototype.isPrototypeOf(body)) {
      form = true;
      parts = body._parts;
    }
    if (parts) {
      for ([key, val] of parts) {
        pair = form && 'object' === typeof val ? files : params;
        if (Array.isArray(pair[key])) {
          pair[key].push(val);
        } else if (key in pair) {
          pair[key] = [pair[key], val];
        } else {
          pair[key] = val;
        }
      }
    }
    this._queries = {};
    this._files = files;
    this._params = params;

    // 通过代理让 HttpService 对象可以补充 HttpRequest 方法
    return new Proxy(this, {
      get(req, prop) {
        if (prop in req) {
          return req[prop];
        }
        if (typeof req.service[prop] === 'function') {
          return (...args) => {
            args.unshift(req);
            req.service[prop].apply(req.service, args)
            return req;
          }
        }
      }
    });
  }
  // request 基础属性的 设置/获取
  // 备注: 通过 header params 函数设置的属性不会同步到 init 中, 而是在 fetch 时进行同步
  _init(key, args){
    const request = this._request;
    if (!args.length) {
      return request[key];
    }
    const value = args[0];
    switch (key) {
      case "method":
        request[key] = utils.normalizeMethod(value);
        break;
      case "credentials":
        request[key] = value === true ? 'include' : (value === false ? 'omit' : value);
        break;
      default:
        request[key] = value;
        break;  
    }
    return this;
  }
  // 设置/获取 fetchPlus 支持的属性
  init() {
    const len = arguments.length;
    if (len > 1) {
      return this._init(arguments[0], [arguments[1]]);
    }
    if (len > 0) {
      return this._init(arguments[0], []);
    }
    return this._request;
  }
  url() {
    return this._init('url', arguments);
  }
  method() {
    return this._init('method', arguments);
  }
  timeout() {
    return this._init('timeout', arguments);
  }
  credentials() {
    return this._init('credentials', arguments);
  }
  referrer(){
    return this._init('referrer', arguments);
  }
  onHeader(){
    return this._init('onHeader', arguments);
  }
  onUpload(){
    return this._init('onUpload', arguments);
  }
  onDownload(){
    return this._init('onDownload', arguments);
  }
  // 安装信号
  // @see https://developers.google.com/web/updates/2017/09/abortable-fetch
  signal(){
    return this._init('signal', arguments);
  }
  // 为防止内存泄露, 默认响应为 text, 可通过该方法设置响应 blob
  resBlob(){
    return this._init('resBlob', arguments);
  }
  // 设置保存路径, 保存后会自动关闭 blob, 除非指定 keepBlob()
  saveTo(){
    return this._init('saveTo', arguments);
  }
  keepBlob(){
    return this._init('keepBlob', arguments);
  }
  // 若不设置或设置为 null, 则使用 param/file, 否则使用 payload
  payload(){
    return this._init('payload', arguments);
  }
  // 设置/获取 header, cookie, query, param, file
  header(){
    return manageProps(this, '_headers', arguments);
  }
  cookie(){
    return manageProps(this, '_cookies', arguments);
  }
  query(){
    return manageProps(this, '_queries', arguments);
  }
  param(){
    return manageProps(this, '_params', arguments);
  }
  file(){
    return manageProps(this, '_files', arguments);
  }
  // 设置 header 的快捷方法 
  auth(token) {
    return this.header('Authorization', token);
  }
  userAgent(userAgent) {
    return this.header('User-Agent', userAgent);
  }
  asAjax(){
    return this.header({
      'Accept': 'application/json',
      'X-Request': 'JSON',
      'X-Requested-With': 'XMLHttpRequest',
    });
  }
  // 发送
  send(method){
    return sendRequest(this, method).then(
      this._onResponse
    ).catch(this._onError);
  }
  // 发送并获取返回的 json
  // 此类 API 较为常见, 但返回的是 json, 而不是 Reponse 对象
  // 在需要读取 text body 或 headers 的情况下不适用
  async json(method){
    const r = await this.send(method);
    return r.json();
  }
}


/* 导出类 
不建议直接使用 HttpService, 而是在其基础进行扩展, 如
------------------------------------------------------------
class Service extends HttpService {
  // handle 当前 Service 的错误进行上报
  onError(err){
    throw err;
  }
  
  // 可针对当前 Service 所有 response 集中进行通用处理
  // 比如默认情况下 fetch 404 也被认为是成功, 这里可以抛个错来中断
  // 且抛错在 onError 中也能捕获
  onResponse(res){
    if (!res.ok) {
      throw new TypeError('Network request failed')
    }
    return res;
  }

  // 设计一个通用 header 的 api, 发送一些公用信息, 比如设备信息之类的
  // 然后重写 request 方法, 带上通用 header
  commonHeader = {};
  setCommonHeader(header){
    this.commonHeader = header;
  }
  request(input, init){
    return super.request(input, init).header(this.commonHeader)
  }

  // 可扩充一些快捷方法
  asChrome(request){
    request.userAgent('chrome/71')
  }
  withToken(request, token){
    request.header('X-Reuest-Token', token)
  }
  
  // API 举例
  login(name, pass){
    return this.request('/login').param({
      name, pass
    }, false).send()
  }
  updateAvatar(file){
    return this.request('/updateAvatar')
      .withToken('dddd')
      .param('avatar', file)
      .send()
  }
}
export default new Service('https://host.com');


在其他地方 就可以这么用了
------------------------------------------------------------

import React from 'react';
import service from './Service';

class Page extends React.Component {

  // promise 异步方式
  _foo(){
    service.request('/foo').query('a', 'a').send().then()
    service.request('/foo').asChrome().send().then()
    service.request('/foo').withToken('token').send().then()
    service.login(name, pass).then()
  }

  // await async 伪同步方式
  async _bar() {
    const rs = await service.login(name, pass);
    const rsHeader = rs.headers;
    const rsJson = await rs.json();
    
    // 或者直接获取 json
    const rsJson = await service.request().json();
  }
}
*/
class HttpService {
  constructor(baseUrl) {
    this.baseUrl = baseUrl;
  }
  onError(err){
    throw err;
  }
  onResponse(res){
    return res;
  }
  request(input, options) {
    return new HttpRequest(this, input, options);
  }
}

module.exports = HttpService;