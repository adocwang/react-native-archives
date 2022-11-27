# 安装

```
// 转到测试目录, 安装 npm 依赖
$ cd examples/ArchivesDemo
$ yarn

// 安装 ios Pod
$ cd ios && pod install
```

若测试已经上传到 npm 的包，只需将 [package.json](package.json) 中 `react-native-archives` 的版本从 `link:../..` 修改为具体版本，然后通过 `yarn` 重新安装依赖即可。


# 测试

1 生成用于测试的安装包和补丁包

```
yarn task build ios
yarn task build android
```

2 打开模拟器或连接真机(真机需和电脑在一个局域网)，安装并运行测试包。


```
yarn task run ios [release]
yarn task run android [release]
```

安装测试包后会自动启动本地 server, 若中途退出, 可仅启动本地 server 用于提供热更包获取

```
yarn task server
```

## 关于真机调试

在执行 `yarn task build ios` 或 `使用真机测试` 前需要以下设置

### **Android**

参考 [文档](https://developer.android.com/studio/debug/dev-options?hl=zh-cn) 在手机上启用开发者选项和 USB 调试，启用后使用 USB 连接电脑，然后在电脑上打开命令行工具，执行命令 `adb devices`，在手机弹出的 `允许USB调试吗` 对话框中点击确定，再次执行 `adb devices` 可以看到设备即代表连接成功。

### **iOS**

以下操作是在 `xcode 12.5` 进行的，不同版本可能稍有不同。

使用 USB 连接移动设备和电脑，并选择信任，打开 xcode 并在菜单中点击 `Window -> Devices and Simulators`，在弹出的窗口中可以看到真机，即代表连接成功。

使用 xcode 打开项目 ios 目录，打开后点击左侧 `TARGETS` 下的项目，然后在右侧 `Signing & Capabilities` 选项卡下，设置 `Team`，可使用普通 [Apple 账号](https://appleid.apple.com/)(免费) 或 [开发者账户](https://developer.apple.com/account/)(收费) 登录，登录后选择账号，会自动创建证书；如果更换账号，需要重新设置 `bundle identifier`，因为现有的 id 被上一个账号占用了。(**此处大坑，在调试期间不要使用预期使用于最终产品的 bundle identifier，否则就会被占用，自己也删除不了，必须在一周内不要使用等着它自动过期；若意外被别的开发者占用，发邮件给苹果要求删除(响应不及时)，或者换一个 id**)

若选择账号后无法创建证书，提示 `There are no devices registered in your account`，说明该账号还未关联真机，在 xcode 最上方选择设备的地方 ([这张图](https://docs-assets.developer.apple.com/published/639f7e3799b8a0a0f5c4ee3cd92b4b22/running-your-app-in-the-simulator-or-on-a-device-1@2x.png) 的 Choose run destination 位置)，找到并选中真机，再次创建证书，应该就 ok 了。将 App 安装到真机后运行，会提示 `不受信任的开发者`，此时在 iphone 上打开 `设置 -> 通用 -> 设备管理` 找到 `开发者应用` 栏下的对应账号，点击信任，再次打开 APP 就可以了。

这种方式导出的 ipa 文件无法分发测试，只能在自己关联的设备上测试，也许可以用来做企业签(未测试)

# 命令行

若已经全局安装了 [easypush](https://www.npmjs.com/package/easypush)，按照正常的方式测试即可

```
npx easypush <command> [options]
```

若尚未安装，可以使用开发版命令，记得先在 [easypush](./../../easypush/) 目录编译

```
yarn easypush <command> [options]
```

# 其他说明

该样例用于开发测试 `react-native-archives`，使用 `react-native init` 创建，创建后做了以下修改

1、按照 `react-native-archives` 的安装说明进行了修改

2、在 [package.json](package.json) 新增了 `link dependencies`，由于 [issue](https://github.com/facebook/react-native/issues/637) 和 [issue](https://github.com/facebook/metro/issues/1)，`package.json` 的 `dependencies` 字段无法正确响应 `link:` 依赖，修改了 [metro.config.js](metro.config.js) 以便测试

3、为使用 local server 测试热更功能，新增了 [network_security_config.xml](android/app/src/main/res/xml/network_security_config.xml) 文件并在 [AndroidManifest.xml](android/app/src/main/AndroidManifest.xml) 文件中设置了 `android:networkSecurityConfig="@xml/network_security_config"`，这样在高版本的 Android 系统才能请求 local server

4、新增 [src](src)、[easypush.js](easypush.js)，修改 [index.js](index.js)，同时在 [package.json](package.json) 新增了命令用于测试

5、为测试媒体读写，建议在测试前保证相册不为空
