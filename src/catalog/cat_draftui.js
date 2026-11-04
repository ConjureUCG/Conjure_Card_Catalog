/* Online the host deals: each seat is sent only its own view, addressed to it (HANDOFF §10).
   A draft runs in the waiting room: the relay's table stays 'waiting', so starting the game is unchanged. */

var DR = {
  open:false,
  mode:'',             /* '' | solo | host | guest */
  type:'standard',
  from:'',
  seats:[],
  me:0,
  st:null,             /* the draft itself - solo and host only */
  view:null,
  timer:0,
  due:[], dueKey:[],
  dueMine:0,
  hostId:'',
  sel:null,
  phase:'',            /* pick | build | saved */
  pool:[],
  deck:{},
  savedAs:'',
  rendered:'',
  botTimer:null,
  tick:null,
  botDelay:{standard:380, hex:900, winchester:900}
};
var DR_OPTS_KEY = 'conjure_draft_opts';
var DRS = {deck:'', type:'standard', seats:4, timer:0};
var DR_TIMERS = [[0, 'Off'], [30, '30s'], [45, '45s'], [60, '60s'], [90, '90s']];

(function(){
  try{
    var o = JSON.parse(localStorage.getItem(DR_OPTS_KEY) || '{}') || {};
    ['deck', 'type', 'seats', 'timer'].forEach(function(k){ if(o[k] !== undefined) DRS[k] = o[k]; });
  }catch(_){}
  if(!drTypeOk(DRS.type)) DRS.type = 'standard';
  DRS.seats = Math.max(2, Math.min(4, +DRS.seats || 4));
  DRS.timer = +DRS.timer || 0;
})();
function drSaveOpts(){
  try{ localStorage.setItem(DR_OPTS_KEY, JSON.stringify(DRS)); }catch(_){}
}

/* Own keys only: 'constructor' and the like are not drafts. */
function drTypeOk(t){ return typeof t === 'string' && Object.prototype.hasOwnProperty.call(DRAFT_TYPES, t); }
function drTypeLabel(t){ return drTypeOk(t) ? DRAFT_TYPES[t].label : String(t || ''); }
function drShort(t){ return drTypeOk(t) ? DRAFT_TYPES[t].short : String(t || ''); }
function drInt(v){ v = +v; return isFinite(v) ? Math.round(v) : 0; }

function drIsDraftDeck(en){ return !!en && typeof en === 'object' && en.mode === 'draft'; }
function drDraftDecks(){
  var s = _savedLoad();
  return Object.keys(s).filter(function(n){ return drIsDraftDeck(s[n]); }).sort();
}
function drDeckEntry(name){
  if(!name){
    var cur = {mode:_gameMode};
    Object.keys(DECK_IDS).forEach(function(k){
      var el = document.getElementById(DECK_IDS[k]);
      cur[k] = el ? el.value : '';
    });
    return cur;
  }
  var en = _savedLoad()[name];
  if(typeof en === 'string') en = {main:en};
  return en || null;
}
/* Keyed on CARD_GEN too, so a rename that keeps the count still makes a new map. */
var _drMap = {n:-1, gen:-1, map:null};
function drCardMap(){
  var cs = window.CARDS || [], gen = window.CARD_GEN || 0;
  if(_drMap.n !== cs.length || _drMap.gen !== gen){
    var m = {};
    cs.forEach(function(c){ m[c.name] = c; });
    _drMap = {n:cs.length, gen:gen, map:m};
  }
  return _drMap.map;
}
function drCard(name){ return drCardMap()[name] || null; }
function drPoolOf(entry){
  var map = drCardMap(), en = [], missing = 0;
  ['main', 'essence', 'wish', 'armament'].forEach(function(k){
    parseDeckLines((entry && entry[k]) || '').forEach(function(x){
      if(!map[x.name]){ missing += x.count; return; }
      en.push(x);
    });
  });
  var p = draftPoolList(en, function(n){ return _isEssenceCard(map[n]); });
  p.missing = missing;
  return p;
}
function drPoolLineHTML(p){
  var h = 'Draft pool &middot; <b>' + p.names.length + '</b> card' + (p.names.length === 1 ? '' : 's');
  if(p.skipped) h += ' &middot; ' + p.skipped + ' Essence left out';
  if(p.missing) h += ' &middot; ' + p.missing + ' not in catalog';
  return h;
}

