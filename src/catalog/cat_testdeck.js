/* The board reads the deck textareas, not a saved record: loading a saved deck copies its text, and the copy is then
   unrelated. The game in play is kept in localStorage and offered back by Resume. */

/* pile: one face-down card for the whole deck (Search and Look at top look inside); stack: face up, edges peeking;
   fan: the hand; free: where put. The Lord's cards live in board.zones.lord, drawn as a coin (tdLordCoinHTML). */
/* label is what the zone is called in the feed, toasts and titles; short is what its rail paints. Only the three
   decks carry one. */
var TD_ZONES_MAIN = [
  {id:'deck',    label:'Main Deck',     short:'Deck',     kind:'pile',  from:'main'},
  {id:'essdeck', label:'Essence Deck',  short:'Essence',  kind:'pile',  from:'essence'},
  {id:'wish',    label:'Wish Deck',     short:'Wish',     kind:'pile',  from:'wish'},
  {id:'grave',   label:'Grave',         kind:'stack'},
  {id:'susp',    label:'Suspended',     kind:'stack'},
  {id:'banish',  label:'Banished',      kind:'stack'},
  {id:'field',   label:'Field',         kind:'free'},
  {id:'essarea', label:'Essence',       kind:'free'},
  {id:'hand',    label:'Hand',          kind:'fan'}
];
/* Rebirth's own board. gear is the Armament at the hand area's right end: its own zone, drawn inside the hand's area
   (inHand). The three DM zones are on every Rebirth board, drawn only on the DM's screen (tblHiddenZone). */
var TD_ZONES_REBIRTH = [
  {id:'deck',    label:'Main Deck',     short:'Deck',     kind:'pile',  from:'main'},
  {id:'grave',   label:'Grave',         kind:'stack'},
  {id:'field',   label:'Field',         kind:'free'},
  {id:'essarea', label:'Essence',       kind:'free'},
  {id:'hand',    label:'Hand',          kind:'fan'},
  {id:'gear',    label:'Armament',      kind:'fan',   from:'armament', inHand:true},
  {id:'dmdeck',  label:'DM Deck',       short:'DM Deck',  kind:'pile',  dm:true},
  {id:'dmrow',   label:'Drawn cards',   short:'Drawn',    kind:'fan',   dm:true},
  {id:'dmgrave', label:'DM Grave',      short:'DM Grave', kind:'stack', dm:true}
];
/* Not the hand area's Armament (drawn with the hand), nor the DM's three (cat_rbtable.js). */
function tdZoneInHalf(z){ return !!z && !z.inHand && !z.dm; }
/* No deck: tdRewPool reads the pool off the deck list, and no from is set, so the board starts empty. */
var TD_ZONES_ENCOUNTER = [
  {id:'grave',   label:'Grave', kind:'stack'},
  {id:'field',   label:'Field', kind:'free'}
];
function tdZones(){
  if(tdIsEncounter()) return TD_ZONES_ENCOUNTER;
  return REBIRTH ? TD_ZONES_REBIRTH : TD_ZONES_MAIN;
}

/* Kingdoms only: no Lord slot, coin or pulled card anywhere else, Rebirth included. */
function tdHasLord(){ return !REBIRTH && _gameMode === 'kingdoms'; }
/* The zones with data, the Lord's slot included: walk board.zones with this, draw the grid with tdZones(). */
function tdDataZones(){
  var z = tdZones().slice();
  if(tdHasLord()) z.push({id:'lord', label:'Lord', kind:'lord'});
  return z;
}
/* Locking is a quarter turn on the table, so only the Field and the Essence area. */
var TD_LOCK_ZONES = {field:1, essarea:1};
/* Connect attaches a card beneath a permanent, and only the Field holds permanents. */
var TD_CONNECT_ZONES = {field:1};

/* Rebirth Character draws one card per Level letter instead (tdSeedCharacter). */
var TD_OPENING_DRAW = 7;

var TD = {board:null, seq:0, side:'a', log:[], logOn:false,
          /* How you are looking, keyed seat:zone: never serialized, logged or sent (tdCollapsed). */
          collapse:{},
          /* Every other half, by seat; foe is the one when there is exactly one (tdFoeSync). */
          foes:{}, foe:null};


/* Every piece id carries the side that minted it (your seat, from tdAdoptSide; 'a' alone or unprefixed): both
   machines count from zero, and an id is a key everywhere (tdFind, connectedTo, data-uid) (HANDOFF §10). */
function tdUid(kind){ return TD.side + '·' + kind + (++TD.seq); }
function tdUidSide(uid){
  var i = String(uid).indexOf('·');
  return i > 0 ? String(uid).slice(0, i) : 'a';
}
function tdSetSide(s){ TD.side = String(s || 'a'); }

/* An id comes from the save slot, a file or another player, so it is data: selectors go through tdSel (CSS.escape),
   attributes through e(), styles through tdNum, and never into an inline handler (HANDOFF §10). */
function tdCssEsc(v){
  v = String(v == null ? '' : v);
  if(window.CSS && typeof CSS.escape === 'function') return CSS.escape(v);
  return v.replace(/[^a-zA-Z0-9_ -￿-]/g, function(ch){
    return '\\' + ch.charCodeAt(0).toString(16) + ' ';
  });
}
function tdSel(id, attr){ return '[' + (attr || 'data-uid') + '="' + tdCssEsc(id) + '"]'; }
function tdNum(v, dflt){
  var n = Number(v);
  return (typeof v === 'number' || (typeof v === 'string' && v.trim() !== '')) && isFinite(n)
    ? n : (dflt == null ? 0 : dflt);
}
window.tdSel = tdSel;


/* "Step" and "phase" are never printed. Each game has its own turn, and tdSteps() alone knows which is on screen
   (HANDOFF §54.7); the step ids are shared on purpose, so everything keyed on a step works for both. */
var TD_STEPS_MAIN = [
  {id:'main', label:'Main', phases:[
    {id:'unlock', label:'Unlock', toggle:'unlock'},
    {id:'onset',  label:'Onset'},
    {id:'draw',   label:'Draw', toggle:'draw'},
    {id:'key',    label:'Key'}]},
  {id:'battle', label:'Battle', phases:[
    {id:'start',  label:'Start'},
    {id:'attack', label:'Declare Attackers'},
    {id:'block',  label:'Declare Blockers'},
    {id:'damage', label:'Battle Damage'},
    {id:'offset', label:'Offset'}]}
];
var TD_STEPS_REBIRTH = [
  TD_STEPS_MAIN[0],
  {id:'battle', label:'Battle', phases:[
    {id:'battle', label:'Battle'}]}
];
function tdSteps(){ return REBIRTH ? TD_STEPS_REBIRTH : TD_STEPS_MAIN; }
function tdStepDef(id){
  var steps = tdSteps();
  for(var i = 0; i < steps.length; i++)
    if(steps[i].id === id) return steps[i];
  return steps[0];
}
/* Every field defaulted, so a board saved before the turn existed opens at Main / Unlock. */
function tdTurnOf(b){
  var t = (b && b.turn) || {};
  var step = (t.step === 'battle') ? 'battle' : 'main';
  var def = tdStepDef(step);
  var ph = parseInt(t.phase, 10);
  if(!(ph >= 0 && ph < def.phases.length)) ph = 0;
  return {step:step, phase:ph, n:(parseInt(t.n, 10) > 0 ? parseInt(t.n, 10) : 1)};
}
/* No turn on a pool page (a catalogue) or for a spectator (no half); Rebirth has its own (tdSteps, HANDOFF §54.7). */
function tdTurnOn(){
  return !!TD.board && !TD.watching && !tdIsPool();
}

/* The two automatics are a preference in localStorage, per game, not board state: undo would revert them and the
   board is sent. Both default on, and unreadable storage reads as on. */
function tdAutoKey(k){ return 'conjure_td_auto_' + (REBIRTH ? 'rb_' : '') + k; }
function tdAutoGet(k){
  try{ return localStorage.getItem(tdAutoKey(k)) !== '0'; }catch(_){ return true; }
}
function tdAutoSet(k, on){
  try{ localStorage.setItem(tdAutoKey(k), on ? '1' : '0'); }catch(_){}
}
window.tdAutoToggle = function(k){
  tdAutoSet(k, !tdAutoGet(k));
  tdRenderTurn();
};


/* An action records what happened, never what to do: the side that acts decides (an order, the card that left), so
   every machine and every replay lands the same. Entry 0 is the whole starting board. */

var TD_ACT = {};        /* type -> function(board, action): the one place an action's effect is written, for play and replay alike */

function tdLogReset(){
  TD.log = TD.board ? [{t:'init', seq:TD.seq, board:tdSerialize()}] : [];
  TD.logOn = !!TD.board;
  TD.undoFloor = 0;                /* see tdUndoFloorHere */
  TD.undoWhy = '';
  /* Passes die with the old game: both are keyed by a position a new game starts over from. */
  TD.passers = null; TD.skip = null;
}

/* Every change to the board goes through here, so the log, the feed and the table miss nothing. */
function tdDo(a){
  if(!TD.board) return null;
  /* A spectator moves nothing: a shuffle seen only on their own screen would look shared and not be. */
  if(TD.watching) return null;
  var fn = TD_ACT[a.t];
  if(!fn) return null;
  /* Where the card was, read before the action is applied: redaction depends on whether it started somewhere they could
     see. */
  var before = null, beforeName = null, beforeLab = '';
  if(a.uid){
    var at = tdFindIn(TD.board, a.uid);
    if(at){ before = at.zone;
            beforeName = at.item.card ? at.item.card.name : null;
            beforeLab = at.item.lab || ''; }
  }
  if(typeof tdFxBefore === 'function') tdFxBefore(TD.board, a, before);
  fn(TD.board, a);
  if(TD.logOn) TD.log.push(a);
  /* The record is written here, not at each call site, so no action can forget to say what it did. */
  tdFeedPush('me', tdActionWords(a, TD.board, before, beforeName));
  /* Effects play only here and in tblActFrom: a replay, an undo or a resync comes through neither. */
  if(typeof tdFxAction === 'function') tdFxAction(TD.board, a, before);
  if(typeof tblOnAction === 'function'){
    try{ tblOnAction(a, before); }catch(_){}
  }
  /* A card gone to its Grave takes its tokens off the map, as its owner's next action (cat_rbgrid.js). */
  if(typeof tdGfAfterAct === 'function') tdGfAfterAct(a, before, beforeLab);
  /* Every action, so the saved position is never more than one move stale. */
  tdSaveSoon();
  return a;
}

/* Without logging: the receive and replay paths. */
function tdApply(a){ return tdApplyTo(TD.board, a); }
/* What arrives from another player is applied to their half in TD.foes (tblActFrom), never to your board. */
function tdApplyTo(board, a){
  var fn = TD_ACT[a && a.t];
  if(!fn || !board) return false;
  fn(board, a);
  return true;
}

/* upTo: how many actions after the initial board to apply; all when left out. */
function tdReplay(log, upTo){
  log = log || TD.log;
  if(!log.length || log[0].t !== 'init') return false;
  var board = tdHydrate(log[0].board);
  if(!board) return false;
  if(!board.zshow){ var zs = tdZShowFrom(log[0].board); if(zs) board.zshow = zs; }
  TD.board = board;
  var end = (upTo == null) ? log.length - 1 : Math.max(0, Math.min(upTo, log.length - 1));
  for(var i = 1; i <= end; i++) tdApply(log[i]);
  return true;
}

/* Undo replays to one short of the end and drops the tail: there are no inverses to get wrong. */
/* soon: drawn by tdRenderSoon, for Undo held down. */
function tdUndo(soon){
  if(!tdCanUndo()){
    if(TD.logOn && TD.log.length > 1 && typeof toast === 'function')
      toast((TD.undoWhy || 'The turn has been handed on') + ' - Undo stops there');
    return false;
  }
  /* Tokens that went with a card to its Grave (tdGfAfterAct) come back with it: one press of Undo. */
  var n = 1, L = TD.log.length, last = TD.log[L - 1], prev = TD.log[L - 2];
  if(last && last.t === 'gdel' && last.grave && prev && prev.t === 'move'
     && L - 2 >= (TD.undoFloor || 1)) n = 2;
  /* A Rewards card the DM gave is asked back first, and not undone when it cannot be (cat_rbdm.js). */
  if(typeof tdDmUndoGive === 'function' && !tdDmUndoGive(last)) return false;
  var keep = TD.log.slice(0, L - n);
  var was = TD.logOn; TD.logOn = false;
  /* How far this board has heard the DM's map changes stays, so none is heard twice (cat_rbgrid.js). */
  var gts = TD.board ? TD.board.gtseen : null;
  tdReplay(keep);
  if(gts != null && TD.board && !(TD.board.gtseen >= gts)) TD.board.gtseen = gts;
  TD.logOn = was;
  TD.log = keep;
  if(soon === true) tdRenderSoon(); else tdRender();
  /* At a table an undo sends your whole half, as a reconnect gets it, since a replay reaches no tblOnAction; and it
     saves. */
  if(typeof tblOn === 'function' && tblOn()){
    try{
      if(typeof tblSendState === 'function') tblSendState();
      if(typeof tblLiveZones === 'function' && typeof tblPushShown === 'function')
        tblLiveZones().forEach(function(z){ tblPushShown(z); });
    }catch(_){}
  }
  tdSaveSoon();
  return true;
}
/* Undo takes back only what came after TD.undoFloor: past a turn handed on, or a gift the DM took back (why says
   which). */
function tdUndoFloorHere(why){ TD.undoFloor = (TD.log || []).length; TD.undoWhy = why || ''; }
function tdCanUndo(){
  return !!(TD.logOn && TD.log.length > 1 && TD.log.length - 1 >= (TD.undoFloor || 1));
}

/* One SVG over the board, redrawn from the card positions, so an arrow follows its cards; one whose card left is not
   drawn. */
function tdArrowLayer(){
  var host = document.getElementById('tdBoard');
  if(!host) return null;
  var lay = host.querySelector('.td-arrows');
  if(!lay){
    lay = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    lay.setAttribute('class', 'td-arrows');
    lay.innerHTML = "<defs>"
      + "<marker id='tdAh' viewBox='0 0 10 10' refX='9' refY='5' markerWidth='6'"
      + " markerHeight='6' orient='auto-start-reverse'>"
      + "<path d='M0,0 L10,5 L0,10 z' fill='currentColor'/></marker></defs>"
      + "<g class='td-arrow-g'></g>";
    host.appendChild(lay);
  }
  return lay;
}
function tdCardCentre(uid, boardRect){
  var el = document.querySelector('.td-card' + tdSel(uid));
  if(!el) return null;
  var r = el.getBoundingClientRect();
  if(!r.width) return null;
  return {x:r.left + r.width / 2 - boardRect.left,
          y:r.top + r.height / 2 - boardRect.top};
}
var TD_ARROW_MS = 7000;
function tdRenderArrows(){
  var lay = tdArrowLayer();
  if(!lay) return;
  var host = document.getElementById('tdBoard');
  var br = host.getBoundingClientRect();
  lay.setAttribute('viewBox', '0 0 ' + Math.max(1, host.scrollWidth)
    + ' ' + Math.max(1, host.scrollHeight));
  /* An arrow lasts seven seconds from when it arrived here; a timer drops it on time. */
  if(typeof TBL !== 'undefined' && TBL.arrows){
    var now = Date.now();
    TBL.arrows = TBL.arrows.filter(function(a){ return !a.at || now - a.at < TD_ARROW_MS; });
    clearTimeout(tdRenderArrows._t);
    var next = TBL.arrows.reduce(function(m, a){ return a.at ? Math.min(m, a.at + TD_ARROW_MS - now) : m; }, Infinity);
    if(next < Infinity) tdRenderArrows._t = setTimeout(tdRenderArrows, Math.max(30, next + 15));
  }
  var list = (typeof TBL !== 'undefined' && TBL.arrows) || [];
  var g = lay.querySelector('.td-arrow-g');
  g.innerHTML = list.map(function(a){
    var f = tdCardCentre(a.from, br), t = tdCardCentre(a.to, br);
    if(!f || !t) return '';                 /* a card that has left the table */
    return "<line class='td-arrow" + (a.by === TD.side ? ' mine' : ' theirs')
      + "' x1='" + f.x + "' y1='" + f.y + "' x2='" + t.x + "' y2='" + t.y
      + "' marker-end='url(#tdAh)'/>";
  }).join('');
  /* Block lines are drawn from the cards on every render, like the arrows; the pulse rejoins one shared clock
     (TD_PULSE_MS). */
  var bg = lay.querySelector('.td-block-g');
  if(!bg){ bg = document.createElementNS('http://www.w3.org/2000/svg', 'g'); bg.setAttribute('class', 'td-block-g'); lay.appendChild(bg); }
  var lag = -(Date.now() % TD_PULSE_MS) + 'ms';
  var halves = [TD.board].concat(tdFoeList());
  var lines = [];
  halves.forEach(function(h){
    ((h && h.zones && h.zones.field) || []).forEach(function(it){
      if(it.decl !== 'blk' || !it.blocks) return;
      var f = tdBlockAnchor(it.uid, br), t = tdBlockAnchor(it.blocks, br);
      if(!f || !t) return;
      lines.push("<line class='td-blockline' data-from='" + e(it.uid) + "' data-to='" + e(it.blocks)
        + "' style='animation-delay:" + lag + "' x1='" + f.x + "' y1='" + f.y
        + "' x2='" + t.x + "' y2='" + t.y + "'/>");
    });
  });
  bg.innerHTML = lines.join('');
}
var TD_PULSE_MS = 2600;
/* From the white diamond in the blocker's symbol to the attacker's; cat_boardfx.js moves the ends every frame, and
   this is where a render starts them, at the card's centre while there is no symbol. */
function tdBlockAnchor(uid, br){
  return (typeof tdFxAnchor === 'function') ? tdFxAnchor(uid, br) : tdCardCentre(uid, br);
}
/* A pointer is sent as what is under it (card, zone or half, and whose) and a fraction of that thing, as everybody
   sees their own half at the bottom (HANDOFF §76.9). */
function tdFrameFrac(el, x, y){
  var r = el.getBoundingClientRect();
  if(!r.width || !r.height) return null;
  var rot = tdRotOf(el);
  if(rot === 90) return {fx:(y - r.top) / r.height, fy:(r.right - x) / r.width};
  if(rot === -90) return {fx:(r.bottom - y) / r.height, fy:(x - r.left) / r.width};
  return {fx:(x - r.left) / r.width, fy:(y - r.top) / r.height};
}
function tdFramePoint(el, fx, fy){
  var r = el.getBoundingClientRect();
  if(!r.width || !r.height) return null;
  var rot = tdRotOf(el);
  if(rot === 90) return {x:r.right - fy * r.width, y:r.top + fx * r.height};
  if(rot === -90) return {x:r.left + fy * r.width, y:r.bottom - fx * r.height};
  return {x:r.left + fx * r.width, y:r.top + fy * r.height};
}
/* The body, which cards are placed in fractions of, or the zone while the body is folded. */
function tdZoneFrame(zone){
  var zb = zone && zone.querySelector('.td-zbody');
  return (zb && zb.offsetWidth && zb.offsetHeight) ? zb : zone;
}
window.tdZoneFrame = tdZoneFrame;
function tdPointerAt(x, y){
  /* At a Rebirth table, only over the shared Field. */
  if(typeof tdRbOn === 'function' && tdRbOn()) return tdRbPointerAt(x, y);
  var hit = document.elementFromPoint(x, y);
  var half = hit && hit.closest ? hit.closest('#tdBoard .td-half') : null;
  if(!half) return null;
  var r4 = function(n){ return Math.round(Math.max(-0.5, Math.min(1.5, n)) * 1e4) / 1e4; };
  var at = {seat:half.getAttribute('data-seat') || ''};
  var zone = hit.closest('.td-zone');
  var zf = tdFrameFrac(zone ? tdZoneFrame(zone) : half, x, y);
  if(!zf) return null;
  at.zone = zone ? zone.getAttribute('data-zone') : '';
  at.fx = r4(zf.fx); at.fy = r4(zf.fy);
  var card = hit.closest('.td-card[data-uid]');
  var cf = card ? tdFrameFrac(card, x, y) : null;
  if(cf){ at.uid = card.getAttribute('data-uid'); at.ux = r4(cf.fx); at.uy = r4(cf.fy); }
  return at;
}
window.tdPointerAt = tdPointerAt;
/* The card if it is drawn here (their hand is backs, so the zone), else the zone, else the half. */
function tdPointerPoint(p){
  var host = document.getElementById('tdBoard');
  if(!host || !p) return null;
  if(typeof tdRbOn === 'function' && tdRbOn()) return tdRbPointerPoint(p);
  /* A card there but not shown (a compact half's folded Grave) has no size, so its zone takes the cursor. */
  if(p.uid){
    var card = host.querySelector('.td-card' + tdSel(p.uid));
    var onCard = card ? tdFramePoint(card, +p.ux || 0, +p.uy || 0) : null;
    if(onCard) return onCard;
  }
  var half = host.querySelector('.td-half' + tdSel(p.seat || '', 'data-seat'));
  if(!half) return null;
  var zone = p.zone ? half.querySelector('.td-zone' + tdSel(p.zone, 'data-zone')) : null;
  return tdFramePoint(zone ? tdZoneFrame(zone) : half, +p.fx || 0, +p.fy || 0);
}
window.tdPointerPoint = tdPointerPoint;
var TD_PTR_MS = 4000;
function tdRenderPointer(){
  var host = document.getElementById('tdBoard');
  if(!host) return;
  var all = (typeof TBL !== 'undefined' && TBL.ptrs) || {};
  var hr = host.getBoundingClientRect(), now = Date.now(), seen = {};
  Object.keys(all).forEach(function(from){
    var p = all[from];
    if(!p || p.off || now - p.at > TD_PTR_MS) return;
    var pt = tdPointerPoint(p);
    if(!pt) return;
    seen[from] = 1;
    var el = host.querySelector('.td-peerptr' + tdSel(from, 'data-from'));
    if(!el){
      el = document.createElement('div');
      el.className = 'td-peerptr';
      el.setAttribute('data-from', from);
      el.innerHTML = "<span></span>";
      host.appendChild(el);
    }
    el.style.setProperty('--ptr', 'var(--seat-' + String(from).replace(/[^a-z0-9_-]/gi, '') + ', var(--ac))');
    el.querySelector('span').textContent = (typeof tblSeatName === 'function') ? tblSeatName(from) : '';
    el.style.left = Math.round(pt.x - hr.left) + 'px';
    el.style.top  = Math.round(pt.y - hr.top) + 'px';
  });
  [].forEach.call(host.querySelectorAll('.td-peerptr'), function(el){
    if(!seen[el.getAttribute('data-from')]) el.remove();
  });
  if(typeof tdGfOverSoon === 'function') tdGfOverSoon();
}


TD.feed = [];
var TD_FEED_MAX = 400;

/* Consecutive draws by one player with nothing between are one line; the count lives on the entry, never parsed back
   out of the wording. */
function tdFeedPush(who, line){
  if(!line) return;
  var last = TD.feed[TD.feed.length - 1];
  if(line === 'drew a card' && last && last.who === (who || '') && last.drew){
    last.drew++;
    last.line = 'drew ' + last.drew + ' cards';
    tdRenderFeed();
    return;
  }
  TD.feed.push({who:who || '', line:line, n:TD.feed.length,
                drew:(line === 'drew a card' ? 1 : 0)});
  while(TD.feed.length > TD_FEED_MAX) TD.feed.shift();
  tdRenderFeed();
}

function tdZoneWords(id){
  var z = tdZoneById(id);
  return z ? z.label : id;
}
function tdZoneTitle(z){ return (z && (z.short || z.label)) || ''; }
function tdCardWords(uid, board){
  var at = tdFindIn(board || TD.board, uid);
  if(at && at.item.card && !at.item.anon) return at.item.card.name;
  return 'a card';
}

/* Read before the action is applied: after it, a moved card is gone from where it was. */
function tdActionWords(a, board, before, beforeName){
  if(!a) return '';
  /* Another player's Crystallize arrives as its two moves (tblRedact): the card's says it, the Essence's nothing. */
  if(a.fx === 'crystal' && (a.t === 'move' || a.t === 'appear')){
    if((a.zone || a.to) !== 'susp') return '';
    return (a.n || beforeName || tdCardWords(a.uid, board))
      + ' crystallized — ' + (a.color || 'a') + ' core to the Essence area';
  }
  switch(a.t){
    case 'move':
      /* Not where it landed but whether it went anywhere: a slide within a zone is still logged, undoable and sent, with
         no line. */
      if(before && before === a.to) return '';
      if(before === 'deck' && a.to === 'hand') return 'drew a card';
      if(before === 'hand' && a.to !== 'hand'){
        /* Your line names the card and that it went face down; theirs, from the redacted appear, says neither. */
        var down = tdFindIn(board, a.uid);
        return 'played ' + (beforeName || 'a card')
          + ((down && down.item.down) ? ' face down' : '')
          + ' to the ' + tdZoneWords(a.to);
      }
      return (beforeName || tdCardWords(a.uid, board)) + ' → ' + tdZoneWords(a.to);
    case 'pass':
      /* Named, not counted: three identical "passed" lines in a four-player Battle say nothing; the receiver stamps the
         name. */
      var _ps = tdStepDef(a.step), _pp = _ps.phases[a.phase] || _ps.phases[0];
      return 'passed ' + _ps.label + ' / ' + _pp.label;
    case 'phase':
      /* A step and a phase read differently, as they are different sizes of event. */
      var _st = tdStepDef(a.step), _ph = _st.phases[a.phase] || _st.phases[0];
      if(a.newTurn) return 'ended the turn - turn ' + tdTurnOf(board).n
        + ', ' + _st.label + ' / ' + _ph.label;
      if(a.stepped) return 'passed to ' + _st.label + ' / ' + _ph.label;
      return _st.label + ' / ' + _ph.label;
    case 'lockType':return (a.on ? 'locked' : 'unlocked')
      + ' every ' + (a.ctype || 'core') + ' in the Essence area';
    case 'crystal': return (beforeName || tdCardWords(a.uid, board))
      + ' crystallized — ' + (a.color || 'a') + ' core to the Essence area';
    case 'mkcopy':  return 'created a copy of ' + (a.n || 'a card')
      + ' in the ' + tdZoneWords(a.zone);
    case 'reveal':  return (a.on ? 'revealed ' : 'stopped revealing ')
      + (beforeName || tdCardWords(a.uid, board));
    case 'zshow':   return (a.mode === 'top'
        ? 'is playing with the top card of the ' + tdZoneWords(a.zone) + ' revealed'
        : a.mode ? 'revealed their ' + tdZoneWords(a.zone)
                 : 'stopped revealing their ' + tdZoneWords(a.zone));
    case 'order':   return 'shuffled the ' + tdZoneWords(a.zone);
    case 'lock':    return (a.on ? 'locked ' : 'unlocked ')
                           + (beforeName || tdCardWords(a.uid, board));
    case 'lockZone':return (a.on ? 'locked' : 'unlocked')
      + ' everything in the ' + tdZoneWords(a.zone);
    /* Silent: turning a card in your hand on the way to playing it face down is one act, and the move carries the line. */
    case 'face': {
      var fz = tdFindIn(board, a.uid);
      if(a.down && fz && typeof tblHiddenZone === 'function' && tblHiddenZone(fz.zone))
        return '';
      return a.down ? 'turned a card face down'
                    : ('turned ' + tdCardWords(a.uid, board) + ' face up');
    }
    case 'connect': return a.to ? 'attached ' + (beforeName || tdCardWords(a.uid, board))
                                  + ' under another card'
                                : 'detached ' + (beforeName || tdCardWords(a.uid, board));
    /* A Rewards card the DM gave you (the DM's own line is tdDmActionWords), and a card put on the Encounter page's
       Field. */
    /* A Reward the DM took: their own record has the give; everybody else's hears it here. */
    case 'spawn':   return a.gift ? (a.self ? (board === TD.board ? '' : 'took ' + (a.n || 'a card') + ' from the Rewards')
                                            : 'received ' + (a.n || 'a card') + ' from the DM')
                         : a.put ? 'put ' + (a.n || 'a card') + ' on the Field'
                         : (a.drawn ? 'drew ' + (a.n || 'a card') + ' for the Encounter'
                                    : 'duplicated ' + (a.n || 'a card'));
    case 'give': case 'ungift': case 'dmdeck': case 'map':
                    return (typeof tdDmActionWords === 'function') ? tdDmActionWords(a, board, before, beforeName) : '';
    case 'grid': case 'gpers': case 'gtok': case 'gmove': case 'gset': case 'gdel':
    case 'gtag': case 'label': case 'gicon':
                    return (typeof tdGfActionWords === 'function') ? tdGfActionWords(a, board, before, beforeName) : '';
    case 'tokAdd':  return 'put down a ' + (a.kind === 'kw' ? a.name
                             : a.kind === 'emblem' ? 'Emblem Copy'
                             : (a.value > 0 ? '+1' : '−1')) + ' counter';
    case 'tokSet':  return 'set a counter to ' + a.value;
    case 'tokMove': return a.on ? 'put a counter on a card' : a.slide ? '' : 'took a counter off';
    case 'tokDel':  return 'removed a counter';
    case 'ctr':     return (a.id === 'life' ? 'Life' : String(a.id).toUpperCase())
                           + ' → ' + a.value;
    case 'ctrReset':return 'reset the counters';
    case 'count':   return '';                 /* a number changed - not news */
    case 'appear':  return a.anon
      ? ('played a card face down to the ' + tdZoneWords(a.zone))
      : ('played ' + (a.n || 'a card') + ' to the ' + tdZoneWords(a.zone));
    case 'vanish':  return 'took ' + (beforeName || 'a card') + ' off the table';
    case 'declare': return a.role === 'atk' ? 'declared ' + (beforeName || tdCardWords(a.uid, board)) + ' as an attacker'
                         : a.role === 'thm' ? 'declared ' + (beforeName || tdCardWords(a.uid, board)) + ' as a Thaumaturge attacker'
                         : a.role === 'blk' ? 'declared ' + (beforeName || tdCardWords(a.uid, board)) + ' as a blocker'
                         : (beforeName || tdCardWords(a.uid, board)) + ' is no longer declared';
    case 'block':   return a.target ? (beforeName || tdCardWords(a.uid, board)) + ' blocks ' + tdCardAnywhere(a.target)
                                    : (beforeName || tdCardWords(a.uid, board)) + ' blocks nothing';
  }
  return '';
}
/* From whichever half holds it: a blocker's target is usually another player's. */
function tdCardAnywhere(uid){
  var halves = [TD.board].concat(tdFoeList());
  for(var i = 0; i < halves.length; i++){
    var at = halves[i] && tdFindIn(halves[i], uid);
    if(at && at.item.card && !at.item.anon) return at.item.card.name;
  }
  return 'a card';
}

/* The record floats over the board rather than beside it, so it costs the zones no width. Whether it is open is
   remembered. */
var TD_FEED_KEY = 'conjure_td_feed_open';
function tdFeedOpen(){
  try{ return localStorage.getItem(TD_FEED_KEY) !== '0'; }catch(_){ return true; }
}
window.tdToggleFeed = function(){
  var open = !tdFeedOpen();
  try{ localStorage.setItem(TD_FEED_KEY, open ? '1' : '0'); }catch(_){}
  tdRenderFeed();
};
/* The record and the chat are moved by their title bars and remembered in this browser. The listener is on the
   window and finds the bar under the pointer, so a bar redrawn mid-drag keeps the drag. */
var TD_WIN_KEY = 'conjure_td_win_';
function tdWinSaved(name){
  try{ return JSON.parse(localStorage.getItem(TD_WIN_KEY + name) || 'null'); }catch(_){ return null; }
}
function tdWinPlace(el, x, y){
  var w = el.offsetWidth || 280;
  var vw = document.documentElement.clientWidth, vh = window.innerHeight;
  x = Math.max(4, Math.min(x, vw - Math.min(w, vw - 8) - 4));
  y = Math.max(4, Math.min(y, vh - 40));
  el.style.left = Math.round(x) + 'px';
  el.style.top = Math.round(y) + 'px';
  el.style.right = 'auto'; el.style.bottom = 'auto';
  return {x:Math.round(x), y:Math.round(y)};
}
function tdWinDefault(el, name){
  var vw = document.documentElement.clientWidth, vh = window.innerHeight;
  var w = el.offsetWidth || 280, h = el.offsetHeight || 200;
  var bar = document.getElementById('tdTable');
  var top = bar ? bar.getBoundingClientRect().bottom : 160;
  /* On a Rebirth Field the record and the DM Tools go under the map's bar, clear of its tools (cat_rbgrid.js). */
  var gy = (name !== 'chat' && typeof tdGfBarBottom === 'function') ? tdGfBarBottom(vh) : 0;
  if(name === 'chat') return {x:vw - w - 18, y:Math.max(top + 10, vh - h - 24)};
  /* The DM Tools, left of the record and down on the Field, where a Reward is dragged to. */
  if(name === 'dm'){
    var fld = document.querySelector('#tdBoard .rb-field');
    var fy = fld ? fld.getBoundingClientRect().top + 8 : 0;
    return {x:Math.max(8, vw - w - 326), y:Math.max(8, top + 10, fy, gy)};
  }
  return {x:vw - w - 18, y:Math.max(8, top + 10, gy)};
}
function tdFloatWin(el, name){
  if(!el) return;
  var saved = tdWinSaved(name);
  /* Placed by the top row only while it is on screen: a deal draws the record before the waiting room closes. tdRender
     places it again. */
  var bar = document.getElementById('tdTable');
  el._tdBarLate = !saved && !!bar && !bar.getBoundingClientRect().height;
  var p = saved || tdWinDefault(el, name);
  tdWinPlace(el, p.x, p.y);
  if(el._tdWin) return;
  el._tdWin = name;
  el.addEventListener('pointerdown', function(ev){
    var head = ev.target.closest && ev.target.closest('.td-fw-head');
    if(!head || !el.contains(head) || ev.button !== 0) return;
    if(ev.target.closest('button, input, select, a, textarea')) return;
    ev.preventDefault();
    var r = el.getBoundingClientRect(), dx = ev.clientX - r.left, dy = ev.clientY - r.top;
    el.classList.add('td-fw-drag');
    try{ el.setPointerCapture(ev.pointerId); }catch(_){}
    function mv(e2){ tdWinPlace(el, e2.clientX - dx, e2.clientY - dy); }
    function up(e2){
      el.removeEventListener('pointermove', mv);
      el.removeEventListener('pointerup', up);
      el.removeEventListener('pointercancel', up);
      el.classList.remove('td-fw-drag');
      var q = tdWinPlace(el, e2.clientX - dx, e2.clientY - dy);
      try{ localStorage.setItem(TD_WIN_KEY + name, JSON.stringify(q)); }catch(_){}
    }
    el.addEventListener('pointermove', mv);
    el.addEventListener('pointerup', up);
    el.addEventListener('pointercancel', up);
  });
}
window.tdFloatWin = tdFloatWin;
/* a window the screen no longer reaches is brought back onto it */
(function(){
  if(window._tdWinBound) return;
  window._tdWinBound = true;
  window.addEventListener('resize', function(){
    ['tdFeed', 'tblChat', 'tdDmWin'].forEach(function(id){
      var el = document.getElementById(id);
      if(!el || el.hidden || !el._tdWin) return;
      var r = el.getBoundingClientRect();
      tdWinPlace(el, r.left, r.top);
    });
  });
})();
function tdRenderFeed(){
  var host = document.getElementById('tdFeed');
  if(!host) return;
  var open = tdFeedOpen();
  var btn = document.getElementById('tdLogBtn');
  if(btn){ btn.classList.toggle('on', open); btn.setAttribute('aria-pressed', open ? 'true' : 'false'); }
  host.hidden = !open;
  if(!open) return;
  var rows = TD.feed.slice(-120).map(function(f){
    return "<div class='td-fl" + (f.who === 'them' ? ' them' : '')
      + (f.who === 'say' ? ' say' : '') + "'>"
      + (f.name ? "<b>" + e(f.name) + "</b> " : '')
      + e(f.line) + "</div>";
  }).join('');
  /* The bar is built once and only the list redrawn, so a line landing mid-drag keeps the bar under the pointer. */
  var list = document.getElementById('tdFeedList');
  if(!list){
    host.innerHTML = "<div class='td-fw-head'><b class='td-fw-title'>Record Log</b>"
        + "<span class='tbl-gap'></span>"
        + "<button class='ed2-btn tiny close-x' onclick='tdToggleFeed()' title='Hide the record'>Close &#10005;</button>"
      + "</div>"
      + "<div class='td-feed-list' id='tdFeedList'></div>";
    list = document.getElementById('tdFeedList');
  }
  list.innerHTML = rows || "<i class='td-feed-none'>Nothing has happened yet.</i>";
  tdFloatWin(host, 'feed');
  list.scrollTop = list.scrollHeight;
}

/* Each one is a fact: nothing here calls Math.random, reads the DOM or asks the clock, so replay gives the same board. */

/* locked is cleared on leaving the Field or the Essence area, here in the action so a replay does it too. */
function tdClearLockOnLeave(item, toId){
  if(item && item.locked && !TD_LOCK_ZONES[toId]) delete item.locked;
  /* A declaration is about the Battle on the Field, so it ends when the card leaves the Field. */
  if(item && toId !== 'field'){ delete item.decl; delete item.blocks; }
}
TD_ACT.move = function(b, a){
  var at = tdFindIn(b, a.uid);
  if(!at) return;
  var to = b.zones[a.to];
  if(!to) return;
  tdClearLockOnLeave(at.item, a.to);
  if(at.zone !== a.to && b.tokens)
    b.tokens = b.tokens.filter(function(t){ return t.on !== a.uid; });
  /* A reveal is spent when the card moves; cleared here, not at the call site, so a replay does it too. */
  if(at.zone !== a.to) delete at.item.shown;
  /* And its label, unless it goes where a card lies open (tdGfKeepsLab, cat_rbgrid.js). */
  if(at.zone !== a.to && at.item.lab && typeof tdGfKeepsLab === 'function' && !tdGfKeepsLab(a.to))
    delete at.item.lab;
  /* A connection survives a move within its zone and is released by leaving it; the card itself always detaches from
     its own parent, which is how a connection is undone by hand. */
  var leaving = (at.zone !== a.to);
  if(leaving){
    b.zones[at.zone].forEach(function(k){
      if(k.connectedTo !== a.uid) return;
      delete k.connectedTo;
      if(k.x == null){ k.x = at.item.x == null ? 4 : at.item.x;
                       k.y = at.item.y == null ? 4 : at.item.y; }
    });
  }
  delete at.item.connectedTo;
  var item = b.zones[at.zone].splice(at.index, 1)[0];
  if(a.x != null){ item.x = a.x; item.y = a.y; item.auto = !!a.auto; }
  else { delete item.x; delete item.y; delete item.auto; }
  if(a.dk) item.dk = a.dk;
  /* a.at is the resolved index, rolled by the sender and never again here. */
  if(a.at != null) to.splice(Math.max(0, Math.min(to.length, a.at)), 0, item);
  else to.push(item);
};

/* An action, so it is logged, undoable and sent; the turn number moves only when the action says, not on a phase
   click. */
TD_ACT.phase = function(b, a){
  var was = tdTurnOf(b);
  b.turn = {step:(a.step === 'battle' ? 'battle' : 'main'),
            phase:(parseInt(a.phase, 10) || 0),
            n:(a.newTurn ? was.n + 1 : was.n)};
  /* Declarations end at Offset, or on leaving the Battle step, here in the action, so every half clears itself on
     every machine and on replay. */
  var now = tdTurnOf(b), def = tdStepDef(now.step), ph = def.phases[now.phase];
  if(now.step !== 'battle' || (ph && ph.id === 'offset')) tdClearDecl(b);
};
function tdClearDecl(b){
  ((b && b.zones && b.zones.field) || []).forEach(function(it){ delete it.decl; delete it.blocks; });
}

/* decl ('atk', 'thm' or 'blk') and a blocker's blocks (a uid, perhaps on another half) are board state on the card;
   each player declares only their own, both clear at Offset, and 'thm' is a choice (HANDOFF §61.1). */
function tdIsAttackDecl(d){ return d === 'atk' || d === 'thm'; }
TD_ACT.declare = function(b, a){
  var at = tdFindIn(b, a.uid);
  if(!at || at.zone !== 'field') return;
  if(a.role === 'atk' || a.role === 'thm' || a.role === 'blk') at.item.decl = a.role;
  else delete at.item.decl;
  if(at.item.decl !== 'blk') delete at.item.blocks;
};
TD_ACT.block = function(b, a){
  var at = tdFindIn(b, a.uid);
  if(!at || at.zone !== 'field') return;
  at.item.decl = 'blk';
  if(a.target) at.item.blocks = a.target; else delete at.item.blocks;
};

/* A pass moves nothing: it tells the others this seat is done (tdNotePass), and undo has nothing to put back. */
TD_ACT.pass = function(b, a){ tdNotePass(a); };

/* One act for every Core of a type, the type resolved on the receiving side from its cards, so a replay turns the
   right set. */
TD_ACT.lockType = function(b, a){
  tdCoresOfType(a.ctype, b).forEach(function(it){ it.locked = !!a.on; });
};

/* One action for both halves of crystallising, one line and one undo step; both uids travel, so a replay picks the
   same essence (across the table tblRedact still sends the moves, HANDOFF §61.5). */
TD_ACT.crystal = function(b, a){
  var at = tdFindIn(b, a.uid);
  if(at && b.zones.susp){
    if(b.tokens) b.tokens = b.tokens.filter(function(t){ return t.on !== a.uid; });
    b.zones[at.zone].forEach(function(k){
      if(k.connectedTo === a.uid) delete k.connectedTo;
    });
    delete at.item.connectedTo;
    tdClearLockOnLeave(at.item, 'susp');
    var item = b.zones[at.zone].splice(at.index, 1)[0];
    delete item.x; delete item.y; delete item.auto;
    b.zones.susp.push(item);
  }
  /* The essence is moved, not copied: a copy would be an unlimited supply. */
  var ess = tdFindIn(b, a.essUid);
  if(ess && b.zones.essarea){
    var card = b.zones[ess.zone].splice(ess.index, 1)[0];
    if(a.ex != null){ card.x = a.ex; card.y = a.ey; card.auto = true; }
    b.zones.essarea.push(card);
  }
};

TD_ACT.order = function(b, a){
  /* The order travels, so both sides land on the same one. */
  var z = b.zones[a.zone];
  if(!z) return;
  var by = {};
  z.forEach(function(i){ by[i.uid] = i; });
  var out = [];
  (a.order || []).forEach(function(u){ if(by[u]){ out.push(by[u]); delete by[u]; } });
  Object.keys(by).forEach(function(u){ out.push(by[u]); });  /* anything unnamed */
  b.zones[a.zone] = out;
};

TD_ACT.lock = function(b, a){
  var at = tdFindIn(b, a.uid);
  if(at) at.item.locked = !!a.on;
};
/* Face up, the name travels; face down, anon strips the card from the piece on their side, as a hand's are. Your
   own copy keeps its card. */
TD_ACT.face = function(b, a){
  var at = tdFindIn(b, a.uid);
  if(!at) return;
  var it = at.item;
  it.down = !!a.down;
  if(a.anon){ delete it.card; it.anon = true; delete it.lab; }
  if(a.n){
    var c = tdCardByName(a.n);
    if(c){ it.card = c; delete it.anon; }
  }
  /* A card's label comes with it when it is turned up at a table, as its name does (tblRedact). */
  if(a.lab && !it.anon) it.lab = a.lab;
};

TD_ACT.lockZone = function(b, a){
  (b.zones[a.zone] || []).forEach(function(i){ i.locked = !!a.on; });
};
TD_ACT.connect = function(b, a){
  var at = tdFindIn(b, a.uid);
  if(!at) return;
  if(a.to){
    at.item.connectedTo = a.to;
    /* An attached card is placed by its group, so it gives up its own spot. */
    delete at.item.x; delete at.item.y; delete at.item.auto;
  } else {
    delete at.item.connectedTo;
  }
};
TD_ACT.spawn = function(b, a){
  /* The uid was minted by the side that acted and travels with the action. */
  var z = b.zones[a.zone];
  if(!z) return;
  var card = tdCardByName(a.n);
  if(!card) return;
  var it = {uid:a.uid, card:card, locked:false};
  if(a.x != null){ it.x = a.x; it.y = a.y; it.auto = false; }
  if(a.dm) it.dm = true;          /* a copy of the DM's card is the DM's */
  if(a.gid) it.gid = a.gid;       /* the gift it came as (tdDmUngiftFrom) */
  z.splice(Math.max(0, Math.min(z.length, a.at == null ? z.length : a.at)), 0, it);
};
/* One action, not spawn + tokAdd: one line, one Undo, nothing half seen; both uids are minted by the side that
   acted. */
TD_ACT.mkcopy = function(b, a){
  var z = b.zones[a.zone];
  if(!z) return;
  var card = tdCardByName(a.n);
  if(!card){
    if(b.missing && b.missing.indexOf(a.n) < 0) b.missing.push(a.n);
    return;
  }
  var it = {uid:a.uid, card:card, locked:false};
  if(a.x != null){ it.x = a.x; it.y = a.y; it.auto = false; }
  z.push(it);
  if(!b.tokens) b.tokens = [];
  b.tokens.push({uid:a.tok, kind:'emblem', name:'', on:a.uid});
};
TD_ACT.tokAdd = function(b, a){
  if(!b.tokens) b.tokens = [];
  var t = {uid:a.uid, kind:a.kind, name:a.name || '', value:a.value};
  if(a.on) t.on = a.on; else { t.x = a.x; t.y = a.y; }
  b.tokens.push(t);
};
TD_ACT.tokSet = function(b, a){
  var t = tdTokenIn(b, a.uid);
  if(t) t.value = a.value;
};
TD_ACT.tokMove = function(b, a){
  var t = tdTokenIn(b, a.uid);
  if(!t) return;
  if(a.on){ t.on = a.on; delete t.x; delete t.y; }
  else { delete t.on; t.x = a.x; t.y = a.y; }
};
TD_ACT.tokDel = function(b, a){
  if(!b.tokens) return;
  b.tokens = b.tokens.filter(function(t){ return t.uid !== a.uid; });
};
TD_ACT.ctr = function(b, a){
  if(!b.counters) b.counters = {};
  b.counters[a.id] = a.value;
};
TD_ACT.ctrReset = function(b, a){
  b.counters = a.counters || {};
  b.tokens = [];
};

/* These exist only on the wire: the others' model of your hidden zones is a count. A card appears, named, when it
   becomes public, and vanishes going the other way. */
/* No more than a deck could hold, so a huge count cannot fill a zone with placeholders. */
var TD_COUNT_MAX = 1000;
TD_ACT.count = function(b, a){
  var z = b.zones[a.zone];
  if(!Array.isArray(z)) return;
  var n = Math.max(0, Math.min(TD_COUNT_MAX, Math.floor(tdNum(a.n))));
  while(z.length > n) z.pop();
  while(z.length < n) z.push({uid:'anon·' + a.zone + '·' + z.length, anon:true});
};
TD_ACT.appear = function(b, a){
  var z = b.zones[a.zone];
  if(!Array.isArray(z)) return;
  var it;
  /* Played face down, it arrives with no name: a real piece with a uid and no card in it. */
  if(a.anon){
    it = {uid:a.uid, anon:true, down:true, locked:!!a.locked};
  } else {
    var card = tdCardByName(a.n);
    if(!card){
      if(b.missing && b.missing.indexOf(a.n) < 0) b.missing.push(a.n);
      return;
    }
    it = {uid:a.uid, card:card, locked:!!a.locked};
  }
  if(a.dm) it.dm = true;          /* the DM's, out of the DM's own zones */
  if(a.x != null){ it.x = a.x; it.y = a.y; it.auto = false; }
  if(a.lab && !a.anon) it.lab = a.lab;     /* its label, as it is seen */
  z.splice(Math.max(0, Math.min(z.length, a.at == null ? z.length : a.at)), 0, it);
};
/* A reveal is board state, not table state: logged, undone, saved and kept through a reconnect, while TBL.grants is
   emptied when you leave or a game is dealt. The table layer reads this. */
TD_ACT.reveal = function(b, a){
  var at = tdFindIn(b, a.uid);
  if(!at) return;
  if(a.on) at.item.shown = true; else delete at.item.shown;
};
TD_ACT.zshow = function(b, a){
  if(!b.zshow) b.zshow = {};
  if(a.mode) b.zshow[a.zone] = a.mode; else delete b.zshow[a.zone];
};
TD_ACT.vanish = function(b, a){
  var at = tdFindIn(b, a.uid);
  if(!at) return;
  b.zones[at.zone].splice(at.index, 1);
  if(b.tokens) b.tokens = b.tokens.filter(function(t){ return t.on !== a.uid; });
};

/* Board-scoped, so replay can apply an action to a board not on screen. */
function tdFindIn(b, uid){
  var ids = Object.keys(b.zones);
  for(var i = 0; i < ids.length; i++){
    var list = b.zones[ids[i]];
    for(var j = 0; j < list.length; j++)
      if(list[j].uid === uid) return {zone:ids[i], index:j, item:list[j]};
  }
  return null;
}
function tdTokenIn(b, uid){
  var list = b.tokens || [];
  for(var i = 0; i < list.length; i++) if(list[i].uid === uid) return list[i];
  return null;
}


/* One entry per physical card, as the board moves single cards (printPlaytest does the same, cat_export.js). */
function tdExpand(entries, cardMap){
  var out = [];
  (entries || []).forEach(function(e){
    var card = cardMap[e.name];
    if(!card) return;                    /* a name with no card is reported below */
    var n = Math.max(1, e.count || 1);
    for(var i = 0; i < n; i++){
      var tok = {uid:tdUid('td'), card:card, locked:false};
      /* Exactly one token off a Lord line is the Lord, even beside ordinary copies of the card. */
      if(e.lord && i === 0) tok.lord = true;
      out.push(tok);
    }
  });
  return out;
}

/* A single card put back into the deck gets a random place from tdMove instead. */
function tdShuffle(a){
  for(var i = a.length - 1; i > 0; i--){
    var j = Math.floor(Math.random() * (i + 1));
    var t = a[i]; a[i] = a[j]; a[j] = t;
  }
  return a;
}

function tdBuildBoard(){
  var cardMap = {};
  (window.CARDS || []).forEach(function(c){ cardMap[c.name] = c; });

  var board = {zones:{}, missing:[], counts:{}, tokens:[]};
  tdDataZones().forEach(function(z){ board.zones[z.id] = []; });

  tdDataZones().forEach(function(z){
    if(!z.from) return;
    /* Encounter and Rewards read only the deck: the hand's area collects Armament only for a Character. */
    if(z.id !== 'deck' && REBIRTH && _gameMode !== 'character') return;
    var id = DECK_IDS[z.from];
    if(!id) return;                      /* section this game does not have */
    var entries = parseDeckIn(id) || [];
    entries.forEach(function(e){ if(!cardMap[e.name]) board.missing.push(e.name); });
    board.zones[z.id] = tdExpand(entries, cardMap);
    board.counts[z.id] = board.zones[z.id].length;
  });
  /* An Armament, Ongoing or Character card in the Main Deck starts in the Armament: a deck saved before the deck page
     moved them, or dealt straight from the list (tboDeal), may still carry them. */
  if(board.zones.gear && board.zones.deck && REBIRTH && _gameMode === 'character'){
    board.zones.deck = board.zones.deck.filter(function(it){
      if(!tdIsGearCard(it.card)) return true;
      board.zones.gear.push(it);
      return false;
    });
    board.counts.deck = board.zones.deck.length;
    board.counts.gear = board.zones.gear.length;
  }

  /* The Lord comes out before the shuffle, into its own slot (tdHasLord, Kingdoms only). */
  if(board.zones.lord){
    for(var i = board.zones.deck.length - 1; i >= 0; i--){
      if(!board.zones.deck[i].lord) continue;
      if(board.zones.lord.length){ delete board.zones.deck[i].lord; continue; }
      board.zones.lord.push(board.zones.deck.splice(i, 1)[0]);
    }
  }
  /* Every pile is shuffled, not just the Main Deck: a hidden order that is not random is a stacked deck. */
  tdZones().forEach(function(z){
    if(z.kind === 'pile' && board.zones[z.id]) tdShuffle(board.zones[z.id]);
  });
  board.counters = tdNewCounters();
  /* A Rebirth hand is shown to the table until its player hides it. */
  if(REBIRTH && _gameMode === 'character' && board.zones.hand) board.zshow = {hand:'all'};
  /* The Level, for the essence icons by your name in a table's top row (tdRbChipStatsHTML). */
  if(REBIRTH && _gameMode === 'character'){
    var lvl = tdLevelLetters((tdReadStatRow() || {}).lvl).join('');
    if(lvl) board.lvl = lvl;
  }
  /* The icon you chose, for the top row and your token; with none, everybody draws your initial (cat_rbgrid.js). */
  if(REBIRTH && typeof tdGfIconSaved === 'function'){
    var gic = tdGfIconSaved();
    if(gic) board.icon = gic;
  }
  return board;
}


/* A Level is a colour string (RRRGG: three Ire, two Arch), and each letter names one Core Essence by colour, not by
   card name, so renaming "Ire Essence" cannot empty the Essence Area. */
var TD_LVL_COLOR = {R:'red', O:'orange', Y:'yellow', G:'green',
                    B:'blue',  I:'indigo', V:'violet'};

function tdLevelLetters(str){
  return String(str || '').toUpperCase().replace(/[^ROYGBIV]/g, '').split('');
}

/* An Essence card's colour is its subtype, through _ESSENCE_COLOR_MAP read off the catalog; card.colors is only a
   fallback (HANDOFF §28.1). */
function tdEssenceColors(c){
  var out = [], seen = {};
  var map = (typeof _ESSENCE_COLOR_MAP !== 'undefined' && _ESSENCE_COLOR_MAP)
            || window._ESSENCE_COLOR_MAP || {};
  (c.subTypes || []).forEach(function(st){
    var raw = String(st).trim();
    /* The map is keyed "Ire", "Vig"...: a subtype typed in any case still finds its colour. */
    var norm = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    var col = map[raw] || map[norm];
    /* Both loops key the seen set in lower case: the map gives 'Blue' and card.colors 'blue', and the tally would count
       twice. */
    var k = col ? String(col).toLowerCase() : '';
    if(k && !seen[k]){ seen[k] = true; out.push(k); }
  });
  (c.colors || []).forEach(function(col){
    var k = String(col).toLowerCase();
    if(!seen[k]){ seen[k] = true; out.push(k); }
  });
  /* The name last, only when the types said nothing, so a typed card decides its own colour. */
  if(!out.length){
    var nm = String((c && c.name) || '');
    Object.keys(map).forEach(function(key){
      if(!new RegExp('(^|[^a-z])' + key + '([^a-z]|$)', 'i').test(nm)) return;
      var k = String(map[key]).toLowerCase();
      if(!seen[k]){ seen[k] = true; out.push(k); }
    });
  }
  return out;
}
/* One rule, asked in one place by the menu and the drop test: an Essence belongs in the Essence deck or area, and
   nothing else in the area. Rebirth is exempt: its Essences are seeded from the Level. */
var TD_ESSENCE_ZONES = {essdeck:1, essarea:1};
function tdIsEssenceCard(c){
  if(!c) return false;
  return (c.superTypes || []).some(function(t){
    return String(t).toLowerCase() === 'essence';
  });
}
function tdCanGo(item, zoneId, fromZone){
  if(REBIRTH) return tdCanGoRebirth(item, zoneId, fromZone);
  var card = item && item.card;
  if(!card) return true;
  /* the Lord slot has its own rule, enforced where it is used */
  if(zoneId === 'lord') return true;
  /* Where it is counts too: a card in an Essence zone is an Essence to the board, or one typed otherwise could never
     leave. */
  var isEss = tdIsEssenceCard(card) || !!TD_ESSENCE_ZONES[fromZone];
  return isEss === !!TD_ESSENCE_ZONES[zoneId];
}
/* Rebirth: the hand's area is two zones, a drop anywhere on it going to the card's part (tdHandAreaZone), and a DM's
   card (dm) stays on the Field or in the DM's three zones, which take nothing else. */
var TD_DM_ZONES = {dmdeck:1, dmrow:1, dmgrave:1};
/* A DM's card: the Grave is the DM's Grave, a deck the DM Deck, the Field and the DM's zones themselves, anywhere
   else ''. */
function tdDmZoneFor(toId){
  if(toId === 'grave') return 'dmgrave';
  if(toId === 'deck') return 'dmdeck';
  return (toId === 'field' || TD_DM_ZONES[toId]) ? toId : '';
}
/* The deck page's rule (_isGearCard, cat_deck.js), so the board and the Armament section agree. */
function tdIsGearCard(c){
  return !!c && (typeof _isGearCard === 'function') && !!_isGearCard(c);
}
function tdCanGoRebirth(item, zoneId, fromZone){
  var it = item || {};
  if(!zoneId || zoneId === 'field') return true;
  if(it.dm) return !!TD_DM_ZONES[zoneId];
  if(TD_DM_ZONES[zoneId]) return false;
  if(zoneId === 'gear') return fromZone === 'gear' || tdIsGearCard(it.card);
  if(zoneId === 'hand')
    return fromZone === 'hand' || !tdIsGearCard(it.card) || !tdZoneById('gear');
  return true;
}
function tdHandAreaZone(item, toId){
  if(!REBIRTH || (toId !== 'hand' && toId !== 'gear') || !item || item.dm) return toId;
  if(!tdZoneById('gear') || !TD.board || !TD.board.zones.gear) return toId;
  return tdIsGearCard(item.card) ? 'gear' : 'hand';
}
function tdRefusedWords(item, toId){
  var it = item || {};
  if(REBIRTH){
    if(it.dm) return 'The DM\'s cards go on the Field or back to the DM';
    if(TD_DM_ZONES[toId]) return 'Only the DM\'s cards go there';
    return 'That card cannot go there';
  }
  return tdIsEssenceCard(it.card)
    ? 'Essence only goes to the Essence deck or the Essence area'
    : 'Only Essence goes there';
}
/* Links come from cardLinkNames (cat_core.js), the one parser, and only those that resolve to a real card are
   offered. */
function tdCardLinks(card){
  if(!card || typeof window.cardLinkNames !== 'function') return [];
  var out = [];
  window.cardLinkNames(card.ruleText || '').forEach(function(nm){
    var c = tdCardByName(nm);
    if(c) out.push(c);
  });
  return out;
}

/* A copy is a card wearing an Emblem Copy counter. */
function tdIsCopyIn(b, uid){
  if(!b || !b.tokens) return false;
  for(var i = 0; i < b.tokens.length; i++){
    var t = b.tokens[i];
    if(t.on === uid && t.kind === 'emblem') return true;
  }
  return false;
}
function tdIsCopy(uid){ return TD.board ? tdIsCopyIn(TD.board, uid) : false; }

/* What a zone is showing everyone: '' | 'all' | 'top'. */
function tdZShowIn(b, zone){ return (b && b.zshow && b.zshow[zone]) || ''; }
function tdZShow(zone){ return tdZShowIn(TD.board, zone); }
function tdRevealed(uid){
  var at = TD.board ? tdFindIn(TD.board, uid) : null;
  return !!(at && at.item && at.item.shown);
}
window.tdZShow = tdZShow;

function tdRevealCard(uid, on){
  tdCloseMenu();
  var ok = !!tdDo({t:'reveal', uid:uid, on:!!on});
  if(ok) tdRender();
  return ok;
}
function tdSetZShow(zone, mode){
  tdCloseMenu();
  var ok = !!tdDo({t:'zshow', zone:zone, mode:mode || ''});
  if(ok) tdRender();
  return ok;
}
/* The hand's own two-state toggle; the eye on a hidden zone offers the table's grants. */
function tdToggleZShow(zone){
  return tdSetZShow(zone, tdZShow(zone) === 'all' ? '' : 'all');
}
window.tdRevealCard = tdRevealCard;
window.tdSetZShow = tdSetZShow;
window.tdToggleZShow = tdToggleZShow;

/* The Field, or the Essence area for an Essence, asked of tdCanGo so a rule changed there reaches this. */
function tdCopyZoneFor(card){
  var item = {card:card};
  if(tdCanGo(item, 'essarea', null) && !tdCanGo(item, 'field', null)) return 'essarea';
  return 'field';
}

/* By index, not by name: the menu builds an onclick string, and a name with an apostrophe would close the quote
   (HANDOFF §24.2). */
function tdCreateCopyAt(uid, i){
  tdCloseMenu();
  var at = tdFind(uid); if(!at || !at.item.card) return false;
  var links = tdCardLinks(at.item.card);
  var card = links[i]; if(!card) return false;
  var zone = tdCopyZoneFor(card);
  var a = {t:'mkcopy', uid:tdUid('td'), tok:tdUid('tk'), zone:zone, n:card.name};
  if((tdZoneById(zone) || {}).kind === 'free'){ a.x = 4; a.y = 4; }
  var ok = !!tdDo(a);
  if(ok) tdRender();
  return ok;
}
window.tdCreateCopyAt = tdCreateCopyAt;

/* Super and sub types alike: a hand-typed set reaches a Core Essence as ['Essence'] + ['Core','Ire'], or as
   'Core Essence' (HANDOFF §28.1). */
function tdTypeWords(c){
  var out = [];
  [].concat(c.superTypes || [], c.subTypes || []).forEach(function(t){
    String(t).toLowerCase().split(/[^a-z0-9'-]+/).forEach(function(w){
      if(w) out.push(w);
    });
  });
  return out;
}
function tdIsAnyEssence(c){
  return !!c && tdTypeWords(c).indexOf('essence') >= 0;
}
/* By subtype, so a dual Essence counts in both columns, and every Essence counts, Core or not; colours with none are
   left out. */
function tdEssenceTally(board){
  var b = board || TD.board;
  var items = (b && b.zones && b.zones.essarea) || [];
  var by = {};
  items.forEach(function(it){
    var c = it && it.card;
    if(!c || !tdIsAnyEssence(c)) return;
    tdEssenceColors(c).forEach(function(k){ by[k] = (by[k] || 0) + 1; });
  });
  return TD_COLOR_NAMES.map(function(n){
    var k = String(n).toLowerCase();
    return by[k] ? {name:n, n:by[k]} : null;
  }).filter(Boolean);
}
function tdEssenceTallyHTML(board){
  var rows = tdEssenceTally(board);
  if(!rows.length) return '';
  return "<div class='td-esstally' aria-label='Essence you control'>"
    + rows.map(function(r){
        return "<div class='td-esstally-b' title='" + e(r.n + ' ' + r.name
                 + ' Essence' + (r.n === 1 ? '' : 's')) + "'"
          + " style='--tok-fill:" + tdColorFill(r.name)
          + ";--tok-ink:" + tdColorInk(r.name) + "'>"
          + tdColorMana(r.name)
          + "<span class='td-esstally-n'>" + r.n + "</span></div>";
      }).join('')
    + "</div>";
}
/* Core only: other cards share the subtypes and are not what "each Arch" means. The subtype is returned as the card
   spells it, for "Lock each Arch". */
function tdIsCoreEssence(c){
  if(!c) return false;
  var w = tdTypeWords(c);
  return w.indexOf('essence') >= 0 && w.indexOf('core') >= 0;
}
function tdCoreEssenceType(c){
  if(!tdIsCoreEssence(c)) return '';
  var map = (typeof _ESSENCE_COLOR_MAP !== 'undefined' && _ESSENCE_COLOR_MAP)
            || window._ESSENCE_COLOR_MAP || {};
  var subs = c.subTypes || [];
  for(var i = 0; i < subs.length; i++){
    var raw = String(subs[i]).trim();
    var norm = raw.charAt(0).toUpperCase() + raw.slice(1).toLowerCase();
    /* Only a subtype the game knows as an essence type: "Lock each Legendary" is not what was asked. */
    if(map[raw] || map[norm]) return raw;
  }
  return '';
}
/* Used by the menu row and its action alike, so they agree on what "each Arch" covers. */
function tdCoresOfType(type, board){
  var b = board || TD.board;
  var want = String(type).toLowerCase();
  return ((b && b.zones.essarea) || []).filter(function(it){
    return tdIsCoreEssence(it.card)
      && String(tdCoreEssenceType(it.card)).toLowerCase() === want;
  });
}
/* Calls tdIsCoreEssence rather than repeating it (HANDOFF §28). A Core is preferred; Rebirth, whose catalogue its
   owner builds, falls back to any Essence of the colour, and the main game never does. */
function tdCoreEssenceByColor(){
  var by = {}, spare = {};
  (window.CARDS || []).forEach(function(c){
    var core = tdIsCoreEssence(c);
    if(!core && !(REBIRTH && tdIsAnyEssence(c))) return;
    tdEssenceColors(c).forEach(function(k){
      if(core){ if(!by[k]) by[k] = c; }
      else if(!spare[k]) spare[k] = c;
    });
  });
  if(REBIRTH) Object.keys(spare).forEach(function(k){ if(!by[k]) by[k] = spare[k]; });
  return by;
}
/* So a failure can say whether the catalogue has no essences or none of the colour. */
function tdEssenceCardCount(){
  return (window.CARDS || []).filter(tdIsAnyEssence).length;
}

/* tdReadStatRow returns null where the row does not apply, which keeps the values out of other saves. */
function tdStatRowApplies(){ return REBIRTH && _gameMode === 'character'; }

function tdReadStatRow(){
  if(!tdStatRowApplies()) return null;
  function v(id){ var el = document.getElementById(id); return el ? el.value.trim() : ''; }
  return {lvl:v('dta-lvl'), atk:v('dta-atk'), hp:v('dta-hp'), mp:v('dta-mp')};
}
/* Absent means blank, so decks saved before these fields still load. */
function tdWriteStatRow(entry){
  ['lvl','atk','hp','mp'].forEach(function(k){
    var el = document.getElementById('dta-' + k);
    if(el) el.value = (entry && entry[k] != null) ? entry[k] : '';
  });
  tdLvlEcho();
}
function tdSyncStatRow(){
  var row = document.getElementById('tdStatRow');
  if(row) row.style.display = tdStatRowApplies() ? '' : 'none';
  /* Handed over by _hashLoadDeck, which runs before this file exists; consumed once. */
  if(window._tdPendingStatRow){
    var p = window._tdPendingStatRow;
    window._tdPendingStatRow = null;
    tdWriteStatRow(p);
    return;                                  /* tdWriteStatRow echoes already */
  }
  tdLvlEcho();
}
function tdLvlEcho(){
  var out = document.getElementById('tdLvlEcho');
  if(!out) return;
  var el = document.getElementById('dta-lvl');
  var letters = tdLevelLetters(el ? el.value : '');
  if(!letters.length){ out.textContent = ''; return; }
  var by = tdCoreEssenceByColor(), counts = {}, order = [];
  letters.forEach(function(L){
    var card = by[TD_LVL_COLOR[L]];
    var nm = card ? card.name.replace(/\s*Essence$/i, '') : L;
    if(!counts[nm]){ counts[nm] = 0; order.push(nm); }
    counts[nm]++;
  });
  out.textContent = order.map(function(n){ return counts[n] + ' ' + n; }).join(', ')
    + '  —  draw ' + letters.length;
}


/* A Rewards deck is never laid out: Draw returns one random card from it matching the specification, and copies
   weight the draw. */
function tdIsRewards(){ return REBIRTH && _gameMode === 'rewards'; }
function tdIsEncounter(){ return REBIRTH && _gameMode === 'encounter'; }
/* The two pool pages are one page; only an Encounter keeps a Field and a Grave. */
function tdIsPool(){ return tdIsRewards() || tdIsEncounter(); }
/* Every visible Reward or Encounter on these pages comes from here. */
function tdPoolNoun(){ return _gameMode === 'encounter' ? 'Encounter' : 'Reward'; }

/* Not in the DOM: tdRewCatalog re-renders on every keystroke. */
var TD_REW_SHOW = false;
window.tdRewToggleDeck = function(){
  TD_REW_SHOW = !TD_REW_SHOW;
  tdRewCatalog();
};

function tdRewPool(){
  var cardMap = {};
  (window.CARDS || []).forEach(function(c){ cardMap[c.name] = c; });
  var out = [];
  (parseDeckIn(DECK_IDS.main) || []).forEach(function(en){
    var card = cardMap[en.name];
    if(!card) return;
    var n = Math.max(1, en.count || 1);
    for(var i = 0; i < n; i++) out.push(card);
  });
  return out;
}
function tdRewList(){
  var cardMap = {};
  (window.CARDS || []).forEach(function(c){ cardMap[c.name] = c; });
  var out = [];
  (parseDeckIn(DECK_IDS.main) || []).forEach(function(en){
    var card = cardMap[en.name];
    if(card) out.push({card:card, count:Math.max(1, en.count || 1)});
  });
  return out;
}

/* The specification is the browse sidebar's own controls and classes, matched by catFilterPred, so the two cannot
   filter differently. No name search, saga picker or date. */

/* Read off the controls at match time: no second copy of the specification. */
function tdRewSpec(){
  var v = function(id){ var el = document.getElementById(id); return el ? String(el.value).trim() : ''; };
  var ck = function(id){ var el = document.getElementById(id); return !!(el && el.checked); };
  var terms = function(sel){
    return [].map.call(document.querySelectorAll(sel), function(i){
      return i.value.trim().toLowerCase(); }).filter(Boolean);
  };
  return {
    rq: v('tdRewRs').toLowerCase(), rtMode: v('tdRewRtMode') || 'all',
    cm: v('tdRewCm') || 'any',
    /* A distinct data-f: chk() collects by it across the whole document. */
    scc: chk('rewcolor').map(function(x){ return x.toLowerCase(); }),
    sm: v('tdRewStm') || 'any', ss: terms('#tdRewSuf .sti'),
    sbm: v('tdRewSbm') || 'any', sbt: terms('#tdRewStf .sti'),
    cop: v('tdRewCop'),  cval: v('tdRewCval'),
    aop: v('tdRewAop'),  aval: v('tdRewAval'),
    hop: v('tdRewHop'),  hval: v('tdRewHval'),
    arop: v('tdRewArop'), arval: v('tdRewArval'),
    rop: v('tdRewRop'),  rval: v('tdRewRval'),
    /* "Contains X" and "Contains *" are the dropdowns' last choices ('x', 'star'), read by catFilterPred. */
    atkArc: ck('tdRewAtkarc'), hpArc: ck('tdRewHparc')
  };
}

function tdRewMatches(){ return tdRewPool().filter(catFilterPred(tdRewSpec())); }

function tdRewDraw(){
  var pool = tdRewMatches();
  if(!pool.length){
    if(typeof toast === 'function') toast('Nothing matches that specification');
    return;
  }
  var card = pool[Math.floor(Math.random() * pool.length)];
  TD.rewDrawn = TD.rewDrawn || [];
  TD.rewDrawn.unshift(card);
  /* An Encounter is put on the table, as a spawn through tdDo, so it is logged and undoable (drawn makes the record say
     drawn); a Reward is only looked up. */
  if(tdIsEncounter() && TD.board && TD.board.zones.field){
    tdDo({t:'spawn', zone:'field', uid:tdUid('td'), n:card.name, drawn:true});
    tdRender();                     /* the board has changed, not just the list */
    return;
  }
  tdRewSync();
}
function tdRewClear(){ TD.rewDrawn = []; tdRewSync(); }

/* Only the count and the results are redrawn as you type: rebuilding the panel would take the focus from the field. */
function tdRewSync(){
  var n = document.getElementById('tdRewCount');
  if(n){
    var pool = tdRewMatches(), deck = tdRewPool().length;
    n.textContent = !deck
      ? 'this ' + tdPoolNoun() + ' deck is empty'
      : pool.length + ' of ' + deck + (pool.length === 1 ? ' card matches' : ' cards match');
    n.className = 'td-rew-count' + (pool.length ? '' : ' none');
  }
  /* The bar carries the deck size, and the deck is edited on the Build Deck page while this is open. */
  tdRenderBar();
  tdRewCatalog();
  var res = document.getElementById('tdRewOut');
  if(!res) return;
  var drawn = TD.rewDrawn || [];
  if(!drawn.length){ res.innerHTML = "<i class='tpl-hint'>Nothing drawn yet.</i>"; return; }
  res.innerHTML = drawn.map(function(c, i){
    return "<div class='td-rew-card" + (i === 0 ? ' latest' : '') + "'>"
      + "<div class='td-face' data-card='" + e(c.name) + "'></div>"
      + (i === 0 ? "<span class='td-rew-tag'>just drawn</span>" : '')
      + "</div>";
  }).join('');
  tdPaintFaces(res);
}

function tdRewCatalog(){
  var host = document.getElementById('tdRewCat');
  if(!host) return;
  var list = tdRewList();
  var btn = document.getElementById('tdRewShowBtn');
  if(btn){
    btn.textContent = TD_REW_SHOW ? 'Hide' : 'Show';
    btn.setAttribute('aria-expanded', TD_REW_SHOW ? 'true' : 'false');
  }
  if(!list.length){
    host.innerHTML = "<i class='tpl-hint'>This " + tdPoolNoun() + " deck is empty. "
      + "Add cards to it on the Deck page and they will show up here.</i>";
    return;
  }
  /* The counts still read while the cards are hidden. */
  var matched = tdRewMatches();
  if(!TD_REW_SHOW){
    var copies = tdRewPool().length;
    host.innerHTML = "<div class='td-rew-hidden'><span><b>" + list.length + "</b> card"
      + (list.length === 1 ? '' : 's') + " &middot; <b>" + copies + "</b> cop"
      + (copies === 1 ? 'y' : 'ies') + " &middot; <b>" + matched.length
      + "</b> matching the specification</span>"
      + "<i>Press Show to see them.</i></div>";
    return;
  }
  var hit = {};
  matched.forEach(function(c){ hit[c.name] = true; });
  host.innerHTML = list.map(function(row){
    var c = row.card;
    return "<div class='td-rew-mini" + (hit[c.name] ? '' : ' dim') + "'"
      + " data-name='" + e(c.name) + "' title='" + e(c.name) + "'>"
      + "<div class='td-face' data-card='" + e(c.name) + "'></div>"
      + (row.count > 1 ? "<span class='td-rew-tag'>x" + row.count + "</span>" : '')
      + "</div>";
  }).join('');
  tdLazyFaces(host);
  if(host._tdBound) return;
  host._tdBound = true;
  host.addEventListener('click', function(ev){
    var tile = ev.target.closest && ev.target.closest('.td-rew-mini');
    if(!tile) return;
    var card = (window.CARDS || []).filter(function(c){ return c.name === tile.dataset.name; })[0];
    if(card && typeof openMod === 'function') openMod(card);
  });
}

/* Copied from the sidebar's static markup (markup_head.html), byte for byte: edOrbSvg draws a value inside, and these
   are bare labels. */
var TD_REW_ICON = {
  atk: "<svg width='14' height='14' viewBox='0 0 18 18' fill='none'><rect x='4' y='4' width='10' height='10' transform='rotate(45 9 9)' stroke='#c45c5c' stroke-width='3'/></svg>",
  hp:  "<svg width='14' height='14' viewBox='0 0 18 18' fill='none'><polygon points='9,1 17,5 17,13 9,17 1,13 1,5' stroke='#c9a84c' stroke-width='3'/></svg>",
  arc: "<svg width='14' height='14' viewBox='0 0 18 18' fill='none'><circle cx='9' cy='9' r='7' stroke='#2980b9' stroke-width='3'/></svg>",
  rng: "<svg width='14' height='14' viewBox='0 0 18 18' fill='none'><polygon points='9,2 16,15 2,15' stroke='#5c9e6e' stroke-width='3' stroke-linejoin='round'/></svg>",
  atkArc: "<svg class='cbtn-ico' width='15' height='15' viewBox='0 0 18 18' fill='none' aria-hidden='true'><polyline points='1,9 9,1 17,9' stroke='#c45c5c' stroke-width='3' fill='none' stroke-linejoin='round'/><path d='M 2,9 A 7,7 0 0 0 16,9' stroke='#2980b9' stroke-width='3' fill='none'/></svg>",
  hpArc:  "<svg class='cbtn-ico' width='15' height='15' viewBox='0 0 18 18' fill='none' aria-hidden='true'><polyline points='1,9 1,5 9,1 17,5 17,9' stroke='#c9a84c' stroke-width='3' fill='none' stroke-linejoin='round'/><path d='M 2,9 A 7,7 0 0 0 16,9' stroke='#2980b9' stroke-width='3' fill='none'/></svg>"
};
/* The sidebar's comparison lists word for word; the last choice is the row's Contains ('x', 'star'), and Equal,
   Lesser and Greater are strict. */
var TD_REW_OPS = "<option value=''>Any</option><option value='eq'>Equal =</option>"
  + "<option value='lt'>Lesser &lt;</option><option value='gt'>Greater &gt;</option>";
var TD_REW_OPS_X = TD_REW_OPS + "<option value='x'>Contains X</option>";
var TD_REW_OPS_STAR = TD_REW_OPS + "<option value='star'>Contains *</option>";
/* each comparison and the number box it greys */
var TD_REW_PAIRS = [['tdRewCop', 'tdRewCval'], ['tdRewAop', 'tdRewAval'], ['tdRewHop', 'tdRewHval'],
                    ['tdRewArop', 'tdRewArval'], ['tdRewRop', 'tdRewRval']];

/* For aria-label: each box's label is a span beside it. */
var TD_REW_SAY = {ATK:'Attack', HLTH:'Health', Rg:'Range', ARC:'Arcane'};
function tdRewNum(cls, icon, lbl, opId, valId, keepCase){
  var say = TD_REW_SAY[lbl] || lbl;
  return "<div class='nf " + cls + "'><span class='fl fl-inbox" + (keepCase ? ' fl-keepcase' : '') + "'>"
    + icon + " " + lbl + "</span>"
    + "<select id='" + opId + "' aria-label='" + say + " comparison'>" + TD_REW_OPS_STAR + "</select>"
    + "<input type='number' id='" + valId + "' min='0' placeholder='0' aria-label='" + say + "'></div>";
}
/* The sidebar's .mp-sel dropdown; "All" reads "At Least" but its value is still 'all'. */
function tdRewMode(id, label, opts){
  return "<select class='mp-sel' id='" + id + "' aria-label='" + label + "'>"
    + opts.map(function(o, i){
        return "<option value='" + o[0] + "'" + (i === 0 ? ' selected' : '') + ">" + o[1] + "</option>";
      }).join('') + "</select>";
}
var TD_REW_COLOR_MODES = [['any', 'Any'], ['all', 'At Least'], ['noother', 'No Other'], ['exact', 'Exact']];
var TD_REW_TYPE_MODES = [['any', 'Any'], ['all', 'At Least'], ['none', 'None']];
function tdRewCombo(cls, id, label, icon){
  return "<span class='cbtn " + cls + "'><input type='checkbox' id='" + id + "'>"
    + "<label for='" + id + "'><span class='cbtn-ck' aria-hidden='true'></span>"
    + "<span class='cbtn-t'>" + label + "</span>" + icon + "</label></span>";
}
/* The ring on a ticked swatch keys on the value attribute (.csw input[value="Red"]:checked), so values keep COLORS'
   own capitalisation. */
function tdRewSwatches(){
  return "<div class='csw td-rew-csw'>" + COLORS.map(function(c){
    return "<input type='checkbox' id='rsw_" + c + "' value='" + c + "' data-f='rewcolor'"
      + " aria-label='" + c + " colour'>"
      + "<label for='rsw_" + c + "' title='" + c + "'>"
      + "<img src='" + (CICO[c] || '') + "' alt='" + c + "'></label>";
  }).join('') + "</div>";
}

function tdRewSpecHTML(){
  return "<div class='td-rew-side' id='tdRewSide'>"
    + "<div class='fs'>" + tdRewSwatches()
      + "<div class='mp-row'>" + tdRewMode('tdRewCm', 'How the colours match', TD_REW_COLOR_MODES) + "</div>"
    + "</div>"
    + "<div class='fs'><div class='type-cols'>"
      + "<div class='type-col'>"
        + "<button type='button' class='fl fl-center type-add-btn nb nb-green nb-m' onclick='tdRewAddType(\"super\")'>Super-Type +</button>"
        + tdRewMode('tdRewStm', 'How the super types match', TD_REW_TYPE_MODES)
        + "<div class='stf' id='tdRewSuf'></div></div>"
      + "<div class='type-col'>"
        + "<button type='button' class='fl fl-center type-add-btn nb nb-green nb-m' onclick='tdRewAddType(\"sub\")'>Sub-Type +</button>"
        + tdRewMode('tdRewSbm', 'How the sub types match', TD_REW_TYPE_MODES)
        + "<div class='stf' id='tdRewStf'></div></div>"
    + "</div></div>"
    + "<div class='fs'>"
      + "<div class='nf nf-inline'><span class='fl fl-inline'>Mana Cost</span>"
        + "<select id='tdRewCop' aria-label='Mana Cost comparison'>" + TD_REW_OPS_X + "</select>"
        + "<input type='number' id='tdRewCval' min='0' placeholder='0' aria-label='Mana Cost'></div>"
    + "</div>"
    + "<div class='fs'>" + tdRewNum('nf-atk', TD_REW_ICON.atk, 'ATK', 'tdRewAop', 'tdRewAval') + "</div>"
    + "<div class='fs'>" + tdRewNum('nf-hp', TD_REW_ICON.hp, 'HLTH', 'tdRewHop', 'tdRewHval') + "</div>"
    /* Range is Rebirth's stat, and these pools are Rebirth's. */
    + "<div class='fs'>" + tdRewNum('nf-rng', TD_REW_ICON.rng, 'Rg', 'tdRewRop', 'tdRewRval', true) + "</div>"
    + "<div class='fs'>" + tdRewNum('nf-arc', TD_REW_ICON.arc, 'ARC', 'tdRewArop', 'tdRewArval')
      + "<div class='cbtn-row'>"
        + tdRewCombo('cbtn-atk', 'tdRewAtkarc', 'Attack + Arcane', TD_REW_ICON.atkArc)
        + tdRewCombo('cbtn-hp', 'tdRewHparc', 'Health + Arcane', TD_REW_ICON.hpArc)
      + "</div>"
    + "</div>"
    + "<div class='fs'><div class='fl-row fl-row-tight'><span class='fl fl-inline'>Rule Text</span>"
      + "<select id='tdRewRtMode' class='td-rew-rt' aria-label='How the rule text words match'>"
        + "<option value='all' selected>All Words</option>"
        + "<option value='any'>Any of These Words</option>"
        + "<option value='exact'>Exact Phrase</option></select></div>"
      + "<input class='rt' type='text' id='tdRewRs' placeholder='e.g. Airborne&hellip;' aria-label='Rule Text'></div>"
  + "</div>";
}
/* The sidebar's syncOpInputs, for this panel's rows. */
function tdRewSyncOps(){
  TD_REW_PAIRS.forEach(function(p){
    var s = document.getElementById(p[0]), i = document.getElementById(p[1]);
    if(s && i) i.disabled = (s.value === 'x' || s.value === 'star');
  });
}

/* One delegated listener: the type rows come from the sidebar's makeSURow/makeSTRow with no handler, and come and go
   while the panel is open. No user text goes into an inline onclick (HANDOFF §24.2). */
function tdRewMount(){
  var suf = document.getElementById('tdRewSuf'), stf = document.getElementById('tdRewStf');
  if(suf && !suf.children.length) suf.appendChild(makeSURow(true));
  if(stf && !stf.children.length) stf.appendChild(makeSTRow(true));
  var host = document.getElementById('tdRewSide');
  if(!host || host._tdRewBound) return;
  host._tdRewBound = true;
  host.addEventListener('input', function(){ tdRewSyncOps(); tdRewSync(); });
  host.addEventListener('change', function(){ tdRewSyncOps(); tdRewSync(); });
  /* A removed type row fires no input event, so the click that removes it re-runs the match. */
  host.addEventListener('click', function(ev){
    if(ev.target && ev.target.classList && ev.target.classList.contains('sti-x'))
      setTimeout(tdRewSync, 0);
  });
}
window.tdRewAddType = function(which){
  var box = document.getElementById(which === 'super' ? 'tdRewSuf' : 'tdRewStf');
  if(!box) return;
  box.appendChild(which === 'super' ? makeSURow(false) : makeSTRow(false));
};
/* The first radio of each group is the sidebar's default. */
window.tdRewReset = function(){
  var host = document.getElementById('tdRewSide');
  if(!host) return;
  [].forEach.call(host.querySelectorAll('input[type=text],input[type=number]'),
    function(i){ i.value = ''; });
  [].forEach.call(host.querySelectorAll('input[type=checkbox]'),
    function(i){ i.checked = false; });
  [].forEach.call(host.querySelectorAll('select'), function(s){ s.selectedIndex = 0; });
  tdRewSyncOps();
  ['tdRewSuf', 'tdRewStf'].forEach(function(id){
    var box = document.getElementById(id);
    if(!box) return;
    box.innerHTML = '';
    box.appendChild(id === 'tdRewSuf' ? makeSURow(true) : makeSTRow(true));
  });
  tdRewSync();
};

/* No window.tdFitTitles wrapper: the catalog scripts run in global scope, so the declaration is already on window,
   and a wrapper would call itself until the stack overflows. */
function tdFitTitles(root){
  var host = root || document;
  if(!host.querySelectorAll) return;
  [].forEach.call(host.querySelectorAll('.td-zname'), tdFitRail);
}
/* A zone's name sets no height of its own (contain:inline-size, testdeck.css): it shrinks to what the rail has, down
   to a floor, then the ellipsis. It runs vertical-rl, so its length is its height. */
var TD_RAIL_FLOOR = 0.6;
function tdFitRail(el){
  if(!el) return;
  el.style.fontSize = '';
  var max = parseFloat(getComputedStyle(el).fontSize);
  if(!(max > 0) || !el.clientHeight) return;
  if(!/^vertical/.test(getComputedStyle(el).writingMode)) return;   /* a folded zone's bar */
  if(el.scrollHeight <= el.clientHeight + 0.5) return;
  var min = Math.max(6.5, max * TD_RAIL_FLOOR), size = max, guard = 0;
  while(size > min && el.scrollHeight > el.clientHeight + 0.5 && guard++ < 60){
    size -= 0.5;
    el.style.fontSize = size + 'px';
  }
}

function tdRewardsHTML(){
  return "<div class='td-rew'>"
    + "<div class='td-rew-spec'>"
      + "<h4><span class='td-h4-t'>Specification</span></h4>"
      + "<i class='tpl-hint'>The browse filter, over this deck. Draw returns one random "
        + "card matching everything you set; anything left alone is not asked about.</i>"
      + tdRewSpecHTML()
      + "<div class='td-rew-actions'>"
        + "<button class='dv-pbtn dv-pbtn-sm' onclick='tdRewDraw()'>" + uiIco('dice') + " Draw "
          + (tdPoolNoun() === 'Encounter' ? 'an ' : 'a ') + tdPoolNoun() + "</button>"
        + "<span class='td-rew-count' id='tdRewCount'></span>"
        + "<button class='ed2-btn tiny warn' onclick='tdRewReset()'>Reset</button>"
      + "</div>"
    + "</div>"
    + "<div class='td-rew-res'><h4><span class='td-h4-t'>Drawn</span>"
      + "<button class='ed2-btn tiny' onclick='tdRewClear()'>Clear</button></h4>"
      + "<div id='tdRewOut'></div></div>"
    + "<div class='td-rew-cat'><h4><span class='td-h4-t'>" + tdPoolNoun() + " Deck</span>"
      + "<button class='ed2-btn tiny td-rew-showb' id='tdRewShowBtn'"
      + " aria-expanded='false' onclick='tdRewToggleDeck()'>Show</button>"
      + "<span class='td-rew-hint'>matching cards stay lit &middot; click one to open it</span></h4>"
      + "<div id='tdRewCat'></div></div>"
    + "</div>";
}


var TD_ADJ = [-10, -1, 1, 10];

/* Starting Life is read from the deck type's own rules text ('<n> Life', GAME_MODES in cat_deck.js), so the counter
   and the Deck Rules cannot disagree. */
function tdStartLife(){
  var gm = (typeof GAME_MODES !== 'undefined' && GAME_MODES[_gameMode])
    ? GAME_MODES[_gameMode] : null;
  if(!gm || !gm.rules) return null;        /* deck type 'None' has no rules */
  for(var i = 0; i < gm.rules.length; i++){
    if(gm.rules[i].title !== 'Starting Life') continue;
    var m = /(-?\d+)/.exec(gm.rules[i].text || '');
    return m ? +m[1] : null;
  }
  return null;
}

function tdNum(v){ return (v === '' || v == null || isNaN(+v)) ? 0 : +v; }

/* Rebirth's three counters are the card's three stats, drawn with the card's own orbs (edOrbSvg). */
/* Life wears the Health hexagon, drawn as Rebirth's three are. */
var TD_STAT_ORB = {atk:'attack', hp:'health', mp:'arcane', life:'health', rng:'range'};
/* From the editor's ORB_FILL / ORB_OUTLINE, which edOrbSvg paints from; Life shares Health's gold. */
var TD_STAT_TINT_KEY = {atk:'atk', hp:'hp', mp:'arc', life:'hp', rng:'rng'};
function tdStatTint(id){
  var k = TD_STAT_TINT_KEY[id];
  if(!k) return null;
  try{
    var f = (window.edOrbFill || {})[k], o = (window.edOrbOutline || {})[k];
    if(f && o) return {fill:f, ink:o};
  }catch(_){}
  return null;
}
/* At twice the starting life the Life orb runs green into blue (the one two-colour orb, see orbGradDefs), the
   threshold read off the format (tdStartLife). Not in Rebirth, whose counters are the Character's stats. */
var TD_LIFE_HIGH = ['#4fb477', '#2f7fd0'];      /* green into blue */
/* Dark enough to read against both ends of the ramp, as ORB_OUTLINE is for every other fill. */
var TD_LIFE_HIGH_INK = '#0c4a52';
function tdLifeDoubled(id, value){
  if(REBIRTH || id !== 'life') return false;
  var start = tdStartLife();
  if(start == null || start <= 0) return false;
  var v = Number(value);
  return isFinite(v) && v >= start * 2;
}
/* '' for an id with no orb, or when edOrbSvg (the editor's) is not there. */
function tdStatOrbBox(id, value){
  var t = TD_STAT_ORB[id];
  if(!t || typeof window.edOrbSvg !== 'function') return '';
  var high = tdLifeDoubled(id, value);
  try{
    return "<span class='td-ctr-orbbox" + (high ? ' td-orb-high' : '') + "'>"
      + window.edOrbSvg(t, (value == null ? '' : String(value)), 86,
                        high ? {fill:TD_LIFE_HIGH, ink:TD_LIFE_HIGH_INK} : null)
      /* The glimmer is drawn over the orb, not into its SVG, which is the card face's shape everywhere; aria-hidden
         decoration. */
      + (high ? "<span class='td-orb-glim' aria-hidden='true'>"
                + "<i></i><i></i><i></i><i></i></span>" : '')
      + "</span>";
  }catch(_){ return ''; }
}

/* Rebirth Character swaps Life for ATK/HP/MP, read off the deck; Encounter and Rewards have none. */
function tdCounterDefs(){
  if(REBIRTH){
    if(_gameMode !== 'character') return [];
    var st = tdReadStatRow() || {};
    return ['atk','hp','mp'].map(function(k){
      return {id:k, label:k.toUpperCase(), start:tdNum(st[k]),
        hint:(st[k] === '' || st[k] == null)
          ? 'not set on this deck - fill ' + k.toUpperCase() + ' in on the Deck page'
          : null};
    });
  }
  var life = tdStartLife();
  return [{
    id:'life', label:'Life',
    start: (life == null ? 0 : life),
    /* No format, no starting life: zero, and said so, rather than an invented number. */
    hint: (life == null ? 'no deck type selected - set your own' : null)
  }];
}

function tdNewCounters(){
  var c = {};
  tdCounterDefs().forEach(function(d){ c[d.id] = d.start; });
  return c;
}

function tdAdj(id, n){
  if(!TD.board || !TD.board.counters) return;
  /* Life below zero is allowed on purpose: the game is over, but the number is
     still worth being able to read. */
  tdDo({t:'ctr', id:id, value:(TD.board.counters[id] || 0) + n});
  tdRenderCounters();
}
/* A blank or unreadable entry puts the counter back (as tdTokenSet does), and the reject path renders too, to show it. */
function tdCtrType(id, raw){
  if(!TD.board || !TD.board.counters) return;
  var v = parseInt(String(raw).trim(), 10);
  if(!isFinite(v)){ tdRenderCounters(); return; }
  if(v !== TD.board.counters[id]) tdDo({t:'ctr', id:id, value:v});
  tdRenderCounters();
  /* The field empties itself: it is a set-to box, and the orb shows the total. */
}
/* Enter commits, Escape abandons, Up and Down step by one; stopped, so an Escape here does not also close a menu or
   Search. */
function tdCtrKey(ev, id){
  if(!ev) return;
  if(ev.key === 'Enter'){
    ev.preventDefault(); ev.stopPropagation();
    tdCtrType(id, ev.target.value);
  } else if(ev.key === 'Escape'){
    ev.preventDefault(); ev.stopPropagation();
    ev.target.value = '';
    ev.target.blur();
  } else if(ev.key === 'ArrowUp' || ev.key === 'ArrowDown'){
    ev.preventDefault(); ev.stopPropagation();
    tdAdj(id, ev.key === 'ArrowUp' ? 1 : -1);
    var back = document.getElementById('tdCtrIn-' + id);
    if(back){ back.focus(); back.select(); }
  }
}

/* One Reset for the group, and it clears the board's tokens too: they are counters. */
function tdResetCounters(){
  if(!TD.board) return;
  tdDo({t:'ctrReset', counters:tdNewCounters()});
  tdRender();
}

/* No sticky block over the board, which would cost every card height: the controls are a panel in the board's grid
   (.td-play), pages with no panel use the strip, and tdCtrHost answers which. */
function tdCtrHost(){
  var p = document.getElementById('tdPlayCtrs');
  if(p){
    /* The strip may still hold the panel from a moment ago (Focus draws no half of yours), and two #tdTurn would split
       the tracker. */
    var strip = document.getElementById('tdCounters');
    if(strip && strip.innerHTML) strip.innerHTML = '';
    return p;
  }
  if(tdFocusOther()) return null;
  return document.getElementById('tdCounters');
}
function tdFocusOther(){
  var f = (typeof tdFocusSeat === 'function') ? tdFocusSeat() : '';
  return !!(f && TD.board && f !== TD.side);
}
/* Hidden, not removed, when the board built the panel; called on every path out of tdRender that draws a page. An
   empty .td-top still draws its background. */
function tdSyncTopStrip(){
  var topEl = document.getElementById('tdTop');
  if(topEl) topEl.hidden = !!document.getElementById('tdPlayCtrs') || tdFocusOther();
}
/* The step colours are built here with the pills' highlight band (kwGrad, 38-54%), not added to KW_HLSETS, which is
   the keyword editor's picker. */
function tdStepGrad(base, band){
  var A = 'var(--holo-ang,120deg)', lo = 38, hi = 54, n = band.length;
  var out = [base + ' 0%'];
  band.forEach(function(c, i){
    out.push(c + ' ' + (lo + (hi - lo) * (n === 1 ? 0.5 : i / (n - 1))).toFixed(2) + '%');
  });
  out.push(base + ' 100%');
  return 'linear-gradient(' + A + ',' + out.join(',') + ')';
}
/* out, fill, ink and o are the four a keyword pill carries, so .td-turn-name wears the pill's text outline. */
/* tint is set (--st-tint) and not read: the band would cross the word on a 20px phase row (testdeck.css,
   .td-turn-ph.on). */
var TD_STEP_LOOK = {
  main:   {out: tdStepGrad('#12245e', ['#fff3b0', '#cdf5c0']),
           fill: tdStepGrad('#1c3f9e', ['#e9dc8a', '#a8e0a0']),
           tint: '#22367e', ink: '#ffffff', o: '#0d1a44'},
  battle: {out: tdStepGrad('#5e1218', ['#ffffff', '#4a4a52']),
           fill: tdStepGrad('#9e1c24', ['#f2f2f4', '#5a5a63']),
           tint: '#7d1a21', ink: '#ffffff', o: '#44090e'}
};
function tdStepVars(id){
  var L = TD_STEP_LOOK[id] || TD_STEP_LOOK.main;
  return '--st-out:' + L.out + ';--st-fill:' + L.fill
       + ';--st-tint:' + L.tint
       + ';--st-ink:' + L.ink + ';--st-o:' + L.o;
}

/* The tracker moves one phase at a time: the live phase's Pass, the per-phase On/Off (every turn), and the step's
   Pass (the rest of the step, this turn). A Battle phase waits until every seated player has passed it. */

/* At a table the tracker shows the turn being played (HANDOFF §76.7): during another's turn Main is theirs alone,
   and in Battle Pass is priority, moving nothing of yours (tdNotePass). */
function tdTurnBoard(){
  if(TD.watching || typeof tblOn !== 'function' || !tblOn() || typeof TBL === 'undefined')
    return TD.board;
  if(!TBL.turn || TBL.turn === TD.side) return TD.board;
  if(typeof tblTurnFree === 'function' && tblTurnFree()) return TD.board;
  /* their half before it has arrived: their turn all the same, at its start */
  return tdFoeOf(TBL.turn) || {side:TBL.turn};
}
function tdTurnMine(){ return tdTurnBoard() === TD.board; }
window.tdTurnBoard = tdTurnBoard;
window.tdTurnMine = tdTurnMine;

/* Alone that is just you, so a pass advances at once. */
function tdSeats(){
  if(typeof tblOn === 'function' && tblOn() && typeof tblSeated === 'function'){
    var s = tblSeated();
    if(s && s.length) return s;
  }
  return [TD.side || 'a'];
}

/* Who has passed is local and keyed by step, phase and turn number: what arrives is applied to their half only
   (tdApplyTo), and the key empties itself when the position moves. */
function tdPassKey(t){ return t.step + ':' + t.phase + ':' + t.n; }
function tdPassers(t){
  var k = tdPassKey(t);
  if(!TD.passers || TD.passers.key !== k) TD.passers = {key:k, seats:{}};
  return TD.passers.seats;
}
/* Main is yours alone; Battle goes round the table. */
function tdPassReady(t){
  if(t.step !== 'battle') return true;
  var who = tdPassers(t), seats = tdSeats();
  for(var i = 0; i < seats.length; i++) if(!who[seats[i]]) return false;
  return true;
}
function tdPassWaiting(t){
  if(t.step !== 'battle') return [];
  var who = tdPassers(t);
  return tdSeats().filter(function(s){ return !who[s]; });
}

function tdNotePass(a){
  if(!a || !a.side || !TD.board) return;
  var t = tdTurnOf(tdTurnBoard());
  /* A pass of a phase you are not on is old or, on replay, your own, and would credit the wrong phase; one naming its
     turn is held to it. */
  if(a.step !== t.step || (parseInt(a.phase, 10) || 0) !== t.phase) return;
  if(a.n != null && (parseInt(a.n, 10) || 0) !== t.n) return;
  tdPassers(t)[a.side] = 1;
  /* Only a live pass from another player moves anything: TD.logOn is off on replay, and your own pass advances in the
     function that sent it. Only the holder's tracker moves. */
  if(!TD.logOn || a.side === TD.side) return;
  if(tdTurnMine() && tdPassReady(t)) tdPassChain(tdAdvance());
  else tdRenderTurn();
}

/* The per-phase automatics default off, so not tdAutoGet, whose unreadable-storage answer is on. */
function tdPassAutoKey(step, ph){
  return 'conjure_td_pass_' + (REBIRTH ? 'rb_' : '') + step + '_' + ph;
}
function tdPassAutoGet(step, ph){
  try{ return localStorage.getItem(tdPassAutoKey(step, ph)) === '1'; }
  catch(_){ return false; }
}
function tdPassAutoSet(step, ph, on){
  try{ localStorage.setItem(tdPassAutoKey(step, ph), on ? '1' : '0'); }catch(_){}
}
window.tdPassAutoToggle = function(step, ph){
  tdPassAutoSet(step, ph, !tdPassAutoGet(step, ph));
  tdRenderTurn();
};

/* Armed for one turn by its number, not a flag to clear, and never sent: it is not a fact about the game. */
function tdSkipOn(n, step){
  return !!(TD.skip && TD.skip.n === n && TD.skip[step]);
}
function tdSkipArm(n, step){
  if(!TD.skip || TD.skip.n !== n) TD.skip = {n:n};
  TD.skip[step] = true;
}
function tdAutoPassed(t){
  var st = tdStepDef(t.step), ph = st.phases[t.phase];
  if(!ph) return false;
  return tdSkipOn(t.n, t.step) || tdPassAutoGet(t.step, ph.id);
}

/* Returns what it did, which stops the chain. */
function tdAdvance(){
  var t = tdTurnOf(TD.board);
  var st = tdStepDef(t.step);
  if(t.phase + 1 < st.phases.length){
    tdDo({t:'phase', step:t.step, phase:t.phase + 1, stepped:true});
    return 'phase';
  }
  if(t.step === 'main'){
    tdDo({t:'phase', step:'battle', phase:0, stepped:true});
    return 'step';
  }
  tdDo({t:'phase', step:'main', phase:0, newTurn:true});
  tdNewTurn();
  return 'turn';
}

/* The automatics fire on the way into Main, by a pass only (not on a deal), each its own undoable action. */
function tdNewTurn(){
  /* At a table the end of your turn only hands it on: the unlock and the draw wait for tdTurnArrived (HANDOFF §76.7). */
  if(typeof tblOn === 'function' && tblOn() && typeof TBL !== 'undefined'
     && TBL.turn === TD.side){
    if(typeof tdDmPicksTurn === 'function' && tdDmPicksTurn()){
      tdDmPickTurn(function(s){
        if(TBL.turn !== TD.side) return;
        tblHandOn(false, s);
        tdUndoFloorHere();
      });
      return;
    }
    if(typeof tblHandOn === 'function'){ try{ tblHandOn(false); }catch(_){} }
    tdUndoFloorHere();             /* handed on: Undo stops here (tdCanUndo) */
    return;
  }
  var did = tdRunAutomatics();
  if(typeof toast === 'function' && did.length)
    toast('New turn - ' + did.join(', '));
}
/* Called by the table when the turn comes to you: the automatics fire here. */
function tdTurnArrived(){
  if(!TD.board || TD.watching || !tdTurnOn()) return;
  var did = tdRunAutomatics();
  tdRender();
  if(typeof toast === 'function')
    toast('Your turn' + (did.length ? ' - ' + did.join(', ') : ''));
}
window.tdTurnArrived = tdTurnArrived;
/* The top row's Pass: the turn ends where it stands, the tracker goes to the next Main, and the automatics wait for
   the turn to come back. */
function tdEndTurnHere(){
  if(!TD.board || !tdTurnOn()) return;
  tdDo({t:'phase', step:'main', phase:0, newTurn:true});
  /* tblPass hands the turn on straight after: Undo stops here (tdCanUndo). */
  if(typeof tblOn === 'function' && tblOn()) tdUndoFloorHere();
  tdRender();
}
window.tdEndTurnHere = tdEndTurnHere;
function tdRunAutomatics(){
  var did = [];
  if(tdAutoGet('unlock')){
    ['field', 'essarea'].forEach(function(z){
      var items = TD.board.zones[z];
      if(!items || !items.length) return;
      if(!items.some(function(it){ return it.locked; })) return;
      tdDo({t:'lockZone', zone:z, on:false});
      did.push('unlocked the ' + tdZoneWords(z));
    });
  }
  if(tdAutoGet('draw') && tdDraw(1)) did.push('drew');
  return did;
}

function tdPassOnce(seat){
  var t = tdTurnOf(TD.board);
  tdPassers(t)[seat] = 1;
  /* Sent only at a table: alone, the pass and the move are one event, one line and one undo step. */
  if(tdSeats().length > 1)
    tdDo({t:'pass', side:seat, step:t.step, phase:t.phase, n:t.n});
  if(!tdPassReady(t)) return '';
  return tdAdvance();
}

/* The chain runs only inside a pass, never on render or undo, and stops at the end of a turn; the count is a second
   guard. */
function tdPassChain(last){
  var seat = TD.side || 'a';
  for(var i = 0; i < 24 && last && last !== 'turn'; i++){
    if(!tdAutoPassed(tdTurnOf(TD.board))) break;
    last = tdPassOnce(seat);
  }
  tdRender();
}

/* During another's turn it is priority, in Battle only. */
window.tdPassPhase = function(){
  if(!tdTurnOn()) return;
  if(!tdTurnMine()){ tdPassPriority(); return; }
  tdPassChain(tdPassOnce(TD.side || 'a'));
};
function tdPassPriority(){
  var t = tdTurnOf(tdTurnBoard());
  if(t.step !== 'battle') return;              /* Main is the holder's alone */
  if(tdPassers(t)[TD.side]) return;            /* said already */
  tdDo({t:'pass', side:TD.side, step:t.step, phase:t.phase, n:t.n});
  tdRenderTurn();
}

/* Arms rather than jumps: your passes are given as each phase comes up, and the table is still waited for. */
window.tdPassStep = function(){
  if(!tdTurnOn() || !tdTurnMine()) return;     /* the turn holder's alone */
  var t = tdTurnOf(TD.board);
  tdSkipArm(t.n, t.step);
  tdPassChain(tdPassOnce(TD.side || 'a'));
};

function tdPhaseRowHTML(step, ph, i, cur, live, ro, t){
  var on = live && i === cur;
  /* Neither toggle is the row: each stops the event, as the row's handler is on the ancestor. */
  var pa = tdPassAutoGet(step.id, ph.id);
  var left = "<button class='td-turn-pa" + (pa ? ' on' : '') + "'"
    + " onclick=\"event.stopPropagation();tdPassAutoToggle('"
      + step.id + "','" + ph.id + "')\""
    + " aria-pressed='" + (pa ? 'true' : 'false') + "'"
    + " title='" + e('Pass ' + ph.label + ' automatically, every turn, without '
        + 'stopping here') + "'>" + (pa ? 'On' : 'Off') + "</button>";
  var right = '';
  /* Only the live row carries a Pass, as only the live step does. */
  if(on && !ro) right += "<button class='td-turn-pass td-turn-pass1'"
    + " onclick=\"event.stopPropagation();tdPassPhase()\""
    + " title='" + e('Pass the ' + ph.label + ' phase') + "'>Pass</button>";
  else if(on && step.id === 'battle'){
    right += (t && tdPassers(t)[TD.side])
      ? "<span class='td-turn-passed' title='" + e('You have passed ' + ph.label) + "'>Passed</span>"
      : "<button class='td-turn-pass td-turn-pass1'"
        + " onclick=\"event.stopPropagation();tdPassPhase()\""
        + " title='" + e('Pass priority - ' + ph.label + ' is done for you') + "'>Pass</button>";
  }
  if(ph.toggle){
    var isOn = tdAutoGet(ph.toggle);
    right += "<button class='td-turn-tog" + (isOn ? ' on' : '') + "'"
      + " onclick=\"event.stopPropagation();tdAutoToggle('" + ph.toggle + "')\""
      + " aria-pressed='" + (isOn ? 'true' : 'false') + "'"
      /* Named for what it does; aria-pressed says On or Off. */
      + " aria-label='" + (ph.toggle === 'unlock' ? 'Unlock automatically' : 'Draw automatically') + "'"
      + " title='" + e(ph.toggle === 'unlock'
          ? 'Unlock the Field and Essence area automatically when the turn comes back to Main'
          : 'Draw one card automatically when the turn comes back to Main') + "'>"
      + (isOn ? 'On' : 'Off') + "</button>";
  }
  return "<div class='td-turn-ph" + (on ? ' on' : '') + (ro ? ' ro' : '') + "'"
    + (ro ? '' : " onclick=\"tdSetPhase('" + step.id + "'," + i + ")\"")
    + " title='" + e(ph.label + ' phase') + "'>"
    + left
    /* aria-hidden: the row's .on says it, and a lone triangle read aloud is noise. */
    + (on ? "<span class='td-turn-arw' aria-hidden='true'>▶</span>" : '')
    + "<span class='td-turn-phn'>" + e(ph.label) + "</span>" + right + "</div>";
}

function tdTurnHTML(){
  if(!tdTurnOn()) return '';
  var tb = tdTurnBoard(), ro = (tb !== TD.board);
  var t = tdTurnOf(tb);
  var whose = ro ? "<div class='td-turn-whose'><span class='tbl-s tbl-seat-" + e(TBL.turn) + "'></span>"
      + e(((typeof tblSeatName === 'function') ? tblSeatName(TBL.turn) : 'Their') + "'s turn")
      + "</div>" : '';
  return "<div class='td-turn" + (ro ? ' td-turn-ro' : '') + "' aria-label='Turn tracker'>" + whose
    + tdSteps().map(function(st){
        var live = (st.id === t.step);
        return "<div class='td-turn-step td-turn-" + st.id
          + (live ? ' live' : '') + "' style='" + tdStepVars(st.id) + "'>"
          + "<div class='td-turn-head'"
            + (ro ? '' : " onclick=\"tdSetPhase('" + st.id + "',0)\"") + ">"
            + "<span class='td-turn-name'>" + e(st.label) + "</span>"
            /* Only the live step carries a Pass: two would be two ways to advance one turn. */
            + ((live && !ro) ? ("<button class='td-turn-pass' onclick=\"event.stopPropagation();tdPassStep()\""
                + " title='" + e('Pass every remaining phase of the ' + st.label
                    + ' step - this turn only') + "'>Pass</button>") : '')
          + "</div>"
          /* Both steps show all their phases, always (HANDOFF §36.3); the step you are not in is dimmed, and its rows still
             take you back. */
          + "<div class='td-turn-phases'>"
              + st.phases.map(function(ph, i){
                  return tdPhaseRowHTML(st, ph, i, t.phase, live, ro, t);
                }).join('')
              + (live ? tdTurnWaitHTML(t) : '')
            + "</div>"

        + "</div>";
      }).join('')
    + "</div>";
}
/* A sentence, not a block: nothing is disabled while it shows. */
function tdTurnWaitHTML(t){
  var w = tdPassWaiting(t);
  if(!w.length) return '';
  /* A phase nobody has passed is not waiting: alone, a pass advances at once. */
  var some = tdPassers(t);
  if(!tdSeats().some(function(s){ return !!some[s]; })) return '';
  var names = w.map(function(s){
    if(s === TD.side) return 'you';
    return (typeof tblSeatName === 'function') ? tblSeatName(s) : s;
  });
  return "<div class='td-turn-wait'>waiting on " + e(names.length > 1
    ? (names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1])
    : names[0]) + "</div>";
}

/* Measured: no CSS shrinks text to fit (clamp() and container units size the box), so scrollWidth over clientWidth
   gives the size, down to TD_PH_FIT_MIN, then the ellipsis. Never past the styled 115%. */
var TD_PH_FIT_MIN = 0.74;      /* em, against the row's own .8rem */
function tdFitPhase(host){
  var lab = host && host.querySelector('.td-turn-ph.on .td-turn-phn');
  if(!lab) return;
  lab.style.fontSize = '';                       /* back to the styled 1.15em */
  var want = lab.clientWidth, have = lab.scrollWidth;
  if(!want || have <= want + 0.5) return;        /* it already fits */
  var s = Math.max(TD_PH_FIT_MIN, 1.15 * (want / have));
  lab.style.fontSize = s.toFixed(3) + 'em';
  if(lab.scrollWidth > lab.clientWidth + 0.5)
    lab.style.fontSize = Math.max(TD_PH_FIT_MIN, s * 0.94).toFixed(3) + 'em';
}
function tdRenderTurn(){
  var host = document.getElementById('tdTurn');
  if(!host) return;
  host.innerHTML = tdTurnHTML();
  tdFitPhase(host);
}

/* A phase click is a bookmark in your step and a way back in the other; neither is a pass, so the turn number holds. */
window.tdSetPhase = function(stepId, i){
  if(!tdTurnOn() || !tdTurnMine()) return;     /* the turn holder's alone */
  var st = tdStepDef(stepId);
  var t = tdTurnOf(TD.board);
  var idx = Math.max(0, Math.min(st.phases.length - 1, parseInt(i, 10) || 0));
  if(t.step === st.id && t.phase === idx) return;
  tdDo({t:'phase', step:st.id, phase:idx});
  tdRenderTurn();
};


function tdRenderCounters(){
  var host = tdCtrHost();
  if(!host) return;
  /* Stray dropdowns first: tdToggleDrop moves an open list to body with its id, and a rebuilt copy would make two. */
  TD_DROPS.forEach(function(id){
    var stray = document.getElementById('td' + id + 'Drop');
    if(stray && stray.parentNode === document.body)
      stray.parentNode.removeChild(stray);
  });
  /* A spectator owns no board, so the whole set goes: the life total would be a player's. */
  if(!TD.board || TD.watching){ host.innerHTML = ''; return; }
  var defs = (typeof tdRbDmOnly === 'function' && tdRbDmOnly(TD.board)
              && typeof tdRbOn === 'function' && tdRbOn()) ? [] : tdCounterDefs();
  /* Rewards is not a board; Encounter keeps the controls, as the counter buttons are its only way to put a counter down. */
  if(tdIsRewards()){ host.innerHTML = ''; return; }

  var trackers = defs.map(function(d){
      var v = TD.board.counters[d.id];
      if(v == null) v = d.start;
      /* Every stat is its orb, the card face's own SVG at the same value, with its adjusters in a column to the left and a
         field under them that sets the total. */
      var orb = tdStatOrbBox(d.id, v);
      /* The buttons wear their stat's colour from ORB_FILL, the map edOrbSvg paints from. */
      var tint = tdStatTint(d.id);
      /* data-ctr names the stat, so a rule for Life's adjusters does not also grow Rebirth's three. */
      return "<div class='td-ctr td-ctr-stat' data-ctr='" + e(d.id) + "'"
        + (tint ? " style='--stat-fill:" + tint.fill + ";--stat-ink:" + tint.ink + "'" : '')
        + (d.hint ? " title='" + e(d.hint) + "'" : '') + ">"
        + "<span class='td-ctr-btns'>"
        + TD_ADJ.slice().reverse().map(function(n){
            /* aria-label: "+10" alone does not say what goes up. */
            return "<button class='td-ctr-b" + (n > 0 ? ' up' : ' dn')
              + (tint ? ' td-ctr-b-tint' : '') + "'"
              + " aria-label='" + e((n > 0 ? '+' + n : String(n)) + ' ' + d.label) + "'"
              + " onclick=\"tdAdj('" + d.id + "'," + n + ")\">"
              + (n > 0 ? '+' + n : n) + "</button>";
          }).join('')
        /* Set, not add, under the bottom button; Enter commits. */
        + "<input class='td-ctr-set' type='text' inputmode='numeric'"
          + " id='tdCtrIn-" + d.id + "' size='3' autocomplete='off' spellcheck='false'"
          + " placeholder='set'"
          + " aria-label='" + e('Set ' + d.label + ' outright') + "'"
          + " title='" + e('Type a number and press Enter to set ' + d.label) + "'"
          + " onfocus='this.select()'"
          + " onkeydown=\"tdCtrKey(event,'" + d.id + "')\">"
        + "</span>"
        + "<span class='td-ctr-valbox'>" + orb
        + (d.hint ? "<span class='td-ctr-warn'>!</span>" : '') + "</span>"
        + "</div>";
    }).join('');

  /* These make a movable piece on the board, not another number by the totals. Keyword is every keyword (mode
     'keyword'), Special the named counters (mode 'counter'); +1, -1 and Copy wear their counters' colours. */
  var kwList = tdKwCounterList();
  var otherList = tdOtherCounterList();
  /* The editor's own pill gradients (KW_HLSETS), so the dropdowns match the pills inside them; plain two-colour
     without the editor half. */
  function drop(id, label, out, outHl, fill, fillHl, hl, text){
    var g = (typeof window.edKwGrad === 'function')
      ? function(a, b){ return window.edKwGrad(a, b, hl); }
      : function(a, b){ return 'linear-gradient(var(--holo-ang,120deg),'
          + a + ' 0%,' + b + ' 46%,' + a + ' 100%)'; };
    return "<button class='td-mkbtn td-dropb' id='td" + id + "DropBtn'"
      + " style='--drop-out:" + g(out, outHl) + ";--drop-fill:" + g(fill, fillHl)
        + ";--drop-ink:" + out + ";--drop-text:" + (text || out) + "'"
      + " aria-haspopup='true' aria-expanded='false'"
      + " onclick=\"tdToggleDrop(event,'" + id + "')\">"
      + label + " <span class='td-caret' aria-hidden='true'>&#9662;</span></button>";
  }
  /* data-kw and a bound handler, never an inline onclick: a keyword name is user text (HANDOFF §24.2). */
  function pillItems(list){
    return list.length
      ? list.map(function(k){
          return "<button class='td-kwdrop-item' role='menuitem' data-kw='" + e(k.name) + "'>"
            + tdPillLook(k.name, tdCtrShortName(k.name)) + "</button>";
        }).join('')
      : "<div class='td-ctr-none'>This set defines none</div>";
  }
  /* No +1, -1 or Copy in Rebirth, alone or at a table; the three lists and the Dice Tray stay. */
  var mkBox = "<div class='td-ctr td-ctr-mk td-ctr-make'>"
    + (REBIRTH ? '' : ("<span class='td-mkrow'>"
      + "<button class='td-mkbtn td-mk-plus' onclick=\"tdAddToken('plus')\""
      + " title='Put a +1 counter on the board' aria-label='Put a +1 counter on the board'>+1</button>"
      + "<button class='td-mkbtn td-mk-minus' onclick=\"tdAddToken('minus')\""
      + " title='Put a -1 counter on the board' aria-label='Put a -1 counter on the board'>&minus;1</button>"
      + "<button class='td-mkbtn td-mk-copy' onclick=\"tdAddToken('emblem')\""
      + " title='Mark a card as a copy of another' aria-label='Copy counter'>&#10697; Copy</button>"
    + "</span>"))
    + "<span class='td-mkrow td-mkrow-drops'>"
      /* White on Keyword and Special; Color's pale fill letters in its own outline colour. All three are outlined in
         --drop-ink. */
      + drop('Kw',  'Keyword', '#1100ff', '#ff00ff', '#0033ff', '#d400ff', 'platinum', '#ffffff')
      + drop('Sp',  'Special', '#e8e8d9', '#ff00f7', '#ebe6d5', '#6feccd', 'fiery', '#ffffff')
      + drop('Col', 'Color',   '#0c2b32', '#aba9fe', '#9ec8f0', '#7ad1c7', 'irid')
      /* In the drops column, the same 29px shape as the lists, gold on purple as it opens a window, not a list. */
      + "<button class='td-mkbtn td-dicebtn' id='tdDiceBtn'"
        + " onclick='tdToggleDiceTray()'"
        + " title='Open the dice tray' aria-label='Dice Tray'>&#9860; Dice Tray</button>"
    + "</span>"
    + "<div class='td-kwdrop' id='tdKwDrop' role='menu' aria-label='Keyword counters' hidden>" + pillItems(kwList) + "</div>"
    + "<div class='td-kwdrop' id='tdSpDrop' role='menu' aria-label='Special counters' hidden>" + pillItems(otherList) + "</div>"
    + "<div class='td-kwdrop td-coldrop' id='tdColDrop' role='menu' aria-label='Color counters' hidden>"
      /* The names are from TD_COLOR_NAMES, a fixed list, so this inline onclick carries no user text (HANDOFF §24.2). */
      + TD_COLOR_NAMES.map(function(n){
          return "<button class='td-colpick-b' role='menuitem'"
            + " style='--tok-fill:" + tdColorFill(n) + ";--tok-ink:" + tdColorInk(n) + "'"
            + " onclick=\"tdCloseDrops();tdAddToken('color','" + n + "')\""
            + " title='Put a " + n + " counter on the board'>"
            + tdColorMana(n) + "<span class='td-colname'>" + n + "</span></button>";
        }).join('')
    + "</div></div>";
  var tokenBox = '';

  /* Emitted empty and filled by tdRenderTurn, so a phase click redraws the tracker without rebuilding the counter
     boxes, whose lists may be open. */
  /* #tdPlayBar is emitted with this markup and filled by tdRenderBar after: never move the live element in, as the
     next innerHTML here destroys it (HANDOFF §36.1, §36.8). */
  host.innerHTML = "<div class='td-ctr-row'>" + trackers
    + "<div class='td-play-bar' id='tdPlayBar'></div>"
    + "<div id='tdTurn' class='td-turn-host'></div>"
    + mkBox + tokenBox + "</div>";
  tdRenderTurn();
  /* After the markup, which it fills; tdRender fills the bar itself only when this returns false. */
  var barDone = false;
  try{ tdRenderBar(); barDone = true; }catch(_){}
  /* The tray lives on body, but its button is rebuilt, so the lit state is put back. */
  try{ tdDiceSyncBtn(); }catch(_){}

  tdFitTitles(host);
  /* Wired from the data attribute, so no keyword name is ever parsed as code. */
  host.querySelectorAll('[data-kw]').forEach(function(b){
    b.addEventListener('click', function(){
      tdCloseDrops();
      /* Keyword and Special are both 'kw' to tdAddToken: the lists differ in what the set calls them. */
      tdAddToken('kw', b.dataset.kw);
    });
  });
  /* True when the bar was filled here; every return above leaves it to tdRender. */
  return barDone;
}

/* position:fixed and placed by hand on open: the buttons sit in scroll containers, which clip their children, and
   move as the panel scrolls. */
var TD_DROPS = ['Kw', 'Sp', 'Col'];
function tdCloseDrops(){
  TD_DROPS.forEach(function(id){
    var d = document.getElementById('td' + id + 'Drop');
    var b = document.getElementById('td' + id + 'DropBtn');
    if(d) d.hidden = true;
    if(b) b.setAttribute('aria-expanded', 'false');
  });
}
/* The name the outside-click and Escape handlers use. */
function tdCloseKwDrop(){ tdCloseDrops(); }
function tdPlaceDrop(d, b){
  var r = b.getBoundingClientRect();
  d.style.left = '0px'; d.style.top = '0px';   /* measure unplaced */
  var w = d.offsetWidth, h = d.offsetHeight;
  var vw = document.documentElement.clientWidth;
  var vh = document.documentElement.clientHeight;
  var x = Math.max(8, Math.min(r.left, vw - w - 8));
  var y = r.bottom + 5;
  if(y + h > vh - 8) y = Math.max(8, r.top - h - 5);
  d.style.left = Math.round(x) + 'px';
  d.style.top  = Math.round(y) + 'px';
}
function tdToggleDrop(ev, id){
  if(ev){ try{ ev.stopPropagation(); }catch(_){} }
  var d = document.getElementById('td' + id + 'Drop');
  var b = document.getElementById('td' + id + 'DropBtn');
  if(!d || !b) return;
  var open = d.hidden;
  tdCloseDrops();
  if(!open) return;                   /* it was the open one: closing is all */
  /* Moved to body before it is placed: position:fixed is against the window only while no ancestor has a transform. */
  if(d.parentNode !== document.body) document.body.appendChild(d);
  d.hidden = false;
  tdPlaceDrop(d, b);
  b.setAttribute('aria-expanded', 'true');
}

/* A press outside closes it, a press on the board included, which the list would otherwise swallow. */
(function(){
  if(document._tdKwDropBound) return;
  document._tdKwDropBound = true;
  document.addEventListener('pointerdown', function(ev){
    var anyOpen = TD_DROPS.some(function(id){
      var el = document.getElementById('td' + id + 'Drop');
      return el && !el.hidden;
    });
    if(!anyOpen) return;
    if(ev.target.closest && (ev.target.closest('.td-kwdrop')
                             || ev.target.closest('.td-dropb'))) return;
    tdCloseKwDrop();
  });
  document.addEventListener('keydown', function(ev){
    if(ev.key === 'Escape') tdCloseKwDrop();
  });
})();

/* On body, not in the board: position:fixed needs no transformed ancestor, and the tray survives the counters'
   re-render (tdDiceSyncBtn relights the new button). */
var TD_DICE_SIDES = [4, 6, 8, 10, 12, 20];
/* The game's colours through tdColorFill/tdColorInk, so a D4 is the red of a Red counter. */
var TD_DIE_COLOR = {4:'Red', 6:'Orange', 8:'Yellow', 10:'Green', 12:'Blue',
                    20:'Indigo'};
/* A cap on what is drawn, not rolled: every die is rolled, counted and listed, and the first thirty get a body. */
var TD_DICE_SHOWN = 30;
/* A cap on what is rolled too, far above any roll a game asks for, as every die is rolled and listed. */
var TD_DICE_MAX = 1000;
var _tdDice = {open:false, x:null, y:null, dice:[], sparks:[], coin:null,
               raf:null, W:520, H:300};
/* The same seven stops as --td-gold in testdeck.css, the tray's frame and total disc. */
var TD_COIN_GOLD = [[0, '#4a3818'], [.15, '#7a6030'], [.4, '#f5ecd0'],
                    [.5, '#e8c96a'], [.6, '#c9a84c'], [.85, '#7a6030'],
                    [1, '#4a3818']];

function tdDiceEl(){ return document.getElementById('tdDiceTray'); }
function tdDicePaths(){
  try{ return window.edDicePaths || null; }catch(_){ return null; }
}

/* Strict about what it accepts: a formula it cannot read says so rather than rolling a guess. */
function tdDiceParse(s){
  var out = {terms:[], flat:0, n:0};
  var txt = String(s || '').trim();
  if(!txt) return {err:'Type something like 2D6+2D4'};
  var bits = txt.split('+');
  for(var i = 0; i < bits.length; i++){
    var t = bits[i].trim();
    if(!t) return {err:'Stray + in "' + txt + '"'};
    var m = /^(\d*)[dD](\d+)$/.exec(t);
    if(m){
      var count = (m[1] === '') ? 1 : parseInt(m[1], 10);
      var sides = parseInt(m[2], 10);
      if(!count) return {err:'"' + t + '" is no dice at all'};
      if(count > TD_DICE_MAX || out.n + count > TD_DICE_MAX)
        return {err:'At most ' + TD_DICE_MAX + ' dice in one roll'};
      if(TD_DICE_SIDES.indexOf(sides) < 0)
        return {err:'D' + sides + ' is not one of the six - try D'
                    + TD_DICE_SIDES.join(', D')};
      out.terms.push({n:sides, count:count});
      out.n += count;
      continue;
    }
    if(/^\d+$/.test(t)){ out.flat += parseInt(t, 10); continue; }
    return {err:'Cannot read "' + t + '"'};
  }
  if(!out.terms.length) return {err:'That is a number, not a roll'};
  return out;
}

/* A canvas stroke cannot take the app's seven-stop border-image, so the stops become a gradient down the die. */
function tdDiceShade(hex, amt){
  var n = parseInt(String(hex).slice(1), 16);
  var r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  var f = function(c){
    return Math.max(0, Math.min(255, Math.round(
      amt > 0 ? c + (255 - c) * (amt / 100) : c * (1 + amt / 100))));
  };
  return 'rgb(' + f(r) + ',' + f(g) + ',' + f(b) + ')';
}
function tdDiceMetal(cx, base, ink, y0, y1){
  var g = cx.createLinearGradient(0, y0, 0, y1);
  g.addColorStop(0.00, ink);
  g.addColorStop(0.15, tdDiceShade(base, -52));
  g.addColorStop(0.40, tdDiceShade(base, 62));
  g.addColorStop(0.50, base);
  g.addColorStop(0.60, tdDiceShade(base, -24));
  g.addColorStop(0.85, tdDiceShade(base, -52));
  g.addColorStop(1.00, ink);
  return g;
}

var _tdDiceP2D = null;
function tdDiceShapes(){
  if(_tdDiceP2D) return _tdDiceP2D;
  var P = tdDicePaths();
  if(!P || typeof Path2D !== 'function') return null;
  _tdDiceP2D = {};
  TD_DICE_SIDES.forEach(function(n){
    if(!P[n]) return;
    _tdDiceP2D[n] = [new Path2D(P[n][0]), P[n][1] ? new Path2D(P[n][1]) : null];
  });
  return _tdDiceP2D;
}
function tdDiceDrawOne(cx, d, S){
  var R = d.R, base = tdColorFill(TD_DIE_COLOR[d.n]), ink = tdColorInk(TD_DIE_COLOR[d.n]);
  if(d.flash > 0){
    var g = cx.createRadialGradient(d.x, d.y, 0, d.x, d.y, R * 2.6);
    g.addColorStop(0, 'rgba(255,246,216,' + (0.72 * d.flash) + ')');
    g.addColorStop(0.45, 'rgba(232,201,106,' + (0.28 * d.flash) + ')');
    g.addColorStop(1, 'rgba(232,201,106,0)');
    cx.fillStyle = g;
    cx.beginPath(); cx.arc(d.x, d.y, R * 2.6, 0, 7); cx.fill();
  }
  if(d.ring > 0 && d.ring < 1){
    cx.strokeStyle = 'rgba(232,201,106,' + (0.65 * (1 - d.ring)) + ')';
    cx.lineWidth = 2;
    cx.beginPath(); cx.arc(d.x, d.y, R * (0.7 + d.ring * 1.9), 0, 7); cx.stroke();
  }
  cx.save();
  cx.translate(d.x, d.y); cx.rotate(d.a);
  var s = (R * 2) / 24; cx.scale(s, s); cx.translate(-12, -12);
  cx.lineJoin = 'round';
  cx.fillStyle = ink; cx.globalAlpha = .82;
  cx.fill(S[d.n][0]); cx.globalAlpha = 1;
  cx.lineWidth = 2.3;
  cx.strokeStyle = tdDiceMetal(cx, base, ink, 0, 24);
  cx.stroke(S[d.n][0]);
  if(S[d.n][1]){
    /* Faded once landed: on a D4 the inner line and the numeral want the same pixels. */
    cx.globalAlpha = d.rest ? .22 : .6; cx.lineWidth = 1.4;
    cx.strokeStyle = tdDiceShade(base, -30);
    cx.stroke(S[d.n][1]); cx.globalAlpha = 1;
  }
  cx.restore();
  if(d.rest){
    cx.font = '700 ' + Math.round(R * 0.86) + 'px Cinzel, serif';
    cx.fillStyle = base; cx.textAlign = 'center'; cx.textBaseline = 'middle';
    cx.shadowColor = 'rgba(0,0,0,.9)'; cx.shadowBlur = 3;
    /* a triangle's mass is low, so its numeral sits low with it */
    cx.fillText(d.v, d.x, d.y + (d.n === 4 ? R * 0.30 : 0));
    cx.shadowBlur = 0;
  }
}
/* A flip is drawn: the coin is an ellipse whose height is cos(th) of its width, and the sign of that cosine picks
   the face, so face and squash cannot disagree. */
function tdCoinDraw(cx, c){
  var R = c.R, s = Math.cos(c.th), h = Math.abs(s) * R, TH = 8;
  if(c.flash > 0){
    var fg = cx.createRadialGradient(c.x, c.y, 0, c.x, c.y, R * 1.9);
    fg.addColorStop(0, 'rgba(255,246,216,' + (0.62 * c.flash) + ')');
    fg.addColorStop(0.45, 'rgba(232,201,106,' + (0.26 * c.flash) + ')');
    fg.addColorStop(1, 'rgba(232,201,106,0)');
    cx.fillStyle = fg;
    cx.beginPath(); cx.arc(c.x, c.y, R * 1.9, 0, 7); cx.fill();
  }
  if(c.ring > 0 && c.ring < 1){
    cx.strokeStyle = 'rgba(232,201,106,' + (0.7 * (1 - c.ring)) + ')';
    cx.lineWidth = 3;
    cx.beginPath(); cx.arc(c.x, c.y, R * (0.8 + c.ring * 1.1), 0, 7); cx.stroke();
  }
  cx.save();
  cx.translate(c.x, c.y);
  var eg = cx.createLinearGradient(0, -h, 0, h + TH);
  eg.addColorStop(0, '#2c2008'); eg.addColorStop(.5, '#8a6f2a');
  eg.addColorStop(1, '#2c2008');
  cx.fillStyle = eg;
  cx.beginPath(); cx.ellipse(0, TH, R, Math.max(h, 0.8), 0, 0, 7); cx.fill();
  cx.beginPath(); cx.rect(-R, 0, R * 2, TH); cx.fill();
  var g = cx.createLinearGradient(0, -h, 0, h);
  for(var i = 0; i < TD_COIN_GOLD.length; i++)
    g.addColorStop(TD_COIN_GOLD[i][0], TD_COIN_GOLD[i][1]);
  cx.fillStyle = g;
  cx.beginPath(); cx.ellipse(0, 0, R, Math.max(h, 0.8), 0, 0, 7); cx.fill();
  cx.strokeStyle = 'rgba(58,42,14,.8)'; cx.lineWidth = 2;
  cx.beginPath(); cx.ellipse(0, 0, R, Math.max(h, 0.8), 0, 0, 7); cx.stroke();
  /* One scale inside a clip squashes the whole face; the clip keeps the beading and the word inside the rim edge on. */
  cx.beginPath(); cx.ellipse(0, 0, R, Math.max(h, 0.8), 0, 0, 7); cx.clip();
  cx.scale(1, Math.max(Math.abs(s), 0.0015));
  cx.strokeStyle = 'rgba(74,56,24,.75)'; cx.lineWidth = 2.4;
  cx.beginPath(); cx.arc(0, 0, R * 0.80, 0, 7); cx.stroke();
  cx.strokeStyle = 'rgba(245,236,208,.34)'; cx.lineWidth = 1.2;
  cx.beginPath(); cx.arc(0, 0, R * 0.735, 0, 7); cx.stroke();
  cx.fillStyle = 'rgba(74,56,24,.6)';
  for(var b = 0; b < 30; b++){
    var a2 = b / 30 * Math.PI * 2;
    cx.beginPath();
    cx.arc(Math.cos(a2) * R * 0.895, Math.sin(a2) * R * 0.895, R * 0.026, 0, 7);
    cx.fill();
  }
  var word = (s >= 0) ? 'Heads' : 'Tails';
  cx.font = '700 ' + Math.round(R * 0.40) + "px Cinzel, serif";
  cx.textAlign = 'center'; cx.textBaseline = 'middle';
  try{ cx.letterSpacing = Math.round(R * 0.03) + 'px'; }catch(_){}
  cx.lineWidth = Math.max(2.5, R * 0.05); cx.lineJoin = 'round';
  cx.strokeStyle = '#3a2a0e'; cx.strokeText(word, 0, 0);
  cx.fillStyle = '#fff6d8'; cx.fillText(word, 0, 0);
  try{ cx.letterSpacing = '0px'; }catch(_){}
  cx.restore();
}

function tdDiceDraw(){
  var cv = document.getElementById('tdDiceCv');
  var S = tdDiceShapes();
  if(!cv || !S) return;
  var cx = cv.getContext('2d');
  cx.clearRect(0, 0, _tdDice.W, _tdDice.H);
  cx.strokeStyle = 'rgba(201,168,76,.16)'; cx.lineWidth = 1;
  cx.beginPath(); cx.moveTo(8, _tdDice.H - 12); cx.lineTo(_tdDice.W - 8, _tdDice.H - 12);
  cx.stroke();
  if(_tdDice.coin) tdCoinDraw(cx, _tdDice.coin);
  _tdDice.dice.forEach(function(d){ tdDiceDrawOne(cx, d, S); });
  _tdDice.sparks.forEach(function(s){
    cx.globalAlpha = Math.max(0, s.life);
    cx.fillStyle = s.col;
    cx.beginPath(); cx.arc(s.x, s.y, 2.1, 0, 7); cx.fill();
  });
  cx.globalAlpha = 1;
}

/* The value is decided before the throw; only the tumble is simulated. */
/* d.col first, so the coin, which has no d.n, lands through the same code. */
function tdDiceSummon(d, n){
  d.flash = 1; d.ring = 0.001;
  var col = d.col || tdColorFill(TD_DIE_COLOR[d.n]);
  for(var i = 0; i < (n || 10); i++){
    var a = Math.random() * Math.PI * 2, sp = 1.6 + Math.random() * 2.6;
    _tdDice.sparks.push({x:d.x, y:d.y, vx:Math.cos(a) * sp,
                         vy:Math.sin(a) * sp - 1.2, life:1, col:col});
  }
}
function tdDiceStep(){
  var W = _tdDice.W, FLOOR = _tdDice.H - 14, moving = false;
  var c = _tdDice.coin;
  if(c){
    if(c.flash > 0) c.flash = Math.max(0, c.flash - 0.05);
    if(c.ring > 0 && c.ring < 1) c.ring = Math.min(1, c.ring + 0.035);
    if(!c.rest){
      c.vy += 0.62; c.y += c.vy; c.th += c.va;
      if(c.vy > 0 && c.y >= FLOOR - c.R){
        c.y = FLOOR - c.R;
        /* The snap only removes stepping slop: tdCoinFlip already chose the spin to match the result. */
        c.th = Math.round(c.th / Math.PI) * Math.PI;
        c.rest = true;
        tdDiceSummon(c, 26);
        tdCoinLand(c);
      }
      moving = true;
    }
    if(c.flash > 0 || (c.ring > 0 && c.ring < 1)) moving = true;
  }
  _tdDice.dice.forEach(function(d){
    if(d.flash > 0) d.flash = Math.max(0, d.flash - 0.055);
    if(d.ring > 0 && d.ring < 1) d.ring = Math.min(1, d.ring + 0.045);
    if(d.rest) return;
    d.vy += 0.62;
    d.x += d.vx; d.y += d.vy; d.a += d.va;
    if(d.y > FLOOR - d.R){ d.y = FLOOR - d.R; d.vy *= -0.42; d.vx *= 0.82; d.va *= 0.55; }
    if(d.x < 8 + d.R){ d.x = 8 + d.R; d.vx *= -0.55; d.va *= -0.7; }
    if(d.x > W - 8 - d.R){ d.x = W - 8 - d.R; d.vx *= -0.55; d.va *= -0.7; }
    if(Math.abs(d.vy) < 1.2 && Math.abs(d.vx) < 0.5 && d.y > FLOOR - 2 - d.R){
      d.rest = true; d.a = 0; tdDiceSummon(d);
    } else moving = true;
  });
  /* No die-on-die contact is modelled, so one sweep separates them, sideways first, then the higher onto a landed lower
     one; a stacked die is put to rest here, as the floor's rest test never passes it. */
  var ds = _tdDice.dice;
  for(var s = 0; s < 10; s++)
    for(var i = 0; i < ds.length; i++) for(var j = i + 1; j < ds.length; j++){
      var a = ds[i], b = ds[j], need = a.R + b.R + 2;
      var gap = a.x - b.x;
      if(Math.abs(gap) >= need || Math.abs(a.y - b.y) >= need) continue;
      var push = (need - Math.abs(gap)) / 2 * (gap < 0 ? -1 : 1);
      a.x = Math.min(W - 8 - a.R, Math.max(8 + a.R, a.x + push));
      b.x = Math.min(W - 8 - b.R, Math.max(8 + b.R, b.x - push));
      if(Math.abs(a.x - b.x) >= need - 0.5) continue;   /* sideways was enough */
      var hi = (a.y <= b.y) ? a : b, lo = (hi === a) ? b : a;
      if(!lo.rest) continue;
      hi.y = Math.max(hi.R + 2, lo.y - need);
      hi.vx = 0; hi.vy = 0;
      if(!hi.rest){ hi.rest = true; hi.a = 0; tdDiceSummon(hi); }
    }
  _tdDice.sparks = _tdDice.sparks.filter(function(sp){
    sp.vy += 0.16; sp.x += sp.vx; sp.y += sp.vy; sp.life -= 0.028;
    return sp.life > 0;
  });
  if(_tdDice.sparks.length) moving = true;
  if(_tdDice.dice.some(function(d){ return d.flash > 0 || (d.ring > 0 && d.ring < 1); }))
    moving = true;
  tdDiceDraw();
  /* Stops when nothing moves, rather than a frame every 16ms for dice at rest. */
  _tdDice.raf = moving ? requestAnimationFrame(tdDiceStep) : null;
}

/* Values are decided first, so a roll made here and one that arrived land alike. opts.sum: the total when not the
   drawn sum (a roll that arrived carries TD_DICE_SEND values); opts.more: values not sent; opts.held: the title. */
function tdDiceThrow(parsed, pick, opts){
  opts = opts || {};
  if(_tdDice.raf){ cancelAnimationFrame(_tdDice.raf); _tdDice.raf = null; }
  _tdDice.dice = []; _tdDice.sparks = [];
  /* Dice clear the coin, as a flip clears the dice (tdCoinLand). */
  _tdDice.coin = null;

  var rolled = [], k = 0;
  var shown = Math.min(parsed.n, TD_DICE_SHOWN);
  var R = shown <= 3 ? 26 : shown <= 8 ? 21 : shown <= 16 ? 17 : 13;
  var W = _tdDice.W;
  /* Spread over as much floor as this many dice want, clamped and centred: fixed columns streamed a crowd and left a
     small roll in one corner. */
  var COLS = Math.max(1, Math.min(10, shown));
  /* A span of zero for one die, so it lands in the middle. */
  var SPAN = COLS > 1 ? Math.min(W - 76, COLS * (R * 2 + 20)) : 0;
  var STEP = COLS > 1 ? SPAN / (COLS - 1) : 0;
  var X0 = (W - SPAN) / 2;
  parsed.terms.forEach(function(t){
    for(var i = 0; i < t.count; i++, k++){
      var v = pick(t.n, k);
      rolled.push(v);
      if(k >= TD_DICE_SHOWN) continue;
      _tdDice.dice.push({n:t.n, v:v, R:R,
        x:Math.min(W - 8 - R, Math.max(8 + R, X0 + (k % COLS) * STEP)),
        y:24 + Math.floor(k / COLS) * (R * 1.6),
        vx:(Math.random() - .5) * 4.4, vy:-1.5 - Math.random() * 2.2,
        a:Math.random() * 6, va:(Math.random() - .5) * 0.5,
        rest:false, flash:0, ring:0});
    }
  });
  var sum = (opts.sum != null) ? opts.sum
    : rolled.reduce(function(a, b){ return a + b; }, 0) + parsed.flat;

  var tot = document.getElementById('tdDiceTotal');
  var parts = document.getElementById('tdDiceParts');
  var held = document.getElementById('tdDiceHeld');
  tot.textContent = sum;
  tot.classList.remove('on'); void tot.offsetWidth; tot.classList.add('on');
  parts.innerHTML = rolled.join(' + ')
    + (opts.more ? ' + &hellip;' : '')
    + (parsed.flat ? " <em>(+" + parsed.flat + ")</em>" : '');
  parts.classList.add('on');
  held.textContent = (opts.held != null) ? opts.held
    : (parsed.n > TD_DICE_SHOWN)
      ? ('rolling all ' + parsed.n + ' - showing the first ' + TD_DICE_SHOWN) : '';

  if(REDUCED_MOTION_DICE()){
    _tdDice.dice.forEach(function(d, i){
      d.rest = true; d.a = 0;
      d.x = Math.min(W - 8 - d.R, Math.max(8 + d.R, 30 + i * (d.R * 2.3)));
      d.y = _tdDice.H - 14 - d.R;
    });
    tdDiceDraw();
  } else {
    _tdDice.raf = requestAnimationFrame(tdDiceStep);
  }
  return {rolled:rolled, sum:sum};
}

/* Values a shared roll carries: enough for the thirty drawn and a list; the total always travels whole. */
var TD_DICE_SEND = 60;

function tdDiceRoll(){
  var el = tdDiceEl(); if(!el) return;
  var inp = document.getElementById('tdDiceIn');
  var errEl = document.getElementById('tdDiceErr');
  var parsed = tdDiceParse(inp ? inp.value : '');
  if(parsed.err){
    errEl.textContent = parsed.err;
    if(inp) inp.classList.add('bad');
    return;
  }
  errEl.textContent = '';
  if(inp) inp.classList.remove('bad');
  var r = tdDiceThrow(parsed, function(n){ return Math.floor(Math.random() * n) + 1; });
  var formula = inp ? inp.value.trim() : '';
  var line = 'rolled ' + formula + ' - ' + r.sum;
  try{ tdFeedPush('me', line); }catch(_){}

  /* Rolled once, here, and the result sent, so the table has one roll (HANDOFF §54.6); the order of terms rides along. */
  var sent = [], k = 0;
  parsed.terms.forEach(function(t){
    for(var i = 0; i < t.count; i++, k++){
      if(sent.length < TD_DICE_SEND) sent.push([t.n, r.rolled[k]]);
    }
  });
  try{
    if(typeof tblShareRoll === 'function')
      tblShareRoll(line, {kind:'dice', formula:formula, dice:sent,
                          n:parsed.n, flat:parsed.flat, sum:r.sum});
  }catch(_){}
}

/* A roll another player made, thrown with their values if your tray is open; nothing is re-rolled. */
window.tdDiceReplay = function(p, who){
  if(!p || !tdDiceEl()) return false;
  var name = who || 'They';
  if(p.kind === 'coin'){
    tdCoinThrow(p.res === 'Tails' ? 'Tails' : 'Heads', name + ' flipped a coin');
    return true;
  }
  /* No more than a roll ever sends, each a pair. */
  var dice = Array.isArray(p.dice)
    ? p.dice.slice(0, TD_DICE_SEND).filter(function(d){ return Array.isArray(d); }) : [];
  if(!dice.length) return false;
  var terms = [];
  dice.forEach(function(d){
    var n = d[0] | 0;
    if(TD_DICE_SIDES.indexOf(n) < 0) n = 6;
    var last = terms[terms.length - 1];
    if(last && last.n === n) last.count++; else terms.push({n:n, count:1});
  });
  var parsed = {terms:terms, flat:(p.flat | 0), n:dice.length};
  var total = Math.max(dice.length, p.n | 0);
  tdDiceThrow(parsed, function(n, k){ return dice[k][1] | 0; },
              {sum:(p.sum != null ? p.sum : null),
               more:(total > dice.length ? total - dice.length : 0),
               held:name + ' rolled ' + String(p.formula || '')});
  return true;
};

/* A coin clears the box: a flip among the last roll's dice would sit beside their numbers and sum. */
function tdCoinLand(c){
  var parts = document.getElementById('tdDiceParts');
  if(!parts) return;
  /* The word appears when the coin lands: printed at throw time it would be read through the coin in the air. */
  parts.innerHTML = "<b class='td-dice-face'>" + c.res + "</b>";
  parts.classList.add('on');
}
/* The face is decided already; held is the title bar's text (empty for your own flip). */
function tdCoinThrow(res, held){
  var errEl = document.getElementById('tdDiceErr');
  var inp = document.getElementById('tdDiceIn');
  if(errEl) errEl.textContent = '';
  if(inp) inp.classList.remove('bad');
  if(_tdDice.raf){ cancelAnimationFrame(_tdDice.raf); _tdDice.raf = null; }
  _tdDice.dice = []; _tdDice.sparks = [];

  var heads = (res === 'Heads');
  /* The result is decided first and the spin's parity matches it, four spins of each, so the tumble says nothing. */
  var half = (heads ? [8, 10, 12, 14] : [7, 9, 11, 13])[Math.floor(Math.random() * 4)];
  var R = 72, VY = -12.6, G = 0.62;
  var flight = (2 * -VY) / G;
  _tdDice.coin = {x: _tdDice.W / 2, y: _tdDice.H - 14 - R, R: R,
                  vy: VY, th: 0, va: (half * Math.PI) / flight,
                  res: heads ? 'Heads' : 'Tails', col: '#e8c96a',
                  rest: false, flash: 0, ring: 0};

  var tot = document.getElementById('tdDiceTotal');
  var parts = document.getElementById('tdDiceParts');
  var hEl = document.getElementById('tdDiceHeld');
  /* The total disc is put away: a number left showing would read as the flip's answer. */
  if(tot){ tot.classList.remove('on'); tot.textContent = '—'; }
  if(parts){ parts.innerHTML = ''; parts.classList.remove('on'); }
  if(hEl) hEl.textContent = held || '';

  if(REDUCED_MOTION_DICE()){
    var c = _tdDice.coin;
    c.rest = true; c.th = heads ? 0 : Math.PI; c.vy = 0;
    tdCoinLand(c);
    tdDiceDraw();
    return;
  }
  _tdDice.raf = requestAnimationFrame(tdDiceStep);
}
window.tdCoinFlip = function(){
  var el = tdDiceEl(); if(!el) return;
  var res = Math.random() < 0.5 ? 'Heads' : 'Tails';
  tdCoinThrow(res, '');
  var line = 'flipped a coin - ' + res;
  try{ tdFeedPush('me', line); }catch(_){}
  try{
    if(typeof tblShareRoll === 'function') tblShareRoll(line, {kind:'coin', res:res});
  }catch(_){}
};

function REDUCED_MOTION_DICE(){
  try{ return matchMedia('(prefers-reduced-motion:reduce)').matches; }
  catch(_){ return false; }
}
window.tdDiceRoll = tdDiceRoll;
window.tdDiceKey = function(ev){
  var inp = document.getElementById('tdDiceIn');
  var errEl = document.getElementById('tdDiceErr');
  if(inp) inp.classList.remove('bad');
  if(errEl) errEl.textContent = '';
  if(ev && ev.key === 'Enter'){ ev.preventDefault(); tdDiceRoll(); }
  /* The board's keys listen in the capture phase, so this cannot stop them (tdKeysLive ignores a field); it keeps the
     key from the later handlers (Escape, Alt). */
  if(ev) ev.stopPropagation();
};

/* Each button wears its die's own shape and metal, from edDicePaths and tdDiceMetal's seven stops, as an SVG gradient. */
function tdDiceFaceSVG(n){
  var P = tdDicePaths();
  if(!P || !P[n]) return '';
  var base = tdColorFill(TD_DIE_COLOR[n]), ink = tdColorInk(TD_DIE_COLOR[n]);
  /* A fixed id is fine here, with one tray and one button per die; card faces use random uids, as url(#id) takes the
     first match in the document. */
  var gid = 'tdDiceFace' + n;
  var s = "<svg viewBox='0 0 24 24' aria-hidden='true'>"
    + "<defs><linearGradient id='" + gid + "' x1='0' y1='0' x2='0' y2='24'"
    +   " gradientUnits='userSpaceOnUse'>"
    +   "<stop offset='0' stop-color='" + ink + "'/>"
    +   "<stop offset='.15' stop-color='" + tdDiceShade(base, -52) + "'/>"
    +   "<stop offset='.4' stop-color='" + tdDiceShade(base, 62) + "'/>"
    +   "<stop offset='.5' stop-color='" + base + "'/>"
    +   "<stop offset='.6' stop-color='" + tdDiceShade(base, -24) + "'/>"
    +   "<stop offset='.85' stop-color='" + tdDiceShade(base, -52) + "'/>"
    +   "<stop offset='1' stop-color='" + ink + "'/>"
    + "</linearGradient></defs>"
    + "<path d='" + P[n][0] + "' fill='" + ink + "' fill-opacity='.82'"
    +   " stroke='url(#" + gid + ")' stroke-width='2.3' stroke-linejoin='round'/>";
  if(P[n][1])
    s += "<path d='" + P[n][1] + "' fill='none' stroke-linejoin='round'"
      +  " stroke='" + tdDiceShade(base, -30) + "' stroke-width='1.4'"
      +  " stroke-opacity='.5'/>";
  return s + "</svg>";
}
/* The same seven gold stops as the canvas coin. */
function tdCoinFaceSVG(){
  var s = "<svg viewBox='0 0 24 24' aria-hidden='true'>"
    + "<defs><linearGradient id='tdCoinFace' x1='0' y1='0' x2='0' y2='24'"
    +   " gradientUnits='userSpaceOnUse'>";
  for(var i = 0; i < TD_COIN_GOLD.length; i++)
    s += "<stop offset='" + TD_COIN_GOLD[i][0]
       + "' stop-color='" + TD_COIN_GOLD[i][1] + "'/>";
  return s + "</linearGradient></defs>"
    + "<circle cx='12' cy='12' r='10' fill='url(#tdCoinFace)'"
    +   " stroke='#3a2a0e' stroke-width='1.6'/>"
    + "<circle cx='12' cy='12' r='7.1' fill='none' stroke='#4a3818'"
    +   " stroke-width='1.1' stroke-opacity='.75'/></svg>";
}
function tdDiceQuickRow(){
  /* Left of the six, sized by its label: the row is auto repeat(6,1fr), so the six dice stay equal. */
  return "<div class='td-dice-quick'>"
    + "<button class='td-dice-q td-dice-coin' id='tdCoinBtn'"
      + " onclick='tdCoinFlip()' title='Flip a coin - heads or tails'>"
      + tdCoinFaceSVG() + "<span class='td-dice-qn'>Flip Coin</span></button>"
    + TD_DICE_SIDES.map(function(n){
    /* n is from TD_DICE_SIDES, a fixed list, so this inline onclick carries no user text (HANDOFF §24.2). */
    return "<button class='td-dice-q' onclick='tdDiceAdd(" + n + ")'"
      + " style='--dq-fill:" + tdColorFill(TD_DIE_COLOR[n])
        + ";--dq-ink:" + tdColorInk(TD_DIE_COLOR[n]) + "'"
      + " title='Add a D" + n + " to the formula'>"
      + tdDiceFaceSVG(n) + "<span class='td-dice-qn'>D" + n + "</span></button>";
  }).join('') + "</div>";
}
/* It edits the formula: D20 on 2D6 gives 2D6+D20, then 2D6+2D20. Every other term is left as typed; only an empty
   bit ("2D6+") is tidied. */
window.tdDiceAdd = function(n){
  var inp = document.getElementById('tdDiceIn');
  if(!inp) return;
  var errEl = document.getElementById('tdDiceErr');
  if(errEl) errEl.textContent = '';
  inp.classList.remove('bad');
  var bits = String(inp.value || '').split('+');
  var out = [], hit = false, flatAt = -1;
  for(var i = 0; i < bits.length; i++){
    var t = bits[i].trim();
    if(!t) continue;
    var m = /^(\d*)[dD](\d+)$/.exec(t);
    if(!hit && m && parseInt(m[2], 10) === n){
      out.push(((m[1] === '' ? 1 : parseInt(m[1], 10)) + 1) + 'D' + n);
      hit = true;
    } else {
      if(flatAt < 0 && /^\d+$/.test(t)) flatAt = out.length;
      out.push(t);
    }
  }
  /* A first die is written D20, not 1D20, and a new term goes before the flat modifier, where a person would put it. */
  if(!hit){
    if(flatAt >= 0) out.splice(flatAt, 0, 'D' + n);
    else out.push('D' + n);
  }
  inp.value = out.join('+');
  inp.focus();
};

function tdDiceDragStart(ev){
  var el = tdDiceEl(); if(!el) return;
  /* Any button in the header, not one named by class: a press on Minimize would start a drag while its click fired. */
  if(ev.target && ev.target.closest && ev.target.closest('button')) return;
  var r = el.getBoundingClientRect();
  var ox = ev.clientX - r.left, oy = ev.clientY - r.top;
  try{ ev.target.setPointerCapture(ev.pointerId); }catch(_){}
  var move = function(e){
    var x = e.clientX - ox, y = e.clientY - oy;
    /* kept on screen: a box dragged off the edge cannot be dragged back */
    x = Math.max(4, Math.min(window.innerWidth - r.width - 4, x));
    y = Math.max(4, Math.min(window.innerHeight - 40, y));
    _tdDice.x = x; _tdDice.y = y;
    el.style.left = x + 'px'; el.style.top = y + 'px';
  };
  var up = function(){
    document.removeEventListener('pointermove', move);
    document.removeEventListener('pointerup', up);
    /* Where you left it, kept with the chat's and the Record Log's, so it opens there after a reload. */
    if(_tdDice.x != null){
      try{ localStorage.setItem(TD_WIN_KEY + 'dice',
             JSON.stringify({x:Math.round(_tdDice.x), y:Math.round(_tdDice.y)})); }catch(_){}
    }
  };
  document.addEventListener('pointermove', move);
  document.addEventListener('pointerup', up);
  ev.preventDefault();
}

/* Minimize is a class on the box, not a rebuild: the canvas keeps its backing store while hidden, so the dice stay
   where they landed. */
window.tdDiceMin = function(){
  var el = tdDiceEl(); if(!el) return;
  _tdDice.min = !_tdDice.min;
  el.classList.toggle('td-dice-mini', _tdDice.min);
  var b = document.getElementById('tdDiceMin');
  if(b){
    b.innerHTML = _tdDice.min ? 'Expand &#9662;' : 'Minimize &#9652;';
    b.title = _tdDice.min ? 'Open the tray back up'
                          : 'Roll the tray up into its title bar';
  }
  /* Redrawn on the way back: a tab the browser discarded may have cleared the store. */
  if(!_tdDice.min) tdDiceDraw();
};

function tdDiceSyncBtn(){
  var b = document.getElementById('tdDiceBtn');
  if(!b) return;
  b.classList.toggle('on', !!_tdDice.open);
  b.title = _tdDice.open ? 'Close the dice tray' : 'Open the dice tray';
}
function tdDiceClose(){
  if(_tdDice.raf){ cancelAnimationFrame(_tdDice.raf); _tdDice.raf = null; }
  /* The formula is saved here, not in the toggle: the button and the tray's own close button both close through this. */
  var inp = document.getElementById('tdDiceIn');
  if(inp && inp.value.trim()) _tdDice.last = inp.value;
  var el = tdDiceEl();
  if(el && el.parentNode) el.parentNode.removeChild(el);
  _tdDice.open = false;
  tdDiceSyncBtn();
}
window.tdDiceClose = tdDiceClose;
function tdDiceOpen(){
  if(tdDiceEl()) return;
  var W = _tdDice.W, H = _tdDice.H, fresh = false;
  /* First open: where it was left, else a little above the middle so the formula bar clears the window's foot. */
  if(_tdDice.x == null){
    var sv = tdWinSaved('dice');
    if(sv && typeof sv.x === 'number' && typeof sv.y === 'number' && isFinite(sv.x) && isFinite(sv.y)){
      _tdDice.x = sv.x; _tdDice.y = sv.y;
    } else {
      _tdDice.x = Math.max(8, Math.round((window.innerWidth - W) / 2));
      _tdDice.y = Math.max(8, Math.round((window.innerHeight - H) / 2) - 60);
      fresh = true;
    }
  }
  /* It opens open: kept across a close, minimize would show a title bar over nothing, like a tray that failed to draw. */
  _tdDice.min = false;
  var el = document.createElement('div');
  el.id = 'tdDiceTray';
  el.className = 'td-dice';
  /* Not modal: the board stays in play beside it. */
  el.setAttribute('role', 'dialog');
  el.setAttribute('aria-modal', 'false');
  el.setAttribute('aria-label', 'Dice Tray');
  el.style.left = _tdDice.x + 'px';
  el.style.top = _tdDice.y + 'px';
  el.innerHTML =
      "<div class='td-dice-hd wh' id='tdDiceHd'>"
    +   "<span class='td-dice-ttl wh-t'>&#9860; Dice Tray</span>"
    +   "<span class='td-dice-held wh-keep' id='tdDiceHeld'></span>"
    +   "<button class='td-dice-min nb nb-plain nb-m wh-keep' id='tdDiceMin' onclick='tdDiceMin()'"
    +     " title='Roll the tray up into its title bar'>Minimize &#9652;</button>"
    +   "<button class='td-dice-x nb nb-red nb-m wh-x' onclick='tdDiceClose()'"
    +     " title='Close the dice tray'>Close &#10005;</button>"
    + "</div>"
    + "<div class='td-dice-box'>"
    +   "<canvas id='tdDiceCv' width='" + W + "' height='" + H + "' aria-hidden='true'></canvas>"
    +   "<div class='td-dice-read'>"
    +     "<div class='td-dice-total' id='tdDiceTotal'>&mdash;</div>"
    +     "<div class='td-dice-parts' id='tdDiceParts'></div>"
    +   "</div>"
    + "</div>"
    + "<div class='td-dice-bar'>"
    +   "<input class='td-dice-in' id='tdDiceIn' type='text' spellcheck='false'"
    +     " aria-label='Dice to roll, such as 2D6'"
    +     " autocomplete='off' placeholder='5D6 . 2D6+2D4 . D20 . 3D8+2'"
    +     " onkeydown='tdDiceKey(event)'>"
    +   "<button class='td-dice-go' onclick='tdDiceRoll()'>Roll</button>"
    + "</div>"
    + tdDiceQuickRow()
    + "<div class='td-dice-err' id='tdDiceErr'></div>";
  document.body.appendChild(el);
  var er = el.getBoundingClientRect();
  /* And clear of the Dice Tray button, which the middle of the window covered: above it where there is room, else
     beside it. */
  var db = fresh ? document.getElementById('tdDiceBtn') : null, dr = db ? db.getBoundingClientRect() : null;
  var over = function(){ return !!dr && dr.width > 0 && _tdDice.y < dr.bottom && _tdDice.y + er.height > dr.top
    && _tdDice.x < dr.right && _tdDice.x + er.width > dr.left; };
  if(over()) _tdDice.y = Math.max(4, Math.round(dr.top - er.height - 8));
  if(over()) _tdDice.x = (dr.right + 8 + er.width <= window.innerWidth - 4) ? Math.round(dr.right + 8)
    : Math.max(4, Math.round(dr.left - 8 - er.width));
  el.style.left = _tdDice.x + 'px';
  el.style.top = _tdDice.y + 'px';
  /* Kept on screen as the drag keeps it: a smaller window must still show its title bar. */
  var kx = Math.max(4, Math.min(window.innerWidth - er.width - 4, _tdDice.x));
  var ky = Math.max(4, Math.min(window.innerHeight - 40, _tdDice.y));
  if(kx !== _tdDice.x || ky !== _tdDice.y){
    _tdDice.x = kx; _tdDice.y = ky;
    el.style.left = kx + 'px'; el.style.top = ky + 'px';
  }
  var inp = document.getElementById('tdDiceIn');
  if(inp){ inp.value = _tdDice.last || '2D6'; inp.focus(); inp.select(); }
  var hd = document.getElementById('tdDiceHd');
  if(hd) hd.addEventListener('pointerdown', tdDiceDragStart);
  _tdDice.open = true;
  tdDiceSyncBtn();
  tdDiceDraw();
}
window.tdToggleDiceTray = function(){
  if(_tdDice.open) tdDiceClose();          /* which is what remembers the field */
  else tdDiceOpen();
};

/* +1 and -1 carry a value, so one piece reads +14. A free counter is placed in percent of its half's token layer,
   not a zone; one on a card travels with it (tdPlaceCardTokens). */
/* The names are a copy of cat_core.js's ROYGBIV; one that is not a key of COLOR_FILL_HEX draws in the fallback grey. */
var TD_COLOR_NAMES = ['Red','Orange','Yellow','Green','Blue','Indigo','Violet'];
/* By its own name only: a counter's name arrives with the position, so it is looked up, never trusted. */
function tdColorOf(map, n){
  try{ return (map && Object.prototype.hasOwnProperty.call(map, n)) ? String(map[n]) : ''; }catch(_){ return ''; }
}
function tdColorFill(n){ return tdColorOf(window.COLOR_FILL_HEX, n) || '#888'; }
function tdColorInk(n){ return tdColorOf(window.COLOR_OUTLINE_HEX, n) || '#141418'; }
/* CICO is the catalogue's map, so the symbol on a counter is the one on a card; a set without icons gets the name
   alone. */
function tdColorMana(n){
  var src = tdColorOf(window.CICO, n);
  if(!src) return '';
  return "<img class='td-colmana' src='" + e(src) + "' alt='' aria-hidden='true'>";
}

function tdAddToken(kind, name){
  if(!TD.board) return;
  if(!TD.board.tokens) TD.board.tokens = [];
  /* The middle of the Field, measured: token positions are percent of the token layer, and the Field's share depends
     on the deck type and the table. Falls back to a staggered corner off screen. */
  var spot = tdNewTokenSpot();
  var a = {t:'tokAdd', uid:tdUid('tk'), kind:kind,
           /* 'color' carries its colour in name, as 'kw' does its keyword, so saving, Duplicate and the table move it unchanged
              (TD_TOKEN_KEYS). */
           name:(kind === 'kw' || kind === 'color') ? String(name || '') : '',
           value:(kind === 'minus') ? -1 : 1,
           x:spot.x, y:spot.y};
  tdDo(a);
  tdRender();
  return tdTokenFind(a.uid).token;
}
/* Staggered round the centre, so a second press does not hide the first. */
function tdNewTokenSpot(){
  var n = (TD.board && TD.board.tokens && TD.board.tokens.length) || 0;
  var dx = ((n % 5) - 2) * 3.4, dy = ((Math.floor(n / 5) % 5) - 2) * 4.2;
  var layer = document.getElementById('tdTokens');
  var field = document.querySelector(
    "#tdBoard .td-half-mine .td-zone[data-zone='field'] .td-zbody")
    || document.querySelector("#tdBoard .td-zone[data-zone='field'] .td-zbody");
  if(layer && field){
    var lr = layer.getBoundingClientRect(), fr = field.getBoundingClientRect();
    if(lr.width > 0 && lr.height > 0){
      var cx = ((fr.left + fr.width / 2) - lr.left) / lr.width * 100;
      var cy = ((fr.top + fr.height / 2) - lr.top) / lr.height * 100;
      return {x:Math.max(0, Math.min(96, cx + dx - 2)),
              y:Math.max(0, Math.min(94, cy + dy - 2))};
    }
  }
  return {x:4 + (n % 9) * 3.2, y:3 + (n % 5) * 4.5};
}
function tdTokenFind(uid){
  var list = (TD.board && TD.board.tokens) || [];
  for(var i = 0; i < list.length; i++) if(list[i].uid === uid) return {index:i, token:list[i]};
  return null;
}
function tdTokenAdj(uid, n){
  var at = tdTokenFind(uid); tdCloseMenu();
  if(!at) return;
  tdDo({t:'tokSet', uid:uid, value:at.token.value + n});
  tdRender();
}
/* A blank or unreadable entry leaves the counter alone: tabbing past the field must not zero it. */
function tdTokenSet(uid, raw){
  var at = tdTokenFind(uid);
  if(!at) return;
  var v = parseInt(String(raw).trim(), 10);
  if(!isFinite(v)){ tdCloseMenu(); return; }
  tdCloseMenu();
  tdDo({t:'tokSet', uid:uid, value:v});
  tdRender();
}
function tdTokenSetKey(ev, uid){
  if(!ev) return;
  if(ev.key === 'Enter'){ ev.preventDefault(); tdTokenSet(uid, ev.target.value); }
  else if(ev.key === 'Escape'){ tdCloseMenu(); }
}
function tdTokenDup(uid){
  var at = tdTokenFind(uid); tdCloseMenu();
  if(!at) return;
  tdDo({t:'tokAdd', uid:tdUid('tk'), kind:at.token.kind,
        name:at.token.name || '', value:at.token.value,
        x:Math.min(94, (at.token.x == null ? 4 : at.token.x) + 2.4),
        y:Math.min(92, (at.token.y == null ? 4 : at.token.y) + 3.2)});
  tdRender();
}
function tdTokenDel(uid){
  var at = tdTokenFind(uid); tdCloseMenu();
  if(!at) return;
  tdDo({t:'tokDel', uid:uid});
  tdRender();
}
function tdTokenLabel(t){
  if(t.kind === 'emblem') return "&#10697; Copy";
  /* Escaped all the same: the name comes from the position as saved or received, not from TD_COLOR_NAMES. */
  if(t.kind === 'color') return tdColorMana(t.name) + e(String(t.name || ''));
  if(t.kind === 'kw'){
    /* Without the word Counter (tdCtrShortName, as on the Keyword and Special buttons): the display name only, t.name
       is untouched. */
    return tdPillLook(t.name, tdCtrShortName(t.name));
  }
  return tdTokNumText(t.value);
}
function tdTokNumText(v){
  var n = tdNum(v);
  return (n > 0 ? '+' : '') + n;
}
function tdTokenTitle(t){
  if(t.kind === 'emblem') return 'Emblem Copy — this card is a copy';
  if(t.kind === 'kw') return t.name;
  if(t.kind === 'color') return t.name + ' counter';
  return tdTokNumText(t.value);
}
function tdTokenHTML(t){
  var cls = 'td-token td-token-' + String(t.kind || '').replace(/[^a-z]/g, '') + (t.on ? ' td-token-stuck' : '');
  /* An attached counter has no position of its own: tdPlaceCardTokens lays the set out over the art once measured. */
  var css = t.on ? [] : ['left:' + tdNum(t.x) + '%', 'top:' + tdNum(t.y) + '%'];
  /* The colour travels as two custom properties, not a class per colour, so one rule paints all seven; an unknown name
     falls back rather than drawing invisible. */
  if(t.kind === 'color'){
    css.push('--tok-fill:' + tdColorFill(t.name));
    css.push('--tok-ink:' + tdColorInk(t.name));
  }
  var pos = css.length ? (" style='" + css.join(';') + "'") : '';
  return "<div class='" + cls + "' data-tok='" + e(t.uid) + "'" + pos
    + " title='" + e(tdTokenHover(t)) + "'>"
    + tdTokenLabel(t) + "</div>";
}
/* The pill inside the counter takes no pointer (testdeck.css), so this title is the one shown. */
function tdTokenHover(t){
  var title = tdTokenTitle(t), rem = (t && t.kind === 'kw') ? tdKwReminderText(t.name) : '';
  return rem ? title + ' — ' + rem : title;
}
/* Never for a +1 or -1 counter: those have no reminder text, by the author's decision (HANDOFF §10). */
function tdKwReminderText(name){
  name = String(name || '');
  if(!name || tdIsPlusMinusCounter(name)) return '';
  try{
    return (typeof window.edKwReminder === 'function') ? String(window.edKwReminder(name, name) || '') : '';
  }catch(_){ return ''; }
}

/* kwPill's markup with its behaviour stripped (no onclick, href or tab stop): a click on a playing piece must not
   leave the board. Taken apart in tdInertBox, and every on* attribute goes. */
function tdPillLook(name, text){
  var label = (text == null ? name : text);
  /* Escaped before it goes in, as kwPill takes its label as markup; the fallback then escapes once, not twice. */
  var html = '';
  var pillable = (typeof window.edKwIsPillable === 'function')
    ? window.edKwIsPillable(name) : true;
  if(pillable && typeof window.edKwPillFor === 'function'){
    try{ html = window.edKwPillFor(name, e(label)); }catch(_){}
  }
  if(!html) return e(label);
  try{
    var box = tdInertBox();
    if(!box) return e(label);
    box.innerHTML = html;
    var all = box.querySelectorAll('*');
    for(var i = 0; i < all.length; i++){
      var el = all[i];
      tdStripHandlers(el);
      el.removeAttribute('href');
      el.removeAttribute('tabindex');
      el.removeAttribute('role');
      /* And data-kw-entry: the catalog's keyword-link listener follows any element that names an entry. */
      el.removeAttribute('data-kw-entry');
      el.removeAttribute('data-kw-mode');
      el.style.cursor = 'inherit';
    }
    return box.innerHTML;
  }catch(_){ return e(label); }
}
/* In a document with no window, so nothing put in it is fetched or fires. */
function tdInertBox(){
  try{
    if(!tdInertBox.doc) tdInertBox.doc = document.implementation.createHTMLDocument('');
    return tdInertBox.doc.createElement('div');
  }catch(_){ return null; }
}
function tdStripHandlers(el){
  for(var i = el.attributes.length - 1; i >= 0; i--){
    var n = el.attributes[i].name;
    if(/^on/i.test(n)) el.removeAttribute(n);
  }
}

/* Every keyword the game defines; the entries whose mode is 'counter' are the Special dropdown's (tdOtherCounterList). */
function tdKwCounterList(){
  return (window.KW_DATA || []).filter(function(k){
    return (k.mode || 'keyword') === 'keyword' && !k.__alias;
  }).sort(function(a, b){ return String(a.name).localeCompare(String(b.name)); });
}
/* The display name only: data-kw keeps the real name for tdAddToken, the log and the other machine. A counter named
   "Counter" keeps its name. */
function tdCtrShortName(n){
  var s = String(n == null ? '' : n).replace(/\bcounters?\b/gi, ' ')
    .replace(/\s+/g, ' ').trim();
  return s || String(n == null ? '' : n);
}
/* Only the literal +1 and -1 (with or without Counter), which have buttons of their own; matching more would drop a
   real counter. */
function tdIsPlusMinusCounter(n){
  return /^\s*[+\-\u2212]\s*1\s*(counters?)?\s*$/i.test(String(n == null ? '' : n));
}
/* Not a generic Colour Counter either (the seven colour buttons replaced it); as narrow as tdIsPlusMinusCounter. */
function tdIsGenericColorCounter(n){
  return /^\s*colou?rs?\s*(counters?)?\s*$/i.test(String(n == null ? '' : n));
}
/* The named counters (mode 'counter') for the Special dropdown, less the two above. */
function tdOtherCounterList(){
  return (window.KW_DATA || []).filter(function(k){
    return (k.mode || 'keyword') === 'counter' && !k.__alias
      && !tdIsPlusMinusCounter(k.name) && !tdIsGenericColorCounter(k.name);
  }).sort(function(a, b){ return String(a.name).localeCompare(String(b.name)); });
}

/* The top of the deck is the end of the array, so drawing pops. */
/* Each card drawn is its own logged move with its uid: "draw 2" would pop the other machine's copy, which may differ. */
function tdDraw(n){
  if(!TD.board) return 0;
  if(!TD.board.zones.deck) return 0;
  var moved = 0;
  for(var i = 0; i < n; i++){
    var deck = TD.board.zones.deck;
    var c = deck[deck.length - 1];
    if(!c) break;
    /* An Armament drawn goes to the right end of the hand's area, not the hand (tdHandAreaZone). */
    tdDo({t:'move', uid:c.uid, to:tdHandAreaZone(c, 'hand')});
    moved++;
  }
  return moved;
}


/* The real face, through window.edShowCardFace (false when it cannot draw, so there is a fallback), cached by name.
   window.CARD_GEN goes up with every change to the cards, and a new value throws the cache away. */
var _tdFaceCache = Object.create(null), _tdFaceGen = -1;
var _tdCardMap = null, _tdCardMapN = -1, _tdCardMapGen = -1;

function tdCardGen(){ return window.CARD_GEN || 0; }
function tdCardByName(name){
  var all = window.CARDS || [];
  if(_tdCardMapN !== all.length || _tdCardMapGen !== tdCardGen()){
    /* no prototype, so a name like "constructor" is a card or nothing */
    _tdCardMap = Object.create(null);
    all.forEach(function(c){ _tdCardMap[c.name] = c; });
    _tdCardMapN = all.length;
    _tdCardMapGen = tdCardGen();
  }
  return _tdCardMap[name];
}

/* True when there is a face to size: false for a host painted before, an unknown card or the artwork fallback. */
function tdPaintMarkup(host){
  if(host._tdPainted) return false;
  host._tdPainted = true;
  var card = tdCardByName(host.dataset.card);
  if(!card){ host.classList.add('td-face-fail'); return false; }
  if(_tdFaceGen !== tdCardGen()){ _tdFaceCache = Object.create(null); _tdFaceGen = tdCardGen(); }
  var cached = _tdFaceCache[card.name];
  if(cached){ host.innerHTML = cached; }
  else if(typeof window.edShowCardFace === 'function'
          && window.edShowCardFace(card, host)){
    _tdFaceCache[card.name] = host.innerHTML;
  } else {
    host.classList.add('td-face-fail');
    var src = (typeof _artSrc === 'function') ? _artSrc(card) : (card.imageUrl || '');
    host.innerHTML = src
      ? "<img class='td-art' src='" + e(src) + "' alt=''>"
      : "<div class='td-noart'>" + e(card.name) + "</div>";
    return false;
  }
  return true;
}
function tdPaintOne(host){
  if(tdPaintMarkup(host)) tdFitFace(host);
}

/* All the markup, then all the measuring, then all the sizes: sizing each face as it was painted laid the page out
   once per card. */
function tdPaintFaces(root){
  var hosts = [].filter.call((root || document).querySelectorAll('.td-face'),
                             function(h){ return tdPaintMarkup(h); });
  var fits = hosts.map(function(h){ return tdFaceFit(h); });
  fits.forEach(function(f){ if(f) tdFaceScaleTo(f); });
}

/* Lists paint as they scroll into view, a screen ahead; the board, a dozen or two tokens, is painted outright. */
function tdLazyFaces(root){
  if(!root || typeof IntersectionObserver !== 'function'){ tdPaintFaces(root); return; }
  /* root is the observer's root too: these lists scroll inside their own box, not with the page. */
  if(root._tdObs) root._tdObs.disconnect();
  var obs = new IntersectionObserver(function(rows){
    rows.forEach(function(row){
      if(!row.isIntersecting) return;
      obs.unobserve(row.target);
      tdPaintOne(row.target);
    });
  }, {root:root, rootMargin:'300px'});
  root._tdObs = obs;
  [].forEach.call(root.querySelectorAll('.td-face'), function(h){
    if(!h._tdPainted) obs.observe(h);
  });
}

/* Rescales the face without re-running fitFace: .mcard is 340px inside and the display size is a transform, so the
   cached text sizing holds. */
function tdFitFace(host){
  var f = tdFaceFit(host);
  if(f) tdFaceScaleTo(f);
}
/* The measuring half of tdFitFace; it writes nothing. */
function tdFaceFit(host){
  var wrap = host.querySelector('.mcard-fit');
  var scaler = wrap && wrap.querySelector('.mcard-scale');
  if(!scaler) return null;
  var w = host.clientWidth || host.getBoundingClientRect().width;
  return w ? {scaler:scaler, w:w} : null;
}
function tdFaceScaleTo(f){
  f.scaler.style.transform = 'scale(' + (f.w / 340) + ')';
}

function tdTokensOn(uid, board){
  var b = board || TD.board;
  return ((b && b.tokens) || []).filter(function(t){
    return t.on === uid;
  });
}

/* Built here once for the three places that draw a back. Every class inside is scoped under .cback, as
   card_back.css's names (.face, .rim, .gem) are common; --u comes from the host's width. */
/* The rays go inside .cb-in and before .hub, as on the standalone card: z-index 1 against the hub's 5. */
var TD_BACK_INNER = "<div class='cb-in'><div class='rays'>" + TD_BACK_RAYS
  + "</div><div class='hub'>"
  + "<div class='disc d-ring'><div class='face'></div></div>"
  + "<div class='disc d-halo'><div class='face'></div></div>"
  + "<div class='disc d-boss'><div class='face'><div class='logo'></div></div></div>"
  + TD_BACK_GEMS
  + "</div></div><div class='cb-shade'></div>";
function tdBackHTML(title){
  return "<div class='td-back'" + (title ? " title='" + e(title) + "'" : '')
    + "><div class='cback fx-cabochon'>" + TD_BACK_INNER + "</div></div>";
}

function tdCardHTML(item, zone, opts){
  opts = opts || {};
  var c = item.card;
  /* An anonymous piece has no card: a hidden zone of theirs arrives as a number. It draws as a back. */
  /* Your own face-down card shows you its face, marked: the secret is that its identity never reaches the other
     machine. */
  /* opts.faceUp overrides the pile rule only: the top card of a deck played revealed is face up. */
  /* The tooltip follows the face: a pile's top card drawn as a back must not be named. */
  var hid = (!c || item.anon) || (zone.kind === 'pile' && !opts.faceUp);
  var face = hid
    ? tdBackHTML('Face down')
    : "<div class='td-face' data-card='" + e(c.name) + "'></div>"
      + (item.down ? "<span class='td-downmark' title='Face down"
          + " — they see a back'>Face Down</span>" : '')
      + (item.shown ? "<span class='td-shownmark' title='Revealed"
          + " — everyone can see this until it moves'>Revealed</span>" : '');
  /* An attached counter is drawn inside its card, so it travels with every move; tdPlaceCardTokens places it over the
     art. */
  var mine = tdTokensOn(item.uid, opts.board);
  var stuck = mine.length
    ? "<div class='td-cardtok'>" + mine.map(tdTokenHTML).join('') + "</div>"
    : '';
  /* Free zones keep a position in percent and stacked zones only an order; a card in a connection group is placed by
     the group. */
  var pos = '';
  /* Above the top card, not below: an attached card shows its edge over the one in front, as a stack does. */
  if(opts.stackAt != null)
    pos = " style='top:calc(var(--td-ch) * " + (-opts.stackAt * TD_CONNECT_SHOW).toFixed(4) + ")'";
  else if(zone.kind === 'free' && !opts.inGroup && item.x != null)
    pos = " style='left:" + tdNum(item.x) + "%;top:" + tdNum(item.y) + "%'";
  /* What it was declared as this Battle; the look, and the Essence gem, are cat_boardfx.js's. */
  var declCls = item.decl === 'atk' ? ' td-decl-atk' : item.decl === 'thm' ? ' td-decl-thaum'
              : item.decl === 'blk' ? ' td-decl-blk' : '';
  var fx = (typeof tdFxCard === 'function') ? tdFxCard(item, zone, c, opts.board) : null;
  if(fx && fx.style)
    pos = " style='" + (pos ? pos.slice(8, -1) + ';' : '') + fx.style + "'";
  return "<div class='td-card" + (item.locked ? ' locked' : '') + declCls + (fx ? fx.cls : '')
    + (item.down ? ' td-down' : '')
    + (opts.stackAt != null ? ' td-attached' : '') + "'"
    + " data-uid='" + e(item.uid) + "' data-zone='" + e(zone.id) + "'"
    + pos + " title='" + (hid ? 'Face down' : e(c.name)) + "'>"
    + face + stuck + (fx ? fx.html : '')
    + (typeof tdGfBadgeHTML === 'function' ? tdGfBadgeHTML(item, zone) : '') + "</div>"
    /* What stays where the card rests while it floats: an Action or Spell's Resolve button and its ground. */
    + (fx && fx.after ? fx.after : '');
}

/* Attached cards stack above the one they are under, each raised a further TD_CONNECT_SHOW. Only the top card
   locks: tdSetLock turns exactly the card asked about. */
var TD_CONNECT_SHOW = 0.10;
function tdIsRoot(it){ return !it.connectedTo; }
function tdChildrenOf(items, uid){
  return items.filter(function(it){ return it.connectedTo === uid; });
}
function tdDescendants(items, uid, out){
  out = out || [];
  tdChildrenOf(items, uid).forEach(function(k){
    out.push(k); tdDescendants(items, k.uid, out);
  });
  return out;
}
function tdGroupHTML(it, items, zone, board){
  var kids = tdDescendants(items, it.uid);
  if(!kids.length) return tdCardHTML(it, zone, {board:board});
  /* Children first in the DOM, highest first, and the top card last, so each attached card's 10% shows above the next. */
  var stack = kids.map(function(k, i){
    return tdCardHTML(k, zone, {stackAt:i + 1, board:board});
  }).reverse();
  return "<div class='td-group' style='left:" + (it.x == null ? 4 : tdNum(it.x, 4))
    + "%;top:" + (it.y == null ? 4 : tdNum(it.y, 4)) + "%'>"
    + stack.join('')
    + tdCardHTML(it, zone, {inGroup:true, board:board})
    + "</div>";
}

/* Kingdoms only. The preview is laid out at all times (opacity, not display:none): a face painted into a
   display:none host measures zero and tdFitFace bails out. */
/* Each deck wears its own player's Lord, and only your own coin offers to move it. */
function tdLordCoinHTML(board){
  var b = board || TD.board;
  if(!tdHasLord() || !b || !b.zones) return '';
  var items = b.zones.lord || [];
  if(!items.length) return '';
  var it = items[0], nm = (it.card && !it.anon) ? it.card.name : '';
  if(!nm) return '';
  return "<div class='td-lord' data-uid='" + e(it.uid) + "' data-zone='lord'"
    + " title='" + e(nm) + (b === TD.board ? " — hover to read it, right-click to move it'>"
                                            : " — hover to read it'>")
    + "<span class='td-lord-lab'>Lord</span>"
    + "<div class='td-lord-pop'><div class='td-face' data-card='"
      + e(nm) + "'></div></div>"
    + "</div>";
}

/* Under the count, inside the rail, so it costs the hand no width. Your own hand only: the eye beside theirs asks. */
var TD_EYE_OPEN = "<svg viewBox='0 0 24 16' width='15' height='10' fill='none'"
  + " stroke='currentColor' stroke-width='1.7' aria-hidden='true'>"
  + "<path d='M1 8s4-6 11-6 11 6 11 6-4 6-11 6S1 8 1 8z'/>"
  + "<circle cx='12' cy='8' r='2.6'/></svg>";
var TD_EYE_SHUT = "<svg viewBox='0 0 24 16' width='15' height='10' fill='none'"
  + " stroke='currentColor' stroke-width='1.7' stroke-linecap='round'"
  + " aria-hidden='true'>"
  + "<path d='M1 6s4 6 11 6 11-6 11-6'/>"
  + "<path d='M4 10.5 2.2 13'/><path d='M9 12.6 8.2 15'/>"
  + "<path d='M15 12.6 15.8 15'/><path d='M20 10.5 21.8 13'/></svg>";

/* Collapsing hides nothing: every card stays in the zone, the DOM, the count and the wire. It is yours alone, kept
   by seat and zone in memory, never on the board, in the log or sent. */
function tdCollapseKey(b, zoneId){
  return ((b && b.side) || TD.side || 'me') + ':' + zoneId;
}
/* The default until a seat and zone is toggled; after that the toggle stands. */
var TD_COLLAPSE_DEFAULT = {grave:1, susp:1};
function tdCollapsedKey(k, zoneId){
  if(TD.collapse && Object.prototype.hasOwnProperty.call(TD.collapse, k)) return !!TD.collapse[k];
  return !!TD_COLLAPSE_DEFAULT[zoneId];
}
function tdCollapsed(b, zoneId){
  return tdCollapsedKey(tdCollapseKey(b, zoneId), zoneId);
}
window.tdToggleCollapse = function(side, zoneId){
  if(!TD.collapse) TD.collapse = {};
  var k = side + ':' + zoneId;
  TD.collapse[k] = !tdCollapsedKey(k, zoneId);
  tdRender();
};
/* Only stacks: a pile shows one back, a free zone does not stack and a hand is a fan. */
function tdCanCollapse(z){ return z && z.kind === 'stack'; }
function tdCollapseToggleHTML(z, b){
  if(!tdCanCollapse(z)) return '';
  var n = ((b && b.zones[z.id]) || []).length;
  if(n < 2) return '';
  var off = tdCollapsed(b, z.id);
  var side = (b && b.side) || TD.side || 'me';
  /* The seat and zone ride on the button as data, for tdBindMenu: a seat is a name another machine chose. */
  return "<button type='button' class='td-zcol" + (off ? ' off' : '') + "'"
    + " data-col-side='" + e(side) + "' data-col-zone='" + e(z.id) + "'"
    + " aria-pressed='" + (off ? 'true' : 'false') + "'"
    + " title='" + e(off
        ? ('Showing only the top card of ' + n + ' - click to spread the stack out')
        : ('Showing all ' + n + ' - click to collapse to the top card')) + "'>"
    + "<span class='td-zcol-t'>" + (off ? 'Hide' : 'Show') + "</span></button>";
}

function tdZShowToggleHTML(z, foe){
  if(foe || z.id !== 'hand') return '';
  var on = tdZShow('hand') === 'all';
  /* A Rebirth Hand takes its Armament with it (tblHiddenZone). */
  var both = !!(REBIRTH && TD.board && TD.board.zones.gear);
  return "<button class='td-zshow" + (on ? ' on' : '') + "'"
    + " onclick=\"tdToggleZShow('hand')\""
    + " aria-pressed='" + (on ? 'true' : 'false') + "'"
    + " title='" + (on
        ? (both ? 'Click to hide your Hand and Armament again' : 'Click to hide it again')
        : (both ? 'Click to reveal your Hand and Armament to everyone' : 'Click to reveal it to everyone')) + "'>"
    + "<span class='td-zshow-i'>" + (on ? TD_EYE_OPEN : TD_EYE_SHUT) + "</span>"
    + "<span class='td-zshow-t'>" + (on ? 'Shown' : 'Hidden') + "</span>"
    + "</button>";
}

/* At a table only: on your hidden zone it offers to show, on theirs to ask; it is open while somebody is looking. */
function tdEyeHTML(z, foe, seen){
  if(typeof tblOn !== 'function' || !tblOn()) return '';
  var hidden = TD_FOE_HIDDEN[z.id] || z.kind === 'pile';
  if(!hidden) return '';
  if(foe){
    return "<button class='td-zeye" + (seen ? ' on' : '') + "'"
      + " onclick=\"tblAskMenu('" + z.id + "',event)\""
      + " aria-label='" + e((seen ? 'They are showing you their ' : 'Ask to see their ') + z.label) + "'"
      + " title='" + (seen ? 'They are showing you this' : 'Ask to see this')
      + "'>" + uiIco('eye') + "</button>";
  }
  var showing = (typeof tblShowing === 'function') && tblShowing(z.id);
  return "<button class='td-zeye" + (showing ? ' on mine' : '') + "'"
    + " onclick=\"tblShowMenu('" + z.id + "',event)\""
    + " aria-label='" + e((showing ? 'Stop showing your ' : 'Show your ') + z.label
                          + (showing ? '' : ' to opponents')) + "'"
    + " title='" + (showing ? 'Click to stop'
                            : 'Show to opponents') + "'>"
    + uiIco('eye') + "</button>";
}

/* The display rule only: tblRedact (cat_table.js) keeps these identities from being sent at all. */
var TD_FOE_HIDDEN = {hand:1};

/* Rebirth's hand area is two zones in one box (.td-handarea): the hand and, past a thin line, the Armament in play
   (gear), drawn only while it holds a card. */
function tdZoneHTML(z, board){
  var b = board || TD.board;
  var gz = (z && z.id === 'hand') ? tdZoneById('gear') : null;
  if(!gz || !b || !b.zones || !b.zones.gear) return tdZoneSectionHTML(z, board);
  return "<div class='td-handarea" + (b.zones.gear.length ? ' td-hasgear' : '') + "'>"
    + tdZoneSectionHTML(z, board) + tdZoneSectionHTML(gz, board) + "</div>";
}
function tdZoneSectionHTML(z, board){
  var b = board || TD.board;
  var foe = !!(b && b !== TD.board);
  var items = (b && b.zones[z.id]) || [];
  var body;
  var seen = !!(foe && b.revealed && b.revealed[z.id]);
  var gf = (z.id === 'field' && !foe && typeof tdGfOn === 'function' && tdGfOn());
  /* A deck played with its top card revealed is still drawn as a pile, read off what arrived: one named card over the
     rest is the top shown, as turning it up is never sent as an action (tblRedact). */
  var foeTop = false;
  if(seen && z.kind === 'pile'){
    var namedN = items.filter(function(it){ return !it.anon; }).length;
    var topIt = items[items.length - 1];
    if(!namedN || (namedN === 1 && topIt && !topIt.anon)){ seen = false; foeTop = (namedN === 1); }
  }
  if(foe && (TD_FOE_HIDDEN[z.id] || z.kind === 'pile') && seen){
    /* Laid out face up: a revealed zone is there to be read, and holds only what they sent. */
    /* Only what was shown gets a card; the rest stays one face-down card wearing the number. */
    var open = items.filter(function(it){ return !it.anon; });
    var restN = items.length - open.length;
    body = (open.length || restN)
      ? ((restN
           ? "<div class='td-card td-card-back' title='" + restN
             + " more, not shown'>" + tdBackHTML('')
             + "<span class='td-restn'>" + restN + "</span></div>"
           : '')
         + open.map(function(it){
             return tdCardHTML(it, {id:z.id, kind:'fan'}, {board:b});
           }).join(''))
      : "<div class='td-empty'>empty</div>";
  } else if(foe && TD_FOE_HIDDEN[z.id]){
    body = items.length
      ? items.map(function(){ return "<div class='td-card td-card-back'>"
          + tdBackHTML('Face down') + "</div>"; }).join('')
      : "<div class='td-empty'>empty</div>";
  } else if(z.kind === 'pile'){
    /* Only the top card is drawn: a hundred hidden cards cost as much as a hundred shown. */
    body = items.length
      ? tdCardHTML(items[items.length - 1], z,
          {board:b, faceUp:(foeTop || tdZShowIn(b, z.id) === 'top')})
      : "<div class='td-empty'>empty</div>";
    if(z.id === 'deck') body += tdLordCoinHTML(b);
  } else if(!items.length){
    body = "<div class='td-empty'>empty</div>";
  } else if(z.kind === 'free'){
    body = items.filter(tdIsRoot).map(function(it){
      return tdGroupHTML(it, items, z, b);
    }).join('');
  } else {
    body = items.map(function(it){ return tdCardHTML(it, z, {board:b}); }).join('');
  }
  /* div, not header: catalog.css styles the bare header element (sticky, 58px, blurred, a gold bar), and a class would
     have to undo each of those. */
  /* Not on another player's half: nothing on this machine may change their cards. */
  /* In the body's corner, not the header: the 30px rail cannot hold a word. Both are drawn even when dead, so the
     corner keeps its shape. */
  var acts = '';
  if(TD_LOCK_ZONES[z.id] && !foe){
    var nLocked = items.filter(function(it){ return it.locked; }).length;
    var nFree = items.length - nLocked;
    var canUnlock = nLocked > 0;
    /* Any unlocked card is enough to offer Lock: a Field with one card turned still needs the button. */
    var canLock = nFree > 0;
    acts = "<div class='td-zacts'>"
      + "<button class='td-zbtn td-zbtn-un" + (canUnlock ? ' on' : '') + "'"
      + " onclick=\"tdUnlockZone('" + z.id + "')\"" + (canUnlock ? '' : ' disabled')
      + " title='" + (canUnlock
          ? ('Unlock all ' + nLocked + ' locked card' + (nLocked === 1 ? '' : 's') + ' here')
          : 'Nothing is locked here') + "'>Unlock</button>"
      + "<button class='td-zbtn td-zbtn-lk" + (canLock ? ' on' : '') + "'"
      + " onclick=\"tdLockZone('" + z.id + "')\"" + (canLock ? '' : ' disabled')
      + " title='" + (canLock
          ? ('Lock the ' + nFree + ' unlocked card' + (nFree === 1 ? '' : 's') + ' here')
          : (items.length ? 'Everything here is already locked' : 'Nothing here to lock'))
      + "'>Lock</button></div>";
  }
  var folded = tdIsFolded(z.id, items.length);
  /* The count comes first in the markup, as the rail is a column and source order is its order. */
  return "<section class='td-zone td-" + (seen ? 'fan' : z.kind)
    + (foe ? ' td-zone-foe' : '') + (seen ? ' td-seen' : '')
    + (folded ? ' td-fold' : '')
    + (tdCollapsed(b, z.id) ? ' td-collapsed' : '')
    + (gf ? ' td-gfz' : '')
    /* .td-seen on either half: a foe's hand they granted (seen), or your own you showed (tdZShow); styled once. */
    /* Not in Rebirth, whose hands are shown by default. */
    + ((z.id === 'hand' && !REBIRTH
        && (seen || (!foe && tdZShow('hand') === 'all'))) ? ' td-shown' : '')
    + (z.inHand ? ' td-gear' : '')
    + "' data-zone='" + z.id + "' data-side='" + (foe ? 'foe' : 'mine') + "'"
    + (z.inHand ? " aria-label='" + e(z.label) + "'" : '') + ">"
    + (gf ? tdGfBarHTML() : '')
    /* The Armament part has no rail: a second name and count would make it a second area. */
    + (z.inHand ? '' : ("<div class='td-zhdr'>"
    + "<span class='td-zcount'>" + items.length + "</span>"
    + tdCollapseToggleHTML(z, b)
    + tdZShowToggleHTML(z, foe)
    + "<span class='td-zname' title='" + e(z.label) + "'>" + e(tdZoneTitle(z)) + "</span>"
    /* No fold button: tdToggleFold and the td-fold styling stay, as a fold saved in this browser still applies and the
       checks call tdToggleFold. */
    + "<span class='td-ztools'>" + tdEyeHTML(z, foe, seen) + "</span></div>"))
    /* A second rail, on the Essence area only: the tally belongs beside the zone's name. */
    + (z.id === 'essarea' ? tdEssenceTallyHTML(b) : '')
    + acts
    + "<div class='td-zbody" + (gf ? ' td-gview' : '') + "'>"
    + (gf ? tdGfViewHTML(items.length ? body : '') : body) + "</div>"
    + "</section>";
}

/* One card size for every half (--td-cw), fitted to the window: no transform:scale, which every drag and fixed list
   would have to correct for. The last size is tried first; below the floor the page scrolls. */
var TD_CW_MAX = 132, TD_CW_MIN = 60;
/* The panel beside your Field can also stand as two columns, half as tall; the fit tries both and keeps the bigger
   cards, a tie keeping one column. */
var _tdFit = {cw:TD_CW_MAX, two:false, key:''};
/* Measured from the board to the window's foot, but never more than the app's header (--chrome) and the top row
   allow: the checks' harness puts the editor above the pane. */
function tdFitRoom(b){
  var top = b.getBoundingClientRect().top + (window.pageYOffset || 0);
  var chrome = parseFloat(getComputedStyle(document.documentElement).getPropertyValue('--chrome')) || 0;
  var row = document.getElementById('tdTable');
  var most = chrome + (row ? row.offsetHeight : 0) + 40;
  return window.innerHeight - Math.min(top, most) - 12;
}
function tdFitTable(){
  var b = document.getElementById('tdBoard');
  if(!b || !b.offsetWidth) return _tdFit.cw;            /* the page is not on screen */
  if(typeof tdRbFit === 'function' && b.querySelector(':scope > .rb-table')) return tdRbFit(b);
  var mine = b.querySelector('.td-half-mine');
  var room = tdFitRoom(b);
  var mode = function(two){ if(mine) mine.classList.toggle('td-play2', !!two); };
  var fld = mine ? mine.querySelector(".td-zone[data-zone='field']") : null;
  var fits = function(cw){
    b.style.setProperty('--td-cw', cw + 'px');
    tdSideLayout(b);
    /* Your Field must stay at least three cards wide: the side halves take their width from the middle. */
    if(fld && fld.offsetWidth < 3 * cw + 40) return false;
    return b.scrollHeight <= room && b.scrollWidth <= b.clientWidth + 2;
  };
  /* The last answer is tried first, and kept if it fits and one pixel more would not. */
  var key = window.innerWidth + 'x' + window.innerHeight
    + ':' + b.querySelectorAll('.td-half').length + ':' + (TD.expandedFoe || '')
    + ':' + tdFocusSeat()
    + ':' + (document.body.classList.contains('rebirth') ? 'rb' : 'mn');
  var F = _tdFit;
  if(F.key === key){
    mode(F.two);
    tdSmallCards(b, F.cw);
    var keep = fits(F.cw) && (F.cw >= TD_CW_MAX || !fits(F.cw + 1));
    if(keep){ b.style.setProperty('--td-cw', F.cw + 'px'); tdSideLayout(b); return F.cw; }
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
  var two = (mine && one < TD_CW_MAX) ? best(true) : 0;
  /* Nothing fits even at the smallest card: the shorter form, and the page scrolls. */
  var useTwo = !!mine && (two > one || (!one && !two));
  var cw = (useTwo ? two : one) || TD_CW_MIN;
  mode(useTwo);
  b.style.setProperty('--td-cw', cw + 'px');
  tdSideLayout(b);
  _tdFit = {cw:cw, two:useTwo, key:key};
  tdSmallCards(b, cw);
  return cw;
}
/* Below 100px the Hand's rail has no room for "Hidden" as well as the eye (testdeck.css). */
function tdSmallCards(b, cw){ b.classList.toggle('td-small', cw < 100); }
/* The Hand shares its row with the Essence area, so its cards overlap more as it grows; only below a fifth of a card
   each does it scroll. */
var TD_HAND_SHOW = 0.42, TD_HAND_SHOW_MIN = 0.2;
function tdFitHands(root){
  [].forEach.call((root || document).querySelectorAll('.td-zone.td-fan'), function(z){
    z.style.removeProperty('--td-hand-show');
    var body = z.querySelector('.td-zbody');
    var cards = body ? body.querySelectorAll(':scope > .td-card') : [];
    if(cards.length < 2) return;
    var cw = cards[0].offsetWidth;
    var cs = getComputedStyle(body);
    var avail = body.clientWidth - (parseFloat(cs.paddingLeft) || 0)
              - (parseFloat(cs.paddingRight) || 0) - 4;
    if(!cw || avail <= cw) return;
    var show = (avail - cw) / ((cards.length - 1) * cw);
    if(show >= TD_HAND_SHOW) return;
    z.style.setProperty('--td-hand-show', Math.max(TD_HAND_SHOW_MIN, show).toFixed(4));
  });
}
window.tdFitHands = tdFitHands;
window.tdFitTable = tdFitTable;
(function(){
  if(window._tdFitBound) return;
  window._tdFitBound = true;
  var timer = null;
  window.addEventListener('resize', function(){
    clearTimeout(timer);
    timer = setTimeout(function(){
      var pane = document.getElementById('pane-testdeck');
      if(pane && pane.style.display !== 'none' && typeof tdRender === 'function') tdRender();
    }, 160);
  });
})();

/* A folded zone keeps its header and count, and unfolds when a card arrives. No button folds one now (tdZoneHTML). */
var TD_FOLD_KEY = 'conjure_td_folded';
function tdFolded(){
  try{ return JSON.parse(localStorage.getItem(TD_FOLD_KEY) || '{}') || {}; }
  catch(_){ return {}; }
}
function tdIsFolded(zoneId, count){
  if(count) return false;               /* never hide a zone with cards in it */
  return !!tdFolded()[zoneId];
}
function tdToggleFold(zoneId){
  var f = tdFolded();
  if(f[zoneId]) delete f[zoneId]; else f[zoneId] = 1;
  try{ localStorage.setItem(TD_FOLD_KEY, JSON.stringify(f)); }catch(_){}
  tdRender();
}

function tdMoreMenuHTML(mapsOnly){
  /* The Maps (cat_rbdm.js): under the positions, or alone on the Encounter page (mapsOnly). */
  var maps = (typeof tdMapsMenuPart === 'function') ? tdMapsMenuPart(!!mapsOnly) : '';
  if(mapsOnly && !maps) return '';
  return "<span class='td-more'>"
    /* Named, not three dots: it is the only way to save and load a position. */
    + "<button class='ed2-btn tiny tbl-tool td-more-b' id='tdMoreBtn' aria-label='Save / Load'"
      + " aria-haspopup='true' aria-expanded='false' onclick='tdToggleMore(event)'"
      + " title='" + (mapsOnly ? 'Save or load a map' : 'Save current game state, or load game state') + "'>"
      + tdTopSvg('save') + "<span class='tbl-tw'>Save / Load</span> <span class='td-caret' aria-hidden='true'>&#9662;</span></button>"
    + "<div class='td-moredrop' id='tdMoreDrop' role='menu' aria-label='Save / Load' hidden>"
      + (mapsOnly ? '' : "<button class='td-moreitem' role='menuitem' onclick='tdCloseMore();tdExportBoard()'>"
        + "Save this position&hellip;<small>the board, as a file</small></button>"
      + "<button class='td-moreitem' role='menuitem' onclick='tdCloseMore();tdImportBoard()'>"
        + "Load a position&hellip;<small>replaces the board</small></button>")
      + maps
    + "</div></span>";
}
function tdToggleMore(ev){
  if(ev){ try{ ev.stopPropagation(); }catch(_){} }
  var d = document.getElementById('tdMoreDrop'), b = document.getElementById('tdMoreBtn');
  if(!d) return;
  var open = d.hidden;
  d.hidden = !open;
  if(b) b.setAttribute('aria-expanded', open ? 'true' : 'false');
  tdMoreLift(d, open);
}
function tdCloseMore(){
  var d = document.getElementById('tdMoreDrop'), b = document.getElementById('tdMoreBtn');
  if(d) d.hidden = true;
  if(b) b.setAttribute('aria-expanded', 'false');
  tdMoreLift(d, false);
}
/* The top row is its own layer (sticky, z-index 76), so it is lifted over the record, the chat and the DM Tools only
   while its list is open. */
function tdMoreLift(d, up){
  var row = d && d.closest ? d.closest('.td-table') : null;
  if(row) row.classList.toggle('td-up', !!up);
}
(function(){
  if(document._tdMoreBound) return;
  document._tdMoreBound = true;
  document.addEventListener('pointerdown', function(ev){
    var d = document.getElementById('tdMoreDrop');
    if(!d || d.hidden) return;
    if(ev.target.closest && ev.target.closest('.td-more')) return;
    tdCloseMore();
  }, true);
})();

/* Offered only when there is a game to come back to that is not the one on screen. */
function tdResumeBtnHTML(){
  var s = tdSavedGame();
  if(!tdSavedIsElsewhere(s)) return '';
  /* Delete Game is offered whenever Resume is, so the saved slot can be cleared. */
  return tdTopBtn('resume', 'tdResume()', 'Resume', 'Revert game to — ' + tdSavedWords(s), 'td-resume');
}
/* Its own function, as Resume and Delete Game are not neighbours in the row. "Delete Game", not "Discard", which is a
   card's move to the Grave. */
function tdForgetBtnHTML(){
  var s = tdSavedGame();
  if(!tdSavedIsElsewhere(s)) return '';
  return tdTopBtn('del', 'tdForgetOffer()', 'Delete Game', 'Delete the saved game — ' + tdSavedWords(s),
                  'tbl-red td-forget');
}
/* Confirmed: it throws away a game in progress, with no undo. */
window.tdForgetOffer=function(){
  var s = tdSavedGame();
  if(s && !confirm('Delete the saved game?\n\n' + tdSavedWords(s)
      + '\n\nThis cannot be undone.')) return;
  tdForgetSaved();
  try{ tdRenderBar(); }catch(_){ try{ tdRender(); }catch(_){} }
};

/* Only at four halves on screen (not four opponents) are the side halves compact: their Field full size, every pile
   folded; Open on a banner opens one in full and closes the last. Layout only. */
function tdCompactFoes(){
  if(tdFocusSeat()) return false;
  return tdSeatOrder().length >= 4;
}
/* Focus is yours alone and only a way of looking: nothing is sent. A seat that empties takes it with it, and
   leaving the table clears it (tblClose). */
function tdFocusSeat(){
  var f = TD.focus || '';
  if(!f) return '';
  if(!(typeof tblAtTable === 'function' && tblAtTable())) return '';
  if(TD.board && f === TD.side) return f;
  return tdFoeOf(f) ? f : '';
}
function tdFocusOn(seat){
  tdCloseMenu();
  TD.focus = String(seat || '');
  tdRender();
}
function tdStopFocus(){
  tdCloseMenu();
  if(!TD.focus) return;
  TD.focus = '';
  tdRender();
}
function tdOpenChipMenu(seat, x, y){
  tdCloseMenu();
  if(!seat) return;
  /* A Rebirth table has one shared Field and no board to focus on. */
  if(typeof tdRbOn === 'function' && tdRbOn()) return;
  var s = (typeof TBL !== 'undefined' && TBL.seats && TBL.seats[seat]) || null;
  var name = (s && s.name) || 'Player';
  var on = (TD.focus === seat);
  tdShowMenu(name, [on ? {label:'Stop Focusing', act:function(){ tdStopFocus(); }}
                       : {label:'Focus', act:function(){ tdFocusOn(String(seat).replace(/[^a-f]/g, '')); }}],
             '', x, y);
}
window.tdFocusSeat = tdFocusSeat;
window.tdFocusOn = tdFocusOn;
window.tdStopFocus = tdStopFocus;
window.tdOpenChipMenu = tdOpenChipMenu;
/* You at the bottom, the others round the table in turn order: with two, across; three, across and right; four,
   right, across and left. The sides are turned on their sides; a spectator's first seat takes the bottom. */
function tdSeatOrder(){
  var foes = tdFoeList(), have = {};
  foes.forEach(function(b){ if(b && b.side) have[b.side] = b; });
  var me = TD.board ? TD.side : null;
  var v = me || TD_SEATS.filter(function(s){ return !!have[s]; })[0] || null;
  var i = TD_SEATS.indexOf(v);
  var ring = i < 0 ? TD_SEATS.slice() : TD_SEATS.slice(i).concat(TD_SEATS.slice(0, i));
  return ring.filter(function(s){ return (me && s === me) || !!have[s]; });
}
function tdSeatPlaces(){
  var foc = tdFocusSeat();
  if(foc){
    if(TD.board && foc === TD.side) return {near:foc, top:null, right:null, left:null};
    return {near:null, top:foc, right:null, left:null};
  }
  var ring = tdSeatOrder(), o = ring.slice(1);
  var P = {near:ring[0] || null, top:null, right:null, left:null};
  if(o.length === 1) P.top = o[0];
  else if(o.length === 2){ P.top = o[0]; P.right = o[1]; }
  else if(o.length >= 3){ P.right = o[0]; P.top = o[1]; P.left = o[2]; }
  return P;
}
window.tdSeatPlaces = tdSeatPlaces;
/* getBoundingClientRect answers in the screen's directions, and a half can be on its side: whatever measures a card
   against its half measures through these. */
function tdRotOf(el){
  var h = el && el.closest ? el.closest('.td-half') : null;
  return h ? (parseInt(h.getAttribute('data-rot'), 10) || 0) : 0;
}
function tdLocalSize(r, rot){
  return (rot === 90 || rot === -90) ? {width:r.height, height:r.width}
                                     : {width:r.width, height:r.height};
}
/* `r` in the frame of `cr` (both screen rects), as the half draws it */
function tdLocalRect(r, cr, rot){
  if(rot === 90) return {left:r.top - cr.top, right:r.bottom - cr.top,
                         top:cr.right - r.right, bottom:cr.right - r.left};
  if(rot === -90) return {left:cr.bottom - r.bottom, right:cr.bottom - r.top,
                          top:r.left - cr.left, bottom:r.right - cr.left};
  return {left:r.left - cr.left, right:r.right - cr.left,
          top:r.top - cr.top, bottom:r.bottom - cr.top};
}
window.tdRotOf = tdRotOf;
window.tdLocalRect = tdLocalRect;
/* Each side half is laid out as long as the table is tall, then turned; its thickness narrows the middle, so it
   settles in a pass or two. */
function tdSideLayout(b){
  var sides = b ? b.querySelectorAll(':scope > .td-side') : [];
  if(!sides.length) return;
  for(var pass = 0; pass < 4; pass++){
    var changed = false;
    [].forEach.call(sides, function(w){
      var h = w.firstElementChild;
      if(!h) return;
      var L = w.clientHeight;
      if(L > 0 && Math.abs(h.offsetWidth - L) > 0.5){ h.style.width = L + 'px'; changed = true; }
      var T = h.offsetHeight;
      var v = '--td-side-' + (w.classList.contains('td-side-left') ? 'l' : 'r');
      if(Math.abs((parseFloat(b.style.getPropertyValue(v)) || 0) - T) > 0.5){
        b.style.setProperty(v, T + 'px'); changed = true;
      }
    });
    if(!changed) break;
  }
  /* Both turned a quarter clockwise, so the writing runs the same way; the left player's Hand is at the left edge by
     how their half is drawn. */
  [].forEach.call(sides, function(w){
    var h = w.firstElementChild;
    if(h) h.style.transform = 'translate(' + h.offsetHeight + 'px,0) rotate(90deg)';
  });
}
function tdExpanded(){ return TD.expandedFoe || ''; }
function tdExpandFoe(side){
  TD.expandedFoe = (TD.expandedFoe === side) ? '' : side;
  tdRender();
}
/* Kept for as long as you sit at the table, so a colour stays a way to tell whose area is whose. */
var TD_TINTS = ['red', 'yellow', 'green', 'blue', 'violet'];
function tdFoeTint(seat){
  var room = (typeof TBL !== 'undefined' && TBL.room) || '';
  if(!TD.tints || TD.tints._room !== room) TD.tints = {_room:room};
  if(Object.prototype.hasOwnProperty.call(TD.tints, seat) && TD_TINTS.indexOf(TD.tints[seat]) >= 0)
    return TD.tints[seat];
  var used = Object.keys(TD.tints).map(function(k){ return TD.tints[k]; });
  var free = TD_TINTS.filter(function(c){ return used.indexOf(c) < 0; });
  var pool = free.length ? free : TD_TINTS;
  TD.tints[seat] = pool[Math.floor(Math.random() * pool.length)];
  return TD.tints[seat];
}
window.tdFoeTint = tdFoeTint;
function tdFoeBannerHTML(board, compact){
  if(!board) return '';
  var open = tdExpanded() === board.side;
  var counts = ['hand', 'deck', 'field'].map(function(z){
    var n = (board.zones[z] || []).length;
    return "<span class='td-fbn'>" + e(tdZoneWords(z)) + " <b>" + n + "</b></span>";
  }).join('');
  var life = board.counters && board.counters.life;
  return "<div class='td-foebar'>"
    + "<span class='td-fbname'>" + e(board.name || 'Player') + "</span>"
    + (life == null ? '' : "<span class='td-fbn'>Life <b>" + e(String(life)) + "</b></span>")
    + counts
    + "<span class='td-fbgap'></span>"
    + (tdCompactFoes()
        ? "<button type='button' class='td-fbbtn" + (open ? ' close-x' : '') + "' data-expand='" + e(board.side) + "'"
          + " title='" + (open ? 'Fold their board back down'
                                : 'Open their whole board out') + "'>"
          + (open ? 'Close &#10005;' : 'Open') + "</button>"
        : '')
    + "</div>";
}

/* #tdBar is the game's part of the top row and only tdRenderBar writes it: the table's heartbeat never redraws it,
   so the Save / Load list cannot close under the pointer. New Game is for solo play only. */
var TD_TOP_ICONS = {
  newgame:"<rect x='3' y='6' width='12' height='15' rx='2'/><path d='M7 3h10a2 2 0 0 1 2 2v12'/><path d='M9 10.5v6M6 13.5h6'/>",
  keys:"<rect x='2' y='6' width='20' height='12' rx='2'/><path d='M6 10h.01M10 10h.01M14 10h.01M18 10h.01M7 14h10'/>",
  reset:"<path d='M3 12a9 9 0 1 0 3-6.7L3 8'/><path d='M3 3v5h5'/>",
  resume:"<path d='M9 14L4 9l5-5'/><path d='M20 20v-7a4 4 0 0 0-4-4H4'/>",
  save:"<path d='M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z'/><path d='M17 21v-8H7v8M7 3v5h8'/>",
  del:"<path d='M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6'/>",
  log:"<path d='M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01'/>"
};
function tdTopSvg(icon){
  return "<svg viewBox='0 0 24 24' fill='none' stroke='currentColor' stroke-width='2'"
    + " stroke-linecap='round' stroke-linejoin='round' aria-hidden='true'>"
    + (TD_TOP_ICONS[icon] || '') + "</svg>";
}
/* aria-label carries the word, so the button keeps its name when the row shows the icon alone (td-iconic). */
function tdTopBtn(icon, act, word, title, cls, id, extra){
  return "<button class='ed2-btn tiny tbl-tool" + (cls ? ' ' + cls : '') + "'"
    + (id ? " id='" + id + "'" : '') + " onclick=\"" + act + "\""
    + " title='" + e(title || word) + "' aria-label='" + e(word) + "'" + (extra || '') + ">"
    + tdTopSvg(icon) + "<span class='tbl-tw'>" + word + "</span></button>";
}
function tdLogBtnHTML(){
  var open = tdFeedOpen();
  return tdTopBtn('log', 'tdToggleFeed()', 'Record Log',
                  open ? 'Hide the record' : 'Show the record',
                  open ? 'on' : '', 'tdLogBtn', " aria-pressed='" + (open ? 'true' : 'false') + "'");
}
window.tdLogBtnHTML = tdLogBtnHTML;

function tdRenderBar(){
  /* Each call fits the row once, at its end, and the table skips its own fit meanwhile (_tdInBar). */
  _tdInBar = true;
  if(typeof tblRenderPanel === 'function'){ try{ tblRenderPanel(); }catch(_){} }
  _tdInBar = false;
  var bar = document.getElementById('tdBar');
  if(!bar) return;
  if(tdIsPool()){
    bar.innerHTML = tdTopBtn('reset', 'tdRewClear()', 'Start Over', 'Start the specification over')
      + "<span class='td-stat'>" + tdPoolNoun() + " deck <b>"
      + tdRewPool().length + "</b></span>"
      + (tdIsEncounter() ? tdMoreMenuHTML(true)
          + ((TD.board && TD.board.map) ? "<span class='td-stat'>Map <b>" + e(TD.board.map) + "</b></span>" : '')
        : '');
    tdTopRowFit();
    return;
  }
  /* Spectating: only taking the position away. */
  if(TD.watching){ bar.innerHTML = tdMoreMenuHTML(); tdTopRowFit(); return; }
  var canUndo = tdCanUndo();
  /* No Draw button: D and 1 to 9 draw from the keys, and the Deck's right-click has Draw and Draw X. Shuffle wears
     the Copy counter's purple. */
  var colHTML =
      "<span class='td-barcol'>"
      + "<button class='dv-pbtn dv-pbtn-sm td-shuffle' onclick='tdShuffleDeck()' aria-label='Shuffle'>"
        + uiIco('shuffle') + " Shuffle</button>"
      + "<button class='dv-pbtn dv-pbtn-sm td-undo' id='tdUndoBtn' aria-label='Undo'"
        + (canUndo ? '' : ' disabled')
        + " onclick='tdUndo()' title='"
        + (canUndo ? ('Undo (Ctrl+Z) — '
                      + (TD.log.length - 1) + ' to step back')
                   : 'Nothing to undo yet')
        + "'>" + uiIco('undo') + " Undo</button>"
    + "</span>";
  /* The counter row that carries this host may not be built yet. */
  var _pb = document.getElementById('tdPlayBar');
  if(_pb) _pb.innerHTML = colHTML;
  bar.innerHTML = (tdSoloGame()
        ? tdTopBtn('newgame', 'tdNewGame()', 'New Game', 'Shuffle the deck and deal a new opening hand')
        : '')
    + tdTopBtn('keys', 'tdToggleKeySheet()', 'Shortcuts', 'The keys this page answers to')
    + tdTopBtn('reset', 'tdResetCounters()', 'Reset Counters', 'Clears counters and values')
    + tdResumeBtnHTML()
    + tdMoreMenuHTML()
    + tdForgetBtnHTML();
  tdTopRowFit();
}
/* No table, not even one being joined or rejoined, and not spectating. */
function tdSoloGame(){
  if(TD.watching) return false;
  if(typeof tblAtTable === 'function' && tblAtTable()) return false;
  return !tdIsPool();
}
/* Asked again on the press: the row may have been drawn just before a table was joined. */
function tdNewGame(){
  if(!tdSoloGame()) return false;
  /* A new game starts a new record, solo only as this button is: at a table the record also holds what people said. */
  TD.feed = [];
  tdStart(true);
  if(typeof tdRenderFeed === 'function') tdRenderFeed();
  return true;
}
window.tdNewGame = tdNewGame;
window.tdSoloGame = tdSoloGame;
/* One line, giving ground in stages as it would wrap: td-tight (less space, a smaller room code), td-iconic (icons
   alone), td-tiny (the round trip, the phase words and your own numbers go); then it wraps. */
var _tdInBar = false;
var TD_ROW_STAGES = ['td-tight', 'td-iconic', 'td-tiny'];
function tdTopRowWraps(row){
  var items = row.querySelectorAll('.td-th > *');
  var mid = null;
  for(var i = 0; i < items.length; i++){
    var it = items[i];
    if(!it.offsetWidth) continue;
    var m = it.offsetTop + it.offsetHeight / 2;
    if(mid === null) mid = m;
    else if(Math.abs(m - mid) > 8) return true;
  }
  return false;
}
/* Fitted again only when the row's width, contents, classes, style or the fonts have changed: the answer is the same. */
var _tdRowFitKey = '';
function tdTopRowFitKey(row){
  return row.offsetWidth + '|' + row.className + '|' + row.style.cssText + '|'
    + ((document.fonts && document.fonts.status) || '') + '|' + row.innerHTML;
}
function tdTopRowFit(){
  var row = document.getElementById('tdTable');
  if(row && row.offsetWidth && tdTopRowFitKey(row) !== _tdRowFitKey){
    TD_ROW_STAGES.forEach(function(c){ row.classList.remove(c); });
    for(var i = 0; i < TD_ROW_STAGES.length && tdTopRowWraps(row); i++)
      row.classList.add(TD_ROW_STAGES[i]);
    _tdRowFitKey = tdTopRowFitKey(row);
  }
  /* The Encounter page's counter strip pins under the row and needs its height, written only when it changed: a new
     value restyles the whole pane. */
  var pane = document.getElementById('pane-testdeck');
  if(row && pane){
    var h = row.offsetHeight + 'px';
    if(pane.style.getPropertyValue('--td-tbl-h') !== h) pane.style.setProperty('--td-tbl-h', h);
  }
}
window.tdTopRowFit = tdTopRowFit;

/* tdRenderSoon draws at once if the board has not been drawn this frame, else owes one drawing at the next frame. A
   caller that reads the board straight after uses tdRender. */
var _tdFrame = {busy:false, owed:false};
function tdFrameMark(){
  _tdFrame.owed = false;
  if(_tdFrame.busy || typeof requestAnimationFrame !== 'function') return;
  _tdFrame.busy = true;
  requestAnimationFrame(function(){
    _tdFrame.busy = false;
    if(_tdFrame.owed) tdRender();
  });
}
function tdRenderSoon(){
  if(_tdFrame.busy){ _tdFrame.owed = true; return; }
  tdRender();
}
window.tdRenderSoon = tdRenderSoon;

function tdRender(){
  var host = document.getElementById('tdBoard');
  if(!host) return;
  tdFrameMark();
  /* Bound before the returns below (a spectator with no board, no deck, the deal, the pool pages), each guarded, so
     binding early costs a boolean read. */
  tdBindAlt();
  /* The same for the drag, the menu and the keys: a page opened on Encounter returns at the pool branch. */
  tdBindDrag();
  tdBindMenu();
  if(typeof tdDmRender === 'function') tdDmRender();
  /* The record and the chat, if they were placed while the top row was off the screen (tdFloatWin). */
  ['tdFeed', 'tblChat'].forEach(function(id){
    var w = document.getElementById(id);
    if(w && w._tdBarLate && w._tdWin && !w.hidden) tdFloatWin(w, w._tdWin);
  });
  /* A spectator has no half; with no players' halves either there is nothing to draw yet. */
  /* Auto-start only with a deck to deal: an empty board would take the save slot and look like a broken game. New Game
     and Play Again start whatever is there. */
  if(!TD.board && !tdFoeOn()){
    if(TD.watching) return;
    if(!tdDeckHasCards()){ tdSyncTopStrip(); if(!tdRenderCounters()) tdRenderBar(); return; }
    tdStart();
    return;
  }
  host.classList.toggle('td-watching', !!TD.watching);
  /* A declaration, not an expression assigned below: the pool branch that builds Encounter calls it too. */
  function halfHTML(board, isFoe, place){
    /* data-seat, not just 'foe': with three opponents every lookup of a half must say which. */
    var seat = (board && board.side) || (isFoe ? 'b' : TD.side);
    var side = (place === 'left' || place === 'right');
    var compact = isFoe && side && tdCompactFoes() && tdExpanded() !== seat;
    return "<div class='td-half" + (isFoe ? ' td-half-foe' : ' td-half-mine')
      + (side ? ' td-half-side' : '') + ((isFoe && place === 'near') ? ' td-half-near' : '')
      + (place === 'left' ? ' td-half-left' : '')
      + (compact ? ' td-compact' : '') + "'"
      + " data-side='" + (isFoe ? 'foe' : 'mine') + "'"
      + (place ? " data-place='" + place + "'" : '')
      + (side ? " data-rot='90'" : '')
      + ((isFoe && place !== 'near') ? " data-tint='" + tdFoeTint(seat) + "'" : '')
      + " data-seat='" + e(seat) + "'>"
      /* The half across needs no banner, as the line under it names them; the side halves carry their names. */
      + ((isFoe && side) ? tdFoeBannerHTML(board, compact) : '')
      + tdZones().filter(tdZoneInHalf).map(function(z){ return tdZoneHTML(z, board); }).join('')
      /* Your half only, and not on a pool page: these controls act on your board, and Encounter's grid has no play area. */
      + ((!isFoe && !tdIsPool()) ? tdPanelsHTML() : '')
      /* Only the free counters go on this layer: tdCardHTML draws the attached ones inside their card. */
      + "<div class='td-tokens'" + (isFoe ? '' : " id='tdTokens'") + ">"
      + ((board.tokens || []).filter(function(t){ return !t.on; })
          .map(tdTokenHTML).join(''))
      + "</div></div>";
  }
  /* Emitted empty: tdRenderCounters fills #tdPlayCtrs (and tdRenderBar #tdPlayBar) just after, and rebuilds them on
     their own. */
  function tdPanelsHTML(){
    /* No #tdPlayBar here: tdRenderCounters emits it in the counter row, and two would share one id. */
    return "<div class='td-play'>"
      + "<div class='td-play-ctrs' id='tdPlayCtrs'></div>"
      + "</div>";
  }
  var foes = tdFoeList();
  var places = tdSeatPlaces();
  var nearFoe = (!TD.board || places.near !== TD.side) ? tdFoeOf(places.near) : null;
  var mid = function(b){
    return "<div class='td-midline'><span>" + e((b && b.name) || 'Opponent')
      + (nearFoe ? " &nbsp;/&nbsp; " + e(nearFoe.name || TD.boardName || 'Player') : '')
      + "</span></div>";
  };
  if(tdIsPool()){
    /* The panel is built once, as rebuilding it would take the focus from a field being typed in; the board is rebuilt
       every time. */
    if(!document.getElementById('tdRewCount')){
      host.innerHTML = tdRewardsHTML()
        + (tdIsEncounter()
            ? "<div class='td-board td-encboard' id='tdEncBoard'></div>" : '');
    }
    /* After the markup is in: the first type row of each column comes from the sidebar's own makeSURow/makeSTRow. */
    tdRewMount();
    if(tdIsEncounter()){
      var eb = document.getElementById('tdEncBoard');
      if(eb && TD.board){
        eb.innerHTML = halfHTML(TD.board, false);
        tdPaintFaces(eb);
        var encMine = eb.querySelector('.td-half-mine');
        tdReflowFree(encMine, TD.board);
        tdPlaceCardTokens(encMine, TD.board);
        if(typeof tdGfAfterRender === 'function') tdGfAfterRender(eb);
      }
    }
    tdFitTitles(host);
    tdSyncTopStrip();
    if(!tdRenderCounters()) tdRenderBar();
    tdRewSync();
    return;
  }
  /* A Rebirth table is laid out round one shared Field (cat_rbtable.js, HANDOFF §84). */
  if(typeof tdRbOn === 'function' && tdRbOn()){ tdRbRender(host); return; }
  /* The half across from you comes first in the document, which puts it across the table; then yours, then the sides
     (tdSeatPlaces). */
  var topB = places.top ? tdFoeOf(places.top) : null;
  var html = (topB ? halfHTML(topB, true, 'top') + mid(topB) : '')
    + (TD.board && places.near === TD.side ? halfHTML(TD.board, false, 'near')
       : (nearFoe ? halfHTML(nearFoe, true, 'near') : ''));
  ['right', 'left'].forEach(function(pl){
    var sb = places[pl] ? tdFoeOf(places[pl]) : null;
    if(sb) html += "<div class='td-side td-side-" + pl + "' data-seat='" + e(sb.side) + "'>"
      + halfHTML(sb, true, pl) + "</div>";
  });
  host.innerHTML = html;
  var nHalves = host.querySelectorAll('.td-half').length;
  host.classList.toggle('td-two', nHalves > 1);
  host.classList.toggle('td-seats3', nHalves === 3);
  host.classList.toggle('td-seats4', nHalves >= 4);
  host.classList.remove('td-many');
  if(nHalves < 3){ host.style.removeProperty('--td-side-l'); host.style.removeProperty('--td-side-r'); }
  tdSyncTopStrip();
  /* The panels are filled before the table is fitted, as the panel sets the height. tdRenderCounters fills the bar,
     so it is filled here only when that did not run. */
  if(!tdRenderCounters()) tdRenderBar();
  /* Before any face is painted: a face is sized to its card when it is painted. */
  tdFitTable();
  tdFitHands(host);

  tdPaintFaces(host);
  if(TD.board){
    var mineEl = host.querySelector('.td-half-mine');
    tdReflowFree(mineEl, TD.board);
    tdPlaceCardTokens(mineEl, TD.board);
  }
  foes.forEach(function(b){
    var foeEl = host.querySelector('.td-half-foe' + tdSel(b.side, 'data-seat'));
    if(!foeEl) return;
    tdReflowFree(foeEl, b);
    tdPlaceCardTokens(foeEl, b);
  });
  /* The map's measuring before the lines, which start and end on symbols placed from it. */
  if(typeof tdGfAfterRender === 'function') tdGfAfterRender(host);
  if(typeof tdFxAfterRender === 'function') tdFxAfterRender(host);
  tdRenderArrows();
  tdRenderPointer();
  tdRenderMoved();
  tdReflash();
  /* Counters are placed from measured sizes, and a card font not yet swapped measures differently, so once the fonts
     are ready they are placed again. The layer is clipped too. */
  if(!TD._fontsBound && document.fonts && document.fonts.ready){
    TD._fontsBound = true;
    document.fonts.ready.then(function(){
      var h = document.getElementById('tdBoard');
      if(!h || !TD.board) return;
      tdPlaceCardTokens(h.querySelector('.td-half-mine'), TD.board);
      tdFoeList().forEach(function(fb){
        tdPlaceCardTokens(h.querySelector('.td-half-foe' + tdSel(fb.side, 'data-seat')), fb);
      });
      /* Again with the fonts in: a title measured in the fallback font has the wrong width. */
      tdFitTitles(document.getElementById('tdBoard'));
      tdFitTitles(tdCtrHost());
    });
  }
  tdFitTitles(host);
  /* tdBindAlt, tdBindDrag and tdBindMenu are at the top of this function, so pages that return early get them too. */
}

/* Over the card's measured art box (.m-art), so no counter covers the name, the type line, the pips or the rules,
   on any frame. Each is laid under the last, a new column when the next will not fit. */
function tdPlaceCardTokens(host, board){
  /* Measured with the map's zoom off (cat_rbgrid.js). */
  if(typeof tdGfUnscaled === 'function' && tdGfUnscaled(function(){ tdPlaceCardTokens(host, board); })) return;
  var bd = board || TD.board;
  if(!host || !bd || !bd.tokens || !bd.tokens.length) return;
  var layers = (host || document).querySelectorAll('.td-cardtok');
  /* In the half's own directions: it may be on its side. */
  var rot = tdRotOf(host);
  /* Sweep by sweep over every card (bands, layers, counters measured, counters placed), not card by card, which laid
     the page out again for every counter. */
  var plan = [];
  [].forEach.call(layers, function(layer){
    var card = layer.parentNode;
    if(!card) return;
    var cr0 = card.getBoundingClientRect();
    var cr = tdLocalSize(cr0, rot);
    if(!cr.width || !cr.height) return;
    var p = {layer:layer, band:null};
    plan.push(p);
    /* In percent of the card, so it survives a resize unmeasured. */
    var art = card.querySelector('.m-art');
    if(art){
      var ar = tdLocalRect(art.getBoundingClientRect(), cr0, rot);
      if(ar.right - ar.left > 4 && ar.bottom - ar.top > 4){
        var L = ar.left, T = ar.top, R = ar.right, B = ar.bottom;
        /* The type line overlaps the top of the art box and the orbs run down its left, so the band starts below whichever
           reaches further in. */
        var tl = card.querySelector('.m-typeline');
        if(tl){
          var tr = tdLocalRect(tl.getBoundingClientRect(), cr0, rot);
          if(tr.bottom > T && tr.top < B && tr.bottom < B) T = tr.bottom + 1;
        }
        var orbs = card.querySelector('.m-orbs');
        if(orbs){
          var or = tdLocalRect(orbs.getBoundingClientRect(), cr0, rot);
          if(or.right - or.left > 1 && or.right > L && or.left < R && or.right < R)
            L = or.right + 1;
        }
        if(R - L > 8 && B - T > 8)
          p.band = {left:   ((L / cr.width)  * 100) + '%',
                    top:    ((T / cr.height) * 100) + '%',
                    width:  (((R - L) / cr.width)  * 100) + '%',
                    height: (((B - T) / cr.height) * 100) + '%'};
      }
    }
  });
  plan.forEach(function(p){
    if(!p.band) return;
    var s = p.layer.style;
    s.left = p.band.left; s.top = p.band.top; s.width = p.band.width; s.height = p.band.height;
  });
  plan.forEach(function(p){
    p.lr = tdLocalSize(p.layer.getBoundingClientRect(), rot);
    p.toks = [].map.call(p.layer.querySelectorAll('.td-token'), function(tk){
      return {el:tk, r:tdLocalSize(tk.getBoundingClientRect(), rot)};
    });
  });
  plan.forEach(function(p){
    var lr = p.lr;
    if(!lr.width || !lr.height) return;
    var x = 0, y = 0, colW = 0, gap = 2;
    p.toks.forEach(function(t){
      var w = t.r.width, h = t.r.height;
      if(y > 0 && y + h > lr.height){ x += colW + gap; y = 0; colW = 0; }
      /* Clamped into the band too: a counter measured while a font was swapping can come out bigger and spill over the rules. */
      var px = Math.max(0, Math.min(x, lr.width  - w));
      var py = Math.max(0, Math.min(y, lr.height - h));
      t.el.style.left = px + 'px';
      t.el.style.top  = py + 'px';
      y += h + gap;
      if(w > colW) colW = w;
    });
  });
}

/* After the markup is in, writing to the DOM: re-rendering would recurse. tdSpreadFree only guesses, as the zone
   does not exist yet; a card the player dropped (auto:false) is never moved. */
function tdReflowFree(host, board){
  /* Measured with the map's zoom off (cat_rbgrid.js). */
  if(typeof tdGfUnscaled === 'function' && tdGfUnscaled(function(){ tdReflowFree(host, board); })) return;
  var bd = board || TD.board;
  if(!bd || !host) return;
  tdZones().forEach(function(z){
    if(z.kind !== 'free') return;
    var items = bd.zones[z.id];
    if(!items || !items.length) return;
    var body = host.querySelector('.td-zone' + tdSel(z.id, 'data-zone') + ' .td-zbody');
    if(!body) return;
    /* In the half's own directions: it may be on its side. */
    var rot = tdRotOf(host);
    var br = tdLocalSize(body.getBoundingClientRect(), rot);
    var any = body.querySelector('.td-card');
    if(!br.width || !br.height || !any) return;
    var cr = tdLocalSize(any.getBoundingClientRect(), rot);
    if(!cr.width || !cr.height) return;
    var stepX = ((cr.width  + 10) / br.width)  * 100;
    var stepY = ((cr.height + 10) / br.height) * 100;
    var maxX  = Math.max(0, (1 - cr.width  / br.width)  * 100);
    var maxY  = Math.max(0, (1 - cr.height / br.height) * 100);
    var perRow = Math.max(1, Math.floor(maxX / stepX) + 1);
    /* The Essence area's rows are centred, here and not in the action: a position measured from this window never goes
       into the board. */
    var centred = (z.id === 'essarea');
    var live = items.filter(function(it){
      return it.auto !== false && !it.connectedTo; }).length;
    var slot = 0;
    items.forEach(function(it){
      if(it.auto === false) return;      /* the player put this one here */
      if(it.connectedTo) return;         /* placed by the group it hangs from */
      var col = slot % perRow, row = Math.floor(slot / perRow);
      var inRow = centred
        ? Math.min(perRow, live - row * perRow)   /* the last row is short */
        : perRow;
      var lead = centred ? Math.max(0, (maxX - (inRow - 1) * stepX) / 2) : 0;
      slot++;
      /* The DOM only, never the board: these numbers come from this window, and in the board they would differ by screen
         and on replay. */
      var x = Math.round(Math.min(maxX, lead + col * stepX) * 100) / 100;
      var y = Math.round(Math.min(maxY, row * stepY) * 100) / 100;
      var el = body.querySelector('.td-card' + tdSel(it.uid));
      if(!el) return;
      /* A card with cards attached under it is positioned by its group. */
      var g = el.parentNode;
      var target = (g && g.classList && g.classList.contains('td-group')) ? g : el;
      target.style.left = x + '%';
      target.style.top  = y + '%';
    });
  });
}


/* Out from the middle (0, +1, -1, +2, ...), skipping spots already taken, as cores also arrive by the Level seeder,
   a drag or an Undo. Percentages, as a free zone stores them. */
var TD_ESS_STEP = 11.5;          /* about one card's width in this zone */
var TD_ESS_ROW  = 26;            /* and about one card's height */
function tdEssenceSpawnAt(board){
  var b = board || TD.board;
  var items = (b && b.zones && b.zones.essarea) || [];
  var placed = items.filter(function(it){ return it && it.x != null; });
  var mid = 50 - TD_ESS_STEP / 2;
  var clear = function(x, y){
    return !placed.some(function(it){
      return Math.abs((+it.x || 0) - x) < TD_ESS_STEP * 0.75
          && Math.abs((+it.y || 0) - y) < TD_ESS_ROW * 0.75;
    });
  };
  for(var row = 0; row < 6; row++){
    var y = 6 + row * TD_ESS_ROW;
    for(var i = 0; i < 7; i++){
      var k = Math.ceil(i / 2) * ((i % 2) ? 1 : -1);
      var x = mid + k * TD_ESS_STEP;
      if(x < 2 || x > 90) continue;
      if(clear(x, y)) return {x:Math.round(x * 100) / 100, y:y};
    }
  }
  /* Every slot taken: on the middle, rather than refused. */
  return {x:Math.round(mid * 100) / 100, y:6};
}
/* First guesses only, as the zone does not exist yet: tdReflowFree measures and redoes them, and auto stays true
   until a drop. */
function tdSpreadFree(items){
  items.forEach(function(it, i){
    it.x = 4 + (i % 8) * 11.5;
    it.y = 6 + Math.floor(i / 8) * 30;
    it.auto = true;
  });
}

/* Derived from _ESSENCE_COLOR_MAP, so renaming an essence there renames it in every message. */
function tdEssenceNameFor(colorKey){
  var map = (typeof _ESSENCE_COLOR_MAP !== 'undefined' && _ESSENCE_COLOR_MAP)
            || window._ESSENCE_COLOR_MAP || {};
  var want = String(colorKey || '').toLowerCase();
  var keys = Object.keys(map);
  for(var i = 0; i < keys.length; i++)
    if(String(map[keys[i]]).toLowerCase() === want) return keys[i];
  return colorKey;
}
/* Not through board.missing, whose sentence is about a deck file; this says what it looked for and what the
   catalogue holds. */
function tdSeedCharacterReport(missColors){
  if(!missColors.length || typeof alert !== 'function') return;
  var each = missColors.map(tdEssenceNameFor);
  var names = each.length < 2 ? (each[0] || '')
    : each.slice(0, -1).join(', ') + ' and ' + each[each.length - 1];
  var have = tdEssenceCardCount();
  var msg;
  if(!have){
    msg = 'The Level asks for ' + names + ' Essence, and this catalogue has no'
        + ' Essence cards at all.' + String.fromCharCode(10, 10)
        + 'Make them in the Editor: super-types Core and Essence, and the'
        + ' sub-type is the essence - Ire, Vig, Lux, Arch, Yune, Psy or Gris.';
  } else {
    msg = 'The Level asks for ' + names + ' Essence, and this catalogue has no'
        + ' Essence card of that kind.' + String.fromCharCode(10, 10)
        + 'It holds ' + have + ' Essence card(s). One is used for a Level letter'
        + ' when its SUB-TYPE is the essence - Ire, Vig, Lux, Arch, Yune, Psy or'
        + ' Gris - or, failing that, when its name says so.';
  }
  alert(msg);
}
/* Rebirth Character's opening: Armaments on the Field, the Level's Core Essence in the Essence Area and a hand of
   the Level's length. Called by tdStart, after the log is reset. */
function tdSeedCharacter(){
  var el = document.getElementById('dta-lvl');
  var letters = tdLevelLetters(el ? el.value : '');
  var by = tdCoreEssenceByColor(), ess = [], miss = [], seenMiss = {};
  letters.forEach(function(L){
    var key = TD_LVL_COLOR[L];
    var card = by[key];
    if(!card){
      if(!seenMiss[key]){ seenMiss[key] = 1; miss.push(key); }
      return;
    }
    ess.push({uid:tdUid('td'), card:card, locked:false});
  });
  TD.board.zones.essarea = ess;
  tdSpreadFree(TD.board.zones.essarea);
  tdSpreadFree(TD.board.zones.field);
  /* The log opens again on the seeded board: the Essences and the Field are the starting position, so the first Undo
     keeps them. */
  tdLogReset();
  if(letters.length) tdDraw(Math.min(letters.length, TD.board.zones.deck.length));
  /* After the board is built: an alert mid-build would leave the opening undealt behind a modal. */
  tdSeedCharacterReport(miss);
}

/* The serialized board, the record in words and the room are kept, written a moment after each action. The log is
   not: it grows without bound in a few megabytes of storage, so undo starts again from a resumed position. */
var TD_SAVE_KEY = 'conjure_td_saved_';
/* The debounce can leave the last move in flight when the tab goes; pagehide fires for a close, a navigation and a
   phone switching apps, where unload does not. */
try{ window.addEventListener('pagehide', function(){ tdSaveNow(); }); }catch(_){}
function tdSaveKey(){ return TD_SAVE_KEY + (REBIRTH ? 'rebirth' : 'main'); }

/* Nothing is written until this tab owns the slot (resumed it, asked for a new game, or found it free): the page
   builds a game on opening, which would overwrite the save. */
function tdOwnSave(){ TD.saveOwned = true; }
function tdClaimSaveIfFree(){
  var s = tdSavedGame();
  TD.saveOwned = !s || !tdSavedFits(s);
}
function tdSaveNow(){
  if(!TD.board || !TD.saveOwned) return false;
  var d = tdSerialize();
  if(!d) return false;
  var save = {v:1, at:Date.now(), board:d, feed:(TD.feed || []).slice(-300),
              table:(typeof TBL !== 'undefined' && TBL.status === 'on')
                ? {room:TBL.room, name:TBL.name} : null};
  /* Quota or private mode: throwing here would lose the move that triggered it. */
  try{ localStorage.setItem(tdSaveKey(), JSON.stringify(save)); }
  catch(_){ return false; }
  tdSavedRemember(save);
  return true;
}
var _tdSaveTimer = null;
function tdSaveSoon(){
  if(_tdSaveTimer || !TD.saveOwned) return;
  _tdSaveTimer = setTimeout(function(){ _tdSaveTimer = null; tdSaveNow(); }, 700);
}

/* Held in memory, not re-read: the bar asks after every render. A write from another tab is not seen until a reload. */
var _tdSaved = undefined;          /* undefined = not looked yet, null = none */
function tdSavedRemember(s){
  _tdSaved = (s && s.board && s.board.zones) ? s : null;
}
function tdSavedGame(){
  if(_tdSaved === undefined){
    var s = null;
    try{ s = JSON.parse(localStorage.getItem(tdSaveKey()) || 'null'); }catch(_){}
    tdSavedRemember(s);
  }
  return _tdSaved;
}
function tdForgetSaved(){
  try{ localStorage.removeItem(tdSaveKey()); }catch(_){}
  tdSavedRemember(null);
}

/* A saved game goes back only on a panel of its deck type: another would carry zones nothing draws. */
function tdSavedFits(s){
  if(!s) return false;
  var g = REBIRTH ? 'rebirth' : 'main';
  return (s.board.game || g) === g && (s.board.mode || _gameMode) === _gameMode;
}
/* Ownership answers it, as an owned slot holds the game on screen. Asked every render, so it costs a flag, not a
   board hash. */
function tdSavedIsElsewhere(s){
  return !TD.saveOwned && tdSavedFits(s);
}
function tdSavedWords(s){
  if(!s) return '';
  var n = 0;
  Object.keys(s.board.zones).forEach(function(z){ n += s.board.zones[z].length; });
  var mins = Math.round((Date.now() - (s.at || 0)) / 60000);
  var when = mins < 1 ? 'a moment ago'
    : mins < 60 ? (mins + (mins === 1 ? ' minute ago' : ' minutes ago'))
    : (Math.round(mins / 60) + ' hour' + (mins < 90 ? '' : 's') + ' ago');
  return n + ' cards, ' + when + (s.table ? (', table ' + s.table.room) : '');
}

function tdResume(){
  var s = tdSavedGame();
  if(!s || !tdSavedFits(s)) return false;
  /* a spectator has no half to put it on */
  if(TD.watching) return false;
  /* Read back field by field, like anything that arrives (cat_guard.js). */
  var d = tgBoard(s.board);
  if(!d) return false;
  var seat = (typeof tblMySeat === 'function') ? tblMySeat() : '';
  var board = tdHydrate(d);
  if(!board) return false;
  TD.board = board;
  tdOwnSave();               /* it is yours again from here on */
  /* At a table you keep your seat, as in tdImportBoardText. */
  if(seat) tdAdoptSide(seat, d.side || seat);
  else tdSetSide(d.side || 'a');
  TD.feed = tgFeed(s.feed);
  /* The log restarts from the resumed position, so undo cannot step back into a history this machine does not have. */
  tdLogReset();
  tdRender();
  /* The others still see the board you had a moment ago. */
  if(seat && typeof tblSendState === 'function') tblSendState();
  if(typeof toast === 'function') toast('Game resumed — ' + tdSavedWords(s));
  return true;
}

/* The card moved is marked, and a chip points to it when it is off screen. It fades rather than flashes: the ping
   flash is one player pointing, and this happens on every action. */
var TD_MOVED_MS = 9000;
function tdMarkTheirMove(uid, name){
  if(!uid) return;
  TD.lastFoe = {uid:uid, at:Date.now(), name:name || ''};
}
function tdMovedFresh(){
  var m = TD.lastFoe;
  return (m && Date.now() - m.at < TD_MOVED_MS) ? m : null;
}
function tdMovedWhere(){
  var m = tdMovedFresh();
  if(!m) return null;
  var el = document.querySelector('.td-card' + tdSel(m.uid));
  if(!el) return null;
  var r = el.getBoundingClientRect();
  var h = window.innerHeight || document.documentElement.clientHeight;
  if(r.bottom < 40) return 'up';
  if(r.top > h - 40) return 'down';
  return 'here';
}
function tdRenderMoved(){
  var host = document.getElementById('tdBoard');
  if(!host) return;
  var old = host.querySelectorAll('.td-justmoved');
  [].forEach.call(old, function(el){ el.classList.remove('td-justmoved'); });
  var m = tdMovedFresh();
  var chip = document.getElementById('tdMovedChip');
  if(!m){ if(chip) chip.remove(); return; }
  var el = host.querySelector('.td-card' + tdSel(m.uid));
  if(el) el.classList.add('td-justmoved');
  var where = tdMovedWhere();
  if(where !== 'up' && where !== 'down'){ if(chip) chip.remove(); return; }
  if(!chip){
    chip = document.createElement('button');
    chip.id = 'tdMovedChip'; chip.className = 'td-movedchip';
    chip.onclick = tdFindLastMove;
    document.body.appendChild(chip);
  }
  chip.classList.toggle('up', where === 'up');
  chip.classList.toggle('down', where === 'down');
  chip.textContent = (where === 'up' ? '\u2191 ' : '\u2193 ')
    + (m.name ? (m.name + ' moved a card') : 'They moved a card');
}
/* Also on E with nothing under the pointer, where the board has no Essence deck (Rebirth, Encounter). */
function tdFindLastMove(){
  var m = tdMovedFresh() || TD.lastFoe;
  if(!m){ if(typeof toast === 'function') toast('They have not moved anything yet'); return false; }
  var el = document.querySelector('.td-card' + tdSel(m.uid));
  if(!el){ if(typeof toast === 'function') toast('That card is not on the table any more'); return false; }
  try{ el.scrollIntoView({block:'center', behavior:'smooth'}); }
  catch(_){ el.scrollIntoView(); }
  tdFlashCard(m.uid, el);
  return true;
}
/* A lit card is remembered by uid until its light runs out, so tdRender can put it back on the new element
   (tdReflash, HANDOFF §78). */
TD.flashing = {};
function tdFlashCard(uid, el){
  el = el || document.querySelector('.td-card' + tdSel(uid));
  TD.flashing[uid] = Date.now() + 1400;
  if(el){
    el.classList.remove('td-flash');
    void el.offsetWidth;                     /* restart the animation */
    el.classList.add('td-flash');
  }
  setTimeout(function(){
    if((TD.flashing[uid] || 0) > Date.now()) return;      /* lit again since */
    delete TD.flashing[uid];
    [].forEach.call(document.querySelectorAll('.td-card' + tdSel(uid) + '.td-flash'),
      function(x){ x.classList.remove('td-flash'); });
  }, 1400);
}
function tdReflash(){
  var now = Date.now();
  Object.keys(TD.flashing || {}).forEach(function(uid){
    if(TD.flashing[uid] <= now){ delete TD.flashing[uid]; return; }
    var el = document.querySelector('.td-card' + tdSel(uid));
    if(el) el.classList.add('td-flash');
  });
}
/* The mark ages out by itself, so one timer has the board look again just after it would expire. */
var _tdMovedTimer = null;
function tdMovedTick(){
  if(_tdMovedTimer) clearTimeout(_tdMovedTimer);
  _tdMovedTimer = setTimeout(function(){
    _tdMovedTimer = null;
    tdRenderMoved();
  }, TD_MOVED_MS + 100);
}


/* Turned face down while still in the hand, then played: moved first, the card would be named to the table on the
   way. */
function tdPlayDown(uid, zoneId){
  tdCloseMenu();
  if(!TD.board || TD.watching) return false;
  var at = tdFind(uid);
  if(!at) return false;
  if(!at.item.down) tdDo({t:'face', uid:uid, down:true, n:''});
  tdMove(uid, zoneId || 'field', {placed:false});
  tdRender();
  return true;
}

/* The name travels only face up; turning down carries nothing. */
function tdSetFace(uid, down){
  tdCloseMenu();
  if(!TD.board || TD.watching) return false;
  var at = tdFind(uid);
  if(!at) return false;
  down = !!down;
  if(!!at.item.down === down) return false;
  tdDo({t:'face', uid:uid, down:down,
        n:down ? '' : (at.item.card ? at.item.card.name : '')});
  tdRender();
  return true;
}

/* One lockZone action per zone, not one per card: one entry, one message and one undo step. */
function tdUntapStep(){
  if(!TD.board || TD.watching) return 0;
  var n = 0;
  tdDataZones().forEach(function(z){
    var locked = (TD.board.zones[z.id] || []).filter(function(i){ return i.locked; });
    if(!locked.length) return;
    n += locked.length;
    tdDo({t:'lockZone', zone:z.id, on:false});
  });
  tdRender();
  if(typeof toast === 'function')
    toast(n ? ('Unlocked ' + n + ' card' + (n === 1 ? '' : 's'))
            : 'Nothing was locked');
  return n;
}

/* The deck is shuffled as an order, as everywhere, and each card goes back by an ordinary move, so the others see
   only the counts change. */
function tdMulligan(){
  if(!TD.board || TD.watching) return false;
  var hand = (TD.board.zones.hand || []).slice();
  if(!hand.length){
    if(typeof toast === 'function') toast('Your hand is already empty');
    return false;
  }
  var n = hand.length;
  hand.forEach(function(it){ tdDo({t:'move', uid:it.uid, to:'deck'}); });
  tdShuffleZone('deck');
  /* A mulligan costs one card, down to one. */
  var take = Math.max(1, n - 1);
  tdDraw(Math.min(take, TD.board.zones.deck.length));
  tdRender();
  if(typeof toast === 'function') toast('Mulliganed to ' + take);
  return true;
}

function tdKeySheetHTML(){
  var T = window.TD_KEYS || {};
  var say = function(k){
    if(k === ' ') return 'Space';
    if(k === '1') return '1 – 9';
    return k.toUpperCase();
  };
  /* A split key gets two lines, the condition first, so the sheet itself says the card under the pointer decides. */
  var rows = Object.keys(T).map(function(k){
      var plain = T[k][1], onCard = T[k][2];
      /* 2 to 9 are described, but printed as one row against "1 - 9". */
      if(/^[2-9]$/.test(k)) return '';
      if(!plain && !onCard) return '';
      var out = '';
      if(plain){
        out += "<tr><td><kbd>" + e(say(k)) + "</kbd></td><td>"
          + e(plain) + "</td></tr>";
      }
      if(onCard){
        out += "<tr class='td-keyalt'><td>" + (plain ? '' : "<kbd>" + e(say(k)) + "</kbd>")
          + "</td><td>" + e(onCard) + "</td></tr>";
      }
      return out;
    }).filter(Boolean);
  /* Modifiers and arrows join the same list, so the grid is dealt from one set of rows. */
  rows = rows.concat([
    "<tr><td><kbd>&#8592;</kbd> <kbd>&#8594;</kbd></td>"
      + "<td>Step along your hand, card by card</td></tr>",
    "<tr><td><kbd>&#8593;</kbd> <kbd>&#8595;</kbd></td>"
      + "<td>Step up and down the pile you are pointing at</td></tr>",
    "<tr><td><kbd>Alt</kbd></td><td>Hold to read the card under the pointer</td></tr>",
    "<tr><td><kbd>Ctrl</kbd>+drag</td><td>Attach one card under another &mdash; at Declare Blockers, draw a block line from your blocker to an attacker</td></tr>",
    "<tr><td><kbd>Shift</kbd>+drag</td><td>Draw an arrow from one card to another</td></tr>",
    "<tr><td><kbd>Ctrl</kbd>+<kbd>Z</kbd></td><td>Undo</td></tr>",
    "<tr><td><kbd>Esc</kbd></td><td>Back out of whatever is open</td></tr>"
  ]);
  /* Dealt column by column, so each column reads top to bottom. */
  var per = Math.ceil(rows.length / 3), cols = [[], [], []];
  rows.forEach(function(r, i){ cols[Math.min(2, Math.floor(i / per))].push(r); });
  return "<div class='ed2-modal td-keys' role='dialog' aria-modal='true' aria-label='Keys on this page'>"
    + "<div class='ed2-modal-head wh'><b class='wh-t'>Keys on this page</b>"
      + "<span class='sg-head-gap'></span>"
      + "<button class='ed2-btn close-x nb nb-red nb-m wh-x' onclick='tdCloseKeySheet()'>"
        + "Close &#10005;</button></div>"
    /* Three tables side by side: a table cannot flow into columns, and each keeps its keys aligned with their
       descriptions. */
    + "<div class='ed2-modal-body td-keygrid'>"
    + cols.map(function(c){
        return "<table class='td-keytab'>" + c.join('') + "</table>";
      }).join('')
    + "</div></div>";
}
function tdToggleKeySheet(){
  var ov = document.getElementById('tdKeyOv');
  if(ov){ ov.remove(); return; }
  ov = document.createElement('div');
  ov.id = 'tdKeyOv'; ov.className = 'td-ov';
  ov.innerHTML = tdKeySheetHTML();
  ov.addEventListener('click', function(ev){ if(ev.target === ov) tdCloseKeySheet(); });
  document.body.appendChild(ov);
}
function tdCloseKeySheet(){
  var ov = document.getElementById('tdKeyOv');
  if(ov) ov.remove();
}

/* The position, by card name like everything here, so a machine without the set reports what is missing (the deck
   list's missing list). The last 300 record lines ride along. */
function tdSaveAs(text, name, mime){
  var blob = new Blob([text], {type:mime || 'text/plain;charset=utf-8'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click();
  setTimeout(function(){ document.body.removeChild(a); URL.revokeObjectURL(url); }, 0);
}
function tdStamp(){
  var d = new Date(), p = function(n){ return String(n).padStart(2, '0'); };
  return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate())
    + '_' + p(d.getHours()) + p(d.getMinutes());
}

/* Nothing in the app calls this; checktable.js does. */
function tdTranscript(){
  var them = (typeof TBL !== 'undefined' && TBL.peer && TBL.peer.name) || 'Opponent';
  var me = (typeof TBL !== 'undefined' && TBL.name) || 'You';
  var head = ['Conjure' + (REBIRTH ? ' Rebirth' : '') + ' — game record',
              new Date().toString()];
  if(typeof TBL !== 'undefined' && TBL.room) head.push('Table ' + TBL.room);
  var others = (typeof tblSeatNames === 'function' && typeof TBL !== 'undefined' && TBL.room)
    ? tblSeatNames() : [];
  head.push(me + (others.length ? ' vs ' + others.join(', ') : ''), '');
  var body = (TD.feed || []).map(function(f){
    var who = f.name || (f.who === 'me' ? me : f.who === 'them' ? them : '');
    return (who ? who + ': ' : '') + f.line;
  });
  return head.concat(body).join('\r\n') + '\r\n';
}

function tdExportBoard(){
  var d = tdSerialize();
  if(!d){ if(typeof toast === 'function') toast('There is no board to save'); return false; }
  tdSaveAs(JSON.stringify({v:1, at:Date.now(), board:d,
                           feed:(TD.feed || []).slice(-300)}, null, 2),
           'conjure_board_' + tdStamp() + '.json', 'application/json');
  return true;
}
/* Also takes a bare board, as pasted out of the save slot. */
function tdImportBoardText(text){
  /* a spectator has no half to put it on */
  if(TD.watching) return 'You are spectating — leave the table to load a position';
  var o = null;
  try{ o = JSON.parse(text); }catch(_){ return 'That file is not JSON'; }
  var raw = (o && o.board && o.board.zones) ? o.board : (o && o.zones ? o : null);
  /* Read field by field (cat_guard.js), as a board from the table is. */
  var d = raw ? tgBoard(raw) : null;
  if(!d) return 'That file does not hold a board';
  var g = REBIRTH ? 'rebirth' : 'main';
  if((d.game || g) !== g)
    return 'That board is from ' + (d.game === 'rebirth' ? 'Conjure Rebirth'
                                                         : 'the main game');
  if((d.mode || _gameMode) !== _gameMode)
    return 'That board is a ' + (d.mode || '?') + ' game and this panel is set to '
           + _gameMode;
  var seat = (typeof tblMySeat === 'function') ? tblMySeat() : '';
  var board = tdHydrate(d);
  if(!board) return 'That board could not be read';
  TD.board = board;
  tdOwnSave();
  /* At a table the relay's seat stands: the file's pieces are re-stamped to it, whatever side the file was saved from. */
  if(seat) tdAdoptSide(seat, d.side || seat);
  else tdSetSide(d.side || TD.side);
  if(o.feed) TD.feed = tgFeed(o.feed);
  tdLogReset();
  tdRender();
  tdSaveNow();
  /* The others are looking at a board that no longer exists. */
  if(typeof tblSendState === 'function' && typeof tblOn === 'function' && tblOn()){
    tblSendState();
    tdFeedPush('me', 'loaded a saved position');
  }
  if(board.missing.length && typeof toast === 'function')
    toast(board.missing.length + ' card name(s) in that file are not in this catalog');
  return '';
}
function tdImportBoard(){
  var inp = document.createElement('input');
  inp.type = 'file'; inp.accept = '.json,application/json';
  inp.onchange = function(){
    var f = inp.files && inp.files[0];
    if(!f) return;
    var r = new FileReader();
    r.onload = function(){
      var err = tdImportBoardText(String(r.result || ''));
      if(err && typeof toast === 'function') toast(err);
    };
    r.readAsText(f);
  };
  inp.click();
}

/* The same textareas and DECK_IDS map tdBuildBoard reads, and every section counts: a Character deck can be all
   Armament. The pool pages (Rewards, Encounter) build an empty board on purpose. */
function tdDeckHasCards(){
  if(REBIRTH && _gameMode !== 'character') return true;
  var ids = (typeof DECK_IDS !== 'undefined' && DECK_IDS) || {};
  var any = false;
  Object.keys(ids).forEach(function(k){
    if(any) return;
    /* Parsed and resolved against CARDS, as tdBuildBoard does: a list of names none of which are cards deals nothing. */
    try{
      var names = {};
      (window.CARDS || []).forEach(function(c){ names[c.name] = 1; });
      if((parseDeckIn(ids[k]) || []).some(function(en){ return names[en.name]; }))
        any = true;
    }catch(_){}
  });
  return any;
}
/* deliberate (New Game, Play Again, the online deal) replaces what was saved; tdRender's call on opening takes the save
   slot only if it is free (tdClaimSaveIfFree). */
function tdStart(deliberate){
  /* tdDo is not the only way to replace a board, so the spectator guard is here too: a spectator has no board. */
  if(TD.watching) return;
  var _dmWas = TD.board;
  TD.board = tdBuildBoard();
  /* A Rebirth table's host is its DM (tdDmBuild, cat_rbdm.js). */
  if(typeof tdDmBuild === 'function') tdDmBuild(TD.board, _dmWas);
  if(deliberate) tdOwnSave(); else tdClaimSaveIfFree();
  /* The log opens on the board as built, before the opening draw, so a replay needs only the log and the draw can be
     undone. A Rebirth Character game opens it again in tdSeedCharacter. */
  tdLogReset();
  if(REBIRTH && _gameMode === 'character' && TD.board.role !== 'dm'){
    tdSeedCharacter();
  } else if(REBIRTH){
    /* Encounter and Rewards begin with nothing on the board at all. */
  } else {
    var total = TD.board.zones.deck.length;
    if(total) tdDraw(Math.min(TD_OPENING_DRAW, total));
  }
  tdRender();
  if(TD.saveOwned) tdSaveNow();
}
function tdDrawOne(){
  if(!TD.board){ tdStart(); return; }
  if(!tdDraw(1)){ if(typeof toast === 'function') toast('The deck is empty'); return; }
  tdRender();
}
/* One card at a time, stopping with the deck: 5 with three left draws three and says the deck is done. */
function tdDrawN(n){
  if(!TD.board){ tdStart(); return; }
  n = Math.max(1, Math.min(9, parseInt(n, 10) || 1));
  var got = 0;
  while(got < n && tdDraw(1)) got++;
  tdRender();
  if(typeof toast !== 'function') return;
  if(!got) toast('The deck is empty');
  else if(got < n) toast('Drew ' + got + ' — that was the last of the deck');
  else if(n > 1) toast('Drew ' + got);
}
/* The order travels, not the instruction: "shuffle" alone would come out differently on every machine. */
function tdShuffleZone(zoneId){
  if(!TD.board || !TD.board.zones[zoneId]) return;
  var order = tdShuffle(TD.board.zones[zoneId].slice())
    .map(function(i){ return i.uid; });
  tdDo({t:'order', zone:zoneId, order:order});
}
function tdShuffleDeck(){
  if(!TD.board) return;
  tdShuffleZone('deck');
  tdRender();
  if(typeof toast === 'function') toast('Deck shuffled');
}


function tdZoneById(id){
  var z = tdDataZones().filter(function(x){ return x.id === id; })[0];
  return z || null;
}
function tdFind(uid){
  var zones = TD.board.zones;
  for(var k in zones){
    if(!zones.hasOwnProperty(k)) continue;
    for(var i = 0; i < zones[k].length; i++)
      if(zones[k][i].uid === uid) return {zone:k, index:i, item:zones[k][i]};
  }
  return null;
}

/* Every move by choice comes through here. opts: index (stacked zone), x/y (percent, free zone), placed (a person
   dropped it; tdReflowFree leaves it), top, bottom (the Main Deck only). */
function tdMove(uid, toId, opts){
  opts = opts || {};
  var at = tdFind(uid);
  if(!at) return false;
  toId = tdHandAreaZone(at.item, toId);
  /* A Rebirth DM's card stays the DM's, however it was sent (tdDmZoneFor). */
  if(REBIRTH && at.item.dm){
    var dmTo = tdDmZoneFor(toId);
    if(!dmTo){
      if(tdZoneById(toId) && typeof toast === 'function') toast(tdRefusedWords(at.item, toId));
      return false;
    }
    toId = dmTo;
  }
  var to = tdZoneById(toId);
  if(!to) return false;
  var target = TD.board.zones[toId];

  if((to.kind === 'one' || to.kind === 'lord') && target.length && at.zone !== toId){
    if(typeof toast === 'function') toast(to.label + ' already holds a card');
    return false;
  }

  /* A copy that leaves its zone stops existing, so the act becomes a vanish, decided here so the log does not read
     "move". Moving a copy within its zone is not leaving it. */
  if(at.zone !== toId && tdIsCopy(uid)){
    var gone = !!tdDo({t:'vanish', uid:uid});
    if(gone && typeof toast === 'function')
      toast('The copy left the ' + tdZoneWords(at.zone) + ' and is gone');
    return gone;
  }

  /* This decides where the card ends up and TD_ACT.move carries it out, so a replay lands in the same place; the one
     random choice (sliding into the deck) is rolled here. */
  var a = {t:'move', uid:uid, to:toId};

  if(to.kind === 'free'){
    /* opts.placed: a person dropped it there, and tdReflowFree tidies only cards nobody placed. */
    a.x = (opts.x != null) ? opts.x : 4;
    a.y = (opts.y != null) ? opts.y : 4;
    a.auto = opts.placed ? false : true;
    /* A card arriving on a Rebirth table's shared Field is given its spot now (tdRbSpot), so the spot is in the board,
       the same on every screen. */
    if(toId === 'field' && at.zone !== 'field' && opts.x == null
       && typeof tdRbOn === 'function' && tdRbOn()){
      var rbAt = tdRbSpot(uid);
      a.x = rbAt.x; a.y = rbAt.y; a.auto = false;
    }
  } else if(toId === 'deck' && !opts.top && !opts.bottom){
    /* A card returned to the deck is shuffled in, the place rolled here and recorded, never rolled again on replay. */
    var n = target.length + (at.zone === toId ? 0 : 1);
    a.at = Math.floor(Math.random() * n);
  } else if(toId === 'deck' && opts.bottom){
    a.at = 0;                                     /* bottom = start of array */
  } else if(toId === 'dmdeck'){
    /* Into one of the DM's decks (tdDmBackTo), shuffled in, the place rolled here as the Main Deck's is. */
    var dk = (typeof tdDmBackTo === 'function') ? tdDmBackTo(at.item, opts.dk) : '';
    if(!dk){
      if(typeof toast === 'function') toast('Bring in a DM deck first (DM Tools)');
      return false;
    }
    a.dk = dk;
    a.at = Math.floor(Math.random() * (target.length + (at.zone === toId ? 0 : 1)));
  } else if(opts.index != null){
    a.at = opts.index;
  }
  return !!tdDo(a);
}


/* Pointer Events with capture, not HTML5 drag and drop: its ghost cannot be styled and it does not work by touch. */
var _tdDrag = null;

/* The point is the card's top-left corner, and so is the result; cardW/cardH keep the far edge inside the zone. */
function tdPctIn(el, clientX, clientY, cardW, cardH){
  /* On the map, through its zoom (cat_rbgrid.js). */
  if(typeof tdGfPctIn === 'function'){
    var gp = tdGfPctIn(el, clientX, clientY, cardW, cardH);
    if(gp) return gp;
  }
  var r = el.getBoundingClientRect();
  if(!r.width || !r.height) return {x:4, y:4};
  var maxX = cardW ? Math.max(0, (1 - cardW / r.width) * 100) : 94;
  var maxY = cardH ? Math.max(0, (1 - cardH / r.height) * 100) : 88;
  return {x: Math.max(0, Math.min(maxX, ((clientX - r.left) / r.width) * 100)),
          y: Math.max(0, Math.min(maxY, ((clientY - r.top) / r.height) * 100))};
}

/* The index to insert before. */
function tdDropIndex(body, clientY, draggedUid){
  var cards = Array.prototype.filter.call(body.querySelectorAll('.td-card'),
    function(el){ return el.dataset.uid !== draggedUid; });
  for(var i = 0; i < cards.length; i++){
    var r = cards[i].getBoundingClientRect();
    if(clientY < r.top + r.height / 2) return i;
  }
  return cards.length;
}

/* The lean is eased and capped, and only the ghost turns: a locked card already carries a quarter turn, which the
   ghost takes as its starting angle. */
var TD_WOBBLE_MAX = 24.75;     /* degrees */
/* The ease, the hold and the spring-back set how long the lean lasts together: change one alone and it ends on the
   old schedule. */
var TD_WOBBLE_EASE = 0.11;     /* 0..1, how fast the lean catches up */
var TD_WOBBLE_HOLD = 180;      /* ms of stillness before it springs back */
var TD_WOBBLE_BACK = 440;      /* ms the spring itself takes */
function tdWobble(d, ev){
  if(!d || !(d.ghost || d.el)) return;
  if(d.lastX == null){ d.lastX = ev.clientX; d.lean = 0; }
  var vx = ev.clientX - d.lastX;
  d.lastX = ev.clientX;
  /* The per-pixel response goes up with the cap, or an ordinary drag never nears the cap and leans as little as before. */
  var want = Math.max(-TD_WOBBLE_MAX, Math.min(TD_WOBBLE_MAX, vx * 2.03));
  d.lean = d.lean + (want - d.lean) * TD_WOBBLE_EASE;
  var base = d.locked ? 90 : 0;
  /* A counter drags its real element, placed by left/top, so its lean has nothing to compose with: it rests at zero. */
  var el = d.ghost || d.el;
  el.style.transform = 'rotate(' + (base + d.lean).toFixed(2) + 'deg)';
  /* No events arrive once the pointer stops, so a timer eases the lean back. */
  clearTimeout(d.settle);
  d.settle = setTimeout(function(){
    var back = d.ghost || d.el;
    if(!back || !back.parentNode) return;
    d.lean = 0;
    back.style.transition = 'transform ' + (TD_WOBBLE_BACK / 1000)
      + 's cubic-bezier(.34,1.56,.64,1)';
    back.style.transform = 'rotate(' + base + 'deg)';
  }, TD_WOBBLE_HOLD);
}

function tdBindDrag(){
  var board = document.getElementById('tdBoard');
  if(!board || board._tdBound) return;
  board._tdBound = true;

  board.addEventListener('pointerdown', function(ev){
    if(ev.button !== 0) return;                    /* right-click is the menu */
    if(!TD.board) return;
    /* The Resolve button under an Action or Spell must not pick the card up. */
    if(ev.target.closest && ev.target.closest('.td-resolve')) return;
    /* Nothing on another player's half moves, checked first so no gesture can start there; Alt-zoom is bound apart and
       is not gated. */
    if(tdSideOfEl(ev.target) === 'foe'){
      /* Except a card on a Rebirth table's shared Field, moved by asking its owner (cat_rbtable.js). */
      if(typeof tdRbPointerDown === 'function' && tdRbPointerDown(ev, board)) return;
      if(_tdConnectFrom) tdCancelConnect();
      if(document.getElementById('tdCrystal')) tdCloseCrystal();
    else if(_tdTokConnectFrom) tdCancelTokenConnect();
      return;
    }

    /* The picks come before the drag, so they are not read as one. */
    if(_tdTokConnectFrom){
      var tpick = ev.target.closest && ev.target.closest('.td-card');
      ev.preventDefault();
      if(tpick) tdTokenConnectTo(tpick.dataset.uid); else tdCancelTokenConnect();
      return;
    }

    if(_tdConnectFrom){
      var pick = ev.target.closest && ev.target.closest('.td-card');
      ev.preventDefault();
      if(pick) tdConnectTo(pick.dataset.uid); else tdCancelConnect();
      return;
    }

    /* Ctrl+drag attaches one card under another, checked before the drag and before Shift (Ctrl+Shift draws an arrow).
       Each gesture captures the pointer, or one let go off the board stays live; endDrag finds its target by elementFromPoint. */
    if((ev.ctrlKey || ev.metaKey) && !ev.shiftKey){
      /* A counter first: it lies on top of its card, so .td-card would match the card underneath. */
      var ctok = ev.target.closest && ev.target.closest('.td-token');
      if(ctok && ctok.dataset.tok){
        ev.preventDefault();
        _tdTokConnectFrom = ctok.dataset.tok;
        _tdConnectDrag = 'token';
        board.classList.add('td-connecting');
        try{ board.setPointerCapture(ev.pointerId); }catch(_){}
        return;
      }
      var ccard = ev.target.closest && ev.target.closest('.td-card');
      /* At Declare Blockers Ctrl+drag draws a block line from your Field Character to the attacker; in every other phase
         it is Connect. */
      if(ccard && !ccard.closest('.td-half-foe') && ccard.dataset.zone === 'field'
         && tdDeclarePhase() === 'block'){
        var bat = tdFind(ccard.dataset.uid);
        if(bat && tdIsCharacterCard(bat.item.card) && !bat.item.anon){
          ev.preventDefault();
          _tdBlockFrom = ccard.dataset.uid;
          board.classList.add('td-blocking');
          tdBlockLive(ev);
          try{ board.setPointerCapture(ev.pointerId); }catch(_){}
          return;
        }
      }
      if(ccard && !ccard.closest('.td-half-foe')){
        ev.preventDefault();
        _tdConnectFrom = ccard.dataset.uid;
        _tdConnectDrag = 'card';
        board.classList.add('td-connecting');
        try{ board.setPointerCapture(ev.pointerId); }catch(_){}
        return;
      }
    }
    /* Shift+drag draws an arrow, at a table only (tblArrowAdd), checked before the drag; it starts on your half and may
       end on any card. */
    if(ev.shiftKey && typeof tblOn === 'function' && tblOn()){
      var acard = ev.target.closest && ev.target.closest('.td-card');
      if(acard){
        ev.preventDefault();
        _tdArrowFrom = acard.dataset.uid;
        board.classList.add('td-arrowing');
        try{ board.setPointerCapture(ev.pointerId); }catch(_){}
        return;
      }
    }

    var tok = ev.target.closest && ev.target.closest('.td-token');
    var tat = tok ? tdTokenFind(tok.dataset.tok) : null;
    if(tok && !tat) return;
    /* A counter on a card is part of it: pressing one picks up the card, as a drag that detached it would lose it.
       Disconnect takes it off. */
    if(tat && !tat.token.on){
      ev.preventDefault();
      var tr = tok.getBoundingClientRect();
      _tdDrag = {token:tat.token, el:tok,
                 dx:ev.clientX - tr.left, dy:ev.clientY - tr.top,
                 w:tr.width, h:tr.height, moved:false,
                 /* Where it was picked up, restored before endDrag does the drop as an action. */
                 sx:tat.token.x, sy:tat.token.y};
      tok.classList.add('td-tok-drag');
      try{ tok.setPointerCapture(ev.pointerId); }catch(_){}
      return;
    }

    var card = ev.target.closest && ev.target.closest('.td-card');
    if(!card) return;
    var uid = card.dataset.uid;
    var at = tdFind(uid);
    if(!at) return;
    ev.preventDefault();

    var r = card.getBoundingClientRect();
    /* The layout size, not the rect: a locked card's rect is its rotated box. The rect's centre still places the ghost. */
    var w = card.offsetWidth || r.width, h = card.offsetHeight || r.height;
    var cx = r.left + r.width / 2, cy = r.top + r.height / 2;
    var gx = cx - w / 2, gy = cy - h / 2;
    _tdDrag = {uid:uid, from:at.zone, el:card,
               dx:ev.clientX - gx, dy:ev.clientY - gy,
               w:w, h:h, moved:false,
               /* the ghost's resting angle, so the wobble leans away from a
                  locked card's quarter turn instead of cancelling it */
               locked:!!at.item.locked, lastX:null, lean:0, settle:null};

    /* pointer-events:none on the ghost lets elementFromPoint see the zone under it. */
    var ghost = card.cloneNode(true);
    ghost.className = 'td-card td-ghost' + (at.item.locked ? ' locked' : '');
    ghost.style.width = w + 'px';
    ghost.style.height = h + 'px';
    ghost.style.left = gx + 'px';
    ghost.style.top = gy + 'px';
    document.body.appendChild(ghost);
    _tdDrag.ghost = ghost;
    card.classList.add('td-dragging');
    try{ card.setPointerCapture(ev.pointerId); }catch(_){}
  });

  board.addEventListener('pointermove', function(ev){
    if(_tdBlockFrom){ tdBlockLive(ev); return; }
    if(!_tdDrag) return;
    _tdDrag.moved = true;
    if(_tdDrag.token){
      /* In percent of the half's .td-tokens layer, not the board, or a counter jumps when another half is on screen
         (HANDOFF §76.6). The drop restores the start and moves it as an action (endDrag). */
      var lay = (_tdDrag.el.closest && _tdDrag.el.closest('.td-tokens')) || board;
      var br = lay.getBoundingClientRect();
      var px = ((ev.clientX - _tdDrag.dx - br.left) / br.width) * 100;
      var py = ((ev.clientY - _tdDrag.dy - br.top) / br.height) * 100;
      _tdDrag.token.x = Math.max(0, Math.min(97, px));
      _tdDrag.token.y = Math.max(0, Math.min(96, py));
      _tdDrag.el.style.left = _tdDrag.token.x + '%';
      _tdDrag.el.style.top  = _tdDrag.token.y + '%';
      tdWobble(_tdDrag, ev);
      return;
    }
    _tdDrag.ghost.style.left = (ev.clientX - _tdDrag.dx) + 'px';
    _tdDrag.ghost.style.top  = (ev.clientY - _tdDrag.dy) + 'px';
    tdWobble(_tdDrag, ev);
    var over = document.elementFromPoint(ev.clientX, ev.clientY);
    var zoneEl = over && over.closest && over.closest('.td-zone');
    var prev = board.querySelector('.td-zone.td-over');
    if(prev && prev !== zoneEl) prev.classList.remove('td-over');
    if(zoneEl) zoneEl.classList.add('td-over');
  });

  function endDrag(ev){
    if(_tdConnectDrag){
      var what = _tdConnectDrag;
      _tdConnectDrag = false;
      board.classList.remove('td-connecting');
      var over = document.elementFromPoint(ev.clientX, ev.clientY);
      var onto = over && over.closest && over.closest('.td-card');
      /* Abandoned, not left waiting for a second click as the menu's Connect is. */
      if(what === 'token'){
        if(onto && onto.dataset.uid) tdTokenConnectTo(onto.dataset.uid);
        else tdCancelTokenConnect();
      } else if(onto && onto.dataset.uid && onto.dataset.uid !== _tdConnectFrom){
        tdConnectTo(onto.dataset.uid);
      } else tdCancelConnect();
      return;
    }
    if(_tdBlockFrom){
      var from = _tdBlockFrom; _tdBlockFrom = null;
      board.classList.remove('td-blocking');
      tdBlockLive(null);
      var bover = document.elementFromPoint(ev.clientX, ev.clientY);
      var bhit = bover && bover.closest && bover.closest('.td-card');
      if(bhit && bhit.dataset.uid !== from) tdBlockOnto(from, bhit.dataset.uid);
      return;
    }
    if(_tdArrowFrom){
      var over = document.elementFromPoint(ev.clientX, ev.clientY);
      var hit = over && over.closest && over.closest('.td-card');
      board.classList.remove('td-arrowing');
      if(hit && hit.dataset.uid !== _tdArrowFrom && typeof tblArrowAdd === 'function')
        tblArrowAdd(_tdArrowFrom, hit.dataset.uid);
      _tdArrowFrom = null;
      return;
    }
    if(!_tdDrag) return;
    var d = _tdDrag; _tdDrag = null;
    clearTimeout(d.settle);                        /* the wobble's settle timer */
    if(d.token){
      d.el.classList.remove('td-tok-drag');
      /* Put straight on drop: the lean is on the real element, so a counter dropped mid-flick would stay tilted. */
      d.el.style.transition = '';
      d.el.style.transform = '';
      /* The drop is an action: back to the start, then tdDo, so it is logged, undoable, sent and saved. slide: moved
         across the board, not off a card, so no record line. */
      var nx = Math.round(tdNum(d.token.x) * 100) / 100, ny = Math.round(tdNum(d.token.y) * 100) / 100;
      d.token.x = d.sx; d.token.y = d.sy;
      if(d.moved && (nx !== d.sx || ny !== d.sy))
        tdDo({t:'tokMove', uid:d.token.uid, x:nx, y:ny, slide:true});
      return;
    }
    if(d.ghost && d.ghost.parentNode) d.ghost.parentNode.removeChild(d.ghost);
    d.el.classList.remove('td-dragging');
    var over = board.querySelector('.td-zone.td-over');
    if(over) over.classList.remove('td-over');
    if(!d.moved){                                  /* a click, not a drag */
      if(d.from === 'dmdeck' && typeof tdDmPileClick === 'function') tdDmPileClick();
      return;
    }
    /* Another player's card on the shared Field (cat_rbtable.js). */
    if(d.foe){ tdRbFoeDrop(d, ev); return; }

    var el = document.elementFromPoint(ev.clientX, ev.clientY);
    /* A Rebirth DM's card given to a player, or let go on the DM Tools (cat_rbdm.js). */
    if(typeof tdDmBoardDrop === 'function' && tdDmBoardDrop(d, el)) return;
    var zoneEl = el && el.closest && el.closest('.td-zone');
    if(!zoneEl){ tdRender(); return; }             /* dropped outside: put it back */
    var toId = zoneEl.dataset.zone;
    toId = tdHandAreaZone((tdFind(d.uid) || {}).item, toId);
    if(toId !== zoneEl.dataset.zone){
      var inArea = zoneEl.parentNode && zoneEl.parentNode.querySelector
        && zoneEl.parentNode.querySelector('.td-zone' + tdSel(toId, 'data-zone'));
      if(inArea) zoneEl = inArea;
    }
    /* The menu's rule (tdCanGo): a destination it will not offer, a drag must not reach. */
    if(!tdCanGo((tdFind(d.uid) || {}).item, toId, d.from)){
      if(typeof toast === 'function')
        toast(tdRefusedWords((tdFind(d.uid) || {}).item, toId));
      tdRender();
      return;
    }
    var to = tdZoneById(toId);
    var body = zoneEl.querySelector('.td-zbody');
    var opts = {};
    /* Into the deck the DM Deck is showing. */
    if(toId === 'dmdeck' && typeof tdDmCurId === 'function') opts.dk = tdDmCurId();
    if(to && to.kind === 'free'){
      /* The ghost's top-left, not its centre (tdPctIn). */
      var p = tdPctIn(body, ev.clientX - d.dx, ev.clientY - d.dy, d.w, d.h);
      opts.x = Math.round(p.x * 100) / 100; opts.y = Math.round(p.y * 100) / 100;
      opts.placed = true;
    } else if(to && (to.kind === 'stack')){
      opts.index = tdDropIndex(body, ev.clientY, d.uid);
    }
    tdMove(d.uid, toId, opts);
    tdRender();
  }
  board.addEventListener('pointerup', endDrag);
  board.addEventListener('pointercancel', endDrag);
  board.addEventListener('pointermove', function(ev){
    if(typeof tblPointerMove === 'function') tblPointerMove(ev);
  });
  board.addEventListener('pointerleave', function(){
    if(typeof tblPointerOff === 'function') tblPointerOff();
  });
}


var _tdMenuUid = null;

function tdCloseMenu(){
  var m = document.getElementById('tdMenu');
  if(m) m.remove();
  _tdMenuUid = null;
}

function tdMenuItems(item, zoneId){
  var rows = [], uid = item.uid, wasDown = !!item.down;
  /* Essence area and Core Essences only: "Lock each Arch" covers every Core of that type there (tdIsCoreEssence). */
  var ctype = (zoneId === 'essarea') ? tdCoreEssenceType(item.card) : '';
  if(ctype){
    var mates = tdCoresOfType(ctype);
    var nFreeT = mates.filter(function(m){ return !m.locked; }).length;
    var lockThem = !item.locked;
    var nDo = lockThem ? nFreeT : (mates.length - nFreeT);
    if(nDo > 0)
      rows.push({label:(lockThem ? 'Lock each ' : 'Unlock each ') + ctype,
                 act:function(){ tdLockCoreType(ctype, lockThem); },
                 hint:nDo + ' Available'});
  }

  /* Only on a Field Character in the phase that declares it; Rebirth's one Battle phase has neither. */
  var dph = tdDeclarePhase();
  if(zoneId === 'field' && dph && tdIsCharacterCard(item.card) && !item.anon){
    if(dph === 'attack'){
      /* A Thaumaturge card chooses its attack; whichever it is declared as, the other is offered. */
      if(tdIsAttackDecl(item.decl))
        rows.push({label:'Remove Attacker', act:function(){ tdDeclare(uid, ''); }});
      if(item.decl !== 'atk')
        rows.push({label:'Declare Attacker', act:function(){ tdDeclare(uid, 'atk'); }});
      /* Only a card that always has Thaumaturge (its keyword line or a counter), not one that gains it in a sentence. */
      if(item.decl !== 'thm' && (typeof tdCardHasKw === 'function' ? tdCardHasKw(item, 'Thaumaturge', TD.board)
                                                                  : tdHasKeyword(item.card, 'Thaumaturge')))
        rows.push({label:'Declare Thaumaturge Attacker', act:function(){ tdDeclare(uid, 'thm'); }});
    }
    else
      rows.push(item.decl === 'blk'
        ? {label:'Remove Blocker', act:function(){ tdDeclare(uid, ''); }}
        : {label:'Declare Blocker', act:function(){ tdDeclare(uid, 'blk'); },
           hint:'Ctrl+drag to an attacker'});
  }
  /* Lock is the game's word for a quarter turn; offered only on the Field and the Essence Area (TD_LOCK_ZONES). */
  if(TD_LOCK_ZONES[zoneId]){
    rows.push(item.locked
      ? {label:'Unlock', act:function(){ tdSetLock(uid, false); }}
      : {label:'Lock',   act:function(){ tdSetLock(uid, true); }});
  }
  /* Hand only: everywhere else the card is already shown. */
  if(zoneId === 'hand'){
    rows.push(item.shown
      ? {label:'Stop revealing it', act:function(){ tdRevealCard(uid, false); }}
      : {label:'Play with card revealed', act:function(){ tdRevealCard(uid, true); }});
  }
  if(TD_CONNECT_ZONES[zoneId]){
    if(item.connectedTo)
      rows.push({label:'Disconnect', act:function(){ tdDisconnect(uid); }});
    else
      rows.push({label:'Connect', act:function(){ tdBeginConnect(uid); }});
  }
  /* One row per linked card, in rule-text order: a submenu would hide a single press behind a hover. */
  var links = tdCardLinks(item.card);
  if(links.length){
    links.forEach(function(lc, i){
      /* Only if this board has that zone: Encounter is its own board, and the row would land nowhere. */
      var zid = tdCopyZoneFor(lc);
      if(!TD.board || !TD.board.zones[zid]) return;
      rows.push({label:'Create ' + lc.name,
                 act:function(){ tdCreateCopyAt(uid, i); }});
    });
  }

  if(rows.length) rows.push({sep:true});

  if(typeof tblOn === 'function' && tblOn())
    rows.push({label:'Point at this', act:function(){ tblPing(uid); }});
  if(typeof tdGfLabelRow === 'function'){
    var glr = tdGfLabelRow(item, zoneId);
    if(glr) rows.push.apply(rows, glr);
  }
  /* A new piece with its own uid, not a second reference, or moving one would move both. */
  rows.push({label:'Duplicate', act:function(){ tdDuplicate(uid); }});
  /* Only where face down means anything: a card in hand is unreadable to them already, and a pile is not shown. */
  var faceZone = tdZoneById(zoneId);
  var hiddenAnyway = (typeof tblHiddenZone === 'function') && tblHiddenZone(zoneId);
  if(faceZone && faceZone.kind !== 'pile' && !hiddenAnyway)
    rows.push({label:item.down ? 'Turn face up' : 'Turn face down',
               act:function(){ tdSetFace(uid, !wasDown); }});
  /* From a hidden zone the row plays it face down; tdPlayDown says why it is one row and not two moves. */
  /* Not for an Essence: it goes to the Essence deck or area and nowhere else. */
  else if(hiddenAnyway && TD.board.zones.field && !tdIsEssenceCard(item.card))
    rows.push({label:'Play face down', act:function(){ tdPlayDown(uid); }});
  rows.push({sep:true});

  /* Only where the card can go: tdCanGo is the one rule. */
  if(tdCanGo(item, 'hand', zoneId))
    rows.push({label:'Send to Hand',  act:function(){ tdMenuMove(uid, 'hand'); }});
  if(tdCanGo(item, 'grave', zoneId))
    rows.push({label:'Send to Grave', act:function(){ tdMenuMove(uid, 'grave'); }});
  if(tdZoneById('essarea') && zoneId !== 'essarea' && tdCanGo(item, 'essarea', zoneId))
    rows.push({label:'Send to Essence', act:function(){ tdMenuMove(uid, 'essarea'); }});
  /* Main game only: where the Suspended zone or the Essence deck is missing (Rebirth), this is the plain move. */
  if(tdZoneById('susp') && tdCanGo(item, 'susp', zoneId)){
    if(!REBIRTH && TD.board.zones.essdeck && TD.board.zones.essarea)
      rows.push({label:'Core Crystallize',
                 act:function(ev){ tdCoreCrystalMenu(uid, ev); }});
    else
      rows.push({label:'Crystallize', act:function(){ tdMenuMove(uid, 'susp'); }});
  }
  rows.push({sep:true});
  rows.push({label:'Move to', sub:true});
  /* No Search on a card's menu: searching belongs to the pile's own menu (tdPileMenuItems). */
  rows.push({sep:true});
  if(tdCanGo(item, 'deck', zoneId)){
    rows.push({label:'Top Deck',    act:function(){ tdMenuMove(uid, 'deck', {top:true}); }});
    rows.push({label:'Bottom Deck', act:function(){ tdMenuMove(uid, 'deck', {bottom:true}); }});
  }
  /* Top only, on purpose: there is no Bottom of Essence Deck row. */
  if(tdZoneById('essdeck') && zoneId !== 'essdeck' && tdCanGo(item, 'essdeck', zoneId)){
    rows.push({label:'Top of Essence Deck',
               act:function(){ tdMenuMove(uid, 'essdeck', {top:true}); }});
  }
  /* A Rebirth DM's card: its own rows first (tdDmMenuRows), with no gaps where the rows it is not offered would be. */
  var dmRows = (typeof tdDmMenuRows === 'function') ? tdDmMenuRows(item, zoneId) : [];
  if(dmRows.length){
    var tidy = [];
    dmRows.concat(rows).forEach(function(r){
      if(r.sep && (!tidy.length || tidy[tidy.length - 1].sep)) return;
      tidy.push(r);
    });
    while(tidy.length && tidy[tidy.length - 1].sep) tidy.pop();
    rows = tidy;
  }
  return rows;
}

/* Search and Look at top are the only ways into a pile, so they lead, after Draw and Draw X on the Main Deck. */
function tdPileMenuItems(zoneId){
  if(zoneId === 'dmdeck' && typeof tdDmPileRows === 'function') return tdDmPileRows();
  var z = tdZoneById(zoneId) || {label:'Deck'};
  var draws = (zoneId === 'deck')
    ? [{label:'Draw', act:function(){ tdMenuDraw(1); }}, {drawn:true, zone:zoneId}, {sep:true}] : [];
  var rows = draws.concat([
    {label:'Search ' + z.label, act:function(){ tdOpenSearch(zoneId); }},
    /* Its own row type, as it carries a field; the number is read when the row is pressed, not watched. */
    {peek:true, zone:zoneId},
    {label:'Shuffle',           act:function(){ tdShufflePile(zoneId); }}
  ]);
  /* A standing state, not a peek: the top card stays face up for everyone, and the next is shown when it is drawn, as
     the render reads the top every time. */
  var revealed = tdZShow(zoneId) === 'top';
  rows.push({sep:true});
  rows.push(revealed
    ? {label:'Stop revealing the top card', act:function(){ tdSetZShow(zoneId, ''); }}
    : {label:'Play with top card revealed', act:function(){ tdSetZShow(zoneId, 'top'); }});
  return rows;
}
/* Cards off the top the Search window shows, 0 for all; rendered with _tdSearchZone (tdOpenSearch). */
var _tdSearchTop = 0;
var _tdPeeking = false;
/* The uids looked at, and only them: "the top N" of the pile as it is now would pull in a card you were never shown. */
var _tdSearchUids = null;
window.tdMenuDraw = function(raw){
  tdCloseMenu();
  if(!TD.board || TD.watching) return;
  var n = parseInt(String(raw).trim(), 10);
  if(!isFinite(n) || n < 1){
    if(typeof toast === 'function') toast('Type how many cards to draw');
    return;
  }
  var got = 0;
  while(got < n && tdDraw(1)) got++;
  tdRender();
  if(typeof toast !== 'function') return;
  if(!got) toast('The deck is empty');
  else if(got < n) toast('Drew ' + got + ' — that was the last of the deck');
  else if(n > 1) toast('Drew ' + got);
};
window.tdPeekTop = function(zoneId, raw){
  var n = parseInt(String(raw).trim(), 10);
  if(!isFinite(n) || n < 1){
    if(typeof toast === 'function') toast('Type how many cards to look at');
    return;
  }
  _tdSearchTop = n;
  _tdPeeking = true;
  var pile = (TD.board && TD.board.zones[zoneId]) || [];
  _tdSearchUids = pile.slice(Math.max(0, pile.length - n)).map(function(it){ return it.uid; });
  tdOpenSearch(zoneId);
};
window.tdPeekKey = function(ev, zoneId){
  if(!ev || ev.key !== 'Enter') return;
  ev.preventDefault();
  tdPeekTop(zoneId, ev.target.value);
};

/* A colour with no core left in the Essence deck is offered but greyed: hidden, a two-colour card would show one swatch
   and no reason. The core is moved out of the Essence deck, never made. */
function tdCrystalColors(item){
  var names = [];
  try{
    if(typeof manaCostColorNames === 'function')
      names = manaCostColorNames(item.card && item.card.manaCost) || [];
  }catch(_){}
  /* An Essence or a colourless card has no cost colour: its own colours, as the catalogue's colour column shows. */
  if(!names.length && item.card && item.card.colors)
    names = item.card.colors.slice();
  var seen = {}, out = [];
  names.forEach(function(n){
    var k = String(n);
    k = k.charAt(0).toUpperCase() + k.slice(1).toLowerCase();
    if(TD_COLOR_NAMES.indexOf(k) >= 0 && !seen[k]){ seen[k] = true; out.push(k); }
  });
  return out.sort(function(a, b){
    return TD_COLOR_NAMES.indexOf(a) - TD_COLOR_NAMES.indexOf(b);
  });
}
/* Returns the item, not the card: that copy is the one moved. */
function tdEssenceInDeck(colorName){
  var want = String(colorName).toLowerCase();
  var deck = (TD.board && TD.board.zones.essdeck) || [];
  for(var i = 0; i < deck.length; i++){
    var c = deck[i].card;
    if(!c) continue;
    if(tdEssenceColors(c).indexOf(want) >= 0) return deck[i];
  }
  return null;
}
window.tdCoreCrystalMenu = function(uid, ev){
  if(ev){ try{ ev.stopPropagation(); }catch(_){} }
  var at = tdFind(uid);
  tdCloseMenu();
  if(!at || !TD.board) return;
  var cols = tdCrystalColors(at.item);
  if(!cols.length){
    if(typeof toast === 'function')
      toast('This card has no colour to crystallize into');
    return;
  }
  var old = document.getElementById('tdCrystal');
  if(old) old.remove();
  var box = document.createElement('div');
  box.id = 'tdCrystal'; box.className = 'td-menu td-crystal';
  box.setAttribute('role', 'menu');
  box.setAttribute('aria-label', 'Crystallize into');
  box.innerHTML = "<div class='td-mtitle'>Crystallize into</div>"
    + cols.map(function(n){
        var have = !!tdEssenceInDeck(n);
        return "<button class='td-crystal-b" + (have ? '' : ' out') + "' role='menuitem'"
          + " style='--tok-fill:" + tdColorFill(n) + ";--tok-ink:" + tdColorInk(n) + "'"
          + (have ? '' : ' disabled')
          + " data-col='" + e(n) + "'"
          + " title='" + e(have ? ('Suspend this and take a ' + n + ' core')
                                 : ('No ' + n + ' core left in your Essence deck')) + "'>"
          + tdColorMana(n) + "<span class='td-colname'>" + e(n) + "</span></button>";
      }).join('');
  document.body.appendChild(box);
  /* data-col and a bound handler, not an inline onclick: the pattern wherever a value could be user text (HANDOFF §24.2). */
  box.querySelectorAll('[data-col]').forEach(function(b){
    b.addEventListener('click', function(){ tdCoreCrystal(uid, b.dataset.col); });
  });
  var x = (ev && ev.clientX) || 40, y = (ev && ev.clientY) || 40;
  var r = box.getBoundingClientRect();
  box.style.left = Math.max(4, Math.min(x, window.innerWidth  - r.width  - 6)) + 'px';
  box.style.top  = Math.max(4, Math.min(y, window.innerHeight - r.height - 6)) + 'px';
};
function tdCloseCrystal(){
  var el = document.getElementById('tdCrystal');
  if(el) el.remove();
}
window.tdCoreCrystal = function(uid, colorName){
  tdCloseCrystal();
  if(!TD.board) return;
  var at = tdFind(uid);
  var ess = tdEssenceInDeck(colorName);
  /* Checked again: the board can change between drawing the palette and the press (an Undo, the other player). */
  if(!at || !ess){
    if(typeof toast === 'function') toast('No ' + colorName + ' core left');
    return;
  }
  var at2 = tdEssenceSpawnAt();
  tdDo({t:'crystal', uid:uid, essUid:ess.uid, color:colorName,
        /* The Essence area is a free zone, so the core needs a spot to land on. */
        ex:at2.x, ey:at2.y});
  tdRender();
  if(typeof toast === 'function')
    toast('Crystallized — ' + colorName + ' core to the Essence area');
};
/* A press outside closes it, as it does the card menu; Escape is in tdBindMenu's handler. */
(function(){
  if(document._tdCrystalBound) return;
  document._tdCrystalBound = true;
  document.addEventListener('pointerdown', function(ev){
    if(!document.getElementById('tdCrystal')) return;
    if(ev.target.closest && ev.target.closest('#tdCrystal')) return;
    tdCloseCrystal();
  }, true);
})();


/* Not a modal picker, which would hide the cards being chosen between; Ctrl+drag is the other way in (tdBindDrag). */
var _tdConnectFrom = null;
var _tdArrowFrom = null;
var _tdBlockFrom = null;
function tdBlockLive(ev){
  var lay = tdArrowLayer(), host = document.getElementById('tdBoard');
  if(!lay || !host) return;
  var live = lay.querySelector('.td-block-live');
  if(!ev || !_tdBlockFrom){ if(live) live.remove(); return; }
  var br = host.getBoundingClientRect(), f = tdBlockAnchor(_tdBlockFrom, br);
  if(!f) return;
  if(!live){ live = document.createElementNS('http://www.w3.org/2000/svg', 'line');
    live.setAttribute('class', 'td-blockline td-block-live'); lay.appendChild(live); }
  live.setAttribute('x1', f.x); live.setAttribute('y1', f.y);
  live.setAttribute('x2', ev.clientX - br.left); live.setAttribute('y2', ev.clientY - br.top);
}
function tdBlockOnto(from, target){
  var halves = [TD.board].concat(tdFoeList()), hit = null;
  for(var i = 0; i < halves.length && !hit; i++){
    var at = halves[i] && tdFindIn(halves[i], target);
    if(at && at.zone === 'field') hit = at.item;
  }
  if(!hit || !tdIsAttackDecl(hit.decl)){
    if(typeof toast === 'function') toast('Drop it on a declared attacker');
    return;
  }
  tdDo({t:'block', uid:from, target:target});
  tdRender();
}
var _tdConnectDrag = false;
function tdBeginConnect(uid){
  tdCloseMenu();
  _tdConnectFrom = uid;
  var board = document.getElementById('tdBoard');
  if(board) board.classList.add('td-connecting');
  if(typeof toast === 'function')
    toast('Pick the card to attach it under — Escape to cancel');
}
function tdCancelConnect(){
  _tdConnectFrom = null;
  var board = document.getElementById('tdBoard');
  if(board) board.classList.remove('td-connecting');
}
function tdConnectTo(targetUid){
  var from = _tdConnectFrom;
  tdCancelConnect();
  if(!from || from === targetUid) return;
  var a = tdFind(from), b = tdFind(targetUid);
  if(!a || !b) return;
  if(a.zone !== 'field' || b.zone !== 'field'){
    if(typeof toast === 'function') toast('Both cards have to be on the Field');
    return;
  }
  /* A card cannot go under one already under it: a pair connected both ways would render each other forever. */
  var items = TD.board.zones.field;
  if(tdDescendants(items, from).some(function(k){ return k.uid === targetUid; })){
    if(typeof toast === 'function') toast('That card is already attached under this one');
    return;
  }
  tdDo({t:'connect', uid:from, to:targetUid});
  tdRender();
}
function tdDisconnect(uid){
  tdCloseMenu();
  var at = tdFind(uid);
  if(!at || !at.item.connectedTo) return;
  var parent = tdFind(at.item.connectedTo);
  /* The spot is worked out here, so the action carries a number, not a rule. */
  tdDo({t:'connect', uid:uid});
  tdDo({t:'move', uid:uid, to:at.zone,
        x:Math.min(92, ((parent && parent.item.x) || 4) + 8),
        y:Math.min(88, ((parent && parent.item.y) || 4) + 6), auto:false});
  tdRender();
}
/* The action carries the whole pile's order, as the window may show only a slice, and goes through tdDo so it is logged,
   undoable and sent to the table. */
function tdBindSearchReorder(host){
  if(!host || host._tdReorder) return;
  host._tdReorder = true;
  var from = null;
  host.addEventListener('pointerdown', function(ev){
    /* Not on the nudge buttons: capturing the pointer would swallow their click. */
    if(ev.target.closest && ev.target.closest('.td-snudge')) return;
    var card = ev.target.closest && ev.target.closest('.td-scard');
    if(!card || !card.dataset.uid) return;
    from = card;
    card.classList.add('td-sdrag');
    try{ card.setPointerCapture(ev.pointerId); }catch(_){}
  });
  host.addEventListener('pointermove', function(ev){
    if(!from) return;
    var over = document.elementFromPoint(ev.clientX, ev.clientY);
    var onto = over && over.closest && over.closest('.td-scard');
    [].forEach.call(host.querySelectorAll('.td-sover'), function(el){
      el.classList.remove('td-sover');
    });
    if(onto && onto !== from) onto.classList.add('td-sover');
  });
  function drop(ev){
    if(!from) return;
    var card = from; from = null;
    card.classList.remove('td-sdrag');
    var over = document.elementFromPoint(ev.clientX, ev.clientY);
    var onto = over && over.closest && over.closest('.td-scard');
    [].forEach.call(host.querySelectorAll('.td-sover'), function(el){
      el.classList.remove('td-sover');
    });
    if(!onto || onto === card || !onto.dataset.uid) return;
    tdReorderPile(_tdSearchZone, card.dataset.uid, onto.dataset.uid);
  }
  host.addEventListener('pointerup', drop);
  host.addEventListener('pointercancel', function(){
    if(from) from.classList.remove('td-sdrag');
    from = null;
  });
}
window.tdNudgePile = function(uid, toUid){
  tdReorderPile(_tdSearchZone, uid, toUid);
};
/* beforeUid is in the window's order, which is the array reversed. */
function tdReorderPile(zoneId, uid, beforeUid){
  if(!TD.board) return;
  var z = TD.board.zones[zoneId];
  if(!z || uid === beforeUid) return;
  var view = z.slice().reverse().map(function(i){ return i.uid; });
  var a = view.indexOf(uid), b = view.indexOf(beforeUid);
  if(a < 0 || b < 0) return;
  view.splice(a, 1);
  view.splice(view.indexOf(beforeUid) + (a < b ? 1 : 0), 0, uid);
  tdDo({t:'order', zone:zoneId, order:view.slice().reverse()});
  tdRender();
  if(document.getElementById('tdSearchOv')) tdRenderSearch();
}
function tdShufflePile(zoneId){
  tdCloseMenu();
  /* The DM Deck shuffles only the deck the DM Tools are on. */
  if(zoneId === 'dmdeck' && typeof tdDmShuffle === 'function'){ tdDmShuffle(); return; }
  if(!TD.board || !TD.board.zones[zoneId]) return;
  tdShuffleZone(zoneId);
  tdRender();
  if(typeof toast === 'function')
    toast((tdZoneById(zoneId) || {label:'Deck'}).label + ' shuffled');
}

/* A row's act is a function the menu's one listener calls, so no uid, zone or name goes into an inline handler
   (HANDOFF §24.2). A string act is only for static zone ids (cat_table.js's reveal menus). */
function tdShowMenu(title, rows, subs, x, y){
  var subRows = Array.isArray(subs) ? subs : null;
  /* r.name is what a screen reader says for a row labelled with a bare number ("+10"). */
  function rowHTML(r, attr, i){
    var act = (typeof r.act === 'string') ? " onclick=\"" + e(r.act) + "\"" : '';
    return "<button type='button' class='td-mi' role='menuitem' " + attr + "='" + i + "'" + act
      + (r.name ? " aria-label='" + e(r.name) + "'" : '') + ">" + e(r.label)
      + (r.hint ? "<span class='td-mhint'>" + e(r.hint) + "</span>" : '') + "</button>";
  }
  var html = rows.map(function(r, i){
    if(r.sep) return "<div class='td-msep' role='separator'></div>";
    if(r.sub) return "<div class='td-msub'><button type='button' class='td-mi' role='menuitem' aria-haspopup='true'>" + e(r.label)
      + " <span class='td-marrow' aria-hidden='true'>&#9656;</span></button>"
      + "<div class='td-mflyout' role='group' aria-label='" + e(r.label) + "'>"
      + (subRows ? subRows.map(function(s, j){ return rowHTML(s, 'data-ms', j); }).join('') : '')
      + "</div></div>";
    /* Inside #tdMenu, which the close-on-outside handler ignores, so the field keeps the focus. */
    /* Two lines, or the whole menu is as wide as "Look at the top N cards of the Main Deck". */
    if(r.peek) return "<div class='td-mpeek'>"
      + "<button type='button' class='td-mi td-mi-peek' data-mi='" + i + "'>Look at top</button>"
      + "<input type='number' class='td-mpeek-in' id='tdPeekN' min='1' step='1'"
        + " value='3' aria-label='How many cards' data-mi='" + i + "'>"
      + "</div>";
    if(r.drawn) return "<div class='td-mpeek'>"
      + "<button type='button' class='td-mi td-mi-peek' data-mi='" + i + "'>Draw</button>"
      + "<input type='number' class='td-mpeek-in' id='tdDrawN' min='1' step='1'"
        + " value='2' aria-label='How many cards to draw' data-mi='" + i + "'>"
      + "</div>";
    /* r.form: [{label, type 'number' or 'text', value, min, max, ph}]; r.act gets the values in order (tdMenuFormVals). */
    if(r.form) return "<div class='td-mfield td-mform'>"
      + r.form.map(function(f, j){
          var num = (f.type === 'number');
          return "<label class='td-mform-l'><span>" + e(f.label) + "</span>"
            + "<input class='td-mfield-in td-mform-in' data-mi='" + i + "' data-mj='" + j + "'"
            + (num ? " type='number' step='1'"
                     + (f.min != null ? " min='" + e(String(f.min)) + "'" : '')
                     + (f.max != null ? " max='" + e(String(f.max)) + "'" : '')
                   : " type='text' autocomplete='off' spellcheck='false'")
            + (f.ph ? " placeholder='" + e(f.ph) + "'" : '')
            + " value='" + e(String(f.value == null ? '' : f.value)) + "'"
            + " aria-label='" + e(f.label) + "'></label>";
        }).join('')
      + "<button type='button' class='td-mfield-b' data-mi='" + i + "'>" + e(r.btn || 'Set') + "</button></div>";
    if(r.field) return "<div class='td-mfield'>"
      + "<input type='number' class='td-mfield-in' id='tdMField'"
      + " value='" + e(String(r.value)) + "' step='1' data-mi='" + i + "'"
      + " aria-label='Set this counter'>"
      + "<button type='button' class='td-mfield-b' data-mi='" + i + "'>Set</button></div>";
    return rowHTML(r, 'data-mi', i);
  }).join('');
  var m = document.createElement('div');
  m.id = 'tdMenu'; m.className = 'td-menu';
  m.setAttribute('role', 'menu');
  m.setAttribute('aria-label', String(title || 'Menu'));
  m.innerHTML = "<div class='td-mtitle'>" + e(title) + "</div>" + html;
  var rowOf = function(el){
    var i = el && el.getAttribute && el.getAttribute('data-mi');
    if(i != null) return rows[+i] || null;
    var s = el && el.getAttribute && el.getAttribute('data-ms');
    return (s != null && subRows) ? (subRows[+s] || null) : null;
  };
  m.addEventListener('click', function(ev){
    var b = ev.target && ev.target.closest && ev.target.closest('button');
    if(!b || !m.contains(b)) return;
    var r = rowOf(b);
    if(!r) return;
    if(r.peek){ tdPeekTop(r.zone, (m.querySelector('#tdPeekN') || {}).value); return; }
    if(r.drawn){ tdMenuDraw((m.querySelector('#tdDrawN') || {}).value); return; }
    if(r.field){ tdTokenSet(r.uid, (m.querySelector('#tdMField') || {}).value); return; }
    if(r.form){ r.act(tdMenuFormVals(m, b.getAttribute('data-mi'))); return; }
    if(typeof r.act === 'function') r.act(ev);
  });
  m.addEventListener('keydown', function(ev){
    var t = ev.target;
    if(!t || t.tagName !== 'INPUT') return;
    var r = rowOf(t);
    if(!r) return;
    if(r.peek) tdPeekKey(ev, r.zone);
    else if(r.field) tdTokenSetKey(ev, r.uid);
    else if(r.drawn && ev.key === 'Enter'){ ev.preventDefault(); tdMenuDraw(t.value); }
    else if(r.form && ev.key === 'Enter'){ ev.preventDefault(); r.act(tdMenuFormVals(m, t.getAttribute('data-mi'))); }
  });
  document.body.appendChild(m);
  var r = m.getBoundingClientRect();
  m.style.left = Math.max(4, Math.min(x, window.innerWidth  - r.width  - 6)) + 'px';
  m.style.top  = Math.max(4, Math.min(y, window.innerHeight - r.height - 6)) + 'px';
}

function tdMenuFormVals(m, i){
  var out = [];
  [].forEach.call(m.querySelectorAll('input' + tdSel(String(i), 'data-mi')), function(inp){
    out[+inp.getAttribute('data-mj') || 0] = inp.value;
  });
  return out;
}

function tdOpenMenu(uid, x, y){
  tdCloseMenu();
  var at = tdFind(uid);
  if(!at) return;
  _tdMenuUid = uid;
  var subs = tdZones().filter(function(z){
      return z.id !== at.zone && tdCanGo(at.item, z.id, at.zone);
    })
    .map(function(z){
      return {label:z.label, act:function(){ tdMenuMove(uid, z.id); }};
    });
  tdShowMenu(at.item.card.name, tdMenuItems(at.item, at.zone), subs, x, y);
}

function tdOpenPileMenu(zoneId, x, y){
  tdCloseMenu();
  var z = tdZoneById(zoneId);
  if(!z) return;
  tdShowMenu(z.label, tdPileMenuItems(zoneId), '', x, y);
}

function tdOpenTokenMenu(uid, x, y){
  tdCloseMenu();
  var at = tdTokenFind(uid);
  if(!at) return;
  var t = at.token, rows = [], tu = t.uid;
  /* Each counter moves by its own sign: +10 on a -1 counter would undo what it is for. */
  if(t.kind === 'plus'){
    rows.push({label:'+1',  name:'+1 to this counter',  act:function(){ tdTokenAdj(tu, 1); }});
    rows.push({label:'+10', name:'+10 to this counter', act:function(){ tdTokenAdj(tu, 10); }});
    rows.push({label:'− 1', name:'− 1 from this counter, to correct it', act:function(){ tdTokenAdj(tu, -1); },
               hint:'correct it'});
    rows.push({sep:true});
  } else if(t.kind === 'minus'){
    rows.push({label:'−1',  name:'−1 to this counter',  act:function(){ tdTokenAdj(tu, -1); }});
    rows.push({label:'−10', name:'−10 to this counter', act:function(){ tdTokenAdj(tu, -10); }});
    rows.push({label:'+1', name:'+1 back on this counter, to correct it', act:function(){ tdTokenAdj(tu, 1); }, hint:'correct it'});
    rows.push({sep:true});
  }
  if(t.kind === 'plus' || t.kind === 'minus'){
    rows.push({field:true, uid:t.uid, value:t.value});
    rows.push({sep:true});
  }
  if(t.on)
    rows.push({label:'Disconnect', act:function(){ tdTokenDisconnect(tu); }});
  else
    rows.push({label:'Connect', act:function(){ tdBeginTokenConnect(tu); }});
  rows.push({label:'Duplicate', act:function(){ tdTokenDup(tu); }});
  rows.push({label:'Delete',    act:function(){ tdTokenDel(tu); }});
  tdShowMenu(tdTokenTitle(t), rows, '', x, y);
  /* Its title can be a bare number ("+1"), so the menu is named as that counter. */
  var tm = document.getElementById('tdMenu');
  if(tm) tm.setAttribute('aria-label', tdTokenTitle(t) + ' counter');
}

/* An attached counter is drawn inside its card and moves with it; TD_ACT.move drops a card's counters when it leaves
   its zone. */
var _tdTokConnectFrom = null;
function tdBeginTokenConnect(uid){
  tdCloseMenu();
  _tdTokConnectFrom = uid;
  var board = document.getElementById('tdBoard');
  if(board) board.classList.add('td-connecting');
  if(typeof toast === 'function')
    toast('Pick the card to put this counter on — Escape to cancel');
}
function tdCancelTokenConnect(){
  _tdTokConnectFrom = null;
  var board = document.getElementById('tdBoard');
  if(board) board.classList.remove('td-connecting');
}
function tdTokenConnectTo(cardUid){
  var uid = _tdTokConnectFrom;
  tdCancelTokenConnect();
  if(!uid) return;
  var at = tdTokenFind(uid);
  /* Onto another player's card on a Rebirth Field: asked of its owner (cat_rbtable.js). */
  if(at && !tdFind(cardUid) && typeof tdRbTokenOnto === 'function'
     && tdRbTokenOnto(at.token, cardUid)) return;
  if(!at || !tdFind(cardUid)) return;
  tdDo({t:'tokMove', uid:uid, on:cardUid});
  tdRender();
}
function tdTokenDisconnect(uid){
  tdCloseMenu();
  var at = tdTokenFind(uid);
  if(!at || !at.token.on) return;
  /* Measured against your half's counter layer, in percent (as tdBindDrag places it), not the whole board. */
  var el = document.querySelector('.td-half-mine .td-token' + tdSel(uid, 'data-tok'))
        || document.querySelector('.td-token' + tdSel(uid, 'data-tok'));
  var mineHalf = el && el.closest ? el.closest('.td-half-mine') : null;
  var board = (mineHalf && mineHalf.querySelector(':scope > .td-tokens'))
           || document.getElementById('tdTokens') || document.getElementById('tdBoard');
  var p = null;
  if(el && board){
    var r = el.getBoundingClientRect(), br = board.getBoundingClientRect();
    if(br.width && br.height)
      p = {x:((r.left - br.left) / br.width) * 100,
           y:((r.top  - br.top)  / br.height) * 100};
  }
  /* Resolved here and sent as a number: the other machine has no element to measure. */
  tdDo({t:'tokMove', uid:uid,
        x:p ? Math.max(0, Math.min(97, p.x)) : 4,
        y:p ? Math.max(0, Math.min(96, p.y)) : 4});
  tdRender();
}
function tdDeclarePhase(){
  if(!tdTurnOn()) return '';
  var t = tdTurnOf(TD.board);
  if(t.step !== 'battle') return '';
  var ph = tdStepDef('battle').phases[t.phase];
  return (ph && (ph.id === 'attack' || ph.id === 'block')) ? ph.id : '';
}
/* Only a fallback for when cat_boardfx.js (tdCardHasKw) is not loaded; looser, as it reads the whole rules text. */
function tdHasKeyword(c, w){
  return !!c && new RegExp('(^|[^A-Za-z])' + w + '([^A-Za-z]|$)').test(c.ruleText || '');
}
function tdIsCharacterCard(c){
  return !!c && (c.superTypes || []).some(function(s){ return String(s).toLowerCase() === 'character'; });
}
window.tdDeclare = function(uid, role){
  tdCloseMenu();
  var at = tdFind(uid);
  if(!at || at.zone !== 'field') return;
  tdDo({t:'declare', uid:uid, role:role || ''});
  tdRender();
};
function tdSetLock(uid, on){
  var at = tdFind(uid);
  tdCloseMenu();
  if(!at) return;
  /* Unlock is deliberately not a toggle: on a card that is not locked it does
     nothing at all. */
  if(on) tdDo({t:'lock', uid:uid, on:true});
  else if(at.item.locked) tdDo({t:'lock', uid:uid, on:false});
  tdRender();
}
/* Not a toggle either: it never locks anything. */
function tdUnlockZone(zoneId){
  if(!TD.board) return;
  var items = TD.board.zones[zoneId];
  if(!items || !items.length) return;
  var n = items.filter(function(it){ return it.locked; }).length;
  if(n){ tdDo({t:'lockZone', zone:zoneId, on:false}); tdRender(); }
  if(typeof toast === 'function')
    toast(n ? ('Unlocked ' + n + ' card' + (n === 1 ? '' : 's')) : 'Nothing locked here');
}
/* type is one of _ESSENCE_COLOR_MAP's keys (tdCoreEssenceType), never free text, as it goes into an inline handler
   (HANDOFF §24.2). */
window.tdLockCoreType = function(type, on){
  tdCloseMenu();
  if(!TD.board) return;
  var mates = tdCoresOfType(type);
  var n = mates.filter(function(m){ return !!m.locked !== !!on; }).length;
  if(!n){
    if(typeof toast === 'function')
      toast('Every ' + type + ' is already ' + (on ? 'locked' : 'unlocked'));
    return;
  }
  tdDo({t:'lockType', ctype:String(type), on:!!on});
  tdRender();
  if(typeof toast === 'function')
    toast((on ? 'Locked ' : 'Unlocked ') + n + ' ' + type
          + (n === 1 ? '' : 's'));
};
/* A part-locked zone is topped up, not refused: lockZone sets them all on. */
function tdLockZone(zoneId){
  if(!TD.board) return;
  var items = TD.board.zones[zoneId];
  if(!items || !items.length){
    if(typeof toast === 'function') toast('Nothing here to lock');
    return;
  }
  var n = items.filter(function(it){ return !it.locked; }).length;
  if(!n){
    if(typeof toast === 'function') toast('Everything here is already locked');
    return;
  }
  tdDo({t:'lockZone', zone:zoneId, on:true});
  tdRender();
  if(typeof toast === 'function')
    toast('Locked ' + n + ' card' + (n === 1 ? '' : 's'));
}

function tdDuplicate(uid){
  tdCloseMenu();
  var at = tdFind(uid);
  if(!at) return;
  var z = tdZoneById(at.zone);
  /* The uid is minted HERE and travels with the action, so the copy carries
     the same id on every machine at the table. */
  var a = {t:'spawn', uid:tdUid('td'), n:at.item.card.name,
           zone:at.zone, at:at.index + 1};
  if(at.item.dm) a.dm = true;
  if(z && z.kind === 'free'){
    var bx = (at.item.x == null ? 4 : at.item.x);
    var by = (at.item.y == null ? 4 : at.item.y);
    a.x = Math.min(96, bx + 3); a.y = Math.min(92, by + 3);
  }
  tdDo(a);
  tdRender();
  if(document.getElementById('tdSearchOv')) tdRenderSearch();
}

function tdMenuMove(uid, toId, opts){
  tdCloseMenu();
  if(tdMove(uid, toId, opts || {})) tdRender();
  if(document.getElementById('tdSearchOv')) tdRenderSearch();
}


/* Closing does not shuffle: the deck stays in the order it is left in, and a shuffle is its own press. */
var _tdSearchZone = 'deck';
function tdOpenSearch(zoneId){
  tdCloseMenu();
  if(!TD.board) return;
  /* Remembered, as tdRenderSearch runs again after every move made in the window. */
  if(zoneId && TD.board.zones[zoneId]) _tdSearchZone = zoneId;
  /* tdPeekTop sets the slice just before calling this, so only other calls reset it. */
  if(!_tdPeeking){ _tdSearchTop = 0; _tdSearchUids = null; }
  _tdPeeking = false;
  var ov = document.getElementById('tdSearchOv');
  if(!ov){
    ov = document.createElement('div');
    /* Not .ed2-overlay: the editor's arrow-key navigation (ed2_tools.js) stops while any element with it exists, even
       hidden. This window unmounts on close. */
    ov.id = 'tdSearchOv'; ov.className = 'td-ov';
    document.body.appendChild(ov);
    ov.addEventListener('click', function(ev){ if(ev.target === ov) tdCloseSearch(); });
  }
  /* The DM Deck is searched one deck at a time (tdDmSearch). */
  var z = (_tdSearchZone === 'dmdeck' && typeof tdDmSearchLabel === 'function')
    ? {label:tdDmSearchLabel()} : (tdZoneById(_tdSearchZone) || {label:'Deck'});
  ov.innerHTML = "<div class='ed2-modal ed2-modal-wide td-search' role='dialog' aria-modal='true'"
    + " aria-label='" + e('Search: ' + z.label) + "'>"
    + "<div class='ed2-modal-head wh'><b class='wh-t'>" + e(z.label)
      + (_tdSearchTop > 0 ? (' — top ' + _tdSearchTop) : '') + "</b>"
    + "<span class='td-search-note'>Closing keeps this order. Shuffle is a separate press.</span>"
    + "<span class='sg-head-gap'></span>"
    + "<button class='ed2-btn' onclick='tdShufflePile(_tdSearchZone)' aria-label='Shuffle'>" + uiIco('shuffle') + " Shuffle</button>"
    + "<button class='ed2-btn close-x nb nb-red nb-m wh-x' onclick='tdCloseSearch()'>Close &#10005;</button></div>"
    + "<div class='ed2-modal-body td-search-body' id='tdSearchBody'></div></div>";
  tdRenderSearch();
}
function tdCloseSearch(){
  _tdSearchTop = 0;
  _tdSearchUids = null;
  var ov = document.getElementById('tdSearchOv');
  if(ov) ov.remove();   /* unmount, never hide - see the note in tdOpenSearch */
  tdCloseMenu();
  tdRender();
}
function tdRenderSearch(){
  var host = document.getElementById('tdSearchBody');
  if(!host || !TD.board) return;
  var deck = TD.board.zones[_tdSearchZone] || [];
  if(!deck.length){ host.innerHTML = "<i class='tpl-hint'>This pile is empty.</i>"; return; }
  /* The top of the deck is the end of the array. */
  var shown = deck.slice().reverse();
  if(_tdSearchUids){
    var keep = {};
    _tdSearchUids.forEach(function(u){ keep[u] = 1; });
    shown = shown.filter(function(it){ return keep[it.uid]; });
    if(!shown.length){ host.innerHTML = "<i class='tpl-hint'>Every card you looked at has gone.</i>"; return; }
  } else if(_tdSearchTop > 0) shown = shown.slice(0, _tdSearchTop);
  host.innerHTML = "<div class='td-search-grid'>"
    + shown.map(function(it, i){
        var prev = i > 0 ? shown[i - 1].uid : '', next = i < shown.length - 1 ? shown[i + 1].uid : '';
        /* The two pieces a nudge swaps ride on the button as data, for tdBindMenu's click listener. */
        return "<div class='td-scard' data-uid='" + e(it.uid) + "' title='" + e(it.card.name) + "'>"
          + "<div class='td-face' data-card='" + e(it.card.name) + "'></div>"
          + "<span class='td-spos'>" + (i === 0 ? 'top' : i + 1) + "</span>"
          + "<span class='td-snudge'>"
            + "<button type='button' class='td-snb' " + (prev ? "data-nudge='" + e(it.uid) + "' data-nudge-to='" + e(prev) + "'" : 'disabled')
              + " title='One place nearer the top' aria-label='Move up one place'>&#9664;</button>"
            + "<button type='button' class='td-snb' " + (next ? "data-nudge='" + e(it.uid) + "' data-nudge-to='" + e(next) + "'" : 'disabled')
              + " title='One place further down' aria-label='Move down one place'>&#9654;</button>"
          + "</span>"
          + "</div>";
      }).join('')
    + (_tdSearchTop > 0 && deck.length > shown.length
        ? "<div class='td-srest'>" + (deck.length - shown.length)
          + " more below</div>" : '')
    + "</div>";
  tdLazyFaces(host);
  tdBindSearchReorder(host);
}


function tdBindMenu(){
  if(document._tdMenuBound) return;
  document._tdMenuBound = true;
  document.addEventListener('contextmenu', function(ev){
    /* Before the board check: a spectator has no board and can focus too. */
    var chip = ev.target.closest && ev.target.closest('.tbl-chip[data-seat]');
    if(chip){
      ev.preventDefault();
      tdOpenChipMenu(chip.getAttribute('data-seat'), ev.clientX, ev.clientY);
      return;
    }
    if(!TD.board) return;
    if(typeof tdGfMenu === 'function' && tdGfMenu(ev)) return;
    /* No menu on another player's half: every row acts. */
    if(tdSideOfEl(ev.target) === 'foe'){
      /* Except a card on a Rebirth table's shared Field (cat_rbtable.js). */
      if(typeof tdRbFoeMenu === 'function' && tdRbFoeMenu(ev)) return;
      tdCloseMenu(); return;
    }
    var tok = ev.target.closest && ev.target.closest('.td-token');
    if(tok){ ev.preventDefault(); tdOpenTokenMenu(tok.dataset.tok, ev.clientX, ev.clientY); return; }
    var lord = ev.target.closest && ev.target.closest('.td-lord');
    if(lord){ ev.preventDefault(); tdOpenMenu(lord.dataset.uid, ev.clientX, ev.clientY); return; }
    /* Before the card: a pile's face-down card matches .td-card, and a right-click anywhere on a pile opens the pile's menu. */
    var pile = ev.target.closest && ev.target.closest('.td-zone.td-pile');
    if(pile){ ev.preventDefault(); tdOpenPileMenu(pile.dataset.zone, ev.clientX, ev.clientY); return; }
    var card = ev.target.closest && ev.target.closest('.td-card, .td-scard');
    if(card){ ev.preventDefault(); tdOpenMenu(card.dataset.uid, ev.clientX, ev.clientY); return; }
  });
  document.addEventListener('pointerdown', function(ev){
    if(!document.getElementById('tdMenu')) return;
    if(ev.target.closest && ev.target.closest('#tdMenu')) return;
    tdCloseMenu();
  });
  /* Buttons that name a seat, a zone or a piece carry it as data, read here, so another player's name is never part of a
     script (HANDOFF §24.2). */
  document.addEventListener('click', function(ev){
    var t = ev.target && ev.target.closest ? ev.target : null;
    if(!t) return;
    var col = t.closest('.td-zcol[data-col-zone]');
    if(col){
      tdToggleCollapse(col.getAttribute('data-col-side') || '', col.getAttribute('data-col-zone') || '');
      return;
    }
    var fb = t.closest('.td-fbbtn[data-expand]');
    if(fb){ tdExpandFoe(fb.getAttribute('data-expand') || ''); return; }
    var nb = t.closest('.td-snb[data-nudge]');
    if(nb && !nb.disabled) tdNudgePile(nb.getAttribute('data-nudge') || '', nb.getAttribute('data-nudge-to') || '');
  });
  /* One guard for every shortcut: a bare letter typed in the chat, a counter's value or a search must do nothing.
     Modifier combinations are left to the browser. */
  function tdKeysLive(ev){
    if(!TD.board) return false;
    if(ev.ctrlKey || ev.metaKey || ev.altKey) return false;
    var t = ev.target;
    /* A select takes every key and a button Space and Enter; letters still reach the board, as a pressed button keeps the
       focus. */
    if(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT'
             || t.isContentEditable)) return false;
    if(t && t.tagName === 'BUTTON' && (ev.key === ' ' || ev.key === 'Enter')) return false;
    var pane = document.getElementById('pane-testdeck');
    if(pane && pane.offsetParent === null) return false;
    return true;
  }
  /* The card under the pointer (elementFromPoint: a card can move out from under a still pointer), on your half only.
     tdBindAlt's mousemove keeps the coordinates live. */
  function tdHoverCard(){
    var el = document.elementFromPoint(_tdAlt.x, _tdAlt.y);
    var card = el && el.closest && el.closest('.td-card, .td-scard');
    if(!card) return null;
    if(card.closest('.td-half-foe')) return null;
    var uid = card.dataset && card.dataset.uid;
    if(!uid) return null;
    var at = tdFind(uid);
    if(!at) return null;
    return {uid:uid, el:card, zone:at.zone, item:at.item,
            inSearch: !!card.closest('#tdSearchOv')};
  }
  function tdEssenceSearchOpen(){
    return !!document.getElementById('tdSearchOv') && _tdSearchZone === 'essdeck';
  }

  /* D, E and S act on the card under the pointer, or on the game when there is none; Q only on a card. The help sheet
     and checkboard's list are generated from this table. */
  function tdKeyOnCard(act){
    var h = tdHoverCard();
    if(!h) return false;
    act(h);
    return true;
  }
  var TD_KEYS = {
    d: [function(){
          if(tdKeyOnCard(function(h){ tdMove(h.uid, 'grave'); tdRender(); })) return;
          tdDrawOne();
        }, 'Draw a card', 'over a card: send it to the Grave'],
    s: [function(){
          if(tdKeyOnCard(function(h){ tdMove(h.uid, 'susp'); tdRender(); })) return;
          tdShuffleDeck();
        }, 'Shuffle your deck', 'over a card: send it to Suspended'],
    q: [function(){
          tdKeyOnCard(function(h){
            /* Only in the zones the Lock button is offered in. */
            if(!TD_LOCK_ZONES[h.zone] || h.item.locked) return;
            tdSetLock(h.uid, true);
          });
        }, null, 'over an unlocked card: lock it'],
    e: [function(){
          if(tdEssenceSearchOpen()
             && tdKeyOnCard(function(h){
                  if(!h.inSearch) return;
                  tdMove(h.uid, 'essarea');
                  tdRenderSearch(); tdRender();
                })) return;
          if(tdKeyOnCard(function(h){
               if(!TD_LOCK_ZONES[h.zone] || !h.item.locked) return;
               tdSetLock(h.uid, false);
             })) return;
          /* A board with no Essence pile (Rebirth, Encounter) falls back to what E always did. */
          if(TD.board.zones.essdeck) tdOpenSearch('essdeck');
          else tdFindLastMove();
        }, 'Search your Essence deck', 'over a locked card: unlock it'],
    /* held down, each repeat steps back at once and the board is drawn once
       a frame (tdRenderSoon) */
    u: [function(ev){ tdUndo(!!(ev && ev.repeat)); }, 'Undo'],
    m: [function(){ tdMulligan(); },     'Mulligan — take a new opening hand'],
    n: [function(){ tdUntapStep(); },    'New turn'],
    /* At a table Space is the top row's Pass (the turn); alone it is the tracker's Pass on the live phase. */
    ' ': [function(){
          if(typeof tblOn === 'function' && tblOn()){
            if(typeof tblPass === 'function' && !TBL.watch) tblPass();
            return;
          }
          if(typeof window.tdPassPhase === 'function') window.tdPassPhase();
        }, 'Pass — the phase you are on; at a table, the turn'],
    '?': [function(){ tdToggleKeySheet(); }, 'This list']
  };
  for(var _n = 1; _n <= 9; _n++){
    /* All nine carry the description, which the help sheet prints once: a key with none reads as undocumented to the
       sheet and the checks. */
    TD_KEYS[String(_n)] = (function(n){
      return [function(){ tdDrawN(n); }, 'Draw that many — 1 to 9'];
    })(_n);
  }
  /* Capture phase, and stopped: the catalog binds bare letters and digits on document too (D, L and B switch tabs,
     1 to 3 the Browse view). Only the keys this page claims are stopped. */
  document.addEventListener('keydown', function(ev){
    var k = ev.key;
    if(k && k.length === 1) k = k.toLowerCase();
    var hit = TD_KEYS[k];
    if(!hit || !tdKeysLive(ev)) return;
    ev.preventDefault();
    ev.stopPropagation();
    hit[0](ev);
  }, true);
  window.TD_KEYS = TD_KEYS;
  window.tdHoverCard = tdHoverCard;

  /* The arrows walk a pile from the card pointed at. It is only a way of looking: it changes no order, logs nothing
     and takes no undo step. */
  var TD_STEP_AXIS = {hand:'x'};        /* everything else walks in y */
  var _tdStep = null;

  /* Read off the DOM, not the array: each zone draws its pile in its own order, and the walk goes the way it is drawn. */
  function tdStepZoneCards(zone){
    var host = document.getElementById('tdBoard');
    if(!host) return [];
    var sel = '.td-half-mine .td-zone' + tdSel(zone, 'data-zone') + ' .td-card[data-uid]';
    var els = host.querySelectorAll(sel);
    if(!els.length) els = host.querySelectorAll(
      '.td-zone' + tdSel(zone, 'data-zone') + ' .td-card[data-uid]');
    return [].map.call(els, function(el){ return {uid:el.dataset.uid, el:el}; });
  }
  function tdStepShow(zone, uid){
    _tdStep = {zone:zone, uid:uid};
    var host = document.getElementById('tdBoard');
    if(!host) return;
    [].forEach.call(host.querySelectorAll('.td-stepped'), function(el){
      el.classList.remove('td-stepped');
    });
    var el = host.querySelector('.td-half-mine .td-card' + tdSel(uid))
          || host.querySelector('.td-card' + tdSel(uid));
    if(!el) return;
    el.classList.add('td-stepped');
    /* Placed against the card, not the pointer, which is not on it. */
    tdAltShow(el);
    var r = el.getBoundingClientRect();
    _tdAlt.x = Math.round(r.right);
    _tdAlt.y = Math.round(r.top + r.height / 2);
    tdAltPlace();
  }
  function tdStepClear(){
    _tdStep = null;
    var host = document.getElementById('tdBoard');
    if(host) [].forEach.call(host.querySelectorAll('.td-stepped'), function(el){
      el.classList.remove('td-stepped');
    });
    tdAltHide();
  }
  window.tdStepClear = tdStepClear;
  function tdStep(axis, dir){
    /* While a walk runs the pointer has not moved, so reading it would step from the same card every time; a mouse move
       clears _tdStep. */
    var h = _tdStep ? null : tdHoverCard();
    var zone = _tdStep ? _tdStep.zone : (h && h.zone);
    var from = _tdStep ? _tdStep.uid  : (h && h.uid);
    if(!zone || !from) return false;
    if((TD_STEP_AXIS[zone] || 'y') !== axis) return false;
    var list = tdStepZoneCards(zone);
    var i = -1;
    for(var n = 0; n < list.length; n++) if(list[n].uid === from){ i = n; break; }
    if(i < 0) return false;
    var j = i + dir;
    if(j < 0 || j >= list.length) return false;
    tdStepShow(zone, list[j].uid);
    return true;
  }
  document.addEventListener('keydown', function(ev){
    var axis = (ev.key === 'ArrowLeft' || ev.key === 'ArrowRight') ? 'x'
             : (ev.key === 'ArrowUp'   || ev.key === 'ArrowDown')  ? 'y' : null;
    if(!axis || !tdKeysLive(ev)) return;
    var dir = (ev.key === 'ArrowRight' || ev.key === 'ArrowDown') ? 1 : -1;
    /* Stopped only when it walked: the catalog pages Browse with the left and right arrows. */
    if(tdStep(axis, dir)){ ev.preventDefault(); ev.stopPropagation(); }
  }, true);
  /* Moving the mouse ends the walk: a card left raised would look selected. */
  document.addEventListener('mousemove', function(){ if(_tdStep) tdStepClear(); });

  /* Not while typing: the counter's value field is in a menu on this page. */
  document.addEventListener('keydown', function(ev){
    if(ev.key !== 'z' && ev.key !== 'Z') return;
    if(!(ev.ctrlKey || ev.metaKey) || ev.altKey) return;
    if(!TD.board) return;
    var t = ev.target;
    if(t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
    var pane = document.getElementById('pane-testdeck');
    if(pane && pane.offsetParent === null) return;
    ev.preventDefault();
    tdUndo(!!ev.repeat);
  });
  document.addEventListener('keydown', function(ev){
    if(ev.key !== 'Escape') return;
    /* One layer per press: a pending Connect, the Crystallize colours, the menu, then Search. */
    if(_tdTokConnectFrom) tdCancelTokenConnect();
    else if(_tdConnectFrom) tdCancelConnect();
    else if(document.getElementById('tdCrystal')) tdCloseCrystal();
    else if(document.getElementById('tdMenu')) tdCloseMenu();
    else if(document.getElementById('tdSearchOv')) tdCloseSearch();
  });
}

/* Alt clones the face already on screen: building a face (buildFaceHTML, fitFace) on every mousemove would make the
   board crawl. A face-down card stays hidden. */
var _tdAlt = {on:false, uid:null, x:0, y:0};
/* Every face this page draws, in one place so the listeners agree. .td-token is a counter, not a card: it is listed
   because an attached counter sits inside its card's token, and Alt over it shows the keyword. */
var TD_ALT_SEL = '.td-token, .td-card, .td-scard, .td-rew-mini, .td-rew-card, .td-lord';
/* Not the uid alone: a Rewards tile and a drawn card have none, and undefined === undefined would keep the first zoom. */
function tdAltKey(el){
  if(!el) return null;
  /* A card on the shared Field takes its seat from its layer. */
  var f = el.querySelector('.td-face');
  var half = el.closest && (el.closest('.rb-flayer') || el.closest('.td-half'));
  return (half ? (half.getAttribute('data-seat') || '') : '') + '|' + (el.dataset.uid || '')
    + '|' + (f ? (f.getAttribute('data-card') || '') : '');
}
function tdAltHide(){
  var el = document.getElementById('tdZoom');
  if(el) el.remove();
  _tdAlt.uid = null;
}
/* Looked up on the board of the half it is drawn in, or Alt is blank over an opponent's counter (HANDOFF §76.6). */
function tdTokenOf(el){
  if(!el || !el.classList || !el.classList.contains('td-token')) return null;
  var uid = el.dataset ? el.dataset.tok : null;
  if(!uid) return null;
  var bd = tdBoardOfEl(el);
  var list = (bd && bd.tokens) || [];
  for(var i = 0; i < list.length; i++)
    if(list[i].uid === uid) return list[i];
  return null;
}
/* No kwPill here: its onclick goes to the Keywords page, and on a magnifier that follows the pointer a link loses the
   board. */
/* The keyword's colours, not its shape: a chevron or slant would cut a full-width name. */
function tdAltCounterHTML(t){
  var name = String(t.name || '');
  var rem = '';
  try{
    if(typeof window.edKwReminder === 'function') rem = window.edKwReminder(name, name) || '';
  }catch(_){}
  var vars = '';
  try{
    if(typeof window.edKwPillVars === 'function') vars = window.edKwPillVars(name) || '';
  }catch(_){}
  return "<div class='td-ctrwin" + (vars ? ' td-ctrwin-lit' : '') + "'"
    + (vars ? " style='" + vars + "'" : '') + ">"
    /* The band shows the short label the counter wears; KW_DATA is looked up by the full name. */
    + "<div class='td-ctrwin-head'>" + e(tdCtrShortName(name)) + "</div>"
    + "<div class='td-ctrwin-txt" + (rem ? '' : ' none') + "'>"
    + (rem ? tdRuleHTML(rem)
           : 'No reminder text is written for this counter.')
    + "</div></div>";
}
/* Falls back to escaped text where the editor half is not loaded. */
/* symbolizeRules with noPills, not edKwReminderHTML, which pills the leading name the band already shows. */
/* noPills still links each keyword, and a link on a window that follows the pointer leads off the board, so each is
   unwrapped (HANDOFF §58). */
function tdRuleHTML(txt){
  var html = '';
  try{
    if(typeof symbolizeRules === 'function')
      html = symbolizeRules(String(txt), true).replace(/<\/?p>/g, '');
  }catch(_){ html = ''; }
  if(!html) return e(String(txt));
  try{
    var box = tdInertBox();
    if(!box) return e(String(txt));
    box.innerHTML = html;
    Array.prototype.forEach.call(box.querySelectorAll('.kw-link'), function(a){
      a.parentNode.replaceChild(box.ownerDocument.createTextNode(a.textContent), a);
    });
    Array.prototype.forEach.call(box.querySelectorAll('*'), tdStripHandlers);
    return box.innerHTML;
  }catch(_){ return e(String(txt)); }
}
function tdAltShowCounter(tokEl){
  var t = tdTokenOf(tokEl);
  /* Only named counters get a window; Alt over a +1, a colour or an Emblem Copy shows the card it is stuck to. */
  if(!t || t.kind !== 'kw' || !t.name) return false;
  var key = 'tok|' + t.uid;
  if(_tdAlt.uid === key && document.getElementById('tdZoom')) return true;
  tdAltHide();
  _tdAlt.uid = key;
  var z = document.createElement('div');
  z.id = 'tdZoom'; z.className = 'td-zoom td-zoom-ctr';
  z.innerHTML = tdAltCounterHTML(t);
  document.body.appendChild(z);
  tdAltPlace();
  return true;
}
function tdAltShow(cardEl){
  if(!cardEl) return tdAltHide();
  if(cardEl.classList && cardEl.classList.contains('td-token')){
    if(tdAltShowCounter(cardEl)) return;
    var host = cardEl.closest && cardEl.closest('.td-card');
    if(!host) return tdAltHide();
    cardEl = host;
  }
  var face = cardEl.querySelector('.td-face');
  if(!face || !face._tdPainted) return tdAltHide();   /* face down, or not built */
  var key = tdAltKey(cardEl);
  if(_tdAlt.uid === key && document.getElementById('tdZoom')) return;
  tdAltHide();
  _tdAlt.uid = key;
  var z = document.createElement('div');
  z.id = 'tdZoom'; z.className = 'td-zoom';
  z.innerHTML = "<div class='td-zoom-face'>" + face.innerHTML + "</div>";
  document.body.appendChild(z);
  var inner = z.querySelector('.mcard-scale');
  if(inner) inner.style.transform = 'scale(1)';       /* full 340px, not token size */
  tdAltStats(cardEl, z);
  tdAltCounters(cardEl, z);
  tdAltPlace();
}

/* Only on the magnifier, and only in the main game (Rebirth's counters are its stats row). A minus counter is stored
   negative (tdAddToken), so the total is a plain sum. */
function tdAltDelta(uid, board){
  var bd = board || TD.board;
  if(REBIRTH || !bd || !bd.tokens || !uid) return 0;
  var d = 0;
  bd.tokens.forEach(function(t){
    if(t.on !== uid) return;
    if(t.kind === 'plus' || t.kind === 'minus') d += tdNum(t.value);
  });
  return d;
}
/* The board is the one of the half the card sits in, as one uid can be on two halves. */
function tdAltStats(cardEl, z){
  var uid = cardEl && cardEl.dataset ? cardEl.dataset.uid : null;
  var bd = tdBoardOfEl(cardEl);
  var d = tdAltDelta(uid, bd);
  if(!d) return;
  var at = (uid && bd) ? tdFindIn(bd, uid) : null;
  var card = at && at.item ? at.item.card : null;
  if(!card || typeof window.edOrbsHTMLShifted !== 'function') return;
  var orbs = z.querySelector('.m-orbs');
  if(!orbs) return;                                  /* an Essence has none */
  var html = window.edOrbsHTMLShifted(card, d);
  if(html) orbs.innerHTML = html;
}

/* Rebuilt with tdTokenLabel, not cloned: a clone keeps the counters' absolute positions over the enlarged art. */
function tdAltCounters(cardEl, z){
  var uid = cardEl && cardEl.dataset ? cardEl.dataset.uid : null;
  var bd = tdBoardOfEl(cardEl);
  if(!uid || !bd || !bd.tokens) return;
  var mine = bd.tokens.filter(function(t){ return t.on === uid; });
  if(!mine.length) return;
  var row = document.createElement('div');
  row.className = 'td-zoom-ctrs';
  row.innerHTML = "<span class='td-zoom-ctrs-lab'>"
    + (mine.length === 1 ? 'Counter' : 'Counters') + "</span>"
    + mine.map(function(t){
        var cls = 'td-zoom-ctr-chip td-token-' + String(t.kind || '').replace(/[^a-z]/g, '');
        var css = '';
        if(t.kind === 'color')
          css = " style='--tok-fill:" + tdColorFill(t.name)
              + ";--tok-ink:" + tdColorInk(t.name) + "'";
        return "<span class='" + cls + "'" + css
          + " title='" + e(tdTokenTitle(t)) + "'>" + tdTokenLabel(t) + "</span>";
      }).join('');
  z.appendChild(row);
}
function tdAltPlace(){
  var z = document.getElementById('tdZoom');
  if(!z) return;
  var r = z.getBoundingClientRect();
  var x = _tdAlt.x + 22, y = _tdAlt.y - r.height / 2;
  if(x + r.width > window.innerWidth - 8) x = _tdAlt.x - r.width - 22;
  z.style.left = Math.max(8, x) + 'px';
  z.style.top  = Math.max(8, Math.min(y, window.innerHeight - r.height - 8)) + 'px';
}

/* Angles come from the pointer's place on the board token. The tilt goes on .td-zoom-face, as .mcard-scale and .mcard
   carry the zoom's scale and the frame's perspective. */
var TD_TILT_MAX = 18;          /* degrees */
function tdAltTilt(cardEl){
  var z = document.getElementById('tdZoom');
  if(!z) return;
  /* The counter window leans too; .td-zoom carries the perspective for both. */
  var face = z.querySelector('.td-zoom-face, .td-ctrwin');
  if(!face) return;
  if(!cardEl){ face.style.transform = ''; return; }
  var r = cardEl.getBoundingClientRect();
  if(!r.width || !r.height) return;
  /* -1..1 from the token's centre, clamped: the pointer can be just outside the token, on its border. */
  var nx = Math.max(-1, Math.min(1, ((_tdAlt.x - r.left) / r.width  - 0.5) * 2));
  var ny = Math.max(-1, Math.min(1, ((_tdAlt.y - r.top)  / r.height - 0.5) * 2));
  /* rotateX takes -ny, so the edge nearest the pointer comes towards you. */
  face.style.transform = 'rotateY(' + (nx * TD_TILT_MAX).toFixed(2) + 'deg)'
    + ' rotateX(' + (-ny * TD_TILT_MAX).toFixed(2) + 'deg)';
  tdAltHolo(face, nx, ny);
}

/* Only ed2_face.js moves --holo-ang, and only for the preview and the popout, so the zoom moves its own, from the board
   token. Not --rx/--ry (tdAltTilt owns the turn), and the orbs by hand: gradientTransform cannot read a custom property. */
function tdAltHolo(face, nx, ny){
  /* Set on #tdZoom, not the .mcard: the counter window and the counter row beside the face read --holo-ang too. */
  var z = document.getElementById('tdZoom');
  if(!z) return;
  /* The editor's handler works in 0..1 from the top-left and its constants are tuned to that, so -1..1 is converted. */
  var px = nx / 2 + 0.5, py = ny / 2 + 0.5;
  var ang = Math.round(90 + (px - 0.5) * 220 + (py - 0.5) * 90);
  z.style.setProperty('--holo-ang', ang + 'deg');
  /* Opposite the pointer, so the shadows follow the same light as the gradients. */
  z.style.setProperty('--ico-sx', (0.91 - (px - 0.5) * 4.8).toFixed(2) + 'px');
  z.style.setProperty('--ico-sy', (1.82 - (py - 0.5) * 4.8).toFixed(2) + 'px');
  var gs = z.querySelectorAll('linearGradient[data-rot]');
  for(var i = 0; i < gs.length; i++)
    gs[i].setAttribute('gradientTransform', 'rotate(' + ang + ' .5 .5)');
}
function tdBindAlt(){
  if(document._tdAltBound) return;
  document._tdAltBound = true;
  document.addEventListener('keydown', function(ev){
    if(ev.key !== 'Alt' || _tdAlt.on) return;
    _tdAlt.on = true;
    var el = document.elementFromPoint(_tdAlt.x, _tdAlt.y);
    var card = el && el.closest && el.closest(TD_ALT_SEL);
    tdAltShow(card);
    tdAltTilt(card);
  });
  document.addEventListener('keyup', function(ev){
    if(ev.key !== 'Alt') return;
    _tdAlt.on = false; tdAltHide();
  });
  /* Alt+Tab and the like take the key away without a keyup ever arriving. */
  window.addEventListener('blur', function(){ _tdAlt.on = false; tdAltHide(); });
  document.addEventListener('mousemove', function(ev){
    _tdAlt.x = ev.clientX; _tdAlt.y = ev.clientY;
    if(!_tdAlt.on) return;
    var el = ev.target.closest && ev.target.closest(TD_ALT_SEL);
    if(el) { tdAltShow(el); tdAltPlace(); tdAltTilt(el); } else tdAltHide();
  });
}

/* The card size is fitted to the table's room (tdFitTable), so the side panels fold on the board. _tdPanelWas restores
   only what this closed; wrapped, as minimizeSidebar reads #sbPanel with no null check. */
var _tdPanelWas = null;
function tdFoldSidePanels(fold){
  if(fold){
    if(_tdPanelWas) return;
    var sb = document.getElementById('sbPanel');
    var dp = document.querySelector('.dp');
    _tdPanelWas = {
      sb: !!(sb && sb.classList.contains('minimized')),
      dp: !!(dp && dp.style.display === 'none')
    };
    try{ minimizeSidebar(true); }catch(_){}
    try{ minimizeDeckPanel(true); }catch(_){}
    /* A class too: setDeckPanelForTab (ed2_boot.js, run after showTab) clears .dp's inline display. minimizeDeckPanel is
       still called, for its Deck button. */
    if(dp) dp.classList.add('td-panel-fold');
    return;
  }
  if(!_tdPanelWas) return;
  var was = _tdPanelWas; _tdPanelWas = null;
  var dpEl = document.querySelector('.dp');
  if(dpEl) dpEl.classList.remove('td-panel-fold');
  try{ if(!was.sb) minimizeSidebar(false); }catch(_){}
  try{ if(!was.dp) minimizeDeckPanel(false); }catch(_){}
}
