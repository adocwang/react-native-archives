import utils from './utils';
import invariant from 'invariant';
import writeFile from './writeFile';
import {xmlFetch} from './fetchPlus';
import {Platform, NativeModules, DeviceEventEmitter, Image} from 'react-native';

// TODO: 这里直接引用了 rn 的源码, 要注意 rn 官方源码是否变动
import BlobManager from 'react-native/Libraries/Blob/BlobManager';
import AssetRegistry from 'react-native/Libraries/Image/AssetRegistry';

const IsAndroid = Platform.OS === 'android';
const {ArchivesModule} = NativeModules;
const drawablExt = ['gif', 'jpg', 'jpeg', 'png', 'svg', 'webp', 'xml', 'bmp', 'psd', 'tiff'];
const readSupport = ['text', 'blob', 'base64', 'buffer'];

function createBlob(options){
  invariant(BlobManager.isAvailable, 'Native module BlobModule is required for blob support');
  return BlobManager.createFromOptions(options);
}

function getString(args) {
  return new Promise((resolve, reject) => {
    const files = [];
    const err = args.some(f => {
      const path = String(f[0]||"");
      if (!path) {
        reject(f[1] + ' is not defined');
        return true;
      }
      files.push(path);
      return false;
    })
    if (!err) {
      resolve(files.length > 1 ? files : files[0]);
    }
  })
}

function getDirPath(dir) {
  return getString([
    [dir, 'dir path']
  ]);
}

function getFilePath(file, allowDebug, prefix) {
  return getString([
    [file, prefix||'file path']
  ]).then(file => {
    let isRes = false, ext;
    if (utils.getNumber(file, null) !== null) {
      // 使用 require() 方式传递的 file
      const source = Image.resolveAssetSource(file);
      if (!source) {
        throw 'file path not find';
      }
      if (source.uri.startsWith('http://')) {
        if (allowDebug) {
          return [source.uri, true];
        }
        throw 'file path not support debug mode';
      }
      const asset = AssetRegistry.getAssetByID(file);
      isRes = true;
      file = source.uri;
      ext = asset.type;
    } else if (file.startsWith("res://")) {
      // file 路径为 res:// 形式的
      isRes = true;
      file = file.substr(6);
      const index = file.lastIndexOf('.');
      if (index > -1) {
        ext = file.substr(index + 1);
        file = file.substr(0, index);
      }
    }
    if (isRes) {
      file = (ext && drawablExt.includes(ext) ? 'drawable://' : 'raw://') + file;
    }
    return allowDebug ? [file, false] : file;
  })
}

function fetchFile(url, params) {
  const options = {
    url
  };
  const encoding = params.encoding,
    resBlob = encoding === 'blob',
    position = utils.getNumber(params.position, null),
    length = utils.getNumber(params.length, null),
    reqBlob = resBlob || position !== null || length !== null || encoding !== 'text';
  if (!reqBlob) {
    options.resText = true;
  }
  return xmlFetch(options).then(res => {
    if (!reqBlob) {
      return res.text();
    }
    return res.blob().then(blob => {
      if (position === null && length === null) {
        return blob;
      }
      const size = blob.size;
      let start = position === null ? 0 : position;
      let end;
      if (start < 0) {
        start = Math.max(0, size + start);
      }
      if (length === null) {
        return blob.slice(start);
      }
      return blob.slice(start, Math.min(size, start + length));
    }).then(blob => {
      if (resBlob) {
        return blob;
      }
      return utils.blobRender(blob).render(encoding).then(r => {
        blob.close();
        return r;
      })
    })
  })
}

function checkMd5(md5, MustSet) {
  md5 = String(md5||"").trim().toLowerCase();
  if (md5 !== "") {
    if (md5.length != 32) {
      throw "MD5 hash length must be 32, given: " + md5;
    }
    return md5;
  } 
  if (MustSet) {
    throw "MD5 hash not defined";
  }
  return null;
}

function bindMd5(params, md5, MustSet) {
  md5 = checkMd5(md5, MustSet);
  if (md5 !== null) {
    params.md5 = md5;
  }
}

function unzipFile(file, dir, md5, MustSetMd5) {
  return getFilePath(file).then(source => {
    return getDirPath(dir).then(dir => {
      return [source, dir]
    })
  }).then(f => {
    const params = {source:f[0], dest:f[1]};
    bindMd5(params, md5, MustSetMd5);
    return ArchivesModule.unzipFile(params)
  })
}

function copyFile(source, dest, overwrite, move){
  return getString([
    [source, 'source path'],
    [dest, 'dest path']
  ]).then(f => {
    const params = {
      source: f[0], 
      dest: f[1], 
      overwrite: overwrite===false ? false : true
    };
    return move ? ArchivesModule.moveFile(params) : ArchivesModule.copyFile(params);
  })
}


