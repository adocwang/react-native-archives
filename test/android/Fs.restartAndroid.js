import React from 'react';
import {fs} from "./../../index";
import helper from './../helper';

const restartAndroid = async () => {
  const rs = await fs.restartAndroid();
  helper.prtLog('restart', rs)
}

export default () => {
  return <helper.TestButton title="fs.restartAndroid" onPress={restartAndroid} android={true}/>
};