import React from 'react';
import helper from './../helper';
import {fs} from "./../../index";

const restartAndroid = async () => {
  const rs = await fs.restartAndroid();
  helper.prtLog('restart', rs)
}

export default () => {
  return <helper.TestButton title="fs.restartAndroid" onPress={restartAndroid} android={true}/>
};