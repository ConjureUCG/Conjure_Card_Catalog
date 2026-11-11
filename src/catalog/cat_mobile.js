/* Phones (HANDOFF §82). Owns no behaviour: every button calls the desktop's own function; the desktop calls in through typeof-guarded hooks.
   Loads before cat_tail.js, whose values are not set yet, so start-up waits for DOMContentLoaded (mobInit). */

/* The same line as mobile.css (899.98px): any other test here would leave windows laid out for a phone and behaving like a desktop. */
var MOB_MQ = (window.matchMedia && window.matchMedia('(max-width: 899.98px)')) || null;
function catIsPhone(){ return MOB_MQ ? MOB_MQ.matches : window.innerWidth < 900; }
window.catIsPhone = catIsPhone;

var _mobPage = 'browse';
var _mobScroll = {};
var _mobSheet = '';

function _mobEl(id){ return document.getElementById(id); }
function _mobBody(cls){ return document.body.classList.contains(cls); }

var MOB_TABS = ['filters', 'browse', 'deck', 'decklists', 'keywords', 'more'];

function mobSyncBar(){
  var lit = _mobBody('mob-more-open') || _mobPage === 'sagas' || _mobPage === 'editor' || _mobPage === 'templates' ? 'more' : _mobPage;
  MOB_TABS.forEach(function(t){
    var b = _mobEl('mobTab-' + t);
    if(!b) return;
    b.classList.toggle('on', t === lit);
    if(t === lit) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
  });
}

function mobShow(tab){
  _mobScroll[_mobPage] = window.scrollY || 0;
  showTab(tab);
  window.scrollTo(0, _mobScroll[tab] || 0);
}

function mobGo(tab){
  if(tab === 'filters'){ mobFilters(true); return; }
  if(tab === 'more'){
    if(_mobBody('mob-more-open')){ var m = _mobEl('mobMore'); if(m) m.scrollTop = 0; return; }
    mobCloseAll();
    mobMore(true);
    return;
  }
  var fromMore = _mobBody('mob-more-open');
  mobCloseAll();
  if(tab === _mobPage){
    if(!fromMore) window.scrollTo(0, 0);
    mobSyncBar();
    return;
  }
  mobShow(tab);
}
window.mobGo = mobGo;

function mobOnTab(tab){
  _mobPage = tab;
  mobCloseAll();
  mobSyncBar();
  if(tab !== 'editor') _mobPvAway(false);
  if(tab === 'deck') mobSecSync();
}

function mobCloseAll(keep){
  mobPvClose();
  if(keep !== 'more') mobMore(false);
  if(keep !== 'filters') mobFilters(false);
  if(keep !== 'dp') mobDeckList(false);
  if(keep !== 'sheet') mobSheetClose();
}

function mobMore(open){
  open = !!open;
  if(open === _mobBody('mob-more-open')) return;
  document.body.classList.toggle('mob-more-open', open);
  if(open){
    mobMoreSync();
    var m = _mobEl('mobMore'); if(m) m.scrollTop = 0;
  }
  mobSyncBar();
}

function mobMoreSync(){
  var lt = _mobEl('mobLight');
  if(lt) lt.checked = _mobBody('light');
  mobUpdSync();
}

/* A phone has no Theme menu (HANDOFF §12.1): Arcane reads as Light Mode off, and turning it on goes to Light. */
function mobLight(on){
  if(!!on !== _mobBody('light') && typeof toggleTheme === 'function') toggleTheme();
  mobMoreSync();
}

function mobHelp(){
  mobCloseAll('more');
  if(typeof openShortcutsPage === 'function') openShortcutsPage();
}

/* The game is fixed for this load (setRebirth reloads), so the labels are written once. */
function mobDoc(which){
  mobCloseAll('more');
  if(typeof openDoc === 'function') openDoc((window.REBIRTH ? 'rb' : '') + which);
}

function mobUpdSync(){
  var on = !!_mobEl('ghBadge');
  var row = _mobEl('mobUpd'), dot = _mobEl('mobMoreDot');
  if(row) row.classList.toggle('on', on);
  if(dot) dot.classList.toggle('on', on);
}
function mobUpdate(){
  mobCloseAll();
  if(typeof window.edGhUpdateNow === 'function') window.edGhUpdateNow();
}

function mobFilters(open){
  var sb = _mobEl('sbPanel');
  if(!sb) return;
  open = !!open;
  if(open === sb.classList.contains('mob-open')) return;
  if(open) mobCloseAll('filters');
  if(typeof toggleSidebar === 'function') toggleSidebar();
  if(open) sb.scrollTop = 0;
}
window.mobFilters = mobFilters;

function mobApply(){
  run();
  mobFilters(false);
  if(_mobPage !== 'browse') mobShow('browse');
  window.scrollTo(0, 0);
}