function drSegHTML(key, opts, cur){
  return "<div class='tbl-seg' data-k='dr-" + key + "'>"
    + opts.map(function(o){
        var off = o[2] ? ' disabled' : '';
        return "<button type='button' class='" + (String(o[0]) === String(cur) ? 'on' : '') + "'"
          + " data-v='" + e(o[0]) + "'" + off + " onclick=\"drSetSeg('" + key + "','" + e(o[0]) + "')\">"
          + e(o[1]) + "</button>";
      }).join('')
    + "</div>";
}
function drSetupOpen(name){
  if(REBIRTH) return false;
  drSetupClose();
  var decks = drDraftDecks();
  var curIsPool = _gameMode === 'draft';
  if(name != null) DRS.deck = name;
  if(DRS.deck && decks.indexOf(DRS.deck) < 0) DRS.deck = '';
  if(!DRS.deck && !curIsPool && decks.length) DRS.deck = decks[0];
  var ov = document.createElement('div');
  ov.className = 'td-ov tbl-ov2 dr-setov';
  ov.id = 'drSetOv';
  ov.innerHTML = "<div class='ed2-modal tbl-dlg dr-setdlg' role='dialog' aria-modal='true' aria-label='Draft'>"
    + "<div class='ed2-modal-head tbl-head'><b>Draft</b>" + tboGamePill('Arena')
    + "<span class='sg-head-gap'></span>"
    + "<button class='ed2-btn close-x nb nb-red nb-m wh-x' onclick='drSetupClose()'>Close &#10005;</button></div>"
    + "<div class='ed2-modal-body dr-setbody' id='drSetBody'></div>"
    + "<div class='dr-setfoot'><span class='dr-poolline' id='drPoolLine'></span><span class='tbl-gap'></span>"
    + "<button class='ed2-btn tbl-green tbl-big' id='drStartBtn' onclick='drStartSolo()'>Start Draft</button></div>"
    + "</div>";
  document.body.appendChild(ov);
  if(typeof tboHoldKeys === 'function') tboHoldKeys(ov, drSetupClose);
  drSetupRender();
  return true;
}
function drSetupClose(){
  var o = document.getElementById('drSetOv');
  if(!o) return;
  if(typeof tboLetKeys === 'function') tboLetKeys(o);
  o.remove();
}
function drSetupRender(){
  var b = document.getElementById('drSetBody');
  if(!b) return;
  var decks = drDraftDecks();
  var curIsPool = _gameMode === 'draft';
  var T = DRAFT_TYPES[DRS.type];
  var seats = drSetupSeats();
  b.innerHTML = "<div class='tbl-hrow'><div class='tbl-il tbl-grow'><span class='tbl-lbl dr-lw'>Draft Deck</span>"
      + "<select id='drDeckSel' class='tbl-select' onchange='drSetDeck(this.value)'>"
      + (curIsPool ? "<option value=''" + (DRS.deck ? '' : ' selected') + ">Current deck</option>" : '')
      + decks.map(function(n){
          return "<option value='" + e(n) + "'" + (n === DRS.deck ? ' selected' : '') + ">" + e(n) + "</option>";
        }).join('')
      + "</select></div></div>"
    + "<div class='tbl-hrow'><span class='tbl-lbl dr-lw'>Draft</span>"
      + drSegHTML('type', DRAFT_ORDER.map(function(k){ return [k, drTypeLabel(k)]; }), DRS.type) + "</div>"
    + (DRS.type === 'vault' ? '' :
        "<div class='tbl-hrow'><span class='tbl-lbl dr-lw'>Players</span>"
        + drSegHTML('seats', [2, 3, 4].map(function(n){
            return [n, String(n), n < T.min || n > T.max];
          }), seats)
        + "<span class='tbl-lbl dr-lw dr-lw2'>Pick Timer</span>"
        + drSegHTML('timer', DR_TIMERS, DRS.timer) + "</div>");
  var p = drPoolOf(drDeckEntry(DRS.deck));
  var line = document.getElementById('drPoolLine');
  if(line) line.innerHTML = (decks.length || curIsPool) ? drPoolLineHTML(p) : 'No Draft Decks saved';
  var go = document.getElementById('drStartBtn');
  if(go) go.disabled = !p.names.length;
}
function drSetupSeats(){
  var T = DRAFT_TYPES[DRS.type];
  if(DRS.type === 'vault') return 1;
  return Math.max(T.min, Math.min(T.max, DRS.seats));
}
function drSetDeck(v){ DRS.deck = v || ''; drSaveOpts(); drSetupRender(); }
function drSetSeg(key, v){
  if(key === 'type' && drTypeOk(v)) DRS.type = v;
  else if(key === 'seats') DRS.seats = Math.max(2, Math.min(4, +v || 2));
  else if(key === 'timer') DRS.timer = +v || 0;
  drSaveOpts();
  drSetupRender();
}
function drStartSolo(){
  var entry = drDeckEntry(DRS.deck);
  var p = drPoolOf(entry);
  if(!p.names.length) return false;
  var n = drSetupSeats();
  var seats = [{name:(TBL && TBL.name) || 'You', side:'a'}];
  for(var i = 1; i < n; i++) seats.push({name:'Bot ' + i, side:TD_SEATS[i] || '', bot:true});
  var st = draftNew(DRS.type, p.names, n, (Math.random() * 4294967296) >>> 0);
  if(!st) return false;
  drSetupClose();
  drBegin('solo', DRS.type, DRS.deck || 'Current deck', seats, 0, st, DRS.type === 'vault' ? 0 : DRS.timer);
  return true;
}

function drBegin(mode, type, from, seats, me, st, timer){
  drStopTimers();
  DR.mode = mode; DR.type = type; DR.from = from; DR.seats = seats; DR.me = me;
  DR.st = st; DR.view = null; DR.timer = timer || 0; DR.due = []; DR.dueKey = [];
  DR.dueMine = 0; DR.sel = null; DR.phase = 'pick'; DR.pool = []; DR.deck = {};
  DR.savedAs = ''; DR.rendered = '';
  drShow();
  if(st) drAfterChange();
  else drRender();
  DR.tick = setInterval(drTick, 250);
  drRoomRefresh();
}
function drRoomRefresh(){
  try{ if(typeof tboRoomRender === 'function' && tboDialogOpen() && TBO.view === 'room') tboRoomRender(); }catch(_){}
}
function drLocal(){ return DR.mode === 'solo' || DR.mode === 'host'; }
function drIsBot(i){ var s = DR.seats[i]; return !!(s && (s.bot || s.away)); }
function drRunning(){ return !!DR.mode && DR.phase === 'pick'; }

