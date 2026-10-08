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
 *
 * Modo modelo (peluche): data-model="…/modelo.json" con data-atlas="…/atlas.webp" y
 * data-mesh="…/modelo.bin" (los genera tools/build_peluche.py). Es una malla cerrada
 * sobre la que se proyectan las fotos reales de cada vista; se apoya en un suelo que
 * recibe su sombra. data-front / data-back son las fotos del respaldo sin WebGL.
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
    if (root.dataset.model) {
      Promise.all([
        fetch(root.dataset.model).then(function (r) { if (!r.ok) throw r; return r.json(); }),
        fetch(root.dataset.mesh).then(function (r) { if (!r.ok) throw r; return r.arrayBuffer(); }),
        loadImage(root.dataset.atlas)
      ]).then(function (res) { initModel(res[0], res[1], res[2]); }).catch(fallback);
      return;
    }
    Promise.all([loadImage(url(root.dataset.tex, color)), loadImage(url(root.dataset.height, color))])
      .then(function (imgs) { init(imgs[0], imgs[1]); })
      .catch(fallback);

    function stageSetup(opts) {
      var THREE = window.THREE;
      var renderer = new THREE.WebGLRenderer({ canvas: canvas, antialias: true, alpha: true });
      renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      renderer.outputEncoding = THREE.sRGBEncoding;
      renderer.setClearColor(0x000000, 0);
      if (opts.shadow) {
        renderer.shadowMap.enabled = true;
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      }
      var scene = new THREE.Scene();
      var camera = new THREE.PerspectiveCamera(30, 1, 0.1, 50);
      return { THREE: THREE, renderer: renderer, scene: scene, camera: camera };
    }

    function init(texImg, heightImg) {
      var st = stageSetup({}), THREE = st.THREE, renderer = st.renderer, scene = st.scene, camera = st.camera;
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

      animate(st, function (angle, tilt, now) {
        shirt.rotation.y = angle;
        shirt.rotation.x = tilt;
        shirt.position.y = reduceMotion ? 0 : Math.sin(now / 1000) * 0.02;
      });
    }

    // Peluche: malla del volumen + fotos proyectadas por vista, sobre un suelo con sombra.
    function initModel(meta, buf, atlasImg) {
      var st = stageSetup({ shadow: true }), THREE = st.THREE, renderer = st.renderer, scene = st.scene, camera = st.camera;
      var HEIGHT = 1.6;                                   // alto del peluche en la escena
      camera.position.set(0, 0.95, 4.7);
      camera.lookAt(0, 0.72, 0);

      // Malla: posiciones Uint16 normalizadas a la caja, 5 pesos Uint8 por vértice, índices Uint16.
      var n = meta.vertices, lo = meta.min, hi = meta.max;
      var q = new Uint16Array(buf, 0, n * 3), w = new Uint8Array(buf, n * 6, n * 5);
      var idxOff = n * 6 + n * 5 + ((n * 5) % 2);
      var idx = new Uint16Array(buf, idxOff, meta.indices);
      var pos = new Float32Array(n * 3), w4 = new Uint8Array(n * 4), w1 = new Uint8Array(n);
      for (var i = 0; i < n; i++) {
        for (var k = 0; k < 3; k++) pos[i * 3 + k] = lo[k] + q[i * 3 + k] / 65535 * (hi[k] - lo[k]);
        for (k = 0; k < 4; k++) w4[i * 4 + k] = w[i * 5 + k];
        w1[i] = w[i * 5 + 4];
      }
      var geo = new THREE.BufferGeometry();
      geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
      geo.setAttribute('pesos', new THREE.BufferAttribute(w4, 4, true));
      geo.setAttribute('pesoArriba', new THREE.BufferAttribute(w1, 1, true));
      geo.setIndex(new THREE.BufferAttribute(idx, 1));
      geo.computeVertexNormals();

      var tex = new THREE.Texture(atlasImg);
      tex.flipY = false;                                  // la proyección cuenta filas desde arriba
      tex.anisotropy = renderer.capabilities.getMaxAnisotropy();
      tex.needsUpdate = true;
      var P = meta.proyeccion, order = meta.vistas, U = [], V = [];
      order.forEach(function (name) {
        U.push(new THREE.Vector4().fromArray(P[name][0]));
        V.push(new THREE.Vector4().fromArray(P[name][1]));
      });
      var mat = new THREE.ShaderMaterial({
        uniforms: { atlas: { value: tex }, U: { value: U }, V: { value: V }, luz: { value: new THREE.Vector3(-0.45, 0.6, 0.66).normalize() } },
        vertexShader: [
          'attribute vec4 pesos; attribute float pesoArriba;',
          'varying vec4 vW; varying float vTop; varying vec3 vP; varying vec3 vN;',
          'void main() {',
          '  vW = pesos; vTop = pesoArriba; vP = position;',
          '  vN = normalize(mat3(modelMatrix) * normal);',
          '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
          '}'
        ].join('\n'),
        fragmentShader: [
          'uniform sampler2D atlas; uniform vec4 U[5]; uniform vec4 V[5]; uniform vec3 luz;',
          'varying vec4 vW; varying float vTop; varying vec3 vP; varying vec3 vN;',
          'vec3 vista(int i) { vec4 p = vec4(vP, 1.0); return texture2D(atlas, vec2(dot(U[i], p), dot(V[i], p))).rgb; }',
          'void main() {',
          '  float s = vW.x + vW.y + vW.z + vW.w + vTop;',
          '  vec3 c = (vista(0) * vW.x + vista(1) * vW.y + vista(2) * vW.z + vista(3) * vW.w + vista(4) * vTop) / max(s, 1e-3);',
          // Las fotos ya traen su luz de estudio: aquí solo se suma un poco de volumen.
          '  vec3 n = normalize(vN);',
          '  float l = 0.86 + 0.2 * max(dot(n, luz), 0.0) - 0.08 * max(-n.y, 0.0);',
          '  gl_FragColor = vec4(c * l, 1.0);',
          '}'
        ].join('\n')
      });
      var mesh = new THREE.Mesh(geo, mat);
      var scale = HEIGHT / meta.altura;
      mesh.scale.setScalar(scale);
      mesh.position.set(-meta.centro[0] * scale, -meta.base * scale, -meta.centro[1] * scale);
      mesh.castShadow = true;
      var plush = new THREE.Group();
      plush.add(mesh);

      // Suelo: solo se ve la sombra (la proyectada y una de contacto, difusa, justo debajo).
      var floor = new THREE.Mesh(new THREE.PlaneGeometry(8, 8), new THREE.ShadowMaterial({ opacity: 0.2 }));
      floor.rotation.x = -Math.PI / 2;
      floor.receiveShadow = true;
      var blob = document.createElement('canvas');
      blob.width = blob.height = 128;
      var g = blob.getContext('2d'), grad = g.createRadialGradient(64, 64, 0, 64, 64, 64);
      grad.addColorStop(0, 'rgba(40,30,20,0.55)'); grad.addColorStop(0.55, 'rgba(40,30,20,0.18)'); grad.addColorStop(1, 'rgba(40,30,20,0)');
      g.fillStyle = grad; g.fillRect(0, 0, 128, 128);
      var contact = new THREE.Mesh(new THREE.PlaneGeometry(1.5, 1.15), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(blob), transparent: true, depthWrite: false }));
      contact.rotation.x = -Math.PI / 2;
      contact.position.y = 0.002;

      var sun = new THREE.DirectionalLight(0xffffff, 1);
      sun.position.set(-1.6, 3.4, 1.8);
      sun.castShadow = true;
      sun.shadow.mapSize.set(1024, 1024);
      sun.shadow.radius = 6;
      sun.shadow.bias = -0.002;
      var sc = sun.shadow.camera;
      sc.left = -1.6; sc.right = 1.6; sc.top = 1.6; sc.bottom = -1.6; sc.near = 0.5; sc.far = 8;

      var world = new THREE.Group();                      // inclinar = mover la cámara alrededor
      world.add(plush, floor, contact, sun, sun.target);
      scene.add(world);

      animate(st, function (angle, tilt) {
        plush.rotation.y = angle;
        world.rotation.x = tilt * 0.6;
      });
    }

    function animate(st, pose) {
      var renderer = st.renderer, scene = st.scene, camera = st.camera;
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
      // Empieza de frente esté donde esté el visor al cargar; el giro cuenta desde ahí.
      if (scrollTurns) scrollOffset = angle - scrollAngle();

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
        pose(angle, tilt, now);
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
      if (root.dataset.model) { // peluche: foto de frente y de espalda
        faces[0].src = root.dataset.front; faces[1].src = root.dataset.back || root.dataset.front;
      } else {
        applyColor = function (c) { faces.forEach(function (img) { img.src = url(root.dataset.tex, c); }); };
        applyColor(color);
      }
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

  // Con data-lazy el visor se monta (y descarga su modelo) solo cuando aparece en pantalla;
  // si está oculto con [hidden], espera a que se muestre.
  function boot() {
    var io = 'IntersectionObserver' in window ? new IntersectionObserver(function (es) {
      es.forEach(function (e) { if (e.isIntersecting) { io.unobserve(e.target); mount(e.target); } });
    }, { rootMargin: '200px' }) : null;
    document.querySelectorAll('[data-moreno-360]').forEach(function (el) {
      if (io && el.hasAttribute('data-lazy')) io.observe(el); else mount(el);
    });
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot); else boot();
  document.addEventListener('shopify:section:load', boot); // editor de temas
})();