/* run() closes this page on a phone, so Reset opens it again at once, where it was scrolled: the author's rule. */
function mobReset(){
  var sb = _mobEl('sbPanel'), top = sb ? sb.scrollTop : 0;
  if(typeof reset === 'function') reset();
  if(sb && !sb.classList.contains('mob-open') && typeof toggleSidebar === 'function') toggleSidebar();
  if(sb) sb.scrollTop = top;
}

/* #cmSel stays what run(), Reset and saved links read: this only writes it. */
function mobSegSync(){
  var sel = _mobEl('cmSel');
  var v = sel ? sel.value : 'any';
  document.querySelectorAll('#mobCmSeg button[data-v]').forEach(function(b){
    b.setAttribute('aria-pressed', b.getAttribute('data-v') === v ? 'true' : 'false');
  });
}

var MOB_NUM_ROWS = [['cop', 'cval', 'CMC'], ['aop', 'aval', 'ATK'], ['hop', 'hval', 'HLTH'],
                    ['rop', 'rval', 'Rg'], ['arop', 'arval', 'ARC']];
var MOB_SIGNS = {eq: '=', lt: '<', gt: '>'};

function _mobVal(id){ var el = _mobEl(id); return el ? String(el.value || '').trim() : ''; }
function _mobOpt(id){
  var el = _mobEl(id);
  var o = el && el.selectedIndex >= 0 ? el.options[el.selectedIndex] : null;
  return o ? o.text : '';
}
function _mobTerms(wrap){
  return Array.prototype.map.call(document.querySelectorAll('#' + wrap + ' .sti'), function(i){ return i.value.trim(); })
    .filter(Boolean);
}
function _mobMode(id){ return _mobVal(id) && _mobVal(id) !== 'any' ? ' (' + _mobOpt(id) + ')' : ''; }

function mobFilterChips(){
  var out = [];
  if(_mobVal('fsaga')) out.push({k: 'saga', t: 'Saga: ' + _mobOpt('fsaga')});
  var cols = typeof chk === 'function' ? chk('color') : [];
  if(cols.length) out.push({k: 'colors', t: (_mobVal('cmSel') && _mobVal('cmSel') !== 'any' ? _mobOpt('cmSel') + ': ' : '') + cols.join(', ')});
  var su = _mobTerms('suf');
  if(su.length) out.push({k: 'su', t: 'Super-Type' + _mobMode('stmSel') + ': ' + su.join(', ')});
  var st = _mobTerms('stf');
  if(st.length) out.push({k: 'st', t: 'Sub-Type' + _mobMode('sbmSel') + ': ' + st.join(', ')});
  MOB_NUM_ROWS.forEach(function(r){
    var op = _mobVal(r[0]), v = _mobVal(r[1]);
    if(op === 'x' || op === 'star') out.push({k: r[0], t: r[2] + ' ' + _mobOpt(r[0])});
    else if(MOB_SIGNS[op] && v !== '') out.push({k: r[0], t: r[2] + ' ' + MOB_SIGNS[op] + ' ' + v});
  });
  if((_mobEl('atkarc') || {}).checked) out.push({k: 'atkarc', t: 'Attack + Arcane'});
  if((_mobEl('hparc') || {}).checked) out.push({k: 'hparc', t: 'Health + Arcane'});
  if(_mobVal('rs')) out.push({k: 'rs', t: 'Rule Text' + (_mobVal('rtMode') && _mobVal('rtMode') !== 'all' ? ' (' + _mobOpt('rtMode') + ')' : '') + ': “' + _mobVal('rs') + '”'});
  var d = _mobVal('dateFilter');
  if(d) out.push({k: 'date', t: 'Updated Since ' + d});
  return out;
}

function mobClearChip(k){
  function set(id, v){ var el = _mobEl(id); if(el) el.value = v; }
  if(k === 'saga') set('fsaga', '');
  else if(k === 'colors'){
    document.querySelectorAll('[data-f="color"]').forEach(function(c){ c.checked = false; });
    set('cmSel', 'any');
  }
  else if(k === 'su'){
    var suf = _mobEl('suf');
    if(suf && typeof makeSURow === 'function'){ suf.innerHTML = ''; suf.appendChild(makeSURow(true)); }
    set('stmSel', 'any');
  }
  else if(k === 'st'){
    var stf = _mobEl('stf');
    if(stf && typeof makeSTRow === 'function'){ stf.innerHTML = ''; stf.appendChild(makeSTRow(true)); }
    set('sbmSel', 'any');
  }
  else if(k === 'atkarc' || k === 'hparc'){ var c = _mobEl(k); if(c) c.checked = false; }
  else if(k === 'rs'){ set('rs', ''); set('rtMode', 'all'); }
  else if(k === 'date') set('dateFilter', '');
  else MOB_NUM_ROWS.forEach(function(r){ if(r[0] === k){ set(r[0], ''); set(r[1], ''); } });
  if(typeof syncOpInputs === 'function') syncOpInputs();
  run();
}

