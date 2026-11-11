/* Loads after cat_core.js and cat_deck.js (DECK_IDS, deckCtrlHTML), in the same global scope. */
var dvActiveTypes = [];

/* Tried in order until a list table fits its page; a table that already fits is left as it was. */
var LIST_FIT_STEPS = ['ct-compact', 'ct-nodate', 'ct-nocolor', 'ct-small'];
function fitListTable(t){
  if(!t || !t.classList.contains('on') || t.style.display === 'none') return;
  var host = t.parentElement; if(!host || !host.clientWidth) return;
  LIST_FIT_STEPS.forEach(function(s){ t.classList.remove(s); });
  var avail = host.clientWidth;
  for(var i = 0; i < LIST_FIT_STEPS.length && t.getBoundingClientRect().width > avail + 1; i++)
    t.classList.add(LIST_FIT_STEPS[i]);
}
function fitListTables(){
  document.querySelectorAll('table.ct.on').forEach(fitListTable);
  _dvStickyVar();
}
/* The headers stick under this page's own sticky controls, not just the app's header, or they slide beneath them. */
function _dvStickyVar(){
  var st = document.querySelector('#pane-deck .dv-sticky');
  if(st && st.offsetHeight) document.documentElement.style.setProperty('--dv-sticky-h', st.offsetHeight + 'px');
}
var _fitListTimer = null;
window.addEventListener('resize', function(){
  clearTimeout(_fitListTimer); _fitListTimer = setTimeout(fitListTables, 150);
});

/* Not counted: a column added to renderDVSection's header must be added here too (12, and 13 with Rebirth's RNG). */
function _dvColCount(){ return REBIRTH ? 13 : 12; }

function toggleDVType(btn) {
  var t = btn.dataset.t;
  var idx = dvActiveTypes.indexOf(t);
  if(idx>=0){ dvActiveTypes.splice(idx,1); btn.classList.remove('on'); }
  else { dvActiveTypes.push(t); btn.classList.add('on'); }
  refreshDeckView();
}

function refreshDeckView(){
  var cardMap={};
  CARDS.forEach(function(c){ cardMap[c.name]=c; });

  /* DECK_IDS has only this game's sections: parseDeckIn on the other game's undefined ids returns nothing, on purpose. */
  var mainRaw    = parseDeckIn(DECK_IDS.main);
  var essRaw     = parseDeckIn(DECK_IDS.essence);
  var wishRaw    = parseDeckIn(DECK_IDS.wish);
  var armRaw     = parseDeckIn(DECK_IDS.armament);

  function toCards(raw){ var out=[]; (raw||[]).forEach(function(e){ var c=cardMap[e.name]; if(c) out.push({card:c,count:e.count,lord:e.lord}); }); return out; }
  var mainDeck = toCards(mainRaw);
  var essDeck  = toCards(essRaw);
  var wishDeck = toCards(wishRaw);
  var armDeck  = toCards(armRaw);

  var hasAny = mainDeck.length || essDeck.length || wishDeck.length || armDeck.length;
  var em=document.getElementById('dv-empty'), ct=document.getElementById('dv-content');
  var tw=document.getElementById('dv-type-wrap');
  /* The checks' harness has no Build Deck markup. */
  if(!em || !ct) return;
  if(!hasAny){
    em.style.display='block'; ct.style.display='none'; if(tw) tw.style.display='none'; dvActiveTypes=[];
    Object.keys(DECK_IDS).forEach(function(k){ var stem=DECK_VIEW_IDS[k];
      renderDVSection([], stem+'-cg', stem+'-ct', stem+'-ctb', (k==='main'?null:stem+'-hdr'), null, DECK_IDS[k]); });
    var hc=document.getElementById('hlCount'); if(hc) hc.textContent='';
    if(typeof mobOnDeckRender === 'function') mobOnDeckRender();
    return;
  }
  em.style.display='none'; ct.style.display='';

  var superSet={}, subSet={};
  mainDeck.concat(essDeck, wishDeck, armDeck).forEach(function(entry){
    _catArr(entry.card.superTypes).forEach(function(t){superSet[t]=(superSet[t]||0)+entry.count;});
    _catArr(entry.card.subTypes).forEach(function(t){subSet[t]=(subSet[t]||0)+entry.count;});
  });
  if(tw){ tw.style.display = hasAny ? '' : 'none'; }
  var superBtns=document.getElementById('dv-super-btns'); if(superBtns) superBtns.innerHTML='';
  var subBtns=document.getElementById('dv-sub-btns'); if(subBtns) subBtns.innerHTML='';
  dvActiveTypes=dvActiveTypes.filter(function(t){return t in superSet||t in subSet;});
  function makeTypeBtn(t, count, container){
    var b=document.createElement('button');
    b.type='button'; b.className='dv-tbtn'+(dvActiveTypes.indexOf(t)>=0?' on':'');
    b.dataset.t=t;
    b.innerHTML=e(t)+' <span class="dv-tbtn-count">'+count+'</span>';
    b.addEventListener('click',function(){toggleDVType(b);});
    container.appendChild(b);
  }
  if(superBtns) Object.keys(superSet).sort().forEach(function(t){makeTypeBtn(t,superSet[t],superBtns);});
  if(subBtns)   Object.keys(subSet).sort().forEach(function(t){makeTypeBtn(t,subSet[t],subBtns);});

  var _sectionCards = {main:mainDeck, essence:essDeck, wish:wishDeck, armament:armDeck};
  Object.keys(DECK_IDS).forEach(function(k){
    var stem=DECK_VIEW_IDS[k], list=_sectionCards[k]||[];
    renderDVSection(list, stem+'-cg', stem+'-ct', stem+'-ctb',
                    (k==='main'?null:stem+'-hdr'), null, DECK_IDS[k]);
  });
  _dvVisibleCards = Object.keys(DECK_IDS).reduce(function(a,k){
    return a.concat(_sectionCards[k]||[]); },[]).map(function(e){return e.card;});

  /* As the rules count it: a Kingdoms Lord is not one of the 100 (deckMainCount). */
  var total=deckMainCount(mainDeck, _gameMode);
  var dvInf=document.getElementById('dv-inf');
  if(dvInf){
    /* Entries are {card, count, lord}: the card is on the entry, not looked up by name. */
    var uniqueCount=0;
    mainDeck.forEach(function(entry){
      if(entry.card && _isUniqueCard(entry.card)) uniqueCount+=entry.count;
    });
    /* A part a line beside the Mana Curve (catalog.css), on one line on a phone. */
    var infParts=[total+' cards', mainDeck.length+' diff'].concat(uniqueCount?[uniqueCount+' Uniq']:[]);
    dvInf.innerHTML=infParts.map(function(p,i){
      return (i?'<span class="dv-inf-sep"> &middot; </span>':'')+'<span class="dv-inf-p">'+p+'</span>'; }).join('');
  }

  requestAnimationFrame(function(){
    requestAnimationFrame(function(){
      fitListTables();
      drawStats(mainDeck, essDeck);
      updateStatSummary();
      updateDeckWarnings();
      renderSavedDecks();
    });
  });
  if(typeof mobOnDeckRender === 'function') mobOnDeckRender();
}

