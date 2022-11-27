import React from 'react';
import helper from './../helper';
import {Text} from 'react-native';
import {fs, dirs, fetchPlus} from "./../../index";

export default () => {
  const [loaded, setLoaded] = helper.useStateCallback(0);

  const remoteFont = async () => {
    if (loaded) {
      helper.showLog('font has loaded', true);
      return;
    }
    const file = dirs.Temporary + '/remotefont.ttf';
    const url = "https://at.alicdn.com/t/font_3415031_w5ulq8d500h.ttf?t=1652968984755";
    await fetchPlus(url, {saveTo: file})
    await fs.loadFont('remotefont', file);
    setLoaded(1, () => {
      helper.showLog('load remoteFont success', true);
    });
  }

  return <helper.TestButton title="fs.remoteFont" onPress={remoteFont}>
    {loaded ? <Text style={{
      fontFamily:'remotefont',
      color: 'white'
    }}>{helper.unicode('&#xe8b9;')}</Text> : null}
  </helper.TestButton>
};