/* ===================================================================================================================
   ed2_frames.js - the card frames and the stat icon sets (session 90).
   A port of the frame generator kept with the frame designs (card_frame_redesigns): every frame is a skin (the
   colour variables the face stylesheet reads) plus decoration layers, SVG drawn in the card's own 340x476 space from
   the boxes' measured positions after fitFace has laid the face out. Nothing here is a filter: every glow and shadow
   is nested strokes, so nothing is re-blurred as a card turns. The stat icon sets draw the stats as layered icons
   (the fill at the stats' depth, the outline and numeral one step above). The Nebula frame paints the Cosmos back's
   sky under the card (NebSky). The chosen frame, icon set and card back are the look (edFrameLook), kept in meta
   'cardLook', in packs, backups and look.json like every other look field. Full art is a card's own option (its
   variant's fullArt, ed2_face.js), a card without a picture wears the placeholder art (frPhHTML), and the highlight
   slots get their overlays here (frPinHoloHTML), since session 92.
   Sits between ed2_face.js and ed2_tools.js inside the editor's closure: it reads the face helpers (cardOrbs, tplGet,
   e, FRAME_ORDER, svar, orbShapeByType) and the face code calls back into it (frFaceStyle, frTypelineStyle,
   frBoxHTML, frRimHTML, frExtrasHTML, frSecVars, faceOrbHTML, frameDecorate, frameTilt, frameTiltReset).
   =================================================================================================================== */
var FR_W=340, FR_H=476, FR_PAD=8.1, FR_R_CARD=16, FR_R_INNER=10, FR_R_BOX=7, FR_R_ART=6;
var FR_LAYER=5, FR_ORB_STEP=3;                     /* the layer depths at the card's own size: 5px a layer, 3px an icon step */
var FR_KEYS=['classic','inlaid','arcane','stellar','stone','scroll','sevenfold','nebula'];
var FR_NAMES={classic:'Default',inlaid:'Inlaid',arcane:'Arcanic',stellar:'Stellar',stone:'Stone',scroll:'Scroll',sevenfold:'Leatherbound',nebula:'Nebula'};
/* the icon set each frame was designed with */
var FR_ORB_OF={classic:'app',inlaid:'stone',arcane:'arcane',stellar:'stars',stone:'stone',scroll:'wax',sevenfold:'coin',nebula:'stars'};
var FR_ORB_SETS=['app','stone','arcane','stars','wax','coin','gem','bound','ink','glass'];
var FR_ORB_NAMES={app:'Default',stone:'Carved stone',arcane:'Arcane glass',stars:'Stars',wax:'Wax seal',coin:'Struck coin',gem:'Cabochon',bound:'Leatherbound',ink:'Woodblock',glass:'Leaded glass'};
/* the colour tables the frames were designed in; Grey is the Object frame's */
var FR_COLS=['Red','Orange','Yellow','Green','Blue','Indigo','Violet','Grey'];
var FR_PASTEL={Red:'#f9aa8f',Orange:'#e7af83',Yellow:'#fff799',Green:'#9bd3ae',Blue:'#aae0fa',Indigo:'#b298f0',Violet:'#e898de',Grey:'#cfd3da'};
var FR_MID={Red:'#d7886d',Orange:'#c58d61',Yellow:'#ddd577',Green:'#79b18c',Blue:'#88bed8',Indigo:'#9076ce',Violet:'#c676bc',Grey:'#8a909a'};
var FR_DEEP={Red:'#914227',Orange:'#7f471b',Yellow:'#978f31',Green:'#336b46',Blue:'#427892',Indigo:'#4a3088',Violet:'#803076',Grey:'#4a4f58'};
var FR_DARK={Red:'#200000',Orange:'#2b1b07',Yellow:'#322d00',Green:'#00160b',Blue:'#061922',Indigo:'#1d0a26',Violet:'#2a000f',Grey:'#141418'};
var FR_JEWEL={Red:'#e2452f',Orange:'#ee8a2a',Yellow:'#f2d13a',Green:'#3fae6a',Blue:'#3f9be0',Indigo:'#6a4fd6',Violet:'#d14fb8',Grey:'#9aa3b2'};
var FR_A='var(--holo-ang,120deg)';
/* a palette read along the sheet: at t (0 at the start of the light, 1 at its end) a card's colours blend into one another in
   the site's own order, as its Default frame runs from one colour to the next; one colour reads the same everywhere */
function frPalAt(cols){
  var n=(cols||[]).length;
  return function(table,t){
    if(n<2) return table[n?cols[0]:'Grey'];
    var p=Math.max(0,Math.min(1,t==null?.5:t))*(n-1), k=Math.min(n-2,Math.floor(p));
    return frMix(table[cols[k]],table[cols[k+1]],p-k);
  };
}
function frJewelAt(cols){ var P=frPalAt(cols); return function(t){ return P(FR_JEWEL,t); }; }
function frRgb(h){ h=String(h).replace('#',''); if(h.length===3) h=h[0]+h[0]+h[1]+h[1]+h[2]+h[2]; return [parseInt(h.slice(0,2),16),parseInt(h.slice(2,4),16),parseInt(h.slice(4,6),16)]; }
function frHex(c){ return '#'+c.map(function(v){ v=Math.max(0,Math.min(255,Math.round(v))); return (v<16?'0':'')+v.toString(16); }).join(''); }
function frShade(h,a){ return frHex(frRgb(h).map(function(v){ return v+a; })); }
function frMix(a,b,t){ var A=frRgb(a),B=frRgb(b); return frHex([A[0]+(B[0]-A[0])*t,A[1]+(B[1]-A[1])*t,A[2]+(B[2]-A[2])*t]); }
function frRgba(h,a){ var c=frRgb(h); return 'rgba('+c[0]+','+c[1]+','+c[2]+','+a+')'; }
function f2(v){ return (+v).toFixed(2); }
function f1(v){ return (+v).toFixed(1); }
/* ---------------------------------------------------------------- geometry: paths in the card's own space */
function frRR(x,y,w,h,r){
  r=Math.max(0,Math.min(r,w/2,h/2));
  return 'M '+f2(x+r)+','+f2(y)+' H '+f2(x+w-r)+' A '+f2(r)+','+f2(r)+' 0 0 1 '+f2(x+w)+','+f2(y+r)+' V '+f2(y+h-r)+' A '+f2(r)+','+f2(r)+' 0 0 1 '+f2(x+w-r)+','+f2(y+h)
    +' H '+f2(x+r)+' A '+f2(r)+','+f2(r)+' 0 0 1 '+f2(x)+','+f2(y+h-r)+' V '+f2(y+r)+' A '+f2(r)+','+f2(r)+' 0 0 1 '+f2(x+r)+','+f2(y)+' Z';
}
function frCardD(inset){ inset=inset||0; return frRR(inset,inset,FR_W-2*inset,FR_H-2*inset,FR_R_CARD-inset); }
function frInnerD(inset){ inset=inset||0; return frRR(FR_PAD+inset,FR_PAD+inset,FR_W-2*FR_PAD-2*inset,FR_H-2*FR_PAD-2*inset,Math.max(1,FR_R_INNER-inset)); }
function frRingD(){ return frCardD()+' '+frInnerD(); }
function frRectD(rect,inset,r){ inset=inset||0; if(r==null) r=FR_R_BOX; return frRR(rect[0]+inset,rect[1]+inset,rect[2]-2*inset,rect[3]-2*inset,Math.max(.5,r-inset)); }
function frCircleD(cx,cy,r){ return 'M '+f2(cx-r)+','+f2(cy)+' a '+f2(r)+','+f2(r)+' 0 1 0 '+f2(2*r)+',0 a '+f2(r)+','+f2(r)+' 0 1 0 '+f2(-2*r)+',0 Z'; }
function frPolyD(pts,dy){ dy=dy||0; return 'M '+pts.map(function(p){ return f2(p[0])+','+f2(p[1]+dy); }).join(' L ')+' Z'; }
/* ---------------------------------------------------------------- soft edges without filters
   A glow or a shadow is nested strokes of falling opacity, built so the stack matches the profile a Gaussian blur of the
   same deviation would give at the middle of each band. */
function frErf(x){
  var s=x<0?-1:1; x=Math.abs(x);
  var t=1/(1+.3275911*x);
  var y=1-(((((1.061405429*t-1.453152027)*t)+1.421413741)*t-.284496736)*t+.254829592)*t*Math.exp(-x*x);
  return s*y;
}
function frPhi(x){ return .5*(1+frErf(x/Math.SQRT2)); }
function frSoftBands(prof,xmax,n){
  var hs=[],i; for(i=0;i<n;i++) hs.push(xmax*(n-i)/n); hs.push(0);
  var out=[],prev=0;
  for(i=0;i<n;i++){
    var t=Math.min(.999,prof((hs[i]+hs[i+1])/2));
    var a=t>prev?1-(1-t)/(1-prev):0;
    if(a>.003) out.push([hs[i],a]);
    prev=Math.max(prev,t);
  }
  return out;
}
function frSoftPath(d,paint,w,sd,op,n,attrs){
  if(op==null) op=1; n=n||6; attrs=attrs||'';
  var prof=function(x){ return op*(frPhi((w/2-x)/sd)-frPhi((-w/2-x)/sd)); };
  return frSoftBands(prof,w/2+2.5*sd,n).map(function(b){
    return '<path d="'+d+'" fill="none" stroke="'+paint+'" stroke-width="'+f2(2*b[0])+'" stroke-opacity="'+b[1].toFixed(3)+'" '+attrs+'/>';
  }).join('');
}
function frSoftHalo(fn,sd,op,n,baseW,dbl){
  if(op==null) op=1; n=n||6; baseW=baseW||0;
  var prof=function(x){ var p=op*frPhi(-x/sd); return dbl?1-(1-p)*(1-p):p; };
  return frSoftBands(prof,2.5*sd,n).map(function(b){ return fn(baseW+2*b[0],b[1]); }).join('');
}
/* ---------------------------------------------------------------- gradients that turn with the card
   On the sheet (the default) a gradient lies over the whole card in the card's own space, so every line painted with it
   shows its own slice of one shine, lined up with the boxes' CSS metal (alignFrameGradients) and with every other line.
   The tilt code moves the sheet (data-sheet) and turns the others (data-rot, the site's own rotate(ang .5 .5)). */
function frSheetLine(a){
  var r=(a==null?120:a)*Math.PI/180, dx=Math.sin(r), dy=-Math.cos(r), L=(Math.abs(FR_W*dx)+Math.abs(FR_H*dy))/2;
  return [FR_W/2-dx*L,FR_H/2-dy*L,FR_W/2+dx*L,FR_H/2+dy*L];
}
function frStops(stops){
  return stops.map(function(s){ return '<stop offset="'+s[0]+'" stop-color="'+s[1]+'"'+(s.length>2&&s[2]!=null?' stop-opacity="'+s[2]+'"':'')+'/>'; }).join('');
}
function frLG(id,stops,rot,extra,sheet){
  if(rot==null) rot=true; if(sheet==null) sheet=true; extra=extra||'';
  var s=frStops(stops);
  if(rot&&sheet){ var l=frSheetLine(120);
    return '<linearGradient id="'+id+'" gradientUnits="userSpaceOnUse" x1="'+f2(l[0])+'" y1="'+f2(l[1])+'" x2="'+f2(l[2])+'" y2="'+f2(l[3])+'" data-sheet="1" '+extra+'>'+s+'</linearGradient>'; }
  return '<linearGradient id="'+id+'" x1=".5" y1="1" x2=".5" y2="0" '+(rot?'data-rot="1"':'')+' gradientTransform="rotate(120 .5 .5)" '+extra+'>'+s+'</linearGradient>';
}
function frFrameGrad(id,cols){ var P=frPalAt(cols), h=function(t){ return P(FR_PASTEL,t); };
  return frLG(id,[[0,h(0)],[.31,frShade(h(.31),30)],[.415,'#ffe1ef'],[.44,'#fff7d8'],[.46,'#ffffff'],[.48,'#d8fff1'],[.505,'#dde7ff'],[.58,frShade(h(.58),-42)],[1,h(1)]]); }
var FR_GOLD_STOPS=[[0,'#6b5327'],[.22,'#a8862f'],[.38,'#e8c96a'],[.43,'#fff1c8'],[.46,'#ffffff'],[.49,'#ffeede'],[.55,'#e8c96a'],[.72,'#8a6820'],[1,'#6b5327']];
var FR_IRON_STOPS=[[0,'#33363b'],[.22,'#5c6169'],[.38,'#aeb4bd'],[.43,'#e8ebf0'],[.46,'#f6f7fa'],[.49,'#e3e6eb'],[.55,'#aeb4bd'],[.72,'#44484f'],[1,'#2e3136']];
var FR_STEEL_STOPS=[[0,'#1b1d22'],[.30,'#2e3137'],[.44,'#6a6f78'],[.46,'#a9afb9'],[.48,'#6a6f78'],[.62,'#2a2c32'],[1,'#17191d']];
function frGoldGrad(id,sheet){ return frLG(id,FR_GOLD_STOPS,true,'',sheet==null?true:sheet); }
function frSteelGrad(id){ return frLG(id,FR_STEEL_STOPS); }
function frLumGrad(id,cols){ var J=frJewelAt(cols); return frLG(id,[[0,frMix(J(0),'#000',.35)],[.40,J(.4)],[.46,frMix(J(.46),'#fff',.55)],[.52,J(.52)],[1,frMix(J(1),'#000',.35)]]); }
function frLumcGrad(id,cols){ var J=frJewelAt(cols); return frLG(id,[[0,J(0)],[.40,frMix(J(.4),'#fff',.55)],[.46,'#ffffff'],[.52,frMix(J(.52),'#fff',.55)],[1,J(1)]]); }
function frLumbGrad(id,cols){ var J=frJewelAt(cols); return frLG(id,[[0,frMix(J(0),'#fff',.3)],[.40,frMix(J(.4),'#fff',.75)],[.46,'#ffffff'],[.52,frMix(J(.52),'#fff',.75)],[1,frMix(J(1),'#fff',.3)]]); }
function frEnamelGrad(id,cols){ var J=frJewelAt(cols); return frLG(id,[[0,frMix(J(0),'#000',.3)],[.40,J(.4)],[.46,frMix(J(.46),'#fff',.55)],[.52,J(.52)],[1,frMix(J(1),'#000',.3)]]); }
function frCssStops(stops){ return stops.map(function(s){ return s[1]+' '+(s[0]*100).toFixed(1)+'%'; }).join(','); }
function frIronCss(){ return 'linear-gradient('+FR_A+','+frCssStops(FR_IRON_STOPS)+')'; }
function frSteelCss(){ return 'linear-gradient('+FR_A+','+frCssStops(FR_STEEL_STOPS)+')'; }
function frGlassCss(c){ return 'linear-gradient('+c+','+c+')'; }
function frRibbonCss(cols){ var P=frPalAt(cols); return 'linear-gradient('+FR_A+','+P(FR_DEEP,0)+' 0%,'+P(FR_MID,.4)+' 40%,'+frMix(P(FR_MID,.46),'#fff',.45)+' 46%,'+P(FR_MID,.52)+' 52%,'+P(FR_DEEP,1)+' 100%)'; }
/* a texture (frames.css declares it once as --tex-<name>) as a background layer */
function frTexCss(name){ return 'var(--tex-'+name+') center/100% 100% no-repeat'; }
function frTexUrl(name){
  var v=getComputedStyle(document.documentElement).getPropertyValue('--tex-'+name).trim();
  var a=v.indexOf('('), b=v.lastIndexOf(')'); if(a<0||b<a) return '';
  v=v.slice(a+1,b).trim(); var q=v.charAt(0); if(q==='"'||q==="'") v=v.slice(1,-1);
  return v;
}
/* the Stone frame's texture: a card of several colours takes a crossfade of its colours' stones along the sheet, drawn once per
   combination (frStoneBlend) into --tex-stone-<a>-<b> on the root; until it is drawn the first colour's stone stands in */
