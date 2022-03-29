import writeFile from './writeFile';
import {DOMException} from 'whatwg-fetch';
import {NativeModules} from 'react-native';
import {readBlob, parseHeader, arrayBufferToText} from './utils';

const {ArchivesModule} = NativeModules;
const fetchListener = ['onHeader', 'onUpload', 'onDownload'];
const fetchExtend = fetchListener.concat(['timeout', 'saveTo', 'keepBlob', 'resText']);

function isPlainObject(value) {
  if (!value || typeof value !== 'object' || ({}).toString.call(value) != '[object Object]') {
    return false;
  }
  var proto = Object.getPrototypeOf(value);
  if (proto === null) {
    return true;
  }
  var Ctor = hasOwnProperty.call(proto, 'constructor') && proto.constructor;
  return typeof Ctor == 'function' && Ctor instanceof Ctor
    && Function.prototype.toString.call(Ctor) === Function.prototype.toString.call(Object);
}

// 读取 Request/Response 为 blob
function getBlob() {
  if (this.bodyUsed) {
    return Promise.reject(new TypeError('Already read'))
  }
  this.bodyUsed = true;
  if (this._bodyFormData) {
    throw new Error('could not read FormData body as blob')
  }
  let key = 'content-type',
    type = this.headers && this.headers.has(key) ? this.headers.get(key).split(';')[0] : null;
  const blobType = type||'application/octet-stream';
  if (this._bodyBlob) {
    if (!(this._bodyBlob instanceof BlobPlus)) {
      const blob = new BlobPlus([this._bodyBlob], {type: blobType});
      this._bodyBlob = blob;
    }
    return Promise.resolve(this._bodyBlob)
  }
  if (this._bodyArrayBuffer) {
    return Promise.resolve(new BlobPlus(
      [arrayBufferToText(this._bodyArrayBuffer)], {type: blobType}
    ))
  }
  return Promise.resolve(new BlobPlus([this._bodyText], {type: type||'text/plain'}))
}

// BlobPlus: 继承并完善扩展 Blob
class BlobPlus extends Blob {
  slice(start, end, contentType){
    const slice = super.slice(start, end);
    const blob = new BlobPlus([slice], contentType ? {type: contentType} : undefined);
    slice.close();
    return blob;
  }
  text(){
    return readBlob(this, 'text')
  }
  arrayBuffer(){
    return readBlob(this, 'buffer')
  }
  base64(){
    return readBlob(this, 'base64')
  }
  dataUrl(){
    return readBlob(this, 'uri')
  }
}

class PlainData {
  constructor(data) {
    this.data = data;
  }
  toString(){
    return JSON.stringify(this.data);
  }
}
const isPlainData = (data) => {
  return PlainData.prototype.isPrototypeOf(data);
}

// RequestPlus: 继承并完善扩展 Request
class RequestPlus extends Request {
  constructor(input, options) {
    input = input||'';
    options = options||{};
    const isRequest = input instanceof Request;

    // 新增功能: 支持使用 object 设置 input 参数
    if (!isRequest && isPlainObject(input)) {
      const ops = {...options};
      const url = input.hasOwnProperty('url') ? input.url : '';
      for (let prop in input) {
        if('url' !== prop && input.hasOwnProperty(prop)) {
          ops[prop] = input[prop];
        }
      }
      input = url;
      options = ops;
    }

    // 修改特性: 支持 referrer 属性 (先缓存->super之后->设置)
    // https://github.com/github/fetch/blob/master/fetch.js#L379
    const referrer = options.referrer||(isRequest ? input.referrer : null);

    // 1. whatwg-fetch 的 Request/Response 会将 DataView 转为 blob
    //    https://github.com/github/fetch/blob/master/fetch.js#L240
    //    然而 RN Blob 不支持 ArrayBuffer 作为数据源, 所以这里在执行 super 前,
    //    先将 body 转为 ArrayBuffer, 而后再将 body 转为原始的 DataView
    // 2. 修复bug: 若 options.body='' 无法覆盖 Request(input) 中的 body 值
    //    https://github.com/github/fetch/blob/master/fetch.js#L359
    // 3. 让 body 支持 PlainData(object|array)
    let body = options.body, original;
    if (undefined === body || null === body) {
      if (isRequest && input._bodyInit != null &&
        DataView.prototype.isPrototypeOf(input._bodyInit)
      ) {
        original = input._bodyInit;
        input._bodyInit = input._bodyInit.buffer;
      }
    } else if ('' === body && isRequest) {
      original = '';
      options.body = '-'
    } else if (DataView.prototype.isPrototypeOf(body)) {
      original = body;
      options.body = original.buffer;
    } else if (isPlainObject(body) || Array.isArray(body)) {
      original = new PlainData(body);
      options.body = new ArrayBuffer();
    }
    // 修改特性: 未指定method + 指定body -> 临时设置 method 为 POST -> 之后改回
    const method = options.method||(isRequest ? input.method : null);
    if (!method && body) {
      options.method = 'POST';
    }
    // 初始化, 并设置缓存的 referrer/body 原值 (在super之前, 不能使用 this)
    super(input, options);
    this.method = method;
    this.referrer = referrer;
    if (undefined !== original) {
      this._bodyInit = original;
      if ('' === original) {
        this._bodyText = '';
      } else if (isPlainData(original)) {
        delete this._bodyArrayBuffer;
        this._bodyText = original.toString();
      }
    }
    // 对 PlainData/ArrayBuffer 设置默认 content-type
    if (!this.headers.get('content-type')) {
      if (this._bodyArrayBuffer) {
        this.headers.set('content-type', 'application/octet-stream');
      } else if (isPlainData(this._bodyInit)) {
        this.headers.set('content-type', 'application/json;charset=UTF-8');
      }
    }
    // 新增 fetchExtend 字段
    const req = isRequest ? input : {};
    fetchExtend.forEach(k => {
      if (k in options) {
        this[k] = options[k]
      } else if (k in req) {
        this[k] = req[k]
      }
    })
  }
  // 修复 blob arrayBuffer 方法, 以 BlobPlus 替代 Blob
  blob() {
    return getBlob.call(this);
  }
  arrayBuffer() {
    return this._bodyArrayBuffer
      ? super.arrayBuffer()
      : this.blob().then(r => r.arrayBuffer());
  }
  clone() {
    return new RequestPlus(this, {body: isPlainData(this._bodyInit) ? this._bodyInit.data : this._bodyInit})
  }
}

