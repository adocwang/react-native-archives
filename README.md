## 说明

项目源码部分来源或参考 [react-native-pushy](https://github.com/reactnativecn/react-native-pushy) 和 [react-native-fs](https://github.com/itinance/react-native-fs)，支持 React-Native 0.50.0+


# 💽 安装

`yarn add react-native-archives`


### ✤ Android

在 `android/app/src/main/AndroidManifest.xml` 根据需要添加声明

```xml
<manifest>
  ...

  <!--如需通过 fs.openFile() 安装 apk-->
  <uses-permission android:name="android.permission.REQUEST_INSTALL_PACKAGES"/>

  <!--如需在 Android 11.0+ 读写所有文件-->
  <uses-permission android:name="android.permission.MANAGE_EXTERNAL_STORAGE"/>

  <!--如需读写共享存储-->
  <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE"/>
  <uses-permission android:name="android.permission.WRITE_EXTERNAL_STORAGE"/>
  <application
    android:requestLegacyExternalStorage="true"
    ...
  />
  ...
<application>
```

配置 `android/app/build.gradle`，禁用 release 编译的 crunchPngs 优化，用于热更新

```gradle
...
android {
  ...
  signingConfigs { ... }
  buildTypes {
      release {
          ...
          // 禁用 crunchPngs 优化
          crunchPngs false
      }
  }
}
...
```

修改 `android/app/src/main/com.project/MainApplication.java`，用于热更新

```java
...

// 新增: 用于 react-native-archives 热更
import com.malacca.archives.ArchivesModule;


public class MainApplication extends Application implements ReactApplication {

  private final ReactNativeHost mReactNativeHost = new ReactNativeHost(this) {

    ...
    
    // 新增: 用于 react-native-archives 热更
    @Override
    protected String getJSBundleFile() {
      // 第二个参数为缺省 bundle 路径, 若使用 RN 内置 bundle, 设为 null 即可
      return ArchivesModule.getJSBundleFile(MainApplication.this, null);
    }


    @Override
    public boolean getUseDeveloperSupport() {
      // 可选修改: 若需在 Debug 模式下也能测试热更功能, 修改此处
      // return BuildConfig.DEBUG;
      return BuildConfig.DEBUG && !ArchivesModule.useJSBundleFile(MainApplication.this);
    }

    ...
  }
}
...
```

###  iOS

```
<key>NSPhotoLibraryUsageDescription</key>
<string>请允许APP访问您的相册</string>
<key>NSPhotoLibraryAddUsageDescription</key>
<string>请允许APP保存图片到相册</string>
```


# 📙 使用

```js
import {
  dirs,
  external,
  status,
  fs,
  fetchPlus,
  HttpService
} from "react-native-archives"
```


### ♣︎ dirs

应用内部存储空间，有以下特点
- 专属于 app 的私有目录，无需权限，可直接读写，会随着  app 的卸载而删除
- 其他 APP 以及用户无法访问，适合存放敏感数据
- 对于 Android ，还有以下几点需要注意
  - 若用户使用的是 root 后的 Android ，则可以访问
  - 在 Android 10（API 级别 29）及更高版本中，系统会对文件加密
  - 内部存储空间有限，不适合存储较大数据（早期 Android 较大数据存储在 SD 卡中）

```js
dirs:{
  // 安装包位置, 二者皆可使用 zip 解码读取
  MainBundle:"",  
    // Android: /data/app/com.vendor.product-.../base.apk
    // iOS: /prefix/Bundle/Application/E57.../project.app

  // 应用内部存储空间根目录
  Root:"",    
    // Android: /data/user/0/com.vendor.product
    // iOS: /prefix/Data/Application/F18...

  // 个人文件保存目录
  // 保存用户的私有文件，云同步时一般都会同步该文件夹
  Document:"",    
    // Android: /data/user/0/com.vendor.product/files
    // iOS: /prefix/Data/Application/F18.../Documents

  // app 配置文件保存目录
  // iOS 系统默认有 "Caches"/"Preferences" 两个子文件夹
  //     (Preferences 用于存放一些用户的偏好设置)
  //     云同步会同步除 "Caches" 文件夹之外的所有文件
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
  // 存放随时可删除而不影响运行的临时文件，系统可能会删除文件释放空间
  Temporary:"",   
    // Android: /data/user/0/com.vendor.product/cache
    // iOS: /prefix/Data/Application/F18.../tmp
}
```


### ♣︎ external

外部存储目: Android only (iOS 仅能访问 app 所属沙盒目录)，若需要保存较大文件，建议存在这个系列的目录下，而不是 dirs 目录下

```js
external:{
  // app 的专属外部存储空间，无需权限即可读写，会随着 app 的卸载而删除
  AppRoot: "",
    // Android: /storage/emulated/0/Android/data/com.vendor.product

  AppCaches: "",
    // Android: /storage/emulated/0/Android/data/com.vendor.product/cache

  AppDocument:"",
    // Android: /storage/emulated/0/Android/data/com.vendor.product/files


  // 所有 app 的共享空间，存储的文件不会随着 app 卸载而删除, 需要额外申请权限

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

Android 读写共享空间的权限申请

1. Android 6.0 之前：仅需在配置文件 `AndroidManifest.xml` 中声明 `uses-permission`， 即可对整个 `external.Root` 目录进行读写，包括其他 app 的外部存储目录。
2. Andorid 6.0 ~ 9.0：除了声明之外，还需在使用时动态申请 `WRITE_EXTERNAL_STORAGE` 权限，用户授权后可对整个 `external.Root` 目录进行读写，包括其他 app 的外部存储目录。
3. Android 10.0：在配置文件 `AndroidManifest.xml` 中添加 `android:requestLegacyExternalStorage` 用以向下兼容，使用方法与 9.0 完全相同。
4. Android 11.0 之后：动态请求 `WRITE_EXTERNAL_STORAGE` 权限之后，只能读写媒体文件夹 (external 导出的文件夹路径)，但不能创建子文件夹或读写这些文件夹之外的路径；且读写的文件格式受到限制，比如在 `Picture` 文件夹中只能读写图片格式的文件。如果仍需如同之前的版本一样，读写所有文件，需要申请 `MANAGE_EXTERNAL_STORAGE` 权限，首先需在 `AndroidManifest.xml` 声明，然后使用如下代码动态申请

    ```ts
    import {Platform} from 'react-native';
    import {fs} from "react-native-archives";

    async funciton isExternalManager() {
      if (Platform.Version < 30 || (await fs.isExternalManager())) {
        return true;
      }
      await fs.requestExternalManager();
      return await fs.isExternalManager();
    }
    ```
    **注意:** 即使获取了权限，仍有部分文件夹不可读写，如 `external.Root/Android/data`，并且声明该权限后，[上架应用市场](https://support.google.com/googleplay/android-developer/answer/10467955) 需要说明原因，否则会被拒

iOS 目录

1. 一些资料: [iOS 目录](
https://developer.apple.com/documentation/foundation/nssearchpathdirectory/nsapplicationsupportdirectory)



### ♣︎ status

为热更提供的相关变量

```js
status: {
  downloadRootDir: "",  //热更包保存路径
    // Android: /data/user/0/com.vendor.product/files/_epush
    // iOS: 
  packageName:"com.vender.project"  // 包ID  
  packageVersion: "1.0",    //当前包主版本
  currentVersion: "...",    //当前热更版本,16位 md5 值
  isFirstTime: Bool, //是否为该热更版本首次运行(需手动标记为成功,否则下次启动会回滚)
  rolledVersion:"",  //若热更失败会回滚,该值为被回滚的热更版本
}
```


### ♣︎ fs

基础 API，可在 Android, iOS 系统使用

```ts
// 路径是否为文件夹 (true:是文件夹, false:是文件, null:不存在)
fs.isDir(path: string): Promise<boolean | null>


// 创建文件夹, 创建失败会抛出异常
fs.mkDir(dirPath: string, recursive?: boolean): Promise<null>


// 删除文件夹, 失败会抛出异常
fs.rmDir(dirPath: string, recursive?: boolean): Promise<null>


// 读取文件夹下 文件列表
fs.readDir(dirPath: string): Promise<Array<object>>


// 写文件, 失败会抛出异常
fs.writeFile(
  filePath:string, // 文件路径
  content:any,     // 写入内容, 可以是 string, Blob, ArrayBuffer 
                   // 若内容是base64, 可使用 [base64Str], 保存时会自动 decode
  flag?:any        // 不指定(覆盖写入) 
                   // true(追加写入) 
                   // Number(在指定的位置写入, 为负数则从文件尾部算起)
): Promise<null>


// 读取文件内容
fs.readFile(
  filePath:string,  // 文件路径
  encoding?:string, // blob | buffer | text | base64 | uri
  offset?:number,   // 读取的起点位置, 若为负数, 则从文件末尾算起, 不指定则从开头开始
  length?:number    // 读取长度, 不指定, 则读取到结尾
): Promise<string | Blob | ArrayBuffer>


// 复制文件, 失败会抛出异常
fs.copyFile(source: string, dest: string, overwrite?: boolean): Promise<null>


// 移动文件, 失败会抛出异常
fs.moveFile(source: string, dest: string, overwrite?: boolean): Promise<null>


// 删除文件, 失败会抛出异常
fs.unlink(file: string): Promise<null>


// 使用系统默认应用打开文件, 失败会抛出异常
fs.openFile(filePath:string, Object?:{
  mime?: string,         // mimeType 默认根据文件后缀自动
                         // 若文件后缀不规范, 可手动强制指定
  title?: string,        // 标题, 由打开文件的应用决定是否使用
  onClose?:(() => any),  // 关闭回调
}): Promise<null>


// 由文件路径获取其 mime type, 可通过数组参数批量获取
fs.getMime(path: string | ): Promise<string>
fs.getMime(path: Array<string>): Promise<Array<string>>


// 由 mime type 获取对应的文件后缀, 可通过数组参数批量获取
fs.getExt(mime: string | ): Promise<string>
fs.getExt(mime: Array<string>): Promise<Array<string>>


// 获取文件的 hash 值, algorithm 支持: MD5|SHA-1|SHA-256|SHA-512
fs.getHash(file: string, algorithm?: string): Promise<string>


// 加载一个字体文件, 失败会抛出异常
fs.loadFont(fontName: string, filePath: string): Promise<null>


// 重载应用 (即重载 js bundle)
fs.reload(): Promise<null>;


// 解压 zip 文件, md5 可缺省, 若设置了, 会在解压前校验 zip 文件的 md5 hash
// 校验失败或解压失败会抛出异常
fs.unzip(filePath: string, dirPath: string, md5?: string): Promise<null>


// 将 path 使用 hdiff 算法 合并到 source, 保存为 dest
fs.mergePatch(source:string, patch:string, dest:string): Promise<null>
```


### ♣︎ fs

热更 API，可在 Android, iOS 系统使用

```ts
/** 
 * 解压 全量热更包
 * bundle: 已下载好的全量包本地路径
 *    md5: 全量包的 md5 值, 会在解压前进行验证
 * 
 * 成功后可通过以下方法切换至该版本
 * switchVersion(md5 [, reload])
*/
fs.unzipBundle(bundle:string, md5:string): Promise<null>


/** 
 * 解压相对于安装包的 patch 增量包
 *      patch: 已下载好的增量 patch 包本地路径
 * md5Version: 必须提供, 该 md5 值为 patch 合并到安装包后的 md5 值
 *             即本次的热更版本号
 *   patchMd5: 可选，用于校验 patch 文件的 md5 值
 * 
 * 成功后操作同上
*/
fs.unzipPatch(patch:string, md5Version:string, patchMd5?:string): Promise<null>


/** 
 * 解压相对于当前热更版本的 patch 增量包
 *      patch: 已下载好的增量 patch 包本地路径
 * md5Version: 必须提供, 该 md5 值为 patch 合并后的 md5 值
 *             即本次的热更版本号
 *   patchMd5: 可选，用于校验 patch 文件的 md5 值
 * 
 * 成功后操作同上
*/
fs.unzipDiff(patch:string, md5Version:string, patchMd5?:string): Promise<null>


/**
 * 切换到指定的热更版本
 * md5Version: 要切换到的热更版本
 *     reload: 是否立即重载(默认为false)
*/
fs.switchVersion(md5Version:string, reload?:boolean): Promise<null>


/**
 * 通过 status.isFirstTime 判断是否为热更版本首次启动
 * 若为首次启动可通过该方法生效当前热更版本
 * 1. 若在首次启动后不调用该方法, 下次启动会回滚至上个版本
 * 2. 若启动后 jsBundle 发生异常, 无法执行该方法, 下次启动会回滚至上个版本
 * 这样可比避免当前热更版出现错误而导致的闪退现象
*/
fs.markSuccess();


// 清除所有热更版本, 该方法主要用于测试，在生产版实无使用必要
fs.reinitialize(reload?:boolean): Promise<null>;
```


### ♣︎ fs

仅可在 Android 系统使用的 API；`sendIntent` [FLAG 参考](https://android.googlesource.com/platform/frameworks/base/+/master/core/java/android/content/Intent.java#6601)

```js
// 将指定的文件添加到系统相册, Android 默认也会自动索引图片文件
// 但不是实时的, 该方法可立即让用户在相册看到指定的图片文件
fs.scanFile(filePath: string): Promise<string>


// 是否拥有 MANAGE_EXTERNAL_STORAGE 权限，Android11.0 之前会抛出异常
fs.isExternalManager(): Promise<boolean>


// 申请 MANAGE_EXTERNAL_STORAGE 权限
fs.requestExternalManager(): Promise<null>


// 获取文件的共享 uri, 格式为 content://
// 可以让其他应用程序读取该文件，比如用于分享到社交软件
fs.getShareUri(filePath: string): Promise<string>


// 获取系统媒体目录的 Content uri, 获取到的结果可用于 readDir
// 默认为 files, 可能会返回 null, 比如低版本系统就没有 downloads uri
// mediaType: images | video | audio | files | downloads
//      type: internal | external
fs.getContentUri(mediaType?: string, type?: string): Promise<string>


/*
打开一个意图页, 可参考通用意图: 
https://developer.android.com/guide/components/intents-common
options: {
  *action: '',    必选; 可直接设置,如 'android.intent.action.VIEW', 
                  也可指定为 'Class$property'
                  如 'android.content.Intent$ACTION_VIEW'
  data: '',       要传递的数据
  type: '',       数据的 mimeType
  categories:['',..], 类别,可设置多个,单个值的设置方式与 action 相同
  package:'',     设置明确的应用程序包名称
  component:'',   设置显式意图, 如分享到微信 
                  'com.tencent.mm/com.tencent.mm.ui.tools.ShareImgUI',
  identifier:'',  标识符, Android10.0+ 之后生效
  extras:[        要传递的额外数据
    {key:'', value:String|Number|Bool}, 值可以是字符串|数字|布尔值
    {key:'', value:'', type:'uri'},     值是字符串时, 可通过 type 指明这是一个uri
    {key:'', value:[], type:'string|int|uri'}
    值可以是数组, 通过 type 指明数组单项值的类型, 缺省为 string
  ],
  flag:['FLAG_ACTIVITY_NEW_TASK', ...],  打开方式
  onClose:Function(),  从意图打开页返回到APP时的回调
}
*/
fs.sendIntent(options: Object): Promise<null>


/*
使用系统自带的 downloadManager 下载文件
options: {
  *url:'',   远程文件地址, 如 'https://',
  mime:'',   缺省情况会更加文件后缀自动判断, 若为 url 文件后缀与mime不匹配, 需手工设置
  dest: '',  保存路径，默认下载到 external 私有目录(无需权限), 
              也可以指定为 external 公共目录, 需要有 WRITE_EXTERNAL_STORAGE 权限
  title:'',
  description:'',
  scannable:Bool, 是否可被扫描
  roaming:Bool,   漫游状态是否下载
  quiet: Bool,    是否在推送栏显示
  network:int,    MOBILE:1, WIFI:2, ALL:3
  headers:{}      自定义 header 头
  onProgress: Function({total, loaded, percent}), 监听下载进度
  onError: Function(error),  下载失败回调
  onDownload: Function({file, url, mime, size, mtime}),  下载完成的回调
  onAutoOpen: Function(null|error), 尝试自动打开文件,并监听打开是否成功
}
*/
fs.download(options: Object): Promise<null>


/*
将一个文件推送给系统的 downloadManager
options: {
  *file: '',
  mime:'',
  title: '',
  description:'',
  quiet:Bool  若true,用户可在下载文件管理中看到,不显示到推送栏
}
*/
fs.addDownload(options).then(NULL)


// 重启 app, 与 reload 热重载不同, 该方法先关闭再冷启动
fs.restartAndroid(): Promise<null>;
```


### ♣︎ fs

仅可在 iOS 系统使用的 API

```ts
/* 保存文件到相册
options: {
  album?: string,  // 专辑名
  type?: 'photo' | 'video' | 'auto'
}
*/
fs.saveToCameraRoll(file: string, options?:Object): Promise<string>;
```


    
### ♣︎ fetchPlus

使用方法与 `fetch` 基本一致，但增加了一些参数

```ts
// 可类似 fetch 一样, 但也可直接用一个参数设置所有 options
fetchPlus(options): Promise<ResponsePlus>
fetchPlus(url|Request|RequestPlus, options): Promise<ResponsePlus>

// options 支持 fetch 原有参数
options:{
  url,
  method,
  credentials,
  headers,
  mode,
  body,
  signal
}

// 同时支持以下新增参数
options:{
  timeout:int,         // 超时时间 (毫秒)
  resText:Boolean,     // 默认与 fetch 保持一致, 为 false
  saveTo:String,       // 将请求获得结果保存为文件, 指定文件路径
  keepBlob: Boolean,   // 默认为 false

  onHeader: Function,  // 得到 header 响应的回调
  onUpload: Function,  // post 请求, 上传进度回调
  onDownload: Function,// response body 下载进度 回调
}
```

关于 **`resText`** 和 **`keepBlob`**

RN 请求默认会将请求结果缓存在原生中，JS 层得到一个 Blob，利用 Blob 读取原生缓存，可读取为 stirng / base64 / buffer 等，即实现 JS 中 Response 对象的 `text()` / `json()` / `blob()` 等方法。

这样做的好处是通用性较强，但也带来一定副作用，一般使用中，很少在使用完手动关闭 Blob 对象，造成这个缓存可能在 app 生命周期内缓存在内容中，RN 获取会回收这部分内存，但目前尚不明确其回收机制。

所以，若明确知道请求后所需为 String 类型，可设置 `resText:true`， 这样可避免原生层缓存 fetch 结果。

`keepBlob` 是针对 `saveTo` 的设置，在指定了 `saveTo` 的情况下，请求被强制为 `resText:false`。保存文件后，默认会关闭 Blob 对象，此时就无法在 `fetch().then()` 中读取文件 Blob 数据了，因为一般保存文件，是不需要再读取文件内容。若有特殊需要，可以设置 `keepBlob:true`，这样就不会关闭 Blob 对象了
 


### ♣︎ HttpService

在 fetchPlus 基础上拓展的一个 JS 类，用于集中管理应用的远程请求，不多做说明，具体建议看源码。

```js
// 常用方法举例
class Service extends HttpService {

  /**
   * handle 当前 Service 的错误进行上报
   * @Override
   */
  async onError(err){
    throw err;
  }

  /** 
   * 针对当前 Service 所有 request 集中进行处理
   * 比如可以在 req 中统一添加鉴权 header
   * @Override
   */
  async onRequest(req){
    return req;
  }

  /** 
   * 针对当前 Service 所有 response 集中进行通用处理
   * 比如默认情况下 fetch 404 也被认为是成功, 这里可以抛个错来中断
   * 且抛错在 onError 中也能捕获
   * @Override
   */
  async onResponse(res){
    return res;
  }


  // 扩充快捷方法
  asChrome(request){
    request.userAgent('chrome/71')
  }
  withToken(request, token){
    request.header('X-Reuest-Token', token)
  }

  
  // 应用所需 API
  async login(name, pass){
    return this.request('/login').param({
      name, pass
    }, false).send()
  }

  async updateAvatar(file){
    return this.request('/updateAvatar')
      .withToken('dddd')
      .param('avatar', file)
      .send()
  }
}
export default new Service('https://host.com');


//--------------- 在其他地方 就可以这么用了 --------------------

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

**HttpService Mock**

有时服务端还未完善，或仅是在本地调试 UI，并不想实际发送请求，此时 Mock 就很有用了

```ts
const MockData = __DEV__ ? null : {

  // 基本 Mock Response 设置方法
  // 1. status 可缺省，默认为 200
  // 2. header 可多次调用, 最终叠加返回
  // 3.  send  数据支持 json 以及 Response 对象支持的所有类型
  '/login': (res) => {
    res.status(200, 'OK').header({
      X-Foo:'foo',
      X-Bar:'bar'
    }).header('X-Baz', 'baz').send({
      code:0,
      message:''
    });
  },

  // 高级 Mock Response 设置方法
  // 1. 指明仅接受 POST 请求, 使用 GET 请求就匹配不到
  // 2. 可在处理函数中使用 req 参数获取请求数据
  // 3. 可通过指定 send 第二个参数模拟请求时长(毫秒)
  'POST /setting': async (res, req) => {
    const reqJson = await req.json();
    res.send({}, 2000)
  }
}

class Service extends HttpService {
}
export default new Service('https://host.com', MockData);
```



### ♣︎ 其他

内部使用的一个方法集合，一般用不到，不过也导出了。

```js
import {

  // 工具函数集合
  utils,
  
  // fetchPlus 获取到的 Blob 对象, 继承于 Blob
  // 相比之下, 多了 base64/dataUrl/slice 方法
  BlobPlus,

  // fetchPlus 支持的 Request 参数, 继承于 Request
  // 多了 timeout/resText/saveTo/keepBlob 等参数
  RequestPlus,

  // fetchPlus 响应返回的 Response 对象, 继承于 Response
  // 修复 blob/arrayBuffer 方法, 以 BlobPlus 替代 Blob
  ResponsePlus,

} from "react-native-archives"
```




# 💻 命令行

全局安装 

`yarn add -g easypush`

在项目根目录查看可用命令

`npx easypush`

命令行主要提供两类功能

 - 生成热更 全量包/补丁包 的工具
 - 部署/管理 服务端 APP 版本

可自行开发服务端，仅需实现 [api.js](./local-cli/api.js) 所需接口即可




# 🛠 开发

### 克隆项目

`git clone https://github.com/malacca/react-native-archives.git  --recurse-submodules`

如果忘记使用 `--recurse-submodules` 参数, 可在之后转到克隆目录执行

`git submodule update --init --recursive`

项目依赖性 [lzma](https://github.com/sisong/lzma) 和 [HDiffPatch](https://github.com/sisong/HDiffPatch.git)，以上操作是为了拉取这两个项目。

在项目根目录执行以下命令可查看这两个项目当前使用的版本

`git submodule` 

**注意:** 子项目不会自动同步更新到最新版本，若要同步到最新版，需手动更新，在根目录执行

`git submodule update --remote`

子项目同步到最新版后，需测试依赖子项目的 [easypush](./easypush/)、[android](./android/)、[ios](./ios/) 是否可正常运行，并更新提交到 npm

### 编译

生成 easypush .node 文件

`cd easypush`  ->  `yarn build`  ->  `yarn test`

生成 android .so 文件

`yarn buildso`

### 发布

在发布前，先进行 [测试](./examples/ArchivesDev/)，测试通过后发布到 NPM

`npm publish`

`cd easypush && npm publish`
