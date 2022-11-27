import React from 'react';
import helper from './../helper';
import {fs} from "./../../index";

const reload = async () => {
  const rs = await fs.reload();
  helper.prtLog('reload', rs)
}

export default () => {
  return <helper.TestButton title="fs.reload" onPress={reload}/>
};