function renderDVSection(deckCards, cgId, ctId, ctbId, hdrId, statsId, deckTaId){
  var g   = document.getElementById(cgId);
  if(g) g.classList.toggle('view-details', curDVView==='details');
  var tb  = document.getElementById(ctbId);
  var hdr = hdrId ? document.getElementById(hdrId) : null;
  var sts = statsId ? document.getElementById(statsId) : null;

  var show = deckCards.length > 0;
  if(hdr) hdr.style.display = show ? '' : 'none';
  if(sts) sts.style.display = show ? '' : 'none';

  var isGrid = curDVView === 'grid' || curDVView === 'details';
  var ct = document.getElementById(ctId);
  if(g)  g.style.display  = (show && isGrid) ? 'grid' : 'none';
  if(ct) ct.style.display = (show && !isGrid) ? '' : 'none';

  /* An emptied section keeps no tiles: hidden ones were still counted by Highlight. */
  if(!show){ if(g) g.innerHTML=''; if(tb) tb.innerHTML=''; return; }
  if(g)  _delegateCardClicks(g,  '.ci', null);
  if(tb) _delegateCardClicks(tb, 'tr',  null);
  if(g) g.innerHTML = '';
  if(tb) tb.innerHTML = '';

  var dthead = ct ? ct.querySelector('thead tr') : null;
  if(dthead){
    dthead.innerHTML=
      '<th class="th-ctl"></th>'+
      '<th style="width:40px" class="th-date"></th>'+
      makeSortThDV('Name','name')+makeSortThDV('Mana','mana')+makeSortThDV('CMC','cmc')+
      '<th>Color</th>'+makeSortThDV('Super','super')+makeSortThDV('Sub','sub')+
      makeSortThDV('ATK','atk')+makeSortThDV('HP','hp')+makeSortThDV('ARC','arc')+
      (REBIRTH?makeSortThDV('RNG','rng'):'')+makeSortThDV('Rule','rule');
    attachSortListeners(dthead, true);
    updateHeaderIndicators();
  }

  var sortedFiltered = _dvSortWithGrouping(deckCards);
  if(dvActiveTypes.length){
    sortedFiltered = sortedFiltered.filter(function(entry){
      var allT=_catArr(entry.card.superTypes).concat(_catArr(entry.card.subTypes)).map(function(t){return String(t).toLowerCase();});
      return dvActiveTypes.some(function(t){return allT.indexOf(t.toLowerCase())>=0;});
    });
  }
  var isDetails = curDVView === 'details';
  var currentGroup = '__NONE__';

  sortedFiltered.forEach(function(entry){
    var card=entry.card;
    var ss=_catArr(card.superTypes).join(' '), sb=_catArr(card.subTypes).join(' ');

    var grpKey = _dvGroupKey(card);
    if(grpKey !== null && grpKey !== currentGroup){
      currentGroup = grpKey;
      if(g){
        var hdrEl = document.createElement('div');
        hdrEl.className = 'dv-group-hdr';
        hdrEl.textContent = grpKey;
        g.appendChild(hdrEl);
      }
      if(tb){
        var grpTr = document.createElement('tr');
        grpTr.innerHTML = '<td colspan="'+_dvColCount()+'" class="dv-group-hdr" style="grid-column:unset">'+e(grpKey)+'</td>';
        tb.appendChild(grpTr);
      }
    }

    var dvStatStrip=statStripHtmlFor(card);
    var dvStatHtml = dvStatStrip ? '<div style="display:flex;flex-direction:column;align-items:center;justify-content:flex-start;flex-shrink:0;padding-left:6px;margin-top:2px">'+dvStatStrip+'</div>' : '';

    /* The same tile as Browse's: .ci-date for Info, _artSrc's picture (not the bare imageUrl), and deckCtrlHTML's one row of buttons. */
    var bottomArea;
    var dateH = '';
    var dvEssenceArea = _essenceBottomArea(card, isDetails);
    if(dvEssenceArea !== null){
      bottomArea = dvEssenceArea;
    } else if(isDetails){
      var rt = card.ruleText ? fmtRuleInline(card.ruleText) : '';
      bottomArea = '<div class="ci-dt"><div class="ci-dt-rule">'+rt+'</div>'
        +(card.lastUpdated?'<div class="ci-dt-date">'+_fmtDate(card.lastUpdated)+'</div>':'')+'</div>';
    } else {
      var _src2 = _artSrc(card);
      var _onerr2 = _src2 ? ' onerror="_imgErr(this)"' : '';
      dateH=card.lastUpdated?'<div class="ci-date" style="font-family:Crimson Pro,serif;font-size:.7rem;color:var(--td);text-align:center;padding:2px 0">'+_fmtDate(card.lastUpdated)+'</div>':'';
      var imgH=_src2?'<img src="'+e(_src2)+'" alt="" loading="lazy" data-cname="'+e(card.name)+'"'+_onerr2+'>':'<div class="ci-ph">\uD83C\uDCA0</div>';
      bottomArea = '<div class="ci-img">'+imgH+'</div>';
    }
    var ctl = deckCtrlHTML(entry);

    if(g){
      var item=document.createElement('div'); item.className='ci';
      item.dataset.cardname = card.name;
      _cardOpenable(item, card);
      item.innerHTML=
        '<div class="ci-inf" style="display:flex;align-items:flex-start">'+
          '<div style="flex:1;min-width:0">'+
            '<div class="ci-name">'+e(card.name)+'</div>'+
            '<div class="ci-mana">'+renderManaCost(card.manaCost,22)+'</div>'+
            (ss?'<div class="ci-super">'+e(ss)+'</div>':'')+
            (sb?'<div class="ci-sub">'+e(sb)+'</div>':'')+
          '</div>'+
          dvStatHtml+
        '</div>'+
        dateH+
        bottomArea+
        ctl;
      item.__card=card;
      item.__deckTa=deckTaId;
      g.appendChild(item);
    }

    if(tb){
      var superArrDV = _catArr(card.superTypes).map(function(s){return String(s).toLowerCase();});
      var isEssDV = superArrDV.indexOf('essence') >= 0;
      var dvRuleCell;
      if(isEssDV){
        var eiDV = [];
        _catArr(card.subTypes).forEach(function(st){
          var col=_ESSENCE_COLOR_MAP[st], url=col?(CICO[col]||''):'';
          if(url) eiDV.push(manaImg(url,col,18));
        });
        dvRuleCell = eiDV.join('') || '\u2014';
      } else {
        var _rt=stripRuleFmt(card.ruleText);
        var rp=_rt.replace(/\n/g,' ').substring(0,70)+(_rt.length>70?'\u2026':'');
        dvRuleCell = e(rp||'\u2014');
      }
      var tr=document.createElement('tr');
      tr.dataset.cardname = card.name;
      _cardOpenable(tr, card);
      tr.__card=card;
      tr.__deckTa=deckTaId;
      tr.innerHTML=
        '<td class="ci-ladd">'+ctl+'</td>'+
        '<td class="td-date">'+_fmtDateList(card.lastUpdated)+'</td>'+
        '<td class="tdnm">'+e(card.name)+'</td>'+
        '<td>'+renderManaCost(card.manaCost,18)+'</td>'+
        '<td data-val="'+e(card.cmc||'')+'" style="font-weight:700">'+e(card.cmc||'\u2014')+'</td>'+
        '<td>'+cardColorIcons(card,18)+'</td>'+
        '<td class="td-wrap">'+tdClampHTML(ss)+'</td>'+
        '<td class="td-wrap">'+tdClampHTML(sb)+'</td>'+
        (function(_c){return statRowCells(_c).map(function(x){return '<td>'+x+'</td>';}).join('');})(card)+
        '<td class="td-rule">'+dvRuleCell+'</td>';
      tb.appendChild(tr);
    }
  });
  if(isDetails) requestAnimationFrame(function(){ fitDetailsText(); applyHighlight(); });
  else { requestAnimationFrame(function(){ fitCardText(); _syncHideInfo(); if(g) _initGridTilt(g); }); applyHighlight(); }
}


