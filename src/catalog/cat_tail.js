/* The last catalog slice: it closes the <script> cat_core.js opened, and the start-up calls at its foot need every earlier cat_*.js. */

/* _sortPrimary is the only sort grid and details view can reach (the headers are in #ct); cmp() keeps blanks last both ways. */
/* Alphabetical by default: catalog order is the island's, which nobody can predict. */
var _sortPrimary = {key:'name', dir:'asc'};   // null = catalog order

function applySorts(cards){
  if(!_sortPrimary && !sortCols.length) return cards;
  return cards.slice().sort(function(a,b){
    if(_sortPrimary){
      var pd = SORT_BY_KEY[_sortPrimary.key];
      if(pd){ var pc = pd.cmp(a, b, _sortPrimary.dir); if(pc) return pc; }
    }
    for(var i=0;i<sortCols.length;i++){
      var sc = sortCols[i];
      if(_sortPrimary && sc.key === _sortPrimary.key) continue;
      var def = SORT_BY_KEY[sc.key]; if(!def) continue;
      var cmp = def.cmp(a, b, sc.dir);
      if(cmp) return cmp;
    }
    return 0;
  });
}

function setSortPrimary(key){
  _sortPrimary = key ? {key:key, dir:(_sortPrimary && _sortPrimary.key===key) ? _sortPrimary.dir : 'asc'} : null;
  syncSortUI();
  run();
}
function toggleSortDir(){
  if(!_sortPrimary) return;
  _sortPrimary.dir = _sortPrimary.dir === 'asc' ? 'desc' : 'asc';
  syncSortUI();
  run();
}
/* Both dropdowns come from SORT_DEFS, so they cannot drift apart. */
function buildSortMenus(){
  var menu = SORT_DEFS.filter(function(d){ return d.menu; });
  var sel = document.getElementById('sortSel');
  if(sel){
    sel.innerHTML = '<option value="">Default</option>' + menu.map(function(d){
      return '<option value="' + d.key + '">' + e(d.label) + '</option>';
    }).join('');
  }
  var dv = document.getElementById('dvSortSel');
  if(dv){
    var keep = dv.value;
    dv.innerHTML = '<option value="deck">As Added</option>' + menu.map(function(d){
      return '<option value="' + d.key + '-asc">' + e(d.label) + ' ↑</option>'
           + '<option value="' + d.key + '-desc">' + e(d.label) + ' ↓</option>';
    }).join('')
    /* Mana and Rule have a header and no menu entry: hidden options, so a Build Deck header click can still choose them. */
    + SORT_DEFS.filter(function(d){ return !d.menu; }).map(function(d){
      return '<option hidden value="' + d.key + '-asc">' + e(d.label) + ' ↑</option>'
           + '<option hidden value="' + d.key + '-desc">' + e(d.label) + ' ↓</option>';
    }).join('');
    if(keep) dv.value = keep;
    if(!dv.value) dv.value = 'deck';
  }
}

function syncSortUI(){
  var sel = document.getElementById('sortSel');
  if(sel) sel.value = _sortPrimary ? _sortPrimary.key : '';
  var btn = document.getElementById('sortDirBtn');
  if(btn){
    btn.innerHTML = uiIco((!_sortPrimary || _sortPrimary.dir === 'asc') ? 'arrow-up' : 'arrow-down');
    btn.disabled = !_sortPrimary;
    btn.title = _sortPrimary
      ? (_sortPrimary.dir === 'asc' ? 'Ascending — click for descending' : 'Descending — click for ascending')
      : 'Pick a sort first';
  }
  updateHeaderIndicators();
}

function clickSortKey(key, isDV){
  /* The Build Deck page's headers sort that page: the code below is Browse's sort. */
  if(isDV){ dvClickSortKey(key); return; }
  // The header matching the primary flips it: a tie-breaker on the same key could never break anything.
  if(_sortPrimary && _sortPrimary.key === key){
    _sortPrimary.dir = _sortPrimary.dir === 'asc' ? 'desc' : 'asc';
    syncSortUI();
    run();
    return;
  }
  var existing=-1;
  for(var x=0;x<sortCols.length;x++){ if(sortCols[x].key===key){existing=x;break;} }
  if(existing>=0){
    if(sortCols[existing].dir==='asc'){ sortCols[existing].dir='desc'; }
    else { sortCols.splice(existing,1); }
  } else {
    sortCols.push({key:key,dir:'asc'});
  }
  updateHeaderIndicators();
  run();
}
function dvClickSortKey(key){
  var sel = document.getElementById('dvSortSel'); if(!sel) return;
  var m = (sel.value || '').match(/^(.+)-(asc|desc)$/);
  var next = key + '-' + ((m && m[1] === key && m[2] === 'asc') ? 'desc' : 'asc');
  if(![].some.call(sel.options, function(o){ return o.value === next; })) return;
  sel.value = next;
  refreshDeckView();
}

function makeSortTh(label, key){ return '<th data-sk="'+key+'">'+e(label)+'<span class="sort-ind">'+uiIco('sort')+'</span></th>'; }
function makeSortThDV(label, key){ return '<th data-sk-dv="'+key+'">'+e(label)+'<span class="sort-ind">'+uiIco('sort')+'</span></th>'; }

function attachSortListeners(trElement, isDV){
  if(!trElement) return;
  trElement.querySelectorAll('th[data-sk],th[data-sk-dv]').forEach(function(th){
    var key = th.dataset.sk || th.dataset.skDv;
    th.onclick = function(){ clickSortKey(key, isDV); };
  });
}

function updateHeaderIndicators(){
  var ranked = [];
  if(_sortPrimary) ranked.push(_sortPrimary);
  sortCols.forEach(function(sc){
    if(!_sortPrimary || sc.key !== _sortPrimary.key) ranked.push(sc);
  });
  var dvm = ((document.getElementById('dvSortSel') || {}).value || '').match(/^(.+)-(asc|desc)$/);
  document.querySelectorAll('th[data-sk-dv]').forEach(function(th){
    var on = !!(dvm && dvm[1] === th.dataset.skDv);
    th.classList.toggle('sorted', on);
    var di = th.querySelector('.sort-ind');
    if(di) di.innerHTML = uiIco(on ? (dvm[2] === 'asc' ? 'arrow-up' : 'arrow-down') : 'sort');
  });
  document.querySelectorAll('th[data-sk]').forEach(function(th){
    var key = th.dataset.sk;
    var sc = null, rank = 0;
    for(var i=0;i<ranked.length;i++){ if(ranked[i].key===key){ sc=ranked[i]; rank=i+1; break; } }
    var ind = th.querySelector('.sort-ind');
    if(sc){
      th.classList.add('sorted');
      if(ind) ind.innerHTML = uiIco(sc.dir==='asc' ? 'arrow-up' : 'arrow-down') + (ranked.length>1 ? ' '+rank : '');
    } else {
      th.classList.remove('sorted');
      if(ind) ind.innerHTML = uiIco('sort');
    }
  });
}

/* Every button goes through deckChange (cat_deck.js): the line, the save, the toast, the redraw. */
function adjustDeck(cardName, delta, forceDeckId){
  var card = CARDS.filter(function(c){return c.name===cardName;})[0];
  var deckKey = forceDeckId ? (deckKeyOf(forceDeckId) || 'main')
              : (card ? deckAddKey(card) : (deckKeyOf(_activeDeckId) || 'main'));
  deckChange(cardName, delta, deckKey);
}

/* Halving, as fitLargest does for fitFace, never a walk: three elements a tile at 100 tiles is thousands of forced layouts. */
function fitLargestRem(apply, fits, lo, hi){
  apply(hi); if(fits()) return hi;
  var l=lo, h=hi, best=null, mid, g=0;
  while(g++<8 && h-l>0.01){
    mid=Math.round(((l+h)/2)*100)/100;
    apply(mid);
    if(fits()){ best=mid; l=mid; } else { h=mid; }
  }
  if(best==null){ apply(lo); return lo; }
  apply(best); return best;
}

function fitDetailsText(){
  // The rule element, not the whole .ci-dt, so the footer keeps its size; it is flex:1 with overflow:hidden, so its height is bounded.
  var maxRem = 0.98;
  document.querySelectorAll(_gridSel(' .ci-dt-rule')).forEach(function(el){
    fitLargestRem(function(sz){ el.style.fontSize = sz+'rem'; },
                  function(){ return el.scrollHeight <= el.clientHeight + 2; },
                  0.5, maxRem);
  });
  fitCardText();
}


/* curView (Browse) and curDVView (Build Deck) start apart, grid and details, but setView sets both. */
function setView(v){
  curView = v;
  var isBrowse = document.getElementById('pane-browse').style.display !== 'none';
  var isGrid = v==='grid' || v==='details';
  document.getElementById('cg').style.display = isGrid ? 'grid' : 'none';
  if(v==='list'){ document.getElementById('ct').classList.add('on'); }
  else { document.getElementById('ct').classList.remove('on'); }
  curDVView = v;
  /* Every list of grids and tables here comes from DECK_VIEW_IDS: a written-out one left Rebirth's Armament invisible in List view. */
  var _dvIds=Object.keys(DECK_VIEW_IDS).map(function(k){ return DECK_VIEW_IDS[k]; });
  _dvIds.forEach(function(stem){
    var el=document.getElementById(stem+'-cg');
    if(el) el.style.display = (isGrid && el.children.length) ? 'grid' : 'none';
  });
  _dvIds.forEach(function(stem){
    var el=document.getElementById(stem+'-ct');
    if(el){ if(v==='list') el.classList.add('on'); else el.classList.remove('on'); }
  });
  document.getElementById('vbg').classList.toggle('on', v==='grid');
  document.getElementById('vbl').classList.toggle('on', v==='list');
  document.getElementById('vbd').classList.toggle('on', v==='details');
  _gridIds().forEach(function(id){
    var el=document.getElementById(id); if(el) el.classList.toggle('view-details', v==='details');
  });
  var _hiSel = _gridSel(' .ci');
  if(v === 'grid'){
    document.querySelectorAll(_hiSel).forEach(function(el){
      el.classList.toggle('hide-info', !_showCardInfo);
    });
  } else {
    document.querySelectorAll(_hiSel).forEach(function(el){
      el.classList.remove('hide-info');
    });
  }
  if(isBrowse){ run(); } else { refreshDeckView(); }
}
var curDVView = 'details';
function _gridIds(){
  return ['cg'].concat(Object.keys(DECK_VIEW_IDS).map(function(k){ return DECK_VIEW_IDS[k] + '-cg'; }));
}
function _gridSel(tail){
  return _gridIds().map(function(id){ return '#' + id + (tail || ''); }).join(', ');
}
function reset(){
  document.getElementById('ns').value=''; document.getElementById('rs').value='';
  /* Scoped to the sidebar: setting .checked fires no change event, so the header's Rebirth and Info toggles would lie. */
  var side=document.getElementById('sbPanel')||document;
  side.querySelectorAll('input[type=checkbox]').forEach(function(c){c.checked=false;});
  side.querySelectorAll('input[type=radio]').forEach(function(r){if(r.value==='any')r.checked=true;});
  ['cmSel','stmSel','sbmSel'].forEach(function(id){var el=document.getElementById(id); if(el)el.value='any';});
  /* Reset is written out by hand, not driven by FILTER_FIELDS, so a new filter has to be cleared here too. */
  var ds=document.getElementById('dateFilter'); if(ds)ds.value='';
  var fs=document.getElementById('fsaga'); if(fs)fs.value='';
  ['cop','aop','hop','arop','rop'].forEach(function(id){var el=document.getElementById(id); if(el)el.value='';});
  ['cval','aval','hval','arval','rval'].forEach(function(id){var el=document.getElementById(id); if(el)el.value='';});
  var rtm=document.getElementById('rtMode'); if(rtm)rtm.value='all';
  if(typeof syncOpInputs==='function') syncOpInputs();
  var sf=document.getElementById('stf'); sf.innerHTML=''; sf.appendChild(makeSTRow(true));
  var suf=document.getElementById('suf'); if(suf){ suf.innerHTML=''; suf.appendChild(makeSURow(true)); }
  run();
}

