const yazl = require('yazl');
const path = require('path');
const fs = require('fs-extra');
const {spawn} = require('child_process');

const CInfo = "\033[1m\x1b[36minfo\x1b[0m ";
const CWarning = "\033[1m\x1b[35mWarning\x1b[0m ";
const CError = "\033[1m\x1b[31mError\x1b[0m ";

function errMsg(e){
  if (typeof e === 'object' && 'message' in e) {
    return e.message
  }
  return e;
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

module.exports = {
  CInfo,
  CWarning,
  CError,
  errMsg,
  getRNVersion,
  runCommand,
  pack
};