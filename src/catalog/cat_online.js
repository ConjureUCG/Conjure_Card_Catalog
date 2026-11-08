/* cat_draft.js and cat_draftui.js load after this file: their functions can be called from here, but their vars are undefined while its top-level code runs. */

var TBO = {
  view:'hub',
  lobby:null,
  lobbyUrl:'',
  lobbyState:'off',
  lobbyTries:0,
  lobbyTimer:null,
  lobbyAt:0,
  tables:[],
  online:0,
  /* Every size a table can have (tboSeatsMost): a size not ticked here is a table nobody is shown. */
  filters:{fmt:{}, size:{2:1, 3:1, 4:1, 5:1, 6:1}, open:1, playing:1},
  sort:'new',
  host:{seats:2, pub:true, name:'', note:'', format:'', spect:true, strict:true, deck:'',
        mode:'game', ddeck:'', dtype:'standard', dtimer:0,
        dm:'dm', dmList:''},
  deckPick:'',         /* '' = the deck on the Build Deck page, else a saved deck's name */
  ready:false,
  seatInfo:{},
  seenJoin:'',
  chat:[],
  unread:0,
  chatOpen:false,
  prefill:'',
  discord:'',
  discordLast:'',
  /* the chat window's To picker at a Rebirth table: a seat's id, '' for everyone (tboSayToHTML) */
  sayTo:'',
  sayToName:'',
  /* a player handed the DM's role takes it as DM and player (tdRbHandFrom, cat_rbplay.js) */
  dmTook:'',
  tick:null
};
var TBO_HOST_KEY = 'conjure_host_opts';
var TBO_NAME_KEY = 'conjure_table_name';
var TBO_DISCORD_KEY = 'conjure_table_discord';

function tboGame(){ return REBIRTH ? 'rebirth' : 'main'; }
function tboFmtOk(k){ return DECK_TYPES.indexOf(k) >= 0; }
function tboFmtLabel(k){
  var gm = (typeof GAME_MODES !== 'undefined') && GAME_MODES[k];
  return gm ? gm.label : (k === 'none' ? 'None' : String(k || ''));
}
/* A Rebirth table has no format to name: Rebirth has only the one. */
function tboTableLabel(t){
  if(REBIRTH) return '';
  if(t && t.mode === 'draft')
    return 'Draft \u00b7 ' + (tboDTypeKnown(t.dtype) ? DRAFT_TYPES[t.dtype].short : 'Default');
  return tboFmtLabel(t && t.format);
}
function tboLabelBit(t){
  var l = tboTableLabel(t);
  return l ? ' &middot; <b>' + e(l) + '</b>' : '';
}
function tboDTypeKnown(k){
  return typeof k === 'string' && typeof DRAFT_TYPES !== 'undefined'
    && Object.prototype.hasOwnProperty.call(DRAFT_TYPES, k);
}
function tboDType(){ return tboDTypeKnown(TBO.host.dtype) ? TBO.host.dtype : 'standard'; }
function tboHostDraft(){ return !REBIRTH && TBO.host.mode === 'draft'; }
function tboHostSeats(){
  return (tboHostDraft() && tboDType() === 'hex') ? 2 : Math.min(TBO.host.seats, tboSeatsMost());
}
function tboSeatsMost(){ return REBIRTH ? 6 : 4; }
function tboSeatOpts(){
  var out = [];
  for(var n = 2; n <= tboSeatsMost(); n++) out.push([String(n), String(n)]);
  return out;
}
/* Not class 'main': the app already has a .main, a whole page tall. */
function tboGamePill(extra){
  return "<span class='tbl-pill" + (REBIRTH ? ' tbl-preb' : '') + "'><span class='tbl-pill-w'>"
    + (REBIRTH ? 'Rebirth' : 'Main Game') + (extra ? ' &middot; ' + e(extra) : '') + "</span></span>";
}

/* Runs while the file loads, before DRAFT_TYPES is set, so the draft type is only read for its shape; tboDType asks whether it exists. */
(function(){
  try{
    var h = JSON.parse(localStorage.getItem(TBO_HOST_KEY) || '{}') || {};
    ['seats', 'pub', 'name', 'note', 'format', 'spect', 'strict', 'deck',
     'mode', 'ddeck', 'dtype', 'dtimer', 'dm', 'dmList'].forEach(function(k){
      if(h[k] !== undefined) TBO.host[k] = h[k];
    });
  }catch(_){}
  if(TBO.host.dm !== 'dmp') TBO.host.dm = 'dm';
  TBO.host.dmList = (typeof TBO.host.dmList === 'string') ? TBO.host.dmList.slice(0, 4000) : '';
  TBO.host.seats = Math.max(2, Math.min(6, +TBO.host.seats || 2));
  if(TBO.host.mode !== 'draft' || REBIRTH) TBO.host.mode = 'game';
  if(typeof TBO.host.dtype !== 'string' || !/^[a-z]{1,16}$/.test(TBO.host.dtype)) TBO.host.dtype = 'standard';
  try{ TBL.name = TBL.name || localStorage.getItem(TBO_NAME_KEY) || ''; }catch(_){}
  try{ TBO.discordLast = tboDiscordClean(localStorage.getItem(TBO_DISCORD_KEY) || '').url; }catch(_){}
})();
function tboSaveHost(){
  try{ localStorage.setItem(TBO_HOST_KEY, JSON.stringify(TBO.host)); }catch(_){}
}
/* Always Character in Rebirth: the DM's Encounter and Rewards decks come in by name (tdDmMatch), not as the table's format. */
function tboHostFormat(){
  if(REBIRTH) return 'character';
  return tboFmtOk(TBO.host.format) ? TBO.host.format : _gameMode;
}
function tboDefaultName(){ return (TBL.name || 'Player') + "'s table"; }


function tboSegHTML(key, opts, cur, small){
  return "<div class='tbl-seg" + (small ? ' tbl-seg-sm' : '') + "' data-k='" + key + "'>"
    + opts.map(function(o){
        return "<button type='button' class='" + (String(o[0]) === String(cur) ? 'on' : '') + "'"
          + " data-v='" + e(o[0]) + "' onclick=\"tboSeg('" + key + "','" + e(o[0]) + "')\">"
          + e(o[1]) + "</button>";
      }).join('')
    + "</div>";
}
function tboSegLight(key, v){
  document.querySelectorAll(".tbl-seg[data-k='" + key + "'] button").forEach(function(b){
    b.classList.toggle('on', b.getAttribute('data-v') === String(v));
  });
}
function tboSeg(key, v){
  if(key === 'seats'){ TBO.host.seats = Math.max(2, Math.min(tboSeatsMost(), +v || 2)); tboSaveHost(); }
  else if(key === 'hdm'){
    /* a new answer, so Ready again */
    TBO.host.dm = (v === 'dmp') ? 'dmp' : 'dm';
    tboSaveHost();
    var hd = document.getElementById('tblHostOpts');
    if(hd && !hd.hidden){ tboReadHostFields(); hd.innerHTML = tboHostOptsHTML(); tboHostDeckMark(); }
    if(tblOn() && TBL.phase === 'waiting' && tboIsHost()){
      TBO.ready = false;
      tboSendSeat();
      tboRoomRender();
    }
    tboSegLight('hdm', TBO.host.dm);
    return;
  }
  else if(key === 'hmode'){
    TBO.host.mode = (v === 'draft' && !REBIRTH) ? 'draft' : 'game';
    tboSaveHost();
    tboReadHostFields();
    var hb = document.getElementById('tblHostOpts');
    if(hb && !hb.hidden){ hb.innerHTML = tboHostOptsHTML(); tboHostDeckMark(); }
    tboSegLight('seats', tboHostSeats());
    return;
  }
  else if(key === 'sort'){ TBO.sort = v; tboLobbyRender(); }
  tboSegLight(key, v);
}

function tboPPHTML(key, pub){
  return "<button type='button' class='tbl-pp' role='switch' aria-checked='" + (pub ? 'true' : 'false') + "'"
    + " data-k='" + key + "' data-pp='" + (pub ? 'public' : 'private') + "'"
    + " onclick=\"tboPP('" + key + "')\">"
    + "<span class='tbl-pp-track'><span class='tbl-pp-knob'></span></span>"
    + "<span class='tbl-pp-word'>" + (pub ? 'Public' : 'Private') + "</span></button>";
}
function tboPPLight(key, pub){
  document.querySelectorAll(".tbl-pp[data-k='" + key + "']").forEach(function(b){
    b.setAttribute('data-pp', pub ? 'public' : 'private');
    b.setAttribute('aria-checked', pub ? 'true' : 'false');
    b.querySelector('.tbl-pp-word').textContent = pub ? 'Public' : 'Private';
  });
}
function tboPP(key){
  if(key === 'room'){
    if(!TBL.table || TBL.hostId !== TBL.you) return;
    tblSend({t:'meta', table:{pub:!TBL.table.pub}});
    return;                           /* redrawn when the relay says so */
  }
  TBO.host.pub = !TBO.host.pub;
  tboSaveHost();
  tboPPLight('host', TBO.host.pub);
}

function tboOptOn(key){ return key === 'spect' ? TBO.host.spect !== false : !!TBO.host[key]; }
function tboOptHTML(key, label){
  var on = tboOptOn(key);
  return "<button type='button' class='tbl-opt tbl-opt-" + key + "' role='switch'"
    + " aria-checked='" + (on ? 'true' : 'false') + "' data-k='" + key + "' data-on='" + (on ? '1' : '0') + "'"
    + " onclick=\"tboOpt('" + key + "')\">"
    + "<span class='tbl-opt-lbl'>" + e(label) + "</span>"
    + "<span class='tbl-pp-track'><span class='tbl-pp-knob'></span></span>"
    + "<span class='tbl-opt-word'>" + (on ? 'On' : 'Off') + "</span></button>";
}
function tboOpt(key){
  TBO.host[key] = !tboOptOn(key);
  tboSaveHost();
  var on = tboOptOn(key);
  document.querySelectorAll(".tbl-opt[data-k='" + key + "']").forEach(function(b){
    b.setAttribute('data-on', on ? '1' : '0');
    b.setAttribute('aria-checked', on ? 'true' : 'false');
    b.querySelector('.tbl-opt-word').textContent = on ? 'On' : 'Off';
  });
}

function tboAgo(ms){
  if(!ms) return '';
  var s = Math.max(0, (Date.now() - ms) / 1000);
  if(s < 60) return 'just now';
  var m = Math.floor(s / 60);
  if(m < 60) return m + ' min';
  var h = Math.floor(m / 60);
  return h + (h === 1 ? ' hour' : ' hours');
}

/* The first box keeps the join box's old id, so ?open=online and the header button still land the cursor there. */
function tboCodeHTML(pre){
  var s = String(pre || '').toUpperCase();
  var h = "<div class='tbl-code6' id='tblCode6'>";
  for(var i = 0; i < 6; i++)
    h += "<input class='tbl-c6'" + (i === 0 ? " id='tblRoom'" : '') + " maxlength='6'"
      + " autocomplete='off' autocapitalize='characters' spellcheck='false'"
      + " aria-label='Room code, letter " + (i + 1) + "' value='" + e(s.charAt(i)) + "'"
      + " oninput='tboCodeIn(event," + i + ")' onkeydown='tboCodeKey(event," + i + ")'"
      + " onpaste='tboCodePaste(event," + i + ")'>";
  return h + "</div>";
}
function tboCodeBoxes(){
  return Array.prototype.slice.call(document.querySelectorAll('#tblCode6 .tbl-c6'));
}
function tboCodeValue(){
  return tboCodeBoxes().map(function(b){ return b.value; }).join('').toUpperCase();
}
function tboCodeClean(s){ return String(s || '').toUpperCase().replace(/[^A-Z2-9]/g, ''); }
function tboCodeFill(str, from){
  var bx = tboCodeBoxes(), s = tboCodeClean(str), i = from || 0, k = 0;
  for(; i < bx.length && k < s.length; i++, k++) bx[i].value = s.charAt(k);
  var next = bx[Math.min(i, bx.length - 1)];
  if(next) next.focus();
}
function tboCodeIn(ev, i){
  var b = ev.target, v = tboCodeClean(b.value);
  if(v.length > 1){ b.value = ''; tboCodeFill(v, i); return; }
  b.value = v;
  var bx = tboCodeBoxes();
  if(v && bx[i + 1]) bx[i + 1].focus();
}
function tboCodeKey(ev, i){
  var bx = tboCodeBoxes();
  if(ev.key === 'Enter'){ ev.preventDefault(); tblJoinTyped(); return; }
  if(ev.key === 'Backspace' && !ev.target.value && bx[i - 1]){
    ev.preventDefault(); bx[i - 1].value = ''; bx[i - 1].focus(); return;
  }
  if(ev.key === 'ArrowLeft' && bx[i - 1]){ ev.preventDefault(); bx[i - 1].focus(); }
  if(ev.key === 'ArrowRight' && bx[i + 1]){ ev.preventDefault(); bx[i + 1].focus(); }
}
function tboCodePaste(ev, i){
  var t = '';
  try{ t = (ev.clipboardData || window.clipboardData).getData('text'); }catch(_){}
  if(!t) return;
  ev.preventDefault();
  var m = /[?&]table=([A-Za-z2-9]{6})/.exec(t);
  tboCodeFill(m ? m[1] : t, m ? 0 : i);
}


