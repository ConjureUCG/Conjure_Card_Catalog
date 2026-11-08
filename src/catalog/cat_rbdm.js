/* All the DM's decks are one zone, each card marked with its deck (dk), so nothing else has to keep in step (HANDOFF §84). */
var TD_DM_MOST = 40;          /* decks a DM may bring to one table */
var TD_DM_CARDS = 6000;       /* cards in the DM Deck, every deck together (cat_guard.js) */

function tdRbIsDm(b){ return !!b && (b.role === 'dm' || b.role === 'dmp'); }
window.tdRbIsDm = tdRbIsDm;
function tdDmMine(){ return !!TD.board && !TD.watching && tdRbIsDm(TD.board); }
function tdDmBoard(){
  if(tdDmMine()) return TD.board;
  var sides = tdFoeSides();
  for(var i = 0; i < sides.length; i++){
    var f = tdFoeOf(sides[i]);
    if(tdRbIsDm(f)) return f;
  }
  return null;
}
function tdDmChipMine(){ return tdDmMine() ? "<span class='tbl-cs rb-cdm'>DM</span>" : ''; }

function tdDmDecks(b){
  return ((b && b.dmDecks) || []).filter(function(d){ return d && !d.gone; });
}
function tdDmDeckOf(b, id){
  var all = (b && b.dmDecks) || [];
  for(var i = 0; i < all.length; i++) if(all[i] && all[i].id === id) return all[i];
  return null;
}
function tdDmCur(b){
  var live = tdDmDecks(b);
  for(var i = 0; i < live.length; i++) if(live[i].id === TD.dmCur) return live[i];
  return live[0] || null;
}
function tdDmCurId(){ var d = tdDmCur(TD.board); return d ? d.id : ''; }
/* Pile order: the top is the end. */
function tdDmLeft(b, id){
  return ((b && b.zones && b.zones.dmdeck) || []).filter(function(it){ return it.dk === id; });
}
function tdDmKindWord(k){ return k === 'rew' ? 'Rewards' : 'Encounter'; }
function tdDmKindOf(entry){
  return (entry && typeof entry === 'object' && entry.mode === 'rewards') ? 'rew' : 'enc';
}
function tdDmIsReward(b, it){
  var d = (it && it.dk) ? tdDmDeckOf(b, it.dk) : null;
  return !!(d && d.kind === 'rew');
}
function tdDmKey(s){ return String(s == null ? '' : s).replace(/\s+/g, ' ').trim().toLowerCase(); }
function tdDmSaved(){
  var all = (typeof _savedLoad === 'function') ? _savedLoad() : {};
  var out = Object.create(null);
  Object.keys(all).forEach(function(n){
    var v = all[n];
    if(v && typeof v === 'object' && v.mode === 'draft') return;
    out[tdDmKey(n)] = {name:n, entry:v};
  });
  return out;
}
/* A whole line is tried first, so a deck whose name has a comma in it is still found (HANDOFF §84). */
function tdDmMatch(text){
  var saved = tdDmSaved(), found = [], missing = [], seen = Object.create(null), over = 0;
  var take = function(raw){
    var k = tdDmKey(raw);
    if(!k || seen[k]) return;
    seen[k] = 1;
    var hit = saved[k];
    if(!hit){ missing.push(String(raw).replace(/\s+/g, ' ').trim()); return; }
    if(found.length >= TD_DM_MOST){ over++; return; }
    found.push({name:hit.name, kind:tdDmKindOf(hit.entry)});
  };
  String(text == null ? '' : text).split(/\r?\n/).forEach(function(line){
    var whole = tdDmKey(line);
    if(!whole) return;
    if(saved[whole] || line.indexOf(',') < 0){ take(line); return; }
    line.split(',').forEach(take);
  });
  return {found:found, missing:missing, over:over};
}
window.tdDmMatch = tdDmMatch;
function tdDmEntries(entry){
  var text = '';
  if(typeof entry === 'string') text = entry;
  else if(entry && typeof entry === 'object')
    text = Object.keys(DECK_IDS).map(function(k){ return entry[k] || ''; }).join('\n');
  return deckCanonEntries(parseDeckLines(text), true);
}
function tdDmItems(entry, id, missing){
  var out = [];
  tdDmEntries(entry).forEach(function(en){
    var card = tdCardByName(en.name);
    if(!card){ if(missing && missing.indexOf(en.name) < 0) missing.push(en.name); return; }
    for(var i = 0; i < Math.max(1, en.count || 1); i++)
      out.push({uid:tdUid('td'), card:card, locked:false, dm:true, dk:id});
  });
  return tdShuffle(out);
}
function tdDmNextId(b){
  var n = 0;
  ((b && b.dmDecks) || []).forEach(function(d){
    var m = /^k(\d+)$/.exec((d && d.id) || '');
    if(m) n = Math.max(n, +m[1]);
  });
  return 'k' + (n + 1);
}
/* No action: a board being built is the starting position, in the log's first entry. */
function tdDmAddTo(board, name, saved){
  var hit = (saved || tdDmSaved())[tdDmKey(name)];
  if(!hit || tdDmDecks(board).length >= TD_DM_MOST) return '';
  var id = tdDmNextId(board);
  var room = Math.max(0, TD_DM_CARDS - board.zones.dmdeck.length);
  var items = tdDmItems(hit.entry, id, board.missing).slice(0, room);
  board.dmDecks.push({id:id, name:hit.name, kind:tdDmKindOf(hit.entry)});
  items.forEach(function(it){ board.zones.dmdeck.push(it); });
  return id;
}

function tdDmBuild(board, was){
  if(!board || !board.zones || !REBIRTH || _gameMode !== 'character') return;
  var deal = TD._dmDeal || null, role = '', decks = null;
  /* an old DM dealing themselves in keeps their decks, drawn cards and DM Grave (tdRbDealIn, cat_rbplay.js) */
  if(deal && deal.keep){ if(typeof tdRbKeepOn === 'function') tdRbKeepOn(board, deal.keep); return; }
  var host = (typeof tblOn === 'function' && tblOn() && typeof tboIsHost === 'function' && tboIsHost());
  if(deal && deal.fresh){ role = deal.role; decks = deal.decks; deal.fresh = false; }
  else if(host && tdRbIsDm(was)){
    role = was.role;
    decks = tdDmDecks(was).map(function(d){ return {name:d.name, kind:d.kind}; });
  } else if(deal && host){ role = deal.role; decks = deal.decks; }
  if(role !== 'dm' && role !== 'dmp') return;
  board.role = role;
  if(role === 'dm'){
    Object.keys(board.zones).forEach(function(z){ board.zones[z] = []; board.counts[z] = 0; });
    board.missing = [];
    delete board.lvl;
    delete board.zshow;
  }
  board.dmDecks = [];
  if(!board.zones.dmdeck) board.zones.dmdeck = [];
  var saved = tdDmSaved();
  (decks || []).forEach(function(d){ if(d && d.name) tdDmAddTo(board, d.name, saved); });
  board.counts.dmdeck = board.zones.dmdeck.length;
  TD.dmCur = board.dmDecks.length ? board.dmDecks[0].id : '';
}

