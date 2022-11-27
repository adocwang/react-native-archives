import React from 'react';
import helper from './../helper';
import {fs, dirs} from "./../../index";

const getHash = async () => {
  helper.prtLog('✸✸ get special file hash ✸✸');
  const files = [
    ...(await helper.getTestPaths()).files,
    [helper.Assets.LocalPng, "require('.png')"],
    [helper.Assets.LocalRaw, "require('.html')"],
  ];
  let path, pathName,shash;
  for (path of files) {
    if (Array.isArray(path)) {
      [path, pathName] = path;
    } else {
      pathName = path;
    }
    shash = await fs.getHash(path);
    helper.showLog(pathName, shash, true);
  }
  await helper.makeTmpDir(true);

  helper.prtLog('✸✸ check hash value ✸✸');
  let file, hash, except;
  file = dirs.Temporary + '/_test_.txt';
  await fs.writeFile(file, 'abc');
  const hashs = {
    md5: "900150983cd24fb0d6963f7d28e17f72",
    sha1: "a9993e364706816aba3e25717850c26c9cd0d89d",
    sha224: "23097d223405d8228642a477bda255b32aadbce4bda0b3f7e36c9da7",
    sha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
    sha384: "cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7",
    sha512: "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f",
  };
  for (let k in hashs) {
    except = hashs[k];
    hash = await fs.getHash(file, k);
    helper.showLog(k, except,  hash, except === hash);
  }
  await fs.unlink(file);

  if (helper.IsAndroid) {
    file = 'drawable://notify_panel_notification_icon_bg'
    hash = await fs.getHash(file);
    except = 'e5e0e446cc8c3c56990cd94799d65598';
    helper.showLog('drawable file hash', except, hash, except === hash);
  }
}

export default () => {
  return <helper.TestButton title="fs.getHash" onPress={getHash}/>
};