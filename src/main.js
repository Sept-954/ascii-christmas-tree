import * as THREE from "../vendor/three.module.min.js";

const CONFIG = {
  background: 0x030712,
  treeHeight: 8.3,
  treeRadius: 3.05,
  treeTiers: 7,
  spiralTurns: 9.2,
  blessingDelay: 2.1,
  cameraFov: 33,
};

const GLYPHS = "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ#*+./\\|_-=<>[]{}()@%&$";
const GLYPH_LIST = Array.from(new Set(GLYPHS)).slice(0, 64);
const GLYPH_INDEX = new Map(GLYPH_LIST.map((glyph, index) => [glyph, index]));
const TAU = Math.PI * 2;

const PALETTE = {
  forest: [0x21e77d, 0x00c97b, 0x91ff5b, 0x2ff2b3, 0x0bbf83, 0x78ffb1],
  cool: [0x26d9ff, 0x31a8ff, 0x77f7ff, 0x6e8dff, 0xb8ffef],
  accent: [0xff4f8b, 0xff7567, 0xffb24a, 0xc880ff, 0xf7f0a6],
  gold: [0xffc93c, 0xffdf70, 0xfff3b4, 0xffa71f],
  bark: [0x9b542f, 0xc57b45, 0x6a3526, 0xe2aa5f, 0x7e4027],
  snow: [0xdff8ff, 0xbdefff, 0xffffff, 0x85dcec],
};

const SCENE = {
  renderer: null,
  scene: null,
  camera: null,
  glyphAtlas: null,
  treeGroups: [],
  snow: null,
  snowData: null,
  clockStart: performance.now(),
  paused: false,
  frozenTime: null,
  recordMode: new URLSearchParams(location.search).has("record"),
};

document.body.classList.toggle("recording", SCENE.recordMode);

init();

function init() {
  SCENE.scene = new THREE.Scene();
  SCENE.scene.background = new THREE.Color(CONFIG.background);
  SCENE.scene.fog = new THREE.FogExp2(0x030712, 0.026);

  SCENE.camera = new THREE.PerspectiveCamera(CONFIG.cameraFov, innerWidth / innerHeight, 0.1, 80);
  SCENE.camera.position.set(0, 1.35, 21.2);
  SCENE.camera.lookAt(0, 2.25, 0);

  SCENE.renderer = new THREE.WebGLRenderer({
    canvas: document.querySelector("#scene"),
    antialias: true,
    alpha: false,
    powerPreference: "high-performance",
    preserveDrawingBuffer: true,
  });
  SCENE.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  SCENE.renderer.setSize(innerWidth, innerHeight, false);
  SCENE.renderer.outputColorSpace = THREE.SRGBColorSpace;
  SCENE.renderer.toneMapping = THREE.ACESFilmicToneMapping;
  SCENE.renderer.toneMappingExposure = 1.2;

  SCENE.glyphAtlas = makeGlyphAtlas();

  buildTree();
  buildStar();
  buildSpiral();
  buildGifts();
  buildTrunkAndRoots();
  buildSnow();

  addEventListener("resize", onResize);
  SCENE.renderer.setAnimationLoop(render);

  if (SCENE.recordMode) {
    SCENE.clockStart = performance.now();
  }

  window.christmasScene = {
    seek(seconds) {
      SCENE.frozenTime = Math.max(0, Number(seconds) || 0);
      SCENE.paused = true;
      render();
    },
    play() {
      SCENE.frozenTime = null;
      SCENE.paused = false;
      SCENE.clockStart = performance.now();
    },
    pause() {
      SCENE.frozenTime = currentTime();
      SCENE.paused = true;
    },
    config: CONFIG,
  };
}

