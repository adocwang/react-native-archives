import React from 'react';
import {fs} from "./../../index";
import helper from './../helper';

const externalManager = async () => {
  let isExternalManager = await fs.isExternalManager();
  helper.showLog('isExternalManager', isExternalManager, true);

  const rs = await fs.requestExternalManager();
  helper.showLog('requestExternalManager', rs, true);

  isExternalManager = await fs.isExternalManager();
  helper.showLog('isExternalManager', isExternalManager, true);
}

export default () => {
  return <helper.TestButton title="Fs.externalManager" onPress={externalManager} android={true}/>
};