function drAfterChange(){
  if(!DR.st) return;
  drArmTimers();
  if(DR.mode === 'host') drBroadcast();
  DR.view = draftView(DR.st, DR.me);
  if(DR.st.done){ drFinish(); return; }
  drKeepSel();
  drRender();
  drBots();
}
function drBots(){
  clearTimeout(DR.botTimer);
  if(!DR.st || DR.st.done || !drLocal()) return;
  var who = draftWaitingOn(DR.st).filter(drIsBot);
  if(!who.length) return;
  DR.botTimer = setTimeout(function(){
    if(!DR.st || DR.st.done) return;
    var moved = false;
    draftWaitingOn(DR.st).filter(drIsBot).forEach(function(s){
      if(!draftCanMove(DR.st, s)) return;
      var m = draftRandomMove(DR.st, s);
      if(m && draftApply(DR.st, s, m)) moved = true;
    });
    if(moved) drAfterChange();
  }, DR.botDelay[DR.type] || 500);
}
function drDecisionKey(i){
  var st = DR.st;
  if(st.type === 'standard'){
    var h = st.queue[i][0];
    return h ? h.id + ':' + h.cards.length : '';
  }
  return st.seq + ':' + st.turn;
}
function drArmTimers(){
  if(!DR.timer || !DR.st) return;
  var now = Date.now();
  for(var i = 0; i < DR.st.seats; i++){
    if(!draftCanMove(DR.st, i)){ DR.due[i] = 0; DR.dueKey[i] = ''; continue; }
    var k = drDecisionKey(i);
    if(DR.dueKey[i] !== k){ DR.dueKey[i] = k; DR.due[i] = now + DR.timer * 1000; }
  }
}
function drMsLeft(){
  if(!DR.timer || DR.phase !== 'pick') return 0;
  if(drLocal()) return DR.due[DR.me] ? Math.max(0, DR.due[DR.me] - Date.now()) : 0;
  return DR.dueMine ? Math.max(0, DR.dueMine - Date.now()) : 0;
}
function drTick(){
  if(!DR.mode){ drStopTimers(); return; }
  if(drLocal() && DR.timer && DR.st && !DR.st.done && DR.phase === 'pick'){
    var now = Date.now(), moved = false;
    for(var i = 0; i < DR.st.seats; i++){
      if(drIsBot(i) || !DR.due[i] || now < DR.due[i] || !draftCanMove(DR.st, i)) continue;
      var m = draftRandomMove(DR.st, i);
      if(m && draftApply(DR.st, i, m)) moved = true;
    }
    if(moved){ DR.sel = null; drAfterChange(); }
  }
  drClock();
}
function drClock(){
  var c = document.getElementById('drClock');
  if(!c) return;
  var ms = drMsLeft();
  var mine = DR.view && DR.view.legal && DR.view.legal.length;
  if(!DR.timer || DR.phase !== 'pick' || !mine){ c.textContent = ''; c.className = 'dr-clock'; return; }
  var s = Math.ceil(ms / 1000);
  c.textContent = Math.floor(s / 60) + ':' + ('0' + (s % 60)).slice(-2);
  c.className = 'dr-clock' + (s <= 10 ? ' low' : '');
}
function drStopTimers(){
  clearTimeout(DR.botTimer); DR.botTimer = null;
  if(DR.tick){ clearInterval(DR.tick); DR.tick = null; }
}

function drGo(){
  var m = drSelMove();
  if(!m) return false;
  return drPick(m);
}
function drPick(m){
  if(DR.phase !== 'pick' || !DR.view) return false;
  if(drLocal()){
    if(!draftApply(DR.st, DR.me, m)) return false;
    DR.sel = null;
    drAfterChange();
    return true;
  }
  /* A pick goes only to the host, the one machine views are taken from (drOnMsg). */
  if(!DR.hostId || DR.hostId !== TBL.hostId) return false;
  if(!tblSend({t:'dpick', to:DR.hostId, seq:DR.view.seq, m:m})) return false;
  DR.sel = null;
  DR.view.legal = [];
  drRender();
  return true;
}

function drFinish(){
  clearTimeout(DR.botTimer);
  DR.phase = 'build';
  DR.pool = ((DR.view && DR.view.picks) || []).slice();
  DR.deck = {};
  DR.sel = null;
  DR.rendered = '';
  if(DR.mode === 'guest' || DR.mode === 'host')
    try{ tboChatSys('The draft is over'); }catch(_){}
  if(!DR.open) drShow();
  drRender();
  drRoomRefresh();
}
function drPoolLeft(name){
  var n = 0;
  DR.pool.forEach(function(x){ if(x === name) n++; });
  return n - (DR.deck[name] || 0);
}
function drDeckSize(){
  return Object.keys(DR.deck).reduce(function(a, k){ return a + DR.deck[k]; }, 0);
}
function drDeckGoal(){ return Math.min(DRAFT_DECK_SIZE, DR.pool.length); }
function drAdd(name){
  if(DR.phase !== 'build' || drPoolLeft(name) <= 0 || drDeckSize() >= drDeckGoal()) return false;
  DR.deck[name] = (DR.deck[name] || 0) + 1;
  drRender();
  return true;
}
function drRemove(name){
  if(DR.phase !== 'build' || !DR.deck[name]) return false;
  if(!--DR.deck[name]) delete DR.deck[name];
  drRender();
  return true;
}
function drDefaultName(){
  var d = new Date();
  var mon = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][d.getMonth()];
  var base = drShort(DR.type) + ' Draft · ' + mon + ' ' + d.getDate();
  if(DR.type === 'standard') base = 'Draft · ' + mon + ' ' + d.getDate();
  var s = _savedLoad(), name = base, n = 2;
  while(s[name]) name = base + ' (' + (n++) + ')';
  return name;
}
function drSave(){
  if(DR.phase !== 'build' || drDeckSize() !== drDeckGoal() || !drDeckGoal()) return false;
  var inp = document.getElementById('drName');
  var name = ((inp && inp.value) || '').trim().slice(0, 60) || drDefaultName();
  var d = _savedLoad();
  if(d[name] && !confirm('"' + name + '" already exists. Overwrite?')) return false;
  var main = Object.keys(DR.deck).sort().map(function(k){ return DR.deck[k] + 'x ' + k; }).join('\n');
  d[name] = {main:main, essence:'', wish:'', mode:'arena',
             draft:{type:DR.type, from:DR.from, at:Date.now(), pool:draftLines(DR.pool)}};
  if(!_savedWrite(d)) return false;
  DR.savedAs = name;
  DR.phase = 'saved';
  try{ renderSavedDecks(); }catch(_){}
  try{ _dlDirty = true; _updateDLCount(); }catch(_){}
  try{
    var dlPane = document.getElementById('pane-decklists');
    if(dlPane && dlPane.style.display !== 'none'){ _dlDirty = false; renderDeckLists(); }
  }catch(_){}
  if(typeof toast === 'function') toast('Saved “' + name + '”');
  if(DR.mode === 'guest' || DR.mode === 'host'){
    try{ tboPickDeck(name); }catch(_){}
    drClose(true);
    try{ tblOpenSetup('room'); }catch(_){}
    return true;
  }
  drRender();
  return true;
}
function drOpenSaved(){
  var name = DR.savedAs, en = name && _savedLoad()[name];
  if(!en) return false;
  Object.keys(DECK_IDS).forEach(function(k){
    var el = document.getElementById(DECK_IDS[k]);
    if(el) el.value = en[k] || '';
  });
  try{ setGameMode('arena'); }catch(_){}
  try{ updCnt(); _hashSaveDeck(); }catch(_){}
  drClose(true);
  try{ showTab('deck'); }catch(_){}
  return true;
}

