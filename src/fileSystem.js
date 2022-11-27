import utils from './utils';
import invariant from 'invariant';
import writeFile from './writeFile';
import {BlobPlus, fetchPlus} from './fetchPlus';
import {Platform, NativeModules, DeviceEventEmitter, NativeEventEmitter, DevSettings, Image} from 'react-native';

// TODO: 这里直接引用了 rn 的源码, 要注意 rn 官方源码是否变动
import BlobManager from 'react-native/Libraries/Blob/BlobManager';
import AssetRegistry from 'react-native/Libraries/Image/AssetRegistry';

const {ArchivesModule} = NativeModules;
const IsAndroid = Platform.OS === 'android';
const readSupport = ['text', 'blob', 'base64', 'buffer', 'uri'];
const drawablExts = ['gif', 'jpg', 'jpeg', 'png', 'svg', 'webp', 'xml', 'bmp', 'psd', 'tiff'];

// ArchivesModuleEvent
let _Emitter_Req_Id = 1;
const _Emitter_Listener_ = {};
const ArchivesModuleEvent = 'ArchivesModuleEvent';
const ArchivesEventEmitter = IsAndroid ? DeviceEventEmitter : new NativeEventEmitter(ArchivesModule);
function getDismissListenerId(listener) {
  _Emitter_Listener_[++_Emitter_Req_Id] = listener;
  return _Emitter_Req_Id;
}
async function startDownload(options){
  const {url, onProgress, onComplete, onAutoOpen, onError, ...rest} = options||{};
  const surl = String(url||"");
  const preCheck = !IsAndroid ? 'download method only support android' : (
    surl ? null : 'options.url is not defined' 
  );
  if (preCheck) {
    throw new Error(preCheck);
  }
  const obj = {};
  rest.url = surl;
  if (onProgress) {
    rest.onProgress = true;
    obj.onProgress = onProgress;
  }
  if (onComplete) {
    rest.onComplete = true;
    obj.onComplete = onComplete;
  }
  if (onError) {
    rest.onComplete = true;
    obj.onError = onError;
  }
  const taskId = await ArchivesModule.addDownloadService(rest);
  return new Promise((resolve, reject) => {
    _Emitter_Listener_[taskId] = {...obj, resolve, reject};
  });
}
function ArchivesModuleListener({event, taskId, ...props}) {
  if (!(taskId in _Emitter_Listener_)) {
    return;
  }
  const obj = _Emitter_Listener_[taskId];
  if ('dismiss' === event) {
    delete _Emitter_Listener_[taskId];
    obj(props);
    return;
  }
  if ('start' === event) {
    const resolve = obj.resolve;
    delete obj.resolve;
    delete obj.reject;
    if (!Object.keys(obj)) {
      delete _Emitter_Listener_[taskId];
    }
    resolve(null);
    return;
  }
  if ('error' === event) {
    const reject = obj.reject;
    if (reject) {
      delete _Emitter_Listener_[taskId];
      reject(props.error);
    } else if (obj.onError) {
      obj.onError(props.error)
    }
    return;
  }
  if ('progress' === event) {
    obj.percent = props.percent;
    obj.onProgress && obj.onProgress(props);
    return;
  }
  if ('complete' === event) {
    delete _Emitter_Listener_[taskId];
    const {error, size} = props;
    if (error) {
      obj.onError && obj.onError(error);
      return;
    }
    if (obj.onProgress && obj.percent < 100) {
      obj.onProgress({
        percent: 100,
        loaded: size,
        total: size,
      });
    }
    obj.onComplete && obj.onComplete(props);
    return;
  }
}
ArchivesEventEmitter.removeAllListeners(ArchivesModuleEvent);
ArchivesEventEmitter.addListener(ArchivesModuleEvent, ArchivesModuleListener);

function capitalize(str){
  return str.charAt(0).toUpperCase() + str.slice(1);
}

function checkOs(method, ios){
  if (ios ? IsAndroid : !IsAndroid) {
    throw new Error(method + ' method only support ' + (ios ? 'iOS' : 'Android'));
  }
}

function charHash(s) {
  for(var i = 0, h = 0; i < s.length; i++) {
    h = Math.imul(31, h) + s.charCodeAt(i) | 0;
  }
  h = h < 0 ? h * -2 : h;
  return h.toString(16)
}

function getDirPath(dir) {
  return getString(dir, 'dir path');
}

