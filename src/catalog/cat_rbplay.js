/* The Rebirth table's play: damage on cards, the players' turn and the DM's, the whole table saved, the DM's notes, the DM's controls and dealing yourself in. */

/* ── Damage ─────────────────────────────────────────────────────────────── */
/* Kept on the card as its total (item.dmg) while it is on the Field or in an Armament; TD_ACT.move takes it off anywhere else. */
var TD_DMG_ZONES = {field:1, gear:1};
TD_ACT.dmg = function(b, a){
  var at = tdFindIn(b, a.uid);
  if(!at) return;
  var v = tgIntOr(a.v, 0, TG_DMG_MOST, 0);
  if(v > 0 && TD_DMG_ZONES[at.zone]) at.item.dmg = v; else delete at.item.dmg;
};
function tdDmgOf(item){ return (item && item.dmg > 0) ? item.dmg : 0; }
window.tdDmgOf = tdDmgOf;
function tdPlayActionWords(a, board, before, beforeName){
  switch(a.t){
    case 'dmg':
      var nm = beforeName || tdCardWords(a.uid, board), d = tgIntOr(a.d, -TG_DMG_MOST, TG_DMG_MOST, 0);
      if(a.clr) return 'cleared the damage on ' + nm;
      if(d > 0) return 'dealt ' + d + ' damage to ' + nm;
      if(d < 0) return 'healed ' + (-d) + ' damage on ' + nm;
      return '';
    case 'dmrole':
      return (typeof tdRbRoleWords === 'function') ? tdRbRoleWords(a) : '';
  }
  return '';
}
window.tdPlayActionWords = tdPlayActionWords;
/* Anybody deals or heals damage on any card there; on another's card their app does it, from the amount, so two at once both count. */
function tdDmgChange(uid, seat, d, clr){
  if(!TD.board || TD.watching) return false;
  var mine = !seat || seat === TD.side, b = mine ? TD.board : tdFoeOf(seat);
  var at = b ? tdFindIn(b, uid) : null;
  if(!at || !TD_DMG_ZONES[at.zone]) return false;
  var cur = tdDmgOf(at.item), v = clr ? 0 : Math.max(0, Math.min(TG_DMG_MOST, cur + d));
  if(v === cur && !clr) return false;
  if(clr && !cur) return false;
  var a = {t:'dmg', uid:uid, v:v, d:(clr ? 0 : v - cur)};
  if(clr) a.clr = true;
  if(mine){ tdDo(a); tdRender(); tdDmgPanel(); return true; }
  var req = {op:'dmg', uid:uid, v:v, d:a.d};
  if(clr) req.clr = true;
  if(!tdRbAsk(seat, req)) return false;
  tdApplyTo(b, a);
  tdRender();
  tdDmgPanel();
  return true;
}
function tdDmgPanel(){
  if(typeof tblOn === 'function' && tblOn() && typeof tblRenderPanel === 'function') tblRenderPanel();
}
window.tdDmgChange = tdDmgChange;
function tdDmgReq(m){
  var at = tdFind(m.uid);
  if(!at || !TD_DMG_ZONES[at.zone]) return false;
  var cur = tdDmgOf(at.item);
  var done;
  if(m.clr) done = cur > 0 && !!tdDo({t:'dmg', uid:m.uid, v:0, d:0, clr:true});
  else {
    var v = Math.max(0, Math.min(TG_DMG_MOST, cur + (m.d || 0)));
    done = v !== cur && !!tdDo({t:'dmg', uid:m.uid, v:v, d:v - cur});
  }
  if(done) tdDmgPanel();
  return done;
}
window.tdDmgReq = tdDmgReq;
/* The card's menu: an amount, Deal and Heal, and Clear once there is some. */
function tdDmgRows(item, zoneId, uid, seat){
  if(!REBIRTH || !item || item.anon || !TD_DMG_ZONES[zoneId] || !TD.board || TD.watching) return null;
  var amt = function(v){ return tdGfNumIn(v[0], 0, TG_DMG_MOST, 0); };
  var btns = [
    {label:'Deal', act:function(v){ var n = amt(v); if(!n) return; tdCloseMenu(); tdDmgChange(uid, seat, n); }},
    {label:'Heal', act:function(v){ var n = amt(v); if(!n) return; tdCloseMenu(); tdDmgChange(uid, seat, -n); }}];
  if(tdDmgOf(item)) btns.push({label:'Clear', act:function(){ tdCloseMenu(); tdDmgChange(uid, seat, 0, true); }});
  return [{form:[{label:'Damage', type:'number', min:1, max:TG_DMG_MOST, value:''}], btns:btns}];
}
window.tdDmgRows = tdDmgRows;
/* Another player's Armament, at the side of their corner: its menu is the damage alone. */
function tdDmgFoeMenu(ev){
  if(!REBIRTH || typeof tdRbOn !== 'function' || !tdRbOn() || !TD.board || TD.watching) return false;
  var card = (ev.target && ev.target.closest) ? ev.target.closest('.rb-other .td-card[data-uid]') : null;
  var half = card ? card.closest('.rb-other[data-seat]') : null;
  if(!half) return false;
  var seat = half.getAttribute('data-seat'), foe = tdFoeOf(seat), uid = card.getAttribute('data-uid');
  var at = foe ? tdFindIn(foe, uid) : null;
  var rows = at ? tdDmgRows(at.item, at.zone, uid, seat) : null;
  if(!rows) return false;
  ev.preventDefault();
  tdCloseMenu();
  tdShowMenu(at.item.card.name + ' — ' + (foe.name || tblSeatName(seat)) + "'s", rows, '', ev.clientX, ev.clientY);
  var i = document.querySelector('#tdMenu .td-mform-in');
  if(i) try{ i.focus(); }catch(_){}
  return true;
}
window.tdDmgFoeMenu = tdDmgFoeMenu;
/* A player's Character card with Health, seen open, and what is left of it: the HP by their name in the top row (Q27). */
function tdDmgCharHp(b){
  if(!b || !b.zones || typeof window.edCardHealth !== 'function') return null;
  var zs = ['gear', 'field'];
  for(var i = 0; i < zs.length; i++){
    var list = b.zones[zs[i]] || [];
    for(var j = 0; j < list.length; j++){
      var it = list[j];
      if(!it.card || it.anon || !tdDmgOf(it) || !tdIsCharacterCard(it.card)) continue;
      var h = window.edCardHealth(it.card);
      if(h != null) return Math.max(0, h - tdDmgOf(it));
    }
  }
  return null;
}
window.tdDmgCharHp = tdDmgCharHp;

