const os = require('os');
const yazl = require('yazl');
const path = require('path');
const fs = require('fs-extra');
const crypto = require('crypto');
const wcwidth = require('wcwidth');
const tough = require("tough-cookie");
const minimist = require('minimist');
const FormData = require('form-data');
const nodeFetch = require("node-fetch");
const {spawn} = require('child_process');
const {open:openZipFile} = require('yauzl');

const runtimeCache = {};
const supportPlatforms = ['android', 'ios'];
const MakeDiff = (() => {
  try {
    if (fileExist(path.join(__dirname, './../easypush/src/index.js'))) {
      return require('./../easypush/src/index').diff;
    }
    return require('easypush').diff;
  } catch (e) {
    return e;
  }
})();

// 解析 process 参数
function parseProcess(p){
  const _ = p.env._||null;
  const npx = _ && _.endsWith('/npx');
  const options = minimist(p.argv.slice(2));
  const args = options._;
  const name = args.shift();
  delete options._;
  return {npx, name, args, options};
}

// 消息相关
const CInfo = color('Info:', 36, true) + ' ';
const CWarning = color('Warning:', 35, true) + ' ';
const CError = color('Error:', 31, true) + ' ';

function color(str, code, bold){
  return (bold ? '\033[1m' : '')
         + (code ? "\x1b["+code+"m" : '')
         + str
         + (code ? "\x1b" : '')
         + (bold ? "\033" : '')
         + "[0m";
}

