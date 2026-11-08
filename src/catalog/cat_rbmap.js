/* The map on a Rebirth Field, past its tokens: the DM's painting, walls and doors, the fog, everybody's lines, areas and pings, and Movement. */

/* ── What the map holds ──────────────────────────────────────────────────── */
/* On its owner's board (the DM's at a table), read back by tgBoard (cat_guard.js): gter, runs of painted squares
   [c, r, n, kind]; gedge, walls and doors [c, r, d, v]; gfog, runs still covered [c, r, n]; glines and gareas,
   everybody's marks, which the DM's app keeps for them (tdMapReq). */
var TD_MAP_TER = {
  1:{n:'Difficult Terrain', cost:2, ink:'--gf-dt'},
  2:{n:'Deep Water', cost:3, ink:'--gf-dw'},
  3:{n:'Climbing', cost:3, ink:'--gf-cl'},
  4:{n:'Wall', cost:0, ink:'--gf-wl'}};
/* k paints a square (0 clears it); v goes along a line: 1 a wall, 2 a door, 0 clears it. */
var TD_MAP_BRUSHES = {
  dt:{k:1, n:'Difficult Terrain'}, dw:{k:2, n:'Deep Water'}, cl:{k:3, n:'Climbing'}, wl:{k:4, n:'Wall'},
  cs:{k:0, n:'Clear'}, ew:{v:1, n:'Wall', bar:'Wall Line'}, ed:{v:2, n:'Door'}, ec:{v:0, n:'Clear', bar:'Clear Line'}};
var TD_MAP_SQ_BRUSHES = ['dt', 'dw', 'cl', 'wl', 'cs'], TD_MAP_LN_BRUSHES = ['ew', 'ed', 'ec'];
var TD_MAP_TOOLS = {rul:'Ruler', mv:'Movement', circle:'Circle', cone:'Cone', line:'Line', square:'Square',
                    ping:'Ping', draw:'Draw Line'};
var TD_MAP_TOOL_ORDER = ['rul', 'mv', 'circle', 'cone', 'line', 'square', 'ping', 'draw'];
/* Lines and areas: not undone (tdUndo), and at a table carried out by the DM's app for whoever asks (tdMapReq). */
var TD_MAP_MARKS = {gline:1, glinedel:1, garea:1, gareadel:1};
var TD_MAP_PING_MS = 1600;
/* Yours alone, never saved or sent: the tool picked on each dropdown, which one is on, the drag under way, and the
   lines and areas you drew since the page opened, in order (mine), which are all Esc takes back. */
var MAP = {rt:'rul', brush:'dt', paint:false, fm:'cover', fog:false, perm:false, drag:null, pings:[], raf:0,
           cov:{}, covN:0, pingAt:0, mine:{}, n:0};

function tdMapList(b, f){ return (b && Array.isArray(b[f])) ? b[f] : []; }
function tdMapEach(runs, fn){
  (Array.isArray(runs) ? runs : []).forEach(function(x){ for(var i = 0; i < x[2]; i++) fn(x[0] + i, x[1], x[3]); });
}
function tdMapCells(runs){
  var o = {};
  tdMapEach(runs, function(c, r, k){ o[c + ',' + r] = (k == null ? 1 : k); });
  return o;
}
/* Along each row, left to right: the order tgRuns reads back. */
function tdMapRuns(cells, withK){
  var ps = Object.keys(cells).map(function(k){ var p = k.split(','); return [+p[0], +p[1], cells[k]]; });
  ps.sort(function(a, b){ return (a[1] - b[1]) || (a[0] - b[0]); });
  var out = [], cur = null;
  ps.forEach(function(p){
    if(cur && cur[1] === p[1] && cur[0] + cur[2] === p[0] && (!withK || cur[3] === p[2])){ cur[2]++; return; }
    cur = withK ? [p[0], p[1], 1, p[2]] : [p[0], p[1], 1];
    out.push(cur);
  });
  return out;
}
function tdMapEdgeKey(e){ return e[0] + ',' + e[1] + ',' + e[2]; }
function tdMapEdges(b){
  var o = {};
  tdMapList(b, 'gedge').forEach(function(x){ o[tdMapEdgeKey(x)] = x[3]; });
  return o;
}
function tdMapEdgeList(o){
  return Object.keys(o).map(function(k){ var p = k.split(','); return [+p[0], +p[1], +p[2], o[k]]; })
    .sort(function(a, b){ return (a[1] - b[1]) || (a[0] - b[0]) || (a[2] - b[2]); });
}

/* ── Actions ─────────────────────────────────────────────────────────────── */
TD_ACT.gpaint = function(b, a){
  var k = tgIntOr(a.k, 0, 4, 0), cells = tdMapCells(b.gter);
  tdMapEach(a.cells, function(c, r){ var key = c + ',' + r; if(k) cells[key] = k; else delete cells[key]; });
  var runs = tdMapRuns(cells, true);
  if(runs.length) b.gter = runs; else delete b.gter;
};
/* A door painted over a door, open or closed, leaves it as it is. */
TD_ACT.gedge = function(b, a){
  var v = tgIntOr(a.v, 0, 2, 0), o = tdMapEdges(b), n = Object.keys(o).length;
  (Array.isArray(a.edges) ? a.edges : []).forEach(function(e){
    var key = tdMapEdgeKey(e), was = o[key];
    if(!v){ if(was){ delete o[key]; n--; } return; }
    if(v === 2 && (was === 2 || was === 3)) return;
    if(!was){ if(n >= TG_EDGES_MOST) return; n++; }
    o[key] = v;
  });
  var l = tdMapEdgeList(o);
  if(l.length) b.gedge = l; else delete b.gedge;
};
TD_ACT.gdoor = function(b, a){
  var o = tdMapEdges(b), key = tdMapEdgeKey([a.c, a.r, a.d]);
  if(o[key] !== 2 && o[key] !== 3) return;
  o[key] = a.open ? 3 : 2;
  b.gedge = tdMapEdgeList(o);
};
TD_ACT.gfog = function(b, a){
  if(a.all){
    if(!a.on){ delete b.gfog; return; }
    var g = tdGfClean(b.grid), all = [];
    for(var r = 0; r < g.r; r++) all.push([0, r, g.c]);
    b.gfog = all;
    return;
  }
  var cells = tdMapCells(b.gfog);
  tdMapEach(a.cells, function(c, r){ var key = c + ',' + r; if(a.on) cells[key] = 1; else delete cells[key]; });
  var runs = tdMapRuns(cells, false);
  if(runs.length) b.gfog = runs; else delete b.gfog;
};
TD_ACT.gline = function(b, a){
  var l = tgGLine(a.line);
  if(!l) return;
  var ls = tdMapList(b, 'glines').filter(function(x){ return x.id !== l.id; });
  if(ls.length >= TG_LINES_MOST) return;
  ls.push(l);
  b.glines = ls;
};
TD_ACT.glinedel = function(b, a){
  var ids = {};
  (Array.isArray(a.ids) ? a.ids : []).forEach(function(i){ ids[i] = 1; });
  var left = tdMapList(b, 'glines').filter(function(l){ return !(a.all || (a.s && l.s === a.s) || ids[l.id]); });
  if(left.length) b.glines = left; else delete b.glines;
};
TD_ACT.garea = function(b, a){
  var x = tgGArea(a.area);
  if(!x) return;
  var as = tdMapList(b, 'gareas').filter(function(y){ return y.id !== x.id; });
  if(as.length >= TG_AREAS_MOST) return;
  as.push(x);
  b.gareas = as;
};
TD_ACT.gareadel = function(b, a){
  var ids = {};
  (Array.isArray(a.ids) ? a.ids : []).forEach(function(i){ ids[i] = 1; });
  var left = tdMapList(b, 'gareas').filter(function(x){ return !ids[x.id]; });
  if(left.length) b.gareas = left; else delete b.gareas;
};
function tdMapActionWords(a){
  var hex = tdGfGrid().sh === 'hex';
  var many = function(n){ return n + (hex ? (n === 1 ? ' hex' : ' hexes') : (n === 1 ? ' square' : ' squares')); };
  var count = function(runs){ var n = 0; tdMapEach(runs, function(){ n++; }); return n; };
  switch(a.t){
    case 'gpaint':
      var t = TD_MAP_TER[a.k];
      return t ? 'painted ' + t.n + ' on ' + many(count(a.cells)) : 'cleared the paint from ' + many(count(a.cells));
    case 'gedge':
      var m = Array.isArray(a.edges) ? a.edges.length : 0;
      if(a.v === 1) return m === 1 ? 'drew a wall' : 'drew ' + m + ' walls';
      if(a.v === 2) return m === 1 ? 'put in a door' : 'put in ' + m + ' doors';
      return m === 1 ? 'took out a wall' : 'took out ' + m + ' walls and doors';
    case 'gdoor': return (a.open ? 'opened' : 'closed') + ' a door';
    case 'gfog':
      if(a.all) return a.on ? 'covered the whole map in fog' : 'took the fog off the whole map';
      return (a.on ? 'covered ' : 'uncovered ') + many(count(a.cells)) + (a.on ? ' with fog' : '');
    case 'glinedel': return a.all ? 'cleared all the lines' : '';
  }
  /* a line or an area drawn, or one taken off, is not news */
  return '';
}
window.tdMapActionWords = tdMapActionWords;

