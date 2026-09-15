// The showroom: one WebGL stage, three cars, a light rig that scroll can dim and raise.
import * as THREE from 'three';
import gsap from 'gsap';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { MeshoptDecoder } from 'three/addons/libs/meshopt_decoder.module.js';
import { Reflector } from 'three/addons/objects/Reflector.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';

const CAR_LENGTH = 4.6;
const LINEUP_GAP = 3.1;
const MIRROR_SCALE = 0.4; // reflection resolution relative to the canvas; it sits under a dark satin overlay
const LAYER_DECALS = 1;   // floor overlays and dust: seen by the main camera, skipped by the mirror

export const CARS = [
  { key: 'mustang', file: 'mustang.glb', paint: /^Color_04$/ },
  { key: 'nsx',     file: 'nsx.glb',     paint: /NSXPaint/ },
  { key: 'roma',    file: 'roma.glb',    paint: /Paint_Material/ },
];

// Chapter swatch defaults, so each car arrives in its "hero" colour.
const DEFAULT_PAINT = [
  { hex: '#0f1f4d', metal: 0.45, rough: 0.32 },
  { hex: '#ff5a00', metal: 0.35, rough: 0.22 },
  { hex: '#b5080e', metal: 0.08, rough: 0.3 },
];

const nextFrame = () => new Promise((r) => requestAnimationFrame(r));
// Give the browser a turn (input, scrolling, painting) between chunks of setup work.
const yieldToPage = () => (globalThis.scheduler?.yield ? scheduler.yield() : new Promise((r) => setTimeout(r, 0)));