function mobChips(){
  var chips = mobFilterChips();
  var box = _mobEl('mobChips');
  if(box) box.innerHTML = chips.map(function(c){
    return '<button type="button" class="mob-chip" data-chip="' + e(c.k) + '" aria-label="' + e('Remove the filter ' + c.t) + '">'
      + '<span class="mob-cv">' + e(c.t) + '</span><span class="mob-cx" aria-hidden="true">✕</span></button>';
  }).join('');
  var n = chips.length ? String(chips.length) : '';
  ['mobFiltersN', 'mobFbtnN'].forEach(function(id){ var b = _mobEl(id); if(b) b.textContent = n; });
}

function mobOnRender(){
  var n = typeof _allFiltered !== 'undefined' && _allFiltered ? _allFiltered.length : 0;
  var c = _mobEl('mobCount');
  if(c) c.textContent = n.toLocaleString('en-US') + (n === 1 ? ' card' : ' cards');
  var ri = _mobEl('ri'), mri = _mobEl('mobRi');
  if(ri && mri) mri.innerHTML = ri.innerHTML;     // numbers only - renderPage writes it
  mobChips();
  mobSortLabels();
  mobSegSync();
  _mobMarkEmpty(_mobEl('ctb'));
}

function _mobMarkEmpty(tb){
  if(!tb) return;
  tb.querySelectorAll('tr').forEach(function(tr){
    var tds = tr.children;
    for(var i = 6; i < tds.length - 1; i++){
      var t = (tds[i].textContent || '').trim();
      tds[i].classList.toggle('mob-e', t === '' || t === '—' || t === '-');
    }
  });
}

function mobSortLabels(){
  var sp = typeof _sortPrimary !== 'undefined' ? _sortPrimary : null;
  var def = sp && typeof SORT_BY_KEY !== 'undefined' ? SORT_BY_KEY[sp.key] : null;
  var v = _mobEl('mobSortV'), d = _mobEl('mobSortD'), w = _mobEl('mobViewV');
  if(v) v.textContent = def ? def.label : 'Default';
  if(d) d.innerHTML = sp ? uiIco(sp.dir === 'desc' ? 'arrow-down' : 'arrow-up') : '';
  if(w) w.textContent = ({grid: 'Grid', details: 'Details', list: 'List'})[curView] || 'Grid';
}

function mobSheetOpen(kind){
  /* Contents keeps the More page under its document, for the document's Close to come back to. */
  mobCloseAll(kind === 'toc' ? 'more' : 'sheet');
  _mobSheet = kind;
  mobSheetDraw();
  document.body.classList.add('mob-sheet-open');
  var sh = _mobEl('mobSheet');
  if(sh) sh.scrollTop = 0;
}
window.mobSheetOpen = mobSheetOpen;

function mobSheetClose(){
  if(!_mobSheet && !_mobBody('mob-sheet-open')) return;
  _mobSheet = '';
  document.body.classList.remove('mob-sheet-open');
}

function mobSheetDraw(){
  var t = _mobEl('mobSheetTitle'), slot = _mobEl('mobSheetSlot'), body = _mobEl('mobSheetBody'), sh = _mobEl('mobSheet');
  if(!t || !slot || !body) return;
  if(_mobSheet === 'sort'){
    var sp = typeof _sortPrimary !== 'undefined' ? _sortPrimary : null;
    var opts = [{key: '', label: 'Default'}].concat(SORT_DEFS.filter(function(d){ return d.menu; }));
    t.textContent = 'Sort by';
    slot.innerHTML = '';
    body.innerHTML = opts.map(function(d){
      var on = sp ? sp.key === d.key : d.key === '';
      return '<button type="button" class="mob-opt" data-sort="' + e(d.key) + '" aria-pressed="' + on + '">' + e(d.label)
        + '<span class="mob-tick" aria-hidden="true">' + (on ? '✓' : '') + '</span></button>';
    }).join('')
      + '<div class="mob-pair" role="group" aria-label="Sort direction">'
      + ['asc', 'desc'].map(function(dir){
          return '<button type="button" data-dir="' + dir + '" aria-label="' + (dir === 'asc' ? 'Ascending' : 'Descending') + '"'
            + ' aria-pressed="' + !!(sp && sp.dir === dir) + '"' + (sp ? '' : ' disabled') + '>'
            + uiIco(dir === 'asc' ? 'arrow-up' : 'arrow-down') + '</button>';
        }).join('')
      + '</div>';
  } else if(_mobSheet === 'rules'){
    var gm = typeof GAME_MODES !== 'undefined' ? GAME_MODES[_gameMode] : null;
    var modes = gm ? [_gameMode] : (window.REBIRTH ? ['character', 'encounter', 'rewards'] : ['constructed', 'kingdoms', 'arena']);
    t.textContent = 'Deck Rules' + (gm && gm.label ? ' · ' + gm.label : '');
    slot.innerHTML = '';
    body.innerHTML = modes.map(function(m){
      var g = GAME_MODES[m];
      if(!g || !g.rules) return '';
      return (modes.length > 1 ? '<h3 class="mob-rule-mode">' + e(g.label || m) + '</h3>' : '')
        + (g.note ? '<div class="mob-rule"><div class="mob-rule-x">' + g.note + '</div></div>' : '')
        + g.rules.map(function(r){
            if(!String(r.text || '').trim()) return '';
            return '<div class="mob-rule"><div class="mob-rule-t">' + r.title + '</div><div class="mob-rule-x">' + r.text + '</div></div>';
          }).join('');
    }).join('');
  } else if(_mobSheet === 'view'){
    t.textContent = 'View';
    slot.innerHTML = '<span class="mob-swl" aria-hidden="true">Info</span>'
      + '<label class="mob-sw"><input type="checkbox" id="mobInfo" aria-label="Card info in grid view"'
      + (typeof _showCardInfo !== 'undefined' && _showCardInfo ? ' checked' : '') + '><span class="mob-sw-rail"></span></label>';
    body.innerHTML = '<div class="mob-trio" role="group" aria-label="View">'
      + [['grid', 'Grid'], ['details', 'Details'], ['list', 'List']].map(function(v){
          return '<button type="button" data-view="' + v[0] + '" aria-pressed="' + (curView === v[0]) + '">' + v[1] + '</button>';
        }).join('')
      + '</div>';
  } else if(_mobSheet === 'toc'){
    /* The links' words are docRender's, already escaped. */
    t.textContent = 'Contents';
    slot.innerHTML = '';
    body.innerHTML = _mobTocLinks().map(function(a, i){
      var lv = (/\blvl-(\d)/.exec(a.className) || [0, '1'])[1];
      return '<button type="button" class="mob-toc mob-toc-' + lv + '" data-toc="' + i + '" aria-current="'
        + a.classList.contains('active') + '">' + a.innerHTML + '</button>';
    }).join('');
  }
  if(sh) sh.setAttribute('aria-label', t.textContent);
}

