import React from 'react';
import {IsAndroid} from './helper';
import {StyleSheet, ScrollView, View, Text} from 'react-native';

const CommonItems = [
  require('./common/UtilsFunc').default,
  require('./common/BlobPlus').default,
  require('./common/RequestPlus.props').default,
  require('./common/RequestPlus.body').default,
  require('./common/ResponsePlus').default,
  require('./common/FetchPlus').default,
  require('./common/HttpRequest.props').default,
  require('./common/HttpRequest.datas').default,
  require('./common/HttpService').default,
  require('./common/ShowVars').default,
  require('./common/Fs.isDir').default,
  require('./common/Fs.rmkDir').default,
  require('./common/Fs.readDir').default,
  require('./common/Fs.writeFile').default,
  require('./common/Fs.readFile').default,
  require('./common/Fs.copyFile').default,
  require('./common/Fs.moveFile').default,
  require('./common/Fs.unlink').default,
  require('./common/Fs.openFile').default,
  require('./common/Fs.getMime').default,
  require('./common/Fs.getExt').default,
  require('./common/Fs.getHash').default,
  require('./common/Fs.localFont').default,
  require('./common/Fs.remoteFont').default,
  require('./common/Fs.reload').default,
  require('./common/Fs.unzip').default,
  require('./common/Fs.mergePatch').default,
];

const PlatItems = IsAndroid ? [
  require('./android/Fs.restartAndroid').default,
  require('./android/Fs.scanFile').default,
  require('./android/Fs.sendIntent').default,
  require('./android/Fs.externalManager').default,
  require('./android/Fs.getContentUri').default,
  require('./android/Fs.getShareUri').default,
  require('./android/Fs.download').default,
  require('./android/Fs.addDownload').default,
] : [
  require('./ios/Fs.saveToCameraRoll').default,
];

function ArchivesTest({scrolled=true}) {
  const Lists = <>
    <Text style={styles.title}>
      --------- Commons ---------
    </Text>
    <View style={styles.list}>
      {CommonItems.map((Item, index) => <Item key={"item"+index}/>)}
    </View>
    <Text style={styles.title}>
      --------- {IsAndroid ? 'Android' : 'iOS'} Only ---------
    </Text>
    <View style={styles.list}>
      {PlatItems.map((Item, index) => <Item key={"item"+index}/>)}
    </View>
  </>;
  if (scrolled) {
    return <ScrollView style={{flex:1}} contentContainerStyle={{paddingBottom:8}}>
      {Lists}
    </ScrollView>
  }
  return <View style={{paddingBottom:8}}>
    {Lists}
  </View>
}

const styles = StyleSheet.create({
  list: {
    flexDirection:"row",
    flexWrap:"wrap",
  },
  title:{
    textAlign:'center',
    paddingVertical:8,
    color:'#ccc'
  }
});

export default ArchivesTest;