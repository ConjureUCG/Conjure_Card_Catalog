/* Closes the editor IIFE and its <script>, so it stays the last editor slice; build_harness.py injects test hooks before the close. */

function setDeckPanelForTab(tab){
  var editor=(tab==='editor');
  ['dp','deck-panel','dp-min','dpMini','deckMini','dp-mini'].forEach(function(id){
    var el=document.getElementById(id); if(el)el.style.display=editor?'none':'';
  });
  document.querySelectorAll('.dp, .deck-panel, .dp-min, .deck-mini').forEach(function(el){
    el.style.display=editor?'none':'';
  });
}
(function(){ var orig=window.showTab;
  if(typeof orig==='function'){
    window.showTab=function(tab){ orig(tab); try{ setDeckPanelForTab(tab); }catch(_){}
      if(tab!=='editor'){
        setTimeout(scheduleFace,50);
        /* Fallback where there is no ResizeObserver: faces built while the pane was hidden measured 0 wide and stayed unscaled. */
        setTimeout(function(){
          document.querySelectorAll('.mcard-fit').forEach(function(f){
            try{ scaleFaceIn(f); }catch(_){}
          });
        },60);
      } };
  }
})();
/* Acts only when openMod's own face drawing fell back to the plain image. */
(function(){ var tries=0;
  function hook(){ var orig=window.openMod;
    if(typeof orig==='function'){
      window.openMod=function(card){ orig(card); try{ setTimeout(faceModal,10); }catch(_){} };
      return true;
    }
    return false;
  }
  if(!hook()){ var iv=setInterval(function(){ tries++; if(hook()||tries>40)clearInterval(iv); },100); }
})();

var _inited=false;
/* Old mergeKeys of cards folded into another as alternate art (HANDOFF §9). A stored record under one is neither re-added
   (that would bring the duplicate back) nor deleted: it is reported, so an edit can still be recovered by hand. */
