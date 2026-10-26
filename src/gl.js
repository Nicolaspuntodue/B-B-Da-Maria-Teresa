import {
  WebGLRenderer, Scene, PerspectiveCamera, Mesh, Group, PlaneGeometry, BoxGeometry, Shape, ShapeGeometry,
  ShaderMaterial, MeshStandardMaterial, AmbientLight, HemisphereLight, DirectionalLight, PointLight, Color,
  TextureLoader, CanvasTexture, RepeatWrapping, Vector2, Vector4, SRGBColorSpace, MathUtils,
} from 'three';

// Hero: the morning ritual of the house. You stand in a room at Via Sorgimpiano; the green louvered shutters (persiane)
// open onto the gulf of Maratea, and scrolling walks you out of the window. The view is a photograph brought to life by a
// shader (sea ripples, olive leaves, glints) and re-lit for four moments of the day: night, dawn, day, dusk.

const viewVert = /* glsl */`
  varying vec2 vUv;
  void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }
`;

const viewFrag = /* glsl */`
  precision highp float;
  uniform sampler2D uTex, uMask;        // mask: R = sea, G = foliage, B = sky
  uniform vec2 uTexRes, uPlane;
  uniform vec4 uW;                      // light weights: night, dawn, day, dusk
  uniform float uTime, uFocus;
  varying vec2 vUv;

  float hash(vec2 p) { return fract(sin(dot(p, vec2(12.9898, 78.233))) * 43758.5453); }

  void main() {
    // cover-fit the photo on the plane; narrow screens keep the Cristo / gulf (uFocus) in frame
    float rp = uPlane.x / uPlane.y, rt = uTexRes.x / uTexRes.y;
    vec2 s = rp > rt ? vec2(1.0, rt / rp) : vec2(rp / rt, 1.0);
    float cx = clamp(uFocus, s.x * 0.5, 1.0 - s.x * 0.5);
    vec2 uv = vec2((vUv.x - 0.5) * s.x + cx, (vUv.y - 0.5) * s.y + 0.5);

    float t = uTime;
    vec3 mk = texture2D(uMask, uv).rgb;
    vec2 disp = vec2(
      sin(uv.y * 160.0 + t * 1.5) * 0.6 + sin(uv.y * 260.0 - t * 2.0 + uv.x * 24.0) * 0.4,
      sin(uv.x * 90.0 + t * 1.1 + uv.y * 70.0) * 0.3
    ) * 0.0016 * mk.r;
    disp += mk.g * vec2(sin(t * 0.8 + uv.y * 5.0) * 0.0018 + sin(t * 1.9 + uv.x * 11.0) * 0.0007, cos(t * 0.6 + uv.x * 4.0) * 0.0012);
    uv += disp;
    vec3 c = texture2D(uTex, uv).rgb;
    float lum = dot(c, vec3(0.3, 0.59, 0.11));
    float sky = mk.b, sea = mk.r;
    float h = uv.y;                                    // 0 bottom .. 1 top; horizon near 0.53

    // water glints, tinted by the light
    float glint = smoothstep(0.997, 1.0, hash(floor((uv + disp * 4.0) * vec2(460.0, 820.0)) + floor(t * 6.0)))
      * smoothstep(0.6, 0.9, sea) * step(h, 0.53);

    // DAY: the photograph as shot
    vec3 day = c + vec3(1.0, 0.92, 0.75) * glint * smoothstep(0.35, 0.8, lum) * 0.6;

    // DAWN: pink low sky, cool soft land
    vec3 dawnSky = mix(vec3(0.99, 0.78, 0.70), vec3(0.66, 0.74, 0.88), smoothstep(0.5, 0.98, h));
    vec3 dawn = c * vec3(1.0, 0.86, 0.88) * 0.82 + vec3(0.07, 0.03, 0.05);
    dawn = mix(dawn, dawn * 0.7 + vec3(0.30, 0.20, 0.24) * 0.6, sea * 0.5);
    dawn = mix(dawn, dawnSky * (0.92 + 0.12 * lum), sky * 0.92) + vec3(1.0, 0.8, 0.8) * glint * 0.3;

    // DUSK: orange horizon over the sea, warm dark land, sea catching the sky
    vec3 duskSky = mix(vec3(1.0, 0.56, 0.30), vec3(0.32, 0.38, 0.62), smoothstep(0.52, 1.0, h));
    duskSky = mix(duskSky, vec3(1.0, 0.82, 0.55), smoothstep(0.08, 0.0, abs(h - 0.54)) * 0.6);
    vec3 dusk = pow(c, vec3(1.25)) * vec3(1.15, 0.72, 0.52) * 0.78;
    dusk = mix(dusk, mix(vec3(0.85, 0.48, 0.32), vec3(0.22, 0.24, 0.40), smoothstep(0.53, 0.25, h)) * (0.55 + lum * 0.6), sea * 0.75);
    dusk = mix(dusk, duskSky, sky) + vec3(1.0, 0.62, 0.3) * glint * 0.55;

    // NIGHT: blue land, stars, lit windows in the white houses, a little moonlight on the water
    vec3 nightSky = mix(vec3(0.09, 0.12, 0.24), vec3(0.015, 0.025, 0.07), smoothstep(0.5, 1.0, h));
    float star = step(0.9975, hash(floor(vUv * uPlane * 90.0))) * (0.6 + 0.4 * sin(t * 2.0 + hash(floor(vUv * 300.0)) * 6.28));
    nightSky += star * smoothstep(0.58, 0.8, h);
    vec3 night = lum * vec3(0.30, 0.40, 0.70) * 0.5;
    float house = smoothstep(0.74, 0.86, lum) * (1.0 - sky) * (1.0 - sea);
    night += vec3(1.0, 0.72, 0.38) * house * (0.75 + 0.25 * sin(t * 1.3 + uv.x * 40.0));
    night = mix(night, nightSky, sky) + vec3(0.7, 0.8, 1.0) * glint * 0.35;

    vec3 col = uW.x * night + uW.y * dawn + uW.z * day + uW.w * dusk;
    col += (hash(vUv * uPlane * 300.0 + t) - 0.5) * 0.025; // film grain
    gl_FragColor = vec4(col, 1.0);
  }
`;