function buildTree() {
  const tierCounts = [960, 880, 790, 690, 560, 400, 250];

  for (let tier = 0; tier < CONFIG.treeTiers; tier += 1) {
    const data = [];
    const tierFraction = tier / CONFIG.treeTiers;
    const yStart = -2.18 + tier * 1.18;
    const radiusStart = CONFIG.treeRadius * Math.pow(1 - tierFraction, 0.86) + 0.28;
    const count = tierCounts[tier];

    for (let i = 0; i < count; i += 1) {
      const localY = Math.pow(Math.random(), 1.16);
      const theta = Math.random() * TAU;
      const branchScallop =
        0.84 +
        Math.cos(theta * 8 + tier * 0.48) * 0.11 +
        Math.sin(theta * 17 - tier * 0.2) * 0.045;
      const radialFill = 0.54 + Math.pow(Math.random(), 0.34) * 0.46;
      const radius = radiusStart * (1 - localY * 0.27) * branchScallop * radialFill;
      const x = Math.cos(theta) * radius + (Math.random() - 0.5) * 0.1;
      const z = Math.sin(theta) * radius + (Math.random() - 0.5) * 0.1;
      const y = yStart + localY * 1.22 + (Math.random() - 0.5) * 0.16;
      const color = chooseTreeColor(localY, radialFill, tier);
      const isAccent = Math.random() < 0.085;
      const glyph = pickGlyph(isAccent ? "#*+%@&" : "0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ#*+./|");

      data.push({
        position: [x, y, z],
        color,
        char: charIndex(glyph),
        size: 0.1 + Math.random() * 0.12 + radialFill * 0.075,
        alpha: 0.64 + Math.random() * 0.33,
        phase: Math.random() * TAU,
        pulse: isAccent ? 1.8 : 0.5,
        kind: isAccent ? 1 : 0,
      });
    }

    const group = new THREE.Group();
    group.position.y = 0.2;
    const crisp = makeGlyphPoints(data, { halo: false });
    const glow = makeGlyphPoints(data, { halo: true });
    group.add(glow, crisp);
    group.userData = {
      baseRotation: tier * 0.07,
      speed: 0.035 + tier * 0.0035,
      phase: tier * 0.32,
    };
    SCENE.treeGroups.push(group);
    SCENE.scene.add(group);
  }
}

function buildSpiral() {
  const count = 650;
  const data = [];

  for (let i = 0; i < count; i += 1) {
    const t = i / (count - 1);
    const theta = t * TAU * CONFIG.spiralTurns + 0.35;
    const radius = (0.18 + CONFIG.treeRadius * Math.pow(1 - t, 1.03)) * 1.025;
    const y = -1.72 + t * (CONFIG.treeHeight - 0.12);
    const color = pick(PALETTE.gold);
    const glyph = pickGlyph("*+X0O#@");

    data.push({
      position: [
        Math.cos(theta) * radius,
        y + Math.sin(i * 1.7) * 0.018,
        Math.sin(theta) * radius,
      ],
      color,
      char: charIndex(glyph),
      size: 0.15 + Math.random() * 0.14,
      alpha: 0.78 + Math.random() * 0.22,
      phase: i * 0.41,
      pulse: 2.2,
      kind: 2,
    });
  }

  const glowData = data.map((item, index) => ({
    ...item,
    size: item.size * (1.9 + (index % 5) * 0.08),
    alpha: 0.14 + (index % 4) * 0.035,
    pulse: 2.4,
    kind: 3,
  }));

  SCENE.scene.add(makeGlyphPoints(glowData, { halo: true }), makeGlyphPoints(data, { halo: false }));
}

