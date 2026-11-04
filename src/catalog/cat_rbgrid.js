/* Whatever turns a screen point into a spot on the Field, or back, measures the pan; sizes inside the Field are measured unzoomed (HANDOFF §85.5). */
var TD_GF_NEW = {sh:'sq', c:24, r:16};
var TD_GF_TOK_MOST = 10;
var TD_GF_R3 = Math.sqrt(3);
var TD_GF_FT = 5;
/* Each name needs its --gi-<name> token in testdeck.css and its place in TG_GCOLS (cat_guard.js); '' is the seat's own colour. */
var TD_GF_COLS = ['gold', 'blue', 'green', 'pink', 'orange', 'violet',
                  'red', 'teal', 'white', 'silver', 'brown', 'lime'];
var TD_GF_LIGHT_INK = {brown:1};
var TD_GF_ICON_KEY = 'conjure_rb_icon';
/* Under Cloudflare's message size, as a Saga's pieces are (sagapart). */
var TD_GF_PART = 180000;
var GF = {view:{z:1, cx:0.5, cy:0.5}, vkey:'', imgs:{}, data:{}, parts:{}, asked:{}, missing:{},
          loading:{}, sent:{}, ruler:false, rul:null, adj:false, live:null, adjDrag:null,
          drag:null, pan:null, hov:null, hovKey:'', raf:0, rafO:0, unscaling:false, db:null, dbq:null,
          looked:{}, pick:null, px:0, py:0, rulT:0, rulX:0};

function tdGfOn(){ return !!REBIRTH; }
window.tdGfOn = tdGfOn;
function tdGfTable(){ return typeof tdRbOn === 'function' && tdRbOn(); }
/* At a table, null until the DM's board has arrived. */
function tdGfOwner(){
  if(tdGfTable()) return (typeof tdDmBoard === 'function') ? tdDmBoard() : null;
  return TD.board;
}
function tdGfIsDm(){
  return !!TD.board && !TD.watching && tdGfOwner() === TD.board;
}
window.tdGfIsDm = tdGfIsDm;
function tdGfClean(g){ return tgGrid(g) || {sh:TD_GF_NEW.sh, c:TD_GF_NEW.c, r:TD_GF_NEW.r}; }
function tdGfGrid(){
  var b = tdGfOwner();
  return tdGfClean(b && b.grid);
}
function tdGfMapKey(){
  var o = tdGfOwner();
  return String((o && o.map) || '').toLowerCase();
}
function tdGfSeatOf(b){
  return (typeof tdRbSideOf === 'function') ? tdRbSideOf(b) : 'a';
}
function tdGfBoards(){
  if(tdGfTable()) return tdRbFieldBoards();
  return TD.board ? [TD.board] : [];
}
function tdGfToks(b){ return (b && Array.isArray(b.gtoks)) ? b.gtoks : []; }
function tdGfTokIn(b, uid){
  var ts = tdGfToks(b);
  for(var i = 0; i < ts.length; i++) if(ts[i].uid === uid) return ts[i];
  return null;
}
/* A player's token shows only while the DM has up the map it is tagged with (`m`, lower case); the DM's own are always the map's (HANDOFF §85.4). */
function tdGfShows(b, t){
  if(!tdGfTable()) return true;
  var o = tdGfOwner();
  if(!o || b === o) return true;
  return (t.m || '') === tdGfMapKey();
}
function tdGfVisible(){
  var out = [];
  tdGfBoards().forEach(function(b){
    var seat = tdGfSeatOf(b);
    tdGfToks(b).forEach(function(t){ if(tdGfShows(b, t)) out.push({b:b, seat:seat, t:t}); });
  });
  return out;
}
function tdGfFind(uid){
  var bs = tdGfBoards();
  for(var i = 0; i < bs.length; i++){
    var t = tdGfTokIn(bs[i], uid);
    if(t) return {b:bs[i], seat:tdGfSeatOf(bs[i]), t:t};
  }
  return null;
}
function tdGfOwnerName(hit){
  if(hit.b === TD.board) return 'yours';
  var n = hit.b.name || ((typeof tblSeatName === 'function') ? tblSeatName(hit.seat) : '');
  return (n || 'Somebody') + "'s";
}

/* Grid units: a square is 1 by 1; a hex is flat-topped, 2 by √3, its columns 1.5 apart and every odd one half a hex lower (odd-q), as the cube arithmetic assumes. */
function tdGfUnits(g){
  return g.sh === 'hex' ? {w:1.5 * g.c + 0.5, h:TD_GF_R3 * (g.r + 0.5)} : {w:g.c, h:g.r};
}
function tdGfBox(g, W, H){
  var u = tdGfUnits(g);
  var s = Math.max(0.0001, Math.min(W / u.w, H / u.h));
  return {s:s, x:(W - u.w * s) / 2, y:(H - u.h * s) / 2, w:u.w * s, h:u.h * s, u:u};
}
function tdGfMid(g, c, r){
  if(g.sh === 'hex') return {x:1 + 1.5 * c, y:TD_GF_R3 * (r + 0.5 + ((c & 1) ? 0.5 : 0))};
  return {x:c + 0.5, y:r + 0.5};
}
function tdGfCellAt(g, ux, uy){
  var c, r;
  if(g.sh === 'hex'){
    /* to axial, rounded through cube co-ordinates, then back to columns */
    var x = ux - 1, y = uy - TD_GF_R3 / 2;
    var q = (2 / 3) * x, ra = (-1 / 3) * x + (TD_GF_R3 / 3) * y, s = -q - ra;
    var rq = Math.round(q), rr = Math.round(ra), rs = Math.round(s);
    var dq = Math.abs(rq - q), dr = Math.abs(rr - ra), ds = Math.abs(rs - s);
    if(dq > dr && dq > ds) rq = -rr - rs;
    else if(dr > ds) rr = -rq - rs;
    c = rq;
    r = rr + (rq - (rq & 1)) / 2;
  } else {
    c = Math.floor(ux); r = Math.floor(uy);
  }
  return {c:Math.max(0, Math.min(g.c - 1, c)), r:Math.max(0, Math.min(g.r - 1, r))};
}
/* A diagonal step on squares counts as one (HANDOFF §85.2). */
function tdGfSteps(g, a, b){
  if(g.sh === 'hex'){
    var cube = function(p){ var x = p.c, z = p.r - (p.c - (p.c & 1)) / 2; return {x:x, z:z, y:-x - z}; };
    var A = cube(a), B = cube(b);
    return (Math.abs(A.x - B.x) + Math.abs(A.y - B.y) + Math.abs(A.z - B.z)) / 2;
  }
  return Math.max(Math.abs(a.c - b.c), Math.abs(a.r - b.r));
}
/* On hexes a turn is in the drawing alone (by sixths): the token still covers its own columns and rows. */
function tdGfSpan(g, t){
  var w = t.w || 1, h = t.h || 1;
  return (g.sh === 'sq' && ((t.rot || 0) & 1)) ? {w:h, h:w} : {w:w, h:h};
}
/* A token's own c and r can lie past the edge of a map made smaller since: read where it lies through this. */
function tdGfKeepOn(g, t, c, r){
  var sp = tdGfSpan(g, t);
  return {c:Math.max(0, Math.min(Math.max(0, g.c - sp.w), c)),
          r:Math.max(0, Math.min(Math.max(0, g.r - sp.h), r))};
}
window.tdGfCellAt = tdGfCellAt;
window.tdGfSteps = tdGfSteps;
window.tdGfMid = tdGfMid;
window.tdGfBox = tdGfBox;

/* Each change is an action on its owner's board; a new action or field needs its TG_ACTS entry (cat_guard.js), or the table drops it. */
TD_ACT.grid = function(b, a){
  var g = tgGrid(a.g);
  if(g) b.grid = g; else delete b.grid;
};
TD_ACT.gpers = function(b, a){
  if(a.on) b.gpers = true; else delete b.gpers;
};
/* Its id is minted by the side that put it down and travels with it, as a card's does. */
TD_ACT.gtok = function(b, a){
  var t = tgGTok(a.tok);
  if(!t) return;
  b.gtoks = tdGfToks(b).filter(function(x){ return x.uid !== t.uid; });
  b.gtoks.push(t);
};
TD_ACT.gmove = function(b, a){
  var t = tdGfTokIn(b, a.uid);
  if(!t) return;
  t.c = tgIntOr(a.c, 0, 99, t.c);
  t.r = tgIntOr(a.r, 0, 99, t.r);
};
TD_ACT.gset = function(b, a){
  var t = tdGfTokIn(b, a.uid);
  if(!t) return;
  if(a.lab != null){ var l = tgLab(a.lab); if(l) t.lab = l; }
  if(a.w != null || a.h != null){
    var w = tgIntOr(a.w, 1, TD_GF_TOK_MOST, t.w || 1), h = tgIntOr(a.h, 1, TD_GF_TOK_MOST, t.h || 1);
    if(w > 1) t.w = w; else delete t.w;
    if(h > 1) t.h = h; else delete t.h;
  }
  if(a.rot != null){ var r = tgIntOr(a.rot, 0, 5, 0); if(r) t.rot = r; else delete t.rot; }
  if(a.col != null){ var c = tgGCol(a.col); if(c) t.col = c; else delete t.col; }
  if(a.c != null) t.c = tgIntOr(a.c, 0, 99, t.c);
  if(a.r != null) t.r = tgIntOr(a.r, 0, 99, t.r);
};
TD_ACT.gdel = function(b, a){
  var gone = {};
  if(a.uid) gone[a.uid] = 1;
  (Array.isArray(a.uids) ? a.uids : []).forEach(function(u){ gone[u] = 1; });
  var left = tdGfToks(b).filter(function(t){ return !gone[t.uid]; });
  if(left.length) b.gtoks = left; else delete b.gtoks;
};
var TD_GF_TAGS = 50;
function tdGfTagList(b){ return (b && Array.isArray(b.gtl)) ? b.gtl : []; }
/* Never on a DM's board, whose own tokens are the map's; the DM's keeps its last TD_GF_TAGS, numbered, for a player who missed one (tdGfCatchUp). */
TD_ACT.gtag = function(b, a){
  var was = String(a.was || ''), now = String(a.now || ''), n = tgInt(a.n, 1, 1e15);
  if(typeof tdRbIsDm === 'function' && tdRbIsDm(b)){
    if(n && !tdGfTagList(b).some(function(g){ return g.n === n; })){
      var e = {n:n, was:was, now:now};
      if(a.gone) e.gone = true;
      b.gtl = tdGfTagList(b).concat([e]).slice(-TD_GF_TAGS);
    }
    return;
  }
  if(a.gone){
    var left = tdGfToks(b).filter(function(t){ return (t.m || '') !== was; });
    if(left.length) b.gtoks = left; else delete b.gtoks;
  } else tdGfToks(b).forEach(function(t){
    if((t.m || '') !== was) return;
    if(now) t.m = now; else delete t.m;
  });
  if(n && n > (b.gtseen || 0)) b.gtseen = n;
};
TD_ACT.label = function(b, a){
  var at = tdFindIn(b, a.uid);
  if(!at) return;
  var l = tgLab(a.lab);
  if(l) at.item.lab = l; else delete at.item.lab;
};
TD_ACT.gicon = function(b, a){
  var ic = tgIcon(a.icon);
  if(ic) b.icon = ic; else delete b.icon;
};

function tdGfActionWords(a, board, before, beforeName){
  switch(a.t){
    case 'grid':
      var g = tdGfClean(a.g), kind = (g.sh === 'hex') ? 'hexes' : 'squares';
      switch(a.say){
        case 'size':  return 'made the map ' + g.c + ' by ' + g.r + ' ' + kind;
        case 'shape': return 'made the map ' + kind;
        case 'lines': return (g.ln === false ? 'hid' : 'showed') + ' the grid lines';
        case 'pic':   return 'put a picture under the map';
        case 'nopic': return 'took the picture off the map';
      }
      return '';
    case 'gpers': return 'turned persistent tokens ' + (a.on ? 'on' : 'off');
    case 'gtok':  return 'put down the token ' + ((a.tok && tgLab(a.tok.lab)) || '');
    case 'gset':
      /* a "My token" following its owner's new icon says nothing of its own */
      if(a.col != null) return '';
      if(a.lab != null) return 'renamed a token ' + tgLab(a.lab);
      if(a.w != null) return 'made a token ' + (a.w || 1) + ' by ' + (a.h || 1);
      return '';
    case 'gdel':
      var n = Array.isArray(a.uids) ? a.uids.length : 0;
      return (n > 1 ? 'removed the ' + n + ' tokens ' : 'removed the token ') + tgLab(a.lab || '');
    case 'label':
      var nm = beforeName || tdCardWords(a.uid, board);
      return a.lab ? 'labelled ' + nm + ' ' + tgLab(a.lab) : 'took the label off ' + nm;
  }
  /* gmove, gtag and gicon are not news */
  return '';
}
window.tdGfActionWords = tdGfActionWords;