function _mobSheetClick(ev){
  var b = ev.target.closest('button');
  if(!b || b.disabled) return;
  if(b.hasAttribute('data-sort')){
    mobSheetClose();
    setSortPrimary(b.getAttribute('data-sort'));
  } else if(b.hasAttribute('data-dir')){
    if(_sortPrimary && _sortPrimary.dir !== b.getAttribute('data-dir')) toggleSortDir();
    mobSheetDraw();
  } else if(b.hasAttribute('data-view')){
    mobSheetClose();
    setView(b.getAttribute('data-view'));
  } else if(b.hasAttribute('data-toc')){
    var a = _mobTocLinks()[+b.getAttribute('data-toc')];
    mobSheetClose();
    if(a) a.click();
  }
}

function mobSecKey(){
  var key = 'main';
  if(typeof DECK_IDS !== 'undefined')
    Object.keys(DECK_IDS).forEach(function(k){ if(DECK_IDS[k] === _activeDeckId) key = k; });
  return key;
}

function mobSec(k){
  if(typeof DECK_IDS === 'undefined' || !DECK_IDS[k]) return;
  setDVFilter(k);
  mobSecSync();
}

function mobSecSync(){
  var pane = _mobEl('pane-deck');
  if(!pane) return;
  var key = mobSecKey();
  pane.setAttribute('data-mob-sec', key);
  document.querySelectorAll('.mob-sec[data-sec]').forEach(function(b){
    var on = b.getAttribute('data-sec') === key;
    b.classList.toggle('on', on);
    b.setAttribute('aria-selected', on ? 'true' : 'false');
  });
  mobSecEmpty();
}

function mobSecEmpty(){
  var box = _mobEl('mobSecEmpty');
  if(!box || typeof DECK_VIEW_IDS === 'undefined') return;
  var key = mobSecKey(), stem = DECK_VIEW_IDS[key];
  var content = _mobEl('dv-content');
  var g = _mobEl(stem + '-cg'), tb = _mobEl(stem + '-ctb');
  var drawn = (g ? g.querySelectorAll('.ci').length : 0) + (tb ? tb.querySelectorAll('tr[data-cardname]').length : 0);
  var n = parseInt((_mobEl('dpCnt-' + key) || {}).textContent, 10) || 0;
  var show = !!content && content.style.display !== 'none' && !drawn;
  box.classList.toggle('on', show);
  if(show){
    var ta = _mobEl(DECK_IDS[key]);
    box.textContent = n ? 'No cards match.' : ((ta && ta.placeholder) || '');
  }
}

function mobOnCounts(total){
  if(typeof DECK_IDS === 'undefined') return;
  var sum = 0;
  Object.keys(DECK_IDS).forEach(function(k){
    var n = parseInt((_mobEl('dpCnt-' + k) || {}).textContent, 10) || 0;
    sum += n;
    var sc = document.querySelector('.mob-sec[data-sec="' + k + '"] .mob-sc');
    if(sc) sc.textContent = String(n);
  });
  if(typeof total !== 'number') total = sum;
  var b = _mobEl('mobDeckN');
  if(b) b.textContent = total > 0 ? (total > 999 ? '999+' : String(total)) : '';
  mobSecSync();
  mobCardSync();
}

