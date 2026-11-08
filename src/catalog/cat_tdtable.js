/* Loads before cat_testdeck.js: its tables are set before that file runs, and its functions read TD only when called. */

/* TD.board is only ever your own half; every other half is in TD.foes, changed only by what its owner sends. */
/* TD.foes holds every other half by seat. TD.foe is that half at two players and null at three or more, on purpose. */
/* Six for a Rebirth table (its DM and five players, the relay's seatsMost); the main game's stop at four. */
var TD_SEATS = ['a', 'b', 'c', 'd', 'e', 'f'];
function tdFoeSides(){
  return TD_SEATS.filter(function(s){ return !!(TD.foes && TD.foes[s]); });
}
function tdFoeList(){
  return tdFoeSides().map(function(s){ return TD.foes[s]; });
}
function tdFoeOf(side){ return (TD.foes && TD.foes[side]) || null; }
function tdFoeSync(){
  var all = tdFoeList();
  TD.foe = (all.length === 1) ? all[0] : null;
}
function tdFoeOn(){ return tdFoeList().length > 0; }
/* Ownership comes from the half, not the uid: two halves can hold the same uid. */
function tdSideOfEl(el){
  if(!el || !el.closest) return 'mine';
  /* A Rebirth table's shared Field is in nobody's half: the layer a card is drawn on says whose it is. */
  var lay = el.closest('.rb-flayer');
  if(lay) return lay.getAttribute('data-side') === 'foe' ? 'foe' : 'mine';
  return el.closest('.td-half-foe') ? 'foe' : 'mine';
}
function tdBoardOfEl(el){
  var lay = el && el.closest && el.closest('.rb-flayer');
  if(lay) return lay.getAttribute('data-side') === 'foe'
    ? tdFoeOf(lay.getAttribute('data-seat')) : TD.board;
  var half = el && el.closest && el.closest('.td-half');
  return (half && half.classList.contains('td-half-foe'))
    ? tdFoeOf(half.getAttribute('data-seat')) : TD.board;
}
function tdFoeSet(data, name, side){
  if(!data){ return tdFoeClear(side); }
  var b = tdHydrate(data);
  if(!b) return null;
  b.name = name || (data.name || 'Opponent');
  /* The seat is the caller's side, else the board's own (HANDOFF §10). */
  b.side = side || data.side || 'b';
  if(!TD.foes) TD.foes = {};
  /* A reveal outlives a snapshot: it ends only with their 'unshown', and a snapshot arrives without the flag. */
  var prev = TD.foes[b.side];
  if(prev && prev.revealed) b.revealed = prev.revealed;
  TD.foes[b.side] = b;
  tdFoeSync();
  return b;
}
function tdFoeClear(side){
  if(side){ if(TD.foes) delete TD.foes[side]; }
  else TD.foes = {};
  tdFoeSync();
  tdRender();
  return null;
}

/* A test fixture: the app never calls this; checkboard.js, checkplay.js and checktable.js do. */
function tdMockFoe(name, seat){
  if(!TD.board) return null;
  var take = seat || TD_SEATS.filter(function(s){
    return s !== TD.side && !tdFoeOf(s);
  })[0];
  if(!take) return null;
  var was = TD.side;
  TD.side = take;
  var built = tdBuildBoard();
  TD.side = was;
  var data = null;
  /* tdSerialize reads TD.board, so the built board is swapped in for a moment. */
  var mine = TD.board;
  TD.board = built;
  try{ data = tdSerialize(); } finally { TD.board = mine; }
  if(data) data.side = take;
  var foe = tdFoeSet(data, name || 'Opponent', take);
  if(foe && foe.zones.deck && foe.zones.hand){
    for(var i = 0; i < TD_OPENING_DRAW && foe.zones.deck.length; i++)
      foe.zones.hand.push(foe.zones.deck.pop());
  }
  tdRender();
  return foe;
}

