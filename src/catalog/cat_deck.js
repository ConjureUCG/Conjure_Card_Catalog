/* Parts of this run at parse time, before cat_testdeck.js exists (see _hashLoadDeck). The deck list grammar is cat_core.js's alone (parseDeckLines). */

var DECK_NAME = 'Deck';
var _activeDeckId = 'dta-main';
/* Everything downstream iterates these, never naming the sections, so a game with two sections draws two. */
var DECK_IDS = REBIRTH
  ? {main:'dta-main', armament:'dta-armament'}
  : {main:'dta-main', essence:'dta-essence', wish:'dta-wish'};
var DECK_LABELS = REBIRTH
  ? {main:'Main Deck', armament:'Armament'}
  : {main:'Main Deck', essence:'Essence Deck', wish:'Wish Deck'};
var DECK_VIEW_IDS = REBIRTH
  ? {main:'dv', armament:'dv-arm'}
  : {main:'dv', essence:'dv-ess', wish:'dv-wish'};

function getActiveDeck(){
  return document.getElementById(_activeDeckId) || document.getElementById('dta-main');
}

function setDVFilter(filter){
  if(DECK_IDS[filter]) _activeDeckId = DECK_IDS[filter];
  _markActiveSection();
  updCnt();
  refreshDeckView();
}
function _markActiveSection(){
  Object.keys(DECK_IDS).forEach(function(k){
    var hdr = document.getElementById('dpsec-'+k);
    if(hdr) hdr.classList.toggle('dp-sec-active', DECK_IDS[k] === _activeDeckId);
  });
}
function parseDeck(){
  var ta = getActiveDeck();
  return ta && ta.id ? parseDeckIn(ta.id) : [];
}

function _isEssenceCard(card){
  if(!card) return false;
  return _catArr(card.superTypes).map(function(s){return String(s).toLowerCase();}).indexOf('essence') >= 0;
}

/* Either word in either type list: the main game files Armament as a sub-type and Ongoing as a super-type, and Rebirth's cards are typed by hand. */
function _isArmamentLegal(card){
  if(!card) return false;
  return _catArr(card.superTypes).concat(_catArr(card.subTypes)).some(function(t){
    var s = String(t).toLowerCase();
    return s === 'armament' || s === 'ongoing';
  });
}
/* Only Character decks route these: an Encounter deck's monsters are Character cards in its Main Deck, which the DM draws from. */
function _isGearCard(card){
  if(!card) return false;
  return _isArmamentLegal(card) || _catArr(card.superTypes).concat(_catArr(card.subTypes)).some(function(t){
    var s = String(t).toLowerCase();
    return s === 'character' || s === 'background';
  });
}
function deckGearRoutes(){
  return !!(REBIRTH && DECK_IDS.armament && typeof _gameMode !== 'undefined' && _gameMode === 'character');
}

/* Every + and − goes through deckChange: it rewrites the one line, saves, says what it did, and brings every picture of the deck back in step. */
function deckKeyOf(id){
  return Object.keys(DECK_IDS).find(function(k){ return DECK_IDS[k] === id; }) || null;
}
/* A non-Essence card never goes into the Essence Deck, which a phone's Build Deck tab can still have picked: it goes to the Main Deck. */
function deckAddKey(card){
  if(card && _isEssenceCard(card) && DECK_IDS.essence) return 'essence';
  if(card && deckGearRoutes() && _isGearCard(card)) return 'armament';
  var k = deckKeyOf(_activeDeckId) || 'main';
  return (k === 'essence' && card) ? 'main' : k;
}
function deckSortEssence(){
  if(!DECK_IDS.essence) return 0;
  var byName = Object.create(null);
  (typeof CARDS !== 'undefined' && CARDS || []).forEach(function(c){ if(c && c.name != null) byName[String(c.name)] = c; });
  var into = {essence:[], main:[]}, n = {essence:0, main:0};
  function sweep(key, dest){
    var ta = document.getElementById(DECK_IDS[key]); if(!ta) return;
    var keep = [], took = false;
    String(ta.value || '').split('\n').forEach(function(ln){
      var ent = parseDeckLine(ln);
      var name = ent && (deckCanonName(ent.name) || ent.name);
      var card = name ? byName[name] : null;
      if(card && _isEssenceCard(card) === (dest === 'essence') && ent.count > 0){
        into[dest].push({name:name, count:ent.count}); n[dest] += ent.count; took = true;
        return;
      }
      keep.push(ln);
    });
    if(took) ta.value = keep.join('\n');
  }
  sweep('main', 'essence'); sweep('wish', 'essence'); sweep('essence', 'main');
  Object.keys(into).forEach(function(dest){
    var ta = document.getElementById(DECK_IDS[dest]);
    into[dest].forEach(function(en){ ta.value = deckAdjustText(ta.value, en.name, en.count); });
  });
  var said = [];
  if(n.essence) said.push(n.essence + (n.essence === 1 ? ' Essence card' : ' Essence cards') + ' moved to the Essence Deck');
  if(n.main) said.push(n.main + (n.main === 1 ? ' card that is not Essence' : ' cards that are not Essence') + ' moved to the Main Deck');
  if(said.length && typeof window.toast === 'function') window.toast(said.join('; '));
  return n.essence + n.main;
}
/* Unlike deckSortEssence, a card in the Armament section that is not gear stays there, named as not allowed (deckLegality). */
function deckSortGear(){
  if(!deckGearRoutes()) return 0;
  var byName = Object.create(null);
  (typeof CARDS !== 'undefined' && CARDS || []).forEach(function(c){ if(c && c.name != null) byName[String(c.name)] = c; });
  var ta = document.getElementById(DECK_IDS.main), arm = document.getElementById(DECK_IDS.armament);
  if(!ta || !arm) return 0;
  var keep = [], into = [], n = 0;
  String(ta.value || '').split('\n').forEach(function(ln){
    var ent = parseDeckLine(ln);
    var name = ent && (deckCanonName(ent.name) || ent.name);
    var card = name ? byName[name] : null;
    if(card && ent.count > 0 && _isGearCard(card)){ into.push({name:name, count:ent.count}); n += ent.count; return; }
    keep.push(ln);
  });
  if(!n) return 0;
  ta.value = keep.join('\n');
  into.forEach(function(en){ arm.value = deckAdjustText(arm.value, en.name, en.count); });
  if(typeof window.toast === 'function')
    window.toast(n + (n === 1 ? ' Armament, Ongoing, Character or Background card' : ' Armament, Ongoing, Character and Background cards')
      + ' moved to the Armament section');
  return n;
}
window.deckSortGear = deckSortGear;
function deckRemoveKey(card){
  var has = function(k){
    return parseDeckIn(DECK_IDS[k]).some(function(en){ return en.name === card.name; }); };
  var first = deckAddKey(card);
  if(has(first)) return first;
  return Object.keys(DECK_IDS).filter(has)[0] || null;
}
function deckToast(name, delta, key){
  if(typeof window.toast !== 'function') return;
  var where = DECK_LABELS[key] || key;
  window.toast(delta > 0 ? ((delta > 1 ? delta + 'x ' : '') + name + ' added to ' + where)
                         : (name + ' removed from ' + where));
}
function deckChange(name, delta, key){
  if(delta > 0 && key !== 'armament' && deckGearRoutes()
     && _isGearCard((typeof CARDS !== 'undefined' && CARDS || []).filter(function(c){ return c && c.name === name; })[0]))
    key = 'armament';
  var ta = document.getElementById(DECK_IDS[key] || '');
  if(!ta || !name || !delta) return false;
  var next = deckAdjustText(ta.value, name, delta);
  if(next === ta.value) return false;
  ta.value = next;
  updCnt(); _hashSaveDeck();
  deckToast(name, delta, key);
  var dp = document.getElementById('pane-deck');
  if(dp && dp.style.display !== 'none') refreshDeckView();
  return true;
}
function deckButtonPress(node, delta){
  var card = node && node.__card; if(!card) return;
  var key = node.__deckTa ? deckKeyOf(node.__deckTa)
          : (delta > 0 ? deckAddKey(card) : deckRemoveKey(card));
  if(key) deckChange(card.name, delta, key);
}

function _addCardToDeck(cardName, deckKey){
  deckChange(cardName, 1, DECK_IDS[deckKey] ? deckKey : 'main');
}

/* A press neither changes nor disables the window's Add buttons, so a second copy can be added from it; the toast says what happened. */
function addToDeckById(deckKey){
  if(!cur) return;
  _addCardToDeck(cur.name, deckKey);
}

function deckCountsByName(){
  var out = {};
  Object.keys(DECK_IDS).forEach(function(k){
    parseDeckIn(DECK_IDS[k]).forEach(function(en){
      var o = out[en.name] || (out[en.name] = {count:0, lord:false, parts:[]});
      o.count += en.count;
      if(en.lord) o.lord = true;
      o.parts.push((DECK_LABELS[k] || k) + ' ' + (deckIsLord(en) ? 'Lord' : en.count));
    });
  });
  Object.keys(out).forEach(function(n){ out[n].title = out[n].parts.join(' \u00b7 '); });
  return out;
}
function deckAllEntries(){
  return Object.keys(DECK_IDS).reduce(function(a, k){ return a.concat(parseDeckIn(DECK_IDS[k])); }, []);
}

function deckCtrlHTML(ent, title){
  var has = !!(ent && ent.count > 0);
  return '<div class="ci-ctl' + (has ? ' has-cnt' : '') + '">'
    + (has ? '<button class="ci-qbtn rem" type="button" title="Remove one">&#8722;</button>' : '')
    + '<div class="ci-ctl-mid">'
      + (has ? '<span class="ci-cnt-bubble"' + (title ? ' title="' + e(title) + '"' : '') + '>'
             + deckCountText(ent) + '</span>' : '')
      + '<span class="ci-ctl-ed"></span>'
    + '</div>'
    + '<button class="ci-qbtn add" type="button" title="Add one">&#43;</button>'
    + '</div>';
}
/* A row is swapped only when what it shows has changed, and the editor's ✎ moves across to the new one. */
function deckCtrlSync(){
  var counts = deckCountsByName();
  document.querySelectorAll('#cg .ci, #ctb tr').forEach(function(node){
    if(!node.__card) return;
    var old = node.querySelector('.ci-ctl'); if(!old) return;
    var c = counts[node.__card.name] || null;
    var key = c ? (c.count + '|' + c.lord + '|' + c.title) : '';
    if((node.__ctlKey || '') === key) return;
    node.__ctlKey = key;
    var tmp = document.createElement('div');
    tmp.innerHTML = deckCtrlHTML(c, c && c.title);
    var neu = tmp.firstChild, ed = old.querySelector('.ci-qedit');
    if(ed){ var slot = neu.querySelector('.ci-ctl-ed'); if(slot) slot.appendChild(ed); }
    old.parentNode.replaceChild(neu, old);
  });
}