var MERGED_ALT_ART={
  'Beginnings::dentis?vita the reaching':'Beginnings::dentisvita the reaching',
  'Beginnings::zria?ev, cosmic shadow':'Beginnings::zriaev, cosmic shadow',
  'Beginnings::abolisher liek?torm':'Beginnings::abolisher liektorm',
  'Beginnings::gronklin bloon?gineer':'Beginnings::gronklin bloongineer',
  'Beginnings::the dominus, sab?toth':'Beginnings::the dominus, sabtoth',
  'Beginnings::hinoyari? earth scortcher':'Beginnings::hinoyari earth scortcher',
  'Beginnings::primus? boon':'Beginnings::primus boon',
  'Beginnings::akens fireworks':'Infinite::akens fireworks',
  'Beginnings::ancients hearth':'Infinite::ancients hearth',
  'Beginnings::ancients knowledge':'Infinite::ancients knowledge',
  'Beginnings::ancients rest':'Infinite::ancients rest',
  'Beginnings::ancients revenge':'Infinite::ancients revenge',
  'Beginnings::ancients turmoil':'Infinite::ancients turmoil',
  'Beginnings::ancients wisdom':'Infinite::ancients wisdom',
  'Beginnings::ancients wrath':'Infinite::ancients wrath',
  'Beginnings::archmages cantor':'Infinite::archmages cantor',
  'Beginnings::assassins mark':'Infinite::assassins mark',
  'Beginnings::blinds eye':'Infinite::blinds eye',
  'Beginnings::clerics devotion':'Infinite::clerics devotion',
  'Beginnings::covens caller':'Infinite::covens caller',
  'Beginnings::druids dispersal':'Infinite::druids dispersal',
  'Beginnings::hero?s fall':'Infinite::heros fall',
  'Beginnings::legion?s champion':'Infinite::legions champion',
  'Beginnings::mind?s eye':'Infinite::minds eye',
  'Beginnings::salamander?s spit fire':'Infinite::salamanders spit fire',
  'Beginnings::trader?s cart':'Infinite::traders cart',
  'Beginnings::warrior?s might':'Infinite::warriors might',
  'Beginnings::watcher?s shield':'Infinite::watchers shield',
  'Beginnings::armorer?s apron':'Beginnings::armorers apron',
  'Beginnings::ippo?po, phell drift':'Beginnings::ippopo, phell drift',
  'Beginnings::assassin?s determination':'Beginnings::assassins determination',
  'Beginnings::corpseblossom?s baron':'Beginnings::corpseblossoms baron',
  'Beginnings::crimson knight?s banner':'Beginnings::crimson knights banner',
  'Beginnings::felix?s charm':'Beginnings::felixs charm',
  'Beginnings::marauder?s gambit':'Beginnings::marauders gambit',
  'Beginnings::nature?s eminence':'Beginnings::natures eminence',
  'Beginnings::roanoak?s liberating blaze':'Beginnings::roanoaks liberating blaze',
  'Beginnings::speaker?s tabernacle':'Beginnings::speakers tabernacle',
  'Beginnings::sunspired?s prayer':'Beginnings::sunspireds prayer',
  'Beginnings::bronze bull?s eye':'Beginnings::bronze bulls eye',
  'Beginnings::horizon?s embrace':'Beginnings::horizons embrace',
  'Beginnings::ingnear?s ingenius':'Beginnings::ingnears ingenius',
  'Beginnings::life?s ambitions':'Beginnings::lifes ambitions',
  'Beginnings::mitera?s miracle':'Beginnings::miteras miracle',
  'Beginnings::presence of zria?ev':'Beginnings::presence of zriaev',
  'Beginnings::rond, titan?s smoke':'Beginnings::rond, titans smoke',
  'Beginnings::soujerner?s coin':'Beginnings::soujerners coin',
  'Beginnings::trail blazer?s horse':'Beginnings::trail blazers horse',
  'Beginnings::traitor?s reward':'Beginnings::traitors reward',
  'Beginnings::witch?s brew familiar':'Beginnings::witchs brew familiar',
  /* The renamed duplicates folded by tools/fold_renamed_dupes.py (HANDOFF §13); regenerate with its --emit-js --island <pre-fold copy>. */
  'Beginnings::cursed anxious feeling':'Beginnings::anxious feeling',
  'Beginnings::armed legionnaire':'Beginnings::armed cuirassier',
  'Beginnings::ormick the bow bound':'Beginnings::bow bound ormick',
  'Beginnings::cursed chains of guilt':'Beginnings::chains of guilt',
  'Beginnings::cut throat, brandy':'Beginnings::cut throat brandy',
  'Beginnings::guerilla serveying':'Beginnings::guerilla surveying',
  'Beginnings::the ripper':'Beginnings::kellish the ripper',
  'Beginnings::formation captain':'Beginnings::legions captain',
  'Beginnings::marius, xylexs chosen':'Beginnings::marius, chosen by xylex',
  'Beginnings::marked for death':'Beginnings::mark of death',
  'Beginnings::rhinodon shell beetle':'Beginnings::rhinodon beetle',
  'Beginnings::plagued gravemass':'Beginnings::risen gravemass',
  'Beginnings::snowball sprite':'Infinite::snowball form',
  'Beginnings::squeeg, voracious toad':'Beginnings::squeeg, voracious gload',
  'Beginnings::king of the swarm':'Beginnings::swarm king rineal',
  'Beginnings::queen of the swarm':'Beginnings::swarm queen avula',
  'Beginnings::fractured heart':'Beginnings::the fractured heart',
  'Beginnings::hell piercer':'Beginnings::the hell piercer',
  'Beginnings::pillar of autumn':'Beginnings::the pillar of autumn',
  'Beginnings::the post mortum, ingnear':'Beginnings::the post mortem ingnear',
  'Beginnings::silversoul':'Beginnings::the silversoul',
  'Beginnings::starduster':'Beginnings::the starduster',
  'Beginnings::war vault steed':'Beginnings::tyrins steed',
  'Beginnings::workshop insinerator':'Beginnings::workshop incinerator',
};

