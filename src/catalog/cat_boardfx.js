/* Nothing here is board state: effects are drawn from the board or set off live through tdFxAction, so a replay, undo or resync plays nothing.
   One pulse (TD_PULSE_MS): each look starts from the wall clock when drawn, so they breathe together (HANDOFF §10, O61). */

var TDFX = {since:{}, hold:{}, landing:{}, items:[], rects:{}, emitOn:false, uid:0, fired:{}, kacc:0,
            running:false, last:0, acc:0, accStar:0, tt:0, burst:0};
var TDFX_COL = {red:'#ff4d3d', orange:'#ff9a2e', yellow:'#ffe14a', green:'#3ddc84',
                blue:'#3ab7ff', indigo:'#7a63ff', violet:'#d84dff', grey:'#9aa0aa'};
var TDFX_GREYS = ['#2f3238', '#4a4e57', '#6b707b', '#a9adb6', '#d3d6dc'];
var TDFX_FLAME = ['#ff3b3b', '#ff7a1a', '#ffb347'];

function tdFxReduced(){
  try{ return matchMedia('(prefers-reduced-motion:reduce)').matches; }
  catch(_){ return false; }
}
function tdFxRnd(a, b){ return a + Math.random() * (b - a); }
function tdFxPick(a){ return a[(Math.random() * a.length) | 0]; }
function tdFxEaseOut(t){ return 1 - Math.pow(1 - t, 3); }
function tdFxEaseInOut(t){ return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
function tdFxMix(h1, h2, t){
  var a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16);
  function ch(s){ return Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t); }
  return 'rgb(' + ch(16) + ',' + ch(8) + ',' + ch(0) + ')';
}
function tdFxHasSuper(c, w){
  return !!c && (c.superTypes || []).some(function(s){ return String(s).toLowerCase() === w; });
}
function tdFxPalette(c){
  var cs = ((c && c.colors) || []).map(function(x){ return String(x).toLowerCase(); })
    .filter(function(x){ return TDFX_COL[x]; });
  return (cs.length ? cs : ['grey']).map(function(x){ return TDFX_COL[x]; });
}
function tdFxEssCols(c){
  try{
    return (tdEssenceColors(c) || []).map(function(x){ return String(x).toLowerCase(); })
      .filter(function(x){ return TDFX_COL[x]; });
  }catch(_){ return []; }
}
function tdFxEl(uid){
  return document.querySelector('#tdBoard .td-card' + tdSel(uid));
}
function tdFxRect(el){
  var r = el.getBoundingClientRect();
  return {x:r.left, y:r.top, w:r.width, h:r.height, cx:r.left + r.width / 2, cy:r.top + r.height / 2};
}
/* Read off the real face in its own unscaled, unturned coordinates. */
function tdFxArtFrac(el){
  var m = el.querySelector('.mcard'), a = el.querySelector('.m-art');
  if(!m || !a || !m.offsetHeight) return .42;
  var top = 0, n = a;
  while(n && n !== m){ top += n.offsetTop; n = n.offsetParent; }
  if(n !== m) return .42;
  return Math.max(.15, Math.min(.8, (top + a.offsetHeight / 2) / m.offsetHeight));
}

/* No shadowBlur where it repeats (HANDOFF §64): each look is drawn once, glow and all, into a cached sprite.
   Particles are plain records sharing their kind's update and draw (TDFX_KIND); only 'custom' brings its own. */
function tdFxCanvas(){
  var cv = document.getElementById('tdFxCanvas');
  if(cv) return cv;
  cv = document.createElement('canvas');
  cv.id = 'tdFxCanvas';
  cv.setAttribute('aria-hidden', 'true');
  document.body.appendChild(cv);
  TDFX.ctx = cv.getContext && cv.getContext('2d');
  tdFxSize();
  window.addEventListener('resize', tdFxSize);
  /* A scroll redraws nothing, so it wakes the stopped loop itself; capture, because element scrolls do not bubble. */
  document.addEventListener('scroll', function(){
    if(!TDFX.running && document.querySelector('#tdBoard .td-fx-decl, #tdBoard .td-card.td-fx-play, #tdBoard .td-card.td-pfx-burst')) tdFxKick();
  }, {passive:true, capture:true});
  return cv;
}
function tdFxSize(){
  var cv = document.getElementById('tdFxCanvas');
  if(!cv || !TDFX.ctx) return;
  var d = Math.min(2, window.devicePixelRatio || 1);
  /* sprites are drawn at the screen's density, so a new density draws them again */
  if(d !== TDFX.dpr){ TDFX.spr = {}; TDFX.sprN = 0; }
  TDFX.dpr = d;
  TDFX.W = window.innerWidth; TDFX.H = window.innerHeight;
  cv.width = TDFX.W * d; cv.height = TDFX.H * d;
  TDFX.ctx.setTransform(d, 0, 0, d, 0, 0);
}

/* Sizes go by the half pixel (the pixel past 8), so a shrinking spark steps through a handful of sprites, not one a frame. */
TDFX.spr = {}; TDFX.sprN = 0;
function tdFxSprite(shape, fill, glow, r, blur){
  var rb = r < 8 ? Math.max(.5, Math.round(r * 2) / 2) : Math.round(r);
  var key = shape + '|' + fill + '|' + glow + '|' + rb + '|' + blur;
  var s = TDFX.spr[key];
  if(s) return s;
  if(TDFX.sprN > 800){ TDFX.spr = {}; TDFX.sprN = 0; }      // a bound, never reached in play
  var d = TDFX.dpr || 1, half = rb + blur * 1.6 / d, px = Math.max(2, Math.ceil(half * 2 * d));
  var cv = document.createElement('canvas');
  cv.width = cv.height = px;
  var c = cv.getContext('2d');
  c.setTransform(d, 0, 0, d, px / 2, px / 2);
  c.fillStyle = fill;
  if(blur){ c.shadowColor = glow; c.shadowBlur = blur; }
  if(shape === 'star') tdFxStar(c, 0, 0, rb, 0);
  else { c.beginPath(); c.arc(0, 0, rb, 0, 7); c.fill(); }
  s = {cv:cv, half:px / 2 / d};
  TDFX.spr[key] = s; TDFX.sprN++;
  return s;
}
function tdFxPuffSprite(hex){
  var key = 'puff|' + hex, s = TDFX.spr[key];
  if(s) return s;
  var n = parseInt(hex.slice(1), 16), rgb = (n >> 16) + ',' + ((n >> 8) & 255) + ',' + (n & 255);
  var cv = document.createElement('canvas'); cv.width = cv.height = 64;
  var c = cv.getContext('2d'), g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
  g.addColorStop(0, 'rgba(' + rgb + ',1)'); g.addColorStop(1, 'rgba(' + rgb + ',0)');
  c.fillStyle = g; c.fillRect(0, 0, 64, 64);
  s = {cv:cv}; TDFX.spr[key] = s; TDFX.sprN++;
  return s;
}
function tdFxBlit(c, s, x, y){ c.drawImage(s.cv, x - s.half, y - s.half, s.half * 2, s.half * 2); }
/* The canvas's base transform is put back after. */
function tdFxBlitTurned(c, s, x, y, rot, sc){
  var h = s.half * (sc || 1);
  c.translate(x, y); c.rotate(rot);
  c.drawImage(s.cv, -h, -h, h * 2, h * 2);
  var d = TDFX.dpr || 1; c.setTransform(d, 0, 0, d, 0, 0);
}
/* 15-degree steps, so the flying gem's rainbow is a few dozen sprites rather than one per frame. */
function tdFxHue(h, l){ return 'hsl(' + ((Math.round(h / 15) * 15) % 360) + ',100%,' + l + '%)'; }

var TDFX_KIND = {
  spark:{
    update:function(p, dt){ var f = Math.pow(p.drag, dt * 60); p.vx *= f; p.vy = p.vy * f + p.g * dt; p.x += p.vx * dt; p.y += p.vy * dt; },
    draw:function(c, p, k){ c.globalAlpha = 1 - k; tdFxBlit(c, tdFxSprite('dot', p.color, p.color, p.size * (1 - k * .5), 8), p.x, p.y); }
  },
  chunk:{ blend:'source-over',
    update:function(p, dt){ var f = Math.pow(.97, dt * 60); p.vx *= f; p.vy *= f; p.x += p.vx * dt; p.y += p.vy * dt; },
    draw:function(c, p, k){
      var sz = p.sz; c.globalAlpha = 1 - k * k; c.fillStyle = p.color;
      c.translate(p.x, p.y); c.rotate(p.rot0 + p.spin * p.age);
      c.beginPath(); c.moveTo(-sz, -sz * .6); c.lineTo(sz * .8, -sz * .8); c.lineTo(sz, sz * .5); c.lineTo(-sz * .5, sz);
      c.closePath(); c.fill();
      var d = TDFX.dpr || 1; c.setTransform(d, 0, 0, d, 0, 0); }
  },
  puff:{ blend:'source-over',
    update:function(p, dt){ var f = Math.pow(.95, dt * 60); p.vx *= f; p.vy *= f; p.x += p.vx * dt; p.y += p.vy * dt; },
    draw:function(c, p, k){
      var r = p.r0 + (p.r1 - p.r0) * tdFxEaseOut(k);
      c.globalAlpha = p.a * (1 - k); c.drawImage(tdFxPuffSprite(p.color).cv, p.x - r, p.y - r, r * 2, r * 2); }
  },
  ring:{
    draw:function(c, p, k){
      var r = p.r0 + (p.r1 - p.r0) * tdFxEaseOut(k), lw = p.w * (1 - k) + .5;
      if(p.cols && p.cols.length > 1 && c.createConicGradient){
        if(!p.grad){
          p.grad = c.createConicGradient(-Math.PI / 2, p.x, p.y);
          var cs = p.cols.concat([p.cols[0]]);
          cs.forEach(function(col, i){ p.grad.addColorStop(i / (cs.length - 1), col); });
        }
        c.strokeStyle = p.grad;
      } else c.strokeStyle = p.color;
      c.beginPath(); c.ellipse(p.x, p.y, r, r * p.sy, 0, 0, 7);
      c.globalAlpha = (1 - k) * .28; c.lineWidth = lw + 7; c.stroke();
      c.globalAlpha = 1 - k; c.lineWidth = lw; c.stroke(); }
  },
  wisp:{
    draw:function(c, p, k){
      c.globalAlpha = Math.sin(Math.PI * k) * .9;
      tdFxBlit(c, tdFxSprite('dot', Math.random() < .1 ? '#ffffff' : '#5fb8ff', '#4aa8ff', 2.2 * (1 - k * .5), 12),
               p.x + Math.sin(p.ph + k * 7) * 10, p.y - k * 60); }
  },
  /* Rides its card's border, read from this frame's TDFX.rects, never looked up in the page. */
  mote:{
    draw:function(c, p, k){
      var b = TDFX.rects[p.uid];
      if(!b) return;
      var pt = tdFxOnRect(b, p.start + p.speed * p.age, 6 + k * 4.5);
      var share = p.half === 'bot' ? tdFxBotShare(b, pt[1]) : 1;
      if(share <= 0) return;
      c.globalAlpha = Math.sin(Math.PI * k) * share;
      tdFxBlit(c, tdFxSprite('dot', Math.random() < .08 ? '#fff6cc' : '#ffd75a', '#ffcc33', 2, 10), pt[0], pt[1]); }
  },
  star:{
    draw:function(c, p, k){
      c.globalAlpha = p.fade === 'sin' ? Math.sin(Math.PI * k) : 1 - k;
      tdFxBlitTurned(c, tdFxSprite('star', p.color, p.glow || p.color, p.r, p.blur), p.x, p.y, p.rot0 + p.spin * k); }
  },
  custom:{ draw:function(c, p, k){ p.draw(c, p, k); } }
};
function tdFxAdd(p){ p.age = 0; TDFX.items.push(p); tdFxKick(); return p; }
function tdFxKick(){
  if(TDFX.running) return;
  tdFxCanvas();
  if(!TDFX.ctx) return;
  TDFX.running = true;
  TDFX.last = performance.now();
  requestAnimationFrame(tdFxLoop);
}
/* Sleeps when nothing visible needs it; a render, or declared cards scrolled back into view, wakes it. */
function tdFxLoop(t){
  var ctx = TDFX.ctx, d = TDFX.dpr || 1, dt = Math.min(.05, (t - TDFX.last) / 1000);
  TDFX.last = t;
  ctx.setTransform(d, 0, 0, d, 0, 0);
  ctx.clearRect(0, 0, TDFX.W, TDFX.H);
  var host = document.getElementById('tdBoard');
  var br = host ? host.getBoundingClientRect() : null;
  var shown = !!(br && br.width && br.bottom > 0 && br.top < window.innerHeight);
  var live = 0;
  if(shown){ try{ live = tdFxDeclTick(dt, br); }catch(_){} }
  if(shown && typeof tdPfxTick === 'function'){ try{ live += tdPfxTick(dt); }catch(_){} }
  if(shown && TDFX.items.length){
    ctx.save();
    ctx.beginPath(); ctx.rect(br.left, br.top, br.width, br.height); ctx.clip();
    var blend = '';
    /* Compacted in place, not filtered into a new array: a draw can add particles meanwhile, and a filter dropped them. */
    var items = TDFX.items, n = items.length, keep = 0;
    for(var i = 0; i < n; i++){
      var p = items[i];
      p.age += dt;
      if(p.age >= p.life) continue;
      var K = TDFX_KIND[p.kind], k = p.age / p.life;
      if(K.update) K.update(p, dt);
      var b = p.blend || K.blend || 'lighter';
      if(b !== blend){ ctx.globalCompositeOperation = blend = b; }
      try{ K.draw(ctx, p, k); }catch(_){ ctx.setTransform(d, 0, 0, d, 0, 0); }
      /* A custom draw that moved the canvas and did not put it back must not carry that into the particles after it. */
      if(p.kind === 'custom') ctx.setTransform(d, 0, 0, d, 0, 0);
      items[keep++] = p;
    }
    tdFxCompact(items, n, keep);
    ctx.restore();
  } else {
    var all = TDFX.items, m = all.length, kept = 0;
    for(var j = 0; j < m; j++){
      all[j].age += dt;
      if(all[j].age < all[j].life) all[kept++] = all[j];
    }
    tdFxCompact(all, m, kept);
  }
  if(TDFX.items.length || live) requestAnimationFrame(tdFxLoop);
  else { TDFX.running = false; ctx.clearRect(0, 0, TDFX.W, TDFX.H); }
}
function tdFxCompact(items, n, keep){
  for(var i = n; i < items.length; i++) items[keep++] = items[i];
  items.length = keep;
}
function tdFxSpark(x, y, vx, vy, color, o){
  o = o || {};
  return tdFxAdd({kind:'spark', x:x, y:y, vx:vx, vy:vy, life:o.life || tdFxRnd(.5, 1.1), size:o.size || tdFxRnd(1.2, 2.8),
    g:o.g || 0, drag:o.drag == null ? .96 : o.drag, color:color});
}
function tdFxChunk(x, y, vx, vy, color){
  return tdFxAdd({kind:'chunk', x:x, y:y, vx:vx, vy:vy, life:tdFxRnd(.7, 1.2), color:color,
    rot0:tdFxRnd(0, 7), spin:tdFxRnd(-12, 12), sz:tdFxRnd(1.6, 3.6)});
}
function tdFxPuff(x, y, vx, vy, hex){
  return tdFxAdd({kind:'puff', x:x, y:y, vx:vx, vy:vy, life:tdFxRnd(1.1, 1.7), r0:tdFxRnd(8, 16), r1:tdFxRnd(36, 60), a:.3, color:hex});
}
function tdFxRing(x, y, color, o){
  o = o || {};
  return tdFxAdd({kind:'ring', x:x, y:y, life:o.life || .7, r0:o.r0 || 10, r1:o.r1 || 140, w:o.w || 4, color:color,
    sy:o.sy || 1, cols:o.cols});
}
function tdFxStarP(x, y, o){
  return tdFxAdd({kind:'star', x:x, y:y, life:o.life, r:o.r, rot0:o.rot0 || 0, spin:o.spin || 0,
    color:o.color, glow:o.glow, blur:o.blur == null ? 8 : o.blur, fade:o.fade});
}
function tdFxCustom(life, draw){ return tdFxAdd({kind:'custom', life:life, draw:draw}); }
function tdFxStar(c, x, y, r, rot){
  c.beginPath();
  for(var i = 0; i < 8; i++){ var a = rot + i * Math.PI / 4, rr = i % 2 ? r * .22 : r;
    c.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr); }
  c.closePath(); c.fill();
}
function tdFxHex(c, x, y, r, rot){
  c.beginPath();
  for(var i = 0; i < 6; i++){ var a = rot + i * Math.PI / 3; c.lineTo(x + Math.cos(a) * r, y + Math.sin(a) * r); }
  c.closePath();
}
function tdFxDiamonds(cx, cy, base){
  var sizes = [base, base * .9, base * tdFxRnd(.75, 1.15), base * tdFxRnd(.75, 1.15), base * tdFxRnd(.75, 1.15)];
  sizes.forEach(function(S, i){
    setTimeout(function(){
      var col = i % 2 ? '#fff2b8' : '#ffd24a', lw = i < 2 ? 3 : tdFxRnd(1.6, 2.6);
      tdFxCustom(tdFxRnd(.7, .95), function(c, p, k){
        var s = base * .15 + (S - base * .15) * tdFxEaseOut(k), d = TDFX.dpr || 1;
        c.translate(cx, cy); c.rotate(Math.PI / 4);
        c.strokeStyle = '#ffd24a'; c.globalAlpha = (1 - k) * .3; c.lineWidth = lw + 8; c.strokeRect(-s / 2, -s / 2, s, s);
        c.strokeStyle = col; c.globalAlpha = 1 - k; c.lineWidth = lw; c.strokeRect(-s / 2, -s / 2, s, s);
        c.setTransform(d, 0, 0, d, 0, 0);
      });
    }, i === 0 ? 0 : i * 95 + tdFxRnd(0, 70));
  });
}

