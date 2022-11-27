import {fs, dirs, HttpService} from "./../index";
import React, {useState, useRef, useEffect} from 'react';
import {Text, Platform, TouchableOpacity, ActivityIndicator} from 'react-native';

const IsAndroid = Platform.OS === 'android';

// 测试本地文件最好同时测试 Png 和 Raw, 二者在 Android Release 版本中的打包目录不同
const Assets = {
  LocalPng: require('./files/test.png'),
  LocalRaw: require('./files/str.html'),
  LocalZip: require('./files/test.zip'),
  LocalTtf: require('./files/localFont.ttf'),

  RemotePng: "https://home.baidu.com/Public/img/logo.png",
  RemoteDoc: "https://gitee.com/malaccas/assets/raw/main/archives/hello.docx",
  RemoteJpg: "https://gitee.com/malaccas/assets/raw/main/archives/brige.jpeg",
  RemoteTxt: "https://gitee.com/malaccas/assets/raw/main/archives/str.txt",
  RemoteZip: "https://gitee.com/malaccas/assets/raw/main/archives/file.zip",
};

function prtLog() {
  const args = Array.prototype.slice.call(arguments);
  if (!args.length) {
    return;
  }
  console.log(...args)
}

function showLog() {
  const args = Array.prototype.slice.call(arguments);
  if (!args.length) {
    return;
  }
  if (args.length < 2) {
    console.log(args[0])
    return;
  }
  const tit = args.shift();
  const equal = args.pop();
  args.unshift(tit + (args.length ? ':' : ''));
  args.unshift('【'+(equal ? '✓' : '×')+'】');
  console[equal ? 'log' : 'error'](...args)
}

function unicode(text) {
  text = text ? text.replace(/&#x(\w+);/g, (s, icon) => {
    return String.fromCharCode(parseInt(icon, 16))
  }) : text;
  return text;
}

// 文件系统测试公用路径
const testTemp = {
  testPaths:null
};

// 创建临时文件夹
const makeTmpDir = async (clear) => {
  const dir = dirs.Temporary + '/_arch_tmp_test_967_';
  if (clear) {
    await fs.rmDir(dir, true);
  } else {
    await fs.mkDir(dir);
    await fs.writeFile(dir + '/x.txt', 'abc');
  }
  return dir;
}

// 获取用于测试的 目录 和 文件
const getTestPaths = async (read) => {
  const tmpDir = await makeTmpDir();
  if (read || null === testTemp.testPaths) {
    const files = [];
    const directs = [dirs.Document];
    if (IsAndroid) {
      // android 特殊目录
      const contentPath = await fs.getContentUri('images');
      directs.push('drawable://', 'asset://', 'raw://', contentPath);
    } else {
      // ios 特殊目录

    }
    let lists, file, isDir, hasFile, hasDir, err;
    for (let [index, d] of [tmpDir, ...directs].entries()) {
      err = null;
      try {
        lists = await fs.readDir(d);
      } catch(e) {
        lists = [];
        err = e;
      }
      // readDir 测试
      if (read) {
        if (err) {
          showLog(d, err.message, false);
        } else {
          showLog(d + ':', lists, true);
        }
        continue;
      }
      // 非 readDir 测试
      if (index === 0) {
        continue;
      }
      hasFile = hasDir = false;
      for (file of lists) {
        if (!('path' in file)) {
          continue;
        }
        isDir = !!file.isDir;
        if (isDir && !hasDir) {
          hasDir = true;
          directs.push(file.path);
        } else if(!isDir && !hasFile) {
          hasFile = true;
          files.push(file.path)
        }
        if (hasFile && hasDir) {
          break;
        }
      }
    }
    if (!read) {
      const shareFile = await fs.getShareUri(tmpDir + '/x.txt')
      testTemp.testPaths = {
        dirs: directs.concat([tmpDir]),
        files: files.concat([tmpDir + '/x.txt', shareFile])
      };
    }
  }
  return testTemp.testPaths;
}

function TestButton({android, ios, title, onPress, children, ...props}){
  if (android && !IsAndroid) {
    return null;
  }
  if (ios && IsAndroid) {
    return null;
  }
  const [disable, setDisable] = useState(false);
  const isMounted = useRef(false);
  useEffect(() => {
    isMounted.current = true;
    return () => isMounted.current = false;
  }, []);
  const callPress = async () => {
    // test-start
    console.log('========================' + title + '========================');
    setDisable(true);
    try {
      await onPress();
    } catch(e) {
      // test-error
      if (__DEV__) {
        console.error(e);
      } else {
        console.error(e.message);
      }
    }
    if (isMounted.current) {
      setDisable(false);
      // test-end
      console.log('【 end 】')
    }
  };
  return <TouchableOpacity
    activeOpacity={.8}
    {...props}
    disabled={disable}
    onPress={callPress}
    style={{
      height:32,
      flexDirection:"row",
      justifyContent:"center",
      alignItems:"center",
      borderRadius: 4,
      minWidth: "48%",
      marginVertical:3,
      marginHorizontal:"1%",
      backgroundColor: "rgb(33, 150, 243)",
      opacity: disable ? .8 : null,
    }}
  >
    {disable ? <ActivityIndicator color="#fff" size="small" /> : null}
    <Text style={{color:"#fff"}}>{title}</Text>
    {children}
  </TouchableOpacity>
} 

class TestService extends HttpService {
  withToken(request, token){
    return request.header('x-token', token);
  }
  test(){
    return this.request().payload({t:'test'}).json();
  }
}

function useStateCallback(initialState) {
  const cbRef = useRef(null);
  const [state, setState] = useState(initialState);
  const setStateCallback = React.useCallback((state, cb) => {
    cbRef.current = cb;
    setState(state);
  }, []);
  useEffect(() => {
    if (cbRef.current) {
      cbRef.current(state);
      cbRef.current = null;
    }
  }, [state]);
  return [state, setStateCallback];
}

module.exports = {
  IsAndroid,
  Assets,
  prtLog,
  showLog,
  unicode,
  makeTmpDir,
  getTestPaths,
  TestButton,
  TestService,
  useStateCallback
};