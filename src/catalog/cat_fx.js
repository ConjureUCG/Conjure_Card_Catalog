/* Known issue: reduced motion is read once, at load; turning it on later leaves the sparks running until a reload. */
(function(){
  var hdr = document.querySelector('header');
  if(!hdr) return;

  var glow = document.createElement('div');
  glow.className = 'hdr-glow';
  glow.setAttribute('aria-hidden', 'true');
  hdr.insertBefore(glow, hdr.firstChild);

  var FX = {hot:0, want:0};
  var SEL = 'button, a, .rb-toggle';
  function want(on){
    FX.want = on ? 1 : 0;
    hdr.classList.toggle('hdr-hot', !!on);
  }
  hdr.addEventListener('pointerover', function(ev){
    var t = ev.target;
    want(!!(t && t.closest && t.closest(SEL)));
  });
  hdr.addEventListener('pointerleave', function(){ want(false); });
  hdr.addEventListener('focusin', function(ev){
    if(ev.target && ev.target.closest && ev.target.closest(SEL)) want(true);
  });
  hdr.addEventListener('focusout', function(){ want(false); });

  if(window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches) return;

  var cv = document.createElement('canvas');
  cv.className = 'hdr-fx';
  cv.setAttribute('aria-hidden', 'true');
  hdr.insertBefore(cv, glow.nextSibling);
  var cx = cv.getContext && cv.getContext('2d');
  if(!cx) return;

  var W = 0, H = 0;
  function size(){
    var dpr = Math.min(2, window.devicePixelRatio || 1);
    W = hdr.clientWidth;
    H = Math.max(1, hdr.clientHeight - 4);     /* above the 4px metal bar */
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    cx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  size();
  if(window.ResizeObserver) new ResizeObserver(size).observe(hdr);
  else addEventListener('resize', size);

  function dot(rgb){
    var s = document.createElement('canvas'); s.width = s.height = 32;
    var g = s.getContext('2d'), gr = g.createRadialGradient(16, 16, 0, 16, 16, 16);
    gr.addColorStop(0, 'rgba(' + rgb + ',1)');
    gr.addColorStop(.28, 'rgba(' + rgb + ',.8)');
    gr.addColorStop(1, 'rgba(' + rgb + ',0)');
    g.fillStyle = gr; g.fillRect(0, 0, 32, 32);
    return s;
  }
  var PAL = {
    mainD: ['175,228,255', '140,205,255', '214,255,232', '232,242,255'],
    rbD:   ['255,72,44', '255,120,40', '255,214,72', '255,236,140'],
    mainL: ['47,111,208', '30,80,170', '40,130,150'],
    rbL:   ['194,80,12', '170,40,10', '210,120,20']
  };
  var SPR = {};
  Object.keys(PAL).forEach(function(k){ SPR[k] = PAL[k].map(dot); });

  var P = [], MAX = 320;
  function spawn(){
    var b = document.body.classList;
    var rb = b.contains('rebirth'), lt = b.contains('light');
    var pal = SPR[(rb ? 'rb' : 'main') + (lt ? 'L' : 'D')];
    var sp = (0.18 + Math.random() * 0.32) * (1 + FX.hot * 0.7);
    P.push({x:Math.random() * W, y:rb ? H + 2 : -2,
            vx:(Math.random() - 0.5) * 0.12, vy:rb ? -sp : sp,
            r:0.45 + Math.random() * 0.9 + FX.hot * 0.25,
            img:pal[(Math.random() * pal.length) | 0],
            rb:rb, lt:lt, life:0, ph:Math.random() * 6.283});
  }

  var M = {x:-1e4, y:-1e4, vx:0, vy:0, t:0};
  hdr.addEventListener('pointermove', function(ev){
    var r = hdr.getBoundingClientRect(), now = performance.now();
    var x = ev.clientX - r.left, y = ev.clientY - r.top;
    if(M.t){
      var dt = Math.max(8, now - M.t);
      M.vx = (x - M.x) / dt * 16; M.vy = (y - M.y) / dt * 16;
    }
    M.x = x; M.y = y; M.t = now;
  }, {passive:true});
  hdr.addEventListener('pointerleave', function(){ M.x = M.y = -1e4; M.t = 0; });

  var R = 40, acc = 0, last = 0;
  function frame(t){
    var f = last ? Math.min(3, (t - last) / 16.667) : 1;
    last = t;
    FX.hot += (FX.want - FX.hot) * Math.min(1, 0.08 * f);
    M.vx *= Math.pow(0.85, f); M.vy *= Math.pow(0.85, f);
    acc += (W / 1400) * (0.22 + FX.hot * 0.9) * f;
    while(acc >= 1 && P.length < MAX){ spawn(); acc -= 1; }
    if(acc > 3) acc = 3;
    cx.clearRect(0, 0, W, H);
    var bc = document.body.classList, nowRb = bc.contains('rebirth'), nowLt = bc.contains('light');
    var mode = '';
    for(var i = P.length - 1; i >= 0; i--){
      var p = P[i];
      p.life += f;
      if(p.rb !== nowRb || p.lt !== nowLt){
        p.out = (p.out == null ? 1 : p.out) - 0.06 * f;
        if(p.out <= 0){ P.splice(i, 1); continue; }
      }
      var dx = p.x - M.x, dy = p.y - M.y, d2 = dx * dx + dy * dy;
      if(d2 < R * R){
        var d = Math.sqrt(d2) || 1, g = 1 - d / R;
        p.x += (M.vx * 0.06 + dx / d * 0.35) * g * f;
      }
      p.x += (p.vx + Math.sin(p.ph + p.life * 0.06) * (p.rb ? 0.16 : 0.09)) * f;
      p.y += p.vy * f;
      var gone = p.rb ? (H - p.y) / H : p.y / H;
      if(gone > 1.05 || p.x < -6 || p.x > W + 6){ P.splice(i, 1); continue; }
      var a = Math.min(1, p.life / 10) * Math.max(0, 1 - gone) * (0.32 + FX.hot * 0.53)
            * (p.out == null ? 1 : p.out);
      if(a <= 0.01) continue;
      var m = p.lt ? 'source-over' : 'lighter';
      if(m !== mode){ cx.globalCompositeOperation = m; mode = m; }
      var sz = p.r * 2.6;
      cx.globalAlpha = p.lt ? a * 0.8 : a;
      cx.drawImage(p.img, p.x - sz, p.y - sz, sz * 2, sz * 2);
    }
    cx.globalAlpha = 1;
    requestAnimationFrame(frame);
  }
  requestAnimationFrame(frame);
})();
