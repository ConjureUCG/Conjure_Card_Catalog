/* Part of the editor IIFE: what the markup calls must be put on window (HANDOFF §4). */

/* Must agree with the catalog's MLTR / COLOR_LETTER. */
var STAT_COLORS=[['R','Red'],['O','Orange'],['Y','Yellow'],['G','Green'],
                 ['B','Blue'],['I','Indigo'],['V','Violet']];
var STAT_HEX={Red:'#f9aa8f',Orange:'#e7af83',Yellow:'#fff799',Green:'#9bd3ae',
              Blue:'#aae0fa',Indigo:'#b298f0',Violet:'#e898de',Grey:'#b9bcc4'};

/* The same filter as Browse (edSagaEnabled, edSagaOf), so the two never disagree. */
function statsCards(){
  if(_statBrowse&&Array.isArray(window._allFiltered))return window._allFiltered.slice();
  return (window.CARDS||[]).filter(function(c){
    if(typeof window.edSagaEnabled!=='function')return true;
    var sid=(typeof window.edSagaOf==='function')?window.edSagaOf(c):(c.sagaId||c.saga||'');
    return window.edSagaEnabled(sid);
  });
}

/* manaPips() is the one counter; what it returns that is not one of the seven (Lock) is dropped, or it makes an eighth bar. */
function costPips(mc){
  var out={}; STAT_COLORS.forEach(function(p){ out[p[1]]=0; });
  var got=(typeof window.manaPips==='function')?window.manaPips(mc,1):{};
  Object.keys(got).forEach(function(name){
    if(out[name]!==undefined) out[name]+=got[name];
  });
  return out;
}
window.edCostPips=costPips;
/* A hybrid is a whole pip of each of its colours here: shared out, Pick Clean (G/V) was in neither Green's bars nor Violet's. */
function costPipsWhole(mc){
  var out={}; STAT_COLORS.forEach(function(p){ out[p[1]]=0; });
  if(typeof window.manaPips!=='function')return out;
  var s=String(mc||'').replace(/\s/g,''), re=/[A-Za-z](?:\/[A-Za-z])+|[^\/]/g, m;
  while((m=re.exec(s))){
    var tok=m[0], got=window.manaPips(tok,tok.split('/').length);
    Object.keys(got).forEach(function(name){
      if(out[name]!==undefined) out[name]+=got[name];
    });
  }
  return out;
}
window.edCostPipsWhole=costPipsWhole;

function statNum(v){ var m=/-?\d+/.exec(String(v==null?'':v)); return m?parseInt(m[0],10):null; }
function statWords(t){ var s=String(t||'').trim(); return s?s.split(/\s+/).length:0; }
function bucketBy(cards,keyFn){
  var order=[],map={};
  cards.forEach(function(c){
    var ks=keyFn(c); if(ks==null)return;
    if(!Array.isArray(ks))ks=[ks];
    ks.forEach(function(k){
      k=String(k);
      if(!map[k]){ map[k]=[]; order.push(k); }
      map[k].push(c);
    });
  });
  return order.map(function(k){ return {label:k,cards:map[k]}; });
}
function sortByCount(b){ return b.slice().sort(function(x,y){ return y.cards.length-x.cards.length; }); }

/* Read from the orbs, which the face draws: the flat fields are only a copy, on some cards made by position, not type.
   A card with no orbs (an old record) falls back to the flat fields. Answers null (no such stat), '*' or a number. */
var STAT_ORBS={attack:['attack','attack and arcane'],health:['health','health and arcane'],
  arcane:['arcane','attack and arcane','health and arcane'],range:['range']};
function statRead(c,k){
  var raw=null, orbs=c&&c.orbs;
  if(Array.isArray(orbs)&&orbs.length){
    for(var i=0;i<orbs.length;i++){
      var o=orbs[i], v=o?String(o.value==null?'':o.value).trim():'';
      if(o&&STAT_ORBS[k].indexOf(o.type)>=0&&v!==''){ raw=v; break; }
    }
  } else {
    var f=String(c&&c[k]!=null?c[k]:'').trim();
    if(k==='arcane')f=f.replace(/[AH]$/i,'');
    if(f!=='')raw=f;
  }
  if(raw==null)return null;
  if(raw.indexOf('*')>=0)return '*';
  var n=statNum(raw);
  return n==null?'*':n;
}
function statLinked(c){
  var orbs=c&&c.orbs;
  if(Array.isArray(orbs)&&orbs.length){
    for(var i=0;i<orbs.length;i++){
      var t=orbs[i]&&orbs[i].type;
      if(t==='attack and arcane')return 'A';
      if(t==='health and arcane')return 'H';
    }
    return '';
  }
  var m=/([AH])$/i.exec(String(c&&c.arcane||''));
  return m?m[1].toUpperCase():'';
}
/* None is asked only of cards with stats: a spell with no Arcane is not a Character missing one. */
function statCarrier(c){
  if((c.superTypes||[]).some(function(t){ return /^character$/i.test(String(t)); }))return true;
  return ['attack','health','arcane','range'].some(function(k){ return statRead(c,k)!=null; });
}
function statGraph(cards,k,hex){
  var b=statTint(numericBuckets(cards,function(c){
    var v=statRead(c,k); return (typeof v==='number')?v:null; },10),hex);
  var star=cards.filter(function(c){ return statRead(c,k)==='*'; });
  if(star.length)b.push({label:'*',cards:star,color:hex});
  var none=cards.filter(function(c){ return statRead(c,k)==null && statCarrier(c); });
  if(none.length)b.push({label:'None',cards:none,nobar:true});
  return b;
}
/* Grey is not a colour (it is the Object frame); a card that can be a Kingdoms Lord is every colour it can pay for.
   Memoised for one drawing of the window (statMemoReset): a table asks thousands of times. */
var _statColMemo=null;
function statMemoReset(){ _statColMemo=(typeof WeakMap==='function')?new WeakMap():null; }
function statList(v){ return (typeof edList==='function')?edList(v):(Array.isArray(v)?v:[]); }
function statHasType(list,re){ return statList(list).some(function(t){ return re.test(String(t).trim()); }); }
function statIsChar(c){ return statHasType(c&&c.superTypes,/^character$/i); }
function statLordCard(c){
  if(window.REBIRTH||!c)return false;
  if(!statHasType(c.superTypes,/^mythic$/i))return false;
  return statIsChar(c)||statHasType(c.subTypes,/^armament$/i);
}
var STAT_LETTER={}; STAT_COLORS.forEach(function(p){ STAT_LETTER[p[0]]=p[1]; });
/* A brace counts only as a mana symbol: one running across words ("{Only Arm ...") would make the card Orange. */
function statTextColours(t){
  var have={}, re=/\{([^{}\r\n]*)\}/g, m;
  while((m=re.exec(String(t||'')))){
    var s=m[1].trim(), any=/^mana (?:of )?in any combination of ([A-Za-z])$/i.exec(s);
    var letters=any?any[1]:(/^[ROYGBIVLX0-9\/]+$/i.test(s)?s:'');
    letters.toUpperCase().split('').forEach(function(ch){ if(STAT_LETTER[ch])have[STAT_LETTER[ch]]=1; });
  }
  return have;
}
function statColoursOf(c){
  if(!c)return [];
  if(_statColMemo&&typeof c==='object'){ var got=_statColMemo.get(c); if(got)return got; }
  var have={};
  statList(c.colors).forEach(function(x){ have[String(x).toLowerCase()]=1; });
  if(statLordCard(c)){
    var pips=costPipsWhole(c.manaCost), txt=statTextColours(c.ruleText);
    STAT_COLORS.forEach(function(p){
      if(pips[p[1]]>0||txt[p[1]])have[p[1].toLowerCase()]=1;
    });
  }
  var out=STAT_COLORS.filter(function(p){ return have[p[1].toLowerCase()]; });
  if(_statColMemo&&typeof c==='object')_statColMemo.set(c,out);
  return out;
}
window.edStatColoursOf=function(c){ return statColoursOf(c).map(function(p){ return p[1]; }); };
function statPipsHTML(letters,sz){
  if(!letters||typeof window.renderManaCost!=='function')return '';
  return window.renderManaCost(letters,sz||14);
}

/* Only light and shade (white and black at low alpha), so it sits over any colour without changing it. */
var STAT_METAL='linear-gradient(180deg,rgba(255,255,255,.62) 0%,rgba(255,255,255,.22) 30%,'
  +'rgba(0,0,0,.10) 48%,rgba(255,255,255,.12) 72%,rgba(0,0,0,.30) 100%)';
var STAT_GOLD='linear-gradient(180deg,#4a3818 0%,#7a6030 12%,#f5ecd0 36%,#e8c96a 50%,'
  +'#c9a84c 64%,#7a6030 88%,#4a3818 100%)';
function statSpread(parts){
  parts=(parts||[]).filter(function(p){ return p&&p.w>0; });
  if(!parts.length)return STAT_HEX.Grey;
  if(parts.length===1)return parts[0].hex;
  var tot=parts.reduce(function(n,p){ return n+p.w; },0), at=0;
  return 'linear-gradient(90deg,'+parts.map(function(p){
    var mid=(at+p.w/2)/tot*100; at+=p.w;
    return p.hex+' '+mid.toFixed(1)+'%';
  }).join(',')+')';
}
function statPipMix(cards){
  var sum={};
  cards.forEach(function(c){
    var p=costPips(c.manaCost);
    Object.keys(p).forEach(function(k){ sum[k]=(sum[k]||0)+p[k]; });
  });
  return STAT_COLORS.map(function(p){ return {hex:STAT_HEX[p[1]],w:sum[p[1]]||0}; });
}
function statBarBg(b){
  var base=b.fill||b.color;
  return base?(STAT_METAL+','+base):STAT_GOLD;
}
function statOrb(k){ return (typeof ORB_FILL!=='undefined'&&ORB_FILL[k])||STAT_HEX.Grey; }
function statTint(buckets,hex){ buckets.forEach(function(b){ b.color=hex; }); return buckets; }
function numericBuckets(cards,valFn,cap){
  var b=bucketBy(cards,function(c){
    var v=valFn(c); if(v==null)return null;
    return v>=cap?(cap+'+'):String(v);
  });
  return b.sort(function(x,y){
    var xa=/\+$/.test(x.label), ya=/\+$/.test(y.label);
    if(xa!==ya)return xa?1:-1;
    return parseInt(x.label,10)-parseInt(y.label,10);
  });
}