function mobOnDeckRender(){
  mobSecSync();
  if(typeof DECK_VIEW_IDS === 'undefined') return;
  Object.keys(DECK_VIEW_IDS).forEach(function(k){ _mobMarkEmpty(_mobEl(DECK_VIEW_IDS[k] + '-ctb')); });
}

function mobOnLists(n){
  var b = _mobEl('mobListsN');
  if(b) b.textContent = n ? String(n) : '';
}

function mobDeckList(open){
  open = !!open;
  if(open === _mobBody('mob-dp-open')) return;
  if(open) mobCloseAll('dp');
  document.body.classList.toggle('mob-dp-open', open);
  document.body.style.overflow = open ? 'hidden' : '';
  var dp = document.querySelector('.dp');
  if(open && dp) dp.scrollTop = 0;
  if(!open && _mobPage === 'deck' && typeof refreshDeckView === 'function') refreshDeckView();
}
window.mobDeckList = mobDeckList;

var _mobCard = null;
function mobOnCard(card){
  _mobCard = card;
  var tip = _mobEl('mobKwTip');
  if(tip && tip.parentNode) tip.parentNode.removeChild(tip);
  mobCardSync();
}

function _mobCardKey(){
  var b = _mobEl('maddbtn');
  var k = b ? b.getAttribute('data-deck') : '';
  return k && typeof DECK_IDS !== 'undefined' && DECK_IDS[k] ? k : 'main';
}

function mobCardSync(){
  var row = _mobEl('mobMcnt'), t = _mobEl('mobMcntT'), rem = _mobEl('mobMrem'), mo = _mobEl('mo');
  if(!row) return;
  var card = _mobCard, key = _mobCardKey(), n = 0;
  if(card && mo && mo.classList.contains('on') && typeof parseDeckIn === 'function')
    parseDeckIn(DECK_IDS[key]).forEach(function(en){ if(en.name === card.name) n += en.count; });
  var label = (typeof DECK_LABELS !== 'undefined' && DECK_LABELS[key]) || 'Main Deck';
  row.classList.toggle('on', n > 0);
  if(t) t.textContent = n > 0 ? 'In ' + label + ': ' + n : '';
  if(rem) rem.setAttribute('aria-label', 'Remove one from the ' + label);
}

function mobCardRemove(){
  if(!_mobCard || typeof adjustDeck !== 'function') return;
  adjustDeck(_mobCard.name, -1, DECK_IDS[_mobCardKey()]);
}
window.mobCardRemove = mobCardRemove;

function _mobKwTap(ev){
  if(!catIsPhone()) return;
  var t = ev.target && ev.target.closest ? ev.target.closest('[data-kw-entry]') : null;
  if(!t) return;
  var entry = t.getAttribute('data-kw-entry');
  var k = (typeof KW_MATCHES !== 'undefined' && KW_MATCHES || []).filter(function(x){
    return x && x.match && 'kwentry-' + String(x.name == null ? x.match : x.name).replace(/\s+/g, '_') === entry;
  })[0];
  if(!k || !String(k.reminder || '').trim()) return;
  ev.preventDefault();
  ev.stopPropagation();
  var tip = _mobEl('mobKwTip');
  if(tip && tip.getAttribute('data-entry') === entry){ tip.parentNode.removeChild(tip); return; }
  var html = fmtRuleNoLinks(k.reminder);
  if(typeof window.edKwReminderSplit === 'function'){
    var s = window.edKwReminderSplit(k.name, k.reminder);
    if(s) html = '<b>' + e(k.name) + '</b>' + fmtRuleNoLinks(s.rest);
  }
  if(!tip){
    tip = document.createElement('div');
    tip.id = 'mobKwTip';
    tip.className = 'mob-kwtip';
    tip.setAttribute('role', 'note');
  }
  tip.setAttribute('data-entry', entry);
  tip.innerHTML = html;
  var at = document.querySelector('#mdb .mrl') || document.querySelector('#mdb .mty') || document.querySelector('#mdb .mnm');
  if(at) at.parentNode.insertBefore(tip, at.nextSibling);
  if(tip.scrollIntoView) tip.scrollIntoView({block: 'nearest'});
}

function _mobSwipe(mo){
  var x0 = null, y0 = 0;
  mo.addEventListener('touchstart', function(ev){
    x0 = null;
    if(!catIsPhone() || ev.touches.length !== 1) return;
    x0 = ev.touches[0].clientX;
    y0 = ev.touches[0].clientY;
  }, {passive: true});
  mo.addEventListener('touchend', function(ev){
    if(x0 === null || !ev.changedTouches.length) return;
    var p = ev.changedTouches[0], dx = p.clientX - x0, dy = p.clientY - y0;
    x0 = null;
    if(Math.abs(dx) > 60 && Math.abs(dx) > 2 * Math.abs(dy) && typeof navigateMod === 'function') navigateMod(dx < 0 ? 1 : -1);
  }, {passive: true});
}

