var native;
try {
  native = require('./../build/Release/hdiff');
} catch(e) {
  native = require('./../build/Debug/hdiff');
}
exports.native = native;

// 导出 hdiff 方法
exports.diff = function(oldBuf, newBuf) {
  var buffers = [];
  native.diff(oldBuf, newBuf, function(output){
    buffers.push(output);
  });
  return Buffer.concat(buffers);
}