// android downloadManager
const downloadObj = {};
function listenDownloadEvent(e) {
  const {event, taskId, downloadId, ...props} = e;
  if (!(taskId in downloadObj)) {
    return;
  }
  const obj = downloadObj[taskId];
  const isStart = event === 'start';
  if (isStart || event === 'error') {
    const method = isStart ? 'resolve' : 'reject';
    if (!(method in obj)) {
      return;
    }
    let remove = true;
    if (isStart) {
      obj.resolve();
      delete obj.resolve;
      delete obj.reject;
      remove = !Object.keys(obj);
    } else {
      obj.reject(props.error);
    }
    if (remove) {
      delete downloadObj[taskId];
    }
  }
  if (event === 'progress') {
    obj.percent = props.percent;
    obj.progress && obj.progress(props);
    return;
  }
  if (event === 'complete') {
    let autoOpen = obj.autoOpen;
    const {file, mime, size} = props;
    if (!file || !size) {
      obj.complete && obj.complete(props);
    } else {
      if (obj.progress && obj.percent < 100) {
        obj.progress({
          percent: 100,
          loaded: size,
          total: size,
        });
      }
      obj.complete && obj.complete(props);
      if (autoOpen && file) {
        autoOpen = null;
        fs.openFile(file, mime||"").then(() => {
          obj.autoOpen()
        }).catch(err => {
          obj.autoOpen(err)
        })
      }
    }
    if (autoOpen){
      autoOpen('file or mime is error')
    }
    delete downloadObj[taskId];
  }  
}
function startDownload(options){
  invariant(IsAndroid, 'download method only support android');
  const {url, onProgress, onComplete, onAutoOpen} = options||{};
  return getString([
    [url, 'url path']
  ]).then(() => {
    const obj = {};
    if (onProgress) {
      obj.progress = onProgress;
      options.onProgress = true;
    }
    if (onComplete) {
      obj.complete = onComplete;
      options.onComplete = true;
    }
    if (onAutoOpen) {
      obj.autoOpen = onAutoOpen;
      delete options.onAutoOpen;
      options.onComplete = true;
    }
    return ArchivesModule.addDownloadService(options).then(taskId => {
      return new Promise((resolve, reject) => {
        obj.resolve = resolve;
        obj.reject = reject;
        downloadObj[taskId] = obj;
      })
    }) 
  })
}
if(IsAndroid) {
  DeviceEventEmitter.addListener("ArchivesModuleEvent", listenDownloadEvent);
}


