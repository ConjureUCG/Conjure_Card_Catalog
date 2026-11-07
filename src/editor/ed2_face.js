/* Part of the editor IIFE: what the markup calls must be put on window (HANDOFF §4). */

/* templateIdFor() takes the first entry that matches, so a more specific test goes before a general one. */
function _supers(c){ return edList(c&&c.superTypes).map(function(s){return String(s).toLowerCase();}); }
function hasSuper(c,name){ return _supers(c).indexOf(String(name).toLowerCase())>=0; }
function isEssenceCard(c){ return hasSuper(c,'essence'); }
var CARD_TEMPLATES=[
  /* An exclusion, not a list: a bare Essence card, or a supertype added later, must land here with no code change. */
  {id:'essence-boxed', test:function(c){
     return isEssenceCard(c) && !hasSuper(c,'core') && !hasSuper(c,'dual'); }},
  {id:'essence-bare',  test:function(c){ return isEssenceCard(c); }}
];
function templateIdFor(c){
  for(var i=0;i<CARD_TEMPLATES.length;i++){
    try{ if(CARD_TEMPLATES[i].test(c))return CARD_TEMPLATES[i].id; }catch(_){}
  }
  return '';
}
window.edTemplateFor=function(c){ return templateIdFor(c); };

/* An identified section sets --frame, --frame-dark, --pin and --ink-dark on itself, and every rule inside already reads them.
   Flavour is the card's, so it is one row below every section (a sibling of .m-rsecs), and fitFace sizes it first. */
function rulesAreaHTML(c,rulesAlign,rules,flavor){
  var secs=cardSections(c);
  /* Essence never splits: its box sits inside the art, and a card carrying rulesSplit is drawn as one box. */
  if(!secs||isEssenceCard(c))return rulesBoxHTML(c,rulesAlign,rules,flavor);
  /* A section wears an identity only when it has a name, cost or types to print, whatever the switches say. */
  var anyIdent=anySectionIdent(c);
  var choice=splitChoiceOf(c);
  var body=secs.map(function(s,i){
    var mine=sectionShowsIdent(c,s);
    var vars='';
    if(mine){
      var cols=colorsInCostOrder(s.manaCost);
      if(cols.length){
        vars="--frame:"+frameOf(cols)+";--frame-dark:"+frameDarkOf(cols)
            +";--pin:"+frameOf(cols)+";--ink-dark:"+outlineSolid(cols)+frSecVars(cols);
      }
    }
    var head='';
    if(mine){
      var pips=s.manaCost?manaCostHTML(s.manaCost,12):'';
      var tl=typeLine({superTypes:s.superTypes,subTypes:s.subTypes});
      if(s.name||pips)
        head+="<div class='m-rsec-name'><span class='m-rsec-pips'>"+pips+"</span>"
          +"<span class='m-rsec-nm'>"+e(s.name)+"</span></div>";
      if(tl)head+="<div class='m-rsec-type'>"+e(tl)+"</div>";
    }
    return "<div class='m-rsec"+(mine?' ident':'')+"'"+(mine&&cols&&cols.length?" data-fcol='"+e(cols[0])+"'":'')+(vars?" style='"+vars+"'":'')+">"
      +(mine?frBoxHTML('sec',cols):'')
      +head
      +"<div class='m-rules-body'>"+symbolizeRules(s.text||'')+"</div>"
      +"</div>";
  }).join('');
  /* The sections get their own wrapper so the Choice line can sit above them on either frame: .m-rsecs turns, the box stays a column. */
  var cRows=choiceRowsOf(c);
  /* symbolizeRules, not e() and a line break: the Choice line gets pills, symbols and [[links]] too, and it escapes first. */
  var choiceHTML=symbolizeRules(choiceTextOf(c));
  return "<div class='m-rules m-rules-split split-"+secs.length
    +(anyIdent?' has-ident':'')+(choice?' has-choice':'')
    +(flavor?' has-flavor':'')+" "+rulesAlign+"'>"
    +frBoxHTML('rules')
    +markLayerHTML(c)
    +(choice?("<div class='m-choice'"+(cRows?" data-rows='"+cRows+"'":"")+">"
      +(choiceHTML||'&nbsp;')+"</div>"):'')
    +"<div class='m-rsecs'>"+body+"</div>"
    +flavor
    +"</div>";
}

/* Every view draws faces with this, and it reads editor state: the card open in the editor is drawn as the saga being edited (edDrawSaga). */
function buildFaceHTML(c, opts){
  opts=opts||{};
  /* frameColorsOf, not c.colors: see the note there. */
  var fcols=frameColorsOf(c);
  var frame=frameOf(fcols);
  var frameDark=frameDarkOf(fcols);
  var inkDark=outlineSolid(fcols);
  var tplFrame=tplFrameFor(c);
  var pips=c.manaCost?manaCostHTML(c.manaCost,17):'';
  var al=alignFor(c);
  var _vv=variantOf(c);
  /* Resolved: a relative art/ path becomes a CDN address unless owner mode has the originals on this machine. */
  var art=(typeof artSrcOf==='function')?artSrcOf(_vv)
         :(_vv.imageUrl||(_vv.art&&ART[_vv.art])||_vv.art||'');
  var rules=symbolizeRules(c.ruleText||'');
  /* Which reminders show is per saga version, so they are read off the card as the saga it is drawn for. */
  var _remCard=c;
  /* a copy that already IS one saga's version (cardForSaga) is drawn as that */
  if(c.__drawSaga===undefined){
    try{
      var _rs=(typeof window.edDrawSaga==='function')?window.edDrawSaga(c):null;
      if(_rs&&typeof window.edCardForSaga==='function')_remCard=window.edCardForSaga(c,_rs)||c;
    }catch(_){}
  }
  var reminders=opts.reminders||cardReminders(_remCard);
  /* Only the reminder's leading keyword wears a pill: pills inside the explanation would double the one in the rules above. */
  if(reminders.length){ rules+=reminders.map(function(r){
    var html=(r&&r.name!==undefined)?window.edKwReminderHTML(r.name,r.text)
             :symbolizeRules(String(r||''),true).replace(/<\/?p>/g,'');
    return "<p style='font-style:italic;opacity:.85'>"+html+"</p>";}).join(''); }
  /* `f` is the card as the saga it is drawn for: a shared card's flavour and artist differ by saga. */
  var f=c;
  /* edDrawSaga, not edSagaOf: in the editor the card is drawn as the saga being edited, every field together. */
  var _drawSid=null;
  try{
    /* A cardForSaga copy names its own saga: edDrawSaga would answer with the saga being edited and mix two versions. */
    _drawSid=(c.__drawSaga!==undefined)?c.__drawSaga
            :(typeof window.edDrawSaga==='function')?window.edDrawSaga(c)
            :(typeof window.edSagaOf==='function')?window.edSagaOf(c):null;
    if(typeof window.edCardForSaga==='function' && _drawSid)
      f=window.edCardForSaga(c,_drawSid)||c;
  }catch(_){}
  /* parseFloat: flavorRows takes halves, as it is a line-height multiplier in fitFace. */
  var fRows=parseFloat(f.flavorRows||0)||0;
  var flavor=f.flavor?("<div class='m-flavor'"+(fRows?" data-rows='"+fRows+"'":"")+">"
    /* No pills in flavour: it is prose, and a pill would read as a mechanic. */
    +symbolizeRules(f.flavor,true).replace(/<\/?p>/g,'')+"</div>"):'';
  var distributor=f.designer||SETINFO.designer||SETINFO.title||'';
  /* The Saga line names the saga the card is shown under; c.saga is only its primary's name. */
  var saga=c.saga||SETINFO.saga||'';
  try{
    if(_drawSid && typeof window.edSagas==='function'){
      var _sid=_drawSid;
      var _sg=window.edSagas().filter(function(s){return s.id===_sid;})[0];
      if(_sg)saga=_sg.name||_sid||saga;
    }
  }catch(_){}
  var rev=f.revision||'';
  var artist=f.artist||SETINFO.artist||'';
  var num=cardNumber(c);
  var isEssence=isEssenceCard(c);
  var tplId=templateIdFor(c);
  var tplCls=tplId?(' mcard-tpl-'+tplId):'';
  var wantsRules=(tplId!=='essence-bare');
  var manaBar='';
  if(isEssence && typeof window.cardColorIcons==='function'){
    /* manaImg puts the colour name in alt=, which is how each circle is framed in its own colour. */
    var ic=''; try{ ic=window.cardColorIcons(c,72)||''; }catch(_){}
    if(ic){
      var wrapped=ic.replace(/<img [^>]*>/g,function(m){
        var a=m.match(/alt="([^"]*)"/);
        var col=a?String(a[1]).toLowerCase():'';
        var own=(col&&FRAME_ORDER.indexOf(col)>=0)?(";--pin:"+frameOf([col])+";--ink-dark:"+outlineSolid([col])):'';
        var sym=(col&&MANA_LETTER[col])?tplGet('sym:'+MANA_LETTER[col]):'';
        if(sym)m=m.replace(/\ssrc="[^"]*"/,' src="'+e(sym)+'"');
        return "<span class='m-mana-orb' style='"+own+"'>"+m+"</span>";
      });
      if(wrapped===ic)wrapped="<span class='m-mana-orb'>"+ic+"</span>";
      manaBar="<div class='m-mana-bar'>"+wrapped+"</div>";
    }
  }
  var orbHtml='';
  if(!isEssence){
    var list=cardOrbs(c);
    orbHtml=list.map(function(o){ return "<div class='m-orb-slot'>"+faceOrbHTML(o.type,o.value)+"</div>"; }).join('');
  }
  var rulesAlign='align-'+al.v+' just-'+al.h;
  /* Classes on .mcard, not <body>: see the note on TPL_DEFAULTS in ed2_core.js. */
  var _fm=frameModeOf(c);
  var frameCls=(_fm==='h')?' mcard-fh'
              :(_fm==='vl'?' mcard-fv mcard-fv-left':' mcard-fv mcard-fv-right');
  var fitCls=' fit-'+effectiveFit(c);
  /* An uploaded frame covers the outer ring too, placed as .m-tpl is. */
  var ringTpl=tplFrame?(e(cssUrl(tplFrame))+" var(--tpl-x) var(--tpl-y)/var(--tpl-w) var(--tpl-h) no-repeat,"):'';
  /* The frame in use (ed2_frames.js): its classes, its own background and the variables the face stylesheet reads; a face with an uploaded frame image takes none of its layers. */
  var fs=frFaceStyle(fcols,frame,frameDark,inkDark,!!tplFrame);
  return "<div class='mcard"+(isEssence?' mcard-essence':'')+frameCls+fitCls+tplCls+holoClasses(c)+fs.cls+"' style='background:"+ringTpl+fs.bg+fs.vars+holoStyleVars(c)+"'"+fs.attrs+">"
    +"<div class='mcard-inner'><div class='m-canvas'>"
      /* DOM order is the visual order (a flex column); the orbs sit inside .m-art so they anchor to the art box. */
      +"<div class='m-namebox'></div><div class='m-pinline m-pin-name'></div>"
      /* With no cost, .nocost: the name is right-aligned only to meet the pips. */
      +"<div class='m-nameline"+(pips?'':' nocost')+"'>"+frBoxHTML('name')+"<div class='m-pips'>"+pips+"</div>"
        +"<div class='m-name'>"+(e(c.name)||'&nbsp;')+"</div></div>"
      +"<div class='m-typebox'></div><div class='m-pinline m-pin-type'></div>"
      /* .m-tl-panel: the type line needs four paint layers, one more than an element and its two pseudos give. */
      +"<div class='m-typeline'"+frTypelineStyle(fcols)+">"+frBoxHTML('type')+"<i class='m-tl-panel'></i>"+(e(typeLine(c))||'&nbsp;')+"</div>"
      /* The transform goes on .m-art-img, not .m-art: .m-orbs is inside .m-art and would turn with the art. */
      /* .m-mid is display:contents on a horizontal card and the row on a vertical one. */
      +"<div class='m-mid'>"
      +"<div class='m-art "+(art?'':'empty')+"'>"
        /* .m-art-clip clips, not .m-art: clipping .m-art would clip the orbs inside it. */
        /* No inline background-size: the .fit-* class on .mcard sets it, so the letterbox rule and the image agree. */
        +(art?"<div class='m-art-clip'><div class='m-art-img' style='background-image:"+e(cssUrl(art))+artXfCss(c)+"'></div>"
             +((holoOf(c)||{}).image?"<div class='m-art-holo'></div>":'')+"</div>":'')
        +(orbHtml?"<div class='m-orbs'>"+orbHtml+"</div>":"")
        +((isEssence&&wantsRules)?rulesAreaHTML(c,rulesAlign,rules,flavor)+frRimHTML():'')
        +manaBar
      +"</div>"
      +(isEssence?'':"<div class='m-pinline m-pin-rules'></div>")
      +((!isEssence&&wantsRules)?rulesAreaHTML(c,rulesAlign,rules,flavor)+frRimHTML():'')
      +"</div>"
      /* A sibling of .m-mid so it covers the whole card; the layer order is in mcard_classic.css. */
      +(tplFrame?"<div class='m-tpl' style='background-image:"+e(cssUrl(tplFrame))+"'></div>":"")
      +"<div class='m-info"+(rarityOf(c)?' has-rarity':'')+"'>"
        +"<div class='i-distrib'>"+e(distributor)+"</div>"
        +(artist?"<div class='i-artist'>Artist: "+e(artist)+"</div>":"")
        +(saga?"<div class='i-saga'>Saga: "+e(saga)+"</div>":"")
        +(rev?"<div class='i-rev'>"+e(rev)+"</div>":"")
        +"<div class='i-num'>"+e(num)+"</div>"
        +rarityHTML(c)
      +"</div>"
    +"</div></div>"
    /* under the face: the inner frame's fill, the border's shade and lift, and the frame's own extras (ed2_frames.js) */
    +frExtrasHTML(fcols)
    +(c.testing?"<div class='mcard-test' title='Test card - left out of the published catalogue'>Test</div>":"")
    +"</div>";
}
window.edCardFaceHTML=function(cardOrName){
  ensureIds();
  var c=cardOrName;
  if(typeof cardOrName==='string'){ c=(window.CARDS||[]).find(function(x){return x.__id===cardOrName||x.name===cardOrName;}); }
  if(!c)return '';
  return buildFaceHTML(c,{});
};
window.edFitFaces=function(root){ (root||document).querySelectorAll('.mcard').forEach(function(card){ fitFace(card); }); };

/* The art panel has its own drag surface, not the live card, so a drag never fights the holo-tilt handler. */
var ART_XF_LIMITS={z:{min:0.2,max:4,step:0.01},x:{min:-100,max:100,step:0.5},
                   y:{min:-100,max:100,step:0.5},r:{min:-180,max:180,step:1}};
var ART_XF_LABEL={z:'Zoom',x:'X',y:'Y',r:'Rotate'};
function artXfLive(c){
  var t=Object.assign({},ART_XF_DEFAULT,(c&&variantOf(c).artXf)||{});
  return {z:numAttr(t.z,1),x:numAttr(t.x,0),y:numAttr(t.y,0),r:numAttr(t.r,0),
          f:(t.f===-1||t.f==='-1')?-1:1};
}
function stageFitSize(c){
  var f=(typeof effectiveFit==='function')?effectiveFit(c):'contain';
  return f==='cover' ? 'cover' : (f==='fill' ? '100% 100%' : 'contain');
}

/* The window keeps the card art box's measured shape, as X and Y are a percentage of it; the spill is the whole image
   at the same mapping, sized to its drawn rectangle, since a background never paints outside its own element. */
var ED_STAGE_MARGIN=0.70;     /* the window takes this much of the stage */
var _edArtNat={};

function edArtWindowRatio(){
  var a=document.querySelector('#edPvHost .m-art');
  if(a){
    var r=a.getBoundingClientRect();
    if(r.width>2&&r.height>2) return r.width/r.height;
  }
  return 326/238;
}
function edArtStageLayout(){
  var stage=document.getElementById('edArtStage');
  var box=document.getElementById('edArtStageBox');
  var spill=document.getElementById('edArtStageSpill');
  if(!stage||!box)return;
  var sw=stage.clientWidth, sh=stage.clientHeight;
  if(!sw||!sh)return;
  var ratio=edArtWindowRatio();
  var w=sw*ED_STAGE_MARGIN, h=w/ratio;
  if(h>sh*ED_STAGE_MARGIN){ h=sh*ED_STAGE_MARGIN; w=h*ratio; }
  var c=curCard();
  var src='';
  if(c){
    var _vv=variantOf(c);
    src=(typeof artSrcOf==='function')?artSrcOf(_vv)
       :(_vv.imageUrl||(_vv.art&&ART[_vv.art])||_vv.art||'');
  }
  if(!src||!spill){
    box.style.width=Math.round(w)+'px'; box.style.height=Math.round(h)+'px';
    if(spill)spill.style.display='none';
    return;
  }
  var nat=_edArtNat[src];
  if(!nat){
    box.style.width=Math.round(w)+'px'; box.style.height=Math.round(h)+'px';
    spill.style.display='none';
    var im=new Image();
    im.onload=function(){
      if(im.naturalWidth&&im.naturalHeight){
        _edArtNat[src]={w:im.naturalWidth,h:im.naturalHeight};
        edArtStageLayout();
      }
    };
    im.src=src;
    return;
  }
  var f=(typeof effectiveFit==='function')?effectiveFit(c):'contain';
  function drawn(bw,bh){
    if(f==='fill')return {w:bw,h:bh};
    var s=(f==='cover') ? Math.max(bw/nat.w, bh/nat.h) : Math.min(bw/nat.w, bh/nat.h);
    return {w:nat.w*s, h:nat.h*s};
  }
  /* The window shrinks until the drawn picture fits the stage, down to a floor below which it is too small to frame in.
     Zoom is left out: magnifying past the stage is what the user asked for. */
  var d=drawn(w,h);
  var fit=Math.min(1, (sw*0.97)/d.w, (sh*0.97)/d.h);
  var floor=Math.max(0.34*sw/w, 0.30*sh/h, 0);
  if(fit<1){
    var k=Math.max(fit, Math.min(1, floor));
    w*=k; h*=k;
    d=drawn(w,h);
  }
  box.style.width=Math.round(w)+'px';
  box.style.height=Math.round(h)+'px';
  spill.style.display='';
  spill.style.width=d.w+'px';
  spill.style.height=d.h+'px';
  spill.style.left=((w-d.w)/2)+'px';
  spill.style.top=((h-d.h)/2)+'px';
}

