/* Nothing that arrives is ever written to TD.board: other players' halves go to TD.foes, and the functions that move cards (TD_ACT) know nothing of the table. */

var TBL = {
  url:'',
  ws:null,
  room:'',
  name:'',
  you:'',
  status:'off',
  note:'',
  peer:null,
  tries:0,
  timer:null,
  unsent:0,
  unsentLost:0,      /* of those, the ones a re-sent board does not repair */
  unsentAt:0,
  onMsg:null
};

var TBL_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';   /* no O/0, no I/1 */
var TBL_KEY = 'conjure_table';
var TBL_SEAT = 'conjure_seat_';
var TBL_SEATKEY = 'conjure_seatkey_';

/* Your seat is part of your board: its side prefixes every piece you mint (tdAdoptSide), so its id and key are kept per room until you leave on purpose (HANDOFF §10). */
function tblSeatGet(room){
  try{ return localStorage.getItem(TBL_SEAT + String(room || '')) || ''; }
  catch(_){ return ''; }
}
function tblSeatSet(room, id){
  try{ localStorage.setItem(TBL_SEAT + String(room || ''), String(id || '')); }catch(_){}
}
function tblSeatKeyGet(room){
  try{ return localStorage.getItem(TBL_SEATKEY + String(room || '')) || ''; }
  catch(_){ return ''; }
}
function tblSeatKeySet(room, key){
  try{ localStorage.setItem(TBL_SEATKEY + String(room || ''), String(key || '')); }catch(_){}
}
function tblSeatForget(room){
  try{ localStorage.removeItem(TBL_SEAT + String(room || ''));
       localStorage.removeItem(TBL_SEATKEY + String(room || '')); }catch(_){}
}

/* The room is remembered beside the saved game, and rejoining after a reload is offered, never done on your behalf. */
function tblSavedTable(){
  var s = (typeof tdSavedGame === 'function') ? tdSavedGame() : null;
  return (s && s.table && s.table.room) ? s.table : null;
}
function tblCanRejoin(){
  if(tblOn() || TBL.status === 'joining') return false;
  var t = tblSavedTable();
  return !!(t && TBL.url && tblSeatGet(t.room));
}
function tblRejoin(){
  var t = tblSavedTable();
  if(!t) return false;
  return tblJoin(t.room, t.name || TBL.name);
}

/* Cards travel by name and resolve against each player's own catalogue, so the opener's fingerprint shows where two sets differ (Sync Cards with Host). */
function tblSetHash(){
  /* The sagas switched on, each as its id and its cards' fingerprint, so a saga switched off does not count; card names until the editor loads. */
  var s = (typeof window.edSagaSummary === 'function') ? window.edSagaSummary() : null;
  if(s && s.length){
    var parts = s.filter(function(x){ return x.on; })
                 .map(function(x){ return x.id + ':' + x.h; }).sort();
    return tdBoardHash({zones:{set:parts}});
  }
  var names = ((window.CARDS || [])).map(function(c){ return c.name; }).sort();
  return tdBoardHash({zones:{set:names}});
}

function tblCode(){
  var s = '', i;
  var r = new Uint8Array(6);
  try{ (window.crypto || {}).getRandomValues(r); }
  catch(_){ for(i = 0; i < 6; i++) r[i] = Math.floor(Math.random() * 256); }
  for(i = 0; i < 6; i++) s += TBL_ALPHABET[r[i] % TBL_ALPHABET.length];
  return s;
}

/* tools/set_relay.py writes this line and finds it by its exact shape: keep it on a line of its own. Empty, the Play Online dialog asks for an address. */
var TBL_DEFAULT_RELAY = 'wss://conjure-relay.playconjure.workers.dev';
var TBL_OWN = 'conjure_table_own';

