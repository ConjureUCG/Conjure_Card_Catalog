/* Part of the editor IIFE: what the markup calls must be put on window (HANDOFF §4). */

/* The two games share no sets: anything that differs by game goes in this table, never in a bare constant (HANDOFF §18.1). */
var GH_SOURCES={
  main:'https://raw.githubusercontent.com/ConjureUCG/Conjure_Card_Catalog/main/cards.json',
  rebirth:'https://raw.githubusercontent.com/ConjureUCG/Conjure_Rebirth_Catalog/main/cards.json'
};
/* GH_SOURCES must stay in step with OFFICIAL_REPOS and SITE_REPO in tools/github_sync.py (HANDOFF §17.6, §54.3). */
function ghMode(){ return window.REBIRTH ? 'rebirth' : 'main'; }
var GH_DEFAULT_SOURCE=GH_SOURCES[window.REBIRTH?'rebirth':'main']||'';
var GH_TREE_CHUNK=200;   /* GitHub answers 502 on a tree with everything in it */
/* Each picture is re-encoded and held in memory until the commit, and hundreds meet GitHub's limits part-way: more is refused before anything is sent. */
var GH_ART_CAP=150;
/* The key older copies stored the token under: nothing writes it now, and a record found there is taken for the visit and deleted (ghLoadSettings). */
var GH_SECRET='_secret_ghToken';

var GH_SOURCE='', GH_OWNER_MODE=false, GH_AUTOCHECK=true;
/* True once this profile is known to hold the whole official set (a bake captured, a check finding none missing, a full update applied); see ghWholeSetProblem. */
var GH_HAS_WHOLE_SET=false;
var GH_WEEKLY_LAST='';
var GH_REPO={owner:'',repo:'',branch:'main'};
/* Held for this visit only, never written to the database: after a reload it is pasted again (HANDOFF §1.2). */
var GH_TOKEN='';
/* The date the token was first given, never the token itself: kept until Forget it (HANDOFF §1.2). */
var GH_TOKEN_SINCE='';
/* Not stored: an "update available" left from an earlier visit would be stale. The Official source's state; the others' are in _srcState. */
var _ghState=null, _ghChecked=false, _ghBusy=false;
var OFFICIAL_INDEX=null;

/* One rule set for every source, the Official one included: only the copy that owns a source edits its cards, and every one updates the same way (HANDOFF §77.4). */
var SOURCES=[];            /* followed sources other than the Official one */
var _srcState={};
var _srcChecked={};
var _srcCheckedAt={};
var LAST_NEW_SAGA='';
var KW_EXTRA=[];

