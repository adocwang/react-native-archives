#!/usr/bin/env node
const os = require('os');
const path = require('path');
const http = require('http');
const fs = require('fs/promises');
const {execSync} = require("child_process");
const epush = require('react-native-archives/cli');

const buildDir = 'task';
const saveDir = 'output';
const runtimeCache = {};
const STDOUT = process.stdout;
const STDERR = process.stderr;
const interact = new epush.Shell(process);
const cmd = epush.utils.parseProcess(process);
const projectDir = path.join(__dirname, './../');
const releaseIpa = path.join(buildDir, saveDir, 'app-release.ipa');
const releaseApk = path.join(buildDir, saveDir, 'app-release.apk');

// ===================================Server===========================================

// 启动一个 Server 用于客户端下载 buildDir 中的文件
async function StartServer(port) {
  await setFilesHash();
  await createServer(port);
}
async function createServer(port) {
  port = port||8028;
  const root = path.join(projectDir, buildDir);
  http.createServer(function (request, response) {
    const urlIndex = request.url.indexOf('?');
    const url = urlIndex > -1 ? request.url.substring(0, urlIndex) : request.url;
    const filePath = path.join(root, url);
    fs.readFile(filePath).then(content => {
      response.writeHead(200);
      response.end(content);
    }).catch(error => {
      if(error.code == 'ENOENT'){
        response.writeHead(404);
        response.end('404');
      } else {
        response.writeHead(500);
        response.end(error.code);
      }
    });
  }).listen(port);
  const output = ['\u{1F680} Server: http://10.0.2.2:' + port, 'also:'];
  const interfaces = os.networkInterfaces();
  for (var k in interfaces) {
    for (var k2 in interfaces[k]) {
        var address = interfaces[k][k2];
        if (address.family === 'IPv4' && !address.internal) {
          output.push('http://' + address.address + ':' + port);
        }
    }
  }
  process.stdout.write(output.join("\n") + "\n");
}
// 设置 output 下所有 zip 的 hash
async function setFilesHash(){
  const dir = path.join(projectDir, buildDir, saveDir);
  if (!epush.utils.dirExist(dir)) {
    throw new Error(`dir "${dir}" not exist`)
  }
  return fs.readdir(dir).then((files) => {
    const json = {};
    files.forEach(file => {
      if (!file.endsWith('.zip')) {
        return;
      }
      const md5 = epush.utils.fileMd5(path.join(dir, file));
      json[file] = md5;
    });
    return json;
  }).then(json => {
    return fs.writeFile(
      path.join(projectDir, buildDir, 'files.json'),
      JSON.stringify(json)
    )
  }).then(() => {
    return fs.writeFile(
      path.join(projectDir, buildDir, 'test.txt'),
      'test'
    )
  });
}

// ===================================Build===========================================

// 编译 v1 版本 release 的 APK/IPA
async function buildPackage(platform){
  const android = 'android' === platform;
  const build = android ? epush.makeApk : epush.makeIpa;
  STDOUT.write(`\u{1F680} build ${platform} release ${android ? 'apk' : 'ipa'}\n`);
  return await build(projectDir, {
    target:"release", output: android ? releaseApk : releaseIpa
  }, process.stdout, process.stderr);
}

// 修改 src/App.js 为测试用的 v2+ 版本
async function makeAppJs(recover){
  if (recover ? !runtimeCache.appMaked : runtimeCache.appMaked) {
    return;
  }
  const appFile = path.join(__dirname, 'App.js');
  const bakFile = path.join(__dirname, 'App_bak.js');
  if (recover) {
    await fs.unlink(appFile);
    await fs.rename(bakFile, appFile);
  } else {
    await fs.rename(appFile, bakFile);
    const AppCode = `import Version from './source/v';
    export default Version;`;
    await fs.writeFile(appFile, AppCode);
  }
  runtimeCache.appMaked = !recover;
}

// 修改 source/v2+ 为测试版本
async function makeVersionJs(version, recover){
  if (version < 2) {
    return;
  }
  const parent = path.join(__dirname, 'source');
  let dFil = path.join(parent, 'v.js');
  let vFil = path.join(parent, 'v'+version+'.js');
  let dDir = path.join(parent, 'files');
  let kDir = path.join(parent, 'files_');
  let vDir = path.join(parent, 'files'+version);
  if (recover){
    await fs.rename(dFil, vFil);
    await fs.rename(dDir, vDir);
    await fs.rename(kDir, dDir);
    return;
  }
  await fs.rename(vFil, dFil);
  await fs.rename(dDir, kDir);
  await fs.rename(vDir, dDir);
}

// 编译指定版本的 bundle
async function buildBundle(version, platform){
  await makeVersionJs(version);
  let bundle;
  try {
    STDOUT.write("\u{1F680} build bundle version"+version+"\n");
    bundle = await epush.makeBundle(projectDir, {
      platform,
      output:buildDir,
      'save-name':platform + '.v' + version + '.zip',
    }, STDOUT, STDERR);
  }catch(e){};
  await makeVersionJs(version, true);
  return bundle;
}