/* Written the way tgBoard reads them back, so a board round-trips unchanged (tdGfPack). */
function tdMapPack(b, out){
  ['gter', 'gedge', 'gfog', 'glines', 'gareas'].forEach(function(f){
    if(Array.isArray(b[f]) && b[f].length) out[f] = b[f].slice();
  });
}
function tdMapUnpack(data, board){
  var t = tgRuns(data.gter, 4);
  if(t && t.length) board.gter = t;
  var ed = tgEdges(data.gedge, true);
  if(ed && ed.length) board.gedge = ed;
  var f = tgRuns(data.gfog);
  if(f && f.length) board.gfog = f;
  if(Array.isArray(data.glines)){
    var ls = data.glines.slice(0, TG_LINES_MOST).map(tgGLine).filter(Boolean);
    if(ls.length) board.glines = ls;
  }
  if(Array.isArray(data.gareas)){
    var as = data.gareas.slice(0, TG_AREAS_MOST).map(tgGArea).filter(Boolean);
    if(as.length) board.gareas = as;
  }
}
window.tdMapPack = tdMapPack;
window.tdMapUnpack = tdMapUnpack;

/* ── In a saved map ─────────────────────────────────────────────────────── */
/* A map keeps its painting, walls and doors, fog, everybody's lines and the Permanent areas (tdMapNow); an area that
   is not Permanent is left behind when the map changes. A line or an area comes down with an id of the DM's minted
   then, as a card does, so it can never meet one minted since under the same id. */
function tdMapLayersOf(b, out){
  ['gter', 'gedge', 'gfog'].forEach(function(f){
    var l = tdMapList(b, f);
    if(l.length) out[f] = l.map(function(x){ return x.slice(); });
  });
  var ls = tdMapList(b, 'glines').map(function(l){ return tgGLine(l); }).filter(Boolean);
  if(ls.length) out.glines = ls;
  var as = tdMapList(b, 'gareas').filter(function(x){ return x.perm; }).map(function(x){ return tgGArea(x); }).filter(Boolean);
  if(as.length) out.gareas = as;
  return out;
}
window.tdMapLayersOf = tdMapLayersOf;
/* A saved map can come from a file: read the way a board is (tdMapUnpack), Permanent areas only. */
function tdMapLayersClean(m, out){
  var d = {};
  tdMapUnpack(m || {}, d);
  ['gter', 'gedge', 'gfog', 'glines'].forEach(function(f){ if(d[f]) out[f] = d[f]; });
  var as = (d.gareas || []).filter(function(x){ return x.perm; });
  if(as.length) out.gareas = as;
  return out;
}
window.tdMapLayersClean = tdMapLayersClean;
function tdMapLayersAct(m, act){
  ['gter', 'gedge', 'gfog'].forEach(function(f){
    if(m && Array.isArray(m[f]) && m[f].length) act[f] = m[f].map(function(x){ return x.slice(); });
  });
  var fresh = function(x){ var o = JSON.parse(JSON.stringify(x)); o.id = tdUid('tk'); return o; };
  if(m && Array.isArray(m.glines) && m.glines.length) act.glines = m.glines.map(fresh);
  if(m && Array.isArray(m.gareas) && m.gareas.length) act.gareas = m.gareas.filter(function(x){ return x.perm; }).map(fresh);
  return act;
}
window.tdMapLayersAct = tdMapLayersAct;
/* TD_ACT.map, through tdGfMapDown: the map's own layers replace the last one's, whatever they were. */
function tdMapLayersDown(b, a){
  var d = {};
  tdMapUnpack(a, d);
  ['gter', 'gedge', 'gfog', 'glines', 'gareas'].forEach(function(f){ if(d[f]) b[f] = d[f]; else delete b[f]; });
}
window.tdMapLayersDown = tdMapLayersDown;

/* ── Where things are ────────────────────────────────────────────────────── */
function tdMapCellIn(g, ux, uy){
  var p = tdGfCellRaw(g, ux, uy);
  return (p.c >= 0 && p.r >= 0 && p.c < g.c && p.r < g.r) ? p : null;
}
/* The cells next to one, each with the line between as [c, r, d]: on squares d 0 is a square's east side and 1 its
   south; on hexes 0 its north-east, 1 its south-east and 2 its south (odd-q, as tdGfMid). */
function tdMapNbrs(g, c, r){
  if(g.sh !== 'hex') return [
    {c:c + 1, r:r, e:[c, r, 0]}, {c:c - 1, r:r, e:[c - 1, r, 0]},
    {c:c, r:r + 1, e:[c, r, 1]}, {c:c, r:r - 1, e:[c, r - 1, 1]}];
  var odd = (c & 1) === 1;
  var nw = {c:c - 1, r:odd ? r : r - 1}, sw = {c:c - 1, r:odd ? r + 1 : r};
  return [
    {c:c + 1, r:odd ? r : r - 1, e:[c, r, 0]}, {c:c + 1, r:odd ? r + 1 : r, e:[c, r, 1]},
    {c:c, r:r + 1, e:[c, r, 2]}, {c:c, r:r - 1, e:[c, r - 1, 2]},
    {c:nw.c, r:nw.r, e:[nw.c, nw.r, 1]}, {c:sw.c, r:sw.r, e:[sw.c, sw.r, 0]}];
}
function tdMapEdgeOk(e){ return e[0] >= -1 && e[1] >= -1 && e[0] < TG_GRID_MOST && e[1] < TG_GRID_MOST; }
function tdMapEdgePts(g, e){
  var c = e[0], r = e[1], d = e[2];
  if(g.sh !== 'hex') return d === 0 ? [{x:c + 1, y:r}, {x:c + 1, y:r + 1}] : [{x:c, y:r + 1}, {x:c + 1, y:r + 1}];
  var m = tdGfMid(g, c, r), k0 = [5, 0, 1][d] || 0, k1 = (k0 + 1) % 6;
  var at = function(k){ return {x:m.x + Math.cos(k * Math.PI / 3), y:m.y + Math.sin(k * Math.PI / 3)}; };
  return [at(k0), at(k1)];
}
/* The two cells a line lies between; it is drawn when either is on the grid. */
function tdMapEdgeShown(g, e){
  var on = function(c, r){ return c >= 0 && r >= 0 && c < g.c && r < g.r; };
  if(on(e[0], e[1])) return true;
  var n = tdMapNbrs(g, e[0], e[1])[g.sh === 'hex' ? e[2] : (e[2] ? 2 : 0)];
  return !!n && on(n.c, n.r);
}
function tdMapSegHit(px, py, a, b){
  var dx = b.x - a.x, dy = b.y - a.y, L = dx * dx + dy * dy;
  var t = L ? ((px - a.x) * dx + (py - a.y) * dy) / L : 0, k = Math.max(0, Math.min(1, t));
  var qx = a.x + k * dx - px, qy = a.y + k * dy - py;
  return {d:Math.sqrt(qx * qx + qy * qy), t:t};
}
/* The line nearest a point, within `most` units; `mid` wants the point beside its middle, so a drag along a wall
   does not catch the line crossing it at a corner. */
function tdMapEdgeAt(g, ux, uy, most, mid){
  var at = tdGfCellAt(g, ux, uy), best = null, bd = most;
  tdMapNbrs(g, at.c, at.r).forEach(function(n){
    if(!tdMapEdgeOk(n.e)) return;
    var p = tdMapEdgePts(g, n.e), s = tdMapSegHit(ux, uy, p[0], p[1]);
    if(mid && (s.t < 0.15 || s.t > 0.85)) return;
    if(s.d < bd){ bd = s.d; best = n.e; }
  });
  return best;
}
function tdMapEdgeTo(g, p, q){
  var ns = tdMapNbrs(g, p.c, p.r);
  for(var i = 0; i < ns.length; i++) if(ns[i].c === q.c && ns[i].r === q.r) return ns[i].e;
  return null;
}
/* The cells a straight line from A to B passes, one per step (tdGfSteps): a diagonal on squares is a step. */
function tdMapPath(g, A, B){
  var n = tdGfSteps(g, A, B), out = [], i, t;
  if(g.sh === 'hex'){
    var cube = function(p){ var x = p.c, z = p.r - (p.c - (p.c & 1)) / 2; return {x:x, y:-x - z, z:z}; };
    var a = cube(A), b = cube(B);
    for(i = 0; i <= n; i++){
      t = n ? i / n : 0;
      var x = a.x + (b.x - a.x) * t + 1e-6, y = a.y + (b.y - a.y) * t + 2e-6, z = a.z + (b.z - a.z) * t - 3e-6;
      var rx = Math.round(x), ry = Math.round(y), rz = Math.round(z);
      var dx = Math.abs(rx - x), dy = Math.abs(ry - y), dz = Math.abs(rz - z);
      if(dx > dy && dx > dz) rx = -ry - rz; else if(dy > dz) ry = -rx - rz; else rz = -rx - ry;
      out.push({c:rx, r:rz + (rx - (rx & 1)) / 2});
    }
    return out;
  }
  for(i = 0; i <= n; i++){
    t = n ? i / n : 0;
    out.push({c:Math.round(A.c + (B.c - A.c) * t + 1e-6), r:Math.round(A.r + (B.r - A.r) * t + 1e-6)});
  }
  return out;
}
/* Movement: each square entered costs its terrain (TD_MAP_TER); a Wall square, a wall or a closed door on the way
   blocks it (cost -1, `at` the step it stops at). A diagonal on squares gets round a corner either way it can. */