var FR_STONE_BLENDS={};
function frStoneCss(cols){
  var names=(cols&&cols.length?cols:['Grey']).map(function(c){ return c.toLowerCase(); });
  if(names.length<2) return frTexCss('stone-'+names[0]);
  frStoneBlend(names);
  return 'var(--tex-stone-'+names.join('-')+',var(--tex-stone-'+names[0]+')) center/100% 100% no-repeat';
}
function frStoneBlend(names){
  var key=names.join('-'); if(FR_STONE_BLENDS[key]) return; FR_STONE_BLENDS[key]=1;
  var urls=names.map(function(n){ return frTexUrl('stone-'+n); });
  if(urls.some(function(u){ return !u; })) return;
  var imgs=[], left=urls.length;
  urls.forEach(function(u,i){
    var im=new Image();
    im.onload=function(){ imgs[i]=im; if(--left===0) frStoneBlendDraw(key,imgs); };
    im.src=u;
  });
}
function frStoneBlendDraw(key,imgs){
  var w=imgs[0].naturalWidth||510, h=imgs[0].naturalHeight||714, c=document.createElement('canvas'); c.width=w; c.height=h;
  var x=c.getContext('2d'); if(!x) return;
  var l=frSheetLine(120), sx=w/FR_W, sy=h/FR_H, n=imgs.length, k, g;
  x.drawImage(imgs[0],0,0,w,h);
  /* each next stone fades in over its own stretch of the sheet: the one before is cut away there, and it is laid underneath */
  for(k=1;k<n;k++){
    g=x.createLinearGradient(l[0]*sx,l[1]*sy,l[2]*sx,l[3]*sy);
    g.addColorStop(0,'rgba(0,0,0,0)'); g.addColorStop((k-1)/(n-1),'rgba(0,0,0,0)'); g.addColorStop(k/(n-1),'rgba(0,0,0,1)'); g.addColorStop(1,'rgba(0,0,0,1)');
    x.globalCompositeOperation='destination-out'; x.fillStyle=g; x.fillRect(0,0,w,h);
    x.globalCompositeOperation='destination-over'; x.drawImage(imgs[k],0,0,w,h);
  }
  x.globalCompositeOperation='source-over';
  var url=''; try{ url=c.toDataURL('image/jpeg',.86); }catch(_){ return; }
  if(url) document.documentElement.style.setProperty('--tex-stone-'+key,'url("'+url+'")');
}
function frClip(id,d,evenodd){ return '<clipPath id="'+id+'"><path d="'+d+'"'+(evenodd?' clip-rule="evenodd"':'')+'/></clipPath>'; }
/* ---------------------------------------------------------------- strokes and pieces */
function frGoldLine(d,w,idp,dark,edge){
  dark=dark||'#2a1a06'; if(edge==null) edge=.55;
  return '<path d="'+d+'" fill="none" stroke="'+dark+'" stroke-opacity=".85" stroke-width="'+f2(w+2*edge)+'"/><path d="'+d+'" fill="none" stroke="url(#'+idp+'gold)" stroke-width="'+f2(w)+'"/>';
}
function frHair(d,w,c,op){ return '<path d="'+d+'" fill="none" stroke="'+(c||'#000')+'" stroke-opacity="'+(op==null?.6:op)+'" stroke-width="'+(w==null?.7:w)+'"/>'; }
function frGlowPath(d,idp,w,lum,core,sd3,sd1){
  if(w==null) w=1.1; if(lum==null) lum=1; core=core||'lumc'; if(sd3==null) sd3=3; if(sd1==null) sd1=.9;
  return frSoftPath(d,'url(#'+idp+'lum)',w*4,sd3,Math.min(1,.55*lum))+frSoftPath(d,'url(#'+idp+'lum)',w*1.8,sd1,Math.min(1,.8*lum),4)
    +'<path d="'+d+'" fill="none" stroke="url(#'+idp+core+')" stroke-width="'+f2(w)+'"/>';
}
/* the template's own box outline, drawn in SVG: a 4px band of the frame gradient between two 1.5px dark hairlines, with the bevel highlight */
function frPinBand(dOut,dMid,dIn,idp,grad,dark){
  grad=grad||'fr'; dark=dark||'var(--ink-dark,#141418)';
  return '<path d="'+dMid+'" fill="none" stroke="url(#'+idp+grad+')" stroke-width="4"/>'
    +'<path d="'+dOut+'" fill="none" style="stroke:'+dark+'" stroke-width="1.5"/><path d="'+dIn+'" fill="none" style="stroke:'+dark+'" stroke-width="1.5"/>'
    +'<path d="'+dIn+'" fill="none" stroke="#fff" stroke-opacity=".10" stroke-width="1" transform="translate(0 1.2)"/>';
}
function frCarved(d,dark,light,w,dx){
  if(dark==null) dark=.5; if(light==null) light=.32; if(w==null) w=.8; if(dx==null) dx=.55;
  return '<path d="'+d+'" fill="none" stroke="#fff" stroke-opacity="'+light+'" stroke-width="'+w+'" stroke-linecap="round" stroke-linejoin="round" transform="translate('+dx+' '+dx+')"/>'
    +'<path d="'+d+'" fill="none" stroke="#000" stroke-opacity="'+dark+'" stroke-width="'+w+'" stroke-linecap="round" stroke-linejoin="round"/>';
}
function frRaised(d,depth,dark,light,w){
  if(depth==null) depth=.9; if(dark==null) dark=.5; if(light==null) light=.4; if(w==null) w=1.2;
  return '<path d="'+d+'" fill="none" stroke="#000" stroke-opacity="'+dark+'" stroke-width="'+w+'" transform="translate('+depth+' '+depth+')"/>'
    +'<path d="'+d+'" fill="none" stroke="#fff" stroke-opacity="'+light+'" stroke-width="'+w+'" transform="translate('+(-depth)+' '+(-depth)+')"/>'
    +'<path d="'+d+'" fill="none" stroke="#000" stroke-opacity=".45" stroke-width=".5"/>';
}
function frRecess(d,clipId,depth,dark,light,w){
  if(depth==null) depth=1; if(dark==null) dark=.55; if(light==null) light=.35; if(w==null) w=1.4;
  return '<g clip-path="url(#'+clipId+')"><path d="'+d+'" fill="none" stroke="#000" stroke-opacity="'+dark+'" stroke-width="'+w+'" transform="translate('+depth+' '+depth+')"/>'
    +'<path d="'+d+'" fill="none" stroke="#fff" stroke-opacity="'+light+'" stroke-width="'+w+'" transform="translate('+(-depth)+' '+(-depth)+')"/></g>'
    +'<path d="'+d+'" fill="none" stroke="#000" stroke-opacity=".5" stroke-width=".5"/>';
}
function frGemDefs(idp,colour){
  var lo=frMix(colour,'#000',.55), hi=frMix(colour,'#fff',.45);
  return '<radialGradient id="'+idp+'gemb" cx="38%" cy="32%" r="68%"><stop offset="0" stop-color="'+hi+'"/><stop offset=".45" stop-color="'+colour+'"/><stop offset="1" stop-color="'+lo+'"/></radialGradient>'
    +'<radialGradient id="'+idp+'gemh" cx="33%" cy="24%" r="38%"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset=".45" stop-color="#fff" stop-opacity=".2"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>';
}
/* the backs' bracket: a gold angle piece at a card's edge, its points worked out in the card's own space so its gold lies on the card-wide sheet */
function frBracket(x,y,sx,sy,idp,size){
  var s=size||13;
  var poly=function(pts){ return 'M '+pts.map(function(p){ return f2(x+sx*p[0])+','+f2(y+sy*p[1]); }).join(' L ')+' Z'; };
  var d=poly([[0,0],[s,0],[s*.72,s*.28],[s*.28,s*.28],[s*.28,s*.72],[0,s]]);
  var hi=poly([[1,1],[s*.86,1],[s*.62,s*.24],[s*.24,s*.24],[s*.24,s*.62],[1,s*.86]]);
  return '<path d="'+d+'" fill="#2a1a06" transform="translate('+(.6*sx)+' '+(.6*sy)+')" opacity=".7"/><path d="'+d+'" fill="url(#'+idp+'gold)" stroke="#2a1a06" stroke-width=".5"/>'
    +'<path d="'+hi+'" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width=".5"/>';
}
function frBrackets(idp,inset,size){
  return frBracket(inset,inset,1,1,idp,size)+frBracket(FR_W-inset,inset,-1,1,idp,size)+frBracket(inset,FR_H-inset,1,-1,idp,size)+frBracket(FR_W-inset,FR_H-inset,-1,-1,idp,size);
}
function frStar(cx,cy,r,fill,pts,inner){
  pts=pts||4; if(inner==null) inner=.3; var p=[];
  for(var i=0;i<pts*2;i++){ var a=-Math.PI/2+i*Math.PI/pts, rr=i%2===0?r:r*inner; p.push(f2(cx+rr*Math.cos(a))+','+f2(cy+rr*Math.sin(a))); }
  return '<polygon points="'+p.join(' ')+'" fill="'+(fill||'#fff')+'"/>';
}
/* a seeded random, so a frame's scatter is the same on every draw of the same card */
function frRandom(seed){
  var s=(seed>>>0)||1;
  return function(){ s^=s<<13; s>>>=0; s^=s>>>17; s^=s<<5; s>>>=0; return s/4294967296; };
}
/* ---------------------------------------------------------------- the stat icon sets
   Every icon is layers: the fill (o-base) at the stats' depth, the outline, the numeral and the light parts (o-top) one
   step above, and for some sets a layer between (o-mid: a turning galaxy, a few stars, a sheen). The combined stats
   (attack and arcane, health and arcane) are the catalog's fused orb in the same style: the base shape above, the arcane
   circle below, blended across the middle. */
var FR_ORB_PATH={atk:'M19,2 L36,19 L19,36 L2,19 Z',hp:'M19,2 L36,10.5 L36,27.5 L19,36 L2,27.5 L2,10.5 Z',arc:'M19,2 A17,17 0 1,1 18.99,2 Z',rng:'M19,2 L36,33 L2,33 Z'};
var FR_ORB_KIND={attack:'atk',health:'hp',arcane:'arc',range:'rng'};
var FR_ORB_VERTS={atk:[[19,2],[36,19],[19,36],[2,19]],hp:[[19,2],[36,10.5],[36,27.5],[19,36],[2,27.5],[2,10.5]],rng:[[19,2],[36,33],[2,33]]};
var FR_ORB_TOP={atk:'M19,2 L36,19 L35.4,19.6 L2.6,19.6 L2,19 Z',hp:'M19,2 L36,10.5 L36,19.6 L2,19.6 L2,10.5 Z'};
var FR_ORB_ARC_BOTTOM='M2.01,18.4 A17,17 0 0,0 35.99,18.4 Z';
var FR_GAL_W=96, FR_GAL_X=19-48, FR_HALO_S=101/96;
var FR_FUSED={'attack and arcane':'atk','health and arcane':'hp'};
var FR_UID=0;
function frUid(){ return 'fo'+(++FR_UID).toString(36); }
function frOrbFill(k){
  var fb=ORB_FILL[k];
  return k==='arc'?svar('arc',svar('mp',fb)):svar(k,fb);
}
function frOrbGradDefs(uid,fill){
  var a=fill;
  return '<linearGradient id="'+uid+'iron" data-rot="1" gradientTransform="rotate(120 .5 .5)"><stop offset="0%" stop-color="#33363b"/><stop offset="30%" stop-color="#6f757e"/><stop offset="46%" stop-color="#e8ebf0"/><stop offset="62%" stop-color="#44484f"/><stop offset="100%" stop-color="#2e3136"/></linearGradient>'
    +'<linearGradient id="'+uid+'fk" data-rot="1" gradientTransform="rotate(120 .5 .5)"><stop offset="0%" stop-color="'+a+'"/><stop offset="30%" stop-color="'+frShade(a,34)+'"/><stop offset="48%" stop-color="'+frShade(a,70)+'"/><stop offset="66%" stop-color="'+frShade(a,-36)+'"/><stop offset="100%" stop-color="'+a+'"/></linearGradient>';
}
function frOrbGoldDefs(uid){
  return '<linearGradient id="'+uid+'gold" data-rot="1" gradientTransform="rotate(120 .5 .5)" x1=".5" y1="1" x2=".5" y2="0">'+frStops(FR_GOLD_STOPS)+'</linearGradient>';
}
/* the Leatherbound frame's brackets, gemless and bevelled, at a shape's top and bottom brackets */
function frOrbBrackets(k,uid,L,w){
  L=L||6.2; w=w||3.0; var out=[];
  var piece=function(pts){
    var d='M '+pts.map(function(p){ return f2(p[0])+','+f2(p[1]); }).join(' L ');
    return '<path d="'+d+'" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="'+f2(w+2.4)+'" stroke-linejoin="miter" stroke-linecap="round" transform="translate(-1 -1)"/>'
      +'<path d="'+d+'" fill="none" stroke="#2a1a06" stroke-opacity=".8" stroke-width="'+f2(w+2.4)+'" stroke-linejoin="miter" stroke-linecap="round" transform="translate(1 1)"/>'
      +'<path d="'+d+'" fill="none" stroke="url(#'+uid+'gold)" stroke-width="'+f2(w)+'" stroke-linejoin="miter" stroke-linecap="round"/>'
      +'<path d="'+d+'" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width=".5" stroke-linejoin="miter" transform="translate(-.4 -.4)"/>';
  };
  var unit=function(dx,dy){ var m=Math.hypot(dx,dy); return [dx/m,dy/m]; };
  var V=FR_ORB_VERTS[k==='arc'?'hp':k], n=V.length;
  V.forEach(function(p,i){
    var x=p[0],y=p[1];
    if(Math.abs(x-19)>.01&&k!=='rng') return;
    var a=V[(i-1+n)%n], b=V[(i+1)%n], e1=unit(a[0]-x,a[1]-y), e2=unit(b[0]-x,b[1]-y);
    out.push(piece([[x+e1[0]*L,y+e1[1]*L],[x,y],[x+e2[0]*L,y+e2[1]*L]]));
  });
  return out.join('');
}
function frOrbStroke(d,uid,colour){
  return '<path d="'+d+'" fill="none" stroke="'+(colour||'#e4e7ec')+'" stroke-width="3.6" stroke-linejoin="round"/><path d="'+d+'" fill="none" stroke="url(#'+uid+'iron)" stroke-width="2.1" stroke-linejoin="round"/>';
}
/* a translucent cabochon in the orb's colour: deep at the rim, lit from the top left, a soft window of light */
function frOrbGemDefs(uid,colour){
  var lo=frMix(colour,'#000000',.55), hi=frMix(colour,'#ffffff',.45);
  return '<radialGradient id="'+uid+'gem" cx="38%" cy="32%" r="68%"><stop offset="0" stop-color="'+hi+'" stop-opacity=".95"/><stop offset=".45" stop-color="'+colour+'" stop-opacity=".92"/><stop offset="1" stop-color="'+lo+'" stop-opacity=".98"/></radialGradient>'
    +'<radialGradient id="'+uid+'gemhi" cx="33%" cy="24%" r="38%"><stop offset="0" stop-color="#fff" stop-opacity=".85"/><stop offset=".45" stop-color="#fff" stop-opacity=".22"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>'
    +'<radialGradient id="'+uid+'gemlo" cx="62%" cy="78%" r="55%"><stop offset="0" stop-color="'+hi+'" stop-opacity=".35"/><stop offset=".6" stop-color="'+hi+'" stop-opacity="0"/></radialGradient>'
    +'<linearGradient id="'+uid+'gemsheen" data-rot="1" gradientTransform="rotate(120 .5 .5)"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset=".42" stop-color="#fff" stop-opacity="0"/><stop offset=".47" stop-color="#fff" stop-opacity=".55"/><stop offset=".52" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient>';
}
/* the cut crystal's facets: a fan of triangles from the centre to each side, lit and shaded in turn (the circle stays smooth) */
function frFacets(k){
  if(k==='arc') return '';
  var pts=FR_ORB_VERTS[k], n=pts.length, out='';
  for(var i=0;i<n;i++) out+='<polygon points="19,19 '+f1(pts[i][0])+','+f1(pts[i][1])+' '+f1(pts[(i+1)%n][0])+','+f1(pts[(i+1)%n][1])+'" fill="#fff" fill-opacity="'+(i%2===0?'0.30':'0.08')+'"/>';
  return out;
}
/* the Cosmos back's galaxies in one colour (the thick one, or the thin-armed one): the white pictures frames.css carries,
   tinted once per colour on a canvas; until the pictures have decoded the white one stands in and is swapped after */
var FR_GAL_IMG={}, FR_GAL_URL={}, FR_GAL_READY=false;
function frGalLoad(){
  if(FR_GAL_IMG.gal) return;
  var left=2, done=function(){ if(--left) return; FR_GAL_READY=true; frGalRepaint(); };
  [['gal','gal-ffffff'],['thin','gal-ffffff-thin']].forEach(function(p){
    var im=new Image(); FR_GAL_IMG[p[0]]=im; im.onload=done; im.onerror=done; im.src=frTexUrl(p[1]);
  });
}
function frGalUrl(col,thin){
  var hex=String(col).replace('#','').toLowerCase(), key=hex+(thin?'t':'');
  if(FR_GAL_URL[key]) return FR_GAL_URL[key];
  if(hex==='ffffff'||!FR_GAL_READY) return 'var(--tex-gal-ffffff'+(thin?'-thin':'')+')';
  var im=FR_GAL_IMG[thin?'thin':'gal']; if(!im||!im.naturalWidth) return 'var(--tex-gal-ffffff'+(thin?'-thin':'')+')';
  var c=document.createElement('canvas'); c.width=im.naturalWidth; c.height=im.naturalHeight;
  var x=c.getContext('2d'); x.drawImage(im,0,0); x.globalCompositeOperation='source-in'; x.fillStyle='#'+hex; x.fillRect(0,0,c.width,c.height);
  return FR_GAL_URL[key]='url('+c.toDataURL('image/png')+')';
}
function frGalRepaint(){
  document.querySelectorAll('.o-galimg[data-col]').forEach(function(el){ el.style.backgroundImage=frGalUrl(el.getAttribute('data-col'),el.getAttribute('data-thin')==='1'); });
}
function frGalDiv(pale,thin){
  return '<div class="o-galimg" data-gal-rot="1.25" data-col="'+pale.replace('#','')+'"'+(thin?' data-thin="1"':'')+' style="background-image:'+frGalUrl(pale,thin)+'"></div>';
}
function frHaloImg(col){
  return '<div class="o-galimg o-haloimg" data-gal-rot="0.825" data-col="'+col.replace('#','')+'" style="background-image:'+frGalUrl(col,false)+'"></div>';
}
/* the shape path (M, L, A and Z only) scaled about the icon's centre */
function frScalePath(d,s){
  var out=[], cmd='', n=0;
  d.replace(/,/g,' ').split(/\s+/).forEach(function(tok){
    if(!tok) return;
    var rest=tok;
    if('MLAZ'.indexOf(tok[0])>=0){ out.push(tok[0]); rest=tok.slice(1); cmd=tok[0]; n=0; }
    if(!rest) return;
    var v=parseFloat(rest);
    if(cmd==='A'&&n>=2&&n<=4){ n++; out.push(rest); return; }
    if(cmd==='A') v=n<2?v*s:19+(v-19)*s;
    else if(cmd==='M'||cmd==='L') v=19+(v-19)*s;
    n++; out.push(f2(v));
  });
  return out.join(' ');
}
/* a clipPath (bounding-box units) of the band of the shape's outline, for the HTML galaxy highlight */
function frRingClip(uid,d,half){
  half=half||1.1; var so=1+half/17, si=1-half/17;
  return '<clipPath id="'+uid+'ring" clipPathUnits="objectBoundingBox"><path clip-rule="evenodd" d="'+frScalePath(d,so)+' '+frScalePath(d,si)+'" transform="scale('+(1/38).toFixed(6)+')"/></clipPath>';
}
/* the Carved stone rim and the Leaded glass pane carry a baked noise picture each (frames.css, --tex-noise-<mode>-<k>);
   one hidden svg holds them for every icon on the page to <use> */