/* Written the way tgBoard (cat_guard.js) reads them back, so a board from this app passes the check unchanged. */
function tdGfPack(b, out){
  if(!b) return;
  var g = b.grid ? tgGrid(b.grid) : null;
  if(g) out.grid = g;
  if(b.gpers) out.gpers = true;
  if(b.gn) out.gn = b.gn;
  var ts = tdGfToks(b).map(function(t){ return tgGTok(t); }).filter(Boolean);
  if(ts.length) out.gtoks = ts;
  var ic = b.icon ? tgIcon(b.icon) : null;
  if(ic) out.icon = ic;
  var gl = tdGfTagList(b);
  if(gl.length) out.gtl = gl.slice(-TD_GF_TAGS);
  if(typeof b.gtseen === 'number') out.gtseen = b.gtseen;
}
window.tdGfPack = tdGfPack;
function tdGfUnpack(data, board){
  if(!data || !board) return;
  var g = tgGrid(data.grid);
  if(g) board.grid = g;
  if(data.gpers === true) board.gpers = true;
  var gn = tgInt(data.gn, 0, 1e9);
  if(gn) board.gn = gn;
  if(Array.isArray(data.gtoks)){
    var ts = data.gtoks.slice(0, 500).map(function(t){ return tgGTok(t); }).filter(Boolean);
    if(ts.length) board.gtoks = ts;
  }
  var ic = tgIcon(data.icon);
  if(ic) board.icon = ic;
  if(Array.isArray(data.gtl)){
    var gl = data.gtl.slice(-TD_GF_TAGS).map(tgGTag).filter(Boolean);
    if(gl.length) board.gtl = gl;
  }
  var gs = tgInt(data.gtseen, 0, 1e15);
  if(gs != null) board.gtseen = gs;
}
window.tdGfUnpack = tdGfUnpack;

/* The bar is a row of the section, not of the body, so nothing that measures the body measures the bar (HANDOFF §85.5). */
function tdGfBarHTML(){
  var g = tdGfGrid(), dm = tdGfIsDm(), own = !!TD.board && !TD.watching;
  var btn = function(gf, label, on, title){
    return "<button type='button' class='td-gb' data-gf='" + gf + "'"
      + (on == null ? '' : " aria-pressed='" + (on ? 'true' : 'false') + "'")
      + " title='" + e(title) + "'>" + label + "</button>";
  };
  var h = "<div class='td-gbar' role='toolbar' aria-label='The map'>";
  if(dm){
    h += "<span class='td-gseg' role='group' aria-label='Squares or hexes'>"
      + btn('sq', 'Squares', g.sh === 'sq', 'A grid of squares')
      + btn('hex', 'Hexes', g.sh === 'hex', 'A grid of flat-topped hexes') + "</span>"
      + btn('size', g.c + ' &times; ' + g.r, null, 'Columns and rows')
      + (GF.adj ? btn('pic', 'Moving the picture', true, 'Done moving the picture (Esc)')
                : btn('pic', 'Picture&hellip;', null, 'A picture under the map'))
      + btn('ln', 'Grid lines', g.ln !== false, 'Show or hide the grid lines');
    if(typeof tdMapsHere === 'function' && tdMapsHere())
      h += btn('pers', 'Persistent tokens', !!TD.board.gpers,
               'On: every token stays where it is when the map changes. Off: every token stays with the map it was on');
  }
  h += "<span class='td-gsp'></span>";
  if(own) h += tdGfIconBtnHTML()
    + btn('me', 'My token', null, 'Put your icon on the map as a token')
    + btn('tok', '+ Token', null, 'Put a token on the map, with a label of up to three characters');
  h += btn('rul', 'Ruler', !!GF.ruler, 'Measure: drag from one square to another (Esc stops)')
    + btn('fit', 'Fit', null, 'The whole map in view');
  return h + "</div>";
}
window.tdGfBarHTML = tdGfBarHTML;
function tdGfViewHTML(inner){
  return "<canvas class='td-gcan' aria-hidden='true'></canvas>"
    + "<div class='td-gpan'>" + (inner || '') + "<div class='td-gbox'>" + tdGfTokensHTML() + "</div></div>"
    + "<canvas class='td-gover' aria-hidden='true'></canvas>";
}
window.tdGfViewHTML = tdGfViewHTML;

/* In percent of the grid's box (.td-gbox), so the pan's zoom carries them. */
function tdGfTokensHTML(){
  var g = tdGfGrid(), u = tdGfUnits(g), dm = tdGfIsDm(), all = tdGfVisible(), cells = {};
  all.forEach(function(v){
    var k = tdGfKeepOn(g, v.t, v.t.c, v.t.r), sp = tdGfSpan(g, v.t);
    v.c = k.c; v.r = k.r;
    if(sp.w === 1 && sp.h === 1){ var key = v.c + ',' + v.r; (cells[key] = cells[key] || []).push(v); }
  });
  return all.map(function(v){
    var sp = tdGfSpan(g, v.t), q = 0, n = 1;
    if(sp.w === 1 && sp.h === 1){ var list = cells[v.c + ',' + v.r]; q = list.indexOf(v); n = list.length; }
    return tdGfTokHTML(g, u, v, tdGfTokRect(g, v, q, n), dm);
  }).join('');
}
function tdGfTokRect(g, v, q, n){
  var sp = tdGfSpan(g, v.t), big = sp.w > 1 || sp.h > 1;
  var k = q % 4, lay = Math.floor(q / 4) * 0.08;
  if(g.sh === 'sq'){
    if(big) return {x:v.c + 0.06, y:v.r + 0.06, w:sp.w - 0.12, h:sp.h - 0.12};
    if(n <= 1) return {x:v.c + 0.08, y:v.r + 0.08, w:0.84, h:0.84};
    return {x:v.c + 0.06 + (k & 1) * 0.46 + lay, y:v.r + 0.06 + (k >> 1) * 0.46 + lay, w:0.42, h:0.42};
  }
  var d = TD_GF_R3 * 0.86, m = tdGfMid(g, v.c, v.r);
  if(big){
    var pts = [tdGfMid(g, v.c, v.r), tdGfMid(g, v.c + sp.w - 1, v.r),
               tdGfMid(g, v.c, v.r + sp.h - 1), tdGfMid(g, v.c + sp.w - 1, v.r + sp.h - 1)];
    var xs = pts.map(function(p){ return p.x; }), ys = pts.map(function(p){ return p.y; });
    var x0 = Math.min.apply(null, xs) - d / 2, y0 = Math.min.apply(null, ys) - d / 2;
    return {x:x0, y:y0, w:Math.max.apply(null, xs) + d / 2 - x0, h:Math.max.apply(null, ys) + d / 2 - y0};
  }
  if(n <= 1) return {x:m.x - d / 2, y:m.y - d / 2, w:d, h:d};
  var s = d * 0.48;
  return {x:m.x - s - 0.02 + (k & 1) * (s + 0.04) + lay, y:m.y - s - 0.02 + (k >> 1) * (s + 0.04) + lay, w:s, h:s};
}
function tdGfColVar(col, seat){
  return col ? 'var(--gi-' + col + ')' : 'var(--seat-' + tdRbSeat(seat) + ', var(--go))';
}
function tdGfTokHTML(g, u, v, rc, dm){
  var t = v.t, pc = function(n){ return (n * 100).toFixed(4) + '%'; };
  var long = (t.w || 1) !== (t.h || 1);
  var rot = (g.sh === 'hex' && t.rot) ? t.rot * 60 : 0;
  var nch = tgChars(t.lab).length, fit = nch <= 1 ? 0.5 : (nch === 2 ? 0.42 : 0.34);
  return "<div class='td-gtok" + (long ? ' td-gtlong' : '') + "' data-gtok='" + e(t.uid) + "'"
    + " data-gseat='" + tdRbSeat(v.seat) + "' data-glab='" + e(t.lab) + "'"
    + (TD_GF_LIGHT_INK[t.col] ? " data-ink='lt'" : '')
    + " title='" + e(t.lab + ' — ' + tdGfOwnerName(v)) + "'"
    + " style='left:" + pc(rc.x / u.w) + ";top:" + pc(rc.y / u.h)
    + ";width:" + pc(rc.w / u.w) + ";height:" + pc(rc.h / u.h)
    + ";--gt:" + tdGfColVar(t.col, v.seat) + ";--gts:" + (Math.min(rc.w, rc.h) * fit).toFixed(3)
    + (rot ? ';--gr:' + rot + 'deg' : '') + "'>"
    + "<span class='td-gtlab'>" + e(t.lab) + "</span>"
    + ((dm && long) ? "<button type='button' class='td-gtrot' data-gtrot='" + e(t.uid) + "'"
        + " title='Turn it' aria-label='" + e('Turn the token ' + t.lab) + "'>&#10227;</button>" : '')
    + "</div>";
}

/* After the cards and counters are laid out, which a fresh pan measures unzoomed, and before the effects, arrows and cursors, which measure the zoom too. */
function tdGfAfterRender(host){
  var vs = (host || document).querySelectorAll('.td-gview');
  for(var i = 0; i < vs.length; i++) tdGfFrame(vs[i]);
  if(vs.length) tdGfWinsOffBar();
}
window.tdGfAfterRender = tdGfAfterRender;
/* Unmoved, the Record Log and the DM Tools go under the bar, not over everybody's tools at its right-hand end (HANDOFF §85.5). */
function tdGfBarRect(){
  var bs = document.querySelectorAll('.td-gbar');
  for(var i = 0; i < bs.length; i++){ var r = bs[i].getBoundingClientRect(); if(r.height) return r; }
  return null;
}
function tdGfBarBottom(vh){
  var r = tdGfBarRect();
  if(!r || r.bottom < 0 || r.bottom + 8 > vh - 160) return 0;
  return r.bottom + 8;
}
window.tdGfBarBottom = tdGfBarBottom;
function tdGfWinsOffBar(){
  var b = tdGfBarRect();
  if(!b || typeof tdFloatWin !== 'function' || typeof tdWinSaved !== 'function') return;
  ['tdFeed', 'tdDmWin'].forEach(function(id){
    var w = document.getElementById(id);
    if(!w || w.hidden || !w._tdWin || tdWinSaved(w._tdWin)) return;
    var r = w.getBoundingClientRect();
    if(r.bottom > b.top && r.top < b.bottom && r.right > b.left && r.left < b.right) tdFloatWin(w, w._tdWin);
  });
}
function tdGfPanOf(view){ return view ? view.querySelector(':scope > .td-gpan') : null; }
function tdGfFrame(view){
  var pan = tdGfPanOf(view);
  if(!pan) return;
  var sec = view.closest('.td-zone'), bar = sec ? sec.querySelector(':scope > .td-gbar') : null;
  if(bar) sec.style.setProperty('--gf-bar-h', bar.offsetHeight + 'px');
  var W = pan.offsetWidth, H = pan.offsetHeight, gbox = pan.querySelector(':scope > .td-gbox');
  if(gbox && W && H){
    var bx = tdGfBox(tdGfGrid(), W, H), pc = function(n){ return (n * 100).toFixed(4) + '%'; };
    gbox.style.left = pc(bx.x / W); gbox.style.top = pc(bx.y / H);
    gbox.style.width = pc(bx.w / W); gbox.style.height = pc(bx.h / H);
    gbox.style.setProperty('--gf-cell', bx.s.toFixed(3) + 'px');
  }
  /* Only a map switched (`gn`, the owner's count) puts the view back to Fit; one renamed or resized keeps it. */
  var key = tdGfViewKey();
  if(key !== GF.vkey){ GF.vkey = key; GF.view = {z:1, cx:0.5, cy:0.5}; }
  tdGfClamp(view);
  view.classList.toggle('td-gruling', !!GF.ruler);
  view.classList.toggle('td-gadj', !!GF.adj && tdGfIsDm());
  tdGfPicNeed();
  tdGfApply(view);
  if(GF.hov) tdGfGlowApply();
}
function tdGfViewKey(){
  var o = tdGfOwner();
  return (tdGfTable() ? 't' : ((typeof tdIsEncounter === 'function' && tdIsEncounter()) ? 'e' : 's'))
    + ':' + ((o && o.gn) || 0);
}