function drawStats(mainCards, essDeck){
  _lockChartWidths();
  var deckCards = mainCards;
  var isLight=document.body.classList.contains('light');
  var textClr=isLight?'#2c2818':'#d4ccbb';
  var gridClr=isLight?'rgba(0,0,0,.1)':'rgba(255,255,255,.1)';

  /* Each bar is stacked by its cards' pips (shared as manaPips shares them), colourless on top, as tall as its count (HANDOFF §12.1). */
  var cmcKeys=['0','1','2','3','4','5','6','7','8','9+'];
  var cmcVals=cmcKeys.map(function(){ return 0; });
  var cmcShare=cmcKeys.map(function(){ return {}; });
  var cmcCards=cmcKeys.map(function(){ return []; });
  deckCards.forEach(function(e){
    var c=parseInt(e.card.cmc)||0;
    var idx=cmcKeys.indexOf(c>=9?'9+':String(c));
    if(idx<0) return;
    cmcVals[idx]+=e.count;
    cmcCards[idx].push(e);
    var p=manaPips(e.card.manaCost,1), tot=0;
    COLORS.forEach(function(k){ tot+=p[k]||0; });
    if(!tot){ cmcShare[idx].Colorless=(cmcShare[idx].Colorless||0)+e.count; return; }
    COLORS.forEach(function(k){ if(p[k]) cmcShare[idx][k]=(cmcShare[idx][k]||0)+e.count*p[k]/tot; });
  });
  var cmcLess=isLight ? '#13161F' : '#F0EAD8';
  var cmcSegs=cmcShare.map(function(sh){
    return COLORS.filter(function(k){ return sh[k]>0; })
      .map(function(k){ return {fill:PIP_FILL[k]||cmcLess, n:sh[k]}; })
      .concat(sh.Colorless ? [{fill:cmcLess, n:sh.Colorless}] : []);
  });
  _dvCurve={keys:cmcKeys,vals:cmcVals,segs:cmcSegs,cards:cmcCards,text:textClr,grid:gridClr};
  if(_dvCurvePick!==null && !(cmcCards[cmcKeys.indexOf(_dvCurvePick)]||[]).length) _dvCurvePick=null;
  dvCurveDraw();

  var pipC={}; COLORS.forEach(function(c){pipC[c]=0;});
  deckCards.forEach(function(entry){
    var p=manaPips(entry.card.manaCost, entry.count);
    Object.keys(p).forEach(function(c){ pipC[c]=(pipC[c]||0)+p[c]; });
  });
  var pipL=COLORS.filter(function(c){return pipC[c]>0;});
  var pipV=pipL.map(function(c){return Math.round(pipC[c]*10)/10;});
  var pipHex=pipL.map(function(c){return [CHEX[c]||'#888'];});
  drawPieMulti('chart-pips',pipL,pipV,pipHex,textClr,null,'mini');
  drawPipBar('chart-pipbar',pipL,pipV);

  var essEssSec = document.getElementById('dv-ess-stats');
  if(essEssSec) essEssSec.style.display = (essDeck && essDeck.length) ? '' : 'none';
  if(essDeck && essDeck.length && essEssSec){
    var ESSENCE_SUB_COLOR_MAP = {Ire:'Red',Vig:'Orange',Lux:'Yellow',Arch:'Green',Yune:'Blue',Psy:'Indigo',Gris:'Violet'};
    var essC={}; COLORS.forEach(function(c){essC[c]=0;});
    essDeck.forEach(function(entry){
      var superArr=_catArr(entry.card.superTypes).map(function(s){return String(s).toLowerCase();});
      if(superArr.indexOf('essence')<0) return;
      var isDual=superArr.indexOf('dual')>=0;
      _catArr(entry.card.subTypes).forEach(function(st){
        var col=ESSENCE_SUB_COLOR_MAP[st]; if(!col) return;
        essC[col]=(essC[col]||0)+(isDual?entry.count*0.5:entry.count);
      });
    });
    var eL=COLORS.filter(function(c){return essC[c]>0;});
    var eV=eL.map(function(c){return Math.round(essC[c]*10)/10;});
    var eHex=eL.map(function(c){return [CHEX[c]||'#888'];});
    if(eL.length){
      drawPieMulti('chart-esspie',eL,eV,eHex,textClr,null,'mini');
      drawPipBar('chart-essbar',eL,eV);
    }
  }
}


