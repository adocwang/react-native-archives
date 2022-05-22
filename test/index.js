import React, {useState, useRef, useEffect} from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  PermissionsAndroid,
} from 'react-native';
import {
  fs,
  dirs,
  utils,
  status,
  external,
  BlobPlus,
  fetchPlus,
  RequestPlus,
  ResponsePlus,
  HttpService
} from "./../index";

const IsAndroid = Platform.OS === 'android';
const RemotePng = 'https://home.baidu.com/Public/img/logo.png';
const RemoteDoc = "https://dev-4h9.pages.dev/hello.docx";
const RemoteJpg = "https://dev-4h9.pages.dev/brige.jpeg";
const RemoteTxt = "https://dev-4h9.pages.dev/str.txt";
const RemoteZip = "https://dev-4h9.pages.dev/file.zip";

function unicode(text) {
  text = text ? text.replace(/&#x(\w+);/g, (s, icon) => {
    return String.fromCharCode(parseInt(icon, 16))
  }) : text;
  return text;
}

function TestButton({
  android, ios, title, 
  startLog, endLog, errLog, onPress,
  children, ...props
}){
  if (android && !IsAndroid) {
    return null;
  }
  if (ios && IsAndroid) {
    return null;
  }
  const [disable, setDisable] = useState(false);
  const isMounted = useRef(false);
  useEffect(() => {
    isMounted.current = true;
    return () => isMounted.current = false;
  }, []);
  const callPress = async () => {
    startLog(title);
    setDisable(true);
    try {
      await onPress();
    } catch(e) {
      errLog(e)
    }
    if (isMounted.current) {
      setDisable(false);
      endLog();
    }
  };
  return <TouchableOpacity
    activeOpacity={.8}
    {...props}
    disabled={disable}
    onPress={callPress}
    style={{
      height:32,
      flexDirection:"row",
      justifyContent:"center",
      alignItems:"center",
      borderRadius: 4,
      minWidth: "48%",
      marginVertical:3,
      marginHorizontal:"1%",
      backgroundColor: "rgb(33, 150, 243)",
      opacity: disable ? .8 : null,
    }}
  >
    {disable ? <ActivityIndicator color="#fff" size="small" /> : null}
    <Text style={{color:"#fff"}}>{title}</Text>
    {children}
  </TouchableOpacity>
}

class TestService extends HttpService{
  withToken(request, token){
    return request.header('x-token', token);
  }
  test(){
    return this.request().payload({t:'test'}).json();
  }
}

class ArchivesTest extends React.PureComponent {
  constructor(props) {
    super(props);
    this.state = {  
      remoteFont: 0,
      localFont: 0,
    };
  }
  createButton(props) {
    return <TestButton
      startLog={this.startLog}
      endLog={this.endLog}
      errLog={this.errLog}
      {...props}
    />
  }
  startLog(title) {
    console.log('========================' + title + '========================');
  }
  endLog() {
  }
  errLog(e) {
    if (__DEV__) {
      console.error(e);
    } else {
      console.error(e.message);
    }
  }
  prtLog() {
    const args = Array.prototype.slice.call(arguments);
    if (!args.length) {
      return;
    }
    console.log(...args)
  }
  showLog() {
    const args = Array.prototype.slice.call(arguments);
    if (!args.length) {
      return;
    }
    if (args.length < 2) {
      console.log(args[0])
      return;
    }
    const tit = args.shift();
    const equal = args.pop();
    args.unshift(tit+':');
    args.unshift('【'+(equal ? '✓' : '×')+'】');
    console[equal ? 'log' : 'error'](...args)
  }

  utilsFunc = async () => {
    const self = this;
    let test, buffer, u8, u8int;
    test = 'test';
    buffer = utils.textToArrayBuffer(test);
    u8 = new Uint8Array(buffer);
    u8int = [];
    for (let i=0; i<u8.length; i++) {
      u8int.push(u8[i])
    }
    self.showLog('textToArrayBuffer()', test, buffer, u8int.join('') === [116, 101, 115, 116].join(''));

    let txt = utils.arrayBufferToText(buffer);
    self.showLog('arrayBufferToText()', test, txt, txt === test);

    let b64 = utils.arrayBufferToBase64(buffer), base64 = 'dGVzdA==';
    self.showLog('arrayBufferToBase64()', base64, b64, b64 === base64);
    
    buffer = utils.base64ToArrayBuffer(base64);
    txt = utils.arrayBufferToText(buffer);
    self.showLog('base64ToArrayBuffer()', test, buffer, test === txt);

    //getNumber
    let expected, actual;
    self.showLog(
      'getNumber()',
      expected = 3,
      actual = utils.getNumber(3),
      expected === actual
    );
    self.showLog(
      'getNumber()',
      expected = 1,
      actual = utils.getNumber('1.2'),
      expected === actual
    );
    self.showLog(
      'getNumber()',
      expected = undefined,
      actual = utils.getNumber('x'),
      expected === actual
    );
    self.showLog(
      'getNumber()',
      expected = null,
      actual = utils.getNumber('v', null),
      expected === actual
    );
    
    //normalizeMethod
    self.showLog(
      'normalizeMethod()',
      expected = 'GET',
      actual = utils.normalizeMethod('get'),
      expected === actual
    );
    self.showLog(
      'normalizeMethod()',
      expected = 'none',
      actual = utils.normalizeMethod('none'),
      expected === actual
    );

    //ltrim
    self.showLog(
      'ltrim()',
      expected = 'str ',
      actual = utils.ltrim('   str '),
      expected === actual
    );
    self.showLog(
      'ltrim()',
      expected = 'str~',
      actual = utils.ltrim('~~~str~', '~'),
      expected === actual
    );
    
    //rtrim
    self.showLog(
      'rtrim()',
      expected = ' str',
      actual = utils.rtrim(' str   '),
      expected === actual
    );
    self.showLog(
      'rtrim()',
      expected = '~str',
      actual = utils.rtrim('~str~~~', '~'),
      expected === actual
    );

    //parseQuery
    let expected2={
      foo:['f', 'o'],
      bar:"bar"
    };
    let actual2 = utils.parseQuery('foo[]=f&foo[]=o&bar=bar');
    self.showLog('parseQuery()', expected2, actual2,
      JSON.stringify(expected2) === JSON.stringify(actual2)
    );

    //parseCookie
    let expected3={
      foo:['f', 'o'],
      bar:"bar"
    };
    let actual3 = utils.parseCookie('foo[]=f; foo[]=o; bar=bar');
    self.showLog('parseCookie()', expected3, actual3,
      JSON.stringify(expected3) === JSON.stringify(actual3)
    );

    //parseHeader
    u8 = {
      Connection: "keep-alive",
      Pragma: "no-cache",
    };
    u8int = [];
    let expected4={};
    for (let k in u8) {
      u8int.push(k+':'+u8[k]);
      expected4[k.toLocaleLowerCase()] = u8[k];
    }
    let actual4 = {};
    let header = utils.parseHeader(u8int.join("\n"));
    for (let k of header.entries()) {
      actual4[k[0]] = k[1];
    }
    self.showLog('parseHeader()', expected4, actual4,
      JSON.stringify(expected4) === JSON.stringify(actual4)
    );

    //makeParam
    u8 = {
      key:"key",
      arr:["a", "中"],
      哈:"t"
    };
    actual = utils.makeParam(u8);
    expected='key=key&arr[]=a&arr[]=%E4%B8%AD&%E5%93%88=t';
    self.showLog('makeParams()', expected, actual, expected === actual);

    //makeUrl
    self.showLog(
      'makeUrl()', 
      expected = 'http://d.com',
      actual = utils.makeUrl(expected),
      expected === actual
    );
    self.showLog(
      'makeUrl()', 
      '',
      actual = utils.makeUrl('http://d.com', 'path'),
      'http://d.com/path' === actual
    );
    self.showLog(
      'makeUrl()', 
      '',
      actual = utils.makeUrl('http://d.com', 'path', {foo:"foo"}),
      'http://d.com/path?foo=foo' === actual
    );
  }