function drShow(){
  var ov = document.getElementById('drOv');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'drOv';
    ov.className = 'td-ov dr-ov';
    ov.innerHTML = "<div class='ed2-modal tbl-dlg dr-dlg' role='dialog' aria-modal='true' aria-label='Draft'>"
      + "<div class='ed2-modal-head tbl-head dr-head'><b>Draft</b><span id='drPill'></span>"
      + "<span class='dr-status' id='drStatus'></span><span class='sg-head-gap'></span>"
      + "<span class='dr-clock' id='drClock'></span>"
      + "<span id='drActs'></span>"
      + "<button class='ed2-btn close-x nb nb-red nb-m wh-x' id='drCloseBtn' onclick='drClose()'>Close &#10005;</button></div>"
      + "<div class='dr-body'><div class='dr-main' id='drMain'></div><div class='dr-side' id='drSide'></div></div>"
      + "</div>";
    document.body.appendChild(ov);
    drBind(ov);
    if(typeof tboHoldKeys === 'function') tboHoldKeys(ov, function(){ drClose(); });
  }
  DR.open = true;
  DR.rendered = '';
  window.addEventListener('resize', drRefit);
}
function drRefit(){
  var ov = document.getElementById('drOv');
  if(ov && typeof tdFitFace === 'function') [].forEach.call(ov.querySelectorAll('.td-face'), tdFitFace);
}
function drClose(quiet){
  if(!quiet && DR.mode){
    if(DR.phase === 'pick' && DR.mode === 'solo' && !confirm('Leave the draft?')) return false;
    if(DR.phase === 'pick' && DR.mode === 'host' && !confirm('End the draft for everyone?')) return false;
    if(DR.phase === 'build' && DR.mode === 'solo' && DR.pool.length
       && !confirm('Leave without saving a deck?')) return false;
  }
  var keep = !quiet && (DR.mode === 'guest' || (DR.mode === 'host' && DR.phase === 'build'));
  if(!quiet && DR.mode === 'host' && DR.phase === 'pick'){
    try{ tblSend({t:'dstop'}); }catch(_){}
    try{ tboChatSys('The draft was ended'); }catch(_){}
  }
  var ov = document.getElementById('drOv');
  if(ov){
    if(typeof tboLetKeys === 'function') tboLetKeys(ov);
    ov.remove();
  }
  DR.open = false;
  window.removeEventListener('resize', drRefit);
  if(!keep) drReset();
  drRoomRefresh();
  return true;
}
function drReset(){
  drStopTimers();
  DR.mode = ''; DR.st = null; DR.view = null; DR.phase = ''; DR.seats = [];
  DR.pool = []; DR.deck = {}; DR.sel = null; DR.hostId = ''; DR.savedAs = '';
}