function buildStar() {
  const starVertices = makeStarVertices(1.2, 0.5, 5);
  const data = [];
  const layers = [-0.2, -0.08, 0.06, 0.19];
  let attempts = 0;

  while (data.length < 1450 && attempts < 9000) {
    attempts += 1;
    const x = (Math.random() * 2 - 1) * 1.34;
    const y = (Math.random() * 2 - 1) * 1.34;
    if (!pointInPolygon(x, y, starVertices)) continue;

    const layer = pick(layers);
    const fill = pick([0xffd54d, 0xffdf74, 0xfff0b5, 0xffb62e, 0xffeaa0]);
    const edgeBias = Math.random() < 0.16;

    data.push({
      position: [x + (Math.random() - 0.5) * 0.04, 7.03 + y + (Math.random() - 0.5) * 0.04, layer],
      color: fill,
      char: charIndex(pickGlyph(edgeBias ? "*/\\|X" : "*+X01#@")),
      size: 0.105 + Math.random() * 0.105,
      alpha: 0.78 + Math.random() * 0.22,
      phase: Math.random() * TAU,
      pulse: 2.5,
      kind: 2,
    });
  }

  for (let ray = 0; ray < 12; ray += 1) {
    const angle = (ray / 12) * TAU + 0.13;
    const length = ray % 3 === 0 ? 0.9 : 0.55;
    for (let i = 0; i < 13; i += 1) {
      const radius = 1.3 + (i / 12) * length;
      data.push({
        position: [Math.cos(angle) * radius, 7.03 + Math.sin(angle) * radius, (i % 3 - 1) * 0.09],
        color: i < 4 ? 0xfff2b8 : 0xffc63f,
        char: charIndex(pickGlyph("*+-.xX")),
        size: 0.055 + (13 - i) * 0.007,
        alpha: 0.7 - i * 0.025,
        phase: angle + i,
        pulse: 2.6,
        kind: 2,
      });
    }
  }

  const glow = data.map((item) => ({
    ...item,
    size: item.size * 2.2,
    alpha: item.alpha * 0.17,
    pulse: 3.2,
    kind: 3,
  }));

  SCENE.scene.add(makeGlyphPoints(glow, { halo: true }), makeGlyphPoints(data, { halo: false }));
}

function buildGifts() {
  const gifts = [
    {
      center: [-2.75, -2.34, 2.06],
      size: [1.45, 0.92, 1.08],
      rotation: -0.24,
      color: 0xff3f6e,
      darks: [0xe42657, 0xc91e49, 0xff5d87],
      ribbon: 0xffd55f,
    },
    {
      center: [2.65, -2.31, 1.94],
      size: [1.23, 1.02, 1.16],
      rotation: 0.3,
      color: 0x4fdd9d,
      darks: [0x1dbb7a, 0x19a86a, 0x6aebac],
      ribbon: 0xffe483,
    },
    {
      center: [0.18, -2.68, 2.46],
      size: [1.08, 0.76, 0.9],
      rotation: 0.1,
      color: 0x9a70ff,
      darks: [0x7045e9, 0x5b33c6, 0xb28ffc],
      ribbon: 0xffc94b,
    },
  ];

  for (const gift of gifts) {
    const group = new THREE.Group();
    const data = sampleGift(gift);
    const glow = data
      .filter((point) => point.kind === 2)
      .map((point) => ({
        ...point,
        size: point.size * 2.15,
        alpha: 0.22,
        pulse: 2.6,
        kind: 3,
      }));

    group.add(makeGlyphPoints(glow, { halo: true }), makeGlyphPoints(data, { halo: false }));
    group.position.set(...gift.center);
    group.rotation.y = gift.rotation;
    group.userData = { baseRotation: gift.rotation, speed: 0.07, phase: Math.random() * TAU };
    SCENE.treeGroups.push(group);
    SCENE.scene.add(group);
  }
}