  blobPlus = async () => {
    const self = this;
    let actual, str = 'abcdeft', blob = new BlobPlus([str], {type: 'text/plain'});
    self.prtLog(blob);

    actual = await blob.text();
    self.showLog('blob text()', str, actual, actual === str);

    actual = await blob.arrayBuffer();
    self.showLog('blob arrayBuffer()', str, actual, utils.arrayBufferToText(actual) === str);

    actual = await blob.base64();
    self.showLog(
      'blob base64()', str, actual,
      utils.arrayBufferToText( utils.base64ToArrayBuffer(actual) ) ===  str
    );

    actual = await blob.dataUrl();
    self.showLog(
      'blob dataUrl()', str, actual,
      actual === 'data:text/plain;base64,' + utils.arrayBufferToBase64( utils.textToArrayBuffer(str) )
    );

    const blobSlice =blob.slice(2, 5);
    actual = await blobSlice.text();
    self.showLog('blob slice()', 'cde', actual, 'cde' === actual);

    actual = await blob.text();
    self.showLog('blob text()', str, actual, actual === str);
    
    actual = await (new BlobPlus([blob])).text();
    self.showLog('blob->blobPlus', str, actual, actual === str);
    blob.close();
  }

  requestPlus_Props = async () => {
    const self = this;
    // RequestPlus 除 body 外的基本属性测试
    const url = "https://postman-echo.com/post";
    const controller = new AbortController();
    const info = {
      credentials:"omit",
      method:"GET",
      mode:"cors",
      signal:controller.signal,
      referrer:"https://postman-echo.com",
      headers:{
        "user-agent": "Mozilla/5.0",
        "content-type": "image/jpeg"
      },
    };
    const callback=()=>{};
    const extend = {
      timeout:2,
      saveTo:"path",
      keepBlob:true,
      resText:true,
      onHeader:callback,
      onUpload:callback,
      onDownload:callback,
    }
    const options = {...info, ...extend};
    const fullInfo = {...options, url};
    const getHeaderAll = (header) => {
      const obj = {};
      for (var pair of header.entries()) {
        obj[pair[0]] = pair[1];
      }
      return obj;
    }
    const checkInfo = (title, req) => {
      self.prtLog(req)
      let same=true, actual, expected;
      for (let k in fullInfo) {
        actual = req[k];
        expected = fullInfo[k];
        if ('headers' === k) {
          if (JSON.stringify(expected) != JSON.stringify(getHeaderAll(actual))) {
            same=false;
            self.showLog(k, expected, actual, false);
          }
        } else if (actual !== expected) {
          same=false;
          self.showLog(k, expected, actual, false);
        }
      }
      if (same) {
        self.showLog('check ' + title, true);
      } else {
        self.showLog('check ' + title, false);
      }
    };
    // check method
    let req, ex, ac;
    req = new RequestPlus('/');
    self.showLog('req method', ex = null, ac = req.method, ex === ac);
    req = new RequestPlus('/', {body:'a'});
    self.showLog('req method', ex = null, ac = req.method, ex === ac);
    req = new RequestPlus('/', {body:'a', method:'POST'});
    self.showLog('req method', ex = 'POST', ac = req.method, ex === ac);
    req = new RequestPlus('/', {method:'GET'});
    self.showLog('req method', ex = 'GET', ac = req.method, ex === ac);

    // check instance
    checkInfo('req(url, options)', new RequestPlus(url, options));
    checkInfo('req(options)', new RequestPlus(fullInfo));

    const basicReq = new RequestPlus(url, info);
    checkInfo('req(req, options)', new RequestPlus(basicReq, extend));

    const orgReq = new Request(url, info);
    for (let ek in extend) {
      orgReq[ek] = extend[ek];
    }
    // 原始 Request 不支持 referrer
    orgReq.referrer = info.referrer;
    checkInfo('request+extend', orgReq);
  }
  