// PIP_FILL/PIP_OUTLINE repeat COLOR_FILL_HEX/COLOR_OUTLINE_HEX (cat_core.js) value for value.
var PIP_FILL    = {Red:'#f9aa8f',Orange:'#e7af83',Yellow:'#fff799',Green:'#9bd3ae',Blue:'#aae0fa',Indigo:'#b298f0',Violet:'#e898de'};
var PIP_OUTLINE = {Red:'#200000',Orange:'#2b1b07',Yellow:'#322d00',Green:'#00160b',Blue:'#061922',Indigo:'#1d0a26',Violet:'#2a000f'};

function drawPipBar(id, labels, values){
  var canvas = document.getElementById(id); if(!canvas) return;
  var dpr = window.devicePixelRatio||1;
  var BAR_H = 52, ICON_R = 16, PAD_TOP = 4, PAD_BOT = 4;
  var H = BAR_H + PAD_TOP + PAD_BOT;

  var SLANT_DEG = 66;
  var slantRad = SLANT_DEG * Math.PI / 180;
  var dx = BAR_H / Math.tan(slantRad);

  var rawW = Math.max(getCanvasW(canvas), 300);
  var W = Math.floor((rawW - Math.ceil(dx)) * 0.9);
  if(W < 100) W = 100;

  var total = values.reduce(function(a,b){return a+b;},0);
  if(!total){
    var W_CANVAS = W + Math.ceil(dx);
    canvas.width = W_CANVAS*dpr; canvas.height = H*dpr;
    canvas.style.width = W_CANVAS+'px'; canvas.style.height = H+'px';
    var ctx = canvas.getContext('2d'); ctx.scale(dpr,dpr);
    ctx.fillStyle='rgba(255,255,255,.3)'; ctx.textAlign='center';
    ctx.font='12px sans-serif'; ctx.fillText('No data', W_CANVAS/2, H/2+4); return;
  }

  // Expand canvas so the right-side slant doesn't clip
  var W_CANVAS = W + Math.ceil(dx);
  canvas.width = W_CANVAS*dpr; canvas.height = H*dpr;
  canvas.style.width = W_CANVAS+'px'; canvas.style.height = H+'px';
  var ctx = canvas.getContext('2d'); ctx.scale(dpr,dpr);

  var fracs = values.map(function(v){ return v/total; });
  var cumW = [0];
  fracs.forEach(function(f){ cumW.push(cumW[cumW.length-1] + f*W); });

  var BY = PAD_TOP;
  var BH = BAR_H;

  labels.forEach(function(color, i){
    var x0 = cumW[i], x1 = cumW[i+1];
    var fill = PIP_FILL[color]  || '#888';
    var outline = PIP_OUTLINE[color] || '#000';

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x0 + dx, BY);
    ctx.lineTo(x1 + dx, BY);
    ctx.lineTo(x1,       BY + BH);
    ctx.lineTo(x0,       BY + BH);
    ctx.closePath();
    ctx.clip();
    ctx.fillStyle = fill;
    ctx.fillRect(0, BY, W_CANVAS, BH);

    var segCx = (x0 + x1)/2 + dx/2;
    var segCy = BY + BH/2;
    var iconUrl = CICO[color]||'';
    if(iconUrl && ICON_IMGS[color] && ICON_IMGS[color].complete && ICON_IMGS[color].naturalWidth>0){
      ctx.save();
      ctx.beginPath(); ctx.arc(segCx, segCy, ICON_R, 0, Math.PI*2); ctx.clip();
      ctx.drawImage(ICON_IMGS[color], segCx-ICON_R, segCy-ICON_R, ICON_R*2, ICON_R*2);
      ctx.restore();
    }

    ctx.restore();

    ctx.strokeStyle = outline;
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(x0+dx, BY);
    ctx.lineTo(x0, BY+BH);
    ctx.stroke();
  });
  var lastOutline = PIP_OUTLINE[labels[labels.length-1]]||'#000';
  ctx.strokeStyle = lastOutline; ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(cumW[labels.length]+dx, BY);
  ctx.lineTo(cumW[labels.length], BY+BH);
  ctx.stroke();


  labels.forEach(function(color, i){
    var pct = Math.round(values[i]/total*100);
    if(pct < 7) return;
    var x0 = cumW[i], x1 = cumW[i+1];
    var segCx = (x0+x1)/2 + dx/2;
    var segCy = BY + BH/2;
    var segW = x1 - x0;
    var outline = PIP_OUTLINE[color]||'#000';

    var labelX = segCx + ICON_R + 5;
    /* Measured, against the slant at the text's foot, where the segment is narrowest: a guess or the top corner let labels run past it. */
    ctx.font = 'bold 20px sans-serif';
    var tw = ctx.measureText(pct+'%').width;
    var edge = x1 + dx * (1 - (BH/2 + 10) / BH);
    if(labelX + tw > edge - 2) return;

    ctx.save();
    ctx.beginPath();
    ctx.moveTo(x0+dx, BY); ctx.lineTo(x1+dx, BY);
    ctx.lineTo(x1, BY+BH); ctx.lineTo(x0, BY+BH); ctx.closePath();
    ctx.clip();

    ctx.fillStyle = outline;
    ctx.font = 'bold 20px sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#000';
    ctx.fillText(pct+'%', labelX, segCy);
    ctx.restore();
  });
}