/* GF.view (z, 1 the whole Field; cx, cy the spot in the middle, as fractions) is yours alone: never saved, never sent. */
function tdGfZMax(view){
  var pan = tdGfPanOf(view), W = pan ? pan.offsetWidth : 0, H = pan ? pan.offsetHeight : 0;
  if(!W || !H) return 4;
  var g = tdGfGrid(), bx = tdGfBox(g, W, H), cell = bx.s * (g.sh === 'hex' ? TD_GF_R3 : 1);
  return Math.max(4, Math.min(24, 48 / Math.max(0.5, cell)));
}
function tdGfClamp(view){
  var v = GF.view;
  if(view) v.z = Math.min(v.z, tdGfZMax(view));
  if(!(v.z > 1.0001)){ v.z = 1; v.cx = 0.5; v.cy = 0.5; return; }
  var m = 0.5 / v.z;
  v.cx = Math.max(m, Math.min(1 - m, v.cx));
  v.cy = Math.max(m, Math.min(1 - m, v.cy));
}
/* A spot (x, y) of the pan is at (tx + z·x, ty + z·y) in the body; the canvases draw through the same numbers. */
function tdGfXf(W, H){
  var v = GF.view, z = (v.z > 1.0001) ? v.z : 1;
  return {z:z, tx:(z > 1 ? W / 2 - z * v.cx * W : 0), ty:(z > 1 ? H / 2 - z * v.cy * H : 0)};
}
function tdGfApply(view){
  var pan = tdGfPanOf(view);
  if(!pan) return;
  var W = pan.offsetWidth, H = pan.offsetHeight, f = tdGfXf(W, H);
  if(!GF.unscaling) pan.style.transform = (f.z > 1)
    ? 'translate(' + f.tx.toFixed(2) + 'px,' + f.ty.toFixed(2) + 'px) scale(' + f.z.toFixed(5) + ')' : '';
  /* Clipped only while zoomed, so at Fit an Action's effects round a card near the edge still spill over it (HANDOFF §85.5). */
  view.classList.toggle('td-gzoom', f.z > 1);
  tdGfDraw(view, W, H, f);
  tdGfDrawOver(view, W, H, f);
}
/* Everything a pan or a zoom moves, in one frame: the map, and the cursors and arrows, drawn from where the cards are on the screen. */
function tdGfApplySoon(){
  if(GF.raf) return;
  GF.raf = requestAnimationFrame(function(){
    GF.raf = 0;
    var vs = document.querySelectorAll('#tdBoard .td-gview');
    /* No map, nothing drawn: the page with no deck keeps its board empty (checkfix_scope.js). */
    if(!vs.length) return;
    for(var i = 0; i < vs.length; i++) tdGfFrame(vs[i]);
    if(typeof tdRenderPointer === 'function') tdRenderPointer();
    if(typeof tdRenderArrows === 'function') tdRenderArrows();
  });
}
function tdGfOverSoon(){
  if(GF.rafO) return;
  GF.rafO = requestAnimationFrame(function(){
    GF.rafO = 0;
    var vs = document.querySelectorAll('#tdBoard .td-gview');
    for(var i = 0; i < vs.length; i++){
      var pan = tdGfPanOf(vs[i]);
      if(!pan) continue;
      var W = pan.offsetWidth, H = pan.offsetHeight;
      tdGfDrawOver(vs[i], W, H, tdGfXf(W, H));
    }
  });
}
window.tdGfOverSoon = tdGfOverSoon;
function tdGfFit(){
  GF.view = {z:1, cx:0.5, cy:0.5};
  tdGfApplySoon();
}
window.tdGfFit = tdGfFit;

/* tdReflowFree and tdPlaceCardTokens measure with getBoundingClientRect, which a zoom scales: outside a render they run in here, every pan unzoomed. */
function tdGfUnscaled(fn){
  if(GF.unscaling || !(GF.view.z > 1.0001)) return false;
  var pans = document.querySelectorAll('#tdBoard .td-gpan');
  if(!pans.length) return false;
  var was = [], i;
  GF.unscaling = true;
  for(i = 0; i < pans.length; i++){ was.push(pans[i].style.transform); pans[i].style.transform = ''; }
  try{ fn(); }
  finally {
    for(i = 0; i < pans.length; i++) pans[i].style.transform = was[i];
    GF.unscaling = false;
  }
  return true;
}
window.tdGfUnscaled = tdGfUnscaled;
/* Read from the card's middle, where its ghost (drawn at the zoom round it) is at any zoom; null for anything but the map's body. */
function tdGfPctIn(el, x, y, cardW, cardH){
  if(!el || !el.classList || !el.classList.contains('td-gview')) return null;
  var pan = tdGfPanOf(el);
  if(!pan) return null;
  var r = pan.getBoundingClientRect(), W = pan.offsetWidth, H = pan.offsetHeight;
  if(!r.width || !r.height || !W || !H) return {x:4, y:4};
  var mx = x + (cardW || 0) / 2, my = y + (cardH || 0) / 2;
  var px = (mx - r.left) / r.width * 100 - (cardW ? cardW / W * 50 : 0);
  var py = (my - r.top) / r.height * 100 - (cardH ? cardH / H * 50 : 0);
  var maxX = cardW ? Math.max(0, (1 - cardW / W) * 100) : 94;
  var maxY = cardH ? Math.max(0, (1 - cardH / H) * 100) : 88;
  return {x:Math.max(0, Math.min(maxX, px)), y:Math.max(0, Math.min(maxY, py))};
}
window.tdGfPctIn = tdGfPctIn;
function tdGfUnitAt(view, x, y){
  var pan = tdGfPanOf(view);
  if(!pan) return null;
  var r = pan.getBoundingClientRect(), W = pan.offsetWidth, H = pan.offsetHeight;
  if(!r.width || !r.height || !W || !H) return null;
  var g = tdGfGrid(), bx = tdGfBox(g, W, H);
  var px = (x - r.left) / r.width * W, py = (y - r.top) / r.height * H;
  return {ux:(px - bx.x) / bx.s, uy:(py - bx.y) / bx.s, fx:px / W, fy:py / H, g:g, bx:bx, W:W, H:H};
}

/* Drawn at the zoom, not scaled by it (tdGfXf); the line is the canvas's color and the fill its top border's, from testdeck.css (HANDOFF §85.5). */
function tdGfCanvas(can, W, H){
  var dpr = Math.min(2, window.devicePixelRatio || 1);
  var cw = Math.max(1, Math.round(W * dpr)), ch = Math.max(1, Math.round(H * dpr));
  if(can.width !== cw || can.height !== ch){ can.width = cw; can.height = ch; }
  var x = can.getContext('2d');
  if(!x) return null;
  x.setTransform(1, 0, 0, 1, 0, 0);
  x.clearRect(0, 0, cw, ch);
  x.setTransform(dpr, 0, 0, dpr, 0, 0);
  return x;
}
function tdGfCss(cs, name){
  var v = cs ? cs.getPropertyValue(name) : '';
  return v ? String(v).trim() : '';
}
function tdGfDraw(view, W, H, f){
  var can = view.querySelector(':scope > .td-gcan');
  if(!can || !W || !H) return;
  var x = tdGfCanvas(can, W, H);
  if(!x) return;
  var g = tdGfGrid(), bx = tdGfBox(g, W, H), cs = getComputedStyle(can);
  x.save();
  x.translate(f.tx, f.ty);
  x.scale(f.z, f.z);
  x.fillStyle = cs.borderTopColor;
  x.fillRect(bx.x, bx.y, bx.w, bx.h);
  var p = GF.live || g.pic;
  if(p){
    var img = GF.imgs[p.id];
    x.save();
    x.beginPath(); x.rect(bx.x, bx.y, bx.w, bx.h); x.clip();
    if(img) x.drawImage(img, bx.x + p.x * bx.w, bx.y + p.y * bx.h, p.w * bx.w, p.h * bx.h);
    else {
      x.fillStyle = cs.color;
      x.font = (13 / f.z) + 'px Cinzel, serif';
      x.textAlign = 'center'; x.textBaseline = 'middle';
      x.fillText(GF.missing[p.id] || 'The picture under this map is on its way', bx.x + bx.w / 2, bx.y + bx.h / 2);
    }
    x.restore();
  }
  if(g.ln !== false){
    x.strokeStyle = cs.color;
    x.lineWidth = 1 / f.z;
    tdGfLines(x, g, bx, f, W, H);
  }
  x.restore();
}
function tdGfLines(x, g, bx, f, W, H){
  var s = bx.s;
  var u0 = ((-f.tx / f.z) - bx.x) / s, u1 = (((W - f.tx) / f.z) - bx.x) / s;
  var v0 = ((-f.ty / f.z) - bx.y) / s, v1 = (((H - f.ty) / f.z) - bx.y) / s;
  x.beginPath();
  if(g.sh === 'sq'){
    var c0 = Math.max(0, Math.floor(u0)), c1 = Math.min(g.c, Math.ceil(u1));
    var r0 = Math.max(0, Math.floor(v0)), r1 = Math.min(g.r, Math.ceil(v1));
    var X0 = bx.x + c0 * s, X1 = bx.x + c1 * s, Y0 = bx.y + r0 * s, Y1 = bx.y + r1 * s;
    for(var c = c0; c <= c1; c++){ var X = bx.x + c * s; x.moveTo(X, Y0); x.lineTo(X, Y1); }
    for(var r = r0; r <= r1; r++){ var Y = bx.y + r * s; x.moveTo(X0, Y); x.lineTo(X1, Y); }
  } else {
    var hc0 = Math.max(0, Math.floor((u0 - 2) / 1.5)), hc1 = Math.min(g.c - 1, Math.ceil(u1 / 1.5));
    var hr0 = Math.max(0, Math.floor(v0 / TD_GF_R3) - 1), hr1 = Math.min(g.r - 1, Math.ceil(v1 / TD_GF_R3));
    var cs6 = [], sn6 = [], k;
    for(k = 0; k < 6; k++){ cs6.push(Math.cos(k * Math.PI / 3) * s); sn6.push(Math.sin(k * Math.PI / 3) * s); }
    for(var hc = hc0; hc <= hc1; hc++) for(var hr = hr0; hr <= hr1; hr++){
      var m = tdGfMid(g, hc, hr), mx = bx.x + m.x * s, my = bx.y + m.y * s;
      x.moveTo(mx + cs6[0], my + sn6[0]);
      for(k = 1; k < 6; k++) x.lineTo(mx + cs6[k], my + sn6[k]);
      x.closePath();
    }
  }
  x.stroke();
}
function tdGfCellsPath(x, g, t, at, P){
  var sp = tdGfSpan(g, t || {});
  x.beginPath();
  if(g.sh === 'sq'){
    var a = P(at.c, at.r), b = P(at.c + sp.w, at.r + sp.h);
    x.rect(a.x, a.y, b.x - a.x, b.y - a.y);
    return;
  }
  for(var c = at.c; c < at.c + sp.w; c++) for(var r = at.r; r < at.r + sp.h; r++){
    var m = tdGfMid(g, c, r);
    for(var k = 0; k < 6; k++){
      var q = P(m.x + Math.cos(k * Math.PI / 3), m.y + Math.sin(k * Math.PI / 3));
      if(k) x.lineTo(q.x, q.y); else x.moveTo(q.x, q.y);
    }
    x.closePath();
  }
}
function tdGfRound(x, l, t, w, h, r){
  x.beginPath();
  x.moveTo(l + r, t); x.lineTo(l + w - r, t); x.arcTo(l + w, t, l + w, t + r, r);
  x.lineTo(l + w, t + h - r); x.arcTo(l + w, t + h, l + w - r, t + h, r);
  x.lineTo(l + r, t + h); x.arcTo(l, t + h, l, t + h - r, r);
  x.lineTo(l, t + r); x.arcTo(l, t, l + r, t, r);
  x.closePath();
}
function tdGfDrawOver(view, W, H, f){
  var can = view.querySelector(':scope > .td-gover');
  if(!can || !W || !H) return;
  var x = tdGfCanvas(can, W, H);
  if(!x) return;
  var g = tdGfGrid(), bx = tdGfBox(g, W, H), cs = getComputedStyle(view);
  var P = function(ux, uy){ return {x:f.tx + (bx.x + ux * bx.s) * f.z, y:f.ty + (bx.y + uy * bx.s) * f.z}; };
  var d = GF.drag;
  if(d && d.moved && d.to && d.view === view){
    x.save();
    x.fillStyle = tdGfCss(cs, '--seat-' + tdRbSeat(d.hit.seat)) || tdGfCss(cs, '--go');
    x.globalAlpha = 0.3;
    tdGfCellsPath(x, g, d.hit.t, d.to, P);
    x.fill();
    x.restore();
  }
  var p = GF.live || g.pic;
  if(GF.adj && p && tdGfIsDm()){
    var a = P(p.x * bx.u.w, p.y * bx.u.h), b = P((p.x + p.w) * bx.u.w, (p.y + p.h) * bx.u.h);
    x.save();
    x.strokeStyle = tdGfCss(cs, '--go') || tdGfCss(cs, '--seat-a');
    x.lineWidth = 2;
    x.setLineDash([7, 5]);
    x.strokeRect(a.x, a.y, b.x - a.x, b.y - a.y);
    x.setLineDash([]);
    x.fillStyle = x.strokeStyle;
    [[a.x, a.y], [b.x, a.y], [a.x, b.y], [b.x, b.y]].forEach(function(c){ x.fillRect(c[0] - 6, c[1] - 6, 12, 12); });
    x.restore();
  }
  var rulers = [], next = 0;
  if(GF.rul && GF.rul.held && GF.rul.view === view) rulers.push({a:GF.rul.a, b:GF.rul.b, seat:tdRbSeat(TD.side)});
  if(tdGfTable() && typeof TBL !== 'undefined' && TBL.ptrs){
    var now = Date.now();
    Object.keys(TBL.ptrs).forEach(function(s){
      var q = TBL.ptrs[s];
      if(!q || q.off || q.rx == null || q.ry == null || q.zone !== 'field' || now - q.at > TD_PTR_MS) return;
      rulers.push({a:{fx:q.rx, fy:q.ry}, b:{fx:q.fx, fy:q.fy}, seat:tdRbSeat(s)});
      var left = TD_PTR_MS - (now - q.at);
      if(!next || left < next) next = left;
    });
  }
  /* Another player's ruler goes when their cursor runs out: one who closed the page mid-measure sends nothing more. */
  clearTimeout(GF.rulX);
  if(next) GF.rulX = setTimeout(tdGfOverSoon, next + 50);
  rulers.forEach(function(R){ tdGfRulerDraw(x, g, bx, P, W, H, R, cs); });
}
function tdGfRulerDraw(x, g, bx, P, W, H, R, cs){
  var cellOf = function(q){ return tdGfCellAt(g, ((+q.fx || 0) * W - bx.x) / bx.s, ((+q.fy || 0) * H - bx.y) / bx.s); };
  var A = cellOf(R.a), B = cellOf(R.b), n = tdGfSteps(g, A, B);
  var ink = tdGfCss(cs, '--seat-' + R.seat) || tdGfCss(cs, '--go') || 'gold';
  var ma = tdGfMid(g, A.c, A.r), mb = tdGfMid(g, B.c, B.r), pa = P(ma.x, ma.y), pb = P(mb.x, mb.y);
  x.save();
  x.fillStyle = ink; x.strokeStyle = ink;
  x.globalAlpha = 0.24;
  tdGfCellsPath(x, g, null, A, P); x.fill();
  tdGfCellsPath(x, g, null, B, P); x.fill();
  x.globalAlpha = 1;
  x.lineWidth = 3; x.lineCap = 'round';
  x.setLineDash([9, 6]);
  x.beginPath(); x.moveTo(pa.x, pa.y); x.lineTo(pb.x, pb.y); x.stroke();
  x.setLineDash([]);
  x.beginPath(); x.arc(pa.x, pa.y, 4.5, 0, Math.PI * 2); x.fill();
  var words = n + (g.sh === 'hex' ? ' hex' : ' sq') + ' · ' + (n * TD_GF_FT) + ' ft';
  x.font = '600 13px Cinzel, serif';
  var bw = x.measureText(words).width + 16, bh = 22;
  var lx = Math.max(2, Math.min(W - bw - 2, pb.x + 12)), ly = Math.max(2, Math.min(H - bh - 2, pb.y - bh - 10));
  x.fillStyle = tdGfCss(cs, '--ink-dark') || 'black';
  x.globalAlpha = 0.88;
  tdGfRound(x, lx, ly, bw, bh, 7); x.fill();
  x.globalAlpha = 1;
  x.lineWidth = 1.5;
  tdGfRound(x, lx, ly, bw, bh, 7); x.stroke();
  x.fillStyle = tdGfCss(cs, '--white') || 'white';
  x.textAlign = 'left'; x.textBaseline = 'middle';
  x.fillText(words, lx + 8, ly + bh / 2 + 1);
  x.restore();
}

