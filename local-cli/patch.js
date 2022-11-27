const path = require('path');
const fs = require('fs-extra');
const {ZipFile} = require('yazl');
const {
  CInfo, CError, errMsg, fileExist, getDiff,
  enumZipEntries, readZipEntireBuffer, saveZipFile
} = require('./utils');

function basename(file) {
  const m = /^(.+\/)[^\/]+\/?$/.exec(file);
  return m && m[1];
}

function transformIosPath(file) {
  const match = /^Payload\/[^/]+\/(.+)$/.exec(file);
  return match && match[1];
}

// 处理命令行输入参数
function resolveOption(cwd, options, commond) {
  let originName = 'origin_file', nextName = 'new_bundle';
  switch(commond) {
    case 'diffapk':
      originName = 'origin_apk';
      break;
    case 'diffipa':
      originName = 'origin_ipa';
      break;
    case 'diffbundle':
      originName = 'origin_bundle';
      break;
    default:
      nextName = 'new_file';
      break;  
  }
  let {origin, next, output, cmd} = options;
  if (!origin || !next) {
    const err = cmd ? `easypush ${commond} <${originName}> <${nextName}> [--output save_name]` : 'Argumets error';
    throw err;
  }
  next = path.resolve(cwd, next);
  origin = path.resolve(cwd, origin);
  if (!fileExist(origin)) {
    throw originName + ' file not exist';
  }
  if (!fileExist(next)) {
    throw nextName + ' file not exist';
  }
  if (!output) {
    if (commond === 'diff') {
      output = 'build/diff/diff-'+Date.now()+'.patch';
    } else {
      output = 'build/output/diff-'+Date.now()+'.'+(commond === 'diff' ? 'diff' : (commond == 'diffipa' ? 'ipa' : 'apk'))+'-patch';
    }
  }
  output = path.resolve(cwd, output);
  return {origin, next, output}
}

/**
  工具函数, 生成两个文件的 diff 补丁包, 文件路径为相对于 cwd 的路径
  cwd: 运行目录
  options: {origin:"原始文件路径", next:"新文件路径", output:"patch生成路径"}
  stdout: 信息输出的 stream
  stderr: 异常输出的 stream
*/
async function diff(cwd, options, stdout, stderr) {
  try {
    const {origin, next, output} = resolveOption(cwd, options, 'diff');
    fs.ensureDirSync(path.dirname(output));
    fs.writeFileSync(output, getDiff(
      fs.readFileSync(origin),
      fs.readFileSync(next)
    ));
    stdout.write(CInfo + `saved to: ${output}\n`);
    return output;
  } catch (e) {
    stderr.write(CError + errMsg(e) + "\n");
  }
  return false;
}

/**
  生成 bundle 相对于 apk/ipa 的全量更新包, 文件路径为相对于 cwd 的路径
  cwd: 运行目录
  options: {origin:"apk|ipa 路径", next:"新 bundle 路径", output:"patch保存路径"}
  stdout: 信息输出的 stream
  stderr: 异常输出的 stream
  ios: 是否为 ios
  客户端更新流程: 解压全量更新包 -> 根据 __diff.json 中的 copies 字段, 从安装包复制相关文件
*/
async function diffPackage(cwd, options, stdout, stderr, ios) {
  try {
    const originBundleName = ios ? 'main.jsbundle' : 'assets/index.android.bundle';
    const {origin, next, output} = resolveOption(cwd, options, ios ? 'diffipa' : 'diffapk');

    // 读取 apk 或 ipa 文件
    let originSource;
    const originMap = {};
    const originEntries = {};
    await enumZipEntries(origin, (entry, zip) => {
      if (!entry.isDirectory) {
        const file = ios ? transformIosPath(entry.fileName) : entry.fileName;
        if (!file) {
          return;
        }
        // isFile
        originEntries[file] = entry.hash;
        originMap[entry.hash] = file;
        // js bundle file
        if (file === originBundleName) {
          return readZipEntireBuffer(entry, zip).then(v => (originSource = v));
        }
      }
    });
    originSource = originSource || Buffer.alloc(0);

    // 读取 ppk 文件, 提取与 apk|ipa 的不同
    const copies = {};
    const zipfile = new ZipFile();
    await enumZipEntries(next, (entry, nextZipfile) => {
      // Directory
      if (entry.isDirectory) {
        zipfile.addEmptyDirectory(entry.fileName);
        return;
      }
      // Bundle file
      if (entry.fileName === 'index.bundlejs') {
        stdout.write(CInfo + "Found bundle\n");
        return readZipEntireBuffer(entry, nextZipfile).then(newSource => {
          zipfile.addBuffer(getDiff(originSource, newSource), 'index.bundlejs.patch');
          stdout.write(CInfo + "Make diff bundle success\n");
        });
      }
      // 该文件在 apk|ipa 中存在 && 路径一致, 无需打包, 标记为 copy, 从安装包中复制
      if (originEntries[entry.fileName] === entry.hash) {
        copies[entry.fileName] = '';
        return;
      }
      // 该文件在 apk|ipa 中存在 && 路径不一致, 无需打包, 标记 copy 文件在安装包的原路径
      if (originMap[entry.hash]) {
        copies[entry.fileName] = originMap[entry.hash];
        return;
      }
      // 新增的文件
      return new Promise((resolve, reject) => {
        nextZipfile.openReadStream(entry, function(err, readStream) {
          if (err) {
            return reject(err);
          }
          zipfile.addReadStream(readStream, entry.fileName);
          resolve();
        });
      });
    });
    zipfile.addBuffer(Buffer.from(JSON.stringify({copies})), '__diff.json');
    zipfile.end();

    // save patch
    fs.ensureDirSync(path.dirname(output));
    await saveZipFile(zipfile, output)
    stdout.write(CInfo + `saved to: ${output}\n`);
    return output;
  } catch (e) {
    stderr.write(CError + errMsg(e) + "\n");
  }
  return false;
}