function fitCardText(){
  var items = document.querySelectorAll(_gridSel(' .ci-inf'));
  items.forEach(function(inf){
    ['ci-name','ci-super','ci-sub'].forEach(function(cls){
      var el = inf.querySelector('.'+cls);
      if(!el) return;
      var maxSz = parseFloat(cls==='ci-name' ? '1.1' : '1.2');
      fitLargestRem(function(sz){ el.style.fontSize = sz+'rem'; },
                    function(){ return el.scrollWidth <= el.offsetWidth + 1; },
                    0.55, maxSz);
    });
  });
}
/* Fitted again when the card fonts arrive: faces fitted in the fallback serif remember that width (wrap.__fitW) and ran past their box. */
(function(){
  var fs = document.fonts;
  if(!fs) return;
  var t = 0;
  function refit(){
    clearTimeout(t);
    t = setTimeout(function(){
      document.querySelectorAll('.mcard-fit').forEach(function(wrap){
        wrap.__fitW = -1;
        if(!wrap.getClientRects().length) return;
        try{
          if(wrap.querySelector('.mcard-scale') && typeof window.edScaleFace === 'function') window.edScaleFace(wrap);
          else if(typeof window.edFitFaces === 'function') window.edFitFaces(wrap);
        }catch(_){}
      });
      try{ fitCardText(); }catch(_){}
    }, 80);
  }
  window.catRefitFaces = refit;
  try{ if(typeof fs.addEventListener === 'function') fs.addEventListener('loadingdone', refit); }catch(_){}
  try{ if(fs.ready && typeof fs.ready.then === 'function') fs.ready.then(refit, function(){}); }catch(_){}
})();
var KW_DATA = REBIRTH ? [] : JSON.parse(document.getElementById('kwdata').textContent);

var KW_MATCHES = KW_DATA.filter(function(k){ return k && typeof k.match === 'string' && k.match; })
  .sort(function(a,b){
  return b.match.length - a.match.length;
});


/* The editor rebuilds KW_DATA and KW_MATCHES at boot with the custom entries (edApplyCustomEntries, ed2_core.js). */

