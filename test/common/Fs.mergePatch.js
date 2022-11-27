import React from 'react';
import helper from './../helper';
import {fs, dirs} from "./../../index";

const mergePatch = async () => {
  const filea = require('./../../easypush/fixtures/a.png');
  const fileb = require('./../../easypush/fixtures/b.png');
  const patcha2b = require('./../../easypush/fixtures/a2b.zip');
  const patchb2a = require('./../../easypush/fixtures/b2a.zip');

  const desta = dirs.Temporary + '/_mergePatch_test_desta.png';
  const destb = dirs.Temporary + '/_mergePatch_test_destb.png';

  // test a->b
  await fs.mergePatch(filea, patcha2b, destb);
  const existb = await fs.isDir(destb);
  helper.showLog('merge a2b', existb, false===existb);
  const md5b = await fs.getHash(fileb);
  const md5b2 = await fs.getHash(destb);
  helper.showLog('check a2b', md5b, md5b2, md5b===md5b2);
 
  // test b->a
  await fs.mergePatch(fileb, patchb2a, desta);
  const exista = await fs.isDir(desta);
  helper.showLog('merge b2a', exista, false===exista);
  const md5a = await fs.getHash(filea);
  const md5a2 = await fs.getHash(desta);
  helper.showLog('check a2b', md5a, md5a2, md5a===md5a2);
}

export default () => {
  return <helper.TestButton title="fs.mergePatch" onPress={mergePatch}/>
};