  _checkPlusBody = async (isRequest) => {
    const self = this;
    // request/response body 功能同, 所以这里合并测试
    const create = (body) => {
      if (isRequest) {
        return new RequestPlus({
          method:'POST',
          body
        })
      }
      return new ResponsePlus(body);
    };
    const checkBody = async (body, str) => {
      let res, payload, temp;
      self.prtLog('✸✸ init body ✸✸:', body);

      res = create(body);
      payload = await res.text();
      self.showLog('text()', str, payload, str === payload);

      res = create(body);
      payload = await res.formData();
      self.showLog('formData()', str, payload, payload instanceof FormData);

      res = create(body);
      payload = await res.blob();
      temp = payload instanceof BlobPlus ? await payload.text() : null;
      self.showLog('blob()', str, payload, str === temp);

      res = create(body);
      payload = await res.arrayBuffer();
      temp = payload instanceof ArrayBuffer ? utils.arrayBufferToText(payload) : null;
      self.showLog('arrayBuffer()', str, payload, str === temp);

      try {
        res = create(body);
        payload = await res.json();
        self.showLog('json()', str, payload, str === JSON.stringify(payload));
      } catch(e) {
        self.showLog('not support json()', str, e.message, true);
      }
    }
    const obj = {foo: "foo"};

    // string
    const payload = JSON.stringify(obj);
    await checkBody(payload, payload);

    // obj
    await checkBody(obj, payload);

    // URLSearchParams
    const us = new URLSearchParams();
    us.append('foo', 'foo');
    us.append('bar', 'bar');
    await checkBody(us, 'foo=foo&bar=bar');

    // blob
    const blob = new Blob([payload]);
    await checkBody(blob, payload);

    // ArrayBuffer
    const buff = utils.textToArrayBuffer(payload);
    await checkBody(buff, payload);

    // DataView
    const dataView = new DataView(utils.textToArrayBuffer(payload));
    await checkBody(dataView, payload);
  }

  requestPlus_Body = async () => {
    await this._checkPlusBody(true);
  }

  responsePlus = async () => {
    await this._checkPlusBody();
  }

  fetchPlus = async () => {
    const self = this;
    let json;
    const postFetch = async (body, headers, props) => {
      headers = headers||{};
      const res = await fetchPlus('https://postman-echo.com/post', {
        resText: true,
        headers,
        body,
        ...props
      });
      return await res.json();
    };
    // header / referrer / string body
    let hd = 'custom', reurl = 'http://www.react.com';
    json = await postFetch('payload', {'x-custome': hd, referrer: reurl});
    self.prtLog('✸✸ post string ✸✸', json);
    self.showLog('res header', hd, json.headers['x-custome'], json.headers['x-custome'] === hd);
    self.showLog('res referrer', reurl, json.headers['referrer'], json.headers['referrer'] === reurl);
    self.showLog('res body', 'payload', json.data, json.data === 'payload');

    // object
    const obj = {foo:"bar", bar:['b', 'z']};
    json = await postFetch(obj);
    self.prtLog('✸✸ post object ✸✸', json);
    self.showLog('res json', obj, json.json, JSON.stringify(json.json) === JSON.stringify(obj));

    // Blob
    const blob = new Blob(['blob'], {type: 'text/html'})
    json = await postFetch(blob);
    self.prtLog('✸✸ post Blob ✸✸', blob);
    self.showLog('res header', 'text/html', json.headers['content-type'], json.headers['content-type'] === 'text/html');
    self.showLog('res body', 'blob', json.data, json.data === 'blob');

    // ArrayBuffer/DataView
    const checkBuffer = async (buffer, d) => {
      json = await postFetch(buffer);
      self.prtLog('✸✸ post '+(d ? 'DataView' : 'ArrayBuffer')+' ✸✸', json);
      let resData = 'object' === typeof json.data && 'data' in json.data ? json.data.data : null;
      if (resData) {
        resData = utils.arrayBufferToText(new Uint8Array(json.data.data));
      }
      self.showLog('res body', 'buffer', resData, resData === 'buffer');
    }
    const buffer = utils.textToArrayBuffer('buffer');
    await checkBuffer(buffer);
    await checkBuffer(new DataView(buffer), true);

    // URLSearchParams
    const foobar = {foo:"foo", 'bar[]':['b', 'r']};
    const us = new URLSearchParams();
    us.append('foo', 'foo');
    us.append('bar[]', 'b');
    us.append('bar[]', 'r');
    json = await postFetch(us);
    self.prtLog('✸✸ post URLSearchParams ✸✸', json);
    self.showLog('res form', foobar, json.form, JSON.stringify(json.form) === JSON.stringify(foobar));

    // FormData
    const form = new FormData();
    form.append('foo', 'foo');
    form.append('bar[]', 'b');
    form.append('bar[]', 'r');
    form.append('logo', {
      uri: RemotePng,
      type: 'image/png',
      name: 'logo.jpg',
    });
    let trigger = {header:false, upload:false, download:false}, props = {};
    props.onHeader = () => {
      trigger.header = true;
    };
    props.onUpload = () => {
      trigger.upload = true;
    };
    props.onDownload = () => {
      trigger.download = true;
    };
    json = await postFetch(form, {}, props);
    self.prtLog('✸✸ post FormData ✸✸', form);
    self.showLog('res form', foobar, json.form, JSON.stringify(json.form) === JSON.stringify(foobar));
    self.showLog('res file', 'logo.jpg', Object.keys(json.files), 'logo.jpg' in json.files);
    self.showLog('res onHeader trigged', trigger.header);
    self.showLog('res onUpload trigged', trigger.upload);
    self.showLog('res onDownload trigged', trigger.download);
  }

  httpRequest_Props = async () => {
    const self = this;
    const service = new TestService('https://postman-echo.com');
    self.prtLog('✸✸ check request prop init ✸✸');
    const req = service.request();
    const check = (method, stand) => {
      let v,obj,val;
      v = 'val';
      obj = req.init(method, v);
      val = req.init(method);
      self.showLog('init '+method, v, val, v === val && obj === req);
      if (stand) {
        v = 'val2';
        obj = req[method](v);
        val = req[method]();
        self.showLog(method+'()', v, val, v === val && obj === req);
      }
    };
    for (let m of [
      'url', 'method', 'timeout', 'credentials', 'referrer', 'payload',
      'onHeader', 'onUpload', 'onDownload',
      'saveTo', 'keepBlob', 'resBlob', 'signal'
    ]) {
      check(m, true);
    }
    for (let m of ['mode', 'diy']) {
      check(m);
    }
    let v, obj, val;
    obj = req.auth(v = 'auth');
    val = req.header('Authorization');
    self.showLog('auth()', v, val, v === val && obj === req);

    self.prtLog('✸✸ check request original ✸✸');
    const init = {
      url:'/ttt',
      mode:'a',
      method:'POST',
      timeout:2,
      credentials:'ab',
      referrer:'ccc',
    };
    const org = service.request(init);
    for (let k in init) {
      self.showLog(k, init[k], org.init(k), org.init(k) === init[k]);
    }
  }

