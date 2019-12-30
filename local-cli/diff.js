const path = require('path');
const fs = require('fs-extra');
const {ZipFile} = require('yazl');
const {open:openZipFile} = require('yauzl');
const {
  fileExist, CInfo, CError, CWarning, getBSDiff, 
  errMsg, runCommand, pack
} = require('./utils');

function enumZipEntries(zipFn, callback) {
  return new Promise((resolve, reject) => {
    openZipFile(zipFn, { lazyEntries: true }, (err, zipfile) => {
      if (err) {
        return reject(err);
      }
      zipfile.on('end', resolve);
      zipfile.on('error', reject);
      zipfile.on('entry', entry => {
        const result = callback(entry, zipfile);
        if (result && typeof result.then === 'function') {
          result.then(() => zipfile.readEntry());
        } else {
          zipfile.readEntry();
        }
      });
      zipfile.readEntry();
    });
  });
}

function readEntire(entry, zip) {
  const buffers = [];
  return new Promise((resolve, reject) => {
    zip.openReadStream(entry, (err, stream) => {
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

function saveZipFile(zipfile, output, autoCreate) {
  if (autoCreate) {
    fs.ensureDirSync(path.dirname(output));
  }
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

function basename(fn) {
  const m = /^(.+\/)[^\/]+\/?$/.exec(fn);
  return m && m[1];
}

function transformIosPath(v) {
  const m = /^Payload\/[^/]+\/(.+)$/.exec(v);
  return m && m[1];
}

function resolveOption(cwd, options, ios) {
  let {origin, next, output, cmd} = options;
  if (!origin || !next) {
    const err = cmd ? 'easypush ' + (
      ios === null ? 'diff' : (
        ios ? 'diffipa' : 'diffapk'
      )
    ) + ' <origin> <next> [--output savePath]' : 'Argumets error';
    throw err;
  }
  origin = path.resolve(cwd, origin);
  next = path.resolve(cwd, next);
  if (!fileExist(origin)) {
    throw 'origin file not exist';
  }
  if (!fileExist(next)) {
    throw 'next file not exist';
  }
  if (!output) {
    output = 'build/output/diff-'+Date.now()+'.'+(ios === null ? 'diff' : (ios ? 'ipa' : 'apk'))+'-patch';
  }
  output = path.resolve(cwd, output);
  return {origin, next, output}
}

async function diffFromPackage(cwd, options, stdout, stderr, ios, autoCreate) {
  const bsdiff = getBSDiff();
  let {origin, next, output} = resolveOption(cwd, options, ios);
  const originBundleName = ios ? 'main.jsbundle' : 'assets/index.android.bundle';
  
  // read origin source
  let originSource;
  const originMap = {};
  const originEntries = {};
  await enumZipEntries(origin, (entry, zip) => {
    if (!/\/$/.test(entry.fileName)) {
      const fn = ios ? transformIosPath(entry.fileName) : entry.fileName;
      if (!fn) {
        return;
      }
      // isFile
      originEntries[fn] = entry.crc32;
      originMap[entry.crc32] = fn;

      // This is source.
      if (fn === originBundleName) {
        return readEntire(entry, zip).then(v => (originSource = v));
      }
    }
  });
  originSource = originSource || new Buffer(0);

  // make diff patch
  const copies = {};
  const zipfile = new ZipFile();
  await enumZipEntries(next, (entry, nextZipfile) => {
    if (/\/$/.test(entry.fileName)) {
      // Directory
      zipfile.addEmptyDirectory(entry.fileName);
    } else if (entry.fileName === 'index.bundlejs') {
      stdout.write(CInfo + "Found bundle\n");
      return readEntire(entry, nextZipfile).then(newSource => {
        zipfile.addBuffer(bsdiff(originSource, newSource), 'index.bundlejs.patch');
        stdout.write(CInfo + "Make diff bundle success\n");
      });
    } else {
      // If same file.
      if (originEntries[entry.fileName] === entry.crc32) {
        copies[entry.fileName] = '';
        return;
      }
      // If moved from other place
      if (originMap[entry.crc32]) {
        copies[entry.fileName] = originMap[entry.crc32];
        return;
      }
      return new Promise((resolve, reject) => {
        nextZipfile.openReadStream(entry, function(err, readStream) {
          if (err) {
            return reject(err);
          }
          zipfile.addReadStream(readStream, entry.fileName);
          readStream.on('end', () => {
            resolve();
          });
        });
      });
    }
  });
  zipfile.addBuffer(new Buffer(JSON.stringify({ copies })), '__diff.json');
  zipfile.end();

  // save patch
  await saveZipFile(zipfile, output, autoCreate)
  stdout.write(CInfo + `saved to: ${output}\n`);
  return output;
}

/**
  生成用于更新的 相对于 apk/ipa 的增量 bundle
  cwd: 运行目录
  options: {origin:"apk 路径", next:"新 bundle 路径", output:"patch生成路径"}
  stdout: 信息输出的 stream
  stderr: 异常输出的 stream
  ios: 是否为 ios
  autoCreate: 若输出目录不存在, 是否自动创建
*/
async function diffPackage(cwd, options, stdout, stderr, ios, autoCreate) {
  try {
    return await diffFromPackage(cwd, options, stdout, stderr, ios, autoCreate);
  } catch (e) {
    stderr.write(CError + errMsg(e) + "\n");
    return false;
  }
}

async function diffFromPPK(cwd, options, stdout, stderr, autoCreate) {
  const bsdiff = getBSDiff();
  let {origin, next, output} = resolveOption(cwd, options, null);

  // read origin source
  let originSource;
  const originMap = {};
  const originEntries = {};
  await enumZipEntries(origin, (entry, zipFile) => {
    originEntries[entry.fileName] = entry;
    if (!/\/$/.test(entry.fileName)) {
      // isFile
      originMap[entry.crc32] = entry.fileName;

      if (entry.fileName === 'index.bundlejs') {
        // This is source.
        return readEntire(entry, zipFile).then(v => (originSource = v));
      }
    }
  });
  originSource = originSource || new Buffer(0);

  // make diff patch
  const copies = {};
  const addedEntry = {};
  const newEntries = {};
  const zipfile = new ZipFile();
  const addEntry = (fn) => {
    //console.log(fn);
    if (!fn || addedEntry[fn]) {
      return;
    }
    const base = basename(fn);
    if (base) {
      addEntry(base);
    }
    zipfile.addEmptyDirectory(fn);
  };
  await enumZipEntries(next, (entry, nextZipfile) => {
    newEntries[entry.fileName] = entry;

    if (/\/$/.test(entry.fileName)) {
      // Directory
      if (!originEntries[entry.fileName]) {
        addEntry(entry.fileName);
      }
    } else if (entry.fileName === 'index.bundlejs') {
      stdout.write(CInfo + "Found bundle\n");
      return readEntire(entry, nextZipfile).then(newSource => {
        zipfile.addBuffer(bsdiff(originSource, newSource), 'index.bundlejs.patch');
        stdout.write(CInfo + "Make diff bundle success\n");
      });
    } else {
      // If same file.
      const originEntry = originEntries[entry.fileName];
      if (originEntry && originEntry.crc32 === entry.crc32) {
        // ignore
        return;
      }

      // If moved from other place
      if (originMap[entry.crc32]) {
        const base = basename(entry.fileName);
        if (!originEntries[base]) {
          addEntry(base);
        }
        copies[entry.fileName] = originMap[entry.crc32];
        return;
      }

      // New file.
      addEntry(basename(entry.fileName));
      return new Promise((resolve, reject) => {
        nextZipfile.openReadStream(entry, function(err, readStream) {
          if (err) {
            return reject(err);
          }
          zipfile.addReadStream(readStream, entry.fileName);
          readStream.on('end', () => {
            //console.log('add finished');
            resolve();
          });
        });
      });
    }
  });

  const deletes = {};
  for (var k in originEntries) {
    if (!newEntries[k]) {
      stdout.write(CInfo + `Delete:${k}\n`);
      deletes[k] = 1;
    }
  }
  zipfile.addBuffer(new Buffer(JSON.stringify({ copies, deletes })), '__diff.json');
  zipfile.end();

  // save patch
  await saveZipFile(zipfile, output, autoCreate)
  stdout.write(CInfo + `saved to: ${output}\n`);
  return output;
}

/**
  生成用于更新的 相对于上个版本 bundle 的增量 bundle
  cwd: 运行目录
  options: {origin:"旧 ppk 路径", next:"新 ppk 路径", output:"patch生成路径"}
  stdout: 信息输出的 stream
  stderr: 异常输出的 stream
  autoCreate: 若输出目录不存在, 是否自动创建
*/
async function diffPPK(cwd, options, stdout, stderr, autoCreate) {
  try {
    return await diffFromPPK(cwd, options, stdout, stderr, autoCreate);
  } catch (e) {
    stderr.write(CError + errMsg(e) + "\n");
    return false;
  }
}

module.exports = {
  diffPackage,
  diffPPK
};