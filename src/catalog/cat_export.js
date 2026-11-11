

/* The face, as the deck export draws it: card.imageUrl is only the landscape art panel. */
function downloadCardImage(card){
  if(!card){ alert('No card selected.'); return; }
  var safeName = (card.name||'card').replace(/[\\/:*?"<>|]/g,'_');
  var save = function(blob){
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url; a.download = safeName + '.png';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 5000);
  };
  faceToPngBlob(card, 2).then(function(r){
    save(r.blob);
    if(!r.missingArt) return;
    if(_artFolderMayHelp()){
      if(confirm('Saved, but with an EMPTY ART BOX.\n\nA page opened from file:// cannot'
         + ' read its own image files back.\nPick your art folder once to include the art'
         + ' from now on.\n\nChoose it now?')){
        window.edLinkArtFolder(function(n){ alert('Linked ' + n + ' art file(s).'); });
      }
    } else {
      alert('Saved, but with an EMPTY ART BOX: the art could not be loaded (' + r.why.join('; ') + ').');
    }
  }).catch(function(err){
    alert('Could not render this card: ' + (err && err.message ? err.message : err));
  });
}

/* Rasterised through <foreignObject>: the SVG must reach the Image as a data: URL (a blob: URL taints the canvas and toBlob throws),
   and nothing is fetched meanwhile, so the art is inlined and the whole page <style>, fonts included, is embedded. */
var _faceCssCache = null;
function _faceCss(){
  if(_faceCssCache === null){
    _faceCssCache = Array.prototype.map.call(document.querySelectorAll('style'),
      function(s){ return s.textContent; }).join('\n');
  }
  return _faceCssCache;
}

/* From file:// each picture is its own opaque origin and its pixels cannot be read; files from a folder the user picks can. Only handles are kept. */
var _artFiles = null;
function _artFolderLinked(){ return !!(_artFiles && _artFiles.size); }
window.edArtFolderLinked = _artFolderLinked;
/* Over http the art is fetched (_artLoad), so a picture still missing there is the network's doing, and a folder would not help. */
function _artFolderMayHelp(){ return location.protocol === 'file:' && !_artFolderLinked(); }
window.edLinkArtFolder = function(then){
  var inp = document.createElement('input');
  inp.type = 'file'; inp.accept = 'image/*';
  inp.webkitdirectory = true; inp.multiple = true;
  inp.style.display = 'none';
  inp.onchange = function(){
    _artFiles = new Map();
    Array.prototype.forEach.call(inp.files || [], function(f){
      _artFiles.set(String(f.name).toLowerCase(), f);
    });
    document.body.removeChild(inp);
    if(typeof then === 'function') then(_artFiles.size);
    else alert('Linked ' + _artFiles.size + ' art file(s) for this session.');
  };
  document.body.appendChild(inp);
  inp.click();
};
function _artFromFolder(url){
  return new Promise(function(res){
    if(!_artFolderLinked()){ res(null); return; }
    var name = decodeURIComponent(String(url).split(/[?#]/)[0].split('/').pop() || '').toLowerCase();
    var f = _artFiles.get(name);
    if(!f){ res(null); return; }
    var fr = new FileReader();
    fr.onload = function(){ res(fr.result); };     // data: URI - taints nothing
    fr.onerror = function(){ res(null); };
    fr.readAsDataURL(f);
  });
}

/* A picture drawn onto a canvas of the size it is shown at (the cover rule, so it still fills a maxW x maxH box; never
   enlarged) and read back as a data: URL. JPEG, unless it has see-through pixels, which JPEG would make black. Throws on a
   picture whose pixels may not be read: a file:// one, or another site's fetched without CORS. */
function _shrinkTo(img, w, h, maxW, maxH){
  var k = Math.max(maxW > 0 ? maxW / w : 0, maxH > 0 ? maxH / h : 0);
  var s = k > 0 ? Math.min(1, k) : 1;
  var cv = document.createElement('canvas');
  cv.width  = Math.max(1, Math.round(w * s));
  cv.height = Math.max(1, Math.round(h * s));
  var g = cv.getContext('2d');
  g.imageSmoothingEnabled = true; g.imageSmoothingQuality = 'high';
  g.drawImage(img, 0, 0, cv.width, cv.height);
  var px = g.getImageData(0, 0, cv.width, cv.height).data, clear = false;
  for(var i = 3; i < px.length; i += 4){ if(px[i] < 255){ clear = true; break; } }
  return clear ? cv.toDataURL('image/png') : cv.toDataURL('image/jpeg', 0.92);
}
function _shrinkDataUrl(src, maxW, maxH){
  return new Promise(function(res){
    var img = new Image();
    img.onload = function(){
      try{ res(_shrinkTo(img, img.naturalWidth || 1, img.naturalHeight || 1, maxW, maxH)); }
      catch(e){ res(null); }
    };
    img.onerror = function(){ res(null); };
    img.src = src;
  });
}
/* createImageBitmap decodes off the page's thread; an <img> of an object URL where it cannot (an SVG, an older browser) */
function _shrinkBlob(blob, maxW, maxH){
  var viaUrl = function(){
    var ou = URL.createObjectURL(blob);
    return _shrinkDataUrl(ou, maxW, maxH).then(function(d){ URL.revokeObjectURL(ou); return d; });
  };
  if(typeof createImageBitmap !== 'function') return viaUrl();
  return createImageBitmap(blob).then(function(bm){
    var d = null;
    try{ d = _shrinkTo(bm, bm.width, bm.height, maxW, maxH); }catch(_){}
    try{ bm.close(); }catch(_){}
    return d;
  }, viaUrl);
}
function _artFail(why, last){ var er = new Error(why); er.why = why; er.last = !!last; return er; }
/* With CORS, or the canvas may not read the pixels back: the published art is on another site, the CDN. Once more past the
   browser's cache when that fails, as the cache can hold a copy fetched without CORS; a missing picture is not asked twice. */
function _artFetch(url){
  var host = '';
  try{ host = new URL(url).host; }catch(_){}
  var get = function(cache){
    var ac = (typeof AbortController === 'function') ? new AbortController() : null;
    var tm = ac ? setTimeout(function(){ ac.abort(); }, 60000) : 0;
    return fetch(url, {mode:'cors', credentials:'omit', cache:cache, signal:ac ? ac.signal : undefined})
      .then(function(r){
        if(!r.ok) throw _artFail('HTTP ' + r.status, true);
        return r.blob();
      })
      .then(function(b){ clearTimeout(tm); return b; }, function(err){
        clearTimeout(tm);
        if(err && err.why) throw err;
        if(err && err.name === 'AbortError') throw _artFail('no answer from ' + (host || 'the art site') + ' in 60 s', true);
        throw _artFail(navigator.onLine === false ? 'offline' : 'blocked, or no answer from ' + (host || 'the art site'));
      });
  };
  return get('default').catch(function(err){
    if(err && err.last) throw err;
    return get('reload');
  });
}
/* The reason a picture could not be read, by its address, for the message that says so. */
var _artWhy = {};
function _artLoad(url, maxW, maxH){
  var abs = null;
  try{ abs = new URL(url, location.href); }catch(_){}
  var first;
  if(abs && /^(https?|blob):$/.test(abs.protocol) && typeof fetch === 'function'){
    first = _artFetch(abs.href).then(function(blob){
      return _shrinkBlob(blob, maxW, maxH).then(function(d){
        if(!d) _artWhy[url] = 'not a picture the browser can read';
        return d;
      });
    }, function(err){
      _artWhy[url] = (err && err.why) || 'no answer from the art site';
      return null;
    });
  } else {
    /* file://: the picture loads, and its pixels taint the canvas */
    first = _shrinkDataUrl(url, maxW, maxH).then(function(d){
      if(!d) _artWhy[url] = 'a page opened from file:// cannot read it';
      return d;
    });
  }
  return first.then(function(d){
    if(d) return d;
    return _artFromFolder(url).then(function(f){
      if(!f){
        if(_artFolderLinked()) _artWhy[url] = 'not in the linked art folder';
        return null;
      }
      return _shrinkDataUrl(f, maxW, maxH).then(function(small){ return small || f; });
    });
  });
}
/* One picture as a data: URL that a canvas, and the SVG a face is rasterised through, can use; null if it cannot be read,
   with the reason in _artWhy. One job per picture and size at a time, and three pictures at once: each is a full-size
   bitmap while it is shrunk, and a deck asks for dozens. */
var _artJobs = {}, _artBusy = 0, _artQueue = [];
function _artDataUrl(url, maxW, maxH){
  if(!url) return Promise.resolve(null);
  url = String(url);
  if(url.indexOf('data:') === 0) return Promise.resolve(url);
  var key = url + ' ' + Math.round(maxW || 0) + 'x' + Math.round(maxH || 0);
  if(_artJobs[key]) return _artJobs[key];
  _artJobs[key] = new Promise(function(res){
    var run = function(){
      _artBusy++;
      _artLoad(url, maxW, maxH).then(null, function(){ return null; }).then(function(d){
        _artBusy--; delete _artJobs[key];
        var nx = _artQueue.shift(); if(nx) nx();
        res(d);
      });
    };
    if(_artBusy < 3) run(); else _artQueue.push(run);
  });
  return _artJobs[key];
}

/* The pictures in the background layers under root: each address once, at the largest size it is drawn at (k output
   pixels a CSS pixel; the box's rectangle, so the art's zoom counts). A box not shown (Full art's layer on a card without
   it) draws nothing, so its pictures are not fetched. */
var _BG_URL = /url\(["']?([^"')]+)["']?\)/g;
function _bgPictures(root, k){
  var found = {pics:[], nodes:[], byUrl:{}};
  Array.prototype.forEach.call(root.querySelectorAll('*'), function(n){
    var bi = getComputedStyle(n).backgroundImage || '', urls = [], m;
    if(bi.indexOf('url(') < 0) return;
    _BG_URL.lastIndex = 0;
    while((m = _BG_URL.exec(bi))){ if(m[1].indexOf('data:') !== 0) urls.push(m[1]); }
    if(!urls.length) return;
    var r = n.getBoundingClientRect(), shown = r.width > 0 && r.height > 0;
    found.nodes.push({n:n, bi:bi, shown:shown});
    if(!shown) return;
    urls.forEach(function(u){
      var j = found.byUrl[u];
      if(!j){ j = found.byUrl[u] = {url:u, w:0, h:0, data:null}; found.pics.push(j); }
      j.w = Math.max(j.w, r.width * k); j.h = Math.max(j.h, r.height * k);
    });
  });
  return found;
}
/* Every picture under root swapped for its data: URL, its other layers kept. Resolves {missing, why, pics}. A picture that
   could not be read keeps its address when `keep` is set (a print, where the browser draws it unread); in a face to be
   rasterised it, and a box not shown, become none, as the SVG can load nothing. onEach(done, of) as each one ends. */
function _inlineArt(root, k, keep, onEach){
  var found = _bgPictures(root, k), done = 0;
  return Promise.all(found.pics.map(function(j){
    return _artDataUrl(j.url, j.w, j.h).then(function(d){
      j.data = d;
      done++;
      if(typeof onEach === 'function'){ try{ onEach(done, found.pics.length); }catch(_){} }
    });
  })).then(function(){
    found.nodes.forEach(function(it){
      if(keep && !it.shown) return;
      var v = it.bi.replace(_BG_URL, function(m, u){
        if(u.indexOf('data:') === 0) return m;
        var j = it.shown ? found.byUrl[u] : null;
        if(j && j.data) return 'url("' + j.data + '")';
        return keep ? m : 'none';
      });
      if(v !== it.bi) it.n.style.backgroundImage = v;
    });
    var bad = found.pics.filter(function(j){ return !j.data; });
    return {missing:bad.length, pics:found.pics,
            why:bad.map(function(j){ return _artWhy[j.url] || 'not read'; })
                   .filter(function(w, i, all){ return all.indexOf(w) === i; })};
  });
}
/* The editor's edPrintCards readies its pictures through this. */
window.edInlineArt = _inlineArt;

/* The markup (xml) drawn W x H CSS pixels at `scale` output pixels each, as `type` (PNG unless set) at `quality`. bg fills
   what the face's rounded corners leave, as a JPEG has no see-through. */
function _rasterise(xml, W, H, scale, type, quality, bg){
  return new Promise(function(resolve, reject){
    var svg = '<svg xmlns="http://www.w3.org/2000/svg" width="'+W+'" height="'+H+'">'
      + '<foreignObject width="100%" height="100%">'
      + '<body xmlns="http://www.w3.org/1999/xhtml" class="' + (document.body.className||'') + '"'
      +      ' style="margin:0;width:'+W+'px;height:'+H+'px">'
      + '<style><![CDATA[' + _faceCss() + ']]></style>' + xml
      + '</body></foreignObject></svg>';
    var img = new Image();
    img.onload = function(){
      try{
        var cv = document.createElement('canvas');
        cv.width = Math.round(W * scale); cv.height = Math.round(H * scale);
        var g = cv.getContext('2d');
        if(bg){ g.fillStyle = bg; g.fillRect(0, 0, cv.width, cv.height); }
        g.drawImage(img, 0, 0, cv.width, cv.height);
        cv.toBlob(function(b){
          if(b) resolve(b);
          else reject(new Error('canvas produced no image'));
        }, type || 'image/png', quality);
      }catch(err){ reject(err); }
    };
    img.onerror = function(){ reject(new Error('face SVG failed to rasterise')); };
    img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(svg);
  });
}
function faceToPngBlob(card, scale){ return faceToBlob(card, scale); }
/* Tabletop Simulator's pictures are JPEG on black (the TTS publish, ed2_publish.js). */
function faceToBlob(card, scale, type, quality, bg){
  scale = scale || 2;
  var W = 340, H = 476;
  return new Promise(function(resolve, reject){
    if(typeof window.edShowCardFace !== 'function'){
      reject(new Error('card face renderer unavailable')); return;
    }
    var host = document.createElement('div');
    host.setAttribute('style','position:fixed;left:-20000px;top:0;width:'+W+'px;pointer-events:none');
    document.body.appendChild(host);
    var cleanup = function(){ try{ host.remove(); }catch(_){} };
    if(!window.edShowCardFace(card, host)){ cleanup(); reject(new Error('could not build face')); return; }
    var face = host.querySelector('.mcard');
    if(!face){ cleanup(); reject(new Error('no face element')); return; }

    /* The host is the face at 340px, so `scale` output pixels a CSS pixel; why[] is each missing picture's reason. */
    var missing = 0, why = [];
    _inlineArt(host, scale, false).then(function(r){ missing = r.missing; why = r.why; finish(); },
                                       function(err){ cleanup(); reject(err); });
    function finish(){
      /* The .mcard-fit wrapper, not the bare .mcard, which has no size of its own; and inside a <body> with the page's classes,
         because the face's rules are written body:not(.mse-template) .m-... and body.edge-* / body.pin-*. */
      var wrap = host.querySelector('.mcard-fit') || face;
      var xml;
      try{ xml = new XMLSerializer().serializeToString(wrap); }
      catch(err){ cleanup(); reject(err); return; }
      _rasterise(xml, W, H, scale, type, quality, bg).then(function(b){
        cleanup(); resolve({blob:b, missingArt:missing, why:why});
      }, function(err){ cleanup(); reject(err); });
    }
  });
}
window.edFaceToPngBlob = faceToPngBlob;
window.edFaceToBlob = faceToBlob;
/* A card back whole (CB_MARKUP, card_backs.js), at its own 750 x 1050, still: its pictures are data: URLs already. */
function backToBlob(key, type, quality, bg){
  var W = 750, H = 1050;
  if(typeof CB_MARKUP === 'undefined' || !CB_MARKUP[key])
    return Promise.reject(new Error('there is no card back "' + key + '"'));
  var host = document.createElement('div');
  host.setAttribute('style','position:fixed;left:-20000px;top:0;width:'+W+'px;height:'+H+'px;pointer-events:none');
  host.innerHTML = "<div class='cbk cbk-" + key + "'>" + CB_MARKUP[key] + "</div>";
  document.body.appendChild(host);
  var xml;
  try{ xml = new XMLSerializer().serializeToString(host.firstChild); }
  catch(err){ host.remove(); return Promise.reject(err); }
  return _rasterise(xml, W, H, 1, type, quality, bg).then(function(b){
    host.remove(); return {blob:b};
  }, function(err){ host.remove(); throw err; });
}
window.edBackToBlob = backToBlob;

/* The whole face, not imageUrl: that is only the art panel, and under file:// every fetch of one is refused. */
function downloadDeckImages(){
  var deck = deckAllEntries();
  var cardMap = {};
  CARDS.forEach(function(c){ cardMap[c.name] = c; });
  var seen = {};
  var toDownload = [];
  deck.forEach(function(entry){
    if(!seen[entry.name]){
      seen[entry.name] = true;
      var card = cardMap[entry.name];
      if(card) toDownload.push(card);          // art is not required
    }
  });
  if(!toDownload.length){ alert('No cards in deck.'); return; }
  var btn = document.getElementById('dvExportBtn');
  var origText = btn ? btn.innerHTML : '';
  if(btn) btn.innerHTML = uiIco('download') + ' Rendering...';
  var fetched = 0;
  var files = [];
  function _buildZip(){
    function _crc32(buf){
      var t = window._crc32Table;
      if(!t){ t=[]; for(var n=0;n<256;n++){var c=n;for(var k=0;k<8;k++) c=c&1?0xEDB88320^(c>>>1):c>>>1; t[n]=c;} window._crc32Table=t; }
      var crc=0xFFFFFFFF;
      for(var i=0;i<buf.length;i++) crc=(crc>>>8)^t[(crc^buf[i])&0xFF];
      return (crc^0xFFFFFFFF)>>>0;
    }
    function _dosTime(d){ return ((d.getHours()<<11)|(d.getMinutes()<<5)|(d.getSeconds()>>1))&0xFFFF; }
    function _dosDate(d){ return ((((d.getFullYear()-1980)&0x7F)<<9)|((d.getMonth()+1)<<5)|d.getDate())&0xFFFF; }
    function _u16(v){ return [v&0xFF,(v>>8)&0xFF]; }
    function _u32(v){ return [v&0xFF,(v>>8)&0xFF,(v>>16)&0xFF,(v>>24)&0xFF]; }
    var now = new Date();
    var modTime = _dosTime(now), modDate = _dosDate(now);
    var centralDir = [], localOffset = 0, parts = [];
    files.forEach(function(file){
      var nameBytes = new TextEncoder().encode(file.name);
      var data = new Uint8Array(file.data);
      var crc = _crc32(data);
      var localHeader = new Uint8Array([
        0x50,0x4B,0x03,0x04, // sig
        0x0A,0x00, // version needed
        0x00,0x00, // flags
        0x00,0x00, // compression: store
        ..._u16(modTime), ..._u16(modDate),
        ..._u32(crc),
        ..._u32(data.length), // compressed
        ..._u32(data.length), // uncompressed
        ..._u16(nameBytes.length),
        0x00,0x00  // extra field length
      ]);
      parts.push(localHeader, nameBytes, data);
      var cdEntry = new Uint8Array([
        0x50,0x4B,0x01,0x02,
        0x14,0x00, // version made by
        0x0A,0x00, // version needed
        0x00,0x00, // flags
        0x00,0x00, // compression
        ..._u16(modTime), ..._u16(modDate),
        ..._u32(crc),
        ..._u32(data.length),
        ..._u32(data.length),
        ..._u16(nameBytes.length),
        0x00,0x00, 0x00,0x00, 0x00,0x00, 0x00,0x00,
        0x00,0x00,0x00,0x00,
        ..._u32(localOffset)
      ]);
      centralDir.push({entry:cdEntry, name:nameBytes});
      localOffset += localHeader.length + nameBytes.length + data.length;
    });
    var cdOffset = localOffset;
    var cdSize = 0;
    centralDir.forEach(function(cd){ parts.push(cd.entry, cd.name); cdSize += cd.entry.length + cd.name.length; });
    var eocd = new Uint8Array([
      0x50,0x4B,0x05,0x06,
      0x00,0x00, 0x00,0x00,
      ..._u16(files.length), ..._u16(files.length),
      ..._u32(cdSize), ..._u32(cdOffset),
      0x00,0x00
    ]);
    parts.push(eocd);
    var totalLen = 0; parts.forEach(function(p){ totalLen += p.length; });
    var result = new Uint8Array(totalLen);
    var off = 0; parts.forEach(function(p){ result.set(p, off); off += p.length; });
    return result;
  }
  function _done(){
    var zipData = _buildZip();
    var blob = new Blob([zipData], {type:'application/zip'});
    var url = URL.createObjectURL(blob);
    var a = document.createElement('a');
    a.href = url;
    a.download = (DECK_NAME||'deck')+'_images.zip';
    document.body.appendChild(a); a.click(); document.body.removeChild(a);
    setTimeout(function(){ URL.revokeObjectURL(url); }, 5000);
    if(btn) btn.innerHTML = origText;
  }
  /* One card at a time, on purpose: each face embeds the whole stylesheet and its art. */
  var idx = 0, noArt = [], failed = [];
  function step(){
    if(idx >= toDownload.length){ _report(); return; }
    var card = toDownload[idx++];
    var safeName = (card.name||'card').replace(/[\\/:*?"<>|]/g,'_') + '.png';
    faceToPngBlob(card, 2).then(function(r){
      if(r.missingArt) noArt.push((card.name||'?') + ' (' + r.why.join('; ') + ')');
      return r.blob.arrayBuffer();
    }).then(function(buf){
      files.push({name:safeName, data:buf});
      fetched++;
      if(btn) btn.innerHTML = uiIco('download') + ' '+fetched+'/'+toDownload.length;
      step();
    }).catch(function(err){
      failed.push((card.name||'?') + ' (' + (err && err.message ? err.message : err) + ')');
      step();
    });
  }
  function _report(){
    if(!files.length){
      if(btn) btn.innerHTML = origText;
      alert('Could not render any card images.\n' + failed.slice(0,5).join('\n'));
      return;
    }
    _done();
    if(failed.length) alert('Exported ' + files.length + ', failed ' + failed.length
      + ':\n' + failed.slice(0,5).join('\n'));
    /* Never ship blank art boxes silently: from file:// offer the one folder pick that fixes it; anywhere else say why. */
    if(noArt.length && _artFolderMayHelp()){
      if(confirm(noArt.length + ' of ' + files.length + ' card(s) exported with an EMPTY ART BOX.\n\n'
        + 'A page opened from file:// is not allowed to read its own image\n'
        + 'files back. Pick your art folder once and the art will be included\n'
        + 'from then on, for this session.\n\nChoose the art folder now?')){
        window.edLinkArtFolder(function(n){
          alert('Linked ' + n + ' art file(s). Run the export again.');
        });
      }
    } else if(noArt.length){
      alert(noArt.length + ' of ' + files.length + ' card(s) exported with an EMPTY ART BOX, as the art could not be loaded:\n'
        + noArt.slice(0,5).join('\n') + (noArt.length > 5 ? '\nand ' + (noArt.length - 5) + ' more' : ''));
    }
  }
  step();
}

/* Build Deck → Export → TTS: a window to pick the card back, then the deck as a Tabletop Simulator saved object. Each card
   is its own picture in the TTS repository its set publishes (edTtsLists, ed2_publish.js); every copy of a card shares it. */
var _ttsWin = null;
function _ttsDeckItems(){
  var cardMap = {}, items = [], byName = {};
  CARDS.forEach(function(c){ cardMap[c.name] = c; });
  deckAllEntries().forEach(function(en){
    var c = cardMap[en.name];
    if(!c) return;
    if(byName[en.name]){ byName[en.name].count += en.count; return; }
    byName[en.name] = {card:c, count:en.count};
    items.push(byName[en.name]);
  });
  return items;
}
function exportTTS(){
  var items = _ttsDeckItems();
  if(!items.length){ alert('No cards in deck to export.'); return; }
  if(typeof window.edTtsLists !== 'function'){ alert('The editor did not load, so the Tabletop Simulator pictures cannot be found.'); return; }
  var back = (typeof tdBackKind === 'function') ? tdBackKind() : (((window.CB_LIST || [])[0] || {}).key || '');
  var seq = (_ttsWin ? _ttsWin.seq : 0) + 1;
  _ttsWin = {items:items, faces:null, backs:null, back:back, err:'', seq:seq};
  _ttsRender();
  window.edTtsLists(items.map(function(it){ return it.card; })).then(function(r){
    if(!_ttsWin || _ttsWin.seq !== seq) return;
    _ttsWin.faces = r.faces || [];
    _ttsWin.backs = r.backs || {};
    /* the board's back when Tabletop Simulator has it, else the first on the list that it has */
    if(!_ttsWin.backs[_ttsWin.back]){
      var have = (window.CB_LIST || []).filter(function(b){ return !!_ttsWin.backs[b.key]; })[0];
      if(have) _ttsWin.back = have.key;
    }
    _ttsRender();
  }, function(err){
    if(!_ttsWin || _ttsWin.seq !== seq) return;
    _ttsWin.err = 'Could not find the pictures: ' + (err && err.message ? err.message : err);
    _ttsRender();
  });
}
function _ttsCounts(w){
  var out = {ready:0, of:0, why:{}};
  w.items.forEach(function(it, i){
    out.of += it.count;
    var f = w.faces ? w.faces[i] : null;
    if(f && f.url) out.ready += it.count;
    else if(f) (out.why[f.why] = out.why[f.why] || []).push(it.card.name);
  });
  return out;
}
function _ttsCanSave(w){
  return !!(w && w.faces && w.backs && w.backs[w.back] && _ttsCounts(w).ready);
}
function _ttsRender(){
  var w = _ttsWin; if(!w) return;
  var ov = document.getElementById('ttsOv'), fresh = !ov;
  if(fresh){
    ov = document.createElement('div');
    ov.id = 'ttsOv'; ov.className = 'td-ov tts-ov';
    document.body.appendChild(ov);
    ov.addEventListener('click', function(ev){
      if(ev.target === ov){ ttsClose(); return; }
      var t = ev.target.closest && ev.target.closest('[data-tts-back]');
      if(t) _ttsPick(t.getAttribute('data-tts-back'));
    });
    /* Escape and the focus trap are modalOpen's, below */
    ov.addEventListener('keydown', function(ev){
      var t = ev.target.closest && ev.target.closest('[data-tts-back]');
      if(t && (ev.key === 'Enter' || ev.key === ' ')){ ev.preventDefault(); _ttsPick(t.getAttribute('data-tts-back')); }
    });
  }
  /* drawn again once the pictures are found: the control in focus keeps it */
  var had = document.activeElement, hadBack = '', hadId = '';
  if(had && had !== ov && ov.contains(had)){ hadBack = had.getAttribute('data-tts-back') || ''; hadId = had.id || ''; }
  var ready = !!w.faces, n = _ttsCounts(w), lines = [];
  if(w.err) lines.push(w.err);
  else if(!ready) lines.push('Finding the cards’ pictures…');
  else {
    lines.push(n.ready + ' of ' + n.of + ' card' + (n.of === 1 ? '' : 's') + ' ready');
    Object.keys(n.why).forEach(function(why){
      var list = n.why[why];
      lines.push(why + ': ' + list.slice(0, 6).join(', ') + (list.length > 6 ? ' and ' + (list.length - 6) + ' more' : ''));
    });
    if(!Object.keys(w.backs || {}).length) lines.push('No card backs for Tabletop Simulator yet');
  }
  var tiles = (window.CB_LIST || []).map(function(b){
    var has = !ready || !!(w.backs && w.backs[b.key]), on = b.key === w.back;
    return "<div class='tpp-opt" + (on ? ' on' : '') + (has ? '' : ' tts-off') + "' role='button' tabindex='0'"
      + " aria-pressed='" + (on ? 'true' : 'false') + "'" + (has ? '' : " aria-disabled='true'")
      + " data-tts-back='" + e(b.key) + "'>"
      + "<span class='tpp-back cbk-tok cbk-tok-" + e(b.key) + "'></span>"
      + "<span class='tpp-name'>" + e(b.name) + "</span></div>";
  }).join('');
  ov.innerHTML = "<div class='ed2-modal tts-modal'>"
    + "<div class='ed2-modal-head wh'><b class='wh-t'>Tabletop Simulator</b><span class='sg-head-gap'></span>"
    + "<button class='ed2-btn close-x nb nb-red nb-m wh-x' id='ttsX' onclick='ttsClose()'>Close &#10005;</button></div>"
    + "<div class='ed2-modal-body tts-body'>"
    + "<h4 class='tts-head'>Card Back</h4>"
    + "<div class='tpp-grid tpp-backs tts-backs'>" + tiles + "</div>"
    + "<div class='tts-msg' id='ttsMsg'>" + lines.map(function(l){ return "<div>" + e(l) + "</div>"; }).join('') + "</div>"
    + "<div class='tts-btns'><button class='ed2-btn primary' id='ttsGo' onclick='ttsDownload()'"
    + (_ttsCanSave(w) ? '' : ' disabled') + ">Download</button></div>"
    + "</div></div>";
  var again = hadBack ? ov.querySelector("[data-tts-back='" + hadBack + "']") : (hadId ? document.getElementById(hadId) : null);
  if(again){ try{ again.focus(); }catch(_){} }
  if(fresh && typeof modalOpen === 'function')
    modalOpen(ov, {label:'Tabletop Simulator', onClose:ttsClose, focus:ov.querySelector('[data-tts-back].on')});
}
function _ttsPick(key){
  var w = _ttsWin; if(!w) return;
  if(w.faces && !(w.backs && w.backs[key])) return;
  w.back = key;
  var ov = document.getElementById('ttsOv'); if(!ov) return;
  ov.querySelectorAll('[data-tts-back]').forEach(function(t){
    var on = t.getAttribute('data-tts-back') === key;
    t.classList.toggle('on', on); t.setAttribute('aria-pressed', on ? 'true' : 'false');
  });
  var go = document.getElementById('ttsGo'); if(go) go.disabled = !_ttsCanSave(w);
}
function ttsClose(){
  _ttsWin = null;
  var ov = document.getElementById('ttsOv'); if(!ov) return;
  if(typeof modalClose === 'function') modalClose(ov);
  ov.remove();
}
function ttsDownload(){
  var w = _ttsWin;
  if(!_ttsCanSave(w)) return;
  var items = [];
  w.items.forEach(function(it, i){ var f = w.faces[i]; if(f && f.url) items.push({card:it.card, count:it.count, url:f.url}); });
  var save = _ttsSave(DECK_NAME || 'Deck', items, w.backs[w.back]);
  if(!save) return;
  var n = save.ObjectStates[0].ContainedObjects ? save.ObjectStates[0].ContainedObjects.length : 1;
  _ttsSaveFile(JSON.stringify(save, null, 2), _ttsFileName(save.SaveName), 'application/json');
  ttsClose();
  if(typeof toast === 'function') toast('Saved ' + n + ' card' + (n === 1 ? '' : 's') + ' for Tabletop Simulator');
}
function _ttsSaveFile(data, name, type){
  var blob = new Blob([data], {type:type});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url; a.download = name;
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 5000);
}
function _ttsFileName(fallback){
  var dn = '';
  var savedInp = document.getElementById('savedNameInp');
  if(savedInp && savedInp.value.trim()) dn = savedInp.value.trim();
  if(!dn) dn = fallback || 'Deck';
  var now = new Date();
  var months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  return dn.replace(/[\\/:*?"<>|]/g,'_') + '_' + String(now.getDate()).padStart(2,'0') + months[now.getMonth()]
    + String(now.getFullYear()).slice(-2) + '_TTS.json';
}
function _ttsDesc(card){
  var typeLine = '';
  if(_catArr(card.superTypes).length) typeLine += _catArr(card.superTypes).join(' ');
  if(_catArr(card.subTypes).length) typeLine += (typeLine?' — ':'')+_catArr(card.subTypes).join(' ');
  /* cardPlainRules, not card.ruleText: a choice card's options go one to a line. */
  var rules = (typeof cardPlainRules === 'function') ? cardPlainRules(card) : (card.ruleText || '');
  return typeLine + (rules ? (typeLine ? '\n' : '') + rules : '');
}
/* items: [{card, count, url}]. One CustomDeck entry a card, its copies sharing its CardID; a deck of one card is a card. */
function _ttsSave(name, items, backUrl){
  var flip = {posX:0,posY:1,posZ:0,rotX:0,rotY:180,rotZ:180,scaleX:1,scaleY:1,scaleZ:1};
  var deck = {
    Name:'DeckCustom', Transform:flip, Nickname:name, Description:'', GMNotes:'',
    ColorDiffuse:{r:0.713,g:0.713,b:0.713},
    Locked:false, Grid:true, Snap:true, Autoraise:true, Sticky:true, Tooltip:true,
    GridProjection:false, HideWhenFaceDown:true, Hands:false, SidewaysCard:false,
    DeckIDs:[], CustomDeck:{}, ContainedObjects:[], GUID:'aaaaaa'
  };
  var n = 0;
  items.forEach(function(it, i){
    var key = String(i + 1), cardId = (i + 1) * 100;
    var face = {FaceURL:it.url, BackURL:backUrl, NumWidth:1, NumHeight:1, BackIsHidden:true, UniqueBack:false, Type:0};
    var desc = _ttsDesc(it.card);
    deck.CustomDeck[key] = face;
    for(var k = 0; k < it.count; k++){
      n++;
      var obj = {
        Name:'Card',
        Transform:{posX:0,posY:0,posZ:0,rotX:0,rotY:180,rotZ:180,scaleX:1,scaleY:1,scaleZ:1},
        Nickname:it.card.name, Description:desc, GMNotes:'',
        ColorDiffuse:{r:0.713,g:0.713,b:0.713},
        Locked:false, Grid:true, Snap:true, Autoraise:true, Sticky:true, Tooltip:true,
        GridProjection:false, HideWhenFaceDown:true, Hands:true,
        CardID:cardId, GUID:_ttsGuid(n), CustomDeck:{}
      };
      obj.CustomDeck[key] = face;
      deck.DeckIDs.push(cardId);
      deck.ContainedObjects.push(obj);
    }
  });
  if(!n) return null;
  var top = deck;
  if(n === 1){ top = deck.ContainedObjects[0]; top.Transform = flip; }
  return {
    SaveName:name,
    Date:'', VersionNumber:'', GameMode:'', GameType:'', GameComplexity:'', Tags:[],
    Gravity:0.5, PlayArea:0.5, Table:'Table_None', Sky:'Sky_Museum',
    Note:'', Rules:'', XmlUI:'', LuaScript:'', LuaScriptState:'',
    ObjectStates:[top]
  };
}

function _ttsGuid(n){
  var hex = n.toString(16);
  while(hex.length < 6) hex = '0'+hex;
  return hex.slice(-6);
}

/* No "Download Website" button: a copy of the live DOM runs start-up again and opens broken (HANDOFF §18.6). */

// Ctrl+Shift and three clicks on the wordmark, each within 2s: every card as TTS decks by colour and type, in one ZIP.
var _devClickCount = 0, _devClickTimer = null;
(function(){
  var title = document.querySelector('.hlogo, .htitle');
  if(!title) return;
  title.addEventListener('click', function(ev){
    if(!ev.ctrlKey || !ev.shiftKey) { _devClickCount=0; return; }
    /* The wordmark is a link home: without this each click also opened the front page. */
    ev.preventDefault();
    _devClickCount++;
    clearTimeout(_devClickTimer);
    _devClickTimer = setTimeout(function(){ _devClickCount=0; }, 2000);
    if(_devClickCount >= 3){
      _devClickCount = 0;
      clearTimeout(_devClickTimer);
      _devExportAll();
    }
  });
})();

function _devExportAll(){
  var buckets = {
    'Red': [], 'Orange': [], 'Yellow': [], 'Green': [], 'Blue': [], 'Indigo': [], 'Violet': [],
    'Two-Color': [], 'Three-Plus-Color': [], 'Colorless': [],
    'Core Essence': [], 'Dual Essence': [], 'Other Essence': [],
    'Uncategorized': []
  };

  CARDS.forEach(function(card){
    var st = _catArr(card.superTypes).map(function(s){return String(s).toLowerCase();});
    var isEssence = st.indexOf('essence') >= 0;
    var isCore = isEssence && st.indexOf('core') >= 0;
    var isDual = isEssence && st.indexOf('dual') >= 0;

    if(isCore){ buckets['Core Essence'].push(card); return; }
    if(isDual){ buckets['Dual Essence'].push(card); return; }
    if(isEssence){ buckets['Other Essence'].push(card); return; }

    var colors = card.colors || [];
    if(colors.length === 1){
      var c = colors[0];
      if(buckets[c]) buckets[c].push(card);
      else buckets['Uncategorized'].push(card);
    } else if(colors.length === 2){
      buckets['Two-Color'].push(card);
    } else if(colors.length >= 3){
      buckets['Three-Plus-Color'].push(card);
    } else {
      buckets['Colorless'].push(card);
    }
  });

  if(typeof window.edTtsLists !== 'function'){ alert('The editor did not load, so the Tabletop Simulator pictures cannot be found.'); return; }
  var all = CARDS.slice();
  window.edTtsLists(all).then(function(r){
    var urls = new Map(), missing = 0;
    all.forEach(function(c, i){ var f = (r.faces || [])[i]; if(f && f.url) urls.set(c, f.url); else missing++; });
    var backs = r.backs || {}, k = (typeof tdBackKind === 'function') ? tdBackKind() : '';
    var backUrl = backs[k] || backs[Object.keys(backs)[0]];
    if(!backUrl){ alert('No card backs for Tabletop Simulator yet.'); return; }
    _devExportZip(buckets, urls, backUrl, missing);
  }, function(err){
    alert('Could not find the pictures: ' + (err && err.message ? err.message : err));
  });
}
function _devExportZip(buckets, urls, backUrl, missing){
  var zipFiles = [];
  var order = ['Red','Orange','Yellow','Green','Blue','Indigo','Violet',
               'Two-Color','Three-Plus-Color','Colorless',
               'Core Essence','Dual Essence','Other Essence','Uncategorized'];
  var totalCards = 0;
  order.forEach(function(key){
    var items = buckets[key].filter(function(c){ return urls.has(c); })
      .map(function(c){ return {card:c, count:1, url:urls.get(c)}; });
    var save = _ttsSave(key, items, backUrl);
    if(!save) return;
    var json = JSON.stringify(save, null, 2);
    var data = new TextEncoder().encode(json);
    var safeName = key.replace(/[\\/:*?"<>|]/g,'_').replace(/\s+/g,'_');
    zipFiles.push({name: safeName + '_TTS.json', data: data});
    totalCards += items.length;
  });

  if(!zipFiles.length){ alert('No cards with a Tabletop Simulator picture to export.'); return; }

  function _crc32(buf){
    var t = window._crc32Table;
    if(!t){ t=[]; for(var n=0;n<256;n++){var c=n;for(var k=0;k<8;k++) c=c&1?0xEDB88320^(c>>>1):c>>>1; t[n]=c;} window._crc32Table=t; }
    var crc=0xFFFFFFFF;
    for(var i=0;i<buf.length;i++) crc=(crc>>>8)^t[(crc^buf[i])&0xFF];
    return (crc^0xFFFFFFFF)>>>0;
  }
  function _u16(v){ return [v&0xFF,(v>>8)&0xFF]; }
  function _u32(v){ return [v&0xFF,(v>>8)&0xFF,(v>>16)&0xFF,(v>>24)&0xFF]; }
  var now = new Date();
  var modTime = ((now.getHours()<<11)|(now.getMinutes()<<5)|(now.getSeconds()>>1))&0xFFFF;
  var modDate = ((((now.getFullYear()-1980)&0x7F)<<9)|((now.getMonth()+1)<<5)|now.getDate())&0xFFFF;
  var centralDir = [], localOffset = 0, parts = [];
  zipFiles.forEach(function(file){
    var nameBytes = new TextEncoder().encode(file.name);
    var data = new Uint8Array(file.data);
    var crc = _crc32(data);
    var localHeader = new Uint8Array([
      0x50,0x4B,0x03,0x04,0x0A,0x00,0x00,0x00,0x00,0x00,
      ..._u16(modTime),..._u16(modDate),
      ..._u32(crc),..._u32(data.length),..._u32(data.length),
      ..._u16(nameBytes.length),0x00,0x00
    ]);
    parts.push(localHeader, nameBytes, data);
    var cdEntry = new Uint8Array([
      0x50,0x4B,0x01,0x02,0x14,0x00,0x0A,0x00,0x00,0x00,0x00,0x00,
      ..._u16(modTime),..._u16(modDate),
      ..._u32(crc),..._u32(data.length),..._u32(data.length),
      ..._u16(nameBytes.length),
      0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,0x00,
      ..._u32(localOffset)
    ]);
    centralDir.push({entry:cdEntry, name:nameBytes});
    localOffset += localHeader.length + nameBytes.length + data.length;
  });
  var cdOffset = localOffset, cdSize = 0;
  centralDir.forEach(function(cd){ parts.push(cd.entry, cd.name); cdSize += cd.entry.length + cd.name.length; });
  parts.push(new Uint8Array([
    0x50,0x4B,0x05,0x06,0x00,0x00,0x00,0x00,
    ..._u16(zipFiles.length),..._u16(zipFiles.length),
    ..._u32(cdSize),..._u32(cdOffset),0x00,0x00
  ]));
  var totalLen = 0; parts.forEach(function(p){ totalLen += p.length; });
  var result = new Uint8Array(totalLen);
  var off = 0; parts.forEach(function(p){ result.set(p, off); off += p.length; });

  var blob = new Blob([result], {type:'application/zip'});
  var url = URL.createObjectURL(blob);
  var a = document.createElement('a');
  a.href = url;
  var months = ['JAN','FEB','MAR','APR','MAY','JUN','JUL','AUG','SEP','OCT','NOV','DEC'];
  a.download = 'Conjure_All_Cards_' + String(now.getDate()).padStart(2,'0') + months[now.getMonth()] + String(now.getFullYear()).slice(-2) + '_TTS.zip';
  document.body.appendChild(a); a.click(); document.body.removeChild(a);
  setTimeout(function(){ URL.revokeObjectURL(url); }, 5000);
  alert('Dev Export: '+totalCards+' cards across '+zipFiles.length+' decks exported.'+(missing?' '+missing+' had no Tabletop Simulator picture.':''));
}

/* Real faces through edPrintCards, in this document so its stylesheet applies; a popup of imageUrl would be bare art without the CSS. */
function printDeck(){
  var deck=deckAllEntries();
  var cardMap={};
  CARDS.forEach(function(c){ cardMap[c.name]=c; });
  var list=[];
  deck.forEach(function(entry){
    var card=cardMap[entry.name];
    if(!card) return;                      // art is not required
    for(var i=0;i<entry.count;i++) list.push(card);
  });
  if(!list.length){ alert('No cards in deck to print.'); return; }
  if(typeof window.edPrintCards==='function'){ window.edPrintCards(list); return; }
  /* Only if the editor failed to parse: the art panels, wrong but better than nothing. */
  var items=list.filter(function(c){return c.imageUrl;})
                .map(function(c){return {name:String(c.name==null?'':c.name),url:String(c.imageUrl)};});
  if(!items.length){ alert('Card faces unavailable and no art to fall back on.'); return; }
  var pw=window.open('','_blank');
  if(!pw){ alert('The browser did not open the print window. Allow pop-ups for this page, then press Print again.'); return; }
  var h='<!DOCTYPE html><html><head><title>Deck Print</title><style>';
  h+='*{margin:0;padding:0;box-sizing:border-box}body{background:#fff}';
  h+='.page{padding:6mm}.grid{display:grid;grid-template-columns:repeat(3,1fr);gap:0}';
  h+='.card{position:relative;padding:2.5mm;border:0.25mm dashed #aaa;break-inside:avoid}';
  h+='.card img{width:100%;height:auto;display:block;border-radius:0}';
  h+='.cn{font-size:5.5px;text-align:center;padding:1px 0;color:#555;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}';
  h+='@media print{@page{size:A4;margin:0}body{print-color-adjust:exact;-webkit-print-color-adjust:exact}}';
  h+='</style></head><body><div class="page"><div class="grid">';
  /* Every card field is escaped: this document runs a script. */
  items.forEach(function(item){
    h+='<div class="card"><img src="'+e(item.url)+'" alt="'+e(item.name)+'"><div class="cn">'+e(item.name)+'</div></div>';
  });
  h+='</div></div><script>var imgs=document.images,done=0,t=imgs.length;if(!t){window.print();}else{for(var i=0;i<t;i++){imgs[i].onload=imgs[i].onerror=function(){if(++done===t)window.print();};}}<\/script></body></html>';
  pw.document.write(h); pw.document.close();
}

/* On window so a check can compare it with renderManaCost(), which it must agree with. */
function manaImgHtml(mc){
  if(!mc) return '';
  var html='', i=0, s=String(mc).replace(/\s/g,'').toUpperCase();
  var SZ='width:14px;height:14px;vertical-align:middle;margin:0 1px;image-rendering:crisp-edges;outline:0.5pt solid rgba(0,0,0,0)';
  while(i<s.length){
    var ch=s[i];
    if(i+2<s.length && s[i+1]==='/'){
      var hparts=[], j=i;
      while(j<s.length && MLTR[s[j]]){
        hparts.push(s[j]);
        if(j+1<s.length && s[j+1]==='/') j+=2;
        else { j++; break; }
      }
      if(hparts.length>=2){
        var cols=hparts.map(function(c){return MLTR[c];});
        var urls=cols.map(function(c){return CICO[c]||'';});
        if(hparts.length===2){
          html+='<span style="display:inline-block;width:14px;height:14px;border-radius:50%;overflow:hidden;vertical-align:middle;margin:0 1px;position:relative;flex-shrink:0">'
               +'<img src="'+urls[0]+'" style="position:absolute;left:0;top:0;width:14px;height:14px;clip-path:polygon(0 0,100% 0,0 100%)">'
               +'<img src="'+urls[1]+'" style="position:absolute;left:0;top:0;width:14px;height:14px;clip-path:polygon(100% 0,100% 100%,0 100%)">'
               +'</span>';
        } else {
          html+='<span style="display:inline-block;width:14px;height:14px;border-radius:50%;overflow:hidden;vertical-align:middle;margin:0 1px;position:relative;flex-shrink:0">'
               +'<img src="'+urls[0]+'" style="position:absolute;left:0;top:0;width:14px;height:14px;clip-path:polygon(50% 50%,50% 0%,100% 0%,100% 50%)">'
               +'<img src="'+urls[1]+'" style="position:absolute;left:0;top:0;width:14px;height:14px;clip-path:polygon(50% 50%,100% 50%,100% 100%,0% 100%,0% 50%)">'
               +'<img src="'+urls[2]+'" style="position:absolute;left:0;top:0;width:14px;height:14px;clip-path:polygon(50% 50%,0% 50%,0% 0%,50% 0%)">'
               +'</span>';
        }
        i=j; continue;
      }
    }
    /* renderManaCost()'s tokenising: a two-digit token only for 10..20 with an icon, else single digits, or `21` prints as one bubble. */
    if(i+1<s.length && ch>='1' && ch<='2' && s[i+1]>='0' && s[i+1]<='9'){
      var two=s.substr(i,2), twoN=parseInt(two,10);
      if(twoN>=10 && twoN<=20 && NICONS[two]){
        html+='<img src="'+NICONS[two]+'" style="'+SZ+'" alt="'+two+'">';
        i+=2; continue;
      }
    }
    var numM=s.slice(i).match(/^(\d|X)/);
    if(numM){
      var nk=numM[1], nu=NICONS[nk]||'';
      if(nu) html+='<img src="'+nu+'" style="'+SZ+'" alt="'+nk+'">';
      else   html+='<span style="display:inline-flex;align-items:center;justify-content:center;width:14px;height:14px;border-radius:50%;background:#555;color:#fff;font-size:7pt;font-weight:700;vertical-align:middle;margin:0 1px">'+nk+'</span>';
      i+=nk.length; continue;
    }
    var cn=MLTR[ch];
    if(cn){ var cu=CICO[cn]||''; if(cu) html+='<img src="'+cu+'" style="'+SZ+'" alt="'+cn+'">'; }
    /* An unknown character is shown, not swallowed, so a malformed cost prints as the screen shows it. */
    else html+='<span style="font-size:7pt;vertical-align:middle;margin:0 1px">'+e(s[i])+'</span>';
    i++;
  }
  return html;
}
window.manaImgHtml=manaImgHtml;

function printPlaytest(){
  var deck=deckAllEntries();
  var cardMap={};
  CARDS.forEach(function(c){ if(c && c.name!=null) cardMap[c.name]=c; });
  var items=[];
  deck.forEach(function(entry){
    var card=cardMap[entry.name];
    if(!card) return;
    for(var i=0;i<entry.count;i++) items.push(card);
  });
  if(!items.length){ alert('No cards in deck.'); return; }
  var h=playtestSheetHtml(items);
  var pw=window.open('','_blank');
  if(!pw){ alert('The browser did not open the print window. Allow pop-ups for this page, then press Proxies again.'); return; }
  pw.document.write(h); pw.document.close();
}

/* On window so a check can lay it out. Every card field goes in as escaped text: the document runs a script of its own. */
function playtestSheetHtml(items){
  function ruleImgHtml(rt){
    if(!rt) return '';
    var esc=e(String(rt));
    esc=esc.replace(/\[\[([^\[\]\n]{1,120})\]\]/g,'<b><u>$1</u></b>');
    esc=esc.replace(/\{([^}]+)\}/g,function(_,tok){
      var t=tok.trim().toUpperCase();
      var cn=MLTR[t]; if(cn){ var cu=CICO[cn]||''; if(cu) return '<img src="'+cu+'" style="width:10px;height:10px;vertical-align:middle" alt="'+cn+'">'; }
      if(NICONS[t]) return '<img src="'+NICONS[t]+'" style="width:10px;height:10px;vertical-align:middle" alt="'+t+'">';
      return '<span style="background:#ddd;padding:0 2px;border-radius:2px;font-size:7pt">'+tok+'</span>';
    });
    return esc.replace(/\n/g,'<br>');
  }

  function statBlock(svgStr, num, lbl){
    return '<div class="pt-stat">'+svgStr
      +'<div class="pt-stat-right"><span class="pt-stat-num">'+e(String(num))+'</span>'
      +(lbl?'<span class="pt-stat-lbl">'+lbl+'</span>':'')+'</div></div>';
  }
  function svgAtk(){ return '<svg width="20" height="20" viewBox="0 0 18 18" fill="none"><rect x="4" y="4" width="10" height="10" transform="rotate(45 9 9)" stroke="#c0392b" stroke-width="3"/></svg>'; }
  function svgHp(){  return '<svg width="20" height="20" viewBox="0 0 18 18" fill="none"><polygon points="9,1 17,5 17,13 9,17 1,13 1,5" stroke="#c9a84c" stroke-width="3"/></svg>'; }
  function svgArcComboAtk(){ return '<svg width="20" height="20" viewBox="0 0 18 18" fill="none"><polyline points="1,9 9,1 17,9" stroke="#c0392b" stroke-width="3" stroke-linejoin="round"/><path d="M 2,9 A 7,7 0 0 0 16,9" stroke="#2980b9" stroke-width="3" fill="none"/></svg>'; }
  function svgArcComboHp(){  return '<svg width="20" height="20" viewBox="0 0 18 18" fill="none"><polyline points="1,9 1,5 9,1 17,5 17,9" stroke="#c9a84c" stroke-width="3" stroke-linejoin="round"/><path d="M 2,9 A 7,7 0 0 0 16,9" stroke="#2980b9" stroke-width="3" fill="none"/></svg>'; }
  function svgArcPlain(){ return '<svg width="20" height="20" viewBox="0 0 18 18" fill="none"><circle cx="9" cy="9" r="7" stroke="#2980b9" stroke-width="3"/></svg>'; }
  function svgRng(){ return '<svg width="20" height="20" viewBox="0 0 18 18" fill="none"><polygon points="9,2 16,15 2,15" stroke="#5c9e6e" stroke-width="3" stroke-linejoin="round"/></svg>'; }

  /* 14pt and 32pt on purpose: nine true-size cards with 3pt gaps are 546 x 762pt, and less than 548 x 764pt of Letter makes the browser shrink them. */
  var h='<!DOCTYPE html><html><head><meta charset="utf-8"><title>Playtest Cards</title><style>';
  h+='*{margin:0;padding:0;box-sizing:border-box}';
  h+='body{background:#fff;font-family:Arial,Helvetica,sans-serif}';
  h+='.page{display:grid;grid-template-columns:repeat(3,2.5in);grid-template-rows:repeat(3,3.5in);gap:3pt;padding:14pt 32pt;background:#fff}';
  h+='.pt-card{width:2.5in;height:3.5in;position:relative;overflow:hidden;background:#fff}';
  // Black cut border — z-index:0 so content renders on top (mana cost not covered)
  h+='.pt-l1{position:absolute;inset:0;border:4pt solid #1a1a1a;pointer-events:none;z-index:0}';
  // Content: 8pt inset (4pt border + 4pt gap) — NO overflow:hidden here so pip outlines aren't clipped
  h+='.pt-content{position:absolute;inset:8pt;display:flex;flex-direction:column}';
  h+='.pt-top{display:flex;align-items:center;gap:3pt;padding-bottom:2pt;border-bottom:0.75pt solid #333;min-height:0;flex-shrink:0}';
  h+='.pt-mana{flex-shrink:0;max-width:55%;line-height:1;display:flex;flex-wrap:wrap;gap:1px;align-items:center}';
  h+='.pt-mana img{width:14px;height:14px;vertical-align:middle;border-radius:50%;box-shadow:0 0 0 1pt #111;margin:0 1px;image-rendering:crisp-edges}';
  h+='.pt-name{flex:1;font-weight:700;text-align:right;line-height:1.1;word-break:break-word;min-width:0;font-size:9pt;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}';
  h+='.pt-type{font-size:7.5pt;color:#333;font-style:italic;padding:2pt 0;border-bottom:0.75pt solid #333;flex-shrink:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}';
  h+='.pt-stats{display:flex;flex-direction:column;gap:3pt;padding:2pt 0;flex-shrink:0}';
  h+='.pt-stat{display:flex;align-items:center;gap:3pt}';
  h+='.pt-stat-right{display:flex;flex-direction:column;align-items:flex-start}';
  h+='.pt-stat-num{font-size:8pt;font-weight:700;line-height:1}';
  h+='.pt-stat-lbl{font-size:4pt;color:#555;letter-spacing:.04em;line-height:1}';
  h+='.pt-body{flex:1;display:flex;flex-direction:column;justify-content:flex-end;overflow:hidden;min-height:0}';
  h+='.pt-rules-wrap{border-top:0.75pt solid #333;padding-top:2pt}';
  h+='.pt-rules{font-size:8.7pt;line-height:1.35;color:#111;word-break:break-word;overflow:hidden}';
  h+='@media print{'
    +'@page{size:letter;margin:14pt 32pt}'
    +'body,html{print-color-adjust:exact;-webkit-print-color-adjust:exact}'
    +'body{background:#fff;margin:0}'
    +'.page{break-after:page;padding:0;margin:0}'
    +'}';
  var fitScript='window.addEventListener("load",function(){'
    +'document.querySelectorAll(".pt-rules").forEach(function(el){'
    +'  var body=el.closest(".pt-body");'
    +'  if(!body) return;'
    +'  var pts=8.7;'
    +'  for(var attempt=0;attempt<60&&el.scrollHeight>body.clientHeight+1;attempt++){'
    +'    pts=Math.max(4,pts-0.3);'
    +'    el.style.fontSize=pts+"pt";'
    +'  }'
    +'  if(el.scrollHeight>body.clientHeight+1){el.style.overflow="hidden";el.innerHTML+="<span style=color:#888;font-size:7pt> [...]</span>";}'
    +'});'
    +'document.querySelectorAll(".pt-type").forEach(function(el){'
    +'  var sz=7.5;'
    +'  while(el.scrollWidth>el.clientWidth+1&&sz>5){'
    +'    sz=Math.max(5,sz-0.2);'
    +'    el.style.fontSize=sz+"pt";'
    +'  }'
    +'});'
    +'document.querySelectorAll(".pt-top").forEach(function(row){'
    +'  var nameEl=row.querySelector(".pt-name");'
    +'  if(!nameEl) return;'
    +'  var sz=9;'
    +'  while(row.scrollWidth>row.clientWidth+2&&sz>5){'
    +'    sz=Math.max(5,sz-0.3);'
    +'    nameEl.style.fontSize=sz+"pt";'
    +'  }'
    +'});'
    +'});';
  h+='</style><script>'+fitScript+'<\/script></head><body>';

  var ESSENCE_COLOR_MAP = {
    'Ire':'Red','Vig':'Orange','Lux':'Yellow',
    'Arch':'Green','Yune':'Blue','Psy':'Indigo','Gris':'Violet'
  };

  for(var pi=0; pi<items.length; pi+=9){
    var pageItems = items.slice(pi, pi+9);
    h+='<div class="page">';
    pageItems.forEach(function(card){
      var superArr = _catArr(card.superTypes).map(function(s){return String(s).toLowerCase();});
      var subsList  = _catArr(card.subTypes);
      var supers = _catArr(card.superTypes).join(' ').trim();
      var subs   = subsList.join(' ').trim();
      var typeLine = supers+(subs?' \u2014 '+subs:'');

      var isEssence     = superArr.indexOf('essence') >= 0;
      var isCoreEssence = isEssence && superArr.indexOf('core') >= 0;
      var isDualEssence = isEssence && superArr.indexOf('dual') >= 0;

      // Resolved now: CICO exists in this page, not in the printed document.
      var essenceImgHtml = '';
      if(isCoreEssence || isDualEssence){
        var matchedImgs = [];
        subsList.forEach(function(st){
          var colorName = ESSENCE_COLOR_MAP[st];
          var url = colorName ? (CICO[colorName]||'') : '';
          if(url && matchedImgs.length < (isDualEssence ? 2 : 1)){
            var sz = isCoreEssence ? '90px' : '65px';
            matchedImgs.push('<img src="'+url+'" style="width:'+sz+';height:'+sz+';image-rendering:crisp-edges;margin:0 6pt;display:block">');
          }
        });
        if(matchedImgs.length){
          essenceImgHtml = '<div style="flex:1;display:flex;align-items:center;justify-content:center">'
            + matchedImgs.join('') + '</div>';
        }
      }
      if(isEssence && !essenceImgHtml){
        essenceImgHtml = '<div style="flex:1"></div>';
      }

      var arcS=String(card.arcane||''), arcU=arcS.toUpperCase();
      var showAtk=card.attack&&!arcU.endsWith('A');
      var showHp =card.health&&!arcU.endsWith('H');
      var statsHtml='';
      if(!isEssence){
        if(showAtk) statsHtml+=statBlock(svgAtk(), card.attack, 'ATK');
        if(showHp)  statsHtml+=statBlock(svgHp(),  card.health, 'HP');
        if(card.arcane){
          var arcNum=arcU.endsWith('A')||arcU.endsWith('H') ? arcS.slice(0,-1) : arcS;
          var arcLbl=arcU.endsWith('A')?'ARC/ATK':arcU.endsWith('H')?'ARC/HP':'ARC';
          var arcSvg=arcU.endsWith('A')?svgArcComboAtk():arcU.endsWith('H')?svgArcComboHp():svgArcPlain();
          statsHtml+=statBlock(arcSvg, arcNum, arcLbl);
        }
        if(card.range) statsHtml+=statBlock(svgRng(), card.range, 'RNG');
      }

      var nameAlign = isEssence ? 'text-align:center;flex:1;width:100%' : '';
      var typeAlign = isEssence ? 'text-align:center' : '';
      var topJust   = isEssence ? 'justify-content:center' : '';

      h+='<div class="pt-card">';
      h+='<div class="pt-l1"></div>';
      h+='<div class="pt-content">';
      h+='<div class="pt-top"'+(topJust?' style="'+topJust+'"':'')+'>'+
          '<div class="pt-mana">'+manaImgHtml(card.manaCost)+'</div>'+
          '<div class="pt-name"'+(nameAlign?' style="'+nameAlign+'"':'')+'>'+e(String(card.name==null?'':card.name))+'</div>'+
         '</div>';
      h+='<div class="pt-type"'+(typeAlign?' style="'+typeAlign+'"':'')+'>'+(typeLine ? e(typeLine) : '&nbsp;')+'</div>';
      if(isEssence){
        h+=essenceImgHtml;
      } else {
        if(statsHtml) h+='<div class="pt-stats">'+statsHtml+'</div>';
        h+='<div class="pt-body"><div class="pt-rules-wrap"><div class="pt-rules">'+ruleImgHtml(card.ruleText)+'</div></div></div>';
      }
      h+='</div></div>';
    });
    h+='</div>';
  }
  h+='<script>var imgs=document.images,done=0,t=imgs.length;'
    +'function tryPrint(){if(++done===t)window.print();}'
    +'if(!t){window.print();}else{for(var i=0;i<t;i++){imgs[i].onload=tryPrint;imgs[i].onerror=tryPrint;}}'
    +'<\/script></body></html>';
  return h;
}
window.playtestSheetHtml = playtestSheetHtml;


// Header tie-breakers only (the primary sort is cat_tail.js's _sortPrimary); comparators live only in SORT_DEFS.
var sortCols = [];