function ghOfficialRepo(){
  var m = /raw\.githubusercontent\.com\/([^\/]+)\/([^\/]+)\//i.exec(GH_SOURCES[ghMode()] || '');
  return m ? {owner:m[1].toLowerCase(), repo:m[2].toLowerCase()} : null;
}
/* (HANDOFF §10) */
function ghTokenHeld(){ return !!GH_TOKEN||!!GH_TOKEN_SINCE; }
function edOwnerUnlocked(){
  if(!ghTokenHeld()) return false;
  var off = ghOfficialRepo();
  if(!off) return false;
  return String(GH_REPO.owner || '').toLowerCase() === off.owner
      && String(GH_REPO.repo || '').toLowerCase() === off.repo;
}
window.edOwnerUnlocked = edOwnerUnlocked;
function repoOfUrl(u){
  u=String(u||'');
  var m=/raw\.githubusercontent\.com\/([^\/]+)\/([^\/]+)\//i.exec(u)
     || /cdn\.jsdelivr\.net\/gh\/([^\/@]+)\/([^\/@]+)/i.exec(u)
     || /github\.com\/([^\/]+)\/([^\/?#]+)/i.exec(u);
  return m ? {owner:m[1].toLowerCase(), repo:m[2].toLowerCase().replace(/\.git$/,'')} : null;
}
function edOwnsSource(url){
  if(!ghTokenHeld()) return false;
  var r=repoOfUrl(url);
  if(!r) return false;
  return String(GH_REPO.owner||'').toLowerCase()===r.owner
      && String(GH_REPO.repo||'').toLowerCase()===r.repo;
}
window.edOwnsSource = edOwnsSource;
function ownsGroupKey(k){
  if(!k||k===GROUP_LOCAL) return true;
  if(k===GROUP_OFFICIAL) return edOwnerUnlocked();
  if(String(k).indexOf('table:')===0) return false;
  return edOwnsSource(k);
}
/* Every saga the card is in counts, not the primary alone. */
function cardForeignKey(c){
  if(!c||c.local||typeof sagaIdsOf!=='function') return '';
  var ids=sagaIdsOf(c);
  for(var i=0;i<ids.length;i++){
    /* a saga with no record yet locks nothing - as in edOfficialCard */
    var sg=sagaById(ids[i]);
    if(!sg) continue;
    var k=groupKeyOf(sg);
    if(!ownsGroupKey(k)) return k;
  }
  return '';
}
function edCardLocked(c){
  return !!cardForeignKey(c);
}
window.edCardLocked = edCardLocked;
function edLockedToast(c){
  var k=c?cardForeignKey(c):'';
  try{ toast(k===GROUP_OFFICIAL ? 'Official cards are read-only' : 'This card is read-only'); }catch(_){}
}
window.edLockedToast = edLockedToast;

function ghSettingsFrom(r){
  /* Any of these can be missing on an older profile, so each has a default. */
  GH_SOURCE=(r&&r.src)||GH_DEFAULT_SOURCE;
  GH_OWNER_MODE=!!(r&&r.owner);
  GH_AUTOCHECK=(r&&r.autoCheck!=null)?!!r.autoCheck:true;
  var rp=(r&&r.repo)||null;
  if(rp&&typeof rp==='object')GH_REPO={owner:rp.owner||'',repo:rp.repo||'',branch:rp.branch||'main'};
  /* A token pasted while the settings loaded is kept, as it is held nowhere else; r.token is only ever one an older copy stored. */
  if(!GH_TOKEN)GH_TOKEN=(r&&r.token)||'';
  GH_TOKEN_SINCE=(r&&r.since)||'';
  if(GH_TOKEN&&!GH_TOKEN_SINCE){
    GH_TOKEN_SINCE=new Date().toISOString();
    setMetaSafe('ghTokenSince',GH_TOKEN_SINCE);
  }
}
/* Whole days, midnight to midnight, so "1 day" means yesterday rather than 24 hours ago. */
function ghTokenDays(){
  if(!GH_TOKEN_SINCE)return null;
  var d=new Date(GH_TOKEN_SINCE); if(isNaN(d.getTime()))return null;
  var a=new Date(d.getFullYear(),d.getMonth(),d.getDate());
  var n=new Date(); var b=new Date(n.getFullYear(),n.getMonth(),n.getDate());
  return Math.max(0,Math.round((b-a)/86400000));
}
window.edGhTokenDays=function(){ return ghTokenDays(); };
function ghLoadSettings(){
  /* v[5] stays an empty slot so the indexes keep their places: the weekly run has no switch (ghWeeklyMaybe). */
  return Promise.all([getMeta('ghSourceUrl'),getMeta('ghOwnerMode'),
                      getMeta('ghRepo'),getMeta(GH_SECRET),getMeta('ghAutoCheck'),
                      Promise.resolve(null),getMeta('ghWeeklyLast'),getMeta('ghTokenSince'),
                      getMeta('officialIds'),getMeta('bakeCaptured'),
                      getMeta('sources'),getMeta('lastNewSaga')])
    .then(function(v){
      SOURCES=Array.isArray(v[10])?v[10].filter(function(s){ return s&&s.url; }):[];
      LAST_NEW_SAGA=v[11]||'';
      srcMigrateLinks();
      ghSettingsFrom({src:v[0],owner:v[1],repo:v[2],token:v[3],autoCheck:v[4],since:v[7]});
      if(v[3]!=null)ghDropStoredToken();
      GH_WEEKLY_LAST=v[6]||'';
      /* the stored official index, unless a fetched one has already arrived */
      if(!OFFICIAL_IDS&&Array.isArray(v[8])&&v[8].length)OFFICIAL_IDS=v[8];
      GH_HAS_WHOLE_SET=!!v[9];
      return ghRestoreOfficial();
    });
}
/* Kept for the browser console (HANDOFF §10, O38); the page's Reset (edGhResetSource) is the other writer of ghSourceUrl. */
window.edGhSetSource=function(u){
  GH_SOURCE=String(u||'').trim(); _ghChecked=false; _ghState=null;
  setMetaSafe('ghSourceUrl',GH_SOURCE,'the source repository');
  ghBadge(null);
  edRenderOwnerSync();
};
/* Cleared rather than set to today's address, so a later build's built-in address is the one that counts. */
window.edGhResetSource=function(){
  GH_SOURCE=GH_DEFAULT_SOURCE; _ghChecked=false; _ghState=null;
  setMetaSafe('ghSourceUrl','','the source repository');
  ghBadge(null);
  edRenderOwnerSync();
};
window.edGhSetOwnerMode=function(on){
  GH_OWNER_MODE=!!on; setMetaSafe('ghOwnerMode',GH_OWNER_MODE);
  /* The diff depends on this switch, so the package in hand is diffed again; no refetch. */
  if(_ghState&&_ghState.pkg){
    _ghState.diff=ghDiff(ghIncoming(_ghState.pkg.cards,srcOfficial()),_ghState.ctx);
  }
  ghBadgeRefresh();
  edRenderOwnerSync();
};
window.edGhSetAutoCheck=function(on){
  GH_AUTOCHECK=!!on; setMetaSafe('ghAutoCheck',GH_AUTOCHECK);
};
/* For the checks: ghLoadSettings lands after the page is usable and overwrites a switch set before it, so a check reads back what is in force. */
window.edGhSwitches=function(){
  return {ownerMode:!!GH_OWNER_MODE, autoCheck:!!GH_AUTOCHECK, source:GH_SOURCE||''};
};
window.edGhSetRepo=function(field,val,fromPage){
  if(field!=='owner'&&field!=='repo'&&field!=='branch')return;
  GH_REPO[field]=String(val||'').trim();
  setMetaSafe('ghRepo',{owner:GH_REPO.owner,repo:GH_REPO.repo,branch:GH_REPO.branch||'main'},'the publish target');
  if(fromPage)ghCheckTarget();
};
/* Checked when saved, not first at Publish; the line is kept here so the next drawing of the page shows it, as the publish line is. */
var _ghTargetMsg='', _ghTargetTimer=0, _ghTargetSeq=0;
function ghTargetLine(m){
  _ghTargetMsg=String(m||'');
  var el=document.getElementById('ghTargetMsg'); if(el)el.textContent=_ghTargetMsg;
}
function ghCheckTarget(){
  clearTimeout(_ghTargetTimer);
  var seq=++_ghTargetSeq;
  var bad=(GH_REPO.owner||GH_REPO.repo)?ghRepoProblem():'';
  if(bad||!GH_REPO.owner||!GH_REPO.repo||!GH_TOKEN){ ghTargetLine(bad); return Promise.resolve(bad); }
  var blocked=syncBlockedReason(GH_API);
  if(blocked){ ghTargetLine(blocked); return Promise.resolve(blocked); }
  return new Promise(function(res){
    _ghTargetTimer=setTimeout(function(){ res(ghCheckTargetNow(seq)); },400);
  });
}
function ghCheckTargetNow(seq){
  var name=GH_REPO.owner+'/'+GH_REPO.repo, br=GH_REPO.branch||'main';
  var say=function(m){ if(seq===_ghTargetSeq)ghTargetLine(m); return m; };
  say('Checking '+name+'…');
  return ghApi('GET','').then(function(repo){
    var push=!!(repo&&repo.permissions&&repo.permissions.push);
    var line=name+(push?': this token can push here':': this token cannot push here');
    return ghApi('GET','/git/ref/heads/'+ghRefPath(br)).then(function(){
      return say(line+', branch "'+br+'".');
    },function(err){
      var st=err&&err.status;
      return say(line+(st===409?' - the repository is empty.'
        :st===404?' - no branch "'+br+'" (the default branch is "'+String((repo&&repo.default_branch)||'')+'").'
        :'.'));
    });
  },function(err){
    return say(name+': '+((err&&err.message)||err));
  });
}
window.edGhCheckTarget=function(){ return ghCheckTarget(); };
function ghDropStoredToken(){
  return del('meta',GH_SECRET).catch(function(err){
    try{ console.warn('[conjure] the saved GitHub token was not removed:',err); }catch(_){}
  });
}
window.edGhSetToken=function(val,fromPage){
  /* The token is never written back into the markup, nor into the database (HANDOFF §1.2). */
  var t=String(val||'').trim();
  /* A token pasted again after a reload keeps its date; a different one replacing the token held now starts it again. */
  var since=!t?'':(!GH_TOKEN_SINCE||(GH_TOKEN&&GH_TOKEN!==t))?new Date().toISOString():GH_TOKEN_SINCE;
  GH_TOKEN=t;
  ghDropStoredToken();
  GH_TOKEN_SINCE=since;
  setMetaSafe('ghTokenSince',GH_TOKEN_SINCE,"the access token's date");
  toast(GH_TOKEN?'Token kept until this page closes':'Token cleared');
  if(fromPage||!GH_TOKEN)ghCheckTarget();
  edRenderOwnerSync();
};
window.edGhForgetToken=function(){ window.edGhSetToken(''); };


function srcKeyOf(url){ return normGroupUrl(url); }
function srcOfficial(){ return {key:GROUP_OFFICIAL, url:GH_SOURCE||GH_DEFAULT_SOURCE, official:true}; }
function srcWrap(s){ if(s&&!s.key)s.key=srcKeyOf(s.url); return s; }
function srcAll(){ return [srcOfficial()].concat(SOURCES.map(srcWrap)); }
function srcByKey(key){
  if(!key) return null;
  if(key===GROUP_OFFICIAL) return srcOfficial();
  for(var i=0;i<SOURCES.length;i++) if(srcKeyOf(SOURCES[i].url)===key) return srcWrap(SOURCES[i]);
  return null;
}
function srcOwned(src){ return !!src&&(src.official ? edOwnerUnlocked() : edOwnsSource(src.url)); }
function srcState(src){ return !src?null:(src.official ? _ghState : (_srcState[src.key]||null)); }
function srcSetState(src,st){ if(src.official) _ghState=st; else _srcState[src.key]=st; }
function srcLabel(src){ return src.official ? 'the source' : groupLabel(src.url); }
function srcSave(){
  setMetaSafe('sources',SOURCES.map(function(s){
    return {url:s.url, added:s.added||'', lastCheck:s.lastCheck||'', lastSync:s.lastSync||'',
            skip:(s.skip||[]).slice()};
  }),'the followed sources');
}
function srcMigrateLinks(){
  var add=false, off=normGroupUrl(GH_DEFAULT_SOURCE), cur=normGroupUrl(GH_SOURCE);
  (SAGAS||[]).forEach(function(sg){
    var u=sg&&sg.source&&sg.source.url; if(!u) return;
    var k=srcKeyOf(u);
    if(k===off||k===cur||srcByKey(k)) return;
    SOURCES.push({url:u, added:new Date().toISOString(),
                  lastCheck:sg.source.lastCheck||'', lastSync:sg.source.lastSync||'', skip:[]});
    add=true;
  });
  if(add) srcSave();
}
/* A followed saga you deleted is not taken again (sagaDeletable/_deleteSaga). */
function srcSkipSaga(key,id){
  var s=srcByKey(key);
  if(!s||s.official) return;
  s.skip=s.skip||[];
  if(s.skip.indexOf(id)<0){ s.skip.push(id); srcSave(); }
}
function srcRender(){
  try{ edRenderOwnerSync(); }catch(_){}
  try{ if(typeof window.edRenderSagaPage==='function') window.edRenderSagaPage(); }catch(_){}
}
function srcDefaultSaga(src,pkg,index){
  if(src.official) return BUILTIN_SAGA;
  if(pkg&&pkg.zip){ var m=pkg.man||{}; return m.id||m.name||'Imported'; }
  if(index&&index.length&&index[0]&&index[0].id) return index[0].id;
  var r=repoOfUrl(src.url);
  return r ? r.repo : 'Imported';
}
/* Before anything compares the package: a .zip carries no membership, and a card naming no saga goes to the source's own. */
function srcNormalizeCards(pkg,src,index){
  var def=srcDefaultSaga(src,pkg,index);
  (pkg.cards||[]).forEach(function(c){
    if(!c) return;
    if(pkg.zip){ c.sagaIds=[def]; c.sagaId=def; delete c.sagaFields; return; }
    var has=(Array.isArray(c.sagaIds)&&c.sagaIds.filter(Boolean).length)||c.sagaId||c.saga;
    if(!has) c.sagaId=def;
  });
}
function srcCtx(src,pkg,index){
  var set={}, names={};
  (index||[]).forEach(function(s){ if(s&&s.id){ set[s.id]=1; names[s.id]=s.name||s.id; } });
  if(pkg&&pkg.zip){
    var m=pkg.man||{}, id=m.id||m.name;
    if(id){ set[id]=1; names[id]=m.name||id; }
  }
  ((pkg&&pkg.cards)||[]).forEach(function(c){ if(c) sagaIdsOf(c).forEach(function(id){ set[id]=1; }); });
  var skip={}; (src.skip||[]).forEach(function(id){ skip[id]=1; });
  return {key:src.key, url:src.url, official:!!src.official, table:src.table||'',
          sagaSet:set, names:names, skip:skip, owned:srcOwned(src),
          cids:srcCidsOf(pkg&&pkg.cards)};
}
/* Claimed only when it has no cards here yet, or every card in it here is the source's by id: names alone can match a saga and card of yours.
   Run on the check and again after an apply, when the copies have taken the published ids. */
function srcAllTheSources(id,o){
  var cids={};
  ((o&&o.cids)||[]).forEach(function(x){ cids[x]=1; });
  return sagaCards(id).every(function(c){ return c&&!c.local&&c.cid&&cids[c.cid]; });
}
function srcCidsOf(cards){
  return (cards||[]).map(function(c){ return c&&c.cid; }).filter(Boolean);
}
/* Every saga the Official source sends is Official, even one its index leaves out. */
function srcClaimOfficial(o){
  var ids=Object.keys((o&&o.sagaSet)||{});
  if(!ids.length) return;
  var list=(OFFICIAL_IDS||bakedSagaIds()).slice(), add=false;
  ids.forEach(function(id){
    if(list.indexOf(id)>=0) return;
    var sg=sagaById(id);
    if(sg&&groupKeyOf(sg)!==GROUP_LOCAL&&String(groupKeyOf(sg)).indexOf('table:')!==0) return;
    if(!srcAllTheSources(id,o)) return;
    list.push(id); add=true;
  });
  if(add){ OFFICIAL_IDS=list; setMetaSafe('officialIds',OFFICIAL_IDS); }
}
/* A followed source's sagas are filed under it, a table copy of one included. */
function srcClaimSagas(o){
  if(!o||o.official){ srcClaimOfficial(o); return Promise.resolve(); }
  var changed=[];
  Object.keys(o.sagaSet).forEach(function(id){
    var sg=sagaById(id); if(!sg) return;
    var k=groupKeyOf(sg);
    if(k===o.key) return;
    var claim=(k.indexOf('table:')===0)
      || (k===GROUP_LOCAL && srcAllTheSources(id,o));
    if(!claim) return;
    sg.source=Object.assign({},sg.source||{},{url:o.url});
    delete sg.source.table;
    changed.push(sg);
  });
  return Promise.all(changed.map(sagaPut));
}

function ghDiff(incoming,o){
  /* By id first (cardIndex): matched by saga and name, a card the source renamed would read as one added and one left behind. */
  var mine=(window.CARDS||[]), ix=cardIndex(mine);
  var held={}; mine.forEach(function(c){ if(c&&c.cid) held[c.cid]=1; });
  var added=0, changed=0, same=0, skipped=0, bySaga={};
  (incoming||[]).forEach(function(nc){
    if(!nc||!nc.name)return;
    /* the same decisions importCardRows makes, in the same order, so the count is what an apply does */
    if(o&&!srcSagasOf(nc,o).length){ skipped++; return; }
    var sid=sagaIdOf(nc);
    bySaga[sid]=(bySaga[sid]||0)+1;
    var at=ix.at(nc), ex=(at==null)?null:mine[at];
    if(ex&&o&&ex.local&&!(nc.cid&&ex.cid===nc.cid))ex=null;
    if(ex&&o&&srcBelongsElsewhere(ex,o.key)){ skipped++; return; }
    if(!ex){ added++; return; }
    /* a copy still known by an id of its own takes the published one, so every copy converges on one id */
    var adopt=!!(o&&nc.cid&&ex.cid!==nc.cid&&!held[nc.cid]);
    if(adopt||cardDiffers(ex,nc,o)||ghTestDiffers(ex,nc))changed++; else same++;
  });
  var removed=0;
  try{ removed=o?srcGoneCards(incoming,o).length:0; }catch(_){}
  return {added:added,changed:changed,removed:removed,same:same,skipped:skipped,
          total:(incoming||[]).length,bySaga:bySaga};
}

/* Derived from the cards.json address, not stored, so a person only ever pastes one link. */
function ghIndexUrl(src){
  var u=String(src||'');
  return /cards\.json(\?.*)?$/i.test(u) ? u.replace(/cards\.json(\?.*)?$/i,'sagas.json')
       : u.replace(/\/[^\/]*$/,'/sagas.json');
}
/* Optional: a repository with no sagas.json leaves the caller grouping the cards by sagaIdOf. */
/* The open and the check ask for the same address within seconds and share one request; every read is no-cache, so an unchanged file is not downloaded again. */
var _ghIdxMemo=null;
function ghFetchIndex(src){
  var url=ghIndexUrl(src);
  if(!url||syncBlockedReason(url))return Promise.resolve(null);
  var now=Date.now();
  if(_ghIdxMemo&&_ghIdxMemo.url===url&&now-_ghIdxMemo.at<10000)return _ghIdxMemo.p;
  var p=fetch(url,{cache:'no-cache'}).then(function(r){
    if(!r.ok)return null;
    return r.json().then(function(j){ return Array.isArray(j)?j:null; },function(){ return null; });
  },function(){ return null; });
  _ghIdxMemo={url:url,at:now,p:p};
  return p;
}
/* Sagas the official index lists are Official before their cards arrive, so a new saga reaches everyone's dropdown without a link. */
function ghRefreshOfficialIndex(){
  return ghFetchIndex(GH_DEFAULT_SOURCE).then(function(list){
    if(!list)return null;
    try{
      OFFICIAL_IDS=list.map(function(s){ return s&&s.id; }).filter(Boolean);
      OFFICIAL_INDEX=list;
      /* stored, so a published saga stays Official on the next open when the index cannot be fetched */
      setMetaSafe('officialIds',OFFICIAL_IDS);
    }catch(_){}
    try{ if(typeof window.edRenderSagaPage==='function')window.edRenderSagaPage(); }catch(_){}
    return list;
  });
}

/* Writes nothing but the source's state and its last-checked time. */
function ghCheckSource(src){
  var url=src&&src.url;
  if(!url){ srcSetState(src,{err:'No source address set.'}); srcRender(); return Promise.resolve(); }
  var blocked=syncBlockedReason(url);
  if(blocked){ srcSetState(src,{err:blocked}); srcRender(); return Promise.resolve(); }
  srcSetState(src,{busy:true}); srcRender();
  return fetchSource(url).then(function(res){
    if(res.zip){
      if(src.official)throw new Error('that address returns a saga .zip, not a cards.json. '
        +'Follow it from the Follow row on the Sagas page instead.');
      /* the check unpacks no art: that would be a write to the art store */
      return _readSagaZip(new Blob([res.buf]),{skipArt:true})
        .then(function(pk){ pk.buf=res.buf; pk.zip=true; return pk; });
    }
    return pkgFromJson(res.json);
  }).then(function(pkg){
    if(!pkg.cards||!pkg.cards.length)throw new Error('no cards in what came back.');
    /* the owner's copy reads the Test cards too, so they follow the publisher between machines */
    return ghFetchTesting(url,src).then(function(t){
      if(t.length)pkg.cards=pkg.cards.concat(t);
      return pkg;
    });
  }).then(function(pkg){
    return (pkg.zip?Promise.resolve(null):ghFetchIndex(url)).then(function(index){
      srcNormalizeCards(pkg,src,index);
      /* before the diff: no card the source carries was made here */
      try{ ghClearPublishedLocal(pkg.cards,src); }catch(_){}
      var ctx=srcCtx(src,pkg,index);
      var now=new Date().toISOString();
      _srcCheckedAt[src.key]=Date.now();
      var st={pkg:pkg, ctx:ctx, index:index, checked:now,
              diff:ghDiff(ghIncoming(pkg.cards,src),ctx)};
      srcSetState(src,st);
      if(src.official){
        if(!st.diff.added&&!window.REBIRTH&&!GH_HAS_WHOLE_SET
           &&normGroupUrl(url)===normGroupUrl(GH_DEFAULT_SOURCE)){
          GH_HAS_WHOLE_SET=true;
          setMetaSafe('bakeCaptured',{at:now,fromSource:true});
        }
        srcClaimOfficial(ctx);
      } else {
        src.lastCheck=now; srcSave();
      }
      ghBadgeRefresh();
      srcRender();
      /* Never folded into the card diff: the look is its own gated press (edGhApplyLook), or applied after the check while Use Default Look is on. */
      if(src.official) return ghFetchLook(url).then(function(lk){
        var s2=srcState(src);
        if(s2&&!s2.err){ s2.lookPkg=lk; edRenderOwnerSync(); }
      });
    });
  }).catch(function(err){
    srcSetState(src,{err:(err&&err.message)||String(err)});
    srcRender();
  });
}
window.edGhCheck=function(){
  return ghCheckSource(srcOfficial()).then(function(){ return ghSyncOfficialExtras(false); });
};
window.edGhCheckSource=function(key){
  var s=srcByKey(key||GROUP_OFFICIAL);
  if(!s) return Promise.resolve(null);
  return s.official ? window.edGhCheck() : ghCheckSource(s);
};

/* Nothing that arrives from a source was made here: taken as `local`, a card is editable and never removed when its publisher deletes it. */
function ghNotLocal(cards){
  return (cards||[]).map(function(c){
    if(!c||!c.local)return c;
    var o=JSON.parse(JSON.stringify(c)); delete o.local; return o;
  });
}
/* A card from outside takes the shape the app draws: a field of the wrong kind is left out, and both type lists are always there. */
var SRC_LIST_FIELDS=['colors','superTypes','subTypes','sagaIds','orbs','variants'];
var SRC_TEXT_FIELDS=['name','manaCost','cmc','attack','health','arcane','ruleText','imageUrl','art',
                     'saga','sagaId','revision','artist','designer','lastUpdated','cid','flavor',
                     'variant','mark'];
function srcTextList(v){
  return (Array.isArray(v)?v:[]).filter(function(x){
    return typeof x==='string'||(typeof x==='number'&&isFinite(x)); }).map(String);
}
function srcObjList(v){
  return (Array.isArray(v)?v:[]).filter(function(x){ return x&&typeof x==='object'&&!Array.isArray(x); });
}
function srcCardShapeOk(c){
  if(!Array.isArray(c.superTypes)||!Array.isArray(c.subTypes))return false;
  var i;
  for(i=0;i<SRC_LIST_FIELDS.length;i++){
    var k=SRC_LIST_FIELDS[i], v=c[k];
    if(v===undefined)continue;
    if(!Array.isArray(v))return false;
    var objs=(k==='orbs'||k==='variants');
    for(var j=0;j<v.length;j++){
      if(objs?!(v[j]&&typeof v[j]==='object'&&!Array.isArray(v[j])):typeof v[j]!=='string')return false;
    }
  }
  for(i=0;i<SRC_TEXT_FIELDS.length;i++){
    var t=c[SRC_TEXT_FIELDS[i]];
    if(t!==undefined&&typeof t!=='string')return false;
  }
  if(c.sagaFields!==undefined&&!(c.sagaFields&&typeof c.sagaFields==='object'&&!Array.isArray(c.sagaFields)))return false;
  return true;
}
function srcNormCard(c){
  if(!c||typeof c!=='object'||Array.isArray(c))return null;
  if(srcCardShapeOk(c))return c;
  var o=JSON.parse(JSON.stringify(c));
  SRC_LIST_FIELDS.forEach(function(k){
    if(o[k]===undefined&&k!=='superTypes'&&k!=='subTypes')return;
    o[k]=(k==='orbs'||k==='variants')?srcObjList(o[k]):srcTextList(o[k]);
  });
  SRC_TEXT_FIELDS.forEach(function(k){
    var v=o[k];
    if(v===undefined||typeof v==='string')return;
    if((typeof v==='number'&&isFinite(v))||typeof v==='boolean')o[k]=String(v);
    else delete o[k];
  });
  if(o.sagaFields!==undefined&&!(o.sagaFields&&typeof o.sagaFields==='object'&&!Array.isArray(o.sagaFields)))
    delete o.sagaFields;
  return o;
}
function srcNormCards(cards){
  return (Array.isArray(cards)?cards:[]).map(srcNormCard).filter(Boolean);
}
function ghIncoming(cards,src){
  cards=ghNotLocal(srcNormCards(cards));
  /* Owner mode keeps this disk's art pointers for a set published from here, or the CDN's would replace the masters;
     applied before the diff as well, or every card would read as changed for ever. */
  var keep=GH_OWNER_MODE&&(!src||src.official||srcOwned(src));
  return keep?ghKeepLocalArt(cards):cards;
}
/* Copy the local pointer in, never strip the incoming one: `variants` is one field copied whole, and a stripped one arrives with no pictures (HANDOFF §56.7). */
function ghKeepLocalArt(cards){
  var mine=(window.CARDS||[]), ix=cardIndex(mine);
  return (cards||[]).map(function(c){
    var o=JSON.parse(JSON.stringify(c));
    var at=ix.at(o), ex=(at==null)?null:mine[at];
    if(!ex)return o;
    var exV=ex.variants||[];
    artBearers(o).forEach(function(b,i){
      var loc;
      if(i===0) loc=ex;
      else {
        var v=b;
        loc=(v.id!=null)?exV.filter(function(x){ return x&&x.id===v.id; })[0]:null;
        if(!loc&&v.id==null)loc=exV[i-1];
      }
      if(!loc)return;
      b.imageUrl=loc.imageUrl||'';
      b.art=loc.art||'';
    });
    return o;
  });
}

/* Only the copy that owns the source reads testing.json; everywhere else this is false. */
function ghTestDiffers(ex,nc){
  return !!(ex&&ex.testing)!==!!(nc&&nc.testing);
}
/* An import never clears `testing`, so after an Update on the owning copy a card the source lists as ordinary stops being a Test card here. */
function ghSyncTestState(cards,src){
  try{ if(!srcOwned(src||srcOfficial()))return Promise.resolve([]); }catch(_){ return Promise.resolve([]); }
  var mine=(window.CARDS||[]), ix=cardIndex(mine), off=[];
  (cards||[]).forEach(function(nc){
    if(!nc||!nc.name||nc.testing)return;
    var at=ix.at(nc), ex=(at==null)?null:mine[at];
    if(ex&&ex.testing){ delete ex.testing; markDirty(ex); off.push(ex); }
  });
  return Promise.all(off.map(function(c){ return persistCard(c); })).then(function(){ return off; });
}
/* The cards an update would overwrite that this machine may edit: zero means it costs nothing, and nothing asks. */
function ghWouldOverwriteOwnWork(cards,o){
  var mine=(window.CARDS||[]), ix=cardIndex(mine);
  var n=0;
  (cards||[]).forEach(function(nc){
    if(!nc||!nc.name)return;
    if(o&&!srcSagasOf(nc,o).length)return;
    var at=ix.at(nc), ex=(at==null)?null:mine[at];
    /* the refusals importCardRows makes: no card made here matched by name, never another source's card */
    if(ex&&o&&ex.local&&!(nc.cid&&ex.cid===nc.cid))return;
    if(ex&&o&&srcBelongsElsewhere(ex,o.key))return;
    if(!ex||!(cardDiffers(ex,nc,o)||ghTestDiffers(ex,nc)))return;
    var locked=false;
    try{ locked=!!edCardLocked(ex); }catch(_){}
    if(!locked)n++;
  });
  return n;
}
/* Only cards surely the source's to take: never on a copy that owns it, only from sagas it published this time, never `local` or Test.
   More than a tenth of its cards here, and more than 20, is a broken publish and removes nothing (HANDOFF §5). */
function srcGoneCards(incoming,o){
  if(!o||o.owned)return [];
  if(o.official&&GH_OWNER_MODE)return [];
  var inc=(incoming||[]).filter(function(c){ return c&&c.name; });
  if(!inc.length)return [];
  var ix=cardIndex(inc), from=0;
  var gone=(window.CARDS||[]).filter(function(c){
    if(!c||c.local||c.__deleted||c.testing)return false;
    var mine=sagaIdsOf(c).filter(function(id){ return groupKeyOfId(id)===o.key; });
    if(!mine.length)return false;
    from++;
    if(!mine.some(function(id){ return o.sagaSet[id]; }))return false;
    return !ix.has(c);
  });
  if(gone.length>20&&gone.length>from*0.1){
    try{ console.warn('[conjure] '+srcLabelKey(o.key)+' no longer lists '+gone.length+' of '+from
      +' of its cards - treated as a broken publish; nothing removed'); }catch(_){}
    return [];
  }
  return gone;
}
function srcLabelKey(k){ return k===GROUP_OFFICIAL?'the official source':groupLabel(k); }
/* A deletion marker is stored so a built-in copy stays hidden on the next load (ed2_boot.js); a card also in another saga only loses the source's. */
function srcRemoveGone(gone,o){
  if(!gone||!gone.length)return Promise.resolve(0);
  var drop={}, kept=[], tombs=[];
  gone.forEach(function(c){
    var rest=sagaIdsOf(c).filter(function(id){ return groupKeyOfId(id)!==o.key; });
    if(rest.length){
      sagaIdsOf(c).filter(function(id){ return rest.indexOf(id)<0; })
        .forEach(function(id){ removeSagaMembership(c,id); });
      srcTouched(c); kept.push(c);
      return;
    }
    drop[c.__id]=1;
    tombs.push({id:c.id||uid(),__id:c.__id,name:c.name,cid:cardCid(c),
                sagaId:sagaIdOf(c),saga:c.saga,__deleted:true});
  });
  window.CARDS=(window.CARDS||[]).filter(function(x){ return !drop[x.__id]; });
  if(tombs.length)srcTouched(null);
  return Promise.all(tombs.map(persistCard).concat(kept.map(persistCard)))
    .then(function(){ return tombs.length+kept.length; });
}
/* the Official source's, under the old name the checks and edGhGoneCards use */
function ghGoneCards(incoming){
  var st=_ghState;
  return srcGoneCards(incoming,(st&&st.ctx)||srcCtx(srcOfficial(),{cards:incoming},null));
}
window.edGhGoneCards=function(){
  var st=_ghState; return (st&&st.pkg)?ghGoneCards(ghIncoming(st.pkg.cards,srcOfficial())).map(function(c){ return c.name; }):[];
};

/* Clears `local` from readers' copies of published cards, which an older Publish sent with it and an import never touches.
   By card id and record id both: a reader's own card can share an older card id, never the record id. */
function ghClearPublishedLocal(incoming,src){
  try{ if(srcOwned(src||srcOfficial()))return 0; }catch(_){ return 0; }
  var ids={};
  (incoming||[]).forEach(function(c){ if(c&&c.cid&&c.id)ids[c.cid]=c.id; });
  var fixed=(window.CARDS||[]).filter(function(c){ return c&&c.local&&c.cid&&c.id&&ids[c.cid]===c.id; });
  fixed.forEach(function(c){ delete c.local; try{ persistCard(c); }catch(_){} });
  return fixed.length;
}

window.edGhUpdateNow=function(){
  var list=srcAll().filter(function(s){
    var st=srcState(s);
    return st&&st.pkg&&st.diff&&(st.diff.added||st.diff.changed||st.diff.removed);
  });
  if(list.length)return list.reduce(function(p,s){
    return p.then(function(){ return ghApplyUpdate(false,s); }); },Promise.resolve());
  return Promise.resolve(window.edGhCheck()).then(function(){
    return ghApplyUpdate(false);
  });
};
window.edGhApply=function(){ return ghApplyUpdate(true); };
/* A second press, or the check on open finishing inside it, gets the apply in flight, not a second one over the same cards. */
var _ghApplying={};
function ghApplyUpdate(fromPage,src){
  src=src||srcOfficial();
  var key=src.key||src.url||'';
  if(_ghApplying[key])return _ghApplying[key];
  var p=ghApplyUpdateNow(fromPage,src);
  _ghApplying[key]=p;
  var done=function(){ if(_ghApplying[key]===p)delete _ghApplying[key]; };
  p.then(done,done);
  return p;
}
function ghApplyUpdateNow(fromPage,src){
  var st=srcState(src);
  if(!st||!st.pkg){
    if(fromPage)alert('Check for an update first.');
    else toast('Could not reach the set right now');
    return Promise.resolve();
  }
  var d=st.diff, o=st.ctx;
  if(!d.added&&!d.changed&&!d.removed){ toast('Already up to date'); return Promise.resolve(); }
  var cards=ghIncoming(st.pkg.cards,src);

  /* Not grouped by saga: importCardRows takes the whole catalogue at once, so every card keeps every saga it is in. */

  var risk=ghWouldOverwriteOwnWork(cards,o);
  var gate=risk
    ? edDangerGate({phrase:'UPDATE',
        title:'Apply update from the source',
        body:'This overwrites '+risk+' card(s) you can edit with the source’s version. '
            +'Any local edit to a field the source also sets is replaced.'})
    : Promise.resolve(true);

  return gate.then(function(ok){
    if(!ok)return;
    /* a .zip's own pictures are unpacked here, on apply - the check skipped them */
    var unpack=(st.pkg.zip&&st.pkg.buf)
      ? _readSagaZip(new Blob([st.pkg.buf])).then(function(pk){ st.pkg.packedKeys=pk.packedKeys; })
      : Promise.resolve();
    /* a removal-only update imports nothing: rewriting every card to take four away is 1600 writes for no change */
    var work=(d.added||d.changed)
      ? unpack.then(function(){ return srcClaimSagas(o); })
              .then(function(){ return importCardRows(cards,'',o); })
              /* again, now the copies carry the published ids */
              .then(function(r){ return srcClaimSagas(o).then(function(){ return r; }); })
      : Promise.resolve(null);
    /* after the imports, against the catalogue as it now stands: a renamed card was just matched and is not gone */
    return work.then(function(r){ return ghSyncTestState(cards,src).then(function(off){ return {r:r,off:off}; }); })
      .then(function(x){
        return srcRemoveGone(srcGoneCards(cards,o),o).then(function(nGone){
          return {r:x.r,off:x.off,gone:nGone}; });
      }).then(function(res){
      var now=new Date().toISOString();
      if(src.official){
        if(!window.REBIRTH&&normGroupUrl(GH_SOURCE)===normGroupUrl(GH_DEFAULT_SOURCE)){
          GH_HAS_WHOLE_SET=true;
          setMetaSafe('bakeCaptured',{at:now,fromSource:true});
        }
        _ghChecked=true;
      } else {
        src.lastSync=now; srcSave();
      }
      srcSetState(src,null);
      ghBadgeRefresh();
      applyToCatalog();
      try{ refreshSagaFilter(); }catch(_){}
      edRefreshDeckSide();
      var seen=[];
      ((res.r&&res.r.cards)||[]).concat(res.off||[]).forEach(function(c){
        if(c&&seen.indexOf(c)<0)seen.push(c); });
      var n=(res.r&&!res.r.cards&&res.r.n!=null)?res.r.n:seen.length;
      toast((n||!res.gone)
        ? ((n?'Updated '+n+' card(s) from ':'Every card was already the same as ')+srcLabel(src)
           +(res.gone?', removed '+res.gone+' the source no longer has':''))
        : 'Removed '+res.gone+' card(s) '+srcLabel(src)+' no longer has');
      srcRender();
      return src.official ? ghSyncOfficialExtras(false) : srcAddKeywords(src);
    });
  }).catch(function(err){ alert('Update failed: '+((err&&err.message)||err)); });
}
/* Added, never replacing the Official entries or yours, so another creator's card still shows its keywords. */
function srcAddKeywords(src){
  if(!src||src.official||!src.url||/\.zip(\?.*)?$/i.test(src.url))return Promise.resolve(0);
  return ghFetchKeywords(src.url).then(function(list){
    return kwExtraAdd(list);
  }).catch(function(){ return 0; });
}
function srcNormKw(k){
  if(!k||typeof k!=='object'||Array.isArray(k))return null;
  if(typeof k.name!=='string'||!k.name.trim())return null;
  var o=JSON.parse(JSON.stringify(k));
  if(typeof o.mode!=='string'||!o.mode)o.mode='keyword';
  if(typeof o.match!=='string'||!o.match)o.match=o.name;
  ['matchAlt','reminder','reminderBare','param','dmgKind','replaces'].forEach(function(f){
    if(o[f]!==undefined&&typeof o[f]!=='string')delete o[f]; });
  if(o.dmgClass!==undefined)o.dmgClass=srcTextList(o.dmgClass);
  return o;
}
function kwExtraAdd(list){
  if(!Array.isArray(list)||!list.length)return 0;
  var have={};
  (window.KW_DATA||[]).concat(KW_EXTRA||[]).forEach(function(k){
    if(k&&k.name)have[(k.mode||'keyword')+'\u0000'+k.name]=1; });
  var add=list.map(srcNormKw).filter(function(k){
    return k&&!have[k.mode+'\u0000'+k.name]; })
    .map(function(k){ delete k.__custom; return k; });
  if(!add.length)return 0;
  KW_EXTRA=(KW_EXTRA||[]).concat(add);
  setMetaSafe('kwFromSources',KW_EXTRA,'keywords from followed sources');
  try{ ghKwRefresh(); }catch(_){}
  return add.length;
}


/* git's own blob hash, the sha GitHub lists for each tree entry, so a file compares without a download.
   NUL comes from fromCharCode, never an escape (HANDOFF §0). */
function ghBlobSha(bytes){
  var hdr=new TextEncoder().encode('blob '+bytes.length+String.fromCharCode(0));
  var buf=new Uint8Array(hdr.length+bytes.length);
  buf.set(hdr,0); buf.set(bytes,hdr.length);
  if(!(window.crypto&&window.crypto.subtle))
    return Promise.reject(new Error('this page has no crypto.subtle. Serve it over '
      +'http://localhost rather than opening the file directly.'));
  return window.crypto.subtle.digest('SHA-1',buf).then(function(d){
    var out=''; new Uint8Array(d).forEach(function(b){ out+=('0'+b.toString(16)).slice(-2); });
    return out;
  });
}

/* The token goes to this host and to this repository only: `path` is a path inside it, and the names are checked first (ghRepoProblem). */
var GH_API='https://api.github.com/';
var GH_NAME_RE=/^[A-Za-z0-9_.-]+$/;
function ghApiUrl(path){
  path=String(path==null?'':path);
  if(path&&path.charAt(0)!=='/')return '';
  if(/(^|\/)\.\.?(\/|$|\?)/.test(path.split('?')[0]))return '';
  var url=GH_API+'repos/'+encodeURIComponent(GH_REPO.owner)+'/'+encodeURIComponent(GH_REPO.repo)+path;
  try{ var u=new URL(url); if(u.origin+'/'!==GH_API)return ''; }catch(_){ return ''; }
  return url;
}
function ghWaitSecs(r){
  var h=function(n){ try{ return r.headers.get(n); }catch(_){ return null; } };
  var ra=h('retry-after');
  if(ra!=null&&ra!==''&&isFinite(+ra))return Math.max(0,+ra);
  var reset=h('x-ratelimit-reset');
  if(h('x-ratelimit-remaining')==='0'&&reset&&isFinite(+reset))
    return Math.max(0,Math.ceil(+reset-Date.now()/1000));
  return null;
}
function ghWaitText(s){
  if(s==null)return 'a few minutes';
  if(s<90)return Math.max(1,Math.round(s))+' second'+(Math.round(s)===1?'':'s');
  var m=Math.ceil(s/60); return m+' minute'+(m===1?'':'s');
}
/* The messages are PUBLISHING.md's "When it goes wrong" table: keep the two in step.
   A rate limit comes as 403 or 429, so its headers are read before a 403 is put down to the token. */
function ghApiError(r,t){
  var msg=''; try{ var j=JSON.parse(t||''); msg=String((j&&j.message)||''); }catch(_){}
  var wait=ghWaitSecs(r);
  var limited=r.status===429||(r.status===403&&(wait!=null||/rate limit|abuse/i.test(msg)));
  var why=limited
      ?'GitHub’s rate limit was reached. Try again in '+ghWaitText(wait)+'.'
    :r.status===401?'the token is wrong or has expired.'
    :r.status===403?'the token does not have Contents: read and write on this repository.'
    :r.status===404?'no such repository, or the token cannot see it.'
    :r.status===409&&/empty/i.test(msg)?'the repository is empty.'
    :r.status===409?'GitHub reported a conflict in the repository'+(msg?' ('+msg.slice(0,120)+')':'')+'.'
    :r.status===422&&/fast.?forward/i.test(msg)
      ?'the branch moved while this was publishing - something else published to it. '
       +'Press Preview changes to see what is there now, then publish again.'
    :r.status===422?'GitHub refused the request'+(msg?': '+msg.slice(0,160):'')+'.'
    :r.status===502?'GitHub could not build that request. If this was a tree write, the chunk is too big.'
    :r.status>=500?'GitHub had a problem of its own. Try again in a minute.'
    :(msg||t||'').slice(0,200);
  var err=new Error('GitHub said '+r.status+' - '+why);
  err.status=r.status; err.limited=limited; err.wait=wait; err.ghMessage=msg;
  return err;
}
/* Only a read is tried again, at most twice, after the wait GitHub names (a minute at most): a second POST of a commit is a second commit. */
var GH_RETRY_MAX=2, GH_RETRY_WAIT_CAP=60;
function ghApi(method,path,body,tries){
  if(!GH_TOKEN)return Promise.reject(new Error('no token set.'));
  if(!GH_REPO.owner||!GH_REPO.repo)return Promise.reject(new Error('no repository set.'));
  var bad=ghRepoProblem();
  if(bad)return Promise.reject(new Error(bad));
  var url=ghApiUrl(path);
  if(!url)return Promise.reject(new Error('that is not a path in this repository.'));
  tries=tries||0;
  var again=function(secs){
    return new Promise(function(res){ setTimeout(res,Math.min(secs,GH_RETRY_WAIT_CAP)*1000); })
      .then(function(){ return ghApi(method,path,body,tries+1); });
  };
  var opt={method:method,headers:{
    'Accept':'application/vnd.github+json',
    'X-GitHub-Api-Version':'2022-11-28',
    'Authorization':'Bearer '+GH_TOKEN}};
  if(body!==undefined){ opt.headers['Content-Type']='application/json';
    opt.body=JSON.stringify(body); }
  var canRetry=(method==='GET'&&tries<GH_RETRY_MAX);
  return fetch(url,opt).then(function(r){
    return r.text().then(function(t){
      if(!r.ok){
        var err=ghApiError(r,t);
        if(canRetry&&(err.limited?(err.wait!=null&&err.wait<=GH_RETRY_WAIT_CAP)
                                 :(r.status>=502&&r.status<=504)))
          return again(err.limited?err.wait:(tries+1)*2);
        throw err;
      }
      return t?JSON.parse(t):{};
    });
  },function(netErr){
    if(canRetry)return again((tries+1)*2);
    throw netErr;
  });
}

/* A relative art path resolves against this game's CDN, or this disk in owner mode on its own copy; an absolute one stays, so another creator's saga keeps their CDN. */
function ghOfficialParts(){
  var m=/^https?:\/\/raw\.githubusercontent\.com\/([^\/]+)\/([^\/]+)\/([^\/]+)\//i
        .exec(GH_DEFAULT_SOURCE||'');
  return m?{owner:m[1],repo:m[2],branch:m[3]}:null;
}
/* Only the copy on the owner's own disk has the PNG masters the cards name in art/. */
function ghLocalPage(host){
  try{
    var h=(host!=null)?String(host):((location&&location.hostname)||'');
    if(host!=null)return h===''||h==='localhost'||h==='127.0.0.1'||h==='[::1]'||h==='::1';
    return (location&&location.protocol==='file:')
        || h===''||h==='localhost'||h==='127.0.0.1'||h==='[::1]'||h==='::1';
  }catch(_){ return true; }
}
/* for the checks, which ask about hostnames they are not served from */
window.edArtPageIsLocal=function(host){ return ghLocalPage(host); };
/* '' means the address as it stands. Always this game's own base: a shared one would draw Conjure's pictures onto Rebirth's cards. */
function ghArtBase(){
  /* Owner mode resolves locally only on the copy on that disk: on the published site art/ holds WebP, and every picture would 404. */
  if(GH_OWNER_MODE&&ghLocalPage())return '';
  var o=ghOfficialParts(); if(!o)return '';
  return 'https://cdn.jsdelivr.net/gh/'+o.owner+'/'+o.repo+'@'+o.branch+'/art/';
}
/* The one read point for a card's picture: the face, the editor and the catalogue's _artSrc all come here. */
function artSrcOf(vv){
  var u=(vv&&(vv.imageUrl||(vv.art&&ART[vv.art])||vv.art))||'';
  if(!u)return '';
  /* someone's CDN, or an object URL or upload in progress: none of them ours to rewrite */
  if(/^(https?:|data:|blob:)/i.test(u))return u;
  var base=ghArtBase();
  if(!base)return u;
  /* published art is WebP: ghOutName is github_sync.py's rule */
  return base+ghOutName(u);
}
window.edArtSrcOf=artSrcOf;
/* What the face shows: most cards keep their picture on a variant and carry imageUrl "", so the card's own field is not enough. */
window.edCardArtSrc=function(c){
  if(!c)return '';
  try{ return artSrcOf(variantOf(c))||''; }catch(_){ return ''; }
};

/* github_sync.py's out_name(): art_18.png -> art_18.webp, image980 -> image980.webp */
function ghOutName(p){
  var base=String(p||'').split('/').pop();
  return base.replace(/\.[^.]+$/,'')+'.webp';
}
function ghCdnBase(){
  return 'https://cdn.jsdelivr.net/gh/'+GH_REPO.owner+'/'+GH_REPO.repo
        +'@'+(GH_REPO.branch||'main');
}

/* A publish sends only the sagas made here and those whose source is the repository published to; with none set, all but other people's. */
function ghTargetRepo(){
  return {owner:String(GH_REPO.owner||'').toLowerCase(),
          repo:String(GH_REPO.repo||'').toLowerCase(), branch:GH_REPO.branch||'main'};
}
function ghTargetIsOfficial(){
  var off=ghOfficialRepo(), t=ghTargetRepo();
  return !!off&&off.owner===t.owner&&off.repo===t.repo;
}
function ghTargetUrl(){
  if(!GH_REPO.owner||!GH_REPO.repo)return '';
  return 'https://raw.githubusercontent.com/'+GH_REPO.owner+'/'+GH_REPO.repo+'/'
    +(GH_REPO.branch||'main')+'/cards.json';
}
function ghPublishSagaSet(){
  var set={}, seen={}, t=ghTargetRepo(), none=!t.owner||!t.repo;
  /* a card can name a saga before its record exists (a profile mid-boot, the checks) */
  var consider=function(id){
    if(!id||seen[id])return;
    seen[id]=1;
    var k=groupKeyOfId(id);
    if(k===GROUP_LOCAL){ set[id]=1; return; }
    if(k.indexOf('table:')===0)return;
    if(k===GROUP_OFFICIAL){ if(none||ghTargetIsOfficial())set[id]=1; return; }
    var r=repoOfUrl(k);
    if(!none&&r&&r.owner===t.owner&&r.repo===t.repo)set[id]=1;
  };
  (SAGAS||[]).forEach(function(sg){ if(sg)consider(sg.id); });
  (window.CARDS||[]).forEach(function(c){ if(c)sagaIdsOf(c).forEach(consider); });
  return set;
}
window.edGhPublishSagas=function(){ return Object.keys(ghPublishSagaSet()); };
/* what sagas.json would say, for the checks */
window.edGhSagaIndex=function(){ return ghSagaIndex(ghBuildCards()); };
function ghInScope(c,keep){
  return !!c&&sagaIdsOf(c).some(function(id){ return keep[id]; });
}
function ghBuildCards(){
  var keep=ghPublishSagaSet();
  return (window.CARDS||[]).filter(function(c){ return c&&!c.testing&&ghInScope(c,keep); })
    .map(function(c){ return ghPublishedForm(c,keep); });
}
/* for the checks, which read it before and after a reload */
window.edGhBuildCards=function(){ return ghBuildCards(); };
function ghBuildTesting(){
  var keep=ghPublishSagaSet();
  return (window.CARDS||[]).filter(function(c){ return c&&c.testing&&ghInScope(c,keep); })
    .map(function(c){ return ghPublishedForm(c,keep); });
}
/* A picture only in this browser is published as the copy Publish uploads beside the catalogue: never a data: URL, and never dropped.
   art-uploads/, not art/: the CLI deletes from art/ anything not in the folder on disk (github_sync.py, OWNED_DIRS). */
var GH_UPLOAD_DIR='art-uploads', GH_ART_WIDTH=1600, GH_ART_QUALITY=.82;
function ghLocalArtKey(b){
  var k=b&&b.art;
  if(!k||/[\/:]/.test(k))return '';               /* a path or an address is not a store key */
  return (typeof ART!=='undefined'&&ART[k])?k:'';
}
/* A key one of the card's own pictures names in art/ is not only here: a full backup's restore puts those in the store, and the CLI publishes art/. */
function ghOnDisk(c,key){
  var name=String(key||'').split('/').pop();
  return !!name&&artBearers(c).some(function(x){
    var u=String((x&&x.imageUrl)||'');
    return /^art\//.test(u)&&u.split('/').pop()===name; });
}
function ghVolatile(u){ u=String(u||''); return u.indexOf('data:')===0||u.indexOf('blob:')===0; }
/* When the head saga is cut, the next one's printing becomes the card's own (promoteSagaFields); a card wholly inside is left byte for byte. */
function ghScopeSagas(o,keep){
  var all=sagaIdsOf(o), list=all.filter(function(id){ return keep[id]; });
  if(!list.length||list.length===all.length)return;
  if(list[0]!==all[0]){
    var ov=o.sagaFields&&o.sagaFields[list[0]];
    if(ov)SAGA_FIELDS.forEach(function(f){ if(ov[f]!==undefined)o[f]=ov[f]; });
  }
  o.sagaIds=list; o.sagaId=list[0];
  var sg=sagaById(list[0]); o.saga=(sg&&sg.name)||list[0];
  if(o.sagaFields){
    Object.keys(o.sagaFields).forEach(function(sid){ if(!keep[sid]||sid===list[0])delete o.sagaFields[sid]; });
    if(!Object.keys(o.sagaFields).length)delete o.sagaFields;
  }
}
/* Shared by cards.json and testing.json, so a card moving in or out of Test reads the same in either. */
function ghPublishedForm(c,keep){
  var base=ghCdnBase();
  var o=JSON.parse(JSON.stringify(c));
  delete o.__id;
  if(keep&&typeof keep==='object')ghScopeSagas(o,keep);
  /* a published card is the set's wherever it lands, never `local` (ghNotLocal) */
  delete o.local;
  artBearers(o).forEach(function(b){
    var local=ghLocalArtKey(b);
    if(local&&ghOnDisk(c,local))local='';
    ['art','imageUrl'].forEach(function(f){
      var v=b[f]||'';
      if(!v||v.indexOf('http')===0)return;
      if(ghVolatile(v)){ b[f]=''; return; }
      if(f==='imageUrl')b[f]=base+'/art/'+ghOutName(v);
      else b[f]='';   /* an IndexedDB key on THIS machine, meaningless elsewhere */
    });
    /* a picture only here points at the copy Publish uploads; one on disk (art/...) wins */
    if(local&&!b.imageUrl)b.imageUrl=base+'/'+GH_UPLOAD_DIR+'/'+ghOutName(local);
  });
  return o;
}
/* Only cards this publish sends: one only in sagas left out, or in a table copy, sends no picture. */
function ghLocalArtUploads(){
  var out=[], seen={}, keep=ghPublishSagaSet();
  (window.CARDS||[]).forEach(function(c){
    if(!c||c.__deleted||!ghInScope(c,keep))return;
    artBearers(c).forEach(function(b){
      var k=ghLocalArtKey(b);
      if(!k||ghOnDisk(c,k))return;
      var u=String(b.imageUrl||'');
      if(u&&!ghVolatile(u))return;
      var path=GH_UPLOAD_DIR+'/'+ghOutName(k);
      if(seen[path])return;
      seen[path]=1; out.push({key:k,path:path});
    });
  });
  return out;
}
window.edGhLocalArtUploads=function(){ return ghLocalArtUploads(); };
/* as the CLI publishes a picture: WebP, 1600px wide at most, q82 */
function ghWebpBytes(key){
  var src=ART[key];
  if(!src)return Promise.reject(new Error('the picture "'+key+'" is not in this browser'));
  return fetch(src).then(function(r){ return r.blob(); }).then(function(bl){ return createImageBitmap(bl); })
    .then(function(bm){
      var w=Math.min(GH_ART_WIDTH,bm.width), h=Math.max(1,Math.round(bm.height*w/bm.width));
      var cv=document.createElement('canvas'); cv.width=w; cv.height=h;
      cv.getContext('2d').drawImage(bm,0,0,w,h);
      return new Promise(function(res,rej){
        cv.toBlob(function(out){ if(out)res(out); else rej(new Error('could not encode "'+key+'"')); },'image/webp',GH_ART_QUALITY);
      });
    }).then(function(out){ return out.arrayBuffer(); }).then(function(ab){ return new Uint8Array(ab); });
}
window.edGhWebpBytes=function(key){ return ghWebpBytes(key); };
/* Named by the store key, new for every upload (edArtUpload): a replaced picture is a new file, and one already up is never sent twice. */
function ghArtCapText(n){
  return 'This publish would send '+n+' pictures that exist only in this browser, and one publish '
    +'from the app sends at most '+GH_ART_CAP+'. Use the command-line tool instead: '
    +'tools/github_sync.py (Publish-All.bat) publishes the pictures in art/ from disk.';
}
function ghAddLocalArt(rt,local){
  var todo=ghLocalArtUploads().filter(function(u){ return !(rt&&rt.paths&&rt.paths[u.path]); });
  /* refused whole, before the first one is encoded */
  if(todo.length>GH_ART_CAP)return Promise.reject(new Error(ghArtCapText(todo.length)));
  return todo.reduce(function(p,u){
    return p.then(function(done){
      return ghWebpBytes(u.key).then(function(bytes){
        return ghBlobSha(bytes).then(function(sha){ local[u.path]={sha:sha,bytes:bytes}; done.push(u.path); return done; });
      });
    });
  },Promise.resolve([]));
}

/* The in-app Publish never uploads the app: tools/github_sync.py publishes card_catalog.html from disk (HANDOFF §17.7).
   Do not bring it back without a chunked upload, which the Git Data API blob endpoint does not offer. */

/* Built here: author, version and description live only in IndexedDB, and without it a new saga's cards ship while the dropdown never learns of it. */
function ghSagaIndex(cards){
  var counts={};
  /* by membership, not the primary: a saga whose cards are all shared would be left out of sagas.json */
  (cards||[]).forEach(function(c){
    if(!c)return;
    sagaIdsOf(c).forEach(function(sid){ if(sid)counts[sid]=(counts[sid]||0)+1; });
  });
  var seen={}, out=[];
  (SAGAS||[]).forEach(function(sg){
    if(!sg||!counts[sg.id])return;
    seen[sg.id]=1;
    out.push({id:sg.id,name:sg.name||sg.id,author:sg.author||'',
              version:sg.version||'1.0',description:sg.description||'',
              cardCount:counts[sg.id]});
  });
  Object.keys(counts).forEach(function(sid){
    if(!seen[sid])out.push({id:sid,name:sid,cardCount:counts[sid],derived:true});
  });
  return out;
}

/* The look goes in its own look.json, so a card edit never re-uploads megabytes of template art (cards.json keeps look:null).
   currentPackBody is reused, not re-listed, so a field added there is published without touching this. */
function ghBuildLook(){
  try{
    var look=currentPackBody();
    if(!look)return null;
    look.format=1;
    return look;
  }catch(_){ return null; }
}

/* Run from the console: data/look_default.txt cannot be written by hand, so this downloads it to drop into data/ before a rebuild.
   The same body as look.json, so the baked look and the published one are the same by construction. */
window.edExportDefaultLook=function(){
  var look=ghBuildLook();
  if(!look){ alert('Could not read the current look.'); return; }
  var slots=Object.keys(look.slots||{}).length;
  var styles=Object.keys(look.kwStyles||{}).length;
  var custom=(look.kwCustom||[]).length;
  if(!styles && !slots && !custom
     && !confirm('This look has no pill formats, no template assets and no '
        + 'custom keywords.\n\nBake it anyway?')) return;
  /* One line, exactly the shape ed2_core's LOOK_BAKED reader expects. */
  var body="<script id='lookdata' type='application/json'>"
    + JSON.stringify({format:1, look:look})
    + "<\/script>\n";
  var blob=new Blob([body],{type:'text/plain'});
  var url=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=url; a.download='look_default.txt';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); },5000);
  toast('Saved look_default.txt — put it in data/ and run build.py ('
    + styles + ' pill format(s), ' + slots + ' asset(s), ' + custom + ' keyword(s))');
};
function ghBuildMarks(){
  try{ return JSON.parse(JSON.stringify(MARKS||[])); }catch(_){ return []; }
}

/* cards.json is github_sync.py's format, byte for byte where it can be, with no timestamp: publishing twice changes nothing.
   artFiles is carried forward from the manifest already there, since only the CLI uploads art/ and knows the count. */
function ghPayload(prev){
  var cards=ghBuildCards();
  var kw=(window.KW_DATA||[]);
  var sagas=ghSagaIndex(cards);
  var look=ghBuildLook(), marks=ghBuildMarks();
  var slots=(look&&look.slots)?Object.keys(look.slots).length:0;
  var manifest={name:(prev&&prev.name)||'Conjure UCG',format:2,
    cardCount:cards.length,keywordCount:kw.length,
    /* so a reader knows there is a look to fetch before spending a request on it */
    lookSlots:slots,markCount:marks.length,
    artBase:ghCdnBase()+'/art/'};
  if(prev&&prev.artFiles!=null)manifest.artFiles=prev.artFiles;
  if(prev&&prev.artEncoding)manifest.artEncoding=prev.artEncoding;
  /* testing.json is written even empty, or a last Test card switched off would stay in the repository and come back elsewhere. */
  var testing=ghBuildTesting();
  var out={'cards.json':JSON.stringify({manifest:manifest,cards:cards,look:null,marks:null},null,1),
          'keywords.json':JSON.stringify(kw,null,1),
          'sagas.json':JSON.stringify(sagas,null,1),
          'look.json':JSON.stringify({format:1,look:look,marks:marks},null,1),
          'manifest.json':JSON.stringify(manifest,null,1),
          'testing.json':JSON.stringify({manifest:{name:manifest.name,format:2,testing:true,
            cardCount:testing.length},cards:testing},null,1)};
  if(!window.REBIRTH)out['colour_lists.json']=JSON.stringify(statClForPublish(),null,1);
  return out;
}

/* From the real payload, so it cannot drift from what goes up (the checks read it, edGhInventory); the art-uploads/ pictures are not listed. */
function ghInventory(){
  var pay, out=[];
  try{ pay=ghPayload(null); }catch(err){ return {err:(err&&err.message)||String(err)}; }
  var look=null;
  try{ look=JSON.parse(pay['look.json']).look; }catch(_){}
  function kb(s){ return Math.round((s?s.length:0)/1024); }
  var nTest=(window.CARDS||[]).filter(function(c){ return c&&c.testing; }).length;
  out.push({file:'cards.json', kb:kb(pay['cards.json']),
    what:((window.CARDS||[]).length-nTest)+' cards — every field each one carries: '
        +'name, cost, types, rules, flavour, stats and orbs, saga membership, '
        +'and for the card AND every alternate art its picture, art framing '
        +'(X, Y, zoom, rotate, flip), art fit, highlight, watermark, frame '
        +'orientation and rules-box split'});
  out.push({file:'keywords.json', kb:kb(pay['keywords.json']),
    what:(window.KW_DATA||[]).length+' keywords, keyterms, counters and dice'});
  out.push({file:'sagas.json', kb:kb(pay['sagas.json']),
    what:'the saga index — name, author, version, description and card count'});
  out.push({file:'look.json', kb:kb(pay['look.json']),
    what:(look?Object.keys(look.slots||{}).length:0)+' uploaded template asset(s), '
        +'outline and pinline treatment, both art-default sets, print bleed, '
        +'the rules-text alignment table, keyword pill styling and custom '
        +'keyword entries, and '+ghBuildMarks().length+' watermark(s)'});
  out.push({file:'manifest.json', kb:kb(pay['manifest.json']),
    what:'counts and the art base URL'});
  if(pay['colour_lists.json'])out.push({file:'colour_lists.json', kb:kb(pay['colour_lists.json']),
    what:'the colour lists Statistics compares each colour with'});
  out.push({file:'testing.json', kb:kb(pay['testing.json']),
    what:nTest+' Test card(s) — left out of cards.json; only the copy holding '
        +'this repository’s token reads this file'});
  return {rows:out};
}
window.edGhInventory=function(){ return ghInventory(); };

function ghLookUrl(src){
  var u=String(src||'');
  return /cards\.json(\?.*)?$/i.test(u) ? u.replace(/cards\.json(\?.*)?$/i,'look.json')
       : u.replace(/\/[^\/]*$/,'/look.json');
}
/* Read only by the copy that owns the source, so nobody else sees a Test card; a missing or bad file is no Test cards (HANDOFF §58.8). */
function ghTestingUrl(src){
  var u=String(src||'');
  return /cards\.json(\?.*)?$/i.test(u) ? u.replace(/cards\.json(\?.*)?$/i,'testing.json') : '';
}
function ghFetchTesting(src,source){
  var none=Promise.resolve([]);
  try{ if(!srcOwned(source||srcOfficial()))return none; }catch(_){ return none; }
  if(!source&&normGroupUrl(src)!==normGroupUrl(GH_DEFAULT_SOURCE))return none;
  var url=ghTestingUrl(src);
  if(!url||syncBlockedReason(url))return none;
  return fetch(url,{cache:'no-cache'}).then(function(r){
    if(!r.ok)return [];
    return r.json().then(function(j){
      var list=(j&&Array.isArray(j.cards))?j.cards:(Array.isArray(j)?j:[]);
      return list.filter(function(c){ return c&&c.name; })
                 .map(function(c){ var o=JSON.parse(JSON.stringify(c)); o.testing=1; return o; });
    },function(){ return []; });
  },function(){ return []; });
}
/* The check on open and the extras after it share one request for the same address within ten seconds; `fresh`, a forced apply, asks again. */
var _ghLookMemo=null;
function ghFetchLook(src,fresh){
  var url=ghLookUrl(src);
  if(!url||syncBlockedReason(url))return Promise.resolve(null);
  var now=Date.now();
  if(!fresh&&_ghLookMemo&&_ghLookMemo.url===url&&now-_ghLookMemo.at<10000)return _ghLookMemo.p;
  var p=fetch(url,{cache:'no-cache'}).then(function(r){
    if(!r.ok)return null;
    return r.json().then(function(j){
      if(!j||typeof j!=='object')return null;
      return {look:j.look||null,marks:Array.isArray(j.marks)?j.marks:[]};
    },function(){ return null; });
  },function(){ return null; });
  _ghLookMemo={url:url,at:now,p:p};
  return p;
}

/* Every sync of the Official source ends with ghSyncOfficialExtras: keywords.json always, look.json while Use Default Look is on and it has changed.
   Never on the owner's machine, where they come from (edOwnerUnlocked); an automatic apply over somebody's work saves a copy first (ghKeepLookCopy). */
var GH_USE_DEFAULT_LOOK=true;   /* absent from the store = on */
var GH_LOOK_APPLIED='';

function ghOfficialSrc(){ return GH_SOURCES[ghMode()]||''; }
function ghKwUrl(src){
  var u=String(src||'');
  return /cards\.json(\?.*)?$/i.test(u) ? u.replace(/cards\.json(\?.*)?$/i,'keywords.json')
       : u.replace(/\/[^\/]*$/,'/keywords.json');
}
/* the same ten-second sharing: the check on open and the weekly run after it both end with the extras */
var _ghKwMemo=null;
function ghFetchKeywords(src){
  var url=ghKwUrl(src);
  if(!url||syncBlockedReason(url))return Promise.resolve(null);
  var now=Date.now();
  if(_ghKwMemo&&_ghKwMemo.url===url&&now-_ghKwMemo.at<10000)return _ghKwMemo.p;
  var p=fetch(url,{cache:'no-cache'}).then(function(r){
    if(!r.ok)return null;
    return r.json().then(function(j){
      return (Array.isArray(j)&&j.length)?j:null;
    },function(){ return null; });
  },function(){ return null; });
  _ghKwMemo={url:url,at:now,p:p};
  return p;
}
function ghFetchColourLists(src){
  if(window.REBIRTH)return Promise.resolve(null);
  var url=ghKwUrl(src).replace(/keywords\.json(\?.*)?$/i,'colour_lists.json');
  if(!url||syncBlockedReason(url))return Promise.resolve(null);
  return fetch(url,{cache:'no-cache'}).then(function(r){
    if(!r.ok)return null;
    return r.json().then(function(j){ return (j&&typeof j==='object')?j:null; },function(){ return null; });
  },function(){ return null; });
}
/* So "has the official look changed" is one string compare, not a held copy of a megabyte of template art. */
function ghFingerprint(s){
  var h=5381, i=0, n=s.length;
  for(;i<n;i++){ h=((h<<5)+h+s.charCodeAt(i))|0; }
  return n+':'+(h>>>0).toString(36);
}
function ghKwRefresh(){
  edApplyCustomEntries();
  try{ scheduleFace(); }catch(_){}
  try{ var c=curCard(); if(c)renderPreview(c); }catch(_){}
  try{ if(typeof window.edRenderKwPage==='function'&&document.getElementById('kwPageBody'))window.edRenderKwPage(); }catch(_){}
  try{ applyToCatalog(); }catch(_){}
}
function ghApplyOfficialKeywords(list){
  if(!Array.isArray(list)||!list.length)return false;
  if(edOwnerUnlocked())return false;
  var next=list.map(srcNormKw).filter(Boolean);
  if(!next.length)return false;
  if(JSON.stringify(next)===JSON.stringify(KW_BAKED||[]))return false;
  KW_BAKED=next;
  setMetaSafe('kwOfficial',KW_BAKED,'the official keywords');
  ghKwRefresh();
  return true;
}
/* Asked only before a machine's first automatic apply; after that ghKeepLookCopy compares with what the last apply left. */
function ghHasOwnLook(){
  if(Object.keys(TPL||{}).length)return true;
  var baked=(LOOK_BAKED&&LOOK_BAKED.kwStyles)||{};
  if(JSON.stringify(KWSTYLE||{})!==JSON.stringify(baked))return true;
  var bk={};
  ((LOOK_BAKED&&LOOK_BAKED.kwCustom)||[]).forEach(function(x){ if(x&&x.id)bk[x.id]=JSON.stringify(x); });
  return (KWCUSTOM||[]).some(function(x){ return !x||!x.id||bk[x.id]!==JSON.stringify(x); });
}
function ghStableJson(v){
  if(Array.isArray(v))return '['+v.map(ghStableJson).join(',')+']';
  if(v&&typeof v==='object')return '{'+Object.keys(v).sort().map(function(k){
    return JSON.stringify(k)+':'+ghStableJson(v[k]); }).join(',')+'}';
  var s=JSON.stringify(v); return s===undefined?'null':s;
}
/* in the shape a reload gives back (keywords in id order, boot's pill highlight and width), or every reload would read as a change */
function ghLookNow(){
  var b=currentPackBody();
  b.kwCustom=(b.kwCustom||[]).slice().sort(function(x,y){
    var a=String(x&&x.id), c=String(y&&y.id); return a<c?-1:a>c?1:0; });
  var ks=b.kwStyles||{};
  Object.keys(ks).forEach(function(k){
    var v=ks[k]; if(!v||typeof v!=='object')return;
    if(v.hl===undefined){ v.hl=v.irid?'irid':'none'; delete v.irid; }
    if(v.w===undefined)v.w=1.5;
  });
  return ghFingerprint(ghStableJson(b));
}
/* A look changed since the last automatic apply (meta ghLookAfter) is saved as a template pack first; if it cannot be saved, nothing is applied. */
function ghKeepLookCopy(){
  return getMeta('ghLookAfter').then(function(after){
    var mine=after?(ghLookNow()!==after):ghHasOwnLook();
    if(!mine)return null;
    return packsAll().then(function(all){
      var taken={}; (all||[]).forEach(function(p){ if(p&&p.name)taken[p.name]=1; });
      var nm='My look (before Default Look)';
      if(taken[nm]){
        var stem='My look (before Default Look, '+new Date().toISOString().slice(0,10), n=1;
        nm=stem+')';
        while(taken[nm]){ n++; nm=stem+' #'+n+')'; }
      }
      var rec=Object.assign({name:nm,saved:new Date().toISOString()},currentPackBody());
      return put('packs',rec).then(function(){
        try{ packsRefresh(); }catch(_){}
        toast('Kept a copy of your look as the template "'+nm+'"');
        return nm;
      });
    });
  });
}
/* The official entries plus every one here the official look did not put here (meta ghLookKwIds, and the baked seeds). */
function ghLookKwBody(list,prevIds){
  var inc=(list||[]).filter(function(x){ return x&&typeof x==='object'&&x.id&&typeof x.id==='string'; })
    .map(function(x){ return JSON.parse(JSON.stringify(x)); });
  var official={};
  inc.forEach(function(x){ official[x.id]=1; });
  ((LOOK_BAKED&&LOOK_BAKED.kwCustom)||[]).forEach(function(x){ if(x&&x.id)official[x.id]=1; });
  (Array.isArray(prevIds)?prevIds:[]).forEach(function(id){ official[id]=1; });
  var own=(KWCUSTOM||[]).filter(function(x){ return x&&x.id&&!official[x.id]; });
  return {list:inc.concat(own),ids:inc.map(function(x){ return x.id; })};
}
/* By id, as a card names one by id: a local mark is never dropped, and one of yours with an official one's name does not keep it out. */
function ghAddOfficialMarks(pkg,all){
  var have={}; (MARKS||[]).forEach(function(m){ if(m&&m.id)have[m.id]=1; });
  var add=((pkg&&pkg.marks)||[]).filter(function(m){
    return m&&typeof m==='object'&&m.id&&typeof m.id==='string'&&!have[m.id]
      &&(all||markUsedBy(m.id).length);
  });
  if(!add.length)return Promise.resolve(0);
  return add.reduce(function(p,m){ return p.then(function(){ return put('marks',m); }); },
                    Promise.resolve())
    .then(function(){ return marksRefresh(); })
    .then(function(){ try{ marksChanged(); }catch(_){} return add.length; });
}
function ghApplyDefaultLook(pkg,force){
  if(!GH_USE_DEFAULT_LOOK||!pkg||!pkg.look)return Promise.resolve(false);
  if(edOwnerUnlocked())return Promise.resolve(false);
  var fp=ghFingerprint(JSON.stringify(pkg.look)
    +'|'+JSON.stringify((pkg.marks||[]).map(function(m){ return m&&m.name; })));
  if(!force&&fp===GH_LOOK_APPLIED){
    return ghAddOfficialMarks(pkg,false).then(function(){ return false; },function(){ return false; });
  }
  var kwIds=null;
  return ghKeepLookCopy().then(function(){
    return getMeta('ghLookKwIds');
  }).then(function(prevIds){
    var body=Object.assign({},pkg.look);
    if(Array.isArray(pkg.look.kwCustom)){
      var k=ghLookKwBody(pkg.look.kwCustom,prevIds);
      body.kwCustom=k.list; kwIds=k.ids;
    }
    return applyPackBody(body);
  }).then(function(){
    return ghAddOfficialMarks(pkg,true);
  }).then(function(){
    GH_LOOK_APPLIED=fp; setMetaSafe('ghLookApplied',fp);
    if(kwIds)setMetaSafe('ghLookKwIds',kwIds);
    setMetaSafe('ghLookAfter',ghLookNow());
    ghKwRefresh();
    return true;
  }).catch(function(){ return false; });
}
/* Never throws or blocks the sync it ends. One at a time: a second call gets the one in flight, and a forced one waits for it, then runs. */
var _ghExtras=null;
function ghSyncOfficialExtras(forceLook){
  if(_ghExtras&&!forceLook)return _ghExtras;
  var prev=_ghExtras||Promise.resolve();
  var src=ghOfficialSrc();
  if(!src||syncBlockedReason(src))return Promise.resolve();
  var p=prev.then(function(){
    return Promise.all([ghFetchKeywords(src),ghFetchLook(src,forceLook),ghFetchColourLists(src)]);
  }).then(function(v){
    ghApplyOfficialKeywords(v[0]);
    try{ statClApplyOfficial(v[2]); }catch(_){}
    return ghApplyDefaultLook(v[1],forceLook);
  }).catch(function(){}).then(function(){ if(_ghExtras===p)_ghExtras=null; });
  _ghExtras=p;
  return p;
}
window.edUseDefaultLook=function(){ return GH_USE_DEFAULT_LOOK; };
window.edSetUseDefaultLook=function(on){
  GH_USE_DEFAULT_LOOK=!!on;
  setMetaSafe('useDefaultLook',GH_USE_DEFAULT_LOOK);
  var t=document.getElementById('sgUseLook'); if(t)t.checked=GH_USE_DEFAULT_LOOK;
  if(GH_USE_DEFAULT_LOOK)return ghSyncOfficialExtras(true);
};
/* The stored official keywords replace the baked list before the check on open fetches fresh ones, so a reload does not flash back to the baked ones. */
function ghRestoreOfficial(){
  return Promise.all([getMeta('useDefaultLook'),getMeta('ghLookApplied'),getMeta('kwOfficial')])
    .then(function(v){
      GH_USE_DEFAULT_LOOK=(v[0]!=null)?!!v[0]:true;
      GH_LOOK_APPLIED=v[1]||'';
      var t=document.getElementById('sgUseLook'); if(t)t.checked=GH_USE_DEFAULT_LOOK;
      if(Array.isArray(v[2])&&v[2].length&&!edOwnerUnlocked()){
        KW_BAKED=v[2]; ghKwRefresh();
      }
      return statClLoad();
    }).catch(function(){});
}

/* Gated: applyPackBody replaces every template asset, the pill styling and the alignment table; watermarks are added by id instead. */
window.edGhApplyLook=function(){
  var st=_ghState;
  var incoming=st&&st.lookPkg;
  if(!incoming||!incoming.look){ alert('This source publishes no look.'); return; }
  var mine=Object.keys(TPL).length;
  return edDangerGate({
    phrase:'LOOK',
    title:'Apply the source’s look',
    body:'This REPLACES the template assets, keyword pill styling, alignment '
        +'table and art defaults on this machine with the source’s.',
    lose:[mine+' uploaded template asset(s)',
          'your keyword pill styling and any custom entries',
          'your rules-text alignment table and both art-default sets']
  }).then(function(ok){
    if(!ok){ toast('Cancelled - nothing was changed'); return; }
    return applyPackBody(incoming.look).then(function(){
      return ghAddOfficialMarks(incoming,true);
    }).then(function(){
      try{ scheduleFace(); }catch(_){}
      toast('Applied the source’s look');
      edRenderOwnerSync();
    });
  }).catch(function(err){ alert('Could not apply the look: '+((err&&err.message)||err)); });
};

/* The repository published to, through the API, so a publish keeps what only the CLI knows; on a failure those fields are left out. */
function ghFetchManifest(){
  if(!GH_REPO.owner||!GH_REPO.repo||!GH_TOKEN)return Promise.resolve(null);
  return ghRemoteTree().then(function(rt){
    var sha=rt&&rt.paths&&rt.paths['manifest.json'];
    if(!sha)return null;
    return ghApi('GET','/git/blobs/'+sha).then(function(r){
      if(!r||!r.content)return null;
      try{ var j=JSON.parse(ghB64Utf8(r.content)); return (j&&typeof j==='object')?j:null; }
      catch(_){ return null; }
    });
  }).catch(function(){ return null; });
}

/* A copy that does not hold the whole official set must not publish it as the set: refused until GH_HAS_WHOLE_SET. Rebirth never had a bake. */
function ghWholeSetProblem(){
  if(window.REBIRTH)return '';
  /* only the Official repository has a bake; every publish has the "holds none of it" check (edGhPublish) */
  if((GH_REPO.owner||GH_REPO.repo)&&!ghTargetIsOfficial())return '';
  if((window.BASE_CARDS||[]).length)return '';
  if(GH_HAS_WHOLE_SET)return '';
  return 'This copy does not hold the whole set yet. Check now, then Apply update, before publishing.';
}
window.edGhWholeSetProblem=function(){ return ghWholeSetProblem(); };
/* Before the network, so a missing token cannot be mistaken for an empty repository. */
function ghConfigProblem(){
  if(!GH_REPO.owner||!GH_REPO.repo)
    return 'Set your GitHub username and repository first.';
  var bad=ghRepoProblem(); if(bad)return bad;
  if(!GH_TOKEN)
    return GH_TOKEN_SINCE
      ? 'Paste your access token again: it is kept only while this page is open.'
      : 'Add an access token first. It needs Contents: read and write on that repository.';
  return '';
}
/* The names by GitHub's and git's own rules (git check-ref-format for a branch), checked as they are saved and again before any request. */
function ghBranchOk(b){
  b=String(b||'');
  if(!b||b==='@'||b.charAt(0)==='-')return false;
  for(var i=0;i<b.length;i++){ var c=b.charCodeAt(i); if(c<=32||c===127||c===92)return false; }
  if(/[~^:?*[]/.test(b))return false;
  if(b.indexOf('..')>=0||b.indexOf('@{')>=0||b.indexOf('//')>=0)return false;
  if(b.charAt(0)==='/'||b.charAt(b.length-1)==='/'||b.charAt(b.length-1)==='.')return false;
  return b.split('/').every(function(p){ return p.charAt(0)!=='.'&&p.slice(-5)!=='.lock'; });
}
function ghNameOk(n){ return GH_NAME_RE.test(n)&&!/^[.]+$/.test(n); }
function ghRepoProblem(){
  var o=GH_REPO.owner||'', r=GH_REPO.repo||'', b=GH_REPO.branch||'main';
  if(o&&!ghNameOk(o))return 'The username "'+o+'" cannot be a GitHub name: letters, digits, - _ and . only.';
  if(r&&!ghNameOk(r))return 'The repository "'+r+'" cannot be a GitHub repository name: letters, digits, - _ and . only.';
  if(!ghBranchOk(b))return 'The branch "'+b+'" cannot be a git branch name.';
  return '';
}
function ghRefPath(b){
  return String(b||'main').split('/').map(encodeURIComponent).join('/');
}

function ghTreeAt(br){
  return ghApi('GET','/git/ref/heads/'+ghRefPath(br)).then(function(ref){
    var head=ref.object.sha;
    return ghApi('GET','/git/commits/'+head).then(function(c){
      return ghApi('GET','/git/trees/'+c.tree.sha+'?recursive=1').then(function(t){
        var map={};
        (t.tree||[]).forEach(function(en){ if(en.type==='blob')map[en.path]=en.sha; });
        return {paths:map,head:head,tree:c.tree.sha};
      });
    });
  });
}
/* A missing branch answers with the default branch's tree, marked newBranch, and an empty repository is marked empty.
   Anything else, such as a bad token, surfaces as itself, never as "would upload 2 files". */
var _ghLastRt=null;
function ghRemoteTree(){
  var br=GH_REPO.branch||'main';
  var empty={paths:{},head:null,tree:null,empty:true,branch:br};
  return ghTreeAt(br).catch(function(err){
    var st=err&&err.status;
    if(st===409)return empty;
    if(st!==404)throw err;
    return ghApi('GET','').then(function(repo){
      var def=String((repo&&repo.default_branch)||'');
      if(!def||def===br)return empty;
      return ghTreeAt(def).then(function(rt){
        rt.newBranch=br; rt.from=def; return rt;
      },function(e2){
        if(e2&&(e2.status===409||e2.status===404))return empty;
        throw e2;
      });
    });
  }).then(function(rt){ _ghLastRt=rt; return rt; });
}
/* The git data calls cannot build on an empty repository, so its first commit is a README through the contents call; only into one that holds nothing. */
function ghStartEmptyRepo(){
  var txt='# '+GH_REPO.repo+'\n\nCards published from the Conjure card catalog.\n';
  var bytes=new TextEncoder().encode(txt);
  return ghApi('PUT','/contents/README.md',{message:'Start the repository',content:ghB64Bytes(bytes)});
}

function ghTargetNote(rt){
  if(!rt)return '';
  if(rt.empty)return 'The repository is empty - Publish starts it with a README. ';
  if(rt.newBranch)return 'There is no branch "'+rt.newBranch+'" in '+GH_REPO.owner+'/'+GH_REPO.repo
    +' - Publish asks before creating it from "'+rt.from+'". ';
  return '';
}
window.edGhPreview=function(){
  /* Not while another press works: Preview would clear the busy flag Publish holds, and a second Publish could start over the first. */
  if(_ghBusy)return;
  var bad=ghConfigProblem();
  if(bad){ ghPushStatus(bad); return; }
  var blocked=syncBlockedReason(GH_API);
  if(blocked){ ghPushStatus(blocked); return; }
  _ghBusy=true; ghPushStatus('Reading the repository…');
  var files=null, names=null, enc=new TextEncoder();
  var local={};
  return ghFetchManifest().then(function(prev){
    files=ghPayload(prev); names=Object.keys(files);
    return Promise.all(names.map(function(n){
      var bytes=enc.encode(files[n]);
      return ghBlobSha(bytes).then(function(s){ local[n]={sha:s,bytes:bytes}; });
    }));
  }).then(ghRemoteTree).then(function(rt){
    var up=names.filter(function(n){ return rt.paths[n]!==local[n].sha; });
    var art=ghLocalArtUploads().filter(function(u){ return !rt.paths[u.path]; });
    art.forEach(function(u){ up.push(u.path); });
    _ghBusy=false;
    ghPushStatus(ghTargetNote(rt)+(up.length
      ? 'Would upload: '+up.join(', ')+'. Nothing else is touched.'
      : 'Already up to date - the repository matches this catalog.')
      +(art.length>GH_ART_CAP?' '+ghArtCapText(art.length):''));
    return {up:up,local:local,rt:rt};
  }).catch(function(err){
    _ghBusy=false; ghPushStatus('Could not check: '+((err&&err.message)||err));
  });
};

/* An empty repository gets its README; a missing branch is created from the default branch, only when the person agrees, never without history. */
var _ghStarted=false;
function ghPublishTarget(){
  return ghRemoteTree().then(function(rt){
    if(!rt.empty)return rt;
    ghPushStatus('Starting the empty repository with a README…');
    return ghStartEmptyRepo().then(function(){ _ghStarted=true; return ghRemoteTree(); });
  }).then(function(rt){
    if(rt.empty)throw new Error('the repository still reads as empty after its README was written.');
    if(!rt.newBranch)return true;
    return edChooseModal({
      title:'There is no branch "'+rt.newBranch+'"',
      body:GH_REPO.owner+'/'+GH_REPO.repo+' has no branch called "'+rt.newBranch
        +'". Its default branch is "'+rt.from+'".',
      choices:[{key:'create',label:'Create "'+rt.newBranch+'" from "'+rt.from+'" and publish to it',
                detail:'The new branch starts at '+rt.from+'’s latest commit.'}]
    }).then(function(k){ return k==='create'; });
  });
}

window.edGhPublish=function(){
  if(_ghBusy)return;
  var bad=ghConfigProblem()||ghWholeSetProblem();
  if(bad){ ghPushStatus(bad); return; }
  var blocked=syncBlockedReason(GH_API);
  if(blocked){ ghPushStatus(blocked); return; }
  _ghBusy=true; _ghStarted=false; ghPushStatus('Preparing…');
  var files=null, names=null, enc=new TextEncoder();
  var local={};
  /* 'ref' once the commit exists and the branch is moving to it, so a failure there is reported as possibly landed */
  var stage='prep', commitSha='';
  return ghPublishTarget().then(function(go){
    if(go!==true)return go;
  /* Removed cards are deleted on every machine that follows the set, so only a publish that removes some asks first (REMOVE). */
  return ghPublishDiff().then(function(d){
    _ghDiff=d; edRenderOwnerSync();
    /* a copy holding none of what is published there does not publish over it: a new browser or a mistyped repository would replace the set */
    if(!d.first&&!d.kept&&d.removed.length){
      ghPushStatus('This copy holds none of the cards published there. Follow that set and let it '
        +'update before publishing to it. Nothing was committed.');
      return null;
    }
    /* a card moving to Test is in d.toTesting, not a removal */
    if(!d.removed.length)return true;
    var names=d.removed.slice(0,8).map(function(x){ return x.name; });
    if(d.removed.length>8)names.push('and '+(d.removed.length-8)+' more');
    return edDangerGate({
      phrase:'REMOVE',
      title:'This publish removes '+d.removed.length+' published card(s)',
      body:'Anyone following this set gets the removal the next time they sync.',
      lose:names
    });
  },function(err){
    /* an unread repository hides exactly what this is here to catch, so it stops; null, not false, so the line does not say Cancelled */
    ghPushStatus('Could not read what is published, so the removal check could '
      +'not run: '+((err&&err.message)||err)+' Nothing was committed.');
    return null;
  });
  }).then(function(ok){
    if(ok!==true){
      _ghBusy=false;
      if(ok===false)ghPushStatus('Cancelled - nothing was published.');
      return;
    }
  return ghFetchManifest().then(function(prev){
    files=ghPayload(prev); names=Object.keys(files);
    return Promise.all(names.map(function(n){
    var bytes=enc.encode(files[n]);
    return ghBlobSha(bytes).then(function(s){ local[n]={sha:s,bytes:bytes}; });
  })).then(ghRemoteTree).then(function(rt){
    ghPushStatus('Preparing pictures…');
    return ghAddLocalArt(rt,local).then(function(paths){ paths.forEach(function(n){ names.push(n); }); return rt; });
  }).then(function(rt){
    /* never a commit with no parent: an empty repository has its README by now */
    if(!rt.head)throw new Error('the repository has no commit to build on.');
    var up=names.filter(function(n){ return rt.paths[n]!==local[n].sha; });
    if(!up.length){
      _ghBusy=false;
      ghPushStatus(rt.newBranch
        ? 'Nothing to upload - "'+rt.from+'" already holds this catalog, so no branch was created.'
        : 'Already up to date - nothing to do.');
      return;
    }
    ghPushStatus('Uploading '+up.length+' file(s)…');
    return up.reduce(function(p,n){
      return p.then(function(shas){
        return ghApi('POST','/git/blobs',{content:ghB64Bytes(local[n].bytes),encoding:'base64'})
          .then(function(r){
            if(r.sha!==local[n].sha)
              throw new Error('GitHub stored a different hash for '+n+' than this page computed. '
                +'Refusing to build a tree from it.');
            shas[n]=r.sha; return shas;
          });
      });
    },Promise.resolve({})).then(function(shas){
      var entries=up.map(function(n){
        return {path:n,mode:'100644',type:'blob',sha:shas[n]}; });
      var base=rt.tree, i=0;
      function step(){
        if(i>=entries.length)return Promise.resolve(base);
        var body={tree:entries.slice(i,i+GH_TREE_CHUNK)};
        if(base)body.base_tree=base;
        i+=GH_TREE_CHUNK;
        return ghApi('POST','/git/trees',body).then(function(t){ base=t.sha; return step(); });
      }
      return step();
    }).then(function(treeSha){
      ghPushStatus('Committing…');
      return ghApi('POST','/git/commits',
        {message:'Publish from the app: '+up.length+' file(s)',tree:treeSha,parents:[rt.head]});
    }).then(function(commit){
      var br=GH_REPO.branch||'main';
      stage='ref'; commitSha=String(commit.sha||'');
      return (rt.newBranch
        ? ghApi('POST','/git/refs',{ref:'refs/heads/'+br,sha:commit.sha})
        : ghApi('PATCH','/git/refs/heads/'+ghRefPath(br),{sha:commit.sha}))
        .then(function(){ return commit; });
    }).then(function(commit){
      _ghBusy=false; stage='done';
      /* the comparison was of the catalogue before this publish, and a list still saying "1 changed" reads as work left */
      _ghDiff=null;
      ghPushStatus('Published. Commit '+commit.sha.slice(0,10)+'.'
        +(rt.newBranch?' Branch "'+rt.newBranch+'" was created from "'+rt.from+'".':''));
      toast('Published to '+GH_REPO.owner+'/'+GH_REPO.repo);
      try{ ghAfterPublish(); }catch(_){}
    });
  });
  });
  }).catch(function(err){
    _ghBusy=false;
    var m=(err&&err.message)||String(err);
    /* The last step can land and lose its answer: a refusal leaves the branch where it was, but no answer at all says nothing either way. */
    if(stage==='ref'&&!(err&&err.status)){
      ghPushStatus('Publish may have gone through: the connection failed while the branch was '
        +'being moved to commit '+commitSha.slice(0,10)+' ('+m+'). Press Preview changes - '
        +'"Already up to date" means it landed.');
      return;
    }
    ghPushStatus('Publish failed: '+m
      +(_ghStarted
        ? ' The repository was started with a README; nothing else was committed.'
        : ' Nothing was committed - the tree and commit are written last, so the '
          +'branch is untouched.'));
  });
};

/* The sagas that went out are filed under the repository, which is followed, so another machine of yours publishing there reaches this copy. */
function ghAfterPublish(){
  var url=ghTargetUrl(); if(!url)return Promise.resolve();
  var keep=ghPublishSagaSet(), official=ghTargetIsOfficial(), changed=[], ids=[];
  (SAGAS||[]).forEach(function(sg){
    if(!sg||!keep[sg.id]||groupKeyOf(sg)!==GROUP_LOCAL)return;
    if(!sagaCards(sg.id).length)return;
    ids.push(sg.id);
    if(!official){ sg.source=Object.assign({},sg.source||{},{url:url}); delete sg.source.table; changed.push(sg); }
  });
  if(official&&ids.length){
    var list=(OFFICIAL_IDS||bakedSagaIds()).slice();
    ids.forEach(function(id){ if(list.indexOf(id)<0)list.push(id); });
    OFFICIAL_IDS=list; setMetaSafe('officialIds',OFFICIAL_IDS);
  }
  if(!official&&!srcByKey(srcKeyOf(url))){
    var now=new Date().toISOString();
    SOURCES.push({url:url, added:now, lastCheck:now, lastSync:now, skip:[]});
    srcSave();
  }
  return Promise.all(changed.map(sagaPut)).then(srcRender);
}

/* What changed… reads cards.json through the API, not the CDN: a CDN copy can be minutes behind the branch the publish overwrites. */
function ghB64Utf8(b64){
  var raw=atob(String(b64||'').replace(/\s+/g,''));
  var u8=new Uint8Array(raw.length);
  for(var i=0;i<raw.length;i++)u8[i]=raw.charCodeAt(i)&255;
  return new TextDecoder().decode(u8);
}

/* Through the blob API: /contents/ gives an empty content for a blob over 1 MB, with no error, and every card would read as new. */
function ghRemoteCards(path){
  path=path||'cards.json';
  return ghRemoteTree().then(function(rt){
    var sha=rt&&rt.paths&&rt.paths[path];
    if(!sha)return null;
    return ghApi('GET','/git/blobs/'+sha).then(function(r){
      if(!r||!r.content)return null;
      var j; try{ j=JSON.parse(ghB64Utf8(r.content)); }catch(_){ return null; }
      return (j&&Array.isArray(j.cards))?j.cards:null;
    });
  });
}

/* Both sides in published form (ghBuildCards), or every card that only moved machines reads as changed. */
function ghFieldsDiffer(a,b){
  var keys={}, out=[];
  Object.keys(a||{}).forEach(function(k){ keys[k]=1; });
  Object.keys(b||{}).forEach(function(k){ keys[k]=1; });
  Object.keys(keys).sort().forEach(function(k){
    if(k==='__id')return;
    var x=a?a[k]:undefined, y=b?b[k]:undefined;
    /* absent and empty are the same to a reader, and exports differ on which they write */
    var xb=(x==null||x===''||(Array.isArray(x)&&!x.length));
    var yb=(y==null||y===''||(Array.isArray(y)&&!y.length));
    if(xb&&yb)return;
    var xs,ys;
    try{ xs=JSON.stringify(x); ys=JSON.stringify(y); }
    catch(_){ xs=String(x); ys=String(y); }
    if(xs!==ys)out.push(k);
  });
  return out;
}

var _ghDiff=null;
/* By the card's id (cardIndex): keyed by saga and name, a moved or renamed card reads as new plus gone, and REMOVE fires for a move. */
/* `held`: the Test cards. A published card now in Test is toTesting, not gone, so REMOVE does not fire for it. */
function ghCardsDiff(mine,theirs,held){
  var list=(theirs||[]).filter(Boolean), ix=cardIndex(list);
  var added=[], changed=[], removed=[], toTesting=[], seen={};
  var hix=cardIndex((held||[]).filter(Boolean));
  (mine||[]).forEach(function(c){
    if(!c)return;
    var at=ix.at(c);
    if(at==null||seen[at]){ added.push({name:c.name||mergeKey(c), saga:sagaIdOf(c)}); return; }
    seen[at]=1;
    var old=list[at];
    var f=ghFieldsDiffer(old,c);
    if(!f.length)return;
    var how=[];
    if(sagaIdOf(old)!==sagaIdOf(c))how.push('moved from '+sagaIdOf(old)+' to '+sagaIdOf(c));
    if(normName(old.name)!==normName(c.name))how.push('renamed from '+old.name);
    changed.push({name:c.name||mergeKey(c), saga:sagaIdOf(c), fields:how.concat(f)});
  });
  list.forEach(function(c,i){
    if(seen[i])return;
    var row={name:c.name||mergeKey(c), saga:sagaIdOf(c)};
    if(hix.has(c))toTesting.push(row); else removed.push(row);
  });
  return {added:added, changed:changed, removed:removed, toTesting:toTesting,
          total:added.length+changed.length+removed.length+toTesting.length,
          kept:Object.keys(seen).length, first:!theirs};
}
/* a report, never a gate: only the copy that owns the source reads testing.json */
function ghTestingDiff(mine,theirs){
  var d=ghCardsDiff(mine,theirs);
  return {added:d.added, changed:d.changed, removed:d.removed, count:(mine||[]).length,
          total:d.added.length+d.changed.length+d.removed.length};
}

/* capped: a first publish of the whole catalogue is not a review, and the count already says how big it is */
var GH_DIFF_SHOW = 40;
function ghDiffLines(d){
  var out=[];
  function push(list,word,withFields){
    list.slice(0,GH_DIFF_SHOW).forEach(function(x){
      out.push(word+' '+x.name+' ['+x.saga+']'
        +(withFields&&x.fields?' — '+x.fields.join(', '):''));
    });
    if(list.length>GH_DIFF_SHOW)
      out.push('… and '+(list.length-GH_DIFF_SHOW)+' more '+word.toLowerCase());
  }
  push(d.added,'New');
  push(d.changed,'Changed',true);
  push(d.removed,'Gone');
  push(d.toTesting||[],'Removed (Testing)');
  if(d.testing){
    push(d.testing.added,'Test New');
    push(d.testing.changed,'Test Changed',true);
    push(d.testing.removed,'No Longer Test');
  }
  return out;
}
function ghPublishDiff(){
  return Promise.all([ghRemoteCards('cards.json'),ghRemoteCards('testing.json')]).then(function(r){
    var held=ghBuildTesting();
    var d=ghCardsDiff(ghBuildCards(),r[0],held);
    d.testing=ghTestingDiff(held,r[1]);
    return d;
  });
}
function ghDiffSummary(d){
  var s=d.added.length+' new, '+d.changed.length+' changed, '+d.removed.length+' removed';
  if(d.toTesting&&d.toTesting.length)s+=', '+d.toTesting.length+' moved to Test';
  if(d.testing&&d.testing.count)s+=' · '+d.testing.count+' Test card(s) in testing.json only';
  return s;
}

window.edGhWhatChanged=function(){
  if(_ghBusy)return;
  var bad=ghConfigProblem();
  if(bad){ ghPushStatus(bad); return; }
  var blocked=syncBlockedReason(GH_API);
  if(blocked){ ghPushStatus(blocked); return; }
  _ghBusy=true; ghPushStatus('Reading the published cards…');
  _ghLastRt=null;
  return ghPublishDiff().then(function(d){
    _ghDiff=d;
    _ghBusy=false;
    edRenderOwnerSync();
    ghPushStatus(ghTargetNote(_ghLastRt)+(d.first
      ? 'Nothing is published yet — all '+d.added.length+' cards would be new.'
      : ((d.total||(d.testing&&d.testing.total))
          ? ghDiffSummary(d)+'.'
          : 'No card differs from what is published.')));
    return d;
  }).catch(function(err){
    _ghBusy=false;
    ghPushStatus('Could not compare: '+((err&&err.message)||err));
  });
};
window.edGhDiff=function(){ return _ghDiff; };
/* for the checks: the diff of any two card lists, without a token or a network */
window.edGhCardsDiff=function(mine,theirs,held){ return ghCardsDiff(mine,theirs,held); };

/* Nothing until a comparison has run: an empty box would read as "no changes". */
function ghDiffHTML(){
  var d=_ghDiff;
  if(!d)return '';
  if(!d.total&&!(d.testing&&d.testing.total))
    return "<div class='gh-diff'><b>No card differs</b> from what is published.</div>";
  var lines=ghDiffLines(d);
  return "<div class='gh-diff'>"
    +"<b>"+e(ghDiffSummary(d))+(d.first?' (nothing is published yet)':'')+"</b>"
    +"<ul class='gh-difflist'>"
    +lines.map(function(l){ return "<li>"+e(l)+"</li>"; }).join('')
    +"</ul></div>";
}

/* btoa takes nothing above U+00FF; 32 KB slices avoid a concatenation per byte and fromCharCode.apply's argument limit. */
function ghB64Bytes(u8){
  var CH=0x8000, parts=[];
  for(var i=0;i<u8.length;i+=CH)
    parts.push(String.fromCharCode.apply(null,u8.subarray(i,Math.min(i+CH,u8.length))));
  return btoa(parts.join(''));
}
/* Kept, not only shown: the page is redrawn whenever the sources change, as at the end of a publish, which would wipe the line. */
var _ghPushMsg='';
function ghPushStatus(msg){
  _ghPushMsg=String(msg==null?'':msg);
  var el=document.getElementById('ghPushMsg');
  if(el)el.textContent=_ghPushMsg;
}


/* Not a toast: toast() hides itself and .ed-toast is pointer-events:none, so it cannot be pressed. */
function ghBadge(diff){
  var host=document.querySelector('header'); if(!host)return;
  var old=document.getElementById('ghBadge'); if(old)old.remove();
  if(!diff||(!diff.added&&!diff.changed&&!diff.removed))return;
  var b=document.createElement('button');
  b.id='ghBadge'; b.className='tab-link-btn gh-badge';
  b.title='An update is available from the set this catalog follows — press to take it';
  /* no number: a count read as a chore, and the press does the whole thing */
  b.textContent='↻ Update Available';
  b.onclick=function(){ window.edGhUpdateNow(); };
  var grp=host.querySelector('div[style*="margin-left:auto"]');
  if(grp)grp.insertBefore(b,grp.firstChild); else host.appendChild(b);
  /* --chrome is measured only at load and on resize, so a badge added later nudges that listener */
  try{ window.dispatchEvent(new Event('resize')); }catch(_){}
}

/* scSyncBody is this window's body; the id is from when it was a tab of the Help window. */
window.edOpenOwnerSync=function(){
  var ov=document.getElementById('edSyncOverlay');
  if(!ov){
    ov=document.createElement('div'); ov.id='edSyncOverlay'; ov.className='ed2-overlay';
    ov.innerHTML="<div class='ed2-modal ed2-modal-wide'><div class='ed2-modal-head wh'>"
      +"<b class='wh-t'>Owner Sync</b><span class='sg-head-gap'></span>"
      +"<button class='ed2-btn close-x nb nb-red nb-m wh-x' onclick='edCloseOwnerSync()'>Close &#10005;</button></div>"
      +"<div class='ed2-modal-body'><div id='scSyncBody'></div></div></div>";
    document.body.appendChild(ov);
    ov.addEventListener('click',function(ev){ if(ev.target===ov)window.edCloseOwnerSync(); });
  }
  ov.style.display='flex';
  edRenderOwnerSync();
};
window.edCloseOwnerSync=function(){
  var o=document.getElementById('edSyncOverlay'); if(o)o.style.display='none';
};

function ghRow(label,hint,control){
  return "<div class='gh-row'><div class='gh-lbl'>"+e(label)+"</div>"
    +"<div class='gh-ctl'>"+control+"</div>"
    +(hint?"<div class='gh-hint'>"+e(hint)+"</div>":"")+"</div>";
}

/* Before the official set arrives an empty catalogue says why, not "No cards match."; state lines only (HANDOFF §12.1 E). */
window.edGhEmptyState=function(){
  if(window.REBIRTH)return null;
  var st=_ghState||{};
  var why=GH_SOURCE?syncBlockedReason(GH_SOURCE):'No source address set.';
  if(st.busy)return {line:'Loading the official catalogue…'};
  if(why)return {line:why};
  if(st.err)return {line:'Could not reach the official catalogue', btn:'Try again'};
  if(st.pkg)return {line:'The official catalogue is ready', btn:'Load it'};
  if(!GH_AUTOCHECK)return {line:'Automatic updates are off', btn:'Load the official catalogue'};
  return {line:'Loading the official catalogue…'};
};
/* only an empty grid is redrawn from here */
function ghEmptyRefresh(){
  try{
    if(!window.REBIRTH&&!(window.CARDS||[]).length&&typeof window.run==='function')window.run();
  }catch(_){}
}
function edRenderOwnerSync(){
  ghEmptyRefresh();
  var host=document.getElementById('scSyncBody');
  if(!host)return;
  var st=_ghState||{}, d=st.diff;
  var msg='', cls='';
  if(st.busy){ msg='Checking…'; }
  else if(st.err){ msg='Could not check: '+st.err; cls=' warn'; }
  else if(d&&(d.added||d.changed||d.removed)){
    msg='Update available — '+d.added+' new, '+d.changed+' changed, '
      +(d.removed?d.removed+' removed, ':'')+d.same+' already match.';
    cls=' on';
  }
  else if(d){ msg='Up to date — all '+d.total+' card(s) match the source.'; }
  else { msg='Not checked yet.'; }

  var h="<div class='gh-page'>";

  /* the button then the field, on one row, and no sentence under either (HANDOFF §12.1 E) */
  h+="<div class='gh-sec'><h4>Saga Github Source Address</h4>"
    +"<div class='gh-onerow'>"
    +"<button class='ed2-btn primary' onclick='edGhCheck()'"+(st.busy?' disabled':'')+">Check now</button>"
    /* read-only: another set is followed from the Sagas page; only edGhSetSource, from the console, changes this (HANDOFF §10, O38) */
    +"<input class='ed2-in' id='ghSrc' type='text' readonly value=\""+e(GH_SOURCE)+"\" "
    +"title='Built in - this is where the official sagas come from'>"
    +(GH_SOURCE!==GH_DEFAULT_SOURCE
      ?"<button class='ed2-btn tiny' id='ghSrcReset' onclick='edGhResetSource()'"
       +" title='Back to the built-in address'>Reset</button>":"")
    +"</div>"
    +"<div class='gh-btns'>"
    +(d&&(d.added||d.changed||d.removed)
      ?"<button class='ed2-btn primary' onclick='edGhApply()'>Apply update…</button>":"")
    /* its own press: the look replaces every template asset here, never a side effect of a card update */
    +((st.lookPkg&&st.lookPkg.look)
      ?"<button class='ed2-btn info' onclick='edGhApplyLook()'>Apply the set’s look…</button>":"")
    +"</div>"
    +"<div class='gh-msg"+cls+"'>"+e(msg)+"</div>"
    /* a state line, counted (HANDOFF §12.1 E) */
    +((st.lookPkg&&st.lookPkg.look)
      ?("<div class='gh-msg'>This source also publishes a look — "
        +Object.keys(st.lookPkg.look.slots||{}).length+" template asset(s)"
        +((st.lookPkg.marks||[]).length?(", "+st.lookPkg.marks.length+" watermark(s)"):'')
        +".</div>")
      :'')
    /* The weekly run has no switch: Enable Automatic Updates on Open, beside it, does not stop it (ghWeeklyMaybe). */
    +"<div class='gh-onerow gh-toggles'>"
    +"<button class='ed2-btn tiny' onclick='edGhWeeklyRun()'"
    +" title='Every saga with a source, now'>Sync All Sagas</button>"
    +"<label title='Takes the update as the catalog opens. In owner mode it only "
    +"tells you, and the badge waits for your press.'><input type='checkbox'"+(GH_AUTOCHECK?' checked':'')
    +" onchange='edGhSetAutoCheck(this.checked)'> Enable Automatic Updates on Open</label>"
    +(GH_WEEKLY_LAST
        ?"<span class='gh-hint'>Last run "+e(String(GH_WEEKLY_LAST).slice(0,10))+"</span>":'')
    +"</div>"
    +"</div>";

  /* No set kit here (HANDOFF §62); tools/make_setkit.py keeps it. */
  h+="<div class='gh-sec'>"
    +"<div class='gh-h4row'><h4>Publish to GitHub</h4>"
    +"<label class='gh-h4ctl' title='Use this if you are publishing cards with art "
    +"stored on this computer. Toggling on preserves local card art files.'>"
    +"<input type='checkbox'"+(GH_OWNER_MODE?' checked':'')
    +" onchange='edGhSetOwnerMode(this.checked)'> I own this set</label></div>"
    +ghRow('Repository','',
        "<input class='ed2-in tiny' type='text' value=\""+e(GH_REPO.owner)+"\" placeholder='username' "
        +"onchange=\"edGhSetRepo('owner',this.value,1)\"> / "
        +"<input class='ed2-in tiny' type='text' value=\""+e(GH_REPO.repo)+"\" placeholder='repository' "
        +"onchange=\"edGhSetRepo('repo',this.value,1)\"> @ "
        +"<input class='ed2-in tiny' type='text' value=\""+e(GH_REPO.branch||'main')+"\" placeholder='main' "
        +"onchange=\"edGhSetRepo('branch',this.value,1)\">")
    +ghRow('Access token','',
        (GH_TOKEN
          ?"<span class='gh-tok'>•••••••• until this page closes</span>"
          /* A plain text box, on purpose (HANDOFF §62); autocomplete off keeps the token out of the form history. */
          :"<input class='ed2-in' type='text' autocomplete='off' spellcheck='false'"
           +" autocapitalize='off' placeholder='paste your access token' "
           +"onchange='edGhSetToken(this.value,1)'>")
        +(ghTokenHeld()
          ?" "+(function(){
              var d=ghTokenDays();
              if(d==null)return '';
              var when=new Date(GH_TOKEN_SINCE);
              return "<span class='gh-age' title='In use since "+e(when.toDateString())
                +". A token with no expiry is worth replacing now and then.'>in use "
                +d+" day"+(d===1?'':'s')+"</span> ";
            })()
           +"<button class='ed2-btn danger' onclick='edGhForgetToken()'>Forget it</button>"
          :''))
    +"<div class='gh-msg' id='ghTargetMsg'>"+e(_ghTargetMsg)+"</div>"
    +"<div class='gh-btns'>"
    +"<button class='ed2-btn' onclick='edGhPreview()'"
    +" title='Which FILES would be uploaded'>Preview changes</button>"
    +"<button class='ed2-btn' onclick='edGhWhatChanged()'"
    +" title='Which CARDS differ from the ones already published, and in which"
    +" fields'>What changed…</button>"
    +"<button class='ed2-btn primary' onclick='edGhPublish()'>Publish</button>"
    +"</div>"
    +ghDiffHTML()
    +"<div class='gh-msg' id='ghPushMsg'>"+e(_ghPushMsg)+"</div>"
    +"</div>";


  h+="</div>";
  host.innerHTML=h;
}
window.edRenderOwnerSync=edRenderOwnerSync;

window.edSources=function(){
  return srcAll().map(function(s){
    var st=srcState(s)||{};
    return {key:s.key, url:s.url, official:!!s.official, owned:srcOwned(s),
            label:s.official?'Official':groupLabel(s.url), lastCheck:s.lastCheck||'',
            lastSync:s.lastSync||'', skip:(s.skip||[]).slice(), busy:!!st.busy, err:st.err||'',
            pending:!!(st.pkg&&st.diff&&(st.diff.added||st.diff.changed||st.diff.removed)),
            diff:st.diff||null};
  });
};
window.edFollowSource=function(url){
  url=String(url||'').trim();
  if(!url)return Promise.resolve(null);
  var key=srcKeyOf(url);
  if(key===normGroupUrl(GH_DEFAULT_SOURCE)||key===normGroupUrl(GH_SOURCE)){
    toast('That is the Official source - it is always followed');
    return Promise.resolve(srcOfficial());
  }
  var why=syncBlockedReason(url);
  if(why){ toast(why); return Promise.resolve(null); }
  var s=srcByKey(key);
  if(!s){
    s={url:url, added:new Date().toISOString(), lastCheck:'', lastSync:'', skip:[]};
    SOURCES.push(s); srcWrap(s); srcSave();
  }
  _srcChecked[s.key]=1;
  srcRender();
  return ghCheckSource(s).then(function(){ return ghAutoApply(s); }).then(function(){
    var st=srcState(s);
    if(st&&st.err)toast('Could not read that set: '+st.err);
    return s;
  });
};
window.edSyncSourceNow=function(key){
  var s=srcByKey(key);
  if(!s)return Promise.resolve(null);
  var check=s.official?window.edGhCheck():ghCheckSource(s);
  return Promise.resolve(check).then(function(){ return ghAutoApply(s.official?null:s); });
};
window.edApplySource=function(key){
  var s=srcByKey(key);
  return s?ghApplyUpdate(true,s.official?null:s):Promise.resolve();
};
/* Gated, as it takes cards off this copy; never the Official source. */
window.edUnfollowSource=function(key){
  var s=srcByKey(key);
  if(!s||s.official)return Promise.resolve(false);
  var sagas=(SAGAS||[]).filter(function(sg){ return groupKeyOf(sg)===s.key; });
  var ids={}; sagas.forEach(function(sg){ ids[sg.id]=1; });
  var only=(window.CARDS||[]).filter(function(c){
    return c&&!c.local&&sagaIdsOf(c).every(function(id){ return ids[id]; }); });
  var shared=(window.CARDS||[]).filter(function(c){
    return c&&only.indexOf(c)<0&&sagaIdsOf(c).some(function(id){ return ids[id]; }); });
  return edDangerGate({
    title:'Stop following '+groupLabel(s.url),
    lose:[sagas.length+' saga(s) from it',
          only.length+' card(s) that are only in those sagas',
          'Updates from it'].concat(shared.length
            ?[shared.length+' card(s) also in a saga of yours are KEPT - they only leave its sagas']:[]),
    phrase:'UNFOLLOW',
    proceedLabel:'Stop following'
  }).then(function(ok){
    if(!ok){ toast('Cancelled - nothing was changed'); return false; }
    var gone={}; only.forEach(function(c){ gone[c.__id]=1; });
    window.CARDS=(window.CARDS||[]).filter(function(c){ return !gone[c.__id]; });
    shared.forEach(function(c){
      Object.keys(ids).forEach(function(id){ removeSagaMembership(c,id); });
      markDirty(c);
    });
    SAGAS=SAGAS.filter(function(sg){ return !ids[sg.id]; });
    SOURCES=SOURCES.filter(function(x){ return srcKeyOf(x.url)!==s.key; });
    delete _srcState[s.key]; srcSave();
    return Promise.all(only.map(function(c){
        return put('cards',{id:c.id||uid(),name:c.name,cid:cardCid(c),sagaId:sagaIdOf(c),
                            saga:c.saga,__deleted:true}); })
      .concat(shared.map(persistCard))
      .concat(sagas.map(function(sg){ return del('sagas',sg.id); })))
      .then(function(){
        applyToCatalog(); refreshSagaFilter(); ghBadgeRefresh(); srcRender();
        toast('Stopped following '+groupLabel(s.url));
        return true;
      });
  });
};

/* A table copy is filed under the person it came from: read-only, never published, and taken over by its source once that is followed (srcClaimSagas).
   What is sent names nothing only this machine's: pictures as p0, p1 and on, a card made here by an id worked out from its own and the Saga's. */
var TBL_PIC_CAP=60, TBL_PIC_BYTES=15*1024*1024;
window.edSagaPackage=function(id){
  var tag=function(s){
    s=String(s); var a=2166136261, b=5381;
    for(var i=0;i<s.length;i++){ var ch=s.charCodeAt(i); a=Math.imul(a^ch,16777619); b=(Math.imul(b,33)^ch)|0; }
    return (a>>>0).toString(36)+(b>>>0).toString(36);
  };
  var sg=sagaById(id); if(!sg)return Promise.resolve(null);
  var keep={}; keep[id]=1;
  var list=sagaCards(id).filter(function(c){ return c&&!c.testing&&!c.__deleted; });
  var keys={}, order=[];
  var cards=list.map(function(c){
    var o=ghPublishedForm(c,keep);
    delete o.id;                                   /* where it is stored here */
    if(c.local)o.cid='t'+tag(id+'|'+(c.cid||c.__id||c.name||''));
    var src=artBearers(c), out=artBearers(o);
    src.forEach(function(b,i){
      var lk=ghLocalArtKey(b);
      if(!lk||!out[i])return;
      if(!keys[lk]){ keys[lk]='p'+order.length; order.push(lk); }
      out[i].art=keys[lk]; out[i].imageUrl='';
    });
    return o;
  });
  var pics={}, sent=0, bytes=0, skipped=0;
  return order.reduce(function(pr,k){
    return pr.then(function(){
      if(sent>=TBL_PIC_CAP||bytes>=TBL_PIC_BYTES){ skipped++; return; }
      return ghWebpBytes(k).then(function(u8){
        if(bytes+u8.length>TBL_PIC_BYTES){ skipped++; return; }
        bytes+=u8.length; pics[keys[k]]=ghB64Bytes(u8); sent++;
      },function(){ skipped++; });
    });
  },Promise.resolve()).then(function(){
    var kw=(window.KW_DATA||[]).filter(function(k){ return k&&k.__custom; })
      .map(function(k){ var x=JSON.parse(JSON.stringify(k)); delete x.__custom; delete x.__id; return x; });
    return {v:1, saga:{id:sg.id, name:sg.name||sg.id, author:sg.author||'', version:sg.version||'1.0',
                       description:sg.description||''},
            cards:cards, pics:pics, skipped:skipped, kw:kw};
  });
};
window.edImportTableCopy=function(pkg,from){
  var own=Object.prototype.hasOwnProperty;
  var isObj=function(v){ return !!v&&typeof v==='object'&&!Array.isArray(v); };
  var txt=function(v,max){
    if((typeof v==='number'&&isFinite(v))||typeof v==='boolean')v=String(v);
    if(typeof v!=='string')return null;
    return v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g,'').slice(0,max||20000);
  };
  var line=function(v,max){ var s=txt(v,max||200); return s==null?'':s.replace(/\s+/g,' ').trim(); };
  var list=function(v){
    return Array.isArray(v)?v.slice(0,100).map(function(x){ return line(x,200); }).filter(Boolean):[];
  };
  var web=function(v){
    return (typeof v==='string'&&v.length<=2000&&/^https?:\/\/[^\s<>"'`\\]+$/i.test(v))?v:'';
  };
  var flat=function(v){
    var o={};
    if(!isObj(v))return o;
    Object.keys(v).slice(0,80).forEach(function(k){
      if(!/^[A-Za-z][A-Za-z0-9]{0,40}$/.test(k))return;
      var x=v[k];
      if(typeof x==='string')o[k]=txt(x,2000);
      else if((typeof x==='number'&&isFinite(x))||typeof x==='boolean')o[k]=x;
    });
    return o;
  };
  /* must match edSagaPackage's tag */
  var tag=function(s){
    s=String(s); var a=2166136261, b=5381;
    for(var i=0;i<s.length;i++){ var ch=s.charCodeAt(i); a=Math.imul(a^ch,16777619); b=(Math.imul(b,33)^ch)|0; }
    return (a>>>0).toString(36)+(b>>>0).toString(36);
  };
  if(!isObj(pkg)||!isObj(pkg.saga)||!Array.isArray(pkg.cards))return Promise.resolve(null);
  from=line(from,40)||'Player';
  var id=line(pkg.saga.id,200);
  if(!id)return Promise.resolve(null);
  var ex=sagaById(id), k=ex?groupKeyOf(ex):'';
  if(ex&&k!==GROUP_LOCAL&&k.indexOf('table:')!==0){
    toast((ex.name||id)+' comes from its source here');
    return Promise.resolve(null);
  }
  /* nor one holding a card you can edit: a saga of yours whatever its record says, or cards of yours under that name with no record */
  if(k.indexOf('table:')!==0&&sagaCards(id).some(function(c){ return c&&!c.__deleted&&!edCardLocked(c); })){
    toast('You have a saga of your own called '+((ex&&ex.name)||id));
    return Promise.resolve(null);
  }
  var rec=ex||{id:id, builtin:false, enabled:true, mode:(window.REBIRTH?'rebirth':'main'), look:null,
               created:new Date().toISOString()};
  rec.name=line(pkg.saga.name,80)||rec.name||id;
  rec.author=line(pkg.saga.author,80)||rec.author||'';
  rec.version=line(pkg.saga.version,20)||rec.version||'1.0';
  rec.description=txt(pkg.saga.description,2000)||rec.description||'';
  rec.enabled=true;
  rec.source={url:'', table:from, lastSync:new Date().toISOString()};
  /* pictures first, so the cards draw on arrival, each under this copy's own names so none lands on a picture of yours */
  var ns='tc_'+tag(id)+'_', picKey={}, pics=isObj(pkg.pics)?pkg.pics:{}, room=TBL_PIC_BYTES*1.4;
  Object.keys(pics).slice(0,TBL_PIC_CAP).forEach(function(key){
    var b64=pics[key];
    if(!/^[A-Za-z0-9_.\-]{1,120}$/.test(key)||typeof b64!=='string'||b64.length>room)return;
    var bl=dataUrlToBlob('data:image/webp;base64,'+b64);
    if(!bl)return;
    room-=b64.length;
    picKey[key]=ns+key;
    artPut(ns+key,bl);
  });
  /* the fields the face, the filter and the editor read, each as its type, and nothing that says where or whose it is here */
  var TEXT=['arcane','artist','attack','cmc','designer','flavor','health','lastUpdated','manaCost','revision',
            'ruleText','variant','frame','mark','choiceText','rarity','range'];
  var LISTS=['colors','superTypes','subTypes','kwReminders'];
  var NUMS=['rulesSplit','flavorRows','choiceRows'];
  var BOOLS=['splitIdent','splitChoice'];
  var SKIP={name:1,cid:1,id:1,local:1,testing:1,orphan:1,sagaIds:1,sagaId:1,saga:1,sagaFields:1,
            art:1,imageUrl:1,orbs:1,variants:1,sections:1,artXf:1,borderLook:1};
  TEXT.concat(LISTS,NUMS,BOOLS).forEach(function(f){ SKIP[f]=1; });
  var pic=function(src,dst){
    var a=src.art;
    dst.art=(typeof a==='string'&&own.call(picKey,a))?picKey[a]:web(a);
    dst.imageUrl=web(src.imageUrl);
  };
  var card=function(c){
    if(!isObj(c))return null;
    var name=line(c.name,200);
    if(!name)return null;
    var o=flat(c);
    Object.keys(o).forEach(function(f){ if(own.call(SKIP,f))delete o[f]; });
    o.name=name;
    TEXT.forEach(function(f){ var v=txt(c[f]); if(v!=null)o[f]=v; });
    LISTS.forEach(function(f){ if(f!=='kwReminders'||c[f]!==undefined)o[f]=list(c[f]); });
    NUMS.forEach(function(f){
      var v=c[f], n=(typeof v==='string')?parseFloat(v):v;
      if(typeof n==='number'&&isFinite(n))o[f]=(typeof v==='string')?txt(v,20):v;
    });
    BOOLS.forEach(function(f){ if(typeof c[f]==='boolean')o[f]=c[f]; });
    var cid=line(c.cid,80);
    if(cid)o.cid=cid;
    if(Array.isArray(c.orbs))o.orbs=c.orbs.slice(0,40).filter(isObj).map(flat);
    if(Array.isArray(c.sections))o.sections=c.sections.slice(0,8).filter(isObj).map(function(s){
      var x=flat(s); x.superTypes=list(s.superTypes); x.subTypes=list(s.subTypes); return x; });
    if(isObj(c.artXf))o.artXf=flat(c.artXf);
    if(isObj(c.borderLook))o.borderLook=flat(c.borderLook);
    pic(c,o);
    if(Array.isArray(c.variants))o.variants=c.variants.slice(0,40).filter(isObj).map(function(v){
      var x=flat(v);
      if(isObj(v.artXf))x.artXf=flat(v.artXf);
      pic(v,x);
      return x;
    });
    return o;
  };
  var KW_MODES={keyword:1,keyterm:1,counter:1,dice:1,damage:1}, KW_PARAMS={none:1,number:1,cost:1};
  var plain=function(s){ return !!s&&!/['"\\<>&`]/.test(s); };
  var kword=function(x){
    if(!isObj(x))return null;
    var name=line(x.name,60);
    if(!plain(name))return null;
    var match=line(x.match,60);
    var o={name:name, mode:(typeof x.mode==='string'&&own.call(KW_MODES,x.mode))?x.mode:'keyword',
           match:plain(match)?match:name, reminder:txt(x.reminder,2000)||'',
           reminderBare:txt(x.reminderBare,2000)||'',
           param:(typeof x.param==='string'&&own.call(KW_PARAMS,x.param))?x.param:'none'};
    if(typeof x.matchAlt==='string')o.matchAlt=x.matchAlt.split(/[\n,]/).map(function(m){ return line(m,60); })
      .filter(plain).slice(0,20).join(',');
    if(o.mode==='damage'){
      o.dmgKind=(x.dmgKind==='class')?'class':'type';
      o.dmgClass=list(x.dmgClass).slice(0,10);
      var rp=line(x.replaces,60);
      if(plain(rp))o.replaces=rp;
    }
    if(x.__alias===true)o.__alias=true;
    return o;
  };
  var o={key:'table:'+from, url:'', official:false, table:from, sagaSet:{}, names:{}, skip:{}, owned:false};
  o.sagaSet[id]=1; o.names[id]=rec.name;
  /* An arriving card whose id one of yours holds gets one of its own, from the Saga's and its own so the next copy finds it; yours is untouched. */
  var byCid={};
  (window.CARDS||[]).forEach(function(c){ if(c&&c.cid&&!own.call(byCid,c.cid))byCid[c.cid]=c; });
  var cards=pkg.cards.slice(0,5000).map(card).filter(Boolean).map(function(x){
    x.sagaIds=[id]; x.sagaId=id; x.saga=rec.name;
    while(x.cid&&own.call(byCid,x.cid)&&!edCardLocked(byCid[x.cid]))x.cid='t'+tag(id+'|'+x.cid);
    return x;
  });
  var kw=(Array.isArray(pkg.kw)?pkg.kw.slice(0,300):[]).map(kword).filter(Boolean);
  var skipped=(typeof pkg.skipped==='number'&&isFinite(pkg.skipped))?Math.max(0,Math.min(1e4,Math.floor(pkg.skipped))):0;
  return sagaPut(rec).then(function(){ return importCardRows(cards,'',o); }).then(function(r){
    try{ kwExtraAdd(kw); }catch(_){}
    applyToCatalog(); try{ refreshSagaFilter(); }catch(_){}
    srcRender();
    var n=(r&&r.n)||0;
    toast('Got '+rec.name+' from '+from+' - '+n+' card(s)'
      +(skipped?(', '+skipped+' picture(s) too large to send'):''));
    return r;
  });
};

/* setTimeout, never rAF: rAF does not fire in the automation browser pane. */
function ghAutoCheck(){
  if(_ghChecked||_ghWeeklyOnOpen)return;
  if(!GH_SOURCE||syncBlockedReason(GH_SOURCE))return;
  /* A promise either way, so boot can say when the open is over (CONJURE_OPENED, ed2_boot.js). */
  if(!GH_AUTOCHECK){
    _ghWeeklyOnOpen=true;
    return new Promise(function(done){
      setTimeout(function(){ var w; try{ w=ghWeeklyMaybe(); }catch(_){} done(w); },1200);
    });
  }
  _ghChecked=true;
  return new Promise(function(done){ setTimeout(function(){
    try{ ghRefreshOfficialIndex(); }catch(_){}
    /* the Official source, then each followed one in turn, and only then the weekly run, which would otherwise repeat it all in the same second */
    var run;
    try{
      run=Promise.resolve(window.edGhCheck()).then(function(){
        try{ return ghAutoApply(); }catch(_){}
      }).then(function(){ return srcEachFollowed(true); })
        .then(function(){ try{ return ghWeeklyMaybe(); }catch(_){} });
    }catch(e){ done(); throw e; }
    done(run);
  },1200); });
}
function srcEachFollowed(apply){
  return SOURCES.map(srcWrap).reduce(function(p,s){
    return p.then(function(){
      if(!s.url||syncBlockedReason(s.url))return;
      _srcChecked[s.key]=1;
      return ghCheckSource(s).then(function(){ if(apply)return ghAutoApply(s); });
    }).catch(function(){});
  },Promise.resolve());
}
function ghBadgeRefresh(){
  var tot={added:0,changed:0,removed:0};
  srcAll().forEach(function(s){
    var st=srcState(s);
    if(st&&st.pkg&&st.diff){
      tot.added+=st.diff.added||0; tot.changed+=st.diff.changed||0; tot.removed+=st.diff.removed||0;
    }
  });
  ghBadge((tot.added||tot.changed||tot.removed)?tot:null);
}

/* A reader's copy takes an update by itself: it stops only for a card of theirs to lose (ghWouldOverwriteOwnWork) or where the set comes from.
   Every refusal leaves the state and the badge as the check left them, so the update is still one press away. */
function ghAutoApply(src){
  src=src||srcOfficial();
  var st=srcState(src);
  if(!st||st.err||!st.pkg)return Promise.resolve(null);
  var d=st.diff;
  if(!d||(!d.added&&!d.changed&&!d.removed))return Promise.resolve(null);
  if(src.official&&GH_OWNER_MODE)return Promise.resolve(null);
  if(!src.official&&srcOwned(src))return Promise.resolve(null);
  /* Nor on the official token holder's copy, switch or not: a card deleted there but not yet published would come straight back. */
  if(src.official&&edOwnerUnlocked())return Promise.resolve(null);
  if(ghWouldOverwriteOwnWork(ghIncoming(st.pkg.cards,src),st.ctx))return Promise.resolve(null);
  /* down before the apply: a badge that vanishes a second later, unpressed, reads as a failure */
  ghBadge(null);
  return ghApplyUpdate(false,src);
}

/* A closed page cannot run, so "every Friday" is the first open on or after the Friday it is due; there is no switch. */
var GH_WEEK_MS=7*24*60*60*1000;
var _ghWeeklyOnOpen=false;

function ghNextFriday(from){
  var d=new Date(from.getFullYear(),from.getMonth(),from.getDate());
  d.setDate(d.getDate()+((5-d.getDay())+7)%7);
  return d;
}
function ghWeeklyDue(lastIso,now){
  now=now||new Date();
  if(!lastIso)return true;
  var last=new Date(lastIso);
  if(isNaN(last.getTime()))return true;
  return now.getTime()>=ghNextFriday(new Date(last.getTime()+GH_WEEK_MS/7)).getTime();
}

function ghWeeklyMaybe(){
  if(!ghWeeklyDue(GH_WEEKLY_LAST))return Promise.resolve(null);
  return ghWeeklyRun();
}
/* the Sync All Sagas button, forced past a read a moment ago */
window.edGhWeeklyRun=function(){ return ghWeeklyRun(true); };

/* Every source by the same rule as on open: each goes through ghAutoApply, so a source you own keeps its update behind the badge. */
function ghWeeklyRun(force){
  var list=srcAll().filter(function(s){ return s.url&&!syncBlockedReason(s.url); });
  var added=0, held=0, failed=0;
  return list.reduce(function(p,s){
    return p.then(function(){
      /* read by the check on open a moment ago: not again */
      if(!force&&_srcCheckedAt[s.key]&&Date.now()-_srcCheckedAt[s.key]<60000)return;
      return ghCheckSource(s).then(function(){
        var st=srcState(s);
        if(!st||st.err||!st.pkg){ failed++; return; }
        var d=st.diff||{};
        var n=(d.added||0)+(d.changed||0)+(d.removed||0);
        if(!n)return;
        return Promise.resolve(ghAutoApply(s)).then(function(){
          var st2=srcState(s);
          if(st2&&st2.pkg)held+=n; else added+=(d.added||0)+(d.changed||0);
        });
      });
    }).catch(function(){ failed++; });
  },Promise.resolve()).then(function(){
    GH_WEEKLY_LAST=new Date().toISOString();
    setMetaSafe('ghWeeklyLast',GH_WEEKLY_LAST);
    if(added||held){
      toast('Weekly sync: '+added+' card(s) updated'
        +(held?', '+held+' change(s) waiting for you':''));
    }
    ghBadgeRefresh();
    srcRender();
    var res={added:added,held:held,failed:failed,checked:list.length};
    return ghSyncOfficialExtras(false).then(function(){ return res; });
  });
}
