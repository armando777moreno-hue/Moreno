/* MORENO.co — visor 3D 360° para el tema de Shopify (versión de js/viewer.js
 * que admite varias instancias y toma las URLs de las texturas de atributos data-).
 * Requiere three.js r128 (window.THREE), que la sección carga antes que este archivo.
 */
(function () {
  'use strict';

  var VIEWS = { front: 0, side: Math.PI / 2, back: Math.PI };
  var SIZE = 2, DEPTH = 0.14, SEGMENTS = 220, AUTO_SPEED = 0.35, IDLE_MS = 3000;
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
      img.crossOrigin = 'anonymous'; // las texturas viven en el CDN de Shopify
      img.onload = function () { resolve(img); };
      img.onerror = reject;
      img.src = src;
    });
  }

  function setup(root) {
    if (root.dataset.ready) return;
    var stage = root.querySelector('[data-stage]');
    var canvas = root.querySelector('canvas');
    var hint = root.querySelector('[data-hint]');
    var tabs = root.querySelectorAll('[data-view]');
    function select(view) {
      tabs.forEach(function (b) { b.setAttribute('aria-selected', String(b.dataset.view === view)); });
    }

    if (!window.THREE || !hasWebGL()) return fallback();
    Promise.all([loadImage(root.dataset.front), loadImage(root.dataset.back), loadImage(root.dataset.height)])
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

      var hc = document.createElement('canvas');
      hc.width = heightImg.width; hc.height = heightImg.height;
      var hctx = hc.getContext('2d');
      hctx.drawImage(heightImg, 0, 0);
      var hdata = hctx.getImageData(0, 0, hc.width, hc.height).data;
      function px(x, y) {
        x = Math.min(hc.width - 1, Math.max(0, x)); y = Math.min(hc.height - 1, Math.max(0, y));
        return hdata[(y * hc.width + x) * 4] / 255;
      }
      function heightAt(u, v) {
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
      function face(img, mirror) {
        var geo = new THREE.PlaneGeometry(SIZE, SIZE, SEGMENTS, SEGMENTS);
        var pos = geo.attributes.position, uv = geo.attributes.uv;
        for (var i = 0; i < pos.count; i++) {
          var u = uv.getX(i), v = uv.getY(i);
          pos.setZ(i, DEPTH * heightAt(mirror ? 1 - u : u, v));
        }
        geo.computeVertexNormals();
        var mat = new THREE.MeshLambertMaterial({ map: texture(img), alphaTest: 0.5 });
        mat.alphaToCoverage = true;
        return new THREE.Mesh(geo, mat);
      }

      var shirt = new THREE.Group();
      var back = face(backImg, false);
      back.rotation.y = Math.PI;
      shirt.add(face(frontImg, true), back);
      scene.add(shirt);

      var angle = VIEWS.back, target = null, velocity = 0, tilt = 0, tiltTarget = 0;
      var dragging = false, decided = false, lastX = 0, lastY = 0, startX = 0, startY = 0, lastT = 0;
      var lastInput = 0, autoSpin = !reduceMotion;

      function bump() { lastInput = performance.now(); if (hint) hint.classList.add('is-hidden'); }

      stage.addEventListener('pointerdown', function (e) {
        dragging = true; decided = false;
        startX = lastX = e.clientX; startY = lastY = e.clientY; lastT = performance.now();
        target = null; velocity = 0; bump();
      });
      window.addEventListener('pointermove', function (e) {
        if (!dragging) return;
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
          var twoPi = Math.PI * 2;
          var diff = ((VIEWS[v] - angle) % twoPi + twoPi * 1.5) % twoPi - Math.PI;
          target = angle + diff; velocity = 0;
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
      root.dataset.ready = 'webgl';
    }

    function fallback() {
      canvas.hidden = true;
      var fb = root.querySelector('[data-fallback]'), flip = root.querySelector('[data-flip]');
      fb.hidden = false;
      var deg = 0;
      function turn(d) { deg = d; flip.style.transform = 'rotateY(' + deg + 'deg)'; }
      tabs.forEach(function (b) {
        b.addEventListener('click', function () {
          var v = b.dataset.view;
          turn(v === 'front' ? 180 : v === 'side' ? 90 : v === 'back' ? 0 : deg + 180);
          select(v);
        });
      });
      stage.addEventListener('click', function () { turn(deg + 180); });
      root.dataset.ready = 'fallback';
    }
  }

  function boot() { document.querySelectorAll('[data-moreno-360]').forEach(setup); }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  // Editor de temas: re-inicializar cuando se añade o recarga la sección.
  document.addEventListener('shopify:section:load', boot);
})();
