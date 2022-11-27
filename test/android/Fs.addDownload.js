import React from 'react';
import helper from './../helper';
import {fs, external, fetchPlus} from "./../../index";

const addDownload = async () => {
  const file = 'file://' + external.AppCaches + '/_arch_test_addown_.docx';
  const test = await fs.isDir(file);
  if (false !== test) {
    await fetchPlus({
      url: helper.Assets.RemoteDoc,
      saveTo: file
    })
  }
  await fs.addDownload({
    file,
    title: 'test title(docx file)',
    description: 'test desc',
  })
}

export default () => {
  return <helper.TestButton title="fs.addDownload" onPress={addDownload} android={true}/>
};