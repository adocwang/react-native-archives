const cwd = process.cwd();
const fs = require('fs');
const ora = require('ora');
const api = require('./api');
const path = require('path');
const readline = require('readline');
const {
  supportPlatforms, getCacheDir, 
  color, CInfo, CError, errMsg, 
  getCommonPath, makeTable, download
} = require('./utils');

const cmd = (function (p) {
  const _ = p.env._||null;
  const npx = _ && _.endsWith('/npx');
  const options = require('minimist')(p.argv.slice(2));
  const command = options._.shift();
  return {npx, command, options};
})(process);

function completerPath(line) {
  return getCommonPath(cwd, line)
}

function ask(question, completions) {
  return new Promise(resolve => {
    const rlConfig = {
      input: process.stdin,
      output: process.stdout
    }
    if (completions) {
      if (Array.isArray(completions)) {
        rlConfig.completer = function(line) {
          const hits = completions.filter((c) => c.startsWith(line));
          return [hits.length ? hits : completions, line];
        }
      } else {
        rlConfig.completer = completions;
      }
    }
    const rl = readline.createInterface(rlConfig);  
    rl.setPrompt(question);
    rl.prompt();
    rl.on('line', (data) => {
      rl.close();
      resolve(data);
    });
  })
}

async function getPlatform(platform, required){
  if (!required && !platform) {
    return null;
  }
  platform = platform || await ask("platform:", supportPlatforms);
  if (supportPlatforms.indexOf(platform) == -1) {
    console.log(`${CError}only support (${supportPlatforms.join('/')}), please type again`);
    return await getPlatform(null, true);
  }
  return platform;
}

function showTable(table) {
  if (!table.length) {
    console.log(`${CError}:No result`);
    return;
  }
  const keys = Object.keys(table[0]);
  const data = [keys.map(k => color(k, 32)), '-'];
  table.forEach(item => {
    const row = [];
    keys.forEach(k => {
      row.push(item[k])
    })
    data.push(row);
  });
  process.stdout.write("\n" + makeTable(data) + "\n\n")
}

function showError(rs){
  const {code, message} = rs||{};
  const isNumberCode = typeof code === 'number';
  if (!isNumberCode || rs.code !== 0) {
    console.log(isNumberCode ? `${CError}[${rs.code}]:${message ? message : 'unknown'}` : rs);
    return true;
  }
  return false;
}

function showApiRs(rs){
  if (!showError(rs)) {
    const {code, message} = rs||{};
    console.log(`${CInfo}${message ? message : 'success'}`);
  }
  return rs;
}

async function getRealId(list, msg){
  let id = await ask(msg);
  id = parseInt(id);
  if(typeof id !== "number" || !isFinite(id) || !Math.floor(id) === id) {
    id = null;
  }
  if (id === null || id >= list.length) {
    console.log(`${CError}not exist, please type again`)
    return await getRealId(list, msg);
  }
  return list[id].id;
}


// auth ======================================================================

// 初始化, 配置 baseUrl
async function init() {
  let baseUrl = cmd.options._.length ? cmd.options._[0] : null;
  baseUrl = baseUrl||await ask("base url:");
  showApiRs(api.init(cwd, baseUrl))
}
init.options = 'base_url';

// 登陆
async function login() {
  let {user, pwd} = cmd.options;
  user = user || await ask("username:");
  pwd = pwd || await ask("password:");
  return showApiRs(await api.login(cwd, user, pwd))
}
login.options = '--user user --pwd pwd'

// 查看当前登陆的账号
async function whoami() {
  return showApiRs(await api.whoami(cwd))
}


// app ======================================================================

