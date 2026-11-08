/* The shared Field is a layout, not a board: each board's cards on a layer of its own, one box on every screen, another's card moved by asking (HANDOFF §84.3). */
var RB_FIELD_W = 14, RB_FIELD_ASPECT = 3, RB_CARD_RATIO = 1.39609;

/* A board with another player's half on it counts as a table whatever the connection says: the checks build one with tdMockFoe. */
function tdRbOn(){
  if(!REBIRTH || tdIsPool()) return false;
  if(tdFoeOn()) return true;
  return typeof tblOn === 'function' && tblOn() && TBL.phase !== 'waiting';
}
window.tdRbOn = tdRbOn;
function tdRbSeat(seat){ return String(seat || '').replace(/[^a-z]/g, '').slice(0, 1) || 'a'; }
/* Your own board carries no side: TD.side holds it. */
function tdRbSideOf(b){ return tdRbSeat(b === TD.board ? TD.side : (b && b.side)); }
function tdRbInk(seat){ return '--rb-ink:var(--seat-' + tdRbSeat(seat) + ', var(--go))'; }
function tdRbDmOnly(b){ return !!b && b.role === 'dm'; }

/* Seat order: the layers must stack the same on every screen. */
function tdRbFieldBoards(){
  var out = [];
  TD_SEATS.forEach(function(s){
    var b = (TD.board && s === TD.side) ? TD.board : tdFoeOf(s);
    if(b) out.push(b);
  });
  if(TD.board && TD_SEATS.indexOf(TD.side) < 0) out.push(TD.board);
  return out;
}
function tdRbOthers(){
  var me = TD.board ? TD.side : null;
  return tdSeatOrder().filter(function(s){ return s !== me; })
    .map(tdFoeOf).filter(function(b){ return !!b && !tdRbDmOnly(b); });
}