/* Each carries the pieces it adds, minted by the DM's app, so a replay lands on the same ones; none crosses the table (tblRedact). */
/* 'del' takes only what is left of the deck in the DM Deck: a card drawn or on the Field stays. */
TD_ACT.dmdeck = function(b, a){
  if(!b.zones.dmdeck) b.zones.dmdeck = [];
  if(!b.dmDecks) b.dmDecks = [];
  if(a.op === 'add'){
    if(tdDmDeckOf(b, a.id)) return;
    b.dmDecks.push({id:a.id, name:String(a.name || ''), kind:(a.kind === 'rew' ? 'rew' : 'enc')});
    (a.items || []).forEach(function(o){
      var card = tdCardByName(o.n);
      if(!card){ if(b.missing && b.missing.indexOf(o.n) < 0) b.missing.push(o.n); return; }
      b.zones.dmdeck.push({uid:o.uid, card:card, locked:false, dm:true, dk:a.id});
    });
  } else if(a.op === 'del'){
    var d = tdDmDeckOf(b, a.id);
    if(!d) return;
    d.gone = true;
    b.zones.dmdeck = b.zones.dmdeck.filter(function(it){ return it.dk !== a.id; });
  }
};
/* The player's own app makes the card (tdDmGiftFrom). */
TD_ACT.give = function(b, a){
  var at = tdFindIn(b, a.uid);
  if(!at) return;
  var list = b.zones[at.zone];
  list.forEach(function(k){
    if(k.connectedTo !== a.uid) return;
    delete k.connectedTo;
    if(k.x == null){ k.x = at.item.x == null ? 4 : at.item.x; k.y = at.item.y == null ? 4 : at.item.y; }
    k.auto = false;
  });
  list.splice(at.index, 1);
  if(b.tokens) b.tokens = b.tokens.filter(function(t){ return t.on !== a.uid; });
};
/* A gift the DM took back (tdDmUngiftFrom) leaves the player's board as a given card leaves the DM's. */
TD_ACT.ungift = function(b, a){ TD_ACT.give(b, a); };
/* A card of somebody else's attached under one that goes stays where it was (HANDOFF §84). */
TD_ACT.map = function(b, a){
  if(a.name) b.map = String(a.name); else delete b.map;
  if(a.keep) return;
  if(typeof tdGfMapDown === 'function') tdGfMapDown(b, a);
  var field = b.zones.field;
  if(!field) return;
  var gone = Object.create(null);
  field.forEach(function(it){ if(a.all || it.dm) gone[it.uid] = it; });
  field.forEach(function(k){
    if(!k.connectedTo || gone[k.uid] || !gone[k.connectedTo]) return;
    var p = gone[k.connectedTo];
    delete k.connectedTo;
    if(k.x == null){ k.x = p.x == null ? 4 : p.x; k.y = p.y == null ? 4 : p.y; }
    k.auto = false;
  });
  field = b.zones.field = field.filter(function(it){ return !gone[it.uid]; });
  if(b.tokens) b.tokens = b.tokens.filter(function(t){ return !(t.on && gone[t.on]); });
  /* tokens kept through the change (Persistent tokens) let go of the cards that went */
  if(typeof tdGfToks === 'function') tdGfToks(b).forEach(function(t){ if(t.cd && gone[t.cd]) delete t.cd; });
  var added = Object.create(null);
  (a.cards || []).forEach(function(c){
    var card = tdCardByName(c.n);
    if(!card){ if(b.missing && b.missing.indexOf(c.n) < 0) b.missing.push(c.n); return; }
    var it = {uid:c.uid, card:card, locked:!!c.locked};
    if(!a.all) it.dm = true;
    if(c.down) it.down = true;
    if(c.dmg) it.dmg = c.dmg;
    if(c.on) it.connectedTo = c.on;
    else { it.x = tdNum(c.x); it.y = tdNum(c.y); it.auto = false; }
    field.push(it);
    added[c.uid] = it;
  });
  /* A card whose parent is not in this catalogue stands on its own. */
  field.forEach(function(it){
    if(!added[it.uid] || !it.connectedTo || added[it.connectedTo]) return;
    delete it.connectedTo;
    it.x = 4; it.y = 4; it.auto = false;
  });
  (a.toks || []).forEach(function(t){
    if(!t.on || !added[t.on]) return;
    if(!b.tokens) b.tokens = [];
    var o = {uid:t.uid, kind:t.kind, name:t.name || '', on:t.on};
    if(t.value != null) o.value = t.value;
    b.tokens.push(o);
  });
};
function tdDmActionWords(a, board, before, beforeName){
  switch(a.t){
    case 'give':
      return (a.to === TD.side)
        ? 'took ' + (a.n || beforeName || 'a card') + ' from the Rewards'
        : 'gave ' + (a.n || beforeName || 'a card') + ' to ' + tblSeatName(a.to);
    case 'ungift':
      return 'took back ' + (a.n || beforeName || 'a card');
    case 'dmdeck':
      return a.op === 'add' ? 'brought in the ' + (a.name || 'new') + ' deck'
           : a.op === 'del' ? 'put away the ' + (a.name || 'old') + ' deck' : '';
    case 'map':
      if(a.took) return '';
      if(a.keep) return a.name ? 'named the map ' + a.name : 'cleared the map name';
      return 'switched the map to ' + (a.name || 'an unnamed map');
  }
  return '';
}

function tdDmAfter(){
  tdRender();
  if(document.getElementById('tdSearchOv')) tdRenderSearch();
}
function tdDmShowDrawn(){
  if(TD.board && TD.board.role === 'dmp') TD._dmOpen = true;
}
function tdDmTopUid(){
  var d = tdDmCur(TD.board), left = d ? tdDmLeft(TD.board, d.id) : [];
  return left.length ? left[left.length - 1].uid : '';
}
/* Into the row only the DM sees, never straight onto the Field (HANDOFF §84). */
function tdDmDraw(){
  tdCloseMenu();
  if(!tdDmMine()) return false;
  var uid = tdDmTopUid();
  if(!uid){
    if(typeof toast === 'function')
      toast(tdDmCur(TD.board) ? 'That deck is empty' : 'Bring in a DM deck first');
    return false;
  }
  return tdDmDrawUid(uid);
}
function tdDmDrawUid(uid){
  if(!tdMove(uid, 'dmrow')) return false;
  tdDmShowDrawn();
  tdDmAfter();
  return true;
}
/* The Search window shows only the pieces it was opened with (_tdSearchUids). */
function tdDmSearch(){
  tdCloseMenu();
  var d = tdDmCur(TD.board);
  if(!d || !tdDmMine()) return false;
  _tdSearchUids = tdDmLeft(TD.board, d.id).map(function(it){ return it.uid; });
  _tdSearchTop = 0;
  _tdPeeking = true;
  tdOpenSearch('dmdeck');
  return true;
}
function tdDmSearchLabel(){
  var d = tdDmCur(TD.board);
  return d ? 'DM Deck: ' + d.name : 'DM Deck';
}
/* Only this deck's cards change places, among the places they hold: the other decks in the zone stay as arranged. */
function tdDmShuffle(){
  tdCloseMenu();
  var b = TD.board, d = tdDmCur(b);
  if(!d || !tdDmMine()) return false;
  var z = b.zones.dmdeck || [], pos = [], uids = [];
  z.forEach(function(it, i){ if(it.dk === d.id){ pos.push(i); uids.push(it.uid); } });
  if(uids.length > 1){
    tdShuffle(uids);
    var order = z.map(function(it){ return it.uid; });
    pos.forEach(function(p, k){ order[p] = uids[k]; });
    tdDo({t:'order', zone:'dmdeck', order:order});
  }
  tdDmAfter();
  if(typeof toast === 'function') toast(d.name + ' shuffled');
  return true;
}
function tdDmMatches(){
  var d = tdDmCur(TD.board);
  if(!d || !document.getElementById('tdRewSide')) return [];
  var pred = catFilterPred(tdRewSpec());
  return tdDmLeft(TD.board, d.id).filter(function(it){ return !!it.card && pred(it.card); });
}
function tdDmSyncMatch(){
  var n = document.getElementById('tdDmMatchN');
  if(!n) return;
  var d = tdDmCur(TD.board), all = d ? tdDmLeft(TD.board, d.id).length : 0;
  var hit = all ? tdDmMatches().length : 0;
  n.textContent = !all ? 'nothing left in this deck'
    : hit + ' of ' + all + (hit === 1 ? ' card matches' : ' cards match');
  n.className = 'td-dm-n' + (hit ? '' : ' none');
}
function tdDmDrawMatch(){
  var pool = tdDmMatches();
  if(!pool.length){
    if(typeof toast === 'function') toast('Nothing left in this deck matches that description');
    return false;
  }
  return tdDmDrawUid(pool[Math.floor(Math.random() * pool.length)].uid);
}
function tdDmDescToggle(){
  var box = document.getElementById('tdDmDesc'), btn = document.getElementById('tdDmDescBtn');
  if(!box) return;
  box.hidden = !box.hidden;
  if(btn){ btn.classList.toggle('on', !box.hidden); btn.setAttribute('aria-expanded', box.hidden ? 'false' : 'true'); }
  if(!box.hidden) tdDmSyncMatch();
}
function tdDmDescReset(){
  if(typeof window.tdRewReset === 'function') window.tdRewReset();
  tdDmSyncMatch();
}
function tdDmTake(name){
  var d = tdDmCur(TD.board), left = d ? tdDmLeft(TD.board, d.id) : [];
  for(var i = left.length - 1; i >= 0; i--)
    if(left[i].card && left[i].card.name === name) return left[i].uid;
  return '';
}
function tdDmTakeTo(name, to){
  tdCloseMenu();
  var uid = tdDmTake(name);
  if(!uid) return false;
  if(to === 'dmrow') return tdDmDrawUid(uid);
  if(!tdMove(uid, to)) return false;
  tdDmAfter();
  return true;
}

function tdDmPick(id){
  if(!tdDmDeckOf(TD.board, id)) return;
  TD.dmCur = id;
  tdRender();
}
function tdDmBringIn(text){
  if(!tdDmMine()) return false;
  var b = TD.board, m = tdDmMatch(text), saved = tdDmSaved();
  var have = Object.create(null);
  tdDmDecks(b).forEach(function(d){ have[tdDmKey(d.name)] = 1; });
  var added = [], already = [], full = 0;
  m.found.forEach(function(f){
    var k = tdDmKey(f.name), hit = saved[k];
    if(!hit) return;
    if(have[k]){ already.push(hit.name); return; }
    if(tdDmDecks(b).length >= TD_DM_MOST){ full++; return; }
    var id = tdDmNextId(b), miss = [];
    var room = Math.max(0, TD_DM_CARDS - (b.zones.dmdeck || []).length);
    var items = tdDmItems(hit.entry, id, miss).slice(0, room);
    tdDo({t:'dmdeck', op:'add', id:id, name:hit.name, kind:tdDmKindOf(hit.entry),
          items:items.map(function(it){ return {uid:it.uid, n:it.card.name}; })});
    have[k] = 1;
    added.push(hit.name + (miss.length ? ' (' + miss.length + ' not in this catalogue)' : ''));
    TD.dmCur = id;
  });
  var words = [];
  if(added.length) words.push('Brought in: ' + added.join(', '));
  if(already.length) words.push('Already in: ' + already.join(', '));
  if(m.missing.length) words.push('Not found: ' + m.missing.join(', '));
  if(full || m.over) words.push('A table takes ' + TD_DM_MOST + ' decks at most');
  var why = document.getElementById('tdDmAddWhy');
  if(why) why.textContent = words.join(' · ') || 'Type the names of saved decks';
  if(added.length){
    var inp = document.getElementById('tdDmAddIn');
    if(inp) inp.value = '';
    tdDmAfter();
  }
  return added.length > 0;
}
function tdDmPutAway(id){
  var d = tdDmDeckOf(TD.board, id);
  if(!d || d.gone || !tdDmMine()) return false;
  tdDo({t:'dmdeck', op:'del', id:id, name:d.name});
  tdDmAfter();
  return true;
}
function tdDmAddRow(on){
  var row = document.getElementById('tdDmAddRow');
  if(!row) return;
  row.hidden = !on;
  if(on){
    var inp = document.getElementById('tdDmAddIn');
    if(inp) setTimeout(function(){ try{ inp.focus(); }catch(_){} }, 0);
  }
}
function tdDmSelChange(sel){
  var v = sel.value, b = TD.board;
  if(v === '+add') tdDmAddRow(true);
  else if(v === '+del'){
    var d = tdDmCur(b);
    if(d){
      var n = tdDmLeft(b, d.id).length;
      if(confirm('Put away the ' + d.name + ' deck?\n\nThe ' + n + (n === 1 ? ' card' : ' cards')
          + ' still in it go with it. Cards already drawn or on the Field stay where they are.'))
        tdDmPutAway(d.id);
    }
  }
  else if(v) tdDmPick(v);
  sel._k = '';
  try{ sel.blur(); }catch(_){}
  tdDmSync();
}