function tdMapMoveOf(g, A, B){
  var o = tdGfOwner(), path = tdMapPath(g, A, B), ter = tdMapCells(tdMapList(o, 'gter')), ed = tdMapEdges(o), cost = 0;
  var shut = function(e){ var v = e ? ed[tdMapEdgeKey(e)] : 0; return v === 1 || v === 2; };
  var wall = function(c, r){ return ter[c + ',' + r] === 4; };
  for(var i = 1; i < path.length; i++){
    var p = path[i - 1], q = path[i];
    if(wall(q.c, q.r) || tdMapStepShut(g, p, q, shut, wall)) return {cost:-1, path:path, at:i};
    var k = ter[q.c + ',' + q.r];
    cost += (k && TD_MAP_TER[k]) ? TD_MAP_TER[k].cost : 1;
  }
  return {cost:cost, path:path, at:path.length};
}
window.tdMapMoveOf = tdMapMoveOf;
function tdMapStepShut(g, p, q, shut, wall){
  if(p.c === q.c && p.r === q.r) return false;
  var e = tdMapEdgeTo(g, p, q);
  if(e) return shut(e);
  if(g.sh === 'hex') return false;
  var a = {c:q.c, r:p.r}, b = {c:p.c, r:q.r};
  var viaA = shut(tdMapEdgeTo(g, p, a)) || shut(tdMapEdgeTo(g, a, q)) || wall(a.c, a.r);
  var viaB = shut(tdMapEdgeTo(g, p, b)) || shut(tdMapEdgeTo(g, b, q)) || wall(b.c, b.r);
  return viaA && viaB;
}

/* An area's squares. Its size n is counted as the Ruler counts, from the start's cell to the end's: a Circle's
   radius (round on squares, by the hex on hexes), a Cone's or a Line's length, a Square's side. A Cone is as wide at
   its end as it is long (Q13 A); a Cone and a Line start beside their first square. */
function tdMapCover(g, k, A, B){
  var A0 = tdGfCellAt(g, A.x, A.y), B0 = tdGfCellAt(g, B.x, B.y), n = tdGfSteps(g, A0, B0), out = [];
  var inG = function(c, r){ return c >= 0 && r >= 0 && c < g.c && r < g.r; };
  if(k === 'square'){
    var sc = (B0.c >= A0.c) ? 1 : -1, sr = (B0.r >= A0.r) ? 1 : -1;
    var side = Math.max(Math.abs(B0.c - A0.c), Math.abs(B0.r - A0.r)) + 1;
    for(var i = 0; i < side; i++) for(var j = 0; j < side; j++)
      if(inG(A0.c + sc * i, A0.r + sr * j)) out.push({c:A0.c + sc * i, r:A0.r + sr * j});
    return tdMapCov(out, side);
  }
  if(k === 'line') return tdMapCov(tdMapPath(g, A0, B0).slice(1).filter(function(p){ return inG(p.c, p.r); }), n);
  var ma = tdGfMid(g, A0.c, A0.r), pitch = (g.sh === 'hex') ? TD_GF_R3 : 1;
  var ux = B.x - ma.x, uy = B.y - ma.y, L = Math.sqrt(ux * ux + uy * uy) || 1;
  ux /= L; uy /= L;
  for(var c = A0.c - n - 1; c <= A0.c + n + 1; c++) for(var r = A0.r - n - 2; r <= A0.r + n + 2; r++){
    if(!inG(c, r)) continue;
    var p = {c:c, r:r}, st = tdGfSteps(g, A0, p);
    if(st > n) continue;
    var m = tdGfMid(g, c, r), vx = m.x - ma.x, vy = m.y - ma.y;
    if(k === 'circle'){
      if(g.sh === 'hex' || Math.sqrt(vx * vx + vy * vy) <= n + 0.5) out.push(p);
      continue;
    }
    if(!st) continue;
    var along = vx * ux + vy * uy, perp = Math.abs(vx * uy - vy * ux);
    if(along > 0.01 && perp <= along / 2 + 0.3 * pitch) out.push(p);
  }
  return tdMapCov(out, n);
}
function tdMapCov(cells, n){
  var set = {};
  cells.forEach(function(p){ set[p.c + ',' + p.r] = 1; });
  return {cells:cells, set:set, n:n};
}
function tdMapAreaCov(g, ar){
  var key = g.sh + g.c + 'x' + g.r + '|' + ar.k + '|' + ar.a.join(',') + '|' + ar.b.join(',');
  var hit = MAP.cov[ar.id];
  if(hit && hit.key === key) return hit.cov;
  if(++MAP.covN > 400){ MAP.cov = {}; MAP.covN = 0; }
  var cov = tdMapCover(g, ar.k, {x:ar.a[0], y:ar.a[1]}, {x:ar.b[0], y:ar.b[1]});
  MAP.cov[ar.id] = {key:key, cov:cov};
  return cov;
}
function tdMapRectCells(a, b){
  var o = {};
  for(var c = Math.min(a.c, b.c); c <= Math.max(a.c, b.c); c++)
    for(var r = Math.min(a.r, b.r); r <= Math.max(a.r, b.r); r++) o[c + ',' + r] = 1;
  return o;
}
function tdMapR2(v){ return Math.round(Math.max(-2, Math.min(2 * TG_GRID_MOST + 2, v)) * 100) / 100; }
function tdMapInk(cs, s){
  return tdGfCss(cs, '--seat-' + tdRbSeat(s)) || tdGfCss(cs, '--go') || 'gold';
}
function tdMapSideName(s){
  if(s === TD.side) return 'yours';
  return (((typeof tblSeatName === 'function') && tblSeatName(s)) || 'Somebody') + "'s";
}

/* ── Drawing ─────────────────────────────────────────────────────────────── */
/* Q, like P, turns grid units into the canvas's own: the base canvas draws through the zoom (tdGfDraw), the
   overlay at it (tdGfDrawOver). */
function tdMapCellSub(x, g, p, Q){
  if(g.sh !== 'hex'){
    var a = Q(p.c, p.r), b = Q(p.c + 1, p.r + 1);
    x.rect(a.x, a.y, b.x - a.x, b.y - a.y);
    return;
  }
  var m = tdGfMid(g, p.c, p.r);
  for(var k = 0; k < 6; k++){
    var q = Q(m.x + Math.cos(k * Math.PI / 3), m.y + Math.sin(k * Math.PI / 3));
    if(k) x.lineTo(q.x, q.y); else x.moveTo(q.x, q.y);
  }
  x.closePath();
}
/* One path for the lot, filled once, so cells side by side show no seam. */
function tdMapRunPath(x, g, run, Q){
  if(run[1] >= g.r || run[0] >= g.c) return;
  var n = Math.min(run[0] + run[2], g.c) - run[0];
  if(g.sh !== 'hex'){
    var a = Q(run[0], run[1]), b = Q(run[0] + n, run[1] + 1);
    x.rect(a.x, a.y, b.x - a.x, b.y - a.y);
    return;
  }
  for(var i = 0; i < n; i++) tdMapCellSub(x, g, {c:run[0] + i, r:run[1]}, Q);
}
function tdMapHatch(x, bx, dir, gap){
  x.beginPath();
  for(var i = -bx.h; i <= bx.w; i += gap){
    if(dir > 0){ x.moveTo(bx.x + i, bx.y); x.lineTo(bx.x + i + bx.h, bx.y + bx.h); }
    else { x.moveTo(bx.x + i, bx.y + bx.h); x.lineTo(bx.x + i + bx.h, bx.y); }
  }
  x.stroke();
}
function tdMapQ(bx){ return function(ux, uy){ return {x:bx.x + ux * bx.s, y:bx.y + uy * bx.s}; }; }
/* Difficult Terrain and Climbing are hatched as well as tinted, so they read on any picture. */
function tdMapDrawUnder(x, g, bx, f, cs, from){
  var runs = tdMapList(from || tdGfOwner(), 'gter');
  if(!runs.length) return;
  var Q = tdMapQ(bx), by = {1:[], 2:[], 3:[], 4:[]}, alpha = {1:0.32, 2:0.55, 3:0.42, 4:0.92};
  runs.forEach(function(run){ if(by[run[3]]) by[run[3]].push(run); });
  [1, 2, 3, 4].forEach(function(k){
    if(!by[k].length) return;
    var ink = tdGfCss(cs, TD_MAP_TER[k].ink) || 'grey';
    x.save();
    x.beginPath();
    by[k].forEach(function(run){ tdMapRunPath(x, g, run, Q); });
    x.fillStyle = ink;
    x.globalAlpha = alpha[k];
    x.fill();
    if(k === 1 || k === 3){
      x.clip();
      x.globalAlpha = (k === 1) ? 0.8 : 0.6;
      x.strokeStyle = ink;
      x.lineWidth = Math.max(1 / f.z, 0.05 * bx.s);
      tdMapHatch(x, bx, k === 1 ? 1 : -1, 0.3 * bx.s);
    }
    x.restore();
  });
}
window.tdMapDrawUnder = tdMapDrawUnder;
/* The walls and doors over the grid lines, then the fog over everything on the map: solid to the players, dimmed to
   the DM. Cards and tokens lie above the canvas, so a player's own always show (Q17 A). */