function tdFxMythicOn(el){
  el.classList.remove('td-fx-myth'); void el.offsetWidth; el.classList.add('td-fx-myth');
  setTimeout(function(){ el.classList.remove('td-fx-myth'); }, 2300);
  var B = tdFxRect(el);
  for(var i = 0; i < 38; i++) (function(i){
    setTimeout(function(){
      var a = tdFxRnd(0, 7), r = tdFxRnd(B.w * .5, B.h * .8);
      tdFxStarP(B.cx + Math.cos(a) * r, B.cy + Math.sin(a) * r,
                {life:.8, r:5, spin:2.25, color:tdFxHue(i * 37, 80), blur:10, fade:'sin'});
    }, i * 40);
  })(i);
  tdFxTwinSparks(el);
}
/* The comet's painter is shared with cat_playfx.js, which draws it on a card's own canvases. */
var TDFX_HUES = ['#ff5a7a', '#ffb340', '#ffe95a', '#4fe08f', '#4ab8ff', '#9a6bff'];
function tdFxCometRoll(){
  return {dir:Math.random() < .5 ? -1 : 1, tilt:tdFxRnd(-.26, .26), a0:tdFxRnd(0, Math.PI * 2), tail:Math.floor(tdFxRnd(34, 49)),
          hy:tdFxRnd(-.3, .25), rx:tdFxRnd(.7, 1.05), ry:tdFxRnd(.14, .22)};
}
function tdFxCometColour(f){
  if(f >= .4) return '#ffffff';
  return TDFX_HUES[Math.min(5, Math.floor(f / .4 * 6))];
}
function tdFxCometPaint(c, R, k, q, which){
  var TAU = Math.PI * 2, fade = k < .1 ? k / .1 : k > .85 ? 1 - (k - .85) / .15 : 1;
  var head = q.a0 + q.dir * tdFxEaseOut(k) * TAU * 1.05, back = which === 'back';
  function at(ang){ var z = Math.sin(ang), x0 = Math.cos(ang) * R.w * q.rx, y0 = z * R.h * q.ry;
    return [R.cx + x0 * Math.cos(q.tilt) - y0 * Math.sin(q.tilt), R.cy + q.hy * R.h + x0 * Math.sin(q.tilt) + y0 * Math.cos(q.tilt), z]; }
  c.lineCap = 'round';
  for(var j = q.tail; j >= 1; j--){
    var p0 = at(head - q.dir * j * .04), p1 = at(head - q.dir * (j - 1) * .04);
    if((p0[2] < 0) !== back) continue;
    var f = j / q.tail, w = 5 * (1 - f) + 1, a = fade * (1 - f * .7);
    c.strokeStyle = tdFxCometColour(f);
    c.globalAlpha = a * .3; c.lineWidth = w + 6; c.beginPath(); c.moveTo(p0[0], p0[1]); c.lineTo(p1[0], p1[1]); c.stroke();
    c.globalAlpha = a; c.lineWidth = w; c.beginPath(); c.moveTo(p0[0], p0[1]); c.lineTo(p1[0], p1[1]); c.stroke();
  }
  var h = at(head);
  if((h[2] < 0) === back){
    c.globalAlpha = fade; c.save(); c.translate(h[0], h[1]); c.rotate(k * 8);
    tdFxBlit(c, tdFxSprite('star', '#ffe27a', '#ffc21a', 7, 12), 0, 0);
    tdFxBlit(c, tdFxSprite('star', '#fff6d0', '#ffd24a', 3, 4), 0, 0); c.restore();
  }
  c.globalAlpha = 1;
}
/* The board's canvas has no "behind", so the part behind the card is drawn with the card's box cut out. */
function tdFxUniqueComet(el){
  if(tdFxReduced()) return;
  var uid = el.getAttribute('data-uid'), q = tdFxCometRoll();
  TDFX.fired.unique = (TDFX.fired.unique || 0) + 1;
  var p = tdFxCustom(3.6, function(c, p, k){
    var e = (uid && tdFxEl(uid)) || el;
    if(!e.isConnected) return;
    var R = tdFxRect(e);
    c.save(); c.beginPath(); c.rect(0, 0, TDFX.W, TDFX.H); c.rect(R.x, R.y, R.w, R.h); c.clip('evenodd');
    tdFxCometPaint(c, R, k, q, 'back'); c.restore();
    tdFxCometPaint(c, R, k, q, 'front');
  });
  p.blend = 'source-over'; p.comet = true;
}

/* The painter is stateless (the time says everything), so cat_playfx.js draws it too. */
var TDFX_TWIN_GOLD = ['#ffd24a', '#fff2b8', '#c9962a'];
var TDFX_TWIN_RUN = 1.8, TDFX_TWIN_GAP = .22, TDFX_TWIN_FLASH = .75, TDFX_TWIN_RIM = 1;
function tdFxTwinRoll(){
  var n = 1 + Math.floor(Math.random() * 3), big = tdFxRnd(.8, 1.3), out = [];
  for(var i = 0; i < n; i++) out.push({at:i * TDFX_TWIN_GAP, off:TDFX_TWIN_RIM, big:big});
  return out;
}
function tdFxTwinLen(pairs){ return (pairs.length - 1) * TDFX_TWIN_GAP + TDFX_TWIN_RUN + TDFX_TWIN_FLASH; }
/* A point on the border box grown by off, from the top middle, clockwise. Square corners: at 1px out a spark
   is at most 3px off the card's 6px-rounded ring, inside the glow's blur. */
function tdFxRim(R, off, u){
  var x0 = R.x - off, y0 = R.y - off, w = R.w + 2 * off, h = R.h + 2 * off, P = 2 * (w + h);
  var d = ((u * P + w / 2) % P + P) % P;
  if(d < w) return [x0 + d, y0]; d -= w;
  if(d < h) return [x0 + w, y0 + d]; d -= h;
  if(d < w) return [x0 + w - d, y0 + h]; d -= w;
  return [x0, y0 + h - d];
}
function tdFxTwinPaint(c, R, t, pairs){
  var G = TDFX_TWIN_GOLD;
  pairs.forEach(function(p){
    var s = t - p.at;
    if(s < 0) return;
    var run = tdFxEaseOut(Math.min(1, s / TDFX_TWIN_RUN));
    [1, -1].forEach(function(d){
      for(var j = 12; j >= 1; j--){
        var q = tdFxRim(R, p.off, .5 + d * Math.max(0, run - j * .012) * .5);
        c.globalAlpha = (1 - j / 13) * .7; tdFxBlit(c, tdFxSprite('dot', G[j % 3], G[j % 3], 2.2 * (1 - j / 14), 0), q[0], q[1]);
      }
      if(run < 1){ var hd = tdFxRim(R, p.off, .5 + d * run * .5); c.globalAlpha = 1; tdFxBlit(c, tdFxSprite('star', '#fff2b8', G[0], 5, 9), hd[0], hd[1]); }
    });
    if(run >= 1){
      var f = Math.min(1, (s - TDFX_TWIN_RUN) / TDFX_TWIN_FLASH), m = tdFxRim(R, p.off, 0);
      if(f < 1){
        c.globalAlpha = 1 - f; tdFxBlit(c, tdFxSprite('star', '#ffffff', '#ffffff', 12 * p.big * (1 - f * .5), 12), m[0], m[1]);
        for(var i = 0; i < 18; i++){ var an = i / 18 * Math.PI * 2, r = (6 + f * 40) * p.big;
          tdFxBlit(c, tdFxSprite('dot', G[i % 3], G[i % 3], 1.3, 0), m[0] + Math.cos(an) * r, m[1] + Math.sin(an) * r); }
      }
    }
  });
  c.globalAlpha = 1;
}
function tdFxTwinSparks(el){
  if(tdFxReduced()) return;
  var uid = el.getAttribute('data-uid'), pairs = tdFxTwinRoll(), T = tdFxTwinLen(pairs);
  TDFX.fired.twins = (TDFX.fired.twins || 0) + 1; TDFX.lastTwins = pairs.length;
  tdFxCustom(T, function(c, p, k){
    var e = (uid && tdFxEl(uid)) || el;
    if(!e.isConnected) return;
    tdFxTwinPaint(c, tdFxRect(e), k * T, pairs);
  });
}

