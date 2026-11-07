/* Part of the editor IIFE: what the markup calls must be put on window (HANDOFF §4). */

var BUILTIN_SAGA='Beginnings';
var SAGAS=[];
function sagasAll(){return new Promise(function(res){try{var r=tx('sagas','readonly').getAll();
  r.onsuccess=function(){res(r.result||[])};r.onerror=function(){res([])};}catch(_){res([]);}});}
/* The primary saga only, never membership: mergeKey is built on it, and a key that moved would bring a record with no cid back as a new card at the next load. */
function sagaIdOf(c){ return (c&&(c.sagaId||c.saga))||BUILTIN_SAGA; }
/* The fallback key for a record with no cid: saga + name, not the name alone, so an imported set cannot overlay another saga's card of the same name. */
function mergeKey(c){ return sagaIdOf(c)+'::'+normName(c.name||''); }
function sagaById(id){ return SAGAS.filter(function(s){return s.id===id;})[0]||null; }

/* Random, never worked out from the name: a new card is stamped while still "New Card 2", so a derived id gave every new card the same one (HANDOFF §12.1 I).
   Minted once and never changed; machines agree because the id travels with the card. */
function newCid(){
  var r='', n=12, buf=null;
  try{ buf=new Uint32Array(n); window.crypto.getRandomValues(buf); }catch(_){ buf=null; }
  for(var i=0;i<n;i++){
    var v=buf?buf[i]:Math.floor(Math.random()*4294967296);
    r+=(v%36).toString(36);
  }
  var id='c'+Date.now().toString(36)+r;
  if((window.CARDS||[]).some(function(c){ return c&&c.cid===id; }))return newCid();
  return id;
}
window.edNewCid=function(){ return newCid(); };
/* Does not write the id onto the card (ensureIds does, once), so a card without one gets a new id on every call. */
function cardCid(c){
  if(c&&c.cid)return c.cid;
  return newCid();
}
window.edCardCid=function(c){ return cardCid(c); };
function cidStampStored(stored){
  var todo=[];
  (stored||[]).forEach(function(r){ if(r&&!r.cid){ r.cid=newCid(); todo.push(r); } });
  if(!todo.length)return 0;
  try{
    var st=tx('cards','readwrite');
    todo.forEach(function(r){ try{ st.put(r); }catch(_){} });
  }catch(_){ return 0; }
  setMetaSafe('idModel',2);
  setMetaSafe('idModelAt',new Date().toISOString());
  return todo.length;
}
/* By cid first, as it survives a rename or a saga move, then saga + name for a card published before ids; on two cards with one id the first wins.
   Every check, apply, publish diff and import matches through this, so they cannot disagree. */
function cardIndex(list){
  var byCid={}, byKey={};
  /* It grows rather than being rebuilt: an import has to see the cards it has already added, and a rebuild per card walks the whole list each time. */
  var ix={
    add:function(c,i){
      if(!c)return;
      var id=c.cid; if(id&&byCid[id]==null)byCid[id]=i;
      var k=mergeKey(c); if(byKey[k]==null)byKey[k]=i;
    },
    at:function(c){
      if(c&&c.cid&&byCid[c.cid]!=null)return byCid[c.cid];
      var k=mergeKey(c||{});
      return byKey[k]==null?null:byKey[k];
    },
    has:function(c){ return this.at(c)!=null; }
  };
  (list||[]).forEach(function(c,i){ ix.add(c,i); });
  return ix;
}
window.edCidReport=function(){
  var cards=(window.CARDS||[]);
  var live={}, dupLive=[], noId=0;
  /* c.cid, not cardCid(), which mints a new id for a card without one, so every card would count as having one. */
  cards.forEach(function(c){
    var id=c&&c.cid;
    if(!id){ noId++; return; }
    if(live[id])dupLive.push({a:live[id],b:c.name,id:id}); else live[id]=c.name;
  });
  return new Promise(function(res){
    var out={cards:cards.length, dupLive:dupLive, noId:noId, stored:0, withCid:0,
             dupStored:[], orphans:[], when:''};
    var done=function(){ res(out); };
    getMeta('idModelAt').then(function(w){
      out.when=w||'';
      var r;
      try{ r=tx('cards','readonly').getAll(); }catch(_){ done(); return; }
      r.onerror=done;
      r.onsuccess=function(){
        var seen={};
        (r.result||[]).forEach(function(x){
          if(!x)return;
          out.stored++;
          if(!x.cid)return;
          out.withCid++;
          /* A deletion marker hides only the record it was written over, so one sharing a live card's id takes nothing from it and is no clash. */
          if(x.__deleted)return;
          if(seen[x.cid])out.dupStored.push({a:seen[x.cid],b:x.name,id:x.cid});
          else seen[x.cid]=x.name;
          if(!x.__deleted&&!live[x.cid])out.orphans.push({name:x.name,id:x.cid});
        });
        done();
      };
    },done);
  });
};

/* A group is one source, worked out from source.url and never stored, so a saga that changes its link changes group; only the choices persist (meta.sagaGroups). */
var GROUP_OFFICIAL='official', GROUP_LOCAL='local';
var SAGA_GROUPS={};
var OFFICIAL_IDS=null;

function normGroupUrl(u){
  return String(u||'').trim().replace(/\/+$/,'').toLowerCase();
}
/* The sagas counted as official before any index is fetched; not `builtin`, which is true of Beginnings alone. */
var _bakedSagas=null;
function bakedSagaIds(){
  if(_bakedSagas)return _bakedSagas;
  /* Empty in Rebirth: Beginnings and Infinite are the main game's, and Rebirth's catalog has no baked sagas. */
  if(window.REBIRTH){ _bakedSagas=[]; return _bakedSagas; }
  /* Written down, as the bake is empty and CARDS holds every synced card; anything newer is official because the index lists it (OFFICIAL_IDS, kept in meta.officialIds). */
  _bakedSagas=MAIN_OFFICIAL_SAGAS.slice();
  return _bakedSagas;
}
var MAIN_OFFICIAL_SAGAS=['Beginnings','Infinite'];
/* Official wins over the URL, so the built-in sagas land there before the index has been fetched. */
function groupKeyOf(sg){
  if(!sg)return GROUP_LOCAL;
  if(sg.source&&sg.source.table&&!sg.source.url)return 'table:'+String(sg.source.table);
  if(sg.builtin)return GROUP_OFFICIAL;
  if(bakedSagaIds().indexOf(sg.id)>=0)return GROUP_OFFICIAL;
  if(OFFICIAL_IDS&&OFFICIAL_IDS.indexOf(sg.id)>=0)return GROUP_OFFICIAL;
  var u=normGroupUrl(sg.source&&sg.source.url);
  if(!u)return GROUP_LOCAL;
  if(typeof GH_DEFAULT_SOURCE!=='undefined'&&u===normGroupUrl(GH_DEFAULT_SOURCE))
    return GROUP_OFFICIAL;
  return u;
}
function groupKeyOfId(id){
  return groupKeyOf(sagaById(id)||{id:id});
}
function edOfficialCard(c){
  if(!c)return false;
  /* A card made here (edNewCard stamps local) is yours whatever saga it names, or a new card in an official saga would be locked at once. */
  if(c.local)return false;
  return sagaIdsOf(c).some(function(id){
    var sg=sagaById(id); return !!sg&&groupKeyOf(sg)===GROUP_OFFICIAL; });
}
window.edOfficialCard=edOfficialCard;

/* Fails open: the first run() (cat_tail.js) fires before this file has parsed, and an unknown group answering off would blank the grid. */
function groupEnabled(key){
  var g=SAGA_GROUPS[key];
  return g?g.enabled!==false:true;
}
function groupCollapsed(key){
  var g=SAGA_GROUPS[key];
  return g?!!g.collapsed:(key!==GROUP_OFFICIAL);
}
function groupSet(key,patch){
  var g=SAGA_GROUPS[key]||(SAGA_GROUPS[key]={});
  Object.keys(patch).forEach(function(k){ g[k]=patch[k]; });
  setMetaSafe('sagaGroups',SAGA_GROUPS);
}
function sagaGroups(){
  var by={};
  SAGAS.forEach(function(sg){
    var k=groupKeyOf(sg);
    (by[k]=by[k]||{key:k,sagas:[],url:''}).sagas.push(sg);
    if(!by[k].url&&sg.source&&sg.source.url)by[k].url=sg.source.url;
  });
  if(by[GROUP_OFFICIAL]&&typeof GH_DEFAULT_SOURCE!=='undefined')
    by[GROUP_OFFICIAL].url=GH_DEFAULT_SOURCE;
  return Object.keys(by).map(function(k){
    var g=by[k];
    g.name=(k===GROUP_OFFICIAL)?'Official'
          :(k===GROUP_LOCAL)?'Not linked'
          :(String(k).indexOf('table:')===0)?groupLabel(k)
          :groupLabel(g.url);
    g.official=(k===GROUP_OFFICIAL);
    g.local=(k===GROUP_LOCAL);
    g.sagas.sort(function(a,b){ return String(a.name).localeCompare(String(b.name)); });
    return g;
  }).sort(function(a,b){
    return (b.official?1:0)-(a.official?1:0)
        || (a.local?1:0)-(b.local?1:0)
        || String(a.name).localeCompare(String(b.name));
  });
}
function groupLabel(url){
  var u=String(url||'');
  if(u.indexOf('table:')===0)return 'From '+u.slice(6);
  var m=/^https?:\/\/(?:raw\.githubusercontent\.com|github\.com)\/([^\/]+)\/([^\/]+)/i.exec(u);
  if(m)return m[1]+'/'+m[2];
  m=/^https?:\/\/cdn\.jsdelivr\.net\/gh\/([^\/@]+)\/([^\/@]+)/i.exec(u);
  if(m)return m[1]+'/'+m[2];
  try{ return u.split('/')[2]||u; }catch(_){ return u; }
}

/* Browse, search, the deck builder and Statistics all ask this, so a group's master switch is applied here and nowhere else. */
function sagaEnabled(id){
  var s=sagaById(id);
  if(!s)return true;
  if(s.enabled===false)return false;
  return groupEnabled(groupKeyOf(s));
}

/* sagaIds is the whole list, the head first, and setSagaList keeps sagaId equal to the head, so an older copy, reading [sagaId].concat(sagaIds), arrives at the same list. */
function sagaIdsOf(c){
  var list=(c&&Array.isArray(c.sagaIds))?c.sagaIds.filter(Boolean):[];
  var out=[];
  list.forEach(function(id){ if(out.indexOf(id)<0)out.push(id); });
  if(!out.length)out=[(c&&(c.sagaId||c.saga))||BUILTIN_SAGA];
  return out;
}
function inSaga(c,id){ return sagaIdsOf(c).indexOf(id)>=0; }
function isShared(c){ return sagaIdsOf(c).length>1; }
/* Every membership change comes through here; the paths that build a card's list whole write sagaIds and sagaId (its head) themselves. */
function setSagaList(c,list){
  var out=[];
  (list||[]).forEach(function(id){ if(id&&out.indexOf(id)<0)out.push(id); });
  if(!c||!out.length)return false;
  c.sagaIds=out;
  c.sagaId=out[0];
  /* c.saga names the head too, or an export labels the card with the wrong saga */
  if(c.saga){ var sg=sagaById(out[0]); c.saga=(sg&&sg.name)||out[0]; }
  return true;
}
function addSagaMembership(c,id){
  if(!c||!id||inSaga(c,id))return false;
  return setSagaList(c,sagaIdsOf(c).concat([id]));
}
function removeSagaMembership(c,id){
  if(!c||!id||!inSaga(c,id))return false;
  var left=sagaIdsOf(c).filter(function(x){return x!==id;});
  if(!left.length)return false;
  var wasHead=(sagaIdsOf(c)[0]===id);
  if(!setSagaList(c,left))return false;
  if(wasHead)promoteSagaFields(c,left[0]);
  return true;
}
/* The card's own fields are the head saga's printing, which every reader that ignores sagaFields takes straight off the card, so when the head goes the next saga's values move onto it. */
function promoteSagaFields(c,id){
  var ov=c&&c.sagaFields&&c.sagaFields[id];
  if(!ov)return false;
  SAGA_FIELDS.forEach(function(f){ if(ov[f]!==undefined)c[f]=ov[f]; });
  delete c.sagaFields[id];
  if(!Object.keys(c.sagaFields).length)delete c.sagaFields;
  return true;
}
/* Adds a membership rather than writing c.saga, which sagaIdOf reads only on a card with no sagaId, so writing that alone changed nothing. */
window.edAddCardSaga=function(nameOrId){
  var c=curCard();
  var want=String(nameOrId||'').trim();
  if(!c||!want)return Promise.resolve(false);
  var hit=SAGAS.filter(function(s){
    return s.id===want||normName(s.name||'')===normName(want); })[0];
  var id=hit?hit.id:want;
  if(inSaga(c,id)){
    toast('"'+c.name+'" is already in '+((hit&&hit.name)||id));
    return Promise.resolve(false);
  }
  if(!addSagaMembership(c,id))return Promise.resolve(false);
  markDirty(c);
  return persistCard(c).then(ensureSagaRecords).then(function(){
    applyToCatalog(); refreshSagaFilter();
    try{ window.edRenderSagaPage(); }catch(_){}
    try{ renderFields(); }catch(_){}
    toast('"'+c.name+'" added to '+((sagaById(id)||{}).name||id));
    return true;
  });
};
window.edRemoveCardSaga=function(id){
  var c=curCard();
  if(!c||!id)return Promise.resolve(false);
  /* a saga that comes from its source, as an official card's own does, is that source's to change */
  if(!sagaOpenFor(c,id)){
    toast('"'+((sagaById(id)||{}).name||id)+'" comes from its source, so the card stays in it');
    return Promise.resolve(false);
  }
  if(sagaIdsOf(c).length<2){
    toast('A card has to be in at least one saga');
    return Promise.resolve(false);
  }
  if(!removeSagaMembership(c,id))return Promise.resolve(false);
  srcDropSagaFields(c,id);
  markDirty(c);
  try{
    if(typeof window.edEditingSaga==='function'&&window.edEditingSaga()===id)
      window.edEditSaga(sagaIdsOf(c)[0]);
  }catch(_){}
  /* an official card out of the last saga of yours is read-only again */
  var shut=edCardLocked(c)&&!edLinkedSagas(c).length;
  return persistCard(c).then(function(){
    applyToCatalog(); refreshSagaFilter();
    try{ window.edRenderSagaPage(); }catch(_){}
    if(shut){ try{ window.edCloseEditor(); }catch(_){} }
    else{ try{ renderFields(); }catch(_){} }
    toast('"'+c.name+'" taken out of '+((sagaById(id)||{}).name||id));
    return true;
  });
};
/* Per saga, by the author's list: art choice, distributor, reminders shown, watermark, border and artist; the rest is shared. Another saga's values sit in c.sagaFields only where they differ.
   Add a field to SAGA_FIELDS, read it through cardForSaga and write it through setSagaField: all three or none (HANDOFF §5). */
