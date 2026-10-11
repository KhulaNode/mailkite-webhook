'use strict';
const {test} = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const {createApp} = require('../index');

async function fixture(t) {
  const records=[];
  const server=createApp(r=>records.push(r)).listen(0,'127.0.0.1');
  await new Promise(resolve=>server.once('listening',resolve));
  t.after(()=>new Promise(resolve=>server.close(resolve)));
  const url='http://127.0.0.1:'+server.address().port;
  return {url,records};
}

test('health endpoint returns exact JSON', async t => {
  const {url,records}=await fixture(t);
  const response=await fetch(url+'/health');
  assert.equal(response.status,200);
  assert.deepEqual(await response.json(),{ok:true});
  assert.equal(records[0].method,'GET');
  assert(records[0].timestamp);
});

test('JSON retains its original formatting and Unicode bytes', async t => {
  const {url,records}=await fixture(t);
  const text=' { "subject": "Test 📬", "body": "line 1\\nline 2" }\n';
  const response=await fetch(url+'/hooks/mail',{method:'POST',headers:{'Content-Type':'application/json','X-Test':'mailkite'},body:text});
  assert.equal(response.status,200);
  assert.equal(await response.text(),'');
  const record=records[0];
  assert.equal(record.body,text);
  assert.equal(record.bodyBytes,Buffer.byteLength(text));
  assert.deepEqual(Buffer.from(record.bodyBase64,'base64'),Buffer.from(text));
  assert.deepEqual(record.json,JSON.parse(text));
  assert.equal(record.headers['x-test'],'mailkite');
});

test('raw text preserves line endings and all duplicate headers', async t => {
  const {url,records}=await fixture(t);
  const body=Buffer.from('Subject: mailkite\r\n\r\nBody\r\n');
  const status=await new Promise((resolve,reject)=>{
    const req=http.request(url+'/hooks/mail',{method:'POST',headers:[
      'Host',new URL(url).host,'Content-Type','text/plain','Content-Length',String(body.length),'X-Probe','one','X-Probe','two'
    ]},res=>{res.resume();res.on('end',()=>resolve(res.statusCode));});
    req.on('error',reject);req.end(body);
  });
  assert.equal(status,200);
  assert.deepEqual(Buffer.from(records[0].bodyBase64,'base64'),body);
  assert.equal(records[0].rawHeaders.filter(h=>h==='X-Probe').length,2);
});

test('malformed JSON is logged and acknowledged without rejection', async t => {
  const {url,records}=await fixture(t);
  const response=await fetch(url+'/hooks/mail',{method:'POST',headers:{'Content-Type':'application/json'},body:'{invalid'});
  assert.equal(response.status,200);
  assert.equal(records[0].body,'{invalid');
  assert(records[0].jsonParseError);
});

test('binary content is retained exactly in base64', async t => {
  const {url,records}=await fixture(t);
  const body=Buffer.from([0,255,128,13,10]);
  const response=await fetch(url+'/hooks/mail',{method:'POST',headers:{'Content-Type':'application/octet-stream'},body});
  assert.equal(response.status,200);
  assert.deepEqual(Buffer.from(records[0].bodyBase64,'base64'),body);
});
