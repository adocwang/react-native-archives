# react-native-archives

## 说明

项目源码修改自 [react-native-pushy](https://github.com/reactnativecn/react-native-pushy)


## 安装

`yarn add [-g] easypush`

`yarn add react-native-archives`


## 命令行

命令行 `easypush` 查看可用命令

若未全局安装， `npx easypush` 替代即可

可使用命令行完成 js包/补丁 的生成，并上传到服务器，服务端需要实现的接口参见 [api.js](local-cli/api.js#L41)，自行实现即可

## 客户端

1. 提供了 `downloadRootDir` / `packageVersion` / `currentVersion` / `isFirstTime` / `isRolledBack` 变量 

2. 提供了 `bsPatch` / `unzipFile` / `unzipPatch` / `unzipDiff` / `switchVersion` / `markSuccess` 函数

3. 可理解为一个工具包，具体更新逻辑需在客户端中自行实现。注意：原生部分剔除了下载文件的相关的代码，需自行使用 rn-fs 之类的扩展下载文件，

4. 使用方法可参见 [简单说明](index.js#L5)






