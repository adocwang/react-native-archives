/**
 * Metro configuration for React Native
 * https://github.com/facebook/react-native
 *
 * @format
 */

// metro 对软链接的支持不够, 为了开发方便, 就这样吧
// https://github.com/facebook/react-native/issues/637
// https://github.com/facebook/metro/issues/1
const path = require('path');
const project = require('./package.json');
const config = {};
if (project['dependencies']['react-native-archives'].startsWith('link')) {
  config.resolver = {
    extraNodeModules: new Proxy({},
      {get: (_, name) => path.resolve('.', 'node_modules', name)},
    ),
  };
  config.watchFolders = [path.resolve('.'), path.resolve('../..')];
}

module.exports = {
  transformer: {
    getTransformOptions: async () => ({
      transform: {
        experimentalImportSupport: false,
        inlineRequires: true,
      },
    }),
  },
  ...config
};