function tdRbOtherHTML(b){
  var seat = tdRbSideOf(b);
  var ez = tdZoneById('essarea');
  return "<div class='td-half td-half-foe rb-other' data-side='foe' data-seat='" + seat + "'"
    + " style='" + tdRbInk(seat) + "'>"
    + "<div class='rb-oname'>" + e(b.name || tblSeatName(seat))
    + (b.role === 'dmp' ? " <span class='rb-odm'>DM</span>" : '') + "</div>"
    + tdZoneHTML(tdZoneById('hand'), b)
    + tdZoneSectionHTML({id:'essarea', label:ez.label, short:ez.short, kind:'fan'}, b)
    + "</div>";
}
function tdRbFieldHTML(boards){
  var fz = tdZoneById('field'), n = 0;
  var layers = boards.map(function(b){
    var mine = (b === TD.board), seat = tdRbSideOf(b);
    var items = (b.zones && b.zones.field) || [];
    n += items.length;
    return "<div class='rb-flayer" + (mine ? ' rb-flayer-mine' : '') + "'"
      + " data-side='" + (mine ? 'mine' : 'foe') + "' data-seat='" + seat + "'"
      + " style='" + tdRbInk(seat) + "'>"
      + items.filter(tdIsRoot).map(function(it){ return tdGroupHTML(it, items, fz, b); }).join('')
      + "<div class='td-tokens'" + (mine ? " id='tdTokens'" : '') + ">"
      + ((b.tokens || []).filter(function(t){ return !t.on; }).map(tdTokenHTML).join(''))
      + "</div></div>";
  }).join('');
  var gf = (typeof tdGfOn === 'function') && tdGfOn();
  return "<section class='td-zone td-free rb-field" + (gf ? ' td-gfz' : '') + "' data-zone='field' data-side='mine'>"
    + (gf ? tdGfBarHTML() : '')
    + "<div class='td-zhdr'><span class='td-zcount'>" + n + "</span>"
    + "<span class='td-zname' title='" + e(fz.label) + "'>" + e(tdZoneTitle(fz)) + "</span>"
    + "<span class='td-ztools'></span></div>"
    + (TD.board ? tdRbLockPairHTML(TD.board) : '')
    + "<div class='td-zbody" + (gf ? ' td-gview' : '') + "'>" + (gf ? tdGfViewHTML(layers) : layers)
    + "</div></section>";
}
function tdRbLockPairHTML(b){
  var items = (b.zones && b.zones.field) || [];
  var nL = items.filter(function(it){ return it.locked; }).length, nF = items.length - nL;
  var s = function(k){ return k === 1 ? '' : 's'; };
  return "<div class='td-zacts'>"
    + "<button class='td-zbtn td-zbtn-un" + (nL ? ' on' : '') + "' onclick=\"tdUnlockZone('field')\""
    + (nL ? '' : ' disabled') + " title='" + (nL
        ? ('Unlock your ' + nL + ' locked card' + s(nL) + ' here')
        : 'None of your cards here is locked') + "'>Unlock</button>"
    + "<button class='td-zbtn td-zbtn-lk" + (nF ? ' on' : '') + "' onclick=\"tdLockZone('field')\""
    + (nF ? '' : ' disabled') + " title='" + (nF
        ? ('Lock your ' + nF + ' unlocked card' + s(nF) + ' here')
        : (items.length ? 'All your cards here are already locked' : 'None of your cards is here'))
    + "'>Lock</button></div>";
}
/* display:contents, but the element stays: .td-half-mine and td-play2 are read off it. The panel is left empty for tdRenderCounters. */
function tdRbMineHTML(b){
  var dm = (typeof tdDmCornerHTML === 'function') ? tdDmCornerHTML(b) : null;
  return "<div class='td-half td-half-mine rb-mine' data-side='mine' data-seat='" + tdRbSeat(TD.side) + "'>"
    + (dm != null ? dm : ['deck', 'grave', 'essarea', 'hand'].map(tdZoneById).filter(Boolean)
        .map(function(z){ return tdZoneHTML(z, b); }).join(''))
    + "<div class='td-play'><div class='td-play-ctrs' id='tdPlayCtrs'></div></div>"
    + "</div>";
}
/* tdRender's steps in tdRender's order: the panel before the fit, the fit before any face, the counters once the faces are there. */
function tdRbRender(host){
  ['td-two', 'td-seats3', 'td-seats4', 'td-many'].forEach(function(c){ host.classList.remove(c); });
  host.style.removeProperty('--td-side-l'); host.style.removeProperty('--td-side-r');
  var others = tdRbOthers(), boards = tdRbFieldBoards();
  var role = (TD.board && !TD.watching && TD.board.role) || '';
  host.innerHTML = "<div class='rb-table" + (TD.board ? '' : ' rb-spect')
    + (_rbFit.two ? ' rb-play2' : '')
    + (role === 'dm' ? ' rb-dm' : role === 'dmp' ? ' rb-dmp' : '') + "'>"
    + (others.length ? "<div class='rb-others'>" + others.map(tdRbOtherHTML).join('') + "</div>" : '')
    + tdRbFieldHTML(boards)
    + (TD.board ? tdRbMineHTML(TD.board) : '')
    + "</div>";
  tdSyncTopStrip();
  if(!tdRenderCounters()) tdRenderBar();
  tdRbFit(host);
  tdFitHands(host);
  tdPaintFaces(host);
  var mineEl = host.querySelector('.rb-mine');
  if(mineEl) tdReflowFree(mineEl, TD.board);
  tdRbReflowField(host, boards);
  tdRbPlaceTokens(host);
  if(typeof tdGfAfterRender === 'function') tdGfAfterRender(host);
  if(typeof tdFxAfterRender === 'function') tdFxAfterRender(host);
  tdRenderArrows();
  tdRenderPointer();
  tdRenderMoved();
  tdReflash();
  /* Placed again once the card fonts are in, as in tdRender. */
  if(!TD._rbFontsBound && document.fonts && document.fonts.ready){
    TD._rbFontsBound = true;
    document.fonts.ready.then(function(){
      var h = document.getElementById('tdBoard');
      if(!h || !h.querySelector('.rb-table')) return;
      tdRbPlaceTokens(h);
      tdFitTitles(h);
      tdFitTitles(tdCtrHost());
    });
  }
  tdFitTitles(host);
}
window.tdRbRender = tdRbRender;
function tdRbPlaceTokens(host){
  var mineEl = host.querySelector('.rb-mine');
  if(mineEl && TD.board) tdPlaceCardTokens(mineEl, TD.board);
  tdRbOthers().forEach(function(b){
    tdPlaceCardTokens(host.querySelector('.rb-other' + tdSel(tdRbSideOf(b), 'data-seat')), b);
  });
  tdRbFieldBoards().forEach(function(b){
    tdPlaceCardTokens(host.querySelector('.rb-flayer' + tdSel(tdRbSideOf(b), 'data-seat')), b);
  });
}