/* Old mergeKey -> new name: a stored edit under the old key lands on the renamed card, in memory only, at every boot. */
var RENAMED_CARDS={
  'Beginnings::xylex?stouched':'Xylex’s Touched',
  /* The .mse-set's spelling, with no space: the fold kept the catalog's, so the survivor's old key is redirected too. */
  'Beginnings::xylexstouched':'Xylex’s Touched'
};
var _storedObjs=[];
/* Cards saved while ids came from the name share one; all but one get a new random id (cardIndex, sync and publish key on it).
   The newest record keeps it: that card is the one published under it, so readers' copies still match. */
function edUnfoldSharedIds(split){
  var groups={};
  (window.CARDS||[]).forEach(function(c){
    if(!c||!c.cid)return;
    (groups[c.cid]=groups[c.cid]||[]).push(c);
  });
  var fixed=[];
  Object.keys(groups).forEach(function(cid){
    var g=groups[cid]; if(g.length<2)return;
    g.sort(function(a,b){ var x=String(a.id||''), y=String(b.id||''); return x<y?-1:(x>y?1:0); });
    g.slice(0,-1).forEach(function(c){ c.cid=newCid(); fixed.push(c); });
  });
  if(!fixed.length)return 0;
  try{
    var st=tx('cards','readwrite');
    fixed.forEach(function(c){ if(c.id){ try{ st.put(stripArt(c)); }catch(_){} } });
  }catch(_){}
  console.warn('[conjure] recovered '+fixed.length+' card(s) that shared an id with another '
    +'card and had been hidden by it:',fixed.map(function(c){ return c.name; }),
    (split&&split.length)?{keptApartThisLoad:split}:'');
  window.CONJURE_RECOVERED=fixed.map(function(c){ return c.name; });
  setTimeout(function(){
    try{ toast('Recovered '+fixed.length+' card'+(fixed.length===1?'':'s')
      +' that a shared id had hidden'); }catch(_){}
  },1500);
  return fixed.length;
}
/* Copies cards that exist only in a bake into this store, once, and only adds (HANDOFF §56.1). Builds ship #jdata empty: 0 at once.
   `bakeCaptured` in meta says it ran; ghWholeSetProblem reads it before a publish. */