/* A step is reached, not landed on: one clicked straight past going forward is reached too, and going back reaches nothing. */
var TDFX_STEP_RX = /^\s*(your|each(?:\s+(?:player|opponent|other player)['’]s)?|your\s+opponent['’]s|opponent['’]s)\s+(unlock|onset|draw|key|start|declare attackers|declare blockers|battle damage|offset)(?:\s+(?:phase|step))?\s*[—–:\-]/i;
var TDFX_STEP_ID = {unlock:'unlock', onset:'onset', draw:'draw', key:'key', start:'start',
                    'declare attackers':'attack', 'declare blockers':'block', 'battle damage':'damage', offset:'offset'};
/* Kept beside the card, in a WeakMap, not on it: the card objects are the catalogue's own, saved and published. */
var TDFX_STEPS = (typeof WeakMap === 'function') ? new WeakMap() : null;
function tdFxStepTriggers(c){
  var r = String((c && c.ruleText) || '');
  var hit = (TDFX_STEPS && c && typeof c === 'object') ? TDFX_STEPS.get(c) : null;
  if(hit && hit.r === r) return hit.v;
  var v = [];
  r.split(/\r?\n/).forEach(function(line){
    var m = TDFX_STEP_RX.exec(line);
    if(!m) return;
    var w = m[1].toLowerCase().replace(/\s+/g, ' ');
    v.push({who:w === 'your' ? 'own' : /opponent|other/.test(w) ? 'other' : 'any', ph:TDFX_STEP_ID[m[2].toLowerCase().replace(/\s+/g, ' ')]});
  });
  if(TDFX_STEPS && c && typeof c === 'object') TDFX_STEPS.set(c, {r:r, v:v});
  return v;
}
function tdFxTurnIndex(t){
  var steps = tdSteps(), n = 0;
  for(var i = 0; i < steps.length; i++){
    if(steps[i].id === t.step) return n + t.phase;
    n += steps[i].phases.length;
  }
  return 0;
}
function tdFxStepRibbons(board, pre, a){
  if(!pre || tdFxReduced()) return;
  var now = tdTurnOf(board), to = tdFxTurnIndex(now), from = now.n > pre.n || a.newTurn ? -1 : tdFxTurnIndex(pre);
  if(to <= from) return;
  var reached = {}, steps = tdSteps(), i = 0;
  steps.forEach(function(s){ s.phases.forEach(function(p){ if(i > from && i <= to) reached[p.id] = 1; i++; }); });
  [TD.board].concat(tdFoeList()).forEach(function(half){
    if(!half || !half.zones) return;
    ['field', 'essarea', 'lord'].forEach(function(z){
      (half.zones[z] || []).forEach(function(it){
        if(!it.card || it.anon || it.down) return;
        var hit = tdFxStepTriggers(it.card).some(function(t){
          return reached[t.ph] && (t.who === 'any' || (t.who === 'own') === (half === board)); });
        if(hit) tdFxRibbon(it.uid, Object.keys(reached));
      });
    });
  });
}
function tdFxRibbon(uid, reached){
  var el = tdFxEl(uid);
  if(!el) return;
  var from = ['mid', 'left', 'right'][Math.floor(Math.random() * 3)], wav = tdFxRnd(1.5, 3.5);
  TDFX.fired.ribbon = (TDFX.fired.ribbon || 0) + 1;
  (TDFX.ribbons = TDFX.ribbons || []).push({uid:uid, steps:reached});
  if(TDFX.ribbons.length > 40) TDFX.ribbons.shift();
  var p = tdFxCustom(3.8, function(c, p, k){
    var e = tdFxEl(uid);
    if(!e) return;
    var R = tdFxRect(e), open = k < .25 ? tdFxEaseInOut(k / .25) : k > .78 ? 1 - tdFxEaseInOut((k - .78) / .22) : 1;
    var W = R.w * 1.1 * open, h = R.w * .14, y = R.y + R.h + 8, N = 24;
    if(W < 2) return;
    var x0 = from === 'left' ? R.cx - R.w * .55 : from === 'right' ? R.cx + R.w * .55 - W : R.cx - W / 2;
    function top(i){ return [x0 + W * i / N, y + Math.sin(i / N * Math.PI * 2 + k * 10) * wav]; }
    c.globalAlpha = Math.min(1, open * 3);
    [[-1, x0], [1, x0 + W]].forEach(function(s){ var sd = s[0], ex = s[1], ey = top(sd < 0 ? 0 : N)[1];
      c.fillStyle = '#7a5a1c'; c.beginPath(); c.moveTo(ex, ey + 3); c.lineTo(ex + sd * h * .9, ey + 3); c.lineTo(ex + sd * h * .5, ey + h / 2 + 3);
      c.lineTo(ex + sd * h * .9, ey + h + 3); c.lineTo(ex, ey + h + 3); c.fill(); });
    function band(dy){ c.beginPath(); for(var i = 0; i <= N; i++){ var q = top(i); if(i) c.lineTo(q[0], q[1] + dy); else c.moveTo(q[0], q[1] + dy); }
      for(var j = N; j >= 0; j--){ var q2 = top(j); c.lineTo(q2[0], q2[1] + h + dy); } c.closePath(); }
    c.fillStyle = 'rgba(0,0,0,.35)'; band(3); c.fill();
    var g = c.createLinearGradient(0, y, 0, y + h); g.addColorStop(0, '#fff2b8'); g.addColorStop(.5, '#ffd24a'); g.addColorStop(1, '#c9962a');
    c.fillStyle = g; band(0); c.fill();
    if(open > .6){ var m = top(N / 2); c.fillStyle = '#ffffff'; tdFxStar(c, x0 + W / 2, m[1] + h / 2, h * .38, 0); }
    c.globalAlpha = 1;
  });
  p.blend = 'source-over';
}

function tdFxSlam(uid, pre){
  var el = tdFxEl(uid);
  if(!el || !el.animate) return;
  var half = tdFxHalfOf(uid), at = tdFindIn(half, uid);
  var c = at && at.item.card;
  if(!c) return;
  var reduced = tdFxReduced(), pal = tdFxPalette(c);
  /* Measured before the drop, which only translates it, so this is where it lands. */
  var b = tdFxRect(el), cx = b.cx, cy = b.cy;
  pre = pre || {};
  if(!reduced && (pre.swift || pre.arrive)){
    if(pre.swift) tdFxWind(b);
    setTimeout(function(){
      if(pre.arrive) tdFxStarfall(b, pal);
      setTimeout(function(){
        delete TDFX.hold[uid];
        var now = tdFxEl(uid);
        if(!now || tdFxZoneOf(uid) !== 'field') return;   /* undone in the meantime */
        now.classList.remove('td-fx-hold');
        if(pre.arrive){
          if(now.animate) now.animate([{opacity:0, filter:'brightness(3)'}, {opacity:1, filter:'brightness(1)'}], {duration:420});
          tdFxRing(cx, cy, '#ffffff', {r0:5, r1:120 * b.w / 132, w:6, life:.4});
          tdFxSlamHit(uid, b, pal, c, at.item, half, pre.swift);
        } else tdFxSlamDrop(uid, b, pal, c, at.item, half, pre.swift);
      }, pre.arrive ? TDFX_STAR_MS : 0);
    }, pre.swift ? TDFX_WIND_MS : 0);
    return;
  }
  tdFxSlamDrop(uid, b, pal, c, at.item, half, false);
}
function tdFxSlamDrop(uid, b, pal, c, item, half, swift){
  var el = tdFxEl(uid), reduced = tdFxReduced();
  if(!reduced && el && el.animate)
    el.animate([{translate:'0 -220px', scale:'1.4', opacity:0}, {opacity:1, offset:.2}, {translate:'0 0', scale:'1', opacity:1}],
               {duration:340, easing:'cubic-bezier(.6,0,1,.4)'});
  setTimeout(function(){ tdFxSlamHit(uid, b, pal, c, item, half, swift); }, reduced ? 0 : 340);
}
function tdFxSlamHit(uid, b, pal, c, item, half, swift){
  var el = tdFxEl(uid), reduced = tdFxReduced(), cx = b.cx, cy = b.cy;
  (function(){
    var live = tdFxEl(uid) || el, board = (live && live.closest('.td-board')) || document.getElementById('tdBoard');
    if(!live) return;
    if(!reduced && board && board.animate)
      board.animate([{translate:'0 0'}, {translate:'-6px 4px'}, {translate:'5px -3px'}, {translate:'-3px 2px'},
                     {translate:'1px -1px'}, {translate:'0 0'}], {duration:360});
    if(!reduced && live.animate) live.animate([{scale:'1.06 .94'}, {scale:'1 1'}], {duration:220, easing:'ease-out'});
    var sc = b.w / 132;
    tdFxRing(cx, cy, pal[0], {r1:230 * sc, sy:.62, w:5, life:.8, cols:pal});
    tdFxRing(cx, cy, '#ffffff', {r1:160 * sc, sy:.62, w:2.5, life:.55});
    var per = 2 * (b.w + b.h), n = reduced ? 30 : 80;
    for(var i = 0; i < n; i++){
      var d = tdFxRnd(0, per), x, y;
      if(d < b.w){ x = b.x + d; y = b.y; }
      else if((d -= b.w) < b.h){ x = b.x + b.w; y = b.y + d; }
      else if((d -= b.h) < b.w){ x = b.x + b.w - d; y = b.y + b.h; }
      else { d -= b.w; x = b.x; y = b.y + b.h - d; }
      var a = Math.atan2(y - cy, x - cx) + tdFxRnd(-.25, .25), s = tdFxRnd(110, 300) * Math.max(.6, sc);
      if(Math.random() < .5) tdFxChunk(x, y, Math.cos(a) * s, Math.sin(a) * s, tdFxPick(TDFX_GREYS));
      else tdFxSpark(x, y, Math.cos(a) * s, Math.sin(a) * s, tdFxPick(pal), {drag:.97, size:tdFxRnd(1.3, 2.8), life:tdFxRnd(.6, 1.1)});
    }
    for(var j = 0; j < (reduced ? 6 : 16); j++){
      var q = tdFxRnd(0, 7);
      tdFxPuff(cx + Math.cos(q) * b.w * .55, cy + Math.sin(q) * b.h * .5,
               Math.cos(q) * tdFxRnd(50, 120), Math.sin(q) * tdFxRnd(50, 120), tdFxPick(['#8d8576', '#5c5f66', '#b9bcc4']));
    }
    if(swift && !reduced) setTimeout(function(){ tdFxSwiftSwords(b); }, 120);
    tdFxFinishes(uid, item, half, c, sc, 650);
  })();
}

/* The white diamond is its own element (.td-fx-dia), not in the symbols, so it pulses with the line and the line can find it. */
var TDFX_ICON = {
  sword:'<svg viewBox="0 -8 24 32" fill="currentColor"><polygon points="12,1 14.3,4 14.3,14 9.7,14 9.7,4"/>'
    + '<rect x="6.2" y="14" width="11.6" height="2.3" rx="1"/><rect x="10.9" y="16.3" width="2.2" height="4.3"/>'
    + '<circle cx="12" cy="21.7" r="1.7"/></svg>',
  shield:'<svg viewBox="0 -8 24 32" fill="currentColor"><path d="M12 1.5 20.5 4.6V11c0 5.6-3.5 9.6-8.5 11.5C7 20.6 3.5 16.6 3.5 11V4.6Z"/>'
    + '<path d="M12 5.2 17.3 7.1V11c0 3.7-2.2 6.4-5.3 7.7Z" fill="#fff" fill-opacity=".35"/></svg>',
  sigil:'<svg viewBox="0 -4 24 32"><g fill="none" stroke="currentColor"><circle cx="12" cy="12" r="10.4" stroke-width="1.8"/>'
    + '<circle cx="12" cy="12" r="8.2" stroke-width=".8"/><path d="M12 3.8 19.1 16.1H4.9ZM12 20.2 4.9 7.9H19.1Z" stroke-width="1.4"'
    + ' stroke-linejoin="round"/></g></svg>'
};
/* (12,-4) of the box 0 -8 24 32 is 12.5% down; (12,12) of 0 -4 24 32 is half way. */
var TDFX_DIA_TOP = {sword:'12.5%', shield:'12.5%', sigil:'50%'};
var TDFX_ROLES = {
  atk:  {icon:'sword',  ic:'#ff3b3b', top:'#ff3b3b', bot:'#ff3b3b', stat:'attack'},
  blk:  {icon:'shield', ic:'#ffcc33', top:'#ffcc33', bot:'#ffcc33', stat:'health'},
  thatk:{icon:'sigil',  ic:'#4aa8ff', top:'#ff3b3b', bot:'#4aa8ff', stat:'arcane'},
  thblk:{icon:'sigil',  ic:'#4aa8ff', top:'#4aa8ff', bot:'#ffcc33', stat:'arcane'}
};
function tdFxItemAnywhere(uid){
  var halves = [TD.board].concat(tdFoeList());
  for(var i = 0; i < halves.length; i++){
    var at = halves[i] && tdFindIn(halves[i], uid);
    if(at && at.zone === 'field') return at.item;
  }
  return null;
}
/* A blocker of a Thaumaturge attacker blocks with Arcane, whether or not it has Thaumaturge itself. */
function tdFxRoleOf(item){
  if(!item || !item.decl) return '';
  if(item.decl === 'atk') return 'atk';
  if(item.decl === 'thm') return 'thatk';
  if(item.decl === 'blk'){
    var t = item.blocks ? tdFxItemAnywhere(item.blocks) : null;
    return (t && t.decl === 'thm') ? 'thblk' : 'blk';
  }
  return '';
}
function tdFxStatFor(card, want){
  var orbs = [];
  try{ orbs = window.edCardOrbs ? window.edCardOrbs(card) : (card.orbs || []); }catch(_){ orbs = card.orbs || []; }
  function ok(o){ return o && o.type && o.type !== 'hidden' && o.type !== 'blank'; }
  for(var i = 0; i < orbs.length; i++) if(ok(orbs[i]) && orbs[i].type === want) return orbs[i];
  for(var j = 0; j < orbs.length; j++)
    if(ok(orbs[j]) && orbs[j].type.indexOf(want) >= 0 && orbs[j].type.indexOf(' and ') > 0) return orbs[j];
  return null;
}

function tdFxCard(item, zone, c, board){
  var out = {cls:'', style:'', html:'', after:''};
  if(!item || !zone) return out;
  var now = Date.now(), hold = TDFX.hold[item.uid];
  if(hold){
    if(now >= hold.until) delete TDFX.hold[item.uid];
    else if(hold.zone === zone.id) out.cls += ' td-fx-hold';
  }
  var P = (typeof tdPfxCard === 'function') ? tdPfxCard(item, zone, c, board) : null;
  if(P){ out.cls += P.cls; out.style += P.style; out.html += P.html; out.after += P.after || ''; }
  if(zone.id !== 'field') delete TDFX.since[item.uid];
  if(zone.id === 'field'){
    var role = tdFxRoleOf(item);
    if(!role){ delete TDFX.since[item.uid]; return out; }
    /* Kept per uid and per card: another card at a uid that came back starts its own look. */
    var was = TDFX.since[item.uid];
    if(!was || was.role !== role || was.card !== c) was = TDFX.since[item.uid] = {role:role, at:now, card:c};
    var R = TDFX_ROLES[role], lag = 'animation-delay:' + (-(now % TD_PULSE_MS)) + 'ms';
    out.cls += ' td-fx-decl td-fx-' + role;
    out.style = '--fx-age:' + (-(now - was.at)) + 'ms;';
    var A = (role === 'atk' || role === 'thatk') ? tdFxAtkHTML(item, board, role, c) : null;
    /* An aura is the default glow three times over, each masked to its band, so its ring, blur and pulse are the plain attacker's. */
    var aura = (A && role === 'atk' && A.set.aura) ? TDFX_AURA[A.set.aura] : null;
    var bands = !aura ? null
      : A.set.aura === 'ub' ? aura.map(function(g, i){ return [g, 'a' + (i + 1)]; })
      : [[R.top, 'top'], [aura[1], 'b2'], [aura[2], 'b3']];
    out.html += bands
      ? bands.map(function(b){
          return "<div class='td-fx-gwrap td-fx-" + b[1] + "' style='--g:" + b[0] + ';' + lag + "'><div class='td-fx-glow'></div></div>"; }).join('')
      : R.top === R.bot
      ? "<div class='td-fx-gwrap' style='--g:" + R.top + ';' + lag + "'><div class='td-fx-glow'></div></div>"
      : "<div class='td-fx-gwrap td-fx-top' style='--g:" + R.top + ';' + lag + "'><div class='td-fx-glow'></div></div>"
        + "<div class='td-fx-gwrap td-fx-bot' style='--g:" + R.bot + ';' + lag + "'><div class='td-fx-glow'></div></div>";
    var weapon = (A && role === 'atk' && (A.set.aura || A.set.has.Shade || A.set.has.Lethal || A.set.has.Unblockable)) ? tdFxWeaponSVG(A.set) : TDFX_ICON[R.icon];
    var ic = (A && role === 'atk' && A.set.aura) ? TDFX_AURA[A.set.aura][1] : R.ic;
    if(A){ out.cls += A.cls; out.html += A.html; }
    out.html += "<div class='td-fx-icon' style='--ic:" + ic + "'>" + weapon
      + "<i class='td-fx-dia' style='top:" + TDFX_DIA_TOP[R.icon] + ';' + lag + "'><b></b></i></div>";
    var o = (c && !item.anon && window.edOrbSvg) ? tdFxStatFor(c, R.stat) : null;
    if(o){
      var title = String(o.type + ' ' + o.value).replace(/[&<>'"]/g, '');
      out.html += "<div class='td-fx-stat' title='" + title + "'>" + window.edOrbSvg(o.type, o.value, 40) + '</div>';
    }
  } else if(zone.id === 'essarea' && c && !item.anon && !item.down && !TDFX.landing[item.uid]){
    var cols = tdFxEssCols(c);
    if(cols.length){
      out.cls += ' td-fx-gemcard';
      out.html += tdFxGemHTML(c, cols, false, tdCardHasKw(item, 'Unique', board));
    }
  }
  return out;
}
function tdFxGemHTML(c, cols, pop, uniq){
  return "<div class='td-fx-gem" + (tdFxHasSuper(c, 'mythic') ? ' td-fx-mythic' : '')
    + (uniq ? ' td-fx-unique' : '') + (pop ? ' td-fx-pop' : '')
    + "' style='--g1:" + TDFX_COL[cols[0]] + ';--g2:' + TDFX_COL[cols[1] || cols[0]] + "'></div>";
}

/* In board coordinates, the arrow layer's: the symbol's white diamond, or the card's centre while there is no symbol. */
function tdFxAnchor(uid, br){
  var el = tdFxEl(uid);
  var d = el && el.querySelector(':scope > .td-fx-icon .td-fx-dia');
  if(d){
    var r = d.getBoundingClientRect();
    if(r.width) return {x:r.left + r.width / 2 - br.left, y:r.top + r.height / 2 - br.top};
  }
  return tdCardCentre(uid, br);
}

/* tdRender calls this outside any try, so it must not throw. */
function tdFxAfterRender(host){
  host = host || document.getElementById('tdBoard');
  if(!host) return;
  /* Everything measured first, then everything written: interleaved, each card cost the page a layout of its own. */
  var els = host.querySelectorAll('.td-card.td-fx-decl, .td-card.td-fx-gemcard');
  var fracs = [];
  for(var i = 0; i < els.length; i++) fracs.push(tdFxArtFrac(els[i]));
  var rests = host.querySelectorAll('.td-pfx-rest[data-for]');
  var spots = [];
  for(var r = 0; r < rests.length; r++){
    /* Its own card, in the same zone of the same half: one uid can be on two halves. */
    var sel = '.td-card' + tdSel(rests[r].getAttribute('data-for'));
    var near = rests[r].parentNode;
    var card = (near && near.querySelector(':scope > ' + sel)) || host.querySelector(sel);
    spots.push(card ? {left:card.style.left || card.offsetLeft + 'px',
                       top:card.style.top || card.offsetTop + 'px'} : null);
  }
  for(i = 0; i < els.length; i++)
    els[i].style.setProperty('--fx-art', (fracs[i] * 100).toFixed(1) + '%');
  for(r = 0; r < rests.length; r++){
    if(!spots[r]){ rests[r].remove(); continue; }
    rests[r].style.left = spots[r].left;
    rests[r].style.top = spots[r].top;
  }
  if(host.querySelector('.td-fx-decl, .td-fx-play, .td-pfx-burst')) tdFxKick();
}

function tdFxEdgePoint(b){
  var edge = Math.random();
  if(Math.random() < .5) return [b.x + edge * b.w, b.y + (Math.random() < .5 ? 0 : b.h)];
  return [b.x + (Math.random() < .5 ? 0 : b.w), b.y + edge * b.h];
}
function tdFxOnRect(b, d, out){
  var w = b.w + out * 2, h = b.h + out * 2, x0 = b.x - out, y0 = b.y - out, P = 2 * (w + h);
  d = ((d % P) + P) % P;
  if(d < w) return [x0 + d, y0]; d -= w;
  if(d < h) return [x0 + w, y0 + d]; d -= h;
  if(d < w) return [x0 + w - d, y0 + h]; d -= w;
  return [x0, y0 + h - d];
}
/* The two halves of a Thaumaturge look blend over the card's middle quarter (37.5% to 62.5%), as the glow's masks do. */
function tdFxBotShare(b, y){
  return Math.max(0, Math.min(1, ((y - b.y) / b.h - .375) / .25));
}
function tdFxFlame(x, y, pal){
  tdFxSpark(x, y, tdFxRnd(-12, 12), -tdFxRnd(35, 95), tdFxPick(pal || TDFX_FLAME), {drag:.99, size:tdFxRnd(1.3, 2.8), life:tdFxRnd(.5, .9)});
}
function tdFxWisp(x, y){
  tdFxAdd({kind:'wisp', x:x, y:y, ph:tdFxRnd(0, 7), life:tdFxRnd(1, 1.5)});
}
function tdFxMote(uid, half){
  tdFxAdd({kind:'mote', uid:uid, half:half, start:tdFxRnd(0, 2000),
           speed:tdFxRnd(45, 82.5) * (Math.random() < .5 ? 1 : -1), life:tdFxRnd(1.1, 1.7)});
}
/* From inside the brackets: a floating card's transform is matrix3d(...), and a bare number match reads its "3". */
function tdFxTurnOf(el){
  var m = getComputedStyle(el).transform;
  if(!m || m === 'none') return 0;
  var v = m.slice(m.indexOf('(') + 1, m.lastIndexOf(')')).split(',').map(Number);
  return Math.atan2(v[1], v[0]) * 180 / Math.PI - (el.classList.contains('locked') ? 90 : 0);
}
/* Every read first, every write after (HANDOFF §64): a write between two reads lays the page out again, once per card per frame.
   Writes happen only when something changed. Answers how many declared cards are on screen; the loop sleeps at 0. */
function tdFxDeclTick(dt, br){
  var host = document.getElementById('tdBoard');
  var cards = host.querySelectorAll('.td-card.td-fx-decl');
  TDFX.rects = {};
  if(!cards.length) return 0;
  TDFX.tt += dt; TDFX.acc += dt; TDFX.accStar += dt; TDFX.burst += dt;
  var burstDue = TDFX.burst >= 3, vw = window.innerWidth, vh = window.innerHeight;
  var list = [], rects = TDFX.rects, i;
  for(i = 0; i < cards.length; i++){
    var el = cards[i], r = el.getBoundingClientRect();
    if(!r.width) continue;
    if(el.__fxRole === undefined){
      el.__fxRole = (el.className.match(/td-fx-(atk|blk|thatk|thblk)\b/) || [])[1] || '';
      el.__fxIcon = el.querySelector(':scope > .td-fx-icon');
      el.__fxDia = el.__fxIcon && el.__fxIcon.querySelector('.td-fx-dia');
      /* Only the gradients the app turns (data-rot): a combined orb's fade masks are its seam, and turning them stood it on end. */
      el.__fxGs = el.querySelectorAll(':scope > .td-fx-stat linearGradient[data-rot]');
      el.__fxKw = {};
      (el.className.match(/td-fx-k-[a-z]+/g) || []).forEach(function(k){ el.__fxKw[k.slice(8)] = 1; });
      el.__fxIc = el.__fxIcon ? el.__fxIcon.style.getPropertyValue('--ic') : '';
      var it = tdFxItemAnywhere(el.getAttribute('data-uid'));
      el.__fxCols = tdFxPalette(it && it.card);
    }
    var b = {x:r.left, y:r.top, w:r.width, h:r.height, cx:r.left + r.width / 2, cy:r.top + r.height / 2,
             on:r.bottom > 0 && r.top < vh && r.right > 0 && r.left < vw};
    var dr = el.__fxDia ? el.__fxDia.getBoundingClientRect() : null;
    b.dia = (dr && dr.width) ? {x:dr.left + dr.width / 2 - br.left, y:dr.top + dr.height / 2 - br.top}
                             : {x:b.cx - br.left, y:b.cy - br.top};
    var uid = el.getAttribute('data-uid');
    rects[uid] = b;
    list.push({el:el, uid:uid, role:el.__fxRole, b:b, kw:el.__fxKw, cols:el.__fxCols,
               ang:el.__fxGs.length ? 120 + tdFxTurnOf(el) * 14 : null,
               icr:(burstDue && el.__fxIcon) ? tdFxRect(el.__fxIcon) : null});
  }
  var lines = host.querySelectorAll('.td-blockline[data-from]');
  list.forEach(function(d){
    if(d.ang == null || (d.el.__fxAng != null && Math.abs(d.ang - d.el.__fxAng) < 1)) return;
    d.el.__fxAng = d.ang;
    for(var g = 0; g < d.el.__fxGs.length; g++)
      d.el.__fxGs[g].setAttribute('gradientTransform', 'rotate(' + d.ang.toFixed(1) + ' .5 .5)');
  });
  for(var l = 0; l < lines.length; l++){
    var L = lines[l], f = rects[L.getAttribute('data-from')], t = rects[L.getAttribute('data-to')];
    if(!f || !t) continue;
    var v = [f.dia.x, f.dia.y, t.dia.x, t.dia.y], o = L.__fx;
    if(o && Math.abs(o[0] - v[0]) < .5 && Math.abs(o[1] - v[1]) < .5
         && Math.abs(o[2] - v[2]) < .5 && Math.abs(o[3] - v[3]) < .5) continue;
    L.__fx = v;
    L.setAttribute('x1', v[0].toFixed(1)); L.setAttribute('y1', v[1].toFixed(1));
    L.setAttribute('x2', v[2].toFixed(1)); L.setAttribute('y2', v[3].toFixed(1));
  }
  list = list.filter(function(d){ return d.b.on; });
  if(TDFX.acc >= (tdFxReduced() ? .09 : .03)){
    TDFX.acc = 0;
    list.forEach(function(d){
      var b = d.b, pt;
      var pal = d.kw.unblockable ? TDFX_FLAME_UB : null;
      if(d.role === 'atk'){ if(!d.kw.shade){ pt = tdFxEdgePoint(b); tdFxFlame(pt[0], pt[1], pal); } }
      else if(d.role === 'blk') tdFxMote(d.uid);
      else if(d.role === 'thatk'){ pt = tdFxEdgePoint(b);
        if(Math.random() < tdFxBotShare(b, pt[1])) tdFxWisp(pt[0], pt[1]); else if(!d.kw.shade) tdFxFlame(pt[0], pt[1], pal); }
      else if(d.role === 'thblk'){ pt = tdFxEdgePoint(b);
        if(Math.random() >= tdFxBotShare(b, pt[1])) tdFxWisp(pt[0], pt[1]);
        if(Math.random() < .6) tdFxMote(d.uid, 'bot'); }
    });
  }
  TDFX.kacc += dt;
  if(TDFX.kacc >= (tdFxReduced() ? .24 : .08)){
    TDFX.kacc = 0;
    list.forEach(function(d){ if(d.role === 'atk' || d.role === 'thatk') tdFxKwTick(d); });
  }
  list.forEach(function(d){
    if(!d.kw.battlecry || tdFxReduced()) return;
    var since = TDFX.since[d.uid];
    if(!since) return;
    var n = Math.floor((Date.now() - since.at) / 5000);
    if(since.bc !== n){ since.bc = n; tdFxBattlecry(d.b, d.cols); }
  });
  if(TDFX.accStar >= .12){
    TDFX.accStar = 0;
    list.forEach(function(d){
      if(d.role !== 'thatk') return;
      var b = d.b;
      for(var s = 0; s < 3; s++){
        var a0 = TDFX.tt * 2 + s * 2.09;
        tdFxStarP(b.cx + Math.cos(a0) * b.w * .7, b.cy + Math.sin(a0) * b.h * .25 + b.h * .55,
                  {life:.4, r:3.5, rot0:a0, color:'#9fd0ff', glow:'#4aa8ff', blur:8});
      }
    });
  }
  if(burstDue){
    TDFX.burst = 0;
    list.forEach(function(d){
      var r = d.icr;
      if(!r) return;
      var col = d.el.__fxIc || (TDFX_ROLES[d.role] ? TDFX_ROLES[d.role].ic : '#ffffff');
      tdFxRing(r.cx, r.cy, col, {r0:5, r1:46, w:2.5, life:.5});
      for(var q = 0; q < 12; q++){ var a = tdFxRnd(0, 7);
        tdFxSpark(r.cx, r.cy, Math.cos(a) * tdFxRnd(50, 130), Math.sin(a) * tdFxRnd(50, 130), col, {life:.5}); }
    });
  }
  return list.length;
}

/* A keyword effect plays only for a keyword the card always has: a static one from the keyword line alone, an ability word
   (Battlecry, Raid, Arrive, Demise) only at a line's start, or a keyword counter of that name on the card. */
var TDFX_ABILITY_RX = /^\s*(Battlecry|Raid|Arrive|Demise)\b[^—–:\-\n]{0,12}?\s*[—–:\-]/;
var TDFX_PARAM_RX = /^\s*:?\s*((\d+|X|[+\-−]\d+|\([^)]*\)|\{[^}]*\})\s*)*$/;
var _tdFxKwNames = null, _tdFxKwFor = null;
/* Always known, even before the sync's keyword list lands, so "Swift" on a keyword line is still a keyword. */
var TDFX_OWN_KW = ['Airborne', 'Lethal', 'Overwhelm', 'Battlecry', 'Raid', 'Unblockable', 'Shade', 'Volley', 'Fury',
                   'Swift', 'Arrive', 'Demise', 'Absolute', 'Unique', 'Thaumaturge'];
function tdFxKwNames(){
  var all = window.KW_MATCHES || [];
  if(_tdFxKwNames && _tdFxKwFor === all) return _tdFxKwNames;
  var seen = {};
  _tdFxKwNames = all.filter(function(k){ return (k.mode || 'keyword') === 'keyword'; })
    .map(function(k){ return String(k.name); }).concat(TDFX_OWN_KW).filter(function(n){ return !seen[n] && (seen[n] = 1); })
    .sort(function(a, b){ return b.length - a.length; });
  _tdFxKwFor = all;
  return _tdFxKwNames;
}
function tdFxHalfOf(uid){
  var halves = [TD.board].concat(tdFoeList());
  for(var i = 0; i < halves.length; i++) if(halves[i] && tdFindIn(halves[i], uid)) return halves[i];
  return TD.board;
}
function tdFxKeywords(item, board){
  var out = [], seen = {};
  function add(n){ if(!seen[n]){ seen[n] = 1; out.push(n); } }
  if(!item) return out;
  var c = item.card, names = tdFxKwNames();
  if(c && !item.anon){
    var lines = String(c.ruleText || '').split(/\r?\n/);
    var first = (lines[0] || '').trim().replace(/\.\s*$/, ''), got = [], ok = !!first;
    if(ok) first.split(/\s*,\s*/).forEach(function(part){
      if(!ok) return;
      var hit = null;
      for(var i = 0; i < names.length && !hit; i++){
        var n = names[i];
        if(part === n || (part.indexOf(n) === 0 && TDFX_PARAM_RX.test(part.slice(n.length)))) hit = n;
      }
      if(hit) got.push(hit); else ok = false;
    });
    if(ok) got.forEach(add);
    lines.forEach(function(l){ var m = TDFX_ABILITY_RX.exec(l); if(m) add(m[1]); });
  }
  board = board || tdFxHalfOf(item.uid);
  ((board && board.tokens) || []).forEach(function(t){
    if(t.kind !== 'kw' || t.on !== item.uid) return;
    var nm = String(t.name || '').replace(/\bcounters?\b/gi, '').trim();
    for(var i = 0; i < names.length; i++) if(nm === names[i] || nm.indexOf(names[i] + ' ') === 0){ add(names[i]); break; }
  });
  return out;
}
function tdCardHasKw(item, name, board){ return tdFxKeywords(item, board).indexOf(name) >= 0; }
window.tdFxKeywords = tdFxKeywords;
window.tdCardHasKw = tdCardHasKw;

var TDFX_ATK_KW = ['Airborne', 'Lethal', 'Overwhelm', 'Battlecry', 'Raid', 'Unblockable', 'Shade', 'Volley', 'Fury'];
var TDFX_AURA = {
  ub:    ['#3b2a8a', '#5a1a5e', '#9a0f22'],
  shade: ['#2b2350', '#4a3f7a', '#8a8fa3'],
  lethal:['#0f5a2a', '#2bd94a', '#b4ff6a']
};
var TDFX_FLAME_UB = ['#3b2a8a', '#5a1a6a', '#8a0f22', '#b0122a'];
var TDFX_KNIFE = '<path d="M12 1c3.4 3.4 3.8 8 2.4 12.6H10.2V3.4Z"/><path d="M12.2 3.2c1.6 2.6 1.9 6 1.2 9" stroke="#e6dcff" stroke-width=".5" fill="none" opacity=".6"/>'
  + '<rect x="7.6" y="13.6" width="8.8" height="1.9" rx=".9"/><rect x="10.7" y="15.5" width="2.6" height="6" rx="1.1" fill="#2a1830"/><circle cx="12" cy="22.2" r="1.3"/>';
var TDFX_SWORD = '<polygon points="12,1 14.3,4 14.3,14 9.7,14 9.7,4"/><rect x="6.2" y="14" width="11.6" height="2.3" rx="1"/>'
  + '<rect x="10.9" y="16.3" width="2.2" height="4.3"/><circle cx="12" cy="21.7" r="1.7"/>';
/* Drawn in the weapon's own 24x32 box, so it is exactly as tall and wide. */
var TDFX_MOON = '<path d="M17.8-5.4A11.5 15.5 0 1 0 17.8 21.4 9.4 13.6 0 0 1 17.8-5.4Z" fill="none" stroke-width="1.3" stroke-linejoin="round"/>';
var TDFX_SKULL = '<g transform="translate(7.2 3.6) scale(.4)"><path d="M12 2C7 2 3.5 5.6 3.5 10.2c0 2.8 1.3 4.6 2.9 5.7V19c0 .8.7 1.5 1.5 1.5h1.2V18h1.4v2.5h3V18h1.4v2.5h1.2c.8 0 1.5-.7 1.5-1.5v-3.1c1.6-1.1 2.9-2.9 2.9-5.7C20.5 5.6 17 2 12 2Z" stroke="#0b0b0b" stroke-width="2" paint-order="stroke"/>'
  + '<circle cx="8.4" cy="11.3" r="2.1" fill="#0b0b0b"/><circle cx="15.6" cy="11.3" r="2.1" fill="#0b0b0b"/></g>';
var TDFX_FANGS = (function(){
  function fang(x, w, h, bend){
    return '<path d="M' + x + ' 0Q' + (x + w * .08) + ' ' + (h * .62) + ' ' + (x + w * .5 + bend) + ' ' + h
      + 'Q' + (x + w * .92) + ' ' + (h * .62) + ' ' + (x + w) + ' 0Q' + (x + w * .5) + ' ' + (h * .12) + ' ' + x + ' 0Z"/>';
  }
  return '<svg viewBox="0 0 100 22" preserveAspectRatio="none"><g fill="url(#tdFxFangG)" stroke="#8f8370" stroke-width=".4">'
    + [[3, 9, 21, 2.2], [20, 6, 11, 0], [31, 5, 8.5, 0], [41, 5, 7.5, 0], [54, 5, 7.5, 0], [64, 5, 8.5, 0], [74, 6, 11, 0], [88, 9, 21, -2.2]]
        .map(function(f){ return fang(f[0], f[1], f[2], f[3]); }).join('') + '</g></svg>';
})();
function tdFxDefs(){
  if(document.getElementById('tdFxDefs')) return;
  var d = document.createElement('div');
  d.innerHTML = '<svg id="tdFxDefs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>'
    + '<linearGradient id="tdFxFangG" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#d9cfbd"/><stop offset=".35" stop-color="#fbf8f1"/><stop offset="1" stop-color="#ffffff"/></linearGradient>'
    + Object.keys(TDFX_AURA).map(function(k){ var a = TDFX_AURA[k];
        return '<linearGradient id="tdFxW' + k + '" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="' + a[0] + '"/><stop offset=".55" stop-color="' + a[1] + '"/><stop offset="1" stop-color="' + a[2] + '"/></linearGradient>'; }).join('')
    + '</defs></svg>';
  document.body.appendChild(d.firstChild);
}
function tdFxAtkSet(item, board){
  var kws = tdFxKeywords(item, board).filter(function(n){ return TDFX_ATK_KW.indexOf(n) >= 0; }), has = {};
  kws.forEach(function(n){ has[n] = 1; });
  var aura = has.Unblockable ? 'ub' : has.Shade ? 'shade' : has.Lethal ? 'lethal' : '';
  return {kws:kws, has:has, aura:aura};
}
function tdFxWeaponSVG(set){
  var fill = set.aura ? 'url(#tdFxW' + set.aura + ')' : 'currentColor';
  return '<svg viewBox="0 -8 24 32" fill="' + fill + '" stroke="' + fill + '">'
    + (set.has.Shade ? TDFX_MOON : '')
    + '<g stroke="none">' + (set.has.Unblockable ? TDFX_KNIFE : TDFX_SWORD) + '</g>'
    + (set.has.Lethal ? TDFX_SKULL : '') + '</svg>';
}
function tdFxBannerSVG(cols){
  var cs = cols.length ? cols : ['#ff4d3d'], id = 'tdFxBan' + (++TDFX.uid);
  var stops = (cs.length === 1 ? [cs[0], cs[0]] : cs).map(function(c, i, a){
    return '<stop offset="' + (i / (a.length - 1)) + '" stop-color="' + c + '"/>'; }).join('');
  /* left to right, so a many-coloured flag reads in vertical bands */
  return '<svg viewBox="0 0 60 90"><defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="0">' + stops + '</linearGradient></defs>'
    + '<rect x="2" y="0" width="3" height="90" rx="1.5" fill="#c8a45a"/><circle cx="3.5" cy="2" r="3" fill="#ffe08a"/>'
    + '<g class="td-fx-flag"><path d="M5 6h50l-9 14 9 14H5Z" fill="url(#' + id + ')" stroke="#ffcf6b" stroke-width="1.2"/></g></svg>';
}
function tdFxAtkHTML(item, board, role, c){
  var set = tdFxAtkSet(item, board), h = set.has, html = '', cls = '';
  if(!set.kws.length) return {cls:'', html:'', set:set};
  tdFxDefs();
  set.kws.forEach(function(n){ cls += ' td-fx-k-' + n.toLowerCase(); });
  var cols = tdFxPalette(c);
  if(role === 'atk' && set.aura) cls += ' td-fx-aura';
  if(h.Overwhelm) html += "<div class='td-fx-fangs td-fx-top'>" + TDFX_FANGS + "</div><div class='td-fx-fangs td-fx-bot'>" + TDFX_FANGS + "</div>";
  if(h.Raid) html += "<div class='td-fx-banner'>" + tdFxBannerSVG(cols) + "</div>";
  if(h.Airborne) html += "<div class='td-fx-shadow'></div>";
  if(h.Volley && role === 'atk'){
    var w = tdFxWeaponSVG(set), vc = set.aura ? TDFX_AURA[set.aura][1] : '#ff3b3b';
    [[-34, 6, -10, 8], [-26, 50, -4, -7], [118, 8, 10, -8], [110, 52, 4, 7]].forEach(function(v, i){
      html += "<div class='td-fx-vw' style='left:" + v[0] + '%;top:' + v[1] + '%;--r:' + v[2] + 'deg;--sw:' + v[3] + 'deg;--vc:' + vc
        + ';animation-delay:' + (-i * .8) + "s'>" + w + '</div>';
    });
  }
  return {cls:cls, html:html, set:set, cols:cols};
}

/* The old element becomes a fixed ghost and the Grave card waits for it (td-fx-hold, zone 'grave'), so an undo mid-way shows it at once. */
var TDFX_SKULLMARK = '<svg viewBox="0 0 24 24" fill="currentColor"><path d="M12 2C7 2 3.5 5.6 3.5 10.2c0 2.8 1.3 4.6 2.9 5.7V19c0 .8.7 1.5 1.5 1.5h1.2V18h1.4v2.5h3V18h1.4v2.5h1.2c.8 0 1.5-.7 1.5-1.5v-3.1c1.6-1.1 2.9-2.9 2.9-5.7C20.5 5.6 17 2 12 2Zm-3.6 11.4a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2Zm7.2 0a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2Z"/></svg>';
function tdFxWaitMs(ms){ return new Promise(function(r){ setTimeout(r, ms); }); }
function tdFxGhostOf(el, from){
  var g = el.cloneNode(true);
  g.removeAttribute('data-uid');
  Array.prototype.forEach.call(g.querySelectorAll('[class*="td-fx-"]'), function(n){ n.remove(); });
  g.className = 'td-card td-fx-ghost';
  g.style.left = from.x + 'px'; g.style.top = from.y + 'px'; g.style.width = from.w + 'px'; g.style.height = from.h + 'px';
  g.style.animation = 'none'; g.style.transform = 'none';
  document.body.appendChild(g);
  return g;
}
function tdFxDeath(board, a){
  if(tdFxReduced()) return;
  var el = tdFxEl(a.uid), at = tdFindIn(board, a.uid), item = at && at.item, c = item && item.card;
  if(!el || !c) return;
  var from = tdFxRect(el);
  if(!from.w) return;
  /* Its keywords as they were on the Field: the move took its counters. */
  var kws = (TDFX.pre && TDFX.pre.uid === a.uid) ? TDFX.pre.kws : tdFxKeywords(item, board);
  var demise = kws.indexOf('Demise') >= 0, cols = tdFxPalette(c);
  var total = (demise ? 1900 : 0) + 700 + 250 + 1500 + 200;
  TDFX.hold[a.uid] = {zone:'grave', until:Date.now() + total};
  TDFX.fired.death = (TDFX.fired.death || 0) + 1;
  var ghost = tdFxGhostOf(el, from), B = from;
  /* Undone in the meantime, it stops: the card is back on the Field and the ghost fades where it stands. */
  function undone(){
    if(tdFxZoneOf(a.uid) === 'grave') return false;
    delete TDFX.hold[a.uid];
    if(ghost.animate) ghost.animate([{opacity:1}, {opacity:0}], {duration:300, fill:'forwards'})
      .finished.then(function(){ ghost.remove(); });
    else ghost.remove();
    return true;
  }
  (async function(){
    if(demise){
      TDFX.fired.demise = (TDFX.fired.demise || 0) + 1;
      var s = document.createElement('div'); s.className = 'td-fx-skullmark'; s.style.setProperty('--sk', cols[0]); s.innerHTML = TDFX_SKULLMARK;
      ghost.appendChild(s);
      if(s.animate) s.animate([{transform:'translate(-50%,-50%) scale(2.4) rotate(-20deg)', opacity:0}, {transform:'translate(-50%,-50%) scale(1)', opacity:1}],
                              {duration:380, easing:'cubic-bezier(.2,1.6,.4,1)', fill:'forwards'});
      await tdFxWaitMs(650);
      if(undone()) return;
      var cx = B.cx, cy = B.y + B.h * .38;
      for(var i = 0; i < 40; i++){ var an = tdFxRnd(0, 7), sp = tdFxRnd(90, 240);
        if(i % 3) tdFxSpark(cx, cy, Math.cos(an) * sp, Math.sin(an) * sp, tdFxPick(cols.concat(['#ffffff'])), {life:tdFxRnd(.5, .9)});
        else tdFxChunk(cx, cy, Math.cos(an) * sp * .8, Math.sin(an) * sp * .8, '#14101c'); }
      if(s.animate) s.animate([{opacity:1}, {opacity:0, transform:'translate(-50%,-50%) scale(1.6)'}], {duration:300, fill:'forwards'});
      for(var k = 0; k < 2; k++){
        TDFX.fired.knell = (TDFX.fired.knell || 0) + 1;
        tdFxRing(B.cx, B.cy, cols[0], {r0:20, r1:B.w * 2.6, w:9, life:1.4, cols:cols.length > 1 ? cols : null});
        setTimeout(function(){ tdFxRattle(B); }, 420);
        await tdFxWaitMs(600);
        if(undone()) return;
      }
    }
    if(ghost.animate) ghost.animate([{transform:'perspective(500px) rotateX(0)'}, {transform:'perspective(500px) rotateX(-12deg)', offset:.25},
                                     {transform:'perspective(500px) rotateX(78deg) translateY(30px)', filter:'brightness(.7) grayscale(.4)'}],
                                    {duration:700, easing:'cubic-bezier(.5,0,.9,.5)', fill:'forwards'});
    await tdFxWaitMs(650);
    if(undone()) return;
    var by = B.y + B.h * .92;
    tdFxRing(B.cx, by, '#a9adb6', {r0:20, r1:150 * B.w / 132, w:4, sy:.28, life:.7});
    for(var j = 0; j < 14; j++){ var q = tdFxRnd(-Math.PI, 0);
      tdFxPuff(B.cx + Math.cos(q) * B.w * .5, by, Math.cos(q) * tdFxRnd(60, 140), Math.sin(q) * tdFxRnd(5, 30), tdFxPick(['#8d8576', '#5c5f66', '#b9bcc4'])); }
    for(var m = 0; m < 18; m++) tdFxChunk(B.cx + tdFxRnd(-B.w / 2, B.w / 2), by, tdFxRnd(-120, 120), -tdFxRnd(30, 120), tdFxPick(TDFX_GREYS));
    await tdFxWaitMs(250);
    if(undone()) return;
    var F = tdFxRect(ghost), T = 1500, t0 = performance.now();
    ghost.classList.add('td-fx-ash');
    if(ghost.animate) ghost.animate([{filter:'brightness(.7) grayscale(.4)'}, {filter:'grayscale(1) brightness(.5)'}], {duration:T * .7, fill:'forwards'});
    /* An undo during the burn brings the card back, so the burn asks every frame and stops there. */
    var gone = false;
    tdFxCustom(T / 1000, function(cx2, p, k){
      if(gone) return;
      if(undone()){ gone = true; return; }
      ghost.style.setProperty('--burn', (k * 100).toFixed(1));
      var y = F.y + F.h * (1 - k);
      for(var e = 0; e < 3; e++) tdFxSpark(F.x + tdFxRnd(0, F.w), y + tdFxRnd(-2, 2), tdFxRnd(-20, 20), -tdFxRnd(30, 80),
        tdFxPick(['#ff9a2e', '#ffcf6b', '#ff5a1f']), {life:tdFxRnd(.7, 1.3), drag:.99, size:tdFxRnd(1.2, 2.4)});
      if(Math.random() < .3) tdFxPuff(F.x + tdFxRnd(0, F.w), y, tdFxRnd(-10, 10), -tdFxRnd(10, 30), '#5c5f66');
    });
    await tdFxWaitMs(T);
    if(gone || undone()) return;
    ghost.remove();
    delete TDFX.hold[a.uid];
    var g = tdFxEl(a.uid);
    if(g && g.classList.contains('td-fx-hold')){
      g.classList.remove('td-fx-hold');
      if(g.animate) g.animate([{opacity:0}, {opacity:1}], {duration:400});
    }
  })();
}
function tdFxRattle(B){
  Array.prototype.forEach.call(document.querySelectorAll('#tdBoard .td-zone[data-zone=field] .td-card'), function(el){
    var r = tdFxRect(el);
    if(Math.hypot(r.cx - B.cx, r.cy - B.cy) > B.w * 3 || !el.animate) return;
    el.animate([{translate:'0 0'}, {translate:'-3px 1px'}, {translate:'3px -1px'}, {translate:'-2px 0'}, {translate:'0 0'}], {duration:380});
  });
}

/* CSS draws it from --fx-age (boardfx.css), so a redraw that replaces the box lands the new circle at the same moment.
   The turn is on an HTML wrapper (.td-fx-turn), so the compositor turns it and the SVG is drawn once. */
var TDFX_RUNES = 'ᚠᚢᚦᚨᚱᚲᚷᚹᚺᚾᛁᛃᛇᛈᛉᛊᛏᛒᛖᛗᛚᛜᛞᛟ';
function tdFxCircleSVG(kind, cols){
  var id = 'tdFxCi' + (++TDFX.uid), cs = cols.length > 1 ? cols : [cols[0], cols[0]], nd = 0;
  var defs = '<defs><linearGradient id="' + id + '" x1="0" y1="0" x2="1" y2="0">'
    + cs.map(function(c, i){ return '<stop offset="' + (i / (cs.length - 1)) + '" stop-color="' + c + '"/>'; }).join('') + '</linearGradient></defs>';
  /* --i staggers them: each line 120ms after the one before, each glyph 30ms. */
  var st = 'stroke="url(#' + id + ')"';
  function draw(){ return ' pathLength="100" stroke-dasharray="100" stroke-dashoffset="100" class="td-fx-draw" style="--i:' + (nd++) + '"'; }
  var t = '<svg viewBox="-100 -100 200 200" fill="none">' + defs + '<g>';
  if(kind === 'runes'){
    t += '<circle r="94" ' + st + ' stroke-width="1.6"' + draw() + '/><circle r="72" ' + st + ' stroke-width="1"' + draw() + '/>';
    for(var i = 0; i < 24; i++){ var a = i / 24 * Math.PI * 2, x = (Math.cos(a) * 83).toFixed(1), y = (Math.sin(a) * 83).toFixed(1);
      t += '<text x="' + x + '" y="' + (+y + 4) + '" font-size="11" fill="url(#' + id + ')" text-anchor="middle" opacity="0" class="td-fx-glyph" style="--i:' + i + '" transform="rotate('
        + (a * 180 / Math.PI + 90).toFixed(1) + ' ' + x + ' ' + y + ')">' + TDFX_RUNES[i] + '</text>'; }
  } else {
    t += '<circle r="96" ' + st + ' stroke-width="2"' + draw() + '/><circle r="84" ' + st + ' stroke-width=".8"' + draw() + '/><circle r="40" ' + st + ' stroke-width="1.2"' + draw() + '/>'
      + '<path d="M0-84 72.7 42-72.7 42Z M0 84-72.7-42 72.7-42Z" ' + st + ' stroke-width="1.3"' + draw() + '/>';
    for(var j = 0; j < 12; j++){ var b = j / 12 * Math.PI * 2, cx = (Math.cos(b) * 90).toFixed(1), cy = (Math.sin(b) * 90).toFixed(1);
      t += '<g opacity="0" class="td-fx-glyph td-fx-dot" style="--i:' + j + '"><circle cx="' + cx + '" cy="' + cy + '" r="6.5" fill="url(#' + id + 'w)"/>'
        + '<circle cx="' + cx + '" cy="' + cy + '" r="2.6" fill="#fff"/></g>'; }
    t = t.replace('</defs>', '<radialGradient id="' + id + 'w"><stop offset="0" stop-color="#fff" stop-opacity=".32"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></radialGradient></defs>');
  }
  return t + '</g></svg>';
}
function tdFxCircleKind(c){ return tdFxHasSuper(c, 'spell') ? 'seal' : 'runes'; }
function tdFxCircleHTML(kind, cols, ageMs, ground){
  return "<div class='td-fx-circle td-fx-" + kind + (ground ? ' td-fx-ground' : '') + "' aria-hidden='true' style='--fx-age:" + Math.round(-ageMs)
    + 'ms;--c0:' + cols[0] + ';--c1:' + cols[cols.length - 1] + "'><div class='td-fx-turn'>" + tdFxCircleSVG(kind, cols) + '</div></div>';
}
function tdFxIsOngoing(c){
  return tdFxHasSuper(c, 'ongoing') && (tdFxHasSuper(c, 'action') || tdFxHasSuper(c, 'spell')) && !tdIsCharacterCard(c);
}
/* The circle, its rings and its sparks are the burst's (tdPfxBurst, set up before this redraw). */
function tdFxOngoing(uid){
  var el = tdFxEl(uid), half = tdFxHalfOf(uid), at = tdFindIn(half, uid), item = at && at.item, c = item && item.card;
  if(!el || !c) return;
  var B = tdFxRect(el);
  if(!B.w) return;
  var kind = tdFxCircleKind(c);
  TDFX.fired['ongoing-' + kind] = (TDFX.fired['ongoing-' + kind] || 0) + 1;
  if(!tdFxReduced() && el.animate) el.animate([{translate:'0 -40px', opacity:0}, {translate:'0 0', opacity:1}], {duration:420, easing:'cubic-bezier(.2,1.2,.4,1)'});
  setTimeout(function(){ tdFxFinishes(uid, item, half, c, B.w / 132, 300); }, 380);
}
function tdFxFinishes(uid, item, half, c, sc, delay){
  var abs = tdCardHasKw(item, 'Absolute', half), uni = tdCardHasKw(item, 'Unique', half), myth = tdFxHasSuper(c, 'mythic');
  setTimeout(function(){
    var now = tdFxEl(uid);
    if(!now) return;
    var B = tdFxRect(now), wait = 0;
    if(abs){ tdFxDiamonds(B.cx, B.cy, 260 * sc); wait += 220; }
    setTimeout(function(){
      var n2 = tdFxEl(uid);
      if(n2 && uni) tdFxUniqueComet(n2);
      setTimeout(function(){ var n3 = tdFxEl(uid); if(n3 && myth) tdFxMythicOn(n3); }, (n2 && uni) ? 220 : 0);
    }, wait);
  }, delay);
}

/* The card is held out of sight (td-fx-hold, zone 'field') through the wind and the star. */
var TDFX_WIND_MS = 360, TDFX_STAR_MS = 550;
function tdFxWind(B){
  TDFX.fired.wind = (TDFX.fired.wind || 0) + 1;
  var H = window.innerHeight;
  for(var i = 0; i < 11; i++) (function(xx, len, d){
    tdFxCustom(.9, function(c, p, k){
      var kk = Math.max(0, (k - d) / (1 - d)); if(!kk) return;
      var yy = B.y + B.h + len - (B.h + len * 2.2) * tdFxEaseOut(kk);
      c.globalAlpha = Math.sin(Math.PI * kk) * .55; c.strokeStyle = '#d9fff0'; c.lineWidth = 1.6;
      c.beginPath(); c.moveTo(xx, yy + len); c.bezierCurveTo(xx - 8, yy + len * .6, xx + 8, yy + len * .3, xx + Math.sin(kk * 9) * 4, yy); c.stroke();
    });
  })(B.cx + tdFxRnd(-B.w * 1.6, B.w * 1.6), tdFxRnd(110, 220), tdFxRnd(0, .25));
  for(var j = 0; j < 20; j++) tdFxSpark(B.cx + tdFxRnd(-B.w * 1.5, B.w * 1.5), Math.min(H, B.y + B.h + 60), tdFxRnd(-20, 20), -tdFxRnd(500, 800), '#c8ffd9', {life:.7, size:1.4, drag:.98});
}
function tdFxStarfall(B, cols){
  TDFX.fired.starfall = (TDFX.fired.starfall || 0) + 1;
  var sx = B.cx - 380, sy = B.cy - 420;
  tdFxCustom(TDFX_STAR_MS / 1000, function(c, p, k){
    var e = k * k, X = sx + (B.cx - sx) * e, Y = sy + (B.cy - sy) * e;
    for(var i = 0; i < 18; i++){ var t = Math.max(0, e - i * .018);
      c.globalAlpha = (1 - i / 18) * .8;
      tdFxBlit(c, tdFxSprite('dot', i ? cols[i % cols.length] : '#ffffff', '#ffffff', 6 - i * .28, 14), sx + (B.cx - sx) * t, sy + (B.cy - sy) * t); }
    if(Math.random() < .8) tdFxSpark(X, Y, tdFxRnd(-30, 30), tdFxRnd(-30, 30), tdFxPick(['#ffffff', cols[0]]), {life:.5, size:1.6});
  });
}
function tdFxSwiftSwords(B){
  TDFX.fired.swords = (TDFX.fired.swords || 0) + 1;
  var th = tdFxRnd(0, Math.PI * 2), rx = B.w * .85, ry = B.h * .72, w = Math.max(20, B.w * .24);
  [1, -1].forEach(function(sg, i){
    var s = document.createElement('div'); s.className = 'td-fx-pswd';
    s.innerHTML = TDFX_ICON.sword + "<i class='td-fx-dia' style='top:12.5%'><b></b></i>";
    s.style.width = w + 'px';
    s.style.left = (B.cx + sg * Math.cos(th) * rx - w / 2) + 'px'; s.style.top = (B.cy + sg * Math.sin(th) * ry - w * 4 / 6) + 'px';
    document.body.appendChild(s);
    if(!s.animate){ setTimeout(function(){ s.remove(); }, 1700); return; }
    s.animate([{transform:'scale(2.4) rotate(-20deg)', opacity:0}, {transform:'scale(1)', opacity:1, offset:.2},
               {transform:'translateY(-8px) scale(1)', opacity:1, offset:.75}, {transform:'translateY(-14px)', opacity:0}],
      {duration:1700, delay:i * 140, easing:'ease-out', fill:'forwards'}).finished.then(function(){ s.remove(); });
    setTimeout(function(){ var r = tdFxRect(s); tdFxRing(r.cx, r.cy, '#ff3b3b', {r0:4, r1:34, w:2.5, life:.45}); }, 300 + i * 140);
  });
}

/* Saves and restores: on the one shared canvas a draw that moved it shifted everything after it in the frame (HANDOFF §74.1). */
function tdFxFeather(x, y, down){
  var ph = tdFxRnd(0, 7), rot0 = tdFxRnd(-1, 1), fall = down ? tdFxRnd(34, 50) : tdFxRnd(18, 30);
  tdFxAdd({kind:'custom', life:tdFxRnd(2.2, 3), blend:'source-over', feather:true, draw:function(c, p, k){
    var X = x + Math.sin(ph + p.age * 2.2) * 16, Y = y + p.age * fall;
    c.save(); c.globalAlpha = Math.sin(Math.PI * k) * .9; c.translate(X, Y); c.rotate(rot0 + Math.sin(ph + p.age * 2.2) * .7);
    c.fillStyle = '#f2f8ff'; c.beginPath(); c.ellipse(0, 0, 2.2, 7, 0, 0, 7); c.fill();
    c.strokeStyle = '#a9cfe8'; c.lineWidth = .7; c.beginPath(); c.moveTo(0, -7); c.lineTo(0, 8); c.stroke(); c.restore(); }});
}
function tdFxDrip(b){
  var x = b.x + tdFxRnd(.1, .9) * b.w, y0 = b.y + b.h + 2;
  tdFxAdd({kind:'custom', life:tdFxRnd(.9, 1.3), draw:function(c, p, k){
    c.globalAlpha = 1 - k; tdFxBlit(c, tdFxSprite('dot', '#9dff5a', '#2bd94a', 2.2 * (1 - k * .3), 8), x, y0 + 220 * p.age * p.age); }});
}
function tdFxKwTick(d){
  var b = d.b, k = d.kw;
  if(k.airborne){
    if(Math.random() < .2) tdFxFeather(b.x + tdFxRnd(-10, b.w + 10), b.y + tdFxRnd(0, b.h * .3));
    if(Math.random() < .45) tdFxFeather(b.x + tdFxRnd(.05, .95) * b.w, b.y + b.h - 4, true);
  }
  if(k.lethal){
    tdFxDrip(b);
    if(Math.random() < .25) tdFxPuff(b.x + tdFxRnd(0, b.w), b.y + b.h * tdFxRnd(.5, 1), tdFxRnd(-8, 8), -tdFxRnd(5, 15), '#3ddc84');
  }
  if(k.raid && Math.random() < .5)
    tdFxSpark(b.x + b.w + tdFxRnd(-6, 26), b.y - tdFxRnd(0, 20), tdFxRnd(-6, 6), -tdFxRnd(30, 60), tdFxPick(['#ffb347', '#ff7a1a']), {drag:.99, size:1.4, life:tdFxRnd(.8, 1.2)});
  if(k.shade){ var e = tdFxEdgePoint(b);
    tdFxAdd({kind:'puff', x:e[0], y:e[1], vx:tdFxRnd(-10, 10), vy:-tdFxRnd(10, 25), life:tdFxRnd(1.4, 2), r0:6, r1:tdFxRnd(22, 34), a:.55,
             color:tdFxPick(['#1c1726', '#2b2236', '#3a3046'])}); }
  if(k.unblockable && Math.random() < .7){ var m = tdFxEdgePoint(b);
    tdFxAdd({kind:'puff', x:m[0], y:m[1], vx:tdFxRnd(-14, 14), vy:tdFxRnd(-8, 4), life:tdFxRnd(1.6, 2.4), r0:8, r1:tdFxRnd(26, 40), a:.18,
             blend:'lighter', color:tdFxPick(['#dfe8f0', '#c8d6e2', '#ffffff'])}); }
}
function tdFxBattlecry(b, cols){
  TDFX.fired.battlecry = (TDFX.fired.battlecry || 0) + 1;
  var hx = b.cx, hy = b.y - b.h * .12;
  for(var i = 0; i < 5; i++) (function(i){
    setTimeout(function(){ tdFxCustom(1, function(c, p, k){
      var r = 14 + k * 150 * b.w / 132;
      c.strokeStyle = cols[i % cols.length]; c.beginPath(); c.arc(hx, hy, r, -Math.PI * .85, -Math.PI * .15);
      c.globalAlpha = (1 - k) * .3; c.lineWidth = 3.2 * (1 - k) + 6.6; c.stroke();
      c.globalAlpha = (1 - k) * .9; c.lineWidth = 3.2 * (1 - k) + .6; c.stroke(); }); }, i * 170);
  })(i);
  for(var j = 0; j < 14; j++) tdFxSpark(hx + tdFxRnd(-20, 20), hy, tdFxRnd(-60, 60), -tdFxRnd(80, 200), tdFxPick(cols), {life:tdFxRnd(.6, 1), size:1.6});
}

/* The action is not held back: the board moves at once, so the other player, undo and the log never wait on an animation.
   Only the drawing waits, and every hold names its zone, so an undo mid-way puts the card back on view. */
function tdFxZoneOf(uid){
  var halves = [TD.board].concat(tdFoeList());
  for(var i = 0; i < halves.length; i++){
    var at = halves[i] && tdFindIn(halves[i], uid);
    if(at) return at.zone;
  }
  return null;
}
function tdFxCrystal(board, a){
  if(tdFxReduced()) return;
  var el = tdFxEl(a.uid);
  var ess = tdFindIn(board, a.essUid);
  if(!el || !ess || ess.zone !== 'essarea') return;
  var from = tdFxRect(el);
  if(!from.w) return;
  var frac = tdFxArtFrac(el), fromArt = {x:from.cx, y:from.y + from.h * frac};
  var ghost = el.cloneNode(true), T0 = 1500, FLY = 800, GROW = 1100, now = Date.now();
  ghost.removeAttribute('data-uid');
  ghost.className = 'td-card td-fx-ghost';
  ghost.style.left = from.x + 'px'; ghost.style.top = from.y + 'px';
  ghost.style.width = from.w + 'px'; ghost.style.height = from.h + 'px';
  document.body.appendChild(ghost);
  TDFX.hold[a.uid] = {zone:'susp', until:now + T0 + FLY};
  TDFX.hold[a.essUid] = {zone:'essarea', until:now + T0};
  TDFX.landing[a.essUid] = now + T0 + GROW + 400;
  var eCard = ess.item.card, cols = tdFxEssCols(eCard);
  if(!cols.length) cols = ['grey'];
  tdFxMythicOn(ghost);
  setTimeout(function(){
    /* Undone in the meantime, it stops here: a gem flown now would land on the Essence Deck. */
    if(tdFxZoneOf(a.essUid) !== 'essarea' || tdFxZoneOf(a.uid) !== 'susp'){
      delete TDFX.landing[a.essUid];
      if(ghost.animate) ghost.animate([{opacity:1}, {opacity:0}], {duration:300, fill:'forwards'})
        .finished.then(function(){ ghost.remove(); });
      else ghost.remove();
      return;
    }
    var sEl = tdFxEl(a.uid) || document.querySelector("#tdBoard .td-half-mine .td-zone[data-zone='susp'] .td-zbody");
    if(sEl && ghost.animate){
      var t = tdFxRect(sEl);
      ghost.animate([{translate:'0 0', scale:'1', opacity:1},
                     {translate:(t.cx - from.cx) + 'px ' + (t.cy - from.cy) + 'px', scale:String(t.w / from.w || 1), opacity:1, offset:.92},
                     {opacity:0}], {duration:FLY, easing:'cubic-bezier(.5,0,.2,1)', fill:'forwards'})
        .finished.then(function(){ ghost.remove(); var s = tdFxEl(a.uid); if(s) s.classList.remove('td-fx-hold'); });
    } else ghost.remove();
    tdFxEssenceArrives(a.essUid, fromArt, eCard, cols, GROW);
  }, T0);
}
function tdFxEssenceArrives(essUid, fromArt, eCard, cols, GROW){
  var essEl = tdFxEl(essUid), eAt = tdFindIn(tdFxHalfOf(essUid), essUid);
  var uniq = !!eAt && tdCardHasKw(eAt.item, 'Unique');
  delete TDFX.hold[essUid];
  if(!essEl){ delete TDFX.landing[essUid]; return; }
  essEl.classList.remove('td-fx-hold');
  if(essEl.animate) essEl.animate([{scale:'0', opacity:.3}, {scale:'1', opacity:1}], {duration:GROW, easing:'cubic-bezier(.3,1.4,.5,1)'});
  var er = tdFxRect(essEl), target = {x:er.cx, y:er.y + er.h * tdFxArtFrac(essEl)};
  if(essEl.classList.contains('locked')){ target.x = er.cx; target.y = er.cy; }
  tdFxGemFlight(fromArt || target, target, cols, eCard, er, GROW / 1000, uniq, function(){
    delete TDFX.landing[essUid];
    var e2 = tdFxEl(essUid);
    if(e2 && e2.getAttribute('data-zone') === 'essarea' && !e2.querySelector(':scope > .td-fx-gem')){
      e2.classList.add('td-fx-gemcard');
      e2.style.setProperty('--fx-art', (tdFxArtFrac(e2) * 100).toFixed(1) + '%');
      e2.insertAdjacentHTML('beforeend', tdFxGemHTML(eCard, cols, true, uniq));
    }
  });
}
/* Another player's hand is hidden here, so the card bursts where it arrives; called for the Essence's half of tblRedact's pair. */
function tdFxCrystalSeen(board, a){
  if(tdFxReduced()) return;
  var ess = tdFindIn(board, a.uid);
  if(!ess || ess.zone !== 'essarea' || !ess.item.card) return;
  var eCard = ess.item.card, cols = tdFxEssCols(eCard), T0 = 1100, GROW = 1100, now = Date.now();
  if(!cols.length) cols = ['grey'];
  TDFX.hold[a.uid] = {zone:'essarea', until:now + T0};
  TDFX.landing[a.uid] = now + T0 + GROW + 400;
  setTimeout(function(){ var el = a.from && tdFxEl(a.from); if(el) tdFxMythicOn(el); }, 0);
  setTimeout(function(){
    if(tdFxZoneOf(a.uid) !== 'essarea'){ delete TDFX.landing[a.uid]; delete TDFX.hold[a.uid]; return; }
    var el = a.from && tdFxEl(a.from), r = el ? tdFxRect(el) : null;
    tdFxEssenceArrives(a.uid, (r && r.w) ? {x:r.cx, y:r.y + r.h * tdFxArtFrac(el)} : null, eCard, cols, GROW);
  }, T0);
}
function tdFxGemFlight(fromArt, target, cols, eCard, er, T, unique, done){
  var mythic = tdFxHasSuper(eCard, 'mythic');
  var ctl = {x:(fromArt.x + target.x) / 2 + 60, y:Math.min(fromArt.y, target.y) - 110};
  var c1 = TDFX_COL[cols[0]], c2 = TDFX_COL[cols[1] || cols[0]], s = Math.max(9, Math.min(15, er.w * .15));
  var gemGrad = null;
  tdFxAdd({kind:'custom', life:T, blend:'source-over', draw:function(c, p, k){
    var e = tdFxEaseInOut(k), u = 1 - e, d = TDFX.dpr || 1;
    var x = u * u * fromArt.x + 2 * u * e * ctl.x + e * e * target.x, y = u * u * fromArt.y + 2 * u * e * ctl.y + e * e * target.y;
    var turn = Math.min(1, k * 1.15);
    for(var i = 0; i < (cols.length > 1 ? 2 : 1) + (mythic ? 1 : 0); i++){
      var ang = k * 26 + i * Math.PI, ox = cols.length > 1 ? Math.cos(ang) * 8 : 0, oy = cols.length > 1 ? Math.sin(ang) * 8 : 0;
      tdFxSpark(x + ox, y + oy, tdFxRnd(-20, 20), tdFxRnd(-20, 20),
                (mythic || Math.random() > turn) ? tdFxHue(k * 900 + i * 120, 78) : TDFX_COL[cols[i % cols.length]],
                {life:tdFxRnd(.35, .6), size:tdFxRnd(1.4, 2.6)});
    }
    c.globalCompositeOperation = 'lighter';
    c.globalAlpha = (1 - turn) * .8; tdFxBlit(c, tdFxSprite('dot', '#ffffff', '#ffffff', s * .7, 22), x, y);
    c.globalAlpha = turn * .8; tdFxBlit(c, tdFxSprite('dot', c1, c1, s * .7, 20), x, y);
    c.globalCompositeOperation = 'source-over';
    c.translate(x, y); c.rotate(Math.sin(k * 6) * .25); c.scale(Math.max(.12, Math.abs(Math.cos(k * Math.PI * 5))), 1);
    c.globalAlpha = 1 - turn;
    var w = c.createLinearGradient(-s, -s, s, s), h0 = (k * 700) % 360;
    w.addColorStop(0, '#ffffff'); w.addColorStop(.35, 'hsl(' + h0 + ',100%,88%)'); w.addColorStop(.55, '#ffffff');
    w.addColorStop(.75, 'hsl(' + ((h0 + 140) % 360) + ',100%,86%)'); w.addColorStop(1, '#e8ecff');
    c.fillStyle = w; tdFxHex(c, 0, 0, s, Math.PI / 6); c.fill();
    c.globalAlpha = turn;
    if(!gemGrad){       /* its own colours never change, so made once */
      gemGrad = c.createLinearGradient(-s, -s, s, s);
      gemGrad.addColorStop(0, '#ffffff'); gemGrad.addColorStop(.45, c1); gemGrad.addColorStop(.55, c2);
      gemGrad.addColorStop(1, tdFxMix(c2, '#000000', .35));
    }
    c.fillStyle = gemGrad; tdFxHex(c, 0, 0, s, Math.PI / 6); c.fill();
    c.globalAlpha = .55; c.fillStyle = '#ffffff'; c.beginPath(); c.moveTo(-s * .35, -s * .55); c.lineTo(s * .2, -s * .35);
    c.lineTo(-s * .1, s * .1); c.lineTo(-s * .55, -s * .15); c.closePath(); c.fill();
    c.setTransform(d, 0, 0, d, 0, 0); }});
  setTimeout(function(){
    done();
    cols.forEach(function(cl, i){ tdFxRing(target.x, target.y, TDFX_COL[cl], {r0:5, r1:50 + i * 16, w:3.5, life:.6 + i * .1}); });
    for(var i = 0; i < 24; i++){ var an = tdFxRnd(0, 7);
      tdFxSpark(target.x, target.y, Math.cos(an) * tdFxRnd(50, 170), Math.sin(an) * tdFxRnd(50, 170), TDFX_COL[tdFxPick(cols)], {life:.6}); }
    if(mythic) for(var m = 0; m < 14; m++) (function(m){
      setTimeout(function(){
        var an = tdFxRnd(0, 7), r = tdFxRnd(16, 48);
        tdFxStarP(target.x + Math.cos(an) * r, target.y + Math.sin(an) * r,
                  {life:.6, r:4.5, spin:4, color:tdFxHue(m * 47, 82), blur:10, fade:'sin'});
      }, m * 45);
    })(m);
    if(unique){
      tdFxCustom(1, function(c, p, k){
        c.globalAlpha = 1;
        tdFxBlitTurned(c, tdFxSprite('star', '#ffffff', '#fff2a8', 28, 24), target.x, target.y - 3, k * 2,
                       Math.max(.01, Math.sin(Math.PI * k))); });
      tdFxDiamonds(target.x, target.y, 100);
    }
  }, T * 1000);
}

/* Before an action: only what it is about to take away (a leaving card's keyword counters) and where a turn tracker was. */
function tdFxBefore(board, a, before){
  TDFX.pre = null;
  TDFX.preTurn = (a && a.t === 'phase' && board) ? tdTurnOf(board) : null;
  try{
    if(!a || a.t !== 'move' || before !== 'field' || a.to === 'field') return;
    var at = tdFindIn(board, a.uid);
    if(at) TDFX.pre = {uid:a.uid, kws:tdFxKeywords(at.item, board)};
  }catch(_){}
}
/* From tdDo and tblActFrom, after the action is applied and before the redraw, so the old element is still where it stood. */
function tdFxAction(board, a, before){
  try{
    if(!a || !board || (typeof tdIsPool === 'function' && tdIsPool())) return;
    /* On another player's screen a card played from the Hand is an 'appear': their hand is hidden, so that is the play to slam. */
    var played = (a.t === 'move' && a.to === 'field' && before && before !== 'field')
              || (a.t === 'appear' && a.zone === 'field' && !a.anon);
    if(played){
      var at = tdFindIn(board, a.uid);
      if(at && at.item.card && !at.item.down && !at.item.anon && tdIsCharacterCard(at.item.card)){
        /* Swift and Arrive play before the slam, so the hold is set here, before the redraw that draws the card. */
        var pre = {swift:tdCardHasKw(at.item, 'Swift', board), arrive:tdCardHasKw(at.item, 'Arrive', board)};
        if((pre.swift || pre.arrive) && !tdFxReduced())
          TDFX.hold[a.uid] = {zone:'field', until:Date.now() + (pre.swift ? TDFX_WIND_MS : 0) + (pre.arrive ? TDFX_STAR_MS : 0) + 400};
        setTimeout(function(){ tdFxSlam(a.uid, pre); }, 0);
      }
      else if(at && at.item.card && !at.item.down && !at.item.anon && tdFxIsOngoing(at.item.card)){
        /* Set up here, before the redraw that draws them (cat_playfx.js). */
        if(typeof tdPfxBurst === 'function') tdPfxBurst(board, a.uid);
        setTimeout(function(){ tdFxOngoing(a.uid); }, 0);
      }
    } else if(a.t === 'move' && a.to === 'grave' && before === 'field'){
      var dead = tdFindIn(board, a.uid);
      if(dead && dead.item.card && !dead.item.anon && tdIsCharacterCard(dead.item.card)) tdFxDeath(board, a);
      else if(dead && dead.item.card && !dead.item.anon && typeof tdPfxKind === 'function'
              && tdPfxKind(dead.item.card) === 'loop') tdPfxResolved(board, a);
    } else if(a.t === 'phase'){
      tdFxStepRibbons(board, TDFX.preTurn, a);
    } else if(a.t === 'crystal'){
      tdFxCrystal(board, a);
    } else if(a.t === 'appear' && a.fx === 'crystal' && a.zone === 'essarea'){
      tdFxCrystalSeen(board, a);
    }
  }catch(_){}
}

/* for the checks: what is in flight */
window.tdFxStats = function(){
  return {particles:TDFX.items.length, running:TDFX.running, sprites:TDFX.sprN || 0, fired:Object.assign({}, TDFX.fired),
          holds:Object.keys(TDFX.hold).length, landing:Object.keys(TDFX.landing).length};
};