function frNoiseDefs(){
  if(document.getElementById('frNoiseDefs')) return;
  var imgs='';
  ['stone','glass'].forEach(function(m){ ['atk','hp','arc','rng'].forEach(function(k){
    var u=frTexUrl('noise-'+m+'-'+k); if(!u) return;
    imgs+='<image id="orbnoise-'+m+'-'+k+'" href="'+u+'" x="-4" y="-4" width="46" height="46" preserveAspectRatio="none"/>';
  }); });
  var host=document.createElement('div'); host.id='frNoiseDefs'; host.setAttribute('aria-hidden','true');
  host.style.cssText='position:absolute;width:0;height:0;overflow:hidden';
  host.innerHTML='<svg width="0" height="0"><defs>'+imgs+'</defs></svg>';
  document.body.appendChild(host);
}
function frStar4(cx,cy,r,inner){ return frStar(cx,cy,r,'#fff',4,inner==null?.32:inner); }
/* one stat shape in one style: {defs, base (the fill layer), top (the raised layer), ink (the numeral's outline), mids, halo} */
function frOrbParts(k,uid,mode,tint){
  var d=FR_ORB_PATH[k], fill=frOrbFill(k), ink=ORB_OUTLINE[k], mids=[], halo='', base='', top='';
  var sc=function(f){ return 'transform="translate(19 19) scale('+f+') translate(-19 -19)"'; };
  var defs=frOrbGradDefs(uid,fill), c, cl, cb;
  if(mode==='app'){
    base='<path d="'+d+'" fill="url(#'+uid+'fk)"/>'; top=frOrbStroke(d,uid);
  } else if(mode==='gem'){
    defs+=frOrbGemDefs(uid,fill);
    base='<path d="'+d+'" fill="url(#'+uid+'gem)"/><path d="'+d+'" fill="url(#'+uid+'gemlo)"/>';
    defs+='<clipPath id="'+uid+'gclip"><path d="'+d+'"/></clipPath>';
    defs+='<clipPath id="'+uid+'obb" clipPathUnits="objectBoundingBox"><path d="'+d+'" transform="scale('+(1/38).toFixed(6)+')"/></clipPath>';
    mids=[['sheen','<div class="o-gc" style="clip-path:url(#'+uid+'obb)">'+frGalDiv('#ffffff',true)+'</div>']];
    top=frFacets(k)+'<path d="'+d+'" fill="url(#'+uid+'gemhi)"/>'
      +'<g clip-path="url(#'+uid+'gclip)">'
      +'<path d="'+d+'" fill="none" stroke="'+frMix(fill,'#fff',.6)+'" stroke-opacity=".85" stroke-width="6.12" stroke-linejoin="round" transform="translate(1.1 1.1)"/>'
      +'<path d="'+d+'" fill="none" stroke="'+frMix(fill,'#000',.5)+'" stroke-opacity=".75" stroke-width="6.12" stroke-linejoin="round" transform="translate(-1.1 -1.1)"/>'
      +'<path d="'+d+'" fill="none" stroke="#fff" stroke-opacity=".5" stroke-width="1.2" stroke-linejoin="round" transform="translate(2.4 2.4)"/></g>'
      +'<path d="'+d+'" fill="none" stroke="#000" stroke-opacity=".4" stroke-width=".6" stroke-linejoin="round"/>';
  } else if(mode==='stone'){
    var crystal={atk:'#d23a3a',hp:'#e0b43c',arc:'#3a8fe0',rng:'#55b06a'}[k];
    defs+=frOrbGemDefs(uid,fill);
    defs+='<linearGradient id="'+uid+'cry" data-rot="1" gradientTransform="rotate(120 .5 .5)"><stop offset="0" stop-color="'+frMix(crystal,'#000',.45)+'"/><stop offset=".40" stop-color="'+crystal+'"/><stop offset=".46" stop-color="'+frMix(crystal,'#fff',.6)+'"/><stop offset=".52" stop-color="'+crystal+'"/><stop offset="1" stop-color="'+frMix(crystal,'#000',.45)+'"/></linearGradient>';
    base='<path d="'+d+'" fill="url(#'+uid+'gem)"/><path d="'+d+'" fill="url(#'+uid+'gemlo)"/>';
    top='<path d="'+d+'" fill="url(#'+uid+'gemsheen)"/><path d="'+d+'" fill="url(#'+uid+'gemhi)"/><use href="#orbnoise-stone-'+k+'"/>';
  } else if(mode==='arcane'){
    c=fill; cl=frMix(c,'#fff',.55); cb=frMix(c,'#fff',.75);
    defs+='<linearGradient id="'+uid+'lum" data-rot="1" gradientTransform="rotate(120 .5 .5)" x1=".5" y1="1" x2=".5" y2="0"><stop offset="0" stop-color="'+frMix(c,'#000',.35)+'"/><stop offset=".40" stop-color="'+c+'"/><stop offset=".46" stop-color="'+cl+'"/><stop offset=".52" stop-color="'+c+'"/><stop offset="1" stop-color="'+frMix(c,'#000',.35)+'"/></linearGradient>'
      +'<linearGradient id="'+uid+'lumb" data-rot="1" gradientTransform="rotate(120 .5 .5)" x1=".5" y1="1" x2=".5" y2="0"><stop offset="0" stop-color="'+frMix(c,'#fff',.3)+'"/><stop offset=".40" stop-color="'+cb+'"/><stop offset=".46" stop-color="#ffffff"/><stop offset=".52" stop-color="'+cb+'"/><stop offset="1" stop-color="'+frMix(c,'#fff',.3)+'"/></linearGradient>'
      +'<radialGradient id="'+uid+'inner" cx="50%" cy="50%" r="55%"><stop offset="0" stop-color="'+cl+'" stop-opacity=".55"/><stop offset=".55" stop-color="'+c+'" stop-opacity=".30"/><stop offset="1" stop-color="'+c+'" stop-opacity=".05"/></radialGradient>';
    base='<path d="'+d+'" fill="#06080e" fill-opacity=".86"/><path d="'+d+'" fill="url(#'+uid+'inner)"/>';
    top='<path d="'+d+'" fill="none" stroke="#06080e" stroke-opacity=".86" stroke-width="4.4" stroke-linejoin="round"/>'
      +frSoftPath(d,'url(#'+uid+'lum)',6,2.2,.8,6,'stroke-linejoin="round"')
      +frSoftPath(d,'url(#'+uid+'lum)',2.8,.8,1.0,4,'stroke-linejoin="round"')
      +'<path d="'+d+'" fill="none" stroke="url(#'+uid+'lumb)" stroke-width="1.5" stroke-linejoin="round"/>';
    ink=frMix(c,'#000',.6);
  } else if(mode==='coin'){
    defs+='<linearGradient id="'+uid+'cgold" data-rot="1" gradientTransform="rotate(120 .5 .5)" x1=".5" y1="1" x2=".5" y2="0"><stop offset="0" stop-color="#6b5327"/><stop offset=".22" stop-color="#a8862f"/><stop offset=".40" stop-color="#e8c96a"/><stop offset=".46" stop-color="#fff1c8"/><stop offset=".52" stop-color="#e8c96a"/><stop offset=".72" stop-color="#8a6820"/><stop offset="1" stop-color="#6b5327"/></linearGradient>'
      +'<linearGradient id="'+uid+'cfield" data-rot="1" gradientTransform="rotate(120 .5 .5)" x1=".5" y1="1" x2=".5" y2="0"><stop offset="0" stop-color="'+frMix(fill,'#000',.45)+'"/><stop offset=".22" stop-color="'+frMix(fill,'#000',.15)+'"/><stop offset=".40" stop-color="'+frMix(fill,'#fff',.15)+'"/><stop offset=".46" stop-color="'+frMix(fill,'#fff',.6)+'"/><stop offset=".52" stop-color="'+frMix(fill,'#fff',.15)+'"/><stop offset=".72" stop-color="'+frMix(fill,'#000',.3)+'"/><stop offset="1" stop-color="'+frMix(fill,'#000',.45)+'"/></linearGradient>';
    /* the reeded edge: forty marks from r 15.5 to 18.2, drawn as one dashed ring */
    var rr=(15.5+18.2)/2, per=2*Math.PI*rr/40;
    var reed='<path d="M '+(19+rr).toFixed(3)+',19 A '+rr.toFixed(3)+','+rr.toFixed(3)+' 0 1,1 '+(19-rr).toFixed(3)+',19 A '+rr.toFixed(3)+','+rr.toFixed(3)+' 0 1,1 '+(19+rr).toFixed(3)+',19 Z" fill="none" stroke="#4a3610" stroke-opacity=".6" '
      +'stroke-width="'+f2(18.2-15.5)+'" stroke-dasharray="0.7 '+(per-0.7).toFixed(4)+'" stroke-dashoffset="0.35"/>';
    base='<path d="'+d+'" fill="url(#'+uid+'cgold)"/><g clip-path="inset(0)">'+reed+'</g><path d="'+d+'" fill="url(#'+uid+'cfield)" '+sc(.87)+'/>';
    top='<path d="'+d+'" fill="none" stroke="url(#'+uid+'cgold)" stroke-width="1.35" stroke-linejoin="round"/>'
      +'<path d="'+d+'" fill="none" stroke="#3a2a10" stroke-opacity=".7" stroke-width=".8" stroke-linejoin="round" '+sc(1.09)+'/>'
      +'<path d="'+d+'" fill="none" stroke="#3a2a10" stroke-opacity=".7" stroke-width="1" stroke-linejoin="round" '+sc(.87)+'/>'
      +'<path d="'+d+'" fill="none" stroke="#fff" stroke-opacity=".35" stroke-width=".8" stroke-linejoin="round" transform="translate(18.4 18.4) scale(.87) translate(-19 -19)"/>';
    ink='#3a2a10';
  } else if(mode==='ink'){
    base='<path d="'+d+'" fill="#1a1a1a"/><path d="'+d+'" fill="#f6f1e6" stroke="#f6f1e6" stroke-width="1.6" stroke-linejoin="round"/><path d="'+d+'" fill="'+fill+'" '+sc(.9)+'/>';
    top='<path d="'+d+'" fill="none" stroke="#1a1a1a" stroke-width="2.6" stroke-linejoin="round" '+sc(1.08)+'/>'
      +'<path d="'+d+'" fill="none" stroke="#1a1a1a" stroke-width="1.3" stroke-linejoin="round" '+sc(.9)+'/>';
    if(k==='atk'||k==='rng'){
      defs+='<mask id="'+uid+'out" maskUnits="userSpaceOnUse" x="-8" y="-8" width="54" height="54"><rect x="-8" y="-8" width="54" height="54" fill="#fff"/><path d="'+d+'" fill="#000" '+sc(1.08)+'/></mask>';
      top='<g mask="url(#'+uid+'out)"><path d="'+d+'" fill="none" stroke="#1a1a1a" stroke-width="'+f2(2.6+4/1.08)+'" stroke-linejoin="round" '+sc(1.08)+'/></g>'+top;
    }
    ink='#1a1a1a';
  } else if(mode==='bound'){
    defs+=frOrbGemDefs(uid,fill)+frOrbGoldDefs(uid);
    base='<path d="'+d+'" fill="url(#'+uid+'gem)"/><path d="'+d+'" fill="url(#'+uid+'gemlo)"/>';
    top='<path d="'+d+'" fill="url(#'+uid+'gemsheen)"/><path d="'+d+'" fill="url(#'+uid+'gemhi)"/>'
      +'<path d="'+d+'" fill="none" stroke="#fff" stroke-opacity=".55" stroke-width="4.1" stroke-linejoin="round" transform="translate(-1.1 -1.1)"/>'
      +'<path d="'+d+'" fill="none" stroke="#2a1a06" stroke-opacity=".75" stroke-width="4.1" stroke-linejoin="round" transform="translate(1.1 1.1)"/>'
      +'<path d="'+d+'" fill="none" stroke="url(#'+uid+'gold)" stroke-width="1.9" stroke-linejoin="round"/>'
      +'<path d="'+d+'" fill="none" stroke="#fff" stroke-opacity=".3" stroke-width=".45" stroke-linejoin="round" transform="translate(-.5 -.5)"/>'
      +frOrbBrackets(k,uid);
  } else if(mode==='wax'){
    var wax={atk:['#d9494f','#a51d27','#5e0b12'],hp:['#f1c866','#c7922c','#6e4a0f'],arc:['#5aa0e0','#2a6fb0','#123a66'],rng:['#7cc48a','#3f8a52','#1e4a2a']}[k];
    defs+='<radialGradient id="'+uid+'wax" cx="38%" cy="32%" r="70%"><stop offset="0" stop-color="'+frMix(wax[0],'#fff',.25)+'"/><stop offset=".6" stop-color="'+wax[1]+'"/><stop offset="1" stop-color="'+frMix(wax[2],'#000',.25)+'"/></radialGradient>';
    base='<path d="'+d+'" fill="url(#'+uid+'wax)"/>';
    top='<path d="'+d+'" fill="none" stroke="url(#'+uid+'wax)" stroke-width="3" stroke-linejoin="round"/>'
      +'<path d="'+d+'" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width="1.6" stroke-linejoin="round" transform="translate(-.8 -.8)"/>'
      +'<path d="'+d+'" fill="none" stroke="#000" stroke-opacity=".4" stroke-width="1.6" stroke-linejoin="round" transform="translate(.8 .8)"/>'
      +'<path d="'+d+'" fill="none" stroke="#000" stroke-opacity=".3" stroke-width="1.2" stroke-linejoin="round" '+sc(.78)+'/>'
      +'<path d="'+d+'" fill="none" stroke="#fff" stroke-opacity=".25" stroke-width="1.2" stroke-linejoin="round" transform="translate(18.2 18.2) scale(.78) translate(-18.2 -18.2)"/>';
    ink=wax[2];
  } else if(mode==='glass'){
    base='<use href="#orbnoise-glass-'+k+'"/>';
    top='<path d="'+d+'" fill="none" stroke="#000" stroke-opacity=".55" stroke-width="4.6" stroke-linejoin="round"/><path d="'+d+'" fill="none" stroke="#2a2c31" stroke-width="3.4" stroke-linejoin="round"/>'
      +'<path d="'+d+'" fill="none" stroke="#868a92" stroke-width=".9" stroke-linejoin="round" transform="translate(-.7 -.7)"/>';
  } else if(mode==='stars'){
    /* the colour at three quarters with a galaxy of its own colour a quarter larger than the icon turning under everything;
       the Cosmos back's thick galaxy turning a step above in the colour's pale (an HTML layer clipped to the shape); a few
       stars a step above that; the Arcane glass outline without its shine, the pale galaxy along its band as the highlight */
    c=fill; var pale=frMix(tint||c,'#fff',.6);
    defs+='<clipPath id="'+uid+'sclip"><path d="'+d+'"/></clipPath>'
      +'<clipPath id="'+uid+'obb" clipPathUnits="objectBoundingBox"><path d="'+d+'" transform="scale('+(1/38).toFixed(6)+')"/></clipPath>'
      +frRingClip(uid,d);
    halo=['halo',c];
    base='<path d="'+d+'" fill="'+c+'" fill-opacity=".75"/>';
    var galaxy='<div class="o-gc" style="clip-path:url(#'+uid+'obb)">'+frGalDiv(pale,false)+'</div>';
    var stars=[[10.5,10,1.4],[27.5,8.5,1.0],[8.5,26,.9],[29,27.5,1.2],[19.5,31,.8],[24,14,.6]].map(function(s){ return frStar4(s[0],s[1],s[2]); }).join('')
      +[[14,7],[31,19],[7,18],[16,33],[26,33],[12,15]].map(function(p){ return '<circle cx="'+p[0]+'" cy="'+p[1]+'" r=".35" fill="#fff" fill-opacity=".8"/>'; }).join('');
    mids=[['html',galaxy],'<g clip-path="url(#'+uid+'sclip)">'+stars+'</g>'];
    top='<path d="'+d+'" fill="none" stroke="#06080e" stroke-opacity=".86" stroke-width="4.4" stroke-linejoin="round"/>'
      +frSoftPath(d,c,6,2.2,.8,6,'stroke-linejoin="round"')
      +frSoftPath(d,c,2.8,.8,1.0,4,'stroke-linejoin="round"');
    mids.push(['ring','<div class="o-gc" style="clip-path:url(#'+uid+'ring)">'+frGalDiv(frMix(tint||c,'#fff',.85),false)+'</div>']);
    ink=frMix(c,'#000',.6);
  } else {
    base='<path d="'+d+'" fill="url(#'+uid+'fk)"/>'; top=frOrbStroke(d,uid);
  }
  return {defs:defs,base:base,top:top,ink:ink,mids:mids,halo:halo};
}
/* the Stars halo: the galaxy in the icon's colour, a quarter larger than the icon, not cut to any box; the combined stats
   split it at the middle, each half in a wide window so the arms still reach past the icon */
function frHaloHtml(halo){
  if(!halo) return '';
  if(halo[0]==='halo') return '<div class="o-halo">'+frHaloImg(halo[1])+'</div>';
  var top='<div class="o-hw" style="left:-100%;top:-100%;width:300%;height:150%"><div class="o-hf" style="left:33.333%;top:66.667%;width:33.333%;height:66.667%">'+frHaloImg(halo[1])+'</div></div>';
  var bot='<div class="o-hw" style="left:-100%;top:50%;width:300%;height:150%"><div class="o-hf" style="left:33.333%;top:-33.333%;width:33.333%;height:66.667%">'+frHaloImg(halo[2])+'</div></div>';
  return '<div class="o-halo">'+top+bot+'</div>';
}
function frIdSuffix(markup,uid,sfx){
  return markup.split('id="'+uid).join('id="'+uid+sfx).split('url(#'+uid).join('url(#'+uid+sfx);
}
function frIsTuple(m){ return Array.isArray(m); }
/* one stat in one style, as the layers of a .m-orb-slot */
function frOrbSvg(type,value,uid,mode){
  var s=String(value==null?'':value), isStar=s.trim()==='*', n=s.length;
  var fs=(isStar?26*0.75:(n>2?11:n>1?13:15))*1.5625, textY=isStar?26:19;
  var defs,base,top,ink,mids,halo,i;
  if(FR_FUSED[type]){
    var k1=FR_FUSED[type], tint=mode==='stars'?frMix(frOrbFill(k1),frOrbFill('arc'),.5):null;
    var P1=frOrbParts(k1,uid+'a',mode,tint), P2=frOrbParts('arc',uid+'b',mode,tint);
    defs=P1.defs+P2.defs+'<clipPath id="'+uid+'top"><rect x="-20" y="-20" width="78" height="39"/></clipPath><clipPath id="'+uid+'bot"><rect x="-20" y="19" width="78" height="39"/></clipPath>'
      +'<linearGradient id="'+uid+'fade" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset=".39" stop-color="#fff"/><stop offset=".61" stop-color="#000"/><stop offset="1" stop-color="#000"/></linearGradient>'
      +'<mask id="'+uid+'blend" maskUnits="userSpaceOnUse" x="-40" y="-40" width="118" height="118"><rect x="-40" y="-40" width="118" height="40" fill="#fff"/><rect x="-40" width="118" height="38" fill="url(#'+uid+'fade)"/></mask>'
      +'<linearGradient id="'+uid+'fadeInv" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000"/><stop offset=".39" stop-color="#000"/><stop offset=".61" stop-color="#fff"/><stop offset="1" stop-color="#fff"/></linearGradient>'
      +'<mask id="'+uid+'blendInv" maskUnits="userSpaceOnUse" x="-40" y="-40" width="118" height="118"><rect x="-40" width="118" height="38" fill="url(#'+uid+'fadeInv)"/><rect x="-40" y="38" width="118" height="40" fill="#fff"/></mask>'
      +'<linearGradient id="'+uid+'grad" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+P1.ink+'"/><stop offset=".3" stop-color="'+P1.ink+'"/><stop offset=".7" stop-color="'+P2.ink+'"/><stop offset="1" stop-color="'+P2.ink+'"/></linearGradient>';
    base='<g mask="url(#'+uid+'blendInv)">'+P2.base+'</g><g mask="url(#'+uid+'blend)">'+P1.base+'</g>';
    halo=frIsTuple(P1.halo)?['halo2',P1.halo[1],P2.halo[1]]:'';
    if(mode==='arcane'||mode==='stars') top='<g mask="url(#'+uid+'blendInv)">'+P2.top+'</g><g mask="url(#'+uid+'blend)">'+P1.top+'</g>';
    else top='<g clip-path="url(#'+uid+'top)">'+P1.top+'</g><g clip-path="url(#'+uid+'bot)">'+P2.top+'</g>';
    mids=[];
    for(i=0;i<P1.mids.length;i++) mids.push(frIsTuple(P1.mids[i])?null:'<g mask="url(#'+uid+'blendInv)">'+P2.mids[i]+'</g><g mask="url(#'+uid+'blend)">'+P1.mids[i]+'</g>');
    if(mode==='stars'||mode==='gem') defs+='<clipPath id="'+uid+'fobb" clipPathUnits="objectBoundingBox"><path d="'+FR_ORB_TOP[k1]+'" transform="scale('+(1/38).toFixed(6)+')"/><path d="'+FR_ORB_ARC_BOTTOM+'" transform="scale('+(1/38).toFixed(6)+')"/></clipPath>';
    if(mode==='gem') mids[0]=['sheen','<div class="o-gc" style="clip-path:url(#'+uid+'fobb)">'+frGalDiv('#ffffff',true)+'</div>'];
    if(mode==='stars'){
      mids[0]=['html','<div class="o-gc" style="clip-path:url(#'+uid+'fobb)">'+frGalDiv(frMix(tint,'#fff',.6),false)+'</div>'];
      mids[2]=['ring','<div class="o-gc" style="clip-path:inset(0 0 50% 0)">'+P1.mids[2][1]+'</div><div class="o-gc" style="clip-path:inset(50% 0 0 0)">'+P2.mids[2][1]+'</div>'];
    }
    ink='url(#'+uid+'grad)';
  } else {
    var P=frOrbParts(FR_ORB_KIND[type]||'arc',uid,mode,null);
    defs=P.defs; base=P.base; top=P.top; ink=P.ink; mids=P.mids; halo=P.halo;
  }
  var glow='';
  if(mode==='arcane'){
    var gc;
    if(FR_FUSED[type]){ var c1=frOrbFill(FR_FUSED[type]), c2=frOrbFill('arc');
      defs+='<linearGradient id="'+uid+'nglowc" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+c1+'"/><stop offset=".3" stop-color="'+c1+'"/><stop offset=".7" stop-color="'+c2+'"/><stop offset="1" stop-color="'+c2+'"/></linearGradient>';
      gc='url(#'+uid+'nglowc)'; }
    else gc=frOrbFill(FR_ORB_KIND[type]||'arc');
    var gtext=function(sw,a){ return '<text x="19" y="'+textY+'" text-anchor="middle" dominant-baseline="'+(isStar?'middle':'central')+'" font-family="Book Antiqua,Georgia,serif" font-weight="700" font-size="'+fs+'" fill="'+gc+'" stroke="'+gc+'" stroke-width="'+f2(sw)+'" stroke-linejoin="round" opacity="'+a.toFixed(3)+'">'+e(s)+'</text>'; };
    glow=frSoftHalo(gtext,2.4,.85,6,4,true);
  }
  var numeral=glow+'<text x="19" y="'+textY+'" text-anchor="middle" dominant-baseline="'+(isStar?'middle':'central')+'" font-family="Book Antiqua,Georgia,serif" font-weight="700" font-size="'+fs+'" fill="#fff" style="paint-order:stroke;stroke:'+ink+';stroke-width:2.75px;stroke-linejoin:round">'+e(s)+'</text>';
  top=top+numeral;
  var orbn=1; mids.forEach(function(m){ if(!(frIsTuple(m)&&(m[0]==='ring'||m[0]==='sheen'))) orbn++; });
  var midHtml=mids.map(function(m,i){
    if(frIsTuple(m)&&m[0]==='ring') return '<div class="o-mid o-ring" style="--orbN:'+orbn+'">'+m[1]+'</div>';
    if(frIsTuple(m)&&m[0]==='sheen') return '<div class="o-mid o-sheen" style="--orbN:'+orbn+'">'+m[1]+'</div>';
    if(frIsTuple(m)) return '<div class="o-mid o-mid'+(i+1)+' o-gal">'+m[1]+'</div>';
    return '<svg class="o-mid o-mid'+(i+1)+'" width="38" height="38" viewBox="0 0 38 38"><defs>'+frIdSuffix(defs,uid,'m'+i)+'</defs>'+frIdSuffix(m,uid,'m'+i)+'</svg>';
  }).join('');
  return frHaloHtml(halo)+'<svg class="o-base" width="38" height="38" viewBox="0 0 38 38"><defs>'+defs+'</defs>'+base+'</svg>'+midHtml
    +'<svg class="o-top" width="38" height="38" viewBox="0 0 38 38" style="overflow:visible;--orbN:'+orbn+'"><defs>'+frIdSuffix(defs,uid,'t')+'</defs>'+frIdSuffix(top,uid,'t')+'</svg>';
}
/* ---------------------------------------------------------------- the measured face: the geometry a frame draws round
   G: inner, name, type, art, info, rules (or null), rsecs [{r, col}], manas [[cx,cy,r]], orient (h|v), essence ('', boxed,
   bare), poly {el, before, after, panel} (the type line's clip polygons as points), all in the card's own 340x476 space. */
