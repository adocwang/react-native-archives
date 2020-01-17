import utils from './utils';
import {getMime} from './fileSystem';
import {makePlusRequest, xmlFetch} from './fetchPlus';

// reqeust kv 数据管理
// 设置
// 1. header(String key, any value) 重置 key-value
// 2. header(String key, any value, true) 追加 key-value
// 3. header({a:1})  批量设置
// 4. header({a:1}, true) 批量设置(追加)
// 5. header({a:1}, false) 清空所有已设置,并重置为指定值
// 移除
// 1. header(String key, null) 删除指定 key
// 2. header(Array keys, null) 批量删除 key
// 3. header(null)  清空
// 获取
// 1. header()  获取所有值
// 2. header(String key) 获取指定 key 值
// 3. header(Array keys) 批量获取值
// 备注
// cookie 不支持 一对多设置, 追加操作无效, 会当做重置处理, 如 cookie(key, value, true)
function manageProps(req, prop, args) {
  const len = args.length;
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
        someAttr[k] = attrs[k];
      })
      return someAttr;
    }
    // get one
    if (!objKey) {
      return attrs[key];
    }
  }
  // batch set
  if (objKey) {
    let add = false;
    const flag = len > 1 ? Boolean(args[1]) : null;
    if (flag !== null) {
      if (flag) {
        // 追加
        add = prop !== '_cookies';
      } else {
        // 重置
        req[prop] = {};
      }
    }
    for (let k in key) {
      if (key.hasOwnProperty(k)) {
        addProps(
          req[prop],
          k,
          key[k],
          flag !== false && k in attrs, 
          add
        );
      }
    }
    return req;
  }
  // batch delete
  if (arrKey) {
    key.forEach(k => {
      if (k in attrs) {
        delete attrs[k];
      }
    })
    return req;
  }
  key = String(key);
  const value = args[1],
        exist = key in attrs,
        add = len > 2 && prop !== '_cookies' && args[2];
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
function sendRequest(req, method, resolve) {
  const original = req.original;
  const request = req._request;

  // method
  let reqMethod = original.method;
  if (request.method) {
    reqMethod = request.method;
    delete request.method;
  }
  if (method) {
    reqMethod = method;
  }
  original.method = reqMethod;

  // url query
  let url = original.url;
  if (request.url) {
    url = request.url;
    delete request.url;
  }
  original.url = utils.makeUrl(req.service.baseUrl, url, req._queries);

  // header
  const reqHeader = original.headers;
  const headers = req._headers;
  for (let k in headers) {
    if (Array.isArray(headers[k])) {
      headers[k].forEach(v => {
        reqHeader.append(k, v);
      })
    } else {
      reqHeader.set(k, headers[k]);
    }
  }

  // cookie: 
  // 1. 根据 RFC 6265 说明, key=value 中的 key 使用 RFC 2616 token
  //    这在理论上就意味着 key 并不是任何字符都可以
  //    可能有些老的服务端程序使用了字符以为的, 这在以前是可以的
  //    一般情况下, 也没人去使用特殊字符, 所以这里就不判断了, 直接整
  // 2. 实测 credentials(true) 情况下, 如果所请求网站不曾缓存过cookie, 有效, 否则会被替换为缓存的cookie
  //    所以如果需要强制使用手动设置的 cookie, 需调用 credentials(false) 
  const cookies = [];
  for (let k in req._cookies) {
    cookies.push(k + '=' + req._cookies[k]);
  }
  if (cookies.length) {
    reqHeader.append('Cookie', cookies.join('; '));
  }

  // timeout
  if (request.timeout) {
    original.timeout = utils.getNumber(request.timeout, 0);
    delete request.timeout;
  }

  // res blob
  if (request.resBlob) {
    delete request.resBlob;
  } else {
    original.resText = true;
  }

  // 其他 init 属性
  for (let k in request) {
    if (k === 'referrer') {
      reqHeader.set('Referer', request[k])
    }
    original[k] = request[k];
  }

  // body 
  // method 允许 body 才进行解析, 优先级: payload > (params & files)
  // original 为 Request 对象, rn 使用的 github fetch polyfill
  // TODO: _bodyInit _initBody 是其私有方法, 不是很安全(比如 rn 哪天换了这个组件, 或者这个 polyfill 修改了)
  // 但眼下也没其他更好的方案了, 若真的有变动, 只能重写 polyfill 了, 眼下犯不着
  let needBody = !reqMethod || (reqMethod !== 'GET' && reqMethod !== 'HEAD');
  if (needBody && request.payload) {
    needBody = false;
    let payload = request.payload;
    delete request.payload;
    if (typeof payload === 'object') {
      payload = JSON.stringify(payload);
    }
    original._initBody(payload);
  }
  return new Promise(cb => {
    if (needBody) {
      makeRequestBody(
        req._params, 
        req._files, 
        original._bodyInit && FormData.prototype.isPrototypeOf(original._bodyInit) ? original._bodyInit : null, 
        cb
      )
    } else {
      cb();
    }
  }).then(body => {
    if (body) {
      if (typeof body === 'string') {
        reqHeader.set('content-type', 'application/x-www-form-urlencoded;charset=UTF-8');
      }
      original._initBody(body);
    }
    return xmlFetch(original)
  }).then(req._onResponse).catch(req._onError).then(resolve)
}

