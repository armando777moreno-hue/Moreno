/* MORENO.co — Neomorfismo. Interacción de las secciones mn-* (sin librerías). */
(function () {
  'use strict';
  if (window.__mnInit) return; // el script se incluye desde varias secciones
  window.__mnInit = true;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  var finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  function once(el, key) { if (el.dataset[key]) return false; el.dataset[key] = '1'; return true; }
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

  /* ---------- Reveals ---------- */
  var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
    es.forEach(function (e) { if (e.isIntersecting) { e.target.classList.add('mn-visible'); io.unobserve(e.target); } });
  }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' }) : null;
  function initReveals(root) {
    root.querySelectorAll('.mn-reveal').forEach(function (el) {
      if (!once(el, 'mnRev')) return;
      if (io && !reduce) io.observe(el); else el.classList.add('mn-visible');
    });
  }

  /* ---------- Efectos ligados al scroll: un solo bucle ---------- */
  // --mn-p: posición del elemento respecto al centro de la pantalla (-1 abajo … 1 arriba).
  var scrollEls = [];
  function track(el, fn) { scrollEls.push({ el: el, fn: fn }); }
  function tick() {
    var vh = window.innerHeight || 1;
    for (var i = 0; i < scrollEls.length; i++) {
      var it = scrollEls[i];
      if (!it.el.isConnected) continue;
      var r = it.el.getBoundingClientRect();
      if (r.bottom < -200 || r.top > vh + 200) continue;
      var center = r.top + r.height / 2;
      var p = clamp((vh / 2 - center) / (vh / 2 + r.height / 2), -1, 1);
      it.fn(p, r, vh);
    }
  }
  var ticking = false;
  function onScroll() { if (ticking) return; ticking = true; requestAnimationFrame(function () { tick(); ticking = false; }); }
  if (!reduce) { window.addEventListener('scroll', onScroll, { passive: true }); window.addEventListener('resize', onScroll); }

  function init3D(root) {
    if (reduce) return;
    root.querySelectorAll('[data-mn-3d]').forEach(function (el) {
      if (!once(el, 'mn3d')) return;
      track(el, function (p) { el.style.setProperty('--mn-p', p.toFixed(3)); });
    });
    root.querySelectorAll('[data-mn-hero]').forEach(function (el) {
      if (!once(el, 'mnHero')) return;
      track(el, function (p, r) { el.style.setProperty('--mn-hero', clamp(-r.top / (r.height * 0.9), 0, 1).toFixed(3)); });
    });
    root.querySelectorAll('[data-mn-parallax]').forEach(function (el) {
      if (!once(el, 'mnPar')) return;
      var speed = parseFloat(el.dataset.mnParallax) || 0.2;
      track(el.parentElement, function (p, r) {
        var max = (el.offsetHeight - el.parentElement.offsetHeight) / 2;
        var y = clamp(p * r.height * speed, -max, max);
        el.style.transform = 'translate3d(0,' + y.toFixed(1) + 'px,0)';
      });
    });
    root.querySelectorAll('[data-mn-cierre]').forEach(function (el) {
      if (!once(el, 'mnCierre')) return;
      var spans = el.querySelectorAll('span');
      track(el, function (p) {
        spans.forEach(function (s, i) { s.style.transform = 'rotateX(' + (p * 38 * (i % 2 ? -1 : 1)).toFixed(1) + 'deg) translateZ(' + (Math.abs(p) * -40).toFixed(1) + 'px)'; });
      });
    });
    onScroll();
  }

  /* ---------- Tarjetas que se inclinan con el ratón ---------- */
  function initTilt(root) {
    if (!finePointer || reduce) return;
    root.querySelectorAll('[data-mn-tilt]').forEach(function (card) {
      if (!once(card, 'mnTilt')) return;
      var max = parseFloat(card.dataset.mnTilt) || 8;
      card.addEventListener('pointermove', function (e) {
        var r = card.getBoundingClientRect();
        var x = (e.clientX - r.left) / r.width - 0.5, y = (e.clientY - r.top) / r.height - 0.5;
        card.style.setProperty('--rx', (x * max * 2).toFixed(2) + 'deg');
        card.style.setProperty('--ry', (-y * max * 2).toFixed(2) + 'deg');
      });
      card.addEventListener('pointerleave', function () { card.style.removeProperty('--rx'); card.style.removeProperty('--ry'); });
    });
  }

  /* ---------- Marquesina: duplica el contenido hasta cubrir 2× el ancho ---------- */
  function initMarquee(root) {
    root.querySelectorAll('.mn-marquee__track').forEach(function (track) {
      if (!once(track, 'mnMq')) return;
      var base = track.innerHTML, guard = 0;
      while (track.scrollWidth < window.innerWidth * 1.2 && guard++ < 8) track.innerHTML += base;
      track.innerHTML += track.innerHTML;
    });
  }

  /* ---------- Frase que se ilumina palabra a palabra ---------- */
  function initFrase(root) {
    root.querySelectorAll('[data-mn-frase]').forEach(function (el) {
      if (!once(el, 'mnFrase')) return;
      var acentos = (el.dataset.acento || '').toLowerCase().split(',').map(function (s) { return s.trim(); }).filter(Boolean);
      var words = el.textContent.trim().split(/\s+/);
      el.innerHTML = words.map(function (w) {
        var clean = w.toLowerCase().replace(/[^\p{L}\p{N}]/gu, '');
        var acc = acentos.indexOf(clean) >= 0 ? ' is-acento' : '';
        return '<span class="mn-w' + acc + '">' + w.replace(/</g, '&lt;') + '</span>';
      }).join(' ');
      var spans = el.querySelectorAll('.mn-w');
      if (reduce) { spans.forEach(function (s) { s.classList.add('is-on'); }); return; }
      track(el, function (p, r, vh) {
        var prog = clamp((vh * 0.85 - r.top) / (r.height + vh * 0.35), 0, 1);
        var n = Math.round(prog * spans.length);
        spans.forEach(function (s, i) { s.classList.toggle('is-on', i < n); });
      });
      onScroll();
    });
  }

  /* ---------- Rueda de color ---------- */
  function initDial(root) {
    root.querySelectorAll('[data-mn-dial]').forEach(function (dial) {
      if (!once(dial, 'mnDial')) return;
      var sec = dial.closest('[data-mn-color]');
      var puntos = dial.querySelectorAll('.mn-dial__punto');
      var aro = dial.querySelector('.mn-dial__aro');
      var img = dial.querySelector('.mn-dial__prenda');
      var nombre = sec.querySelector('[data-mn-nombre]'), precio = sec.querySelector('[data-mn-precio]'), btn = sec.querySelector('[data-mn-comprar]');
      var n = puntos.length, actual = -1;
      function elegir(i) {
        i = ((i % n) + n) % n;
        if (i === actual) return;
        actual = i;
        var p = puntos[i];
        // un solo punto enfocable (el elegido): el tabulador entra y sale de la rueda en una parada
        puntos.forEach(function (b, j) { b.setAttribute('aria-checked', String(j === i)); b.tabIndex = j === i ? 0 : -1; });
        aro.style.transform = 'rotate(' + (-i * 360 / n) + 'deg)';
        nombre.textContent = p.dataset.nombre;
        if (precio && p.dataset.precio) precio.textContent = p.dataset.precio;
        if (btn && p.dataset.url) btn.href = p.dataset.url;
        img.classList.add('is-girando');
        var pre = new Image();
        pre.onload = pre.onerror = function () {
          setTimeout(function () { img.src = p.dataset.img; img.alt = p.dataset.nombre; img.classList.remove('is-girando'); }, reduce ? 0 : 260);
        };
        pre.src = p.dataset.img;
      }
      puntos.forEach(function (b, i) {
        // contra-rotación: el aro gira pero cada punto sigue mirando hacia arriba
        b.addEventListener('click', function () { elegir(i); });
      });
      // Arrastrar en círculo sobre la rueda cambia de color
      var arrastre = null;
      // Solo el aro se arrastra (touch-action: none en CSS); el centro deja desplazar la página en táctil.
      aro.addEventListener('pointerdown', function (e) {
        if (e.target.closest('.mn-dial__punto')) return;
        var r = dial.getBoundingClientRect();
        arrastre = { cx: r.left + r.width / 2, cy: r.top + r.height / 2, a0: Math.atan2(e.clientY - (r.top + r.height / 2), e.clientX - (r.left + r.width / 2)), i0: actual };
        try { aro.setPointerCapture(e.pointerId); } catch (err) {}
      });
      window.addEventListener('pointermove', function (e) {
        if (!arrastre) return;
        var a = Math.atan2(e.clientY - arrastre.cy, e.clientX - arrastre.cx);
        var d = a - arrastre.a0;
        elegir(arrastre.i0 - Math.round(d / (Math.PI * 2 / n)));
      });
      function soltar() { arrastre = null; }
      ['pointerup', 'pointercancel', 'lostpointercapture'].forEach(function (ev) { aro.addEventListener(ev, soltar); });
      window.addEventListener('pointerup', soltar);
      window.addEventListener('blur', soltar);
      dial.addEventListener('keydown', function (e) {
        var d = 0;
        if (e.key === 'ArrowRight' || e.key === 'ArrowDown') d = 1;
        if (e.key === 'ArrowLeft' || e.key === 'ArrowUp') d = -1;
        if (e.key === 'Home') d = -actual;
        if (e.key === 'End') d = n - 1 - actual;
        if (!d) return;
        e.preventDefault(); elegir(actual + d); puntos[actual].focus();
      });
      elegir(parseInt(dial.dataset.inicio || '0', 10) || 0);
    });
  }

  /* ---------- Detalles con puntos ---------- */
  function initDetalles(root) {
    root.querySelectorAll('[data-mn-detalles]').forEach(function (sec) {
      if (!once(sec, 'mnDet')) return;
      var puntos = sec.querySelectorAll('.mn-punto'), items = sec.querySelectorAll('.mn-detalle__item');
      function activar(i) {
        puntos.forEach(function (p, j) { p.setAttribute('aria-expanded', String(j === i)); });
        items.forEach(function (it, j) { it.classList.toggle('is-on', j === i); });
      }
      puntos.forEach(function (p, i) { p.addEventListener('click', function () { activar(i); }); });
      items.forEach(function (it, i) {
        it.addEventListener('click', function () { activar(i); });
        it.addEventListener('mouseenter', function () { activar(i); });
      });
      activar(0);
    });
  }

  /* ---------- Página de producto: variantes, visor y barra fija ---------- */
  // Reutiliza el formato que ya imprimió Shopify (filtro money), cambiando solo la cifra.
  function money(cents, el, plantilla) {
    var m = plantilla && plantilla.match(/\d[\d.,\s]*\d|\d/);
    if (m) {
      var coma = /\d,\d{2}$/.test(m[0]), n = (cents / 100).toFixed(2).split('.');
      var ent = n[0].replace(/\B(?=(\d{3})+(?!\d))/g, coma ? '.' : ',');
      return plantilla.replace(m[0], ent + (coma ? ',' : '.') + n[1]);
    }
    var cur = (window.Shopify && Shopify.currency && Shopify.currency.active) || el.dataset.moneda || 'USD';
    try { return new Intl.NumberFormat(document.documentElement.lang || 'es', { style: 'currency', currency: cur }).format(cents / 100); }
    catch (e) { return (cents / 100).toFixed(2); }
  }
  function key(v) {
    v = String(v || '').split('·').pop();
    return v.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase().replace(/\s+/g, '-');
  }
  function initProducto(root) {
    root.querySelectorAll('[data-mn-producto]').forEach(function (sec) {
      if (!once(sec, 'mnPdp')) return;
      var data = sec.querySelector('script[data-variantes]');
      if (!data) return;
      var variantes = JSON.parse(data.textContent);
      var form = sec.querySelector('form.mn-form'), idInput = form.querySelector('input[name="id"]');
      var btn = form.querySelector('[name="add"]'), precio = sec.querySelector('[data-mn-precio]');
      var fieldsets = sec.querySelectorAll('.mn-opcion');
      var visor = sec.querySelector('[data-moreno-360]');
      var barra = sec.querySelector('.mn-barra'), barraPrecio = barra && barra.querySelector('[data-mn-barra-precio]');
      var plantilla = precio && precio.firstChild ? String(precio.firstChild.nodeValue).trim() : '';
      function seleccion() {
        return Array.prototype.map.call(fieldsets, function (fs) {
          var c = fs.querySelector('input:checked'); return c ? c.value : null;
        });
      }
      function actualizar(origen) {
        var sel = seleccion();
        var v = variantes.filter(function (x) { return x.options.every(function (o, i) { return sel[i] === null || o === sel[i]; }); })[0];
        // marca como agotadas las tallas sin stock para la combinación actual
        fieldsets.forEach(function (fs, oi) {
          fs.querySelectorAll('.mn-chip').forEach(function (chip) {
            var val = chip.querySelector('input').value;
            var hay = variantes.some(function (x) {
              return x.available && x.options.every(function (o, i) { return i === oi ? o === val : (sel[i] === null || o === sel[i]); });
            });
            chip.classList.toggle('is-agotada', !hay);
          });
        });
        if (!v) { btn.disabled = true; btn.textContent = btn.dataset.noDisponible; return; }
        idInput.value = v.id;
        btn.disabled = !v.available;
        btn.textContent = v.available ? btn.dataset.anadir : btn.dataset.agotado;
        var txt = money(v.price, sec, plantilla);
        if (precio) precio.firstChild.nodeValue = txt + ' ';
        if (barraPrecio) barraPrecio.textContent = txt;
        if (history.replaceState && origen) {
          var u = new URL(location.href); u.searchParams.set('variant', v.id); history.replaceState(null, '', u);
        }
        if (visor && visor.morenoSetColor) {
          v.options.forEach(function (o) { var k = key(o); if (visor.querySelector('[data-c="' + k + '"]')) visor.morenoSetColor(k); });
        }
      }
      fieldsets.forEach(function (fs) { fs.addEventListener('change', function () { actualizar(true); }); });
      if (visor) visor.addEventListener('moreno:color', function (e) {
        // el visor manda: si el color existe como opción, se marca
        sec.querySelectorAll('.mn-chip input').forEach(function (inp) {
          if (key(inp.value) === e.detail && !inp.value.includes('·')) { inp.checked = true; }
        });
        actualizar(true);
      });
      actualizar(false);
      if (barra && 'IntersectionObserver' in window) {
        new IntersectionObserver(function (es) { barra.classList.toggle('is-visible', !es[0].isIntersecting && es[0].boundingClientRect.top < 0); })
          .observe(btn);
        barra.querySelector('button').addEventListener('click', function () { if (form.requestSubmit) form.requestSubmit(btn); else btn.click(); });
      }
    });
  }

  function initAll(root) {
    root = root || document;
    initReveals(root); init3D(root); initTilt(root); initMarquee(root);
    initFrase(root); initDial(root); initDetalles(root); initProducto(root);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', function () { initAll(); });
  else initAll();
  document.addEventListener('shopify:section:load', function (e) { initAll(e.target); });
})();