function frTools(G){
  var t={G:G};
  t.boxD=function(name,inset,r){ return frRectD(G[name],inset||0,r==null?FR_R_BOX:r); };
  t.secD=function(i,inset,r){ return frRectD(G.rsecs[i].r,inset||0,r==null?5:r); };
  t.hasRules=function(){ return !!G.rules; };
  t.identSections=function(){ var out=[]; G.rsecs.forEach(function(s,i){ if(s.col) out.push({i:i,r:s.r,col:s.col}); }); return out; };
  /* the lines between plain sections, where the site draws its 1px rule: a path per gap */
  t.dividers=function(){
    var out=[];
    for(var i=1;i<G.rsecs.length;i++){
      var a=G.rsecs[i-1], b=G.rsecs[i]; if(a.col||b.col) continue;
      var r=b.r;
      out.push(G.orient==='h'?'M '+f2(r[0]+.5)+','+f2(r[1])+' V '+f2(r[1]+r[3]):'M '+f2(r[0])+','+f2(r[1]+.5)+' H '+f2(r[0]+r[2]));
    }
    return out;
  };
  t.manaRings=function(){ return G.manas||[]; };
  t.identClipD=function(){ return 'M 0,0 H '+FR_W+' V '+FR_H+' H 0 Z '+t.identSections().map(function(s){ return t.secD(s.i,0,5); }).join(' '); };
  /* markup clipped to the card minus the identity sections: a box whose sections wear their own frames has its outline drawn round them */
  t.aroundSections=function(markup,idp){
    if(!t.identSections().length) return markup;
    return '<defs>'+frClip(idp+'iclip',t.identClipD(),true)+'</defs><g clip-path="url(#'+idp+'iclip)">'+markup+'</g>';
  };
  t.inIdentSection=function(x,y){ return t.identSections().some(function(s){ var r=s.r; return r[0]<=x&&x<=r[0]+r[2]&&r[1]<=y&&y<=r[1]+r[3]; }); };
  t.typeD=function(which,dy){ var pts=G.poly[which]||G.poly.el; return pts&&pts.length?frPolyD(pts,dy||0):t.boxD('type',0,0); };
  t.tlClip=function(idp){ var nb=G.name; return frClip(idp+'tlclip','M 0,'+f2(nb[1]+nb[3]+1.2)+' H '+FR_W+' V '+FR_H+' H 0 Z'); };
  return t;
}
/* the site's own frame gradient (frameOf) as an SVG gradient on the sheet, for the Default frame's art band */
function frSiteFrameGrad(id,fcols){
  var cols=(fcols||[]).filter(function(c){ return FRAME_ORDER.indexOf(c)>=0; });
  var narrow=function(sh,ce){ return +(ce+(sh-ce)*0.75).toFixed(2); };
  var hl=function(pos,hw){ hw=hw||4.5; var q=+(hw*0.444).toFixed(2); return [[pos-hw,'#ffe1ef'],[pos-q,'#fff7d8'],[pos,'#ffffff'],[pos+q,'#d8fff1'],[pos+hw,'#dde7ff']]; };
  var st=[];
  if(!cols.length) st=[[0,'#9a938a'],[narrow(30,46),'#c5bfb4']].concat(hl(46),[[narrow(62,46),'#7d766c'],[100,'#9a938a']]);
  else if(cols.length===1){
    if(cols[0]==='grey') st=[[0,'#4a4a4a'],[narrow(26,46),'#6e6e6e']].concat(hl(46),[[narrow(62,46),'#3a3a3a'],[100,'#4a4a4a']]);
    else { var h=fillHex(cols[0]); st=[[0,h],[narrow(26,46),shadeRGB(h,30)]].concat(hl(46),[[narrow(62,46),shadeRGB(h,-42)],[100,h]]); }
  } else {
    var n=cols.length, base=cols.map(function(x,i){ return {c:fillHex(x),p:Math.round(i*(100/(n-1)))}; }), HW=4.5, centre=46;
    for(var gi=0;gi<base.length-1;gi++){
      if(base[gi].p<=centre&&centre<=base[gi+1].p){
        var lo=base[gi].p+1+HW, hi=base[gi+1].p-1-HW;
        if(hi<lo){ centre=(base[gi].p+base[gi+1].p)/2; HW=Math.max(1,(base[gi+1].p-base[gi].p)/2-1); }
        else centre=Math.min(Math.max(centre,lo),hi);
        break;
      }
    }
    var put=false;
    base.forEach(function(b,i){ if(i>0&&base[i-1].p<centre&&b.p>=centre){ st=st.concat(hl(centre,HW)); put=true; } st.push([b.p,b.c]); });
    if(!put){ var tail=st.pop(); st=st.concat(hl(centre,HW)); st.push(tail); }
  }
  return frLG(id,st.map(function(s){ return [(s[0]/100).toFixed(4),s[1]]; }));
}
/* ---------------------------------------------------------------- the frames
   Each: skin(col,cols) - the variables set on .mcard; layers(col,uid,t,fcols,cols) - [[z, markup, depth]] decoration layers;
   extras(col,cols) - markup under the face; secPin(sc) - an identity section's border material in its own colour; secStyle(sc) -
   more variables for a section; sheetAll - every layer of a box's background painted from the card-wide sheet. Colours are
   names from FR_COLS: col the card's first, cols all of them, blended along the sheet by frPalAt where a part takes the colour. */
var FR_DESIGNS={};
/* Default: the frame the catalog draws today, on the shared layer layout, with the art outlined the way the text box is */
FR_DESIGNS.classic={orb:'app',
  skin:function(col){ return {}; },
  layers:function(col,uid,t,fcols){
    var idp=uid, defs=frSiteFrameGrad(idp+'fr',fcols);
    var z5='<defs>'+defs+'</defs><g class="fr">'+frPinBand(t.boxD('art',-.75,FR_R_ART+.75),t.boxD('art',2,FR_R_ART-2),t.boxD('art',4.75,FR_R_ART-4.75),idp)+'</g>';
    return [[5,z5,1]];
  }};
/* Inlaid: dark iron and parchment; the colour is an enamel inlay line set into the border and into every box */
function frInlay(d,idp,w){
  if(w==null) w=1.6;
  return '<path d="'+d+'" fill="none" stroke="#141418" stroke-width="'+f2(w+1.6)+'"/><path d="'+d+'" fill="none" stroke="url(#'+idp+'gold)" stroke-width="'+f2(w+.9)+'"/>'
    +'<path d="'+d+'" fill="none" stroke="#141418" stroke-opacity=".9" stroke-width="'+f2(w+.2)+'"/><path d="'+d+'" fill="none" stroke="url(#'+idp+'enam)" stroke-width="'+f2(w-.3)+'"/>'
    +'<path d="'+d+'" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width=".4" transform="translate(-.35 -.35)"/>';
}
/* the Inlaid boxes' fill: the parchment at 55% over the card-wide iron, stop by stop, 15% brighter */
FR_DESIGNS.inlaid={orb:'stone',sheetAll:true,
  skin:function(col,cols){ var P=frPalAt(cols);
    return {'--frame':frIronCss(),'--pin':frIronCss(),'--frame-dark':'linear-gradient(180deg,'+frMix(P(FR_DARK,0),P(FR_DEEP,0),.22)+','+frMix(P(FR_DARK,1),'#000',.3)+')',
      '--ink-dark':'#0c0d10','--m-panel':'rgba(255,251,240,.55)','--m-ink':'#1c140a','--m-meta-ink':'#f0e6d2','--m-bevel':'rgba(255,255,255,.35)','--m-rule':'rgba(90,60,20,.4)'};
  },
  layers:function(col,uid,t,fcols,cols){
    var idp=uid, m=FR_PAD/2;
    var defs=frGoldGrad(idp+'gold')+frEnamelGrad(idp+'enam',cols);
    var z2='<defs>'+defs+'</defs><g class="bx">'+frInlay(t.boxD('name',2),idp,1.3)+'<path d="'+t.typeD('before')+'" fill="none" stroke="url(#'+idp+'gold)" stroke-width=".7" stroke-opacity=".9"/></g>';
    var z5='<defs>'+defs+'</defs><g class="fr">'+frInlay(t.boxD('art',-1.9,FR_R_ART+1.9),idp,1.3)+'</g>';
    var z7='<defs>'+defs+'</defs><g class="ln">'+frInlay(frCardD(m),idp,1.7)+'</g>';
    if(t.hasRules()) z7+='<g class="bx">'+t.aroundSections(frInlay(t.boxD('rules',2),idp,1.3),idp)+'</g>';
    var sdefs='', sbody='';
    t.identSections().forEach(function(s){ var ip=idp+'s'+s.i; sdefs+=frGoldGrad(ip+'gold')+frEnamelGrad(ip+'enam',[s.col]); sbody+=frInlay(t.secD(s.i,1.5,5),ip,1.1); });
    t.dividers().forEach(function(d){ sbody+=frGoldLine(d,.6,idp,null,.4); });
    t.manaRings().forEach(function(rg){ sbody+=frInlay(frCircleD(rg[0],rg[1],rg[2]+2),idp,1.5); });
    if(sbody) z7+='<defs>'+sdefs+'</defs><g class="bx">'+sbody+'</g>';
    return [[7,z2,2],[5,z5,1],[7,z7,3]];
  }};
/* Arcanic: smoky steel, a luminous channel of the colour round the border and inside every box, dark glass panels */
var FR_ARC_LUM=1.5;
function frArcGlow(d,idp,w){ return frGlowPath(d,idp,w*2,FR_ARC_LUM,'lumb'); }
FR_DESIGNS.arcane={orb:'arcane',
  skin:function(col,cols){
    var J=frJewelAt(cols), j=J(.5), g='rgba(6,8,14,.86)';
    return {'--frame':frSteelCss(),'--pin':frGlassCss(g),'--m-panel':'rgba(6,8,14,0)',
      '--frame-dark':'radial-gradient(ellipse 70% 60% at 50% 0%,'+frRgba(J(0),.34)+',transparent 70%),radial-gradient(ellipse 60% 50% at 50% 100%,'+frRgba(J(1),.2)+',transparent 70%),#07080c',
      '--ink-dark':'#000','--m-ink':'#f0ead8','--m-meta-ink':'#f0ead8','--m-bevel':'rgba(255,255,255,.08)','--m-rule':'rgba(240,234,216,.18)','--jewel':j};
  },
  layers:function(col,uid,t,fcols,cols){
    var idp=uid, m=FR_PAD/2;
    var defs=frSteelGrad(idp+'steel')+frLumGrad(idp+'lum',cols)+frLumcGrad(idp+'lumc',cols)+frLumbGrad(idp+'lumb',cols)+frClip(idp+'ring',frRingD(),true);
    var ab=t.boxD('art',-3.6,FR_R_ART+3.6);
    var z5='<defs>'+defs+'</defs><g class="fr"><path d="'+ab+'" fill="none" stroke="#000" stroke-width="8"/><path d="'+ab+'" fill="none" stroke="url(#'+idp+'steel)" stroke-width="4.8"/>'+frArcGlow(t.boxD('art',-.2,FR_R_ART+.2),idp,.8)+'</g>';
    var z2='<defs>'+defs+'</defs><g class="bx">'+frArcGlow(t.boxD('name',2.2),idp,.8)+frArcGlow(t.typeD('panel'),idp,.6)+'</g>';
    var z7='<defs>'+defs+'</defs><g class="ln"><g clip-path="url(#'+idp+'ring)">'+frArcGlow(frCardD(m),idp,1.0)+'</g></g>';
    if(t.hasRules()) z7+='<g class="bx">'+t.aroundSections(frArcGlow(t.boxD('rules',2.2),idp,.8),idp)+'</g>';
    var sdefs='', sbody='';
    t.identSections().forEach(function(s){ var ip=idp+'s'+s.i; sdefs+=frLumGrad(ip+'lum',[s.col])+frLumcGrad(ip+'lumc',[s.col])+frLumbGrad(ip+'lumb',[s.col]); sbody+=frArcGlow(t.secD(s.i,1.5,5),ip,.6); });
    t.dividers().forEach(function(d){ sbody+=frArcGlow(d,idp,.4); });
    t.manaRings().forEach(function(rg){ var c=frCircleD(rg[0],rg[1],rg[2]+2);
      sbody+='<path d="'+c+'" fill="none" stroke="#000" stroke-width="6.5"/><path d="'+c+'" fill="none" stroke="url(#'+idp+'steel)" stroke-width="4"/>'+frArcGlow(frCircleD(rg[0],rg[1],rg[2]+.4),idp,.7); });
    if(sbody) z7+='<defs>'+sdefs+'</defs><g class="bx">'+sbody+'</g>';
    return [[5,z5,1],[7,z2,2],[7,z7,3]];
  }};
/* Stellar: dark glass lit only by outlines of the colour's metal with its glow line, over a field of small stars */
var FR_ST_LINE=2.0;
function frStEdge(dMetal,dGlow,idp){
  return '<path d="'+dMetal+'" fill="none" stroke="url(#'+idp+'fr)" stroke-width="'+FR_ST_LINE+'"/>'+frSoftPath(dGlow,'url(#'+idp+'lum)',2.4,2.2,.55)
    +'<path d="'+dGlow+'" fill="none" stroke="url(#'+idp+'lumc)" stroke-width=".7"/>';
}
function frStarfield(cols,G){
  var P=frPalAt(cols), r=frRandom(FR_COLS.indexOf(cols[0])*7919+11), out=[], ix=G.inner[0], iy=G.inner[1], iw=G.inner[2], ih=G.inner[3], sizes=[.45,.6,.75,.9,1.1,1.5], i;
  /* a tinted star takes the colour at its place along the sheet */
  for(i=0;i<110;i++){ var x=ix+2+r()*(iw-4), y=iy+2+r()*(ih-4), s=sizes[Math.floor(r()*sizes.length)], c=r()<.18?P(FR_PASTEL,((x-ix)/iw+(y-iy)/ih)/2):'#fff';
    out.push('<g opacity="'+(.2+.7*r()).toFixed(2)+'">'+frStar(x,y,s,c,4,.3)+'</g>'); }
  for(i=0;i<160;i++){ out.push('<circle cx="'+f1(ix+2+r()*(iw-4))+'" cy="'+f1(iy+2+r()*(ih-4))+'" r=".3" fill="#fff" fill-opacity="'+(.15+.5*r()).toFixed(2)+'"/>'); }
  return out.join('');
}
FR_DESIGNS.stellar={orb:'stars',
  skin:function(col,cols){
    var g='rgba(8,10,16,.72)', J=frJewelAt(cols);
    return {'--frame':'linear-gradient(#0b0d16,#0b0d16)',
      '--frame-dark':'radial-gradient(ellipse 80% 50% at 50% 28%,'+frRgba(J(0),.16)+',transparent 70%),radial-gradient(ellipse 70% 40% at 50% 100%,'+frRgba(J(1),.10)+',transparent 70%),linear-gradient(180deg,#0d101e,#05060f)',
      '--pin':frGlassCss(g),'--m-panel':'rgba(8,10,16,0)','--ink-dark':g,'--m-ink':'#f0ead8','--m-meta-ink':'#f5f0e4','--m-bevel':'rgba(255,255,255,.12)','--m-rule':'rgba(240,234,216,.22)'};
  },
  layers:function(col,uid,t,fcols,cols){
    var idp=uid, G=t.G, L=FR_ST_LINE;
    var defs=frFrameGrad(idp+'fr',cols)+frLumGrad(idp+'lum',cols)+frLumcGrad(idp+'lumc',cols)+t.tlClip(idp)+frClip(idp+'field',frInnerD()+' '+t.boxD('art',0,FR_R_ART),true);
    var z1='<defs>'+defs+'</defs><g class="fr"><g clip-path="url(#'+idp+'field)">'+frStarfield(cols,G)+'</g></g>';
    var z5='<defs>'+defs+'</defs><g class="fr">'+frStEdge(t.boxD('art',-1.3,FR_R_ART+1.3),t.boxD('art',.4,FR_R_ART-.4),idp)+'</g>';
    var z2='<defs>'+defs+'</defs><g class="bx">'+frStEdge(t.boxD('name',L/2+.3),t.boxD('name',L+1.0),idp)+'<g clip-path="url(#'+idp+'tlclip)">'+frStEdge(t.typeD('el'),t.typeD('after'),idp)+'</g></g>';
    var z7='<defs>'+defs+'</defs><g class="ln">'+frStEdge(frCardD(1.0),frCardD(2.6),idp)+'</g><g class="fr ln">'+frStEdge(frInnerD(-1.0),frInnerD(-2.6),idp)+'</g>';
    if(t.hasRules()) z7+='<g class="bx">'+t.aroundSections(frStEdge(t.boxD('rules',L/2+.3),t.boxD('rules',L+1.0),idp),idp)+'</g>';
    var sdefs='', sbody='';
    t.identSections().forEach(function(s){ var ip=idp+'s'+s.i; sdefs+=frFrameGrad(ip+'fr',[s.col])+frLumGrad(ip+'lum',[s.col])+frLumcGrad(ip+'lumc',[s.col]); sbody+=frStEdge(t.secD(s.i,L/2+.2,5),t.secD(s.i,L+.8,5),ip); });
    t.dividers().forEach(function(d){ sbody+='<path d="'+d+'" fill="none" stroke="url(#'+idp+'fr)" stroke-width="1"/><path d="'+d+'" fill="none" stroke="url(#'+idp+'lumc)" stroke-width=".5" stroke-opacity=".8"/>'; });
    t.manaRings().forEach(function(rg){ sbody+=frStEdge(frCircleD(rg[0],rg[1],rg[2]+3.2),frCircleD(rg[0],rg[1],rg[2]+1.2),idp); });
    if(sbody) z7+='<defs>'+sdefs+'</defs><g class="bx">'+sbody+'</g>';
    return [[-1,z1,1],[5,z5,1],[7,z2,2],[7,z7,3]];
  }};
/* Stone: carved stone in the card's colour, runes cut into the border, a chiselled art window with a crystal line */
var FR_RUNES=['M1,0 V6 M1,1.5 L4,0 M1,3 L4,1.5','M.5,0 V6 L3.5,2 V6','M1,0 V6 M1,1.5 L3.5,3 L1,4.5','M3.5,0 L1,3 L3.5,6','M.5,.5 L3.5,5.5 M3.5,.5 L.5,5.5',
  'M.5,0 V6 M3.5,0 V6 M.5,2.5 L3.5,4','M2,0 V6 M.5,2 L3.5,4','M2,0 V6','M3.5,0 L1,2 L3.5,4 L1,6','M2,0 V6 M0,2 L2,0 L4,2','M1,6 V0 L2,2 L3.5,0 V6'];