function tdGfViewOf(el){
  var v = (el && el.closest) ? el.closest('.td-gview') : null;
  return (v && v.closest('#tdBoard')) ? v : null;
}
/* A redraw mid-gesture replaces the view: this is the one there now. */
function tdGfLiveView(v){
  return (v && v.isConnected) ? v : document.querySelector('#tdBoard .td-gview');
}
/* Neither the board's own press nor the menu's close-on-press hears it, so the menu is closed here. */
function tdGfTake(ev){
  ev.preventDefault();
  ev.stopPropagation();
  if(document.getElementById('tdMenu') && typeof tdCloseMenu === 'function') tdCloseMenu();
}

/* All the way out, a wheel turned towards you scrolls the page on, so the page can still be scrolled past a map. */
function tdGfWheel(ev){
  var view = tdGfViewOf(ev.target);
  if(!view || !tdGfPanOf(view)) return;
  var dy = ev.deltaY * (ev.deltaMode === 1 ? 16 : (ev.deltaMode === 2 ? 400 : 1));
  if(!dy) return;
  var v = GF.view, z0 = (v.z > 1.0001) ? v.z : 1;
  if(dy > 0 && z0 <= 1) return;
  ev.preventDefault();
  var z1 = Math.max(1, Math.min(tdGfZMax(view), z0 * Math.exp(-dy * 0.0015)));
  if(Math.abs(z1 - z0) < 1e-4) return;
  var r = view.getBoundingClientRect();
  if(!r.width || !r.height) return;
  /* the spot under the pointer stays under it */
  var vx = (ev.clientX - r.left) / r.width, vy = (ev.clientY - r.top) / r.height;
  var nz = (z1 > 1.0001) ? z1 : 1;
  v.cx += (vx - 0.5) * (1 / z0 - 1 / nz);
  v.cy += (vy - 0.5) * (1 / z0 - 1 / nz);
  v.z = nz;
  tdGfClamp(view);
  tdGfApplySoon();
}
function tdGfPanStart(ev, view){
  GF.pan = {view:view, x:ev.clientX, y:ev.clientY, cx:GF.view.cx, cy:GF.view.cy, moved:false};
}
function tdGfPanMove(ev){
  var p = GF.pan, v = GF.view;
  var dx = ev.clientX - p.x, dy = ev.clientY - p.y;
  p.view = tdGfLiveView(p.view);
  if(!p.view) return;
  if(!p.moved){
    if(Math.abs(dx) + Math.abs(dy) < 4) return;
    p.moved = true;
  }
  p.view.classList.add('td-gpanning');
  if(!(v.z > 1.0001)) return;
  var pan = tdGfPanOf(p.view), W = pan ? pan.offsetWidth : 0, H = pan ? pan.offsetHeight : 0;
  if(!W || !H) return;
  v.cx = p.cx - dx / (W * v.z);
  v.cy = p.cy - dy / (H * v.z);
  tdGfClamp(p.view);
  tdGfApplySoon();
}
function tdGfPanEnd(){
  var p = GF.pan;
  GF.pan = null;
  var view = p ? tdGfLiveView(p.view) : null;
  if(view) view.classList.remove('td-gpanning');
}
/* CSS scale, which leaves the drag's own left, top and lean alone; the drop is read from the ghost's middle (tdGfPctIn). */
function tdGfGhost(ev){
  var gs = document.querySelectorAll('body > .td-ghost');
  if(!gs.length) return;
  var z = 1;
  if(GF.view.z > 1.0001){
    var vs = document.querySelectorAll('#tdBoard .td-gview');
    for(var i = 0; i < vs.length; i++){
      var r = vs[i].getBoundingClientRect();
      if(ev.clientX >= r.left && ev.clientX <= r.right && ev.clientY >= r.top && ev.clientY <= r.bottom){
        z = GF.view.z;
        break;
      }
    }
  }
  for(var j = 0; j < gs.length; j++) gs[j].style.scale = (z > 1) ? z.toFixed(4) : '';
}

/* Held where it was picked up: a token two squares long picked up by its far end lands with that end where it is let go. */
function tdGfTokStart(ev, view, el){
  ev.preventDefault();
  if(!TD.board || TD.watching) return;
  var uid = el.getAttribute('data-gtok'), hit = tdGfFind(uid);
  var u = hit ? tdGfUnitAt(view, ev.clientX, ev.clientY) : null;
  if(!u) return;
  var k = tdGfKeepOn(u.g, hit.t, hit.t.c, hit.t.r), m = tdGfMid(u.g, k.c, k.r);
  GF.drag = {uid:uid, hit:hit, el:el, view:view, x:ev.clientX, y:ev.clientY,
             ox:u.ux - m.x, oy:u.uy - m.y, from:k, to:null, moved:false};
}
function tdGfTokMove(ev){
  var d = GF.drag;
  var dx = ev.clientX - d.x, dy = ev.clientY - d.y;
  if(!d.moved){
    if(Math.abs(dx) + Math.abs(dy) < 4) return;
    d.moved = true;
  }
  /* a redraw while it is held drew the token afresh: carry on with the new one */
  if(!d.el || !d.el.isConnected){
    d.view = tdGfLiveView(d.view);
    d.el = d.view ? d.view.querySelector('.td-gtok' + tdSel(d.uid, 'data-gtok')) : null;
  }
  if(!d.view) return;
  if(d.el){
    var z = (GF.view.z > 1.0001) ? GF.view.z : 1;
    d.el.classList.add('td-gdrag');
    d.el.style.translate = (dx / z).toFixed(2) + 'px ' + (dy / z).toFixed(2) + 'px';
  }
  var u = tdGfUnitAt(d.view, ev.clientX, ev.clientY);
  if(!u) return;
  var c = tdGfCellAt(u.g, u.ux - d.ox, u.uy - d.oy);
  d.to = tdGfKeepOn(u.g, d.hit.t, c.c, c.r);
  tdGfOverSoon();
}
function tdGfTokEnd(cancel){
  var d = GF.drag;
  GF.drag = null;
  if(d.el){ d.el.classList.remove('td-gdrag'); d.el.style.translate = ''; }
  tdGfOverSoon();
  if(cancel || !d.moved || !d.to || (d.to.c === d.from.c && d.to.r === d.from.r)) return;
  var hit = tdGfFind(d.uid);
  if(hit) tdGfMoveTok(hit, d.to.c, d.to.r);
}
/* Anybody else's is asked of its owner and drawn there now; their own move, when it comes, puts it in the same square. */
function tdGfMoveTok(hit, c, r){
  var a = {t:'gmove', uid:hit.t.uid, c:c, r:r};
  if(hit.b === TD.board) tdDo(a);
  else if(tdRbAsk(hit.seat, {op:'gmove', tok:hit.t.uid, c:c, r:r})) tdApplyTo(hit.b, a);
  tdRender();
}

/* Its start rides on your cursor (tdGfPtrExtra), sent again every second while held, so a ruler held still does not run out (TD_PTR_MS). */
function tdGfRulStart(ev, view){
  var u = tdGfUnitAt(view, ev.clientX, ev.clientY);
  if(!u) return;
  GF.rul = {view:view, a:{fx:u.fx, fy:u.fy}, b:{fx:u.fx, fy:u.fy}, held:true};
  tdGfRulSend();
  tdGfOverSoon();
}
function tdGfRulMove(ev){
  var R = GF.rul;
  R.view = tdGfLiveView(R.view);
  var u = R.view ? tdGfUnitAt(R.view, ev.clientX, ev.clientY) : null;
  if(!u) return;
  R.b = {fx:u.fx, fy:u.fy};
  tdGfOverSoon();
}
function tdGfRulEnd(){
  GF.rul = null;
  tdGfRulSend();
  tdGfOverSoon();
}
function tdGfRulSend(){
  clearTimeout(GF.rulT);
  if(!tdGfTable() || typeof tblOn !== 'function' || !tblOn() || TBL.watch) return;
  var at = (typeof tdPointerAt === 'function') ? tdPointerAt(GF.px, GF.py) : null;
  if(at){
    at.t = 'ptr';
    tdGfPtrExtra(at);
    tblSend(at);
  }
  if(GF.rul && GF.rul.held) GF.rulT = setTimeout(tdGfRulSend, 1000);
}
function tdGfPtrExtra(at){
  var R = GF.rul;
  if(!R || !R.held || !at || at.zone !== 'field' || at.seat) return;
  var r4 = function(n){ return Math.round(Math.max(0, Math.min(1, n)) * 1e4) / 1e4; };
  at.rx = r4(R.a.fx);
  at.ry = r4(R.a.fy);
}
window.tdGfPtrExtra = tdGfPtrExtra;