/* ── The players' turn and the DM's turn ────────────────────────────────── */
/* At a Rebirth table the turn is the players', all together, then the DM's. The DM's app holds it (TBL.rbt: who, 'pl' or
   'dm'; n, counted up at each change; done, the players who have ended theirs) and says it to everybody (rbturn). A
   player ends their part (rbdone); when the last one has, the turn is the DM's, and the DM can take it back sooner
   (Q18 A and B). Play Test alone is as it was. */
function tdRbTurnOn(){
  return typeof tdRbOn === 'function' && tdRbOn() && typeof tblOn === 'function' && tblOn()
    && typeof TBL !== 'undefined' && TBL.phase !== 'waiting';
}
window.tdRbTurnOn = tdRbTurnOn;
function tdRbDmSide(){
  if(tdDmMine()) return TD.side;
  var b = tdDmBoard();
  return b ? tdGfSeatOf(b) : '';
}
function tdRbPlayers(){
  var dm = tdRbDmSide();
  return tblSeated().filter(function(s){ return s !== dm; });
}
function tdRbT(){ return TBL.rbt || {who:'', n:0, done:{}}; }
window.tdRbT = tdRbT;
function tdRbTurnShow(){
  if(typeof tblRenderPanel === 'function') tblRenderPanel();
  if(typeof tdRenderTurn === 'function') tdRenderTurn();
}
function tdRbTurnWords(who, early){
  return who === 'dm' ? (early ? 'took the turn back' : 'took the turn') : 'handed the turn to the players';
}
/* The DM's app: whose it is now, said to everybody. */
function tdRbTurnSet(who, early){
  if(!tdDmMine() || TBL.watch) return;
  var was = tdRbT();
  TBL.rbt = {who:who, n:(was.n || 0) + 1, done:{}};
  tdRbTurnSend(early);
  tdFeedPush('me', tdRbTurnWords(who, early));
  tdRenderFeed();
  if(who === 'dm' && was.who === 'pl' && typeof tdTurnArrived === 'function') tdTurnArrived();
  tdRbTurnShow();
}
function tdRbTurnSend(early){
  var t = tdRbT();
  if(!t.who || typeof tblSend !== 'function') return;
  var m = {t:'rbturn', who:t.who, n:t.n, done:t.done};
  if(early) m.early = true;
  tblSend(m);
}
/* With every whole state the DM sends, so a player who arrives or comes back learns whose it is. */
function tdRbTurnResend(){
  if(tdRbTurnOn() && tdDmMine() && !TBL.watch && TBL.rbt) tdRbTurnSend(false);
}
window.tdRbTurnResend = tdRbTurnResend;
/* The top row's button. viaTracker: the tracker passed its last phase, so the new turn is set already (tdAdvance). */
function tdRbEndTurn(viaTracker){
  if(TBL.watch || !TD.board || TD.watching) return false;
  var t = tdRbT();
  if(tdDmMine()){
    if(t.who === 'dm'){
      if(!viaTracker && typeof tdEndTurnHere === 'function') tdEndTurnHere();
      else if(typeof tdUndoFloorHere === 'function') tdUndoFloorHere();
      tdRbTurnSet('pl');
      return true;
    }
    if(viaTracker) return false;
    tdRbTurnSet('dm', t.who === 'pl');
    return true;
  }
  if(t.who !== 'pl' || t.done[TD.side]) return false;
  if(!viaTracker && typeof tdEndTurnHere === 'function') tdEndTurnHere();
  else if(typeof tdUndoFloorHere === 'function') tdUndoFloorHere();
  /* the tracker's own line says the turn ended (tdActionWords, 'phase') */
  TBL.rbt.done[TD.side] = 1;
  tblSend({t:'rbdone', n:t.n});
  tdRbTurnShow();
  return true;
}
window.tdRbEndTurn = tdRbEndTurn;
/* rbturn from the DM, rbdone from a player; a tick shows at once, and the DM's next rbturn says the same. */
function tdRbTurnMsg(msg, fromId){
  var from = (typeof tblSideOf === 'function') ? tblSideOf(fromId) : '';
  if(!from) return;
  var dm = tdRbDmSide();
  if(msg.t === 'rbturn'){
    if(from !== dm || tdDmMine()) return;
    var was = TBL.rbt;
    TBL.rbt = {who:msg.who, n:msg.n, done:msg.done || {}};
    if(!was || was.who !== msg.who){
      tblFeedAs('them', tdRbTurnWords(msg.who, msg.early), tblFromName(fromId));
      /* the players' turn coming round, seen happen: a page opened since gets no second draw */
      if(was && msg.who === 'pl' && !TBL.watch && typeof tdTurnArrived === 'function') tdTurnArrived();
    }
    tdRbTurnShow();
    return;
  }
  var t = TBL.rbt;
  if(!t || t.who !== 'pl' || msg.n !== t.n || from === dm || t.done[from]) return;
  t.done[from] = 1;
  if(tdDmMine() && !TBL.watch) tdRbTurnCheck();
  tdRbTurnShow();
}
window.tdRbTurnMsg = tdRbTurnMsg;
/* The DM's app: every player done, the turn is the DM's; else the ticks so far go round. */
function tdRbTurnCheck(){
  var t = tdRbT();
  if(t.who !== 'pl') return;
  if(tdRbPlayers().every(function(s){ return !!t.done[s]; })) tdRbTurnSet('dm');
  else tdRbTurnSend(false);
}
/* A player who leaves in the players' turn is not waited for. */
function tdRbTurnSeatGone(side){
  if(tdRbTurnOn() && tdDmMine() && !TBL.watch && tdRbT().who === 'pl') tdRbTurnCheck();
}
window.tdRbTurnSeatGone = tdRbTurnSeatGone;
/* The tracker's end of a turn (tdNewTurn): handled when there was a part of the turn to end. */
function tdRbNewTurn(){ return tdRbEndTurn(true); }
window.tdRbNewTurn = tdRbNewTurn;
function tdRbTurnHTML(){
  var t = tdRbT(), dm = tdDmMine() && !TBL.watch, btn = '';
  var words = !t.who ? 'Nobody has taken the turn'
    : (t.who === 'dm' ? (dm ? 'Your turn' : "The DM's turn") : "The players' turn");
  if(!TBL.watch && TD.board){
    if(dm) btn = (t.who === 'dm')
      ? tblToolHTML('turn', 'tdRbEndTurn()', 'End turn', 0, false, 'tbl-green tbl-keep', 'Hand the turn to the players')
      : tblToolHTML('turn', 'tdRbEndTurn()', 'Take turn', 0, false, 'tbl-green tbl-keep',
                    t.who === 'pl' ? 'Take the turn back from the players' : 'Take the turn');
    else if(t.who === 'pl' && !t.done[TD.side])
      btn = tblToolHTML('turn', 'tdRbEndTurn()', 'End turn', 0, false, 'tbl-green tbl-keep', 'End your turn');
  }
  var mine = (dm && t.who === 'dm') || (!dm && !TBL.watch && t.who === 'pl' && !t.done[TD.side]);
  return "<span class='tbl-turn" + (mine ? ' mine' : '') + "'>&#9654; " + e(words) + "</span>" + btn;
}
window.tdRbTurnHTML = tdRbTurnHTML;
/* A chip lights while its seat has the turn; a player who has ended theirs carries a tick. */
function tdRbChipCls(k){
  var t = tdRbT(), dm = tdRbDmSide();
  if(t.who === 'dm') return (k === dm) ? ' turn' : '';
  if(t.who === 'pl' && k !== dm) return t.done[k] ? ' done' : ' turn';
  return '';
}
window.tdRbChipCls = tdRbChipCls;
function tdRbChipTick(k){
  var t = tdRbT();
  return (t.who === 'pl' && t.done[k])
    ? "<span class='tbl-done' role='img' aria-label='Ended their turn' title='Ended their turn'>&#10003;</span>" : '';
}
window.tdRbChipTick = tdRbChipTick;
/* The turn tracker shows the turn being played: yours in the players' turn, the DM's in theirs. */
function tdRbTurnBoard(){
  var t = tdRbT(), dm = tdDmMine();
  if(t.who === 'dm') return dm ? TD.board : (tdDmBoard() || {side:tdRbDmSide()});
  if(t.who === 'pl') return dm ? {side:''} : TD.board;
  return TD.board;
}
window.tdRbTurnBoard = tdRbTurnBoard;
function tdRbTurnWhose(){
  var t = tdRbT();
  if(t.who === 'dm') return {seat:tdRbDmSide(), words:"The DM's turn"};
  if(t.who === 'pl') return {seat:'', words:"The players' turn"};
  return null;
}
window.tdRbTurnWhose = tdRbTurnWhose;

