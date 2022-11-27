import React from 'react';
import {status, fs} from 'react-native-archives';
import {VersionInfo, upDiff, reinitialize} from './helper';
import {StyleSheet, ScrollView, Button, View, Image, Text} from 'react-native';

/**
  相比v1: 
  保留一些(raw1,bv1), 
  复制一些(raw11,bv11),
  修改一些(raw2,bv2),
  移除一些(raw3,bv3),
  新增一些(str*,rv*),
*/
const Assets = {
  raw1: require('./files/raw1.html'),
  raw11: require('./files/raw1.html'),
  raw2: require('./files/raw2.html'),
  bv1: require('./files/bv1.png'),
  bv11: require('./files/bv11.png'),
  bv2: require('./files/bv2.png'),

  str1: require('./files/str1.html'),
  str2: require('./files/str2.html'),
  str3: require('./files/str3.html'),
  rv1: require('./files/rv1.png'),
  rv2: require('./files/rv2.png'),
  rv3: require('./files/rv3.png'),
};

const App = () => {
  const [txt1, setTxt1] = React.useState();
  const [txt11, setTxt11] = React.useState();
  const [txt2, setTxt2] = React.useState();

  const [str1, setStr1] = React.useState();
  const [str2, setStr2] = React.useState();
  const [str3, setStr3] = React.useState();

  React.useEffect(() => {
    if (status.isFirstTime) {
      fs.markSuccess()
    }
    fs.readFile(Assets.raw1).then(rs => setTxt1(rs))
    fs.readFile(Assets.raw11).then(rs => setTxt11(rs))
    fs.readFile(Assets.raw2).then(rs => setTxt2(rs))

    fs.readFile(Assets.str1).then(rs => setStr1(rs))
    fs.readFile(Assets.str2).then(rs => setStr2(rs))
    fs.readFile(Assets.str3).then(rs => setStr3(rs))
  })

  return <ScrollView contentContainerStyle={styles.wrap} contentInsetAdjustmentBehavior="automatic">
    <VersionInfo />

    <View style={styles.info}>
      <Text>输出应为: raw1_raw1_raw2c / str1_str2_str3</Text>
      <Text>图 BlueV1_BlueV1_BlueV2c / RedV1_RedV2_RedV3</Text>
    </View>

    <View style={styles.content}>
      <Text style={styles.txt}>版本2</Text>
      <Text style={styles.txt}>{txt1} - {txt11} - {txt2}</Text>
      <Text style={styles.txt}>{str1} - {str2} - {str3}</Text>

      <View style={styles.row}>
        <Image source={Assets.bv1} style={styles.img}/>
        <Image source={Assets.bv11} style={styles.img}/>
        <Image source={Assets.bv2} style={styles.img}/>
      </View>

      <View style={styles.row}>
        <Image source={Assets.rv1} style={styles.img}/>
        <Image source={Assets.rv2} style={styles.img}/>
        <Image source={Assets.rv3} style={styles.img}/>
      </View>

      <View style={styles.row}>
        <Button title='Upgrade' onPress={() => upDiff(3)}/>
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
  row:{
    flexDirection:'row',
  },
  txt:{
    fontSize:20,
    marginVertical:10,
  },
  img:{
    width:100,
    height:100,
  },
});

export default App;