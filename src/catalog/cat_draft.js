/* Rules only, no DOM, network or timers (checkdraft.js runs this in Node); the state is plain JSON the host sends.
   cat_online.js loads first: at its top level these functions work, these vars are still undefined. */

var DRAFT_TYPES = {
  standard:   {label:'Default Draft', short:'Default', min:2, max:4, packs:4, packSize:15},
  vault:      {label:'Vault',         short:'Vault',   min:1, max:4, each:120},
  hex:        {label:'Hex Draft',     short:'Hex',     min:2, max:2, piles:6, height:30},
  winchester: {label:'Winchester',    short:'Winchester', min:2, max:4, piles:4, base:110, extra:55}
};
var DRAFT_ORDER = ['standard', 'vault', 'hex', 'winchester'];
var DRAFT_DECK_SIZE = 30;

function draftNeed(type, seats){
  var T = DRAFT_TYPES[type];
  if(!T) return 0;
  if(type === 'standard') return seats * T.packs * T.packSize;
  if(type === 'vault') return seats * T.each;
  if(type === 'hex') return T.piles * T.height;
  if(type === 'winchester') return T.base + T.extra * Math.max(0, seats - 2);
  return 0;
}

function draftRng(seed){
  var a = (seed >>> 0) || 0x9e3779b9;
  return function(){
    a = (a + 0x6D2B79F5) >>> 0;
    var t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function draftShuffle(arr, rnd){
  for(var i = arr.length - 1; i > 0; i--){
    var j = Math.floor(rnd() * (i + 1));
    var t = arr[i]; arr[i] = arr[j]; arr[j] = t;
  }
  return arr;
}

function draftPoolList(entries, skip){
  var names = [], skipped = 0;
  (entries || []).forEach(function(en){
    var n = Math.max(0, en.count | 0);
    if(!en.name || !n) return;
    if(skip && skip(en.name)){ skipped += n; return; }
    for(var i = 0; i < n; i++) names.push(en.name);
  });
  return {names:names, skipped:skipped};
}

/* The author's rule: the whole pool once, then repeats weighted by copies, all shuffled together. */
function draftDeal(pool, need, rnd){
  var out;
  if(!pool.length || need <= 0) return [];
  if(need <= pool.length){
    out = draftShuffle(pool.slice(), rnd).slice(0, need);
  } else {
    out = pool.slice();
    for(var i = pool.length; i < need; i++)
      out.push(pool[Math.floor(rnd() * pool.length)]);
  }
  return draftShuffle(out, rnd);
}

function draftNew(type, pool, seats, seed){
  var T = DRAFT_TYPES[type];
  seats = seats | 0;
  if(!T || seats < T.min || seats > T.max || !pool || !pool.length) return null;
  var rnd = draftRng(seed == null ? (Math.random() * 4294967296) >>> 0 : seed);
  var cards = draftDeal(pool, draftNeed(type, seats), rnd);
  var st = {v:1, type:type, seats:seats, seq:0, done:false, picks:[]};
  for(var s = 0; s < seats; s++) st.picks.push([]);

  if(type === 'standard'){
    st.rounds = T.packs; st.packSize = T.packSize; st.round = 0;
    st.sealed = [];
    for(s = 0; s < seats; s++){
      var mine = [];
      for(var r = 0; r < T.packs; r++){
        var at = (s * T.packs + r) * T.packSize;
        mine.push(cards.slice(at, at + T.packSize));
      }
      st.sealed.push(mine);
    }
    st.queue = [];
    for(s = 0; s < seats; s++) st.queue.push([]);
    draftOpenPacks(st);
  } else if(type === 'vault'){
    for(s = 0; s < seats; s++) st.picks[s] = cards.slice(s * T.each, (s + 1) * T.each);
    st.done = true;
  } else if(type === 'hex'){
    /* The END of each array is the top of the pile. */
    st.piles = [];
    for(var p = 0; p < T.piles; p++) st.piles.push(cards.slice(p * T.height, (p + 1) * T.height));
    st.rounds = T.height; st.round = 0;
    st.starter = Math.floor(rnd() * 2);
    st.turn = st.starter; st.stage = 0; st.taken = {};
    st.last = null;
  } else if(type === 'winchester'){
    st.stack = cards;                    /* dealt from the end */
    st.piles = [[], [], [], []];
    draftWinDeal(st);
    st.turn = Math.floor(rnd() * seats);
    st.total = cards.length;
  }
  return st;
}

/* Left is the next seat round, right the one before. */
function draftDir(st){ return (st.round % 2 === 0) ? 1 : -1; }
function draftOpenPacks(st){
  for(var s = 0; s < st.seats; s++)
    st.queue[s].push({id:'r' + st.round + 's' + s, cards:st.sealed[s][st.round].slice()});
}

function draftWinDeal(st){
  for(var i = 0; i < st.piles.length; i++)
    if(st.stack.length) st.piles[i].push(st.stack.pop());
}

function draftHexPair(a){ return [a % 6, (a + 1) % 6]; }

function draftLegal(st, seat){
  if(!st || st.done || seat < 0 || seat >= st.seats) return [];
  var out = [], i;
  if(st.type === 'standard'){
    var head = st.queue[seat][0];
    if(!head) return [];
    for(i = 0; i < head.cards.length; i++) out.push({pack:head.id, i:i, name:head.cards[i]});
    return out;
  }
  if(st.type === 'hex'){
    if(seat !== st.turn) return [];
    for(i = 0; i < 6; i++){
      var pr = draftHexPair(i);
      if(st.taken[pr[0]] != null || st.taken[pr[1]] != null) continue;
      if(!st.piles[pr[0]].length || !st.piles[pr[1]].length) continue;
      out.push({a:i});
    }
    return out;
  }
  if(st.type === 'winchester'){
    if(seat !== st.turn) return [];
    for(i = 0; i < st.piles.length; i++) if(st.piles[i].length) out.push({p:i});
    return out;
  }
  return [];
}
function draftCanMove(st, seat){ return draftLegal(st, seat).length > 0; }

function draftWaitingOn(st){
  var out = [];
  if(!st || st.done) return out;
  for(var s = 0; s < st.seats; s++) if(draftCanMove(st, s)) out.push(s);
  return out;
}

function draftApply(st, seat, m){
  if(!st || st.done || !m) return false;
  if(st.type === 'standard'){
    var head = st.queue[seat] && st.queue[seat][0];
    if(!head || (m.pack && m.pack !== head.id)) return false;
    var i = m.i | 0;
    if(i < 0 || i >= head.cards.length) return false;
    /* A name that does not match means a stale view: refuse rather than hand over another card. */
    if(m.name && head.cards[i] !== m.name) return false;
    st.picks[seat].push(head.cards.splice(i, 1)[0]);
    st.queue[seat].shift();
    if(head.cards.length){
      var to = (seat + draftDir(st) + st.seats) % st.seats;
      st.queue[to].push(head);
    }
    var empty = st.queue.every(function(q){ return !q.length; });
    if(empty){
      st.round++;
      if(st.round >= st.rounds) st.done = true;
      else draftOpenPacks(st);
    }
    st.seq++;
    return true;
  }
  if(st.type === 'hex'){
    if(seat !== st.turn) return false;
    var ok = draftLegal(st, seat).some(function(x){ return x.a === (m.a | 0); });
    if(!ok) return false;
    var pr = draftHexPair(m.a | 0);
    var got = [st.piles[pr[0]].pop(), st.piles[pr[1]].pop()];
    got.forEach(function(n){ st.picks[seat].push(n); });
    st.taken[pr[0]] = seat; st.taken[pr[1]] = seat;
    if(!st.lastRound) st.lastRound = {picks:[], gone:[]};
    st.lastRound.picks.push({seat:seat, piles:pr, cards:got});
    if(st.stage === 0){
      st.stage = 1;
      st.turn = 1 - seat;
    } else {
      var gone = [];
      for(var p = 0; p < 6; p++)
        if(st.taken[p] == null && st.piles[p].length) gone.push({pile:p, card:st.piles[p].pop()});
      st.lastRound.gone = gone;
      st.last = st.lastRound; st.lastRound = null;
      st.taken = {}; st.stage = 0;
      st.round++;
      st.starter = 1 - st.starter;
      st.turn = st.starter;
      if(st.round >= st.rounds || st.piles.every(function(x){ return !x.length; })) st.done = true;
    }
    st.seq++;
    return true;
  }
  if(st.type === 'winchester'){
    if(seat !== st.turn) return false;
    var k = m.p | 0;
    if(!st.piles[k] || !st.piles[k].length) return false;
    st.picks[seat] = st.picks[seat].concat(st.piles[k]);
    st.last = {seat:seat, pile:k, cards:st.piles[k].slice()};
    st.piles[k] = [];
    draftWinDeal(st);
    if(!st.stack.length && st.piles.every(function(x){ return !x.length; })) st.done = true;
    else st.turn = (seat + 1) % st.seats;
    st.seq++;
    return true;
  }
  return false;
}

function draftRandomMove(st, seat, rnd){
  var ms = draftLegal(st, seat);
  if(!ms.length) return null;
  return ms[Math.floor((rnd || Math.random)() * ms.length)];
}

/* Hex and Winchester are played face up, so every view shows the piles and all picks: the game, not a leak. */
function draftView(st, seat){
  if(!st) return null;
  var v = {type:st.type, seat:seat, seats:st.seats, seq:st.seq, done:!!st.done,
           picks:(st.picks[seat] || []).slice(),
           counts:st.picks.map(function(p){ return p.length; })};
  if(st.type === 'standard'){
    var head = st.queue[seat] && st.queue[seat][0];
    v.round = st.round; v.rounds = st.rounds; v.dir = draftDir(st);
    v.pack = head ? {id:head.id, cards:head.cards.slice()} : null;
    v.queued = st.queue.map(function(q){ return q.length; });
    v.pick = head ? (st.packSize - head.cards.length + 1) : 0;
  } else if(st.type === 'hex'){
    v.round = st.round; v.rounds = st.rounds; v.turn = st.turn; v.stage = st.stage;
    v.starter = st.starter;
    v.tops = st.piles.map(function(p){ return p.length ? p[p.length - 1] : null; });
    v.heights = st.piles.map(function(p){ return p.length; });
    v.taken = {};
    Object.keys(st.taken || {}).forEach(function(k){ v.taken[k] = st.taken[k]; });
    v.last = st.last || null;
    v.now = st.lastRound || null;
    v.all = st.picks.map(function(p){ return p.slice(); });
  } else if(st.type === 'winchester'){
    v.turn = st.turn; v.stack = st.stack.length; v.total = st.total;
    v.piles = st.piles.map(function(p){ return p.slice(); });
    v.last = st.last || null;
    v.all = st.picks.map(function(p){ return p.slice(); });
  }
  v.legal = draftLegal(st, seat);
  return v;
}

function draftTally(names){
  var m = {};
  (names || []).forEach(function(n){ m[n] = (m[n] || 0) + 1; });
  return Object.keys(m).sort(function(a, b){ return m[b] - m[a] || (a < b ? -1 : a > b ? 1 : 0); })
    .map(function(n){ return {name:n, count:m[n]}; });
}
function draftLines(names){
  return draftTally(names).map(function(t){ return t.count + 'x ' + t.name; }).join('\n');
}

if(typeof module !== 'undefined' && module.exports)
  module.exports = {DRAFT_TYPES:DRAFT_TYPES, DRAFT_ORDER:DRAFT_ORDER, DRAFT_DECK_SIZE:DRAFT_DECK_SIZE,
    draftNeed:draftNeed, draftRng:draftRng, draftShuffle:draftShuffle, draftPoolList:draftPoolList,
    draftDeal:draftDeal, draftNew:draftNew, draftLegal:draftLegal, draftCanMove:draftCanMove,
    draftWaitingOn:draftWaitingOn, draftApply:draftApply, draftRandomMove:draftRandomMove,
    draftView:draftView, draftTally:draftTally, draftLines:draftLines, draftHexPair:draftHexPair};