function artStageTransform(t){
  /* Must match artXfCss() in ed2_core.js, flip included, or the stage frames the art differently from the card. */
  var sx=(t.f===-1?-1:1)*t.z;
  return 'translate('+t.x+'%,'+t.y+'%) rotate('+t.r+'deg) scale('+sx+','+t.z+')';
}
/* The rules box last focused, as a split card has no #f-rules; edRulesTA falls back to #f-rules, then the first section. */
var _edRulesTA = null;
/* The Choice box counts as a rules box, so every tool on the bar (B / I / U, Add —, Insert Card Name) writes into it. */
document.addEventListener('focusin', function(ev){
  var t = ev.target;
  if(t && t.tagName === 'TEXTAREA' &&
     (t.id === 'f-rules' || t.id === 'f-choice'
      || t.classList.contains('ed2-sec-ta')
      || t.classList.contains('ed2-choice-ta'))) _edRulesTA = t;
  /* A tracker of its own: "Add —" also reaches Flavor Text, which Insert Card Name must not, as flavour reads no [[links]]. */
  if(t && t.tagName === 'TEXTAREA' && (t === _edRulesTA || t.id === 'f-flavor')) _edDashTA = t;
}, true);
var _edDashTA = null;
window.edInsertDash=function(){
  var ta = (_edDashTA && document.contains(_edDashTA)) ? _edDashTA : edRulesTA();
  if(!ta){ try{ toast('Open a card first'); }catch(_){} return false; }
  var s = ta.selectionStart, en = ta.selectionEnd, v = ta.value;
  var before = v.slice(0, s), after = v.slice(en);
  var lead  = (before === '' || /\s$/.test(before)) ? '' : ' ';
  var trail = /^\s/.test(after) ? '' : ' ';
  var ins = lead + '—' + trail;
  ta.value = before + ins + after;
  var caret = s + ins.length + ((trail === '' && /^ /.test(after)) ? 1 : 0);
  ta.selectionStart = ta.selectionEnd = caret;
  ta.focus();
  edRulesChanged(ta);
  return true;
};
function edRulesTA(){
  if(_edRulesTA && document.contains(_edRulesTA)) return _edRulesTA;
  return document.getElementById('f-rules')
      || document.querySelector('.ed2-sec-ta') || null;
}
/* Dispatches input rather than calling edLive(): a section box's oninput is edSetSection, and an inline handler runs for a dispatched event. */
function edRulesChanged(ta){
  try{ ta.dispatchEvent(new Event('input', {bubbles:true})); }
  catch(_){ try{ edLive(); }catch(__){} }
}
/* `stay` leaves the focus where it is, for the Symbols menu used from the keyboard or on a phone. */
function edRulesInsert(text, stay){
  var ta = edRulesTA(); if(!ta) return false;
  var s = ta.selectionStart, en = ta.selectionEnd, v = ta.value;
  ta.value = v.slice(0, s) + text + v.slice(en);
  ta.selectionStart = ta.selectionEnd = s + text.length;
  if(!stay) ta.focus(); else edKeepCaret(ta);
  edRulesChanged(ta);
  return true;
}
/* Chromium keeps the page's selection in the box that last had the focus, so once its text is replaced the next tap puts
   the caret at 0; letting go of the selection and setting the caret again keeps it in place. */
function edKeepCaret(el){
  if(!el || document.activeElement === el) return;
  var s = el.selectionStart, en = el.selectionEnd;
  try{ var sel = window.getSelection(); if(sel) sel.removeAllRanges(); el.setSelectionRange(s, en); }catch(_){}
}
window.edWrapRules=function(tag){
  var ta=edRulesTA(); if(!ta)return;
  var open='<'+tag+'>', close='</'+tag+'>';
  var s=ta.selectionStart, en=ta.selectionEnd, v=ta.value, sel=v.slice(s,en);
  if(s===en){
    ta.value=v.slice(0,s)+open+close+v.slice(s);
    ta.selectionStart=ta.selectionEnd=s+open.length;
  } else if(sel.slice(0,open.length)===open && sel.slice(-close.length)===close){
    sel=sel.slice(open.length,sel.length-close.length);
    ta.value=v.slice(0,s)+sel+v.slice(en);
    ta.selectionStart=s; ta.selectionEnd=s+sel.length;
  } else {
    ta.value=v.slice(0,s)+open+sel+close+v.slice(en);
    ta.selectionStart=s; ta.selectionEnd=s+open.length+sel.length+close.length;
  }
  ta.focus();
  edRulesChanged(ta);
};

/* No inline handlers here: card names travel as element data and textContent (HANDOFF §24.2).
   position:fixed and placed by hand: the editor pane scrolls, and a scroll container clips whatever the z-index. */
var _edClRows = [], _edClSel = 0;

