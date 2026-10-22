import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHandler} from '../supabase/functions/book-origin-webhook/handler.mjs';
const secret='x'.repeat(40),data={type:'sale',event:'saleUpdated',product:{id:199893},sale:{id:42,status:'paid',amount:99999},client:{email:'private@example.test'},saleMetas:[{meta_key:'utm_source',meta_value:'ig',sale_id:42},{meta_key:'utm_content',meta_value:'direct-post-123456',sale_id:42},{meta_key:'email',meta_value:'private@example.test'}]};
const req=(body,token=secret)=>new Request('https://example.test/?key='+token,{method:'POST',body:JSON.stringify(body)});
test('webhook requires its own secret and never trusts supplied financial values',async()=>{
 let write;const handler=createHandler({secret,url:'https://sb.test',key:'private-service-key',fetcher:async(url,options)=>{write=JSON.parse(options.body);return new Response(null,{status:201});}});
 assert.equal((await handler(req(data,'wrong'))).status,401);assert.equal(write,undefined);
 assert.equal((await handler(req(data))).status,200);assert.equal(write.sale_id,42);assert.equal(write.origin_mode,'greenn_webhook');assert.equal(write.utm_content,'direct-post-123456');assert.ok(!JSON.stringify(write).includes('private'));assert.equal(write.amount,undefined);
});
test('invalid product, conflicting sale metadata and invalid UTMs cannot overwrite origins',async()=>{
 const handler=createHandler({secret,url:'https://sb.test',key:'key',fetcher:()=>{throw Error('must not write');}});
 assert.equal((await handler(req({...data,product:{id:123}}))).status,202);
 assert.equal((await handler(req({...data,saleMetas:[{meta_key:'utm_content',meta_value:'email@example.test'}]}))).status,422);
 assert.equal((await handler(req({...data,saleMetas:[{meta_key:'utm_source',meta_value:'ig',sale_id:43}]}))).status,422);
 assert.equal((await handler(req({...data,saleMetas:[]}))).status,202);
 assert.equal((await handler(req({...data,saleMetas:[{meta_key:'utm_source',meta_value:'ig'},{meta_key:'utm_source',meta_value:'other'}]}))).status,422);
});
test('backend failures disclose no credentials; missing secret fails closed',async()=>{
 const h=createHandler({secret,url:'https://sb.test',key:'secret-key',fetcher:async()=>{throw Error('private');}});const r=await h(req(data));assert.equal(r.status,503);assert.ok(!(await r.text()).includes('private'));
 assert.equal((await createHandler({})(req(data))).status,503);
});