var _mobTocDoc = '';
function _mobTocLinks(){
  return Array.prototype.slice.call(document.querySelectorAll('#docTocList_' + _mobTocDoc + ' a'));
}
function mobDocToc(id){
  _mobTocDoc = id;
  mobSheetOpen('toc');
  var sh = _mobEl('mobSheet'), on = sh && sh.querySelector('.mob-toc[aria-current="true"]');
  if(on) sh.scrollTop = Math.max(0, on.offsetTop - sh.clientHeight / 2);
}
function _mobDocNav(ov){
  var id = ov.id.replace(/^docOv_/, ''), t = ov.querySelector('.doc-hdr .doc-title-bar');
  if(!t || ov.querySelector('.mob-doc-toc')) return;
  var b = document.createElement('button');
  b.type = 'button';
  b.className = 'mob-doc-toc mob-only';
  b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"'
    + ' stroke-linecap="round" aria-hidden="true"><path d="M8 6h13M8 12h13M8 18h13M3.5 6h.01M3.5 12h.01M3.5 18h.01"/></svg>Contents';
  b.addEventListener('click', function(){ mobDocToc(id); });
  t.parentNode.insertBefore(b, t.nextSibling);
  if(window.MutationObserver) new MutationObserver(function(){
    if(_mobSheet === 'toc' && _mobTocDoc === id && !ov.classList.contains('on')) mobSheetClose();
  }).observe(ov, {attributes: true, attributeFilter: ['class']});
}

/* The editor's own #edPvHost, lifted and scaled: renderPreview keeps painting it, so nothing is copied. */
var _mobPvIO = null;
function _mobPvAway(on){ document.body.classList.toggle('mob-pv-away', !!on); }
function mobPvWatch(){
  var host = _mobEl('edPvHost');
  if(!host || _mobPvIO || typeof IntersectionObserver !== 'function') return;
  _mobPvIO = new IntersectionObserver(function(es){
    var e = es[es.length - 1];
    _mobPvAway(_mobPage === 'editor' && !!host.firstChild && e.intersectionRatio < .25);
  }, {threshold: [0, .25, .5, 1]});
  _mobPvIO.observe(host);
}
function mobPvOpen(){
  var host = _mobEl('edPvHost'), ov = _mobEl('mobPv'), col = host && host.parentNode;
  if(!host || !host.firstChild || !ov || _mobBody('mob-pv-open')) return;
  /* Keep the card's room, so the page under the dim does not move. */
  col.style.minHeight = col.offsetHeight + 'px';
  document.body.classList.add('mob-pv-open');
  var top = parseFloat(getComputedStyle(host).top) || 72;
  var k = Math.min((window.innerWidth - 32) / 340, (window.innerHeight - top - 16) / 476);
  host.style.setProperty('--mob-pv-kf', Math.max(.3, k).toFixed(3));
  if(typeof modalOpen === 'function')
    modalOpen(ov, {label: 'Preview', onClose: mobPvClose, focus: ov.querySelector('.mob-close')});
}
function mobPvClose(){
  if(!_mobBody('mob-pv-open')) return;
  document.body.classList.remove('mob-pv-open');
  var host = _mobEl('edPvHost'), ov = _mobEl('mobPv');
  [host, host && host.parentNode].forEach(function(el, i){
    if(!el) return;
    if(i) el.style.minHeight = ''; else el.style.removeProperty('--mob-pv-kf');
    if(!el.getAttribute('style')) el.removeAttribute('style');
  });
  if(ov && typeof modalClose === 'function') modalClose(ov);
}
window.mobPvOpen = mobPvOpen;
window.mobPvClose = mobPvClose;

