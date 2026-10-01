/* Visor 3D de la camiseta (three.js r128, sin bundler).
 *
 * La prenda son dos planos muy subdivididos (frente y espalda) recortados con la
 * transparencia de su textura y "inflados" con un mapa de volumen, de modo que
 * sus bordes se juntan y forman un volumen continuo que se puede girar 360°.
 * Si no hay WebGL se muestra una tarjeta CSS que voltea entre frente y espalda.
 */
(function () {
  'use strict';

  var ASSETS = {
    front: 'assets/img/shirt-front.webp',
    back: 'assets/img/shirt-back.webp',
    height: 'assets/img/shirt-height.png'
  };
  var VIEWS = { front: 0, side: Math.PI / 2, back: Math.PI };
  var SIZE = 2;          // lado del plano en unidades de escena
  var DEPTH = 0.14;      // grosor máximo de cada cara
  var SEGMENTS = 220;
  var AUTO_SPEED = 0.35; // rad/s
  var IDLE_MS = 3000;

  var stage = document.getElementById('viewerStage');
  if (!stage) return;
  var canvas = document.getElementById('viewerCanvas');
  var hint = document.getElementById('viewerHint');
  var tabs = document.querySelectorAll('.segmented [data-view]');
  var reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  function select(view) {
    tabs.forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.view === view)); });
  }

  function hasWebGL() {
    try {
      var c = document.createElement('canvas');
      return !!(window.WebGLRenderingContext && (c.getContext('webgl2') || c.getContext('webgl')));
    } catch (e) { return false; }
  }

  if (!window.THREE || !hasWebGL()) return fallback();

  function loadImage(src) {
    return new Promise(function (resolve, reject) {
      var img = new Image();
      img.onload = function () { resolve(img); };
      img.onerror = reject;
      img.src = src;
    });
  }

  Promise.all([loadImage(ASSETS.front), loadImage(ASSETS.back), loadImage(ASSETS.height)])
    .then(function (imgs) { init(imgs[0], imgs[1], imgs[2]); })
    .catch(fallback);

  function init(frontImg, backImg, heightImg) {
    var THREE = window.THREE;
    var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.outputEncoding = THREE.sRGBEncoding;
    renderer.setClearColor(0x000000, 0);

    var scene = new THREE.Scene();
    var camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
    camera.position.set(0, 0.05, 5.4);

    scene.add(new THREE.HemisphereLight(0xffffff, 0xb9ab98, 0.7));
    var key = new THREE.DirectionalLight(0xfff4e6, 0.75);
    key.position.set(-2.5, 3, 4);
    scene.add(key);
    var fill = new THREE.DirectionalLight(0xffffff, 0.45);
    fill.position.set(3, 1, -4);
    scene.add(fill);

    // Mapa de volumen -> array de alturas 0..1
    var hc = document.createElement('canvas');
    hc.width = heightImg.width; hc.height = heightImg.height;
    var hctx = hc.getContext('2d');
    hctx.drawImage(heightImg, 0, 0);
    var hdata = hctx.getImageData(0, 0, hc.width, hc.height).data;
    function px(x, y) {
      x = Math.min(hc.width - 1, Math.max(0, x)); y = Math.min(hc.height - 1, Math.max(0, y));
      return hdata[(y * hc.width + x) * 4] / 255;
    }
    function heightAt(u, v) { // bilineal, para que el borde no salga escalonado
      var fx = u * (hc.width - 1), fy = (1 - v) * (hc.height - 1);
      var x0 = Math.floor(fx), y0 = Math.floor(fy), tx = fx - x0, ty = fy - y0;
      var top = px(x0, y0) * (1 - tx) + px(x0 + 1, y0) * tx;
      var bot = px(x0, y0 + 1) * (1 - tx) + px(x0 + 1, y0 + 1) * tx;
      return top * (1 - ty) + bot * ty;
    }

    function texture(img) {
      var t = new THREE.Texture(img);
      t.encoding = THREE.sRGBEncoding;
      t.anisotropy = renderer.capabilities.getMaxAnisotropy();
      t.needsUpdate = true;
      return t;
    }

    // mirror=true para el frente: su textura está espejada respecto al mapa de volumen.
    function face(img, mirror) {
      var geo = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS);
      var pos = geo.attributes.position;
      var uv = geo.attributes.uv;
      for (var i = 0; i < pos.count; i++) {
        var u = uv.getX(i), v = uv.getY(i);
        pos.setZ(i, DEPTH * heightAt(mirror ? 1 - u : u, v));
      }
      geo.computeVertexNormals();
      // Lambert (sin especular): evita el brillo de Fresnel en el canto donde se unen las caras.
      var mat = new THREE.MeshLambertMaterial({ map: texture(img), alphaTest: 0.5 });
      mat.alphaToCoverage = true; // bordes suavizados con MSAA
      return new THREE.Mesh(geo, mat);
    }

    var shirt = new THREE.Group();
    var front = face(frontImg, true);
    var back = face(backImg, false);
    back.rotation.y = Math.PI;
    shirt.add(front, back);
    shirt.position.y = 0.04;
    scene.add(shirt);

    // ---- Interacción ----
    var angle = VIEWS.back, target = null, velocity = 0, tilt = 0, tiltTarget = 0;
    var dragging = false, lastX = 0, lastY = 0, lastT = 0, lastInput = 0, autoSpin = !reduceMotion;
    var startX = 0, startY = 0, decided = false;
    shirt.rotation.y = angle;

    function bump() { lastInput = performance.now(); if (hint) hint.classList.add('is-hidden'); }

    stage.addEventListener('pointerdown', function (e) {
      dragging = true; decided = false;
      startX = lastX = e.clientX; startY = lastY = e.clientY; lastT = performance.now();
      target = null; velocity = 0; bump();
    });
    window.addEventListener('pointermove', function (e) {
      if (!dragging) return;
      var dx = e.clientX - lastX, dy = e.clientY - lastY;
      // En táctil, un gesto mayormente vertical se deja para hacer scroll.
      if (!decided) {
        if (Math.abs(e.clientX - startX) + Math.abs(e.clientY - startY) < 6) return;
        decided = true;
        if (e.pointerType !== 'mouse' && Math.abs(e.clientY - startY) > Math.abs(e.clientX - startX)) { dragging = false; return; }
        stage.classList.add('is-dragging');
        try { stage.setPointerCapture(e.pointerId); } catch (err) { /* noop */ }
      }
      var now = performance.now(), dt = Math.max(1, now - lastT);
      var d = dx * 0.0105;
      angle += d;
      velocity = d / dt * 16;
      tiltTarget = Math.max(-0.22, Math.min(0.22, tiltTarget + dy * 0.004));
      lastX = e.clientX; lastY = e.clientY; lastT = now; bump();
      select('');
    });
    function release() {
      if (!dragging) return;
      dragging = false; stage.classList.remove('is-dragging'); tiltTarget = 0; bump();
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
        // Camino más corto hasta el ángulo pedido.
        var goal = VIEWS[v], twoPi = Math.PI * 2;
        var diff = ((goal - angle) % twoPi + twoPi * 1.5) % twoPi - Math.PI;
        target = angle + diff; velocity = 0;
        select(v);
      });
    });

    // ---- Tamaño y bucle ----
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
        } else if (autoSpin && now - lastInput > IDLE_MS) {
          angle += AUTO_SPEED * dt;
        }
      }
      tilt += (tiltTarget - tilt) * Math.min(1, dt * 8);
      shirt.rotation.y = angle;
      shirt.rotation.x = tilt;
      shirt.position.y = 0.04 + (reduceMotion ? 0 : Math.sin(now / 1000) * 0.02);
      renderer.render(scene, camera);
    }
    requestAnimationFrame(frame);
    select('back');
    stage.dataset.ready = 'webgl';
  }

  function fallback() {
    canvas.hidden = true;
    var fb = document.getElementById('viewerFallback');
    var flip = document.getElementById('flip');
    fb.hidden = false;
    var deg = 0;
    tabs.forEach(function (b) {
      b.addEventListener('click', function () {
        var v = b.dataset.view;
        deg = v === 'front' ? 180 : v === 'side' ? 90 : v === 'back' ? 0 : deg + 180;
        flip.style.transform = 'rotateY(' + deg + 'deg)';
        select(v);
      });
    });
    stage.addEventListener('click', function () { deg += 180; flip.style.transform = 'rotateY(' + deg + 'deg)'; });
    stage.dataset.ready = 'fallback';
  }
})();
