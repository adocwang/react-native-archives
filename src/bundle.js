const os = require('os');
const path = require('path');
const fs = require('fs-extra');
const g2js = require('gradle-to-js/lib/parser');
const {CInfo, CError, CWarning, errMsg, getRNVersion, runCommand, pack} = require('./utils');

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

// @see https://github.com/facebook/react-native/blob/master/react.gradle
function getHermesCommond(cwd) {
  const bin = getHermesOSBin();
  if (!bin) {
    return null;
  }
  try {
    const hermesPath = fs.existsSync(path.join(cwd, 'node_modules/hermes-engine'))
        ? 'node_modules/hermes-engine'
        : 'node_modules/hermesvm';
    return path.resolve(cwd, hermesPath, bin, 'hermes');
  } catch(e) {
    return null;
  }
}

async function enableHermes(cwd) {
  try {
    const gradleConfig = await g2js.parseFile(path.join(cwd, 'android/app/build.gradle'));
    const projectConfig = gradleConfig['project.ext.react'];
    for (const packagerConfig of projectConfig) {
      if (packagerConfig.includes('enableHermes') && packagerConfig.includes('true')) {
        return true;
      }
    }
  } catch (e) {}
  return false;
}

/**
  生成用于更新的全量 bundle
  cwd: 运行目录
  options: 与 react-native bundle 命令相同 {platform:"android", output:"dirPath", ...}
          一般只需指定 platform/output,  output 可使用相对于 cwd 的目录 或 绝对路径
          不能使用 bundle-output, assets-dest 参数, 改为 --output 统一指定目录
          若需要指定最终输出的文件名, 可使用 save-name 指定
  stdout: 信息输出的 stream
  stderr: 异常输出的 stream
  autoCreate: 若输出目录不存在, 是否自动创建
*/
async function makeBundle(cwd, options, stdout, stderr, autoCreate) {
  if (!options.platform) {
    stderr.write(CError + "platform unspecified\n");
    return;
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
  if (autoCreate) {
    fs.emptyDirSync(path.resolve(cwd, outputFolder));
  }

  // make bundle
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
  try {
    const stdio = ['pipe', stdout, stderr];
    await runCommand('node', args, {cwd, stdio})
    if (options.platform === 'android' && (await enableHermes(cwd))) {
      const hermesCommond = getHermesCommond(cwd);
      if (!hermesCommond) {
        stdout.write(CWarning + "Hermes enabled, but not find hermes-engine\n");
      } else {
        const jsFile = options['bundle-output'];
        stdout.write(CInfo + "Hermes enabled, now compiling to hermes bytecode\n");
        await runCommand(hermesCommond, ['-emit-binary', '-out', jsFile, jsFile, '-O'], {cwd, stdio})
      }
    }
  } catch (e) {
    stderr.write(CError + errMsg(e) + "\n");
    return;
  }

  // make ppk
  const ppkDir = path.resolve(cwd, output, 'output');
  const ppkFile = path.join(ppkDir, saveName);
  stdout.write(CInfo + "make bundle success, packing\n");
  fs.ensureDirSync(ppkDir);
  try {
    await pack(options['assets-dest'], ppkFile)
  } catch (e) {
    stderr.write(CError + errMsg(e) + "\n");
    return;
  }
  stdout.write(CInfo + `saved to: ${ppkFile}\n`);
}

module.exports = makeBundle;