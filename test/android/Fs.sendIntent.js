import React from 'react';
import helper from './../helper';
import {fs} from "./../../index";

const sendIntent = async () => {
  const rs = await fs.sendIntent({
    action:'android.content.Intent$ACTION_SENDTO',
    data:'smsto:10086',
    extras:[
      {
        key:'subject',
        value:'custom subject'
      },
      {
        key:'sms_body',
        value:'custom content'
      },
    ]
  });
  helper.showLog('sendmsg', rs, true)
}

export default () => {
  return <helper.TestButton title="Fs.sendIntent" onPress={sendIntent} android={true}/>
};