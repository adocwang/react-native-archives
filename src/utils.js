import b64 from "base64-js";
import arrayBufferToBase64 from 'react-native/Libraries/Utilities/binaryToBase64';
const methods = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT'];

// 将 query, cookie 的 string 转为 object
function parseRawStr(raw, cookie) {
  return raw.split(cookie ? ';' : '&').map(v => v.split('=')).reduce((acc, v) => {
    if (v.length < 2) {
      return acc;
    }
    let key = decodeURIComponent(v[0].trim()), val = v[1];
    if (!cookie) {
      val = val.replace(/\+/g, ' ');
    }
    val = decodeURIComponent(val);
    if (key.endsWith('[]')) {
      key = key.substring(0, key.length - 2);
      if (Array.isArray(acc[key])) {
        acc[key].push(val);
      } else {
        acc[key] = [val];
      }
    } else {
      acc[key] = val;
    }
    return acc;
  }, {});
}

// 将 cookie, query, param 的 object 转为 str
function makeParamStr(obj, join, strify) {
  obj = obj||{};
  const arr = [];
  let k, val, isArr, key;
  for (k in obj) {
    if (!obj.hasOwnProperty(k)) {
      continue;
    }
    val = obj[k];
    isArr = Array.isArray(val);
    key = encodeURIComponent(k) + (isArr ? '[]' : '') + '=';
    (isArr ? val : [val]).forEach(v => {
      if (strify && typeof v !== 'string') {
        v = JSON.stringify(v);
      }
      arr.push(key + encodeURIComponent(v));
    });
  }
  return arr.join(join||"&");
}

const utils = {
  arrayBufferToBase64,
  base64ToArrayBuffer(base64) {
    return b64.toByteArray(base64).buffer
  },
  arrayBufferToText(buffer) {
    var view = new Uint8Array(buffer);
    var chars = new Array(view.length);
    for (var i = 0; i < view.length; i++) {
      chars[i] = String.fromCharCode(view[i]);
    }
    return chars.join('')
  },
  textToArrayBuffer(str) {
    var buf = new ArrayBuffer(str.length);
    var view = new Uint8Array(buf);
    for (var i = 0; i < str.length; i++) {
      view[i] = str.charCodeAt(i);
    }
    return buf
  },
  getNumber(v, def) {
    v = parseInt(v);
    return typeof v === "number" && isFinite(v) && Math.floor(v) === v ? v : def;
  },
  normalizeMethod(method) {
    const upcased = method.toUpperCase();
    return methods.indexOf(upcased) > -1 ? upcased : method
  },
  ltrim(str, char) {
    if (!char){
      return str.trimLeft();
    }
    while(str.charAt(0) === char) {
      str = str.substring(1);
    }
    return str;
  },
  rtrim(str, char) {
    if (!char){
      return str.trimRight();
    }
    while(str.charAt(str.length-1) === char) {
      str = str.substring(0, str.length-1);
    }
    return str;
  },
  parseQuery(rawQuery) {
    return parseRawStr(rawQuery);
  },
  parseCookie(rawCookie) {
    return parseRawStr(rawCookie, true);
  },
  parseHeader(rawHeader) {
    const headers = new Headers();
    rawHeader.replace(/\r?\n[\t ]+/g, ' ').split(/\r?\n/).forEach(function(line) {
      const parts = line.split(':'),
        key = parts.shift().trim();
      if (key) {
        headers.append(key, parts.join(':').trim());
      }
    });
    return headers;
  },
  makeCookie(obj) {
    return makeParamStr(obj, '; ');
  },
  makeQuery(obj) {
    return makeParamStr(obj, '&');
  },
  makeParam(obj, strify) {
    return makeParamStr(obj, '&', strify);
  },
  makeUrl(baseUrl, url, queries) {
    baseUrl = baseUrl.trim();
    if (!url) {
      url = baseUrl;
    } else if (!/^[a-zA-Z]+:\/\//.test(url)) {
      url = utils.rtrim(baseUrl, '/') + '/' + utils.ltrim(url, '/');
    }
    queries = queries ? utils.makeQuery(queries) : null;
    if (queries) {
      url = url + (url.indexOf('?') > -1 ? '&' : '?') + queries;
    }
    return url;
  },
  async readBlob(blob, encoding) {
    // 读取 blob 为 buffer(默认)/text/base64/uri
    encoding = String(encoding||"").toLowerCase();
    const isText = encoding === 'text';
    let bin = await new Promise(function (resolve, reject) {
      const reader = new FileReader();
      reader.onload = function () {
        resolve(reader.result);
      };
      reader.onerror = function () {
        reject(reader.error);
      };
      if (isText) {
        reader.readAsText(blob);
      } else {
        reader.readAsDataURL(blob);
      }
    });
    if (isText || 'uri' === encoding) {
      return bin;
    }
    const index = bin.lastIndexOf(',');
    if (index > -1) {
      bin = bin.substr(index + 1);
    }
    return 'base64' === encoding ? bin : utils.base64ToArrayBuffer(bin);
  },
}

module.exports = utils;