function tdGfDown(ev){
  if(GF.drag || GF.pan || GF.adjDrag || (GF.rul && GF.rul.held)) return;
  var view = tdGfViewOf(ev.target);
  if(!view) return;
  var mid = (ev.button === 1);
  if(ev.button !== 0 && !mid) return;
  if(!mid && GF.adj && tdGfIsDm() && tdGfAdjStart(ev, view)){ tdGfTake(ev); return; }
  if(!mid && GF.ruler){ tdGfTake(ev); tdGfRulStart(ev, view); return; }
  var t = ev.target;
  var tok = t.closest('.td-gtok');
  if(!mid && tok && !t.closest('.td-gtrot')){ tdGfTokStart(ev, view, tok); return; }
  if(mid || !t.closest('.td-card, .td-group, .td-token, .td-gtok, button, a, input, select, textarea, label, .td-resolve, .td-zacts')){
    if(mid) ev.preventDefault();
    tdGfPanStart(ev, view);
  }
}
function tdGfMove(ev){
  GF.px = ev.clientX; GF.py = ev.clientY;
  if(GF.drag) tdGfTokMove(ev);
  else if(GF.pan) tdGfPanMove(ev);
  else if(GF.rul && GF.rul.held) tdGfRulMove(ev);
  else if(GF.adjDrag) tdGfAdjMove(ev);
  tdGfGhost(ev);
}
function tdGfUp(ev, cancel){
  if(GF.drag) tdGfTokEnd(cancel);
  if(GF.pan) tdGfPanEnd();
  if(GF.rul && GF.rul.held) tdGfRulEnd();
  if(GF.adjDrag) tdGfAdjEnd(cancel);
}
/* Esc lets go of one thing at a time (HANDOFF §85.5). */
function tdGfKey(ev){
  if(ev.key !== 'Escape') return;
  /* and nothing else: in the waiting room the window under the picker would close on the same Escape (modalOpen) */
  if(document.getElementById('tdGfIconPick')){ ev.stopImmediatePropagation(); tdGfPickClose(); return; }
  if(GF.drag){ tdGfTokEnd(true); return; }
  if(GF.adjDrag){ tdGfAdjEnd(true); return; }
  if(GF.ruler){
    GF.ruler = false;
    if(GF.rul) tdGfRulEnd();
    tdRender();
    return;
  }
  if(GF.adj) tdGfAdjToggle();
}

function tdGfClick(ev){
  var t = (ev.target && ev.target.closest) ? ev.target : null;
  if(!t) return;
  var rot = t.closest('[data-gtrot]');
  if(rot && tdGfViewOf(rot)){ ev.stopPropagation(); tdGfTurn(rot.getAttribute('data-gtrot')); return; }
  var b = t.closest('#tdBoard .td-gbar [data-gf]');
  if(b){ tdGfBar(b.getAttribute('data-gf'), b); return; }
  var ic = t.closest('[data-gficon]');
  if(ic){ ev.preventDefault(); tdGfPickOpen(ic); }
}
function tdGfBar(gf, btn){
  var g = tdGfGrid(), r = btn.getBoundingClientRect(), x = r.left, y = r.bottom + 4;
  switch(gf){
    case 'sq': case 'hex':
      if(g.sh !== gf) tdGfSetGrid({sh:gf}, 'shape');
      return;
    case 'size': tdGfSizeMenu(x, y); return;
    case 'pic':
      if(GF.adj){ tdGfAdjToggle(); return; }
      tdGfPicMenu(x, y);
      return;
    case 'ln': tdGfSetGrid({ln:(g.ln === false) ? undefined : false}, 'lines'); return;
    case 'pers':
      if(!tdGfIsDm()) return;
      tdDo({t:'gpers', on:!TD.board.gpers});
      tdRender();
      return;
    case 'me': tdGfMyToken(); return;
    case 'tok': tdGfNewTokenMenu(x, y); return;
    case 'rul':
      GF.ruler = !GF.ruler;
      if(GF.ruler) GF.adj = false;
      else if(GF.rul) tdGfRulEnd();
      tdRender();
      return;
    case 'fit': tdGfFit(); return;
  }
}
function tdGfSetGrid(patch, say){
  if(!tdGfIsDm()) return false;
  var g = tdGfGrid(), n = {sh:g.sh, c:g.c, r:g.r};
  if(g.ln === false) n.ln = false;
  if(g.pic) n.pic = g.pic;
  Object.keys(patch).forEach(function(k){
    if(patch[k] === undefined) delete n[k]; else n[k] = patch[k];
  });
  var a = tdDo({t:'grid', g:n, say:say});
  tdRender();
  return !!a;
}
function tdGfNumIn(v, lo, hi, d){
  var n = parseInt(String(v == null ? '' : v).trim(), 10);
  return isFinite(n) ? Math.max(lo, Math.min(hi, n)) : d;
}
function tdGfMenuFocus(){
  var i = document.querySelector('#tdMenu .td-mform-in');
  if(!i) return;
  try{ i.focus(); i.select(); }catch(_){}
}
function tdGfSizeMenu(x, y){
  if(!tdGfIsDm()) return;
  var g = tdGfGrid();
  tdCloseMenu();
  tdShowMenu('The map', [{form:[
      {label:'Columns', type:'number', min:1, max:TG_GRID_MOST, value:g.c},
      {label:'Rows', type:'number', min:1, max:TG_GRID_MOST, value:g.r}],
    btn:'Set', act:function(v){
      var c = tdGfNumIn(v[0], 1, TG_GRID_MOST, g.c), r = tdGfNumIn(v[1], 1, TG_GRID_MOST, g.r);
      tdCloseMenu();
      if(c !== g.c || r !== g.r) tdGfSetGrid({c:c, r:r}, 'size');
    }}], '', x, y);
  tdGfMenuFocus();
}

/* A token lands in the middle of the view, not of the map: zoomed in on a corner, it is put down there. */
function tdGfNewTokenMenu(x, y){
  if(!TD.board || TD.watching) return;
  tdCloseMenu();
  tdShowMenu('A new token', [{form:[{label:'Label', type:'text', value:'', ph:'Up to 3 characters'}],
    btn:'Put down', act:function(v){
      var lab = tgLab(v[0]);
      if(!lab){
        if(typeof toast === 'function') toast('A token needs a label: up to three letters, numbers or symbols');
        return;
      }
      tdCloseMenu();
      tdGfPutToken({lab:lab});
    }}], '', x, y);
  tdGfMenuFocus();
}
function tdGfMyToken(){
  var ic = tdGfIconNow();
  return tdGfPutToken({lab:ic.txt, col:ic.col, me:true});
}
function tdGfPutToken(o){
  if(!TD.board || TD.watching || !o.lab) return null;
  var at = tdGfFreeCell(tdGfLookCell());
  var t = {uid:tdUid('tk'), c:at.c, r:at.r, lab:o.lab};
  if(o.col) t.col = o.col;
  if(o.me) t.me = true;
  var k = (tdGfTable() && !tdGfIsDm()) ? tdGfMapKey() : '';
  if(k) t.m = k;
  var a = tdDo({t:'gtok', tok:t});
  tdRender();
  return a;
}
function tdGfLookCell(){
  var g = tdGfGrid(), pan = tdGfPanOf(document.querySelector('#tdBoard .td-gview'));
  var W = pan ? pan.offsetWidth : 0, H = pan ? pan.offsetHeight : 0;
  if(!W || !H) return {c:Math.floor(g.c / 2), r:Math.floor(g.r / 2)};
  var bx = tdGfBox(g, W, H);
  return tdGfCellAt(g, (GF.view.cx * W - bx.x) / bx.s, (GF.view.cy * H - bx.y) / bx.s);
}
function tdGfFreeCell(from){
  var g = tdGfGrid(), used = {};
  tdGfVisible().forEach(function(v){
    var k = tdGfKeepOn(g, v.t, v.t.c, v.t.r), sp = tdGfSpan(g, v.t);
    for(var c = k.c; c < k.c + sp.w; c++) for(var r = k.r; r < k.r + sp.h; r++) used[c + ',' + r] = 1;
  });
  if(!used[from.c + ',' + from.r]) return from;
  var best = null, bd = Infinity, m0 = tdGfMid(g, from.c, from.r);
  for(var c2 = 0; c2 < g.c; c2++) for(var r2 = 0; r2 < g.r; r2++){
    if(used[c2 + ',' + r2]) continue;
    var m = tdGfMid(g, c2, r2), dd = (m.x - m0.x) * (m.x - m0.x) + (m.y - m0.y) * (m.y - m0.y);
    if(dd < bd){ bd = dd; best = {c:c2, r:r2}; }
  }
  return best || from;
}

/* Its owner renames and removes it, the DM anybody's by asking them; only the DM sizes and turns one (HANDOFF §85.3). */
function tdGfMenu(ev){
  var el = (ev.target && ev.target.closest) ? ev.target.closest('.td-gtok') : null;
  if(!el || !tdGfViewOf(el)) return false;
  ev.preventDefault();
  tdCloseMenu();
  var hit = tdGfFind(el.getAttribute('data-gtok'));
  if(!hit || !TD.board || TD.watching) return true;
  var t = hit.t, uid = t.uid, mine = (hit.b === TD.board), dm = tdGfIsDm(), rows = [];
  if(mine || dm) rows.push({form:[{label:'Label', type:'text', value:t.lab, ph:'Up to 3 characters'}],
    btn:'Rename', act:function(v){
      var l = tgLab(v[0]);
      if(!l){ if(typeof toast === 'function') toast('A token needs a label: up to three letters, numbers or symbols'); return; }
      tdCloseMenu();
      if(l !== t.lab) tdGfTokSet(uid, {lab:l}, 'glab');
    }});
  if(dm) rows.push({form:[
      {label:'Across', type:'number', min:1, max:TD_GF_TOK_MOST, value:t.w || 1},
      {label:'Down', type:'number', min:1, max:TD_GF_TOK_MOST, value:t.h || 1}],
    btn:'Size', act:function(v){
      var w = tdGfNumIn(v[0], 1, TD_GF_TOK_MOST, t.w || 1), h = tdGfNumIn(v[1], 1, TD_GF_TOK_MOST, t.h || 1);
      tdCloseMenu();
      if(w !== (t.w || 1) || h !== (t.h || 1)) tdGfTokSet(uid, {w:w, h:h}, 'gsize');
    }});
  if(dm && (t.w || 1) !== (t.h || 1)) rows.push({label:'Turn it', act:function(){ tdCloseMenu(); tdGfTurn(uid); }});
  if(mine || dm){
    if(rows.length) rows.push({sep:true});
    rows.push({label:'Remove', act:function(){ tdCloseMenu(); tdGfTokDel(uid); }});
  }
  if(!rows.length) return true;
  tdShowMenu('Token ' + t.lab + ' — ' + tdGfOwnerName(hit), rows, '', ev.clientX, ev.clientY);
  tdGfMenuFocus();
  return true;
}
window.tdGfMenu = tdGfMenu;
function tdGfTokSet(uid, patch, op){
  var hit = tdGfFind(uid);
  if(!hit) return false;
  var a = {t:'gset', uid:uid};
  Object.keys(patch).forEach(function(k){ a[k] = patch[k]; });
  if(hit.b === TD.board){ tdDo(a); tdRender(); return true; }
  if(!tdGfIsDm()) return false;
  var req = {op:op, tok:uid};
  if(op === 'glab') req.lab = a.lab;
  else if(op === 'gsize'){ req.w = a.w; req.h = a.h; }
  else if(op === 'grot') req.rot = a.rot;
  if(!tdRbAsk(hit.seat, req)) return false;
  tdApplyTo(hit.b, a);
  tdRender();
  return true;
}
function tdGfTurn(uid){
  var hit = tdGfFind(uid);
  if(!hit || !tdGfIsDm()) return;
  var r = hit.t.rot || 0;
  tdGfTokSet(uid, {rot:(tdGfGrid().sh === 'hex') ? (r + 1) % 6 : (r ? 0 : 1)}, 'grot');
}
function tdGfTokDel(uid){
  var hit = tdGfFind(uid);
  if(!hit) return;
  var a = {t:'gdel', uid:uid, lab:hit.t.lab};
  if(hit.b === TD.board){ tdDo(a); tdRender(); return; }
  if(tdGfIsDm() && tdRbAsk(hit.seat, {op:'gdel', tok:uid})){ tdApplyTo(hit.b, a); tdRender(); }
}
/* Carried out by its owner: a move from anybody, the rest from the DM only. */
function tdGfReq(m, by){
  var dmBy = (typeof tdRbIsDm === 'function') && tdRbIsDm(tdFoeOf(by));
  if(m.op === 'label'){
    var at = tdFind(m.uid);
    if(!dmBy || !at || at.zone !== 'field' || at.item.anon || (at.item.lab || '') === (m.lab || '')) return false;
    return !!tdDo({t:'label', uid:m.uid, lab:m.lab || ''});
  }
  var t = m.tok ? tdGfTokIn(TD.board, m.tok) : null;
  if(!t) return false;
  switch(m.op){
    case 'gmove':
      if(t.c === m.c && t.r === m.r) return false;
      return !!tdDo({t:'gmove', uid:t.uid, c:m.c, r:m.r});
    case 'glab':  return dmBy && !!tdDo({t:'gset', uid:t.uid, lab:m.lab});
    case 'gsize': return dmBy && !!tdDo({t:'gset', uid:t.uid, w:m.w, h:m.h});
    case 'grot':  return dmBy && !!tdDo({t:'gset', uid:t.uid, rot:m.rot});
    case 'gdel':  return dmBy && !!tdDo({t:'gdel', uid:t.uid, lab:t.lab});
  }
  return false;
}
window.tdGfReq = tdGfReq;