function statRules(c){ return String(c&&c.ruleText||''); }
function statEsc(s){ return String(s).replace(/[.*+?^${}()|[\]\\]/g,'\\$&'); }
/* fold ignores case: the keyterms list Delve, Grind and others twice. */
function statGloss(mode,fold){
  var seen={}, out=[];
  (window.KW_MATCHES||[]).forEach(function(k){
    if(!k||(k.mode||'keyword')!==mode||!k.name)return;
    var key=fold?String(k.name).toLowerCase():String(k.name);
    if(seen[key])return; seen[key]=1; out.push(k);
  });
  return out;
}
function statKwRe(k){
  return new RegExp('(?<![\\w-])'+statEsc(k.match||k.name)+'(?![\\w-])','i');
}
/* Only the irregular forms are spelled out; the rest are made by the plain rules. */
var STAT_FORMS={
  crystallize:['Crystallize','Crystallizes','Crystallized','Crystallizing'],
  grind:['Grind','Grinds','Grinding','Grinded'],
  ignite:['Ignite','Ignites','Ignited','Igniting'],
  foretell:['Foretell','Foretells','Foretelling','Foretold']};
function statForms(name){
  var n=String(name||''), k=n.toLowerCase();
  if(STAT_FORMS[k])return STAT_FORMS[k];
  if(/\s/.test(n))return [n];
  if(/e$/i.test(n))return [n,n+'s',n+'d',n.slice(0,-1)+'ing'];
  if(/(?:ch|sh|s|x|z)$/i.test(n))return [n,n+'es',n+'ed',n+'ing'];
  return [n,n+'s',n+'ed',n+'ing'];
}
function statFormsSrc(name){ return '(?<![\\w-])(?:'+statForms(name).map(statEsc).join('|')+')(?![\\w-])'; }
function statFormsRe(name){ return new RegExp(statFormsSrc(name),'i'); }
function statCounterBase(name){ return String(name||'').replace(/\s+counters?$/i,''); }
function statCounterRe(base){
  return new RegExp('(?<![\\w+-])'+statEsc(base)+' counters?(?![\\w-])','i');
}
/* A die is matched case-sensitively, as the face draws it (HANDOFF §8); the two "flip a coin" entries are one. */
function statDice(){
  var out=[], coin=false;
  statGloss('dice',true).slice().sort(function(x,y){
    var dx=/^D(\d+)$/i.exec(x.name), dy=/^D(\d+)$/i.exec(y.name);
    return (dx?+dx[1]:0)-(dy?+dy[1]:0);
  }).forEach(function(k){
    if(/flip a coin/i.test(k.name)){
      if(coin)return; coin=true;
      out.push({label:'Flip a coin',re:/flip a coin/i});
    } else out.push({label:k.name,re:new RegExp('(?<![A-Za-z])'+statEsc(k.name)+'(?!\\d)')});
  });
  return out;
}
function statUnused(out,names){
  if(names.length)out.push({label:'No cards yet',cards:[],names:names,nobar:true});
  return out;
}

var STAT_TRIG=/\b(?:whenever|when|if|each time|as long as|unless|for each)\b([^,.—\r\n]*)/gi;
function statRewards(text,name){
  var t=String(text||''), re=statFormsRe(name), m;
  STAT_TRIG.lastIndex=0;
  while((m=STAT_TRIG.exec(t))){ if(re.test(m[1])){ STAT_TRIG.lastIndex=0; return true; } }
  if(/\b(?:if|unless|whenever)\b/i.test(t)){
    var tt=/this turn/gi, k;
    while((k=tt.exec(t))){ if(re.test(t.slice(Math.max(0,k.index-20),k.index)))return true; }
  }
  return false;
}
var STAT_PHASE=/^(?:your|each) (?:onset|offset)$/i;

var _statRate={b:2.5,w:1.5,slow:false,mythic:false,mono:false};
function statRateOf(a,h,r,mv,o){
  var b=+o.b>0?+o.b:2.5, w=+o.w>0?+o.w:1.5;
  return (a+h+r/w)/(b*mv);
}
function statRateChars(cards,o){
  var out=[];
  (cards||[]).forEach(function(c){
    if(!c||!statIsChar(c))return;
    if(o.slow&&statHasType(c.superTypes,/^quick$/i))return;
    if(o.mythic&&statHasType(c.superTypes,/^mythic$/i))return;
    var mv=statNum(c.cmc); if(mv==null||mv<1)return;
    var a=statRead(c,'attack'), hp=statRead(c,'health'), r=statRead(c,'arcane');
    if(a==='*'||hp==='*'||r==='*')return;
    a=a||0; hp=hp||0; r=r||0;
    var cs=statColoursOf(c);
    if(o.mono&&cs.length!==1)return;
    out.push({c:c,mv:mv,a:a,h:hp,r:r,cs:cs,rate:statRateOf(a,hp,r,mv,o)});
  });
  return out;
}
function statQuant(s,p){
  if(!s.length)return 0;
  var pos=(s.length-1)*p, lo=Math.floor(pos), hi=Math.ceil(pos);
  return s[lo]+(s[hi]-s[lo])*(pos-lo);
}
function statPctTxt(x){ return Math.round(x*100)+'%'; }
function statShareTxt(p){ return (p>=10||p===0)?Math.round(p)+'%':(Math.round(p*10)/10).toFixed(1)+'%'; }
function statMvKey(mv){ return mv>=8?'8+':String(mv); }
var STAT_MV_ROWS=['1','2','3','4','5','6','7','8+'];
function statColourGroups(rows){
  var g=STAT_COLORS.map(function(p){ return {key:p[1],label:p[1],pips:p[0],rows:[],hex:STAT_HEX[p[1]]}; });
  var multi={key:'Multicolour',label:'Multicolour',rows:[],fill:STAT_MULTI}, none={key:'Colourless',label:'Colourless',rows:[],hex:STAT_HEX.Grey};
  rows.forEach(function(x){
    if(!x.cs.length)none.rows.push(x);
    else if(x.cs.length>1)multi.rows.push(x);
    else g[STAT_COLORS.map(function(p){ return p[1]; }).indexOf(x.cs[0][1])].rows.push(x);
  });
  return g.concat([multi]).concat(none.rows.length?[none]:[]);
}
var STAT_MULTI='linear-gradient(90deg,'+STAT_COLORS.map(function(p,i){
  return STAT_HEX[p[1]]+' '+Math.round(i/6*100)+'%'; }).join(',')+')';