// ResponsePlus: 继承并完善扩展 Response
class ResponsePlus extends Response {
  // 与 RequestPlus 类似, 让 bodyInit 支持 DataView/Object|Array(转为 PlainData 缓存) 类型
  constructor(bodyInit, options) {
    var original;
    if (bodyInit) {
      if (DataView.prototype.isPrototypeOf(bodyInit)) {
        original = bodyInit;
        bodyInit = original.buffer;
      } else if (isPlainObject(bodyInit) || Array.isArray(bodyInit)) {
        original = new PlainData(bodyInit);
        bodyInit = new ArrayBuffer();
      }
    }
    super(bodyInit, options);
    if (original) {
      this._bodyInit = original;
      if (isPlainData(original)) {
        delete this._bodyArrayBuffer;
        this._bodyText = original.toString();
      }
    }
  }
  // 修复 blob arrayBuffer 方法, 以 BlobPlus 替代 Blob
  blob() {
    return getBlob.call(this);
  }
  arrayBuffer() {
    return this._bodyArrayBuffer
      ? super.arrayBuffer()
      : this.blob().then(r => r.arrayBuffer());
  }
  clone() {
    return new ResponsePlus(isPlainData(this._bodyInit) ? this._bodyInit.data : this._bodyInit, {
      status: this.status,
      statusText: this.statusText,
      headers: new Headers(this.headers),
      url: this.url
    })
  }
}

/**
 * fetchPlus: 新增 fetchExtend 支持
 * 1. 与 fetch 相同的使用方式, 格式如下
 *    fetchPlus(
 *      url|Request|RequestPlus,
 *      {method, timeout, onDownload, ...}
 *    )
 *    其中 RequestPlus 与 Request 同, 但直接支持扩展字段
 *    const request = new RequestPlus(
 *       url|Request|RequestPlus,
 *       {method, timeout, onDownload, ...}
 *    )
 *    若 fetchPlus 参数为 Request, 不支持扩展字段, 可使用如下方式
 *    const request = new Request(
 *       url|Request,
 *       {method, ...}
 *    )
 *    request.timeout=0;
 *    request.onDownload=()=>{};
 * 
 * 2. 与 fetch 不同的使用方式, 支持直接使用 object 为参数
 *    fetchPlus({
 *       url,
 *       method,
 *       timeout,
 *       onDownload,
 *       ...
 *    })
 * 
 * 3. Request 参数 body 支持以下类型
 *    String, URLSearchParams, Blob/File, 
 *    FormData, ArrayBuffer/DataView, Object
 *    若 body 为 Object, 将自动使用 JSON.stringify 转为 String
 *    并设置 Request header content-type 为 application/json
 */