/* A label stays while its card lies open (TD_ACT.move drops it in a pile or a stack); a face-down card's never crosses the table (tblRedact). */
function tdGfKeepsLab(zoneId){
  var z = (typeof tdZoneById === 'function') ? tdZoneById(zoneId) : null;
  return !!z && (z.kind === 'free' || z.kind === 'fan');
}
window.tdGfKeepsLab = tdGfKeepsLab;
function tdGfBadgeHTML(item){
  if(!REBIRTH || !item || !item.lab || item.anon) return '';
  return "<span class='td-glab' data-glab='" + e(item.lab) + "' title='" + e('Label ' + item.lab) + "'>"
    + e(item.lab) + "</span>";
}
window.tdGfBadgeHTML = tdGfBadgeHTML;
function tdGfLabelRow(item, zoneId){
  if(!tdGfOn() || zoneId !== 'field' || !item || item.anon) return null;
  var uid = item.uid, rows = [{form:[{label:'Label', type:'text', value:item.lab || '', ph:'Up to 3 characters'}],
    btn:'Label', act:function(v){ tdCloseMenu(); tdGfSetLabel(uid, tgLab(v[0])); }}];
  if(item.lab) rows.push({label:'Take the label off', act:function(){ tdCloseMenu(); tdGfSetLabel(uid, ''); }});
  return rows;
}
window.tdGfLabelRow = tdGfLabelRow;
function tdGfSetLabel(uid, lab){
  var at = tdFind(uid);
  if(!at || (at.item.lab || '') === lab) return;
  tdDo({t:'label', uid:uid, lab:lab});
  tdRender();
}
function tdGfFoeLabelRow(it, uid, seat){
  if(!tdGfOn() || !tdGfIsDm() || !it || it.anon) return null;
  return {form:[{label:'Label', type:'text', value:it.lab || '', ph:'Up to 3 characters'}],
    btn:'Label', act:function(v){
      var lab = tgLab(v[0]), foe = tdFoeOf(seat);
      tdCloseMenu();
      if(!foe || (it.lab || '') === lab) return;
      if(tdRbAsk(seat, {op:'label', uid:uid, lab:lab})){
        tdApplyTo(foe, {t:'label', uid:uid, lab:lab});
        tdRender();
      }
    }};
}
window.tdGfFoeLabelRow = tdGfFoeLabelRow;
/* A card gone to its Grave takes its owner's tokens with its label, unless another of their cards still carries it: done after the card's move (tdDo). */
function tdGfAfterAct(a, before, beforeLab){
  if(!beforeLab || !a || a.t !== 'move' || !TD.board || before === a.to) return;
  if(a.to !== 'grave' && a.to !== 'dmgrave') return;
  var still = false;
  Object.keys(TD.board.zones).forEach(function(z){
    (TD.board.zones[z] || []).forEach(function(it){ if(it.lab === beforeLab) still = true; });
  });
  if(still) return;
  var uids = tdGfToks(TD.board).filter(function(t){
    return t.lab === beforeLab && tdGfShows(TD.board, t);
  }).map(function(t){ return t.uid; });
  if(!uids.length) return;
  /* grave: Undo takes it back together with the card's move (tdUndo) */
  tdDo(uids.length === 1 ? {t:'gdel', uid:uids[0], lab:beforeLab, grave:true}
                         : {t:'gdel', uids:uids, lab:beforeLab, grave:true});
}
window.tdGfAfterAct = tdGfAfterAct;

function tdGfOver(ev){
  var t = (ev.target && ev.target.closest) ? ev.target : null, hov = null;
  if(t && t.closest('#tdBoard')){
    var tok = t.closest('.td-gtok[data-glab]');
    if(tok) hov = {lab:tok.getAttribute('data-glab'), seat:tok.getAttribute('data-gseat') || 'a', on:'card'};
    else {
      var card = t.closest('.td-card');
      var b = card ? card.querySelector(':scope > .td-glab[data-glab]') : null;
      if(b) hov = {lab:b.getAttribute('data-glab'), seat:tdGfCardSeat(card), on:'tok'};
    }
  }
  var key = hov ? hov.on + '|' + hov.seat + '|' + hov.lab : '';
  if(key === GF.hovKey) return;
  GF.hovKey = key;
  GF.hov = hov;
  tdGfGlowApply();
}
function tdGfGlowApply(){
  var was = document.querySelectorAll('#tdBoard .td-glink');
  for(var i = 0; i < was.length; i++){ was[i].classList.remove('td-glink'); was[i].style.removeProperty('--gl'); }
  var h = GF.hov;
  if(!h) return;
  var col = 'var(--seat-' + tdRbSeat(h.seat) + ', var(--go))', sel = tdSel(h.lab, 'data-glab');
  var els = (h.on === 'card')
    ? [].map.call(document.querySelectorAll('#tdBoard .td-card > .td-glab' + sel), function(x){ return x.parentNode; })
    : [].slice.call(document.querySelectorAll('#tdBoard .td-gtok' + sel));
  els.forEach(function(el){ el.classList.add('td-glink'); el.style.setProperty('--gl', col); });
}
function tdGfCardSeat(card){
  var s = card.closest('[data-seat]');
  return (s && s.getAttribute('data-seat')) || TD.side || 'a';
}

/* On your board once the game is dealt, a change being a gicon move; in the waiting room it goes with your seat (tboSendSeat). */
function tdGfMyName(){
  var n = (typeof TBL !== 'undefined' && TBL.name) || (TD.board && TD.board.name) || TD.boardName || '';
  /* the key TBO_NAME_KEY names (cat_online.js) */
  if(!n){ try{ n = localStorage.getItem('conjure_table_name') || ''; }catch(_){} }
  return n || 'Player';
}
function tdGfInitial(name){
  var ch = tgChars(String(name || '').trim())[0] || '?';
  return tgLab(ch.toUpperCase()) || '?';
}
function tdGfIconSaved(){
  try{ return tgIcon(JSON.parse(localStorage.getItem(TD_GF_ICON_KEY) || 'null')); }catch(_){ return null; }
}
function tdGfIconNow(){
  var s = tdGfIconSaved();
  return {col:(s && s.col) || '', txt:(s && s.txt) || tdGfInitial(tdGfMyName())};
}
window.tdGfIconNow = tdGfIconNow;
function tdGfIconOf(seat, name){
  var b = (typeof tdFoeOf === 'function') ? tdFoeOf(seat) : null;
  var ic = (b && b.icon) ? tgIcon(b.icon) : null;
  if(!ic && typeof TBO !== 'undefined' && TBO.seatInfo && TBO.seatInfo[seat]) ic = tgIcon(TBO.seatInfo[seat].icon);
  return {col:(ic && ic.col) || '', txt:(ic && ic.txt) || tdGfInitial(name)};
}
function tdGfIconHTML(ic, seat, mine, cls){
  var tag = mine ? 'button' : 'span';
  return "<" + tag + (mine ? " type='button' data-gficon='1' title='Your icon: press to change it'"
                       + " aria-label='" + e('Your icon, ' + ic.txt + ': press to change it') + "'"
                     : " aria-hidden='true'")
    + " class='td-gicon" + (cls ? ' ' + cls : '') + "'" + (TD_GF_LIGHT_INK[ic.col] ? " data-ink='lt'" : '')
    + " style='--gt:" + tdGfColVar(ic.col, seat) + "'>" + e(ic.txt) + "</" + tag + ">";
}
function tdGfIconBtnHTML(){ return tdGfIconHTML(tdGfIconNow(), TD.side, true, 'td-gicon-bar'); }
function tdGfChipIconHTML(k, me){
  var name = (typeof TBL !== 'undefined' && TBL.seats && TBL.seats[k] && TBL.seats[k].name) || '';
  return tdGfIconHTML(me ? tdGfIconNow() : tdGfIconOf(k, name), k, me, 'td-gicon-chip');
}
window.tdGfChipIconHTML = tdGfChipIconHTML;
function tdGfAvatarHTML(k, p, me){
  var ic = me ? tdGfIconNow() : tdGfIconOf(k, p && p.name);
  var lt = TD_GF_LIGHT_INK[ic.col] ? " data-ink='lt'" : '', st = " style='--gt:" + tdGfColVar(ic.col, k) + "'";
  if(me) return "<button type='button' class='tbl-av td-gav' data-gficon='1'" + lt + st
    + " title='Your icon: press to change it' aria-label='" + e('Your icon, ' + ic.txt + ': press to change it') + "'>"
    + e(ic.txt) + "</button>";
  return "<div class='tbl-av td-gav'" + lt + st + ">" + e(ic.txt) + "</div>";
}
window.tdGfAvatarHTML = tdGfAvatarHTML;

function tdGfColName(c){ return c ? c.charAt(0).toUpperCase() + c.slice(1) : 'Your seat colour'; }
function tdGfPickOpen(anchor){
  tdGfPickClose();
  tdCloseMenu();
  var cur = tdGfIconNow();
  GF.pick = {col:cur.col, txt:cur.txt};
  var p = document.createElement('div');
  p.id = 'tdGfIconPick';
  p.className = 'td-gipick';
  p.setAttribute('role', 'dialog');
  p.setAttribute('aria-label', 'Your icon');
  p.innerHTML = "<div class='td-gip-h'><span>Your icon</span>"
    + "<button type='button' class='ed2-btn nb nb-red nb-s close-x td-gip-x' data-gidone='0'>Close &#10005;</button></div>"
    + "<div class='td-gip-row'><span class='td-gicon td-gip-prev' aria-hidden='true'></span>"
    + "<input type='text' class='td-gip-in' autocomplete='off' spellcheck='false'"
    + " placeholder='Up to 3 characters' aria-label='Up to three characters' value='" + e(cur.txt) + "'></div>"
    + "<div class='td-gip-cols' role='group' aria-label='Its colour'>"
    + [''].concat(TD_GF_COLS).map(function(c){
        return "<button type='button' class='td-gip-col' data-gicol='" + c + "'"
          + (TD_GF_LIGHT_INK[c] ? " data-ink='lt'" : '')
          + " style='--gt:" + tdGfColVar(c, TD.side) + "' title='" + e(tdGfColName(c)) + "'"
          + " aria-label='" + e(tdGfColName(c)) + "' aria-pressed='false'></button>";
      }).join('') + "</div>"
    + "<div class='td-gip-btns'>"
    + "<button type='button' class='ed2-btn tiny td-gip-ok' data-gidone='1'>Done</button></div>";
  document.body.appendChild(p);
  var inp = p.querySelector('.td-gip-in');
  p.addEventListener('click', function(ev){
    var c = ev.target.closest && ev.target.closest('[data-gicol]');
    if(c){ GF.pick.col = c.getAttribute('data-gicol') || ''; tdGfPickShow(); return; }
    var d = ev.target.closest && ev.target.closest('[data-gidone]');
    if(!d) return;
    if(d.getAttribute('data-gidone') === '1') tdGfIconSet(GF.pick); else tdGfPickClose();
  });
  inp.addEventListener('input', function(){ GF.pick.txt = tgLab(inp.value); tdGfPickShow(); });
  inp.addEventListener('keydown', function(ev){
    if(ev.key === 'Enter'){ ev.preventDefault(); tdGfIconSet(GF.pick); }
  });
  tdGfPickShow();
  var r = anchor.getBoundingClientRect(), pr = p.getBoundingClientRect();
  p.style.left = Math.max(4, Math.min(r.left, window.innerWidth - pr.width - 6)) + 'px';
  p.style.top = Math.max(4, Math.min(r.bottom + 6, window.innerHeight - pr.height - 6)) + 'px';
  try{ inp.focus(); inp.select(); }catch(_){}
}
function tdGfPickShow(){
  var p = document.getElementById('tdGfIconPick');
  if(!p || !GF.pick) return;
  var prev = p.querySelector('.td-gip-prev');
  prev.textContent = GF.pick.txt || tdGfInitial(tdGfMyName());
  prev.style.setProperty('--gt', tdGfColVar(GF.pick.col, TD.side));
  if(TD_GF_LIGHT_INK[GF.pick.col]) prev.setAttribute('data-ink', 'lt'); else prev.removeAttribute('data-ink');
  [].forEach.call(p.querySelectorAll('[data-gicol]'), function(b){
    b.setAttribute('aria-pressed', (b.getAttribute('data-gicol') || '') === GF.pick.col ? 'true' : 'false');
  });
}
function tdGfPickClose(){
  var p = document.getElementById('tdGfIconPick');
  if(p) p.remove();
  GF.pick = null;
}
function tdGfPickOutside(ev){
  var p = document.getElementById('tdGfIconPick');
  if(!p || (ev.target.closest && (ev.target.closest('#tdGfIconPick') || ev.target.closest('[data-gficon]')))) return;
  tdGfPickClose();
}
function tdGfIconSet(ic){
  var o = tgIcon(ic) || {col:'', txt:''};
  if(!o.txt) o.txt = tdGfInitial(tdGfMyName());
  try{ localStorage.setItem(TD_GF_ICON_KEY, JSON.stringify(o)); }catch(_){}
  tdGfPickClose();
  if(REBIRTH && TD.board && !TD.watching){
    var was = TD.board.icon ? tgIcon(TD.board.icon) : null;
    if(!was || was.col !== o.col || was.txt !== o.txt) tdDo({t:'gicon', icon:o});
    tdGfToks(TD.board).forEach(function(t){
      if(t.me && ((t.col || '') !== o.col || t.lab !== o.txt)) tdDo({t:'gset', uid:t.uid, col:o.col, lab:o.txt});
    });
  }
  if(typeof tboSendSeat === 'function') tboSendSeat();
  if(typeof tboDialogOpen === 'function' && tboDialogOpen() && typeof tboRoomRender === 'function'
     && typeof TBO !== 'undefined' && TBO.view === 'room') tboRoomRender();
  if(typeof tblRenderPanel === 'function') tblRenderPanel();
  tdRender();
}