/* In percent of the Field and never measured, so every screen hands out the same spots (HANDOFF §84.3). */
function tdRbCardPct(){
  var w = 100 / RB_FIELD_W;
  return {w:w, h:w * RB_CARD_RATIO * RB_FIELD_ASPECT};
}
function tdRbLayout(boards, skip){
  var C = tdRbCardPct(), taken = [], at = {};
  var roots = function(b){
    return ((b.zones && b.zones.field) || []).filter(function(it){
      return tdIsRoot(it) && it.uid !== skip;
    });
  };
  boards.forEach(function(b){
    roots(b).forEach(function(it){
      if(it.auto !== false) return;
      var p = {x:tdNum(it.x, 4), y:tdNum(it.y, 4)};
      taken.push(p); at[it.uid] = p;
    });
  });
  boards.forEach(function(b){
    roots(b).forEach(function(it){
      if(it.auto === false) return;
      var p = tdRbFreeSpot(taken, C);
      taken.push(p); at[it.uid] = p;
    });
  });
  return {at:at, taken:taken, C:C};
}
function tdRbFreeSpot(taken, C){
  C = C || tdRbCardPct();
  var maxX = 100 - C.w, maxY = 100 - C.h;
  var clear = function(x, y){
    for(var i = 0; i < taken.length; i++){
      var t = taken[i];
      if(Math.abs(t.x - x) < C.w && Math.abs(t.y - y) < C.h) return false;
    }
    return true;
  };
  /* Not at the very top: a played Action or Spell floats up and would leave the Field. */
  for(var y = 5; y <= maxY + 0.01; y += C.h * 1.06){
    for(var x = 1.5; x <= maxX + 0.01; x += C.w * 1.08){
      if(clear(x, y)) return {x:Math.round(x * 100) / 100, y:Math.round(y * 100) / 100};
    }
  }
  var k = taken.length % 12;
  return {x:Math.round((2 + k * 1.6) * 100) / 100, y:Math.round((2 + k * 1.6) * 100) / 100};
}
function tdRbSpot(uid){
  var L = tdRbLayout(tdRbFieldBoards(), uid);
  return tdRbFreeSpot(L.taken, L.C);
}
window.tdRbSpot = tdRbSpot;
/* The DOM only, so the board saved and sent never depends on a screen. */
function tdRbReflowField(host, boards){
  var body = host.querySelector('.rb-field > .td-zbody');
  if(!body) return;
  var L = tdRbLayout(boards, null);
  boards.forEach(function(b){
    var lay = body.querySelector('.rb-flayer' + tdSel(tdRbSideOf(b), 'data-seat'));
    if(!lay) return;
    ((b.zones && b.zones.field) || []).forEach(function(it){
      if(it.auto === false || !tdIsRoot(it) || !L.at[it.uid]) return;
      var el = lay.querySelector('.td-card' + tdSel(it.uid));
      if(!el) return;
      var g = el.parentNode;
      var target = (g && g.classList && g.classList.contains('td-group')) ? g : el;
      target.style.left = L.at[it.uid].x + '%';
      target.style.top = L.at[it.uid].y + '%';
    });
  });
}