  httpRequest_Method = async () => {
    const self = this;
    const service = new TestService();
    const logRequest = (tit, req, method, expected, obj) => {
      const data = req[method]();
      const actual = {...data};
      const eq = JSON.stringify(expected) === JSON.stringify(actual) 
        && (!obj || req === obj);
      self.showLog(tit, expected, actual, eq);
    };
    const checkRequestData = (method) => {
      let obj, val;
      const req = service.request();
      const log = (tit, expected) => {
        logRequest(tit, req, method, expected, obj);
      }
      const Foo = 'header' === method ? 'Foo' : 'foo';
      self.prtLog('✸✸ check request data ✸✸', method);

      // get all
      log('all', {});

      // set
      obj = req[method](Foo, 'foo');
      log('set string', {foo:'foo'});

      obj = req[method]('bar', ['b', 'a']);
      log('set array', {foo:'foo', bar:['b', 'a']});

      obj = req[method](Foo, 'foo2', true);
      log('set string append', {foo:['foo', 'foo2'], bar:['b', 'a']});

      // set batch
      val = {baz:'baz'};
      val[Foo] = 'foo';
      obj = req[method](val);
      log('set batch', {foo:'foo', bar:['b', 'a'], baz:'baz'});

      val = {que:'q'};
      val[Foo] = 'f';
      obj = req[method](val, true);
      log(
        'set batch append',
        {foo:['foo', 'f'], bar:['b', 'a'], baz:'baz', que:'q'}
      );

      val = {};
      val[Foo] = 'f';
      val.bar = 'b';
      obj = req[method](val, false);
      log('set batch overwrite', {foo:'f', bar:'b'});

      obj = req[method](null);
      log('clear', {});

      // get all
      let all, expected, actual;
      req[method](all = {foo:'f', bar:'a', baz:['b', 'z']});
      actual = req[method]();
      self.showLog(
        'get all', all, actual = {...actual},
        JSON.stringify(all) === JSON.stringify(actual)
      );
      
      // get one
      self.showLog('get string', expected='f', actual = req[method](Foo), expected === actual);
      self.showLog(
        'get array', expected=['b', 'z'], actual = req[method]('baz'),
        JSON.stringify(expected) === JSON.stringify(actual)
      );

      // get batch
      self.showLog(
        'get batch', expected={foo:'f', baz:['b', 'z']}, actual = req[method]([Foo,'baz']),
        JSON.stringify(expected) === JSON.stringify(actual)
      );
    };
    checkRequestData('header');
    checkRequestData('cookie');
    checkRequestData('query');
    checkRequestData('param');
    checkRequestData('file');
  }

  httpService = async () => {
    const self = this;
    const isContains = (tit, sub, actual, eq) => {
      let contains = true, index = 0;
      for (let k in sub) {
        if (!actual.hasOwnProperty(k) || actual[k] !== sub[k]) {
          contains = false;
          break;
        }
        index++;
      }
      if (contains && eq && Object.keys(actual).length !== index) {
        contains = false;
      }
      self.showLog(tit+' contains', sub, actual, contains);
    }
    let send, res;
    const getServer = 'https://postman-echo.com/get'
    const service = new TestService('https://postman-echo.com/post');

    // header+query
    let header, query;
    send = await service.request(getServer)
      .withToken('tt')
      .header(header = {x:"x", y:"y"})
      .query(query = {foo:"foo", bar:"bar"})
      .send();
    self.showLog('response', send, ResponsePlus.prototype.isPrototypeOf(send));
    res = await send.json();
    header['x-token'] = 'tt';
    isContains('header', header, res.headers);
    isContains('query', query, res.args);

    // cookie
    res = await service.request(getServer).json();
    self.showLog('cookie contains', 'cookie', res.headers, 'cookie' in res.headers);

    res = await service.request(getServer).credentials(false).json();
    self.showLog('cookie not contains', 'cookie', res.headers, !('cookie' in res.headers));

    res = await service.request(getServer).cookie('z', 'z').json();
    self.showLog('cookie contains custom', 'cookie', res.headers, res.headers.cookie === 'z=z');

    res = await service.request(getServer).credentials(true).cookie('z', 'z').json();
    self.showLog('cookie not contains custom', 'cookie', res.headers, 'cookie' in res.headers && res.headers.cookie !== 'z=z');

    // param/file
    let params,files;
    res = await service.request().param(params = {foo:'f', bar:'b'}).json();
    isContains('params', params, res.form, true);
    res = await service.request()
      .param(params)
      .file({img:RemotePng})
      .json();
    isContains('params', params, res.form, true);
    self.showLog(
      'files contains', files = Object.keys(res.files),
      JSON.stringify(files) === JSON.stringify(['logo.png'])
    );
    
    // payload 优先
    let payload;
    res = await service.request()
      .param(params)
      .file({img:RemotePng})
      .payload(payload = 'str')
      .json();
    self.showLog('payload priority', payload, res.data, res.data === payload); 
    
    // service 内部函数
    let rjson = {t:"test"};
    res = await service.test();
    self.showLog(
      'service func', rjson, res.json, 
      JSON.stringify(rjson) === JSON.stringify(res.json)
    );
  }
  
  showVars = async () => {
    this.prtLog('dirs', dirs);
    this.prtLog('status', status);
    this.prtLog('external', external);
  }

  rmkDir = async () => {
    const self = this;
    const dir = dirs.Caches + '/_arch_rmk_test_967_';
    let exist, rm, crt, subdir;
    exist = await fs.isDir(dir);
    self.showLog('isDir', dir, exist, true);
    if (false === exist) {
      self.showLog('test dir is a file, jump test', false)
      return;
    }
    if (exist) {
      rm = await fs.rmDir(dir, true);
      self.showLog('rmDir', dir, rm, null === rm);
      exist = await fs.isDir(dir);
      self.showLog('isDir', dir, exist, null === exist);
    }
    crt = await fs.mkDir(dir);
    self.showLog('mkDir', dir, crt, null === crt);
    exist = await fs.isDir(dir);
    self.showLog('isDir', dir, exist, exist);

    subdir = dir + '/a/b';
    try {
      crt = await fs.mkDir(subdir, false);
      self.showLog('mkSubDir should failed', dir, false);
    } catch(e) {
      self.showLog('mkSubDir should failed', dir, true);
    }
    
    crt = await fs.mkDir(subdir);
    self.showLog('mkSubDir', dir, crt, null === crt);
    exist = await fs.isDir(subdir);
    self.showLog('isSubDir', dir, exist, exist);

    try {
      rm = await fs.rmDir(dir);
      self.showLog('rm recursive should failed', dir, false);
    } catch(e) {
      self.showLog('rm recursive should failed', dir, true);
    }
  
    rm = await fs.rmDir(dir, true);
    self.showLog('rmDir', dir, rm, null === rm);
    exist = await fs.isDir(dir);
    self.showLog('isDir', dir, exist, null === exist);
  }