/* ── The whole table saved ──────────────────────────────────────────────── */
/* The DM's file holds every board at the table (Q19 A and B). Asked to save, each player's app keeps its own board in its
   own browser, under the save's id, and sends it to the DM's. A table loaded gives each player theirs as they sit,
   matched by name: the copy they kept when there is one, else the file's. The DM's saved maps and Master notes travel
   in the file and come in only where this browser has none of that name. */
var TD_TS_KEY = 'conjure_rb_tsaves', TD_TS_MOST = 6, TD_TS_WAIT = 5000;
var TSAVE = {got:null, load:null};
function tdTsDm(){ return tdRbTurnOn() && tdDmMine() && !TBL.watch; }
function tdTsKey(n){ return String(n == null ? '' : n).replace(/\s+/g, ' ').trim().toLowerCase(); }
function tdTsName(){
  var t = TBL.table || {};
  return tdMapName(t.name) || ('Table ' + (TBL.room || ''));
}
function tdTsNames(list){
  return list.length > 1 ? list.slice(0, -1).join(', ') + ' and ' + list[list.length - 1] : (list[0] || '');
}
function tdTsMenuPart(){
  if(!tdTsDm()) return '';
  var item = function(label, act){
    return "<button class='td-moreitem' role='menuitem' onclick='tdCloseMore();" + act + "()'>" + label + "</button>";
  };
  return item('Save the table&hellip;', 'tdTsSave') + item('Load a table&hellip;', 'tdTsLoad');
}
window.tdTsMenuPart = tdTsMenuPart;
function tdTsSave(){
  if(!tdTsDm() || !TD.board || TSAVE.got) return false;
  var want = tdRbPlayers(), names = {};
  want.forEach(function(s){ names[s] = tblSeatName(s); });
  var g = TSAVE.got = {id:'ts' + Date.now(), name:tdTsName(), at:Date.now(), want:want, names:names, boards:{}, timer:0};
  tblSend({t:'tsave', id:g.id, name:g.name});
  tdFeedPush('me', 'saved the table');
  if(want.length) g.timer = setTimeout(function(){ if(TSAVE.got === g) tdTsWrite(); }, TD_TS_WAIT);
  else tdTsWrite();
  return true;
}
window.tdTsSave = tdTsSave;
/* What has come by then: a player who never answers is left out, and the DM is told whose board is missing. */
function tdTsWrite(){
  var g = TSAVE.got;
  TSAVE.got = null;
  if(!g) return false;
  if(g.timer) clearTimeout(g.timer);
  var mine = TD.board ? tdSerialize() : null;
  if(!mine) return false;
  var players = [], missing = [];
  g.want.forEach(function(s){
    if(g.boards[s]) players.push({name:g.names[s], board:g.boards[s]});
    else missing.push(g.names[s]);
  });
  var d = {kind:'conjure-table', v:1, id:g.id, name:g.name, at:g.at,
           dm:{name:TBL.name || '', board:mine, feed:(TD.feed || []).slice(-300)}, players:players};
  var t = tdRbT();
  if(t.who) d.turn = t.who;
  var maps = (typeof tdMapsForBackup === 'function') ? tdMapsForBackup() : null;
  if(maps) d.maps = maps;
  var save = function(pics){
    if(pics && Object.keys(pics).length) d.pics = pics;
    tdSaveAs(JSON.stringify(d), 'conjure-table-' + tdStamp() + '.json', 'application/json');
    if(typeof toast === 'function')
      toast(missing.length ? 'Saved the table without ' + tdTsNames(missing) + "'s board" + (missing.length > 1 ? 's' : '')
                           : 'Saved the table');
  };
  var withPic = ((maps && maps.maps) || []).concat(TD.board.grid ? [{grid:TD.board.grid}] : []);
  if(typeof tdGfPicsOf === 'function') tdGfPicsOf(withPic, save); else save(null);
  return true;
}
function tdTsFromDm(fromId){
  var from = (typeof tblSideOf === 'function') ? tblSideOf(fromId) : '';
  return !!from && !tdDmMine() && from === tdRbDmSide();
}
/* A player's app: the DM asked, so its own board is kept here and sent to the DM alone. */
function tdTsAsked(msg, fromId){
  if(TBL.watch || TD.watching || !TD.board || !tdTsFromDm(fromId)) return;
  var d = tdSerialize();
  if(!d) return;
  if(!tdTsKeep({id:msg.id, name:msg.name || '', at:Date.now(), board:d, feed:(TD.feed || []).slice(-300)})
     && typeof toast === 'function') toast('This browser would not keep your board (its storage is full or blocked)');
  tblSend({t:'tsbd', id:msg.id, board:d, to:fromId});
  tblFeedAs('them', 'saved the table', tblFromName(fromId));
}
function tdTsList(){
  var l = null;
  try{ l = JSON.parse(localStorage.getItem(TD_TS_KEY) || 'null'); }catch(_){}
  return Array.isArray(l) ? l.filter(function(r){ return r && typeof r.id === 'string' && r.board; }) : [];
}
/* The newest few; the oldest go first while the browser's storage is full. */
function tdTsKeep(rec){
  var l = tdTsList().filter(function(r){ return r.id !== rec.id; });
  l.push(rec);
  while(l.length > TD_TS_MOST) l.shift();
  while(l.length){
    try{ localStorage.setItem(TD_TS_KEY, JSON.stringify(l)); return true; }
    catch(_){ l.shift(); }
  }
  return false;
}
function tdTsFind(id){
  return tdTsList().filter(function(r){ return r.id === id; })[0] || null;
}
/* The DM's app: each answer, until every player has, or TD_TS_WAIT runs out (tdTsSave). */
function tdTsGot(msg, fromId){
  var g = TSAVE.got, from = tblSideOf(fromId);
  if(!g || msg.id !== g.id || !from || g.want.indexOf(from) < 0 || g.boards[from]) return;
  g.boards[from] = msg.board;
  if(g.want.every(function(s){ return !!g.boards[s]; })) tdTsWrite();
}
function tdTsLoad(){
  if(!tdTsDm()) return false;
  var inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.json,application/json';
  inp.addEventListener('change', function(){
    var f = inp.files && inp.files[0];
    if(!f) return;
    var rd = new FileReader();
    rd.onload = function(){ tdTsLoadText(String(rd.result || '')); };
    rd.readAsText(f);
  });
  inp.click();
  return true;
}
window.tdTsLoad = tdTsLoad;
function tdTsLoadText(text){
  var say = function(w){ if(typeof toast === 'function') toast(w); };
  if(!tdTsDm()) return false;
  var o = null;
  try{ o = JSON.parse(text); }catch(_){}
  var id = (o && typeof o.id === 'string' && /^ts\d{1,15}$/.test(o.id)) ? o.id : '';
  var dm = (id && o.kind === 'conjure-table' && tgObj(o.dm)) ? tgBoard(o.dm.board) : null;
  if(!dm || !tdRbIsDm(dm)){ say('That file is not a saved table'); return false; }
  var name = tdMapName(o.name) || tdTsName();
  var err = tdImportBoardText(JSON.stringify({board:dm, feed:o.dm.feed}), 'loaded the saved table ' + name);
  if(err){ say(err); return false; }
  var boards = Object.create(null);
  (Array.isArray(o.players) ? o.players.slice(0, 8) : []).forEach(function(p){
    var k = tgObj(p) ? tdTsKey(p.name) : '', b = k ? tgBoard(p.board) : null;
    if(b && !boards[k]) boards[k] = b;
  });
  TSAVE.load = {id:id, name:name, at:tgNum(o.at, 0, 1e15) || 0, boards:boards, sent:Object.create(null), room:TBL.room};
  tdTsMapsIn(o);
  tdRbPlayers().forEach(tdTsSendTo);
  if(o.turn === 'pl' || o.turn === 'dm') tdRbTurnSet(o.turn);
  say('Loaded the table ' + name);
  return true;
}
window.tdTsLoadText = tdTsLoadText;
/* Only what this browser lacks: a map of a name saved here already, and Master notes already written, stay as they are. */
function tdTsMapsIn(o){
  var rb = (o && tgObj(o.maps)) ? o.maps : null;
  if(!rb || typeof tdMapsBoot !== 'function') return;
  tdMapsBoot().then(function(){
    var have = Object.create(null);
    tdMapsLoad().forEach(function(m){ have[m.name.toLowerCase()] = 1; });
    var add = tdMapsTidy(rb.maps).filter(function(m){ return !have[m.name.toLowerCase()]; });
    if(add.length) tdMapsWrite(tdMapsLoad().concat(add));
    if(o.pics && typeof tdGfPicsIn === 'function') tdGfPicsIn(o.pics);
    if(typeof rb.master === 'string' && rb.master && !tdNotesMaster()) tdNotesMasterSet(rb.master);
    if(TD.board && typeof tdRenderBar === 'function') tdRenderBar();
  });
}
/* The DM's app: a seated player's board from the table loaded, once each (by their id), whenever they sit. */
function tdTsSendTo(side){
  var L = TSAVE.load, s = (TBL.seats || {})[side];
  if(!L || L.room !== TBL.room || !tdTsDm() || !s || !s.id || s.id === TBL.you || L.sent[s.id]) return false;
  L.sent[s.id] = 1;
  tblSend({t:'tload', id:L.id, board:L.boards[tdTsKey(s.name)] || null, name:L.name, at:L.at, to:s.id});
  return true;
}
function tdTsSeated(side){ if(TSAVE.load) tdTsSendTo(side); }
window.tdTsSeated = tdTsSeated;
/* A new deal is a new game: nobody who sits after it gets a board from the table loaded before. */
function tdTsForget(){ TSAVE.load = null; }
window.tdTsForget = tdTsForget;
/* A player's app: the board kept here for that save, or else the DM's copy of it. */
function tdTsLoaded(msg, fromId){
  if(TBL.watch || TD.watching || !tdTsFromDm(fromId)) return;
  var own = tdTsFind(msg.id);
  var src = own ? {board:own.board, feed:own.feed} : (msg.board ? {board:msg.board} : null);
  if(!src) return;
  var err = tdImportBoardText(JSON.stringify(src), false);
  if(err){ if(typeof toast === 'function') toast(err); return; }
  var who = tblFromName(fromId);
  tblFeedAs('them', 'loaded the saved table' + (msg.name ? ' ' + msg.name : ''), who);
  if(typeof toast === 'function') toast(who + ' loaded the saved table');
}
function tdTsMsg(msg, fromId){
  if(msg.t === 'tsave') tdTsAsked(msg, fromId);
  else if(msg.t === 'tsbd') tdTsGot(msg, fromId);
  else if(msg.t === 'tload') tdTsLoaded(msg, fromId);
}
window.tdTsMsg = tdTsMsg;