/* The Field must also fit its own columns: centred in them, a wider one spills over the panel and off the right edge. */
var _rbFit = {cw:TD_CW_MAX, two:false, key:''};
function tdRbFit(host){
  var b = host || document.getElementById('tdBoard');
  var tb = b ? b.querySelector(':scope > .rb-table') : null;
  if(!tb || !b.offsetWidth) return _rbFit.cw;
  var room = tdFitRoom(b);
  var mineEl = tb.querySelector('.rb-mine');
  var panel = tb.querySelector(':scope .td-play');
  var fld = tb.querySelector(':scope > .rb-field');
  var mode = function(two){
    tb.classList.toggle('rb-play2', !!two);
    if(mineEl) mineEl.classList.toggle('td-play2', !!two);
  };
  var wide = function(){
    if(b.scrollWidth > b.clientWidth + 2) return false;
    if(!fld) return true;
    var cs = getComputedStyle(tb);
    var area = tb.clientWidth - (parseFloat(cs.paddingLeft) || 0) - (parseFloat(cs.paddingRight) || 0)
      - (panel ? panel.offsetWidth + (parseFloat(cs.columnGap) || 0) : 0);
    return fld.offsetWidth <= area + 1;
  };
  var fits = function(cw){
    b.style.setProperty('--td-cw', cw + 'px');
    return b.scrollHeight <= room && wide();
  };
  var key = window.innerWidth + 'x' + window.innerHeight + ':rb:'
    + tb.querySelectorAll('.rb-other').length + ':' + (mineEl ? 'p' : 's')
    + ':' + ((TD.board && !TD.watching && TD.board.role) || '');
  var F = _rbFit;
  if(F.key === key){
    mode(F.two);
    tdSmallCards(b, F.cw);
    if(fits(F.cw) && (F.cw >= TD_CW_MAX || !fits(F.cw + 1))){
      b.style.setProperty('--td-cw', F.cw + 'px');
      return F.cw;
    }
  }
  var best = function(two){
    mode(two);
    if(fits(TD_CW_MAX)) return TD_CW_MAX;
    if(!fits(TD_CW_MIN)) return 0;
    var lo = TD_CW_MIN, hi = TD_CW_MAX;
    while(hi - lo > 1){ var mid = (lo + hi) >> 1; if(fits(mid)) lo = mid; else hi = mid; }
    return lo;
  };
  var one = best(false);
  var two = (mineEl && one < TD_CW_MAX) ? best(true) : 0;
  var useTwo = !!mineEl && two > one;
  /* Nothing fits: the page scrolls. Two columns only if the Field still fits beside them, as it does not narrow like the main game's. */
  if(!one && !two && mineEl){
    mode(true);
    b.style.setProperty('--td-cw', TD_CW_MIN + 'px');
    useTwo = wide();
  }
  var cw = (useTwo ? two : one) || TD_CW_MIN;
  mode(useTwo);
  b.style.setProperty('--td-cw', cw + 'px');
  _rbFit = {cw:cw, two:useTwo, key:key};
  tdSmallCards(b, cw);
  return cw;
}
window.tdRbFit = tdRbFit;

/* Cursors only over the Field, as a fraction of it (HANDOFF §84.3). */
function tdRbPointerAt(x, y){
  var hit = document.elementFromPoint(x, y);
  var body = (hit && hit.closest) ? hit.closest('#tdBoard .rb-field > .td-zbody') : null;
  if(!body) return null;
  /* Measured on the map's pan, which the zoom scales and moves, so the fraction holds at any zoom. */
  var pan = body.querySelector(':scope > .td-gpan') || body;
  var r = pan.getBoundingClientRect();
  if(!r.width || !r.height) return null;
  var r4 = function(n){ return Math.round(Math.max(0, Math.min(1, n)) * 1e4) / 1e4; };
  return {seat:'', zone:'field', fx:r4((x - r.left) / r.width), fy:r4((y - r.top) / r.height)};
}
function tdRbPointerPoint(p){
  if(!p || p.zone !== 'field' || p.seat) return null;
  var body = document.querySelector('#tdBoard .rb-field > .td-zbody');
  var pan = body ? (body.querySelector(':scope > .td-gpan') || body) : null;
  var r = pan ? pan.getBoundingClientRect() : null;
  if(!r || !r.width || !r.height) return null;
  var pt = {x:r.left + (+p.fx || 0) * r.width, y:r.top + (+p.fy || 0) * r.height};
  if(pan !== body){
    var br = body.getBoundingClientRect();
    if(pt.x < br.left - 1 || pt.x > br.right + 1 || pt.y < br.top - 1 || pt.y > br.bottom + 1) return null;
  }
  return pt;
}
window.tdRbPointerAt = tdRbPointerAt;
window.tdRbPointerPoint = tdRbPointerPoint;

