import React from 'react';
import {status, dirs, fs, fetchPlus} from 'react-native-archives';
import {
  Platform, Alert, LogBox, TouchableOpacity,
  TextInput, View, Text
} from 'react-native';

// RN 内核的一个 warning, 太烦人了, 屏蔽掉
if (__DEV__) {
  LogBox.ignoreLogs([/Require cycle:.*fetch.js/]);
}

const upgradeStatus = {};
const serverTmpFile = dirs.Temporary + '/_patch_test_server_config_';
const getDefServer = () => {
  let useLocal = true;
  if (Platform.OS === 'android') {
    const fg = Platform.constants.Fingerprint;
    if (fg.indexOf('generic') > -1 || fg.startsWith('google/sdk_gphone')) {
      useLocal = false;
    }
  } else if (Platform.constants.forceTouchAvailable) {
    useLocal = false;
  }
  return 'http://' + (useLocal ? 'localhost' : '10.0.2.2') + ':8028'
}

const getServer = async () => {
  let config;
  try {
    config = await fs.readFile(serverTmpFile, 'text');
  } catch{};
  if (config) {
    return config;
  }
  return getDefServer();
}

const testServer = async () => {
  if (upgradeStatus.test) {
    return;
  }
  upgradeStatus.test = true;
  try {
    const res = await fetchPlus((await getServer())+ '/test.txt', {
      timeout:4000
    });
    console.log(res)
    if (res.status !== 200) {
      throw 'Http Response: ' + res.status
    }
    const txt = await res.text();
    Alert.alert(txt)
  } catch(err) {
    Alert.alert('Error:' + err)
  }
  upgradeStatus.test = false;
}

const setServer = async (server) => {
  while(server.charAt(server.length-1) === '/') {
    server = server.substring(0, server.length-1);
  }
  if (server !== getDefServer()) {
    await fs.writeFile(serverTmpFile, server);
  }
  await testServer();
  return server;
}

function VersionInfo() {
  const [saveing, setSaving] = React.useState();
  const [server, onServerChange] = React.useState();
  const saveServer = async () => {
    setSaving(true);
    const rs = await setServer(server);
    onServerChange(rs);
    setSaving(false);
  }
  React.useEffect(() => {
    getServer().then(onServerChange);
  }, []);
  return <View style={{
    padding:10,
    marginTop:10,
    backgroundColor:'#eee',
  }}>
    <Text>isFirstTime: {status.isFirstTime ? 'Y' : 'N'}  ------   DEV: {__DEV__ ? 'Y' : 'N'}</Text>
    <Text>currentVersion: {status.currentVersion}</Text>
    <Text>rolledVersion: {status.rolledVersion}</Text>
    <View style={{
      marginTop:4,
      flexDirection:'row',
      justifyContent:'space-between',
    }}>
      <TextInput 
        value={server}
        onChangeText={onServerChange}
        style={{
          flex:1,
          padding:0,
          height:30,
          borderWidth:1,
          borderRightWidth:0,
          borderColor:'green',
          paddingHorizontal:3,
        }} 
      />
      <TouchableOpacity activeOpacity={.85} disabled={saveing} onPress={saveServer} style={{
        height:30,
        alignItems:'center',
        paddingHorizontal:7,
        justifyContent:'center',
        backgroundColor:'green',
        opacity: saveing ? .6 : 1,
      }}><Text style={{color:'#fff'}}>SetServer</Text></TouchableOpacity>
    </View>
  </View>
}

const upgrade = async (version, type) => {
  if (upgradeStatus.process) {
    return;
  }
  upgradeStatus.process = true;
  const platform = Platform.OS;
  try {
    const server = (await getServer()) + '/';
    let patchFile;
    if ('bundle' === type) {
      // 完整 bundle
      patchFile = platform + '.v' + version+ '.zip';
    } else if ('patch' === type) {
      // 相对于安装包的 patch
      patchFile = platform + '.v' + version+ '-patch.zip';
    } else {
      // 相对于上一个版本的 patch
      patchFile = platform + '.v' + (version - 1) + '-v' + version+ '-patch.zip';
    }

    const response = await fetchPlus(server + 'files.json');
    const json = await response.json();
    if (!json[patchFile]) {
      throw 'file not exist:' + patchFile
    }
    const patchMd5 = json[patchFile];
    const tempFile = dirs.Temporary + '/' + patchMd5 + '.zip';
    let md5Version = patchMd5;
    if ('bundle' !== type) {
      const bundleFile = platform+'.v'+version+'.zip';
      md5Version = json[bundleFile]
      if (!md5Version) {
        throw 'file not exist:' + bundleFile
      }
    }

    await fetchPlus({
      url: server + 'output/' + patchFile,
      saveTo: tempFile,
    });
    if ('bundle' === type) {
      await fs.unzipBundle(tempFile, md5Version);
    } else if ('patch' === type) {
      await fs.unzipPatch(tempFile, md5Version, patchMd5);
    } else {
      await fs.unzipDiff(tempFile, md5Version, patchMd5);
    }

    const reload = await new Promise(resolve => {
      Alert.alert("Msg", "Patch has download, reload now?", [{
        text: "Cancel",
        style: "cancel",
        onPress:() => resolve(false)
      }, {
        text: "Yes",
        onPress:() => resolve(true)
      }])
    })
    await fs.switchVersion(md5Version, reload)
  } catch (err) {
    Alert.alert('Error:' + err)
  }
  upgradeStatus.process = false;
}

const upBundle = async (version) => {
  return await upgrade(version, 'bundle');
}

const upPatch = async (version) => {
  return await upgrade(version, 'patch');
}

const upDiff = async (version) => {
  return await upgrade(version, 'diff');
}

const reinitialize = async () => {
  if (upgradeStatus.process) {
    return;
  }
  upgradeStatus.process = true;
  await fs.reinitialize(true);
  upgradeStatus.process = false;
}

module.exports = {
  VersionInfo,
  testServer,
  upBundle,
  upPatch,
  upDiff,
  reinitialize,
};