// light presets for the room: hemisphere sky/ground + intensity, sun colour + intensity, lamp intensity
const ROOM = {
  notte:    { sky: '#3b4a6b', ground: '#1b1712', hemi: 0.35, sun: '#8fa3d6', sunI: 0.35, lamp: 9, fill: 0.15, bounce: 0 },
  alba:     { sky: '#f3d2cc', ground: '#5b4a3c', hemi: 0.9, sun: '#ffc6b0', sunI: 1.6, lamp: 0, fill: 0.9, bounce: 0.9 },
  giorno:   { sky: '#eef2f5', ground: '#6b5a48', hemi: 1.15, sun: '#fff3df', sunI: 2.6, lamp: 0, fill: 1.3, bounce: 1.3 },
  tramonto: { sky: '#f1b98f', ground: '#4a362a', hemi: 0.7, sun: '#ff9a55', sunI: 2.2, lamp: 3, fill: 0.6, bounce: 1.1 },
};
const ORDER = ['notte', 'alba', 'giorno', 'tramonto'];

// lime-wash: a soft blotchy plaster texture painted once on a canvas
function plasterTexture() {
  const c = document.createElement('canvas'); c.width = c.height = 256;
  const g = c.getContext('2d');
  g.fillStyle = '#f1ebe2'; g.fillRect(0, 0, 256, 256);
  for (let i = 0; i < 40; i++) {
    const x = Math.random() * 256, y = Math.random() * 256, r = 40 + Math.random() * 90;
    const blot = g.createRadialGradient(x, y, 0, x, y, r);
    blot.addColorStop(0, `rgba(${Math.random() < 0.5 ? '226,214,198' : '255,252,246'},0.035)`);
    blot.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = blot;
    // drawn on all eight neighbours too, so the tile repeats without seams
    for (const dx of [-256, 0, 256]) for (const dy of [-256, 0, 256]) { g.save(); g.translate(dx, dy); g.fillRect(-dx, -dy, 256, 256); g.restore(); }
  }
  const img = g.getImageData(0, 0, 256, 256);
  for (let i = 0; i < img.data.length; i += 4) { const n = (Math.random() - 0.5) * 5; img.data[i] += n; img.data[i + 1] += n; img.data[i + 2] += n; }
  g.putImageData(img, 0, 0);
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping; t.repeat.set(3, 3); t.colorSpace = SRGBColorSpace;
  return t;
}