  _makeTmpDir = async (clear) => {
    const dir = dirs.Caches + '/_arch_tmp_test_967_';
    if (clear) {
      await fs.rmDir(dir, true);
    } else {
      await fs.mkDir(dir);
      await fs.writeFile(dir + '/x.txt', 'abc');
    }
    return dir;
  }

  _testPaths = null;
  _getTestPaths = async (read) => {
    const self = this;
    const tmpDir = await this._makeTmpDir();
    if (read || null === this._testPaths) {
      const files = [];
      const directs = [dirs.Document];
      if (IsAndroid) {
        // android 特殊目录
        const contentPath = await fs.getContentUri('images');
        directs.push('drawable://', 'asset://', 'raw://', contentPath);
      } else {
        // ios 特殊目录
      }
      let lists, file, hasFile, hasDir, err;
      for (let [index, d] of [tmpDir, ...directs].entries()) {
        err = null;
        try {
          lists = await fs.readDir(d);
        } catch(e) {
          lists = [];
          err = e;
        }
        // readDir 测试
        if (read) {
          if (err) {
            self.showLog(d, err.message, false);
          } else {
            self.showLog(d + ':', lists, true);
          }
          continue;
        }
        // 非 readDir 测试
        if (index === 0) {
          continue;
        }
        hasFile = hasDir = false;
        for (file of lists) {
          if (!('isDir' in file)) {
            continue;
          }
          if (file.isDir && !hasDir) {
            hasDir = true;
            directs.push(file.path);
          } else if(!file.isDir && !hasFile) {
            hasFile = true;
            files.push(file.path)
          }
          if (hasFile && hasDir) {
            break;
          }
        }
      }
      this._testPaths = {
        dirs: directs,
        files
      };
    }
    // 添加临时创建文件
    return {
      dirs: this._testPaths.dirs.concat([tmpDir]),
      files: this._testPaths.files.concat([tmpDir + '/x.txt'])
    };
  }

  readDir = async () => {
    if (IsAndroid) {
      await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
    }
    await this._getTestPaths(true);
    await this._makeTmpDir(true);
  }

  isDir = async () => {
    const self = this;
    const temp = await this._getTestPaths();
    const existDirs = temp.dirs;
    const existFiles = temp.files;
    let path, rs, err;
    for (path of existDirs) {
      err = null;
      try {
        rs = await fs.isDir(path);
      } catch (e) {
        rs = null;
        err = e;
      }
      if (err) {
        self.showLog(path, err.message, false);
      } else {
        self.showLog(path, rs === true);
      }
    }
    for (path of existFiles) {
      err = null;
      try {
        rs = await fs.isDir(path);
      } catch (e) {
        rs = null;
        err = e;
      }
      if (err) {
        self.showLog(path, err.message, false);
      } else {
        self.showLog(path, rs === false);
      }
    }
    await this._makeTmpDir(true);

    // not exist
    const nonePahts = [
      dirs.Document + '/_test_none_'
    ];
    if (IsAndroid) {
      // android 特殊目录
      nonePahts.push(
        'drawable://none', 'raw://none', 
        'asset://_none_', 'content://_none_'
      );
    } else {
      // ios 特殊目录
    }
    for (path of nonePahts) {
      rs = await fs.isDir(path);
      self.showLog(path, rs === null);
    }
  }

  writeFile = async () => {
    const self = this;
    const file = dirs.Caches + '/_test_.txt';
    const getWriteContent = (type) => {
      let contents = [
        ['overwrite', 'abcd', 'abcd'], // 覆盖写
        ['overwrite', '123', '123'], // 覆盖写
        ['write append', '456', '123456', true], // 追加写
        ['write offset', 'abc', '12abc6', 2], // 在指定位置写(从开头数)
        ['write -offset', 'xyz', '12abxyz', -2], // 在指定位置写(从结尾数)
      ];
      if ('arr' === type || 'base64' === type) {
        let rs = [], isBase = 'base64' === type;
        contents.forEach(([tit, c, e, flag]) => {
          c = utils.textToArrayBuffer(c);
          if (isBase) {
            c = [utils.arrayBufferToBase64(c)];
          }
          rs.push([tit, c, e, flag]);
        });
        return rs;
      }
      if ('blob' === type) {
        let rs = [];
        const qblob = new Blob(['abcd']);
        const sblob = qblob.slice(0, 3);
        contents.forEach(([tit, c, e, flag], index) => {
          if (0 === index) {
            c = qblob;
          } else if (3 === index) {
            c = sblob;
          } else {
            c = new Blob([c]);
          }
          rs.push([tit, c, e, flag]);
        });
        return rs;
      }
      return contents;
    };
    const checkWrite = async (type) => {
      self.prtLog('✸✸ write file '+type+' ✸✸');
      const arr = getWriteContent(type);
      let item, tit, str, expected, flag, writeRs, content;
      for (item of arr) {
        [tit, str, expected, flag] = item;
        writeRs = await fs.writeFile(file, str, flag);
        self.showLog(tit, writeRs, null === writeRs);
        content = await fs.readFile(file);
        self.showLog('content', expected, content, expected === content);
      }
    };
    await checkWrite('str');
    await checkWrite('arr');
    await checkWrite('base64');
    await checkWrite('blob');

    let writeRs, content, expected;
    if (IsAndroid) {
      // android 特殊路径
      self.prtLog('✸✸ write access content:// file ✸✸');
      const uri = await fs.getShareUri(file);
      writeRs = await fs.writeFile(uri, expected = 'content_test');
      self.showLog('write cotent uri', writeRs, null === writeRs);
      content = await fs.readFile(file);
      self.showLog('content', expected, content, expected === content);
    } else {
      // iOS 特殊路径
    }
    const rm = await fs.unlink(file);
    self.showLog('unlink file', rm, null === rm);
  }