function tdMapDrawAbove(x, g, bx, f, cs, from){
  var o = from || tdGfOwner(), Q = tdMapQ(bx), ed = tdMapList(o, 'gedge');
  if(ed.length){
    var walls = [], doors = [];
    ed.forEach(function(e4){ if(tdMapEdgeShown(g, e4)) (e4[3] === 1 ? walls : doors).push(e4); });
    var seg = function(e4){ var p = tdMapEdgePts(g, e4); return [Q(p[0].x, p[0].y), Q(p[1].x, p[1].y)]; };
    var w = Math.max(2.5 / f.z, 0.15 * bx.s), rim = 1.5 / f.z;
    var ink = {wall:tdGfCss(cs, '--gf-wall') || 'black', rim:tdGfCss(cs, '--gf-wall-rim') || 'white',
               door:tdGfCss(cs, '--gf-door') || 'brown'};
    x.save();
    x.lineCap = 'round';
    if(walls.length){
      x.beginPath();
      walls.forEach(function(e4){ var s = seg(e4); x.moveTo(s[0].x, s[0].y); x.lineTo(s[1].x, s[1].y); });
      x.strokeStyle = ink.rim; x.lineWidth = w + 2 * rim; x.stroke();
      x.strokeStyle = ink.wall; x.lineWidth = w; x.stroke();
    }
    doors.forEach(function(e4){ tdMapDoorDraw(x, seg(e4), e4[3] === 3, w, rim, ink); });
    x.restore();
  }
  var fog = tdMapList(o, 'gfog');
  if(fog.length){
    x.save();
    x.beginPath();
    fog.forEach(function(run){ tdMapRunPath(x, g, run, Q); });
    x.fillStyle = tdGfCss(cs, '--gf-fog') || 'black';
    x.globalAlpha = (from || tdGfIsDm()) ? 0.62 : 1;
    x.fill();
    x.restore();
  }
}
window.tdMapDrawAbove = tdMapDrawAbove;
/* A door is its frame's two ends of wall and the door between: shut, a bar across; open, the leaf swung back. */
function tdMapDoorDraw(x, s, open, w, rim, ink){
  var a = s[0], b = s[1], dx = b.x - a.x, dy = b.y - a.y;
  var at = function(t){ return {x:a.x + dx * t, y:a.y + dy * t}; };
  var two = function(width, colour){ x.lineWidth = width; x.strokeStyle = colour; x.stroke(); };
  x.beginPath();
  [[0, 0.12], [0.88, 1]].forEach(function(p){ var q0 = at(p[0]), q1 = at(p[1]); x.moveTo(q0.x, q0.y); x.lineTo(q1.x, q1.y); });
  two(w + 2 * rim, ink.rim); two(w, ink.wall);
  var h0 = at(0.12), h1 = at(0.88);
  x.beginPath();
  if(!open){
    x.moveTo(h0.x, h0.y); x.lineTo(h1.x, h1.y);
    x.lineCap = 'butt';
    two(w * 1.15 + 2 * rim, ink.rim); two(w * 1.15, ink.door);
    x.lineCap = 'round';
    return;
  }
  var L = Math.sqrt(dx * dx + dy * dy) * 0.76, ang = Math.atan2(dy, dx) - Math.PI * 0.42;
  x.moveTo(h0.x, h0.y); x.lineTo(h0.x + Math.cos(ang) * L, h0.y + Math.sin(ang) * L);
  two(w * 0.6 + 2 * rim, ink.rim); two(w * 0.6, ink.door);
}
/* Everybody's areas and lines, then your own drag under way, over the cards and the tokens. */
function tdMapDrawOver(x, g, bx, P, W, H, cs, view){
  var o = tdGfOwner();
  tdMapList(o, 'gareas').forEach(function(ar){
    tdMapAreaDraw(x, g, P, tdMapAreaCov(g, ar), tdMapInk(cs, ar.s), !!ar.perm,
                  ar.k === 'square' ? null : tdGfCellAt(g, ar.a[0], ar.a[1]));
  });
  tdMapList(o, 'glines').forEach(function(l){ tdMapLineDraw(x, P, l.p, tdMapInk(cs, l.s)); });
  var d = MAP.drag;
  if(!d || tdGfLiveView(d.view) !== view) return;
  var mine = tdMapInk(cs, TD.side);
  if(d.kind === 'draw'){ tdMapLineDraw(x, P, d.pts, mine); return; }
  if(d.kind === 'area'){
    if(!d.moved) return;
    var cov = tdMapCover(g, d.k, d.a, d.b);
    tdMapAreaDraw(x, g, P, cov, mine, MAP.perm, d.k === 'square' ? null : tdGfCellAt(g, d.a.x, d.a.y));
    var unit = (g.sh === 'hex') ? ' hex' : ' sq';
    tdMapLabel(x, cs, W, H, P(d.b.x, d.b.y), d.k === 'square' ? cov.n + ' × ' + cov.n + unit
      : cov.n + unit + ' · ' + (cov.n * TD_GF_FT) + ' ft', mine);
    return;
  }
  tdMapStrokeDraw(x, g, P, d, cs);
}
window.tdMapDrawOver = tdMapDrawOver;
function tdMapAreaDraw(x, g, P, cov, ink, perm, origin){
  if(!cov.cells.length) return;
  x.save();
  x.fillStyle = ink; x.strokeStyle = ink;
  x.globalAlpha = 0.26;
  x.beginPath();
  cov.cells.forEach(function(p){ tdMapCellSub(x, g, p, P); });
  x.fill();
  /* the edge of the squares covered, dashed until it is Permanent */
  x.globalAlpha = 0.95;
  x.lineWidth = 2;
  if(!perm) x.setLineDash([6, 4]);
  x.beginPath();
  cov.cells.forEach(function(p){
    tdMapNbrs(g, p.c, p.r).forEach(function(nb){
      if(cov.set[nb.c + ',' + nb.r]) return;
      var q = tdMapEdgePts(g, nb.e), a = P(q[0].x, q[0].y), b = P(q[1].x, q[1].y);
      x.moveTo(a.x, a.y); x.lineTo(b.x, b.y);
    });
  });
  x.stroke();
  x.setLineDash([]);
  if(origin){
    var m = tdGfMid(g, origin.c, origin.r), c = P(m.x, m.y);
    x.beginPath(); x.arc(c.x, c.y, 4, 0, Math.PI * 2); x.fill();
  }
  x.restore();
}
function tdMapLineDraw(x, P, pts, ink){
  if(!pts || pts.length < 2) return;
  x.save();
  x.lineJoin = 'round'; x.lineCap = 'round';
  x.beginPath();
  pts.forEach(function(p, i){ var q = P(p[0], p[1]); if(i) x.lineTo(q.x, q.y); else x.moveTo(q.x, q.y); });
  x.globalAlpha = 0.4; x.strokeStyle = 'black'; x.lineWidth = 5; x.stroke();
  x.globalAlpha = 1; x.strokeStyle = ink; x.lineWidth = 3; x.stroke();
  x.restore();
}
function tdMapStrokeDraw(x, g, P, d, cs){
  var br = TD_MAP_BRUSHES[d.brush] || {};
  x.save();
  if(d.kind === 'paint' && br.v != null){
    x.strokeStyle = tdGfCss(cs, br.v === 0 ? '--gf-blocked' : (br.v === 2 ? '--gf-door' : '--gf-wall-rim')) || 'white';
    x.lineWidth = 5; x.lineCap = 'round'; x.globalAlpha = 0.9;
    if(br.v === 0) x.setLineDash([5, 4]);
    x.beginPath();
    Object.keys(d.edges).forEach(function(k){
      var p = tdMapEdgePts(g, d.edges[k]), a = P(p[0].x, p[0].y), b = P(p[1].x, p[1].y);
      x.moveTo(a.x, a.y); x.lineTo(b.x, b.y);
    });
    x.stroke();
    x.restore();
    return;
  }
  var cells = (d.rect && d.rect.b) ? tdMapRectCells(d.rect.a, d.rect.b) : d.cells;
  if(d.kind === 'fog'){
    x.fillStyle = tdGfCss(cs, d.on ? '--gf-fog' : '--go') || 'black';
    x.globalAlpha = d.on ? 0.55 : 0.3;
  } else {
    x.fillStyle = tdGfCss(cs, br.k ? TD_MAP_TER[br.k].ink : '--gf-blocked') || 'grey';
    x.globalAlpha = 0.5;
  }
  x.beginPath();
  Object.keys(cells).forEach(function(k){ var p = k.split(','); tdMapCellSub(x, g, {c:+p[0], r:+p[1]}, P); });
  x.fill();
  x.restore();
}
function tdMapLabel(x, cs, W, H, at, words, ink){
  x.save();
  x.font = '600 13px Cinzel, serif';
  var bw = x.measureText(words).width + 16, bh = 22;
  var lx = Math.max(2, Math.min(W - bw - 2, at.x + 12)), ly = Math.max(2, Math.min(H - bh - 2, at.y - bh - 10));
  x.fillStyle = tdGfCss(cs, '--ink-dark') || 'black';
  x.globalAlpha = 0.88;
  tdGfRound(x, lx, ly, bw, bh, 7); x.fill();
  x.globalAlpha = 1;
  x.lineWidth = 1.5; x.strokeStyle = ink;
  tdGfRound(x, lx, ly, bw, bh, 7); x.stroke();
  x.fillStyle = tdGfCss(cs, '--white') || 'white';
  x.textAlign = 'left'; x.textBaseline = 'middle';
  x.fillText(words, lx + 8, ly + bh / 2 + 1);
  x.restore();
}
/* Rings going out from the spot in the pinger's colour, for TD_MAP_PING_MS. */
function tdMapDrawPings(x, g, bx, P, cs){
  var now = Date.now();
  MAP.pings = MAP.pings.filter(function(p){ return now - p.at < TD_MAP_PING_MS; });
  if(!MAP.pings.length) return;
  MAP.pings.forEach(function(p){
    var c = P(p.x, p.y), age = now - p.at, ink = tdMapInk(cs, p.s);
    x.save();
    x.strokeStyle = ink; x.fillStyle = ink; x.lineWidth = 3;
    for(var k = 0; k < 3; k++){
      var t = (age - k * 220) / (TD_MAP_PING_MS - 440);
      if(t < 0 || t > 1) continue;
      x.globalAlpha = 1 - t;
      x.beginPath(); x.arc(c.x, c.y, 5 + t * 34, 0, Math.PI * 2); x.stroke();
    }
    x.globalAlpha = Math.max(0, 1 - age / TD_MAP_PING_MS);
    x.beginPath(); x.arc(c.x, c.y, 4.5, 0, Math.PI * 2); x.fill();
    x.restore();
  });
  if(!MAP.raf) MAP.raf = requestAnimationFrame(function(){ MAP.raf = 0; tdGfOverSoon(); });
}
window.tdMapDrawPings = tdMapDrawPings;

