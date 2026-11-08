/* Part of the editor IIFE: what the markup calls must be put on window (HANDOFF §4). */

window.curIdNow=function(){return curId;};
/* Always a saga you can edit: a card in none was filed under Beginnings, an official saga, and reached the published set that way.
   Its Distributor and Artist are the newest card's in that saga, so another creator's cards are not credited to the author's company. */
function edOwnSagaId(id){
  var sg=id?sagaById(id):null;
  return !!sg&&ownsGroupKey(groupKeyOf(sg));
}
function edNewCardSaga(make){
  var sel=''; try{ sel=_fsagaValue(); }catch(_){}
  if(edOwnSagaId(sel))return sel;
  if(edOwnSagaId(LAST_NEW_SAGA))return LAST_NEW_SAGA;
  if(SETINFO.saga){
    var hit=SAGAS.filter(function(s){ return s.id===SETINFO.saga||normName(s.name||'')===normName(SETINFO.saga); })[0];
    if(hit&&edOwnSagaId(hit.id))return hit.id;
  }
  var mine=(SAGAS||[]).filter(function(s){ return s&&ownsGroupKey(groupKeyOf(s)); })
    .sort(function(a,b){ return String(a.name||a.id).localeCompare(String(b.name||b.id)); });
  if(mine.length)return mine[0].id;
  /* asked, not making a card: nothing is written */
  return make ? edMyCardsSaga() : 'My Cards';
}
/* Named My Cards with an id of its own: every copy makes one, and with one shared id two players' would be one saga to Sync Cards with Host. */
function edMyCardsSaga(){
  var have=(SAGAS||[]).filter(function(s){
    return s&&s.name==='My Cards'&&groupKeyOf(s)===GROUP_LOCAL; })[0];
  if(have)return have.id;
  var id='my-cards-'+Date.now().toString(36).slice(-5)+Math.floor(Math.random()*1296).toString(36);
  var rec={id:id,name:'My Cards',author:'',version:'1.0',description:'',builtin:false,enabled:true,
           mode:(window.REBIRTH?'rebirth':'main'),look:null,source:{url:'',lastSync:null},
           created:new Date().toISOString(),updated:new Date().toISOString()};
  SAGAS.push(rec);
  try{ sagaPut(rec); }catch(_){}
  return id;
}
function edNewCardCredits(sid){
  var list=(window.CARDS||[]).filter(function(x){ return x&&!x.__deleted&&inSaga(x,sid); });
  var last=list.length?cardForSaga(list[list.length-1],sid):null;
  return {designer:(last&&last.designer)||SETINFO.designer||'',
          artist:(last&&last.artist)||SETINFO.artist||''};
}
function edRememberNewSaga(sid){ LAST_NEW_SAGA=sid; setMetaSafe('lastNewSaga',sid); }
window.edNewCardSaga=function(){ return edNewCardSaga(false); };
window.edNewCard=function(){
  ensureIds();
  var sid=edNewCardSaga(true), sg=sagaById(sid), cr=edNewCardCredits(sid);
  var c={__id:uid(),id:uid(),name:'New Card',manaCost:'',cmc:0,colors:[],
    superTypes:['Character'],subTypes:[],attack:'',health:'',arcane:'',
    ruleText:'',flavor:'',saga:(sg&&sg.name)||sid,sagaId:sid,sagaIds:[sid],
    revision:SETINFO.revision||'',
    artist:cr.artist,designer:cr.designer,imageUrl:'',art:'',
    local:1,
    cid:newCid()};
  // keep names unique: the catalogue's ✎ and faces find a card by its name (edCardByName)
  var names={}; (window.CARDS||[]).forEach(function(x){names[normName(x.name)]=1;});
  var i=2,base=c.name; while(names[normName(c.name)]){ c.name=base+' '+(i++); }
  window.CARDS.push(c);
  edRememberNewSaga(sid);
  return persistCard(c).then(function(){ return ensureSagaRecords(); }).then(function(){
    applyToCatalog(); try{ refreshSagaFilter(); }catch(_){}
    toast('Card created');
    window.edEditCard(c.__id);
  });
};
/* The copy is the version you were looking at (that saga's art, flavour, credits, reminders and border), made here with an id of its own. */
window.edDuplicateFromCard=function(card){
  if(!card)return Promise.resolve(null);
  ensureIds();
  var view=card;
  try{
    var ds=(typeof window.edSagaOf==='function')?window.edSagaOf(card):null;
    if(ds)view=cardForSaga(card,ds)||card;
  }catch(_){}
  var copy=JSON.parse(JSON.stringify(view));
  var sid=edNewCardSaga(true), sg=sagaById(sid);
  copy.__id=uid(); copy.id=uid(); copy.cid=newCid(); copy.local=1;
  delete copy.sagaFields; delete copy.testing; delete copy.orphan; delete copy.__deleted;
  copy.sagaIds=[sid]; copy.sagaId=sid; copy.saga=(sg&&sg.name)||sid;
  var names={}; (window.CARDS||[]).forEach(function(x){ if(x)names[normName(x.name||'')]=1; });
  var base=(card.name||'Card')+' (copy)', nm=base, i=2;
  while(names[normName(nm)]){ nm=base+' '+(i++); }
  copy.name=nm;
  window.CARDS.push(copy);
  edRememberNewSaga(sid);
  return persistCard(copy).then(function(){ return ensureSagaRecords(); }).then(function(){
    applyToCatalog(); try{ refreshSagaFilter(); }catch(_){}
    toast('Duplicated into '+((sg&&sg.name)||sid));
    window.edEditCard(copy.__id);
    return copy;
  });
};
/* The saga of yours an official card would join, picked as a new card's saga is; never one it is in, and none when you have no saga of your own. */
function edMySagaFor(card){
  if(!card||cardForeignKey(card)!==GROUP_OFFICIAL)return '';
  var sid=edNewCardSaga(false);
  if(edOwnSagaId(sid)&&!inSaga(card,sid))return sid;
  var mine=(SAGAS||[]).filter(function(s){ return s&&ownsGroupKey(groupKeyOf(s))&&!inSaga(card,s.id); })
    .sort(function(a,b){ return String(a.name||a.id).localeCompare(String(b.name||b.id)); });
  return mine.length?mine[0].id:'';
}
window.edMySagaFor=function(card){ var id=edMySagaFor(card); return id?{id:id,name:(sagaById(id)||{}).name||id}:null; };
/* Not a copy (Duplicate is): the official card itself joins the saga, and keeps following the official set. Marked as a change made here
   (_editedSagas) until it is published, so it is never taken back out unasked (srcGoneCards). */
window.edAddToMySaga=function(card){
  var sid=edMySagaFor(card);
  if(!sid||!addSagaMembership(card,sid))return Promise.resolve(false);
  var sg=sagaById(sid);
  (card._editedSagas=card._editedSagas||{})[sid]=1;
  markDirty(card);
  return persistCard(card).then(function(){ return ensureSagaRecords(); }).then(function(){
    edRememberNewSaga(sid);
    applyToCatalog(); try{ refreshSagaFilter(); }catch(_){}
    try{ window.edRenderSagaPage(); }catch(_){}
    toast('"'+card.name+'" is in '+((sg&&sg.name)||sid)+' - it keeps following the official card');
    window.edEditCard(card.__id);
    return true;
  });
};
window.edDeleteCard=function(id){
  var c=(window.CARDS||[]).find(function(x){return x.__id===id;});
  if(!c)return;
  if(typeof edCardLocked==='function'&&edCardLocked(c)){ edLockedToast(c); return; }
  if(!confirm('Delete "'+c.name+'"? It will be removed from the catalog.'))return;
  /* A tombstone, or the boot merge brings the card back: it carries cid and saga + name, which the merge matches by; without the saga it is filed under Beginnings. */
  var tomb={id:c.id||uid(),__id:c.__id,name:c.name,cid:cardCid(c),
            sagaId:sagaIdOf(c),saga:c.saga,__deleted:true};
  window.CARDS=(window.CARDS||[]).filter(function(x){return x.__id!==id;});
  curId=null;
  persistCard(tomb).then(function(){ applyToCatalog(); renderFields(); toast('Card deleted'); });
};
/* Clears the whole cards store, so the strongest gate: a typed phrase and proof of a backup (HANDOFF §0). */
window.edRestoreCatalog=function(){
  if(!window.REBIRTH && !(_origCatalog||[]).length) return edResetToOfficial();
  var cur=(window.CARDS||[]), built=(_origCatalog||[]);
  var builtKeys={}; built.forEach(function(c){ builtKeys[mergeKey(c)]=1; });
  var imported=cur.filter(function(c){return !builtKeys[mergeKey(c)];}).length;
  var missing=built.length-(cur.length-imported);
  edDangerGate({
    title:'Restore built-in catalog',
    lose:['Every saved edit across '+cur.length+' cards',
          imported+' card(s) that exist only here, not in the built-in set',
          (missing>0?missing+' deletion(s) undone - those built-ins come back':
                     'Every deletion you have made')],
    phrase:'RESTORE',
    requireBackup:true,
    proceedLabel:'Restore '+built.length+' built-in cards'
  }).then(function(ok){
    if(!ok){ toast('Cancelled - nothing was changed'); return; }
    var st=tx('cards','readwrite').clear();
    st.onsuccess=function(){
      window.CARDS=built.map(function(c){return JSON.parse(JSON.stringify(c));});
      ensureIds(); curId=null; applyToCatalog(); renderFields();
      toast('Built-in catalog restored ('+window.CARDS.length+' cards)');
    };
    /* Every clear() here says when it fails: a wipe that fails after the phrase was typed must not look as if it worked (HANDOFF §6). */
    st.onerror=function(){
      alert('Restore failed: the card store could not be cleared, so nothing was changed.'
        +(st.error&&st.error.message?' ('+st.error.message+')':''));
    };
  });
};
/* The official set is fetched before anything is cleared, so a reset pressed offline stops with the store untouched. */
function edResetToOfficial(){
  var cur=(window.CARDS||[]);
  return edDangerGate({
    title:'Reset to the official set',
    lose:['Every saved edit across '+cur.length+' cards',
          'Every card that exists only here, not in the official set',
          'Every deletion you have made'],
    phrase:'RESET',
    requireBackup:true,
    proceedLabel:'Reset to the official set'
  }).then(function(ok){
    if(!ok){ toast('Cancelled - nothing was changed'); return; }
    toast('Fetching the official set…');
    if(normGroupUrl(GH_SOURCE)!==normGroupUrl(GH_DEFAULT_SOURCE)){
      alert('Reset stopped: this copy follows another source, not the official set. Nothing was changed.');
      return;
    }
    return Promise.resolve(window.edGhCheck()).then(function(){
      var st=_ghState;
      if(!st||!st.pkg||!(st.pkg.cards||[]).length){
        alert('Reset stopped: the official set could not be fetched, so nothing was changed.'
          +(st&&st.err?' ('+st.err+')':''));
        return;
      }
      return new Promise(function(res){
        var q=tx('cards','readwrite').clear();
        q.onsuccess=function(){
          window.CARDS=[]; curId=null;
          /* Diffed again against the empty catalogue: the check's diff was against the cards just cleared, and would import nothing. */
          st.diff=ghDiff(ghIncoming(st.pkg.cards,srcOfficial()),st.ctx);
          res(ghApplyUpdate(false).then(function(){
            renderFields();
            toast('Reset to the official set ('+(window.CARDS||[]).length+' cards)');
          }));
        };
        q.onerror=function(){
          alert('Reset failed: the card store could not be cleared, so nothing was changed.'
            +(q.error&&q.error.message?' ('+q.error.message+')':''));
          res();
        };
      });
    });
  });
}
window.edResetToOfficial=edResetToOfficial;

window.edTplPanelRefresh=function(){
  var host=document.getElementById('edTplBody'); if(!host)return;
  var bleed=document.body.classList.contains('bleed-on');
  /* Defaults only, one set per frame orientation: a card that set its own fit or framing is untouched, which effectiveFit and effectiveArtXf enforce. */
  function xfCtrl(orient,k){
    var L=TPL_XF_LIMITS[k], v=tplDefaults(orient).xf[k];
    return "<div class='ed2-xf'><label for='tplXf-"+orient+"-"+k+"'>"+ART_XF_LABEL[k]+"</label>"
      +"<input type='range' id='tplXf-"+orient+"-"+k+"' min='"+L.min+"' max='"+L.max
        +"' step='"+L.step+"' value='"+v+"' "
        +"oninput=\"edSetTplXf('"+orient+"','"+k+"',this.value)\">"
      +"<input type='number' id='tplXfN-"+orient+"-"+k+"' aria-label='"+ART_XF_LABEL[k]+" value' min='"+L.min+"' max='"+L.max
        +"' step='"+L.step+"' value='"+v+"' "
        +"oninput=\"edSetTplXf('"+orient+"','"+k+"',this.value)\"></div>";
  }
  function defaultsBlock(orient,title,hint){
    var d=tplDefaults(orient);
    return "<div class='tpl-defset'><h5>"+title+"</h5>"
      +"<i class='tpl-hint'>"+hint+"</i>"
      +"<div class='tpl-opts'><span class='tpl-lbl'>Art fit</span>"
      +FIT_MODES.map(function(m){
          return "<button class='ed2-btn tiny"+(d.fit===m?' on':'')+"' "
            +"onclick=\"edSetFit('"+orient+"','"+m+"')\">"
            +m.charAt(0).toUpperCase()+m.slice(1)+"</button>";}).join('')
      +"</div>"
      +"<div class='ed2-xf-row'>"+xfCtrl(orient,'x')+xfCtrl(orient,'y')+"</div>"
      +"<div class='ed2-xf-row'>"+xfCtrl(orient,'z')+xfCtrl(orient,'r')+"</div>"
      +"<div class='tpl-opts'>"
        +"<button class='ed2-btn tiny"+(d.xf.f===-1?' on':'')+"' "
          +"title='Mirror the art left-to-right' onclick=\"edFlipTplXf('"+orient+"')\">Flip</button>"
        +"<button class='ed2-btn tiny' onclick=\"edResetTplXf('"+orient+"')\">Reset framing</button>"
      +"</div></div>";
  }
  var h='';
  h+="<div class='tpl-sec'><h4>Display</h4>"
    /* the Outline row (On or Off, edSetEdge) sits on the Templates page since session 92 (tppEdgeRow, ed2_frames.js) */
    +"<div class='tpl-opts'>"
    +"<span class='tpl-lbl'>Print bleed</span>"
    +"<button class='ed2-btn tiny"+(bleed?' on':'')+"' onclick='edSetBleed("+(!bleed)+")'>"
    +(bleed?'On \u2014 0.12\" bleed rendered':'Off \u2014 trimmed to 2.5\u00d73.5\"')+"</button>"
    +"<i class='tpl-hint'>Leave off for screen and normal image export; turn on only for print/PDF.</i>"
    +"</div></div>";

  h+="<div class='tpl-sec'><h4>Art Defaults</h4>"
    +"<i class='tpl-hint'><b>These only reach cards set to Auto.</b> A card whose "
    +"Art fit is anything but Auto, or that has been framed by hand in its art "
    +"panel, keeps exactly what it was given and is not touched by anything on "
    +"this page. Contain shows the whole illustration, letterboxed; Cover fills "
    +"the frame and crops what does not fit; Fill stretches.</i>"
    +defaultsBlock('h','Horizontal Art Cards',
        'Cards on the standard frame, art above the rules box.')
    +defaultsBlock('v','Vertical Art Cards',
        'Cards on the vertical frame, art beside the rules box — a taller, '
        +'narrower art box, which usually wants its own fit and zoom.')
    +"</div>";

  h+="<div class='tpl-sec'><h4>Card Frames</h4>"
    +"<i class='tpl-hint'>Canvas is 1644\u00d72244 (a 1500\u00d72100 card plus 0.12\" bleed). "
    +"\u201cAll cards\u201d is used unless a more specific slot is filled.</i>"
    +tplSlotHTML('frame:all','All cards','fallback for every card')
    +tplSlotHTML('frame:none','Colourless','')
    +tplSlotHTML('frame:multi','Multi-colour','')
    +FRAME_ORDER.map(function(c){return tplSlotHTML('frame:'+c,c.charAt(0).toUpperCase()+c.slice(1),'');}).join('')
    +"</div>";

  h+="<div class='tpl-sec'><h4>Orb Icons</h4>"
    +"<i class='tpl-hint'>Replaces the built-in SVG orbs. The stat value is drawn over the image.</i>"
    +TPL_ORBS.map(function(t){return tplSlotHTML('orb:'+t,t.charAt(0).toUpperCase()+t.slice(1),'');}).join('')
    +"</div>";

  var syms=Object.keys(TPL).filter(function(k){return k.indexOf('sym:')===0;});
  h+="<div class='tpl-sec'><h4>Mana &amp; Rule Symbols</h4>"
    +"<i class='tpl-hint'>Keyed by the token as it appears in text, e.g. {V} \u2192 token V.</i>"
    +"<div class='tpl-opts'><span class='tpl-lbl'>Add token</span>"
    +"<input id='edSymTok' class='ed2-in tiny' placeholder='V' maxlength='8'>"
    +"<label class='ed2-btn tiny'>Upload<input type='file' accept='image/*' hidden onchange='edTplAddSymbol(this)'></label></div>"
    +syms.map(function(k){return tplSlotHTML(k,'{'+k.slice(4)+'}','');}).join('')
    +"</div>";

  h+="<div class='tpl-sec'><h4>Saved Templates</h4>"
    +"<i class='tpl-hint'>A saved template captures every uploaded asset plus edge, "
    +"pinlines, bleed, alignment and both art-default sets. Switching replaces the "
    +"current assets.</i>"
    +"<div class='tpl-opts'><button class='ed2-btn tiny' onclick='edPackSave()'>Save current as\u2026</button></div>"
    +(PACKS.length?PACKS.map(function(pk){
        var n=Object.keys(pk.slots||{}).length;
        var sl=pk.slots||{}, th=sl['frame:all']||sl[Object.keys(sl)[0]];
        return "<div class='tpl-slot'><div class='tpl-thumb'>"
          +(tplOk(th)?"<img src='"+e(th)+"' alt=''>":"<span>empty</span>")
          +"</div><div class='tpl-meta'><b>"+e(pk.name)+"</b><i>"+n+" asset"+(n===1?'':'s')
          +" \u00b7 "+e(pk.edgeMode||'gradient')+" edge</i></div>"
          +"<div class='tpl-acts'><button class='ed2-btn tiny' data-pack-apply='"+e(pk.name)+"'>Apply</button>"
          +"<button class='ed2-btn tiny warn' data-pack-del='"+e(pk.name)+"'>Delete</button></div></div>";
      }).join(''):"<i class='tpl-hint'>No saved templates yet.</i>")
    +"</div>";

  var alignBtns=function(r,axis,list){
    var cur=r[axis]||'default';
    var eff=alignResolve(r)[axis];
    var at=" data-align-key='"+e(r.key)+"' data-align-kind='"+e(r.kind)+"' data-align-axis='"+axis+"'";
    return "<button class='ed2-btn tiny"+(cur==='default'?' on':'')
      +"' title='Follow the Default above — currently "+e(eff)+"'"
      +at+" data-align-val='default'>"
      +"Default</button>"
      +list.map(function(x){
        return "<button class='ed2-btn tiny"+(cur===x?' on':'')+"'"
          +at+" data-align-val='"+x+"'>"
          +x+"</button>";
      }).join('');
  };
  var alignRow=function(r,removable){
    return "<div class='tpl-opts tpl-align'>"
      +"<span class='tpl-lbl'>"+e(r.key.charAt(0).toUpperCase()+r.key.slice(1))+"</span>"
      +alignBtns(r,'h',ALIGN_H)
      +"<span class='tpl-lbl tpl-lbl-gap'></span>"
      +alignBtns(r,'v',ALIGN_V)
      +(removable
          ? "<button class='ed2-btn nb nb-red nb-s tpl-rm' title='Remove this row'"
            +" aria-label='Remove the "+e(r.key)+" row'"
            +" data-align-del='"+e(r.key)+"' data-align-kind='"+e(r.kind)+"'>Delete &#10005;</button>"
          : '')
    +"</div>";
  };
  alignSeedFromCatalog();
  var supRows=ALIGN_RULES.filter(function(r){return r.kind!=='sub';});
  var subRows=ALIGN_RULES.filter(function(r){return r.kind==='sub';});
  var builtin=function(k){ return ALIGN_DEFAULTS.filter(function(d){return d.key===k;}).length>0; };
  var freeSup=alignCatalogTypes('super').filter(function(t){ return !alignRuleFor('super',t); });
  var freeSub=alignCatalogTypes('sub').filter(function(t){ return !alignRuleFor('sub',t); });
  var pickHTML=function(id,list,ph,name){
    return "<select class='ed2-in tpl-pick' id='"+id+"' aria-label='"+e(name)+"'>"
      +"<option value=''>"+e(ph)+"</option>"
      +list.map(function(t){return "<option value='"+e(t)+"'>"+e(t)+"</option>";}).join('')
      +"</select>";
  };

  h+="<div class='tpl-sec'><h4>Rules Text Alignment</h4>"
    +"<div class='tpl-opts tpl-align tpl-align-base'>"
      +"<span class='tpl-lbl'>Default</span>"
      +ALIGN_H.map(function(x){return "<button class='ed2-btn tiny"+(ALIGN_BASE.h===x?' on':'')
        +"' onclick=\"edSetAlignBase('h','"+x+"')\">"+x+"</button>";}).join('')
      +"<span class='tpl-lbl tpl-lbl-gap'></span>"
      +ALIGN_V.map(function(x){return "<button class='ed2-btn tiny"+(ALIGN_BASE.v===x?' on':'')
        +"' onclick=\"edSetAlignBase('v','"+x+"')\">"+x+"</button>";}).join('')
    +"</div>"
    +"<i class='tpl-hint'>Everything set to <b>Default</b> follows the row above, "
    +"and moves with it. A new type starts on Default, so it needs no decision "
    +"until you want one.</i>"

    +"<h5 class='tpl-sub'>Super-Types</h5>"
    +"<i class='tpl-hint'>The first matching row wins. “Action” also "
    +"matches Spell.</i>"
    +supRows.map(function(r){
        /* a built-in row, or one the catalogue supplies, would be back on the next open, so neither can be deleted */
        return alignRow(r,!builtin(r.key)&&!alignFromCatalog('super',r.key));
      }).join('')
    +"<div class='tpl-opts'><span class='tpl-lbl'>Add</span>"
      +pickHTML('edAlignSupPick',freeSup,freeSup.length?'Pick a super type…':'every type has a row','Add a super type row')
      +"<input id='edAlignSupNew' class='ed2-in tiny tpl-align-new' placeholder='or type a new one' aria-label='New super type' maxlength='40'>"
      +"<button class='ed2-btn tiny' onclick='edAddAlignFrom(\"super\")'>Add</button></div>"

    +"<h5 class='tpl-sub'>Sub-Types</h5>"
    +"<i class='tpl-hint'>A card carrying one of these follows it instead of its "
    +"super-type. With two, the one the card lists <b>first</b> wins — drag "
    +"the type line on the card to change which.</i>"
    +(subRows.length?subRows.map(function(r){ return alignRow(r,true); }).join('')
        :"<i class='tpl-hint'>No sub-type rows. Every card follows its super-type.</i>")
    +"<div class='tpl-opts'><span class='tpl-lbl'>Add</span>"
      +pickHTML('edAlignSubPick',freeSub,freeSub.length?'Pick a sub-type…':'every sub-type has a row','Add a sub-type row')
      +"<input id='edAlignSubNew' class='ed2-in tiny tpl-align-new' placeholder='or type a new one' aria-label='New sub-type' maxlength='40'>"
      +"<button class='ed2-btn tiny' onclick='edAddAlignFrom(\"sub\")'>Add</button></div>"

    +"<div class='tpl-opts'><button class='ed2-btn tiny warn' onclick='edResetAlign()'>Reset to defaults</button></div>"
    +"</div>";

  h+="<div class='tpl-sec'><h4>Pack</h4><div class='tpl-opts'>"
    +"<button class='ed2-btn tiny' onclick='edTplExport()'>Export pack (.zip)</button>"
    +"<label class='ed2-btn tiny'>Import pack<input type='file' accept='.zip,application/zip' hidden onchange='edTplImport(this)'></label>"
    +"<button class='ed2-btn tiny warn' onclick='edTplClearAll()'>Clear all</button>"
    +"</div></div>";
  host.innerHTML=h;
  edTplPanelBind(host);
};
/* One listener per page for every control whose meaning is data (a slot's key, a template's name, a row's type): each is read off its element, never part of a handler's code (HANDOFF §12.1). */
function edTplPanelBind(host){
  if(!host||host._tplBound)return;
  host._tplBound=true;
  host.addEventListener('click',function(ev){
    var b=ev.target&&ev.target.closest?ev.target.closest('[data-pack-apply],[data-pack-del],[data-align-val],[data-align-del],[data-tplrm]'):null;
    if(!b||!host.contains(b))return;
    if(b.hasAttribute('data-pack-apply'))return window.edPackApply(b.getAttribute('data-pack-apply'));
    if(b.hasAttribute('data-pack-del'))return window.edPackDelete(b.getAttribute('data-pack-del'));
    if(b.hasAttribute('data-tplrm'))return window.edTplRemove(b.getAttribute('data-tplrm'));
    if(b.hasAttribute('data-align-del'))
      return window.edDelAlignRow(b.getAttribute('data-align-kind'),b.getAttribute('data-align-del'));
    window.edSetAlign(b.getAttribute('data-align-key'),b.getAttribute('data-align-axis'),
                      b.getAttribute('data-align-val'),b.getAttribute('data-align-kind'));
  });
  host.addEventListener('change',function(ev){
    var t=ev.target;
    if(t&&t.hasAttribute&&t.hasAttribute('data-tplup'))window.edTplUpload(t.getAttribute('data-tplup'),t);
  });
}

