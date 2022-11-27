import React from 'react';
import helper from './../helper';
import {Text} from 'react-native';
import {fs} from "./../../index";

export default () => {
  const [loaded, setLoaded] = helper.useStateCallback(0);

  const localFont = async () => {
    if (loaded) {
      helper.showLog('font has loaded', true);
      return;
    }
    await fs.loadFont('localFont', helper.Assets.LocalTtf);
    setLoaded(1, () => {
      helper.showLog('load localFont success', true);
    });
  }

  return <helper.TestButton title="fs.localFont" onPress={localFont}>
    {loaded ? <Text style={{
      fontFamily:'localFont',
      color: 'white'
    }}>{helper.unicode('&#xe8c9;')}</Text> : null}
  </helper.TestButton>
};