// filesystem 导出
const fs = {
  getMime(files) {
    const isArr = Array.isArray(files);
    return new Promise(resolve => {
      if (isArr && !files.length) {
        resolve([]);
        return;
      }
      if (!isArr) {
        if (!files) {
          resolve(null);
          return;
        }
        files = [files];
      }
      ArchivesModule.getMimeType(files).then(r => {
        resolve(isArr ? r : r[0])
      })
    })
  },

  getContentUri(mediaType, name){
    return ArchivesModule.getContentUri(mediaType||"Files", name||"external")
  },

  getHash(file, algorithm){
    return getFilePath(file).then(file => {
      const params = {file};
      if (algorithm) {
        params.hash = algorithm.toUpperCase();
      }
      return ArchivesModule.getHash(params)
    })
  },

  getShareUri(file){
    return ArchivesModule.getShareUri(file)
  },

  isDir(path){
    return getFilePath(path, true, 'dir path').then(([file, debug]) => {
      return debug ? false : ArchivesModule.isDir(file);
    })
  },

  mkDir(path, recursive){
    return getDirPath(path).then(dir => {
      return ArchivesModule.mkDir(dir, recursive === false ? false : true)
    })
  },

  readDir(path){
    return getDirPath(path).then(ArchivesModule.readDir)
  },

  rmDir(path, recursive){
    return getDirPath(path).then(dir => {
      return ArchivesModule.rmDir(dir, !!recursive)
    })
  },

  // encoding 支持 readSupport 类型 ('text', 'blob', 'base64', 'buffer')
  // buffer 返回 arrayBuffer 类型
  readFile(file, encoding, offset, length){
    return getFilePath(file, true).then(([file, debug]) => {
      const params = {};
      encoding = String(encoding||"").toLowerCase();
      const type = readSupport.includes(encoding) > -1 ? encoding : 'text';
      offset = utils.getNumber(offset, null);
      if (offset !== null) {
        params.position = offset;
      }
      length = utils.getNumber(length, null);
      if (length !== null) {
        if (length <= 0) {
          throw 'Length cannot be less than 0'
        }
        params.length = length;
      }
      if (debug) {
        params.encoding = encoding;
        return fetchFile(file, params);
      }
      const isBuffer = encoding === 'buffer';
      params.encoding = isBuffer ? 'base64' : encoding;
      params.file = file;
      return ArchivesModule.readFile(params).then(r => {
        return params.encoding === 'blob' ? createBlob(r) : (
          isBuffer ? utils.toByteArray(r) : r
        );
      })
    })
  },

  // file: 一般为 file://path, 也可以是 content://provder 前提是有写入权限
  // content: 可以是 Blob 对象, 也可以是 string, 若 content 为 base64, 设置为 [content]
  // flag: 不指定(覆盖写入) / true(追加写入) / Number(在指定的位置写入, 为负数则从文件尾部算起)
  writeFile(file, content, flag){
    return getString([
      [file, 'file path']
    ]).then(file => {
      return writeFile(ArchivesModule, file, content, flag)
    })
  },

  copyFile(source, dest, overwrite){
    return copyFile(source, dest, overwrite);
  },

  moveFile(source, dest, overwrite){
    return copyFile(source, dest, overwrite, true);
  },

  unlink(file){
    return getString([
      [file, 'file path']
    ]).then(ArchivesModule.unlink)
  },

  // 会自动根据 file 文件后缀判断 mime (若后缀不规范, 需手动设置 mime)
  openFile(file, mime) {
    return getString([
      [file, 'file path'],
    ]).then(f => {
      return ArchivesModule.openFile(file, mime||"")
    })
  },

  // 使用 bsDiff 算法, 合并 patch 增量到 source, 并保存到 dest
  bsPatch(source, patch, dest){
    return getFilePath(source, false, 'source path').then(origin => {
      return getFilePath(patch, false, 'patch path').then(source => {
        return [origin, source]
      }).then(f => {
        return getString([
          [dest, 'dest path']
        ]).then(dest => {
          f.push(dest);
          return f;
        })
      })
    }).then(f => {
      return ArchivesModule.bsPatch({
        origin: f[0],
        source: f[1],
        dest: f[2]
      })
    })
  },

  // 解压 zip 文件
  unzip(file, dir, md5){
    return unzipFile(file, dir, md5)
  },

  // 解压全量 bundle 包
  unzipBundle(file, md5){
    return unzipFile(file, ArchivesModule.status.downloadRootDir + '/' + md5, md5, true)
  },
  
  // 解压相对于安装包的 增量 patch 包
  // 必须指定 md5Version, 可选: 验证 patch 包的 patchMd5
  unzipPatch(file, md5Version, patchMd5){
    return getFilePath(file).then(source => {
      const version = checkMd5(md5Version, true);
      const params = {source, dest: ArchivesModule.status.downloadRootDir + '/' + version};
      bindMd5(params, patchMd5);
      return ArchivesModule.unzipPatch(params)
    })
  },  
  
  // 解压相对于 originVersion 的 增量 patch 包
  // 必须指定 md5Version, originVersion, 可选: 验证 patch 包的 patchMd5
  unzipDiff(file, md5Version, originVersion, patchMd5){
    return getFilePath(file).then(source => {
      const version = checkMd5(md5Version, true);
      const origin = checkMd5(originVersion, true);
      const params = {
        source, 
        origin,
        dest: ArchivesModule.status.downloadRootDir + '/' + version
      };
      bindMd5(params, patchMd5);
      return ArchivesModule.unzipDiff(params)
    })
  },

  // 切换到指定的热更版本
  switchVersion(md5Version, reload) {
    const params = {
      hash: checkMd5(md5Version, true)
    };
    if (!!reload) {
      params.reload = true;
    }
    return ArchivesModule.switchVersion(params)
  },

  // debug 模式下重启 app / release 模式下重载 js bundle
  reload() {
    return ArchivesModule.reload();
  },

  // 重启 app
  restart() {
    return ArchivesModule.restart();
  },

  // 首次启动时, 可通过该方法生效热更版本
  markSuccess() {
    return ArchivesModule.markSuccess()
  },

  /*
    使用系统自带的 downloadManager 下载文件 (android only)
    options: {
      *url: 'http://',
      mime:'',  缺省情况会更加文件后缀自动判断, 若为 url 文件后缀与mime不匹配, 需手工设置
      dest: '', 默认下载到 external 私有目录(无需权限), 也可以指定为 external 公共目录, 需要有 WRITE_EXTERNAL_STORAGE 权限
      title:'',
      description:'',
      scannable:Bool, 是否可被扫描
      roaming:Bool, 漫游状态是否下载
      quiet: Bool, 是否在推送栏显示
      network:int,  MOBILE:1, WIFI:2, ALL:3
      headers:{}  自定义 header 头
      onProgress: Function({total, loaded, percent}), 监听下载进度
      onComplete: Function({file, url, mime, size, mtime}),  下载完成的回调
      onAutoOpen: Function(null|error), 尝试自动打开文件,并监听打开是否成功
    }
  */
  download(options) {
    return startDownload(options);
  },

  /*
    fetch 下载完文件, 可使用该函数添加一个下载完毕的推送 (android only)
    options: {
      *file: '',
      mime:'',
      title: '',
      description:'',
      quiet:Bool  若true,用户可在下载文件管理中看到,不显示到推送栏
    }
  */
  addDownload(options) {
    invariant(IsAndroid, 'addDownload method only support android');
    const {file} = options||{};
    return getString([
      [file, 'file path']
    ]).then(() => {
      return ArchivesModule.addDownloadComplete(options)
    });
  }
};


module.exports = fs;