function sampleGift(gift) {
  const [w, h, d] = gift.size;
  const data = [];
  const step = 0.105;

  const addFace = (axis, sign) => {
    const uCount = Math.round((axis === "y" ? w : axis === "x" ? d : w) / step);
    const vCount = Math.round((axis === "y" ? d : h) / step);

    for (let u = 0; u <= uCount; u += 1) {
      for (let v = 0; v <= vCount; v += 1) {
        const nu = u / Math.max(uCount, 1);
        const nv = v / Math.max(vCount, 1);
        let x = 0;
        let y = 0;
        let z = 0;

        if (axis === "z") {
          x = (nu - 0.5) * w;
          y = (nv - 0.5) * h;
          z = sign * d * 0.5;
        } else if (axis === "x") {
          x = sign * w * 0.5;
          y = (nv - 0.5) * h;
          z = (nu - 0.5) * d;
        } else {
          x = (nu - 0.5) * w;
          y = sign * h * 0.5;
          z = (nv - 0.5) * d;
        }

        const ribbonU = Math.abs(nu - 0.5) < 0.095;
        const ribbonV = axis !== "y" && Math.abs(nv - 0.5) < 0.095;
        const isRibbon = ribbonU || ribbonV;
        const isEdge = u === 0 || u === uCount || v === 0 || v === vCount;
        const color = isRibbon ? gift.ribbon : isEdge ? pick(gift.darks) : gift.color;
        const glyph = isRibbon ? pickGlyph("#=+X0") : pickGlyph("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ#");

        data.push({
          position: [
            x + (Math.random() - 0.5) * 0.015,
            y + (Math.random() - 0.5) * 0.015,
            z + (Math.random() - 0.5) * 0.015,
          ],
          color,
          char: charIndex(glyph),
          size: isRibbon ? 0.125 : 0.095 + Math.random() * 0.055,
          alpha: isRibbon ? 1 : 0.7 + Math.random() * 0.28,
          phase: Math.random() * TAU,
          pulse: isRibbon ? 2.4 : 0.8,
          kind: isRibbon ? 2 : 0,
        });
      }
    }
  };

  addFace("z", 1);
  addFace("z", -1);
  addFace("x", 1);
  addFace("x", -1);
  addFace("y", 1);
  addFace("y", -1);

  for (let loop = 0; loop < 2; loop += 1) {
    const sign = loop === 0 ? -1 : 1;
    for (let i = 0; i < 34; i += 1) {
      const t = i / 33;
      const theta = t * TAU;
      const x = sign * (0.18 + 0.16 * Math.cos(theta)) * Math.sin(t * Math.PI);
      const y = h * 0.5 + 0.18 + 0.27 * Math.sin(theta) * Math.sin(t * Math.PI);
      const z = 0.07 * Math.cos(theta);
      data.push({
        position: [x, y, z],
        color: gift.ribbon,
        char: charIndex(pickGlyph("*+=X")),
        size: 0.095 + Math.random() * 0.045,
        alpha: 0.95,
        phase: theta + loop * 2,
        pulse: 2.2,
        kind: 2,
      });
    }
  }

  return data;
}

function buildTrunkAndRoots() {
  const data = [];
  const trunkSegments = 920;

  for (let i = 0; i < trunkSegments; i += 1) {
    const t = Math.random();
    const theta = Math.random() * TAU;
    const flare = 0.29 + Math.pow(1 - t, 4.0) * 0.28;
    const radius = flare * (0.82 + Math.random() * 0.26);
    data.push({
      position: [Math.cos(theta) * radius, -2.45 + t * 1.05, Math.sin(theta) * radius],
      color: pick(PALETTE.bark),
      char: charIndex(pickGlyph("0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ#")),
      size: 0.09 + Math.random() * 0.08,
      alpha: 0.66 + Math.random() * 0.32,
      phase: Math.random() * TAU,
      pulse: 0.25,
      kind: 0,
    });
  }

  for (let root = 0; root < 9; root += 1) {
    const theta = (root / 9) * TAU + 0.18;
    const length = 1.8 + (root % 3) * 0.32;
    for (let i = 0; i < 120; i += 1) {
      const t = i / 119;
      const spread = length * Math.pow(t, 1.1);
      const wiggle = Math.sin(t * 8 + root) * 0.12 * t;
      const x = Math.cos(theta) * spread + Math.cos(theta + Math.PI / 2) * wiggle;
      const z = Math.sin(theta) * spread + Math.sin(theta + Math.PI / 2) * wiggle;
      const y = -2.72 - t * 0.36 + Math.sin(t * Math.PI) * 0.12;
      data.push({
        position: [x, y, z],
        color: pick(PALETTE.bark),
        char: charIndex(pickGlyph("/\\_-=0123456789")),
        size: 0.075 + (1 - t) * 0.075,
        alpha: 0.72 + Math.random() * 0.24,
        phase: t * 9 + root,
        pulse: 0.3,
        kind: 0,
      });
    }
  }

  SCENE.scene.add(makeGlyphPoints(data, { halo: false }));
}