/* ── The DM's notes ─────────────────────────────────────────────────────── */
/* A window only the DM sees (Q20): a page for the map on the Field, kept in that saved map (tdMapNow, cat_rbdm.js), and
   the Master notes, which belong to no map and live in this browser, the backup and a table save. The page of a map not
   saved yet waits in a draft under the map's name until it is (tdNotesKept). */
var TD_NOTES_MASTER = 'conjure_rb_notes_master', TD_NOTES_DRAFT = 'conjure_rb_notes_draft', TD_NOTES_WAIT = 500;
var NOTES = {open:false, page:'map', on:'', text:'', dirty:false, timer:0};
function tdNotesHere(){ return typeof tdMapsHere === 'function' && tdMapsHere(); }
function tdNotesKeyNow(){ return String((TD.board && TD.board.map) || '').toLowerCase(); }
function tdNotesSay(w){ if(typeof toast === 'function') toast(w); }
function tdNotesDrafts(){
  var d = null;
  try{ d = JSON.parse(localStorage.getItem(TD_NOTES_DRAFT) || 'null'); }catch(_){}
  return (d && typeof d === 'object' && !Array.isArray(d)) ? d : {};
}
function tdNotesDraftsPut(d){
  try{
    if(Object.keys(d).length) localStorage.setItem(TD_NOTES_DRAFT, JSON.stringify(d));
    else localStorage.removeItem(TD_NOTES_DRAFT);
    return true;
  }catch(_){
    tdNotesSay('This browser would not save the notes (its storage is full or blocked)');
    return false;
  }
}
function tdNotesMaster(){
  try{ return String(localStorage.getItem(TD_NOTES_MASTER) || ''); }catch(_){ return ''; }
}
function tdNotesMasterSet(t){
  t = String(t == null ? '' : t).slice(0, TD_MAP_NOTES_MOST);
  try{
    if(t) localStorage.setItem(TD_NOTES_MASTER, t); else localStorage.removeItem(TD_NOTES_MASTER);
  }catch(_){
    tdNotesSay('This browser would not save the notes (its storage is full or blocked)');
    return false;
  }
  if(NOTES.on === 'master' && !NOTES.dirty) tdNotesShow(t);
  return true;
}
/* A draft waiting for its map comes first: it was written while there was no saved map to keep it in. */
function tdNotesRead(k){
  var dr = tdNotesDrafts();
  if(typeof dr[k] === 'string') return dr[k];
  var m = k ? tdMapFind(k) : null;
  return (m && typeof m.notes === 'string') ? m.notes : '';
}
/* The page for the map on the Field, as tdMapNow saves it: what is being typed now, if that is the page open. */
function tdNotesPage(){
  var k = tdNotesKeyNow();
  if(NOTES.on === 'map:' + k && NOTES.dirty) return NOTES.text.slice(0, TD_MAP_NOTES_MOST);
  return tdNotesRead(k);
}
window.tdNotesPage = tdNotesPage;
/* Into the saved map of that name, or a draft when there is none. */
function tdNotesWrite(k, text){
  text = String(text || '').slice(0, TD_MAP_NOTES_MOST);
  var m = k ? tdMapFind(k) : null, dr = tdNotesDrafts();
  if(m){
    var rec = {}, lk = m.name.toLowerCase();
    Object.keys(m).forEach(function(f){ rec[f] = m[f]; });
    if(text) rec.notes = text; else delete rec.notes;
    if(!tdMapsWrite(tdMapsLoad().map(function(x){ return x.name.toLowerCase() === lk ? rec : x; }))) return false;
    if(Object.prototype.hasOwnProperty.call(dr, k)){ delete dr[k]; tdNotesDraftsPut(dr); }
    return true;
  }
  if(text) dr[k] = text; else delete dr[k];
  return tdNotesDraftsPut(dr);
}
function tdNotesFlush(){
  if(NOTES.timer){ clearTimeout(NOTES.timer); NOTES.timer = 0; }
  if(!NOTES.dirty) return true;
  NOTES.dirty = false;
  if(NOTES.on === 'master') return tdNotesMasterSet(NOTES.text);
  if(NOTES.on.indexOf('map:') === 0) return tdNotesWrite(NOTES.on.slice(4), NOTES.text);
  return true;
}
function tdNotesInput(el){
  NOTES.text = String(el.value || '');
  NOTES.dirty = true;
  if(NOTES.timer) clearTimeout(NOTES.timer);
  NOTES.timer = setTimeout(tdNotesFlush, TD_NOTES_WAIT);
}
/* tdMapPut has just saved the map on the Field as `k` (lower case), with its page in it (tdMapNow): a draft for it is
   spent, and so is the one for the map on the Field when that has no saved map of its own. */
