import utils from './utils';
import writeFile from './writeFile';
import {NativeModules} from 'react-native';
const {ArchivesModule} = NativeModules;
const fetchListener = ['onHeader', 'onUpload', 'onDownload']
const fetchExtend = fetchListener.concat(['timeout', 'resText', 'saveTo', 'keepBlob']);

// 让 fetchPlus 返回的 response 支持 arrayBuffer
class ResponsePlus extends Response {
  arrayBuffer(){
    if (this._bodyArrayBuffer){
      return super.arrayBuffer();
    }
    return this.blob().then(blob => utils.blobRender(blob)).then(b => b.render())
  }
}

// from github fetch polyfill 
function parseHeaders(rawHeaders) {
  var headers = new Headers();
  var preProcessedHeaders = rawHeaders.replace(/\r?\n[\t ]+/g, ' ');
  preProcessedHeaders.split(/\r?\n/).forEach(function(line) {
    var parts = line.split(':');
    var key = parts.shift().trim();
    if (key) {
      var value = parts.join(':').trim();
      headers.append(key, value);
    }
  });
  return headers
}

// xmlFetch: 这里的代码部分来自于 github fetch polyfill, 新增 fetchListener/fetchExtend 支持
function xmlFetch(request) {
  return new Promise(function(resolve, reject) {

    // 设置了 saveTo, 会以 blob 形式请求, 但保存文件的场景, 一般是不关心文件 blob 数据的
    // 所以保存完文件后, 默认情况下自动 close blob, 若真的需要 blob 数据, 通过  keepBlob:true 指明
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
    function abortXhr() {
      xhr.abort();
    }
    xhr.onerror = function() {
      reject(new TypeError('Network request failed'));
    };
    xhr.ontimeout = function() {
      reject(new TypeError('Network request timeout'));
    };
    xhr.onabort = function() {
      reject(new DOMException('Aborted', 'AbortError'));
    };
    xhr.onload = function() {
      var options = {
        status: xhr.status,
        statusText: xhr.statusText,
        headers: parseHeaders(xhr.getAllResponseHeaders() || '')
      };
      options.url = 'responseURL' in xhr ? xhr.responseURL : options.headers.get('X-Request-URL');
      var body = 'response' in xhr ? xhr.response : xhr.responseText;
      if (saveTo) {
        writeFile(ArchivesModule, saveTo, body).then(r => {
          // 自动关闭 blob, 后续不能继续读取 blob 了
          if (!keepBlob) {
            body.close();
          }
          resolve(new ResponsePlus(body, options));
        }).catch(reject)
      } else {
        resolve(new ResponsePlus(body, options));
      }
    };

    xhr.open(request.method||'GET', request.url, true);
    if (request.credentials === 'include') {
      xhr.withCredentials = true;
    } else if (request.credentials === 'omit') {
      xhr.withCredentials = false;
    }
    if (request.headers) {
      request.headers.forEach(function(value, name) {
        xhr.setRequestHeader(name, value);
      });
    }

    // rn 的逻辑是, 如果为 responseType 为 blob, 则由原生端缓存数据, 实际回调给 js 的是一个 blobId
    // 通过 blobId 去原生端读取缓存, 但这样可能会带来内存泄露的风险
    // https://github.com/facebook/react-native/issues/23801
    // 所以这里支持配置 responseType, 以便更灵活的使用
    // 1. 如果确定要取回的数据是 blob 或 arrayBuffer 类型, 或设置了 saveTo, 这里配置为 blob
    // 2. 否则建议配置 resText=true, 此时对于 res 为 string 的仍可使用 res 的 blob arrayBuffer 方法
    //    原理是 js 会将取回的字符串再交回给原生端, 然后再由原生端传递 blobId 给 js
    //    这样有点扯犊子了, 兜了一圈, 并且对于二进制类型的数据, 这个传递恐怕是有问题的
    //    所以除非确定不使用 blob, 否则就保持默认, 即没规避掉内存泄露风险, 又降低了性能
    xhr.responseType = !saveTo && request.resText ? 'text' : 'blob';

    // 新增特性
    const event = {};
    fetchListener.forEach(e => {
      event[e] = typeof request[e] === 'function';
    })
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
          request.onHeader.call(this, parseHeaders(xhr.getAllResponseHeaders() || ''));
        }
      };
    }
    if (event.onUpload && xhr.upload) {
      xhr.upload.onprogress = request.onUpload.bind(xhr);
    }
    if (event.onDownload) {
      xhr.onprogress = request.onDownload.bind(xhr);
    }
    if (request.timeout) {
      xhr.timeout = request.timeout;
    }
    // send
    xhr.send(typeof request._bodyInit === 'undefined' ? null : request._bodyInit);
  })
}


function makePlusRequest(input, init) {
  init = init||{};
  const extra = {};
  if (typeof input === 'object') {
    addExtendFields(extra, input);
  }
  addExtendFields(extra, init);
  const request = new Request(input, init);
  addExtendFields(request, extra);
  return request;
}
function addExtendFields(request, origin){
  fetchExtend.forEach(k => {
    if (origin.hasOwnProperty(k)) {
      request[k] = origin[k]
    }
  })
}

/* 
保持与原 fetch 相同的 api, 同时支持 fetchExtend 属性
1. 与 fetch 相同, 可以直接使用 object
  fetchPlus({
    url:,
    method:,
    onDownload:f, 
    timeout:int, 
    ...
  })
  也可以在 init 中配置
  fetchPlus(
     url|Request, 
     {onDownload:f, timeout:int, resText:true}
  )

2. 直接使用 Request, 只能像下面这样子, 因为 Request 仅支持 fetch 参数
   const request = new Request(..);
   request.onDownload = f;
   request.timeout = int
   fetchPlus(request)
*/
function fetchPlus(input, init) {
  return xmlFetch(makePlusRequest(input, init));
}

export {
  makePlusRequest,
  xmlFetch,
  fetchPlus
};