/* Pieces minted before the relay names your side carry 'a' on both machines, so each piece and each reference to one is re-stamped.
   Other halves are never touched; the log restarts from the re-stamped board. `from` is the side a loaded position was minted under. */
function tdAdoptSide(s, from){
  var side = String(s || 'a'), old = (from == null) ? TD.side : String(from);
  TD.side = side;
  if(side === old || !TD.board) return false;
  var re = function(uid){
    if(uid == null) return uid;
    var i = String(uid).indexOf('\u00b7');
    if(i <= 0 || String(uid).slice(0, i) !== old) return uid;
    return side + String(uid).slice(i);
  };
  Object.keys(TD.board.zones).forEach(function(z){
    (TD.board.zones[z] || []).forEach(function(it){
      it.uid = re(it.uid);
      if(it.connectedTo) it.connectedTo = re(it.connectedTo);
      if(it.blocks) it.blocks = re(it.blocks);
    });
  });
  (TD.board.tokens || []).forEach(function(t){
    t.uid = re(t.uid);
    if(t.on) t.on = re(t.on);
  });
  (TD.board.gtoks || []).forEach(function(t){ t.uid = re(t.uid); if(t.cd) t.cd = re(t.cd); });
  /* your own lines and areas on the map go with you; anybody else's on it keep their seat (cat_rbmap.js) */
  (TD.board.glines || []).concat(TD.board.gareas || []).forEach(function(m){
    if(m.s === old){ m.s = side; m.id = re(m.id); }
  });
  if(from == null && typeof TBL !== 'undefined' && TBL.arrows)
    TBL.arrows.forEach(function(a){ a.from = re(a.from); a.to = re(a.to); });
  tdLogReset();
  tdRender();
  return true;
}

/* Cards travel by name and are re-resolved from the receiver's catalogue; a name it lacks goes into `missing`.
   Absent fields stay absent, so a board round-trips identical: checktable.js compares hashes. */

/* Only these item fields are saved, sent and replayed: a new piece of board state goes here. */
var TD_ITEM_KEYS  = ['uid','locked','x','y','auto','connectedTo','lord','anon','down','decl','blocks','shown','dm','dk','lab','gid','dmg'];
var TD_TOKEN_KEYS = ['uid','kind','name','value','x','y','on'];

function tdPackOne(src, keys){
  var out = {};
  keys.forEach(function(k){ if(src[k] !== undefined) out[k] = src[k]; });
  return out;
}
function tdPackItem(it){
  var o = tdPackOne(it, TD_ITEM_KEYS);
  o.n = it.card ? it.card.name : '';
  return o;
}

function tdSerialize(){
  if(!TD.board) return null;
  var out = {v:1, side:TD.side, seq:TD.seq, game:(REBIRTH ? 'rebirth' : 'main'),
             mode:_gameMode, zones:{}, tokens:[], counters:{}};
  Object.keys(TD.board.zones).forEach(function(z){
    out.zones[z] = (TD.board.zones[z] || []).map(tdPackItem);
  });
  out.tokens = (TD.board.tokens || []).map(function(t){
    return tdPackOne(t, TD_TOKEN_KEYS);
  });
  var c = TD.board.counters || {};
  Object.keys(c).forEach(function(k){ out.counters[k] = c[k]; });
  out.turn = tdTurnOf(TD.board);
  var zs = tdZShowFrom(TD.board);
  if(zs) out.zshow = zs;
  if(TD.board.lvl) out.lvl = TD.board.lvl;
  if(TD.board.role) out.role = TD.board.role;
  if(TD.board.map) out.map = TD.board.map;
  if(TD.board.dmDecks) out.dmDecks = TD.board.dmDecks.map(function(d){
    var o = {id:d.id, name:d.name, kind:d.kind};
    if(d.gone) o.gone = true;
    return o;
  });
  if(typeof tdGfPack === 'function') tdGfPack(TD.board, out);
  return out;
}
function tdZShowFrom(data){
  var src = data && data.zshow, zones = data && data.zones;
  if(!src || typeof src !== 'object' || !zones || typeof zones !== 'object') return null;
  var out = null;
  Object.keys(src).forEach(function(z){
    var m = src[z];
    if((m !== 'all' && m !== 'top') || !Object.prototype.hasOwnProperty.call(zones, z)) return;
    (out = out || {})[z] = m;
  });
  return out;
}
window.tdZShowFrom = tdZShowFrom;

