/* State lives here by uid (TDPFX.cards), so a redraw of the board, which replaces the card's element, carries straight on (HANDOFF §68). */
var TDPFX = {cards:{}};
(function(){

/* BURST is the circle's 0.38 s start (CIRCLE_AT) and its 5 s (.td-fx-circle, boardfx.css): the burst lasts as long as it (HANDOFF §70). */
var TAU = Math.PI * 2, SLOW = 2, GAP = 5, BURST = 5.38, BURST_FADE = .9;
var PAD_X = 1.1, PAD_Y = .75;          /* the canvases' margin round the card, in cards */
var GREY = ['#d3d7de', '#8f96a1'];

function rnd(a, b){ return a + Math.random() * (b - a); }
function irnd(a, b){ return Math.floor(rnd(a, b + 1)); }
function pick(a){ return a[(Math.random() * a.length) | 0]; }
function sgn(){ return Math.random() < .5 ? -1 : 1; }
function clamp(v, a, b){ return Math.max(a, Math.min(b, v)); }
function ease(t){ return t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2; }
function easeOut(t){ return 1 - Math.pow(1 - t, 3); }
function backOut(t){ return 1 + 2.7 * Math.pow(t - 1, 3) + 1.7 * Math.pow(t - 1, 2); }
function times(n, fn){ var out = []; for(var i = 0; i < n; i++) out.push(fn(i)); return out; }
function shuffle(a){ for(var i = a.length - 1; i > 0; i--){ var j = (Math.random() * (i + 1)) | 0, x = a[i]; a[i] = a[j]; a[j] = x; } return a; }
function hexA(h, a){ var n = parseInt(h.slice(1), 16);
  return 'rgba(' + (n >> 16 & 255) + ',' + (n >> 8 & 255) + ',' + (n & 255) + ',' + clamp(a, 0, 1).toFixed(3) + ')'; }
function mixHex(h1, h2, t){ var a = parseInt(h1.slice(1), 16), b = parseInt(h2.slice(1), 16);
  function c(s){ return Math.round(((a >> s) & 255) * (1 - t) + ((b >> s) & 255) * t); }
  return '#' + ((1 << 24) | (c(16) << 16) | (c(8) << 8) | c(0)).toString(16).slice(1); }
function light(h, t){ return mixHex(h, '#ffffff', t); }
function dark(h, t){ return mixHex(h, '#000000', t); }
function lin(c, x0, y0, x1, y1, cols, a){
  var g = c.createLinearGradient(x0, y0, x1, y1), cs = cols.length > 1 ? cols : [cols[0], cols[0]];
  cs.forEach(function(k, i){ g.addColorStop(i / (cs.length - 1), a != null && a < 1 ? hexA(k, a) : k); }); return g; }
function rrect(c, x, y, w, h, r){ c.beginPath(); if(c.roundRect) c.roundRect(x, y, w, h, r); else c.rect(x, y, w, h); }
function poly(c, pts){ c.beginPath(); pts.forEach(function(p, i){ if(i) c.lineTo(p[0], p[1]); else c.moveTo(p[0], p[1]); }); }
/* a point on the card's border, from the top middle, clockwise */
function perim(R, off, u){
  var x0 = R.x - off, y0 = R.y - off, w = R.w + 2 * off, h = R.h + 2 * off, P = 2 * (w + h);
  var d = ((u * P + w / 2) % P + P) % P;
  if(d < w) return [x0 + d, y0]; d -= w;
  if(d < h) return [x0 + w, y0 + d]; d -= h;
  if(d < w) return [x0 + w - d, y0 + h]; d -= w;
  return [x0, y0 + h - d];
}
function emit(st, key, rate, dt, fn){ st[key] = (st[key] || 0) + rate * dt; while(st[key] >= 1){ st[key]--; fn(); } }

/* No shadowBlur and no new gradient on any frame (HANDOFF §71.5): a shape that keeps its form is baked once with its glow
   into a sprite at the screen's pixel size, and a soft glow is the board's one radial sprite (tdFxPuffSprite). */
var SPR = {}, SPRN = 0, DPR = 1;
/* x0..y1 is in the canvas's units round the shape's origin; paint draws the shape there, its own scale included. */
function baked(key, x0, y0, x1, y1, blur, paint){
  key += '|' + DPR;
  var s = SPR[key];
  if(s) return s;
  if(SPRN > 1500){ SPR = {}; SPRN = 0; }      // a bound, never reached in play
  var pad = blur * 1.6 / DPR + 1, cv = document.createElement('canvas');
  cv.width = Math.max(1, Math.ceil((x1 - x0 + pad * 2) * DPR)); cv.height = Math.max(1, Math.ceil((y1 - y0 + pad * 2) * DPR));
  var c = cv.getContext('2d');
  c.setTransform(DPR, 0, 0, DPR, (pad - x0) * DPR, (pad - y0) * DPR);
  paint(c);
  s = {cv:cv, x:x0 - pad, y:y0 - pad, w:cv.width / DPR, h:cv.height / DPR};
  SPR[key] = s; SPRN++;
  return s;
}
function blit(c, s){ c.drawImage(s.cv, s.x, s.y, s.w, s.h); }
function q4(v){ return Math.max(.25, Math.round(v * 4) / 4); }
function glowDot(c, x, y, r, col, a){
  var ga = c.globalAlpha;
  c.globalAlpha = ga * .45 * a; c.drawImage(tdFxPuffSprite(col).cv, x - r * 4, y - r * 4, r * 8, r * 8); c.globalAlpha = ga;
  c.fillStyle = hexA(light(col, .5), a); c.beginPath(); c.arc(x, y, r, 0, TAU); c.fill();
}
/* One ground for everything that comes out of it, on the ground canvases, which neither float nor tilt with the card (HANDOFF §70). */
function ground(R){ return {cx:R.cx, cy:R.y + R.h * 1.16, rx:R.w * .95, k:.24}; }
function wander(q, t, sp){
  return [Math.sin(t * q.fx * sp + q.a) * .6 + Math.sin(t * q.fx * 1.7 * sp + q.b) * .35,
          Math.sin(t * q.fy * sp + q.c) * .6 + Math.cos(t * q.fy * 1.3 * sp + q.a) * .3];
}

function Parts(){ this.a = []; }
Parts.prototype.add = function(p){ p.age = 0; this.a.push(p); return p; };
Parts.prototype.step = function(dt){
  var a = this.a;
  for(var i = a.length - 1; i >= 0; i--){
    var p = a[i]; p.age += dt;
    if(p.age >= p.life){ a.splice(i, 1); continue; }
    var d = p.drag == null ? 1 : p.drag; p.vx *= d; p.vy = p.vy * d + (p.ay || 0) * dt;
    p.x += p.vx * dt; p.y += p.vy * dt;
    if(p.wob) p.x += Math.sin(p.age * p.wf + p.ph) * p.wob * dt;
  }
};
Parts.prototype.draw = function(c){ for(var i = 0; i < this.a.length; i++){ var p = this.a[i]; DRAW[p.k](c, p, p.age / p.life); } };
var DRAW = {
  dot:function(c, p, k){ var a = (p.fade === 'sin' ? Math.sin(Math.PI * k) : 1 - k) * (p.a == null ? 1 : p.a);
    c.fillStyle = hexA(p.col, a * .22); c.beginPath(); c.arc(p.x, p.y, p.r * 2.6, 0, TAU); c.fill();
    c.fillStyle = hexA(p.col, a); c.beginPath(); c.arc(p.x, p.y, p.r, 0, TAU); c.fill(); },
  leaf:function(c, p, k){ var a = Math.sin(Math.PI * k) * .95;
    c.save(); c.translate(p.x, p.y); c.rotate(p.rot + p.age * p.spin); c.scale(1, .35 + .65 * Math.abs(Math.sin(p.age * p.flip + p.ph)));
    c.fillStyle = hexA(p.col, a); c.beginPath(); c.moveTo(-p.r, 0); c.quadraticCurveTo(0, -p.r * .7, p.r, 0); c.quadraticCurveTo(0, p.r * .7, -p.r, 0); c.fill();
    c.strokeStyle = 'rgba(255,255,255,' + (a * .45).toFixed(3) + ')'; c.lineWidth = .6; c.beginPath(); c.moveTo(-p.r * .9, 0); c.lineTo(p.r * .9, 0); c.stroke(); c.restore(); },
  petal:function(c, p, k){ var a = Math.sin(Math.PI * k) * .9;
    c.save(); c.translate(p.x, p.y); c.rotate(p.rot + p.age * p.spin); c.scale(1, .4 + .6 * Math.abs(Math.sin(p.age * p.flip + p.ph)));
    c.fillStyle = hexA(light(p.col, .45), a); c.beginPath(); c.ellipse(0, 0, p.r * .65, p.r * .42, 0, 0, TAU); c.fill(); c.restore(); },
  puff:function(c, p, k){ var a = Math.sin(Math.PI * k) * (p.a == null ? .2 : p.a), r = p.r0 + (p.r1 - p.r0) * k, ga = c.globalAlpha;
    c.globalAlpha = ga * a; c.drawImage(tdFxPuffSprite(p.col).cv, p.x - r, p.y - r, r * 2, r * 2); c.globalAlpha = ga; },
  streak:function(c, p, k){ var a = (1 - k) * (p.a == null ? 1 : p.a), sp = Math.hypot(p.vx, p.vy) || 1, L = p.len || 14;
    c.strokeStyle = hexA(p.col, a); c.lineWidth = p.w || 1.6; c.lineCap = 'round';
    c.beginPath(); c.moveTo(p.x, p.y); c.lineTo(p.x - p.vx / sp * L, p.y - p.vy / sp * L); c.stroke(); },
  plus:function(c, p, k){ var a = Math.sin(Math.PI * k), s = q4(p.r * (.7 + .3 * k));
    var sp = baked('plus|' + p.col + '|' + s, -s, -s, s, s, 6, function(b){ b.shadowColor = p.col; b.shadowBlur = 6;
      b.fillStyle = p.col; b.fillRect(-s, -s * .3, s * 2, s * .6); b.fillRect(-s * .3, -s, s * .6, s * 2);
      b.shadowBlur = 0; b.fillStyle = 'rgba(255,255,255,.8)'; b.fillRect(-s * .7, -s * .1, s * 1.4, s * .2); b.fillRect(-s * .1, -s * .7, s * .2, s * 1.4); });
    c.save(); c.translate(p.x, p.y); c.rotate(p.rot); c.globalAlpha *= a; blit(c, sp); c.restore(); }
};

var SHAPES = null;     /* made on first use: Path2D is a browser object */
function shapes(){
  if(SHAPES) return SHAPES;
  function gear(n, hole){
    var p = new Path2D(), ro = 1, ri = .78;
    for(var i = 0; i < n; i++){
      var a = i / n * TAU, s = TAU / n;
      [[ri, a], [ro, a + s * .18], [ro, a + s * .45], [ri, a + s * .62], [ri, a + s]].forEach(function(q, j){
        var x = Math.cos(q[1]) * q[0], y = Math.sin(q[1]) * q[0]; if(i === 0 && j === 0) p.moveTo(x, y); else p.lineTo(x, y); });
    }
    p.closePath(); p.moveTo(hole, 0); p.arc(0, 0, hole, 0, TAU); return {p:p, n:n};
  }
  /* ⚠ THE POLISH SHIELD (the author, session 72 - it replaced the round one):
     Armoria's own "polish" shield outline (MIT, github.com/Azgaar/Armoria),
     drawn in its 200x200 box, brought to the heater's size and middle - 124
     units tall, centred at y 2 - and its inner panel the same outline, inset */
  function polish(inset){
    var src = new Path2D('m 100,10 c 0,0 -2.5,-3.7 -9.7,-3.7 -12.7,0 -20.7,10.9 -40.5,14 0,11.8 -4.9,23.5 -11.4,31.1 0,0 12.7,6 12.7,19.3 C 51.1,90.8 30,90.8 30,90.8 c 0,0 -3.6,7.4 -3.6,22.4 0,34.3 23.1,60.2 40.7,68.2 17.6,8 27.7,11.4 32.9,18.6 5.2,-7.3 15.3,-10.7 32.8,-18.6 17.6,-8 40.7,-33.9 40.7,-68.2 0,-15 -3.6,-22.4 -3.6,-22.4 0,0 -21.1,0 -21.1,-20.1 0,-13.3 12.7,-19.3 12.7,-19.3 C 155.1,43.7 150.2,32.1 150.2,20.3 130.4,17.2 122.5,6.3 109.7,6.3 102.5,6.3 100,10 100,10 z');
    var p = new Path2D(), k = 124 / 193.7 * inset;
    p.addPath(src, new DOMMatrix().translate(0, 2).scale(k).translate(-100, -103.15));
    return p;
  }
  /* ⚠ THE WEDGE (the author, session 74): Armoria's own "wedged" shield (MIT,
     as the Polish one), brought to the same 124 units tall and middle */
  function wedge(inset){
    var src = new Path2D('m 51.2,19 h 96.4 c 3.1,12.7 10.7,20.9 26.5,20.8 C 175.7,94.5 165.3,144.3 100,200 43.5,154.2 22.8,102.8 25.1,39.7 37,38.9 47.1,34.7 51.2,19 z');
    var p = new Path2D(), k = 124 / 181 * inset;
    p.addPath(src, new DOMMatrix().translate(0, 2).scale(k).translate(-99.6, -109.5));
    return p;
  }
  function bottle(kind){ var p = new Path2D();
    if(kind === 'flask'){ p.arc(0, 8, 18, 0, TAU); p.rect(-5, -22, 10, 16); }
    else if(kind === 'vial'){ if(p.roundRect) p.roundRect(-9, -12, 18, 40, 8); else p.rect(-9, -12, 18, 40); p.rect(-4, -22, 8, 12); }
    else { p.rect(-15, -8, 30, 34); p.rect(-5, -22, 10, 15); }
    return p; }
  SHAPES = {
    sword:new Path2D('M-3 -1h6v19h-6Z M-15 18h30v4.5h-30Z M-5 22.5h10l-1.2 78l-3.8 13l-3.8-13Z'),
    swordHL:new Path2D('M-1 25h2l-.4 74h-1.2Z'),
    shields:{
      heater:[new Path2D('M0 -60L48 -44V-6C48 30 26 52 0 64C-26 52 -48 30 -48 -6V-44Z'), new Path2D('M0 -46L34 -34V-6C34 20 18 38 0 48C-18 38 -34 20 -34 -6V-34Z')],
      polish:[polish(1), polish(.74)],
      wedge:[wedge(1), wedge(.74)],
      kite:[new Path2D('M0 -66C30 -62 46 -42 46 -16C46 20 22 46 0 72C-22 46 -46 20 -46 -16C-46 -42 -30 -62 0 -66Z'), new Path2D('M0 -52C20 -49 32 -36 32 -16C32 12 16 32 0 52C-16 32 -32 12 -32 -16C-32 -36 -20 -49 0 -52Z')]
    },
    bow:new Path2D('M6 -72Q0 -66 -6 -58Q-40 -24 -40 0Q-40 24 -6 58Q0 66 6 72'),
    bottles:{flask:bottle('flask'), vial:bottle('vial'), square:bottle('square')},
    blade:new Path2D('M0 0Q-22 -5.5 -62 -7.5L-62 7.5Q-22 5.5 0 0Z'),
    fletch:new Path2D('M-66 0L-56 -6.5L-50 -6.5L-59 0L-50 6.5L-56 6.5Z'),
    head:new Path2D('M0 0L-11 -5L-8 0L-11 5Z'),
    /* the app's Demise skull (24x24), eyes cut out */
    skull:new Path2D('M12 2C7 2 3.5 5.6 3.5 10.2c0 2.8 1.3 4.6 2.9 5.7V19c0 .8.7 1.5 1.5 1.5h1.2V18h1.4v2.5h3V18h1.4v2.5h1.2c.8 0 1.5-.7 1.5-1.5v-3.1c1.6-1.1 2.9-2.9 2.9-5.7C20.5 5.6 17 2 12 2Zm-3.6 11.4a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2Zm7.2 0a2.1 2.1 0 1 1 0-4.2 2.1 2.1 0 0 1 0 4.2Z'),
    gears:[gear(10, .3), gear(7, .3), gear(8, .34), gear(12, .26)].map(function(g, i){ g.id = i; return g; })
  };
  return SHAPES;
}
function drawGear(c, gear, x, y, r, ang, cols){
  var sp = baked('gear|' + gear.id + '|' + cols.join() + '|' + r.toFixed(2), -r - 1, -r - 1, r + 1, r + 1, 8, function(b){
    b.scale(r, r); b.shadowColor = hexA(cols[0], .7); b.shadowBlur = 8;
    b.fillStyle = lin(b, -1, -1, 1, 1, cols.map(function(k){ return dark(k, .1); })); b.fill(gear.p, 'evenodd'); b.shadowBlur = 0;
    b.strokeStyle = 'rgba(0,0,0,.45)'; b.lineWidth = 1.4 / r; b.stroke(gear.p);
    b.strokeStyle = 'rgba(255,255,255,.35)'; b.lineWidth = 1 / r; b.beginPath(); b.arc(0, 0, .58, 0, TAU); b.stroke(); });
  c.save(); c.translate(x, y); c.rotate(ang); blit(c, sp); c.restore();
}
function drawArrow(c, cols){
  var S = shapes();
  c.fillStyle = lin(c, -66, 0, 0, 0, cols.map(function(k){ return dark(k, .2); })); c.fillRect(-66, -1.6, 58, 3.2);
  c.fillStyle = light(cols[cols.length - 1], .25); c.fill(S.fletch); c.fillStyle = '#dfe6ee'; c.fill(S.head);
}

/* E[key]() rolls an effect's random choices and returns draw(cu, co, R, t, dt, cols, S): cu paints behind the card, co in front;
   R is the card in the canvases' coordinates, S.el the card. */
var E = {};
function combo(keys){ var make = function(){ var parts = keys.map(function(k){ return E[k](); });
  return function(cu, co){ var args = arguments; parts.forEach(function(p){ cu.save(); co.save(); p.apply(null, args); cu.restore(); co.restore(); }); }; };
  make.parts = keys.slice(); return make; }

E.lightning = function(){ var bolts = [], next = 0; return function(cu, co, R, t, dt, cols){
  if(t >= next){ next = t + rnd(.45, 1); var u = Math.random(), L = rnd(.08, .16), pts = [];
    for(var i = 0; i <= 10; i++){ var q = perim(R, 2, u + L * i / 10); pts.push([q[0] + rnd(-5, 5), q[1] + rnd(-5, 5)]); }
    bolts.push({pts:pts, born:t, col:pick(cols)}); }
  for(var j = bolts.length - 1; j >= 0; j--){ var b = bolts[j], age = t - b.born; if(age > .28){ bolts.splice(j, 1); continue; }
    var a = (1 - age / .28) * (Math.random() < .3 ? .5 : 1);
    co.lineJoin = 'round';
    co.strokeStyle = hexA(b.col, .35 * a); co.lineWidth = 5; poly(co, b.pts); co.stroke();
    co.strokeStyle = 'rgba(255,255,255,' + a.toFixed(3) + ')'; co.lineWidth = 1.6; poly(co, b.pts); co.stroke(); } }; };
E.anvil = function(){ var P = new Parts(), next = 0; return function(cu, co, R, t, dt, cols){
  if(t >= next){ next = t + rnd(.7, 1.3); var f = Math.random(), x = R.x + f * R.w, sd = f < .5 ? -1 : 1, n = irnd(16, 26);
    for(var i = 0; i < n; i++) P.add({k:'streak', x:x, y:R.y + R.h, vx:sd * rnd(10, 150) + rnd(-30, 30), vy:-rnd(80, 210), ay:380, drag:.99, life:rnd(.6, 1.05), col:pick(cols.concat(['#fff1c9'])), len:7, w:1.4}); }
  P.step(dt); P.draw(co); }; };
E.orbs = function(){ var o = times(irnd(1, 2), function(){ return {ph:rnd(0, TAU), sp:rnd(.6, 1) * sgn(), rx:rnd(.85, 1.05), ry:rnd(.55, .7)}; });
  return function(cu, co, R, t, dt, cols){ o.forEach(function(q){
    var a = q.ph + t * q.sp, x = R.cx + Math.cos(a) * R.w * q.rx, y = R.cy + Math.sin(a) * R.h * q.ry;
    var ex = clamp(x, R.x, R.x + R.w), ey = clamp(y, R.y, R.y + R.h), n = 8, pts = [];
    for(var i = 0; i <= n; i++){ var f = i / n, j = i && i < n ? 4 : 0; pts.push([x + (ex - x) * f + rnd(-j, j), y + (ey - y) * f + rnd(-j, j)]); }
    co.strokeStyle = hexA(cols[0], .35); co.lineWidth = 4; poly(co, pts); co.stroke();
    co.strokeStyle = 'rgba(255,255,255,.85)'; co.lineWidth = 1.3; poly(co, pts); co.stroke();
    glowDot(co, x, y, 4.5, cols[0], 1); }); }; };
E.whirl = function(){ var n = irnd(10, 18), dir = sgn(), sp = rnd(1.1, 1.7); return function(cu, co, R, t, dt, cols){
  for(var i = 0; i < n; i++){ var a = dir * t * sp + i * TAU / n, z = Math.sin(a), c = z < 0 ? cu : co, v = ((i / n + t * .08) % 1);
    DRAW.leaf(c, {x:R.cx + Math.cos(a) * R.w * .78, y:R.y + R.h * (1.05 - v * 1.1) + z * 6, r:5 + 1.5 * z, col:cols[i % cols.length], rot:a, spin:0, age:t, flip:2, ph:i}, v * .9 + .05); } }; };
E.falling = function(){ var P = new Parts(), st = {}; return function(cu, co, R, t, dt, cols){
  emit(st, 'l', 2.4, dt, function(){ P.add({k:Math.random() < .6 ? 'leaf' : 'petal', x:R.x + rnd(-.3, 1.3) * R.w, y:R.y - R.h * .25, vx:rnd(-6, 6), vy:rnd(14, 22),
    life:rnd(4, 5.2), r:rnd(4, 6.5), col:pick(cols), rot:rnd(0, 7), spin:rnd(-1.2, 1.2), flip:rnd(1.5, 3), ph:rnd(0, 7), wob:18, wf:rnd(.8, 1.6)}); });
  P.step(dt); P.draw(co); }; };
E.tendrils = function(){ var corners = shuffle([0, 1, 2, 3]).slice(0, irnd(2, 4)).map(function(i){ return {i:i, len:rnd(.75, 1.25), sp:rnd(.7, 1.2), ph:rnd(0, 7)}; });
  return function(cu, co, R, t, dt, cols){
    var C = [[R.x, R.y, -1, -1], [R.x + R.w, R.y, 1, -1], [R.x + R.w, R.y + R.h, 1, 1], [R.x, R.y + R.h, -1, 1]];
    co.lineCap = 'round';
    corners.forEach(function(q){ var x = C[q.i][0], y = C[q.i][1], L = R.w * .5 * q.len * (.6 + .4 * Math.sin(t * .9 * q.sp + q.ph)), dx = C[q.i][2] * .7071, dy = C[q.i][3] * .7071, n = 16;
      function lat(f){ return Math.sin(f * 5 - t * 2 * q.sp + q.ph) * f * L * .25; }
      for(var j = 1; j <= n; j++){ var f0 = (j - 1) / n, f1 = j / n;
        co.strokeStyle = hexA(dark(cols[j % cols.length], .2), .9 * (1 - f0 * .5)); co.lineWidth = 5 * (1 - f0) + .5;
        co.beginPath(); co.moveTo(x + dx * L * f0 - dy * lat(f0), y + dy * L * f0 + dx * lat(f0)); co.lineTo(x + dx * L * f1 - dy * lat(f1), y + dy * L * f1 + dx * lat(f1)); co.stroke(); } }); }; };
E.mist = function(){ var P = new Parts(), st = {}, n = irnd(8, 14), dir = sgn(), sz = times(n, function(){ return rnd(.16, .26); });
  return function(cu, co, R, t, dt, cols){
    for(var i = 0; i < n; i++){ var u = ((dir * t * .035 + i / n) % 1 + 1) % 1, q = perim(R, 6, u), r = R.w * (sz[i] + .06 * Math.sin(t * .9 + i)), col = cols[i % cols.length];
      var pv = tdFxPuffSprite(col).cv, pa = .7 + .3 * Math.sin(t + i);
      cu.globalAlpha = .2 * pa; cu.drawImage(pv, q[0] - r, q[1] - r, r * 2, r * 2);
      co.globalAlpha = .09 * pa; co.drawImage(pv, q[0] - r, q[1] - r, r * 2, r * 2); }
    cu.globalAlpha = co.globalAlpha = 1;
    emit(st, 'm', 3.5, dt, function(){ var q = perim(R, rnd(-4, 14), Math.random()); P.add({k:'dot', x:q[0], y:q[1], vx:rnd(-8, 8), vy:-rnd(4, 14), r:rnd(.8, 1.4), life:rnd(1.5, 2.5), fade:'sin', col:light(pick(cols), .3)}); });
    P.step(dt); P.draw(co); }; };
E.plus = function(){ var P = new Parts(), st = {}, rate = rnd(2.5, 4.5); return function(cu, co, R, t, dt, cols){
  emit(st, 'p', rate, dt, function(){ var sd = sgn(); P.add({k:'plus', x:sd < 0 ? R.x - rnd(4, R.w * .35) : R.x + R.w + rnd(4, R.w * .35), y:R.y + R.h * rnd(.1, 1), vx:rnd(-4, 4), vy:-rnd(18, 30), life:rnd(1.6, 2.4), r:rnd(3, 5), rot:rnd(-.2, .2), col:pick(cols)}); });
  P.step(dt); P.draw(co); }; };
/* No star covers the card: each sits beyond its edge by more than the sway, and a line that would cross the face goes behind it. */
function cardHit(R, x0, y0, x1, y1){
  /* does the segment cross the card (Liang-Barsky against its box)? */
  var t0 = 0, t1 = 1, dx = x1 - x0, dy = y1 - y0, p = [-dx, dx, -dy, dy], q = [x0 - R.x, R.x + R.w - x0, y0 - R.y, R.y + R.h - y0];
  for(var i = 0; i < 4; i++){ if(p[i] === 0){ if(q[i] < 0) return false; continue; }
    var r = q[i] / p[i]; if(p[i] < 0){ if(r > t1) return false; if(r > t0) t0 = r; } else { if(r < t0) return false; if(r < t1) t1 = r; } }
  return t0 <= t1;
}
E.constellation = function(){ var pts = null, gen = -1, n = irnd(7, 11), T = rnd(7, 9), sway = rnd(.07, .11), swp = rnd(.35, .55), ph = rnd(0, 7), me = null;
  return (me = function(cu, co, R, t, dt, cols){
  var id = Math.floor(t / T), cyc = t % T, i;
  if(id !== gen){ gen = id; pts = []; var a0 = rnd(0, TAU), zs = shuffle(times(n, function(i){ return (i % 2 ? 1 : -1) * rnd(.25, 1); }));
    for(i = 0; i < n; i++){ var a = a0 + i / n * TAU + rnd(-.25, .25), dx = Math.abs(Math.cos(a)), dy = Math.abs(Math.sin(a));
      var d = Math.min(dx > 1e-6 ? R.w / 2 / dx : 1e9, dy > 1e-6 ? R.h / 2 / dy : 1e9) + R.w * rnd(.12, .34);
      /* kept relative to the card's middle, so the card's float carries them */
      pts.push({X:Math.cos(a) * d, Y:Math.sin(a) * d, z:zs[i], r:rnd(1.4, 2.6)}); } }
  var fade = cyc < .6 ? cyc / .6 : cyc > T - .7 ? (T - cyc) / .7 : 1, prog = clamp((cyc - .6) / (T * .52), 0, 1) * (pts.length - 1);
  var lf = cyc > T - 1.6 ? clamp(1 - (cyc - (T - 1.6)) / .9, 0, 1) : 1, th = Math.sin(t * swp + ph) * sway, st = Math.sin(th), ct = Math.cos(th);
  var at = pts.map(function(p){
    var X = p.X * ct + p.z * R.w * .55 * st, z = p.z * ct - p.X / (R.w * .55) * st, x = R.cx + X, y = R.cy + p.Y;
    if(x > R.x - 3 && x < R.x + R.w + 3 && y > R.y - 3 && y < R.y + R.h + 3){
      var k = Math.max(Math.abs(X) / (R.w / 2 + 4), Math.abs(p.Y) / (R.h / 2 + 4)); x = R.cx + X / k; y = R.cy + p.Y / k; }
    return {x:x, y:y, z:clamp(z, -1, 1), r:p.r}; });
  me.at = at;
  function seg(A, B, u0, u1, z){ var x0 = A.x + (B.x - A.x) * u0, y0 = A.y + (B.y - A.y) * u0, x1 = A.x + (B.x - A.x) * u1, y1 = A.y + (B.y - A.y) * u1;
    var c = z < 0 || cardHit(R, x0, y0, x1, y1) ? cu : co;
    c.strokeStyle = hexA(cols[0], (z < 0 ? .42 : .62) * lf * fade); c.lineWidth = z < 0 ? .9 : 1.3; c.beginPath(); c.moveTo(x0, y0); c.lineTo(x1, y1); c.stroke(); }
  for(i = 0; i < at.length - 1 && i < prog; i++){ var f = Math.min(1, prog - i), A = at[i], B = at[i + 1];
    if(A.z * B.z < 0){ var u = A.z / (A.z - B.z); seg(A, B, 0, Math.min(f, u), A.z); if(f > u) seg(A, B, u, f, B.z); }
    else seg(A, B, 0, f, A.z + B.z); }
  at.forEach(function(p, j){ var c = p.z < 0 ? cu : co, d = .5 + .5 * (p.z + 1) / 2, x = p.x, y = p.y, r = p.r * (.7 + .5 * (p.z + 1) / 2);
    var tw = (.7 + .3 * Math.sin(t * 3 + j * 1.7)) * fade * (.55 + .45 * d);
    c.fillStyle = hexA(cols[0], .3 * tw); c.beginPath(); c.arc(x, y, r * 3, 0, TAU); c.fill();
    c.strokeStyle = 'rgba(255,255,255,' + (.7 * tw).toFixed(3) + ')'; c.lineWidth = .8; c.beginPath(); c.moveTo(x - r * 2.4, y); c.lineTo(x + r * 2.4, y); c.moveTo(x, y - r * 2.4); c.lineTo(x, y + r * 2.4); c.stroke();
    c.fillStyle = 'rgba(255,255,255,' + tw.toFixed(3) + ')'; c.beginPath(); c.arc(x, y, r * .7, 0, TAU); c.fill(); }); }); };
E.ripple = function(){ var rings = irnd(2, 4), sp = rnd(.32, .5); return function(cu, co, R, t, dt, cols, S){
  var c = S.gb, g = ground(R);
  for(var i = 0; i < rings; i++){ var k = ((t * sp) + i / rings) % 1, rx = g.rx * (.35 + .8 * k);
    c.strokeStyle = hexA(cols[0], (1 - k) * .65); c.lineWidth = 1.6; c.beginPath(); c.ellipse(g.cx, g.cy, rx, rx * g.k, 0, 0, TAU); c.stroke(); } }; };
E.whirlpool = function(){ var arms = irnd(3, 5), dir = sgn(), sp = rnd(.8, 1.4), foam = times(14, function(){ return {r:rnd(.2, .95), a:rnd(0, TAU)}; });
  var lift = rnd(.45, .7), riser = function(h){ return {a:rnd(0, TAU), r:rnd(.3, .85), h:h, sp:rnd(.22, .38), sz:rnd(1, 1.8), white:Math.random() < .45}; };
  var rising = times(irnd(28, 40), function(){ return riser(Math.random()); }), me = null;
  return (me = function(cu0, co, R, t, dt, cols, S){
    var cu = S.gb, g = ground(R), cx = g.cx, cy = g.cy, sq = g.k, U = R.w / 84, top = 0, spin = dir * sp * 1.5;
    function spot(p, a, h){ var Y = Math.sin(a) * p.r * g.rx; return [cx + Math.cos(a) * p.r * g.rx, cy + Y * sq - h * R.h * lift, Y / g.rx]; }
    rising.forEach(function(p, i){
      var w = spin * (2.4 - p.r * 1.4);
      p.h += dt * p.sp; p.a += dt * w; p.r = Math.max(.12, p.r - dt * .05);
      if(p.h >= 1){ rising[i] = riser(0); return; }
      var at = spot(p, p.a, p.h), tail = spot(p, p.a - w * .16, Math.max(0, p.h - p.sp * .16)), v = at[2], c = nearOf(S, v);
      var x = at[0], y = at[1], a = Math.sin(Math.PI * p.h) * .9, rr = p.sz * U * depthScale(v), col = p.white ? '#ffffff' : light(cols[0], .45);
      c.save(); c.globalAlpha = a * .6; c.drawImage(tdFxPuffSprite(cols[0]).cv, x - rr * 3, y - rr * 3, rr * 6, rr * 6); c.restore();
      c.strokeStyle = hexA(light(cols[0], .3), a * .55); c.lineWidth = rr * 1.1; c.lineCap = 'round';
      c.beginPath(); c.moveTo(tail[0], tail[1]); c.lineTo(x, y); c.stroke();
      c.fillStyle = hexA(col, a); c.beginPath(); c.arc(x, y, rr, 0, TAU); c.fill();
      top = Math.max(top, p.h * R.h * lift); });
    me.rising = rising.length; me.top = top;
    function at(s, i){ var r = s * g.rx, a = dir * (s * 4.2 - t * sp) + i * TAU / arms; return [cx + Math.cos(a) * r, cy + Math.sin(a) * r * sq]; }
    cu.lineCap = 'round';
    for(var i = 0; i < arms; i++) for(var j = 1; j <= 30; j++){ var s0 = (j - 1) / 30, p0 = at(s0, i), p1 = at(j / 30, i);
      cu.strokeStyle = hexA(j % 3 ? cols[0] : light(cols[0], .5), (1 - s0) * .75); cu.lineWidth = 2.6 * (1 - s0) + .5;
      cu.beginPath(); cu.moveTo(p0[0], p0[1]); cu.lineTo(p1[0], p1[1]); cu.stroke(); }
    foam.forEach(function(f){ var a = f.a - dir * t * sp * (1.3 - f.r); cu.fillStyle = 'rgba(255,255,255,' + (.6 * (1 - f.r)).toFixed(3) + ')';
      cu.beginPath(); cu.arc(cx + Math.cos(a) * f.r * g.rx, cy + Math.sin(a) * f.r * g.rx * sq, 1.3, 0, TAU); cu.fill(); }); }); };
E.fireflies = function(){ var n = irnd(6, 12), sp = rnd(.6, 1.1), f = times(n, function(){ return {a:rnd(0, 7), b:rnd(0, 7), c:rnd(0, 7), fx:rnd(.3, .7), fy:rnd(.3, .7), blink:rnd(1.2, 2.6), bp:rnd(0, 7)}; });
  return function(cu, co, R, t, dt, cols){ f.forEach(function(q){ var w = wander(q, t, sp), b = Math.pow(.5 + .5 * Math.sin(t * TAU / q.blink + q.bp), 3);
    glowDot(co, R.cx + w[0] * R.w * .95, R.cy + w[1] * R.h * .8, 2.3, cols[0], .2 + .8 * b); }); }; };
E.dust = function(){ var P = new Parts(), st = {}, rate = rnd(5, 9), drift = pick([[-6, -2], [6, -2], [0, -7]]); return function(cu, co, R, t, dt, cols){
  emit(st, 'd', rate, dt, function(){ P.add({k:'dot', x:R.cx + rnd(-.9, .9) * R.w, y:R.cy + rnd(-.75, .75) * R.h, vx:drift[0] + rnd(-3, 3), vy:drift[1] + rnd(-3, 3), r:rnd(.6, 1.3), life:rnd(2.5, 4), fade:'sin', a:.85, col:light(pick(cols), .4)}); });
  P.step(dt); P.draw(co); }; };

var RUNES = [ [[[0, 1], [0, 0], [.6, .35], [0, .6]]], [[[0, 0], [.5, 1], [1, 0]], [[.25, .5], [.75, .5]]],
  [[[.5, 0], [.5, 1]], [[0, .3], [1, .7]]], [[[0, 0], [1, 1]], [[1, 0], [0, 1]], [[.5, 0], [.5, 1]]],
  [[[0, 1], [.5, 0], [1, 1]], [[.2, .65], [.8, .65]]], [[[.2, 0], [.2, 1], [.8, .7], [.2, .4]]] ];
function drawRune(c, x, y, s, rune, prog){
  var segs = rune.reduce(function(n, l){ return n + l.length - 1; }, 0), left = prog * segs;
  c.beginPath();
  rune.forEach(function(l){ for(var i = 1; i < l.length && left > 0; i++){
    var f = Math.min(1, left), ax = l[i - 1][0], ay = l[i - 1][1], bx = l[i][0], by = l[i][1]; left -= 1;
    c.moveTo(x + (ax - .5) * s, y + (ay - .5) * s); c.lineTo(x + (ax - .5 + (bx - ax) * f) * s, y + (ay - .5 + (by - ay) * f) * s); } });
  c.stroke();
}
E.runes = function(){ var slots = times(irnd(3, 5), function(){ return {next:rnd(0, 1.6), q:null}; }), LIFE = 3.2;
  var draw = function(cu, co, R, t, dt, cols){
    co.lineCap = 'round'; co.lineWidth = 1.5;
    slots.forEach(function(sl){
      if(!sl.q && t >= sl.next){ var a = rnd(0, TAU);
        sl.q = {dx:Math.cos(a) * rnd(.72, .9), dy:Math.sin(a) * rnd(.6, .72), r:pick(RUNES), born:t, s:rnd(.14, .2), rise:rnd(3, 8), ph:rnd(0, 7)}; }
      var q = sl.q; if(!q) return;
      var age = t - q.born;
      if(age > LIFE){ sl.q = null; sl.next = t + rnd(.3, 1.4); return; }
      var x = R.cx + q.dx * R.w + Math.sin(age * 1.3 + q.ph) * 2, y = R.cy + q.dy * R.h - age * q.rise;
      co.strokeStyle = hexA(cols[0], age < 1.2 ? .75 : .75 * (1 - (age - 1.2) / 2));
      drawRune(co, x, y, R.w * q.s, q.r, clamp(age / .55, 0, 1));
      draw.shown = slots.filter(function(z){ return z.q; }).length; }); };
  draw.slots = slots.length; draw.shown = 0;
  return draw; };

/* Every sword shares one frame, the pommel at the pivot and the blade down +y to about 118, so all swing alike. */
/* A blade round centre line cx(f), half-width hw(f), f from y0 to y1, its point tip beyond y1 and lean across. */
function bladeAlong(y0, y1, cx, hw, tip, lean){
  var p = new Path2D(), n = 24, i, f, y;
  for(i = 0; i <= n; i++){ f = i / n; y = y0 + (y1 - y0) * f; if(i) p.lineTo(cx(f) - hw(f), y); else p.moveTo(cx(f) - hw(f), y); }
  p.lineTo(cx(1) + (lean || 0), y1 + tip);
  for(i = n; i >= 0; i--){ f = i / n; y = y0 + (y1 - y0) * f; p.lineTo(cx(f) + hw(f), y); }
  p.closePath(); return p;
}
var SWORD_KEYS = ['classic', 'scimitar', 'flamberge', 'claymore', 'katana'];
var SWORDS = null;
function swords(){
  if(SWORDS) return SWORDS;
  var S = shapes();
  SWORDS = {
    classic:{box:[-15, -8.2, 15, 113.5]},
    scimitar:{box:[-15, -9, 19, 122],
      hilt:new Path2D('M-2.4 0H2.4V18H-2.4Z M-11 18Q-15 18 -14.5 22.5L-11 21H11L14.5 22.5Q15 18 11 18Z M-2.4 0Q-3 -6 -7.5 -7.5Q-3.5 -4 -2.4 0Z'),
      pommel:[0, -1.5, 3.2],
      blade:bladeAlong(21, 108, function(f){ return 8 * Math.pow(f, 2.2); }, function(f){ return 3 + 4 * Math.pow(f, 1.6); }, 11, -3.5),
      hl:bladeAlong(25, 100, function(f){ return 8 * Math.pow(f * .93, 2.2) - 1.4; }, function(){ return .55; }, 2, 0)},
    flamberge:{box:[-22, -9, 22, 122],
      hilt:new Path2D('M-2.2 0H2.2V26H-2.2Z M-20 26H20V29.5H-20Z M-4.4 29.5H4.4V36H-4.4Z'),
      pommel:[0, -3.2, 4], balls:[[-20.5, 27.75, 2.6], [20.5, 27.75, 2.6]], rings:[6, 11, 16, 21],
      blade:bladeAlong(36, 106, function(){ return 0; }, function(f){ return (4.4 + 1.5 * Math.sin(f * Math.PI * 8)) * (1 - .22 * f); }, 13, 0),
      hl:new Path2D('M-.5 38H.5L.4 104H-.4Z')},
    claymore:{box:[-20, -11, 20, 122],
      hilt:new Path2D('M-2.3 0H2.3V22H-2.3Z M-2.6 20L-16 30L-14 33L0 24L14 33L16 30L2.6 20Z'),
      pommel:[0, -4.5, 4.6], loops:[[-15.5, 32, 2.6], [15.5, 32, 2.6]], rings:[5, 10, 15],
      blade:bladeAlong(25, 104, function(){ return 0; }, function(f){ return 4.8 - 1.4 * f; }, 14, 0),
      hl:new Path2D('M-.9 30H.9L.6 100H-.6Z')},
    katana:{box:[-11, -6, 16, 124],
      hilt:new Path2D('M-2.5 0H2.5V21H-2.5Z M-8.5 21H8.5Q9.6 22.6 8.5 24.2H-8.5Q-9.6 22.6 -8.5 21Z M-2.9 24.2H2.9V27.5H-2.9Z'),
      pommel:null, wrap:true,
      blade:bladeAlong(27.5, 110, function(f){ return 6 * f * f; }, function(f){ return 2.6 - .5 * f; }, 8, 2.4),
      hl:bladeAlong(30, 106, function(f){ return 6 * Math.pow(f * .96, 2) + 1.2; }, function(){ return .4; }, 1, 0)}
  };
  return SWORDS;
}
function swordSprite(kind, cols, s){
  var W = swords()[kind], b = W.box, S = shapes();
  return baked('sword|' + kind + '|' + cols.join() + '|' + s.toFixed(4), b[0] * s, b[1] * s, b[2] * s, b[3] * s, 10, function(c){ c.scale(s, s);
    if(kind === 'classic'){
      c.shadowColor = hexA(cols[0], .9); c.shadowBlur = 10; c.fillStyle = lin(c, 0, 0, 0, 114, cols.map(function(k){ return light(k, .1); })); c.fill(S.sword);
      c.beginPath(); c.arc(0, -4, 4.2, 0, TAU); c.fill(); c.shadowBlur = 0; c.fillStyle = 'rgba(255,255,255,.4)'; c.fill(S.swordHL); return; }
    c.shadowColor = hexA(cols[0], .9); c.shadowBlur = 10;
    c.fillStyle = lin(c, 0, 20, 0, 120, cols.map(function(k){ return light(k, .18); })); c.fill(W.blade);
    var hilt = lin(c, 0, -8, 0, 36, cols.map(function(k){ return dark(k, .12); }));
    c.fillStyle = hilt; c.fill(W.hilt);
    if(W.pommel){ c.beginPath(); c.arc(W.pommel[0], W.pommel[1], W.pommel[2], 0, TAU); c.fill(); }
    (W.balls || []).forEach(function(q){ c.beginPath(); c.arc(q[0], q[1], q[2], 0, TAU); c.fill(); });
    c.shadowBlur = 0;
    (W.loops || []).forEach(function(q){ c.strokeStyle = hilt; c.lineWidth = 1.6; c.beginPath(); c.arc(q[0], q[1], q[2], 0, TAU); c.stroke(); });
    c.fillStyle = 'rgba(255,255,255,.45)'; c.fill(W.hl);
    c.strokeStyle = 'rgba(0,0,0,.35)'; c.lineWidth = .7;
    (W.rings || []).forEach(function(y){ c.beginPath(); c.moveTo(-2.3, y); c.lineTo(2.3, y + 1.2); c.stroke(); });
    if(W.wrap) for(var y = 2; y < 20; y += 4){ c.beginPath(); c.moveTo(-2.5, y); c.lineTo(2.5, y + 2); c.moveTo(2.5, y); c.lineTo(-2.5, y + 2); c.stroke(); } });
}
E.swords = function(){ var per = rnd(2.8, 4), amp = rnd(.21, .35), me = null;
  var sw = times(2, function(){ return {h:rnd(.72, 1.02), len:rnd(.5, .75), kind:pick(SWORD_KEYS)}; });
  return (me = function(cu, co, R, t, dt, cols){
    [-1, 1].forEach(function(sd, si){
      var q = sw[si], s = R.h * q.len / 115, px = sd < 0 ? R.x - R.w * .27 : R.x + R.w * 1.27, py = R.y + R.h * q.h;
      var ang = sd * Math.sin(t * TAU / per) * amp;
      co.save(); co.translate(px, py); co.rotate(Math.PI + ang); blit(co, swordSprite(q.kind, cols, s)); co.restore();
    });
    me.kinds = sw.map(function(q){ return q.kind; }); }); };
E.prisms = function(){ var dir = sgn(), q = times(irnd(4, 8), function(){ return {ph:rnd(0, TAU), sp:rnd(.35, .6), h:rnd(-.35, .35), s:rnd(.8, 1.2), next:rnd(.5, 3), beam:-9}; });
  return function(cu, co, R, t, dt, cols){ q.forEach(function(c){
    var a = dir * t * c.sp + c.ph, z = Math.sin(a), x = R.cx + Math.cos(a) * R.w * .85, y = R.cy + c.h * R.h + z * R.h * .08, cx = z < 0 ? cu : co, s = R.w * .07 * c.s * (.85 + .15 * z);
    if(t >= c.next){ c.next = t + rnd(2, 4); c.beam = t; }
    var bk = clamp(1 - (t - c.beam) / .5, 0, 1);
    if(bk > 0){ var g = co.createLinearGradient(x, y, R.cx, R.cy); g.addColorStop(0, 'rgba(255,255,255,' + (.7 * bk).toFixed(3) + ')'); g.addColorStop(1, hexA(cols[0], 0));
      co.strokeStyle = g; co.lineWidth = 3; co.beginPath(); co.moveTo(x, y); co.lineTo(R.cx + (R.cx - x) * .3, R.cy + (R.cy - y) * .3); co.stroke(); }
    var sq = q4(s), sp = baked('prism|' + cols[0] + '|' + sq, -sq, -sq * 1.5, sq, sq * 1.5, 8, function(k){ k.shadowColor = cols[0]; k.shadowBlur = 8;
      k.fillStyle = lin(k, -sq, -sq, sq, sq, [light(cols[0], .7), cols[0], dark(cols[0], .2)]); k.beginPath();
      for(var i = 0; i < 6; i++){ var b = i / 6 * TAU; k.lineTo(Math.cos(b) * sq * (i % 3 ? .6 : 1), Math.sin(b) * sq * 1.5 * (i % 3 ? 1 : .2)); }
      k.closePath(); k.fill(); k.shadowBlur = 0; k.strokeStyle = 'rgba(255,255,255,.7)'; k.lineWidth = .8; k.stroke(); });
    cx.save(); cx.translate(x, y); cx.rotate(t * .6 + c.ph); blit(cx, sp); cx.restore(); }); }; };
E.cogs = function(){
  var SPOTS = [[-.08, .18], [-.12, .55], [-.06, .9], [1.08, .16], [1.12, .5], [1.06, .86], [.5, -.1], [.5, 1.08]];
  var gears = shapes().gears, n = irnd(2, 4);
  var g = shuffle(SPOTS.slice()).slice(0, n).map(function(sp){ return {sp:sp, r:rnd(.18, .32), gear:pick(gears), per:rnd(.8, 1.4), dir:sgn(), ph:rnd(0, 1)}; });
  var mAng = Math.atan2(g[0].sp[1] - .5, g[0].sp[0] - .5) + rnd(-.7, .7);
  return function(cu, co, R, t, dt, cols){
    function tick(q){ var k = t / q.per + q.ph, f = k - Math.floor(k); return (Math.floor(k) + backOut(clamp(f / .22, 0, 1))) * TAU / q.gear.n * q.dir; }
    var bob = Math.sin(t * 1.1) * 3, a0 = g[0], r0 = R.w * a0.r, x0 = R.x + R.w * a0.sp[0], y0 = R.y + R.h * a0.sp[1] + bob;
    g.forEach(function(q, i){
      var r = R.w * q.r, x, y, ang;
      if(i === 0){ x = x0; y = y0; ang = tick(q); }
      else if(i === 1){ x = x0 + Math.cos(mAng) * (r0 + r) * .93; y = y0 + Math.sin(mAng) * (r0 + r) * .93; ang = -tick(a0) * r0 / r + .2; }
      else { x = R.x + R.w * q.sp[0]; y = R.y + R.h * q.sp[1] - bob; ang = tick(q); }
      drawGear(cu, i === 1 ? a0.gear : q.gear, x, y, r, ang, cols); }); }; };
var FIL_N = 0;
function filigree(){
  var place = Math.random() < .5 ? 'lr' : 'tb', strokes = [], beads = [], leaves = [];
  function scroll(x, y, h, L, turn, dir, w0, w1, depth){
    var n = 30, ds = L / n, pts = [[x, y]], hs = [h], k = turn * 3.5 / L;
    for(var i = 1; i <= n; i++){ var f = i / n; h += dir * k * Math.pow(f, 2.5) * ds; x += Math.cos(h) * ds; y += Math.sin(h) * ds; pts.push([x, y]); hs.push(h); }
    strokes.push({pts:pts, w0:w0, w1:w1});
    beads.push([x, y, Math.max(1.1, w1 * 1.6)]);
    if(depth > 0) times(irnd(1, 2), function(){ var f = rnd(.22, .6), i = Math.round(f * n), wf = w0 + (w1 - w0) * f;
      scroll(pts[i][0], pts[i][1], hs[i] - dir * rnd(.5, .95), L * rnd(.34, .52), rnd(3.4, 5.2), -dir, wf * .75, .55, depth - 1); });
    if(depth > 0 && Math.random() < .8) times(irnd(1, 2), function(){ var i = irnd(6, n - 10), nrm = hs[i] + dir * Math.PI / 2 * sgn();
      leaves.push([pts[i][0], pts[i][1], nrm, rnd(3.5, 6)]); });
  }
  if(place === 'lr'){
    scroll(43, rnd(-42, -4), rnd(-.45, .25), rnd(28, 38), rnd(4.4, 6.2), sgn(), rnd(2.4, 3.2), .8, 1);
    if(Math.random() < .5) scroll(40, rnd(4, 22), rnd(.15, .6), rnd(18, 26), rnd(3.8, 5.2), sgn(), rnd(1.8, 2.4), .7, 0);
  } else {
    scroll(rnd(3, 8), -55, -Math.PI / 2 + rnd(.3, .75), rnd(24, 34), rnd(4.2, 6), sgn(), rnd(2.2, 3), .8, 1);
    scroll(rnd(2, 5), 58, Math.PI / 2 - rnd(.25, .65), rnd(20, 28), rnd(3.8, 5.6), sgn(), rnd(2, 2.8), .7, 1);
  }
  var x1 = 0, y0 = 0, y1 = 0;
  strokes.forEach(function(st){ st.pts.forEach(function(p){ x1 = Math.max(x1, Math.abs(p[0]) + 4); y0 = Math.min(y0, p[1] - 4); y1 = Math.max(y1, p[1] + 4); }); });
  leaves.forEach(function(l){ x1 = Math.max(x1, Math.abs(l[0]) + l[3] + 2); y0 = Math.min(y0, l[1] - l[3] - 2); y1 = Math.max(y1, l[1] + l[3] + 2); });
  return {id:++FIL_N, place:place, strokes:strokes, beads:beads, leaves:leaves, box:[-x1, y0, x1, y1]};
}
function paintFiligree(b, F, cols){
  var ink = lin(b, -60, -80, 60, 80, cols.map(function(k){ return light(k, .55); }));
  [1, -1].forEach(function(m){ b.save(); b.scale(m, 1);
    b.strokeStyle = ink; b.lineCap = 'round';
    F.strokes.forEach(function(st){ var n = st.pts.length - 1;
      for(var i = 1; i <= n; i++){ var a = st.pts[i - 1], c = st.pts[i]; b.lineWidth = st.w0 + (st.w1 - st.w0) * i / n;
        b.beginPath(); b.moveTo(a[0], a[1]); b.lineTo(c[0], c[1]); b.stroke(); } });
    b.fillStyle = ink;
    F.leaves.forEach(function(l){ b.save(); b.translate(l[0], l[1]); b.rotate(l[2]); b.beginPath(); b.moveTo(0, 0);
      b.quadraticCurveTo(l[3] * .5, -l[3] * .42, l[3], 0); b.quadraticCurveTo(l[3] * .5, l[3] * .42, 0, 0); b.fill(); b.restore(); });
    b.fillStyle = light(cols[0], .8);
    F.beads.forEach(function(d){ b.beginPath(); b.arc(d[0], d[1], d[2], 0, TAU); b.fill(); });
    b.restore(); });
}
E.shield = function(){ var keys = ['heater', 'polish', 'kite', 'wedge'], shape = pick(keys), bob = rnd(1, 1.6), lean = sgn(), F = filigree(), me = null;
  return (me = function(cu, co, R, t, dt, cols){ var P = shapes().shields[shape], s = R.h * 1.22 / 124;
    var bx = Math.max(55.5, F.box[2]), by0 = Math.min(-67.5, F.box[1]), by1 = Math.max(73.5, F.box[3]);
    var sp = baked('shield|' + shape + '|' + F.id + '|' + cols.join() + '|' + s.toFixed(4), -bx * s, by0 * s, bx * s, by1 * s, 18, function(b){ b.scale(s, s);
      b.shadowColor = hexA(cols[0], .7); b.shadowBlur = 8; paintFiligree(b, F, cols);
      b.shadowColor = hexA(cols[0], .8); b.shadowBlur = 18; b.fillStyle = lin(b, 0, -60, 0, 64, cols.map(function(k){ return dark(k, .15); })); b.fill(P[0], 'evenodd'); b.shadowBlur = 0;
      b.fillStyle = 'rgba(0,0,0,.25)'; b.fill(P[1], 'evenodd');
      b.strokeStyle = lin(b, -48, -60, 48, 64, cols.map(function(k){ return light(k, .55); })); b.lineWidth = 3; b.stroke(P[0]); b.lineWidth = 1.5; b.stroke(P[1]); });
    me.shape = shape; me.fil = F;
    cu.save(); cu.translate(R.cx, R.cy - R.h * .02 + Math.sin(t * bob) * 4); cu.rotate(lean * Math.sin(t * .8) * .04); blit(cu, sp); cu.restore(); }); };
/* A shot every 3.2 to 4.8 s, the time between going into the draw. */
function bowAim(t){ var base = rnd(1.6, 2.4); return {at:t, per:base * 2, draw:.8 + base, y:rnd(-.08, .08), ang:rnd(-.09, .09)}; }
E.bow = function(){ var dir = sgn(), flying = [], aim = bowAim;
  var shot = aim(0);
  return function(cu, co, R, t, dt, cols){
    var S = shapes(), s = R.h * 1.5 / 144, k = t - shot.at, bx = R.cx - dir * R.w * .22, by = R.cy + Math.sin(t * 1.1) * 3, pull = 0, nocked = true;
    var drawn = .15 + shot.draw, loose = drawn + .15;
    if(k < .15) pull = 0; else if(k < drawn) pull = ease((k - .15) / shot.draw) * 22; else if(k < loose) pull = 22 + Math.sin(k * 70) * .4;
    else { nocked = false;
      if(!shot.fired){ shot.fired = true; flying.push({x0:bx - dir * 30 * s, x:bx - dir * 30 * s, y:by + shot.y * R.h, vx:-dir * 820 * Math.cos(shot.ang), vy:820 * Math.sin(shot.ang)}); }
      var r = k - loose; pull = 22 * Math.exp(-r * 14) * Math.cos(r * 40); }
    if(k > shot.per) shot = aim(t);
    var ny = shot.y * R.h / s;
    var limb = baked('bow|' + cols.join() + '|' + s.toFixed(4), -43 * s, -75 * s, 9 * s, 75 * s, 12, function(b){ b.scale(s, s);
      b.shadowColor = hexA(cols[0], .9); b.shadowBlur = 12; b.lineCap = 'round';
      b.strokeStyle = lin(b, 0, -72, 0, 72, cols.map(function(c2){ return light(c2, .05); })); b.lineWidth = 6; b.stroke(S.bow); });
    cu.save(); cu.translate(bx, by); cu.scale(dir * s, s);
    cu.strokeStyle = 'rgba(240,240,230,.8)'; cu.lineWidth = .9; cu.beginPath(); cu.moveTo(6, -72); cu.lineTo(6 + pull, ny); cu.lineTo(6, 72); cu.stroke();
    cu.save(); cu.scale(1 / s, 1 / s); blit(cu, limb); cu.restore();
    cu.fillStyle = lin(cu, 0, -12, 0, 12, cols.map(function(c2){ return dark(c2, .45); })); cu.fillRect(-44, -11, 9, 22);
    if(nocked){ cu.save(); cu.globalAlpha = clamp(k / .15, 0, 1); cu.translate(6 + pull - 66, ny); cu.rotate(Math.PI); drawArrow(cu, cols); cu.restore(); }
    cu.restore();
    /* An arrow fades before the canvas's edge, as far as anything of this card can be drawn, so it flies off and is not cut. */
    for(var i = flying.length - 1; i >= 0; i--){ var a = flying[i]; a.x += a.vx * dt; a.y += a.vy * dt;
      var al = clamp(1 - (Math.abs(a.x - a.x0) - R.w * .55) / (R.w * .45), 0, 1);
      if(al <= 0){ flying.splice(i, 1); continue; }
      co.save(); co.globalAlpha = al;
      co.strokeStyle = hexA(cols[0], .35); co.lineWidth = 2; co.beginPath(); co.moveTo(a.x, a.y); co.lineTo(a.x - a.vx * .06, a.y - a.vy * .06); co.stroke();
      co.translate(a.x, a.y); co.rotate(Math.atan2(a.vy, a.vx)); co.scale(s * 1.05, s * 1.05); drawArrow(co, cols); co.restore(); } }; };
E.potions = function(){ var P = new Parts(), st = {}, keys = ['flask', 'vial', 'square'], kinds = [pick(keys), pick(keys)],
    lag = [0, rnd(0, .8)], land = [rnd(-.05, .05), rnd(-.05, .05)], last = [-1, -1];
  return function(cu, co, R, t, dt, cols){
    var T = 5.2, s = R.w * .19 / 18, sheenMax = 0, S = shapes();
    [-1, 1].forEach(function(sd, si){
      var tt = Math.max(0, t - lag[si]), cyc = tt % T, id = Math.floor(tt / T);
      if(id !== last[si]){ last[si] = id; land[si] = rnd(-.05, .05); }
      var tilt, fill, pour = 0;
      if(cyc < .9){ tilt = ease(cyc / .9); fill = 1; }
      else if(cyc < 3.7){ tilt = 1; pour = 1; fill = 1 - .7 * (cyc - .9) / 2.8; }
      else if(cyc < 4.5){ tilt = 1 - ease((cyc - 3.7) / .8); fill = .3; }
      else { tilt = 0; fill = .3 + .7 * (cyc - 4.5) / .7; }
      sheenMax = Math.max(sheenMax, cyc < .9 ? 0 : cyc < 3.7 ? clamp((cyc - 1) / 1.2, 0, 1) : clamp(1 - (cyc - 3.7) / 1.4, 0, 1));
      var streamIn = pour ? clamp((cyc - .9) / .18, 0, 1) : 0, streamOut = pour ? clamp((cyc - 3.5) / .2, 0, 1) : 0;
      var bx = sd < 0 ? R.x - R.w * .4 : R.x + R.w * 1.4, by = R.y - R.h * .06 + Math.sin(t * 1.2 + sd) * 2, ang = -sd * (.35 + 1.7 * tilt);
      var nx = bx + Math.sin(ang) * 25 * s, ny = by - Math.cos(ang) * 25 * s;
      var tx = R.cx + sd * R.w * (.36 + land[si]), ty = R.y + R.h * .26;
      if(pour){ var a0 = streamOut, a1 = streamIn, cx1 = nx + (tx - nx) * .55 + Math.sin(t * 11 + sd) * 1.5, cy1 = ny + (ty - ny) * .02, pts = [];
        for(var i = 0; i <= 18; i++){ var f = a0 + (a1 - a0) * i / 18; pts.push([(1 - f) * (1 - f) * nx + 2 * (1 - f) * f * cx1 + f * f * tx, (1 - f) * (1 - f) * ny + 2 * (1 - f) * f * cy1 + f * f * ty]); }
        co.lineCap = 'round'; co.lineWidth = 6.4; co.strokeStyle = lin(co, nx, ny, tx, ty, cols); poly(co, pts); co.stroke();
        co.lineWidth = 1.6; co.strokeStyle = 'rgba(255,255,255,.45)'; poly(co, pts); co.stroke();
        if(streamIn >= 1 && streamOut < 1) emit(st, 'd' + sd, 26, dt, function(){ P.add({k:'dot', x:tx, y:ty, vx:rnd(-45, 45), vy:-rnd(20, 60), ay:240, life:rnd(.35, .55), r:1.3, col:pick(cols)}); }); }
      var B = S.bottles[kinds[si]], d = co.getTransform ? co.getTransform() : null;
      co.save(); co.translate(bx, by); co.rotate(ang); co.scale(s, s);
      co.fillStyle = 'rgba(200,230,255,.1)'; co.fill(B);
      co.save(); co.clip(B); if(d) co.setTransform(d);
      var lvl = by + 26 * s - fill * 44 * s; co.fillStyle = lin(co, bx, lvl, bx, by + 26 * s, cols.map(function(k){ return light(k, .1); })); co.fillRect(bx - 40 * s, lvl, 80 * s, 80 * s); co.restore();
      co.strokeStyle = 'rgba(235,245,255,.75)'; co.lineWidth = 1.4 / s; co.stroke(B);
      co.fillStyle = 'rgba(255,255,255,.5)'; co.beginPath(); co.ellipse(-6, 4, 2.6, 6, .4, 0, TAU); co.fill();
      co.fillStyle = '#8a6440'; co.fillRect(-6, -27, 12, 5); co.restore();
    });
    if(sheenMax > 0){ co.save(); rrect(co, R.x, R.y, R.w, R.h, 6); co.clip();
      var g = co.createRadialGradient(R.cx, R.y + R.h * .26, 0, R.cx, R.y + R.h * .26, R.w * .75);
      g.addColorStop(0, hexA(cols[0], .38 * sheenMax)); g.addColorStop(1, hexA(cols[0], 0));
      co.fillStyle = g; co.fillRect(R.x, R.y, R.w, R.h); co.restore(); }
    P.step(dt); P.draw(co); }; };
/* A swing whose scythe would reach past the canvases is drawn smaller, only that swing and only as much as it needs (reapFit). */
/* Each in its own units: the hands at the origin, the shaft up -y, the blade towards +x; tips are what the smear follows. */
var SCYTHES = {
  reaper:{pole:'M0 18C-7 -20 7 -62 0 -92', pw:4.2, nibs:'M0 -8L11 -13M1 -48L12 -53',
    blade:'M-3 -90Q30 -110 76 -70Q36 -88 2 -82Z', edge:'M74 -70.6Q36 -88 3 -82.5', collar:[-4, -96, 8, 9],
    tips:[[76, -70, 38, -92]], box:[-14, -116, 84, 26]},
  war:{pole:'M0 18L0 -72', pw:4.4, wraps:'M-2.6 0L2.6 4M-2.6 5L2.6 9M-2.6 10L2.6 14',
    blade:'M-3 -79Q-9 -114 14 -134Q5 -106 5 -79Z', edge:'M13 -132Q5 -106 5.5 -80', spike:'M-4 -74L-19 -81L-4 -79Z', collar:[-4.5, -79, 9, 9],
    tips:[[14, -134, 0, -106]], box:[-24, -140, 24, 26]},
  twin:{pole:'M0 52L0 -52', pw:4, wrap:[-3.2, -9, 6.4, 18],
    blade:'M-2 -50Q24 -68 58 -40Q27 -52 2 -44ZM2 50Q-24 68 -58 40Q-27 52 -2 44Z', edge:'M57 -40.5Q27 -52 2.5 -44.5M-57 40.5Q-27 52 -2.5 44.5',
    tips:[[58, -40, 29, -56], [-58, 40, -29, 56]], box:[-64, -70, 64, 70]},
  sickle:{grow:1.4, pole:'M0 16L0 -18', pw:6.5, pommel:[0, 18, 3.4],
    blade:'M-3.4 -18C-15 -54 30 -74 42 -36C31 -60 0 -52 3.4 -20Z', edge:'M41 -37C31 -60 0 -52 3.6 -21',
    tips:[[42, -36, 14, -58]], box:[-20, -72, 48, 26]},
  moon:{pole:'M0 18C-12 -25 10 -65 0 -92', pw:4.6, ring:[0, -93, 5.5],
    blade:'M-3 -97C20 -126 72 -114 88 -72C62 -100 26 -100 4 -88ZM37 -104A3.2 3.2 0 1 0 30.6 -104A3.2 3.2 0 1 0 37 -104Z', edge:'M87 -72.5C62 -100 26 -100 4.5 -88.5',
    spur:'M-4 -97Q-21 -104 -24 -120Q-13 -106 -2 -91Z', tips:[[88, -72, 44, -106]], box:[-30, -132, 96, 26]}
};
var SCYTHE_KEYS = Object.keys(SCYTHES), SCYTHE_P = null;
function scythePaths(){
  if(SCYTHE_P) return SCYTHE_P;
  SCYTHE_P = {};
  SCYTHE_KEYS.forEach(function(k){ var q = SCYTHES[k], o = {pole:new Path2D(q.pole), blade:new Path2D(q.blade), edge:new Path2D(q.edge)};
    ['nibs', 'wraps', 'spike', 'spur'].forEach(function(n){ if(q[n]) o[n] = new Path2D(q[n]); }); SCYTHE_P[k] = o; });
  return SCYTHE_P;
}
function scytheSprite(k, s, cols){
  var q = SCYTHES[k], b = q.box, col = cols[0], P = scythePaths()[k];
  s = Math.round(s * 50) / 50;
  return {s:s, sp:baked('scythe|' + k + '|' + col + '|' + s, b[0] * s, b[1] * s, b[2] * s, b[3] * s, 11, function(c){ c.scale(s, s);
    var wood = [dark(col, .7), dark(col, .45), dark(col, .62)];
    c.lineCap = 'round'; c.lineJoin = 'round';
    c.shadowColor = hexA(col, .55); c.shadowBlur = 5 * s;
    c.strokeStyle = lin(c, -4, 0, 4, 0, wood); c.lineWidth = q.pw; c.stroke(P.pole); c.shadowBlur = 0;
    c.strokeStyle = hexA(light(col, .35), .35); c.lineWidth = .8; c.stroke(P.pole);
    if(P.nibs){ c.strokeStyle = dark(col, .5); c.lineWidth = 3; c.stroke(P.nibs); }
    if(P.wraps){ c.strokeStyle = hexA(light(col, .4), .7); c.lineWidth = 1; c.stroke(P.wraps); }
    if(q.wrap){ c.fillStyle = dark(col, .25); c.fillRect.apply(c, q.wrap); c.strokeStyle = hexA(light(col, .5), .6); c.lineWidth = .8;
      for(var y = q.wrap[1] + 2; y < q.wrap[1] + q.wrap[3]; y += 3){ c.beginPath(); c.moveTo(q.wrap[0], y); c.lineTo(q.wrap[0] + q.wrap[2], y + 2); c.stroke(); } }
    if(q.pommel){ c.fillStyle = dark(col, .4); c.beginPath(); c.arc(q.pommel[0], q.pommel[1], q.pommel[2], 0, TAU); c.fill(); }
    c.shadowColor = col; c.shadowBlur = 11 * s;
    c.fillStyle = lin(c, b[0], b[1], b[2], b[3] * .2, [light(col, .1), light(col, .55), light(col, .3)]);
    c.fill(P.blade, 'evenodd'); if(P.spike) c.fill(P.spike); if(P.spur) c.fill(P.spur);
    c.shadowBlur = 0;
    c.strokeStyle = hexA(dark(col, .5), .7); c.lineWidth = .8; c.stroke(P.blade);
    c.strokeStyle = 'rgba(255,255,255,.9)'; c.lineWidth = 1.3; c.stroke(P.edge);
    if(q.collar){ c.fillStyle = dark(col, .3); c.fillRect.apply(c, q.collar); c.strokeStyle = hexA(light(col, .5), .6); c.lineWidth = .7; c.strokeRect.apply(c, q.collar); }
    if(q.ring){ c.strokeStyle = light(col, .45); c.lineWidth = 2; c.beginPath(); c.arc(q.ring[0], q.ring[1], q.ring[2], 0, TAU); c.stroke();
      c.shadowColor = '#ffffff'; c.shadowBlur = 6 * s; c.fillStyle = light(col, .8); c.beginPath(); c.arc(q.ring[0], q.ring[1], 2.4, 0, TAU); c.fill(); c.shadowBlur = 0; } })};
}
function scythePt(u, v, x, y, ang, s, flip){
  var lx = (flip ? -u : u) * s, ly = v * s, co = Math.cos(ang), si = Math.sin(ang);
  return [x + lx * co - ly * si, y + lx * si + ly * co];
}
/* Answers [outward, inward, up, down] at full size through a swing from a0 to a1; side is outward. */
function reapReach(k, side, flip, a0, a1){
  var b = SCYTHES[k].box, ext = [0, 0, 0, 0], PAD = 10;
  for(var i = 0; i <= 12; i++){ var a = a0 + (a1 - a0) * i / 12;
    [[b[0] - PAD, b[1] - PAD], [b[2] + PAD, b[1] - PAD], [b[0] - PAD, b[3] + PAD], [b[2] + PAD, b[3] + PAD]].forEach(function(q){
      var p = scythePt(q[0], q[1], 0, 0, a, 1, flip), u = p[0] * side;
      ext[0] = Math.max(ext[0], u); ext[1] = Math.max(ext[1], -u); ext[2] = Math.max(ext[2], -p[1]); ext[3] = Math.max(ext[3], p[1]); }); }
  return ext;
}
/* The canvases are 320% of the card wide from -110% and 250% tall from -75% (boardfx.css); a little in from that. */
function reapFit(R, px, py, side, ext){
  var outRoom = R.x + R.w * (side > 0 ? 2.1 : -1.1) - px, inRoom = px - (R.x + R.w * (side > 0 ? -1.1 : 2.1));
  outRoom = Math.abs(outRoom) - R.w * .04; inRoom = Math.abs(inRoom) - R.w * .04;
  var up = py - (R.y - R.h * .75) - R.h * .03, down = R.y + R.h * 1.75 - py - R.h * .03;
  return Math.min(outRoom / ext[0], inRoom / ext[1], up / ext[2], down / ext[3]);
}
E.reap = function(){ var cur = null, next = rnd(.25, .5), hist = [], me = null;
  function roll(t){ var side = sgn(), k = pick(SCYTHE_KEYS);
    var q = {t0:t, side:side, k:k, size:rnd(.95, 1.12), back:rnd(.14, .26), sweep:rnd(1.9, 2.3), lean:rnd(.14, .32), wind:rnd(.35, .5), swing:rnd(.26, .34),
             follow:.24, py:rnd(.15, .32), front:Math.random() < .5, gap:rnd(.25, .8)};
    /* The lab's period (its fade in sat inside the draw-back), and a third more for the slower fades. */
    var old = q.wind + q.swing + q.follow + .3 + q.gap, extra = old / 3;
    q.appear = extra / 2; q.fadeOut = .3 + extra / 2; q.period = old + extra; q.old = old;
    return q; }
  return (me = function(cu, co, R, t, dt, cols){
    if(!cur && t >= next){ cur = roll(t); hist.length = 0; me.swings = (me.swings || 0) + 1; me.last = cur; }
    if(!cur) return;
    var q = cur, a = t - q.t0, T0 = q.appear, T1 = T0 + q.wind, T2 = T1 + q.swing, T3 = T2 + q.follow, T4 = T3 + q.fadeOut;
    if(a > T4){ cur = null; next = q.t0 + q.period; return; }
    var A0 = q.side * q.lean, A1 = A0 + q.side * q.back, A2 = A0 - q.side * q.sweep, ang;
    if(a < T0) ang = A0;
    else if(a < T1) ang = A0 + (A1 - A0) * easeOut((a - T0) / q.wind);
    else if(a < T2){ var k = (a - T1) / q.swing; ang = A1 + (A2 - A1) * (k < .7 ? Math.pow(k / .7, 3) * .78 : .78 + .22 * easeOut((k - .7) / .3)); }
    else ang = A2 - q.side * .12 * easeOut(clamp((a - T2) / (q.follow + q.fadeOut), 0, 1));
    var al = a < T0 ? ease(a / T0) : a > T3 ? 1 - ease((a - T3) / q.fadeOut) : 1;
    var px = R.cx + q.side * R.w * .86, py = R.y + R.h * (.5 + q.py), flip = q.side > 0, sc = SCYTHES[q.k];
    if(q.fit == null) q.fit = reapFit(R, px, py, q.side, reapReach(q.k, q.side, flip, A2 - q.side * .12, A1));
    var want = R.h * q.size / 125 * (sc.grow || 1), spr = scytheSprite(q.k, Math.min(want, q.fit), cols), s = spr.s, c = q.front ? co : cu;
    me.size = s; me.want = want;
    if(a > T1 - .05){ hist.push({t:t, p:sc.tips.map(function(tp){ return [scythePt(tp[0], tp[1], px, py, ang, s, flip), scythePt(tp[2], tp[3], px, py, ang, s, flip)]; })});
      while(hist.length && t - hist[0].t > .22) hist.shift(); }
    var n = hist.length, i, j;
    if(n > 1) for(j = 0; j < hist[0].p.length; j++){
      for(i = 1; i < n; i++){ var A = hist[i - 1].p[j], B = hist[i].p[j], f = Math.pow(i / (n - 1), 1.6);
        c.fillStyle = hexA(light(cols[0], .35), .5 * f * al); c.beginPath();
        c.moveTo(A[0][0], A[0][1]); c.lineTo(B[0][0], B[0][1]); c.lineTo(B[1][0], B[1][1]); c.lineTo(A[1][0], A[1][1]); c.closePath(); c.fill(); }
      c.lineCap = 'round';
      for(i = 1; i < n; i++){ var P0 = hist[i - 1].p[j][0], P1 = hist[i].p[j][0], g = i / (n - 1);
        c.strokeStyle = hexA('#ffffff', .85 * g * al); c.lineWidth = .6 + 1.6 * g; c.beginPath(); c.moveTo(P0[0], P0[1]); c.lineTo(P1[0], P1[1]); c.stroke(); } }
    if(al > 0){ c.save(); c.globalAlpha *= al; c.translate(px, py); c.rotate(ang); if(flip) c.scale(-1, 1); blit(c, spr.sp); c.restore(); }
  }); };
/* Not clipped at the foot, which drew a hard line: each is drawn into one reused scratch canvas and faded out above its foot. */
var RISE_FADE = 8;                    /* the fade's height, in the thing's own scale */
var _scr = null;
function fromGround(co, bx, foot, halfW, top, s, paint){
  var w = halfW * 2, h = foot - top;
  if(h <= 0) return;
  var pw = Math.ceil(w * DPR), ph = Math.ceil(h * DPR);
  if(!_scr) _scr = document.createElement('canvas');
  if(_scr.width < pw || _scr.height < ph){ _scr.width = Math.max(_scr.width, pw); _scr.height = Math.max(_scr.height, ph); }
  var x = _scr.getContext('2d'), f = Math.min(h, RISE_FADE * s);
  x.setTransform(1, 0, 0, 1, 0, 0); x.clearRect(0, 0, pw, ph);
  x.setTransform(DPR, 0, 0, DPR, -(bx - halfW) * DPR, -top * DPR);
  x.save(); paint(x); x.restore();
  x.globalCompositeOperation = 'destination-out';
  var g = x.createLinearGradient(0, foot - f, 0, foot); g.addColorStop(0, 'rgba(0,0,0,0)'); g.addColorStop(1, 'rgba(0,0,0,1)');
  x.fillStyle = g; x.fillRect(bx - halfW, foot - f, w, f);
  x.globalCompositeOperation = 'source-over';
  co.drawImage(_scr, 0, 0, pw, ph, bx - halfW, top, pw / DPR, ph / DPR);
}
/* a hand at one of 16 curls, baked (a finger tip moves well under a pixel from one to the next) */
function handSprite(cols, s, cq){
  var curl = .25 + .55 * cq / 15;
  return baked('hand|' + cols[0] + '|' + s.toFixed(4) + '|' + cq, -19.5 * s, -32.5 * s, 19.5 * s, 43.5 * s, 8, function(c){
    c.strokeStyle = light(cols[0], .78); c.shadowColor = cols[0]; c.shadowBlur = 8; c.lineCap = 'round';
    c.lineWidth = 3 * s; c.beginPath(); c.moveTo(-3 * s, 0); c.lineTo(-4 * s, 40 * s); c.moveTo(3 * s, 0); c.lineTo(4 * s, 40 * s); c.stroke();
    c.fillStyle = light(cols[0], .7); rrect(c, -7 * s, -12 * s, 14 * s, 12 * s, 3 * s); c.fill();
    c.lineWidth = 2.4 * s;
    [-5.5, -1.8, 1.8, 5.5].forEach(function(fx, i){ var a0 = -Math.PI / 2 + fx * .05, l1 = (i === 0 || i === 3 ? 8 : 10) * s, l2 = 7 * s;
      var x1 = fx * s + Math.cos(a0) * l1, y1 = -12 * s + Math.sin(a0) * l1, a1 = a0 + curl * 1.3;
      c.beginPath(); c.moveTo(fx * s, -12 * s); c.lineTo(x1, y1); c.lineTo(x1 + Math.cos(a1) * l2, y1 + Math.sin(a1) * l2); c.stroke(); });
    var ta = -2.5 + curl * .8; c.beginPath(); c.moveTo(-7 * s, -5 * s); c.lineTo(-7 * s + Math.cos(ta) * 8 * s, -5 * s + Math.sin(ta) * 8 * s); c.stroke(); });
}
function skullSprite(cols, m){
  var Sh = shapes();
  return baked('skull|' + cols[0] + '|' + m.toFixed(4), -12 * m, -20 * m, 12 * m, -1.5 * m, 10, function(c){ c.scale(m, m); c.translate(-12, -22);
    c.shadowColor = cols[0]; c.shadowBlur = 10; c.fillStyle = light(cols[0], .78); c.fill(Sh.skull); });
}
function drawFigure(c, f, x, foot, s, rise, t, cols){
  if(f.kind === 'hand'){
    var base = foot - rise * 34 * s, cq = Math.round(15 * (.5 + .5 * Math.sin(t * 2.4 + f.ph))), sp = handSprite(cols, s, cq);
    fromGround(c, x, foot, 28 * s, base - 40 * s, s, function(b){ b.translate(x, base); b.rotate(f.lean); blit(b, sp); });
  } else {
    var m = s * 1.15, sb = foot + 6 * s - rise * 30 * s, look = Math.sin(t * 1.3 + f.ph) * .12, sk = skullSprite(cols, m);
    fromGround(c, x, foot, 18 * s, sb - 27 * s, s, function(b){ b.translate(x, sb); b.rotate(f.lean + look); blit(b, sk);
      b.scale(m, m); b.translate(-12, -22);
      b.fillStyle = hexA(cols[0], .5 + .4 * Math.sin(t * 3 + f.ph)); b.beginPath(); b.arc(8.4, 11.3, 1.1, 0, TAU); b.arc(15.6, 11.3, 1.1, 0, TAU); b.fill(); });
  }
}
function figureRise(f, t){
  var k = ((t + f.ph) % f.per) / f.per;
  return f.kind === 'hand' ? (k < .25 ? ease(k / .25) : k < .75 ? 1 : 1 - ease((k - .75) / .25))
                           : (k < .3 ? ease(k / .3) : k < .72 ? 1 : 1 - ease((k - .72) / .28));
}
function figureSmoke(P, st, key, x, y, s, rise, dt, cols){
  emit(st, key, 11 * Math.min(1, rise * 3), dt, function(){
    P.add({k:Math.random() < .5 ? 'dot' : 'puff', x:x + rnd(-11, 11) * s, y:y + rnd(-2, 1) * s, vx:rnd(-16, 16), vy:-rnd(6, 20),
           r:1.2, r0:2, r1:13, a:.55, life:rnd(.6, 1.1), col:Math.random() < .5 ? '#2a1830' : light(cols[0], .25)}); });
}
E.necro = function(){ var nh = irnd(2, 3), nk = irnd(1, 2), n = nh + nk, off = rnd(0, TAU);
  var Pb = new Parts(), Pf = new Parts(), st = {}, me = null;
  var figs = shuffle(times(n, function(i){ return i < nh ? 'hand' : 'skull'; })).map(function(kind, i){
    return {kind:kind, a:off + (i + rnd(.2, .8)) / n * TAU, rr:rnd(.8, .98), per:kind === 'hand' ? rnd(5.5, 7.5) : rnd(6, 8), ph:rnd(0, 7),
            lean:kind === 'hand' ? rnd(-.25, .25) : rnd(-.2, .2), sz:kind === 'hand' ? rnd(.9, 1.15) : rnd(.9, 1.2)}; });
  return (me = function(cu, co0, R, t, dt, cols, S){
    var g = ground(R), gb = S.gb, ry = g.rx * g.k;
    var glow = gb.createRadialGradient(g.cx, g.cy, 0, g.cx, g.cy, g.rx); glow.addColorStop(0, hexA(dark(cols[0], .3), .55)); glow.addColorStop(1, hexA(cols[0], 0));
    gb.save(); gb.translate(g.cx, g.cy); gb.scale(1, g.k); gb.translate(-g.cx, -g.cy);
    gb.fillStyle = glow; gb.beginPath(); gb.arc(g.cx, g.cy, g.rx, 0, TAU); gb.fill(); gb.restore();
    gb.strokeStyle = hexA(cols[0], .35); gb.lineWidth = 1.2; gb.beginPath(); gb.ellipse(g.cx, g.cy, g.rx * .82, ry * .82, 0, 0, TAU); gb.stroke();
    var front = 0;
    figs.map(function(f, i){ return {f:f, i:i, v:Math.sin(f.a) * f.rr}; }).sort(function(x, y){ return x.v - y.v; }).forEach(function(it){
      var f = it.f, v = it.v, c = nearOf(S, v), P = v < 0 ? Pb : Pf, p = gp(g, Math.cos(f.a) * f.rr, v);
      var s = R.w / 95 * f.sz * (.7 + .24 * (v + 1)), rise = figureRise(f, t);
      if(v >= 0) front++;
      c.save(); c.globalAlpha = .78 + .22 * (v + 1) / 2;
      drawFigure(c, f, p[0], p[1], s, rise, t, cols); c.restore();
      if(rise > .02) figureSmoke(P, st, 'f' + it.i, p[0], p[1], s, rise, dt, cols); });
    Pb.step(dt); Pb.draw(gb); Pf.step(dt); Pf.draw(S.gf);
    me.smoke = Pb.a.length + Pf.a.length; me.front = front; me.depths = figs.map(function(f){ return Math.sin(f.a) * f.rr; }); }); };
var SEAL_R = 1.42 / 2 * .96;     /* the Seal (142% of the card's height across) - its outer ring, r 96 of 100 */
E.necroAround = function(){ var nh = irnd(3, 4), nk = irnd(1, 2), n = nh + nk, off = rnd(0, TAU), P = new Parts(), st = {}, me = null;
  var figs = shuffle(times(n, function(i){ return i < nh ? 'hand' : 'skull'; })).map(function(kind, i){
    return {kind:kind, a:off + (i + rnd(.2, .8)) / n * TAU, out:rnd(.05, .14), at:rnd(.2, 3.1), stay:rnd(.8, 1.6), ph:rnd(0, 7),
            lean:rnd(-.08, .08), sz:rnd(.85, 1.1)}; });
  return (me = function(cu, co, R, t, dt, cols){
    var shown = 0, ring = R.h * SEAL_R;
    me.feet = [];
    figs.forEach(function(f, i){
      var a = t - f.at, L = .5 + f.stay + .5;
      if(a < 0 || a > L) return;
      var rise = a < .5 ? ease(a / .5) : a < .5 + f.stay ? 1 : 1 - ease((a - .5 - f.stay) / .5);
      var rr = ring + R.h * f.out, x = R.cx + Math.cos(f.a) * rr, y = R.cy + Math.sin(f.a) * rr;
      var dx = Math.abs(Math.cos(f.a)), dy = Math.abs(Math.sin(f.a)), edge = Math.min(dx > 1e-6 ? R.w / 2 / dx : 1e9, dy > 1e-6 ? R.h / 2 / dy : 1e9);
      var s = R.w / 95 * f.sz * clamp((rr - edge + R.h * .06) / (70 * R.w / 95), .75, 1);
      var turn = f.a - Math.PI / 2 + f.lean;
      me.feet.push({kind:f.kind, x:x, y:y, r:rr / R.h, turn:turn, a:f.a});
      cu.save(); cu.translate(x, y); cu.rotate(turn); cu.globalAlpha = .9 * clamp(rise * 2.5, 0, 1);
      groundGlowAt(cu, 0, 0, 22 * s, cols[0], .45 * rise);
      drawFigure(cu, {kind:f.kind, ph:f.ph, lean:0}, 0, 0, s, rise, t, cols); cu.restore();
      shown++;
      if(rise > .02) figureSmoke(P, st, 'a' + i, x, y, s, rise, dt, cols); });
    P.step(dt); P.draw(cu); me.shown = Math.max(me.shown || 0, shown); me.smoke = P.a.length; }); };
function groundGlowAt(c, x, y, r, col, a){
  if(a <= 0) return;
  c.save(); c.translate(x, y); c.scale(1, .35); c.globalAlpha *= a;
  c.drawImage(tdFxPuffSprite(dark(col, .3)).cv, -r, -r, r * 2, r * 2); c.restore();
}
/* Every knife has its point at the origin and its hilt along -x, so each stabs as the dagger does; all are baked. */
var KNIFE_KEYS = ['dagger', 'kris', 'tanto', 'bowie'];
var KNIVES = null;
function knives(){
  if(KNIVES) return KNIVES;
  var kris = new Path2D(), n = 30, i, f;
  function kc(f){ return 2.4 * Math.sin(f * Math.PI * 4.5) * (1 - f * .55); }
  function kw(f){ return 6.6 * Math.pow(1 - f, .8) + .2; }
  for(i = 0; i <= n; i++){ f = i / n; if(i) kris.lineTo(-62 + 62 * f, kc(f) - kw(f)); else kris.moveTo(-62, kc(0) - kw(0)); }
  for(i = n; i >= 0; i--){ f = i / n; kris.lineTo(-62 + 62 * f, kc(f) + kw(f)); }
  kris.closePath();
  var krisHL = new Path2D(); for(i = 2; i <= n - 3; i++){ f = i / n; if(i > 2) krisHL.lineTo(-62 + 62 * f, kc(f) - kw(f) * .45); else krisHL.moveTo(-62 + 62 * f, kc(f) - kw(f) * .45); }
  var bowie = new Path2D(); bowie.moveTo(0, 0); bowie.quadraticCurveTo(-8, -3, -16, -8); bowie.lineTo(-20, -8.5);
  for(var x = -20; x > -44; x -= 3){ bowie.lineTo(x - 1.5, -10.6); bowie.lineTo(x - 3, -8.5); }
  bowie.lineTo(-62, -8.5); bowie.lineTo(-62, 8.5); bowie.quadraticCurveTo(-30, 9.6, -8, 5); bowie.quadraticCurveTo(-3, 3, 0, 0); bowie.closePath();
  KNIVES = {
    dagger:{box:[-98, -12, 2, 12]},
    kris:{box:[-98, -14, 2, 12], blade:kris, hl:krisHL,
      guard:new Path2D('M-61 -7.5L-65 -13Q-70.5 -5 -66.5 9.5L-61 8.5Z'),
      grip:new Path2D('M-66 -3.4Q-78 -5 -90 -6.2L-90 2Q-78 2.6 -66 3.4Z'), knob:[-92.5, -2, 4, 5]},
    tanto:{box:[-97, -12, 2, 12], blade:new Path2D('M0 -1L-11 -6.3L-62 -6.3L-62 5.8L-13 5.8Z'), hl:new Path2D('M-58 3.6Q-48 2.2 -38 3.6Q-28 2.2 -18 3.4'),
      yokote:new Path2D('M-11 -6.3L-13 5.8'), habaki:[-66, -7, 4, 14], tsuba:[-67.6, 0, 2, 10], grip:[-91, -3.8, 23.4, 7.6], kashira:[-93.4, -4, 2.4, 8]},
    bowie:{box:[-97, -14, 2, 14], blade:bowie, hl:new Path2D('M-58 6.4Q-30 7.6 -6 3.6'),
      guard:[-65.5, -12, 3.5, 24], grip:[-90, -4.6, 24.5, 9.2], rivets:[-84, -73], cap:[-93, -5, 3, 10]}
  };
  return KNIVES;
}
function knifeSprite(kind, col, s){
  var K = knives()[kind], b = K.box, S = shapes();
  return baked('knife|' + kind + '|' + col + '|' + s.toFixed(4), b[0] * s, b[1] * s, b[2] * s, b[3] * s, 10, function(c){ c.scale(s, s);
    c.shadowColor = hexA(col, .9); c.shadowBlur = 10;
    c.fillStyle = lin(c, -62, 0, 0, 0, [dark(col, .55), light(col, .35)]); c.fill(kind === 'dagger' ? S.blade : K.blade); c.shadowBlur = 0;
    if(kind === 'dagger'){
      c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = .9; c.beginPath(); c.moveTo(-60, -4.6); c.quadraticCurveTo(-22, -3.4, -2, -.4); c.stroke();
      c.fillStyle = dark(col, .35); c.fillRect(-66, -11, 4, 22); c.fillStyle = '#1a1420'; c.fillRect(-90, -3.6, 24, 7.2);
      c.strokeStyle = hexA(col, .8); c.lineWidth = 1; for(var k = -86; k < -68; k += 4){ c.beginPath(); c.moveTo(k, -3.6); c.lineTo(k + 3, 3.6); c.stroke(); }
      c.fillStyle = dark(col, .3); c.beginPath(); c.arc(-93, 0, 4.6, 0, TAU); c.fill(); return; }
    c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = .9; c.stroke(K.hl);
    if(kind === 'kris'){
      c.fillStyle = dark(col, .35); c.fill(K.guard); c.fillStyle = '#1a1420'; c.fill(K.grip);
      c.strokeStyle = hexA(col, .7); c.lineWidth = .8; [-70, -75, -80, -85].forEach(function(x){ c.beginPath(); c.moveTo(x, -4.2 - (x + 66) * .02); c.lineTo(x, 2.6); c.stroke(); });
      c.fillStyle = dark(col, .3); c.beginPath(); c.ellipse(K.knob[0], K.knob[1], K.knob[2], K.knob[3], -.3, 0, TAU); c.fill();
    } else if(kind === 'tanto'){
      c.strokeStyle = 'rgba(255,255,255,.55)'; c.lineWidth = .8; c.stroke(K.yokote);
      c.fillStyle = light(col, .3); c.fillRect.apply(c, K.habaki);
      c.fillStyle = dark(col, .45); c.beginPath(); c.ellipse(K.tsuba[0], K.tsuba[1], K.tsuba[2], K.tsuba[3], 0, 0, TAU); c.fill();
      c.fillStyle = '#1a1420'; c.fillRect.apply(c, K.grip);
      c.strokeStyle = hexA(col, .75); c.lineWidth = .8;
      for(var x = -88; x < -70; x += 4.5){ c.beginPath(); c.moveTo(x, -3.8); c.lineTo(x + 2.25, 0); c.lineTo(x, 3.8); c.moveTo(x + 4.5, -3.8); c.lineTo(x + 2.25, 0); c.lineTo(x + 4.5, 3.8); c.stroke(); }
      c.fillStyle = dark(col, .3); c.fillRect.apply(c, K.kashira);
    } else {
      c.fillStyle = dark(col, .3); c.fillRect.apply(c, K.guard);
      c.beginPath(); c.arc(-63.75, -12, 2.2, 0, TAU); c.arc(-63.75, 12, 2.2, 0, TAU); c.fill();
      c.fillStyle = mixHex(dark(col, .6), '#3a2418', .5); c.fillRect.apply(c, K.grip);
      c.fillStyle = light(col, .55); K.rivets.forEach(function(x){ c.beginPath(); c.arc(x, 0, 1.3, 0, TAU); c.fill(); });
      c.fillStyle = dark(col, .3); c.fillRect.apply(c, K.cap);
    } });
}
E.blades = function(){ var P = new Parts(), st = {}, used = [], me = null;
  var blades = times(irnd(1, 3), function(){ var side, hgt, tries = 0;
    do { side = sgn(); hgt = rnd(.25, .75); tries++; } while(tries < 20 && used.some(function(u){ return u.side === side && Math.abs(u.hgt - hgt) < .18; }));
    var b = {side:side, hgt:hgt, tilt:.4 + rnd(-.25, .25), ph:rnd(0, 5), kind:pick(KNIFE_KEYS)}; used.push(b); return b; });
  return (me = function(cu, co, R, t, dt, cols){
    blades.forEach(function(b, bi){
      var cyc = (t + b.ph) % 5, out = -30, inn = R.w * .26, dep;
      if(cyc < 1.1) dep = out + Math.sin(cyc * 3) * 2;
      else if(cyc < 3.1) dep = out + (inn - out) * ease((cyc - 1.1) / 2);
      else if(cyc < 3.9) dep = inn + Math.sin(cyc * 40) * .6;
      else if(cyc < 4.8) dep = inn + (out - inn) * ease((cyc - 3.9) / .9);
      else dep = out;
      var side = b.side, ex = side > 0 ? R.x + R.w : R.x, ey = R.y + R.h * b.hgt, th = side > 0 ? Math.PI - b.tilt : b.tilt, dx = Math.cos(th), dy = Math.sin(th), s = R.w * .0095;
      co.save(); co.beginPath(); co.rect(0, 0, co.canvas.width, co.canvas.height); if(co.roundRect) co.roundRect(R.x, R.y, R.w, R.h, 6); else co.rect(R.x, R.y, R.w, R.h); co.clip('evenodd');
      co.translate(ex + dx * dep, ey + dy * dep); co.rotate(th); if(side < 0) co.scale(1, -1);
      blit(co, knifeSprite(b.kind, cols[0], s)); co.restore();
      if(dep > 0){ var kk = clamp(dep / inn, 0, 1); co.strokeStyle = hexA(light(cols[0], .5), .9 * kk); co.lineWidth = 2; co.shadowColor = cols[0]; co.shadowBlur = 8;
        co.beginPath(); co.moveTo(ex + dy * 7, ey - dx * 7); co.lineTo(ex - dy * 7, ey + dx * 7); co.stroke(); co.shadowBlur = 0;
        if(cyc > 1.6 && cyc < 3.2) emit(st, 'p' + bi, 12, dt, function(){ P.add({k:Math.random() < .5 ? 'dot' : 'puff', x:ex + side * rnd(-2, 4), y:ey + rnd(-6, 6), vx:side * rnd(10, 40), vy:rnd(-20, 10), r:1.2, r0:2, r1:9, a:.35, life:rnd(.4, .8), col:Math.random() < .5 ? '#2a1830' : cols[0]}); }); }
    });
    P.step(dt); P.draw(co); me.kinds = blades.map(function(b){ return b.kind; }); }); };

var STARS = {};
function starSprite(col){
  if(STARS[col]) return STARS[col];
  var cv = document.createElement('canvas'), Z = 22, c; cv.width = cv.height = Z * 2; c = cv.getContext('2d');
  c.translate(Z, Z); c.shadowColor = col; c.shadowBlur = 10; c.fillStyle = col; c.beginPath();
  for(var i = 0; i < 8; i++){ var a = i * Math.PI / 4, rr = i % 2 ? 5 * .22 : 5; c.lineTo(Math.cos(a) * rr, Math.sin(a) * rr); } c.closePath(); c.fill();
  return (STARS[col] = cv);
}
/* tdFxDiamonds, copied rather than called, and slowed. */
E['kw-absolute'] = function(){ var cyc = -1, ds = [];
  return function(cu, co, R, t){
    var L = 1.4 * SLOW + GAP, id = Math.floor(t / L), k0 = t % L, base = 260 * R.w / 132;
    if(id !== cyc){ cyc = id; ds = [base, base * .9, base * rnd(.75, 1.15), base * rnd(.75, 1.15), base * rnd(.75, 1.15)].map(function(S, i){
      return {S:S, at:(i === 0 ? 0 : i * .095 + rnd(0, .07)) * SLOW, life:rnd(.7, .95) * SLOW, col:i % 2 ? '#fff2b8' : '#ffd24a', lw:i < 2 ? 3 : rnd(1.6, 2.6), front:Math.random() < .5}; }); }
    ds.forEach(function(d){ var k = (k0 - d.at) / d.life; if(k < 0 || k > 1) return;
      var s = base * .15 + (d.S - base * .15) * easeOut(k), c = d.front ? co : cu;
      c.save(); c.translate(R.cx, R.cy); c.rotate(Math.PI / 4);
      c.strokeStyle = '#ffd24a'; c.globalAlpha = (1 - k) * .3; c.lineWidth = d.lw + 8; c.strokeRect(-s / 2, -s / 2, s, s);
      c.strokeStyle = d.col; c.globalAlpha = 1 - k; c.lineWidth = d.lw; c.strokeRect(-s / 2, -s / 2, s, s); c.restore(); }); }; };
E['kw-unique'] = function(){ var cyc = -1, q = null;
  return function(cu, co, R, t){
    var run = 3.6 * SLOW, L = run + GAP, id = Math.floor(t / L), k0 = t % L;
    if(id !== cyc){ cyc = id; q = tdFxCometRoll(); }
    if(k0 > run) return;
    tdFxCometPaint(cu, R, k0 / run, q, 'back'); tdFxCometPaint(co, R, k0 / run, q, 'front'); }; };
/* tdFxMythicOn, copied rather than called, and slowed; a redraw replaces the card element, so a glow is restarted on the new one at the same moment. */
E['kw-mythic'] = function(){ var stars = [], cyc = -1, spawned = 0, anim = null, animEl = null, twins = null;
  return function(cu, co, R, t, dt, cols, S){
    var L = 2.3 * SLOW + GAP, id = Math.floor(t / L), k0 = t % L, GLOW = 2.2 * SLOW;
    if(id !== cyc){ cyc = id; spawned = 0; animEl = null; twins = tdFxTwinRoll(); }
    if(k0 / SLOW < tdFxTwinLen(twins)) tdFxTwinPaint(co, R, k0 / SLOW, twins);
    if(k0 < GLOW && S.el && S.el !== animEl && S.el.animate){
      if(anim) anim.cancel(); animEl = S.el;
      anim = S.el.animate([{boxShadow:'0 0 0 2px #fff,0 0 30px 9px #ffd86b'}, {boxShadow:'0 0 0 2px hsl(300 90% 70%),0 0 26px 8px hsl(200 90% 60%)', offset:.4}, {boxShadow:'none'}],
        {duration:GLOW * 1000, easing:'ease-out'});
      anim.currentTime = k0 * 1000; }
    while(spawned < 38 && k0 >= spawned * .04 * SLOW){ var i = spawned++, a = rnd(0, 7), r = rnd(R.w * .5, R.h * .8);
      stars.push({dx:Math.cos(a) * r, dy:Math.sin(a) * r, age:0, life:.8 * SLOW, col:'hsl(' + ((Math.round(i * 37 / 15) * 15) % 360) + ',100%,80%)'}); }
    for(var j = stars.length - 1; j >= 0; j--){ var p = stars[j]; p.age += dt; if(p.age >= p.life){ stars.splice(j, 1); continue; }
      var k = p.age / p.life; co.save(); co.globalAlpha = Math.sin(Math.PI * k); co.translate(R.cx + p.dx, R.cy + p.dy); co.rotate(2.25 * k); co.drawImage(starSprite(p.col), -22, -22); co.restore(); } }; };

/* Timed to the circle in boardfx.css, which starts CIRCLE_AT after the play (HANDOFF §71.2). */
var CIRCLE_AT = .38;
E['circle-seal'] = function(){ var grad = null, gx = -1, gy = -1;
  return function(cu, co, R, t, dt, cols, S){ var c = S.gb;
    c.globalCompositeOperation = 'lighter';
    [.6, 2.2].forEach(function(at){ var k = (t - CIRCLE_AT - at) / .9; if(k < 0 || k >= 1) return;
      var r = R.h * (.4 + .75 * easeOut(k)), lw = 3 * (1 - k) + .5;
      if(cols.length > 1 && c.createConicGradient){
        if(!grad || gx !== R.cx || gy !== R.cy){ gx = R.cx; gy = R.cy; grad = c.createConicGradient(-Math.PI / 2, gx, gy);
          var cs = cols.concat([cols[0]]); cs.forEach(function(col, i){ grad.addColorStop(i / (cs.length - 1), col); }); }
        c.strokeStyle = grad;
      } else c.strokeStyle = cols[0];
      c.beginPath(); c.arc(R.cx, R.cy, r, 0, TAU);
      c.globalAlpha = (1 - k) * .28; c.lineWidth = lw + 7; c.stroke();
      c.globalAlpha = 1 - k; c.lineWidth = lw; c.stroke(); }); }; };
E['circle-runes'] = function(){ var P = [], made = 0;
  return function(cu, co, R, t, dt, cols, S){ var c = S.gb, D = R.h * 1.3;
    while(made < 26 && t >= CIRCLE_AT + .4 + made * .15){ made++; var an = rnd(0, 7);
      P.push({dx:Math.cos(an) * D * .47, dy:Math.sin(an) * D * .47, vy:-rnd(15, 40), age:0, life:rnd(.8, 1.3), col:pick(cols)}); }
    c.globalCompositeOperation = 'lighter';
    for(var i = P.length - 1; i >= 0; i--){ var p = P[i]; p.age += dt;
      if(p.age >= p.life){ P.splice(i, 1); continue; }
      p.vy *= Math.pow(.99, dt * 60); p.dy += p.vy * dt;
      var k = p.age / p.life; c.globalAlpha = 1 - k;
      tdFxBlit(c, tdFxSprite('dot', p.col, p.col, 1.6 * (1 - k * .5), 8), R.cx + p.dx, R.cy + p.dy); } }; };

/* Tuned on an 84px card, so absolute sizes go by U, the card's width / 84. */
function gp(g, u, v){ return [g.cx + u * g.rx, g.cy + v * g.rx * g.k]; }
function nearOf(S, v){ return v < 0 ? S.gb : S.gf; }
function depthScale(v){ return .82 + .126 * (v + 1); }
function groundGlow(c, g, col, a, r){
  var rr = g.rx * (r || 1);
  c.save(); c.translate(g.cx, g.cy); c.scale(1, g.k); c.globalAlpha = clamp(a, 0, 1);
  c.drawImage(tdFxPuffSprite(col).cv, -rr, -rr, rr * 2, rr * 2); c.restore();
}
function keepGrad(box, c, key, make){
  if(box.c !== c || box.key !== key){ box.c = c; box.key = key; box.g = make(); }
  return box.g;
}
function chainAlong(c, pts, cols, sc, a){
  var acc = 0, next = 0, step = 6.5 * sc;
  for(var i = 1; i < pts.length; i++){
    var x0 = pts[i - 1][0], y0 = pts[i - 1][1], x1 = pts[i][0], y1 = pts[i][1], d = Math.hypot(x1 - x0, y1 - y0), ang = Math.atan2(y1 - y0, x1 - x0);
    while(next <= acc + d){
      var f = (next - acc) / (d || 1), n = Math.round(next / step);
      c.save(); c.translate(x0 + (x1 - x0) * f, y0 + (y1 - y0) * f); c.rotate(ang); c.globalAlpha = a;
      c.strokeStyle = n % 2 ? light(cols[0], .25) : mixHex('#9aa3b5', cols[0], .35); c.lineWidth = 1.7 * sc;
      c.beginPath(); c.ellipse(0, 0, 4.2 * sc, (n % 2 ? 1.6 : 2.8) * sc, 0, 0, TAU); c.stroke(); c.restore();
      next += step;
    }
    acc += d;
  }
}
var EMBER = ['#ffcf6b', '#ff7a1a', '#ff3b1a'];
E.lava = function(){
  var plates = times(irnd(5, 9), function(){ var a = rnd(0, TAU), r = Math.sqrt(Math.random()) * .6;
    return {u:Math.cos(a) * r, v:Math.sin(a) * r, r:rnd(.1, .19), rot:rnd(0, TAU), sp:rnd(-.25, .25), du:rnd(-.025, .025), dv:rnd(-.025, .025),
            sh:times(irnd(5, 7), function(){ return rnd(.72, 1.15); })}; });
  var bubbles = [], drops = [], embers = [], st = {}, rate = rnd(1.4, 2.8), kept = {};
  var draw = function(cu, co, R, t, dt, cols, S){
    var g0 = ground(R), g = {cx:g0.cx, cy:g0.cy, rx:g0.rx * LAVA_R, k:g0.k}, c = S.gb, U = R.w / 84, i;
    var pool = keepGrad(kept, c, g.rx, function(){ var gr = c.createRadialGradient(0, 0, 0, 0, 0, g.rx);
      gr.addColorStop(0, '#ffb347'); gr.addColorStop(.55, '#ff5a10'); gr.addColorStop(.86, '#7a1a06'); gr.addColorStop(1, 'rgba(40,10,4,0)'); return gr; });
    c.save(); c.translate(g.cx, g.cy); c.scale(1, g.k); c.fillStyle = pool; c.globalAlpha = .9 + .1 * Math.sin(t * 1.3); c.beginPath(); c.arc(0, 0, g.rx, 0, TAU); c.fill(); c.restore();
    plates.forEach(function(p){
      p.u += p.du * dt; p.v += p.dv * dt; if(p.u * p.u + p.v * p.v > .5){ p.du *= -1; p.dv *= -1; } p.rot += p.sp * dt;
      var ctr = gp(g, p.u, p.v);
      c.beginPath();
      p.sh.forEach(function(m, j){ var a = p.rot + j / p.sh.length * TAU, x = ctr[0] + Math.cos(a) * p.r * m * g.rx, y = ctr[1] + Math.sin(a) * p.r * m * g.rx * g.k;
        if(j) c.lineTo(x, y); else c.moveTo(x, y); });
      c.closePath(); c.fillStyle = '#2a0d06'; c.fill(); c.strokeStyle = 'rgba(255,122,42,.7)'; c.lineWidth = 1.2; c.stroke(); });
    emit(st, 'b', rate, dt, function(){ var a = rnd(0, TAU), r = Math.sqrt(Math.random()) * .75;
      bubbles.push({u:Math.cos(a) * r, v:Math.sin(a) * r, age:0, grow:rnd(.5, 1), max:rnd(3, 6.5) * U}); });
    for(i = bubbles.length - 1; i >= 0; i--){ var b = bubbles[i], p = gp(g, b.u, b.v); b.age += dt;
      if(b.age < b.grow){ var r = b.max * easeOut(b.age / b.grow);
        c.fillStyle = 'rgba(255,214,140,.85)'; c.beginPath(); c.ellipse(p[0], p[1] - r * .4, r, r * .7, 0, 0, TAU); c.fill();
        c.strokeStyle = 'rgba(120,30,8,.8)'; c.lineWidth = .8; c.stroke(); }
      else if(b.age < b.grow + .35){ var k = (b.age - b.grow) / .35;
        c.strokeStyle = hexA('#ffe1a0', 1 - k); c.lineWidth = 1.3; c.beginPath(); c.ellipse(p[0], p[1], b.max * (1 + k * 1.6), b.max * (1 + k * 1.6) * .45, 0, 0, TAU); c.stroke();
        if(!b.popped){ b.popped = true;
          for(var j = 0, n = irnd(3, 6); j < n; j++) drops.push({x:p[0], y:p[1], v:b.v, vx:rnd(-40, 40) * U, vy:-rnd(50, 95) * U, age:0, life:rnd(.4, .7)}); } }
      else bubbles.splice(i, 1); }
    for(i = drops.length - 1; i >= 0; i--){ var q = drops[i]; q.age += dt; if(q.age >= q.life){ drops.splice(i, 1); continue; }
      q.vy += 320 * U * dt; q.x += q.vx * dt; q.y += q.vy * dt;
      var dc = nearOf(S, q.v); dc.fillStyle = hexA('#ffb030', 1 - q.age / q.life); dc.beginPath(); dc.arc(q.x, q.y, 1.3 * U, 0, TAU); dc.fill(); }
    emit(st, 'e', 6, dt, function(){ var a = rnd(0, TAU), r = Math.sqrt(Math.random()) * .8, v = Math.sin(a) * r, p = gp(g, Math.cos(a) * r, v);
      embers.push({x:p[0], y:p[1], vx:rnd(-6, 6) * U, vy:-rnd(28, 60) * U, r:rnd(.7, 1.3) * U, age:0, life:rnd(1, 1.9), col:pick(EMBER), v:v}); });
    for(i = embers.length - 1; i >= 0; i--){ var e = embers[i]; e.age += dt; if(e.age >= e.life){ embers.splice(i, 1); continue; }
      e.x += e.vx * dt; e.y += e.vy * dt;
      var ec = nearOf(S, e.v); ec.fillStyle = hexA(e.col, Math.sin(Math.PI * e.age / e.life)); ec.beginPath(); ec.arc(e.x, e.y, e.r, 0, TAU); ec.fill(); }
  };
  draw.plates = plates.length; draw.radius = LAVA_R;
  return draw;
};
var LAVA_R = .67;
var PLATE_OUT = .75, PLATE_HUB = 1.15, PLATE_MOVE = .75;
E.plates = function(){
  var n = irnd(6, 9), inner = rnd(.18, .32) * PLATE_HUB / PLATE_OUT, dust = [], kept = {};
  var cuts = times(n, function(i){ return (i + rnd(.15, .85)) / n * TAU; }).sort(function(a, b){ return a - b; });
  var plates = cuts.map(function(a, i){ return {a0:a, a1:i < n - 1 ? cuts[i + 1] : cuts[0] + TAU, lift:0, t0:rnd(.2, 4), dur:rnd(1.3, 2.2),
    h:rnd(4, 8) * PLATE_MOVE, tip:rnd(-.08, .08) * PLATE_MOVE, puffed:false}; });
  var draw = function(cu, co, R, t, dt, cols, S){
    var g0 = ground(R), g = {cx:g0.cx, cy:g0.cy, rx:g0.rx * PLATE_OUT, k:g0.k}, c = S.gb, U = R.w / 84, i;
    c.save(); c.translate(g.cx, g.cy); c.scale(1, g.k); c.fillStyle = 'rgba(28,20,12,.85)'; c.beginPath(); c.arc(0, 0, g.rx, 0, TAU); c.fill(); c.restore();
    groundGlow(c, g, '#ffb347', .14, .5);
    plates.forEach(function(p){ var a = t - p.t0;
      if(a > p.dur){ p.t0 = t + rnd(.6, 3.2); p.dur = rnd(1.3, 2.2); p.h = rnd(4, 8) * PLATE_MOVE; p.tip = rnd(-.08, .08) * PLATE_MOVE; p.puffed = false; a = -1; }
      p.lift = a < 0 ? 0 : Math.sin(Math.PI * clamp(a / p.dur, 0, 1));
      if(a > p.dur * .85 && !p.puffed){ p.puffed = true; var m = (p.a0 + p.a1) / 2, q = gp(g, Math.cos(m) * .6, Math.sin(m) * .6);
        for(var j = 0; j < 10; j++) dust.push({x:q[0] + rnd(-12, 12) * U, y:q[1], vx:rnd(-25, 25) * U, vy:-rnd(4, 14) * U, r:rnd(.8, 1.5) * U, age:0, life:rnd(.6, 1.1), v:Math.sin(m)}); } });
    var fill = keepGrad(kept, c, g.cy + '|' + U, function(){ return lin(c, 0, g.cy - 14 * U, 0, g.cy + 20 * U, ['#5a4128', '#2e2014']); });
    plates.slice().sort(function(x, y){ return Math.sin((x.a0 + x.a1) / 2) - Math.sin((y.a0 + y.a1) / 2); }).forEach(function(p){
      var pts = [], m = 10, j, lift = p.lift * p.h * U;
      for(j = 0; j <= m; j++){ var a = p.a0 + (p.a1 - p.a0) * j / m; pts.push([Math.cos(a), Math.sin(a)]); }
      for(j = m; j >= 0; j--){ var b = p.a0 + (p.a1 - p.a0) * j / m; pts.push([Math.cos(b) * inner, Math.sin(b) * inner]); }
      if(p.lift > .02){ var mid = (p.a0 + p.a1) / 2, gl = gp(g, Math.cos(mid) * .6, Math.sin(mid) * .6), gr = g.rx * .7;
        c.save(); c.globalCompositeOperation = 'lighter'; c.globalAlpha = .5 * p.lift;
        c.drawImage(tdFxPuffSprite('#ffd696').cv, gl[0] - gr, gl[1] - gr, gr * 2, gr * 2); c.restore(); }
      c.beginPath();
      pts.forEach(function(q, k){ var s = gp(g, q[0] * .97, q[1] * .97), x = s[0], y = s[1] - lift - q[0] * p.tip * lift * 4; if(k) c.lineTo(x, y); else c.moveTo(x, y); });
      c.closePath(); c.fillStyle = fill; c.fill();
      c.strokeStyle = p.lift > .02 ? 'rgba(255,236,190,' + (.35 + .6 * p.lift).toFixed(3) + ')' : 'rgba(255,170,80,.28)'; c.lineWidth = 1 + 1.5 * p.lift; c.stroke(); });
    c.save(); c.translate(g.cx, g.cy); c.scale(1, g.k); c.fillStyle = 'rgba(255,190,110,.5)'; c.beginPath(); c.arc(0, 0, g.rx * inner * .9, 0, TAU); c.fill(); c.restore();
    for(i = dust.length - 1; i >= 0; i--){ var d = dust[i]; d.age += dt; if(d.age >= d.life){ dust.splice(i, 1); continue; }
      d.x += d.vx * dt; d.y += d.vy * dt; var k = d.age / d.life, dc = nearOf(S, d.v);
      dc.fillStyle = hexA('#c9a27a', .6 * (1 - k)); dc.beginPath(); dc.arc(d.x, d.y, d.r * (1 + k), 0, TAU); dc.fill(); }
  };
  draw.plates = n; draw.outer = PLATE_OUT; draw.hub = inner * PLATE_OUT; draw.lifts = function(){ return plates.map(function(p){ return p.h; }); };
  return draw;
};
E.radiant = function(){
  var rings = [], motes = [], st = {}, next = rnd(.2, .8), rate = rnd(4, 8), most = 0;
  var draw = function(cu, co, R, t, dt, cols, S){
    var g = ground(R), c = S.gb, U = R.w / 84, i;
    groundGlow(c, g, '#ffe14a', .2 + .06 * Math.sin(t * 1.6), .95);
    if(t >= next){ next = t + rnd(1.2, 2.5); var max = rnd(.85, 1.1);
      rings.push({at:t, max:max}, {at:t + rnd(.22, .4), max:max * rnd(.86, 1)}); }
    var live = 0;
    for(i = rings.length - 1; i >= 0; i--){ var r = rings[i], k = (t - r.at) / 1.3;
      if(k > 1){ rings.splice(i, 1); continue; } if(k < 0) continue;
      live++;
      var rr = g.rx * r.max * (.2 + .8 * easeOut(k));
      c.beginPath(); c.ellipse(g.cx, g.cy, rr, rr * g.k, 0, 0, TAU);
      c.strokeStyle = 'rgba(255,214,90,' + (.25 * (1 - k)).toFixed(3) + ')'; c.lineWidth = (8 * (1 - k) + 2) * U; c.stroke();
      c.strokeStyle = 'rgba(255,240,170,' + (.9 * (1 - k)).toFixed(3) + ')'; c.lineWidth = (2.4 * (1 - k) + .6) * U; c.stroke(); }
    most = Math.max(most, live); draw.most = most;
    emit(st, 'm', rate, dt, function(){ var a = rnd(0, TAU), r = Math.sqrt(Math.random()) * .9, v = Math.sin(a) * r, p = gp(g, Math.cos(a) * r, v);
      motes.push({x:p[0], y:p[1], vx:rnd(-5, 5) * U, vy:-rnd(18, 42) * U, r:rnd(.8, 1.6) * U, age:0, life:rnd(1.4, 2.6), col:pick(['#fff6cc', '#ffe14a', '#ffffff']), v:v, tw:rnd(4, 9)}); });
    for(i = motes.length - 1; i >= 0; i--){ var m = motes[i]; m.age += dt; if(m.age >= m.life){ motes.splice(i, 1); continue; }
      m.x += m.vx * dt; m.y += m.vy * dt;
      var a = Math.sin(Math.PI * m.age / m.life) * (.6 + .4 * Math.sin(m.age * m.tw)), mc = nearOf(S, m.v);
      mc.fillStyle = hexA(m.col, a * .3); mc.beginPath(); mc.arc(m.x, m.y, m.r * 3, 0, TAU); mc.fill();
      mc.fillStyle = hexA(m.col, a); mc.beginPath(); mc.arc(m.x, m.y, m.r, 0, TAU); mc.fill(); }
  };
  draw.most = 0;
  return draw;
};
function drawPrint(c, kind, s, col, a){
  c.globalAlpha = a; c.fillStyle = col;
  if(kind === 'paw'){ c.beginPath(); c.ellipse(0, 0, s * .55, s * .62, 0, 0, TAU); c.fill();
    [[.85, -.62], [1.05, -.2], [1.05, .2], [.85, .62]].forEach(function(q){ c.beginPath(); c.ellipse(q[0] * s, q[1] * s, s * .22, s * .26, 0, 0, TAU); c.fill(); }); }
  else if(kind === 'hoof'){ [-1, 1].forEach(function(sd){ c.beginPath(); c.ellipse(s * .15, sd * s * .3, s * .7, s * .26, sd * .12, 0, TAU); c.fill(); }); }
  else { c.lineCap = 'round'; c.strokeStyle = col; c.lineWidth = s * .2;
    [[1.1, -.55], [1.25, 0], [1.1, .55], [-.6, 0]].forEach(function(q){ c.beginPath(); c.moveTo(0, 0); c.lineTo(q[0] * s, q[1] * s); c.stroke(); }); }
  c.globalAlpha = 1;
}
var TRACKS = ['paw', 'hoof', 'bird'];
E.tracks = function(){
  var walkers = times(Math.random() < .55 ? 1 : 2, function(){ return {kind:pick(TRACKS), dir:sgn(), a:rnd(0, TAU), stride:rnd(.17, .26), every:rnd(.32, .55),
    rr:rnd(1.1, 1.24), gait:rnd(.045, .07), fade:rnd(2.2, 3.8), foot:1, next:0, size:rnd(.1, .135), prints:[]}; });
  var draw = function(cu, co, R, t, dt, cols, S){
    var g = ground(R), c = S.gb, n = 0;
    groundGlow(c, g, cols[0], .1, .95);
    walkers.forEach(function(w){
      if(t >= w.next){ w.next = t + w.every; w.a += w.dir * w.stride; w.foot = -w.foot;
        var off = w.foot * w.gait; w.prints.push({u:Math.cos(w.a) * (w.rr + off), v:Math.sin(w.a) * (w.rr + off), head:w.a + w.dir * Math.PI / 2, born:t}); }
      for(var i = w.prints.length - 1; i >= 0; i--){ var p = w.prints[i], age = t - p.born;
        if(age > w.fade){ w.prints.splice(i, 1); continue; }
        var a = Math.min(1, age / .15) * (1 - age / w.fade), s = q4(R.w * w.size * depthScale(p.v)), q = gp(g, p.u, p.v);
        var sp = baked('print|' + w.kind + '|' + cols[0] + '|' + s, -1.9 * s, -1.9 * s, 1.9 * s, 1.9 * s, 0, function(b){
          drawPrint(b, w.kind, s * 1.45, hexA(cols[0], .3), 1);
          drawPrint(b, w.kind, s, hexA(light(cols[0], .35), .92), 1); });
        c.save(); c.translate(q[0], q[1]); c.scale(1, g.k * 1.6); c.rotate(p.head); c.globalAlpha = a; blit(c, sp);
        c.restore(); n++; }
    });
    draw.prints = n;
  };
  draw.kinds = walkers.map(function(w){ return w.kind; }); draw.prints = 0;
  draw.paths = walkers.map(function(w){ return w.rr - w.gait; });
  return draw;
};
E.rift = function(){
  var size = rnd(.5, .7), dir = sgn(), kept = {};
  var motes = times(irnd(14, 24), function(){ return {a:rnd(0, TAU), r:rnd(.3, 1), sp:rnd(.4, .9)}; });
  var chains = times(irnd(2, 4), function(i){ var a = (i + rnd(.15, .85)) / 3.4 * TAU + rnd(0, 1);
    return {a:a, rr:rnd(.55, .9), h:rnd(.55, .95), side:Math.cos(a) < 0 ? -1 : 1, sw:rnd(.7, 1.3), ph:rnd(0, 7), sag:rnd(.12, .3)}; });
  var draw = function(cu, co, R, t, dt, cols, S){
    var g = ground(R), c = S.gb, U = R.w / 84, pulse = .5 + .5 * Math.sin(t * 2.2), rx = g.rx * size;
    groundGlow(c, g, cols[0], .16 + .08 * pulse, Math.min(1, size * 1.6));
    var hole = keepGrad(kept, c, rx + '|' + cols[0], function(){ var gr = c.createRadialGradient(0, 0, 0, 0, 0, rx);
      gr.addColorStop(0, '#000'); gr.addColorStop(.72, '#05030f'); gr.addColorStop(.92, hexA(dark(cols[0], .3), .9)); gr.addColorStop(1, hexA(cols[0], 0)); return gr; });
    c.save(); c.translate(g.cx, g.cy); c.scale(1, g.k); c.fillStyle = hole; c.beginPath(); c.arc(0, 0, rx, 0, TAU); c.fill();
    c.strokeStyle = hexA(light(cols[0], .35), .55 + .35 * pulse); c.lineWidth = 2 * U; c.beginPath(); c.arc(0, 0, rx * .9, 0, TAU); c.stroke(); c.restore();
    motes.forEach(function(m){ m.r -= dt * .18 * m.sp; m.a += dir * dt * m.sp * (1.6 / Math.max(.2, m.r)); if(m.r < .05){ m.r = 1; m.a = rnd(0, TAU); }
      var R1 = size * 1.5 * m.r, v = Math.sin(m.a) * R1, p = gp(g, Math.cos(m.a) * R1, v), a = Math.min(1, (1 - m.r) * 3) * Math.min(1, m.r * 4), mc = nearOf(S, v);
      mc.fillStyle = hexA(light(cols[0], .5), .8 * a); mc.beginPath(); mc.arc(p[0], p[1], 1.3 * U, 0, TAU); mc.fill(); });
    chains.map(function(ch){ return {ch:ch, v:Math.sin(ch.a) * ch.rr}; }).sort(function(x, y){ return x.v - y.v; }).forEach(function(it){
      var ch = it.ch, v = it.v, cc = nearOf(S, v), sc = depthScale(v) * U, base = gp(g, Math.cos(ch.a) * ch.rr, v);
      var top = [g.cx + ch.side * R.w * (.62 + .12 * Math.sin(t * ch.sw * .7 + ch.ph)), base[1] - R.h * ch.h * depthScale(v) + Math.sin(t * ch.sw + ch.ph) * 5 * U];
      var mid = [(base[0] + top[0]) / 2 + ch.side * R.w * ch.sag * Math.sin(t * ch.sw * .8 + ch.ph), (base[1] + top[1]) / 2 + R.h * ch.sag * .4];
      var pts = times(24, function(i){ var f = i / 23;
        return [(1 - f) * (1 - f) * base[0] + 2 * (1 - f) * f * mid[0] + f * f * top[0], (1 - f) * (1 - f) * base[1] + 2 * (1 - f) * f * mid[1] + f * f * top[1]]; });
      cc.save(); cc.translate(base[0], base[1]); cc.scale(1, .35); cc.strokeStyle = hexA(light(cols[0], .2), .8); cc.lineWidth = 2.2 * U; cc.beginPath(); cc.arc(0, 0, 6 * sc, 0, TAU); cc.stroke(); cc.restore();
      chainAlong(cc, pts, cols, sc, .55 + .45 * depthScale(v));
      cc.fillStyle = hexA(light(cols[0], .4), .5); cc.beginPath(); cc.arc(top[0], top[1], 2.4 * sc, 0, TAU); cc.fill(); });
  };
  draw.chains = chains.length; draw.tentacles = 0;
  return draw;
};

var SLOTS = {
  'red-spell':combo(['lightning', 'anvil', 'orbs', 'lava']),       'red-action':E.swords,
  'orange-spell':combo(['prisms', 'runes', 'plates']),             'orange-action':E.cogs,
  'yellow-spell':combo(['plus', 'constellation', 'radiant']),      'yellow-action':E.shield,
  'green-spell':combo(['whirl', 'falling', 'tracks']),             'green-action':E.bow,
  'blue-spell':combo(['ripple', 'whirlpool', 'fireflies']), 'blue-action':E.potions,
  'indigo-spell':combo(['tendrils', 'mist', 'rift']),             'indigo-action':E.reap,
  'violet-spell':E.necro,                                  'violet-action':E.blades,
  'grey':E.dust
};
/* every effect knows its own name, so a slot's parts can be read back */
Object.keys(E).forEach(function(k){ if(!E[k].parts) E[k].part = k; });
function slotParts(key){ var f = SLOTS[key]; return f ? (f.parts || [f.part]) : []; }
/* No ground under an Ongoing Spell: its burst plays the rest of its slot (HANDOFF §73). */
var GROUND_PARTS = {ripple:1, whirlpool:1, necro:1, lava:1, plates:1, radiant:1, tracks:1, rift:1};
var BURST_SWAP = {necro:'necroAround'};
function burstParts(key){
  return slotParts(key).map(function(k){ return BURST_SWAP[k] || k; }).filter(function(k){ return !GROUND_PARTS[k]; });
}

/* 'loop', 'ongoing' or '': a Character with Action on it is a Character. */
function tdPfxKind(c){
  if(!c || tdIsCharacterCard(c)) return '';
  var act = tdFxHasSuper(c, 'action'), sp = tdFxHasSuper(c, 'spell');
  if(!act && !sp) return '';
  return tdFxHasSuper(c, 'ongoing') ? 'ongoing' : 'loop';
}
function tdPfxPool(c){
  var cols = (c.colors || []).map(function(x){ return String(x).toLowerCase(); })
    .filter(function(x, i, a){ return x !== 'grey' && TDFX_COL[x] && a.indexOf(x) === i; });
  if(!cols.length) return ['grey'];
  var types = [];
  if(tdFxHasSuper(c, 'spell')) types.push('spell');
  if(tdFxHasSuper(c, 'action')) types.push('action');
  var out = [];
  cols.forEach(function(k){ types.forEach(function(ty){ out.push(k + '-' + ty); }); });
  return out;
}
function tdPfxColsOf(key){ var k = key.split('-')[0]; return k === 'grey' ? GREY : [TDFX_COL[k]]; }
/* The slots that draw on the ground canvases: a card with none of them gets none. */
var GROUND_KEYS = ['red-spell', 'orange-spell', 'yellow-spell', 'green-spell', 'blue-spell', 'indigo-spell', 'violet-spell'];
/* One effect of each colour not yet used first, in random order, and only then the rest (HANDOFF §71.4). */
function pick3(pool){
  var order = shuffle(pool.slice()), out = [], used = {};
  order.forEach(function(k){ var col = k.split('-')[0]; if(out.length < 3 && !used[col]){ used[col] = 1; out.push(k); } });
  order.forEach(function(k){ if(out.length < 3 && out.indexOf(k) < 0) out.push(k); });
  return out;
}
function tdPfxNew(item, c, board, burst){
  var pool = tdPfxPool(c), keys = pick3(pool), kw = [], circle = tdFxCircleKind(c), pal = tdFxPalette(c);
  if(!burst){
    if(tdCardHasKw(item, 'Unique', board)) kw.push('kw-unique');
    if(tdFxHasSuper(c, 'mythic')) kw.push('kw-mythic');
    if(tdCardHasKw(item, 'Absolute', board)) kw.push('kw-absolute');
  }
  var now = performance.now();
  var inst = keys.map(function(k){ return {key:k, cols:tdPfxColsOf(k), draw:burst ? combo(burstParts(k))() : SLOTS[k](), t0:now}; })
    .concat(kw.map(function(k){ return {key:k, cols:GREY, draw:E[k](), t0:now}; }));
  if(burst) inst.push({key:'circle', cols:pal, draw:E['circle-' + circle](), t0:now});
  return {at:Date.now(), keys:keys, kw:kw, pool:pool.length, inst:inst, burst:!!burst,
          until:burst ? Date.now() + BURST * 1000 : 0, circle:circle, pal:pal,
          ground:keys.some(function(k){ return GROUND_KEYS.indexOf(k) >= 0; })};
}
function tdPfxMine(item, board){
  board = board || tdFxHalfOf(item.uid);
  return board === TD.board;
}
var CANVASES = "<canvas class='td-pfx-u' aria-hidden='true'></canvas><canvas class='td-pfx-o' aria-hidden='true'></canvas>";
var GROUNDS = "<canvas class='td-pfx-gb' aria-hidden='true'></canvas><canvas class='td-pfx-gf' aria-hidden='true'></canvas>";
/* Beside the card, not in it, so it does not float: tdCardHTML puts it after the card and tdFxAfterRender places it. */
function rest(uid, inner){ return "<div class='td-pfx-rest' data-for='" + e(uid) + "'>" + inner + '</div>'; }
/* Its own zone and half first, since a uid can be on two halves; by the escaped selector (tdSel). */
function restOf(el, uid){
  var sel = '.td-pfx-rest' + tdSel(uid, 'data-for');
  var near = el && el.parentNode;
  return (near && near.querySelector(':scope > ' + sel)) || document.querySelector('#tdBoard ' + sel);
}

window.tdPfxCard = function(item, zone, c, board){
  var uid = item.uid, rec = TDPFX.cards[uid];
  /* A record is for one card: a uid can come back on another (a side adopted at a table re-stamps every piece). */
  if(rec && rec.card !== c){ delete TDPFX.cards[uid]; rec = null; }
  var kind = (zone && zone.id === 'field' && c && !item.anon && !item.down
              && !(typeof tdIsPool === 'function' && tdIsPool())) ? tdPfxKind(c) : '';
  /* Not in a connected group: the group lays its cards out, and a floating card would lift out of it. */
  if(kind){ var half = board || tdFxHalfOf(uid);
    if(item.connectedTo || ((half && half.zones && half.zones.field) || []).some(function(k){ return k.connectedTo === uid; })) kind = ''; }
  if(!kind){ if(rec) delete TDPFX.cards[uid]; return null; }
  var reduced = tdFxReduced(), now = Date.now();
  if(kind === 'ongoing'){
    if(!rec || !rec.burst) return null;
    if(now > rec.until){ delete TDPFX.cards[uid]; return null; }
    var ci = tdFxCircleHTML(rec.circle, rec.pal, now - rec.at - CIRCLE_AT * 1000, false);
    return {cls:' td-pfx-burst', style:'', html:reduced ? '' : CANVASES, after:rest(uid, ci + (reduced ? '' : GROUNDS))};
  }
  if(!rec || rec.burst){ rec = TDPFX.cards[uid] = tdPfxNew(item, c, board, false); rec.card = c; }
  /* The owner's only; the uid rides on the button as data, read by the one click listener below. */
  var btn = tdPfxMine(item, board)
    ? "<button type='button' class='td-resolve' data-uid='" + e(uid) + "' title='Resolve: send it to the Grave'>Resolve</button>"
    : '';
  if(reduced) return {cls:' td-fx-play', style:'--fx-age:' + (-(now - rec.at)) + 'ms;', html:'', after:rest(uid, btn)};
  return {cls:' td-fx-play', style:'--fx-age:' + (-(now - rec.at)) + 'ms;', html:CANVASES,
          after:rest(uid, tdFxCircleHTML(rec.circle, rec.pal, now - rec.at, true) + (rec.ground ? GROUNDS : '') + btn)};
};
/* Called from tdFxAction before the redraw; under reduced motion the record is still made, but tdPfxTick draws nothing. */
window.tdPfxBurst = function(board, uid){
  var at = tdFindIn(board, uid);
  if(!at || !at.item.card) return;
  var rec = TDPFX.cards[uid] = tdPfxNew(at.item, at.item.card, board, true);
  rec.card = at.item.card;
  /* The circle goes when the burst ends, without a redraw, unless the card has a newer burst of its own. */
  setTimeout(function(){
    var now = TDPFX.cards[uid];
    if(now && now !== rec) return;
    var rs = document.querySelector('#tdBoard .td-pfx-rest' + tdSel(uid, 'data-for'));
    var n = rs && rs.querySelector(':scope > .td-fx-circle');
    if(n) n.remove();
  }, BURST * 1000 + 50);
};
document.addEventListener('click', function(ev){
  var b = ev.target && ev.target.closest ? ev.target.closest('.td-resolve[data-uid]') : null;
  if(b) window.tdPfxResolve(b.getAttribute('data-uid') || '');
});
window.tdPfxKind = tdPfxKind;
window.tdPfxResolve = function(uid){
  var at = tdFind(uid);
  if(!at || at.zone !== 'field') return;
  tdMenuMove(uid, 'grave');
};
/* Called from tdFxAction while the old element is still in place, on every screen. */
window.tdPfxResolved = function(board, a){
  if(tdFxReduced()) return;
  var el = tdFxEl(a.uid);
  if(!el) return;
  var from = tdFxRect(el);
  if(!from.w) return;
  var ghost = tdFxGhostOf(el, from);
  Array.prototype.forEach.call(ghost.querySelectorAll('.td-pfx-u,.td-pfx-o,.td-resolve'), function(n){ n.remove(); });
  ghost.classList.add('td-pfx-flash');
  TDFX.hold[a.uid] = {zone:'grave', until:Date.now() + 1200};
  TDFX.fired.resolve = (TDFX.fired.resolve || 0) + 1;
  setTimeout(function(){
    var to = tdFxEl(a.uid);
    function done(){ ghost.remove(); delete TDFX.hold[a.uid]; var g = tdFxEl(a.uid); if(g) g.classList.remove('td-fx-hold'); }
    if(!to || tdFxZoneOf(a.uid) !== 'grave' || !ghost.animate){
      if(ghost.animate) ghost.animate([{opacity:1}, {opacity:0}], {duration:300, fill:'forwards'}).finished.then(done); else done();
      return;
    }
    var t = tdFxRect(to);
    ghost.animate([{transform:'translate(0,0) scale(1) rotate(0)', opacity:1},
                   {transform:'translate(' + (t.cx - from.cx) + 'px,' + (t.cy - from.cy) + 'px) scale(' + (t.w / from.w || 1).toFixed(3) + ') rotate(-8deg)', opacity:.25}],
                  {duration:600, easing:'cubic-bezier(.5,0,.3,1)', fill:'forwards'}).finished.then(done);
  }, 300);
};

/* Every read first, every write after (as tdFxDeclTick does); answers how many are on screen, and the loop sleeps at 0. */
window.tdPfxTick = function(dt){
  if(tdFxReduced()) return 0;
  var host = document.getElementById('tdBoard');
  if(!host) return 0;
  var els = host.querySelectorAll('.td-card.td-fx-play, .td-card.td-pfx-burst');
  if(!els.length) return 0;
  var vw = window.innerWidth, vh = window.innerHeight, now = performance.now(), wall = Date.now(), list = [], i;
  for(i = 0; i < els.length; i++){
    var el = els[i], rec = TDPFX.cards[el.getAttribute('data-uid')];
    if(!rec) continue;
    if(!el.__pfx){ var rs = restOf(el, el.getAttribute('data-uid'));
      el.__pfx = {cu:el.querySelector(':scope > .td-pfx-u'), co:el.querySelector(':scope > .td-pfx-o'),
                  gb:rs && rs.querySelector(':scope > .td-pfx-gb'), gf:rs && rs.querySelector(':scope > .td-pfx-gf')}; }
    if(!el.__pfx.cu || !el.__pfx.co) continue;
    var r = el.getBoundingClientRect();
    list.push({el:el, rec:rec, w:el.clientWidth, h:el.clientHeight,
               on:r.width > 0 && r.bottom > -r.height && r.top < vh + r.height && r.right > -r.width && r.left < vw + r.width});
  }
  var dpr = Math.min(2, window.devicePixelRatio || 1), n = 0;
  DPR = dpr;
  list.forEach(function(d){
    var P = d.el.__pfx, rec = d.rec;
    if(!d.on || !d.w) return;
    var cvs = [P.cu, P.co, P.gb, P.gf].filter(Boolean);
    var left = rec.burst ? (rec.until - wall) / 1000 : 1;
    if(rec.burst && left <= 0){ if(!P.cleared){ P.cleared = true; cvs.forEach(function(cv){ cv.getContext('2d').clearRect(0, 0, cv.width, cv.height); }); } return; }
    n++;
    var W = Math.round(d.w * (1 + PAD_X * 2)), H = Math.round(d.h * (1 + PAD_Y * 2));
    if(P.w !== W || P.h !== H || P.d !== dpr){ P.w = W; P.h = H; P.d = dpr;
      cvs.forEach(function(cv){ cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr); }); }
    var cu = P.xu || (P.xu = P.cu.getContext('2d')), co = P.xo || (P.xo = P.co.getContext('2d'));
    var gb = P.gb ? P.xgb || (P.xgb = P.gb.getContext('2d')) : null, gf = P.gf ? P.xgf || (P.xgf = P.gf.getContext('2d')) : null;
    var ctx = [cu, co, gb, gf].filter(Boolean);
    ctx.forEach(function(c){ c.setTransform(dpr, 0, 0, dpr, 0, 0); c.clearRect(0, 0, W, H); });
    var R = {x:d.w * PAD_X, y:d.h * PAD_Y, w:d.w, h:d.h}; R.cx = R.x + R.w / 2; R.cy = R.y + R.h / 2;
    /* An Ongoing card's burst is all behind it: what would be in front goes on the back canvases. */
    var front = rec.burst ? cu : co, gfront = rec.burst ? gb : gf;
    var S = {el:d.el, gb:gb, gf:gfront}, fade = rec.burst ? clamp(left / BURST_FADE, 0, 1) : 1, op = fade < 1 ? fade.toFixed(3) : '';
    cvs.forEach(function(cv){ cv.style.opacity = op; });
    rec.inst.forEach(function(q){
      ctx.forEach(function(c){ c.save(); });
      try{ q.draw(cu, front, R, Math.max(0, (now - q.t0) / 1000), dt, q.cols, S); }catch(_){}
      ctx.forEach(function(c){ c.restore(); });
    });
    /* Whatever lies over the card's face is 25% see-through. */
    if(!rec.burst) [co, gf].forEach(function(c){ if(!c) return; c.save(); c.globalCompositeOperation = 'destination-out'; c.fillStyle = 'rgba(0,0,0,.25)'; rrect(c, R.x, R.y, R.w, R.h, 6); c.fill(); c.restore(); });
  });
  return n;
};
window.tdPfxPick = pick3;
/* For the checks only: nothing in the app calls these. */
window.tdPfxCheck = {
  make:function(k){ return E[k](); },
  parts:function(slot){ return (SLOTS[slot] && SLOTS[slot].parts) || null; },
  burstParts:function(slot){ return burstParts(slot); },
  shields:function(){ return Object.keys(shapes().shields); },
  bowAim:function(){ return bowAim(0); },
  sealR:SEAL_R, swordKeys:SWORD_KEYS, knifeKeys:KNIFE_KEYS, scytheKeys:SCYTHE_KEYS,
  fade:function(){ var cv = document.createElement('canvas'); cv.width = cv.height = 200; var c = cv.getContext('2d');
    var keep = DPR; DPR = 1; c.setTransform(1, 0, 0, 1, 0, 0);
    fromGround(c, 100, 150, 30, 60, 1, function(x){ x.fillStyle = '#ffffff'; x.fillRect(70, 40, 60, 160); });
    DPR = keep;
    var a = function(y){ return c.getImageData(100, y, 1, 1).data[3]; };
    return {foot:a(149), mid:a(146), above:a(130), below:a(160)}; }
};
/* for the checks */
window.tdPfxStats = function(){
  var out = {};
  Object.keys(TDPFX.cards).forEach(function(u){ var r = TDPFX.cards[u];
    out[u] = {keys:r.keys.slice(), kw:r.kw.slice(), pool:r.pool, burst:r.burst, until:r.until, at:r.at}; });
  return out;
};
window.tdPfxSlots = function(){ return Object.keys(SLOTS); };
})();
