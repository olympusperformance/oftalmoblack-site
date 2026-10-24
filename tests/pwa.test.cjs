const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const vm=require('node:vm');
const root=path.resolve(__dirname,'../public');
const manifest=JSON.parse(fs.readFileSync(path.join(root,'manifest.json'),'utf8'));
const origin='https://app.example.test';
function worker(fetch){
 const listeners={};
 const self={location:{origin},clients:{claim:async()=>{}},skipWaiting:async()=>{},addEventListener:(type,fn)=>{listeners[type]=fn;}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'pwa-sw.js'),'utf8'),{self,URL,Response,fetch});
 return (request)=>{let response;listeners.fetch({request,respondWith:p=>response=p});return response;};
}
test('manifest has stable identity, standalone launch and real required PNG icons',()=>{
 assert.equal(manifest.id,'/');assert.equal(manifest.scope,'/');assert.equal(manifest.display,'standalone');
 assert.ok(manifest.name);assert.ok(manifest.short_name);assert.equal(manifest.prefer_related_applications,false);
 assert.equal(new URL(manifest.start_url,origin).origin,origin);
 for(const size of [192,512]){
  const icon=manifest.icons.find(i=>i.sizes===`${size}x${size}`&&i.purpose==='any');assert.ok(icon);
  const png=fs.readFileSync(path.join(root,icon.src));
  assert.equal(png.subarray(0,8).toString('hex'),'89504e470d0a1a0a');
  assert.equal(png.readUInt32BE(16),size);assert.equal(png.readUInt32BE(20),size);
 }
});
test('online navigations preserve request, query parameters and server errors',async()=>{
 const request={url:origin+manifest.start_url+'?de=%2Fadmin%2F',method:'GET',mode:'navigate'};
 const response=new Response('upstream response',{status:403});let received;
 const dispatch=worker(async r=>{received=r;return response;});
 assert.equal(await dispatch(request),response);assert.equal(received,request);
});
test('offline navigation shows retry with no reflected URL or cached private data',async()=>{
 const dispatch=worker(async()=>{throw new TypeError('offline');});
 const response=await dispatch({url:origin+manifest.start_url+'?token=private-token',method:'GET',mode:'navigate'});
 assert.equal(response.status,503);assert.equal(response.headers.get('Cache-Control'),'no-store');
 const html=await response.text();assert.match(html,/Tentar novamente/);assert.doesNotMatch(html,/private-token/);
});
test('API requests, assets, external URLs and non-GET requests are untouched',()=>{
 const dispatch=worker(()=>{throw new Error('Must not fetch');});
 for(const request of [
  {url:origin+'/api/patient',method:'GET',mode:'cors'},
  {url:origin+'/assets/app.js',method:'GET',mode:'no-cors'},
  {url:'https://external.example.test/',method:'GET',mode:'navigate'},
  {url:origin+'/',method:'POST',mode:'navigate'}
 ])assert.equal(dispatch(request),undefined);
 if(manifest.start_url==='/entrar/')assert.equal(dispatch({url:origin+'/workshop/',method:'GET',mode:'navigate'}),undefined);
});
test('registration uses the domain root and bypasses stale worker HTTP cache',async()=>{
 let args;
 const navigator={serviceWorker:{register:async(...value)=>{args=value;}}};
 vm.runInNewContext(fs.readFileSync(path.join(root,'pwa-register.js'),'utf8'),{
  navigator,window:{isSecureContext:true},document:{readyState:'complete'},console
 });
 await Promise.resolve();assert.equal(args[0],'/pwa-sw.js');assert.equal(args[1].scope,'/');assert.equal(args[1].updateViaCache,'none');
});