function frRuneBand(){
  var out=[], i=0, m=FR_PAD/2, step=10.5, x, y;
  var place=function(x,y,rot){ var d=FR_RUNES[i%FR_RUNES.length]; i++; out.push('<g transform="translate('+f1(x)+' '+f1(y)+') rotate('+rot+') translate(-2 -3)">'+frCarved(d,.5,.34,.7,.45)+'</g>'); };
  for(x=26;x<FR_W-26;x+=step){ place(x,m,0); place(x,FR_H-m,180); }
  for(y=26;y<FR_H-26;y+=step){ place(m,y,-90); place(FR_W-m,y,90); }
  return out.join('');
}
FR_DESIGNS.stone={orb:'stone',
  skin:function(col,cols){
    var st=frStoneCss(cols);
    return {'--frame':st,'--pin':st,'--frame-dark':'linear-gradient(rgba(0,0,0,.34),rgba(0,0,0,.34)),'+st,
      '--ink-dark':'#2b2a2e','--m-panel':'rgba(224,210,180,.92)','--m-ink':'#2a2219','--m-meta-ink':'#ebe4d4','--m-bevel':'rgba(255,255,255,.40)','--m-rule':'rgba(60,40,20,.35)'};
  },
  secPin:function(sc){ return frTexCss('stone-'+sc.toLowerCase()); },
  layers:function(col,uid,t,fcols,cols){
    var idp=uid, G=t.G, a=G.art;
    var defs=frLumGrad(idp+'lum',cols)+frLumcGrad(idp+'lumc',cols)+frClip(idp+'ic',frInnerD())+frClip(idp+'ac',t.boxD('art',0,FR_R_ART));
    var z1='<defs>'+defs+'</defs><g class="fr"><g clip-path="url(#'+idp+'ic)">'+frSoftPath(frInnerD(-3),'#000',12,5,.75)+'</g>'+frRecess(frInnerD(),idp+'ic',1.1,.6,.35,1.6)+'</g>'
      +'<g class="bx">'+(t.hasRules()?frCarved(t.boxD('rules',-2.2),.45,.3,.7,.45):'')+frCarved(t.boxD('name',-2.2),.45,.3,.7,.45)+'</g>';
    var z5='<defs>'+defs+'</defs><g class="fr"><g clip-path="url(#'+idp+'ac)">'+frSoftPath(frRR(a[0]-4,a[1]-4,a[2]+8,a[3]+8,FR_R_ART+4),'#000',12,5,.8)+'</g>'
      +frRecess(t.boxD('art',0,FR_R_ART),idp+'ac',1.2,.7,.3,1.6)+frGlowPath(t.boxD('art',-1.15,FR_R_ART+1.15),idp,1.8,1,'lumc',3,1.0)+'</g>';
    var z7='<defs>'+defs+'</defs><g class="fr ln">'+frRuneBand()+'</g><g class="ln">'+frRaised(frCardD(1.0),.7,.55,.45,1.1)+frRaised(frInnerD(-.6),.6,.5,.4,.9)+'</g>';
    var sdefs='', sbody='';
    t.identSections().forEach(function(s){ var ip=idp+'s'+s.i; sdefs+=frLumGrad(ip+'lum',[s.col])+frLumcGrad(ip+'lumc',[s.col]);
      sbody+=frCarved(t.secD(s.i,-1.2,5),.45,.3,.7,.45)+frGlowPath(t.secD(s.i,1.5,5),ip,1.1,1,'lumc',3,.8); });
    t.dividers().forEach(function(d){ sbody+=frCarved(d,.45,.3,.7,.45); });
    t.manaRings().forEach(function(rg){ sbody+=frCarved(frCircleD(rg[0],rg[1],rg[2]+5.2),.45,.3,.7,.45)+frGlowPath(frCircleD(rg[0],rg[1],rg[2]+2),idp,1.6,1,'lumc',3,1.0); });
    if(sbody) z7+='<defs>'+sdefs+'</defs><g class="bx">'+sbody+'</g>';
    return [[-1,z1,1],[5,z5,1],[7,z7,3]];
  }};
/* Scroll: parchment, a band of the card's colour round the border in the wax seals' gloss, the same wax as every box's outline */
function frClothStops(cols){ var P=frPalAt(cols); return [[0,P(FR_DEEP,0)],[.40,P(FR_MID,.4)],[.46,frMix(P(FR_MID,.46),'#fff',.45)],[.52,P(FR_MID,.52)],[1,P(FR_DEEP,1)]]; }
function frClothCss(cols){ return 'linear-gradient('+FR_A+','+frCssStops(frClothStops(cols))+')'; }
function frWaxEdges(dOut,dIn){
  return '<path d="'+dOut+'" fill="none" stroke="#fff" stroke-opacity=".32" stroke-width="1.2" transform="translate(-.5 -.5)"/>'
    +'<path d="'+dOut+'" fill="none" stroke="#000" stroke-opacity=".42" stroke-width="1.2" transform="translate(.5 .5)"/>'
    +'<path d="'+dIn+'" fill="none" stroke="#000" stroke-opacity=".3" stroke-width=".9"/>'
    +'<path d="'+dIn+'" fill="none" stroke="#fff" stroke-opacity=".28" stroke-width=".9" transform="translate(-.45 -.45)"/>';
}
function frFlourish(x,y,sx,sy){
  var c='#5a3a14', d='M0,8 C1,3 3,1 8,0 M1,6 C2,3 3.5,2 6,1.3 M2.4,4.6 C2.9,3.4 3.6,2.8 4.6,2.5';
  return '<g transform="translate('+f1(x)+' '+f1(y)+') scale('+sx+' '+sy+')"><path d="'+d+'" fill="none" stroke="'+c+'" stroke-opacity=".85" stroke-width=".7" stroke-linecap="round"/><circle cx="8.6" cy="0" r=".7" fill="'+c+'" fill-opacity=".85"/><circle cx="0" cy="8.6" r=".7" fill="'+c+'" fill-opacity=".85"/></g>';
}
/* the paper grain on the panels: one small tile (frames.css, --tex-scroll-grain) as a pattern, clipped to each panel */
function frGrain(idp,t){
  var u=frTexUrl('scroll-grain'); if(!u) return ['',''];
  var defs='<pattern id="'+idp+'grain" patternUnits="userSpaceOnUse" width="128" height="128"><image href="'+u+'" width="128" height="128"/></pattern>'
    +frClip(idp+'gname',t.boxD('name',4,3))+frClip(idp+'gtype',t.typeD('panel'));
  var g=function(rect,clipId){ return '<rect x="'+f2(rect[0])+'" y="'+f2(rect[1])+'" width="'+f2(rect[2])+'" height="'+f2(rect[3])+'" fill="url(#'+idp+'grain)" clip-path="url(#'+clipId+')" opacity=".85"/>'; };
  var body=g(t.G.name,idp+'gname')+g(t.G.type,idp+'gtype');
  if(t.hasRules()){ defs+=frClip(idp+'grules',t.boxD('rules',4,3)); body+=g(t.G.rules,idp+'grules'); }
  return [defs,body];
}
FR_DESIGNS.scroll={orb:'wax',
  skin:function(col,cols){
    var p=frTexCss('parchment');
    return {'--frame':p,'--frame-dark':'linear-gradient(rgba(110,80,40,.10),rgba(110,80,40,.10)),'+p,'--pin':frClothCss(cols),
      '--m-panel':'rgba(244,235,214,.95)','--ink-dark':'rgba(0,0,0,0)','--m-ink':'#2a1c0e','--m-meta-ink':'#4a3010','--m-bevel':'rgba(255,255,255,.3)','--m-rule':'rgba(90,60,20,.45)'};
  },
  secPin:function(sc){ return frClothCss([sc]); },
  layers:function(col,uid,t,fcols,cols){
    var idp=uid, m=FR_PAD/2, G=t.G;
    var defs=frLG(idp+'cloth',frClothStops(cols))+t.tlClip(idp);
    var bx=t.hasRules()?G.rules:G.art, x0=bx[0]+4, x1=bx[0]+bx[2]-4;
    if(G.orient==='v'&&G.rules){ x0=Math.min(G.art[0]+4,G.rules[0]+4); x1=Math.max(G.art[0]+G.art[2]-4,G.rules[0]+G.rules[2]-4); }
    var z1='<defs>'+defs+'<linearGradient id="'+idp+'curl" x1="0" y1="0" x2="1" y2="0"><stop offset="0" stop-color="#000" stop-opacity=".22"/><stop offset=".5" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".22"/></linearGradient></defs>'
      +'<g class="fr"><rect x="0" y="0" width="'+FR_W+'" height="'+FR_H+'" fill="url(#'+idp+'curl)"/>'+frSoftPath(frInnerD(-1),'#000',4,2,.45)+'</g>'
      +'<g class="bx"><path d="M '+f2(x0)+','+f2(G.info[1]-1)+' H '+f2(x1)+'" stroke="#5a3a14" stroke-opacity=".7" stroke-width=".6"/><path d="M '+f2(x0)+','+f2(G.info[1]+.6)+' H '+f2(x1)+'" stroke="#5a3a14" stroke-opacity=".5" stroke-width=".35"/></g>';
    var gr=frGrain(idp,t), fl='';
    if(t.hasRules()){ var r=G.rules;
      [[r[0]+6.5,r[1]+6.5,1,1],[r[0]+r[2]-6.5,r[1]+6.5,-1,1],[r[0]+6.5,r[1]+r[3]-6.5,1,-1],[r[0]+r[2]-6.5,r[1]+r[3]-6.5,-1,-1]].forEach(function(p){ if(!t.inIdentSection(p[0],p[1])) fl+=frFlourish(p[0],p[1],p[2],p[3]); }); }
    var z2='<defs>'+defs+gr[0]+'</defs>'+gr[1]+'<g class="bx">'+frWaxEdges(t.boxD('name',-.75),t.boxD('name',4.75,3))+'<g clip-path="url(#'+idp+'tlclip)">'+frWaxEdges(t.typeD('el'),t.typeD('panel'))+'</g>'+fl+'</g>';
    var z7='<defs>'+defs+'</defs><g class="ln"><path d="'+frCardD(m)+'" fill="none" stroke="url(#'+idp+'cloth)" stroke-width="'+f1(FR_PAD-1.2)+'"/>'+frWaxEdges(frCardD(0.6),frCardD(FR_PAD-.6))+'</g>';
    if(t.hasRules()) z7+='<g class="bx">'+t.aroundSections(frWaxEdges(t.boxD('rules',-.75),t.boxD('rules',4.75,3)),idp)+'</g>';
    var sbody='';
    t.identSections().forEach(function(s){ sbody+=frWaxEdges(t.secD(s.i,-.6,5),t.secD(s.i,3.6,2)); });
    t.dividers().forEach(function(d){ sbody+=frHair(d,.7,'#5a3a14',.65); });
    t.manaRings().forEach(function(rg){ sbody+=frWaxEdges(frCircleD(rg[0],rg[1],rg[2]+4.75),frCircleD(rg[0],rg[1],rg[2]-.75)); });
    if(sbody) z7+='<g class="bx">'+sbody+'</g>';
    return [[-1,z1,1],[7,z2,2],[7,z7,3]];
  }};
/* Leatherbound: dark leather, the Sevenfold halo in the card's colours as every box's border between gold hairlines, gold brackets, the Omnibus seme */
function frHaloStops(cols){ var P=frPalAt(cols); return [[0,P(FR_DARK,0)],[.2,P(FR_MID,.2)],[.4,P(FR_PASTEL,.4)],[.5,frMix(P(FR_PASTEL,.5),'#fff',.6)],[.6,P(FR_PASTEL,.6)],[.8,P(FR_MID,.8)],[1,P(FR_DARK,1)]]; }
function frHaloCss(cols){ return 'linear-gradient('+FR_A+','+frHaloStops(cols).map(function(s){ return s[1]+' '+Math.round(s[0]*100)+'%'; }).join(',')+')'; }
function frHairlines(ds,idp,w){ return ds.map(function(d){ return '<path d="'+d+'" fill="none" stroke="url(#'+idp+'gold)" stroke-width="'+(w==null?.7:w)+'"/>'; }).join(''); }
function frSeme(idp,t){
  var G=t.G, a=G.art, yFull, yZero;
  if(t.hasRules()&&G.orient==='h'&&!G.essence){ var r=G.rules; yFull=r[1]+r[3]/2; yZero=a[1]+a[3]; }
  else { yFull=a[1]+a[3]-60; yZero=yFull-66; }
  var step=13, sz=2.6, y0=Math.floor(yZero)-2;
  var dia=function(x,y){ return '<path d="M '+f1(x)+','+f1(y-sz)+' L '+f1(x+sz)+','+y+' L '+f1(x)+','+f1(y+sz)+' L '+f1(x-sz)+','+y+' Z"/>'; };
  var dot=function(x,y){ return '<circle cx="'+f1(x)+'" cy="'+f1(y)+'" r=".7"/>'; };
  var tile=dia(0,0)+dia(step,0)+dia(0,2*step)+dia(step,2*step)+dot(step/2,step/2)+dia(step/2,step)+dot(0,step+step/2)+dot(step,step+step/2);
  var defs=frGoldGrad(idp+'sgold',false)+'<linearGradient id="'+idp+'semefade" x1="0" y1="'+f2(yZero)+'" x2="0" y2="'+f2(yFull)+'" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#fff" stop-opacity="0"/><stop offset="1" stop-color="#fff"/></linearGradient>'
    +'<mask id="'+idp+'seme"><rect x="0" y="'+f2(yZero)+'" width="'+FR_W+'" height="'+f2(FR_H-yZero)+'" fill="url(#'+idp+'semefade)"/></mask>'
    +'<clipPath id="'+idp+'semeclip"><path d="'+frInnerD(0)+'"/></clipPath>'
    +'<pattern id="'+idp+'semetile" patternUnits="userSpaceOnUse" x="0" y="'+y0+'" width="'+step+'" height="'+(2*step)+'"><g fill="url(#'+idp+'sgold)" stroke="#2a1a06" stroke-opacity=".5" stroke-width=".3">'+tile+'</g></pattern>';
  var body='<g mask="url(#'+idp+'seme)" clip-path="url(#'+idp+'semeclip)"><rect x="0" y="'+(y0-sz-1)+'" width="'+FR_W+'" height="'+(FR_H-y0+sz+1)+'" fill="url(#'+idp+'semetile)"/></g>';
  return [defs,body];
}
FR_DESIGNS.sevenfold={orb:'coin',
  skin:function(col,cols){
    var L=frTexCss('leather');
    return {'--frame':L,'--frame-dark':'linear-gradient(rgba(0,0,0,.22),rgba(0,0,0,.22)),'+L,'--pin':frHaloCss(cols),'--m-panel':'rgba(22,13,6,.90)',
      '--ink-dark':'#1a1208','--m-ink':'#f0e6d2','--m-meta-ink':'#e8d9b0','--m-bevel':'rgba(255,255,255,.12)','--m-rule':'rgba(240,230,210,.22)'};
  },
  secPin:function(sc){ return frHaloCss([sc]); },
  layers:function(col,uid,t,fcols,cols){
    var idp=uid, P=frPalAt(cols);
    var defs=frGoldGrad(idp+'gold')+frGemDefs(idp,'#3a2a52')+frLG(idp+'rb',frHaloStops(cols))+t.tlClip(idp);
    var ab=t.boxD('art',-1.6,FR_R_ART+1.6);
    var z5='<defs>'+defs+'</defs><g class="fr"><path d="'+ab+'" fill="none" stroke="#1a1208" stroke-width="3.6"/><path d="'+ab+'" fill="none" stroke="url(#'+idp+'gold)" stroke-width="2"/><path d="'+t.boxD('art',.4,FR_R_ART-.4)+'" fill="none" stroke="url(#'+idp+'rb)" stroke-width="1" stroke-opacity=".9"/></g>';
    var z2='<defs>'+defs+'</defs><g class="bx">'+frHairlines([t.boxD('name',.35),t.boxD('name',3.65)],idp)+'<g clip-path="url(#'+idp+'tlclip)"><path d="'+t.typeD('el')+'" fill="none" stroke="url(#'+idp+'gold)" stroke-width=".7"/><path d="'+t.typeD('panel')+'" fill="none" stroke="url(#'+idp+'gold)" stroke-width=".6"/></g></g>';
    var sm=frSeme(idp,t);
    var z1='<defs>'+defs+sm[0]+'</defs><g class="fr">'+sm[1]+'</g>';
    var z7='<defs>'+defs+'</defs><g class="ln">'+frGoldLine(frCardD(1.3),1.5,idp)+frGoldLine(frInnerD(-2.3),.8,idp)+'</g>';
    if(t.hasRules()) z7+='<g class="bx">'+t.aroundSections(frHairlines([t.boxD('rules',.35),t.boxD('rules',3.65)],idp),idp)+'</g>';
    var body='';
    t.identSections().forEach(function(s){ body+=frHairlines([t.secD(s.i,.35,5),t.secD(s.i,2.65,5)],idp); });
    t.dividers().forEach(function(d){ body+=frGoldLine(d,.6,idp,null,.4); });
    t.manaRings().forEach(function(rg){ body+=frHairlines([frCircleD(rg[0],rg[1],rg[2]+.35),frCircleD(rg[0],rg[1],rg[2]+3.65)],idp); });
    if(body) z7+='<g class="bx">'+body+'</g>';
    var S=26*1.25, gr=26*.3*.75, gc=26*.225*.75;
    /* a corner gem is cut in the colour at its corner along the sheet: the first colour top left, the last bottom right */
    var gdefs='<radialGradient id="'+idp+'cgemh" cx="35%" cy="25%" r="40%"><stop offset="0" stop-color="#fff" stop-opacity=".8"/><stop offset=".5" stop-color="#fff" stop-opacity=".15"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient>';
    var gems=[[1.4,1.4,1,1,0],[FR_W-1.4,1.4,-1,1,.5],[1.4,FR_H-1.4,1,-1,.5],[FR_W-1.4,FR_H-1.4,-1,-1,1]].map(function(p,i){
      var cx=f2(p[0]+p[2]*S*.3), cy=f2(p[1]+p[3]*S*.3), gid=idp+'cgem'+i;
      gdefs+='<linearGradient id="'+gid+'" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="'+P(FR_PASTEL,p[4])+'"/><stop offset=".45" stop-color="'+P(FR_MID,p[4])+'"/><stop offset="1" stop-color="'+P(FR_DARK,p[4])+'"/></linearGradient>';
      return '<circle cx="'+cx+'" cy="'+cy+'" r="'+f2(gr)+'" fill="#1a1208"/><circle cx="'+cx+'" cy="'+cy+'" r="'+f2(gc)+'" fill="url(#'+gid+')"/><circle cx="'+cx+'" cy="'+cy+'" r="'+f2(gc)+'" fill="url(#'+idp+'cgemh)"/>'; }).join('');
    var z8='<defs>'+defs+gdefs+'</defs><g class="ln">'+frBrackets(idp,1.4,S)+gems+'</g>';
    return [[-1,z1,1],[5,z5,1],[7,z2,2],[7,z7,3],[7,z8,4]];
  }};
/* Nebula: the Cosmos back's sky under the whole card; thin dark-glass boxes, every outline a plain line of the card's colour */
var FR_NEB_RULE=2.7;
/* the Nebula palette (session 92): the frames' Grey is a blue-grey, which made a colourless card's galaxy blue; Nebula's is silver */
var FR_NEB_GREY={Jewel:'#aeb2ba',Pastel:'#e2e4e8',Mid:'#9a9ea6',Dark:'#141416'};
function frNebTab(table,name){ var t={}; Object.keys(table).forEach(function(k){ t[k]=table[k]; }); t.Grey=FR_NEB_GREY[name]; return t; }
var NB_JEWEL=frNebTab(FR_JEWEL,'Jewel'), NB_PASTEL=frNebTab(FR_PASTEL,'Pastel'), NB_MID=frNebTab(FR_MID,'Mid'), NB_DARK=frNebTab(FR_DARK,'Dark');
/* the sky's eight colour stops, read along the sheet: one colour's are its own tints round the card (a wheel, its ends alike);
   a card of several colours runs them along the sheet of light, first to last, as its frame does, with no seam (session 92:
   the wheel's two ends met in a hard line down the card) */
