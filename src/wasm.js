/*
rn 当前默认不支持 WebAssembly, 若支持了, 便可使用该组件

import wasm from 'react-native-archives/src/wasm';
wasm(file, importObject).then(r => {
  consol.log(r);
})

其中 file 支持
1. res://
2. asset://
3. file://
4. require('localFile')
5. http(s)://

关于 require() 形式, rn 使用 metro 判断引入文件

默认可用的文件后缀参见
https://github.com/facebook/metro/blob/master/packages/metro-config/src/defaults/defaults.js

默认是没有 wasm 后缀的, 嫌麻烦, 可用直接使用 zip 后缀, 不影响结果

若期望使用自定义后缀, 可参考
https://facebook.github.io/metro/docs/en/configuration#assetexts
即在 rn 项目根目录的 metro.config.js 配置, 要全量配置, 该配置会完全覆盖 metro 默认值
module.exports = {
  resolver: {
    assetExts: [
      'png',
      'gif',
      ....

      'wasm'
    ],
  },
  ...
};

*/
import utils from './utils';
import {readFile} from './fileSystem';

const cached = {};

function loadWebAssembly(wasm, opts) {
  let ready = null;
  const imp = opts && opts.imports;
  const mod = {
    buffer: wasm,
    memory: null,
    exports: null,
    realloc,
    onload
  };
  function realloc(size) {
    mod.exports.memory.grow(Math.max(0, Math.ceil(Math.abs(size - mod.memory.length) / 65536)))
    mod.memory = new Uint8Array(mod.exports.memory.buffer)
  }
  function onload(cb) {
    if (mod.exports) {
      return cb()
    }
    if (ready) {
      ready.then(cb.bind(null, null)).catch(cb)
      return;
    }
    try {
      if (opts && opts.async) {
        throw new Error('async')
      }
      setup({instance: new WebAssembly.Instance(new WebAssembly.Module(wasm), imp)})
    } catch (err) {
      ready = WebAssembly.instantiate(wasm, imp).then(setup)
    }
    onload(cb)
  }
  function setup (w) {
    mod.exports = w.instance.exports
    mod.memory = mod.exports.memory && mod.exports.memory.buffer && new Uint8Array(mod.exports.memory.buffer)
  }
  onload(function () {})
  return mod
}

function fetchRemote(url) {
  return fetch(url).then(res => res.blob()).then(blob => {
    return utils.blobRender(blob).render().then(r => {
      blob.close();
      return r;
    })
  })
}

function wasm(file, opts) {
  if (!wasm.supported) {
    return Promise.reject("WebAssembly is not support");
  }
  let scheme = null;
  if (utils.getNumber(file, null) === null) {
    const test = file.match(/^([a-zA-Z]+):\/\//);
    scheme = test ? test[1].toLowerCase() : null;
    if (!scheme) {
      file = 'file://' + file;
    }
  }
  console.log(cached);
  if (cached[file]) {
    console.log('from cache')
    return Promise.resolve(cached[file]);
  }
  let pros;
  if (scheme === 'http' || scheme === 'https') {
    pros = fetchRemote(file);
  } else {
    pros = readFile(file);
  }
  return pros.then(buf => {
    return cached[file] = loadWebAssembly(buf, opts)
  })
}
wasm.supported = typeof WebAssembly !== 'undefined';

module.exports = wasm;