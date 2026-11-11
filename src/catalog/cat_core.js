<script>
/* The first catalog slice, after all the markup: cat_tail.js closes the <script> opened above, and every cat_*.js shares its one global scope (HANDOFF §4). */
function uiIco(name){
  return "<svg class='ico' aria-hidden='true'><use href='#i-" + name + "'/></svg>";
}
/* Rebirth: a second game sharing every feature and no data, in a database of its own, so conjure_editor is never touched (HANDOFF §0).
   Its flag is in localStorage, not a database, because it chooses which database opens (DB, ed2_core.js). */
/* ?game= is read from the query, never the hash, which holds the deck and the browse filters.
   Only "main" and "rebirth" answer: an unknown value falls through, so a typo never moves anyone out of Rebirth. */
function _modeFromUrl(){
  try{
    var m = /[?&]game=(main|rebirth)(?:&|$)/i.exec(location.search || '');
    return m ? m[1].toLowerCase() : null;
  }catch(_){ return null; }
}

/* The address without the named params, or null if none was there; the hash is kept, as it holds the deck and the browse filters. */
function _urlWithout(names){
  try{
    var s = location.search || '';
    var re = new RegExp('([?&])(?:' + names.join('|') + ')=[^&]*(?:&|$)', 'ig');
    if(!re.test(s)) return null;
    s = s.replace(re, '$1').replace(/[?&]$/, '');
    if(s === '?') s = '';
    return location.pathname + s + (location.hash || '');
  }catch(_){ return null; }
}
window._urlWithout = _urlWithout;

var REBIRTH = (function(){
  var fromUrl = _modeFromUrl();
  if(fromUrl){
    /* Saved, not applied once: ?game=rebirth must act as the switch does, or the next load without it drops back to the main game. */
    try{ localStorage.setItem('conjure_mode', fromUrl); }catch(_){}
    return fromUrl === 'rebirth';
  }
  try{ return localStorage.getItem('conjure_mode')==='rebirth'; }catch(_){ return false; }
})();
try{ document.body.classList.toggle('rebirth', REBIRTH); }catch(_){}
window.REBIRTH = REBIRTH;
try{ var _rbT=document.getElementById('rebirthToggle'); if(_rbT)_rbT.checked=REBIRTH; }catch(_){}
/* Reloads rather than swapping in place: a half-swapped state is how one game's cards get written into the other's store. */
window.setRebirth = function(on){
  /* Each game keeps its own deck lists (cat_deck.js): this game's are put by and the other's put in the address, for the
     reload to load (the author, 9 November). */
  if(!!on !== REBIRTH && typeof _deckListsPark === 'function') _deckListsPark(!!on);
  try{ localStorage.setItem('conjure_mode', on?'rebirth':'main'); }catch(_){}
  /* The param must go: the reload reads the address before localStorage, so ?game=rebirth left in the bar would undo the switch. */
  /* and ?open=, so the switch does not reopen a document already closed */
  var clean = _urlWithout(['game', 'open']);
  if(clean === null){ location.reload(); return; }
  /* location.replace is the fallback where replaceState is refused (some browsers, on file://), and reloads by itself. */
  try{ history.replaceState(null, '', clean); location.reload(); }
  catch(_){ location.replace(clean); }
};

/* #jdata stays [] (HANDOFF §12.1 H): the cards arrive through the open-time sync, and without the element this line throws. */
var BASE_CARDS = JSON.parse(document.getElementById('jdata').textContent);
var RB_SEED = (function(){
  try{ return JSON.parse(document.getElementById('rbseeddata').textContent)||{}; }
  catch(_){ return {}; }
})();
window.RB_SEED = RB_SEED;
/* Rebirth starts with copies of the seven Core Essences, as a Character deck's Level seeds one per mana letter (tdCoreEssenceByColor).
   They go in a saga of Rebirth's own: "Beginnings" is BUILTIN_SAGA, which would make them Official and offer the main game's sync. */
var REBIRTH_SEED_SAGA = 'Core Essence';
function rebirthSeedCards(){
  var out = [];
  (RB_SEED.seed || []).forEach(function(c){
    var sup = (c && c.superTypes) || [];
    if(sup.indexOf('Core') < 0 || sup.indexOf('Essence') < 0) return;
    var n;
    try{ n = JSON.parse(JSON.stringify(c)); }catch(_){ return; }
    n.saga = REBIRTH_SEED_SAGA;
    delete n.sagaId; delete n.sagaIds; delete n.shared;
    /* Identity is assigned by this game. ensureIds() gives them fresh ones. */
    delete n.__id; delete n.id;
    out.push(n);
  });
  return out;
}
/* A copy, not BASE_CARDS itself, or every card the sync imports would land in the "baked" list too. */
var CARDS  = REBIRTH ? rebirthSeedCards() : BASE_CARDS.slice();
/* Counts every change to the card data: a cache keyed on CARDS.length alone survives a rename, so every such cache keys on CARD_GEN too. */
window.CARD_GEN = (window.CARD_GEN || 0) + 1;
window.BASE_CARDS = BASE_CARDS;
var CICO   = JSON.parse(document.getElementById('idata').textContent);
var CHEX   = JSON.parse(document.getElementById('hexdata').textContent);
var MLTR   = JSON.parse(document.getElementById('mltrdata').textContent);
var NICONS = JSON.parse(document.getElementById('ndata').textContent);
var COLORS = ['Red','Orange','Yellow','Green','Blue','Indigo','Violet'];
var ROYGBIV= ['Red','Orange','Yellow','Green','Blue','Indigo','Violet'];
/* Fills the markup's data-mana swatches from CICO at parse time, not in boot() (ed2_boot.js), so none ever paints blank. */
[].forEach.call(document.querySelectorAll('img[data-mana]'), function(im){
  var u = CICO[im.getAttribute('data-mana')];
  if(u) im.src = u;
});
/* The one pip counter (Build Deck, Deck Lists, the editor's statistics): separate ones gave one deck different answers.
   A hybrid is half a pip to each colour, a trybrid a third; keyed by colour name, with L (Lock) too unless filtered through COLORS. */
function manaPips(mc, weight){
  var out={}, s=String(mc||'').replace(/\s/g,''), w=(weight==null?1:weight), i=0;
  while(i<s.length){
    var ch=s[i].toUpperCase();
    if(ch>='0'&&ch<='9'){ i++; continue; }
    if(ch==='X'){ i++; continue; }
    if(i+2<s.length&&s[i+1]==='/'){
      var got=[], j=i;
      while(j<s.length){
        var hk=s[j].toUpperCase(), hc=MLTR[hk];
        if(!hc)break;
        got.push(hc);
        if(j+1<s.length&&s[j+1]==='/')j+=2; else { j++; break; }
      }
      if(got.length>=2){
        var share=w/got.length;
        got.forEach(function(c){ out[c]=(out[c]||0)+share; });
        i=j; continue;
      }
    }
    var clr=MLTR[ch];
    if(clr) out[clr]=(out[clr]||0)+w;
    i++;
  }
  return out;
}
window.manaPips = manaPips;

var cur = null;
var _visibleCards = [];
var _manaCache = {};

/* The only deck list grammar: every reader and writer of a deck textarea goes through these, as separate regexes read one text differently.
   A Lord line ("Lx Name") is one card; deckMainCount is the one place that leaves it out of the Main Deck size. */
var DECK_MAX_COPIES = 99;