/* A map carries its picture's name (tdGfHash), not the picture: that is kept once, by name, in this browser and asked of the DM by whoever lacks it (HANDOFF §85.4). */
var TD_GF_DB = 'conjure_rbgrid', TD_GF_STORE = 'pics';
var TD_GF_PIC_PX = 2048;
var TD_GF_PIC_MOST = 1400000;
var TD_GF_PIC_TAKE = 3000000;
var TD_GF_PIC_OK = /^data:image\/(?:png|jpeg|webp|gif);base64,[A-Za-z0-9+\/]+=*$/;
/* Two 32-bit FNV-1a hashes; maps already saved carry these names, which tdGfPicValid checks, so it must not change. */
function tdGfHash(s){
  var h1 = 0x811c9dc5, h2 = (0x9e3779b9 ^ s.length) >>> 0;
  for(var i = 0; i < s.length; i++){
    var c = s.charCodeAt(i);
    h1 = Math.imul(h1 ^ c, 16777619) >>> 0;
    h2 = Math.imul(h2 ^ c, 16777619) >>> 0;
  }
  var hx = function(n){ return ('0000000' + n.toString(16)).slice(-8); };
  return 'p' + hx(h1) + hx(h2);
}
function tdGfPicValid(id, data){
  return typeof id === 'string' && TG_PIC_ID.test(id) && typeof data === 'string'
    && data.length <= TD_GF_PIC_TAKE && TD_GF_PIC_OK.test(data) && tdGfHash(data) === id;
}

function tdGfDb(){
  if(GF.dbq) return GF.dbq;
  GF.dbq = new Promise(function(res){
    try{
      var rq = indexedDB.open(TD_GF_DB, 1);
      rq.onupgradeneeded = function(){
        var db = rq.result;
        if(!db.objectStoreNames.contains(TD_GF_STORE)) db.createObjectStore(TD_GF_STORE, {keyPath:'id'});
      };
      rq.onsuccess = function(){
        var db = rq.result;
        db.onversionchange = function(){ try{ db.close(); }catch(_){} GF.db = null; GF.dbq = null; };
        GF.db = db;
        res(db);
      };
      rq.onerror = function(){ res(null); };
      rq.onblocked = function(){ res(null); };
    }catch(_){ res(null); }
  });
  return GF.dbq;
}
function tdGfPicGet(id){
  return tdGfDb().then(function(db){
    if(!db) return null;
    return new Promise(function(res){
      try{
        var rq = db.transaction(TD_GF_STORE, 'readonly').objectStore(TD_GF_STORE).get(id);
        rq.onsuccess = function(){
          var r = rq.result;
          res((r && typeof r.data === 'string' && r.data.indexOf('data:image/') === 0) ? r.data : null);
        };
        rq.onerror = function(){ res(null); };
      }catch(_){ res(null); }
    });
  });
}
function tdGfPicPut(id, data){
  return tdGfDb().then(function(db){
    if(!db) return false;
    return new Promise(function(res){
      try{
        var tx = db.transaction(TD_GF_STORE, 'readwrite');
        tx.objectStore(TD_GF_STORE).put({id:id, data:data, at:Date.now()});
        tx.oncomplete = function(){ res(true); };
        tx.onerror = function(){ res(false); };
        tx.onabort = function(){ res(false); };
      }catch(_){ res(false); }
    });
  });
}
function tdGfPicLoad(id, data){
  if(GF.imgs[id] || GF.loading[id]) return;
  GF.loading[id] = 1;
  GF.data[id] = data;
  var img = new Image();
  img.onload = function(){
    delete GF.loading[id];
    delete GF.missing[id];
    GF.imgs[id] = img;
    tdGfPicPrune(id);
    tdGfApplySoon();
  };
  img.onerror = function(){
    delete GF.loading[id];
    GF.missing[id] = 'The picture under this map could not be drawn';
    tdGfApplySoon();
  };
  img.src = data;
}
/* The rest are read from this browser again when they are next on the map. */
function tdGfPicPrune(keep){
  var ids = Object.keys(GF.imgs);
  if(ids.length <= 6) return;
  var cur = tdGfGrid().pic;
  ids.forEach(function(k){
    if(k === keep || (cur && cur.id === k)) return;
    delete GF.imgs[k]; delete GF.data[k]; delete GF.looked[k];
  });
}
function tdGfPicNeed(){
  var p = GF.live || tdGfGrid().pic;
  if(!p) return;
  var id = p.id;
  if(GF.imgs[id] || GF.loading[id]) return;
  if(GF.data[id]){ tdGfPicLoad(id, GF.data[id]); return; }
  if(GF.looked[id] === 1) return;
  if(!GF.looked[id]){
    GF.looked[id] = 1;
    tdGfPicGet(id).then(function(data){
      GF.looked[id] = 2;
      if(data) tdGfPicLoad(id, data); else tdGfApplySoon();
    }, function(){ GF.looked[id] = 2; tdGfApplySoon(); });
    return;
  }
  if(tdGfIsDm() || !tdGfTable()){ GF.missing[id] = 'The picture under this map is not saved in this browser'; return; }
  tdGfPicAsk(id);
}
function tdGfPicAsk(id){
  var a = GF.asked[id] || (GF.asked[id] = {n:0, t:0});
  if(a.t) return;
  var seat = tdGfSeatOf(tdGfOwner());
  var s = (typeof TBL !== 'undefined' && TBL.seats) ? TBL.seats[seat] : null;
  if(s && s.id && typeof tblOn === 'function' && tblOn() && tblSend({t:'want', pic:id, to:s.id})) a.n++;
  if(a.n >= 3) GF.missing[id] = 'The picture under this map has not arrived from the DM';
  a.t = setTimeout(function(){ a.t = 0; tdGfApplySoon(); }, a.n >= 3 ? 60000 : 9000);
}
function tdGfOnMsg(msg, fromId){
  if(!msg) return false;
  if(msg.t === 'want' && msg.pic){
    if(!msg.to || msg.to === TBL.you) tdGfPicServe(msg.pic, fromId);
    return true;
  }
  if(msg.t === 'gpic'){
    if(msg.to && msg.to === TBL.you) tdGfPicPart(msg, fromId);
    return true;
  }
  return false;
}
window.tdGfOnMsg = tdGfOnMsg;
function tdGfPicServe(id, toId){
  if(!tdGfIsDm() || !toId || !tdGfTable()) return;
  var g = tdGfGrid();
  if(!g.pic || g.pic.id !== id) return;
  var here = !!tblSideOf(toId) || (TBL.watchList || []).some(function(w){ return w && w.id === toId; });
  if(!here) return;
  var k = toId + '|' + id;
  if(Date.now() - (GF.sent[k] || 0) < 5000) return;
  GF.sent[k] = Date.now();
  var send = function(data){
    if(!data) return;
    var n = Math.max(1, Math.ceil(data.length / TD_GF_PART));
    for(var i = 0; i < n; i++)
      tblSend({t:'gpic', to:toId, id:id, i:i, n:n, part:data.slice(i * TD_GF_PART, (i + 1) * TD_GF_PART)});
  };
  if(GF.data[id]) send(GF.data[id]);
  else tdGfPicGet(id).then(send, function(){});
}
function tdGfPicPart(msg, fromId){
  var id = msg.id, a = GF.asked[id];
  if(!a || GF.imgs[id]) return;
  var seat = tdGfSeatOf(tdGfOwner()), s = (TBL.seats || {})[seat];
  if(!s || !fromId || s.id !== fromId) return;
  var p = GF.parts[id], now = Date.now();
  if(p && (p.n !== msg.n || now - p.at > 60000)) p = null;
  if(!p) p = GF.parts[id] = {n:msg.n, got:0, bits:[], at:0};
  if(p.bits[msg.i] === undefined){ p.bits[msg.i] = msg.part; p.got++; }
  p.at = now;
  if(a.t){ clearTimeout(a.t); a.t = setTimeout(function(){ a.t = 0; tdGfApplySoon(); }, 9000); }
  if(p.got < p.n) return;
  delete GF.parts[id];
  var data = p.bits.join('');
  if(!tdGfPicValid(id, data)) return;
  clearTimeout(a.t);
  delete GF.asked[id];
  delete GF.missing[id];
  tdGfPicPut(id, data);
  tdGfPicLoad(id, data);
}

function tdGfPicMenu(x, y){
  if(!tdGfIsDm()) return;
  var g = tdGfGrid(), p = g.pic, rows = [];
  rows.push({label:(p ? 'Choose another picture…' : 'Choose a picture…'),
             act:function(){ tdCloseMenu(); tdGfPicChoose(); }});
  if(p){
    rows.push({label:'Move or resize it', act:function(){ tdCloseMenu(); tdGfAdjToggle(); }});
    if(p.x || p.y || p.w !== 1 || p.h !== 1)
      rows.push({label:'Stretch it over the map', act:function(){ tdCloseMenu(); tdGfPicFit(); }});
    rows.push({sep:true});
    rows.push({label:'Take it off', act:function(){ tdCloseMenu(); tdGfPicOff(); }});
  }
  tdCloseMenu();
  tdShowMenu('The picture under the map', rows, '', x, y);
}
function tdGfPicChoose(){
  var inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = 'image/*';
  inp.addEventListener('change', function(){
    var f = inp.files && inp.files[0];
    if(!f) return;
    var rd = new FileReader();
    rd.onload = function(){ tdGfPicTake(String(rd.result || '')); };
    rd.onerror = function(){ if(typeof toast === 'function') toast('That picture could not be read'); };
    rd.readAsDataURL(f);
  });
  inp.click();
}
function tdGfPicTake(raw){
  tdGfPicShrink(raw, function(data){
    if(!data){ if(typeof toast === 'function') toast('That picture could not be read'); return; }
    if(!tdGfIsDm()) return;
    var id = tdGfHash(data);
    delete GF.missing[id];
    tdGfPicPut(id, data).then(function(ok){
      if(!ok && typeof toast === 'function')
        toast('This browser would not keep the picture, so it will be gone once the page is closed');
    });
    tdGfPicLoad(id, data);
    tdGfSetGrid({pic:{id:id, x:0, y:0, w:1, h:1}}, 'pic');
  });
}
/* A JPEG has nothing to see through, so a picture made smaller is drawn on the map's paper colour (--gf-pic-bg). */
function tdGfPicShrink(raw, done){
  if(typeof raw !== 'string' || raw.indexOf('data:image/') !== 0){ done(null); return; }
  var img = new Image();
  img.onload = function(){
    var w = img.naturalWidth, h = img.naturalHeight;
    if(!w || !h){ done(null); return; }
    if(Math.max(w, h) <= TD_GF_PIC_PX && raw.length <= TD_GF_PIC_MOST && TD_GF_PIC_OK.test(raw)){ done(raw); return; }
    var s = Math.min(1, TD_GF_PIC_PX / Math.max(w, h)), out = null;
    var bg = tdGfCss(getComputedStyle(document.documentElement), '--gf-pic-bg') || 'white';
    for(var k = 0; k < 7; k++){
      var cw = Math.max(1, Math.round(w * s)), ch = Math.max(1, Math.round(h * s));
      var c = document.createElement('canvas');
      c.width = cw; c.height = ch;
      var x = c.getContext('2d');
      if(!x){ out = null; break; }
      x.fillStyle = bg;
      x.fillRect(0, 0, cw, ch);
      x.drawImage(img, 0, 0, cw, ch);
      try{ out = c.toDataURL('image/jpeg', 0.86); }catch(_){ out = null; break; }
      if(out.length <= TD_GF_PIC_MOST) break;
      s *= 0.8;
    }
    done((out && out.length <= TD_GF_PIC_MOST && TD_GF_PIC_OK.test(out)) ? out : null);
  };
  img.onerror = function(){ done(null); };
  img.src = raw;
}
function tdGfPicFit(){
  var p = tdGfGrid().pic;
  if(p) tdGfSetGrid({pic:{id:p.id, x:0, y:0, w:1, h:1}}, 'move');
}
function tdGfPicOff(){
  GF.adj = false;
  GF.live = null;
  GF.adjDrag = null;
  tdGfSetGrid({pic:undefined}, 'nopic');
}