/* One delegated listener per kind for the whole window, so the tiles can be redrawn freely. */
function drBind(ov){
  var main = ov.querySelector('#drMain'), side = ov.querySelector('#drSide');
  main.addEventListener('click', function(ev){
    var t = ev.target.closest('[data-dr]');
    if(!t) return;
    drTap(t.getAttribute('data-dr'), t.getAttribute('data-v'));
  });
  main.addEventListener('dblclick', function(ev){
    var t = ev.target.closest('[data-dr]');
    if(!t) return;
    if(DR.phase === 'pick'){ drTap(t.getAttribute('data-dr'), t.getAttribute('data-v'), true); }
  });
  var peek = function(ev){
    var f = ev.target.closest('[data-name]');
    if(!f) return;
    var c = drCard(f.getAttribute('data-name'));
    if(!c) return;
    ev.preventDefault();
    try{ openMod(c); }catch(_){}
  };
  main.addEventListener('contextmenu', peek);
  side.addEventListener('contextmenu', peek);
  side.addEventListener('click', function(ev){
    var t = ev.target.closest('[data-dr]');
    if(!t) return;
    drTap(t.getAttribute('data-dr'), t.getAttribute('data-v'));
  });
}
function drTap(kind, v, go){
  var V = DR.view;
  if(kind === 'add') return drAdd(v);
  if(kind === 'rem') return drRemove(v);
  if(DR.phase !== 'pick' || !V || !V.legal || !V.legal.length) return;
  if(kind === 'card'){
    var i = +v;
    DR.sel = (DR.sel && DR.sel.i === i && !go) ? null : {i:i};
  } else if(kind === 'pile'){
    var p = +v;
    if(V.type === 'winchester'){
      if(!V.legal.some(function(m){ return m.p === p; })) return;
      DR.sel = (DR.sel && DR.sel.p === p && !go) ? null : {p:p};
    } else if(V.type === 'hex'){
      DR.sel = drHexTap(p, go);
    }
  }
  if(go && drSelMove()){ drGo(); return; }
  drRender();
}
function drHexOk(a){ return DR.view.legal.some(function(m){ return m.a === a; }); }
function drHexTap(p, go){
  var s = DR.sel;
  if(s && s.pair != null){
    var pr = draftHexPair(s.pair);
    if(pr.indexOf(p) >= 0 && !go) return null;
    if(pr.indexOf(p) >= 0) return s;
    s = null;
  }
  if(s && s.a != null){
    if(s.a === p) return null;
    if((s.a + 1) % 6 === p && drHexOk(s.a)) return {pair:s.a};
    if((p + 1) % 6 === s.a && drHexOk(p)) return {pair:p};
  }
  var can = drHexOk(p) || drHexOk((p + 5) % 6);
  return can ? {a:p} : null;
}
function drSelMove(){
  var V = DR.view, s = DR.sel;
  if(!V || !s || DR.phase !== 'pick') return null;
  if(V.type === 'standard' && s.i != null && V.pack && V.pack.cards[s.i] != null)
    return {pack:V.pack.id, i:s.i, name:V.pack.cards[s.i]};
  if(V.type === 'hex' && s.pair != null && drHexOk(s.pair)) return {a:s.pair};
  if(V.type === 'winchester' && s.p != null && V.legal.some(function(m){ return m.p === s.p; }))
    return {p:s.p};
  return null;
}
/* A new view can take away what was chosen: keep the choice only while it still means the same thing. */
function drKeepSel(){
  if(DR.sel && !drSelMove() && !(DR.view && DR.view.type === 'hex' && DR.sel.a != null)) DR.sel = null;
}

function drFaceHTML(name){
  return "<div class='td-face' data-card='" + e(name) + "'></div>";
}
function drPaint(root){
  if(!root) return;
  if(typeof tdLazyFaces === 'function') tdLazyFaces(root);
  else if(typeof tdPaintFaces === 'function') tdPaintFaces(root);
}
function drSeatName(i){
  if(i === DR.me) return 'You';
  var s = DR.seats[i];
  return (s && s.name) || ('Seat ' + (i + 1));
}

