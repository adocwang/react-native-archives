# react-native-archives

## 说明

项目源码部分来源或参考 [react-native-pushy](https://github.com/reactnativecn/react-native-pushy) 和 [react-native-fs](https://github.com/itinance/react-native-fs)


## 安装

`yarn add react-native-archives`


## 使用

```js
import {
    fs, 
    utils, 
    dirs, 
    status, 
    external, 
    fetchPlus, 
    HttpService
} from "react-native-archives"
```

https://developer.apple.com/library/archive/documentation/FileManagement/Conceptual/FileSystemProgrammingGuide/FileSystemOverview/FileSystemOverview.html



## dirs

手机内部存储相关文件夹，专属于 app 的私有目录，无需权限

```js
dirs:{
    // 安装包位置
    // 二者可以使用 zip 解码读取
    MainBundle:"",  
      // Android: /data/app/com.vendor.product-.../base.apk
      // iOS: /prefix/Bundle/Application/E57.../project.app

    // 个人文件保存目录，可以创建子文件夹
    // 保存用户的私有文件，云同步时一般都会同步该文件夹
    Document:"",    
      // Android: /data/user/0/com.vendor.product/files
      // iOS: /prefix/Data/Application/F18.../Documents

    // app 配置文件保存目录，可以创建子文件夹
    // iOS 默认有 "Caches"/"Preferences" 两个文件夹
    // (Preferences 可存放一些用户的偏好设置)
    // 云同步会同步除 "Caches" 文件夹之外的所有文件
    // Android 云同步规则未知
    Library:"",     
      // Android: /data/user/0/com.vendor.product/files
      // iOS: /prefix/Data/Application/F18.../Library

    // 缓存文件保存目录
    // 用于存放不重要，删除了也没影响，但希望尽量不要删除的文件
    Caches: "",     
      // Android: /data/user/0/com.vendor.product/cache
      // iOS: /prefix/Data/Application/F18.../Library/Caches

    // 临时文件保存目录
    // 存放随时可删除而不影响运行的临时文件
    Temporary:"",   
      // Android: /data/user/0/com.vendor.product/cache
      // iOS: /prefix/Data/Application/F18.../tmp
}
```



## external

Android only (iOS 仅能访问 app 所属沙盒目录)，外部存储目录，有可能在 SD 卡中，若手机没有 SD 卡，一般也可用，系统虚拟出来的外部存储目录。

若需要保存较大文件，建议存在这个系列的目录下，而不是 dirs 目录下

```js
external:{
    // app 在外部存储上的缓存、文件目录，也会随着 app 的卸载而删除
    AppCaches: "",
      // Android: /storage/emulated/0/Android/data/com.vendor.product/cache

    AppDocument:"",
      // Android: /storage/emulated/0/Android/data/com.vendor.product/files
 

    // 以下是所有 app 的公用目录，存储的文件不会随着 app 卸载而删除, 需要额外申请权限

    Root:"",    // 外部存储根目录
      // Android: /storage/emulated/0
    Music:"",   // 音乐文件夹
      // Android: /storage/emulated/0/Music
    Picture:"",   // 图片
      // Android: /storage/emulated/0/Pictures
    DCIM:"",   // 相片
      // Android: /storage/emulated/0/DCIM
    Movie:"",   // 影音
      // Android: /storage/emulated/0/Movies
    Download:"",   // 下载
      // Android: /storage/emulated/0/Download
    Podcasts:"",   // 播客，订阅
      // Android: /storage/emulated/0/Podcasts
    Ringtones:"",   // 来电铃声
      // Android: /storage/emulated/0/Ringtones
    Alarms:"",      // 闹钟
      // Android: /storage/emulated/0/Alarms
    Notifications:"",   // 通知铃声
      // Android: /storage/emulated/0/Notifications
}
```

## status

为热更提供的相关变量

```js
status: {
    downloadRootDir: "",  //热更包保存路径
      // Android: /data/user/0/com.vendor.product/files/_epush
      // iOS: 
    packageVersion: "",   //当前包主版本
    currentVersion: "",   //当前热更版本
    isFirstTime: "",      //是否为该热更版本首次运行(需手动标记为成功)
    isRolledBack:"",      //是否为热更失败，回退到 currentVersion 版本, 仅提示一次
}
```

## utils

这其实内部使用的一个方法集合，一般用不到，不过内部提供的一个方法，可能用的到，所以也导出了。

```js
// 将 Blob 类型转为 字符串 或 base64 字符串
const render = blobRender(Blob:blob)

render.text();
render.base64();
```

## fs

```js
// 由文件路径获取其 mime type
fs.getMime(String:filePath).then((String:mimeType) => {})
fs.getMime([String:filePath]).then((Array:[mimeType]) => {})

// 获取文件的 hash 值 (MD5|SHA-1|SHA-256|SHA-512)
fs.getHash(String:filePath, String:algorithm).then((String:hash) => {})

// 获取文件的共享 uri, android 为  content://
// 可以让其他程序读取该文件
fs.getShareUri(String:filePath).then((String:uri) => {})

// 路径是否为文件夹 (true: 是, false:是文件夹, null:不存在)
fs.isDir(String:filePath).then((Boolean:yes) => {})

// 创建文件夹, 创建失败会抛出异常
fs.mkDir(String:filePath, Boolean:recursive).then((NULL) => {})

// 读取文件夹下 文件列表
fs.readDir(String:filePath).then((Array:list) => {})

// 删除文件夹
fs.rmDir(String:filePath, Boolean:recursive).then((NULL) => {})

// 获取系统 Content (一般为相册) 的 uri,  获取到的结果可用在 readDir
// 即读取系统相册内容列表 
// mediaType: Files | Images$Media | Audio$Media | Video$Media
// name: internal | external
fs.getContentUri(String:mediaType, String:name).then((String:uri) => {})

// 读取文件内容
fs.readFile(
    String:filePath,  // 文件路径
    String:encoding,  // text | blob | base64 | buffer
    Int:offset,       // 读取的起点位置, 若为负数, 则从文件末尾算起, 不指定则从开头开始
    Int:length        // 读取长度, 不指定, 则读取到结尾
).then(any =>{})

// 写文件
fs.writeFile(
   String:filePath,  // 文件路径
   content, // 写入内容, 可以是 Blob 或 string, 
            // 若写入base64, 设置为 [base64Str], 保存时会自动 decode
   flag     //  不指定(覆盖写入) 
            //  true(追加写入) 
            //  Number(在指定的位置写入, 为负数则从文件尾部算起)
).then(NULL => {})

// 复制文件, 失败会抛出异常
fs.copyFile(String:sourcePath, String:destPath, Boolean:overwrite).then(NULL)

// 移动文件, 失败会抛出异常
fs.moveFile(String:sourcePath, String:destPath, Boolean:overwrite).then(NULL)

// 删除文件, 失败会抛出异常
fs.unlink(String:filePath).then(NULL)

// 使用系统默认应用打开文件, mimeType 默认根据文件后缀自动
// 若为后缀不规范, 可手动强制指定
fs.openFile(String:filePath, String:mimeType).then(NULL)

/*
使用系统自带的 downloadManager 下载文件 (android only)
options: {
    *url: 'http://',
    mime:'',  缺省情况会更加文件后缀自动判断, 若为 url 文件后缀与mime不匹配, 需手工设置
    dest: '', 默认下载到 external 私有目录(无需权限), 
              也可以指定为 external 公共目录, 需要有 WRITE_EXTERNAL_STORAGE 权限
    title:'',
    description:'',
    scannable:Bool, 是否可被扫描
    roaming:Bool, 漫游状态是否下载
    quiet: Bool, 是否在推送栏显示
    network:int,  MOBILE:1, WIFI:2, ALL:3
    headers:{}  自定义 header 头
    onProgress: Function({total, loaded, percent}), 监听下载进度
    onError: Function(error),  下载失败回调
    onDownload: Function({file, url, mime, size, mtime}),  下载完成的回调
    onAutoOpen: Function(null|error), 尝试自动打开文件,并监听打开是否成功
}
*/
fs.download(options).then(taskId)

/*
使用其他 http 方法(如 fetch) 下载完文件, 
可使用该函数添加一个下载完毕的推送 (android only)
options: {
    *file: '',
    mime:'',
    title: '',
    description:'',
    quiet:Bool  若true,用户可在下载文件管理中看到,不显示到推送栏
}
*/
fs.addDownload(options).then(NULL)

// 加载一个字体文件
fs.loadFont(fontFamily, file).then(NULL)

// 解压 zip 文件, md5 可缺省, 若设置了, 会在解压前校验 zip 文件的 md5 hash
// 校验失败会抛出异常
fs.unzip(String:filePath, String:dir, String:md5).then(NULL)

// 将 path 使用 bsdiff 算法 合并到 source, 保存为 dest
fs.bsPatch(String:source, String:patch, String:dest).then(NULL)

// 重载应用 (release 模式重载 js bundle / debug 模式会重启 app)
fs.reload();

// 重启 app
fs.restart();
```

## fs

以下为专门应对热更的接口

```js

/** 
 * 解压 热更全量包
 * filePath: 已下载好的全量包本地地址 
 * md5: 可选, 全量包的 md5 值, 若提供则会在解压前进行验证
 *      若不提供则自动获取
 * 
 * 成功后可
 * switchVersion(md5 [, reload])
 * 
*/
fs.unzipBundle(String:filePath, String:md5).then(NULL)


/** 
 * 解压相对于安装包的 增量 patch 包
 * file: 已下载好的增量 patch 包本地地址
 * md5Version: 必须提供, 该 md5 值为 patch 合并到安装包后的 md5 值
 *             即本次的热更版本号
 * patchMd5: 可选，patch 文件的 md5 值
 * 
 * 
 * 成功后操作同上
*/
fs.unzipPatch(String:file, String:md5Version, String:patchMd5).then(NULL)


/** 
 * 解压相对于 originVersion 的 增量 patch 包
 * file: 已下载好的增量 patch 包本地地址
 * md5Version: 必须提供, 该 md5 值为 patch 合并到 originVersion 后的 md5 值
 *             即本次的热更版本号
 * originVersion: 必须提供, 原热更版本包的 md5 值
 *                该值通常为 status.currentVersion
 * patchMd5: 可选，patch 文件的 md5 值
 * 
 * 
 * 成功后操作同上
*/
fs.unzipDiff(
    String:file, 
    String:md5Version, 
    String:originVersion, 
    String:patchMd5
).then(NULL)

/**
 * 切换到指定的热更版本
 * md5Version: 要切换到的热更版本
 * reload: 是否立即重启(默认为false)
*/
fs.switchVersion(String:md5Version, Boolean:reload).then(NULL)

/**
 * 通过 status.isFirstTime 判断是否为热更版本首次启动, 
 * 通过该方法生效当前热更版本
 * 1. 若在启动后不调用该方法, 下次启动会回退
 * 2. 若启动后发生异常, 无法执行该方法, 下次启动回退
*/
fs.markSuccess();

```

    
##  fetchPlus

使用方法与 `fetch` 一致，但增加来一些参数

```js
fetchPlus(options)
fetchPlus(Request|url, options)

// options 支持 fetch 原有参数, 
options:{
  url,
  method,
  credentials,
  headers,
  mode,
  body,
  signal
}


// 新增以下参数
options:{
    timeout:int,      // 超时时间 (毫秒)
    resText:Boolean,  // 默认与原 fetch 保持一致, 为 false
    saveTo:String,    // 将请求获得结果保存为文件, 指定文件路径
    keepBlob: Boolean, // 默认为 false

    onHeader: Function, // 得到 header 响应的回调
    onUpload: Function, // post 请求, 上传进度回调
    onDownload: Function, // response body 下载进度 回调
}
```

这里说一下 `resText` 和 `keepBlob`

RN 请求默认会将请求结果缓存在原生中，JS 层得到一个 Blob, 利用 Blob 读取原生缓存，可读取为 stirng / base64 / buffer 等，即实现 JS 中 Response 对象的 `text()` / `json()` / `blob()` 等方法。

这样做的好处是通用性较强，但也带来一定副作用，一般使用中，很少在使用完手动关闭 Blob 对象，造成这个缓存可能在 app 生命周期内缓存在内容中， RN 获取会回收这部分内存，但目前尚不明确其回收机制。

所以，若明确知道请求后获得的 Response 为 String 类型，可设置 `resText:true`， 这样可避免原生层缓存 fetch 结果。

`keepBlob` 是针对 `saveTo` 的设置，在指定了 `saveTo` 的情况下，请求被强制为 `resText:false`，保存文件后，默认会关闭 Blob 对象，此时就无法在 fetch().then() 中读取文件 Blob 数据来，因为一般保存文件，是不需要再读取文件内容，若有特殊需要，可以设置 `keepBlob:true`，这样就不会关闭 Blob 对象了
 

## HttpService

在 fetchPlus 基础上拓展的一个 JS 类，不多做说明，具体建议看源码。

```js
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


//在其他地方 就可以这么用了
//------------------------------------------------------------

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

```


## 命令行

需额外安装 `yarn add [-g] easypush`

命令行 `easypush` 查看可用命令，若未全局安装， `npx easypush` 替代即可

可使用命令行完成 热更 全量包/补丁包 的生成，并上传到服务器，服务端需要实现的接口参见 [api.js](local-cli/api.js#L41)，自行实现即可

（搜索 `POST:` 可查看所有需要实现的 api）
