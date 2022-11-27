const fs = require('fs-extra');
const {fileExist, getConfig, getAppId, requestAPI} = require('./utils');

class CommandAPI {
  constructor(cwd){
    this.cwd = cwd;
  }

  /**
   * 所有 API 接口皆通过此方法发出请求，返回结果格式必须为
   * {code:int, message:string}
   * code==0: 服务端处理成功, 有些接口还需要其他数据
   * code!=0: 服务端处理异常, message 为异常信息
   */
  async request(uri, payload, asForm){
    const res = await requestAPI(this.cwd, uri, payload, asForm);
    return await res.json();
  }


  /**
   * API : 登陆账号, 服务端应在 response header 中返回 set-cookie
   *       后续其他请求都会附带该 cookie, 服务端可以此来鉴权
   * POST: /login  {user:string, pwd:string}
   * RES : {code:int, message:string}
   */
  async login(user, pwd){
    const res = await this.request('/login', {user, pwd});
    if (res.code === 0 && !('message' in res)){
      res.message = 'Logged in as ' + user;
    }
    return res;
  }


  /**
   * API : 查询当前登陆账号
   * POST: /whoami  {}
   * RES : {code:int, message:string}
   */
  async whoami(){
    return this.request('/whoami', {}); 
  }


  /**
   * API : 列出所有 App 信息, 参数 platform 可能为空, 此时应返回所有平台的 App
   * POST: /app/list {platform:string|''}
   * RES : {code:int, message:string, data:Array<DataItem>}
   * DataItem: {
   *   id:number|string,
   *   name:string,
   *   version:string,
   *   android:string,      // apk url, 若不是 android app, 为空或null即可
   *   android_md5:string,  // 若是 android app, 返回 apk 文件的 md5 值
   *   ios:string,          // ipa url, 若不是 ios app, 为空或null即可
   *   ios_md5:string,      // 若是 ios app, 返回 iap 文件的 md5 值
   *   create_at:string,
   * }
   */
  async listApp(platform){
    platform = platform||null;
    //const list = await this.request('/app/list', {platform})
    const list = {
      code:0,
      message:'a',
      data:[
        {
          id:'333',
          name:'测试版',
          version:'1.0',
          android:'a',
          android_md5:'ddddd',
          ios:'cccc',
          ios_md5:'dddd',
          create_at:'2012-12-09 08:30',
        },
        {
          id:'333',
          name:'测试版',
          version:'1.0',
          android:'a',
          android_md5:'ddddd',
          ios:'cccc',
          ios_md5:'dddd',
          create_at:'2012-12-09 08:30',
        },
        {
          id:'333',
          name:'测试版',
          version:'1.0',
          android:'a',
          android_md5:'ddddd',
          ios:'cccc',
          ios_md5:'dddd',
          create_at:'2012-12-09 08:30',
        },
      ]
    }
    if (typeof list.code !== 'number' || list.code !== 0 || !Array.isArray(list.data) || !list.data.length) {
      return list;
    }
    const {android, ios} = getConfig(this.cwd);
    list.data = list.data.map(item => {
      item.ios_current = Boolean(ios && ios == item.id);
      item.android_current = Boolean(android && android == item.id);
      return item;
    });
    return list;
  }


  /**
   * API : 新增 App
   * POST: /app/add {name, version}
   * RES : {code:int, message:string}
   */
  async addApp(name, version){
    return await this.request('/app/add', {name, version});
  }


  /**
   * API : 上传安装包到指定的 app
   * POST: /app/upload FormData:{id, platform:string, package:File}
   * RES : {code:int, message:string}
   */
  async uploadApp(platform, packagePath, appId){
    // 未指定 appId, 尝试自动获取当前项目绑定的 id
    const {code, message} = getAppId(this.cwd, platform, appId);
    if (code !== 0) {
      return {code, message};
    }
    if (!fileExist(packagePath)) {
      return {code:-2, message:'package not exist'}
    }
    return await this.request(
      '/app/upload',
      {id:message, platform, package:fs.createReadStream(packagePath)},
      true
    );
  }