  readFile = async () => {
    const self = this;
    // test speical file
    self.prtLog('✸✸ read speical file ✸✸');
    const temp = await this._getTestPaths();
    for (let path of temp.files) {
      await fs.readFile(path, 0, 1);
      self.showLog('read file', path, true);
    }
    await this._makeTmpDir(true);
    // test read method
    const expected = 'abcdefg';
    const checkRead = async (file) => {
      let base64, middle, content, excpt;

      content = await fs.readFile(file);
      self.showLog('read string', expected, content, expected === content);

      content = await fs.readFile(file, 'text', 3);
      self.showLog('read string offset', excpt = 'defg', content, excpt === content);

      content = await fs.readFile(file, 'text', 3, 2);
      self.showLog('read string offset+len', excpt = 'de', content, excpt === content);

      content = await fs.readFile(file, 'text', -5);
      self.showLog('read string -offset', excpt = 'cdefg', content, excpt === content);

      content = await fs.readFile(file, 'text', -5, 3);
      self.showLog('read string -offset+len', excpt = 'cde', content, excpt === content);

      base64 = await fs.readFile(file, 'base64');
      content = utils.arrayBufferToText(utils.base64ToArrayBuffer(base64));
      self.showLog('read base64', expected, base64, expected === content);

      content = await fs.readFile(file, 'uri');
      self.showLog('read uri', excpt = 'data:text/plain;base64,' + base64, content, excpt === content);

      base64 = await fs.readFile(file, 'base64', 3);
      content = utils.arrayBufferToText(utils.base64ToArrayBuffer(base64));
      self.showLog('read base64 offset', excpt = 'defg', base64, excpt === content);

      content = await fs.readFile(file, 'uri', 3);
      self.showLog('read uri offset', excpt = 'data:text/plain;base64,' + base64, content, excpt === content);

      middle = await fs.readFile(file, 'blob');
      content = await middle.text();
      self.showLog('read blob', expected, middle, expected === content);

      middle = await fs.readFile(file, 'blob', 3);
      content = await middle.text();
      self.showLog('read blob offset', excpt = 'defg', middle, excpt === content);

      middle = await fs.readFile(file, 'buffer');
      content = utils.arrayBufferToText(middle);
      self.showLog('read buffer', expected, middle, expected === content);

      middle = await fs.readFile(file, 'buffer', 3);
      content = utils.arrayBufferToText(middle);
      self.showLog('read buffer offset', excpt = 'defg', middle, excpt === content);
    };

    // remote file
    self.prtLog('✸✸ read file ✸✸');
    await checkRead(require('./str.html'));

    // file
    self.prtLog('✸✸ read local file ✸✸');
    const file = dirs.Caches + '/_test_.txt';
    await fs.writeFile(file, expected);
    await checkRead(file);
    const rm = await fs.unlink(file);
    self.showLog('unlink file', rm, '', null === rm);

    // remote file
    self.prtLog('✸✸ read remote file ✸✸');
    await checkRead(RemoteTxt);
  }
  
  copyFile = async () => {
    const self = this;
    self.prtLog('✸✸ check copy special file ✸✸');
    const temp = await this._getTestPaths();
    const destPath = dirs.Caches + '/_special_dest_file_';
    let checkPath;
    for (let path of temp.files) {
      await fs.copyFile(path, destPath);
      checkPath = await fs.isDir(destPath);
      self.showLog('copy '+path, false === checkPath);
      await fs.unlink(destPath);
    }
    await this._makeTmpDir(true);

    // copy 方法
    self.prtLog('✸✸ check copy method ✸✸');
    let excpt, exist, exist2, rm, cp, content, excon, excon2;
    const file = dirs.Caches + '/_test_.txt';
    const file2 = dirs.Caches + '/_test_2.txt';

    // 确认文件
    exist = await fs.isDir(file);
    self.prtLog('source file exist:', exist === false);
    exist2 = await fs.isDir(file2);
    self.prtLog('dest file exist:', exist === false);
    if (null !== exist2) {
      rm = await fs.unlink(file2);
      self.showLog('unlink dest file', excpt = null, rm, excpt === rm);
    }
    excon = '*&^';
    await fs.writeFile(file, excon);

    // 复制(不存在)
    cp = await fs.copyFile(file, file2);
    self.showLog('copy file', excpt = null, cp, excpt === cp);
    content = await fs.readFile(file2);
    self.showLog('check copy', excon, content, excon === content);

    // 复制(不覆盖)
    excon2 = '@#$';
    await fs.writeFile(file, excon2);
    try {
      await fs.copyFile(file, file2, false);
      self.showLog('copy overwrite should failed', false)
    } catch(e) {
      self.showLog('copy overwrite should failed', true)
    }
    content = await fs.readFile(file2);
    self.showLog('check copy', excon, content, excon === content);

    // 复制(覆盖)
    await fs.copyFile(file, file2);
    self.showLog('copy overwrite', true);
    content = await fs.readFile(file2);
    self.showLog('check copy', excon2, content, excon2 === content);

    // 删除临时文件
    await fs.unlink(file);
    await fs.unlink(file2);
  }
  
  moveFile = async () => {
    const self = this;
    let excpt, exist, exist2, rm, cp, content, excon, excon2;
    const file = dirs.Caches + '/_test_.txt';
    const file2 = dirs.Caches + '/_test_2.txt';

    // 确认文件
    exist = await fs.isDir(file);
    self.showLog('file isDir', exist, '', true);
    exist2 = await fs.isDir(file2);
    self.showLog('file2 isDir', exist2, '', true);
    if (null !== exist2) {
      rm = await fs.unlink(file2);
      self.showLog('unlink file2', rm, '', null === rm);
    }
    excon = '*&^';
    await fs.writeFile(file, excon);

    // 移动(不存在)
    cp = await fs.moveFile(file, file2);
    self.showLog('moveFile', excpt = null, cp, excpt === cp);
    content = await fs.readFile(file2);
    self.showLog('check move', excon, content, excon === content);
    exist = await fs.isDir(file);
    self.showLog('old file exist', exist, '', exist === null);

    // 移动(不覆盖)
    excon2 = '@#$';
    await fs.writeFile(file, excon2);
    try {
      await fs.moveFile(file, file2, false);
      self.showLog('move overwrite should failed', false)
    } catch(e) {
      self.showLog('move overwrite should failed', true)
    }
    content = await fs.readFile(file2);
    self.showLog('check move', excon, content, excon === content);

    // 移动(覆盖)
    await fs.moveFile(file, file2);
    self.showLog('move overwrite:', true);
    content = await fs.readFile(file2);
    self.showLog('check move', excon2, content, excon2 === content);
    exist = await fs.isDir(file);
    self.showLog('old file exist', exist, '', exist === null);

    // 删除临时文件
    await fs.unlink(file2);
  }
  