function tdRbFoeCardOf(el){
  var lay = (el && el.closest) ? el.closest('.rb-flayer') : null;
  if(!lay || lay.getAttribute('data-side') !== 'foe') return null;
  var card = el.closest('.td-card[data-uid]');
  var seat = lay.getAttribute('data-seat'), foe = tdFoeOf(seat);
  var at = (card && foe) ? tdFindIn(foe, card.dataset.uid) : null;
  return (at && at.zone === 'field') ? {el:card, seat:seat, foe:foe, uid:card.dataset.uid, item:at.item} : null;
}
function tdRbFoeFieldItem(uid){
  var sides = tdFoeSides();
  for(var i = 0; i < sides.length; i++){
    var at = tdFindIn(tdFoeOf(sides[i]), uid);
    if(at && at.zone === 'field') return {seat:sides[i], at:at};
  }
  return null;
}
/* tdBindDrag asks this first and stops when it answers true. */
function tdRbPointerDown(ev, boardEl){
  if(!tdRbOn()) return false;
  var hit = tdRbFoeCardOf(ev.target);
  if(!hit) return false;
  ev.preventDefault();
  if(_tdTokConnectFrom){ tdTokenConnectTo(hit.uid); return true; }
  if(_tdConnectFrom){
    tdCancelConnect();
    if(typeof toast === 'function') toast('A card can only be attached under one of your own');
    return true;
  }
  if(ev.ctrlKey || ev.metaKey) return true;
  if(ev.shiftKey){
    if(typeof tblOn === 'function' && tblOn()){
      _tdArrowFrom = hit.uid;
      boardEl.classList.add('td-arrowing');
      try{ boardEl.setPointerCapture(ev.pointerId); }catch(_){}
    }
    return true;
  }
  var card = hit.el, r = card.getBoundingClientRect();
  var w = card.offsetWidth || r.width, h = card.offsetHeight || r.height;
  var gx = r.left + r.width / 2 - w / 2, gy = r.top + r.height / 2 - h / 2;
  /* endDrag hands a drag with `foe` set to tdRbFoeDrop. */
  _tdDrag = {uid:hit.uid, from:'field', el:card, dx:ev.clientX - gx, dy:ev.clientY - gy,
             w:w, h:h, moved:false, locked:!!hit.item.locked, lastX:null, lean:0, settle:null,
             foe:hit.seat};
  var ghost = card.cloneNode(true);
  ghost.className = 'td-card td-ghost' + (hit.item.locked ? ' locked' : '');
  ghost.style.width = w + 'px'; ghost.style.height = h + 'px';
  ghost.style.left = gx + 'px'; ghost.style.top = gy + 'px';
  document.body.appendChild(ghost);
  _tdDrag.ghost = ghost;
  card.classList.add('td-dragging');
  try{ card.setPointerCapture(ev.pointerId); }catch(_){}
  return true;
}
/* Drawn where it was put at once; the owner's own move then puts it there for real. */
function tdRbFoeDrop(d, ev){
  var el = document.elementFromPoint(ev.clientX, ev.clientY);
  var fld = (el && el.closest) ? el.closest('#tdBoard .rb-field') : null;
  var foe = tdFoeOf(d.foe), at = foe ? tdFindIn(foe, d.uid) : null;
  if(!fld || !at || at.zone !== 'field'){
    if(typeof toast === 'function')
      toast("Someone else's card can only be moved on the Field — its menu sends it to its owner's Grave");
    tdRender();
    return;
  }
  var p = tdPctIn(fld.querySelector(':scope > .td-zbody'), ev.clientX - d.dx, ev.clientY - d.dy, d.w, d.h);
  var x = Math.round(p.x * 100) / 100, y = Math.round(p.y * 100) / 100;
  if(tdRbAsk(d.foe, {op:'move', uid:d.uid, x:x, y:y}))
    tdApplyTo(foe, {t:'move', uid:d.uid, to:'field', x:x, y:y, auto:false});
  tdRender();
}
/* True when it answered: tdBindMenu then draws nothing else. */
function tdRbFoeMenu(ev){
  if(!tdRbOn()) return false;
  var lay = (ev.target && ev.target.closest) ? ev.target.closest('.rb-flayer') : null;
  if(!lay || lay.getAttribute('data-side') !== 'foe') return false;
  var seat = lay.getAttribute('data-seat'), foe = tdFoeOf(seat);
  if(!foe) return false;
  ev.preventDefault();
  var whose = (foe.name || tblSeatName(seat)) + "'s";
  var ask = function(req){ return function(){ tdCloseMenu(); tdRbAsk(seat, req); }; };
  var rows = [];
  var tok = ev.target.closest('.td-token');
  if(tok){
    var tid = tok.dataset.tok;
    var t = ((foe.tokens || []).filter(function(x){ return x.uid === tid; }))[0];
    if(!t){ tdCloseMenu(); return true; }
    var v = tdNum(t.value);
    if(t.kind === 'plus' || t.kind === 'minus'){
      var sg = (t.kind === 'plus') ? 1 : -1;
      rows.push({label:sg > 0 ? '+1' : '−1', name:(sg > 0 ? '+1 to' : '−1 to') + ' this counter',
                 act:ask({op:'tokset', tok:tid, value:v + sg})});
      rows.push({label:sg > 0 ? '− 1' : '+1', hint:'correct it',
                 name:(sg > 0 ? '− 1 from' : '+1 back on') + ' this counter, to correct it',
                 act:ask({op:'tokset', tok:tid, value:v - sg})});
      rows.push({sep:true});
    }
    rows.push({label:'Delete', act:ask({op:'tokdel', tok:tid})});
    tdShowMenu(tdTokenTitle(t) + ' — ' + whose, rows, '', ev.clientX, ev.clientY);
    return true;
  }
  var hit = tdRbFoeCardOf(ev.target);
  if(!hit){ tdCloseMenu(); return true; }
  var it = hit.item, uid = hit.uid;
  rows.push(it.locked ? {label:'Unlock', act:ask({op:'lock', uid:uid, on:false})}
                      : {label:'Lock', act:ask({op:'lock', uid:uid, on:true})});
  rows.push(it.down ? {label:'Turn face up', act:ask({op:'face', uid:uid, down:false})}
                    : {label:'Turn face down', act:ask({op:'face', uid:uid, down:true})});
  if(typeof tdGfFoeLabelRow === 'function'){
    var flr = tdGfFoeLabelRow(it, uid, seat);
    if(flr) rows.push(flr);
  }
  if(typeof tdDmgRows === 'function'){
    var dmr = tdDmgRows(it, 'field', uid, seat);
    if(dmr) rows.push.apply(rows, dmr);
  }
  rows.push({sep:true});
  rows.push({label:it.dm ? "Send to the DM's Grave" : ('Send to ' + whose + ' Grave'),
             act:ask({op:'grave', uid:uid})});
  tdShowMenu(((it.card && !it.anon) ? it.card.name : 'Face-down card') + ' — ' + whose,
             rows, '', ev.clientX, ev.clientY);
  return true;
}
function tdRbTokenOnto(t, cardUid){
  if(!tdRbOn() || !t) return false;
  var hit = tdRbFoeFieldItem(cardUid);
  if(!hit) return false;
  if(tdRbAsk(hit.seat, {op:'tok', uid:cardUid, kind:t.kind, name:t.name || '', value:tdNum(t.value)})){
    tdDo({t:'tokDel', uid:t.uid});
    tdRender();
  }
  return true;
}
function tdRbAsk(seat, req){
  var s = (typeof TBL !== 'undefined' && TBL.seats) ? TBL.seats[seat] : null;
  if(!s || !s.id || typeof tblOn !== 'function' || !tblOn()){
    if(typeof toast === 'function') toast('Not sent — you are not connected to the table');
    return false;
  }
  req.t = 'fld'; req.to = s.id;
  tblSend(req);
  return true;
}