function tdNotesKept(k){
  var cur = tdNotesKeyNow(), saved = !!(cur && tdMapFind(cur));
  if(NOTES.dirty){
    /* typed for another page, or for a saved map of its own besides k: it goes where it was typed for too */
    if(NOTES.on !== 'map:' + cur || (cur !== k && saved)) tdNotesFlush();
    else {
      if(NOTES.timer){ clearTimeout(NOTES.timer); NOTES.timer = 0; }
      NOTES.dirty = false;
    }
  }
  var dr = tdNotesDrafts(), had = false;
  [k, (cur !== k && !saved) ? cur : null].forEach(function(x){
    if(x != null && Object.prototype.hasOwnProperty.call(dr, x)){ delete dr[x]; had = true; }
  });
  if(had) tdNotesDraftsPut(dr);
}
window.tdNotesKept = tdNotesKept;
/* After tdMapRename has renamed the record: the page open follows it, and a draft under the old name goes into it. */
function tdNotesRenamed(was, now){
  var a = String(was || '').toLowerCase(), b = String(now || '').toLowerCase();
  if(a === b) return;
  if(NOTES.on === 'map:' + a) NOTES.on = 'map:' + b;
  var dr = tdNotesDrafts();
  if(!Object.prototype.hasOwnProperty.call(dr, a)) return;
  var t = dr[a];
  delete dr[a];
  if(tdNotesDraftsPut(dr)) tdNotesWrite(b, t);
}
window.tdNotesRenamed = tdNotesRenamed;
function tdNotesForBackup(out){
  var t = tdNotesMaster();
  if(t) out.master = t;
}
window.tdNotesForBackup = tdNotesForBackup;
/* A backup's Master notes replace these, as its maps replace those of their names (tdMapsRestore). */
function tdNotesRestore(rb){
  if(!rb || typeof rb.master !== 'string' || !rb.master) return;
  if(NOTES.on === 'master'){ if(NOTES.timer) clearTimeout(NOTES.timer); NOTES.timer = 0; NOTES.dirty = false; }
  tdNotesMasterSet(rb.master);
}
window.tdNotesRestore = tdNotesRestore;
function tdNotesShow(text){
  var ta = document.querySelector('#tdNotesWin .td-notes-in');
  if(ta && ta.value !== text) ta.value = text;
}
function tdNotesBuild(){
  var win = document.createElement('aside');
  win.id = 'tdNotesWin';
  win.className = 'td-noteswin';
  win.setAttribute('role', 'dialog');
  win.setAttribute('aria-modal', 'false');
  win.setAttribute('aria-label', 'DM Notes');
  win.innerHTML = "<div class='td-fw-head'><b class='td-fw-title'>DM Notes</b>"
    + "<span class='td-gseg td-notes-seg' role='group' aria-label='Which notes'>"
    + "<button type='button' class='td-gb' data-notes='map' aria-pressed='true'></button>"
    + "<button type='button' class='td-gb' data-notes='master' aria-pressed='false'>Master notes</button></span>"
    + "<span class='tbl-gap'></span>"
    + "<button type='button' class='ed2-btn tiny close-x' data-notes='close'>Close &#10005;</button></div>"
    + "<textarea class='td-notes-in' maxlength='" + TD_MAP_NOTES_MOST + "' aria-label='Notes'></textarea>";
  win.addEventListener('click', function(ev){
    var b = ev.target && ev.target.closest ? ev.target.closest('[data-notes]') : null;
    if(!b) return;
    var w = b.getAttribute('data-notes');
    if(w === 'close'){ tdNotesToggle(false); return; }
    if(NOTES.page === w) return;
    NOTES.page = w;
    tdNotesSync();
    var ta = win.querySelector('.td-notes-in');
    if(ta) try{ ta.focus(); }catch(_){}
  });
  win.querySelector('.td-notes-in').addEventListener('input', function(ev){ tdNotesInput(ev.target); });
  var feed = document.getElementById('tdFeed');
  ((feed && feed.parentNode) || document.getElementById('pane-testdeck') || document.body).appendChild(win);
  tdFloatWin(win, 'notes');
  return win;
}
/* After each render (tdGfAfterRender): the window follows the map on the Field, and goes when the DM's tools do. */
function tdNotesSync(){
  var win = document.getElementById('tdNotesWin');
  if(!NOTES.open || !tdNotesHere()){
    if(win){ tdNotesFlush(); win.remove(); }
    tdNotesBtns(false);
    return;
  }
  if(!win) win = tdNotesBuild();
  tdNotesBtns(true);
  var k = tdNotesKeyNow(), want = NOTES.page === 'master' ? 'master' : 'map:' + k;
  if(NOTES.on !== want){
    tdNotesFlush();
    NOTES.on = want;
    NOTES.text = (want === 'master') ? tdNotesMaster() : tdNotesRead(k);
    NOTES.dirty = false;
    tdNotesShow(NOTES.text);
  }
  var mb = win.querySelector("[data-notes='map']"), xb = win.querySelector("[data-notes='master']");
  var label = (TD.board && TD.board.map) || 'This map';
  if(mb.textContent !== label) mb.textContent = label;
  mb.setAttribute('aria-pressed', NOTES.page === 'master' ? 'false' : 'true');
  xb.setAttribute('aria-pressed', NOTES.page === 'master' ? 'true' : 'false');
}
window.tdNotesSync = tdNotesSync;
function tdNotesBtns(on){
  var bs = document.querySelectorAll(".td-gbar [data-gf='notes']");
  for(var i = 0; i < bs.length; i++) bs[i].setAttribute('aria-pressed', on ? 'true' : 'false');
}
function tdNotesToggle(on){
  NOTES.open = (on == null) ? !NOTES.open : !!on;
  if(!NOTES.open) tdNotesFlush();
  tdNotesSync();
  if(NOTES.open){
    var ta = document.querySelector('#tdNotesWin .td-notes-in');
    if(ta) try{ ta.focus(); }catch(_){}
  }
  return NOTES.open;
}
window.tdNotesToggle = tdNotesToggle;
function tdNotesOpen(){ return !!NOTES.open && !!document.getElementById('tdNotesWin'); }
window.tdNotesOpen = tdNotesOpen;
/* the page being typed is not lost to a closing tab */
window.addEventListener('pagehide', function(){ try{ tdNotesFlush(); }catch(_){} });