var STAT_GRAPHS=[
  {id:'colorcombo', name:'Colour combinations', single:true, build:function(cards){
    var b=sortByCount(bucketBy(cards,function(c){
      var cs=statColoursOf(c);
      return cs.length?cs.map(function(p){ return p[1]; }).join(' + '):'Colourless';
    }));
    b.forEach(function(x){
      if(x.label==='Colourless'){ x.color=STAT_HEX.Grey; return; }
      var names=x.label.split(' + ');
      x.pips=names.map(function(n){
        return (STAT_COLORS.filter(function(p){ return p[1]===n; })[0]||[''])[0]; }).join('');
      x.fill=statSpread(names.map(function(n){ return {hex:STAT_HEX[n],w:1}; }));
    });
    var have={}, missing=[];
    b.forEach(function(x){ have[x.label]=1; });
    for(var m=1;m<128;m++){
      var idx=[]; for(var i=0;i<7;i++)if(m&(1<<i))idx.push(i);
      var lbl=idx.map(function(i){ return STAT_COLORS[i][1]; }).join(' + ');
      if(!have[lbl])missing.push({text:lbl,pips:idx.map(function(i){ return STAT_COLORS[i][0]; }).join(''),idx:idx});
    }
    missing.sort(function(x,y){
      if(x.idx.length!==y.idx.length)return x.idx.length-y.idx.length;
      for(var i=0;i<x.idx.length;i++)if(x.idx[i]!==y.idx[i])return x.idx[i]-y.idx[i];
      return 0;
    });
    return statUnused(b,missing);
  }},
  {id:'colorcount', name:'Number of colours', single:true, build:function(cards){
    /* 4+, not 4, so a card of five or more colours lands in a bar and the bars sum to the card total. */
    var b=bucketBy(cards,function(c){
      var n=statColoursOf(c).length;
      return n===0?'Colourless':(n>=4?'4+ colours':(n+(n===1?' colour':' colours')));
    });
    var ord=['Colourless','1 colour','2 colours','3 colours','4+ colours'];
    return b.sort(function(x,y){ return ord.indexOf(x.label)-ord.indexOf(y.label); });
  }},
  {id:'pairs', name:'Colour pairs', opts:['pairs3'], build:function(cards){
    var out=[];
    STAT_COLORS.forEach(function(p,i){
      STAT_COLORS.slice(i+1).forEach(function(q){
        var hit=cards.filter(function(c){
          var cs=statColoursOf(c);
          if(!_statPairs3&&cs.length!==2)return false;
          var ls=cs.map(function(x){ return x[0]; });
          return ls.indexOf(p[0])>=0&&ls.indexOf(q[0])>=0;
        });
        out.push({label:p[0]+'/'+q[0],title:p[1]+' + '+q[1],cards:hit,pips:p[0]+q[0],
          fill:statSpread([{hex:STAT_HEX[p[1]],w:1},{hex:STAT_HEX[q[1]],w:1}])});
      });
    });
    return sortByCount(out);
  }},
  {id:'pips', name:'Pip count', build:function(cards){
    /* Not cumulative: a card with exactly two red pips is in RR and nowhere else. */
    var out=[];
    STAT_COLORS.forEach(function(p){
      var letter=p[0], name=p[1];
      for(var n=1;n<=4;n++){
        var lbl=(n===4?'4+':n)+' '+name+(n===1?' pip':' pips');
        var hit=cards.filter(function(c){
          var k=costPipsWhole(c.manaCost)[name];
          return n<4?(k===n):(k>=4);
        });
        if(hit.length)out.push({label:lbl,cards:hit,color:STAT_HEX[name],
          pips:new Array(n+1).join(letter),more:n===4,pipsOnly:true});
      }
    });
    return out;
  }},
  /* single: a card lands in exactly one bar, so a shortfall from the total is cards with no value, reported, not dropped. */
  {id:'cmc', name:'Mana value', single:true, table:true, build:function(cards){
    return numericBuckets(cards,function(c){ return statNum(c.cmc); },10);
  }},
  {id:'attack', name:'Attack', single:true, why:'no stats at all', build:function(cards){
    return statGraph(cards,'attack',statOrb('atk'));
  }},
  {id:'health', name:'Health', single:true, why:'no stats at all', build:function(cards){
    return statGraph(cards,'health',statOrb('hp'));
  }},
  {id:'arcane', name:'Arcane', single:true, why:'no stats at all', build:function(cards){
    return statGraph(cards,'arcane',statOrb('arc'));
  }},
  {id:'range', name:'Range', single:true, rebirth:true, why:'no stats at all', build:function(cards){
    return statGraph(cards,'range',statOrb('rng'));
  }},
  {id:'arclink', name:'Arcane linked', single:true, under:'arcane', why:'no stats at all', build:function(cards){
    var b=[{label:'Attack / Arcane',cards:[]},{label:'Health / Arcane',cards:[]},
           {label:'None',cards:[],nobar:true}];
    cards.forEach(function(c){
      var l=statLinked(c);
      if(l==='A')b[0].cards.push(c);
      else if(l==='H')b[1].cards.push(c);
      else if(statCarrier(c))b[2].cards.push(c);
    });
    b[0].fill=statSpread([{hex:statOrb('atk'),w:1},{hex:statOrb('arc'),w:1}]);
    b[1].fill=statSpread([{hex:statOrb('hp'),w:1},{hex:statOrb('arc'),w:1}]);
    return b.filter(function(x){ return x.cards.length; });
  }},
  {id:'rate', name:'Stat rate', main:true, flat:true, gold:1, opts:['rateBox','slow','mythic'],
   unit:'Characters', build:function(cards){
    var out=statColourGroups(statRateChars(cards,_statRate)).filter(function(gp){
      return gp.rows.length; }).map(function(gp){
      var sorted=gp.rows.slice().sort(function(x,y){ return x.rate-y.rate; });
      var avg=sorted.reduce(function(n,x){ return n+x.rate; },0)/sorted.length;
      return {label:gp.label+' · '+sorted.length,
        sumLabel:gp.label,pips:gp.pips||'',cards:sorted.map(function(x){ return x.c; }),
        notes:sorted.map(function(x){ return statPctTxt(x.rate); }),
        val:avg,badge:statPctTxt(avg),sumv:statPctTxt(avg),color:gp.hex,fill:gp.fill};
    });
    return out.sort(function(x,y){ return y.val-x.val; });
  }, scale:function(b){
    var mx=b.reduce(function(n,x){ return Math.max(n,x.val); },0);
    return Math.max(1.25,Math.ceil(mx*1.05*4)/4);
  }, tick:0.25},
  {id:'ratemv', name:'Stat rate by mana value', main:true, under:'rate', opts:['mono'],
   render:function(cards){ return statRateMvHTML(cards); }},
  {id:'bycolour', name:'Stats by colour', main:true, opts:['slow','mythic'],
   render:function(cards){ return statByColourHTML(cards); }},
  {id:'super', name:'Super-Type', table:true, build:function(cards){
    return sortByCount(bucketBy(cards,function(c){ return (c.superTypes||[]).slice(); }));
  }},
  {id:'sub', name:'Sub-Type', table:true, build:function(cards){
    var b=sortByCount(bucketBy(cards,function(c){ return (c.subTypes||[]).slice(); }));
    b.forEach(function(x){ x.fill=statSpread(statPipMix(x.cards)); });
    return b;
  }},
  {id:'keywords', name:'Keywords', table:true, build:function(cards){
    var out=[], none=[];
    statGloss('keyword',false).forEach(function(k){
      var re=statKwRe(k);
      var hit=cards.filter(function(c){ return re.test(statRules(c)); });
      if(hit.length)out.push({label:k.name,cards:hit,fill:statSpread(statPipMix(hit))});
      else none.push(k.name);
    });
    return statUnused(sortByCount(out),none);
  }},
  {id:'keyterms', name:'Keyterms', table:true, build:function(cards){
    var out=[], none=[];
    statGloss('keyterm',true).forEach(function(k){
      var re=statFormsRe(k.name);
      var hit=cards.filter(function(c){ return re.test(statRules(c)); });
      if(hit.length)out.push({label:k.name,cards:hit,fill:statSpread(statPipMix(hit))});
      else none.push(k.name);
    });
    return statUnused(sortByCount(out),none);
  }},
  /* The four phases (Your Onset and the rest) are times of the turn, not things a card does, so they are left out. */
  {id:'payoffs', name:'Payoffs', under:'keyterms', flat:true, unit:'cards', build:function(cards){
    var out=[];
    statGloss('keyterm',true).forEach(function(k){
      if(STAT_PHASE.test(k.name))return;
      var re=statFormsRe(k.name), does=[], rew=[];
      cards.forEach(function(c){
        var t=statRules(c); if(!re.test(t))return;
        (statRewards(t,k.name)?rew:does).push(c);
      });
      if(!does.length&&!rew.length)return;
      out.push({label:k.name,cards:rew,all:does.concat(rew),val:does.length+rew.length,
        parts:[{w:does.length,bg:STAT_METAL+','+STAT_HEX.Grey},{w:rew.length,bg:STAT_GOLD}],
        badge:does.length+' · '+rew.length,sumv:does.length+' · '+rew.length,listHead:'rewarding '+k.name});
    });
    return out.sort(function(x,y){ return (y.cards.length-x.cards.length)||(y.val-x.val); });
  }},
  {id:'counters', name:'Counters', table:true, build:function(cards){
    var out=[], none=[];
    statGloss('counter',true).forEach(function(k){
      var base=statCounterBase(k.name), re=statCounterRe(base);
      var hit=cards.filter(function(c){ return re.test(statRules(c)); });
      if(hit.length)out.push({label:base,cards:hit,fill:statSpread(statPipMix(hit))});
      else none.push(base);
    });
    return statUnused(sortByCount(out),none);
  }},
  {id:'dice', name:'Dice', table:true, build:function(cards){
    var out=[], none=[];
    statDice().forEach(function(d){
      var hit=cards.filter(function(c){ return d.re.test(statRules(c)); });
      if(hit.length)out.push({label:d.label,cards:hit,fill:statSpread(statPipMix(hit))});
      else none.push(d.label);
    });
    return statUnused(out,none);
  }},
  {id:'words', name:'Rules text word count', single:true, table:true, build:function(cards){
    var bands=[[0,0,'0 (no rules text)'],[1,10,'1-10'],[11,20,'11-20'],[21,30,'21-30'],
               [31,40,'31-40'],[41,50,'41-50'],[51,1e9,'51+']];
    return bands.map(function(b){
      return {label:b[2],cards:cards.filter(function(c){
        var w=statWords(c.ruleText); return w>=b[0]&&w<=b[1]; })};
    }).filter(function(x){ return x.cards.length; });
  }},
  {id:'colourlists', name:'Colour lists', main:true,
   render:function(cards){ return statClHTML(cards); }}
];

var _statGraph=null,_statBuckets={},_statShown={},_statBucket=null;   /* _statBucket: {g, i, col} */
/* Conveniences only: a storage that throws or comes back empty costs nothing. */
function statLs(k){ try{ return localStorage.getItem(k); }catch(_){ return null; } }
function statLsSet(k,v){ try{ localStorage.setItem(k,String(v)); }catch(_){} }
var _statVert=statLs('conjure.statsVertical')==='1';
var _statBrowse=statLs('conjure.statsBrowse')==='1';
var _statTable=statLs('conjure.statsTable')==='1';
var _statTblAny=statLs('conjure.statsTableAny')==='1';
var _statTblPct=statLs('conjure.statsTablePct')==='1';
var _statPairs3=statLs('conjure.statsPairs3')==='1';
var _statSort=null;   /* {g, col}: the table's column it is sorted by */
(function(){
  var j=null; try{ j=JSON.parse(statLs('conjure.statsRate')||'null'); }catch(_){}
  if(!j||typeof j!=='object')return;
  ['b','w'].forEach(function(k){ if(+j[k]>0)_statRate[k]=+j[k]; });
  ['slow','mythic','mono'].forEach(function(k){ if(j[k]!=null)_statRate[k]=!!j[k]; });
})();
function statRateSave(){ statLsSet('conjure.statsRate',JSON.stringify(_statRate)); }

window.edOpenStats=function(){
  var ov=document.getElementById('edStatsOverlay');
  if(!ov){
    ov=document.createElement('div'); ov.id='edStatsOverlay'; ov.className='ed2-overlay';
    ov.innerHTML="<div class='ed2-modal ed2-modal-wide'>"
      +"<div class='ed2-modal-head wh'><b class='wh-t'>Statistics</b>"
      +"<button class='ed2-btn close-x nb nb-red nb-m wh-x' onclick='edCloseStats()'>Close &#10005;</button></div>"
      +"<div id='edStatsBody' class='ed2-modal-body'></div></div>";
    document.body.appendChild(ov);
    ov.addEventListener('click',function(ev){ if(ev.target===ov)window.edCloseStats(); });
  }
  ov.style.display='flex';
  edDialogOpen(ov,'Statistics',function(){ window.edCloseStats(); });
  edStatsRefresh();
};
window.edCloseStats=function(){
  var ov=document.getElementById('edStatsOverlay');
  if(ov){ ov.style.display='none'; edDialogClose(ov); }
};
window.edStatsPick=function(id){ _statGraph=id; _statBucket=null; edStatsRefresh(); };
window.edStatsOrient=function(){
  _statVert=!_statVert;
  statLsSet('conjure.statsVertical',_statVert?'1':'0');
  edStatsRefresh();
};
window.edStatsSet=function(k,v){
  if(k==='browse'){ _statBrowse=!_statBrowse; statLsSet('conjure.statsBrowse',_statBrowse?'1':'0'); }
  else if(k==='table'){ _statTable=(v==='table'); statLsSet('conjure.statsTable',_statTable?'1':'0'); }
  else if(k==='tblAny'){ _statTblAny=(v==='any'); statLsSet('conjure.statsTableAny',_statTblAny?'1':'0'); }
  else if(k==='tblPct'){ _statTblPct=(v==='pct'); statLsSet('conjure.statsTablePct',_statTblPct?'1':'0'); }
  else if(k==='pairs3'){ _statPairs3=!_statPairs3; statLsSet('conjure.statsPairs3',_statPairs3?'1':'0'); }
  else if(k==='b'||k==='w'){ var n=parseFloat(v); if(n>0){ _statRate[k]=n; statRateSave(); } }
  else if(k==='slow'||k==='mythic'||k==='mono'){ _statRate[k]=!_statRate[k]; statRateSave(); }
  else if(k==='cl'){ _statClColour=v; }
  else if(k==='clEdit'){ _statClEdit=!_statClEdit; }
  _statBucket=null; edStatsRefresh();
};
/* A bar is named by its graph as well as its place: one page can hold two graphs (Arcane, and Arcane linked). */
window.edStatsBucket=function(g,i,col){
  col=(col==null)?null:col;
  _statBucket=(_statBucket&&_statBucket.g===g&&_statBucket.i===i&&_statBucket.col===col)?null:{g:g,i:i,col:col};
  edStatsRefresh();
};
window.edStatsSort=function(g,col){
  _statSort=(_statSort&&_statSort.g===g&&_statSort.col===col)?null:{g:g,col:col};
  edStatsRefresh();
};
window.edStatsCard=function(g,bi,ci){
  var list=_statShown[g]||(_statBuckets[g]&&_statBuckets[g][bi]&&_statBuckets[g][bi].cards);
  var c=list&&list[ci]; if(!c)return;
  if(typeof window.openMod==='function')window.openMod(c);
};
window.edStatsCopy=function(btn){
  var sp=btn&&btn.parentNode&&btn.parentNode.querySelector('.stat-line-t'); if(!sp)return;
  var t=sp.textContent;
  var pick=function(){
    var ok=false;
    try{ var r=document.createRange(); r.selectNodeContents(sp);
      var s=window.getSelection(); s.removeAllRanges(); s.addRange(r); ok=document.execCommand('copy'); }catch(_){}
    toast(ok?'Copied':'The line is selected');
  };
  try{
    if(navigator.clipboard&&navigator.clipboard.writeText){
      navigator.clipboard.writeText(t).then(function(){ toast('Copied'); },pick);
      return;
    }
  }catch(_){}
  pick();
};