function tblAtTable(){
  return tblOn() || TBL.status === 'joining' || TBL.status === 'lost';
}
function tboDialogOpen(){ return !!document.getElementById('tblOv'); }
/* modalOpen is held by the overlay, which stays while the window inside it is drawn again; that window still carries the dialog's role and name. */
function tboHoldKeys(ov, close){
  if(!ov || typeof modalOpen !== 'function') return;
  modalOpen(ov, {onClose:function(){ close(); }});
  ov.removeAttribute('role');
  ov.removeAttribute('aria-modal');
}
function tboLetKeys(ov){
  if(ov && typeof modalClose === 'function') modalClose(ov);
}

function tblOpenSetup(view){
  var ov = document.getElementById('tblOv');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'tblOv'; ov.className = 'td-ov tbl-ov';
    document.body.appendChild(ov);
    ov.addEventListener('click', function(ev){ if(ev.target === ov) tblCloseSetup(); });
    tboHoldKeys(ov, tblCloseSetup);
  }
  if(!TBL.url) tblLoadUrl();
  TBO.view = view || (tblAtTable() ? 'room' : 'hub');
  tboRenderDialog();
  if(!TBO.tick) TBO.tick = setInterval(function(){
    if(!tboDialogOpen()){ clearInterval(TBO.tick); TBO.tick = null; return; }
    if(TBO.view === 'hub') tboLobbyRender();
  }, 15000);
}
function tblCloseSetup(){
  tboCloseHost();
  var ov = document.getElementById('tblOv');
  if(ov){ tboLetKeys(ov); ov.remove(); }
  tboLobbyClose();
  if(TBO.tick){ clearInterval(TBO.tick); TBO.tick = null; }
  tblRenderPanel();
}
function tboRenderDialog(){
  var ov = document.getElementById('tblOv');
  if(!ov) return;
  if(TBO.view === 'room'){
    tboLobbyClose();
    ov.innerHTML = tboRoomHTML();
    tboRoomRender();
    return;
  }
  ov.innerHTML = tboHubHTML();
  TBO.prefill = '';
  tblSetupErr();
  tboLobbyOpen();
}

function tboSync(){
  tboChatPanel();
  if(!tboDialogOpen()) return;
  if(TBO.view === 'room'){
    if(!tblAtTable()){ TBO.view = 'hub'; tboRenderDialog(); return; }
    if(tblOn() && TBL.phase === 'playing'){ tblCloseSetup(); return; }
    tboRoomRender();
    return;
  }
  tblSetupErr();
  var on = document.getElementById('tblOnline');
  if(on) on.innerHTML = tboOnlineHTML();
}

function tblSetupErr(){
  var p = document.getElementById('tblErr');
  if(!p) return;
  p.textContent = (TBL.status === 'error' && TBL.note) ? TBL.note : '';
  p.hidden = !p.textContent;
}
function tblReadSetup(){
  var n = document.getElementById('tblName'), u = document.getElementById('tblUrl');
  var box = document.getElementById('tblUrlBox');
  if(n){
    TBL.name = n.value.trim().slice(0, 40) || 'Player';
    try{ localStorage.setItem(TBO_NAME_KEY, TBL.name); }catch(_){}
  }
  /* A folded-away box means Conjure's relay, whatever it happens to hold. */
  if(u) tblSaveUrl(box && box.hidden ? '' : u.value);
}
function tboRelayChanged(){
  var u = document.getElementById('tblUrl'), box = document.getElementById('tblUrlBox');
  if(u) tblSaveUrl(box && box.hidden ? '' : u.value);
  tboLobbyClose();
  if(tboDialogOpen() && TBO.view === 'hub') tboLobbyOpen();
}


function tboHubHTML(){
  var h = TBO.host;
  return "<div class='ed2-modal tbl-dlg tbl-hub' role='dialog' aria-modal='true' aria-label='Play Online'>"
    + "<div class='ed2-modal-head tbl-head tbl-head3'>"
      + "<div class='tbl-hl'><b>Play Online</b>" + tboGamePill() + "</div>"
      + "<label class='tbl-namef'><span>Your name</span>"
        + "<input id='tblName' maxlength='40' value='" + e(TBL.name || '') + "' placeholder='Noah'></label>"
      + "<div class='tbl-hr'>" + tblRelayLineHTML()
        + "<button class='ed2-btn close-x nb nb-red nb-m wh-x' onclick='tblCloseSetup()'>Close &#10005;</button></div>"
    + "</div>"
    + "<div class='ed2-modal-body tbl-body'>"
      + tblRelayBoxHTML()
      + "<div class='tbl-box tbl-hostwrap' id='tblHostBox'>"
        + "<div class='tbl-onerow tbl-hostline'><h5>Host a table</h5>"
          + tboSegHTML('seats', tboSeatOpts(), tboHostSeats())
          + tboPPHTML('host', h.pub)
          + "<span class='tbl-gap'></span>"
          + "<button class='ed2-btn' id='tblOptBtn' onclick='tboOpenHost()'>Options</button>"
          + "<button class='ed2-btn primary' id='tblHostBtn' onclick='tblHostNew()'>Host</button>"
        + "</div>"
        + "<div class='tbl-hostopts' id='tblHostOpts' hidden></div>"
      + "</div>"
      + "<div class='tbl-box tbl-onerow' id='tblCodeBox'><h5>Use Code</h5>"
        + tboCodeHTML(TBO.prefill)
        + "<span class='tbl-gap'></span>"
        + "<button class='ed2-btn spect tbl-watchbtn' onclick='tblWatchTyped()'>Spectate</button>"
        + "<button class='ed2-btn primary' id='tblJoinBtn' onclick='tblJoinTyped()'>Join</button>"
      + "</div>"
      /* A join refused before it starts leaves this dialog open over the strip that says why, so the reason shows here too. */
      + "<p class='tbl-err' id='tblErr' hidden></p>"
      + "<div class='tbl-lobby' id='tblLobby'>" + tboLobbyHTML() + "</div>"
    + "</div></div>";
}
function tboOnlineHTML(){
  if(TBO.lobbyState !== 'on') return '';
  var n = TBO.online || 0;
  return "<span class='tbl-relay-dot'></span>" + n + (n === 1 ? ' player' : ' players') + ' online';
}

function tblHostNew(){
  /* The Options panel may be open with a name typed and never blurred: read it first, or the table goes up called something else. */
  tboReadHostFields();
  var dc = document.getElementById('tblTDiscord');
  if(dc && tboDiscordCheck(dc).why){ dc.focus(); return false; }
  tblReadSetup();
  tboHost();
}
function tboHost(){
  TBL.watch = false;
  TBL.want = tboHostSeats();
  TBL.hostMeta = {pub:!!TBO.host.pub, name:(TBO.host.name || tboDefaultName()),
                  note:TBO.host.note || '', format:tboHostFormat(),
                  spect:TBO.host.spect !== false, strict:!!TBO.host.strict};
  /* A draft table plays Arena from the start: what everyone drafts is built into a thirty-card Arena deck. */
  if(tboHostDraft()){
    TBL.hostMeta.mode = 'draft';
    TBL.hostMeta.dtype = tboDType();
    TBL.hostMeta.format = 'arena';
  }
  TBO.deckPick = TBO.host.deck || '';
  if(TBO.deckPick && !_savedLoad()[TBO.deckPick]) TBO.deckPick = '';
  TBO.ready = false;
  if(tblJoin(tblCode(), TBL.name)){
    TBO.discord = TBO.discordLast || '';
    TBO.view = 'room'; tboRenderDialog();
  }
  else { TBL.hostMeta = null; tblSetupErr(); }
}
function tboJoinCode(code, watch){
  TBL.watch = !!watch;
  TBL.hostMeta = null;
  TBO.ready = false;
  TBO.discord = '';          /* the host sends theirs (tboOnPeer) */
  TBO.deckPick = TBO.host.deck || '';
  if(TBO.deckPick && !_savedLoad()[TBO.deckPick]) TBO.deckPick = '';
  if(tblJoin(code, TBL.name)){ TBO.view = 'room'; tboRenderDialog(); return true; }
  TBL.watch = false;
  tblSetupErr();
  return false;
}
function tblJoinTyped(){
  tblReadSetup();
  tboJoinCode(tboCodeValue(), false);
}
function tblWatchTyped(){
  tblReadSetup();
  tboJoinCode(tboCodeValue(), true);
}
function tboJoinRow(room, watch){
  tblReadSetup();
  tboJoinCode(room, watch);
}
function tboSyncRow(room){
  var t = (TBO.tables || []).filter(function(x){ return x.room === room; })[0];
  var seat = !!(t && t.status === 'waiting' && tboOpenSeat(t));
  TBS.openOnJoin = true;
  tboJoinRow(room, !seat);
}

/* Open only while the hub is on screen; the relay sends the whole list whenever it changes, so nothing is merged or polled. */
function tboLobbyOpen(){
  if(TBO.lobby || TBO.lobbyTimer) return;
  if(!TBL.url) tblLoadUrl();
  if(tblRelayProblem(TBL.url)){ TBO.lobbyState = 'none'; tboLobbyRender(); return; }
  var url = TBL.url.replace(/\/+$/, '') + '/lobby?game=' + tboGame();
  var ws;
  try{ ws = new WebSocket(url); }
  catch(_){ TBO.lobbyState = 'down'; tboLobbyRender(); return; }
  TBO.lobby = ws; TBO.lobbyUrl = url;
  if(TBO.lobbyState !== 'on') TBO.lobbyState = 'connecting';
  tboLobbyRender();
  ws.onmessage = function(ev){
    var m; try{ m = JSON.parse(ev.data); }catch(_){ return; }
    m = tgTables(m);
    if(!m) return;
    TBO.tables = m.tables;
    TBO.online = m.online;
    TBO.lobbyAt = Date.now();
    TBO.lobbyState = 'on';
    TBO.lobbyTries = 0;
    tboLobbyRender();
  };
  ws.onerror = function(){};
  ws.onclose = function(){
    if(TBO.lobby !== ws) return;          /* closed on purpose, or replaced */
    TBO.lobby = null;
    TBO.lobbyState = 'down';
    tboLobbyRender();
    if(!tboDialogOpen() || TBO.view !== 'hub') return;
    var wait = Math.min(30000, 2000 * Math.pow(2, Math.min(4, TBO.lobbyTries++)));
    TBO.lobbyTimer = setTimeout(function(){ TBO.lobbyTimer = null;
      if(tboDialogOpen() && TBO.view === 'hub') tboLobbyOpen(); }, wait);
  };
}
function tboLobbyClose(){
  if(TBO.lobbyTimer){ clearTimeout(TBO.lobbyTimer); TBO.lobbyTimer = null; }
  var ws = TBO.lobby;
  TBO.lobby = null;
  if(ws){ try{ ws.close(); }catch(_){} }
  TBO.lobbyState = 'off';
  TBO.lobbyTries = 0;
}

/* No cache here: edSagaSummary caches it knowing the saga switches, which a cache keyed on the card count would miss. */
function tboMySet(){
  return tblSetHash();
}
function tboOpenSeat(t){ return (t.seats || []).length < (t.cap || 2); }

function tboLobbyRender(){
  var el = document.getElementById('tblLobby');
  if(el) el.innerHTML = tboLobbyHTML();
  var on = document.getElementById('tblOnline');
  if(on) on.innerHTML = tboOnlineHTML();
  var rs = document.getElementById('tblRelayStat');
  if(rs) rs.innerHTML = tboStateHTML();
}
function tboStateHTML(){
  if(TBO.lobbyState === 'on') return "<span class='tbl-relay-dot'></span>Connected";
  if(TBO.lobbyState === 'connecting') return "<span class='tbl-relay-dot own'></span>Connecting&hellip;";
  if(TBO.lobbyState === 'none') return "<span class='tbl-relay-dot off'></span>No relay address set";
  return "<span class='tbl-relay-dot bad'></span>Table list unavailable";
}
function tboUrlBoxOpen(){
  var b = document.getElementById('tblUrlBox');
  return !!b && !b.hidden && b.offsetParent !== null;
}