var _mobFixTop = 0;
function _mobFixPrep(ov){
  var main = _mobEl('edFixMain'), nav = ov.querySelector('.fx-nav');
  if(!main || !nav || main.querySelector('.mob-fx-back')) return;
  var b = document.createElement('button');
  b.type = 'button';
  b.className = 'mob-fx-back mob-only';
  b.innerHTML = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"'
    + ' stroke-linejoin="round" aria-hidden="true"><path d="M15 18l-6-6 6-6"/></svg>All tools';
  main.insertBefore(b, main.firstChild);
  var dock = document.createElement('div');
  dock.className = 'mob-fx-sum mob-only';
  dock.id = 'mobFixSumDock';
  nav.insertBefore(dock, nav.firstChild);
  _mobDockAdd(_mobEl('edFixSum'), 'mobFixSumDock');
  mobPlaceDocks();
  /* Capture, ahead of the tools' own handlers (edFixShow), which still run. */
  ov.addEventListener('click', _mobFixTap, true);
}
function mobOnFix(){
  var ov = _mobEl('edFixOverlay');
  if(!ov) return;
  _mobFixPrep(ov);
  ov.classList.remove('mob-fx-tool');
  var bd = ov.querySelector('.fx-body');
  if(bd) bd.scrollTop = 0;
}
window.mobOnFix = mobOnFix;
function _mobFixTap(ev){
  var t = ev.target, ov = ev.currentTarget;
  if(!t || !t.closest || !catIsPhone()) return;
  var body = ov.querySelector('.fx-body');
  if(t.closest('.fx-nav-item')){
    _mobFixTop = body ? body.scrollTop : 0;
    ov.classList.add('mob-fx-tool');
    setTimeout(function(){
      if(body) body.scrollTop = 0;
      var bk = ov.querySelector('.mob-fx-back');
      if(bk) bk.focus({preventScroll: true});
    }, 0);
  } else if(t.closest('.mob-fx-back')){
    ov.classList.remove('mob-fx-tool');
    if(body) body.scrollTop = _mobFixTop;
    var on = ov.querySelector('.fx-nav-item.on');
    if(on) on.focus({preventScroll: true});
  } else if(t.closest('.fx-pager .ed2-btn')){
    setTimeout(function(){ if(body) body.scrollTop = 0; }, 0);
  }
}

/* The rows' - and + are the draft's own buttons (data-dr, read by drBind): the deck and its limits stay cat_draftui.js's. */
var MOB_DR_GLASS = '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"'
  + ' aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="M15.5 15.5L21 21"/></svg>';
function mobOnDraft(){
  var ov = _mobEl('drOv'), main = _mobEl('drMain');
  if(!ov || !main || typeof DR === 'undefined') return;
  if(!ov._mobDraft){
    ov._mobDraft = true;
    /* Capture, ahead of the draft's own listeners, which a glass or a name leaves alone. */
    ov.addEventListener('click', _mobDraftTap, true);
  }
  var build = DR.phase === 'build' || DR.phase === 'saved';
  ov.classList.toggle('mob-dr-build', build);
  ov.classList.toggle('mob-dr-saved', DR.phase === 'saved');
  if(build){ _mobDraftRows(main); return; }
  [].forEach.call(main.querySelectorAll('.dr-card, .dr-pile[data-name] .dr-top, .dr-wcard'), function(t){
    if(t.querySelector('.mob-dr-read')) return;
    var b = document.createElement('button');
    b.type = 'button';
    b.className = 'mob-dr-read mob-only';
    b.setAttribute('aria-label', 'Read ' + t.closest('[data-name]').getAttribute('data-name'));
    b.innerHTML = MOB_DR_GLASS;
    t.appendChild(b);
  });
}
window.mobOnDraft = mobOnDraft;
function _mobDraftTap(ev){
  var t = ev.target;
  if(!t || !t.closest || !catIsPhone() || t.closest('[data-dr="add"], [data-dr="rem"]')) return;
  var hit = t.closest('.mob-dr-read, .mob-dr-name, #drSide .dr-prow, #drSide .dr-last b');
  var at = hit && hit.closest('[data-name]');
  var c = at && typeof drCard === 'function' ? drCard(at.getAttribute('data-name')) : null;
  if(!c || typeof openMod !== 'function') return;
  ev.preventDefault();
  ev.stopPropagation();
  openMod(c);
}
/* Redrawn only when the pool changes; a tap on - or + only sets the counts, so the button keeps the focus. */
function _mobDraftRows(main){
  var box = main.querySelector('.mob-dr-rows');
  if(!box){
    box = document.createElement('div');
    box.className = 'mob-dr-rows mob-only';
    main.appendChild(box);
  }
  var t = draftTally(DR.pool).sort(function(a, b){
    return drCost(a.name) - drCost(b.name) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  });
  var key = JSON.stringify(t.map(function(x){ return x.name; }));
  if(box._mobKey !== key){
    box._mobKey = key;
    box.innerHTML = t.map(function(x){ return _mobDraftRowHTML(x.name); }).join('');
  }
  var live = DR.phase === 'build', full = drDeckSize() >= drDeckGoal();
  t.forEach(function(x, i){
    var row = box.children[i], n = DR.deck[x.name] || 0;
    if(!row) return;
    row.classList.toggle('in', n > 0);
    row.querySelector('.mob-dr-n').innerHTML = '<b>' + n + '</b>/' + x.count;
    row.querySelector('.mob-dr-minus').disabled = !live || n <= 0;
    row.querySelector('.mob-dr-plus').disabled = !live || full || drPoolLeft(x.name) <= 0;
  });
}
function _mobDraftRowHTML(name){
  var c = drCard(name) || {}, n = e(name);
  var sup = e(_catArr(c.superTypes).join(' ')), sub = e(_catArr(c.subTypes).join(' '));
  return '<div class="mob-dr-row" data-name="' + n + '">'
    + '<button type="button" class="mob-dr-name"><b>' + n + '</b><small>'
    + (typeof renderManaCost === 'function' ? renderManaCost(c.manaCost || '', 14) : '')
    + '<span>' + (sup && sub ? sup + ' &mdash; ' + sub : sup || sub) + '</span></small></button>'
    + '<button type="button" class="mob-dr-minus" data-dr="rem" data-v="' + n + '" aria-label="One fewer ' + n + '">&minus;</button>'
    + '<span class="mob-dr-n"></span>'
    + '<button type="button" class="mob-dr-plus" data-dr="add" data-v="' + n + '" aria-label="One more ' + n + '">+</button>'
    + '</div>';
}