/* Only what the rules allow, and only on the Field: a card that has left it since is left alone (HANDOFF §84.3). */
function tdRbFieldReq(m, fromId){
  if(!TD.board || TD.watching || !tdRbOn()) return;
  var by = tblSideOf(fromId);
  if(!by || by === TD.side) return;
  var at = m.uid ? tdFind(m.uid) : null;
  var onField = !!(at && at.zone === 'field');
  var ta = m.tok ? tdTokenFind(m.tok) : null;
  var tokOk = !!(ta && (!ta.token.on || ((tdFind(ta.token.on) || {}).zone === 'field')));
  var done = false;
  tdRbAsBy(by, function(){
    switch(m.op){
      case 'move':
        if(onField) done = tdMove(m.uid, 'field', {x:m.x, y:m.y, placed:true});
        break;
      case 'lock':
        if(onField && !!at.item.locked !== !!m.on) done = !!tdDo({t:'lock', uid:m.uid, on:!!m.on});
        break;
      case 'face':
        if(onField && !!at.item.down !== !!m.down)
          done = !!tdDo({t:'face', uid:m.uid, down:!!m.down,
                         n:m.down ? '' : (at.item.card ? at.item.card.name : '')});
        break;
      case 'grave':
        if(onField && tdCanGo(at.item, at.item.dm ? 'dmgrave' : 'grave', 'field')) done = tdMove(m.uid, 'grave');
        break;
      case 'tok':
        if(onField) done = !!tdDo({t:'tokAdd', uid:tdUid('tk'), kind:m.kind, name:m.name || '',
                                   value:m.value, on:m.uid});
        break;
      case 'tokset':
        if(tokOk) done = !!tdDo({t:'tokSet', uid:m.tok, value:m.value});
        break;
      case 'tokdel':
        if(tokOk) done = !!tdDo({t:'tokDel', uid:m.tok});
        break;
      default:
        if(typeof tdGfReq === 'function') done = tdGfReq(m, by);
        break;
    }
  });
  if(done) tdRender();
}
window.tdRbFieldReq = tdRbFieldReq;
function tdRbAsBy(by, fn){
  var last = TD.feed[TD.feed.length - 1];
  TBL._by = by;
  try{ fn(); } finally { TBL._by = ''; }
  var name = tblSeatName(by);
  for(var i = TD.feed.length - 1; i >= 0 && TD.feed[i] !== last; i--){
    var en = TD.feed[i];
    if(en.who !== 'me') continue;
    en.who = 'them'; en.name = name; en.line += ' (yours)';
  }
  tdRenderFeed();
}