// one louvered shutter leaf, hinged at x = 0, extending towards +x (mirror with scale.x = -1)
function makeLeaf(w, h, mat) {
  const leaf = new Group();
  const st = 0.07, d = 0.045;
  const add = (geo, x, y) => { const m = new Mesh(geo, mat); m.position.set(x, y, 0); leaf.add(m); return m; };
  add(new BoxGeometry(st, h, d), st / 2, 0);
  add(new BoxGeometry(st, h, d), w - st / 2, 0);
  add(new BoxGeometry(w, st * 1.4, d), w / 2, h / 2 - st * 0.7);
  add(new BoxGeometry(w, st * 1.4, d), w / 2, -h / 2 + st * 0.7);
  add(new BoxGeometry(w, st, d), w / 2, -h * 0.08);
  const slats = [];
  const inner = h - st * 2.8, n = Math.round(inner / 0.075);
  const sg = new BoxGeometry(w - st * 2, (inner / n) * 1.25, 0.012);
  for (let i = 0; i < n; i++) {
    const y = -h / 2 + st * 1.4 + (i + 0.5) * inner / n;
    if (Math.abs(y + h * 0.08) < st * 0.6) continue;
    slats.push(add(sg, w / 2, y));
  }
  return { leaf, slats };
}

// band(): the free strip of wall between the name and the controls, in px from the top of the canvas;
// the window is fitted inside it so the text never lies on the view
export function initHero(canvas, { src, mask, focus, light, band }) {
  // phones skip antialiasing: dropped frames read as shaking while you walk out of the window
  const phone = matchMedia('(pointer: coarse)').matches || innerWidth < 820;
  const renderer = new WebGLRenderer({ canvas, antialias: !phone, alpha: false, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, phone ? 1.5 : 1.75));
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setClearColor('#1f1a15');

  const scene = new Scene();
  const camera = new PerspectiveCamera(50, 1, 0.05, 60);

  // --- the gulf: a big plane far behind the window
  const uniforms = {
    uTex: { value: null }, uMask: { value: null },
    uTexRes: { value: new Vector2(16, 9) }, uPlane: { value: new Vector2(16, 9) },
    uW: { value: new Vector4() }, uTime: { value: 0 }, uFocus: { value: focus },
  };
  const VIEW_Z = -16;
  const view = new Mesh(new PlaneGeometry(1, 1), new ShaderMaterial({ vertexShader: viewVert, fragmentShader: viewFrag, uniforms, depthWrite: false }));
  view.position.z = VIEW_Z;
  scene.add(view);

  // --- the room wall with the window opening, its deep reveal, and the persiane outside
  const plaster = new MeshStandardMaterial({ color: '#efe6d9', map: plasterTexture(), roughness: 0.95 });
  const paint = new MeshStandardMaterial({ color: '#3a4a2e', roughness: 0.6, metalness: 0.05 });
  const sill = new MeshStandardMaterial({ color: '#b9a48d', roughness: 0.8 });
  const room = new Group();
  scene.add(room);
  const DEPTH = 0.22;
  let leaves = [], slats = [], Wo = 0, Ho = 0;

  function buildRoom(portrait) {
    room.clear(); leaves = []; slats = [];
    Wo = portrait ? 1.5 : 2.8; Ho = portrait ? 2.0 : 2.1;
    const big = 40;
    const wall = new Shape();
    wall.moveTo(-big, -big); wall.lineTo(big, -big); wall.lineTo(big, big); wall.lineTo(-big, big); wall.lineTo(-big, -big);
    const hole = new Shape();
    hole.moveTo(-Wo / 2, -Ho / 2); hole.lineTo(-Wo / 2, Ho / 2); hole.lineTo(Wo / 2, Ho / 2); hole.lineTo(Wo / 2, -Ho / 2); hole.lineTo(-Wo / 2, -Ho / 2);
    wall.holes.push(hole);
    room.add(new Mesh(new ShapeGeometry(wall), plaster));
    // reveal: the faces of the wall's thickness, and the stone sill
    const rv = (w, h, d, x, y, m = plaster) => { const b = new Mesh(new BoxGeometry(w, h, d), m); b.position.set(x, y, -d / 2); room.add(b); };
    rv(0.02, Ho, DEPTH, -Wo / 2 - 0.01, 0);
    rv(0.02, Ho, DEPTH, Wo / 2 + 0.01, 0);
    rv(Wo + 0.04, 0.02, DEPTH, 0, Ho / 2 + 0.01);
    rv(Wo + 0.3, 0.05, DEPTH + 0.1, 0, -Ho / 2 - 0.025, sill);
    // two leaves on the outer face, hinged at the opening's sides
    for (const side of [-1, 1]) {
      const { leaf, slats: s } = makeLeaf(Wo / 2, Ho, paint);
      const hinge = new Group();
      hinge.position.set(side * Wo / 2, 0, -DEPTH - 0.03);
      leaf.scale.x = -side; // left leaf grows to +x, right leaf to -x
      hinge.add(leaf);
      room.add(hinge);
      leaves.push({ hinge, side });
      slats.push(...s);
    }
  }

  const hemi = new HemisphereLight('#eef2f5', '#6b5a48', 1);
  const sun = new DirectionalLight('#fff3df', 2.4);
  sun.position.set(-3, 4, -8);
  const lamp = new PointLight('#ffb36b', 0, 7, 1.6);
  lamp.position.set(-1.6, -1.3, 1.4); // a low lamp: the wall stays dark up where the name is
  const fill = new AmbientLight('#fff1e0', 1); // light bounced into the room off the floor
  const bounce = new PointLight('#ffe9cf', 0, 4.5, 1.4); // daylight off the sill, warming the wall round the window
  scene.add(hemi, sun, sun.target, lamp, fill, bounce);

  // --- state driven from outside: intro (0 closed .. 1 open), scroll (0 at the window .. 1 out on the gulf)
  const state = { intro: 0, scroll: 0 };
  const target = ORDER.map((k) => (k === light ? 1 : 0));
  const w = target.slice();
  let aspect = 1, rest = 3, near = 2, lift = 0, open = 1.7;

  let size = '';
  function layout() {
    const cw = canvas.clientWidth, ch = canvas.clientHeight;
    const key = `${cw}x${ch}`;
    if (key === size) return; // a phone's URL bar hiding fires resize with nothing to change: keep the scene still
    size = key;
    renderer.setSize(cw, ch, false);
    aspect = cw / ch;
    const portrait = aspect < 0.9;
    if (!Wo || portrait !== (Wo < 2)) buildRoom(portrait);
    camera.aspect = aspect;
    const tn = 2 * Math.tan(MathUtils.degToRad(25));
    // rest: the whole window in its wall, fitted between the name (above) and the controls (below)
    const { top, bottom } = band ? band() : { top: ch * 0.13, bottom: ch * 0.87 };
    const avail = Math.max(bottom - top, ch * 0.3);
    const fw = portrait ? 0.82 : 0.64;
    rest = Math.max(Wo / (fw * tn * aspect), (Ho * 1.08 * ch) / (avail * tn));
    lift = (((top + bottom) / 2 - ch / 2) / ch) * rest * tn; // camera up = window lower on screen
    // start: up close, the closed shutters fill the screen
    near = Math.max(0.5, Math.min(Wo / (tn * aspect), Ho / tn) * 0.94 - DEPTH);
    open = portrait ? 1.45 : 1.7; // how far the leaves stand open at rest (rad): narrower on a phone so they stay in view
    bounce.position.set(0, -Ho / 2 + 0.2, 1.1);
    // the view plane fills the frustum from any camera position we use
    const dist = rest + 0.5 - VIEW_Z;
    const ph = dist * tn * 1.15, pw = ph * Math.max(aspect * 1.15, 16 / 9);
    view.scale.set(pw, ph, 1);
    uniforms.uPlane.value.set(pw, ph);
  }
  layout();
  addEventListener('resize', layout);

  const loader = new TextureLoader();
  const ready = Promise.all([loader.loadAsync(src), loader.loadAsync(mask)]).then(([tex, m]) => {
    tex.colorSpace = SRGBColorSpace;
    uniforms.uTex.value = tex; uniforms.uMask.value = m;
    uniforms.uTexRes.value.set(tex.image.width, tex.image.height);
    return new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  });

  const acc = new Color(), tmp = new Color();
  const blendColor = (key) => ORDER.reduce((a, k, i) => a.add(tmp.set(ROOM[k][key]).multiplyScalar(w[i])), acc.set(0, 0, 0));
  const blendNum = (key) => ORDER.reduce((s, k, i) => s + ROOM[k][key] * w[i], 0);
  function applyLight() {
    uniforms.uW.value.set(w[0], w[1], w[2], w[3]);
    hemi.color.copy(blendColor('sky')); hemi.groundColor.copy(blendColor('ground'));
    sun.color.copy(blendColor('sun'));
    hemi.intensity = blendNum('hemi'); sun.intensity = blendNum('sunI'); lamp.intensity = blendNum('lamp'); fill.intensity = blendNum('fill'); bounce.intensity = blendNum('bounce');
  }

  let visible = true, raf = 0, last = performance.now(), sc = 0;
  function frame(now) {
    raf = 0;
    if (!visible || document.hidden) return;
    const dt = Math.min((now - last) / 1000, 0.05);
    last = now;
    uniforms.uTime.value += dt;
    for (let i = 0; i < 4; i++) w[i] += (target[i] - w[i]) * Math.min(1, dt * 2.2);
    applyLight();

    // touch scrolling reports its position in uneven jumps: the camera follows a damped copy of it, never the raw value
    sc += (state.scroll - sc) * (1 - Math.exp(-dt * 8));
    if (Math.abs(state.scroll - sc) < 1e-4) sc = state.scroll;
    const io = state.intro;
    // the morning, in order: the slats tilt and let the light in, the leaves swing out, you step back to see the window
    const slat = MathUtils.smoothstep(io, 0, 0.32) * 1.05;
    for (const s of slats) s.rotation.x = slat;
    const swing = MathUtils.smootherstep(io, 0.2, 0.78) * open + MathUtils.smoothstep(sc, 0, 0.5) * (2.5 - open);
    for (const { hinge, side } of leaves) hinge.rotation.y = -side * swing; // positive = away from the room for the left leaf
    const back = MathUtils.smootherstep(io, 0.12, 1);
    const z0 = MathUtils.lerp(near, rest, back);
    const y = lift * back * (1 - sc);
    // scrolling walks out over the sill towards the sea
    // no pointer parallax: the window stays perfectly still (a finger scrolling on a phone made it shake)
    camera.position.set(0, y + sc * 0.12, z0 - sc * (z0 + DEPTH + 1.6));
    camera.fov = 50 - sc * 12;
    camera.updateProjectionMatrix();
    camera.lookAt(0, y + sc * 0.1, -6);
    renderer.render(scene, camera);
    raf = requestAnimationFrame(frame);
  }
  const start = () => { if (!raf) { last = performance.now(); raf = requestAnimationFrame(frame); } };
  new IntersectionObserver(([en]) => { visible = en.isIntersecting; if (visible) start(); }).observe(canvas);
  document.addEventListener('visibilitychange', start);
  start();

  return {
    ready,
    state,
    relayout() { size = ''; layout(); }, // after the fonts settle, the band may have moved
    debug: () => ({ rest, lift, aspect, Wo, Ho, z: camera.position.z, cw: canvas.clientWidth, ch: canvas.clientHeight }),
    setLight(name) { ORDER.forEach((k, i) => { target[i] = k === name ? 1 : 0; }); },
  };
}