/* Only once the message to that player is sent does the card leave the DM's board (HANDOFF §84). */
function tdDmGiveSeats(){
  return tblSeated().filter(function(s){ return s !== TD.side && !tdRbDmOnly(tdFoeOf(s)); });
}
function tdDmGive(uid, seat){
  tdCloseMenu();
  if(!tdDmMine()) return false;
  var at = tdFind(uid);
  if(!at || !at.item.dm || !at.item.card) return false;
  var say = function(w){ if(typeof toast === 'function') toast(w); };
  if(!tdDmIsReward(TD.board, at.item)){ say('Only a card from a Rewards deck can be given'); return false; }
  var name = at.item.card.name, self = (seat === TD.side);
  if(self && TD.board.role !== 'dmp') return false;
  var s = self ? null : (TBL.seats || {})[seat];
  if(!self){
    if(!s || !s.id){ say('Nobody is sitting there'); return false; }
    if(tdRbDmOnly(tdFoeOf(seat))){ say('The DM has no Hand to give it to'); return false; }
  }
  /* What is attached under it is let go first, as moves of their own, so everybody sees those cards stay. */
  if(at.zone === 'field'){
    var px = at.item.x == null ? 4 : at.item.x, py = at.item.y == null ? 4 : at.item.y;
    tdChildrenOf(TD.board.zones.field, uid).forEach(function(k){
      tdDo({t:'move', uid:k.uid, to:'field', x:px, y:py, auto:false});
    });
  }
  if(self){
    tdDo({t:'give', uid:uid, to:TD.side, n:name});
    tdDo({t:'spawn', zone:tdHandAreaZone({card:at.item.card}, 'hand'), uid:tdUid('td'), n:name,
          gift:true, self:true});
    tdDmAfter();
    say('Took ' + name + ' into your Hand');
    return true;
  }
  /* The player's card carries the gift's id (gid), so the DM's Undo can ask for that card back (tdDmUndoGive). */
  var g = tdUid('td');
  if(!tblSend({t:'gift', to:s.id, n:name, g:g})){ say('Not given — you are not connected to the table'); return false; }
  tdDo({t:'give', uid:uid, to:seat, n:name, g:g});
  tdDmAfter();
  say('Gave ' + name + ' to ' + tblSeatName(seat));
  return true;
}
function tdDmGiftFrom(m, fromId){
  if(!TD.board || TD.watching || !REBIRTH || tdRbDmOnly(TD.board)) return;
  var side = tblSideOf(fromId);
  if(!side || side === TD.side || !tdRbIsDm(tdFoeOf(side))) return;
  var card = tdCardByName(m.n);
  if(!card){
    if(typeof toast === 'function') toast(tblSeatName(side) + ' gave you ' + m.n + ', which is not in your catalogue');
    return;
  }
  var sp = {t:'spawn', zone:tdHandAreaZone({card:card}, 'hand'), uid:tdUid('td'), n:card.name, gift:true};
  if(m.g) sp.gid = m.g;
  tdDo(sp);
  tdRender();
  if(typeof toast === 'function') toast(tblSeatName(side) + ' gave you ' + card.name);
}
window.tdDmGiftFrom = tdDmGiftFrom;
/* Undo puts the card back on the DM's board, so the player's copy must go first, or the card is at the table twice (HANDOFF §84). */
function tdDmUndoGive(a){
  if(!a || a.t !== 'give' || !a.g || a.to === TD.side || !tdDmMine()) return true;
  var s = (TBL.seats || {})[a.to], name = a.n || 'the card';
  var say = function(w){ if(typeof toast === 'function') toast(w); };
  if(!s || !s.id){ say(tblSeatName(a.to) + ' has left the table and keeps ' + name); return true; }
  if(!tblSend({t:'ungift', to:s.id, g:a.g, n:a.n || ''})){
    say('Not undone — you are not connected to the table');
    return false;
  }
  say('Took ' + name + ' back from ' + tblSeatName(a.to));
  return true;
}
window.tdDmUndoGive = tdDmUndoGive;
/* Your Undo stops here, so it cannot bring back a card the DM holds again. */
function tdDmUngiftFrom(m, fromId){
  if(!TD.board || TD.watching || !REBIRTH || tdRbDmOnly(TD.board)) return;
  var side = tblSideOf(fromId);
  if(!side || side === TD.side || !tdRbIsDm(tdFoeOf(side))) return;
  var it = null;
  Object.keys(TD.board.zones).some(function(z){
    return (TD.board.zones[z] || []).some(function(x){
      if(x && x.gid === m.g){ it = x; return true; }
      return false;
    });
  });
  if(!it) return;
  var name = it.card ? it.card.name : (m.n || 'a card');
  tdRbAsBy(side, function(){ tdDo({t:'ungift', uid:it.uid, n:name}); });
  tdUndoFloorHere(name + ' went back to the DM');
  tdRender();
  if(typeof toast === 'function') toast(tblSeatName(side) + ' took back ' + name);
}
window.tdDmUngiftFrom = tdDmUngiftFrom;

function tdDmBackTo(item, dk){
  var live = function(id){ var d = id ? tdDmDeckOf(TD.board, id) : null; return (d && !d.gone) ? d.id : ''; };
  return live(dk) || live(item && item.dk) || tdDmCurId();
}
function tdDmMenuRows(item, zoneId){
  if(!item || !item.dm || !tdDmMine()) return [];
  var uid = item.uid, rows = [];
  var go = function(to, opts){
    return function(){ tdCloseMenu(); if(tdMove(uid, to, opts || {})) tdDmAfter(); };
  };
  if(zoneId !== 'field') rows.push({label:'Put on the Field', act:go('field')});
  if(zoneId !== 'dmrow') rows.push({label:'Take into Drawn cards',
                                    act:function(){ tdCloseMenu(); tdDmDrawUid(uid); }});
  if(zoneId !== 'dmgrave') rows.push({label:"Send to the DM's Grave", act:go('dmgrave')});
  if(zoneId !== 'dmdeck'){
    var back = tdDmDeckOf(TD.board, tdDmBackTo(item));
    if(back) rows.push({label:'Back into ' + back.name, hint:'shuffled in', act:go('dmdeck', {dk:back.id})});
  }
  if(tdDmIsReward(TD.board, item)){
    if(TD.board.role === 'dmp')
      rows.push({label:'Take into your Hand', act:function(){ tdDmGive(uid, TD.side); }});
    tdDmGiveSeats().forEach(function(s){
      rows.push({label:'Give to ' + tblSeatName(s), act:function(){ tdDmGive(uid, s); }});
    });
  }
  if(rows.length) rows.push({sep:true});
  return rows;
}
function tdDmPileRows(){
  var b = TD.board, cur = tdDmCur(b), rows = [];
  if(cur){
    rows.push({label:'Draw', hint:'into Drawn cards', act:function(){ tdDmDraw(); }});
    rows.push({label:'Search ' + cur.name, act:function(){ tdDmSearch(); }});
    rows.push({label:'Shuffle ' + cur.name, act:function(){ tdDmShuffle(); }});
    rows.push({sep:true});
  }
  rows.push({label:'Open the DM Tools', act:function(){ tdCloseMenu(); tdDmToolsOpen(true); }});
  var others = tdDmDecks(b).filter(function(d){ return !cur || d.id !== cur.id; });
  if(others.length) rows.push({sep:true});
  others.forEach(function(d){
    rows.push({label:'Switch to ' + d.name, hint:tdDmLeft(b, d.id).length + ' left',
               act:function(){ tdCloseMenu(); tdDmPick(d.id); }});
  });
  return rows;
}
function tdDmListMenu(name, x, y){
  tdCloseMenu();
  if(!tdDmMine() || !name) return;
  var cur = tdDmCur(TD.board), rows = [];
  rows.push({label:'Take into Drawn cards', act:function(){ tdDmTakeTo(name, 'dmrow'); }});
  rows.push({label:'Put on the Field', act:function(){ tdDmTakeTo(name, 'field'); }});
  if(cur && cur.kind === 'rew'){
    if(TD.board.role === 'dmp')
      rows.push({label:'Take into your Hand', act:function(){ var u = tdDmTake(name); if(u) tdDmGive(u, TD.side); }});
    tdDmGiveSeats().forEach(function(s){
      rows.push({label:'Give to ' + tblSeatName(s), act:function(){ var u = tdDmTake(name); if(u) tdDmGive(u, s); }});
    });
  }
  rows.push({sep:true});
  rows.push({label:'Look at it', act:function(){
    tdCloseMenu();
    var c = tdCardByName(name);
    if(c && typeof openMod === 'function') openMod(c);
  }});
  tdShowMenu(name, rows, '', x, y);
}
function tdDmPileClick(){ tdDmToolsOpen(true); }