function frNebWheel(cols){ var P=frPalAt(cols), t=function(i){ return i/7; };
  return [P(NB_JEWEL,t(0)),P(NB_PASTEL,t(1)),P(NB_MID,t(2)),frMix(P(NB_PASTEL,t(3)),'#fff',.5),P(NB_JEWEL,t(4)),frMix(P(NB_MID,t(5)),'#fff',.2),P(NB_PASTEL,t(6)),P(NB_JEWEL,t(7))]; }
/* how a sky's wheels are read (NebSky.wheel): along the sheet for several colours, round the card for one; silver for none */
function frNebFlags(cols){ return ' data-wlin="'+(cols.length>1?1:0)+'" data-silver="'+(cols[0]==='Grey'?1:0)+'"'; }
function frSat(c,s){ var r=c[0],g=c[1],b=c[2];
  return [(0.213+0.787*s)*r+(0.715-0.715*s)*g+(0.072-0.072*s)*b,(0.213-0.213*s)*r+(0.715+0.285*s)*g+(0.072-0.072*s)*b,(0.213-0.213*s)*r+(0.715-0.715*s)*g+(0.072+0.928*s)*b]; }
function frNebWheelNeg(cols){ return frNebWheel(cols).map(function(c){ return frHex(frSat(frRgb(c).map(function(v){ return v*.85; }),.75)); }); }
function frNebWheelDarkInv(cols){ return frNebWheel(cols).map(function(c){ return frHex(frRgb(c).map(function(v){ return 255-Math.round(v*.35); })); }); }
function frNebPanel(cols){ return frMix(frPalAt(cols)(NB_DARK,.5),'#06081a',.5)+'26'; }
function frNebWindow(kind,sc){
  var w='<div class="nwin nwin-'+kind+'"';
  if(sc) w+=' data-wn="'+frNebWheelNeg([sc]).join(',')+'" data-wdi="'+frNebWheelDarkInv([sc]).join(',')+'" data-wh="'+frNebWheel([sc]).join(',')+'"'+frNebFlags([sc]);
  return w+'><div class="nwtint"></div></div>';
}
function frNebStars(seed){
  var r=frRandom(seed), out=[], m=FR_PAD/2, spots=[], x, y;
  for(x=18;x<FR_W-18;x+=23) spots.push([x,m]);
  for(x=30;x<FR_W-18;x+=23) spots.push([x,FR_H-m]);
  for(y=26;y<FR_H-26;y+=26) spots.push([m,y]);
  for(y=40;y<FR_H-26;y+=26) spots.push([FR_W-m,y]);
  var sizes=[1.3,1.8,2.6];
  spots.forEach(function(p){ if(r()<.45) return; var s=sizes[Math.floor(r()*3)];
    out.push('<g opacity="'+(.6+.4*r()).toFixed(2)+'">'+frStar(p[0]+(r()*3-1.5),p[1]+(r()*2-1),s,'#fff',4,.32)+'</g>'); });
  return out.join('');
}
function frNebEdge(d,w){ return '<path d="'+d+'" fill="none" stroke="#06081a" stroke-opacity=".85" stroke-width="'+f2(w+1.2)+'"/>'; }
FR_DESIGNS.nebula={orb:'stars',
  skin:function(col,cols){
    var g='rgba(6,8,20,.15)', none='rgba(6,8,20,0)', pn=frNebPanel(cols);
    return {'--frame':none,'--frame-dark':none,'--pin':frGlassCss(g),'--m-panel':pn,'--tl-bg':pn,'--ink-dark':g,
      '--m-ink':'#eef0ff','--m-meta-ink':'#eef0ff','--m-bevel':'rgba(255,255,255,.14)','--m-rule':'rgba(230,235,255,.22)'};
  },
  secStyle:function(sc){ return '--m-panel:'+frNebPanel([sc]); },
  extras:function(col,cols){ return '<div class="neb" data-wn="'+frNebWheelNeg(cols).join(',')+'" data-wdi="'+frNebWheelDarkInv(cols).join(',')+'" data-wh="'+frNebWheel(cols).join(',')+'"'+frNebFlags(cols)+'></div>'; },
  layers:function(col,uid,t,fcols,cols){
    var idp=uid, G=t.G, P=frPalAt(cols), J=function(q){ return P(NB_JEWEL,q); }, multi=cols.length>1, info=G.info;
    /* one colour: a plain line of its jewel tint; several: the jewel tints along the sheet */
    var j=multi?'url(#'+idp+'jl)':J(.5);
    var defs=t.tlClip(idp)+(multi?frLG(idp+'jl',[[0,J(0)],[.5,J(.5)],[1,J(1)]]):'');
    var line=function(d,w,c){ return '<path d="'+d+'" fill="none" stroke="'+(c||j)+'" stroke-width="'+f2(w)+'"/>'; };
    var z1='<defs><linearGradient id="'+idp+'scrim" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#000" stop-opacity="0"/><stop offset="1" stop-color="#000" stop-opacity=".6"/></linearGradient></defs>'
      +'<g class="fr"><rect x="'+FR_PAD+'" y="'+f2(info[1]-8)+'" width="'+f2(FR_W-2*FR_PAD)+'" height="'+f2(info[3]+8)+'" fill="url(#'+idp+'scrim)"/></g>';
    var z5='<defs>'+defs+'</defs><g class="fr">'+line(t.boxD('art',-1.9,FR_R_ART+1.9),3.0)+'</g>';
    var z2='<defs>'+defs+'</defs><g class="bx">'+line(t.boxD('name',1.2),2.4)+'<g clip-path="url(#'+idp+'tlclip)">'+line(t.typeD('el'),2.4)+'</g></g>';
    var z7='<defs>'+defs+'</defs><g class="ln">'+line(frInnerD(-2.4),FR_NEB_RULE)+frNebStars(FR_COLS.indexOf(col)*131+7)+'</g>';
    if(t.hasRules()) z7+='<g class="bx">'+t.aroundSections(line(t.boxD('rules',1.2),2.4),idp)+'</g>';
    var body='';
    t.identSections().forEach(function(s){ body+=frNebEdge(t.secD(s.i,1.5,5),2.0)+line(t.secD(s.i,1.5,5),2.0,NB_JEWEL[s.col]); });
    t.dividers().forEach(function(d){ body+=frNebEdge(d,1.0)+line(d,1.0); });
    t.manaRings().forEach(function(rg){ var c=frCircleD(rg[0],rg[1],rg[2]+2); body+=frNebEdge(c,2.4)+line(c,2.4); });
    if(body) z7+='<g class="bx">'+body+'</g>';
    return [[-1,z1,1],[5,z5,1],[7,z2,2],[7,z7,3]];
  }};
/* ---------------------------------------------------------------- the look: the frame, the icon set and the card back in use */
/* the game's own defaults (session 92): Rebirth wears Leatherbound and the Omnibus back, the main game Default and Epitaph */
var FR_DEF_FRAME=window.REBIRTH?'sevenfold':'classic', FR_DEF_BACK=window.REBIRTH?'omnibus':'epitaph';
var FR_LOOK={frame:FR_DEF_FRAME,orbs:'',back:''};   /* Full art is a card's own option since session 92 (its variant's fullArt), not the look's */
var FACE_LOOK_GEN=0;                              /* bumped on every change: a grid tile drawn under another look is stale */
var FR_UPL=false;   /* the face being built wears an uploaded frame image (tplFrameFor, ed2_face.js): it takes Default's hooks and none of the layers */
function frFrameKey(){ return (!FR_UPL&&FR_DESIGNS[FR_LOOK.frame])?FR_LOOK.frame:'classic'; }
function frOrbMode(){ return FR_ORB_SETS.indexOf(FR_LOOK.orbs)>=0?FR_LOOK.orbs:(FR_ORB_OF[frFrameKey()]||'app'); }
function frCap(n){ n=String(n||''); return n?n.charAt(0).toUpperCase()+n.slice(1).toLowerCase():''; }
/* the colours a frame is drawn in: the card's frame colours in the site's order (frameColorsOf), grey only when it has no other */
function frColsOf(fcols){
  var c=(fcols||[]).filter(function(x){ return FRAME_ORDER.indexOf(x)>=0&&x!=='grey'; }).map(frCap).filter(function(n){ return FR_COLS.indexOf(n)>=0; });
  return c.length?c:['Grey'];
}
function frColOf(fcols){ return frColsOf(fcols)[0]; }
function frCardCol(card){ var m=/(?:^|\s)fc-([a-z]+)(?:\s|$)/.exec(card.className||''); return m?frCap(m[1]):'Grey'; }
function frCardKey(card){ var m=/(?:^|\s)fr-([a-z]+)(?:\s|$)/.exec(card.className||''); return m&&FR_DESIGNS[m[1]]?m[1]:''; }
function frVarsStr(o){ var s=''; Object.keys(o).forEach(function(k){ s+=';'+k+':'+o[k]; }); return s; }
/* what buildFaceHTML puts on .mcard for the frame in use: its classes, its background and the variables the face stylesheet reads */
function frFaceStyle(fcols,frame,frameDark,inkDark,upl,full,noArt){
  FR_UPL=!!upl;
  var key=frFrameKey(), cols=frColsOf(fcols), col=cols[0], skin=FR_DESIGNS[key].skin(col,cols);
  var vars={'--frame':frame,'--frame-dark':frameDark,'--ink-dark':inkDark};
  Object.keys(skin).forEach(function(k){ vars[k]=skin[k]; });
  /* fr-ph: a card without a picture wears the placeholder art (session 92), painted clouds in its colours under its mana symbols */
  if(noArt) vars['--ph-bg']=frPhBg(cols);
  /* fr-fa: the card's Full art option (its variant's fullArt, session 92); not on a face wearing an uploaded frame image, which has no layers to give way */
  return {cls:' fr fr-'+key+' fc-'+col.toLowerCase()+(FR_UPL?' fr-upl':'')+(full&&!FR_UPL?' fr-fa':'')+(noArt?' fr-ph':''), bg:vars['--frame'], vars:frVarsStr(vars), key:key, col:col,
          attrs:" data-fcols='"+e((fcols||[]).join(','))+"'"};
}
/* the type line's own variables for the frame in use (Inlaid borders it with a ribbon in the colour) */
function frTypelineStyle(fcols){
  var key=frFrameKey(); if(key!=='inlaid') return '';
  return " style='--pin:"+frRibbonCss(frColsOf(fcols))+"'";
}
/* an identity section's variables for the frame in use: its border in its own colour as the frame's material, and the frame's own extras */
function frSecVars(cols){
  var d=FR_DESIGNS[frFrameKey()], sc=frColOf(cols), out='';
  if(d.secPin) out+=';--pin:'+d.secPin(sc);
  if(d.secStyle) out+=';'+d.secStyle(sc);
  return out;
}
/* the window at the back of a box: only Nebula looks out through its boxes */
function frBoxHTML(kind,cols){
  if(frFrameKey()!=='nebula') return '';
  return frNebWindow(kind,cols?frColOf(cols):null);
}
/* the rules box's outline, drawn over everything at the outline's depth; placed on the box by frameDecorate */
function frRimHTML(){ return "<div class='m-rules-rim'><i></i></div>"; }
/* the placeholder art (session 92): a face without a picture shows painted clouds in its colours (--ph-bg, with the clouds
   texture in frames.css) under its mana symbols, which sit centred in the art box, or in Full art in the window the boxes
   leave (frPlacePlaceholder); a colourless card shows the clouds alone */
function frPhBg(cols){
  var P=frPalAt(cols);
  return 'radial-gradient(ellipse 72% 58% at 58% 42%,'+frRgba(P(FR_MID,.5),.5)+' 0%,'+frRgba(P(FR_DEEP,.5),.3)+' 42%,rgba(0,0,0,0) 72%),'
    +'linear-gradient('+FR_A+','+frMix(P(FR_DARK,0),P(FR_DEEP,0),.45)+' 0%,'+frMix(P(FR_DEEP,.5),P(FR_MID,.5),.25)+' 50%,'+frMix(P(FR_DARK,1),'#000',.35)+' 100%)';
}
function frPhHTML(fcols){
  var cols=frColsOf(fcols), g='';
  if(cols[0]!=='Grey') cols.forEach(function(c){ g+="<i class='m-ph-g' style='--g:var(--tex-glyph-"+c.toLowerCase()+");--gc:"+frMix(FR_PASTEL[c],'#fff',.6)+"'></i>"; });
  return "<div class='m-art-ph' style='--n:"+cols.length+"'>"+(g?"<div class='m-ph-em'>"+g+"</div>":'')+"</div>";
}
/* the Pinlines highlight (session 92): an overlay per box, placed over the frame's own box lines by frPlacePinHolo, so the
   slot reads alike on every frame: a 4px ring on the name and rules boxes, the type line's band in its own polygon */
function frPinHoloHTML(){ return "<div class='m-pin-holo' data-box='name'></div><div class='m-pin-holo' data-box='type'></div><div class='m-pin-holo' data-box='rules'></div>"; }
/* the Background highlight's sheen, in the field's own shape (frDecorateCard moves it over the frame's field layers) */
function frBgHoloHTML(){ return "<div class='m-bg-holo'></div>"; }
/* the layers under the face: the inner frame's fill, the border's shade and lift, a frame's own extras (Nebula's sky), and the
   Full art option's parts (frames.css shows them on a .fr-fa face): the art over the whole card, the edge rim, the scrim under the info row */
function frExtrasHTML(fcols,art,holo){
  var upl=FR_UPL; FR_UPL=false;   /* the last of a face's hooks: the flag is cleared for the next face */
  if(upl) return '';
  holo=holo||{};
  var key=frFrameKey(), d=FR_DESIGNS[key], cols=frColsOf(fcols);
  return "<div class='inner-fill'></div><div class='ring-shade'></div><div class='ring-lift'><div class='ring-fill'></div></div>"+(d.extras?d.extras(cols[0],cols):'')
    +"<div class='art-full'"+(art?" style='background-image:"+e(cssUrl(art))+"'":'')+"></div><div class='fa-edge'><i></i></div><div class='fa-scrim'></div>"
    +(holo.pin?frPinHoloHTML():'')+(holo.bg?frBgHoloHTML():'');
}
/* a stat on the face: an uploaded icon as ever; else the stat in the icon set in use */
function faceOrbHTML(type,value){
  if(!type||type==='blank'||type==='hidden') return '';
  if(tplGet('orb:'+type)) return orbShapeByType(type,value);
  return frOrbSvg(type,value,frUid(),frOrbMode());
}
/* ---------------------------------------------------------------- measuring the face, after fitFace has laid it out */
function frOffs(el,stop){
  var x=0,y=0,n=el;
  while(n&&n!==stop){
    x+=n.offsetLeft; y+=n.offsetTop;
    var tf=getComputedStyle(n).transform;
    if(tf&&tf!=='none'){ try{ var m=new DOMMatrix(tf); x+=m.m41; y+=m.m42; }catch(_){} }
    n=n.offsetParent;
    if(n&&n!==stop){ x+=n.clientLeft; y+=n.clientTop; }
  }
  return [x,y];
}
function frRectOf(el,card){ if(!el) return null; var o=frOffs(el,card); return [o[0],o[1],el.offsetWidth,el.offsetHeight]; }
/* a clip-path polygon (percentages or px) as points over a box */
function frPolyPts(s,box){
  if(!s||s.indexOf('polygon(')<0) return null;
  var inner=s.slice(s.indexOf('(')+1,s.lastIndexOf(')'));
  var pts=[], ok=true;
  inner.split(',').forEach(function(p){
    var ab=p.trim().split(/\s+/); if(ab.length<2){ ok=false; return; }
    var cv=function(v,size){ v=v.trim(); if(v.slice(-1)==='%') return parseFloat(v)/100*size; return parseFloat(v)||0; };
    pts.push([box[0]+cv(ab[0],box[2]),box[1]+cv(ab[1],box[3])]);
  });
  return ok&&pts.length>2?pts:null;
}
function frMeasure(card){
  var q=function(s){ return card.querySelector(s); };
  var inner=q('.mcard-inner'), name=q('.m-nameline'), type=q('.m-typeline'), art=q('.m-art'), info=q('.m-info');
  if(!inner||!name||!type||!art||!info) return null;
  var G={inner:frRectOf(inner,card),name:frRectOf(name,card),type:frRectOf(type,card),art:frRectOf(art,card),info:frRectOf(info,card),
         rules:frRectOf(q('.m-rules'),card),rsecs:[],manas:[],poly:{},
         orient:card.classList.contains('mcard-fv')?'v':'h',
         essence:card.classList.contains('mcard-tpl-essence-boxed')?'boxed':card.classList.contains('mcard-tpl-essence-bare')?'bare':''};
  if(!G.inner[2]||!G.name[2]) return null;
  card.querySelectorAll('.m-rsec').forEach(function(s){
    var col=s.classList.contains('ident')?frCap(s.getAttribute('data-fcol')||''):'';
    G.rsecs.push({r:frRectOf(s,card),col:(col&&FR_COLS.indexOf(col)>=0)?col:(s.classList.contains('ident')?'Grey':null)});
  });
  card.querySelectorAll('.m-mana-orb').forEach(function(m){ var r=frRectOf(m,card); G.manas.push([r[0]+r[2]/2,r[1]+r[3]/2,r[2]/2]); });
  var tb=G.type, cs=getComputedStyle(type);
  G.poly.el=frPolyPts(cs.clipPath,tb);
  try{ G.poly.before=frPolyPts(getComputedStyle(type,'::before').clipPath,tb); G.poly.after=frPolyPts(getComputedStyle(type,'::after').clipPath,tb); }catch(_){}
  var pn=q('.m-tl-panel'); if(pn) G.poly.panel=frPolyPts(getComputedStyle(pn).clipPath,frRectOf(pn,card));
  if(!G.poly.el){ var r=tb; G.poly.el=[[r[0],r[1]],[r[0]+r[2],r[1]],[r[0]+r[2],r[1]+r[3]],[r[0],r[1]+r[3]]]; }
  ['before','after','panel'].forEach(function(k){ if(!G.poly[k]) G.poly[k]=G.poly.el; });
  return G;
}
function frInnerFillClip(G){
  var i=G.inner, a=G.art;
  return frRR(-1.5,-1.5,i[2]+3,i[3]+3,FR_R_INNER+1.5)+' '+frRR(a[0]-i[0],a[1]-i[1],a[2],a[3],FR_R_ART);
}
/* with the Outline off (body.edge-none, the Adjustments window) the frame's field reaches the card's edge: the fill covers the card */
function frFieldClip(G){ var a=G.art; return frRR(0,0,FR_W,FR_H,FR_R_CARD)+' '+frRR(a[0],a[1],a[2],a[3],FR_R_ART); }
function frOutlineOff(){ return document.body.classList.contains('edge-none'); }
/* a gradient, clip, mask or pattern defined again under an id the card already has is dropped: each layer repeats its
   frame's defs, the browser only ever uses the first, and the tilt would turn every copy */
