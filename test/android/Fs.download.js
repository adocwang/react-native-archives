import React from 'react';
import {fs} from "./../../index";
import helper from './../helper';

const download = async () => {
  await fs.download({
    url:helper.Assets.RemoteJpg,
    title:'test download',
    description:'download desc',
    onProgress:e => {
      helper.showLog('onProcess', e, true);
    },
    onComplete:e => {
      helper.showLog('onComplete', e, true);
    },
    onError:e => {
      helper.showLog('onError', e, true);
    }
  });
  helper.showLog('onStart', true);
}

export default () => {
  return <helper.TestButton title="fs.download" onPress={download} android={true}/>
};