var SAGA_FIELDS=['flavor','flavorRows','artist','designer','mark','variant','kwReminders','borderLook'];
/* Objects and lists as JSON: String() of any object is "[object Object]", which would call every border the same. */
function sagaFieldSame(a,b){
  var x=(a==null?'':a), y=(b==null?'':b);
  if(typeof x==='object'||typeof y==='object'){
    if(Array.isArray(x)&&!x.length)x='';
    if(Array.isArray(y)&&!y.length)y='';
    if(typeof x!=='object'||typeof y!=='object')return x===y;
    try{ return JSON.stringify(x)===JSON.stringify(y); }catch(_){ return false; }
  }
  return String(x)===String(y);
}
/* A synthesised copy, never a mutation, or the card itself when it has no per-saga values; its hidden __drawSaga (not enumerable, so nothing exports or compares it) tells variantOf which saga it is. */
function cardForSaga(c,sagaId){
  if(!c||!c.sagaFields||!sagaId)return c;
  var ov=c.sagaFields[sagaId]||{};
  var out=Object.assign({},c);
  SAGA_FIELDS.forEach(function(f){ if(ov[f]!==undefined)out[f]=ov[f]; });
  try{ Object.defineProperty(out,'__drawSaga',{value:sagaId,enumerable:false}); }catch(_){}
  return out;
}
/* The head saga's value is the card's own field, and an override equal to it is deleted, so a one-saga card never carries sagaFields. */
function setSagaField(c,sagaId,field,val){
  if(!c||SAGA_FIELDS.indexOf(field)<0)return false;
  if(!sagaId||sagaId===sagaIdOf(c)||!inSaga(c,sagaId)){
    if(val===undefined||(Array.isArray(val)&&!val.length&&field==='kwReminders'))delete c[field];
    else c[field]=val;
    return true;
  }
  var same=sagaFieldSame(c[field],val);
  var bag=c.sagaFields&&c.sagaFields[sagaId];
  if(same){
    if(bag){ delete bag[field];
      if(!Object.keys(bag).length)delete c.sagaFields[sagaId];
      if(c.sagaFields&&!Object.keys(c.sagaFields).length)delete c.sagaFields; }
    return true;
  }
  if(!c.sagaFields)c.sagaFields={};
  if(!c.sagaFields[sagaId])c.sagaFields[sagaId]={};
  c.sagaFields[sagaId][field]=val;
  return true;
}
function captureSagaFields(dst,src,sagaId){
  if(!dst||!src||!sagaId||sagaId===sagaIdOf(dst))return 0;
  var n=0;
  SAGA_FIELDS.forEach(function(f){
    /* A variant id names a look in src's own list, meaningless on dst: selectSagaVariant matches the picture instead. */
    if(f==='variant')return;
    var v=src[f];
    if(v===undefined||v===''||v===null)return;
    if(sagaFieldSame(dst[f],v))return;
    if(setSagaField(dst,sagaId,f,v))n++;
  });
  return n;
}
var _editSaga=null, _editSagaFor=null;
/* A card made here is yours in every saga it names; any other has a saga's values, and its place in it, from that saga's source. */
function sagaOpenFor(c,id){ return !!c&&(!!c.local||ownsGroupKey(groupKeyOfId(id))); }
window.edSagaOpenFor=function(c,id){ return sagaOpenFor(c,id); };
/* On an official card in a saga of yours (edLinkedSagas) it is always one of yours: the official saga's values are the official set's. */
window.edEditingSaga=function(){
  var c=curCard(); if(!c)return null;
  if(_editSagaFor!==c.__id){ _editSagaFor=c.__id; _editSaga=null; }
  var mine=edLinkedSagas(c);
  if(_editSaga&&inSaga(c,_editSaga)&&(!mine.length||mine.indexOf(_editSaga)>=0))return _editSaga;
  return mine.length?mine[0]:sagaIdOf(c);
};
window.edEditSaga=function(id){
  var c=curCard(); if(!c||!id||!inSaga(c,id))return;
  /* a saga that comes from its source has its values from there */
  if(!sagaOpenFor(c,id)){
    toast('"'+((sagaById(id)||{}).name||id)+'" comes from its source and is read-only here');
    return;
  }
  _editSagaFor=c.__id; _editSaga=id;
  try{ renderFields(); }catch(_){}
  try{ renderPreview(c); }catch(_){}
};
window.edCardForSaga=function(c,id){ return cardForSaga(c,id); };
/* For drawing only: the card being edited is drawn as the saga being edited, every other card as edSagaOf says; filtering asks edSagaOf. */
window.edDrawSaga=function(c){
  try{
    var cur=curCard();
    if(cur&&c&&c.__id===cur.__id&&document.body.classList.contains('editor-active')){
      var sid=window.edEditingSaga();
      if(sid&&inSaga(cur,sid))return sid;
    }
  }catch(_){}
  return window.edSagaOf(c);
};
function selectSagaVariant(c,sagaId,key){
  var vs=cardVariants(c);
  if(!vs||!key||!sagaId||!inSaga(c,sagaId))return false;
  var hit=vs.filter(function(v){ return v&&(v.imageUrl===key||v.art===key); })[0];
  if(!hit)return false;
  return setSagaField(c,sagaId,'variant',hit.id);
}
function sagaPictureOf(c,sagaId){
  var v=variantOf(cardForSaga(c,sagaId));
  return (v&&(v.imageUrl||v.art))||'';
}
window.edSetSagaField=function(c,id,f,v){ return setSagaField(c,id,f,v); };
window.edSagaFieldList=function(){ return SAGA_FIELDS.slice(); };