function edClNorm(s){ return String(s||'').toLowerCase().replace(/[’']/g,''); }

function edClMatches(q){
  var list = (window.CARDS || []), n = edClNorm(q);
  var pre = [], sub = [];
  for(var i = 0; i < list.length; i++){
    var nm = list[i] && list[i].name; if(!nm) continue;
    if(!n){ pre.push(nm); if(pre.length > 200) break; continue; }
    var k = edClNorm(nm), at = k.indexOf(n);
    if(at === 0) pre.push(nm);
    else if(at > 0) sub.push(nm);
  }
  var byName = function(a,b){ return a.localeCompare(b); };
  pre.sort(byName); sub.sort(byName);
  return {pre: pre.slice(0, 60), sub: sub.slice(0, 60)};
}

function edClRender(){
  var host = document.getElementById('edClList'); if(!host) return;
  var q = (document.getElementById('edClSearch') || {}).value || '';
  var m = edClMatches(q);
  host.textContent = '';
  _edClRows = []; _edClSel = 0;
  var add = function(name){
    var b = document.createElement('button');
    b.type = 'button'; b.className = 'ed2-cl-row';
    b.textContent = name;
    b.dataset.name = name;
    host.appendChild(b); _edClRows.push(b);
  };
  m.pre.forEach(add);
  if(m.sub.length){
    var d = document.createElement('div');
    d.className = 'ed2-cl-sep';
    d.textContent = m.pre.length ? 'also contains'
      : ('nothing starts with \u201c' + q + '\u201d \u2014 these contain it');
    host.appendChild(d);
    m.sub.forEach(add);
  }
  if(!_edClRows.length){
    var none = document.createElement('div');
    none.className = 'ed2-cl-none';
    none.textContent = q ? 'No card matches' : 'No cards loaded';
    host.appendChild(none);
  }
  edClHighlight(0);
}

function edClHighlight(i){
  if(!_edClRows.length) return;
  _edClSel = Math.max(0, Math.min(_edClRows.length - 1, i));
  _edClRows.forEach(function(b, k){ b.classList.toggle('on', k === _edClSel); });
  var el = _edClRows[_edClSel];
  if(el && el.scrollIntoView) el.scrollIntoView({block:'nearest'});
}

function edClPick(name){
  if(!name) return;
  edRulesInsert('[[' + name + ']]');
  window.edCloseCardLink();
}

window.edCloseCardLink = function(){
  var p = document.getElementById('edClPop');
  if(p) p.remove();
};

window.edOpenCardLink = function(btn){
  window.edCloseCardLink();
  /* remember where to write BEFORE the search box takes focus away */
  var ta = edRulesTA();
  if(!ta){ try{ toast('Open a card first'); }catch(_){} return; }
  _edRulesTA = ta;

  var pop = document.createElement('div');
  pop.className = 'ed2-cl-pop'; pop.id = 'edClPop';
  var inp = document.createElement('input');
  inp.className = 'ed2-input'; inp.id = 'edClSearch'; inp.type = 'text';
  inp.placeholder = 'Search cards…'; inp.autocomplete = 'off';
  var list = document.createElement('div');
  list.className = 'ed2-cl-list'; list.id = 'edClList';
  pop.appendChild(inp); pop.appendChild(list);
  document.body.appendChild(pop);

  var r = (btn && btn.getBoundingClientRect) ? btn.getBoundingClientRect()
        : {left:20, bottom:60, top:60};
  var w = 300, h = 340;
  pop.style.left = Math.max(8, Math.min(window.innerWidth - w - 8, r.left)) + 'px';
  if(r.bottom + h + 8 > window.innerHeight && r.top > h + 8)
    pop.style.top = (r.top - h - 6) + 'px';
  else
    pop.style.top = (r.bottom + 6) + 'px';

  inp.addEventListener('input', edClRender);
  inp.addEventListener('keydown', function(ev){
    if(ev.key === 'Escape'){ ev.preventDefault(); window.edCloseCardLink(); }
    else if(ev.key === 'ArrowDown'){ ev.preventDefault(); edClHighlight(_edClSel + 1); }
    else if(ev.key === 'ArrowUp'){ ev.preventDefault(); edClHighlight(_edClSel - 1); }
    else if(ev.key === 'Enter'){
      ev.preventDefault();
      var el = _edClRows[_edClSel];
      if(el) edClPick(el.dataset.name);
    }
  });
  list.addEventListener('click', function(ev){
    var b = ev.target.closest ? ev.target.closest('.ed2-cl-row') : null;
    if(b) edClPick(b.dataset.name);
  });
  /* Bound on the next tick, or the click that opened it would close it. */
  setTimeout(function(){
    var off = function(ev){
      var p = document.getElementById('edClPop');
      if(!p){ document.removeEventListener('mousedown', off, true); return; }
      if(!p.contains(ev.target)){
        window.edCloseCardLink();
        document.removeEventListener('mousedown', off, true);
      }
    };
    document.addEventListener('mousedown', off, true);
  }, 0);

  edClRender();
  inp.focus();
};

/* A press in the menu takes no focus (edSymHold), so the caret stays in the box; from the keyboard or on a phone edKeepCaret keeps it.
   Stat and dice words are marked only standing alone (markStats, markDice), so a space is put in, but never inside 2D6. */
var ED_SYM_COLOURS=[['R','Red'],['O','Orange'],['Y','Yellow'],['G','Green'],['B','Blue'],['I','Indigo'],['V','Violet']];
var ED_SYM_STATS=[['ATK','Attack'],['HP','Health'],['MP','Arcane'],['Rg','Range']];
var _edSym=null;
function edSymPhone(){ return typeof catIsPhone==='function'&&catIsPhone(); }
window.edSymHold=function(ev){ if(ev&&!edSymPhone())ev.preventDefault(); };
function edSymGroups(cost){
  var mana=ED_SYM_COLOURS.map(function(c){ return {code:c[0],name:c[1]}; });
  if(!cost)mana.push({code:'L',name:'Lock'});
  mana.push({code:'X',name:'X'});
  var nums=[];
  for(var n=0;n<=20;n++)nums.push({code:String(n),name:'Number '+n});
  var out=[mana,nums];
  if(cost)return out;
  /* Uploads the rules can read (letters, digits and / in braces, as symbolizeRules has it) that are not drawn above already. */
  var have={};
  mana.concat(nums).forEach(function(x){ have[x.code]=1; });
  var up=Object.keys(TPL).filter(function(k){ return k.indexOf('sym:')===0&&tplOk(TPL[k]); })
    .map(function(k){ return k.slice(4); })
    .filter(function(t){ return /^[A-Za-z0-9\/]+$/.test(t)&&!have[t]; }).sort()
    .map(function(t){ return {code:t,name:'Uploaded symbol'}; });
  if(up.length)out.push(up);
  out.push(ED_SYM_STATS.map(function(s){ return {word:s[0],name:s[1],mark:STAT_MARKS[s[0]]}; })
    .concat(DICE_SIDES.map(function(d){ return {word:'D'+d,name:'Die',die:d}; })));
  return out;
}
function edSymHybrid(cs){
  return cs.slice().sort(function(a,b){ return MANA_ORDER.indexOf(a)-MANA_ORDER.indexOf(b); }).join('/');
}
function edSymWord(w,die){
  var ta=edRulesTA(); if(!ta)return w;
  var v=ta.value, a=v.charAt(ta.selectionStart-1), z=v.charAt(ta.selectionEnd);
  return ((die?/[A-Za-z_-]/:/[\w-]/).test(a)?' ':'')+w+(/[\w-]/.test(z)?' ':'');
}
/* With `stay` the box is never left, so the cost is sorted now, as leaving it would sort it. */
function edSymCost(code,stay){
  var el=document.getElementById('f-mana'); if(!el)return false;
  var v=el.value, s=el.selectionStart, en=el.selectionEnd;
  if(s==null){ s=en=v.length; }
  el.value=v.slice(0,s)+code+v.slice(en);
  try{ el.setSelectionRange(s+code.length,s+code.length); }catch(_){}
  if(!stay)el.focus();
  try{ el.dispatchEvent(new Event('input',{bubbles:true})); }catch(_){ try{ edLive(); }catch(__){} }
  if(stay){ window.edSortMana(el); edKeepCaret(el); }
  return true;
}
function edSymPut(x,ev,hy){
  var s=_edSym; if(!s)return;
  var stay=(!!ev&&ev.detail===0)||edSymPhone();
  var ok=s.cost?edSymCost(hy||x.code,stay)
    :edRulesInsert(hy?'{'+hy+'}':x.word?edSymWord(x.word,!!x.die):'{'+x.code+'}',stay);
  if(!ok){ try{ toast('Open a card first'); }catch(_){} }
}
window.edCloseSymbols=function(back){
  var s=_edSym; if(!s)return;
  _edSym=null;
  if(s.pop.parentNode)s.pop.parentNode.removeChild(s.pop);
  s.btn.setAttribute('aria-expanded','false');
  document.removeEventListener('click',s.off,true);
  document.removeEventListener('keydown',s.esc,true);
  window.removeEventListener('scroll',s.place,true);
  window.removeEventListener('resize',s.place);
  if(back&&document.contains(s.btn))s.btn.focus();
};
window.edOpenSymbols=function(btn,cost,ev){
  var again=!!_edSym&&_edSym.btn===btn;
  window.edCloseSymbols();
  if(again||!btn)return;
  cost=!!cost;
  var box=cost?document.getElementById('f-mana'):edRulesTA();
  if(!box){ try{ toast('Open a card first'); }catch(_){} return; }
  if(!cost)_edRulesTA=box;
  var phone=edSymPhone(), px=phone?24:20;
  var pop=document.createElement('div');
  pop.className='ed2-sym-pop'; pop.id='edSymPop';
  pop.setAttribute('role','dialog');
  pop.setAttribute('aria-label',cost?'Cost symbols':'Symbols');
  var mk=function(cls,name,html){
    var b=document.createElement('button'); b.type='button'; b.className=cls;
    b.title=name; b.setAttribute('aria-label',name); b.innerHTML=html;
    return b;
  };
  var top=document.createElement('div'); top.className='ed2-sym-top';
  var x=document.createElement('button'); x.type='button';
  x.className='ed2-btn nb nb-red nb-s close-x ed2-sym-x'; x.textContent='Close \u2715';
  x.addEventListener('click',function(){ window.edCloseSymbols(true); });
  top.appendChild(x); pop.appendChild(top);
  edSymGroups(cost).forEach(function(g){
    var grid=document.createElement('div'); grid.className='ed2-sym-grid';
    g.forEach(function(it){
      var b=mk('ed2-sym-btn',it.name+' ('+(it.word||(cost?it.code:'{'+it.code+'}'))+')',
        it.mark?statMarkSVG(it.mark):it.die?diceMarkSVG(it.die):symToken(it.code,px));
      b.addEventListener('click',function(e2){ edSymPut(it,e2); });
      grid.appendChild(b);
    });
    pop.appendChild(grid);
  });
  var hy=document.createElement('div'), picks=[];
  hy.className='ed2-sym-hyb';
  var hl=document.createElement('span'); hl.className='ed2-sym-hyb-lbl'; hl.textContent='Hybrid';
  hy.appendChild(hl);
  var add=mk('ed2-sym-btn ed2-sym-hadd','','');
  var ticks=ED_SYM_COLOURS.map(function(c){
    var t=mk('ed2-sym-btn ed2-sym-tick',c[1]+' in the hybrid',symToken(c[0],px));
    t.setAttribute('aria-pressed','false');
    t.addEventListener('click',function(){
      var i=picks.indexOf(c[0]);
      if(i>=0)picks.splice(i,1); else if(picks.length<3)picks.push(c[0]);
      paint();
    });
    hy.appendChild(t);
    return t;
  });
  var paint=function(){
    var code=picks.length>1?edSymHybrid(picks):'';
    ticks.forEach(function(t,i){
      var on=picks.indexOf(ED_SYM_COLOURS[i][0])>=0;
      t.setAttribute('aria-pressed',on?'true':'false');
      t.disabled=!on&&picks.length>=3;
    });
    var nm=code?'Add the hybrid ('+(cost?code:'{'+code+'}')+')':'Add a hybrid';
    add.disabled=!code; add.title=nm; add.setAttribute('aria-label',nm);
    add.innerHTML=(code?symToken(code,px):'')+'<span>Add</span>';
  };
  add.addEventListener('click',function(e2){ if(picks.length>1)edSymPut(null,e2,edSymHybrid(picks)); });
  hy.appendChild(add);
  paint();
  pop.appendChild(hy);
  document.body.appendChild(pop);

  var anchor=cost?(btn.parentNode||btn):btn;
  var place=function(){
    if(!document.contains(btn)){ window.edCloseSymbols(); return; }
    if(edSymPhone()){ pop.style.left=pop.style.top=''; return; }
    var r=anchor.getBoundingClientRect(), w=pop.offsetWidth, h=pop.offsetHeight;
    pop.style.left=Math.max(8,Math.min(window.innerWidth-w-8,r.left))+'px';
    pop.style.top=((r.bottom+h+8>window.innerHeight&&r.top>h+8)?r.top-h-6:r.bottom+6)+'px';
  };
  var off=function(e2){
    if(pop.contains(e2.target)||btn.contains(e2.target))return;
    window.edCloseSymbols();
  };
  var esc=function(e2){
    if(e2.key!=='Escape')return;
    e2.preventDefault(); e2.stopPropagation();
    window.edCloseSymbols(pop.contains(document.activeElement));
  };
  pop.addEventListener('mousedown',function(e2){ e2.preventDefault(); });
  /* No catalogue shortcut fires from the menu, and the arrows move round the grid, not to the next card. */
  pop.addEventListener('keydown',function(e2){
    e2.stopPropagation();
    var k=e2.key;
    if(!/^Arrow(Left|Right|Up|Down)$/.test(k))return;
    var all=Array.prototype.slice.call(pop.querySelectorAll('.ed2-sym-btn:not(:disabled)'));
    var i=all.indexOf(document.activeElement);
    if(i<0)return;
    e2.preventDefault();
    var to=k==='ArrowLeft'?all[i-1]:k==='ArrowRight'?all[i+1]:null;
    if(k==='ArrowUp'||k==='ArrowDown'){
      var r=all[i].getBoundingClientRect(), cx=r.left+r.width/2, dn=k==='ArrowDown', bd=Infinity;
      all.forEach(function(b){
        var q=b.getBoundingClientRect(), dy=dn?q.top-r.top:r.top-q.top;
        if(dy<4)return;
        var d=dy*1000+Math.abs(q.left+q.width/2-cx);
        if(d<bd){ bd=d; to=b; }
      });
    }
    if(to)to.focus();
  });
  _edSym={pop:pop,btn:btn,cost:cost,off:off,esc:esc,place:place};
  btn.setAttribute('aria-expanded','true');
  place();
  /* bound on the next tick, so the click that opened it does not close it */
  setTimeout(function(){ if(_edSym&&_edSym.pop===pop)document.addEventListener('click',off,true); },0);
  document.addEventListener('keydown',esc,true);
  window.addEventListener('scroll',place,true);
  window.addEventListener('resize',place);
  if(phone){
    var hd=document.querySelector('header'), hb=0;
    if(hd&&/fixed|sticky/.test(getComputedStyle(hd).position))hb=Math.max(0,hd.getBoundingClientRect().bottom);
    var br=box.getBoundingClientRect(), pt=pop.getBoundingClientRect().top;
    if(br.top<hb+4||br.top+Math.min(br.height,96)>pt)window.scrollBy(0,br.top-hb-8);
  } else if(ev&&ev.detail===0){
    var first=pop.querySelector('.ed2-sym-btn');
    if(first)first.focus();
  }
};
window.edFlipArt=function(){
  var c=curCard(); if(!c)return;
  var t=artXfLive(c);
  var vt=visualTarget(c);
  vt.artXf=Object.assign({},t,{f:(t.f===-1?1:-1)});
  markDirty(c); renderPreview(c);
  try{ window.edRenderArtPanel(); }catch(_){}
  try{ scheduleFace(); }catch(_){}
};
function fitPickerHTML(c){
  var cur=(variantOf(c)||{}).fit||'';
  var opt=function(val,label,title){
    return "<option value='"+val+"' title='"+e(title)+"'"+(cur===val?' selected':'')+">"+e(label)+"</option>";
  };
  return "<select class='ed2-in ed2-art-fit' aria-label='Art fill' title='How the art fills its window'"
    +" onchange='edSetCardFit(this.value)'>"
    +opt('','Auto','Follow the global Art fit setting')
    +opt('contain','Contain','Show the whole image, letterboxed')
    +opt('cover','Cover','Fill the frame, cropping the overflow')
    +opt('fill','Fill','Stretch to the frame, ignoring aspect ratio')
    +"</select>";
}
/* Only a section's index and a field name go into the inline handlers; section names travel as element values (HANDOFF §24.2). */
function rulesEditorHTML(c){
  var n=rulesSplitOf(c), ident=splitIdentOf(c);
  var head="<label class='ed2-fmt-lbl'>Rule Text"
    +"<span class='ed2-split-ctl'>"
      +"<select class='ed2-in tiny' title='Divide the rules box into sections' aria-label='Split the rules box' "
        +"onchange='edSetRulesSplit(this.value)'>"
      +RULES_SPLITS.map(function(k){
          return "<option value='"+k+"'"+(k===n?' selected':'')+">"
            +(k?('Split '+k):'No split')+"</option>"; }).join('')
      +"</select>"
      +(n?("<label class='ed2-split-id' title='Every section gets its own name, "
        +"type line and mana cost, and is drawn in its own colours. Leave it off "
        +"to choose section by section.'>"
        +"<input type='checkbox'"+(ident?' checked':'')
        +" onchange='edSetSplitIdent(this.checked)'>"
        +"<span>All Individual</span></label>"
        +"<label class='ed2-split-id' title='One line of text across the top of "
        +"the rules box, above the sections'>"
        +"<input type='checkbox'"+(splitChoiceOf(c)?' checked':'')
        +" onchange='edSetSplitChoice(this.checked)'>"
        +"<span>Choice</span></label>"):'')
    +"</span>"
    +"<span class='ed2-fmt'>"
      +"<button type='button' class='ed2-fmtbtn' title='Bold' onclick=\"edWrapRules('b')\"><b>B</b></button>"
      +"<button type='button' class='ed2-fmtbtn' title='Italic' onclick=\"edWrapRules('i')\"><i>I</i></button>"
      +"<button type='button' class='ed2-fmtbtn' title='Underline' onclick=\"edWrapRules('u')\"><u>U</u></button>"
      +"<button type='button' class='ed2-fmtbtn ed2-dashbtn' title='Insert an em dash (—)' "
        +"onclick='edInsertDash()'>Add —</button>"
      +"<button type='button' class='ed2-fmtbtn ed2-clbtn' "
        +"title='Link another card by name. It prints bold and underlined, shows "
        +"that card when hovered, and the Play Test board can create a copy of it.' "
        +"onclick='edOpenCardLink(this)'>Insert Card Name</button>"
      +"<button type='button' class='ed2-fmtbtn ed2-symbtn' title='Type a symbol at the cursor' "
        +"aria-haspopup='dialog' aria-expanded='false' onmousedown='edSymHold(event)' "
        +"onclick='edOpenSymbols(this,0,event)'>Symbols <span class='ed2-caret' aria-hidden='true'>&#9662;</span></button>"
    +"</span></label>";
  if(!n){
    return "<div class='ed2-field' style='flex:1;display:flex;flex-direction:column'>"
      +head
      +"<textarea class='ed2-textarea ed2-rules' id='f-rules' aria-label='Rule Text' oninput='edLive()'>"
      +e(c.ruleText)+"</textarea></div>";
  }
  var rows=(cardSections(c)||[]).map(function(s,i){
    var own=sectionIdentOn(c,s);
    var sw=ident?'':("<label class='ed2-sec-id' title='Give this section its own "
        +"name, type line and mana cost'>"
        +"<input type='checkbox'"+(s.ident?' checked':'')
        +" onchange='edSetSectionIdent("+i+",this.checked)'>"
        +"<span>Individual</span></label>");
    var idf=own?("<div class='ed2-sec-idrow'>"
        +"<input class='ed2-input' placeholder='Mana cost' value='"+e(s.manaCost)
          +"' oninput=\"edSetSection("+i+",'manaCost',this.value)\">"
        +"<input class='ed2-input' placeholder='Name' value='"+e(s.name)
          +"' oninput=\"edSetSection("+i+",'name',this.value)\">"
      +"</div><div class='ed2-sec-idrow'>"
        +"<input class='ed2-input' placeholder='Super-types, comma separated' value='"
          +e(s.superTypes.join(', '))
          +"' oninput=\"edSetSection("+i+",'superTypes',this.value)\">"
        +"<input class='ed2-input' placeholder='Sub-types, comma separated' value='"
          +e(s.subTypes.join(', '))
          +"' oninput=\"edSetSection("+i+",'subTypes',this.value)\">"
      +"</div>"):'';
    return "<div class='ed2-sec'>"
      +"<div class='ed2-sec-h'>Section "+(i+1)+sw+"</div>"+idf
      +"<textarea class='ed2-textarea ed2-sec-ta' aria-label='Section "+(i+1)+" text' "
      +"oninput=\"edSetSection("+i+",'text',this.value)\">"+e(s.text)+"</textarea>"
      +"</div>";
  }).join('');
  var choiceRow=splitChoiceOf(c)
    ?("<div class='ed2-choice-row'><span>Choice line</span>"
      +"<textarea class='ed2-textarea ed2-choice-ta' id='f-choice' rows='1' aria-label='Choice line' "
      +"placeholder='e.g. Choose 1, Roll D4' "
      +"oninput='edSetChoiceText(this.value)'>"+e(choiceTextOf(c))+"</textarea>"
      +"<div class='ed2-rows'>"
      +"<span title='Lines the Choice block may use on the card. Blank = one line.'>lines</span>"
      +"<input class='ed2-rowsin' type='number' min='0' max='8' step='0.5' value='"
      +e(String(c.choiceRows||''))+"' placeholder='1' aria-label='Lines for the Choice block' "
      +"oninput='edSetChoiceRows(this.value)'></div></div>")
    :'';
  return "<div class='ed2-field' style='flex:1;display:flex;flex-direction:column'>"
    +head+choiceRow+"<div class='ed2-secs'>"+rows+"</div></div>";
}

/* A card field, not a variant one: see frameModeOf(). */
function framePickerHTML(c){
  var cur=frameModeOf(c);
  var opt=function(val,label,title){
    return "<option value='"+val+"' title='"+e(title)+"'"+(cur===val?' selected':'')+">"+e(label)+"</option>";
  };
  return "<select class='ed2-in ed2-art-frame' aria-label='Art pane' title='Where the art sits on the card'"
    +" onchange='edSetFrame(this.value)'>"
    +opt('h','Horizontal Art','Art above the rules box - the standard frame')
    +opt('vl','Left Vertical Art','Art and rules side by side, art on the left')
    +opt('vr','Right Vertical Art','Art and rules side by side, art on the right')
    +"</select>";
}
window.edSetFrame=function(mode){
  var c=curCard(); if(!c)return;
  if(FRAME_MODES.indexOf(mode)<0)mode='h';
  /* Horizontal is the absent value, so an untouched card stays byte-identical. */
  if(mode==='h')delete c.frame; else c.frame=mode;
  markDirty(c); persistCard(c);
  renderPreview(c); try{ scheduleFace(); }catch(_){}
  try{ window.edRenderArtPanel(); }catch(_){}
};

/* While a card is split, ruleText is kept as the joined section text, so every reader of ruleText works unchanged;
   search and the filters read cardRuleText (cat_core.js), which adds the sections and the Choice text. */
function syncSplitRuleText(c){
  var secs=cardSections(c); if(!secs)return;
  c.ruleText=secs.map(function(s){ return s.text; })
                 .filter(function(t){ return t && t.trim(); })
                 .join('\n\n');
}
window.edSetRulesSplit=function(v){
  var c=curCard(); if(!c)return;
  var n=parseInt(v,10); if(RULES_SPLITS.indexOf(n)<0)n=0;
  if(!n){
    delete c.rulesSplit;
    /* c.sections is kept, so switching the split off and on again loses no text. */
  } else {
    var had=Array.isArray(c.sections)&&c.sections.length;
    c.rulesSplit=n;
    if(!Array.isArray(c.sections))c.sections=[];
    if(!had)c.sections[0]={text:String(c.ruleText||''),name:'',manaCost:'',
                           superTypes:[],subTypes:[]};
    while(c.sections.length<n)
      c.sections.push({text:'',name:'',manaCost:'',superTypes:[],subTypes:[]});
    syncSplitRuleText(c);
  }
  markDirty(c); persistCard(c);
  renderFields(); renderPreview(c); try{ scheduleFace(); }catch(_){}
};
window.edSetSplitIdent=function(on){
  var c=curCard(); if(!c)return;
  if(on)c.splitIdent=true; else delete c.splitIdent;
  markDirty(c); persistCard(c);
  renderFields(); renderPreview(c); try{ scheduleFace(); }catch(_){}
};
/* Kept apart from All Individual, which neither sets nor clears these, so a card can drop to a mix without retyping. */
window.edSetSectionIdent=function(i,on){
  var c=curCard(); if(!c)return;
  var secs=cardSections(c); if(!secs||!secs[i])return;
  if(!Array.isArray(c.sections))c.sections=[];
  while(c.sections.length<secs.length)
    c.sections.push({text:'',name:'',manaCost:'',superTypes:[],subTypes:[]});
  if(on)c.sections[i].ident=true; else delete c.sections[i].ident;
  markDirty(c); persistCard(c);
  renderFields(); renderPreview(c); try{ scheduleFace(); }catch(_){}
};
window.edSetSplitChoice=function(on){
  var c=curCard(); if(!c)return;
  if(on)c.splitChoice=true; else delete c.splitChoice;
  markDirty(c); persistCard(c);
  renderFields(); renderPreview(c); try{ scheduleFace(); }catch(_){}
};
/* Off is no field. Publish leaves a Test card out of cards.json and writes it to testing.json, which only the token
   holder's copy reads, so switching it on for a published card takes it from readers on their next open (HANDOFF §58.8). */
window.edToggleTesting=function(on){
  var c=curCard(); if(!c)return;
  if(typeof edCardLocked==='function'&&edCardLocked(c)){ edLockedToast(); return; }
  var want=(on===undefined)?!c.testing:!!on;
  if(want)c.testing=1; else delete c.testing;
  markDirty(c); persistCard(c);
  renderFields(); renderPreview(c); try{ scheduleFace(); }catch(_){}
  try{ applyToCatalog(); }catch(_){}
  toast(want?'Test card - Publish leaves it out of the catalogue':'No longer a Test card');
};
/* Typed into: no renderFields(), which would take the caret out of the field on every key. */
window.edSetChoiceText=function(v){
  var c=curCard(); if(!c)return;
  var s=String(v||'');
  if(s)c.choiceText=s; else delete c.choiceText;
  markDirty(c);
  renderPreview(c);
};
/* Halves are allowed (a line-height multiplier, as flavorRows is); no renderFields(), as the box is typed into. */
window.edSetChoiceRows=function(v){
  var c=curCard(); if(!c)return;
  var n=parseFloat(v); if(isNaN(n)||n<0)n=0;
  if(n)c.choiceRows=n; else delete c.choiceRows;
  markDirty(c); persistCard(c);
  renderPreview(c); try{ scheduleFace(); }catch(_){}
};
window.edSetSection=function(i,field,val){
  var c=curCard(); if(!c)return;
  var secs=cardSections(c); if(!secs||!secs[i])return;
  if(!Array.isArray(c.sections))c.sections=[];
  while(c.sections.length<secs.length)
    c.sections.push({text:'',name:'',manaCost:'',superTypes:[],subTypes:[]});
  var s=c.sections[i];
  if(field==='superTypes'||field==='subTypes'){
    s[field]=String(val||'').split(',').map(function(t){ return t.trim(); })
                            .filter(function(t){ return !!t; });
  } else {
    s[field]=String(val||'');
  }
  if(field==='text')syncSplitRuleText(c);
  markDirty(c);
  renderPreview(c);
};

function variantPickerHTML(c){
  var vs=cardVariants(c);
  var opts=(vs||[]).map(function(v){
    return "<option value='"+e(v.id)+"'"+(v.id===chosenVariantId(c)?' selected':'')+">"+e(v.label||v.id)+"</option>";
  }).join('');
  return "<div class='ed2-var-row'>"
    +"<label class='ed2-var-h'>Variant</label>"
    +(vs?("<select class='ed2-in' aria-label='Look' onchange=\"edSetVariant(this.value)\">"+opts+"</select>"
          +"<button class='ed2-btn nb nb-green nb-s' title='Rename' aria-label='Rename this look' onclick='edRenameVariant()'>✎</button>"
          +(vs.length>1?"<button class='ed2-btn nb nb-red nb-s' title='Delete this variant' aria-label='Delete this look' onclick='edDeleteVariant()'>Delete ✕</button>":""))
        :"<i class='tpl-hint' style='flex:1'>single look</i>")
    +"<button class='ed2-btn tiny primary' title='Add another look' aria-label='Add another look' onclick='edAddVariant()'>+</button>"
  +"</div>";
}
window.edRenderArtPanel=function(){
  var host=document.getElementById('edArtPanel'); if(!host)return;
  var c=curCard();
  if(!c){ host.innerHTML="<div class='ed2-art-empty'>No card selected.</div>"; return; }
  var frameRow="<div class='ed2-var-row ed2-artsel-row'>"+framePickerHTML(c)+fitPickerHTML(c)+"</div>";
  var _vv=variantOf(c);
  var art=(typeof artSrcOf==='function')?artSrcOf(_vv)
         :(_vv.imageUrl||(_vv.art&&ART[_vv.art])||_vv.art||'');
  /* Every control shows with no art too: what they set waits on the card for the picture, and Upload belongs on every path. */
  var t=artXfLive(c);
  function ctrl(k){
    var L=ART_XF_LIMITS[k];
    return "<div class='ed2-xf'><label for='edXf-"+k+"'>"+ART_XF_LABEL[k]+"</label>"
      +"<input type='range' id='edXf-"+k+"' min='"+L.min+"' max='"+L.max+"' step='"+L.step+"' value='"+t[k]+"' "
      +"oninput=\"edSetArtXf('"+k+"',this.value)\">"
      +"<input type='number' id='edXfN-"+k+"' aria-label='"+ART_XF_LABEL[k]+"' min='"+L.min+"' max='"+L.max+"' step='"+L.step+"' value='"+t[k]+"' "
      +"oninput=\"edSetArtXf('"+k+"',this.value)\"></div>";
  }
  host.innerHTML=
    variantPickerHTML(c)
    +frameRow
    /* Two copies of the image under one artStageTransform (edSetArtXf moves both): the dimmed spill, sized to the whole
       image, and the window copy, which carries the card's real fit. */
    +"<div class='ed2-stage' id='edArtStage'>"
      +"<div class='ed2-stage-box' id='edArtStageBox'>"
        +"<div class='ed2-stage-xf' id='edArtStageXf' style='transform:"+artStageTransform(t)+"'>"
          +"<div class='ed2-stage-spill' id='edArtStageSpill'"
          +(art?" style='background-image:"+e(cssUrl(art))+"'":"")+"></div>"
        +"</div>"
        +"<div class='ed2-stage-clip'>"
          +"<div class='ed2-stage-img' id='edArtStageImg' style='"+(art?"background-image:"+e(cssUrl(art))+";":"")
          +"background-size:"+stageFitSize(c)+";"
          +"transform:"+artStageTransform(t)+"'></div>"
          +(art?"":"<div class='ed2-art-empty ed2-stage-none'>This card has no art yet.</div>")
        +"</div>"
        +"<div class='ed2-stage-edge'></div>"
      +"</div>"
    +"</div>"
    +"<div class='ed2-xf-row'>"+ctrl('x')+ctrl('y')+"</div>"
    +"<div class='ed2-xf-row'>"+ctrl('z')+ctrl('r')+"</div>"
    /* The file input is rebuilt with the panel and its handler is inline, so nothing needs binding again. */
    +"<div class='ed2-xf-foot'>"
      +"<input type='file' id='f-artfile' accept='image/*' style='display:none' onchange='edArtUpload(this.files[0])'>"
      /* Remove stays last, away from the three pressed often. */
      +"<button class='ed2-btn tiny primary' onclick=\"document.getElementById('f-artfile').click()\">Upload</button>"
      +"<button class='ed2-btn tiny' onclick='edResetArtXf()'>Reset</button>"
      +"<button class='ed2-btn tiny"+(artXfLive(c).f===-1?' on':'')+"' title='Mirror the art left-to-right'"
        +" onclick='edFlipArt()'>Flip</button>"
      +"<button class='ed2-btn tiny danger' onclick='edArtClear()'>Remove</button>"
    +"</div>";
  edArtStageBind();
};
/* Exported so the checks measure the editor's own markup. */
window.edHoloSectionHTML=function(c){ return holoSectionHTML(c); };
function holoSectionHTML(c){
  var live=holoLive(c);
  var setOpts=['none'].concat(Object.keys(KW_HLSETS).filter(function(k){return k!=='none'&&KW_HLSETS[k];}));
  var rows=HOLO_SLOTS.map(function(k){
    var v=live[k];
    var opts=setOpts.map(function(o){ return "<option value='"+o+"'"+(v.set===o?' selected':'')+">"
      +kwHlLabel(o)+"</option>"; }).join('');
    var bopts=HOLO_BLENDS.map(function(o){ return "<option value='"+o+"'"+(v.blend===o?' selected':'')+">"
      +(o==='soft-light'?'Soft light':(o.charAt(0).toUpperCase()+o.slice(1)))+"</option>"; }).join('');
    return "<div class='ed2-hl-row'>"
      +"<label class='ed2-hl-h'>"+HOLO_SLOT_LABEL[k]+"</label>"
      +"<select class='ed2-in' aria-label='"+HOLO_SLOT_LABEL[k]+" highlight' onchange=\"edSetHolo('"+k+"','set',this.value)\">"+opts+"</select>"
      +"<select class='ed2-in' title='Blend mode' aria-label='"+HOLO_SLOT_LABEL[k]+" blend mode' onchange=\"edSetHolo('"+k+"','blend',this.value)\">"+bopts+"</select>"
      +"<input type='range' min='0' max='1' step='0.01' value='"+v.a+"' title='Strength' aria-label='"+HOLO_SLOT_LABEL[k]+" strength' "
      +"id='edHl-"+k+"' oninput=\"edSetHolo('"+k+"','a',this.value)\">"
      +"<input type='number' class='ed2-in ed2-hl-n' min='0' max='1' step='0.01'"
      +" value='"+v.a+"' title='Strength' aria-label='"+HOLO_SLOT_LABEL[k]+" strength' id='edHlN-"+k+"'"
      +" oninput=\"edSetHolo('"+k+"','a',this.value)\">"
    +"</div>";
  }).join('');
  return "<div class='ed2-group ed2-hlbox'>"+rows
    +"<div class='ed2-hl-row ed2-hl-mark'>"
      +"<button type='button' class='ed2-btn tiny ed2-hl-markbtn' onclick='edOpenMarks()'"
        +" title='Make and edit watermarks'>◈ Watermark</button>"
      +"<select class='ed2-input' id='f-mark' aria-label='Watermark' onchange='edSetCardMark(this.value)'></select></div>"
  +"</div>"
  +"<div class='ed2-hl-ovr' id='edOvrRow'>"+frameOvrRowHTML(c)+"</div>";
}
/* Each swatch toggles its colour in or out of the set, with no limit; the ids come from FRAME_ORDER, so no user text reaches the onclick. */
function frameOvrRowHTML(c){
  var cur=frameOvrSetOf(c);
  var clearBtn=frameOvrClearHTML(cur);
  var only=(cur.length===1);
  var one=function(col,label,extra){
    var on=(cur.indexOf(col)>=0);
    var ico=(window.CICO&&window.CICO[label])||'';
    return "<button type='button' class='ed2-ovr-b"+(extra||'')+(on?' on':'')+"'"
      +" title='"+e(label)
      +(on?(only?' \u2014 click again to clear the override'
                :' \u2014 click again to take it out'):'')+"'"
      +" aria-pressed='"+(on?'true':'false')+"'"
      +" onclick=\"edSetFrameColor('"+col+"')\">"
      +(ico?"<img src='"+ico+"' alt='"+e(label)+"'>"
           :"<span class='ed2-ovr-dot'></span>")
    +"</button>";
  };
  /* One row, no wider than the box above (sized in ed2_style.css): Colour, the eight swatches, then Clear. */
  return "<label class='ed2-hl-h' title='Print this card as other colours —"
      +" pick as many as you like. What the card IS does not change, only how"
      +" it is drawn.'>Colour</label>"
    +"<span class='ed2-ovr'>"
      +FRAME_ORDER.filter(function(x){return x!=='grey';}).map(function(col){
        return one(col, col.charAt(0).toUpperCase()+col.slice(1), '');
      }).join('')
      +"<span class='ed2-ovr-sep'></span>"
      +one('grey', 'Object', ' ed2-ovr-obj')
    +"</span>"
    +clearBtn;
}
function frameOvrClearHTML(cur){
  return ""
      /* Always there, dimmed when nothing is set: a button that comes and goes shifts the swatches under the pointer. */
      +"<button type='button' class='ed2-ovr-clr"+(cur.length?'':' ed2-nowt')+"'"
        +" onclick='edClearFrameColor()'"
        +" title='"+(cur.length
            ? 'Print this card in its own colours again'
            : 'This card is already printed in its own colours')+"'>Clear</button>";
}
window.edFrameOvrRowHTML=function(c){ return frameOvrRowHTML(c); };
/* Into the saga version being edited (sagaBorderOf, ed2_core.js), starting from what it shows, so changing one half leaves
   the other; null is none (Clear), and a half never set still follows the look. */
function edBorderWrite(c,patch){
  var sid=null;
  try{ if(typeof window.edEditingSaga==='function')sid=window.edEditingSaga(); }catch(_){}
  var cur=sagaBorderOf(edFieldSource(c))||{};
  var next=Object.assign({},cur,patch);
  Object.keys(next).forEach(function(k){ if(next[k]===undefined)delete next[k]; });
  var val=Object.keys(next).length?next:undefined;
  var done=false;
  try{ if(typeof window.edSetSagaField==='function')done=!!window.edSetSagaField(c,sid,'borderLook',val); }catch(_){}
  if(!done){ if(val)c.borderLook=val; else delete c.borderLook; }
}
window.edSetFrameColor=function(col){
  var c=curCard(); if(!c)return;
  if(FRAME_ORDER.indexOf(col)<0)return;
  var set=frameOvrSetOf(c);
  var i=set.indexOf(col);
  if(i>=0) set.splice(i,1); else set.push(col);
  set.sort(function(a,b){return FRAME_ORDER.indexOf(a)-FRAME_ORDER.indexOf(b);});
  /* null, not []: an empty array is still truthy, so it would read as an override. */
  edBorderWrite(c,{frameColor:set.length?set:null});
  markDirty(c);
  edOvrRepaint(c);
};
function edOvrRepaint(c){
  /* Only the row: re-rendering the form would take the focus out of the field being typed in. */
  var row=document.getElementById('edOvrRow');
  if(row)row.innerHTML=frameOvrRowHTML(c);
  renderPreview(c);
  try{ scheduleFace(); }catch(_){}
}
window.edClearFrameColor=function(){
  var c=curCard(); if(!c)return;
  if(!frameOvrSetOf(c).length)return;
  edBorderWrite(c,{frameColor:null});
  markDirty(c);
  edOvrRepaint(c);
};
window.edSetHolo=function(slot,field,val){
  var c=curCard(); if(!c)return;
  var live=holoLive(c);
  if(field==='a'){
    var a=parseFloat(val); if(!isFinite(a))a=0;
    a=Math.max(0,Math.min(1,a));
    a=Math.round(a*100)/100;
    live[slot].a=a;
    /* Only when it differs: writing the box being typed in moves its caret to the end. */
    var s=document.getElementById('edHl-'+slot), n=document.getElementById('edHlN-'+slot);
    if(s&&parseFloat(s.value)!==a)s.value=a;
    if(n&&parseFloat(n.value)!==a)n.value=a;
  }
  else if(field==='set')live[slot].set=String(val||'none');
  else live[slot].blend=String(val||'screen');
  var any=HOLO_SLOTS.some(function(k){return live[k].set&&live[k].set!=='none';});
  edBorderWrite(c,{holo:any?live:null});
  markDirty(c); renderPreview(c);
};

window.edSetArtXf=function(field,val){
  var o={}; o[field]=val; artXfWrite(o);
};
function artXfWrite(vals){
  var c=curCard(); if(!c)return false;
  var t=artXfLive(c), any=false;
  Object.keys(vals).forEach(function(field){
    var L=ART_XF_LIMITS[field]; if(!L)return;
    var v=parseFloat(vals[field]); if(!isFinite(v))return;
    v=Math.max(L.min,Math.min(L.max,v));
    v=Math.round(v/L.step)*L.step;
    v=Math.round(v*1000)/1000;
    t[field]=v; any=true;
    var s=document.getElementById('edXf-'+field), n=document.getElementById('edXfN-'+field);
    if(s&&parseFloat(s.value)!==v)s.value=v;
    if(n&&parseFloat(n.value)!==v)n.value=v;
  });
  if(!any)return false;
  visualTarget(c).artXf=t; markDirty(c);
  var img=document.getElementById('edArtStageImg');
  if(img)img.style.transform=artStageTransform(t);
  var xf=document.getElementById('edArtStageXf');
  if(xf)xf.style.transform=artStageTransform(t);
  renderPreview(c);
  return true;
}
window.edResetArtXf=function(){
  var c=curCard(); if(!c)return;
  delete visualTarget(c).artXf; markDirty(c);
  renderPreview(c); window.edRenderArtPanel();
};
function edArtStageBind(){
  var stage=document.getElementById('edArtStage'); if(!stage)return;
  var drag=null;
  /* Again on the next frame: the live preview it measures may not have been laid out yet. */
  edArtStageLayout();
  try{ requestAnimationFrame(edArtStageLayout); }catch(_){}
  try{
    if(window.ResizeObserver && !stage._edRO){
      stage._edRO=new ResizeObserver(function(){ edArtStageLayout(); });
      stage._edRO.observe(stage);
    }
  }catch(_){}
  stage.addEventListener('pointerdown',function(ev){
    var c=curCard(); if(!c)return;
    var t=artXfLive(c);
    /* The window's size, not the stage's: X and Y are a percentage of the art box. */
    var box=document.getElementById('edArtStageBox');
    var bw=(box&&box.clientWidth)||stage.clientWidth;
    var bh=(box&&box.clientHeight)||stage.clientHeight;
    drag={id:ev.pointerId,sx:ev.clientX,sy:ev.clientY,ox:t.x,oy:t.y,
          w:bw||1,h:bh||1,raf:0,nx:null,ny:null};
    stage.setPointerCapture(ev.pointerId); stage.classList.add('dragging'); ev.preventDefault();
  });
  /* One write and one redraw per frame: a mouse sends more moves than the screen draws frames, and each write redraws the card. */
  function flush(){
    if(!drag)return;
    if(drag.raf){ try{ cancelAnimationFrame(drag.raf); }catch(_){} drag.raf=0; }
    if(drag.nx===null)return;
    var v={x:drag.nx,y:drag.ny}; drag.nx=drag.ny=null;
    artXfWrite(v);
  }
  stage.addEventListener('pointermove',function(ev){
    if(!drag||ev.pointerId!==drag.id)return;
    drag.nx=drag.ox+((ev.clientX-drag.sx)/drag.w)*100;
    drag.ny=drag.oy+((ev.clientY-drag.sy)/drag.h)*100;
    if(!drag.raf){
      var d=drag;
      try{ d.raf=requestAnimationFrame(function(){ d.raf=0; if(drag===d)flush(); }); }
      catch(_){ flush(); }
    }
  });
  function end(ev){
    if(!drag||ev.pointerId!==drag.id)return;
    flush();
    try{ stage.releasePointerCapture(drag.id); }catch(_){}
    drag=null; stage.classList.remove('dragging');
  }
  stage.addEventListener('pointerup',end);
  stage.addEventListener('pointercancel',end);
  stage.addEventListener('wheel',function(ev){
    var c=curCard(); if(!c)return;
    ev.preventDefault();
    var t=artXfLive(c);
    window.edSetArtXf('z',t.z*(ev.deltaY<0?1.06:1/1.06));
  },{passive:false});
}

function renderPreview(c){
  var host=document.getElementById('edPvHost'); if(!host)return;
  if(!c){host.innerHTML="<div style='color:var(--tm);font-family:Crimson Pro,serif;padding:20px'>Nothing selected.</div>";return;}
  host.innerHTML=buildFaceHTML(c);
  fitFace(host);
}
/* CSS cannot lay a gradient out in the card's space, so each box's frame layer is sized to the card and offset back by the
   box's position, read from offsetLeft and offsetTop: layout pixels, as the preview scales the card. */
/* Counts commas at bracket depth 0: a regex split counts the commas inside a gradient's stops (12 layers for 2). */
function bgLayerCount(img){
  var s=String(img||''), depth=0, n=1;
  if(!s || s==='none') return 1;
  for(var i=0;i<s.length;i++){
    var ch=s.charAt(i);
    if(ch==='(') depth++;
    else if(ch===')') depth--;
    else if(ch===',' && depth===0) n++;
  }
  return n;
}

function alignFrameGradients(root){
  /* root may be the card itself, and querySelectorAll never matches its own root. */
  var cards=(root.matches&&root.matches('.mcard'))?[root]:[];
  root.querySelectorAll('.mcard').forEach(function(c){ cards.push(c); });
  cards.forEach(function(card){
    var cw=card.offsetWidth, ch=card.offsetHeight;
    if(!cw||!ch)return;
    /* .m-namebox and .m-typebox are hidden leftovers: with a null offsetParent they cost nothing here. */
    card.querySelectorAll('.m-nameline,.m-typeline,.m-rules,.m-namebox,.m-typebox').forEach(function(el){
      var x=0,y=0,n=el;
      while(n&&n!==card){ x+=n.offsetLeft; y+=n.offsetTop; n=n.offsetParent; }
      /* The frame is always the last layer, but the count varies by box, so the lists are built to match. */
      var layers=bgLayerCount(getComputedStyle(el).backgroundImage);
      var sz=[],ps=[];
      for(var i=0;i<layers-1;i++){ sz.push('auto'); ps.push('0 0'); }
      sz.push(cw+'px '+ch+'px'); ps.push((-x)+'px '+(-y)+'px');
      el.style.backgroundSize=sz.join(', ');
      el.style.backgroundPosition=ps.join(', ');
      // For the pseudo-elements, which inherit custom properties: the type line's ::after needs the same offsets.
      el.style.setProperty('--gsize',cw+'px '+ch+'px');
      el.style.setProperty('--gpos',(-x)+'px '+(-y)+'px');
    });
    /* The art slides up under the type line by its measured height (it grows with the font): -4px, its box and 6px make the +2. */
    var tl=card.querySelector('.m-typeline'), art=card.querySelector('.m-art');
    var orbs=card.querySelector('.m-orbs');
    /* Not on a vertical card: there the art is a row item beside the rules box, and a negative margin pulls it out of the row. */
    var vertical=card.classList.contains('mcard-fv');
    if(tl&&art&&!vertical&&!document.body.classList.contains('mse-template')){
      var lift=tl.offsetHeight+2;
      art.style.marginTop=(-lift)+'px';
      /* The orbs are inside .m-art and would rise with it; h-4 puts the first orb's top on the type line's bottom edge. */
      if(orbs)orbs.style.top=(tl.offsetHeight-4)+'px';
    } else {
      if(art)art.style.marginTop='';
      if(orbs)orbs.style.top='';
    }
  });
}
/* A binary search, as every probe forces a layout; hi is tried first, as most text fits at full size (one probe).
   fits() must be monotonic: if a size fits, every smaller one does. */
function fitLargest(apply, fits, lo, hi){
  apply(hi); if(fits()) return hi;
  var l=lo, h=hi, best=null, mid, g=0;
  while(g++<8 && h-l>0.25){
    mid=Math.round(((l+h)/2)*4)/4;
    apply(mid);
    if(fits()){ best=mid; l=mid; } else { h=mid; }
  }
  if(best==null){ apply(lo); return lo; }
  apply(best); return best;
}

/* N rows is N lines at the block's base size, measured once and held, so the rules keep one budget whatever the text does;
   the line height is read from the stylesheet, and width is tested too, as one long word never wraps. */
/* `grow` is the search's ceiling, and every caller passes `base`: nothing here prints larger than the stylesheet says. */
function fitRowBlock(el, rows, base, floor, grow){
  el.style.fontSize=base+'px'; el.style.height=''; el.style.maxHeight='';
  el.style.overflow='hidden';
  var cs=getComputedStyle(el);
  var baseLh=parseFloat(cs.lineHeight)||base*1.3;
  var padY=(parseFloat(cs.paddingTop)||0)+(parseFloat(cs.paddingBottom)||0);
  var bordY=(parseFloat(cs.borderTopWidth)||0)+(parseFloat(cs.borderBottomWidth)||0);
  var textBudget=baseLh*rows;
  var budget=textBudget+padY+(cs.boxSizing==='border-box'?bordY:0);
  var fits=function(sz){
    el.style.fontSize=sz+'px';
    /* scrollHeight includes the padding and not the border, so the padding is added back to the text budget. */
    return el.scrollHeight<=textBudget+padY+1 && el.scrollWidth<=el.clientWidth+1;
  };
  var lo=floor, hi=grow, best=null, mid;
  for(var g=0; g<7 && hi-lo>0.25; g++){
    mid=Math.round(((lo+hi)/2)*4)/4;
    if(fits(mid)){ best=mid; lo=mid; } else { hi=mid; }
  }
  if(best==null){
    /* Too much even at the floor: the block takes the height it needs, as nothing is ever cut off. */
    el.style.fontSize=floor+'px';
    el.style.height=Math.max(budget, el.scrollHeight)+'px';
  } else {
    el.style.fontSize=best+'px';
    el.style.height=budget+'px';
  }
}
/* Direct children only: a face from an older renderer still has the flavour inside a section, which is not the box's own row. */
function ownRow(el, cls){
  var kids=el.children;
  for(var i=0;i<kids.length;i++)
    if(kids[i].classList && kids[i].classList.contains(cls))return kids[i];
  return null;
}

/* scrollHeight leaves out the border and a border-box height counts it, so the border is added back. */
function pinToContent(el){
  var cs=getComputedStyle(el);
  var bordY=(parseFloat(cs.borderTopWidth)||0)+(parseFloat(cs.borderBottomWidth)||0);
  el.style.height=(el.scrollHeight+(cs.boxSizing==='border-box'?bordY:0))+'px';
}

/* Never compare a rect (screen pixels) with clientWidth, scrollWidth or offsetWidth (layout pixels): every card outside
   the editor is scaled. Why each line is here: HANDOFF §39. */
function textFits(el){
  /* A Range over an element with a child measures the whole line box; both of these are layout px, so this is transform-safe. */
  if(el.firstElementChild) return el.scrollWidth <= el.clientWidth + 1;
  var box = el.getBoundingClientRect().width;
  var scale = (el.offsetWidth > 0) ? (box / el.offsetWidth) : 1;
  if(!(scale > 0)) scale = 1;
  var cs = getComputedStyle(el);
  var inner = el.clientWidth - (parseFloat(cs.paddingLeft) || 0)
                             - (parseFloat(cs.paddingRight) || 0);
  var r = document.createRange();
  r.selectNodeContents(el);
  return (r.getBoundingClientRect().width / scale) <= inner + 0.05;
}
function fitFace(root){
  root.querySelectorAll('.m-name').forEach(function(el){
    fitLargest(function(sz){ el.style.fontSize=sz+'px'; },
               function(){ return textFits(el); }, 6, 21.35);
  });
  root.querySelectorAll('.m-typeline').forEach(function(el){
    fitLargest(function(sz){ el.style.fontSize=sz+'px'; },
               function(){ return textFits(el); }, 5, 15.85);
  });
  /* Section names and type lines only shrink: the ceiling is the stylesheet's 11px and 8.5px, never above the card's name. */
  root.querySelectorAll('.m-rsec-nm').forEach(function(el){
    fitLargest(function(sz){ el.style.fontSize=sz+'px'; },
               function(){ return textFits(el); }, 5, 11);
  });
  root.querySelectorAll('.m-rsec-type').forEach(function(el){
    fitLargest(function(sz){ el.style.fontSize=sz+'px'; },
               function(){ return textFits(el); }, 4.5, 8.5);
  });
  /* Flavour yields to rules: it is sized first and pinned, and the rules text fits what is left. */
  /* In a split box the Choice block, then the flavour, are sized before the sections, which take what is left; the bodies
     open at RMAX first, as the flavour's automatic mode measures them at full size. */
  root.querySelectorAll('.m-rules-split').forEach(function(box){
    /* FMAX and CBASE are the opening size and the ceiling: rows buy space, never larger letters. */
    var RMAX=13.75, FMAX=11.5, FMIN=5.5;
    var CBASE=11, CMIN=5.5;
    var bodies=[].slice.call(box.querySelectorAll('.m-rsec .m-rules-body'));
    bodies.forEach(function(b){ b.style.fontSize=RMAX+'px'; });

    var ch=ownRow(box,'m-choice');
    if(ch){
      /* Blank means one row, not automatic: the line is fitted into it and shrinks rather than being cut off. */
      var cRows=parseFloat(ch.getAttribute('data-rows')||'0')||1;
      fitRowBlock(ch, cRows, CBASE, CMIN, CBASE);
    }

    var fl=ownRow(box,'m-flavor');
    if(fl){
      var fRows=parseFloat(fl.getAttribute('data-rows')||'0');
      if(fRows>0){ fitRowBlock(fl, fRows, FMAX, FMIN, FMAX); }
      else {
        /* As in a plain box, but yielding to every section; still monotonic, so halving holds. */
        fl.style.fontSize=FMAX+'px'; fl.style.height=''; fl.style.maxHeight='';
        fl.style.overflow='hidden';
        fitLargest(function(sz){ fl.style.fontSize=sz+'px'; },
                   function(){ return bodies.every(function(b){
                     return b.scrollHeight<=b.clientHeight+2; }); }, 7, FMAX);
        pinToContent(fl);
      }
    }
  });

  /* Each section is its own fit unit: querySelector on a split box would find only the first section's body. */
  root.querySelectorAll('.m-rules:not(.m-rules-split), .m-rsec').forEach(function(box){
    var body=box.querySelector('.m-rules-body'), fl=box.querySelector('.m-flavor');
    if(!body)return;
    /* FMAX opens and caps, as in the split loop above. */
    var RMAX=13.75, RMIN=5.5, FMAX=11.5, FMIN=5.5;
    body.style.fontSize=RMAX+'px';

    if(fl){
      fl.style.fontSize=FMAX+'px'; fl.style.height=''; fl.style.maxHeight=''; fl.style.overflow='hidden';
      var rows=parseFloat(fl.getAttribute('data-rows')||'0');
      if(rows>0){
        fitRowBlock(fl, rows, FMAX, FMIN, FMAX);
      } else {
        /* Sizes the flavour and measures the body beside it: still monotonic, so halving holds. */
        fitLargest(function(sz){ fl.style.fontSize=sz+'px'; },
                   function(){ return body.scrollHeight<=body.clientHeight+2; }, 7, FMAX);
        pinToContent(fl);
      }
    }
    /* The body, not the box: .m-rules has overflow:hidden and a fixed height, so its scrollHeight never shows overflow. */
    /* Top-aligned while measuring: overflow past the start edge of a centred flex column is not in scrollHeight. */
    var _jc=body.style.justifyContent;
    body.style.justifyContent='flex-start';
    fitLargest(function(sz){ body.style.fontSize=sz+'px'; },
               function(){ return body.scrollHeight<=body.clientHeight+1; }, RMIN, RMAX);
    body.style.justifyContent=_jc;
  });
  // After the fitting: shrinking type changes box heights, and so the offsets.
  try{ alignFrameGradients(root); }catch(_){}
  /* Then the frame's own layers, drawn from the boxes where the fitting left them (ed2_frames.js). */
  try{ frameDecorate(root); }catch(_){}
}

(function(){ if(window.matchMedia&&matchMedia('(prefers-reduced-motion:reduce)').matches)return;
  var cur=null;
  function reset(card){if(!card)return;['--rx','--ry','--holo-ang','--ico-sx','--ico-sy'].forEach(function(p){card.style.removeProperty(p);});
    card.querySelectorAll('linearGradient[data-rot]').forEach(function(g){ g.setAttribute('gradientTransform',ORB_ANG); });
    try{ frameTiltReset(card); }catch(_){}}
  document.addEventListener('pointermove',function(ev){
    if(!ev.target||!ev.target.closest)return;
    // Only the full-size faces, never the scaled grid tiles.
    var card=ev.target.closest('#edPvHost .mcard, #mdi .mcard');
    if(card!==cur){reset(cur);cur=card;} if(!card)return;
    var r=card.getBoundingClientRect(); if(!r.width||!r.height)return;
    var px=(ev.clientX-r.left)/r.width,py=(ev.clientY-r.top)/r.height,MAX=8;
    card.style.setProperty('--ry',((px-0.5)*2*MAX).toFixed(2)+'deg');
    card.style.setProperty('--rx',(-(py-0.5)*2*MAX).toFixed(2)+'deg');
    var ang=Math.round(90+(px-0.5)*220+(py-0.5)*90);
    card.style.setProperty('--holo-ang',ang+'deg');
    card.style.setProperty('--ico-sx',(0.91-(px-0.5)*4.8).toFixed(2)+'px');
    card.style.setProperty('--ico-sy',(1.82-(py-0.5)*4.8).toFixed(2)+'px');
    // gradientTransform cannot read a CSS custom property, so the orb gradients are turned here.
    card.querySelectorAll('linearGradient[data-rot]').forEach(function(g){
      g.setAttribute('gradientTransform','rotate('+ang+' .5 .5)');
    });
    /* the frame's own lines and the Nebula sky follow the same light (ed2_frames.js) */
    try{ frameTilt(card,px,py,ang); }catch(_){}
  },{passive:true});
  document.addEventListener('pointerleave',function(){reset(cur);cur=null;},true);
})();

function curCard(){ if(!curId)return null; return (window.CARDS||[]).find(function(c){return c.__id===curId;})||null; }
/* __id is this load's handle on a card, minted fresh each time; cid is the card's own id and is saved. */
function ensureIds(){ (window.CARDS||[]).forEach(function(c){
  if(!c.__id)c.__id=uid();
  if(!c.cid){ try{ c.cid=window.edCardCid(c); }catch(_){} }
}); }

/* No `range and arcane`: a fused orb fades the arcane circle in across a diamond's seam (HANDOFF §8), and a triangle's is not one. */
var ORB_TYPES=(window.REBIRTH
  ? ['attack','health','arcane','range','attack and arcane','health and arcane','blank','hidden']
  : ['attack','health','arcane','attack and arcane','health and arcane','blank','hidden']);
var ORB_TYPE_LABEL={'attack':'Attack','health':'Health','arcane':'Arcane','range':'Range','attack and arcane':'Attack + Arcane','health and arcane':'Health + Arcane','blank':'Blank','hidden':'Hidden'};
function ensureOrbs(c){
  if(Array.isArray(c.orbs)){ while(c.orbs.length<4)c.orbs.push({type:'hidden',value:''}); return c.orbs; }
  var o=[];
  o.push({type:(c.attack!==''&&c.attack!=null)?'attack':'hidden',value:(c.attack||'')});
  o.push({type:(c.health!==''&&c.health!=null)?'health':'hidden',value:(c.health||'')});
  o.push({type:(c.arcane!==''&&c.arcane!=null)?'arcane':'hidden',value:(c.arcane||'')});
  o.push({type:'hidden',value:''});
  c.orbs=o; return o;
}
function orbBoxClass(type){
  if(type==='attack and arcane')return 'ed2-nf-atkarc';
  if(type==='health and arcane')return 'ed2-nf-hparc';
  if(type==='attack')return 'ed2-nf-atk';
  if(type==='health')return 'ed2-nf-hp';
  if(type==='arcane')return 'ed2-nf-arc';
  return 'ed2-nf-blank';
}
function orbPreviewHTML(o){
  var t=o.type,v=o.value;
  if(t==='blank'||t==='hidden')return "<span class='ed2-orb-pv ed2-orb-pv-none'></span>";
  return "<span class='ed2-orb-pv'><svg viewBox='0 0 38 38' width='38' height='38'>"
    +orbShapeByType(t,v==null?'':v)+"</svg></span>";
}
function orbEditorRows(c){
  var orbs=ensureOrbs(c);
  var html='';
  for(var i=0;i<4;i++){
    var o=orbs[i]||{type:'hidden',value:''};
    var opts=ORB_TYPES.map(function(t){return "<option value='"+t+"'"+(t===o.type?' selected':'')+">"+ORB_TYPE_LABEL[t]+"</option>";}).join('');
    var isBlank=(o.type==='blank'||o.type==='hidden');
    var isStar=(String(o.value).trim()==='*');
    html+="<div class='ed2-nf ed2-orb "+orbBoxClass(o.type)+"' id='f-orb-box-"+i+"'>"
      +orbPreviewHTML(o)
      +"<div class='ed2-orb-fields'>"
      +"<select class='ed2-orb-type' id='f-orb-type-"+i+"' aria-label='Orb "+(i+1)+" type' onchange='edOrbType("+i+",this.value)'>"+opts+"</select>"
      +"<div class='ed2-orb-valrow'>"
        +"<input class='ed2-orb-val' id='f-orb-val-"+i+"' aria-label='Orb "+(i+1)+" value' value='"+e(o.value)+"' placeholder='\u2013'"+(isBlank||isStar?' disabled':'')+" oninput='edOrbVal("+i+",this.value)'>"
        +"<label class='ed2-orb-star' title='Set stat to * (centered)'><input type='checkbox' id='f-orb-star-"+i+"' aria-label='Orb "+(i+1)+": star (*) instead of a number'"+(isStar?' checked':'')+(isBlank?' disabled':'')+" onchange='edOrbStar("+i+",this.checked)'>*</label>"
      +"</div>"
      +"</div>"
    +"</div>";
  }
  return html;
}
window.edOrbStar=function(i,on){ var c=curCard(); if(!c)return; ensureOrbs(c);
  c.orbs[i].value = on ? '*' : '';
  syncLegacyStats(c); markDirty(c);
  var host=document.getElementById('f-orbs'); if(host)host.innerHTML=orbEditorRows(c);
  renderPreview(c);
};
window.edOrbType=function(i,val){ var c=curCard(); if(!c)return; ensureOrbs(c);
  c.orbs[i].type=val;
  if(val==='blank'||val==='hidden')c.orbs[i].value='';
  syncLegacyStats(c); recompute(c); markDirty(c);
  var host=document.getElementById('f-orbs'); if(host)host.innerHTML=orbEditorRows(c);
  renderPreview(c);
};
window.edOrbVal=function(i,val){ var c=curCard(); if(!c)return; ensureOrbs(c);
  c.orbs[i].value=val.trim(); syncLegacyStats(c); markDirty(c); renderPreview(c);
};
function syncLegacyStats(c){
  var o=c.orbs||[];
  function firstOf(bases){ for(var i=0;i<o.length;i++){ if(bases.indexOf(o[i].type)>=0 && o[i].value!=='')return o[i].value; } return ''; }
  /* Lossless: a fused orb is a suffix on the flat value ("4A" attack+arcane, "1H" health+arcane), which filters and exports read. */
  var SUFFIX={'attack and arcane':'A','health and arcane':'H'};
  function arcaneOf(){
    for(var i=0;i<o.length;i++){
      if(!o[i] || o[i].value==='') continue;
      var t=o[i].type;
      if(t!=='arcane' && !SUFFIX[t]) continue;
      var v=String(o[i].value), s=SUFFIX[t]||'';
      return (s && !/[AH]$/i.test(v)) ? v+s : v;
    }
    return '';
  }
  c.attack=firstOf(['attack','attack and arcane']);
  c.health=firstOf(['health','health and arcane']);
  c.arcane=arcaneOf();
  /* A flat field like the other three, as the filters, the sorts and the exports read these, not orbs[]. */
  c.range=firstOf(['range']);
}
/* A shared card keeps a version of a few fields per saga (SAGA_FIELDS, ed2_sagas.js); every call into that file is guarded,
   falling back to the card's own fields. */
function edFieldSource(c){
  try{
    if(typeof window.edEditingSaga==='function' && typeof window.edCardForSaga==='function')
      return window.edCardForSaga(c,window.edEditingSaga())||c;
  }catch(_){}
  return c;
}
function edCardSagas(c){
  try{
    if(typeof window.edSagaIdsOf==='function'){
      var ids=window.edSagaIdsOf(c);
      if(ids&&ids.length)return ids;
    }
  }catch(_){}
  var one=(c&&(c.sagaId||c.saga))||'';
  return one?[one]:[];
}
function edSagaNameMap(){
  var names={};
  try{
    if(typeof window.edSagas==='function')
      window.edSagas().forEach(function(s){ names[s.id]=s.name||s.id; });
  }catch(_){}
  return names;
}
function sagaDatalistHTML(){
  var names=[];
  try{ names=(typeof window.edSagas==='function'?window.edSagas():[])
        .map(function(s){ return s.name||s.id; }); }catch(_){}
  var seen={};
  return "<datalist id='ed2-sagalist'>"+names.filter(function(n){
      if(!n||seen[n])return false; seen[n]=1; return true; })
    .map(function(n){ return "<option value=\""+e(n)+"\"></option>"; }).join('')
  +"</datalist>";
}
/* Emptied first, so a slow store cannot let the same name be added twice. */
window.edSagaFieldAdd=function(){
  var el=document.getElementById('f-saga'); if(!el)return;
  var v=String(el.value||'').trim();
  el.value='';
  if(!v||typeof window.edAddCardSaga!=='function')return;
  return window.edAddCardSaga(v);
};
function sagaChipId(i){
  var c=curCard(); if(!c)return '';
  return edCardSagas(c)[i]||'';
}
window.edSagaChipPick=function(i){
  var id=sagaChipId(i);
  if(id&&typeof window.edEditSaga==='function')window.edEditSaga(id);
};
window.edSagaChipDrop=function(i){
  var id=sagaChipId(i);
  if(id&&typeof window.edRemoveCardSaga==='function')return window.edRemoveCardSaga(id);
};
function sagaBoxHTML(c){
  var ids=edCardSagas(c);
  if(!ids.length)return '';
  var names=edSagaNameMap();
  var cur=ids[0];
  try{ if(typeof window.edEditingSaga==='function')cur=window.edEditingSaga()||ids[0]; }catch(_){}
  var live=(typeof window.edEditSaga==='function');
  var canDrop=(typeof window.edRemoveCardSaga==='function');
  var open=function(id){ try{ return typeof window.edSagaOpenFor!=='function'||window.edSagaOpenFor(c,id); }catch(_){ return true; } };
  /* By index, not by id: a saga id can be typed text, and user text never goes into an inline onclick (HANDOFF §24.2). */
  var chips=ids.map(function(id,i){
    var lbl=names[id]||id, on=(id===cur?' on':'');
    /* a saga that comes from its source: its values and the card's place in it are that source's */
    if(!open(id))return "<span class='ed2-sagachip ed2-sagachip-src"+on+"' title='"+e(lbl)+" comes from its source'>"+e(lbl)+"</span>";
    /* Every chip can come off, the first too, as cid is the identity; only the last stays, its X saying why. */
    var last=(ids.length<2);
    var x=!canDrop ? ''
      : last
        ? "<button type='button' class='ed2-sagax off' disabled"
          +" title='A card has to be in at least one saga' aria-label='A card has to be in at least one saga'>\u00d7</button>"
        : "<button type='button' class='ed2-sagax' title='Take this card out of "+e(lbl)+"' aria-label='Take this card out of "+e(lbl)+"'"
          +" onclick='edSagaChipDrop("+i+")'>\u00d7</button>";
    return live
      ? "<span class='ed2-sagachip"+on+"'>"
          +"<button type='button' class='ed2-sagapick' onclick='edSagaChipPick("+i+")'>"+e(lbl)+"</button>"
          +x
        +"</span>"
      : "<span class='ed2-sagachip"+on+"'>"+e(lbl)+"</span>";
  }).join('');
  var note = (ids.length>1)
    ? " title='All copies of this card share Name, Type-Line, Mana Cost, Rules Text, Stats and "
      +"Revision #. Different versions of this card can have its Flavor Text, Art and Artist, and "
      +"Owner individually changed.'"
    : "";
  return "<div class='ed2-sagabox'>"
    +"<label"+note+">Sagas <span class='ed2-sagacount'>"+ids.length+"</span></label>"
    +"<div class='ed2-sagachips'>"+chips+"</div>"
  +"</div>";
}
/* Exported so the checks drive the editor's own form. */
window.edRenderFields=function(){ return renderFields(); };
function renderFields(){
  var host=document.getElementById('edFields'); if(!host)return;
  var c=curCard();
  if(!c){ edLinkedMask(false); host.innerHTML=
    "<div class='ed2-empty'><div class='ei'>&#9997;</div>"
    +"<p>Pick a card's <b>Edit</b> button in the catalog, or make a new one.</p>"
    +"<div style='display:flex;gap:8px'>"
    +"<button class='ed2-btn primary' onclick='edNewCard()'>"+uiIco('plus')+" New card</button>"
    +"</div></div>"; return; }
  /* `m` is the card as the selected saga prints it; on a card in one saga it is c. */
  var m=edFieldSource(c);
  var linked=[];
  try{ if(typeof window.edLinkedSagas==='function')linked=window.edLinkedSagas(c)||[]; }catch(_){}
  var linkNote='';
  if(linked.length){
    var lnm=edSagaNameMap(), lsid=linked[0];
    try{ if(typeof window.edEditingSaga==='function')lsid=window.edEditingSaga()||lsid; }catch(_){}
    var lname="<b>"+e(lnm[lsid]||lsid)+"</b>";
    linkNote="<div class='ed2-linked-note' role='note'>An official card in "+lname+". Its name, cost, rules, stats and "
      +"pictures follow the official card. "+lname+" sets its own flavor text, artist, Owner, watermark, border and "
      +"reminders, and which of the card's pictures it shows.</div>";
  }
  host.innerHTML=
    /* A plain .ed2-group, so it is as wide as the box under it without a fixed width. */
    "<div class='ed2-group ed2-btnbox'>"
    /* Fix and Delete card keep the right-hand corners, away from the hand; placement is .ed2-btngrid in ed2_style.css, and on
       a phone the ed2-bg- classes in mobile.css (HANDOFF §82). Import and Export stay on the app's top row. */
    +"<div class='ed2-btngrid'>"
      +"<button class='ed2-btn info ed2-bg-back' onclick='edCloseEditor()'>&larr; Back to catalog</button>"
      +(function(){ var on=(typeof window.edAutosaveOn==='function')?window.edAutosaveOn():true;
          return "<button class='ed2-btn ed2-bg-auto"+(on?' on':'')+"' id='edAutoBtn' aria-pressed='"+(on?'true':'false')+"'"
            +" title='Autosave: every change is stored by itself a moment after you make it. Turn it off to store only when you press Save.'"
            +" onclick='edToggleAutosave()'>Autosave</button>"; })()
      +"<button class='ed2-btn ed2-btn-pur ed2-bg-dup' onclick='edDuplicate()'>⧉ Duplicate</button>"
      +"<button class='ed2-btn ed2-btn-pur ed2-bg-kw' onclick=\"showTab('keywords')\">"+uiIco('tag')+" Keywords</button>"
      +"<button class='ed2-btn ed2-bg-fix' onclick='edOpenFix()'>⚙ Fix</button>"
      +"<div class='ed2-bg-pair'>"
        +"<button class='ed2-btn primary' id='edSaveBtn' onclick='edSave()'>Save</button>"
        +"<button class='ed2-btn primary' id='edSaveAllBtn' onclick='edSaveAll()'>Save All</button>"
        /* A badge on the pair, not in the button: the button clips what runs past it, and edFitGridSize measures what is inside it. */
        +"<span class='ed2-count' id='edSaveAllCount' aria-hidden='true' hidden></span>"
      +"</div>"
      +"<button class='ed2-btn primary ed2-bg-new' onclick='edNewCard()'>"+uiIco('plus')+" New card</button>"
      +"<button class='ed2-btn ed2-bg-test"+(c.testing?' on':'')+"' id='edTestBtn' aria-pressed='"+(c.testing?'true':'false')+"'"
        +" title='A Test card is left out of the published catalogue - people using the app never see it. It goes to testing.json, which only your copy reads.'"
        +" onclick='edToggleTesting()'>Test</button>"
      /* No card look toggles: Classic and Dark are the only look (edLockCardLook). */
      +"<button class='ed2-btn info ed2-bg-tpl' onclick='edOpenTplPage()'>▣ Templates</button>"
      /* edDeleteCard writes a tombstone: a card only taken out of CARDS comes back with the next boot merge. */
      +"<button class='ed2-btn warn ed2-bg-del' onclick='edDeleteCard(curIdNow())'>✕ Delete card</button>"
    +"</div>"
    +"</div>"
    +linkNote
    +"<div class='ed2-topsplit'><div class='ed2-topsplit-main'>"
    /* ed2-group-stats stays an inner wrapper: eight ed2_style.css selectors hang off it, and the orb slots need them to fit one row. */
    +"<div class='ed2-group ed2-g-id'>"
      +"<div class='ed2-mn-row'>"
        /* Sorted on blur, not on input: reordering between keystrokes makes a hybrid impossible to type. */
        /* The date keeps the id f-rev-date, which ed2_tools.js rewrites after a save. */
        +"<div class='ed2-field ed2-inl f-mana-wrap'><label for='f-mana'>Mana Cost</label><span class='ed2-cost-box'>"
          +"<input class='ed2-input' id='f-mana' value='"+e(c.manaCost)+"' oninput='edLive()' onblur='edSortMana(this)'>"
          +"<button type='button' class='ed2-costbtn' title='Cost symbols' aria-label='Cost symbols' aria-haspopup='dialog' "
          +"aria-expanded='false' onmousedown='edSymHold(event)' onclick='edOpenSymbols(this,1,event)'>&#9662;</button></span></div>"
        +"<div class='ed2-field ed2-inl f-name-wrap'><label for='f-name'>Name</label><input class='ed2-input' id='f-name' value='"+e(c.name)+"' oninput='edLive()' onfocus='edNameFocus()' onblur='edNameBlur()'>"
          +"<span class='ed2-rev-date' id='f-rev-date'>"+(c.lastUpdated?("· "+e(c.lastUpdated)):'')+"</span></div>"
      +"</div>"
      +"<div class='ed2-row2'>"
        +"<div class='ed2-field'>"
          +"<div class='ed2-inl'><label for='f-super-in'>Super-Type</label>"
          +"<div class='ed2-combo' id='f-super-combo'>"
            +"<input class='ed2-input' id='f-super-in' placeholder='Type to search…' autocomplete='off'>"
            +"<div class='ed2-combo-list hidden' id='f-super-list'></div></div>"
          +"<div class='ed2-tokrow' id='f-super-toks'></div></div></div>"
        +"<div class='ed2-field'>"
          +"<div class='ed2-inl'><label for='f-sub-in'>Sub-Type</label>"
          +"<div class='ed2-combo' id='f-sub-combo'>"
            +"<input class='ed2-input' id='f-sub-in' placeholder='Type to search…' autocomplete='off'>"
            +"<div class='ed2-combo-list hidden' id='f-sub-list'></div></div>"
          +"<div class='ed2-tokrow' id='f-sub-toks'></div></div></div>"
      +"</div>"
      +"<div class='ed2-group-stats'><div class='ed2-stats' id='f-orbs'>"
        +orbEditorRows(c)+"</div></div>"
    +"</div>"
    +"<div class='ed2-group ed2-g-rules'><div class='ed2-row3'>"
      +"<div class='ed2-rules-col'>"
        +rulesEditorHTML(c)
        +"<div class='ed2-field ed2-flavor-row'><label class='ed2-stack-lbl' for='f-flavor'>Flavor<br>Text</label>"
          +"<div class='ed2-textwrap'>"
            +"<div class='ed2-rows'><span title='Lines of flavor text on the card. Blank = automatic.'>lines</span>"
              +"<input class='ed2-rowsin' type='number' min='0' max='8' step='0.5' value='"+e(String(m.flavorRows||''))
              +"' placeholder='auto' oninput='edSetFlavorRows(this.value)'></div>"
            +"<textarea class='ed2-textarea ed2-flavor' id='f-flavor' oninput='edLive()'>"+e(m.flavor||'')+"</textarea>"
          +"</div></div>"
      +"</div>"
    +"</div></div>"
    /* The split closes after the rules and flavour, or align-items:stretch pads the left column out above Rule Text. */
    +"</div><div class='ed2-artcol'>"
      +"<div class='ed2-group ed2-art' id='edArtPanel'></div>"
      /* One block, so on a desktop the art editor can end mid rules box and this start there without pushing the credits down. */
      +"<div class='ed2-artrest'>"
      +holoSectionHTML(c)
      +"<div class='ed2-kwbar' id='f-kwbar'></div>"
      +"</div>"
    +"</div></div>"
/* Owner is c.designer. The Saga field adds a saga: c.saga is only a fallback that sagaIdOf reads on a card with no sagaId. */
    +"<div class='ed2-group ed2-g-meta'><div class='ed2-meta'>"
      +"<div class='ed2-field ed2-inl f-owner-wrap'><label for='f-designer'>Owner</label><input class='ed2-input' id='f-designer' value='"+e(m.designer||'')+"' oninput='edLive()'></div>"
      +"<div class='ed2-field ed2-inl f-saga-wrap'><label for='f-saga'>Saga</label><input class='ed2-input' id='f-saga'"
        +" list='ed2-sagalist' placeholder='type a saga to add\u2026'"
        +" title='Type a saga and press Enter to add this card to it. The chips below are every saga it is in.'"
        +" onkeydown='if(event.key===\"Enter\"){event.preventDefault();edSagaFieldAdd();}'"
        +" onchange='edSagaFieldAdd()'>"+sagaDatalistHTML()+"</div>"
      +"<div class='ed2-field ed2-inl f-rev-wrap'><label for='f-rev'>Revision #</label><input class='ed2-input' id='f-rev' value='"+e(m.revision||'')+"' oninput='edLive()'></div>"
      +"<div class='ed2-field ed2-inl f-artist-wrap'><label for='f-artist'>Artist</label><input class='ed2-input' id='f-artist' value='"+e(m.artist||'')+"' oninput='edLive()'></div>"
      +(window.REBIRTH ? rarityFieldHTML(c) : '')
    +"</div>"+sagaBoxHTML(c)+"</div>"
    +edRateCardHTML(c);
  renderTypeToks();
  setupCombo('super'); setupCombo('sub');
  /* after innerHTML, because #edArtPanel and #f-mark are created by it */
  try{ window.edRenderArtPanel(); }catch(_){}
  try{ refreshMarkPicker(); }catch(_){}
  try{ window.edRateCalc(); }catch(_){}
  try{ edFitBtnRows(); edWatchBtnBox(); }catch(_){}
  try{ window.edSyncSaveBtns(); }catch(_){}
  /* Quiet: this paints the preview, and a card only looked at must not queue to save (see markDirty). */
  if(typeof window.edLiveQuiet==='function') window.edLiveQuiet(edLive);
  else edLive();
  try{ window.edSyncSaveBtns(); }catch(_){}
  edLinkedMask(linked.length>0);
}
/* An official card in a saga of yours (edLinkedSagas): every control but that saga's own values is inert. An observer keeps it so, as the
   art panel, the keyword bar and the colour row draw themselves again; it is set up the first time such a card opens. */
var ED_LINKED_OPEN='.ed2-bg-back,#edAutoBtn,.ed2-bg-dup,.ed2-bg-kw,.ed2-bg-pair,.ed2-bg-new,.ed2-flavor-row,'
  +'#edArtPanel>.ed2-var-row:first-child>select,.ed2-hlbox,#edOvrRow,#f-kwbar,.f-owner-wrap,.f-artist-wrap,.ed2-sagabox';
var _edLinkedOn=false, _edLinkedMO=null;
function edLinkedMask(on){
  var host=document.getElementById('edFields'); if(!host)return;
  if(on!==undefined)_edLinkedOn=!!on;
  host.classList.toggle('ed2-linked',_edLinkedOn);
  if(!_edLinkedOn){
    host.querySelectorAll('[data-linked-shut]').forEach(function(el){ el.removeAttribute('inert'); el.removeAttribute('data-linked-shut'); });
    return;
  }
  if(!_edLinkedMO&&typeof MutationObserver==='function'){
    /* attributes are not watched, so the inert written here does not call this again */
    _edLinkedMO=new MutationObserver(function(){ if(_edLinkedOn)edLinkedMask(); });
    _edLinkedMO.observe(host,{childList:true,subtree:true});
  }
  host.querySelectorAll('input,select,textarea,button,[contenteditable],#edArtStage,.ed2-combo').forEach(function(el){
    if(el.closest(ED_LINKED_OPEN)||el.hasAttribute('inert'))return;
    el.setAttribute('inert',''); el.setAttribute('data-linked-shut','1');
  });
}

/* The rows may not wrap or clip, so the type shrinks, worked out from the real labels rather than a fixed size; rects are
   divided by the recovered scale first (HANDOFF §39), and overflow:hidden makes a wrong sum clip, not wrap. */
/* Cinzel's 12.48 and 8.6 scaled by .51 / .43, as the toolbar has no font-size-adjust (ed2_style.css says why). */
var ED_BTN_FS_MAX = 14.8, ED_BTN_FS_MIN = 10.2;
/* Worked out in one read, never searched: in Chromium a font-size written on the grid reaches its buttons only a frame
   later, so a search, or a second pass to check it, reads stale widths and walks to the floor. */
function edFitGridSize(grid){
  /* The buttons, not the cells: one cell holds Save and Save All. */
  var kids = grid ? grid.querySelectorAll('.ed2-btn') : null, n = kids ? kids.length : 0;
  if(!n) return ED_BTN_FS_MAX;
  /* Read off a button, not the grid: the grid's own style reads back at once and its buttons' a frame later, so the factor would compound. */
  var cur = parseFloat(getComputedStyle(kids[0]).fontSize) || ED_BTN_FS_MAX;
  var scale = (grid.offsetWidth > 0)
    ? (grid.getBoundingClientRect().width / grid.offsetWidth) : 1;
  if(!(scale > 0)) scale = 1;
  var f = Infinity;
  for(var i = 0; i < n; i++){
    var b = kids[i], k = getComputedStyle(b);
    var pad = (parseFloat(k.paddingLeft) || 0) + (parseFloat(k.paddingRight) || 0);
    var rg = document.createRange();
    rg.selectNodeContents(b);
    /* No label may change with what is waiting (hence the badge): nothing fits again on a label change, only on a width change. */
    var tw = rg.getBoundingClientRect().width / scale;
    if(!(tw > 0)) continue;
    f = Math.min(f, (b.clientWidth - 1) / (tw + pad));
  }
  if(!isFinite(f)) return ED_BTN_FS_MAX;
  return Math.max(ED_BTN_FS_MIN, Math.min(ED_BTN_FS_MAX, cur * f));
}
var _edBtnFitW = -1;
function edFitBtnRows(){
  var grid = document.querySelector('.ed2-btnbox .ed2-btngrid');
  if(!grid) return;
  /* A hidden pane has no width, and a fit into none returns the floor; the observer runs this again once it has one. */
  if(grid.clientWidth < 40) return;
  grid.style.fontSize = edFitGridSize(grid).toFixed(2) + 'px';
  _edBtnFitW = grid.clientWidth;
}
window.edFitBtnRows = edFitBtnRows;
/* Width only: fitting changes the row's height, so an observer that fitted again on any change would fit on its own output. */
var _edBtnRO = null;
function edWatchBtnBox(){
  var box = document.querySelector('.ed2-btnbox');
  if(!box || typeof ResizeObserver !== 'function') return;
  if(!_edBtnRO) _edBtnRO = new ResizeObserver(function(){
    var rows = document.querySelectorAll('.ed2-btnbox .ed2-btngrid');
    if(!rows.length || rows[0].clientWidth === _edBtnFitW) return;
    try{ edFitBtnRows(); }catch(_){}
  });
  /* Pointed at the new box: the form is rebuilt on every card change, and the box watched went with the old markup. */
  _edBtnRO.disconnect();
  _edBtnFitW = -1;
  _edBtnRO.observe(box);
}
addEventListener('resize', function(){ _edBtnFitW = -1;
  try{ edFitBtnRows(); }catch(_){} });

function rarityFieldHTML(c){
  var cur=(c && c.rarity) || '';
  var opts="<option value=''"+(cur?'':' selected')+">None</option>"
    +RARITIES.map(function(r){
      return "<option value='"+e(r.id)+"'"+(cur===r.id?' selected':'')+">"
        +e(r.label)+"</option>";
    }).join('');
  return "<div class='ed2-field ed2-inl ed2-field-rar'><label for='f-rarity'>Rarity</label>"
    +"<select class='ed2-input' id='f-rarity' onchange='edSetRarity(this.value)'>"
    +opts+"</select></div>";
}
window.edSetRarity=function(v){
  var c=curCard(); if(!c)return;
  var r=rarityDef(v);
  if(r) c.rarity=r.id; else delete c.rarity;
  markDirty(c); renderPreview(c);
  try{ scheduleFace(); }catch(_){}
};

/* Text that is not already a type gets a "+ Add" row, which Enter takes, so "War" can be added beside "Warrior" (HANDOFF §56.2). */
function setupCombo(which){
  var input=document.getElementById('f-'+which+'-in');
  var list=document.getElementById('f-'+which+'-list');
  if(!input||!list)return;
  var active=-1, opts=[], addVal='';
  function options(){ var V=buildVocab(); var all=(which==='super'?V.sup:V.sub);
    var c=curCard(); var have=(c?(which==='super'?c.superTypes:c.subTypes):[])||[];
    return all.filter(function(o){return have.indexOf(o)<0;}); }
  function known(v){ var V=buildVocab(), lv=v.toLowerCase(), c=curCard();
    var have=(c?(which==='super'?c.superTypes:c.subTypes):[])||[];
    return (which==='super'?V.sup:V.sub).concat(have).some(function(o){return String(o).toLowerCase()===lv;}); }
  function render(filter){
    opts=options(); var raw=(filter||'').trim(), f=raw.toLowerCase();
    var show=f?opts.filter(function(o){return o.toLowerCase().indexOf(f)>=0;}):opts;
    if(f)show.sort(function(a,b){var as=a.toLowerCase().indexOf(f)===0?0:1,bs=b.toLowerCase().indexOf(f)===0?0:1;return as-bs||a.localeCompare(b);});
    active=-1;
    addVal=(raw&&!known(raw))?raw:'';
    if(!show.length&&!addVal){ list.innerHTML="<div class='ed2-combo-empty'>No matches"+(f?" for \u201c"+e(f)+"\u201d":"")+"</div>"; list.classList.remove('hidden'); return; }
    list.innerHTML=(addVal?"<div class='ed2-combo-opt ed2-combo-add' data-v='"+e(addVal)+"'>+ Add \u201c"+e(addVal)+"\u201d</div>":"")
      +show.slice(0,60).map(function(o,i){return "<div class='ed2-combo-opt' data-v='"+e(o)+"' data-i='"+i+"'>"+e(o)+"</div>";}).join('');
    list.classList.remove('hidden');
    Array.prototype.forEach.call(list.querySelectorAll('.ed2-combo-opt'),function(el){
      el.addEventListener('mousedown',function(ev){ ev.preventDefault(); pick(el.getAttribute('data-v')); });
    });
  }
  function pick(val){ if(!val)return; edAddType(which,val); input.value=''; render(''); input.focus(); }
  input.addEventListener('focus',function(){ render(input.value); });
  input.addEventListener('input',function(){ render(input.value); });
  input.addEventListener('blur',function(){ setTimeout(function(){ list.classList.add('hidden'); },150); });
  input.addEventListener('keydown',function(ev){
    var items=list.querySelectorAll('.ed2-combo-opt'); if(!items.length&&ev.key!=='Enter')return;
    if(ev.key==='ArrowDown'){ ev.preventDefault(); active=Math.min(active+1,items.length-1); hi(items); }
    else if(ev.key==='ArrowUp'){ ev.preventDefault(); active=Math.max(active-1,0); hi(items); }
    else if(ev.key==='Enter'){ ev.preventDefault();
      if(active>=0&&items[active]) pick(items[active].getAttribute('data-v'));
      else {
        var v=input.value.trim(); if(!v)return;
        var exact=opts.find(function(o){return o.toLowerCase()===v.toLowerCase();});
        if(exact)pick(exact); else if(addVal)pick(addVal);
        else if(known(v)){ input.value=''; render(''); } // already on the card - never swap it for a near miss
        else if(items[0])pick(items[0].getAttribute('data-v')); else pick(v);
      }
    } else if(ev.key==='Escape'){ list.classList.add('hidden'); }
  });
  function hi(items){ Array.prototype.forEach.call(items,function(el,i){ el.classList.toggle('active',i===active); if(i===active)el.scrollIntoView({block:'nearest'}); }); }
}
/* Order matters: the Templates page matches a card by its first sub-type. The type goes in a data attribute, never the
   onclick, as one apostrophe would break out of an inline handler (HANDOFF §24.2). */
function typeTokHTML(which,t,i){
  return "<span class='ed2-tok ed2-tok-drag' data-which='"+e(which)+"'"
    +" data-i='"+i+"' data-t='"+e(t)+"' title='Drag to reorder'>"+e(t)
    +"<button onclick='edRemType(\""+e(which)+"\","+i+")' title='remove' aria-label='Remove "+e(t)+"'>&times;</button></span>";
}
function renderTypeToks(){
  var c=curCard(); if(!c)return;
  var sup=document.getElementById('f-super-toks'), sub=document.getElementById('f-sub-toks');
  var none="<span class='ed2-hint' style='margin:0'>none</span>";
  if(sup){
    sup.innerHTML=(c.superTypes||[]).map(function(t,i){return typeTokHTML('super',t,i);}).join('')||none;
    edBindTypeDrag(sup);
  }
  if(sub){
    sub.innerHTML=(c.subTypes||[]).map(function(t,i){return typeTokHTML('sub',t,i);}).join('')||none;
    edBindTypeDrag(sub);
  }
}

/* The chips are moved, not re-rendered, mid-drag (that would destroy the captured element); bound to the row, which survives. */
function edBindTypeDrag(row){
  if(!row || row._tokDragBound) return;
  row._tokDragBound = true;
  var drag = null;
  row.addEventListener('pointerdown', function(ev){
    var tok = ev.target && ev.target.closest && ev.target.closest('.ed2-tok-drag');
    if(!tok) return;
    if(ev.target.tagName === 'BUTTON') return;
    drag = tok;
    tok.classList.add('dragging');
    try{ tok.setPointerCapture(ev.pointerId); }catch(_){}
    ev.preventDefault();
  });
  row.addEventListener('pointermove', function(ev){
    if(!drag) return;
    var rest = [].slice.call(row.querySelectorAll('.ed2-tok-drag:not(.dragging)'));
    var before = null;
    for(var i = 0; i < rest.length; i++){
      var r = rest[i].getBoundingClientRect();
      if(ev.clientX < r.left + r.width / 2){ before = rest[i]; break; }
    }
    if(before) row.insertBefore(drag, before); else row.appendChild(drag);
  });
  var end = function(){
    if(!drag) return;
    drag.classList.remove('dragging');
    var which = drag.getAttribute('data-which');
    drag = null;
    edCommitTypeOrder(which, row);
  };
  row.addEventListener('pointerup', end);
  row.addEventListener('pointercancel', end);
}
/* Exported so a check can drive the same commit the drag does. */
window.edCommitTypeOrder=function(which,row){
  var c=curCard(); if(!c)return false;
  row = row || document.getElementById('f-'+which+'-toks');
  if(!row) return false;
  var order=[].slice.call(row.querySelectorAll('.ed2-tok-drag'))
    .map(function(el){ return el.getAttribute('data-t'); })
    .filter(function(t){ return !!t; });
  var arr=(which==='super') ? (c.superTypes||[]) : (c.subTypes||[]);
  /* Only the same set, reordered: if the row and the card disagree, the card is trusted. */
  if(order.length !== arr.length) return false;
  /* Built, never typed: a raw control character in a source file is what HANDOFF §0 warns about. */
  var SEP=String.fromCharCode(1);
  var key=function(a){ return a.slice().sort().join(SEP); };
  if(key(order) !== key(arr)) return false;
  if(order.join(SEP) === arr.join(SEP)) return false;
  if(which==='super') c.superTypes=order; else c.subTypes=order;
  recompute(c); renderTypeToks(); renderPreview(c); markDirty(c);
  try{ scheduleFace(); }catch(_){}
  return true;
};
window.edAddType=function(which,val){ var c=curCard(); if(!c||!val)return;
  var arr=which==='super'?c.superTypes:c.subTypes; if(!arr)arr=[];
  if(arr.indexOf(val)<0)arr.push(val);
  if(which==='super')c.superTypes=arr; else c.subTypes=arr;
  recompute(c); renderTypeToks(); renderPreview(c); markDirty(c); };
window.edRemType=function(which,i){ var c=curCard(); if(!c)return;
  var arr=which==='super'?c.superTypes:c.subTypes; arr.splice(i,1);
  recompute(c); renderTypeToks(); renderPreview(c); markDirty(c); };

function kwMatchesList(){ try{ return window.KW_MATCHES||window.KW_DATA||[]; }catch(_){ return []; } }
/* kwReminders holds names only, per saga version, so editing a keyword's reminder updates every card that shows it. */
function kwRemindersOf(c){ return Array.isArray(c&&c.kwReminders)?c.kwReminders:[]; }
function cardReminders(c){
  var on=kwRemindersOf(c); if(!on.length)return [];
  /* Detected again for the written value: "Gouge 2" gets its {value} reminder with 2 put in. */
  var hits={}; detectKeywords(c.ruleText||'').forEach(function(k){
    hits[k.name]={m:k.__matched||k.name, mode:k.mode||'keyword'}; });
  return on.map(function(name){
    var h=hits[name]||{};
    var r=kwReminderFor(name,h.m||name,h.mode);
    return r?{name:name,text:'('+r+')'}:null;
  }).filter(Boolean);
}

function detectKeywords(txt){
  if(!txt)return []; var found=[],seen={};
  kwMatchesList().forEach(function(k){
    if(!k||!k.match)return;
    /* A Damage Type has no reminder to offer. */
    if(k.mode==='damage')return;
    var pat=k.match.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
    /* The trailing value is captured as pillifyRules does it, so kwReminderFor can fill {value}; these are strings for RegExp, so escapes are doubled. */
    var takes=(k.param===undefined)||(k.param&&k.param!=='none');
    var tail=takes?'(?:\\s+(?:\\d+|X))?':'';
    var re; try{ re=new RegExp('(?<![\\w-])('+pat+tail+')(?![\\w-])','i'); }
    catch(_){ re=new RegExp('\\b'+pat+tail+'\\b','i'); }
    var m=re.exec(txt);
    if(m && !seen[k.name]){ seen[k.name]=1; found.push(Object.assign({},k,{__matched:m[1]})); }
  });
  return found;
}
function renderKwBar(){
  var c=curCard(); var bar=document.getElementById('f-kwbar'); if(!bar)return;
  if(!c){ bar.innerHTML=''; return; }
  var kws=detectKeywords(c.ruleText||'');
  if(!kws.length){ bar.innerHTML="<div class='ed2-kwbar-title'>Keyword Reminders</div><div class='ed2-kwbar-empty'>No keywords detected in the rule text.</div>"; return; }
  bar.innerHTML="<div class='ed2-kwbar-title'>Toggle reminder text for these terms.</div>"
    +"<div class='ed2-kwbtns'>"+kws.map(function(k){
      var on=(kwRemindersOf(edFieldSource(c)).indexOf(k.name)>=0)?' on':'';
      var label=(k.mode==='keyword'&&PILLS_ON)?kwPill(k.name,e(k.name)):e(k.name);
      return "<button class='ed2-kwbtn"+on+(k.mode==='keyword'?' ed2-kwbtn-pill':'')
        /* The name as data, so the handler is the same text on every button. */
        +"' data-kw='"+e(k.name)+"' onclick='edToggleKw(this.dataset.kw)' title='"
        +e(kwReminderFor(k.name,k.__matched,k.mode||'keyword'))+"'>"+label+"</button>";
    }).join('')+"</div>";
}
/* Halves are allowed (parseFloat: parseInt made 0.5 automatic); marked dirty here, as the saga write point marks nothing. */
window.edSetFlavorRows=function(v){
  var c=curCard(); if(!c)return;
  var n=parseFloat(v); if(isNaN(n)||n<0)n=0;
  /* Per saga, as the flavour it counts is; c.flavorRows directly if the saga write point is missing or refuses. */
  var done=false;
  try{
    if(typeof window.edSetSagaField==='function' && typeof window.edEditingSaga==='function')
      done=!!window.edSetSagaField(c,window.edEditingSaga(),'flavorRows',n||'');
  }catch(_){}
  if(!done)c.flavorRows=n||'';
  markDirty(c);
  renderPreview(c);
};
window.edRefreshOrbPreviews=function(){
  var c=curCard(); if(!c)return;
  var orbs=ensureOrbs(c);
  for(var i=0;i<4;i++){
    var box=document.getElementById('f-orb-box-'+i); if(!box)continue;
    var pv=box.querySelector('.ed2-orb-pv');
    var tmp=document.createElement('div');
    tmp.innerHTML=orbPreviewHTML(orbs[i]||{type:'hidden',value:''});
    if(pv)box.replaceChild(tmp.firstChild,pv);
  }
};
window.edToggleKw=function(name){
  var c=curCard(); if(!c)return;
  var on=kwRemindersOf(edFieldSource(c)).slice(), i=on.indexOf(name);
  if(i>=0)on.splice(i,1); else on.push(name);
  var done=false;
  try{
    if(typeof window.edSetSagaField==='function'&&typeof window.edEditingSaga==='function')
      done=!!window.edSetSagaField(c,window.edEditingSaga(),'kwReminders',on);
  }catch(_){}
  if(!done){ if(on.length)c.kwReminders=on; else delete c.kwReminders; }
  markDirty(c);
  renderKwBar(); renderPreview(c);
};

/* Classic and Dark are the only look, enforced: both old switches are cleared at boot so no profile keeps either.
   The body:not(.mse-template) prefixes in mcard_classic.css stay for their specificity (HANDOFF §8). */
function edLockCardLook(){
  document.body.classList.remove('mse-template');
  document.body.classList.remove('cards-light');
  setMetaSafe('layoutMode','classic');
  setMetaSafe('cardsLight',false);
}

window.edSetBleed=function(on){
  document.body.classList.toggle('bleed-on',!!on);
  setMetaSafe('bleedOn',!!on);
  try{ scheduleFace(); }catch(_){}
  var c=curCard(); if(c)renderPreview(c);
};

/* The 'tpl' store holds {key, dataUrl} for frame:all, frame:<colour>, frame:none, frame:multi, orb:<type> and sym:<TOKEN>;
   lookup runs specific to general, so frame:all alone skins the set. */
var TPL={};
var TPL_ORBS=['attack','health','arcane','attack and arcane','health and arcane'];

function tplAll(){return new Promise(function(res){try{var r=tx('tpl','readonly').getAll();
  r.onsuccess=function(){res(r.result||[])};r.onerror=function(){res([])};}catch(_){res([]);}});}
function tplSet(k,d){
  if(typeof k!=='string'||!tplOk(d))return Promise.resolve(false);
  TPL[k]=d;return put('tpl',{key:k,dataUrl:d});}
function tplDel(k){delete TPL[k];return del('tpl',k);}
window.edTplKeys=function(){return Object.keys(TPL);};
function tplHasAny(){for(var k in TPL){if(tplOk(TPL[k]))return true;}return false;}
function tplRasterize(d){
  return new Promise(function(res){
    if(typeof d!=='string'||!/^data:image\/[\w.+-]+[;,]/.test(d)){ res(null); return; }
    var im=new Image();
    im.onload=function(){
      try{
        var w=im.naturalWidth||1024, h=im.naturalHeight||1024;
        var k=Math.min(1,4096/Math.max(w,h));
        w=Math.max(1,Math.round(w*k)); h=Math.max(1,Math.round(h*k));
        var cv=document.createElement('canvas'); cv.width=w; cv.height=h;
        cv.getContext('2d').drawImage(im,0,0,w,h);
        var png=cv.toDataURL('image/png');
        res(tplOk(png)?png:null);
      }catch(_){ res(null); }
    };
    im.onerror=function(){ res(null); };
    im.src=d;
  });
}

function tplFrameFor(c){
  /* The frame image follows a colour override too, or a blue frame picture would sit behind the new colour. */
  var cols=frameColorsOf(c).filter(function(x){return FRAME_ORDER.indexOf(x)>=0;});
  if(cols.length===1 && tplGet('frame:'+cols[0])) return tplGet('frame:'+cols[0]);
  if(cols.length>1  && tplGet('frame:multi'))     return tplGet('frame:multi');
  if(!cols.length   && tplGet('frame:none'))      return tplGet('frame:none');
  return tplGet('frame:all');
}

/* --frame is set inline on .mcard, so the black and white edges in the CSS need !important to win. */
var EDGE_MODES=['gradient','black','white','none'];
/* pin null or undefined follows the outline, which is how a pack or backup from before pinlines is read. */
function edApplyEdge(mode,pin){
  if(EDGE_MODES.indexOf(mode)<0)mode='gradient';
  if(pin==null)pin=mode;
  if(EDGE_MODES.indexOf(pin)<0)pin='gradient';
  var cl=document.body.classList;
  EDGE_MODES.forEach(function(m){ cl.remove('edge-'+m); cl.remove('pin-'+m); });
  if(mode!=='gradient')cl.add('edge-'+mode);
  if(pin!=='gradient')cl.add('pin-'+pin);
}
function edEdgeMode(){
  for(var i=0;i<EDGE_MODES.length;i++){
    if(document.body.classList.contains('edge-'+EDGE_MODES[i]))return EDGE_MODES[i];
  }
  return 'gradient';
}
function edPinMode(){
  for(var i=0;i<EDGE_MODES.length;i++){
    if(document.body.classList.contains('pin-'+EDGE_MODES[i]))return EDGE_MODES[i];
  }
  return 'gradient';
}
window.edSetEdge=function(mode){
  edApplyEdge(mode,edPinMode());
  setMetaSafe('edgeMode',mode);
  try{ scheduleFace(); }catch(_){}
  var c=curCard(); if(c)renderPreview(c);
  edTplPanelRefresh();
};
/* Defaults per frame orientation in TPL_DEFAULTS (ed2_core.js), never body classes: effectiveFit() and effectiveArtXf()
   read them only for a card that has not chosen. contain is the default, as cover cut a mean 23% off the art. */
var FIT_MODES=['contain','cover','fill'];
var TPL_XF_LIMITS={z:{min:0.2,max:4,step:0.01},x:{min:-100,max:100,step:0.5},
                   y:{min:-100,max:100,step:0.5},r:{min:-180,max:180,step:1}};
function edApplyTplDefaults(raw){ TPL_DEFAULTS=tplNormDefaults(raw); }
/* edSetTplXf, edTplImport and applyPackBody write the store themselves; edSetTplXf must not rebuild the panel under a drag. */
function edSaveTplDefaults(){
  setMetaSafe('tplDefaults',JSON.parse(JSON.stringify(TPL_DEFAULTS)));
  try{ scheduleFace(); }catch(_){}
  var c=curCard(); if(c)renderPreview(c);
  edTplPanelRefresh();
}
window.edSetFit=function(orient,mode){
  if(FIT_MODES.indexOf(mode)<0)mode='contain';
  tplDefaults(orient).fit=mode;
  edSaveTplDefaults();
};
window.edSetTplXf=function(orient,field,val){
  var L=TPL_XF_LIMITS[field]; if(!L)return;
  var v=parseFloat(val); if(!isFinite(v))return;
  v=Math.max(L.min,Math.min(L.max,v));
  v=Math.round(v/L.step)*L.step;
  v=Math.round(v*1000)/1000;
  tplDefaults(orient).xf[field]=v;
  /* In step without rebuilding the panel: rebuilding it under a dragging thumb drops the drag. */
  var s=document.getElementById('tplXf-'+orient+'-'+field);
  var n=document.getElementById('tplXfN-'+orient+'-'+field);
  if(s&&parseFloat(s.value)!==v)s.value=v;
  if(n&&parseFloat(n.value)!==v)n.value=v;
  setMetaSafe('tplDefaults',JSON.parse(JSON.stringify(TPL_DEFAULTS)));
  try{ scheduleFace(); }catch(_){}
  var c=curCard(); if(c)renderPreview(c);
};
window.edFlipTplXf=function(orient){
  var x=tplDefaults(orient).xf;
  x.f=(x.f===-1?1:-1);
  edSaveTplDefaults();
};
window.edResetTplXf=function(orient){
  tplDefaults(orient).xf={z:1,x:0,y:0,r:0,f:1};
  edSaveTplDefaults();
};
/* On the variant, which owns only visual fields (HANDOFF §5): two looks of one card can fit differently. */
window.edSetCardFit=function(mode){
  var c=curCard(); if(!c)return;
  var vt=visualTarget(c);
  if(!mode||mode==='auto')delete vt.fit; else vt.fit=mode;
  markDirty(c); persistCard(c);
  renderPreview(c); try{ scheduleFace(); }catch(_){}
  try{ window.edRenderArtPanel(); }catch(_){}
};
window.edCardFit=function(c){ var v=variantOf(c||curCard()||{}); return (v&&v.fit)||''; };
window.edSetPin=function(mode){
  edApplyEdge(edEdgeMode(),mode);
  setMetaSafe('pinMode',mode);
  try{ scheduleFace(); }catch(_){}
  var c=curCard(); if(c)renderPreview(c);
  edTplPanelRefresh();
};

function fileToDataUrl(file){
  return new Promise(function(res,rej){
    var fr=new FileReader();
    fr.onload=function(){
      var d=fr.result, im=new Image();
      im.onload=function(){res({dataUrl:d,w:im.naturalWidth,h:im.naturalHeight});};
      im.onerror=function(){res({dataUrl:d,w:0,h:0});};
      im.src=d;
    };
    fr.onerror=function(){rej(fr.error);};
    fr.readAsDataURL(file);
  });
}

window.edTplUpload=function(key,input){
  var f=input&&input.files&&input.files[0]; if(!f||typeof key!=='string'||!key)return;
  fileToDataUrl(f).then(function(r){
    if(tplOk(r.dataUrl))return r;
    return tplRasterize(r.dataUrl).then(function(png){
      if(!png)throw new Error('that file is not a picture this page can use');
      return {dataUrl:png,w:r.w,h:r.h};
    });
  }).then(function(r){
    return put('tpl',{key:key,dataUrl:r.dataUrl,w:r.w,h:r.h}).then(function(){
      TPL[key]=r.dataUrl;
      setMetaSafe('customTemplate',tplHasAny());
      try{ scheduleFace(); }catch(_){}
      var c=curCard(); if(c)renderPreview(c);
      edTplPanelRefresh();
    });
  }).catch(function(e){ alert('Could not read that image: '+e); });
};

window.edTplRemove=function(key){
  tplDel(key).then(function(){
    setMetaSafe('customTemplate',tplHasAny());
    try{ scheduleFace(); }catch(_){}
    var c=curCard(); if(c)renderPreview(c);
    edTplPanelRefresh();
  });
};

window.edTplClearAll=function(){
  if(!confirm('Remove every uploaded template asset? This cannot be undone.'))return;
  var keys=Object.keys(TPL);
  Promise.all(keys.map(function(k){return tplDel(k);})).then(function(){
    TPL={};
    setMetaSafe('customTemplate',false);
    try{ scheduleFace(); }catch(_){}
    var c=curCard(); if(c)renderPreview(c);
    edTplPanelRefresh();
  });
};

window.edTplExport=function(){
  if(typeof JSZip!=='function'){alert('JSZip unavailable.');return;}
  var zip=new JSZip(), man={version:1, created:new Date().toISOString(), slots:{}};
  var n=0;
  Object.keys(TPL).forEach(function(k){
    var d=TPL[k]; if(!d)return;
    var m=/^data:([^;]+);base64,(.*)$/.exec(d); if(!m)return;
    var ext=(m[1].split('/')[1]||'png').replace('jpeg','jpg');
    var fn='assets/'+k.replace(/[^a-z0-9]+/gi,'_')+'.'+ext;
    zip.file(fn,m[2],{base64:true}); man.slots[k]=fn; n++;
  });
  man.edgeMode=edEdgeMode();
  man.pinMode=edPinMode();
  man.tplDefaults=JSON.parse(JSON.stringify(TPL_DEFAULTS));
  zip.file('manifest.json',JSON.stringify(man,null,2));
  zip.generateAsync({type:'blob'}).then(function(b){
    var a=document.createElement('a');
    a.href=URL.createObjectURL(b);
    a.download='conjure-template-pack.zip';
    document.body.appendChild(a); a.click();
    setTimeout(function(){URL.revokeObjectURL(a.href);a.remove();},2000);
  });
};

window.edTplImport=function(input){
  var f=input&&input.files&&input.files[0]; if(!f)return;
  if(typeof JSZip!=='function'){alert('JSZip unavailable.');return;}
  JSZip.loadAsync(f).then(function(zip){
    var mf=zip.file('manifest.json');
    if(!mf)throw new Error('no manifest.json - not a template pack');
    return mf.async('string').then(function(s){
      var man=JSON.parse(s), jobs=[];
      Object.keys(man.slots||{}).forEach(function(k){
        var ent=zip.file(man.slots[k]); if(!ent)return;
        jobs.push(ent.async('base64').then(function(b64){
          var ext=(man.slots[k].split('.').pop()||'png').toLowerCase();
          var mime=ext==='jpg'||ext==='jpeg'?'image/jpeg':ext==='webp'?'image/webp':'image/png';
          return tplSet(k,'data:'+mime+';base64,'+b64);
        }));
      });
      return Promise.all(jobs).then(function(){
        if(man.edgeMode)window.edSetEdge(man.edgeMode);
        if(man.tplDefaults){
          edApplyTplDefaults(man.tplDefaults);
          setMetaSafe('tplDefaults',JSON.parse(JSON.stringify(TPL_DEFAULTS)));
        }
        setMetaSafe('customTemplate',tplHasAny());
        try{ scheduleFace(); }catch(_){}
        var c=curCard(); if(c)renderPreview(c);
        edTplPanelRefresh();
        alert('Imported '+Object.keys(man.slots||{}).length+' template asset(s).');
      });
    });
  }).catch(function(e){ alert('Import failed: '+e.message); });
};

/* Assets are data: URLs, not Blobs as card art is: a few dozen of them, and a pack goes into the .zip as it is. */
var PACKS=[];
function packsAll(){return new Promise(function(res){try{var r=tx('packs','readonly').getAll();
  r.onsuccess=function(){res(r.result||[])};r.onerror=function(){res([])};}catch(_){res([]);}});}
function packsRefresh(){return packsAll().then(function(p){PACKS=p;return p;});}
window.edPacks=function(){return PACKS.map(function(p){
  return {name:p.name,slots:Object.keys(p.slots||{}),edgeMode:p.edgeMode,layout:p.layout,bleed:!!p.bleed};});};

function currentPackBody(){
  return {slots:Object.assign({},TPL),
    edgeMode:edEdgeMode(), pinMode:edPinMode(),
    tplDefaults:JSON.parse(JSON.stringify(TPL_DEFAULTS)),
    bleed:document.body.classList.contains('bleed-on'),
    /* The whole list and the base, not just the four built-in keys, or a pack drops every row its sender added. */
    align:ALIGN_RULES.map(alignClone),
    alignBase:{h:ALIGN_BASE.h,v:ALIGN_BASE.v},
    kwStyles:JSON.parse(JSON.stringify(KWSTYLE)), pillsOn:PILLS_ON,
    kwCustom:JSON.parse(JSON.stringify(KWCUSTOM)),
    /* the frame, stat icon set and card back (ed2_frames.js): published with the look, so a fresh visitor starts with them */
    cardLook:frLookBody()};
}
/* A pack plus the display settings that are no part of a pack but must survive a backup (kwHover). */
function currentSettingsBody(){
  return Object.assign(currentPackBody(),{kwHover:KW_HOVER});
}
window.edPackSave=function(){
  var nm=prompt('Save current templates as:','My template');
  if(!nm)return; nm=nm.trim(); if(!nm)return;
  if(PACKS.some(function(p){return p.name===nm;}) && !confirm('"'+nm+'" exists. Overwrite?'))return;
  var rec=Object.assign({name:nm,saved:new Date().toISOString()},currentPackBody());
  put('packs',rec).then(packsRefresh).then(function(){ toast('Saved "'+nm+'"'); edTplPanelRefresh(); })
    .catch(function(e){ alert('Could not save pack: '+(e&&e.message||e)); });
};
/* Shared by pack apply and restore, so a backup restores exactly what a pack applies (HANDOFF §7.5). All or nothing: one
   transaction over tpl, meta and kwcustom, and nothing on screen changes until it commits; the promise rejects if it does not. */
function applyPackBody(pk){
  pk=(pk&&typeof pk==='object')?pk:{};
  var slots={};
  Object.keys(pk.slots||{}).forEach(function(k){ if(tplOk(pk.slots[k]))slots[k]=pk.slots[k]; });
  var nAlign=null, nBase=null;
  if(pk.align&&pk.align.length){ nAlign=alignLoad(pk.align); nBase=alignBaseLoad(pk.alignBase); }
  /* An older pack's single fitMode becomes both sets; older still, contain. */
  var nDefaults=tplNormDefaults(pk.tplDefaults?pk.tplDefaults
    :{h:{fit:pk.fitMode||'contain'},v:{fit:pk.fitMode||'contain'}});
  var nKw=(pk.kwStyles&&typeof pk.kwStyles==='object')?kwStylesClean(pk.kwStyles):null;
  /* No pinMode in a pack from before pinlines: the pinlines follow the outline, as they did. */
  var edge=(EDGE_MODES.indexOf(pk.edgeMode)>=0)?pk.edgeMode:'gradient';
  var pin=(pk.pinMode==null)?edge:((EDGE_MODES.indexOf(pk.pinMode)>=0)?pk.pinMode:'gradient');
  /* Entries the pack lacks are deleted from the store too, as boot reads the store, which is never cleared whole. ghApplyDefaultLook
     runs this after a sync and hands in the player's own entries beside the official ones (ghLookKwBody), so only official ones leave. */
  var nCustom=Array.isArray(pk.kwCustom)
    ?pk.kwCustom.filter(function(x){ return x&&typeof x==='object'&&x.id!=null&&x.id!==''; }):null;
  var gone=[];
  if(nCustom){
    var keep={}; nCustom.forEach(function(x){ keep[x.id]=1; });
    gone=(KWCUSTOM||[]).filter(function(x){ return x&&x.id&&!keep[x.id]; });
  }
  var oldKeys=Object.keys(TPL);
  return new Promise(function(res,rej){
    var t;
    try{ t=_db.transaction(['tpl','meta','kwcustom'],'readwrite'); }
    catch(err){ rej(err); return; }
    var T=t.objectStore('tpl'), M=t.objectStore('meta'), K=t.objectStore('kwcustom');
    var meta=function(k,v){ M.put({k:k,v:v}); };
    try{
      oldKeys.forEach(function(k){ if(!Object.prototype.hasOwnProperty.call(slots,k))T.delete(k); });
      Object.keys(slots).forEach(function(k){ T.put({key:k,dataUrl:slots[k]}); });
      if(nAlign){ meta('alignRules',nAlign.map(alignClone)); meta('alignBase',{h:nBase.h,v:nBase.v}); }
      meta('tplDefaults',JSON.parse(JSON.stringify(nDefaults)));
      meta('layoutMode','classic'); meta('cardsLight',false);
      meta('bleedOn',!!pk.bleed);
      if(nKw)meta('kwStyles',nKw);
      if(pk.pillsOn!=null)meta('pillsOn',!!pk.pillsOn);
      if(pk.kwHover!=null)meta('kwHover',!!pk.kwHover);
      meta('edgeMode',edge); meta('pinMode',pin);
      meta('customTemplate',Object.keys(slots).length>0);
      if(pk.cardLook&&typeof pk.cardLook==='object')meta('cardLook',frLookClean(pk.cardLook));
      if(nCustom){
        gone.forEach(function(x){ K.delete(x.id); });
        nCustom.forEach(function(x){ K.put(x); });
      }
    }catch(err){ try{ t.abort(); }catch(_){} rej(err); return; }
    t.oncomplete=function(){ res(); };
    t.onabort=function(){ rej(t.error||new Error('the template was not stored, so nothing was changed')); };
  }).then(function(){
    TPL=slots;
    if(nAlign){ ALIGN_RULES=nAlign; ALIGN_BASE=nBase; }
    TPL_DEFAULTS=nDefaults;
    document.body.classList.remove('mse-template');
    document.body.classList.remove('cards-light');
    document.body.classList.toggle('bleed-on',!!pk.bleed);
    if(nKw)KWSTYLE=nKw;
    if(pk.pillsOn!=null)PILLS_ON=!!pk.pillsOn;
    if(pk.kwHover!=null)KW_HOVER=!!pk.kwHover;
    edApplyEdge(edge,pin);
    if(nCustom){ KWCUSTOM=nCustom; edApplyCustomEntries(); }
    if(pk.cardLook&&typeof pk.cardLook==='object'){ window.edApplyLook(pk.cardLook,false); window.edLookSaved(true); }
    try{ scheduleFace(); }catch(_){}
    var c=curCard(); if(c)renderPreview(c);
    edTplPanelRefresh();
  });
}
window.edPackApply=function(nm){
  var pk=PACKS.filter(function(p){return p.name===nm;})[0]; if(!pk)return Promise.resolve(false);
  return applyPackBody(pk).then(function(){ toast('Applied "'+nm+'"'); return true; },
    function(err){
      alert('"'+nm+'" could not be applied ('+((err&&(err.name||err.message))||'unknown error')
        +'). Nothing was changed - the templates in use are the ones you had.');
      return false;
    });
};
window.edPackDelete=function(nm){
  if(!confirm('Delete saved template "'+nm+'"?'))return;
  del('packs',nm).then(packsRefresh).then(function(){ edTplPanelRefresh(); toast('Deleted "'+nm+'"'); },
    function(err){ alert('Could not delete "'+nm+'": '+((err&&(err.name||err.message))||err)); });
};

/* The slot key is typed or imported text, so it rides in data-tplkey for edTplPanelBind (ed2_tools.js), never in a handler. */
function tplSlotHTML(key,label,note){
  var img=tplGet(key), has=!!TPL[key];
  return "<div class='tpl-slot"+(has?' has':'')+"'>"
    +"<div class='tpl-thumb'>"+(img?"<img src='"+e(img)+"' alt=''>":"<span>empty</span>")+"</div>"
    +"<div class='tpl-meta'><b>"+e(label)+"</b>"+(note?"<i>"+e(note)+"</i>":"")+"</div>"
    +"<div class='tpl-acts'>"
      +"<label class='ed2-btn tiny'>Upload<input type='file' accept='image/*' hidden "
        +"data-tplup='"+e(key)+"' aria-label='Upload "+e(label)+"'></label>"
      +(has?"<button class='ed2-btn tiny warn' data-tplrm='"+e(key)+"'>Remove</button>":"")
    +"</div></div>";
}

/* Bleed is a 0.12in band round the 2.5x3.5in card, filled with its frame (printBleedBg), never a bigger card. The print
   stylesheet is keyed to body.ed-printing, set only while these print, so Ctrl+P elsewhere prints the page. */
function printBleedBg(c){
  var t=tplFrameFor(c);
  return (t?(cssUrl(t)+" center/100% 100% no-repeat,"):'')+frameOf(frameColorsOf(c));
}
window.edPrintCards=function(list){
  if(!list||!list.length){ alert('No cards to print.'); return; }
  var old=document.getElementById('edPrintRoot'); if(old)old.remove();
  var bleed=document.body.classList.contains('bleed-on');
  var B=bleed?0.12:0, W=2.5+2*B, H=3.5+2*B;
  var scale=(2.5*96)/340;                     // 96 CSS px per inch
  var root=document.createElement('div'); root.id='edPrintRoot';
  root.innerHTML=list.map(function(c){
    return "<div class='pr-card' style='width:"+W+"in;height:"+H+"in"
        +(B?(";background:"+e(printBleedBg(c))):'')+"'>"
      +"<div class='pr-scale' style='"+(B?('margin:'+B+'in;'):'')+"transform:scale("+scale+")'>"
      +buildFaceHTML(c,{})+"</div></div>";
  }).join('');
  document.body.appendChild(root);
  document.body.classList.add('ed-printing');
  try{ fitFace(root); }catch(_){}
  var done=function(){ var r=document.getElementById('edPrintRoot'); if(r)r.remove();
    document.body.classList.remove('ed-printing');
    window.removeEventListener('afterprint',done); };
  window.addEventListener('afterprint',done);

  /* Art is shrunk to print size first, once per picture: full-size art is 26 MB of bitmap a card, and print preview never
     finishes. A picture whose pixels cannot be read (file:// with no art folder) keeps its URL. */
  var jobs={}, imgs=root.querySelectorAll('.m-art-img'), pending=0, fired=false;
  var go=function(){ if(fired)return; fired=true; setTimeout(function(){ window.print(); },250); };
  Array.prototype.forEach.call(imgs,function(el){
    var m=(getComputedStyle(el).backgroundImage||'').match(/url\(["']?([^"')]+)["']?\)/);
    if(!m||m[1].indexOf('data:')===0)return;
    var url=m[1];
    pending++;
    var apply=function(d){ if(d)el.style.backgroundImage='url("'+d+'")';
      if(--pending<=0)go(); };
    if(jobs[url]){ jobs[url].push(apply); return; }
    jobs[url]=[apply];
    (function(u){
      var fn=(typeof window.edArtDataUrl==='function')?window.edArtDataUrl
            :function(){ return Promise.resolve(null); };
      fn(u,900).then(function(d){ var q=jobs[u]; jobs[u]=null;
        q.forEach(function(f){ f(d); }); })
        .catch(function(){ var q=jobs[u]; jobs[u]=null; q.forEach(function(f){ f(null); }); });
    })(url);
  });
  if(!pending)go();
  /* Never hang waiting on a picture that will not resolve. */
  setTimeout(go,8000);
};
window.edPrintCurrent=function(){ var c=curCard(); if(!c){alert('Open a card first.');return;} window.edPrintCards([c]); };
window.edPrintFiltered=function(){
  var list=(window._allFiltered&&window._allFiltered.length)?window._allFiltered:(window.CARDS||[]);
  if(list.length>120 && !confirm('This will lay out '+list.length+' cards. That can be slow. Continue?'))return;
  window.edPrintCards(list);
};