function tdHydrate(data){
  if(!data || !data.zones) return null;
  var cardMap = {};
  (window.CARDS || []).forEach(function(c){ cardMap[c.name] = c; });
  var board = {zones:{}, missing:[], counts:{}, tokens:[], counters:{}};
  Object.keys(data.zones).forEach(function(z){
    board.zones[z] = [];
    (data.zones[z] || []).forEach(function(o){
      /* A hidden piece has no name to resolve and must survive anyway: it is what makes their hand a count. */
      if(o.anon){
        var an = tdPackOne(o, TD_ITEM_KEYS);
        an.anon = true;
        board.zones[z].push(an);
        return;
      }
      var card = cardMap[o.n];
      if(!card){
        if(board.missing.indexOf(o.n) < 0) board.missing.push(o.n);
        return;
      }
      var it = tdPackOne(o, TD_ITEM_KEYS);
      it.card = card;
      board.zones[z].push(it);
    });
    board.counts[z] = board.zones[z].length;
  });
  board.tokens = (data.tokens || []).map(function(t){
    return tdPackOne(t, TD_TOKEN_KEYS);
  });
  var c = data.counters || {};
  Object.keys(c).forEach(function(k){ board.counters[k] = c[k]; });
  /* Through tdTurnOf, so an old save with no turn opens at Main / Unlock. */
  board.turn = tdTurnOf(data);
  var zs = (typeof tdZShowFrom === 'function') ? tdZShowFrom(data) : null;
  if(zs) board.zshow = zs;
  if(typeof data.lvl === 'string' && data.lvl) board.lvl = data.lvl;
  if(data.role === 'dm' || data.role === 'dmp') board.role = data.role;
  if(typeof data.map === 'string' && data.map) board.map = data.map;
  if(Array.isArray(data.dmDecks)) board.dmDecks = data.dmDecks.map(function(d){
    var o = {id:String(d.id), name:String(d.name || ''), kind:(d.kind === 'rew' ? 'rew' : 'enc')};
    if(d.gone) o.gone = true;
    return o;
  });
  if(typeof tdGfUnpack === 'function') tdGfUnpack(data, board);
  /* Only a sane whole count, and it only ever goes up: an id already used must never come back. */
  if(typeof data.seq === 'number' && isFinite(data.seq) && data.seq >= 0 && data.seq <= 1e9
     && data.seq > TD.seq) TD.seq = Math.floor(data.seq);
  return board;
}

/* Keys sorted at every level, so the same pieces hash the same however the board was built. */
function tdStableString(v){
  if(v === null || typeof v !== 'object') return JSON.stringify(v);
  if(Array.isArray(v)) return '[' + v.map(tdStableString).join(',') + ']';
  return '{' + Object.keys(v).sort().map(function(k){
    return JSON.stringify(k) + ':' + tdStableString(v[k]);
  }).join(',') + '}';
}
/* seq, side, game and mode are left out: after a replay seq rightly differs, and the others describe the table. */
function tdBoardHash(data){
  var d = data || tdSerialize();
  if(d && d.zones) d = {zones:d.zones, tokens:d.tokens || [], counters:d.counters || {}};
  var s = tdStableString(d);
  var h = 0x811c9dc5;
  for(var i = 0; i < s.length; i++){
    h ^= s.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24))) >>> 0;
  }
  return ('0000000' + h.toString(16)).slice(-8);
}
