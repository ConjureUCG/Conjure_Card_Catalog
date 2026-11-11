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
/* One commit holds at most this many pictures that exist only in this browser; more go up in parts, each its own commit, with the cards in the last (ghSendPart). */
var GH_ART_BATCH=150;
/* The key older copies stored the token under: nothing writes it now, and a record found there is taken for the visit and deleted (ghLoadSettings). */
var GH_SECRET='_secret_ghToken';

var GH_SOURCE='', GH_OWNER_MODE=false;
/* True once this profile is known to hold the whole official set (a bake captured, a check finding none missing, a full update applied); see ghWholeSetProblem. */
var GH_HAS_WHOLE_SET=false;
var GH_WEEKLY_LAST='';
var GH_REPO={owner:'',repo:'',branch:'main'};
/* The Tabletop Simulator pictures' repository, beside the cards' one and published to with the same token: this game's own (HANDOFF §1.2, TTS). */
var GH_TTS={owner:'',repo:'',branch:'main'};
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
function ghTokenHeld(){ return !!GH_TOKEN||!!GH_TOKEN_SINCE; }
/* (HANDOFF §10) By the Repository row alone, token or not: Forget it, or a restore before the token is pasted, leaves the set this copy's. */
function edOwnerUnlocked(){
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
/* Every saga the card is in counts, not the primary alone; an official card's content is the official set's alone, whatever other set's saga it is also in (srcLinkedJoin).
   A saga with no record yet locks nothing, as in edOfficialCard. */
function cardForeignKey(c){
  if(!c||c.local||typeof sagaIdsOf!=='function') return '';
  if(edOfficialCard(c)) return ownsGroupKey(GROUP_OFFICIAL) ? '' : GROUP_OFFICIAL;
  var ids=sagaIdsOf(c);
  for(var i=0;i<ids.length;i++){
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
/* An official card in sagas of yours (Add to my saga): read-only, but each of those sagas sets its own SAGA_FIELDS on it, in the editor. */
function edLinkedSagas(c){
  if(!c||!edCardLocked(c)||cardForeignKey(c)!==GROUP_OFFICIAL)return [];
  return sagaIdsOf(c).filter(function(id){ var sg=sagaById(id); return !!sg&&ownsGroupKey(groupKeyOf(sg)); });
}
window.edLinkedSagas=function(c){ return edLinkedSagas(c); };
/* the editor opens on it: a card this copy may change, or an official card in a saga of yours */
function edCardOpenable(c){ return !!c&&(!edCardLocked(c)||edLinkedSagas(c).length>0); }
window.edCardOpenable=function(c){ return edCardOpenable(c); };
function edLockedToast(c){
  var k=c?cardForeignKey(c):'';
  try{ toast(k===GROUP_OFFICIAL ? 'Official cards are read-only' : 'This card is read-only'); }catch(_){}
}
window.edLockedToast = edLockedToast;

function ghSettingsFrom(r){
  /* Any of these can be missing on an older profile, so each has a default. */
  GH_SOURCE=(r&&r.src)||GH_DEFAULT_SOURCE;
  GH_OWNER_MODE=!!(r&&r.owner);
  var rp=(r&&r.repo)||null;
  if(rp&&typeof rp==='object')GH_REPO={owner:rp.owner||'',repo:rp.repo||'',branch:rp.branch||'main'};
  var tt=(r&&r.tts)||null;
  if(tt&&typeof tt==='object')GH_TTS={owner:tt.owner||'',repo:tt.repo||'',branch:tt.branch||'main'};
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
  /* v[4] and v[5] stay empty so the indexes keep their places: neither the check on open nor the weekly run has a switch. */
  return Promise.all([getMeta('ghSourceUrl'),getMeta('ghOwnerMode'),
                      getMeta('ghRepo'),getMeta(GH_SECRET),Promise.resolve(null),
                      Promise.resolve(null),getMeta('ghWeeklyLast'),getMeta('ghTokenSince'),
                      getMeta('officialIds'),getMeta('bakeCaptured'),
                      getMeta('sources'),getMeta('lastNewSaga'),getMeta('ghTtsRepo')])
    .then(function(v){
      SOURCES=Array.isArray(v[10])?v[10].filter(function(s){ return s&&s.url; }):[];
      LAST_NEW_SAGA=v[11]||'';
      srcMigrateLinks();
      ghSettingsFrom({src:v[0],owner:v[1],repo:v[2],token:v[3],since:v[7],tts:v[12]});
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
/* For the checks: ghLoadSettings lands after the page is usable and overwrites a switch set before it, so a check reads back what is in force. */
window.edGhSwitches=function(){
  return {ownerMode:!!GH_OWNER_MODE, source:GH_SOURCE||''};
};
window.edGhSetRepo=function(field,val,fromPage){
  if(field!=='owner'&&field!=='repo'&&field!=='branch')return;
  GH_REPO[field]=String(val||'').trim();
  setMetaSafe('ghRepo',{owner:GH_REPO.owner,repo:GH_REPO.repo,branch:GH_REPO.branch||'main'},'the publish target');
  if(fromPage){ ghCheckTarget(); if(GH_TTS.owner||GH_TTS.repo)ttsCheckTarget(); }
};
window.edGhSetTts=function(field,val,fromPage){
  if(field!=='owner'&&field!=='repo'&&field!=='branch')return;
  GH_TTS[field]=String(val||'').trim();
  /* the list read for the look's line was another repository's */
  _ttsList=null; _ttsListRead=false; _ttsLook=null;
  setMetaSafe('ghTtsRepo',{owner:GH_TTS.owner,repo:GH_TTS.repo,branch:GH_TTS.branch||'main'},'the TTS repository');
  if(fromPage){ ttsCheckTarget(); ttsLookRefresh(); }
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
/* GitHub's size of a repository, in KB with its history, counted again about once an hour; 0 while new or empty. It asks
   for a repository ideally under 1 GB (PUBLISHING.md 11). */
var GH_SIZE_NEAR=900*1024;
function ghSizeText(kb){
  kb=Math.max(0,Math.round(+kb||0));
  if(kb<1024)return kb+' KB';
  if(kb<1048576)return Math.round(kb/1024)+' MB';
  return (kb/1048576).toFixed(2)+' GB';
}
function ghSizeLine(repo){
  var kb=+(repo&&repo.size)||0;
  if(!(kb>0))return '';
  return ' GitHub counts '+ghSizeText(kb)+' for it, history included.'
    +(kb>=GH_SIZE_NEAR?' GitHub suggests keeping a repository under 1 GB.':'');
}
/* t, show and isNow for the TTS repository's row (ttsCheckTarget); the cards' row by default */
function ghCheckTargetNow(seq,t,show,isNow){
  t=t||GH_REPO; show=show||ghTargetLine;
  isNow=isNow||function(){ return seq===_ghTargetSeq; };
  var name=t.owner+'/'+t.repo, br=t.branch||'main';
  var say=function(m){ if(isNow())show(m); return m; };
  say('Checking '+name+'…');
  return ghApi('GET','',undefined,0,t).then(function(repo){
    var push=!!(repo&&repo.permissions&&repo.permissions.push);
    var line=name+(push?': this token can push here':': this token cannot push here');
    var size=ghSizeLine(repo);
    return ghApi('GET','/git/ref/heads/'+ghRefPath(br),undefined,0,t).then(function(){
      return say(line+', branch "'+br+'".'+size);
    },function(err){
      var st=err&&err.status;
      return say(line+(st===409?' - the repository is empty.'
        :st===404?' - no branch "'+br+'" (the default branch is "'+String((repo&&repo.default_branch)||'')+'").'
        :'.')+size);
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
  if(fromPage||!GH_TOKEN){ ghCheckTarget(); if(GH_TTS.owner||GH_TTS.repo||!GH_TOKEN)ttsCheckTarget(); }
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
  var set={}, names={}, info={};
  (index||[]).forEach(function(s){
    if(!s||!s.id)return;
    set[s.id]=1; names[s.id]=s.name||s.id;
    /* a derived entry (github_sync.py's) knows no author, version or description */
    if(s.derived)return;
    var x={};
    SAGA_INFO_KEYS.forEach(function(k){ if(s[k]!=null)x[k]=sagaInfoClean(k,s[k]); });
    info[s.id]=x;
  });
  if(pkg&&pkg.zip){
    var m=pkg.man||{}, id=m.id||m.name;
    if(id){ set[id]=1; names[id]=m.name||id; }
  }
  ((pkg&&pkg.cards)||[]).forEach(function(c){ if(c) sagaIdsOf(c).forEach(function(id){ set[id]=1; }); });
  var skip={}; (src.skip||[]).forEach(function(id){ skip[id]=1; });
  return {key:src.key, url:src.url, official:!!src.official, table:src.table||'',
          sagaSet:set, names:names, info:info, skip:skip, owned:srcOwned(src),
          cids:srcCidsOf(pkg&&pkg.cards)};
}
/* At each check, as a set's keywords and watermarks come: what its sagas.json says of each of its sagas here that this copy may not edit. */
function srcTakeSagaInfo(o){
  var info=(o&&o.info)||{}, changed=[];
  Object.keys(info).forEach(function(id){
    var sg=sagaById(id); if(!sg)return;
    var k=groupKeyOf(sg);
    if(k!==o.key||ownsGroupKey(k))return;
    var x=info[id], rec=Object.assign({},sg), ch=false;
    SAGA_INFO_KEYS.forEach(function(f){
      if(x[f]===undefined)return;
      var v=(f==='version'&&!x[f])?'1.0':x[f];
      if((rec[f]||'')!==v){ rec[f]=v; ch=true; }
    });
    if(ch)changed.push(rec);
  });
  if(!changed.length)return Promise.resolve(0);
  return Promise.all(changed.map(sagaPut)).then(function(){
    try{ window.edRenderSagaPage(); }catch(_){}
    return changed.length;
  });
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
    if(nc.linked&&o&&!o.official){
      if(!srcLinkedJoins(ex,nc,o))skipped++;
      else if(srcLinkedDiffers(ex,nc,o))changed++; else same++;
      return;
    }
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

/* A publish names its game (ghPayload); an older one names none, and then only the two official repositories can be told apart. */
function srcGameOf(pkg,url){
  var m=(pkg&&pkg.man)||{};
  if(m.game==='main'||m.game==='rebirth')return m.game;
  var r=repoOfUrl(url), same=function(u){ var o=repoOfUrl(u); return !!(r&&o&&r.owner===o.owner&&r.repo===o.repo); };
  return same(GH_SOURCES.rebirth)?'rebirth':same(GH_SOURCES.main)?'main':'';
}
function srcGameProblem(pkg,url){
  var g=srcGameOf(pkg,url), here=ghMode();
  if(!g||g===here)return '';
  var nm=function(x){ return x==='rebirth'?'Conjure Rebirth':'Conjure'; };
  return 'it holds '+nm(g)+' cards, and this is '+nm(here)+'. Switch to '
    +(g==='rebirth'?'Rebirth':'Main')+' in the header, then follow it there.';
}
/* Writes nothing but the source's state, its last-checked time, what ghSettlePublished settles and the sagas' words (srcTakeSagaInfo). */
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
    var wrong=srcGameProblem(pkg,url);
    if(wrong){ var ge=new Error(wrong); ge.wrongGame=true; throw ge; }
    if(!pkg.cards||!pkg.cards.length)throw new Error('no cards in what came back.');
    /* the owner's copy reads the Test cards too, so they follow the publisher between machines */
    return ghFetchTesting(url,src).then(function(t){
      if(t.length)pkg.cards=pkg.cards.concat(t);
      return pkg;
    });
  }).then(function(pkg){
    return (pkg.zip?Promise.resolve(null):ghFetchIndex(url)).then(function(index){
      srcNormalizeCards(pkg,src,index);
      var ctx=srcCtx(src,pkg,index), inc=ghIncoming(pkg.cards,src);
      /* before the diff, which reads `local` */
      try{ ghSettlePublished(inc,src,ctx); }catch(_){}
      var now=new Date().toISOString();
      _srcCheckedAt[src.key]=Date.now();
      var st={pkg:pkg, ctx:ctx, index:index, checked:now, diff:ghDiff(inc,ctx)};
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
      var words=srcTakeSagaInfo(ctx).catch(function(){ return 0; });
      /* Never folded into the card diff: the look is its own gated press (edGhApplyLook), or applied after the check while Use Default Look is on. */
      if(src.official) return words.then(function(){ return ghFetchLook(url); }).then(function(lk){
        var s2=srcState(src);
        if(s2&&!s2.err){ s2.lookPkg=lk; edRenderOwnerSync(); }
      });
      return words;
    });
  }).catch(function(err){
    srcSetState(src,{err:(err&&err.message)||String(err), wrongGame:!!(err&&err.wrongGame)});
    srcRender();
  });
}
window.edGhCheck=function(){
  return ghCheckSource(srcOfficial()).then(function(){ return ghSyncOfficialExtras(false); });
};
window.edGhCheckSource=function(key){
  var s=srcByKey(key||GROUP_OFFICIAL);
  if(!s) return Promise.resolve(null);
  if(s.official) return window.edGhCheck();
  /* the cards wait for Apply update; the keywords and watermarks have no press of their own, so they come with the check, as the Official set's do */
  return ghCheckSource(s).then(function(){
    var st=srcState(s);
    if(st&&!st.err&&st.pkg)return srcSyncExtras(s,st.pkg,false);
  });
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
/* The cards an update would overwrite that this machine may edit, or changed while it could (_editedHere): zero means it costs nothing, and nothing asks. */
function ghWouldOverwriteOwnWork(cards,o){
  var mine=(window.CARDS||[]), ix=cardIndex(mine);
  var n=0;
  (cards||[]).forEach(function(nc){
    if(!nc||!nc.name)return;
    if(o&&!srcSagasOf(nc,o).length)return;
    var at=ix.at(nc), ex=(at==null)?null:mine[at];
    /* the refusals importCardRows makes: no card made here matched by name, never another source's card */
    if(ex&&o&&ex.local&&!(nc.cid&&ex.cid===nc.cid))return;
    if(nc.linked&&o&&!o.official){
      if(srcLinkedJoins(ex,nc,o)&&srcLinkedRisk(ex,nc,o))n++;
      return;
    }
    if(ex&&o&&srcBelongsElsewhere(ex,o.key))return;
    if(!ex||!(cardDiffers(ex,nc,o)||ghTestDiffers(ex,nc)))return;
    var locked=false;
    try{ locked=!!edCardLocked(ex); }catch(_){}
    if(!locked||ex._editedHere)n++;
  });
  return n;
}
/* Only cards surely the source's to take: never on a copy that owns it, only from sagas it published this time, never `local`, Test or changed here.
   More than a tenth of its cards here, and more than 20, is a broken publish and removes nothing (HANDOFF §5). */
function srcGoneCards(incoming,o){
  if(!o||o.owned)return [];
  if(o.official&&GH_OWNER_MODE)return [];
  var inc=(incoming||[]).filter(function(c){ return c&&c.name; });
  if(!inc.length)return [];
  var ix=cardIndex(inc), from=0;
  var gone=(window.CARDS||[]).filter(function(c){
    if(!c||c.local||c.__deleted||c.testing||c._editedHere)return false;
    var mine=sagaIdsOf(c).filter(function(id){ return groupKeyOfId(id)===o.key; });
    if(!mine.length)return false;
    /* nor a saga's own values on an official card changed here */
    if(c._editedSagas&&mine.some(function(id){ return c._editedSagas[id]; }))return false;
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
        .forEach(function(id){ if(removeSagaMembership(c,id))srcDropSagaFields(c,id); });
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

/* Each card an update would replace (matched as ghWouldOverwriteOwnWork matches), against what the set publishes now. One that is just what
   was published loses the mark of a change made here (_editedHere, markDirty) and, where the set is not this copy's, the `local` an older Publish
   sent with it: by record id too for that, as a reader's own card can share an older card id, never the record id. One that differs keeps both, so
   an update asks first and removes nothing (srcGoneCards). On the owner's copy one that differs is marked: an edit made before the mark existed is
   asked about too once the copy is not the owner's. */
function ghSettlePublished(incoming,src,o){
  var owned;
  try{ owned=srcOwned(src||srcOfficial()); }catch(_){ return 0; }
  var mine=(window.CARDS||[]), ix=cardIndex(mine), n=0;
  (incoming||[]).forEach(function(nc){
    if(!nc||!nc.name)return;
    if(o&&o.sagaSet&&!srcSagasOf(nc,o).length)return;
    var at=ix.at(nc), c=(at==null)?null:mine[at];
    if(!c||(c.local&&!(nc.cid&&c.cid===nc.cid)))return;
    var ch=false;
    /* an official card in the set's sagas: the same, saga by saga, on what each sets itself */
    if(nc.linked&&o&&o.sagaSet&&!o.official){
      if(!srcLinkedJoins(c,nc,o))return;
      srcSagasOf(nc,o).forEach(function(id){
        var m=c._editedSagas||{};
        if(!srcLinkedSagaDiffers(c,nc,id)){ if(m[id]){ srcUnmarkSaga(c,id); ch=true; } }
        else if(owned&&!m[id]){ (c._editedSagas=c._editedSagas||{})[id]=1; ch=true; }
      });
      if(ch){ n++; try{ persistCard(c); }catch(_){} }
      return;
    }
    if(o&&o.key&&srcBelongsElsewhere(c,o.key))return;
    if(!cardDiffers(c,nc,o)){
      if(c._editedHere){ delete c._editedHere; ch=true; }
      if(c.local&&!owned&&c.id&&nc.id===c.id){ delete c.local; ch=true; }
    } else if(owned&&!c._editedHere){ c._editedHere=1; ch=true; }
    if(ch){ n++; try{ persistCard(c); }catch(_){} }
  });
  return n;
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
        lose:['Your changes to '+risk+' card(s) here, in every field the source also sets: its version replaces them']})
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
      return src.official ? ghSyncOfficialExtras(false) : srcSyncExtras(src,st.pkg,true);
    });
  }).catch(function(err){ alert('Update failed: '+((err&&err.message)||err)); });
}
/* A followed set's keywords and watermarks come with every check of it, a card update or not (ghAutoApply), and with every update taken; its look never does.
   Nothing defined here is replaced: an entry is updated only from the set that brought it, which meta srcExtrasFrom remembers. One at a time, as they all write that record. */
var SRC_FROM=null, _srcExtrasQ=Promise.resolve(), _srcMarksTried={};
function srcSyncExtras(src,pkg,taken){
  if(!src||src.official||!src.url||syncBlockedReason(src.url))return Promise.resolve(0);
  /* your own set's, like its cards, only when you take its update */
  if(srcOwned(src)&&!taken)return Promise.resolve(0);
  var zip=!!(pkg&&pkg.zip)||/\.zip(\?.*)?$/i.test(src.url);
  var p=_srcExtrasQ.then(srcFromLoad).then(function(from){
    var was=JSON.stringify(from);
    return Promise.all([zip?null:srcFetchKeywords(src),srcFetchMarks(src,pkg,from)]).then(function(v){
      var n=srcTakeKeywords(src,v[0],from);
      return srcTakeMarks(src,v[1]&&v[1].marks,pkg,from).then(function(m){
        if(v[1]&&v[1].print)from.prints[src.key]=v[1].print;
        if(JSON.stringify(from)!==was)srcFromSave(from);
        return n+m;
      });
    });
  }).catch(function(){ return 0; });
  _srcExtrasQ=p;
  return p;
}
function srcFromLoad(){
  if(SRC_FROM)return Promise.resolve(SRC_FROM);
  return getMeta('srcExtrasFrom').then(function(v){
    var o=(v&&typeof v==='object')?v:{};
    var obj=function(x){ return (x&&typeof x==='object'&&!Array.isArray(x))?x:{}; };
    SRC_FROM={kw:obj(o.kw),marks:obj(o.marks),prints:obj(o.prints)};
    return SRC_FROM;
  });
}
function srcFromSave(from){ return setMetaSafe('srcExtrasFrom',from,'where followed keywords and watermarks came from'); }
/* Stop following keeps the set's keywords and watermarks, as a card of yours may wear them, and forgets where they came from:
   a keyword passes to the next set that publishes it, a watermark is left as it is. */
function srcFromForget(key){
  var p=_srcExtrasQ.then(srcFromLoad).then(function(from){
    var was=JSON.stringify(from);
    Object.keys(from.kw).forEach(function(k){ if(from.kw[k]===key)delete from.kw[k]; });
    Object.keys(from.marks).forEach(function(k){ if(from.marks[k]&&from.marks[k].key===key)delete from.marks[k]; });
    delete from.prints[key];
    if(JSON.stringify(from)!==was)return srcFromSave(from);
  }).catch(function(){});
  _srcExtrasQ=p;
  return p;
}
function srcKwKey(k){ return (k.mode||'keyword')+'\u0000'+k.name; }
/* What edApplyCustomEntries lets no extra replace (the Official list, the built-in damage kinds, yours) is skipped; so is an entry another followed set brought.
   An entry from before sets were remembered is taken over by the first set that publishes it. */
function srcTakeKeywords(src,list,from){
  if(!Array.isArray(list)||!list.length)return 0;
  var base={};
  (KW_BAKED||[]).concat(rbDamageBuiltins()).forEach(function(k){ if(k&&k.name)base[srcKwKey(k)]=1; });
  (KWCUSTOM||[]).forEach(function(c){
    if(!c||!c.name)return;
    base[srcKwKey(c)]=1;
    if(c.replaces)base[(c.mode||'keyword')+'\u0000'+c.replaces]=1;
  });
  /* by name, as an entry and its aliases share one (kwCustomEntries) and change together */
  var inc={}, order=[];
  list.map(srcNormKw).filter(Boolean).forEach(function(k){
    delete k.__custom;
    var kk=srcKwKey(k);
    if(base[kk])return;
    if(!inc[kk]){ inc[kk]=[]; order.push(kk); }
    inc[kk].push(k);
  });
  var out=(KW_EXTRA||[]).slice(), n=0;
  order.forEach(function(kk){
    var by=from.kw[kk];
    if(by&&by!==src.key)return;
    from.kw[kk]=src.key;
    var cur=out.filter(function(k){ return k&&k.name&&srcKwKey(k)===kk; });
    if(ghStableJson(cur)===ghStableJson(inc[kk]))return;
    var at=cur.length?out.indexOf(cur[0]):-1;
    out=out.filter(function(k){ return cur.indexOf(k)<0; });
    if(at<0)at=out.length;
    Array.prototype.splice.apply(out,[at,0].concat(inc[kk]));
    n++;
  });
  if(!n)return 0;
  KW_EXTRA=out;
  setMetaSafe('kwFromSources',KW_EXTRA,'keywords from followed sources');
  try{ ghKwRefresh(); }catch(_){}
  return n;
}
/* With the cards' limits (fetchSource): every set checked after this one waits for it (srcEachFollowed). */
function srcFetchJson(url){
  if(!url||syncBlockedReason(url))return Promise.resolve(null);
  return fetchSource(url).then(function(res){ return (res&&!res.zip)?res.json:null; },function(){ return null; });
}
function srcFetchKeywords(src){
  return srcFetchJson(ghKwUrl(src.url)).then(function(j){ return (Array.isArray(j)&&j.length)?j:null; });
}
/* look.json for its watermarks alone, as it holds the whole look too (often most of a megabyte): only when the set says they changed
   (manifest markPrint, ghPayload) or one of its cards wears one this copy lacks, and then once a session for each version. */
function srcFetchMarks(src,pkg,from){
  if(!pkg)return Promise.resolve(null);
  /* a .zip carries its own, as can a cards.json (pkgFromJson) */
  if(Array.isArray(pkg.marks)&&pkg.marks.length)return Promise.resolve({marks:pkg.marks,print:''});
  if(pkg.zip)return Promise.resolve(null);
  var man=pkg.man||{};
  if(man.markCount===0)return Promise.resolve(null);
  var print=(typeof man.markPrint==='string')?man.markPrint:'';
  var have={}; (MARKS||[]).forEach(function(m){ if(m&&m.id)have[m.id]=1; });
  var lacking=(pkg.cards||[]).some(function(c){
    return cardMarkIds(c).some(function(id){ return !have[id]; }); });
  if(!lacking&&(!print||print===from.prints[src.key]))return Promise.resolve(null);
  var tag=src.key+'\u0000'+print;
  if(_srcMarksTried[tag])return Promise.resolve(null);
  _srcMarksTried[tag]=1;
  return srcFetchJson(ghLookUrl(src.url)).then(function(j){
    return (j&&typeof j==='object'&&Array.isArray(j.marks))?{marks:j.marks,print:print}:null;
  });
}
/* in the shape the editor makes (edMarkNew), so nothing else a set sends is stored */
function srcMarkClean(m){
  if(!m||typeof m!=='object'||Array.isArray(m)||typeof m.id!=='string'||!m.id)return null;
  return {id:m.id,name:(typeof m.name==='string')?m.name:'',src:(typeof m.src==='string')?m.src:'',
          xf:markXf(m),a:numAttr(m.a,0.35,0,1)};
}
/* By id, as a card names one: added when a card of the set's or one made here wears it (another set's card waits for that set),
   replaced only when it came from this set and the set has changed it since. */
function srcTakeMarks(src,list,pkg,from){
  if(!Array.isArray(list)||!list.length)return Promise.resolve(0);
  var have={}, worn={};
  (MARKS||[]).forEach(function(m){ if(m&&m.id)have[m.id]=1; });
  (window.CARDS||[]).filter(function(c){ return c&&c.local; }).concat((pkg&&pkg.cards)||[]).forEach(function(c){
    cardMarkIds(c).forEach(function(id){ worn[id]=1; }); });
  var take=[];
  list.forEach(function(raw){
    var m=srcMarkClean(raw); if(!m)return;
    var pr=ghFingerprint(ghStableJson(m)), by=from.marks[m.id];
    if(have[m.id]){
      if(!by||by.key!==src.key||by.print===pr)return;
      /* nor under an edit of yours still waiting to be saved (markSaveSoon), which would write the old one back */
      if(_markSaveTm[m.id])return;
    } else if(!worn[m.id])return;
    take.push({m:m,pr:pr});
  });
  var n=0;
  return take.reduce(function(p,t){
    return p.then(function(){
      return put('marks',t.m).then(function(){ from.marks[t.m.id]={key:src.key,print:t.pr}; n++; },function(){});
    });
  },Promise.resolve()).then(function(){
    if(!n)return 0;
    return marksRefresh().then(function(){ try{ marksChanged(); }catch(_){} return n; });
  });
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

/* The token goes to this host and to the repository named only, the cards' (GH_REPO) unless t is the TTS one: `path` is a path inside it, and the names are checked first (ghRepoProblem). */
var GH_API='https://api.github.com/';
var GH_NAME_RE=/^[A-Za-z0-9_.-]+$/;
function ghApiUrl(path,t){
  t=t||GH_REPO;
  path=String(path==null?'':path);
  if(path&&path.charAt(0)!=='/')return '';
  if(/(^|\/)\.\.?(\/|$|\?)/.test(path.split('?')[0]))return '';
  var url=GH_API+'repos/'+encodeURIComponent(t.owner)+'/'+encodeURIComponent(t.repo)+path;
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
/* A read is tried again, at most twice, after the wait GitHub names (a minute at most), and so is a blob or a tree, which is named by what is in it: a second POST of a commit is a second commit. */
var GH_RETRY_MAX=2, GH_RETRY_WAIT_CAP=60;
function ghSafeTwice(method,path){
  return method==='GET'||(method==='POST'&&(path==='/git/blobs'||path==='/git/trees'));
}
function ghApi(method,path,body,tries,t){
  t=t||GH_REPO;
  if(!GH_TOKEN)return Promise.reject(new Error('no token set.'));
  if(!t.owner||!t.repo)return Promise.reject(new Error('no repository set.'));
  var bad=ghRepoProblem(t);
  if(bad)return Promise.reject(new Error(bad));
  var url=ghApiUrl(path,t);
  if(!url)return Promise.reject(new Error('that is not a path in this repository.'));
  tries=tries||0;
  var again=function(secs){
    return new Promise(function(res){ setTimeout(res,Math.min(secs,GH_RETRY_WAIT_CAP)*1000); })
      .then(function(){ return ghApi(method,path,body,tries+1,t); });
  };
  var opt={method:method,headers:{
    'Accept':'application/vnd.github+json',
    'X-GitHub-Api-Version':'2022-11-28',
    'Authorization':'Bearer '+GH_TOKEN}};
  if(body!==undefined){ opt.headers['Content-Type']='application/json';
    opt.body=JSON.stringify(body); }
  var canRetry=(ghSafeTwice(method,path)&&tries<GH_RETRY_MAX);
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
/* GitHub takes about 80 new files a minute from one account: a publish that writes more than GH_WRITE_FREE starts each write GH_WRITE_GAP ms after the one before. */
var GH_WRITE_GAP=800, GH_WRITE_FREE=70, _ghLastWrite=0;
function ghPacedApi(pace,method,path,body,t){
  if(!pace)return ghApi(method,path,body,0,t);
  var wait=Math.max(0,_ghLastWrite+GH_WRITE_GAP-Date.now());
  return new Promise(function(res){ setTimeout(res,wait); }).then(function(){
    _ghLastWrite=Date.now();
    return ghApi(method,path,body,0,t);
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
/* the official repository's, which holds the pictures of an official card in a saga of yours */
function ghOfficialCdnBase(){
  var o=ghOfficialParts();
  return o?'https://cdn.jsdelivr.net/gh/'+o.owner+'/'+o.repo+'@'+o.branch:ghCdnBase();
}
/* An official card going out in sagas of yours without the official ones (Add to my saga): sent marked, with each saga's own values (srcLinkedJoin). */
function ghLinkedOut(c,keep){
  return !!(c&&keep&&typeof keep==='object')&&!ghTargetIsOfficial()&&sagaIdsOf(c).some(function(id){
    return !keep[id]&&groupKeyOfId(id)===GROUP_OFFICIAL; });
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
  /* its pictures are the official repository's, and it sends none of its own */
  var linked=ghLinkedOut(c,keep);
  var base=linked?ghOfficialCdnBase():ghCdnBase();
  var o=JSON.parse(JSON.stringify(c));
  delete o.__id;
  if(keep&&typeof keep==='object')ghScopeSagas(o,keep);
  /* a published card is the set's wherever it lands, never `local` (ghNotLocal) nor changed there */
  delete o.local; delete o._editedHere; delete o._editedSagas;
  artBearers(o).forEach(function(b){
    var local=linked?'':ghLocalArtKey(b);
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
  if(linked){
    var own={}, pic=function(v){
      var w=(o.variants||[]).filter(function(x){ return x&&x.id===v.id; })[0];
      return (w&&(w.imageUrl||w.art))||'';
    };
    sagaIdsOf(o).forEach(function(id){ own[id]=srcLinkedOwn(c,id,pic); });
    o.linked={to:'official',own:own};
  }
  return o;
}
/* Only cards this publish sends: one only in sagas left out, or in a table copy, sends no picture. */
function ghLocalArtUploads(){
  var out=[], seen={}, keep=ghPublishSagaSet();
  (window.CARDS||[]).forEach(function(c){
    if(!c||c.__deleted||!ghInScope(c,keep)||ghLinkedOut(c,keep))return;
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
/* Named by the store key, new for every upload (edArtUpload): a replaced picture is a new file, and one the repository holds is never sent again, so a publish stopped part-way carries on from there. */
function ghArtParts(pics){
  var parts=[];
  for(var i=0;i<pics.length;i+=GH_ART_BATCH)parts.push(pics.slice(i,i+GH_ART_BATCH));
  /* never none: the last part carries the cards */
  return parts.length?parts:[[]];
}
function ghPartsText(n){
  return 'The '+n+' pictures go up in '+Math.ceil(n/GH_ART_BATCH)+' parts of at most '+GH_ART_BATCH
    +', the cards with the last. Keep this page open until it says Published; if it stops part-way, '
    +'Publish again carries on from there.';
}
/* One commit, and the branch moved to it. Its pictures are each encoded as they are sent, so no more than one is held; the last part also carries the data files. */
function ghSendPart(run,k,pics,data,local,pace){
  var entries=[], part=run.parts>1?'part '+(k+1)+' of '+run.parts:'', label=part?part+': ':'';
  var send=function(path,bytes,sha){
    return ghPacedApi(pace,'POST','/git/blobs',{content:ghB64Bytes(bytes),encoding:'base64'})
      .then(function(r){
        if(r.sha!==sha)
          throw new Error('GitHub stored a different hash for '+path+' than this page computed. '
            +'Refusing to build a tree from it.');
        entries.push({path:path,mode:'100644',type:'blob',sha:sha});
      });
  };
  var p=Promise.resolve();
  pics.forEach(function(u,i){
    p=p.then(function(){
      ghPushStatus('Uploading '+label+'picture '+(i+1)+' of '+pics.length+'…');
      return ghWebpBytes(u.key).then(function(bytes){
        return ghBlobSha(bytes).then(function(sha){ return send(u.path,bytes,sha); });
      });
    });
  });
  if(data.length)p=p.then(function(){ ghPushStatus('Uploading '+label+data.length+' file(s)…'); });
  data.forEach(function(n){
    p=p.then(function(){ return send(n,local[n].bytes,local[n].sha); });
  });
  var tree='';
  return p.then(function(){
    var base=run.tree, i=0;
    function step(){
      if(i>=entries.length)return Promise.resolve(base);
      var body={tree:entries.slice(i,i+GH_TREE_CHUNK)};
      if(base)body.base_tree=base;
      i+=GH_TREE_CHUNK;
      return ghPacedApi(pace,'POST','/git/trees',body).then(function(t){ base=t.sha; return step(); });
    }
    return step();
  }).then(function(treeSha){
    tree=treeSha;
    ghPushStatus('Committing'+(part?' '+part:'')+'…');
    return ghPacedApi(pace,'POST','/git/commits',
      {message:'Publish from the app'+(part?', '+part:'')+': '+entries.length+' file(s)',
       tree:treeSha,parents:[run.head]});
  }).then(function(commit){
    var br=GH_REPO.branch||'main';
    run.stage='ref'; run.commit=String(commit.sha||'');
    return (run.made
      ? ghPacedApi(pace,'PATCH','/git/refs/heads/'+ghRefPath(br),{sha:commit.sha})
      : ghPacedApi(pace,'POST','/git/refs',{ref:'refs/heads/'+br,sha:commit.sha}))
      .then(function(){
        run.stage='prep'; run.made=true; run.head=run.commit; run.tree=tree; run.landed=k+1;
      });
  });
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
  /* a creator's set is named for its repository (the author, session 88); an official set keeps the name it has */
  var name=ghTargetIsOfficial()?((prev&&prev.name)||'Conjure UCG')
    :(String(GH_REPO.repo||'').trim()||(prev&&prev.name)||'Conjure UCG');
  var manifest={name:name,format:2,game:ghMode(),
    cardCount:cards.length,keywordCount:kw.length,
    /* so a reader knows there is a look to fetch before spending a request on it, and a follower whether the watermarks changed (srcFetchMarks) */
    lookSlots:slots,markCount:marks.length,markPrint:ghFingerprint(ghStableJson(marks)),
    artBase:ghCdnBase()+'/art/'};
  if(prev&&prev.artFiles!=null)manifest.artFiles=prev.artFiles;
  if(prev&&prev.artEncoding)manifest.artEncoding=prev.artEncoding;
  /* where these cards' Tabletop Simulator pictures are listed, for a player's deck export (edTtsLists) */
  if(ttsTargetSet())manifest.tts={owner:GH_TTS.owner,repo:GH_TTS.repo,branch:GH_TTS.branch||'main'};
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
function ghLookShape(){
  var b=currentPackBody();
  b.kwCustom=(b.kwCustom||[]).slice().sort(function(x,y){
    var a=String(x&&x.id), c=String(y&&y.id); return a<c?-1:a>c?1:0; });
  var ks=b.kwStyles||{};
  Object.keys(ks).forEach(function(k){
    var v=ks[k]; if(!v||typeof v!=='object')return;
    if(v.hl===undefined){ v.hl=v.irid?'irid':'none'; delete v.irid; }
    if(v.w===undefined)v.w=1.5;
  });
  return b;
}
function ghLookNow(){ return ghFingerprint(ghStableJson(ghLookShape())); }
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
  var kwIds=null, look2=null;
  return ghKeepLookCopy().then(function(){
    return getMeta('ghLookKwIds');
  }).then(function(prevIds){
    var body=Object.assign({},pkg.look);
    /* the official frame, icon set and back are a default, applied below only where this browser never picked its own */
    look2=body.cardLook; delete body.cardLook;
    if(Array.isArray(pkg.look.kwCustom)){
      var k=ghLookKwBody(pkg.look.kwCustom,prevIds);
      body.kwCustom=k.list; kwIds=k.ids;
    }
    return applyPackBody(body);
  }).then(function(){
    if(look2&&typeof look2==='object'&&!window.edLookSaved()){ window.edApplyLook(look2,false); window.edLookRefresh(); }
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
function ghRepoProblem(t){
  t=t||GH_REPO;
  var o=t.owner||'', r=t.repo||'', b=t.branch||'main';
  if(o&&!ghNameOk(o))return 'The username "'+o+'" cannot be a GitHub name: letters, digits, - _ and . only.';
  if(r&&!ghNameOk(r))return 'The repository "'+r+'" cannot be a GitHub repository name: letters, digits, - _ and . only.';
  if(!ghBranchOk(b))return 'The branch "'+b+'" cannot be a git branch name.';
  return '';
}
function ghRefPath(b){
  return String(b||'main').split('/').map(encodeURIComponent).join('/');
}

function ghTreeAt(br,t){
  return ghApi('GET','/git/ref/heads/'+ghRefPath(br),undefined,0,t).then(function(ref){
    var head=ref.object.sha;
    return ghApi('GET','/git/commits/'+head,undefined,0,t).then(function(c){
      return ghApi('GET','/git/trees/'+c.tree.sha+'?recursive=1',undefined,0,t).then(function(tr){
        var map={};
        (tr.tree||[]).forEach(function(en){ if(en.type==='blob')map[en.path]=en.sha; });
        return {paths:map,head:head,tree:c.tree.sha};
      });
    });
  });
}
/* A missing branch answers with the default branch's tree, marked newBranch, and an empty repository is marked empty.
   Anything else, such as a bad token, surfaces as itself, never as "would upload 2 files". */
var _ghLastRt=null;
/* no argument: it is a .then() callback, which would hand it the step before's answer */
function ghRemoteTree(){
  return ghRemoteTreeFor(GH_REPO).then(function(rt){ _ghLastRt=rt; return rt; });
}
function ghRemoteTreeFor(t){
  var br=t.branch||'main';
  var empty={paths:{},head:null,tree:null,empty:true,branch:br};
  return ghTreeAt(br,t).catch(function(err){
    var st=err&&err.status;
    if(st===409)return empty;
    if(st!==404)throw err;
    return ghApi('GET','',undefined,0,t).then(function(repo){
      var def=String((repo&&repo.default_branch)||'');
      if(!def||def===br)return empty;
      return ghTreeAt(def,t).then(function(rt){
        rt.newBranch=br; rt.from=def; return rt;
      },function(e2){
        if(e2&&(e2.status===409||e2.status===404))return empty;
        throw e2;
      });
    });
  });
}
/* The git data calls cannot build on an empty repository, so its first commit is a README through the contents call; only into one that holds nothing. */
function ghStartEmptyRepo(t){
  var tts=!!t; t=t||GH_REPO;
  var txt='# '+t.repo+'\n\n'+(tts?'Card pictures for Tabletop Simulator, published':'Cards published')
    +' from the Conjure card catalog.\n';
  var bytes=new TextEncoder().encode(txt);
  return ghApi('PUT','/contents/README.md',{message:'Start the repository',content:ghB64Bytes(bytes)},0,t);
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
      +(art.length>GH_ART_BATCH?' '+ghPartsText(art.length):''));
    return {up:up,local:local,rt:rt};
  }).catch(function(err){
    _ghBusy=false; ghPushStatus('Could not check: '+((err&&err.message)||err));
  });
};

/* An empty repository gets its README; a missing branch is created from the default branch, only when the person agrees, never without history. */
var _ghStarted=false;
/* t and say for the TTS repository (edGhTtsPublish); the cards' one by default */
function ghPublishTarget(t,say){
  var tt=t||GH_REPO; say=say||ghPushStatus;
  var tree=function(){ return t?ghRemoteTreeFor(t):ghRemoteTree(); };
  return tree().then(function(rt){
    if(!rt.empty)return rt;
    say('Starting the empty repository with a README…');
    return ghStartEmptyRepo(t).then(function(){ if(t)_ttsStarted=true; else _ghStarted=true; return tree(); });
  }).then(function(rt){
    if(rt.empty)throw new Error('the repository still reads as empty after its README was written.');
    if(!rt.newBranch)return true;
    return edChooseModal({
      title:'There is no branch "'+rt.newBranch+'"',
      body:tt.owner+'/'+tt.repo+' has no branch called "'+rt.newBranch
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
  /* stage is 'ref' once a part's commit exists and the branch is moving to it, so a failure there is reported as possibly landed; landed counts the parts the branch holds */
  var run={stage:'prep',commit:'',parts:1,landed:0,head:'',tree:'',made:false};
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
    /* never a commit with no parent: an empty repository has its README by now */
    if(!rt.head)throw new Error('the repository has no commit to build on.');
    var data=names.filter(function(n){ return rt.paths[n]!==local[n].sha; });
    var pics=ghLocalArtUploads().filter(function(u){ return !rt.paths[u.path]; });
    if(!data.length&&!pics.length){
      _ghBusy=false;
      ghPushStatus(rt.newBranch
        ? 'Nothing to upload - "'+rt.from+'" already holds this catalog, so no branch was created.'
        : 'Already up to date - nothing to do.');
      return;
    }
    /* the pictures first and the cards in the last part, so no published card names a picture that is not there yet */
    var parts=ghArtParts(pics);
    run.parts=parts.length; run.head=rt.head; run.tree=rt.tree; run.made=!rt.newBranch;
    run.newBranch=rt.newBranch||''; run.from=rt.from||'';
    /* a tree, a commit and the branch for each part */
    var pace=pics.length+data.length+3*parts.length>GH_WRITE_FREE;
    return parts.reduce(function(p,part,k){
      return p.then(function(){
        return ghSendPart(run,k,part,k===parts.length-1?data:[],local,pace);
      });
    },Promise.resolve()).then(function(){
      _ghBusy=false; run.stage='done';
      /* the comparison was of the catalogue before this publish, and a list still saying "1 changed" reads as work left */
      _ghDiff=null;
      ghPushStatus('Published. Commit '+run.head.slice(0,10)+'.'
        +(run.parts>1?' The pictures went up in '+run.parts+' parts.':'')
        +(rt.newBranch?' Branch "'+rt.newBranch+'" was created from "'+rt.from+'".':''));
      toast('Published to '+GH_REPO.owner+'/'+GH_REPO.repo);
      /* the TTS row's "publish the cards first" is answered now */
      if(/^Publish the cards first/.test(_ttsPushMsg))ttsPushStatus('');
      try{ ghAfterPublish(); }catch(_){}
    });
  });
  });
  }).catch(function(err){
    _ghBusy=false;
    var m=(err&&err.message)||String(err);
    var last=run.landed+1>=run.parts;
    /* The last step can land and lose its answer: a refusal leaves the branch where it was, but no answer at all says nothing either way. */
    if(run.stage==='ref'&&!(err&&err.status)){
      ghPushStatus(last
        ? 'Publish may have gone through: the connection failed while the branch was '
          +'being moved to commit '+run.commit.slice(0,10)+' ('+m+'). Press Preview changes - '
          +'"Already up to date" means it landed.'
        : 'Publish stopped: the connection failed while the branch was being moved to part '
          +(run.landed+1)+' of '+run.parts+' ('+m+'). No card is published yet. Press Publish '
          +'again to carry on: a picture already there is not sent twice.');
      return;
    }
    /* parts before this one hold pictures only, which no card names yet */
    if(run.landed){
      ghPushStatus('Publish stopped part-way: '+m+(/[.!?]$/.test(m)?' ':'. ')
        +(run.landed>1?'Parts 1 to '+run.landed+' of '+run.parts+', pictures only, are':'Part 1 of '+run.parts+', pictures only, is')
        +' in the repository, but no card is published yet. Press Publish again to send the rest.'
        +(run.newBranch?' Branch "'+run.newBranch+'" was created from "'+run.from+'".':''));
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

/* ── TABLETOP SIMULATOR (sessions 97 to 99) ────────────────────────────────
   One JPEG a card in a repository of its own (GH_TTS): cards/<cid>.jpg, backs/<key>.jpg and tts.json, the list. A picture is
   drawn from the card as published and kept at one address, the branch's (jsDelivr @branch), so a deck already made shows a
   changed card's new picture once jsDelivr renews its copy (the author, session 98). Publish TTS cards draws a card only
   when it is new or plays differently: its name, type line, mana cost, rules text or stats (ttsRulesPrint, the author,
   session 99). Redraw all, pressed by hand, is the sync for everything else: a change of look, a card's art, frame,
   artist, revision and the like, and the card backs. */
var TTS_W=750, TTS_H=1050, TTS_QUALITY=.9, TTS_LIST='tts.json';
/* in the look's print: a change to how a picture is drawn reads as a change of look (tts2: no card number, session 98) */
var TTS_DRAW='tts2 '+TTS_W+'x'+TTS_H+' jpeg '+TTS_QUALITY;
var TTS_KEY=/^[A-Za-z0-9_-]{1,80}$/, TTS_SHA=/^[0-9a-f]{40}$/, TTS_FILE=/^(cards|backs)\/[A-Za-z0-9_-]{1,80}\.jpg$/;
/* the files a picture is drawn from, beside the cards: what is here must be what is published */
var TTS_SAME=['cards.json','keywords.json','look.json'];
var _ttsPushMsg='', _ttsTargetMsg='', _ttsTargetTimer=0, _ttsTargetSeq=0, _ttsStarted=false;
/* the list as last read or written this visit, and how many of its cards were drawn with another look than this one */
var _ttsList=null, _ttsListRead=false, _ttsLook=null;

function ttsTarget(){
  return {owner:String(GH_TTS.owner||'').trim(),repo:String(GH_TTS.repo||'').trim(),branch:GH_TTS.branch||'main'};
}
function ttsRepoProblem(){
  var bad=ghRepoProblem(GH_TTS);
  if(bad)return bad;
  if(GH_TTS.owner&&GH_TTS.repo&&String(GH_TTS.owner).toLowerCase()===String(GH_REPO.owner||'').toLowerCase()
     &&String(GH_TTS.repo).toLowerCase()===String(GH_REPO.repo||'').toLowerCase())
    return 'The TTS repository must be one of its own, not the cards’ repository.';
  return '';
}
/* set and fit to publish to: only then does the manifest name it (ghPayload) */
function ttsTargetSet(){ return !!(GH_TTS.owner&&GH_TTS.repo)&&!ttsRepoProblem(); }
function ttsConfigProblem(){
  if(!GH_TTS.owner||!GH_TTS.repo)return 'Set the TTS repository first.';
  return ttsRepoProblem();
}
window.edTtsRepo=function(){ return {owner:GH_TTS.owner,repo:GH_TTS.repo,branch:GH_TTS.branch||'main'}; };
function ttsTargetLine(m){
  _ttsTargetMsg=String(m||'');
  var el=document.getElementById('ttsTargetMsg'); if(el)el.textContent=_ttsTargetMsg;
}
/* as ghCheckTarget, with the same token */
function ttsCheckTarget(){
  clearTimeout(_ttsTargetTimer);
  var seq=++_ttsTargetSeq;
  var bad=(GH_TTS.owner||GH_TTS.repo)?ttsRepoProblem():'';
  if(bad||!GH_TTS.owner||!GH_TTS.repo||!GH_TOKEN){ ttsTargetLine(bad); return Promise.resolve(bad); }
  var blocked=syncBlockedReason(GH_API);
  if(blocked){ ttsTargetLine(blocked); return Promise.resolve(blocked); }
  return new Promise(function(res){
    _ttsTargetTimer=setTimeout(function(){
      res(ghCheckTargetNow(seq,ttsTarget(),ttsTargetLine,function(){ return seq===_ttsTargetSeq; }));
    },400);
  });
}
window.edGhTtsCheckTarget=function(){ return ttsCheckTarget(); };
function ttsPushStatus(msg){
  _ttsPushMsg=String(msg==null?'':msg);
  var el=document.getElementById('ttsPushMsg');
  if(el)el.textContent=_ttsPushMsg;
}
/* SHA-1, as hex: a card's print, where a 32-bit hash (ghFingerprint) over 1,500 cards a run could meet itself */
function ttsSha(s){
  if(!(window.crypto&&window.crypto.subtle))
    return Promise.reject(new Error('this page has no crypto.subtle. Serve it over http://localhost rather than opening the file directly.'));
  return window.crypto.subtle.digest('SHA-1',new TextEncoder().encode(String(s))).then(function(d){
    var out=''; new Uint8Array(d).forEach(function(b){ out+=('0'+b.toString(16)).slice(-2); });
    return out;
  });
}
function ttsBefore(m){ var er=new Error(m); er.before=true; return er; }
function ttsCardFile(cid){ return TTS_KEY.test(cid)?'cards/'+cid+'.jpg':''; }
function ttsNames(list){
  var out=list.slice(0,5).join(', ');
  return list.length>5?out+' and '+(list.length-5)+' more':out;
}
/* the cards and backs changed only in ways Publish TTS cards leaves for Redraw all (ttsPlan) */
function ttsWaitLine(names){
  return names.length?' '+names.length+' changed in ways only Redraw all sends (art, frame, artist and the like): '
    +ttsNames(names)+'.':'';
}

/* The published pictures a card names in the cards' repository, each with git's hash there: a picture replaced under its
   own name is a changed card, and one published since it was drawn without is too. */
function ttsArtPrint(form,rtMain){
  var base=ghCdnBase()+'/', out=[];
  artBearers(form).forEach(function(b){
    var u=String((b&&b.imageUrl)||'');
    if(u.indexOf(base)!==0)return;
    var p=u.slice(base.length).split(/[?#]/)[0];
    out.push(p+'='+(((rtMain&&rtMain.paths)||{})[p]||''));
  });
  return out.sort().join('\n');
}
/* How a card plays, the one change Publish TTS cards draws a card again for (the author, session 99): its name, type line,
   mana cost and rules text - on a split card each section's as printed, and the Choice line - and its stats, read off the
   version ttsDrawCopy draws. Its art, frame, flavour, artist, revision, designer and rarity are not in it. */
function ttsRulesPrint(form){
  var d=ttsDrawCopy(form,''), ess=isEssenceCard(d), secs=ess?null:cardSections(d);
  return ghStableJson({
    name:String(d.name||''), cost:String(d.manaCost||''), type:typeLine(d),
    rules:secs?'':String(d.ruleText||''),
    secs:(secs||[]).map(function(s){
      var id=sectionShowsIdent(d,s);
      return {name:id?s.name:'',cost:id?s.manaCost:'',type:id?typeLine(s):'',text:s.text};
    }),
    choice:(secs&&splitChoiceOf(d))?choiceTextOf(d):'',
    stats:ess?[]:cardOrbs(d).map(function(o){ return [String(o.type),String(o.value)]; })
  });
}
/* What is drawn: the published card with its pictures at the commit just read (a branch address on the CDN can be hours
   behind it), as its own saga's version, whatever saga the catalogue is showing. */
function ttsDrawCopy(form,head){
  var base=ghCdnBase()+'/';
  var pin=head?'https://cdn.jsdelivr.net/gh/'+GH_REPO.owner+'/'+GH_REPO.repo+'@'+head+'/':'';
  var o=JSON.parse(JSON.stringify(form));
  if(pin)artBearers(o).forEach(function(b){
    var u=String((b&&b.imageUrl)||'');
    if(u.indexOf(base)===0)b.imageUrl=pin+u.slice(base.length);
  });
  var sid=sagaIdsOf(o)[0]||o.sagaId||null;
  var d=sid?cardForSaga(o,sid):o;
  if(d.__drawSaga===undefined){ try{ Object.defineProperty(d,'__drawSaga',{value:sid,enumerable:false}); }catch(_){} }
  /* No card number: it is the card's place among every card of its saga in this copy, so one card added to a saga would
     change every picture in it, over a thousand in Beginnings, and this copy (its Test cards too) is not the one a player
     sees (session 98). */
  try{ Object.defineProperty(d,'__noNum',{value:true,enumerable:false}); }catch(_){}
  return d;
}
/* The stylesheet rules a face is drawn with (its own classes, the frames, the fonts), not the print sheet's: a change to
   one of them changes every face. */
var TTS_FACE_SEL=/\.(mcard|m-|fr\b|fr-|fa-|fc-|art-full|kw-(pill|link|shadow)|i-(artist|distrib|num|rev|saga)\b|o-(base|num|top)\b|ring-|mana-s\b|mico\b|nocost\b|inner-fill\b|deco\b)|body\.(edge-|pin-|bleed)/;
function ttsCssText(keep){
  var out=[];
  var walk=function(rules){
    Array.prototype.forEach.call(rules||[],function(r){
      if(r.cssRules&&r.type!==1){
        var m=String((r.media&&r.media.mediaText)||r.conditionText||'');
        if(!/print/i.test(m))walk(r.cssRules);
        return;
      }
      if(keep(r))out.push(r.cssText);
    });
  };
  Array.prototype.forEach.call(document.styleSheets||[],function(s){ try{ walk(s.cssRules); }catch(_){} });
  return out.join('\n');
}
function ttsFaceCss(){
  return ttsCssText(function(r){ return r.type===5||(r.type===1&&TTS_FACE_SEL.test(r.selectorText||'')); });
}
function ttsBackCss(){
  return ttsCssText(function(r){ return r.type===1&&(/cbk/.test(r.selectorText||'')||/--conjure-logo/.test(r.cssText||'')); });
}
/* The look a face is drawn with: the pack (less its card back, picked for each deck and never on a face), the watermarks,
   the keywords' reminders, the face's stylesheet rules and how a picture is drawn. */
function ttsLookPrint(){
  var b=ghLookShape();
  if(b.cardLook&&typeof b.cardLook==='object')delete b.cardLook.back;
  var kw=(window.KW_DATA||[]).concat(KW_EXTRA||[]).map(function(k){ return ghStableJson(k); }).sort();
  return ttsSha(TTS_DRAW+'\n'+ghStableJson(b)+'\n'+ghStableJson(ghBuildMarks())+'\n'+kw.join('\n')+'\n'+ttsFaceCss());
}

function ttsEmptyList(){
  return {format:1,game:ghMode(),set:GH_REPO.owner+'/'+GH_REPO.repo,cards:Object.create(null),backs:Object.create(null)};
}
function ttsCleanEntry(x){
  if(!x||typeof x!=='object')return null;
  /* the hash goes into the address (ttsCdn); a list from session 97 also names a commit (at), which no address needs now */
  var f=String(x.f||''), sha=String(x.sha||'');
  if(!TTS_FILE.test(f)||!TTS_SHA.test(sha))return null;
  var o={n:String(x.n||''),f:f,fp:String(x.fp||''),sha:sha};
  /* fn, the rules print (session 99): a list from before has none */
  if(x.fn)o.fn=String(x.fn);
  if(x.lk)o.lk=String(x.lk);
  if(x.noart)o.noart=1;
  return o;
}
/* Read from another repository, so only what fits the shape is kept; null-prototype maps, as a key is a card id. */
function ttsCleanList(j){
  var out=ttsEmptyList();
  if(!j||typeof j!=='object')return out;
  if(typeof j.game==='string')out.game=j.game;
  if(typeof j.set==='string')out.set=j.set;
  [['cards',out.cards],['backs',out.backs]].forEach(function(p){
    var src=j[p[0]]; if(!src||typeof src!=='object')return;
    Object.keys(src).forEach(function(id){
      if(!TTS_KEY.test(id))return;
      var en=ttsCleanEntry(src[id]); if(en)p[1][id]=en;
    });
  });
  return out;
}
/* One entry a line, in id order, so a publish that changes one card changes one line. */
function ttsListJson(list){
  var block=function(m){
    var ids=Object.keys(m).sort();
    return ids.length?'{\n'+ids.map(function(id){ return '  '+JSON.stringify(id)+':'+ghStableJson(m[id]); }).join(',\n')+'\n }':'{}';
  };
  return '{"format":1,"game":'+JSON.stringify(list.game)+',"set":'+JSON.stringify(list.set)
    +',"size":['+TTS_W+','+TTS_H+'],\n "backs":'+block(list.backs)+',\n "cards":'+block(list.cards)+'\n}\n';
}
function ttsListUrl(t){
  return 'https://raw.githubusercontent.com/'+t.owner+'/'+t.repo+'/'+ghRefPath(t.branch||'main')+'/'+TTS_LIST;
}
/* Through the API, never the CDN, which can be minutes behind the branch this writes to. */
function ttsReadList(t,rt){
  var sha=rt&&rt.paths&&rt.paths[TTS_LIST];
  if(!sha)return Promise.resolve(ttsEmptyList());
  var name=t.owner+'/'+t.repo;
  return ghApi('GET','/git/blobs/'+sha,undefined,0,t).then(function(r){
    var j=null; try{ j=JSON.parse(ghB64Utf8(r&&r.content)); }catch(_){}
    if(!j||typeof j!=='object'||!j.cards||typeof j.cards!=='object')
      throw ttsBefore(TTS_LIST+' in '+name+' is not a list this page can read. Nothing was sent.');
    if(j.game&&j.game!==ghMode())
      throw ttsBefore(name+' holds the other game’s Tabletop Simulator pictures. Nothing was sent.');
    if(j.set&&String(j.set).toLowerCase()!==String(GH_REPO.owner+'/'+GH_REPO.repo).toLowerCase())
      throw ttsBefore(name+' holds the Tabletop Simulator pictures of '+j.set+'. Nothing was sent.');
    return ttsCleanList(j);
  });
}
/* A picture is drawn from the cards as published: what is here must be what the cards' repository holds, byte for byte. */
function ttsCardsPublished(){
  var local={};
  return ghFetchManifest().then(function(prev){
    var pay=ghPayload(prev), enc=new TextEncoder();
    return Promise.all(TTS_SAME.map(function(n){
      return ghBlobSha(enc.encode(pay[n])).then(function(s){ local[n]=s; });
    }));
  }).then(ghRemoteTree).then(function(rtm){
    var off=TTS_SAME.filter(function(n){ return !rtm.paths||rtm.paths[n]!==local[n]; });
    if(rtm.empty||rtm.newBranch||off.length)
      throw ttsBefore('Publish the cards first: what is here differs from what '+GH_REPO.owner+'/'+GH_REPO.repo
        +' holds ('+(off.length?off.join(', '):'nothing published')+'). Nothing was sent.');
    return rtm;
  });
}
/* What to draw. Publish TTS cards draws a card that is new, has no picture there, was drawn with its art missing, or now
   plays differently (its rules print, ttsRulesPrint); any other change (its print) waits for Redraw all, which takes every
   card drawn with another look than this one or changed since it was drawn, or, when none was, every card (the author,
   session 99). An entry from before session 99 has no rules print: an unchanged card is given its own, a changed one is
   drawn again, as it was then. A card back is drawn when it is new or missing, and on Redraw all. */
function ttsPlan(rtMain,rt,list,all,lookNow){
  var keep=ghPublishSagaSet(), jobs=[], bjobs=[], bad=[], seen=Object.create(null), rows=[], waitB=[];
  var live=Object.create(null), liveB=Object.create(null), lk=String(lookNow||'').slice(0,12);
  var forms=(window.CARDS||[]).filter(function(c){ return c&&!c.testing&&ghInScope(c,keep); })
    .map(function(c){ return ghPublishedForm(c,keep); })
    /* an official card in a saga of yours: the official set's own picture serves it */
    .filter(function(o){ return !o.linked; });
  var stale=forms.filter(function(o){ var en=list.cards[String(o.cid||'')]; return !!en&&en.lk!==lk; }).length;
  var p=Promise.resolve();
  forms.forEach(function(o){
    var cid=String(o.cid||''), f=ttsCardFile(cid);
    if(!f||seen[cid]){ if(!f)bad.push(o.name||'a card'); return; }
    seen[cid]=1; live[cid]=1;
    var row={o:o,cid:cid,f:f};
    rows.push(row);
    p=p.then(function(){ return ttsSha(ghStableJson(o)+'\n'+ttsArtPrint(o,rtMain)); }).then(function(fp){
      row.fp=fp.slice(0,24);
      return ttsSha(ttsRulesPrint(o));
    }).then(function(fn){ row.fn=fn.slice(0,24); });
  });
  var bcss=null;
  (window.CB_LIST||[]).forEach(function(b){
    var key=String((b&&b.key)||'');
    if(!TTS_KEY.test(key)||!(window.CB_MARKUP||{})[key])return;
    p=p.then(function(){
      if(bcss===null)bcss=ttsBackCss();
      return ttsSha(TTS_DRAW+'\n'+key+'\n'+window.CB_MARKUP[key]+'\n'+bcss);
    }).then(function(fp){
      fp=fp.slice(0,24); liveB[key]=1;
      var en=list.backs[key], f='backs/'+key+'.jpg', name=String(b.name||key);
      if(all||!en||en.f!==f||!rt.paths[en.f])bjobs.push({kind:'back',id:key,name:name,path:f,fp:fp});
      else if(en.fp!==fp)waitB.push('the '+name+' back');
    });
  });
  return p.then(function(){
    var since=function(r){ var en=list.cards[r.cid]; return !!en&&(en.lk!==lk||en.fp!==r.fp); };
    var every=all&&!rows.some(since), waiting=[];
    rows.forEach(function(r){
      var en=list.cards[r.cid];
      if(en&&!en.fn&&en.fp===r.fp)en.fn=r.fn;
      var need=!en||en.f!==r.f||!rt.paths[en.f]||!!en.noart||en.fn!==r.fn||(all&&(every||since(r)));
      if(need)jobs.push({kind:'card',id:r.cid,name:r.o.name||r.cid,path:r.f,fp:r.fp,fn:r.fn,form:r.o});
      else if(en.fp!==r.fp)waiting.push(r.o.name||r.cid);
    });
    return {jobs:bjobs.concat(jobs),bad:bad,stale:stale,cards:rows.length,waiting:waiting.concat(waitB),
            gone:Object.keys(list.cards).filter(function(id){ return !live[id]; }),
            goneBacks:Object.keys(list.backs).filter(function(k){ return !liveB[k]; })};
  });
}
/* A card's art box left empty because there is no picture at its address (404) is drawn so, as the site shows it, and
   tried again next time; any other failure to read it leaves the card for next time. */
function ttsDraw(job,head){
  var bytes=function(b){ return b.arrayBuffer().then(function(ab){ return new Uint8Array(ab); }); };
  if(job.kind==='back')
    return window.edBackToBlob(job.id,'image/jpeg',TTS_QUALITY,'#000').then(function(r){
      return bytes(r.blob).then(function(u8){ return {bytes:u8}; });
    },function(err){ return {skip:true,why:(err&&err.message)||String(err)}; });
  return window.edFaceToBlob(ttsDrawCopy(job.form,head),TTS_W/340,'image/jpeg',TTS_QUALITY,'#000').then(function(r){
    var why=r.why||[], miss=r.missingArt||0;
    if(miss&&!(why.length&&why.every(function(w){ return w==='HTTP 404'; })))
      return {skip:true,why:'its art could not be read: '+why.join('; ')};
    return bytes(r.blob).then(function(u8){ return {bytes:u8,noart:miss?1:0}; });
  },function(err){ return {skip:true,why:(err&&err.message)||String(err)}; });
}
/* A tree, a commit and the branch moved to it, as ghSendPart does. */
function ttsCommit(t,run,entries,msg,pace){
  var base=run.tree, i=0, tree='';
  function step(){
    if(i>=entries.length)return Promise.resolve(base);
    var body={tree:entries.slice(i,i+GH_TREE_CHUNK)};
    if(base)body.base_tree=base;
    i+=GH_TREE_CHUNK;
    return ghPacedApi(pace,'POST','/git/trees',body,t).then(function(r){ base=r.sha; return step(); });
  }
  return step().then(function(treeSha){
    tree=treeSha;
    return ghPacedApi(pace,'POST','/git/commits',{message:msg,tree:treeSha,parents:[run.head]},t);
  }).then(function(commit){
    var br=t.branch||'main';
    run.stage='ref'; run.commit=String(commit.sha||'');
    return (run.made
      ? ghPacedApi(pace,'PATCH','/git/refs/heads/'+ghRefPath(br),{sha:commit.sha},t)
      : ghPacedApi(pace,'POST','/git/refs',{ref:'refs/heads/'+br,sha:commit.sha},t))
      .then(function(){
        run.stage='prep'; run.made=true; run.head=run.commit; run.tree=tree; run.commits++;
        entries.forEach(function(en){ if(en.sha)run.paths[en.path]=en.sha; else delete run.paths[en.path]; });
      });
  });
}
function ttsSendBlob(t,u8,sha,path,pace){
  return ghPacedApi(pace,'POST','/git/blobs',{content:ghB64Bytes(u8),encoding:'base64'},t).then(function(r){
    if(r.sha!==sha)throw new Error('GitHub stored a different hash for '+path+' than this page computed. '
      +'Refusing to build a tree from it.');
  });
}
/* A part: its pictures in one commit, then the list naming them in a second, so a stop between parts leaves every
   listed address good and the next press carries on; a picture already there is never sent twice. The last part
   also takes the cards that are gone out of the list. */
function ttsSendPart(t,run,k,jobs,list,lookNow,pace,last){
  var part=run.parts>1?'part '+(k+1)+' of '+run.parts:'', label=part?part+': ':'';
  var entries=[], done=[], p=Promise.resolve();
  jobs.forEach(function(job,i){
    p=p.then(function(){
      ttsPushStatus('Drawing '+label+(i+1)+' of '+jobs.length+', '+job.name+'…');
      return ttsDraw(job,run.mainHead);
    }).then(function(r){
      if(r.skip){ run.skipped.push(job.name+(r.why?' ('+r.why+')':'')); return; }
      run.drawn++;
      if(r.noart)run.noArt.push(job.name);
      return ghBlobSha(r.bytes).then(function(sha){
        if(run.paths[job.path]===sha){ done.push({job:job,sha:sha,noart:r.noart}); return; }
        return ttsSendBlob(t,r.bytes,sha,job.path,pace).then(function(){
          entries.push({path:job.path,mode:'100644',type:'blob',sha:sha});
          done.push({job:job,sha:sha,noart:r.noart});
          run.sent++;
          /* another picture was at that address: a deck made before shows this one once jsDelivr renews its copy */
          if(run.paths[job.path])run.replaced.push(job.name);
        });
      });
    });
  });
  return p.then(function(){
    if(!entries.length)return null;
    ttsPushStatus('Committing'+(part?' '+part:'')+'…');
    return ttsCommit(t,run,entries,'Tabletop Simulator pictures from the app'+(part?', '+part:'')+': '
      +entries.length+' file(s)',pace);
  }).then(function(){
    done.forEach(function(d){
      var tbl=d.job.kind==='back'?list.backs:list.cards;
      var rec={n:d.job.name,f:d.job.path,fp:d.job.fp,sha:d.sha};
      if(d.job.kind==='card'){ rec.fn=d.job.fn; rec.lk=String(lookNow||'').slice(0,12); }
      if(d.noart)rec.noart=1;
      tbl[d.job.id]=rec;
    });
    /* A card gone from the set leaves the list, and its picture stays where a deck made before looks for it. */
    if(last){
      last.gone.forEach(function(id){ delete list.cards[id]; run.gone++; });
      last.goneBacks.forEach(function(k){ delete list.backs[k]; });
    }
    list.game=ghMode(); list.set=GH_REPO.owner+'/'+GH_REPO.repo;
    var u8=new TextEncoder().encode(ttsListJson(list));
    return ghBlobSha(u8).then(function(sha){
      if(run.paths[TTS_LIST]===sha)return null;
      ttsPushStatus('Writing the list'+(part?', '+part:'')+'…');
      return ttsSendBlob(t,u8,sha,TTS_LIST,pace).then(function(){
        return ttsCommit(t,run,[{path:TTS_LIST,mode:'100644',type:'blob',sha:sha}],'Tabletop Simulator list from the app'
          +(part?', '+part:'')+': '+Object.keys(list.cards).length+' card(s)',pace);
      });
    });
  }).then(function(){ run.landed=k+1; });
}

window.edGhTtsPublish=function(all){
  if(_ghBusy)return Promise.resolve();
  var bad=ghConfigProblem()||ghWholeSetProblem()||ttsConfigProblem();
  if(bad){ ttsPushStatus(bad); return Promise.resolve(); }
  var blocked=syncBlockedReason(GH_API);
  if(blocked){ ttsPushStatus(blocked); return Promise.resolve(); }
  if(typeof window.edFaceToBlob!=='function'||typeof window.edBackToBlob!=='function'){
    ttsPushStatus('This page cannot draw card faces.'); return Promise.resolve(); }
  _ghBusy=true; _ttsStarted=false;
  var T=ttsTarget(), main=null, list=null, lookNow='', plan=null;
  var run={stage:'prep',parts:1,landed:0,commits:0,head:'',tree:'',made:false,paths:{},mainHead:'',
           newBranch:'',from:'',drawn:0,sent:0,gone:0,skipped:[],noArt:[],replaced:[]};
  ttsPushStatus('Reading the repositories…');
  return ttsCardsPublished().then(function(rtm){
    main=rtm; run.mainHead=rtm.head;
    return ghPublishTarget(T,ttsPushStatus);
  }).then(function(go){
    if(go!==true){
      _ghBusy=false;
      ttsPushStatus(go===false?'Cancelled - nothing was published.':'');
      return;
    }
    return ghRemoteTreeFor(T).then(function(rt){
      if(!rt.head)throw new Error('the repository has no commit to build on.');
      run.head=rt.head; run.tree=rt.tree; run.made=!rt.newBranch;
      run.newBranch=rt.newBranch||''; run.from=rt.from||'';
      Object.keys(rt.paths).forEach(function(k){ run.paths[k]=rt.paths[k]; });
      return ttsReadList(T,rt).then(function(l){ list=l; return ttsLookPrint(); }).then(function(lp){
        lookNow=lp;
        ttsPushStatus('Comparing the cards…');
        return ttsPlan(main,rt,list,all,lookNow);
      });
    }).then(function(pl){
      plan=pl;
      var nCards=pl.jobs.filter(function(j){ return j.kind==='card'; }).length;
      if(!all||!pl.jobs.length)return true;
      return edChooseModal({
        title:'Redraw '+nCards+' card'+(nCards===1?'':'s')+' for Tabletop Simulator?',
        body:'Each is drawn again as it is now, art and frame included, and a picture that comes out different replaces '
          +'the one at its address.',
        choices:[{key:'go',label:'Redraw '+nCards+' card'+(nCards===1?'':'s'),
                  detail:'Keep this page open until it says Published.'}]
      }).then(function(k){ return k==='go'; });
    }).then(function(ok){
      if(ok!==true){ _ghBusy=false; ttsPushStatus('Cancelled - nothing was published.'); return; }
      var pl=plan;
      if(!pl.jobs.length&&!pl.gone.length&&!pl.goneBacks.length){
        _ghBusy=false; _ttsList=list; ttsLookSet(list,lookNow);
        ttsPushStatus('Already up to date - every card has its picture.'+ttsWaitLine(pl.waiting)
          +(pl.bad.length?' '+pl.bad.length+' card(s) have no id to name a picture by: '+ttsNames(pl.bad)+'.':''));
        edRenderOwnerSync();
        return;
      }
      var parts=[];
      for(var i=0;i<pl.jobs.length;i+=GH_ART_BATCH)parts.push(pl.jobs.slice(i,i+GH_ART_BATCH));
      if(!parts.length)parts.push([]);
      run.parts=parts.length;
      /* each part: its pictures, two trees, two commits, two branch moves and the list */
      var pace=pl.jobs.length+7*parts.length>GH_WRITE_FREE;
      return parts.reduce(function(p,part,k){
        return p.then(function(){ return ttsSendPart(T,run,k,part,list,lookNow,pace,k===parts.length-1?pl:null); });
      },Promise.resolve()).then(function(){
        _ghBusy=false; run.stage='done'; _ttsList=list; ttsLookSet(list,lookNow);
        ttsPushStatus((run.commits?'Published to '+T.owner+'/'+T.repo+': ':'Nothing was committed: ')
          +run.drawn+' drawn, '+run.sent+' sent'+(run.gone?', '+run.gone+' taken off the list':'')+'.'
          +(run.commits?' Commit '+run.head.slice(0,10)+'.':'')
          +(run.newBranch&&run.commits?' Branch "'+run.newBranch+'" was created from "'+run.from+'".':'')
          +(run.replaced.length?' '+run.replaced.length+' replaced ('+ttsNames(run.replaced)+'): decks made before show the '
            +'new picture within about 12 hours, once jsDelivr renews its copy.':'')
          +(run.gone?' A card taken off the list keeps its picture there, for decks made before.':'')
          +(run.noArt.length?' '+run.noArt.length+' drawn with an empty art box, as no picture is at its address: '
            +ttsNames(run.noArt)+'.':'')
          +(run.skipped.length?' '+run.skipped.length+' not drawn: '+ttsNames(run.skipped)
            +'. Publish TTS cards again to try them.':'')
          +ttsWaitLine(pl.waiting)
          +(pl.bad.length?' '+pl.bad.length+' card(s) have no id to name a picture by: '+ttsNames(pl.bad)+'.':''));
        if(run.commits)toast('Published to '+T.owner+'/'+T.repo);
        edRenderOwnerSync();
        ttsTargetAgain(run);
      });
    });
  }).catch(function(err){
    _ghBusy=false;
    ttsTargetAgain(run);
    var m=(err&&err.message)||String(err);
    if(err&&err.before){ ttsPushStatus(m); return; }
    if(run.stage==='ref'&&!(err&&err.status)){
      ttsPushStatus('Publish TTS cards may have gone part of the way: the connection failed while the branch was '
        +'being moved to commit '+String(run.commit||'').slice(0,10)+' ('+m+'). Press Publish TTS cards again: '
        +'a picture already there is not sent twice.');
      return;
    }
    if(run.commits){
      ttsPushStatus('Publish TTS cards stopped part-way: '+m+(/[.!?]$/.test(m)?' ':'. ')
        +'Every card listed so far has its picture. Press Publish TTS cards again to send the rest: a picture '
        +'already there is not sent twice.');
      return;
    }
    ttsPushStatus('Publish TTS cards failed: '+m
      +(_ttsStarted?' The repository was started with a README; nothing else was committed.'
        :' Nothing was committed.'));
  });
};
window.edGhTtsRedraw=function(){ return window.edGhTtsPublish(true); };
/* The row's line said the repository was empty, or had no such branch: a press that started it or made the branch reads it again. */
function ttsTargetAgain(run){
  if(_ttsStarted||(run&&run.newBranch&&run.commits))ttsCheckTarget();
}

/* The look's line: how many listed cards were drawn with another look than this one. */
function ttsLookSet(list,lookNow){
  var lk=String(lookNow||'').slice(0,12), ids=Object.keys((list&&list.cards)||{});
  var stale=ids.filter(function(id){ return list.cards[id].lk!==lk; }).length;
  var was=_ttsLook?_ttsLook.stale:-1;
  _ttsLook={stale:stale,of:ids.length};
  return was!==stale;
}
function ttsLookLine(){
  return (_ttsLook&&_ttsLook.stale&&ttsTargetSet())?'The look has changed since the last full redraw.':'';
}
/* On opening Owner Sync: the list read once a visit (the published copy, no token needed), the look's print each time. */
function ttsLookRefresh(){
  if(!ttsTargetSet()){ _ttsLook=null; return Promise.resolve(); }
  var t=ttsTarget(), read=_ttsList?Promise.resolve(_ttsList)
    :_ttsListRead?Promise.resolve(null)
    :ttsFetchJson(ttsListUrl(t),true).then(ttsCleanList,function(){ return null; });
  _ttsListRead=true;
  return read.then(function(list){
    if(!list)return;
    _ttsList=list;
    return ttsLookPrint().then(function(lp){ if(ttsLookSet(list,lp))edRenderOwnerSync(); });
  }).catch(function(){});
}
window.edTtsLookState=function(){ return _ttsLook?{stale:_ttsLook.stale,of:_ttsLook.of}:null; };
/* for the checks: what Publish TTS cards reads of how a card plays (ttsRulesPrint) */
window.edTtsRulesPrint=function(c){ return c?ttsRulesPrint(c):''; };

/* ── CLEAN UP (session 98) ─────────────────────────────────────────────────
   GitHub keeps every old version of a picture, and a history rewritten there does not give the space back (it keeps what
   nothing points at), so the TTS repository is cleaned by deleting it and making it again under the same name: the
   addresses are the branch's, and Publish TTS cards puts each picture back where decks made before look for it. The token
   reaches Contents only, so this window says how, with links to GitHub's own pages, and deletes nothing itself. */
window.edGhTtsCleanUp=function(){
  if(_ghBusy)return Promise.resolve();
  var bad=ghConfigProblem()||ttsConfigProblem();
  if(bad){ ttsPushStatus(bad); return Promise.resolve(); }
  var blocked=syncBlockedReason(GH_API);
  if(blocked){ ttsPushStatus(blocked); return Promise.resolve(); }
  var T=ttsTarget(), name=T.owner+'/'+T.repo, kb=0;
  _ghBusy=true;
  ttsPushStatus('Reading '+name+'…');
  return ghApi('GET','',undefined,0,T).then(function(repo){
    kb=+(repo&&repo.size)||0;
    return ghRemoteTreeFor(T);
  }).then(function(rt){
    if(rt.empty)throw ttsBefore(name+' is empty: there is nothing to clean up.');
    if(rt.newBranch)throw ttsBefore(name+' has no branch "'+T.branch+'": there is nothing to clean up.');
    /* refused, as Publish TTS cards refuses it, when it holds the other game's pictures or another set's */
    return ttsReadList(T,rt).then(function(){
      _ghBusy=false;
      var paths=Object.keys(rt.paths);
      ttsPushStatus('');
      ttsCleanWindow(T,{kb:kb, pics:paths.filter(function(p){ return TTS_FILE.test(p); }).length,
        other:paths.filter(function(p){ return !TTS_FILE.test(p)&&p!==TTS_LIST&&p!=='README.md'; }).sort()});
    });
  }).catch(function(err){
    _ghBusy=false;
    var m=(err&&err.message)||String(err);
    ttsPushStatus(err&&err.before?m.replace(/ Nothing was sent\.$/,''):'Could not read '+name+': '+m);
  });
};
function ttsCleanWindow(T,info){
  ttsCleanClose();
  var name=T.owner+'/'+T.repo, n=info.pics, gh='https://github.com/';
  var link=function(href,txt){ return " <a href='"+e(href)+"' target='_blank' rel='noopener noreferrer'>"+e(txt)+"</a>"; };
  var step=function(i,txt,more){
    return "<div class='gate-step'><div class='gate-num'>"+i+"</div><div class='gate-txt'>"+e(txt)+(more||'')+"</div></div>";
  };
  var other=info.other.slice(0,8).join(', ')+(info.other.length>8?' and '+(info.other.length-8)+' more':'');
  var ov=document.createElement('div'); ov.id='ttsCleanOv'; ov.className='ed2-overlay';
  ov.innerHTML="<div class='ed2-modal ed2-gate tts-clean'><div class='ed2-modal-head wh'>"
    +"<b class='gate-title wh-t'>"+e('Clean up '+name)+"</b></div>"
    +"<div class='ed2-modal-body'>"
    +"<div class='gate-txt'>"+e(name+' holds '+n+' picture'+(n===1?'':'s')
      +(info.kb?', and GitHub counts '+ghSizeText(info.kb)+' for it, history included':'')+'.')+"</div>"
    +"<div class='gate-note'>"+e('GitHub keeps every old version of a picture, even when the history is rewritten, so the '
      +'way to free that space is to delete the repository and make it again with the same name. Each picture keeps its '
      +'address, so decks made before get it back once Publish TTS cards has sent it again.')+"</div>"
    +(info.other.length?"<div class='gate-lose' id='ttsCleanOther'><h5>NOT MADE BY PUBLISH TTS CARDS</h5><ul><li>"
      +e(info.other.length+' file'+(info.other.length===1?'':'s')+' that deleting the repository loses: '+other+'.')
      +"</li></ul></div>":'')
    +step(1,'On GitHub, delete '+name+': its Settings, at the very bottom, Delete this repository. Only this one, never '
      +GH_REPO.owner+'/'+GH_REPO.repo+'.',link(gh+T.owner+'/'+T.repo+'/settings','Open its settings'))
    +step(2,'Make it again: a new public repository named '+T.repo+', owned by '+T.owner+'.',link(gh+'new','New repository'))
    +step(3,'If your access token reaches chosen repositories only, edit it and add the new '+T.repo+', with Contents read '
      +'and write: a token does not reach a new repository of the same name by itself.',
      link(gh+'settings/personal-access-tokens','Your tokens'))
    +step(4,'Press Publish TTS cards. It starts the new repository and sends every picture again.'
      +(n>500?' For '+n+' pictures that is about '+Math.ceil(n/500)+' presses, an hour apart: GitHub takes about 500 '
        +'new files an hour.':''))
    +"<div class='gate-note'>"+e('Until a picture is back, a deck made before shows that card blank, unless the player’s '
      +'Tabletop Simulator saved it already. A picture kept only for decks made before, of a card taken off the list, does '
      +'not come back.')+"</div>"
    +"<div class='gate-actions'><button class='ed2-btn nb nb-red nb-l close-x' id='ttsCleanNo'>Close &#10005;</button></div>"
    +"</div></div>";
  document.body.appendChild(ov);
  ov.querySelector('#ttsCleanNo').addEventListener('click',ttsCleanClose);
  ov.addEventListener('click',function(ev){ if(ev.target===ov)ttsCleanClose(); });
  edDialogOpen(ov,'Clean up '+name,ttsCleanClose,ov.querySelector('#ttsCleanNo'));
}
function ttsCleanClose(){
  var ov=document.getElementById('ttsCleanOv'); if(!ov)return;
  edDialogClose(ov);
  if(ov.parentNode)ov.parentNode.removeChild(ov);
}

/* ── A PLAYER'S DECK (Build Deck → Export → TTS, cat_export.js) ────────────
   Each card's picture from the TTS list its own set's manifest names (the manifest's tts), and the card backs from the
   official set's list; a set whose list lacks a back lends its own. Read once in five minutes. */
var _ttsReadMemo={};
function ttsFetchJson(url,fresh){
  var m=_ttsReadMemo[url];
  if(m&&!fresh&&Date.now()-m.at<5*60000)return m.p;
  var why=syncBlockedReason(url);
  var p=(why?Promise.reject(new Error(why)):fetchSource(url)).then(function(res){
    if(!res||res.zip||!res.json||typeof res.json!=='object')throw new Error('what came back is not a list.');
    return res.json;
  });
  _ttsReadMemo[url]={at:Date.now(),p:p};
  p.catch(function(){ if(_ttsReadMemo[url]&&_ttsReadMemo[url].p===p)delete _ttsReadMemo[url]; });
  return p;
}
function ttsPointerOf(man){
  var t=man&&man.tts;
  if(!t||typeof t!=='object')return null;
  var o={owner:String(t.owner||''),repo:String(t.repo||''),branch:String(t.branch||'main')};
  return (ghNameOk(o.owner)&&ghNameOk(o.repo)&&ghBranchOk(o.branch))?o:null;
}
/* a set with no manifest has no pictures, and a TTS repository with no list has none drawn yet */
function ttsMissing(err){ return /answered 404/.test(String((err&&err.message)||'')); }
function ttsListOf(src){
  var dir=String(src.url||'').split(/[?#]/)[0].replace(/[^\/]*$/,'');
  return ttsFetchJson(dir+'manifest.json').then(null,function(err){
    if(ttsMissing(err))return null;
    throw err;
  }).then(function(man){
    var t=ttsPointerOf(man);
    if(!t)return {none:true};
    return ttsFetchJson(ttsListUrl(t)).then(function(j){ return {t:t,list:ttsCleanList(j)}; },function(err){
      if(ttsMissing(err))return {t:t,list:ttsCleanList(null)};
      throw err;
    });
  });
}
/* The branch's address, so a deck made before shows a card's newest picture; v is git's hash of the picture, so a deck
   made after a change loads it afresh in Tabletop Simulator, which keeps every picture it has loaded by its address. */
function ttsCdn(t,en){
  return 'https://cdn.jsdelivr.net/gh/'+t.owner+'/'+t.repo+'@'+(t.branch||'main')+'/'+en.f+'?v='+en.sha.slice(0,10);
}
/* The set a card is published by: the official one, or the followed set its saga comes from; none for a card made here
   and never published, or one from a table. */
function ttsSourceOf(c){
  if(!c)return null;
  if(edOfficialCard(c))return srcOfficial();
  var ids=sagaIdsOf(c);
  for(var i=0;i<ids.length;i++){
    var sg=sagaById(ids[i]); if(!sg)continue;
    var k=groupKeyOf(sg);
    if(k===GROUP_OFFICIAL)return srcOfficial();
    if(k===GROUP_LOCAL||String(k).indexOf('table:')===0)continue;
    var s=srcByKey(k); if(s)return s;
  }
  return null;
}
var TTS_WHY={local:'Not published from a set', none:'Its set has no Tabletop Simulator pictures',
  unread:'Its set’s list could not be read', notyet:'Not drawn for Tabletop Simulator yet'};
window.edTtsLists=function(cards){
  cards=(cards||[]).filter(Boolean);
  var off=srcOfficial(), bySrc={}, order=[], srcOf=cards.map(function(c){
    var s=ttsSourceOf(c);
    if(s&&!bySrc[s.key]){ bySrc[s.key]=s; order.push(s.key); }
    return s;
  });
  if(!bySrc[off.key]){ bySrc[off.key]=off; order.push(off.key); }
  var got={};
  return Promise.all(order.map(function(k){
    return ttsListOf(bySrc[k]).then(function(r){ got[k]=r; },function(err){ got[k]={err:(err&&err.message)||String(err)}; });
  })).then(function(){
    var faces=cards.map(function(c,i){
      var s=srcOf[i];
      if(!s)return {url:'',why:TTS_WHY.local};
      var g=got[s.key]||{};
      if(g.err)return {url:'',why:TTS_WHY.unread,err:g.err};
      if(g.none||!g.list)return {url:'',why:TTS_WHY.none};
      var en=g.list.cards[String(c.cid||'')];
      return en?{url:ttsCdn(g.t,en)}:{url:'',why:TTS_WHY.notyet};
    });
    var backs={};
    var take=function(g){
      if(!g||!g.list)return;
      Object.keys(g.list.backs).forEach(function(k){ if(!backs[k])backs[k]=ttsCdn(g.t,g.list.backs[k]); });
    };
    take(got[off.key]);
    order.forEach(function(k){ take(got[k]); });
    return {faces:faces,backs:backs};
  });
};

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
  ttsLookRefresh();
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
    /* Deliberately no switch here: followers always take updates on open, and only the owner's own set waits for a press. */
    +"<div class='gh-onerow gh-toggles'>"
    +"<button class='ed2-btn tiny' onclick='edGhWeeklyRun()'"
    +" title='Every saga with a source, now'>Sync All Sagas</button>"
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

  /* the pictures Tabletop Simulator loads, with the token above; the look's line only while it is so (HANDOFF §12.1 E) */
  var ttsLook=ttsLookLine();
  h+="<div class='gh-sec' id='ttsSec'><h4>TTS Repo</h4>"
    +ghRow('Repository','',
        "<input class='ed2-in tiny' id='ttsOwner' type='text' value=\""+e(GH_TTS.owner)+"\" placeholder='username' "
        +"onchange=\"edGhSetTts('owner',this.value,1)\"> / "
        +"<input class='ed2-in tiny' id='ttsRepo' type='text' value=\""+e(GH_TTS.repo)+"\" placeholder='repository' "
        +"onchange=\"edGhSetTts('repo',this.value,1)\"> @ "
        +"<input class='ed2-in tiny' id='ttsBranch' type='text' value=\""+e(GH_TTS.branch||'main')+"\" placeholder='main' "
        +"onchange=\"edGhSetTts('branch',this.value,1)\">")
    +"<div class='gh-msg' id='ttsTargetMsg'>"+e(_ttsTargetMsg)+"</div>"
    +"<div class='gh-btns'>"
    +"<button class='ed2-btn primary' id='ttsPublishBtn' onclick='edGhTtsPublish()'>Publish TTS cards</button>"
    +"<button class='ed2-btn' id='ttsRedrawBtn' onclick='edGhTtsRedraw()'>Redraw all</button>"
    +"<button class='ed2-btn' id='ttsCleanBtn' onclick='edGhTtsCleanUp()'>Clean up…</button>"
    +"</div>"
    +(ttsLook?"<div class='gh-msg warn' id='ttsLookMsg'>"+e(ttsLook)+"</div>":'')
    +"<div class='gh-msg' id='ttsPushMsg'>"+e(_ttsPushMsg)+"</div>"
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
  var s=srcByKey(key), fresh=!s;
  if(!s){
    s={url:url, added:new Date().toISOString(), lastCheck:'', lastSync:'', skip:[]};
    SOURCES.push(s); srcWrap(s); srcSave();
  }
  _srcChecked[s.key]=1;
  srcRender();
  return ghCheckSource(s).then(function(){ return ghAutoApply(s); }).then(function(){
    var st=srcState(s);
    /* a set for the other game is never right here, so a new one leaves no row behind */
    if(st&&st.wrongGame&&fresh){
      SOURCES=SOURCES.filter(function(x){ return srcKeyOf(x.url)!==s.key; });
      delete _srcState[s.key]; srcSave(); srcRender();
      toast('Could not follow that set: '+st.err);
      return null;
    }
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
      Object.keys(ids).forEach(function(id){ if(removeSagaMembership(c,id))srcDropSagaFields(c,id); });
      markDirty(c);
    });
    SAGAS=SAGAS.filter(function(sg){ return !ids[sg.id]; });
    SOURCES=SOURCES.filter(function(x){ return srcKeyOf(x.url)!==s.key; });
    delete _srcState[s.key]; srcSave();
    srcFromForget(s.key);
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
  if(_ghChecked)return;
  if(!GH_SOURCE||syncBlockedReason(GH_SOURCE))return;
  _ghChecked=true;
  /* a promise, so boot can say when the open is over (CONJURE_OPENED, ed2_boot.js) */
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
  /* no update taken here, but a followed set's keywords and watermarks still come; ghApplyUpdateNow brings them with one */
  var extrasOnly=function(){
    return src.official?Promise.resolve(null):srcSyncExtras(src,st.pkg,false).then(function(){ return null; });
  };
  var d=st.diff;
  if(!d||(!d.added&&!d.changed&&!d.removed))return extrasOnly();
  if(src.official&&GH_OWNER_MODE)return extrasOnly();
  if(!src.official&&srcOwned(src))return extrasOnly();
  /* Nor on the official token holder's copy, switch or not: a card deleted there but not yet published would come straight back. */
  if(src.official&&edOwnerUnlocked())return extrasOnly();
  if(ghWouldOverwriteOwnWork(ghIncoming(st.pkg.cards,src),st.ctx))return extrasOnly();
  /* down before the apply: a badge that vanishes a second later, unpressed, reads as a failure */
  ghBadge(null);
  return ghApplyUpdate(false,src);
}

/* A closed page cannot run, so "every Friday" is the first open on or after the Friday it is due; there is no switch. */
var GH_WEEK_MS=7*24*60*60*1000;

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
        if(!n)return srcSyncExtras(s,st.pkg,false);
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