var _chartResizeTimer = null;
function getCanvasW(canvas){
  var el=canvas.parentElement;
  while(el){ var w=el.clientWidth; if(w>120) return Math.floor(w-28); el=el.parentElement; }
  return 300;
}
function _lockChartWidths(){
  // Despite the name it locks nothing: it starts the ResizeObserver once
  _initChartResizeObserver();
}

var _chartROInited = false;
var _chartRedrawing = false;
function _initChartResizeObserver(){
  if(_chartROInited || typeof ResizeObserver === 'undefined') return;
  _chartROInited = true;
  var statSection = document.querySelector('.stat-section');
  if(!statSection) return;
  var _lastW = statSection.clientWidth;
  var ro = new ResizeObserver(function(entries){
    var newW = statSection.clientWidth;
    if(Math.abs(newW - _lastW) < 6) return;
    _lastW = newW;
    if(_chartRedrawing) return;
    clearTimeout(_chartResizeTimer);
    _chartResizeTimer = setTimeout(function(){
      if(_chartRedrawing) return;
      if(document.getElementById('pane-deck') &&
         document.getElementById('pane-deck').style.display !== 'none'){
        _chartRedrawing = true;
        var mainDeckEl = document.getElementById('dta-main');
        if(mainDeckEl && mainDeckEl.value.trim()){
          refreshDeckView();
        }
        setTimeout(function(){ _chartRedrawing = false; _lastW = statSection.clientWidth; }, 300);
      }
    }, 200);
  });
  ro.observe(statSection);
}


/* The Mana Curve's bars pick their cards (the author, 8 November): a click lists that bar's cards under the chart, as the saga
   Statistics page lists a bar's, and a second click puts the list away. */
