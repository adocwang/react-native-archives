import React from 'react';
import {fs} from "./../../index";
import helper from './../helper';

const getContentUri = async () => {
  let paths = [
    'images', 'video', 'audio', 'files', 'downloads',
    'audio.artists', 'audio.albums', 'audio.genres', 'audio.playlists'
  ], type, uri;

  helper.prtLog("✸✸ getContentUri external ✸✸");
  for (type of paths) {
    uri = await fs.getContentUri(type);
    helper.prtLog(type+':', uri)
  }

  helper.prtLog("✸✸ getContentUri internal ✸✸");
  for (type of paths) {
    uri = await fs.getContentUri(type, 'internal');
    helper.prtLog(type+':', uri)
  }
}

export default () => {
  return <helper.TestButton title="fs.getContentUri" onPress={getContentUri} android={true}/>
};