/* endDrag asks this first: true when it took the drop. */
function tdDmBoardDrop(d, el){
  if(!tdDmMine() || !el || !el.closest) return false;
  var at = tdFind(d.uid);
  if(!at) return false;
  /* Let go on its own pile: a press that shook, not a move, or the card would be shuffled back in. */
  if(at.zone === 'dmdeck' && el.closest('#tdBoard .rb-dmpile')){ tdDmPileClick(); return true; }
  var inWin = el.closest('#tdDmWin');
  if(!at.item.dm){
    if(inWin){ tdRender(); return true; }       /* yours, not the DM's: put back */
    return false;
  }
  var other = el.closest('#tdBoard .rb-other[data-seat]');
  if(other){ if(!tdDmGive(d.uid, other.getAttribute('data-seat'))) tdRender(); return true; }
  var dz = el.closest('#tdDmWin [data-dmzone]');
  if(dz){
    var to = dz.getAttribute('data-dmzone');
    if(at.zone !== to) tdMove(d.uid, to);
    tdDmAfter();
    return true;
  }
  if(inWin){ tdRender(); return true; }
  if(TD.board.role === 'dmp' && tdDmIsReward(TD.board, at.item)
     && el.closest('#tdBoard .rb-mine .td-handarea, #tdBoard .rb-mine .td-zone[data-zone=hand]')){
    if(!tdDmGive(d.uid, TD.side)) tdRender();
    return true;
  }
  return false;
}

function tdDmCornerHTML(b){
  if(!b || b !== TD.board || TD.watching || !tdRbIsDm(b)) return null;
  var Z = tdZoneById;
  if(b.role === 'dm')
    return tdDmPileHTML(b, false) + tdZoneSectionHTML(Z('dmgrave'), b) + tdZoneSectionHTML(Z('dmrow'), b);
  return tdZoneHTML(Z('deck'), b) + tdDmPileHTML(b, true) + tdZoneHTML(Z('grave'), b)
    + tdZoneHTML(Z('essarea'), b) + tdZoneHTML(Z('hand'), b);
}
function tdDmPileHTML(b, small){
  var d = tdDmCur(b), left = d ? tdDmLeft(b, d.id) : [];
  var top = left[left.length - 1];
  var title = d
    ? ('DM Deck: ' + d.name + ' (' + tdDmKindWord(d.kind) + '), ' + left.length + ' left. Press for the DM Tools')
    : 'No DM deck brought in yet. Press for the DM Tools';
  return "<section class='td-zone td-pile rb-dmpile" + (small ? ' rb-dmpile-sm' : '') + "'"
    + " data-zone='dmdeck' data-side='mine' title='" + e(title) + "'>"
    + "<div class='td-zhdr'><span class='td-zcount'>" + left.length + "</span>"
    + "<span class='td-zname' title='" + e(title) + "'>" + e(small ? 'DM' : (d ? d.name : 'DM Deck')) + "</span>"
    + "<span class='td-ztools'></span></div>"
    + "<div class='td-zbody'>"
    + (top ? tdCardHTML(top, {id:'dmdeck', kind:'pile'}, {board:b}) : "<div class='td-empty'>empty</div>")
    + "</div></section>";
}

function tdDmToolsOpen(on){
  TD._dmOpen = !!on;
  tdDmRender();
}
window.tdDmToolsOpen = tdDmToolsOpen;
function tdDmRender(){
  var win = document.getElementById('tdDmWin');
  if(!(tdDmMine() && tdRbOn())){ if(win) win.remove(); return; }
  if(TD._dmOpen == null) TD._dmOpen = (TD.board.role === 'dm');
  if(!win){
    win = document.createElement('aside');
    win.id = 'tdDmWin';
    win.className = 'td-dmwin';
    win.setAttribute('role', 'dialog');
    win.setAttribute('aria-modal', 'false');
    win.setAttribute('aria-label', 'DM Tools');
    win.innerHTML = "<div class='td-fw-head'><b class='td-fw-title'>DM Tools</b>"
      + "<span class='tbl-gap'></span>"
      + "<button class='ed2-btn tiny close-x' onclick='tdDmToolsOpen(false)'"
      + " title='Put the DM Tools away - the DM Deck opens them again'>Close &#10005;</button></div>"
      + "<div class='td-dmbody' id='tdDmBody'></div>";
    var feed = document.getElementById('tdFeed');
    ((feed && feed.parentNode) || document.body).appendChild(win);
    tdDmBind(win);
  }
  if(win.getAttribute('data-role') !== TD.board.role){
    win.setAttribute('data-role', TD.board.role);
    document.getElementById('tdDmBody').innerHTML = tdDmBodyHTML(TD.board.role);
    tdDmMountDesc();
  }
  var was = win.hidden;
  win.hidden = !TD._dmOpen;
  if(win.hidden) return;
  tdDmSync();
  /* Placed as it opens, not on every render, and only once the board is on screen to place it by (HANDOFF §84). */
  var bd = document.getElementById('tdBoard');
  if(!bd || !bd.getBoundingClientRect().height){ win._tdLate = true; return; }
  /* Placed again after each render until dragged: the others' Hands arrive after the deal and push the Field down (HANDOFF §84). */
  if(was || !win._tdWin || win._tdLate || !tdWinSaved('dm')){
    win._tdLate = false;
    setTimeout(function(){
      if(!win.hidden && !win.classList.contains('td-fw-drag')) tdFloatWin(win, 'dm');
    }, 0);
  }
}
window.tdDmRender = tdDmRender;
function tdDmBodyHTML(role){
  return "<div class='td-dm-row'>"
      + "<select class='tbl-select td-dm-sel' id='tdDmSel' aria-label='The DM deck the tools are on'></select>"
      + "<span class='td-dm-n' id='tdDmLeftN'></span></div>"
    + "<div class='td-dm-add' id='tdDmAddRow' hidden>"
      + "<textarea id='tdDmAddIn' rows='2' maxlength='4000' aria-label='Saved decks to bring in'"
        + " placeholder='Saved deck names, one per line or comma separated'></textarea>"
      + "<div class='td-dm-row'>"
        + "<button type='button' class='ed2-btn tiny primary' data-dm='bring'>Bring in</button>"
        + "<span class='td-dm-why' id='tdDmAddWhy'></span>"
        + "<span class='tbl-gap'></span>"
        + "<button type='button' class='ed2-btn tiny close-x' data-dm='addclose'>Close &#10005;</button></div>"
    + "</div>"
    + "<div class='td-dm-row'>"
      + "<button type='button' class='ed2-btn tiny' data-dm='draw' title='The top card, into Drawn cards'>Draw</button>"
      + "<button type='button' class='ed2-btn tiny' data-dm='search' title='Look through this deck'>"
        + uiIco('search') + " Search</button>"
      + "<button type='button' class='ed2-btn tiny' data-dm='shuffle'>" + uiIco('shuffle') + " Shuffle</button>"
      + "<button type='button' class='ed2-btn tiny' data-dm='desc' id='tdDmDescBtn' aria-expanded='false'"
        + " title='Describe a card - its cost, colours, types and stats - and draw one that matches'>"
        + uiIco('filter') + " Describe</button>"
    + "</div>"
    + "<div class='td-dm-desc' id='tdDmDesc' hidden>" + tdRewSpecHTML()
      + "<div class='td-dm-row'>"
        + "<button type='button' class='ed2-btn tiny primary' data-dm='match'>Draw a match</button>"
        + "<span class='td-dm-n' id='tdDmMatchN'></span>"
        + "<span class='tbl-gap'></span>"
        + "<button type='button' class='ed2-btn tiny' data-dm='reset'>Reset</button></div>"
    + "</div>"
    + (role === 'dmp'
        ? tdDmSecHTML('Drawn cards', 'tdDmRow', 'dmrow') + tdDmSecHTML("DM Grave", 'tdDmGrave', 'dmgrave') : '')
    + tdDmSecHTML('Cards left', 'tdDmList', '');
}
function tdDmSecHTML(title, id, zone){
  return "<div class='td-dm-sec'><div class='td-dm-h'>" + e(title) + "</div>"
    + "<div class='td-dm-cards" + (zone ? ' td-dm-drop' : '') + "' id='" + id + "'"
    + (zone ? " data-dmzone='" + zone + "'" : '') + "></div></div>";
}
function tdDmMountDesc(){
  var suf = document.getElementById('tdRewSuf'), stf = document.getElementById('tdRewStf');
  if(suf && !suf.children.length) suf.appendChild(makeSURow(true));
  if(stf && !stf.children.length) stf.appendChild(makeSTRow(true));
}
function tdDmSync(){
  var b = TD.board, win = document.getElementById('tdDmWin');
  if(!b || !win || win.hidden) return;
  var cur = tdDmCur(b), live = tdDmDecks(b);
  TD.dmCur = cur ? cur.id : '';
  var sel = document.getElementById('tdDmSel');
  /* Not while it is open: rebuilt under the pointer, a list shuts. */
  if(sel && document.activeElement !== sel){
    var key = live.map(function(d){ return d.id + ':' + tdDmLeft(b, d.id).length; }).join(',') + '|' + TD.dmCur;
    if(sel._k !== key){
      sel._k = key;
      sel.innerHTML = (live.length ? live.map(function(d){
          return "<option value='" + e(d.id) + "'" + (d.id === TD.dmCur ? ' selected' : '') + ">"
            + e(d.name + ' · ' + tdDmKindWord(d.kind) + ' · ' + tdDmLeft(b, d.id).length) + "</option>";
        }).join('') : "<option value='' selected>No DM decks yet</option>")
        + "<option value='+add'>Bring in more decks&hellip;</option>"
        + (cur ? "<option value='+del'>Put away " + e(cur.name) + "&hellip;</option>" : '');
    }
  }
  var left = cur ? tdDmLeft(b, cur.id) : [];
  var nEl = document.getElementById('tdDmLeftN');
  if(nEl){
    nEl.textContent = cur ? left.length + ' left' : '';
    nEl.className = 'td-dm-n' + (cur && !left.length ? ' none' : '');
  }
  [].forEach.call(win.querySelectorAll("[data-dm='draw'],[data-dm='search'],[data-dm='shuffle'],[data-dm='match']"),
    function(btn){ btn.disabled = !left.length; });
  var desc = document.getElementById('tdDmDesc');
  if(desc && !desc.hidden) tdDmSyncMatch();
  var counts = Object.create(null), names = [];
  left.forEach(function(it){
    var n = it.card ? it.card.name : '';
    if(!n) return;
    if(!counts[n]){ counts[n] = 0; names.push(n); }
    counts[n]++;
  });
  names.sort(function(x, y){ return x.localeCompare(y); });
  tdDmMinis(document.getElementById('tdDmList'),
    names.map(function(n){ return {name:n, count:counts[n]}; }),
    cur ? 'Nothing left in this deck' : 'Bring in a DM deck from the list above');
  if(b.role === 'dmp'){
    var asRows = function(z){
      return ((b.zones && b.zones[z]) || []).filter(function(it){ return !!it.card; })
        .map(function(it){ return {uid:it.uid, name:it.card.name}; });
    };
    tdDmMinis(document.getElementById('tdDmRow'), asRows('dmrow'), 'Drawn cards land here');
    tdDmMinis(document.getElementById('tdDmGrave'), asRows('dmgrave'), 'Empty');
  }
}
function tdDmMinis(host, rows, empty){
  if(!host) return;
  var key = rows.map(function(r){ return (r.uid || '') + '/' + r.name + '/' + (r.count || 1); }).join('|');
  if(host._k === key) return;
  host._k = key;
  host.innerHTML = rows.length ? rows.map(function(r){
    return "<div class='td-dm-mini'" + (r.uid ? " data-uid='" + e(r.uid) + "'" : " data-dmname='" + e(r.name) + "'")
      + " title='" + e(r.name) + "'><div class='td-face' data-card='" + e(r.name) + "'></div>"
      + ((r.count || 1) > 1 ? "<span class='td-rew-tag'>x" + r.count + "</span>" : '') + "</div>";
  }).join('') : "<i class='td-dm-none'>" + e(empty) + "</i>";
  tdLazyFaces(host);
}
/* Delegated, reading data attributes: a deck's or card's name never becomes part of a script (HANDOFF §10). */
function tdDmBind(win){
  win.addEventListener('click', function(ev){
    var t = ev.target && ev.target.closest ? ev.target.closest('[data-dm]') : null;
    if(t && win.contains(t)){
      switch(t.getAttribute('data-dm')){
        case 'draw':     tdDmDraw(); break;
        case 'search':   tdDmSearch(); break;
        case 'shuffle':  tdDmShuffle(); break;
        case 'desc':     tdDmDescToggle(); break;
        case 'match':    tdDmDrawMatch(); break;
        case 'reset':    tdDmDescReset(); break;
        case 'bring':    tdDmBringIn((document.getElementById('tdDmAddIn') || {}).value || ''); break;
        case 'addclose': tdDmAddRow(false); break;
      }
      return;
    }
    /* A removed type row fires no input of its own (tdRewMount). */
    if(ev.target && ev.target.classList && ev.target.classList.contains('sti-x')) setTimeout(tdDmSyncMatch, 0);
  });
  win.addEventListener('change', function(ev){
    var t = ev.target;
    if(t && t.id === 'tdDmSel'){ tdDmSelChange(t); return; }
    if(t && t.closest && t.closest('#tdRewSide')){ tdRewSyncOps(); tdDmSyncMatch(); }
  });
  win.addEventListener('input', function(ev){
    var t = ev.target;
    if(t && t.closest && t.closest('#tdRewSide')){ tdRewSyncOps(); tdDmSyncMatch(); }
  });
  win.addEventListener('contextmenu', function(ev){
    var m = ev.target && ev.target.closest ? ev.target.closest('.td-dm-mini') : null;
    if(!m) return;
    ev.preventDefault();
    ev.stopPropagation();
    if(m.getAttribute('data-uid')) tdOpenMenu(m.getAttribute('data-uid'), ev.clientX, ev.clientY);
    else tdDmListMenu(m.getAttribute('data-dmname') || '', ev.clientX, ev.clientY);
  });
  win.addEventListener('pointerdown', function(ev){
    var m = ev.target && ev.target.closest ? ev.target.closest('.td-dm-mini') : null;
    if(!m || ev.button !== 0) return;
    ev.preventDefault();
    var uid = m.getAttribute('data-uid'), name = m.getAttribute('data-dmname') || m.getAttribute('title') || '';
    tdDmDrag(ev, uid ? {uid:uid, name:name} : {name:name}, {click:function(){
      var c = tdCardByName(name);
      if(c && typeof openMod === 'function') openMod(c);
    }});
  });
}

