// 这里只是为了不让  FileSystem 和 FetchPlush 互相引用 导致 黄色警告
import {getNumber} from './utils';
module.exports = function(Archives, file, content, flag) {
  const params = {file};
  if (Blob.prototype.isPrototypeOf(content)) {
    const data = content.data;
    params.encoding = 'blob';
    params.content = data.blobId+'#'+data.offset+'#'+data.size;
  } else if (Array.isArray(content)) {
    params.encoding = 'base64';
    params.content = content.shift();
  } else {
    params.encoding = 'utf8';
    params.content = content;
  }
  if (flag === true) {
    params.append = true;
  } else {
    const position = getNumber(flag, null);
    if (position !== null) {
      params.position = position;
    }
  }
  return Archives.writeFile(params)
}