function updCnt(){
  function cntForDeck(id){
    return parseDeckIn(id).reduce(function(a,b){ return a+b.count; }, 0);
  }
  var total = 0;
  Object.keys(DECK_IDS).forEach(function(k){
    var n = cntForDeck(DECK_IDS[k]); total += n;
    var badge=document.getElementById('dpCnt-'+k);
    if(badge) badge.textContent = n>0 ? n : '';
  });
  document.getElementById('dcnt').textContent = total + (total===1 ? ' card' : ' cards');
  updateDeckWarnings();
  updateStatSummary();
  try{ deckCtrlSync(); }catch(_){}
  if(typeof mobOnCounts === 'function') mobOnCounts(total);
}

/* Import reads each of these back (DECK_HEAD_WORDS), so a copied deck pastes back section by section. */
var DECK_COPY_HEADS = {main:'Deck', essence:'Essence', wish:'Wish', armament:'Armament'};

function copyDeck(btn){
  var parts = [];
  Object.keys(DECK_IDS).forEach(function(key){
    var el = document.getElementById(DECK_IDS[key]);
    var v = el ? el.value.trim() : '';
    /* The Character's numbers ride on the Main Deck, written from the row, where they are typed, not from the text. */
    if(key === 'main' && typeof tdReadStatRow === 'function'){
      var st = tdReadStatRow();
      if(st) v = deckTextWithStats(v, st).trim();
    }
    if(v) parts.push((DECK_COPY_HEADS[key] || DECK_LABELS[key] || key) + '\n' + v);
  });
  var text = parts.join('\n\n');
  if(!text) return;
  /* A refused copy says so: over plain http there is no clipboard, and a browser may refuse the write. */
  var b=(btn && btn.nodeType===1) ? btn : document.querySelector('.dco');
  function flash(msg){
    if(!b) return;
    if(b.__copyT) clearTimeout(b.__copyT); else b.__copyO=b.textContent;
    b.textContent=msg;
    b.__copyT=setTimeout(function(){ b.textContent=b.__copyO; b.__copyT=0; },1400);
  }
  function failed(){
    flash('Copy failed');
    if(typeof window.toast==='function') window.toast('Could not copy the deck: the browser refused the clipboard. Select the lists and copy them by hand.');
  }
  try{
    if(!navigator.clipboard || typeof navigator.clipboard.writeText!=='function'){ failed(); return; }
    navigator.clipboard.writeText(text).then(function(){ flash('Copied!'); }, failed);
  }catch(_){ failed(); }
}

/* It asks: the lists live only in the hash, written with replaceState, so Back cannot bring a cleared deck back. */
function clearDeck(){
  var counts=Object.keys(DECK_IDS).map(function(k){
    var el=document.getElementById(DECK_IDS[k]);
    var n=el ? parseDeckIn(DECK_IDS[k]).reduce(function(a,b){return a+b.count;},0) : 0;
    return {label:DECK_LABELS[k]||k, n:n};
  }).filter(function(x){ return x.n>0; });
  var total=counts.reduce(function(a,b){return a+b.n;},0);
  if(total>0){
    var what=counts.map(function(x){ return x.n+' in '+x.label; }).join(', ');
    if(!confirm('Clear every deck list?\n\n'+what+' — '+total+' card'
      +(total!==1?'s':'')+' in total.\n\nThis cannot be undone.')) return;
  }
  Object.keys(DECK_IDS).forEach(function(k){ var el=document.getElementById(DECK_IDS[k]); if(el) el.value=''; });
  _activeDeckId = DECK_IDS.main; _markActiveSection();
  updCnt(); _hashSaveDeck(); refreshDeckView();
}
var _deckRefreshTimer = null;
/* 0.6 s after the last key, and only while the page shows: a longer wait looks as if the typing had not taken. */
function _deckPaneShowing(){
  var p=document.getElementById('pane-deck');
  return !!(p && p.style.display!=='none' && p.getClientRects().length);
}
function _dtaInput(){
  updCnt(); _hashSaveDeck(); clearTimeout(_deckRefreshTimer);
  _deckRefreshTimer = setTimeout(function(){ if(_deckPaneShowing()) refreshDeckView(); }, 600);
}
/* The Character's four numbers are part of the deck, so they save to the hash as the lists do: an empty Level is an empty Essence area. */
var TD_STAT_INPUT_IDS = ['dta-lvl', 'dta-atk', 'dta-hp', 'dta-mp'];
function _statInput(){ _hashSaveDeck(); }

/* Row to list on blur only (rewriting a textarea moves its caret), list to row on input; neither loops, as setting .value fires no input event. */
function deckStatsSyncToText(){
  if(typeof tdReadStatRow !== 'function') return;
  var row = tdReadStatRow(); if(!row) return;
  var ta = document.getElementById(DECK_IDS.main); if(!ta) return;
  if(document.activeElement === ta) return;      /* never under the caret */
  var next = deckTextWithStats(ta.value, row);
  if(next !== ta.value) ta.value = next;
}
function deckStatsAdoptFromText(){
  if(typeof tdReadStatRow !== 'function' || typeof tdWriteStatRow !== 'function') return;
  var row = tdReadStatRow(); if(!row) return;
  var ta = document.getElementById(DECK_IDS.main); if(!ta) return;
  var found = deckStatsFromText(ta.value);
  var keys = Object.keys(found);
  if(!keys.length) return;
  var changed = keys.some(function(k){ return String(row[k] || '') !== String(found[k]); });
  if(!changed) return;
  keys.forEach(function(k){ row[k] = found[k]; });
  tdWriteStatRow(row);
  _hashSaveDeck();
}
window.deckStatsSyncToText = deckStatsSyncToText;
/* Only on leaving the box: rewriting the text under the cursor would fight the typing. */
function _dtaCanon(ev){
  var ta = ev && ev.target; if(!ta) return;
  var was = ta.value, next = deckCanonText(was);
  if(next !== was) ta.value = next;
  var moved = deckSortEssence() + deckSortGear();
  if(next === was && !moved) return;
  updCnt(); _hashSaveDeck();
  if(_deckPaneShowing()) refreshDeckView();
}
// At parse time: the markup is already in place.
(function(){
  Object.keys(DECK_IDS).map(function(k){return DECK_IDS[k];}).forEach(function(id){
    var el = document.getElementById(id); if(!el) return;
    el.addEventListener('input', _dtaInput);
    el.addEventListener('change', _dtaCanon);
  });
  var _main = document.getElementById(DECK_IDS.main);
  if(_main) _main.addEventListener('input', deckStatsAdoptFromText);
  TD_STAT_INPUT_IDS.forEach(function(id){
    var el = document.getElementById(id);
    if(!el) return;
    el.addEventListener('input', _statInput);
    el.addEventListener('blur', deckStatsSyncToText);
  });
})();

function _hashSaveDeck(){
  try {
    var data = {};
    Object.keys(DECK_IDS).forEach(function(k){
      var el = document.getElementById(DECK_IDS[k]);
      if(el && el.value.trim()) data[k] = el.value.trim();
    });
    /* Under a key of its own (st), so a main-game hash keeps its shape and an old hash still loads. */
    if(typeof tdReadStatRow === 'function'){
      var st = tdReadStatRow();
      if(st && (st.lvl || st.atk || st.hp || st.mp)) data.st = st;
    }
    if(Object.keys(data).length){
      if(typeof _gameMode === 'string' && _gameMode) data.mode = _gameMode;
      /* whose lists these are, so the other game never loads them (_hashLoadDeck) */
      data.g = REBIRTH ? 'rebirth' : 'main';
    }
    var hash = window.location.hash;
    var fm = hash.match(/filters=([A-Za-z0-9+/=]+)/);
    var filterPart = fm ? '&filters=' + fm[1] : '';
    if(Object.keys(data).length){
      var b64 = btoa(unescape(encodeURIComponent(JSON.stringify(data))));
      history.replaceState(null,'','#decks='+b64+filterPart);
    } else if(filterPart){
      history.replaceState(null,'','#'+filterPart.slice(1));
    } else {
      history.replaceState(null,'',window.location.pathname+window.location.search);
    }
  } catch(e){}
}
/* Each game keeps its own lists (the author, 9 November). The address holds the running game's, tagged with the game (g);
   the switch (setRebirth, cat_core.js) puts them by for this tab under the game's name and puts the other game's in the
   address, so the reload loads those. Lists that are the other game's are put by for it and never loaded here. */