function fetchPlus(input, init) {
  return new Promise(function(resolve, reject) {
    const request = new RequestPlus(input, init);

    // RN 支持的 responseType 有 blob,text; 若设置了 saveTo, 会自动设置 responseType 为 blob.
    // 但对于请求下载文件的场景, 一般是不关心文件 blob 数据的, 所以保存完文件后, 会自动 close blob.
    // 若在该场景下, 后续仍需要读取 blob 数据, 可需通过 keepBlob:true 强制保留 blob 对象
    let saveTo, keepBlob;
    if (request.saveTo) {
      saveTo = String(request.saveTo);
      if (!saveTo) {
        reject("saveTo path is error");
        return;
      }
      keepBlob = Boolean(request.keepBlob)
    }
    
    const signal = request.signal;
    if (signal && signal.aborted) {
      return reject(new DOMException('Aborted', 'AbortError'))
    }
    var xhr = new XMLHttpRequest();
    xhr.onerror = function() {
      setTimeout(function() {
        reject(new TypeError('Network request failed'))
      }, 0);
    };
    xhr.ontimeout = function() {
      setTimeout(function() {
        reject(new TypeError('Network request timeout'))
      }, 0);
    };
    xhr.onabort = function() {
      setTimeout(function() {
        reject(new DOMException('Aborted', 'AbortError'))
      }, 0);
    };
    xhr.onload = function() {
      var body = 'response' in xhr ? xhr.response : xhr.responseText;
      var options = {
        status: xhr.status,
        statusText: xhr.statusText,
        headers: parseHeader(xhr.getAllResponseHeaders() || '')
      };
      options.url = 'responseURL' in xhr ? xhr.responseURL : options.headers.get('X-Request-URL');
      if (!saveTo) {
        resolve(new ResponsePlus(body, options));
        return;
      }
      // 保存为文件, 默认自动关闭 blob, 后续不能继续读取 blob 了
      writeFile(ArchivesModule, saveTo, body).then(function() {
        if (!keepBlob) {
          body.close();
        }
        resolve(new ResponsePlus(keepBlob ? body : null, options));
      }).catch(reject);
    };

    // 新增监听特性
    const event = {};
    fetchListener.forEach(e => {
      event[e] = typeof request[e] === 'function';
    })
    function abortXhr() {
      xhr.abort();
    }
    if (signal || event.onHeader) {
      if (signal) {
        signal.addEventListener('abort', abortXhr);
      }
      xhr.onreadystatechange = function() {
        // DONE (success or failure)
        if (signal && this.readyState === this.DONE) {
          request.signal.removeEventListener('abort', abortXhr);
        }
        // header Received
        if (event.onHeader && this.readyState === this.HEADERS_RECEIVED) {
          request.onHeader.call(this, parseHeader(xhr.getAllResponseHeaders() || ''));
        }
      };
    }
    if (event.onUpload && xhr.upload) {
      xhr.upload.onprogress = request.onUpload.bind(xhr);
    }
    if (event.onDownload) {
      xhr.onprogress = request.onDownload.bind(xhr);
    }

    // rn 的逻辑是, 如果为 responseType 为 blob, 则由原生端缓存数据, 实际返回给 js 的是一个 blobId
    // 之后通过 blobId 去原生端读取缓存, 但这样可能会带来内存泄露的风险
    // https://github.com/facebook/react-native/issues/23801
    // 所以这里支持使用 resText 配置 responseType, 以便可以灵活的使用
    // 1. 如果确定要取回的数据是 blob 或 arrayBuffer 类型, 或设置了 saveTo, 这里配置为 blob (默认)
    // 2. 否则建议配置 resText=true, 此时原生端不会缓存响应数据，而是直接返回 string 
    //    但如有需要，仍可使用 res 的 blob arrayBuffer 方法
    //    原理是 js 会将取回的字符串再交回给原生端, 然后再由原生端传递 blobId 给 js
    //    这样有点扯犊子了, 兜了一圈, 并且对于二进制类型的数据, 这个传递恐怕是有问题的
    //    所以除非确定不使用 blob, 否则就保持默认, 即没规避掉内存泄露风险, 又降低了性能
    xhr.responseType = !saveTo && request.resText ? 'text' : 'blob';
    if (request.credentials) {
      xhr.withCredentials = 'omit' !== request.credentials && false !== request.credentials;
    }
    if (request.timeout) {
      xhr.timeout = request.timeout;
    }

    // 确认 payload method, 打开请求
    let payload = null;
    if (typeof request._bodyInit !== 'undefined') {
      payload = request._bodyInit;
      if (URLSearchParams.prototype.isPrototypeOf(payload) ||
        PlainData.prototype.isPrototypeOf(payload)
      ) {
        payload = payload.toString();
      }
    }
    xhr.open(request.method||(payload ? 'POST' : 'GET'), request.url, true);

    // 发送 header + body
    if (request.headers) {
      request.headers.forEach(function(value, name) {
        xhr.setRequestHeader(name, value);
      });
    }
    if (request.referrer) {
      xhr.setRequestHeader('referrer', request.referrer);
    }
    xhr.send(payload);
  })
}

module.exports = {
  BlobPlus,
  fetchPlus,
  fetchExtend,
  RequestPlus,
  ResponsePlus,
};