#!/usr/bin/env node
const fs = require('fs');
const path = require('path');
const cliPathRoot = path.resolve(process.cwd(), 'node_modules', 'react-native-archives');

if (process.argv.indexOf('-v') >= 0 || process.argv[2] === 'version') {
  console.log('easypush: ' + require('../package.json').version);
  try {
      console.log('react-native-archives: ' + require(path.resolve(cliPathRoot, 'package.json')).version);
  } catch (e) {
      console.log('react-native-archives: n/a - not inside a React Native project directory')
  }
  process.exit();
}

// 执行 react-native-archives/local-cli 目录的命令
const cliPath = path.resolve(cliPathRoot, 'local-cli');
if (!fs.existsSync(cliPath)) {
  console.error('Are you at home directory of a react-native project and install react-native-archives local?');
  process.exit(1);
}

require(cliPath).run();