// 格式化 Post params/files
function makeRequestBody(params, files, formData, cb) {
  const pkeys = Object.keys(params);
  const fkeys = Object.keys(files);
  if (!pkeys.length && !fkeys.length) {
    return cb(formData);
  }
  // 原始 request body 不是 FormData 且 不含文件
  // 返回 string  使用 application/x-www-form-urlencoded header 请求
  if (!formData && !fkeys.length) {
    return cb(utils.makeParams(params, true));
  }
  const form = formData ? formData : new FormData();
  // params
  pkeys.forEach(k => {
    (Array.isArray(params[k]) ? params[k] : [params[k]]).forEach(v => {
      form.append(k, typeof v === 'string' ? v : JSON.stringify(v))
    })
  });
  if (!fkeys.length) {
    return cb(form);
  }
  // files 
  const sendFiles = [];
  const mimeIndexs = [];
  const mimeNames = [];
  let index = 0;
  fkeys.forEach(k => {
    (Array.isArray(files[k]) ? files[k] : [files[k]]).forEach(v => {
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
  if (!mimeIndexs.length) {
    return injectFiles(form, sendFiles, cb);
  }
  // 若未指定 mime, 通过 fs 接口先获取 mime 再提交
  getMime(mimeNames).then(types => {
    types.forEach((t, i) => {
      sendFiles[mimeIndexs[i]].type = t;
    })
    injectFiles(form, sendFiles, cb)
  })
}
function injectFiles(form, files, cb) {
  files.forEach(file => {
    const key = file.key;
    delete file.key;
    form.append(key, file);
  })
  cb(form);
}


/* 
request 创建器  
TODO: HttpRequest 对象一旦 send, 其内部参数会被修改, 
      看后期需要, 如有必要的话, 在 send 前 clone 一个对象
可链式调用设置各种参数
const request = ServiceRequest
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
  .onHeader(h => {})

关于 file (上传文件)
  在已知情况下, 尽量完整设置
    request.file('fileName', {
      uri: (String) fileUri,
      type: mini 类型, 如 "image/jpeg“,
      name: 文件名,
    })

  也可以,会根据后缀自动设置 type
    request.file('fileName', uri);

  参数 uri 允许
    1. 绝对路径 /data/ 
    2. file:// 
    3. content:// (android only)
    4. assets-library:// (iOS only) 

request 可在中途获取参数以便进一步操作
  const method = request.method()
  const query = request.query();

最后
  request.send()
*/
class HttpRequest {
  constructor(service, input, init) {
    this.service = service;
    this.original = makePlusRequest(input, init);

    this._request = {};
    this._headers = {};
    this._cookies = {};
    this._queries = {};
    this._params = {};
    this._files = {};

    this._onError = service.onError.bind(service);
    this._onResponse = service.onResponse.bind(service);

    // 通过代理让 HttpService 对象可以补充 HttpRequest 方法
    return new Proxy(this, {
      get(obj, prop) {
        if (prop in obj) {
          return obj[prop];
        }
        if (typeof obj.service[prop] === 'function') {
          return (...args) => {
            args.unshift(obj);
            obj.service[prop].apply(obj.service, args)
            return obj;
          }
        }
      }
    });
  }

  // request 基础属性的 设置/获取
  // 备注: 通过 header params 函数设置的属性不会同步到 init 中, 而是在 fetch 时进行同步
  _init(key, args){
    const len = args.length;
    const request = this._request;
    if (!len) {
      return key in request ? request[key] : this.original[key];
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
  // 设置/获取 fetchPlus 支持的属性, 比如 mode/redirect 等
  init() {
    const len = arguments.length;
    if (len > 1) {
      return this._init(arguments[0], [arguments[1]]);
    } else if (len > 0) {
      return this._init(arguments[0], []);
    }
    const props = {};
    const request = this._request;
    const original = this.original;
    for (let k in original) {
      if (original.hasOwnProperty(k)) {
        props[k] = original[k];
      }
    }
    for (let k in request) {
      props[k] = request[k];
    }
    return props
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
  payload(){
    return this._init('payload', arguments);
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
  // 考虑到 Service 一般用于 api 查询, 
  // 为防止内存泄露, 不特别指定的话, 不支持 blob 返回值
  resBlob(){
    return this._init('resBlob', arguments);
  }
  saveTo(){
    return this._init('saveTo', arguments);
  }
  keepBlob(){
    return this._init('keepBlob', arguments);
  }
  // 安装信号
  // @see https://developers.google.com/web/updates/2017/09/abortable-fetch
  signal(){
    return this._init('signal', arguments);
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

  // 快捷 header
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
    return new Promise(resolve => {
      try {
        sendRequest(this, method, resolve);
      } catch (e) {
        resolve(this._onError(e))
      }
    })
  }
  post(){
    return this.send('POST');
  }
}


/*
导出类 
不建议直接使用 HttpService, 而是在其基础进行扩展, 如
------------------------------------------------------------
class Service extends HttpService {
  // handle 当前 Service 的错误进行上报
  onError(err){
  }
  
  // 可针对当前 Service 所有 response 集中进行通用处理
  // 比如默认情况下 fetch 404 也被认为是成功, 这里可以抛个错来中断
  // 且抛错在 onError 中也能捕获
  onResponse(res){
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

  // 快捷方法扩充
  asChrome(request){
    request.userAgent('chrome/71')
  }
  withToken(request, token){
    request.header('X-Reuest-Token', token)
  }

  
  // Service API
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
    const rsJson = await rs.json();
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
    return res
  }
  request(input, init) {
    return new HttpRequest(this, input, init);
  }
}

module.exports = HttpService;