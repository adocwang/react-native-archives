import React from 'react';
import {status, fs} from 'react-native-archives';
import {VersionInfo, upDiff, reinitialize} from './helper';
import {StyleSheet, ScrollView, Button, View, Image, Text} from 'react-native';

/**
  相比v2: 
  保留一些(raw2,bv2, str2,rv2), 
  复制一些(raw22,bv22, str22,rv22),
  修改一些(raw1,bv1, str1,rv1),
  移除一些(raw11,bv11, str3,rv3),
  新增一些(addStr,addImg),
*/
const Assets = {
  raw1: require('./files/raw1.html'),
  raw2: require('./files/raw2.html'),
  raw22: require('./files/raw22.html'),
  bv1: require('./files/bv1.png'),
  bv2: require('./files/bv2.png'),
  bv22: require('./files/bv22.png'),

  str1: require('./files/str1.html'),
  str2: require('./files/str2.html'),
  str22: require('./files/str2.html'),
  rv1: require('./files/rv1.png'),
  rv2: require('./files/rv2.png'),
  rv22: require('./files/rv2.png'),

  addStr: require('./files/add.html'),
  addImg: require('./files/add.png'),
};

const App = () => {
  const [txt1, setTxt1] = React.useState();
  const [txt2, setTxt2] = React.useState();
  const [txt22, setTxt22] = React.useState();

  const [str1, setStr1] = React.useState();
  const [str2, setStr2] = React.useState();
  const [str22, setStr22] = React.useState();

  const [addStr, setAddStr] = React.useState();
  React.useEffect(() => {
    if (status.isFirstTime) {
      fs.markSuccess()
    }
    fs.readFile(Assets.raw1).then(rs => setTxt1(rs))
    fs.readFile(Assets.raw2).then(rs => setTxt2(rs))
    fs.readFile(Assets.raw22).then(rs => setTxt22(rs))

    fs.readFile(Assets.str1).then(rs => setStr1(rs))
    fs.readFile(Assets.str2).then(rs => setStr2(rs))
    fs.readFile(Assets.str22).then(rs => setStr22(rs))

    fs.readFile(Assets.addStr).then(rs => setAddStr(rs))
  })
  return <ScrollView contentContainerStyle={styles.wrap} contentInsetAdjustmentBehavior="automatic">
    <VersionInfo />

    <View style={styles.info}>
      <Text>输出应为: raw11_raw2c_raw2c / str1c_str2_str2 / add</Text>
      <Text>图: BlueV1c_BlueV2c_BlueV2c / RedV1c_RedV2_RedV2 / GreenAdd</Text>
    </View>

    <View style={styles.content}>
      <Text style={styles.txt}>版本3</Text>
      <Text style={styles.txt}>{txt1} - {txt2} - {txt22}</Text>
      <Text style={styles.txt}>{str1} - {str2} - {str22}</Text>
      <Text style={styles.txt}>{addStr}</Text>

      <View style={styles.row}>
        <Image source={Assets.bv1} style={styles.img}/>
        <Image source={Assets.bv2} style={styles.img}/>
        <Image source={Assets.bv22} style={styles.img}/>
      </View>

      <View style={styles.row}>
        <Image source={Assets.rv1} style={styles.img}/>
        <Image source={Assets.rv2} style={styles.img}/>
        <Image source={Assets.rv22} style={styles.img}/>
      </View>

      <Image source={Assets.addImg} style={styles.img}/>

      <View style={styles.row}>
        <Button title='Upgrade' onPress={() => upDiff(4)}/>
        <View style={{marginLeft:10}}>
          <Button title='Reset' onPress={reinitialize}/>
        </View>
      </View>
    </View>
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
  txt:{
    fontSize:20,
    marginVertical:10,
  },
  row:{
    flexDirection:'row'
  },
  img:{
    width:100,
    height:100,
  },
});

export default App;