/* The window is not the board, so the board's drag does not reach it: the same gesture, on listeners of its own. */
function tdDmDrag(ev, src, opts){
  var sx = ev.clientX, sy = ev.clientY, ghost = null;
  var bd = document.getElementById('tdBoard');
  var cw = bd ? parseFloat(getComputedStyle(bd).getPropertyValue('--td-cw')) : 0;
  if(!(cw > 0)) cw = 86;
  var w = Math.round(cw), h = Math.round(cw * RB_CARD_RATIO);
  var place = function(e2){
    ghost.style.left = Math.round(e2.clientX - w / 2) + 'px';
    ghost.style.top = Math.round(e2.clientY - h / 2) + 'px';
  };
  /* The page rolls while the card is held at its edge: on the Encounter page the Field is often below the screen. */
  var roll = 0, rollId = 0;
  var rolling = function(){
    rollId = 0;
    if(!roll || !ghost) return;
    window.scrollBy(0, roll);
    rollId = requestAnimationFrame(rolling);
  };
  var mv = function(e2){
    if(!ghost){
      if(Math.abs(e2.clientX - sx) + Math.abs(e2.clientY - sy) < 5) return;
      ghost = document.createElement('div');
      ghost.className = 'td-card td-ghost';
      ghost.style.width = w + 'px';
      ghost.style.height = h + 'px';
      ghost.innerHTML = "<div class='td-face' data-card='" + e(src.name || '') + "'></div>";
      document.body.appendChild(ghost);
      tdPaintFaces(ghost);
    }
    place(e2);
    var vh = window.innerHeight, edge = 56;
    roll = e2.clientY > vh - edge ? Math.ceil((e2.clientY - (vh - edge)) / 3)
         : (e2.clientY < edge ? -Math.ceil((edge - e2.clientY) / 3) : 0);
    if(roll && !rollId) rollId = requestAnimationFrame(rolling);
  };
  var stop = function(){
    document.removeEventListener('pointermove', mv, true);
    document.removeEventListener('pointerup', up, true);
    document.removeEventListener('pointercancel', cancel, true);
    roll = 0;
    if(rollId){ cancelAnimationFrame(rollId); rollId = 0; }
    var g = ghost;
    ghost = null;
    if(g && g.parentNode) g.parentNode.removeChild(g);
    return !!g;
  };
  var up = function(e2){
    if(!stop()){ if(opts && opts.click) opts.click(); return; }
    tdDmDropped(src, e2.clientX - w / 2, e2.clientY - h / 2, w, h, e2);
  };
  var cancel = function(){ stop(); };
  document.addEventListener('pointermove', mv, true);
  document.addEventListener('pointerup', up, true);
  document.addEventListener('pointercancel', cancel, true);
}
function tdDmRound(n){ return Math.round(n * 100) / 100; }
/* (gx, gy) is the card's corner, as on the board (tdPctIn). */
function tdDmDropped(src, gx, gy, w, h, ev){
  var el = document.elementFromPoint(ev.clientX, ev.clientY);
  if(!el || !el.closest || !TD.board) return;
  /* Alone on the Encounter page the card comes from the deck list and uses nothing up (HANDOFF §84). */
  if(src.put){
    var ef = el.closest('#tdEncBoard .td-zone[data-zone=field]');
    if(!ef || !src.name || !tdCardByName(src.name)) return;
    var p0 = tdPctIn(ef.querySelector('.td-zbody') || ef, gx, gy, w, h);
    tdDo({t:'spawn', zone:'field', uid:tdUid('td'), n:src.name, put:true, x:tdDmRound(p0.x), y:tdDmRound(p0.y)});
    tdRender();
    return;
  }
  if(!tdDmMine()) return;
  var uid = src.uid || '';
  var take = function(){ if(!uid && src.name) uid = tdDmTake(src.name); return uid; };
  var other = el.closest('#tdBoard .rb-other[data-seat]');
  if(other){ if(take()) tdDmGive(uid, other.getAttribute('data-seat')); return; }
  var fld = el.closest('#tdBoard .rb-field');
  if(fld){
    if(!take()) return;
    var p = tdPctIn(fld.querySelector(':scope > .td-zbody') || fld, gx, gy, w, h);
    if(tdMove(uid, 'field', {x:tdDmRound(p.x), y:tdDmRound(p.y), placed:true})) tdDmAfter();
    return;
  }
  var dz = el.closest('#tdDmWin [data-dmzone]')
    || el.closest('#tdBoard .td-zone[data-zone=dmrow], #tdBoard .td-zone[data-zone=dmgrave]');
  if(dz){
    var to = dz.getAttribute('data-dmzone') || dz.getAttribute('data-zone');
    if(!take()) return;
    var at = tdFind(uid);
    if(at && at.zone === to) return;
    if(tdMove(uid, to)) tdDmAfter();
    return;
  }
  if(el.closest('#tdBoard .rb-dmpile')){
    if(!take()) return;
    var at2 = tdFind(uid);
    if(at2 && at2.zone === 'dmdeck') return;
    if(tdMove(uid, 'dmdeck', {dk:tdDmCurId()})) tdDmAfter();
    return;
  }
  if(TD.board.role === 'dmp' && el.closest('#tdBoard .rb-mine .td-handarea, #tdBoard .rb-mine .td-zone[data-zone=hand]')){
    if(!take()) return;
    var at3 = tdFind(uid);
    if(at3 && tdDmIsReward(TD.board, at3.item)) tdDmGive(uid, TD.side);
    else if(typeof toast === 'function') toast(tdRefusedWords(at3 ? at3.item : {dm:true}, 'hand'));
  }
}