function buildSnow() {
  const count = 1150;
  const data = [];
  const snowStats = [];

  for (let i = 0; i < count; i += 1) {
    const x = (Math.random() - 0.5) * 15;
    const y = -4 + Math.random() * 16;
    const z = -8 + Math.random() * 16;
    const size = 0.04 + Math.random() * 0.09;
    data.push({
      position: [x, y, z],
      color: pick(PALETTE.snow),
      char: charIndex(pickGlyph(".*+*-")),
      size,
      alpha: 0.22 + Math.random() * 0.64,
      phase: Math.random() * TAU,
      pulse: 0.55,
      kind: 4,
    });
    snowStats.push({
      speed: 0.14 + Math.random() * 0.31,
      sway: 0.12 + Math.random() * 0.42,
      angle: Math.random() * TAU,
    });
  }

  const points = makeGlyphPoints(data, { halo: false, snow: true });
  SCENE.snow = points;
  SCENE.snowData = { data, snowStats };
  SCENE.scene.add(points);
}

function makeGlyphPoints(data, options = {}) {
  const { halo = false, snow = false } = options;
  const positions = new Float32Array(data.length * 3);
  const colors = new Float32Array(data.length * 3);
  const chars = new Float32Array(data.length);
  const sizes = new Float32Array(data.length);
  const alphas = new Float32Array(data.length);
  const phases = new Float32Array(data.length);
  const pulses = new Float32Array(data.length);
  const kinds = new Float32Array(data.length);
  const color = new THREE.Color();

  data.forEach((item, index) => {
    positions[index * 3] = item.position[0];
    positions[index * 3 + 1] = item.position[1];
    positions[index * 3 + 2] = item.position[2];
    color.setHex(item.color);
    colors[index * 3] = color.r;
    colors[index * 3 + 1] = color.g;
    colors[index * 3 + 2] = color.b;
    chars[index] = item.char;
    sizes[index] = item.size;
    alphas[index] = item.alpha;
    phases[index] = item.phase;
    pulses[index] = item.pulse;
    kinds[index] = item.kind;
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.BufferAttribute(positions, 3));
  geometry.setAttribute("aColor", new THREE.BufferAttribute(colors, 3));
  geometry.setAttribute("aChar", new THREE.BufferAttribute(chars, 1));
  geometry.setAttribute("aSize", new THREE.BufferAttribute(sizes, 1));
  geometry.setAttribute("aAlpha", new THREE.BufferAttribute(alphas, 1));
  geometry.setAttribute("aPhase", new THREE.BufferAttribute(phases, 1));
  geometry.setAttribute("aPulse", new THREE.BufferAttribute(pulses, 1));
  geometry.setAttribute("aKind", new THREE.BufferAttribute(kinds, 1));

  const material = new THREE.ShaderMaterial({
    uniforms: {
      uAtlas: { value: SCENE.glyphAtlas },
      uTime: { value: 0 },
      uPixelRatio: { value: SCENE.renderer?.getPixelRatio?.() || 1 },
      uHalo: { value: halo ? 1 : 0 },
      uSnow: { value: snow ? 1 : 0 },
      uPointScale: { value: Math.min(innerWidth, innerHeight) * 1.78 },
    },
    vertexShader: `
      uniform float uTime;
      uniform float uPixelRatio;
      uniform float uHalo;
      uniform float uSnow;
      uniform float uPointScale;
      attribute vec3 aColor;
      attribute float aChar;
      attribute float aSize;
      attribute float aAlpha;
      attribute float aPhase;
      attribute float aPulse;
      attribute float aKind;
      varying vec3 vColor;
      varying float vChar;
      varying float vAlpha;
      varying float vKind;

      void main() {
        vec3 p = position;
        float shimmer = sin(uTime * (2.6 + aPulse) + aPhase);
        float localPulse = 0.92 + max(0.0, shimmer) * aPulse * 0.1;
        p.x += sin(uTime * 0.32 + aPhase * 0.13 + position.y * 0.4) * (0.008 + uSnow * 0.11);
        p.z += cos(uTime * 0.27 + aPhase * 0.17 + position.y * 0.25) * (0.006 + uSnow * 0.07);

        vec4 mvPosition = modelViewMatrix * vec4(p, 1.0);
        float perspective = uPointScale / max(1.0, -mvPosition.z);
        float haloScale = mix(1.0, 1.82, uHalo);
        gl_PointSize = max(1.0, aSize * perspective * haloScale * localPulse * uPixelRatio);
        gl_Position = projectionMatrix * mvPosition;

        vColor = aColor * (1.0 + max(0.0, shimmer) * aPulse * 0.08);
        vChar = aChar;
        vAlpha = aAlpha * (0.82 + 0.18 * sin(uTime * 1.7 + aPhase)) * (uHalo > 0.5 ? 0.52 : 1.0);
        vKind = aKind;
      }
    `,
    fragmentShader: `
      uniform sampler2D uAtlas;
      uniform float uHalo;
      uniform float uTime;
      varying vec3 vColor;
      varying float vChar;
      varying float vAlpha;
      varying float vKind;

      void main() {
        float cell = floor(vChar + 0.5);
        float col = mod(cell, 8.0);
        float row = floor(cell / 8.0);
        vec2 local = vec2(gl_PointCoord.x, 1.0 - gl_PointCoord.y);
        vec2 uv = (vec2(col, row) + local) / 8.0;
        float mask = texture2D(uAtlas, uv).a;
        if (mask < 0.035) discard;

        float goldPulse = 0.82 + 0.18 * sin(uTime * 5.2 + vChar * 0.6);
        float boost = mix(1.0, 1.82, step(1.5, vKind));
        vec3 color = vColor * boost;
        if (vKind > 1.5) color *= goldPulse;

        float alpha = mask * vAlpha;
        if (uHalo > 0.5) {
          gl_FragColor = vec4(color * 1.25, alpha * 0.34);
        } else {
          gl_FragColor = vec4(color, alpha);
        }
      }
    `,
    transparent: true,
    depthWrite: false,
    depthTest: true,
    blending: halo ? THREE.AdditiveBlending : THREE.NormalBlending,
  });

  const points = new THREE.Points(geometry, material);
  points.frustumCulled = false;
  points.renderOrder = halo ? 2 : 3;
  return points;
}

function render() {
  const time = currentTime();

  SCENE.treeGroups.forEach((group, index) => {
    const base = group.userData.baseRotation || 0;
    const speed = group.userData.speed || 0.045;
    const phase = group.userData.phase || index;
    group.rotation.y = base + Math.sin(time * 0.18 + phase) * 0.025 + time * speed * 0.35;
    group.rotation.z = Math.sin(time * 0.28 + phase) * 0.003;
  });

  SCENE.scene.traverse((object) => {
    if (object.isPoints && object.material?.uniforms?.uTime) {
      object.material.uniforms.uTime.value = time;
      object.material.uniforms.uPointScale.value = Math.min(innerWidth, innerHeight) * 1.78;
    }
  });

  updateSnow(time);

  const orbit = Math.sin(time * 0.13) * 0.36 + Math.sin(time * 0.057) * 0.12;
  const cameraRadius = 21.2;
  SCENE.camera.position.x = Math.sin(orbit) * cameraRadius;
  SCENE.camera.position.z = Math.cos(orbit) * cameraRadius;
  SCENE.camera.position.y = 1.3 + Math.sin(time * 0.32) * 0.13;
  SCENE.camera.lookAt(0, 2.24 + Math.sin(time * 0.2) * 0.06, 0);

  SCENE.renderer.render(SCENE.scene, SCENE.camera);
}

function updateSnow(time) {
  if (!SCENE.snow) return;
  const positions = SCENE.snow.geometry.getAttribute("position");
  const { data, snowStats } = SCENE.snowData;

  for (let i = 0; i < data.length; i += 1) {
    const base = data[i].position;
    const stat = snowStats[i];
    let y = base[1] - ((time * stat.speed + i * 0.013) % 19);
    if (y < -4.7) y += 19;
    positions.array[i * 3] = base[0] + Math.sin(time * 0.34 + stat.angle + y * 0.15) * stat.sway;
    positions.array[i * 3 + 1] = y;
    positions.array[i * 3 + 2] = base[2] + Math.cos(time * 0.22 + stat.angle) * stat.sway * 0.55;
  }

  positions.needsUpdate = true;
}

function makeGlyphAtlas() {
  const size = 1024;
  const cell = size / 8;
  const canvas = document.createElement("canvas");
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext("2d");
  ctx.clearRect(0, 0, size, size);
  ctx.fillStyle = "#ffffff";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.font = `700 ${Math.floor(cell * 0.62)}px "Courier New", monospace`;
  ctx.shadowColor = "rgba(255,255,255,0.95)";
  ctx.shadowBlur = cell * 0.13;

  GLYPH_LIST.forEach((glyph, index) => {
    const col = index % 8;
    const row = Math.floor(index / 8);
    ctx.fillText(glyph, col * cell + cell / 2, row * cell + cell / 2 + cell * 0.04);
  });

  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.NoColorSpace;
  texture.minFilter = THREE.LinearFilter;
  texture.magFilter = THREE.LinearFilter;
  texture.generateMipmaps = true;
  texture.needsUpdate = true;
  return texture;
}

function makeStarVertices(outerRadius, innerRadius, points) {
  const vertices = [];
  for (let i = 0; i < points * 2; i += 1) {
    const radius = i % 2 === 0 ? outerRadius : innerRadius;
    const angle = -Math.PI / 2 + (i / (points * 2)) * TAU;
    vertices.push([Math.cos(angle) * radius, Math.sin(angle) * radius]);
  }
  return vertices;
}

function pointInPolygon(x, y, polygon) {
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i, i += 1) {
    const xi = polygon[i][0];
    const yi = polygon[i][1];
    const xj = polygon[j][0];
    const yj = polygon[j][1];
    const intersects = yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi;
    if (intersects) inside = !inside;
  }
  return inside;
}