/* ── The bar ─────────────────────────────────────────────────────────────── */
/* Each dropdown is two buttons: the tool picked, which turns it on and off, and the list (Q25 A puts Permanent at
   the list's foot). */
function tdMapToolOn(){ return !!(MAP.paint || MAP.fog); }
window.tdMapToolOn = tdMapToolOn;
function tdMapSplitHTML(gf, label, on, title, list){
  return "<span class='td-gseg td-gsplit' role='group' aria-label='" + e(title) + "'>"
    + "<button type='button' class='td-gb' data-gf='" + gf + "' aria-pressed='" + (on ? 'true' : 'false') + "'"
    + " title='" + e(title) + "'>" + label + "</button>"
    + "<button type='button' class='td-gb td-gdrop' data-gf='" + gf + "m' aria-haspopup='menu'"
    + " title='" + e(list) + "' aria-label='" + e(list) + "'>&#9662;</button></span>";
}
function tdMapBrushInk(id){
  var b = TD_MAP_BRUSHES[id] || {};
  if(b.k) return 'var(' + TD_MAP_TER[b.k].ink + ')';
  if(b.v === 1) return 'var(--gf-wall)';
  if(b.v === 2) return 'var(--gf-door)';
  return 'var(--gf-fill)';
}
function tdMapBrushChip(css, line){
  return "<span class='td-gchip" + (line ? ' td-gchip-ln' : '') + "' aria-hidden='true' style='--gc:" + css + "'></span>";
}
function tdMapDmBarHTML(){
  var br = TD_MAP_BRUSHES[MAP.brush] || TD_MAP_BRUSHES.dt;
  return tdMapSplitHTML('paint', tdMapBrushChip(tdMapBrushInk(MAP.brush), br.v != null) + e(br.bar || br.n),
                        MAP.paint, 'Paint', 'Brushes')
    + tdMapSplitHTML('fog', tdMapBrushChip('var(--gf-fog)', false) + (MAP.fm === 'uncover' ? 'Uncover Fog' : 'Cover Fog'),
                     MAP.fog, 'Fog', 'Fog');
}
window.tdMapDmBarHTML = tdMapDmBarHTML;
function tdMapRulerBarHTML(){
  return tdMapSplitHTML('rul', e(TD_MAP_TOOLS[MAP.rt] || 'Ruler'), !!GF.ruler, 'Measure and mark', 'Tools');
}
window.tdMapRulerBarHTML = tdMapRulerBarHTML;
function tdMapBar(gf, x, y){
  switch(gf){
    case 'rul':    tdMapUse(GF.ruler ? '' : 'rul'); return;
    case 'rulm':   tdMapRulerMenu(x, y); return;
    case 'paint':  tdMapUse(MAP.paint ? '' : 'paint'); return;
    case 'paintm': tdMapPaintMenu(x, y); return;
    case 'fog':    tdMapUse(MAP.fog ? '' : 'fog'); return;
    case 'fogm':   tdMapFogMenu(x, y); return;
    case 'notes':  if(typeof tdNotesToggle === 'function') tdNotesToggle(); return;
  }
}
window.tdMapBar = tdMapBar;
/* One tool at a time across the three dropdowns and the picture's lining up; '' puts them all down. */
function tdMapUse(w){
  MAP.drag = null;
  if((w === 'paint' || w === 'fog') && !tdGfIsDm()) w = '';
  GF.ruler = (w === 'rul');
  MAP.paint = (w === 'paint');
  MAP.fog = (w === 'fog');
  if(w){ GF.adj = false; GF.live = null; GF.adjDrag = null; }
  if(!GF.ruler && GF.rul) tdGfRulEnd();
  tdRender();
}
window.tdMapUse = tdMapUse;
function tdMapPaintMenu(x, y){
  if(!tdGfIsDm()) return;
  var row = function(id){
    var b = TD_MAP_BRUSHES[id];
    return {label:b.n, on:MAP.brush === id, chip:tdMapBrushInk(id), chipLine:b.v != null,
            act:function(){ tdCloseMenu(); MAP.brush = id; tdMapUse('paint'); }};
  };
  tdCloseMenu();
  tdShowMenu('Paint', [{head:'Squares'}].concat(TD_MAP_SQ_BRUSHES.map(row), [{head:'Lines'}],
                                                 TD_MAP_LN_BRUSHES.map(row)), '', x, y);
}
/* A spectator measures for themself alone: Ruler and Movement. */
function tdMapRulerMenu(x, y){
  var full = !!TD.board && !TD.watching, o = tdGfOwner(), dm = tdGfIsDm();
  var rows = (full ? TD_MAP_TOOL_ORDER : ['rul', 'mv']).map(function(id){
    return {label:TD_MAP_TOOLS[id], on:MAP.rt === id, act:function(){ tdCloseMenu(); MAP.rt = id; tdMapUse('rul'); }};
  });
  if(full && o){
    var all = tdMapList(o, 'glines'), mine = all.filter(function(l){ return l.s === TD.side; });
    if(mine.length || (dm && all.length)) rows.push({sep:true});
    if(mine.length) rows.push({label:'Erase my lines', act:function(){
      tdCloseMenu();
      tdMapErase('gline', mine.map(function(l){ return l.id; }));
    }});
    if(dm && all.length) rows.push({label:'Clear all lines', act:function(){
      tdCloseMenu();
      if(!window.confirm('Clear every line on this map, everybody\'s?')) return;
      tdDo({t:'glinedel', all:true});
      tdGfOverSoon();
    }});
    rows.push({sep:true});
    rows.push({label:'Permanent', on:!!MAP.perm, box:true, act:function(){ tdCloseMenu(); MAP.perm = !MAP.perm; }});
  }
  tdCloseMenu();
  tdShowMenu('Ruler', rows, '', x, y);
}
function tdMapFogMenu(x, y){
  if(!tdGfIsDm()) return;
  tdCloseMenu();
  tdShowMenu('Fog', [
    {label:'Cover', on:MAP.fm !== 'uncover', act:function(){ tdCloseMenu(); MAP.fm = 'cover'; tdMapUse('fog'); }},
    {label:'Uncover', on:MAP.fm === 'uncover', act:function(){ tdCloseMenu(); MAP.fm = 'uncover'; tdMapUse('fog'); }},
    {sep:true},
    {label:'Cover all', act:function(){ tdCloseMenu(); tdMapFogAll(true); }},
    {label:'Uncover all', act:function(){ tdCloseMenu(); tdMapFogAll(false); }}], '', x, y);
}
function tdMapFogAll(on){
  var o = tdGfOwner();
  if(!tdGfIsDm() || !o) return;
  var g = tdGfGrid(), n = 0;
  tdMapEach(tdMapList(o, 'gfog'), function(c, r){ if(c < g.c && r < g.r) n++; });
  if(on ? n >= g.c * g.r : !tdMapList(o, 'gfog').length) return;
  tdDo({t:'gfog', on:on, all:true});
  tdGfApplySoon();
}

