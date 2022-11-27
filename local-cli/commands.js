
const ora = require('ora');
const path = require('path');
const Shell = require('./shell');
const CommandAPI = require('./api');
const {supportPlatforms, color, parseProcess, setConfig} = require('./utils');

// 当前命令的 cwd api cmd{name args options} interact
const cwd = process.cwd();
const api = new CommandAPI(cwd);
const cmd = parseProcess(process);
const interact = new Shell(process);

// Manage Account ===================================================================================

// 初始化, 配置 baseUrl
init.options = 'base_url';
async function init() {
  let baseUrl = cmd.args.length ? cmd.args[0] : null;
  baseUrl = baseUrl||await interact.ask("base url:");
  return interact.showResult({code:0, message:'saved to: ' + path.basename(setConfig(cwd, {baseUrl}))})
}

// 登陆
login.options = '--user user --pwd pwd';
async function login() {
  let {user, pwd} = cmd.options;
  user = user || await interact.ask("username:");
  pwd = pwd || await interact.ask("password:");
  return interact.showResult(await api.login(user, pwd))
}

// 查看当前登陆的账号
async function whoami() {
  return interact.showResult(await api.whoami())
}

// Manage App ===================================================================================

// 列出所有 app
app_list.options = '[--platform platform]';
async function app_list() {
  const list = await api.listApp(await interact.getPlatform(cmd.options.platform));
  if (interact.showError(list)) {
    return list;
  }
  const {data=[]} = list;
  const table = data.map((item, index) => {
    const row = {id:index, name:item.name, version:item.version, create_at:item.create_at};
    row.ios = (item.ios && item.ios_md5 ? 'Y' : 'N');
    if (item.ios_current) {
      row.ios = color(row.ios + '*', 36, true)
    }
    row.android = (item.android && item.android_md5 ? 'Y' : 'N');
    if (item.android_current) {
      row.android = color(row.android + '*', 36, true)
    }
    return row;
  });
  interact.showTable(table);
  return list;
}

// 新增 app
app_add.options = '--name name --version version';
async function app_add() {
  let {name, version} = cmd.options;
  name = name || await interact.ask("app name:");
  version = version || await interact.ask("app version:");
  return interact.showResult(await api.addApp(name, version))
}

// 将当前项目与服务端指定的 app 绑定
app_bind.options = '--platform platform';
async function app_bind() {
  const list = await app_list();
  const {data=[]} = list;
  const platform = await interact.getPlatform(cmd.options.platform, true);
  const id = await interact.getRealId("app id:", data);
  return interact.showResult(supportPlatforms.includes(platform) 
    ? {code:0, message:'saved to: ' + path.basename(setConfig(cwd, {[platform]:id}))}
    : {code:-1, message:'platform not support'}
  );  
}

// 上传 app 包
app_upload.options = '--platform platform --package package_path';
async function app_upload() {
  let {platform, package:pack} = cmd.options;
  platform = await interact.getPlatform(platform, true);
  pack = pack || await interact.askPath("package path:", cwd);
  const spinner = ora({
    text:'uploading...',
    stream: process.stdout
  }).start();
  const rs = await api.uploadApp(platform, path.join(cwd, pack));
  spinner.stop();
  return interact.showResult(rs)
}

// Manage Patch ===================================================================================

// 列出所有 patch
patch_list.options = '--platform platform';
async function patch_list() {
  const list = await api.listPatch(await interact.getPlatform(cmd.options.platform, true));
  if (interact.showError(list)) {
    return list;
  }
  const {data=[]} = list;
  const table = data.map((item, index) => {
    const row = {id:index, version:item.version, create_at:item.create_at};
    row.active = (item.active ? color('Y', 36, true) : 'N');
    row.desc = item.desc ? item.desc.substr(0, 20) + '...' : '';
    return row;
  });
  interact.showTable(table);
  return list;
}

