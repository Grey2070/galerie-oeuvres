// Espace exposant : connexion, ajout / modification / retrait des œuvres, QR codes.
(function () {
  'use strict';

  var main = document.getElementById('main');
  var nav = document.getElementById('nav');
  var reduced = false;
  try { reduced = matchMedia('(prefers-reduced-motion: reduce)').matches; } catch (e) {}

  var S = { view: 'loading', works: [], draft: null, editId: null, confirmId: null, busy: false };

  function $(s, r) { return (r || document).querySelector(s); }
  function esc(s) { return String(s == null ? '' : s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function pad(n) { return n < 10 ? '0' + n : String(n); }
  function find(id) { for (var i = 0; i < S.works.length; i++) if (S.works[i].id === id) return S.works[i]; return null; }
  function thumbUrl(w) { return '/img/' + w.id + '/' + w.v + '-s.jpg'; }
  function qrUrl(w) { return location.origin + '/o/' + w.id; }

  /* ---------- API ---------- */
  function api(path, opts) {
    opts = opts || {};
    opts.credentials = 'same-origin';
    return fetch(path, opts).then(function (res) {
      return res.json().catch(function () { return {}; }).then(function (body) {
        if (res.status === 401 && path !== '/api/login') {
          S.view = 'login'; render(true);
          throw new Error(body.error || 'Session expirée. Reconnectez-vous.');
        }
        if (!res.ok) throw new Error(body.error || 'Le serveur n’a pas répondu (' + res.status + ').');
        return body;
      });
    }, function () { throw new Error('Connexion impossible. Vérifiez le réseau puis réessayez.'); });
  }

  /* ---------- Rendering ---------- */
  var swapT = null;
  function render(instant) {
    nav.hidden = !(S.view === 'add' || S.view === 'edit' || S.view === 'list');
    Array.prototype.forEach.call(nav.querySelectorAll('[data-view]'), function (b) {
      var v = b.getAttribute('data-view');
      if (v === S.view) b.setAttribute('aria-current', 'page'); else b.removeAttribute('aria-current');
    });
    var paint = function () {
      main.innerHTML = view();
      if (S.view === 'add' || S.view === 'edit') bindForm();
      if (S.view === 'login') { var p = $('#pw'); if (p) p.focus(); }
    };
    if (instant || reduced) { clearTimeout(swapT); main.classList.remove('leaving'); paint(); return; }
    clearTimeout(swapT);
    main.classList.add('leaving');
    swapT = setTimeout(function () {
      paint();
      try { window.scrollTo(0, 0); } catch (e) {}
      requestAnimationFrame(function () { main.classList.remove('leaving'); });
    }, 300);
  }

  function view() {
    switch (S.view) {
      case 'setup': return viewSetup();
      case 'login': return viewLogin();
      case 'list': return viewList();
      case 'add': case 'edit': return viewForm();
      default: return '<section class="empty"><p class="hint">Chargement…</p></section>';
    }
  }

  function viewSetup() {
    return '<section class="panel enter"><header><p class="eyebrow">Espace exposant</p><h1 class="script">Une dernière étape</h1></header>' +
      '<p>Le mot de passe de l’espace exposant n’est pas encore défini. Dans Netlify, ouvrez votre site, puis <em>Project configuration › Environment variables</em>, ajoutez la variable <strong>ADMIN_PASSWORD</strong> avec le mot de passe de votre choix, et redéployez le site.</p>' +
      '<p class="hint">Une fois le site redéployé, rechargez cette page.</p></section>';
  }

  function viewLogin() {
    return '<section class="panel enter" style="max-width:26rem"><header><p class="eyebrow">Espace exposant</p><h1 class="script">Bienvenue</h1></header>' +
      '<form class="form" id="loginForm" novalidate><div class="field"><label for="pw">Mot de passe</label><input id="pw" type="password" autocomplete="current-password" required></div>' +
      '<p class="err" id="loginErr" hidden></p><div class="actions"><button class="btn" type="submit">Entrer</button></div></form></section>';
  }

  function viewList() {
    var ws = S.works;
    var head = '<section class="panel wide"><div class="toolbar enter"><header><p class="eyebrow">' + ws.length + ' œuvre' + (ws.length > 1 ? 's' : '') + ' exposée' + (ws.length > 1 ? 's' : '') + '</p><h1 class="script">Les œuvres</h1></header>' +
      '<div class="actions">' + (ws.length ? '<button class="btn ghost" type="button" data-act="print-all">Imprimer tous les QR codes</button>' : '') + '<button class="linkbtn" type="button" data-act="logout">Se déconnecter</button></div></div>';
    if (!ws.length) {
      return head + '<div class="empty enter" style="padding-block:2rem"><p>Aucune œuvre exposée pour l’instant.</p><button class="btn" type="button" data-act="view" data-view="add">Ajouter la première œuvre</button></div></section>';
    }
    var rows = ws.map(function (w, i) {
      var sub = [w.artist, w.year].filter(Boolean).map(esc).join(', ');
      var price = w.sold ? '<span class="dot" aria-hidden="true"></span> Vendue' : (w.price ? esc(w.price) : '<em>Prix sur demande</em>');
      var confirm = S.confirmId === w.id
        ? '<div class="confirm"><p>Retirer définitivement « ' + esc(w.title) + ' » ? Sa page et son QR code ne mèneront plus à rien.</p><button class="btn danger" type="button" data-act="delete-yes" data-id="' + w.id + '">Retirer l’œuvre</button><button class="btn ghost" type="button" data-act="delete-no">Annuler</button></div>'
        : '';
      return '<li style="--i:' + Math.min(i, 12) + '"><a class="thumb" href="' + esc(w.path) + '" target="_blank" rel="noopener"><img src="' + thumbUrl(w) + '" alt="" loading="lazy"></a>' +
        '<div class="meta"><p class="no">N° ' + pad(w.n) + '</p><p class="script t">' + esc(w.title) + '</p><p class="sub">' + (sub ? '<span>' + sub + '</span>' : '') + '<span>' + price + '</span></p></div>' +
        '<div class="acts"><button class="linkbtn" type="button" data-act="qr" data-id="' + w.id + '">QR code</button><button class="linkbtn" type="button" data-act="edit" data-id="' + w.id + '">Modifier</button>' +
        '<button class="linkbtn" type="button" data-act="sold" data-id="' + w.id + '">' + (w.sold ? 'Remettre en vente' : 'Marquer vendue') + '</button>' +
        '<a class="linkbtn" href="' + esc(w.path) + '" target="_blank" rel="noopener">Voir</a><button class="linkbtn danger" type="button" data-act="delete" data-id="' + w.id + '">Retirer</button></div>' + confirm + '</li>';
    }).join('');
    return head + '<ol class="rows enter" style="--i:1">' + rows + '</ol></section>';
  }

  function blankDraft(w) {
    return {
      forId: w ? w.id : null, img: w ? '/img/' + w.id + '/' + w.v + '.jpg' : '', newImage: null, newThumb: null, w: w ? w.w : 0, h: w ? w.h : 0,
      title: w ? w.title : '', artist: w ? w.artist : '', year: w ? w.year : '', technique: w ? w.technique : '', dims: w ? w.dims : '',
      desc: w ? w.desc : '', price: w ? w.price : '', sold: w ? !!w.sold : false, err: {}
    };
  }

  function viewForm() {
    var w = S.view === 'edit' ? find(S.editId) : null;
    if (S.view === 'edit' && !w) { S.view = 'list'; return viewList(); }
    if (!S.draft || S.draft.forId !== (w ? w.id : null)) S.draft = blankDraft(w);
    var d = S.draft, e = d.err || {};
    function f(key, label, ph, extra) {
      return '<div class="field"><label for="f-' + key + '">' + label + '</label><input id="f-' + key + '" name="' + key + '" value="' + esc(d[key]) + '" placeholder="' + esc(ph) + '" autocomplete="off"' + (extra || '') + '>' + (e[key] ? '<p class="err">' + e[key] + '</p>' : '') + '</div>';
    }
    var zone = d.img
      ? '<div class="zone-preview"><img src="' + esc(d.img) + '" alt="Aperçu de la photo"><div class="picks"><label class="btn ghost" for="in-cam">Reprendre la photo</label><label class="btn ghost" for="in-lib">Choisir une autre photo</label></div></div>'
      : '<div class="zone-empty"><p class="script">La photo de l’œuvre</p><p>Photographiez l’œuvre de face, en lumière douce, sans reflet.</p><div class="picks"><label class="btn" for="in-cam">Prendre une photo</label><label class="btn ghost" for="in-lib">Choisir dans la photothèque</label></div></div>';
    return '<section class="panel"><header class="enter"><p class="eyebrow">' + (w ? 'N° ' + pad(w.n) : 'Nouvel accrochage') + '</p><h1 class="script">' + (w ? 'Modifier l’œuvre' : 'Ajouter une œuvre') + '</h1></header>' +
      '<form id="wf" class="form enter" style="--i:1" novalidate>' +
      '<div class="zone" id="zone">' + zone + '<input type="file" id="in-cam" accept="image/*" capture="environment" hidden><input type="file" id="in-lib" accept="image/*" hidden></div>' +
      (e.img ? '<p class="err">' + e.img + '</p>' : '') +
      f('title', 'Titre de l’œuvre', 'Jardin d’hiver') +
      '<div class="row">' + f('artist', 'Artiste', 'Facultatif') + f('year', 'Année', 'Facultatif', ' inputmode="numeric"') + '</div>' +
      '<div class="row">' + f('technique', 'Technique', 'Huile sur toile') + f('dims', 'Dimensions', '80 × 60 cm') + '</div>' +
      '<div class="field"><label for="f-desc">Description</label><textarea id="f-desc" name="desc" placeholder="Ce que le visiteur lira sous la photo">' + esc(d.desc) + '</textarea><p class="hint">Quelques phrases suffisent ; elles servent aussi aux moteurs de recherche.</p></div>' +
      '<div class="field"><label for="f-price">Prix</label><input id="f-price" name="price" value="' + esc(d.price) + '" placeholder="2 400 €" autocomplete="off"><p class="hint">Laissez vide pour afficher « Sur demande ».</p></div>' +
      '<label class="check" for="f-sold"><input type="checkbox" id="f-sold" name="sold"' + (d.sold ? ' checked' : '') + '> Œuvre vendue <span class="dot" aria-hidden="true"></span></label>' +
      '<div class="actions"><button class="btn" type="submit">' + (w ? 'Publier les modifications' : 'Exposer l’œuvre et créer son QR code') + '</button>' +
      (w ? '<button class="btn ghost" type="button" data-act="view" data-view="list">Annuler</button>' : '') + '</div></form></section>';
  }

  /* ---------- Form ---------- */
  function bindForm() {
    var form = $('#wf'), zone = $('#zone');
    if (!form) return;
    form.addEventListener('input', function (ev) {
      var t = ev.target; if (!t.name || !S.draft) return;
      S.draft[t.name] = t.type === 'checkbox' ? t.checked : t.value;
    });
    form.addEventListener('change', function (ev) {
      var t = ev.target;
      if (t.type === 'file' && t.files && t.files[0]) { takeFile(t.files[0]); t.value = ''; }
      else if (t.type === 'checkbox' && S.draft) S.draft.sold = t.checked;
    });
    form.addEventListener('submit', onSubmit);
    ['dragenter', 'dragover'].forEach(function (n) { zone.addEventListener(n, function (ev) { ev.preventDefault(); zone.classList.add('over'); }); });
    ['dragleave', 'drop'].forEach(function (n) { zone.addEventListener(n, function (ev) { ev.preventDefault(); zone.classList.remove('over'); }); });
    zone.addEventListener('drop', function (ev) { var f = ev.dataTransfer && ev.dataTransfer.files && ev.dataTransfer.files[0]; if (f) takeFile(f); });
  }

  function readFields() {
    var form = $('#wf'); if (!form || !S.draft) return;
    ['title', 'artist', 'year', 'technique', 'dims', 'desc', 'price'].forEach(function (k) { var el = form.elements[k]; if (el) S.draft[k] = el.value; });
    var s = $('#f-sold'); if (s) S.draft.sold = s.checked;
  }

  function loadImage(src) { return new Promise(function (res, rej) { var i = new Image(); i.onload = function () { res(i); }; i.onerror = rej; i.src = src; }); }
  function fileToDataURL(file) { return new Promise(function (res, rej) { var r = new FileReader(); r.onload = function () { res(r.result); }; r.onerror = rej; r.readAsDataURL(file); }); }
  function toBlob(canvas, q) { return new Promise(function (res) { canvas.toBlob(res, 'image/jpeg', q); }); }

  // Resize in the browser: a large photo for the work page and a lighter one for the gallery.
  function encode(img, maxSide, quality, maxBytes) {
    var c = document.createElement('canvas'), x = c.getContext('2d'), q = quality, max = maxSide;
    function attempt(tries) {
      var s = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight));
      var w = Math.max(1, Math.round(img.naturalWidth * s)), h = Math.max(1, Math.round(img.naturalHeight * s));
      c.width = w; c.height = h; x.fillStyle = '#ffffff'; x.fillRect(0, 0, w, h); x.imageSmoothingQuality = 'high'; x.drawImage(img, 0, 0, w, h);
      return toBlob(c, q).then(function (b) {
        if (!b) throw new Error('encode');
        if (b.size <= maxBytes || tries > 6) return { blob: b, w: w, h: h };
        if (q > 0.7) q -= 0.06; else max = Math.round(max * 0.85);
        return attempt(tries + 1);
      });
    }
    return attempt(0);
  }

  function takeFile(file) {
    if (file.type && !/^image\//.test(file.type)) { toast('Ce fichier n’est pas une image.'); return; }
    readFields();
    var zone = $('#zone'); if (zone) zone.querySelector('.zone-preview, .zone-empty').innerHTML = '<p class="hint">Préparation de la photo…</p>';
    var obj = null;
    var get;
    try { obj = URL.createObjectURL(file); get = loadImage(obj); } catch (e) { get = Promise.reject(e); }
    get.catch(function () { return fileToDataURL(file).then(loadImage); }).then(function (img) {
      return Promise.all([encode(img, 1400, 0.82, 380000), encode(img, 640, 0.78, 75000)]);
    }).then(function (r) {
      if (obj) try { URL.revokeObjectURL(obj); } catch (e) {}
      S.draft.newImage = r[0].blob; S.draft.newThumb = r[1].blob; S.draft.w = r[0].w; S.draft.h = r[0].h;
      if (S.draft.preview) try { URL.revokeObjectURL(S.draft.preview); } catch (e) {}
      S.draft.preview = URL.createObjectURL(r[0].blob);
      S.draft.img = S.draft.preview;
      S.draft.err.img = '';
      render(true);
    }).catch(function () {
      toast('Impossible de lire cette photo. Essayez une image JPEG ou PNG.');
      render(true);
    });
  }

  function onSubmit(ev) {
    ev.preventDefault();
    if (S.busy) return;
    readFields();
    var d = S.draft; d.err = {};
    var editing = !!d.forId;
    if (!editing && !d.newImage) d.err.img = 'Ajoutez une photo de l’œuvre.';
    if (!String(d.title).trim()) d.err.title = 'Indiquez le titre de l’œuvre.';
    if (d.err.img || d.err.title) { render(true); var first = $('.err'); if (first) first.scrollIntoView({ behavior: reduced ? 'auto' : 'smooth', block: 'center' }); return; }

    var fd = new FormData();
    ['title', 'artist', 'year', 'technique', 'dims', 'desc', 'price'].forEach(function (k) { fd.append(k, String(d[k] || '').trim()); });
    fd.append('sold', d.sold ? '1' : '0');
    if (d.newImage) {
      fd.append('image', d.newImage, 'oeuvre.jpg');
      fd.append('thumb', d.newThumb || d.newImage, 'vignette.jpg');
      fd.append('w', String(d.w)); fd.append('h', String(d.h));
    }
    busy(true);
    api(editing ? '/api/works/' + d.forId : '/api/works', { method: 'POST', body: fd }).then(function (res) {
      var w = res.work;
      var i = S.works.findIndex(function (x) { return x.id === w.id; });
      if (i >= 0) S.works[i] = w; else S.works.push(w);
      S.works.sort(function (a, b) { return a.n - b.n; });
      if (d.preview) try { URL.revokeObjectURL(d.preview); } catch (e) {}
      S.draft = null;
      busy(false);
      if (editing) { S.view = 'list'; render(); toast('Modifications publiées'); }
      else { S.view = 'add'; render(true); window.scrollTo(0, 0); toast('Œuvre exposée'); setTimeout(function () { openQR(w.id); }, 250); }
    }).catch(function (err) { busy(false); toast(err.message); });
  }

  /* ---------- Layers ---------- */
  var layerEl = null;
  function openLayer(cls, html) {
    closeLayer(true);
    var el = document.createElement('div');
    el.className = 'layer ' + (cls || ''); el.innerHTML = html;
    $('#layerHost').appendChild(el); layerEl = el;
    requestAnimationFrame(function () { requestAnimationFrame(function () { el.classList.add('on'); }); });
    return el;
  }
  function closeLayer(now) {
    var el = layerEl; if (!el) return; layerEl = null;
    if (now || reduced) { el.remove(); return; }
    el.classList.remove('on'); setTimeout(function () { el.remove(); }, 460);
  }
  function busy(on) {
    S.busy = on;
    if (on) openLayer('busy-layer', '<div class="busy"><p class="script">Un instant…</p><p>Publication en cours</p><div class="pen"></div></div>');
    else if (layerEl && layerEl.classList.contains('busy-layer')) closeLayer();
  }
  var toastT = null;
  function toast(msg) {
    var t = $('#toast'); t.textContent = msg; t.classList.add('on');
    clearTimeout(toastT); toastT = setTimeout(function () { t.classList.remove('on'); }, 4000);
  }
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape' && layerEl && !layerEl.classList.contains('busy-layer')) closeLayer(); });

  /* ---------- QR codes ---------- */
  function ensureQrLib() {
    if (window.qrcode) return Promise.resolve(true);
    return new Promise(function (res) {
      var s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js';
      s.onload = function () { res(!!window.qrcode); }; s.onerror = function () { res(false); }; document.head.appendChild(s);
    });
  }
  var fontsReady = null;
  function loadFonts() {
    if (!fontsReady) {
      try {
        fontsReady = Promise.all([document.fonts.load('84px "Pinyon Script"'), document.fonts.load('500 30px "EB Garamond"'), document.fonts.load('italic 36px "EB Garamond"')]).catch(function () {});
      } catch (e) { fontsReady = Promise.resolve(); }
    }
    return fontsReady;
  }
  function fitFont(x, text, family, size, maxW, style) {
    do { x.font = (style || '') + ' ' + size + 'px ' + family; size -= 2; } while (x.measureText(text).width > maxW && size > 24);
  }
  // Square of modules left blank in the middle of the code: about a quarter of
  // its width (≈7 % of its area), well inside what level H can recover.
  function qrHole(m) {
    var n = Math.round(m * 0.25);
    if ((m - n) % 2) n += 1;
    var a = (m - n) / 2;
    return { a: a, b: a + n };
  }
  // The catalogue number set in the blank square, framed like a small cartel.
  function drawBadge(x, label, bx, by, side, cell) {
    var inset = Math.round(cell * 0.6), cx = bx + side / 2;
    x.fillStyle = '#ffffff'; x.fillRect(bx, by, side, side);
    x.strokeStyle = '#23304c'; x.lineWidth = Math.max(2, Math.round(cell / 4));
    x.strokeRect(bx + inset, by + inset, side - 2 * inset, side - 2 * inset);
    var inner = side - 2 * inset;
    x.fillStyle = '#6c6762'; x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    var small = Math.round(inner * 0.2);
    x.font = '500 ' + small + 'px "EB Garamond", Garamond, serif';
    x.fillText('N°', cx, by + inset + inner * 0.3);
    x.fillStyle = '#1c1b1f';
    var size = Math.round(inner * 0.56);
    do { x.font = '500 ' + size + 'px "EB Garamond", Garamond, serif'; size -= 2; } while (x.measureText(label).width > inner * 0.84 && size > 12);
    x.fillText(label, cx, by + inset + inner * 0.82);
  }
  // A printable cartel: catalogue number, title, artist, QR code.
  function drawCartel(w) {
    var W = 1000, H = 1300, c = document.createElement('canvas'), x = c.getContext('2d');
    c.width = W; c.height = H;
    x.fillStyle = '#ffffff'; x.fillRect(0, 0, W, H);
    x.textAlign = 'center'; x.textBaseline = 'alphabetic';
    x.fillStyle = '#6c6762'; x.font = '500 30px "EB Garamond", Garamond, serif';
    if ('letterSpacing' in x) x.letterSpacing = '6px';
    x.fillText('N° ' + pad(w.n), W / 2, 118);
    if ('letterSpacing' in x) x.letterSpacing = '0px';
    x.fillStyle = '#23304c'; fitFont(x, w.title, '"Pinyon Script", cursive', 84, 860);
    x.fillText(w.title, W / 2, 220);
    var y = 226;
    if (w.artist) { x.fillStyle = '#1c1b1f'; fitFont(x, w.artist, '"EB Garamond", Garamond, serif', 36, 860, 'italic'); x.fillText(w.artist, W / 2, 280); y = 280; }
    // Level H error correction lets the centre carry the catalogue number and still scan.
    var q = window.qrcode(0, 'H'); q.addData(qrUrl(w)); q.make();
    var m = q.getModuleCount(), size = 600, cell = Math.floor(size / m), qs = cell * m, ox = Math.round((W - qs) / 2), oy = y + 50 + Math.round((size - qs) / 2);
    var hole = qrHole(m);
    x.fillStyle = '#1c1b1f';
    for (var r = 0; r < m; r++) for (var k = 0; k < m; k++) {
      if (r >= hole.a && r < hole.b && k >= hole.a && k < hole.b) continue;
      if (q.isDark(r, k)) x.fillRect(ox + k * cell, oy + r * cell, cell, cell);
    }
    drawBadge(x, String(pad(w.n)), ox + hole.a * cell, oy + hole.a * cell, (hole.b - hole.a) * cell, cell);
    var ly = y + 50 + size + 64;
    x.strokeStyle = '#e9e6e1'; x.lineWidth = 2;
    x.beginPath(); x.moveTo(W / 2 - 200, ly); x.lineTo(W / 2 - 18, ly); x.moveTo(W / 2 + 18, ly); x.lineTo(W / 2 + 200, ly); x.stroke();
    x.save(); x.translate(W / 2, ly); x.rotate(Math.PI / 4); x.strokeStyle = '#23304c'; x.strokeRect(-6, -6, 12, 12); x.restore();
    x.fillStyle = '#6c6762'; x.font = 'italic 36px "EB Garamond", Garamond, serif';
    x.fillText('Scannez pour découvrir l’œuvre', W / 2, ly + 70);
    return c.toDataURL('image/png');
  }
  function cartels(ids) {
    return Promise.all([ensureQrLib(), loadFonts()]).then(function (r) {
      if (!r[0]) throw new Error('Le générateur de QR code n’a pas pu se charger. Vérifiez la connexion.');
      return ids.map(function (id) { return drawCartel(find(id)); });
    });
  }

  function openQR(id) {
    var w = find(id); if (!w) return;
    var url = qrUrl(w);
    var el = openLayer('', '<div class="sheet" role="dialog" aria-modal="true" aria-labelledby="qr-h"><button class="x" type="button" data-act="close" aria-label="Fermer">×</button>' +
      '<p class="eyebrow">QR code · N° ' + pad(w.n) + '</p><h2 class="script" id="qr-h">' + esc(w.title) + '</h2>' +
      '<div class="qr-frame" id="qr-frame"><span class="wait">Préparation…</span></div>' +
      '<div class="qr-url"><input id="qr-url" readonly value="' + esc(url) + '" aria-label="Lien de l’œuvre"></div>' +
      '<div class="qr-actions"><a class="btn" id="qr-dl" download="QR-oeuvre-' + pad(w.n) + '.png" href="#" aria-disabled="true">Télécharger</a>' +
      '<button class="btn ghost" type="button" data-act="print-one" data-id="' + w.id + '">Imprimer</button>' +
      '<button class="btn ghost" type="button" data-act="copy">Copier le lien</button></div>' +
      '<p class="hint">Le QR code mène directement à la page de l’œuvre.</p></div>');
    el.addEventListener('click', onLayerClick);
    cartels([w.id]).then(function (urls) {
      var frame = $('#qr-frame', el); if (!frame) return;
      var img = new Image(); img.alt = 'QR code de l’œuvre ' + w.title; img.src = urls[0];
      frame.innerHTML = ''; frame.appendChild(img);
      var dl = $('#qr-dl', el); dl.href = urls[0]; dl.removeAttribute('aria-disabled');
    }).catch(function (e) { var frame = $('#qr-frame', el); if (frame) frame.innerHTML = '<span class="wait">' + esc(e.message) + '</span>'; });
  }
  function onLayerClick(e) {
    var el = e.currentTarget;
    var b = e.target.closest('[data-act]');
    if (!b) { if (e.target === el) closeLayer(); return; }
    var act = b.getAttribute('data-act');
    if (act === 'close') closeLayer();
    else if (act === 'copy') {
      var inp = $('#qr-url', el);
      var fail = function () { try { inp.focus(); inp.select(); } catch (x) {} toast('Sélectionnez le lien puis copiez-le.'); };
      try { navigator.clipboard.writeText(inp.value).then(function () { toast('Lien copié'); }, fail); } catch (x) { fail(); }
    } else if (act === 'print-one') printCartels([b.getAttribute('data-id')]);
  }
  function printCartels(ids) {
    toast(ids.length > 1 ? 'Préparation de la planche…' : 'Préparation de l’impression…');
    cartels(ids).then(function (urls) {
      var sheet = $('#printSheet');
      sheet.className = ids.length > 1 ? '' : 'one';
      sheet.innerHTML = urls.map(function (u) { return '<img src="' + u + '" alt="">'; }).join('');
      document.body.classList.add('printing');
      var done = function () { document.body.classList.remove('printing'); sheet.innerHTML = ''; window.removeEventListener('afterprint', done); };
      window.addEventListener('afterprint', done);
      setTimeout(function () { window.print(); setTimeout(done, 1500); }, 200);
    }).catch(function (e) { toast(e.message); });
  }

  /* ---------- Actions ---------- */
  document.addEventListener('click', function (e) {
    var b = e.target.closest('[data-act]');
    if (!b || b.closest('.layer')) return;
    var act = b.getAttribute('data-act'), id = b.getAttribute('data-id');
    if (act === 'view') { S.view = b.getAttribute('data-view'); S.confirmId = null; if (S.view === 'add') S.draft = null; render(); }
    else if (act === 'qr') openQR(id);
    else if (act === 'edit') { S.view = 'edit'; S.editId = id; S.draft = null; render(); }
    else if (act === 'delete') { S.confirmId = id; render(true); }
    else if (act === 'delete-no') { S.confirmId = null; render(true); }
    else if (act === 'delete-yes') {
      busy(true);
      api('/api/works/' + id, { method: 'DELETE' }).then(function () {
        S.works = S.works.filter(function (w) { return w.id !== id; }); S.confirmId = null; busy(false); render(true); toast('Œuvre retirée de l’exposition');
      }).catch(function (err) { busy(false); toast(err.message); });
    }
    else if (act === 'sold') {
      var w = find(id); if (!w) return;
      var fd = new FormData(); fd.append('sold', w.sold ? '0' : '1');
      api('/api/works/' + id, { method: 'POST', body: fd }).then(function (res) {
        var i = S.works.findIndex(function (x) { return x.id === id; }); if (i >= 0) S.works[i] = res.work;
        render(true); toast(res.work.sold ? 'Œuvre marquée vendue' : 'Œuvre remise en vente');
      }).catch(function (err) { toast(err.message); });
    }
    else if (act === 'print-all') printCartels(S.works.map(function (w) { return w.id; }));
    else if (act === 'logout') {
      api('/api/logout', { method: 'POST' }).catch(function () {}).then(function () { S.works = []; S.view = 'login'; render(); });
    }
  });

  document.addEventListener('submit', function (e) {
    if (e.target.id !== 'loginForm') return;
    e.preventDefault();
    var pw = $('#pw').value, errEl = $('#loginErr'), btn = e.target.querySelector('button');
    btn.disabled = true; errEl.hidden = true;
    api('/api/login', { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ password: pw }) })
      .then(loadWorks)
      .catch(function (err) { btn.disabled = false; errEl.textContent = err.message; errEl.hidden = false; });
  });

  function loadWorks() {
    return api('/api/works').then(function (res) {
      S.works = res.works || [];
      S.view = S.works.length ? 'list' : 'add';
      render();
    });
  }

  api('/api/session').then(function (s) {
    if (!s.configured) { S.view = 'setup'; render(true); return; }
    if (!s.authed) { S.view = 'login'; render(true); return; }
    return loadWorks();
  }).catch(function (err) {
    main.innerHTML = '<section class="empty"><h1 class="script">Hors ligne</h1><p>' + esc(err.message) + '</p></section>';
  });
})();
