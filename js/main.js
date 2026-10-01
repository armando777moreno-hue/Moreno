/* MORENO.co — interacción de la página (sin dependencias). */
(function () {
  'use strict';

  // Tienda Shopify: el pago se hace en su checkout mediante enlaces de carrito
  // (/cart/<variante>:<cantidad>), así que no hace falta ninguna clave.
  var SHOP = 'https://autods-user-store-52230-g0uyjwy5.myshopify.com';

  // Producto "Atardecer — Oversized Art Tee" en Shopify (IDs de variante por talla).
  var PRODUCT = {
    id: 'atardecer-oversized-art-tee',
    name: 'Camiseta Atardecer',
    color: 'Crema',
    currency: 'USD',
    image: 'assets/img/shirt-back.webp',
    variants: {
      S: { id: 67602293489909, price: 48 },
      M: { id: 67602293522677, price: 48 },
      L: { id: 67602293555445, price: 48 },
      XL: { id: 67602293588213, price: 48 },
      '2XL': { id: 67602293620981, price: 52 }
    }
  };
  PRODUCT.sizes = Object.keys(PRODUCT.variants);

  // Resto del catálogo de Shopify. Sin foto, la tarjeta se dibuja con el refrán.
  var COLLECTION = [
    { title: 'Lienzo', kind: 'Acid Wash Oversized Tee', handle: 'lienzo-acid-wash-oversized-tee', from: 58,
      image: 'https://cdn.shopify.com/s/files/1/0823/3349/9637/files/5785654-6aba4ce904a74b0a2cf5367a-ec2a5723-26bd-4ebe-82f1-f5b686c4c865.png?v=1790594586',
      line: 'El lienzo, antes del primer trazo.' },
    { title: 'Cría Cuervos', kind: 'Oversized Art Tee', handle: 'cria-cuervos-oversized-art-tee', from: 48,
      line: 'Cría cuervos y te sacarán los ojos.', tone: 'cream' },
    { title: 'Ojo Por Ojo', kind: 'Oversized Art Tee', handle: 'ojo-por-ojo-oversized-art-tee', from: 48,
      line: 'Ojo por ojo, y me sobra uno.', tone: 'black' },
    { title: 'Perro Que Ladra', kind: 'Oversized Art Tee', handle: 'perro-que-ladra-oversized-art-tee', from: 48,
      line: 'Perro que ladra no muerde.', tone: 'black' }
  ];
  // Colores de las fachadas de las fotos de inspiración.
  var ISLAND = [
    { name: 'Turquesa', hex: '#5fd3c6' },
    { name: 'Coral', hex: '#f0736a' },
    { name: 'Mango', hex: '#f6b844' },
    { name: 'Cielo', hex: '#8fb8ec' },
    { name: 'Rosa', hex: '#f2a3b3' },
    { name: 'Lima', hex: '#a6d65a' },
    { name: 'Azul', hex: '#3d6fd8' },
    { name: 'Crema', hex: '#efe4cf' }
  ];

  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var money = new Intl.NumberFormat('es-PR', { style: 'currency', currency: PRODUCT.currency });
  var $ = function (s) { return document.querySelector(s); };

  /* ---------- Revelados ---------- */
  var io = new IntersectionObserver(function (entries) {
    entries.forEach(function (e) {
      if (e.isIntersecting) { e.target.classList.add('is-in'); io.unobserve(e.target); }
    });
  }, { threshold: 0.18 });
  document.querySelectorAll('.reveal, .tile, #skyline').forEach(function (el) { io.observe(el); });

  /* ---------- Sub-nav ---------- */
  var subnav = $('#subnav'), hero = $('#hero');
  new IntersectionObserver(function (es) {
    subnav.classList.toggle('is-visible', !es[0].isIntersecting);
  }, { rootMargin: '-60% 0px 0px 0px' }).observe(hero);

  /* ---------- Efectos ligados al scroll ---------- */
  var heroStage = $('#heroStage'), art = $('#arte'), artFrame = $('#artFrame');
  var artLines = document.querySelectorAll('.art__line');
  var inspo = $('#inspiracion'), inspoImg = $('#inspoImg');
  var artProgress = 0;

  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  function onScroll() {
    var vh = window.innerHeight;
    if (!reduceMotion) {
      var y = window.scrollY;
      var p = clamp(y / vh, 0, 1);
      heroStage.style.transform = 'translateY(' + (p * 80) + 'px) scale(' + (1 - p * 0.12) + ')';
      heroStage.style.opacity = String(1 - p * 0.7);
    }
    var r = art.getBoundingClientRect();
    artProgress = clamp(-r.top / (r.height - vh), 0, 1);
    artLines.forEach(function (l, i) { l.classList.toggle('is-on', artProgress > i * 0.22 + 0.05); });
    artFrame.style.setProperty('--art-scale', String(0.82 + artProgress * 0.26));
    artFrame.style.setProperty('--art-rot', (-3 + artProgress * 3) + 'deg');

    var ir = inspo.getBoundingClientRect();
    if (!reduceMotion && ir.bottom > 0 && ir.top < vh) {
      var ip = (vh - ir.top) / (vh + ir.height);
      inspoImg.style.setProperty('--parallax', (-ip * 16) + '%');
    }
  }
  var ticking = false;
  window.addEventListener('scroll', function () {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(function () { onScroll(); ticking = false; });
  }, { passive: true });
  window.addEventListener('resize', onScroll);
  onScroll();

  /* ---------- Imágenes programadas ---------- */

  // Grano de película sobre el hero (tile de ruido generado y repetido).
  (function grain() {
    var c = document.createElement('canvas'), ctx = c.getContext('2d');
    c.width = c.height = 160;
    var img = ctx.createImageData(160, 160);
    for (var i = 0; i < img.data.length; i += 4) {
      var v = Math.random() * 255;
      img.data[i] = img.data[i + 1] = img.data[i + 2] = v; img.data[i + 3] = 255;
    }
    ctx.putImageData(img, 0, 0);
    $('#grain').style.backgroundImage = 'url(' + c.toDataURL() + ')';
  })();

  // Cielo de atardecer animado detrás de la obra; el sol baja con el scroll.
  (function sky() {
    var c = $('#sky'), ctx = c.getContext('2d'), w, h, dpr;
    function size() {
      dpr = Math.min(window.devicePixelRatio || 1, 2);
      w = c.clientWidth; h = c.clientHeight;
      c.width = w * dpr; c.height = h * dpr;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
    function draw(t) {
      var p = artProgress, horizon = h * 0.68;
      var g = ctx.createLinearGradient(0, 0, 0, horizon);
      g.addColorStop(0, 'rgb(' + Math.round(18 + 22 * (1 - p)) + ',' + Math.round(22 + 18 * (1 - p)) + ',' + Math.round(48 + 30 * (1 - p)) + ')');
      g.addColorStop(0.55, 'rgb(' + Math.round(120 + 90 * (1 - p)) + ',' + Math.round(60 + 40 * (1 - p)) + ',70)');
      g.addColorStop(1, 'rgb(255,' + Math.round(120 + 40 * (1 - p)) + ',60)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, horizon);
      // Sol
      var sx = w * (w > 833 ? 0.36 : 0.5), sy = horizon - h * 0.22 + p * h * 0.26, sr = Math.min(w, h) * 0.07;
      var glow = ctx.createRadialGradient(sx, sy, sr * 0.2, sx, sy, sr * 6);
      glow.addColorStop(0, 'rgba(255,200,120,.55)'); glow.addColorStop(1, 'rgba(255,120,60,0)');
      ctx.fillStyle = glow; ctx.fillRect(0, 0, w, horizon);
      ctx.save(); ctx.beginPath(); ctx.rect(0, 0, w, horizon); ctx.clip();
      ctx.fillStyle = '#ffe2a8'; ctx.beginPath(); ctx.arc(sx, sy, sr, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
      // Mar con reflejos que se mueven
      var sea = ctx.createLinearGradient(0, horizon, 0, h);
      sea.addColorStop(0, '#2b2c4a'); sea.addColorStop(1, '#0b0a0c');
      ctx.fillStyle = sea; ctx.fillRect(0, horizon, w, h - horizon);
      for (var i = 0; i < 26; i++) {
        var yy = horizon + 6 + i * i * 0.55;
        if (yy > h) break;
        var ww = sr * (1.6 - i * 0.04) + Math.sin(t / 700 + i) * sr * 0.3;
        ctx.fillStyle = 'rgba(255,170,90,' + (0.5 - i * 0.018) + ')';
        ctx.fillRect(sx - ww / 2 + Math.sin(t / 900 + i * 1.7) * 6, yy, ww, 2);
      }
      // Velo para que el texto se lea
      ctx.fillStyle = 'rgba(8,7,10,.35)'; ctx.fillRect(0, 0, w, h);
    }
    var on = false;
    new IntersectionObserver(function (es) { on = es[0].isIntersecting; if (on) loop(performance.now()); }).observe(art);
    function loop(t) { if (!on) return; draw(t); if (!reduceMotion) requestAnimationFrame(loop); }
    window.addEventListener('resize', size);
    size(); draw(0);
  })();

  // Textura de tela generada (ruido + trama) para el bloque "Tejido texturizado".
  (function fabric() {
    var c = $('#fabric'), ctx = c.getContext('2d');
    function draw() {
      var w = c.clientWidth, h = c.clientHeight, dpr = Math.min(window.devicePixelRatio || 1, 2);
      c.width = w * dpr; c.height = h * dpr; ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#e8dfcf'; ctx.fillRect(0, 0, w, h);
      var rnd = mulberry(7);
      for (var i = 0; i < w * h / 60; i++) {
        var x = rnd() * w, y = rnd() * h, len = 4 + rnd() * 14, a = rnd() * Math.PI;
        ctx.strokeStyle = rnd() > 0.5 ? 'rgba(255,255,255,.35)' : 'rgba(120,100,80,.12)';
        ctx.lineWidth = 0.6 + rnd();
        ctx.beginPath();
        ctx.moveTo(x, y);
        ctx.quadraticCurveTo(x + Math.cos(a) * len * 0.5 + rnd() * 4, y + Math.sin(a) * len * 0.5 - rnd() * 4, x + Math.cos(a) * len, y + Math.sin(a) * len);
        ctx.stroke();
      }
      var g = ctx.createLinearGradient(0, 0, w, h);
      g.addColorStop(0, 'rgba(255,255,255,.25)'); g.addColorStop(1, 'rgba(90,70,50,.18)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
    if ('ResizeObserver' in window) new ResizeObserver(draw).observe(c); else draw();
  })();

  // Ilustración SVG de casas de colores frente al mar.
  (function skyline() {
    var svg = $('#skyline'), NS = 'http://www.w3.org/2000/svg', rnd = mulberry(21);
    function el(name, attrs, parent) {
      var n = document.createElementNS(NS, name);
      for (var k in attrs) n.setAttribute(k, attrs[k]);
      (parent || svg).appendChild(n);
      return n;
    }
    var defs = el('defs', {});
    var sky = el('linearGradient', { id: 'skyG', x1: 0, y1: 0, x2: 0, y2: 1 }, defs);
    el('stop', { offset: '0', 'stop-color': '#27325a' }, sky);
    el('stop', { offset: '.6', 'stop-color': '#8d7fa6' }, sky);
    el('stop', { offset: '1', 'stop-color': '#f2b38a' }, sky);
    el('rect', { width: 1200, height: 420, fill: 'url(#skyG)' });
    el('circle', { cx: 980, cy: 70, r: 18, fill: '#fff6dc', opacity: '.9' });
    el('rect', { y: 250, width: 1200, height: 170, fill: '#2d3c63' });
    for (var s = 0; s < 14; s++) {
      el('rect', { x: 40 + rnd() * 1100, y: 262 + rnd() * 60, width: 30 + rnd() * 90, height: 2, fill: '#fff', opacity: '.18' });
    }
    // Tres hileras en ladera; las de atrás más altas y más pequeñas.
    var rows = [{ base: 300, scale: 0.7 }, { base: 350, scale: 0.85 }, { base: 420, scale: 1 }];
    var delay = 0;
    rows.forEach(function (row, ri) {
      var x = -20 + rnd() * 30;
      while (x < 1220) {
        var w = (70 + rnd() * 70) * row.scale, hh = (70 + rnd() * 90) * row.scale;
        var col = ISLAND[Math.floor(rnd() * (ISLAND.length - 1))].hex;
        var g = el('g', { class: 'house', style: 'transition-delay:' + delay.toFixed(2) + 's' });
        el('rect', { x: x, y: row.base - hh, width: w, height: hh, fill: col, rx: 2 }, g);
        el('rect', { x: x - 3, y: row.base - hh - 6, width: w + 6, height: 7, fill: ri === 2 ? '#f4efe6' : '#d9d2c8' }, g);
        var cols = Math.max(1, Math.floor(w / 34)), lines = Math.max(1, Math.floor(hh / 44));
        for (var cx = 0; cx < cols; cx++) {
          for (var ly = 0; ly < lines; ly++) {
            var lit = rnd() > 0.55;
            el('rect', {
              class: 'win', x: x + 10 + cx * (w - 20) / cols, y: row.base - hh + 14 + ly * 40 * row.scale,
              width: 14 * row.scale, height: 18 * row.scale, rx: 1.5,
              fill: lit ? '#ffd98a' : 'rgba(30,40,70,.45)',
              style: 'transition-delay:' + (delay + 0.5).toFixed(2) + 's'
            }, g);
          }
        }
        if (rnd() > 0.7 && ri > 0) { // palmera
          var px = x + w + 6, py = row.base;
          el('path', { d: 'M' + px + ' ' + py + ' q 6 -50 -2 -100', stroke: '#3a3226', 'stroke-width': 4, fill: 'none' }, g);
          for (var f = 0; f < 6; f++) {
            var ang = -Math.PI + f * Math.PI / 5;
            el('path', {
              d: 'M' + (px - 2) + ' ' + (py - 100) + ' q ' + (Math.cos(ang) * 22) + ' ' + (-14) + ' ' + (Math.cos(ang) * 40) + ' ' + (Math.sin(ang) * -8 + 14),
              stroke: '#2f6b4a', 'stroke-width': 5, fill: 'none', 'stroke-linecap': 'round'
            }, g);
          }
        }
        x += w + 2 + rnd() * 8;
        delay += 0.035;
      }
    });
    var list = $('#swatches');
    ISLAND.forEach(function (c) {
      var li = document.createElement('li');
      li.innerHTML = '<i style="background:' + c.hex + '"></i>' + c.name;
      list.appendChild(li);
    });
  })();

  function mulberry(a) {
    return function () {
      a |= 0; a = a + 0x6D2B79F5 | 0;
      var t = Math.imul(a ^ a >>> 15, 1 | a);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }

  /* ---------- Carril de highlights ---------- */
  (function rail() {
    var rail = $('#rail'), cards = rail.querySelectorAll('.card'), dots = $('#railDots');
    cards.forEach(function (_, i) {
      var d = document.createElement('span');
      if (!i) d.className = 'is-on';
      dots.appendChild(d);
    });
    function step() { return cards[0].getBoundingClientRect().width + 20; }
    $('#railPrev').addEventListener('click', function () { rail.scrollBy({ left: -step(), behavior: 'smooth' }); });
    $('#railNext').addEventListener('click', function () { rail.scrollBy({ left: step(), behavior: 'smooth' }); });
    rail.addEventListener('scroll', function () {
      var max = rail.scrollWidth - rail.clientWidth;
      var i = max > 0 ? Math.round(rail.scrollLeft / max * (cards.length - 1)) : 0;
      dots.querySelectorAll('span').forEach(function (d, j) { d.classList.toggle('is-on', j === i); });
    }, { passive: true });
  })();

  /* ---------- Compra ---------- */
  var prices = PRODUCT.sizes.map(function (k) { return PRODUCT.variants[k].price; });
  function showPrice(size) {
    $('#price').textContent = size ? money.format(PRODUCT.variants[size].price)
      : 'Desde ' + money.format(Math.min.apply(null, prices));
  }
  showPrice(null);

  /* ---------- Colección ---------- */
  (function collection() {
    var grid = $('#collectionGrid');
    if (!grid) return;
    COLLECTION.forEach(function (p) {
      var a = document.createElement('a');
      a.className = 'product-card reveal';
      a.href = SHOP + '/products/' + p.handle;
      a.rel = 'noopener';
      var media = p.image
        ? '<img src="' + p.image + '" alt="' + p.title + '" loading="lazy">'
        : '<div class="product-card__art product-card__art--' + p.tone + '"><span>\u201C' + p.line + '\u201D</span></div>';
      a.innerHTML = '<div class="product-card__media">' + media + '</div>' +
        '<div class="product-card__body"><h3>' + p.title + '</h3><p>' + p.kind + '</p>' +
        '<p class="product-card__price">Desde ' + money.format(p.from) + '</p>' +
        '<span class="link-arrow link-arrow--dark">Ver en la tienda</span></div>';
      grid.appendChild(a);
      var img = a.querySelector('img');
      if (img) img.addEventListener('error', function () { // sin red al CDN: tarjeta tipográfica
        img.parentNode.innerHTML = '<div class="product-card__art product-card__art--cream"><span>\u201C' + p.line + '\u201D</span></div>';
      });
      io.observe(a);
    });
  })();

  var buyMain = $('#buyMain');
  document.querySelectorAll('#buyThumbs button').forEach(function (b) {
    b.addEventListener('click', function () {
      document.querySelectorAll('#buyThumbs button').forEach(function (o) { o.setAttribute('aria-pressed', String(o === b)); });
      buyMain.style.opacity = '0';
      setTimeout(function () {
        buyMain.src = b.dataset.src;
        buyMain.alt = 'Camiseta Atardecer, ' + b.dataset.alt.toLowerCase();
        buyMain.classList.toggle('is-contain', /\.webp$/.test(b.dataset.src));
        buyMain.style.opacity = '1';
      }, 180);
    });
  });

  var chosen = null, addBtn = $('#addToBag'), sizes = $('#sizes');
  PRODUCT.sizes.forEach(function (s) {
    var b = document.createElement('button');
    b.type = 'button'; b.textContent = s;
    b.setAttribute('role', 'radio'); b.setAttribute('aria-checked', 'false');
    b.addEventListener('click', function () {
      chosen = s;
      showPrice(s);
      sizes.querySelectorAll('button').forEach(function (o) { o.setAttribute('aria-checked', String(o === b)); });
      addBtn.disabled = false;
      addBtn.textContent = 'Añadir a la bolsa';
    });
    sizes.appendChild(b);
  });

  /* ---------- Bolsa (localStorage) ---------- */
  var KEY = 'moreno.bag';
  var bag = load();
  function load() {
    try {
      return (JSON.parse(localStorage.getItem(KEY)) || []).filter(function (it) { return PRODUCT.variants[it.size]; });
    } catch (e) { return []; }
  }
  function save() { try { localStorage.setItem(KEY, JSON.stringify(bag)); } catch (e) { /* noop */ } }

  function render() {
    var count = bag.reduce(function (n, it) { return n + it.qty; }, 0);
    var badge = $('#bagCount');
    badge.hidden = !count; badge.textContent = count;
    var list = $('#bagList');
    list.innerHTML = '';
    if (!bag.length) {
      list.innerHTML = '<li class="bag__empty">Tu bolsa está vacía.</li>';
    }
    bag.forEach(function (it, i) {
      var li = document.createElement('li');
      li.innerHTML = '<img src="' + PRODUCT.image + '" alt=""><div>' + PRODUCT.name +
        '<small>' + PRODUCT.color + ' · Talla ' + it.size + ' · ' + it.qty + ' ud.</small></div>' +
        '<div style="text-align:right">' + money.format(PRODUCT.variants[it.size].price * it.qty) + '<br><button data-i="' + i + '">Eliminar</button></div>';
      list.appendChild(li);
    });
    list.querySelectorAll('button[data-i]').forEach(function (b) {
      b.addEventListener('click', function () { bag.splice(+b.dataset.i, 1); save(); render(); });
    });
    $('#bagTotal').textContent = money.format(bag.reduce(function (n, it) { return n + it.qty * PRODUCT.variants[it.size].price; }, 0));
    $('#checkout').disabled = !bag.length;
  }

  addBtn.addEventListener('click', function () {
    if (!chosen) return;
    var found = bag.filter(function (it) { return it.size === chosen; })[0];
    if (found) found.qty++; else bag.push({ id: PRODUCT.id, size: chosen, qty: 1 });
    save(); render(); openBag(true);
  });

  // Envía la bolsa al checkout de Shopify.
  $('#checkout').addEventListener('click', function () {
    if (!bag.length) return;
    var items = bag.map(function (it) { return PRODUCT.variants[it.size].id + ':' + it.qty; }).join(',');
    window.location.href = SHOP + '/cart/' + items;
  });

  var bagEl = $('#bag'), scrim = $('#scrim');
  function openBag(open) {
    bagEl.classList.toggle('is-open', open);
    bagEl.setAttribute('aria-hidden', String(!open));
    scrim.hidden = !open;
    if (open) $('#bagClose').focus();
  }
  $('#bagBtn').addEventListener('click', function () { openBag(true); });
  $('#bagClose').addEventListener('click', function () { openBag(false); });
  scrim.addEventListener('click', function () { openBag(false); });
  document.addEventListener('keydown', function (e) { if (e.key === 'Escape') openBag(false); });
  render();

  $('#year').textContent = new Date().getFullYear();
})();
