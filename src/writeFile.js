// 这里只是为了不让  FileSystem 和 FetchPlush 互相引用 导致 黄色警告
import utils from './utils';
export default function(Archives, file, content, flag) {
  const params = {file};
  if (Blob.prototype.isPrototypeOf(content)) {
    params.encoding = 'blob';
    params.content = content.data.blobId;
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
    const position = utils.getNumber(flag, null);
    if (position !== null) {
      params.position = position;
    }
  }
  return Archives.writeFile(params)
}