  unlink = async () => {
    const self = this;
    let exist;
    const file = dirs.Caches + '/_arch_test_unlink_687_.txt';
    exist = await fs.isDir(file);
    self.prtLog('file exist:', exist === false);
    if (true === exist) {
      self.showLog('test file is dir', false);
      return;
    }
    if (null === exist) {
      await fs.writeFile(file, '');
      self.showLog('create file', true);
    }
    exist = await fs.isDir(file);
    self.showLog('file exist', exist === false);

    await fs.unlink(file);
    exist = await fs.isDir(file);
    self.showLog('unlink->file', exist === null);
  }
  
  openFile = async () => {
    const self = this;
    const file = dirs.Caches + '/_arch_test_addown_.jpeg';
    const test = await fs.isDir(file);
    if (false !== test) {
      await fetchPlus({
        url:RemoteJpg,
        saveTo: file
      })
    }
    await fs.openFile(file, {
      title: "Test File",
      onClose:() => {
        self.prtLog('open file closed')
        fs.unlink(file);
      }
    });
    self.prtLog('open file success')
  }

  openFile2 = async () => {
    const self = this;
    const file = dirs.Caches + '/_arch_test_addown_';
    const test = await fs.isDir(file);
    if (false !== test) {
      await fetchPlus({
        url:RemoteJpg,
        saveTo: file
      })
    }
    await fs.openFile(file, {
      mime: "image/jpeg",
      title: "Test File",
      onClose:() => {
        self.prtLog('open file closed')
        fs.unlink(file);
      }
    });
    self.prtLog('open file success')
  }

  getMime = async () => {
    const self = this;
    let mime, except;
    mime = await fs.getMime('foo.txt');
    self.showLog('getMime', except = 'text/plain', mime, except === mime);
    
    mime = await fs.getMime(['path/foo.txt', 'foo.png']);
    self.showLog(
      'getMime', except = ['text/plain', 'image/png'], mime,
      JSON.stringify(except) === JSON.stringify(mime)
    );
  }

  getExt = async () => {
    const self = this;
    let ext, except;
    ext = await fs.getExt('text/plain');
    self.showLog('getExt', except = 'txt', ext, except === ext);
    
    ext = await fs.getExt(['text/plain;utf-8', 'image/png']);
    self.showLog(
      'getExt', except = ['txt', 'png'], ext,
      JSON.stringify(except) === JSON.stringify(ext)
    );
  }

  getHash = async () => {
    const self = this;
    self.prtLog('✸✸ check get special file hash ✸✸');
    const temp = await this._getTestPaths();
    let path, shash;
    if (!__DEV__) {
      path = './str.html';
      shash = await fs.getHash(require('./str.html'));
      self.showLog(path, shash, true);
    }
    for (path of temp.files) {
      shash = await fs.getHash(path);
      self.showLog(path, shash, true);
    }
    await this._makeTmpDir(true);

    self.prtLog('✸✸ check hash value ✸✸');
    let file, hash, except;
    file = dirs.Caches + '/_test_.txt';
    await fs.writeFile(file, 'abc');
    const hashs = {
      md5: "900150983cd24fb0d6963f7d28e17f72",
      sha1: "a9993e364706816aba3e25717850c26c9cd0d89d",
      sha224: "23097d223405d8228642a477bda255b32aadbce4bda0b3f7e36c9da7",
      sha256: "ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad",
      sha384: "cb00753f45a35e8bb5a03d699ac65007272c32ab0eded1631a8b605a43ff5bed8086072ba1e7cc2358baeca134c825a7",
      sha512: "ddaf35a193617abacc417349ae20413112e6fa4e89a97ea20a9eeee64b55d39a2192992a274fc1a836ba3c23a3feebbd454d4423643ce80e2a9ac94fa54ca49f",
    };
    for (let k in hashs) {
      except = hashs[k];
      hash = await fs.getHash(file, k);
      self.showLog(k, except,  hash, except === hash);
    }
    await fs.unlink(file);

    if (IsAndroid) {
      file = 'drawable://notify_panel_notification_icon_bg'
      hash = await fs.getHash(file);
      except = 'e5e0e446cc8c3c56990cd94799d65598';
      self.showLog('drawable file hash', except, hash, except === hash);
    }
  }

  remoteFont = async () => {
    const self = this;
    const font = this.state.remoteFont;
    if (font) {
      self.showLog('font has loaded', true);
      return;
    }
    const file = dirs.Caches + '/remotefont.ttf';
    const url = "https://at.alicdn.com/t/font_3415031_w5ulq8d500h.ttf?t=1652968984755";
    await fetchPlus(url, {saveTo: file})
    await fs.loadFont('remotefont', file);
    this.setState({remoteFont: 1}, () => {
      self.showLog('load remoteFont success', true);
    });
  }

  localFont = async () => {
    const self = this;
    const font = this.state.localFont;
    if (font) {
      self.showLog('font has loaded', true);
      return;
    }
    await fs.loadFont('localFont', require('./localFont.ttf'));
    this.setState({localFont: 1}, () => {
      self.showLog('load localFont success', true);
    });
  }

