const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const {execSync} = require("child_process");
const {
  CInfo, CError, errMsg, packIpa, packZip,
  getRNVersion, fileExist, execCommand
} = require('./utils');

// Hermes 平台类型
function getHermesOSBin() {
  const plat = os.platform();
  switch (plat) {
    case 'win32':
      return 'win64-bin';
    case 'darwin':
      return 'osx-bin';
    case 'linux':
      return 'linux64-bin';
    default:
      return null;
  }
}

// 获取 Android gradle project.ext.react 配置
function gradleConfig(cwd) {
  const gradleStr = fs.readFileSync(path.join(cwd, 'android/app/build.gradle')).toString();
  const match = gradleStr.replace(
    /\/\*[\s\S]*?\*\/|\/\/.*/g, ''
  ).match(
    /project\.ext\.react\s*=\s*\[([^\]]*)\]/
  );
  return match ? match[1].split(',') : [];
}

// 确认是否启用了 Hermes 引擎
function isHermesEnable(cwd, platform) {
  try {
    if ('android' === platform) {
      return gradleConfig(cwd).some(
        line => /\benableHermes\s*:\s*true/.test(line)
      );
    } else if (platform === 'ios') {
      const podPath = path.join(cwd, 'ios', 'Podfile');
      const podStr = fileExist(podPath) ? fs.readFileSync(podPath).toString() : null;
      return podStr && /\n[^#]*:?\bhermes_enabled\s*(=>|:)\s*true/.test(podStr);
    }
  } catch (e) {}
  return false;
}

// 获取自定义的 Hermes 引擎
function getGradleHermes(cwd, platform) {
  if (platform && platform !== 'android') {
    return null;
  }
  let hermesCommand;
  gradleConfig(cwd).some(line => {
    const match = line.match(/\bhermesCommand\s*:\s*['|"](.*)['|"]/);
    if (!match) {
      return false;
    }
    hermesCommand = match[1];
    return true;
  });
  if (!hermesCommand || hermesCommand.indexOf('%OS-BIN%') < 0) {
    return null;
  }
  return hermesCommand;
}

// 获取 Hermes 执行文件位置, 参考 react 的代码逻辑
// @see https://github.com/facebook/react-native/blob/master/react.gradle
function getHermesCommond(cwd, platform) {
  try {
    const bin = getHermesOSBin();
    if (!bin) {
      return null;
    }
    const ext = 'win64-bin' === bin ? '.exe' : '';
    // 自定义
    const gradleHermes = getGradleHermes(cwd, platform);
    if (gradleHermes) {
      return path.join(cwd, 'android/app/', gradleHermes.replaceAll("%OS-BIN%", bin) + ext);
    }
    // react-native >= 0.69
    let hermesPath = path.join(
      cwd, "node_modules", "react-native", "sdks", "hermesc", bin, 'hermesc' + ext
    );
    if (fileExist(hermesPath)) {
      return hermesPath;
    }
    // react-native >= 0.63
    hermesPath = path.join(cwd, "node_modules", "hermes-engine", bin, 'hermesc' + ext);
    if (fileExist(hermesPath)) {
      return hermesPath;
    }
    // react-native >= 0.2
    hermesPath = path.join(cwd, "node_modules", "hermes-engine", bin, 'hermes' + ext);
    if (fileExist(hermesPath)) {
      return hermesPath;
    }
    // react-native old
    hermesPath = path.join(cwd, "node_modules", "hermesvm", bin, 'hermes' + ext);
    if (fileExist(hermesPath)) {
      return hermesPath;
    }
    return null
  } catch(e) {}
  return null;
}

/**
  生成 android release apk
  cwd: 运行目录
  options: {target:"release", output:"filePath"}
           target: 可指定编译类型
           output: 相对于 cwd 的输出路径, 应包括 .apk 文件名
  stdout: 信息输出的 stream
  stderr: 异常输出的 stream
*/
async function makeApk(cwd, options, stdout, stderr) {
  try {
    const androidDir = path.join(cwd, 'android');
    const gradlew = path.join(
      androidDir,
      process && process.platform && process.platform.startsWith('win') ? 'gradlew.bat' : './gradlew'
    );
    const {target='release', output} = options||{};
    const args = ['assemble' + target.charAt(0).toUpperCase() + target.slice(1)];
    await execCommand(gradlew, args, {
      cwd:androidDir,
      stdio:['pipe', stdout, stderr]
    });
    let apkFile = path.join(androidDir, `app/build/outputs/apk/${target}/app-${target}.apk`);
    if(output) {
      const destFile = path.join(cwd, output);
      fs.ensureDirSync(path.dirname(destFile));
      fs.copyFileSync(apkFile, destFile);
      apkFile = destFile;
    }
    stdout.write(CInfo + `saved to: ${apkFile}\n`);
    return apkFile;
  } catch(e) {
    stderr.write(CError + errMsg(e) + "\n");
  }
  return false;
}

/**
  生成 ios release ipa
  cwd: 运行目录
  options: {target:"release", output:"filePath"}
           target: 可指定编译类型
           output: 相对于 cwd 的输出路径, 应包括 .ipa 文件名
  stdout: 信息输出的 stream
  stderr: 异常输出的 stream
*/
async function makeIpa(cwd, options, stdout, stderr) {
  try {
    const iosDir = path.join(cwd, 'ios');
    const iosFiles = await fs.readdir(iosDir);
    let buildFile, isWorkspace;
    for (let i = iosFiles.length - 1; i >= 0; i--) {
      const fileName = iosFiles[i];
      const ext = path.extname(fileName);
      if (ext === '.xcworkspace') {
        buildFile = fileName;
        isWorkspace = true;
        break;
      }
      if (ext === '.xcodeproj') {
        buildFile = fileName;
        isWorkspace = false;
      }
    }
    if (!buildFile) {
      throw new Error(`Could not find Xcode project files in "${iosDir}" folder`);
    }
    const {target='release', output='build/output/app-'+target+'.ipa'} = options||{};
    const scheme = path.basename(buildFile, path.extname(buildFile));
    const buildArgs = [
      'build',
      isWorkspace ? '-workspace' : '-project',
      buildFile,
      '-configuration',
      target.charAt(0).toUpperCase() + target.slice(1),
      '-scheme',
      scheme,
      '-sdk',
      `iphoneos`,
    ];
    // 获取 .app 文件的保存路径
    let buildTargetPath;
    const buildSettings = execSync(
      'xcodebuild ' + buildArgs.concat(['-showBuildSettings', '-json']).join(' '),
      {cwd:iosDir, encoding: 'utf8'}
    );
    const settings = JSON.parse(buildSettings);
    for (const i in settings) {
      const wrapperExtension = settings[i].buildSettings.WRAPPER_EXTENSION;
      if (wrapperExtension === 'app') {
        buildTargetPath = settings[i].buildSettings.TARGET_BUILD_DIR + 
                '/' + settings[i].buildSettings.EXECUTABLE_FOLDER_PATH;
        break;        
      }
    }
    if (!buildTargetPath) {
      throw new Error('Failed to get the target build directory.');
    }
    await execCommand('xcodebuild', buildArgs, {
      cwd: iosDir,
      stdio:['pipe', stdout, stderr]
    });
    const releaseIpa = path.join(cwd, output);
    fs.ensureDirSync(path.dirname(releaseIpa));
    await packIpa(buildTargetPath, releaseIpa);
    stdout.write(CInfo + `saved to: ${releaseIpa}\n`);
    return releaseIpa;
  } catch(e) {
    stderr.write(CError + errMsg(e) + "\n");
  }
  return false;
}

/**
  生成全量的 jsBundle
  cwd: 运行目录
  options: 与 react-native bundle 命令参数相同, 如
          {platform:"android", output:"dirPath", "entry-file":"index.js", ...}
          支持参数可参见: https://github.com/react-native-community/cli/blob/main/docs/commands.md#bundle
          但此处对支持参数有所修改
          1. 新增 output 参数, 设置相对于 cwd 的目录的输出目录
             不能使用 bundle-output, assets-dest 参数了, 使用 output 统一指定目录
          2. 新增 save-name 参数, 用于指定最终输出的文件名
  stdout: 信息输出的 stream
  stderr: 异常输出的 stream
*/
async function makeBundle(cwd, options, stdout, stderr) {
  try {
    if (!options.platform) {
      throw new Error('platform unspecified');
    }
    if (!options['output']) {
      options['output'] = 'build';
    }
    if (!options['entry-file']) {
      options['entry-file'] = 'index.js'
    }
    if (!('dev' in options)) {
      options['dev'] = false;
    }
    if (!('reset-cache' in options)) {
      options['reset-cache'] = true;
    }

    let saveName = options['save-name'];
    if (saveName) {
      delete options['save-name'];
    } else {
      saveName = `${options.platform}.${Date.now()}.ppk`;
    }
    const output = options['output'];
    const bundleName = 'index.bundlejs';
    const outputFolder = path.join(output, 'bundle', options.platform);
    delete options['output'];

    options['assets-dest'] = outputFolder;
    options['bundle-output'] = path.join(outputFolder, bundleName);
    fs.emptyDirSync(path.resolve(cwd, outputFolder));
  
    // 准备生成 bundle 的参数
    const version = getRNVersion(cwd).version;
    const args = [
      path.join("node_modules", "react-native", "local-cli", "cli.js"), 
      "bundle"
    ];
    if ('_' in options) {
      args.push(...options._);
      delete options._;
    }
    for (let k in options) {
      args.push('--'+k, options[k])
    }
    stdout.write("Bundling with React Native version: " + version + "\n");
    stdout.write('Running bundle command: node ' + args.join(' ') + "\n");

    // 编译 bundle 并根据配置编译为 hermes 字节码
    const stdio = ['pipe', stdout, stderr];
    await execCommand('node', args, {cwd, stdio});
    if (isHermesEnable(cwd, options.platform)) {
      const hermesCommond = getHermesCommond(cwd, options.platform);
      if (!hermesCommond) {
        stderr.write(CError + "Hermes enabled, but not find hermes-engine\n");
      } else {
        stdout.write(CInfo + "Hermes enabled, now compiling to hermes bytecode\n");
        const jsFile = options['bundle-output'];
        const commandArgs = ['-emit-binary', '-out', jsFile, jsFile, '-O'];
        if ('win32' === os.platform()) {
          commandArgs.unshift('/c');
        }
        await execCommand(hermesCommond, commandArgs, {cwd, stdio})
      }
    }

    // 打包为 zip 格式的 ppk 文件
    const ppkDir = path.resolve(cwd, output, 'output');
    const ppkFile = path.join(ppkDir, saveName);
    stdout.write(CInfo + "make bundle success, packing\n");
    fs.ensureDirSync(ppkDir);
    await packZip(options['assets-dest'], ppkFile);
    stdout.write(CInfo + `saved to: ${ppkFile}\n`);
    return ppkFile;
  } catch(e) {
    stderr.write(CError + errMsg(e) + "\n");
  }
  return false;
}

module.exports = {
  makeApk,
  makeIpa,
  makeBundle
};