function deckNormName(n){
  return String(n == null ? '' : n).toLowerCase()
    .replace(/[—–]/g, '-')
    .replace(/[‘’“”]/g, '')
    .replace(/[^a-z0-9 -]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function parseDeckLine(raw){
  var line = String(raw == null ? '' : raw).trim();
  if(!line) return null;
  if(line.charAt(0) === '#') return null;
  if(line.slice(0, 2) === '//') return null;
  if(/^SB:/i.test(line)) return null;
  var count = 1, name = line, m, lord = false;
  if((m = line.match(/^[Ll][xX]\s+(.+)$/)))        { lord = true; name = m[1]; }
  else if((m = line.match(/^(\d+)[xX]\s+(.+)$/)))  { count = parseInt(m[1], 10); name = m[2]; }
  else if((m = line.match(/^(\d+)\s+(.+)$/)))      { count = parseInt(m[1], 10); name = m[2]; }
  else if((m = line.match(/^(.+)\s+[xX](\d+)$/)))  { count = parseInt(m[2], 10); name = m[1]; }
  name = name.replace(/\s*[\(\[][A-Z0-9]{2,5}[\)\]]\s*$/, '').trim();
  if(!name) return null;
  if(!isFinite(count) || count < 1) count = 1;
  if(count > DECK_MAX_COPIES) count = DECK_MAX_COPIES;
  var out = {name:name, count:count};
  if(lord) out.lord = true;
  return out;
}

/* A Rebirth Character's Level, Attack, Health and Arcane ride in the list as lines: "RRBBB LVL", "4 ATK", "30 HP", "50 MP".
   parseDeckLines must skip them: "4 ATK" is also a valid card line, and would count four cards that do not exist. */
var DECK_STAT_ORDER = ['lvl', 'atk', 'hp', 'mp'];
var DECK_STAT_LABEL = {lvl:'LVL', atk:'ATK', hp:'HP', mp:'MP'};
var DECK_STAT_RE = /^\s*(\S+)\s+(LVL|ATK|HP|MP)\s*$/i;

function deckStatLine(raw){
  var m = DECK_STAT_RE.exec(String(raw == null ? '' : raw));
  return m ? {key:m[2].toLowerCase(), value:m[1]} : null;
}
function deckStatsFromText(text){
  var out = {};
  String(text == null ? '' : text).split(/\r?\n/).forEach(function(raw){
    var s = deckStatLine(raw);
    if(s) out[s.key] = s.value;
  });
  return out;
}
function deckStatsToLines(row){
  if(!row) return '';
  return DECK_STAT_ORDER.filter(function(k){
    return row[k] != null && String(row[k]).trim() !== '';
  }).map(function(k){
    return String(row[k]).trim() + ' ' + DECK_STAT_LABEL[k];
  }).join('\n');
}
function deckTextWithoutStats(text){
  return String(text == null ? '' : text).split(/\r?\n/)
    .filter(function(raw){ return !deckStatLine(raw); }).join('\n').replace(/^\n+/, '');
}
function deckTextWithStats(text, row){
  var head = deckStatsToLines(row), body = deckTextWithoutStats(text);
  if(!head) return body;
  return head + (body.trim() ? '\n' + body : '');
}
window.deckStatsFromText = deckStatsFromText;
window.deckStatsToLines = deckStatsToLines;
window.deckTextWithStats = deckTextWithStats;
window.deckTextWithoutStats = deckTextWithoutStats;

// Per-line counts are clamped to DECK_MAX_COPIES; a merged total is not, so 60x + 60x reads as 120.
function parseDeckLines(text, opts){
  var merge = !(opts && opts.merge === false);
  var out = [], seen = {};
  String(text == null ? '' : text).split(/\r?\n/).forEach(function(raw){
    if(deckStatLine(raw)) return;
    var ent = parseDeckLine(raw); if(!ent) return;
    if(merge && seen[ent.name] !== undefined){
      out[seen[ent.name]].count += ent.count;
      if(ent.lord) out[seen[ent.name]].lord = true;
      return;
    }
    if(merge) seen[ent.name] = out.length;
    out.push(ent);
  });
  return out;
}

/* Names come back in the catalog's spelling ("fire bolt" -> "Fire Bolt") and merged, so every feature accepts what Import does.
   A name no card answers to is kept as typed; opts.raw keeps every name as typed. */
function parseDeckIn(id, opts){
  var el = document.getElementById(id);
  if(!el) return [];
  var list = parseDeckLines(el.value, opts);
  return (opts && opts.raw) ? list : deckCanonEntries(list, !(opts && opts.merge === false));
}

/* Rebuilt when CARDS or CARD_GEN changes; null-prototype maps, so a typed "constructor" is never a card. */
var _deckCanonM = null, _deckCanonKey = '', _deckCanonOf = null;
function _deckCanonMaps(){
  var all = (typeof CARDS !== 'undefined' && CARDS) || [];
  var key = all.length + '|' + (window.CARD_GEN || 0);
  if(!_deckCanonM || _deckCanonKey !== key || _deckCanonOf !== all){
    var exact = Object.create(null), loose = Object.create(null);
    all.forEach(function(c){
      if(!c || c.name == null) return;
      var n = String(c.name);
      exact[n.toLowerCase()] = n;
      var l = deckNormName(n);
      if(l) loose[l] = n;
    });
    _deckCanonM = {exact:exact, loose:loose}; _deckCanonKey = key; _deckCanonOf = all;
  }
  return _deckCanonM;
}
function deckCanonName(name){
  var s = String(name == null ? '' : name).trim();
  if(!s) return null;
  var m = _deckCanonMaps();
  return m.exact[s.toLowerCase()] || m.loose[deckNormName(s)] || null;
}
window.deckCanonName = deckCanonName;
function deckCanonEntries(list, merge){
  var out = [], seen = Object.create(null);
  (list || []).forEach(function(en){
    var name = deckCanonName(en.name) || en.name;
    if(merge && seen[name] !== undefined){
      out[seen[name]].count += en.count;
      if(en.lord) out[seen[name]].lord = true;
      return;
    }
    if(merge) seen[name] = out.length;
    var row = {name:name, count:en.count};
    if(en.lord) row.lord = true;
    out.push(row);
  });
  return out;
}
function deckCanonText(text){
  var src = String(text == null ? '' : text), changed = false;
  var lines = src.split('\n').map(function(line){
    if(deckStatLine(line)) return line;
    var ent = parseDeckLine(line); if(!ent) return line;
    var canon = deckCanonName(ent.name);
    if(!canon || canon === ent.name) return line;
    var at = line.indexOf(ent.name);
    if(at < 0) return line;
    changed = true;
    return line.slice(0, at) + canon + line.slice(at + ent.name.length);
  });
  return changed ? lines.join('\n') : src;
}
window.deckCanonText = deckCanonText;

function resolveDeckEntries(entries){
  var out = [], seen = Object.create(null), unmatched = [];
  (entries || []).forEach(function(en){
    var canon = deckCanonName(en.name);
    if(!canon){ unmatched.push(en.name); return; }
    if(seen[canon] !== undefined){
      out[seen[canon]].count += en.count;
      if(en.lord) out[seen[canon]].lord = true;
      return;
    }
    seen[canon] = out.length;
    var row = {name:canon, count:en.count};
    if(en.lord) row.lord = true;
    out.push(row);
  });
  return {entries:out, unmatched:unmatched};
}

function deckIsLord(entry){ return !!(entry && entry.lord && entry.count === 1); }
function deckCountText(entry){
  return deckIsLord(entry) ? 'Lx' : ((entry ? entry.count : 0) + 'x');
}
/* In a lord:true deck type (Kingdoms) one card of the Lord's entry is left out: the Lord does not count toward the Main Deck size. */
function deckMainCount(entries, mode){
  var gm = (typeof GAME_MODES !== 'undefined' && mode && GAME_MODES[mode]) || null;
  var lordLeft = !!(gm && gm.lord);
  return (entries || []).reduce(function(n, en){
    if(!en) return n;
    var c = Math.max(0, en.count | 0);
    if(lordLeft && en.lord && c > 0){ c -= 1; lordLeft = false; }
    return n + c;
  }, 0);
}
window.deckMainCount = deckMainCount;

function formatDeckLines(entries){
  return (entries || []).map(function(en){
    /* "Lx" only while the Lord is the entry's one card: with copies beside it the count is written, or they would be lost. */
    if(en.lord && en.count === 1) return 'Lx ' + en.name;
    return en.count + 'x ' + en.name;
  }).join('\n');
}

function deckAdjustText(text, cardName, delta){
  var lines = String(text == null ? '' : text).split('\n');
  var want = deckCanonName(cardName) || cardName;
  for(var i = 0; i < lines.length; i++){
    var ent = parseDeckLine(lines[i]);
    if(!ent || (ent.name !== cardName && (deckCanonName(ent.name) || ent.name) !== want)) continue;
    var n = ent.count + delta;
    if(n <= 0) lines.splice(i, 1);
    else lines[i] = (ent.lord && n === 1) ? ('Lx ' + cardName) : (n + 'x ' + cardName);
    return lines.join('\n');
  }
  if(delta > 0){
    while(lines.length && !lines[lines.length - 1].trim()) lines.pop();
    lines.push(delta + 'x ' + cardName);
  }
  return lines.join('\n');
}

/* One comparator table, SORT_DEFS, for Browse and the Deck Viewer. Each cmp applies dir itself, as the blank tiers must not flip with it. */

// Card colours are stored lowercase ('green'): against a capitalised list, indexOf misses every coloured card.
var SORT_ROYGBIV = ['red','orange','yellow','green','blue','indigo','violet'];
function sortColorIdx(c){
  var i = SORT_ROYGBIV.indexOf(String(c == null ? '' : c).toLowerCase());
  return i < 0 ? 98 : i;
}

var SMART_SUPER_ORDER = ['Character','Object','Quick','Ongoing','Slow Actions / Spells'];
function smartSuperGroup(superTypes){
  var st = _catArr(superTypes).map(function(s){ return String(s).toLowerCase(); });
  if(st.indexOf('character') >= 0) return 'Character';
  if(st.indexOf('object')    >= 0) return 'Object';
  if(st.indexOf('quick')     >= 0) return 'Quick';
  if(st.indexOf('ongoing')   >= 0) return 'Ongoing';
  return 'Slow Actions / Spells';
}

/* tier 0 a value, 1 unrankable ('*'), 2 none; tiers above 0 keep their place either way, or ascending Attack opens on every card without one. */
function sortTier(v, numeric){
  if(v == null || v === '') return 2;
  if(Array.isArray(v)) return v.length ? 0 : 2;
  if(numeric && !isFinite(parseFloat(v))) return 1;
  return 0;
}
function sortDir(d, dir){ return dir === 'desc' ? -d : d; }

function sortCmp(av, bv, dir, numeric, inner){
  var ta = sortTier(av, numeric), tb = sortTier(bv, numeric);
  if(ta !== tb) return ta - tb;
  if(ta !== 0) return 0;
  return sortDir(inner(av, bv), dir);
}
/* The editor owns the art rule (edCardArtSrc) but parses after this file, and the first render comes before it, so the fallback is needed. */
function _artSrc(card){
  if(typeof window.edCardArtSrc==='function'){
    try{ var v=window.edCardArtSrc(card); if(v)return v; }catch(_){}
  }
  if(typeof window.edArtSrcOf==='function'){
    try{ return window.edArtSrcOf(card)||''; }catch(_){}
  }
  return (card&&card.imageUrl)||'';
}
function _numInner(a, b){ return (parseFloat(a) || 0) - (parseFloat(b) || 0); }
/* One collator: localeCompare without one rebuilds the ICU comparison every call, thousands per sort; default options keep its order. */
var _coll=(function(){
  try{ return new Intl.Collator(); }catch(_){ return null; }
})();
function _cmpStr(a, b){
  return _coll ? _coll.compare(a, b) : String(a).localeCompare(String(b));
}
function _txtInner(a, b){ return _cmpStr(String(a), String(b)); }

function cmpColors(a, b){
  var ac = a.colors || [], bc = b.colors || [];
  var af = sortColorIdx(ac[0]), bf = sortColorIdx(bc[0]);
  if(af !== bf) return af - bf;
  if(ac.length !== bc.length) return ac.length - bc.length;
  for(var i = 1; i < Math.max(ac.length, bc.length); i++){
    var ai = i < ac.length ? sortColorIdx(ac[i]) : 99;
    var bi = i < bc.length ? sortColorIdx(bc[i]) : 99;
    if(ai !== bi) return ai - bi;
  }
  return _cmpStr(a.name,b.name);
}

var SORT_DEFS = [
  {key:'name', label:'Alphabetical', menu:true, cmp:function(a,b,dir){
    return sortDir(_cmpStr(a.name,b.name), dir); }},
  {key:'color', label:'Color', menu:true, cmp:function(a,b,dir){
    return sortCmp(a.colors, b.colors, dir, false, function(){ return cmpColors(a,b); }); }},
  {key:'lastUpdated', label:'Last Updated', menu:true, cmp:function(a,b,dir){
    return sortCmp(a.lastUpdated, b.lastUpdated, dir, false, _txtInner); }},
  {key:'super', label:'Super-Type', menu:true, cmp:function(a,b,dir){
    return sortCmp(a.superTypes, b.superTypes, dir, false, function(){
      var ai = SMART_SUPER_ORDER.indexOf(smartSuperGroup(a.superTypes));
      var bi = SMART_SUPER_ORDER.indexOf(smartSuperGroup(b.superTypes));
      if(ai < 0) ai = 99; if(bi < 0) bi = 99;
      return ai !== bi ? ai - bi : _cmpStr(a.name,b.name);
    }); }},
  {key:'sub', label:'Sub-Type', menu:true, cmp:function(a,b,dir){
    return sortCmp(a.subTypes, b.subTypes, dir, false, function(){
      var d = _catArr(a.subTypes).join(' ').localeCompare(_catArr(b.subTypes).join(' '));
      return d !== 0 ? d : _cmpStr(a.name,b.name);
    }); }},
  {key:'cmc', label:'Total Mana Cost', menu:true, cmp:function(a,b,dir){
    return sortCmp(a.cmc, b.cmc, dir, true, _numInner); }},
  {key:'atk', label:'Attack', menu:true, cmp:function(a,b,dir){
    return sortCmp(a.attack, b.attack, dir, true, _numInner); }},
  {key:'hp', label:'Health', menu:true, cmp:function(a,b,dir){
    return sortCmp(a.health, b.health, dir, true, _numInner); }},
  {key:'arc', label:'Arcane', menu:true, cmp:function(a,b,dir){
    return sortCmp(a.arcane, b.arcane, dir, true, _numInner); }},
  {key:'rng', label:'Range', menu:!!REBIRTH, cmp:function(a,b,dir){
    return sortCmp(a.range, b.range, dir, true, _numInner); }},
  {key:'mana', label:'Mana', menu:false, cmp:function(a,b,dir){
    return sortCmp(a.manaCost, b.manaCost, dir, false, _txtInner); }},
  {key:'rule', label:'Rule', menu:false, cmp:function(a,b,dir){
    return sortCmp(a.ruleText, b.ruleText, dir, false, _txtInner); }}
];
var SORT_BY_KEY = {};
SORT_DEFS.forEach(function(d){ SORT_BY_KEY[d.key] = d; });

var CAT_THEME_NAMES = {dark:'Dark', light:'Light', arcane:'Arcane'};
var CAT_THEME_ICONS = {dark:'moon', light:'sun', arcane:'sparkle'};
function catTheme(){
  var b = document.body.classList;
  return b.contains('light') ? 'light' : b.contains('arcane') ? 'arcane' : 'dark';
}
function pickTheme(t, opening){
  if(!CAT_THEME_NAMES.hasOwnProperty(t)) t = 'dark';
  document.body.classList.toggle('light', t === 'light');
  document.body.classList.toggle('arcane', t === 'arcane');
  var nm = document.getElementById('thmName');
  if(nm) nm.textContent = CAT_THEME_NAMES[t];
  var u = document.querySelector('#tbtn use');
  if(u) u.setAttribute('href', '#i-' + CAT_THEME_ICONS[t]);
  document.querySelectorAll('#thmMenu [data-theme]').forEach(function(b){
    var on = b.getAttribute('data-theme') === t;
    b.setAttribute('aria-checked', on ? 'true' : 'false');
    b.classList.toggle('on', on);
  });
  var m = document.getElementById('thmMenu');
  var had = !!m && !m.hidden && m.contains(document.activeElement);
  thmOpen(false);
  if(had) document.getElementById('tbtn').focus();
  if(opening) return;
  try{ localStorage.setItem('conjure_theme', t); }catch(_){}
  _redrawCharts();
}
function toggleTheme(){ pickTheme(catTheme() === 'light' ? 'dark' : 'light'); }
function thmOpen(open){
  var m = document.getElementById('thmMenu'), b = document.getElementById('tbtn');
  if(!m || !b) return;
  if(open === undefined) open = m.hidden;
  m.hidden = !open;
  b.setAttribute('aria-expanded', open ? 'true' : 'false');
  if(open){
    var c = m.querySelector('[aria-checked="true"]') || m.querySelector('button');
    if(c) c.focus();
  }
}
document.addEventListener('click', function(e){
  var m = document.getElementById('thmMenu');
  if(m && !m.hidden && !(e.target.closest && e.target.closest('#thmBox'))) thmOpen(false);
});
/* Capture phase, and stopped: Escape and the arrows are the page's keys too, so while the menu holds the keyboard they end here. */
window.addEventListener('keydown', function(e){
  var m = document.getElementById('thmMenu'), a = document.activeElement;
  if(!m) return;
  if(a && a.id === 'tbtn' && e.key === 'ArrowDown'){ thmOpen(true); e.preventDefault(); e.stopPropagation(); return; }
  if(m.hidden || !m.contains(a)) return;
  var l = [].slice.call(m.querySelectorAll('button')), i = l.indexOf(a);
  if(e.key === 'Tab'){ thmOpen(false); return; }
  if(e.key === 'Escape'){ thmOpen(false); document.getElementById('tbtn').focus(); }
  else if(e.key === 'ArrowDown') l[(i + 1) % l.length].focus();
  else if(e.key === 'ArrowUp') l[(i - 1 + l.length) % l.length].focus();
  else if(e.key === 'Home') l[0].focus();
  else if(e.key === 'End') l[l.length - 1].focus();
  else return;
  e.preventDefault(); e.stopPropagation();
}, true);
(function(){
  var t = null;
  try{ t = localStorage.getItem('conjure_theme'); }catch(_){}
  if(t && t !== 'dark') pickTheme(t, true);
})();

function _redrawCharts(){
  if(document.getElementById('pane-deck') &&
     document.getElementById('pane-deck').style.display !== 'none'){
    refreshDeckView();
  }
}

function toggleSidebar() {
  var sb = document.querySelector('.sb');
  var ov = document.getElementById('sbOverlay');
  var open = sb.classList.toggle('mob-open');
  ov.classList.toggle('on', open);
  document.body.style.overflow = open ? 'hidden' : '';
}



function _toggleDvTypeSection(which){
  var btnId = which === 'super' ? 'dvSuperToggle' : 'dvSubToggle';
  var btnsId = which === 'super' ? 'dv-super-btns' : 'dv-sub-btns';
  var el = document.getElementById(btnsId);
  var btn = document.getElementById(btnId);
  if(!el) return;
  var open = el.style.display !== 'none';
  el.style.display = open ? 'none' : '';
  if(btn){
    var label = which === 'super' ? 'Super-Type' : 'Sub-Type';
    btn.innerHTML = (open ? '&#9654; ' : '&#9660; ') + label;
  }
  var box = document.getElementById(which === 'super' ? 'dvSuperBox' : 'dvSubBox');
  if(box) box.classList.toggle('open', !open);
  if(typeof _dvStickyVar === 'function') _dvStickyVar();
}
/* Folded is body.dp-folded, so it survives a tab switch: showTab's wrapper resets .dp's inline display on every other page (setDeckPanelForTab).
   The inline display is still written, for tdFoldSidePanels, and showTab restores it from the class first. */
function minimizeDeckPanel(hide){
  hide = !!hide;
  var dp = document.querySelector('.dp');
  var showBtn = document.getElementById('dpShow');
  document.body.classList.toggle('dp-folded', hide);
  if(dp) dp.style.display = hide ? 'none' : '';
  /* .on as the Filters button wears it (minimizeSidebar), so the two folded buttons look alike (the author, 9 November). */
  if(showBtn){ showBtn.style.display = hide ? 'flex' : 'none'; showBtn.classList.toggle('on', hide); }
  if(!hide) setTimeout(function(){
    var dlPane=document.getElementById('pane-decklists');
    if(dlPane && dlPane.style.display!=='none') renderDeckLists();
  },150);
}
function minimizeSidebar(hide) {
  var sb = document.getElementById('sbPanel');
  var btn = document.getElementById('sbShow');
  if(hide){
    sb.classList.add('minimized');
    btn.classList.add('on');
  } else {
    sb.classList.remove('minimized');
    btn.classList.remove('on');
    setTimeout(function(){
      var dlPane=document.getElementById('pane-decklists');
      if(dlPane && dlPane.style.display!=='none') renderDeckLists();
    },150);
  }
}

function hybridHtml(colors, sz) {
  sz = sz || 18;
  var sorted = colors.slice().sort(function(a,b){
    return ROYGBIV.indexOf(a)-ROYGBIV.indexOf(b);
  });
  var title = sorted.join('/');

  if (sorted.length === 2) {
    var u1=CICO[sorted[0]]||'', u2=CICO[sorted[1]]||'';
    return '<span class="hyb" style="width:'+sz+'px;height:'+sz+'px" title="'+title+'">'
      +'<img class="hyb-t" src="'+u1+'" style="width:'+sz+'px;height:'+sz+'px">'
      +'<img class="hyb-b" src="'+u2+'" style="width:'+sz+'px;height:'+sz+'px">'
      +'</span>';
  }

  if (sorted.length === 3) {
    var u0=CICO[sorted[0]]||'', u1=CICO[sorted[1]]||'', u2=CICO[sorted[2]]||'';
    return '<span class="hyb hyb3" style="width:'+sz+'px;height:'+sz+'px" title="'+title+'">'
      +'<img class="hyb-3a" src="'+u0+'" style="width:'+sz+'px;height:'+sz+'px">'
      +'<img class="hyb-3b" src="'+u1+'" style="width:'+sz+'px;height:'+sz+'px">'
      +'<img class="hyb-3c" src="'+u2+'" style="width:'+sz+'px;height:'+sz+'px">'
      +'</span>';
  }

  return manaImg(CICO[sorted[0]]||'', title, sz);
}

function manaImg(src, label, sz) {
  sz = sz || 18;
  return '<img class="mico" src="'+src+'" style="width:'+sz+'px;height:'+sz+'px" alt="'+label+'" title="'+label+'">';
}

function renderManaCost(mc, sz) {
  if (!mc) return '';
  mc = String(mc);
  var key = mc + '_' + sz;
  if (_manaCache[key]) return _manaCache[key];
  var s = mc.replace(/\s/g,'');
  var out = '<span class="mana-s">';
  var i = 0;
  while (i < s.length) {
    var ch = s[i].toUpperCase();
    if (i+1 < s.length && ch >= '1' && ch <= '2' && s[i+1] >= '0' && s[i+1] <= '9') {
      var two = ch + s[i+1];
      var num = parseInt(two);
      if (num >= 10 && num <= 20 && NICONS[two]) {
        out += manaImg(NICONS[two], two, sz);
        i += 2; continue;
      }
    }
    if (ch >= '0' && ch <= '9' && NICONS[ch]) {
      out += manaImg(NICONS[ch], ch, sz);
      i++; continue;
    }
    if (ch === 'X' && NICONS['X']) {
      out += manaImg(NICONS['X'], 'X', sz);
      i++; continue;
    }
    if (i+2 < s.length && s[i+1] === '/') {
      var hColors = [];
      var j = i;
      while (j < s.length) {
        var hk = s[j].toUpperCase();
        var hc = MLTR[hk];
        if (!hc) break;
        hColors.push(hc);
        if (j+1 < s.length && s[j+1] === '/') { j += 2; }
        else { j++; break; }
      }
      if (hColors.length >= 2) {
        out += hybridHtml(hColors, sz);
        i = j;
        continue;
      }
    }
    if (MLTR[ch] && CICO[MLTR[ch]]) {
      out += manaImg(CICO[MLTR[ch]], MLTR[ch], sz);
      i++; continue;
    }
    out += '<span class="mana-txt">'+s[i]+'</span>';
    i++;
  }
  _manaCache[key] = out + '</span>';
  return _manaCache[key];
}

// PIP_FILL/PIP_OUTLINE (cat_view.js) and tools/make_card_back.py hold copies of these two: change all three together.
var COLOR_FILL_HEX    = {Red:'#f9aa8f',Orange:'#e7af83',Yellow:'#fff799',Green:'#9bd3ae',Blue:'#aae0fa',Indigo:'#b298f0',Violet:'#e898de'};
var COLOR_OUTLINE_HEX = {Red:'#200000',Orange:'#2b1b07',Yellow:'#322d00',Green:'#00160b',Blue:'#061922',Indigo:'#1d0a26',Violet:'#2a000f'};
var COLOR_LETTER      = {Red:'R',Orange:'O',Yellow:'Y',Green:'G',Blue:'B',Indigo:'I',Violet:'V'};

/* manaCostColorIcons repeats this scan unsorted (its icons follow the cost's order), so a change to the scan belongs in both. */
function manaCostColorNames(mc){
  if(!mc) return [];
  var s = String(mc).replace(/\s/g,'').toUpperCase();
  var seen = {}, out = [];
  var i = 0;
  while(i < s.length){
    var ch = s[i];
    if(i+2 < s.length && s[i+1] === '/'){
      var j = i;
      while(j < s.length && MLTR[s[j]]){
        var hc = MLTR[s[j]];
        if(hc && !seen[hc]){ seen[hc]=true; out.push(hc); }
        if(j+1 < s.length && s[j+1]==='/') j+=2; else { j++; break; }
      }
      i = j; continue;
    }
    var clr = MLTR[ch];
    if(clr && !seen[clr]){ seen[clr]=true; out.push(clr); }
    i++;
  }
  out.sort(function(a,b){ return ROYGBIV.indexOf(a)-ROYGBIV.indexOf(b); });
  return out;
}
function manaCostColorIcons(mc, sz){
  if(!mc) return '';
  sz = sz || 18;
  var s = String(mc).replace(/\s/g,'').toUpperCase();
  var seen = {}, out = [];
  var i = 0;
  while(i < s.length){
    var ch = s[i];
    if(i+2 < s.length && s[i+1] === '/'){
      var j = i;
      while(j < s.length && MLTR[s[j]]){
        var hc = MLTR[s[j]];
        if(hc && !seen[hc]){ seen[hc]=true; out.push(hc); }
        if(j+1 < s.length && s[j+1]==='/') j+=2; else { j++; break; }
      }
      i = j; continue;
    }
    var clr = MLTR[ch];
    if(clr && !seen[clr]){ seen[clr]=true; out.push(clr); }
    i++;
  }
  /* In the order the cost is written, not ROYGBIV: the order the frame is drawn in (frameColorsOf), so list and card agree. */
  return out.map(function(c){
    var url = CICO[c]||'';
    if(url) return manaImg(url, c, sz);
    var isLight = document.body.classList.contains('light');
    var fill = isLight ? (COLOR_FILL_HEX[c]||'#888') : (COLOR_OUTLINE_HEX[c]||'#222');
    var outline = isLight ? (COLOR_OUTLINE_HEX[c]||'#000') : (COLOR_FILL_HEX[c]||'#ccc');
    return '<span style="display:inline-flex;align-items:center;justify-content:center;width:'+sz+'px;height:'+sz+'px;border-radius:50%;background:'+fill+';border:1.5px solid '+outline+';color:'+outline+';font-weight:700;font-size:10px;vertical-align:middle;margin:0 1px" title="'+c+'">'+(COLOR_LETTER[c]||c[0])+'</span>';
  }).join('');
}

function cardColorIcons(card, sz){
  sz = sz || 18;
  var superArr = _catArr(card.superTypes).map(function(s){return String(s).toLowerCase();});
  var isEssence = superArr.indexOf('essence') >= 0;
  if(isEssence){
    var essColors = [], seen = {};
    _catArr(card.subTypes).forEach(function(st){
      var col = _ESSENCE_COLOR_MAP[st];
      if(col && !seen[col]){ seen[col]=true; essColors.push(col); }
    });
    essColors.sort(function(a,b){ return ROYGBIV.indexOf(a)-ROYGBIV.indexOf(b); });
    if(essColors.length){
      return essColors.map(function(c){
        var url = CICO[c]||'';
        if(url) return manaImg(url, c, sz);
        var isLight = document.body.classList.contains('light');
        var fill = isLight ? (COLOR_FILL_HEX[c]||'#888') : (COLOR_OUTLINE_HEX[c]||'#222');
        var outline = isLight ? (COLOR_OUTLINE_HEX[c]||'#000') : (COLOR_FILL_HEX[c]||'#ccc');
        return '<span style="display:inline-flex;align-items:center;justify-content:center;width:'+sz+'px;height:'+sz+'px;border-radius:50%;background:'+fill+';border:1.5px solid '+outline+';color:'+outline+';font-weight:700;font-size:10px;vertical-align:middle;margin:0 1px" title="'+c+'">'+(COLOR_LETTER[c]||c[0])+'</span>';
      }).join('');
    }
  }
  return manaCostColorIcons(card.manaCost, sz);
}

/* Escapes ' too: attributes are single-quoted throughout, and an unescaped ' cuts the value short (HANDOFF §14.3). */
function e(s){ return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;'); }

/* A card may lack any field: one card without superTypes blanked the whole Browse grid, so views read its lists through _catArr. */
function _catArr(v){
  if(Array.isArray(v)) return v;
  if(v == null || v === '') return [];
  if(typeof v === 'string') return v.split(/\s*,\s*|\s+/).filter(Boolean);
  return [];
}

/* A fused arcane value carries its slot as a suffix: "8A" is drawn in the Attack slot and "8H" in Health's, and its Arcane cell is blank. */
function atkCell(val, arcane){
  if(arcane && arcane.toUpperCase().endsWith('A')){
    var n=e(arcane.slice(0,-1));
    return '<span style="display:inline-flex;align-items:center;gap:3px">'
      +'<svg width="18" height="18" viewBox="0 0 18 18" fill="none">'
      +'<polyline points="1,9 9,1 17,9" stroke="#c45c5c" stroke-width="3" fill="none" stroke-linejoin="round"/>'
      +'<path d="M 2,9 A 7,7 0 0 0 16,9" stroke="#2980b9" stroke-width="3" fill="none"/>'
      +'</svg><span style="font-weight:700">'+n+'</span></span>';
  }
  if(!val||val==='\u2014') return e(val||'\u2014');
  return '<span style="display:inline-flex;align-items:center;gap:3px"><svg width="18" height="18" viewBox="0 0 18 18" fill="none"><rect x="4" y="4" width="10" height="10" transform="rotate(45 9 9)" stroke="#c45c5c" stroke-width="3" fill="none"/></svg><span style="font-weight:700">'+e(val)+'</span></span>';
}
function hpCell(val, arcane){
  if(arcane && arcane.toUpperCase().endsWith('H')){
    var n=e(arcane.slice(0,-1));
    return '<span style="display:inline-flex;align-items:center;gap:3px">'
      +'<svg width="18" height="18" viewBox="0 0 18 18" fill="none">'
      +'<polyline points="1,9 1,5 9,1 17,5 17,9" stroke="#c9a84c" stroke-width="3" fill="none" stroke-linejoin="round"/>'
      +'<path d="M 2,9 A 7,7 0 0 0 16,9" stroke="#2980b9" stroke-width="3" fill="none"/>'
      +'</svg><span style="font-weight:700">'+n+'</span></span>';
  }
  if(!val||val==='\u2014') return e(val||'\u2014');
  return '<span style="display:inline-flex;align-items:center;gap:3px"><svg width="18" height="18" viewBox="0 0 18 18" fill="none"><polygon points="9,1 17,5 17,13 9,17 1,13 1,5" stroke="#c9a84c" stroke-width="3" fill="none"/></svg><span style="font-weight:700">'+e(val)+'</span></span>';
}
function arcCell(val){
  if(!val||val==='\u2014') return e(val||'\u2014');
  if(val.toUpperCase().endsWith('A') || val.toUpperCase().endsWith('H')) return '';
  return '<span style="display:inline-flex;align-items:center;gap:3px"><svg width="18" height="18" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7" stroke="#2980b9" stroke-width="3" fill="none"/></svg><span style="font-weight:700">'+e(val)+'</span></span>';
}
/* Range is drawn in #5c9e6e, the orb's own fill, so list and card agree; it is never fused, so there is no suffix to read. */
function rngCell(val){
  if(!val||val==='—') return e(val||'—');
  return '<span style="display:inline-flex;align-items:center;gap:3px"><svg width="18" height="18" viewBox="0 0 18 18" fill="none"><polygon points="9,1 16,15 2,15" stroke="#5c9e6e" stroke-width="3" fill="none" stroke-linejoin="round"/></svg><span style="font-weight:700">'+e(val)+'</span></span>';
}
/* Filled from the card's real orbs (edCardOrbs, ed2_core.js): the flat fields' A/H suffix loses the slot order, and a plain Arcane beside a fused one.
   Until the editor has loaded they fall back to the flat-field cells. */
function _cardOrbList(card){
  if(typeof window.edCardOrbs !== 'function') return null;
  try{ return window.edCardOrbs(card) || []; }catch(_){ return null; }
}
function orbCellSm(o){
  if(!o) return '';
  var v = o.value == null ? '' : String(o.value);
  switch(o.type){
    case 'attack':            return atkCell(v,'');
    case 'health':            return hpCell(v,'');
    case 'attack and arcane': return atkCell(v, v+'A');
    case 'health and arcane': return hpCell(v, v+'H');
    case 'arcane':            return arcCell(v);
    case 'range':             return rngCell(v);
  }
  return '';
}
function orbCellLgFor(o, lbl){
  if(!o) return '';
  var v = o.value == null ? '' : String(o.value);
  switch(o.type){
    case 'attack':            return atkCellLg(v, lbl||'', '');
    case 'health':            return hpCellLg(v, lbl||'', '');
    case 'attack and arcane': return atkCellLg(v, lbl||'', v+'A');
    case 'health and arcane': return hpCellLg(v, lbl||'', v+'H');
    case 'arcane':            return arcCellLg(v, lbl||'');
    case 'range':             return rngCellLg(v, lbl||'');
  }
  return '';
}
/* Columns by type, not by position, so the column sorts keep their meaning; a standalone Arcane shows even beside a fused one. */
function statRowCells(card){
  var orbs=_cardOrbList(card);
  if(!orbs) return [atkCell(card.attack||'',card.arcane||''),
                    hpCell(card.health||'',card.arcane||''),
                    arcCell(card.arcane||'')];
  function pick(types){
    for(var i=0;i<orbs.length;i++) if(types.indexOf(orbs[i].type)>=0) return orbs[i];
    return null;
  }
  var a=pick(['attack','attack and arcane']);
  var h=pick(['health','health and arcane']);
  var r=pick(['arcane']);
  var cells=[ a?orbCellSm(a):'—', h?orbCellSm(h):'—', r?orbCellSm(r):'' ];
  /* The header builders add RNG under the same flag, so head and body keep one cell count. */
  if(REBIRTH){ var g=pick(['range']); cells.push(g?orbCellSm(g):''); }
  return cells;
}
function statStripHtmlFor(card){
  var orbs=_cardOrbList(card);
  if(!orbs){
    var out='';
    if(card.attack) out+='<div style="margin-bottom:1px">'+atkCellLg(card.attack,'',card.arcane)+'</div>';
    if(card.health) out+='<div style="margin-bottom:1px">'+hpCellLg(card.health,'',card.arcane)+'</div>';
    var _fa=arcCellLg(card.arcane||'',''); if(_fa) out+='<div>'+_fa+'</div>';
    return out;
  }
  return orbs.map(function(o,i){
    var cell=orbCellLgFor(o,'');
    return cell?('<div'+(i<orbs.length-1?' style="margin-bottom:1px"':'')+'>'+cell+'</div>'):'';
  }).join('');
}

function atkCellLg(val, lbl, arcane){
  var sz=lbl?32:18, sw=lbl?4.5:3;
  if(arcane && arcane.toUpperCase().endsWith('A')){
    var dispVal=arcane.slice(0,-1);
    var autoLbl=lbl?'Attack Arcane':'';
    var svgContent='<polyline points="2,16 16,2 30,16" stroke="#c45c5c" stroke-width="'+sw+'" fill="none" stroke-linejoin="round"/>'
                  +'<path d="M 3,16 A 13,13 0 0 0 29,16" stroke="#2980b9" stroke-width="'+sw+'" fill="none"/>';
    return '<div style="display:flex;flex-direction:column;align-items:center;gap:3px;min-width:'+(lbl?'48':'28')+'px">'
      +'<span style="display:inline-flex;align-items:center;gap:4px"><svg width="'+sz+'" height="'+sz+'" viewBox="0 0 32 32" fill="none">'+svgContent+'</svg>'
      +'<span style="font-family:Cinzel,serif;font-size:2rem;font-weight:700;color:var(--tx)">'+e(dispVal)+'</span></span>'
      +(autoLbl?'<span style="font-family:Cinzel,serif;font-size:.6rem;letter-spacing:.1em;color:var(--td)">'+autoLbl+'</span>':'')
      +'</div>';
  }
  return '<div style="display:flex;flex-direction:column;align-items:center;gap:3px;min-width:'+(lbl?'48':'28')+'px">'
    +'<span style="display:inline-flex;align-items:center;gap:4px"><svg width="'+sz+'" height="'+sz+'" viewBox="0 0 32 32" fill="none"><rect x="6" y="6" width="20" height="20" transform="rotate(45 16 16)" stroke="#c45c5c" stroke-width="'+sw+'" fill="none"/></svg>'
    +'<span style="font-family:Cinzel,serif;font-size:2rem;font-weight:700;color:var(--tx)">'+e(val)+'</span></span>'
    +(lbl?'<span style="font-family:Cinzel,serif;font-size:.6rem;letter-spacing:.1em;color:var(--td)">'+lbl+'</span>':'')
    +'</div>';
}
function hpCellLg(val, lbl, arcane){
  var sz=lbl?32:18, sw=lbl?4.5:3;
  if(arcane && arcane.toUpperCase().endsWith('H')){
    var dispVal=arcane.slice(0,-1);
    var autoLbl=lbl?'Health Arcane':'';
    var svgContent='<polyline points="2,16 2,9 16,2 30,9 30,16" stroke="#c9a84c" stroke-width="'+sw+'" fill="none" stroke-linejoin="round"/>'
                  +'<path d="M 3,16 A 13,13 0 0 0 29,16" stroke="#2980b9" stroke-width="'+sw+'" fill="none"/>';
    return '<div style="display:flex;flex-direction:column;align-items:center;gap:3px;min-width:'+(lbl?'48':'28')+'px">'
      +'<span style="display:inline-flex;align-items:center;gap:4px"><svg width="'+sz+'" height="'+sz+'" viewBox="0 0 32 32" fill="none">'+svgContent+'</svg>'
      +'<span style="font-family:Cinzel,serif;font-size:2rem;font-weight:700;color:var(--tx)">'+e(dispVal)+'</span></span>'
      +(autoLbl?'<span style="font-family:Cinzel,serif;font-size:.6rem;letter-spacing:.1em;color:var(--td)">'+autoLbl+'</span>':'')
      +'</div>';
  }
  return '<div style="display:flex;flex-direction:column;align-items:center;gap:3px;min-width:'+(lbl?'48':'28')+'px">'
    +'<span style="display:inline-flex;align-items:center;gap:4px"><svg width="'+sz+'" height="'+sz+'" viewBox="0 0 32 32" fill="none"><polygon points="16,2 30,9 30,23 16,30 2,23 2,9" stroke="#c9a84c" stroke-width="'+sw+'" fill="none"/></svg>'
    +'<span style="font-family:Cinzel,serif;font-size:2rem;font-weight:700;color:var(--tx)">'+e(val)+'</span></span>'
    +(lbl?'<span style="font-family:Cinzel,serif;font-size:.6rem;letter-spacing:.1em;color:var(--td)">'+lbl+'</span>':'')
    +'</div>';
}
function arcCellLg(val,lbl){
  if(!val) return '';
  if(val.toUpperCase().endsWith('A') || val.toUpperCase().endsWith('H')) return '';
  var sz=lbl?32:18, sw=lbl?4.5:3;
  return '<div style="display:flex;flex-direction:column;align-items:center;gap:3px;min-width:'+(lbl?'48':'28')+'px">'
    +'<span style="display:inline-flex;align-items:center;gap:4px"><svg width="'+sz+'" height="'+sz+'" viewBox="0 0 32 32" fill="none"><circle cx="16" cy="16" r="13" stroke="#2980b9" stroke-width="'+sw+'" fill="none"/></svg>'
    +'<span style="font-family:Cinzel,serif;font-size:2rem;font-weight:700;color:var(--tx)">'+e(val)+'</span></span>'
    +(lbl?'<span style="font-family:Cinzel,serif;font-size:.6rem;letter-spacing:.1em;color:var(--td)">'+lbl+'</span>':'')
    +'</div>';
}
function rngCellLg(val,lbl){
  if(!val) return '';
  var sz=lbl?32:18, sw=lbl?4.5:3;
  return '<div style="display:flex;flex-direction:column;align-items:center;gap:3px;min-width:'+(lbl?'48':'28')+'px">'
    +'<span style="display:inline-flex;align-items:center;gap:4px"><svg width="'+sz+'" height="'+sz+'" viewBox="0 0 32 32" fill="none"><polygon points="16,3 29,27 3,27" stroke="#5c9e6e" stroke-width="'+sw+'" fill="none" stroke-linejoin="round"/></svg>'
    +'<span style="font-family:Cinzel,serif;font-size:2rem;font-weight:700;color:var(--tx)">'+e(val)+'</span></span>'
    +(lbl?'<span style="font-family:Cinzel,serif;font-size:.6rem;letter-spacing:.1em;color:var(--td)">'+lbl+'</span>':'')
    +'</div>';
}
COLORS.forEach(function(c) {
  var id='sw_'+c;
  var inp=document.createElement('input');
  inp.type='checkbox'; inp.id=id; inp.value=c; inp.dataset.f='color'; inp.setAttribute('aria-label',c+' color filter');
  var lbl=document.createElement('label');
  lbl.htmlFor=id;
  lbl.title=c;
  lbl.style.cssText='width:26px;height:26px;cursor:pointer;display:block;position:relative;border-radius:50%;transition:transform .15s;flex-shrink:0';
  var img=document.createElement('img');
  img.src=CICO[c]||'';
  img.alt=c;
  img.style.cssText='width:26px;height:26px;display:block;filter:drop-shadow(0 0 2px rgba(255,255,255,.5))';
  lbl.appendChild(img);
  lbl.addEventListener('mouseenter',function(){lbl.style.transform='scale(1.18)';});
  lbl.addEventListener('mouseleave',function(){lbl.style.transform='';});
  // The checked ring is CSS alone (.csw input:checked+label::after): a JS outline outlived Reset, whose unchecking fires no 'change'.
  var w=document.getElementById('cswatches');
  w.appendChild(inp); w.appendChild(lbl);
});

var ICON_IMGS = {};
var _iconsLoaded = 0, _iconsTotal = 0, _iconRetryPending = false;
(function(){
  var keys = Object.keys(CICO);
  _iconsTotal = keys.length;
  keys.forEach(function(c){
    var img = new Image();
    img.onload = img.onerror = function(){
      _iconsLoaded++;
      /* Charts drawn before the icons arrived are redrawn by refreshDeckView, and only while the Build Deck page shows:
         redrawing a hidden page drew the picked section alone into the charts. */
      if(_iconsLoaded === _iconsTotal && !_iconRetryPending){
        _iconRetryPending = true;
        setTimeout(function(){
          var p = document.getElementById('pane-deck');
          if(p && p.style.display !== 'none' && p.getClientRects().length) refreshDeckView();
        }, 100);
      }
    };
    img.src = CICO[c];
    ICON_IMGS[c] = img;
  });
})();

function _ptFallback(card){
  card = card || {};
  var superStr = _catArr(card.superTypes).join(' ');
  var subStr   = _catArr(card.subTypes).join(' ');
  var typeLine = (superStr&&subStr) ? superStr+' \u2014 '+subStr : (superStr||subStr);
  var mana = renderManaCost(card.manaCost||'', 12);
  var arcU = String(card.arcane||'').toUpperCase();
  var stats = '';
  function _sv(path,clr){ return '<svg width="12" height="12" viewBox="0 0 18 18" fill="none"><'+path+' stroke="'+clr+'" stroke-width="3"/></svg>'; }
  var svAtk = _sv('rect x="4" y="4" width="10" height="10" transform="rotate(45 9 9)"','#c0392b');
  var svHp  = _sv('polygon points="9,1 17,5 17,13 9,17 1,13 1,5"','#c9a84c');
  var svArc = _sv('circle cx="9" cy="9" r="7"','#2980b9');
  if(card.attack)  stats += '<span style="display:inline-flex;align-items:center;gap:2px;margin-right:5px">'+svAtk+'<b>'+e(card.attack)+'</b></span>';
  if(card.health)  stats += '<span style="display:inline-flex;align-items:center;gap:2px;margin-right:5px">'+svHp+'<b>'+e(card.health)+'</b></span>';
  if(card.arcane && !arcU.endsWith('A') && !arcU.endsWith('H'))
    stats += '<span style="display:inline-flex;align-items:center;gap:2px">'+svArc+'<b>'+e(card.arcane)+'</b></span>';
  var rt = '';
  var superArr = _catArr(card.superTypes).map(function(s){return String(s).toLowerCase();});
  var isEss = superArr.indexOf('essence')>=0;
  var isCoreOrDual = isEss && (superArr.indexOf('core')>=0||superArr.indexOf('dual')>=0);
  if(!isCoreOrDual && card.ruleText){
    rt = '<div style="flex:1;font-size:7pt;line-height:1.4;color:#ccc;padding:4px 6px;overflow:hidden;border-top:1px solid #444;margin-top:4px">'
       + e(card.ruleText).replace(/\n/g,' \u00b7 ').substring(0,160) + '</div>';
  }
  var essIcons = '';
  if(isCoreOrDual){
    var nIcons = superArr.indexOf('core')>=0 ? 1 : 2;
    var isz = nIcons===1 ? '48px' : '36px';
    _catArr(card.subTypes).forEach(function(st){
      if(essIcons.split('<img').length-1 >= nIcons) return;
      var col = _ESSENCE_COLOR_MAP[st], url = col ? (CICO[col]||'') : '';
      if(url) essIcons += '<img src="'+url+'" style="width:'+isz+';height:'+isz+';border-radius:50%;margin:0 4px;image-rendering:crisp-edges">';
    });
    rt = '<div style="flex:1;display:flex;align-items:center;justify-content:center;padding:6px">'+essIcons+'</div>';
  }
  return '<div style="width:100%;height:100%;background:#1a1e2b;display:flex;flex-direction:column;padding:5px;box-sizing:border-box;border:1px solid #2a2f45">'
    + '<div style="display:flex;align-items:center;justify-content:space-between;gap:3px;margin-bottom:3px">'
    +   '<span style="font-size:8pt;font-weight:700;color:#f0ead8;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+e(card.name)+'</span>'
    +   '<span style="flex-shrink:0">'+mana+'</span>'
    + '</div>'
    + '<div style="font-size:6.5pt;color:#c9a84c;margin-bottom:3px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+e(typeLine)+'</div>'
    + (stats ? '<div style="display:flex;flex-wrap:wrap;gap:3px;margin-bottom:3px;font-size:7pt;color:#f0ead8">'+stats+'</div>' : '')
    + rt
    + '</div>';
}
function _imgErr(img){
  var name = img.dataset.cname;
  var card = name && CARDS.filter(function(c){return c.name===name;})[0];
  if(!card) return;
  var wrap = img.parentNode;
  wrap.innerHTML = _ptFallback(card);
}
function _imgErrMdi(img){
  var name = img.dataset.cname;
  var card = name && CARDS.filter(function(c){return c.name===name;})[0];
  if(!card) return;
  var mdi = document.getElementById('mdi');
  _3dOff(mdi);
  mdi.innerHTML = _ptFallback(card);
}

/* Suggestions are the types the filter searches, so none finds nothing. Not the editor's setupCombo,
   which adds a type to the open card and loads after these rows exist. */
function catTypeVocab(which){
  var key = which === 'super' ? 'superTypes' : 'subTypes';
  var seen = {}, out = [];
  var on = (typeof window.edSagaEnabled === 'function') ? function(c){
    var sid = (typeof window.edSagaOf === 'function') ? window.edSagaOf(c) : (c.sagaId || c.saga || '');
    return window.edSagaEnabled(sid);
  } : function(){ return true; };
  (CARDS || []).forEach(function(c){
    if(!c || !on(c)) return;
    var list = (c[key] || []).slice();
    var si = (typeof window.edAnyIdent === 'function') ? window.edAnyIdent(c) : !!c.splitIdent;
    if(si && typeof window.edSplitFacets === 'function'){
      var sf = window.edSplitFacets(c);
      if(sf && sf[key]) list = list.concat(sf[key]);
    }
    list.forEach(function(t){
      t = String(t || '').trim(); if(!t) return;
      var k = t.toLowerCase(); if(seen[k]) return;
      seen[k] = 1; out.push(t);
    });
  });
  return out.sort(_cmpStr);
}
window.catTypeVocab = catTypeVocab;
function catTypeCombo(inp, row, which){
  inp.setAttribute('autocomplete', 'off');      /* the browser's own history list fights it */
  var list = document.createElement('div');
  list.className = 'ed2-combo-list cat-tcombo hidden';
  row.appendChild(list);
  var active = -1, vocab = null, picking = false;
  function taken(){
    var col = row.parentNode, t = {};
    if(col) Array.prototype.forEach.call(col.querySelectorAll('.sti'), function(o){
      if(o !== inp && o.value.trim()) t[o.value.trim().toLowerCase()] = 1;
    });
    return t;
  }
  function render(){
    if(!vocab) vocab = catTypeVocab(which);
    var f = inp.value.trim().toLowerCase(), skip = taken();
    var show = vocab.filter(function(o){
      var l = o.toLowerCase();
      return !skip[l] && (!f || l.indexOf(f) >= 0);
    });
    if(f) show.sort(function(a, b){
      var as = a.toLowerCase().indexOf(f) === 0 ? 0 : 1, bs = b.toLowerCase().indexOf(f) === 0 ? 0 : 1;
      return as - bs || _cmpStr(a, b);
    });
    active = -1;
    if(!show.length){ list.innerHTML = ''; list.classList.add('hidden'); return; }
    list.innerHTML = show.slice(0, 40).map(function(o){
      return "<div class='ed2-combo-opt' data-v='" + e(o) + "'>" + e(o) + "</div>";
    }).join('');
    list.classList.remove('hidden');
  }
  function hi(){
    var items = list.querySelectorAll('.ed2-combo-opt');
    Array.prototype.forEach.call(items, function(el, i){
      el.classList.toggle('active', i === active);
      if(i === active) el.scrollIntoView({block: 'nearest'});
    });
  }
  function pick(v){
    inp.value = v;
    list.classList.add('hidden');
    /* setting .value fires no input event, and the Rewards panel listens for one */
    picking = true;
    try{ inp.dispatchEvent(new Event('input', {bubbles: true})); }catch(_){}
    picking = false;
  }
  list.addEventListener('mousedown', function(ev){
    var o = ev.target && ev.target.closest && ev.target.closest('.ed2-combo-opt');
    if(!o) return;
    ev.preventDefault();
    pick(o.getAttribute('data-v'));
  });
  inp.addEventListener('focus', function(){ vocab = catTypeVocab(which); render(); });
  inp.addEventListener('input', function(){ if(!picking) render(); });
  inp.addEventListener('blur', function(){ setTimeout(function(){ list.classList.add('hidden'); }, 150); });
  inp.addEventListener('keydown', function(ev){
    var items = list.querySelectorAll('.ed2-combo-opt');
    var open = !list.classList.contains('hidden') && items.length;
    if(ev.key === 'ArrowDown' && open){ ev.preventDefault(); active = Math.min(active + 1, items.length - 1); hi(); }
    else if(ev.key === 'ArrowUp' && open){ ev.preventDefault(); active = Math.max(active - 1, 0); hi(); }
    else if(ev.key === 'Enter' && open && active >= 0){ ev.preventDefault(); pick(items[active].getAttribute('data-v')); }
    else if(ev.key === 'Escape'){ list.classList.add('hidden'); }
  });
}

function makeSTRow(first) {
  var row=document.createElement('div'); row.className='str';
  var inp=document.createElement('input');
  inp.type='text'; inp.className='sti'; inp.placeholder='e.g. Dragon';
  row.appendChild(inp);
  catTypeCombo(inp, row, 'sub');
  if (!first) {
    var rm=document.createElement('button');
    rm.type='button'; rm.className='sti-x'; rm.textContent='\u2715'; rm.title='Remove';
    rm.addEventListener('click', function(){ row.remove(); });
    row.appendChild(rm);
    row.classList.add('str-rm');
  }
  return row;
}
function addSTRow(){ document.getElementById('stf').appendChild(makeSTRow(false)); }
document.getElementById('stf').appendChild(makeSTRow(true));

function makeSURow(first) {
  var row=document.createElement('div'); row.className='str';
  var inp=document.createElement('input');
  inp.type='text'; inp.className='sti'; inp.placeholder='e.g. Character';
  row.appendChild(inp);
  catTypeCombo(inp, row, 'super');
  if (!first) {
    var rm=document.createElement('button');
    rm.type='button'; rm.className='sti-x'; rm.textContent='\u2715'; rm.title='Remove';
    rm.addEventListener('click', function(){ row.remove(); });
    row.appendChild(rm);
    row.classList.add('str-rm');
  }
  return row;
}
function addSURow(){ document.getElementById('suf').appendChild(makeSURow(false)); }
document.getElementById('suf').appendChild(makeSURow(true));

function getSTTerms(){ return Array.from(document.querySelectorAll('#stf .sti')).map(function(i){return i.value.trim().toLowerCase();}).filter(Boolean); }
function getSUTerms(){ return Array.from(document.querySelectorAll('#suf .sti')).map(function(i){return i.value.trim().toLowerCase();}).filter(Boolean); }

/* On a phone the sidebar covers the results, so applying a filter closes it: run() calls this, and nothing that reacts to typing may.
   "A phone" is catIsPhone() (cat_mobile.js, under 900px wide, HANDOFF §82); 680px only on a page without that file. */
function closeMobileSidebar(){
  var phone = (typeof catIsPhone === 'function') ? catIsPhone() : window.innerWidth <= 680;
  if(!phone) return;
  var sb = document.querySelector('.sb');
  var ov = document.getElementById('sbOverlay');
  if(sb && sb.classList.contains('mob-open')){
    sb.classList.remove('mob-open');
    ov && ov.classList.remove('on');
    document.body.style.overflow = '';
  }
}
window.closeMobileSidebar = closeMobileSidebar;

/* Suggestions are names the search finds (enabled sagas, split sections), so none finds nothing; Enter with none picked searches what was typed. */
function catNameVocab(){
  var sel = (document.getElementById('fsaga') || {}).value || '';
  var sagaOf = function(c){ return (typeof window.edSagaOf === 'function') ? window.edSagaOf(c) : (c.sagaId || c.saga || ''); };
  var on = (typeof window.edSagaEnabled === 'function') ? function(c){
    var sid = sagaOf(c);
    return window.edSagaEnabled(sid) && (!sel || sid === sel);
  } : function(){ return true; };
  var seen = {}, out = [];
  var add = function(n){ n = String(n || '').trim(); if(!n) return; var l = n.toLowerCase(); if(seen[l]) return; seen[l] = 1; out.push(n); };
  (CARDS || []).forEach(function(c){
    if(!c || !on(c)) return;
    add(c.name);
    var si = (typeof window.edAnyIdent === 'function') ? window.edAnyIdent(c) : !!c.splitIdent;
    if(si && typeof window.edSplitFacets === 'function'){
      var sf = window.edSplitFacets(c);
      if(sf && sf.names) sf.names.forEach(add);
    }
  });
  return out.sort(_cmpStr);
}
window.catNameVocab = catNameVocab;
function catNameCombo(inp){
  inp.setAttribute('autocomplete', 'off');
  var list = document.createElement('div');
  list.className = 'ed2-combo-list cat-ncombo hidden';
  list.setAttribute('role', 'listbox');
  inp.parentNode.appendChild(list);
  var active = -1, vocab = null, vocabFor = null;
  function hide(){ list.classList.add('hidden'); active = -1; }
  function render(){
    var f = inp.value.trim().toLowerCase();
    active = -1;
    if(!f){ list.innerHTML = ''; hide(); return; }
    /* keyed on the Saga box and CARD_GEN too, as either can change while the bar keeps the focus */
    var sel = (document.getElementById('fsaga') || {}).value || '';
    var key = sel + '|' + ((typeof CARDS !== 'undefined' && CARDS) || []).length + '|' + (window.CARD_GEN || 0);
    if(!vocab || vocabFor !== key){ vocab = catNameVocab(); vocabFor = key; }
    var starts = [], inside = [];
    vocab.forEach(function(n){ var i = n.toLowerCase().indexOf(f); if(i === 0) starts.push(n); else if(i > 0) inside.push(n); });
    var show = starts.concat(inside).slice(0, 40);
    if(!show.length){ list.innerHTML = ''; hide(); return; }
    list.innerHTML = show.map(function(n){
      var i = n.toLowerCase().indexOf(f);
      return "<div class='ed2-combo-opt' role='option' data-v='" + e(n) + "'>" + e(n.slice(0, i)) + '<b>' + e(n.slice(i, i + f.length)) + '</b>' + e(n.slice(i + f.length)) + '</div>';
    }).join('');
    list.classList.remove('hidden');
  }
  function hi(){
    Array.prototype.forEach.call(list.querySelectorAll('.ed2-combo-opt'), function(el, i){
      el.classList.toggle('active', i === active);
      if(i === active) el.scrollIntoView({block: 'nearest'});
    });
  }
  function pick(v){ inp.value = v; list.innerHTML = ''; hide(); run(); }
  list.addEventListener('mousedown', function(ev){
    var o = ev.target && ev.target.closest && ev.target.closest('.ed2-combo-opt');
    if(!o) return;
    ev.preventDefault();
    pick(o.getAttribute('data-v'));
  });
  inp.addEventListener('focus', function(){ vocab = null; render(); });
  inp.addEventListener('input', render);
  inp.addEventListener('blur', function(){ setTimeout(hide, 150); });
  /* Added before the bar's own Enter listener, so Enter on a highlighted name picks it and searches once, for that name. */
  inp.addEventListener('keydown', function(ev){
    var items = list.querySelectorAll('.ed2-combo-opt');
    var open = !list.classList.contains('hidden') && items.length;
    if(ev.key === 'ArrowDown' && open){ ev.preventDefault(); active = Math.min(active + 1, items.length - 1); hi(); }
    else if(ev.key === 'ArrowUp' && open){ ev.preventDefault(); active = Math.max(active - 1, 0); hi(); }
    else if(ev.key === 'Enter' && open && active >= 0){ ev.preventDefault(); ev.stopImmediatePropagation(); pick(items[active].getAttribute('data-v')); }
    else if(ev.key === 'Enter'){ hide(); }
    else if(ev.key === 'Escape'){ hide(); }
  });
}
catNameCombo(document.getElementById('ns'));

/* Also called by Reset and a loaded link, which set the dropdowns in script, where no change event fires. */
var OP_PAIRS = [['cop','cval'],['aop','aval'],['hop','hval'],['arop','arval'],['rop','rval']];
function syncOpInputs(){
  OP_PAIRS.forEach(function(p){
    var s = document.getElementById(p[0]), i = document.getElementById(p[1]);
    if(!s || !i) return;
    i.disabled = (s.value === 'x' || s.value === 'star');
  });
}
window.syncOpInputs = syncOpInputs;
OP_PAIRS.forEach(function(p){ var s = document.getElementById(p[0]); if(s) s.addEventListener('change', syncOpInputs); });

document.getElementById('ns').addEventListener('keydown',function(e){if(e.key==='Enter')run();});
document.getElementById('rs').addEventListener('keydown',function(e){if(e.key==='Enter')run();});

function chk(f){ return Array.from(document.querySelectorAll('[data-f="'+f+'"]:checked')).map(function(x){return x.value;}); }

function numOk(op,vs,fv){
  if(!op||fv==='') return true;
  var cv=parseFloat(vs),fvn=parseFloat(fv);
  if(isNaN(cv)||isNaN(fvn)) return false;
  return op==='eq'?cv===fvn:op==='lt'?cv<fvn:cv>fvn;
}

var _allFiltered = [];
var _sagaEnabledTotal = null;
var _pageSize = 50;
var _curPage  = 0;
/* run() is called for far more than a filter change (a save, a return to the tab), so the page is kept unless the filter or sort changed. */
var _pageSig = null;

function setPageSize(v){
  _pageSize = parseInt(v)||20;
  _curPage  = 0;
  renderPage();
}

function goPage(delta){
  var maxPage = Math.max(0, Math.ceil(_allFiltered.length/_pageSize)-1);
  _curPage = Math.max(0, Math.min(_curPage+delta, maxPage));
  renderPage();
}

/* Only a real change redraws: Enter and the blur after it would otherwise draw the same page twice. */
function goToPage(v){
  var total = Math.max(1, Math.ceil(_allFiltered.length/_pageSize));
  var n = parseInt(String(v == null ? '' : v).trim(), 10);
  var box = document.getElementById('pgNum');
  if(isNaN(n)){ if(box) box.value = _curPage + 1; return; }
  var to = Math.max(0, Math.min(n - 1, total - 1));
  if(to === _curPage){ if(box) box.value = _curPage + 1; return; }
  _curPage = to;
  renderPage();
  /* renderPage skips a focused box, so this one is written here: 999 reads back as the last page. */
  if(box) box.value = _curPage + 1;
}
window.goToPage = goToPage;
(function(){
  var box = document.getElementById('pgNum');
  if(!box) return;
  box.addEventListener('keydown', function(ev){
    if(ev.key === 'Enter'){ ev.preventDefault(); goToPage(box.value); box.select(); }
    else if(ev.key === 'Escape'){ box.value = _curPage + 1; box.blur(); }
  });
  box.addEventListener('blur', function(){ goToPage(box.value); });
  box.addEventListener('focus', function(){ try{ box.select(); }catch(_){} });
})();

function renderPage(){
  var start = _curPage * _pageSize;
  var end   = Math.min(start + _pageSize, _allFiltered.length);
  var page  = _allFiltered.slice(start, end);

  var ri = document.getElementById('ri');
  /* The cards you can reach, not CARDS.length: a disabled saga's cards are in no result and must not be in the total. */
  var _tot;
  if(_sagaEnabledTotal!=null) _tot=_sagaEnabledTotal;
  else if(typeof window.edSagaEnabled==='function'){
    _tot=CARDS.filter(function(c){
      var sid=(typeof window.edSagaOf==='function')?window.edSagaOf(c):(c.sagaId||c.saga||'');
      return window.edSagaEnabled(sid);
    }).length;
  } else _tot=CARDS.length;
  if(ri) ri.innerHTML='Showing <strong>'+_allFiltered.length+'</strong> of <strong>'+_tot+'</strong> cards';

  var total = Math.ceil(_allFiltered.length/_pageSize)||1;
  var pgNum = document.getElementById('pgNum'), pgTot = document.getElementById('pgTot');
  if(pgNum && document.activeElement !== pgNum) pgNum.value = _curPage + 1;
  if(pgTot) pgTot.textContent = total;

  var prev = document.getElementById('pgPrev');
  var next = document.getElementById('pgNext');
  if(prev) prev.disabled = _curPage<=0;
  if(next) next.disabled = _curPage>= total-1;

  var pgRange = document.getElementById('pgRange');
  if(pgRange) pgRange.textContent = _allFiltered.length>0 ? 'Showing '+(start+1)+' \u2013 '+end+' of '+_allFiltered.length : '';

  var pgBar = document.getElementById('pgBar');
  if(pgBar) pgBar.style.display = total>1 ? '' : 'none';

  drawPage(page);
  if(typeof mobOnRender === 'function') mobOnRender();
}

/* Fused in either form: the old "4A"/"1H" suffix or the editor's orbs[i].type; reading the suffix alone misses every edited card. */
function hasFusedStat(card, kind){
  var want = (kind==='A') ? 'attack and arcane' : 'health and arcane';
  var orbs = card.orbs;
  if(Array.isArray(orbs)){
    for(var i=0;i<orbs.length;i++){ if(orbs[i] && orbs[i].type===want) return true; }
  }
  var arc = card.arcane;
  return !!(arc && String(arc).toUpperCase().endsWith(kind));
}

/* One filter for the browse sidebar and the Rewards specification (HANDOFF §32). Every field is optional, and absent means "do not ask";
   nothing here reads the DOM, as both callers read their controls once, above their loop. */
/* Every plain-text export writes rules through this: a choice card's choice line first, then one em-dash line per option,
   each kept to one line (a section name before a colon), as the dash is what marks an option. */
function cardPlainRules(c){
  if(!c) return '';
  var n = parseInt(c.rulesSplit, 10) || 0;
  var secs = Array.isArray(c.sections) ? c.sections : null;
  if(!(c.splitChoice && n && secs)) return String(c.ruleText || '');
  var out = [];
  var head = String(c.choiceText || '').trim();
  if(head) out.push(head);
  var lim = Math.min(n, secs.length);
  for(var i = 0; i < lim; i++){
    var s = secs[i] || {};
    var t = String(s.text || '').replace(/\s*\n+\s*/g, ' ').trim();
    var nm = String(s.name || '').trim();
    if(!t && !nm) continue;
    out.push('— ' + (nm ? (t ? nm + ': ' + t : nm) : t));
  }
  return out.length ? out.join('\n') : String(c.ruleText || '');
}
window.cardPlainRules = cardPlainRules;

/* The text a card is searched by: c.ruleText may lack a split card's printed sections and its choice line (HANDOFF §32.3).
   Fixed in the reader, not by another writer; a card with neither returns c.ruleText itself, one property read. */
function cardRuleText(c){
  var rt = (c && c.ruleText) || '';
  if(!c || (!c.rulesSplit && !c.choiceText)) return rt;
  var out = rt;
  var secs = c.sections;
  if(Array.isArray(secs)){
    /* Only the printed sections: a card cut from four to two keeps the other two's text for undo (edSetRulesSplit). */
    var n = parseInt(c.rulesSplit, 10) || 0;
    var lim = n ? Math.min(n, secs.length) : secs.length;
    for(var i = 0; i < lim; i++){
      var t = secs[i] && secs[i].text;
      if(t && out.indexOf(t) < 0) out += '\n\n' + t;
    }
  }
  if(c.choiceText && out.indexOf(c.choiceText) < 0) out += '\n\n' + c.choiceText;
  return out;
}
function catFilterPred(f){
  f=f||{};
  var nq=f.nq||'', rq=f.rq||'', rtMode=f.rtMode||'exact';
  var cm=f.cm||'any',  scc=f.scc||[];
  var sm=f.sm||'any',  ss=f.ss||[];
  var sbm=f.sbm||'any',sbt=f.sbt||[];
  var cop=f.cop||'',   cval=(f.cval==null?'':f.cval);
  var aop=f.aop||'',   aval=(f.aval==null?'':f.aval);
  var hop=f.hop||'',   hval=(f.hval==null?'':f.hval);
  var arop=f.arop||'', arval=(f.arval==null?'':f.arval);
  var rop=f.rop||'',   rval=(f.rval==null?'':f.rval);
  var atkArc=!!f.atkArc, hpArc=!!f.hpArc, dateF=f.dateF||'', sc=scc;
  /* "Contains X" ('x') and "Contains *" ('star') are dropdown ops that turn the comparison off, as numOk reads an op it does not know as "Greater".
     An old link's x, atkA, hpA, arcA and rngA become these ops in _filterLegacy (cat_tail.js). */
  var xCost=(cop==='x'), atkStar=(aop==='star'), hpStar=(hop==='star'),
      arcStar=(arop==='star'), rngStar=(rop==='star');
  if(xCost) cop='';
  if(atkStar) aop='';
  if(hpStar) hop='';
  if(arcStar) arop='';
  if(rngStar) rop='';
  return function(c){

    /* A split card is findable by its sections' own names, types and costs, and is still one card. edAnyIdent, not c.splitIdent:
       one section may be individual with the card's switch off. */
    var _si=(typeof window.edAnyIdent==='function')?window.edAnyIdent(c):!!c.splitIdent;
    var sf=_si?((typeof window.edSplitFacets==='function')?window.edSplitFacets(c):null):null;
    /* Every field read guarded (HANDOFF §32.4): a thrown filter callback shows only as an empty grid, and the Rewards panel runs this over any import. */
    if(nq&&String(c.name||'').toLowerCase().indexOf(nq)<0
       &&!(sf&&sf.names.some(function(n){return n.toLowerCase().indexOf(nq)>=0;}))) return false;
    if(rq){
      var rtLower = cardRuleText(c).toLowerCase();
      if(rtMode==='exact'){
        if(rtLower.indexOf(rq)<0) return false;
      } else if(rtMode==='all'){
        var words = rq.split(/\s+/).filter(function(w){return w;});
        if(!words.every(function(w){return rtLower.indexOf(w)>=0;})) return false;
      } else if(rtMode==='any'){
        var words = rq.split(/\s+/).filter(function(w){return w;});
        if(!words.some(function(w){return rtLower.indexOf(w)>=0;})) return false;
      }
    }
    if(xCost&&String(c.manaCost||'').toUpperCase().indexOf('X')<0) return false;
    if(atkStar&&c.attack!=='*') return false;
    if(hpStar&&c.health!=='*') return false;
    if(arcStar&&c.arcane!=='*') return false;
    if(rngStar&&c.range!=='*') return false;
    if(atkArc&&!hasFusedStat(c,'A')) return false;
    if(hpArc&&!hasFusedStat(c,'H')) return false;
    if(sc.length){
      var cc=_catArr(c.colors).map(function(x){return String(x).toLowerCase();});
      /* Section colours widen "any" and "all" only: "noother" and "exact" ask what the card itself is made of (HANDOFF §32.5). */
      var ccAny=(sf&&sf.colors.length)?cc.concat(sf.colors):cc;
      if(cm==='any'&&!scc.some(function(x){return ccAny.indexOf(x)>=0;})) return false;
      if(cm==='all'&&!scc.every(function(x){return ccAny.indexOf(x)>=0;})) return false;
      if(cm==='noother'&&(cc.length===0||cc.some(function(x){return scc.indexOf(x)<0;}))) return false;
      if(cm==='exact'&&!(scc.length===cc.length&&scc.every(function(x){return cc.indexOf(x)>=0;}))) return false;
    }
    if(ss.length){
      var ct=_catArr(c.superTypes).map(function(x){return String(x).toLowerCase();});
      if(sf&&sf.superTypes.length)
        ct=ct.concat(sf.superTypes.map(function(x){return x.toLowerCase();}));
      /* ss and sbt arrive lowercased (getSUTerms, getSTTerms, tdRewSpec), so they are not mapped again per card. */
      if(sm==='any'&&!ss.some(function(x){return ct.indexOf(x)>=0;})) return false;
      if(sm==='all'&&!ss.every(function(x){return ct.indexOf(x)>=0;})) return false;
      /* "none" reads the widened list too: a card with a Spell section has a Spell on it. */
      if(sm==='none'&&ss.some(function(x){return ct.indexOf(x)>=0;})) return false;
    }
    if(sbt.length){
      var _subs=_catArr(c.subTypes).map(function(x){return String(x).toLowerCase();});
      if(sf&&sf.subTypes.length)
        _subs=_subs.concat(sf.subTypes.map(function(x){return x.toLowerCase();}));
      /* Each term against each sub-type, not their join, which let "t bir" match Bolt and Bird (HANDOFF §32.7).
         Substring within one sub-type is kept, while the Super Type box matches whole types (HANDOFF §32.6, §10 O2). */
      var subHit=function(term){
        return _subs.some(function(s){ return s.indexOf(term)>=0; });
      };
      if(sbm==='any'&&!sbt.some(subHit)) return false;
      if(sbm==='all'&&!sbt.every(subHit)) return false;
      if(sbm==='none'&&sbt.some(subHit)) return false;
    }
    /* sf.costs are converted already: computeCmc is inside the editor's IIFE, out of reach here. */
    if(!numOk(cop,c.cmc,cval)
       &&!(sf&&sf.costs.some(function(n){ return numOk(cop,n,cval); })))
      return false;
    if(!numOk(aop,c.attack,aval)) return false;
    if(!numOk(hop,c.health,hval)) return false;
    if(!numOk(arop,c.arcane,arval)) return false;
    if(!numOk(rop,c.range,rval)) return false;
    if(dateF && c.lastUpdated && c.lastUpdated < dateF) return false;
    return true;
  };
}

function run(){
  try{ closeMobileSidebar(); }catch(_){}
  var nq=document.getElementById('ns').value.trim().toLowerCase();
  var rq=document.getElementById('rs').value.trim().toLowerCase();
  var cm=(document.getElementById('cmSel')||{}).value||'any';
  var sm=(document.getElementById('stmSel')||{}).value||'any';
  var ss=getSUTerms();
  var sbm=(document.getElementById('sbmSel')||{}).value||'any';
  var sbt=getSTTerms();
  var cop=document.getElementById('cop').value,  cval=document.getElementById('cval').value;
  var aop=document.getElementById('aop').value,  aval=document.getElementById('aval').value;
  var hop=document.getElementById('hop').value,  hval=document.getElementById('hval').value;
  var arop=document.getElementById('arop').value, arval=document.getElementById('arval').value;
  /* Range controls only exist in Rebirth, so read them defensively */
  var _rop=document.getElementById('rop'), _rval=document.getElementById('rval');
  var rop=_rop?_rop.value:'', rval=_rval?_rval.value:'';
  /* Read once, not in the filter callback, where each would be a getElementById per card. */
  var rtMode=(document.getElementById('rtMode')||{}).value||'all';
  var dateF=(document.getElementById('dateFilter')||{}).value||'';
  var scc=chk('color').map(function(x){return x.toLowerCase();});
  /* Guarded: one renamed or mode-gated checkbox read bare would blank the whole grid. */
  var ck=function(id){ return !!(document.getElementById(id)||{}).checked; };
  var atkArc=ck('atkarc');
  var hpArc=ck('hparc');

  /* A disabled saga's cards drop out here with CARDS untouched, so re-enabling is instant; a deck that lists one still shows it. */
  var _sagaSel=(document.getElementById('fsaga')||{}).value||'';
  /* Counted on this pass and kept for renderPage, which would otherwise walk every card again on each page turn. */
  var _enabledTotal=0;
  var out=CARDS.filter(function(c){
    if(typeof window.edSagaEnabled==='function'){
      var sid=(typeof window.edSagaOf==='function')?window.edSagaOf(c):(c.sagaId||c.saga||'');
      if(!window.edSagaEnabled(sid)) return false;
      if(_sagaSel && sid!==_sagaSel) return false;
    }
    _enabledTotal++;
    return true;
  }).filter(catFilterPred({
    nq:nq, rq:rq, rtMode:rtMode,
    cm:cm, scc:scc, sm:sm, ss:ss, sbm:sbm, sbt:sbt,
    cop:cop, cval:cval, aop:aop, aval:aval, hop:hop, hval:hval,
    arop:arop, arval:arval, rop:rop, rval:rval,
    atkArc:atkArc, hpArc:hpArc, dateF:dateF
  }));
  var sorted = applySorts(out);
  _allFiltered = sorted;
  _sagaEnabledTotal = _enabledTotal;
  /* A signature of the inputs, not the result: a saved card rebuilds the list as a new array, which must not reset the page. */
  var sig = JSON.stringify([nq, rq, cm, sm, ss, sbm, sbt, cop, cval, aop, aval,
    hop, hval, arop, arval, rop, rval,
    atkArc, hpArc, dateF, rtMode, scc, _enabledTotal,
    (typeof _sortPrimary !== 'undefined' ? _sortPrimary : null),
    (typeof sortCols !== 'undefined' ? sortCols : null)]);
  if(sig !== _pageSig){ _curPage = 0; _pageSig = sig; }
  else {
    /* Clamped: deleting the last card on the last page would leave "Page 6 / 5" over an empty grid. */
    var maxPage = Math.max(0, Math.ceil(_allFiltered.length / _pageSize) - 1);
    if(_curPage > maxPage) _curPage = maxPage;
  }
  renderPage();
  _hashSaveFilters();
}

/* Rules text's own <b>, <i> and <u>, drawn as the face draws them, in escaped text; one left open is closed at the end of the
   text, so what is drawn after the rules does not inherit it, and a closer with nothing open is dropped. */
function fmtRuleTags(t){
  var open=[];
  t=t.replace(/&lt;(\/?)(b|i|u)&gt;/g,function(m,sl,tg){
    if(!sl){ open.push(tg); return '<'+tg+'>'; }
    var at=open.lastIndexOf(tg);
    if(at<0) return '';
    open.splice(at,1);
    return '</'+tg+'>';
  });
  while(open.length) t+='</'+open.pop()+'>';
  return t;
}
function fmtRule(text){
  if(!text) return '';
  var t=String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  t=fmtRuleTags(t);
  var _lk=[]; t=cardLinksHold(t,_lk);        /* before the [x] rule below */
  t=t.replace(/\n/g,'<br>');
  /* The face's token pattern, not anything in braces: {mana in any combination of R} stays words, as on the face. */
  t=t.replace(/\{([A-Za-z0-9\/]+)\}/g,function(match,inner){ return renderManaCost(inner,16); });
  t=t.replace(/\[([^\]]+)\]/g,'<strong class="rkw">[$1]</strong>');
  t=t.replace(/(^|<br>)(---|___)/g,'$1<span class="rdv"></span>');
  if(typeof linkKeywords === 'function' && document.getElementById('kwdata')) {
    t = linkKeywords(t);
  }
  return cardLinksPut(t,_lk);
}

/* [[Card Name]] is stored literally in ruleText; as [x] is a bold keyword, every renderer (fmtRule, fmtRuleInline, fmtRuleNoLinks, symbolizeRules) takes [[ ]] first.
   The placeholder is tag-shaped: escaped text holds no real <, and pillifyRules skips tags, with no control characters needed (HANDOFF §0). */
var CARD_LINK_RE = /\[\[([^\[\]\n]{1,120})\]\]/g;

function cardLinkNames(txt){
  var out = [], seen = {}, m;
  CARD_LINK_RE.lastIndex = 0;
  while((m = CARD_LINK_RE.exec(String(txt || ''))) !== null){
    var n = m[1].trim();
    if(n && !seen[n.toLowerCase()]){ seen[n.toLowerCase()] = 1; out.push(n); }
  }
  return out;
}
window.cardLinkNames = cardLinkNames;

/* The quotes only: every caller escapes & < >, but not all escape ', which cut A'Lis to "A" (HANDOFF §14.3). */
function cardLinkAttr(s){
  return String(s).replace(/'/g, '&#39;').replace(/"/g, '&quot;');
}
function cardLinkHTML(escName){
  return "<span class='cardlink' data-card='" + cardLinkAttr(escName) + "'><b><u>"
       + escName + "</u></b></span>";
}
window.cardLinkHTML = cardLinkHTML;

function cardLinksHold(escText, box){
  return String(escText).replace(CARD_LINK_RE, function(_m, nm){
    box.push(nm.trim()); return '<clink' + (box.length - 1) + '>';
  });
}
function cardLinksPut(html, box){
  if(!box.length) return html;
  return String(html).replace(/<clink(\d+)>/g, function(_m, i){
    return cardLinkHTML(box[+i]);
  });
}
window.cardLinksHold = cardLinksHold;
window.cardLinksPut  = cardLinksPut;

/* One delegated listener for every face and rules string. Anchored to the link, not the pointer, so no mousemove listener runs;
   the preview is pointer-events:none, or it would steal the hover from the link and flicker. */
var _clTimer = null, _clOpen = null;

function cardLinkFind(name){
  var n = String(name||'').toLowerCase().replace(/[’']/g,'').trim();
  if(!n) return null;
  var list = window.CARDS || [];
  for(var i = 0; i < list.length; i++){
    var c = list[i];
    if(c && c.name && c.name.toLowerCase().replace(/[’']/g,'') === n) return c;
  }
  return null;
}
window.cardLinkFind = cardLinkFind;

function cardLinkPreviewHide(){
  if(_clTimer){ clearTimeout(_clTimer); _clTimer = null; }
  var el = document.getElementById('clPreview');
  if(el) el.remove();
  _clOpen = null;
}
window.cardLinkPreviewHide = cardLinkPreviewHide;

function cardLinkPreviewShow(el, name){
  cardLinkPreviewHide();
  _clOpen = name;
  var box = document.createElement('div');
  box.id = 'clPreview'; box.className = 'cl-preview';
  var card = cardLinkFind(name);
  if(!card){
    box.className += ' cl-preview-miss';
    box.textContent = 'No card named “' + name + '”';
  } else if(typeof window.edCardFaceHTML === 'function'){
    box.innerHTML = "<div class='mcard-fit'>" + window.edCardFaceHTML(card) + "</div>";
  } else {
    box.className += ' cl-preview-miss';
    box.textContent = name;
  }
  document.body.appendChild(box);
  if(card && typeof window.edFitFaces === 'function'){
    try{ window.edFitFaces(box); }catch(_){}
  }
  var r = el.getBoundingClientRect(), b = box.getBoundingClientRect();
  var x = r.left, y = r.bottom + 8;
  if(y + b.height > window.innerHeight - 8) y = r.top - b.height - 8;
  if(y < 8) y = 8;
  if(x + b.width > window.innerWidth - 8) x = window.innerWidth - b.width - 8;
  box.style.left = Math.max(8, x) + 'px';
  box.style.top  = y + 'px';
}

document.addEventListener('mouseover', function(ev){
  var t = ev.target && ev.target.closest ? ev.target.closest('.cardlink') : null;
  if(!t){ if(_clOpen || _clTimer) cardLinkPreviewHide(); return; }
  var name = t.getAttribute('data-card') || t.textContent;
  if(_clOpen === name) return;
  if(_clTimer) clearTimeout(_clTimer);
  /* a short wait, so crossing a link on the way somewhere else shows nothing */
  _clTimer = setTimeout(function(){ _clTimer = null; cardLinkPreviewShow(t, name); }, 140);
}, true);
document.addEventListener('scroll', function(){ if(_clOpen||_clTimer) cardLinkPreviewHide(); }, true);
document.addEventListener('keydown', function(ev){
  if(ev.key === 'Escape' && (_clOpen || _clTimer)) cardLinkPreviewHide();
});

function stripRuleFmt(s){
  return String(s||'').replace(/<\/?[biu]>/g,'').replace(CARD_LINK_RE, '$1');
}
function fmtRuleInline(text){
  if(!text) return '';
  var t=String(text).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  t=fmtRuleTags(t);
  var _lk=[]; t=cardLinksHold(t,_lk);        /* before the [x] rule below */
  t=t.replace(/\n/g,'<br>');
  t=t.replace(/\{([A-Za-z0-9\/]+)\}/g,function(match,inner){ return renderManaCost(inner,14); });
  t=t.replace(/\[([^\]]+)\]/g,'<strong class="rkw">[$1]</strong>');
  return cardLinksPut(t,_lk);
}

function fmtRuleNoLinks(text){
  if(!text) return '';
  var t=text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  t=fmtRuleTags(t);
  var _lk=[]; t=cardLinksHold(t,_lk);        /* before the [x] rule below */
  t=t.replace(/\n/g,'<br>');
  t=t.replace(/\{([A-Za-z0-9\/]+)\}/g,function(match,inner){ return renderManaCost(inner,16); });
  t=t.replace(/\[([^\]]+)\]/g,'<strong class="rkw">[$1]</strong>');
  t=t.replace(/(^|<br>)(---|___)/g,'$1<span class="rdv"></span>');
  return cardLinksPut(t,_lk);
}

/* Off, as the markup's toggle is unchecked, so the first paint matches before any script runs. */
var _showCardInfo = false;
function toggleCardInfo(checked){
  _showCardInfo = (checked !== undefined) ? checked : !_showCardInfo;
  var tog = document.getElementById('infoToggle');
  if(tog) tog.checked = _showCardInfo;
  var sel = '#cg .ci, #dv-cg .ci, #dv-ess-cg .ci, #dv-wish-cg .ci, #dv-arm-cg .ci';
  if(curView === 'grid'){
    document.querySelectorAll(sel).forEach(function(el){
      el.classList.toggle('hide-info', !_showCardInfo);
    });
  }
}
var curView = 'grid';

function _syncHideInfo(){
  if(curView !== 'grid') return;
  var sel = '#cg .ci, #dv-cg .ci, #dv-ess-cg .ci, #dv-wish-cg .ci, #dv-arm-cg .ci';
  document.querySelectorAll(sel).forEach(function(el){
    el.classList.toggle('hide-info', !_showCardInfo);
  });
}

var _ESSENCE_COLOR_MAP = {
  'Ire':'Red','Vig':'Orange','Lux':'Yellow',
  'Arch':'Green','Yune':'Blue','Psy':'Indigo','Gris':'Violet'
};

function _essenceBottomArea(card, isDetails){
  var superArr = _catArr(card.superTypes).map(function(s){return String(s).toLowerCase();});
  var isEssence = superArr.indexOf('essence') >= 0;
  if(!isEssence) return null;

  var isCoreEssence = superArr.indexOf('core') >= 0;
  var isDualEssence = superArr.indexOf('dual') >= 0;

  var allImgUrls = [];
  _catArr(card.subTypes).forEach(function(st){
    var col = _ESSENCE_COLOR_MAP[st], url = col ? (CICO[col]||'') : '';
    if(url && allImgUrls.indexOf(url)<0) allImgUrls.push(url);
  });

  var maxIcons = isCoreEssence ? 1 : isDualEssence ? 2 : 3;
  var icons = allImgUrls.slice(0, maxIcons);

  if(icons.length === 0){
    return isDetails ? '' : '<div class="ci-ess" style="flex:1;aspect-ratio:409/571"></div>';
  }

  var count = icons.length;
  var sz;
  if(isCoreEssence)      sz = isDetails ? '56px' : '80px';
  else if(isDualEssence) sz = isDetails ? '44px' : '60px';
  else if(count===1)     sz = isDetails ? '50px' : '70px';
  else if(count===2)     sz = isDetails ? '38px' : '54px';
  else                   sz = isDetails ? '32px' : '46px';

  var imgTags = icons.map(function(url){
    return '<img src="'+url+'" style="width:'+sz+';height:'+sz+';image-rendering:crisp-edges;margin:0 4px;border-radius:50%">';
  });

  var areaStyle = isDetails
    ? 'flex:1;display:flex;align-items:center;justify-content:center;flex-wrap:wrap;padding:10px 6px'
    : 'flex:1;display:flex;align-items:center;justify-content:center;flex-wrap:wrap;padding:12px;aspect-ratio:409/571';
  return '<div class="ci-ess" style="'+areaStyle+'">'+imgTags.join('')+'</div>';
}

/* One listener per container, attached once (host.__deleg), as the containers survive innerHTML='';
   the card is read off the node, so two cards sharing a name never open each other. */
function _cardFromEvent(ev, sel){
  var el=ev.target.closest?ev.target.closest(sel):null;
  return el&&el.__card?el:null;
}
function _delegateCardClicks(host, sel){
  if(!host||host.__deleg)return;
  host.__deleg=1;
  host.addEventListener('click',function(ev){
    var b=ev.target.closest?ev.target.closest('.ci-qbtn'):null;
    var node=_cardFromEvent(ev, sel);
    if(b && node){
      ev.stopPropagation();
      deckButtonPress(node, b.classList.contains('rem') ? -1 : 1);
      return;
    }
    if(node) openMod(node.__card);
  });
  host.addEventListener('keydown',function(ev){
    if(ev.key!=='Enter' && ev.key!==' ' && ev.key!=='Spacebar') return;
    if(ev.altKey || ev.ctrlKey || ev.metaKey) return;
    var node=_cardFromEvent(ev, sel);
    if(!node || ev.target!==node) return;
    ev.preventDefault();
    openMod(node.__card);
  });
}
function _cardOpenable(el, card){
  el.tabIndex = 0;
  el.setAttribute('aria-label', String((card && card.name) || 'Card'));
  if(el.tagName !== 'TR'){ el.setAttribute('role', 'button'); el.setAttribute('aria-haspopup', 'dialog'); }
}

/* Nothing is baked, so an empty catalogue may still be waiting for the official set (edGhEmptyState says which); "No cards match." needs cards. */
function _emptyState(em){
  var p = em.querySelector('p');
  if(!p) return;
  var old = em.querySelector('.empty-act'); if(old) old.remove();
  var s = null;
  if(!REBIRTH && !(CARDS||[]).length){
    try{ s = (typeof window.edGhEmptyState === 'function') ? window.edGhEmptyState()
                                                            : {line:'Loading the official catalogue…'}; }
    catch(_){ s = null; }
  }
  p.textContent = s ? s.line : 'No cards match.';
  if(s && s.btn){
    var b = document.createElement('button');
    b.className = 'ed2-btn primary empty-act';
    b.textContent = s.btn;
    b.onclick = function(){ if(typeof window.edGhUpdateNow === 'function') window.edGhUpdateNow(); };
    em.appendChild(b);
  }
}
function tdClampHTML(s){
  return s ? '<span class="td-clamp" title="' + e(s) + '">' + e(s) + '</span>' : '\u2014';
}
function drawPage(cards){
  var g=document.getElementById('cg');
  var tb=document.getElementById('ctb');
  var em=document.getElementById('empty');
  // Here too, as the first render comes from run(), not setView().
  g.classList.toggle('view-details', curView==='details');
  _delegateCardClicks(g,  '.ci');
  _delegateCardClicks(tb, 'tr');
  g.innerHTML=''; tb.innerHTML='';
  if(!_allFiltered.length){ _emptyState(em); em.style.display='block'; return; }
  em.style.display='none';

  var thead=document.querySelector('#ct thead tr');
  if(thead){
    thead.innerHTML=
      '<th class="th-ctl"></th>'+
      '<th style="width:40px" class="th-date"></th>'+
      makeSortTh('Name','name')+
      makeSortTh('Mana','mana')+
      makeSortTh('CMC','cmc')+
      '<th>Color</th>'+
      makeSortTh('Super','super')+
      makeSortTh('Sub','sub')+
      makeSortTh('ATK','atk')+
      makeSortTh('HP','hp')+
      makeSortTh('ARC','arc')+
      (REBIRTH?makeSortTh('RNG','rng'):'')+
      makeSortTh('Rule','rule');
    attachSortListeners(thead, false);
    updateHeaderIndicators();
  }

  /* The whole filtered list, not this page, or the card window's arrows dead-end at the page's last card. */
  _visibleCards = (typeof _allFiltered!=='undefined' && _allFiltered.length) ? _allFiltered : cards;
  var isDetails = curView === 'details';
  /* Only the visible half is built, tile or row; setView() re-runs, which builds the other. */
  var wantList = (curView === 'list');
  var wantGrid = !wantList;
  var _dc = deckCountsByName();
  cards.forEach(function(card,i){
    var _dcc = _dc[card.name] || null;
    var _ctl = deckCtrlHTML(_dcc, _dcc && _dcc.title);
   if(wantGrid){
    var item=document.createElement('div');
    item.className='ci';
    item.style.cssText='animation-delay:'+Math.min(i*0.015,0.28)+'s;position:relative';
    item.__card=card;
    _cardOpenable(item, card);
    var superStr=_catArr(card.superTypes).join(' ');
    var subStr=_catArr(card.subTypes).join(' ');
    var typeStr=(superStr&&subStr)?superStr+' \u2014 '+subStr:(superStr||subStr);
    var statStrip='';
    statStrip+=statStripHtmlFor(card);
    var statStripHtml = statStrip ? '<div style="display:flex;flex-direction:column;align-items:center;justify-content:flex-start;flex-shrink:0;padding-left:6px;margin-top:2px">'+statStrip+'</div>' : '';
    var bottomArea;
    var dateH = '';
    var essenceArea = _essenceBottomArea(card, isDetails);
    if(essenceArea !== null){
      bottomArea = essenceArea;
    } else if(isDetails){
      var rt = card.ruleText ? fmtRuleInline(card.ruleText) : '';
      bottomArea = '<div class="ci-dt"><div class="ci-dt-rule">'+rt+'</div>'+(card.lastUpdated?'<div class="ci-dt-date">'+_fmtDate(card.lastUpdated)+'</div>':'')+'</div>';
    } else {
      var _src = _artSrc(card);
      var _onerr = _src ? ' onerror="_imgErr(this)"' : '';
      dateH=card.lastUpdated?'<div class="ci-date" style="font-family:Crimson Pro,serif;font-size:.7rem;color:var(--td);text-align:center;padding:2px 0">'+_fmtDate(card.lastUpdated)+'</div>':'';
      var imgH=_src?'<img src="'+e(_src)+'" alt="" loading="lazy" data-cname="'+e(card.name)+'"'+_onerr+'>':'<div class="ci-ph">\uD83C\uDCA0</div>';
      bottomArea = '<div class="ci-img">'+imgH+'</div>';
    }
    item.innerHTML=
      '<div class="ci-inf" style="display:flex;align-items:flex-start">'+
        '<div style="flex:1;min-width:0">'+
          '<div class="ci-name">'+e(card.name)+'</div>'+
          '<div class="ci-mana">'+renderManaCost(card.manaCost,22)+'</div>'+
          (superStr?'<div class="ci-super">'+e(superStr)+'</div>':'')+
          (subStr?'<div class="ci-sub">'+e(subStr)+'</div>':'')+
        '</div>'+
        statStripHtml+
      '</div>'+
      dateH+
      bottomArea+
      _ctl;
    item.__ctlKey=_dcc ? (_dcc.count+'|'+_dcc.lord+'|'+_dcc.title) : '';
    g.appendChild(item);
   }
   if(wantList){
    var superStr=_catArr(card.superTypes).join(' ');
    var subStr=_catArr(card.subTypes).join(' ');
    var superArrList = _catArr(card.superTypes).map(function(s){return String(s).toLowerCase();});
    var isEssenceList = superArrList.indexOf('essence') >= 0;
    var isCDList = isEssenceList && (superArrList.indexOf('core')>=0 || superArrList.indexOf('dual')>=0);
    var isGenEssList = isEssenceList && !isCDList;
    var ruleCell;
    if(isCDList || isGenEssList){
      var essImgs2 = [];
      _catArr(card.subTypes).forEach(function(st){
        var col = _ESSENCE_COLOR_MAP[st], url = col ? (CICO[col]||'') : '';
        if(url) essImgs2.push(manaImg(url, col, 18));
      });
      ruleCell = essImgs2.join('') || '\u2014';
    } else {
      var _rt=stripRuleFmt(card.ruleText);
      var rp=_rt.replace(/\n/g,' ').substring(0,70)+(_rt.length>70?'\u2026':'');
      ruleCell = e(rp||'\u2014');
    }
    var tr=document.createElement('tr');
    tr.__card=card;
    _cardOpenable(tr, card);
    tr.__ctlKey=_dcc ? (_dcc.count+'|'+_dcc.lord+'|'+_dcc.title) : '';
    tr.innerHTML=
      '<td class="ci-ladd">'+_ctl+'</td>'+
      '<td class="td-date">'+_fmtDateList(card.lastUpdated)+'</td>'+
      '<td class="tdnm">'+e(card.name)+'</td>'+
      '<td>'+renderManaCost(card.manaCost,18)+'</td>'+
      '<td data-val="'+e(card.cmc||'')+'" style="font-weight:700">'+e(card.cmc||'\u2014')+'</td>'+
      '<td>'+cardColorIcons(card,18)+'</td>'+
      '<td class="td-wrap">'+tdClampHTML(superStr)+'</td>'+
      '<td class="td-wrap">'+tdClampHTML(subStr)+'</td>'+
      /* one <td> per cell statRowCells returns, not three: Rebirth's fourth, Range, must match the header */
      (function(_c){return statRowCells(_c).map(function(x){return '<td>'+x+'</td>';}).join('');})(card)+
      '<td style="max-width:175px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">'+ruleCell+'</td>';
    tb.appendChild(tr);
   }
  });
  if(wantList) requestAnimationFrame(fitListTables);
  if(isDetails) requestAnimationFrame(fitDetailsText);
  else requestAnimationFrame(function(){
    fitCardText();
    if(curView === 'grid'){
      document.querySelectorAll('#cg .ci').forEach(function(el){
        el.classList.toggle('hide-info', !_showCardInfo);
      });
      _initGridTilt(g);
    }
  });
}

/* A modal is a dialog: role, aria-modal, a focus trap and a focus restore, one implementation shared with edDangerGate and edChooseModal.
   Not a full inert/aria-hidden background: half done, that hides parts of the page from assistive tech for good. */
var _modalStack=[];
function modalOpen(el, opts){
  if(!el)return;
  opts=opts||{};
  el.setAttribute('role','dialog');
  el.setAttribute('aria-modal','true');
  if(opts.label) el.setAttribute('aria-label',opts.label);
  /* One entry per dialog: the card window calls this for every card the arrows reach, and extra traps kept Tab captured after it closed. */
  for(var k=0;k<_modalStack.length;k++){
    if(_modalStack[k].el!==el)continue;
    _modalStack[k].onClose=opts.onClose||null;
    _modalStack[k].escape=opts.escape;
    return;
  }
  var st={el:el, prev:document.activeElement, onKey:null, onClose:opts.onClose||null, escape:opts.escape};
  st.onKey=function(ev){
    /* Only the top dialog answers, or Escape over the card window would close both. */
    if(_modalTop()!==st)return;
    if(ev.key==='Escape'){
      if(st.escape===false)return;
      ev.stopPropagation();
      if(st.onClose)st.onClose(); else modalClose(el);
      return;
    }
    if(ev.key!=='Tab')return;
    var f=_focusables(el);
    if(!f.length){ ev.preventDefault(); return; }
    var first=f[0], last=f[f.length-1], a=document.activeElement;
    if(ev.shiftKey && (a===first || !el.contains(a))){ ev.preventDefault(); last.focus(); }
    else if(!ev.shiftKey && (a===last || !el.contains(a))){ ev.preventDefault(); first.focus(); }
  };
  document.addEventListener('keydown',st.onKey,true);
  _modalStack.push(st);
  /* after paint, so the element is visible and focusable */
  setTimeout(function(){
    var want=opts.focus||_focusables(el)[0]||el;
    if(want===el && !el.hasAttribute('tabindex')) el.setAttribute('tabindex','-1');
    try{ want.focus(); }catch(_){}
  },0);
}
function modalClose(el){
  for(var i=_modalStack.length-1;i>=0;i--){
    if(_modalStack[i].el!==el)continue;
    var st=_modalStack[i];
    document.removeEventListener('keydown',st.onKey,true);
    _modalStack.splice(i,1);
    el.removeAttribute('aria-modal');
    /* isConnected: the opener may have been re-rendered away meanwhile, as the browse grid does. */
    try{ if(st.prev && st.prev.isConnected && st.prev.focus) st.prev.focus(); }catch(_){}
    return;
  }
}
/* the newest dialog still in the page: one removed without modalClose must not keep the keys */
function _modalTop(){
  for(var i=_modalStack.length-1;i>=0;i--){ if(_modalStack[i].el.isConnected) return _modalStack[i]; }
  return null;
}
function _focusables(el){
  return Array.prototype.filter.call(
    el.querySelectorAll('a[href],button:not([disabled]),input:not([disabled]),'
      +'select:not([disabled]),textarea:not([disabled]),[tabindex]:not([tabindex="-1"])'),
    function(n){ return n.offsetWidth||n.offsetHeight||n.getClientRects().length; });
}
window.edModalOpen=modalOpen;
window.edModalClose=modalClose;

function openMod(card){
  cur=card;
  var _locked=(typeof window.edCardLocked==='function' && window.edCardLocked(card));
  /* an official card in a saga of yours opens in the editor for that saga's own values */
  var _open=(typeof window.edCardOpenable==='function') ? window.edCardOpenable(card) : !_locked;
  var _med=document.querySelector('.mo .medit');
  if(_med) _med.style.display = _open ? '' : 'none';
  var _canDup=!!_locked && !_open && typeof window.edDuplicateFromCard==='function';
  var _mdup=document.querySelector('.mo .mdup');
  if(_mdup) _mdup.style.display = _canDup ? '' : 'none';
  var _mo=document.querySelector('.mo');
  if(_mo) _mo.classList.toggle('no-edit', !_open && !_canDup);
  var _mdi=document.getElementById('mdi');
  var _faced=false;
  if(typeof window.edShowCardFace==='function'){
    try{ _faced=window.edShowCardFace(card,_mdi); }catch(_){ _faced=false; }
  }
  if(_faced){
    _3dOff(_mdi);                      // the face has its own tilt; no 3D wrapper
  } else if(_artSrc(card)){
    _mdi.innerHTML='<div class="mdi-inner"><img src="'+e(_artSrc(card))+'" alt="" data-cname="'+e(card.name)+'" onerror="_imgErrMdi(this)"><div class="mdi-reflect"></div></div>';
    _3dOn(_mdi);
  } else {
    _mdi.innerHTML=_ptFallback(card);
    _3dOff(_mdi);
  }

  var superStr=_catArr(card.superTypes).join(' ');
  var subStr=_catArr(card.subTypes).join(' ');
  var tl=(superStr&&subStr)?superStr+' \u2014 '+subStr:(superStr||subStr);

  var statsArr = [];
  if(typeof window.edCardOrbs === 'function' && typeof window.edOrbSvg === 'function'){
    try{
      (window.edCardOrbs(card) || []).forEach(function(o){
        statsArr.push('<div class="mst-orb">'+window.edOrbSvg(o.type,o.value,52)
          +'<span class="mst-lbl">'+e(window.edOrbLabel?window.edOrbLabel(o.type):o.type)+'</span></div>');
      });
    }catch(_){ statsArr = []; }
  }
  if(!statsArr.length){
    if(card.attack) statsArr.push(atkCellLg(card.attack,'Attack',card.arcane));
    if(card.health) statsArr.push(hpCellLg(card.health,'Health',card.arcane));
    var _arcMod=arcCellLg(card.arcane||'','Arcane'); if(_arcMod) statsArr.push(_arcMod);
  }
  var statsHtml = statsArr.length ? '<div class="mst">'+statsArr.join('')+'</div>' : '';

  var h='<div class="mnm">'+e(card.name)+'</div>';
  if(card.manaCost){
    h+='<div class="mco">'+renderManaCost(card.manaCost,26);
    if(card.cmc) h+='<span class="m-cmc">CMC&nbsp;'+e(card.cmc)+'</span>';
    /* On the cost row, not under Download, where it would need absolute positioning; so a card with no mana cost shows no date. */
    if(card.lastUpdated) h+='<span class="m-upd">Last Updated '+_fmtDate(card.lastUpdated)+'</span>';
    h+='</div>';
  }
  if(tl) h+='<div class="mty">'+e(tl)+'</div>';
  h+=statsHtml;
  var superArrMod = _catArr(card.superTypes).map(function(s){return String(s).toLowerCase();});
  var isEssenceMod = superArrMod.indexOf('essence') >= 0;
  var isCoreOrDualMod = isEssenceMod && (superArrMod.indexOf('core') >= 0 || superArrMod.indexOf('dual') >= 0);
  if(isCoreOrDualMod){
    var essImgs=[], essIsCore=superArrMod.indexOf('core')>=0, essSz=essIsCore?'80px':'64px';
    _catArr(card.subTypes).forEach(function(st){
      var col=_ESSENCE_COLOR_MAP[st], url=col?CICO[col]:'';
      if(url && essImgs.length<(essIsCore?1:2))
        essImgs.push('<img src="'+url+'" style="width:'+essSz+';height:'+essSz+';border-radius:50%;margin:0 8px;image-rendering:crisp-edges">');
    });
    if(essImgs.length) h+='<div style="display:flex;align-items:center;justify-content:center;padding:18px 0">'+essImgs.join('')+'</div>';
  }
  if(card.ruleText && !isCoreOrDualMod) h+='<div class="mdv"></div><div class="mrl">'+fmtRule(card.ruleText)+'</div>';

  var ruleTextPlain = String(card.ruleText || '');
  if(REBIRTH){
    var gearOnly = (typeof deckGearRoutes === 'function') && deckGearRoutes() && _isGearCard(card);
    var addWhere = gearOnly ? 'Armament' : 'Main Deck';
    h+='<div style="display:flex;gap:8px;margin-top:auto">'
      +'<button class="madd-3" id="maddbtn3" type="button" data-deck="'+(gearOnly ? 'armament' : 'main')+'" title="Add 3 copies" aria-label="Add 3 copies to the '+addWhere+'">+3</button>'
      +'<button class="madd" id="maddbtn" type="button" data-deck="'+(gearOnly ? 'armament' : 'main')+'" aria-label="Add to '+addWhere+'" style="flex:1">'+uiIco('plus')+' Add</button>'
      +(!gearOnly && _isArmamentLegal(card) ? '<button class="madd madd-wish madd-arm" id="maddbtn2" type="button" data-deck="armament" style="flex:0.9;font-size:.85rem;padding:13px 10px">'+uiIco('plus')+' Armament</button>' : '')
      +'</div>';
  } else if(isEssenceMod){
    h+='<button class="madd" id="maddbtn" type="button" data-deck="essence" aria-label="Add to Essence Deck">'+uiIco('plus')+' Add</button>';
  } else {
    h+='<div style="display:flex;gap:8px;margin-top:auto">'
      +'<button class="madd-3" id="maddbtn3" type="button" data-deck="main" title="Add 3 copies" aria-label="Add 3 copies to the Main Deck">+3</button>'
      +'<button class="madd" id="maddbtn" type="button" data-deck="main" aria-label="Add to Main Deck" style="flex:1">'+uiIco('plus')+' Add</button>'
      +'<button class="madd madd-wish" id="maddbtn2" type="button" data-deck="wish" style="flex:0.7;font-size:.85rem;padding:13px 10px">'+uiIco('plus')+' Wish</button>'
      +'</div>';
  }
  /* not a copy, as Duplicate makes: the official card itself, kept in step with the official set, in a saga of yours */
  var _mine=null;
  try{ if(_locked && typeof window.edMySagaFor==='function') _mine=window.edMySagaFor(card); }catch(_){ _mine=null; }
  h+='<div class="mlink-row"><button class="mlink" id="mlinkBtn" type="button" title="Copy a link that opens this card">'+uiIco('link')+' Link</button>'
    +(_mine ? '<button class="mlink msaga" id="msagaBtn" type="button" title="'+e('Put this official card in '+_mine.name
        +'. It keeps following the official card: name, cost, rules, stats and pictures. '+_mine.name
        +' sets its own flavor text, artist, Owner, watermark, border and reminders, and which picture it shows.')+'">Add to '
        +e(_mine.name)+'</button>' : '')
    +'</div>';

  document.getElementById('mdb').innerHTML=h;
  var _mlink=document.getElementById('mlinkBtn');
  if(_mlink) _mlink.addEventListener('click', function(){ copyCardLink(card, _mlink); });
  var _msaga=document.getElementById('msagaBtn');
  if(_msaga) _msaga.addEventListener('click', function(){
    closeMod();
    if(typeof window.edAddToMySaga==='function') window.edAddToMySaga(card);
  });
  var btn3 = document.getElementById('maddbtn3');
  if(btn3){
    btn3.addEventListener('click', function(){
      /* card, the parameter, not cur, which closeMod() nulls */
      adjustDeck(card.name, 3, 'dta-main');
    });
  }
  var btn1 = document.getElementById('maddbtn');
  var btn2 = document.getElementById('maddbtn2');
  if(btn1) btn1.addEventListener('click', function(){ addToDeckById(this.dataset.deck); });
  if(btn2) btn2.addEventListener('click', function(){ addToDeckById(this.dataset.deck); });

  var mkwEl = document.getElementById('mkw');
  var seenKw = {};
  var reminders = [];
  (KW_MATCHES || []).forEach(function(k){
    if(!k || typeof k.match !== 'string' || !k.match) return;
    /* No box for a keyword with no reminder: +1 and -1 counters have none by design (HANDOFF §10), and an empty box reads as a failed load. */
    if(!String(k.reminder || '').trim()) return;
    /* A whole word, as linkKeywords matches: "Heal" inside "Health" put the Heal reminder on cards that do not heal. */
    if(!seenKw[k.name] && _kwReminderRe(k).test(ruleTextPlain)){
      seenKw[k.name] = true;
      reminders.push(k);
    }
  });
  if(reminders.length){
    var rh = '<div class="mkw-title">Keyword Reminders</div>';
    reminders.forEach(function(k){
      var _nm = e(k.name), _txt = fmtRuleNoLinks(k.reminder);
      if(typeof window.edKwPillFor === 'function'){
        _nm = window.edKwPillFor(k.name);
        var _s = window.edKwReminderSplit && window.edKwReminderSplit(k.name, k.reminder);
        if(_s) _txt = fmtRuleNoLinks(_s.rest);
      }
      rh += '<div class="kw-reminder-box">'
        + '<span class="kw-reminder-name">'+_nm+'</span>'
        + '<span class="kw-reminder-text">'+_txt+'</span>'
        + '</div>';
    });
    mkwEl.innerHTML = rh;
    mkwEl.style.display = '';
    mkwEl.scrollTop = 0;
  } else {
    mkwEl.innerHTML = '';
    mkwEl.style.display = 'none';
  }

  var mdnBtn = document.getElementById('mdnBtn');
  /* _artSrc, not imageUrl: most cards keep their picture on a variant. */
  var _hasArt = !!_artSrc(card);
  if(mdnBtn) mdnBtn.style.display = _hasArt ? '' : 'none';
  var _mo=document.getElementById('mo');
  /* With no picture to download, Link moves up into Download's place in the stack (ed2_style.css). */
  _mo.classList.toggle('no-dn', !_hasArt || !mdnBtn);
  _mo.classList.add('on');
  _catTitleFor(card);
  /* Close first, as before the arrows stood outside the window and came first in its order. */
  modalOpen(_mo,{label:'Card details: '+(card&&card.name||''), onClose:closeMod, focus:_mo.querySelector('.mcl')});
  if(typeof mobOnCard === 'function') mobOnCard(card);
}
/* linkKeywords' word rule (nothing word-like or a hyphen either side), plus an optional s, es, ed or ing; cached per entry. */
var _kwRemRx = (typeof WeakMap === 'function') ? new WeakMap() : null;
function _kwReminderRe(k){
  var rx = _kwRemRx && _kwRemRx.get(k);
  if(rx && rx.__src === k.match) return rx;
  var pat = String(k.match).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  rx = new RegExp('(?<![\\w-])' + pat + '(?:s|es|ed|ing)?(?![\\w-])', 'i');
  rx.__src = k.match;
  if(_kwRemRx) _kwRemRx.set(k, rx);
  return rx;
}
window._kwReminderRe = _kwReminderRe;

var _catBaseTitle = null;
function _catTitleFor(card){
  if(_catBaseTitle === null) _catBaseTitle = document.title;
  document.title = card ? (String(card.name || 'Card') + ' — ' + _catBaseTitle) : _catBaseTitle;
}
function cardLinkUrl(card){
  var id = (card && card.cid) ? String(card.cid) : String((card && card.name) || '');
  var base = String(location.href).split(/[?#]/)[0];
  return base + '?card=' + encodeURIComponent(id) + (REBIRTH ? '&game=rebirth' : '');
}
window.cardLinkUrl = cardLinkUrl;
function _copyTextFallback(text){
  var ok = false, back = document.activeElement;
  try{
    var ta = document.createElement('textarea');
    ta.value = text; ta.setAttribute('readonly', '');
    ta.style.position = 'fixed'; ta.style.left = '-9999px'; ta.style.top = '0';
    document.body.appendChild(ta); ta.select();
    ok = !!document.execCommand('copy');
    ta.remove();
  }catch(_){ ok = false; }
  try{ if(back && back.focus) back.focus(); }catch(_){}
  return ok;
}
function copyCardLink(card, btn){
  var url = cardLinkUrl(card);
  function said(ok){
    if(btn){
      if(btn.__t) clearTimeout(btn.__t); else btn.__o = btn.innerHTML;
      btn.textContent = ok ? 'Link copied' : 'Copy failed';
      btn.__t = setTimeout(function(){ btn.innerHTML = btn.__o; btn.__t = 0; }, 1600);
    }
    if(!ok && typeof window.toast === 'function') window.toast('Could not copy the link. It is ' + url);
  }
  try{
    if(navigator.clipboard && typeof navigator.clipboard.writeText === 'function'){
      navigator.clipboard.writeText(url).then(function(){ said(true); },
        function(){ said(_copyTextFallback(url)); });
      return url;
    }
  }catch(_){}
  said(_copyTextFallback(url));
  return url;
}
window.copyCardLink = copyCardLink;

function closeMod(){
  var mo=document.getElementById('mo');
  mo.classList.remove('on');
  modalClose(mo);
  cur=null; _3dOff(document.getElementById('mdi'));
  if(_catBaseTitle !== null){ document.title = _catBaseTitle; _catBaseTitle = null; }
}
/* Closes the card window first, or it would stay over the editor that edEditCard switches to. */
function editCurrentCard(){
  var c=cur; if(!c)return;
  if(typeof window.edCardOpenable==='function' ? !window.edCardOpenable(c)
     : (typeof window.edCardLocked==='function' && window.edCardLocked(c))) return;
  closeMod();
  if(typeof window.edEditCard==='function')window.edEditCard(c.__id||c.name);
  else alert('The editor has not loaded yet.');
}
function dupCurrentCard(){
  var c=cur; if(!c)return;
  closeMod();
  if(typeof window.edDuplicateFromCard==='function')window.edDuplicateFromCard(c);
}
function closeOv(ev){ if(ev.target.id==='mo') closeMod(); }
var _dvVisibleCards = [];
function navigateMod(dir){
  if(!cur) return;
  var isDeck = document.getElementById('pane-deck') && document.getElementById('pane-deck').style.display !== 'none';
  var pool = isDeck ? _dvVisibleCards : _visibleCards;
  if(!pool.length) return;
  var idx = pool.indexOf(cur);
  if(idx < 0) return;
  var next = pool[idx + dir];
  if(next) openMod(next);
}
document.addEventListener('keydown',function(ev){
  if(ev.key==='Escape') closeMod();
  if(document.getElementById('mo').classList.contains('on')){
    if(ev.key==='ArrowLeft') navigateMod(-1);
    if(ev.key==='ArrowRight') navigateMod(1);
  }
});

/* INSTALL WEBSITE, UNINSTALLED: a service worker outlives its page, so any on this origin is unregistered and every conjure-* cache deleted, on every load.
   If Install Website comes back, remove this in the same commit, or it unregisters the new worker as soon as it registers. */
(function conjureDropOldWorker(){
  try{
    if(navigator.serviceWorker && navigator.serviceWorker.getRegistrations){
      navigator.serviceWorker.getRegistrations().then(function(regs){
        (regs||[]).forEach(function(r){ try{ r.unregister(); }catch(_){} });
      }).catch(function(){});
    }
  }catch(_){}
  try{
    if(window.caches && caches.keys){
      caches.keys().then(function(names){
        (names||[]).forEach(function(n){
          if(/^conjure-/.test(n)){ try{ caches.delete(n); }catch(_){} }
        });
      }).catch(function(){});
    }
  }catch(_){}
})();