/* ── The pointer ─────────────────────────────────────────────────────────── */
/* Heard before the board's own press (tdGfDown); true when a tool took it. */
function tdMapDown(ev, view){
  if(!GF.ruler && !MAP.paint && !MAP.fog) return false;
  var u = tdGfUnitAt(view, ev.clientX, ev.clientY);
  if(!u) return false;
  if(MAP.paint || MAP.fog){
    if(!tdGfIsDm()){ MAP.paint = MAP.fog = false; return false; }
    tdGfTake(ev);
    MAP.drag = {kind:MAP.paint ? 'paint' : 'fog', view:view, brush:MAP.brush, on:MAP.fm !== 'uncover',
                cells:{}, edges:{}, last:null, x:ev.clientX, y:ev.clientY, moved:false,
                rect:(MAP.fog && ev.shiftKey) ? {a:tdGfCellAt(u.g, u.ux, u.uy), b:null} : null};
    tdMapStroke(MAP.drag, u);
    tdGfOverSoon();
    return true;
  }
  var rt = MAP.rt;
  tdGfTake(ev);
  if(rt === 'rul' || rt === 'mv'){ tdGfRulStart(ev, view, rt === 'mv'); return true; }
  if(!TD.board || TD.watching) return true;
  if(rt === 'ping'){ tdMapPing(u.ux, u.uy); return true; }
  if(rt === 'draw'){
    MAP.drag = {kind:'draw', view:view, pts:[[u.ux, u.uy]], x:ev.clientX, y:ev.clientY, moved:false};
    return true;
  }
  var a0 = tdGfCellAt(u.g, u.ux, u.uy), m = tdGfMid(u.g, a0.c, a0.r);
  MAP.drag = {kind:'area', k:rt, view:view, a:{x:m.x, y:m.y}, b:{x:u.ux, y:u.uy}, x:ev.clientX, y:ev.clientY,
              moved:false};
  return true;
}
window.tdMapDown = tdMapDown;
function tdMapMove(ev){
  var d = MAP.drag;
  d.view = tdGfLiveView(d.view);
  var u = d.view ? tdGfUnitAt(d.view, ev.clientX, ev.clientY) : null;
  if(!u) return;
  if(!d.moved && Math.abs(ev.clientX - d.x) + Math.abs(ev.clientY - d.y) >= 4) d.moved = true;
  if(d.kind === 'paint' || d.kind === 'fog') tdMapStroke(d, u);
  else if(d.kind === 'area') d.b = {x:u.ux, y:u.uy};
  else if(d.kind === 'draw'){
    /* Shift held: straight from where it started (Q14 A) */
    if(ev.shiftKey) d.pts = [d.pts[0], [u.ux, u.uy]];
    else {
      var l = d.pts[d.pts.length - 1];
      if(Math.abs(u.ux - l[0]) + Math.abs(u.uy - l[1]) >= 0.08) d.pts.push([u.ux, u.uy]);
      if(d.pts.length > 1500) d.pts = tdMapSimplify(d.pts, 0.03);
    }
  }
  tdGfOverSoon();
}
window.tdMapMove = tdMapMove;
function tdMapUp(ev, cancel){
  var d = MAP.drag;
  MAP.drag = null;
  if(!cancel && d){
    if(d.kind === 'paint') tdMapPaintDone(d);
    else if(d.kind === 'fog') tdMapFogDone(d);
    else if(d.kind === 'draw') tdMapLineDone(d);
    else if(d.kind === 'area') tdMapAreaDone(d);
  }
  tdGfApplySoon();
}
window.tdMapUp = tdMapUp;
/* Every point along the way, a little apart, so a quick drag leaves no gaps. */
function tdMapStroke(d, u){
  var g = u.g, to = {x:u.ux, y:u.uy}, from = d.last || to;
  d.last = to;
  if(d.rect){ d.rect.b = tdGfCellAt(g, u.ux, u.uy); return; }
  var line = (d.kind === 'paint') && TD_MAP_BRUSHES[d.brush].v != null, first = (from === to);
  var len = Math.sqrt((to.x - from.x) * (to.x - from.x) + (to.y - from.y) * (to.y - from.y));
  var n = Math.max(1, Math.ceil(len / 0.12));
  for(var i = (first ? n : 1); i <= n; i++){
    var px = from.x + (to.x - from.x) * i / n, py = from.y + (to.y - from.y) * i / n;
    if(line){
      var e = tdMapEdgeAt(g, px, py, first ? 0.35 : 0.3, !first);
      if(e) d.edges[tdMapEdgeKey(e)] = e;
    } else {
      var c = tdMapCellIn(g, px, py);
      if(c) d.cells[c.c + ',' + c.r] = 1;
    }
  }
}
/* Let go, a stroke is one action, of the squares or lines it changes, so one Undo takes it back. */
function tdMapPaintDone(d){
  var o = tdGfOwner(), br = TD_MAP_BRUSHES[d.brush];
  if(!tdGfIsDm() || !o || !br) return;
  if(br.v != null){
    var ed = tdMapEdges(o), list = [];
    Object.keys(d.edges).forEach(function(k){
      var was = ed[k] || 0;
      if(br.v === 0 ? was : (br.v === 1 ? was !== 1 : (was !== 2 && was !== 3))) list.push(d.edges[k].slice(0, 3));
    });
    if(list.length) tdDo({t:'gedge', v:br.v, edges:list.slice(0, 5000)});
    return;
  }
  var ter = tdMapCells(tdMapList(o, 'gter')), cells = {};
  Object.keys(d.cells).forEach(function(k){ if((ter[k] || 0) !== br.k) cells[k] = 1; });
  var runs = tdMapRuns(cells, false);
  if(runs.length) tdDo({t:'gpaint', k:br.k, cells:runs});
}
function tdMapFogDone(d){
  var o = tdGfOwner();
  if(!tdGfIsDm() || !o) return;
  var fog = tdMapCells(tdMapList(o, 'gfog')), src = (d.rect && d.rect.b) ? tdMapRectCells(d.rect.a, d.rect.b) : d.cells;
  var cells = {};
  Object.keys(src).forEach(function(k){ if(!!fog[k] !== d.on) cells[k] = 1; });
  var runs = tdMapRuns(cells, false);
  if(runs.length) tdDo({t:'gfog', on:d.on, cells:runs});
}
function tdMapSimplify(pts, eps){
  if(pts.length < 3) return pts.slice();
  var keep = [], stack = [[0, pts.length - 1]];
  keep[0] = keep[pts.length - 1] = true;
  while(stack.length){
    var s = stack.pop(), a = {x:pts[s[0]][0], y:pts[s[0]][1]}, b = {x:pts[s[1]][0], y:pts[s[1]][1]}, best = -1, bd = eps;
    for(var i = s[0] + 1; i < s[1]; i++){
      var h = tdMapSegHit(pts[i][0], pts[i][1], a, b).d;
      if(h > bd){ bd = h; best = i; }
    }
    if(best > 0){ keep[best] = true; stack.push([s[0], best], [best, s[1]]); }
  }
  return pts.filter(function(p, i){ return keep[i]; });
}
function tdMapLineDone(d){
  if(!d.moved || d.pts.length < 2) return;
  var eps = 0.03, pts = tdMapSimplify(d.pts, eps);
  while(pts.length > TG_LINE_PTS){ eps *= 1.6; pts = tdMapSimplify(d.pts, eps); }
  var len = 0;
  for(var i = 1; i < pts.length; i++) len += Math.abs(pts[i][0] - pts[i - 1][0]) + Math.abs(pts[i][1] - pts[i - 1][1]);
  if(len < 0.15) return;
  var line = {id:tdUid('tk'), s:TD.side, p:pts.map(function(p){ return [tdMapR2(p[0]), tdMapR2(p[1])]; })};
  if(MAP.perm) line.perm = true;
  if(tdMapList(tdGfOwner(), 'glines').length >= TG_LINES_MOST){
    if(typeof toast === 'function') toast('This map holds no more lines');
    return;
  }
  if(tdMapMark({t:'gline', line:line}, {op:'gline', line:line})) MAP.mine[line.id] = ++MAP.n;
}
function tdMapAreaDone(d){
  if(!d.moved) return;
  var g = tdGfGrid(), A0 = tdGfCellAt(g, d.a.x, d.a.y), B0 = tdGfCellAt(g, d.b.x, d.b.y);
  if(A0.c === B0.c && A0.r === B0.r) return;
  var ar = {id:tdUid('tk'), s:TD.side, k:d.k, a:[tdMapR2(d.a.x), tdMapR2(d.a.y)], b:[tdMapR2(d.b.x), tdMapR2(d.b.y)]};
  if(MAP.perm) ar.perm = true;
  if(tdMapList(tdGfOwner(), 'gareas').length >= TG_AREAS_MOST){
    if(typeof toast === 'function') toast('This map holds no more areas');
    return;
  }
  if(tdMapMark({t:'garea', area:ar}, {op:'garea', area:ar})) MAP.mine[ar.id] = ++MAP.n;
}
/* The DM's own app makes a line or an area; anybody else's asks it and draws it now, as a token's move is asked. */
function tdMapMark(a, req){
  var o = tdGfOwner();
  if(!o || !TD.board || TD.watching) return false;
  if(o === TD.board){ tdDo(a); tdGfOverSoon(); return true; }
  if(!tdRbAsk(tdGfSeatOf(o), req)) return false;
  tdApplyTo(o, a);
  tdGfOverSoon();
  return true;
}
function tdMapErase(kind, ids){
  if(!ids || !ids.length) return false;
  var t = (kind === 'garea') ? 'gareadel' : 'glinedel';
  return tdMapMark({t:t, ids:ids}, {op:t, ids:ids});
}
window.tdMapErase = tdMapErase;
/* What the DM's app does for the others: a line or an area as their own, by their own id, and any taken off. */
function tdMapReq(m, by){
  var o = TD.board;
  if(!o || !tdGfIsDm()) return false;
  switch(m.op){
    case 'gline': case 'garea':
      var f = (m.op === 'gline') ? 'glines' : 'gareas', x = (m.op === 'gline') ? m.line : m.area;
      if(!x || tdUidSide(x.id) !== by) return false;
      if(tdMapList(o, f).some(function(y){ return y.id === x.id; })) return false;
      x.s = by;
      return !!tdDo(m.op === 'gline' ? {t:'gline', line:x} : {t:'garea', area:x});
    case 'glinedel': case 'gareadel':
      var have = {};
      tdMapList(o, m.op === 'glinedel' ? 'glines' : 'gareas').forEach(function(y){ have[y.id] = 1; });
      var ids = (m.ids || []).filter(function(i){ return have[i]; });
      return ids.length ? !!tdDo({t:m.op, ids:ids}) : false;
  }
  return false;
}
window.tdMapReq = tdMapReq;