function edCaptureBaked(){
  if(window.REBIRTH)return Promise.resolve(0);
  if(!_origCatalog||!_origCatalog.length)return Promise.resolve(0);
  return getMeta('bakeCaptured').then(function(done){
    if(done)return 0;
    var todo=(window.CARDS||[]).filter(function(c){
      return c&&!c.__deleted&&_storedObjs.indexOf(c)<0;
    });
    var mark=function(n){
      return setMetaSafe('bakeCaptured',{at:new Date().toISOString(),n:n}).then(function(){ return n; });
    };
    if(!todo.length)return mark(0);
    return new Promise(function(res){
      var st;
      try{ st=tx('cards','readwrite'); }catch(_){ res(0); return; }
      todo.forEach(function(c){
        if(!c.id)c.id=uid();
        try{ st.put(stripArt(c)); }catch(_){}
      });
      st.transaction.oncomplete=function(){ res(mark(todo.length)); };
      st.transaction.onerror=st.transaction.onabort=function(){ res(0); };
    });
  });
}
window.edCaptureBaked=edCaptureBaked;
/* Two tabs, one store: the last to save a card wins silently, so each tab says hello on a channel named for its database. */
var _tabMates={};
function edWatchOtherTabs(){
  if(typeof BroadcastChannel!=='function')return;
  var me=uid(), ch;
  try{ ch=new BroadcastChannel('conjure-tabs:'+DB); }catch(_){ return; }
  var say=function(t){ try{ ch.postMessage({t:t,id:me}); }catch(_){} };
  var paint=function(){
    var n=Object.keys(_tabMates).length;
    edStoreNotice('tabs',n?('This app is open in '+(n===1?'another tab':n+' other tabs')+' as well. '
      +'Each tab keeps its own copy of the cards, so edits made in two tabs overwrite each other - '
      +'close the other tab before editing here.'):null);
  };
  ch.onmessage=function(ev){
    var m=ev&&ev.data; if(!m||!m.id||m.id===me)return;
    if(m.t==='bye'){ delete _tabMates[m.id]; paint(); return; }
    if(m.t==='hello')say('here');
    if(!_tabMates[m.id]){ _tabMates[m.id]=1; paint(); }
  };
  say('hello');
  addEventListener('pagehide',function(){ say('bye'); });
  /* back from the back/forward cache: the others were told this tab left */
  addEventListener('pageshow',function(ev){ if(ev&&ev.persisted)say('hello'); });
}
window.edOtherTabs=function(){ return Object.keys(_tabMates).length; };
/* Unless asked to keep it, the browser may clear this store when the disk runs low; asked once per load while it is not kept. */
var _storeInfo={persisted:null,usage:null,quota:null};
function edAskPersist(){
  var S=navigator.storage;
  if(!S)return Promise.resolve(_storeInfo);
  var p=(typeof S.persisted==='function')?S.persisted():Promise.resolve(false);
  return p.then(function(kept){
    if(kept||typeof S.persist!=='function')return kept;
    return S.persist();
  }).then(function(kept){ _storeInfo.persisted=!!kept; },function(){})
    .then(edStorageRefresh).then(function(){ return _storeInfo; });
}
function edStorageRefresh(){
  var S=navigator.storage;
  if(!S||typeof S.estimate!=='function')return Promise.resolve(_storeInfo);
  return S.estimate().then(function(e){
    _storeInfo.usage=(e&&e.usage!=null)?e.usage:null;
    _storeInfo.quota=(e&&e.quota!=null)?e.quota:null;
    return _storeInfo;
  },function(){ return _storeInfo; });
}
function edStorageText(){
  var i=_storeInfo, out='';
  if(i.usage!=null&&i.quota)out='This browser holds '+fmtBytes(i.usage)+' for this app, of '
    +fmtBytes(i.quota)+' it allows ('+Math.round(i.usage*100/i.quota)+'%).';
  if(i.persisted===true)out+=(out?' ':'')+'It has agreed to keep this data when space runs low.';
  else if(i.persisted===false)out+=(out?' ':'')+'It has not agreed to keep this data, and may clear it when space runs low.';
  return out;
}
window.edStorageInfo=function(){
  return edStorageRefresh().then(function(){ return Object.assign({text:edStorageText()},_storeInfo); });
};
/* The checks wait for this flag (CHECKS_AUDIT C1). */
function edOpened(){ window.CONJURE_OPENED=true; }
function boot(){ if(_inited)return; _inited=true;
  dbOpen().then(function(){
    try{ edWatchOtherTabs(); }catch(_){}
    try{ edAskPersist(); }catch(_){}
    return Promise.all([getAll('cards'),getAll('art'),getMeta('setInfo'),getMeta('cardsLight'),getMeta('customTemplate'),getMeta('layoutMode'),getMeta('bleedOn'),tplAll(),getMeta('edgeMode'),getMeta('alignRules'),getMeta('kwStyles'),getMeta('pillsOn'),getMeta('kwHover'),kwCustomAll(),getMeta('pinMode'),marksAll(),sagasAll(),getMeta('fitMode'),getMeta('sagaGroups'),getMeta('tplDefaults'),getMeta('alignBase'),getMeta('kwFromSources'),getMeta('cardLook')]).then(function(r){
      var cards=r[0],art=r[1],si=r[2],tpl=r[4],bleed=r[6];
      artHydrate(art);
      try{ window.edLoadAutosave(); }catch(_){}
      if(si)SETINFO=Object.assign(SETINFO,si);
      /* r[3] and r[5] are read and dropped on purpose: their controls are gone, so an old profile must not come back wearing them. */
      edLockCardLook();
      if(bleed)document.body.classList.add('bleed-on');
      TPL={}; (r[7]||[]).forEach(function(t){
        if(!t||typeof t.key!=='string')return;
        if(tplOk(t.dataUrl)){ TPL[t.key]=t.dataUrl; return; }
        tplRasterize(t.dataUrl).then(function(png){
          if(png&&!TPL[t.key]){ TPL[t.key]=png; try{ scheduleFace(); }catch(_){} }
        });
      });
      /* r[14], the pinline mode of before session 91, is no longer read: the pinlines are each frame's own (ed2_frames.js) */
      edApplyEdge(r[8]||'gradient');
      /* Older stores have only r[17] (one fitMode, for both) or neither, which takes contain on purpose: cover cropped 23% off a card. */
      if(r[19])edApplyTplDefaults(r[19]);
      else edApplyTplDefaults({h:{fit:r[17]||'contain'},v:{fit:r[17]||'contain'}});
      MARKS=r[15]||[];
      /* The look's frame, stat icon set and card back (ed2_frames.js): the saved row, else the published default, else the back the old Play Test list kept. */
      try{ window.edBootLook(r[22],LOOK_BAKED&&LOOK_BAKED.cardLook); }catch(_){}
      try{ window.edFrameBoot(); }catch(_){}
      /* The baked look seeds only what was never set: stored kwStyles win outright. */
      if((r[10]==null || !Object.keys(r[10]||{}).length) && LOOK_BAKED
         && LOOK_BAKED.kwStyles && typeof LOOK_BAKED.kwStyles==='object'){
        KWSTYLE=kwStylesClean(JSON.parse(JSON.stringify(LOOK_BAKED.kwStyles)));
        /* Saved, so a later build cannot move it under them. */
        setMetaSafe('kwStyles',KWSTYLE);
      }
      if(r[10]&&typeof r[10]==='object'&&Object.keys(r[10]).length){
        KWSTYLE=kwStylesClean(r[10]);
        Object.keys(KWSTYLE).forEach(function(k){var v=KWSTYLE[k];
          if(v&&v.hl===undefined)v.hl='none';
          if(v&&v.w===undefined)v.w=1.5;});
      }
      if(!KW_BAKED)KW_BAKED=(window.KW_DATA||[]).slice();
      KWCUSTOM=r[13]||[];
      if(!KWCUSTOM.length && LOOK_BAKED && Array.isArray(LOOK_BAKED.kwCustom)
         && LOOK_BAKED.kwCustom.length){
        /* The baked entries come too: in Rebirth every keyword is custom, so formats alone would have no keywords to wear them. */
        KWCUSTOM=JSON.parse(JSON.stringify(LOOK_BAKED.kwCustom));
        Promise.all(KWCUSTOM.map(function(x){ return put('kwcustom',x); }))
          .catch(function(){});
      }
      if(Array.isArray(r[21]))KW_EXTRA=r[21];
      edApplyCustomEntries();
      if(r[11]!=null)PILLS_ON=!!r[11];
      else if(LOOK_BAKED&&LOOK_BAKED.pillsOn!=null){
        PILLS_ON=!!LOOK_BAKED.pillsOn; setMetaSafe('pillsOn',PILLS_ON);
      }
      if(r[12]!=null)KW_HOVER=!!r[12];
      ALIGN_RULES=alignLoad(r[9]);
      ALIGN_BASE=alignBaseLoad(r[20]);
      SAGAS=r[16]||[];
      /* Absent in stores from before saga groups, and absent must mean everything on (groupEnabled fails open too). */
      SAGA_GROUPS=(r[18]&&typeof r[18]==='object')?r[18]:{};
      normalizeBuiltins();
      /* Never call normalizeEssenceText() here: it clears rule text, and nothing destructive runs on load (HANDOFF §0). */
      /* A deep snapshot, not the same objects: the editor edits window.CARDS in place, and Restore must not bring the edits back (HANDOFF §54.1). */
      if(_origCatalog===null)_origCatalog=JSON.parse(JSON.stringify(window.CARDS||[]));
      if(cards&&cards.length){
        /* The id pass runs before the merge and touches nothing else in a record (cidStampStored, ed2_sagas.js). */
        try{ cidStampStored(cards); }catch(_){}
        /* Merge, never replace: a record overlays the card with its cid, else its saga + name; one matching nothing is a card of its own.
           Never copy ART[c.art] into c.imageUrl: object URLs die with the session and persistCard() would save a dead link. */
        var base=_origCatalog.map(function(c){return JSON.parse(JSON.stringify(c));});
        /* Saga + name, not name alone: two sagas may each hold a card of the same name. */
        var idx={}, byCid={};
        /* Only cards that already have an id: cardCid would mint one. */
        base.forEach(function(c,i){ idx[mergeKey(c)]=i; if(c.cid)byCid[c.cid]=i; });
        _storedObjs=[];
        var fromRec=[];
        var drop={}, folded=[], renamed=[], split=[], spared=[];
        cards.forEach(function(sc){
          if(!sc.__id)sc.__id=uid();
          var k=mergeKey(sc);
          var i=(sc.cid&&byCid[sc.cid]!=null)?byCid[sc.cid]:idx[k];
          if(i==null && RENAMED_CARDS[k]){
            renamed.push(sc.name+' -> '+RENAMED_CARDS[k]);
            sc.name=RENAMED_CARDS[k]; k=mergeKey(sc); i=idx[k];
          }
          /* One stored record is one card (HANDOFF §57.3): a live record never folds into a card another record supplied, and a
             deletion marker hides such a card only if it is that same record. Losing a card is worse than showing one twice. */
          var other=(i!=null && fromRec[i]!==undefined && fromRec[i]!==sc.id);
          if(sc.__deleted){
            if(i!=null && !other)drop[i]=1;
            else if(other)spared.push(sc.name);
            return;
          }
          if(other){ split.push(sc.name); i=null; }
          if(i==null && MERGED_ALT_ART[k]){ folded.push(sc.name+' -> '+MERGED_ALT_ART[k]); return; }
          if(i==null){
            base.push(sc); var j=base.length-1; fromRec[j]=sc.id;
            if(idx[k]==null)idx[k]=j;
            if(sc.cid && byCid[sc.cid]==null)byCid[sc.cid]=j;
            _storedObjs.push(sc);
          }
          else { base[i]=Object.assign(base[i],sc); fromRec[i]=sc.id; _storedObjs.push(base[i]); }
        });
        if(spared.length)console.info('[conjure] '+spared.length+' deletion marker(s) matched a '
          +'DIFFERENT saved card and no longer hide it:',spared);
        if(folded.length){
          console.warn('[conjure] '+folded.length+' saved edit(s) belong to cards that are '
            +'now alternate art on another card. They were NOT re-added and NOT deleted - '
            +'they are still in IndexedDB:', folded);
          window.CONJURE_FOLDED_EDITS=folded;
        }
        if(renamed.length){
          console.info('[conjure] '+renamed.length+' saved edit(s) followed a renamed card:',renamed);
          window.CONJURE_RENAMED_EDITS=renamed;
        }
        window.CARDS=base.filter(function(_,i){return !drop[i];});
        try{ edUnfoldSharedIds(split); }catch(err){ console.error('[conjure] id recovery failed',err); }
        bumpCardGen();
        try{ if(typeof window.run==='function')window.run(); }catch(_){}
        edRefreshDeckSide();
      }
      ensureIds();
      try{ edCaptureBaked(); }catch(_){}
      ensureSagaRecords();
      watchCatalog();
      renderFields();
      /* The checks wait for this flag and CONJURE_OPENED (CHECKS_AUDIT C1). */
      window.CONJURE_BOOTED=true;
      /* The check on open runs at load on purpose, against "nothing happens at load" (ed2_sagas.js); ghAutoApply decides what applies by itself. */
      ghLoadSettings().then(function(){
        var run;
        try{ run=ghAutoCheck(); }catch(_){}
        try{ ghEmptyRefresh(); }catch(_){}
        Promise.resolve(run).then(edOpened,function(e){ edOpened(); throw e; });
      }).catch(function(){ edOpened(); });
    });
  }).catch(function(err){ console.error('editor boot failed',err); });
}
function toast(m){ var t=document.getElementById('edToast'); if(!t){t=document.createElement('div');t.id='edToast';t.className='ed-toast';document.body.appendChild(t);}
  t.textContent=m; t.classList.add('show'); clearTimeout(t._tm); t._tm=setTimeout(function(){t.classList.remove('show');},2200); }

/* The catalog's script reaches toast only through window; its calls test typeof toast, so without this they all do nothing. */
window.toast=toast;
window.edInit=boot;
try{ edWrapHelp(); }catch(_){}
/* Not DOMContentLoaded, on purpose: everything boot() touches is parsed by now, and the event comes far later (HANDOFF §23.5). */
if(document.readyState==='loading')boot();
else setTimeout(boot,400);

})();
</script>