  unzip = async () => {
    const self = this;
    const dir = dirs.Caches + '/_unzip_test_';
    const tmpFile = dirs.Caches + '/_unzip_test_.zip';
    const zipFile = RemoteZip;
    await fetchPlus({
      url: zipFile,
      saveTo: tmpFile
    });
    await fs.unzip(tmpFile, dir);

    // 普通解压
    let files;
    let actual={};
    let except = {
      "foo.txt": false,
      "sub": true,
    };
    
    files = await fs.readDir(dir);
    for (let f of files) {
      actual[f.name] = f.isDir;
    }
    self.showLog('check list', except, actual, JSON.stringify(except) === JSON.stringify(actual));

    actual={};
    except = {
      "bar.txt": false,
    };
    files = await fs.readDir(dir+'/sub');
    for (let f of files) {
      actual[f.name] = f.isDir;
    }
    self.showLog('check deep list', except, actual, JSON.stringify(except) === JSON.stringify(actual));

    actual = await fs.readFile(dir+'/foo.txt');
    self.showLog('check file', except = 'foo', actual, except === actual);

    actual = await fs.readFile(dir+'/sub/bar.txt');
    self.showLog('check deep file', except = 'bar', actual, except === actual);

    // 移除解压文件夹
    await fs.rmDir(dir, true);
    let isDir = await fs.isDir(dir);
    self.showLog('rm unzip dir', isDir, null === isDir);

    // 校验 md5 并解压
    try {
      await fs.unzip(tmpFile, dir, '13d36a40f4a77225b7a9f41fd1b9b9dd');
      self.showLog('unzip by error md5 shold exception', false);
    } catch(e) {
      isDir = await fs.isDir(dir);
      self.showLog('unzip by error md5 shold exception', isDir, null === isDir);
    }
    await fs.unzip(tmpFile, dir, '13d36a40f4a77225b7a9f41fd1b9b9e9');
    isDir = await fs.isDir(dir);
    self.showLog('unzip by correct md5', isDir, true === isDir);
    
    // 移除临时文件
    await fs.rmDir(dir, true);
    await fs.unlink(tmpFile);
  }

  reload = async () => {
    const rs = await fs.reload();
    this.prtLog('reload', rs)
  }

  getContentUri = async () => {
    let paths = [
      'images', 'video', 'audio', 'files', 'downloads',
      'audio.artists', 'audio.albums', 'audio.genres', 'audio.playlists'
    ], type, uri;
    for (type of paths) {
      uri = await fs.getContentUri(type);
      this.prtLog(type+':', uri)
    }
    type = 'images';
    uri = await fs.getContentUri(type, 'internal');
    this.prtLog(type+' internal:', uri)
  }
  
  getShareUri = async () => {
    let file, uri;
    file = dirs.Caches + '/_arch_test_667_.txt';
    await fs.writeFile(file, 'abc');
    uri = await fs.getShareUri(file);
    this.prtLog('share uri:', uri);
    await fs.unlink(file);
  }

  download = async () => {
    const self = this;
    await fs.download({
      url:RemoteJpg,
      title:'test download',
      description:'download desc',
      onProgress:e => {
        self.showLog('onProcess', e, true);
      },
      onComplete:e => {
        self.showLog('onComplete', e, true);
      },
      onError:e => {
        self.showLog('onError', e, true);
      }
    });
    self.showLog('onStart', true);
  }

  addDownload = async () => {
    const file = 'file://' + external.AppCaches + '/_arch_test_addown_.docx';
    const test = await fs.isDir(file);
    if (false !== test) {
      await fetchPlus({
        url:RemoteDoc,
        saveTo: file
      })
    }
    await fs.addDownload({
      file,
      title: 'test title',
      description: 'test desc',
    })
  }

  restartAndroid = async () => {
    const rs = await fs.restartAndroid();
    this.prtLog('restart', rs)
  }

  render() {
    const MyButton = this.createButton.bind(this);
    return <ScrollView style={{flex:1}}>
      <View style={{
        flexDirection:"row",
        flexWrap:"wrap",
        paddingTop:8,
      }}>
        <MyButton title="utilsFunc" onPress={this.utilsFunc} />
        <MyButton title="BlobPlus" onPress={this.blobPlus} />
        <MyButton title="RequestPlus.props" onPress={this.requestPlus_Props} />
        <MyButton title="RequestPlus.body" onPress={this.requestPlus_Body} />
        <MyButton title="ResponsePlus" onPress={this.responsePlus} />
        <MyButton title="fetchPlus" onPress={this.fetchPlus} />
        <MyButton title="HttpRequest.props" onPress={this.httpRequest_Props} />
        <MyButton title="HttpRequest.method" onPress={this.httpRequest_Method} />
        <MyButton title="HttpService" onPress={this.httpService} />
        <MyButton title="获取变量" onPress={this.showVars} />
        <MyButton title="fs.rmkDir" onPress={this.rmkDir}/>
        <MyButton title="fs.readDir" onPress={this.readDir}/>
        <MyButton title="fs.isDir" onPress={this.isDir}/>
        <MyButton title="fs.writeFile" onPress={this.writeFile}/>
        <MyButton title="fs.readFile" onPress={this.readFile}/>
        <MyButton title="fs.copyFile" onPress={this.copyFile}/>
        <MyButton title="fs.moveFile" onPress={this.moveFile}/>
        <MyButton title="fs.unlink" onPress={this.unlink}/>
        <MyButton title="fs.openFile" onPress={this.openFile}/>
        <MyButton title="fs.openFile2" onPress={this.openFile2}/>
        <MyButton title="fs.getMime" onPress={this.getMime}/>
        <MyButton title="fs.getExt" onPress={this.getExt}/>
        <MyButton title="fs.getHash" onPress={this.getHash}/>
        <MyButton title="fs.unzip" onPress={this.unzip}/>
        <MyButton title="fs.remoteFont" onPress={this.remoteFont}>
          {this.state.remoteFont ? <Text style={{
            fontFamily:'remotefont',
            color: 'white'
          }}>{unicode('&#xe8b9;')}</Text> : null}
        </MyButton>
        <MyButton title="fs.localFont" onPress={this.localFont}>
          {this.state.localFont ? <Text style={{
            fontFamily:'localFont',
            color: 'white'
          }}>{unicode('&#xe8c9;')}</Text> : null}
        </MyButton>
        <MyButton title="fs.reload" onPress={this.reload}/>
        <MyButton title="fs.getContentUri" android={true} onPress={this.getContentUri}/>
        <MyButton title="fs.getShareUri" android={true} onPress={this.getShareUri}/>
        <MyButton title="fs.download" android={true} onPress={this.download}/>
        <MyButton title="fs.addDownload" android={true} onPress={this.addDownload}/>
        <MyButton title="fs.restartAndroid" android={true} onPress={this.restartAndroid}/>
      </View>
    </ScrollView>
  }
}

export default ArchivesTest;