function getString(args, name) {
  return new Promise((resolve, reject) => {
    if (!Array.isArray(args)) {
      args = [[args, name]];
    }
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
  });
}

function createBlob(options){
  invariant(BlobManager.isAvailable, 'Native module BlobModule is required for blob support');
  const blob = BlobManager.createFromOptions(options);
  const blobPlus = new BlobPlus([blob], options);
  blob.close();
  return blobPlus;
}

async function fetchFile(url, params) {
  const encoding = params.encoding,
    position = utils.getNumber(params.position, null),
    length = utils.getNumber(params.length, null),
    resBlob = encoding === 'blob',
    reqBlob = resBlob || position !== null || length !== null || encoding !== 'text';
  const res = await fetchPlus({
    url,
    resText: !reqBlob
  });
  if (!reqBlob) {
    return res.text();
  }
  let blob = await res.blob();
  if (position !== null || length !== null) {
    const size = blob.size;
    let start = position, end = null;
    if (position === null) {
      start = 0;
    } else if (position < 0) {
      start = Math.max(0, size + position);
    }
    if (null !== length) {
      end = Math.min(size, start + length);
    }
    const slice = blob.slice(start, end, blob.type);
    blob.close();
    blob = slice;
  }
  if (resBlob) {
    return blob;
  }
  const rs = await utils.readBlob(blob, encoding);
  blob.close();
  return rs;
}

/**
 * file 路径支持以下格式
 * 
 * 1. 常规文件路径
 *    require()    -  RN 引用 JS 包的资源得到的路径
 * 
 * 2. file sheme 路径
 *    file://      -  绝对路径，可省略协议头, 直接使用 /dir/path (可读写)
 *      
 *    (Android Only)
 *    drawable://  -  Android 原生目录 /main/res/drawable 下的文件(无子文件夹,文件路径不包含文件后缀,只读)
 *    raw://       -  Android 原生目录 /main/res/raw 下的文件(无子文件夹,文件路径不包含文件后缀,只读)
 *    asset://     -  Android 原生目录 /main/assets 下的文件或子文件夹(只读)
 *    content://   -  Android File Provider 机制下的文件路径(一般为只读,属于APP的文件可能可写)
 */
async function getFilePath(file, prefix, allowLocalUrl) {
  if (true === prefix) {
    prefix = null;
    allowLocalUrl = true;
  }
  prefix = prefix || 'file path'
  // 使用 require() 方式传递的 file path
  const extra = {};
  let path = await getString(file, prefix);
  if (utils.getNumber(path, null) !== null) {
    const assetId = path;
    const source = Image.resolveAssetSource(assetId);
    if (!source) {
      throw prefix + ' not find';
    }
    if (__DEV__) {
      if (allowLocalUrl) {
        return [source.uri, true, extra];
      }
      let ext = source.uri.split('?')[0];
      ext = ext.substring(ext.lastIndexOf('.'));
      const tempFile = ArchivesModule.dirs.Temporary + '/tmp' + charHash(source.uri) + ext;
      await fetchPlus({
        url: source.uri,
        saveTo: tempFile,
      });
      return tempFile;
    }
    // ios 或 android手动指定 bundleJsFile 的情况下, 此处返回的 file:// 路径
    path = source.uri;
    if (path.startsWith('file://')) {
      if (!IsAndroid){
        path = path.slice(7);
      }
    } else if (IsAndroid) {
      const asset = AssetRegistry.getAssetByID(assetId);
      extra.type = asset.type;
      path = (
        asset && asset.type && drawablExts.includes(asset.type)
          ? 'drawable://' : 'raw://'
      ) + path;
    }
  }
  return allowLocalUrl ? [path, false, extra] : path;
}

async function copyFile(source, dest, overwrite, move){
  source = (await getFilePath(source, 'source path', true))[0];
  if (/^https?:\/\//i.test(source)) {
    if (move) {
      throw "source path only support file:// scheme, given: " + source;
    }
    if (!overwrite && null !== (await ArchivesModule.isDir(dest))) {
      throw "File already exist: " + dest;
    }
    await fetchPlus({url:source, saveTo:dest});
    return null;
  }
  const params = {
    source,
    dest: await getString(dest, 'dest path'),
    overwrite: overwrite === false ? false : true
  };
  return move ? ArchivesModule.moveFile(params) : ArchivesModule.copyFile(params);
}

