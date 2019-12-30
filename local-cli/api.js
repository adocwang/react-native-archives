const ora = require('ora');
const path = require('path');
const fs = require('fs-extra');
const request = require('request');
const {
  CInfo, supportPlatforms, getCacheDir, 
  fileExist, errMsg, download, makePatch, md5file
} = require('./utils');
const FileCookieStore = require('tough-cookie-filestore');

function setConfig(cwd, config){
  const file = path.join(cwd, 'easypush.json');
  const now = fs.readJsonSync(file, { throws: false })||{};
  config = {...now, ...config};
  fs.writeJsonSync(file, config, {spaces:2});
  return file;
}

function getConfig(cwd){
  return fs.readJsonSync(
    path.join(cwd, 'easypush.json'), 
    { throws: false }
  )||{};
}

function getCurrentAppId(cwd, platform, appId){
  if (supportPlatforms.indexOf(platform) == -1) {
    return {code:-1, message:'platform not support'}
  }
  if (appId) {
    return {code:0, message:appId}
  }
  const config = getConfig(cwd);
  if (!(platform in config)) {
    return {code:-3, message: "Unbound app, please run `easypush app bind` first"}
  }
  return {code:0, message:config[platform]}
}


/** API 请求说明
  1. 登陆将以 cookie 做为验证, 所以服务端可以 send/remove/check cookie 来鉴权
  2. 搜索 POST: 可查看所有需要实现的 api
  3. 其实 whoami 可以使用 GET 方式, 为避免以后会扩展, 统一使用 POST 
  4. app/upload, patch/upload 使用的 FromData 方式, 其他都是 post json payload 方式   
*/
async function sendRequest(cwd, uri, body, form) {
  const {baseUrl} = getConfig(cwd);
  if (!baseUrl) {
    return {code:-2, message: "BaseUrl is not set, please run `easypush init` first"}
  }
  const jarFile = path.join(getCacheDir(), '.passport');
  fs.ensureFileSync(jarFile);
  const jar = request.jar(new FileCookieStore(jarFile));
  const options = {
    baseUrl,
    uri,
    jar,
  };
  if (body) {
    options.method = 'POST';
    if (form) {
      options.formData = body;
    } else {
      options.json = true;
      options.body = body;
    }
  } else {
    form = false;
    options.json = true;
    options.method = 'GET';
  }
  return new Promise((resolve, reject) => {
    request.post(options, function (err, res, content) {
      if (err) {
        return resolve({code:-1, message: errMsg(err)});
      } else if (res.statusCode !== 200) {
        return resolve({code:-2, message: 'Http Error:' + res.statusCode});
      }
      if (form) {
        try {
          content = JSON.parse(content)
        } catch(e) {
          // do nothing
        }
      }
      resolve(content);
    })
  }).catch(err => {
    return {code:-1, message: errMsg(err)}
  })
}


const api = {};

api.getConfig = getConfig;
api.setConfig = setConfig;
api.checkInit = function(cwd, hasKey) {
  const {baseUrl, key} = getConfig(cwd);
  return baseUrl && (!hasKey || key);
}

// 设置 baseUrl
api.init = function(cwd, baseUrl) {
  return {code:0, message:'saved to:' + setConfig(cwd, {baseUrl})}
}

/** 登陆账号, 服务端以 cookie 作为验证
POST: /login  {user, pwd}
RES: {code:int, message:string}
*/
api.login = async function(cwd, user, pwd) {
  const res = await sendRequest(cwd, '/login', {user, pwd});
  if (res.code === 0 && !('message' in res)){
    res.message = 'Logged in as ' + user;
  }
  return res;
}

/** 查询当前登陆账号
POST: /whoami  {}
RES: {code:int, message:string}
*/
api.whoami = async function(cwd) {
  return await sendRequest(cwd, '/whoami', {}); 
}

