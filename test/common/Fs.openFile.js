import React from 'react';
import helper from './../helper';
import {fs, dirs, fetchPlus} from "./../../index";

const openFile = async () => {
  const file = dirs.Temporary + '/_arch_test_addown_.jpeg';
  const test = await fs.isDir(file);
  if (false !== test) {
    await fetchPlus({
      url: helper.Assets.RemoteJpg,
      saveTo: file
    })
  }
  await fs.openFile(file, {
    title: "Test File",
    onClose:() => {
      helper.prtLog('open file closed')
      fs.unlink(file);
    }
  });
  helper.prtLog('open file success')
}

const openFile2 = async () => {
  const file = dirs.Temporary + '/_arch_test_addown_';
  const test = await fs.isDir(file);
  if (false !== test) {
    await fetchPlus({
      url: helper.Assets.RemoteJpg,
      saveTo: file
    })
  }
  await fs.openFile(file, {
    mime: "image/jpeg",
    title: "Test File",
    onClose:() => {
      helper.prtLog('open file closed')
      fs.unlink(file);
    }
  });
  helper.prtLog('open file success')
}

export default () => {
  return [
    <helper.TestButton key="o1" title="fs.openFile" onPress={openFile}/>,
    <helper.TestButton key="o2" title="fs.openFile2" onPress={openFile2}/>
  ]
};