function statOffered(g){ return (!g.rebirth||window.REBIRTH)&&(!g.main||!window.REBIRTH); }
function edStatsRefresh(){
  var host=document.getElementById('edStatsBody'); if(!host)return;
  statMemoReset();
  var cards=statsCards();
  var g=STAT_GRAPHS.filter(function(x){ return x.id===_statGraph&&statOffered(x); })[0];
  var tabled=!!g&&!!g.table, flat=!g||!!g.flat||!!g.render||(tabled&&_statTable);
  var h="<div class='stat-pick'><div class='stat-btns'>"+STAT_GRAPHS.filter(function(x){
      return statOffered(x) && !x.under; }).map(function(x){
      return "<button class='ed2-btn tiny"+(_statGraph===x.id?' on':'')+"' onclick=\"edStatsPick('"
        +x.id+"')\">"+e(x.name)+"</button>"; }).join('')
    +"<span class='stat-sum stat-cover'>"+(_statBrowse
      ?("Counting the <b>"+cards.length+"</b> cards your Browse filters show")
      :("<b>"+cards.length+"</b> card(s) in the sagas you have enabled"))+"</span></div>"
    +"<span class='stat-end'>"
      +"<button class='ed2-btn tiny stat-tog"+(_statBrowse?' on':'')+"' id='edStatsBrowse' aria-pressed='"
        +(_statBrowse?'true':'false')+"' onclick=\"edStatsSet('browse')\">Use my Browse filters</button>"
      +(tabled?statSegHTML('table',[['bars','Bars'],['table','Table']],_statTable?'table':'bars','Bars or table'):'')
      +(flat?'':"<button class='ed2-btn tiny stat-orient' id='edStatsOrient' onclick='edStatsOrient()'"
        +" title='"+(_statVert?'The bars stand up - click to lay them across':'The bars run across - click to stand them up')+"'>"
        +(_statVert?'Vertical':'Horizontal')+"</button>")
    +"</span></div>";

  if(!g){ host.innerHTML=h+"<i class='tpl-hint'>No graph selected.</i>"; return; }
  var page=[g].concat(STAT_GRAPHS.filter(function(x){ return x.under===g.id && statOffered(x); }));
  _statBuckets={}; _statShown={};
  page.forEach(function(pg){
    h+=statChartHTML(pg,cards,page.length>1);
  });
  host.innerHTML=h;
}

function statSegHTML(k,opts,cur,label){
  return "<span class='stat-seg' role='group' aria-label='"+e(label)+"'>"+opts.map(function(o){
    var on=o[0]===cur;
    return "<button class='ed2-btn tiny"+(on?' on':'')+"' aria-pressed='"+(on?'true':'false')
      +"' onclick=\"edStatsSet('"+k+"','"+o[0]+"')\">"+e(o[1])+"</button>"; }).join('')+"</span>";
}
var STAT_OPT_LABEL={slow:'Slow only',mythic:'Skip Mythic',mono:'Mono only',pairs3:'Count 3+ colour cards too'};
function statOptOn(k){ return k==='pairs3'?_statPairs3:!!_statRate[k]; }
function statOptsHTML(keys){
  if(!keys||!keys.length)return '';
  return "<div class='stat-opts'>"+keys.map(function(k){
    if(k==='rateBox')return "<label class='stat-num'>Budget <input type='number' class='ed2-input stat-numin' id='edStatsRateB'"
        +" min='0.1' step='0.1' value='"+e(String(_statRate.b))+"' onchange=\"edStatsSet('b',this.value)\"></label>"
      +"<label class='stat-num'>Arcane ÷ <input type='number' class='ed2-input stat-numin' id='edStatsRateW'"
        +" min='0.1' step='0.1' value='"+e(String(_statRate.w))+"' onchange=\"edStatsSet('w',this.value)\"></label>";
    if(k==='tblAny')return statSegHTML('tblAny',[['mono','Mono only'],['any','Any with the colour']],_statTblAny?'any':'mono','Which cards a colour counts');
    if(k==='tblPct')return statSegHTML('tblPct',[['count','Count'],['pct','% of colour']],_statTblPct?'pct':'count','Count or share');
    var on=statOptOn(k);
    return "<button class='ed2-btn tiny stat-tog"+(on?' on':'')+"' id='edStatsOpt-"+k+"' aria-pressed='"
      +(on?'true':'false')+"' onclick=\"edStatsSet('"+k+"')\">"+e(STAT_OPT_LABEL[k]||k)+"</button>";
  }).join('')+"</div>";
}
function statSumText(name,by,items){
  var head=name+(by?', by '+by:'')+': ';
  if(!items.length)return head+'no cards';
  var t=items.slice(0,15).map(function(x){ return x.label+' '+x.v; }).join(', ');
  if(items.length>15)t+=', and '+(items.length-15)+' more';
  return head+t;
}
function statLineHTML(text){
  return "<div class='stat-line'><span class='stat-line-t'>"+e(text)+"</span>"
    +"<button type='button' class='ed2-btn tiny stat-copy' onclick='edStatsCopy(this)'>Copy</button></div>";
}

function statChartHTML(g,cards,titled){
  var h=titled?"<h4 class='stat-title'>"+e(g.name)+"</h4>":'';
  var table=!!g.table&&_statTable;
  h+=statOptsHTML((g.opts||[]).concat(table?['tblAny','tblPct']:[]));
  if(g.render){
    try{ return h+g.render(cards); }
    catch(err){ return h+"<i class='tpl-hint warn'>Could not build that graph: "+e(err&&err.message||err)+"</i>"; }
  }
  var buckets=[];
  try{ buckets=g.build(cards)||[]; }
  catch(err){ return h+"<i class='tpl-hint warn'>Could not build that graph: "
    +e(err&&err.message||err)+"</i>"; }
  _statBuckets[g.id]=buckets;
  var model=table?statTableModel(g,buckets,cards):null;
  h+=statLineHTML(statSummary(g,buckets,model));

  var total=buckets.reduce(function(n,b){ return n+(b.all||b.cards).length; },0);
  var bars=buckets.filter(function(b){ return !b.nobar; }).length;
  var note='';
  if(g.single){
    var missing=cards.length-total;
    note=missing>0?(" · <i>"+missing+" not counted ("+(g.why||'no value')+")</i>"):" · <i>every card counted once</i>";
  }
  h+="<div class='stat-sum'>"+bars+" bars · "+total+" "+(g.unit==='Characters'?'Characters':'card entries')+note+"</div>";
  h+=table?(statTableHTML(g,model)+statBarsHTML(g,buckets.filter(function(b){ return b.nobar; }),buckets))
          :statBarsHTML(g,buckets,buckets);
  return h+statSelHTML(g,buckets);
}
function statSummary(g,buckets,model){
  if(model){
    var col=(model.sort&&model.sort!=='lbl')?model.sort:'total', by='';
    var cd=STAT_TCOLS.filter(function(x){ return x.key===col; })[0];
    if(col==='multi'||col==='none')by=cd.name;
    else if(col!=='total')by=(_statTblAny?'any with ':'mono ')+cd.name;
    var items=model.rows.filter(function(r){ return r.cells[col].n>0; }).map(function(r){
      return {label:r.b.label,v:_statTblPct?statShareTxt(r.cells[col].p):r.cells[col].n}; });
    return statSumText(g.name,by,items);
  }
  return statSumText(g.name,'',buckets.filter(function(b){ return !b.nobar; }).map(function(b){
    return {label:b.sumLabel||b.label,v:b.sumv!=null?b.sumv:b.cards.length}; }));
}
/* rows are the ones drawn; all is the graph's list, whose places the clicks carry. */
function statBarsHTML(g,rows,all){
  if(!rows.length)return '';
  var vert=_statVert&&!g.flat;
  var val=function(b){ return b.val!=null?b.val:b.cards.length; };
  /* None is left out of the scale: it is not a bar, and as the longest it would flatten every bar that is. */
  var max=g.scale?g.scale(rows):(rows.reduce(function(n,b){ return b.nobar?n:Math.max(n,val(b)); },0)||1);
  var sel=(_statBucket&&_statBucket.g===g.id&&_statBucket.col==null)?_statBucket.i:null;
  var gold=(g.gold!=null)?"<i class='stat-gold' style='left:"+(g.gold/max*100).toFixed(2)+"%'></i>":'';
  /* --p is the bar's share: its width across, its height standing up. */
  var h="<div class='stat-chart"+(vert?' vert':'')+(g.gold!=null?' stat-has-gold':'')+"'>"+rows.map(function(b){
      var i=all.indexOf(b), v=val(b), pct=v>0?Math.max(Math.round(v/max*100),1):0, track;
      if(b.nobar){
        var word=b.names?(sel===i?'Hide':'Show'):(sel===i?'Hide cards':'Show cards');
        track="<span class='stat-track stat-none'><button type='button' class='ed2-btn tiny stat-view'>"+word+"</button></span>";
      } else if(b.parts){
        track="<span class='stat-track stat-track-parts'>"+b.parts.map(function(p){
          return "<span class='stat-bar' style=\"--p:"+(p.w/max*100).toFixed(2)+"%;background:"+p.bg+"\"></span>"; }).join('')+"</span>";
      } else {
        track="<span class='stat-track'>"+(pct?"<span class='stat-bar' style=\"--p:"+pct+"%;"
            +"background:"+statBarBg(b)+"\"></span>":'')+gold+"</span>";
      }
      var n=b.badge!=null?b.badge:(b.names?b.names.length:v);
      return "<div class='stat-row"+(b.nobar?' stat-row-none':'')+(sel===i?' on':'')
          +"' onclick=\"edStatsBucket('"+g.id+"',"+i+")\">"
        +"<span class='stat-lbl"+(b.pipsOnly?' stat-lbl-pips':'')+"' title=\""+e(b.title||b.label)+"\">"
          +statLabelHTML(b,14)+"</span>"
        +"<span class='stat-n'>"+e(String(n))+"</span>"
        +track
      +"</div>"; }).join('');
  if(g.tick)h+=statAxisHTML(max,g.tick,'');
  return h+"</div>";
}
function statAxisHTML(max,step,end){
  var t='';
  for(var x=0;x<=max+1e-9;x+=step){
    t+="<i style='left:"+(x/max*100).toFixed(2)+"%'>"+Math.round(x*100)+"%</i>";
  }
  return "<div class='stat-axis'><span class='stat-lbl'></span><span class='stat-n stat-n-ghost' aria-hidden='true'></span>"
    +"<span class='stat-ticks'>"+t+"</span>"+(end||'')+"</div>";
}

