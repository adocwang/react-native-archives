import React from 'react';
import helper from './../helper';

const httpRequest_datas = async () => {
  const service = new helper.TestService();
  const logRequest = (tit, req, method, expected, obj) => {
    const data = req[method]();
    const actual = {...data};
    const eq = JSON.stringify(expected) === JSON.stringify(actual) 
      && (!obj || req === obj);
    helper.showLog(tit, expected, actual, eq);
  };
  const checkRequestData = (method) => {
    let obj, val;
    const req = service.request();
    const log = (tit, expected) => {
      logRequest(tit, req, method, expected, obj);
    }
    const Foo = 'header' === method ? 'Foo' : 'foo';
    helper.prtLog('✸✸ check request data ✸✸', method);

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
    helper.showLog(
      'get all', all, actual = {...actual},
      JSON.stringify(all) === JSON.stringify(actual)
    );

    // get one
    helper.showLog('get string', expected='f', actual = req[method](Foo), expected === actual);
    helper.showLog(
      'get array', expected=['b', 'z'], actual = req[method]('baz'),
      JSON.stringify(expected) === JSON.stringify(actual)
    );

    // get batch
    helper.showLog(
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

export default () => {
  return <helper.TestButton title="HttpRequest.datas" onPress={httpRequest_datas}/>
};