function frDedupe(markup){
  var seen={};
  ['linearGradient','radialGradient','clipPath','mask','pattern'].forEach(function(tag){
    var re=new RegExp('<'+tag+' id="([^"]+)"[^>]*>[^]*?</'+tag+'>','g');
    markup=markup.replace(re,function(m,id){ if(seen[id]) return ''; seen[id]=1; return m; });
  });
  return markup.split('<defs></defs>').join('');
}
function frChildren(card,cls){ return [].filter.call(card.children,function(k){ return k.classList&&k.classList.contains(cls); }); }
/* the rules box's rim: on the box, with the box's sheet alignment, cut away where identity sections wear their own frames */
function frPlaceRims(card){
  card.querySelectorAll('.m-rules-rim').forEach(function(rim){
    var rb=rim.previousElementSibling; while(rb&&!(rb.classList&&rb.classList.contains('m-rules'))) rb=rb.previousElementSibling;
    if(!rb){ rim.style.display='none'; return; }
    rim.style.display='';
    var base=rim.offsetParent||card, o=frOffs(rb,card), b=(base===card)?[0,0]:frOffs(base,card);
    rim.style.left=(o[0]-b[0])+'px'; rim.style.top=(o[1]-b[1])+'px'; rim.style.width=rb.offsetWidth+'px'; rim.style.height=rb.offsetHeight+'px';
    rim.style.setProperty('--gsize',rb.style.getPropertyValue('--gsize')); rim.style.setProperty('--gpos',rb.style.getPropertyValue('--gpos'));
    var secs=rb.classList.contains('has-ident')?[].slice.call(rb.querySelectorAll('.m-rsec.ident')):[];
    if(secs.length){
      var bw=rb.offsetWidth, bh=rb.offsetHeight, d='M -3,-3 H '+(bw+3)+' V '+(bh+3)+' H -3 Z';
      secs.forEach(function(s){ var p=frOffs(s,rb); d+=' '+frRR(p[0]+rb.clientLeft,p[1]+rb.clientTop,s.offsetWidth,s.offsetHeight,5); });
      rim.style.clipPath='path(evenodd,"'+d+'")';
    } else rim.style.clipPath='';
  });
}
/* Inlaid: every layer of a box's background (the parchment and the iron) painted from the card-wide sheet, not only the frame layer */
function frSheetAll(card){
  var cw=card.offsetWidth, ch=card.offsetHeight;
  card.querySelectorAll('.m-nameline,.m-typeline,.m-tl-panel,.m-rules,.m-rsec.ident,.m-mana-orb').forEach(function(el){
    var o=frOffs(el,card), layers=bgLayerCount(getComputedStyle(el).backgroundImage), sz=[], ps=[];
    for(var i=0;i<layers;i++){ sz.push(cw+'px '+ch+'px'); ps.push((-o[0])+'px '+(-o[1])+'px'); }
    el.style.backgroundSize=sz.join(', '); el.style.backgroundPosition=ps.join(', ');
    el.style.setProperty('--gsize',cw+'px '+ch+'px'); el.style.setProperty('--gpos',(-o[0])+'px '+(-o[1])+'px');
  });
}
/* draws a frame's layers on every face under root (or on root itself): called at the end of fitFace */
function frameDecorate(root){
  if(!root) return;
  var cards=(root.matches&&root.matches('.mcard'))?[root]:[].slice.call(root.querySelectorAll('.mcard'));
  cards.forEach(function(card){ try{ frDecorateCard(card); }catch(_){} });
}
function frDecorateCard(card){
  var key=frCardKey(card); if(!key) return;
  if(card.classList.contains('fr-upl')) return;   /* an uploaded frame image is the whole frame: no layers over it */
  if(!card.offsetWidth) return;
  var d=FR_DESIGNS[key], col=frCardCol(card), fcols=(card.getAttribute('data-fcols')||'').split(',').filter(Boolean), cols=frColsOf(fcols);
  if(d.sheetAll) frSheetAll(card);
  var G=frMeasure(card); if(!G) return;
  var t=frTools(G), uid='fd'+(++FR_UID).toString(36);
  var layers=d.layers(col,uid,t,fcols,cols);
  var html=frDedupe(layers.map(function(L){
    return '<svg class="deco" style="z-index:'+L[0]+';--fz:'+(L[2]==null?1:L[2])+'" viewBox="0 0 '+FR_W+' '+FR_H+'" aria-hidden="true">'+L[1]+'</svg>';
  }).join(''));
  frChildren(card,'deco').forEach(function(k){ card.removeChild(k); });
  card.insertAdjacentHTML('beforeend',html);
  var field=frOutlineOff()&&!card.classList.contains('fr-fa');
  frChildren(card,'inner-fill').forEach(function(k){
    if(field){ k.style.left='0'; k.style.top='0'; k.style.width=FR_W+'px'; k.style.height=FR_H+'px'; k.style.borderRadius=FR_R_CARD+'px'; k.style.clipPath='path(evenodd,"'+frFieldClip(G)+'")'; }
    else { k.style.left=''; k.style.top=''; k.style.width=''; k.style.height=''; k.style.borderRadius=''; k.style.clipPath='path(evenodd,"'+frInnerFillClip(G)+'")'; }
  });
  /* the Background sheen: the field's shape, and last in the card, so it paints over the frame's field layers and under the boxes */
  var fill=frChildren(card,'inner-fill')[0], fa=card.classList.contains('fr-fa');
  frChildren(card,'m-bg-holo').forEach(function(k){
    card.appendChild(k);
    ['left','top','width','height','borderRadius','clipPath'].forEach(function(p){ k.style[p]=(fill&&!fa)?fill.style[p]:''; });
  });
  frPlaceRims(card);
  frPlacePinHolo(card,G);
  frPlacePlaceholder(card,G);
  if(key==='nebula') NebSky.apply(card);
}
/* the Pinlines highlight's overlays over their boxes (session 92): the rules box's cut round sections wearing their own frames,
   as its rim is; the type line's in the band's own polygon, read off the type line's frame layer */
function frPlacePinHolo(card,G){
  var ov=frChildren(card,'m-pin-holo'); if(!ov.length) return;
  var box={name:G.name,type:G.type,rules:G.rules};
  ov.forEach(function(o){
    var k=o.getAttribute('data-box'), r=box[k];
    if(!r||!r[2]){ o.style.display='none'; return; }
    o.style.display=''; o.style.left=r[0]+'px'; o.style.top=r[1]+'px'; o.style.width=r[2]+'px'; o.style.height=r[3]+'px';
    var cp='';
    if(k==='type'){ try{ cp=getComputedStyle(card.querySelector('.m-typeline'),'::before').clipPath; }catch(_){} }
    else if(k==='rules'){ var rim=card.querySelector('.m-rules-rim'); if(rim) cp=rim.style.clipPath; }
    o.style.clipPath=(cp&&cp!=='none')?cp:'';
  });
}
/* the placeholder's symbols: centred in the art box; with Full art the picture is the whole face, so they are centred on the face
   (the stylesheet keeps them the size they have in the box) */
function frPlacePlaceholder(card,G){
  var ph=card.querySelector('.m-art-ph'); if(!ph) return;
  if(!card.classList.contains('fr-fa')){ ph.style.left=''; ph.style.top=''; ph.style.width=''; ph.style.height=''; return; }
  var a=G.art;
  ph.style.left=(-a[0])+'px'; ph.style.top=(-a[1])+'px'; ph.style.width=FR_W+'px'; ph.style.height=FR_H+'px';
}
/* ---------------------------------------------------------------- the tilt: what the frames add to the face's own holo handling
   The face code turns every data-rot gradient and sets --holo-ang; the frames add the card-wide sheet their lines are painted
   from, the galaxies under the Stars icons, and the Nebula sky. */
function frameTilt(card,px,py,ang){
  var r=ang*Math.PI/180, dx=Math.sin(r), dy=-Math.cos(r), L=(Math.abs(FR_W*dx)+Math.abs(FR_H*dy))/2;
  var v=[(FR_W/2-dx*L).toFixed(2),(FR_H/2-dy*L).toFixed(2),(FR_W/2+dx*L).toFixed(2),(FR_H/2+dy*L).toFixed(2)];
  card.querySelectorAll('linearGradient[data-sheet]').forEach(function(g){ g.setAttribute('x1',v[0]); g.setAttribute('y1',v[1]); g.setAttribute('x2',v[2]); g.setAttribute('y2',v[3]); });
  card.querySelectorAll('[data-gal-rot]').forEach(function(el){
    var k=parseFloat(el.getAttribute('data-gal-rot')); if(isNaN(k)) k=1;
    el.style.transform='rotate('+((ang-120)*k).toFixed(2)+'deg)';
  });
  NebSky.move(card,px,py,ang);
}
function frameTiltReset(card){
  var v=frSheetLine(120).map(function(x){ return x.toFixed(2); });
  card.querySelectorAll('linearGradient[data-sheet]').forEach(function(g){ g.setAttribute('x1',v[0]); g.setAttribute('y1',v[1]); g.setAttribute('x2',v[2]); g.setAttribute('y2',v[3]); });
  card.querySelectorAll('[data-gal-rot]').forEach(function(el){ el.style.transform=''; });
  NebSky.move(card,0.5,0.5,120);
}
/* the board's zoom (cat_testdeck.js) moves its own light from the board token, and draws its copy of a face afresh */
window.edFrameHolo=function(root,px,py,ang){ if(!root) return; root.querySelectorAll('.mcard').forEach(function(card){ try{ frameTilt(card,px,py,ang); }catch(_){} }); };
window.edFrameZoom=function(root){ frameDecorate(root); };
/* ---------------------------------------------------------------- Nebula's sky
   Every layer of the Cosmos back's sky, composited into one picture with the blend modes the back's stack of layers used,
   its colour wheel run through the card's colours. A card at rest shows a still sky, drawn once per colour and shared
   (a CSS background on .neb and on each box's window, which copies its part of the same sky so the art never shows through).
   A card under the pointer (the editor's preview, a popped-out face, the board's zoom) has a canvas of its own, drawn again
   when its angle changes, with the back's parallax. */
var NebSky=(function(){
  var P={sq:725.3,c:[169.95,237.95],sky:{par:18.1,sc:1.12,rx:238.0,ry:285.6,st:[[0,'#1a1f52'],[0.35,'#0f1238'],[0.7,'#070a1e'],[1,'#04050d']],
         /* a colourless card's sky (session 92): the same depths with no blue in them */
         sts:[[0,'#36373f'],[0.35,'#212228'],[0.7,'#101013'],[1,'#07070a']],base:'#04050d',bases:'#08080a'},
         stars:[['bl-stars4',1.8,13.6],['bl-stars3',-0.25,10.4]],
         s:{sf:['bl-structure-front',1.25,1.4375,6.8],sc:['bl-structure-copy',0.66,1.4375,5.4],s0:['bl-structure',1,1,3.6]},
         neg:{rot:0.33,sc:1.5625,pre:17.12,par:11.3,op:0.5},spot:[187.0,261.8],specks:'bl-specks1',vig:{par:2.3,r:204.0}};
  var W=FR_W, H=FR_H, R=Math.PI/180, S=2, S2=1.5, IM={}, SCR=[], STILL={}, loading=null;
  function load(){
    if(loading) return loading;
    var names=[P.specks].concat(P.stars.map(function(s){ return s[0]; }),Object.keys(P.s).map(function(k){ return P.s[k][0]; }));
    loading=Promise.all(names.map(function(n){
      return new Promise(function(res){ var im=new Image(); IM[n]=im; im.onload=function(){ res(); }; im.onerror=function(){ res(); }; im.src=frTexUrl(n); });
    })).then(function(){
      var s0=IM[P.s.s0[0]], c=document.createElement('canvas'); c.width=s0.naturalWidth||1; c.height=s0.naturalHeight||1;
      var x=c.getContext('2d'); x.drawImage(s0,0,0); x.globalCompositeOperation='difference'; x.fillStyle='#fff'; x.fillRect(0,0,c.width,c.height);
      IM.inv=c;
      [['sf','#00ff00'],['sc','#0000ff'],['s0','#ff0000']].forEach(function(g){
        var im=IM[P.s[g[0]][0]], t=document.createElement('canvas'); t.width=im.naturalWidth||1; t.height=im.naturalHeight||1;
        var y=t.getContext('2d'); y.drawImage(im,0,0); y.globalCompositeOperation='multiply'; y.fillStyle=g[1]; y.fillRect(0,0,t.width,t.height);
        IM['t'+g[0]]=t;
      });
    });
    return loading;
  }
  function scr(i,w,h){
    var c=SCR[i]||(SCR[i]=document.createElement('canvas'));
    if(c.width!==w) c.width=w; if(c.height!==h) c.height=h;
    var x=c.getContext('2d'); x.setTransform(1,0,0,1,0,0); x.globalCompositeOperation='source-over'; x.globalAlpha=1;
    return x;
  }
  function units(x,k){ x.setTransform(k,0,0,k,0,0); }
  function pixels(x){ x.setTransform(1,0,0,1,0,0); }
  function stops(g,list){ list.forEach(function(s){ g.addColorStop(s[0],s[1]); }); return g; }
  /* one colour's tints round the card; several colours along the sheet of light (frSheetLine), first to last, no seam */
  function wheel(x,cols,lin){
    var n=cols.length-1, g;
    if(lin){ var l=frSheetLine(120); g=x.createLinearGradient(l[0],l[1],l[2],l[3]); }
    else { if(!x.createConicGradient) return cols[0]; g=x.createConicGradient(Math.PI/2,W/2,H/2); }
    cols.forEach(function(c,i){ g.addColorStop(i/n,c); });
    return g;
  }
  function layer(x,im,rot,sc,par,q,pre){
    x.save(); x.translate(P.c[0]+(0.5-q[0])*par,P.c[1]+(0.5-q[1])*par);
    if(pre) x.rotate(pre*R);
    x.scale(sc,sc); x.rotate((q[2]-120)*rot*R);
    x.drawImage(im,-P.sq/2,-P.sq/2,P.sq,P.sq); x.restore();
  }
  function struct(x,k,q,im){ var s=P.s[k]; layer(x,im||IM[s[0]],s[1],s[2],s[3],q); }
  /* the whole sky into m (w x h pixels at scale k) through the wheels wn, wdi, wh; returns the darkest structure and the front galaxies for the windows */
  function sky(m,w,h,k,wn,wdi,wh,q,fl){
    fl=fl||{};
    var sw=Math.round(W*S2), sh=Math.round(H*S2);
    pixels(m); m.globalCompositeOperation='source-over'; m.globalAlpha=1; m.fillStyle=fl.silver?P.sky.bases:P.sky.base; m.fillRect(0,0,w,h);
    units(m,k); m.save(); m.translate(W/2+(0.5-q[0])*P.sky.par,H/2+(0.5-q[1])*P.sky.par); m.scale(P.sky.sc*P.sky.rx,P.sky.sc*P.sky.ry);
    m.fillStyle=stops(m.createRadialGradient(0,0,0,0,0,1),fl.silver?P.sky.sts:P.sky.st); m.fillRect(-4,-4,8,8); m.restore();
    P.stars.forEach(function(s){ layer(m,IM[s[0]],s[1],1,s[2],q); });
    var a=scr(0,sw,sh); units(a,S2); a.fillStyle=wheel(a,wn,fl.lin); a.fillRect(0,0,W,H);
    a.globalCompositeOperation='screen'; layer(a,IM.inv,P.neg.rot,P.neg.sc,P.neg.par,q,P.neg.pre);
    pixels(m); m.globalAlpha=P.neg.op; m.globalCompositeOperation='multiply'; m.drawImage(a.canvas,0,0,w,h); m.globalAlpha=1;
    var d=scr(1,sw,sh); d.fillStyle='#fff'; d.fillRect(0,0,sw,sh); units(d,S2); d.globalCompositeOperation='darken';
    struct(d,'sf',q); struct(d,'sc',q); struct(d,'s0',q);
    var e2=scr(2,sw,sh); units(e2,S2); e2.fillStyle=wheel(e2,wdi,fl.lin); e2.fillRect(0,0,W,H);
    pixels(e2); e2.globalCompositeOperation='multiply'; e2.drawImage(d.canvas,0,0);
    e2.globalCompositeOperation='difference'; e2.fillStyle='#fff'; e2.fillRect(0,0,sw,sh);
    m.globalCompositeOperation='multiply'; m.drawImage(e2.canvas,0,0,w,h);
    var L=scr(3,sw,sh); units(L,S2);
    L.save(); L.translate(W/2+(0.5-q[0])*W,H/2+(0.5-q[1])*H); L.scale(P.spot[0],P.spot[1]);
    L.fillStyle=stops(L.createRadialGradient(0,0,0,0,0,1),[[0,'#fff'],[0.5,'#737373'],[1,'#000']]); L.fillRect(-4,-4,8,8); L.restore();
    L.save(); L.translate(P.c[0],P.c[1]); L.rotate(q[2]*1.6*R); L.globalCompositeOperation='screen';
    L.fillStyle=stops(L.createLinearGradient(-P.sq/2,0,P.sq/2,0),[[0,'#000'],[0.38,'#000'],[0.5,'#fff'],[0.62,'#000'],[1,'#000']]);
    L.fillRect(-P.sq/2,-P.sq/2,P.sq,P.sq); L.restore();
    var G=scr(4,sw,sh); units(G,S2); G.drawImage(IM[P.specks],0,0,W,H); pixels(G); G.globalCompositeOperation='multiply'; G.drawImage(L.canvas,0,0);
    var F=scr(5,sw,sh); F.fillStyle='#000'; F.fillRect(0,0,sw,sh);
    ['sf','sc','s0'].forEach(function(kk){
      units(F,S2); F.globalCompositeOperation='screen'; struct(F,kk,q,IM['t'+kk]);
      var T=scr(6,sw,sh); units(T,S2); struct(T,kk,q); pixels(T); T.globalCompositeOperation='multiply'; T.drawImage(G.canvas,0,0);
      pixels(F); F.drawImage(T.canvas,0,0);
    });
    pixels(F); F.globalCompositeOperation='difference'; F.drawImage(d.canvas,0,0);
    var Fh=scr(7,sw,sh); Fh.globalCompositeOperation='copy'; Fh.drawImage(F.canvas,0,0);
    units(Fh,S2); Fh.globalCompositeOperation='hue'; Fh.fillStyle=wheel(Fh,wh,fl.lin); Fh.fillRect(0,0,W,H);
    pixels(m); m.globalCompositeOperation='screen'; m.drawImage(Fh.canvas,0,0,w,h);
    /* a colourless card's sky is silver (session 92): the textures are blue in themselves, so the whole picture gives up its colour here, its light kept */
    if(fl.silver){ m.globalCompositeOperation='saturation'; m.fillStyle='#808080'; m.fillRect(0,0,w,h); }
    units(m,k); m.globalCompositeOperation='source-over';
    m.save(); m.translate(W/2+(0.5-q[0])*P.vig.par,H/2+(0.5-q[1])*P.vig.par);
    m.fillStyle=stops(m.createRadialGradient(0,0,0,0,0,P.vig.r),[[0,'rgba(0,0,0,0)'],[0.55,'rgba(0,0,0,0)'],[1,'rgba(0,0,0,.5)']]);
    m.fillRect(-W,-H,2*W,2*H); m.restore();
    return {d:d.canvas,F:F.canvas};
  }
  /* one window's part of the sky through the window's own three wheels, worked only over the window's rectangle */
  function region(q,v,dark,front){
    var rw=Math.max(1,Math.round(v.w*S2)), rh=Math.max(1,Math.round(v.h*S2)), ox=v.x, oy=v.y;
    var at=function(x){ x.setTransform(S2,0,0,S2,-ox*S2,-oy*S2); };
    var b=scr(8,rw,rh); b.fillStyle=v.silver?P.sky.bases:P.sky.base; b.fillRect(0,0,rw,rh);
    at(b); b.save(); b.translate(W/2+(0.5-q[0])*P.sky.par,H/2+(0.5-q[1])*P.sky.par); b.scale(P.sky.sc*P.sky.rx,P.sky.sc*P.sky.ry);
    b.fillStyle=stops(b.createRadialGradient(0,0,0,0,0,1),v.silver?P.sky.sts:P.sky.st); b.fillRect(-4,-4,8,8); b.restore();
    P.stars.forEach(function(s){ layer(b,IM[s[0]],s[1],1,s[2],q); });
    var a=scr(9,rw,rh); at(a); a.fillStyle=wheel(a,v.wn,v.lin); a.fillRect(ox-2,oy-2,v.w+4,v.h+4);
    a.globalCompositeOperation='screen'; layer(a,IM.inv,P.neg.rot,P.neg.sc,P.neg.par,q,P.neg.pre);
    pixels(b); b.globalAlpha=P.neg.op; b.globalCompositeOperation='multiply'; b.drawImage(a.canvas,0,0); b.globalAlpha=1;
    var e2=scr(10,rw,rh); at(e2); e2.fillStyle=wheel(e2,v.wdi,v.lin); e2.fillRect(ox-2,oy-2,v.w+4,v.h+4);
    pixels(e2); e2.globalCompositeOperation='multiply'; e2.drawImage(dark,ox*S2,oy*S2,rw,rh,0,0,rw,rh);
    e2.globalCompositeOperation='difference'; e2.fillStyle='#fff'; e2.fillRect(0,0,rw,rh);
    b.globalCompositeOperation='multiply'; b.drawImage(e2.canvas,0,0);
    var f=scr(11,rw,rh); f.globalCompositeOperation='copy'; f.drawImage(front,ox*S2,oy*S2,rw,rh,0,0,rw,rh);
    at(f); f.globalCompositeOperation='hue'; f.fillStyle=wheel(f,v.wh,v.lin); f.fillRect(ox-2,oy-2,v.w+4,v.h+4);
    pixels(b); b.globalCompositeOperation='screen'; b.drawImage(f.canvas,0,0);
    if(v.silver){ b.globalCompositeOperation='saturation'; b.fillStyle='#808080'; b.fillRect(0,0,rw,rh); }
    at(b); b.globalCompositeOperation='source-over';
    b.save(); b.translate(W/2+(0.5-q[0])*P.vig.par,H/2+(0.5-q[1])*P.vig.par);
    b.fillStyle=stops(b.createRadialGradient(0,0,0,0,0,P.vig.r),[[0,'rgba(0,0,0,0)'],[0.55,'rgba(0,0,0,0)'],[1,'rgba(0,0,0,.5)']]);
    b.fillRect(-W,-H,2*W,2*H); b.restore();
    var x=v.c.getContext('2d'); pixels(x); x.globalCompositeOperation='copy'; x.drawImage(b.canvas,0,0,rw,rh,0,0,v.c.width,v.c.height);
  }
  function wheelsOf(el){ return {wn:el.getAttribute('data-wn').split(','),wdi:el.getAttribute('data-wdi').split(','),wh:el.getAttribute('data-wh').split(','),
                                 lin:el.getAttribute('data-wlin')==='1',silver:el.getAttribute('data-silver')==='1'}; }
  /* the still sky for one set of wheels, once, as a picture every card at rest shares */
  function stillUrl(wl){
    var key=wl.wn.join()+'|'+wl.wdi.join()+'|'+wl.wh.join()+'|'+(wl.lin?'L':'C')+(wl.silver?'S':'');
    if(STILL[key]) return STILL[key];
    var c=document.createElement('canvas'); c.width=W; c.height=H;
    sky(c.getContext('2d'),W,H,1,wl.wn,wl.wdi,wl.wh,[0.5,0.5,120],wl);
    return STILL[key]=c.toDataURL('image/jpeg',0.9);
  }
  function still(card){
    var neb=frChildren(card,'neb')[0]; if(!neb) return;
    frChildren(neb,'nebc').forEach(function(k){ neb.removeChild(k); });
    var wl=wheelsOf(neb), url=stillUrl(wl);
    neb.style.backgroundImage='url('+url+')'; neb.style.backgroundSize=W+'px '+H+'px'; neb.style.backgroundPosition='0 0';
    card.querySelectorAll('.nwin').forEach(function(w){
      var k=w.querySelector('canvas'); if(k) w.removeChild(k);
      var o=frOffs(w,card), u=w.getAttribute('data-wn')?stillUrl(wheelsOf(w)):url;
      w.style.backgroundImage='url('+u+')'; w.style.backgroundSize=W+'px '+H+'px'; w.style.backgroundPosition=(-o[0])+'px '+(-o[1])+'px';
    });
    card.__neb=null;
  }
  function setup(card){
    var neb=frChildren(card,'neb')[0]; if(!neb) return null;
    var c=neb.querySelector('canvas.nebc');
    if(!c){ c=document.createElement('canvas'); c.className='nebc'; neb.appendChild(c); }
    neb.style.backgroundImage='';
    var wl=wheelsOf(neb), st={c:c,wn:wl.wn,wdi:wl.wdi,wh:wl.wh,lin:wl.lin,silver:wl.silver,wins:[],last:''};
    c.width=Math.round(W*S); c.height=Math.round(H*S);
    card.querySelectorAll('.nwin').forEach(function(el){
      var k=el.querySelector('canvas.nwc');
      if(!k){ k=document.createElement('canvas'); k.className='nwc'; el.insertBefore(k,el.firstChild); }
      el.style.backgroundImage='';
      var o=frOffs(el,card), v={c:k,x:o[0],y:o[1],w:el.offsetWidth,h:el.offsetHeight};
      if(!v.w||!v.h) return;
      if(el.getAttribute('data-wn')){ var w2=wheelsOf(el); v.wn=w2.wn; v.wdi=w2.wdi; v.wh=w2.wh; v.lin=w2.lin; v.silver=w2.silver; }
      k.width=Math.max(1,Math.round(v.w*S)); k.height=Math.max(1,Math.round(v.h*S)); st.wins.push(v);
    });
    card.__neb=st; return st;
  }
  function draw(card,q){
    var st=card.__neb, c=st.c, w=c.width, h=c.height, m=c.getContext('2d');
    var keep=sky(m,w,h,S,st.wn,st.wdi,st.wh,q,st);
    st.wins.forEach(function(v){
      if(v.wn){ region(q,v,keep.d,keep.F); return; }
      var x=v.c.getContext('2d'); pixels(x); x.globalCompositeOperation='copy';
      x.drawImage(c,v.x*S,v.y*S,v.w*S,v.h*S,0,0,v.c.width,v.c.height);
    });
    st.last=q.join(',');
  }
  function paint(card){
    if(!IM.inv) return;
    var st=card.__neb; if(!st) return;
    var q=card.__nebq||[0.5,0.5,120]; if(st.last===q.join(',')) return;
    draw(card,q);
  }
  function is3D(card){ return !!(card.closest&&card.closest('#edPvHost,#mdi,#tdZoom')); }
  /* a card just laid out: a shared still picture, or its own canvases where it can turn */
  function apply(card){
    if(!frChildren(card,'neb').length) return;
    load().then(function(){
      if(!card.isConnected) return;
      if(is3D(card)){ card.__nebq=null; setup(card); paint(card); }
      else still(card);
    });
  }
  function move(card,px,py,ang){
    if(!card.__neb) return;
    card.__nebq=[+(+px).toFixed(3),+(+py).toFixed(3),ang];
    if(card.__nebraf) return;
    card.__nebraf=requestAnimationFrame(function(){ card.__nebraf=0; paint(card); });
  }
  return {apply:apply,move:move,load:load};
})();