window.edAddAlignFrom=function(kind){
  var k=(kind==='sub')?'Sub':'Sup';
  var pick=document.getElementById('edAlign'+k+'Pick');
  var typed=document.getElementById('edAlign'+k+'New');
  var v=(typed&&typed.value.trim())||(pick&&pick.value)||'';
  if(!v){ alert('Pick a type or type one in first.'); return; }
  if(!window.edAddAlignRow(kind,v)) alert('“'+v+'” already has a row.');
};

window.edTplAddSymbol=function(input){
  var t=(document.getElementById('edSymTok')||{}).value||'';
  t=t.trim().replace(/[{}]/g,'');
  if(!t){alert('Enter the token first, e.g. V for {V}.');input.value='';return;}
  window.edTplUpload('sym:'+t,input);
};

/* No entry name goes into an inline handler: the parser turns e()'s &#39; back into ' before the JS reads it, and the string closes early (HANDOFF §12.1). */
var KW_SECTIONS=[['keyword','Keywords'],['keyterm','Keyterms'],
                 ['counter','Counters'],['dice','Dice']];
var KW_SHAPES=[['pill','Pill'],['box','Box'],['point','Pointed ▶'],
               ['lpoint','Left point ◀'],['dpoint','Double point'],['slant','Slanted']];
var _kwPageOpen=null;
function kwSections(){
  return window.REBIRTH ? KW_SECTIONS.concat([['damage','Damage Type']]) : KW_SECTIONS;
}

function kwPageKey(k){ return (k.mode||'keyword')+'|'+k.name; }
function kwPageList(mode){
  var list=(window.KW_DATA||[]).filter(function(k){
    return (k.mode||'keyword')===mode && !k.__alias;
  });
  if(mode==='damage')return dmgPageOrder(window.edDmgEntries());
  return list.sort(function(a,b){ return String(a.name).localeCompare(String(b.name)); });
}
function dmgPageOrder(list){
  var cls=list.filter(function(k){ return k.dmgKind==='class'; });
  var at={}; cls.forEach(function(c,i){ at[c.name]=i; });
  var first=function(k){
    var best=1e9; (k.dmgClass||[]).forEach(function(n){ if(n in at&&at[n]<best)best=at[n]; });
    return best;
  };
  var types=list.filter(function(k){ return k.dmgKind!=='class'; })
    .map(function(k,i){ return {k:k,i:i,f:first(k)}; })
    .sort(function(a,b){ return (a.f-b.f)||(a.i-b.i); }).map(function(x){ return x.k; });
  return cls.concat(types);
}
function dmgSummary(k){
  var ab=String(k.matchAlt||'').split(/[\n,]/)[0].trim();
  var names=window.edDmgClasses().map(function(c){ return c.name; });
  var rest=(k.dmgKind==='class')
    ? window.edDmgMembers(k.name).map(function(t){ return t.name; })
    : (k.dmgClass||[]).filter(function(n){ return names.indexOf(n)>=0; });
  return (ab?ab+' \u00b7 ':'')+(k.dmgKind==='class'?'Damage Class: ':'')
    +(rest.length?rest.join(', '):(k.dmgKind==='class'?'no types yet':'no class'));
}
function kwPageCustom(k){
  return (KWCUSTOM||[]).filter(function(c){
    return c.name===k.name && (c.mode||'keyword')===(k.mode||'keyword');
  })[0]||null;
}
function kwPageCtlHTML(n,actsHTML){
  var s=kwStyleFor(n);
  var col=function(f,lbl){
    return "<label class='kwp-col'><span>"+lbl+"</span>"
      +"<input type='color' data-kwf='"+f+"' value='"+s[f]+"'>"
      +"<input type='text' class='kwp-hex' data-kwhex='"+f+"' aria-label='"+lbl+" colour code' value='"+s[f]
        +"' maxlength='7' spellcheck='false'></label>";
  };
  var cols="<div class='kwp-cstack'>"+(actsHTML||'')+col('t','Font')+"</div>"
    +"<div class='kwp-cstack'>"+col('o','Outline')+col('oh','Outline Glow')+"</div>"
    +"<div class='kwp-cstack'>"+col('f','Fill')+col('fh','Fill Glow')+"</div>";
  var hls=KW_HLSETS?Object.keys(KW_HLSETS):['none'];
  return "<div class='kwp-ctl'>"
    +cols
    +"<div class='kwp-nums'>"
      +"<label class='kwp-num'><span>Width</span>"
        +"<input type='number' class='ed2-in tiny' data-kwf='w' min='0' max='6' step='.5' value='"+(+s.w||1.5)+"'></label>"
      +"<label class='kwp-num'><span>Shape</span><select class='ed2-in tiny' data-kwf='shape'>"
        +KW_SHAPES.map(function(x){return "<option value='"+x[0]+"'"+(s.shape===x[0]?' selected':'')+">"+x[1]+"</option>";}).join('')
      +"</select></label>"
      +"<label class='kwp-num'><span>Extra</span><select class='ed2-in tiny kwp-hlsel' data-kwf='hl'>"
        +hls.map(function(x){return "<option value='"+x+"'"+(s.hl===x?' selected':'')+">"
          +kwHlLabel(x)+"</option>";}).join('')
      +"</select></label>"
    +"</div></div>";
}
function kwPageEditHTML(k,cu){
  var c=cu||{name:k.name,mode:k.mode||'keyword',match:k.match||k.name,
             matchAlt:'',param:'none',reminder:k.reminder||'',reminderBare:''};
  var fld=function(f,label,ph){
    return "<label class='kwe-f'><span>"+label+"</span>"
      +"<input class='ed2-in' data-kwe='"+f+"' value='"+e(c[f]||'')+"' placeholder='"+e(ph||'')+"'></label>";
  };
  var sel=function(f,label,opts,cur){
    return "<label class='kwe-f kwe-sel'><span>"+label+"</span><select class='ed2-in' data-kwe='"+f+"'>"
      +opts.map(function(m){
        return "<option value='"+m+"'"+(cur===m?' selected':'')+">"+m+"</option>";}).join('')
      +"</select></label>";
  };
  return "<div class='kwp-edit'><div class='kwm-form kwe-form'>"
    +"<div class='kwe-row'>"
      +fld('name','Name')
      +sel('param','Parameter',['none','number','cost','text'],c.param||'none')
      +sel('mode','Mode',['keyword','keyterm','counter','dice'],c.mode||'keyword')
    +"</div>"
    +"<div class='kwe-row'>"
      +fld('match','Match','defaults to the name')
      +"<label class='kwe-f'><span>Also match <i>(comma separated)</i></span>"
        +"<input class='ed2-in' data-kwe='matchAlt' value='"+e(c.matchAlt||'')+"' placeholder='Grinds, Grinding'></label>"
    +"</div>"
    +"<div class='kwe-row'>"
      +fld('reminder','Reminder','use {value} for the parameter')
      +fld('reminderBare','Reminder with no value','optional')
    +"</div>"
  +"</div><div class='tpl-opts'>"
    +"<button class='ed2-btn tiny primary' data-kwact='save'>Save</button>"
  +"</div></div>";
}
function kwPageRowHTML(k){
  var key=kwPageKey(k), cu=kwPageCustom(k), pill=pillableMode(k.name);
  var head=pill?kwPill(k.name,e(k.name),undefined,k.mode):("<span class='kwp-plain'>"+e(k.name)+"</span>");
  var split=(typeof window.edKwReminderSplit==='function')
    ? window.edKwReminderSplit(k.name,k.reminder) : null;
  var rem=(k.mode==='damage') ? e(dmgSummary(k))
    : (typeof fmtRuleNoLinks==='function')
    ? fmtRuleNoLinks(split?split.rest:(k.reminder||'')) : e(k.reminder||'');

  var open=(_kwPageOpen===key);
  var acts="<div class='kwp-acts'>"
    +"<button class='nb nb-s "+(open?'nb-red close-x':'nb-green')+"' data-kwact='edit' aria-expanded='"+open+"'>"
      +(open?'Close &#10005;':'Edit')+"</button>"
    +(cu?"<button class='nb nb-red nb-s' data-kwact='del'>Delete &#10005;</button>":"")
  +"</div>";
  /* the id linkKeywords() builds, so a keyword clicked in rule text lands on its row */
  return "<div class='kwp-row"+(_kwPageOpen===key?' kwp-open':'')
    +"' id='kwentry-"+e(String(k.name).replace(/\s+/g,'_'))+"'"
    +" data-kwrow='"+e(key)+"' data-kwname='"+e(k.name)+"'>"
    +"<div class='kwp-main'>"
      +"<div class='kwp-lead'>"
        +"<div class='kwp-pill'>"+head+"</div>"
        +"<div class='kwp-rem'><div class='kwp-rem-t'>"+rem+"</div></div>"
      +"</div>"
      +acts
    +"</div>"
    +(open?(pill?kwPageCtlHTML(k.name):'')+(k.mode==='damage'?dmgEditHTML(k,cu):kwPageEditHTML(k,cu)):"")
  +"</div>";
}
function dmgEditHTML(k,cu){
  var c=cu||k, kind=(c.dmgKind==='class')?'class':'type', mine=c.dmgClass||[];
  var classes=window.edDmgClasses().filter(function(x){ return x.name!==k.name; });
  var opt=function(v,l){ return "<option value='"+v+"'"+(kind===v?' selected':'')+">"+l+"</option>"; };
  return "<div class='kwp-edit'><div class='kwm-form kwe-form'>"
    +"<div class='kwe-row'>"
      +"<label class='kwe-f'><span>Name</span>"
        +"<input class='ed2-in' data-kwe='name' value='"+e(c.name||'')+"'></label>"
      +"<label class='kwe-f'><span>Abbreviation</span>"
        +"<input class='ed2-in' data-kwe='matchAlt' value='"+e(c.matchAlt||'')+"' placeholder='SL'></label>"
      +"<label class='kwe-f kwe-sel'><span>Kind</span><select class='ed2-in' data-kwe='dmgKind'>"
        +opt('type','Damage Type')+opt('class','Damage Class')+"</select></label>"
    +"</div>"
    +"<div class='kwe-row kwe-dmgcls'"+(kind==='class'?" hidden":"")+">"
      +"<span class='kwe-dmglab'>Damage Classes</span>"
      +(classes.length?classes.map(function(x){
          return "<label class='kwe-chk'><input type='checkbox' data-kwdc='"+e(x.name)+"'"
            +(mine.indexOf(x.name)>=0?' checked':'')+"> "+e(x.name)+"</label>";
        }).join(''):"<span class='kwe-dmglab'>(no classes yet)</span>")
    +"</div>"
  +"</div><div class='tpl-opts'>"
    +"<button class='ed2-btn tiny primary' data-kwact='save'>Save</button>"
  +"</div></div>";
}
function dmgFreshName(base){
  var taken={}; (window.KW_DATA||[]).forEach(function(k){ if(k.mode==='damage')taken[k.name]=1; });
  if(!taken[base])return base;
  for(var i=2;;i++)if(!taken[base+' '+i])return base+' '+i;
}
window.edRenderKwPage=function(){
  var bar=document.getElementById('kwPageBar'), body=document.getElementById('kwPageBody');
  if(!body)return;
  if(bar){
    bar.innerHTML="<div class='kwp-jump'>"
      +kwSections().map(function(s){
        return "<button class='ed2-btn tiny' data-kwjump='"+s[0]+"'>"+s[1]+"</button>";}).join('')
      +"</div>"
      +"<input type='text' class='ed2-in kwp-search' id='kwSearch' placeholder='Search…'>"
      +"<div class='kwp-baracts'>"
        +"<button class='ed2-btn tiny"+(PILLS_ON?' on':'')+"' data-kwbar='pills'>"
          +(PILLS_ON?'Pills ON':'Pills OFF')+"</button>"
        +"<button class='ed2-btn tiny primary' data-kwbar='add'>"+uiIco('plus')+" Add entry</button>"
        +"<button class='ed2-btn tiny warn' data-kwbar='reset'>Reset styles</button>"
      +"</div>";
  }
  body.innerHTML=kwSections().map(function(s){
    var list=kwPageList(s[0]);
    /* the Damage Type section is there even empty - it holds its own Add buttons */
    if(!list.length&&s[0]!=='damage')return '';
    return "<h3 class='kwp-head' id='kwsec-"+s[0]+"'>"+s[1]
      +"<span class='kwp-count'>"+list.length+"</span>"
      +(s[0]==='damage'?"<span class='kwp-hacts'>"
          +"<button class='ed2-btn tiny primary' data-kwdmgadd='type'>"+uiIco('plus')+" Damage Type</button>"
          +"<button class='ed2-btn tiny primary' data-kwdmgadd='class'>"+uiIco('plus')+" Damage Class</button></span>":"")
      +"</h3>"
      +list.map(kwPageRowHTML).join('');
  }).join('');
  kwPageBind();
  try{ _kwFilter(); }catch(_){}
  kwFitRems();
  kwWatchBody();
};
/* The largest size, up to the stylesheet's, at which the reminder fits the room between pill and controls (the text is out of flow, .kwp-rem-t).
   Written on the text box and read back from it: a size set on a parent leaves the child's computed size stale. */
