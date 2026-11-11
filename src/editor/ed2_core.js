<script>/* Opens the editor's script element and IIFE, which ed2_boot.js closes: the eight ed2_*.js files are one scope, and what the markup calls must be put on window (HANDOFF §4). */
(function(){
'use strict';

/* Template assets ('tpl', VER 3) have a store apart from 'art': keyed by slot, they would collide with card keys and make clearing all templates unsafe. */
/* Rebirth has a database of its own at the same VER, so conjure_editor is never opened while Rebirth is active: this line is the whole isolation (HANDOFF §0). */
var DB=(window.REBIRTH?'conjure_rebirth':'conjure_editor'),VER=8,_db=null;
function dbOpen(){return new Promise(function(res,rej){ if(_db)return res(_db);
  var rq=indexedDB.open(DB,VER);
  rq.onupgradeneeded=function(e){var db=e.target.result;
    if(!db.objectStoreNames.contains('cards'))db.createObjectStore('cards',{keyPath:'id'});
    if(!db.objectStoreNames.contains('art'))db.createObjectStore('art',{keyPath:'key'});
    if(!db.objectStoreNames.contains('meta'))db.createObjectStore('meta',{keyPath:'k'});
    if(!db.objectStoreNames.contains('tpl'))db.createObjectStore('tpl',{keyPath:'key'});
    if(!db.objectStoreNames.contains('packs'))db.createObjectStore('packs',{keyPath:'name'});
    if(!db.objectStoreNames.contains('kwcustom'))db.createObjectStore('kwcustom',{keyPath:'id'});
    if(!db.objectStoreNames.contains('marks'))db.createObjectStore('marks',{keyPath:'id'});
    if(!db.objectStoreNames.contains('sagas'))db.createObjectStore('sagas',{keyPath:'id'});};
    /* VER 4 art records hold a Blob; old dataUrl rows are migrated at boot (artHydrate), as an upgrade transaction cannot await the conversion. */
  /* An older tab holding the store open blocks this one and nothing loads, so say why; closing that tab lets this one carry on. */
  rq.onblocked=function(){
    edStoreNotice('blocked','Another tab of this app is open with an older copy, and it is '
      +'holding the saved cards. Close that tab (or reload it) - this one carries on by itself '
      +'as soon as it is closed. Until then nothing here can be loaded or saved.');
  };
  rq.onsuccess=function(e){_db=e.target.result;
    edStoreNotice('blocked',null);
    /* a newer copy in another tab asks this one to step aside: closing lets it load, and this tab stores nothing more until reloaded */
    _db.onversionchange=function(){
      try{ _db.close(); }catch(_){}
      _db=null;
      edStoreNotice('closed','A newer copy of this app was opened in another tab, so this tab has '
        +'let go of the saved cards. Reload this tab before editing anything here - a change made '
        +'now would not be stored.');
    };
    res(_db);};
  rq.onerror=function(e){rej(e.target.error);};});}
/* Built with textContent, so nothing in a message is read as markup. */
function edStoreNotice(kind,msg){
  var id='edStoreNote-'+kind, el=document.getElementById(id);
  if(!msg){ if(el)el.remove(); return; }
  if(!document.body){ setTimeout(function(){ edStoreNotice(kind,msg); },50); return; }
  if(!el){
    el=document.createElement('div'); el.id=id; el.className='ed-store-note';
    el.setAttribute('role','alert');
    var t=document.createElement('span'); t.className='ed-store-note-msg'; el.appendChild(t);
    var x=document.createElement('button'); x.type='button'; x.className='ed2-btn nb nb-red nb-s close-x';
    x.textContent='Close ✕'; x.setAttribute('aria-label','Close this notice');
    x.addEventListener('click',function(){ el.remove(); });
    el.appendChild(x);
    var host=document.getElementById('edStoreNotes');
    if(!host){ host=document.createElement('div'); host.id='edStoreNotes'; host.className='ed-store-notes';
      document.body.appendChild(host); }
    host.appendChild(el);
  }
  el.querySelector('.ed-store-note-msg').textContent=msg;
}
window.edStoreNotice=edStoreNotice;
function tx(s,m){
  /* a connection handed to a newer tab is gone: say so, not "cannot read property of null" */
  if(!_db)throw new Error('the saved cards are not open in this tab - reload it');
  return _db.transaction(s,m).objectStore(s);}
/* Done when the transaction commits, not when the request succeeds: a full disk refuses at commit, after the request said yes. */
function txWrite(s,fn,val){return new Promise(function(res,rej){
  var t=_db?_db.transaction(s,'readwrite'):null;
  if(!t)throw new Error('the saved cards are not open in this tab - reload it');
  fn(t.objectStore(s));
  t.oncomplete=function(){res(val)};
  t.onabort=function(){rej(t.error||new Error('the write was not stored'))};
});}
function put(s,v){return txWrite(s,function(st){st.put(v);},v);}
function del(s,k){return txWrite(s,function(st){st.delete(k);});}
function writeWhy(err){
  if(!err)return 'unknown error';
  return (err.name&&err.name!=='Error')?String(err.name):String(err.message||err.name||'unknown error');
}
function getAll(s){return new Promise(function(res,rej){var r=tx(s,'readonly').getAll();r.onsuccess=function(){res(r.result||[])};r.onerror=function(e){rej(e.target.error)};});}
function getMeta(k){return new Promise(function(res){try{var r=tx('meta','readonly').get(k);r.onsuccess=function(){res(r.result?r.result.v:null)};r.onerror=function(){res(null)};}catch(_){res(null);}});}
function setMeta(k,v){return put('meta',{k:k,v:v});}
/* A try/catch around setMeta catches only tx()'s throw, never the rejection: this handles both, and with `what` it says so at the time. */
function setMetaSafe(k,v,what){
  var p;
  try{ p=setMeta(k,v); }
  catch(err){ if(what)_metaFailed(what,err); return Promise.resolve(false); }
  return p.then(function(){return true;},
                function(err){ if(what)_metaFailed(what,err); return false; });
}
function _metaFailed(what,err){
  var msg=(err&&err.message)||String(err||'unknown error');
  try{ toast('Could not save '+what+' — '+msg); }catch(_){}
  try{ console.warn('setMeta failed for '+what+':',err); }catch(_){}
}
window.edSetMetaSafe=setMetaSafe;

/* Art is kept as Blobs shown through object URLs, never as data: URL strings, so the bytes stay off the JS heap. */
function dataUrlToBlob(d){
  try{
    var m=/^data:([^;]+);base64,(.*)$/.exec(d); if(!m)return null;
    var bin=atob(m[2]), len=bin.length, buf=new Uint8Array(len);
    for(var i=0;i<len;i++)buf[i]=bin.charCodeAt(i);
    return new Blob([buf],{type:m[1]});
  }catch(_){ return null; }
}
/* The rewrite of migrated dataUrl rows is not awaited, so boot is not blocked. */
function artHydrate(rows){
  ART={};
  (rows||[]).forEach(function(r){
    if(r.blob){ try{ ART[r.key]=URL.createObjectURL(r.blob); }catch(_){} return; }
    if(r.dataUrl){
      var b=dataUrlToBlob(r.dataUrl);
      if(b){ try{ ART[r.key]=URL.createObjectURL(b); }catch(_){}
             put('art',{key:r.key,blob:b}); }
      else ART[r.key]=r.dataUrl;
    }
  });
}
function artPut(key,blob){
  try{ ART[key]=URL.createObjectURL(blob); }catch(_){}
  return put('art',{key:key,blob:blob});
}

/* window.CARD_GEN moves on every change to card data: a cache built from window.CARDS keys on it as well as on the count, which a rename keeps.
   _cardGenOf is the same counter per card, so a save that began before the card changed again does not mark it saved. */
window.CARD_GEN=window.CARD_GEN||0;
var _cardGenOf={};
function bumpCardGen(c){
  window.CARD_GEN=(window.CARD_GEN||0)+1;
  if(c&&c.__id)_cardGenOf[c.__id]=(_cardGenOf[c.__id]||0)+1;
}
function cardGenOf(c){ return (c&&c.__id&&_cardGenOf[c.__id])||0; }
window.edBumpCardGen=bumpCardGen;
var ART={};
var SETINFO={title:'Conjure UCG LLC 2026',designer:'Conjure UCG LLC 2026',artist:'Midjourney',saga:''};
var curId=null;
var _origCatalog=null;
/* Escapes ' too: attributes here are single-quoted, and an unescaped ' cut the value short, so opening a card in the editor renamed it (HANDOFF §14.3). */
function e(s){return (s==null?'':String(s)).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');}
/* Never the same id twice in one page: a first open stores about 1,600 cards in one loop, and two ids in one millisecond would share a record. */
var _uidTaken=Object.create(null);
function uid(){
  var id;
  do{ id='c'+Date.now().toString(36)+Math.random().toString(36).slice(2,7); }while(_uidTaken[id]);
  _uidTaken[id]=1;
  return id;
}
/* Escaped for CSS, so the address stays one address; still passed through e() in an attribute, as the two escapes are for different readers. */
function cssUrl(u){
  return 'url("'+String(u==null?'':u).replace(/[\\"'()<>;{}\s]/g,function(ch){
    return '\\'+ch.charCodeAt(0).toString(16)+' ';
  })+'")';
}
function numAttr(v,dflt,lo,hi){
  var n=parseFloat(v); if(!isFinite(n))n=dflt;
  if(lo!=null&&n<lo)n=lo; if(hi!=null&&n>hi)n=hi;
  return n;
}
/* A slot's value lands in src= and in CSS, and a look can arrive from a followed source without a click: only a base64 PNG, JPEG or WebP is taken. */
var TPL_DATA_RE=/^data:image\/(png|jpeg|webp);base64,[A-Za-z0-9+\/=]*$/;
function tplOk(d){ return typeof d==='string'&&TPL_DATA_RE.test(d); }

var SUPER_WORDS=['Quick','Mythic','Background','Ongoing','Action','Spell','Object','Character','Essence','Core','Dual'];
function buildVocab(){
  var sup={},sub={};
  SUPER_WORDS.forEach(function(w){sup[w]=1;});
  /* Rebirth shares the main game's types and adds to them; suggestions only, as the browse filters must come from the cards on screen. */
  var pools=[window.CARDS||[]];
  if(window.REBIRTH && window.BASE_CARDS) pools.push(window.BASE_CARDS);
  pools.forEach(function(list){ list.forEach(function(c){
    (c.superTypes||[]).forEach(function(s){if(s)sup[s]=1;});
    (c.subTypes||[]).forEach(function(s){if(s)sub[s]=1;});
  }); });
  /* BASE_CARDS is empty, as nothing is baked (HANDOFF §12.1 H), so the shared list comes from #rbseeddata. */
  if(window.REBIRTH && window.RB_SEED && window.RB_SEED.vocab){
    (window.RB_SEED.vocab.sup||[]).forEach(function(s){if(s)sup[s]=1;});
    (window.RB_SEED.vocab.sub||[]).forEach(function(s){if(s)sub[s]=1;});
  }
  var supList=Object.keys(sup).sort(function(a,b){
    var ia=SUPER_WORDS.indexOf(a),ib=SUPER_WORDS.indexOf(b);
    if(ia>=0&&ib>=0)return ia-ib; if(ia>=0)return -1; if(ib>=0)return 1; return a.localeCompare(b);});
  var subList=Object.keys(sub).sort();
  return {sup:supList,sub:subList};
}

var ROY=['red','orange','yellow','green','blue','indigo','violet'];
function colorsFromMana(mc){if(!mc)return[];var map={R:'red',O:'orange',Y:'yellow',G:'green',B:'blue',I:'indigo',V:'violet'};
  var seen={},out=[];mc.toUpperCase().replace(/\s|\//g,'').split('').forEach(function(ch){if(map[ch]&&!seen[map[ch]]){seen[map[ch]]=1;out.push(map[ch]);}});
  out.sort(function(a,b){return ROY.indexOf(a)-ROY.indexOf(b);});return out;}
/* For drawing only: c.colors stays in wheel order, because the update check, the Colour sort and the deck's colour groups compare it by position. */
function colorsInCostOrder(mc){if(!mc)return[];var map={R:'red',O:'orange',Y:'yellow',G:'green',B:'blue',I:'indigo',V:'violet'};
  var seen={},out=[];String(mc).toUpperCase().replace(/\s|\//g,'').split('').forEach(function(ch){if(map[ch]&&!seen[map[ch]]){seen[map[ch]]=1;out.push(map[ch]);}});
  return out;}
var ESSMAP={Ire:'red',Vig:'orange',Lux:'yellow',Arch:'green',Yune:'blue',Psy:'indigo',Gris:'violet'};
function colorsFromEssence(subs){var seen={},out=[];(subs||[]).forEach(function(s){if(ESSMAP[s]&&!seen[ESSMAP[s]]){seen[ESSMAP[s]]=1;out.push(ESSMAP[s]);}});
  out.sort(function(a,b){return ROY.indexOf(a)-ROY.indexOf(b);});return out;}
/* Pure colours go in ROYGBIV order, rotated to keep them closest on the wheel ("RV" to "VR"), generic last.
   A hybrid is never moved or respelled: the sort runs on blur, and the author places hybrids by hand (HANDOFF §54.4). */
var MANA_ORDER='ROYGBIV';
function manaTokens(str){
  var out=[], re=/([ROYGBIV](?:\/[ROYGBIV])+)|([ROYGBIV])|(\d+)|(X)/gi, m;
  while((m=re.exec(String(str||'')))!==null){
    if(m[1])out.push({t:'hy',cs:m[1].toUpperCase().split('/'),raw:m[1].toUpperCase()});
    else if(m[2])out.push({t:'c',a:m[2].toUpperCase(),raw:m[2].toUpperCase()});
    else if(m[3])out.push({t:'g',raw:m[3]});
    else if(m[4])out.push({t:'g',raw:'X'});
  }
  return out;
}
function manaBestStart(idxs){
  if(!idxs.length)return 0;
  var best=null,bestSpan=99;
  idxs.forEach(function(s){
    var span=0;
    idxs.forEach(function(c){ var d=(c-s+7)%7; if(d>span)span=d; });
    // ties break toward the earlier ROYGBIV colour so results are stable
    if(span<bestSpan||(span===bestSpan&&best!==null&&s<best)){ bestSpan=span; best=s; }
  });
  return best===null?0:best;
}
function sortManaCost(str){
  var src=String(str||''), bare=src.replace(/\s+/g,'');
  var toks=manaTokens(bare); if(!toks.length)return src;
  /* anything the tokeniser cannot account for leaves the cost alone, or a half-typed hybrid's "/" would vanish as it is typed */
  if(toks.map(function(t){return t.raw;}).join('')!==bare.toUpperCase())return src;
  var idx=function(ch){ return MANA_ORDER.indexOf(ch); };
  var col=toks.filter(function(t){return t.t!=='g';});
  var gen=toks.filter(function(t){return t.t==='g';});
  var present={};
  col.forEach(function(t){ if(t.t==='c')present[idx(t.a)]=1; });
  var keys=Object.keys(present).map(Number).sort(function(x,y){return x-y;});
  var start=manaBestStart(keys);
  var rot=function(i){ return (i-start+7)%7; };
  var pure=col.filter(function(t){return t.t==='c';})
    .map(function(t,i){ return {t:t,i:i}; })
    .sort(function(x,y){ return (rot(idx(x.t.a))-rot(idx(y.t.a)))||(x.i-y.i); })
    .map(function(x){ return x.t; });
  var k=0;
  return col.map(function(t){ return t.t==='c' ? pure[k++].raw : t.raw; }).join('')
    +gen.map(function(t){return t.raw;}).join('');
}
window.edSortMana=function(el){
  if(!el)return;
  var before=el.value, after=sortManaCost(before);
  if(after!==before){
    // keep the caret at the end: reordering makes any other position meaningless
    el.value=after;
    try{ el.setSelectionRange(after.length,after.length); }catch(_){}
  }
  edLive();
};
/* A hybrid costs one, as the pips and the face show it. L is not a typo: it is Lock (MLTR), a real mana letter outside the seven colours. */
function computeCmc(mc){if(!mc)return'';var s=mc.replace(/\s/g,''),t=0,i=0;
  var LETTERS='ROYGBIVL';
  while(i<s.length){var ch=s[i].toUpperCase();
    if(ch>='0'&&ch<='9'){var n='';while(i<s.length&&s[i]>='0'&&s[i]<='9')n+=s[i++];t+=parseInt(n);continue;}
    if(ch==='X'){i++;continue;}
    if(LETTERS.indexOf(ch)>=0){
      var j=i;
      while(j+2<s.length && s[j+1]==='/' && LETTERS.indexOf(s[j+2].toUpperCase())>=0) j+=2;
      t+=1; i=j+1; continue;
    }
    i++;}
  return String(t);}

/* One answer from three, in order: the card's sub-types as the card lists them, then super-type rows in list order, then the master Default.
   'default' is a reference resolved at read time, so changing the master moves every row that never chose. */
var ALIGN_MATCH={character:['character'],essence:['essence'],object:['object'],action:['action','spell']};
var ALIGN_DEFAULTS=[
  {key:'character',kind:'super',h:'left',  v:'top'},
  {key:'essence',  kind:'super',h:'center',v:'middle'},
  {key:'object',   kind:'super',h:'center',v:'top'},
  {key:'action',   kind:'super',h:'center',v:'middle'}
];
var ALIGN_BASE_DEFAULT={h:'left',v:'top'};
var ALIGN_BASE={h:ALIGN_BASE_DEFAULT.h,v:ALIGN_BASE_DEFAULT.v};
var ALIGN_H=['left','center','right'];
var ALIGN_V=['top','middle','bottom'];
function alignRuleNew(key,kind){
  return {key:String(key||''),kind:(kind==='sub'?'sub':'super'),h:'default',v:'default'};
}
function alignClone(r){
  return {key:r.key,kind:(r.kind==='sub'?'sub':'super'),h:r.h,v:r.v};
}
var ALIGN_RULES=ALIGN_DEFAULTS.map(alignClone);
/* The saved list is the list, not a filter over the built-ins, which would drop every row the user added at the next reload. */
function alignLoad(saved){
  var out=[];
  if(Array.isArray(saved)){
    saved.forEach(function(r){
      if(!r||!r.key)return;
      out.push({key:String(r.key),kind:(r.kind==='sub'?'sub':'super'),
                h:alignVal(r.h,ALIGN_H),v:alignVal(r.v,ALIGN_V)});
    });
  }
  ALIGN_DEFAULTS.forEach(function(d){
    var has=out.filter(function(x){return x.kind==='super'&&x.key===d.key;})[0];
    if(!has)out.push(alignClone(d));
  });
  return out;
}
function alignVal(v,list){
  v=String(v||'').toLowerCase();
  return (v==='default'||list.indexOf(v)>=0)?v:'default';
}
function alignBaseLoad(saved){
  var b={h:ALIGN_BASE_DEFAULT.h,v:ALIGN_BASE_DEFAULT.v};
  if(saved&&typeof saved==='object'){
    if(ALIGN_H.indexOf(saved.h)>=0)b.h=saved.h;
    if(ALIGN_V.indexOf(saved.v)>=0)b.v=saved.v;
  }
  return b;
}
function alignResolve(r){
  if(!r)return {h:ALIGN_BASE.h,v:ALIGN_BASE.v};
  return {h:(r.h==='default'||!r.h)?ALIGN_BASE.h:r.h,
          v:(r.v==='default'||!r.v)?ALIGN_BASE.v:r.v};
}
function alignRuleFor(kind,key){
  key=String(key||'').toLowerCase();
  for(var i=0;i<ALIGN_RULES.length;i++){
    var r=ALIGN_RULES[i];
    if(r.kind!==kind)continue;
    if(String(r.key).toLowerCase()===key)return r;
  }
  return null;
}
function alignFor(card){
  var subs=edList(card&&card.subTypes);
  for(var i=0;i<subs.length;i++){
    var sr=alignRuleFor('sub',subs[i]);
    if(sr)return alignResolve(sr);
  }
  var s=edList(card&&card.superTypes).join(' ').toLowerCase();
  for(var j=0;j<ALIGN_RULES.length;j++){
    var r=ALIGN_RULES[j];
    if(r.kind==='sub')continue;
    var keys=ALIGN_MATCH[r.key]||[String(r.key).toLowerCase()];
    for(var k=0;k<keys.length;k++) if(keys[k]&&s.indexOf(keys[k])>=0) return alignResolve(r);
  }
  return {h:ALIGN_BASE.h,v:ALIGN_BASE.v};
}
function alignPersist(){
  setMetaSafe('alignRules',ALIGN_RULES.map(alignClone));
  setMetaSafe('alignBase',{h:ALIGN_BASE.h,v:ALIGN_BASE.v});
}
function alignRepaint(){
  try{ scheduleFace(); }catch(_){}
  var c=curCard(); if(c)renderPreview(c);
  edTplPanelRefresh();
}
window.edSetAlign=function(key,axis,val,kind){
  var r=alignRuleFor(kind||'super',key); if(!r)return;
  r[axis]=alignVal(val,axis==='h'?ALIGN_H:ALIGN_V);
  alignPersist(); alignRepaint();
};
window.edSetAlignBase=function(axis,val){
  var list=(axis==='h')?ALIGN_H:ALIGN_V;
  if(list.indexOf(val)<0)return;
  ALIGN_BASE[axis]=val;
  alignPersist(); alignRepaint();
};
window.edAddAlignRow=function(kind,key){
  key=String(key||'').trim();
  if(!key)return false;
  if(alignRuleFor(kind,key))return false;
  ALIGN_RULES.push(alignRuleNew(key,kind));
  alignPersist(); alignRepaint();
  return true;
};
window.edDelAlignRow=function(kind,key){
  /* the four built-in super-types are not removable: every card matches one of them */
  if(kind!=='sub'&&ALIGN_DEFAULTS.filter(function(d){return d.key===key;}).length)return false;
  var n=ALIGN_RULES.length;
  ALIGN_RULES=ALIGN_RULES.filter(function(r){
    return !(r.kind===kind&&String(r.key).toLowerCase()===String(key).toLowerCase());
  });
  if(ALIGN_RULES.length===n)return false;
  alignPersist(); alignRepaint();
  return true;
};
window.edResetAlign=function(){
  ALIGN_RULES=ALIGN_DEFAULTS.map(alignClone);
  ALIGN_BASE={h:ALIGN_BASE_DEFAULT.h,v:ALIGN_BASE_DEFAULT.v};
  setMetaSafe('alignRules',null);
  setMetaSafe('alignBase',null);
  alignRepaint();
};
function alignCatalogTypes(which){
  var seen={},out=[];
  (window.CARDS||[]).forEach(function(c){
    var list=(which==='sub')?(c.subTypes||[]):(c.superTypes||[]);
    list.forEach(function(t){
      t=String(t||'').trim(); if(!t)return;
      var k=t.toLowerCase();
      if(seen[k])return; seen[k]=1; out.push(t);
    });
  });
  out.sort(function(a,b){ return a.toLowerCase()<b.toLowerCase()?-1:1; });
  return out;
}
window.edAlignTypes=function(which){ return alignCatalogTypes(which); };

/* Super-types get a row each, starting on Default; sub-types do not, as most follow the super-type and a row each would be noise. */
function alignSeedFromCatalog(){
  var added=0;
  alignCatalogTypes('super').forEach(function(t){
    if(alignRuleFor('super',t))return;
    ALIGN_RULES.push(alignRuleNew(t,'super'));
    added++;
  });
  if(added) alignPersist();
  return added;
}
/* read-only views, for the checks */
window.edAlignRules=function(){ return ALIGN_RULES.map(alignClone); };
window.edAlignBase=function(){ return {h:ALIGN_BASE.h,v:ALIGN_BASE.v}; };
window.edAlignFor=function(card){ return alignFor(card||{}); };
window.edAlignLoadFor=function(rules,base){
  return {rules:alignLoad(rules), base:alignBaseLoad(base)};
};
/* a row from the catalogue cannot be removed: it would simply come back */
function alignFromCatalog(kind,key){
  if(kind==='sub')return false;
  key=String(key||'').toLowerCase();
  return alignCatalogTypes('super').some(function(t){
    return String(t).toLowerCase()===key;
  });
}

var HEXNAME={red:'Red',orange:'Orange',yellow:'Yellow',green:'Green',blue:'Blue',indigo:'Indigo',violet:'Violet'};
var GREY_HEX='#4a4a4a';
function fillHex(c){ if(c==='grey')return GREY_HEX; try{return (window.COLOR_FILL_HEX||{})[HEXNAME[c]]||'#888';}catch(_){return '#888';}}
var FRAME_ORDER=['grey','red','orange','yellow','green','blue','indigo','violet'];
/* A card's list may be text or missing: always an array, never throwing, as one card with colours "Red, Blue" had no face at all. */
function edList(v){
  if(Array.isArray(v))return v;
  if(typeof v==='string')return v.split(/\s*,\s*|\s+/).filter(Boolean);
  return [];
}
/* The colours a card is drawn in, not always those it is: an override changes only the frame, pinlines and outline, and c.colors stays the truth.
   Everything that draws the frame asks this (buildFaceHTML, tplFrameFor), or the override would miss a part of the card. */
function frameColorsOf(c){
  /* variantOf, not visualTarget: reading is what variantOf is for, and only it falls back to the card. */
  var vt=(c&&typeof variantOf==='function')?variantOf(c):c;
  var ov=vt&&vt.frameColor;
  if(Array.isArray(ov)&&ov.length){
    /* the override set, in wheel order (frameOvrSetOf): the painters do not sort */
    var keep=frameOvrSetOf(c);
    if(keep.length)return keep;
  }
  /* In the order the cost is written, not wheel order: Object grey first, then the cost's colours, then any others (an Essence's) in wheel order. */
  var cols=edList(c&&c.colors).map(function(x){return String(x).toLowerCase();})
    .filter(function(x){return FRAME_ORDER.indexOf(x)>=0;});
  if(cols.length<2)return cols;
  var out=[], has={};
  cols.forEach(function(x){ has[x]=1; });
  if(has.grey){ out.push('grey'); has.grey=0; }
  colorsInCostOrder(c&&c.manaCost).forEach(function(x){ if(has[x]){ out.push(x); has[x]=0; } });
  FRAME_ORDER.forEach(function(x){ if(has[x]){ out.push(x); has[x]=0; } });
  return out;
}
/* A set of any size, sorted so the gradient runs the same way whatever order it was pressed in, and de-duplicated so no colour gives a flat band. */
function frameOvrSetOf(c){
  /* variantOf, not visualTarget: the picker shows what the frame draws */
  var vt=(c&&typeof variantOf==='function')?variantOf(c):c;
  var ov=vt&&vt.frameColor;
  if(!Array.isArray(ov))return [];
  var seen={},out=[];
  ov.forEach(function(x){
    if(FRAME_ORDER.indexOf(x)<0||seen[x])return;
    seen[x]=1; out.push(x);
  });
  return out.sort(function(a,b){return FRAME_ORDER.indexOf(a)-FRAME_ORDER.indexOf(b);});
}
window.edFrameColors=function(c){ return frameColorsOf(c); };
window.edFrameOvrSet=function(c){ return frameOvrSetOf(c); };
function shadeRGB(hex,a){var n=parseInt(hex.slice(1),16),f=function(v){return Math.max(0,Math.min(255,v+a));};
  return 'rgb('+f(n>>16)+','+f((n>>8)&255)+','+f(n&255)+')';}
/* Read from the catalog's COLOR_OUTLINE_HEX, not copied, so the two cannot drift; grey has no entry and takes a near-black. */
function outlineHex(c){
  if(c==='grey')return '#141418';
  try{ return (window.COLOR_OUTLINE_HEX||{})[HEXNAME[c]]||'#141418'; }catch(_){ return '#141418'; }
}
/* No painter sorts: frameColorsOf decides the order once. box-shadow takes no gradient, so for several colours the first one wins here. */
function outlineSolid(colors){
  var cols=(colors||[]).slice().filter(function(c){return FRAME_ORDER.indexOf(c)>=0;});
  return cols.length?outlineHex(cols[0]):'#141418';
}
function frameDarkOf(colors){
  var A='var(--holo-ang,120deg)';
  var cols=(colors||[]).slice().filter(function(c){return FRAME_ORDER.indexOf(c)>=0;});
  if(!cols.length) return 'linear-gradient('+A+',#17171b 0%,#232329 46%,#141418 100%)';
  if(cols.length===1){
    var h=outlineHex(cols[0]);
    // no white band: this is the background, and the highlight belongs to the border alone
    return 'linear-gradient('+A+','+h+' 0%,'+shadeRGB(h,26)+' 46%,'+shadeRGB(h,-4)+' 100%)';
  }
  var n=cols.length, stops=[];
  cols.forEach(function(x,i){ stops.push(outlineHex(x)+' '+Math.round(i*(100/(n-1)))+'%'); });
  return 'linear-gradient('+A+','+stops.join(',')+')';
}
function frameOf(colors){
  // one shared angle, so every gradient on the card rotates with the outer border
  // HL must be opaque: border-image composites over the element's own background, so a translucent highlight takes on the theme
  var A='var(--holo-ang,120deg)', HL='#ffffff';
  /* The highlight is made 25% smaller by narrowing the band, never by dimming HL, which must stay pure white. */
  function narrow(shoulder,centre){ return +(centre+(shoulder-centre)*0.75).toFixed(2); }
  function hl(pos,hw){
    hw=hw||4.5; var q=+(hw*0.444).toFixed(2);
    return '#ffe1ef '+(pos-hw)+'%,#fff7d8 '+(pos-q)+'%,'+HL+' '+pos+'%,'
         + '#d8fff1 '+(pos+q)+'%,#dde7ff '+(pos+hw)+'%';
  }
  var cols=(colors||[]).slice().filter(function(c){return FRAME_ORDER.indexOf(c)>=0;});
  if(!cols.length){
    return 'linear-gradient('+A+',#9a938a 0%,#c5bfb4 '+narrow(30,46)+'%,'+hl(46)+',#7d766c '+narrow(62,46)+'%,#9a938a 100%)';
  }
  if(cols.length===1){
    var h=fillHex(cols[0]);
    if(cols[0]==='grey'){
      return 'linear-gradient('+A+',#4a4a4a 0%,#6e6e6e '+narrow(26,46)+'%,'+hl(46)+',#3a3a3a '+narrow(62,46)+'%,#4a4a4a 100%)';
    }
    return 'linear-gradient('+A+','+h+' 0%,'+shadeRGB(h,30)+' '+narrow(26,46)+'%,'+hl(46)+','+shadeRGB(h,-42)+' '+narrow(62,46)+'%,'+h+' 100%)';
  }
  /* The band goes into the gap that holds it, by position, never by index: a stop below its predecessor is clamped by CSS into a hard edge. */
  var n=cols.length;
  var base=cols.map(function(x,i){ return {c:fillHex(x),p:Math.round(i*(100/(n-1)))}; });
  var HW=4.5, centre=46;
  for(var gi=0;gi<base.length-1;gi++){
    if(base[gi].p<=centre&&centre<=base[gi+1].p){
      var lo=base[gi].p+1+HW, hi=base[gi+1].p-1-HW;
      if(hi<lo){
        centre=(base[gi].p+base[gi+1].p)/2;
        HW=Math.max(1,(base[gi+1].p-base[gi].p)/2-1);
      } else centre=Math.min(Math.max(centre,lo),hi);
      break;
    }
  }
  var out=[];
  base.forEach(function(st,i){
    if(i>0&&base[i-1].p<centre&&st.p>=centre)out.push(hl(centre,HW));
    out.push(st.c+' '+st.p+'%');
  });
  if(out.indexOf(hl(centre,HW))<0)out.splice(Math.max(1,out.length-1),0,hl(centre,HW));
  return 'linear-gradient('+A+', '+out.join(', ')+')';
}
function svar(k,fb){try{var v=getComputedStyle(document.documentElement).getPropertyValue('--s-'+k).trim();return v||fb;}catch(_){return fb;}}
var ORB_FILL={atk:'#c45c5c',hp:'#c9a84c',arc:'#2980b9',rng:'#5c9e6e'};
/* every orb kind needs an entry here, or its numeral draws with no outline */
var ORB_OUTLINE={atk:'#781113',hp:'#7d4b1e',arc:'#0d5b7e',rng:'#1c5c33'};
/* for the board, whose stat buttons read these rather than copying the hexes, so the two cannot drift */
window.edOrbFill=ORB_FILL; window.edOrbOutline=ORB_OUTLINE;
/* Mirrors the card's default --holo-ang (120deg): gradientTransform cannot read a CSS custom property, so the holo handlers turn data-rot gradients themselves. */
var ORB_ANG='rotate(120 .5 .5)';
function orbGradDefs(uid,fills){
  /* each orb turns about its own centre, and orbs are never iridescent, so the rainbow reads only on the frame */
  var g='<linearGradient id="'+uid+'iron" data-rot="1" gradientTransform="'+ORB_ANG+'">'
    +'<stop offset="0%" stop-color="#33363b"/><stop offset="30%" stop-color="#6f757e"/>'
    +'<stop offset="46%" stop-color="#e8ebf0"/>'
    +'<stop offset="62%" stop-color="#44484f"/>'
    +'<stop offset="100%" stop-color="#2e3136"/></linearGradient>';
  Object.keys(fills).forEach(function(k){
    var h=fills[k];
    /* A pair is two hues on one orb, for the board's doubled-Life hexagon only; a plain hex draws exactly as before. */
    var a=h, b=h;
    if(Array.isArray(h)){ a=h[0]||h[1]; b=h[1]||h[0]; }
    g+='<linearGradient id="'+uid+'f'+k+'" data-rot="1" gradientTransform="'+ORB_ANG+'">'
      +'<stop offset="0%" stop-color="'+a+'"/>'
      +'<stop offset="30%" stop-color="'+shadeRGB(a,34)+'"/>'
      +'<stop offset="48%" stop-color="'+shadeRGB(a===b?a:b,70)+'"/>'
      +'<stop offset="66%" stop-color="'+shadeRGB(b,-36)+'"/>'
      +'<stop offset="100%" stop-color="'+b+'"/></linearGradient>';
  });
  return g;
}
function orbStroke(d,uid,clip){
  clip=clip?' clip-path="url(#'+clip+')"':'';
  return '<path d="'+d+'" fill="none" stroke="#e4e7ec" stroke-width="3.6" stroke-linejoin="round"'+clip+'/>'
       + '<path d="'+d+'" fill="none" stroke="url(#'+uid+'iron)" stroke-width="2.1" stroke-linejoin="round"'+clip+'/>';
}
function _orbShapePath(kind){
  // paths in a 0..38 box
  if(kind==='atk')return 'M19,2 L36,19 L19,36 L2,19 Z';
  // the hexagon spans 2..36 like the circle, or a fused health+arcane orb's border steps at the seam
  if(kind==='hp') return 'M19,2 L36,10.5 L36,27.5 L19,36 L2,27.5 L2,10.5 Z';
  if(kind==='arc')return 'M19,2 A17,17 0 1,1 18.99,2 Z';
  if(kind==='rng')return 'M19,2 L36,33 L2,33 Z';
  return '';
}
function orbShapeByType(type,value,opts){
  // an uploaded icon replaces the SVG, and the value is still drawn on top, so numbers stay live
  var custom=tplGet('orb:'+type);
  if(custom && type!=='blank' && type!=='hidden'){
    return "<div class='m-orb-img'><img src='"+e(custom)+"' alt=''>"
      +"<span>"+e(String(value))+"</span></div>";
  }
  var atk=svar('atk',ORB_FILL.atk),hp=svar('hp',ORB_FILL.hp),arc=svar('arc',svar('mp',ORB_FILL.arc)),
      rng=svar('rng',ORB_FILL.rng);
  var over=(opts&&opts.fill)||null;
  if(over){ atk=over; hp=over; arc=over; rng=over; }
  /* the numeral's outline comes with the fill, or an overridden orb keeps a brown number on a green-blue body */
  var overInk=(opts&&opts.ink)||null;
  if(type==='blank'||type==='hidden'||!type)return '';
  var W=38,H=38;
  var uid='o'+Math.random().toString(36).slice(2,8);
  var isStar=(String(value).trim()==='*');
  var len=String(value).length,fs=(isStar?26*0.75:(len>2?11:len>1?13:15))*1.5625;
  var numStroke=2.75;
  // an asterisk sits high in the em-box, so it is drawn lower (26); 19 is the centre of the 0..38 box
  var textY=isStar?26:19;
  var body='',numOutline='',numFill='#fff';
  var fused=(type==='attack and arcane'||type==='health and arcane');

  if(!fused){
    var kind=type==='attack'?'atk':type==='health'?'hp':type==='range'?'rng':'arc';
    var fh=({atk:atk,hp:hp,arc:arc,rng:rng})[kind], dpath=_orbShapePath(kind);
    body='<defs>'+orbGradDefs(uid,{k:fh})+'</defs>'
      +'<path d="'+dpath+'" fill="url(#'+uid+'fk)"/>'
      +orbStroke(dpath,uid);
    numOutline=overInk||ORB_OUTLINE[kind];
  } else {
    var baseKind=type==='attack and arcane'?'atk':'hp';
    var baseFill=baseKind==='atk'?atk:hp;
    /* The halves blend through soft masks across y=15..23, not a clip and a seam; the clip paths serve only the outline strokes. */
    body=''
      +'<defs>'
        +'<clipPath id="'+uid+'top"><rect x="0" y="0" width="38" height="19"/></clipPath>'
        +'<clipPath id="'+uid+'bot"><rect x="0" y="19" width="38" height="19"/></clipPath>'
        +'<linearGradient id="'+uid+'fade" x1="0" y1="0" x2="0" y2="1">'
          +'<stop offset="0%" stop-color="#fff"/><stop offset="39%" stop-color="#fff"/>'
          +'<stop offset="61%" stop-color="#000"/><stop offset="100%" stop-color="#000"/>'
        +'</linearGradient>'
        +'<mask id="'+uid+'blend"><rect x="0" y="0" width="38" height="38" fill="url(#'+uid+'fade)"/></mask>'
        /* the circle fades in across the same band, or its top half shows around the narrower diamond as a blue crescent */
        +'<linearGradient id="'+uid+'fadeInv" x1="0" y1="0" x2="0" y2="1">'
          +'<stop offset="0%" stop-color="#000"/><stop offset="39%" stop-color="#000"/>'
          +'<stop offset="61%" stop-color="#fff"/><stop offset="100%" stop-color="#fff"/>'
        +'</linearGradient>'
        +'<mask id="'+uid+'blendInv"><rect x="0" y="0" width="38" height="38" fill="url(#'+uid+'fadeInv)"/></mask>'
        +'<linearGradient id="'+uid+'grad" x1="0" y1="0" x2="0" y2="1">'
          +'<stop offset="0%" stop-color="'+ORB_OUTLINE[baseKind]+'"/>'
          +'<stop offset="30%" stop-color="'+ORB_OUTLINE[baseKind]+'"/>'
          +'<stop offset="70%" stop-color="'+ORB_OUTLINE.arc+'"/>'
          +'<stop offset="100%" stop-color="'+ORB_OUTLINE.arc+'"/>'
        +'</linearGradient>'
        +orbGradDefs(uid,{b:baseFill,a:arc})
      +'</defs>'
      +'<path d="'+_orbShapePath('arc')+'" fill="url(#'+uid+'fa)" mask="url(#'+uid+'blendInv)"/>'
      +'<path d="'+_orbShapePath(baseKind)+'" fill="url(#'+uid+'fb)" mask="url(#'+uid+'blend)"/>'
      +orbStroke(_orbShapePath(baseKind),uid,uid+'top')
      +orbStroke(_orbShapePath('arc'),uid,uid+'bot')
      ;
    numOutline='url(#'+uid+'grad)';
  }
  return '<svg width="'+W+'" height="'+H+'" viewBox="0 0 '+W+' '+H+'" style="filter:drop-shadow(calc(var(--ico-sx,.91px)*1.2) calc(var(--ico-sy,1.82px)*1.2) calc(var(--ico-blur,3.03px)*1.5) rgba(0,0,0,.75))">'
    +body
    +'<text x="19" y="'+textY+'" text-anchor="middle" dominant-baseline="'+(isStar?'middle':'central')+'" '
    +'font-family="\'Book Antiqua\',Georgia,serif" font-weight="700" '
    +'font-size="'+fs+'" fill="'+numFill+'" style="paint-order:stroke;stroke:'+numOutline+';stroke-width:'+numStroke+'px;stroke-linejoin:round">'+e(String(value))+'</text>'
    +'</svg>';
}
function cardOrbs(c){
  if(Array.isArray(c.orbs)){
    return c.orbs.filter(function(o){ return o && o.type && o.type!=='blank' && o.type!=='hidden' && o.value!=='' && o.value!=null; });
  }
  /* A fused orb is a suffix on the arcane value ("4A" attack+arcane, "1H" health+arcane), unpacked here; the stored data is untouched. */
  var out=[];
  var arc=String(c.arcane==null?'':c.arcane);
  var fused=/^\s*(.+?)\s*([AH])\s*$/i.exec(arc);
  var fuseKind=fused?fused[2].toUpperCase():'';
  var fuseVal=fused?fused[1]:'';
  if(c.attack!==''&&c.attack!=null)
    out.push(fuseKind==='A'?{type:'attack and arcane',value:fuseVal}:{type:'attack',value:c.attack});
  if(c.health!==''&&c.health!=null)
    out.push(fuseKind==='H'?{type:'health and arcane',value:fuseVal}:{type:'health',value:c.health});
  if(!fuseKind && arc!=='')out.push({type:'arcane',value:arc});
  return out;
}
/* for the catalog's popout, so it shows the same stat icons as the face */
window.edCardOrbs=function(c){ return cardOrbs(c).map(function(o){return {type:o.type,value:o.value};}); };
window.edOrbSvg=function(type,value,size,opts){
  var sz=size||40;
  return "<svg viewBox='0 0 38 38' width='"+sz+"' height='"+sz+"' style='display:block;overflow:visible'>"
    +orbShapeByType(type,value==null?'':value,opts)+"</svg>";
};
window.edOrbLabel=function(type){ return ORB_TYPE_LABEL[type]||type; };
/* Rebuilt through orbShapeByType, not patched in the DOM; only the stats cardOrbs gives are shifted, and a value such as * is left alone. */
window.edOrbsHTMLShifted=function(c,delta){
  var list=cardOrbs(c)||[];
  var d=Number(delta)||0;
  return list.map(function(o){
    var raw=String(o.value==null?'':o.value).trim();
    var n=(raw!==''&&/^-?\d+$/.test(raw))?parseInt(raw,10):null;
    if(d===0||n===null)
      return "<div class='m-orb-slot'>"+faceOrbHTML(o.type,o.value)+"</div>";
    var badge="<span class='m-orb-delta"+(d<0?' neg':'')+"'>"
      +(d>0?'+':'−')+Math.abs(d)+"</span>";
    return "<div class='m-orb-slot m-orb-mod'>"
      +faceOrbHTML(o.type,String(n+d))+badge+"</div>";
  }).join('');
};
/* A Rebirth card's Health as a number, from the stats cardOrbs gives (Health, or Health and Arcane); null for a card with none. */
function orbHealth(c){
  var list=cardOrbs(c||{})||[];
  for(var i=0;i<list.length;i++){
    var o=list[i];
    if(o.type!=='health'&&o.type!=='health and arcane') continue;
    var raw=String(o.value==null?'':o.value).trim();
    return /^-?\d+$/.test(raw)?parseInt(raw,10):null;
  }
  return null;
}
window.edCardHealth=function(c){ return orbHealth(c); };
/* The face's stats with the damage taken off the Health, rebuilt as edOrbsHTMLShifted does; the lowered one is marked (m-orb-hurt). */
window.edOrbsHTMLHurt=function(c,dmg){
  var d=Math.max(0,Math.floor(Number(dmg)||0));
  return (cardOrbs(c)||[]).map(function(o){
    var raw=String(o.value==null?'':o.value).trim();
    var n=/^-?\d+$/.test(raw)?parseInt(raw,10):null;
    if(!d||n===null||(o.type!=='health'&&o.type!=='health and arcane'))
      return "<div class='m-orb-slot'>"+faceOrbHTML(o.type,o.value)+"</div>";
    return "<div class='m-orb-slot m-orb-hurt'>"+faceOrbHTML(o.type,String(Math.max(0,n-d)))+"</div>";
  }).join('');
};
function orbs(c){ return cardOrbs(c).map(function(o){ return orbShapeByType(o.type,o.value); }).join(''); }
function symToken(tok,size){
  var c=tplGet('sym:'+tok), px=numAttr(size,16,1,400);
  if(c)return "<img class='m-sym' src='"+e(c)+"' alt='{"+e(tok)+"}' style='width:"+px+"px;height:"+px+"px'>";
  if(typeof window.renderManaCost==='function'){try{return window.renderManaCost(tok,size)||'';}catch(_){return '';}}
  return '';
}
function tplGet(k){ var d=TPL[k]; return tplOk(d)?d:''; }
/* An uploaded symbol is used wherever one is printed, the cost and Essence circles too; with none uploaded this is renderManaCost exactly. */
var MANA_LETTER={red:'R',orange:'O',yellow:'Y',green:'G',blue:'B',indigo:'I',violet:'V'};
function symAny(){
  for(var k in TPL){ if(k.indexOf('sym:')===0&&tplOk(TPL[k]))return true; }
  return false;
}
function manaCostHTML(mc,sz){
  var R=(typeof window.renderManaCost==='function')?window.renderManaCost:null;
  if(!mc)return '';
  if(!symAny()){ try{ return R?(R(mc,sz)||''):''; }catch(_){ return ''; } }
  var s=String(mc).replace(/\s/g,''), out='', i=0, px=numAttr(sz,17,1,400);
  var one=function(tok){
    var u=tplGet('sym:'+tok)||tplGet('sym:'+tok.toUpperCase());
    if(u)return "<img class='mico m-sym' src='"+e(u)+"' alt='"+e(tok)+"' title='"+e(tok)
      +"' style='width:"+px+"px;height:"+px+"px'>";
    var h=''; try{ h=R?String(R(tok,sz)||''):''; }catch(_){ h=''; }
    return h.replace(/^<span class="mana-s">/,'').replace(/<\/span>$/,'');
  };
  while(i<s.length){
    var rest=s.slice(i);
    var m=/^[A-Za-z](?:\/[A-Za-z])+/.exec(rest)||/^(?:1\d|20)/.exec(rest);
    var tok=m?m[0]:rest.charAt(0);
    out+=one(tok); i+=tok.length;
  }
  return "<span class='mana-s'>"+out+"</span>";
}
window.edManaCostHTML=manaCostHTML;
/* Custom entries merge over the built-in list by name and mode (edApplyCustomEntries); KW_MATCHES stays longest first, which the catalog's linker relies on. */
var KW_BAKED=null, KWCUSTOM=[];
/* Rebirth's Damage Types and Classes, built in rather than stored, so a keywords.json or a look replacing KW_BAKED cannot take them away.
   Columns: kind, name, abbreviation, classes, font (also the outline), fill. */
var RB_DAMAGE=[
  ['class','Physical','PHYS',[],'#d9d9d9','#434343'],
  ['class','Elemental','ELEM',[],'#6ebace','#d2f4eb'],
  ['class','Mystic','MYST',[],'#ce6aaf','#efcce4'],
  ['type','Slash','SL',['Physical'],'#ea9999','#434343'],
  ['type','Pierce','PI',['Physical'],'#ffe599','#434343'],
  ['type','Blunt','BL',['Physical'],'#a4c2f4','#434343'],
  ['type','Fire','FI',['Elemental'],'#cc0000','#f4a049'],
  ['type','Ice','IC',['Elemental'],'#1155cc','#cfe2f3'],
  ['type','Lightning','LI',['Elemental'],'#bf9000','#ffe599'],
  ['type','Wind','WI',['Elemental'],'#738fa9','#cfe2f3'],
  ['type','Earth','EA',['Elemental'],'#968143','#eddcaa'],
  ['type','Water','WA',['Elemental'],'#c9daf8','#3c78d8'],
  ['type','Magic','MA',['Mystic'],'#351c75','#8e7cc3'],
  ['type','Psychic','PS',['Mystic'],'#741b47','#d5a6bd'],
  ['type','Necrotic','NE',['Mystic'],'#b6d7a8','#104118'],
  ['type','Holy','HO',['Mystic'],'#ffffff','#ffd966'],
  ['type','Demonic','DE',['Mystic'],'#cc0000','#280b0b'],
  ['type','Gravity','GR',['Physical','Elemental','Mystic'],'#d596ef','#802a79']
];
var RB_DAMAGE_STYLE={};
RB_DAMAGE.forEach(function(d){ RB_DAMAGE_STYLE[d[1]]={t:d[4],o:d[4],f:d[5]}; });
function rbDamageBuiltins(){
  if(!window.REBIRTH)return [];
  return RB_DAMAGE.reduce(function(a,d){
    var base={name:d[1],mode:'damage',match:d[1],matchAlt:d[2],param:'number',reminder:'',
              dmgKind:d[0],dmgClass:d[3].slice(),__dmgBuiltin:true};
    return a.concat([base,Object.assign({},base,{match:d[2],__alias:true})]);
  },[]);
}
function kwCustomAll(){return new Promise(function(res){try{var r=tx('kwcustom','readonly').getAll();
  r.onsuccess=function(){res(r.result||[])};r.onerror=function(){res([])};}catch(_){res([]);}});}
function kwCustomToEntry(c){
  var o={name:c.name, mode:c.mode||'keyword', match:(c.match||c.name),
          reminder:c.reminder||'', reminderBare:c.reminderBare||'',
          param:c.param||'none', __custom:true, __id:c.id};
  if(o.mode==='damage'){
    o.dmgKind=(c.dmgKind==='class')?'class':'type';
    o.dmgClass=(o.dmgKind==='type')?(c.dmgClass||[]).slice():[];
    o.matchAlt=c.matchAlt||''; o.param='number';
    if(c.replaces)o.replaces=c.replaces;
  }
  return o;
}
/* Each alias is its own KW_DATA entry with the original's name, flagged __alias so listings and the styling panel show no duplicates. */
function kwAliasList(c){
  return String(c.matchAlt||'').split(/[\n,]/)
    .map(function(s){return s.trim();}).filter(Boolean);
}
function kwCustomEntries(c){
  var base=kwCustomToEntry(c);
  return [base].concat(kwAliasList(c).map(function(m){
    return Object.assign({},base,{match:m,__alias:true});
  }));
}
function edApplyCustomEntries(){
  if(!KW_BAKED)KW_BAKED=(window.KW_DATA||[]).slice();
  var over={}; KWCUSTOM.forEach(function(c){
    over[(c.mode||'keyword')+'\u0000'+c.name]=1;
    if(c.replaces)over[(c.mode||'keyword')+'\u0000'+c.replaces]=1;
  });
  /* a published keywords.json carries them too: the code's copy is the one kept, so none is listed twice */
  var dmg=rbDamageBuiltins(), dmgName={};
  dmg.forEach(function(d){ dmgName[d.name]=1; });
  /* entries a followed source or a table copy brought (KW_EXTRA), only where nothing here defines them */
  var bakedHas={}; KW_BAKED.forEach(function(b){ if(b&&b.name)bakedHas[(b.mode||'keyword')+'\u0000'+b.name]=1; });
  var extra=((typeof KW_EXTRA!=='undefined'&&KW_EXTRA)||[]).filter(function(k){
    var key=(k&&k.name)?((k.mode||'keyword')+'\u0000'+k.name):'';
    return key&&!bakedHas[key]&&!over[key]; });
  var merged=KW_BAKED.filter(function(b){ return !over[(b.mode||'keyword')+'\u0000'+b.name]
                                             && !((b.mode==='damage')&&dmgName[b.name]); })
                     .concat(extra)
                     .concat(dmg.filter(function(d){ return !over['damage\u0000'+d.name]; }))
                     .concat(KWCUSTOM.reduce(function(a,c){return a.concat(kwCustomEntries(c));},[]));
  window.KW_DATA=merged;
  window.KW_MATCHES=merged.slice().sort(function(a,b){
    var d=String(b.match||b.name).length-String(a.match||a.name).length;
    if(d)return d;
    /* on a tie your own entry wins, or a built-in of another mode with the same word (Grind) would keep your keyword from its pill */
    return (b.__custom?1:0)-(a.__custom?1:0); });
}
window.edKwCustomSave=function(rec){
  rec.id=rec.id||('kwc_'+uid());
  var i=KWCUSTOM.findIndex(function(x){return x.id===rec.id;});
  if(i>=0)KWCUSTOM[i]=rec; else KWCUSTOM.push(rec);
  return put('kwcustom',rec).then(function(){
    edApplyCustomEntries();
    try{ scheduleFace(); }catch(_){}
    var c=curCard(); if(c)renderPreview(c);
    try{ if(typeof window.edRenderKwPage==='function'&&document.getElementById('kwPageBody'))window.edRenderKwPage(); }catch(_){}
  });
};
/* A built-in renamed here records `replaces`, or it would come back beside its new name. */
/* In the sheet's order: an edited built-in is a custom record and would otherwise move to the end of its class. */
function dmgEntries(){
  var at={}; RB_DAMAGE.forEach(function(d,i){ at[d[1]]=i; });
  return (window.KW_DATA||[]).filter(function(k){ return k.mode==='damage'&&!k.__alias; })
    .map(function(k,i){
      var b=(k.name in at)?at[k.name]:(k.replaces in at)?at[k.replaces]:null;
      return {k:k,o:(b==null?1000+i:b)};
    }).sort(function(a,b){ return a.o-b.o; }).map(function(x){ return x.k; });
}
window.edDmgEntries=dmgEntries;
window.edDmgClasses=function(){
  return dmgEntries().filter(function(k){ return k.dmgKind==='class'; });
};
window.edDmgMembers=function(cls){
  return dmgEntries().filter(function(k){ return k.dmgKind!=='class'&&(k.dmgClass||[]).indexOf(cls)>=0; });
};
window.edDmgSave=function(rec,was){
  var prev=was?KWCUSTOM.filter(function(c){ return c.mode==='damage'&&c.name===was; })[0]:null;
  var kind=(rec.dmgKind==='class')?'class':'type';
  var full={id:rec.id||(prev&&prev.id),name:rec.name,mode:'damage',match:rec.name,
            matchAlt:rec.matchAlt||'',param:'number',reminder:'',reminderBare:'',
            dmgKind:kind,dmgClass:(kind==='type')?(rec.dmgClass||[]).slice():[]};
  var rep=rec.replaces||(prev&&prev.replaces);
  if(!rep&&was&&was!==rec.name&&!prev&&RB_DAMAGE_STYLE[was])rep=was;
  if(rep&&rep!==rec.name)full.replaces=rep;
  if(was&&was!==rec.name&&!KWSTYLE[rec.name]){
    KWSTYLE[rec.name]=kwStyleFor(was); setMetaSafe('kwStyles',KWSTYLE);
  }
  var moved=[];
  if(kind==='class'&&was&&was!==rec.name){
    window.edDmgMembers(was).forEach(function(t){
      var own=KWCUSTOM.filter(function(c){ return c.mode==='damage'&&c.name===t.name; })[0];
      var r=Object.assign({},own||{name:t.name,mode:'damage',match:t.name,matchAlt:t.matchAlt||'',
        param:'number',reminder:'',reminderBare:'',dmgKind:'type'});
      r.dmgClass=(t.dmgClass||[]).map(function(n){ return n===was?rec.name:n; });
      moved.push(r);
    });
  }
  /* one at a time, as each save redraws */
  return moved.reduce(function(p,r){ return p.then(function(){ return window.edKwCustomSave(r); }); },
                      window.edKwCustomSave(full)).then(function(){ return full; });
};
window.edKwCustomDelete=function(id){
  var r=KWCUSTOM.filter(function(x){return x.id===id;})[0];
  if(!r||!confirm('Delete the entry \u201c'+r.name+'\u201d?'))return;
  KWCUSTOM=KWCUSTOM.filter(function(x){return x.id!==id;});
  del('kwcustom',id).then(function(){
    edApplyCustomEntries();
    try{ scheduleFace(); }catch(_){}
    var c=curCard(); if(c)renderPreview(c);
    try{ if(typeof window.edRenderKwPage==='function'&&document.getElementById('kwPageBody'))window.edRenderKwPage(); }catch(_){}
  });
};
window.edKwCustomList=function(){return KWCUSTOM.slice();};

/* #lookdata (data/look_default.txt, written by edExportDefaultLook) can carry the official look, for a copy with no network.
   A default, never an override: boot seeds from it only what the user has never set. */
var LOOK_BAKED=(function(){
  try{
    var el=document.getElementById('lookdata');
    if(!el)return null;
    var j=JSON.parse(el.textContent||'{}');
    return (j&&j.look&&typeof j.look==='object')?j.look:null;
  }catch(_){ return null; }
})();

var KWSTYLE={}, PILLS_ON=true, KW_HOVER=false;
var KW_DEFAULT={o:'#20242e',oh:'#c8cedb',f:'#2b3242',fh:'#6b7891',t:'#ffffff',
                shape:'pill',hl:'none',w:1.5};

/* Shared by the keyword pills (kwGrad), the holo slots (holoGradient) and the rarity outline (rarityGrad). */
var KW_HLSETS={
  none:      null,
  irid:      ['#ffe1ef','#fff7d8','#ffffff','#d8fff1','#dde7ff'],
  prism:     ['#ff5f7a','#ffd447','#8affc4','#5fb8ff','#c88aff'],
  iron:      ['#2a2d31','#4a4f55','#b9bec6','#3d4147','#23262a'],
  steel:     ['#8f9aa6','#c3ccd6','#f2f6fa','#aab5c1','#7d8894'],
  copper:    ['#6e3417','#a85a24','#f0b47a','#8a4419','#5a2a11'],
  bronze:    ['#5a4218','#8a6a2a','#d8b56a','#75551f','#453213'],
  silver:    ['#6f757e','#c9ced6','#ffffff','#e8ebf0','#848b95'],
  gold:      ['#e6c473','#f7e3a1','#fffdf0','#ffeec2','#d8ad57'],
  platinum:  ['#ffffff','#ffffff','#ffffff','#e2fff5','#e6ecff'],
  pearl:     ['#fffaf0','#ffe3ef','#fffdf8','#f0dcff','#efe6ff'],
  ember:     ['#241a15','#5a2408','#c24a12','#ff9a3c','#3a1c0e'],
  fiery:     ['#ffe36b','#ffc02e','#ff8a1f','#f4471d','#c2160c'],
  solar:     ['#e8a33c','#ffd27a','#ffe9b0','#ff7a3c','#c8391f'],
  frost:     ['#9fb3c4','#d8e6f2','#ffffff','#eaf4ff','#b9c9d8'],
  frozen:    ['#eaf6ff','#bfe6ff','#7fc9f0','#bfe6ff','#eaf6ff'],
  lunar:     ['#2f6fd0','#7fd4ff','#e8f4ff','#9aa6ff','#c3b8ff'],
  holy:      ['#e8d9ff','#ffd9ec','#ffffff','#f6e3a3','#d8b055'],
  demonic:   ['#2a0004','#7a0010','#ff5252','#c40018','#3a0006'],
  arcane:    ['#2f7fe0','#5fb8ff','#e7f2ff','#b98cf0','#e58ad2'],
  esper:     ['#ff9ad5','#e77ff0','#f7d5ff','#b477ee','#8f5adf'],
  electric:  ['#b8b400','#f0ea2a','#faf68c','#ffffff','#faf68c','#f0ea2a','#b8b400'],
  elven:     ['#4f9e52','#a8e6a3','#eafff2','#3fb6c9','#8fd8f2'],
  verdant:   ['#1f4a24','#3f8c3a','#54b56a','#3fa89a','#3f8c3a','#1f4a24'],
  earthen:   ['#3a2a18','#6b4d2c','#c2a172','#6b4d2c','#3a2a18'],
  sandy:     ['#8a6f45','#c2a778','#e8d6ae','#d8bf8f','#a08356'],
  verdigris: ['#5a4326','#8a6a3a','#cfe8dc','#3f9e86','#2e6f5e'],
  necro:     ['#04120a','#4dff6a','#04120a','#4dff6a','#04120a'],
  abyssal:   ['#07080d','#1b1030','#6a4fd0','#3fd8e8','#0a1220'],
  voidhl:    ['#050506','#ff31c8','#0a0a0c','#ff31c8','#050506'],
  bone:      ['#6b5f4e','#a89a80','#f6f1e4','#ded3bd','#8b7f6a'],
  blood:     ['#7e0b12','#a8121c','#fff6f6','#a8121c','#4a040a'],
  ghost:     ['#bfe4ff','#eafaff','#ffffff','#dcefe0','#d9c8ff'],
  /* Meant to clash: neon on near-black with no relation between neighbours (rarityGrad gives it hard edges). */
  glitch:    ['#00160b','#39ff14','#ff00d4','#0a0010','#00e5ff','#fff799',
              '#ff003c','#00160b','#b0ff00','#001018']
};
KW_HLSETS.bone=['#6b5f4e','#a89a80','#f6f1e4','#ded3bd','#8b7f6a'];
/* By reference, so a retuned ramp moves both; added after the literal so Object.keys lists them last in every picker. */
KW_HLSETS.transcendent=KW_HLSETS.prism.slice();
KW_HLSETS.mythic=KW_HLSETS.platinum.slice();
var KW_HLFX={glitch:1,transcendent:1,mythic:1};

/* Rebirth only, and absent until chosen: a card with no rarity prints with no box and nothing moved. */
var RARITIES=[
  {id:'common',       label:'Common',       ink:'#434343', fill:'#efefef', hl:'iron'},
  {id:'uncommon',     label:'Uncommon',     ink:'#1155cc', fill:'#cfe2f3', hl:'frost'},
  {id:'fine',         label:'Fine',         ink:'#38761d', fill:'#b6d7a8', hl:'verdigris'},
  /* the sheet's #ea999 is five digits; read as #ea9999, the tint paired with #990000 */
  {id:'superior',     label:'Superior',     ink:'#990000', fill:'#ea9999', hl:'blood'},
  {id:'rare',         label:'Rare',         ink:'#351c75', fill:'#b4a7d6', hl:'lunar'},
  {id:'epic',         label:'Epic',         ink:'#7f6000', fill:'#ffe599', hl:'holy'},
  {id:'legendary',    label:'Legendary',    ink:'#cc0000', fill:'#f4a049', hl:'fiery'},
  {id:'mythic',       label:'Mythic',       ink:'#6ebace', fill:'#d2f4eb', hl:'platinum'},
  {id:'transcendent', label:'Transcendent', ink:'#ffffff', fill:'#8eedf6', hl:'prism'},
  {id:'primordial',   label:'Primordial',   ink:'#fff799', fill:'#00160b', hl:'glitch'}
];
function rarityDef(id){
  if(!id)return null;
  var k=String(id).toLowerCase();
  for(var i=0;i<RARITIES.length;i++) if(RARITIES[i].id===k) return RARITIES[i];
  return null;
}
function rarityOf(c){
  if(!window.REBIRTH) return null;
  return rarityDef(c && c.rarity);
}
/* An outline is the metal itself, so it takes the full ramp with no fade or mix; glitch's stops repeat at uneven offsets to meet as hard edges. */
var RARITY_GLITCH_STOPS=[0,7,9,26,31,33,58,61,74,79,88,100];
/* One definition for the rarity outline and the holo slot; each colour is pushed twice, as a repeated stop makes a cut rather than a fade. */
function glitchStops(set){
  var st=[];
  set.forEach(function(col,i){
    var a=RARITY_GLITCH_STOPS[i%RARITY_GLITCH_STOPS.length];
    var b=RARITY_GLITCH_STOPS[(i+1)%RARITY_GLITCH_STOPS.length];
    st.push(col+' '+a+'%');
    st.push(col+' '+(b>a?b:100)+'%');
  });
  return st;
}
function rarityGrad(setName){
  var set=KW_HLSETS[setName]; if(!set)return '';
  var A='var(--holo-ang,120deg)', N=set.length;
  if(setName==='glitch') return 'linear-gradient('+A+','+glitchStops(set).join(',')+')';
  var stops=set.map(function(col,i){
    return col+' '+(+(N===1?50:(i/(N-1))*100).toFixed(2))+'%';
  });
  return 'linear-gradient('+A+','+stops.join(',')+')';
}
var KW_HLLABEL={none:'None', voidhl:'Void', glitch:'Primordial'};
function kwHlLabel(k){
  return KW_HLLABEL[k] || (String(k).charAt(0).toUpperCase()+String(k).slice(1));
}
function rarityHTML(c){
  var r=rarityOf(c); if(!r)return '';
  return "<div class='i-rarity rar-"+r.id+"' style='--rar-ink:"+r.ink
    +";--rar-fill:"+r.fill+";--rar-edge:"+rarityGrad(r.hl)+"'>"
    +"<span>"+e(r.label)+"</span></div>";
}
function hex2rgb(h){h=String(h).replace('#','');if(h.length===3)h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2];
  return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)];}
function mixHex(a,b,t){var A=hex2rgb(a),B=hex2rgb(b);
  return '#'+[0,1,2].map(function(i){var v=Math.round(A[i]+(B[i]-A[i])*t);
    return ('0'+Math.max(0,Math.min(255,v)).toString(16)).slice(-2);}).join('');}
function kwEntries(){ return (window.KW_MATCHES||[]).filter(function(k){return k.mode==='keyword';}); }
/* aliases share their parent's name, so they would only duplicate rows here */
function kwNames(){ var m={}; kwEntries().forEach(function(k){ if(!k.__alias)m[k.name]=1; }); return Object.keys(m).sort(); }
window.edKwNames=function(){return kwNames();};
window.edKwStyle=function(n){return kwStyleFor(n);};
function kwStyleFor(n){
  return kwStyleClean(Object.assign({},KW_DEFAULT,(window.REBIRTH&&RB_DAMAGE_STYLE[n])||{},KWSTYLE[n]||{})); }
/* Written into a style attribute and able to arrive with a look unasked, so each value is checked; every reader goes through kwStyleFor, every writer kwStylesClean. */
var KW_HEX_RE=/^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/;
function kwStyleClean(s){
  s=(s&&typeof s==='object')?s:{};
  ['o','oh','f','fh','t'].forEach(function(k){
    if(!KW_HEX_RE.test(String(s[k])))s[k]=KW_DEFAULT[k]; });
  if(!Object.prototype.hasOwnProperty.call(KW_SHAPECLASS,s.shape))s.shape=KW_DEFAULT.shape;
  if(s.hl!=='none'&&!(s.hl&&Object.prototype.hasOwnProperty.call(KW_HLSETS,s.hl)))s.hl='none';
  s.w=numAttr(s.w,1.5,0,6);
  return s;
}
/* a plain-valued field this copy does not draw is kept, as a look from a newer copy may carry one; kwPill reads only the fields above */
function kwStylesClean(all){
  var out={};
  if(!all||typeof all!=='object')return out;
  Object.keys(all).forEach(function(n){
    if(n==='__proto__')return;
    var v=all[n]; if(!v||typeof v!=='object'||Array.isArray(v))return;
    var c={};
    Object.keys(v).forEach(function(k){ if(k!=='__proto__')c[k]=v[k]; });
    if(c.hl===undefined&&c.irid!==undefined){ c.hl=c.irid?'irid':'none'; delete c.irid; }
    var w={};
    ['o','oh','f','fh','t','shape','hl','w'].forEach(function(k){ if(c[k]!==undefined)w[k]=c[k]; });
    var clean=kwStyleClean(Object.assign({},KW_DEFAULT,w));
    var keep={};
    Object.keys(c).forEach(function(k){
      if(Object.prototype.hasOwnProperty.call(w,k)){ keep[k]=clean[k]; return; }
      var x=c[k], t=typeof x;
      if((t==='number'&&isFinite(x))||t==='boolean'||(t==='string'&&x.length<=200))keep[k]=x;
    });
    out[n]=keep;
  });
  return out;
}
/* A preset tints a pill's sheen, never replaces its palette: each stop is mixed halfway toward the pill's highlight colour. */
var KW_HL_MIX=0.5;
function kwGrad(a,b,hl){
  var A='var(--holo-ang,120deg)', set=KW_HLSETS[hl||'none'];
  if(!set) return 'linear-gradient('+A+','+a+' 0%,'+b+' 46%,'+a+' 100%)';
  /* prism, glitch and transcendent (prism's copy) need repeated stops for hard edges; everything else blends */
  var N=set.length, lo=38, hi=54,
      hard=(hl==='prism'||hl==='glitch'||hl==='transcendent');
  var offs=set.map(function(_,i){ return +(lo+(hi-lo)*(N===1?0.5:i/(N-1))).toFixed(2); });
  var stops=[];
  set.forEach(function(c,i){
    var m=mixHex(c,b,KW_HL_MIX);
    if(hard&&i>0)stops.push(m+' '+offs[i-1]+'%');
    stops.push(m+' '+offs[i]+'%');
  });
  return 'linear-gradient('+A+','+a+' 0%,'+stops.join(',')+','+a+' 100%)';
}
/* for the board's counter dropdowns, which wear a pill's outline and fill: a second copy in cat_testdeck.js would drift */
window.edKwGrad=function(a,b,hl){ return kwGrad(a,b,hl); };
window.edKwGradFlat=function(hl,a,b){
  return kwGrad(a||'#2b3242',b||'#6b7891',hl).replace('var(--holo-ang,120deg)','90deg');
};
var KW_SHAPECLASS={pill:'',box:' kw-box',point:' kw-point',lpoint:' kw-lpoint',
                   dpoint:' kw-dpoint',slant:' kw-slant'};
/* A keyword can carry several reminder variants (Barrier has four): pick by whether a value was written, then substitute it. */
function kwReminderFor(name,matched,mode){
  /* by name, preferring the mode the caller detected: a word can be both a keyword and a keyterm (Grind) */
  var byName=(window.KW_MATCHES||[]).filter(function(k){return k.name===name;});
  var all=mode?byName.filter(function(k){return (k.mode||'keyword')===mode;}):[];
  if(!all.length)all=byName;
  if(!all.length)return '';
  var cust=all.filter(function(k){return k.__custom;})[0];
  if(cust){
    var m2=/[\s]+(\d+|X)$/i.exec(String(matched||''));
    var v=m2?m2[1]:null;
    if(!v)return cust.reminderBare||String(cust.reminder||'').replace(/\s*\{value\}/gi,'');
    var ins=(cust.param==='cost')?('{'+v+'}'):v;
    return String(cust.reminder||'').replace(/\{value\}/gi,ins);
  }
  var mv=/[\s]+(\d+|X)$/i.exec(String(matched||''));
  var val=mv?mv[1]:null;
  var holder=/\((Cost|X|Parameter|Paremeter|Area|Effect)\)/i;
  var withHolder=all.filter(function(k){return holder.test(k.reminder||'');});
  var without=all.filter(function(k){return !holder.test(k.reminder||'');});
  if(!val)return (without[0]||all[0]).reminder||'';
  var pick=withHolder.filter(function(k){return /\((Cost)\)/i.test(k.reminder);})[0];
  if(/^X$/i.test(val)||!pick)pick=withHolder.filter(function(k){return /\(X\)/i.test(k.reminder);})[0]||withHolder[0];
  if(!pick)return (all[0].reminder||'');
  // global: a reminder can repeat its placeholder (Gouge), so every one is substituted
  var allHolders=/\((Cost|X|Parameter|Paremeter|Area|Effect)\)/gi;
  return String(pick.reminder||'').replace(allHolders,function(m,g){
    return /cost/i.test(g)?('{'+val+'}'):val;
  });
}
window.edKwReminder=function(n,m){return kwReminderFor(n,m);};
function kwPill(name,text,reminder,mode){
  var s=kwStyleFor(name);
  var cls='kw-pill'+(KW_SHAPECLASS[s.shape]||'');
  /* --kw-o, the ring round every letter, is the Outline colour, for a Damage Type as for a keyword */
  var st='--kw-out:'+kwGrad(s.o,s.oh,s.hl)+';--kw-fill:'+kwGrad(s.f,s.fh,s.hl)
        +';--kw-w:'+(+s.w||1.5)+'px;--kw-o:'+s.o+';color:'+s.t;
  var rem=KW_HOVER?(kwReminderFor(name,text)||reminder||''):'';
  var tip=rem?" title='"+e(rem).replace(/'/g,'&#39;')+"'":'';
  /* wrapped so the drop-shadow is not clipped away by the pointed shapes */
  return "<span class='kw-shadow'><span class='"+cls+"' style='"+st+"'"+tip
    +kwLinkAttrs(mode,name)+">"+text+"</span></span>";
}
/* The entry travels as data-kw-* attributes, never inside the onclick, where entities are decoded before the script reads it (HANDOFF §24.2). */
function kwLinkAttrs(mode,name){
  return " data-kw-mode='"+e(mode||'keyword')+"' data-kw-entry='"
    +e('kwentry-'+String(name==null?'':name).replace(/\s+/g,'_'))+"' onclick='edKwOpen(this)'";
}
window.edKwOpen=function(el){
  if(!el||typeof el.getAttribute!=='function')return;
  var mode=el.getAttribute('data-kw-mode')||'keyword', entry=el.getAttribute('data-kw-entry')||'';
  if(typeof window._openKwAndHighlight==='function')window._openKwAndHighlight(mode,entry);
};

/* Case sensitive by design: "Attack" is the stat and "attack" the battle action; the short forms (ATK, HP, MP, Rg) match only as written. */
var STAT_MARKS={Attack:'atk',Health:'hp',Arcane:'arc',Range:'rng',
                ATK:'atk',HP:'hp',MP:'arc',Rg:'rng'};
function statMarkSVG(kind){
  var uid='sm'+Math.random().toString(36).slice(2,8);
  var fh=({atk:ORB_FILL.atk,hp:ORB_FILL.hp,arc:ORB_FILL.arc,rng:ORB_FILL.rng})[kind];
  /* data-rot, or the holo handlers (ed2_face.js, tdAltHolo) leave this mark at ORB_ANG while everything round it turns */
  return "<span class='m-statmark'><svg viewBox='0 0 38 38' aria-hidden='true'>"
    +"<defs><linearGradient id='"+uid+"' data-rot='1' gradientTransform='"+ORB_ANG+"'>"
      +"<stop offset='0%' stop-color='"+fh+"'/>"
      +"<stop offset='30%' stop-color='"+shadeRGB(fh,34)+"'/>"
      +"<stop offset='48%' stop-color='"+shadeRGB(fh,70)+"'/>"
      +"<stop offset='66%' stop-color='"+shadeRGB(fh,-36)+"'/>"
      +"<stop offset='100%' stop-color='"+fh+"'/></linearGradient></defs>"
    +"<path d='"+_orbShapePath(kind)+"' fill='url(#"+uid+")'/></svg></span>";
}
/* A die is drawn before its word, which stays: at rules-text size a numeral inside the shape cannot be read.
   currentColor and em, so it follows the theme and the fitter's font size (HANDOFF §39); stroke-width is in the 24-unit viewBox. */
var DICE_SIDES=[4,6,8,10,12,20];
var DICE_PATHS={
  4:['M12 2.6 L22 20.6 L2 20.6 Z','M12 11.4 L17 20.6 L7 20.6 Z'],
  6:['M4.6 3.4 h14.8 a1.2 1.2 0 0 1 1.2 1.2 v14.8 a1.2 1.2 0 0 1 -1.2 1.2 '
     +'h-14.8 a1.2 1.2 0 0 1 -1.2 -1.2 v-14.8 a1.2 1.2 0 0 1 1.2 -1.2 Z',''],
  8:['M12 2 L21.6 12 L12 22 L2.4 12 Z','M2.4 12 H21.6'],
  10:['M12 2 L21.2 9.6 L12 22 L2.8 9.6 Z','M2.8 9.6 L12 13.2 L21.2 9.6'],
  12:['M12 2 L21.8 9.2 L18.1 20.8 L5.9 20.8 L2.2 9.2 Z',''],
  20:['M12 1.9 L21 7 L21 17 L12 22.1 L3 17 L3 7 Z','M12 5.6 L18.4 16.8 L5.6 16.8 Z']
};
/* for the board; here, after DICE_PATHS, as a var's assignment is not hoisted and an earlier export was undefined */
window.edDicePaths=DICE_PATHS;
function diceMarkSVG(n){
  var p=DICE_PATHS[n]; if(!p) return '';
  return "<span class='m-dicemark'><svg viewBox='0 0 24 24' aria-hidden='true'>"
    +"<path d='"+p[0]+"' fill='none' stroke='currentColor' stroke-width='2.1'"
      +" stroke-linejoin='round'/>"
    +(p[1]?("<path d='"+p[1]+"' fill='none' stroke='currentColor'"
      +" stroke-width='1.3' stroke-linejoin='round' opacity='.72'/>"):'')
    +"</svg></span>";
}
/* A leading count is part of the token (2D6), the lookbehind still refuses a letter (XD6), and the trailing guard keeps D10 out of D100. */
var _diceRe=null;
function markDice(seg,ph){
  if(!_diceRe){
    _diceRe=DICE_SIDES.map(function(n){
      return {n:n, re:new RegExp('(?<![\\w-])\\d*D'+n+'(?![\\w-])','g')};  // no 'i'
    });
  }
  _diceRe.forEach(function(e){
    seg=seg.replace(e.re,function(m){ return ph(diceMarkSVG(e.n)+m); });
  });
  return seg;
}

var _statRe=null;
function markStats(seg,ph){
  if(!_statRe){
    _statRe=Object.keys(STAT_MARKS).map(function(word){
      return {word:word, re:new RegExp('(?<![\\w-])'+word+'(?![\\w-])','g')};  // no 'i'
    });
  }
  _statRe.forEach(function(e){
    seg=seg.replace(e.re,function(m){ return ph(statMarkSVG(STAT_MARKS[e.word])+m); });
  });
  return seg;
}
/* A glossary entry that is a die (the main game's D4 to D20 are) takes the word before markDice sees it, so the die is put in front of
   the link here, by markDice's rules: case as written, and D100 is no D10. */
function markLead(m){
  var d=/^\d*D(\d+)(?![\w-])/.exec(m);
  return (d&&DICE_SIDES.indexOf(+d[1])>=0)?diceMarkSVG(+d[1]):'';
}
var _noPills=false;
/* A defined counter gets its own pill and "<Keyword> counter" one pill in that keyword's style, both matched before the bare keyword. */
var CNT_LEAD='(?:(?:\\d+|X)\\s+)?';
function rxEsc(s){ return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
var _planCache=null,_planFor=null;
function matchPlan(){
  var all=(window.KW_MATCHES||[]);
  if(_planCache&&_planFor===all)return _planCache;
  var counters=[],kwCounters=[],rest=[];
  all.forEach(function(k){
    var mode=k.mode||'keyword', lit=rxEsc(k.match||k.name);
    if(mode==='counter'){
      /* the entry name already ends in "counter", so only the plural is added */
      counters.push({k:k,style:k.name,pat:CNT_LEAD+lit+'s?'});
      return;
    }
    if(mode==='keyword'){
      kwCounters.push({k:k,style:k.name,pat:CNT_LEAD+lit+'\\s+counters?'});
    }
    rest.push({k:k,style:k.name,pat:null});
  });
  var byLen=function(a,b){ return b.pat.length-a.pat.length; };
  counters.sort(byLen); kwCounters.sort(byLen);
  _planCache=counters.concat(kwCounters,rest); _planFor=all;
  /* Compiled once per KW_MATCHES, not per segment, or a card costs thousands of lookbehinds. A /g regex is safe to reuse: replace resets lastIndex. */
  _planCache.forEach(function(ent){
    if(ent.pat){
      ent.re=new RegExp('(?<![\\w-])('+ent.pat+')(?![\\w-])','gi');
      return;
    }
    var k=ent.k;
    var lit=String(k.match||k.name).replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    /* a Damage Type needs its number, signed or not ("SL -1", "SL+2"), so the everyday words stay prose; no i, as written */
    if(k.mode==='damage'){
      ent.re=new RegExp('(?<![\\w-])('+lit+'(?:\\s+[+\\-\u2212]?|[+\\-\u2212])\\d+)(?![\\w-])','g');
      return;
    }
    /* a trailing number or X goes into the pill, unless the entry declares param 'none' */
    var takes=(k.param===undefined)||(k.param&&k.param!=='none');
    ent.re=new RegExp('(?<![\\w-])('+lit+(takes?'(?:\\s+(?:\\d+|X))?':'')+')(?![\\w-])','gi');
  });
  return _planCache;
}
function pillifyRules(html){
  var store=[],ph=function(h){ store.push(h); return '\u0001'+(store.length-1)+'\u0001'; };
  var parts=String(html).split(/(<[^>]*>)/);
  var all=matchPlan();
  for(var pi=0;pi<parts.length;pi++){
    if(pi%2===1) continue;                       // odd indexes are tags: nothing inside one is matched
    var seg=parts[pi];
    all.forEach(function(ent){
      var k=ent.k;
      if(ent.pat){
        seg=seg.replace(ent.re,function(m){
          return (PILLS_ON&&!_noPills)?ph(kwPill(ent.style,m,k.reminder))
            :ph("<span class='kw-link'"+kwLinkAttrs(k.mode||'keyword',k.name)+">"+m+"</span>");
        });
        return;
      }
      seg=seg.replace(ent.re,function(m){
        var lead=markLead(m);
        if(k.mode==='keyword'||k.mode==='damage')
          return ph(lead+((PILLS_ON&&!_noPills)?kwPill(k.name,m,k.reminder,k.mode)
            :"<span class='kw-link'"+kwLinkAttrs(k.mode,k.name)+">"+m+"</span>"));
        return ph(lead+"<span class='kw-link'"+kwLinkAttrs(k.mode,k.name)+">"+m+"</span>");
      });
    });
    /* each pass wraps what it emits in ph(), so neither can match inside the other's output and the order does not matter */
    parts[pi]=markDice(markStats(seg,ph),ph);
  }
  return parts.join('').replace(/\u0001(\d+)\u0001/g,function(_,i){return store[+i];});
}

/* A reminder opens with its keyword's name, which wears the pill; the explanation after it stays prose. */

function pillableMode(name){
  var hit=(window.KW_MATCHES||[]).filter(function(k){return k.name===name;})[0];
  var m=hit&&(hit.mode||'keyword');
  return m==='keyword'||m==='counter'||m==='damage';
}
window.edKwIsPillable=pillableMode;
/* A pill's colours without its shape, for the board's counter window: the shape class would clip a full-width heading into a chevron. */
window.edKwPillVars=function(name){
  try{
    var s=kwStyleFor(name);
    return '--kw-out:'+kwGrad(s.o,s.oh,s.hl)+';--kw-fill:'+kwGrad(s.f,s.fh,s.hl)
      +';--kw-w:'+(+s.w||1.5)+'px;--kw-o:'+s.o+';--kw-ink:'+s.t;
  }catch(_){ return ''; }
};
/* `text` is markup the caller escaped; with none, the name is the label and is escaped here */
window.edKwPillFor=function(name,text){
  if(!pillableMode(name))return e(text||name);
  try{ return kwPill(name,text||e(name),kwReminderFor(name,name)||''); }
  catch(_){ return e(text||name); }
};
window.edKwReminderSplit=function(name,reminder){
  var txt=String(reminder||''), nm=String(name||'');
  if(!txt||!nm)return null;
  /* the card face wraps reminders in parentheses */
  var open='', body=txt;
  if(body.charAt(0)==='('&&body.charAt(body.length-1)===')'){
    open='('; body=body.slice(1,-1);
  }
  if(body.slice(0,nm.length).toLowerCase()!==nm.toLowerCase())return null;
  return {open:open, name:body.slice(0,nm.length), rest:body.slice(nm.length),
          close:open?')':''};
};
window.edKwReminderHTML=function(name,reminder){
  var s=window.edKwReminderSplit(name,reminder);
  if(!s)return symbolizeRules(String(reminder||''),true).replace(/<\/?p>/g,'');
  var rest=symbolizeRules(s.rest,true).replace(/<\/?p>/g,'');
  /* s.name is the reminder's own text, so it is escaped on the way in */
  return e(s.open)+window.edKwPillFor(name,e(s.name))+rest+e(s.close);
};
window.edSetKwStyle=function(name,field,val){
  KWSTYLE[name]=Object.assign({},kwStyleFor(name),{}); 
  KWSTYLE[name][field]=(field==='irid')?!!val:val;
  kwStyleClean(KWSTYLE[name]);
  setMetaSafe('kwStyles',KWSTYLE);
  try{ scheduleFace(); }catch(_){}
  var c=curCard(); if(c)renderPreview(c);
};
window.edSetPillsOn=function(on){
  PILLS_ON=!!on; setMetaSafe('pillsOn',PILLS_ON);
  try{ scheduleFace(); }catch(_){}
  var c=curCard(); if(c)renderPreview(c);
};
window.edSetKwHover=function(on){
  KW_HOVER=!!on; setMetaSafe('kwHover',KW_HOVER);
  try{ scheduleFace(); }catch(_){}
  var c=curCard(); if(c)renderPreview(c);
};
window.edKwReset=function(){
  if(!confirm('Reset every keyword pill to the default style?'))return;
  KWSTYLE={}; setMetaSafe('kwStyles',null);
  try{ scheduleFace(); }catch(_){}
  var c=curCard(); if(c)renderPreview(c);
};

/* The only markup rule text may hold: everything is escaped, then exactly <b>, <i> and <u> are put back. */
var RULE_FMT_RE=/&lt;(\/?)(b|i|u)&gt;/g;
function unescapeRuleFmt(s){ return String(s||'').replace(RULE_FMT_RE,'<$1$2>'); }
window.edStripRuleFmt=function(s){
  return String(s||'').replace(/<\/?[biu]>/g,'').replace(/\[\[([^\[\]\n]{1,120})\]\]/g,'$1'); };
/* [[Name]] links are held aside as placeholders across the whole pipeline, so a name holding a keyword or a mana letter stays one link.
   The helpers are cat_core.js's, shared with the catalog's views, and guarded so a face with no catalog still draws. */
function symbolizeRules(txt,noPills){if(!txt)return'';var out=unescapeRuleFmt(e(txt));
  _noPills=!!noPills;
  var _lk=[], _hold=window.cardLinksHold, _put=window.cardLinksPut;
  if(_hold&&_put) out=_hold(out,_lk);
  out=out.replace(/\{([A-Za-z0-9\/]+)\}/g,function(m,tok){return symToken(tok,13)||m;});
  try{ out=pillifyRules(out); }
  catch(_){ if(typeof window.linkKeywords==='function'){try{out=window.linkKeywords(out);}catch(__){}} }
  if(_hold&&_put) out=_put(out,_lk);
  return out.split('\n').map(function(l){return '<p>'+l+'</p>';}).join('');}
/* on window for tdRuleHTML (cat_testdeck.js), which cannot see into this closure */
window.symbolizeRules=symbolizeRules;
function typeLine(c){var sup=edList(c.superTypes).join(' '),sub=edList(c.subTypes).join(' ');return sub?(sup+' \u2014 '+sub):sup;}

/* Cached, as every face asks and per card it is O(n²); dropped on a change of length or of CARD_GEN, as a saga move keeps the count. */
var _numIdx=null, _numIdxN=-1, _numIdxG=-1;
function _numIndex(){
  var list=(window.CARDS||[]);
  if(_numIdx && _numIdxN===list.length && _numIdxG===(window.CARD_GEN||0)) return _numIdx;
  var bySaga={}, pos={};
  list.forEach(function(c){
    var s=c.saga||'';
    (bySaga[s]||(bySaga[s]=[])).push(c);
  });
  Object.keys(bySaga).forEach(function(s){
    bySaga[s].forEach(function(c,i){ pos[c.__id||c.id]={i:i, total:bySaga[s].length}; });
  });
  _numIdx={bySaga:bySaga, pos:pos, all:list};
  _numIdxN=list.length; _numIdxG=(window.CARD_GEN||0);
  return _numIdx;
}
window.edCardNumberInvalidate=function(){ _numIdx=null; _numIdxN=-1; _numIdxG=-1; };
function cardNumber(card){
  var ix=_numIndex(), list=ix.all;
  var at=ix.pos[card.__id||card.id], idx, total;
  if(at){ idx=at.i; total=at.total; }
  else {
    idx=list.indexOf(card); total=list.length;
    if(idx<0){ idx=0; total=total||1; }
  }
  var pad=function(x){return String(x).padStart(Math.max(4,String(total).length),'0');};
  return pad(idx+1)+'/'+pad(total);
}

/* artXf {z,x,y,r,f}: x and y are percent of the art box, so they survive any render scale; f is the flip, -1, and absent reads as 1.
   The identity emits no transform at all. */
var ART_XF_DEFAULT={z:1,x:0,y:0,r:0,f:1};
function artXfOf(c){
  var t=c&&c.artXf;
  if(!t||typeof t!=='object')return null;
  var z=parseFloat(t.z), x=parseFloat(t.x), y=parseFloat(t.y), r=parseFloat(t.r);
  z=isFinite(z)?z:1; x=isFinite(x)?x:0; y=isFinite(y)?y:0; r=isFinite(r)?r:0;
  /* f counts like the rest, or a card that is only flipped reads as untransformed */
  var f=(t.f===-1||t.f==='-1')?-1:1;
  if(z===1&&x===0&&y===0&&r===0&&f===1)return null;
  return {z:z,x:x,y:y,r:r,f:f};
}

/* 'h' art above the rules box (the default), 'vl' art on the left, 'vr' on the right.
   A card field, not a variant one: it is layout, and a visual field left off variantOf's list is invisible to every reader (HANDOFF §4). */
var FRAME_MODES=['h','vl','vr'];
function frameModeOf(c){
  var m=c&&c.frame;
  return FRAME_MODES.indexOf(m)>=0?m:'h';
}
function frameOrientOf(c){ return frameModeOf(c)==='h'?'h':'v'; }

/* c.rulesSplit (0, 2, 3 or 4) splits the rules box along its long axis; c.sections holds each one's text and identity, kept while splitIdent is off.
   In the catalog a split card is still one card: the filters match its sections (splitFacets), but it appears once. */
var RULES_SPLITS=[0,2,3,4];
function rulesSplitOf(c){
  var n=c&&parseInt(c.rulesSplit,10);
  return (n===2||n===3||n===4)?n:0;
}
/* All Individual: the card field splitIdent, which older cards carry */
function splitIdentOf(c){ return !!(c&&c.splitIdent&&rulesSplitOf(c)); }
function sectionIdentOn(c,s){
  if(!rulesSplitOf(c))return false;
  return splitIdentOf(c) || !!(s&&s.ident);
}
/* an individual section with no name, cost or types falls back to plain rules text rather than print empty lines */
function sectionHasIdent(s){
  return !!(s && (s.name || s.manaCost
    || (s.superTypes && s.superTypes.length)
    || (s.subTypes && s.subTypes.length)));
}
function sectionShowsIdent(c,s){ return sectionIdentOn(c,s)&&sectionHasIdent(s); }
function anySectionIdent(c){
  if(!rulesSplitOf(c))return false;
  return (cardSections(c)||[]).some(function(s){ return sectionShowsIdent(c,s); });
}
/* cheap enough for every card on every keystroke: the catalog's filter asks it before splitFacets */
function anyIdentFlag(c){
  if(!c)return false;
  if(c.splitIdent)return true;
  var src=c.sections;
  if(!Array.isArray(src))return false;
  for(var i=0;i<src.length;i++) if(src[i]&&src[i].ident)return true;
  return false;
}
window.edAnyIdent=function(c){ return anyIdentFlag(c); };
function splitChoiceOf(c){ return !!(c&&c.splitChoice&&rulesSplitOf(c)); }
function choiceTextOf(c){ return String((c&&c.choiceText)||''); }
/* A card field, not a saga one: the Choice line is mechanics, the same in every saga (HANDOFF §4). Blank means one line; halves are real heights. */
function choiceRowsOf(c){
  var n=parseFloat(c&&c.choiceRows);
  return (isNaN(n)||n<0)?0:n;
}
/* always exactly rulesSplitOf(c) entries, so no reader has to guard */
function cardSections(c){
  var n=rulesSplitOf(c); if(!n)return null;
  var src=Array.isArray(c&&c.sections)?c.sections:[];
  var out=[];
  for(var i=0;i<n;i++){
    var s=src[i]||{};
    out.push({text:String(s.text||''),
              name:String(s.name||''),
              manaCost:String(s.manaCost||''),
              ident:s.ident===true,
              superTypes:Array.isArray(s.superTypes)?s.superTypes.slice():[],
              subTypes:Array.isArray(s.subTypes)?s.subTypes.slice():[]});
  }
  return out;
}
function splitFacets(c){
  /* null, not an empty object: this runs for every card on every keystroke */
  if(!anyIdentFlag(c))return null;
  var out={names:[],superTypes:[],subTypes:[],colors:[],costs:[]};
  (cardSections(c)||[]).forEach(function(s){
    if(!sectionIdentOn(c,s))return;
    if(s.name)out.names.push(s.name);
    s.superTypes.forEach(function(t){ if(t)out.superTypes.push(t); });
    s.subTypes.forEach(function(t){ if(t)out.subTypes.push(t); });
    if(s.manaCost){
      /* the computed cost: computeCmc lives in this closure, out of the catalog filter's reach */
      out.costs.push(computeCmc(s.manaCost));
      colorsFromMana(s.manaCost).forEach(function(col){
        if(out.colors.indexOf(col)<0)out.colors.push(col);
      });
    }
  });
  return out;
}
window.edSplitFacets=function(c){ return splitFacets(c); };

/* Per-orientation defaults, read only where the card chose nothing (Auto, never framed by hand).
   The effective fit goes on .mcard, never a global class on the body, so a global and a per-card setting cannot disagree. */
var TPL_XF_ZERO={z:1,x:0,y:0,r:0,f:1};
var TPL_DEFAULTS={h:{fit:'contain',xf:{z:1,x:0,y:0,r:0,f:1}},
                  v:{fit:'contain',xf:{z:1,x:0,y:0,r:0,f:1}}};
function tplDefaults(orient){ return TPL_DEFAULTS[orient==='v'?'v':'h']; }
function tplNormDefaults(raw){
  var out={h:{fit:'contain',xf:Object.assign({},TPL_XF_ZERO)},
           v:{fit:'contain',xf:Object.assign({},TPL_XF_ZERO)}};
  if(!raw||typeof raw!=='object')return out;
  ['h','v'].forEach(function(k){
    var s=raw[k]; if(!s||typeof s!=='object')return;
    if(s.fit==='cover'||s.fit==='fill'||s.fit==='contain')out[k].fit=s.fit;
    var x=s.xf; if(!x||typeof x!=='object')return;
    ['z','x','y','r'].forEach(function(f){
      var n=parseFloat(x[f]); if(isFinite(n))out[k].xf[f]=n;
    });
    out[k].xf.f=(x.f===-1||x.f==='-1')?-1:1;
  });
  return out;
}

function effectiveFit(c){
  var v=variantOf(c), f=v&&v.fit;
  if(f==='contain'||f==='cover'||f==='fill')return f;
  var d=tplDefaults(frameOrientOf(c)).fit;
  return (d==='cover'||d==='fill')?d:'contain';
}
function effectiveArtXf(c){
  var own=artXfOf(variantOf(c));
  if(own)return own;
  var d=tplDefaults(frameOrientOf(c)).xf||{};
  var t={z:isFinite(parseFloat(d.z))?parseFloat(d.z):1,
         x:isFinite(parseFloat(d.x))?parseFloat(d.x):0,
         y:isFinite(parseFloat(d.y))?parseFloat(d.y):0,
         r:isFinite(parseFloat(d.r))?parseFloat(d.r):0,
         f:(d.f===-1?-1:1)};
  if(t.z===1&&t.x===0&&t.y===0&&t.r===0&&t.f===1)return null;
  return t;
}
/* A variant owns only visual fields {id, label, art, imageUrl, artXf, fit, fullArt, holo, frameColor}; the rest stays on the card, so a rules edit reaches every look.
   variantOf() is the one place the face reads visual fields from (HANDOFF §4). */
function cardVariants(c){
  return (c && Array.isArray(c.variants) && c.variants.length) ? c.variants : null;
}
/* The choice is a saga field (SAGA_FIELDS): a cardForSaga() copy is already that saga's, and the card itself asks edDrawSaga(). */
function chosenVariantId(c){
  if(!c)return null;
  if(c.__drawSaga!==undefined||!c.sagaFields)return c.variant;
  var sid=null;
  try{ if(typeof window.edDrawSaga==='function')sid=window.edDrawSaga(c); }catch(_){}
  var ov=sid&&c.sagaFields[sid];
  return (ov&&ov.variant!==undefined)?ov.variant:c.variant;
}
function setVariantChoice(c,id){
  var sid=null;
  try{ if(typeof window.edEditingSaga==='function')sid=window.edEditingSaga(); }catch(_){}
  if(sid&&typeof window.edSetSagaField==='function')window.edSetSagaField(c,sid,'variant',id);
  else c.variant=id;
}
/* A saga version's own frameColor and holo (borderLook, a saga field); a half left absent is what the art look says. Read as chosenVariantId reads. */
function sagaBorderOf(c){
  if(!c)return null;
  var bl;
  if(c.__drawSaga!==undefined||!c.sagaFields)bl=c.borderLook;
  else {
    var sid=null;
    try{ if(typeof window.edDrawSaga==='function')sid=window.edDrawSaga(c); }catch(_){}
    var ov=sid&&c.sagaFields[sid];
    bl=(ov&&ov.borderLook!==undefined)?ov.borderLook:c.borderLook;
  }
  return (bl&&typeof bl==='object')?bl:null;
}
function variantOf(c){
  var vs=cardVariants(c);
  var bl=sagaBorderOf(c);
  if(!vs){
    if(!bl)return c;
    /* a copy, never a write: visualTarget is where writes go */
    var o=Object.assign({},c);
    if(bl.frameColor!==undefined)o.frameColor=bl.frameColor;
    if(bl.holo!==undefined)o.holo=bl.holo;
    return o;
  }
  var v=null, want=chosenVariantId(c);
  for(var i=0;i<vs.length;i++){ if(vs[i] && vs[i].id===want){ v=vs[i]; break; } }
  if(!v)v=vs[0];
  /* A whitelist, not a merge: a visual field added to a variant and not listed here is invisible to every reader (HANDOFF §4). */
  return {imageUrl:(v.imageUrl!==undefined?v.imageUrl:c.imageUrl),
          art:(v.art!==undefined?v.art:c.art),
          artXf:(v.artXf!==undefined?v.artXf:c.artXf),
          holo:(bl&&bl.holo!==undefined)?bl.holo:(v.holo!==undefined?v.holo:c.holo),
          fit:(v.fit!==undefined?v.fit:c.fit),
          /* Full art (session 92): the picture over the whole card, a look of the variant like the fit */
          fullArt:(v.fullArt!==undefined?v.fullArt:c.fullArt),
          /* frameColor alone has no card fallback: Clear deletes it from the visual target, and a fallback would hand back the copy edAddVariant left on the card. */
          /* no mark: the watermark is per saga version (markIdOf, which still reads one an older model left on a variant) */
          frameColor:(bl&&bl.frameColor!==undefined)?bl.frameColor:v.frameColor};
}
/* Where a visual edit is written: the active variant, so the other looks keep theirs; never card data. */
function visualTarget(c){
  var vs=cardVariants(c); if(!vs)return c;
  var want=chosenVariantId(c);
  for(var i=0;i<vs.length;i++) if(vs[i].id===want) return vs[i];
  return vs[0];
}
window.edVariants=function(c){ return cardVariants(c)||[]; };
window.edActiveVariant=function(c){
  var vs=cardVariants(c); if(!vs)return null;
  var want=chosenVariantId(c);
  for(var i=0;i<vs.length;i++) if(vs[i].id===want) return vs[i];
  return vs[0];
};
window.edSetVariant=function(id){
  var c=curCard(); if(!c||!cardVariants(c))return;
  setVariantChoice(c,id); markDirty(c);
  renderPreview(c); try{ window.edRenderArtPanel(); }catch(_){}
  try{ scheduleFace(); }catch(_){}
};
window.edAddVariant=function(){
  var c=curCard(); if(!c)return;
  var vs=cardVariants(c);
  if(!vs){
    /* every visual field variantOf lists, or this is not a promotion of the look */
    vs=[{id:'v1',label:'Default',art:c.art||'',imageUrl:c.imageUrl||'',
         artXf:c.artXf,holo:c.holo,fit:c.fit,fullArt:c.fullArt,frameColor:c.frameColor,
         mark:c.mark}];
    c.variants=vs;
  }
  var n=vs.length+1;
  vs.push({id:'v'+n+'_'+uid(),label:'Art '+n,art:'',imageUrl:'',artXf:null,holo:null,mark:''});
  setVariantChoice(c,vs[vs.length-1].id); markDirty(c);
  renderPreview(c); try{ window.edRenderArtPanel(); }catch(_){}
};
window.edDeleteVariant=function(){
  var c=curCard(); var vs=cardVariants(c); if(!vs||vs.length<2)return;
  var cur=window.edActiveVariant(c);
  if(!confirm('Delete variant "'+(cur.label||cur.id)+'"? The card itself is not affected.'))return;
  c.variants=vs.filter(function(v){return v.id!==cur.id;});
  var first=c.variants[0].id;
  if(c.variant===cur.id||!c.variant)c.variant=first;
  if(c.sagaFields)Object.keys(c.sagaFields).forEach(function(sid){
    var bag=c.sagaFields&&c.sagaFields[sid];
    if(!bag||bag.variant===undefined)return;
    var to=(bag.variant===cur.id)?first:bag.variant;
    if(typeof window.edSetSagaField==='function')window.edSetSagaField(c,sid,'variant',to);
    else if(to===c.variant)delete bag.variant;
  });
  markDirty(c);
  renderPreview(c); try{ window.edRenderArtPanel(); }catch(_){}
};
window.edRenameVariant=function(){
  var c=curCard(); var v=window.edActiveVariant(c); if(!v)return;
  var nm=prompt('Variant name:', v.label||v.id); if(nm===null)return;
  v.label=String(nm).trim()||v.label; markDirty(c);
  try{ window.edRenderArtPanel(); }catch(_){}
};

function artXfCss(c){
  /* effectiveArtXf, not artXfOf: a card never framed takes the Templates default for its orientation */
  var t=effectiveArtXf(c); if(!t)return '';
  /* the flip rides on the X scale so it comes before the rotation; after it, it would mirror the angle too */
  var sx=(t.f===-1?-1:1)*t.z;
  return ";transform:translate("+t.x+"%,"+t.y+"%) rotate("+t.r+"deg) scale("+sx+","+t.z+")";
}

/* c.holo = {image, bg, pin, border}, each {set, a, blend}; absent or 'none' emits nothing, and the old single {set,a,bg,pin} is migrated on read. */
var HOLO_SLOTS=['image','bg','pin','border'];
var HOLO_SLOT_LABEL={image:'Image',bg:'Background',pin:'Pinlines',border:'Border'};
var HOLO_BLENDS=['screen','multiply','overlay','soft-light','normal'];
function holoSlot(v){
  if(!v||!v.set||v.set==='none'||!KW_HLSETS[v.set])return null;
  var a=parseFloat(v.a); if(!isFinite(a))a=0.35;
  var b=HOLO_BLENDS.indexOf(v.blend)>=0?v.blend:'screen';
  return {set:v.set,a:Math.max(0,Math.min(1,a)),blend:b};
}
function holoOf(c){
  var h=c&&variantOf(c).holo; if(!h||typeof h!=='object')return null;
  var out={},any=false;
  if(h.set!==undefined){
    var base=holoSlot(h);
    if(base){ out.image=base; any=true;
      if(h.bg){ out.bg=Object.assign({},base); }
      if(h.pin){ out.pin=Object.assign({},base); } }
  } else {
    HOLO_SLOTS.forEach(function(k){
      var v=holoSlot(h[k]); if(v){ out[k]=v; any=true; }
    });
  }
  return any?out:null;
}
/* A sheen laid over the card fades to transparent at both ends, unlike a pill's ramp. */
function holoGradient(setName){
  var set=KW_HLSETS[setName]; if(!set)return '';
  var A='var(--holo-ang,120deg)', N=set.length, lo=30, hi=62;
  /* Primordial covers the whole surface at hard edges (glitchStops), with no fade, or it reads as a soft rainbow; strength is still the slot's alpha. */
  if(setName==='glitch') return 'linear-gradient('+A+','+glitchStops(set).join(',')+')';
  var stops=set.map(function(col,i){
    return col+' '+(+(lo+(hi-lo)*(N===1?0.5:i/(N-1))).toFixed(2))+'%';
  });
  return 'linear-gradient('+A+',rgba(0,0,0,0) 0%,'+stops.join(',')+',rgba(0,0,0,0) 100%)';
}
function holoStyleVars(c){
  var h=holoOf(c); if(!h)return '';
  var out='';
  HOLO_SLOTS.forEach(function(k){
    var v=h[k]; if(!v)return;
    out+=';--holo-'+k+'-img:'+holoGradient(v.set)
        +';--holo-'+k+'-a:'+v.a
        +';--holo-'+k+'-blend:'+v.blend;
  });
  return out;
}
function holoClasses(c){
  var h=holoOf(c); if(!h)return '';
  var out='';
  HOLO_SLOTS.forEach(function(k){
    if(!h[k])return;
    out+=' holo-'+k;
    /* Slot and set in the card's class: two of the animated slots are pseudo-elements, which cannot carry a class; 'pin' keeps the still ramp. */
    if(KW_HLFX[h[k].set]) out+=' holo-fx-'+k+'-'+h[k].set;
  });
  return out;
}
function holoLive(c){
  var h=(c&&variantOf(c).holo)||{}, out={};
  if(h.set!==undefined){ var m=holoOf(c)||{};
    HOLO_SLOTS.forEach(function(k){ out[k]=m[k]?Object.assign({},m[k]):{set:'none',a:0.35,blend:'screen'}; });
    return out; }
  /* checked whatever the record holds: both are written into the panel's markup */
  HOLO_SLOTS.forEach(function(k){
    var v=h[k]||{};
    out[k]={set:(v.set&&v.set!=='none'&&Object.prototype.hasOwnProperty.call(KW_HLSETS,v.set))?v.set:'none',
            a:numAttr(v.a,0.35,0,1),
            blend:(HOLO_BLENDS.indexOf(v.blend)>=0?v.blend:'screen')};
  });
  return out;
}

/* Shared records {id, name, src, xf, a}: a card holds only the id, per saga version (markIdOf), so editing one updates every card wearing it. */
var MARKS=[];
function marksAll(){return new Promise(function(res){try{var r=tx('marks','readonly').getAll();
  r.onsuccess=function(){res(r.result||[])};r.onerror=function(){res([])};}catch(_){res([]);}});}
function markById(id){ return MARKS.filter(function(m){return m.id===id;})[0]||null; }
function markXf(m){
  var t=(m&&m.xf)||{};
  var z=parseFloat(t.z), x=parseFloat(t.x), y=parseFloat(t.y), r=parseFloat(t.r);
  return {z:isFinite(z)?z:1, x:isFinite(x)?x:0, y:isFinite(y)?y:0, r:isFinite(r)?r:0};
}
/* The saga's own value wins; a mark an older model left on the card or a variant is still read, so it keeps showing. */
function markIdOf(c,sagaId){
  if(!c)return '';
  var f=c;
  try{
    if(typeof window.edCardForSaga==='function'){
      var sid=(sagaId!==undefined&&sagaId!==null)?sagaId
             :((typeof window.edDrawSaga==='function')?window.edDrawSaga(c)
              :(typeof window.edSagaOf==='function')?window.edSagaOf(c):null);
      if(sid)f=window.edCardForSaga(c,sid)||c;
    }
  }catch(_){}
  if(f.mark!==undefined)return f.mark||'';
  var v=visualTarget(c);
  return (v&&v.mark)||'';
}
function markLayerHTML(c){
  var mk=c&&markIdOf(c);
  var m=mk?markById(mk):null;
  if(!m||!m.src)return '';
  var t=markXf(m), a=numAttr(m.a,0.35,0,1);
  return "<div class='m-mark' style='background-image:"+e(cssUrl(m.src))+";opacity:"+a
    +";transform:translate("+t.x+"%,"+t.y+"%) rotate("+t.r+"deg) scale("+t.z+")'></div>";
}
window.edMarkList=function(){return MARKS.map(function(m){return {id:m.id,name:m.name};});};

function markEditingSaga(c){
  try{
    if(typeof window.edEditingSaga==='function')return window.edEditingSaga()||null;
  }catch(_){}
  return null;
}
function refreshMarkPicker(){
  var sel=document.getElementById('f-mark'); if(!sel)return;
  var c=curCard(); var cur=(c&&markIdOf(c,markEditingSaga(c)))||'';
  sel.innerHTML="<option value=''>— none —</option>"
    +MARKS.slice().sort(function(a,b){return String(a.name).localeCompare(String(b.name));})
      .map(function(m){return "<option value='"+e(m.id)+"'"+(cur===m.id?' selected':'')+">"
        +e(m.name||'Untitled')+"</option>";}).join('');
}
window.edSetCardMark=function(id){
  var c=curCard(); if(!c)return;
  /* the old per-variant copies cannot be allowed to shadow the new value */
  var vs=cardVariants(c)||[];
  vs.forEach(function(v){ if(v&&v.mark!==undefined)delete v.mark; });
  var sid=markEditingSaga(c);
  if(typeof window.edSetSagaField==='function'&&sid)window.edSetSagaField(c,sid,'mark',id||'');
  else if(id)c.mark=id; else delete c.mark;
  markDirty(c); renderPreview(c);
  try{ scheduleFace(); }catch(_){}
};
/* Every watermark a card can wear: its own, one per saga and one per variant (markIdOf picks the one drawn). */
function cardMarkIds(c){
  var out=[], at=function(o){ if(o&&typeof o.mark==='string'&&o.mark)out.push(o.mark); };
  if(!c)return out;
  at(c);
  var sf=c.sagaFields;
  if(sf&&typeof sf==='object')for(var k in sf)at(sf[k]);
  (cardVariants(c)||[]).forEach(at);
  return out;
}
function markUsedBy(id){
  return (window.CARDS||[]).filter(function(c){ return cardMarkIds(c).indexOf(id)>=0; });
}
function markDropFrom(c,id){
  if(c.mark===id)delete c.mark;
  var sf=c.sagaFields;
  if(sf)for(var k in sf){ if(sf[k]&&sf[k].mark===id)delete sf[k].mark; }
  (cardVariants(c)||[]).forEach(function(v){ if(v&&v.mark===id)delete v.mark; });
}
/* A read that set off before a write must not land after it: everything that changes MARKS bumps the counter, and a stale read is dropped. */
var _marksSeq=0;
function marksRefresh(){
  var seq=++_marksSeq;
  return marksAll().then(function(m){
    if(seq!==_marksSeq)return MARKS;
    MARKS=m; refreshMarkPicker(); return m;
  });
}
/* every card wearing it changes, so the whole catalog view is redrawn, not just the open card */
function marksChanged(){
  refreshMarkPicker();
  try{ scheduleFace(); }catch(_){}
  var c=curCard(); if(c)renderPreview(c);
  edMarkPanelRefresh();
}

/* A bulk tool changes only cards this copy may change: the next update would put a locked one back, so each tool skips them and says how many. */
function edLockedSafe(c){
  try{ return (typeof edCardLocked==='function')&&!!edCardLocked(c); }catch(_){ return false; }
}
function edSplitLocked(list){
  var open=[], locked=[];
  (list||[]).forEach(function(c){ (edLockedSafe(c)?locked:open).push(c); });
  return {open:open, locked:locked};
}
function edSkippedText(n){
  return n?(n+' read-only card(s) skipped (official, or from a source you follow) - '
    +'an update would put them back as they were'):'';
}

/* No native dialog on this path: stubbing window.confirm is how this project once lost the user's work (HANDOFF §0).
   The person types an exact phrase; Cancel, the backdrop and Escape all resolve false, never reject. */
/* Set only once a backup is known to be on disk. A download is not proof, as the page hears nothing after the click:
   it leaves _backupPending, and the gate asks the person to say they have the file (edGateBkHave). */
var _backupProof=null;
var _backupPending=null;
/* A backup goes stale after an edit (markDirty) or this long, and the gate says so rather than showing it as reassurance. */
var BACKUP_PROOF_MAX_AGE = 30*60*1000;
window.edBackupProofStale=function(){
  if(_backupProof) _backupProof.stale=true;
};
function backupProofAge(){
  return _backupProof ? (Date.now()-_backupProof.at) : 0;
}
/* still allowed, as refusing would trap someone who means to go on; it is said plainly instead */
function backupProofStale(){
  return !!_backupProof && (_backupProof.stale || backupProofAge()>BACKUP_PROOF_MAX_AGE);
}
function backupProofText(){
  if(!_backupProof)return '';
  var t=new Date(_backupProof.at);
  var sz=_backupProof.bytes>=1048576
    ? Math.max(1,Math.round(_backupProof.bytes/1048576))+' MB'
    : Math.max(1,Math.round(_backupProof.bytes/1024))+' KB';
  /* says which backup it saw: a card-only one covers what the gate guards, not the art */
  var mins=Math.floor(backupProofAge()/60000);
  return 'Backed up at '+String(t.getHours()+100).slice(1)+':'+String(t.getMinutes()+100).slice(1)
    +' — '+sz+', '+_backupProof.cards+' cards'
    +(_backupProof.dataOnly?' (card data only — art not included)':'')+'.'
    +(_backupProof.stale ? '  ⚠ Cards have been EDITED since this backup was taken.'
      : (backupProofStale() ? '  ⚠ This backup is '+mins+' minutes old.' : ''));
}
function backupPendingText(){
  if(!_backupPending)return '';
  var t=new Date(_backupPending.proof.at);
  return 'The backup "'+_backupPending.name+'" went to the browser as a download at '
    +String(t.getHours()+100).slice(1)+':'+String(t.getMinutes()+100).slice(1)
    +'. A page is not told whether a download was saved - look for it in your '
    +'downloads, then press "I have the file".';
}
/* opts.note: plain lines under "This destroys", such as the read-only cards a bulk tool skips */
window.edDangerGate=function(opts){
  opts=opts||{};
  var phrase=String(opts.phrase||'CONFIRM'), needBackup=!!opts.requireBackup;
  /* Every gate that asks for a backup also offers Skip Backup; the phrase is still asked for, and a skip is never remembered. */
  var skipped=false;
  /* Capitals start a phone's keyboard in capitals; a physical keyboard is unchanged, and the comparison in sync() stays exact (HANDOFF §82). */
  var caps=(phrase===phrase.toUpperCase())?" autocapitalize='characters' autocorrect='off'":'';
  return new Promise(function(resolve){
    var ov=document.createElement('div'), done=false;
    function finish(ok){
      if(done)return; done=true;
      document.removeEventListener('keydown',onKey,true);
      try{ if(typeof window.edModalClose==='function') window.edModalClose(ov); }catch(_){}
      if(ov.parentNode)ov.parentNode.removeChild(ov);
      resolve(!!ok);
    }
    ov.className='ed2-overlay'; ov.id='edGateOverlay';
    ov.innerHTML="<div class='ed2-modal ed2-gate'><div class='ed2-modal-head wh'>"
      +"<b class='gate-title wh-t'>"+e(opts.title||'Confirm')+"</b></div>"
      +"<div class='ed2-modal-body'>"
      +"<div class='gate-lose'><h5>This destroys</h5><ul>"
      +(opts.lose||[]).map(function(x){return "<li>"+e(x)+"</li>";}).join('')
      +"</ul></div>"
      +((opts.note&&opts.note.length)?("<div class='gate-keep'><ul>"
        +opts.note.map(function(x){return "<li>"+e(x)+"</li>";}).join('')+"</ul></div>"):'')
      +(needBackup?("<div class='gate-step' id='edGateBkRow'><span class='gate-num'>1</span>"
        +"<div class='gate-txt'><b>Write a backup first - or skip it.</b>"
        +"<div class='gate-note' id='edGateBkMsg' role='status'>No backup has been written from this page yet.</div>"
        +"<div class='gate-bk-btns'>"
          +"<button class='ed2-btn' id='edGateBk'>Export cards (.zip)</button>"
          +"<button class='ed2-btn' id='edGateBkHave' hidden>I have the file</button>"
          +"<button class='ed2-btn warn' id='edGateSkip' aria-pressed='false'>Skip Backup</button>"
        +"</div></div></div>"):'')
      +"<div class='gate-step'><span class='gate-num'>"+(needBackup?'2':'1')+"</span>"
      +"<div class='gate-txt'><b>Type <code>"+e(phrase)+"</code> to confirm.</b>"
      +"<input class='ed2-in gate-in' id='edGateIn' autocomplete='off' spellcheck='false'"+caps
        +" aria-label='Type "+e(phrase)+" to confirm'></div></div>"
      +"<div class='gate-actions'><button class='ed2-btn nb nb-red nb-l close-x' id='edGateNo'>Close &#10005;</button>"
      +"<button class='ed2-btn warn' id='edGateGo' disabled>"+e(opts.proceedLabel||'Proceed')+"</button>"
      +"</div></div></div>";
    document.body.appendChild(ov);

    var inp=ov.querySelector('#edGateIn'), go=ov.querySelector('#edGateGo');
    var bkBtn=ov.querySelector('#edGateBk'), bkMsg=ov.querySelector('#edGateBkMsg');
    var bkRow=ov.querySelector('#edGateBkRow'), bkHave=ov.querySelector('#edGateBkHave');
    var bkSkip=ov.querySelector('#edGateSkip');
    function sync(){
      /* compared exactly, no trim and no case folding */
      go.disabled=!(inp.value===phrase && (!needBackup || !!_backupProof || skipped));
      if(!bkRow)return;
      bkRow.classList.toggle('ok',!!_backupProof);
      bkRow.classList.toggle('skipped',skipped&&!_backupProof);
      if(bkSkip)bkSkip.setAttribute('aria-pressed',skipped?'true':'false');
      if(bkHave)bkHave.hidden=!(_backupPending&&!_backupProof);
      if(!bkMsg)return;
      if(_backupProof)bkMsg.textContent=backupProofText();
      else if(skipped)bkMsg.textContent='Backup skipped - this step goes ahead without one once the phrase is typed.';
      else if(_backupPending)bkMsg.textContent=backupPendingText();
      else bkMsg.textContent='No backup has been written from this page yet.';
    }
    inp.addEventListener('input',sync);
    if(bkBtn)bkBtn.addEventListener('click',function(){
      /* card data only, which is what these steps destroy; the gate reads _backupProof and _backupPending, not this promise, which resolves either way */
      bkBtn.disabled=true; bkBtn.textContent='Working…';
      var restore=function(){ bkBtn.disabled=false; bkBtn.textContent='Export cards (.zip)'; sync(); };
      try{ Promise.resolve(window.edExportBackupData()).then(restore,restore); }
      catch(_){ restore(); }
    });
    if(bkHave)bkHave.addEventListener('click',function(){
      if(_backupPending){ _backupProof=_backupPending.proof; _backupPending=null; }
      sync();
    });
    if(bkSkip)bkSkip.addEventListener('click',function(){ skipped=!skipped; sync(); });
    ov.querySelector('#edGateNo').addEventListener('click',function(){ finish(false); });
    go.addEventListener('click',function(){ if(!go.disabled)finish(true); });
    ov.addEventListener('click',function(ev){ if(ev.target===ov)finish(false); });
    function onKey(ev){
      if(ev.key==='Escape'){ ev.stopPropagation(); finish(false); }
      else if(ev.key==='Enter' && document.activeElement===inp && !go.disabled){
        ev.preventDefault(); finish(true); }
    }
    document.addEventListener('keydown',onKey,true);
    sync();
    /* A dialog with a focus trap (edModalOpen); its own Escape is off, as onKey must resolve the promise. Guarded, so the gate works without the catalog half. */
    try{
      if(typeof window.edModalOpen==='function')
        window.edModalOpen(ov,{label:opts.title||'Confirm', focus:inp, escape:false});
      else setTimeout(function(){ try{ inp.focus(); }catch(_){} },0);
    }catch(_){ setTimeout(function(){ try{ inp.focus(); }catch(_){} },0); }
  });
};

/* One modal, one press, every option saying what it does; it gates nothing (a destructive option carries its own edDangerGate). Resolves the key, or null. */
window.edChooseModal=function(opts){
  opts=opts||{};
  var choices=opts.choices||[];
  return new Promise(function(resolve){
    var ov=document.createElement('div'), done=false;
    function finish(key){
      if(done)return; done=true;
      document.removeEventListener('keydown',onKey,true);
      try{ if(typeof window.edModalClose==='function') window.edModalClose(ov); }catch(_){}
      if(ov.parentNode)ov.parentNode.removeChild(ov);
      resolve(key||null);
    }
    ov.className='ed2-overlay'; ov.id='edChooseOverlay';
    ov.innerHTML="<div class='ed2-modal ed2-gate'><div class='ed2-modal-head wh'>"
      +"<b class='gate-title wh-t'>"+e(opts.title||'Choose')+"</b></div>"
      +"<div class='ed2-modal-body'>"
      +(opts.body?("<div class='gate-note'>"+e(opts.body)+"</div>"):'')
      +"<div class='ed2-choices'>"
      +choices.map(function(c,i){
        return "<button class='ed2-choice"+(c.warn?' warn':'')+"' data-k='"+e(c.key)+"'"
          +" id='edChoice"+i+"'><b>"+e(c.label)+"</b>"
          +(c.detail?("<span>"+e(c.detail)+"</span>"):'')+"</button>";
      }).join('')
      +"</div>"
      +"<div class='gate-actions'><button class='ed2-btn nb nb-red nb-l close-x' id='edChooseNo'>Close &#10005;</button></div>"
      +"</div></div>";
    document.body.appendChild(ov);
    ov.querySelectorAll('.ed2-choice').forEach(function(b){
      b.addEventListener('click',function(){ finish(b.getAttribute('data-k')); });
    });
    ov.querySelector('#edChooseNo').addEventListener('click',function(){ finish(null); });
    ov.addEventListener('click',function(ev){ if(ev.target===ov)finish(null); });
    function onKey(ev){ if(ev.key==='Escape'){ ev.stopPropagation(); finish(null); } }
    document.addEventListener('keydown',onKey,true);
    try{
      if(typeof window.edModalOpen==='function')
        window.edModalOpen(ov,{label:opts.title||'Choose',
                               focus:ov.querySelector('.ed2-choice'), escape:false});
    }catch(_){}
  });
};

var _markOpen=null;
window.edOpenMarks=function(){
  var ov=document.getElementById('edMarkOverlay');
  if(!ov){
    ov=document.createElement('div'); ov.id='edMarkOverlay'; ov.className='ed2-overlay';
    ov.innerHTML="<div class='ed2-modal ed2-modal-wide'><div class='ed2-modal-head wh'>"
      +"<b class='wh-t'>Watermarks</b><button class='ed2-btn close-x nb nb-red nb-m wh-x' onclick='edCloseMarks()'>Close &#10005;</button></div>"
      +"<div id='edMarkBody' class='ed2-modal-body'></div></div>";
    document.body.appendChild(ov);
    ov.addEventListener('click',function(ev){ if(ev.target===ov)window.edCloseMarks(); });
    /* the list and its Delete carry the id as data-wm-* attributes, never inside a handler (HANDOFF §24.2) */
    ov.addEventListener('click',function(ev){
      var b=(ev.target&&ev.target.closest)?ev.target.closest('[data-wm-sel],[data-wm-del]'):null;
      if(!b||!ov.contains(b))return;
      if(b.hasAttribute('data-wm-del'))return window.edMarkDelete(b.getAttribute('data-wm-del'));
      window.edMarkSelect(b.getAttribute('data-wm-sel'));
    });
    ov.addEventListener('keydown',function(ev){
      if((ev.key==='Enter'||ev.key===' ')&&ev.target&&ev.target.hasAttribute&&ev.target.hasAttribute('data-wm-sel')){
        ev.preventDefault(); window.edMarkSelect(ev.target.getAttribute('data-wm-sel'));
      }
    });
  }
  ov.style.display='flex';
  edDialogOpen(ov,'Watermarks',function(){ window.edCloseMarks(); });
  marksRefresh().then(edMarkPanelRefresh);
};
window.edCloseMarks=function(){ var ov=document.getElementById('edMarkOverlay');
  if(ov){ ov.style.display='none'; edDialogClose(ov); } };
/* A page over the page is a dialog (edModalOpen): announced, Tab kept inside, Escape closes, focus given back; guarded if that half failed. */
function edDialogOpen(ov,label,onClose,focus){
  /* once per opening: a refresh of a page already up must not stack a second set of key handlers */
  if(!ov||ov.getAttribute('aria-modal')==='true')return;
  try{
    if(typeof window.edModalOpen==='function')
      window.edModalOpen(ov,{label:label,focus:focus,escape:true,onClose:onClose});
  }catch(_){}
}
function edDialogClose(ov){
  try{ if(typeof window.edModalClose==='function')window.edModalClose(ov); }catch(_){}
}
/* Drawn now, saved after: redrawing when the write returns rebuilds the panel under the caret of someone already typing. */
window.edMarkNew=function(){
  var rec={id:'wm_'+uid(),name:'New watermark',src:'',xf:{z:1,x:0,y:0,r:0},a:0.35};
  MARKS.push(rec); _markOpen=rec.id;
  _marksSeq++;                              /* see marksRefresh */
  edMarkPanelRefresh(); refreshMarkPicker();
  put('marks',rec).catch(function(){});
};
window.edMarkSelect=function(id){ _markOpen=id; edMarkPanelRefresh(); };
window.edMarkDelete=function(id){
  var m=markById(id); if(!m)return;
  var used=markUsedBy(id);
  if(!confirm('Delete "'+(m.name||'Untitled')+'"?'+(used.length?('\n\n'+used.length+' card(s) use it and will lose it.'):'')))return;
  MARKS=MARKS.filter(function(x){return x.id!==id;});
  used.forEach(function(c){ markDropFrom(c,id); markDirty(c); persistCard(c); });
  if(_markOpen===id)_markOpen=null;
  _marksSeq++;
  marksChanged();
  del('marks',id).catch(function(){});
};
/* Never a rebuild per keystroke, which threw away the input being typed in: write the model, move the picture, save a moment after typing stops. */
/* one timer per watermark, or a change to a second one inside 300 ms cancelled the first one's save */
var _markSaveTm={};
function markSaveSoon(m){
  if(!m||!m.id)return;
  clearTimeout(_markSaveTm[m.id]);
  _markSaveTm[m.id]=setTimeout(function(){
    delete _markSaveTm[m.id];
    put('marks',m).then(function(){
      refreshMarkPicker();
      try{ scheduleFace(); }catch(_){}
      var c=curCard(); if(c)renderPreview(c);
    },function(err){
      try{ toast('Watermark NOT saved - '+((err&&(err.name||err.message))||'unknown error')); }catch(_){}
    });
  },300);
}
window.edMarkSavesWaiting=function(){ return Object.keys(_markSaveTm).length; };
function markLiveSync(m){
  var t=markXf(m), a=(m.a==null?0.35:m.a);
  var st=document.querySelector('#edMarkBody .wm-stage-img');
  if(st){
    st.style.opacity=a;
    st.style.transform='translate('+t.x+'%,'+t.y+'%) rotate('+t.r+'deg) scale('+t.z+')';
  }
  var pair=function(k,v){
    ['wmR-'+k,'wmN-'+k].forEach(function(id){
      var el=document.getElementById(id);
      /* never write into the box being typed in: it moves the caret */
      if(el&&el!==document.activeElement&&parseFloat(el.value)!==v)el.value=v;
    });
  };
  pair('x',t.x); pair('y',t.y); pair('z',t.z); pair('r',t.r); pair('a',a);
  var nm=document.getElementById('wmNm-'+m.id);
  var lbl=m.name||'Untitled';
  if(nm&&nm.textContent!==lbl)nm.textContent=lbl;
}
window.edMarkSet=function(field,val){
  var m=markById(_markOpen); if(!m)return;
  /* kept as typed, empty included: "Untitled" is what an empty one is called, not what it becomes */
  if(field==='name')m.name=String(val||'');
  else if(field==='a')m.a=Math.max(0,Math.min(1,parseFloat(val)||0));
  else { m.xf=markXf(m); m.xf[field]=parseFloat(val)||0; }
  markLiveSync(m);
  markSaveSoon(m);
};
window.edMarkUpload=function(input){
  var m=markById(_markOpen), file=input&&input.files&&input.files[0];
  if(!m||!file)return;
  var rd=new FileReader();
  /* a data URL, not a Blob: watermarks are small and shared by reference, and PNG alpha survives untouched */
  rd.onload=function(ev){
    m.src=ev.target.result;
    _marksSeq++;
    edMarkPanelRefresh();
    put('marks',m).then(function(){
      refreshMarkPicker();
      try{ scheduleFace(); }catch(_){}
      var c=curCard(); if(c)renderPreview(c);
    });
  };
  rd.readAsDataURL(file);
};
window.edMarkPanelRefresh=function(){
  var host=document.getElementById('edMarkBody'); if(!host)return;
  /* never under the caret: a store read that set off before this panel opened can land mid-typing; markLiveSync keeps the screen in step */
  var a=document.activeElement;
  if(a&&host.contains(a)&&/^(INPUT|TEXTAREA|SELECT)$/.test(a.tagName))return;
  var m=markById(_markOpen);
  var list=MARKS.slice().sort(function(a,b){return String(a.name).localeCompare(String(b.name));})
    .map(function(x){
      var n=markUsedBy(x.id).length;
      return "<div class='wm-item"+(x.id===_markOpen?' on':'')+"' role='button' tabindex='0'"
        +" data-wm-sel='"+e(x.id)+"'>"
        +"<span class='wm-thumb'"+(x.src?" style='background-image:"+e(cssUrl(x.src))+"'":"")+"></span>"
        +"<span class='wm-nm' id='wmNm-"+e(x.id)+"'>"+e(x.name||'Untitled')+"</span>"
        +"<span class='wm-use'>"+n+"</span></div>";
    }).join('');
  var right;
  if(!m){
    right="<div class='ed2-art-empty'>Pick a watermark on the left, or add one.</div>";
  } else {
    var t=markXf(m), ma=numAttr(m.a,0.35,0,1);
    var ctl=function(k,label,mn,mx,st){
      return "<div class='ed2-xf'><label>"+label+"</label>"
        +"<input type='range' id='wmR-"+k+"' min='"+mn+"' max='"+mx+"' step='"+st+"' value='"+t[k]+"' "
        +"oninput=\"edMarkSet('"+k+"',this.value)\">"
        +"<input type='number' id='wmN-"+k+"' min='"+mn+"' max='"+mx+"' step='"+st+"' value='"+t[k]+"' "
        +"oninput=\"edMarkSet('"+k+"',this.value)\"></div>";
    };
    right="<div class='wm-edit'>"
      +"<div class='ed2-xf-row'><label class='wm-namelbl'>Name"
        +"<input class='ed2-input' value='"+e(m.name)+"' oninput=\"edMarkSet('name',this.value)\"></label></div>"
      /* the stage has the rules box's aspect (326x118 in classic), the only place a watermark is drawn */
      +"<div class='wm-stage'>"
        +(m.src?"<div class='wm-stage-img' style='background-image:"+e(cssUrl(m.src))+";opacity:"+ma
          +";transform:translate("+t.x+"%,"+t.y+"%) rotate("+t.r+"deg) scale("+t.z+")'></div>"
          :"<div class='wm-stage-empty'>no image</div>")
      +"</div>"
      +"<div class='ed2-xf-row'>"+ctl('x','X',-100,100,0.5)+ctl('y','Y',-100,100,0.5)+"</div>"
      +"<div class='ed2-xf-row'>"+ctl('z','Zoom',0.2,4,0.01)+ctl('r','Rotate',-180,180,1)+"</div>"
      +"<div class='ed2-xf-row'><div class='ed2-xf'><label>Alpha</label>"
        +"<input type='range' id='wmR-a' min='0' max='1' step='0.01' value='"+ma+"' "
        +"oninput=\"edMarkSet('a',this.value)\">"
        +"<input type='number' id='wmN-a' min='0' max='1' step='0.01' value='"+ma+"' "
        +"oninput=\"edMarkSet('a',this.value)\"></div></div>"
      +"<div class='tpl-opts'>"
        +"<label class='ed2-btn tiny'>Upload image<input type='file' accept='image/*' hidden onchange='edMarkUpload(this)'></label>"
        +"<button class='ed2-btn tiny warn' data-wm-del='"+e(m.id)+"'>Delete</button>"
      +"</div>"
      +"<i class='tpl-hint'>Drawn over the rules box only — inside the panel, never over the "
      +"pinlines — and under the text. Editing updates every card using it.</i>"
    +"</div>";
  }
  host.innerHTML="<div class='wm-wrap'><div class='wm-list'>"
    +"<button class='ed2-btn tiny on wm-add' onclick='edMarkNew()'>+ New watermark</button>"
    +(list||"<i class='tpl-hint'>None yet.</i>")+"</div><div class='wm-right'>"+right+"</div></div>";
};