function tboLobbyHTML(){
  var all = TBO.tables || [];
  var F = TBO.filters;
  var fcount = {};
  all.forEach(function(t){ fcount[t.format] = (fcount[t.format] || 0) + 1; });
  var anyFmt = !Object.keys(F.fmt).length;
  var chk = function(on, act, label, n){
    return "<button type='button' class='tbl-chk" + (on ? ' on' : '') + "' onclick=\"" + act + "\">"
      + "<i></i>" + e(label) + (n != null ? "<span class='tbl-n'>" + n + "</span>" : '') + "</button>";
  };
  var sizes = [];
  for(var sz = 2; sz <= tboSeatsMost(); sz++) sizes.push(sz);
  var side = "<div class='tbl-lside'>"
    + (REBIRTH ? '' : "<h6>Format</h6>"
      + chk(anyFmt, "tboFilter('fmt','')", 'Any', all.length)
      + DECK_TYPES.map(function(k){
          return chk(!anyFmt && !!F.fmt[k], "tboFilter('fmt','" + k + "')", tboFmtLabel(k), fcount[k] || 0);
        }).join(''))
    + "<h6>Table size</h6>"
    + sizes.map(function(n){
        return chk(!!F.size[n], "tboFilter('size'," + n + ")", n + ' players');
      }).join('')
    + "<h6>Show</h6>"
    + chk(!!F.open, "tboFilter('open')", 'Has an open seat')
    + chk(!!F.playing, "tboFilter('playing')", 'Games in progress')
    + "</div>";

  var mine = (tblAtTable() && TBL.room) ? TBL.room : '';
  var set = tboMySet();
  var shown = all.filter(function(t){
    if(t.room === mine) return true;
    if(!REBIRTH && !anyFmt && !F.fmt[t.format]) return false;
    if(!F.size[t.cap || 2]) return false;
    var open = t.status === 'waiting' && tboOpenSeat(t);
    return open ? !!F.open : !!F.playing;
  });
  var by = {
    'new': function(a, b){ return (b.since || 0) - (a.since || 0); },
    'long': function(a, b){ return (a.since || 0) - (b.since || 0); },
    'most': function(a, b){ return (b.seats || []).length - (a.seats || []).length
                                   || (b.since || 0) - (a.since || 0); }
  }[TBO.sort] || function(){ return 0; };
  shown.sort(by);
  var yours = shown.filter(function(t){ return t.room === mine; });
  var open = shown.filter(function(t){
    return t.room !== mine && t.status === 'waiting' && tboOpenSeat(t); });
  var busy = shown.filter(function(t){
    return t.room !== mine && !(t.status === 'waiting' && tboOpenSeat(t)); });

  var body = "<div class='tbl-lmain'>"
    + "<div class='tbl-ltop'><span class='tbl-lh'>Open Tables</span>"
    + "<span class='tbl-lfoot' id='tblLobbyStat'>" + tboLobbyStatHTML() + "</span>"
    + "<span class='tbl-gap'></span>"
    + tboSegHTML('sort', [['new', 'Newest'], ['long', 'Waiting longest'], ['most', 'Most players']],
                 TBO.sort, true)
    + "</div>";
  if(TBO.lobbyState === 'on' && shown.length){
    body += "<div class='tbl-lhead'><span>Table</span><span>Seats</span><span>Status</span>"
      + "<span class='spect-ink'>Spectators</span><span></span></div>";
    if(yours.length) body += "<div class='tbl-lgroup'>Your Table</div>" + yours.map(function(t){ return tboRowHTML(t, set, true); }).join('');
    if(open.length) body += open.map(function(t){ return tboRowHTML(t, set); }).join('');
    if(busy.length) body += "<div class='tbl-lgroup'>In Progress &mdash; <span class='spect-ink'>Spectate</span></div>" + busy.map(function(t){ return tboRowHTML(t, set); }).join('');
  } else if(TBO.lobbyState === 'on'){
    body += "<div class='tbl-empty'><button class='ed2-btn tbl-green' onclick='tboOpenHost()'>+ Host a table</button></div>";
  }
  body += "</div>";
  return side + body;
}

/* Every line stays one line, cut with an ellipsis by the CSS: nothing here inserts a break. */
function tboRowHTML(t, set, isMine){
  var seats = t.seats || [], cap = t.cap || 2;
  var dots = '';
  for(var i = 0; i < cap; i++){
    var st = seats[i];
    dots += st ? "<span class='tbl-seat tbl-seat-" + e(st.side) + "' title='" + e(st.name) + "'>"
                 + e((st.name || '?').charAt(0).toUpperCase()) + "</span>"
               : "<span class='tbl-seat open'></span>";
  }
  var otherSet = !!(t.set && set && t.set !== set);
  var playing = t.status === 'playing';
  var sub = isMine
    ? ((TBL.hostId === TBL.you ? 'you are hosting' : 'you are here')
       + tboLabelBit(t) + ' &middot; code ' + e(t.room))
    : (playing && seats.length
        ? seats.map(function(s){ return '<b>' + e(s.name) + '</b>'; }).join(' vs ')
        : 'hosted by <b>' + e(t.host || (seats[0] && seats[0].name) || '?') + '</b>')
      + tboLabelBit(t)
      + (t.note ? ' &middot; &ldquo;' + e(t.note) + '&rdquo;' : '');
  var state = playing
    ? "<span class='g'>Playing</span> &middot; " + e(tboAgo(t.started || t.since))
    : (tboOpenSeat(t)
        ? "<span class='w'>Waiting</span> &middot; " + e(tboAgo(t.since))
        : "<span class='g'>Full</span> &middot; " + e(tboAgo(t.since)));
  var acts, sync = '';
  if(isMine){
    acts = (TBL.phase === 'waiting'
             ? "<button class='ed2-btn tiny' onclick=\"tblOpenSetup('room')\">Open room</button>"
             : "<button class='ed2-btn tiny' onclick='tblCloseSetup()'>Board</button>")
      + "<button class='ed2-btn tiny danger' onclick='tblLeaveAsk()'>Leave</button>";
  } else {
    var canJoin = t.status === 'waiting' && tboOpenSeat(t);
    /* A button, not a warning: Join is never greyed out for a different card set (HANDOFF §77.11). */
    if(otherSet && (canJoin || t.spect !== false))
      sync = "<div class='tbl-tsync'><button type='button' class='ed2-btn tiny tbl-syncbtn'"
        + " onclick=\"tboSyncRow('" + e(t.room) + "')\">Sync Cards with Host</button></div>";
    acts = (canJoin ? "<button class='ed2-btn tiny primary' onclick=\"tboJoinRow('" + e(t.room) + "',false)\""
                      + ">Join</button>" : '')
      + "<button class='ed2-btn tiny spect' onclick=\"tboJoinRow('" + e(t.room) + "',true)\""
      + (t.spect === false ? ' disabled' : '') + ">Spectate</button>";
  }
  return "<div class='tbl-trow" + (isMine ? ' mine' : '') + (canJoin === false || playing ? ' full' : '') + "'"
    + " data-room='" + e(t.room) + "'>"
    + "<div class='tbl-tcell'><div class='tbl-tname'>" + e(t.name || ((t.host || 'Somebody') + "'s table")) + "</div>"
    + "<div class='tbl-tsub'>" + sub + "</div>" + sync + "</div>"
    + "<div class='tbl-seats'>" + dots + "<small>" + seats.length + '/' + cap + "</small></div>"
    + "<div class='tbl-tstate'>" + state + "</div>"
    + "<div class='tbl-tstate spect-ink'>" + (t.watchers ? t.watchers : '&mdash;') + "</div>"
    + "<div class='tbl-acts'>" + acts + "</div></div>";
}

function tboLobbyStatHTML(){
  if(TBO.lobbyState !== 'on') return tboUrlBoxOpen() ? '' : tboStateHTML();
  var n = (TBO.tables || []).length;
  return "<span class='tbl-relay-dot'></span>" + n + (n === 1 ? ' table' : ' tables')
    + ' &middot; ' + TBO.online + (TBO.online === 1 ? ' player' : ' players') + ' online'
    + ' &middot; updated ' + e(tboAgo(TBO.lobbyAt) === 'just now' ? 'just now'
                              : tboAgo(TBO.lobbyAt) + ' ago');
}

function tboFilter(kind, v){
  var F = TBO.filters;
  if(kind === 'fmt'){
    if(!v) F.fmt = {};
    else if(F.fmt[v]) delete F.fmt[v];
    else F.fmt[v] = 1;
  } else if(kind === 'size'){
    if(F.size[v]) delete F.size[v]; else F.size[v] = 1;
  } else F[kind] = F[kind] ? 0 : 1;
  tboLobbyRender();
}

function tboHostOptsHTML(){
  var h = TBO.host, fmt = tboHostFormat();
  var saved = _savedLoad();
  if(h.deck && !saved[h.deck]) h.deck = '';
  /* A new format is one more line in DECK_TYPES, and nothing here. */
  /* No second Players or Public/Private here: both are on the box's own line, and two switches showing one state is a bug waiting to be reported. */
  var dr = tboHostDraft();
  var decks = (typeof drDraftDecks === 'function') ? drDraftDecks() : [];
  if(h.ddeck && decks.indexOf(h.ddeck) < 0) h.ddeck = '';
  if(!h.ddeck && decks.length) h.ddeck = decks[0];
  var row2 = dr
    ? "<div class='tbl-hrow'>"
        + "<div class='tbl-il tbl-grow'><span class='tbl-lbl'>Draft Deck</span>"
          + "<select id='tblDDeck' class='tbl-select' onchange='tboHostDDeck(this.value)'>"
          + (decks.length ? decks.map(function(n){
              return "<option value='" + e(n) + "'" + (n === h.ddeck ? ' selected' : '') + ">" + e(n) + "</option>";
            }).join('') : "<option value=''>No Draft Decks saved</option>")
          + "</select><span class='tbl-dcount' id='tblDDeckN'></span></div>"
        + "<div class='tbl-il'><span class='tbl-lbl'>Draft</span>"
          + "<select id='tblDType' class='tbl-select' onchange='tboHostDType(this.value)'>"
          + DRAFT_ORDER.map(function(k){
              return "<option value='" + k + "'" + (k === tboDType() ? ' selected' : '') + ">"
                + e(DRAFT_TYPES[k].label) + "</option>";
            }).join('')
          + "</select></div>"
        + "<div class='tbl-il'><span class='tbl-lbl'>Pick Timer</span>"
          + "<select id='tblDTimer' class='tbl-select' onchange='tboHostDTimer(this.value)'>"
          + DR_TIMERS.map(function(o){
              return "<option value='" + o[0] + "'" + (+o[0] === +h.dtimer ? ' selected' : '') + ">" + o[1] + "</option>";
            }).join('')
          + "</select></div>"
      + "</div>"
    : null;
  var deckIl = "<div class='tbl-il tbl-grow'><span class='tbl-lbl'>Deck</span>"
    + tboDeckSelectHTML('tblHDeck', h.deck, "tboHostDeck(this.value)")
    + "<span class='tbl-dcount' id='tblHDeckN'></span>"
    + "<span class='tbl-lmark' id='tblHDeckMark'></span></div>";
  if(!row2) row2 = REBIRTH
    ? (tboHostDm() === 'dm' ? '' : "<div class='tbl-hrow'>" + deckIl + "</div>")
    : "<div class='tbl-hrow'>"
      + "<div class='tbl-il'><span class='tbl-lbl tbl-lw'>Format</span>"
        + "<select id='tblTFormat' class='tbl-select tbl-fmtsel' onchange='tboSetFormat(this.value)'>"
        + DECK_TYPES.map(function(k){
            return "<option value='" + e(k) + "'" + (k === fmt ? ' selected' : '') + ">"
              + e(tboFmtLabel(k)) + "</option>";
          }).join('')
        + "</select></div>"
      + deckIl
    + "</div>";
  return "<div class='tbl-hostbody'>"
      + "<div class='tbl-hrow tbl-namerow" + (REBIRTH ? '' : ' tbl-namerow-m') + "'>"
        + (REBIRTH ? '' : "<div class='tbl-il'><span class='tbl-lbl'>Mode</span>"
            + tboSegHTML('hmode', [['game', 'Game'], ['draft', 'Draft']], dr ? 'draft' : 'game') + "</div>")
        + "<span class='tbl-lbl' id='tblTNameL'>Table Name</span>"
        + "<input id='tblTName' maxlength='40' value='" + e(h.name || '') + "'"
          + " aria-labelledby='tblTNameL' placeholder='" + e(tboDefaultName()) + "'>"
        + "<span class='tbl-lbl' id='tblTDiscordL'>Discord Link</span>"
        + tboDiscordInputHTML('tblTDiscord', TBO.discordLast, "onchange='tboDiscordField(this)'")
        + tboDiscordWhyHTML('tblTDiscord')
      + "</div>"
      + row2
      + (REBIRTH ? "<div class='tbl-hrow tbl-dmrow'>"
          + "<div class='tbl-il'><span class='tbl-lbl'>Your Seat</span>"
            + tboSegHTML('hdm', [['dm', 'DM only'], ['dmp', 'DM and player']], tboHostDm()) + "</div>"
          + tboDmBoxHTML('tblDmDecks')
        + "</div>" : '')
      + "<div class='tbl-hrow'>"
        + tboOptHTML('strict', 'Deck Restrictions')
        + tboOptHTML('spect', 'Spectators')
        + "<div class='tbl-il tbl-grow'><span class='tbl-lbl'>Notes</span>"
          + "<input id='tblTNote' maxlength='80' value='" + e(h.note || '') + "'"
          + " placeholder='New players welcome'></div>"
      + "</div>"
    + "</div>";
}
function tboOpenHost(on){
  var box = document.getElementById('tblHostOpts');
  var btn = document.getElementById('tblOptBtn');
  if(!box) return;
  var n = document.getElementById('tblName');
  if(n && n.value.trim()) TBL.name = n.value.trim().slice(0, 40);
  var open = (on === undefined) ? box.hidden : !!on;
  if(open){
    box.innerHTML = tboHostOptsHTML();
    box.hidden = false;
    tboHostDeckMark();
  } else {
    tboReadHostFields();
    box.hidden = true;
    box.innerHTML = '';
  }
  if(btn){
    btn.innerHTML = open ? 'Close &#10005;' : 'Options';
    btn.className = open ? 'ed2-btn close-x' : 'ed2-btn';
    btn.id = 'tblOptBtn';
  }
}
function tboReadHostFields(){
  var nm = document.getElementById('tblTName'), nt = document.getElementById('tblTNote');
  if(nm) TBO.host.name = nm.value.trim().slice(0, 40);
  if(nt) TBO.host.note = nt.value.trim().slice(0, 80);
  var dl = document.getElementById('tblDmDecks');
  if(dl) TBO.host.dmList = String(dl.value || '').slice(0, 4000);
  tboSaveHost();
  var dc = document.getElementById('tblTDiscord');
  if(dc){
    var c = tboDiscordClean(dc.value);
    if(!c.why) tboDiscordRemember(c.url);
  }
}
function tboCloseHost(){ tboOpenHost(false); }
function tboSetFormat(v){
  if(!tboFmtOk(v)) return;
  TBO.host.format = v;
  tboSaveHost();
  tboHostDeckMark();
}
function tboHostDeck(v){
  TBO.host.deck = v || '';
  tboSaveHost();
  tboHostDeckMark();
}
function tboHostDDeck(v){ TBO.host.ddeck = v || ''; tboSaveHost(); tboHostDeckMark(); }
function tboHostDType(v){
  if(!tboDTypeKnown(v)) return;
  TBO.host.dtype = v;
  tboSaveHost();
  tboSegLight('seats', tboHostSeats());
}
function tboHostDTimer(v){ TBO.host.dtimer = +v || 0; tboSaveHost(); }
function tboHostDeckMark(){
  var dn = document.getElementById('tblDDeckN');
  if(dn && typeof drPoolOf === 'function'){
    var dp = TBO.host.ddeck ? drPoolOf(drDeckEntry(TBO.host.ddeck)) : null;
    dn.textContent = dp ? dp.names.length + ' cards' : '';
  }
  var j = tboJudge(tboDeckEntry(TBO.host.deck), tboHostFormat());
  var n = document.getElementById('tblHDeckN'), m = document.getElementById('tblHDeckMark');
  if(n) n.textContent = j.counts;
  if(m) m.outerHTML = tboMarkHTML(j.legal, 'tblHDeckMark');
}