var _kwMatchIdx = -1;
var _kwMatches = [];
function _kwFilter(){
  var q = (document.getElementById('kwSearch')||{}).value||'';
  q = q.trim().toLowerCase();
  var body = document.getElementById('kwPageBody');
  if(!body) return;
  var entries = body.querySelectorAll('.kwp-row');
  _kwMatches = [];
  _kwMatchIdx = -1;
  entries.forEach(function(el){
    var name = el.getAttribute('data-kwname')||'';
    var reminder = (el.querySelector('.kwp-rem')||{}).textContent||'';
    var match = !q || name.toLowerCase().indexOf(q)>=0 || reminder.toLowerCase().indexOf(q)>=0;
    el.style.display = match ? '' : 'none';
    el.style.outline = '';
    if(match) _kwMatches.push(el);
  });
  body.querySelectorAll('.kwp-head').forEach(function(h){
    var any=false, n=h.nextElementSibling;
    while(n && !n.classList.contains('kwp-head')){
      if(n.classList.contains('kwp-row') && n.style.display!=='none'){ any=true; break; }
      n=n.nextElementSibling;
    }
    h.style.display = any ? '' : 'none';
  });
  if(_kwMatches.length && q){ _kwMatchIdx=0; _kwHighlightMatch(); }
}
function _kwHighlightMatch(){
  _kwMatches.forEach(function(el){ el.style.outline=''; });
  if(_kwMatchIdx>=0 && _kwMatchIdx<_kwMatches.length){
    var el = _kwMatches[_kwMatchIdx];
    el.style.outline='2px solid var(--go)';
    el.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
}

(function(){
  var scOv = document.getElementById('scOverlay');
  if(scOv) scOv.addEventListener('click', function(ev){ if(ev.target === scOv) closeShortcutsPage(); });
})();

/* Only the text between tags, never inside one (HANDOFF §58.1): D6 and D4 match inside a data: icon's base64.
   Each link is a placeholder until every keyword has run; the placeholder characters are built here, not written as escapes (HANDOFF §0). */
function linkKeywords(t) {
  var SEP = String.fromCharCode(1), held = [];
  var parts = String(t == null ? '' : t).split(/(<[^>]*>)/);
  for (var p = 0; p < parts.length; p += 2) {          /* even pieces are text */
    var s = parts[p];
    if (!s) continue;
    (KW_MATCHES || []).forEach(function(k){
      if(!k || typeof k.match !== 'string' || !k.match) return;
      var pat = k.match.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      var re = new RegExp('(?<![\\w-])(' + pat + ')(?![\\w-])', 'gi');
      s = s.replace(re, function(m){
        var entryId = 'kwentry-'+String(k.name == null ? k.match : k.name).replace(/\s+/g,'_');
        held.push('<span class="kw-link" role="link" tabindex="0" data-kw-entry="'+e(entryId)+'">'+m+'</span>');
        return SEP + String.fromCharCode(0xE000 + held.length - 1) + SEP;
      });
    });
    parts[p] = s;
  }
  var out = parts.join('');
  if (!held.length) return out;
  var hole = new RegExp(SEP + '([' + String.fromCharCode(0xE000) + '-' + String.fromCharCode(0xF8FF) + '])' + SEP, 'g');
  return out.replace(hole, function(_, ch){ return held[ch.charCodeAt(0) - 0xE000] || ''; });
}

/* The card window closes first: it stayed on top and hid the row just found. */
function _openKwAndHighlight(mode, entryId){
  entryId = String(entryId == null ? '' : entryId);
  var mo = document.getElementById('mo');
  if(mo && mo.classList.contains('on') && typeof closeMod === 'function'){ try{ closeMod(); }catch(_){} }
  try{ if(document.getElementById('scOverlay') && document.getElementById('scOverlay').classList.contains('on')) closeShortcutsPage(); }catch(_){}
  showTab('keywords');
  setTimeout(function(){
    document.querySelectorAll('#kwPageBody .kwp-row').forEach(function(el){ el.style.outline=''; });
    var el = entryId ? document.getElementById(entryId) : null;
    if(el){
      el.scrollIntoView({block:'center'});
      el.style.outline = '2px solid var(--go)';
      el.style.outlineOffset = '3px';
      var kwS = document.getElementById('kwSearch');
      if(kwS) kwS.value = '';
    }
  }, 120);
}
/* One listener for every keyword link; a click on one with a handler of its own (edKwOpen) is left to it, or it opens twice. */
(function(){
  function hit(ev){
    var t = ev.target && ev.target.closest ? ev.target.closest('[data-kw-entry]') : null;
    if(!t) return null;
    /* a counter on the board wears a pill's look and is not a link */
    if(t.closest('.td-token-kw')) return null;
    return t;
  }
  document.addEventListener('click', function(ev){
    var t = hit(ev); if(!t || t.hasAttribute('onclick')) return;
    ev.preventDefault();
    _openKwAndHighlight(t.getAttribute('data-kw-mode') || '', t.getAttribute('data-kw-entry'));
  });
  document.addEventListener('keydown', function(ev){
    if(ev.key !== 'Enter') return;
    var t = hit(ev); if(!t || ev.target !== t) return;
    ev.preventDefault();
    _openKwAndHighlight(t.getAttribute('data-kw-mode') || '', t.getAttribute('data-kw-entry'));
  });
})();


var _docSearchTimers = {};
var _docMatchIdx = {};

/* Through the relay (relay/worker.js): Google sends no Access-Control-Allow-Origin on a published document, and its pictures'
   Cross-Origin-Resource-Policy forbids drawing them on another site (/docimg). Each loaded document is kept for offline. */
var DOC_IDS = {rules:1, design:1, rbrules:1, rbdesign:1};
var _docState = {};        /* id -> {done, err, when, cached} */

/* TBL_DEFAULT_RELAY is written by tools/set_relay.py, the only address the app is told. */
function docRelayBase() {
  var u = (typeof TBL_DEFAULT_RELAY === 'string' && TBL_DEFAULT_RELAY) || '';
  if (/^wss:/i.test(u)) return 'https://' + u.slice(6).replace(/\/+$/, '');
  if (/^ws:/i.test(u))  return 'http://'  + u.slice(5).replace(/\/+$/, '');
  return u.replace(/\/+$/, '');
}

/* A database of its own, not the editor's; every call answers rather than throwing, so a browser with storage off can still read the rules. */
var DOC_DB = 'conjure_docs';
function docDb() {
  return new Promise(function(res, rej) {
    var rq;
    try { rq = indexedDB.open(DOC_DB, 1); } catch (e) { rej(e); return; }
    rq.onupgradeneeded = function(ev) {
      var db = ev.target.result;
      if (!db.objectStoreNames.contains('docs')) db.createObjectStore('docs', {keyPath: 'id'});
    };
    rq.onsuccess = function(ev) { res(ev.target.result); };
    rq.onerror = function(ev) { rej(ev.target.error); };
  });
}
function docCacheGet(id) {
  return docDb().then(function(db) {
    return new Promise(function(res) {
      var r;
      try { r = db.transaction('docs').objectStore('docs').get(id); }
      catch (e) { db.close(); res(null); return; }
      r.onsuccess = function() { db.close(); res(r.result || null); };
      r.onerror = function() { db.close(); res(null); };
    });
  }).catch(function() { return null; });
}
function docCachePut(rec) {
  return docDb().then(function(db) {
    return new Promise(function(res) {
      try {
        var t = db.transaction('docs', 'readwrite');
        t.objectStore('docs').put(rec);
        t.oncomplete = function() { db.close(); res(true); };
        t.onerror = function() { db.close(); res(false); };
      } catch (e) { db.close(); res(false); }
    });
  }).catch(function() { return false; });
}

function docNote(id, html, kind) {
  var n = document.getElementById('docNote_' + id);
  if (!n) return;
  n.className = 'doc-note' + (kind ? ' ' + kind : '');
  n.innerHTML = html;
  n.style.display = html ? '' : 'none';
}

/* A document is shown, never run: the frame is sandboxed without scripts and the document is cleaned here first (HANDOFF §10). */
var DOC_DROP = 'script,iframe,frame,frameset,object,embed,applet,base,meta,link,form,input,button,'
  + 'select,textarea,option,noscript,template,portal,dialog,math';
var DOC_URL_ATTRS = ['href', 'src', 'xlink:href', 'action', 'formaction', 'srcset', 'background',
                     'poster', 'data', 'ping', 'lowsrc', 'dynsrc', 'longdesc', 'cite'];
function docUrlOk(v, isImg) {
  var s = String(v == null ? '' : v).replace(/[\u0000- \u007f-\u009f]+/g, '').toLowerCase();
  if (!s || s.charAt(0) === '#') return true;
  if (/^https?:/.test(s)) return true;
  if (isImg && /^data:image\/(png|gif|jpe?g|webp|svg\+xml);/.test(s)) return true;
  if (/^[a-z][a-z0-9+.-]*:/.test(s)) return false;      /* any other scheme */
  return true;                                           /* a relative address */
}
function docSanitize(html) {
  var doc;
  try {
    doc = new DOMParser().parseFromString('<!DOCTYPE html><html><head></head><body>'
      + String(html == null ? '' : html) + '</body></html>', 'text/html');
  } catch (_) { return {doc: null, html: ''}; }
  Array.prototype.forEach.call(doc.body.querySelectorAll(DOC_DROP), function(el) {
    if (el.parentNode) el.parentNode.removeChild(el);
  });
  Array.prototype.forEach.call(doc.body.querySelectorAll('*'), function(el) {
    var isImg = /^(img|image)$/i.test(el.nodeName);
    Array.prototype.slice.call(el.attributes).forEach(function(a) {
      var n = a.name.toLowerCase();
      if (n.indexOf('on') === 0) { el.removeAttribute(a.name); return; }
      if (DOC_URL_ATTRS.indexOf(n) >= 0 && !docUrlOk(a.value, isImg && n !== 'href')) el.removeAttribute(a.name);
      else if (n === 'srcset') el.removeAttribute(a.name);   /* a list of addresses: not needed */
      else if (n === 'style' && /expression\s*\(|javascript:/i.test(a.value)) el.removeAttribute(a.name);
    });
    if (el.nodeName === 'A' || el.nodeName === 'AREA') {
      var h = el.getAttribute('href');
      if (h != null && h.trim().charAt(0) !== '#') {
        el.setAttribute('target', '_blank');
        el.setAttribute('rel', 'noopener noreferrer');
      } else el.removeAttribute('target');
    }
  });
  try { docSymbolize(doc); } catch (_) {}
  return {doc: doc, html: doc.body.innerHTML};
}
window.docSanitize = docSanitize;

/* A link must not navigate the frame: it holds a blob: URL, so following one would leave no way back; anchors still work. */
function docPageHtml(body, bodyClass) {
  return '<!DOCTYPE html><html><head><meta charset="utf-8">'
    + '<meta http-equiv="Content-Security-Policy" content="script-src \'none\'; object-src \'none\'; '
    + 'frame-src \'none\'; form-action \'none\'; base-uri \'none\'">'
    + '<style>html,body{margin:0;background:#fff}'
    + '#contents{padding:18px 26px 60px}'
    + 'img{max-width:100%;height:auto}'
    /* A phone's frame (HANDOFF §82): only a frame narrower than any desktop's matches, as the contents list leaves a desktop's 577px. */
    + '@media (max-width:575.98px){body{max-width:none!important;padding:0!important}'
    + '#contents{padding:14px 16px 60px}'
    + 'span[style*="inline-block"]{max-width:100%!important;height:auto!important}'
    + 'img{height:auto!important}table{max-width:100%}}'
    + '.mana-s{display:inline-flex;align-items:center;gap:1px;vertical-align:-.15em}'
    + '.mico{vertical-align:middle;filter:drop-shadow(0 0 1px rgba(0,0,0,.55))}'
    + '.hyb,.hyb3{position:relative;display:inline-flex;width:1em;height:1em;vertical-align:middle;flex-shrink:0}'
    + '.hyb-t,.hyb-b,.hyb-3a,.hyb-3b,.hyb-3c{position:absolute;top:0;left:0;width:1em;height:1em}'
    + '.hyb-t{clip-path:polygon(0 0,100% 0,0 100%)}'
    + '.hyb-b{clip-path:polygon(100% 0,100% 100%,0 100%)}'
    + '.hyb-3a{clip-path:polygon(50% 50%,50% 0%,100% 0%,100% 75%,93% 75%)}'
    + '.hyb-3b{clip-path:polygon(50% 50%,93% 75%,100% 100%,0% 100%,7% 75%)}'
    + '.hyb-3c{clip-path:polygon(50% 50%,7% 75%,0% 100%,0% 0%,50% 0%)}'
    + '</style></head>'
    + '<body class="' + String(bodyClass || 'doc-content').replace(/[^\w -]/g, '') + '">'
    + body
    + '</body></html>';
}

/* A DOM pass, never a string pass: a regex over the HTML would rewrite Google's CSS. Google splits "{", "R", "}" across spans. */
var DOC_BLOCKS = 'p,li,h1,h2,h3,h4,h5,h6,td,th';
function docSymbolize(doc) {
  var n = 0;
  try {
    var root = doc.getElementById('contents') || doc.body;
    if (!root || typeof renderManaCost !== 'function') return 0;
    var blocks = Array.prototype.filter.call(root.querySelectorAll(DOC_BLOCKS), function(b) {
      return !b.querySelector(DOC_BLOCKS);                 /* leaf blocks only */
    });
    blocks.forEach(function(b) {
      var nodes = [], starts = [], text = '';
      var w = doc.createTreeWalker(b, 4 /* SHOW_TEXT */, null, false);
      while (w.nextNode()) {
        var tn = w.currentNode, pt = tn.parentNode && tn.parentNode.nodeName;
        if (pt === 'SCRIPT' || pt === 'STYLE') continue;
        nodes.push(tn); starts.push(text.length); text += tn.data;
      }
      if (text.indexOf('{') < 0) return;
      var re = /\{([A-Za-z0-9\/]+)\}/g, m, hits = [];
      while ((m = re.exec(text))) hits.push({s: m.index, e: m.index + m[0].length, tok: m[1]});
      for (var h = hits.length - 1; h >= 0; h--) {
        var hit = hits[h], html = renderManaCost(hit.tok, 16);
        if (!html || html.indexOf('mana-txt') >= 0) continue;     /* not all symbols */
        var sN = null, sO = 0, eN = null, eO = 0;
        for (var i = 0; i < nodes.length; i++) {
          var a0 = starts[i], a1 = a0 + nodes[i].data.length;
          if (!sN && hit.s >= a0 && hit.s < a1) { sN = nodes[i]; sO = hit.s - a0; }
          if (hit.e > a0 && hit.e <= a1) { eN = nodes[i]; eO = hit.e - a0; }
        }
        if (!sN || !eN) continue;
        var la = sN.parentNode && sN.parentNode.closest ? sN.parentNode.closest('a') : null;
        var lb = eN.parentNode && eN.parentNode.closest ? eN.parentNode.closest('a') : null;
        if (la !== lb) continue;                                 /* crosses a link edge */
        var holder = doc.createElement('span');
        holder.innerHTML = html;
        var sym = holder.firstChild;
        if (!sym) continue;
        sym.setAttribute('data-sym', '{' + hit.tok + '}');
        [sym].concat(Array.prototype.slice.call(sym.querySelectorAll('*'))).forEach(function(el) {
          if (el.style && el.style.width) el.style.width = '1em';
          if (el.style && el.style.height) el.style.height = '1em';
        });
        var rg = doc.createRange();
        rg.setStart(sN, sO); rg.setEnd(eN, eO);
        rg.deleteContents(); rg.insertNode(sym);
        n++;
      }
    });
  } catch (_) {}
  return n;
}
window.docSymbolize = docSymbolize;
function docNodeText(el) {
  var out = '';
  (function walk(n) {
    for (var c = n.firstChild; c; c = c.nextSibling) {
      if (c.nodeType === 3) out += c.data;
      else if (c.nodeType === 1) {
        if (c.getAttribute && c.getAttribute('data-sym')) out += c.getAttribute('data-sym');
        else walk(c);
      }
    }
  })(el);
  return out;
}

/* The ids are Google's own (id="h.xxxx"), so a list link goes straight to its heading. Read HANDOFF §10 before changing how the frame is made. */
function docRender(id, body, bodyClass, keepScroll) {
  var frame = document.getElementById('docFrame_' + id);
  var list  = document.getElementById('docTocList_' + id);
  if (!frame) return;
  /* the sandbox, also when an older copy of the markup lacks it */
  if (!frame.hasAttribute('sandbox'))
    frame.setAttribute('sandbox', 'allow-same-origin allow-popups allow-popups-to-escape-sandbox');
  var clean = docSanitize(body);
  var blob = new Blob([docPageHtml(clean.html, bodyClass)], {type: 'text/html'});
  var url  = URL.createObjectURL(blob);
  var was = 0;
  if (keepScroll) {
    try { var od = frame.contentDocument; was = od ? (od.scrollingElement || od.body).scrollTop : 0; } catch (_) {}
  }
  /* Only the newest render builds the list: the kept copy and the live one can both be drawn. */
  var tok = (frame.__docTok || 0) + 1;
  frame.__docTok = tok;
  frame.addEventListener('load', function onLoad() {
    frame.removeEventListener('load', onLoad);
    URL.revokeObjectURL(url);
    if (frame.__docTok !== tok) return;
    var fd = frame.contentDocument || (frame.contentWindow && frame.contentWindow.document);
    if (!fd || !fd.body) return;
    fd.addEventListener('click', function(e) {
      var a = e.target && e.target.closest && e.target.closest('a[href],area[href]');
      if (!a) return;
      var h = a.getAttribute('href') || '';
      if (h.trim().charAt(0) === '#') return;
      e.preventDefault();
      if (docUrlOk(h, false)) { try { window.open(a.href, '_blank', 'noopener'); } catch (_) {} }
    }, true);
    /* Escape from inside the document too: a key pressed there goes to the frame's page, never this one. */
    fd.addEventListener('keydown', function(e) {
      if (e.key === 'Escape') { e.preventDefault(); closeDoc(id); }
    });
    if (was) { try { (fd.scrollingElement || fd.body).scrollTop = was; } catch (_) {} }
    var items = [];
    fd.querySelectorAll('h1[id],h2[id],h3[id],h4[id],p.title[id]').forEach(function(h) {
      var text = docNodeText(h).replace(/[\u25be\u25b8]/g, '').trim();
      if (!text) return;                      /* Google leaves blank spacer headings */
      var m = h.tagName.match(/^H(\d)$/i);
      items.push({id: h.id, text: text, level: m ? parseInt(m[1], 10) : 0});
    });
    if (list) {
      list.innerHTML = '';
      if (items.length) {
        _buildToc(list, items, frame);
        _attachScrollSpy(frame, list);
      }
    }
    docTocShow(id, items.length > 0);
  });
  frame.src = url;
}

function docTocShow(id, on) {
  var toc = document.getElementById('docToc_' + id);
  if (toc) toc.style.display = on ? '' : 'none';
}

/* The kept copy at once, the current one when it arrives and only if it differs; the fetch gives up after docTimeoutMs. */
var DOC_TIMEOUT_MS = 20000;
function docLoad(id) {
  if (!DOC_IDS[id]) return Promise.resolve();
  var st = _docState[id];
  if (st && st.done) return Promise.resolve();
  if (st && st.busy && st.p) return st.p;
  st = _docState[id] = {done: false, busy: true};
  var base = docRelayBase();
  var shown = null;
  docNote(id, 'Fetching the current document…');
  var kept = docCacheGet(id).then(function(rec) {
    if (rec && rec.html && !st.live) {
      shown = rec.html;
      docRender(id, rec.html, rec.bodyClass);
      docNote(id, 'Showing the copy saved ' + docWhen(rec.when)
        + ' while the current document is fetched…', 'warn');
    }
    return rec;
  }, function() { return null; });
  var ms = (typeof window.docTimeoutMs === 'number' && window.docTimeoutMs > 0) ? window.docTimeoutMs : DOC_TIMEOUT_MS;
  var ctl = (typeof AbortController === 'function') ? new AbortController() : null;
  var timer = 0;
  var live = !base ? Promise.reject(new Error('no relay address is built into this copy'))
    : new Promise(function(res, rej) {
        timer = setTimeout(function() {
          if (ctl) { try { ctl.abort(); } catch (_) {} }
          rej(new Error('the document did not arrive within ' + Math.round(ms / 1000) + ' seconds'));
        }, ms);
        fetch(base + '/doc?id=' + encodeURIComponent(id), ctl ? {cache: 'no-store', signal: ctl.signal} : {cache: 'no-store'})
          .then(function(r) { return r.json().catch(function(){ throw new Error('the relay answered ' + r.status); }); })
          .then(function(j) {
            if (!j || !j.ok) throw new Error((j && j.err) || 'the relay could not fetch it');
            return j;
          }).then(res, rej);
      });
  st.p = live.then(function(j) {
    clearTimeout(timer);
    st.live = true;
    /* after the kept copy has had its turn, so it can never land on top */
    return kept.then(function() {
      _docState[id] = {done: true, when: j.fetched};
      docNote(id, '');
      if (shown !== j.html) docRender(id, j.html, j.bodyClass, shown !== null);
      docCachePut({id: id, html: j.html, bodyClass: j.bodyClass || '', url: j.url || '',
                   when: j.fetched || new Date().toISOString()});
    });
  }).catch(function(err) {
    clearTimeout(timer);
    var why = String((err && err.message) || err);
    /* The kept copy says so: an old document shown silently is how somebody quotes a rule that changed. */
    return kept.then(function(rec) {
      if (rec && rec.html) {
        _docState[id] = {done: true, cached: true, when: rec.when};
        docNote(id, 'Could not reach the document just now — showing the copy saved '
          + docWhen(rec.when) + '.', 'warn');
        if (shown === null) docRender(id, rec.html, rec.bodyClass);
        return;
      }
      _docState[id] = {done: false, err: why};
      docNote(id, 'Could not fetch this document: ' + docEsc(why)
        + '. It is read from the Google Doc, so this needs the internet.', 'bad');
    });
  });
  return st.p;
}
function docWhen(iso) {
  try { return new Date(iso).toLocaleDateString(undefined, {year:'numeric', month:'short', day:'numeric'}); }
  catch (_) { return String(iso || '').slice(0, 10); }
}
function docEsc(s) {
  return String(s == null ? '' : s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
}
/* Exported so the checks can drive a load. */
window.docLoad = docLoad;
window.docRelayBase = docRelayBase;

function _attachScrollSpy(frameEl, tocListEl) {
  var fd = frameEl.contentDocument || (frameEl.contentWindow && frameEl.contentWindow.document);
  if (!fd || !fd.body) return;
  var scrollEl = fd.scrollingElement || fd.body;
  scrollEl.addEventListener('scroll', function() {
    var links = tocListEl.querySelectorAll('a');
    var active = null;
    links.forEach(function(a) {
      var fd2 = frameEl.contentDocument || (frameEl.contentWindow && frameEl.contentWindow.document);
      if (!fd2) return;
      var hid = a.getAttribute('href').replace('#','');
      var el = fd2.getElementById(hid);
      if (el && el.getBoundingClientRect().top < 80) active = a;
    });
    links.forEach(function(a){ a.classList.remove('active'); });
    if (active) {
      active.classList.add('active');
      var toc = tocListEl.parentElement;
      if (toc) { var at=active.offsetTop,th=toc.clientHeight; if(at<toc.scrollTop||at>toc.scrollTop+th-40) toc.scrollTop=at-th/2; }
    }
  });
}

function _buildToc(tocListEl, items, frameEl) {
  if (!tocListEl || !items || !items.length) return;
  items.forEach(function(item) {
    var a = document.createElement('a');
    a.href = '#' + item.id;
    a.className = 'lvl-' + item.level;
    a.innerHTML = docEsc(item.text).replace(/\{([A-Za-z0-9\/]+)\}/g, function(t, tok) {
      var h = (typeof renderManaCost === 'function') ? renderManaCost(tok, 14) : '';
      return (h && h.indexOf('mana-txt') < 0) ? h : t;
    });
    a.addEventListener('click', function(ev) {
      ev.preventDefault();
      ev.stopPropagation();
      try {
        var fd = frameEl.contentDocument || (frameEl.contentWindow && frameEl.contentWindow.document);
        if (!fd) return;
        var target = fd.getElementById(item.id);
        if (target) target.scrollIntoView({behavior: 'smooth', block: 'start'});
      } catch(err) {
        /* Not reached: the frame is same-origin, and nothing inside it runs to ask. */
      }
      tocListEl.querySelectorAll('a').forEach(function(x){ x.classList.remove('active'); });
      a.classList.add('active');
    });
    tocListEl.appendChild(a);
  });
}


function openDoc(id) {
  var ov = document.getElementById('docOv_' + id);
  if (!ov) return;
  ov.classList.add('on');
  var fr = document.getElementById('docFrame_' + id);
  /* A phone's opens on its Close: focus in the search box would bring the keyboard up (HANDOFF §82). */
  var ph = typeof catIsPhone === 'function' && catIsPhone();
  if (typeof modalOpen === 'function')
    modalOpen(ov, {label: (fr && fr.title) || 'Document', onClose: function(){ closeDoc(id); },
                   focus: ph ? ov.querySelector('.doc-close') : null});
  /* Fetched the first time it is opened, not at load; docLoad guards itself. */
  if (!ov.dataset.init) {
    ov.dataset.init = '1';
    try { docLoad(id); } catch (e) { console.error('doc load failed', e); }
  }
}

function closeDoc(id) {
  var ov = document.getElementById('docOv_' + id);
  if (!ov) return;
  ov.classList.remove('on');
  if (typeof modalClose === 'function') modalClose(ov);
}

function docSearch(id) {
  clearTimeout(_docSearchTimers[id]);
  _docSearchTimers[id] = setTimeout(function(){ _doDocSearch(id); }, 200);
}

function docSearchNav(id, dir) {
  var frame = document.getElementById('docFrame_' + id);
  var fd = frame ? (frame.contentDocument || (frame.contentWindow && frame.contentWindow.document)) : null;
  if (!fd) return;
  var marks = fd.querySelectorAll('.doc-srch-hl');
  if (!marks.length) return;
  var idx = _docMatchIdx[id] || 0;
  marks[idx] && marks[idx].classList.remove('active');
  marks[idx] && (marks[idx].style.cssText = 'background:rgba(255,220,0,.6);border-radius:2px');
  idx = (idx + dir + marks.length) % marks.length;
  _docMatchIdx[id] = idx;
  marks[idx].classList.add('active');
  marks[idx].style.cssText = 'background:rgba(255,140,0,.8);border-radius:2px';
  marks[idx].scrollIntoView({behavior: 'smooth', block: 'center'});
  var countEl = document.getElementById('docMatchCount_' + id);
  if (countEl) countEl.textContent = (idx+1) + ' / ' + marks.length;
}

function _doDocSearch(id) {
  var frame = document.getElementById('docFrame_' + id);
  var inp = document.getElementById('docSearch_' + id);
  var countEl = document.getElementById('docMatchCount_' + id);
  var fd = frame ? (frame.contentDocument || (frame.contentWindow && frame.contentWindow.document)) : null;
  if (!fd || !fd.body) return;
  var q = inp ? inp.value.trim() : '';
  fd.querySelectorAll('.doc-srch-hl').forEach(function(el) {
    var p = el.parentNode; if (!p) return;
    p.replaceChild(fd.createTextNode(el.textContent), el);
    p.normalize && p.normalize();
  });
  if (!q || q.length < 2) { if (countEl) countEl.textContent = ''; return; }
  var re = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'gi'), count = 0;
  function walk(node) {
    if (node.nodeType === 3) {
      var t = node.nodeValue; re.lastIndex = 0;
      if (!re.test(t)) return; re.lastIndex = 0;
      var frag = fd.createDocumentFragment(), last = 0, m;
      while ((m = re.exec(t)) !== null) {
        if (m.index > last) frag.appendChild(fd.createTextNode(t.slice(last, m.index)));
        var sp = fd.createElement('span');
        sp.className = 'doc-srch-hl';
        sp.style.cssText = count === 0 ? 'background:rgba(255,140,0,.8);border-radius:2px' : 'background:rgba(255,220,0,.6);border-radius:2px';
        sp.textContent = m[0]; frag.appendChild(sp); count++; last = m.index + m[0].length;
      }
      if (last < t.length) frag.appendChild(fd.createTextNode(t.slice(last)));
      node.parentNode.replaceChild(frag, node);
    } else if (node.nodeType === 1 && node.nodeName !== 'SCRIPT' && node.nodeName !== 'STYLE') {
      Array.from(node.childNodes).forEach(walk);
    }
  }
  walk(fd.body);
  if (countEl) countEl.textContent = count ? '1 / ' + count : 'No matches';
  _docMatchIdx[id] = 0;
  var first = fd.querySelector('.doc-srch-hl');
  if (first) first.scrollIntoView({behavior:'smooth',block:'center'});
}
var _3dEl=null;
function _3dMove(ev){
  if(!_3dEl) return;
  var inner=_3dEl.querySelector('.mdi-inner'); if(!inner) return;
  var rect=_3dEl.getBoundingClientRect();
  var dx=(ev.clientX-rect.left)/rect.width*2-1;   // -1 to 1
  var dy=(ev.clientY-rect.top)/rect.height*2-1;
  var rx=(-dy*10).toFixed(2), ry=(dx*10).toFixed(2);
  inner.style.transform='rotateX('+rx+'deg) rotateY('+ry+'deg) scale(1.02)';
  var ref=_3dEl.querySelector('.mdi-reflect');
  if(ref) ref.style.background='radial-gradient(ellipse at '+((-dx+1)/2*100).toFixed(0)+'% '+((-dy+1)/2*100).toFixed(0)+'%,rgba(255,255,255,.22) 0%,transparent 65%)';
}
function _3dLeave(){
  if(!_3dEl) return;
  var inner=_3dEl.querySelector('.mdi-inner'); if(!inner) return;
  inner.style.transform='rotateX(0deg) rotateY(0deg) scale(1)';
  var ref=_3dEl.querySelector('.mdi-reflect');
  if(ref) ref.style.background='';
}
function _3dOn(el){
  _3dOff(_3dEl);
  _3dEl=el;
  el.addEventListener('mousemove',_3dMove);
  el.addEventListener('mouseleave',_3dLeave);
}
function _3dOff(el){
  if(!el) return;
  el.removeEventListener('mousemove',_3dMove);
  el.removeEventListener('mouseleave',_3dLeave);
  var inner=el.querySelector('.mdi-inner');
  if(inner) inner.style.transform='';
  _3dEl=null;
}

function _initGridTilt(gridEl){
  if(!gridEl || gridEl._tiltInit) return;
  gridEl._tiltInit = true;
  var _activeCard = null;
  gridEl.addEventListener('mousemove', function(ev){
    var ci = ev.target.closest('.ci');
    if(!ci || !gridEl.contains(ci)){
      if(_activeCard) _gridTiltReset(_activeCard);
      _activeCard = null;
      return;
    }
    if(ci !== _activeCard){
      if(_activeCard) _gridTiltReset(_activeCard);
      _activeCard = ci;
    }
    /* the wrapper, built once; built again when the tile was drawn anew without it (faceGridTiles, on a look change), under the pointer or not */
    if(!ci._tiltReady || !ci.querySelector('.ci-tilt-inner')){
      var imgEl = ci.querySelector('.ci-img');
      if(imgEl){
        imgEl.style.perspective = '500px';
        imgEl.style.overflow = 'visible';
        var inner = document.createElement('div');
        inner.className = 'ci-tilt-inner';
        inner.style.cssText = 'transform-style:preserve-3d;transition:transform .1s linear;width:100%;height:100%;position:relative;border-radius:inherit';
        while(imgEl.firstChild) inner.appendChild(imgEl.firstChild);
        var shine = document.createElement('div');
        shine.className = 'ci-tilt-shine';
        shine.style.cssText = 'position:absolute;inset:0;pointer-events:none;border-radius:inherit;z-index:10';
        inner.appendChild(shine);
        imgEl.appendChild(inner);
      }
      ci._tiltReady = true;
    }
    var imgEl = ci.querySelector('.ci-img');
    if(!imgEl) return;
    var inner = imgEl.querySelector('.ci-tilt-inner');
    if(!inner) return;
    var rect = imgEl.getBoundingClientRect();
    var dx = (ev.clientX - rect.left)/rect.width*2-1;
    var dy = (ev.clientY - rect.top)/rect.height*2-1;
    var rx = (-dy*12).toFixed(2), ry = (dx*12).toFixed(2);
    inner.style.transform = 'rotateX('+rx+'deg) rotateY('+ry+'deg) scale(1.04)';
    var shine = imgEl.querySelector('.ci-tilt-shine');
    if(shine) shine.style.background = 'radial-gradient(ellipse at '+((-dx+1)/2*100).toFixed(0)+'% '+((-dy+1)/2*100).toFixed(0)+'%,rgba(255,255,255,.18) 0%,transparent 60%)';
  });
  gridEl.addEventListener('mouseleave', function(){
    if(_activeCard){ _gridTiltReset(_activeCard); _activeCard=null; }
  });
}
function _gridTiltReset(ci){
  var imgEl = ci.querySelector('.ci-img');
  if(!imgEl) return;
  var inner = imgEl.querySelector('.ci-tilt-inner');
  if(inner) inner.style.transform = 'rotateX(0) rotateY(0) scale(1)';
  var shine = imgEl.querySelector('.ci-tilt-shine');
  if(shine) shine.style.background = '';
}





function _dlFilter(){
  var q = (document.getElementById('dlSearch')||{}).value||'';
  q = q.trim().toLowerCase();
  var modeFilter = (document.getElementById('dlModeFilter')||{}).value||'';
  var colMode = (document.getElementById('dlColMode')||{}).value||'';
  var selColors = [];
  document.querySelectorAll('.dl-col-chk:checked').forEach(function(cb){ selColors.push(cb.value); });

  var grid = document.getElementById('dlGrid');
  if(!grid) return;
  var cards = grid.querySelectorAll('.dl-card');
  var shown = 0;
  cards.forEach(function(card){
    var name = (card.dataset.deckname||'').toLowerCase();
    var mode = card.dataset.deckmode||'';
    var pipColorsStr = card.dataset.pipcolors||'';
    var pipColors = pipColorsStr ? pipColorsStr.split(',') : [];

    var nameMatch = !q || name.indexOf(q) >= 0;
    var modeMatch = !modeFilter || mode === modeFilter;

    var colorMatch = true;
    if(colMode && selColors.length){
      if(colMode === 'any') colorMatch = selColors.some(function(c){ return pipColors.indexOf(c)>=0; });
      else if(colMode === 'all') colorMatch = selColors.every(function(c){ return pipColors.indexOf(c)>=0; });
      else if(colMode === 'noother') colorMatch = pipColors.length>0 && pipColors.every(function(c){ return selColors.indexOf(c)>=0; });
      else if(colMode === 'none') colorMatch = selColors.every(function(c){ return pipColors.indexOf(c)<0; });
      else if(colMode === 'exact'){
        colorMatch = selColors.length === pipColors.length && selColors.every(function(c){ return pipColors.indexOf(c)>=0; });
      }
    }

    var show = nameMatch && modeMatch && colorMatch;
    card.style.display = show ? '' : 'none';
    if(show) shown++;
  });
  var empty = document.getElementById('dlEmpty');
  if(empty) empty.style.display = shown ? 'none' : 'block';
}

/* Everything that remembers a deck by name (TBO.host.deck, TBO.deckPick, TBO.host.ddeck, DRS.deck) follows a rename. */
function _deckRenamed(oldName, newName){
  try{
    if(typeof TBO !== 'undefined' && TBO && TBO.host){
      var hit = false;
      if(TBO.host.deck === oldName){ TBO.host.deck = newName; hit = true; }
      if(TBO.host.ddeck === oldName){ TBO.host.ddeck = newName; hit = true; }
      if(hit && typeof tboSaveHost === 'function') tboSaveHost();
      if(TBO.deckPick === oldName){
        TBO.deckPick = newName;
        if(typeof tboSendSeat === 'function') tboSendSeat();
      }
    }
  }catch(_){}
  try{
    if(typeof DRS !== 'undefined' && DRS && DRS.deck === oldName){
      DRS.deck = newName;
      if(typeof drSaveOpts === 'function') drSaveOpts();
    }
  }catch(_){}
}
window._deckRenamed = _deckRenamed;

function renderDeckLists(){
  var saved = _savedLoad();
  var grid = document.getElementById('dlGrid');
  var empty = document.getElementById('dlEmpty');
  if(!grid) return;
  grid.innerHTML = '';
  var names = Object.keys(saved).sort();
  if(!names.length){ if(empty) empty.style.display='block'; return; }
  if(empty) empty.style.display='none';
  var cardMap = {};
  CARDS.forEach(function(c){ cardMap[c.name] = c; });

  function _drawMiniPipBar(canvas, labels, values){
    var dpr = window.devicePixelRatio||1;
    var W = canvas.parentElement ? Math.max(canvas.parentElement.clientWidth - 10, 80) : 180;
    var BAR_H = 28, ICON_R = 9, PAD = 2;
    var H = BAR_H + PAD*2;
    var total = values.reduce(function(a,b){return a+b;},0);
    if(!total){ canvas.width=0; canvas.height=0; return; }
    var SLANT_DEG = 66;
    var dx = BAR_H / Math.tan(SLANT_DEG * Math.PI / 180);
    var W_CANVAS = W + Math.ceil(dx);
    canvas.width = W_CANVAS*dpr; canvas.height = H*dpr;
    canvas.style.width = W_CANVAS+'px'; canvas.style.height = H+'px';
    var ctx = canvas.getContext('2d'); ctx.scale(dpr,dpr);
    var fracs = values.map(function(v){return v/total;});
    var cumW = [0];
    fracs.forEach(function(f){cumW.push(cumW[cumW.length-1]+f*W);});
    var BY = PAD, BH = BAR_H;
    labels.forEach(function(color,i){
      var x0=cumW[i], x1=cumW[i+1];
      var fill = PIP_FILL[color]||'#888';
      var outline = PIP_OUTLINE[color]||'#000';
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(x0+dx,BY); ctx.lineTo(x1+dx,BY);
      ctx.lineTo(x1,BY+BH); ctx.lineTo(x0,BY+BH);
      ctx.closePath(); ctx.clip();
      ctx.fillStyle = fill;
      ctx.fillRect(0,BY,W_CANVAS,BH);
      var segCx=(x0+x1)/2+dx/2, segCy=BY+BH/2;
      if(ICON_IMGS[color] && ICON_IMGS[color].complete && ICON_IMGS[color].naturalWidth>0){
        ctx.save();
        ctx.beginPath(); ctx.arc(segCx,segCy,ICON_R,0,Math.PI*2); ctx.clip();
        ctx.drawImage(ICON_IMGS[color],segCx-ICON_R,segCy-ICON_R,ICON_R*2,ICON_R*2);
        ctx.restore();
      }
      ctx.restore();
      ctx.strokeStyle = outline; ctx.lineWidth = 1.5;
      ctx.beginPath(); ctx.moveTo(x0+dx,BY); ctx.lineTo(x0,BY+BH); ctx.stroke();
    });
    var lastOutline = PIP_OUTLINE[labels[labels.length-1]]||'#000';
    ctx.strokeStyle = lastOutline; ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(cumW[labels.length]+dx,BY);
    ctx.lineTo(cumW[labels.length],BY+BH);
    ctx.stroke();
    var thOutline = getComputedStyle(document.documentElement).getPropertyValue('--gd').trim()||'#7a6030';
    ctx.strokeStyle = thOutline; ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.moveTo(cumW[0]+dx,BY); ctx.lineTo(cumW[labels.length]+dx,BY);
    ctx.lineTo(cumW[labels.length],BY+BH); ctx.lineTo(cumW[0],BY+BH);
    ctx.closePath(); ctx.stroke();
  }

  names.forEach(function(name){
    var entry = saved[name];
    var mainText = '', essText = '', wishText = '';
    var savedMode = 'constructed';
    if(typeof entry === 'string'){ mainText = entry; }
    else { mainText = entry.main||''; essText = entry.essence||''; wishText = entry.wish||''; savedMode = entry.mode||'constructed'; }

    /* In the catalog's spelling (deckCanonEntries), as the Build Deck page reads them. */
    var mainDeck = deckCanonEntries(parseDeckLines(mainText), true);
    var essDeck = deckCanonEntries(parseDeckLines(essText), true);
    var wishDeck = deckCanonEntries(parseDeckLines(wishText), true);
    /* As the rules count it: a Kingdoms Lord is not part of the Main Deck. */
    var mainTotal = deckMainCount(mainDeck, savedMode);
    var essTotal = essDeck.reduce(function(a,b){return a+b.count;},0);
    var wishTotal = wishDeck.reduce(function(a,b){return a+b.count;},0);

    /* From GAME_MODES, not a default of 'Constructed', which captioned every Rebirth deck as a mode Rebirth does not have. */
    var modeLabel = (typeof GAME_MODES !== 'undefined' && GAME_MODES[savedMode]
                     && GAME_MODES[savedMode].label)
                  || (savedMode === 'none' ? 'None' : 'Constructed');

    var cmcSum = 0, cmcCount = 0;
    mainDeck.forEach(function(en){
      var card = cardMap[en.name]; if(!card) return;
      var cmc = parseFloat(card.cmc); if(!isNaN(cmc)){ cmcSum += cmc*en.count; cmcCount += en.count; }
    });
    var avgCmc = cmcCount ? (cmcSum/cmcCount).toFixed(1) : '--';

    /* manaPips, the counter every other page uses, so a hybrid is shared out here too. */
    var pipC = {}; COLORS.forEach(function(c){pipC[c]=0;});
    mainDeck.forEach(function(en){
      var card = cardMap[en.name]; if(!card) return;
      var p = manaPips(card.manaCost, en.count);
      Object.keys(p).forEach(function(c){ pipC[c]=(pipC[c]||0)+p[c]; });
    });
    var pipLabels = COLORS.filter(function(c){return pipC[c]>0;});
    var pipValues = pipLabels.map(function(c){return pipC[c];});

    var ESSENCE_SUB_COLOR_MAP = {Ire:'Red',Vig:'Orange',Lux:'Yellow',Arch:'Green',Yune:'Blue',Psy:'Indigo',Gris:'Violet'};
    var essC = {}; COLORS.forEach(function(c){essC[c]=0;});
    essDeck.forEach(function(en){
      var card = cardMap[en.name]; if(!card) return;
      _catArr(card.subTypes).forEach(function(st){
        var col = ESSENCE_SUB_COLOR_MAP[st]; if(col) essC[col] += en.count;
      });
    });
    var essTotal2 = 0; COLORS.forEach(function(c){essTotal2 += essC[c];});
    var essLabels = COLORS.filter(function(c){return essC[c]>0;});
    var essValues = essLabels.map(function(c){return essC[c];});

    /* deckLegality, as the Build Deck page uses; the page checks more than it does (its Known issue, cat_deck.js), so a deck it flags can still get a tick here. */
    var combined = {};
    mainDeck.concat(wishDeck).forEach(function(en){
      combined[en.name] = (combined[en.name]||0) + en.count;
    });
    var verdict = deckLegality(savedMode,
      {main:mainTotal, essence:essTotal, wish:wishTotal},
      {cardMap:cardMap, combined:combined,
       decks:{main:mainDeck, wish:wishDeck, essence:essDeck,
              armament:deckCanonEntries(parseDeckLines((entry && typeof entry === 'object' && entry.armament) || ''), true)}});
    var legal = verdict.legal;
    /* A deck type with no rules to break (checked false) gets a dash, not a tick it has not earned. */
    var unjudged = savedMode === 'none' || verdict.checked === false;

    /* The card's picture (_artSrc), not imageUrl, which most published cards leave "". */
    var heroUrl = '';
    if(mainDeck.length){
      var heroCard = cardMap[mainDeck[0].name];
      if(heroCard) heroUrl = _artSrc(heroCard);
    }

    var legalClass = unjudged ? 'none' : (legal ? 'ok' : 'err');
    var legalIcon = unjudged ? '&#8212;' : (legal ? '&#10003;' : '&#10007;');
    /* A Draft Deck is a pool, not judged. */
    var isDraft = savedMode === 'draft' && typeof drPoolOf === 'function';
    var dpool = isDraft ? drPoolOf(entry) : null;
    if(isDraft){ legalClass = 'none'; legalIcon = '&#8212;'; }

    var cardEl = document.createElement('div');
    cardEl.className = 'dl-card';
    cardEl.dataset.deckname = name;
    cardEl.dataset.deckmode = savedMode;
    cardEl.dataset.pipcolors = pipLabels.join(',');
    cardEl.innerHTML =
      '<div class="dl-card-acts"><button class="dl-card-dup nb nb-purple nb-s nb-over" title="Duplicate" data-dn="'+e(name)+'">'+uiIco('copy')+'Duplicate</button><button class="dl-card-del nb nb-red nb-s nb-over" title="Delete" data-dn="'+e(name)+'">Delete &#10005;</button></div>'+
      '<div class="dl-card-hero">'+(heroUrl ? '<img src="'+e(heroUrl)+'" alt="" loading="lazy">' : '')+'<div class="dl-card-hero-grad"></div></div>'+
      '<div class="dl-card-top"><div class="dl-card-name-box"><span class="dl-card-name">'+e(name)+'</span></div><div style="display:flex;align-items:center;gap:4px"><div class="dl-card-mode-box"><span class="dl-card-mode">'+modeLabel+'</span></div><span class="dl-card-legal '+legalClass+'">'+legalIcon+'</span></div></div>'+
      '<div class="dl-card-body">'+
        (isDraft
          ? '<div class="dl-card-row">'+
              '<span>Pool: <strong>'+dpool.names.length+'</strong></span>'+
              (dpool.skipped ? '<span>Essence left out: <strong>'+dpool.skipped+'</strong></span>' : '')+
              '<span>Avg CMC: <strong>'+avgCmc+'</strong></span>'+
              '<button class="ed2-btn tiny tbl-green dl-card-draft" data-dn="'+e(name)+'">Draft</button>'+
            '</div>'
          : '<div class="dl-card-row">'+
              '<span>Main: <strong>'+mainTotal+'</strong></span>'+
              '<span>Essence: <strong>'+essTotal+'</strong></span>'+
              '<span>Wish: <strong>'+wishTotal+'</strong></span>'+
              '<span>Avg CMC: <strong>'+avgCmc+'</strong></span>'+
            '</div>')+
        '<div class="dl-card-bars">'+
          '<canvas class="dl-pip-canvas" style="display:block;width:100%"></canvas>'+
          (essTotal2 > 0 ? '<canvas class="dl-ess-canvas" style="display:block;width:100%;margin-top:3px"></canvas>' : '')+
        '</div>'+
      '</div>';

    cardEl.addEventListener('click', function(ev){
      if(ev.target.closest('.dl-card-acts')) return;
      var d = saved[name];
      if(typeof d === 'string'){
        document.getElementById(DECK_IDS.main).value = d;
        document.getElementById(DECK_IDS.essence).value = '';
        document.getElementById(DECK_IDS.wish).value = '';
      } else {
        Object.keys(DECK_IDS).forEach(function(k){
          var el = document.getElementById(DECK_IDS[k]);
          if(el) el.value = d[k]||'';
        });
        /* The mode first, then the stat row (HANDOFF §22.1): _hashSaveDeck reads the row back into the entry, so skipping tdWriteStatRow destroys it. */
        /* Each stands alone: chained, a throw in the mode switch would take the stat restore down with it. */
        try{ if(d.mode) setGameMode(d.mode); }catch(_){}
        try{ if(typeof tdWriteStatRow === 'function') tdWriteStatRow(d); }catch(_){}
        try{ if(typeof tdSyncStatRow === 'function') tdSyncStatRow(); }catch(_){}
      }
      updCnt(); _hashSaveDeck();
      showTab('deck');
    });

    var drBtn = cardEl.querySelector('.dl-card-draft');
    if(drBtn) drBtn.addEventListener('click', function(ev){
      ev.stopPropagation();
      drSetupOpen(this.dataset.dn);
    });

    cardEl.querySelector('.dl-card-del').addEventListener('click', function(ev){
      ev.stopPropagation();
      var dn = this.dataset.dn;
      if(confirm('Delete saved deck "'+dn+'"?')){
        var d = _savedLoad(); delete d[dn]; _savedWrite(d);
        renderDeckLists(); renderSavedDecks(); _updateDLCount();
      }
    });

    cardEl.querySelector('.dl-card-dup').addEventListener('click', function(ev){
      ev.stopPropagation();
      var dn = this.dataset.dn;
      var d = _savedLoad();
      if(!d[dn]) return;
      var copyName = dn + ' (Copy)';
      var n = 2;
      while(d[copyName]){ copyName = dn + ' (Copy '+n+')'; n++; }
      d[copyName] = JSON.parse(JSON.stringify(d[dn]));
      _savedWrite(d);
      renderDeckLists(); renderSavedDecks(); _updateDLCount();
    });

    var nameEl = cardEl.querySelector('.dl-card-name');
    if(nameEl){
      nameEl.addEventListener('dblclick', function(ev){
        ev.stopPropagation();
        var oldName = name;
        var inp = document.createElement('input');
        inp.type = 'text';
        inp.value = oldName;
        inp.style.cssText = 'font-family:Cinzel,serif;font-size:1rem;font-weight:700;color:var(--txt-accent);background:var(--s2);border:1px solid var(--go);border-radius:4px;padding:2px 6px;width:100%;outline:none';
        nameEl.textContent = '';
        nameEl.appendChild(inp);
        inp.focus();
        inp.select();
        function _doRename(){
          var newName = inp.value.trim();
          if(!newName || newName === oldName){
            nameEl.textContent = oldName;
            return;
          }
          var d = _savedLoad();
          if(d[newName]){ alert('A deck named "'+newName+'" already exists.'); nameEl.textContent = oldName; return; }
          d[newName] = d[oldName];
          delete d[oldName];
          _savedWrite(d);
          _deckRenamed(oldName, newName);
          _dlDirty = true;
          renderDeckLists(); renderSavedDecks(); _updateDLCount();
        }
        inp.addEventListener('blur', _doRename);
        inp.addEventListener('keydown', function(kev){
          if(kev.key === 'Enter'){ kev.preventDefault(); inp.blur(); }
          if(kev.key === 'Escape'){ inp.removeEventListener('blur', _doRename); nameEl.textContent = oldName; }
        });
      });
    }

    grid.appendChild(cardEl);

    requestAnimationFrame(function(){
      // Lock the width, so minimising a panel does not resize the tiles.
      if(!cardEl._wLocked && cardEl.clientWidth > 50){
        cardEl.style.width = cardEl.clientWidth + 'px';
        cardEl._wLocked = true;
      }
      var pipCanvas = cardEl.querySelector('.dl-pip-canvas');
      if(pipCanvas && pipLabels.length) _drawMiniPipBar(pipCanvas, pipLabels, pipValues);
      else if(pipCanvas) pipCanvas.style.display='none';
      var essCanvas = cardEl.querySelector('.dl-ess-canvas');
      if(essCanvas && essLabels.length) _drawMiniPipBar(essCanvas, essLabels, essValues);
      else if(essCanvas) essCanvas.style.display='none';
    });
  });
}

var _SC_KEYS = [
  {keys:['B'], desc:'Switch to Browse tab'},
  {keys:['D'], desc:'Switch to Build Deck tab'},
  {keys:['L'], desc:'Switch to Deck Lists tab'},
  {keys:['1'], desc:'Switch to Grid view'},
  {keys:['2'], desc:'Switch to Details view'},
  {keys:['3'], desc:'Switch to List view'},
  {keys:['I'], desc:'Toggle Info overlay on/off (Grid view)'},
  {keys:['F','/'], desc:'Focus the search box'},
  {keys:['H'], desc:'Toggle Highlight panel (Build Deck tab)'},
  {keys:['\u2190','\u2192'], desc:'Previous / Next page (Browse)'},
  {keys:['\u2190','\u2192'], desc:'Previous / Next card (Modal open)'},
  {keys:['K'], desc:'Open Keywords page'},
  {keys:['R'], desc:'Open Rules page'},
  {keys:['Esc'], desc:'Close any open modal or overlay'},
  {keys:['?'], desc:'Open this Help page'}
];
var _SC_TIPS = [
  {title:'Saved Decks', desc:'You save and load Decks from the bottom of the Deck Panel. Click a saved name to load it; click \u2715 to delete it.', phone:'You save a Deck with the Save row at the top of Build Deck. Your saved Decks are on the Deck Lists tab: tap one to load it; tap \u2715 to delete it.'},
  {title:'Importing Decks', desc:'"Import" on the Deck Panel will load Decks you have copied in your clipboard, or it will open a file explorer for you to choose a file to load. The format is "3x Card Name", "3 Card Name". Not case or symbol sensitive (dashes, quotes, and punctuation differences are read properly).', phone:'"Import" on the Deck List page (Build Deck, then Deck List) will load Decks you have copied, or let you choose a file to load. The format is "3x Card Name", "3 Card Name". Not case or symbol sensitive (dashes, quotes, and punctuation differences are read properly).'},
  {title:'Multi-Deck System', desc:'Your (Main) Deck, Essence Deck, and Wish Deck are all accommodated for. Essence cards are automatically added to the Essence Deck, and card copy limits are checked across all Decks.'},
  {title:'Group \u0026 Sort Cards in Your Deck', desc:'On the Build Deck page, "Group By" organizes cards under section headers (by Super-Type, Sub-Type, Color, or CMC). "Sort By" reorders cards within groups. Both work in Grid, Details, and List views.', phone:'On the Build Deck page, "Group By" organizes cards under section headers (by Super-Type, Sub-Type, Color, or CMC). "Sort By" reorders cards within groups.'},
  {title:'Different Game Mode Rules', desc:'Different Game Mode Deck building restrictions are built in, and appropriate error messages are shown for each type. Constructed, Kingdoms, or None. Each mode has different deck size limits, copy limits, and Unique card rules. Choose "None" to disable all error messages.'},
  {title:'Highlight Cards', desc:'On the Build Deck page, you can use the "Highlight" option to highlight cards of a certain criteria. To help you single out certain cards even when viewing everything at once. You can highlight by color, CMC, type, or rule text.', phone:''},
  {title:'Auto Fill Essence', desc:'"Populate Essence" will automatically fill your Essence Deck with Core Essence to most closely match the same ratio of "Mana Pips by Color" of your Main Deck. This option DOES NOT account for Dual Essence or otherwise, and does not take any cards in your Wish Deck into account. This option is only recommended for simple Decks. You can only use this if you have no cards in your Essence Deck.'},
  {title:'Saving Images / Print Options', desc:'All four are in the "Export" menu on the Build Deck page, and each takes every section of your Deck.\n"Images": Will download a .zip file of each card image of cards in your Decks. (Only 1x of each card)\n"Print": Generates a PDF of all the card images in your Deck, with the appropriate amount of each card matching your Deck list. (3 \u00d7 3 per page)\n"Proxies": Generates a PDF of all the cards in your Deck as text-only with symbols for the Mana Cost and Stats of the cards. (For a low ink alternative when wanting quick paper prototyping and playtesting.) (3 \u00d7 3 per page)', phone:''},
  {title:'Deck Saved via URL', desc:'Your Deck is saved to the page URL as you edit it. You can copy and share the URL as an alternative to copying the Deck list.'},
  {title:'Filter Persistence via URL', desc:'Browse filters (name search, color, type, CMC) are also saved to the URL. Share a filtered view by copying the URL after applying your filters. (For showing other people certain groups of cards of interest.)'},
  {title:'Drafting', desc:'A "Draft Deck" (a Deck Type on the Build Deck page) is a card list to draft from, not a Deck to play - every card in it is in the pool except Essence, which Arena provides. Press "Draft" on it in Deck Lists and choose:\n"Default Draft": four packs of 15 each - pick one, pass the rest (left, right, left, right).\n"Vault": 120 cards each, nothing to pick.\n"Hex Draft" (2 players): six piles of 30 round a hexagon - take the top card of two side-by-side piles; the other player takes two of the four left; the last two are removed.\n"Winchester" (2-4 players): four face-up piles - take a whole pile, then every pile gets one more card.\nChairs you do not fill are bots that pick at random. A short pool deals every card once before repeating any. When the draft ends, build an Arena Deck of exactly 30 from what you took and save it. At a table, the host picks Mode: Draft in Options and presses "Start Draft" in the waiting room.', phone:'A "Draft Deck" (a Deck Type on the Build Deck page) is a card list to draft from, not a Deck to play - every card in it is in the pool except Essence, which Arena provides. Press "Draft" on it in Deck Lists and choose:\n"Default Draft": four packs of 15 each - pick one, pass the rest (left, right, left, right).\n"Vault": 120 cards each, nothing to pick.\n"Hex Draft" (2 players): six piles of 30 round a hexagon - take the top card of two side-by-side piles; the other player takes two of the four left; the last two are removed.\n"Winchester" (2-4 players): four face-up piles - take a whole pile, then every pile gets one more card.\nChairs you do not fill are bots that pick at random. A short pool deals every card once before repeating any. When the draft ends, build an Arena Deck of exactly 30 from what you took and save it.'},
  {title:'Tabletop Simulator', desc:'Use "TTS" in the Export menu on the Build Deck page to export your Deck as a single .json file you can copy and paste into Tabletop Simulator.', phone:''}
];
var _SC_EDITOR = [
  {title:'Opening a Card', desc:'Press Edit (✎) on a card in the catalog or in its card window, or press "New card". Official cards are read-only and do not open here. The arrows over the preview, or the arrow keys when no field has focus, step through the cards the catalog is showing, in its order. The preview is the card as it prints, redrawn as you type.'},
  {title:'The Toolbar', desc:'"Back to catalog" returns to Browse.\n"Autosave" (on to begin with) stores each change a moment after you make it; turned off, a card is stored only on "Save", "Save All" or leaving it.\n"Save" stores this card and "Save All" every card waiting; the badge on Save All counts them.\n"Duplicate" makes a copy of this card and opens it.\n"Keywords" opens the Keywords page.\n"New card" starts a blank card.\n"Test" keeps this card out of the published catalog: it goes to testing.json, which only your copy reads.\n"Delete card" deletes this card, and it stays deleted after a reload.'},
  {title:'Fix', desc:'Clean-up tools that look through every card you can edit: "Fix —", "Strip ( )" (reminder text left in brackets), "Essence Rule Text", "Fused Stats", "Duplicate Cards", "Same Shape, Different Name", "Same Card in Several Sagas", "Saga Fields Disagree", "Card IDs" and "Orphaned Cards".'},
  {title:'Templates', desc:'"Templates" opens the settings every card is drawn with: Display, Art Defaults (what a card whose art fill is "Auto" gets), Card Frames, Orb Icons, Mana & Rule Symbols, Saved Templates, Rules Text Alignment and Pack.'},
  {title:'Mana Cost and Name', desc:'Type the Mana Cost in braces, such as {2}{R}{R}; it is put in order when you leave the field. The \u25BE at the right end of the box picks a color, X, a number from 0 to 20 or a hybrid from a menu. The date at the end of the Name row is when the card was last saved.'},
  {title:'Super-Type and Sub-Type', desc:'Type in the box to search, then press Enter or pick one from the list. Each type is added as a chip to the right of its box, and the box narrows to make room. Press × on a chip to take it off, or drag a chip to change the order: the type line reads in that order, and Templates match a card on its first Sub-Type.'},
  {title:'Stats', desc:'Four slots, each a stat (Attack, Health, Arcane, Range, Attack + Arcane, Health + Arcane, Blank or Hidden) and its value. Tick * to print a centered * in place of a number.'},
  {title:'Rule Text', desc:'"No split" is one rules box; "Split 2", "Split 3" and "Split 4" divide it into sections, each with its own text. "All Individual" gives every section its own name, type line and mana cost (or tick a section by itself), and "Choice" adds one line across the top.\nB, I and U make the selected text bold, italic or underlined, "Add —" puts an em dash at the cursor, and "Insert Card Name" links another card: it prints bold and underlined, shows that card when hovered, and the Play Test board can create a copy of it.\n"Symbols \u25BE" types a symbol at the cursor: the seven colors, Lock, X, 0 to 20, every symbol uploaded on Templates, and the stat and dice marks (ATK, HP, MP, Rg, D4 to D20), which type their word. For a hybrid, tick two or three colors in the Hybrid row and press "Add". Hover over a symbol for its name. The menu stays open, so you can add several in a row, until you click elsewhere or press "Close \u2715".'},
  {title:'Flavor Text', desc:'The italic text under the rules. "lines" sets how many lines it may use on the card; blank is automatic. The rules text always fills what is left.'},
  {title:'Art', desc:'"Variant" is the card’s looks: "+" adds one, ✎ renames it and "Delete" removes it. The art, its fill and its framing belong to the look.\nThe first menu places the art: "Horizontal Art" (above the rules box), "Left Vertical Art" or "Right Vertical Art" (beside it). The second sets how it fills its window: "Auto" (Templates’ Art Defaults), "Contain" (all of it, letterboxed), "Cover" (fills the window, cropping) or "Fill" (stretched).\nDrag the picture on the stage to move it and scroll to zoom; the bright window is what lands on the card. X, Y, Zoom and Rotate do the same by number. "Upload" adds or replaces the picture, "Reset" puts its framing back, "Flip" mirrors it and "Remove" takes it off. Everything here can be set before there is art, and applies as soon as there is.'},
  {title:'Look', desc:'Highlight gradients for the card’s Image, Background, Pinlines and Border: each takes a preset (the same set the keyword pills use), a blend mode and a strength. "Watermark" opens the watermark editor, and the menu beside it picks this card’s watermark.'},
  {title:'Colour', desc:'Prints this card in other colors: pick as many as you like. What the card is does not change, only how it is drawn. Click a color again to take it out, or "Clear" to go back to the card’s own.'},
  {title:'Keyword Reminders', desc:'Every keyword, key term and counter in the rules text is listed under the colors. Click one to print its reminder text on the card, and again to take it off; hover over one to read it.'},
  {title:'Credits', desc:'"Owner" is who the card belongs to, printed at its bottom left; "Revision #" is its revision and "Artist" who made the art. Type a saga’s name in "Saga" and press Enter to add the card to that saga. In Rebirth, "Rarity" sets its rarity.'},
  {title:'Sagas', desc:'Every saga the card is in sits beside "Sagas" and its count. Click one to edit the card as that saga prints it; × takes the card out of that saga (a card has to stay in at least one).\nAll copies of this card share Name, Type-Line, Mana Cost, Rules Text, Stats and Revision #. Different versions of this card can have its Flavor Text, Art and Artist, and Owner individually changed.'}
];
var _scMode = 'keys';
function switchScTab(mode){
  _scMode = mode;
  document.getElementById('sct-keys').classList.toggle('on', mode==='keys');
  document.getElementById('sct-tips').classList.toggle('on', mode==='tips');
  var _ed=document.getElementById('sct-editor');
  if(_ed)_ed.classList.toggle('on', mode==='editor');
  var _sy=document.getElementById('sct-sync');
  if(_sy)_sy.classList.toggle('on', mode==='sync');
  renderScPage();
}
function renderScPage(){
  var body = document.getElementById('scBody');
  /* A phone has no keyboard to take shortcuts from: its Help is the tips (HANDOFF §82). */
  if(_scMode === 'keys' && typeof catIsPhone === 'function' && catIsPhone()){ switchScTab('tips'); return; }
  body.innerHTML = '';
  if(_scMode === 'keys'){
    body.style.display = 'grid';
    body.style.gridTemplateColumns = 'repeat(4,1fr)';
    body.style.flexDirection = '';
    _SC_KEYS.forEach(function(item){
      var div = document.createElement('div');
      div.className = 'kw-entry';
      var circlesHtml = '';
      item.keys.forEach(function(k){
        circlesHtml += '<span class="hk-circle" style="width:36px;height:36px;font-size:1rem;margin:0;flex-shrink:0">'+k+'</span>';
      });
      var keysWrap = item.keys.length > 1
        ? '<div style="display:flex;flex-direction:column;gap:4px;align-items:center;flex-shrink:0">'+circlesHtml+'</div>'
        : circlesHtml;
      div.innerHTML = '<div style="display:flex;gap:10px;align-items:center">'+keysWrap+'<div class="kw-reminder" style="flex:1">'+item.desc+'</div></div>';
      body.appendChild(div);
    });
  /* switchScTab('sync') still answers, showing Tips, so nothing that calls it throws (Owner Sync opens from the Sagas page). */
  } else {
    body.style.display = 'grid';
    body.style.gridTemplateColumns = 'repeat(2,1fr)';
    body.style.flexDirection = '';
    /* '' in a tip's phone words leaves it off a phone. */
    var _ph = typeof catIsPhone === 'function' && catIsPhone();
    var _list = (_scMode === 'editor' && !_ph) ? _SC_EDITOR : _SC_TIPS;
    _list.forEach(function(item){
      var desc = (_ph && typeof item.phone === 'string') ? item.phone : item.desc;
      if(!desc) return;
      var div = document.createElement('div');
      div.className = 'kw-entry';
      div.innerHTML = '<div class="kw-name">'+item.title+'</div><div class="kw-reminder">'+desc.replace(/\n/g,'<br>')+'</div>';
      body.appendChild(div);
    });
  }
}

// Known issue: no modifier or contenteditable check; the Editor's E is unbound.
document.addEventListener('keydown', function(ev){
  var tag = ev.target.tagName;
  if(tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
  var modalOpen = document.getElementById('mo').classList.contains('on');
  /* Keywords is a page, not an overlay, so it does not block the tab hotkeys */
  var kwOpen = false;
  var scOpen = document.getElementById('scOverlay') && document.getElementById('scOverlay').classList.contains('on');
  var docOpen = false;
  document.querySelectorAll('.doc-overlay').forEach(function(d){ if(d.classList.contains('on')) docOpen=true; });
  if(ev.key === 'Escape'){
    if(scOpen){ closeShortcutsPage(); ev.preventDefault(); return; }
    return; // let existing Escape handlers fire
  }
  if(modalOpen || kwOpen || scOpen || docOpen) return;
  var k = ev.key;
  switch(k.toLowerCase()){
    case 'b': _keyTab('browse', 'Browse'); ev.preventDefault(); break;
    case 'd': _keyTab('deck', 'Build Deck'); ev.preventDefault(); break;
    case 'l': _keyTab('decklists', 'Deck Lists'); ev.preventDefault(); break;
    case '1': setView('grid'); ev.preventDefault(); break;
    case '2': setView('details'); ev.preventDefault(); break;
    case '3': setView('list'); ev.preventDefault(); break;
    case 'arrowleft':
      if(document.getElementById('pane-browse').style.display !== 'none'){ goPage(-1); ev.preventDefault(); }
      break;
    case 'arrowright':
      if(document.getElementById('pane-browse').style.display !== 'none'){ goPage(1); ev.preventDefault(); }
      break;
    case '/': case 'f':
      ev.preventDefault(); document.getElementById('ns').focus(); break;
    case 'i': toggleCardInfo(!_showCardInfo); ev.preventDefault(); break;
    case 'k': _keyTab('keywords', 'Keywords'); ev.preventDefault(); break;
    case 'r': if(typeof openDoc==='function') openDoc(window.REBIRTH?'rbrules':'rules'); else { var rb=document.querySelector('[title*="Rules"]'); if(rb) rb.click(); } ev.preventDefault(); break;
    case '?': openShortcutsPage(); ev.preventDefault(); break;
    case 'h': if(document.getElementById('pane-deck').style.display !== 'none'){ toggleHlPanel(); ev.preventDefault(); } break;
  }
});

/* A key that would take you off the board asks first: with the tab row gone from Play Test, B, D, L and K are the only way off but Leave. */
function _keyTab(tab, words){
  if(document.body.classList.contains('testdeck-active') && typeof confirm === 'function'){
    var at = (typeof tblOn === 'function') && tblOn();
    if(!confirm('Leave the board for ' + words + '?' + String.fromCharCode(10, 10)
        + (at ? 'You stay at the table, and your game is kept.'
              : 'Your game is kept, so Play Test carries on from here.'))) return;
  }
  showTab(tab);
}

/* modalOpen gives it the dialog's role, name, Tab trap, Escape and the return of focus. */
function openShortcutsPage(){
  var el = document.getElementById('scOverlay');
  if(!el) return;
  el.classList.add('on'); renderScPage();
  if(typeof modalOpen === 'function') modalOpen(el, {label:'Help: keyboard shortcuts and tips', onClose:closeShortcutsPage});
}

function closeShortcutsPage(){
  var el = document.getElementById('scOverlay');
  if(!el) return;
  el.classList.remove('on');
  if(typeof modalClose === 'function') modalClose(el);
}

/* One table walked both ways (_filterRead, _filterWrite): two lists drift, and a copied link restores a different result. */
var FILTER_FIELDS = [
  {k:'name',  id:'ns',         kind:'value'},
  {k:'rule',  id:'rs',         kind:'value'},
  {k:'rtm',   id:'rtMode',     kind:'value', def:'all'},
  /* The match modes keep the keys and values they had as radio rows, so an older link loads the same. */
  {k:'cm',    id:'cmSel',      kind:'value', def:'any'},
  {k:'stm',   id:'stmSel',     kind:'value', def:'any'},
  {k:'sbm',   id:'sbmSel',     kind:'value', def:'any'},
  {k:'colors',                 kind:'boxes', f:'color'},
  {k:'su',                     kind:'terms', wrap:'suf'},
  {k:'st',                     kind:'terms', wrap:'stf'},
  {k:'cop',   id:'cop',        kind:'value'},
  {k:'cval',  id:'cval',       kind:'value'},
  {k:'aop',   id:'aop',        kind:'value'},
  {k:'aval',  id:'aval',       kind:'value'},
  {k:'hop',   id:'hop',        kind:'value'},
  {k:'hval',  id:'hval',       kind:'value'},
  {k:'arop',  id:'arop',       kind:'value'},
  {k:'arval', id:'arval',      kind:'value'},
  {k:'rop',   id:'rop',        kind:'value'},
  {k:'rval',  id:'rval',       kind:'value'},
  {k:'date',  id:'dateFilter', kind:'value'},
  {k:'saga',  id:'fsaga',      kind:'value'},
  {k:'atkC',  id:'atkarc',     kind:'checked'},
  {k:'hpC',   id:'hparc',      kind:'checked'}
  /* No x / atkA / hpA / arcA / rngA: "Contains" travels as cop / aop / hop / arop / rop; _filterLegacy reads older links. */
];
/* A link saved before v:2 means what it meant then: rule text's default mode and the "Contains" boxes changed under it. */
var FILTER_LEGACY_CONTAINS = {x:['cop','x'], atkA:['aop','star'], hpA:['hop','star'], arcA:['arop','star'], rngA:['rop','star']};
function _filterLegacy(f){
  if(f.v) return f;
  if(f.rule && !f.rtm) f.rtm = 'exact';
  Object.keys(FILTER_LEGACY_CONTAINS).forEach(function(k){
    var to = FILTER_LEGACY_CONTAINS[k];
    if(f[k] && !f[to[0]]) f[to[0]] = to[1];
  });
  return f;
}

function _filterRead(fd){
  if(fd.kind === 'value'){
    var el = document.getElementById(fd.id); if(!el) return null;
    var v = String(el.value || '').trim();
    return (!v || v === fd.def) ? null : v;
  }
  if(fd.kind === 'checked'){
    var c = document.getElementById(fd.id);
    return (c && c.checked) ? 1 : null;
  }
  if(fd.kind === 'radio'){
    var r = document.querySelector('[name=' + fd.name + ']:checked');
    return (r && r.value !== fd.def) ? r.value : null;
  }
  if(fd.kind === 'boxes'){ var b = chk(fd.f); return b.length ? b : null; }
  if(fd.kind === 'terms'){
    var t = Array.from(document.querySelectorAll('#' + fd.wrap + ' .sti'))
      .map(function(i){ return i.value.trim(); }).filter(Boolean);
    return t.length ? t : null;
  }
  return null;
}

/* A value from a link is data: escaped with CSS.escape, or plain words only where the browser has none. */
function _cssVal(v){
  v = String(v == null ? '' : v);
  if(window.CSS && typeof CSS.escape === 'function') return CSS.escape(v);
  return /^[\w -]*$/.test(v) ? v : null;
}
function _filterList(v){ return Array.isArray(v) ? v : [v]; }
function _filterWrite(fd, v){
  if(fd.kind === 'value'){ var el = document.getElementById(fd.id); if(el) el.value = String(v); return; }
  if(fd.kind === 'checked'){ var c = document.getElementById(fd.id); if(c) c.checked = !!v; return; }
  if(fd.kind === 'radio'){
    var rv = _cssVal(v); if(rv === null) return;
    var r = document.querySelector('[name="' + _cssVal(fd.name) + '"][value="' + rv + '"]'); if(r) r.checked = true; return;
  }
  if(fd.kind === 'boxes'){
    _filterList(v).forEach(function(x){
      var xv = _cssVal(x); if(xv === null) return;
      var cb = document.querySelector('[data-f="' + _cssVal(fd.f) + '"][value="' + xv + '"]'); if(cb) cb.checked = true;
    });
    return;
  }
  if(fd.kind === 'terms'){
    var wrap = document.getElementById(fd.wrap); if(!wrap) return;
    var make = fd.wrap === 'suf' ? makeSURow : makeSTRow;
    _filterList(v).forEach(function(term, i){
      if(i > 0) wrap.appendChild(make(false));
      var inp = wrap.querySelectorAll('.sti')[i];
      if(inp) inp.value = String(term == null ? '' : term);
    });
  }
}

function _hashSaveFilters(){
  try {
    var f = {};
    FILTER_FIELDS.forEach(function(fd){
      var v = _filterRead(fd);
      if(v !== null) f[fd.k] = v;
    });
    if(_sortPrimary) f.sort = _sortPrimary.key + '-' + _sortPrimary.dir;
    if(sortCols.length) f.sc = sortCols.map(function(s){ return s.key + '-' + s.dir; });
    if(Object.keys(f).length){
      f.v = 2;                          /* see _filterLegacy */
      var b64 = btoa(unescape(encodeURIComponent(JSON.stringify(f))));
      var hash = window.location.hash;
      var deckPart = '';
      var dm = hash.match(/#decks=([A-Za-z0-9+/=]+)/);
      if(dm) deckPart = 'decks=' + dm[1];
      var newHash = '#' + (deckPart ? deckPart + '&' : '') + 'filters=' + b64;
      history.replaceState(null, '', newHash);
    }
  } catch(e){}
}

function _hashLoadFilters(){
  try {
    var hash = window.location.hash;
    var m = hash.match(/filters=([A-Za-z0-9+/=]+)/);
    if(!m) return;
    var f = JSON.parse(decodeURIComponent(escape(atob(m[1]))));
    if(!f || typeof f !== 'object') return;
    f = _filterLegacy(f);
    FILTER_FIELDS.forEach(function(fd){
      if(f[fd.k] === undefined || f[fd.k] === null) return;
      /* One value that cannot be applied costs its own row, not every row after it. */
      try{ _filterWrite(fd, f[fd.k]); }
      catch(err){ console.warn('[Catalog] A filter from the link was not applied (' + fd.k + '):', err); }
    });
    if(typeof syncOpInputs === 'function') syncOpInputs();
    var parseSpec = function(s){
      var mm = String(s).match(/^(.+)-(asc|desc)$/);
      return (mm && SORT_BY_KEY[mm[1]]) ? {key:mm[1], dir:mm[2]} : null;
    };
    _sortPrimary = f.sort ? parseSpec(f.sort) : null;
    sortCols.length = 0;
    (f.sc || []).forEach(function(s){ var sp = parseSpec(s); if(sp) sortCols.push(sp); });
    syncSortUI();
    setTimeout(run, 100);
  } catch(e){ console.warn('[Catalog] Could not load filters from hash:', e); }
}
buildSortMenus();
syncSortUI();          // show the default sort instead of leaving it on "Default"
_hashLoadFilters();
renderScPage();


run();
/* Per game, so filled here: the markup's fixed options only ever named the main game's. */
_fillDeckTypes();
if(typeof tdSyncStatRow === 'function') tdSyncStatRow();
renderSavedDecks();
_updateDLCount();
if(getActiveDeck().value.trim()){
  updateDeckWarnings();
  updateStatSummary();
}

/* From the full row, fit-1 to fit-4 are added one at a time until no button is past the row's edge. */
function catFitTabs(){
  var row = document.querySelector('.tabs');
  if(!row) return 0;
  /* No transitions while it measures: a step measured as it is applied still has the last one's sizes. */
  row.classList.add('tabs-fitting');
  for(var n = 1; n <= 4; n++) row.classList.remove('fit-' + n);
  var lv = 0;
  while(lv < 4 && _tabsOver(row)){ lv++; row.classList.add('fit-' + lv); }
  void row.offsetWidth;
  row.classList.remove('tabs-fitting');
  return lv;
}
function _tabsOver(row){
  if(row.scrollWidth > row.clientWidth + 1) return true;
  var edge = row.getBoundingClientRect().right + 0.5;
  var kids = row.querySelectorAll('.tab-btn, .vb, .info-toggle-wrap, .dl-count');
  for(var i = 0; i < kids.length; i++){
    if(kids[i].getClientRects().length && kids[i].getBoundingClientRect().right > edge) return true;
  }
  return false;
}
window.catFitTabs = catFitTabs;

/* The tab row is fitted first, because its step changes its height. */
(function(){
  var header = document.querySelector('header');
  var tabs = document.querySelector('.tabs');
  function chrome(){
    if(header && tabs){
      var h = header.offsetHeight + tabs.offsetHeight;
      document.documentElement.style.setProperty('--chrome', h + 'px');
    }
  }
  function refit(){ try{ catFitTabs(); }catch(_){} chrome(); }
  refit();
  window.addEventListener('resize', refit);
  try{
    if(document.fonts){
      document.fonts.addEventListener('loadingdone', refit);
      if(document.fonts.ready) document.fonts.ready.then(refit);
    }
  }catch(_){}
  window.catRefitTabs = refit;
})();
/* ?open=rules, rbrules or online (HANDOFF §51.5): the query string, never the hash, and an unknown value does nothing.
   On a timer, since everything it touches is already in the document; the param is stripped once fired, or a reload reopens it. */
(function(){
  var m = /[?&]open=(rules|rbrules|online)(?:&|$)/i.exec(location.search || '');
  if(!m) return;
  var what = m[1].toLowerCase();
  setTimeout(function(){
    try{
      var clean = (typeof _urlWithout === 'function') ? _urlWithout(['open']) : null;
      if(clean !== null) history.replaceState(null, '', clean);
    }catch(_){}
    try{
      if(what === 'rules' || what === 'rbrules'){
        if(typeof openDoc === 'function') openDoc(what);
      }
      else if(typeof catIsPhone === 'function' && catIsPhone()){
        if(typeof window.toast === 'function') window.toast('Online play needs a larger screen.');
      }
      else if(typeof tblPlayOnline === 'function') tblPlayOnline();
    }catch(e){ console.error('open= route failed', e); }
  }, 500);
})();

/* ?card=<cid>: the cards arrive after the page, so it looks on a timer; a name waits until the cards stop changing. */
(function(){
  var m = /[?&]card=([^&#]*)/.exec(location.search || '');
  if(!m) return;
  var want = '';
  try{ want = decodeURIComponent(m[1].replace(/\+/g, ' ')).trim(); }catch(_){ want = ''; }
  function strip(){
    try{
      var clean = (typeof _urlWithout === 'function') ? _urlWithout(['card']) : null;
      if(clean !== null) history.replaceState(null, '', clean);
    }catch(_){}
  }
  if(!want){ strip(); return; }
  var lower = want.toLowerCase();
  var t0 = Date.now(), since = t0, seen = null, sig = '';
  function byCid(list){
    for(var i = 0; i < list.length; i++){
      var c = list[i];
      if(c && c.cid != null && String(c.cid) === want) return c;
    }
    return null;
  }
  function byName(list){
    var loose = null;
    for(var i = 0; i < list.length; i++){
      var c = list[i];
      if(!c || c.name == null) continue;
      var n = String(c.name);
      if(n === want) return c;
      if(!loose && n.toLowerCase() === lower) loose = c;
    }
    return loose;
  }
  (function tick(){
    var list = window.CARDS || [];
    var now = Date.now();
    var s = list.length + '|' + (window.CARD_GEN || 0);
    if(list !== seen || s !== sig){ seen = list; sig = s; since = now; }
    var settled = list.length > 0 && now - since >= 2500;
    var card = byCid(list) || (settled ? byName(list) : null);
    if(card){
      strip();
      try{ openMod(card); }catch(e){ console.error('card= route failed', e); }
      return;
    }
    if(now - t0 > 120000 || (settled && now - since > 15000)){
      strip();
      if(typeof window.toast === 'function')
        window.toast('No card in this catalogue matches the link (' + want + ').');
      return;
    }
    setTimeout(tick, 400);
  })();
})();
</script>