/* ── The DM's table controls ────────────────────────────────────────────── */
/* On another player's chip, for the DM, who is the table's host (the relay takes both from the host alone): remove them
   for good (Q21), or hand them the role (Q22 B). Handing over moves the host first; once the relay says so, the map and
   the DM's cards on the Field go to the new DM (dmhand), and the DM's decks, drawn cards and DM Grave stay on this
   board, in this browser, as the saved maps do. */
var TD_RB_WAIT = 4000;
var RBH = {hand:null, kick:{}};
function tdRbCtlOn(){
  return tdRbTurnOn() && tdDmMine() && !TBL.watch && typeof tboIsHost === 'function' && tboIsHost();
}
function tdRbChipMenu(seat, x, y){
  var s = (TBL.seats || {})[seat];
  if(!tdRbCtlOn() || !s || !s.id || seat === TD.side) return false;
  var name = s.name || 'Player';
  tdShowMenu(name, [
    {label:'Hand the DM role to ' + name, act:function(){ tdCloseMenu(); tdRbHandOver(seat); }},
    {label:'Remove from the table', act:function(){ tdCloseMenu(); tdRbKick(seat); }}], '', x, y);
  return true;
}
window.tdRbChipMenu = tdRbChipMenu;
function tdRbKick(seat){
  var s = (TBL.seats || {})[seat];
  if(!tdRbCtlOn() || !s || !s.id || seat === TD.side) return false;
  var name = s.name || 'Player', id = s.id;
  if(!confirm('Remove ' + name + ' from this table?\n\nThey will not be able to sit or spectate here again.')) return false;
  if(!tblSend({t:'kick', id:id})) return false;
  if(RBH.kick[id]) clearTimeout(RBH.kick[id]);
  RBH.kick[id] = setTimeout(function(){
    delete RBH.kick[id];
    if(typeof toast === 'function') toast('Could not remove ' + name + ' from the table');
  }, TD_RB_WAIT);
  return true;
}
window.tdRbKick = tdRbKick;
/* The relay's word that they went (a peer gone with kicked, cat_table.js). */
function tdRbKicked(id){
  if(!RBH.kick[id]) return;
  clearTimeout(RBH.kick[id]);
  delete RBH.kick[id];
}
window.tdRbKicked = tdRbKicked;
/* Kept after the wait runs out: the relay's word coming late still finishes the handing over, or the host and the DM would part. */
function tdRbHandOver(seat){
  var s = (TBL.seats || {})[seat];
  if(!tdRbCtlOn() || !s || !s.id || seat === TD.side || (RBH.hand && !RBH.hand.late)) return false;
  var name = s.name || 'Player';
  if(!confirm('Hand the DM role to ' + name + '?')) return false;
  if(!tblSend({t:'sethost', id:s.id})) return false;
  var h = RBH.hand = {id:s.id, name:name, timer:0, late:false};
  h.timer = setTimeout(function(){
    if(RBH.hand !== h) return;
    h.late = true;
    if(typeof toast === 'function') toast('Could not hand the DM role to ' + name);
  }, TD_RB_WAIT);
  return true;
}
window.tdRbHandOver = tdRbHandOver;
/* A host message the relay sent for a DM handing over (by: the old host). True when it was one, for cat_table.js to say no more. */
function tdRbHostMoved(m){
  if(!m.by || !(typeof tdRbOn === 'function' && tdRbOn())) return false;
  if(m.by === TBL.you){
    var h = RBH.hand;
    if(!h) return false;
    RBH.hand = null;
    clearTimeout(h.timer);
    if(m.id === h.id && tdDmMine() && !TBL.watch) tdRbStepDown(h);
    return true;
  }
  /* the new DM's own word comes with the map (tdRbHandFrom) */
  if(m.id === TBL.you) return true;
  var by = tblSideOf(m.by);
  tblFeedAs('them', 'handed the DM role to ' + m.name, by ? tblSeatName(by) : '');
  if(typeof toast === 'function') toast(m.name + ' is the DM now');
  return true;
}
window.tdRbHostMoved = tdRbHostMoved;
/* The map goes first, to the new DM alone; then this board lets go of it, past where Undo can reach. */
function tdRbStepDown(h){
  var b = TD.board, only = b.role === 'dm';
  var m = tdMapNow();
  delete m.notes;
  delete m.held;
  if(m.gtoks) m.gtoks = m.gtoks.filter(function(t){ return !t.me; });
  m.name = b.map || '';
  tblSend({t:'dmhand', map:m, pers:!!b.gpers, to:h.id});
  tdDo({t:'dmrole', role:'', strip:true, mk:String(b.map || '').toLowerCase(), who:h.name});
  tdUndoFloorHere('The DM role has been handed on');
  TD._dmOpen = null;
  tdRender();
  tblSendState();
  tblRenderPanel();
  if(typeof toast === 'function') toast(h.name + ' is the DM now');
  if(only) setTimeout(function(){ tdRbDealInMenu(); }, 0);
}
/* Stepping down takes the map off this board: every DM card on the Field, the grid and its layers, and every token but
   the DM's own, which stays as a player's does, on the map it was on. Taking the role up only sets it (tdRbHandFrom). */