// 编译所有版本 bundle
async function buildAllBundle(platform){
  let v2, v3;
  const v1 = await buildBundle(1, platform);
  await makeAppJs();
  try {
    v2 = await buildBundle(2, platform);
    v3 = await buildBundle(3, platform);
    v4 = await buildBundle(4, platform);
  } catch(e){}
  await makeAppJs(true);
  return {v1, v2, v3, v4};
}

// 编译 bundle 相对于 安装包 的 patch
async function buildPackagePatch(platform, version){
  STDOUT.write("\u{1F680} build package patch version"+version+"\n");
  const ios = 'ios' === platform;
  const prefix = buildDir + '/' + saveDir + '/' + platform;
  return epush.diffPackage(projectDir, {
    origin: ios ? releaseIpa : releaseApk,
    next: prefix + '.v' + version + '.zip',
    output: prefix + '.v' + version + '-patch.zip'
  }, STDOUT, STDERR, ios);
}

// 编译两个 bundle 的 patch
async function buildBundlePatch(platform, vOrigin, vNext){
  STDOUT.write("\u{1F680} build bundle patch version"+vOrigin+"->"+vNext+"\n");
  const prefix = buildDir + '/' + saveDir + '/' + platform;
  return epush.diffBundle(projectDir, {
    origin: prefix + '.v' + vOrigin + '.zip',
    next: prefix + '.v' + vNext + '.zip',
    output: prefix + '.v' + vOrigin + '-v' + vNext + '-patch.zip'
  }, STDOUT, STDERR);
}

// 编译指定平台的测试用例
async function build(platform) {
  await buildPackage(platform);
  await buildAllBundle(platform);
  await buildPackagePatch(platform, 2);
  await buildBundlePatch(platform, 1, 2);
  await buildBundlePatch(platform, 2, 3);
  await buildBundlePatch(platform, 3, 4);
}

// ===================================Install===========================================

// 获取 adb 路径
function getAdbPath() {
  return process.env.ANDROID_HOME
    ? path.join(process.env.ANDROID_HOME, 'platform-tools', 'adb')
    : 'adb';
}

// 获取 android 设备列表
function getAdbDevices(adbPath) {
  try {
    const result = execSync(`${adbPath} devices`, {encoding: 'utf8'});
    if (!result) {
      return [];
    }
    const devices = [];
    const lines = result.trim().split(/\r?\n/);
    for (let i = 0; i < lines.length; i++) {
      const words = lines[i].split(/[ ,\t]+/).filter(w => w !== '');
      if (words[1] === 'device') {
        devices.push(words[0]);
      }
    }
    return devices;
  } catch (e) {
    return [];
  }
}

// 获取 android 的默认启动的 activity
async function getAndroidActivity(){
  const manifestPath = path.join(projectDir, 'android/app/src/main/AndroidManifest.xml');
  const androidManifest = await fs.readFile(manifestPath, 'utf8');
  const packageNameMatch = androidManifest.match(/package="(.+?)"/);
  const packageName = packageNameMatch && packageNameMatch.length ? packageNameMatch[1] : null;
  if (!packageName || !/^[a-z][a-z0-9_]*(\.[a-z][a-z0-9_]*)+$/i.test(packageName)) {
    throw new Error('No android package name found')
  }
  return packageName + '/' + packageName + '.MainActivity';
}

// 安装到 android
async function installAndroid(release){
  const adbPath = getAdbPath();
  const devices =  getAdbDevices(adbPath);
  if (!devices.length) {
    throw new Error('Can not find launched android device')
  }
  let device;
  if (devices.length > 1) {
    devices.forEach((name, index) => {
      STDOUT.write(epush.utils.color(index+':', 36, true) + ' ' + name + "\n");
    });
    const choose = await interact.ask('type device number:');
    const chooseInt = parseInt(choose);
    if (typeof chooseInt !== "number" || !isFinite(chooseInt) ||
        Math.floor(chooseInt) !== chooseInt
    ){
      throw new Error('Can not find selected device')
    }
    device = devices[chooseInt];
  } else {
    device = devices[0];
  }
  // debug
  if (!release) {
    const debugArgs = ['android'];
    if (device) {
      debugArgs.push("--deviceId", device);
    }
    return await epush.utils.execCommand('yarn', debugArgs, {
      cwd:projectDir,
      stdio:['pipe', process.stdout, process.stderr]
    });
  }
  // release
  if (!epush.utils.fileExist(releaseApk)) {
    throw new Error('Not found apk file, run `yarn task build android` first')
  }
  const activity = await getAndroidActivity();
  const installArgs = ['install', '-r', '-d', releaseApk];
  if (device) {
    installArgs.unshift('-s', device);
  }
  await epush.utils.execCommand(adbPath, installArgs, {
    cwd:projectDir,
    stdio:['pipe', process.stdout, process.stderr]
  });
  const startArgs = ['shell', 'am', 'start', '-n', activity];
  if (device) {
    startArgs.unshift('-s', device);
  }
  return await epush.utils.execCommand(adbPath, startArgs, {
    cwd:projectDir,
    stdio:['pipe', process.stdout, process.stderr]
  });
}