/* Judged by deckLegality, as Deck Lists are; the Build Deck page checks more (its Known issue, cat_deck.js). */
function tboDeckSelectHTML(id, cur, act){
  /* Not the Draft Decks: a pool to draft from is not a deck anybody plays. */
  var all = _savedLoad();
  var names = Object.keys(all).filter(function(n){
    return !(all[n] && typeof all[n] === 'object' && all[n].mode === 'draft');
  }).sort();
  return "<select id='" + id + "' class='tbl-select' onchange=\"" + act + "\">"
    + "<option value=''" + (cur ? '' : ' selected') + ">Current deck</option>"
    + names.map(function(n){
        return "<option value='" + e(n) + "'" + (n === cur ? ' selected' : '') + ">" + e(n) + "</option>";
      }).join('')
    + "</select>";
}
function tboDeckEntry(pick){
  if(pick){
    var en = _savedLoad()[pick];
    if(typeof en === 'string') return {main:en};
    if(en) return en;
  }
  var cur = {mode:_gameMode};
  Object.keys(DECK_IDS).forEach(function(k){
    var el = document.getElementById(DECK_IDS[k]);
    cur[k] = el ? el.value : '';
  });
  return cur;
}
/* Keyed on CARD_GEN as well as the count: a rename keeps the count and must still make a new map. */
var _tboCardMap = {n:-1, gen:-1, map:null};
function tboCardMap(){
  var cs = window.CARDS || [], gen = window.CARD_GEN || 0;
  if(_tboCardMap.n !== cs.length || _tboCardMap.gen !== gen){
    var m = {};
    cs.forEach(function(c){ m[c.name] = c; });
    _tboCardMap = {n:cs.length, gen:gen, map:m};
  }
  return _tboCardMap.map;
}
function tboJudge(entry, fmt){
  entry = entry || {};
  var dk = {}, tot = {};
  /* In the catalogue's spelling, as the deck pages read them: a name in another case is still its card. */
  ['main', 'essence', 'wish', 'armament'].forEach(function(k){
    dk[k] = deckCanonEntries(parseDeckLines(entry[k] || ''), true);
    tot[k] = dk[k].reduce(function(a, b){ return a + b.count; }, 0);
  });
  /* As the rules count it: a Kingdoms Lord is not part of the Main Deck. */
  var mainN = deckMainCount(dk.main, fmt);
  var counts = REBIRTH ? (mainN + ' / ' + tot.armament)
                       : (mainN + ' / ' + tot.essence + ' / ' + tot.wish);
  /* Rebirth's Encounter and Rewards are pools, not decks - nothing to judge. */
  if(REBIRTH && fmt !== 'character') return {legal:true, counts:counts};
  if(!(tot.main + tot.essence + tot.wish + tot.armament)) return {legal:false, counts:counts};
  var combined = {};
  dk.main.concat(dk.wish).forEach(function(en){
    combined[en.name] = (combined[en.name] || 0) + en.count;
  });
  var v = deckLegality(fmt, {main:tot.main, essence:tot.essence, wish:tot.wish},
    {cardMap:tboCardMap(), combined:combined,
     decks:{main:dk.main, wish:dk.wish, essence:dk.essence, armament:dk.armament}});
  return {legal:v.checked ? !!v.legal : true, counts:counts};
}
function tboMarkHTML(legal, id){
  if(legal == null) return "<span class='tbl-lmark'" + (id ? " id='" + id + "'" : '') + "></span>";
  return "<span class='tbl-lmark " + (legal ? 'ok' : 'no') + "'" + (id ? " id='" + id + "'" : '')
    + " aria-label='" + (legal ? 'Legal' : 'Not legal') + "'>"
    + (legal ? '&#10003;' : '&#10007;') + "</span>";
}
function tboTableFormat(){
  if(REBIRTH) return 'character';
  var f = TBL.table && TBL.table.format;
  return tboFmtOk(f) ? f : _gameMode;
}


/* Sent again whenever somebody new sits down, so they learn it too; the relay does not read it. */
function tboSeatMsg(){
  var dm = tboDmRole();
  if(dm === 'dm') return {t:'seat', deck:'DM only', counts:'', legal:true, ready:!!TBO.ready, dm:'dm'};
  var j = tboJudge(tboDeckEntry(TBO.deckPick), tboTableFormat());
  var m = {t:'seat', deck:TBO.deckPick || 'Current deck', counts:j.counts,
           legal:j.legal, ready:!!TBO.ready};
  if(dm) m.dm = dm;
  return m;
}
function tboSendSeat(){
  if(!tblOn() || TBL.watch || TBL.phase !== 'waiting') return false;
  var m = tboSeatMsg();
  if(REBIRTH && typeof tdGfIconNow === 'function') m.icon = tdGfIconNow();
  TBO.seatInfo[TD.side] = m;
  return tblSend(m);
}
function tboSeatFrom(msg, fromId){
  var side = tblSideOf(fromId);
  if(!side || (side === TD.side && !TBL.watch)) return;
  TBO.seatInfo[side] = {deck:String(msg.deck || '').slice(0, 40),
                        counts:String(msg.counts || '').slice(0, 24),
                        legal:(msg.legal === true || msg.legal === false) ? msg.legal : null,
                        ready:!!msg.ready,
                        dm:(msg.dm === 'dm' || msg.dm === 'dmp') ? msg.dm : '',
                        /* checked where it is drawn (tgIcon, cat_rbgrid.js) */
                        icon:(msg.icon && typeof msg.icon === 'object') ? msg.icon : null};
  if(tboDialogOpen() && TBO.view === 'room') tboRoomRender();
}
function tboPickDeck(v){
  TBO.deckPick = v || '';
  if(TBO.deckPick && !_savedLoad()[TBO.deckPick]) TBO.deckPick = '';
  TBO.host.deck = TBO.deckPick;
  tboSaveHost();
  /* A different deck is a new answer - ready again once you have looked. */
  TBO.ready = false;
  tboSendSeat();
  tboRoomRender();
}
/* Kept on every machine the same way: legality is worked out against each player's own catalogue, which the relay never sees. */
function tboStrict(){ return !!(TBL.table && TBL.table.strict); }
function tboMayReady(){
  if(tboDmRole() === 'dm') return true;          /* no deck to judge */
  return !tboStrict() || tboJudge(tboDeckEntry(TBO.deckPick), tboTableFormat()).legal;
}
function tboToggleReady(){
  if(!TBO.ready && !tboMayReady()) return;
  TBO.ready = !TBO.ready;
  tboSendSeat();
  tboRoomRender();
}
function tboIsHost(){ return !!TBL.you && TBL.hostId === TBL.you && !TBL.watch; }

function tboHostDm(){ return TBO.host.dm === 'dmp' ? 'dmp' : 'dm'; }
function tboDmRole(){ return (REBIRTH && tboIsHost()) ? (TBO.dmTook || tboHostDm()) : ''; }
function tboDmFoundHTML(){
  if(typeof tdDmMatch !== 'function') return '';
  var m = tdDmMatch(TBO.host.dmList || '');
  return (m.found.length ? "<span class='tbl-dmok'>" + m.found.length
        + (m.found.length === 1 ? ' deck' : ' decks') + ' found: '
        + m.found.map(function(f){
            return e(f.name) + ' <i>(' + (f.kind === 'rew' ? 'Rewards' : 'Encounter') + ')</i>';
          }).join(', ') + "</span>" : '')
    + (m.missing.length ? "<span class='tbl-dmmiss'>Not found: " + m.missing.map(e).join(', ') + "</span>" : '')
    + (m.over ? "<span class='tbl-dmmiss'>" + m.over + ' more than a table takes</span>' : '');
}
function tboDmFound(el){
  if(el) TBO.host.dmList = String(el.value || '').slice(0, 4000);
  tboSaveHost();
  var f = el ? document.getElementById(el.id + 'F') : null;
  if(f) f.innerHTML = tboDmFoundHTML();
}
window.tboDmFound = tboDmFound;
function tboDmBoxHTML(id){
  return "<div class='tbl-il tbl-grow tbl-dmbox'><span class='tbl-lbl'>DM Decks</span>"
    + "<textarea id='" + id + "' class='tbl-dmdecks' rows='2' maxlength='4000' spellcheck='false'"
    + " aria-label='DM Decks: the names of saved decks, one per line or comma separated'"
    + " placeholder='Saved deck names, one per line or comma separated'"
    + " oninput='tboDmFound(this)'>" + e(TBO.host.dmList || '') + "</textarea>"
    + "<div class='tbl-dmfound' id='" + id + "F' aria-live='polite'>" + tboDmFoundHTML() + "</div></div>";
}
function tboDmSeatHTML(){
  return "<div class='tbl-sdmrow'>"
    + "<div class='tbl-il'><span class='tbl-lbl'>Your Seat</span>"
      + tboSegHTML('hdm', [['dm', 'DM only'], ['dmp', 'DM and player']], tboHostDm(), true) + "</div>"
    + tboDmBoxHTML('tblDmRoomDecks')
    + "</div>";
}
function tboCanStart(){
  if(!tblOn() || TBL.phase !== 'waiting' || !tboIsHost()) return false;
  if(typeof drRunning === 'function' && drRunning()) return false;
  var seated = tblSeated();
  if(seated.length < 2) return false;
  var strict = tboStrict();
  return seated.every(function(s){
    if(s === TD.side) return !!TBO.ready && (!strict || tboMayReady());
    var i = TBO.seatInfo[s];
    return !!(i && i.ready && (!strict || i.legal === true));
  });
}
function tboStart(){
  if(!tboCanStart()) return false;
  return tblSend({t:'start'});
}