/* An https:// address, as the deploy prints it, is the same server: wss:// for https:// and ws:// for http://. */
function tblNormUrl(u){
  u = String(u || '').trim().replace(/\/+$/, '').replace(/\/room$/i, '');
  if(!u) return '';
  if(/^https:\/\//i.test(u)) return 'wss://' + u.slice(8);
  if(/^http:\/\//i.test(u)) return 'ws://' + u.slice(7);
  if(/^wss?:\/\//i.test(u)) return u;
  if(/^(localhost|127\.|10\.|192\.168\.|172\.(1[6-9]|2\d|3[01])\.)/i.test(u)) return 'ws://' + u;
  return 'wss://' + u;
}

/* An https page may not open a ws:// socket, and the browser's refusal reads like a typo, so this says why first; localhost is allowed. */
function tblRelayProblem(u, proto){
  if(!u) return 'No relay address set';
  if(!/^wss?:\/\/[^\/\s]+/i.test(u))
    return 'A relay address starts with wss:// (or ws:// on your own network)';
  var https = false;
  try{ https = ((proto || location.protocol) === 'https:'); }catch(_){}
  if(https && /^ws:\/\//i.test(u)
     && !/^ws:\/\/(localhost|127\.0\.0\.1|\[::1\])(:|\/|$)/i.test(u))
    return 'This page is https, so the browser only allows a wss:// relay. '
         + 'A ws:// address from Start-Relay.bat works from a downloaded copy.';
  return '';
}

function tblSaveUrl(u){
  TBL.url = tblNormUrl(u);
  if(TBL_DEFAULT_RELAY){
    /* Only a different relay is remembered, under its own key, so an address typed before the built-in one existed never outranks it. */
    try{
      if(!TBL.url || TBL.url === TBL_DEFAULT_RELAY){
        localStorage.removeItem(TBL_OWN);
        TBL.url = TBL_DEFAULT_RELAY;
      } else localStorage.setItem(TBL_OWN, TBL.url);
    }catch(_){ if(!TBL.url) TBL.url = TBL_DEFAULT_RELAY; }
    return;
  }
  try{ localStorage.setItem(TBL_KEY, TBL.url); }catch(_){}
}
function tblLoadUrl(){
  var own = '', old = '';
  try{
    own = localStorage.getItem(TBL_OWN) || '';
    old = localStorage.getItem(TBL_KEY) || '';
  }catch(_){}
  TBL.url = TBL_DEFAULT_RELAY ? (own || TBL_DEFAULT_RELAY) : old;
  return TBL.url;
}
function tblOnDefault(){
  return !!TBL_DEFAULT_RELAY && (TBL.url || tblLoadUrl()) === TBL_DEFAULT_RELAY;
}


function tblStatus(s, note){
  TBL.status = s;
  TBL.note = note || '';
  tblRenderPanel();
  try{ tdRenderBar(); }catch(_){}
}

function tblJoin(room, name){
  var bad = tblRelayProblem(TBL.url);
  if(bad){ tblStatus('error', bad); return false; }
  room = String(room || '').toUpperCase().replace(/[^A-Z2-9]/g, '').slice(0, 6);
  if(room.length !== 6){ tblStatus('error', 'A room code is six characters'); return false; }
  TBL.room = room;
  TBL.name = String(name || TBL.name || 'Player').slice(0, 40);
  tblOpen();
  return true;
}

function tblOpen(){
  tblClose(true);
  var url = TBL.url.replace(/\/+$/, '') + '/room?r=' + encodeURIComponent(TBL.room);
  tblStatus('joining');
  var ws;
  try{ ws = new WebSocket(url); }
  catch(e){ tblStatus('error', 'That address is not a WebSocket URL'); return; }
  TBL.ws = ws;

  /* The back-off is not reset here: a relay that accepts and then drops the socket would be asked again every second. 'joined' resets it. */
  ws.onopen = function(){
    ws.send(JSON.stringify({t:'join', room:TBL.room, name:TBL.name,
                            seat:(TBL.watch ? '' : tblSeatGet(TBL.room)),
                            key:(TBL.watch ? '' : tblSeatKeyGet(TBL.room)),
                            role:(TBL.watch ? 'watch' : 'play'),
                            seats:(TBL.want || 2),
                            game:(REBIRTH ? 'rebirth' : 'main'),
                            /* Only the opener sends a fingerprint: the relay turns a join away only when both sides send one and they differ. */
                            set:((TBL.hostMeta && !TBL.watch) ? tblSetHash() : ''),
                            table:((!TBL.watch && TBL.hostMeta) || undefined)}));
  };
  ws.onmessage = function(ev){
    var m; try{ m = JSON.parse(ev.data); }catch(_){ return; }
    tblHandle(m);
  };
  ws.onerror = function(){ /* onclose always follows; report there */ };
  ws.onclose = function(ev){
    if(TBL.ws !== ws) return;                 /* superseded by a newer socket */
    TBL.ws = null;
    if(TBL.status === 'off') return;          /* we left on purpose */
    /* The seat was taken up elsewhere (another tab, or a machine with the key): reconnecting would close that socket in turn, so this stops and keeps the seat. */
    if(ev && ev.code === 1000 && ev.reason === 'replaced'){
      if(TBL.timer){ clearTimeout(TBL.timer); TBL.timer = null; }
      TBL.replaced = true;
      tblStatus('error', 'This seat was opened in another tab or window');
      return;
    }
    tblStatus('lost');
    tblRetry();
  };
}

/* Backs off, so a drop never becomes a reconnect loop at full speed; the count restarts only on 'joined' (tblHandle). */
function tblRetry(){
  if(TBL.timer) return;
  var wait = Math.min(30000, 1000 * Math.pow(2, Math.min(5, TBL.tries++)));
  TBL.timer = setTimeout(function(){
    TBL.timer = null;
    if(TBL.status === 'off') return;
    tblOpen();
  }, wait);
}

function tblClose(quiet){
  if(TBL.timer){ clearTimeout(TBL.timer); TBL.timer = null; }
  var ws = TBL.ws; TBL.ws = null;
  if(ws){
    try{ if(ws.readyState === 1) ws.send(JSON.stringify({t:'bye'})); }catch(_){}
    try{ ws.close(); }catch(_){}
  }
  if(!quiet){
    /* Leaving gives the chair up and a drop does not (tblRetry passes quiet); a seat taken up in another tab is kept, as that tab holds it now. */
    if(!TBL.replaced) tblSeatForget(TBL.room);
    if(TBL.watch && TD.watching){
      if(TBL.wasBoard) TD.board = TBL.wasBoard;
      TD.side = TBL.wasSide || 'a';
    }
    TBL.wasBoard = null; TBL.wasSide = '';
    TBL.replaced = false;
    TBL.rematch = null;
    TBL.turn = ''; TBL.turnBy = '';
    TBL.watch = false; TD.watching = false; TBL.watchers = 0; TBL.seats = {};
    TBL.rtt = 0; TBL.rttAt = 0; TBL.seenAt = 0; TBL.beatSent = 0;
    TBL.peer = null; TBL.tries = 0; TBL.back = false;
    /* Cleared directly, not by tblUnsentClear: you left, so no board was re-sent and there is nothing to report. */
    TBL.unsent = 0; TBL.unsentLost = 0; TBL.unsentAt = 0;
    TBL.grants = {};
    TBL.phase = ''; TBL.table = null; TBL.hostId = ''; TBL.watchList = [];
    TBL.hostMeta = null;
    if(typeof TD !== 'undefined') TD.focus = '';
    if(typeof tboReset === 'function') tboReset();
    tblCloseAsk();
    try{ tdFoeClear(); }catch(_){}
    tblStatus('off');
  }
}

/* Turned away is not a drop: a full, other-game or closed table says the same each time, so the table is closed as Leave closes it, its reason kept on the strip. */
function tblTurnedAway(note){
  tblClose(false);
  tblStatus('error', note);
}
function tblReclaim(){
  if(!TBL.room) return false;
  TBL.replaced = false;
  tblOpen();
  return true;
}


function tblHandle(m){
  /* Everything the relay says is checked before it is read (tgRelay here, tgInbound for another player's message, cat_guard.js); a misfit is dropped. */
  m = tgRelay(m);
  if(!m) return;
  if(m.t === 'joined'){
    TBL.you = m.you;
    TBL.tries = 0;
    /* Every accepted join is an arrival: a Leave and a join inside one 400 ms tick never looked off to it, so no opening board crossed (tblRejoinSync). */
    _tblWasOn = false;
    TBL.replaced = false;
    /* A seat given back keeps the turn it knew, as every state says where it went since (tblStateFrom); a new seat has none. */
    if(!m.back){ TBL.turn = ''; TBL.turnBy = ''; }
    if(m.key && !m.watch) tblSeatKeySet(TBL.room, m.key);
    /* Before tblStatus('on') below, which redraws from the phase: read early, a waiting room would draw as a game. */
    var wasPhase = TBL.phase;
    TBL.hostId = m.host || '';
    TBL.phase = m.status || 'playing';
    TBL.table = m.table || null;
    TBL.watchList = (m.watchers || []).slice();
    TBL.watchers = TBL.watchList.length;
    /* Adopted, not merely set: the opening board was minted under the default 'a' before the relay chose this side, so tdAdoptSide re-stamps it. */
    if(m.watch){
      /* A watcher has no side and no half. Its own board is set aside once, so leaving puts it back; a reconnect, holding nothing, must not overwrite it. */
      if(!TD.watching){
        TBL.wasBoard = TD.board;
        TBL.wasSide = TD.side;
      }
      TBL.watch = true;
      TD.watching = true;
      TD.board = null;
      /* '', not tdSetSide's default 'a', or a watcher would take seat a's board as its own and throw it away. */
      TD.side = '';
      TBL.seats = {};
      (m.peers || []).forEach(function(p){
        TBL.seats[p.side] = {id:p.id, name:p.name, side:p.side};
      });
      TBL.peer = (m.peers && m.peers[0]) || null;
      TBL.cap = m.cap || 2;
      tblStatus('on');
      tdRender();
      if(typeof tboOnJoined === 'function') tboOnJoined(m, wasPhase);
      return;
    }
    tdAdoptSide(m.side);
    tblSeatSet(TBL.room, m.you);
    /* Every seat, not just TBL.peer: the feed, the turn marker and every arriving message are named from this map. */
    TBL.seats = {};
    TBL.seats[m.side] = {id:m.you, name:TBL.name, side:m.side};
    (m.peers || []).forEach(function(p){
      TBL.seats[p.side] = {id:p.id, name:p.name, side:p.side};
    });
    TBL.cap = m.cap || 2;
    TBL.peer = ((m.peers || []).length === 1) ? m.peers[0] : null;
    TBL.back = !!m.back;
    tblStatus('on');
    if(m.back && typeof toast === 'function') toast('Back at the table');
    if(typeof tboOnJoined === 'function') tboOnJoined(m, wasPhase);
    return;
  }
  if(m.t === 'full'){
    var n = m.cap || 2;
    var word = ['', '', 'two', 'three', 'four'][n] || String(n);
    tblTurnedAway('That table already has ' + word + ' players');
    return;
  }
  if(m.t === 'mismatch'){
    tblTurnedAway(m.why === 'game'
      ? ('That table is playing ' + (m.theirs === 'rebirth' ? 'Conjure Rebirth'
          : 'the main game') + ' — switch games and try again')
      : 'You are not on the same card set — one of you needs to sync before playing');
    return;
  }
  if(m.t === 'nospect'){
    tblTurnedAway('That table does not allow spectators');
    return;
  }
  /* The game starts when the relay says so, for everyone at once, the host included. */
  if(m.t === 'started'){
    TBL.phase = 'playing';
    if(typeof tboOnStarted === 'function') tboOnStarted(m);
    tblRenderPanel();
    return;
  }
  if(m.t === 'meta'){
    TBL.table = m.table || TBL.table;
    tblRenderPanel();
    return;
  }
  if(m.t === 'host'){
    TBL.hostId = m.id || '';
    if(typeof drOnHost === 'function') drOnHost(m);
    if(typeof toast === 'function')
      toast(m.id === TBL.you ? 'You are the host now' : (m.name + ' is the host now'));
    tblRenderPanel();
    return;
  }
  if(m.t === 'peer'){
    /* A watcher is not an opponent: it must not replace TBL.peer, and its leaving must not clear a half (tdFoeClear); it is only counted and listed. */
    if(m.watch){
      TBL.watchers = Math.max(0, (TBL.watchers || 0) + (m.join ? 1 : -1));
      TBL.watchList = (TBL.watchList || []).filter(function(w){ return w.id !== m.id; });
      if(m.join) TBL.watchList.push({id:m.id, name:m.name});
      if(typeof tboOnPeer === 'function') tboOnPeer(m);
      if(typeof toast === 'function')
        toast(m.name + (m.join ? ' is spectating' : ' stopped spectating'));
      tblStatus(TBL.status === 'on' ? 'on' : TBL.status);
      return;
    }
    if(m.join){
      tblSeatLearn(m.side, m.id, m.name);
      if(typeof toast === 'function') toast(m.name + ' joined the table');
    } else {
      if(TBL.seats) delete TBL.seats[m.side];
      if(typeof TD !== 'undefined' && TD.focus === m.side) TD.focus = '';
      try{ tdFoeClear(m.side); }catch(_){}
      if(TBL.turn === m.side) tblTurnTake('', '');
      if(typeof toast === 'function') toast(m.name + ' left the table');
      tblRematchLeft(m.side);
    }
    var others = Object.keys(TBL.seats || {}).filter(function(s){
      return s !== TD.side;
    });
    TBL.peer = (others.length === 1)
      ? TBL.seats[others[0]] : null;
    if(typeof tboOnPeer === 'function') tboOnPeer(m);
    tblStatus(TBL.status === 'on' ? 'on' : TBL.status);
    return;
  }
  if(m.t === 'from'){
    /* TBL.lastFrom and TBL.gotCount are read by the checks (checktable.js). */
    /* A relay from before `to` sends such a message to everyone, so one meant for another seat (a draft pack, say) is dropped here. */
    if(m.msg && typeof m.msg.to === 'string' && m.msg.to && TBL.you && m.msg.to !== TBL.you) return;
    /* Only the checked copy (tgInbound) reaches TBL.onMsg, never the message as it arrived. */
    var clean = tgInbound(m.msg, m.id);
    if(!clean) return;
    TBL.lastFrom = clean;
    TBL.gotCount = (TBL.gotCount || 0) + 1;
    if(typeof TBL.onMsg === 'function'){
      /* Rethrown on its own, so the next message is still read and the browser still reports the error. */
      try{ TBL.onMsg(clean, m.id); }catch(e){ setTimeout(function(){ throw e; }, 0); }
    }
    return;
  }
}

/* Messages that cost nothing to lose (the next replaces it, or the rejoin poll re-sends it): counting them would warn on every wifi hiccup. */
var TBL_CHEAP = {beat:1, beatback:1, ptr:1, ping:1, arrow:1, arrows:1, want:1};

/* What a reconnect repairs by itself: the rejoin snapshot carries the board and the turn. Anything else lost is gone. */
var TBL_RESENT = {act:1, turn:1};

/* tblOn() stays true from the moment the socket dies until onclose, so a move in that gap went nowhere unseen: tblSend counts it here, once. */
function tblDropped(msg){
  var t = (msg && msg.t) || '';
  if(TBL_CHEAP[t]) return;
  /* A snapshot is the repair, not the damage: its retry would otherwise add one to the warning every 400 ms. */
  if(t === 'state') return;
  var first = !TBL.unsent;
  TBL.unsent = (TBL.unsent || 0) + 1;
  if(!TBL_RESENT[t]) TBL.unsentLost = (TBL.unsentLost || 0) + 1;
  TBL.unsentAt = Date.now();
  if(first && typeof toast === 'function')
    toast('Not sent — you are not connected to the table');
  tblRenderPanel();
}

/* Cleared when a snapshot lands, not when the socket returns, or the warning would go before the board was repaired. */
function tblUnsentClear(){
  if(!TBL.unsent) return;
  var lost = TBL.unsentLost || 0;
  TBL.unsent = 0; TBL.unsentLost = 0; TBL.unsentAt = 0;
  tblRenderPanel();
  if(typeof toast === 'function')
    toast(lost
      ? 'Your board was re-sent, but ' + lost + (lost === 1 ? ' message' : ' messages')
        + ' never arrived'
      : 'Your board was re-sent');
}

function tblUnsentWords(){
  var n = TBL.unsent || 0;
  if(!n) return '';
  return n + (n === 1 ? ' thing' : ' things') + ' not sent';
}

function tblSend(msg){
  if(!TBL.ws || TBL.ws.readyState !== 1){ tblDropped(msg); return false; }
  try{ TBL.ws.send(JSON.stringify(msg)); return true; }
  catch(_){ tblDropped(msg); return false; }
}

function tblOn(){ return TBL.status === 'on'; }


var TBL_STATUS_TEXT = {
  off:'Not at a Table', joining:'Connecting…', on:'At the Table',
  lost:'Reconnecting…', error:'Cannot Connect'
};

function tblRenderPanel(){
  /* Before the early return: the header button, the Play Online dialog and the chat panel exist where the strip's host does not. */
  try{ tblSyncHeaderBtn(); }catch(_){}
  try{ if(typeof tboSync === 'function') tboSync(); }catch(_){}
  var left = document.getElementById('tdTblLeft');
  if(!left) return;
  var P = tblTopParts();
  left.innerHTML = P.left;
  var tools = document.getElementById('tdTblTools');
  if(tools) tools.innerHTML = P.tools;
  var end = document.getElementById('tdTblEnd');
  if(end) end.innerHTML = P.end;
  /* not inside tdRenderBar (_tdInBar), which fits the row itself */
  if(typeof tdTopRowFit === 'function' && !(typeof _tdInBar !== 'undefined' && _tdInBar)) tdTopRowFit();
}
function tblDiscordPart(){
  return (typeof tboDiscordHTML === 'function') ? tboDiscordHTML('board') : '';
}
/* No d6, d20 or coin here: the Dice Tray beside the Field has every die and the coin (HANDOFF §76.3). */
function tblTopParts(){
  var s = TBL.status;
  var at = (s === 'on');
  var log = (typeof tdLogBtnHTML === 'function') ? tdLogBtnHTML() : '';
  var unsent = TBL.unsent ? "<span class='tbl-unsent' title='"
          + e('These did not reach the table. Your board is re-sent as soon as'
              + ' you are back on.') + "'>" + uiIco('warn') + " " + e(tblUnsentWords())
          + "</span>" : '';
  var note = TBL.note ? "<span class='tbl-note'>" + e(TBL.note) + "</span>" : '';
  var leave = tblToolHTML('leave', "tblLeaveAsk()", 'Leave', 0, false, 'tbl-red tbl-keep', 'Leave the table');
  if(!at){
    return {
      left: "<span class='tbl-dot tbl-" + e(s) + "'></span>"
        + "<span class='tbl-state'>" + e(TBL_STATUS_TEXT[s] || s) + "</span>"
        + ((s === 'joining' || s === 'lost') && TBL.room
            ? "<span class='tbl-code'>" + e(TBL.room) + "</span>" + tblDiscordPart() : '')
        + note
        /* outside every status guard: it is for the window where the socket is already gone */
        + unsent
        + (s === 'joining' || s === 'lost' ? ''
            : (s === 'error' && TBL.replaced && TBL.room)
              ? "<button class='ed2-btn tiny tbl-tool primary' onclick='tblReclaim()'"
                + " title='" + e('Take this seat back here - the other tab or window lets it go') + "'>"
                + uiIco('return') + " Back to table " + e(TBL.room) + "</button>"
            : ((tblCanRejoin()
                ? "<button class='ed2-btn tiny tbl-tool primary' onclick='tblRejoin()'"
                  + " title='" + e('Go back to table '
                      + (tblSavedTable() || {}).room + " — you keep the side you were on")
                  + "'>" + uiIco('return') + " Back to table "
                  + e((tblSavedTable() || {}).room || '') + "</button>"
                : '')
              + "<button class='ed2-btn tiny tbl-tool" + (tblCanRejoin() ? '' : ' primary')
              + "' onclick='tblOpenSetup()'>Play Online</button>")),
      tools: log,
      end: (s === 'joining' || s === 'lost' || (s === 'error' && TBL.note)) ? leave
        : tblToolHTML('leave', "tblLeaveSolo()", 'Leave', 0, false, 'tbl-red tbl-keep',
                      'Back to Build Deck - this game is kept for when you come back')
    };
  }
  var waiting = (TBL.phase === 'waiting');
  var link = [tblLinkWords(), tblQuietWords()].filter(Boolean).join(' · ');
  return {
    left: "<span class='tbl-dot tbl-on'></span>"
      + "<span class='tbl-code' title='Read this out to whoever is joining you'>"
      +   e(TBL.room) + "</span>"
      + tblDiscordPart()
      + (waiting ? "<span class='tbl-state'>Waiting Room</span>" : '')
      + tblChipsHTML()
      + (typeof tdMapChipHTML === 'function' ? tdMapChipHTML() : '')
      + ((typeof TD !== 'undefined' && TD.focus)
          ? tblToolHTML('focus', "tdStopFocus()", 'Stop Focusing', 0, false, 'tbl-keep tbl-unfocus',
                        'Show the whole table again')
          : '')
      + (TBL.watch ? "<span class='tbl-who'><span class='tbl-watching spect-ink'>Spectating</span></span>" : '')
      + (tblWaiting() ? "<span class='tbl-peer tbl-wait'>" + e(tblGapWords()) + "</span>" : '')
      + (waiting ? '' : tblTurnHTML())
      + note + unsent
      + (TBL.watchers ? "<span class='tbl-watchers spect-ink'>" + TBL.watchers + ' spectating' + "</span>" : '')
      + (link ? "<span class='tbl-link" + (tblStale() ? ' bad' : '') + "'"
          + " title='How long a move takes to reach the others'>&#9679; " + e(link) + "</span>" : ''),
    tools: waiting
      ? "<button class='ed2-btn tiny tbl-tool primary' onclick='tblOpenSetup()'>Open room</button>"
      : ((typeof tbsToolHTML === 'function' ? tbsToolHTML() : '')
        + (TBL.watch ? '' : tblToolHTML('arrows', "tblArrowsClear()", 'Clear arrows'))
        + tblToolHTML('chat', "tboChatToggle()", 'Chat',
            (typeof TBO !== 'undefined' && TBO.unread) ? TBO.unread : 0,
            typeof TBO !== 'undefined' && TBO.chatOpen)
        + log
        + (TBL.watch ? '' : tblToolHTML('again', "tblRematchAsk()", 'Play again', 0, false, 'tbl-purple'))),
    end: leave
  };
}

function tblChipsHTML(){
  var seats = TBL.seats || {};
  var rb = (typeof tdRbOn === 'function' && tdRbOn());
  return TD_SEATS.filter(function(k){ return !!seats[k]; }).map(function(k){
    var me = (!TBL.watch && k === TD.side);
    var foe = me ? null : tdFoeOf(k);
    var ctr = (foe && foe.counters) || {};
    var life = (ctr.life != null) ? ctr.life : (ctr.hp != null ? ctr.hp : null);
    var lifeWord = (ctr.life != null) ? 'Life' : 'HP';
    var hand = (foe && foe.zones && foe.zones.hand) ? foe.zones.hand.length : null;
    return "<span class='tbl-chip" + (TBL.turn === k ? ' turn' : '') + (me ? ' me' : '')
      + ((typeof TD !== 'undefined' && TD.focus === k) ? ' focus' : '')
      + "' data-seat='" + k + "'" + (rb ? '' : " title='" + e('Right-click to Focus on this board') + "'") + ">"
      + ((rb && typeof tdGfChipIconHTML === 'function') ? tdGfChipIconHTML(k, me)
         : "<span class='tbl-s tbl-seat-" + k + "'></span>")
      + "<b>" + e(seats[k].name || 'Player') + "</b>"
      + (me ? "<span class='tbl-you'>(you)</span>" : '')
      + (rb ? (foe ? tdRbChipStatsHTML(foe) : (me && typeof tdDmChipMine === 'function' ? tdDmChipMine() : ''))
         : ((life != null ? "<span class='tbl-cs'>" + lifeWord + " <b>" + e(String(life)) + "</b></span>" : '')
           + (hand != null ? "<span class='tbl-cs'>Hand <b>" + hand + "</b></span>" : '')))
      + "</span>";
  }).join('');
}
function tblGapWords(){
  var gap = (TBL.cap || 2) - tblSeated().length;
  if(gap <= 0) return '';
  return gap === 1 ? 'waiting for one more' : ('waiting for ' + gap + ' more');
}

var TBL_ICONS = {
  d6:"<rect x='3' y='3' width='18' height='18' rx='3'/><circle cx='8' cy='8' r='1.4' fill='currentColor'/><circle cx='16' cy='16' r='1.4' fill='currentColor'/><circle cx='12' cy='12' r='1.4' fill='currentColor'/>",
  d20:"<path d='M12 2l9 5v10l-9 5-9-5V7z'/><path d='M12 2v20M3 7l18 10M21 7L3 17'/>",
  coin:"<circle cx='12' cy='12' r='9'/><circle cx='12' cy='12' r='5'/>",
  arrows:"<path d='M5 19L19 5M13 5h6v6'/>",
  leave:"<path d='M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4'/><path d='M16 17l5-5-5-5M21 12H9'/>",
  turn:"<path d='M5 12h14M13 6l6 6-6 6'/>",
  chat:"<path d='M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z'/>",
  again:"<path d='M3 12a9 9 0 1 0 3-6.7L3 8'/><path d='M3 3v5h5'/>",
  focus:"<path d='M3 8V5a2 2 0 0 1 2-2h3M16 3h3a2 2 0 0 1 2 2v3M21 16v3a2 2 0 0 1-2 2h-3M8 21H5a2 2 0 0 1-2-2v-3'/><circle cx='12' cy='12' r='3'/>",
  sync:"<path d='M21 12a9 9 0 0 1-15.5 6.2L3 16'/><path d='M3 21v-5h5'/><path d='M3 12a9 9 0 0 1 15.5-6.2L21 8'/><path d='M21 3v5h-5'/>"
};
function tblToolHTML(icon, act, word, badge, on, cls, title){
  /* the word in its own span, so a row short of room can show the icon alone; the title keeps the word on hover */
  return "<button class='ed2-btn tiny tbl-tool" + (on ? ' on' : '') + (cls ? ' ' + cls : '') + "' onclick='" + act + "'"
    + " title='" + e(title || word) + "'"
    + " aria-label='" + e(word + (badge ? ' (' + badge + ')' : '')) + "'>"
    + "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'"
    + " stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'>"
    + TBL_ICONS[icon] + "</svg><span class='tbl-tw'>" + e(word) + "</span>"
    + (badge ? "<span class='tbl-badge'>" + badge + "</span>" : '')
    + "</button>";
}

function tblLeave(){ tblClose(false); }
/* The Leave a person presses asks first, as a stray click gave a game up; tblLeave stays the plain act, for code and checks. */
function tblLeaveAsk(){
  var turnedAway = (TBL.status === 'error');
  if(!turnedAway && typeof confirm === 'function' && !confirm('Leave the table?')) return false;
  tblLeave();
  try{ tblCloseSetup(); }catch(_){}
  try{ showTab('deck'); }catch(_){}
  return true;
}
function tblLeaveSolo(){
  try{ showTab('deck'); }catch(_){}
  return true;
}

/* Changes tab first: the top row with the room code is in #pane-testdeck, hidden until you are on it. At a table, this is the way back to it. */
window.tblPlayOnline = function(){
  try{ showTab('testdeck'); }catch(_){}
  if(tblOn() && TBL.phase !== 'waiting'){ tblSyncHeaderBtn(); return; }
  tblOpenSetup();
  setTimeout(function(){
    var r = document.getElementById('tblRoom');
    if(r) r.focus();
  }, 0);
};
/* Outside everything tblRenderPanel rebuilds, so its lit state is set by hand. */
function tblSyncHeaderBtn(){
  var b = document.getElementById('btnOnline');
  if(!b) return;
  var at = tblOn();
  b.classList.toggle('on', at);
  b.title = at
    ? ('At table ' + (TBL.room || '') + ' - go to the board')
    : 'Play with someone else - join a table or start one';
}
window.tblSyncHeaderBtn = tblSyncHeaderBtn;

/* Filled with the address in use; empty only when no relay is built in (TBL_DEFAULT_RELAY, written by tools/set_relay.py). */
function tblRelayAddrHTML(){
  var shown = TBL.url || TBL_DEFAULT_RELAY || '';
  return "<label class='tbl-f tbl-urlrow'><span>Relay address</span>"
    + "<input id='tblUrl' onchange='tboRelayChanged()' value='" + e(shown) + "'"
    + " placeholder='" + (TBL_DEFAULT_RELAY ? 'ws://192.168.1.24:8790'
                                            : 'wss://conjure-relay.example.workers.dev')
    + "'></label>";
}
function tblRelayLineHTML(){
  if(!TBL_DEFAULT_RELAY) return '';
  var own = !tblOnDefault();
  return "<div class='tbl-relay' id='tblRelayLine'>"
      + (own
          ? "<span class='tbl-relay-dot own'></span><span>Using your own relay</span>"
            + "<button class='ed2-btn tiny' onclick='tblRelayUseDefault()'"
            + " title='Go back to the relay built into Conjure'>Use Conjure&#39;s relay</button>"
          : "<button class='ed2-btn tiny' id='tblRelayOther' onclick='tblRelayOther()'"
            + " title='A relay on your own network, from Start-Relay.bat'>Change relay</button>")
    + "</div>";
}
/* No paragraph on what a relay is: the app is not the manual, ONLINE PLAY.md is (HANDOFF §12.1 E). */
function tblRelayBoxHTML(){
  var own = !TBL_DEFAULT_RELAY || !tblOnDefault();
  return "<div id='tblUrlBox' class='tbl-urlbox'" + (own ? '' : ' hidden') + ">"
      + tblRelayAddrHTML()
      + "<span class='tbl-lstat' id='tblRelayStat'></span>"
    + "</div>";
}
function tblRelayOther(){
  var b = document.getElementById('tblUrlBox');
  if(b) b.hidden = false;
  var o = document.getElementById('tblRelayOther');
  if(o) o.style.display = 'none';      /* .ed2-btn's display outranks [hidden] */
  var u = document.getElementById('tblUrl');
  if(u) u.focus();
  if(typeof tboLobbyRender === 'function') tboLobbyRender();
}
function tblRelayUseDefault(){
  tblSaveUrl('');
  var line = document.getElementById('tblRelayLine');
  var box = document.getElementById('tblUrlBox');
  var tmp = document.createElement('div');
  if(line){ tmp.innerHTML = tblRelayLineHTML(); if(tmp.children[0]) line.replaceWith(tmp.children[0]); }
  if(box){ tmp.innerHTML = tblRelayBoxHTML(); if(tmp.children[0]) box.replaceWith(tmp.children[0]); }
  if(typeof tboRelayChanged === 'function') tboRelayChanged();
}
/* Only the address loads at start: nothing connects until you ask. */
(function(){ tblLoadUrl(); })();

/* Redacted once, at the sender: a hidden card's identity never leaves this machine, which is why a hidden zone crosses as a number. */

/* The zones nobody else sees into; a deck's order matters too, or Search would be a formality. The dm* three are a Rebirth DM's. */
var TBL_HIDDEN = {hand:1, deck:1, essdeck:1, wish:1, dmdeck:1, dmrow:1, dmgrave:1};
/* A Rebirth Armament ('gear') is hidden while its Hand is; showing or hiding the Hand sends a snapshot (tblGearFollow). */
function tblHiddenZone(z){
  if(z === 'gear') return !tblGearOpen();
  return !!TBL_HIDDEN[z];
}
function tblGearOpen(){
  if(!REBIRTH || !TD.board) return true;
  var g = TBL.grants && TBL.grants.hand;
  return tdZShowIn(TD.board, 'hand') === 'all' || !!(g && g.scope !== 'top');
}
function tblGearFollow(zone){
  if(REBIRTH && zone === 'hand' && TD.board && TD.board.zones.gear) tblSendState();
}

function tblCount(zone){
  var z = TD.board && TD.board.zones[zone];
  return {t:'count', zone:zone, n:(z ? z.length : 0)};
}

/* One action in, the messages out. before is the card's zone before the move, which has already happened here. */
function tblRedact(a, before){
  if(!a) return [];
  var out = [];
  /* a DM's decks and maps travel in the DM's next state, never as actions (cat_rbdm.js) */
  if(a.t === 'dmdeck' || a.t === 'map') return [];
  if(a.t === 'give') return before === 'field' ? [{t:'vanish', uid:a.uid}] : [];
  if(a.t === 'ungift') return tblHiddenZone(before) ? [tblCount(before)] : [{t:'vanish', uid:a.uid}];

  /* Crystallize names a Hand card and an Essence the other machine knows only as placeholders, so it goes as two moves:
     each card named as it comes out of the dark, then the hidden zones' new counts (HANDOFF §61.5). */
  if(a.t === 'crystal'){
    var cr = [], cAt = tdFind(a.uid), eAt = tdFind(a.essUid);
    if(cAt && cAt.zone === 'susp'){
      if(tblHiddenZone(before)){
        cr.push({t:'appear', zone:'susp', uid:a.uid, n:(cAt.item.card ? cAt.item.card.name : ''),
                 fx:'crystal', color:a.color});
        cr.push(tblCount(before));
      } else cr.push({t:'move', uid:a.uid, to:'susp', fx:'crystal', color:a.color});
    }
    if(eAt && eAt.zone === 'essarea'){
      cr.push({t:'appear', zone:'essarea', uid:a.essUid, n:(eAt.item.card ? eAt.item.card.name : ''),
               x:a.ex, y:a.ey, fx:'crystal', from:a.uid});
      cr.push(tblCount('essdeck'));
    }
    return cr;
  }

  if(a.t === 'move'){
    var fromHidden = tblHiddenZone(before);
    var toHidden = tblHiddenZone(a.to);
    if(fromHidden && toHidden){
      if(before !== a.to) out.push(tblCount(before));
      out.push(tblCount(a.to));
    } else if(fromHidden){
      var at = tdFind(a.uid);
      if(at){
        var ap = {t:'appear', zone:a.to, uid:a.uid, x:a.x, y:a.y, at:a.at,
                  locked:!!at.item.locked};
        if(at.item.dm) ap.dm = true;
        if(at.item.down){ ap.anon = true; ap.down = true; }
        else {
          ap.n = at.item.card ? at.item.card.name : '';
          if(at.item.lab) ap.lab = at.item.lab;
        }
        out.push(ap);
      }
      out.push(tblCount(before));
    } else if(toHidden){
      out.push({t:'vanish', uid:a.uid});
      out.push(tblCount(a.to));
    } else {
      out.push(a);
    }
    return out;
  }


  if(a.t === 'order') return tblHiddenZone(a.zone) ? [] : [a];

  if(a.t === 'spawn'){
    if(tblHiddenZone(a.zone)) return [tblCount(a.zone)];
    return [a];
  }
  /* Redacted as spawn is, though copies only go to public zones today: the fall-through below would send the name into a hidden one. */
  if(a.t === 'mkcopy'){
    if(tblHiddenZone(a.zone)) return [tblCount(a.zone)];
    return [a];
  }
  if(a.t === 'lock' || a.t === 'connect'){
    var w = tdFind(a.uid);
    return (w && !tblHiddenZone(w.zone)) ? [a] : [];
  }

  /* Face down sends no name (anon drops theirs); face up adds it, the moment they are entitled to it. */
  if(a.t === 'face'){
    var f = tdFind(a.uid);
    if(!f || tblHiddenZone(f.zone)) return [];
    if(a.down) return [{t:'face', uid:a.uid, down:true, anon:true}];
    var up = {t:'face', uid:a.uid, down:false, n:(f.item.card ? f.item.card.name : '')};
    if(f.item.lab) up.lab = f.item.lab;
    return [up];
  }
  if(a.t === 'lockZone') return tblHiddenZone(a.zone) ? [] : [a];
  if(a.t === 'label'){
    var lw = tdFind(a.uid);
    return (lw && !tblHiddenZone(lw.zone) && !lw.item.down) ? [a] : [];
  }
  /* A reveal is not forwarded: on their side it would find only placeholders; tblPushShown sends the contents. */
  if(a.t === 'reveal' || a.t === 'zshow') return [];

  return [a];
}

function tblOnAction(a, before){
  /* Not in the waiting room: every board is dealt fresh when the game begins. */
  if(!tblOn() || TBL.phase === 'waiting') return;
  var msgs = tblRedact(a, before).filter(function(m){
    return !(m && m.t === 'count' && typeof TD_DM_ZONES !== 'undefined' && TD_DM_ZONES[m.zone]);
  });
  for(var i = 0; i < msgs.length; i++)
    tblSend(TBL._by ? {t:'act', a:msgs[i], by:TBL._by} : {t:'act', a:msgs[i]});
  /* A grant is live: a zone you are showing is pushed again after any change to it. */
  var zones = tblLiveZones();
  var all = (a.t === 'reveal' || a.t === 'zshow' || a.t === 'order');
  for(var j = 0; j < zones.length; j++){
    var z = zones[j];
    if(all || a.zone === z || a.to === z || before === z) tblPushShown(z);
  }
  TBL.since = (TBL.since || 0) + 1;
  /* a full snapshot every 25 actions, for a reconnect or a late spectator to start from */
  if(TBL.since >= 25) tblSendState();
  else if(a.t === 'zshow') tblGearFollow(a.zone);
  if(a.t === 'phase') tblRenderPanel();
}

function tblRedactedState(){
  var d = tdSerialize();
  if(!d) return null;
  Object.keys(d.zones).forEach(function(z){
    if(tblHiddenZone(z)){
      d.zones[z] = d.zones[z].map(function(_, i){
        return {uid:'anon\u00b7' + z + '\u00b7' + i, anon:true};
      });
      return;
    }
    /* A face-down card in a public zone loses its name here, as a hand does: a snapshot carrying it would put it in their memory. */
    d.zones[z] = d.zones[z].map(function(o){
      if(!o.down) return o;
      var a = {};
      Object.keys(o).forEach(function(k){ if(k !== 'n' && k !== 'lab') a[k] = o[k]; });
      a.anon = true;
      return a;
    });
  });
  Object.keys(d.zones).forEach(function(z){
    if(typeof TD_DM_ZONES !== 'undefined' && TD_DM_ZONES[z]){ d.zones[z] = []; return; }
    d.zones[z].forEach(function(o){ delete o.dk; });
  });
  delete d.dmDecks;
  d.name = TBL.name;
  return d;
}
function tblSendState(){
  if(!tblOn() || TBL.phase === 'waiting') return false;
  TBL.since = 0;
  /* The turn travels with the board, or a reconnect or a new watcher heard nobody held it mid-turn. */
  var sent = tblSend({t:'state', board:tblRedactedState(), turn:TBL.turn || ''});
  /* Then whatever you are showing, again: the snapshot replaces your half on their side whole, shown zones included. */
  if(sent) tblLiveZones().forEach(tblPushShown);
  return sent;
}


/* Which half a message is from comes only from who sent it: the relay stamps each with its socket's id, and the seat map turns that into a seat. */
function tblSideOf(fromId){
  var seats = TBL.seats || {};
  if(!fromId) return '';
  for(var i = 0; i < TD_SEATS.length; i++){
    var k = TD_SEATS[i];
    if(seats[k] && seats[k].id === fromId) return k;
  }
  return '';
}
function tblSeatName(side){
  var s = (TBL.seats || {})[side];
  return (s && s.name) || (TBL.peer && TBL.peer.name) || 'They';
}
function tblSeatLearn(side, fromId, name){
  if(!side) return;
  if(!TBL.seats) TBL.seats = {};
  var was = TBL.seats[side] || {};
  TBL.seats[side] = {id:fromId || was.id, name:name || was.name || 'Player',
                     side:side};
}
function tblMySeat(){
  if(TBL.watch || !TBL.you || !TBL.seats) return '';
  var s = TBL.seats[TD.side];
  return (s && s.id === TBL.you) ? TD.side : '';
}

/* Always the sender's own half, by their id, whatever the board says: a state never writes over another half or seats anybody (HANDOFF §10). */
function tblStateFrom(msg, fromId){
  var side = tblSideOf(fromId);
  if(!side || side === TD.side) return;
  var name = (msg.board && msg.board.name) || '';
  if(name) tblSeatLearn(side, fromId, name);
  tblTurnFromState(msg.turn, side);
  var _was = tdFoeOf(side);
  tdFoeSet(msg.board, name || tblSeatName(side), side);
  if(typeof tdMapHeard === 'function') tdMapHeard(side, _was);
  if(typeof tdGfCatchUp === 'function') tdGfCatchUp(side);
  tdRender();
  tblRenderPanel();
}

/* Only its holder hands the turn on and a free one is taken only for oneself, here as in tblPass; turnBy is the seat that last moved it. */
function tblTurnTake(side, by){
  TBL.turn = side;
  TBL.turnBy = by || '';
}
function tblTurnAccept(side, from){
  if(!from || !side || !(TBL.seats || {})[side]) return false;
  if(tblTurnFree() ? side !== from : TBL.turn !== from) return false;
  tblTurnTake(side, from);
  return true;
}
/* A state moves the turn only where a turn message could: a free turn to anyone but you, or the sender's own turn onward,
   but not back to whoever just passed it to them, as a state sent before the pass still names them. */
function tblTurnFromState(t, from){
  if(!t || !from || t === TBL.turn || !(TBL.seats || {})[t]) return false;
  var mine = !TBL.watch && t === TD.side;
  if(tblTurnFree()){
    if(mine) return false;
    tblTurnTake(t, from);
  } else if(TBL.turn === from && t !== TBL.turnBy){
    tblTurnTake(t, from);
    if(mine && typeof tdTurnArrived === 'function'){ try{ tdTurnArrived(); }catch(_){} }
  } else return false;
  tblRenderPanel();
  if(typeof tdRenderTurn === 'function') tdRenderTurn();
  return true;
}

/* Signs the line only if tdFeedPush wrote a new one, and folds a draw only into the same player's: signing the last line put names on others' lines. */
function tblFeedAs(who, line, name){
  if(!line) return false;
  var last = TD.feed[TD.feed.length - 1];
  if(line === 'drew a card' && last && last.drew && last.who === (who || '')
     && (last.name || '') !== (name || '')) last.drew = 0;
  tdFeedPush(who, line);
  var now = TD.feed[TD.feed.length - 1];
  if(now && now !== last && name && now.who !== 'me') now.name = name;
  tdRenderFeed();
  return now !== last;
}

/* Applied to the sender's half, never to yours (HANDOFF §10). */
function tblActFrom(a, fromId, by){
  var side = tblSideOf(fromId);
  if(!side || side === TD.side) return;
  var half = tdFoeOf(side);
  if(!half){
    /* No board from them yet: ask for their state rather than drift from here on. */
    tblSend({t:'want'});
    return;
  }
  /* read before the action is applied: afterwards the card has already moved */
  var was = null, wasName = null;
  if(a.uid){
    var at = tdFindIn(half, a.uid);
    if(at){ was = at.zone; wasName = at.item.card ? at.item.card.name : null; }
  }
  if(typeof tdFxBefore === 'function') tdFxBefore(half, a, was);
  tdApplyTo(half, a);
  if(typeof tdFxAction === 'function') tdFxAction(half, a, was);
  var line = tdActionWords(a, half, was, wasName);
  var byOther = !!(by && by !== side && TBL.seats && TBL.seats[by]);
  var byMe = byOther && by === TD.side && !TBL.watch;
  if(byOther && line){
    line += ' (' + tblSeatName(side) + "'s)";
    if(byMe) tdFeedPush('me', line); else tblFeedAs('them', line, tblSeatName(by));
  } else tblFeedAs('them', line, tblSeatName(side));
  if(a.uid && !byMe){ tdMarkTheirMove(a.uid, tblSeatName(byOther ? by : side)); tdMovedTick(); }
  tdRenderSoon();
  /* Life and hand size are on their chip in the strip. */
  if(a.t === 'count' || a.t === 'ctr' || a.t === 'ctrReset' || a.zone === 'hand'
     || a.to === 'hand' || a.t === 'vanish' || a.t === 'appear'
     || a.t === 'phase' || a.t === 'pass' || a.t === 'gicon') tblRenderPanel();
  if(typeof tdGfHeard === 'function') tdGfHeard(side, a);
}

TBL.onMsg = function(msg, fromId){
  if(!msg) return;
  /* Anything at all counts as them being there, or reading a card would look idle. */
  tblTouched();
  /* answered to the asker alone, or at a table of three another player's answer is timed against its clock */
  if(msg.t === 'beat'){ tblSend({t:'beatback', at:msg.at, to:fromId}); return; }
  if(msg.t === 'beatback'){
    /* Their clock is not consulted: msg.at is OUR timestamp, handed back. */
    TBL.rtt = Math.max(0, Date.now() - (+msg.at || Date.now()));
    TBL.rttAt = Date.now();
    TBL.beatSent = 0;
    tblRenderPanel();
    return;
  }
  if(typeof drOnMsg === 'function' && drOnMsg(msg, fromId)) return;
  /* These sit above the watcher's branch below: a spectator learns what everybody does. */
  if(typeof tbsOnMsg === 'function' && tbsOnMsg(msg, fromId)) return;
  if(typeof tdGfOnMsg === 'function' && tdGfOnMsg(msg, fromId)) return;
  if(msg.t === 'seat'){
    if(typeof tboSeatFrom === 'function') tboSeatFrom(msg, fromId);
    return;
  }
  if(msg.t === 'discord'){
    if(typeof tboDiscordFrom === 'function') tboDiscordFrom(msg, fromId);
    return;
  }
  if(msg.t === 'say' && typeof tboChatSay === 'function') tboChatSay(msg.text, fromId);
  /* A watcher is a player with no half: every branch routes by seat, and a watcher's is ''; what it may send is the relay's rule. */
  if(TBL.watch){
    if(msg.t === 'state'){ tblStateFrom(msg, fromId); return; }
    if(msg.t === 'act'){ tblActFrom(msg.a, fromId, msg.by); return; }
    if(msg.t === 'say'){ tdFeedPush('say', msg.text); tdRenderFeed(); return; }
    if(msg.t === 'roll'){ tblRollFrom(msg, true, fromId); return; }
    if(msg.t === 'turn'){
      if(tblTurnAccept(msg.side, tblSideOf(fromId))) tblRenderPanel();
      return;
    }
    return;
  }
  if(msg.t === 'state'){
    /* Replaces the seat's half whole: it is the recovery path, not something to reconcile with half-applied actions. */
    tblStateFrom(msg, fromId);
    return;
  }
  if(msg.t === 'fld'){ if(typeof tdRbFieldReq === 'function') tdRbFieldReq(msg, fromId); return; }
  if(msg.t === 'gift'){ if(typeof tdDmGiftFrom === 'function') tdDmGiftFrom(msg, fromId); return; }
  if(msg.t === 'ungift'){ if(typeof tdDmUngiftFrom === 'function') tdDmUngiftFrom(msg, fromId); return; }
  if(msg.t === 'arrow'){ tblArrowAdd(msg.a.from, msg.a.to, msg.a.by, msg.a.id); return; }
  if(msg.t === 'arrows'){
    TBL.arrows = (msg.clear === 'all') ? []
      : TBL.arrows.filter(function(a){ return a.by !== msg.clear; });
    tdRenderArrows();
    return;
  }
  if(msg.t === 'ptr'){
    var _ps = tblSideOf(fromId);
    if(!_ps) return;
    if(!TBL.ptrs) TBL.ptrs = {};
    TBL.ptrs[_ps] = {seat:msg.seat, zone:msg.zone, fx:msg.fx, fy:msg.fy,
                     uid:msg.uid, ux:msg.ux, uy:msg.uy, rx:msg.rx, ry:msg.ry,
                     off:!!msg.off, at:Date.now()};
    tdRenderPointer();
    return;
  }
  if(msg.t === 'ping'){
    tblFlash(msg.uid);
    tblFeedAs('them', 'pointed at '
      + tdCardWords(msg.uid, tdFoeOf(tdUidSide(msg.uid)) || TD.board), tblFromName(fromId));
    return;
  }
  if(msg.t === 'roll'){ tblRollFrom(msg, false, fromId);
    if(typeof toast === 'function') toast(tblFromName(fromId) + ' ' + msg.line); return; }
  if(msg.t === 'turn'){
    var _from = tblSideOf(fromId), _was = TBL.turn;
    if(!tblTurnAccept(msg.side, _from)) return;
    tblRenderPanel();
    tblFeedAs('them', msg.side === TD.side ? 'passed the turn to you'
      : (msg.side === _from ? 'took the turn' : ('passed the turn to ' + tblSeatName(msg.side))),
      tblFromName(fromId));
    /* once, when the turn really moves to you, not for every message saying it is yours */
    if(msg.side === TD.side && _was !== TD.side && typeof tdTurnArrived === 'function') tdTurnArrived();
    else if(typeof tdRenderTurn === 'function') tdRenderTurn();
    return; }
  if(msg.t === 'say'){ tblFeedAs('say', msg.text, tblFromName(fromId)); return; }
  if(msg.t === 'rematch'){
    var _rs = tblSideOf(fromId);
    if(!_rs) return;
    if(msg.ask){
      /* Merged: two people asking at once are two yeses for one new game. */
      if(!TBL.rematch) TBL.rematch = {by:_rs, yes:{}};
      TBL.rematch.yes[_rs] = 1;
      if(TBL.rematch.yes[TD.side] && !TBL.watch){ tblRematchVote(_rs); return; }
      tblRematchPrompt(_rs);
      return;
    }
    if(msg.yes){
      if(!TBL.rematch) TBL.rematch = {by:_rs, yes:{}};
      if(typeof toast === 'function' && tblSeated().length > 2) toast(tblFromName(fromId) + ' is in');
      tblRematchVote(_rs);
      return;
    }
    TBL.rematch = null;
    tblCloseRematchAsk();
    tblFeedAs('them', 'would rather not start again yet', tblFromName(fromId));
    if(typeof toast === 'function')
      toast(tblFromName(fromId) + ' declined a rematch');
    return;
  }

  if(msg.t === 'act'){ tblActFrom(msg.a, fromId, msg.by); return; }
  if(msg.t === 'want'){
    if(typeof tboSendSeat === 'function') tboSendSeat();
    if(typeof drOnWant === 'function') drOnWant(fromId);
    tblSendState();
    tblLiveZones().forEach(tblPushShown);
    return;
  }
  if(msg.t === 'ask'){ tblAskPrompt(msg, fromId); return; }
  if(msg.t === 'deny'){
    tblFeed(tblFromName(fromId) + ' declined to show their '
      + tblZoneLabel(msg.zone));
    return;
  }
  if(msg.t === 'shown'){
    var shSide = tblSideOf(fromId);
    var them = tdFoeOf(shSide);
    if(!them) return;
    if(!them.revealed) them.revealed = {};
    var newly = !them.revealed[msg.zone];
    them.revealed[msg.zone] = true;
    var named = (msg.cards || []).map(function(c){
      var card = tdCardByName(c.n);
      if(!card){
        if(them.missing.indexOf(c.n) < 0) them.missing.push(c.n);
        return {uid:c.uid, anon:true};
      }
      var sh = {uid:c.uid, card:card, locked:false};
      if(c.lab) sh.lab = c.lab;
      return sh;
    });
    /* never more pieces than tgInbound allows a zone */
    var total = Math.min(500, (msg.total == null) ? named.length : (+msg.total || 0));
    var rest = [];
    for(var i = named.length; i < total; i++)
      rest.push({uid:'anon\u00b7' + msg.zone + '\u00b7' + i, anon:true});
    /* the rest under what was shown: the top of a zone is the end of the array */
    them.zones[msg.zone] = rest.concat(named);
    /* not for a Rebirth hand, shown unless hidden, or every hand would be announced as the game began */
    if(newly && !(REBIRTH && msg.zone === 'hand')) tblFeed(tblSeatName(shSide) + ' is showing their '
      + tblZoneLabel(msg.zone));
    tdRenderSoon();
    return;
  }
  if(msg.t === 'unshown'){
    var unSide = tblSideOf(fromId);
    var un = tdFoeOf(unSide);
    if(!un || !un.revealed) return;
    delete un.revealed[msg.zone];
    /* Strips the identities rather than stop drawing them: hidden means never held, not held and not drawn. */
    var was = un.zones[msg.zone] || [];
    un.zones[msg.zone] = was.map(function(_, i){
      return {uid:'anon\u00b7' + msg.zone + '\u00b7' + i, anon:true};
    });
    tblFeed(tblSeatName(unSide) + ' stopped showing their '
      + tblZoneLabel(msg.zone));
    tdRenderSoon();
    return;
  }
};

/* Its own function, not the interval's body, so a check can call it rather than wait 400 ms. */
function tblRejoinSync(){
  var sent = (TBL.watch || TBL.phase === 'waiting') ? true : tblSendState();
  /* Both, always - the 'want' is not skipped because the state failed. */
  if(!tblSend({t:'want'})) sent = false;
  /* only once the snapshot went: the socket can die again between 'joined' and this tick */
  if(sent) tblUnsentClear();
  return sent;
}
var _tblWasOn = false;
setInterval(function(){
  var on = tblOn();
  /* again on later ticks while anything is outstanding, as the first try can fall in the same gap */
  if(on && (!_tblWasOn || TBL.unsent)) tblRejoinSync();
  _tblWasOn = on;
}, 400);

/* A grant, offered or asked and allowed, is state in TBL.grants: a shown zone stays shown as cards move, survives a reconnect and can be revoked. */

TBL.grants = {};

function tblShowing(zone){ return !!TBL.grants[zone]; }

/* 'top' counts from the end of the array, where tdDraw pops. */
/* Merges TBL.grants (the table's ask-and-show) with the board's standing reveals (the game's, saved with it): either saying all means all. */
function tblGranted(zone){
  if(!TD.board) return null;
  var g = TBL.grants[zone];
  var z = TD.board.zones[zone] || [];
  var mode = (typeof tdZShow === 'function') ? tdZShow(zone) : '';
  var wantAll = (g && g.scope !== 'top') || mode === 'all';
  var topN = 0;
  if(g && g.scope === 'top') topN = Math.max(topN, g.n || 1);
  if(mode === 'top') topN = Math.max(topN, 1);
  var list = wantAll ? z.slice()
           : (topN ? z.slice(Math.max(0, z.length - topN)) : []);
  z.forEach(function(it){ if(it.shown && list.indexOf(it) < 0) list.push(it); });
  /* null, not []: nothing to send is not an empty list (tblPushShown) */
  if(!wantAll && !list.length) return null;
  return list.map(function(it){
    var o = {uid:it.uid, n:it.card ? it.card.name : ''};
    if(it.lab && !it.down) o.lab = it.lab;
    return o;
  });
}

function tblLiveZones(){
  var out = {};
  Object.keys(TBL.grants).forEach(function(z){ out[z] = 1; });
  Object.keys(TBL.pushed || {}).forEach(function(z){ out[z] = 1; });
  if(TD.board){
    Object.keys(TD.board.zshow || {}).forEach(function(z){ out[z] = 1; });
    Object.keys(TD.board.zones).forEach(function(z){
      if((TD.board.zones[z] || []).some(function(it){ return it.shown; })) out[z] = 1;
    });
  }
  return Object.keys(out);
}

/* What was pushed is remembered, so a zone no longer open gets an explicit unshown rather than leaving its cards in their copy. */
TBL.pushed = TBL.pushed || {};
function tblPushShown(zone){
  if(!tblOn()) return false;
  var cards = tblGranted(zone);
  if(!cards){
    if(!TBL.pushed[zone]) return false;
    delete TBL.pushed[zone];
    return tblSend({t:'unshown', zone:zone});
  }
  TBL.pushed[zone] = 1;
  return tblSend({t:'shown', zone:zone, cards:cards,
                  total:(TD.board.zones[zone] || []).length});
}

function tblGrant(zone, scope, n, sticky){
  TBL.grants[zone] = {scope:scope || 'all', n:n || 0, sticky:sticky !== false};
  tblPushShown(zone);
  tblGearFollow(zone);
  tblFeed('You are showing your ' + tblZoneLabel(zone));
  tdRender();
}
function tblUngrant(zone){
  if(!TBL.grants[zone]) return;
  delete TBL.grants[zone];
  tblSend({t:'unshown', zone:zone});
  tblGearFollow(zone);
  tblFeed('You stopped showing your ' + tblZoneLabel(zone));
  tdRender();
}
function tblZoneLabel(zone){
  var z = (typeof tdZoneById === 'function') && tdZoneById(zone);
  return (z && z.label) ? z.label : zone;
}


function tblAsk(zone, scope, n){
  if(!tblOn()) return;
  tblSend({t:'ask', zone:zone, scope:scope || 'all', n:n || 0});
  tblFeed('You asked to see their ' + tblZoneLabel(zone));
}

/* data-* text read back by tblAskClick, never an onclick: the zone, scope and count came from another machine (HANDOFF §12.1). */
function tblAskOverlay(kind, label){
  var ov = document.getElementById('tblAskOv');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'tblAskOv'; ov.className = 'td-ov';
    ov.addEventListener('click', tblAskClick);
    document.body.appendChild(ov);
  }
  ov.setAttribute('data-kind', kind);
  ov.setAttribute('role', 'dialog');
  ov.setAttribute('aria-modal', 'true');
  ov.setAttribute('aria-label', label);
  return ov;
}
function tblAskClick(ev){
  var b = ev.target && ev.target.closest ? ev.target.closest('button[data-act]') : null;
  if(!b) return;
  var act = b.getAttribute('data-act');
  var zone = b.getAttribute('data-zone') || '';
  if(act === 'allow'){
    if(typeof tgZone === 'function' && !tgZone(zone)){ tblCloseAsk(); return; }
    tblAllow(zone, b.getAttribute('data-scope') === 'top' ? 'top' : 'all',
             Math.max(0, Math.min(60, parseInt(b.getAttribute('data-n'), 10) || 0)));
  }
  else if(act === 'deny') tblDeny(zone);
  else if(act === 'again') tblRematchYes();
  else if(act === 'notnow') tblRematchNo();
}
function tblAskPrompt(m, fromId){
  var what = (m.scope === 'top')
    ? ('the top ' + m.n + ' of your ' + tblZoneLabel(m.zone))
    : ('your ' + tblZoneLabel(m.zone));
  var head = tblFromName(fromId) + ' asked to see ' + what;
  var ov = tblAskOverlay('ask', head);
  ov.innerHTML = "<div class='ed2-modal tbl-ask'>"
    + "<div class='ed2-modal-head wh'><b class='wh-t'>" + e(head) + "</b></div>"
    + "<div class='ed2-modal-body tbl-askbody'>"
      + "<div class='tbl-askrow'>"
        + "<button class='ed2-btn primary' data-act='allow' data-zone='" + e(m.zone) + "'"
          + " data-scope='" + (m.scope === 'top' ? 'top' : 'all') + "'"
          + " data-n='" + Math.max(0, Math.min(60, +m.n || 0)) + "'>Allow</button>"
        + "<button class='ed2-btn' data-act='deny' data-zone='" + e(m.zone) + "'>Decline</button>"
      + "</div>"
    + "</div></div>";
}
/* A rematch is proposed and accepted, never done to somebody: nothing resets until every other seated player says yes, and declining says so. */
function tblRematchAsk(){
  var others = tblSeated().filter(function(s){ return s !== TD.side; });
  if(!tblOn() || TBL.watch || !others.length){
    if(typeof toast === 'function') toast('Nobody to play again with');
    return false;
  }
  /* Asking while another ask is open is a yes to it: the yeses given are kept. */
  if(!TBL.rematch) TBL.rematch = {by:TD.side, yes:{}};
  tblCloseRematchAsk();
  tblSend({t:'rematch', ask:true});
  tdFeedPush('me', 'asked for another game');
  var names = others.map(tblSeatName);
  if(typeof toast === 'function') toast('Asked ' + (names.length > 1
    ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0])
    + ' for another game');
  tblRematchVote(TD.side);
  return true;
}
function tblRematchVote(side){
  if(!TBL.rematch || !side) return;
  TBL.rematch.yes[side] = 1;
  var seated = tblSeated();
  if(seated.length && seated.every(function(s){ return TBL.rematch.yes[s]; })){
    TBL.rematch = null;
    tblCloseAsk();
    tblRematchGo();
  }
}
function tblRematchPrompt(fromSide){
  var head = (fromSide ? tblSeatName(fromSide) : ((TBL.peer && TBL.peer.name) || 'They'))
    + ' wants another game';
  var ov = tblAskOverlay('rematch', head);
  ov.innerHTML = "<div class='ed2-modal tbl-ask'>"
    + "<div class='ed2-modal-head wh'><b class='wh-t'>" + e(head) + "</b></div>"
      + (tblSeated().length > 2 ? "<div class='tbl-asknote'>It starts when everyone has said yes.</div>" : '')
    + "<div class='ed2-modal-body tbl-askbody'>"
      + "<div class='tbl-askrow'>"
        + "<button class='ed2-btn primary' data-act='again'>Play again</button>"
        + "<button class='ed2-btn tbl-no' data-act='notnow'>Not now</button>"
      + "</div>"
    + "</div></div>";
}
function tblRematchLeft(side){
  var r = TBL.rematch;
  if(!r || !side) return;
  delete r.yes[side];
  if(r.by === side){ TBL.rematch = null; tblCloseRematchAsk(); return; }
  var seated = tblSeated();
  if(seated.length > 1 && seated.every(function(s){ return r.yes[s]; })){
    TBL.rematch = null;
    tblCloseAsk();
    tblRematchGo();
  }
}
function tblRematchGo(){
  tblArrowsClear();
  tblTurnTake('', '');
  TBL.grants = {};
  tdStart(true);              /* deliberate: this replaces the saved game */
  tblSendState();
  tdFeedPush('me', '— new game —');
  tblRenderPanel();
}
function tblRematchYes(){
  tblCloseAsk();
  tblSend({t:'rematch', yes:true});
  if(!TBL.rematch) TBL.rematch = {by:'', yes:{}};
  tblRematchVote(TD.side);
}
function tblRematchNo(){
  tblCloseAsk();
  TBL.rematch = null;
  tblSend({t:'rematch', no:true});
}

function tblCloseAsk(){
  var ov = document.getElementById('tblAskOv');
  if(ov) ov.remove();
}
function tblCloseRematchAsk(){
  var ov = document.getElementById('tblAskOv');
  if(ov && ov.getAttribute('data-kind') === 'rematch') ov.remove();
}
function tblAllow(zone, scope, n){
  tblCloseAsk();
  tblGrant(zone, scope, n, true);
}
function tblDeny(zone){
  tblCloseAsk();
  tblSend({t:'deny', zone:zone});
  tblFeed('You declined to show your ' + tblZoneLabel(zone));
}


function tblShowMenu(zone, ev){
  if(ev){ try{ ev.stopPropagation(); }catch(_){} }
  if(typeof tdShowMenu !== 'function') return;
  var rows = [];
  if(tblShowing(zone)){
    rows.push({label:'Stop showing', act:"tblUngrant('" + zone + "')",
               hint:'take it back'});
  } else {
    rows.push({label:'Show all of it', act:"tblGrant('" + zone + "','all',0,true)"});
    if(zone !== 'hand'){
      rows.push({label:'Show the top 1', act:"tblGrant('" + zone + "','top',1,true)"});
      rows.push({label:'Show the top 3', act:"tblGrant('" + zone + "','top',3,true)"});
    }
  }
  var r = ev && ev.target ? ev.target.getBoundingClientRect() : {left:200, bottom:200};
  tdShowMenu('Your ' + tblZoneLabel(zone), rows, '', r.left, r.bottom + 4);
}
function tblAskMenu(zone, ev){
  if(ev){ try{ ev.stopPropagation(); }catch(_){} }
  if(typeof tdShowMenu !== 'function') return;
  var rows = [{label:'Ask to see all of it', act:"tblAsk('" + zone + "','all',0)"}];
  if(zone !== 'hand'){
    rows.push({label:'Ask to see the top 1', act:"tblAsk('" + zone + "','top',1)"});
    rows.push({label:'Ask to see the top 3', act:"tblAsk('" + zone + "','top',3)"});
  }
  var r = ev && ev.target ? ev.target.getBoundingClientRect() : {left:200, bottom:200};
  tdShowMenu('Their ' + tblZoneLabel(zone), rows, '', r.left, r.bottom + 4);
}

/* The reveal lines, kept (the last 500) for the checks; the Record Log is TD.feed, not this. */
TBL.feed = [];
function tblFeed(line){
  TBL.feed.push({at:TBL.feed.length, line:String(line)});
  if(TBL.feed.length > 500) TBL.feed.shift();
  if(typeof toast === 'function') toast(line);
}


/* The link (a measured round trip) and the other player (time since they did anything) are separate: a quiet opponent is not a broken link.
   The beat is slow on purpose: the relay is billed by the message, and 6 s costs a sixth of a one-second ping. */
var TBL_BEAT_MS = 6000;
TBL.rtt = 0;              /* milliseconds, last measured */
TBL.rttAt = 0;
TBL.seenAt = 0;
TBL.beatSent = 0;

function tblTouched(){ TBL.seenAt = Date.now(); }

/* Not TBL.peer, which is null at a table of three or four. */
function tblHasOthers(){
  var s = TBL.seats || {};
  return Object.keys(s).some(function(k){ return s[k] && k !== TD.side; });
}
function tblQuietFor(){
  if(!tblOn() || !tblHasOthers() || !TBL.seenAt) return 0;
  return Date.now() - TBL.seenAt;
}
function tblQuietWords(){
  var ms = tblQuietFor();
  if(ms < 45000) return '';
  var m = Math.floor(ms / 60000);
  if(m < 1) return 'quiet for a moment';
  if(m < 60) return 'quiet for ' + m + ' min';
  return 'quiet for over an hour';
}
/* after two and a half missed beats, so one slow round trip raises no warning */
function tblStale(){
  return !!(tblOn() && TBL.beatSent && Date.now() - TBL.beatSent > TBL_BEAT_MS * 2.5);
}
/* A spectator has no round trip: the relay drops all it sends but say and want, so its beat is never answered. */
function tblLinkWords(){
  if(!tblOn() || TBL.watch || !tblHasOthers()) return '';
  if(tblStale()) return 'not answering';
  /* rttAt, not rtt, says it was measured: two copies on one machine answer inside a millisecond. */
  if(!TBL.rttAt) return '';
  return (TBL.rtt || '<1') + ' ms';
}

/* The beatback carries our own timestamp back to us alone, so the round trip is timed on one clock. */
function tblBeat(){
  if(!tblOn() || TBL.watch || !tblHasOthers()) return false;
  if(!TBL.beatSent) TBL.beatSent = Date.now();
  return tblSend({t:'beat', at:Date.now()});
}
setInterval(function(){
  if(!tblOn() || TBL.watch || !tblHasOthers()) return;
  tblBeat();
  if(typeof tbsSend === 'function') tbsSend(false);
  tblRenderPanel();
}, TBL_BEAT_MS);

/* Arrows are stored by uid, so they follow the cards; each lasts TD_ARROW_MS from when it arrived here (at). */
TBL.arrows = [];

function tblArrowAdd(from, to, by, id){
  if(!from || !to || from === to) return null;
  var a = {id:id || ('ar' + (++TD.seq)), from:from, to:to, by:by || TD.side,
           at:Date.now()};
  TBL.arrows.push(a);
  if(!id) tblSend({t:'arrow', a:a});
  tdRenderArrows();
  return a;
}
function tblArrowsClear(mineOnly){
  TBL.arrows = mineOnly
    ? TBL.arrows.filter(function(a){ return a.by !== TD.side; })
    : [];
  tblSend({t:'arrows', clear:mineOnly ? TD.side : 'all'});
  tdRenderArrows();
}

/* One pointer message per 60 ms at most: a mousemove stream is sixty a second, most saying nothing new. */
TBL.peerPtr = null;
TBL.ptrs = {};
var _tblPtrAt = 0;
/* Sent as what is under the pointer (seat, zone, card, fractions of each), never pixels: each screen lays the table out its own way (HANDOFF §76.9). */
function tblPointerMove(ev){
  if(!tblOn() || TBL.watch) return;
  var now = Date.now();
  /* The last move inside the 60 ms is kept and sent after (tblPointerLast), or a cursor that stopped would sit where the last message caught it. */
  if(now - _tblPtrAt < 60){
    _tblPtrLast = {clientX:ev.clientX, clientY:ev.clientY};
    if(!_tblPtrT) _tblPtrT = setTimeout(tblPointerLast, Math.max(1, 61 - (now - _tblPtrAt)));
    return;
  }
  _tblPtrLast = null;
  _tblPtrAt = now;
  var at = (typeof tdPointerAt === 'function') ? tdPointerAt(ev.clientX, ev.clientY) : null;
  if(!at){ tblPointerOff(); return; }
  _tblPtrOff = false;
  at.t = 'ptr';
  if(typeof tdGfPtrExtra === 'function') tdGfPtrExtra(at);
  tblSend(at);
}
var _tblPtrOff = true;
var _tblPtrLast = null, _tblPtrT = 0;
function tblPointerLast(){
  _tblPtrT = 0;
  var l = _tblPtrLast;
  _tblPtrLast = null;
  if(l) tblPointerMove(l);
}
function tblPointerOff(){
  clearTimeout(_tblPtrT); _tblPtrT = 0; _tblPtrLast = null;
  if(_tblPtrOff || !tblOn() || TBL.watch) return;
  _tblPtrOff = true;
  tblSend({t:'ptr', off:true});
}

function tblPing(uid){
  if(typeof tdCloseMenu === 'function') tdCloseMenu();
  tblSend({t:'ping', uid:uid});
  tblFlash(uid);
  tdFeedPush('me', 'pointed at ' + tdCardWords(uid, TD.board));
}
/* through tdFlashCard, so a redraw in the next 1.4 s keeps the flash */
function tblFlash(uid){
  tdFlashCard(uid);
}

/* Rolled once, by one player, and the result travels: a message saying "roll a d6" would be two private rolls. */
/* Nothing in the app calls this (the tray uses tblShareRoll); tools/verify/checktable.js does. */
function tblRoll(sides){
  var got = 1 + Math.floor(Math.random() * Math.max(2, sides | 0));
  var line = 'rolled a d' + sides + ' — ' + got;
  tblSend({t:'roll', line:line});
  tdFeedPush('me', line);
  if(typeof tboChatSys === 'function') tboChatSys((TBL.name || 'You') + ' ' + line);
  if(typeof toast === 'function') toast('d' + sides + ': ' + got);
  return got;
}
/* Only at a table: 'off' and 'error' send and count nothing, 'lost' goes through tblSend and is counted; a watcher's roll stays local, as the relay drops it.
   tray lets the other side throw the same dice; an older client reads only line, and a bare line from one is read here. */
function tblShareRoll(line, tray){
  if(!TBL.status || TBL.status === 'off' || TBL.status === 'error') return false;
  if(TBL.watch) return false;
  return tblSend({t:'roll', line:line, tray:tray || null});
}
function tblRollFrom(msg, watching, fromId){
  tblFeedAs('them', msg.line, watching ? '' : tblFromName(fromId));
  if(typeof tboChatSys === 'function')
    tboChatSys(tblSeatName(tblSideOf(fromId)) + ' ' + msg.line);
  if(msg.tray && typeof window.tdDiceReplay === 'function'){
    try{ window.tdDiceReplay(msg.tray, tblFromName(fromId)); }catch(_){}
  }
}

/* One turn marker, enforced: only its holder passes it, and it is taken only while free (tblPass; HANDOFF §76.7). Cards are not turn-locked. */
TBL.turn = null;          /* a seat, 'a' to 'd' - null or '' while nobody holds it */
TBL.turnBy = '';
/* In seat order, so a pass at a table of four reaches the next chair; an empty chair is stepped over. */
function tblSeated(){
  return TD_SEATS.filter(function(s){ return !!(TBL.seats || {})[s]; });
}
function tblNextSide(from){
  var order = tblSeated();
  if(!order.length) return TD.side;
  var i = order.indexOf(from);
  if(i < 0) return order[0];
  return order[(i + 1) % order.length];
}
function tblPass(){
  /* The button is not offered otherwise, but the Space key and other callers reach here too. */
  if(TBL.watch) return;
  var free = tblTurnFree();
  if(!free && TBL.turn !== TD.side) return;
  if(!free && typeof tdDmPicksTurn === 'function' && tdDmPicksTurn()){
    tdDmPickTurn(function(s){
      if(TBL.turn !== TD.side) return;
      if(typeof tdEndTurnHere === 'function'){ try{ tdEndTurnHere(); }catch(_){} }
      tblHandOn(false, s);
    });
    return;
  }
  if(!free && typeof tdEndTurnHere === 'function'){ try{ tdEndTurnHere(); }catch(_){} }
  tblHandOn(free);
}
/* tdNewTurn calls this directly, after the tracker has started the next turn. */
/* to: the seat a Rebirth DM picked (tdDmPickTurn) */
function tblHandOn(free, to){
  if(TBL.watch) return;
  if(free == null) free = tblTurnFree();
  tblTurnTake(free ? TD.side : ((to && (TBL.seats || {})[to]) ? to : tblNextSide(TBL.turn)), TD.side);
  tblSend({t:'turn', side:TBL.turn});
  tdFeedPush('me', TBL.turn === TD.side ? 'took the turn'
    : ('passed the turn to ' + tblSeatName(TBL.turn)));
  tblRenderPanel();
  if(typeof tdRenderTurn === 'function') tdRenderTurn();
}
function tblSay(text){
  text = String(text || '').trim().slice(0, 300);
  if(!text) return;
  tblSend({t:'say', text:text});
  tblFeedAs('say', text, TBL.name || 'You');
  if(typeof tboChatMine === 'function') tboChatMine(text);
}
function tblSayKey(ev){
  if(!ev || ev.key !== 'Enter') return;
  ev.preventDefault();
  tblSay(ev.target.value);
  ev.target.value = '';
}

function tblFromName(fromId){
  var s = fromId ? tblSideOf(fromId) : '';
  if(s) return tblSeatName(s);
  return (TBL.peer && TBL.peer.name) || 'They';
}

function tblSeatNames(){
  var s = TBL.seats || {};
  return TD_SEATS.filter(function(k){ return s[k] && k !== TD.side; })
    .map(function(k){ return s[k].name; });
}
function tblWaiting(){
  return tblSeated().length < (TBL.cap || 2);
}

function tblPhaseHTML(){
  if(!TBL.turn || typeof tdTurnOf !== 'function') return '';
  var b = (TBL.turn === TD.side && !TBL.watch) ? TD.board : tdFoeOf(TBL.turn);
  if(!b || !b.turn) return '';
  var t = tdTurnOf(b), st = tdStepDef(t.step), ph = st.phases[t.phase];
  return "<span class='tbl-phase'>" + e(st.label + ' step' + (ph ? ' \u00b7 ' + ph.label : ''))
    + "</span>";
}
/* Hiding the button is not what stops anyone: tblPass refuses them too. */
function tblTurnHTML(){
  if(TBL.watch){
    var s = TBL.seats || {};
    var n = TBL.turn && s[TBL.turn] ? s[TBL.turn].name : '';
    return "<span class='tbl-turn'>&#9654; "
      + e(n ? (n + "'s turn") : 'Nobody has taken the turn') + "</span>"
      + tblPhaseHTML();
  }
  var mine = (TBL.turn === TD.side);
  var who = !TBL.turn ? 'Nobody has taken the turn'
    : (mine ? 'Your turn' : (tblSeatName(TBL.turn) + "'s turn"));
  var next = tblNextSide(TBL.turn || TD.side);
  var many = tblSeated().length > 2;
  /* Take Turn only while the turn is free: taking it mid-turn was passing somebody's turn for them (HANDOFF §76.7). */
  var dmPick = mine && typeof tdDmPicksTurn === 'function' && tdDmPicksTurn();
  var btn = mine
    ? tblToolHTML('turn', 'tblPass()', dmPick ? 'Pass to…' : (many ? ('Pass to ' + tblSeatName(next)) : 'Pass'),
                  0, false, 'tbl-green tbl-keep', dmPick ? 'Choose who gets the turn' : ('Hand the turn to ' + tblSeatName(next)))
    : (tblTurnFree()
        ? tblToolHTML('turn', 'tblPass()', 'Take turn', 0, false, 'tbl-green tbl-keep', 'Take the turn')
        : '');
  return "<span class='tbl-turn" + (mine ? ' mine' : '') + "'>&#9654; " + e(who) + "</span>"
    + tblPhaseHTML() + btn;
}
function tblTurnFree(){
  return !TBL.turn || !(TBL.seats || {})[TBL.turn];
}