function tdRbChipStatsHTML(b){
  if(!b) return '';
  if(tdRbDmOnly(b)) return "<span class='tbl-cs rb-cdm'>DM</span>";
  var dmTag = (b.role === 'dmp') ? "<span class='tbl-cs rb-cdm'>DM</span>" : '';
  var c = b.counters || {}, words = {atk:'ATK', hp:'HP', mp:'MP'};
  /* a damaged Character card's HP left, in place of the HP counter (Q27, cat_rbplay.js) */
  var chp = (typeof tdDmgCharHp === 'function') ? tdDmgCharHp(b) : null;
  if(chp != null){ c = Object.assign({}, c); c.hp = chp; }
  var orbs = (typeof window.edOrbSvg === 'function') ? ['atk', 'hp', 'mp'].filter(function(k){
    return c[k] != null;
  }).map(function(k){
    return "<span class='rb-corb' title='" + words[k] + ' ' + e(String(c[k])) + "'>"
      + window.edOrbSvg(TD_STAT_ORB[k], String(c[k]), 24) + "</span>";
  }).join('') : '';
  var lv = tdLevelLetters(b.lvl);
  var lvl = lv.length ? "<span class='rb-clvl' title='" + e('LVL ' + lv.join('')) + "'>"
    + lv.map(function(L){
        var n = TD_LVL_COLOR[L];
        return tdColorMana(n.charAt(0).toUpperCase() + n.slice(1));
      }).join('') + "</span>" : '';
  return dmTag + ((orbs || lvl) ? "<span class='tbl-cs rb-cstats'>" + orbs + lvl + "</span>" : '');
}
window.tdRbChipStatsHTML = tdRbChipStatsHTML;