/** 列出所有 app
POST: /app/list {platform}
RES: {code:int, message:string, data:[
      {
        id:string, 
        name:string, 
        version:string, 
        android:string, 
        android_md5:string, 
        ios:string, 
        ios_md5:string,
        create_at:string,
      }
      ...
    ]}
备注: 返回 data 中的 android/ios 字段返回 app 下载地址, 可以为空
     android_md5/ios_md5 为包文件的 md5 hash 值
     最终这里会校验, 额外在 data 中多返回 (bool) android_current/ios_current 
*/
api.listApp = async function(cwd, platform) {
  platform = platform||null;
  const list = await sendRequest(cwd, '/app/list', {platform})
  if (typeof list.code !== 'number' || list.code !== 0 || !Array.isArray(list.data) || !list.data.length) {
    return list;
  }
  const {android, ios} = getConfig(cwd);
  list.data = list.data.map(item => {
    item.ios_current = Boolean(ios && ios == item.id);
    item.android_current = Boolean(android && android == item.id);
    return item;
  });
  return list;
}

/** 查询指定 app 信息
POST: /app/get {id}
RES: {code:int, message:string, data:{...结构与 listApp 返回 data.item 同..}}
*/
api.getApp = async function(cwd, appId) {
  return await sendRequest(cwd, '/app/get', {id:appId});
}

/** 新增 app
POST: /app/add {name, version}
RES: {code:int, message:string}
*/
api.addApp = async function(cwd, name, version) {
  return await sendRequest(cwd, '/app/add', {name, version});
}

/** 上传安装包 到指定app (不指定则自动获取当前绑定)
POST: /app/upload formData:{id, platform:string, package:File}
RES: {code:int, message:string}
*/
api.uploadApp = async function(cwd, platform, package, appId) {
  const {code, message} = getCurrentAppId(cwd, platform, appId);
  if (code !== 0) {
    return {code, message};
  }
  appId = message;
  if (!fileExist(package)) {
    return {code:-2, message:'package not exist'}
  }
  return await sendRequest(cwd, '/app/upload', {id:appId, platform, package:fs.createReadStream(package)}, true);
}

/** 绑定 app*/
api.bindApp = async function(cwd, platform, appId) {
  if (supportPlatforms.indexOf(platform) == -1) {
    return {code:-1, message:'platform not support'}
  }
  const config = {};
  config[platform] = appId;
  return {code:0, message:'saved to:' + setConfig(cwd, config)}
}




/** 列出指定 app 的所有 patch(不指定appId,则为当前绑定)
POST: /patch/list {id, platform}
RES: {code:int, message:string, data:[
      {
        id:string,
        version:string, 
        desc:string, 
        bundle:string,
        bundle_md5:string,
        create_at:string,
        active:bool
      }
      ...
    ]}
备注: 返回 data 中的 bundle 字段返回该热更版本的完整包下载地址
     patch_md5 为包文件的 md5 hash 值
*/
api.listPatch = async function(cwd, platform, appId) {
  const {code, message} = getCurrentAppId(cwd, platform, appId);
  if (code !== 0) {
    return {code, message};
  }
  appId = message;
  return await sendRequest(cwd, '/patch/list', {id:appId, platform});
}

/** 查询指定 app 的最后一个补丁包信息(不指定appId,则为当前绑定)
POST: /patch/last {id, platform}
RES: {code:int, message:string, data:{...结构与 listPatch 返回 data.item 同..}}
*/
api.lastPatch = async function(cwd, platform, appId) {
  const {code, message} = getCurrentAppId(cwd, platform, appId);
  if (code !== 0) {
    return {code, message};
  }
  appId = message;
  return await sendRequest(cwd, '/patch/get', {id:appId, platform});
}

/** 上传新的更新补丁包
POST: /patch/upload formData:{app:string, platform:string, version:string, bundle:File, patch:File, origin:string||null, diff:File||null}
RES: {code:int, message:string}
备注: post 发送三个文件
     1. bundle 为完整包
     2. patch 为相对于安装包的补丁
     3. diff 为相对于 origin bundle 的补丁
     4. origin 是 diff 相对应的 bundel id
*/
api.uploadPatch = async function(cwd, appId, platform, version, bundle, patch, origin, diff) {
  if (!fileExist(bundle)) {
    return {code:-2, message:'bundle file not exist'}
  }
  if (!fileExist(patch)) {
    return {code:-2, message:'patch file not exist'}
  }
  if (diff && !origin) {
    return {code:-2, message:'origin id not defined'}
  } else if (origin) {
    if (!diff) {
      return {code:-2, message:'diff file not defined'}
    } else if (!fileExist(diff)) {
      return {code:-2, message:'diff file not exist'}
    }
  }
  const payload = {
    app:appId,
    platform,
    version,
    bundle: fs.createReadStream(bundle),
    patch: fs.createReadStream(patch)
  };
  if (origin) {
    payload.origin = origin;
    payload.diff = fs.createReadStream(diff);
  }
  return await sendRequest(cwd, '/patch/upload', payload, true);
}