function drRender(){
  if(!DR.open) return;
  var main = document.getElementById('drMain'), side = document.getElementById('drSide');
  var st = document.getElementById('drStatus'), acts = document.getElementById('drActs');
  var pill = document.getElementById('drPill');
  if(!main) return;
  var V = DR.view;
  if(pill) pill.innerHTML = tboGamePill(drTypeLabel(DR.type));
  if(DR.phase === 'build' || DR.phase === 'saved'){ drRenderBuild(main, side, st, acts); return; }
  if(!V){
    main.innerHTML = "<div class='dr-empty'>Dealing&hellip;</div>";
    side.innerHTML = drSeatsHTML(null);
    if(st) st.innerHTML = '';
    if(acts) acts.innerHTML = '';
    if(typeof window.mobOnDraft === 'function') window.mobOnDraft();
    return;
  }
  var mine = V.legal && V.legal.length;
  var key = drMainKey(V);
  if(key !== DR.rendered){
    DR.rendered = key;
    if(V.type === 'standard') main.innerHTML = drPackHTML(V);
    else if(V.type === 'hex') main.innerHTML = drHexHTML(V);
    else if(V.type === 'winchester') main.innerHTML = drWinHTML(V);
    drPaint(main);
  }
  drLightSel(main, V);
  if(st) st.innerHTML = drStatusHTML(V);
  if(acts) acts.innerHTML = "<button class='ed2-btn tbl-green' id='drGo' onclick='drGo()'"
    + (mine && drSelMove() ? '' : ' disabled') + ">" + (V.type === 'standard' ? 'Pick' : 'Take') + "</button>";
  side.innerHTML = drSeatsHTML(V) + drLastHTML(V) + drPicksHTML(V.picks, 'Your Picks');
  drClock();
  if(typeof window.mobOnDraft === 'function') window.mobOnDraft();
}
/* Redrawn only when it changed, so a pick elsewhere does not repaint your pack under the pointer. */
function drMainKey(V){
  var mine = V.legal && V.legal.length ? 1 : 0;
  if(V.type === 'standard') return 'std|' + (V.pack ? V.pack.id + ':' + V.pack.cards.length : '-') + '|' + mine;
  return V.type + '|' + V.seq + '|' + mine;
}
function drLightSel(main, V){
  var s = DR.sel || {};
  [].forEach.call(main.querySelectorAll('[data-dr]'), function(n){
    var v = +n.getAttribute('data-v'), on = false, pair = false;
    if(V.type === 'standard') on = s.i === v;
    else if(V.type === 'winchester') on = s.p === v;
    else if(V.type === 'hex'){
      if(s.pair != null) on = draftHexPair(s.pair).indexOf(v) >= 0;
      else if(s.a != null){
        on = s.a === v;
        pair = ((s.a + 1) % 6 === v && drHexOk(s.a)) || ((v + 1) % 6 === s.a && drHexOk(v));
      }
    }
    n.classList.toggle('sel', on);
    n.classList.toggle('pair', pair);
  });
}
function drStatusHTML(V){
  var mine = V.legal && V.legal.length;
  /* Every number shown goes through drInt, whatever a view held. */
  var R = drInt(V.rounds);
  if(V.type === 'standard'){
    var h = 'Pack <b>' + (Math.min(drInt(V.round), R - 1) + 1) + '</b> of ' + R
      + ' &middot; passing ' + (V.dir > 0 ? 'left' : 'right');
    if(V.pack) h += ' &middot; pick <b>' + drInt(V.pick) + '</b>';
    var q = drInt((V.queued || [])[V.seat]);
    if(q > 1) h += ' &middot; ' + (q - 1) + ' more waiting';
    return h;
  }
  if(V.type === 'hex'){
    return 'Round <b>' + (Math.min(drInt(V.round), R - 1) + 1) + '</b> of ' + R
      + ' &middot; ' + (mine ? '<b>Your pick</b>' : e(drSeatName(V.turn)) + ' is picking');
  }
  if(V.type === 'winchester'){
    return (mine ? '<b>Your pick</b>' : e(drSeatName(V.turn)) + ' is picking')
      + ' &middot; ' + drInt(V.stack) + ' left in the stack';
  }
  return '';
}
function drPackHTML(V){
  if(!V.pack) return "<div class='dr-empty'>Waiting for the next pack</div>";
  return "<div class='dr-grid'>" + V.pack.cards.map(function(n, i){
    return "<div class='dr-card' data-dr='card' data-v='" + i + "' data-name='" + e(n) + "' title='" + e(n) + "'>"
      + drFaceHTML(n) + "</div>";
  }).join('') + "</div>";
}
/* Ring order: a pile's neighbours on screen are its neighbours in the rules. */
var DR_HEX_AT = [[31, 20], [69, 20], [88, 50], [69, 80], [31, 80], [12, 50]];
function drHexHTML(V){
  var mine = V.legal && V.legal.length;
  var h = "<div class='dr-hex'>";
  for(var p = 0; p < 6; p++){
    var top = V.tops[p], taken = V.taken[p];
    var cls = 'dr-pile' + (taken != null ? ' taken' : '') + (!mine || taken != null || !top ? ' off' : '');
    h += "<div class='" + cls + "' data-dr='pile' data-v='" + p + "'"
      + (top ? " data-name='" + e(top) + "' title='" + e(top) + "'" : '')
      + " style='left:" + DR_HEX_AT[p][0] + "%;top:" + DR_HEX_AT[p][1] + "%'>"
      + "<div class='dr-top'>" + (top ? drFaceHTML(top) : "<div class='td-thumb-noart'></div>") + "</div>"
      + "<span class='dr-h'>" + (taken != null ? 'Taken by ' + e(drSeatName(taken)) : drInt((V.heights || [])[p]) + ' left') + "</span>"
      + "</div>";
  }
  h += "<div class='dr-hexmid'>Round <b>" + (Math.min(drInt(V.round), drInt(V.rounds) - 1) + 1) + "</b> of " + drInt(V.rounds)
    + "<br>" + (mine ? '<b>Your pick</b>' : e(drSeatName(V.turn)) + ' is picking') + "</div>";
  return h + "</div>";
}
function drWinHTML(V){
  var mine = V.legal && V.legal.length;
  var h = "<div class='dr-win'>";
  (V.piles || []).forEach(function(pile, p){
    if(!Array.isArray(pile)) pile = [];
    var off = !mine || !pile.length;
    h += "<div class='dr-wpile" + (off ? ' off' : '') + "' data-dr='pile' data-v='" + p + "'>"
      + "<span class='dr-h'>" + pile.length + (pile.length === 1 ? ' card' : ' cards') + "</span>"
      + "<div class='dr-wstack'>" + pile.map(function(n){
          return "<div class='dr-wcard' data-name='" + e(n) + "' title='" + e(n) + "'>" + drFaceHTML(n) + "</div>";
        }).join('') + "</div></div>";
  });
  return h + "</div>";
}
function drSeatsHTML(V){
  if(DR.seats.length < 2) return '';
  var h = "<div class='dr-sideh'>Players</div><div class='dr-seats'>";
  DR.seats.forEach(function(s, i){
    var on = false, sub = '';
    if(V){
      if(V.type === 'standard'){
        on = drInt((V.queued || [])[i]) > 0;
        sub = drInt((V.queued || [])[i]) + ' waiting';
      } else on = V.turn === i;
      sub = drInt((V.counts || [])[i]) + ' picked' + (V.type === 'standard' ? ' &middot; ' + sub : '');
    }
    h += "<div class='dr-seat" + (on ? ' on' : '') + "'>"
      + "<span class='tbl-av dr-av tbl-seat-" + e(s.side || TD_SEATS[i] || 'a') + "'>"
      + e((s.name || '?').charAt(0).toUpperCase()) + "</span>"
      + "<span class='dr-sname'>" + e(i === DR.me && s.name && s.name !== 'You' ? s.name + ' (you)' : (s.name || '')) + "</span>"
      + "<small>" + sub + "</small></div>";
  });
  return h + "</div>";
}
function drLastHTML(V){
  var L = V && V.last;
  if(!L) return '';
  var name = function(n){ return "<b data-name='" + e(n) + "'>" + e(n) + "</b>"; };
  if(V.type === 'hex'){
    return "<div class='dr-sideh'>Last Round</div><div class='dr-last'>"
      + L.picks.map(function(x){ return e(drSeatName(x.seat)) + ': ' + x.cards.map(name).join(', '); }).join('<br>')
      + (L.gone && L.gone.length ? '<br>Removed: ' + L.gone.map(function(g){ return name(g.card); }).join(', ') : '')
      + "</div>";
  }
  if(V.type === 'winchester'){
    return "<div class='dr-sideh'>Last Pick</div><div class='dr-last'>" + e(drSeatName(L.seat)) + ': '
      + L.cards.map(name).join(', ') + "</div>";
  }
  return '';
}
function drPicksHTML(names, title){
  var t = draftTally(names || []);
  return "<div class='dr-sideh'>" + e(title) + "<span class='dr-n'>" + (names || []).length + "</span></div>"
    + "<div class='dr-plist'>" + t.map(function(x){
        return "<div class='dr-prow' data-name='" + e(x.name) + "' title='" + e(x.name) + "'>"
          + "<span class='dr-pc'>" + x.count + "</span><span class='dr-pn'>" + e(x.name) + "</span></div>";
      }).join('') + "</div>";
}