  /**
   * 列出指定 app 的所有热更版本 (
   * POST: /patch/list {id, platform}
   * RES : {code:int, message:string, data:Array<PatchItem>}
   * PatchItem: {
   *   id:string,
   *   version:string,
   *   desc:string,
   *   active:boolean,      // 是否为已启用的热更版本
   *   bundle:string,       // 全量 bundle 包的 url
   *   bundle_md5:string,   // bundle 包文件的 md5 值
   *   create_at:string,
   * }
   * 备注: 返回 data 中的 bundle 字段返回该热更版本的完整包下载地址
   * patch_md5 为包文件的 md5 hash 值
   */
  async listPatch(platform, appId){
    // 未指定 appId, 尝试自动获取当前项目绑定的 id
    const {code, message} = getAppId(this.cwd, platform, appId);
    if (code !== 0) {
      return {code, message};
    }
    return {
      code:0,
      message:'a',
      data:[
        {
          id:'333',
          version:'1.0',
          desc:'测试版',
          bundle:'a',
          bundle_md5:'ddddd',
          create_at:'2012-12-09 08:30',
          active:false
        },
        {
          id:'333',
          version:'1.0',
          desc:'测试版',
          bundle:'a',
          bundle_md5:'ddddd',
          create_at:'2012-12-09 08:30',
          active:true
        },
        {
          id:'333',
          version:'1.0',
          desc:'测试版',
          bundle:'a',
          bundle_md5:'ddddd',
          create_at:'2012-12-09 08:30',
          active:false
        },
        {
          id:'333',
          version:'1.0',
          desc:'测试版',
          bundle:'a',
          bundle_md5:'ddddd',
          create_at:'2012-12-09 08:30',
          active:false
        },
      ]
    }
    return await this.request('/patch/list', {id:message, platform});
  }


  /**
   * API : 上传热更包
   * POST: /patch/upload FormData:{id, platform:string, package:File}
   * RES : {code:int, message:string}
   */
   async uploadApp(platform, packagePath, appId){
    // 未指定 appId, 尝试自动获取当前项目绑定的 id
    const {code, message} = getAppId(this.cwd, platform, appId);
    if (code !== 0) {
      return {code, message};
    }
    if (!fileExist(packagePath)) {
      return {code:-2, message:'package not exist'}
    }
    return await this.request(
      '/app/upload',
      {id:message, platform, package:fs.createReadStream(packagePath)},
      true
    );
  }








  // /**
  //  * 上传新的更新补丁包
  //  * POST: /patch/upload formData:{app:string, platform:string, version:string, bundle:File, patch:File, origin:string||null, diff:File||null}
  //  * RES : {code:int, message:string}
  //  * 备注: post 发送三个文件
  //  *   1. bundle 为完整包
  //  *   2. patch 为相对于安装包的补丁
  //  *   3. diff 为相对于 origin bundle 的补丁
  //  *   4. origin 是 diff 相对应的 bundel id
  //  */
  // async uploadPatch(appId, platform, version, bundle, patch, origin, diff){
  //   if (!fileExist(bundle)) {
  //     return {code:-2, message:'bundle file not exist'}
  //   }
  //   if (!fileExist(patch)) {
  //     return {code:-2, message:'patch file not exist'}
  //   }
  //   if (diff && !origin) {
  //     return {code:-2, message:'origin id not defined'}
  //   } else if (origin) {
  //     if (!diff) {
  //       return {code:-2, message:'diff file not defined'}
  //     } else if (!fileExist(diff)) {
  //       return {code:-2, message:'diff file not exist'}
  //     }
  //   }
  //   const payload = {
  //     app:appId,
  //     platform,
  //     version,
  //     bundle: fs.createReadStream(bundle),
  //     patch: fs.createReadStream(patch)
  //   };
  //   if (origin) {
  //     payload.origin = origin;
  //     payload.diff = fs.createReadStream(diff);
  //   }
  //   return await sendRequest(cwd, '/patch/upload', payload, true);
  // }


  // /**
  //  * 绑定 bundle, 即设定当前为指定的 热更版本
  //  * POST: /patch/bind {app, platform, id}
  //  * RES : {code:int, message:string}
  //  */
  // async bindPatch(platform, id, appId){
  //   const {code, message} = getCurrentAppId(cwd, platform, appId);
  //   if (code !== 0) {
  //     return {code, message};
  //   }
  //   appId = message;
  //   return await sendRequest(cwd, '/patch/bind', {app:appId, platform, id});
  // }
}


module.exports = CommandAPI;