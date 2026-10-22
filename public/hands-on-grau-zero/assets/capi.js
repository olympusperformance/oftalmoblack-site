(() => {
  'use strict';
  const root=document.documentElement;
  const endpoint=root.dataset.capiEndpoint;
  const key=root.dataset.capiKey;
  if(!endpoint||!key)return;
  const query=new URLSearchParams(location.search);
  const qa=(query.get('utm_source')||'').toLowerCase()==='qa'||query.get('qa')==='1';
  const arrived=Math.round(performance.timeOrigin||Date.now());
  const cookie=(name)=>{
    try{return decodeURIComponent(document.cookie.split('; ').find(x=>x.startsWith(name+'='))?.slice(name.length+1)||'');}catch{return '';}
  };
  const context=()=>{
    const data={};
    for(const [name,cookieName]of [['fbp','_fbp'],['fbc','_fbc']]){
      const value=cookie(cookieName);
      if(/^fb\.\d+\.\d+\.[A-Za-z0-9_.-]+$/.test(value)&&value.length<=500)data[name]=value;
    }
    const click=query.get('fbclid')||'';
    // Use only a real click received on this visit; never create a click ID.
    if(click&&/^[A-Za-z0-9_.-]+$/.test(click)&&click.length<=400&&(!data.fbc||!data.fbc.endsWith('.'+click)))data.fbc='fb.1.'+arrived+'.'+click;
    return data;
  };
  window.handsOnCapi={endpoint,key,qa,context,visit(pageId){
    if(qa)return;
    fetch(endpoint,{method:'POST',headers:{'Content-Type':'text/plain;charset=UTF-8',apikey:key},credentials:'omit',keepalive:true,
      body:JSON.stringify({op:'visit',page_id:pageId,tracking:context()})}).catch(()=>{});
  }};
})();