/* A map is the DM's cards, not the free counters: those belong to whoever put them down (HANDOFF §84). */
var TD_MAPS_KEY = 'conjure_rb_maps';
/* A map's page of the DM's notes travels in it (cat_rbplay.js), never on the board, which goes to the players. */
var TD_MAP_NOTES_MOST = 50000;
function tdMapName(s){
  return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f]/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 60);
}
function tdMapPct(v){
  return (typeof v === 'number' && isFinite(v)) ? Math.round(Math.max(0, Math.min(100, v)) * 100) / 100 : 4;
}
/* A map can come from a file, so it is read field by field (cat_guard.js). */
function tdMapClean(m){
  if(!m || typeof m !== 'object') return null;
  var name = tdMapName(m.name);
  if(!name) return null;
  var src = Array.isArray(m.cards) ? m.cards.slice(0, 300) : [], at = [], cards = [];
  src.forEach(function(c, i){
    at[i] = -1;
    if(!c || typeof c !== 'object' || typeof c.n !== 'string') return;
    var n = c.n.replace(/[\u0000-\u001f\u007f]/g, ' ').trim().slice(0, 200);
    if(!n) return;
    var o = {n:n, x:tdMapPct(c.x), y:tdMapPct(c.y)};
    if(c.down === true) o.down = true;
    if(c.locked === true) o.locked = true;
    var dg = tgInt(c.dmg, 1, TG_DMG_MOST);
    if(dg) o.dmg = dg;
    at[i] = cards.length;
    cards.push({o:o, on:c.on});
  });
  cards.forEach(function(c, i){
    var on = c.on;
    if(typeof on === 'number' && on >= 0 && on < at.length && at[on] >= 0 && at[on] !== i) c.o.on = at[on];
  });
  cards = cards.map(function(c){ return c.o; });
  /* No card under itself, however far round: a loop is cut where it is found. */
  cards.forEach(function(o, i){
    var j = o.on, steps = 0;
    while(j != null && steps++ <= cards.length){
      if(j === i){ delete o.on; break; }
      j = cards[j].on;
    }
  });
  var toks = (Array.isArray(m.toks) ? m.toks.slice(0, 500) : []).map(function(t){
    if(!t || typeof t !== 'object' || typeof TG_TOKEN_KINDS === 'undefined' || TG_TOKEN_KINDS[t.kind] !== 1) return null;
    if(typeof t.on !== 'number' || t.on < 0 || t.on >= at.length || at[t.on] < 0) return null;
    var o = {kind:t.kind, on:at[t.on]};
    if(typeof t.name === 'string' && t.name) o.name = t.name.replace(/[\u0000-\u001f\u007f]/g, ' ').slice(0, 80);
    if(typeof t.value === 'number' && isFinite(t.value)) o.value = Math.max(-1e6, Math.min(1e6, t.value));
    return o;
  }).filter(Boolean);
  var out = {name:name, cards:cards, toks:toks};
  if(typeof tdGfMapClean === 'function') tdGfMapClean(m, out);
  if(typeof m.notes === 'string' && m.notes) out.notes = m.notes.slice(0, TD_MAP_NOTES_MOST);
  return out;
}
/* Each read field by field, the first of a name kept. */
function tdMapsTidy(list){
  var seen = Object.create(null), out = [];
  (Array.isArray(list) ? list : []).forEach(function(m){
    var c = tdMapClean(m);
    if(!c || seen[c.name.toLowerCase()]) return;
    seen[c.name.toLowerCase()] = 1;
    out.push(c);
  });
  return out;
}
function tdMapsLoadLs(){
  var d = null;
  try{ d = JSON.parse(localStorage.getItem(TD_MAPS_KEY) || 'null'); }catch(_){}
  return tdMapsTidy(d && d.maps);
}
/* The maps are kept in IndexedDB beside their pictures (conjure_rbgrid's 'maps', a record a map under its name in lower
   case) and read once into MAPS.list. What localStorage held is copied over the first time and left as it was, and
   is still where the maps go in a browser that will not open the database. */