TD_ACT.dmrole = function(b, a){
  if(a.strip){
    var mine = tdGfToks(b).filter(function(t){ return t.me; }).map(function(t){
      var o = JSON.parse(JSON.stringify(t));
      if(a.mk) o.m = a.mk; else delete o.m;
      return o;
    });
    TD_ACT.map(b, {t:'map', name:'', cards:[], toks:[], gtoks:mine});
    delete b.gpers;
  }
  if(a.role === 'dm' || a.role === 'dmp') b.role = a.role; else delete b.role;
  if(a.pers) b.gpers = true;
};
function tdRbRoleWords(a){
  if(a.role === 'dm' || a.role === 'dmp') return 'took over as the DM';
  return a.strip ? 'handed the DM role' + (a.who ? ' to ' + a.who : '') : '';
}
/* The new DM's app: the old DM's map, laid down as a saved map comes down, with this player's own tokens on it kept. */
function tdRbHandFrom(msg, fromId){
  if(TBL.watch || TD.watching || !TD.board || tdDmMine() || !tdTsFromDm(fromId) || !tboIsHost()) return false;
  var raw = tgObj(msg.map) ? msg.map : {}, nm = tdMapName(raw.name), copy = {};
  Object.keys(raw).forEach(function(k){ copy[k] = raw[k]; });
  copy.name = nm || 'map';
  var m = tdMapClean(copy);
  if(!m) return false;
  m.name = nm;
  delete m.notes;
  var key = nm.toLowerCase();
  var mine = tdGfToks(TD.board).filter(function(t){ return (t.m || '') === key; }).map(function(t){
    var o = JSON.parse(JSON.stringify(t));
    delete o.m;
    return o;
  });
  var act = tdMapAct(m);
  act.name = nm;
  act.took = true;
  if(!act.gkeep) act.gtoks = (act.gtoks || []).concat(mine);
  /* the map before the role: still a player, this app sends nothing for the map, and the role's state carries both
     (tdMapHeard) */
  tdDo(act);
  tdDo(msg.pers ? {t:'dmrole', role:'dmp', pers:true} : {t:'dmrole', role:'dmp'});
  tdUndoFloorHere('You took over as the DM');
  if(typeof TBO !== 'undefined') TBO.dmTook = 'dmp';
  tdRender();
  tblSendState();
  /* the turn goes on where it was, this app holding it now */
  var t = tdRbT();
  if(t.who){
    var done = {};
    Object.keys(t.done || {}).forEach(function(k){ if(k !== TD.side) done[k] = 1; });
    TBL.rbt = {who:t.who, n:(t.n || 0) + 1, done:done};
    tdRbTurnSend(false);
    if(t.who === 'pl') tdRbTurnCheck();
    tdRbTurnShow();
  }
  tblRenderPanel();
  if(typeof toast === 'function') toast('You are the DM now');
  return true;
}
window.tdRbHandFrom = tdRbHandFrom;

