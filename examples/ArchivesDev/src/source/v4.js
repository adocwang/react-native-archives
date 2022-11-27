import React from 'react';
import {View, Text} from 'react-native';
import {status, fs} from 'react-native-archives';

const Assets = {
  addStr: require('./files/add.html'),
};

const App = () => {
  const [addStr, setAddStr] = React.useState();
  React.useEffect(() => {
    if (status.isFirstTime) {
      fs.markSuccess()
    }
    fs.readFile(Assets.addStr).then(rs => setAddStr(rs))
  })

  return <View>
    <None />
    <Text>{addStr}</Text>
  </View>
}

export default App;