function normText(s){
  return String(s==null?'':s).replace(/[‘’']/g,'')
    .replace(/\s+/g,' ').trim().toLowerCase();
}
/* One card in two sagas: name, type line, rules, cost and stats agree. Art is left out, as two pictures of one card are two variants.
   typeLine and cardOrbs are called, not redone: a card's stats can be in orbs[] or in the legacy flat fields, fused ("4A") or not. */
function shareSig(c){
  if(!c)return '';
  var orbs=[];
  try{
    orbs=(cardOrbs(c)||[]).map(function(o){
      return String(o.type||'')+':'+String(o.value==null?'':o.value); }).sort();
  }catch(_){
    orbs=[String(c.attack||''),String(c.health||''),String(c.arcane||'')];
  }
  var tl='';
  try{ tl=typeLine(c); }
  catch(_){ tl=(c.superTypes||[]).join(' ')+' '+(c.subTypes||[]).join(' '); }
  /* Built, never an escape sequence or a literal control byte in this file (HANDOFF §0); any character no card text contains will do. */
  var SEP=String.fromCharCode(1);
  return [normName(c.name||''),normText(tl),normText(c.ruleText),
          normText(c.manaCost),orbs.join(',')].join(SEP);
}

window.edSagas=function(){ return SAGAS.map(function(s){return Object.assign({},s);}); };
/* Sent to the table (Sync Cards with Host, cat_online.js) and hashed for the lobby (tblSetHash); cached until a card changes (_cardGen) or a saga is switched on or off. */
var _sumCache={key:'',val:null};
window.edSagaSummary=function(){
  var cards=window.CARDS||[];
  var pend={};
  try{
    srcAll().forEach(function(x){
      var st=srcState(x);
      if(st&&st.pkg&&st.diff&&(st.diff.added||st.diff.changed||st.diff.removed))pend[x.key]=1;
    });
  }catch(_){}
  var key=cards.length+':'+(typeof _cardGen!=='undefined'?_cardGen:0)+':'
    +(SAGAS||[]).map(function(s){ return s.id+(sagaEnabled(s.id)?'1':'0')+groupKeyOf(s); }).join(',')
    +':'+Object.keys(pend).join(',');
  if(_sumCache.key===key&&_sumCache.val)return _sumCache.val;
  var by={};
  cards.forEach(function(c){
    if(!c||c.__deleted||c.testing)return;
    sagaIdsOf(c).forEach(function(id){ (by[id]=by[id]||[]).push(c); });
  });
  var out=(SAGAS||[]).map(function(sg){
    var list=by[sg.id]||[];
    var sigs=list.map(function(c){ return shareSig(c); }).sort();
    var k=groupKeyOf(sg), table=k.indexOf('table:')===0;
    var url=(k===GROUP_OFFICIAL)?(GH_SOURCE||GH_DEFAULT_SOURCE)
           :(table||k===GROUP_LOCAL)?'':((sg.source&&sg.source.url)||'');
    return {id:sg.id, name:sg.name||sg.id, url:url, n:list.length,
            h:ghFingerprint(sigs.join(String.fromCharCode(10))), on:sagaEnabled(sg.id),
            official:k===GROUP_OFFICIAL, table:table,
            own:(k!==GROUP_LOCAL&&!table&&ownsGroupKey(k)), pend:!!pend[k]};
  }).filter(function(x){ return x.n>0; });
  _sumCache={key:key,val:out};
  return out;
};
window.edTurnOnSaga=function(id){
  var sg=sagaById(id); if(!sg)return Promise.resolve(false);
  var k=groupKeyOf(sg);
  if(!groupEnabled(k))groupSet(k,{enabled:true});
  var done=function(){
    try{ if(typeof window.run==='function')window.run(); }catch(_){}
    try{ window.edRenderSagaPage(); }catch(_){}
    return true;
  };
  if(sg.enabled===false){ sg.enabled=true; return sagaPut(sg).then(done); }
  return Promise.resolve(done());
};
window.edSagaSourceKey=function(id){ var sg=sagaById(id); return sg?groupKeyOf(sg):''; };
/* Not sagaIdOf: the browse filter (cat_core.js) asks for one saga per card and tests it for enabled and for selected, so a shared card answers the selected saga when it is in it, else its first enabled one. */
/* The element is cached, not its value: this runs for every shared card in run()'s loop; looked up again if a re-render has detached it. */
var _fsagaEl=null;
function _fsagaValue(){
  if(!_fsagaEl || !_fsagaEl.isConnected) _fsagaEl=document.getElementById('fsaga');
  return (_fsagaEl&&_fsagaEl.value)||'';
}
window.edSagaOf=function(c){
  var ids=sagaIdsOf(c);
  if(ids.length<2)return ids[0];
  var sel=_fsagaValue();
  if(sel&&ids.indexOf(sel)>=0)return sel;
  for(var i=0;i<ids.length;i++){ if(sagaEnabled(ids[i]))return ids[i]; }
  return ids[0];
};
window.edSagaEnabled=sagaEnabled;
window.edSagaIdsOf=function(c){ return sagaIdsOf(c); };

var BUILTIN_DEFAULTS={saga:BUILTIN_SAGA,designer:'Conjure UCG LLC 2026',
                      revision:'Rev 1.0',artist:'Midjourney'};
function normalizeBuiltins(){
  var n=0;
  (window.CARDS||[]).forEach(function(c){
    var touched=false;
    Object.keys(BUILTIN_DEFAULTS).forEach(function(k){
      if(c[k]===undefined||String(c[k]).trim()===''){ c[k]=BUILTIN_DEFAULTS[k]; touched=true; }
    });
    if(!c.sagaId){ c.sagaId=c.saga||BUILTIN_SAGA; touched=true; }
    if(touched)n++;
  });
  return n;
}
window.edNormalizeBuiltins=normalizeBuiltins;
var SAGA_ID_MAX=200;
function sagaIdOk(id){
  return typeof id==='string' && id.length>0 && id.length<=SAGA_ID_MAX && !/[\x00-\x1f\x7f]/.test(id);
}
/* A saga's own words, published in sagas.json (ghSagaIndex), with a table copy's limits (edImportTableCopy). */
var SAGA_INFO_KEYS=['author','version','description'], SAGA_INFO_MAX={author:80,version:20,description:2000};
function sagaInfoClean(k,v){
  if((typeof v==='number'&&isFinite(v))||typeof v==='boolean')v=String(v);
  if(typeof v!=='string')return '';
  v=v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').slice(0,SAGA_INFO_MAX[k]||200);
  return k==='description'?v.replace(/\r\n?/g,'\n').trim():v.replace(/\s+/g,' ').trim();
}
function sagaRecordClean(sg){
  if(!sg||typeof sg!=='object'||Array.isArray(sg)||!sagaIdOk(sg.id))return null;
  var r=Object.assign({},sg);
  r.name=(typeof r.name==='string'&&r.name.trim())?r.name.slice(0,SAGA_ID_MAX):r.id;
  ['author','version','description'].forEach(function(k){
    if(r[k]!=null&&typeof r[k]!=='string')r[k]=String(r[k]); });
  return r;
}
/* `from`, when a source or a table copy brought the saga: {url} or {table}, {names} and {info} (srcCtx), so a new record is filed under it, named
   and described as it names and describes the saga. */
function ensureSagaRecords(from){
  from=(from&&typeof from==='object'&&!Array.isArray(from))?from:null;
  var seen={}; SAGAS.forEach(function(s){seen[s.id]=1;});
  var add=[];
  (window.CARDS||[]).forEach(function(c){
    sagaIdsOf(c).forEach(function(id){
      if(seen[id])return; seen[id]=1;
      var nm=from&&from.names&&from.names[id];
      var inf=(from&&from.info&&from.info[id])||{};
      add.push({id:id,name:(typeof nm==='string'&&nm.trim())?nm.slice(0,SAGA_ID_MAX):id,
        author:(inf.author!==undefined?inf.author:(id===BUILTIN_SAGA?'Conjure UCG LLC':'')),
        version:inf.version||'1.0',description:inf.description||'',
        builtin:id===BUILTIN_SAGA&&!window.REBIRTH,enabled:true,
        /* Stamped although the two games' databases are apart: a backup can be carried into the wrong game by hand. */
        mode:(window.REBIRTH?'rebirth':'main'),
        look:null,
        source:(from&&from.url&&!from.official)?{url:from.url,lastSync:null}
              :(from&&from.table)?{url:'',table:from.table,lastSync:null}
              :{url:'',lastSync:null},
        created:new Date().toISOString(),updated:new Date().toISOString()});
    });
  });
  if(!add.length)return Promise.resolve(SAGAS);
  SAGAS=SAGAS.concat(add);
  return Promise.all(add.map(function(r){return put('sagas',r);})).then(function(){return SAGAS;});
}

function sagaCards(id){ return (window.CARDS||[]).filter(function(c){return inSaga(c,id);}); }
function sagaOwnCards(id){
  return (window.CARDS||[]).filter(function(c){ return inSaga(c,id)&&!isShared(c); });
}
function sagaPut(rec){ rec.updated=new Date().toISOString();
  var i=SAGAS.findIndex(function(x){return x.id===rec.id;});
  if(i>=0)SAGAS[i]=rec; else SAGAS.push(rec);
  return put('sagas',rec); }
function refreshSagaFilter(){
  var sel=document.getElementById('fsaga'); if(!sel)return;
  var cur=sel.value;
  sel.innerHTML="<option value=''>All sagas</option>"
    +SAGAS.slice().sort(function(a,b){return String(a.name).localeCompare(String(b.name));})
      .map(function(s){return "<option value='"+e(s.id)+"'"+(cur===s.id?' selected':'')+">"+e(s.name)+"</option>";}).join('');
}
window.edSetSagaEnabled=function(id,on){
  var sg=sagaById(id); if(!sg)return;
  sg.enabled=!!on;
  sagaPut(sg).then(function(){
    try{ if(typeof window.run==='function')window.run(); }catch(_){}
    window.edRenderSagaPage();
  });
};
/* Writes the group's own flag, never its sagas', so switching a repo off and on again brings back the boxes that were ticked. */
window.edSetGroupEnabled=function(key,on){
  groupSet(key,{enabled:!!on});
  try{ if(typeof window.run==='function')window.run(); }catch(_){}
  window.edRenderSagaPage();
};
window.edToggleGroup=function(key){
  groupSet(key,{collapsed:!groupCollapsed(key)});
  window.edRenderSagaPage();
};
window.edSagaGroups=function(){ return sagaGroups(); };
window.edSetSagaLook=function(id,useAuthor){
  var sg=sagaById(id); if(!sg)return;
  sg.useAuthorLook=!!useAuthor;
  sagaPut(sg).then(function(){
    if(sg.useAuthorLook && sg.look){ applyPackBody(sg.look); }
    window.edRenderSagaPage();
  });
};
function sagaDeletable(sg){
  if(!sg||sg.builtin||sg.id===BUILTIN_SAGA)return false;
  if(groupKeyOf(sg)===GROUP_OFFICIAL){
    try{ return !!edOwnerUnlocked(); }catch(_){ return false; }
  }
  return true;
}
window.edSagaDeletable=function(id){ return sagaDeletable(sagaById(id)); };
window.edDeleteSaga=function(id){
  var sg=sagaById(id); if(!sg||sg.builtin)return;
  if(!sagaDeletable(sg)){ toast('Official sagas cannot be deleted'); return; }
  var doomed=sagaOwnCards(id);
  var shared=sagaCards(id).filter(isShared);
  var withArt=doomed.filter(function(c){
    var v=variantOf(c); return !!(v.art||v.imageUrl); }).length;
  edDangerGate({
    title:'Delete saga "'+sg.name+'"',
    lose:['All '+doomed.length+' card(s) this saga is the only home for'
            +(withArt?', '+withArt+' of them illustrated':''),
          'The saga record itself, including its author look',
          'Tombstones are written, so a reload will not bring them back']
      .concat(shared.length
        ? [shared.length+' card(s) shared with another saga are KEPT - they only '
           +'stop being part of this one']
        : []),
    phrase:'DELETE',
    requireBackup:true,
    proceedLabel:'Delete saga and '+doomed.length+' card(s)'
  }).then(function(ok){ if(ok)_deleteSaga(sg,id,doomed,shared); else toast('Cancelled - nothing was changed'); });
};
function _deleteSaga(sg,id,doomed,shared){
  var gone={}; doomed.forEach(function(c){ gone[c.__id]=1; });
  window.CARDS=(window.CARDS||[]).filter(function(c){return !gone[c.__id];});
  (shared||[]).forEach(function(c){ removeSagaMembership(c,id); markDirty(c); });
  SAGAS=SAGAS.filter(function(x){return x.id!==id;});
  try{ if(typeof srcSkipSaga==='function')srcSkipSaga(groupKeyOf(sg),id); }catch(_){}
  /* Tombstones carry the card's cid: the boot merge matches by cid first, and one holding only saga and name stops matching once either moves, so the card comes back. */
  Promise.all(doomed.map(function(c){return put('cards',{id:c.id||uid(),name:c.name,
      cid:cardCid(c),sagaId:sagaIdOf(c),saga:sg.name,__deleted:true});})
    .concat((shared||[]).map(persistCard)))
    .then(function(){ return del('sagas',id); })
    .then(function(){ applyToCatalog(); refreshSagaFilter(); window.edRenderSagaPage();
      toast('Deleted "'+sg.name+'"'+((shared&&shared.length)
        ? ' - '+shared.length+' shared card(s) kept':'')); });
}
/* One saga's form at a time; what is typed is kept (_sgDraft), as a check finishing draws the page again. */
var _sgEditing=null, _sgDraft=null;
function sagaInfoEditable(sg){
  if(!sg)return false;
  try{ return ownsGroupKey(groupKeyOf(sg)); }catch(_){ return false; }
}
window.edSagaInfoEditable=function(id){ return sagaInfoEditable(sagaById(id)); };
function sagaEditHTML(sg){
  var k=e(sg.id), d=(_sgDraft&&_sgDraft.id===sg.id)?_sgDraft:sg;
  return "<div class='sg-edit'>"
    +"<label for='sgEdAuthor'>Author</label><input class='ed2-in' id='sgEdAuthor' type='text' maxlength='80'"
      +" autocomplete='off' value=\""+e(d.author||'')+"\">"
    +"<label for='sgEdVersion'>Version</label><input class='ed2-in' id='sgEdVersion' type='text' maxlength='20'"
      +" autocomplete='off' placeholder='1.0' value=\""+e(d.version==null?'1.0':d.version)+"\">"
    +"<label for='sgEdDesc'>Description</label><textarea class='ed2-in' id='sgEdDesc' maxlength='2000' rows='3'>"
      +e(d.description||'')+"</textarea>"
    +"<div class='sg-edit-btns'><button class='ed2-btn tiny close-x' data-sg-cancel='"+k+"'>Close &#10005;</button>"
      +"<button class='ed2-btn tiny primary' data-sg-save='"+k+"'>Save</button></div>"
  +"</div>";
}
function sagaEditValues(){
  var g=function(id){ var el=document.getElementById(id); return el?el.value:undefined; };
  return {author:g('sgEdAuthor'), version:g('sgEdVersion'), description:g('sgEdDesc')};
}
window.edEditSagaInfo=function(id){
  var sg=sagaById(id);
  if(!sagaInfoEditable(sg)){ toast('This saga comes from its source and is read-only here'); return false; }
  _sgEditing=id; _sgDraft=null;
  window.edRenderSagaPage();
  try{ var el=document.getElementById('sgEdAuthor'); if(el)el.focus(); }catch(_){}
  return true;
};
window.edCancelSagaInfo=function(){ _sgEditing=null; _sgDraft=null; window.edRenderSagaPage(); };
/* Kept here until the next Publish, which sends them in sagas.json; a follower takes them at its next check (srcTakeSagaInfo). */
window.edSaveSagaInfo=function(id,vals){
  var sg=sagaById(id);
  if(!sagaInfoEditable(sg)){ toast('This saga comes from its source and is read-only here'); return Promise.resolve(false); }
  vals=(vals&&typeof vals==='object')?vals:sagaEditValues();
  var rec=Object.assign({},sg), ch=false;
  SAGA_INFO_KEYS.forEach(function(k){
    if(vals[k]===undefined)return;
    var v=sagaInfoClean(k,vals[k]);
    if(k==='version'&&!v)v='1.0';
    if((rec[k]||'')!==v){ rec[k]=v; ch=true; }
  });
  _sgEditing=null; _sgDraft=null;
  if(!ch){ window.edRenderSagaPage(); return Promise.resolve(false); }
  return sagaPut(rec).then(function(){
    window.edRenderSagaPage();
    toast('Saved "'+(rec.name||rec.id)+'" - Publish sends it');
    return true;
  });
};
function sagaRowHTML(sg){
  var list=sagaCards(sg.id), n=list.length;
  var orph=list.filter(function(c){return c&&c.orphan;}).length;
  var shr=list.filter(isShared).length;
  var edit=sagaInfoEditable(sg);
  return "<div class='sg-row"+(sg.enabled===false?' off':'')+"'>"
    +"<div class='sg-main'><b>"+e(sg.name)+"</b>"
      +(orph?"<span class='sg-tag orph' title='Cards their source no longer lists. "
            +"Nothing was deleted.'>"+orph+" orphaned</span>":"")
      +(shr?"<span class='sg-tag shr' title='Identical cards this saga holds jointly "
            +"with another. Editing one changes it in both.'>"+shr+" shared</span>":"")
      +"<span class='sg-meta'>"+e(sg.author||'-')+" · v"+e(sg.version||'1.0')+" · "+n+" cards"
      +(shr?" ("+(n-shr)+" its own, "+shr+" shared)":"")+"</span>"
      +(sg.description?"<div class='sg-sub'>"+e(sg.description)+"</div>":"")
      +"<span class='sg-head-gap'></span>"
      /* The saga id is data (data-sg-*), read by sgListBind: it comes with a followed source or a table copy, so it never goes into a handler's code. */
      +"<label class='sg-ck'><input type='checkbox'"+(sg.enabled!==false?' checked':'')
        +" data-sg-on='"+e(sg.id)+"'> Enabled</label>"
      +(sg.look?("<label class='sg-ck'><input type='checkbox'"+(sg.useAuthorLook?' checked':'')
        +" data-sg-look='"+e(sg.id)+"'> Author look</label>"):"")
      +(edit?"<button class='ed2-btn tiny' data-sg-edit='"+e(sg.id)+"'"+(_sgEditing===sg.id?' disabled':'')
        +" aria-label='Edit the author, version and description of "+e(sg.name)+"'>Edit</button>":"")
      +(sagaDeletable(sg)?"<button class='ed2-btn tiny warn' data-sg-del='"+e(sg.id)+"'"
        +" aria-label='Delete the saga "+e(sg.name)+"'>Delete</button>":"")
    +"</div>"
    +((edit&&_sgEditing===sg.id)?sagaEditHTML(sg):"")
  +"</div>";
}

function groupHeadHTML(g){
  var open=!groupCollapsed(g.key);
  var many=g.sagas.length>1;
  var on=groupEnabled(g.key);
  var cards=g.sagas.reduce(function(t,s){ return t+sagaCards(s.id).length; },0);
  var table=String(g.key).indexOf('table:')===0;
  return "<div class='sg-group-head'>"
    +(many?"<button class='sg-caret"+(open?' open':'')+"' title='Show the sagas in this "
          +"repository' aria-label='Show or hide the sagas of "+e(g.name)+"'"
          +" aria-expanded='"+(open?'true':'false')+"' data-gk-caret='"+e(g.key)+"'>▸</button>"
          :"<span class='sg-caret-gap'></span>")
    +"<b class='sg-gname'>"+e(g.name)+"</b>"
    /* Its own modifier: .sg-tag is worn by the orphan and shared badges too, which must not turn green. */
    +(g.official?"<span class='sg-tag ofc'>Official</span>":"")
    +(table?"<span class='sg-tag tcopy'>Table Copy</span>":"")
    +"<span class='sg-meta'>"+g.sagas.length+(g.sagas.length===1?' saga':' sagas')
      +" · "+cards+" cards</span>"
    +"<span class='sg-head-gap'></span>"
    +(g.local?"":"<label class='sg-ck' title='Switch the whole repository off without "
      +"changing the boxes underneath'><input type='checkbox'"+(on?' checked':'')
      +" data-gk-on='"+e(g.key)+"'> Enabled</label>")
    +"</div>"
    /* Read-only: a source is followed from the Follow row and left with Stop following, never re-pointed here. */
    +((g.local||table)?"":"<div class='sg-group-src'>"
      +"<input class='ed2-in tiny sg-url' type='text' readonly value=\""+e(g.url||'')+"\""
      +(g.official?" title='Built in - this is where the official sagas come from'":"")+">"
      +srcStatusHTML(g)
      +"</div>");
}
/* The buttons carry the source in data-k: an address never goes inside an onclick. */
function srcStatusHTML(g){
  if(typeof srcByKey!=='function')return '';
  var s=srcByKey(g.key);
  if(!s)return "<span class='sg-src'><button class='ed2-btn tiny primary' data-u=\""+e(g.url||'')
    +"\" onclick='edFollowSource(this.dataset.u)'>Follow</button></span>";
  var st=srcState(s)||{}, msg='', cls='';
  if(st.busy)msg='Checking\u2026';
  else if(st.err){ msg='Could not check: '+st.err; cls=' warn'; }
  else if(st.diff){
    var d=st.diff;
    if(d.added||d.changed||d.removed){
      msg='Update available \u2014 '+d.added+' new, '+d.changed+' changed, '+d.removed+' removed';
      cls=' on';
    } else msg='Up to date';
  }
  var pending=!!(st.pkg&&st.diff&&(st.diff.added||st.diff.changed||st.diff.removed));
  var k=e(s.key);
  return "<span class='sg-src'>"
    +"<button class='ed2-btn tiny' data-k='"+k+"' onclick='edGhCheckSource(this.dataset.k)'"
      +(st.busy?' disabled':'')+">Check now</button>"
    +(pending?"<button class='ed2-btn tiny on' data-k='"+k+"' onclick='edApplySource(this.dataset.k)'>Apply update</button>":"")
    +(s.official?"":"<button class='ed2-btn tiny warn' data-k='"+k+"' onclick='edUnfollowSource(this.dataset.k)'>Stop following</button>")
    +"<span class='sg-stamp'>last checked "+e(stampText(s.official
        ?(st.checked||(_srcCheckedAt[s.key]?new Date(_srcCheckedAt[s.key]).toISOString():''))
        :s.lastCheck))
      +(s.official?"":" \u00b7 last synced "+e(stampText(s.lastSync)))+"</span>"
    +(msg?"<span class='sg-msg"+cls+"'>"+e(msg)+"</span>":"")
  +"</span>";
}

function sgListBind(host){
  if(!host||host._sgBound)return;
  host._sgBound=true;
  host.addEventListener('change',function(ev){
    var t=ev.target; if(!t||typeof t.getAttribute!=='function')return;
    var v=t.getAttribute('data-sg-on');
    if(v!=null)return window.edSetSagaEnabled(v,t.checked);
    v=t.getAttribute('data-sg-look');
    if(v!=null)return window.edSetSagaLook(v,t.checked);
    v=t.getAttribute('data-gk-on');
    if(v!=null)return window.edSetGroupEnabled(v,t.checked);
  });
  host.addEventListener('click',function(ev){
    var b=(ev.target&&ev.target.closest)
      ?ev.target.closest('[data-sg-del],[data-gk-caret],[data-sg-edit],[data-sg-save],[data-sg-cancel]'):null;
    if(!b||!host.contains(b))return;
    if(b.hasAttribute('data-sg-del'))return window.edDeleteSaga(b.getAttribute('data-sg-del'));
    if(b.hasAttribute('data-sg-edit'))return window.edEditSagaInfo(b.getAttribute('data-sg-edit'));
    if(b.hasAttribute('data-sg-save'))return window.edSaveSagaInfo(b.getAttribute('data-sg-save'));
    if(b.hasAttribute('data-sg-cancel'))return window.edCancelSagaInfo();
    return window.edToggleGroup(b.getAttribute('data-gk-caret'));
  });
  host.addEventListener('input',function(ev){
    if(!_sgEditing||!ev.target||!ev.target.closest||!ev.target.closest('.sg-edit'))return;
    _sgDraft=Object.assign({id:_sgEditing},sagaEditValues());
  });
  host.addEventListener('keydown',function(ev){
    if(!_sgEditing||!ev.target||!ev.target.closest||!ev.target.closest('.sg-edit'))return;
    if(ev.key==='Escape'){ ev.preventDefault(); window.edCancelSagaInfo(); }
    else if(ev.key==='Enter'&&ev.target.tagName!=='TEXTAREA'){ ev.preventDefault(); window.edSaveSagaInfo(_sgEditing); }
  });
}
window.edRenderSagaPage=function(){
  var host=document.getElementById('sgList'); if(!host)return;
  refreshSagaFilter();
  if(!SAGAS.length){ host.innerHTML="<i class='tpl-hint'>No sagas yet.</i>"; return; }
  var shown={}; var groups=sagaGroups();
  groups.forEach(function(g){ shown[g.key]=1; });
  var waiting=(typeof SOURCES!=='undefined'?SOURCES:[]).map(function(x){ return srcWrap(x); })
    .filter(function(x){ return !shown[x.key]; })
    .map(function(x){ return {key:x.key, url:x.url, name:groupLabel(x.url), sagas:[],
                              official:false, local:false}; });
  var follow="<div class='sg-follow'>"
    +"<input class='ed2-in tiny sg-url' id='sgFollowUrl' type='text'"
      +" placeholder='https://\u2026 cards.json or saga .zip'"
      +" onkeydown=\"if(event.key==='Enter')edFollowSource(this.value)\">"
    +"<button class='ed2-btn tiny primary' onclick=\"edFollowSource(document.getElementById('sgFollowUrl').value)\">Follow</button>"
    +"</div>";
  sgListBind(host);
  /* a redraw while the form is being typed in keeps the box and the caret */
  var act=document.activeElement, fid=(act&&act.id&&host.contains(act))?act.id:'', sel=null;
  try{ if(fid&&typeof act.selectionStart==='number')sel=[act.selectionStart,act.selectionEnd]; }catch(_){}
  host.innerHTML=groups.concat(waiting).map(function(g){
    var open=!groupCollapsed(g.key);
    var many=g.sagas.length>1;
    var body=(many&&!open)?"":g.sagas.map(sagaRowHTML).join('');
    return "<div class='sg-group"+(groupEnabled(g.key)?'':' off')
      +(g.official?' official':'')+"'>"
      +groupHeadHTML(g)
      +"<div class='sg-group-body'>"+body+"</div>"
    +"</div>";
  }).join('')+follow;
  if(fid){
    var back=document.getElementById(fid);
    try{ if(back){ back.focus(); if(sel)back.setSelectionRange(sel[0],sel[1]); } }catch(_){}
  }
  autoCheckSources();
};

/* Nothing is fetched at load but the check on open (ghAutoCheck), and a check changes no card's content, only bookkeeping: taking the update is ghAutoApply's decision (ed2_publish.js). */

/* From a page opened as a file only reads from these two hosts are allowed: they answer Access-Control-Allow-Origin: *, and without them a copy off a disk has no cards. */
var FILE_READ_OK=/^https:\/\/(raw\.githubusercontent\.com|cdn\.jsdelivr\.net)\//i;
function syncBlockedReason(url){
  if(!url)return '';
  if(location.protocol==='file:'&&!FILE_READ_OK.test(String(url)))
    return 'The catalog is open as a file, so the page is not allowed to make requests. '
      +'Serve it over http to use this: python -m http.server';
  if(!/^https?:\/\//i.test(url))
    return 'The source must be a full http:// or https:// URL.';
  if(location.protocol==='https:'&&/^http:\/\//i.test(url))
    return 'This page is https and the source is http. The browser blocks that as mixed '
      +'content before the request is even sent - use an https URL.';
  return '';
}
/* A fetch has no time or size limit of its own, and a silent server left a source on "Checking…" until the tab was closed. */
var SRC_IDLE_MS=60000, SRC_TOTAL_MS=10*60000, SRC_MAX_BYTES=512*1048576;
/* no-cache, not no-store: the browser asks whether its copy has changed (If-None-Match), so an open with nothing new costs a few hundred bytes, and the answer is always the server's. */
function fetchSource(url){
  var ac=(typeof AbortController==='function')?new AbortController():null;
  var why='', idle=0, total=0;
  function stop(reason){ if(!why)why=reason; try{ if(ac)ac.abort(); }catch(_){} }
  function arm(){ clearTimeout(idle); idle=setTimeout(function(){ stop('idle'); },SRC_IDLE_MS); }
  function done(){ clearTimeout(idle); clearTimeout(total); }
  arm();
  total=setTimeout(function(){ stop('total'); },SRC_TOTAL_MS);
  var mb=Math.round(SRC_MAX_BYTES/1048576);
  return fetch(url,{cache:'no-cache',signal:ac?ac.signal:undefined}).then(function(r){
    if(!r.ok)throw new Error('the server answered '+r.status+' '+(r.statusText||''));
    var len=parseInt(r.headers.get('content-length')||'',10);
    if(len>SRC_MAX_BYTES){ stop('size'); throw new Error('size'); }
    if(!r.body||typeof r.body.getReader!=='function'){ arm(); return r.arrayBuffer(); }
    var rd=r.body.getReader(), parts=[], got=0;
    function pump(){
      return rd.read().then(function(x){
        if(x.done)return;
        got+=x.value.byteLength;
        if(got>SRC_MAX_BYTES){ stop('size'); try{ rd.cancel(); }catch(_){} throw new Error('size'); }
        parts.push(x.value); arm();
        return pump();
      });
    }
    return pump().then(function(){
      var all=new Uint8Array(got), at=0;
      parts.forEach(function(p){ all.set(p,at); at+=p.byteLength; });
      return all.buffer;
    });
  },function(err){
    if(why)throw err;
    /* A rejected fetch is the same opaque TypeError for offline, a bad host and a missing CORS header, so the message names both possibilities. */
    throw new Error('could not reach it. Either the address is wrong or the machine is '
      +'offline, or the server does not allow cross-origin requests - it has to send '
      +'an Access-Control-Allow-Origin header.');
  }).then(function(buf){ done(); return buf; },function(err){
    done();
    if(why==='idle')throw new Error('it stopped answering - nothing arrived for '
      +Math.round(SRC_IDLE_MS/1000)+' seconds, so the check was stopped. Try again later.');
    if(why==='total')throw new Error('it was still sending after '+Math.round(SRC_TOTAL_MS/60000)
      +' minutes, so the check was stopped. Try again later.');
    if(why==='size')throw new Error('what it sends is larger than '+mb+' MB, so the check was '
      +'stopped before it filled the browser\'s memory.');
    throw err;
  }).then(function(buf){
    var b=new Uint8Array(buf);
    if(b.length>3&&b[0]===0x50&&b[1]===0x4B&&b[2]===0x03&&b[3]===0x04)
      return {buf:buf,zip:true};
    var txt='';
    try{ txt=new TextDecoder('utf-8').decode(b); }catch(_){ txt=''; }
    var j;
    try{ j=JSON.parse(txt); }
    catch(_){ throw new Error('what came back is neither a saga .zip nor JSON.'); }
    return {buf:buf,zip:false,json:j};
  });
}
function pkgFromJson(j){
  if(Array.isArray(j))return {man:{},cards:j,look:null,marks:null,packedKeys:{}};
  return {man:j.manifest||j.man||{},cards:j.cards||[],look:j.look||null,
          marks:j.marks||null,packedKeys:{}};
}
/* A blank incoming field is skipped, as importCardRows reads a blank as keep; from a source (o.sagaSet) a cleared field differs too (srcContentDiffers). */
function cardDiffers(ex,nc,o){
  if(o&&o.sagaSet)return srcContentDiffers(ex,nc,o);
  /* The flat stats syncLegacyStats writes, besides orbs below (what the face draws): without them a change to stats alone read as Up to date. */
  var keys=['manaCost','cmc','ruleText','flavor','artist','revision','designer',
            'attack','health','arcane','range'];
  for(var i=0;i<keys.length;i++){
    var v=nc[keys[i]];
    if(v===undefined||v==='')continue;
    if(String(ex[keys[i]]==null?'':ex[keys[i]])!==String(v))return true;
  }
  /* Compared as the picture (artKeyOf): art/x.png here and the CDN's x.webp there are one picture, and compared as strings every card read as changed. */
  var pics=['art','imageUrl'];
  for(var p=0;p<pics.length;p++){
    var pv=nc[pics[p]];
    if(pv===undefined||pv==='')continue;
    if(artKeyOf(ex[pics[p]])!==artKeyOf(pv))return true;
  }
  var arrs=['colors','superTypes','subTypes'];
  for(var j=0;j<arrs.length;j++){
    var a=nc[arrs[j]];
    if(!Array.isArray(a)||!a.length)continue;
    if((ex[arrs[j]]||[]).join('|')!==a.join('|'))return true;
  }
  if(Array.isArray(nc.orbs)&&nc.orbs.length){
    if(orbSig(ex.orbs)!==orbSig(nc.orbs))return true;
  }
  var vis=['frame','rulesSplit','splitIdent','splitChoice','choiceText','choiceRows'];
  for(var k=0;k<vis.length;k++){
    var vv=nc[vis[k]];
    if(vv===undefined||vv==='')continue;
    if(String(ex[vis[k]]==null?'':ex[vis[k]])!==String(vv))return true;
  }
  if(Array.isArray(nc.sections)&&nc.sections.length
     && JSON.stringify(ex.sections||[])!==JSON.stringify(nc.sections))return true;
  if(visualDiffers(ex,nc))return true;
  return false;
}

/* artSrcOf's rule exactly, or the two sides disagree; with no art base (owner mode on the owner's disk) a relative path stays relative. */
function artKeyOf(v){
  var u=String(v==null?'':v);
  if(!u)return '';
  if(/^(https?:|data:|blob:)/i.test(u))return u;
  var base='';
  try{ base=ghArtBase(); }catch(_){ base=''; }
  return base?base+ghOutName(u):u;
}
window.edArtKeyOf=function(v){ return artKeyOf(v); };
window.edCardDiffers=function(a,b){ return cardDiffers(a,b); };

/* Bearer by bearer, and only a value the source sets counts (importCardRows keeps a blank), or local framing would read as changed for ever. */
function visualDiffers(ex,nc){
  var mine=artBearers(ex||{}), theirs=artBearers(nc||{});
  for(var i=0;i<theirs.length;i++){
    var b=theirs[i]||{}, a=mine[i]||{};
    if(b.artXf&&JSON.stringify(b.artXf)!==JSON.stringify(a.artXf||null))return true;
    if(b.fit&&String(b.fit)!==String(a.fit||''))return true;
    if(b.mark&&String(b.mark)!==String(a.mark||''))return true;
    if(b.holo&&JSON.stringify(b.holo)!==JSON.stringify(a.holo||null))return true;
  }
  if(Array.isArray(nc.variants)&&nc.variants.length
     && nc.variants.length!==((ex.variants||[]).length))return true;
  return false;
}
/* Only the two fields an orb carries: compared whole, any key an export adds would read as a change. */
function orbSig(o){
  return (Array.isArray(o)?o:[]).map(function(x){
    return x?((x.type||'')+':'+(x.value==null?'':x.value)):''; }).join('|');
}
/* Once per source per session: edRenderSagaPage also runs after every toggle, delete and restore. */
function autoCheckSources(){
  var pane=document.getElementById('pane-sagas');
  if(!pane||pane.offsetParent===null)return;
  if(typeof SOURCES==='undefined')return;
  SOURCES.forEach(function(x){
    var s=srcWrap(x);
    if(!s.url||_srcChecked[s.key]||syncBlockedReason(s.url))return;
    _srcChecked[s.key]=1;
    ghCheckSource(s).then(function(){ return ghAutoApply(s); });
  });
}
function stampText(iso){
  if(!iso)return 'never';
  var d=new Date(iso); if(isNaN(d.getTime()))return 'never';
  var p=function(v){return String(100+v).slice(1);};
  return d.getFullYear()+'-'+p(d.getMonth()+1)+'-'+p(d.getDate())
    +' '+p(d.getHours())+':'+p(d.getMinutes());
}
/* Nothing sets orphan any more (a source removes the cards it drops, srcGoneCards); a stored card keeps it until Keep clears it or a source sends the card again. */
function clearOrphan(c){
  if(c&&c.orphan){ delete c.orphan; markDirty(c); return true; }
  return false;
}
window.edOrphans=function(){
  return (window.CARDS||[]).filter(function(c){ return c&&c.orphan; });
};
window.edClearOrphan=function(id){
  var c=(window.CARDS||[]).find(function(x){return x.__id===id;});
  if(!c||!clearOrphan(c))return;
  persistCard(c).then(function(){
    applyToCatalog();
    try{ window.edRenderOrphans(); }catch(_){}
    try{ window.edRenderSagaPage(); }catch(_){}
    toast('"'+c.name+'" is no longer marked orphaned');
  });
};

/* Never a blind all cards: one saga or the filtered set, with the count shown before it runs (HANDOFF §6). */
window.edOpenMassEdit=function(){
  var ov=document.getElementById('edMassOverlay');
  if(!ov){
    ov=document.createElement('div'); ov.id='edMassOverlay'; ov.className='ed2-overlay';
    ov.innerHTML="<div class='ed2-modal'><div class='ed2-modal-head wh'><b class='wh-t'>Mass edit</b>"
      +"<button class='ed2-btn close-x nb nb-red nb-m wh-x' onclick='edCloseMassEdit()'>Close &#10005;</button></div>"
      +"<div id='edMassBody' class='ed2-modal-body'></div></div>";
    document.body.appendChild(ov);
    ov.addEventListener('click',function(ev){ if(ev.target===ov)window.edCloseMassEdit(); });
  }
  ov.style.display='flex';
  edDialogOpen(ov,'Mass edit',function(){ window.edCloseMassEdit(); });
  window.edMassRefresh();
};
window.edCloseMassEdit=function(){var o=document.getElementById('edMassOverlay');
  if(o){ o.style.display='none'; edDialogClose(o); } };
function massTargets(){
  var scope=(document.getElementById('massScope')||{}).value||'';
  if(scope==='filtered')return (window._allFiltered||[]).slice();
  if(scope)return sagaCards(scope);
  return [];
}
window.edMassRefresh=function(){
  var host=document.getElementById('edMassBody'); if(!host)return;
  var scope=(document.getElementById('massScope')||{}).value||'';
  var opts="<option value=''>- choose -</option>"
    +"<option value='filtered'"+(scope==='filtered'?' selected':'')+">Current filtered results</option>"
    +SAGAS.map(function(s){return "<option value='"+e(s.id)+"'"+(scope===s.id?' selected':'')+">Saga: "+e(s.name)+"</option>";}).join('');
  var n=scope?massTargets().length:0;
  var nLocked=scope?edSplitLocked(massTargets()).locked.length:0;
  var nTest=scope?massTargets().filter(function(c){ return c&&c.testing; }).length:0;
  host.innerHTML="<div class='tpl-sec'>"
    +"<i class='tpl-hint'>Sets these fields on every card in the chosen scope. Blank fields are left alone. <b>No undo.</b></i>"
    +"<div class='kwm-form'>"
      +"<label>Scope<select class='ed2-in' id='massScope' onchange='edMassRefresh()'>"+opts+"</select></label>"
      +"<label>Saga<input class='ed2-in' id='mass-saga' placeholder='leave blank to keep'></label>"
      +"<label>Owner<input class='ed2-in' id='mass-designer' placeholder='leave blank to keep'></label>"
      +"<label>Revision<input class='ed2-in' id='mass-revision' placeholder='leave blank to keep'></label>"
      +"<label>Artist<input class='ed2-in' id='mass-artist' placeholder='leave blank to keep'></label>"
      +"<label class='mass-untest'><input type='checkbox' id='mass-untest'> Remove Test from these cards"
        +" <span class='tpl-hint'>("+nTest+" of them "+(nTest===1?'is a Test card':'are Test cards')+")</span></label>"
    +"</div>"
    +"<div class='tpl-opts'><b>"+n+"</b> card(s) in scope"
      +(nLocked?(" <span class='tpl-hint'>("+nLocked+" read-only - official, or from a source you "
        +"follow - and skipped)</span>"):'')
      +"<button class='ed2-btn tiny on' onclick='edMassApply()'"+(n>nLocked?'':' disabled')+">Apply</button></div>"
  +"</div>";
};
/* Through setSagaList, never sagaId alone, which no reader goes by; it leaves the scope's saga (else the card's first), and that saga's printing moves with it. */
function massMoveSaga(c,from,to){
  if(!c||!to)return false;
  if(!from||!inSaga(c,from))from=sagaIdsOf(c)[0];
  if(from===to)return false;
  if(inSaga(c,to))return removeSagaMembership(c,from);
  var list=sagaIdsOf(c).map(function(x){ return x===from?to:x; });
  if(c.sagaFields&&c.sagaFields[from]){
    if(!c.sagaFields[to])c.sagaFields[to]=c.sagaFields[from];
    delete c.sagaFields[from];
  }
  return setSagaList(c,list);
}
window.edMassApply=function(){
  var inScope=massTargets();
  if(!inScope.length){ alert('Nothing in scope.'); return; }
  var split=edSplitLocked(inScope), list=split.open, skipped=split.locked.length;
  if(!list.length){
    alert('All '+inScope.length+' card(s) in scope are read-only here (official, or from a source '
      +'you follow) - nothing was changed. An update would put them back as they were.');
    return;
  }
  var scopeVal=(document.getElementById('massScope')||{}).value||'';
  var fromSaga=(scopeVal&&scopeVal!=='filtered')?scopeVal:'';
  var g=function(f){var el=document.getElementById('mass-'+f);return el?el.value.trim():'';};
  var vals={saga:g('saga'),designer:g('designer'),revision:g('revision'),artist:g('artist')};
  var keys=Object.keys(vals).filter(function(k){return vals[k]!=='';});
  var to=vals.saga?sagaResolveRef(vals.saga):null;
  var untestBox=document.getElementById('mass-untest');
  var untest=!!(untestBox&&untestBox.checked);
  var tests=untest?list.filter(function(c){ return c&&c.testing; }):[];
  if(!keys.length&&!untest){ alert('Set at least one field.'); return; }
  if(!keys.length&&!tests.length){ alert('None of these cards is a Test card.'); return; }
  if(!keys.length)list=tests;
  var fields=keys.filter(function(k){ return k!=='saga'; });
  var shared=to?list.filter(isShared).length:0;
  edDangerGate({
    title:'Mass edit '+list.length+' card(s)',
    lose:fields.map(function(k){ return 'Existing '+k+' on '+list.length+' card(s), overwritten with "'+vals[k]+'"'; })
      .concat(tests.length?[tests.length+' Test card(s) stop being Test cards - the next Publish puts them in the catalogue for everyone']:[])
      .concat(to?['Cards move from '+(fromSaga?('"'+sagaNameOf(fromSaga)+'"'):'their first saga')
        +' to "'+to.name+'" - each keeps its card id, so decks and links still find it']:[])
      .concat(shared?[shared+' shared card(s) move to "'+to.name
           +'" and STAY members of the other sagas they are shared with']:[]),
    note:skipped?[edSkippedText(skipped)]:[],
    phrase:'APPLY',
    proceedLabel:'Apply to '+list.length+' card(s)'
  }).then(function(ok){
    if(!ok){ toast('Cancelled - nothing was changed'); return; }
    list.forEach(function(c){
      fields.forEach(function(k){ c[k]=vals[k]; });
      if(untest)delete c.testing;
      if(to)massMoveSaga(c,fromSaga,to.id);
      markDirty(c);
    });
    var names={}; if(to)names[to.id]=to.name;
    Promise.all(list.map(persistCard))
      .then(function(){ return ensureSagaRecords({names:names}); })
      .then(function(){
        applyToCatalog(); refreshSagaFilter(); window.edRenderSagaPage(); window.edMassRefresh();
        toast('Updated '+list.length+' card(s)'+(skipped?(' - skipped '+skipped+' read-only'):''));
      },function(){
        /* persistCard has said what failed */
        applyToCatalog(); refreshSagaFilter(); window.edRenderSagaPage(); window.edMassRefresh();
      });
  });
};

/* Read by EXPORT_COLS's header names, so what the app exports it reads back; unknown columns are ignored, missing ones default. */
function parseCsv(text){
  var rows=[],row=[],cur='',q=false;
  for(var i=0;i<text.length;i++){
    var ch=text[i];
    if(q){
      if(ch==='"'){ if(text[i+1]==='"'){cur+='"';i++;} else q=false; }
      else cur+=ch;
    } else if(ch==='"'){ q=true; }
    else if(ch===','){ row.push(cur); cur=''; }
    else if(ch==='\n'){ row.push(cur); rows.push(row); row=[]; cur=''; }
    else if(ch!=='\r'){ cur+=ch; }
  }
  if(cur!==''||row.length){ row.push(cur); rows.push(row); }
  return rows.filter(function(r){return r.some(function(x){return String(x).trim()!=='';});});
}
/* By id, then by name: a saga made here has an id that is not its name, so a name taken as an id made a second saga beside it; no match becomes a new saga. */
function sagaResolveRef(ref){
  ref=String(ref==null?'':ref).trim(); if(!ref)return null;
  var hit=SAGAS.filter(function(s){ return s&&s.id===ref; })[0]
        ||SAGAS.filter(function(s){ return s&&normName(s.name||'')===normName(ref); })[0];
  return {id:hit?hit.id:ref, name:hit?(hit.name||hit.id):ref};
}
function rowsToCards(rows,sagaName){
  if(!rows.length)return [];
  var head=rows[0].map(function(h){return String(h).trim();});
  var idx={}; head.forEach(function(h,i){ idx[h.toLowerCase()]=i; });
  var get=function(r,name){ var i=idx[name.toLowerCase()]; return i==null?'':String(r[i]==null?'':r[i]).trim(); };
  return rows.slice(1).map(function(r){
    var name=get(r,'Name'); if(!name)return null;
    var ref=sagaResolveRef(sagaName||get(r,'Saga')||'Imported');
    return {__id:uid(), id:uid(), name:name,
      manaCost:get(r,'Mana Cost'), cmc:get(r,'CMC'),
      colors:get(r,'Color').split(/[,\s]+/).filter(Boolean),
      superTypes:get(r,'Super Type').split(/\s+/).filter(Boolean),
      subTypes:get(r,'Sub Type').split(/\s+/).filter(Boolean),
      attack:get(r,'Attack'), health:get(r,'Health'), arcane:get(r,'Arcane'),
      range:get(r,'Range'),
      ruleText:get(r,'Rule Text').replace(/\\n/g,'\n'),
      flavor:get(r,'Flavor').replace(/\\n/g,'\n'),
      saga:ref.name, sagaId:ref.id,
      revision:get(r,'Revision'), artist:get(r,'Artist'),
      designer:get(r,'Designer'), imageUrl:'', art:''};
  }).filter(Boolean);
}
function xmlUnesc(s){
  return String(s).replace(/&lt;/g,'<').replace(/&gt;/g,'>')
                  .replace(/&quot;/g,'"').replace(/&apos;/g,"'").replace(/&amp;/g,'&');
}
/* Not always sheet1.xml: Excel keeps the part names when a sheet is deleted, so the first sheet is found through workbook.xml and its rels. */
function xlsxFirstSheet(z){
  var wb=z.file('xl/workbook.xml');
  return (wb?wb.async('string'):Promise.resolve('')).then(function(x){
    var rid=(/<sheet[^>]*\br:id="([^"]+)"/.exec(x)||[])[1];
    var rf=z.file('xl/_rels/workbook.xml.rels');
    return ((rid&&rf)?rf.async('string'):Promise.resolve('')).then(function(rels){
      var tgt=null;
      /* The id is compared as text, never built into a RegExp: a bracket or a plus in it threw or matched the wrong sheet. */
      if(rid&&rels){
        var want=xmlUnesc(rid);
        (rels.match(/<Relationship\b[^>]*>/g)||[]).some(function(tag){
          var id=(/\bId="([^"]*)"/.exec(tag)||[])[1];
          if(id==null||xmlUnesc(id)!==want)return false;
          var t=(/\bTarget="([^"]*)"/.exec(tag)||[])[1];
          if(t)tgt=xmlUnesc(t);
          return true;
        });
      }
      var f=null;
      if(tgt)f=z.file('xl/'+String(tgt).replace(/^\//,'').replace(/^xl\//,''));
      if(!f)f=z.file('xl/worksheets/sheet1.xml');
      if(!f){ var any=z.file(/^xl\/worksheets\/[^\/]+\.xml$/); f=(any&&any.length)?any[0]:null; }
      if(!f)throw new Error('no worksheet part found in this .xlsx');
      return f.async('string');
    });
  });
}
/* An Excel date is a plain number and only its format says so (cellXfs, then numFmtId), or 2026-08-07 imports as 46246. */
function xlsxIsDateFmtId(id){
  return (id>=14&&id<=22)||(id>=27&&id<=36)||(id>=45&&id<=47)||(id>=50&&id<=58);
}
function xlsxStyles(z){
  var sf=z.file('xl/styles.xml'), wf=z.file('xl/workbook.xml');
  return Promise.all([sf?sf.async('string'):Promise.resolve(''),
                      wf?wf.async('string'):Promise.resolve('')]).then(function(r){
    var x=r[0], wbx=r[1], custom={};
    (x.match(/<numFmt\b[^>]*\/?>/g)||[]).forEach(function(nf){
      var id=(nf.match(/numFmtId="(\d+)"/)||[])[1];
      if(id==null)return;
      /* quoted runs, [ ] sections and backslash escapes never make a format a date, so they go before the token test */
      var bare=xmlUnesc((nf.match(/formatCode="([^"]*)"/)||[])[1]||'')
                 .replace(/\\./g,'').replace(/"[^"]*"/g,'').replace(/\[[^\]]*\]/g,'');
      custom[+id]=/[ymdhs]/i.test(bare);
    });
    /* cellStyleXfs has the same child element as cellXfs, so the block is cut out first or every s="" index reads the wrong table */
    var block=(x.match(/<cellXfs[\s\S]*?<\/cellXfs>/)||[])[0]||'';
    var xfs=(block.match(/<xf\b[^>]*(?:\/>|>[\s\S]*?<\/xf>)/g)||[]).map(function(xf){
      return +((xf.match(/numFmtId="(\d+)"/)||[])[1]||0); });
    return {
      /* Mac Excel still writes 1904 dating, which shifts every serial by 1462 days */
      epoch1904:/date1904="(1|true)"/i.test(wbx),
      isDate:function(si){
        var id=xfs[si]; if(id==null)return false;
        return (custom[id]!==undefined)?custom[id]:xlsxIsDateFmtId(id);
      }
    };
  });
}
/* Excel counts 1900-01-01 as day 1 and believes 1900 had a 29 February, so every serial past 59 is one day ahead; this is the format's documented behaviour. */
function xlsxSerialToText(n,epoch1904){
  var d=Number(n); if(!isFinite(d))return String(n);
  var days=Math.floor(d), frac=d-days;
  if(epoch1904)days+=1462; else if(days>59)days-=1;
  var t=new Date(Date.UTC(1899,11,31)+days*86400000+Math.round(frac*86400000));
  if(isNaN(t.getTime()))return String(n);
  var p=function(v){return String(100+v).slice(1);};
  var out=t.getUTCFullYear()+'-'+p(t.getUTCMonth()+1)+'-'+p(t.getUTCDate());
  if(frac>0)out+=' '+p(t.getUTCHours())+':'+p(t.getUTCMinutes());
  return out;
}
/* Excel writes doubles at full precision, so a cell showing 3 can arrive as 3.0000000000000004; only a long fractional tail is collapsed, an integer is kept as written. */
function xlsxNum(v){
  var s=String(v).trim(); if(s==='')return '';
  var n=Number(s); if(!isFinite(n))return s;
  var dot=s.indexOf('.');
  if((dot>=0&&s.length-dot-1>=12)||/[eE]/.test(s))return String(parseFloat(n.toPrecision(12)));
  return s;
}
function xlsxToRows(blob){
  return JSZip.loadAsync(blob).then(function(z){
    var shared=[], sty={isDate:function(){return false;},epoch1904:false};
    var ss=z.file('xl/sharedStrings.xml');
    var p1=ss?ss.async('string').then(function(x){
      /* One <si> is one string: a partly styled cell is several <r><t> runs in one <si>, and counting <t> shifted every later column. <rPh> is a phonetic guide, never the value. */
      shared=(x.match(/<si(?:\s[^>]*)?>[\s\S]*?<\/si>/g)||[]).map(function(si){
        var body=si.replace(/<rPh[\s\S]*?<\/rPh>/g,'');
        return (body.match(/<t(?:\s[^>]*)?>[\s\S]*?<\/t>/g)||[]).map(function(t){
          return xmlUnesc(t.replace(/^<t(?:\s[^>]*)?>/,'').replace(/<\/t>$/,''));
        }).join('');
      });
    }):Promise.resolve();
    return p1.then(function(){ return xlsxStyles(z); })
      .then(function(s){ sty=s; return xlsxFirstSheet(z); })
      .then(function(xml){
        var rows=[];
        (xml.match(/<row[\s\S]*?<\/row>/g)||[]).forEach(function(rx){
          var cells=[], cursor=0;
          (rx.match(/<c[^>]*(?:\/>|>[\s\S]*?<\/c>)/g)||[]).forEach(function(cx){
            /* attributes from the opening tag only: a child element's could answer for the cell's own type */
            var head=(cx.match(/^<c[^>]*>?/)||[''])[0];
            /* r= is optional and some writers leave it out, so a running cursor places the cell, set again wherever an r= is present. */
            var ref=(head.match(/\br="([A-Z]+)/)||[])[1]||'', col;
            if(ref){ col=0; for(var i=0;i<ref.length;i++)col=col*26+(ref.charCodeAt(i)-64); col--; }
            else col=cursor;
            if(col<0)col=0;
            cursor=col+1;
            var t=(head.match(/\bt="([^"]*)"/)||[])[1]||'n';
            var vm=cx.match(/<v>([\s\S]*?)<\/v>/);
            var v='';
            if(t==='inlineStr'){
              /* an inline string has runs too: only the first <t> lost the rest of a partly styled cell */
              v=(cx.replace(/<rPh[\s\S]*?<\/rPh>/g,'').match(/<t(?:\s[^>]*)?>[\s\S]*?<\/t>/g)||[])
                 .map(function(t2){ return xmlUnesc(t2.replace(/^<t(?:\s[^>]*)?>/,'').replace(/<\/t>$/,'')); })
                 .join('');
            }
            /* shared entries were unescaped when the table was built: again would turn a literal "&amp;lt;" into "<" */
            else if(t==='s'&&vm)v=shared[+vm[1]]||'';
            /* a boolean would read 1/0, and an error cell would write "#REF!" onto a card */
            else if(t==='b'&&vm)v=(String(vm[1]).trim()==='1'?'TRUE':'FALSE');
            else if(t==='e')v='';
            else if(t==='str'&&vm)v=xmlUnesc(vm[1]);
            else if(vm){
              v=xmlUnesc(vm[1]);
              var si=+((head.match(/\bs="(\d+)"/)||[])[1]||-1);
              v=(si>=0&&sty.isDate(si))?xlsxSerialToText(v,sty.epoch1904):xlsxNum(v);
            }
            while(cells.length<col)cells.push('');
            cells[col]=v;
          });
          rows.push(cells);
        });
        /* all-blank rows go, as in the CSV path: a styled but empty first row became the header and every column lookup missed */
        return rows.filter(function(r){
          return r.some(function(x){return String(x==null?'':x).trim()!=='';}); });
      });
  });
}
function shareIntoExisting(ex,nc,sagaId){
  if(!addSagaMembership(ex,sagaId))return false;
  captureSagaFields(ex,nc,sagaId);
  mergeArtInto(ex,nc);
  selectSagaVariant(ex,sagaId,sagaPictureOf(nc,sagaIdOf(nc)));
  markDirty(ex);
  return true;
}
/* Its own function, not behind shareIntoExisting's membership test: Share identical cards adds the memberships first, so behind it the art was never carried. */
function mergeArtInto(ex,nc){
  var have={}, added=0;
  artBearers(ex).forEach(function(b){ var k=(b&&(b.imageUrl||b.art))||''; if(k)have[k]=1; });
  var vs=(ex.variants&&ex.variants.length)?ex.variants.slice()
        :[{id:'v1',label:'Default',art:ex.art||'',imageUrl:ex.imageUrl||''}];
  artBearers(nc).forEach(function(b){
    var url=(b&&b.imageUrl)||'', key=(b&&b.art)||'';
    var id=url||key; if(!id||have[id])return;
    have[id]=1;
    var n=vs.length+1;
    vs.push({id:'v'+n,label:'Art '+n,art:key,imageUrl:url});
    added++;
  });
  if(vs.length>1){ ex.variants=vs; if(!ex.variant)ex.variant=vs[0].id; }
  return added;
}
/* c.id is the IndexedDB key, so an imported card whose id another card uses would overwrite that record and one card is gone at reload.
   id is only where a record is stored (the identity is cid), so a colliding one is minted again. */
function ensureUniqueId(nc,byId){
  if(!nc.id){ nc.id=uid(); byId[nc.id]=nc; return; }
  var owner=byId[nc.id];
  if(owner&&owner!==nc&&mergeKey(owner)!==mergeKey(nc))nc.id=uid();
  byId[nc.id]=nc;
}
function importCardRows(cards,sagaName,o){
  if(o&&o.sagaSet)return srcImportRows(cards||[],o);
  if(!cards.length){ alert('No rows with a Name column.'); return Promise.resolve(0); }
  var mineList=(window.CARDS||[]), ix=cardIndex(mineList);
  /* An exact match in another saga (shareSig) is shared, not copied, so one edit reaches both sagas. */
  var bySig={}; (window.CARDS||[]).forEach(function(c){
    var s=shareSig(c); if(s&&!bySig[s])bySig[s]=c; });
  var byId={}; (window.CARDS||[]).forEach(function(c){ if(c.id)byId[c.id]=c; });
  var added=0, updated=0, shared=0, skipped=0;
  cards.forEach(function(nc){
    var at=ix.at(nc), ex=(at==null)?null:mineList[at];
    /* A read-only card is skipped and counted, and so is sharing a row into one: the next update would put it back. */
    if(ex&&edLockedSafe(ex)){ skipped++; return; }
    if(ex){ Object.keys(nc).forEach(function(k){
        /* cid is never taken from a file: a card's id is frozen, and tombstones and stored records point at it. */
        if(k==='__id'||k==='id'||k==='sagaIds'||k==='cid')return;
        if(nc[k]!==''&&!(Array.isArray(nc[k])&&!nc[k].length))ex[k]=nc[k]; });
      markDirty(ex); updated++; return; }
    var twin=bySig[shareSig(nc)];
    if(twin && edLockedSafe(twin)){ skipped++; return; }
    if(twin && shareIntoExisting(twin,nc,sagaIdOf(nc))){ shared++; return; }
    ensureUniqueId(nc,byId);
    mineList.push(nc); ix.add(nc,mineList.length-1); markDirty(nc); added++;
    var s=shareSig(nc); if(s&&!bySig[s])bySig[s]=nc;
  });
  var names={}; cards.forEach(function(nc){ if(nc.sagaId&&nc.saga)names[nc.sagaId]=nc.saga; });
  return persistAll().then(function(){ return ensureSagaRecords({names:names}); }).then(function(){
    applyToCatalog(); refreshSagaFilter(); window.edRenderSagaPage();
    toast('Imported '+added+' new, '+updated+' updated'
      +(shared?', '+shared+' shared with a saga that already had them':'')
      +(skipped?', '+skipped+' read-only skipped (official, or from a source you follow)':''));
    return added+updated+shared;
  });
}
/* A card from a source is what the source says (HANDOFF §77.5): matched by cid, then saga + name but never by name onto a card made here; it takes the published id, and a field the source cleared is cleared.
   Its sagas follow the source, yours are kept, and another source's card is skipped; SRC_LOCAL_ONLY and anything starting with _ stay this machine's. */
var SRC_LOCAL_ONLY={__id:1,id:1,cid:1,local:1,testing:1,orphan:1,__deleted:1,
                    sagaIds:1,sagaId:1,saga:1,sagaFields:1};
function srcCopy(v){ return (v&&typeof v==='object')?JSON.parse(JSON.stringify(v)):v; }
/* Stored, not markDirty'd: the page would ask before closing, and autosave would stamp lastUpdated with today, which an exact comparison reads as a change on every open. */
function srcTouched(c){
  try{ if(typeof _cardGen!=='undefined')_cardGen++; }catch(_){}
  bumpCardGen(c);
  try{ if(typeof _dirty!=='undefined'&&c)delete _dirty[c.__id]; }catch(_){}
}
function srcBlank(v){
  return v==null||v===''||(Array.isArray(v)&&!v.length)
      ||(typeof v==='object'&&!Array.isArray(v)&&!Object.keys(v).length);
}
function srcSagasOf(nc,o){
  return sagaIdsOf(nc).filter(function(id){ return o.sagaSet[id]&&!o.skip[id]; });
}
function srcInOfficial(c){
  return sagaIdsOf(c).some(function(id){ return groupKeyOfId(id)===GROUP_OFFICIAL; });
}
/* a table copy is no other source: it is what its real source takes over; an official card in another set's saga (srcLinkedJoin) is still the official set's */
function srcBelongsElsewhere(ex,key){
  if(key===GROUP_OFFICIAL&&srcInOfficial(ex))return false;
  return sagaIdsOf(ex).some(function(id){
    var k=groupKeyOfId(id);
    return k!==GROUP_LOCAL&&k!==key&&k.indexOf('table:')!==0;
  });
}
function srcArtNorm(k,v){
  if(k==='art'||k==='imageUrl')return artKeyOf(v);
  if(k==='variants'&&Array.isArray(v))return v.map(function(x){
    if(!x||typeof x!=='object')return x;
    var y=Object.assign({},x); y.art=artKeyOf(x.art); y.imageUrl=artKeyOf(x.imageUrl);
    return y; });
  return v;
}
function srcContentDiffers(ex,nc,o){
  if(!ex||!nc)return true;
  var keys={};
  Object.keys(ex).forEach(function(k){ keys[k]=1; });
  Object.keys(nc).forEach(function(k){ keys[k]=1; });
  for(var k in keys){
    if(!keys.hasOwnProperty(k)||SRC_LOCAL_ONLY[k]||k.charAt(0)==='_')continue;
    var x=ex[k], y=nc[k];
    if(srcBlank(x)&&srcBlank(y))continue;
    /* a blank the app fills in on load (normalizeBuiltins) is the same blank */
    if(srcBlank(y)&&BUILTIN_DEFAULTS.hasOwnProperty(k)&&String(x)===String(BUILTIN_DEFAULTS[k]))continue;
    var xs, ys;
    try{ xs=JSON.stringify(srcArtNorm(k,x)); ys=JSON.stringify(srcArtNorm(k,y)); }
    catch(_){ xs=String(x); ys=String(y); }
    if(xs!==ys)return true;
  }
  var inc=srcSagasOf(nc,o);
  var mine=sagaIdsOf(ex).filter(function(id){ return o.sagaSet[id]; });
  if(inc.join('|')!==mine.join('|'))return true;
  var a=ex.sagaFields||{}, b=nc.sagaFields||{};
  for(var i=0;i<inc.length;i++){
    var sid=inc[i]; if(i===0)continue;          /* the head's are the card's own */
    if(!sagaFieldSame(a[sid]||null,b[sid]||null))return true;
  }
  return false;
}
/* Only a card that really changed is rewritten (srcContentDiffers, plus orphan and Test), so one upstream change writes one record and "Updated N card(s)" names real changes. */
function srcMergeInto(ex,nc,o){
  nc=srcNormCard(nc)||{};
  if(!srcContentDiffers(ex,nc,o)&&!ex.orphan&&!(nc.testing&&!ex.testing))return false;
  var inc=srcSagasOf(nc,o);
  var mine=sagaIdsOf(ex);
  var other=mine.filter(function(id){ return !o.sagaSet[id]; });
  var keepSF={};
  Object.keys(ex.sagaFields||{}).forEach(function(sid){
    if(!o.sagaSet[sid])keepSF[sid]=ex.sagaFields[sid]; });
  /* the old head's printing, when that saga is not the source's, moves into its sagaFields before the card's fields are overwritten */
  var oldHead=mine[0];
  if(!o.sagaSet[oldHead]){
    var bag=Object.assign({},keepSF[oldHead]||{});
    SAGA_FIELDS.forEach(function(f){ if(ex[f]!==undefined&&bag[f]===undefined)bag[f]=srcCopy(ex[f]); });
    keepSF[oldHead]=bag;
  }
  Object.keys(ex).forEach(function(k){
    if(SRC_LOCAL_ONLY[k]||k.charAt(0)==='_')return;
    if(!Object.prototype.hasOwnProperty.call(nc,k))delete ex[k];
  });
  Object.keys(nc).forEach(function(k){
    if(SRC_LOCAL_ONLY[k]||k.charAt(0)==='_')return;
    ex[k]=srcCopy(nc[k]);
  });
  delete ex.orphan;
  /* what was changed here is replaced, so it is no longer this copy's work (markDirty) */
  delete ex._editedHere;
  /* Test travels only one way here - ghSyncTestState takes it off */
  if(nc.testing)ex.testing=1;
  var list=inc.concat(other.filter(function(id){ return inc.indexOf(id)<0; }));
  if(!list.length)list=mine;
  ex.sagaIds=list; ex.sagaId=list[0];
  var hsg=sagaById(list[0]);
  ex.saga=(hsg&&hsg.name)||(o.names&&o.names[list[0]])||list[0];
  if(keepSF[list[0]]){
    var hv=keepSF[list[0]];
    SAGA_FIELDS.forEach(function(f){ if(hv[f]!==undefined)ex[f]=srcCopy(hv[f]); });
  }
  var sf={}, nsf=nc.sagaFields||{};
  Object.keys(nsf).forEach(function(sid){
    if(o.sagaSet[sid]&&sid!==list[0]&&list.indexOf(sid)>=0)sf[sid]=srcCopy(nsf[sid]); });
  Object.keys(keepSF).forEach(function(sid){
    if(sid!==list[0]&&list.indexOf(sid)>=0)sf[sid]=keepSF[sid]; });
  if(Object.keys(sf).length)ex.sagaFields=sf; else delete ex.sagaFields;
  return true;
}
/* An official card a creator put in a saga of theirs (Add to my saga) goes out marked `linked`, with what each of those sagas sets itself (ghPublishedForm).
   A copy holding that official card joins it to the saga: its content stays the official set's, and only the membership and the saga's own values
   (SAGA_FIELDS) come from the creator's set. A copy without it takes nothing until it has it. */
function srcLinkedJoins(ex,nc,o){
  return !!(ex&&nc&&nc.linked&&o&&!o.official&&nc.cid&&ex.cid===nc.cid&&srcInOfficial(ex));
}
/* What saga id is to carry here: the saga's own values, its picture as this copy's variant of it, and none that only repeats the card's own. */
function srcLinkedWant(ex,nc,id){
  var own=(nc.linked&&nc.linked.own&&nc.linked.own[id])||{}, want={};
  SAGA_FIELDS.forEach(function(f){
    if(f==='variant'){
      var key=own.picture?artKeyOf(own.picture):'';
      var hit=key?(cardVariants(ex)||[]).filter(function(v){
        return v&&((v.imageUrl&&artKeyOf(v.imageUrl)===key)||(v.art&&artKeyOf(v.art)===key)); })[0]:null;
      if(hit&&!sagaFieldSame(hit.id,ex.variant))want.variant=hit.id;
      return;
    }
    if(own[f]!==undefined&&!sagaFieldSame(own[f],ex[f]))want[f]=srcCopy(own[f]);
  });
  return want;
}
/* Exact, as sagaFieldSame calls a blank override and none the same: a saga that clears its flavour has one. */
function srcLinkedSagaDiffers(ex,nc,id){
  var want=srcLinkedWant(ex,nc,id), have=(ex.sagaFields&&ex.sagaFields[id])||{};
  return SAGA_FIELDS.some(function(f){
    if((want[f]===undefined)!==(have[f]===undefined))return true;
    return want[f]!==undefined&&!sagaFieldSame(want[f],have[f]);
  });
}
function srcLinkedDiffers(ex,nc,o){
  var inc=srcSagasOf(nc,o), mine=sagaIdsOf(ex).filter(function(id){ return o.sagaSet[id]; });
  if(inc.slice().sort().join('|')!==mine.slice().sort().join('|'))return true;
  return inc.some(function(id){ return srcLinkedSagaDiffers(ex,nc,id); });
}
/* Whether a join would replace what was set here: on the copy that owns the set, any difference; elsewhere, a saga changed here (_editedSagas, markDirty). */
function srcLinkedRisk(ex,nc,o){
  var inc=srcSagasOf(nc,o), mark=ex._editedSagas||{};
  var mine=function(id){ return !!o.owned||!!mark[id]; };
  return inc.some(function(id){ return mine(id)&&srcLinkedSagaDiffers(ex,nc,id); })
    ||sagaIdsOf(ex).some(function(id){ return o.sagaSet[id]&&inc.indexOf(id)<0&&mine(id); });
}
function srcUnmarkSaga(c,id){
  if(c&&c._editedSagas&&c._editedSagas[id]){
    delete c._editedSagas[id];
    if(!Object.keys(c._editedSagas).length)delete c._editedSagas;
  }
}
function srcDropSagaFields(c,id){
  if(c&&c.sagaFields&&c.sagaFields[id]){
    delete c.sagaFields[id];
    if(!Object.keys(c.sagaFields).length)delete c.sagaFields;
  }
  srcUnmarkSaga(c,id);
}
function srcLinkedJoin(ex,nc,o){
  var inc=srcSagasOf(nc,o);
  sagaIdsOf(ex).forEach(function(id){
    if(o.sagaSet[id]&&inc.indexOf(id)<0&&removeSagaMembership(ex,id))srcDropSagaFields(ex,id);
  });
  inc.forEach(function(id){
    /* never the official card's own fields */
    if(id===sagaIdOf(ex))return;
    if(!inSaga(ex,id))addSagaMembership(ex,id);
    var want=srcLinkedWant(ex,nc,id);
    SAGA_FIELDS.forEach(function(f){ setSagaField(ex,id,f,want[f]!==undefined?want[f]:ex[f]); });
    /* what was set here is replaced, as srcMergeInto does with _editedHere */
    srcUnmarkSaga(ex,id);
  });
}
/* What a saga of yours sets itself on an official card in it, as ghPublishedForm sends it: its picture by address, as a variant id is this copy's. */
function srcLinkedOwn(c,id,pictureOf){
  var bag=(c.sagaFields&&c.sagaFields[id])||{}, own={};
  SAGA_FIELDS.forEach(function(f){
    if(f==='variant'||bag[f]===undefined)return;
    own[f]=srcCopy(bag[f]);
  });
  if(bag.variant!==undefined){
    var v=(cardVariants(c)||[]).filter(function(x){ return x&&x.id===bag.variant; })[0];
    var pic=v?pictureOf(v):'';
    if(pic)own.picture=pic;
  }
  return own;
}
function srcImportRows(cards,o){
  var mineList=(window.CARDS||[]), ix=cardIndex(mineList);
  var byCid={}, byId={};
  mineList.forEach(function(c){
    if(!c)return;
    if(c.cid&&!byCid[c.cid])byCid[c.cid]=c;
    if(c.id)byId[c.id]=c;
  });
  var touched=[], added=0, updated=0, skipped=0, adopted=0, same=0;
  (cards||[]).forEach(function(nc){
    if(!nc||!nc.name)return;
    var inc=srcSagasOf(nc,o);
    if(!inc.length){ skipped++; return; }
    var at=ix.at(nc), ex=(at==null)?null:mineList[at];
    if(ex&&ex.local&&!(nc.cid&&ex.cid===nc.cid))ex=null;
    if(nc.linked&&!o.official){
      if(!srcLinkedJoins(ex,nc,o)){ skipped++; return; }
      if(!srcLinkedDiffers(ex,nc,o)){ same++; return; }
      srcLinkedJoin(ex,nc,o);
      srcTouched(ex); touched.push(ex); updated++;
      return;
    }
    if(ex&&srcBelongsElsewhere(ex,o.key)){
      /* a table copy of a card this copy has from its own source joins the copied saga, and its content is left to its source */
      if(o.table&&nc.cid&&ex.cid===nc.cid){
        inc.forEach(function(id){ if(!inSaga(ex,id))addSagaMembership(ex,id); captureSagaFields(ex,nc,id); });
        srcTouched(ex); touched.push(ex); updated++;
        return;
      }
      skipped++; return;
    }
    if(ex){
      var changed=srcMergeInto(ex,nc,o);
      if(nc.cid&&ex.cid!==nc.cid&&!byCid[nc.cid]){
        if(byCid[ex.cid]===ex)delete byCid[ex.cid];
        ex.cid=nc.cid; byCid[nc.cid]=ex; adopted++; changed=true;
      }
      if(!changed){ same++; return; }
      srcTouched(ex); touched.push(ex); updated++;
      return;
    }
    var c=srcCopy(srcNormCard(nc));
    delete c.local; delete c.orphan; delete c._editedHere;
    c.__id=uid();
    c.sagaIds=inc; c.sagaId=inc[0];
    var hsg=sagaById(inc[0]);
    c.saga=(hsg&&hsg.name)||(o.names&&o.names[inc[0]])||inc[0];
    if(c.sagaFields){
      Object.keys(c.sagaFields).forEach(function(sid){
        if(inc.indexOf(sid)<0||sid===inc[0])delete c.sagaFields[sid]; });
      if(!Object.keys(c.sagaFields).length)delete c.sagaFields;
    }
    if(!c.cid||byCid[c.cid])c.cid=newCid();
    if(!c.id||(byId[c.id]&&byId[c.id]!==c))c.id=uid();
    byId[c.id]=c;
    mineList.push(c); ix.add(c,mineList.length-1); byCid[c.cid]=c;
    srcTouched(c); touched.push(c); added++;
  });
  return Promise.all(touched.map(persistCard))
    .then(function(){ return ensureSagaRecords(o); })
    .then(function(){
      return {added:added, updated:updated, skipped:skipped, adopted:adopted, same:same,
              n:added+updated, cards:touched};
    });
}
function _importImpact(cards){
  /* the same matcher importCardRows uses, or the gate names a number the import will not honour */
  var all=window.CARDS||[], ix=cardIndex(all);
  var add=0, update=0, locked=0, names=[];
  (cards||[]).forEach(function(nc){
    var at=ix.at(nc), ex=(at==null)?null:all[at];
    if(ex&&edLockedSafe(ex)){ locked++; return; }
    if(ex){ update++; if(names.length<6)names.push(nc.name); }
    else add++;
  });
  return {add:add, update:update, locked:locked, names:names};
}
/* Gated only when it would overwrite cards in place, with no undo (HANDOFF §6): a phrase to type for every add would train the reflex that makes gates useless. */
function _gatedImport(cards, saga){
  var hit=_importImpact(cards);
  if(!hit.update) return importCardRows(cards, saga);
  var eg=hit.names.join(', ')+(hit.update>hit.names.length?', …':'');
  return edDangerGate({
    title:'Import into "'+saga+'"',
    lose:[hit.update+' existing card(s) overwritten in place - rules text, mana '
            +'cost, stats and flavour replaced by the file\'s',
          'Examples: '+eg,
          'There is no undo for this'],
    note:hit.locked?[edSkippedText(hit.locked)]:[],
    phrase:'OVERWRITE',
    requireBackup:true,
    proceedLabel:'Overwrite '+hit.update+', add '+hit.add
  }).then(function(ok){
    if(!ok){ toast('Cancelled - nothing was changed'); return 0; }
    return importCardRows(cards, saga);
  });
}

/* No saga, so rowsToCards reads each row's own Saga column and an Export Spreadsheet file round-trips; gated as the per-saga import is. */
window.edImportCatalogSheet=function(input){
  var f=input&&input.files&&input.files[0]; if(!f)return;
  input.value='';
  var run=function(rows){
    var cards=rowsToCards(rows,null);
    if(!cards.length){ alert('No rows with a Name column.'); return; }
    var sagas={}; cards.forEach(function(c){ sagas[c.saga||'Imported']=1; });
    return _gatedImport(cards, Object.keys(sagas).length===1
      ? Object.keys(sagas)[0]
      : Object.keys(sagas).length+' sagas');
  };
  if(/\.xlsx$/i.test(f.name)){
    xlsxToRows(f).then(run)
      .catch(function(err){ alert('Could not read spreadsheet: '+(err&&err.message||err)); });
  } else {
    var rd=new FileReader();
    rd.onload=function(ev){
      try{ run(parseCsv(ev.target.result)); }
      catch(err){ alert('Could not read CSV: '+(err&&err.message||err)); }
    };
    rd.readAsText(f);
  }
};
window.edSagaImportSheetInto=function(input,sagaId){
  var f=input&&input.files&&input.files[0]; if(!f)return;
  input.value='';
  var ref=sagaResolveRef(sagaId);
  if(!ref)return;
  _edSagaSheetRead(f,ref);
};
function _edSagaSheetRead(f,ref){
  if(/\.xlsx$/i.test(f.name)){
    xlsxToRows(f).then(function(rows){ return _gatedImport(rowsToCards(rows,ref.id),ref.name); })
      .catch(function(err){ alert('Could not read spreadsheet: '+(err&&err.message||err)); });
  } else {
    var rd=new FileReader();
    rd.onload=function(ev){
      try{ _gatedImport(rowsToCards(parseCsv(ev.target.result),ref.id),ref.name); }
      catch(err){ alert('Could not read CSV: '+(err&&err.message||err)); }
    };
    rd.readAsText(f);
  }
};
/* The same .xlsx writer as the whole catalogue, so one saga's columns cannot drift from EXPORT_COLS. */
window.edSagaExportSheet=function(id){
  var sg=sagaById(id); if(!sg)return;
  var list=sagaCards(id).map(function(c0){
    /* This saga's printing and its name, not the primary's: a shared card prints differently in each saga. */
    var c=Object.assign({},cardForSaga(c0,id));
    c.saga=sg.name||c.saga||'';
    return c;
  });
  return window.edExportXlsx(list, String(sg.name||'saga').replace(/[^\w-]+/g,'_')+'.xlsx');
};

/* Every look, not variantOf's active one: publishing, packages, the art comparison and the merges need them all. */
function artBearers(c){ return [c].concat(c.variants||[]); }

/* Same saga and name: a duplicate, folded here. Different sagas: one shared record when identical (edMergeShared), else two cards left alone.
   The saga test is on membership, not the primary, so two copies already sharing a saga count as duplicates. */
function dupGroups(){
  var by={};
  (window.CARDS||[]).forEach(function(c){
    var k=normName(c.name||''); if(!k)return;
    (by[k]=by[k]||[]).push(c);
  });
  var out=[];
  Object.keys(by).sort().forEach(function(k){
    var list=by[k]; if(list.length<2)return;
    var used={};
    list.forEach(function(a,i){
      if(used[i])return;
      var run=[a]; used[i]=1;
      list.forEach(function(b,j){
        if(j<=i||used[j])return;
        var shareASaga=sagaIdsOf(a).some(function(id){ return inSaga(b,id); });
        if(shareASaga){ run.push(b); used[j]=1; }
      });
      if(run.length>1)out.push({key:k,cards:run});
    });
  });
  return out;
}
/* Listed because every name-keyed lookup (cardMap[c.name]) silently picks one of them. */
function nameCollisions(){
  var by={};
  (window.CARDS||[]).forEach(function(c){
    var k=normName(c.name||''); if(!k)return;
    (by[k]=by[k]||[]).push(c);
  });
  return Object.keys(by).sort().filter(function(k){
    var l=by[k];
    if(l.length<2)return false;
    if(l.some(function(a,i){ return l.some(function(b,j){
      return j>i && sagaIdsOf(a).some(function(id){return inSaga(b,id);}); }); }))return false;
    return new Set(l.map(shareSig)).size>1;      /* identical ones are handled as shares */
  }).map(function(k){ return {key:k,cards:by[k]}; });
}
var _sameNameGroups=[];
function ownNameCollisions(){
  return nameCollisions().map(function(g){
    var own=g.cards.filter(function(c){
      return !edCardLocked(c)&&sagaIdsOf(c).some(function(id){ return ownsGroupKey(groupKeyOfId(id)); }); });
    return own.length>1?{key:g.key,cards:own}:null;
  }).filter(Boolean);
}
function mergeSameNameInto(keep,c){
  var vis=['artXf','fit','holo','frameColor','mark'];
  var have={};
  artBearers(keep).forEach(function(b){ var k=(b&&(b.imageUrl||b.art))||''; if(k)have[k]=1; });
  var vs;
  if(keep.variants&&keep.variants.length) vs=keep.variants.slice();
  else {
    var v1={id:'v1',label:'Default',art:keep.art||'',imageUrl:keep.imageUrl||''};
    vis.forEach(function(f){ if(keep[f]!==undefined)v1[f]=JSON.parse(JSON.stringify(keep[f])); });
    vs=[v1];
  }
  artBearers(c).forEach(function(b){
    var url=(b&&b.imageUrl)||'', key=(b&&b.art)||'', id=url||key;
    if(!id||have[id])return;
    have[id]=1;
    var n=vs.length+1, nv={id:'v'+n+'_'+uid(),label:'Art '+n,art:key,imageUrl:url};
    vis.forEach(function(f){ if(b[f]!==undefined)nv[f]=JSON.parse(JSON.stringify(b[f])); });
    vs.push(nv);
  });
  if(vs.length>1){ keep.variants=vs; if(!keep.variant)keep.variant=vs[0].id; }
  sagaIdsOf(c).forEach(function(id){
    var view=cardForSaga(c,id);
    if(!inSaga(keep,id))addSagaMembership(keep,id);
    captureSagaFields(keep,view,id);
    selectSagaVariant(keep,id,sagaPictureOf(c,id));
  });
}
window.edMergeSameName=function(gi,ci){
  var g=_sameNameGroups[gi]; if(!g)return Promise.resolve(false);
  var keep=g.cards[ci]; if(!keep)return Promise.resolve(false);
  var others=g.cards.filter(function(c){ return c!==keep; });
  if(!confirm('Make "'+keep.name+'" one card with the rules of the one in '+edSagaNamesOf(keep)
     +'?\n\nThe other '+(others.length===1?'card':others.length+' cards')+' in '
     +others.map(edSagaNamesOf).join('; ')+' take these rules, cost, types and stats.'))
    return Promise.resolve(false);
  var tombs=[];
  others.forEach(function(c){
    mergeSameNameInto(keep,c);
    tombs.push({id:c.id||uid(),__id:c.__id,name:c.name,cid:cardCid(c),
                sagaId:sagaIdOf(c),saga:c.saga,__deleted:true});
  });
  markDirty(keep);
  var doomed={}; tombs.forEach(function(t){ doomed[t.__id]=1; });
  window.CARDS=(window.CARDS||[]).filter(function(c){ return !doomed[c.__id]; });
  curId=null;
  return Promise.all([persistCard(keep)].concat(tombs.map(function(t){ return put('cards',t); })))
    .then(ensureSagaRecords).then(function(){
      applyToCatalog(); refreshSagaFilter();
      try{ window.edRenderSagaPage(); }catch(_){}
      try{ window.edScanShared(); }catch(_){}
      toast('"'+keep.name+'" is one card in '+edSagaNamesOf(keep));
      return true;
    });
};

/* A card whose c.saga names a saga it is not in (the editor's Saga box once wrote only that field); listed with a choice, and nothing changes until a press. */
var _sagaNameRows=[];
function sagaNameMismatches(){
  var byName={};
  (SAGAS||[]).forEach(function(sg){
    if(!sg)return;
    byName[normName(sg.name||sg.id)]=sg.id;
    if(!byName[normName(sg.id)])byName[normName(sg.id)]=sg.id;
  });
  var out=[];
  (window.CARDS||[]).forEach(function(c){
    if(!c||!c.saga||c.__deleted)return;
    if(edCardLocked(c))return;
    var named=byName[normName(c.saga)];
    if(!named)return;
    var ids=sagaIdsOf(c);
    if(ids.indexOf(named)>=0)return;
    out.push({card:c, filed:ids[0], named:named});
  });
  return out;
}
function sagaNameOf(id){ var s=sagaById(id); return (s&&s.name)||id; }
window.edScanSagaNames=function(){
  var rows=sagaNameMismatches();
  _sagaNameRows=rows;
  var host=document.getElementById('edSagaNameBody'); if(!host)return rows;
  if(!rows.length){ host.innerHTML="<i class='tpl-hint'>Every card is in the Saga its name says.</i>"; return rows; }
  var h="<i class='tpl-hint'><b>"+rows.length+"</b> card(s).</i><div class='dup-list'>";
  rows.slice(0,120).forEach(function(r,i){
    h+="<div class='dup-row'><b>"+e(r.card.name)+"</b>"
      +"<i>filed under "+e(sagaNameOf(r.filed))+" \u00b7 name says "+e(sagaNameOf(r.named))+"</i>"
      +"<span class='fx-grow'></span><select class='ed2-in fx-sel' aria-label='Where this card belongs'>"
        +"<option value='named'>Move to "+e(sagaNameOf(r.named))+"</option>"
        +"<option value='filed'>Keep in "+e(sagaNameOf(r.filed))+"</option>"
        +"<option value='both'>Put in Both</option></select>"
      +"<button class='ed2-btn tiny' onclick=\"edSagaNameFix("+i+",this.previousElementSibling.value)\">Apply</button>"
      +"</div>";
  });
  if(rows.length>120)h+="<i class='tpl-hint'>\u2026and "+(rows.length-120)+" more.</i>";
  host.innerHTML=h+"</div>";
  return rows;
};
function sagaNameApply(r,how){
  var c=r.card;
  if(how==='named'){
    var rest=sagaIdsOf(c).filter(function(id){ return id!==r.filed; });
    setSagaList(c,[r.named].concat(rest));
    if(c.sagaFields&&c.sagaFields[r.named]){
      SAGA_FIELDS.forEach(function(f){ var v=c.sagaFields[r.named][f]; if(v!==undefined)c[f]=v; });
      delete c.sagaFields[r.named];
      if(!Object.keys(c.sagaFields).length)delete c.sagaFields;
    }
  } else if(how==='both'){
    addSagaMembership(c,r.named);
  }
  c.saga=sagaNameOf(sagaIdsOf(c)[0]);
  markDirty(c);
  return persistCard(c);
}
window.edSagaNameFix=function(i,how){
  var r=_sagaNameRows[i]; if(!r)return Promise.resolve();
  return sagaNameApply(r,how).then(ensureSagaRecords).then(function(){
    applyToCatalog(); refreshSagaFilter();
    try{ window.edRenderSagaPage(); }catch(_){}
    window.edScanSagaNames();
    toast('"'+r.card.name+'" is in '+edSagaNamesOf(r.card));
  });
};
window.edSagaNamesAll=function(){
  var rows=sagaNameMismatches();
  if(!rows.length){ toast('Every card is in the Saga its name says'); return Promise.resolve(0); }
  if(!confirm('File '+rows.length+' card(s) under the Saga their name says?'))return Promise.resolve(0);
  return Promise.all(rows.map(function(r){ return sagaNameApply(r,'named'); }))
    .then(ensureSagaRecords).then(function(){
      applyToCatalog(); refreshSagaFilter();
      try{ window.edRenderSagaPage(); }catch(_){}
      window.edScanSagaNames();
      toast('Moved '+rows.length+' card(s) to the Saga their name says');
      return rows.length;
    });
};

function sharedGroups(){
  var by={};
  (window.CARDS||[]).forEach(function(c){
    var s=shareSig(c); if(!s)return;
    (by[s]=by[s]||[]).push(c);
  });
  return Object.keys(by).filter(function(s){
    var l=by[s]; if(l.length<2)return false;
    var sagas={}; l.forEach(function(c){ sagaIdsOf(c).forEach(function(id){sagas[id]=1;}); });
    return Object.keys(sagas).length>1;
  }).map(function(s){ return {sig:s,cards:by[s]}; })
    .sort(function(a,b){ return String(a.cards[0].name).localeCompare(String(b.cards[0].name)); });
}
/* revision is not listed: it is one value for the card, and sharedRevDiffers names the copies' as dropped. */
function sharedDiffFields(list){
  var out=[];
  ['artist','designer','flavor','saga'].forEach(function(f){
    var vals={}; list.forEach(function(c){ vals[String(c[f]==null?'':c[f])]=1; });
    if(Object.keys(vals).length>1)out.push(f);
  });
  return out;
}
function sharedRevDiffers(list){
  var vals={}; list.forEach(function(c){ vals[String(c.revision==null?'':c.revision)]=1; });
  return Object.keys(vals).length>1;
}
function artKeysOf(c){
  var out=[];
  artBearers(c).forEach(function(b){
    var k=(b&&(b.imageUrl||b.art))||''; if(k&&out.indexOf(k)<0)out.push(k);
  });
  return out;
}
/* Keeps __id, so the copy can take the original's place in CARDS once the merge's checks pass. */
function cardClone(c){
  var o=JSON.parse(JSON.stringify(c)); o.__id=c.__id; return o;
}
/* The richest card wins; ties go to the typographic apostrophe (the original .mse-set's spelling), then to an explicit sagaId. */
function dupSurvivor(list){
  return list.slice().sort(function(a,b){
    return (artKeysOf(b).length-artKeysOf(a).length)
        || ((b.variants||[]).length-(a.variants||[]).length)
        || ((/’/.test(b.name||'')?1:0)-(/’/.test(a.name||'')?1:0))
        || ((b.sagaId?1:0)-(a.sagaId?1:0));
  })[0];
}
window.edScanDuplicates=function(){
  var groups=dupGroups();
  var host=document.getElementById('edDupBody'); if(!host)return groups;
  if(!groups.length){
    host.innerHTML="<i class='tpl-hint'>No duplicates — every card name is unique.</i>";
    return groups;
  }
  var totalExtra=groups.reduce(function(n,g){return n+g.cards.length-1;},0);
  var h="<i class='tpl-hint'><b>"+groups.length+"</b> duplicated name(s), <b>"+totalExtra
    +"</b> card(s) would be absorbed. Nothing has changed yet.</i>";
  h+="<div class='dup-list'>";
  groups.slice(0,60).forEach(function(g){
    var keep=dupSurvivor(g.cards);
    h+="<div class='dup-grp'>";
    g.cards.forEach(function(c){
      var isKeep=(c===keep);
      h+="<div class='dup-row"+(isKeep?' keep':'')+"'>"
        +"<span class='dup-tag'>"+(isKeep?'keep':'fold in')+"</span>"
        +"<b>"+e(c.name)+"</b>"
        +"<i>"+e(c.saga||c.sagaId||'—')+"</i>"
        +"<span class='dup-art'>"+artKeysOf(c).map(function(a){
            return "<code>"+e(String(a).replace(/^art\//,''))+"</code>";}).join('')+"</span>"
        +"</div>";
    });
    h+="</div>";
  });
  if(groups.length>60)h+="<i class='tpl-hint'>…and "+(groups.length-60)+" more.</i>";
  h+="</div>";
  host.innerHTML=h;
  return groups;
};
window.edMergeDuplicates=function(){
  var groups=dupGroups();
  if(!groups.length){ alert('No duplicate names found — nothing to merge.'); return; }
  var absorbed=groups.reduce(function(n,g){return n+g.cards.length-1;},0);
  /* every distinct image before, so the merge can prove it lost none */
  var before={};
  groups.forEach(function(g){ g.cards.forEach(function(c){
    artKeysOf(c).forEach(function(a){ before[a]=1; }); }); });
  var beforeN=Object.keys(before).length;

  edDangerGate({
    title:'Merge duplicate cards',
    lose:[absorbed+' duplicate card record(s), across '+groups.length+' name(s)',
          'Rules, stats and types on the absorbed copies — their art is kept, and so is every '
            +'other saga they were in, with what they printed there',
          'Every distinct image survives as a variant; the merge aborts if that is not true'],
    phrase:'MERGE',
    requireBackup:true,
    proceedLabel:'Merge '+groups.length+' name(s)'
  }).then(function(ok){
    if(!ok){ toast('Cancelled - nothing was changed'); return; }
    /* Built on copies (cardClone) and swapped in only after the no-image-lost check, so a stopped merge has changed nothing. */
    var report=[], tombs=[], keepers=[], swap={};
    groups.forEach(function(g){
      var keep0=dupSurvivor(g.cards), keep=cardClone(keep0);
      var vs=keep.variants&&keep.variants.length?keep.variants.slice()
            :[{id:'v1',label:'Default',art:keep.art||'',imageUrl:keep.imageUrl||''}];
      var have={}; vs.forEach(function(v){ var k=v.imageUrl||v.art; if(k)have[k]=1; });
      var added=0, joined=0;
      g.cards.forEach(function(c){
        if(c===keep0)return;
        artBearers(c).forEach(function(b){
          var url=(b&&b.imageUrl)||'', key=(b&&b.art)||'';
          var id=url||key; if(!id||have[id])return;
          have[id]=1;
          var n=vs.length+1;
          vs.push({id:'v'+n,label:'Art '+n,art:key,imageUrl:url});
          added++;
        });
        tombs.push({id:c.id||uid(),__id:c.__id,name:c.name,cid:cardCid(c),
                    sagaId:c.sagaId,saga:c.saga,__deleted:true});
      });
      keep.variants=vs; if(!keep.variant)keep.variant=vs[0].id;
      /* Every saga an absorbed copy was in joins the survivor, printing what the copy printed there; a saga the survivor is in keeps its own values. */
      g.cards.forEach(function(c){
        if(c===keep0)return;
        sagaIdsOf(c).forEach(function(id){
          if(inSaga(keep,id))return;
          if(!addSagaMembership(keep,id))return;
          captureSagaFields(keep,cardForSaga(c,id),id);
          selectSagaVariant(keep,id,sagaPictureOf(c,id));
          joined++;
        });
      });
      keepers.push(keep); swap[keep0.__id]=keep;
      report.push(keep.name+': +'+added+' art, absorbed '+(g.cards.length-1)
        +(joined?', now also in '+joined+' more saga(s)':''));
    });

    var after={}; keepers.forEach(function(c){ artKeysOf(c).forEach(function(a){ after[a]=1; }); });
    var lost=Object.keys(before).filter(function(a){ return !after[a]; });
    if(lost.length){
      var NL=String.fromCharCode(10);
      alert('Merge ABORTED - it would have lost '+lost.length+' image(s):'+NL+NL
        +lost.slice(0,10).join(NL)+NL+NL+'Nothing was changed.');
      return;
    }
    var doomed={}; tombs.forEach(function(t){ doomed[t.__id]=1; });
    window.CARDS=(window.CARDS||[]).filter(function(c){ return !doomed[c.__id]; })
      .map(function(c){ return swap[c.__id]||c; });
    keepers.forEach(function(c){ markDirty(c); });
    curId=null;
    Promise.all(keepers.map(persistCard).concat(tombs.map(function(t){return put('cards',t);})))
      .then(function(){
        applyToCatalog(); renderFields();
        try{ window.edScanDuplicates(); }catch(_){}
        toast('Merged '+groups.length+' name(s), absorbed '+absorbed+' card(s)');
        alert('Merged '+groups.length+' duplicated name(s).\n\n'
          +'Absorbed '+absorbed+' card record(s). Distinct images before '+beforeN
          +', after '+Object.keys(after).length+' — none lost.\n\n'
          +report.slice(0,25).join('\n')+(report.length>25?'\n…and '+(report.length-25)+' more':''));
      });
  });
};

/* A report only, never a merge: cards of one cost, type line and stats can be different cards. Normalised as shareSig is, so the two reports agree. */
function shapeSig(c){
  var orbs=[];
  try{
    orbs=(cardOrbs(c)||[]).filter(function(o){
        return o&&o.type&&o.type!=='hidden'&&o.type!=='blank'; })
      .map(function(o){ return String(o.type)+':'+String(o.value==null?'':o.value); }).sort();
  }catch(_){
    orbs=[String(c.attack||''),String(c.health||''),String(c.arcane||'')];
  }
  var tl='';
  try{ tl=typeLine(c); }
  catch(_){ tl=(c.superTypes||[]).join(' ')+' '+(c.subTypes||[]).join(' '); }
  /* built, never written as an escape: see shareSig */
  var SEP=String.fromCharCode(1);
  return [normText(tl),normText(c.manaCost),orbs.join(',')].join(SEP);
}
function shapeStats(c){
  var out=[];
  try{
    (cardOrbs(c)||[]).forEach(function(o){
      if(!o||!o.type||o.type==='hidden'||o.type==='blank')return;
      out.push(String(o.type).replace(' and ','+')+' '
        +(o.value===''||o.value==null?'\u2013':o.value));
    });
  }catch(_){}
  if(!out.length){
    ['attack','health','arcane','range'].forEach(function(k){
      if(c[k])out.push(k+' '+String(c[k]).replace(/[AH]$/i,''));
    });
  }
  return out.length?out.join(' \u00b7 '):'no stats';
}
var _shapeLast=[];
function shapeGroups(){
  var map={}, order=[];
  (window.CARDS||[]).forEach(function(c){
    if(!c||!c.name)return;
    var k=shapeSig(c);
    if(!map[k]){ map[k]=[]; order.push(k); }
    map[k].push(c);
  });
  var out=[];
  order.forEach(function(k){
    var list=map[k];
    if(list.length<2)return;
    /* same-name records are the Duplicate cards report's */
    var names={}; list.forEach(function(c){ names[normName(c.name||'')]=1; });
    if(Object.keys(names).length<2)return;
    var rules={}; list.forEach(function(c){ rules[normText(c.ruleText||'')]=1; });
    out.push({cards:list.slice(),sameRules:Object.keys(rules).length===1});
  });
  out.sort(function(a,b){
    if(a.sameRules!==b.sameRules)return a.sameRules?-1:1;
    return b.cards.length-a.cards.length;
  });
  _shapeLast=out;
  return out;
}
window.edShapeGroups=function(){
  return shapeGroups().map(function(g){
    return {sameRules:g.sameRules,names:g.cards.map(function(c){ return c.name; })};
  });
};
/* By its place in the list, never by a name written into an inline onclick (HANDOFF §14.3). */
window.edShapeOpen=function(gi,ci){
  var g=_shapeLast[gi]; if(!g)return;
  var c=g.cards[ci]; if(!c)return;
  try{ if(typeof window.openMod==='function')window.openMod(c); }catch(_){}
};
window.edScanShapes=function(){
  var groups=shapeGroups();
  var host=document.getElementById('edShapeBody');
  if(!host)return groups;
  if(!groups.length){
    host.innerHTML="<i class='tpl-hint'>No two cards share a mana cost, type line and "
      +"stats under different names.</i>";
    return groups;
  }
  var cards=groups.reduce(function(n,g){ return n+g.cards.length; },0);
  var same=groups.filter(function(g){ return g.sameRules; }).length;
  var h="<i class='tpl-hint'><b>"+groups.length+"</b> group(s), <b>"+cards+"</b> card(s), "
    +"share a mana cost, a type line and stats under different names"
    +(same?(" \u2014 <b>"+same+"</b> of them print the same rules text as well"):"")
    +". Nothing here has been changed: some of these are simply different cards "
    +"built the same way.</i><div class='dup-list'>";
  groups.slice(0,80).forEach(function(g,gi){
    var first=g.cards[0];
    var cost=(typeof window.renderManaCost==='function'&&first.manaCost)
      ? window.renderManaCost(first.manaCost,13) : e(first.manaCost||'\u2014');
    var tl=''; try{ tl=typeLine(first); }catch(_){ tl=''; }
    h+="<div class='dup-grp'><div class='shr-head'><span class='shp-cost'>"+cost+"</span>"
      +"<b>"+e(tl||'(no type line)')+"</b>"
      +"<span class='shp-stats'>\u00b7 "+e(shapeStats(first))+"</span>"
      +(g.sameRules?"<span class='dup-tag in-deck'>Same Rules</span>":"")
      +"</div>";
    g.cards.forEach(function(c,ci){
      var txt=String(c.ruleText||'').replace(/\s+/g,' ').trim();
      h+="<div class='dup-row'>"
        +"<button type='button' class='shp-name' onclick='edShapeOpen("+gi+","+ci+")'>"
          +e(c.name)+"</button>"
        +"<i>"+e(c.saga||sagaIdOf(c))+"</i>"
        +"<span class='shp-rules'>"+e(txt?(txt.length>90?txt.slice(0,90)+'\u2026':txt):'no rules text')+"</span>"
      +"</div>";
    });
    h+="</div>";
  });
  if(groups.length>80)h+="<i class='tpl-hint'>\u2026and "+(groups.length-80)+" more.</i>";
  host.innerHTML=h+"</div>";
  return groups;
};
window.edScanShared=function(){
  var groups=sharedGroups();
  var host=document.getElementById('edSharedBody'); if(!host)return groups;
  var h='';
  if(!groups.length){
    h+="<i class='tpl-hint'>No card appears in more than one saga. Nothing to share.</i>";
  } else {
    var total=groups.reduce(function(n,g){return n+g.cards.length-1;},0);
    h+="<i class='tpl-hint'><b>"+groups.length+"</b> card(s) exist identically in more than "
      +"one saga; <b>"+total+"</b> record(s) would be absorbed into a shared one. "
      +"Nothing has changed yet.</i><div class='dup-list'>";
    groups.slice(0,60).forEach(function(g){
      var keep=dupSurvivor(g.cards), diff=sharedDiffFields(g.cards);
      var sagas={}; g.cards.forEach(function(c){ sagaIdsOf(c).forEach(function(id){sagas[id]=1;}); });
      h+="<div class='dup-grp'><div class='shr-head'><b>"+e(keep.name)+"</b>"
        +"<span class='shr-sagas'>"+Object.keys(sagas).map(function(id){
            return "<code>"+e(id)+"</code>";}).join('')+"</span></div>";
      g.cards.forEach(function(c){
        h+="<div class='dup-row"+(c===keep?' keep':'')+"'>"
          +"<span class='dup-tag'>"+(c===keep?'keep':'absorb')+"</span>"
          +"<i>"+e(c.saga||sagaIdOf(c))+"</i>"
          +"<span class='dup-art'>"+artKeysOf(c).map(function(a){
              return "<code>"+e(String(a).replace(/^art\//,''))+"</code>";}).join('')+"</span>"
          +"</div>";
      });
      if(diff.length)h+="<div class='shr-diff'>differs on "+e(diff.join(', '))
        +" — each saga keeps its own; nothing there is lost</div>";
      if(sharedRevDiffers(g.cards))h+="<div class='shr-diff'>differs on revision — the kept "
        +"copy's revision (<b>"+e(keep.revision||'none')+"</b>) stays; the others' are dropped</div>";
      h+="</div>";
    });
    if(groups.length>60)h+="<i class='tpl-hint'>…and "+(groups.length-60)+" more.</i>";
    h+="</div>";
  }
  var own=ownNameCollisions();
  _sameNameGroups=own;
  if(own.length){
    h+="<div class='shr-warn'><b>"+own.length+" name(s) are two different cards in your own sagas.</b></div>"
      +"<div class='dup-list'>";
    own.slice(0,30).forEach(function(g,gi){
      h+="<div class='dup-grp'>"+g.cards.map(function(c,ci){
        var txt=String(c.ruleText||'').replace(/\s+/g,' ').trim();
        return "<div class='dup-row'><b>"+e(c.name)+"</b><i>"+e(edSagaNamesOf(c))+"</i>"
          +"<span class='shp-rules'>"+e(txt?(txt.length>90?txt.slice(0,90)+'\u2026':txt):'no rules text')+"</span>"
          +"<button class='ed2-btn tiny' onclick='edMergeSameName("+gi+","+ci+")'>Keep these rules</button></div>";
      }).join('')+"</div>";
    });
    if(own.length>30)h+="<i class='tpl-hint'>\u2026and "+(own.length-30)+" more.</i>";
    h+="</div>";
  }
  host.innerHTML=h;
  return groups;
};
window.edMergeShared=function(){
  var groups=sharedGroups();
  if(!groups.length){ alert('No card exists identically in more than one saga — nothing to share.'); return; }
  var absorbed=groups.reduce(function(n,g){return n+g.cards.length-1;},0);
  var before={};
  groups.forEach(function(g){ g.cards.forEach(function(c){
    artKeysOf(c).forEach(function(a){ before[a]=1; }); }); });
  var beforeN=Object.keys(before).length;
  var diffAny=groups.filter(function(g){return sharedDiffFields(g.cards).length;}).length;

  var revAny=groups.filter(function(g){return sharedRevDiffers(g.cards);}).length;

  edDangerGate({
    title:'Share identical cards between sagas',
    /* Artist and flavour are not named as lost: they are kept as that saga's values; only revision, one per card, goes. */
    lose:[absorbed+' duplicate card record(s) across '+groups.length+' card(s) — one shared '
            +'record replaces each set',
          'Name, type line, rules, mana cost and stats become SHARED: editing them '
            +'afterwards changes the card in EVERY saga that has it',
          'Flavor text, artist and distributor are kept per saga where they '
            +'differ ('+diffAny+' group(s)) — nothing there is lost'].concat(revAny?[
          'Revision is one value for the whole card: where the copies differ ('+revAny
            +' group(s)), the kept copy\'s revision stays and the others\' are dropped']:[]).concat([
          'Every distinct image survives as a variant; the merge aborts if that is not true']),
    phrase:'SHARE',
    requireBackup:true,
    proceedLabel:'Share '+groups.length+' card(s)'
  }).then(function(ok){
    if(!ok){ toast('Cancelled - nothing was changed'); return; }
    /* Built on copies and swapped in only after the no-image-lost check: in place, a stopped share had already put the survivor beside the copy. */
    var report=[], tombs=[], keepers=[], swap={};
    groups.forEach(function(g){
      var keep0=dupSurvivor(g.cards), keep=cardClone(keep0);
      g.cards.forEach(function(c){
        if(c===keep0)return;
        mergeArtInto(keep,c);
        sagaIdsOf(c).forEach(function(id){
          if(!addSagaMembership(keep,id))return;
          captureSagaFields(keep,cardForSaga(c,id),id);
          selectSagaVariant(keep,id,sagaPictureOf(c,id));
        });
        tombs.push({id:c.id||uid(),__id:c.__id,name:c.name,cid:cardCid(c),
                    sagaId:sagaIdOf(c),saga:c.saga,__deleted:true});
      });
      keepers.push(keep); swap[keep0.__id]=keep;
      report.push(keep.name+': now in '+sagaIdsOf(keep).join(' + '));
    });
    var after={}; keepers.forEach(function(c){ artKeysOf(c).forEach(function(a){ after[a]=1; }); });
    var lost=Object.keys(before).filter(function(a){ return !after[a]; });
    var NL=String.fromCharCode(10);
    if(lost.length){
      alert('Share ABORTED - it would have lost '+lost.length+' image(s):'+NL+NL
        +lost.slice(0,10).join(NL)+NL+NL+'Nothing was changed.');
      return;
    }
    var doomed={}; tombs.forEach(function(t){ doomed[t.__id]=1; });
    window.CARDS=(window.CARDS||[]).filter(function(c){ return !doomed[c.__id]; })
      .map(function(c){ return swap[c.__id]||c; });
    keepers.forEach(function(c){ markDirty(c); });
    curId=null;
    Promise.all(keepers.map(persistCard).concat(tombs.map(function(t){return put('cards',t);})))
      .then(ensureSagaRecords)
      .then(function(){
        applyToCatalog(); renderFields(); refreshSagaFilter();
        try{ window.edRenderSagaPage(); }catch(_){}
        try{ window.edScanShared(); window.edScanDuplicates(); }catch(_){}
        toast('Shared '+groups.length+' card(s), absorbed '+absorbed+' record(s)');
        alert('Shared '+groups.length+' card(s) between sagas.'+NL+NL
          +'Absorbed '+absorbed+' record(s). Distinct images before '+beforeN
          +', after '+Object.keys(after).length+' — none lost.'+NL+NL
          +report.slice(0,25).join(NL)+(report.length>25?NL+'…and '+(report.length-25)+' more':''));
      });
  });
};
/* A package's pictures are stored as PKG_ART_NS + key, not under the zip's keys, so none can replace a picture of this machine's; its cards point at that name on the check and the apply alike. */
var PKG_ART_NS='pkgart/';
function _readSagaZip(file,opts){
  var skipArt=!!(opts&&opts.skipArt);
  var out={man:null,cards:[],look:null,marks:null,packedKeys:{}};
  return JSZip.loadAsync(file).then(function(z){
    var mf=z.file('manifest.json');
    if(!mf)throw new Error('no manifest.json - is this a saga package?');
    return mf.async('string').then(function(t){ out.man=JSON.parse(t);
      var cf=z.file('cards.json');
      if(!cf)throw new Error('no cards.json');
      return cf.async('string');
    }).then(function(t){ out.cards=JSON.parse(t)||[];
      if(!Array.isArray(out.cards))throw new Error('cards.json is not a list of cards');
      var lf=z.file('look/pack.json');
      return lf?lf.async('string').then(function(x){out.look=JSON.parse(x);}):null;
    }).then(function(){
      var mk=z.file('look/marks.json');
      return mk?mk.async('string').then(function(x){out.marks=JSON.parse(x);}):null;
    }).then(function(){
      var inZip={};
      z.folder('art').forEach(function(rel,zf){
        if(zf.dir)return;
        inZip[rel.replace(/\.[^.]+$/,'')]=zf;
      });
      /* skipArt records which pictures would be written and writes none, so a check leaves the art store as it found it */
      var used={};
      out.cards.forEach(function(c){
        if(!c||typeof c!=='object')return;
        [c].concat(Array.isArray(c.variants)?c.variants:[]).forEach(function(b){
          if(!b||typeof b!=='object'||typeof b.art!=='string')return;
          if(!Object.prototype.hasOwnProperty.call(inZip,b.art))return;
          used[b.art]=1; b.art=PKG_ART_NS+b.art;
        });
      });
      var jobs=[];
      Object.keys(used).forEach(function(key){
        out.packedKeys[PKG_ART_NS+key]=1;
        if(!skipArt)jobs.push(inZip[key].async('blob').then(function(b){ return artPut(PKG_ART_NS+key,b); }));
      });
      return Promise.all(jobs);
    }).then(function(){ return out; });
  });
}

/* Manual, from the Fix page alone, never on load: it destroys rule text. Core and Dual Essence draw no text box, so text on them is invisible. */
function normalizeEssenceText(list){
  var hit=[];
  (list||window.CARDS||[]).forEach(function(c){
    if(templateIdFor(c)!=='essence-bare')return;
    if(!String(c.ruleText||'').trim())return;
    hit.push(c.name); c.ruleText=''; markDirty(c);
  });
  if(hit.length)console.info('Essence normalize: cleared rule text on '+hit.length+' Core/Dual card(s):',hit.join(', '));
  return hit;
}
/* Only the cards this copy may change (edSplitLocked): an official card's text would come back with the next update. */
window.edClearEssenceText=function(){
  var all=(window.CARDS||[]).filter(function(c){
    return templateIdFor(c)==='essence-bare' && String(c.ruleText||'').trim(); });
  var split=edSplitLocked(all), hits=split.open, skipped=split.locked.length;
  if(!all.length){ alert('No Core or Dual Essence card has rule text — nothing to clear.'); return; }
  if(!hits.length){ alert('The '+skipped+' Core or Dual Essence card(s) with rule text are all read-only here '
    +'(official, or from a source you follow) - nothing was changed. An update would put the text back.'); return; }
  edDangerGate({
    title:'Clear Core/Dual Essence rule text',
    lose:['The rule text on '+hits.length+' card(s): '
            +hits.slice(0,6).map(function(c){return c.name;}).join(', ')
            +(hits.length>6?', +'+(hits.length-6)+' more':''),
          'There is no undo - this is the pass that used to run on every load'],
    note:skipped?[edSkippedText(skipped)]:[],
    phrase:'CLEAR',
    proceedLabel:'Clear '+hits.length+' card(s)'
  }).then(function(ok){
    if(!ok){ toast('Cancelled - nothing was changed'); return; }
    var names=normalizeEssenceText(hits);
    var NL2=String.fromCharCode(10,10);
    Promise.all(hits.map(persistCard)).then(function(){
      applyToCatalog();
      alert('Cleared rule text on '+names.length+' card(s):'+NL2+names.join(', ')
        +(skipped?NL2+edSkippedText(skipped)+'.':''));
    },function(){ applyToCatalog(); });
  });
};
/* One function for both placements, the flex flow and inside an Essence's art, so they stay identical. */
function rulesBoxHTML(c,rulesAlign,rules,flavor){
  return "<div class='m-rules "+rulesAlign+"'>"+frBoxHTML('rules')+markLayerHTML(c)
    +"<div class='m-rules-body'>"+rules+"</div>"+flavor+"</div>";
}