var DECK_PARK_KEY = 'conjure_deck_lists_';
function _deckParkSet(game, b64){
  try{
    if(b64) sessionStorage.setItem(DECK_PARK_KEY + game, b64);
    else sessionStorage.removeItem(DECK_PARK_KEY + game);
  }catch(_){}
}
/* Whose lists a hash holds: its tag, or, written before the tag, the sections and deck types only one game has. */
function _deckHashGame(d){
  if(!d || typeof d !== 'object') return null;
  if(d.g === 'rebirth' || d.g === 'main') return d.g;
  if(d.armament || d.st || ['character', 'encounter', 'rewards'].indexOf(d.mode) >= 0) return 'rebirth';
  if(d.essence || d.wish || ['constructed', 'kingdoms', 'arena', 'draft'].indexOf(d.mode) >= 0) return 'main';
  return null;
}
/* This page's address with the given lists in place of its own, the filters kept. */
function _deckHashWith(b64){
  var fm = (location.hash || '').match(/filters=([A-Za-z0-9+/=]+)/);
  var parts = [];
  if(b64) parts.push('decks=' + b64);
  if(fm) parts.push('filters=' + fm[1]);
  return location.pathname + location.search + (parts.length ? '#' + parts.join('&') : '');
}
function _deckListsPark(toRebirth){
  var m = (location.hash || '').match(/(?:^#|&)decks=([A-Za-z0-9+/=]+)/);
  _deckParkSet(REBIRTH ? 'rebirth' : 'main', m ? m[1] : '');
  var back = null;
  try{ back = sessionStorage.getItem(DECK_PARK_KEY + (toRebirth ? 'rebirth' : 'main')); }catch(_){}
  if(back && !/^[A-Za-z0-9+/=]+$/.test(back)) back = null;
  try{ history.replaceState(null, '', _deckHashWith(back)); }catch(_){}
}
window._deckListsPark = _deckListsPark;
function _hashLoadDeck(){
  try {
    var hash = window.location.hash;
    var m = hash.match(/^#decks=([A-Za-z0-9+/=]+)/);
    if(m){
      var data = JSON.parse(decodeURIComponent(escape(atob(m[1]))));
      var whose = _deckHashGame(data);
      if(whose && whose !== (REBIRTH ? 'rebirth' : 'main')){
        _deckParkSet(whose, m[1]);
        try{ history.replaceState(null, '', _deckHashWith(null)); }catch(_){}
        return;
      }
      Object.keys(data).forEach(function(k){
        if(k === 'st' || k === 'mode' || k === 'g') return;
        var el = document.getElementById(DECK_IDS[k]);
        if(el) el.value = data[k];
      });
      /* At parse time tdWriteStatRow does not exist yet, so the row is handed to tdSyncStatRow (cat_testdeck.js), called at cat_tail.js's foot. */
      if(data.st) window._tdPendingStatRow = data.st;
      /* the type is taken where _gameMode is declared, further down */
      if(data.mode) window._pendingDeckMode = String(data.mode);
      updCnt(); return;
    }
    // a link from before the multi-deck format
    var m2 = hash.match(/^#deck=([A-Za-z0-9+/=]+)/);
    if(m2){
      var text = decodeURIComponent(escape(atob(m2[1])));
      if(text.trim()){ getActiveDeck().value = text; updCnt(); }
    }
  } catch(e){ console.warn('[Catalog] Could not load deck from hash:', e); }
}
// At parse time CARDS is not loaded yet, so edRefreshDeckSide (ed2_tools.js) asks the warnings again once it is.
_hashLoadDeck();
_markActiveSection();

/* This key alone keeps the two games' saved decks apart. */
var _SAVED_KEY = REBIRTH ? 'conjure_saved_decks_rebirth' : 'conjure_saved_decks';
/* Always a plain object of name -> deck, whatever storage held, so callers read saved[name][section] unchecked. */
function _savedLoad(){
  var d;
  try{ d = JSON.parse(localStorage.getItem(_SAVED_KEY)||'{}'); }catch(e){ return {}; }
  if(!d || typeof d !== 'object' || Array.isArray(d)) return {};
  Object.keys(d).forEach(function(k){
    var v = d[k];
    if(typeof v !== 'string' && (!v || typeof v !== 'object' || Array.isArray(v))) delete d[k];
  });
  return d;
}
/* A failed write is never silent: it alerts, and answers false so no caller says it saved. */
/* exposed so a check can drive the failure path; the app never calls this */
window.__savedWrite=function(d){ return _savedWrite(d); };
function _savedWrite(data){
  try{
    localStorage.setItem(_SAVED_KEY, JSON.stringify(data));
    return true;
  }catch(e){
    var why=(e && (e.name==='QuotaExceededError'||e.code===22))
      ? 'There is no room left in this browser\'s storage for another deck.'
      : 'This browser refused to save (private window, or site data is blocked).';
    alert('Could not save.\n\n'+why+'\n\nYour deck lists on screen are unchanged - '
      +'copy them somewhere before leaving this page.');
    return false;
  }
}

/* _gameMode is declared below DECK_TYPES: its default is the running game's first deck type. */

var GAME_MODES = {
  /* The rules text and the numbers beside it must say the same, so the Deck Rules page and every check agree. */
  constructed: {
    label: 'Constructed',
    mainMin: 50, mainMax: 50,
    essMax: function(){ return 15; }, essMin: function(){ return 15; },
    wishMax: function(){ return 12; },
    rules: [
      {title:'Additional', text:''},
      {title:'Main Deck', text:'Exactly 50 cards.'},
      {title:'Essence Deck', text:'Exactly 15 cards.'},
      {title:'Wish Deck', text:'Maximum 12 cards.'},
      {title:'Copy Limit', text:'Maximum 3x copies of any card across Main + Wish combined.'},
      {title:'Starting Life', text:'20 Life'},
      {title:'Unique Cards', text:'Only 1 copy of a Unique card allowed across the Main + Wish Deck combined.'}
    ]
  },
  kingdoms: {
    label: 'Kingdoms',
    mainMin: 100, mainMax: 100,
    essMax: function(){ return 33; }, essMin: function(){ return 33; },
    wishMax: function(){ return 25; },
    /* lord: the Lord ("Lx Name") is left out of the Main Deck size, and a Lord with Unique forbids every other Unique card. */
    lord: true,
    rules: [
      {title:'Additional', text:'Lord \u2014 Pick one Mythic Character or Mythic Armament card to be your Lord card. The Lord does not count toward your Main Deck size.'},
      {title:'Main Deck', text:'Exactly 100 cards.'},
      {title:'Essence Deck', text:'Exactly 33 cards.'},
      {title:'Wish Deck', text:'Maximum 25 cards.'},
      {title:'Copy Limit', text:'Main + Wish decks may only contain 1 copy of any card.'},
      {title:'Starting Life', text:'30 Life'},
      {title:'Unique Cards', text:'If your Lord has Unique then none of your decks may have any Unique cards. If not, your Main + Wish + Essence decks may only contain 10 Unique cards combined.'}
    ]
  },
  arena: {
    label: 'Arena',
    mainMin: 30, mainMax: 30,
    essMax: function(){ return 999; },
    wishMax: function(){ return 0; },
    /* dualMax: at most 3 of each Dual Essence over the whole deck, Arena's one copy limit. */
    dualMax: 3,
    rules: [
      {title:'Additional', text:'Only need 2 Victory Points to win.'},
      {title:'Main Deck', text:'Exactly 30 cards.'},
      {title:'Essence Deck', text:'Unlimited Essence and 3x of each Dual Essence.'},
      {title:'Wish Deck', text:'None'},
      {title:'Copy Limit', text:'No copy limit of any card.'},
      {title:'Starting Life', text:'15 Life'},
      {title:'Unique Cards', text:'The "Unique" rule is ignored for Arena.'}
    ]
  },

  /* The pool a draft is dealt from, not a deck anybody plays: not in DECK_TYPES, which is also every table's choice of format. */
  draft: {
    label: 'Draft Deck', draftPool: true, noValidation: true,
    rules: [
      {title:'Additional', text:'A card pool to draft from, not a deck to play.'},
      {title:'Main Deck', text:'Any number of cards, in any section.'},
      {title:'Core Essence', text:'Never drafted - Arena brings its own.'},
      {title:'Dual Essence', text:'Never drafted - Arena brings its own.'}
    ]
  },

  /* Encounter and Rewards have no specified limits (noValidation), so nothing is invented for them; each has a note in place of rows. */
  character: {
    label: 'Character', rebirth: true,
    /* sizeOnly: the Main Deck's size is its only rule; armamentOnly: what the Armament section may hold, checked before sizeOnly stops. */
    mainMin: 50, mainMax: 50, sizeOnly: true, armamentOnly: true,
    rules: [
      {title:'Main Deck', text:'Exactly 50 cards.'},
      {title:'Gear', text:'Armament cards and Ongoing cards separately costing equal to or less than your LVL points.'},
      {title:'Draw', text:'Draw cards equal to your LVL.'},
      {title:'Area', text:'Starts with the Core Essence named by your Level.'},
      {title:'Stats', text:'Your ATK resets at the end of each Battle, your MP resets at the beginning of each of your turns during Battle, and your HP is tracked through and between Battles.'}
    ]
  },
  encounter: {
    label: 'Encounter', rebirth: true, noValidation: true, rules: [],
    note: 'The Encounter Deck is used for random encounters. You "Explore" by rolling a D4 and revealing that many cards from the Encounter Deck and playing them out accordingly.'
  },
  rewards: {
    label: 'Rewards', rebirth: true, noValidation: true, rules: [],
    note: 'The Reward Deck is used for random rewards, the DM determines how many points of rewards the players get, along with possible restrictions such as card types or colors, then they look at cards from the top of the Reward Deck until they\u2019ve found an appropriate amount of cards for the reward and gives those cards to the players.'
  }
}

var DECK_TYPES = REBIRTH
  ? ['character', 'encounter', 'rewards', 'none']
  : ['constructed', 'kingdoms', 'arena', 'none'];
var DECK_TAB_TYPES = REBIRTH ? DECK_TYPES
  : ['constructed', 'kingdoms', 'arena', 'draft', 'none'];

/* Known issue: the Build Deck page checks more than deckLegality (Essence Deck copies, wrong sections, unknown names), so the Deck Lists tick and the seat check can pass a deck it flags.
   checked:false means the deck type specifies no rules, which is not failing: legal stays true. */
function _isDualEssence(card){
  var sa = _catArr(card && card.superTypes).map(function(s){ return String(s).toLowerCase(); });
  return sa.indexOf('dual') >= 0 && sa.indexOf('essence') >= 0;
}
function deckLordCard(mainEntries, cardMap){
  var en = (mainEntries || []).filter(function(x){ return x && x.lord; })[0];
  return en ? (cardMap[en.name] || null) : null;
}
function deckLegality(mode, totals, opts){
  opts = opts || {}; totals = totals || {};
  var gm = (typeof GAME_MODES !== 'undefined' && GAME_MODES[mode]) ? GAME_MODES[mode] : null;
  var out = { checked:true, legal:true, sizeWarns:[] };
  if(mode === 'none' || !gm || gm.noValidation){ out.checked = false; return out; }

  var decks = opts.decks || null;
  var sum = function(list){ return (list || []).reduce(function(a, b){ return a + (b.count|0); }, 0); };
  /* With a Lord, counted again from the entries when they are at hand, so the Lord is left out whoever is asking. */
  var main = (gm.lord && decks && decks.main) ? deckMainCount(decks.main, mode) : (totals.main|0);
  var ess = totals.essence|0, wish = totals.wish|0;
  var arm = (totals.armament != null) ? (totals.armament|0) : (decks ? sum(decks.armament) : 0);
  var anyCards = Math.max(totals.main|0, (decks && decks.main) ? sum(decks.main) : 0) + ess + wish + arm > 0;
  var warn = function(s){ out.sizeWarns.push(s); out.legal = false; };
  var cards = function(n){ return n + ' card' + (n !== 1 ? 's' : ''); };

  /* A deck with no cards at all is not judged; one with cards anywhere is, so an empty Main Deck beside a full Essence Deck fails. */
  var mnMin = gm.mainMin || 0, mnMax = (gm.mainMax == null ? Infinity : gm.mainMax);
  if(anyCards && main < mnMin) warn('Main Deck has ' + cards(main) + ' (minimum ' + mnMin + ')');
  if(main > mnMax)             warn('Main Deck has ' + cards(main) + ' (maximum ' + mnMax + ')');

  /* Before the sizeOnly return: Character is sizeOnly and this is its rule. The Build Deck page names the cards itself. */
  if(gm.armamentOnly && opts.cardMap && opts.decks && opts.decks.armament){
    opts.decks.armament.forEach(function(en){
      var c = opts.cardMap[en.name];
      if(c && !_isGearCard(c)) out.legal = false;
    });
  }

  if(gm.sizeOnly) return out;

  if(anyCards && typeof gm.essMax === 'function' && typeof gm.wishMax === 'function'){
    var maxEss = gm.essMax(main), maxWish = gm.wishMax(main);
    var minEss = (typeof gm.essMin === 'function') ? gm.essMin(main) : 0;
    var minWish = (typeof gm.wishMin === 'function') ? gm.wishMin(main) : 0;
    if(ess > maxEss)  warn('Essence Deck has ' + cards(ess) + ' but max is ' + maxEss);
    if(ess < minEss)  warn('Essence Deck has ' + cards(ess) + ' but needs ' + minEss);
    if(wish > maxWish){
      if(maxWish === 0) warn(gm.label + ' does not use a Wish Deck (has ' + cards(wish) + ')');
      else              warn('Wish Deck has ' + cards(wish) + ' but max is ' + maxWish);
    }
    if(wish < minWish) warn('Wish Deck has ' + cards(wish) + ' but needs ' + minWish);
  }

  /* Only when asked (opts.combined): the Build Deck page reports these itself, card by card. */
  var cardMap = opts.cardMap;
  if(opts.combined && cardMap){
    var isK = (mode === 'kingdoms');
    Object.keys(opts.combined).forEach(function(name){
      var card = cardMap[name]; if(!card) return;
      if(_isUnlimitedCard(card)) return;
      var limit;
      if(mode === 'arena') limit = Infinity;
      else if(isK)         limit = 1;
      else                 limit = _isUniqueCard(card) ? 1 : DECK_LIMIT;
      if(opts.combined[name] > limit) out.legal = false;
    });
    if(isK && opts.decks){
      var uniq = 0;
      ['main','wish','essence'].forEach(function(k){
        (opts.decks[k] || []).forEach(function(en){
          var c = cardMap[en.name];
          if(c && _isUniqueCard(c)) uniq += en.count;
        });
      });
      if(uniq > 10) out.legal = false;
    }
  }

  if(cardMap && decks){
    if(gm.dualMax){
      var duals = deckDualCounts(decks, cardMap);
      Object.keys(duals).forEach(function(n){ if(duals[n] > gm.dualMax) out.legal = false; });
    }
    if(gm.lord){
      var lord = deckLordCard(decks.main, cardMap);
      if(lord && _isUniqueCard(lord) && deckUniqueBesideLord(decks, cardMap).length) out.legal = false;
    }
  }
  return out;
}
window.deckLegality = deckLegality;
function deckDualCounts(decks, cardMap){
  var out = Object.create(null);
  ['main', 'wish', 'essence', 'armament'].forEach(function(k){
    ((decks && decks[k]) || []).forEach(function(en){
      var c = cardMap[en.name];
      if(c && _isDualEssence(c)) out[en.name] = (out[en.name] || 0) + (en.count|0);
    });
  });
  return out;
}
/* The Lord's own entry counts only the copies beyond the Lord. */
function deckUniqueBesideLord(decks, cardMap){
  var lordEn = ((decks && decks.main) || []).filter(function(x){ return x && x.lord; })[0];
  var out = [];
  ['main', 'wish', 'essence'].forEach(function(k){
    ((decks && decks[k]) || []).forEach(function(en){
      var c = cardMap[en.name];
      if(!c || !_isUniqueCard(c)) return;
      var n = en.count|0;
      if(en === lordEn) n -= 1;
      if(n > 0) out.push({name:en.name, count:n, key:k});
    });
  });
  return out;
}

/* _hashLoadDeck ran above and left the type for here; only a type this game's box offers is taken. */
var _gameMode = (window._pendingDeckMode && DECK_TAB_TYPES.indexOf(window._pendingDeckMode) >= 0)
  ? window._pendingDeckMode : DECK_TYPES[0];

function _fillDeckTypes(){
  var sel = document.getElementById('gmSelect');
  if(!sel) return;
  sel.innerHTML = DECK_TAB_TYPES.map(function(k){
    var gm = GAME_MODES[k];
    return "<option value='" + k + "'>" + (gm ? gm.label : 'None') + "</option>";
  }).join('');
  sel.value = _gameMode;
}

function setGameMode(mode){
  _gameMode = mode;
  var sel = document.getElementById('gmSelect');
  if(sel) sel.value = mode;
  updateDeckWarnings();
  refreshDeckView();
  if(typeof tdSyncStatRow === 'function') tdSyncStatRow();
  _hashSaveDeck();
}

function dvExportMenu(open){
  var mu = document.getElementById('dvExportMenu'); if(!mu) return;
  var on = (open === undefined) ? !mu.classList.contains('on') : !!open;
  mu.classList.toggle('on', on);
  var b = document.getElementById('dvExportBtn'); if(b) b.classList.toggle('on', on);
}
document.addEventListener('click', function(ev){
  var w = document.getElementById('dvExport');
  if(w && !w.contains(ev.target)) dvExportMenu(false);
});
document.addEventListener('keydown', function(ev){ if(ev.key === 'Escape') dvExportMenu(false); });

function showDeckRules(){
  if(typeof catIsPhone === 'function' && catIsPhone() && typeof mobSheetOpen === 'function'){ mobSheetOpen('rules'); return; }
  var modes = REBIRTH ? ['character','encounter','rewards'] : ['constructed','kingdoms','arena'];
  var modeLabels = {};
  modes.forEach(function(m){ modeLabels[m] = (GAME_MODES[m] && GAME_MODES[m].label) || m; });
  var orderedTitles = [];
  modes.forEach(function(m){
    var gm = GAME_MODES[m]; if(!gm) return;
    gm.rules.forEach(function(r){
      if(orderedTitles.indexOf(r.title)<0) orderedTitles.push(r.title);
    });
  });
  var ruleMap = {};
  orderedTitles.forEach(function(t){ ruleMap[t] = {}; });
  modes.forEach(function(m){
    var gm = GAME_MODES[m]; if(!gm) return;
    gm.rules.forEach(function(r){ ruleMap[r.title][m] = r.text; });
  });

  var headerCells = '<th style="padding:10px 12px;border:1px solid var(--b1);background:var(--s2);font-family:Cinzel,serif;font-size:.8rem;font-weight:700;color:var(--txt-accent);letter-spacing:.06em;text-align:left;min-width:110px">Rule</th>';
  modes.forEach(function(m){
    headerCells += '<th style="padding:10px 12px;border:1px solid var(--b1);background:var(--s2);font-family:Cinzel,serif;font-size:.8rem;font-weight:700;color:var(--txt-accent);letter-spacing:.06em;text-align:center">'+modeLabels[m]+'</th>';
  });

  var rows = '';
  orderedTitles.forEach(function(title, i){
    var cells = '';
    modes.forEach(function(m){
      var note = GAME_MODES[m] && GAME_MODES[m].note;
      if(note){
        if(!i) cells += '<td rowspan="'+orderedTitles.length+'" style="padding:8px 12px;border:1px solid var(--b1);font-size:.9rem;color:var(--tx);vertical-align:top;text-align:left">'+note+'</td>';
        return;
      }
      var txt = ruleMap[title][m];
      if(txt) cells += '<td style="padding:8px 12px;border:1px solid var(--b1);font-size:.9rem;color:var(--tx)">'+txt+'</td>';
      else cells += '<td style="padding:8px 12px;border:1px solid var(--b1);color:var(--tm);text-align:center">&mdash;</td>';
    });
    rows += '<tr><td style="padding:8px 12px;border:1px solid var(--b1);font-family:Cinzel,serif;font-size:.85rem;font-weight:700;color:var(--txt-accent);white-space:nowrap">'+title+'</td>'+cells+'</tr>';
  });

  closeDeckRules();                     /* one at a time: a second press redraws it */
  var el = document.createElement('div');
  el.id = 'deckRulesOverlay';
  el.style.cssText = 'position:fixed;inset:0;z-index:500;display:flex;align-items:center;justify-content:center';
  el.className = 'kw-overlay';
  el.onclick = function(ev){ if(ev.target===el) closeDeckRules(); };
  el.innerHTML =
    '<div class="kw-page" style="max-width:1100px;width:95%;max-height:85vh;overflow-y:auto;padding:0">'+
    '<div class="kw-page-hdr wh">'+
      '<b class="wh-t">'+uiIco('book')+' Deck Rules</b>'+
      '<button class="kw-close nb nb-red nb-m wh-x" onclick="closeDeckRules()">Close &#x2715;</button>'+
    '</div>'+
    '<div style="padding:0 14px 14px;overflow-x:auto">'+
      '<table style="width:100%;border-collapse:collapse">'+
        '<thead><tr>'+headerCells+'</tr></thead>'+
        '<tbody>'+rows+'</tbody>'+
      '</table>'+
    '</div>'+
    '</div>';
  document.body.appendChild(el);
  if(typeof modalOpen === 'function') modalOpen(el, {label:'Deck Rules', onClose:closeDeckRules});
}
function closeDeckRules(){
  var el = document.getElementById('deckRulesOverlay');
  if(!el) return;
  if(typeof modalClose === 'function') modalClose(el);
  el.parentNode.removeChild(el);
}
function populateEssence(){
  if(!DECK_IDS.essence) return;
  var essTA = document.getElementById(DECK_IDS.essence);
  if(essTA && essTA.value.trim()){
    alert('You can only Auto-Populate the Essence Deck if it is empty.');
    return;
  }

  var mainTA = document.getElementById(DECK_IDS.main);
  if(!mainTA || !mainTA.value.trim()){
    alert('Your Main Deck is empty. Add cards before populating Essence.');
    return;
  }

  var cardMap = {};
  CARDS.forEach(function(c){ cardMap[c.name] = c; });

  var mainEntries = parseDeckIn(DECK_IDS.main);

  var totalMainCards = mainEntries.reduce(function(a,b){return a+b.count;},0);
  /* The format's own essMin when it has one: a third of the Main Deck would fail Constructed's 15 and Kingdoms' 33. */
  var _gmE = (typeof GAME_MODES !== 'undefined') ? GAME_MODES[_gameMode] : null;
  var essenceSlots = (_gmE && typeof _gmE.essMin === 'function')
    ? _gmE.essMin(totalMainCards) : Math.floor(totalMainCards / 3);
  if(essenceSlots < 1){ alert('Not enough cards in Main Deck (need at least 3).'); return; }

  var pipC = {}; COLORS.forEach(function(c){pipC[c]=0;});
  mainEntries.forEach(function(entry){
    var card = cardMap[entry.name]; if(!card) return;
    var p = manaPips(card.manaCost, entry.count);
    Object.keys(p).forEach(function(c){ pipC[c]=(pipC[c]||0)+p[c]; });
  });

  var pipColors = COLORS.filter(function(c){return pipC[c]>0;});
  if(!pipColors.length){ alert('No colored mana pips found in Main Deck.'); return; }

  var totalPips = pipColors.reduce(function(a,c){return a+pipC[c];},0);

  var raw = {};
  pipColors.forEach(function(c){ raw[c] = (pipC[c]/totalPips) * essenceSlots; });

  var floored = {}, remainders = [];
  var floorSum = 0;
  pipColors.forEach(function(c){
    floored[c] = Math.max(1, Math.floor(raw[c]));
    floorSum += floored[c];
  });

  while(floorSum > essenceSlots && pipColors.length > 0){
    var biggest = pipColors.slice().sort(function(a,b){return floored[b]-floored[a];})[0];
    if(floored[biggest] <= 1) break;
    floored[biggest]--;
    floorSum--;
  }

  pipColors.forEach(function(c){
    remainders.push({c:c, rem: raw[c]-floored[c]});
  });
  var leftover = essenceSlots - floorSum;
  remainders.sort(function(a,b){
    if(Math.abs(b.rem - a.rem) > 0.0001) return b.rem - a.rem;
    return floored[a.c] - floored[b.c];
  });
  for(var k=0; k<leftover; k++) floored[remainders[k % remainders.length].c]++;

  var ESS_COLOR_TO_SUB = {Red:'Ire',Orange:'Vig',Yellow:'Lux',Green:'Arch',Blue:'Yune',Indigo:'Psy',Violet:'Gris'};

  var lines = [];
  pipColors.forEach(function(c){
    var qty = floored[c]; if(!qty) return;
    var sub = ESS_COLOR_TO_SUB[c]; if(!sub) return;
    var match = CARDS.filter(function(card){
      var sa = _catArr(card.superTypes).map(function(s){return String(s).toLowerCase();});
      return sa.indexOf('core')>=0 && sa.indexOf('essence')>=0 && _catArr(card.subTypes).indexOf(sub)>=0;
    })[0];
    if(match){
      lines.push(qty+'x '+match.name);
    } else {
      lines.push(qty+'x Core '+sub+' Essence');
    }
  });

  if(!lines.length){ alert('No Core Essence cards found in catalog matching your mana pip colors.'); return; }

  essTA.value = lines.join('\n');
  updCnt(); _hashSaveDeck();
  var btn=document.getElementById('popEssBtn');
  if(btn){ var orig=btn.innerHTML; btn.innerHTML='\u2713 Done'; setTimeout(function(){btn.innerHTML=orig;},1600); }
  refreshDeckView();
}

/* Saved Decks' Sort (the author, 9 November), kept between visits. Chronological is the order the decks were first saved in, which
   storage keeps (a rename keeps its place, cat_tail.js); Color goes by the colours of each Main Deck in ROYGBIV order, colourless last;
   Color Count by how many colours, fewest first. */
var SAVED_SORTS = ['alpha', 'chrono', 'color', 'count', 'newest'];
function _savedSortGet(){
  var v = '';
  try{ v = localStorage.getItem('conjure_saved_sort') || ''; }catch(_){}
  return SAVED_SORTS.indexOf(v) >= 0 ? v : 'alpha';
}
function setSavedSort(v){
  if(SAVED_SORTS.indexOf(v) < 0) v = 'alpha';
  try{ localStorage.setItem('conjure_saved_sort', v); }catch(_){}
  renderSavedDecks();
}
window.setSavedSort = setSavedSort;
/* The Main Deck's colours as ROYGBIV places, counted by manaPips as the Deck Lists page counts them. */
function _savedColorsOf(entry, cardMap){
  var text = typeof entry === 'string' ? entry : ((entry && entry.main) || ''), has = {};
  deckCanonEntries(parseDeckLines(text), true).forEach(function(en){
    var card = cardMap[en.name]; if(!card) return;
    var p = manaPips(card.manaCost, en.count);
    Object.keys(p).forEach(function(c){ if(p[c] > 0) has[c] = true; });
  });
  return ROYGBIV.map(function(c, i){ return has[c] ? i : -1; }).filter(function(i){ return i >= 0; });
}
function _savedOrder(saved, how){
  var names = Object.keys(saved);
  var byName = function(a, b){ return a.localeCompare(b, undefined, {sensitivity:'base', numeric:true}) || (a < b ? -1 : a > b ? 1 : 0); };
  if(how === 'chrono') return names;
  if(how === 'newest') return names.reverse();
  if(how === 'color' || how === 'count'){
    var cardMap = Object.create(null), col = {};
    ((typeof CARDS !== 'undefined' && CARDS) || []).forEach(function(c){ if(c && c.name != null) cardMap[c.name] = c; });
    names.forEach(function(n){ col[n] = _savedColorsOf(saved[n], cardMap); });
    var byColor = function(a, b){
      var x = col[a], y = col[b];
      if(!x.length !== !y.length) return x.length ? -1 : 1;
      for(var i = 0; i < Math.min(x.length, y.length); i++) if(x[i] !== y[i]) return x[i] - y[i];
      return x.length - y.length;
    };
    return names.sort(function(a, b){ return (how === 'count' ? col[a].length - col[b].length : 0) || byColor(a, b) || byName(a, b); });
  }
  return names.sort(byName);
}
function renderSavedDecks(){
  var saved = _savedLoad();
  var listEl = document.getElementById('savedList');
  if(!listEl) return;
  listEl.innerHTML = '';
  var how = _savedSortGet(), sortEl = document.getElementById('savedSort');
  if(sortEl && sortEl.value !== how) sortEl.value = how;
  var names = _savedOrder(saved, how);
  if(!names.length){
    listEl.innerHTML = '<div style="padding:6px 11px;font-size:.8rem;color:var(--tm);font-style:italic">No saved decks yet.</div>';
    return;
  }
  names.forEach(function(name){
    var row = document.createElement('div'); row.className='saved-row';
    var nm = document.createElement('span'); nm.className='saved-name'; nm.title='Load: '+name; nm.textContent=name;
    nm.addEventListener('click', function(){
      if(confirm('Load "'+name+'"? This will replace your deck lists.')) {
        var entry = saved[name];
        // a deck saved before sections is one string
        if(typeof entry === 'string'){
          getActiveDeck().value = entry;
        } else {
          Object.keys(DECK_IDS).forEach(function(k){
            var el = document.getElementById(DECK_IDS[k]);
            if(el) el.value = entry[k]||'';
          });
        }
        /* The mode first: tdReadStatRow answers null unless Character is current, so _hashSaveDeck would drop the row just written. */
        try{ if(entry && entry.mode && typeof setGameMode === 'function')
          setGameMode(entry.mode); }catch(_){}
        try{ if(typeof tdWriteStatRow === 'function') tdWriteStatRow(entry); }catch(_){}
        try{ if(typeof tdSyncStatRow === 'function') tdSyncStatRow(); }catch(_){}
        _activeDeckId = DECK_IDS.main; _markActiveSection();
        updCnt(); _hashSaveDeck(); refreshDeckView();
      }
    });
    /* Save (the deck lists as they stand, under this name) and Duplicate, left of the delete (the author, 8 November). */
    var sv = document.createElement('button'); sv.type='button'; sv.className='saved-save nb nb-green nb-s';
    sv.title='Save to "'+name+'"'; sv.setAttribute('aria-label','Save the deck lists as '+name); sv.innerHTML=uiIco('save');
    sv.addEventListener('click', function(){ saveDeckTo(name); });
    var dup = document.createElement('button'); dup.type='button'; dup.className='saved-dup nb nb-purple nb-s';
    dup.title='Duplicate'; dup.setAttribute('aria-label','Duplicate '+name); dup.innerHTML=uiIco('copy');
    dup.addEventListener('click', function(){ if(savedDeckDuplicate(name)) _savedChanged(); });
    var del = document.createElement('button'); del.type='button'; del.className='saved-del nb nb-red nb-s';
    del.title='Delete'; del.setAttribute('aria-label','Delete '+name); del.textContent='\u2715';
    del.addEventListener('click', function(){
      if(confirm('Delete saved deck "'+name+'"?')){
        var d=_savedLoad(); delete d[name]; _savedWrite(d); renderSavedDecks();
      }
    });
    row.appendChild(nm); row.appendChild(sv); row.appendChild(dup); row.appendChild(del);
    listEl.appendChild(row);
  });
}
function saveDeckAs(){
  var inp = document.getElementById('savedNameInp');
  var name = inp ? inp.value.trim() : '';
  if(!name){ inp && inp.focus(); return; }
  if(!saveDeckTo(name)) return;
  if(inp) inp.value = '';
  var btn = document.getElementById('savedSaveBtn');
  if(btn){ var orig=btn.textContent; btn.textContent='\u2713 Saved'; setTimeout(function(){ btn.textContent=orig; },1400); }
}
/* The deck lists as they stand, under that name, asking before one is overwritten: the Save field's and each saved deck's own Save. */
function saveDeckTo(name){
  var allEmpty = true;
  var entry = {};
  Object.keys(DECK_IDS).forEach(function(k){
    var el = document.getElementById(DECK_IDS[k]);
    var v = el ? el.value.trim() : '';
    entry[k] = v;
    if(v) allEmpty = false;
  });
  if(allEmpty){ alert('All deck lists are empty.'); return false; }
  entry.mode = _gameMode;
  /* Only when there is something to write, so a main-game deck's saved shape is unchanged. */
  if(typeof tdReadStatRow === 'function'){
    var st = tdReadStatRow();
    if(st) Object.keys(st).forEach(function(k){ entry[k] = st[k]; });
  }
  var d = _savedLoad();
  if(d[name] && !confirm('"'+name+'" already exists. Overwrite?')) return false;
  d[name] = entry;
  /* Nothing below may run after a failed write: each of them says the deck was saved. */
  if(!_savedWrite(d)) return false;
  _savedChanged();
  return true;
}
/* A copy under the next free "(Copy)" name, as Deck Lists' Duplicate names it; '' when there is none to copy or the write failed. */
function savedDeckDuplicate(dn){
  var d = _savedLoad();
  if(!d[dn]) return '';
  var copyName = dn + ' (Copy)', n = 2;
  while(d[copyName]){ copyName = dn + ' (Copy '+n+')'; n++; }
  d[copyName] = JSON.parse(JSON.stringify(d[dn]));
  return _savedWrite(d) ? copyName : '';
}
function _savedChanged(){
  renderSavedDecks();
  _dlDirty = true;
  var dlPane = document.getElementById('pane-decklists');
  if(dlPane && dlPane.style.display !== 'none') { _dlDirty=false; renderDeckLists(); }
  _updateDLCount();
}
/* Saved Decks' arrow: open, the list takes the panel from the deck lists (catalog.css); shut, it is the strip under them. */
function toggleSavedDecks(open){
  var dp = document.querySelector('.dp'), b = document.getElementById('savedTog');
  if(!dp) return;
  open = (open === undefined) ? !dp.classList.contains('saved-open') : !!open;
  dp.classList.toggle('saved-open', open);
  if(b){
    var say = open ? 'Collapse Saved Decks' : 'Expand Saved Decks';
    b.setAttribute('aria-expanded', open ? 'true' : 'false');
    b.setAttribute('aria-label', say); b.title = say;
    b.innerHTML = uiIco(open ? 'arrow-down' : 'arrow-up');
  }
}

function _updateDLCount(){
  var saved = _savedLoad();
  var n = Object.keys(saved).length;
  if(typeof mobOnLists === 'function') mobOnLists(n);
  var badge = document.getElementById('dlCount');
  if(!badge) return;
  badge.textContent = n ? String(n) : '';
  badge.classList.toggle('on', !!n);
  /* the count is part of the tab row, so the row is fitted again */
  if(typeof window.catRefitTabs === 'function') window.catRefitTabs();
}

var DECK_LIMIT = 3;
/* Unique only on the keyword line (the first line of the rules text), as tdFxKeywords reads it: a card that mentions Unique cards is not Unique. */
function _isUniqueCard(card){
  var first = String((card && card.ruleText) || '').split(/\r?\n/)[0] || '';
  first = first.replace(/<[^>]*>/g, ' ');
  return first.split(',').some(function(part){
    return part.replace(/[.\s]+$/, '').trim().toLowerCase() === 'unique';
  });
}
function _isUnlimitedCard(card){
  var rt = String(card.ruleText||'').toLowerCase();
  if(rt.indexOf('unlimited') >= 0) return true;
  var superArr = _catArr(card.superTypes).map(function(s){return String(s).toLowerCase();});
  return superArr.indexOf('essence') >= 0 && superArr.indexOf('core') >= 0;
}

function updateDeckWarnings(){
  if(GAME_MODES[_gameMode] && GAME_MODES[_gameMode].draftPool){
    var dbox = document.getElementById('deckWarnBox');
    if(dbox && typeof drPoolOf === 'function'){
      var dp = drPoolOf(drDeckEntry(''));
      dbox.innerHTML = '<div class="deck-warn-box dr-poolbox"><div class="deck-warn-row pool">'
        + '<span class="deck-warn-icon">'+uiIco('flag')+'</span><span>' + drPoolLineHTML(dp) + '</span>'
        + '<button class="ed2-btn tbl-green dr-poolgo" id="drPoolGo" onclick="drSetupOpen(\'\')"'
        + (dp.names.length ? '' : ' disabled') + '>Draft</button></div></div>';
    }
    return;
  }
  if(_gameMode === 'none'
     || (GAME_MODES[_gameMode] && GAME_MODES[_gameMode].noValidation)){
    var box = document.getElementById('deckWarnBox');
    if(box) box.innerHTML = '';
    return;
  }
  var cardMap = {};
  CARDS.forEach(function(c){ cardMap[c.name] = c; });

  var mainDeck    = parseDeckIn(DECK_IDS.main);
  var wishDeck    = parseDeckIn(DECK_IDS.wish);
  var essenceDeck = parseDeckIn(DECK_IDS.essence);

  var over=[], unique=[], missing=[], wrongDeck=[], lordUnique=[];
  var gm = (typeof GAME_MODES!=='undefined' && GAME_MODES[_gameMode]) ? GAME_MODES[_gameMode] : null;
  var isKingdoms = _gameMode === 'kingdoms';

  function getCopyLimit(card, inEssence){
    if(_isUnlimitedCard(card)) return Infinity;
    if(gm && gm.sizeOnly) return Infinity;
    if(_gameMode === 'arena') return Infinity;
    if(isKingdoms){
      if(inEssence){
        var sa=_catArr(card.superTypes).map(function(s){return String(s).toLowerCase();});
        if(sa.indexOf('dual')>=0) return 3;
        return 1;
      }
      /* 1, not 0, for a Unique card too: Kingdoms limits Unique cards by their total, below. */
      return 1;
    }
    return _isUniqueCard(card) ? 1 : DECK_LIMIT;
  }

  var combined = {};
  mainDeck.concat(wishDeck).forEach(function(entry){
    combined[entry.name] = (combined[entry.name]||0) + entry.count;
  });
  Object.keys(combined).forEach(function(name){
    var card = cardMap[name]; if(!card) return;
    if(_isUnlimitedCard(card)) return;
    var limit = getCopyLimit(card, false);
    var total = combined[name];
    if(total > limit){
      if(limit===1 && !isKingdoms) unique.push({name:name, count:total, note:''});
      else if(limit===1 && isKingdoms) over.push({name:name, count:total, limit:1, note:'(Main+Wish, Kingdoms: 1 copy max)'});
      else if(total > limit) over.push({name:name, count:total, limit:limit, note:'(Main+Wish)'});
    }
  });

  if(isKingdoms){
    var allUniqueCt = 0;
    mainDeck.concat(wishDeck).concat(essenceDeck).forEach(function(entry){
      var card=cardMap[entry.name]; if(!card) return;
      if(_isUniqueCard(card)) allUniqueCt += entry.count;
    });
    if(allUniqueCt > 10)
      over.push({name:'Unique cards total', count:allUniqueCt, limit:10, note:'(Kingdoms: max 10 Unique across all decks)'});
  }
  if(gm && gm.lord){
    var lordCard = deckLordCard(mainDeck, cardMap);
    if(lordCard && _isUniqueCard(lordCard)){
      deckUniqueBesideLord({main:mainDeck, wish:wishDeck, essence:essenceDeck}, cardMap).forEach(function(u){
        lordUnique.push({name:u.name, lord:lordCard.name, section:DECK_LABELS[u.key] || u.key});
      });
    }
  }
  if(gm && gm.dualMax){
    var duals = deckDualCounts({main:mainDeck, wish:wishDeck, essence:essenceDeck}, cardMap);
    Object.keys(duals).forEach(function(n){
      if(duals[n] > gm.dualMax)
        over.push({name:n, count:duals[n], limit:gm.dualMax, note:'(' + gm.label + ': ' + gm.dualMax + ' of each Dual Essence)'});
    });
  }

  var essUnique = [], essOver = [];
  essenceDeck.forEach(function(entry){
    var card = cardMap[entry.name]; if(!card) return;
    if(_isUnlimitedCard(card)) return;
    var limit = getCopyLimit(card, true);
    if(entry.count > limit){
      if(limit===1) essUnique.push({name:entry.name, count:entry.count});
      else essOver.push({name:entry.name, count:entry.count, limit:limit});
    }
  });

  var seenMissing = {};
  Object.keys(DECK_IDS).forEach(function(key){
    var entries = (key==='main') ? mainDeck
                : (key==='essence') ? essenceDeck
                : (key==='wish') ? wishDeck
                : parseDeckIn(DECK_IDS[key]);
    (entries||[]).forEach(function(entry){
      if(cardMap[entry.name]){
        if(key === 'armament' && gm && gm.armamentOnly && !_isGearCard(cardMap[entry.name])
           && !seenMissing['arm ' + entry.name]){
          seenMissing['arm ' + entry.name] = 1;
          wrongDeck.push({name:entry.name, issue:'only Armament, Ongoing, Character and Background cards may be in the Armament deck'});
        }
        return;
      }
      var mk = key + ' ' + entry.name;
      if(seenMissing[mk]) return;
      seenMissing[mk] = 1;
      missing.push({name:entry.name, section:DECK_LABELS[key]});
    });
  });

  if(_gameMode !== 'arena' && !(gm && gm.sizeOnly)){
    essenceDeck.forEach(function(entry){
      var card = cardMap[entry.name]; if(!card) return;
      if(!_isEssenceCard(card)) wrongDeck.push({name:entry.name, issue:'non-essence in Essence Deck'});
    });
    mainDeck.concat(wishDeck).forEach(function(entry){
      var card = cardMap[entry.name]; if(!card) return;
      if(_isEssenceCard(card)) wrongDeck.push({name:entry.name, issue:'Essence card in '+(mainDeck.indexOf(entry)>=0?'Main':'Wish')+' Deck'});
    });
  }

  /* No card map is passed, so deckLegality judges only the sizes; the per-card rows above are this page's own. */
  var armDeck   = DECK_IDS.armament ? parseDeckIn(DECK_IDS.armament) : [];
  var sumOf = function(list){ return list.reduce(function(a,b){return a+b.count;},0); };
  var sizeWarns = deckLegality(_gameMode,
    {main:deckMainCount(mainDeck, _gameMode), essence:sumOf(essenceDeck), wish:sumOf(wishDeck), armament:sumOf(armDeck)},
    {decks:{main:mainDeck, essence:essenceDeck, wish:wishDeck, armament:armDeck}}).sizeWarns;

  var box = document.getElementById('deckWarnBox');
  if(!box) return;
  var h = '';
  sizeWarns.forEach(function(w){
    h += '<div class="deck-warn-row over"><span class="deck-warn-icon">'+uiIco('scale')+'</span>'+e(w)+'</div>';
  });
  over.forEach(function(w){
    h += '<div class="deck-warn-row over"><span class="deck-warn-icon">'+uiIco('warn')+'</span>'+e(w.name)+': <strong>'+w.count+'x</strong> (max '+w.limit+') '+e(w.note||'')+'</div>';
  });
  unique.forEach(function(w){
    h += '<div class="deck-warn-row unique"><span class="deck-warn-icon">'+uiIco('star')+'</span>'+e(w.name)+' is <strong>Unique</strong> \u2014 1 copy max across Main+Wish (have '+w.count+') '+e(w.note||'')+'</div>';
  });
  lordUnique.forEach(function(w){
    h += '<div class="deck-warn-row unique lord-unique"><span class="deck-warn-icon">'+uiIco('star')+'</span>'+e(w.name)+' is <strong>Unique</strong> \u2014 your Lord, '+e(w.lord)+', has Unique, so no other Unique card may be in any deck ('+e(w.section)+')</div>';
  });
  wrongDeck.forEach(function(w){
    h += '<div class="deck-warn-row over"><span class="deck-warn-icon">'+uiIco('x')+'</span>'+e(w.name)+' \u2014 '+e(w.issue)+'</div>';
  });
  essOver.forEach(function(w){
    h += '<div class="deck-warn-row over"><span class="deck-warn-icon">'+uiIco('warn')+'</span>[Essence] '+e(w.name)+': <strong>'+w.count+'x</strong> (max '+w.limit+')</div>';
  });
  essUnique.forEach(function(w){
    h += '<div class="deck-warn-row unique"><span class="deck-warn-icon">'+uiIco('star')+'</span>[Essence] '+e(w.name)+' is <strong>Unique</strong> \u2014 only 1 copy allowed (have '+w.count+')</div>';
  });
  missing.forEach(function(w){
    h += '<div class="deck-warn-row missing"><span class="deck-warn-icon">'+uiIco('help')+'</span>'+e(w.name)+' \u2014 not found in catalog ('+e(w.section)+')</div>';
  });
  box.innerHTML = h ? '<div class="deck-warn-box">'+h+'</div>' : '';
}
function updateStatSummary(){
  /* The Main Deck, whichever section is picked: these sit under its charts. */
  var deck = parseDeckIn(DECK_IDS.main);
  var cardMap = {};
  CARDS.forEach(function(c){ cardMap[c.name] = c; });
  var cmcList=[], totalCmc=0, validCmc=0;
  deck.forEach(function(entry){
    var card = cardMap[entry.name]; if(!card) return;
    var cmc = parseFloat(card.cmc);
    if(!isNaN(cmc)){
      for(var n=0;n<entry.count;n++) cmcList.push(cmc);
      totalCmc += cmc * entry.count;
      validCmc += entry.count;
    }
  });
  var avgCmc = validCmc ? (totalCmc/validCmc).toFixed(2) : '--';
  var stdDev = '--';
  if(validCmc > 1){
    var mean = totalCmc/validCmc;
    var variance = cmcList.reduce(function(s,v){return s+(v-mean)*(v-mean);},0)/validCmc;
    stdDev = Math.sqrt(variance).toFixed(2);
  }
  var modeCounts={};
  cmcList.forEach(function(v){ modeCounts[v]=(modeCounts[v]||0)+1; });
  var modeVal = '--';
  if(cmcList.length){
    var best=0;
    Object.keys(modeCounts).forEach(function(k){ if(modeCounts[k]>best){best=modeCounts[k];modeVal=k;} });
  }
  var set = function(id,v){ var el=document.getElementById(id); if(el) el.textContent=v; };
  set('statAvgCmc', avgCmc);
  set('statTotalCmc', validCmc ? totalCmc.toString() : '--');
  set('statStdDev', stdDev);
  set('statMode', modeVal);
}

/* Import reads the headings Copy writes (DECK_COPY_HEADS); the match is on the words alone, punctuation and "deck" thrown away. */
var DECK_HEAD_WORDS = {
  deck:'main', main:'main', maindeck:'main',
  essence:'essence', wish:'wish', armament:'armament', sideboard:'wish'
};
function _deckHeadKey(line){
  var words = String(line || '')
    .replace(/[^\w ]+/g, ' ')
    .trim().toLowerCase();
  if(!words) return null;
  var t = words.replace(/\bdeck\b/g, ' ').replace(/\s+/g, '');
  /* the word "deck" alone: the Main Deck's heading, as DECK_COPY_HEADS writes it */
  if(!t) t = 'deck';
  var key = DECK_HEAD_WORDS[t] || null;
  /* A card line never matches: "2x Essence Ward" reduces to "2xessenceward", which is not in the table. */
  if(!key) return null;
  return DECK_IDS[key] ? key : null;
}
function _splitDeckSections(text){
  var lines = String(text || '').split(/\r?\n/);
  var cur = 'main', any = false;
  var out = {};
  Object.keys(DECK_IDS).forEach(function(k){ out[k] = []; });
  lines.forEach(function(ln){
    var k = _deckHeadKey(ln);
    if(k){ cur = k; any = true; return; }
    (out[cur] || out.main).push(ln);
  });
  return {sections:out, headed:any};
}
function _parseDeckText(text){
  var out = resolveDeckEntries(parseDeckLines(text));
  out.stats = deckStatsFromText(text);
  /* The whole-text parse above still answers the "resolved to anything" gate: per section, one good section and two empty would be two failures. */
  var sp = _splitDeckSections(text);
  out.headed = sp.headed;
  out.sections = {};
  if(sp.headed){
    Object.keys(sp.sections).forEach(function(k){
      var t = sp.sections[k].join('\n').trim();
      out.sections[k] = t ? resolveDeckEntries(parseDeckLines(t)) : {entries:[], unmatched:[]};
    });
  }
  return out;
}
function _applyImport(parsed){
  var entries = parsed.entries, unmatched = parsed.unmatched;
  /* The stats before the cards and the early return: a fresh Rebirth catalog can resolve no card, and the four values must not go with it. */
  var stats = (parsed.stats && Object.keys(parsed.stats).length) ? parsed.stats : null;
  var tookStats = false;
  if(stats && typeof tdWriteStatRow === 'function' && typeof tdReadStatRow === 'function'){
    var row0 = tdReadStatRow();
    if(row0){
      Object.keys(stats).forEach(function(k){ row0[k] = stats[k]; });
      tdWriteStatRow(row0);
      deckStatsSyncToText();
      _hashSaveDeck();
      tookStats = true;
    }
  }
  if(!entries.length){
    /* Text that was only a stat block is not a failed import. */
    if(tookStats && !unmatched.length){
      var sb = document.querySelector('.dim');
      if(sb){ var so = sb.textContent; sb.textContent = 'Stats set';
              setTimeout(function(){ sb.textContent = so; }, 2200); }
      return;
    }
    var msg = 'No matching cards found.';
    if(unmatched.length) msg += '\n\nUnrecognised names:\n  ' + unmatched.slice(0,10).join('\n  ') + (unmatched.length>10 ? '\n  \u2026and '+(unmatched.length-10)+' more':'');
    msg += '\n\nCheck that card names match exactly.';
    alert(msg); return;
  }
  /* An unheaded paste goes to the picked section, not one guessed from the catalogue; only Essence cards are then moved (deckSortEssence). */
  if(parsed.headed && parsed.sections){
    _applySectioned(parsed);
    return;
  }
  var ta = getActiveDeck();
  // Rewrites the textarea, so a hand-typed line loses its formatting here: a deliberate part of importing.
  var merged = parseDeck(), at = {};
  merged.forEach(function(en, i){ at[en.name] = i; });
  entries.forEach(function(en){
    if(at[en.name] !== undefined){
      merged[at[en.name]].count += en.count;
      if(en.lord) merged[at[en.name]].lord = true;
    }
    else { at[en.name] = merged.length; merged.push({name:en.name, count:en.count, lord:en.lord}); }
  });
  /* formatDeckLines writes the cards alone, so the stat block is put back on top. */
  ta.value = formatDeckLines(merged);
  deckSortEssence();
  deckSortGear();
  deckStatsSyncToText();
  updCnt();
  _hashSaveDeck();
  var btn = document.querySelector('.dim');
  if(btn){
    var orig = btn.textContent;
    btn.textContent = '+'+entries.length+(unmatched.length ? ' ('+unmatched.length+' skipped)':'');
    setTimeout(function(){ btn.textContent = orig; }, 2200);
  }
  if(unmatched.length) console.warn('Skipped unmatched lines:', unmatched);
}

/* A section the paste does not name is left alone: a rebuild that wrote every textarea would empty it. */
function _applySectioned(parsed){
  var added = 0, skipped = 0, touched = [];
  Object.keys(DECK_IDS).forEach(function(key){
    var sec = parsed.sections[key];
    if(!sec || !sec.entries.length){
      if(sec && sec.unmatched.length) skipped += sec.unmatched.length;
      return;
    }
    var ta = document.getElementById(DECK_IDS[key]);
    if(!ta) return;
    var merged = parseDeckIn(ta.id), at = {};
    merged.forEach(function(en, i){ at[en.name] = i; });
    sec.entries.forEach(function(en){
      if(at[en.name] !== undefined){
        merged[at[en.name]].count += en.count;
        if(en.lord) merged[at[en.name]].lord = true;
      } else {
        at[en.name] = merged.length;
        merged.push({name:en.name, count:en.count, lord:en.lord});
      }
      added += en.count;
    });
    skipped += sec.unmatched.length;
    ta.value = formatDeckLines(merged);
    touched.push(DECK_LABELS[key] || key);
  });
  /* After every textarea, not in the loop: the stat block rides on the Main Deck's text. */
  deckSortEssence();
  deckSortGear();
  deckStatsSyncToText();
  updCnt();
  _hashSaveDeck();
  var btn = document.querySelector('.dim');
  if(btn){
    var orig = btn.textContent;
    btn.textContent = '+' + added + ' \u2192 ' + touched.length
      + (touched.length === 1 ? ' section' : ' sections')
      + (skipped ? ' (' + skipped + ' skipped)' : '');
    setTimeout(function(){ btn.textContent = orig; }, 2600);
  }
}

function importDeck(){
  if(navigator.clipboard && navigator.clipboard.readText){
    navigator.clipboard.readText().then(function(text){
      if(text && text.trim()){
        var parsed = _parseDeckText(text);
        /* Stats count too: a fresh Rebirth catalog can resolve no card, and the four values would never reach the row. */
        var hasStats = parsed.stats && Object.keys(parsed.stats).length;
        if(parsed.entries.length || hasStats){ _applyImport(parsed); return; }
      }
      document.getElementById('dimFile').click();
    }).catch(function(){ document.getElementById('dimFile').click(); });
  } else {
    document.getElementById('dimFile').click();
  }
}
function importDeckFile(input){
  var file = input.files[0]; if(!file) return;
  var reader = new FileReader();
  reader.onload = function(ev){ _applyImport(_parseDeckText(ev.target.result)); };
  reader.onerror = function(){
    var why = (reader.error && reader.error.name) ? ' (' + reader.error.name + ')' : '';
    if(typeof window.toast === 'function') window.toast('Could not read that file' + why + '. Nothing was imported.');
    else alert('Could not read that file' + why + '. Nothing was imported.');
  };
  reader.readAsText(file);
  input.value = '';
}

/* Returns escaped HTML, as _fmtDateList does: do not wrap it in e() again. */
function _fmtDate(iso){
  if(!iso) return '';
  iso = String(iso);
  var parts = iso.split('-');
  if(parts.length!==3) return e(iso);
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var d = parseInt(parts[2],10);
  var m = parseInt(parts[1],10)-1;
  var y = parts[0];
  return e(String(d).padStart(2,'0') + '-' + (months[m]||'???') + '-' + y);
}
function _fmtDateList(iso){
  if(!iso) return '';
  iso = String(iso);
  var parts = iso.split('-');
  if(parts.length!==3) return e(iso);
  var months = ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
  var d = parseInt(parts[2],10);
  var m = parseInt(parts[1],10)-1;
  var y = parts[0];
  var dm = String(d).padStart(2,'0') + ' ' + (months[m]||'???');
  return '<span class="td-date-dm">'+e(dm)+'</span><span class="td-date-y">'+e(y)+'</span>';
}
function showTab(tab){
  document.getElementById('pane-browse').style.display = tab==='browse' ? '' : 'none';
  document.getElementById('pane-deck').style.display = tab==='deck' ? '' : 'none';
  var dlPane = document.getElementById('pane-decklists');
  if(dlPane) dlPane.style.display = tab==='decklists' ? '' : 'none';
  var edPane=document.getElementById('pane-editor');
  if(edPane) edPane.style.display = tab==='editor' ? 'block' : 'none';
  var sgPane=document.getElementById('pane-sagas');
  if(sgPane) sgPane.style.display = tab==='sagas' ? '' : 'none';
  var kwPane=document.getElementById('pane-keywords');
  if(kwPane) kwPane.style.display = tab==='keywords' ? 'block' : 'none';
  var tdPane=document.getElementById('pane-testdeck');
  if(tdPane) tdPane.style.display = tab==='testdeck' ? 'block' : 'none';
  var tpPane=document.getElementById('pane-templates');
  if(tpPane) tpPane.style.display = tab==='templates' ? 'block' : 'none';
  document.body.classList.toggle('editor-active', tab==='editor');
  document.body.classList.toggle('no-panels', tab!=='browse' && tab!=='deck');
  document.body.classList.toggle('testdeck-active', tab==='testdeck');
  /* The tab row comes and goes with Play Test, so --chrome is measured and the row fitted again. */
  if(typeof window.catRefitTabs === 'function') window.catRefitTabs();
  /* Called for every tab, not only Play Test: the restore has to fire on whichever tab is opened next (tdFoldSidePanels). */
  /* first, the deck panel's inline display put back from its fold class: tdFoldSidePanels reads it */
  var dpEl = document.querySelector('.dp');
  if(dpEl && document.body.classList.contains('dp-folded')) dpEl.style.display = 'none';
  if(typeof tdFoldSidePanels==='function') tdFoldSidePanels(tab==='testdeck');
  document.getElementById('tab-browse').classList.toggle('on', tab==='browse');
  document.getElementById('tab-deck').classList.toggle('on', tab==='deck');
  var dlTab = document.getElementById('tab-decklists');
  if(dlTab) dlTab.classList.toggle('on', tab==='decklists');
  var edTab=document.getElementById('tab-editor');
  if(edTab) edTab.classList.toggle('on', tab==='editor');
  var sgTab=document.getElementById('tab-sagas');
  if(sgTab) sgTab.classList.toggle('on', tab==='sagas');
  var kwTab=document.getElementById('tab-keywords');
  if(kwTab) kwTab.classList.toggle('on', tab==='keywords');
  var tdTab=document.getElementById('tab-testdeck');
  if(tdTab) tdTab.classList.toggle('on', tab==='testdeck');
  var tpTab=document.getElementById('tab-templates');
  if(tpTab) tpTab.classList.toggle('on', tab==='templates');
  ['browse','deck','testdeck','decklists','keywords','sagas','editor','templates'].forEach(function(t){
    var b = document.getElementById('tab-' + t);
    if(!b) return;
    if(t === tab) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
  if(tab==='sagas' && typeof window.edRenderSagaPage==='function') window.edRenderSagaPage();
  if(tab==='keywords' && typeof window.edRenderKwPage==='function') window.edRenderKwPage();
  if(tab==='templates' && typeof window.edRenderTplPage==='function') window.edRenderTplPage();
  if(tab==='editor' && typeof edInit==='function') edInit();
  /* Redraws the board, never deals: leaving to look a card up and coming back must not reset the game. */
  if(tab==='testdeck' && typeof tdRender==='function') setTimeout(tdRender, 30);
  if(tab==='deck') setTimeout(refreshDeckView, 80);
  /* a list table drawn while its page was hidden could not measure itself */
  if(typeof fitListTables === 'function') setTimeout(fitListTables, 120);
  if(tab==='decklists' && _dlDirty){ _dlDirty=false; setTimeout(renderDeckLists, 80); }
  if(typeof mobOnTab === 'function') mobOnTab(tab);
}
var _dlDirty = true;



/* The comparators are SORT_DEFS (cat_core.js), shared with Browse; 'deck' keeps the order the cards were added in. */
function _dvSortEntries(entries){
  var sel = (document.getElementById('dvSortSel')||{}).value || 'deck';
  if(sel === 'deck') return entries.slice();
  var m = sel.match(/^(.+)-(asc|desc)$/);
  var def = SORT_BY_KEY[m ? m[1] : sel];
  if(!def) return entries.slice();
  var dir = m ? m[2] : 'asc';
  return entries.slice().sort(function(a,b){ return def.cmp(a.card, b.card, dir); });
}

function _dvSortWithGrouping(entries){
  var sorted = _dvSortEntries(entries);
  var grp = (document.getElementById('dvGroupSel')||{}).value || 'none';
  if(grp === 'none') return sorted;
  // Array sort is stable, so the order within each group is kept.
  var groupOrder = {};
  var orderIdx = 0;
  sorted.forEach(function(e){
    var key = _dvGroupKey(e.card);
    if(!(key in groupOrder)) groupOrder[key] = orderIdx++;
  });
  sorted.sort(function(a,b){
    var ga = groupOrder[_dvGroupKey(a.card)] || 0;
    var gb = groupOrder[_dvGroupKey(b.card)] || 0;
    return ga - gb;
  });
  return sorted;
}

function _dvGroupKey(card){
  var grp = (document.getElementById('dvGroupSel')||{}).value || 'none';
  switch(grp){
    case 'super': return smartSuperGroup(_catArr(card.superTypes));
    case 'sub':   return _catArr(card.subTypes).join(' ') || '—';
    case 'color': return _catArr(card.colors).join(', ') || 'Colorless';
    case 'cmc':   return 'CMC '+(card.cmc||'0');
    default:      return null;
  }
}

// All state is stored here, never re-read from DOM during matching
var _hl = {
  on:      false,
  name:    '',
  ruleTxt: '',
  sup:     '',
  sub:     '',
  cmcOp:   '',
  cmcV:    NaN,
  colMode: '',
  colSel:  []
};

function _hlReadState(){
  _hl.on      = !!(document.getElementById('hlToggle')||{}).checked;
  _hl.name    = ((document.getElementById('hlName')||{}).value||'').trim().toLowerCase();
  _hl.ruleTxt = ((document.getElementById('hlRule')||{}).value||'').trim().toLowerCase();
  _hl.sup     = ((document.getElementById('hlSuper')||{}).value||'').trim().toLowerCase();
  _hl.sub     = ((document.getElementById('hlSub')||{}).value||'').trim().toLowerCase();
  _hl.cmcOp   = ((document.getElementById('hlCmcOp')||{}).value||'');
  var cv = (document.getElementById('hlCmcVal')||{}).value;
  _hl.cmcV    = (cv !== undefined && cv !== '') ? parseFloat(cv) : NaN;
  _hl.colMode = ((document.getElementById('hlColMode')||{}).value||'');
  _hl.colSel  = [];
  document.querySelectorAll('.hl-col-chk:checked').forEach(function(cb){ _hl.colSel.push(String(cb.value).toLowerCase()); });
}
function _hlHasCriteria(){
  return !!(_hl.name || _hl.ruleTxt || _hl.sup || _hl.sub || (_hl.cmcOp && !isNaN(_hl.cmcV)) || (_hl.colMode && _hl.colSel.length));
}

function _hlCardMatches(card){
  if(!_hl.on) return false;
  var cmcActive = _hl.cmcOp && !isNaN(_hl.cmcV);
  var colActive = _hl.colMode && _hl.colSel.length > 0;
  if(!_hl.name && !_hl.ruleTxt && !_hl.sup && !_hl.sub && !cmcActive && !colActive) return false;
  if(_hl.name    && String(card.name||'').toLowerCase().indexOf(_hl.name) < 0) return false;
  if(_hl.ruleTxt && String(card.ruleText||'').toLowerCase().indexOf(_hl.ruleTxt) < 0) return false;
  if(_hl.sup     && _catArr(card.superTypes).join(' ').toLowerCase().indexOf(_hl.sup) < 0) return false;
  if(_hl.sub     && _catArr(card.subTypes).join(' ').toLowerCase().indexOf(_hl.sub) < 0) return false;
  if(cmcActive){
    var cmc = parseFloat(card.cmc) || 0;
    if(_hl.cmcOp==='eq' && cmc !== _hl.cmcV) return false;
    if(_hl.cmcOp==='lt' && cmc >= _hl.cmcV)  return false;
    if(_hl.cmcOp==='gt' && cmc <= _hl.cmcV)  return false;
  }
  if(colActive){
    var cc = _catArr(card.colors).map(function(c){ return String(c).toLowerCase(); });
    if(_hl.colMode==='any'  && !_hl.colSel.some(function(c){ return cc.indexOf(c) >= 0; }))  return false;
    if(_hl.colMode==='all'  && !_hl.colSel.every(function(c){ return cc.indexOf(c) >= 0; })) return false;
    if(_hl.colMode==='none' &&  _hl.colSel.some(function(c){ return cc.indexOf(c) >= 0; }))  return false;
  }
  return true;
}

function _syncHlColIcons(){
  document.querySelectorAll('.hl-col-chk').forEach(function(cb){
    var img = cb.parentElement ? cb.parentElement.querySelector('.hl-col-img') : null;
    if(img) img.style.borderColor = cb.checked ? 'var(--go)' : 'transparent';
  });
}

/* Keyed on CARD_GEN as well as the length: a rename keeps the count and must still rebuild the map. */
var _hlMap=null, _hlMapKey=null, _hlMapOf=null;
function _hlCardMap(){
  var all=(window.CARDS||[]);
  var key=all.length+'|'+(window.CARD_GEN||0);
  if(!_hlMap || _hlMapKey!==key || _hlMapOf!==all){
    _hlMap={}; all.forEach(function(c){ if(c && c.name!=null) _hlMap[c.name]=c; });
    _hlMapKey=key; _hlMapOf=all;
  }
  return _hlMap;
}
function applyHighlight(){
  _hlReadState();
  /* Cached, not rebuilt per keystroke: this runs on input in every box, unlike Browse's filters. */
  var cardMap2 = _hlCardMap();
  var count = 0;
  document.querySelectorAll('#pane-deck .cg .ci[data-cardname]').forEach(function(el){
    var card = cardMap2[el.dataset.cardname];
    var m = card && _hlCardMatches(card);
    el.classList.toggle('hl-match', !!m);
    if(m) count++;
  });
  document.querySelectorAll('#pane-deck .ct tbody tr[data-cardname]').forEach(function(tr){
    var card = cardMap2[tr.dataset.cardname];
    tr.classList.toggle('hl-match', !!(card && _hlCardMatches(card)));
  });
  var ce = document.getElementById('hlCount');
  if(ce) ce.textContent = count > 0 ? count : '';
}

/* Taken when the panel opens and compared when it closes, so closing switches Highlight on only after a change. */
var _hlOpenSig = null;
function _hlPanelSig(){
  _hlReadState();
  return JSON.stringify([_hl.name, _hl.ruleTxt, _hl.sup, _hl.sub, _hl.cmcOp,
    isNaN(_hl.cmcV) ? '' : _hl.cmcV, _hl.colMode, _hl.colSel]);
}
function _hlPanelClosed(){
  var tog = document.getElementById('hlToggle');
  var sig = _hlPanelSig();
  if(tog && !tog.checked && _hlOpenSig !== null && sig !== _hlOpenSig && _hlHasCriteria()) tog.checked = true;
  _hlOpenSig = null;
  applyHighlight();
}
function toggleHlPanel(){
  var panel = document.getElementById('hlPanel');
  if(!panel) return;
  var wasOpen = panel.classList.contains('on');
  panel.classList.toggle('on');
  var btn = document.getElementById('hlBtn');
  if(btn) btn.setAttribute('aria-expanded', wasOpen ? 'false' : 'true');
  if(wasOpen) _hlPanelClosed();
  else _hlOpenSig = _hlPanelSig();
}

document.addEventListener('change', function(ev){
  if(!ev.target) return;
  if(ev.target.classList.contains('hl-col-chk')){ _syncHlColIcons(); }
  if(ev.target.id === 'hlToggle' || ev.target.classList.contains('hl-col-chk') ||
     ev.target.id === 'hlColMode' || ev.target.id === 'hlCmcOp'){ applyHighlight(); }
});

document.addEventListener('click', function(ev){
  var wrap = document.getElementById('hlWrap');
  if(!wrap || wrap.contains(ev.target)) return;
  var panel = document.getElementById('hlPanel');
  if(panel && panel.classList.contains('on')){
    panel.classList.remove('on');
    var btn = document.getElementById('hlBtn');
    if(btn) btn.setAttribute('aria-expanded', 'false');
    _hlPanelClosed();
  }
});


