import {NativeModules} from 'react-native';
const {ArchivesModule} = NativeModules;
module.exports = ArchivesModule;

/* 简单说明

// 解压全量包
ArchivesModule.unzipFile({
  source:'local_file_path',
  md5: 'file_md5_hash',
  dest: ArchivesModule.downloadRootDir + '/version_hash'
})

// 解压相对于安装包的补丁
ArchivesModule.unzipPatch({
  source:'local_file_path',
  md5: 'file_md5_hash',
  dest: ArchivesModule.downloadRootDir + '/version_hash'
})

// 解压相对于小版本的补丁
ArchivesModule.unzipDiff({
  source:'local_file_path',
  md5: 'file_md5_hash',
  dest: ArchivesModule.downloadRootDir + '/version_hash',
  origin: 'origin_version_hash'
})

// 切换为指定版本
ArchivesModule.switchVersion({
  hash: 'version_hash',
  restart: Boolen
})


// 标记为成功
ArchivesModule.markSuccess()

*/