function kwRemBase(){
  return (parseFloat(getComputedStyle(document.documentElement).fontSize)||16)*1.04;
}
function kwFitRems(){
  var body=document.getElementById('kwPageBody');
  if(!body||body.clientWidth<40)return;
  var base=kwRemBase();
  [].forEach.call(body.querySelectorAll('.kwp-rem'),function(r){
    var t=r.querySelector('.kwp-rem-t');
    if(!t)return;
    t.style.fontSize='';
    var room=r.clientHeight;
    if(!room)return;                              /* hidden by the search */
    /* in flow (a narrow window, controls under the text): it simply wraps */
    if(getComputedStyle(t).position!=='absolute')return;
    if(t.offsetHeight<=room)return;
    var lo=5, hi=base;
    for(var i=0;i<10;i++){
      var mid=(lo+hi)/2;
      t.style.fontSize=mid.toFixed(2)+'px';
      if(t.offsetHeight<=room)lo=mid; else hi=mid;
    }
    t.style.fontSize=lo.toFixed(2)+'px';
  });
}
window.edKwFitRems=kwFitRems;
/* Again whenever the page's width changes, from nothing too: it may be drawn while another tab is showing. */
var _kwRO=null,_kwROw=-1;
function kwWatchBody(){
  var body=document.getElementById('kwPageBody');
  if(!body||typeof ResizeObserver!=='function')return;
  if(!_kwRO)_kwRO=new ResizeObserver(function(){
    var b=document.getElementById('kwPageBody');
    if(!b||b.clientWidth===_kwROw)return;
    _kwROw=b.clientWidth;
    kwFitRems();
  });
  _kwRO.disconnect(); _kwROw=-1;
  _kwRO.observe(body);
}
function kwPageBind(){
  var bar=document.getElementById('kwPageBar'), body=document.getElementById('kwPageBody');
  if(bar){
    bar.querySelectorAll('[data-kwjump]').forEach(function(b){
      b.addEventListener('click',function(){
        var h=document.getElementById('kwsec-'+b.getAttribute('data-kwjump'));
        if(h)h.scrollIntoView({behavior:'smooth',block:'start'});
      });
    });
    bar.querySelectorAll('[data-kwbar]').forEach(function(b){
      b.addEventListener('click',function(){
        var a=b.getAttribute('data-kwbar');
        if(a==='pills'){ window.edSetPillsOn(!PILLS_ON); window.edRenderKwPage(); }
        /* edKwReset does not redraw this page */
        else if(a==='reset'){ window.edKwReset(); setTimeout(window.edRenderKwPage,60); }
        else if(a==='add'){
          window.edKwCustomSave({name:'New entry',mode:'keyword',match:'New entry',
            param:'none',reminder:''}).then(function(){
              _kwPageOpen='keyword|New entry'; window.edRenderKwPage();
              var r=document.querySelector("[data-kwrow='keyword|New entry']");
              if(r)r.scrollIntoView({behavior:'smooth',block:'center'});
            });
        }
      });
    });
    var s=document.getElementById('kwSearch');
    if(s)s.addEventListener('input',function(){ try{ _kwFilter(); }catch(_){} kwFitRems(); });
  }
  if(!body)return;
  body.querySelectorAll('[data-kwdmgadd]').forEach(function(b){
    b.addEventListener('click',function(){
      var kind=b.getAttribute('data-kwdmgadd');
      var nm=dmgFreshName(kind==='class'?'New damage class':'New damage type');
      window.edDmgSave({name:nm,matchAlt:'',dmgKind:kind,dmgClass:[]}).then(function(){
        _kwPageOpen='damage|'+nm; window.edRenderKwPage();
        var r=document.querySelector("[data-kwrow='damage|"+nm+"']");
        if(r)r.scrollIntoView({behavior:'smooth',block:'center'});
      });
    });
  });
  body.querySelectorAll("[data-kwe='dmgKind']").forEach(function(sel){
    sel.addEventListener('change',function(){
      var r=sel.closest('.kwp-row'), box=r&&r.querySelector('.kwe-dmgcls');
      if(box)box.hidden=(sel.value==='class');
    });
  });
  body.querySelectorAll('.kwp-row').forEach(function(row){
    var name=row.getAttribute('data-kwname'), key=row.getAttribute('data-kwrow');
    row.querySelectorAll('[data-kwf]').forEach(function(inp){
      var f=inp.getAttribute('data-kwf');
      inp.addEventListener('input',function(){
        var v=(f==='w')?(parseFloat(inp.value)||0):inp.value;
        window.edSetKwStyle(name,f,v);
        var hx=row.querySelector("[data-kwhex='"+f+"']");
        if(hx&&inp.type==='color')hx.value=inp.value;
        kwPageRepaint(row,name);
      });
      if(inp.tagName==='SELECT')inp.addEventListener('change',function(){
        window.edSetKwStyle(name,f,inp.value); kwPageRepaint(row,name);
      });
    });
    /* only a full #rrggbb is written, and the box snaps back otherwise: the pill cannot render anything else */
    row.querySelectorAll('[data-kwhex]').forEach(function(hx){
      var f=hx.getAttribute('data-kwhex');
      hx.addEventListener('change',function(){
        var v=String(hx.value||'').trim();
        if(v[0]!=='#')v='#'+v;
        if(!/^#[0-9a-f]{6}$/i.test(v)){ hx.value=kwStyleFor(name)[f]; return; }
        window.edSetKwStyle(name,f,v);
        var sw=row.querySelector("input[type=color][data-kwf='"+f+"']");
        if(sw)sw.value=v;
        hx.value=v;
        kwPageRepaint(row,name);
      });
    });
    row.querySelectorAll('[data-kwact]').forEach(function(b){
      b.addEventListener('click',function(){
        var a=b.getAttribute('data-kwact');
        if(a==='edit'){ _kwPageOpen=(_kwPageOpen===key)?null:key; window.edRenderKwPage(); }
        else if(a==='del'){
          /* edKwCustomDelete asks and redraws this page itself */
          var cu=(KWCUSTOM||[]).filter(function(c){return (c.mode||'keyword')+'|'+c.name===key;})[0];
          if(cu){ _kwPageOpen=null; window.edKwCustomDelete(cu.id); }
        }
        else if(a==='save'){
          var g=function(f){var el=row.querySelector("[data-kwe='"+f+"']");return el?String(el.value).trim():'';};
          var nm=g('name'); if(!nm){alert('Name is required.');return;}
          if(key.indexOf('damage|')===0){
            var clash=(window.KW_DATA||[]).some(function(k){
              return k.mode==='damage'&&!k.__alias&&k.name===nm&&nm!==name; });
            if(clash){ alert('There is already a Damage Type or Class called "'+nm+'".'); return; }
            var ticks=Array.prototype.map.call(row.querySelectorAll('[data-kwdc]:checked'),
              function(x){ return x.getAttribute('data-kwdc'); });
            var own=(KWCUSTOM||[]).filter(function(c){return c.mode==='damage'&&c.name===name;})[0];
            window.edDmgSave({id:own?own.id:undefined,replaces:own?own.replaces:undefined,name:nm,
              matchAlt:g('matchAlt'),dmgKind:g('dmgKind'),dmgClass:ticks},name).then(function(){
                _kwPageOpen=null; window.edRenderKwPage();
              });
            return;
          }
          var cu=(KWCUSTOM||[]).filter(function(c){return (c.mode||'keyword')+'|'+c.name===key;})[0];
          window.edKwCustomSave({id:cu?cu.id:undefined,name:nm,mode:g('mode')||'keyword',
            match:g('match')||nm,matchAlt:g('matchAlt'),param:g('param')||'none',
            reminder:g('reminder'),reminderBare:g('reminderBare')}).then(function(){
              _kwPageOpen=null; window.edRenderKwPage();
            });
        }
      });
    });
  });
}
/* Only this row: a colour drag fires input on every move, and a full redraw is 100+ rows. */
function kwPageRepaint(row,name){
  var pv=row.querySelector('.kwp-pill');
  var md=String(row.getAttribute('data-kwrow')||'').split('|')[0];
  if(pv)pv.innerHTML=kwPill(name,e(name),undefined,md);
  var s=kwStyleFor(name), sel=row.querySelector('.kwp-hlsel');
  if(sel){ sel.style.backgroundImage=edKwGradFlat(s.hl,s.f,s.fh);
           sel.style.color=(s.hl==='none'?'#dbe2ee':'#0d1017'); }
  try{ scheduleFace(); }catch(_){}
}

/* The Help page is the catalog's and re-renders on tab switch, so its entry points are wrapped (edWrapHelp) rather than injected once. */
function edHelpToggleHTML(){
  return "<div id='edHelpKwHover' class='ed2-help-row'>"
    +"<label><input type='checkbox'"+(KW_HOVER?' checked':'')
    +" onchange='edSetKwHover(this.checked)'> Show keyword reminder text on hover</label>"
    +"</div>";
}
function edInjectHelpToggle(){
  var body=document.getElementById('scBody'); if(!body)return;
  var old=document.getElementById('edHelpKwHover'); if(old)old.remove();
  if(window._scMode&&window._scMode!=='keys')return;
  body.insertAdjacentHTML('afterbegin',edHelpToggleHTML());
}

function edDeckNames(){
  var ids=(typeof DECK_IDS!=='undefined'&&DECK_IDS)
          ?[DECK_IDS.main,DECK_IDS.essence,DECK_IDS.wish]
          :['dta-main','dta-essence','dta-wish'];
  var out={};
  ids.forEach(function(id){
    var el=id&&document.getElementById(id); if(!el)return;
    String(el.value||'').split('\n').forEach(function(line){
      line=line.trim(); if(!line)return;
      /* the "3x Name" shape parseDeckLines (cat_core.js) reads */
      var m=line.match(/^(\d+)x\s+(.+)$/i);
      out[(m?m[2]:line).trim()]=1;
    });
  });
  return out;
}
function edOrphanWarnRows(){
  var orph=(typeof window.edOrphans==='function')?window.edOrphans():[];
  if(!orph.length)return '';
  var inDeck=edDeckNames();
  return orph.filter(function(c){ return inDeck[c.name]; }).map(function(c){
    var since=String((c.orphan&&c.orphan.since)||'').slice(0,10);
    return "<div class='deck-warn-row orphan'><span class='deck-warn-icon'>"+uiIco('warn')+"</span>"
      +e(c.name)+" — no longer in its source saga"
      +(since?" (last seen "+e(since)+")":"")
      +". The card is still here and still legal.</div>";
  }).join('');
}
function edAppendOrphanWarnings(){
  var box=document.getElementById('deckWarnBox'); if(!box)return;
  if(typeof _gameMode!=='undefined'&&_gameMode==='none')return;
  var rows=edOrphanWarnRows(); if(!rows)return;
  var inner=box.querySelector('.deck-warn-box');
  if(!inner){ box.innerHTML="<div class='deck-warn-box'></div>";
              inner=box.querySelector('.deck-warn-box'); }
  inner.insertAdjacentHTML('beforeend',rows);
}
function edWrapDeckWarnings(){
  var orig=window.updateDeckWarnings;
  if(typeof orig!=='function'||orig.__edOrphanWrapped)return;
  var w=function(){ var r=orig.apply(this,arguments);
    try{ edAppendOrphanWarnings(); }catch(_){}
    return r; };
  w.__edOrphanWrapped=true; window.updateDeckWarnings=w;
}
window.edRenderOrphans=function(){
  var host=document.getElementById('edOrphanBody'); if(!host)return;
  var orph=(typeof window.edOrphans==='function')?window.edOrphans():[];
  if(!orph.length){
    host.innerHTML="<i class='tpl-hint'>No orphaned cards — every card is still "
      +"listed by the source it came from.</i>";
    return;
  }
  var inDeck=edDeckNames();
  host.innerHTML="<div class='dup-list'>"+orph.map(function(c){
    var since=String((c.orphan&&c.orphan.since)||'').slice(0,10);
    return "<div class='dup-row orph-row'>"
      +"<span class='dup-tag'>Orphan</span><b>"+e(c.name)+"</b>"
      +"<i>"+e(c.saga||c.sagaId||'—')+(since?" · since "+e(since):'')+"</i>"
      +(inDeck[c.name]?"<span class='dup-tag in-deck'>In a Deck</span>":"")
      +"<button class='ed2-btn tiny' data-id='"+e(c.__id)+"' onclick='edClearOrphan(this.dataset.id)'>Keep</button>"
      +"</div>";
  }).join('')+"</div>";
};

function edWrapHelp(){
  ['openShortcutsPage','switchScTab','renderScPage'].forEach(function(fn){
    var orig=window[fn];
    if(typeof orig!=='function'||orig.__edWrapped)return;
    var w=function(){ var r=orig.apply(this,arguments);
      setTimeout(edInjectHelpToggle,60);
      /* repaints the Owner Sync window when one is open (#scSyncBody) */
      setTimeout(function(){ try{ if(typeof edRenderOwnerSync==='function')edRenderOwnerSync(); }catch(_){} },60);
      return r; };
    w.__edWrapped=true; window[fn]=w;
  });
}

/* Depth counting, not a regex, which cannot match balanced pairs.
   A split card's text is its sections, written in the record itself (frFields), then ruleText is synced (syncSplitRuleText). */
function stripParens(txt){
  var s=String(txt||''), out='', depth=0;
  for(var i=0;i<s.length;i++){
    var ch=s[i];
    if(ch==='('){ depth++; continue; }
    if(ch===')'){ if(depth>0){depth--; continue;} }
    if(depth===0)out+=ch;
  }
  return out.replace(/[ \t]{2,}/g,' ')
            .replace(/[ \t]+([,.;:!?])/g,'$1')
            .replace(/^[ \t]+|[ \t]+$/gm,'')
            .replace(/\n{3,}/g,'\n\n').trim();
}
var _frList=[], _frIdx=0, _frLocked=0;
function frFields(c){
  var n=(typeof rulesSplitOf==='function')?rulesSplitOf(c):0, out=[];
  if(n&&Array.isArray(c.sections)){
    for(var i=0;i<n;i++)(function(i){
      if(c.sections[i])out.push({get:function(){ return String(c.sections[i].text||''); },
                                 set:function(v){ c.sections[i].text=v; }});
    })(i);
    return {split:true, fields:out};
  }
  out.push({get:function(){ return String(c.ruleText||''); }, set:function(v){ c.ruleText=v; }});
  return {split:false, fields:out};
}
function frHit(t){ return /\([^)]*\)/.test(t) && stripParens(t)!==String(t||'').trim(); }
function frHas(c){ return frFields(c).fields.some(function(f){ return frHit(f.get()); }); }
function frShow(c,after){
  var NL2=String.fromCharCode(10,10);
  return frFields(c).fields.map(function(f){
    var t=f.get(); return (after&&frHit(t))?stripParens(t):t; }).join(NL2);
}
function frApply(c){
  var ff=frFields(c);
  ff.fields.forEach(function(f){ var t=f.get(); if(frHit(t))f.set(stripParens(t)); });
  if(ff.split&&typeof syncSplitRuleText==='function')syncSplitRuleText(c);
  markDirty(c);
}
function frScan(){
  var split=edSplitLocked((window.CARDS||[]).filter(frHas));
  _frList=split.open; _frLocked=split.locked.length;
  _frIdx=0;
}
window.edFrRefresh=function(){
  var host=document.getElementById('edFrBody'); if(!host)return;
  var lockedNote=_frLocked?("<i class='tpl-hint'>"+e(edSkippedText(_frLocked))+".</i>"):'';
  if(!_frList.length){
    host.innerHTML="<div class='tpl-sec'><i class='tpl-hint'>No cards you can edit have bracketed text in their rules.</i>"
      +lockedNote+"</div>";
    return;
  }
  if(_frIdx>=_frList.length)_frIdx=_frList.length-1;
  var c=_frList[_frIdx], before=frShow(c,false), after=frShow(c,true);
  host.innerHTML=lockedNote
    +"<div class='tpl-opts'><b>"+(_frIdx+1)+" of "+_frList.length+"</b>"
      +"<span class='tpl-lbl' style='min-width:0;flex:1'>"+e(c.name)+"</span>"
      +"<button class='ed2-btn tiny' onclick='edFrPrev()'>"+uiIco('arrow-left')+" Prev</button>"
      +"<button class='ed2-btn tiny' onclick='edFrNext()'>Skip "+uiIco('arrow-right')+"</button>"
      +"<button class='ed2-btn tiny on' onclick='edFrApplyOne()'>Remove on this card</button>"
      +"<button class='ed2-btn tiny warn' onclick='edFrApplyAll()'>Remove on all "+_frList.length+"</button>"
    +"</div>"
    +"<div class='fr-cols'>"
      +"<div><h4>Before</h4><pre class='fr-pre fr-before'>"+e(before)+"</pre></div>"
      +"<div><h4>After</h4><pre class='fr-pre fr-after'>"+e(after)+"</pre></div>"
    +"</div>";
};
window.edFrNext=function(){ if(_frIdx<_frList.length-1)_frIdx++; edFrRefresh(); };
window.edFrPrev=function(){ if(_frIdx>0)_frIdx--; edFrRefresh(); };
window.edFrApplyOne=function(){
  var c=_frList[_frIdx]; if(!c)return;
  frApply(c);
  _frList.splice(_frIdx,1);
  persistCard(c).then(function(){
    applyToCatalog();
    var cur=curCard(); if(cur&&cur.__id===c.__id){ renderFields(); renderPreview(cur); }
    edFrRefresh(); toast('Cleaned '+c.name);
  },function(){ edFrRefresh(); });
};
window.edFrApplyAll=function(){
  if(!_frList.length)return;
  var list=_frList.slice();
  edDangerGate({
    title:'Remove bracketed text',
    lose:['Every (parenthesised) passage in the rule text of '+list.length+' card(s)',
          'Reminder text written by hand goes with it - there is no undo'],
    note:_frLocked?[edSkippedText(_frLocked)]:[],
    phrase:'STRIP',
    proceedLabel:'Clean '+list.length+' card(s)'
  }).then(function(ok){
    if(!ok){ toast('Cancelled - nothing was changed'); return; }
    list.forEach(frApply);
    _frList=[];
    var done=function(){
      applyToCatalog();
      var cur=curCard(); if(cur){ renderFields(); renderPreview(cur); }
      edFrRefresh();
    };
    Promise.all(list.map(function(c){return persistCard(c);})).then(function(){
      done(); toast('Cleaned '+list.length+' cards'+(_frLocked?(' - skipped '+_frLocked+' read-only'):''));
    },done);
  });
};
/* Only the text a card prints, and only dashes used as dashes are ticked: most hyphens sit inside words or before numbers (HANDOFF §12.1).
   Split cards are written in c.sections, never through cardSections(), which returns copies. */
