/* Visor 3D 360° de MORENO.co (three.js r128, sin bundler). Lo usan la web y el tema de Shopify.
 *
 * La prenda son dos planos muy subdivididos (frente y espalda) recortados con la
 * transparencia de la foto y "inflados" con un mapa de volumen, de modo que sus
 * bordes se juntan y forman un volumen que se puede girar. La espalda es la misma
 * foto espejada. Cada color tiene su foto real (assets/img/lienzo/<color>.webp).
 *
 * Marcado: un elemento [data-moreno-360] con
 *   data-tex="…/{c}.webp"  data-height="…/{c}-h.png"  data-color="<color inicial>"
 * y dentro: [data-stage] > canvas, [data-fallback] > [data-flip] > img×2, [data-hint],
 * botones [data-view] (front|side|back|spin) y botones [data-c] para el color.
 * API: el elemento recibe root.morenoSetColor(c) y emite el evento 'moreno:color'.
 * Con data-scroll="<vueltas>" la prenda gira según el avance del scroll por su sección
 * (arrastrar sigue funcionando y desplaza el punto de partida).
 */
(function () {
  'use strict';

  var VIEWS = { front: 0, side: Math.PI / 2, back: Math.PI };
  var SIZE = 2, DEPTH = 0.14, SEGMENTS = 200, AUTO_SPEED = 0.35, IDLE_MS = 3000;
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function hasWebGL() {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) { return false; }
  }

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.crossOrigin = 'anonymous';
      img.onload = function () { resolve(img); };
      img.onerror = reject;
      img.src = src;
    });
  }

  function mount(root) {
    if (root.dataset.ready) return;
    root.dataset.ready = 'loading';
    var stage = root.querySelector('[data-stage]');
    var canvas = stage.querySelector('canvas');
    var hint = root.querySelector('[data-hint]');
    var tabs = root.querySelectorAll('[data-view]');
    var picks = root.querySelectorAll('[data-c]');
    var color = root.dataset.color;
    function url(tpl, c) { return tpl.replace('{c}', c); }
    function select(view) {
      tabs.forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.view === view)); });
    }
    function markColor(c) {
      picks.forEach(function (b) { b.setAttribute('aria-checked', String(b.dataset.c === c)); });
    }

    var applyColor = function () {}; // la reemplaza init() o fallback()
    function setColor(c, silent) {
      if (!c) return;
      color = c; markColor(c); applyColor(c);
      if (!silent) root.dispatchEvent(new CustomEvent('moreno:color', { detail: c, bubbles: true }));
    }
    root.morenoSetColor = function (c) { setColor(c, true); };
    picks.forEach(function (b) { b.addEventListener('click', function () { setColor(b.dataset.c); }); });
    markColor(color);

    if (!window.THREE || !hasWebGL()) return fallback();
    Promise.all([loadImage(url(root.dataset.tex, color)), loadImage(url(root.dataset.height, color))])
      .then(function (imgs) { init(imgs[0], imgs[1]); })
      .catch(fallback);

    function init(texImg, heightImg) {
      var THREE = window.THREE;
      var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.setClearColor(0x000000, 0);

      var scene = new THREE.Scene();
      var camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
      camera.position.set(0, 0.02, 5.3);
      scene.add(new THREE.HemisphereLight(0xffffff, 0xb9ab98, 0.75));
      var key = new THREE.DirectionalLight(0xfff4e6, 0.7);
      key.position.set(-2.5, 3, 4);
      scene.add(key);
      var fill = new THREE.DirectionalLight(0xffffff, 0.45);
      fill.position.set(3, 1, -4);
      scene.add(fill);

      function heights(img) { // mapa de volumen -> función bilineal h(u, v) en 0..1
        var hc = document.createElement('canvas');
        hc.width = img.width; hc.height = img.height;
        var ctx = hc.getContext('2d');
        ctx.drawImage(img, 0, 0);
        var d = ctx.getImageData(0, 0, hc.width, hc.height).data, W = hc.width, H = hc.height;
        function px(x, y) {
          x = Math.min(W - 1, Math.max(0, x)); y = Math.min(H - 1, Math.max(0, y));
          return d[(y * W + x) * 4] / 255;
        }
        return function (u, v) {
          var fx = u * (W - 1), fy = (1 - v) * (H - 1);
          var x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
          var top = px(x0, y0) * (1 - tx) + px(x0 + 1, y0) * tx;
          var bot = px(x0, y0 + 1) * (1 - tx) + px(x0 + 1, y0 + 1) * tx;
          return top * (1 - ty) + bot * ty;
        };
      }
      function texture(img, mirror) {
        var t = new THREE.Texture(img);
        t.encoding = THREE.sRGBEncoding;
        t.anisotropy = renderer.capabilities.getMaxAnisotropy();
        if (mirror) { t.wrapS = THREE.RepeatWrapping; t.repeat.x = -1; t.offset.x = 1; }
        t.needsUpdate = true;
        return t;
      }
      // La espalda (girada 180°) usa la foto y el volumen espejados para que su silueta
      // coincida con la del frente.
      function makeFace(mirror) {
        var geo = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS);
        // Lambert (sin especular): evita el brillo de Fresnel en el canto donde se unen las caras.
        var mat = new THREE.MeshLambertMaterial({ alphaTest: 0.5 });
        mat.alphaToCoverage = true;
        var mesh = new THREE.Mesh(geo, mat);
        mesh.userData.mirror = mirror;
        return mesh;
      }
      function dress(mesh, img, h) {
        var pos = mesh.geometry.attributes.position, uv = mesh.geometry.attributes.uv, m = mesh.userData.mirror;
        for (var i = 0; i < pos.count; i++) {
          var u = uv.getX(i);
          pos.setZ(i, DEPTH * h(m ? 1 - u : u, uv.getY(i)));
        }
        pos.needsUpdate = true;
        mesh.geometry.computeVertexNormals();
        if (mesh.material.map) mesh.material.map.dispose();
        mesh.material.map = texture(img, m);
        mesh.material.needsUpdate = true;
      }

      var front = makeFace(false), back = makeFace(true);
      back.rotation.y = Math.PI;
      var shirt = new THREE.Group();
      shirt.add(front, back);
      scene.add(shirt);
      function wear(img, hImg) { var h = heights(hImg); dress(front, img, h); dress(back, img, h); }
      wear(texImg, heightImg);

      var loading = 0;
      applyColor = function (c) {
        var ticket = ++loading;
        root.classList.add('is-loading');
        Promise.all([loadImage(url(root.dataset.tex, c)), loadImage(url(root.dataset.height, c))])
          .then(function (imgs) { if (ticket === loading) wear(imgs[0], imgs[1]); })
          .catch(function () { /* se queda el color anterior */ })
          .then(function () { if (ticket === loading) root.classList.remove('is-loading'); });
      };

      // ---- Interacción ----
      var angle = VIEWS.front, target = null, velocity = 0, tilt = 0, tiltTarget = 0;
      var dragging = false, decided = false, lastX = 0, lastY = 0, startX = 0, startY = 0, lastT = 0;
      var scrollTurns = parseFloat(root.dataset.scroll || '0') || 0;
      var lastInput = 0, autoSpin = !reduceMotion && !scrollTurns, scrollOffset = 0;
      function scrollAngle() { // 0..1 según cuánto ha recorrido la sección la pantalla
        var r = root.getBoundingClientRect(), vh = window.innerHeight || 1;
        var p = Math.min(1, Math.max(0, (vh - r.top) / (vh + r.height)));
        return scrollOffset + p * scrollTurns * Math.PI * 2;
      }

      function bump() { lastInput = performance.now(); if (hint) hint.classList.add('is-hidden'); }

      stage.addEventListener('pointerdown', function (e) {
        dragging = true; decided = false;
        startX = lastX = e.clientX; startY = lastY = e.clientY; lastT = performance.now();
        target = null; velocity = 0; bump();
      });
      window.addEventListener('pointermove', function (e) {
        if (!dragging) return;
        // En táctil, un gesto mayormente vertical se deja para hacer scroll.
        if (!decided) {
          if (Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY) < 6) return;
          decided = true;
          if (e.pointerType !== 'mouse' && Math.abs(e.clientY - startY) > Math.abs(e.clientX - startX)) { dragging = false; return; }
          stage.classList.add('is-dragging');
          try { stage.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
        }
        var now = performance.now(), dt = Math.max(1, now - lastT);
        var d = (e.clientX - lastX) * 0.0105;
        angle += d; velocity = d / dt * 16;
        tiltTarget = Math.max(-0.22, Math.min(0.22, tiltTarget + (e.clientY - lastY) * 0.004));
        lastX = e.clientX; lastY = e.clientY; lastT = now; bump();
        select('');
      });
      function release() {
        if (!dragging) return;
        dragging = false; stage.classList.remove('is-dragging'); tiltTarget = 0; bump();
        if (scrollTurns) { velocity = 0; scrollOffset += angle - scrollAngle(); }
      }
      window.addEventListener('pointerup', release);
      window.addEventListener('pointercancel', release);

      tabs.forEach(function (b) {
        b.addEventListener('click', function () {
          var v = b.dataset.view;
          bump();
          if (v === 'spin') {
            autoSpin = !autoSpin; target = null; lastInput = 0;
            b.setAttribute('aria-pressed', String(autoSpin));
            select(autoSpin ? 'spin' : '');
            return;
          }
          autoSpin = false;
          var twoPi = Math.PI * 2; // camino más corto hasta el ángulo pedido
          var diff = ((VIEWS[v] - angle) % twoPi + twoPi * 1.5) % twoPi - Math.PI;
          target = angle + diff; velocity = 0;
          if (scrollTurns) scrollOffset += diff;
          select(v);
        });
      });

      function resize() {
        var w = stage.clientWidth, h = stage.clientHeight;
        renderer.setSize(w, h, false);
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
      }
      if ('ResizeObserver' in window) new ResizeObserver(resize).observe(stage);
      else window.addEventListener('resize', resize);
      resize();

      var visible = true, prev = performance.now();
      if ('IntersectionObserver' in window) {
        new IntersectionObserver(function (es) { visible = es[0].isIntersecting; if (visible) prev = performance.now(); })
          .observe(stage);
      }
      function frame(now) {
        requestAnimationFrame(frame);
        if (!visible) return;
        var dt = Math.min(0.05, (now - prev) / 1000); prev = now;
        if (!dragging) {
          if (target !== null) {
            angle += (target - angle) * Math.min(1, dt * 6);
            if (Math.abs(target - angle) < 0.0005) { angle = target; target = null; }
          } else if (Math.abs(velocity) > 0.0005) {
            angle += velocity; velocity *= Math.pow(0.92, dt * 60);
          } else if (scrollTurns && !reduceMotion) {
            angle += (scrollAngle() - angle) * Math.min(1, dt * 5);
          } else if (autoSpin && now - lastInput > IDLE_MS) {
            angle += AUTO_SPEED * dt;
          }
        }
        tilt += (tiltTarget - tilt) * Math.min(1, dt * 8);
        shirt.rotation.y = angle;
        shirt.rotation.x = tilt;
        shirt.position.y = reduceMotion ? 0 : Math.sin(now / 1000) * 0.02;
        renderer.render(scene, camera);
      }
      requestAnimationFrame(frame);
      select('front');
      root.dataset.ready = 'webgl';
    }

    function fallback() {
      canvas.hidden = true;
      var fb = root.querySelector('[data-fallback]'), flip = root.querySelector('[data-flip]');
      var faces = flip.querySelectorAll('img');
      fb.hidden = false;
      applyColor = function (c) { faces.forEach(function (img) { img.src = url(root.dataset.tex, c); }); };
      applyColor(color);
      var deg = 0;
      function turn(d) { deg = d; flip.style.transform = 'rotateY(' + deg + 'deg)'; }
      tabs.forEach(function (b) {
        b.addEventListener('click', function () {
          var v = b.dataset.view;
          turn(v === 'front' ? 0 : v === 'side' ? 90 : v === 'back' ? 180 : deg + 180);
          select(v);
        });
      });
      stage.addEventListener('click', function () { turn(deg + 180); });
      root.dataset.ready = 'fallback';
    }
  }

  function boot() { document.querySelectorAll('[data-moreno-360]').forEach(mount); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  document.addEventListener('shopify:section:load', boot); // editor de temas
})();
