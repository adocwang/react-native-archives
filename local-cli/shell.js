/*
    ______                 ____             __
   / ________ ________  __/ __ \__  _______/ /_
  / __/ / __ \/ ___/ / / / /_/ / / / / ___/ __ \
 / /___/ /_/ (__  / /_/ / ____/ /_/ (__  / / / /
/_____/\__,_/____/\__, /_/    \__,_/____/_/ /_/
                 /____/    Version X
*/
const fs = require('fs');
const readline = require('readline');
const {
  supportPlatforms, color, CInfo, CError,
  getEasyVersion, getCommonPath, makeTable
} = require('./utils');

class Shell {
  constructor(IO){
    const {stdin, stdout} = IO||{};
    this.stdin = stdin;
    this.stdout = stdout;
  }

  // 输出字符串
  output(message){
    this.stdout.write(message);
  }

  // AsciiLogo
  async asciiLogo(pad, output){
    const fileStream = fs.createReadStream(__filename);
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    let logo = '';
    let index = 0;
    const prefix = " ".repeat(pad);
    for await (let line of rl) {
      index++;
      if (index < 2) {
        continue;
      }
      let version = '';
      const vIndex = line.indexOf('Version X');
      if (vIndex > -1) {
        version = getEasyVersion();
        line = line.substring(0, vIndex);
        version = color('Version '+version, 90);
      }
      logo += prefix + color(line, 33) + version + "\n";
      if (index > 6) {
        break;
      }
    }
    rl.close();
    if (output) {
      this.output(logo);
    }
  }

  // 获取命令行输入
  async ask(question, completions) {
    const self = this;
    return new Promise(resolve => {
      const rlConfig = {
        input: self.stdin,
        output: self.stdout
      }
      if (completions) {
        if (Array.isArray(completions)) {
          rlConfig.completer = function(prefix) {
            const hits = completions.filter((c) => c.startsWith(prefix));
            return [hits.length ? hits : completions, prefix];
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

  // 获取命令行输入的路径, 在输入时可使用 Tab 快速补全
  async askPath(question, rootDir) {
    return await this.ask(question, (prefix) => getCommonPath(rootDir, prefix));
  }

  // 从命令行或输入获得所选平台
  async getPlatform(platform, required){
    const self = this;
    if (!required && !platform) {
      return null;
    }
    platform = platform || await self.ask("platform:", supportPlatforms);
    if (supportPlatforms.indexOf(platform) == -1) {
      self.output(`${CError}only support (${supportPlatforms.join('/')})\n`);
      return await self.getPlatform(null, true);
    }
    return platform;
  }

  // 从 list 中选一个 id 序号
  async getRealId(msg, list){
    const self = this;
    let id = await self.ask(msg);
    id = parseInt(id);
    if(typeof id !== "number" || !isFinite(id) || !Math.floor(id) === id) {
      id = null;
    }
    if (id === null || id >= list.length) {
      self.output(`${CError}not exist, please type again\n`)
      return await self.getRealId(msg, list);
    }
    return list[id].id;
  }

  // 将 datas 数据输出为 Table 格式 
  showTable(datas) {
    const self = this;
    if (!datas.length) {
      self.output(`\n${CInfo}No result\n\n`);
      return;
    }
    const keys = Object.keys(datas[0]);
    const list = [keys.map(k => color(k, 32)), '-'];
    datas.forEach(item => {
      const row = [];
      keys.forEach(k => {
        row.push(item[k])
      })
      list.push(row);
    });
    self.output("\n" + makeTable(list) + "\n\n")
  }

  // 显示 API 错误信息
  showError(result) {
    const self = this;
    const {code, message} = result||{};
    const isNumberCode = typeof code === 'number';
    if (!isNumberCode || code !== 0) {
      self.output(`${CError}[${code}] ${message||'unknown'}\n`);
      return true;
    }
    return false;
  }

  // 显示 API 返回结果
  showResult(result){
    const self = this;
    if (!self.showError(result)) {
      const message = (result||{}).message;
      self.output(`${CInfo}${message||'success'}\n`);
    }
    return result;
  }

  // 获取当前命令行的执行函数
  // cmd: {name, args, usage?, showLogo?}
  getCommandsExecuter(commands, cmd){
    // 整理所有命令
    let maxNameLen = 0;
    const forList = [];
    const forSearch = {};
    commands.forEach(item => {
      if ('string' === typeof item) {
        forList.push(item);
      } else {
        const isDef = Array.isArray(item);
        const command = isDef ? item[0] : item;
        let name = command.name;
        maxNameLen = Math.max(maxNameLen, name.length + (isDef ? 2 : 0))
        if (name.indexOf('_') > -1) {
          const [main, sub] = name.split('_');
          if (!forSearch[main]) {
            forSearch[main] = {default:null, list:{}};
          }
          forSearch[main].list[sub] = command;
          if (isDef) {
            forSearch[main].default = command;
            name = main + ' [' + sub + ']';
          } else {
            name = main + ' ' + sub;
          }
        } else {
          forSearch[name] = command;
        }
       forList.push([name, command.options]);
      }
    });
    // 找到可用的命令
    const exec = cmd.name ? cmd.name.toLowerCase() : null;
    if (forSearch[exec]) {
      if (typeof forSearch[exec] === 'function') {
        return forSearch[exec];
      }
      const sub = cmd.args.length ? cmd.args[0].toLowerCase() : null;
      if (!sub && forSearch[exec].default) {
        return forSearch[exec].default;
      }
      if (sub && forSearch[exec].list[sub]) {
        return forSearch[exec].list[sub];
      }
    }
    // 输出所有命令
    const self = this;
    const prefix = " ".repeat(2);
    const cname = (name) => {
      name = prefix + name + " ".repeat(maxNameLen - name.length + 1);
      return color(name, 32, true);
    };
    const cops = (options) => {
      return (options ? color(options, 90) : '') + "\n";
    };
    return async () => {
      if (cmd.showLogo) {
        self.output("\n");
        await self.asciiLogo(1, true);
      }
      if (exec) {
        self.output(`\n  Command [${exec}] not found!`);
      }
      self.output(
        "\n  Usage: "
        + color(cmd.usage||"easypush <command> [options]", 0, true)
        + "\n\n"
      );
      let firstLine = true;
      forList.forEach(item => {
        if (!Array.isArray(item)) {
          self.output((firstLine ? '' : "\n") + "  " + color(item, 33) + "\n");
        } else {
          self.output(cname(item[0]) + cops(item[1]))
        }
        if (firstLine) {
          firstLine = false;
        }
      });
      self.output("\n");
    }
  }
}

module.exports = Shell;