function rmColor(str) {
  return typeof str === 'string' ? str.replace(
    /[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g,
    ''
  ) : str;
}

function errMsg(e){
  if (typeof e === 'object' && 'message' in e) {
    return e.message
  }
  return e;
}

// 转 Array 为 String 表格, 自动对齐
function makeTable(data) {
  const rows = [];
  const rowWidth = [];
  data.forEach(item => {
    if (!Array.isArray(item)) {
      rows.push(null)
      return;
    }
    const row = [];
    item.forEach((str, index) => {
      const width = wcwidth(String(rmColor(str)));
      row.push(width);
      if (!rowWidth[index] || rowWidth[index] < width) {
        rowWidth[index] = width;
      }
    })
    rows.push(row)
  })
  const txts = [];
  const split = '-'.repeat(rowWidth.reduce((a, b) => a + b) + rowWidth.length * 2);
  data.forEach((item, n) => {
    if (!Array.isArray(item)) {
      txts.push(split)
      return;
    }
    let line = '';
    const widths = rows[n];
    item.forEach((str, index) => {
      line += String(str) + ' '.repeat(rowWidth[index] - widths[index] + 2)
    });
    txts.push(line);
  })
  return txts.join("\n")
}

// 文件操作
function getCacheDir() {
  const dir = path.join(os.homedir(), '.easypush');
  fs.ensureDirSync(dir);
  return dir;
}

function dirExist(path){
  return fileExist(path, true)
}

function fileExist(path, dir){
  try {
    const f = fs.lstatSync(path)
    return dir ? f.isDirectory() : f.isFile()
  } catch(e) {
    return false;
  }
}

function fileMd5(filename) {
  let fd;
  try {
    fd = fs.openSync(filename, 'r')
  } catch (e) {
    return false;
  }
  const BUFFER_SIZE = 8192;
  const hash = crypto.createHash('md5')
  const buffer = Buffer.alloc(BUFFER_SIZE)
  try {
    let bytesRead
    do {
      bytesRead = fs.readSync(fd, buffer, 0, BUFFER_SIZE)
      hash.update(buffer.subarray(0, bytesRead))
    } while (bytesRead === BUFFER_SIZE)
  } finally {
    fs.closeSync(fd)
  }
  return hash.digest('hex')
}

// 获取 oldBuf, newBuf 的 diff buffer
function getDiff(oldBuf, newBuf) {
  if (typeof MakeDiff !== 'function') {
    const message = 'Load "easypush" module failed.';
    if (MakeDiff instanceof Error) {
      MakeDiff.message = message + "\n" + MakeDiff.message;
      throw MakeDiff;
    }
    throw new Error(message);
  }
  return MakeDiff(oldBuf, newBuf);
}

// 打包 xcode 编译的 .app 为 .ipa 文件
function packIpa(source, dest){
  return packDirToZip(source, dest, true);
}

// 打包 dir 为 zip 文件, 保存到 save 路径
function packZip(dir, save) {
  return packDirToZip(dir, save);
}
function packDirToZip(dir, save, ipa){
  return new Promise(function (resolve, reject) {
    const zip = new yazl.ZipFile();
    let rel = '';
    if (ipa) {
      const appName = path.basename(dir);
      rel = 'Payload/' + appName;
    }
    addRecursive(zip, dir, rel);
    zip.end();
    zip.on('error', function (err) {
      fs.removeSync(save)
      reject(err);
    });
    zip.outputStream.pipe(fs.createWriteStream(save)).on('close', function () {
      resolve();
    });
  });
}
function addRecursive(zip, root, rel) {
  if (rel) {
    rel += '/';
    zip.addEmptyDirectory(rel);
  }
  const childs = fs.readdirSync(root);
  for (const name of childs) {
    if (name === '.' || name === '..') {
      continue;
    }
    const fullPath = path.join(root, name);
    const stat = fs.statSync(fullPath);
    if (stat.isFile()) {
      zip.addFile(fullPath, rel + name);
    } else if (stat.isDirectory()) {
      addRecursive(zip, fullPath, rel + name);
    }
  }
}

// 枚举 Zip 内所有文件, callback(entry, zipfile), 若不指定 basic 为 true
// 文件属性 entry 会新增 isDirectory/hash 两个字段, 原 entry 内有一个 crc32 的 hash 值
// 但考虑到 crc32 的碰撞概率略大, 所以此处额外计算一个新的 hash 值用于校验
function enumZipEntries(zipFn, callback, basic) {
  return new Promise((resolve, reject) => {
    openZipFile(zipFn, {lazyEntries: true}, (err, zipfile) => {
      if (err) {
        reject(err);
        return;
      }
      zipfile.on('end', resolve);
      zipfile.on('error', reject);
      zipfile.on('entry', entry => {
        getZipEntryHash(zipfile, entry, basic).then(entryPlus => {
          return Promise.resolve(callback(entryPlus, zipfile))
        }).then(() => zipfile.readEntry())
      });
      zipfile.readEntry();
    });
  });
}
function getZipEntryHash(zipfile, entry, basic) {
  return new Promise((resolve, reject) => {
    if (basic) {
      resolve(entry);
      return;
    }
    entry.isDirectory = /\/$/.test(entry.fileName);
    if (entry.isDirectory) {
      entry.hash = null;
      resolve(entry);
      return;
    }
    zipfile.openReadStream(entry, function(err, readStream) {
      if (err) {
        reject(err);
        return;
      }
      const hash = crypto.createHash('md5').setEncoding('hex');
      readStream.on("end", function() {
        hash.end();
        entry.hash = hash.read();
        resolve(entry);
      });
      readStream.pipe(hash);
    });
  })
}

// 获取 enumZipEntries 枚举的单个文件 buffer 
function readZipEntireBuffer(entry, zipfile) {
  const buffers = [];
  return new Promise((resolve, reject) => {
    zipfile.openReadStream(entry, (err, stream) => {
      if (err) {
        reject(err);
        return;
      }
      stream.pipe({
        write(chunk) {
          buffers.push(chunk);
        },
        end() {
          resolve(Buffer.concat(buffers));
        },
        prependListener() {},
        on() {},
        once() {},
        emit() {},
      });
    });
  });
}

// 保存 ZipFile 对象为文件
function saveZipFile(zipfile, output) {
  fs.ensureDirSync(path.dirname(output));
  return new Promise(function (resolve, reject) {
    zipfile.on('error', err => {
      fs.removeSync(output)
      reject(err);
    });
    zipfile.outputStream.pipe(fs.createWriteStream(output)).on('close', function() {
      resolve();
    });
  })
}

// 获取字符串共同前缀
// https://www.geeksforgeeks.org/longest-common-prefix-using-binary-search/
function getCommonPrefix(arr) {
  let low = 0, high = 0;
  arr.forEach(s => {
    if (!high || s.length < high) {
      high = s.length 
    }
  });
  let prefix = '';
  const first = arr[0];
  while (low <= high) {
    const mid = Math.floor(low + (high - low) / 2);
    const interrupt = arr.some(r => {
      for (let i = low; i <= mid; i++) {
        if (r[i] !== first[i]) {
          return true;
        }
      }
    });
    if (interrupt) {
      high = mid - 1;
    } else {
      prefix += first.substr(low, mid-low+1);
      low = mid + 1; 
    }
  }
  return prefix;
}

// 在 rootDir 目录查找有共同前缀 prefix 的文件(夹)
function getCommonPath(rootDir, prefix) {
  const dash = prefix.lastIndexOf('/');
  const curPad = prefix.substr(dash + 1);
  const curDir = dash !== -1 ? prefix.substring(0, dash + 1) : '';
  let completions;
  try {
    completions = fs.readdirSync(
      path.join(rootDir, curDir),
      {withFileTypes:true}
    ).map(r => 
      (curPad ? '' : prefix) + r.name + (r.isDirectory() ? '/' : '')
    );
  } catch(e) {
    completions = [];
  }
  // 若 prefix 为全路径, 如 /foo/, 直接返回该目录下所有列表即可
  if (!curPad) {
    return [completions, prefix]
  }
  // 若 prefix 为 /foo/ba, 获取 /foo/ 目录下 ba 开头的文件列表
  let hits = [];
  completions.forEach(r => {
    if (r.startsWith(curPad)) {
      hits.push(r);
    }
  });
  // 获取 ba 开头文件的共同前缀, 如 hits 为 [bara, barb], 得到 bar
  if (hits.length > 1) {
    const prefix = getCommonPrefix(hits);
    if (prefix !== curPad) {
      hits = [prefix];
    }
  }
  // 给列表文件重新加上 /foo/ 前缀
  if (curDir != '') {
    hits = hits.map(v => curDir + v);
  }
  return [hits, prefix];
}

// 获取 RN 版本
function getRNVersion(projectDir) {
  if (!runtimeCache.rnVersion) {
    const version = JSON.parse(fs.readFileSync(path.resolve(projectDir||'', 'node_modules/react-native/package.json'))).version;
    const match = /^(\d+)\.(\d+)(\.(\d+))?/.exec(version);
    runtimeCache.rnVersion = {
      version,
      major: match[1] | 0,
      minor: match[2] | 0,
      patch: match[4] | 0
    };
  }
  return runtimeCache.rnVersion;
}

// 获取 EasyPush 版本
function getEasyVersion() {
  if (!runtimeCache.eyVersion) {
    runtimeCache.eyVersion = JSON.parse(fs.readFileSync(
      path.resolve(__dirname, './../package.json')
    )).version;
  }
  return runtimeCache.eyVersion;
}

// 设置 easypush 配置信息
function setConfig(projectDir, config){
  const file = path.join(projectDir, 'easypush.json');
  const now = fs.readJsonSync(file, { throws: false })||{};
  config = {...now, ...config};
  fs.writeJsonSync(file, config, {spaces:2});
  return file;
}

// 获取 easypush 配置信息
function getConfig(projectDir){
  return fs.readJsonSync(
    path.join(projectDir, 'easypush.json'), 
    { throws: false }
  )||{};
}

// 获取项目的 App id
function getAppId(projectDir, platform, fallbackId){
  if (supportPlatforms.indexOf(platform) == -1) {
    return {code:-1, message:'platform not support'}
  }
  if (fallbackId) {
    return {code:0, message:fallbackId}
  }
  const config = getConfig(projectDir);
  if (!(platform in config)) {
    return {code:-3, message: "Unbound app, please run `easypush app bind` first"}
  }
  return {code:0, message:config[platform]}
}

// 发送 API 请求: 以 cookie 做为凭证, 服务端可以此来鉴权, 返回 json
async function requestAPI(projectDir, uri, payload, asForm) {
  let {baseUrl} = getConfig(projectDir);
  if (uri && !/^[a-zA-Z]+:\/\//.test(uri)) {
    if (!baseUrl) {
      uri = null;
    } else {
      // trim baseUrl right /
      while(baseUrl.charAt(baseUrl.length-1) === '/') {
        baseUrl = baseUrl.substring(0, baseUrl.length-1);
      }
      // trim uri left /
      while(uri.charAt(0) === '/') {
        uri = uri.substring(1);
      }
      uri = baseUrl + '/' + uri;
    }
  }
  if (!uri || !/^https?:\/\//i.test(uri)) {
    return {
      code:-2,
      message: "request url incorrect"
    }
  }
  const options = {
    headers:{
      'User-Agent': "easypush-client/" + getEasyVersion(),
    }
  };
  if (payload) {
    options.method = 'POST';
    if (asForm) {
      const form = new FormData();
      for (let key in payload) {
        form.append(key, payload[key]);
      }
      options.body = form;
    } else {
      options.body = JSON.stringify(payload);
    }
  } else {
    options.method = 'GET';
  }
  // 在进程结束时保存 cookie 为文件
  if (!runtimeCache.jar) {
    runtimeCache.store = new tough.MemoryCookieStore();
    runtimeCache.jarFile = path.join(getCacheDir(), '.cookiejar');
    try {
      if (!fileExist(runtimeCache.jarFile)) {
        throw '';
      }
      runtimeCache.jar = tough.CookieJar.deserializeSync(
        fs.readFileSync(runtimeCache.jarFile).toString(),
        runtimeCache.store
      );
    }catch(e){
      runtimeCache.jar = new tough.CookieJar(runtimeCache.store);
    }
    process.on('exit', () => {
      if (!runtimeCache.changed) {
        return;
      }
      // 仅保存持久化的, 未设置过期时间的仅在当前进程有效
      const cookieLists = [];
      const Store = runtimeCache.store;
      Store.getAllCookies((err, cookies) => {
        if (err) {
          throw err;
        }
        cookies.forEach(cookie => {
          if (cookie.isPersistent()) {
            cookie = cookie instanceof tough.Cookie ? cookie.toJSON() : cookie;
            delete cookie.creationIndex;
            cookieLists.push(cookie)
          }
        });
      });
      const serialized = {
        rejectPublicSuffixes: !!runtimeCache.jar.rejectPublicSuffixes,
        enableLooseMode: !!runtimeCache.jar.enableLooseMode,
        allowSpecialUseDomain: !!runtimeCache.jar.allowSpecialUseDomain,
        prefixSecurity: runtimeCache.jar.prefixSecurity,
        cookies: cookieLists
      };
      fs.writeFileSync(runtimeCache.jarFile, JSON.stringify(serialized));
    });
  }
  // 设置请求 cookie
  const Jar = runtimeCache.jar;
  const cookies = await Jar.getCookieString(uri);
  if (cookies) {
    options.headers['cookie'] = cookies;
  }
  const res = await nodeFetch(uri, options);
  const resCookies = res.headers.raw()['set-cookie'];
  if (resCookies) {
    if (!runtimeCache.changed) {
      runtimeCache.changed = true;
    }
    (Array.isArray(resCookies) ? resCookies : [resCookies]).forEach(cookie => {
      Jar.setCookieSync(cookie, uri)
    });
  }
  return res;
}

/**
 * 下载 url 指定的文件, 可指定 md5 进行校验
 * download(url, md5).then(rs => {
 *   rs: {code:Int, message:String, file:String}
 * })
 */
async function download(url, md5) {
  return new Promise(resolve => {
    if (!url) {
      resolve({code:1, message:'download url unavailable'})
      return;
    }
    let localFile;
    if (md5) {
      localFile = path.join(getCacheDir(), md5);
    }
    const tmpFile = localFile 
      ? localFile + "_tmp" 
      : path.join(getCacheDir(), crypto.randomBytes(8).toString("hex"));
    const stream = fs.createWriteStream(tmpFile);
    nodeFetch(url, {
      headers: {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
        'Accept-Encoding': 'gzip, deflate, br',
        'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8,ro;q=0.7,ru;q=0.6,la;q=0.5,pt;q=0.4,de;q=0.3',
        'Cache-Control': 'max-age=0',
        'Connection': 'keep-alive',
        'Upgrade-Insecure-Requests': '1',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.106 Safari/537.36'
      }
    }).then(res => {
      res.body.pipe(stream);
      res.body.on("error", (error) => {
        resolve({code:1, message: errMsg(error)})
      });
      stream.on("finish", () => {
        const checkMd5 = fileMd5(tmpFile);
        if (md5 && checkMd5 !== md5) {
          fs.removeSync(tmpFile);
          resolve({code:1, message:'check download file md5 failed'})
          return;
        }
        if (!localFile) {
          localFile = path.join(getCacheDir(), checkMd5);
        }
        fs.moveSync(tmpFile, localFile, {overwrite:true})
        resolve({code:0, file:localFile})
      });
    }).catch(error => {
      resolve({code:1, message: errMsg(error)})
    })
  })
}

// 执行命令
function execCommand(command, args, options){
  return new Promise(function (resolve, reject) {
    const child = spawn(command, args, options);
    child.on('close', function (code) {
      if (code) {
        reject(`"react-native bundle" command exited with code ${code}.`);
      } else {
        resolve();
      }
    })
  })
}

module.exports = {
  supportPlatforms,
  parseProcess,
  CInfo,
  CWarning,
  CError,
  color,
  rmColor,
  errMsg,
  wcwidth,
  makeTable,

  getCacheDir,
  dirExist,
  fileExist,
  fileMd5,
  getDiff,
  packIpa,
  packZip,
  enumZipEntries,
  readZipEntireBuffer,
  saveZipFile,
  getCommonPrefix,
  getCommonPath,

  getRNVersion,
  getEasyVersion,
  setConfig,
  getConfig,
  getAppId,
  download,
  requestAPI,
  execCommand,
};