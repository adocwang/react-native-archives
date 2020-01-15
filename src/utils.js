// TODO: 当前 rn 的 FileReader 不支持 readAsArrayBuffer, 若后期支持, 可考虑进行改进 BlobRender
// https://github.com/facebook/react-native/blob/master/Libraries/Blob/FileReader.js#L84
// fromByteArray 直接从 rn 源码引用的, 若其以后有变动, 需注意
import b64 from "base64-js";
import fromByteArray from 'react-native/Libraries/Utilities/binaryToBase64';
function toByteArray(base64){
  return b64.toByteArray(base64).buffer;
}

class BlobRender {
  constructor(blob) {
    this.blob = blob;
  }
  render(type){
    type = String(type||"").toLowerCase();
    const blob = this.blob;
    const isText = type === 'text';
    return new Promise(function(resolve, reject) {
      const reader = new FileReader();
      reader.onload = function() {
        resolve(reader.result)
      }
      reader.onerror = function() {
        reject(reader.error)
      }
      if (isText) {
        reader.readAsText(blob)
      } else {
        reader.readAsDataURL(blob)
      }
    }).then(bin => {
      if (isText) {
        return bin;
      }
      const index = bin.lastIndexOf(',');
      if (index > -1) {
        bin = bin.substr(index + 1);
      }
      return type === 'base64' ? bin : toByteArray(bin);
    })
  }
  text(){
    return this.render('text');
  }
  base64(){
    return this.render('base64');
  }
}

const methods = ['DELETE', 'GET', 'HEAD', 'OPTIONS', 'POST', 'PUT'];

const utils = {
  toByteArray,
  fromByteArray,
  blobRender(blob) {
    return new BlobRender(blob);
  },
  getNumber(v, def){
    v = parseInt(v);
    return typeof v === "number" && isFinite(v) && Math.floor(v) === v ? v : def;
  },
  normalizeMethod(method){
    const upcased = method.toUpperCase();
    return methods.indexOf(upcased) > -1 ? upcased : method
  },
  ltrim(str, char){
    if (!char){
      return str.trimLeft();
    }
    while(str.charAt(0) === char) {
      str = str.substring(1);
    }
    return str;
  },
  rtrim(str, char){
    if (!char){
      return str.trimRight();
    }
    while(str.charAt(str.length-1) === char) {
      str = str.substring(0, str.length-1);
    }
    return str;
  },
  makeUrl(baseUrl, path, queries){
    baseUrl = baseUrl.trim();
    if (!path) {
      path = baseUrl;
    } else if (!/^[a-zA-Z]+:\/\//.test(path)) {
      path = utils.rtrim(baseUrl, '/') + '/' + utils.ltrim(path, '/');
    }
    queries = queries ? utils.makeParams(queries) : null;
    if (queries) {
      path = path + (path.indexOf('?') > -1 ? '&' : '?') + queries;
    }
    return path;
  },
  makeParams(obj, strify){
    obj = obj||{};
    const arr = [];
    for (let k in obj)
      if (obj.hasOwnProperty(k)) {
        const key = encodeURIComponent(k) + "=";
        (Array.isArray(obj[k]) ? obj[k] : [obj[k]]).forEach(v => {
          if (strify && typeof v !== 'string') {
            v = JSON.stringify(v);
          }
          arr.push(key + encodeURIComponent(v));
        })
    }
    return arr.join("&");
  },
}
export default utils;