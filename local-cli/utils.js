const os = require('os');
const yazl = require('yazl');
const path = require('path');
const fs = require('fs-extra');
const crypto = require('crypto');
const wcwidth = require('wcwidth');
const request = require('request');
const {spawn} = require('child_process');

const supportPlatforms = ['android', 'ios'];

function getCacheDir() {
  const dir = path.join(os.homedir(), '.easypush');
  fs.ensureDirSync(dir);
  return dir;
}
function fileExist(path, dir){
  try {
    const f = fs.lstatSync(path)
    return dir ? f.isDirectory() : f.isFile()
  } catch(e) {
    return false;
  }
}
function dirExist(path){
  return fileExist(path, true)
}
function md5file(filename) {
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
      hash.update(buffer.slice(0, bytesRead))
    } while (bytesRead === BUFFER_SIZE)
  } finally {
    fs.closeSync(fd)
  }
  return hash.digest('hex')
}



function errMsg(e){
  if (typeof e === 'object' && 'message' in e) {
    return e.message
  }
  return e;
}
function color(str, code, bold){
  return (bold ? '\033[1m' : '') + "\x1b["+code+"m"+str+"\x1b[0m";
}
function rmColor(str) {
  return typeof str === 'string' ? str.replace(/[\u001b\u009b][[()#;?]*(?:[0-9]{1,4}(?:;[0-9]{0,4})*)?[0-9A-ORZcf-nqry=><]/g, '') : str;
}
const CInfo = color('info', 36, true) + ' ';
const CWarning = color('Warning', 35, true) + ' ';
const CError = color('Error', 31, true) + ' ';

function runCommand(command, args, options){
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

function getRNVersion(projectDir) {
  const version = JSON.parse(fs.readFileSync(path.resolve(projectDir||'', 'node_modules/react-native/package.json'))).version;
  const match = /^(\d+)\.(\d+)\./.exec(version);
  return {
    version,
    major: match[1] | 0,
    minor: match[2] | 0
  };
}

let _bsdiff = false;
function getBSDiff(quiet) {
  if (_bsdiff === false) {
    try {
      _bsdiff = require('easypush').bsdiff;
    } catch (e) {
      _bsdiff = null;
    }
  }
  if (!quiet && !_bsdiff) {
    throw new Error('This function needs module "easypush". Please install it first.');
  }
  return _bsdiff;
}

function addRecursive(zip, root, rel) {
  rel = rel||'';
  if (rel) {
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
      addRecursive(zip, fullPath, rel + name + '/');
    }
  }
}
function pack(dir, save) {
  return new Promise(function (resolve, reject) {
    const zip = new yazl.ZipFile();
    addRecursive(zip, dir);
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

// 在 cwd 目录查找有共同前缀 prefix 的文件(夹)
function getCommonPath(cwd, prefix) {
  const len = prefix.length;
  const dash = prefix.lastIndexOf('/');
  const curDir = dash !== -1 ? prefix.substring(0, dash + 1) : '';
  const curPad = prefix.substr(dash + 1)
  let completions
  try {
    completions = fs.readdirSync(path.join(cwd, curDir), {withFileTypes:true}).map(r => 
      r.name + (r.isDirectory() ? '/' : '')
    );
  } catch(e) {
    completions = [];
  }
  if (!curPad) {
    return [completions, prefix]
  }
  let hits = [];
  completions.forEach(r => {
    if (r.startsWith(curPad)) {
      hits.push(r);
    }
  });
  if (hits.length > 1) {
    const prefix = getCommonPrefix(hits);
    if (prefix !== curPad) {
      hits = [prefix];
    }
  }
  if (curDir !== '' && hits.length === 1) {
    hits[0] = curDir + hits[0]
  }
  return [hits, prefix];
}

// 转 array 为 string 表格, 自动对齐
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

// 下载 url 指定的文件, 可指定 md5 进行校验
async function download(url, md5) {
  return new Promise(resolve => {
    if (!url) {
      resolve({code:1, message:'download url unavailable'})
      return;
    }
    let localFile, curMd5;
    if (md5) {
      localFile = path.join(getCacheDir(), md5);
      curMd5 = md5file(localFile);
      if (curMd5 && curMd5 === md5) {
        resolve({code:0, file:localFile})
        return;
      }
    }
    const tmpFile = localFile 
      ? localFile + "_tmp" 
      : path.join(getCacheDir(), crypto.randomBytes(8).toString("hex"));
    const stream = fs.createWriteStream(tmpFile);
    request({
      uri:url,
      headers: {
          'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,image/apng,*/*;q=0.8',
          'Accept-Encoding': 'gzip, deflate, br',
          'Accept-Language': 'en-US,en;q=0.9,fr;q=0.8,ro;q=0.7,ru;q=0.6,la;q=0.5,pt;q=0.4,de;q=0.3',
          'Cache-Control': 'max-age=0',
          'Connection': 'keep-alive',
          'Upgrade-Insecure-Requests': '1',
          'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_12_6) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/68.0.3440.106 Safari/537.36'
      },
      gzip: true
    }).pipe(stream).on('finish', () => {
      const checkMd5 = md5file(tmpFile);
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
    }).on('error', (error) => {
      resolve({code:1, message: errMsg(error)})
    })
  })
}

// 通过 package/bundle 生成相对于安装包的 补丁包
// 若指定了 origin, 会生成 bundle 相对于 origin bundle 的补丁包
async function makePatch(package, bundle, origin) {


}



module.exports = {
  supportPlatforms,
  getCacheDir,
  fileExist,
  dirExist,
  md5file,

  errMsg,
  wcwidth,
  color,
  rmColor,
  CInfo,
  CWarning,
  CError,

  runCommand,
  getRNVersion,
  getBSDiff,
  pack,

  getCommonPrefix,
  getCommonPath,
  makeTable,
  download,
  makePatch
};