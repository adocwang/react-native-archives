/**
 * Created by tdzl2003 on 2/28/16.
 */
const native = require('./build/Release/bsdiff');
exports.native = native;

exports.bsdiff = function(oldBuf, newBuf) {
  var buffers = [];
  native.diff(oldBuf, newBuf, function(output){
    buffers.push(output);
  });
  var full = Buffer.concat(buffers);

  // Generate bzip2 package with header.
  var header = new Buffer(32);
  header.fill(0);
  new Buffer('ENDSLEY/BSDIFF43').copy(header, 0);
  header.writeUInt32LE(newBuf.length, 16);

  var buffers1 = [header];
  native.compress(full, function(output){
    buffers1.push(output);
  });

  return Buffer.concat(buffers1);
}