function drCost(n){ var c = drCard(n); var v = c ? parseFloat(c.cmc) : NaN; return isNaN(v) ? 99 : v; }
function drRenderBuild(main, side, st, acts){
  var goal = drDeckGoal(), size = drDeckSize();
  var t = draftTally(DR.pool).sort(function(a, b){
    return drCost(a.name) - drCost(b.name) || (a.name < b.name ? -1 : a.name > b.name ? 1 : 0);
  });
  var key = 'build|' + t.length;
  if(DR.rendered !== key){
    DR.rendered = key;
    main.innerHTML = t.length ? "<div class='dr-grid'>" + t.map(function(x){
      return "<div class='dr-card' data-dr='add' data-v='" + e(x.name) + "' data-name='" + e(x.name) + "' title='" + e(x.name) + "'>"
        + drFaceHTML(x.name) + "<span class='dr-cnt'></span></div>";
    }).join('') + "</div>" : "<div class='dr-empty'>Nothing drafted</div>";
    drPaint(main);
  }
  [].forEach.call(main.querySelectorAll('.dr-card'), function(n){
    var left = drPoolLeft(n.getAttribute('data-v'));
    var cnt = n.querySelector('.dr-cnt');
    if(cnt) cnt.textContent = '×' + left;
    n.classList.toggle('out', left <= 0);
  });
  if(st) st.innerHTML = DR.phase === 'saved'
    ? 'Saved as <b>' + e(DR.savedAs) + '</b>'
    : 'Build &middot; <b>' + size + '</b> of ' + goal + ' &middot; ' + DR.pool.length + ' drafted';
  if(acts) acts.innerHTML = DR.phase === 'saved' && DR.mode === 'solo'
    ? "<button class='ed2-btn primary' id='drOpenDeck' onclick='drOpenSaved()'>Open in Build Deck</button>" : '';
  var rows = Object.keys(DR.deck).sort(function(a, b){
    return drCost(a) - drCost(b) || (a < b ? -1 : a > b ? 1 : 0);
  }).map(function(n){
    return "<div class='dr-prow' data-name='" + e(n) + "' title='" + e(n) + "'>"
      + "<span class='dr-pc'>" + DR.deck[n] + "</span><span class='dr-pn'>" + e(n) + "</span>"
      + (DR.phase === 'build' ? "<button type='button' class='ed2-btn tiny dr-minus' data-dr='rem' data-v='" + e(n) + "'"
          + " aria-label='" + e('One fewer ' + n) + "' title='One fewer'>&minus;</button>" : '')
      + "</div>";
  }).join('');
  var nameVal = (document.getElementById('drName') || {}).value;
  side.innerHTML = "<div class='dr-sideh'>Arena Deck<span class='dr-n" + (size === goal ? ' ok' : '') + "'>"
      + size + ' / ' + goal + "</span></div>"
    + "<div class='dr-plist dr-deck'>" + (rows || "<div class='dr-none'>No cards yet</div>") + "</div>"
    + (DR.phase === 'build'
        ? "<div class='dr-save'><input id='drName' maxlength='60' value='" + e(nameVal || drDefaultName()) + "'>"
          + "<button class='ed2-btn tbl-green tbl-big' id='drSave' onclick='drSave()'"
          + (size === goal && goal ? '' : ' disabled') + ">Save Arena Deck</button></div>"
        : '');
  if(typeof window.mobOnDraft === 'function') window.mobOnDraft();
}

/* dstart, dview and dstop are read only from the table's host (TBL.hostId, which only the relay sets), and only at a draft table;
   dpick goes to the host. A player who drops keeps their chair, and the host picks for them (HANDOFF §10). */
function drTableIsDraft(){ return !!(TBL.table && TBL.table.mode === 'draft'); }
function drHostStart(){
  if(!tboIsHost() || TBL.phase !== 'waiting' || !drTableIsDraft() || drRunning()) return false;
  var type = drTypeOk(TBL.table.dtype) ? TBL.table.dtype : 'standard';
  var from = TBO.host.ddeck || drDraftDecks()[0] || '';
  var entry = from ? drDeckEntry(from) : null;
  var p = drPoolOf(entry);
  if(!entry || !p.names.length){
    if(typeof toast === 'function') toast('No Draft Deck chosen');
    return false;
  }
  var cap = type === 'vault' ? tblSeated().length : (TBL.cap || 2);
  if(type === 'hex') cap = 2;
  var sides = type === 'vault' ? tblSeated().slice().sort() : TD_SEATS.slice(0, cap);
  var seats = sides.map(function(side, i){
    var s = (TBL.seats || {})[side];
    return s ? {name:s.name || ('Seat ' + (i + 1)), side:side, id:s.id}
             : {name:'Bot ' + (i + 1), side:side, bot:true};
  });
  var me = -1;
  seats.forEach(function(s, i){ if(s.side === TD.side) me = i; });
  if(me < 0) return false;
  var st = draftNew(type, p.names, seats.length, (Math.random() * 4294967296) >>> 0);
  if(!st) return false;
  var timer = type === 'vault' ? 0 : (+TBO.host.dtimer || 0);
  tblSend({t:'dstart', type:type, from:from, timer:timer, n:p.names.length,
           seats:seats.map(function(s){ return {name:s.name, side:s.side, bot:!!s.bot}; })});
  try{ tboChatSys('The draft has started'); }catch(_){}
  drBegin('host', type, from, seats, me, st, timer);
  return true;
}
function drSeatOfSide(side){
  for(var i = 0; i < DR.seats.length; i++) if(DR.seats[i].side === side) return i;
  return -1;
}
function drSendView(i){
  var s = DR.seats[i];
  if(!s || s.bot || i === DR.me || !DR.st) return;
  var live = (TBL.seats || {})[s.side];
  if(!live) return;
  s.id = live.id;
  tblSend({t:'dview', to:live.id, type:DR.type, from:DR.from, timer:DR.timer,
           names:DR.seats.map(function(x){ return {name:x.name, side:x.side, bot:!!x.bot}; }),
           v:draftView(DR.st, i),
           left:(DR.timer && DR.due[i]) ? Math.max(0, DR.due[i] - Date.now()) : 0});
}
function drBroadcast(){
  for(var i = 0; i < DR.seats.length; i++) drSendView(i);
}