function radialTexture(stops, size = 256) {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const g = c.getContext('2d');
  const grad = g.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  for (const [o, col] of stops) grad.addColorStop(o, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, size, size);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// A studio made of light panels, baked once into a PMREM map for paint reflections.
function buildStudioEnvironment(renderer) {
  const env = new THREE.Scene();
  const room = new THREE.Mesh(
    new THREE.BoxGeometry(40, 16, 40),
    new THREE.MeshBasicMaterial({ color: 0x050506, side: THREE.BackSide })
  );
  room.position.y = 6;
  env.add(room);

  const panel = (w, h, intensity, tint = 0xffffff) => {
    const m = new THREE.MeshBasicMaterial({ color: new THREE.Color(tint).multiplyScalar(intensity), side: THREE.DoubleSide });
    return new THREE.Mesh(new THREE.PlaneGeometry(w, h), m);
  };
  // Three long overhead strips; they become the signature highlight lines on the paint.
  for (const x of [-2.2, 0, 2.2]) {
    const s = panel(0.45, 18, 4);
    s.rotation.x = Math.PI / 2;
    s.position.set(x, 9, 0);
    env.add(s);
  }
  // Large soft side boxes.
  for (const side of [-1, 1]) {
    const s = panel(10, 4, 1.6);
    s.rotation.y = (side * Math.PI) / 2;
    s.position.set(side * 14, 4, 0);
    env.add(s);
  }
  // Warm rim from behind, cool fill from the front.
  const rim = panel(16, 3, 1.4, 0xffd8a8);
  rim.position.set(0, 3, -16);
  env.add(rim);
  const fill = panel(12, 2, 0.7, 0xbfd4ff);
  fill.position.set(0, 2.5, 16);
  fill.rotation.y = Math.PI;
  env.add(fill);

  const pmrem = new THREE.PMREMGenerator(renderer);
  const tex = pmrem.fromScene(env, 0.03).texture;
  pmrem.dispose();
  env.traverse((o) => { if (o.isMesh) { o.geometry.dispose(); o.material.dispose(); } });
  return tex;
}

// The converted Ferrari arrives with every material set to "blend" and identical PBR values.
function tuneRomaMaterial(m) {
  const n = m.name;
  const set = (props) => Object.assign(m, props);
  set({ transparent: false, depthWrite: true, opacity: 1, alphaTest: 0 });
  if (/Window/.test(n)) set({ transparent: true, opacity: 0.55, depthWrite: false, color: new THREE.Color(0x050608), metalness: 0, roughness: 0.02 });
  else if (/RED_GLASS/.test(n)) set({ transparent: true, opacity: 0.8, metalness: 0.1, roughness: 0.05 });
  else if (/Badge|Grille/.test(n)) set({ alphaTest: 0.5, metalness: 0.6, roughness: 0.35 });
  else if (/CHROME/.test(n)) set({ metalness: 1, roughness: 0.12, color: new THREE.Color(0xd0d0d0) });
  else if (/Base/.test(n)) set({ metalness: 0, roughness: 0.85 });
  else if (/Coloured/.test(n)) set({ metalness: 0.2, roughness: 0.55 });
  else if (/Carbon/.test(n)) set({ metalness: 0.3, roughness: 0.35 });
  else if (/Interior|SeatBelt/.test(n)) set({ metalness: 0, roughness: 0.75 });
  else if (/Wheel/.test(n)) set({ metalness: 0.75, roughness: 0.3 });
  else if (/Calliper/.test(n)) set({ color: new THREE.Color(0xd9a520), metalness: 0.2, roughness: 0.25 });
  else if (/Light/.test(n)) set({ metalness: 0.4, roughness: 0.1 });
  else if (/Engine/.test(n)) set({ metalness: 0.5, roughness: 0.45 });
  m.needsUpdate = true;
}

function makePaint(src) {
  const p = new THREE.MeshPhysicalMaterial({
    name: 'HaldenPaint',
    color: new THREE.Color(0x888888),
    metalness: 0.4,
    roughness: 0.3,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
    envMapIntensity: 1.25,
  });
  if (src.map) p.map = src.map;
  if (src.normalMap) p.normalMap = src.normalMap;
  return p;
}

export class Showroom {
  constructor(canvas, { mobile = false, reducedMotion = false, debug = false, msaa } = {}) {
    this.mobile = mobile;
    this.reducedMotion = reducedMotion;
    this.canvas = canvas;
    this.cars = [];
    this.paints = [];
    this.ready = CARS.map(() => false);
    this.light = 0; // 0 = dark room, 1 = fully lit
    this.bars = 0;
    this.scene_ = -2;
    this.viewShift = { x: 0, y: 0 };
    this.busyUntil = 0;

    // Resolution is adaptive: start sensible, then let measured frame times move it.
    const deviceDpr = window.devicePixelRatio || 1;
    this.maxDpr = Math.min(deviceDpr, mobile ? 1.5 : 2);
    this.minDpr = mobile ? 0.75 : 1;
    this.dpr = Math.min(this.maxDpr, mobile ? 1.25 : 1.5);
    this.perf = { acc: 0, frames: 0, good: 0, bad: 0, lockUntil: 0 };

    const renderer = (this.renderer = new THREE.WebGLRenderer({ canvas, antialias: false, powerPreference: 'high-performance', stencil: false }));
    renderer.debug.checkShaderErrors = debug; // shader error checks force synchronous GPU round-trips
    renderer.setPixelRatio(this.dpr);
    renderer.setSize(window.innerWidth, window.innerHeight, false);
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.05;
    renderer.outputColorSpace = THREE.SRGBColorSpace;

    const scene = (this.scene = new THREE.Scene());
    scene.background = new THREE.Color(0x070708);
    scene.fog = new THREE.Fog(0x070708, 14, 38);

    this.camera = new THREE.PerspectiveCamera(32, window.innerWidth / window.innerHeight, 0.1, 120);
    this.camera.position.set(6, 1.4, 6);
    this.camera.layers.enable(LAYER_DECALS);
    this.target = new THREE.Vector3(0, 0.7, 0);

    // MSAA inside the HDR buffer only on low-density screens; retina pixels do that job already.
    this.samples = msaa ?? (deviceDpr < 1.5 ? 4 : 0);

    this.clock = new THREE.Clock();
    this.onResize = this.onResize.bind(this);
    window.addEventListener('resize', this.onResize);
  }

  // The room is built in small slices between yields, so the page stays responsive while the first car downloads.
  async #buildRoom() {
    await yieldToPage();
    this.scene.environment = buildStudioEnvironment(this.renderer);
    await yieldToPage();
    this.#buildFloor();
    this.#buildRig();
    if (!this.mobile && !this.reducedMotion) this.#buildDust();
    await yieldToPage();
    if (!this.mobile) {
      const target = new THREE.WebGLRenderTarget(1, 1, { type: THREE.HalfFloatType, samples: this.samples });
      const composer = (this.composer = new EffectComposer(this.renderer, target));
      composer.setPixelRatio(this.dpr);
      composer.setSize(window.innerWidth, window.innerHeight);
      composer.addPass(new RenderPass(this.scene, this.camera));
      this.bloom = new UnrealBloomPass(new THREE.Vector2(window.innerWidth, window.innerHeight), 0.3, 0.5, 2.2);
      composer.addPass(this.bloom);
      composer.addPass(new OutputPass());
    }
  }

  #buildFloor() {
    const size = 60;
    if (!this.mobile) {
      const mirror = new Reflector(new THREE.CircleGeometry(size / 2, 64), {
        textureWidth: Math.max(256, window.innerWidth * MIRROR_SCALE * this.dpr),
        textureHeight: Math.max(256, window.innerHeight * MIRROR_SCALE * this.dpr),
        color: 0x6a6a6a,
        clipBias: 0.003,
        multisample: 0,
      });
      mirror.rotation.x = -Math.PI / 2;
      this.scene.add(mirror);
      this.mirror = mirror;
    }
    // Satin concrete over the mirror: reflections fade toward the room's edge.
    const floorMat = new THREE.MeshBasicMaterial({
      color: 0x070708,
      map: radialTexture([[0, 'rgba(255,255,255,0.72)'], [0.35, 'rgba(255,255,255,0.86)'], [1, 'rgba(255,255,255,1)']]),
      transparent: true,
      depthWrite: false,
    });
    if (this.mobile) floorMat.map = null, floorMat.transparent = false;
    const floor = new THREE.Mesh(new THREE.CircleGeometry(size / 2, 64), floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = 0.002;
    floor.renderOrder = 1;
    floor.layers.set(LAYER_DECALS);
    this.scene.add(floor);

    // Pool of light on the floor under the rig.
    this.pool = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({
        map: radialTexture([[0, 'rgba(255,244,228,0.55)'], [0.45, 'rgba(255,244,228,0.16)'], [1, 'rgba(255,244,228,0)']]),
        transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0,
      })
    );
    this.pool.rotation.x = -Math.PI / 2;
    this.pool.position.y = 0.004;
    this.pool.scale.set(15, 13, 1);
    this.pool.renderOrder = 2;
    this.pool.layers.set(LAYER_DECALS);
    this.scene.add(this.pool);

    this.shadowTex = radialTexture([[0, 'rgba(0,0,0,0.95)'], [0.55, 'rgba(0,0,0,0.7)'], [1, 'rgba(0,0,0,0)']]);
  }

  #buildRig() {
    this.rig = new THREE.Group();
    this.barMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
    const geo = new THREE.BoxGeometry(0.07, 0.035, 9);
    for (const x of [-2.2, 0, 2.2]) {
      const bar = new THREE.Mesh(geo, this.barMat);
      bar.position.set(x, 5.6, 0);
      this.rig.add(bar);
    }
    this.scene.add(this.rig);

    // A little direct light so undersides and tyres aren't pure black.
    this.hemi = new THREE.HemisphereLight(0xfff4e6, 0x08080a, 0.0);
    this.scene.add(this.hemi);
    this.key = new THREE.DirectionalLight(0xffffff, 0);
    this.key.position.set(3, 8, 4);
    this.scene.add(this.key);
  }

  #buildDust() {
    const count = 420;
    const pos = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      pos[i * 3] = (Math.random() - 0.5) * 12;
      pos[i * 3 + 1] = Math.random() * 5.5;
      pos[i * 3 + 2] = (Math.random() - 0.5) * 12;
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    const material = new THREE.PointsMaterial({
      size: 0.022, map: radialTexture([[0, 'rgba(255,255,255,1)'], [1, 'rgba(255,255,255,0)']], 32),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending, opacity: 0, color: 0xfff1dc,
    });
    // Drift happens in the vertex shader, so there is no per-frame buffer upload.
    this.dustTime = { value: 0 };
    material.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = this.dustTime;
      shader.vertexShader = 'uniform float uTime;\n' + shader.vertexShader.replace(
        '#include <begin_vertex>',
        '#include <begin_vertex>\n\ttransformed.y = mod(transformed.y + uTime * 0.05, 5.5);'
      );
    };
    this.dust = new THREE.Points(geo, material);
    this.dust.layers.set(LAYER_DECALS);
    this.dust.frustumCulled = false;
    this.scene.add(this.dust);
  }

  /* ───────── Loading ───────── */

  // First car blocks the loader; the rest stream in behind it.
  async load(onProgress) {
    MeshoptDecoder.useWorkers?.(Math.min(2, Math.max(1, (navigator.hardwareConcurrency || 2) - 1)));
    this.loader = new GLTFLoader().setMeshoptDecoder(MeshoptDecoder);
    const base = this.mobile ? 'models/mobile/' : 'models/';

    // Download first (it may already be in flight from the preload hint), build the room meanwhile.
    const downloading = this.loader.loadAsync(base + CARS[0].file, (e) => {
      if (e.total) onProgress?.(0.85 * (e.loaded / e.total));
    });
    await this.#buildRoom();
    const first = await downloading;
    // Start the other downloads now that the first car has the bandwidth it needed.
    this.rest = CARS.slice(1).map((def, i) =>
      this.loader.loadAsync(base + def.file).then((gltf) => this.#prepare(gltf, i + 1))
    );
    await this.#prepare(first, 0, onProgress);
    onProgress?.(1);
    this.setScene(0, true);
    this.all = Promise.allSettled(this.rest);
  }

  async #prepare(gltf, index, onProgress) {
    await yieldToPage();
    this.#addCar(gltf.scene, CARS[index], index);
    const car = this.cars[index];
    // The room itself (floor, rig, dust, bloom) is warmed together with the first car.
    await this.#warm(index === 0 ? this.scene : car.group, car.group);
    onProgress?.(0.95);
    this.ready[index] = true;
  }

  // Compile shaders in parallel and upload textures ahead of time, so a car's first appearance costs nothing.
  // Everything is sliced into small chunks with yields between them: a reader may already be scrolling.
  async #warm(root, carGroup) {
    const r = this.renderer;
    const prev = r.getRenderTarget();
    // Compile for the target the frame is really drawn into; otherwise we'd build shader variants nobody uses.
    const into = this.composer ? this.composer.readBuffer : null;
    const drawables = [];
    root.traverse((o) => { if (o.isMesh || o.isPoints) drawables.push(o); });
    const compiling = [];
    for (let i = 0; i < drawables.length; i += 6) {
      r.setRenderTarget(into);
      for (const o of drawables.slice(i, i + 6)) compiling.push(r.compileAsync(o, this.camera, this.scene));
      r.setRenderTarget(prev);
      await yieldToPage();
    }
    await Promise.all(compiling);

    const textures = new Set();
    for (const o of drawables) {
      for (const m of [].concat(o.material || [])) for (const k in m) if (m[k] && m[k].isTexture) textures.add(m[k]);
    }
    let n = 0;
    for (const t of textures) {
      r.initTexture(t);
      if (++n % 2 === 0) await yieldToPage();
    }

    // One throwaway draw of just this car resolves the remaining first-use work (uniform lookups, VAOs).
    const saved = this.cars.map((c) => c?.group.visible);
    this.cars.forEach((c) => c && (c.group.visible = false));
    carGroup.visible = true;
    const culled = [];
    carGroup.traverse((o) => { if (o.isMesh && o.frustumCulled) { o.frustumCulled = false; culled.push(o); } });
    if (this.composer) {
      this.warmTarget ??= new THREE.WebGLRenderTarget(8, 8, { type: THREE.HalfFloatType });
      r.setRenderTarget(this.warmTarget);
      r.render(this.scene, this.camera);
      if (root === this.scene) this.composer.render(0);
    } else {
      // Screen-target shaders differ from off-screen ones; draw into a 1px scissor that the next frame overwrites.
      r.setRenderTarget(null);
      r.setScissorTest(true);
      r.setScissor(0, 0, 1, 1);
      r.render(this.scene, this.camera);
      r.setScissorTest(false);
    }
    r.setRenderTarget(prev);
    culled.forEach((o) => (o.frustumCulled = true));
    this.cars.forEach((c, i) => c && (c.group.visible = saved[i]));
    this.scene_ = -2; // force setScene to re-apply visibility
    await nextFrame();
  }

  #addCar(model, def, index) {
    const box = new THREE.Box3().setFromObject(model);
    const size = box.getSize(new THREE.Vector3());
    const k = CAR_LENGTH / Math.max(size.x, size.z);
    model.scale.setScalar(k);
    box.setFromObject(model);
    const c = box.getCenter(new THREE.Vector3());
    model.position.set(-c.x, -box.min.y, -c.z);
    box.setFromObject(model);
    const dims = box.getSize(new THREE.Vector3());

    const paints = [];
    model.traverse((o) => {
      if (!o.isMesh) return;
      const mats = Array.isArray(o.material) ? o.material : [o.material];
      const next = mats.map((m) => {
        if (def.key === 'roma') tuneRomaMaterial(m);
        if (def.paint.test(m.name)) {
          const p = paints.find((x) => x.userData.src === m) || Object.assign(makePaint(m), { userData: { src: m } });
          if (!paints.includes(p)) paints.push(p);
          return p;
        }
        m.envMapIntensity = 1.1;
        // Transmission (refractive glass) makes three.js re-render the whole room, mirror included, every frame.
        // Tinted transparency reads the same through dark showroom glass at a fraction of the cost.
        if (m.transmission > 0) {
          Object.assign(m, { transmission: 0, transparent: true, depthWrite: false, opacity: Math.max(m.opacity, 0.45) });
          m.needsUpdate = true;
        }
        if (m.transparent && m.side === THREE.DoubleSide) m.forceSinglePass = true;
        return m;
      });
      o.material = Array.isArray(o.material) ? next : next[0];
      o.matrixAutoUpdate = false; // static parts: skip per-frame matrix recomposition
      o.updateMatrix();
    });

    const shadow = new THREE.Mesh(
      new THREE.PlaneGeometry(1, 1),
      new THREE.MeshBasicMaterial({ map: this.shadowTex, transparent: true, depthWrite: false, opacity: 0.9 })
    );
    shadow.rotation.x = -Math.PI / 2;
    shadow.position.y = 0.006;
    shadow.scale.set(dims.x * 1.45, dims.z * 1.2, 1);
    shadow.renderOrder = 3;
    shadow.layers.set(LAYER_DECALS);

    const group = new THREE.Group();
    group.add(model, shadow);
    group.visible = false;
    this.scene.add(group);

    this.cars[index] = { group, model, shadow, dims, key: def.key };
    this.paints[index] = paints;
    this.setPaint(index, DEFAULT_PAINT[index], true);
  }

  isSceneReady(s) {
    return s === 3 ? this.ready.every(Boolean) : !!this.ready[s];
  }

  // scene: 0..2 single car, 3 = the line-up, -1 = empty room
  setScene(s, force = false) {
    if (s === this.scene_ && !force) return;
    this.scene_ = s;
    this.cars.forEach((car, i) => {
      if (!car || !this.ready[i]) return;
      if (s === 3) {
        car.group.visible = true;
        car.group.position.set((i - 1) * LINEUP_GAP, 0, i === 1 ? 0.6 : 0);
        car.group.rotation.y = (i - 1) * -0.12;
      } else {
        car.group.visible = i === s;
        car.group.position.set(0, 0, 0);
        car.group.rotation.y = 0;
      }
    });
  }

  setPaint(index, { hex, metal, rough }, instant = false) {
    const mats = this.paints[index] || [];
    const to = new THREE.Color(hex);
    for (const m of mats) {
      if (instant || this.reducedMotion) {
        m.color.copy(to); m.metalness = metal; m.roughness = rough;
      } else {
        gsap.to(m.color, { r: to.r, g: to.g, b: to.b, duration: 1.1, ease: 'power2.inOut' });
        gsap.to(m, { metalness: metal, roughness: rough, duration: 1.1, ease: 'power2.inOut' });
      }
    }
    this.busyUntil = performance.now() + 1300;
  }

  // True while something animates that the scroll camera doesn't know about.
  isBusy(now) {
    return now < this.busyUntil;
  }

  // World position for a hotspot, given in car-relative fractions of its bounding box.
  anchor(index, [fx, fy, fz], out = new THREE.Vector3()) {
    const car = this.cars[index];
    if (!car) return null;
    const { dims } = car;
    out.set((fx * dims.x) / 2, fy * dims.y, (fz * dims.z) / 2);
    return out.applyMatrix4(car.group.matrixWorld);
  }

  project(v) {
    const p = v.project(this.camera);
    return { x: (p.x * 0.5 + 0.5) * window.innerWidth, y: (-p.y * 0.5 + 0.5) * window.innerHeight, behind: p.z > 1 };
  }

  // cam: { theta, phi, radius, tx, ty, tz, shiftX, shiftY }
  applyCamera(cam) {
    const t = THREE.MathUtils.degToRad(cam.theta);
    const p = THREE.MathUtils.degToRad(cam.phi);
    // Portrait screens have a narrow horizontal field of view: pull back in proportion.
    const aspect = window.innerWidth / window.innerHeight;
    const narrow = aspect < 1.1 ? Math.max(1, 1.12 / aspect) : 1;
    const r = cam.radius * narrow;
    this.target.set(cam.tx, cam.ty, cam.tz);
    this.camera.position.set(
      cam.tx + r * Math.sin(t) * Math.cos(p),
      Math.max(0.12, cam.ty + r * Math.sin(p)),
      cam.tz + r * Math.cos(t) * Math.cos(p)
    );
    this.camera.lookAt(this.target);
    // The room dissolves into darkness just beyond the car, whatever the camera distance.
    this.scene.fog.near = r * 1.15;
    this.scene.fog.far = r * 3.2;
    this.viewShift.x = narrow > 1 ? 0 : cam.shiftX;
    this.viewShift.y = narrow > 1 ? -0.12 : cam.shiftY;
    this.#applyViewOffset();
  }

  #applyViewOffset() {
    const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
    this.camera.setViewOffset(w, h, -this.viewShift.x * w, -this.viewShift.y * h, w, h);
  }

  render() {
    const dt = Math.min(this.clock.getDelta(), 0.05);
    const L = this.light;
    this.scene.environmentIntensity = 0.06 + L * 1.0;
    this.hemi.intensity = L * 0.6;
    this.key.intensity = L * 1.2;
    this.barMat.color.setScalar(0.04 + this.bars * 4.2);
    this.rig.visible = this.camera.position.y < 5.1; // bird's-eye shots would look straight through the bars
    this.pool.material.opacity = L * 0.32;
    if (this.mirror) this.mirror.visible = L > 0.02;
    if (this.bloom) this.bloom.strength = 0.15 + this.bars * 0.3;
    if (this.dust) {
      this.dust.material.opacity = L * 0.5;
      this.dust.visible = L > 0.02;
      this.dust.rotation.y += dt * 0.012;
      this.dustTime.value += dt;
    }
    if (this.composer) this.composer.render(dt);
    else this.renderer.render(this.scene, this.camera);
  }

  // Called once per drawn frame with its real duration; nudges resolution to keep motion fluid.
  adapt(frameSeconds, now) {
    const s = this.perf;
    if (frameSeconds > 0.25) return; // tab switch or breakpoint, not a real frame
    s.acc += frameSeconds;
    s.frames++;
    if (s.acc < 1) return;
    const avg = s.acc / s.frames;
    s.acc = 0;
    s.frames = 0;
    if (avg > 1 / 45) {
      s.good = 0;
      if (++s.bad < 2) return; // one slow second can be a GC pause; two in a row is a trend
      s.bad = 0;
      if (this.dpr > this.minDpr) {
        this.maxDpr = Math.max(this.minDpr, this.dpr - 0.25); // don't climb back to a level that failed
        this.setDpr(Math.max(this.minDpr, this.dpr - 0.25));
        s.lockUntil = now + 8000;
      } else if (this.bloom?.enabled) {
        this.bloom.enabled = false;
      }
    } else {
      s.bad = 0;
      if (avg < 1 / 57 && now > s.lockUntil) {
        if (++s.good >= 4 && this.dpr < this.maxDpr) {
          s.good = 0;
          this.setDpr(Math.min(this.maxDpr, this.dpr + 0.25));
        }
      } else {
        s.good = 0;
      }
    }
  }

  setDpr(dpr) {
    if (dpr === this.dpr) return;
    this.dpr = dpr;
    this.renderer.setPixelRatio(dpr);
    this.onResize();
  }

  onResize() {
    const w = Math.max(1, window.innerWidth), h = Math.max(1, window.innerHeight);
    this.camera.aspect = w / h;
    this.#applyViewOffset();
    this.camera.updateProjectionMatrix();
    this.renderer.setSize(w, h, false);
    if (this.composer) {
      this.composer.setPixelRatio(this.dpr);
      this.composer.setSize(w, h);
    }
    this.mirror?.getRenderTarget().setSize(Math.max(256, w * MIRROR_SCALE * this.dpr), Math.max(256, h * MIRROR_SCALE * this.dpr));
  }
}
