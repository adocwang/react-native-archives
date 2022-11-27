import React from 'react';
import helper from './../helper';
import {dirs, status, external} from "./../../index";

const showVars = async () => {
  helper.showLog('dirs', dirs, true);
  helper.showLog('status', status, true);
  helper.showLog('external', external, true);
}

export default () => {
  return <helper.TestButton title="ShowVars" onPress={showVars}/>
};