// 列出所有 app
async function app_list() {
  let {platform} = cmd.options;
  platform = await getPlatform(platform);
  const list = await api.listApp(cwd, platform);
  if (showError(list)) {
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
  showTable(table);
  return list;
}
app_list.options = '[--platform platform]'

// 新增 app
async function app_add() {
  let {name, version} = cmd.options;
  name = name || await ask("app name:");
  version = version || await ask("app version:");
  return showApiRs(await api.addApp(cwd, name, version))
}
app_add.options = '--name name --version version'

// 绑定当前项目的 app
async function app_bind() {
  const list = await app_list();
  const {data=[]} = list;
  let {platform} = cmd.options;
  platform = await getPlatform(platform, true);
  const id = await getRealId(data, "app id:")
  return showApiRs(await api.bindApp(cwd, platform, id))
}
app_bind.options = '--platform platform'

// 上传 app 包
async function app_upload() {
  let {platform, package:pack} = cmd.options;
  platform = await getPlatform(platform, true);
  pack = pack || await ask("package path:", completerPath);
  const spinner = ora({
    text:'uploading...',
    stream: process.stdout
  }).start();
  const rs = await api.uploadApp(cwd, platform, path.join(cwd, pack));
  spinner.stop();
  showApiRs(rs)
}
app_upload.options = '--platform platform --package package_path'



// patch ======================================================================
async function patch_list_table(platform) {
  const list = await api.listPatch(cwd, platform);
  if (showError(list)) {
    return list;
  }
  const {data=[]} = list;
  const table = data.map((item, index) => {
    const row = {id:index, version:item.version, create_at:item.create_at};
    row.active = (item.active ? color('Y', 36, true) : 'N');
    row.desc = item.desc ? item.desc.substr(0, 20) + '...' : '';
    return row;
  });
  showTable(table);
  return list;
}

// 列出所有 patch
async function patch_list() {
  let {platform} = cmd.options;
  platform = await getPlatform(platform, true);
  return await patch_list_table(platform);
}
patch_list.options = '--platform platform'

// 新增 patch
async function patch_add() {
  let {platform, version, bundle} = cmd.options;
  platform = await getPlatform(platform, true);
  version = version || await ask("version:");
  if (!bundle) {
    console.log("\n  You did not define bundle path\n")
    const go = (await ask('create new bundle? [Y|n|e]:')).toLowerCase();
    if (go === 'e') {
      process.exit();
      return;
    } else if (go === 'n') {
      bundle = await ask('set bundle path:', completerPath);
    }
  }
  return showApiRs(await api.makeAndUploadPatch(cwd, platform, bundle, version, process.stdout, process.stderr))
}
patch_add.options = '--platform platform --version version [--bundle bundle_path]'

// 绑定 patch
async function patch_bind() {
  let {platform} = cmd.options;
  platform = await getPlatform(platform, true);
  const list = await patch_list_table(platform);
  const {data=[]} = list;
  const id = await getRealId(data, "patch id:");
  return showApiRs(await api.bindPatch(cwd, platform, id))
}
patch_bind.options = '--platform platform'



// tool ======================================================================
async function diffOptions(type) {
  const options = cmd.options;
  const output = options.output;
  let [origin, next] = options._;
  origin = origin || await ask(`origin ${type} path:`, completerPath);
  next = next || await ask('new bundle path:', completerPath);
  return {origin, next, output, cmd:true};
}

// 生成 bundle 包
async function bundle() {
  const options = cmd.options;
  options.platform = await getPlatform(options.platform, true);
  return await require('./bundle')(cwd, options, process.stdout, process.stderr, true);
}
bundle.options = '--platform platform [--output save_dir --save-name save_name]'

// 生成 bundle 相对于 apk 的补丁包
async function diffapk() {
  return require('./diff').diffPackage(cwd, await diffOptions('apk'), process.stdout, process.stderr, false, true)
}
diffapk.options = 'origin_apk new_bundle [--output save_name]';

// 生成 bundle 相对于 ipa 的补丁包
async function diffipa() {
  require('./diff').diffPackage(cwd, await diffOptions('ipa'), process.stdout, process.stderr, true, true)
}
diffipa.options = 'origin_ipa new_bundle [--output save_name]';

// 生成 bundle 相对于 bundle 的补丁包
async function diff() {
  require('./diff').diffPPK(cwd, await diffOptions('bundle'), process.stdout, process.stderr, true)
}
diff.options = 'origin_bundle new_bundle [--output save_name]';


// run ======================================================================

const support = {
  init,
  login,
  whoami,
  app:{
    default: app_list,
    list: app_list,
    add: app_add,
    bind: app_bind,
    upload: app_upload
  },
  patch:{
    default: patch_list,
    list: patch_list,
    add: patch_add,
    bind: patch_bind
  },
  bundle,
  diffapk,
  diffipa,
  diff
};


function run() {
  let command = cmd.command ? cmd.command.toLowerCase() : null;
  command = command && command in support ? support[command] : null;
  if (command && typeof command === 'object') {
    const sub = cmd.options._.length ? cmd.options._[0].toLowerCase() : null;
    command = sub && sub in command ? command[sub] : command.default;
  }
  if (command) {
    return command();
  }
  let mut = false;
  const prefix = " ".repeat(2);
  console.log("\n  Usage: easypush <command> [options]\n")
  for (let k in support) {
    if (typeof support[k] === 'object') {
      mut = true;
      console.log('')
      for (let s in support[k]) {
        if (s !== 'default') {
          console.log(prefix + color(k + ' ' + s, 32) + (support[k][s].options ? ' ' + color(support[k][s].options, 90) : ''))
        }
      }
    } else {
      if (mut) {
        mut = false;
        console.log('')
      }
      console.log(prefix + color(k, 32) + (support[k].options ? ' ' + color(support[k].options, 90) : ''))
    }
  }
  console.log('');
}

module.exports = run;