var DASH_SET = '-' + String.fromCharCode(0x2010,0x2011,0x2012,0x2013,0x2015,0x2212,0xFE58,0xFE63,0xFF0D);
var _dashList = [], _dashIdx = 0, _dashMode = 'all';
function dashFields(c){
  var out = [], n = (typeof rulesSplitOf === 'function') ? rulesSplitOf(c) : 0;
  if(n && Array.isArray(c.sections)){
    for(var i = 0; i < n; i++)(function(i){
      if(c.sections[i] && c.sections[i].text) out.push({key:'sec'+i, label:'Section '+(i+1), split:true,
        get:function(){ return String(c.sections[i].text || ''); },
        set:function(v){ c.sections[i].text = v; }});
    })(i);
  } else if(c.ruleText){
    out.push({key:'rules', label:'Rules',
      get:function(){ return String(c.ruleText || ''); }, set:function(v){ c.ruleText = v; }});
  }
  if(typeof c.choiceText === 'string' && c.choiceText) out.push({key:'choice', label:'Choice',
    get:function(){ return String(c.choiceText || ''); }, set:function(v){ c.choiceText = v; }});
  if(c.flavor) out.push({key:'flavor', label:'Flavor', flavor:true,
    get:function(){ return String(c.flavor || ''); }, set:function(v){ c.flavor = v; }});
  if(c.sagaFields && typeof c.sagaFields === 'object') Object.keys(c.sagaFields).forEach(function(sid){
    var f = c.sagaFields[sid];
    if(f && typeof f.flavor === 'string' && f.flavor) out.push({key:'sf:'+sid, label:'Flavor ('+sid+')', flavor:true,
      get:function(){ return String(c.sagaFields[sid].flavor || ''); }, set:function(v){ c.sagaFields[sid].flavor = v; }});
  });
  return out;
}
function dashAt(text, i, isFlavor){
  var ch = text[i], len = (ch === '-' && text[i+1] === '-') ? 2 : 1;
  var prev = i > 0 ? text[i-1] : '', next = text[i+len] || '';
  var lineStart = (i === 0 || prev === '\n');
  var sp = function(x){ return x === ' ' || x === '\t'; };
  var word = function(x){ return /[A-Za-z0-9]/.test(x); };
  var asDash;
  if(len === 2) asDash = true;
  else if(ch !== '-' && ch !== String.fromCharCode(0x2212)){
    asDash = !(/[0-9]/.test(prev) && /[0-9]/.test(next));        /* "1–3" is a range */
  }
  else if(sp(prev) && (sp(next) || next === '\n' || next === '')) asDash = true;
  else if(lineStart && sp(next)) asDash = true;
  else if(lineStart && isFlavor && /[A-Za-z]/.test(next)) asDash = true;           /* "-Ancient Elf Hymn" */
  else if(word(prev) && word(next)) asDash = false;               /* Non-Ongoing, 4-Sided */
  else if(/[0-9XxD+]/.test(next)) asDash = false;                 /* -1 counter, -X, -D4 */
  else if(word(prev) && (sp(next) || next === '')) asDash = true; /* "Arrive- Ignite" */
  else if(sp(prev) && /[A-Za-z]/.test(next)) asDash = true;       /* "Arrive -Ignite" */
  else asDash = false;
  var rep = '—';
  if(asDash){
    var lead  = (lineStart || sp(prev)) ? '' : ' ';
    var trail = (sp(next) || next === '\n' || next === '') ? '' : ' ';
    rep = lead + '—' + trail;
  }
  return {len: len, asDash: asDash, rep: rep};
}
/* Not even listed, by the author's rule: after Non or Sub, or before a number (HANDOFF §12.1). */
function dashIgnored(text, i, len){
  if(/[0-9]/.test(text[i + len] || '')) return true;
  return /(^|[^A-Za-z])(non|sub)$/i.test(text.slice(Math.max(0, i - 4), i));
}
function dashScan(){
  var dash = [], word = [];
  (window.CARDS || []).forEach(function(c){
    if(!c) return;
    try{ if(typeof edCardLocked === 'function' && edCardLocked(c)) return; }catch(_){}
    dashFields(c).forEach(function(f){
      var t = f.get();
      for(var i = 0; i < t.length; i++){
        if(DASH_SET.indexOf(t[i]) < 0) continue;
        var d = dashAt(t, i, !!f.flavor);
        if(dashIgnored(t, i, d.len)){ i += d.len - 1; continue; }
        var o = {card: c, field: f, pos: i, len: d.len, asDash: d.asDash, rep: d.rep, on: d.asDash};
        (d.asDash ? dash : word).push(o);
        i += d.len - 1;
      }
    });
  });
  /* One at a Time steps through them in this order */
  _dashList = dash.concat(word);
}
function dashCtx(o, after){
  var t = o.field.get(), a = Math.max(0, o.pos - 34), b = Math.min(t.length, o.pos + o.len + 34);
  var nl = function(s){ return e(s).replace(/\n/g, '⏎'); };
  var mid = after ? o.rep : t.slice(o.pos, o.pos + o.len);
  return (a > 0 ? '…' : '') + nl(t.slice(a, o.pos)) + "<mark class='dash-mk'>" + nl(mid) + "</mark>"
    + nl(t.slice(o.pos + o.len, b)) + (b < t.length ? '…' : '');
}
/* per field, from the end backwards, so the earlier positions stay true */
function dashWrite(list){
  var byCard = {};
  list.forEach(function(o){
    var k = o.card.__id;
    (byCard[k] = byCard[k] || {card: o.card, fields: {}});
    var fk = o.field.key;
    (byCard[k].fields[fk] = byCard[k].fields[fk] || {field: o.field, hits: []}).hits.push(o);
  });
  var cards = [];
  Object.keys(byCard).forEach(function(k){
    var g = byCard[k], split = false;
    Object.keys(g.fields).forEach(function(fk){
      var F = g.fields[fk], t = F.field.get();
      F.hits.sort(function(x, y){ return y.pos - x.pos; }).forEach(function(o){
        t = t.slice(0, o.pos) + o.rep + t.slice(o.pos + o.len);
      });
      F.field.set(t);
      if(F.field.split) split = true;
    });
    if(split && typeof syncSplitRuleText === 'function') syncSplitRuleText(g.card);
    markDirty(g.card);
    cards.push(g.card);
  });
  return Promise.all(cards.map(function(c){ return persistCard(c); })).then(function(){
    applyToCatalog();
    var cur = curCard();
    if(cur && cards.indexOf(cur) >= 0){ renderFields(); renderPreview(cur); }
    return cards.length;
  });
}
window.edDashMode = function(mode){
  _dashMode = (mode === 'one') ? 'one' : 'all';
  dashScan(); _dashIdx = 0;
  edDashRender();
};
window.edDashRender = function(){
  var host = document.getElementById('edDashBody'); if(!host) return;
  var L = _dashList;
  var mA = document.getElementById('edDashModeAll'), mO = document.getElementById('edDashModeOne');
  if(mA) mA.classList.toggle('on', _dashMode !== 'one');
  if(mO) mO.classList.toggle('on', _dashMode === 'one');
  if(!L.length){ host.innerHTML = "<div class='tpl-opts fx-ok'><b>No dashes to fix.</b></div>"; return; }
  var cards = {}; L.forEach(function(o){ cards[o.card.__id] = 1; });
  var nCards = Object.keys(cards).length, nOn = L.filter(function(o){ return o.on; }).length;
  if(_dashMode === 'one'){
    if(_dashIdx >= L.length) _dashIdx = L.length - 1;
    if(_dashIdx < 0) _dashIdx = 0;
    var o = L[_dashIdx];
    host.innerHTML =
      "<div class='tpl-opts'><b>" + (_dashIdx + 1) + " of " + L.length + "</b>"
        + "<span class='tpl-lbl' style='min-width:0;flex:1'>" + e(o.card.name) + " · " + e(o.field.label)
        + (o.asDash ? '' : " · <i>inside a word or a number</i>") + "</span>"
        + "<button class='ed2-btn tiny' onclick='edDashBack()'>" + uiIco('arrow-left') + " Back</button>"
        + "<button class='ed2-btn tiny' onclick='edDashSkip()'>Skip " + uiIco('arrow-right') + "</button>"
        + "<button class='ed2-btn tiny on' onclick='edDashReplaceOne()'>Replace</button>"
      + "</div>"
      + "<div class='fr-cols'>"
        + "<div><h4>Before</h4><pre class='fr-pre dash-before'>" + dashCtx(o, false) + "</pre></div>"
        + "<div><h4>After</h4><pre class='fr-pre dash-after'>" + dashCtx(o, true) + "</pre></div>"
      + "</div>";
    return;
  }
  host.innerHTML =
    "<div class='tpl-opts'><b>" + L.length + "</b> dash(es) on <b>" + nCards + "</b> card(s) · <b class='dash-n'>" + nOn + "</b> ticked"
      + "<span class='fx-grow'></span><label class='fx-sel-lbl'>Tick <select class='ed2-in fx-sel' aria-label='Tick'"
        + " onchange='if(this.value)edDashTick(this.value)'><option value=''>Choose…</option>"
        + "<option value='dash'>Dashes Only</option><option value='all'>Everything</option>"
        + "<option value='none'>Nothing</option></select></label>"
      + "<button class='ed2-btn tiny warn' onclick='edDashReplaceTicked()'>Replace ticked with —</button>"
    + "</div>"
    + "<div class='dash-list'>"
    + L.map(function(o, i){
        return "<label class='dash-row" + (o.asDash ? '' : ' dash-word') + "'>"
          + "<input type='checkbox' data-i='" + i + "'" + (o.on ? ' checked' : '') + " onchange='edDashToggle(" + i + ",this.checked)'>"
          + "<b>" + e(o.card.name) + "</b><span class='dash-f'>" + e(o.field.label) + "</span>"
          + "<span class='dash-ctx'>" + dashCtx(o, false) + "</span></label>";
      }).join('')
    + "</div>";
};
window.edDashToggle = function(i, on){
  if(_dashList[i]) _dashList[i].on = !!on;
  var n = document.querySelector('#edDashBody .dash-n');
  if(n) n.textContent = _dashList.filter(function(o){ return o.on; }).length;
};
window.edDashTick = function(which){
  _dashList.forEach(function(o){ o.on = (which === 'all') ? true : (which === 'none') ? false : o.asDash; });
  edDashRender();
};
window.edDashReplaceTicked = function(){
  var list = _dashList.filter(function(o){ return o.on; });
  if(!list.length){ toast('Nothing is ticked'); return; }
  var cards = {}; list.forEach(function(o){ cards[o.card.__id] = 1; });
  var n = Object.keys(cards).length;
  return edDangerGate({
    title: 'Replace dashes',
    lose: [list.length + ' dash(es) on ' + n + ' card(s) become —',
           'There is no undo'],
    phrase: 'DASH',
    requireBackup: true,
    proceedLabel: 'Replace ' + list.length
  }).then(function(ok){
    if(!ok){ toast('Cancelled - nothing was changed'); return; }
    return dashWrite(list).then(function(k){
      toast('Replaced ' + list.length + ' dash(es) on ' + k + ' card(s)');
      dashScan(); edDashRender();
    });
  });
};
window.edDashReplaceOne = function(){
  var o = _dashList[_dashIdx]; if(!o) return;
  return dashWrite([o]).then(function(){
    /* scanned again: the positions after this one have moved */
    dashScan(); edDashRender();
  });
};
window.edDashSkip = function(){ if(_dashIdx < _dashList.length - 1) _dashIdx++; edDashRender(); };
window.edDashBack = function(){ if(_dashIdx > 0) _dashIdx--; edDashRender(); };
window.edDashState = function(){
  return {mode: _dashMode, idx: _dashIdx, list: _dashList.map(function(o){
    var t = o.field.get();
    return {name: o.card.name, field: o.field.key, pos: o.pos, asDash: o.asDash, on: o.on, rep: o.rep,
            pre: t.slice(Math.max(0, o.pos - 12), o.pos), ch: t.substr(o.pos, o.len),
            post: t.slice(o.pos + o.len, o.pos + o.len + 12)}; })};
};

/* An older import wrote fused stats as a suffix on the arcane value ("6A", "6H") instead of the orb type; converted in place, safe to run again. */
function fusedRepairScan(){
  var hits=[];
  (window.CARDS||[]).forEach(function(c){
    var orbs=c.orbs; if(!Array.isArray(orbs))return;
    orbs.forEach(function(o,i){
      var m=/^\s*(\d+|X)\s*([AH])\s*$/i.exec(String(o&&o.value!=null?o.value:''));
      if(m)hits.push({card:c,idx:i,value:m[1],kind:m[2].toUpperCase()});
    });
  });
  return hits;
}
window.edRepairFused=function(dryRun){
  var all=fusedRepairScan();
  var split=edSplitLocked(all.map(function(h){ return h.card; }).filter(function(c,i,a){ return a.indexOf(c)===i; }));
  var open={}; split.open.forEach(function(c){ open[c.__id]=1; });
  var hits=all.filter(function(h){ return open[h.card.__id]; }), skipped=split.locked.length;
  var NL=String.fromCharCode(10), skipLine=skipped?(NL+NL+edSkippedText(skipped)+'.'):'';
  var host=dryRun?document.getElementById('edFusedBody'):null;
  var say=function(msg,clean){
    if(host)host.innerHTML="<div class='fx-msg"+(clean?' fx-ok':'')+"'>"+e(msg)+"</div>";
    else alert(msg);
  };
  if(!all.length){ say('No stats look like "6A" or "6H" \u2014 nothing to repair.',true); return; }
  if(!hits.length){ say('Every card with a stat like "6A" or "6H" is read-only here - nothing to repair.'+skipLine); return; }
  if(dryRun){
    var sample=hits.slice(0,12).map(function(h){
      return '\u2022 '+h.card.name+': slot '+(h.idx+1)+'  '+h.value+h.kind
        +'  \u2192  '+(h.kind==='A'?'attack and arcane':'health and arcane')+' = '+h.value; }).join(NL);
    say(hits.length+' stat value(s) across '+new Set(hits.map(function(h){return h.card.__id;})).size
      +' card(s) look mis-mapped.'+NL+NL+sample+(hits.length>12?NL+'\u2026':'')+skipLine);
    return;
  }
  if(!confirm('Repair '+hits.length+' stat value(s)? The orb type becomes the fused type and the value becomes the number.'+skipLine))return;
  var touched={};
  hits.forEach(function(h){
    var o=h.card.orbs[h.idx];
    o.type=(h.kind==='A')?'attack and arcane':'health and arcane';
    o.value=h.value;
    touched[h.card.__id]=h.card;
  });
  var list=Object.keys(touched).map(function(k){return touched[k];});
  list.forEach(function(c){ markDirty(c); });
  var done=function(){
    applyToCatalog();
    var cur=curCard(); if(cur){ renderFields(); renderPreview(cur); }
    if(document.getElementById('edFusedBody'))window.edRepairFused(true);
  };
  Promise.all(list.map(function(c){return persistCard(c);})).then(function(){
    done();
    toast('Repaired '+hits.length+' stat(s) on '+list.length+' card(s)'+(skipped?(' - skipped '+skipped+' read-only'):''));
  },done);
};

/* Every tool stays in the page, only hidden, so each report draws into its own body; the Strip tool too, in #edFrBody, as a second element with that id would take edFrRefresh's writes.
   The counts are redrawn on a MutationObserver of the reports, and edFixPills writes one only when it changed, or the observer wakes itself for ever. */
var FIX_TOOLS=[
  {id:'dash',    grp:'Text Clean-Up', name:'Fix —'},
  {id:'strip',   grp:'Text Clean-Up', name:'Strip ( )'},
  {id:'essence', grp:'Text Clean-Up', name:'Essence Rule Text'},
  {id:'fused',   grp:'Stats', name:'Fused Stats'},
  {id:'dup',     grp:'Duplicates and Look-Alikes', name:'Duplicate Cards'},
  {id:'shape',   grp:'Duplicates and Look-Alikes', name:'Same Shape, Different Name'},
  {id:'shared',  grp:'Duplicates and Look-Alikes', name:'Same Card in Several Sagas'},
  {id:'saga',    grp:'Data Health', name:'Saga Fields Disagree'},
  {id:'cid',     grp:'Data Health', name:'Card IDs'},
  {id:'orphan',  grp:'Data Health', name:'Orphaned Cards'},
  {id:'nokw',    grp:'Words', name:'Not in Keywords'},
  {id:'typo',    grp:'Words', name:'Possible Typos'}
];
var _fixSel='dash', _fixCid=null, _fixPillT=0;
function fixChip(kind,text){ return "<span class='fx-chip "+kind+"'>"+text+"</span>"; }
function fixZone(label,buttons,danger){
  return "<div class='fx-zone"+(danger?' fx-danger':'')+"'><span class='fx-zl'>"+label+"</span>"+buttons+"</div>";
}
function fixSec(id,chips,about,acts,body){
  var i=0; FIX_TOOLS.forEach(function(t,k){ if(t.id===id)i=k; });
  var t=FIX_TOOLS[i];
  return "<section class='tpl-sec fx-panel' id='edFixSec-"+id+"' aria-labelledby='edFixH-"+id+"'>"
    +"<div class='fx-phead'><span class='fx-num'>"+(i+1)+"</span><h4 id='edFixH-"+id+"'>"+t.name+"</h4>"
      +"<span class='fx-pill' data-fx='"+id+"'></span><span class='fx-grow'></span>"+chips+"</div>"
    +"<div class='fx-pbody'>"
      +(about?"<details class='fx-about'><summary>About This Tool</summary><i class='tpl-hint'>"+about+"</i></details>":"")
      +(acts?"<div class='fx-acts'>"+acts+"</div>":"")
      +body
    +"</div></section>";
}
window.edOpenFix=function(){
  var ov=document.getElementById('edFixOverlay');
  if(!ov){
    var nav='', grp='';
    FIX_TOOLS.forEach(function(t,i){
      if(t.grp!==grp){ grp=t.grp; nav+="<div class='fx-gh'>"+grp+"</div>"; }
      nav+="<button class='fx-nav-item' id='edFixNav-"+t.id+"' onclick=\"edFixShow('"+t.id+"')\">"
        +"<span class='fx-num'>"+(i+1)+"</span><span class='fx-nav-name'>"+t.name+"</span>"
        +"<span class='fx-pill' data-fx='"+t.id+"'></span></button>";
    });
    ov=document.createElement('div'); ov.id='edFixOverlay'; ov.className='ed2-overlay';
    ov.innerHTML="<div class='ed2-modal ed2-modal-wide fx-modal'><div class='ed2-modal-head wh'>"
      +"<b class='fx-title wh-t'>⚙ Fix</b><span class='fx-sum' id='edFixSum'></span><span class='fx-grow'></span>"
      +"<button class='ed2-btn fx-look' onclick='edFixRecheck()'>↻ Re-Check All</button>"
      +"<button class='ed2-btn close-x nb nb-red nb-m wh-x' onclick='edCloseFix()'>Close &#10005;</button></div>"
      +"<div class='ed2-modal-body fx-body'>"
      +"<nav class='fx-nav' aria-label='Fix tools'>"+nav+"</nav>"
      +"<div class='fx-main' id='edFixMain'>"
        +"<div class='fx-crumb' id='edFixCrumb'></div>"
        +fixSec('dash',
          fixChip('red','No Undo')+fixChip('amber','Backup, Then Type DASH'),
          "Every kind of dash in rules, Choice and flavor text, made the "
          +"same —. Dashes used as a dash are ticked; hyphens inside words and minus signs "
          +"(Non-Ongoing, -1 counter) are listed but left unticked. Names, mana costs and type "
          +"lines are never touched.",
          fixZone('Review',"<div class='fx-seg' role='group' aria-label='How to review'>"
            +"<button class='ed2-btn' id='edDashModeAll' onclick=\"edDashMode('all')\">All at Once</button>"
            +"<button class='ed2-btn' id='edDashModeOne' onclick=\"edDashMode('one')\">One at a Time</button>"
          +"</div>"),
          "<div class='fx-res' id='edDashBody'></div>")
        +fixSec('strip',
          fixChip('red','No Undo')+fixChip('amber','Remove on All Asks for STRIP'),
          "Removes parenthetical reminder text left behind by MSE import. "
          +"Brackets are depth-counted, not matched by regex. <b>No undo.</b>",
          '',
          "<div class='fx-res' id='edFrBody'></div>")
        +fixSec('essence',
          fixChip('red','No Undo')+fixChip('amber','Type CLEAR'),
          "Core and Dual Essence render with no text box, so any rule text "
          +"on them is invisible on the card. This clears it so the data matches. "
          +"<b>No undo</b> — export a backup first.",
          fixZone('Changes Cards',"<button class='ed2-btn warn' onclick='edClearEssenceText()'>Clear Core/Dual Essence rule text</button>",true),
          '')
        +fixSec('fused',
          fixChip('red','No Undo')+fixChip('blue','Safe to Run Twice'),
          "An older import wrote fused stats as “6A” / “6H” in the "
          +"arcane slot's value instead of setting the orb type. Check first — the repair has "
          +"<b>no undo</b>, though it is safe to run twice.",
          fixZone('Look',"<button class='ed2-btn fx-look' onclick='edRepairFused(true)'>Check Stats</button>")
          +fixZone('Changes Cards',"<button class='ed2-btn warn' onclick='edRepairFused(false)'>Repair Stats</button>",true),
          "<div class='fx-res' id='edFusedBody'></div>")
        +fixSec('dup',
          fixChip('amber','Backup, Then Type MERGE'),
          "Two cards with the same name are usually the same card imported "
          +"twice with different art. This folds each group into one card and keeps <b>every</b> "
          +"distinct image as an alternate-art variant — nothing is deleted that carries a picture "
          +"no other copy has. Rules and stats come from the copy shown as <b>keep</b>. "
          +"Check first; the merge needs a backup and a typed confirmation.",
          fixZone('Look',"<button class='ed2-btn fx-look' onclick='edScanDuplicates()'>Check duplicates</button>")
          +fixZone('Changes Cards',"<button class='ed2-btn warn' onclick='edMergeDuplicates()'>Merge duplicates…</button>",true),
          "<div class='fx-res' id='edDupBody'></div>")
        +fixSec('shape',
          fixChip('blue','Changes Nothing'),
          "Cards whose <b>mana cost, type line and stats</b> are "
          +"identical, whatever they are called — which is how a card added twice "
          +"under two names shows up. The rules text is not part of the match, but a group "
          +"that prints the same rules too is marked, and those come first. "
          +"<b>This changes nothing</b>: some of these are simply different cards built the "
          +"same way. Press a name to look at the card.",
          fixZone('Look',"<button class='ed2-btn fx-look' onclick='edScanShapes()'>Check look-alikes</button>"),
          "<div class='fx-res' id='edShapeBody'></div>")
        +fixSec('shared',
          fixChip('amber','Backup, Then Type SHARE'),
          "A card that is <b>identical</b> across sagas — same name, "
          +"type line, rules, mana cost and stats — should be <b>one record shared by "
          +"both</b>, so editing any of those updates every saga at once and exporting "
          +"either one ships it as it stands. <b>Flavor text, artist and "
          +"distributor stay per saga</b>: each keeps what it printed, and the card "
          +"editor's saga box picks which one you are editing. <b>Revision is one value "
          +"for the whole card</b>: where the copies differ, the kept copy's revision "
          +"stays and the others' are dropped. Art is not part of the "
          +"comparison either — different pictures become alternate-art variants, and no "
          +"image is ever dropped. Cards differing in any of those five stay separate "
          +"per-saga cards and are only reported. Check first; sharing needs a backup and "
          +"a typed confirmation.",
          fixZone('Look',"<button class='ed2-btn fx-look' onclick='edScanShared()'>Check shared cards</button>")
          +fixZone('Changes Cards',"<button class='ed2-btn warn' onclick='edMergeShared()'>Share identical cards…</button>",true),
          "<div class='fx-res' id='edSharedBody'></div>")
        +fixSec('saga',
          fixChip('grey','Changes Cards'),
          '',
          fixZone('Look',"<button class='ed2-btn fx-look' onclick='edScanSagaNames()'>Check</button>")
          +fixZone('Changes Cards',"<button class='ed2-btn warn' onclick='edSagaNamesAll()'>All to the Saga their name says</button>",true),
          "<div class='fx-res' id='edSagaNameBody'></div>")
        /* No Undo for the id pass: stripping the ids made new ones at the next load that match no published card. */
        +fixSec('cid',
          fixChip('blue','Changes Nothing'),
          "Every card carries an id of its own - random, made when the "
          +"card is first made, and never changed. It is what lets a card be renamed or "
          +"re-homed without the app losing track of which card it is.",
          fixZone('Look',"<button class='ed2-btn fx-look' onclick='edCidRefresh()'>Check card ids</button>"),
          "<div class='fx-res' id='edCidBody'></div>")
        +fixSec('orphan',
          fixChip('grey','Keep Only Clears a Flag'),
          "Cards flagged by the older per-saga sync, before sources: "
          +"their saga's file no longer listed them. An update now <b>removes</b> a card its "
          +"publisher deleted, here as everywhere else - unless one update would take away "
          +"more than a tenth of that source's cards (and more than 20), which is treated as "
          +"a broken publish and removes nothing. So this list is normally empty. A card "
          +"still flagged is called out in the deck warnings if a deck uses it; <b>Keep</b> "
          +"just clears the flag.",
          '',
          "<div class='fx-res' id='edOrphanBody'></div>")
        +fixSec('nokw',
          fixChip('blue','Changes Nothing'),
          "Words on keyword lines that are not in the keyword glossary. A keyword line is a rules "
          +"line made only of items of one to three capitalised words, split by commas or “and”, "
          +"each perhaps followed by (…) or a number; an item is left out when it, or its first "
          +"word, is in the glossary, or its first word is an action such as Draw or Gain. It cannot "
          +"see made-up terms inside sentences, like Bond or Mana Pool. Press a name to look at the card.",
          fixZone('Look',"<button class='ed2-btn fx-look' onclick='edScanNotKw()'>Check keyword lines</button>"),
          "<div class='fx-res' id='edNotKwBody'></div>")
        +fixSec('typo',
          fixChip('blue','Changes Nothing'),
          "Rules-text words of five letters or more, used once or twice in the whole catalogue, that "
          +"are one letter away from a word used eight times or more: a letter added, taken out or "
          +"changed, or two letters swapped. Plain endings (s, es, d, ed, ing, r, er) and words in "
          +"card names are left out; [[card links]] are not read. <b>Keep this word</b> hides a word "
          +"for good in this browser. Press a name to look at the card.",
          fixZone('Look',"<button class='ed2-btn fx-look' onclick='edScanTypos()'>Check for typos</button>"),
          "<div class='fx-res' id='edTypoBody'></div>")
        +"<div class='fx-pager' id='edFixPager'></div>"
      +"</div>"
      +"</div></div>";
    document.body.appendChild(ov);
    ov.addEventListener('click',function(ev){ if(ev.target===ov)window.edCloseFix(); });
    try{
      new MutationObserver(function(){
        clearTimeout(_fixPillT); _fixPillT=setTimeout(edFixPills,60);
      }).observe(document.getElementById('edFixMain'),{childList:true,subtree:true});
    }catch(_){}
  }
  ov.style.display='flex';
  edDialogOpen(ov,'Fix',function(){ window.edCloseFix(); });
  window.edFixShow(_fixSel);
  window.edFixRecheck();
  /* a phone opens on the list of tools (cat_mobile.js, HANDOFF §82) */
  if(typeof window.mobOnFix==='function')window.mobOnFix();
};
window.edFixRecheck=function(){
  try{ frScan(); edFrRefresh(); }catch(_){}
  try{ window.edDashMode(_dashMode); }catch(_){}
  try{ window.edRepairFused(true); }catch(_){}
  try{ window.edScanDuplicates(); }catch(_){}
  try{ window.edRenderOrphans(); }catch(_){}
  try{ window.edScanShared(); }catch(_){}
  try{ window.edScanShapes(); }catch(_){}
  try{ window.edCidRefresh(); }catch(_){}
  try{ window.edScanSagaNames(); }catch(_){}
  try{ window.edScanNotKw(); }catch(_){}
  try{ window.edScanTypos(); }catch(_){}
  edFixPills();
};
window.edFixShow=function(id){
  var i=-1; FIX_TOOLS.forEach(function(t,k){ if(t.id===id)i=k; });
  if(i<0)i=0;
  var t=FIX_TOOLS[i]; _fixSel=t.id;
  FIX_TOOLS.forEach(function(x){
    var s=document.getElementById('edFixSec-'+x.id), n=document.getElementById('edFixNav-'+x.id);
    if(s)s.classList.toggle('fx-on',x.id===t.id);
    if(n){ n.classList.toggle('on',x.id===t.id);
      if(x.id===t.id)n.setAttribute('aria-current','true'); else n.removeAttribute('aria-current'); }
  });
  var cr=document.getElementById('edFixCrumb');
  if(cr)cr.innerHTML="<span>"+t.grp+"</span><span class='fx-sep'>›</span><b>"+t.name+"</b>";
  var pg=document.getElementById('edFixPager'), p=FIX_TOOLS[i-1], nx=FIX_TOOLS[i+1];
  if(pg)pg.innerHTML=(p?"<button class='ed2-btn' onclick=\"edFixShow('"+p.id+"')\">"+uiIco('arrow-left')+" "+p.name+"</button>":'')
    +"<span class='fx-grow'></span>"
    +(nx?"<button class='ed2-btn' onclick=\"edFixShow('"+nx.id+"')\">"+nx.name+" "+uiIco('arrow-right')+"</button>":'');
  var m=document.getElementById('edFixMain'); if(m)m.scrollTop=0;
};
function fixCounts(){
  var q=function(f){ try{ return f(); }catch(_){ return null; } };
  return {
    dash:_dashList.length,
    strip:_frList.length,
    essence:q(function(){ return edSplitLocked((window.CARDS||[]).filter(function(c){
      return templateIdFor(c)==='essence-bare' && String(c.ruleText||'').trim(); })).open.length; }),
    fused:q(function(){ var hits=fusedRepairScan();
      var cards=hits.map(function(h){ return h.card; }).filter(function(c,i,a){ return a.indexOf(c)===i; });
      var open={}; edSplitLocked(cards).open.forEach(function(c){ open[c.__id]=1; });
      return hits.filter(function(h){ return open[h.card.__id]; }).length; }),
    dup:q(function(){ return dupGroups().length; }),
    shape:q(function(){ return shapeGroups().length; }),
    shared:q(function(){ return sharedGroups().length; }),
    saga:q(function(){ return sagaNameMismatches().length; }),
    cid:_fixCid,
    orphan:q(function(){ return (window.edOrphans()||[]).length; }),
    nokw:q(function(){ return _statFixLists.nokw.length; }),
    typo:q(function(){ return _statFixLists.typo.length; })
  };
}
var FIX_UNIT={dash:'Found', strip:'Card', essence:'Card', fused:'Stat', dup:'Name', shape:'Group',
  shared:'Card', saga:'Card', cid:'Problem', orphan:'Card', nokw:'Word', typo:'Word'};