/* Drawn as it goes on the DM's screen alone (GF.live); let go, it is one move on the map, for everybody. */
function tdGfAdjToggle(){
  if(GF.adj){
    GF.adj = false; GF.live = null; GF.adjDrag = null;
    tdRender();
    return;
  }
  if(!tdGfIsDm() || !tdGfGrid().pic) return;
  GF.adj = true;
  GF.ruler = false;
  if(GF.rul) tdGfRulEnd();
  tdRender();
  if(typeof toast === 'function') toast('Drag the picture to move it, or one of its corners to size it. Esc when it is right');
}
function tdGfAdjStart(ev, view){
  var p = tdGfGrid().pic, u = p ? tdGfUnitAt(view, ev.clientX, ev.clientY) : null;
  if(!u) return false;
  var bx = u.bx, z = (GF.view.z > 1.0001) ? GF.view.z : 1;
  var q = {x:u.ux / bx.u.w, y:u.uy / bx.u.h}, tx = 10 / (bx.w * z), ty = 10 / (bx.h * z);
  var corners = [['nw', p.x, p.y], ['ne', p.x + p.w, p.y], ['sw', p.x, p.y + p.h], ['se', p.x + p.w, p.y + p.h]];
  var mode = '';
  for(var i = 0; i < 4; i++){
    if(Math.abs(q.x - corners[i][1]) <= tx && Math.abs(q.y - corners[i][2]) <= ty){ mode = corners[i][0]; break; }
  }
  if(!mode){
    if(q.x < p.x || q.x > p.x + p.w || q.y < p.y || q.y > p.y + p.h) return false;
    mode = 'move';
  }
  GF.adjDrag = {view:view, mode:mode, q0:q, p0:{id:p.id, x:p.x, y:p.y, w:p.w, h:p.h},
                x:ev.clientX, y:ev.clientY, moved:false};
  GF.live = {id:p.id, x:p.x, y:p.y, w:p.w, h:p.h};
  return true;
}
function tdGfAdjMove(ev){
  var d = GF.adjDrag;
  d.view = tdGfLiveView(d.view);
  if(!d.view) return;
  if(!d.moved){
    if(Math.abs(ev.clientX - d.x) + Math.abs(ev.clientY - d.y) < 3) return;
    d.moved = true;
  }
  var u = tdGfUnitAt(d.view, ev.clientX, ev.clientY);
  if(!u) return;
  var q = {x:u.ux / u.bx.u.w, y:u.uy / u.bx.u.h}, p0 = d.p0, MIN = 0.02, n;
  if(d.mode === 'move'){
    n = {x:p0.x + q.x - d.q0.x, y:p0.y + q.y - d.q0.y, w:p0.w, h:p0.h};
  } else {
    var east = (d.mode === 'ne' || d.mode === 'se'), south = (d.mode === 'sw' || d.mode === 'se');
    var fx = east ? p0.x : p0.x + p0.w, fy = south ? p0.y : p0.y + p0.h;
    var w = Math.max(MIN, east ? q.x - fx : fx - q.x), h = Math.max(MIN, south ? q.y - fy : fy - q.y);
    if(!ev.shiftKey){
      var k = Math.max(w / p0.w, h / p0.h);
      w = Math.max(MIN, p0.w * k); h = Math.max(MIN, p0.h * k);
    }
    w = Math.min(8, w); h = Math.min(8, h);
    n = {x:east ? fx : fx - w, y:south ? fy : fy - h, w:w, h:h};
  }
  GF.live = {id:p0.id, x:Math.max(-4, Math.min(4, n.x)), y:Math.max(-4, Math.min(4, n.y)), w:n.w, h:n.h};
  tdGfApplySoon();
}
function tdGfAdjEnd(cancel){
  var d = GF.adjDrag, live = GF.live;
  GF.adjDrag = null;
  GF.live = null;
  if(cancel || !d || !d.moved || !live || !tdGfIsDm()){ tdGfApplySoon(); return; }
  var r4 = function(v){ return Math.round(v * 1e4) / 1e4; };
  tdGfSetGrid({pic:{id:live.id, x:r4(live.x), y:r4(live.y), w:r4(live.w), h:r4(live.h)}}, 'move');
}

function tdGfPicsOf(maps, done){
  var ids = [];
  (maps || []).forEach(function(m){
    var p = m && m.grid && m.grid.pic;
    if(p && p.id && ids.indexOf(p.id) < 0) ids.push(p.id);
  });
  if(!ids.length){ done({}); return; }
  var out = {}, left = ids.length;
  ids.forEach(function(id){
    var got = function(data){
      if(data) out[id] = data;
      if(--left === 0) done(out);
    };
    if(GF.data[id]) got(GF.data[id]);
    else tdGfPicGet(id).then(got, function(){ got(null); });
  });
}
window.tdGfPicsOf = tdGfPicsOf;
function tdGfPicsIn(pics){
  if(!pics || typeof pics !== 'object' || Array.isArray(pics)) return;
  Object.keys(pics).slice(0, 200).forEach(function(id){
    var data = pics[id];
    if(!tdGfPicValid(id, data)) return;
    delete GF.looked[id];
    delete GF.missing[id];
    tdGfPicPut(id, data).then(function(){ tdGfApplySoon(); });
  });
}
window.tdGfPicsIn = tdGfPicsIn;

/* A player's tokens are never in a map: they stay on the player's board, tagged with the map they were put down on (HANDOFF §85.4). */
function tdGfMapNow(out){
  var b = TD.board;
  if(!b) return out;
  var g = b.grid ? tgGrid(b.grid) : null;
  if(g) out.grid = g;
  var ts = tdGfToks(b).map(function(t){ return tgGTok(t, true); }).filter(Boolean);
  if(ts.length) out.gtoks = ts;
  /* A map never named, with players' tokens on it, is kept when the DM switches away, so they have a map to come back with. */
  if(tdGfTable() && !b.gpers && !b.map && tdGfPlayersOn('')) out.held = true;
  return out;
}
window.tdGfMapNow = tdGfMapNow;
function tdGfPlayersOn(key){
  return tdGfBoards().some(function(b){
    return b !== TD.board && tdGfToks(b).some(function(t){ return (t.m || '') === key; });
  });
}
function tdGfMapClean(m, out){
  var g = tgGrid(m && m.grid);
  if(g) out.grid = g;
  if(m && Array.isArray(m.gtoks)){
    var ts = m.gtoks.slice(0, 500).map(function(t){ return tgGTok(t, true); }).filter(Boolean);
    if(ts.length) out.gtoks = ts;
  }
  return out;
}
window.tdGfMapClean = tdGfMapClean;
function tdGfMapActOf(m, act){
  act.grid = (m && m.grid) ? tgGrid(m.grid) : null;
  if(TD.board && TD.board.gpers) act.gkeep = true;
  else act.gtoks = ((m && m.gtoks) || []).map(function(t){
    var o = tgGTok(t, true);
    if(o) o.uid = tdUid('tk');
    return o;
  }).filter(Boolean);
  return act;
}
window.tdGfMapActOf = tdGfMapActOf;
/* A map only named or renamed (`keep`) never comes here, so only a switch counts in `gn` and resets everybody's view. */
function tdGfMapDown(b, a){
  b.gn = (b.gn || 0) + 1;
  var g = a.grid ? tgGrid(a.grid) : null;
  if(g) b.grid = g; else delete b.grid;
  if(a.gkeep) return;
  var ts = (Array.isArray(a.gtoks) ? a.gtoks.slice(0, 500) : []).map(function(t){ return tgGTok(t); }).filter(Boolean);
  if(ts.length) b.gtoks = ts; else delete b.gtoks;
}
window.tdGfMapDown = tdGfMapDown;
/* Numbered by the time and always after the last, so a number the DM's Undo took back is never handed out again. */
function tdGfTag(was, now, gone){
  var l = tdGfTagList(TD.board), last = l.length ? l[l.length - 1].n : 0;
  var a = {t:'gtag', was:was, now:now, n:Math.max(Date.now(), last + 1)};
  if(gone) a.gone = true;
  tdDo(a);
}
function tdGfMapSwitching(kept, name){
  if(!tdGfTable() || !tdGfIsDm()) return;
  var cur = String(TD.board.map || '').toLowerCase(), now = String(name || '').toLowerCase();
  if(TD.board.gpers){ if(cur !== now) tdGfTag(cur, now); return; }
  if(!cur && kept) tdGfTag('', String(kept).toLowerCase());
}
window.tdGfMapSwitching = tdGfMapSwitching;
function tdGfRetag(was, name){
  if(!tdGfTable() || !tdGfIsDm()) return;
  var w = String(was || '').toLowerCase(), n = String(name || '').toLowerCase();
  if(w !== n) tdGfTag(w, n);
}
window.tdGfRetag = tdGfRetag;
/* Its players' tokens go with it: left tagged with a map that can never come down again, nobody could see, move or remove them. */
function tdGfMapGone(name){
  if(!tdGfTable() || !tdGfIsDm()) return;
  var k = String(name || '').toLowerCase();
  if(!k || k === String(TD.board.map || '').toLowerCase()) return;
  tdGfTag(k, '', true);
  if(typeof tblSendState === 'function') tblSendState();
}
window.tdGfMapGone = tdGfMapGone;
function tdGfHeard(side, a){
  if(!a || a.t !== 'gtag' || !TD.board || TD.watching || tdRbIsDm(TD.board)) return;
  var o = tdFoeOf(side);
  if(!o || !tdRbIsDm(o)) return;
  tdGfTagMine(a);
}
window.tdGfHeard = tdGfHeard;
function tdGfTagMine(g){
  var was = String(g.was || ''), now = String(g.now || ''), n = tgInt(g.n, 1, 1e15);
  var hit = (g.gone || was !== now)
    && tdGfToks(TD.board).some(function(t){ return (t.m || '') === was; });
  if(hit){
    var a = {t:'gtag', was:was, now:now};
    if(n) a.n = n;
    if(g.gone) a.gone = true;
    tdDo(a);
  } else if(n && n > (TD.board.gtseen || 0)){
    TD.board.gtseen = n;
    tdSaveSoon();
  }
}
/* A board that has heard none starts from the DM's last: a player just sat down has no token any of them was about. */
function tdGfCatchUp(side){
  if(!TD.board || TD.watching || tdRbIsDm(TD.board)) return;
  var o = tdFoeOf(side);
  if(!o || !tdRbIsDm(o)) return;
  var l = tdGfTagList(o);
  if(TD.board.gtseen == null){
    TD.board.gtseen = l.length ? l[l.length - 1].n : 0;
    tdSaveSoon();
    return;
  }
  l.forEach(function(g){ if(g.n > (TD.board.gtseen || 0)) tdGfTagMine(g); });
}
window.tdGfCatchUp = tdGfCatchUp;

/* The press is heard on the way down, before the board's own (tdBindDrag, HANDOFF §85.5); a move and a let-go on the whole page, so a drag that leaves the map ends cleanly. */
(function(){
  if(window._tdGfBound) return;
  window._tdGfBound = true;
  document.addEventListener('wheel', tdGfWheel, {passive:false});
  document.addEventListener('pointerdown', tdGfPickOutside, true);
  document.addEventListener('pointerdown', tdGfDown, true);
  window.addEventListener('pointermove', tdGfMove, true);
  window.addEventListener('pointerup', function(ev){ tdGfUp(ev, false); }, true);
  window.addEventListener('pointercancel', function(ev){ tdGfUp(ev, true); }, true);
  document.addEventListener('click', tdGfClick);
  document.addEventListener('pointerover', tdGfOver);
  document.addEventListener('keydown', tdGfKey, true);
  window.addEventListener('resize', tdGfApplySoon);
})();