var _dvCurve=null, _dvCurvePick=null;
function dvCurveDraw(){
  var d=_dvCurve; if(!d) return;
  drawBarMulticolor('chart-cmc',d.keys,d.vals,d.segs,d.text,d.grid,d.keys.indexOf(_dvCurvePick));
  dvCurveList();
  var cv=document.getElementById('chart-cmc');
  if(cv && !cv._dvPick){
    cv._dvPick=true;
    cv.addEventListener('click',function(ev){
      var i=dvCurveBarAt(cv,ev); if(i<0||!_dvCurve) return;
      var k=_dvCurve.keys[i];
      _dvCurvePick=(_dvCurvePick===k||!_dvCurve.cards[i].length)?null:k;
      dvCurveDraw();
    });
    cv.addEventListener('mousemove',function(ev){
      var i=dvCurveBarAt(cv,ev);
      cv.style.cursor=(i>=0&&_dvCurve&&_dvCurve.cards[i].length)?'pointer':'';
    });
  }
}
/* The bar's whole column counts, its Total above it too; a phone draws the canvas scaled (mobile.css), hence k. */
function dvCurveBarAt(cv,ev){
  var g=cv._bars, r=cv.getBoundingClientRect(); if(!g||!r.width) return -1;
  var k=g.w/r.width, x=(ev.clientX-r.left)*k, y=(ev.clientY-r.top)*k;
  if(y<g.top||y>g.bottom) return -1;
  var i=Math.floor((x-g.left)/g.gap);
  return (i>=0&&i<g.n)?i:-1;
}
function dvCurveList(){
  var host=document.getElementById('dvCmcCards'); if(!host) return;
  var d=_dvCurve, i=d?d.keys.indexOf(_dvCurvePick):-1, list=i>=0?d.cards[i]:[];
  if(!list.length){ host.innerHTML=''; return; }
  var n=list.reduce(function(s,x){ return s+x.count; },0);
  host.innerHTML="<div class='stat-cards'><h4>Cost "+e(d.keys[i])+" — "+n+" card(s)</h4><div class='stat-grid'>"
    +list.map(function(x,ci){
      var c=x.card, sup=_catArr(c.superTypes).join(' '), sub=_catArr(c.subTypes).join(' ');
      var tl=(sup&&sub)?(sup+' — '+sub):(sup||sub);
      var cost=c.manaCost?renderManaCost(c.manaCost,13):'';
      return "<button type='button' class='stat-card' onclick='dvCurveOpen("+ci+")'>"
        +"<span class='sc-name'>"+e(c.name)+"</span>"
        +"<span class='sc-note'>"+x.count+"x</span>"
        +"<span class='sc-cost'>"+cost+"</span>"
        +"<span class='sc-type'>"+e(tl||'—')+"</span>"
      +"</button>"; }).join('')
    +"</div></div>";
}
function dvCurveOpen(ci){
  var d=_dvCurve, i=d?d.keys.indexOf(_dvCurvePick):-1, x=i>=0?d.cards[i][ci]:null;
  if(x&&x.card) openMod(x.card);
}

function drawBarMulticolor(id,labels,values,barColors,textClr,gridClr,sel){
  var canvas=document.getElementById(id); if(!canvas) return;
  var dpr=window.devicePixelRatio||1;
  var W=Math.max(getCanvasW(canvas),220), H=220;
  /* As tall as the numbers when they stand beside it (catalog.css), so the two end level. */
  var side=document.getElementById('statCmcBox');
  if(side && side.offsetHeight>H && Math.abs(side.getBoundingClientRect().top-canvas.parentElement.getBoundingClientRect().top)<1)
    H=side.offsetHeight;
  canvas.width=W*dpr; canvas.height=H*dpr;
  canvas.style.width=W+'px'; canvas.style.height=H+'px';
  var ctx=canvas.getContext('2d'); ctx.scale(dpr,dpr);
  var pad={t:28,r:12,b:54,l:50};
  var cW=W-pad.l-pad.r, cH=H-pad.t-pad.b;
  var max=Math.max.apply(null,values)||1;
  var gap=cW/labels.length, bw=gap*0.65;
  canvas._bars={w:W,left:pad.l,gap:gap,n:labels.length,top:pad.t-20,bottom:H-pad.b+20};
  ctx.font='bold 13px sans-serif';
  var tight=typeof catIsPhone==='function' && catIsPhone() && ctx.measureText('Total '+max).width>gap-2;
  for(var i=0;i<=4;i++){
    var y=pad.t+cH-(i/4*cH);
    ctx.strokeStyle=gridClr; ctx.lineWidth=1;
    ctx.beginPath(); ctx.moveTo(pad.l,y); ctx.lineTo(pad.l+cW,y); ctx.stroke();
    ctx.fillStyle=textClr; ctx.font='bold 13px sans-serif'; ctx.textAlign='right';
    ctx.fillText(Math.round(i/4*max),pad.l-5,y+5);
  }
  labels.forEach(function(lbl,i){
    var x=pad.l+i*gap+(gap-bw)/2;
    var bh=Math.max(values[i]/max*cH,0), by=pad.t+cH-bh;
    var segs=barColors[i];
    if(Array.isArray(segs)){
      var y=pad.t+cH;
      segs.forEach(function(s,j){
        var h=s.n/max*cH;
        ctx.fillStyle=s.fill; ctx.fillRect(x,y-h,bw,h);
        if(j) { ctx.fillStyle='rgba(0,0,0,.35)'; ctx.fillRect(x,y-1,bw,1); }
        y-=h;
      });
    } else {
      ctx.fillStyle=segs||'#7b9cda';
      ctx.fillRect(x,by,bw,bh);
    }
    if(i===sel && values[i]>0){ ctx.strokeStyle=textClr; ctx.lineWidth=2; ctx.strokeRect(x-1,by-1,bw+2,bh+2); }
    ctx.fillStyle=textClr; ctx.textAlign='center'; ctx.font='bold 11px sans-serif';
    ctx.fillText((tight?'':'Cost ')+lbl, x+bw/2, H-pad.b+15);
    if(values[i]>0){
      ctx.font='bold 13px sans-serif';
      ctx.fillText((tight?'':'Total ')+values[i], x+bw/2, by-5);
    }
  });
}

