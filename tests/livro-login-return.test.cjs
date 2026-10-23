const {test}=require('node:test'),assert=require('node:assert/strict'),vm=require('node:vm'),fs=require('node:fs'),path=require('node:path');
test('login on a new phone preserves the Livro deep link without bypassing the admin guard',async()=>{
 let redirect;const context={window:{Club:{sb:{auth:{getSession:async()=>({data:{session:null}})}}}},location:{pathname:'/admin/',search:'',hash:'#livro',replace:v=>redirect=v}};
 vm.runInNewContext(fs.readFileSync(path.join(__dirname,'../public/assets/club-auth.js'),'utf8'),context);
 assert.equal(await context.window.Club.auth.require('admin'),null);
 const de=new URL('https://example.test'+redirect).searchParams.get('de');assert.equal(de,'/admin/#livro');
});
async function loginDestination(de,role){
 const html=fs.readFileSync(path.join(__dirname,'../public/entrar/index.html'),'utf8'),scripts=Array.from(html.matchAll(/<script>([\s\S]*?)<\/script>/g));let submit;
 const elements={loginForm:{addEventListener:(_,fn)=>submit=fn},erro:{hidden:true},submit:{},email:{value:'test@example.test'},senha:{value:'test',select(){}}};
 const location={search:'?de='+encodeURIComponent(de),hash:'',href:null,replace:v=>location.href=v};const Club={auth:{ready:async()=>null,login:async()=>({role}),homeFor:s=>s.role==='admin'?'/admin/':'/membros/'},icon:()=>'',esc:v=>v};
 vm.runInNewContext(scripts.at(-1)[1],{document:{getElementById:id=>elements[id]},location,Club,URLSearchParams});await submit({preventDefault(){}});await new Promise(r=>setImmediate(r));return location.href;
}
test('login accepts Livro for admins and denies external or member access',async()=>{
 assert.equal(await loginDestination('/admin/#livro','admin'),'/admin/#livro');
 assert.equal(await loginDestination('/admin/#livro','member'),'/membros/');
 for(const de of ['https://evil.example/','//evil.example/','/\\evil.example/','/admin/#livro<script>'])assert.equal(await loginDestination(de,'admin'),'/admin/');
});