function tboRoomHTML(){
  var t = TBL.table || {};
  var hostSeat = tboHostSeat();
  var title = t.name || ((hostSeat ? hostSeat.name : (TBL.name || 'Player')) + "'s table");
  return "<div class='ed2-modal tbl-dlg tbl-roomdlg' role='dialog' aria-modal='true' aria-label='Waiting room'>"
    + "<div class='ed2-modal-head tbl-head'>"
      + "<b class='tbl-rtitle' id='tblRoomTitle'>" + e(title) + "</b>"
      + "<span id='tblRoomPill'>" + tboGamePill(tboRoomLabel()) + "</span>"
      + "<span class='sg-head-gap'></span>"
      + (TBL.room ? "<span class='tbl-bigcode'>" + e(TBL.room) + "</span>"
          + "<button class='ed2-btn tiny primary' id='tblCopyCode' onclick='tboCopyCode()'>Copy code</button>"
          + "<button class='ed2-btn tiny' onclick='tboCopyInvite()'>Copy invite link</button>"
          + "<span class='tbl-dcslot' id='tblRoomDc'></span>" : '')
      + "<button class='ed2-btn close-x nb nb-red nb-m wh-x' onclick='tblCloseSetup()'>Close &#10005;</button></div>"
    + "<div class='tbl-room'>"
      + "<div class='tbl-rmain'>"
        + "<div class='tbl-rstatus' id='tblRoomStatus'></div>"
        + "<div class='tbl-rdc' id='tblRoomDcEdit'></div>"
        + "<div class='tbl-seatgrid' id='tblRoomSeats'></div>"
        + "<div class='tbl-ractions' id='tblRoomActions'></div>"
      + "</div>"
      + "<div class='tbl-rside'>"
        + "<div class='tbl-sideh spect-ink'>Spectating</div>"
        + "<div class='tbl-rspect' id='tblRoomSpect'></div>"
        + "<div class='tbl-sideh'>Table Chat</div>"
        + "<div class='tbl-chatlog' id='tblRoomChat'></div>"
        + "<div class='tbl-chatin'><input id='tblRoomSay' maxlength='300' aria-label='Table chat'"
          + " placeholder='Say something &mdash; Enter to send' onkeydown='tblSayKey(event)'></div>"
      + "</div>"
    + "</div></div>";
}
function tboRoomLabel(){
  if(REBIRTH) return '';
  return (TBL.table && TBL.table.mode === 'draft') ? tboTableLabel(TBL.table)
                                                  : tboFmtLabel(tboTableFormat());
}
function tboHostSeat(){
  var s = TBL.seats || {};
  for(var k in s) if(s.hasOwnProperty(k) && s[k] && s[k].id === TBL.hostId) return s[k];
  return null;
}

function tboRoomRender(){
  var st = document.getElementById('tblRoomStatus');
  if(!st) return;
  var t = TBL.table || {};
  var ttl = document.getElementById('tblRoomTitle');
  var hs = tboHostSeat();
  if(ttl) ttl.textContent = t.name || ((hs ? hs.name : (TBL.name || 'Player')) + "'s table");
  var pill = document.getElementById('tblRoomPill');
  if(pill) pill.innerHTML = tboGamePill(tboRoomLabel());

  var words;
  if(TBL.status === 'joining') words = e('Connecting…');
  else if(TBL.status === 'lost') words = e('Reconnecting…');
  else {
    var gap = (TBL.cap || 2) - tblSeated().length;
    words = gap > 0 ? ('Waiting for <b>' + gap + ' more</b>') : 'Everyone is here';
    /* more chairs asked for than given: a relay from before six seats (seatsMost, relay/worker.js) */
    if(tboIsHost() && (+TBL.want || 0) > (TBL.cap || 2))
      words += " &middot; <span class='tbl-capnote'>This relay seats " + (TBL.cap || 2)
        + ' at most until it is updated</span>';
    if(TBL.table){
      words += ' &middot; ' + (tboIsHost() ? tboPPHTML('room', !!t.pub)
                                           : (t.pub ? 'Public' : 'Private'));
      if(t.spect === false) words += " &middot; <span class='spect-ink'>No spectators</span>";
      if(t.strict) words += " &middot; <span class='tbl-strict-ink'>Deck Restrictions</span>";
      if(t.mode === 'draft' && typeof drRunning === 'function' && drRunning())
        words += " &middot; <b>Drafting</b>";
    }
    var nw = (TBL.watchList || []).length;
    if(nw) words += " &middot; <span class='spect-ink'>" + nw + ' spectating</span>';
    if(tbsDiffers()) words += " &middot; " + tbsBtnHTML();
  }
  st.innerHTML = words;

  /* Not legal any more at a restricted table: the host may have switched the restriction on, or the deck changed underneath. */
  if(TBO.ready && !TBL.watch && tblOn() && !tboMayReady()){
    TBO.ready = false;
    tboSendSeat();
  }

  var seats = TBL.seats || {}, cap = TBL.cap || 2;
  var fmt = tboTableFormat();
  var h = '';
  TD_SEATS.slice(0, cap).forEach(function(k){
    var p = seats[k];
    if(!p || !tblOn()){
      h += "<div class='tbl-seatcard open'><div class='tbl-av'>+</div>"
        + "<div><div class='tbl-swho'>Open seat</div></div></div>";
      return;
    }
    var me = !TBL.watch && k === TD.side;
    var isHost = p.id === TBL.hostId;
    var badge = isHost ? (REBIRTH ? "<span class='tbl-hostbadge tbl-dmbadge'>DM</span>"
                                  : "<span class='tbl-hostbadge'>Host</span>") : '';
    var av = (REBIRTH && typeof tdGfAvatarHTML === 'function') ? tdGfAvatarHTML(k, p, me)
      : "<div class='tbl-av tbl-seat-" + k + "'>" + e((p.name || '?').charAt(0).toUpperCase()) + "</div>";
    /* Ready reads "Ready ✓" pressed or not: the green fill is what says you have. */
    if(me){
      var j = tboJudge(tboDeckEntry(TBO.deckPick), fmt);
      var may = tboMayReady();
      var dmr = tboDmRole();
      h += "<div class='tbl-seatcard me'>" + av + "<div class='tbl-sbody'>"
        + "<div class='tbl-stop'><div class='tbl-swho'>" + e(p.name)
        + " <span class='tbl-you'>(you)</span>" + badge + "</div>"
        + "<button class='ed2-btn tiny tbl-readybtn" + (TBO.ready ? ' on' : '') + "' id='tblReadyBtn'"
        + " aria-pressed='" + (TBO.ready ? 'true' : 'false') + "'"
        + ((may || TBO.ready) ? '' : ' disabled') + " onclick='tboToggleReady()'>Ready &#10003;</button></div>"
        + (dmr === 'dm' ? "<div class='tbl-sdeckrow'><span class='tbl-sdeckname'>DM only</span></div>"
          : "<div class='tbl-sdeckrow'>" + tboMarkHTML(j.legal)
          + tboDeckSelectHTML('tblRDeck', TBO.deckPick, "tboPickDeck(this.value)")
          + "<span class='tbl-dcount'>" + e(j.counts) + "</span></div>")
        + (dmr ? tboDmSeatHTML() : '')
        + "</div></div>";
      return;
    }
    var info = TBO.seatInfo[k];
    h += "<div class='tbl-seatcard'>" + av + "<div class='tbl-sbody'>"
      + "<div class='tbl-stop'><div class='tbl-swho'>" + e(p.name) + badge + "</div>"
      + "<span class='tbl-ready" + (info && info.ready ? '' : ' not') + "'>"
      + (info && info.ready ? 'Ready &#10003;' : 'Not ready') + "</span></div>"
      + ((info && info.dm === 'dm') ? "<div class='tbl-sdeck'><span class='tbl-sdeckname'>DM only</span></div>"
        : "<div class='tbl-sdeck'>" + (info ? tboMarkHTML(info.legal) : '')
      + "<span class='tbl-sdeckname'>Deck: " + (info ? "<b>" + e(info.deck) + "</b>"
          + (info.counts ? ' &middot; ' + e(info.counts) : '') : '&mdash;') + "</span></div>")
      + "</div></div>";
  });
  var sg = document.getElementById('tblRoomSeats');
  /* Not while you are choosing: a redraw replaces the deck list under the pointer and shuts it mid-choice; the next change draws them. */
  var sel = document.getElementById('tblRDeck');
  /* nor while the DM is typing their decks */
  var dmIn = document.getElementById('tblDmRoomDecks');
  if(sg && !(sel && document.activeElement === sel) && !(dmIn && document.activeElement === dmIn)) sg.innerHTML = h;

  var acts = document.getElementById('tblRoomActions');
  if(acts){
    var a = '';
    if(!TBL.watch && !tboIsHost() && tblOn()) a += "<span class='tbl-rhint'>Only the host can start.</span>";
    a += "<span class='tbl-gap'></span>"
      + "<button class='ed2-btn danger' id='tblLeaveBtn' onclick='tblLeaveAsk()'>"
      + (TBL.watch ? 'Leave' : 'Leave table') + "</button>";
    var isDraft = !!(TBL.table && TBL.table.mode === 'draft') && typeof DR !== 'undefined';
    if(isDraft && !TBL.watch && DR.mode && DR.mode !== 'solo' && !DR.open)
      a += "<button class='ed2-btn tbl-gold' id='tblDraftOpen' onclick='drShow();drRender()'>Open draft</button>";
    if(isDraft && tboIsHost())
      a += "<button class='ed2-btn tbl-gold tbl-big' id='tblDraftBtn' onclick='drHostStart()'"
        + (tblOn() && TBL.phase === 'waiting' && !drRunning() ? '' : ' disabled') + ">Start Draft</button>";
    if(!TBL.watch)
      a += "<button class='ed2-btn tbl-green tbl-big' id='tblStartBtn' onclick='tboStart()'"
        + (tboCanStart() ? '' : ' disabled') + ">Start Game</button>";
    acts.innerHTML = a;
  }

  var sp = document.getElementById('tblRoomSpect');
  if(sp) sp.className = 'tbl-rspect spect-ink';
  if(sp) sp.textContent = (TBL.watchList || []).map(function(w){ return w.name; }).join(', ')
                          || '—';
  tboDiscordRender();
  tboChatLogRender();
}

/* A downloaded copy has no address of its own to hand out, so its invite is playconjure.com's. */
function tboInviteUrl(){
  var base = '';
  try{
    if(/^https?:$/.test(location.protocol)) base = location.origin + location.pathname;
  }catch(_){}
  if(!base) base = 'https://playconjure.com/card_catalog.html';
  return base + '?game=' + tboGame() + '&table=' + encodeURIComponent(TBL.room || '');
}
function tboCopy(text, done){
  var ok = function(){ if(typeof toast === 'function') toast(done); };
  try{
    if(navigator.clipboard && navigator.clipboard.writeText){
      navigator.clipboard.writeText(text).then(ok, function(){ tboCopyOld(text) && ok(); });
      return;
    }
  }catch(_){}
  if(tboCopyOld(text)) ok();
}
function tboCopyOld(text){
  try{
    var ta = document.createElement('textarea');
    ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0';
    document.body.appendChild(ta); ta.select();
    var r = document.execCommand('copy');
    ta.remove();
    return r;
  }catch(_){ return false; }
}
function tboCopyCode(){ tboCopy(TBL.room || '', 'Code copied'); }
function tboCopyInvite(){ tboCopy(tboInviteUrl(), 'Invite link copied'); }

/* The code is taken off the address once used, or a reload reopens it; a phone has no online table, so there it only says so (HANDOFF §82). */
(function(){
  var m = /[?&]table=([A-Za-z2-9]{6})(?:&|$)/.exec(location.search || '');
  if(!m) return;
  var code = m[1].toUpperCase();
  setTimeout(function(){
    try{
      var clean = (typeof _urlWithout === 'function') ? _urlWithout(['table']) : null;
      if(clean !== null) history.replaceState(null, '', clean);
    }catch(_){}
    if(typeof catIsPhone === 'function' && catIsPhone()){
      if(typeof window.toast === 'function') window.toast('Online play needs a larger screen.');
      return;
    }
    if(tblAtTable()) return;
    TBO.prefill = code;
    try{ tblPlayOnline(); }catch(_){}
    setTimeout(function(){
      var b = document.getElementById('tblJoinBtn');
      if(b) b.focus();
    }, 30);
  }, 500);
})();

/* It travels between the players, not through the relay, whose table fields are fixed (tableMeta, relay/worker.js).
   '' is sent like a link, so a copy kept through a dropped connection is put right. */