function drawPieMulti(id,labels,values,colorsArr,textClr,cardCounts,squareLegend){
  var canvas=document.getElementById(id); if(!canvas) return;
  var dpr=window.devicePixelRatio||1;

  if(squareLegend==='mini'){
    var S = parseInt(canvas.style.height)||80;
    canvas.width=S*dpr; canvas.height=S*dpr;
    canvas.style.width=S+'px';
    var ctx=canvas.getContext('2d'); ctx.scale(dpr,dpr);
    var total=values.reduce(function(a,b){return a+b;},0);
    if(!total){ return; }
    var r=S/2*0.88, cx=S/2, cy=S/2, start=-Math.PI/2;
    values.forEach(function(v,i){
      if(!v) return;
      var angle=v/total*Math.PI*2;
      ctx.save();
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,r,start,start+angle); ctx.closePath();
      ctx.clip();
      var clrs=colorsArr[i];
      ctx.fillStyle=clrs[0]||'#888';
      ctx.fillRect(cx-r,cy-r,r*2,r*2);
      if(clrs.length===1){
        var cn=null; Object.keys(CHEX).forEach(function(x){ if(CHEX[x]===clrs[0]) cn=x; });
        if(cn && ICON_IMGS[cn] && ICON_IMGS[cn].complete && ICON_IMGS[cn].naturalWidth>0){
          ctx.globalAlpha=0.85;
          ctx.drawImage(ICON_IMGS[cn],cx-r,cy-r,r*2,r*2);
          ctx.globalAlpha=1;
        }
      }
      ctx.restore();
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,r,start,start+angle); ctx.closePath();
      ctx.strokeStyle='rgba(0,0,0,.3)'; ctx.lineWidth=1; ctx.stroke();
      start+=angle;
    });
    return;
  }

  // Not reached: both callers pass 'mini' (HANDOFF §10, O49).
  var W=Math.max(getCanvasW(canvas),280);
  if(squareLegend){
    var H=W;
    canvas.width=W*dpr; canvas.height=H*dpr;
    canvas.style.width=W+'px'; canvas.style.height=H+'px';
    var ctx=canvas.getContext('2d'); ctx.scale(dpr,dpr);
    var total=values.reduce(function(a,b){return a+b;},0);
    if(!total){
      ctx.fillStyle=textClr; ctx.textAlign='center'; ctx.font='13px sans-serif';
      ctx.fillText('No data',W/2,H/2); return;
    }
    var r=Math.min(H/2*0.82, W/4*0.82);
    var cx=W/4, cy=H/2;
    var start=-Math.PI/2;
    values.forEach(function(v,i){
      if(!v) return;
      var angle=v/total*Math.PI*2;
      ctx.save();
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,r,start,start+angle); ctx.closePath();
      ctx.clip();
      var clrs=colorsArr[i];
      ctx.fillStyle=clrs[0]||'#888888';
      ctx.fillRect(cx-r,cy-r,r*2,r*2);
      if(clrs.length===1){
        var cn=null; Object.keys(CHEX).forEach(function(x){ if(CHEX[x]===clrs[0]) cn=x; });
        if(cn && ICON_IMGS[cn] && ICON_IMGS[cn].complete && ICON_IMGS[cn].naturalWidth>0){
          ctx.globalAlpha=0.85;
          ctx.drawImage(ICON_IMGS[cn],cx-r,cy-r,r*2,r*2);
          ctx.globalAlpha=1;
        }
      }
      ctx.restore();
      ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,r,start,start+angle); ctx.closePath();
      ctx.strokeStyle='rgba(0,0,0,.3)'; ctx.lineWidth=1.5; ctx.stroke();
      start+=angle;
    });
    var rowH=32, iconSz=24;
    var nonZero=values.filter(function(v){return v>0;}).length;
    var legendH=nonZero*rowH;
    var lx=W/2+14, ly=(H-legendH)/2;
    values.forEach(function(v,i){
      if(!v) return;
      var clrs=colorsArr[i];
      var pct=Math.round(v/total*100);
      var midY=ly+rowH/2;
      var cn=null; Object.keys(CHEX).forEach(function(x){ if(CHEX[x]===clrs[0]) cn=x; });
      if(cn && ICON_IMGS[cn] && ICON_IMGS[cn].complete && ICON_IMGS[cn].naturalWidth>0){
        ctx.save(); ctx.beginPath(); ctx.arc(lx+iconSz/2,midY,iconSz/2,0,Math.PI*2); ctx.clip();
        ctx.drawImage(ICON_IMGS[cn],lx,midY-iconSz/2,iconSz,iconSz); ctx.restore();
      } else {
        ctx.fillStyle=clrs[0]||'#888'; ctx.beginPath(); ctx.arc(lx+iconSz/2,midY,iconSz/2,0,Math.PI*2); ctx.fill();
      }
      ctx.fillStyle=textClr; ctx.font='bold 16px sans-serif'; ctx.textAlign='left'; ctx.textBaseline='middle';
      ctx.fillText(pct+'%', lx+iconSz+8, midY);
      ly+=rowH;
    });
    return;
  }
  var nonZero=values.filter(function(v){return v>0;}).length;
  var rowH = cardCounts ? 42 : 26;
  var H=Math.max(nonZero*rowH+28, 200);
  canvas.width=W*dpr; canvas.height=H*dpr;
  canvas.style.width=W+'px'; canvas.style.height=H+'px';
  var ctx=canvas.getContext('2d'); ctx.scale(dpr,dpr);
  var total=values.reduce(function(a,b){return a+b;},0);
  if(!total){
    ctx.fillStyle=textClr; ctx.textAlign='center'; ctx.font='13px sans-serif';
    ctx.fillText('No data',W/2,H/2); return;
  }
  var r=Math.min(H*0.42,90);
  var cx=r+16, cy=H/2;
  var start=-Math.PI/2;

  values.forEach(function(v,i){
    if(!v) return;
    var angle=v/total*Math.PI*2;
    ctx.save();
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,r,start,start+angle); ctx.closePath();
    ctx.clip();
    var clrs=colorsArr[i];
    if(clrs.length>1){
      var mid=start+angle/2, perp=mid+Math.PI/2;
      var grad=ctx.createLinearGradient(cx+Math.cos(perp)*r*0.8,cy+Math.sin(perp)*r*0.8,
                                        cx-Math.cos(perp)*r*0.8,cy-Math.sin(perp)*r*0.8);
      clrs.forEach(function(c,ci){ grad.addColorStop(ci/(clrs.length-1),c); });
      ctx.fillStyle=grad;
    } else {
      ctx.fillStyle=clrs[0]||'#888888';
    }
    ctx.fillRect(cx-r,cy-r,r*2,r*2);
    if(clrs.length===1){
      var colorName=null;
      Object.keys(CHEX).forEach(function(cn){ if(CHEX[cn]===clrs[0]) colorName=cn; });
      if(colorName && ICON_IMGS[colorName] && ICON_IMGS[colorName].complete && ICON_IMGS[colorName].naturalWidth>0){
        ctx.globalAlpha=0.85;
        ctx.drawImage(ICON_IMGS[colorName], cx-r, cy-r, r*2, r*2);
        ctx.globalAlpha=1;
      }
    }
    ctx.restore();
    ctx.beginPath(); ctx.moveTo(cx,cy); ctx.arc(cx,cy,r,start,start+angle); ctx.closePath();
    ctx.strokeStyle='rgba(0,0,0,.3)'; ctx.lineWidth=1.5; ctx.stroke();
    start+=angle;
  });

  var lx=cx+r+18, ly=14;
  values.forEach(function(v,i){
    if(!v) return;
    var clrs=colorsArr[i];
    var lbl=labels[i]; if(lbl.length>13) lbl=lbl.substring(0,12)+'\u2026';
    var pct=Math.round(v/total*100);
    var iconSz = cardCounts ? 32 : 16;
    var pctFont = cardCounts ? 'bold 22px sans-serif' : 'bold 12px sans-serif';
    var cardFont = cardCounts ? '18px sans-serif' : '11px sans-serif';
    var lineH = cardCounts ? 40 : rowH;

    if(cardCounts){
      var midY = ly + iconSz/2;

      ctx.fillStyle=textClr; ctx.textAlign='left'; ctx.font=pctFont;
      var pctStr = pct+'%';
      var pctW = ctx.measureText(pctStr).width;
      ctx.fillText(pctStr, lx, midY+8);

      var iconX = lx + pctW + 10;
      var iconDrawn=false;
      if(clrs.length===1){
        var colorName=null;
        Object.keys(CHEX).forEach(function(cn){ if(CHEX[cn]===clrs[0]) colorName=cn; });
        if(colorName && ICON_IMGS[colorName] && ICON_IMGS[colorName].complete && ICON_IMGS[colorName].naturalWidth>0){
          ctx.save();
          ctx.beginPath(); ctx.arc(iconX+iconSz/2,midY,iconSz/2,0,Math.PI*2); ctx.clip();
          ctx.drawImage(ICON_IMGS[colorName],iconX,midY-iconSz/2,iconSz,iconSz);
          ctx.restore();
          iconDrawn=true;
        }
      }
      if(!iconDrawn){
        if(clrs.length>1){
          var lg=ctx.createLinearGradient(iconX,midY-iconSz/2,iconX+iconSz,midY+iconSz/2);
          clrs.forEach(function(c,ci){ lg.addColorStop(ci/(clrs.length-1),c); });
          ctx.fillStyle=lg;
        } else { ctx.fillStyle=clrs[0]||'#888888'; }
        ctx.fillRect(iconX,midY-iconSz/2,iconSz,iconSz);
        ctx.strokeStyle='rgba(0,0,0,.25)'; ctx.lineWidth=0.5; ctx.strokeRect(iconX,midY-iconSz/2,iconSz,iconSz);
      }

      var textX = iconX + iconSz + 10;
      ctx.fillStyle=textClr; ctx.textAlign='left'; ctx.font=cardFont;
      ctx.fillText('('+cardCounts[i]+' Cards)', textX, midY+7);

      ly += lineH;
    } else {
      var iconDrawn=false;
      if(clrs.length===1){
        var colorName=null;
        Object.keys(CHEX).forEach(function(cn){ if(CHEX[cn]===clrs[0]) colorName=cn; });
        if(colorName && ICON_IMGS[colorName] && ICON_IMGS[colorName].complete && ICON_IMGS[colorName].naturalWidth>0){
          ctx.save();
          ctx.beginPath(); ctx.arc(lx+iconSz/2,ly+iconSz/2,iconSz/2,0,Math.PI*2); ctx.clip();
          ctx.drawImage(ICON_IMGS[colorName],lx,ly,iconSz,iconSz);
          ctx.restore();
          iconDrawn=true;
        }
      }
      if(!iconDrawn){
        if(clrs.length>1){
          var lg=ctx.createLinearGradient(lx,ly,lx+iconSz,ly+iconSz);
          clrs.forEach(function(c,ci){ lg.addColorStop(ci/(clrs.length-1),c); });
          ctx.fillStyle=lg;
        } else { ctx.fillStyle=clrs[0]||'#888888'; }
        ctx.fillRect(lx,ly,iconSz,iconSz);
        ctx.strokeStyle='rgba(0,0,0,.25)'; ctx.lineWidth=0.5; ctx.strokeRect(lx,ly,iconSz,iconSz);
      }
      ctx.fillStyle=textClr; ctx.textAlign='left'; ctx.font=pctFont;
      ctx.fillText(pct+'%  '+lbl, lx+iconSz+8, ly+iconSz/2+5);
      ly+=rowH;
    }
  });
}