function edFixPills(){
  var ov=document.getElementById('edFixOverlay'); if(!ov)return;
  var n=fixCounts(), sum={warn:0, info:0, ok:0};
  FIX_TOOLS.forEach(function(t){
    var v=n[t.id], kind='', text='';
    if(v===null||v===undefined){ kind=''; text='…'; }
    else if(!v){ kind='ok'; text='Clean'; }
    else {
      kind=(t.id==='shape'||t.id==='nokw'||t.id==='typo')?'info':'warn';
      var u=FIX_UNIT[t.id];
      text=v+' '+(u==='Found'?u:(u+(v===1?'':'s')));
    }
    if(kind)sum[kind]++;
    ov.querySelectorAll(".fx-pill[data-fx='"+t.id+"']").forEach(function(p){
      if(p.textContent!==text)p.textContent=text;
      var cls='fx-pill'+(kind?' '+kind:'');
      if(p.className!==cls)p.className=cls;
    });
  });
  var s=document.getElementById('edFixSum');
  if(s){
    var h=(sum.warn?"<span class='fx-pill warn'>"+sum.warn+" Need a Look</span>":'')
      +(sum.info?"<span class='fx-pill info'>"+sum.info+(sum.info===1?" Report":" Reports")+"</span>":'')
      +(sum.ok?"<span class='fx-pill ok'>"+sum.ok+" Clean</span>":'');
    if(s.innerHTML!==h)s.innerHTML=h;
  }
}
window.edCidRefresh=function(){
  var host=document.getElementById('edCidBody'); if(!host)return;
  host.innerHTML="<i class='tpl-hint'>Reading the store\u2026</i>";
  return window.edCidReport().then(function(r){
    var ok=!r.dupLive.length&&!r.dupStored.length&&!r.orphans.length&&!r.noId;
    _fixCid=r.dupLive.length+r.dupStored.length+r.orphans.length+(r.noId||0);
    var h="<div class='tpl-opts'><b>"+r.cards+"</b> card(s) \u00b7 <b>"+r.withCid+"</b> of "
      +r.stored+" stored record(s) carry an id"
      +(r.when?(" \u00b7 written "+e(String(r.when).slice(0,10))):'')+"</div>";
    if(ok){
      h+="<i class='tpl-hint'>Every card has an id of its own, no two share one, and every "
        +"stored record still points at a card.</i>";
    } else {
      if(r.noId)h+="<div class='shr-warn'><b>"+r.noId+" card(s) have no id yet.</b></div>";
      if(r.dupLive.length)h+="<div class='shr-warn'><b>"+r.dupLive.length
        +" pair(s) of cards share an id.</b> That means two cards the app cannot tell "
        +"apart \u2014 same saga and same name. They are listed in Duplicate cards above.</div>";
      if(r.dupStored.length)h+="<div class='shr-warn'><b>"+r.dupStored.length
        +" stored record(s) share an id with another.</b></div>";
      if(r.orphans.length)h+="<div class='shr-warn'><b>"+r.orphans.length
        +" stored record(s) point at no card.</b> Saved edits for cards that are not in "
        +"the catalogue any more \u2014 nothing is lost, they are simply not in use.</div>";
      var list=r.dupLive.concat(r.dupStored).slice(0,12);
      if(list.length)h+="<div class='dup-list'>"+list.map(function(x){
        return "<div class='dup-row'><b>"+e(x.a)+"</b><i>and</i><b>"+e(x.b)+"</b>"
          +"<span class='shp-rules'>"+e(x.id)+"</span></div>"; }).join('')+"</div>";
    }
    host.innerHTML=h;
    return r;
  }).catch(function(err){
    host.innerHTML="<i class='tpl-hint warn'>Could not read the store: "
      +e((err&&err.message)||err)+"</i>";
  });
};
window.edCloseFix=function(){var ov=document.getElementById('edFixOverlay');
  if(ov){ ov.style.display='none'; edDialogClose(ov); } };

window.edOpenTemplates=function(){
  var ov=document.getElementById('edTplOverlay');
  if(!ov){
    ov=document.createElement('div'); ov.id='edTplOverlay'; ov.className='ed2-overlay';
    ov.innerHTML="<div class='ed2-modal'><div class='ed2-modal-head wh'>"
      +"<b class='wh-t'>Adjustments</b>"
      +"<button class='ed2-btn close-x nb nb-red nb-m wh-x' onclick='edCloseTemplates()'>Close &#10005;</button></div>"
      +"<div id='edTplBody' class='ed2-modal-body'></div></div>";
    document.body.appendChild(ov);
    ov.addEventListener('click',function(ev){ if(ev.target===ov)window.edCloseTemplates(); });
  }
  ov.style.display='flex';
  edDialogOpen(ov,'Adjustments',function(){ window.edCloseTemplates(); });
  edTplPanelRefresh();
  packsRefresh().then(edTplPanelRefresh);
};
window.edCloseTemplates=function(){
  var ov=document.getElementById('edTplOverlay');
  if(ov){ ov.style.display='none'; edDialogClose(ov); }
};

function recompute(c){
  var sup=(c.superTypes||[]).map(function(s){return s.toLowerCase();});
  var isEss=sup.indexOf('essence')>=0;
  var cols=isEss?colorsFromEssence(c.subTypes):colorsFromMana(c.manaCost);
  // Object cards carry a dark grey as one of their frame colors.
  if(sup.indexOf('object')>=0 && cols.indexOf('grey')<0) cols.push('grey');
  c.colors=cols;
  c.cmc=computeCmc(c.manaCost);
}
/* A rename moves every [[Old Name]] link, on blur, never per keystroke (edLive runs oninput), and in c.sections itself, as cardSections() returns copies.
   Matched as cardLinkFind matches (case and apostrophes ignored) and written exactly, so a drifted link is repaired too. */