/* ── Dealing yourself in ────────────────────────────────────────────────── */
/* A corner with nothing in it, as an old DM who played the DM alone has: they deal themselves in from a saved deck
   (Q26 A), keeping their decks, drawn cards and DM Grave (tdDmBuild). */
function tdRbCornerEmpty(b){
  if(!b || !b.zones) return false;
  return Object.keys(b.zones).every(function(z){ return TD_DM_ZONES[z] || !(b.zones[z] || []).length; });
}
function tdRbDealInOn(){
  return tdRbTurnOn() && !TBL.watch && !!TD.board && !TD.watching && !tdRbIsDm(TD.board) && tdRbCornerEmpty(TD.board);
}
function tdRbDealInToolHTML(){
  if(!tdRbDealInOn()) return '';
  return "<button class='ed2-btn tiny tbl-tool tbl-green tbl-keep' id='tdDealInBtn' onclick='tdRbDealInMenu(event)'"
    + " title='Deal yourself in' aria-label='Deal in' aria-haspopup='true'>" + uiIco('deck')
    + "<span class='tbl-tw'>Deal in</span></button>";
}
window.tdRbDealInToolHTML = tdRbDealInToolHTML;
function tdRbDealDecks(){
  var all = (typeof _savedLoad === 'function') ? _savedLoad() : {};
  return Object.keys(all).filter(function(n){
    var v = all[n];
    return !(v && typeof v === 'object' && v.mode && v.mode !== 'character');
  }).sort(function(a, b){ return a.toLowerCase() < b.toLowerCase() ? -1 : 1; });
}
function tdRbDealInMenu(ev){
  if(ev && ev.stopPropagation) ev.stopPropagation();
  if(!tdRbDealInOn()) return false;
  var btn = document.getElementById('tdDealInBtn'), r = btn ? btn.getBoundingClientRect() : null;
  var x = r ? r.left : 40, y = r ? r.bottom + 4 : 80;
  var rows = [{label:'Current deck', act:function(){ tdCloseMenu(); tdRbDealIn(''); }}];
  var names = tdRbDealDecks();
  if(names.length) rows.push({sep:true});
  names.forEach(function(n){ rows.push({label:n, act:function(){ tdCloseMenu(); tdRbDealIn(n); }}); });
  tdCloseMenu();
  tdShowMenu('Deal yourself in', rows, '', x, y);
  var mn = document.getElementById('tdMenu');
  if(mn){
    mn.classList.add('td-mscroll');
    var mr = mn.getBoundingClientRect();
    mn.style.top = Math.max(4, Math.min(y, window.innerHeight - mr.height - 6)) + 'px';
  }
  return true;
}
window.tdRbDealInMenu = tdRbDealInMenu;
/* As the online deal (tboDeal) does it, the deck picked filling Build Deck. */
function tdRbDealIn(pick){
  if(!tdRbDealInOn()) return false;
  var entry = null;
  if(pick){
    entry = _savedLoad()[pick];
    if(!entry) return false;
    if(typeof entry === 'string') entry = {main:entry};
    Object.keys(DECK_IDS).forEach(function(k){
      var el = document.getElementById(DECK_IDS[k]);
      if(el) el.value = entry[k] || '';
    });
  }
  try{ if(typeof setGameMode === 'function' && _gameMode !== 'character') setGameMode('character'); }catch(_){}
  if(entry){
    try{ if(typeof tdWriteStatRow === 'function') tdWriteStatRow(entry); }catch(_){}
    try{ if(typeof tdSyncStatRow === 'function') tdSyncStatRow(); }catch(_){}
  }
  try{ updCnt(); _hashSaveDeck(); refreshDeckView(); }catch(_){}
  if(!tdDeckHasCards()){ if(typeof toast === 'function') toast('That deck has no cards in it'); return false; }
  if(typeof TBO !== 'undefined') TBO.deckPick = pick || '';
  var b = TD.board, keep = {dmDecks:b.dmDecks || null, zones:{}};
  Object.keys(TD_DM_ZONES).forEach(function(z){ keep.zones[z] = ((b.zones && b.zones[z]) || []).slice(); });
  TD._dmDeal = {keep:keep};
  tdStart(true);
  TD._dmDeal = null;
  tblSendState();
  tdFeedPush('me', 'dealt themselves in');
  tblRenderPanel();
  return true;
}
window.tdRbDealIn = tdRbDealIn;
function tdRbKeepOn(board, keep){
  if(keep.dmDecks) board.dmDecks = keep.dmDecks;
  Object.keys(keep.zones || {}).forEach(function(z){
    board.zones[z] = keep.zones[z];
    if(board.counts) board.counts[z] = keep.zones[z].length;
  });
}
window.tdRbKeepOn = tdRbKeepOn;
