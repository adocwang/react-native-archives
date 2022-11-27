# react-native-archives test

用于测试 react-native-archives API，使用方式比较简单，代码示例

```
import React from 'react';
import ArchivesTest from 'react-native-archives/test';

// scrolled 为 true, 返回的根组件为 ScrollView, 否则为 View
const App = () => {
    return <ArchivesTest scrolled={false}/>
}

export default App;
```

在模拟器或真机上点击输出页面的按钮进行测试，Debug 模式可以在浏览器或命令行中查看测试结果，Release 模式可以在 Android Studio 或 Xcode 中通过 log 查看测试结果。


# 其他

为更好的测试文件读取功能，在测试前

- 相册中最好有图片，不为空
- 添加 Android 资源文件，创建 `Android/app/src/main/res/raw` 目录且不为空
