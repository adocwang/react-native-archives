import React from 'react';
import helper from './../helper';
import {checkPlusBody} from './RequestPlus.body';

const responsePlus = async () => {
  await checkPlusBody();
}

export default () => {
  return <helper.TestButton title="ResponsePlus" onPress={responsePlus} />
};