/** 绑定 bundle, 即设定当前为指定的 热更版本
POST: /patch/bind {app, platform, id}
RES: {code:int, message:string}
*/
api.bindPatch = async function(cwd, platform, id, appId) {
  const {code, message} = getCurrentAppId(cwd, platform, appId);
  if (code !== 0) {
    return {code, message};
  }
  appId = message;
  return await sendRequest(cwd, '/patch/bind', {app:appId, platform, id});
}




// 获取指定 app 的 安装包文件
api.getPackageFile = async function(cwd, platform, appId) {
  let code, message, data, file;
  ({code, message} = getCurrentAppId(cwd, platform, appId));
  if (code !== 0) {
    return {code, message};
  }
  appId = message;
  ({code, message, data} = await api.getApp(cwd, appId));
  if (code !== 0) {
    return {code, message};
  }
  ({code, message, file} = data && data[platform] && data[platform+'_md5'] 
          ? (await download(data[platform], data[platform+'_md5']))
          : {code:1, message:'app does not have package'});       
  if (code !== 0) {
    return {code:-4, message}
  }
  return {code:0, file, data};
}

// 获取指定 app 最新的 bundle 补丁包
api.getBundleFile = async function(cwd, platform, appId) {
  let code, message, data, file;
  ({code, message, data} = await api.lastPatch(cwd, platform, appId));
  if (code !== 0) {
    return {code, message}
  }
  if (!data || !data.bundle || !data.bundle_md5) {
    return {code:0, file:null};
  }
  ({code, message, file} = await download(data.bundle, data.bundle_md5))
  if (code !== 0) {
    return {code:-4, message}
  }
  return {code:0, file, data};
}

// 由指定 bundle 自动生成 patch / diff
api.makeAndUploadPatch = async function(cwd, platform, bundle, version, stdout, stderr, appId) {
  if (!bundle) {
    bundle = await require('./bundle')(cwd, {
      platform,
      output: getCacheDir(),
      'save-name': 'temp_bundle'
    }, stdout, stderr, true);
    if (!bundle) {
      return {code:-2, message:'make bundle failed'}
    }
  }
  if (!fileExist(bundle)) {
    return {code:-2, message:'bundle not exist'}
  }

  // 下载 package 安装包
  let code, message, file, data;
  ({code, message, file, data} = await api.getPackageFile(cwd, platform, appId))
  if (code !== 0) {
    return {code, message}
  }
  const pack = file;
  const {id:realAppId} = data;

  // 下载 last bundle 补丁包
  ({code, message, file, data} = await api.getBundleFile(cwd, platform, appId))
  if (code !== 0) {
    return {code, message}
  }

  const dir = getCacheDir();
  const maker = require('./diff');

  // 生成 patch
  stdout.write(CInfo + "Make bundle patch\n");
  const patch = await maker.diffPackage(cwd, {
    origin:pack,
    next: bundle,
    output: path.join(dir, 'temp_patch'),
  }, stdout, stderr, platform === 'ios', true);
  if (!patch || !fileExist(patch)) {
    return {code:-2, message:'make patch failed'}
  }

  // 生成 diff
  let origin, diff;
  if (file) {
    ({id:origin} = data);
    stdout.write(CInfo + "Make bundle diff\n");
    diff = await maker.diffPPK(cwd, {
      origin:file,
      next: bundle,
      output: path.join(dir, 'temp_diff'),
    }, stdout, stderr, true);
    if (!diff || !fileExist(diff)) {
      return {code:-2, message:'make diff failed'}
    }
  }

  // 提交
  const spinner = ora({
    text:'uploading...',
    stream: stdout
  }).start();
  const rs = await api.uploadPatch(cwd, realAppId, platform, version, bundle, patch, origin, diff);
  spinner.stop();
  return rs;
}


module.exports = api;