// 新增 patch 包
patch_upload.options = '--platform platform [--bundle bundle_path]';
async function patch_upload() {
  let {platform, version, bundle} = cmd.options;
  platform = await interact.getPlatform(platform, true);
  if (!bundle) {
    interact.output("\n  You did not define bundle path\n")
    const go = (await interact.ask('create new bundle? [Y|n|e]:')).toLowerCase();
    if (go === 'e') {
      process.exit();
    }
    if (go === 'n') {
      bundle = await interact.askPath('set bundle path:');
    }
  }
  return interact.showResult(await api.makeAndUploadPatch(cwd, platform, bundle, version, process.stdout, process.stderr))
}

// 绑定 patch
patch_bind.options = '--platform platform';
async function patch_bind() {
  let {platform} = cmd.options;
  platform = await getPlatform(platform, true);
  const list = await patch_list_table(platform);
  const {data=[]} = list;
  const id = await getRealId(data, "patch id:");
  return showApiRs(await api.bindPatch(cwd, platform, id))
}


// Build Tool ===================================================================================

// 生成 android release apk 包
apk.options = '[--target target --output save_path]';
async function apk() {
  return require('./pack').makeApk(cwd, packOptions(), process.stdout, process.stderr);
}

// 生成 ios release ipa 包
ipa.options = '[--target target --output save_path]';
async function ipa() {
  return require('./pack').makeIpa(cwd, packOptions(true), process.stdout, process.stderr);
}

// 生成 bundle 包
bundle.options = '--platform platform [--output save_dir --save-name save_name]';
async function bundle() {
  const options = cmd.options;
  options.platform = await interact.getPlatform(options.platform, true);
  return await require('./pack').makeBundle(cwd, options, process.stdout, process.stderr);
}

// 生成两个文件的 diff patch
diff.options = 'origin_file new_file [--output save_name]';
async function diff() {
  return require('./patch').diff(cwd, await diffOptions('file'), process.stdout, process.stderr)
}

// 生成 bundle 相对于 apk 的补丁包
diffapk.options = 'origin_apk new_bundle [--output save_name]';
async function diffapk() {
  return require('./patch').diffPackage(cwd, await diffOptions('apk'), process.stdout, process.stderr, false)
}

// 生成 bundle 相对于 ipa 的补丁包
diffipa.options = 'origin_ipa new_bundle [--output save_name]';
async function diffipa() {
  return require('./patch').diffPackage(cwd, await diffOptions('ipa'), process.stdout, process.stderr, true)
}

// 生成 bundle 相对于 bundle 的补丁包
diffbundle.options = 'origin_bundle new_bundle [--output save_name]';
async function diffbundle() {
  return require('./patch').diffBundle(cwd, await diffOptions('bundle'), process.stdout, process.stderr)
}

// 获取 apk/ipa 命令 options
function packOptions(ipa) {
  const {target='release', output, ...options} = cmd.options||{};
  options.target = target;
  if (!output) {
    options.output = 'build/output/app-' + target + '.' + (ipa ? 'ipa' : 'apk');
  }
  return options;
}

// 获取 diff 命令 options
async function diffOptions(type) {
  let [origin, next] = cmd.args;
  const output = cmd.options.output;
  origin = origin || await interact.askPath(`origin ${type} path:`, cwd);
  next = next || await interact.askPath(type === 'file' ? 'new file path:' : 'new bundle path:', cwd);
  return {origin, next, output, cmd:true};
}

// exports ===================================================================================

module.exports = interact.getCommandsExecuter([
  'Manage Account',
  init,
  login,
  whoami,

  'Manage App',
  [app_list],
  app_add,
  app_bind,
  app_upload,

  'Manage Patch',
  [patch_list],
  patch_upload,
  patch_bind,

  'Build Tool',
  apk,
  ipa,
  bundle,
  diff,
  diffapk,
  diffipa,
  diffbundle,
], {...cmd, showLogo:true});