/* ===== The look a template wears: which frame, which stat icon set, which card back =====
   Saved as the meta row 'cardLook' (IndexedDB) and published inside the pack body
   (currentPackBody, ed2_face.js) as `cardLook`, so a fresh visitor starts with the
   author's choice (LOOK_BAKED) and keeps their own once they pick on the Templates page.
   The card back is mirrored into localStorage 'conjure_card_back', which the Play Test
   board reads (tdBackKind, cat_testdeck.js). */
var FR_BACK_STORE='conjure_card_back'+(window.REBIRTH?'_rebirth':'');   /* each game its own (session 92): their defaults differ */
var FR_LOOK_SAVED=false;      /* this browser has a saved row of its own: the published default follows only until then */
function frBackKnown(k){ return !!k && (window.CB_LIST||[]).some(function(b){ return b.key===k; }); }
function frBackDefault(){ if(frBackKnown(FR_DEF_BACK)) return FR_DEF_BACK; var l=window.CB_LIST||[]; return l.length?l[0].key:''; }
function frLookBody(){ return {frame:FR_LOOK.frame,orbs:FR_LOOK.orbs,back:FR_LOOK.back}; }
function frLookClean(raw){
  var o={frame:FR_DEF_FRAME,orbs:'',back:''};
  if(raw&&typeof raw==='object'){
    if(FR_DESIGNS[raw.frame]) o.frame=raw.frame;
    if(raw.orbs&&FR_ORB_SETS.indexOf(raw.orbs)>=0) o.orbs=raw.orbs;
    if(frBackKnown(raw.back)) o.back=raw.back;
  }
  return o;
}
function frMirrorBack(){
  var k=FR_LOOK.back||frBackDefault(); if(!k) return;
  try{ localStorage.setItem(FR_BACK_STORE,k); }catch(_){}
  window._tdBackKind=k;
}
/* The look applied to every face from now on; persist=true also saves it. Returns whether anything changed. */
window.edApplyLook=function(raw,persist){
  var o=frLookClean(raw);
  var changed=o.frame!==FR_LOOK.frame||o.orbs!==FR_LOOK.orbs||o.back!==FR_LOOK.back;
  FR_LOOK=o; FACE_LOOK_GEN++;
  frMirrorBack();
  if(persist){ FR_LOOK_SAVED=true; if(typeof setMetaSafe==='function') setMetaSafe('cardLook',frLookBody(),'the card look'); }
  return changed;
};
window.edLookSaved=function(v){ if(v!==undefined) FR_LOOK_SAVED=!!v; return FR_LOOK_SAVED; };
window.edLookRefresh=function(){ frLookChanged('all'); };
window.edOpenTplPage=function(){ if(typeof showTab==='function') showTab('templates'); };
/* At boot: the saved row, else the published default, else the back the old Play Test picker kept. */
window.edBootLook=function(saved,baked){
  var raw=saved&&typeof saved==='object'?saved:null;
  FR_LOOK_SAVED=!!raw;
  if(!raw){
    var b=baked&&typeof baked==='object'?baked:{};
    raw={frame:b.frame,orbs:b.orbs,back:b.back};
    if(!frBackKnown(raw.back)){ var old=null; try{ old=localStorage.getItem(FR_BACK_STORE); }catch(_){} if(frBackKnown(old)) raw.back=old; }
  }
  window.edApplyLook(raw,false);
};
window.edFrameLook=function(){ return frLookBody(); };
function frLookSet(patch,what){
  var next=frLookBody(); Object.keys(patch).forEach(function(k){ next[k]=patch[k]; });
  if(!window.edApplyLook(next,true)) return false;
  frLookChanged(what); return true;
}
/* edSetFrameLook, not edSetFrame: that name is the editor's art layout setter (ed2_face.js), which this slice overwrote in sessions 90 and 91 */
window.edSetFrameLook=function(k){ if(!FR_DESIGNS[k]) return false; return frLookSet({frame:k},'frame'); };
window.edSetOrbs=function(k){ k=k||''; if(k&&FR_ORB_SETS.indexOf(k)<0) return false; return frLookSet({orbs:k},'orbs'); };
window.edSetBack=function(k){ if(!frBackKnown(k)) return false; return frLookSet({back:k},'back'); };
/* the Outline option changed (edSetEdge): every drawn face is stale, as its fill's shape follows the option */
window.edFrameOutlineChanged=function(){ FACE_LOOK_GEN++; frLookChanged('edge'); };
/* Every drawn face follows: the grids (scheduleFace redraws a tile whose look generation is stale), the editor's preview, the board. */
function frLookChanged(what){
  if(what!=='back'){
    try{ if(typeof scheduleFace==='function') scheduleFace(); }catch(_){}
    try{ if(typeof curCard==='function'&&typeof renderPreview==='function'){ var c=curCard(); if(c) renderPreview(c); } }catch(_){}
  }
  try{ if(document.body.classList.contains('testdeck-active')&&typeof tdRender==='function') tdRender(); }catch(_){}
  tppSync(what);
}
window.edFrameBoot=function(){ try{ frGalLoad(); }catch(_){} try{ frNoiseDefs(); }catch(_){} };

/* ===== The Templates page (#tplPageBody): Card Frame with the Outline row, Card Back, Stat Icons, and Adjustments at the foot =====
   The old Templates window (guides, uploads, custom icons) stays as it was, behind Adjustments. Since session 92 the page has no
   jump bar and no Art section: Full art is a card's own option in the editor's art row. */
var TPP_SECS=[['frame','Card Frame'],['back','Card Back'],['orbs','Stat Icons']];
function frSampleCard(){
  var c=null;
  try{ c=(typeof curCard==='function')?curCard():null; }catch(_){}
  if(c) return c;
  var all=window.CARDS||[];
  for(var i=0;i<all.length;i++){ try{ if(all[i]&&cardOrbs(all[i]).length) return all[i]; }catch(_){} }
  return all[0]||null;
}
/* A face drawn under another look than the current one, for the picker tiles. */
function frWithLook(patch,fn){
  var keep=FR_LOOK, next=frLookBody();
  Object.keys(patch).forEach(function(k){ next[k]=patch[k]; });
  FR_LOOK=next;
  try{ return fn(); } finally{ FR_LOOK=keep; }
}
function tppOpt(attr,key,on,inner,name){
  return "<div class='tpp-opt"+(on?' on':'')+"' role='button' tabindex='0' aria-pressed='"+(on?'true':'false')+"' data-tpp-"+attr+"='"+key+"'>"
    +inner+"<span class='tpp-name'>"+name+"</span></div>";
}
function tppHead(id,title,n){
  return "<h3 class='kwp-head' id='tppsec-"+id+"'>"+title+"<span class='kwp-count'>"+n+"</span></h3>";
}
/* the Outline row (session 92, from the Adjustments window): On or Off, edSetEdge (ed2_face.js), the lit one the state in force */
function tppEdgeRow(){
  var off=frOutlineOff();
  return "<div class='tpp-row tpp-edge'><span class='tpp-lbl'>Outline</span>"
    +"<button type='button' class='nb nb-gold nb-s"+(off?'':' on')+"' data-tpp-edge='gradient' aria-pressed='"+(off?'false':'true')+"'>On</button>"
    +"<button type='button' class='nb nb-gold nb-s"+(off?' on':'')+"' data-tpp-edge='none' aria-pressed='"+(off?'true':'false')+"'>Off</button>"
    +"<i class='tpp-hint'>The card’s outer border. Off, the frame’s field reaches the card’s edge; every box keeps its own.</i></div>";
}
function tppFramesHTML(){
  var c=frSampleCard();
  return tppHead('frame','Card Frame',FR_KEYS.length)+"<div class='tpp-grid tpp-frames'>"
    +FR_KEYS.map(function(k){
      var face='';
      if(c){ try{ face=frWithLook({frame:k},function(){ return buildFaceHTML(c,{}); }); }catch(_){ face=''; } }
      var inner="<span class='tpp-card'>"+(face?"<div class='mcard-fit'><div class='mcard-scale'>"+face+"</div></div>":"")+"</span>";
      return tppOpt('frame',k,FR_LOOK.frame===k,inner,FR_NAMES[k]);
    }).join('')+"</div>"+tppEdgeRow();
}
function tppOrbRow(mode){
  var vals=[['attack','3'],['health','4'],['arcane','2']];
  if(window.REBIRTH) vals.push(['range','1']);
  return "<span class='tpp-icons'>"+vals.map(function(v){
    return "<span class='m-orb-slot'>"+frOrbSvg(v[0],v[1],frUid(),mode)+"</span>";
  }).join('')+"</span>";
}
function tppOrbsHTML(){
  var own=FR_ORB_OF[frFrameKey()]||'app';
  var list=[['','Frame’s own ('+FR_ORB_NAMES[own]+')',own]].concat(FR_ORB_SETS.map(function(k){ return [k,FR_ORB_NAMES[k],k]; }));
  /* two rows of tiles, whatever their number (session 92): the columns are half the tiles, rounded up, the odd one's place left empty */
  return tppHead('orbs','Stat Icons',FR_ORB_SETS.length)+"<div class='tpp-grid tpp-orbsets' style='grid-template-columns:repeat("+Math.ceil(list.length/2)+",minmax(0,1fr))'>"
    +list.map(function(e){ return tppOpt('orbs',e[0],FR_LOOK.orbs===e[0],tppOrbRow(e[2]),e[1]); }).join('')+"</div>";
}
function tppBackHTML(){
  var list=window.CB_LIST||[], cur=FR_LOOK.back||frBackDefault();
  return tppHead('back','Card Back',list.length)+"<div class='tpp-grid tpp-backs'>"
    +list.map(function(b){
      return tppOpt('back',b.key,cur===b.key,"<span class='tpp-back cbk-tok cbk-tok-"+b.key+"'></span>",b.name);
    }).join('')+"</div>";
}
function tppFitFaces(root){
  if(typeof scaleFaceIn!=='function') return;
  root.querySelectorAll('.tpp-card .mcard-fit').forEach(function(w){ try{ scaleFaceIn(w); }catch(_){} });
}
window.edRenderTplPage=function(){
  var body=document.getElementById('tplPageBody');
  if(!body) return;
  /* the foot stays in view (frames.css: sticky at the page's bottom), so Adjustments is always to hand */
  body.innerHTML="<div class='tpp-sec' data-tpp-sec='frame'>"+tppFramesHTML()+"</div>"
    +"<div class='tpp-sec' data-tpp-sec='back'>"+tppBackHTML()+"</div>"
    +"<div class='tpp-sec' data-tpp-sec='orbs'>"+tppOrbsHTML()+"</div>"
    +"<div class='tpp-foot'><button type='button' class='nb nb-gold nb-l' onclick='edOpenTemplates()'>Adjustments</button></div>";
  tppBind(body);
  tppFitFaces(body);
};
function tppPick(el){
  var t=el.closest('[data-tpp-frame],[data-tpp-orbs],[data-tpp-back],[data-tpp-edge]'); if(!t) return;
  if(t.hasAttribute('data-tpp-frame')) window.edSetFrameLook(t.getAttribute('data-tpp-frame'));
  else if(t.hasAttribute('data-tpp-orbs')) window.edSetOrbs(t.getAttribute('data-tpp-orbs'));
  else if(t.hasAttribute('data-tpp-edge')){ if(typeof window.edSetEdge==='function') window.edSetEdge(t.getAttribute('data-tpp-edge')); }
  else window.edSetBack(t.getAttribute('data-tpp-back'));
}
function tppBind(body){
  if(body.__tpp) return; body.__tpp=1;
  body.addEventListener('click',function(e){ tppPick(e.target); });
  body.addEventListener('keydown',function(e){
    if(e.key!=='Enter'&&e.key!==' ') return;
    var t=e.target.closest('.tpp-opt'); if(!t) return;
    e.preventDefault(); tppPick(t);
  });
}
function tppMark(sec,attr,cur){
  sec.querySelectorAll('[data-tpp-'+attr+']').forEach(function(el){
    var on=el.getAttribute('data-tpp-'+attr)===cur;
    el.classList.toggle('on',on); el.setAttribute('aria-pressed',on?'true':'false');
  });
}
/* The page follows a change: the picked tile lights, and the tiles that show the other choice are drawn again. */
function tppSync(what){
  var body=document.getElementById('tplPageBody'), pane=document.getElementById('pane-templates');
  if(!body||!pane||pane.style.display==='none'||!body.__tpp) return;
  var secs={};
  body.querySelectorAll('.tpp-sec').forEach(function(s){ secs[s.getAttribute('data-tpp-sec')]=s; });
  if(!secs.frame||!secs.orbs||!secs.back) return;
  var faces=function(){ secs.frame.innerHTML=tppFramesHTML(); tppFitFaces(secs.frame); };
  if(what==='back'){ tppMark(secs.back,'back',FR_LOOK.back||frBackDefault()); return; }
  if(what==='frame'){ tppMark(secs.frame,'frame',FR_LOOK.frame); secs.orbs.innerHTML=tppOrbsHTML(); return; }
  /* the Outline changed: the mini faces are drawn again, their fills shaped to it, and the row's lit button follows */
  if(what==='edge'||what==='orbs'){ faces(); return; }
  window.edRenderTplPage();
}