var TD_MAPS_MOVED = 'conjure_rb_maps_idb', TD_MAPS_STORE = 'maps';
var MAPS = {list:null, q:null, kept:(typeof WeakSet === 'function') ? new WeakSet() : null};
function tdMapsBoot(){
  if(MAPS.q) return MAPS.q;
  var db0 = (typeof tdGfDb === 'function') ? tdGfDb() : Promise.resolve(null);
  MAPS.q = db0.then(function(db){
    if(!db || !db.objectStoreNames.contains(TD_MAPS_STORE)) return null;
    return tdMapsReadDb(db).then(function(recs){
      if(recs == null) return null;
      var moved = false;
      try{ moved = localStorage.getItem(TD_MAPS_MOVED) === '1'; }catch(_){}
      var list = tdMapsTidy(recs);
      if(!list.length && !moved) list = tdMapsLoadLs();
      MAPS.list = list;
      if(moved){ if(MAPS.kept) list.forEach(function(m){ MAPS.kept.add(m); }); return null; }
      return tdMapsSave(list).then(function(ok){
        if(ok){ try{ localStorage.setItem(TD_MAPS_MOVED, '1'); }catch(_){} }
      });
    });
  }).catch(function(){ return null; }).then(function(){
    if(MAPS.list && TD.board && typeof tdRenderBar === 'function') tdRenderBar();
  });
  return MAPS.q;
}
window.tdMapsBoot = tdMapsBoot;
function tdMapsReadDb(db){
  return new Promise(function(res){
    try{
      var rq = db.transaction(TD_MAPS_STORE, 'readonly').objectStore(TD_MAPS_STORE).getAll();
      rq.onsuccess = function(){ res((rq.result || []).map(function(r){ return r && r.m; })); };
      rq.onerror = function(){ res(null); };
    }catch(_){ res(null); }
  });
}
/* The whole list in one transaction: a record no longer in it is taken out, and only a changed one written. */
function tdMapsSave(list){
  var db0 = (typeof tdGfDb === 'function') ? tdGfDb() : Promise.resolve(null);
  return db0.then(function(db){
    if(!db || !db.objectStoreNames.contains(TD_MAPS_STORE)) return false;
    return new Promise(function(res){
      try{
        var tx = db.transaction(TD_MAPS_STORE, 'readwrite'), st = tx.objectStore(TD_MAPS_STORE), want = Object.create(null);
        list.forEach(function(m){
          var k = m.name.toLowerCase();
          want[k] = 1;
          if(MAPS.kept && MAPS.kept.has(m)) return;
          st.put({k:k, m:m});
        });
        var keys = st.getAllKeys();
        keys.onsuccess = function(){ (keys.result || []).forEach(function(k){ if(!want[k]) st.delete(k); }); };
        tx.oncomplete = function(){ if(MAPS.kept) list.forEach(function(m){ MAPS.kept.add(m); }); res(true); };
        tx.onerror = function(){ res(false); };
        tx.onabort = function(){ res(false); };
      }catch(_){ res(false); }
    });
  }, function(){ return false; });
}
function tdMapsLoad(){
  if(MAPS.list) return MAPS.list.slice();
  tdMapsBoot();
  return tdMapsLoadLs();
}
window.tdMapsLoad = tdMapsLoad;
function tdMapsWrite(list){
  var no = function(){
    if(typeof toast === 'function') toast('This browser would not save the maps (its storage is full or blocked)');
    return false;
  };
  if(!MAPS.list){
    try{ localStorage.setItem(TD_MAPS_KEY, JSON.stringify({v:1, maps:list})); return true; }
    catch(_){ return no(); }
  }
  MAPS.list = list.slice();
  tdMapsSave(MAPS.list).then(function(ok){ if(!ok) no(); });
  return true;
}
function tdMapFind(name){
  var k = tdMapName(name).toLowerCase();
  return tdMapsLoad().filter(function(m){ return m.name.toLowerCase() === k; })[0] || null;
}
function tdMapsHere(){
  if(!REBIRTH || !TD.board || TD.watching) return false;
  if(tdIsEncounter()) return !(typeof tblAtTable === 'function' && tblAtTable());
  return tdDmMine() && tdRbOn();
}
/* A card nobody placed is saved where the screen shows it (tdRbLayout at a table, tdReflowFree alone). */
function tdMapNow(){
  var b = TD.board, table = tdRbOn();
  var items = ((b && b.zones && b.zones.field) || []).filter(function(it){
    return !!it.card && !it.anon && (!table || it.dm);
  });
  var idx = Object.create(null);
  items.forEach(function(it, i){ idx[it.uid] = i; });
  var spots = table ? tdRbLayout(tdRbFieldBoards(), null).at : null;
  var host = table ? null : document.querySelector('#tdEncBoard .td-zone[data-zone=field]');
  var spot = function(it){
    if(spots && spots[it.uid]) return spots[it.uid];
    if(it.auto !== false && host){
      var el = host.querySelector('.td-card' + tdSel(it.uid));
      var g = el && el.parentNode && el.parentNode.classList && el.parentNode.classList.contains('td-group') ? el.parentNode : el;
      var x = g ? parseFloat(g.style.left) : NaN, y = g ? parseFloat(g.style.top) : NaN;
      if(isFinite(x) && isFinite(y)) return {x:x, y:y};
    }
    return {x:it.x == null ? 4 : it.x, y:it.y == null ? 4 : it.y};
  };
  var cards = items.map(function(it){
    var c = {n:it.card.name};
    if(it.down) c.down = true;
    if(it.locked) c.locked = true;
    if(it.dmg) c.dmg = it.dmg;
    if(it.connectedTo && idx[it.connectedTo] != null){ c.on = idx[it.connectedTo]; return c; }
    var p = spot(it);
    c.x = tdMapPct(p.x); c.y = tdMapPct(p.y);
    return c;
  });
  var toks = ((b && b.tokens) || []).filter(function(t){ return t.on && idx[t.on] != null; }).map(function(t){
    var o = {kind:t.kind, on:idx[t.on]};
    if(t.name) o.name = t.name;
    if(typeof t.value === 'number') o.value = t.value;
    return o;
  });
  var out = {cards:cards, toks:toks};
  if(typeof tdGfMapNow === 'function') tdGfMapNow(out, idx);
  if(typeof tdNotesPage === 'function'){ var nt = tdNotesPage(); if(nt) out.notes = nt; }
  return out;
}
function tdMapFreeName(base){
  var have = Object.create(null);
  tdMapsLoad().forEach(function(m){ have[m.name.toLowerCase()] = 1; });
  for(var i = 1; i < 10000; i++){
    var n = base + ' ' + i;
    if(!have[n.toLowerCase()]) return n;
  }
  return base + ' ' + Date.now();
}
function tdMapPut(name, now){
  var k = name.toLowerCase();
  var list = tdMapsLoad().filter(function(m){ return m.name.toLowerCase() !== k; });
  var rec = {name:name};
  Object.keys(now).forEach(function(f){ if(f !== 'name' && f !== 'held') rec[f] = now[f]; });
  list.push(rec);
  if(!tdMapsWrite(list)) return false;
  if(typeof tdNotesKept === 'function') tdNotesKept(k);
  return true;
}
/* Switching away saves the map that was down, so nothing laid out is lost (HANDOFF §84). */
function tdMapKeep(){
  var b = TD.board;
  if(!b) return '';
  var now = tdMapNow(), name = b.map || '';
  if(!name){
    var any = now.cards.length || now.grid || now.held || now.notes
      || ['gtoks', 'gter', 'gedge', 'gfog', 'glines', 'gareas'].some(function(f){ return now[f] && now[f].length; });
    if(!any) return '';
    name = tdMapFreeName('Unsaved map');
  }
  return tdMapPut(name, now) ? name : '';
}
function tdMapAct(m){
  var uids = (m.cards || []).map(function(){ return tdUid('td'); });
  var cards = (m.cards || []).map(function(c, i){
    var o = {uid:uids[i], n:c.n};
    if(c.down) o.down = true;
    if(c.locked) o.locked = true;
    if(c.dmg) o.dmg = c.dmg;
    if(c.on != null && uids[c.on]) o.on = uids[c.on];
    else { o.x = tdMapPct(c.x); o.y = tdMapPct(c.y); }
    return o;
  });
  var toks = (m.toks || []).filter(function(t){ return !!uids[t.on]; }).map(function(t){
    var o = {uid:tdUid('tk'), kind:t.kind, on:uids[t.on]};
    if(t.name) o.name = t.name;
    if(typeof t.value === 'number') o.value = t.value;
    return o;
  });
  var act = {t:'map', name:m.name, all:!tdRbOn(), cards:cards, toks:toks};
  return (typeof tdGfMapActOf === 'function') ? tdGfMapActOf(m, act) : act;
}
/* A map is not an action the others hear (tblRedact): it reaches them in the DM's state. */
function tdMapShow(){
  tdRender();
  if(tdRbOn() && typeof tblSendState === 'function') tblSendState();
}
function tdMapSwitch(name){
  tdCloseMore();
  if(!tdMapsHere()) return false;
  var m = tdMapFind(name);
  var say = function(w){ if(typeof toast === 'function') toast(w); };
  if(!m){ say('There is no map called ' + name); return false; }
  if((TD.board.map || '').toLowerCase() === m.name.toLowerCase()){ say(m.name + ' is the map on the Field'); return false; }
  var kept = tdMapKeep();
  if(typeof tdGfMapSwitching === 'function') tdGfMapSwitching(kept, m.name);
  tdDo(tdMapAct(m));
  tdMapShow();
  say('The map is ' + m.name + (kept ? ' - ' + kept + ' was saved as it was' : ''));
  return true;
}
window.tdMapSwitch = tdMapSwitch;
function tdMapSaveNew(){
  if(!tdMapsHere()) return false;
  var raw = prompt('Name this map', TD.board.map ? TD.board.map + ' (copy)' : tdMapFreeName('Map'));
  if(raw == null) return false;
  var name = tdMapName(raw);
  if(!name){ if(typeof toast === 'function') toast('A map needs a name'); return false; }
  var was = tdMapFind(name);
  if(was && was.name.toLowerCase() !== (TD.board.map || '').toLowerCase()
     && !confirm('There is already a map called ' + was.name + '.\n\nReplace it with the cards on the Field now?'))
    return false;
  if(!tdMapPut(name, tdMapNow())) return false;
  var gfWas = TD.board.map || '';
  if(TD.board.map !== name) tdDo({t:'map', name:name, keep:true});
  if(typeof tdGfRetag === 'function') tdGfRetag(gfWas, name);
  tdMapShow();
  if(typeof toast === 'function') toast('Saved the map ' + name);
  return true;
}
window.tdMapSaveNew = tdMapSaveNew;
function tdMapSaveCur(){
  if(!tdMapsHere() || !TD.board.map) return false;
  if(!tdMapPut(TD.board.map, tdMapNow())) return false;
  tdRenderBar();
  if(typeof toast === 'function') toast('Saved the changes to ' + TD.board.map);
  return true;
}
window.tdMapSaveCur = tdMapSaveCur;
function tdMapDelete(name){
  tdCloseMore();
  var m = tdMapFind(name);
  if(!m || !confirm('Delete the map ' + m.name + '?\n\nThis cannot be undone. The cards on the Field stay where they are.'))
    return false;
  var k = m.name.toLowerCase();
  if(!tdMapsWrite(tdMapsLoad().filter(function(x){ return x.name.toLowerCase() !== k; }))) return false;
  if(TD.board && (TD.board.map || '').toLowerCase() === k && tdMapsHere()){
    tdDo({t:'map', name:'', keep:true});
    if(typeof tdGfRetag === 'function') tdGfRetag(m.name, '');
    tdMapShow();
  } else {
    if(typeof tdGfMapGone === 'function') tdGfMapGone(m.name);
    tdRenderBar();
  }
  if(typeof toast === 'function') toast('Deleted the map ' + m.name);
  return true;
}
function tdMapExport(){
  var maps = tdMapsLoad();
  if(!maps.length){ if(typeof toast === 'function') toast('There are no maps to save yet'); return false; }
  /* With the pictures under them, which are in this browser alone (cat_rbgrid.js). */
  var save = function(pics){
    var d = {kind:'conjure-maps', v:1, maps:maps};
    if(pics && Object.keys(pics).length) d.pics = pics;
    tdSaveAs(JSON.stringify(d, null, 1), 'conjure-maps-' + tdStamp() + '.json', 'application/json');
  };
  if(typeof tdGfPicsOf === 'function') tdGfPicsOf(maps, save); else save(null);
  return true;
}
window.tdMapExport = tdMapExport;
function tdMapImport(){
  var inp = document.createElement('input');
  inp.type = 'file';
  inp.accept = '.json,application/json';
  inp.addEventListener('change', function(){
    var f = inp.files && inp.files[0];
    if(!f) return;
    var rd = new FileReader();
    rd.onload = function(){ tdMapImportText(String(rd.result || '')); };
    rd.readAsText(f);
  });
  inp.click();
}
window.tdMapImport = tdMapImport;
function tdMapImportText(text){
  var d = null;
  try{ d = JSON.parse(text); }catch(_){}
  var list = (d && Array.isArray(d.maps)) ? d.maps : ((d && d.name && Array.isArray(d.cards)) ? [d] : []);
  var maps = list.slice(0, 500).map(tdMapClean).filter(Boolean);
  var say = function(w){ if(typeof toast === 'function') toast(w); };
  if(!maps.length){ say('That file has no maps in it'); return false; }
  var have = tdMapsLoad(), names = Object.create(null);
  have.forEach(function(m){ names[m.name.toLowerCase()] = 1; });
  var clash = maps.filter(function(m){ return names[m.name.toLowerCase()]; });
  if(clash.length && !confirm((clash.length === 1 ? 'A map called ' + clash[0].name + ' is'
        : clash.length + ' of these maps are') + ' already saved here.\n\nReplace '
        + (clash.length === 1 ? 'it' : 'them') + ' with the ones in the file?'))
    return false;
  maps.forEach(function(m){
    var k = m.name.toLowerCase();
    have = have.filter(function(x){ return x.name.toLowerCase() !== k; });
    have.push(m);
  });
  if(!tdMapsWrite(have)) return false;
  if(typeof tdGfPicsIn === 'function' && d && d.pics) tdGfPicsIn(d.pics);
  tdRenderBar();
  say(maps.length === 1 ? 'Loaded the map ' + maps[0].name + ' - it is in Save / Load'
                        : 'Loaded ' + maps.length + ' maps - they are in Save / Load');
  return true;
}
window.tdMapImportText = tdMapImportText;
function tdMapsMenuPart(alone){
  if(!tdMapsHere()) return '';
  var cur = (TD.board.map || '').toLowerCase();
  var maps = tdMapsLoad().sort(function(a, b){ return a.name.toLowerCase() < b.name.toLowerCase() ? -1 : 1; });
  var item = function(label, act){
    return "<button class='td-moreitem' role='menuitem' onclick='tdCloseMore();" + act + "()'>" + label + "</button>";
  };
  return (alone ? '' : "<div class='td-moresep' role='separator'></div>")
    + "<div class='td-morehead'>Maps</div>"
    + (maps.length ? "<div class='td-maplist'>" + maps.map(function(m){
        var on = m.name.toLowerCase() === cur, nm = e(m.name);
        return "<div class='td-mapitem" + (on ? ' on' : '') + "'>"
          + "<button class='td-moreitem td-mapopen' role='menuitem' data-map='" + nm + "'"
          + (on ? " aria-current='true'" : '') + ">"
          + "<canvas class='td-mapthumb' data-mapthumb='" + nm + "' aria-hidden='true'></canvas>"
          + "<span class='td-mapname'>" + nm
          + "<small>" + m.cards.length + (m.cards.length === 1 ? ' card' : ' cards')
          + (on ? ' &middot; on the Field now' : '') + "</small></span></button>"
          + "<button class='td-mapact' data-mapren='" + nm + "' title='Rename'"
          + " aria-label='" + e('Rename the map ' + m.name) + "'>" + uiIco('pen') + "</button>"
          + "<button class='td-mapact' data-mapdup='" + nm + "' title='Duplicate'"
          + " aria-label='" + e('Duplicate the map ' + m.name) + "'>" + uiIco('copy') + "</button>"
          + "<button class='td-mapdel' data-mapdel='" + nm + "'"
          + " title='" + e('Delete the map ' + m.name) + "' aria-label='" + e('Delete the map ' + m.name) + "'>&#10005;</button>"
          + "</div>";
      }).join('') + "</div>"
      : "<div class='td-morenone'>No maps saved yet</div>")
    + item('Save as new map&hellip;', 'tdMapSaveNew')
    + (TD.board.map ? item('Save changes to ' + e(TD.board.map), 'tdMapSaveCur') : '')
    + item('Save maps to file&hellip;', 'tdMapExport')
    + item('Load maps from file&hellip;', 'tdMapImport');
}
/* A new name for a saved map: the one on the Field takes it too, and so do the players' tokens left on it. */
function tdMapRename(name){
  tdCloseMore();
  if(!tdMapsHere()) return false;
  var m = tdMapFind(name), say = function(w){ if(typeof toast === 'function') toast(w); };
  if(!m) return false;
  var raw = prompt('Rename the map', m.name);
  if(raw == null) return false;
  var nn = tdMapName(raw), k = m.name.toLowerCase();
  if(!nn){ say('A map needs a name'); return false; }
  if(nn === m.name) return false;
  var was = tdMapFind(nn);
  if(was && was.name.toLowerCase() !== k){ say('There is already a map called ' + was.name); return false; }
  var rec = {};
  Object.keys(m).forEach(function(f){ rec[f] = m[f]; });
  rec.name = nn;
  if(!tdMapsWrite(tdMapsLoad().map(function(x){ return x.name.toLowerCase() === k ? rec : x; }))) return false;
  if(typeof tdNotesRenamed === 'function') tdNotesRenamed(m.name, nn);
  if(typeof tdGfRetag === 'function') tdGfRetag(m.name, nn);
  if((TD.board.map || '').toLowerCase() === k){
    tdDo({t:'map', name:nn, keep:true});
    tdMapShow();
  } else tdRenderBar();
  say('Renamed the map to ' + nn);
  return true;
}
window.tdMapRename = tdMapRename;
function tdMapCopyName(base){
  var have = Object.create(null), b = base.slice(0, 46);
  tdMapsLoad().forEach(function(m){ have[m.name.toLowerCase()] = 1; });
  var n = b + ' (copy)';
  for(var i = 2; have[n.toLowerCase()] && i < 1000; i++) n = b + ' (copy ' + i + ')';
  return n;
}
/* The whole map under a new name, its page of notes too; nothing on the Field changes. */
function tdMapDuplicate(name){
  tdCloseMore();
  if(!tdMapsHere()) return false;
  var m = tdMapFind(name), say = function(w){ if(typeof toast === 'function') toast(w); };
  if(!m) return false;
  var raw = prompt('Name the copy', tdMapCopyName(m.name));
  if(raw == null) return false;
  var nn = tdMapName(raw);
  if(!nn){ say('A map needs a name'); return false; }
  var was = tdMapFind(nn);
  if(was){ say('There is already a map called ' + was.name); return false; }
  var rec = JSON.parse(JSON.stringify(m));
  rec.name = nn;
  if(!tdMapsWrite(tdMapsLoad().concat([rec]))) return false;
  tdRenderBar();
  say('Copied ' + m.name + ' as ' + nn);
  return true;
}
window.tdMapDuplicate = tdMapDuplicate;
/* Backup (ed2_tools.js): every saved map, with the DM's Master notes; the pictures go beside them in the zip. */
function tdMapsForBackup(){
  var out = {v:1, maps:tdMapsLoad()};
  if(typeof tdNotesForBackup === 'function') tdNotesForBackup(out);
  return (out.maps.length || out.master) ? out : null;
}
window.tdMapsForBackup = tdMapsForBackup;
/* A restore adds, as it does a saved look: a map of the backup's replaces the one of its name here, and the rest stay. */
function tdMapsRestore(rb, pics){
  if(!rb || typeof rb !== 'object') return Promise.resolve(0);
  return tdMapsBoot().then(function(){
    var maps = tdMapsTidy(rb.maps), names = Object.create(null);
    maps.forEach(function(m){ names[m.name.toLowerCase()] = 1; });
    if(maps.length) tdMapsWrite(tdMapsLoad().filter(function(x){ return !names[x.name.toLowerCase()]; }).concat(maps));
    if(pics && typeof tdGfPicsIn === 'function') tdGfPicsIn(pics);
    if(typeof tdNotesRestore === 'function') tdNotesRestore(rb);
    if(TD.board && typeof tdRenderBar === 'function') tdRenderBar();
    return maps.length;
  });
}
window.tdMapsRestore = tdMapsRestore;
function tdMapChipHTML(){
  if(typeof tdRbOn !== 'function' || !tdRbOn()) return '';
  var b = tdDmBoard(), m = b && b.map;
  return m ? "<span class='tbl-chip rb-cmap' title='" + e('The map on the Field: ' + m) + "'>Map <b>"
    + e(m) + "</b></span>" : '';
}
function tdMapHeard(side, prev){
  var now = tdFoeOf(side);
  /* a player taking over as the DM brings the map with them: that is said once, as the hand-over (cat_rbplay.js) */
  if(!prev || !tdRbIsDm(now) || !tdRbIsDm(prev)) return;
  var was = prev.map || '', is = now.map || '';
  if(was === is) return;
  var ids = function(bd){
    return ((bd.zones && bd.zones.field) || []).filter(function(it){ return it.dm; })
      .map(function(it){ return it.uid; }).sort().join(',');
  };
  var who = now.name || tblSeatName(side);
  if(is && ids(prev) !== ids(now)){
    tblFeedAs('them', 'switched the map to ' + is, who);
    if(typeof toast === 'function') toast(who + ' switched the map to ' + is);
  } else tblFeedAs('them', is ? 'named the map ' + is : 'cleared the map name', who);
}