async function getStuff(stuffs, ext) {
  const isArr = Array.isArray(stuffs);
  return new Promise(resolve => {
    if (isArr && !stuffs.length) {
      resolve([]);
      return;
    }
    if (!isArr) {
      if (!stuffs) {
        resolve(null);
        return;
      }
      stuffs = [stuffs];
    }
    ArchivesModule[ext ? 'getExtension' : 'getMimeType'](stuffs).then(r => {
      resolve(isArr ? r : r[0])
    })
  })
}

async function unzipFile(file, dir, md5, MustSetMd5) {
  const source = await getFilePath(file);
  const dest = await getDirPath(dir);
  const params = { source, dest };
  bindMd5(params, md5, MustSetMd5);
  return ArchivesModule.unzipFile(params);
}

function bindMd5(params, md5, MustSet) {
  md5 = checkMd5(md5, MustSet);
  if (md5 !== null) {
    params.md5 = md5;
  }
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

// filesystem 导出, 以下方法如无特殊说明, async 函数返回 Promise<null>, 执行失败会抛出异常
const fs = {
  // path  : 支持所有 scheme 路径
  // result: true(文件夹), false(文件), null(不存在)
  async isDir(path){
    if (['raw://', 'drawable://'].includes(path)) {
      return Promise.resolve(true);
    }
    const [file, debug] = await getFilePath(path, 'dir path', true);
    return debug ? false : ArchivesModule.isDir(file);
  },

  // path: 仅支持 file:// 路径 (recursive 默认为 true)
  async mkDir(path, recursive){
    return ArchivesModule.mkDir(
      await getDirPath(path),
      recursive === false ? false : true
    );
  },

  // path: 仅支持 file:// 路径 (recursive 默认为 false)
  async rmDir(path, recursive){
    return ArchivesModule.rmDir(await getDirPath(path), !!recursive);
  },

  // path: 支持所有 scheme 路径 (备注: drawable://|raw:// 仅有根目录)
  async readDir(path){
    return getDirPath(path).then(ArchivesModule.readDir);
  },

  // file   : 有读写权限的路径 (如 (file|content):// 路径)
  // content: 可以是 string,ArrayBuffer,Blob 或 base64 string(以 [base64_content] 形式传递)
  // flag   : 不指定(覆盖写入) / true(追加写入) / Number(在指定的位置写入,为负数则从文件尾部算起)
  async writeFile(file, content, flag){
    const path = await getString(file, 'file path');
    if (content instanceof ArrayBuffer || ArrayBuffer.isView(content)) {
      content = [utils.arrayBufferToBase64(content)];
    }
    return writeFile(ArchivesModule, path, content, flag);
  },

  // path    : 支持所有 scheme 路径 和 http:// 路径
  // encoding: 支持 ('text'(默认), 'blob', 'base64', 'buffer', 'uri') 设置返回类型
  // offset  : 设置读取的偏移位置, 若未负数则从文件尾部算起
  async readFile(path, encoding, offset, length){
    const params = {};
    const [file, debug, extra] = await getFilePath(path, true);
    encoding = String(encoding||"").toLowerCase();
    encoding = readSupport.includes(encoding) ? encoding : 'text';
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
    // file 为 debug 模式下的 require() 或 http url, 直接 fetch 即可
    if (debug || /^https?:\/\//i.test(file)) {
      params.encoding = encoding;
      return fetchFile(file, params);
    }
    const isUri = encoding === 'uri';
    const isBuffer = encoding === 'buffer';
    params.encoding = isUri ? 'base64' : (isBuffer ? 'blob' : encoding);
    params.file = file;
    const res = await ArchivesModule.readFile(params);
    if (params.encoding === 'blob') {
      const blob = createBlob(res);
      return isBuffer ? blob.arrayBuffer() : blob;
    }
    if (!isUri) {
      return res;
    }
    const type = await fs.getMime(extra && extra.type ? 'f.'+extra.type : file);
    return 'data:'+type+';base64,'+res;
  },

  // source   : 支持所有 scheme 路径
  // dest     : 有读写权限的路径 (如 (file|content):// 路径)
  // overwrite: 默认为 true
  async copyFile(source, dest, overwrite){
    return await copyFile(source, dest, overwrite);
  },

  // source, dest: 都仅支持有读写权限的路径 (如 (file|content):// 路径)
  // overwrite   : 默认为 true
  async moveFile(source, dest, overwrite){
    return await copyFile(source, dest, overwrite, true);
  },

  // file: 有读写权限的路径 (如 (file|content):// 路径)
  async unlink(file){
    return getString(file, 'file path').then(ArchivesModule.unlink);
  },

  /**
   * 支持 file:// content:// 路径
   * options: {
   *   mime:'',  默认根据 file 后缀自动获取, 若无后缀或后缀不规范, 可需手动设置
   *   title:'', 标题, iOS 出现在文件打开后的标题栏, Android 通常无效, 要看第三方 app 是否支持
   *   onClose:Function(), 关闭文件后的回调监听
   * }
   * 1. 在 Android 上将使用可以处理文件的 app 打开, 可能有多个供用户选择, 若无对应 APP 则打开失败.
   *    由于文件打开后的操作将由第三方 APP 或组件接管, 不再受控, 用户可能可以进行保存、分享等操作
   *    若打开的文件为 apk 文件（即安装 app）, 需在 AndroidManifest.xml 中添加权限兼容 Android 8.0
   *    <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES" />
   * 2. 在 iOS 上使用系统内置的 QuickLook 组件打开文件, 支持常见的文件格式. 如图片/文档/压缩文件
   *    该组件在打开文件后可以进行分享、保存、打印等操作, 需添加以下 KV 到 Info.plist 中
   *    <key>NSPhotoLibraryAddUsageDescription</key>
   *    <string></string>
   */
  async openFile(file, options) {
    file = await getString(file, 'file path');
    // iOS
    if (!IsAndroid) {
      const {onClose, ...props} = options||{};
      props.file = file;
      if (onClose) {
        props.reqId = getDismissListenerId(onClose);
      }
      return ArchivesModule.openFile(props);
    }
    // Android
    const scheme = file.match(/^([^\/]+):\/\//);
    if (Platform.Version >= 24) {
      if (!scheme || "file" === scheme[1]) {
        file = await fs.getShareUri(file);
      }
    } else if (!scheme) {
      file = "file://" + file;
    }
    let {mime, title, onClose} = options;
    const params = {
      onClose,
      data:file,
      action:'android.content.Intent$ACTION_VIEW',
      flag:['FLAG_GRANT_READ_URI_PERMISSION']
    };
    if (!mime) {
      mime = await fs.getMime(file);
    }
    if (mime) {
      params.type = mime;
    }
    if (title) {
      params.extras = [{
        key:"android.intent.extra.SUBJECT",
        value:title
      }]
    }
    return await fs.sendIntent(params);
  },

  // 从文件路径获取 mimeType, 根据文件后缀判断的, file 可以是 string 或 Array<string>
  async getMime(files) {
    return await getStuff(files);
  },

  // 从 mimeType 获取对应 extension 后缀, mime 可以是 string 或 Array<string>
  async getExt(mime) {
    return await getStuff(mime, true);
  },

  // file: 支持所有 scheme 路径, algorithm 可指定算法, 比如 md5(默认), sha256;
  async getHash(file, algorithm){
    return ArchivesModule.getHash({
      file: await getFilePath(file),
      hash: algorithm||"md5"
    });
  },

  // 加载字体, file 支持所有 scheme 路径;
  // 1. Android API >=26 才支持 content:// 路径
  // 2. iOS 会忽略 fontName, 会直接使用 ttf 文件内置的字体名
  async loadFont(fontName, file) {
    return await ArchivesModule.loadFont(fontName, await getFilePath(file, 'font path'));
  },

  // 重载 js bundle
  async reload() {
    if (!__DEV__) {
      return ArchivesModule.reload();
    }
    return new Promise((resolve, reject) => {
      try {
        DevSettings.reload();
        resolve(null)
      } catch (e) {
        reject(e);
      }
    });
  },

  // 解压 zip 文件, file 支持所有 scheme 路径
  // 若指定 md5 则会对 zip 文件进行 md5 hash 校验, 另需注意: 如果解压目标 dir 已存在, 将被删除
  async unzip(file, dir, md5){
    return await unzipFile(file, dir, md5)
  },

  // 使用 diff 算法, 合并增量 patch 到 source, 并保存到 dest
  // 该函数为 diff 工具暴露给 js 的工具函数, 可用于 app 内需要增量更新的文件
  // source, patch 支持所有 scheme 路径; dest 仅支持有读写权限的路径
  async mergePatch(source, patch, dest){
    source = await getFilePath(source, 'source path');
    patch = await getFilePath(patch, 'patch path');
    dest = await getString(dest, 'dest path');
    return ArchivesModule.mergePatch({
      origin: source,
      source: patch,
      dest
    })
  },

  // 热更: 解压全量 bundle 包, bundle 支持所有 scheme 路径, 必须指定新版本 md5 以供校验
  async unzipBundle(bundle, md5){
    return unzipFile(bundle, ArchivesModule.status.downloadRootDir + '/' + md5, md5, true)
  },

  // 热更: 解压相对于安装包的 patch 增量包, patch 支持所有 scheme 路径
  // md5Version(必选): 新热更版本的版本号, 通常为新版本 bundle 的 md5 值
  // patchMd5(可选): 指定 patch 文件的 md5 hash 值, 用于校验
  async unzipPatch(patch, md5Version, patchMd5){
    const source = await getFilePath(patch);
    const version = checkMd5(md5Version, true);
    const params = {source, dest: ArchivesModule.status.downloadRootDir + '/' + version};
    bindMd5(params, patchMd5);
    return ArchivesModule.unzipPatch(params);
  },

  // 热更: 解压相对于当前版本的 patch 增量包, patch 支持所有 scheme 路径
  // md5Version(必选): 新热更版本的版本号, 通常为新版本 bundle 的 md5 值
  // patchMd5(可选): 指定 patch 文件的 md5 hash 值, 用于校验
  async unzipDiff(patch, md5Version, patchMd5){
    const source = await getFilePath(patch);
    const version = checkMd5(md5Version, true);
    const origin = ArchivesModule.status.currentVersion;
    const params = {
      source,
      origin,
      dest: ArchivesModule.status.downloadRootDir + '/' + version
    };
    bindMd5(params, patchMd5);
    return ArchivesModule.unzipDiff(params);
  },

  // 热更: 切换到指定的热更版本(reload:true 立即重载生效,否则下次启动时生效)
  async switchVersion(md5Version, reload) {
    return ArchivesModule.switchVersion({
      hash: checkMd5(md5Version, true),
      reload: !!reload
    })
  },

  // 热更: app 启动后, 生效当前运行的热更版本,否则下次启动将回退到上个版本
  async markSuccess() {
    return ArchivesModule.markSuccess()
  },

  // 热更: 清除热更补丁, 恢复到冷版本(reload:true 立即重载生效,否则下次启动时生效)
  async reinitialize(reload) {
    return ArchivesModule.reinitialize(Boolean(reload));
  },

  // [iOS Only] 保存文件到相册, file支持 file://, http://, data://base64; 
  // options:{type, album} type='photo|video|auto' 指明文件是图片还是视频; album 设置相册名称
  async saveToCameraRoll(file, options){
    checkOs('saveToCameraRoll', true);
    return await ArchivesModule.saveToCameraRoll(file, options)
  },

  // [Android Only] 将指定的 file:// 路径文件添加到系统相册
  async scanFile(file){
    checkOs('scanFile');
    return await ArchivesModule.scanFile(file)
  },

  // [Android Only] Android 11.0+ 判断是否有 MANAGE_EXTERNAL_STORAGE 的权限
  async isExternalManager(){
    checkOs('isExternalManager');
    return await ArchivesModule.isExternalManager()
  },

  // [Android Only] Android 11.0+ 请求用户授权 MANAGE_EXTERNAL_STORAGE 的权限
  async requestExternalManager(){
    checkOs('requestExternalManager');
    return new Promise((resolve, reject) => {
      fs.sendIntent({
        action:'android.provider.Settings$ACTION_MANAGE_APP_ALL_FILES_ACCESS_PERMISSION',
        data:"package:" + ArchivesModule.status.packageName,
        onClose:resolve
      }).catch(reject);
    });
  },

  // [Android Only] 获取 APP 私有文件的 content:// 路径, 可共享给其他 APP 读取,
  // 比如 openFile 函数, 就是利用该特性; 这里暴露一个方法, 比如可以用在分享图片到微信
  async getShareUri(file){
    checkOs('getShareUri');
    return await ArchivesModule.getShareUri(file)
  },

  /**
   * [Android Only] 获取共享存储空间的目录路径, 可使用 readDir 读取目录(需申请 WRITE_EXTERNAL_STORAGE 权限)
   * mediaType 支持 
   *   "images|video|audio|files|downloads|audio.artists|audio.albums|audio.genres|audio.playlists"
   * type 支持
   *   "external|internal"
   */
  async getContentUri(mediaType, type){
    checkOs('getContentUri');
    if (mediaType) {
      mediaType = mediaType.toLowerCase();
      if (['images', 'video', 'audio'].includes(mediaType)) {
        mediaType = capitalize(mediaType) + '$Media';
      } else {
        mediaType = mediaType.split('.').map(capitalize).join('$');
      }
    } else {
      mediaType = "Files"
    }
    return await ArchivesModule.getContentUri(mediaType, type||"external")
  },

  /**
   * [Android Only] 打开一个意图页, 可参考通用意图: https://developer.android.com/guide/components/intents-common
   * options: {
   *   *action: '',  可直接设置,如 'android.intent.action.VIEW', 也可指定为 'Class$property' 如 'android.content.Intent$ACTION_VIEW'
   *   data: '',  要传递的数据
   *   type: '',  数据的 mimeType
   *   categories: ['',..], 类别,可设置多个,单个值的设置方式与 action 相同
   *   package:'',  设置明确的应用程序包名称
   *   component:'package/class', 设置显式意图, 如分享到微信 'com.tencent.mm/com.tencent.mm.ui.tools.ShareImgUI',
   *   identifier:'', 标识符, Android10.0+ 之后生效
   *   extras:[                                    要传递的额外数据
   *      {key:'', value:String|Number|Bool},      值可以是字符串|数字|布尔值
   *      {key:'', value:'', type:'uri'},          值是字符串时, 可通过 type 指明这是一个uri
   *      {key:'', value:[], type:'string|int|uri'}值可以是数组, 通过 type 指明数组单项值的类型, 缺省为 string
   *   ],
   *   flag:['FLAG_ACTIVITY_NEW_TASK', ''],  打开方式, 支持的 FLAG 可参考
   *   https://android.googlesource.com/platform/frameworks/base/+/master/core/java/android/content/Intent.java#6601
   *   onClose:Function(),  从意图打开页返回到APP时的回调
   * }
   */
  async sendIntent(options){
    checkOs('sendIntent');
    const {onClose, ...props} = options||{};
    if (onClose) {
      props.reqId = getDismissListenerId(onClose);
    }
    return await ArchivesModule.sendIntent(props)
  },

 /**
  * [Android Only] 使用系统自带的 downloadManager 下载文件，任务添加失败会抛出异常
  * 任务添加成功并不代表下载成功，下载过程中还有可能出现错误，可使用 onError 监听
  * options: {
  *   *url: 'http://',
  *   mime:'',     默认情况下会根据请求 url 返回的 Response header 自动设置, 若不准确可手动设置 
  *   destFile:'', 下载目录, 只能下载到 external 文件夹, 默认为 external.AppDocument/Download (无需权限),
  *                也可下载到 external 公共目录, 如 external.Download, 但需提前自行申请 WRITE_EXTERNAL_STORAGE 权限
  *   title:'',       下载通知中显示的标题
  *   description:'', 下载通知中显示的描述信息
  *   scannable:Bool, 是否可被扫描
  *   roaming:Bool,   漫游状态是否下载
  *   quiet: Bool,    是否在推送栏显示
  *   network:int,    MOBILE:1, WIFI:2, ALL:3
  *   headers:{}      自定义 header 头
  *   onError:    Function(error), 下载过程中的错误回调
  *   onProgress: Function({total, loaded, percent}), 监听下载进度
  *   onComplete: Function({file, url, mime, size, mtime}), 下载完成的回调
  * }
  */
  async download(options) {
    checkOs('download');
    return await startDownload(options);
  },

 /**
  * [Android Only] 自行下载(如使用 fetch)一个文件后, 可使用该函数添加一个下载完毕的推送
  * options: {
  *   *file: '',  文件路径必须在 external 目录下, 否则点击通知无法打开文件
  *   mime:'',    文件 mimeType, 打开文件会据此选择合适的 app, 默认根据文件后缀自动设置, 若不准确可手动设置
  *   title: '',
  *   description:'',
  *   quiet:Bool, 若true,用户可在下载文件管理中看到,不显示到推送栏
  * }
  */
  async addDownload(options) {
    checkOs('addDownload');
    const {file} = options||{};
    return getString(file, 'file path').then(() => {
      return ArchivesModule.addDownloadComplete(options)
    });
  },

  // [Android Only] 重启 app (iOS 没有重启功能)
  async restartAndroid() {
    checkOs('restartAndroid');
    return ArchivesModule.restart();
  },
};

module.exports = fs;