function drSeatsFrom(list){
  return (Array.isArray(list) ? list.slice(0, 4) : []).map(function(s){
    s = (s && typeof s === 'object') ? s : {};
    return {name:String(s.name || '').slice(0, 40), side:(TD_SEATS.indexOf(s.side) >= 0 ? s.side : ''),
            bot:!!s.bot};
  });
}
function drTimerOf(v){ return Math.max(0, Math.min(3600, drInt(v))); }
/* True when the message was the draft's. */
function drOnMsg(msg, fromId){
  var t = msg && msg.t;
  if(t !== 'dstart' && t !== 'dview' && t !== 'dpick' && t !== 'dstop') return false;
  if(TBL.watch) return true;                    /* spectators are not dealt in */
  if(t === 'dpick'){
    if(DR.mode !== 'host' || !DR.st || DR.phase !== 'pick') return true;
    var i = drSeatOfSide(tblSideOf(fromId));
    if(i < 0 || i === DR.me) return true;
    if(draftApply(DR.st, i, msg.m)) drAfterChange();
    else drSendView(i);                         /* stale - here is where it stands */
    return true;
  }
  if(DR.mode === 'host') return true;           /* the host takes no dstart, dview or dstop */
  /* Only from the host, and only at a draft table. */
  if(!fromId || fromId !== TBL.hostId || !drTableIsDraft()) return true;
  if(t === 'dstop'){
    if(DR.mode === 'guest' && DR.phase === 'pick'){
      drClose(true);
      try{ tboChatSys('The host ended the draft'); }catch(_){}
      if(typeof toast === 'function') toast('The host ended the draft');
    }
    return true;
  }
  if(t === 'dstart'){
    if(DR.mode === 'guest' && DR.phase === 'build') return true;
    DR.hostId = fromId;
    drBegin('guest', drTypeOk(msg.type) ? msg.type : 'standard', String(msg.from || '').slice(0, 60),
            drSeatsFrom(msg.seats), 0, null, drTimerOf(msg.timer));
    DR.me = Math.max(0, drSeatOfSide(TD.side));
    try{ tboChatSys('The draft has started'); }catch(_){}
    drRender();
    return true;
  }
  if(t === 'dview'){
    var v = (typeof tgDraftView === 'function') ? tgDraftView(msg.v) : msg.v;
    if(!v || typeof v !== 'object' || !drTypeOk(v.type)) return true;
    /* Views come in order from one host, so one counted lower than the last, or of another draft, means the host began again. */
    var again = DR.mode === 'guest' && DR.phase === 'pick'
      && ((DR.view && v.seq < DR.view.seq) || v.type !== DR.type);
    if(DR.mode !== 'guest' || !DR.phase || again){
      DR.hostId = fromId;
      drBegin('guest', v.type, String(msg.from || '').slice(0, 60), drSeatsFrom(msg.names),
              drInt(v.seat), null, drTimerOf(msg.timer));
    }
    if(DR.phase === 'build' || DR.phase === 'saved') return true;
    DR.hostId = fromId;
    var names = drSeatsFrom(msg.names);
    if(names.length) DR.seats = names;
    DR.me = drInt(v.seat);
    DR.view = v;
    DR.dueMine = msg.left ? Date.now() + Math.max(0, Math.min(3600000, drInt(msg.left))) : 0;
    if(v.done){ drFinish(); return true; }
    drKeepSel();
    drRender();
    return true;
  }
  return true;
}
function drOnWant(fromId){
  if(DR.mode !== 'host' || !DR.st) return;
  var i = drSeatOfSide(tblSideOf(fromId));
  if(i < 0) return;
  DR.seats[i].away = false;
  drSendView(i);
}
function drOnPeer(m){
  if(DR.mode !== 'host' || !DR.st || m.watch) return;
  var i = drSeatOfSide(m.side);
  if(i < 0 || i === DR.me || DR.seats[i].bot) return;
  DR.seats[i].away = !m.join;
  if(m.join){ DR.seats[i].id = m.id; drSendView(i); }
  drBots();
  drRender();
}
function drOnHost(m){
  if(DR.mode === 'guest' && DR.phase === 'pick' && m.id !== DR.hostId){
    drClose(true);
    try{ tboChatSys('The host left - the draft ended'); }catch(_){}
    if(typeof toast === 'function') toast('The host left - the draft ended');
  }
}
function drOnLeave(){
  if(!DR.mode || DR.mode === 'solo') return;
  if(DR.phase === 'pick'){ drClose(true); return; }
  DR.mode = 'solo';
}
