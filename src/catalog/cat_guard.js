/* Rebuilt, not filtered: a message is made again from what its type may carry, and the seat it speaks for comes from the relay's stamp, never the message.
   Reads other files' globals only when called: it loads before them and also runs under node (checkdraft.js). */

var TG = {dropped:0, last:'', log:[]};

function tgDrop(why){
  TG.dropped++;
  TG.last = String(why || '');
  TG.log.push(TG.last);
  if(TG.log.length > 40) TG.log.shift();
  return null;
}


function tgObj(v){ return !!v && typeof v === 'object' && !Array.isArray(v); }
function tgStr(v, max){
  if(typeof v !== 'string') return '';
  return v.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, max || 200);
}
function tgName(v){ return tgStr(v, 40).replace(/\s+/g, ' ').trim(); }
function tgNum(v, lo, hi){
  if(typeof v !== 'number' || !isFinite(v)) return null;
  return v < lo ? lo : (v > hi ? hi : v);
}
function tgInt(v, lo, hi){
  if(typeof v !== 'number' || !isFinite(v) || Math.floor(v) !== v) return null;
  return v < lo ? lo : (v > hi ? hi : v);
}
function tgIntOr(v, lo, hi, d){
  var n = tgInt(v, lo, hi);
  return n == null ? d : n;
}
function tgSeats(){ return (typeof TD_SEATS !== 'undefined') ? TD_SEATS : ['a', 'b', 'c', 'd', 'e', 'f']; }
function tgCapMost(){ return (typeof REBIRTH !== 'undefined' && REBIRTH) ? 6 : 4; }
function tgSeat(v){ return (typeof v === 'string' && tgSeats().indexOf(v) >= 0) ? v : ''; }
function tgId(v){ return (typeof v === 'string' && /^[A-Za-z0-9_-]{1,40}$/.test(v)) ? v : ''; }
var TG_UID = /^(?:[a-f]·)?(?:td|tk)\d{1,12}$/;
var TG_ANON = /^anon·[a-z]{1,12}·\d{1,5}$/;
function tgUid(v){
  return (typeof v === 'string' && (TG_UID.test(v) || TG_ANON.test(v))) ? v : '';
}
function tgUrl(v, max){
  var s = tgStr(v, max || 400).trim();
  return /^https?:\/\/[^\s<>"'`\\]+$/i.test(s) ? s : '';
}
/* The host name is matched whole, up to its slash, so no lookalike passes; tboDiscordClean (cat_online.js) shapes a typed link to match. */
function tgDiscord(v){
  var s = tgStr(v, 201).trim();
  if(s.length > 200) return '';
  return /^https:[/][/](?:discord[.]gg|discord[.]com|discordapp[.]com)[/][A-Za-z0-9][A-Za-z0-9@._/-]*(?:[?][A-Za-z0-9_.=&-]+)?$/.test(s)
    ? s : '';
}
function tgZones(){
  if(TG.zones) return TG.zones;
  var z = {lord:1}, n = 0;
  [(typeof TD_ZONES_MAIN !== 'undefined') ? TD_ZONES_MAIN : [],
   (typeof TD_ZONES_REBIRTH !== 'undefined') ? TD_ZONES_REBIRTH : [],
   (typeof TD_ZONES_ENCOUNTER !== 'undefined') ? TD_ZONES_ENCOUNTER : []].forEach(function(list){
    list.forEach(function(d){ if(d && d.id){ z[d.id] = 1; n++; } });
  });
  if(n) TG.zones = z;
  return z;
}
function tgZone(v){ return (typeof v === 'string' && tgZones().hasOwnProperty(v)) ? v : ''; }

/* tdSerialize's fields: a board from this app passes through unchanged, so its tdBoardHash is the same after the check. */
var TG_ITEM_BOOLS = ['locked', 'auto', 'lord', 'anon', 'down', 'shown', 'dm'];
var TG_DECL = {atk:1, thm:1, blk:1};
function tgItem(o){
  if(!tgObj(o)) return null;
  var uid = tgUid(o.uid);
  if(!uid) return null;
  var it = {uid:uid};
  TG_ITEM_BOOLS.forEach(function(k){ if(typeof o[k] === 'boolean') it[k] = o[k]; });
  var x = tgNum(o.x, -1e4, 1e4), y = tgNum(o.y, -1e4, 1e4);
  if(x != null) it.x = x;
  if(y != null) it.y = y;
  var ct = tgUid(o.connectedTo), bl = tgUid(o.blocks);
  if(ct) it.connectedTo = ct;
  if(bl) it.blocks = bl;
  if(TG_DECL[o.decl] === 1) it.decl = o.decl;
  if(typeof o.dk === 'string' && /^k\d{1,4}$/.test(o.dk)) it.dk = o.dk;
  if(typeof o.n === 'string') it.n = tgStr(o.n, 200);
  var lb = tgLab(o.lab);
  if(lb) it.lab = lb;
  var gi = tgUid(o.gid);
  if(gi) it.gid = gi;
  var dg = tgInt(o.dmg, 1, TG_DMG_MOST);
  if(dg) it.dmg = dg;
  if(!it.anon && !it.n) return null;
  return it;
}
var TG_DMG_MOST = 99999;
var TG_TOKEN_KINDS = {plus:1, minus:1, emblem:1, kw:1, color:1};
function tgToken(t){
  if(!tgObj(t)) return null;
  var uid = tgUid(t.uid);
  if(!uid || TG_TOKEN_KINDS[t.kind] !== 1) return null;
  var o = {uid:uid, kind:t.kind};
  if(t.name !== undefined) o.name = tgStr(t.name, 80);
  var v = tgNum(t.value, -1e6, 1e6);
  if(v != null) o.value = v;
  var x = tgNum(t.x, -1e4, 1e4), y = tgNum(t.y, -1e4, 1e4);
  if(x != null) o.x = x;
  if(y != null) o.y = y;
  var on = tgUid(t.on);
  if(on) o.on = on;
  return o;
}
var TG_CTRS = {life:1, atk:1, hp:1, mp:1};
function tgCounters(c){
  var out = {};
  if(!tgObj(c)) return out;
  Object.keys(c).forEach(function(k){
    if(TG_CTRS[k] !== 1) return;
    var v = tgNum(c[k], -1e6, 1e6);
    if(v != null) out[k] = v;
  });
  return out;
}
function tgTurn(t){
  if(!tgObj(t)) return null;
  return {step:(t.step === 'battle' ? 'battle' : 'main'),
          phase:tgIntOr(t.phase, 0, 20, 0), n:tgIntOr(t.n, 1, 1e6, 1)};
}
var TG_GRID_MOST = 100;
var TG_GCOLS = {gold:1, blue:1, green:1, pink:1, orange:1, violet:1,
                red:1, teal:1, white:1, silver:1, brown:1, lime:1};
var TG_PIC_ID = /^p[0-9a-f]{8,24}$/;
/* Characters as a reader counts them: an emoji is one (Intl.Segmenter, where the browser has it). */
function tgChars(s){
  s = String(s == null ? '' : s);
  try{
    if(typeof Intl !== 'undefined' && typeof Intl.Segmenter === 'function')
      return Array.from(new Intl.Segmenter(undefined, {granularity:'grapheme'}).segment(s),
                        function(x){ return x.segment; });
  }catch(_){}
  return Array.from(s);
}
/* Capitals stay capitals: "Orc" and "ORC" are two labels. */
function tgLab(v){
  if(typeof v !== 'string') return '';
  /* \s takes in the line and paragraph separators and the byte-order mark;
     a zero-width space is taken out by itself */
  var s = v.replace(/[\s\x00-\x1f\x7f-\x9f]/g, '').split(String.fromCharCode(0x200b)).join('');
  return tgChars(s.slice(0, 200)).slice(0, 3).map(function(c){
    return Array.from(c).slice(0, 12).join('');
  }).join('');
}
function tgGCol(v){ return (typeof v === 'string' && TG_GCOLS[v] === 1) ? v : ''; }
function tgPic(p){
  if(!tgObj(p) || typeof p.id !== 'string' || !TG_PIC_ID.test(p.id)) return null;
  var num = function(v, lo, hi, d){
    var n = tgNum(v, lo, hi);
    return n == null ? d : Math.round(n * 1e4) / 1e4;
  };
  return {id:p.id, x:num(p.x, -4, 4, 0), y:num(p.y, -4, 4, 0), w:num(p.w, 0.02, 8, 1), h:num(p.h, 0.02, 8, 1)};
}
function tgGrid(g){
  if(!tgObj(g)) return null;
  var o = {sh:(g.sh === 'hex' ? 'hex' : 'sq'),
           c:tgIntOr(g.c, 1, TG_GRID_MOST, 24), r:tgIntOr(g.r, 1, TG_GRID_MOST, 16)};
  if(g.ln === false) o.ln = false;
  var p = tgPic(g.pic);
  if(p) o.pic = p;
  return o;
}
function tgGTok(t, noUid){
  if(!tgObj(t)) return null;
  var o = {};
  if(!noUid){
    if(typeof t.uid !== 'string' || !TG_UID.test(t.uid)) return null;
    o.uid = t.uid;
  }
  var lab = tgLab(t.lab);
  if(!lab) return null;
  o.c = tgIntOr(t.c, 0, TG_GRID_MOST - 1, 0);
  o.r = tgIntOr(t.r, 0, TG_GRID_MOST - 1, 0);
  o.lab = lab;
  var w = tgInt(t.w, 1, 10), h = tgInt(t.h, 1, 10), rot = tgInt(t.rot, 0, 5);
  if(w > 1) o.w = w;
  if(h > 1) o.h = h;
  if(rot) o.rot = rot;
  var col = tgGCol(t.col);
  if(col) o.col = col;
  if(t.me === true) o.me = true;
  if(t.hid === true) o.hid = true;
  if(!noUid){
    if(typeof t.m === 'string'){
      var m = tgStr(t.m, 60).trim().toLowerCase();
      if(m) o.m = m;
    }
    if(typeof t.cd === 'string' && TG_UID.test(t.cd)) o.cd = t.cd;
  } else {
    /* in a saved map a connection is to the map's card by its place in the list, as the cards get new ids when it comes down */
    var ci = tgInt(t.cdi, 0, 299);
    if(ci != null) o.cdi = ci;
  }
  return o;
}
/* The map's own layers (cat_rbmap.js): runs of squares along a row, [c, r, n] or [c, r, n, kind]; edges [c, r, d, v]. */
var TG_RUNS_MOST = 10000, TG_EDGES_MOST = 20000, TG_LINES_MOST = 300, TG_AREAS_MOST = 120, TG_LINE_PTS = 600;
function tgRun(x, kinds){
  if(!Array.isArray(x) || x.length < 3) return null;
  var c = tgInt(x[0], 0, TG_GRID_MOST - 1), r = tgInt(x[1], 0, TG_GRID_MOST - 1), n = tgInt(x[2], 1, TG_GRID_MOST);
  if(c == null || r == null || n == null || c !== x[0] || r !== x[1] || n !== x[2] || c + n > TG_GRID_MOST) return null;
  if(!kinds) return [c, r, n];
  var k = tgInt(x[3], 1, kinds);
  return k == null ? null : [c, r, n, k];
}
function tgRuns(v, kinds, most){
  if(!Array.isArray(v)) return null;
  return v.slice(0, most || TG_RUNS_MOST).map(function(x){ return tgRun(x, kinds); }).filter(Boolean);
}
function tgEdge(x, withV){
  if(!Array.isArray(x) || x.length < 3) return null;
  var c = tgInt(x[0], -1, TG_GRID_MOST - 1), r = tgInt(x[1], -1, TG_GRID_MOST - 1), d = tgInt(x[2], 0, 2);
  if(c == null || r == null || d == null || c !== x[0] || r !== x[1]) return null;
  if(!withV) return [c, r, d];
  var v = tgInt(x[3], 1, 3);
  return v == null ? null : [c, r, d, v];
}
function tgEdges(v, withV, most){
  if(!Array.isArray(v)) return null;
  return v.slice(0, most || TG_EDGES_MOST).map(function(x){ return tgEdge(x, withV); }).filter(Boolean);
}
/* A point on the map in grid units, to two places. */
function tgPt(p){
  if(!Array.isArray(p) || p.length < 2) return null;
  var x = tgNum(p[0], -2, 2 * TG_GRID_MOST + 2), y = tgNum(p[1], -2, 2 * TG_GRID_MOST + 2);
  return (x == null || y == null) ? null : [Math.round(x * 100) / 100, Math.round(y * 100) / 100];
}
function tgGLine(l){
  if(!tgObj(l) || typeof l.id !== 'string' || !TG_UID.test(l.id) || !Array.isArray(l.p)) return null;
  var p = l.p.slice(0, TG_LINE_PTS).map(tgPt).filter(Boolean);
  if(p.length < 2) return null;
  var o = {id:l.id, s:tgSeat(l.s) || 'a', p:p};
  if(l.perm === true) o.perm = true;
  return o;
}
var TG_AREA_KINDS = {circle:1, cone:1, line:1, square:1};
function tgGArea(a){
  if(!tgObj(a) || typeof a.id !== 'string' || !TG_UID.test(a.id) || TG_AREA_KINDS[a.k] !== 1) return null;
  var A = tgPt(a.a), B = tgPt(a.b);
  if(!A || !B) return null;
  var o = {id:a.id, s:tgSeat(a.s) || 'a', k:a.k, a:A, b:B};
  if(a.perm === true) o.perm = true;
  return o;
}
function tgIds(v){
  return Array.isArray(v) ? v.slice(0, 1000).filter(function(x){ return typeof x === 'string' && TG_UID.test(x); }) : null;
}
function tgIcon(ic){
  if(!tgObj(ic)) return null;
  return {col:tgGCol(ic.col), txt:tgLab(ic.txt)};
}
function tgGTag(g){
  if(!tgObj(g)) return null;
  var n = tgInt(g.n, 1, 1e15);
  if(n == null || typeof g.was !== 'string' || typeof g.now !== 'string') return null;
  var o = {n:n, was:tgField('GMAP', g.was), now:tgField('GMAP', g.now)};
  if(g.gone === true) o.gone = true;
  return o;
}
function tgBoard(d){
  if(!tgObj(d) || !tgObj(d.zones)) return null;
  if(d.game !== undefined && d.game !== 'main' && d.game !== 'rebirth') return null;
  if(d.mode !== undefined && !(typeof d.mode === 'string' && /^[a-z0-9_-]{1,24}$/i.test(d.mode))) return null;
  var out = {zones:{}, tokens:[], counters:tgCounters(d.counters)};
  var v = tgInt(d.v, 0, 100), seq = tgInt(d.seq, 0, 1e9);
  if(v != null) out.v = v;
  if(seq != null) out.seq = seq;
  var side = tgSeat(d.side);
  if(side) out.side = side;
  if(d.game !== undefined) out.game = d.game;
  if(d.mode !== undefined) out.mode = d.mode;
  if(d.name !== undefined) out.name = tgName(d.name);
  if(typeof d.lvl === 'string'){
    var lv = d.lvl.toUpperCase().replace(/[^ROYGBIV]/g, '').slice(0, 40);
    if(lv) out.lvl = lv;
  }
  if(d.role === 'dm' || d.role === 'dmp') out.role = d.role;
  if(typeof d.map === 'string'){
    var mp = tgStr(d.map, 60).trim();
    if(mp) out.map = mp;
  }
  if(Array.isArray(d.dmDecks)){
    out.dmDecks = d.dmDecks.slice(0, 200).map(function(k){
      if(!tgObj(k) || typeof k.id !== 'string' || !/^k\d{1,4}$/.test(k.id)) return null;
      var o = {id:k.id, name:tgStr(k.name, 60), kind:(k.kind === 'rew' ? 'rew' : 'enc')};
      if(k.gone === true) o.gone = true;
      return o;
    }).filter(Boolean);
  }
  var gr = tgGrid(d.grid);
  if(gr) out.grid = gr;
  if(d.gpers === true) out.gpers = true;
  var gn = tgInt(d.gn, 0, 1e9);
  if(gn) out.gn = gn;
  if(Array.isArray(d.gtoks)){
    var gts = d.gtoks.slice(0, 500).map(function(t){ return tgGTok(t); }).filter(Boolean);
    if(gts.length) out.gtoks = gts;
  }
  if(Array.isArray(d.gtl)){
    var gtl = d.gtl.slice(-50).map(tgGTag).filter(Boolean);
    if(gtl.length) out.gtl = gtl;
  }
  var gseen = tgInt(d.gtseen, 0, 1e15);
  if(gseen != null) out.gtseen = gseen;
  var ic = tgIcon(d.icon);
  if(ic) out.icon = ic;
  var ter = tgRuns(d.gter, 4);
  if(ter && ter.length) out.gter = ter;
  var ged = tgEdges(d.gedge, true);
  if(ged && ged.length) out.gedge = ged;
  var gfo = tgRuns(d.gfog);
  if(gfo && gfo.length) out.gfog = gfo;
  if(Array.isArray(d.glines)){
    var gls = d.glines.slice(0, TG_LINES_MOST).map(tgGLine).filter(Boolean);
    if(gls.length) out.glines = gls;
  }
  if(Array.isArray(d.gareas)){
    var gas = d.gareas.slice(0, TG_AREAS_MOST).map(tgGArea).filter(Boolean);
    if(gas.length) out.gareas = gas;
  }
  Object.keys(d.zones).forEach(function(z){
    if(!tgZone(z) || !Array.isArray(d.zones[z])) return;
    out.zones[z] = d.zones[z].slice(0, z === 'dmdeck' ? 6000 : 1000).map(tgItem).filter(Boolean);
  });
  out.tokens = (Array.isArray(d.tokens) ? d.tokens.slice(0, 500) : []).map(tgToken).filter(Boolean);
  var turn = tgTurn(d.turn);
  if(turn) out.turn = turn;
  if(tgObj(d.zshow)){
    var zs = {};
    Object.keys(d.zshow).forEach(function(z){
      if(tgZone(z) && (d.zshow[z] === 'all' || d.zshow[z] === 'top')) zs[z] = d.zshow[z];
    });
    if(Object.keys(zs).length) out.zshow = zs;
  }
  return out;
}
var TG_FEED_WHO = {me:1, them:1, say:1};
function tgFeed(list){
  if(!Array.isArray(list)) return [];
  return list.slice(-400).map(function(f){
    if(!tgObj(f) || typeof f.line !== 'string') return null;
    var o = {who:(TG_FEED_WHO[f.who] === 1 ? f.who : ''), line:tgStr(f.line, 300),
             n:tgIntOr(f.n, 0, 1e9, 0), drew:tgIntOr(f.drew, 0, 10000, 0)};
    if(typeof f.name === 'string') o.name = tgName(f.name);
    /* a whisper's mark (tblFeedSay) */
    if(typeof f.wh === 'string'){ var wh = tgStr(f.wh, 60).trim(); if(wh) o.wh = wh; }
    return o;
  }).filter(Boolean);
}

/* A wrong field is left out, a move missing a field it needs is dropped whole, and a pass is always the sender's own. */
var TG_ACTS = {
  move:     {uid:'U', to:'Z', x:'X', y:'X', auto:'B', at:'I', fx:'FX', color:'C', $:['uid', 'to']},
  phase:    {step:'STEP', phase:'PH', newTurn:'B', stepped:'B'},
  declare:  {uid:'U', role:'ROLE', $:['uid']},
  block:    {uid:'U', target:'U', $:['uid']},
  pass:     {side:'SELF', step:'STEP', phase:'PH', n:'N'},
  lockType: {ctype:'S30', on:'B', $:['ctype']},
  order:    {zone:'Z', order:'UIDS', $:['zone', 'order']},
  lock:     {uid:'U', on:'B', $:['uid']},
  face:     {uid:'U', down:'B', anon:'B', n:'NAME', lab:'LAB', $:['uid']},
  lockZone: {zone:'Z', on:'B', $:['zone']},
  connect:  {uid:'U', to:'U', $:['uid']},
  spawn:    {zone:'Z', uid:'U', n:'NAME', x:'X', y:'X', at:'I', drawn:'B', dm:'B', gift:'B', self:'B', gid:'U', $:['zone', 'uid', 'n']},
  mkcopy:   {zone:'Z', uid:'U', tok:'U', n:'NAME', x:'X', y:'X', $:['zone', 'uid', 'tok', 'n']},
  tokAdd:   {uid:'U', kind:'TK', name:'S80', value:'V', on:'U', x:'X', y:'X', $:['uid', 'kind']},
  tokSet:   {uid:'U', value:'V', $:['uid']},
  tokMove:  {uid:'U', on:'U', x:'X', y:'X', slide:'B', $:['uid']},
  tokDel:   {uid:'U', $:['uid']},
  ctr:      {id:'CTR', value:'V', $:['id']},
  ctrReset: {counters:'CTRS'},
  count:    {zone:'Z', n:'COUNT', $:['zone', 'n']},
  appear:   {zone:'Z', uid:'U', n:'NAME', anon:'B', down:'B', locked:'B', dm:'B', x:'X', y:'X', at:'I',
             fx:'FX', color:'C', from:'U', lab:'LAB', dmg:'DMG', $:['zone', 'uid']},
  reveal:   {uid:'U', on:'B', $:['uid']},
  zshow:    {zone:'Z', mode:'ZMODE', $:['zone']},
  vanish:   {uid:'U', $:['uid']},
  grid:     {g:'GRID', say:'GSAY', $:['g']},
  gpers:    {on:'B'},
  gtok:     {tok:'GTOK', $:['tok']},
  gmove:    {uid:'U', c:'GC', r:'GC', $:['uid', 'c', 'r']},
  gset:     {uid:'U', lab:'LAB', w:'GW', h:'GW', rot:'GROT', col:'GCOL', c:'GC', r:'GC', cd:'CD', hid:'B', grave:'B', $:['uid']},
  gdel:     {uid:'U', uids:'UIDS', lab:'LAB', grave:'B', mix:'B'},
  gtag:     {was:'GMAP', now:'GMAP', n:'GN', gone:'B', $:['was', 'now']},
  label:    {uid:'U', lab:'LAB', $:['uid']},
  gicon:    {icon:'GICON', $:['icon']},
  dmg:      {uid:'U', v:'DMG', d:'DMGD', clr:'B', $:['uid', 'v']},
  gpaint:   {k:'GTK', cells:'GRUNS', $:['k', 'cells']},
  gedge:    {v:'GEV', edges:'GEDGES', $:['v', 'edges']},
  gdoor:    {c:'GE', r:'GE', d:'GED', open:'B', $:['c', 'r', 'd']},
  gfog:     {on:'B', cells:'GRUNS', all:'B', $:['on']},
  gline:    {line:'GLINE', $:['line']},
  glinedel: {ids:'GIDS', all:'B', s:'SEATQ'},
  garea:    {area:'GAREA', $:['area']},
  gareadel: {ids:'GIDS', $:['ids']},
  dmrole:   {role:'ROLEQ', strip:'B', mk:'GMAP', who:'S80', pers:'B', $:['role']}
};
function tgField(kind, v, seat){
  switch(kind){
    case 'U':     return tgUid(v) || null;
    case 'Z':     return tgZone(v) || null;
    case 'X':     return tgNum(v, -1e4, 1e4);
    case 'B':     return (typeof v === 'boolean') ? v : ((v === 0 || v === 1) ? !!v : null);
    case 'I':     return tgInt(v, 0, 10000);
    case 'FX':    return v === 'crystal' ? v : null;
    case 'C':     return (typeof v === 'string' && /^[A-Za-z ]{1,20}$/.test(v)) ? v : null;
    case 'STEP':  return (v === 'main' || v === 'battle') ? v : null;
    case 'PH':    return tgInt(v, 0, 20);
    case 'ROLE':  return (v === '' || TG_DECL[v] === 1) ? v : null;
    case 'SELF':  return seat || null;
    case 'N':     return tgInt(v, 1, 1e6);
    case 'S30':   return (typeof v === 'string') ? tgStr(v, 30) : null;
    case 'S80':   return (typeof v === 'string') ? tgStr(v, 80) : null;
    case 'NAME':  return (typeof v === 'string') ? tgStr(v, 200) : null;
    case 'UIDS':  return Array.isArray(v) ? v.slice(0, 1000).map(tgUid).filter(Boolean) : null;
    case 'TK':    return TG_TOKEN_KINDS[v] === 1 ? v : null;
    case 'V':     return tgNum(v, -1e6, 1e6);
    case 'CTR':   return TG_CTRS[v] === 1 ? v : null;
    case 'CTRS':  return tgCounters(v);
    case 'COUNT': return tgInt(v, 0, 1000);
    case 'ZMODE': return (v === '' || v === 'all' || v === 'top') ? v : null;
    case 'GRID':  return tgGrid(v);
    case 'GSAY':  return (typeof v === 'string' && /^(?:size|shape|lines|pic|nopic|move)$/.test(v)) ? v : null;
    case 'GTOK':  return tgGTok(v);
    case 'GC':    return tgInt(v, 0, TG_GRID_MOST - 1);
    case 'LAB':   return (typeof v === 'string') ? tgLab(v) : null;
    case 'GW':    return tgInt(v, 1, 10);
    case 'GROT':  return tgInt(v, 0, 5);
    case 'GCOL':  return (v === '' || TG_GCOLS[v] === 1) ? v : null;
    case 'GMAP':  return (typeof v === 'string') ? tgStr(v, 60).trim().toLowerCase() : null;
    case 'GN':    return tgInt(v, 1, 1e15);
    case 'GICON': return tgIcon(v);
    case 'DMG':   return tgInt(v, 0, TG_DMG_MOST);
    case 'DMGD':  return tgInt(v, -TG_DMG_MOST, TG_DMG_MOST);
    case 'CD':    return (v === '' || (typeof v === 'string' && TG_UID.test(v))) ? v : null;
    case 'GTK':   return tgInt(v, 0, 4);
    case 'GRUNS': return tgRuns(v);
    case 'GEV':   return tgInt(v, 0, 2);
    case 'GEDGES':return tgEdges(v, false, 5000);
    case 'GE':    return tgInt(v, -1, TG_GRID_MOST - 1);
    case 'GED':   return tgInt(v, 0, 2);
    case 'GLINE': return tgGLine(v);
    case 'GIDS':  return tgIds(v);
    case 'GAREA': return tgGArea(v);
    case 'SEATQ': return tgSeat(v) || null;
    case 'ROLEQ': return (v === '' || v === 'dm' || v === 'dmp') ? v : null;
  }
  return null;
}
function tgAct(a, seat){
  if(!tgObj(a) || typeof a.t !== 'string' || !TG_ACTS.hasOwnProperty(a.t)) return null;
  var spec = TG_ACTS[a.t], out = {t:a.t};
  Object.keys(spec).forEach(function(k){
    if(k === '$') return;
    if(spec[k] !== 'SELF' && a[k] === undefined) return;
    var v = tgField(spec[k], a[k], seat);
    if(v != null) out[k] = v;
  });
  var need = spec.$ || [];
  for(var i = 0; i < need.length; i++) if(out[need[i]] == null) return null;
  if(a.t === 'pass' && !out.side) return null;
  return out;
}

function tgTray(p){
  if(!tgObj(p)) return null;
  if(p.kind === 'coin') return {kind:'coin', res:(p.res === 'Tails' ? 'Tails' : 'Heads')};
  if(p.kind !== 'dice' || !Array.isArray(p.dice)) return null;
  var dice = p.dice.slice(0, 100).map(function(d){
    if(!Array.isArray(d)) return null;
    var n = tgInt(d[0], 1, 1000), v = tgInt(d[1], 0, 1000);
    return (n == null || v == null) ? null : [n, v];
  }).filter(Boolean);
  var o = {kind:'dice', formula:tgStr(p.formula, 60), dice:dice,
           n:tgIntOr(p.n, 0, 100000, dice.length), flat:tgIntOr(p.flat, -1e6, 1e6, 0)};
  var sum = tgNum(p.sum, -1e9, 1e9);
  if(sum != null) o.sum = sum;
  return o;
}

/* Every view draftView makes passes through unchanged: checkdraft.js plays whole drafts through it. */
function tgNames(a, max){
  return Array.isArray(a) ? a.slice(0, max || 400).map(function(x){ return tgStr(x, 200); }) : [];
}
function tgInts(a, max, hi){
  return Array.isArray(a) ? a.slice(0, max).map(function(x){ return tgIntOr(x, 0, hi, 0); }) : [];
}
function tgDraftMove(m){
  if(!tgObj(m)) return null;
  var o = {}, bad = false;
  if(m.pack !== undefined) o.pack = tgStr(m.pack, 20);
  if(m.name !== undefined) o.name = tgStr(m.name, 200);
  [['i', 200], ['a', 5], ['p', 3]].forEach(function(f){
    if(m[f[0]] === undefined) return;
    var n = tgInt(m[f[0]], 0, f[1]);
    if(n == null) bad = true; else o[f[0]] = n;
  });
  return (bad || !Object.keys(o).length) ? null : o;
}
function tgDraftTypes(){ return (typeof DRAFT_TYPES !== 'undefined') ? DRAFT_TYPES : null; }
function tgDraftView(v){
  var T = tgDraftTypes();
  if(!tgObj(v) || !T || typeof v.type !== 'string' || !T.hasOwnProperty(v.type)) return null;
  var I = tgIntOr, BIG = 100000;
  var o = {type:v.type, seat:I(v.seat, 0, 3, 0), seats:I(v.seats, 1, 4, 1), seq:I(v.seq, 0, 1e9, 0),
           done:v.done === true, picks:tgNames(v.picks, 1000), counts:tgInts(v.counts, 4, BIG)};
  if(v.type === 'standard'){
    o.round = I(v.round, 0, 100, 0); o.rounds = I(v.rounds, 0, 100, 0);
    o.dir = (v.dir === -1) ? -1 : 1;
    o.pack = tgObj(v.pack) ? {id:tgStr(v.pack.id, 20), cards:tgNames(v.pack.cards, 100)} : null;
    o.queued = tgInts(v.queued, 4, BIG);
    o.pick = I(v.pick, 0, 1000, 0);
  } else if(v.type === 'hex'){
    o.round = I(v.round, 0, 1000, 0); o.rounds = I(v.rounds, 0, 1000, 0);
    o.turn = I(v.turn, 0, 1, 0); o.stage = I(v.stage, 0, 1, 0); o.starter = I(v.starter, 0, 1, 0);
    o.tops = (Array.isArray(v.tops) ? v.tops.slice(0, 6) : []).map(function(x){
      return (typeof x === 'string') ? tgStr(x, 200) : null; });
    o.heights = tgInts(v.heights, 6, BIG);
    o.taken = {};
    if(tgObj(v.taken)) Object.keys(v.taken).forEach(function(k){
      if(/^[0-5]$/.test(k)) o.taken[k] = I(v.taken[k], 0, 1, 0); });
    var round = function(r){
      if(!tgObj(r)) return null;
      return {picks:(Array.isArray(r.picks) ? r.picks.slice(0, 4) : []).map(function(p){
                if(!tgObj(p)) return null;
                return {seat:I(p.seat, 0, 1, 0), piles:tgInts(p.piles, 2, 5), cards:tgNames(p.cards, 2)};
              }).filter(Boolean),
              gone:(Array.isArray(r.gone) ? r.gone.slice(0, 6) : []).map(function(g){
                if(!tgObj(g)) return null;
                return {pile:I(g.pile, 0, 5, 0), card:tgStr(g.card, 200)};
              }).filter(Boolean)};
    };
    o.last = round(v.last);
    o.now = round(v.now);
    o.all = (Array.isArray(v.all) ? v.all.slice(0, 4) : []).map(function(a){ return tgNames(a, 1000); });
  } else if(v.type === 'winchester'){
    o.turn = I(v.turn, 0, 3, 0); o.stack = I(v.stack, 0, BIG, 0); o.total = I(v.total, 0, BIG, 0);
    o.piles = (Array.isArray(v.piles) ? v.piles.slice(0, 4) : []).map(function(p){ return tgNames(p, 1000); });
    o.last = tgObj(v.last) ? {seat:I(v.last.seat, 0, 3, 0), pile:I(v.last.pile, 0, 3, 0),
                              cards:tgNames(v.last.cards, 1000)} : null;
    o.all = (Array.isArray(v.all) ? v.all.slice(0, 4) : []).map(function(a){ return tgNames(a, 1000); });
  }
  o.legal = (Array.isArray(v.legal) ? v.legal.slice(0, 200) : []).map(tgDraftMove).filter(Boolean);
  return o;
}
function tgDraftSeats(list){
  return (Array.isArray(list) ? list.slice(0, 4) : []).map(function(s){
    if(!tgObj(s)) return null;
    return {name:tgName(s.name), side:tgSeat(s.side), bot:s.bot === true};
  }).filter(Boolean);
}

function tgSagaRow(s){
  if(!tgObj(s)) return null;
  var id = tgStr(s.id, 80).trim();
  if(!id) return null;
  return {id:id, name:tgStr(s.name, 80) || id, url:tgUrl(s.url, 400), n:tgIntOr(s.n, 0, 1e6, 0),
          h:tgStr(s.h, 40), on:s.on !== false, official:s.official === true, table:s.table === true,
          own:s.own === true, pend:s.pend === true};
}

function tgWho(fromId){
  var w = {id:fromId, seat:'', watch:false, host:false};
  if(typeof TBL === 'undefined' || !fromId) return w;
  var seats = TBL.seats || {};
  tgSeats().forEach(function(k){ if(!w.seat && seats[k] && seats[k].id === fromId) w.seat = k; });
  if(!w.seat) w.watch = (TBL.watchList || []).some(function(x){ return x && x.id === fromId; });
  w.host = !!w.seat && fromId === TBL.hostId;
  return w;
}
function tgDraftTable(){
  try{ return (typeof drTableIsDraft === 'function') && drTableIsDraft(); }catch(_){ return false; }
}

/* who: '' anybody, 'seat' a player in a chair, 'host' the host's chair at a draft table; f rebuilds the message or answers null. */
function tgZoneOnly(m){ var z = tgZone(m.zone); return z ? {zone:z} : null; }
function tgBeat(m){ var at = tgNum(m.at, 0, 1e15); return at == null ? null : {at:at}; }
var TG_IN = {
  beat:     {who:'seat', f:tgBeat},
  beatback: {who:'seat', f:tgBeat},
  state:    {who:'seat', f:function(m, w){
              var turn = tgSeat(m.turn);
              if(m.board === null) return {board:null, turn:turn};
              var b = tgBoard(m.board);
              if(!b) return null;
              b.side = w.seat;              /* the sender's half, whatever it says */
              return {board:b, turn:turn};
            }},
  act:      {who:'seat', f:function(m, w){
              var a = tgAct(m.a, w.seat);
              if(!a) return null;
              var by = tgSeat(m.by);
              return (by && by !== w.seat) ? {a:a, by:by} : {a:a};
            }},
  turn:     {who:'seat', f:function(m){ var s = tgSeat(m.side); return s ? {side:s} : null; }},
  say:      {who:'', f:function(m){ var s = tgStr(m.text, 300).trim(); return s ? {text:s} : null; }},
  want:     {who:'', f:function(m){
              var o = {};
              if(typeof m.cards === 'string'){ var c = tgStr(m.cards, 120).trim(); if(c) o.cards = c; }
              if(typeof m.pic === 'string' && TG_PIC_ID.test(m.pic)) o.pic = m.pic;
              return o;
            }},
  roll:     {who:'seat', f:function(m){
              var l = tgStr(m.line, 200).trim();
              if(!l) return null;
              var o = {line:l}, tr = tgTray(m.tray);
              if(tr) o.tray = tr;
              return o;
            }},
  arrow:    {who:'seat', f:function(m, w){
              var a = m.a;
              if(!tgObj(a)) return null;
              var from = tgUid(a.from), to = tgUid(a.to);
              var id = (typeof a.id === 'string' && /^ar\d{1,12}$/.test(a.id)) ? a.id : '';
              if(!from || !to || from === to || !id) return null;
              return {a:{id:id, from:from, to:to, by:w.seat}};
            }},
  arrows:   {who:'seat', f:function(m, w){
              return (m.clear === 'all' || m.clear === w.seat) ? {clear:m.clear} : null; }},
  ptr:      {who:'seat', f:function(m){
              if(m.off === true) return {off:true};
              var o = {seat:tgSeat(m.seat), zone:tgZone(m.zone),
                       fx:tgNum(m.fx, -0.5, 1.5) || 0, fy:tgNum(m.fy, -0.5, 1.5) || 0};
              var u = tgUid(m.uid);
              if(u){ o.uid = u; o.ux = tgNum(m.ux, -0.5, 1.5) || 0; o.uy = tgNum(m.uy, -0.5, 1.5) || 0; }
              var rx = tgNum(m.rx, -0.5, 1.5), ry = tgNum(m.ry, -0.5, 1.5);
              if(rx != null && ry != null && o.zone === 'field' && !o.seat){
                o.rx = rx; o.ry = ry;
                if(m.rm === true) o.rm = true;
              }
              return o;
            }},
  ping:     {who:'seat', f:function(m){ var u = tgUid(m.uid); return u ? {uid:u} : null; }},
  /* Shape only: whether the piece is the receiver's and still on the Field is the receiver's to decide (tdRbFieldReq). */
  fld:      {who:'seat', f:function(m){
              var op = m.op, uid = tgUid(m.uid), tok = tgUid(m.tok);
              switch(op){
                case 'move':
                  var x = tgNum(m.x, 0, 100), y = tgNum(m.y, 0, 100);
                  return (uid && x != null && y != null) ? {op:op, uid:uid, x:x, y:y} : null;
                case 'lock':  return uid ? {op:op, uid:uid, on:m.on === true} : null;
                case 'face':  return uid ? {op:op, uid:uid, down:m.down === true} : null;
                case 'grave': return uid ? {op:op, uid:uid} : null;
                case 'tok':
                  if(!uid || TG_TOKEN_KINDS[m.kind] !== 1) return null;
                  var v = tgNum(m.value, -1e6, 1e6);
                  return {op:op, uid:uid, kind:m.kind, name:tgStr(m.name, 80), value:(v == null ? 1 : v)};
                case 'tokset':
                  var sv = tgNum(m.value, -1e6, 1e6);
                  return (tok && sv != null) ? {op:op, tok:tok, value:sv} : null;
                case 'tokdel': return tok ? {op:op, tok:tok} : null;
                case 'gmove':
                  var gc = tgInt(m.c, 0, TG_GRID_MOST - 1), grr = tgInt(m.r, 0, TG_GRID_MOST - 1);
                  return (tok && gc != null && grr != null) ? {op:op, tok:tok, c:gc, r:grr} : null;
                case 'glab':
                  var gl = tgLab(m.lab);
                  return (tok && gl) ? {op:op, tok:tok, lab:gl} : null;
                case 'gsize':
                  var gw = tgInt(m.w, 1, 10), gh = tgInt(m.h, 1, 10);
                  return (tok && gw != null && gh != null) ? {op:op, tok:tok, w:gw, h:gh} : null;
                case 'grot':
                  var gro = tgInt(m.rot, 0, 5);
                  return (tok && gro != null) ? {op:op, tok:tok, rot:gro} : null;
                case 'gdel': return tok ? {op:op, tok:tok} : null;
                case 'label':
                  return (uid && typeof m.lab === 'string') ? {op:op, uid:uid, lab:tgLab(m.lab)} : null;
                case 'dmg':
                  var dv = tgInt(m.v, 0, TG_DMG_MOST), dd = tgInt(m.d, -TG_DMG_MOST, TG_DMG_MOST);
                  return (uid && dv != null && dv === m.v) ? {op:op, uid:uid, v:dv, d:(dd == null ? 0 : dd), clr:m.clr === true} : null;
                case 'gconn':
                  if(!tok || typeof m.cd !== 'string' || (m.cd !== '' && !TG_UID.test(m.cd))) return null;
                  return {op:op, tok:tok, cd:m.cd};
                case 'gcol':
                  return (tok && (m.col === '' || TG_GCOLS[m.col] === 1)) ? {op:op, tok:tok, col:m.col} : null;
                case 'gline':
                  var ln = tgGLine(m.line);
                  return ln ? {op:op, line:ln} : null;
                case 'garea':
                  var ar = tgGArea(m.area);
                  return ar ? {op:op, area:ar} : null;
                case 'glinedel': case 'gareadel':
                  var ids = tgIds(m.ids);
                  return (ids && ids.length) ? {op:op, ids:ids} : null;
              }
              return null;
            }},
  /* A spot on the map pinged, in grid units as a line's points are (cat_rbmap.js). */
  mping:    {who:'seat', f:function(m){
              var p = tgPt([m.x, m.y]);
              return p ? {x:p[0], y:p[1]} : null;
            }},
  /* The two turns of a table with a DM (cat_rbplay.js): the DM says whose, a player says they are done; whether the sender is the DM is the receiver's to ask. */
  rbturn:   {who:'seat', f:function(m){
              if(m.who !== 'pl' && m.who !== 'dm') return null;
              var n = tgInt(m.n, 1, 1e9);
              if(n == null) return null;
              var done = {};
              if(tgObj(m.done)) Object.keys(m.done).forEach(function(k){ if(tgSeat(k) && m.done[k] === 1) done[k] = 1; });
              var o = {who:m.who, n:n, done:done};
              if(m.early === true) o.early = true;
              return o;
            }},
  rbdone:   {who:'seat', f:function(m){ var n = tgInt(m.n, 1, 1e9); return n == null ? null : {n:n}; }},
  /* The whole table saved (cat_rbplay.js): the DM asks, each player keeps their own and answers with it, and a table loaded sends each player theirs. */
  tsave:    {who:'seat', f:function(m){
              var id = (typeof m.id === 'string' && /^ts\d{1,15}$/.test(m.id)) ? m.id : '';
              return id ? {id:id, name:tgStr(m.name, 60).trim()} : null;
            }},
  tsbd:     {who:'seat', f:function(m){
              var id = (typeof m.id === 'string' && /^ts\d{1,15}$/.test(m.id)) ? m.id : '';
              var b = id ? tgBoard(m.board) : null;
              return b ? {id:id, board:b} : null;
            }},
  tload:    {who:'seat', f:function(m){
              var id = (typeof m.id === 'string' && /^ts\d{1,15}$/.test(m.id)) ? m.id : '';
              var b = id ? tgBoard(m.board) : null;
              return (id && (b || m.board === null)) ? {id:id, board:b, name:tgStr(m.name, 60).trim(), at:tgNum(m.at, 0, 1e15) || 0} : null;
            }},
  /* The DM handing the role over: the map on the Field, as a saved map is (tdMapClean, cat_rbdm.js, rebuilds it). */
  dmhand:   {who:'seat', f:function(m){
              if(!tgObj(m.map)) return null;
              return {map:m.map, pers:m.pers === true};
            }},
  /* The receiver's app makes the card, and only if the sender is the DM (tdDmGiftFrom). */
  gift:     {who:'seat', f:function(m){
              var n = tgStr(m.n, 200).trim();
              if(!n) return null;
              var o = {n:n}, g = tgUid(m.g);
              if(g) o.g = g;
              return o;
            }},
  ungift:   {who:'seat', f:function(m){
              var g = tgUid(m.g);
              return g ? {g:g, n:tgStr(m.n, 200).trim()} : null;
            }},
  ask:      {who:'seat', f:function(m){
              var z = tgZone(m.zone);
              if(!z) return null;
              return {zone:z, scope:(m.scope === 'top' ? 'top' : 'all'), n:tgIntOr(m.n, 0, 60, 0)};
            }},
  deny:     {who:'seat', f:tgZoneOnly},
  shown:    {who:'seat', f:function(m){
              var z = tgZone(m.zone);
              if(!z) return null;
              var cards = (Array.isArray(m.cards) ? m.cards.slice(0, 500) : []).map(function(c){
                var u = tgObj(c) ? tgUid(c.uid) : '';
                if(!u) return null;
                var sc = {uid:u, n:tgStr(c.n, 200)}, sl = tgLab(c.lab);
                if(sl) sc.lab = sl;
                return sc;
              }).filter(Boolean);
              var o = {zone:z, cards:cards}, tot = tgInt(m.total, 0, 500);
              if(tot != null) o.total = tot;
              return o;
            }},
  unshown:  {who:'seat', f:tgZoneOnly},
  rematch:  {who:'seat', f:function(m){
              if(m.ask === true) return {ask:true};
              if(m.yes === true) return {yes:true};
              if(m.no === true) return {no:true};
              return null;
            }},
  seat:     {who:'seat', f:function(m, w){
              var o = {deck:tgStr(m.deck, 40), counts:tgStr(m.counts, 24),
                       legal:(m.legal === true || m.legal === false) ? m.legal : null,
                       ready:m.ready === true};
              if(w && w.host && (m.dm === 'dm' || m.dm === 'dmp')) o.dm = m.dm;
              var ic = tgIcon(m.icon);
              if(ic) o.icon = ic;
              return o;
            }},
  /* Not who:'host', which is the host at a draft table: the chair is asked here (w.host, from TBL.hostId, which only the relay sets). */
  discord:  {who:'seat', f:function(m, w){
              if(!w.host || typeof m.url !== 'string') return null;
              if(m.url === '') return {url:''};
              var u = tgDiscord(m.url);
              return u ? {url:u} : null;
            }},
  cards:    {who:'seat', f:function(m){
              return {v:1, sagas:(Array.isArray(m.sagas) ? m.sagas.slice(0, 300) : []).map(tgSagaRow).filter(Boolean),
                      deck:(Array.isArray(m.deck) ? m.deck.slice(0, 300) : []).map(function(x){
                        return tgStr(x, 80); }).filter(Boolean)};
            }},
  cardsask: {who:'seat', f:function(){ return {}; }},
  cardsget: {who:'seat', f:function(m){ var s = tgStr(m.saga, 80).trim(); return s ? {saga:s} : null; }},
  sagapart: {who:'seat', f:function(m){
              var s = tgStr(m.saga, 80).trim(), n = tgInt(m.n, 1, 400), i = tgInt(m.i, 0, 399);
              if(!s || n !== m.n || i !== m.i || i >= n) return null;
              if(typeof m.part !== 'string' || m.part.length > 200000) return null;
              return {saga:s, n:n, i:i, part:m.part};
            }},
  gpic:     {who:'seat', f:function(m){
              var n = tgInt(m.n, 1, 40), i = tgInt(m.i, 0, 39);
              if(typeof m.id !== 'string' || !TG_PIC_ID.test(m.id) || n !== m.n || i !== m.i || i >= n) return null;
              if(typeof m.part !== 'string' || m.part.length > 200000) return null;
              return {id:m.id, n:n, i:i, part:m.part};
            }},
  dstart:   {who:'host', f:function(m){
              var T = tgDraftTypes();
              if(!T || typeof m.type !== 'string' || !T.hasOwnProperty(m.type)) return null;
              return {type:m.type, from:tgStr(m.from, 60), timer:tgIntOr(m.timer, 0, 3600, 0),
                      n:tgIntOr(m.n, 0, 1e6, 0), seats:tgDraftSeats(m.seats)};
            }},
  dview:    {who:'host', f:function(m){
              var v = tgDraftView(m.v);
              if(!v) return null;
              return {type:v.type, from:tgStr(m.from, 60), timer:tgIntOr(m.timer, 0, 3600, 0),
                      names:tgDraftSeats(m.names), v:v, left:tgIntOr(m.left, 0, 3600000, 0)};
            }},
  dstop:    {who:'host', f:function(){ return {}; }},
  dpick:    {who:'seat', f:function(m){
              var mv = tgDraftMove(m.m);
              return mv ? {seq:tgIntOr(m.seq, 0, 1e9, 0), m:mv} : null;
            }}
};

/* Answers the message rebuilt, or null, which is never acted on. */
function tgInbound(msg, fromId){
  if(!tgObj(msg)) return tgDrop('not a message');
  var t = msg.t;
  if(typeof t !== 'string' || !TG_IN.hasOwnProperty(t)) return tgDrop('no such message: ' + tgStr(String(t), 20));
  var rule = TG_IN[t], w = tgWho(fromId);
  if(rule.who === 'seat' && !w.seat) return tgDrop(t + ' from somebody with no chair');
  if(rule.who === 'host' && !(w.host && tgDraftTable())) return tgDrop(t + ' from somebody not dealing a draft');
  var out = null;
  try{ out = rule.f(msg, w); }catch(_){ out = null; }
  if(!out) return tgDrop(t + ' that does not fit');
  out.t = t;
  var to = tgId(msg.to);
  if(to) out.to = to;
  return out;
}

/* A `from` passes its message on untouched: tgInbound reads that. */
function tgMeta(t){
  if(!tgObj(t)) return null;
  return {pub:t.pub === true, name:tgName(t.name), note:tgStr(t.note, 80).trim(),
          format:tgStr(t.format, 20).trim(), spect:t.spect !== false, strict:t.strict === true,
          mode:(t.mode === 'draft' ? 'draft' : 'game'), dtype:tgStr(t.dtype, 16).trim()};
}
function tgPeers(list){
  return (Array.isArray(list) ? list.slice(0, 8) : []).map(function(p){
    if(!tgObj(p)) return null;
    var id = tgId(p.id), side = tgSeat(p.side);
    return (id && side) ? {id:id, name:tgName(p.name) || 'Player', side:side} : null;
  }).filter(Boolean);
}
function tgWatchers(list){
  return (Array.isArray(list) ? list.slice(0, 500) : []).map(function(p){
    var id = tgObj(p) ? tgId(p.id) : '';
    return id ? {id:id, name:tgName(p.name) || 'Spectator'} : null;
  }).filter(Boolean);
}
function tgRelay(m){
  if(!tgObj(m) || typeof m.t !== 'string') return tgDrop('not a relay message');
  switch(m.t){
    case 'joined':
      var watch = m.watch === true, you = tgId(m.you), side = tgSeat(m.side);
      if(!you || (!watch && !side)) return tgDrop('joined without a seat');
      var j = {t:'joined', you:you, side:(watch ? '' : side), watch:watch, first:m.first === true,
               back:m.back === true, cap:tgIntOr(m.cap, 2, tgCapMost(), 2), host:tgId(m.host),
               status:(m.status === 'waiting' ? 'waiting' : 'playing'), table:tgMeta(m.table),
               peers:tgPeers(m.peers), watchers:tgWatchers(m.watchers)};
      if(typeof m.key === 'string' && /^[A-Za-z0-9_-]{8,80}$/.test(m.key)) j.key = m.key;
      return j;
    case 'full':     return {t:'full', cap:tgIntOr(m.cap, 2, tgCapMost(), 2)};
    case 'mismatch': return {t:'mismatch', why:(m.why === 'game' ? 'game' : 'set'),
                             theirs:tgStr(m.theirs, 64), yours:tgStr(m.yours, 64)};
    case 'nospect':  return {t:'nospect'};
    case 'started':  return {t:'started', by:tgId(m.by), at:tgNum(m.at, 0, 1e15) || 0};
    case 'meta':     return {t:'meta', table:tgMeta(m.table)};
    case 'host':
      var hid = tgId(m.id);
      if(!hid) return tgDrop('host without an id');
      var ho = {t:'host', id:hid, name:tgName(m.name) || 'Player'}, hb = tgId(m.by);
      if(hb) ho.by = hb;
      return ho;
    case 'peer':
      var pid = tgId(m.id), pw = m.watch === true, ps = tgSeat(m.side);
      if(!pid || (!pw && !ps)) return tgDrop('peer without a seat');
      var po = {t:'peer', join:m.join === true, watch:pw, id:pid,
                name:tgName(m.name) || (pw ? 'Spectator' : 'Player'), side:(pw ? '' : ps)};
      if(m.kicked === true && !po.join) po.kicked = true;
      return po;
    case 'kicked':   return {t:'kicked'};
    case 'banned':   return {t:'banned'};
    case 'from':
      var fid = tgId(m.id);
      if(!fid || !tgObj(m.msg)) return tgDrop('from without a sender');
      return {t:'from', id:fid, msg:m.msg};
  }
  return tgDrop('no such relay message: ' + tgStr(m.t, 20));
}
function tgTables(m){
  if(!tgObj(m) || m.t !== 'tables') return null;
  var rows = (Array.isArray(m.tables) ? m.tables.slice(0, 500) : []).map(function(t){
    if(!tgObj(t) || typeof t.room !== 'string' || !/^[A-Z2-9]{6}$/.test(t.room)) return null;
    var meta = tgMeta(t);
    return {room:t.room, name:meta.name, note:meta.note, format:meta.format, host:tgName(t.host),
            cap:tgIntOr(t.cap, 2, tgCapMost(), 2),
            seats:(Array.isArray(t.seats) ? t.seats.slice(0, 6) : []).map(function(s){
              return (tgObj(s) && tgSeat(s.side)) ? {side:s.side, name:tgName(s.name) || 'Player'} : null;
            }).filter(Boolean),
            watchers:tgIntOr(t.watchers, 0, 100000, 0), spect:meta.spect, strict:meta.strict,
            status:(t.status === 'playing' || t.status === 'waiting') ? t.status : '',
            since:tgNum(t.since, 0, 1e15) || 0, started:tgNum(t.started, 0, 1e15) || 0,
            set:tgStr(t.set, 64), mode:meta.mode, dtype:meta.dtype};
  }).filter(Boolean);
  return {t:'tables', tables:rows, online:tgIntOr(m.online, 0, 1e7, 0)};
}

if(typeof module !== 'undefined' && module.exports)
  module.exports = {TG:TG, tgInbound:tgInbound, tgRelay:tgRelay, tgTables:tgTables, tgBoard:tgBoard,
    tgFeed:tgFeed, tgAct:tgAct, tgTray:tgTray, tgDraftView:tgDraftView, tgDraftMove:tgDraftMove,
    tgUid:tgUid, tgLab:tgLab, tgGrid:tgGrid, tgGTok:tgGTok, tgIcon:tgIcon,
    tgRuns:tgRuns, tgEdges:tgEdges, tgGLine:tgGLine, tgGArea:tgGArea};
