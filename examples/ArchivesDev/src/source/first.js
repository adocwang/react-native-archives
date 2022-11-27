import React from 'react';
import {status, fs} from 'react-native-archives';
import ArchivesTest from 'react-native-archives/test';
import {VersionInfo, upBundle, upPatch, upDiff, reinitialize} from './helper';
import {StyleSheet, ScrollView, Button, View, Image, Text} from 'react-native';

const Assets = {
  raw1: require('./files/raw1.html'),
  raw2: require('./files/raw2.html'),
  raw3: require('./files/raw3.html'),
  bv1: require('./files/bv1.png'),
  bv2: require('./files/bv2.png'),
  bv3: require('./files/bv3.png'),
};

const App = () => {
  const [txt1, setTxt1] = React.useState();
  const [txt2, setTxt2] = React.useState();
  const [txt3, setTxt3] = React.useState();

  React.useEffect(() => {
    if (status.isFirstTime) {
      fs.markSuccess()
    }
    fs.readFile(Assets.raw1).then(rs => setTxt1(rs))
    fs.readFile(Assets.raw2).then(rs => setTxt2(rs))
    fs.readFile(Assets.raw3).then(rs => setTxt3(rs))
  })

  return <ScrollView contentContainerStyle={styles.wrap} contentInsetAdjustmentBehavior="automatic">
    <VersionInfo />

    <View style={styles.info}>
      <Text>文字: raw1-raw2-raw3 图: Blue1-Blue2-Blue3</Text>
    </View>

    <View style={styles.content}>
      <Text style={styles.txt}>{__DEV__ ? 'DEBUG' : (status.currentVersion ? '版本1' : '初始安装版')}</Text>
      <Text style={styles.txt}>{txt1} - {txt2} - {txt3}</Text>
      <View style={styles.row}>
        <Image source={Assets.bv1} style={styles.img}/>
        <Image source={Assets.bv2} style={styles.img}/>
        <Image source={Assets.bv3} style={styles.img}/>
      </View>
      <View style={styles.row}>
        {status.currentVersion ? <Button
          title='Upgrade' onPress={() => upDiff(2)}
        /> : <Button
          title='Bundle' onPress={() => upBundle(1)}
        />}

        {status.currentVersion || __DEV__  ? null : <View style={{marginLeft:10}}><Button
          title='upPatch' onPress={() => upPatch(2)}
        /></View>}

        {status.currentVersion ? <View style={{marginLeft:10}}>
          <Button title='Reset' onPress={reinitialize}/>
        </View> : null}
      </View>
    </View>

    <ArchivesTest scrolled={false}/>
  </ScrollView>
}

const styles = StyleSheet.create({
  wrap: {
    paddingBottom:20,
    paddingHorizontal:10,
  },
  info:{
    padding:10,
    marginTop:10,
    backgroundColor:'#eee',
  },
  content:{
    flex:1,
    paddingTop:10,
    alignItems:'center',
  },
  row:{
    flexDirection:'row'
  },
  txt:{
    fontSize:20,
    marginVertical:10,
  },
  img:{
    width:100,
    height:100,
    marginVertical:10,
  },
});

export default App;