function chooseTreeColor(localY, radialFill, tier) {
  const roll = Math.random();
  if (roll < 0.48) return pick(PALETTE.forest);
  if (roll < 0.68) return pick(PALETTE.cool);
  if (roll < 0.77) return pick(PALETTE.accent);
  if (roll < 0.81) return pick(PALETTE.gold);
  if (localY > 0.78 || tier > 4) return pick([0x6bffb1, 0x54e6ff, 0xb8ffb0]);
  return pick(radialFill > 0.75 ? PALETTE.forest : PALETTE.cool);
}

function currentTime() {
  if (SCENE.frozenTime !== null) return SCENE.frozenTime;
  if (SCENE.paused) return 0;
  return (performance.now() - SCENE.clockStart) / 1000;
}

function charIndex(glyph) {
  return GLYPH_INDEX.get(glyph) ?? GLYPH_INDEX.get("*") ?? 36;
}

function pickGlyph(source) {
  return source[Math.floor(Math.random() * source.length)];
}

function pick(items) {
  return items[Math.floor(Math.random() * items.length)];
}

function onResize() {
  const width = innerWidth;
  const height = innerHeight;
  SCENE.camera.aspect = width / height;
  SCENE.camera.updateProjectionMatrix();
  SCENE.renderer.setPixelRatio(Math.min(devicePixelRatio || 1, 2));
  SCENE.renderer.setSize(width, height, false);
}