// 获取 ios 设备列表
function getIosDevices() {
  let devices, simctls = [];
  try {
    devices = getIOSDevicesListNew();
  } catch {
    devices = getIOSDevicesListOld();
  }
  try {
    const text = execSync('xcrun simctl list --json devices', {encoding: 'utf8'});
    const simulators = JSON.parse(text).devices;
    for (let key in simulators) {
      if (!key.includes('iOS') && !key.includes('tvOS')) {
        continue;
      }
      // 仅保留已打开的设备
      simulators[key].forEach(item => {
        if (item.state !== 'Booted') {
          return;
        }
        simctls.push(item.udid);
      })
    }
  } catch {}
  const booteds = [];
  if (Array.isArray(devices)) {
    devices.forEach(item => {
      if (item.type === 'device') {
        booteds.push(item);
      } else if (item.type === 'simulator' && simctls.includes(item.udid)) {
        booteds.push(item);
      }
    })
  }
  return booteds;
}
function getIOSDevicesListNew() {
  const text = execSync('xcrun xctrace list devices', {encoding: 'utf8'});
  const devices = [];
  let isSimulator = false;
  if (text.indexOf('== Simulators ==') === -1) {
    return [];
  }
  text.split('\n').forEach((line) => {
    if (line === '== Simulators ==') {
      isSimulator = true;
    }
    const device = line.match(/(.*?) (\(([0-9.]+)\) )?\(([0-9A-F-]+)\)/i);
    if (device) {
      const [, name, , version, udid] = device;
      const metadata = {name, udid};
      if (version) {
        metadata.version = version;
        metadata.type = isSimulator ? 'simulator' : 'device';
      } else {
        metadata.type = 'catalyst';
      }
      devices.push(metadata);
    }
  });
  return devices;
}
function getIOSDevicesListOld() {
  const text = execSync('xcrun instruments -s', {encoding: 'utf8'});
  const devices = [];
  text.split('\n').forEach((line) => {
    const device = line.match(
      /(.*?) (\(([0-9.]+)\) )?\[([0-9A-F-]+)\]( \(Simulator\))?/i,
    );
    if (device) {
      const [, name, , version, udid, isSimulator] = device;
      const metadata = {name, udid};
      if (version) {
        metadata.version = version;
        metadata.type = isSimulator ? 'simulator' : 'device';
      } else {
        metadata.type = 'catalyst';
      }
      devices.push(metadata);
    }
  });
  return devices;
}

// 安装到 ios
async function installIos(release){
  const devices = getIosDevices();
  if (!devices.length) {
    throw new Error('Can not find launched ios device')
  }
  let device;
  if (devices.length > 1) {
    devices.forEach((item, index) => {
      STDOUT.write(
        epush.utils.color(index+':', 36, true) + ' ' + 
        `[${item.type}] ${item.name} (version: ${item.version})` + "\n"
      );
    });
    const choose = await interact.ask('type device number:');
    const chooseInt = parseInt(choose);
    if (typeof chooseInt !== "number" || !isFinite(chooseInt) ||
        Math.floor(chooseInt) !== chooseInt
    ){
      throw new Error('Can not find selected device')
    }
    device = devices[chooseInt];
  } else {
    device = devices[0];
  }
  const isSimulator = 'simulator' === device.type;
  if (!release || isSimulator) {
    const installArgs = ['ios', '--udid', device.udid];
    if (release) {
      installArgs.push('--configuration', 'release');
    }
    return await epush.utils.execCommand('yarn', installArgs, {
      cwd:projectDir,
      stdio:['pipe', process.stdout, process.stderr]
    });
  }
  // 安装 release 到真机: 与 RN 命令保持一致, 使用 ios-deploy 安装
  if (!epush.utils.fileExist(releaseIpa)) {
    throw new Error('Not found apk file, run `yarn task build ios` first')
  }
  try {
    execSync(
      'ios-deploy --version',
      {encoding: 'utf8'}
    );
  } catch {
    throw new Error(
      '"ios-deploy" command not found. Please "npm install -g ios-deploy" and try again.'
    );
  }
  await epush.utils.execCommand('ios-deploy', [
    '--bundle',
    releaseIpa,
    '--id',
    device.udid,
  ], {
    cwd:projectDir,
    stdio:['pipe', process.stdout, process.stderr]
  });
}

// 安装并运行测试包
async function launch(platform) {
  const release = cmd.args[1] && 'release' === cmd.args[1];
  if ('android' === platform) {
    await installAndroid(release);
  } else {
    await installIos(release);
  }
  await StartServer();
}

// ==============================================================================

async function build_android() {
  await build('android');
}
async function build_ios() {
  await build('ios');
}
run_android.options = '[release]';
async function run_android() {
  await launch('android')
}
run_ios.options = '[release]';
async function run_ios() {
  await launch('ios')
}
async function server() {
  await StartServer();
}
interact.getCommandsExecuter([
  build_android, build_ios,
  run_android, run_ios,
  server
], {...cmd, usage:"task <command>"})();