/* ── Pings ───────────────────────────────────────────────────────────────── */
function tdMapPing(ux, uy){
  var now = Date.now();
  if(now - MAP.pingAt < 200) return;
  MAP.pingAt = now;
  MAP.pings.push({x:ux, y:uy, s:TD.side, at:now});
  if(MAP.pings.length > 40) MAP.pings.shift();
  if(tdGfTable() && typeof tblOn === 'function' && tblOn() && !TBL.watch && typeof tblSend === 'function')
    tblSend({t:'mping', x:tdMapR2(ux), y:tdMapR2(uy)});
  tdGfOverSoon();
}
window.tdMapPing = tdMapPing;
function tdMapPingFrom(msg, fromId){
  var side = (typeof tblSideOf === 'function') ? tblSideOf(fromId) : '';
  if(!side || typeof msg.x !== 'number' || typeof msg.y !== 'number') return;
  MAP.pings.push({x:msg.x, y:msg.y, s:side, at:Date.now()});
  if(MAP.pings.length > 40) MAP.pings.shift();
  tdGfOverSoon();
}
window.tdMapPingFrom = tdMapPingFrom;
/* A double-click on an empty spot pings, whatever tool is picked; with Ping picked the clicks have pinged already. */
function tdMapDblClick(ev){
  if(GF.ruler && MAP.rt === 'ping') return;
  var view = tdGfViewOf(ev.target);
  if(!view || !TD.board || TD.watching) return;
  if(ev.target.closest('.td-card, .td-group, .td-token, .td-gtok, button, a, input, select, textarea, label, .td-resolve, .td-zacts')) return;
  var u = tdGfUnitAt(view, ev.clientX, ev.clientY);
  if(u) tdMapPing(u.ux, u.uy);
}
window.tdMapDblClick = tdMapDblClick;

/* ── Esc and the right-click menu ────────────────────────────────────────── */
/* Your most recent line or area that is not Permanent (Q12, Q24 A), by the number in its id. */
function tdMapLast(){
  var o = tdGfOwner();
  if(!o || !TD.board || TD.watching) return null;
  var best = null;
  [['garea', tdMapList(o, 'gareas')], ['gline', tdMapList(o, 'glines')]].forEach(function(p){
    p[1].forEach(function(x){
      var n = MAP.mine[x.id];
      if(!n || x.perm || x.s !== TD.side) return;
      if(!best || n > best.n) best = {kind:p[0], id:x.id, n:n};
    });
  });
  return best;
}
/* After a drag let go of: your last mark, then Paint or Fog; never while a menu, a window or a field has the key. */
function tdMapEsc(ev){
  if(MAP.drag){ MAP.drag = null; tdGfApplySoon(); return true; }
  var t = ev.target;
  if(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)) return false;
  if(document.querySelector('#tdMenu, #tdSearchOv, #tdCrystal')) return false;
  if(typeof _modalStack !== 'undefined' && _modalStack.length) return false;
  if((typeof _tdTokConnectFrom !== 'undefined' && _tdTokConnectFrom) || (typeof _tdConnectFrom !== 'undefined' && _tdConnectFrom)) return false;
  var view = document.querySelector('#tdBoard .td-gview');
  if(!view || view.offsetParent === null) return false;
  var last = tdMapLast();
  if(last){ tdMapErase(last.kind, [last.id]); return true; }
  if(MAP.paint || MAP.fog){ tdMapUse(''); return true; }
  return false;
}
window.tdMapEsc = tdMapEsc;
function tdMapLineAt(o, u){
  var tol = 7 / (u.bx.s * ((GF.view.z > 1.0001) ? GF.view.z : 1));
  var ls = tdMapList(o, 'glines');
  for(var i = ls.length - 1; i >= 0; i--){
    var p = ls[i].p;
    for(var j = 1; j < p.length; j++)
      if(tdMapSegHit(u.ux, u.uy, {x:p[j - 1][0], y:p[j - 1][1]}, {x:p[j][0], y:p[j][1]}).d <= tol) return ls[i];
  }
  return null;
}
function tdMapAreaAt(o, u){
  var c = tdMapCellIn(u.g, u.ux, u.uy), as = tdMapList(o, 'gareas');
  if(!c) return null;
  for(var i = as.length - 1; i >= 0; i--) if(tdMapAreaCov(u.g, as[i]).set[c.c + ',' + c.r]) return as[i];
  return null;
}
/* Off a card and a token: the door under the pointer for the DM (Q9 B), and for anybody the line and the area
   there, Permanent or not. */
function tdMapMenu(ev){
  var view = tdGfViewOf(ev.target);
  if(!view || !TD.board || TD.watching) return false;
  if(ev.target.closest('.td-card, .td-group, .td-token, .td-gtok, button, a, input, select, textarea, label, .td-zacts')) return false;
  var u = tdGfUnitAt(view, ev.clientX, ev.clientY), o = tdGfOwner();
  if(!u || !o) return false;
  var rows = [];
  if(tdGfIsDm()){
    var e = tdMapEdgeAt(u.g, u.ux, u.uy, 0.3, false), v = e ? tdMapEdges(o)[tdMapEdgeKey(e)] : 0;
    if(v === 2 || v === 3) rows.push({label:(v === 2) ? 'Open door' : 'Close door', act:function(){
      tdCloseMenu();
      tdDo({t:'gdoor', c:e[0], r:e[1], d:e[2], open:v === 2});
      tdGfApplySoon();
    }});
  }
  var ln = tdMapLineAt(o, u);
  if(ln) rows.push({label:'Erase line', hint:tdMapSideName(ln.s), act:function(){ tdCloseMenu(); tdMapErase('gline', [ln.id]); }});
  var ar = tdMapAreaAt(o, u);
  if(ar) rows.push({label:'Delete ' + TD_MAP_TOOLS[ar.k] + ' area', hint:tdMapSideName(ar.s), act:function(){
    tdCloseMenu();
    tdMapErase('garea', [ar.id]);
  }});
  if(!rows.length) return false;
  ev.preventDefault();
  tdCloseMenu();
  tdShowMenu('The map', rows, '', ev.clientX, ev.clientY);
  return true;
}
window.tdMapMenu = tdMapMenu;

/* ── A saved map's small picture (the maps list, tdMapsMenuPart) ─────────── */
/* Drawn from the saved map in the DM's own colours: its picture, painting, walls and doors, fog, and where its cards
   and tokens are. A picture not read from this browser yet is drawn once it has been. */