/* As a share, a cell is out of that colour's counted cards; Multicolour, Colourless and Total out of their own totals. */
var STAT_TCOLS=STAT_COLORS.map(function(p){ return {key:p[0],name:p[1],hex:STAT_HEX[p[1]],pips:p[0]}; })
  .concat([{key:'multi',name:'Multicolour',hex:'#e8c96a'},{key:'none',name:'Colourless',hex:STAT_HEX.Grey},
           {key:'total',name:'Total',hex:STAT_HEX.Grey}]);
function statColTest(key,any){
  return function(cs){
    if(key==='total')return true;
    if(key==='multi')return cs.length>1;
    if(key==='none')return cs.length===0;
    var hit=cs.some(function(p){ return p[0]===key; });
    return any?hit:(hit&&cs.length===1);
  };
}
function statCellCards(list,key){
  var t=statColTest(key,_statTblAny);
  return (list||[]).filter(function(c){ return t(statColoursOf(c)); });
}
function statTableModel(g,buckets,cards){
  var den={};
  STAT_TCOLS.forEach(function(col){ den[col.key]=statCellCards(cards,col.key).length; });
  var rows=[];
  buckets.forEach(function(b,i){
    if(b.nobar)return;
    var r={b:b,i:i,cells:{}};
    STAT_TCOLS.forEach(function(col){
      var n=statCellCards(b.cards,col.key).length;
      r.cells[col.key]={n:n,p:den[col.key]?n/den[col.key]*100:0};
    });
    rows.push(r);
  });
  var srt=(_statSort&&_statSort.g===g.id)?_statSort.col:null, m=_statTblPct?'p':'n';
  if(srt==='lbl')rows.sort(function(x,y){ return String(x.b.label).localeCompare(String(y.b.label)); });
  else if(srt)rows.sort(function(x,y){ return (y.cells[srt][m]-x.cells[srt][m])||(x.i-y.i); });
  var max={};
  STAT_TCOLS.forEach(function(col){
    max[col.key]=rows.reduce(function(n,r){ return Math.max(n,r.cells[col.key][m]); },0);
  });
  return {rows:rows,den:den,sort:srt,max:max,m:m};
}
/* The window is dark in every theme, so a cell's shade is mixed over its face and inked to read on the mix (HANDOFF §82.4). */
function statRgb(s){
  var m=/rgba?\(\s*([\d.]+)[,\s]+([\d.]+)[,\s]+([\d.]+)(?:[,\s\/]+([\d.]+))?/.exec(String(s||''));
  if(!m||(m[4]!=null&&+m[4]===0))return null;
  return [+m[1],+m[2],+m[3]];
}
function statHexRgb(h){ h=String(h).replace('#',''); return [0,2,4].map(function(i){ return parseInt(h.substr(i,2),16); }); }
function statLum(c){
  var f=function(v){ v/=255; return v<=0.03928?v/12.92:Math.pow((v+0.055)/1.055,2.4); };
  return 0.2126*f(c[0])+0.7152*f(c[1])+0.0722*f(c[2]);
}
function statFace(){
  var m=document.querySelector('#edStatsOverlay .ed2-modal'), c=null;
  try{ c=m&&statRgb(getComputedStyle(m).backgroundColor); }catch(_){}
  return c||[27,29,36];
}
function statShade(hex,k,face){
  if(!(k>0))return '';
  var a=0.16+0.6*Math.min(1,k), c=statHexRgb(hex);
  var mix=[0,1,2].map(function(i){ return Math.round(c[i]*a+face[i]*(1-a)); });
  return "background:rgb("+mix.join(',')+");color:var("+(statLum(mix)>0.22?'--ink-dark':'--ink-light')+")";
}
function statTableHTML(g,model){
  var face=statFace(), srt=model.sort, mk=function(col,inner,title){
    return "<th"+(srt===col?" class='on' aria-sort='descending'":'')+"><button type='button' class='stat-sort'"
      +(title?" title='"+e(title)+"'":'')+" onclick=\"edStatsSort('"+g.id+"','"+col+"')\">"+inner
      +(srt===col?" <b class='stat-arrow'>▼</b>":'')+"</button></th>";
  };
  var h="<div class='stat-tblwrap'><table class='stat-tbl'><thead><tr>"
    +mk('lbl',e(g.name),'Sort by name')
    +STAT_TCOLS.map(function(col){
      return mk(col.key,col.pips?statPipsHTML(col.pips,14):e(col.name),col.name); }).join('')
    +"</tr></thead><tbody>";
  var sel=(_statBucket&&_statBucket.g===g.id&&_statBucket.col!=null)?_statBucket:null;
  model.rows.forEach(function(r){
    h+="<tr><th scope='row' class='stat-tl'>"+statLabelHTML(r.b,13)+"</th>"+STAT_TCOLS.map(function(col){
      var c=r.cells[col.key], v=c[model.m], txt=model.m==='p'?statShareTxt(v):String(v);
      var st=statShade(col.hex,model.max[col.key]?v/model.max[col.key]:0,face);
      var on=sel&&sel.i===r.i&&sel.col===col.key;
      return "<td><button type='button' class='stat-cell"+(on?' on':'')+"'"+(c.n?'':' disabled')
        +" style='"+st+"' title='"+e(r.b.label+' · '+col.name+': '+c.n)+"'"
        +" onclick=\"edStatsBucket('"+g.id+"',"+r.i+",'"+col.key+"')\">"+txt+"</button></td>";
    }).join('')+"</tr>";
  });
  return h+"</tbody></table></div>";
}

function statSelHTML(g,buckets){
  var sel=(_statBucket&&_statBucket.g===g.id)?_statBucket:null; if(!sel)return '';
  var b=buckets[sel.i]; if(!b)return '';
  if(b.names){
    return "<div class='stat-cards'><h4>No cards yet — "+b.names.length+"</h4><div class='stat-names'>"
      +b.names.map(function(n){
        return "<span class='stat-name'>"+(typeof n==='object'?statPipsHTML(n.pips,13)+' '+e(n.text):e(n))+"</span>"; }).join('')
      +"</div></div>";
  }
  var list=b.cards, notes=b.notes, head=statLabelHTML(b,13)+(b.listHead?' '+e(b.listHead):'');
  if(sel.col!=null){
    var cd=STAT_TCOLS.filter(function(x){ return x.key===sel.col; })[0]||{name:sel.col};
    list=statCellCards(b.cards,sel.col); notes=null;
    head+=" · "+e(cd.key==='total'||cd.key==='multi'||cd.key==='none'?cd.name:((_statTblAny?'any with ':'mono ')+cd.name));
  }
  return statListHTML(g.id,sel.i,head,list,notes);
}
function statListHTML(gid,bi,head,list,notes){
  _statShown[gid]=list;
  return "<div class='stat-cards'><h4>"+head+" — "+list.length+" card(s)</h4>"
    +"<div class='stat-colline'>"+e(statColourLine(list))+"</div>"
    +"<div class='stat-grid'>"
    +list.map(function(c,ci){
      var sup=(c.superTypes||[]).join(' '), sub=(c.subTypes||[]).join(' ');
      var tl=(sup&&sub)?(sup+' — '+sub):(sup||sub);
      var cost=(typeof window.renderManaCost==='function'&&c.manaCost)
               ?window.renderManaCost(c.manaCost,13):e(c.manaCost||'');
      return "<button class='stat-card' onclick=\"edStatsCard('"+gid+"',"+bi+","+ci+")\">"
        +"<span class='sc-name'>"+e(c.name)+"</span>"
        +(notes?"<span class='sc-note'>"+e(notes[ci])+"</span>":'')
        +"<span class='sc-cost'>"+cost+"</span>"
        +"<span class='sc-type'>"+e(tl||'—')+"</span>"
      +"</button>"; }).join('')
    +"</div></div>";
}
function statColourLine(list){
  var n=list.length; if(!n)return '';
  var any={}, mono={}, none=0;
  list.forEach(function(c){
    var cs=statColoursOf(c);
    if(!cs.length)none++;
    cs.forEach(function(p){ any[p[1]]=(any[p[1]]||0)+1; });
    if(cs.length===1)mono[cs[0][1]]=(mono[cs[0][1]]||0)+1;
  });
  var ord=STAT_COLORS.map(function(p){ return p[1]; }).filter(function(nm){ return any[nm]; });
  ord.sort(function(x,y){ return any[y]-any[x]; });
  var word=n+(n===1?' card':' cards');
  if(!ord.length)return word+', all colourless';
  var top=ord[0];
  var s=word+', '+(any[top]===n?'all with '+top:any[top]+' with '+top)+', '+(mono[top]||0)+' mono-'+top;
  var rest=ord.slice(1).map(function(nm){ return nm+' '+any[nm]; });
  if(none)rest.push('Colourless '+none);
  return rest.length?s+'; also '+rest.join(', '):s;
}
function statLabelHTML(b,sz){
  var pips=b.pips?"<span class='stat-pips'>"+statPipsHTML(b.pips,sz)+(b.more?"<b class='stat-more'>+</b>":'')+"</span>":'';
  if(b.pipsOnly&&pips)return pips;
  return pips+"<span class='stat-lbl-t'>"+e(b.label)+"</span>";
}

function statRateMvHTML(cards){
  var rows=statRateChars(cards,_statRate), by={};
  rows.forEach(function(x){ var k=statMvKey(x.mv); (by[k]=by[k]||[]).push(x); });
  var data=STAT_MV_ROWS.map(function(k){
    var l=(by[k]||[]).slice().sort(function(x,y){ return x.rate-y.rate; });
    var s=l.map(function(x){ return x.rate; });
    return {k:k,rows:l,n:l.length,lo:statQuant(s,0.1),hi:statQuant(s,0.9),med:statQuant(s,0.5)};
  });
  var top=Math.max(1.5,Math.ceil(data.reduce(function(n,d){ return d.n?Math.max(n,d.hi):n; },0)*2)/2);
  var buckets=data.map(function(d){
    return {label:'Mana value '+d.k,cards:d.rows.map(function(x){ return x.c; }),
      notes:d.rows.map(function(x){ return statPctTxt(x.rate); })}; });
  _statBuckets.ratemv=buckets;
  var rng=function(d){ return d.n?(Math.round(d.lo*100)+'–'+Math.round(d.hi*100)+'% · med '+Math.round(d.med*100)):'no Characters'; };
  var h=statLineHTML(statSumText('Stat rate by mana value','',data.filter(function(d){ return d.n; }).map(function(d){
    return {label:d.k+':',v:rng(d)+' (n '+d.n+')'}; })));
  var sel=(_statBucket&&_statBucket.g==='ratemv')?_statBucket.i:null;
  var x=function(v){ return (v/top*100).toFixed(2)+'%'; };
  h+="<div class='stat-chart stat-has-gold stat-bands'>"+data.map(function(d,i){
    var band=d.n?("<i class='stat-band' style='left:"+x(d.lo)+";width:"+x(Math.max(d.hi-d.lo,0.004))+"'></i>"
      +"<i class='stat-med' style='left:"+x(d.med)+"'></i>"):'';
    return "<div class='stat-row"+(sel===i?' on':'')+"' onclick=\"edStatsBucket('ratemv',"+i+")\">"
      +"<span class='stat-lbl' title='Mana value "+d.k+"'><span class='stat-lbl-t'>Mana value "+d.k+"</span></span>"
      +"<span class='stat-n'>"+d.n+"</span>"
      +"<span class='stat-track stat-band-track'>"+band+"<i class='stat-gold' style='left:"+x(1)+"'></i></span>"
      +"<span class='stat-rng'>"+e(rng(d))+"</span></div>"; }).join('')
    +statAxisHTML(top,0.5,"<span class='stat-rng' aria-hidden='true'></span>")+"</div>";
  if(sel!=null&&buckets[sel])h+=statListHTML('ratemv',sel,e(buckets[sel].label),buckets[sel].cards,buckets[sel].notes);
  return h;
}

var STAT_BYCOL_COLS=[
  ['n','Characters','The Characters counted: number stats only, mana value 1 or more'],
  ['mv','Avg mana value','The average mana value of the Characters counted'],
  ['a','Attack','The average Attack'],['h','Health','The average Health'],['r','Arcane','The average Arcane'],
  ['ap','Attack / mana','Each Character’s Attack divided by its mana value, then averaged. A 3-mana Character with 3 Attack counts 1.00.'],
  ['hp','Health / mana','Each Character’s Health divided by its mana value, then averaged. A 3-mana Character with 3 Health counts 1.00.'],
  ['rp','Arcane / mana','Each Character’s Arcane divided by its mana value, then averaged. A 3-mana Character with 3 Arcane counts 1.00.']];
function statByColourHTML(cards){
  var groups=statColourGroups(statRateChars(cards,{b:_statRate.b,w:_statRate.w,slow:_statRate.slow,
    mythic:_statRate.mythic,mono:false}));
  var avg=function(rows,f){ return rows.length?rows.reduce(function(n,x){ return n+f(x); },0)/rows.length:null; };
  var data=groups.map(function(gp){
    var r=gp.rows;
    return {gp:gp,v:{n:r.length,mv:avg(r,function(x){ return x.mv; }),a:avg(r,function(x){ return x.a; }),
      h:avg(r,function(x){ return x.h; }),r:avg(r,function(x){ return x.r; }),
      ap:avg(r,function(x){ return x.a/x.mv; }),hp:avg(r,function(x){ return x.h/x.mv; }),
      rp:avg(r,function(x){ return x.r/x.mv; })}};
  });
  _statBuckets.bycolour=data.map(function(d){
    return {label:d.gp.label,pips:d.gp.pips||'',cards:d.gp.rows.map(function(x){ return x.c; })}; });
  var f2=function(v){ return v==null?'—':v.toFixed(2); };
  var h=statLineHTML(statSumText('Stats by colour','Attack / mana, Health / mana and Arcane / mana',
    data.filter(function(d){ return d.v.n; }).map(function(d){
      return {label:d.gp.label,v:f2(d.v.ap)+' / '+f2(d.v.hp)+' / '+f2(d.v.rp)}; })));
  var sel=(_statBucket&&_statBucket.g==='bycolour')?_statBucket.i:null;
  h+="<div class='stat-tblwrap'><table class='stat-tbl stat-bycol'><thead><tr><th>Colour</th>"
    +STAT_BYCOL_COLS.map(function(c){ return "<th title='"+e(c[2])+"'>"+e(c[1])+"</th>"; }).join('')
    +"</tr></thead><tbody>"+data.map(function(d,i){
      return "<tr class='"+(sel===i?'on':'')+"'><th scope='row' class='stat-tl'><button type='button' class='stat-sort'"
        +" onclick=\"edStatsBucket('bycolour',"+i+")\">"+statLabelHTML({label:d.gp.label,pips:d.gp.pips},13)+"</button></th>"
        +STAT_BYCOL_COLS.map(function(c){
          return "<td class='stat-num-c'>"+(c[0]==='n'?d.v.n:f2(d.v[c[0]]))+"</td>"; }).join('')+"</tr>";
    }).join('')+"</tbody></table></div>";
  var b=sel!=null&&_statBuckets.bycolour[sel];
  if(b)h+=statListHTML('bycolour',sel,statLabelHTML(b,13),b.cards,null);
  return h;
}

/* Published as colour_lists.json beside keywords.json (ghSyncOfficialExtras); built in below until one exists.
   Only the owner's copy edits them (edOwnerUnlocked), kept in meta 'colourLists' until its next Publish (ghPayload). */
var STAT_CL_TIERS=[['primary','Primary keywords'],['secondary','Secondary keywords'],
  ['tertiary','Tertiary keywords'],['subtypes','Sub-types']];
var STAT_CL_SRC={
  Red:['Firebreathing, Empower, Enact, Volley, Fury, Swift, Bloodlust, Overwhelm, Ignite',
    'Airborne, Intimidate, Flux, Lucky, Envoy, Wound',
    'Snare, Taunt, Desperation, Mechanical',
    'Alchemist, Bard, Bow, Clawed, Curse, Demonic, Divine, Dragon, Elemental, Fanged, Horned, Imp, Instrument, Knife, Potion, Pyro, Ranger, Rogue, Shaman, Song, Spear, Sword, Warrior, Wild, Wizard'],
  Orange:['Steadfast, Enact, Volley, Snare, Overwhelm, Mechanical, Puppeteer',
    'Guardian, Shield',
    'Firebreathing, Invulnerable, Coalesce, Fury, Swift, Taunt',
    'Alchemist, Artificer, Armor, Bard, Bow, Construct, Dragon, Geo, Golem, Hooved, Horned, Mace, Monk, Ranger, Scaly, Soldier, Spear, Sword'],
  Yellow:['Shield, Airborne, Donate, Envoy, Fortify, Guardian, Sovereign, Sustain, Toughened, Steadfast, Barrier, Immune',
    'Lucky, Invulnerable, Sealed',
    'Empower, Foretell, Coalesce, Snare, Mechanical, Oblivion',
    'Artificer, Bard, Clawed, Cleric, Construct, Divine, Elemental, Geist, Hooved, Horned, Instrument, Mace, Monk, Scaly, Soldier, Song, Spear, Spirit, Sword, Winged, Zephyr'],
  Green:['Amass, Barrier, Coalesce, Overwhelm, Snare, Taunt',
    'Guardian, Lethal, Sustain, Envoy',
    'Fortify, Donate, Dredge, Fury, Volley, Steadfast, Sovereign, Toughened, Swift, Foretell, Mutate',
    'Alchemist, Bard, Beast, Bow, Clawed, Cleric, Dragon, Druid, Elf, Fanged, Geo, Golem, Hooved, Horned, Insect, Instrument, Monk, Mutant, Pest, Plant, Potion, Ranger, Scaly, Shaman, Slimy, Song, Spirit, Swimming, Sword, Warrior, Wild'],
  Blue:['Airborne, Thaumaturge, Empower, Barrier, Illusion, Meditate, Foretell',
    'Guardian, Unblockable, Flux',
    'Steadfast, Donate, Envoy, Puppeteer',
    'Alchemist, Aqua, Bard, Clawed, Cryo, Cleric, Curse, Demonic, Druid, Elemental, Esper, Geist, Illusion, Imp, Insect, Instrument, Mutant, Potion, Rogue, Slimy, Song, Spear, Spirit, Swimming, Vampire, Winged, Wizard, Zephyr'],
  Indigo:['Gouge, Grind, Shade, Delve, Intimidate',
    'Airborne, Empower, Illusion, Dredge, Mutate, Foreshadow, Foretell, Thaumaturge, Desperation',
    'Meditate, Lethal, Bloodlust, Unblockable, Decayed, Depleted, Sealed, Barrier, Wound, Oblivion',
    'Clawed, Curse, Demonic, Esper, Geist, Horned, Horror, Illusion, Imp, Insect, Knife, Mutant, Necro, Outlaw, Pest, Rogue, Shade, Shaman, Slimy, Spear, Spirit, Undead, Vampire, Void, Winged'],
  Violet:['Decayed, Depleted, Desperation, Dredge, Intimidate, Illusion, Lethal, Shade, Sustain, Delve, Wound',
    'Taunt, Bloodlust, Unblockable',
    'Airborne, Donate, Gouge, Grind, Guardian, Mutate, Foreshadow, Fury, Puppeteer, Barrier',
    'Curse, Demonic, Esper, Fanged, Geist, Horror, Illusion, Imp, Insect, Knife, Mutant, Necro, Outlaw, Pest, Rogue, Shade, Shaman, Slimy, Spirit, Undead, Vampire, Void, Winged, Wizard']};
function statClDefault(){
  var sp=function(s){ return String(s).split(/\s*,\s*/).filter(Boolean); }, out={format:1,colours:{},
    shared:sp('Absolute, Amalgam, Amass, Barrier, Battlecry, Envoy, Immune, Raid, Unique, Unlimited'),any:['Beast']};
  STAT_COLORS.forEach(function(p){
    var src=STAT_CL_SRC[p[1]], o={};
    STAT_CL_TIERS.forEach(function(t,i){ o[t[0]]=sp(src[i]); });
    out.colours[p[1]]=o;
  });
  return out;
}
/* From outside, so rebuilt: names as text, each once per list, nothing else carried. */
function statClNorm(j){
  if(!j||typeof j!=='object'||!j.colours||typeof j.colours!=='object')return null;
  var names=function(a){
    var seen={}, out=[];
    (Array.isArray(a)?a:[]).forEach(function(x){
      if(typeof x!=='string')return; var s=x.trim().slice(0,60), k=s.toLowerCase();
      if(!s||seen[k])return; seen[k]=1; out.push(s);
    });
    return out;
  };
  var out={format:1,colours:{},shared:names(j.shared),any:names(j.any)};
  STAT_COLORS.forEach(function(p){
    var src=j.colours[p[1]]||{}, o={};
    STAT_CL_TIERS.forEach(function(t){ o[t[0]]=names(src[t[0]]); });
    out.colours[p[1]]=o;
  });
  return out;
}
var _statCL=null, _statClOwn=false, _statClColour='Red', _statClEdit=false, _statClLoaded=null;
function statClCur(){ return _statCL||(_statCL=statClDefault()); }
/* Only once the settings are in (ghRestoreOfficial): the owner's lists, else the published, else the built-in. */
function statClLoad(){
  if(_statClLoaded)return _statClLoaded;
  _statClLoaded=Promise.all([getMeta('colourLists'),getMeta('colourListsOfficial')]).then(function(v){
    var own=statClNorm(v[0]), off=statClNorm(v[1]);
    if(own&&edOwnerUnlocked()){ _statCL=own; _statClOwn=true; }
    else if(off)_statCL=off;
    if(_statGraph==='colourlists')edStatsRefresh();
  }).catch(function(){});
  return _statClLoaded;
}
function statClApplyOfficial(j){
  if(window.REBIRTH||edOwnerUnlocked())return false;
  var L=statClNorm(j); if(!L)return false;
  if(JSON.stringify(L)===JSON.stringify(_statCL))return false;
  _statCL=L; _statClOwn=false;
  setMetaSafe('colourListsOfficial',L);
  if(_statGraph==='colourlists')edStatsRefresh();
  return true;
}
function statClForPublish(){ return statClNorm(statClCur()); }
window.edColourLists=function(){ return JSON.parse(JSON.stringify(statClCur())); };
function statClArr(L,tier){ return tier==='shared'?L.shared:L.colours[_statClColour][tier]; }
function statClHas(arr,name){ var k=String(name).toLowerCase(); return arr.some(function(x){ return x.toLowerCase()===k; }); }
/* By tier and place, never a name in a handler (HANDOFF §12.1). */
window.edClOp=function(op,tier,i,v){
  if(!edOwnerUnlocked()){ toast('Only the official set’s owner edits the colour lists'); return; }
  var L=JSON.parse(JSON.stringify(statClCur())), arr=statClArr(L,tier), nm;
  if(!arr)return;
  if(op==='add'){
    var inp=document.getElementById('edClAdd-'+tier); nm=inp?inp.value.trim():'';
    if(!nm)return;
    if(statClHas(arr,nm)){ toast(nm+' is on that list already'); return; }
    arr.push(nm);
  } else if(op==='ren'){
    nm=String(v||'').trim();
    if(!nm||nm===arr[i]){ edStatsRefresh(); return; }
    arr[i]=nm;
  } else if(op==='mv'){
    var to=statClArr(L,v); if(!to||v===tier)return;
    nm=arr.splice(i,1)[0]; if(nm!=null&&!statClHas(to,nm))to.push(nm);
  } else if(op==='del'){ arr.splice(i,1); }
  else if(op==='any'){
    nm=arr[i]; if(nm==null)return;
    var k=-1; L.any.forEach(function(x,j){ if(x.toLowerCase()===nm.toLowerCase())k=j; });
    if(k>=0)L.any.splice(k,1); else L.any.push(nm);
  } else return;
  _statCL=statClNorm(L); _statClOwn=true;
  setMetaSafe('colourLists',_statCL,'the colour lists');
  edStatsRefresh();
};
function statClMatcher(name,tier){
  var n=String(name||'').trim(), low=n.toLowerCase();
  if(tier==='subtypes'){ var st=new RegExp('^'+statEsc(n)+'$','i');
    return function(c){ return statHasType(c.subTypes,st); }; }
  var re;
  if(/^(?:wound|oblivion|shield|seal)$/.test(low))re=statCounterRe(n);
  else if(low==='sealed')re=/(?<![\w-])seal(?:ed)?(?![\w-])/i;
  else if(statGloss('keyterm',true).some(function(k){ return k.name.toLowerCase()===low; }))re=statFormsRe(n);
  else {
    var kw=statGloss('keyword',false).filter(function(k){ return k.name.toLowerCase()===low; })[0];
    re=kw?statKwRe(kw):new RegExp('(?<![\\w-])'+statEsc(n)+'(?![\\w-])','i');
  }
  return function(c){ return re.test(statRules(c)); };
}
function statClCount(name,tier,cards){ var f=statClMatcher(name,tier); return cards.filter(f).length; }
function statClHTML(cards){
  var L=statClCur(), own=edOwnerUnlocked(), col=_statClColour, edit=own&&_statClEdit;
  if(!L.colours[col])col=_statClColour='Red';
  var mono=cards.filter(function(c){ var cs=statColoursOf(c); return cs.length===1&&cs[0][1]===col; });
  var anyK={}; L.any.forEach(function(x){ anyK[x.toLowerCase()]=1; });
  var h="<div class='stat-opts stat-cl-pick' role='group' aria-label='Colour'>"+STAT_COLORS.map(function(p){
      var on=p[1]===col;
      return "<button class='ed2-btn tiny"+(on?' on':'')+"' aria-pressed='"+(on?'true':'false')
        +"' onclick=\"edStatsSet('cl','"+p[1]+"')\">"+statPipsHTML(p[0],13)+" "+p[1]+"</button>"; }).join('')
    +(own?"<span class='stat-grow'></span><button class='ed2-btn tiny stat-tog"+(edit?' on':'')+"' id='edClEditBtn' aria-pressed='"
      +(edit?'true':'false')+"' onclick=\"edStatsSet('clEdit')\">Edit lists</button>":'')+"</div>";
  var lineItems=[];
  var tierHTML=function(tier,title,arr,count){
    var s="<div class='stat-cl-tier'><h4 class='stat-title'>"+e(title)+"</h4><div class='stat-cl-list'>";
    if(edit){
      s+=arr.map(function(nm,i){
        return "<div class='stat-cl-edit'><input class='ed2-input stat-cl-in' aria-label='Name' value='"+e(nm)+"'"
          +" onchange=\"edClOp('ren','"+tier+"',"+i+",this.value)\">"
          +(tier==='shared'?'':"<select class='ed2-input stat-cl-sel' aria-label='Tier' onchange=\"edClOp('mv','"+tier+"',"+i+",this.value)\">"
            +STAT_CL_TIERS.map(function(t){ return "<option value='"+t[0]+"'"+(t[0]===tier?' selected':'')+">"+t[1]+"</option>"; }).join('')
            +"</select>")
          +"<button type='button' class='ed2-btn tiny stat-tog"+(anyK[nm.toLowerCase()]?' on':'')+"' aria-pressed='"
            +(anyK[nm.toLowerCase()]?'true':'false')+"' onclick=\"edClOp('any','"+tier+"',"+i+")\">Any colour</button>"
          +"<button type='button' class='ed2-btn tiny warn' onclick=\"edClOp('del','"+tier+"',"+i+")\">Delete</button></div>";
      }).join('')
      +"<div class='stat-cl-edit stat-cl-add'><input class='ed2-input stat-cl-in' id='edClAdd-"+tier+"' aria-label='New entry'"
        +" placeholder='New entry' onkeydown=\"if(event.key==='Enter')edClOp('add','"+tier+"')\">"
        +"<button type='button' class='ed2-btn tiny primary' onclick=\"edClOp('add','"+tier+"')\">Add</button></div>";
    } else {
      s+=arr.length?arr.map(function(nm){
        var n=count(nm);
        lineItems.push({label:nm,v:n});
        return "<span class='stat-cl-e"+(n===0?' z':(n===1?' one':''))+"'>"+e(nm)
          +(anyK[nm.toLowerCase()]?" <i class='stat-cl-any'>any colour</i>":'')+" <b>"+n+"</b></span>"; }).join('')
        :"<i class='tpl-hint'>Nothing listed.</i>";
    }
    return s+"</div></div>";
  };
  var body='';
  STAT_CL_TIERS.forEach(function(t){
    body+=tierHTML(t[0],t[1],L.colours[col][t[0]],function(nm){ return statClCount(nm,t[0],mono); });
  });
  body+=tierHTML('shared','Shared keywords',L.shared,function(nm){ return statClCount(nm,'shared',mono); });
  if(!edit){
    var named={};
    STAT_CL_TIERS.forEach(function(t){ L.colours[col][t[0]].forEach(function(x){ named[x.toLowerCase()]=1; }); });
    L.shared.forEach(function(x){ named[x.toLowerCase()]=1; });
    var skip=function(nm){ var k=nm.toLowerCase(); return named[k]||anyK[k]; };
    var kws=[], seen={};
    statGloss('keyword',false).concat(statGloss('keyterm',true)).forEach(function(k){
      var key=k.name.toLowerCase(); if(seen[key]||skip(k.name)||STAT_PHASE.test(k.name))return; seen[key]=1;
      var n=statClCount(k.name,'kw',mono); if(n)kws.push({nm:k.name,n:n});
    });
    var subs={};
    mono.forEach(function(c){ statList(c.subTypes).forEach(function(s){
      s=String(s).trim(); if(s&&!skip(s))subs[s]=(subs[s]||0)+1; }); });
    var srt=function(a,b){ return (b.n-a.n)||a.nm.localeCompare(b.nm); };
    kws.sort(srt);
    var sl=Object.keys(subs).map(function(s){ return {nm:s,n:subs[s]}; }).sort(srt);
    var chips=function(a){ return a.length?a.map(function(x){
      return "<span class='stat-cl-e'>"+e(x.nm)+" <b>"+x.n+"</b></span>"; }).join(''):"<i class='tpl-hint'>None.</i>"; };
    body+="<div class='stat-cl-tier'><h4 class='stat-title'>Not on the list</h4>"
      +"<div class='stat-cl-list'><span class='stat-cl-k'>Keywords</span>"+chips(kws)+"</div>"
      +"<div class='stat-cl-list'><span class='stat-cl-k'>Sub-types</span>"+chips(sl)+"</div></div>";
  }
  return h+statLineHTML(statSumText('Colour lists','mono '+col,lineItems))
    +"<div class='stat-sum'><b>"+mono.length+"</b> mono-"+e(col)+" card(s)</div>"+body;
}

/* Rules text is broken where the card wraps it, so a sentence's tail can look like a keyword line: hence Choose, Target, Your and types are left out. */
var STAT_ACTIONS={imbue:1,draw:1,discard:1,create:1,gain:1,sacrifice:1,lose:1,destroy:1,banish:1,'return':1,heal:1,
  choose:1,target:1,your:1};
var STAT_KWITEM=/^([A-Z][A-Za-z’'\-]*(?: [A-Z][A-Za-z’'\-]*){0,2})(?: \([^()]*\)| [+-]?\d+| X)?$/;
function statGlossNames(){
  var s={};
  (window.KW_MATCHES||[]).forEach(function(k){
    if(!k)return;
    [k.name,k.match].forEach(function(x){ if(x)s[String(x).toLowerCase()]=1; });
  });
  return s;
}
function statNotInKeywords(){
  var gl=statGlossNames(), map={}, order=[], types={};
  (window.CARDS||[]).forEach(function(c){
    statList(c&&c.superTypes).concat(statList(c&&c.subTypes)).forEach(function(t){ types[String(t).toLowerCase()]=1; });
  });
  var typed=function(t){ return t.toLowerCase().split(' ').some(function(w){
    w=w.replace(/[’']s$/,''); return types[w]||types[w.replace(/s$/,'')]; }); };
  (window.CARDS||[]).forEach(function(c){
    statRules(c).split(/\r?\n/).forEach(function(line){
      var s=line.trim(); if(!s)return;
      var items=s.split(/\s*,\s*(?:and\s+)?|\s+and\s+/), got=[];
      for(var i=0;i<items.length;i++){
        var m=STAT_KWITEM.exec(items[i].trim()); if(!m)return;
        got.push(m[1]);
      }
      got.forEach(function(t){
        var low=t.toLowerCase(), first=low.split(' ')[0];
        if(gl[low]||gl[first]||STAT_ACTIONS[first]||typed(t))return;
        if(!map[t]){ map[t]=[]; order.push(t); }
        if(map[t].indexOf(c)<0)map[t].push(c);
      });
    });
  });
  return order.map(function(t){ return {word:t,cards:map[t]}; }).sort(function(a,b){
    return (b.cards.length-a.cards.length)||a.word.localeCompare(b.word); });
}
var STAT_ENDS=['s','es','d','ed','ing','r','er'];
function statTypoKept(){ var j=null; try{ j=JSON.parse(statLs('conjure.typoKeep')||'[]'); }catch(_){} return Array.isArray(j)?j:[]; }
function statWordText(c){ return statRules(c).replace(/\[\[[^\]]*\]\]/g,' ').toLowerCase(); }
function statTypos(withKept){
  var cnt={}, names={}, cards=window.CARDS||[];
  cards.forEach(function(c){
    (statWordText(c).match(/[a-z]+/g)||[]).forEach(function(w){ cnt[w]=(cnt[w]||0)+1; });
    (String(c&&c.name||'').toLowerCase().match(/[a-z]+/g)||[]).forEach(function(w){ names[w]=1; });
  });
  var kept={}; if(!withKept)statTypoKept().forEach(function(w){ kept[w]=1; });
  var plain=function(a,b){ return STAT_ENDS.some(function(s){ return a===b+s||b===a+s; }); };
  var AZ='abcdefghijklmnopqrstuvwxyz', out=[];
  Object.keys(cnt).forEach(function(w){
    if(w.length<5||cnt[w]>2||names[w]||kept[w])return;
    var best=null, seen={};
    var tryW=function(x){
      if(seen[x]||x===w)return; seen[x]=1;
      if((cnt[x]||0)<8||plain(w,x))return;
      if(!best||cnt[x]>cnt[best])best=x;
    };
    for(var i=0;i<=w.length;i++){
      if(i<w.length)tryW(w.slice(0,i)+w.slice(i+1));
      if(i<w.length-1)tryW(w.slice(0,i)+w[i+1]+w[i]+w.slice(i+2));
      for(var k=0;k<26;k++){
        if(i<w.length)tryW(w.slice(0,i)+AZ[k]+w.slice(i+1));
        tryW(w.slice(0,i)+AZ[k]+w.slice(i));
      }
    }
    if(!best)return;
    var re=new RegExp('(?<![a-z])'+w+'(?![a-z])');
    out.push({word:w,likely:best,uses:cnt[w],cards:cards.filter(function(c){ return re.test(statWordText(c)); })});
  });
  return out.sort(function(a,b){ return a.word<b.word?-1:a.word>b.word?1:0; });
}
var _statFixLists={nokw:[],typo:[]};
window.edFixWordCard=function(tool,ri,ci){
  var r=_statFixLists[tool]&&_statFixLists[tool][ri], c=r&&r.cards[ci];
  if(c&&typeof window.openMod==='function')window.openMod(c);
};
function statFixCardsHTML(tool,ri,cards){
  return cards.map(function(c,ci){
    return "<button type='button' class='shp-name' onclick=\"edFixWordCard('"+tool+"',"+ri+","+ci+")\">"+e(c.name)+"</button>"; }).join(' ');
}
window.edScanNotKw=function(){
  var list=statNotInKeywords(); _statFixLists.nokw=list;
  var host=document.getElementById('edNotKwBody'); if(!host)return list;
  if(!list.length){ host.innerHTML="<i class='tpl-hint'>Every word on a keyword line is in the glossary.</i>"; return list; }
  host.innerHTML="<i class='tpl-hint'><b>"+list.length+"</b> word(s) on keyword lines are not in the glossary.</i>"
    +"<div class='dup-list'>"+list.map(function(r,ri){
      return "<div class='dup-row'><b>"+e(r.word)+"</b><span class='fx-words'>"+statFixCardsHTML('nokw',ri,r.cards)+"</span></div>"; }).join('')+"</div>";
  return list;
};
window.edScanTypos=function(){
  var list=statTypos(false); _statFixLists.typo=list;
  var host=document.getElementById('edTypoBody'); if(!host)return list;
  var kept=statTypoKept().length;
  var h=list.length?("<i class='tpl-hint'><b>"+list.length+"</b> word(s) may be typos.</i><div class='dup-list'>"
      +list.map(function(r,ri){
        return "<div class='dup-row'><b>"+e(r.word)+"</b><i>→ "+e(r.likely)+"</i>"
          +"<span class='fx-words'>"+statFixCardsHTML('typo',ri,r.cards)+"</span>"
          +"<button type='button' class='ed2-btn tiny fx-look' onclick='edTypoKeep("+ri+")'>Keep this word</button></div>";
      }).join('')+"</div>")
    :"<i class='tpl-hint'>No word looks like a typo.</i>";
  if(kept)h+="<div class='fx-acts'><button type='button' class='ed2-btn tiny' onclick='edTypoKeepClear()'>Show the "
    +kept+" kept word(s) again</button></div>";
  host.innerHTML=h;
  return list;
};
window.edTypoKeep=function(ri){
  var r=_statFixLists.typo[ri]; if(!r)return;
  var k=statTypoKept(); if(k.indexOf(r.word)<0)k.push(r.word);
  statLsSet('conjure.typoKeep',JSON.stringify(k));
  window.edScanTypos();
};
window.edTypoKeepClear=function(){
  try{ localStorage.removeItem('conjure.typoKeep'); }catch(_){}
  window.edScanTypos();
};
window.edStatNotInKeywords=function(){ return statNotInKeywords().map(function(r){
  return {word:r.word,cards:r.cards.map(function(c){ return c.name; })}; }); };
window.edStatTypos=function(all){ return statTypos(!!all).map(function(r){
  return {word:r.word,likely:r.likely,cards:r.cards.map(function(c){ return c.name; })}; }); };

var _rateCard={mv:3,a:2,h:2,r:0,link:''};
function edRateNum(id,v,lbl){
  return "<label class='ed2-rate-f'><span>"+lbl+"</span><input type='number' class='ed2-input' id='"+id+"' step='"
    +(id==='edRateB'||id==='edRateW'?'0.1':'1')+"' min='0' value='"+e(String(v))+"' oninput='edRateCalc()'></label>";
}
function edRateCardHTML(c){
  if(window.REBIRTH)return '';
  if(c&&statIsChar(c)){
    var n=function(k){ var v=statRead(c,k); return typeof v==='number'?v:0; };
    _rateCard={mv:statNum(c.cmc)||0,a:n('attack'),h:n('health'),r:n('arcane'),link:statLinked(c)};
  }
  var v=_rateCard;
  return "<div class='ed2-group ed2-g-rate' id='edRateBox'><div class='ed2-rate-t'>Rate a card</div>"
    +"<div class='ed2-rate-row'>"
      +edRateNum('edRateMv',v.mv,'Mana value')+edRateNum('edRateA',v.a,'Attack')+edRateNum('edRateH',v.h,'Health')
      +edRateNum('edRateR',v.r,'Arcane')
      +"<label class='ed2-rate-f'><span>Linked orb</span><select class='ed2-input' id='edRateLink' onchange='edRateCalc()'>"
        +[['','None'],['A','Attack and Arcane'],['H','Health and Arcane']].map(function(o){
          return "<option value='"+o[0]+"'"+(o[0]===v.link?' selected':'')+">"+o[1]+"</option>"; }).join('')
      +"</select></label>"
      +edRateNum('edRateB',_statRate.b,'Budget')+edRateNum('edRateW',_statRate.w,'Arcane ÷')
    +"</div><div class='ed2-rate-out' id='edRateOut' aria-live='polite'></div></div>";
}
/* The enabled sagas' cards, whatever Statistics is set to count. */
function statsSagaCards(){
  var keep=_statBrowse; _statBrowse=false;
  try{ return statsCards(); } finally { _statBrowse=keep; }
}
window.edRateCalc=function(){
  var out=document.getElementById('edRateOut'); if(!out)return null;
  var g=function(id){ var el=document.getElementById(id); var n=el?parseFloat(el.value):NaN; return isFinite(n)?n:0; };
  var link=(document.getElementById('edRateLink')||{}).value||'';
  var mv=Math.round(g('edRateMv')), a=g('edRateA'), hp=g('edRateH'), r=g('edRateR');
  var b=g('edRateB')>0?g('edRateB'):2.5, w=g('edRateW')>0?g('edRateW'):1.5;
  var ar=document.getElementById('edRateR');
  if(link){ r=(link==='A')?a:hp; if(ar){ ar.value=String(r); ar.disabled=true; } }
  else if(ar)ar.disabled=false;
  _rateCard={mv:mv,a:a,h:hp,r:r,link:link};
  if(!(mv>=1)){ out.textContent='A mana value of 1 or more is needed.'; return null; }
  var pts=a+hp+r/w, bud=b*mv, rate=pts/bud;
  statMemoReset();
  var key=statMvKey(mv), pop=statRateChars(statsSagaCards(),{b:b,w:w}).filter(function(x){ return statMvKey(x.mv)===key; });
  var s=pop.map(function(x){ return x.rate; }).sort(function(x,y){ return x-y; });
  var line1=statPctTxt(rate)+' of budget · '+pts.toFixed(1)+' points against '+bud.toFixed(1);
  var what=key==='8+'?'Printed Characters of 8 or more mana':'Printed '+key+'-mana Characters', line2;
  if(!s.length)line2=what+': none to compare with.';
  else {
    var eps=1e-9, below=s.filter(function(x){ return x<rate-eps; }).length,
        ties=s.filter(function(x){ return Math.abs(x-rate)<=eps; }).length;
    var pr=Math.round((below+ties/2)/s.length*100);
    line2=what+' ('+s.length+'): middle 80% from '+statPctTxt(statQuant(s,0.1))+' to '+statPctTxt(statQuant(s,0.9))
      +', median '+statPctTxt(statQuant(s,0.5))+'. This card is above '+pr+'% of them.';
  }
  out.innerHTML="<div class='ed2-rate-big'>"+e(line1)+"</div><div>"+e(line2)+"</div>";
  return {rate:rate,points:pts,budget:bud,line1:line1,line2:line2};
};