(function(){
  if(window._tdDmBound) return;
  window._tdDmBound = true;
  document.addEventListener('click', function(ev){
    var t = ev.target && ev.target.closest ? ev.target : null;
    if(!t) return;
    var del = t.closest('[data-mapdel]');
    if(del){ ev.stopPropagation(); tdMapDelete(del.getAttribute('data-mapdel') || ''); return; }
    var ren = t.closest('[data-mapren]');
    if(ren){ ev.stopPropagation(); tdMapRename(ren.getAttribute('data-mapren') || ''); return; }
    var dup = t.closest('[data-mapdup]');
    if(dup){ ev.stopPropagation(); tdMapDuplicate(dup.getAttribute('data-mapdup') || ''); return; }
    var mp = t.closest('[data-map]');
    if(mp){ tdMapSwitch(mp.getAttribute('data-map') || ''); return; }
    var pile = t.closest('#tdBoard .rb-dmpile');
    if(pile && !t.closest('.td-card') && tdDmMine()) tdDmToolsOpen(true);
  });
  document.addEventListener('pointerdown', function(ev){
    if(ev.button !== 0) return;
    var m = ev.target && ev.target.closest ? ev.target.closest('#tdRewCat .td-rew-mini') : null;
    if(!m || !tdIsEncounter() || !TD.board || !TD.board.zones.field || TD.watching) return;
    ev.preventDefault();
    tdDmDrag(ev, {name:m.getAttribute('data-name') || '', put:true}, null);
  }, true);
  /* the saved maps read in as the page opens, so the list is whole the first time the DM looks */
  if(typeof REBIRTH !== 'undefined' && REBIRTH) setTimeout(function(){ try{ tdMapsBoot(); }catch(_){} }, 0);
})();