var _edNameWas = null, _edNameWasId = null;
window.edNameFocus=function(){
  var c=curCard();
  _edNameWas = c ? String(c.name||'') : null;
  _edNameWasId = c ? c.__id : null;
};
function edRelinkName(oldName, newName){
  var norm=function(s){ return String(s||'').toLowerCase().replace(/[’']/g,'').trim(); };
  var want=norm(oldName);
  if(!want || !String(newName||'').trim() || want===norm(newName)) return 0;
  var re=/\[\[([^\[\]\n]{1,120})\]\]/g;
  var swap=function(t){
    var hit=false;
    var out=String(t).replace(re,function(m,nm){
      if(norm(nm)!==want) return m;
      hit=true; return '[['+newName+']]';
    });
    return hit?out:null;
  };
  var changed=[];
  edSplitLocked(window.CARDS||[]).open.forEach(function(c){
    if(!c) return;
    var touched=false;
    var n=rulesSplitOf(c);
    if(n && Array.isArray(c.sections)){
      for(var i=0;i<n;i++){
        var s=c.sections[i];
        var o=(s && s.text) ? swap(s.text) : null;
        if(o!=null){ s.text=o; touched=true; }
      }
      if(touched) syncSplitRuleText(c);
    }
    if(!touched){
      var o=c.ruleText ? swap(c.ruleText) : null;
      if(o!=null){ c.ruleText=o; touched=true; }
    }
    if(touched) changed.push(c);
  });
  changed.forEach(function(c){
    markDirty(c);
    try{ persistCard(c); }catch(_){}
  });
  if(changed.length){
    try{ applyToCatalog(); }catch(_){}
    try{ if(typeof scheduleFace==='function') scheduleFace(); }catch(_){}
  }
  return changed.length;
}
window.edRelinkName=edRelinkName;
window.edNameBlur=function(){
  var c=curCard();
  var was=_edNameWas; _edNameWas=null;
  if(!c || was==null || c.__id!==_edNameWasId) return;
  var now=String(c.name||'');
  if(!was.trim() || was===now) return;
  var other=edNameClash(c, now);
  if(other){ edNameClashAsk(c, other, was); return; }
  var n=edRelinkName(was, now);
  if(n) try{ toast('Renamed - updated the link on '+n+' card'+(n===1?'':'s')); }catch(_){}
};
/* One name, one card, in your own sagas only: another creator's card of the same name is theirs. */
function edNameClash(c, name){
  var k=normName(name||''); if(!k) return null;
  return (window.CARDS||[]).filter(function(x){
    return x&&x!==c&&!x.__deleted&&normName(x.name||'')===k
      && sagaIdsOf(x).some(function(id){ return ownsGroupKey(groupKeyOfId(id)); });
  })[0]||null;
}
function edSagaNamesOf(c){
  return sagaIdsOf(c).map(function(id){ var s=sagaById(id); return (s&&s.name)||id; }).join(', ');
}
/* Use that card here moves the memberships only: this card's art, variants and per-saga values are not carried over. */
function edNameClashAsk(c, other, was){
  return window.edChooseModal({
    title:'\u201c'+other.name+'\u201d is already a card in '+edSagaNamesOf(other),
    choices:[{key:'use', label:'Use that card here', warn:true,
              detail:'It joins '+edSagaNamesOf(c)+', and this card is deleted'},
             {key:'keep', label:'Keep \u201c'+was+'\u201d', detail:'The name goes back'}]
  }).then(function(k){
    if(k==='use'){
      sagaIdsOf(c).forEach(function(id){ if(!inSaga(other,id)) addSagaMembership(other,id); });
      markDirty(other);
      var tomb={id:c.id||uid(),__id:c.__id,name:was,cid:cardCid(c),
                sagaId:sagaIdOf(c),saga:c.saga,__deleted:true};
      window.CARDS=(window.CARDS||[]).filter(function(x){ return x!==c; });
      curId=null;
      return Promise.all([persistCard(other),persistCard(tomb)]).then(function(){
        applyToCatalog(); try{ refreshSagaFilter(); }catch(_){}
        toast('\u201c'+other.name+'\u201d is now in '+edSagaNamesOf(other));
        window.edEditCard(other.__id);
      });
    }
    c.name=was;
    var el=document.getElementById('f-name'); if(el) el.value=was;
    markDirty(c); try{ persistCard(c); }catch(_){}
    try{ renderPreview(c); applyToCatalog(); }catch(_){}
  });
}
window.edLive=function(){ var c=curCard(); if(!c)return;
  var g=function(id){var el=document.getElementById(id);return el?el.value:'';};
  /* an official card in a saga of yours: only that saga's own values are written */
  var linked=edLinkedSagas(c).length>0;
  if(!linked){ c.name=g('f-name'); c.manaCost=g('f-mana').trim(); }
  /* Guarded: a split card has no #f-rules, and g() would read '' and wipe its rules; its text is synced by syncSplitRuleText. */
  var _rt=document.getElementById('f-rules');
  if(_rt&&!linked)c.ruleText=_rt.value;
  /* Never c.saga here: the Saga field adds a membership (edAddCardSaga), and writing c.saga per keystroke would move mergeKey on a card with no sagaId. */
  /* Per saga through setSagaField: on a shared card, the saga being edited gets its own flavour and credits. */
  var sid=(typeof window.edEditingSaga==='function')?window.edEditingSaga():null;
  setSagaField(c,sid,'flavor',g('f-flavor'));
  /* revision is shared: onto the card, not through setSagaField */
  if(!linked)c.revision=g('f-rev').trim();
  setSagaField(c,sid,'artist',g('f-artist').trim());
  setSagaField(c,sid,'designer',g('f-designer').trim());
  recompute(c); markDirty(c);
  renderKwBar();
  renderPreview(c);
};
var _dirty={};
/* Opening a card is not editing it: renderFields ends with edLive() to paint the preview, and this keeps that call from marking the card dirty. */
var _liveQuiet=false;
window.edLiveQuiet=function(fn){
  _liveQuiet=true;
  try{ fn(); } finally { _liveQuiet=false; }
};
/* Every change moves _cardGen, edSagaSummary's cache key, and stales a backup proof, so the gate never takes a backup older than the edits (HANDOFF §6). */
var _cardGen=0;
function markDirty(c){ if(_liveQuiet) return; _dirty[c.__id]=true; _cardGen++; bumpCardGen(c);
  /* kept until the card is what its set publishes (ghSettlePublished); a read-only card is changed only by the app itself,
     but for the saga of yours being edited on an official card in it */
  try{ if(!edCardLocked(c)) c._editedHere=1; else edMarkLinkedEdit(c); }catch(_){}
  try{ if(typeof window.edBackupProofStale==='function') window.edBackupProofStale(); }catch(_){}
  try{ edSyncSaveBtns(); }catch(_){}
  autosaveSoon(); }

function edMarkLinkedEdit(c){
  if(curCard()!==c)return;
  var sid=window.edEditingSaga();
  if(edLinkedSagas(c).indexOf(sid)<0)return;
  (c._editedSagas=c._editedSagas||{})[sid]=1;
}

/* Each change is stored half a second after the last, and anything waiting when the tab is hidden or closed; on by default (HANDOFF §12.1).
   It never calls edLive, which marks the card dirty and would schedule the next autosave for ever. */
var AUTOSAVE = true, _autoT = 0;
function autosaveSoon(){
  if(!AUTOSAVE) return;
  clearTimeout(_autoT);
  _autoT = setTimeout(autosaveNow, 500);
}
function autosaveNow(){
  clearTimeout(_autoT); _autoT = 0;
  if(!AUTOSAVE) return Promise.resolve(0);
  var cards = (window.CARDS || []).filter(function(x){ return _dirty[x.__id]; });
  if(!cards.length) return Promise.resolve(0);
  return Promise.all(cards.map(edStoreCard)).then(function(res){
    return res.filter(Boolean).length;
  });
}
window.edAutosaveNow = autosaveNow;
window.edAutosaveOn = function(){ return AUTOSAVE; };
window.edToggleAutosave = function(on){
  AUTOSAVE = (on === undefined) ? !AUTOSAVE : !!on;
  try{ setMetaSafe('autosave', AUTOSAVE, 'the Autosave switch'); }catch(_){}
  var b = document.getElementById('edAutoBtn');
  if(b){ b.classList.toggle('on', AUTOSAVE); b.setAttribute('aria-pressed', AUTOSAVE ? 'true' : 'false'); }
  if(AUTOSAVE) autosaveNow();
  toast(AUTOSAVE ? 'Autosave on - every change is stored as you make it' : 'Autosave off - press Save to store a change');
  return AUTOSAVE;
};
window.edLoadAutosave = function(){
  try{
    return getMeta('autosave').then(function(v){
      AUTOSAVE = (v === false) ? false : true;
      var b = document.getElementById('edAutoBtn');
      if(b){ b.classList.toggle('on', AUTOSAVE); b.setAttribute('aria-pressed', AUTOSAVE ? 'true' : 'false'); }
      return AUTOSAVE;
    }, function(){ return AUTOSAVE; });
  }catch(_){ return Promise.resolve(AUTOSAVE); }
};
document.addEventListener('visibilitychange', function(){ if(document.visibilityState === 'hidden') autosaveNow(); });
addEventListener('pagehide', function(){ autosaveNow(); });

window.edEditCard=function(nameOrId){
  /* First of all: curId still points at the card being left, and storing that card is the point of this call. */
  try{ edSaveLeaving(); }catch(_){}
  ensureIds();
  var c=(window.CARDS||[]).find(function(x){return x.__id===nameOrId||x.name===nameOrId;});
  if(!c){
    c=(window.CARDS||[]).find(function(x){return (x.name||'').toLowerCase()===String(nameOrId).toLowerCase();});
  }
  if(!c)return;
  /* Every way into the editor comes through here, so this one line keeps read-only cards out: all but an official card in a saga of yours. */
  if(!edCardOpenable(c)){ edLockedToast(c); return; }
  if(c.flavor===undefined)c.flavor='';
  if(c.saga===undefined)c.saga=SETINFO.saga||'';
  if(c.revision===undefined)c.revision='';
  if(c.artist===undefined)c.artist=SETINFO.artist||'';
  if(c.designer===undefined)c.designer=SETINFO.designer||'';
  curId=c.__id;
  showTab('editor');
  renderFields();
  edNavSync();
};
window.edCloseEditor=function(){
  try{ edSaveLeaving(); }catch(_){}
  curId=null; showTab('browse'); };

function edNavList(){
  var l=window._allFiltered;
  return (l&&l.length)?l:(window.CARDS||[]);
}
function edNavStep(dir){
  var list=edNavList(); if(!list.length)return;
  var c=curCard(), i=-1;
  if(c)for(var k=0;k<list.length;k++){ if(list[k].__id===c.__id){ i=k; break; } }
  /* Wraps at the ends, and steps over a read-only card: edEditCard will not open one, so the arrows would stop there for good. */
  var start=(i<0)?-dir:i;               /* no card open: the first step lands on 0 */
  for(var n=1;n<=list.length;n++){
    var j=((start+dir*n)%list.length+list.length)%list.length;
    if(edCardOpenable(list[j])){ window.edEditCard(list[j].__id); return; }
  }
  edLockedToast(list[0]);
}
window.edPrevCard=function(){ edNavStep(-1); };
window.edNextCard=function(){ edNavStep(1); };
function edNavSync(){
  var pos=document.getElementById('edNavPos'); if(!pos)return;
  var list=edNavList(), c=curCard(), i=-1;
  if(c)for(var k=0;k<list.length;k++){ if(list[k].__id===c.__id){ i=k; break; } }
  pos.textContent=(i<0)?'':((i+1)+' / '+list.length);
}
window.edNavSync=edNavSync;

addEventListener('keydown',function(ev){
  if(ev.defaultPrevented||ev.ctrlKey||ev.metaKey||ev.altKey||ev.shiftKey)return;
  var back=(ev.key==='ArrowLeft'||ev.key==='ArrowUp');
  var fwd =(ev.key==='ArrowRight'||ev.key==='ArrowDown');
  if(!back&&!fwd)return;
  if(!document.body.classList.contains('editor-active'))return;
  var a=document.activeElement;
  if(a&&(a.isContentEditable||/^(INPUT|TEXTAREA|SELECT|OPTION)$/.test(a.tagName)))return;
  /* An overlay that is showing, not one that exists: the editor's windows are hidden when they close, not removed. */
  if(document.querySelector('.kw-overlay.on, .doc-overlay.on'))return;
  if(Array.prototype.some.call(document.querySelectorAll('.ed2-overlay'),
       function(o){ return o.getClientRects().length>0; }))return;
  ev.preventDefault();
  edNavStep(back?-1:1);
});

/* A card leaves _dirty only once its write has landed, and only if its generation (cardGenOf) has not moved since the write began: a change typed meanwhile is not in the record. */
function edStoreCard(c){
  if(!c) return Promise.resolve(false);
  /* a read-only card's date is its source's, as the rest of its content is: on an official card in a saga of yours only that saga's values changed */
  if(!edLockedSafe(c)) c.lastUpdated=new Date().toISOString().slice(0,10);
  var gen=cardGenOf(c);
  return persistCard(c).then(function(){
    if(cardGenOf(c)!==gen){ try{ edSyncSaveBtns(); }catch(_){} autosaveSoon(); return true; }
    delete _dirty[c.__id];
    /* The buttons are told here, where the count changes: synced at the press, they show the number from before the save. */
    try{ edSyncSaveBtns(); }catch(_){}
    return true;
  }, function(){ try{ edSyncSaveBtns(); }catch(_){} return false; });
}
window.edSave=function(){ var c=curCard(); if(!c)return; edLive();
  var rd=document.getElementById('f-rev-date');
  edStoreCard(c).then(function(okSave){
    if(!okSave) return;                    /* persistCard has already said so */
    if(rd)rd.textContent='\u00b7 '+c.lastUpdated;
    applyToCatalog(); toast('Saved'); edSyncSaveBtns();
  }); };

/* _dirty is every card changed and not stored, as every writer calls markDirty; Save All stores that list. */
window.edSaveAll=function(){
  var c=curCard(); if(c){ try{ edLive(); }catch(_){} }
  var ids=Object.keys(_dirty);
  var cards=(window.CARDS||[]).filter(function(x){ return _dirty[x.__id]; });
  ids.forEach(function(id){
    if(!cards.some(function(x){ return x.__id===id; })) delete _dirty[id];
  });
  if(!cards.length){ toast('Nothing to save'); edSyncSaveBtns(); return; }
  var n=cards.length;
  toast('Saving ' + n + (n===1?' card':' cards') + '\u2026');
  Promise.all(cards.map(edStoreCard)).then(function(res){
    var good=res.filter(Boolean).length;
    var rd=document.getElementById('f-rev-date');
    if(rd&&c)rd.textContent='\u00b7 '+(c.lastUpdated||'');
    applyToCatalog();
    edSyncSaveBtns();
    /* the count is of writes that landed, never of writes asked for */
    toast(good===n ? ('Saved ' + good + (good===1?' card':' cards'))
                   : ('Saved ' + good + ' of ' + n + ' - ' + (n-good) + ' failed'));
  });
};

/* Both doors out of a card (edEditCard, edCloseEditor) store it through here, silently: a failed write still speaks through persistCard. */
function edSaveLeaving(){
  var c=curCard();
  if(!c || !_dirty[c.__id]) return;
  try{ edLive(); }catch(_){}
  edStoreCard(c).then(function(okLeave){ if(okLeave) applyToCatalog(); });
}
window.edSaveLeaving=edSaveLeaving;

function edSyncSaveBtns(){
  var n=(window.CARDS||[]).filter(function(x){ return _dirty[x.__id]; }).length;
  var all=document.getElementById('edSaveAllBtn');
  if(all){
    var cnt=document.getElementById('edSaveAllCount');
    if(cnt){ cnt.textContent = n ? String(n) : ''; cnt.hidden = !n; }
    /* the badge is hidden from screen readers, so the button's name carries the count */
    if(n) all.setAttribute('aria-label', 'Save All (' + n + ')');
    else all.removeAttribute('aria-label');
    all.classList.toggle('ed2-nowt', !n);
    all.title = n ? ('Store every card changed this session - ' + n + ' waiting')
                  : 'Every card you have changed is already stored';
  }
  var one=document.getElementById('edSaveBtn');
  if(one){
    var c=curCard();
    var d=!!(c && _dirty[c.__id]);
    one.classList.toggle('ed2-nowt', !d);
    one.title = d ? 'Store this card' : 'This card is already stored';
  }
}
window.edSyncSaveBtns=edSyncSaveBtns;
window.edDuplicate=function(){ var c=curCard(); if(!c)return;
  /* an official card in a saga of yours: a copy of your own, as the card window's Duplicate makes */
  if(edLinkedSagas(c).length)return window.edDuplicateFromCard(c);
  var copy=JSON.parse(JSON.stringify(c)); copy.__id=uid(); copy.id=uid(); copy.name=(c.name||'Card')+' (copy)';
  /* the clone copied the cid, and two cards cannot share one: the boot merge matches by it */
  copy.cid=newCid();
  var idx=window.CARDS.indexOf(c); window.CARDS.splice(idx+1,0,copy);
  curId=copy.__id; persistCard(copy).then(function(){ renderFields(); applyToCatalog(); toast('Duplicated'); }); };
/* A new store key for every upload: Publish names the uploaded copy after the key (ghLocalArtUploads), so a replaced picture needs a new name. */
/* Stored before the card points at it: a refused write (a full store) puts the old picture back and says why. */
window.edArtUpload=function(file){ var c=curCard(); if(!c||!file)return Promise.resolve(false);
  /* pictures are the card's in every saga it is in */
  if(edCardLocked(c)){ edLockedToast(c); return Promise.resolve(false); }
  return new Promise(function(done){
  var rd=new FileReader(); rd.onload=function(ev){ var d=ev.target.result; var key='userart_'+(c.__id)+'_'+Date.now().toString(36);
    var vt=visualTarget(c), was={art:vt.art,imageUrl:vt.imageUrl};
    vt.art=key; vt.imageUrl=d; ART[key]=d; markDirty(c);
    var _b=dataUrlToBlob(d), w;
    try{ w=_b?artPut(key,_b):put('art',{key:key,dataUrl:d}); }catch(err){ w=Promise.reject(err); }
    renderPreview(c); try{ window.edRenderArtPanel(); }catch(_){}
    w.then(function(){ toast('Art updated'); done(true); }, function(err){
      var why=writeWhy(err);
      if(vt.art===key){ vt.art=was.art; vt.imageUrl=was.imageUrl; markDirty(c); }
      delete ART[key];
      if(curCard()===c){ renderPreview(c); try{ window.edRenderArtPanel(); }catch(_){} }
      var say=function(){
        var room=''; try{ room=edStorageText(); }catch(_){}
        alert('The picture could not be stored in this browser ('+why+'), so the card keeps '
          +'its old one.'+(room?String.fromCharCode(10,10)+room:''));
        done(false);
      };
      try{ edStorageRefresh().then(say,say); }catch(_){ say(); }
    }); };
  rd.onerror=function(){ alert('That picture could not be read.'); done(false); };
  rd.readAsDataURL(file); }); };
window.edArtClear=function(){ var c=curCard(); if(!c)return;
  var vt=visualTarget(c); vt.imageUrl=''; vt.art=''; markDirty(c);
  renderPreview(c); try{ window.edRenderArtPanel(); }catch(_){} };

/* data: and blob: URLs never go into a stored or shipped card (ART holds the bytes, and a blob: URL dies with the page); a relative art/ path must stay (HANDOFF §12.1). */
function volatileUrl(u){ u=String(u||''); return u.indexOf('data:')===0||u.indexOf('blob:')===0; }
function stripArt(c){
  var o=Object.assign({},c); delete o.__id;
  if(volatileUrl(o.imageUrl))o.imageUrl='';
  if(o.variants&&o.variants.length)o.variants=o.variants.map(function(v){
    var w=Object.assign({},v); if(volatileUrl(w.imageUrl))w.imageUrl=''; return w; });
  return o;
}
/* Reports a failed write (put() rejects, and a full store is likely) and returns put's promise unchanged, so the callers' chains behave as before. */
function persistCard(c){
  if(!c.id)c.id=uid();
  var p=put('cards',stripArt(c));
  p.catch(function(err){
    var why=writeWhy(err);
    console.error('persistCard failed for "'+(c&&c.name)+'"',err);
    /* A toast every time and an alert once a session: with only the first failure shown, every later Save on a full store failed silently. */
    try{ toast('NOT saved - ' + why); }catch(_){}
    if(!_saveFailWarned){
      _saveFailWarned=true;
      var say=function(){
        var NL2=String.fromCharCode(10,10), room='';
        try{ room=edStorageText(); }catch(_){}
        alert('A card could not be saved to this browser'+"'"+'s storage.'+NL2
          +'"'+((c&&c.name)||'?')+'" - '+why+NL2
          +'Your change is still on screen but it is NOT stored, and it will be '
          +'gone when you reload. Make a backup before doing anything else: '
          +'Export (at the top of the page), then "Cards only".'
          +(String(why).indexOf('Quota')>=0
            ? NL2+'The store is full. The art held in the editor is the usual cause.'
            : '')
          +(room?NL2+room:''));
      };
      try{ edStorageRefresh().then(say,say); }catch(_){ say(); }
    }
  });
  return p;
}
var _saveFailWarned=false;
/* beforeunload cannot wait for an IndexedDB write, so it does not save: it asks the browser to ask. */
addEventListener('beforeunload', function(ev){
  var n=0;
  try{ n=(window.CARDS||[]).filter(function(x){ return _dirty[x.__id]; }).length; }
  catch(_){ return; }
  if(!n) return;
  ev.preventDefault();
  ev.returnValue='';
  return '';
});
function persistAll(){ ensureIds(); var ps=(window.CARDS||[]).map(persistCard);
  /* art persists via artPut(), not from the ART cache. */
  return Promise.all(ps); }

/* A restore replaces: persistAll only adds, and the boot merge would bring back every record the backup lacks.
   Cleared and refilled in one transaction, so a failure leaves the old records whole; `more` does the same for other stores (sagas, watermarks). */
function storeReplaceAll(cards,more){
  more=more||{};
  var extra=Object.keys(more).filter(function(s){ return Array.isArray(more[s]); });
  return new Promise(function(res,rej){
    var t;
    try{
      if(!_db)throw new Error('the saved cards are not open in this tab - reload it');
      t=_db.transaction(['cards'].concat(extra),'readwrite');
      var cs=t.objectStore('cards'); cs.clear();
      (cards||[]).forEach(function(c){ if(!c.id)c.id=uid(); cs.put(stripArt(c)); });
      extra.forEach(function(s){
        var st=t.objectStore(s); st.clear();
        more[s].forEach(function(r){ st.put(r); });
      });
    }catch(err){ try{ if(t)t.abort(); }catch(_){} rej(err); return; }
    t.oncomplete=function(){ res((cards||[]).length); };
    t.onabort=function(){ rej(t.error||new Error('the new records were not stored')); };
  });
}

/* The generation moves first, so whatever the redraw reads is rebuilt, not served from a cache made before the change. */
function applyToCatalog(){ bumpCardGen(); try{ if(typeof window.run==='function')window.run(); }catch(_){} scheduleFace(); }
/* The deck warnings are first worked out at parse time, with no cards loaded, so they are asked again whenever the catalogue arrives. */
function edRefreshDeckSide(){
  try{
    var ta=(typeof window.getActiveDeck==='function')?window.getActiveDeck():null;
    if(ta&&String(ta.value||'').trim()){
      if(typeof window.updateDeckWarnings==='function')window.updateDeckWarnings();
      if(typeof window.updateStatSummary==='function')window.updateStatSummary();
    }
  }catch(_){}
}

/* mergeKey is built on this, so a change re-keys every record with no cid; tools/rebuild_from_set.py mirrors it. */
function normName(s){return (s||'').toLowerCase().replace(/[\u2018\u2019']/g,'').replace(/\s+/g,' ').trim();}

/* The spreadsheet and both backups' cards.csv are built from these columns alone, so they cannot drift apart.
   Only the printed card's columns, on purpose: the sheet is for other tools, and every field of every card travels in a backup's backup.json. */
var EXPORT_COLS=['Name','Mana Cost','CMC','Color','Super Type','Sub Type','Attack','Health','Arcane','Range',
                 'Rule Text','Flavor','Saga','Revision','Artist','Designer'];
/* Derived from the names, never positions: a column inserted before them would escape the wrong columns in every exporter. */
var EXPORT_MULTILINE=EXPORT_COLS.reduce(function(m,name,i){
  if(name==='Rule Text'||name==='Flavor')m[i]=1; return m; }, {});

/* Every export writes through dlBlob, dl and csvCell: grep for all three before removing an exporter (HANDOFF §12.1). */
function dlBlob(name,blob){
  var u=URL.createObjectURL(blob), a=document.createElement('a');
  a.href=u; a.download=name; a.style.display='none';
  document.body.appendChild(a); a.click();
  /* A minute, not a tick: a multi-gigabyte backup is still being read out of this URL long after the click returns. */
  setTimeout(function(){ URL.revokeObjectURL(u); a.remove(); }, 60000);
}
function dl(name,text,mime){
  dlBlob(name, new Blob([text], {type:(mime||'text/plain')+';charset=utf-8'}));
}
function csvCell(v){
  v=(v==null?'':String(v));
  return /[",\n\r]/.test(v) ? '"'+v.replace(/"/g,'""')+'"' : v;
}

/* From the orbs, encoded as syncLegacyStats does, on a copy: published cards carry fused stats in orbs[] with the flat arcane blank. */
function exportStats(c){
  if(!Array.isArray(c.orbs))return [c.attack,c.health,c.arcane,c.range||''];
  var t={orbs:cardOrbs(c)}; syncLegacyStats(t);
  return [t.attack,t.health,t.arcane,t.range];
}
function cardRows(list){
  return (list||window.CARDS||[]).map(function(c){
    var st=exportStats(c);
    var color=(c.colors||[]).map(function(x){return x.charAt(0).toUpperCase()+x.slice(1);}).join(', ');
    return [c.name,c.manaCost,c.cmc,color,(c.superTypes||[]).join(' '),(c.subTypes||[]).join(' '),
            st[0],st[1],st[2],st[3],
            (typeof window.cardPlainRules==='function'
              ? window.cardPlainRules(c) : (c.ruleText||'')),
            c.flavor||'',
            c.saga||'',c.revision||'',c.artist||'',c.designer||''];
  });
}

/* Inline strings, not a sharedStrings table, with nothing to keep in step; clean numbers as numbers, so Excel sorts them as numbers. */
function xmlEsc(s){ return String(s==null?'':s)
  .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;')
  .replace(/"/g,'&quot;')
  /* control chars are illegal in XML 1.0 and make Excel refuse the file */
  .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g,''); }
function colName(n){ var s=''; n++; while(n>0){ var m=(n-1)%26; s=String.fromCharCode(65+m)+s; n=(n-m-1)/26; } return s; }
function isNumeric(v){ return v!=='' && v!=null && /^-?\d+(\.\d+)?$/.test(String(v).trim()); }
function sheetXml(cols,rows){
  var out=['<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    +'<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">'
    +'<sheetViews><sheetView workbookViewId="0">'
    +'<pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>'
    +'</sheetView></sheetViews><sheetData>'];
  function cell(ref,v){
    if(isNumeric(v)) return '<c r="'+ref+'"><v>'+String(v).trim()+'</v></c>';
    if(v==null||v==='') return '';
    return '<c r="'+ref+'" t="inlineStr"><is><t xml:space="preserve">'+xmlEsc(v)+'</t></is></c>';
  }
  out.push('<row r="1">'+cols.map(function(h,i){return cell(colName(i)+'1',h);}).join('')+'</row>');
  rows.forEach(function(r,ri){
    var rn=ri+2;
    out.push('<row r="'+rn+'">'+r.map(function(v,i){return cell(colName(i)+rn,v);}).join('')+'</row>');
  });
  out.push('</sheetData><autoFilter ref="A1:'+colName(cols.length-1)+(rows.length+1)+'"/></worksheet>');
  return out.join('');
}
window.edExportXlsx=function(list,fileName){
  if(typeof JSZip==='undefined'){ alert('Spreadsheet export needs JSZip, which did not load.'); return; }
  toast('Building spreadsheet…');
  var rows=cardRows(Array.isArray(list)?list:null), zip=new JSZip();
  zip.file('[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    +'<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">'
    +'<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>'
    +'<Default Extension="xml" ContentType="application/xml"/>'
    +'<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>'
    +'<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>'
    +'</Types>');
  zip.folder('_rels').file('.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    +'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    +'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>'
    +'</Relationships>');
  var xl=zip.folder('xl');
  xl.file('workbook.xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    +'<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" '
    +'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">'
    +'<sheets><sheet name="Cards" sheetId="1" r:id="rId1"/></sheets></workbook>');
  xl.folder('_rels').file('workbook.xml.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>'
    +'<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">'
    +'<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>'
    +'</Relationships>');
  xl.folder('worksheets').file('sheet1.xml',sheetXml(EXPORT_COLS,rows));
  return zip.generateAsync({type:'blob',compression:'DEFLATE'}).then(function(blob){
    dlBlob(fileName||'conjure_cards.xlsx',blob);
    toast('Exported '+rows.length+' cards to spreadsheet');
  }).catch(function(e){ alert('Spreadsheet export failed: '+(e&&e.message||e)); });
};
/* Anything named _secret_* never leaves this machine: the prefix is the contract, and this enforces it on every export, whatever a future field adds. */
function scrubSecrets(o){
  if(!o||typeof o!=='object')return o;
  Object.keys(o).forEach(function(k){ if(k.indexOf('_secret_')===0)delete o[k]; });
  if(o.settings&&typeof o.settings==='object'){
    Object.keys(o.settings).forEach(function(k){
      if(k.indexOf('_secret_')===0)delete o.settings[k]; });
  }
  return o;
}
/* What a backup holds is listed in HANDOFF §7.5: settings carries the template assets and custom keywords, packs every named look, and game is what the wrong-game refusal reads. */
function backupPayload(){
  var p={version:5, game:backupGameHere(), exported:new Date().toISOString(),
          setInfo:SETINFO, settings:currentSettingsBody(),
          sagas:(typeof SAGAS!=='undefined')?SAGAS:[],
          marks:(typeof MARKS!=='undefined')?MARKS:[],
          packs:(typeof PACKS!=='undefined')?PACKS:[],
          cards:(window.CARDS||[]).map(function(c){
            var o=Object.assign({},c); delete o.__id; return o; })};
  /* Rebirth: the DM's saved maps and Master notes; a zip carries the maps' pictures beside them, in mappics/ */
  var rb=(window.REBIRTH&&typeof window.tdMapsForBackup==='function')?window.tdMapsForBackup():null;
  if(rb) p.rbmaps=rb;
  return scrubSecrets(p);
}
/* Each picture under a saved map, as the text it is kept as (tdGfPicsOf, cat_rbgrid.js), under its own name. */
function _backupMapPics(zip){
  if(!window.REBIRTH||typeof window.tdMapsLoad!=='function'||typeof window.tdGfPicsOf!=='function') return Promise.resolve(0);
  var maps=window.tdMapsLoad();
  if(!maps.length) return Promise.resolve(0);
  return new Promise(function(res){ window.tdGfPicsOf(maps,res); }).then(function(pics){
    var ids=Object.keys(pics||{}), n=0;
    return ids.reduce(function(pr,id){
      return pr.then(function(){ return zip.add('mappics/'+id,pics[id]).then(function(){ n++; }); });
    },Promise.resolve()).then(function(){ return n; });
  });
}
/* Adds, as packs do: a map of the backup's replaces the one of its name here, and every other map stays. */
function _restoreMaps(rb,z){
  if(!rb||typeof window.tdMapsRestore!=='function') return null;
  var ents=z.entries.filter(function(e){ return /^mappics\/p[0-9a-f]{8,24}$/.test(e.name); }), pics={};
  return ents.reduce(function(pr,ent){
    return pr.then(function(){ return z.text(ent).then(function(t){ pics[ent.name.slice(8)]=t; }); });
  },Promise.resolve()).then(function(){ return window.tdMapsRestore(rb,pics); });
}
/* By name, adding: a pack replaces one of its name only, and a backup before version 5 has none and must not wipe them. */
function _restorePacks(packs){
  if(!Array.isArray(packs)||!packs.length) return null;
  return Promise.all(packs.map(function(p){ return put('packs',p); }))
    .then(function(){ try{ return packsRefresh(); }catch(_){ return null; } });
}
/* Never built in memory: a Blob from IndexedDB is a handle on disk and a Blob of Blobs references them, so the archive is headers plus references, and each entry needs only its CRC-32, read a chunk at a time.
   Stored, never deflated (the pictures do not shrink), and ZIP64 past 4 GB; force64 writes the ZIP64 records on a tiny archive for the checks. */
var _crcTable=null;
function crcTable(){
  if(_crcTable) return _crcTable;
  var t=new Int32Array(256);
  for(var n=0;n<256;n++){
    var c=n;
    for(var k=0;k<8;k++) c=(c&1)?(0xEDB88320^(c>>>1)):(c>>>1);
    t[n]=c;
  }
  return (_crcTable=t);
}
function crcUpdate(crc,u8){
  var t=crcTable();
  for(var i=0,n=u8.length;i<n;i++) crc=t[(crc^u8[i])&255]^(crc>>>8);
  return crc;
}
function crcOfBlob(blob,onBytes){
  var crc=-1, rd=blob.stream().getReader();
  function pump(){
    return rd.read().then(function(r){
      if(r.done) return (crc^-1)>>>0;
      crc=crcUpdate(crc,r.value);
      if(onBytes) onBytes(r.value.length);
      return pump();
    });
  }
  return pump();
}
var ZIP_MAX32=0xFFFFFFFF, ZIP_MAX16=0xFFFF;
function _zSet64(dv,o,n){
  dv.setUint32(o, n%4294967296, true);
  dv.setUint32(o+4, Math.floor(n/4294967296), true);
}
function _zGet64(dv,o){
  return dv.getUint32(o,true) + dv.getUint32(o+4,true)*4294967296;
}
function _zDos(d){
  return {
    time:((d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1))&0xFFFF,
    date:((((d.getFullYear()-1980)&127)<<9)|((d.getMonth()+1)<<5)|d.getDate())&0xFFFF
  };
}
function ZipOut(opts){
  this.parts=[]; this.cd=[]; this.pos=0;
  this.force64=!!(opts&&opts.force64);
  this.dos=_zDos(new Date());
  this.enc=new TextEncoder();
}
ZipOut.prototype.add=function(name,data,onBytes){
  var self=this;
  var blob=(data instanceof Blob)?data:new Blob([String(data==null?'':data)]);
  return crcOfBlob(blob,onBytes).then(function(crc){ self._put(name,blob,crc); });
};
ZipOut.prototype._put=function(name,blob,crc){
  var nm=this.enc.encode(name), size=blob.size, off=this.pos;
  var big=this.force64||size>=ZIP_MAX32;
  var ex=big?20:0;
  var h=new Uint8Array(30+nm.length+ex), dv=new DataView(h.buffer);
  dv.setUint32(0,0x04034b50,true);
  dv.setUint16(4,big?45:20,true);
  dv.setUint16(6,0x0800,true);             /* names are UTF-8 */
  dv.setUint16(8,0,true);
  dv.setUint16(10,this.dos.time,true);
  dv.setUint16(12,this.dos.date,true);
  dv.setUint32(14,crc,true);
  dv.setUint32(18,big?ZIP_MAX32:size,true);
  dv.setUint32(22,big?ZIP_MAX32:size,true);
  dv.setUint16(26,nm.length,true);
  dv.setUint16(28,ex,true);
  h.set(nm,30);
  if(big){
    var o=30+nm.length;
    dv.setUint16(o,0x0001,true); dv.setUint16(o+2,16,true);
    _zSet64(dv,o+4,size); _zSet64(dv,o+12,size);
  }
  this.parts.push(h,blob);
  this.pos+=h.length+size;
  this.cd.push({nm:nm,crc:crc,size:size,off:off});
};
ZipOut.prototype.finish=function(){
  var f64=this.force64, cdStart=this.pos, cdParts=[], cdSize=0;
  this.cd.forEach(function(e){
    var needSize=f64||e.size>=ZIP_MAX32, needOff=f64||e.off>=ZIP_MAX32;
    var exLen=(needSize||needOff)?4+(needSize?16:0)+(needOff?8:0):0;
    var h=new Uint8Array(46+e.nm.length+exLen), dv=new DataView(h.buffer);
    var ver=(needSize||needOff)?45:20;
    dv.setUint32(0,0x02014b50,true);
    dv.setUint16(4,ver,true);  dv.setUint16(6,ver,true);
    dv.setUint16(8,0x0800,true); dv.setUint16(10,0,true);
    dv.setUint16(12,this.dos.time,true); dv.setUint16(14,this.dos.date,true);
    dv.setUint32(16,e.crc,true);
    dv.setUint32(20,needSize?ZIP_MAX32:e.size,true);
    dv.setUint32(24,needSize?ZIP_MAX32:e.size,true);
    dv.setUint16(28,e.nm.length,true);
    dv.setUint16(30,exLen,true);
    /* comment, disk, internal and external attributes all stay 0 */
    dv.setUint32(42,needOff?ZIP_MAX32:e.off,true);
    h.set(e.nm,46);
    if(exLen){
      var o=46+e.nm.length;
      dv.setUint16(o,0x0001,true); dv.setUint16(o+2,exLen-4,true); o+=4;
      if(needSize){ _zSet64(dv,o,e.size); _zSet64(dv,o+8,e.size); o+=16; }
      if(needOff){ _zSet64(dv,o,e.off); }
    }
    cdParts.push(h); cdSize+=h.length;
  },this);
  var n=this.cd.length, tail=[];
  var need64=f64||n>=ZIP_MAX16||cdStart>=ZIP_MAX32||cdSize>=ZIP_MAX32;
  if(need64){
    var z=new Uint8Array(56+20), zv=new DataView(z.buffer), at=cdStart+cdSize;
    zv.setUint32(0,0x06064b50,true);
    _zSet64(zv,4,44);
    zv.setUint16(12,45,true); zv.setUint16(14,45,true);
    /* this disk, the directory's disk: both 0 */
    _zSet64(zv,24,n); _zSet64(zv,32,n);
    _zSet64(zv,40,cdSize); _zSet64(zv,48,cdStart);
    zv.setUint32(56,0x07064b50,true);
    _zSet64(zv,64,at);
    zv.setUint32(72,1,true);
    tail.push(z);
  }
  var eo=new Uint8Array(22), ev=new DataView(eo.buffer);
  ev.setUint32(0,0x06054b50,true);
  ev.setUint16(8,need64?ZIP_MAX16:n,true);
  ev.setUint16(10,need64?ZIP_MAX16:n,true);
  ev.setUint32(12,need64?ZIP_MAX32:cdSize,true);
  ev.setUint32(16,need64?ZIP_MAX32:cdStart,true);
  tail.push(eo);
  return new Blob(this.parts.concat(cdParts,tail),{type:'application/zip'});
};

/* Reads a zip without loading it (JSZip.loadAsync takes the whole file into one ArrayBuffer): the directory, then each entry as a slice; DEFLATE too, as old backups used it. */
function _zRead(file,start,len){
  return file.slice(start,start+len).arrayBuffer().then(function(b){ return new DataView(b); });
}
function zipOpen(file){
  var size=file.size, tailLen=Math.min(size,65536+22);
  return _zRead(file,size-tailLen,tailLen).then(function(tv){
    var eo=-1;
    for(var i=tailLen-22;i>=0;i--){ if(tv.getUint32(i,true)===0x06054b50){ eo=i; break; } }
    if(eo<0) throw new Error('not a zip file (no end-of-archive record)');
    var n=tv.getUint16(eo+10,true), cdSize=tv.getUint32(eo+12,true), cdOff=tv.getUint32(eo+16,true);
    var lo=eo-20;
    if(lo>=0 && tv.getUint32(lo,true)===0x07064b50){
      var z64=_zGet64(tv,lo+8);
      return _zRead(file,z64,56).then(function(zv){
        if(zv.getUint32(0,true)!==0x06064b50) throw new Error('damaged ZIP64 record');
        return {n:_zGet64(zv,32), cdSize:_zGet64(zv,40), cdOff:_zGet64(zv,48)};
      });
    }
    return {n:n, cdSize:cdSize, cdOff:cdOff};
  }).then(function(end){
    return _zRead(file,end.cdOff,end.cdSize).then(function(cv){
      var out=[], o=0, dec=new TextDecoder('utf-8');
      for(var k=0;k<end.n;k++){
        if(cv.getUint32(o,true)!==0x02014b50) throw new Error('damaged central directory');
        var method=cv.getUint16(o+10,true), csize=cv.getUint32(o+20,true),
            usize=cv.getUint32(o+24,true), nl=cv.getUint16(o+28,true),
            xl=cv.getUint16(o+30,true), cl=cv.getUint16(o+32,true),
            off=cv.getUint32(o+42,true);
        var name=dec.decode(new Uint8Array(cv.buffer,cv.byteOffset+o+46,nl));
        var x=o+46+nl, xe=x+xl;
        while(x+4<=xe){
          var id=cv.getUint16(x,true), len=cv.getUint16(x+2,true), p=x+4;
          if(id===0x0001){
            if(usize===ZIP_MAX32){ usize=_zGet64(cv,p); p+=8; }
            if(csize===ZIP_MAX32){ csize=_zGet64(cv,p); p+=8; }
            if(off===ZIP_MAX32){ off=_zGet64(cv,p); p+=8; }
          }
          x+=4+len;
        }
        out.push({name:name, method:method, csize:csize, usize:usize, off:off});
        o=xe+cl;
      }
      return {
        entries:out,
        get:function(nm){ for(var i=0;i<out.length;i++) if(out[i].name===nm) return out[i]; return null; },
        blob:function(ent){ return zipEntryBlob(file,ent); },
        text:function(ent){ return zipEntryBlob(file,ent).then(function(b){ return b.text(); }); }
      };
    });
  });
}
function zipEntryBlob(file,ent){
  return _zRead(file,ent.off,30).then(function(lv){
    if(lv.getUint32(0,true)!==0x04034b50) throw new Error('damaged entry: '+ent.name);
    var start=ent.off+30+lv.getUint16(26,true)+lv.getUint16(28,true);
    var raw=file.slice(start,start+ent.csize);
    if(ent.method===0) return raw;
    if(ent.method===8){
      if(typeof DecompressionStream!=='function')
        throw new Error('this browser cannot unpack a compressed entry ('+ent.name+')');
      return new Response(raw.stream().pipeThrough(new DecompressionStream('deflate-raw'))).blob();
    }
    throw new Error('unsupported compression method '+ent.method+' in '+ent.name);
  });
}

/* Stays up until the job is done: toast() hides itself after two seconds. */
function busyShow(msg,onCancel){
  var b=document.getElementById('edBusy');
  if(!b){
    b=document.createElement('div'); b.id='edBusy'; b.className='ed-busy';
    b.setAttribute('role','status');
    var s=document.createElement('span'); s.className='ed-busy-msg'; b.appendChild(s);
    document.body.appendChild(b);
  }
  b.querySelector('.ed-busy-msg').textContent=msg;
  if(onCancel && !b.querySelector('button')){
    var x=document.createElement('button');
    x.className='ed2-btn nb nb-red nb-s close-x'; x.textContent='Close ✕';
    x.onclick=function(){ x.disabled=true; x.textContent='Stopping…'; onCancel(); };
    b.appendChild(x);
  }
}
function busyDone(){ var b=document.getElementById('edBusy'); if(b) b.remove(); }
function fmtBytes(n){
  return n>=1073741824 ? (n/1073741824).toFixed(2)+' GB'
       : n>=1048576 ? (n/1048576).toFixed(1)+' MB'
       : Math.max(1,Math.round(n/1024))+' KB';
}
/* In 32 MB slices, so progress can be told and no more than one slice is in flight. */
function saveBlobTo(handle,blob,name,onBytes){
  if(!handle){ dlBlob(name,blob); return Promise.resolve('download'); }
  return handle.createWritable().then(function(w){
    var at=0, STEP=32*1048576;
    function next(){
      if(at>=blob.size) return w.close();
      var end=Math.min(blob.size,at+STEP), piece=blob.slice(at,end);
      return w.write(piece).then(function(){ if(onBytes) onBytes(end-at); at=end; return next(); });
    }
    return next().catch(function(err){
      try{ w.abort(); }catch(_){}
      throw err;
    });
  }).then(function(){ return 'file'; });
}

/* Only a file written through the save dialog is proof; a download waits for the person's word in the danger gate (HANDOFF §6). */
function backupDone(proof,how,name){
  if(how==='file'){ _backupProof=proof; _backupPending=null; }
  else _backupPending={proof:proof,name:name};
}
function backupPick(opts,fname){
  if(opts.handle) return Promise.resolve(opts.handle);
  if(opts.download || typeof window.showSaveFilePicker!=='function') return Promise.resolve(null);
  try{
    return window.showSaveFilePicker({suggestedName:fname,
      types:[{description:'Zip archive',accept:{'application/zip':['.zip']}}]})
      .catch(function(err){ if(err&&err.name==='AbortError') throw err; return null; });
  }catch(err){ return Promise.resolve(null); }
}
window.edExportBackupData=function(opts){
  opts=(opts&&typeof opts==='object'&&!(typeof Event!=='undefined'&&opts instanceof Event))?opts:{};
  if(typeof JSZip==='undefined'){ alert('Backup needs JSZip, which did not load.'); return Promise.resolve(null); }
  var fname='conjure_cards_'+new Date().toISOString().slice(0,10)+'.zip';
  var pick=backupPick(opts,fname);
  toast('Preparing card backup…');
  var zip=new JSZip();
  var p=backupPayload();
  p.embeddedArt=0;
  p.dataOnly=true;
  zip.file('backup.json', JSON.stringify(p));
  var rows=[EXPORT_COLS.join(',')];
  cardRows().forEach(function(r){
    rows.push(r.map(function(v,i){
      return csvCell(EXPORT_MULTILINE[i]?String(v==null?'':v).replace(/\n/g,'\\n'):v);
    }).join(','));
  });
  zip.file('cards.csv', rows.join('\n'));
  zip.file('README.txt',
    'Conjure catalog backup - CARD DATA ONLY\n'
    +'exported: '+p.exported+'\n'
    +'cards: '+p.cards.length+'\n\n'
    +'This file deliberately contains NO images.\n\n'
    +'Restoring it replaces card data, sagas, watermarks and settings, and\n'
    +'leaves the art store exactly as it is. Pictures come from the art/ folder\n'
    +'beside card_catalog.html, which this zip does not and need not carry.\n');
  var blob=null;
  return pick.then(function(handle){
    return zip.generateAsync({type:'blob',compression:'DEFLATE'}).then(function(b){
      blob=b; return saveBlobTo(handle,blob,fname);
    });
  }).then(function(how){
    /* A card-only backup satisfies the danger gate: no gated operation deletes a picture, and this carries all the card data (HANDOFF §6). */
    backupDone({at:Date.now(),bytes:blob.size,cards:p.cards.length,dataOnly:true},how,fname);
    toast((how==='file'?'Card backup saved (':'Card backup handed to the browser as a download (')
      +Math.round(blob.size/1024)+' KB, '+p.cards.length+' cards)');
    return how;
  }).catch(function(err){
    if(err&&err.name==='AbortError'){ toast('Backup cancelled - nothing was saved'); return null; }
    alert('Card backup failed: '+(err&&err.message||err));
    return null;
  });
};

/* The full backup holds everything but the art/ folder beside the page, which a page cannot read; opts exists only for the checks. */
function _dataUrlBlob(u){
  var m=/^data:([^;,]+)?(;base64)?,(.*)$/.exec(String(u||''));
  if(!m) return null;
  if(!m[2]) return new Blob([decodeURIComponent(m[3])],{type:m[1]||''});
  var bin=atob(m[3]), a=new Uint8Array(bin.length);
  for(var i=0;i<bin.length;i++) a[i]=bin.charCodeAt(i);
  return new Blob([a],{type:m[1]||''});
}
var _backupRun=null;
window.edExportBackupZip=function(opts){
  opts=(opts&&typeof opts==='object'&&!(typeof Event!=='undefined'&&opts instanceof Event))?opts:{};
  if(_backupRun){ toast('A backup is already being written'); return _backupRun; }
  var stamp=new Date().toISOString().slice(0,10);
  var fname=(window.REBIRTH?'conjure_rebirth_backup_':'conjure_backup_')+stamp+'.zip';
  /* The save dialog first, before anything awaits: a browser opens it only while the click is fresh, and measuring the store first can spend that. */
  var pick;
  if(opts.handle) pick=Promise.resolve(opts.handle);
  else if(!opts.download && typeof window.showSaveFilePicker==='function'){
    /* a cancel cancels; any other refusal (a stale click, a policy) falls back to a download */
    try{
      pick=window.showSaveFilePicker({suggestedName:fname,
        types:[{description:'Zip archive',accept:{'application/zip':['.zip']}}]})
        .catch(function(err){ if(err&&err.name==='AbortError') throw err; return null; });
    }catch(err){ pick=Promise.resolve(null); }
  } else pick=Promise.resolve(null);

  var zip=new ZipOut({force64:!!opts.force64}), handle=null, cancelled=false;
  var items=[], unreadable=[], total=0, read=0, embedded=0, mapPics=0, lastPaint=0, finalBlob=null;
  function stop(){ cancelled=true; }
  function paint(msg,force){
    var now=Date.now();
    if(!force && now-lastPaint<250) return;
    lastPaint=now; busyShow(msg,stop);
  }
  function onRead(n){
    read+=n;
    paint('Backing up pictures: '+fmtBytes(read)+' of '+fmtBytes(total)
      +(total?' ('+Math.floor(read*100/total)+'%)':''));
  }

  _backupRun=pick.then(function(h){
    handle=h;
    busyShow('Reading the art store…');
    return getAll('art');
  }).then(function(rows){
    rows.forEach(function(r){
      var b=(r&&r.blob instanceof Blob)?r.blob:(r&&r.dataUrl?_dataUrlBlob(r.dataUrl):null);
      if(b) items.push({key:String(r.key),blob:b}); else if(r) unreadable.push(String(r.key));
    });
    total=items.reduce(function(s,it){ return s+it.blob.size; },0);
    var i=0;
    /* one picture at a time; one the browser cannot read back is left out and named, not allowed to sink the rest */
    function next(){
      if(cancelled) throw {name:'AbortError'};
      if(i>=items.length) return;
      var it=items[i++];
      return zip.add('art/'+it.key,it.blob,onRead).then(function(){ embedded++; },
        function(){ unreadable.push(it.key); })
        .then(next);
    }
    return next();
  }).then(function(){
    paint('Adding the maps\u2019 pictures\u2026',true);
    return _backupMapPics(zip).then(function(n){ mapPics=n; });
  }).then(function(){
    var p=backupPayload();
    p.embeddedArt=embedded;
    if(unreadable.length) p.unreadableArt=unreadable.slice();
    var rows=[EXPORT_COLS.join(',')];
    cardRows().forEach(function(r){
      rows.push(r.map(function(v,i){
        return csvCell(EXPORT_MULTILINE[i]?String(v==null?'':v).replace(/\n/g,'\\n'):v);
      }).join(','));
    });
    var NL=String.fromCharCode(10);
    var readme=['Conjure catalog backup - '+(p.game==='rebirth'?'Conjure Rebirth':'Conjure'),
      'exported: '+p.exported,
      'cards: '+p.cards.length,
      'pictures from the app\'s art store: '+embedded,
      '',
      'backup.json  - every card, saga, watermark, saved look and setting'+(p.rbmaps?', and the saved maps':''),
      'cards.csv    - the same cards, readable in Excel',
      'art/         - every picture stored inside the app, under its own key',
      (p.rbmaps?'mappics/     - the pictures under the saved maps ('+mapPics+'), each as text':null),
      '',
      'Restore it with Import > Full backup > Restore a backup. A restore',
      'REPLACES the catalogue it is restored into.',
      '',
      'The art/ FOLDER beside card_catalog.html is not in this zip - those',
      'pictures are already files on your disk. Keep a copy of that folder',
      'with this file and the two together are everything.'].filter(function(l){ return l!==null; });
    if(unreadable.length){
      readme.push('','THESE '+unreadable.length+' PICTURE(S) COULD NOT BE READ BACK FROM THE',
        'BROWSER AND ARE NOT IN THIS FILE:');
      unreadable.forEach(function(k){ readme.push('  '+k); });
    }
    paint('Adding the card data…',true);
    return zip.add('backup.json',JSON.stringify(p))
      .then(function(){ return zip.add('cards.csv',rows.join(NL)); })
      .then(function(){ return zip.add('README.txt',readme.join(NL)+NL); })
      .then(function(){ return p; });
  }).then(function(p){
    if(cancelled) throw {name:'AbortError'};
    finalBlob=zip.finish();
    var wrote=0, size=finalBlob.size;
    paint(handle?'Writing the backup: 0 of '+fmtBytes(size):'Starting the download…',true);
    return saveBlobTo(handle,finalBlob,fname,function(n){
      if(cancelled) throw {name:'AbortError'};
      wrote+=n;
      paint('Writing the backup: '+fmtBytes(wrote)+' of '+fmtBytes(size)
        +' ('+Math.floor(wrote*100/size)+'%)');
    }).then(function(how){ return {p:p,how:how}; });
  }).then(function(r){
    busyDone();
    /* the only place a full backup's proof is written, after the save, so a failed or cancelled export never reaches it */
    backupDone({at:Date.now(),bytes:finalBlob.size,cards:r.p.cards.length},r.how,fname);
    var msg=(r.how==='file'?'Backup written: ':'Backup handed to the browser as a download: ')
      +fmtBytes(finalBlob.size)+', '+r.p.cards.length+' cards, '
      +embedded+' picture(s)';
    if(unreadable.length){
      alert(msg+'.'+String.fromCharCode(10,10)+unreadable.length
        +' picture(s) could not be read back from the browser and were left out.'
        +' They are listed in the README inside the zip.');
    } else toast(msg);
    return {bytes:finalBlob.size,embedded:embedded,unreadable:unreadable.slice(),how:r.how};
  }).catch(function(err){
    busyDone();
    if(err&&err.name==='AbortError'){ toast('Backup cancelled - nothing was saved'); return null; }
    alert('Backup failed: '+(err&&err.message||err));
    return null;
  }).then(function(v){ _backupRun=null; return v; });
  return _backupRun;
};
window.edBackupBusy=function(){ return !!_backupRun; };

/* zipOpen first, which works at any size; JSZip only for an old DEFLATE backup on a browser without DecompressionStream, and only up to JSZIP_READ_MAX. */
var JSZIP_READ_MAX=400*1048576;
function openBackupZip(f){
  return zipOpen(f).then(function(z){
    var bf=z.get('backup.json');
    if(bf && bf.method!==0 && typeof DecompressionStream!=='function') throw new Error('no DecompressionStream');
    return z;
  }).catch(function(err){
    if(typeof JSZip==='undefined' || f.size>JSZIP_READ_MAX) throw err;
    return JSZip.loadAsync(f).then(function(jz){
      var list=[];
      jz.forEach(function(rel,file){ if(!file.dir) list.push({name:rel}); });
      return {
        entries:list,
        get:function(nm){ return jz.file(nm)?{name:nm}:null; },
        blob:function(ent){ return jz.file(ent.name).async('blob'); },
        text:function(ent){ return jz.file(ent.name).async('string'); }
      };
    });
  });
}
function backupGameHere(){ return window.REBIRTH?'rebirth':'main'; }
/* The wrong-game check comes before the danger gate: typing REPLACE for a file that was never usable spends the person's attention on nothing. */
function _backupGameOf(f){
  return openBackupZip(f).then(function(z){
    var bf=z.get('backup.json');
    if(!bf) return null;
    return z.text(bf).then(function(t){
      try{ return (JSON.parse(t) || {}).game || null; }catch(_){ return null; }
    });
  }).catch(function(){ return null; });
}
window.edRestoreBackupZip=function(input){
  var f=input&&input.files&&input.files[0]; if(!f)return;
  input.value='';
  _backupGameOf(f).then(function(g){
    if(g && g!==backupGameHere()){
      alert('That backup holds '+(g==='rebirth'?'Conjure Rebirth':'Conjure')+' cards,'
        +' and this is '+(backupGameHere()==='rebirth'?'Conjure Rebirth':'Conjure')+'.'
        +String.fromCharCode(10,10)
        +'The two games share no cards, keywords, sagas or art, and a restore'
        +' REPLACES everything here - so nothing was changed. Switch games in the'
        +' header and try again.');
      return;
    }
    _edRestoreGate(f);
  });
};
function _edRestoreGate(f){
  edDangerGate({
    title:'Restore from backup',
    lose:['The current card list - all '+((window.CARDS||[]).length)+' cards',
          'Anything edited or imported since "'+f.name+'" was written',
          'The sagas and watermarks become the file\'s - any made since it was written are removed'],
    phrase:'REPLACE',
    requireBackup:true,
    proceedLabel:'Replace with '+f.name
  }).then(function(ok){ if(ok)_restoreBackupZip(f); else toast('Cancelled - nothing was changed'); });
};
/* Three pictures at a time: all at once held every picture in flight together. */
function _restoreArtEntries(z,list){
  var i=0, done=0, total=list.length, last=0;
  function worker(){
    if(i>=list.length) return Promise.resolve();
    var ent=list[i++];
    return z.blob(ent).then(function(b){ return artPut(ent.name.slice(4),b); }).then(function(){
      done++;
      var now=Date.now();
      if(now-last>250||done===total){ last=now; busyShow('Restoring pictures: '+done+' of '+total); }
      return worker();
    });
  }
  return Promise.all([worker(),worker(),worker()]);
}
/* Checked whole, then the pictures (which only add), then cards, sagas and watermarks replaced in one transaction, and only then shown.
   A backup without a list leaves it alone, and so does an empty saga list: losing the records would lose which source each saga came from. */
function _restoreBackupZip(f){
  var data=null, z=null, cards=null, sagas=null, marks=null, stored=false;
  busyShow('Opening '+f.name+'…');
  return openBackupZip(f).then(function(zz){
    z=zz;
    var bf=z.get('backup.json');
    if(!bf)throw new Error('no backup.json - is this a Conjure backup?');
    return z.text(bf);
  }).then(function(t){
    data=JSON.parse(t);
    if(!data||typeof data!=='object'||!Array.isArray(data.cards))throw new Error('backup has no cards');
    cards=data.cards.filter(function(c){ return c&&typeof c==='object'&&!Array.isArray(c); });
    if(cards.length!==data.cards.length)
      throw new Error((data.cards.length-cards.length)+' entr(ies) in its card list are not cards');
    cards=cards.map(function(c){ var o=Object.assign({},c); o.__id=uid(); if(!o.id)o.id=uid(); return o; });
    if(Array.isArray(data.sagas)&&data.sagas.length){
      sagas=data.sagas.map(sagaRecordClean).filter(Boolean);
      if(sagas.length!==data.sagas.length)
        throw new Error((data.sagas.length-sagas.length)+' saga record(s) in it are not readable');
    }
    if(Array.isArray(data.marks)){
      marks=data.marks.filter(function(m){
        return m&&typeof m==='object'&&typeof m.id==='string'&&m.id; });
      if(marks.length!==data.marks.length)
        throw new Error((data.marks.length-marks.length)+' watermark record(s) in it are not readable');
    }
    var arts=z.entries.filter(function(e){ return /^art\/./.test(e.name) && !/\/$/.test(e.name); });
    return _restoreArtEntries(z,arts);
  }).then(function(){
    busyShow('Restoring cards…');
    var more={}; if(sagas)more.sagas=sagas; if(marks)more.marks=marks;
    return storeReplaceAll(cards,more);
  }).then(function(){
    stored=true;
    window.CARDS=cards;
    if(sagas)SAGAS=sagas;
    if(marks){ MARKS=marks; try{ refreshMarkPicker(); }catch(_){} }
    if(data.setInfo&&typeof data.setInfo==='object')SETINFO=Object.assign(SETINFO,data.setInfo);
    return data.settings?applyPackBody(data.settings):null;
  })
    .then(function(){ return _restorePacks(data.packs); })
    .then(function(){ return _restoreMaps(data.rbmaps,z); })
    .then(function(){ return ensureSagaRecords(); })
    .then(function(){
      busyDone();
      applyToCatalog();
      try{ refreshSagaFilter(); window.edRenderSagaPage(); }catch(_){}
      toast('Restored '+window.CARDS.length+' cards');
      return window.CARDS.length;
    })
    .catch(function(err){ busyDone(); alert('Restore failed: '+(err&&err.message||err)
      +String.fromCharCode(10,10)+(stored
        ?'The cards, sagas and watermarks were restored; the rest of it (the look, saved packs, maps) was not.'
        :'The cards, sagas and watermarks stored here are as they were.')); return null; });
}

function injectEditButtons(){
  ensureIds();
  document.querySelectorAll('#pane-browse .ci-ctl-ed, #pane-deck .ci-ctl-ed').forEach(function(slot){
    if(slot.querySelector('.ci-qedit'))return;
    var node=slot.closest('.ci, tr'); if(!node)return;
    var nm=node.__card ? node.__card.name : ((node.querySelector('.ci-name, .tdnm')||{}).textContent||'');
    var _c=edCardByName(nm);
    if(!_c)return;
    if(!edCardOpenable(_c))return;
    var btn=document.createElement('button');
    btn.className='ci-qedit'; btn.type='button'; btn.title='Edit card'; btn.innerHTML='&#9998;';
    btn.addEventListener('click',function(ev){ ev.stopPropagation();
      var card=edCardByName(nm);
      if(card)window.edEditCard(card.__id);
    });
    slot.appendChild(btn);
  });
}

/* Faces are often built in a hidden pane at width 0, so each wrapper is rescaled when it gets a size. */
var _faceRO=(typeof ResizeObserver!=='undefined')?new ResizeObserver(function(entries){
  entries.forEach(function(en){
    var w=en.contentRect&&en.contentRect.width;
    if(w>0)scaleFaceIn(en.target);
  });
}):null;
function scaleFaceIn(wrap){
  var scaler=wrap.querySelector('.mcard-scale'); if(!scaler)return;
  if(_faceRO&&!wrap.__ro){ wrap.__ro=1; try{ _faceRO.observe(wrap); }catch(_){} }
  var w=wrap.clientWidth||wrap.getBoundingClientRect().width; if(!w)return;
  var s=w/340;
  scaler.style.transform='scale('+s+')';
  var face=scaler.querySelector('.mcard');
  if(!face)return;
  /* Skipped when neither width nor face changed: observe() fires at once; the face is in the test, as a re-render can put another card in at the same width. */
  if(wrap.__fitW===w && wrap.__fitFace===face) return;
  wrap.__fitW=w; wrap.__fitFace=face;
  try{ fitFace(face); }catch(_){}
}
window.edScaleFace=scaleFaceIn;
/* Every grid, not only Browse: the deck view builds its grids from the same .ci/.ci-img markup, all inside a .cg. */
var FACE_GRID_SEL='.cg .ci .ci-img';
function faceGrids(){
  var g=document.querySelectorAll('.cg');
  return g.length?g:[document.getElementById('cg')].filter(Boolean);
}
/* A cached map, not CARDS.find per tile; rebuilt on a change of length or CARD_GEN, as a rename keeps the count. */
var _edNameMap=null, _edNameMapN=-1, _edNameMapG=-1;
function edCardByName(nm){
  var all=(window.CARDS||[]);
  if(!_edNameMap || _edNameMapN!==all.length || _edNameMapG!==(window.CARD_GEN||0)){
    _edNameMap={};
    all.forEach(function(c){ _edNameMap[c.name]=c; });
    _edNameMapN=all.length; _edNameMapG=(window.CARD_GEN||0);
  }
  return _edNameMap[nm];
}
window.edCardByNameInvalidate=function(){ _edNameMap=null; _edNameMapN=-1; _edNameMapG=-1; };

function faceGridTiles(){
  ensureIds();
  document.querySelectorAll(FACE_GRID_SEL).forEach(function(slot){
    if(!slot||!slot.isConnected)return;
    var tile=slot.closest('.ci'); if(!tile)return;
    /* the attribute first: it does not depend on how the heading was escaped */
    var nm=tile.getAttribute('data-cardname')||(tile.querySelector('.ci-name')||{}).textContent||'';
    var card=edCardByName(nm);
    if(!card)return;
    /* the card and its generation: a face drawn before an edit is stale */
    var faced=card.__id+'#'+cardGenOf(card)+'#'+FACE_LOOK_GEN;
    if(slot.getAttribute('data-faced')===faced)return;
    // neutralize any pending image error handlers so they don't fire on detached nodes
    slot.querySelectorAll('img').forEach(function(im){ im.onerror=null; im.removeAttribute('onerror'); });
    slot.setAttribute('data-faced',faced);
    slot.innerHTML="<div class='mcard-fit'><div class='mcard-scale'>"+buildFaceHTML(card,{})+"</div></div>";
    scaleFaceIn(slot.querySelector('.mcard-fit'));
  });
}
/* Takes the card itself, with no DOM lookup and no timer: reading a name back out of the modal's <img> could fail three ways and leave the panel blank. */
function renderCardFaceInto(card,host){
  if(!card||!host)return false;
  /* error handlers off first: one firing after the swap would call _imgErrMdi on a replaced node */
  try{ host.querySelectorAll('img').forEach(function(im){ im.onerror=null; im.removeAttribute('onerror'); }); }catch(_){}
  var html='';
  try{ html=buildFaceHTML(card,{}); }
  catch(err){
    try{ console.error('[conjure] card face failed for "'+(card.name||'?')+'"',err); }catch(_){}
    return false;
  }
  if(!html)return false;
  host.innerHTML="<div class='mcard-fit' style='max-width:340px;margin:0 auto'>"
    +"<div class='mcard-scale'>"+html+"</div></div>";
  try{ scaleFaceIn(host.querySelector('.mcard-fit')); }catch(_){}
  return true;
}
/* Returns false when it cannot draw, so the caller keeps its own markup rather than nothing. */
window.edShowCardFace=function(card,host){
  return renderCardFaceInto(card,host||document.getElementById('mdi'));
};
function faceModal(){
  var mdi=document.getElementById('mdi'); if(!mdi)return;
  if(mdi.querySelector('.mcard'))return;
  var nm=null;
  var img=mdi.querySelector('img[data-cname]'); if(img)nm=img.getAttribute('data-cname');
  if(!nm)return;
  var card=edCardByName(nm);
  if(!card)return;
  renderCardFaceInto(card,mdi);
}
/* Once per animation frame: resize fires dozens of times a second while a window edge is dragged, and each pass refits every visible face. */
var _resizeFitQueued=false;
addEventListener('resize',function(){
  if(_resizeFitQueued)return;
  _resizeFitQueued=true;
  requestAnimationFrame(function(){
    _resizeFitQueued=false;
    document.querySelectorAll('.mcard-fit').forEach(scaleFaceIn);
  });
});
/* a pending error on an image already replaced must not throw on a null parent */
(function(){
  function guard(name){ var orig=window[name];
    if(typeof orig==='function'){ window[name]=function(img){ try{ if(!img||!img.parentNode)return; return orig(img); }catch(_){} }; }
  }
  var t=0,iv=setInterval(function(){ t++; if((window._imgErr&&window._imgErrMdi)||t>40){ guard('_imgErr'); guard('_imgErrMdi'); clearInterval(iv); } },100);
})();
var _faceScheduled=false, _mo=null;
function refreshCatalogVisuals(){
  injectEditButtons();
  faceGridTiles();
}
/* Disconnected around each refresh, or the observer sees its own writes and loops; the data-faced guard settles it even so. */
function _observeGrids(){
  if(!_mo)return;
  var n=0;
  faceGrids().forEach(function(g){ if(g){ _mo.observe(g,{childList:true,subtree:true}); n++; } });
  document.querySelectorAll('#ctb, #pane-deck .ct tbody').forEach(function(tb){
    _mo.observe(tb,{childList:true,subtree:true}); n++; });
  if(!n){ var g=document.querySelector('#pane-browse .grid, #pane-browse');
    if(g)_mo.observe(g,{childList:true,subtree:true}); }
}
function scheduleFace(){
  if(_faceScheduled)return; _faceScheduled=true;
  requestAnimationFrame(function(){ _faceScheduled=false;
    if(_mo)_mo.disconnect();
    try{ refreshCatalogVisuals(); }catch(_){}
    _observeGrids();
  });
}
function watchCatalog(){
  /* here, not beside edWrapHelp in ed2_boot.js: boot() calls this once the catalog is live */
  try{ edWrapDeckWarnings(); }catch(_){}
  if(!faceGrids().length && !document.querySelector('#pane-browse'))return;
  _mo=new MutationObserver(function(){ scheduleFace(); });
  _observeGrids();
  refreshCatalogVisuals();
}

