#!/usr/bin/env node
'use strict';

const cwd = process.cwd();

const cmd = (function (p) {
  const _ = p.env._||null;
  const npx = _ && _.endsWith('/npx');
  const options = require('minimist')(p.argv.slice(2));
  const command = options._.shift();
  return {npx, command, options};
})(process);

const readline = require('readline');
function ask(question, completions) {
  return new Promise(resolve => {
    const rl = readline.createInterface({
      input: process.stdin,
      output: process.stdout,
      completer: function(line) {
        const hits = completions.filter((c) => c.startsWith(line));
        return [hits.length ? hits : completions, line];
      }
    });  
    rl.setPrompt(question);
    rl.prompt();
    rl.on('line', (data) => {
      rl.close();
      resolve(data);
    });
  })
}

function diffOptions() {
  const options = cmd.options;
  const [origin, next] = options._;
  const output = options.output;
  return {origin, next, output, cmd:true};
}

/** 
  re-make bundle [--platform android --output build --save-name foo.ppk]
  生成 bundle 包
*/
async function bundle() {
  const options = cmd.options;
  if (!options.platform) {
    options.platform = await ask("Platform(ios/android):", ['ios', 'android']);
  }
  require('./src/bundle')(cwd, options, process.stdout, process.stderr, true);
}

/**
  re-make diffapk apkPath bundlePath [--output build/output/foo.apk-patch]
  re-make diffipa apkPath bundlePath [--output build/output/foo.ipa-patch]
  bundle 相对于 apk/ipa 的补丁包
*/
function diffPackage(ios) {
  require('./src/diff').diffPackage(cwd, diffOptions(), process.stdout, process.stderr, ios, true)
}

/**
  re-make diff originPath nextPath [--output build/output/foo.ppk-patch]
  bundle 相对于 bundle 的补丁包
*/
function diffPPK() {
  require('./src/diff').diffPPK(cwd, diffOptions(), process.stdout, process.stderr, true)
}

switch (cmd.command.toLowerCase()) {
  case 'bundle':
    bundle();
    break;
  case 'diffapk':
    diffPackage(false);
    break;
  case 'diffipa':
    diffPackage(true);
    break;
  case 'diff':
    diffPPK();
    break;
  default:
    break;
}