var TD_MAP_THUMB = {imgs:{}, asked:{}, w:72, h:48};
function tdMapThumbsDraw(host){
  var box = host || document;
  if(!box.querySelectorAll) return;
  var maps = (typeof tdMapsLoad === 'function') ? tdMapsLoad() : [], by = Object.create(null);
  maps.forEach(function(m){ by[m.name.toLowerCase()] = m; });
  box.querySelectorAll('canvas[data-mapthumb]').forEach(function(can){
    var m = by[String(can.getAttribute('data-mapthumb') || '').toLowerCase()];
    if(m) tdMapThumb(can, m);
  });
}
window.tdMapThumbsDraw = tdMapThumbsDraw;
function tdMapThumbPic(id){
  if(GF.imgs[id]) return GF.imgs[id];
  if(TD_MAP_THUMB.imgs[id]) return TD_MAP_THUMB.imgs[id];
  if(TD_MAP_THUMB.asked[id] || typeof tdGfPicGet !== 'function') return null;
  TD_MAP_THUMB.asked[id] = 1;
  tdGfPicGet(id).then(function(data){
    if(!data) return;
    var img = new Image();
    img.onload = function(){
      var ks = Object.keys(TD_MAP_THUMB.imgs);
      if(ks.length >= 12) delete TD_MAP_THUMB.imgs[ks[0]];
      TD_MAP_THUMB.imgs[id] = img;
      var d = document.getElementById('tdMoreDrop');
      if(d && !d.hidden) tdMapThumbsDraw(d);
    };
    img.src = data;
  }, function(){});
  return null;
}
function tdMapThumb(can, m){
  var dpr = Math.max(1, Math.min(3, window.devicePixelRatio || 1));
  var W = TD_MAP_THUMB.w, H = TD_MAP_THUMB.h;
  if(can.width !== Math.round(W * dpr)){ can.width = Math.round(W * dpr); can.height = Math.round(H * dpr); }
  var x = can.getContext && can.getContext('2d');
  if(!x) return;
  var g = tdGfClean(m.grid), bx = tdGfBox(g, W, H), cs = getComputedStyle(can), f = {z:1, tx:0, ty:0};
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  x.clearRect(0, 0, W, H);
  x.save();
  x.beginPath(); x.rect(bx.x, bx.y, bx.w, bx.h); x.clip();
  x.fillStyle = cs.borderTopColor;
  x.fillRect(bx.x, bx.y, bx.w, bx.h);
  var p = g.pic, img = p ? tdMapThumbPic(p.id) : null;
  if(img) x.drawImage(img, bx.x + p.x * bx.w, bx.y + p.y * bx.h, p.w * bx.w, p.h * bx.h);
  tdMapDrawUnder(x, g, bx, f, cs, m);
  if(g.ln !== false){
    x.globalAlpha = 0.45;
    x.strokeStyle = cs.color;
    x.lineWidth = 0.5;
    tdGfLines(x, g, bx, f, W, H);
    x.globalAlpha = 1;
  }
  /* the cards where the Field shows them: a percent of its fixed shape (RB_FIELD_ASPECT), the grid fitted inside */
  var C = tdRbCardPct(), fb = tdGfBox(g, RB_FIELD_ASPECT, 1);
  var cw = (C.w / 100) * RB_FIELD_ASPECT / fb.s, ch = (C.h / 100) / fb.s;
  (m.cards || []).forEach(function(c){
    if(c.on != null) return;
    var ux = ((c.x / 100) * RB_FIELD_ASPECT - fb.x) / fb.s, uy = ((c.y / 100) - fb.y) / fb.s;
    x.fillStyle = tdGfCss(cs, '--go') || '#d4af37';
    x.globalAlpha = c.down ? 0.5 : 0.9;
    x.fillRect(bx.x + ux * bx.s, bx.y + uy * bx.s, cw * bx.s, ch * bx.s);
  });
  x.globalAlpha = 1;
  tdMapDrawAbove(x, g, bx, f, cs, m);
  (m.gtoks || []).forEach(function(t){
    var md = tdGfMid(g, t.c, t.r);
    x.beginPath();
    x.arc(bx.x + md.x * bx.s, bx.y + md.y * bx.s, Math.max(1.5, 0.4 * bx.s), 0, Math.PI * 2);
    x.fillStyle = tdGfHex(t.col, TD.side);
    x.fill();
  });
  x.restore();
}

/* ── What the fog keeps from the players ─────────────────────────────────── */
/* The DM's app alone decides, at a table: what it holds back is never sent, in an action or in a state (tblOnAction,
   tblRedactedState). FOG.sent is what the players were last sent as hidden, so a change to it goes as the whole half. */
var FOG = {sent:''};
function tdFogOn(){
  return tdGfTable() && tdGfIsDm() && typeof tblOn === 'function' && tblOn();
}
/* A Field card is under the fog when its middle is; what is attached under it and its counters go with it. A token is when it is
   hidden, or when every square it covers is. The Field keeps one shape at a table (RB_FIELD_ASPECT), so its percent
   reads the same on every screen. */
function tdFogHidden(b){
  var g = tdGfClean(b.grid), fog = tdMapCells(tdMapList(b, 'gfog')), any = tdMapList(b, 'gfog').length > 0;
  var out = {cards:{}, toks:{}, ctrs:{}, fog:fog, g:g, any:any};
  tdGfToks(b).forEach(function(t){
    if(t.hid || (any && tdFogCoversTok(g, fog, t))) out.toks[t.uid] = 1;
  });
  if(any && b.zones && b.zones.field && typeof tdRbLayout === 'function'){
    var field = b.zones.field, C = tdRbCardPct(), at = tdRbLayout(tdRbFieldBoards(), null).at;
    var bx = tdGfBox(g, RB_FIELD_ASPECT, 1);
    field.forEach(function(it){
      var p = tdIsRoot(it) ? at[it.uid] : null;
      if(!p) return;
      var ux = (((p.x + C.w / 2) / 100) * RB_FIELD_ASPECT - bx.x) / bx.s, uy = (((p.y + C.h / 2) / 100) - bx.y) / bx.s;
      var c = tdMapCellIn(g, ux, uy);
      if(!c || !fog[c.c + ',' + c.r]) return;
      out.cards[it.uid] = 1;
      tdDescendants(field, it.uid).forEach(function(k){ out.cards[k.uid] = 1; });
    });
    (b.tokens || []).forEach(function(t){ if(t.on && out.cards[t.on]) out.ctrs[t.uid] = 1; });
  }
  return out;
}
function tdFogCoversTok(g, fog, t){
  var k = tdGfKeepOn(g, t, t.c, t.r), sp = tdGfSpan(g, t);
  for(var c = k.c; c < k.c + sp.w; c++) for(var r = k.r; r < k.r + sp.h; r++) if(!fog[c + ',' + r]) return false;
  return true;
}
function tdFogSig(h){
  return [h.cards, h.toks, h.ctrs].map(function(o){ return Object.keys(o).sort().join(','); }).join('|');
}
/* tblOnAction's question: '' to send the action, 'drop' to keep it back, 'state' to send the whole half instead. */
function tdFogFilter(a){
  if(!tdFogOn() || !a) return '';
  var h = tdFogHidden(TD.board);
  if(tdFogSig(h) !== FOG.sent) return 'state';
  if(a.t === 'gfog') return 'state';
  if(a.t === 'gpaint' || a.t === 'gedge' || a.t === 'gdoor') return (h.any && tdFogTouches(a, h)) ? 'state' : '';
  if(a.uid && (h.cards[a.uid] || h.toks[a.uid] || h.ctrs[a.uid])) return 'drop';
  if(a.on && h.cards[a.on]) return 'drop';
  return '';
}
window.tdFogFilter = tdFogFilter;
function tdFogTouches(a, h){
  var hit = false;
  if(a.t === 'gpaint') tdMapEach(a.cells, function(c, r){ if(h.fog[c + ',' + r]) hit = true; });
  else if(a.t === 'gedge') (a.edges || []).forEach(function(e){ if(tdFogEdgeHid(h.g, h.fog, e)) hit = true; });
  else hit = tdFogEdgeHid(h.g, h.fog, [a.c, a.r, a.d]);
  return hit;
}
/* A wall or a door is hidden when the fog is on both its sides (or on its one side on the grid). */
function tdFogEdgeHid(g, fog, e){
  var on = function(c, r){ return c >= 0 && r >= 0 && c < g.c && r < g.r; };
  var n = tdMapNbrs(g, e[0], e[1])[g.sh === 'hex' ? e[2] : (e[2] ? 2 : 0)];
  var a = !on(e[0], e[1]) || !!fog[e[0] + ',' + e[1]], b = !n || !on(n.c, n.r) || !!fog[n.c + ',' + n.r];
  return a && b;
}
/* The state as the players get it: no card, counter, token, paint, wall or door of the DM's under the fog, and no
   hidden token. */
function tdFogRedact(d){
  if(!d || !tdFogOn()){ FOG.sent = ''; return; }
  var h = tdFogHidden(TD.board);
  FOG.sent = tdFogSig(h);
  if(d.zones && Array.isArray(d.zones.field)) d.zones.field = d.zones.field.filter(function(o){ return !h.cards[o.uid]; });
  if(Array.isArray(d.tokens)) d.tokens = d.tokens.filter(function(t){ return !(t.on && h.cards[t.on]); });
  if(Array.isArray(d.gtoks)){
    d.gtoks = d.gtoks.filter(function(t){ return !h.toks[t.uid]; });
    if(!d.gtoks.length) delete d.gtoks;
  }
  if(!h.any) return;
  if(Array.isArray(d.gter)){
    var cells = tdMapCells(d.gter);
    Object.keys(h.fog).forEach(function(k){ delete cells[k]; });
    var runs = tdMapRuns(cells, true);
    if(runs.length) d.gter = runs; else delete d.gter;
  }
  if(Array.isArray(d.gedge)){
    d.gedge = d.gedge.filter(function(e){ return !tdFogEdgeHid(h.g, h.fog, e); });
    if(!d.gedge.length) delete d.gedge;
  }
}
window.tdFogRedact = tdFogRedact;