/* Each moved element goes back after the comment node left where it lived. */
var _mobDocks = [];
function _mobDockAdd(el, dockId){
  if(!el || !el.parentNode || !_mobEl(dockId)) return;
  var mark = document.createComment(' ' + dockId + ' ');
  el.parentNode.insertBefore(mark, el);
  _mobDocks.push({el: el, mark: mark, dock: dockId});
}
function mobPlaceDocks(){
  var phone = catIsPhone();
  _mobDocks.forEach(function(d){
    if(phone){
      var dock = _mobEl(d.dock);
      if(dock && d.el.parentNode !== dock) dock.appendChild(d.el);
    } else if(d.mark.parentNode && d.mark.nextSibling !== d.el){
      d.mark.parentNode.insertBefore(d.el, d.mark.nextSibling);
    }
  });
}

function _mobWidthChanged(){
  mobCloseAll();
  mobPlaceDocks();
  mobSyncBar();
  var mo = _mobEl('mo');
  if(mo && mo.classList.contains('on') && typeof cur !== 'undefined' && cur && typeof openMod === 'function') openMod(cur);
}

function mobInit(){
  var ns = _mobEl('ns');
  _mobDockAdd(ns && ns.closest('.fs'), 'mobSearchDock');
  _mobDockAdd(document.querySelector('.saved-save-row'), 'mobSaveDock');
  _mobDockAdd(_mobEl('gmSelect'), 'mobDockGm');
  _mobDockAdd(_mobEl('dvGroupSel'), 'mobDockGroup');
  _mobDockAdd(_mobEl('dvSortSel'), 'mobDockSort');
  _mobDockAdd(_mobEl('deckWarnBox'), 'mobWarnDock');
  mobPlaceDocks();
  if(MOB_MQ){
    if(MOB_MQ.addEventListener) MOB_MQ.addEventListener('change', _mobWidthChanged);
    else if(MOB_MQ.addListener) MOB_MQ.addListener(_mobWidthChanged);
  }

  var chips = _mobEl('mobChips');
  if(chips) chips.addEventListener('click', function(ev){
    var b = ev.target.closest('.mob-chip');
    if(b) mobClearChip(b.getAttribute('data-chip'));
  });
  var seg = _mobEl('mobCmSeg');
  if(seg) seg.addEventListener('click', function(ev){
    var b = ev.target.closest('button[data-v]'), sel = _mobEl('cmSel');
    if(!b || !sel) return;
    sel.value = b.getAttribute('data-v');
    mobSegSync();
  });
  var sb = _mobEl('mobSheetBody');
  if(sb) sb.addEventListener('click', _mobSheetClick);
  var slot = _mobEl('mobSheetSlot');
  if(slot) slot.addEventListener('change', function(ev){
    if(ev.target && ev.target.id === 'mobInfo' && typeof toggleCardInfo === 'function') toggleCardInfo(ev.target.checked);
  });
  document.querySelectorAll('.mob-sec[data-sec]').forEach(function(b){
    b.addEventListener('click', function(){ mobSec(b.getAttribute('data-sec')); });
  });
  /* Capture: a keyword's tap is caught before the desktop's own listeners see it. */
  var mo = _mobEl('mo');
  if(mo){
    mo.addEventListener('click', _mobKwTap, true);
    _mobSwipe(mo);
  }
  document.querySelectorAll('.doc-overlay[id^="docOv_"]').forEach(_mobDocNav);
  mobPvWatch();

  var hdr = document.querySelector('header');
  if(hdr && window.MutationObserver) new MutationObserver(mobUpdSync).observe(hdr, {childList: true});
  if(window.REBIRTH){
    var rt = _mobEl('mobRulesT'), dt = _mobEl('mobDesignT');
    if(rt) rt.textContent = 'Rebirth Rules';
    if(dt) dt.textContent = 'Rebirth Design';
  }

  ['browse', 'deck', 'decklists', 'keywords', 'sagas', 'editor', 'testdeck', 'templates'].forEach(function(t){
    var p = _mobEl('pane-' + t);
    if(p && p.style.display !== 'none' && getComputedStyle(p).display !== 'none') _mobPage = t;
  });
  mobSyncBar();
  mobMoreSync();
  mobOnRender();
  mobOnCounts();
  var dl = _mobEl('dlCount');
  mobOnLists(dl ? parseInt(dl.textContent, 10) || 0 : 0);
}
if(document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mobInit);
else mobInit();