/* A copy of the header Discord button's path (markup_head.html): the header's icons are not in the sprite. */
function tboDiscordLogo(){
  return "<svg class='tbl-dc-logo' viewBox='0 0 24 24' fill='currentColor' aria-hidden='true'"
    + " focusable='false'><path d='M20.317 4.37a19.791 19.791 0 0 0-4.885-1.515.074.074 0 0 0-.079.037c-.21.375-.444.864-.608 1.25a18.27 18.27 0 0 0-5.487 0 12.64 12.64 0 0 0-.617-1.25.077.077 0 0 0-.079-.037A19.736 19.736 0 0 0 3.677 4.37a.07.07 0 0 0-.032.027C.533 9.046-.32 13.58.099 18.057a.082.082 0 0 0 .031.057 19.9 19.9 0 0 0 5.993 3.03.078.078 0 0 0 .084-.028 14.09 14.09 0 0 0 1.226-1.994.076.076 0 0 0-.041-.106 13.107 13.107 0 0 1-1.872-.892.077.077 0 0 1-.008-.128 10.2 10.2 0 0 0 .372-.292.074.074 0 0 1 .077-.01c3.928 1.793 8.18 1.793 12.062 0a.074.074 0 0 1 .078.01c.12.098.246.198.373.292a.077.077 0 0 1-.006.127 12.299 12.299 0 0 1-1.873.892.077.077 0 0 0-.041.107c.36.698.772 1.362 1.225 1.993a.076.076 0 0 0 .084.028 19.839 19.839 0 0 0 6.002-3.03.077.077 0 0 0 .032-.054c.5-5.177-.838-9.674-3.549-13.66a.061.061 0 0 0-.031-.03zM8.02 15.33c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.956-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.956 2.418-2.157 2.418zm7.975 0c-1.183 0-2.157-1.085-2.157-2.419 0-1.333.955-2.419 2.157-2.419 1.21 0 2.176 1.096 2.157 2.42 0 1.333-.946 2.418-2.157 2.418z'/></svg>";
}
function tboDiscordClean(raw){
  var s = String(raw == null ? '' : raw).trim();
  if(!s) return {url:'', why:''};
  if(!/^[a-z][a-z0-9+.-]*:/i.test(s)) s = 'https://' + s;
  var m = /^https?:[/][/]([^/?#]*)(.*)$/i.exec(s);
  var u = m ? tgDiscord('https://' + m[1].toLowerCase().replace(/^www[.]/, '') + m[2]) : '';
  return u ? {url:u, why:''} : {url:'', why:'Only Discord links: discord.gg/… or discord.com/…'};
}
function tboDiscordShort(u){
  var s = String(u || '').replace(/^https:[/][/]/, '');
  return s.length > 30 ? s.slice(0, 29) + '…' : s;
}
function tboDiscordRemember(u){
  TBO.discordLast = u || '';
  try{ localStorage.setItem(TBO_DISCORD_KEY, TBO.discordLast); }catch(_){}
}

function tboDiscordHTML(where){
  var u = (typeof TBO !== 'undefined') ? TBO.discord : '';
  if(!u) return '';
  var board = (where === 'board');
  return "<span class='tbl-dc'>" + tboDiscordLogo()
    + "<a class='tbl-dc-url' href='" + e(u) + "' target='_blank' rel='noopener noreferrer'"
      + " title='" + e(u) + "' aria-label='" + e('Discord ' + u) + "' onclick='return tboDiscordGo(event)'>"
      + "<span>" + e(tboDiscordShort(u)) + "</span></a>"
    + "<button type='button' class='ed2-btn tiny " + (board ? 'tbl-tool tbl-green' : 'primary')
      + " tbl-dc-join' title='" + e('Open ' + u + ' in a new tab, and copy it') + "' aria-label='Join on Discord'"
      + " onclick='tboDiscordGo(event)'>" + uiIco('arrow-right') + "<span class='tbl-tw'>Join</span></button>"
    + "</span>";
}
/* Copied before it is opened: the new tab takes the focus, and a page without it may be refused the clipboard. */
function tboDiscordGo(ev){
  if(ev && ev.preventDefault) ev.preventDefault();
  var u = TBO.discord;
  if(!u) return false;
  tboCopy(u, 'Discord link copied');
  try{ window.open(u, '_blank', 'noopener'); }catch(_){}
  return false;
}

function tboDiscordTell(to){
  if(!tboIsHost() || !tblOn()) return false;
  var m = {t:'discord', url:TBO.discord || ''};
  if(to) m.to = to;
  return tblSend(m);
}
function tboDiscordFrom(msg, fromId){
  if(!msg || !fromId || fromId !== TBL.hostId) return;
  var u = msg.url ? tgDiscord(msg.url) : '';
  if(msg.url && !u) return;
  if(u === TBO.discord) return;
  TBO.discord = u;
  tblRenderPanel();
}

function tboDiscordInputHTML(id, val, more){
  return "<input id='" + id + "' class='tbl-dcin' maxlength='200' value='" + e(val || '') + "'"
    + " placeholder='https://discord.gg/…' aria-labelledby='" + id + "L' aria-describedby='" + id + "Why'"
    + " spellcheck='false' autocomplete='off' oninput='tboDiscordTyping(this)' " + (more || '') + ">";
}
function tboDiscordWhyHTML(id){
  return "<p class='tbl-dcwhy' id='" + id + "Why' role='alert' hidden></p>";
}
function tboDiscordWhy(inp, why){
  var p = document.getElementById(inp.id + 'Why');
  if(p){ p.textContent = why || ''; p.hidden = !why; }
  if(why) inp.setAttribute('aria-invalid', 'true');
  else inp.removeAttribute('aria-invalid');
}
function tboDiscordCheck(inp){
  var c = tboDiscordClean(inp.value);
  tboDiscordWhy(inp, c.why);
  return c;
}
function tboDiscordField(inp){
  var c = tboDiscordCheck(inp);
  if(c.url) inp.value = c.url;
}
/* Typing only ever takes a reason away - once what is in the box will do. */
function tboDiscordTyping(inp){
  var p = document.getElementById(inp.id + 'Why');
  if(p && !p.hidden && !tboDiscordClean(inp.value).why) tboDiscordWhy(inp, '');
}

/* Each drawn again only when it has changed: the room redraws with every heartbeat, and a replaced button loses the click, a replaced box the typing. */
function tboDiscordRender(){
  var slot = document.getElementById('tblRoomDc');
  if(slot){
    var h = tboDiscordHTML('room');
    if(slot._tboH !== h){ slot.innerHTML = h; slot._tboH = h; }
  }
  var ed = document.getElementById('tblRoomDcEdit');
  if(!ed) return;
  var mine = tboIsHost() && tblOn();
  var k = mine ? (TBO.discord ? 'set' : 'none') : '';
  if(ed._tboK === k) return;
  var had = (document.activeElement && ed.contains(document.activeElement)) ? document.activeElement.id : '';
  ed._tboK = k;
  ed.innerHTML = !mine ? '' : "<span class='tbl-lbl' id='tblRDiscordL'>Discord Link</span>"
    + tboDiscordInputHTML('tblRDiscord', TBO.discord, "onkeydown='tboDiscordKey(event)'")
    + "<button type='button' class='ed2-btn tiny primary' id='tblRDiscordSave' onclick='tboDiscordSave()'>Save</button>"
    + (TBO.discord ? "<button type='button' class='ed2-btn tiny danger' id='tblRDiscordDel'"
        + " onclick='tboDiscordRemove()'>Remove</button>" : '')
    + tboDiscordWhyHTML('tblRDiscord');
  /* Save or Remove pressed from the keyboard: it stays in the box */
  if(had){
    var back = document.getElementById(had) || document.getElementById('tblRDiscord');
    if(back) back.focus();
  }
}
function tboDiscordKey(ev){
  if(ev.key === 'Enter'){ ev.preventDefault(); tboDiscordSave(); }
}
function tboDiscordSave(){
  var inp = document.getElementById('tblRDiscord');
  if(!inp || !tboIsHost() || !tblOn()) return false;
  var c = tboDiscordCheck(inp);
  if(c.why){ inp.focus(); return false; }
  inp.value = c.url;
  tboDiscordSet(c.url);
  return true;
}
function tboDiscordRemove(){
  if(!tboIsHost() || !tblOn()) return false;
  var inp = document.getElementById('tblRDiscord');
  if(inp){ inp.value = ''; tboDiscordWhy(inp, ''); }
  tboDiscordSet('');
  return true;
}
/* A link taken away is not forgotten: Options still offers the last link hosted with. */
function tboDiscordSet(u){
  if(u === TBO.discord) return;
  TBO.discord = u;
  if(u) tboDiscordRemember(u);
  tboDiscordTell('');
  tblRenderPanel();
}


function tboOnJoined(m, wasPhase){
  var first = (TBO.seenJoin !== TBL.room);
  TBO.seenJoin = TBL.room;
  tbsSend(true);
  /* Only when it has one: a host whose page was reloaded has none, and saying '' would take it from everyone who still has it. */
  if(TBO.discord) tboDiscordTell('');
  if(first){
    TBO.chat = []; TBO.unread = 0;
    tboChatSys(TBL.watch ? 'You are spectating'
      : (m.first && TBL.phase === 'waiting' ? 'You opened the table' : 'You sat down'), TBL.watch);
  }
  if(TBL.phase === 'waiting'){
    if(!TBL.watch) tboSendSeat();
    if(first || tboDialogOpen()){
      if(!tboDialogOpen()) tblOpenSetup('room');
      else { TBO.view = 'room'; tboRenderDialog(); }
    }
    return;
  }
  /* A connection that dropped in the waiting room and came back after Start missed the deal, so it deals now. */
  if(wasPhase === 'waiting' && !TBL.watch) tboDeal();
  if(tboDialogOpen() && TBO.view === 'room') tblCloseSetup();
}
function tboOnPeer(m){
  if(m.join) tbsSend(true);
  else { delete TBS.byId[m.id]; tbsRefresh(); }
  if(m.join) tboDiscordTell(m.id);
  if(m.watch){
    tboChatSys(m.name + (m.join ? ' is spectating' : ' stopped spectating'), true);
  } else {
    tboChatSys(m.name + (m.join ? ' sat down' : (m.kicked ? ' was removed from the table' : ' left the table')));
    if(!m.join) delete TBO.seatInfo[m.side];
    if(m.join) tboSendSeat();
    if(typeof drOnPeer === 'function') drOnPeer(m);
  }
  if(tboDialogOpen() && TBO.view === 'room') tboRoomRender();
  tboSayToSync();
}
function tboOnStarted(){
  tboChatSys('The game has started');
  if(!TBL.watch) tboDeal();
  tblCloseSetup();
  try{ showTab('testdeck'); }catch(_){}
}

/* The same steps as loading a saved deck from the sidebar (renderSavedDecks), without the question. */
function tboDeal(){
  var entry = null;
  if(TBO.deckPick && tboDmRole() !== 'dm'){
    entry = _savedLoad()[TBO.deckPick];
    if(typeof entry === 'string') entry = {main:entry};
  }
  var fmt = REBIRTH ? 'character'
          : (TBL.table && tboFmtOk(TBL.table.format)) ? TBL.table.format
          : (entry && entry.mode) || _gameMode;
  if(entry){
    Object.keys(DECK_IDS).forEach(function(k){
      var el = document.getElementById(DECK_IDS[k]);
      if(el) el.value = entry[k] || '';
    });
  }
  /* The mode first: tdReadStatRow answers null unless Character is the current mode (renderSavedDecks does the same). */
  try{ if(typeof setGameMode === 'function' && fmt !== _gameMode) setGameMode(fmt); }catch(_){}
  if(entry){
    try{ if(typeof tdWriteStatRow === 'function') tdWriteStatRow(entry); }catch(_){}
    try{ if(typeof tdSyncStatRow === 'function') tdSyncStatRow(); }catch(_){}
  }
  try{ updCnt(); _hashSaveDeck(); refreshDeckView(); }catch(_){}
  TBL.turn = ''; TBL.turnBy = ''; TBL.rbt = null;
  TBL.grants = {};
  TBL.arrows = [];
  if(typeof tdTsForget === 'function') tdTsForget();
  TD._dmDeal = tboDmRole() ? {role:tboDmRole(), fresh:true,
                              decks:(typeof tdDmMatch === 'function' ? tdDmMatch(TBO.host.dmList || '').found : [])}
                           : null;
  tdStart(true);             /* deliberate: this is the game now */
  tblSendState();
  tdFeedPush('me', '— new game —');
  tblRenderPanel();
}

function tboReset(){
  if(typeof drOnLeave === 'function') drOnLeave();
  tbsReset();
  TBO.ready = false;
  TBO.discord = '';
  TBO.seatInfo = {};
  TBO.seenJoin = '';
  TBO.chat = [];
  TBO.unread = 0;
  TBO.chatOpen = false;
  TBO.sayTo = ''; TBO.sayToName = '';
  TBO.dmTook = '';
  var c = document.getElementById('tblChat');
  if(c) c.remove();
  if(typeof TD !== 'undefined'){ TD._dmDeal = null; TD._dmOpen = null; TD.dmCur = ''; }
  var dw = document.getElementById('tdDmWin');
  if(dw) dw.remove();
}

function tboChatPush(en){
  TBO.chat.push(en);
  if(TBO.chat.length > 300) TBO.chat.shift();
  if(!en.sys && !en.me && !tboChatVisible()){
    TBO.unread++;
    tblRenderPanel();
  }
  tboChatLogRender();
}
function tboChatSys(text, spect){ tboChatPush({sys:true, spect:!!spect, text:String(text || '')}); }
/* wh: a whisper's mark, 'to Ruth' on yours and 'to you' on theirs (tblSay). */
function tboChatMine(text, wh){
  tboChatPush({me:true, name:TBL.name || 'You', side:TBL.watch ? '' : TD.side,
               spect:!!TBL.watch, text:text, wh:wh || ''});
}
function tboChatSay(text, fromId, wh){
  var side = tblSideOf(fromId);
  var name = side ? tblSeatName(side) : '';
  if(!side){
    (TBL.watchList || []).forEach(function(w){ if(w.id === fromId) name = w.name; });
  }
  tboChatPush({name:name || 'Spectator', side:side, spect:!side,
               text:String(text || '').slice(0, 300), wh:wh || ''});
}
function tboChatVisible(){
  return !!document.getElementById('tblChat')
    || (tboDialogOpen() && TBO.view === 'room');
}
function tboChatHTML(){
  return TBO.chat.map(function(c){
    /* Anything about spectating, and anybody spectating, is purple (HANDOFF §12.1 D). */
    if(c.sys) return "<div class='tbl-csys" + (c.spect ? ' spect-ink' : '') + "'>" + e(c.text) + "</div>";
    return "<div class='tbl-cm'><b class='" + (c.spect ? 'spect-ink' : (c.side ? 'tbl-ink-' + c.side : '')) + "'>"
      + e(c.name) + "</b>" + (c.wh ? "<i class='tbl-cwh'>" + e(c.wh) + "</i>" : '') + e(c.text) + "</div>";
  }).join('');
}
/* Only when it changed, and it follows new lines only when you were already at the bottom: the room redraws on every change. */
function tboChatLogRender(){
  var html = tboChatHTML();
  ['tblRoomChat', 'tblChatLog'].forEach(function(id){
    var el = document.getElementById(id);
    if(!el || el._tboHtml === html) return;
    var atEnd = !el._tboHtml || (el.scrollHeight - el.scrollTop - el.clientHeight < 40);
    var top = el.scrollTop;
    el.innerHTML = html;
    el._tboHtml = html;
    el.scrollTop = atEnd ? el.scrollHeight : top;
  });
  var who = document.getElementById('tblChatWho');
  if(who){
    var names = (TBL.watchList || []).map(function(w){ return w.name; });
    who.textContent = names.length ? names.join(', ') + ' spectating' : '';
    who.hidden = !names.length;
  }
}

function tboChatToggle(on){
  TBO.chatOpen = (on === undefined) ? !TBO.chatOpen : !!on;
  if(TBO.chatOpen) TBO.unread = 0;
  tboChatPanel();
  tblRenderPanel();
  if(TBO.chatOpen){
    var i = document.getElementById('tblSayIn');
    if(i) i.focus();
  }
}
function tboChatPanel(){
  var old = document.getElementById('tblChat');
  var pane = document.getElementById('pane-testdeck');
  var want = TBO.chatOpen && tblOn() && TBL.phase !== 'waiting' && !!pane;
  if(!want){
    if(old) old.remove();
    return;
  }
  var mode = 'pop';
  if(old && old.getAttribute('data-mode') === mode){ tboSayToSync(); return; }
  if(old) old.remove();
  var el = document.createElement('div');
  el.id = 'tblChat';
  el.setAttribute('data-mode', mode);
  el.className = 'tbl-chat tbl-chat-' + mode;
  /* a window beside the board, not over it: the board stays usable */
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'false');
  el.setAttribute('aria-label', 'Table Chat');
  el.innerHTML = "<div class='tbl-chathead td-fw-head'><b class='td-fw-title'>Table Chat</b><span class='tbl-gap'></span>"
    + "<button class='ed2-btn tiny close-x' onclick='tboChatToggle(false)'>Close &#10005;</button></div>"
    + "<div class='tbl-chatwho spect-ink' id='tblChatWho' hidden></div>"
    + "<div class='tbl-chatlog' id='tblChatLog'></div>"
    + "<div class='tbl-chatin'>" + tboSayToHTML() + "<input id='tblSayIn' maxlength='300' aria-label='Table chat'"
    + " placeholder='Say something &mdash; Enter to send' onkeydown='tblSayKey(event)'></div>";
  pane.appendChild(el);
  tboSayToSync();
  tboChatLogRender();
  if(typeof tdFloatWin === 'function') tdFloatWin(el, 'chat');
}
/* The To picker at a Rebirth table: Everyone, or one person seated there. A spectator says everything to everyone. */
function tboSayToList(){
  if(!REBIRTH || TBL.watch) return [];
  var seats = TBL.seats || {};
  return TD_SEATS.filter(function(k){ return seats[k] && k !== TD.side && seats[k].id; })
    .map(function(k){ return {id:seats[k].id, name:seats[k].name || 'Player'}; });
}
/* Somebody picked who has gone stays picked, so nothing meant for them goes to everyone (tblSayKey). */
function tboSayToOptions(list){
  var cur = TBO.sayTo, have = false;
  var opts = list.map(function(p){
    if(p.id === cur) have = true;
    return "<option value='" + e(p.id) + "'" + (p.id === cur ? ' selected' : '') + ">" + e(p.name) + "</option>";
  });
  if(cur && !have) opts.push("<option value='" + e(cur) + "' selected>" + e(TBO.sayToName || 'Player') + "</option>");
  return "<option value=''" + (cur ? '' : ' selected') + ">Everyone</option>" + opts.join('');
}
function tboSayToHTML(){
  var list = tboSayToList();
  if(!list.length && !TBO.sayTo) return '';
  return "<select id='tblSayTo' class='tbl-select tbl-sayto' aria-label='To' title='To'"
    + " onchange='tboSayToPick(this.value)'>" + tboSayToOptions(list) + "</select>";
}
function tboSayToPick(v){
  var p = tboSayToList().filter(function(x){ return x.id === v; })[0];
  if(p || !v){ TBO.sayTo = p ? p.id : ''; TBO.sayToName = p ? p.name : ''; }
  tboSayToSync();
  var i = document.getElementById('tblSayIn');
  if(i) try{ i.focus(); }catch(_){}
}
/* Redrawn only when the seats changed, so a list held open is not shut by a render. */
function tboSayToSync(){
  var row = document.querySelector('#tblChat .tbl-chatin');
  if(!row) return;
  var sel = document.getElementById('tblSayTo'), list = tboSayToList();
  if(!list.length && !TBO.sayTo){ if(sel) sel.remove(); return; }
  var opts = tboSayToOptions(list);
  if(!sel){
    row.insertAdjacentHTML('afterbegin', tboSayToHTML());
    sel = document.getElementById('tblSayTo');
  } else if(sel._tboOpts !== opts) sel.innerHTML = opts;
  if(sel) sel._tboOpts = opts;
}
/* Whom the chat window's line goes to: null for everyone, or {id, name}, with gone while they are not seated. */
function tboSayToNow(){
  if(!TBO.sayTo) return null;
  var p = tboSayToList().filter(function(x){ return x.id === TBO.sayTo; })[0];
  return p || {id:TBO.sayTo, name:TBO.sayToName || 'Player', gone:true};
}

/* A spectator may send only `say`, `want` and `bye` (relay/PROTOCOL.md), so its ask is a `want` carrying `cards` (HANDOFF §77.11). */
var TBS = {byId:{}, lastSent:'', parts:{}, busy:{}, served:{}, openOnJoin:false};
function tbsReset(){
  TBS.byId = {}; TBS.lastSent = ''; TBS.parts = {}; TBS.busy = {}; TBS.served = {}; TBS.openOnJoin = false;
  tbsClose();
}
function tbsMine(){
  try{ return (typeof window.edSagaSummary === 'function') ? (window.edSagaSummary() || []) : []; }
  catch(_){ return []; }
}
function tbsDeckSagas(){
  if(typeof window.edSagaIdsOf !== 'function' || typeof parseDeckLines !== 'function') return [];
  var out = {};
  try{
    var en = tboDeckEntry(TBO.deckPick), map = tboCardMap();
    ['main', 'essence', 'wish', 'armament'].forEach(function(k){
      parseDeckLines(en[k] || '').forEach(function(l){
        var c = map[l.name];
        if(c) window.edSagaIdsOf(c).forEach(function(id){ out[id] = 1; });
      });
    });
  }catch(_){}
  return Object.keys(out);
}
function tbsSend(force){
  if(!tblOn() || TBL.watch) return false;
  var m = {t:'cards', v:1, sagas:tbsMine(), deck:tbsDeckSagas()};
  var key = JSON.stringify(m);
  if(!force && key === TBS.lastSent) return false;
  TBS.lastSent = key;
  return tblSend(m);
}
function tbsOnMsg(msg, fromId){
  if(!msg) return false;
  var mineTo = !msg.to || msg.to === TBL.you;
  if(msg.t === 'cards'){ tbsFrom(msg, fromId); return true; }
  if(msg.t === 'cardsask'){ tbsSend(true); return true; }
  if(msg.t === 'cardsget'){ if(mineTo) tbsServe(String(msg.saga || ''), fromId); return true; }
  if(msg.t === 'want' && msg.cards){
    if(mineTo){ if(msg.cards === '?') tbsSend(true); else tbsServe(String(msg.cards), fromId); }
    return true;
  }
  if(msg.t === 'sagapart'){ if(msg.to && msg.to === TBL.you) tbsPart(msg, fromId); return true; }
  return false;
}
function tbsClean(list){
  return (Array.isArray(list) ? list : []).slice(0, 300).filter(function(s){ return s && s.id; })
    .map(function(s){
      return {id:String(s.id).slice(0, 80), name:String(s.name || s.id).slice(0, 80),
              url:String(s.url || '').slice(0, 400), n:+s.n || 0, h:String(s.h || '').slice(0, 40),
              on:s.on !== false, official:!!s.official, table:!!s.table, own:!!s.own, pend:!!s.pend};
    });
}
function tbsFrom(msg, fromId){
  TBS.byId[fromId] = {sagas:tbsClean(msg.sagas),
                      deck:(Array.isArray(msg.deck) ? msg.deck : []).slice(0, 300).map(String),
                      at:Date.now()};
  if(TBS.openOnJoin && fromId === TBL.hostId){ TBS.openOnJoin = false; tbsOpen(); return; }
  tbsRefresh();
}
function tbsWho(id){
  try{ return tblFromName(id) || 'Player'; }catch(_){ return 'Player'; }
}
function tbsIAmHost(){ return !TBL.watch && !!TBL.hostId && TBL.hostId === TBL.you; }

function tbsRows(){
  var mine = {}, rows = [];
  tbsMine().forEach(function(s){ mine[s.id] = s; });
  var host = tbsIAmHost();
  var against = host ? Object.keys(TBS.byId).filter(function(id){ return id !== TBL.you; })
                     : (TBL.hostId ? [TBL.hostId] : []);
  against.forEach(function(pid){
    var p = TBS.byId[pid]; if(!p) return;
    var deck = {}; (p.deck || []).forEach(function(id){ deck[id] = 1; });
    var theirs = p.sagas.filter(function(s){ return s.on; });
    /* the host looks at what each player's deck needs; a player looks at
       everything the host has in play */
    if(host && (p.deck || []).length) theirs = theirs.filter(function(s){ return deck[s.id]; });
    theirs.sort(function(a, b){
      return (deck[b.id] ? 1 : 0) - (deck[a.id] ? 1 : 0) || String(a.name).localeCompare(String(b.name)); });
    theirs.forEach(function(s){
      var m = mine[s.id], kind = '';
      if(!m) kind = s.url ? 'follow' : 'get';
      else if(!m.on) kind = 'on';
      else if(m.h !== s.h){
        if(s.pend) kind = 'theyold';
        else if(m.pend) kind = 'update';
        else if(s.own) kind = 'unpub';
        else if(m.url) kind = 'update';
        else if(m.table) kind = 'get';
        else kind = 'yours';
      }
      if(kind) rows.push({pid:pid, who:tbsWho(pid), saga:s, kind:kind, inDeck:!!deck[s.id]});
    });
  });
  if(!host && TBL.hostId && TBS.byId[TBL.hostId]){
    var hs = {};
    TBS.byId[TBL.hostId].sagas.forEach(function(s){ hs[s.id] = s; });
    tbsDeckSagas().forEach(function(id){
      var m = mine[id]; if(!m) return;
      var h = hs[id];
      if(!h || !h.on) rows.push({pid:TBL.hostId, who:tbsWho(TBL.hostId), saga:m, kind:'theylack', inDeck:true});
    });
  }
  return rows;
}
function tbsDiffers(){
  if(!tblAtTable()) return false;
  try{ return tbsRows().length > 0; }catch(_){ return false; }
}
function tbsLabel(){ return tbsIAmHost() ? 'Sync Cards' : 'Sync Cards with Host'; }
function tbsBtnHTML(){
  return "<button type='button' class='ed2-btn tiny tbl-syncbtn' onclick='tbsOpen()'>" + e(tbsLabel()) + "</button>";
}
function tbsToolHTML(){
  if(!tbsDiffers()) return '';
  return tblToolHTML('sync', "tbsOpen()", tbsLabel(), 0, false, 'tbl-keep tbl-sync',
                     'What differs between your cards and the table\u2019s');
}
function tbsRowHTML(r){
  var s = r.saga, who = e(r.who);
  var busy = TBS.busy[s.id];
  var nm = "<b>" + e(s.name) + "</b><span class='tbs-n'>" + (s.n || 0)
    + ((s.n === 1) ? ' card' : ' cards') + "</span>";
  var why = '', btn = '';
  var dataS = " data-s=\"" + e(s.id) + "\" data-p=\"" + e(r.pid) + "\"";
  if(r.kind === 'follow'){
    why = "you do not have it";
    btn = "<button class='ed2-btn tiny primary' data-u=\"" + e(s.url) + "\" data-o='" + (s.official ? 1 : 0)
      + "' onclick='tbsFollow(this)'>Follow</button>";
  } else if(r.kind === 'get'){
    why = (r.saga && mineHas(s.id)) ? "different on your copy" : "only on " + who + "\u2019s computer";
    btn = busy ? "<span class='tbs-busy'>Receiving\u2026" + (busy.n ? ' ' + busy.got + '/' + busy.n : '') + "</span>"
               : "<button class='ed2-btn tiny primary'" + dataS + " onclick='tbsGetBtn(this)'>Get from "
                 + (r.pid === TBL.hostId ? 'Host' : who) + "</button>";
  } else if(r.kind === 'on'){
    why = "switched off here";
    btn = "<button class='ed2-btn tiny primary'" + dataS + " onclick='tbsTurnOn(this)'>Turn on</button>";
  } else if(r.kind === 'update'){
    why = "yours is older";
    btn = "<button class='ed2-btn tiny primary'" + dataS + " onclick='tbsUpdate(this)'>Update</button>";
  } else if(r.kind === 'theyold'){
    why = who + "\u2019s copy is older \u2014 it is theirs to update";
  } else if(r.kind === 'unpub'){
    why = who + " has changes they have not published";
  } else if(r.kind === 'yours'){
    why = "different on your copy";
  } else if(r.kind === 'theylack'){
    why = "your deck uses it; " + who + " does not have it";
  }
  return "<div class='tbs-row" + (r.inDeck ? ' tbs-deck' : '') + "'>"
    + "<span class='tbs-name'>" + nm + "</span>"
    + "<span class='tbs-why'>" + why + "</span>"
    + "<span class='tbs-act'>" + btn + "</span></div>";
}
function tbsHostOf(u){
  try{
    var x = new URL(String(u || ''));
    return /^https?:$/.test(x.protocol) ? x.host : '';
  }catch(_){ return ''; }
}
function mineHas(id){ return tbsMine().some(function(x){ return x.id === id; }); }
function tbsOpen(){
  TBS.openOnJoin = false;
  var ov = document.getElementById('tbsOv');
  if(!ov){
    ov = document.createElement('div');
    ov.id = 'tbsOv'; ov.className = 'td-ov tbl-ov tbl-ov2 tbs-ov';
    document.body.appendChild(ov);
    ov.addEventListener('click', function(ev){ if(ev.target === ov) tbsClose(); });
    tboHoldKeys(ov, tbsClose);
  }
  if(!tbsIAmHost() && TBL.hostId && !TBS.byId[TBL.hostId])
    tblSend(TBL.watch ? {t:'want', to:TBL.hostId, cards:'?'} : {t:'cardsask'});
  tbsRender();
}
function tbsClose(){
  var ov = document.getElementById('tbsOv');
  if(ov){ tboLetKeys(ov); ov.remove(); }
}
function tbsRender(){
  var ov = document.getElementById('tbsOv');
  if(!ov) return;
  var host = tbsIAmHost(), rows = [];
  try{ rows = tbsRows(); }catch(_){ rows = []; }
  var body;
  if(!host && TBL.hostId && !TBS.byId[TBL.hostId]) body = "<div class='tbs-state'>Waiting for the host\u2019s list of Sagas\u2026</div>";
  else if(!rows.length) body = "<div class='tbs-state ok'>Your cards match " + (host ? "everybody\u2019s at the table" : "the host\u2019s") + ".</div>";
  else body = "<div class='tbs-list'>" + rows.map(tbsRowHTML).join('') + "</div>";
  ov.innerHTML = "<div class='ed2-modal tbl-dlg tbs-dlg' role='dialog' aria-modal='true' aria-label='" + e(tbsLabel()) + "'>"
    + "<div class='ed2-modal-head tbl-head'><b>" + e(tbsLabel()) + "</b><span class='sg-head-gap'></span>"
    + "<button class='ed2-btn close-x nb nb-red nb-m wh-x' onclick='tbsClose()'>Close &#10005;</button></div>"
    + "<div class='tbs-body'>" + body + "</div></div>";
}
function tbsRefresh(){
  tbsRender();
  try{ if(tboDialogOpen() && TBO.view === 'room') tboRoomRender(); }catch(_){}
  try{ tblRenderPanel(); }catch(_){}
}
/* Every board is asked for again too: a card this catalogue did not know was left off its half (tdHydrate), and with the Saga here it shows. */
function tbsAfter(){
  tbsSend(false);
  if(tblOn() && TBL.phase !== 'waiting') tblSend({t:'want'});
  tbsRefresh();
}
/* Followed only when you say so: the address came from their machine, so you are told its site and nothing is fetched before yes. */
function tbsFollow(btn){
  var u = btn.getAttribute('data-u'), off = btn.getAttribute('data-o') === '1';
  if(!off){
    var site = tbsHostOf(u);
    if(!site){
      if(typeof toast === 'function') toast('That is not a web address');
      return Promise.resolve(false);
    }
    if(!confirm('Follow the cards published on ' + site + '?\n\n' + u)) return Promise.resolve(false);
  }
  btn.disabled = true;
  var go = off ? (window.edSyncSourceNow ? window.edSyncSourceNow('official') : null)
               : (window.edFollowSource ? window.edFollowSource(u) : null);
  return Promise.resolve(go).then(tbsAfter, tbsAfter);
}
function tbsTurnOn(btn){
  var id = btn.getAttribute('data-s');
  return Promise.resolve(window.edTurnOnSaga ? window.edTurnOnSaga(id) : null).then(tbsAfter, tbsAfter);
}
function tbsUpdate(btn){
  var id = btn.getAttribute('data-s');
  var k = window.edSagaSourceKey ? window.edSagaSourceKey(id) : '';
  btn.disabled = true;
  return Promise.resolve(k && window.edSyncSourceNow ? window.edSyncSourceNow(k) : null).then(tbsAfter, tbsAfter);
}
function tbsGetBtn(btn){ return tbsGet(btn.getAttribute('data-s'), btn.getAttribute('data-p')); }
var TBS_WAIT = 60000;
function tbsGet(sagaId, fromId){
  if(!sagaId || !fromId) return false;
  delete TBS.parts[fromId + '|' + sagaId];
  var ask = TBS.busy[sagaId] = {got:0, n:0, from:fromId, at:Date.now()};
  tblSend(TBL.watch ? {t:'want', to:fromId, cards:sagaId} : {t:'cardsget', to:fromId, saga:sagaId});
  tbsRender();
  /* A minute after the last piece, not the ask, so a slow transfer is not cut off half way. */
  var check = function(){
    if(TBS.busy[sagaId] !== ask) return;          /* done, or asked again since */
    var quiet = Date.now() - ask.at;
    if(quiet < TBS_WAIT - 1000){ setTimeout(check, TBS_WAIT - quiet); return; }
    delete TBS.busy[sagaId];
    delete TBS.parts[fromId + '|' + sagaId];
    if(typeof toast === 'function') toast('No answer from ' + tbsWho(fromId));
    tbsRender();
  };
  setTimeout(check, TBS_WAIT);
  return true;
}
/* At most once in TBS_RESEND to the same person: a Saga with its pictures is megabytes. */
var TBS_RESEND = 15000;
function tbsServe(sagaId, toId){
  if(!sagaId || !toId || typeof window.edSagaPackage !== 'function') return;
  var here = !!tblSideOf(toId) || (TBL.watchList || []).some(function(w){ return w && w.id === toId; });
  if(!here) return;
  var mine = tbsMine().filter(function(s){ return s.id === sagaId && s.on; })[0];
  if(!mine) return;
  var k = toId + '|' + sagaId, last = TBS.served[k] || 0;
  if(Date.now() - last < TBS_RESEND) return;
  TBS.served[k] = Date.now();
  Promise.resolve(window.edSagaPackage(sagaId)).then(function(pkg){
    if(!pkg) return;
    var json = JSON.stringify(pkg), CH = 180000;
    var n = Math.max(1, Math.ceil(json.length / CH));
    for(var i = 0; i < n; i++)
      tblSend({t:'sagapart', to:toId, saga:sagaId, i:i, n:n, part:json.slice(i * CH, (i + 1) * CH)});
  }).catch(function(){});
}
function tbsSweep(){
  var now = Date.now();
  Object.keys(TBS.parts).forEach(function(k){
    var p = TBS.parts[k], sid = k.slice(k.indexOf('|') + 1), b = TBS.busy[sid];
    if(!b || k.indexOf(b.from + '|') !== 0 || now - p.at > TBS_WAIT) delete TBS.parts[k];
  });
}
function tbsPart(msg, fromId){
  var sid = String(msg.saga || ''), b = TBS.busy[sid];
  if(!sid || !fromId || !b || b.from !== fromId) return;
  var n = msg.n, i = msg.i;
  if(typeof n !== 'number' || typeof i !== 'number' || Math.floor(n) !== n || Math.floor(i) !== i
     || n < 1 || n > 2000 || i < 0 || i >= n || typeof msg.part !== 'string') return;
  tbsSweep();
  var key = fromId + '|' + sid;
  var p = TBS.parts[key];
  if(p && p.n !== n) return;
  if(!p) p = TBS.parts[key] = {n:n, got:0, bits:[], at:0};
  if(p.bits[i] === undefined){ p.bits[i] = msg.part; p.got++; }
  p.at = b.at = Date.now();
  b.got = p.got; b.n = n;
  tbsRender();
  if(p.got < p.n) return;
  delete TBS.parts[key];
  delete TBS.busy[sid];
  var pkg = null;
  try{ pkg = JSON.parse(p.bits.join('')); }catch(_){ pkg = null; }
  if(!pkg || typeof pkg !== 'object' || !pkg.saga || pkg.saga.id !== sid || !Array.isArray(pkg.cards)){
    if(typeof toast === 'function') toast('What ' + tbsWho(fromId) + ' sent could not be read');
    tbsRender();
    return;
  }
  if(typeof window.edImportTableCopy !== 'function' || !tbsAsk(pkg, fromId)){ tbsRender(); return; }
  Promise.resolve(window.edImportTableCopy(pkg, tbsWho(fromId))).then(tbsAfter, tbsAfter);
}
/* Asked every time before anything is added, so nothing lands in your cards that you did not see named first. */
function tbsAsk(pkg, fromId){
  var one = function(v, max){ return String(v == null ? '' : v).replace(/\s+/g, ' ').trim().slice(0, max); };
  var name = one(pkg.saga.name, 80) || one(pkg.saga.id, 80);
  var n = pkg.cards.length;
  var pics = (pkg.pics && typeof pkg.pics === 'object') ? Object.keys(pkg.pics).length : 0;
  var had = tbsMine().some(function(s){ return s.id === pkg.saga.id && s.table; });
  var who = one(tbsWho(fromId), 40);
  return confirm((had ? 'Replace your copy of ' + name + ' with the one from ' + who + '?'
                      : 'Add ' + name + ' from ' + who + '?') + '\n\n'
    + n + (n === 1 ? ' card' : ' cards')
    + (pics ? ', ' + pics + (pics === 1 ? ' picture' : ' pictures') : ''));
}
