var fs = require('fs');
var path = require('path');
var crypto = require("crypto");
var hdiff = require("./index");
var assert = require("assert").strict;
var md5 = function(buf){
  return crypto.createHash('md5').update(buf).digest("hex");
}

var filea = fs.readFileSync(path.join(__dirname, './../fixtures/a.png'));
var fileb = fs.readFileSync(path.join(__dirname, './../fixtures/b.png'));

var a2b = hdiff.diff(filea, fileb);
var b2a = hdiff.diff(fileb, filea);

fs.writeFileSync(path.join(__dirname, './../fixtures/a2b.patch'), a2b);
fs.writeFileSync(path.join(__dirname, './../fixtures/b2a.patch'), b2a);


assert.deepStrictEqual(md5(a2b), 'f9b190ac9f6a56009cc7c1b07bb8080c');
assert.deepStrictEqual(md5(b2a), 'edf72e0d73186a438ddec11c052da8c7');
console.log("success\n")