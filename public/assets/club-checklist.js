/* Catálogo comum, carregado do banco antes de renderizar qualquer jornada. */
(function(root){
  'use strict';
  var C=root.Club=root.Club||{};
  function hydrate(stages,deliveries,items,bindings){
    var stageIds=new Set(stages.map(function(s){return s.id;}));
    var byId=new Map(deliveries.map(function(d){return [d.id,d];}));
    if(!stages.length||!deliveries.length||!items.length||
      deliveries.some(function(d){return !stageIds.has(d.stage_id);})||
      items.some(function(i){var d=byId.get(i.delivery_id);return !d||d.stage_id!==i.method_step;})){
      throw new Error('Catálogo de entregas indisponível ou incompleto. Recarregue a página.');
    }
    C.methodStages=stages.slice().sort(function(a,b){return a.position-b.position;});
    C.stepChecklist=items.slice().sort(function(a,b){return a.id.localeCompare(b.id);}).map(function(i){
      return {id:i.id,step:i.method_step,title:i.title,source:i.source,sourceDetail:i.source_detail,
        owner:i.owner,monthly:i.monthly,optional:i.optional,missionWeight:i.mission_weight,deliveryId:i.delivery_id};
    });
    C.methodDeliveries=deliveries.slice().sort(function(a,b){return a.position-b.position;}).map(function(d){
      return {id:d.id,step:d.stage_id,name:d.name,
        artifactIds:bindings.filter(function(b){return b.delivery_id===d.id;}).map(function(b){return b.artifact_id;}),
        items:C.stepChecklist.filter(function(i){return i.deliveryId===d.id;}).map(function(i){return i.id;})};
    });
    if(C.metodo)C.metodo.steps.sort(function(a,b){return C.methodStages.findIndex(function(s){return s.id===a.id;})-C.methodStages.findIndex(function(s){return s.id===b.id;});}).forEach(function(s){var row=stages.find(function(x){return x.id===s.id;});if(row){s.name=row.name;s.movement=row.movement;}});
    return C.methodDeliveries;
  }
  async function read(table){
    var all=[],offset=0;
    for(;;){var r=await C.sb.from(table).select('*').order(table==='cb_delivery_artifacts'?'delivery_id':'id').range(offset,offset+999);
      if(r.error)throw new Error('Não foi possível carregar o catálogo de entregas: '+r.error.message);
      all=all.concat(r.data||[]);if(!r.data||r.data.length<1000)return all;offset+=1000;}
  }
  C.loadMethodCatalog=async function(){
    var r=await Promise.all(['cb_method_stages','cb_deliveries','cb_checklist_catalog','cb_delivery_artifacts'].map(read));
    return hydrate(r[0],r[1],r[2],r[3]);
  };
  if(typeof module!=='undefined')module.exports={hydrate:hydrate};
})(typeof window==='undefined'?globalThis:window);