/**
  生 新bundle 相对于 旧bundle 的增量更新包, 文件路径为相对于 cwd 的路径
  cwd: 运行目录
  options: {origin:"旧 bundle 路径", next:"新 bundle 路径", output:"patch保存路径"}
  stdout: 信息输出的 stream
  stderr: 异常输出的 stream
  客户端更新时: 根据 copies 复制文件 -> 复制上一个除 deletes 之外的文件 -> 将新版本合并进去
*/
async function diffBundle(cwd, options, stdout, stderr) {
  try {
    const {origin, next, output} = resolveOption(cwd, options, 'diff');

    // 读取 旧bundle 文件
    let originSource;
    const originMap = {};
    const originEntries = {};
    stdout.write(CInfo + `Read origin bundle: ${options.origin}\n`);
    await enumZipEntries(origin, (entry, zipFile) => {
      originEntries[entry.fileName] = entry;
      if (entry.isDirectory) {
        return;
      }
      originMap[entry.hash] = entry.fileName;
      // js bundle file
      if (entry.fileName === 'index.bundlejs') {
        return readZipEntireBuffer(entry, zipFile).then(v => (originSource = v));
      }
    });
    originSource = originSource || Buffer.alloc(0);

    // 读取 新Bundle 文件, 提取与 旧bundle 的不同
    const copies = {};
    const addedEntry = {};
    const newEntries = {};
    const dirsAdded = [];
    const zipfile = new ZipFile();
    const addEntry = (file) => {
      if (!file || addedEntry[file]) {
        return;
      }
      const base = basename(file);
      if (base) {
        addEntry(base);
      }
      if (!dirsAdded.includes(file)) {
        zipfile.addEmptyDirectory(file);
      }
    };
    stdout.write(CInfo + `Read next bundle: ${options.next}\n`);
    await enumZipEntries(next, (entry, nextZipfile) => {
      newEntries[entry.fileName] = entry;
      // Directory
      if (entry.isDirectory) {
        if (!originEntries[entry.fileName]) {
          addEntry(entry.fileName);
        }
        return;
      }
      // Bundle file
      if (entry.fileName === 'index.bundlejs') {
        stdout.write(CInfo + "Found bundle\n");
        return readZipEntireBuffer(entry, nextZipfile).then(newSource => {
          zipfile.addBuffer(getDiff(originSource, newSource), 'index.bundlejs.patch');
          stdout.write(CInfo + "Make diff bundle success\n");
        });
      }
      const originEntry = originEntries[entry.fileName];
      // 旧版存在相同 hash 文件, 且路径相同
      if (originEntry && originEntry.hash === entry.hash) {
        return;
      }
      // 旧版存在相同 hash 文件, 但路径不同
      if (originMap[entry.hash]) {
        const base = basename(entry.fileName);
        if (!originEntries[base]) {
          addEntry(base);
        }
        copies[entry.fileName] = originMap[entry.hash];
        return;
      }
      // 新增的文件, 先添加文件夹, 再添加文件
      addEntry(basename(entry.fileName));
      return new Promise((resolve, reject) => {
        nextZipfile.openReadStream(entry, function(err, readStream) {
          if (err) {
            return reject(err);
          }
          zipfile.addReadStream(readStream, entry.fileName);
          resolve();
        });
      });
    });

    // 在 旧bundle 中存在, 而 新Bundel 中不存在的文件标记为 deletes
    const deletes = {};
    for (var k in originEntries) {
      if (!newEntries[k]) {
        deletes[k] = 1;
      }
    }
    zipfile.addBuffer(Buffer.from(JSON.stringify({ copies, deletes })), '__diff.json');
    zipfile.end();

    // save patch
    fs.ensureDirSync(path.dirname(output));
    await saveZipFile(zipfile, output)
    stdout.write(CInfo + `saved to: ${output}\n`);
    return output;
  } catch (e) {
    stderr.write(CError + errMsg(e) + "\n");
  }
  return false;
}

module.exports = {
  diff,
  diffPackage,
  diffBundle,
};