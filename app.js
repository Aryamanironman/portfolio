import * as THREE from 'three';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';
import { ShaderPass } from 'three/addons/postprocessing/ShaderPass.js';
import { OutputPass } from 'three/addons/postprocessing/OutputPass.js';
import { FontLoader } from 'three/addons/loaders/FontLoader.js';
import { TextGeometry } from 'three/addons/geometries/TextGeometry.js';

// ─── SCENE SETUP ─────────────────────────────────────────────────────────────
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(60, innerWidth / innerHeight, 0.01, 5000);
camera.position.set(0, 0, 120);
scene.fog = new THREE.FogExp2(0x000008, 0.0015);

const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false, powerPreference: 'high-performance' });
renderer.setSize(innerWidth, innerHeight);
renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.2;
document.body.prepend(renderer.domElement);
renderer.domElement.style.position = 'fixed';
renderer.domElement.style.inset = '0';
renderer.domElement.style.zIndex = '1';

// ─── POST PROCESSING ─────────────────────────────────────────────────────────
const composer = new EffectComposer(renderer);
composer.addPass(new RenderPass(scene, camera));

const bloom = new UnrealBloomPass(new THREE.Vector2(innerWidth, innerHeight), 0.85, 0.45, 0.08);
composer.addPass(bloom);

composer.addPass(new OutputPass());

// ─── LIGHTING ────────────────────────────────────────────────────────────────
scene.add(new THREE.AmbientLight(0x0a0520, 2));
const rimL = new THREE.DirectionalLight(0x7af0ff, 3);
rimL.position.set(-20, 10, 5);
scene.add(rimL);
const rimR = new THREE.DirectionalLight(0xc084fc, 3);
rimR.position.set(20, -5, 5);
scene.add(rimR);
const frontL = new THREE.PointLight(0xffffff, 2, 200);
frontL.position.set(0, 0, 30);
scene.add(frontL);
const backGlow = new THREE.PointLight(0x4040ff, 4, 300);
backGlow.position.set(0, 0, -50);
scene.add(backGlow);

// ─── STARS ───────────────────────────────────────────────────────────────────
const reactiveParticleFields = [];

function makeStarTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 64;
  canvas.height = 64;
  const context = canvas.getContext('2d');
  const gradient = context.createRadialGradient(32, 32, 0, 32, 32, 32);
  gradient.addColorStop(0, 'rgba(255, 255, 255, 1)');
  gradient.addColorStop(0.18, 'rgba(255, 255, 255, 0.95)');
  gradient.addColorStop(0.35, 'rgba(255, 255, 255, 0.4)');
  gradient.addColorStop(1, 'rgba(255, 255, 255, 0)');
  context.fillStyle = gradient;
  context.fillRect(0, 0, 64, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.needsUpdate = true;
  return texture;
}

const starTexture = makeStarTexture();
const starSpriteMaterial = (color, size, opacity) => new THREE.PointsMaterial({
  color,
  size,
  sizeAttenuation: true,
  transparent: true,
  opacity,
  blending: THREE.AdditiveBlending,
  depthWrite: false,
  alphaTest: 0.01,
  map: starTexture,
});

function makeStars(count, radius, size, color) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    const theta = Math.random() * Math.PI * 2;
    const phi = Math.acos(2 * Math.random() - 1);
    const r = radius * (0.5 + Math.random() * 0.5);
    pos[i * 3]     = r * Math.sin(phi) * Math.cos(theta);
    pos[i * 3 + 1] = r * Math.sin(phi) * Math.sin(theta);
    pos[i * 3 + 2] = r * Math.cos(phi);
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = starSpriteMaterial(color, size, 0.95);
  const points = new THREE.Points(geo, mat);
  reactiveParticleFields.push({
    kind: 'stars',
    points,
    positions: geo.attributes.position.array,
    basePositions: pos.slice(),
    strength: 0.22,
    radius: Math.max(radius * 0.22, 170)
  });
  return points;
}

// Add a few sparse, widely spaced star layers
scene.add(makeStars(6000, 3000, 0.14, 0xffffff));
scene.add(makeStars(4500, 2800, 0.11, 0x9fbfff));
scene.add(makeStars(3500, 3200, 0.09, 0xded6ff));

// ─── NEBULA PARTICLES ────────────────────────────────────────────────────────
function makeNebula(count, spread, color, size) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 3);
  for (let i = 0; i < count; i++) {
    pos[i * 3]     = (Math.random() - 0.5) * spread;
    pos[i * 3 + 1] = (Math.random() - 0.5) * spread * 0.5;
    pos[i * 3 + 2] = (Math.random() - 0.5) * spread;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  const mat = starSpriteMaterial(color, size * 0.55, 0.5);
  const points = new THREE.Points(geo, mat);
  reactiveParticleFields.push({
    kind: 'nebula',
    points,
    positions: geo.attributes.position.array,
    basePositions: pos.slice(),
    strength: 0.06,
    radius: Math.max(spread * 0.14, 70)
  });
  return points;
}

// ─── FLOATING DUST ───────────────────────────────────────────────────────────
const dustGeo = new THREE.BufferGeometry();
const dustPos = new Float32Array(2000 * 3);
const dustVel = new Float32Array(2000 * 3);
for (let i = 0; i < 2000; i++) {
  dustPos[i * 3]     = (Math.random() - 0.5) * 200;
  dustPos[i * 3 + 1] = (Math.random() - 0.5) * 100;
  dustPos[i * 3 + 2] = (Math.random() - 0.5) * 200;
  dustVel[i * 3]     = (Math.random() - 0.5) * 0.012;
  dustVel[i * 3 + 1] = (Math.random() - 0.5) * 0.012;
  dustVel[i * 3 + 2] = (Math.random() - 0.5) * 0.012;
}
dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
const dust = new THREE.Points(dustGeo, new THREE.PointsMaterial({
  color: 0xaaaaff, size: 0.08, sizeAttenuation: true,
  transparent: true, opacity: 0.5, blending: THREE.AdditiveBlending
}));
dust.name = 'dust';
scene.add(dust);

// ─── BUBBLE LETTER MATERIAL ──────────────────────────────────────────────────
function makeBubbleMat(hue) {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color().setHSL(hue, 0.4, 0.85),
    metalness: 0.0,
    roughness: 0.05,
    transmission: 0.85,
    thickness: 3.0,
    ior: 1.5,
    reflectivity: 1.0,
    clearcoat: 1.0,
    clearcoatRoughness: 0.05,
    transparent: true,
    opacity: 0.92,
    envMapIntensity: 2.0,
    attenuationColor: new THREE.Color().setHSL(hue, 0.6, 0.5),
    attenuationDistance: 2.0,
  });
}

// ─── PROCEDURAL ENV MAP ──────────────────────────────────────────────────────
const pmremGen = new THREE.PMREMGenerator(renderer);
const envScene = new THREE.Scene();
const envColors = [0x7af0ff, 0xc084fc, 0xff6fff, 0x40ffff, 0x8040ff];
for (let i = 0; i < 5; i++) {
  const l = new THREE.PointLight(envColors[i], 10, 50);
  l.position.set(Math.cos(i * Math.PI * 2 / 5) * 20, Math.sin(i * 1.3) * 10, Math.sin(i * Math.PI * 2 / 5) * 20);
  envScene.add(l);
}
envScene.add(new THREE.AmbientLight(0x111133, 5));
const envRT = pmremGen.fromScene(envScene, 0.01, 0.1, 200);
scene.environment = envRT.texture;

// ─── TEXT + LETTER MESHES ────────────────────────────────────────────────────
const letterGroup = new THREE.Group();
letterGroup.name = 'letterGroup';
scene.add(letterGroup);

const letterMeshes = [];
const letterTrails = [];
let fontReady = false;
// Project slides (created after font loads)
let projectCount = 11;
const projectLetters = [];
const projectGroup = new THREE.Group();
projectGroup.name = 'projectGroup';
projectGroup.visible = false;
scene.add(projectGroup);

// Extract the first meaningful paragraph from a README's markdown text
function extractReadmeDescription(markdown) {
  if (!markdown) return null;
  // Remove frontmatter
  const noFrontmatter = markdown.replace(/^---[\s\S]*?---\n?/, '');
  // Remove HTML comments
  const noComments = noFrontmatter.replace(/<!--[\s\S]*?-->/g, '');
  // Split into lines
  const lines = noComments.split('\n');
  const paragraphLines = [];
  let inCodeBlock = false;

  for (const raw of lines) {
    const line = raw.trim();
    // Toggle code block state
    if (line.startsWith('```') || line.startsWith('~~~')) {
      inCodeBlock = !inCodeBlock;
      continue;
    }
    if (inCodeBlock) continue;
    // Skip headings, badges/images, blank lines, horizontal rules, list items
    if (!line) {
      if (paragraphLines.length > 0) break; // end of first paragraph
      continue;
    }
    if (/^#{1,6}\s/.test(line)) continue;   // heading
    if (/^[\-\*_]{3,}$/.test(line)) continue; // hr
    if (/^[\-\*\+]\s/.test(line)) continue;   // list
    if (/^\d+\.\s/.test(line)) continue;      // ordered list
    if (/^>/.test(line)) continue;            // blockquote
    if (/^\[!/.test(line)) continue;          // GitHub alert
    // Strip inline markdown: images, links, bold, italic, code
    const clean = line
      .replace(/!\[.*?\]\(.*?\)/g, '')   // images
      .replace(/\[.*?\]\(.*?\)/g, m => m.replace(/\[(.*)\].*/, '$1')) // links -> text
      .replace(/`{1,3}[^`]*`{1,3}/g, '') // inline code
      .replace(/[*_]{1,3}([^*_]+)[*_]{1,3}/g, '$1') // bold/italic
      .replace(/<[^>]+>/g, '')            // HTML tags
      .replace(/\[\!\[.*?\].*?\]/g, '')  // badge links
      .trim();
    // Skip lines that are purely badge/shield URLs or empty after cleaning
    if (!clean || /^https?:\/\//.test(clean) || clean.length < 10) continue;
    paragraphLines.push(clean);
    if (paragraphLines.length >= 4) break; // cap at ~4 sentences
  }
  if (paragraphLines.length === 0) return null;
  return paragraphLines.join(' ');
}

async function fetchReadmeDescription(repoName) {
  try {
    const res = await fetch(`https://api.github.com/repos/Aryamanironman/${repoName}/readme`, {
      headers: { 'Accept': 'application/vnd.github.v3+json' }
    });
    if (!res.ok) return null;
    const data = await res.json();
    if (!data.content) return null;
    // GitHub returns base64-encoded content
    const decoded = atob(data.content.replace(/\n/g, ''));
    return extractReadmeDescription(decoded);
  } catch {
    return null;
  }
}

async function fetchGithubProjects() {
  try {
    const response = await fetch('https://api.github.com/users/Aryamanironman/repos?sort=updated&per_page=30');
    if (!response.ok) throw new Error('GitHub API response error');
    const repos = await response.json();
    if (!Array.isArray(repos)) throw new Error('GitHub repos response is not an array');
    const sorted = repos.sort((a, b) => {
      if (a.fork !== b.fork) return a.fork ? 1 : -1;
      if (b.stargazers_count !== a.stargazers_count) return b.stargazers_count - a.stargazers_count;
      return new Date(b.updated_at) - new Date(a.updated_at);
    });
    const selected = sorted.slice(0, 11);
    if (selected.length === 0) return null;

    // Fetch READMEs in parallel for all selected repos
    const readmeDescs = await Promise.all(
      selected.map(repo => fetchReadmeDescription(repo.name))
    );

    return selected.map((repo, idx) => {
      const cleanTitle = repo.name
        .split(/[-_]+/)
        .map(w => w.charAt(0).toUpperCase() + w.slice(1))
        .join(' ');
      const techList = [];
      if (repo.language) techList.push(repo.language);
      if (repo.topics && Array.isArray(repo.topics)) {
        repo.topics.forEach(t => {
          if (techList.length < 3 && !techList.includes(t)) {
            const formatted = t.length <= 4 ? t.toUpperCase() : t.charAt(0).toUpperCase() + t.slice(1);
            techList.push(formatted);
          }
        });
      }
      if (techList.length === 0) techList.push('Web');
      // Priority: README > repo.description > fallback
      const desc = readmeDescs[idx]
        || repo.description
        || `A public GitHub repository containing source code and development details for ${cleanTitle}.`;
      return {
        title: cleanTitle,
        tech: techList.join(' · '),
        desc,
        url: repo.html_url,
        year: new Date(repo.created_at).getFullYear(),
        stars: repo.stargazers_count || 0,
        forks: repo.forks_count || 0
      };
    });
  } catch (err) {
    console.warn('Could not fetch GitHub repos, using local fallbacks:', err);
    return null;
  }
}

const loader = new FontLoader();
loader.load('https://cdn.jsdelivr.net/npm/three@0.164.1/examples/fonts/helvetiker_bold.typeface.json', async (font) => {
  const letters = 'ARYAMAN';
  const letterSpacing = 11.5;
  const totalWidth = (letters.length - 1) * letterSpacing;
  const hues = [0.58, 0.72, 0.85, 0.65, 0.78, 0.55, 0.68];

  letters.split('').forEach((char, i) => {
    const geo = new TextGeometry(char, {
      font, size: 10.8, depth: 4,
      curveSegments: 20,
      bevelEnabled: true, bevelThickness: 0.8, bevelSize: 0.5, bevelSegments: 12
    });
    geo.computeBoundingBox();
    const cx = (geo.boundingBox.max.x + geo.boundingBox.min.x) / 2;
    const cy = (geo.boundingBox.max.y + geo.boundingBox.min.y) / 2;
    geo.translate(-cx, -cy, 0);

    const mat = makeBubbleMat(hues[i]);
    const mesh = new THREE.Mesh(geo, mat);
    mesh.name = `letter_${char}_${i}`;

    const x = i * letterSpacing - totalWidth / 2;
    mesh.position.set(x, 0, 0);
    mesh.userData = {
      baseX: x, baseY: 0, baseZ: 0,
      floatOffset: Math.random() * Math.PI * 2,
      floatSpeed: 0.3 + Math.random() * 0.2,
      rotSpeed: (Math.random() - 0.5) * 0.004,
      wobbleX: (Math.random() - 0.5) * 0.008,
      wobbleZ: (Math.random() - 0.5) * 0.008,
      index: i
    };
    letterGroup.add(mesh);
    letterMeshes.push(mesh);

    const trailMat = new THREE.MeshBasicMaterial({
      color: mat.color,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide
    });
    const trail = new THREE.Mesh(geo, trailMat);
    trail.renderOrder = mesh.renderOrder - 1;
    trail.position.copy(mesh.position);
    trail.scale.setScalar(0.96);
    letterGroup.add(trail);
    letterTrails.push({ source: mesh, trail });
  });

  fontReady = true;

  // ── Project paper cards ───────────────────────────────────────────────────
  let projects = [
    {
      title: 'Neural Style Transfer',
      tech: 'Python · PyTorch · OpenCV',
      desc: 'Real-time artistic style transfer using deep convolutional networks. Processes live webcam feed at 24fps.',
      stars: 42, forks: 8, year: 2024
    },
    {
      title: 'Autonomous Drone Nav',
      tech: 'ROS2 · C++ · SLAM',
      desc: 'Vision-based obstacle avoidance and path planning for indoor UAVs. Sub-10cm positioning accuracy.',
      stars: 35, forks: 12, year: 2024
    },
    {
      title: 'Generative Music AI',
      tech: 'TensorFlow · MIDI · WebAudio',
      desc: 'Transformer model trained on 50k MIDI files. Composes original melodies in real time from mood prompts.',
      stars: 88, forks: 15, year: 2024
    },
    {
      title: 'Crypto Portfolio Tracker',
      tech: 'React · Node.js · WebSocket',
      desc: 'Live P&L dashboard with predictive alerts. Connects to 12 exchanges via unified REST + WS API layer.',
      stars: 56, forks: 9, year: 2024
    },
    {
      title: '3D Portfolio Engine',
      tech: 'Three.js · GLSL · WebGL',
      desc: 'This very site — a scroll-driven cinematic WebGL experience with bloom, physics & spatial audio.',
      stars: 120, forks: 24, year: 2024
    },
    {
      title: 'Sign Language Decoder',
      tech: 'MediaPipe · TFLite · Swift',
      desc: 'iOS app translating ASL gestures to text in real time. 94% accuracy across 200-sign vocabulary.',
      stars: 29, forks: 4, year: 2024
    },
    {
      title: 'Smart Home Hub',
      tech: 'Raspberry Pi · MQTT · Vue',
      desc: 'Unified dashboard for 40+ IoT devices. Includes ML-based energy optimisation saving ~28% power.',
      stars: 48, forks: 11, year: 2024
    },
    {
      title: 'AI Code Reviewer',
      tech: 'GPT-4 API · GitHub Actions',
      desc: 'Automated PR reviews with security scanning, complexity scoring and suggested refactors. Used by 300+ devs.',
      stars: 145, forks: 30, year: 2024
    },
    {
      title: 'Ray Tracer from Scratch',
      tech: 'C++ · CUDA · BVH',
      desc: 'GPU-accelerated path tracer with global illumination, subsurface scattering and spectral rendering.',
      stars: 72, forks: 14, year: 2024
    },
    {
      title: 'Blockchain Voting App',
      tech: 'Solidity · Ethers.js · React',
      desc: 'Tamper-proof on-chain voting with zk-SNARK privacy proofs. Deployed on Polygon mainnet.',
      stars: 94, forks: 19, year: 2024
    },
    {
      title: 'AR Campus Guide',
      tech: 'ARKit · CoreML · Swift',
      desc: 'Markerless AR wayfinding app for university campuses. Recognises 500+ buildings and points of interest.',
      stars: 40, forks: 6, year: 2024
    },
  ];

  const githubProjects = await fetchGithubProjects();
  if (githubProjects && githubProjects.length > 0) {
    projects = githubProjects;
    projectCount = projects.length;
  }




  const letterWaypoints = [
    { x:   0, y:   0, z: -60,  ry:  0.0,  rx:  0.00 },
    { x:  30, y:  12, z: -130, ry: -0.35, rx:  0.05 },
    { x: -25, y:  -8, z: -200, ry:  0.30, rx: -0.04 },
    { x:  18, y:  16, z: -275, ry: -0.25, rx:  0.06 },
    { x: -35, y:  -5, z: -345, ry:  0.40, rx:  0.00 },
    { x:   8, y: -14, z: -415, ry: -0.15, rx:  0.08 },
    { x:  28, y:   8, z: -490, ry: -0.45, rx: -0.05 },
    { x: -20, y:  18, z: -560, ry:  0.30, rx:  0.04 },
    { x:  12, y:  -6, z: -635, ry: -0.20, rx: -0.06 },
    { x: -30, y:  10, z: -705, ry:  0.35, rx:  0.03 },
    { x:   5, y:  -2, z: -775, ry:  0.10, rx:  0.00 },
  ];

  const cardAccentHues = [0.58, 0.72, 0.85, 0.65, 0.78, 0.55, 0.68, 0.62, 0.80, 0.50, 0.70];

  const langColors = {
    python: '#3572A5',
    javascript: '#f1e05a',
    typescript: '#3178c6',
    react: '#61dafb',
    solidity: '#aa6746',
    'c++': '#f34b7d',
    html: '#e34c26',
    css: '#563d7c',
    swift: '#f05138',
    rust: '#dea584',
    web: '#58a6ff'
  };

  function getMockCodeSnippet(title, tech) {
    const primary = tech.split(' · ')[0].toLowerCase();
    if (primary.includes('python')) {
      return [
        `import tensorflow as tf`,
        `import numpy as np`,
        ``,
        `def run_model(data):`,
        `    # Processing ${title}`,
        `    inputs = tf.constant(data)`,
        `    return tf.nn.softmax(inputs)`
      ];
    } else if (primary.includes('react') || primary.includes('javascript') || primary.includes('node') || primary.includes('vue')) {
      return [
        `import React, { useState } from 'react';`,
        `import './${title}.css';`,
        ``,
        `export function App() {`,
        `  const [data, setData] = useState(null);`,
        `  // Initializing ${title}`,
        `  return <div>Welcome to ${title}</div>;`,
        `}`
      ];
    } else if (primary.includes('c++') || primary.includes('ros') || primary.includes('cuda')) {
      return [
        `#include <iostream>`,
        `#include <vector>`,
        ``,
        `int main(int argc, char** argv) {`,
        `    // Running ${title}`,
        `    std::cout << "Starting module..." << std::endl;`,
        `    return 0;`,
        `}`
      ];
    } else if (primary.includes('solidity')) {
      return [
        `// SPDX-License-Identifier: MIT`,
        `pragma solidity ^0.8.0;`,
        ``,
        `contract ${title.replace(/\s+/g, '')} {`,
        `    address public owner;`,
        `    constructor() {`,
        `        owner = msg.sender;`,
        `    }`,
        `}`
      ];
    } else {
      return [
        `# Clone repository`,
        `git clone git@github.com:Aryamanironman/${title.replace(/\s+/g, '-')}.git`,
        `cd ${title.replace(/\s+/g, '-')}`,
        `npm install`,
        `npm run dev`,
        `# Running development server...`
      ];
    }
  }

  function makeProjectCardTexture(project, accentHue) {
    const W = 1024, H = 640;
    const cv = document.createElement('canvas');
    cv.width = W; cv.height = H;
    const ctx = cv.getContext('2d');

    // GitHub Dark Mode Background
    ctx.beginPath();
    const bgGrad = ctx.createLinearGradient(0, 0, 0, H);
    bgGrad.addColorStop(0, '#0d1117');
    bgGrad.addColorStop(1, '#161b22');
    ctx.fillStyle = bgGrad;
    ctx.roundRect(0, 0, W, H, 32);
    ctx.fill();

    // Subtle grain overlay
    ctx.globalAlpha = 0.03;
    for (let n = 0; n < 4000; n++) {
      ctx.fillStyle = Math.random() > 0.5 ? '#000' : '#fff';
      ctx.fillRect(Math.random() * W, Math.random() * H, 1.5, 1.5);
    }
    ctx.globalAlpha = 1;

    const accentColor = new THREE.Color().setHSL(accentHue, 0.7, 0.55);
    const hex = '#' + accentColor.getHexString();

    // Top Accent Strip
    ctx.beginPath();
    ctx.fillStyle = hex;
    ctx.roundRect(0, 0, W, 14, [32, 32, 0, 0]);
    ctx.fill();

    // Side Accent Line
    ctx.fillStyle = hex;
    ctx.globalAlpha = 0.18;
    ctx.fillRect(0, 14, 8, H - 14);
    ctx.globalAlpha = 1;

    // Repo Folder/Book Icon
    const repoIconX = 52, repoIconY = 48, repoIconSize = 28;
    ctx.strokeStyle = '#8b949e';
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.roundRect(repoIconX, repoIconY, repoIconSize, repoIconSize * 1.1, 4);
    ctx.stroke();
    // Repo icon details
    ctx.beginPath();
    ctx.moveTo(repoIconX + repoIconSize * 0.3, repoIconY + repoIconSize * 0.3);
    ctx.lineTo(repoIconX + repoIconSize * 0.7, repoIconY + repoIconSize * 0.3);
    ctx.moveTo(repoIconX + repoIconSize * 0.3, repoIconY + repoIconSize * 0.6);
    ctx.lineTo(repoIconX + repoIconSize * 0.7, repoIconY + repoIconSize * 0.6);
    ctx.stroke();

    // Repo header text
    ctx.fillStyle = '#8b949e';
    ctx.font = '24px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('Aryamanironman /', repoIconX + repoIconSize + 14, repoIconY + repoIconSize / 2 + 1);

    const ownerTextW = ctx.measureText('Aryamanironman /').width;
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 24px system-ui, sans-serif';
    const cleanRepoName = project.title.toLowerCase().replace(/\s+/g, '-');
    ctx.fillText(cleanRepoName, repoIconX + repoIconSize + 14 + ownerTextW + 6, repoIconY + repoIconSize / 2 + 1);

    // Public badge
    const badgeX = repoIconX + repoIconSize + 14 + ownerTextW + 12 + ctx.measureText(cleanRepoName).width;
    const badgeW = 74, badgeH = 26;
    ctx.strokeStyle = '#30363d';
    ctx.fillStyle = 'rgba(110, 118, 129, 0.15)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.roundRect(badgeX, repoIconY + 1, badgeW, badgeH, 12);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#8b949e';
    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('Public', badgeX + badgeW / 2, repoIconY + 1 + badgeH / 2 + 1);

    // Stars & Forks (Top Right)
    ctx.fillStyle = '#8b949e';
    ctx.font = '22px system-ui, sans-serif';
    ctx.textAlign = 'right';
    ctx.textBaseline = 'middle';
    const statsText = `★ ${project.stars || 0}      ⌥ ${project.forks || 0}`;
    ctx.fillText(statsText, W - 52, repoIconY + repoIconSize / 2);

    // Horizontal divider
    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(52, 100);
    ctx.lineTo(W - 52, 100);
    ctx.stroke();

    // Project title in left column
    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 44px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    ctx.fillText(project.title, 52, 120);

    // Description text in left column — smaller font, max 5 lines
    ctx.fillStyle = '#adbac7';
    ctx.font = '20px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';
    const words = project.desc.split(' ');
    let line = '';
    let dy = 186;
    const maxW = 440;
    const maxLines = 5;
    let lineCount = 0;
    for (let wi = 0; wi < words.length; wi++) {
      const word = words[wi];
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW) {
        if (lineCount >= maxLines - 1) {
          // Truncate last line with ellipsis
          let truncated = line;
          while (ctx.measureText(truncated + '…').width > maxW && truncated.length > 0) {
            truncated = truncated.slice(0, -1);
          }
          ctx.fillText(truncated + '…', 52, dy);
          line = '';
          break;
        }
        ctx.fillText(line, 52, dy);
        dy += 30;
        line = word;
        lineCount++;
      } else {
        line = test;
      }
    }
    if (line) ctx.fillText(line, 52, dy);

    // Draw topics/chips
    const chips = project.tech.split(' · ');
    let chipCx = 52;
    const chipY = 440;
    chips.forEach((chip) => {
      ctx.font = '500 18px system-ui, sans-serif';
      const tw = ctx.measureText(chip).width;
      const chipW = tw + 24;
      const chipH = 32;
      ctx.beginPath();
      ctx.roundRect(chipCx, chipY - chipH + 6, chipW, chipH, 16);
      ctx.fillStyle = 'rgba(56, 139, 253, 0.15)';
      ctx.fill();
      ctx.strokeStyle = 'rgba(56, 139, 253, 0.4)';
      ctx.lineWidth = 1.5;
      ctx.stroke();
      ctx.fillStyle = '#58a6ff';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(chip, chipCx + 12, chipY - 10);
      chipCx += chipW + 10;
    });

    // Language Dot & Language Name
    const primaryLang = project.tech.split(' · ')[0];
    const color = langColors[primaryLang.toLowerCase()] || '#8b949e';
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.arc(52 + 8, 510, 8, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = '#8b949e';
    ctx.font = '20px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(primaryLang, 52 + 24, 510);

    // Draw Code Editor on the Right Column
    const edX = 540, edY = 130, edW = 432, edH = 360;
    ctx.fillStyle = '#0d1117';
    ctx.beginPath();
    ctx.roundRect(edX, edY, edW, edH, 12);
    ctx.fill();
    ctx.strokeStyle = '#30363d';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    // Editor tab header
    ctx.fillStyle = '#161b22';
    ctx.beginPath();
    ctx.roundRect(edX, edY, edW, 36, [12, 12, 0, 0]);
    ctx.fill();
    ctx.beginPath();
    ctx.moveTo(edX, edY + 36);
    ctx.lineTo(edX + edW, edY + 36);
    ctx.stroke();

    // Red, yellow, green window circles
    const dotColors = ['#ff5f56', '#ffbd2e', '#27c93f'];
    for (let c = 0; c < 3; c++) {
      ctx.fillStyle = dotColors[c];
      ctx.beginPath();
      ctx.arc(edX + 20 + c * 16, edY + 18, 6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Tab name
    ctx.fillStyle = '#8b949e';
    ctx.font = '500 16px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    let ext = '.js';
    const primaryTech = project.tech.split(' · ')[0].toLowerCase();
    if (primaryTech.includes('python')) ext = '.py';
    else if (primaryTech.includes('c++') || primaryTech.includes('cuda') || primaryTech.includes('ros')) ext = '.cpp';
    else if (primaryTech.includes('solidity')) ext = '.sol';
    else if (primaryTech.includes('swift')) ext = '.swift';
    const tabName = project.title.toLowerCase().replace(/\s+/g, '_') + ext;
    ctx.fillText(tabName, edX + 80, edY + 18);

    // Draw file icon next to tab name
    ctx.fillStyle = '#e3b341'; // default yellow file icon
    if (ext === '.py') ctx.fillStyle = '#3572A5';
    if (ext === '.cpp') ctx.fillStyle = '#f34b7d';
    if (ext === '.sol') ctx.fillStyle = '#aa6746';
    ctx.beginPath();
    ctx.roundRect(edX + 65, edY + 10, 10, 16, 2);
    ctx.fill();

    // Draw mock code lines
    const snippet = getMockCodeSnippet(project.title, project.tech);
    let codeY = edY + 55;
    ctx.font = '16px "Fira Code", "Courier New", monospace';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'top';

    snippet.forEach((lineText) => {
      let codeX = edX + 24;
      const tokens = lineText.split(/(\s+|\(|\)|\{|\}|;|=|"|'|\bimport\b|\bfrom\b|\bdef\b|\bconst\b|\blet\b|\bexport\b|\bfunction\b|\breturn\b|\bpragma\b|\bcontract\b|\bpublic\b|\baddress\b|\bconstructor\b|\bint\b|\bstd\b|\bcout\b|\bendl\b|\bclass\b|#.*|\/\/.*)/g);
      tokens.forEach((token) => {
        if (!token) return;
        if (token.startsWith('#') || token.startsWith('//')) {
          ctx.fillStyle = '#8b949e'; // Comment
        } else if (['import', 'from', 'def', 'const', 'let', 'export', 'function', 'return', 'pragma', 'contract', 'public', 'address', 'constructor', 'int', 'class'].includes(token)) {
          ctx.fillStyle = '#ff7b72'; // Keyword
        } else if (token.startsWith('"') || token.startsWith("'")) {
          ctx.fillStyle = '#a5d6ff'; // String
        } else if (['=', '(', ')', '{', '}', ';'].includes(token)) {
          ctx.fillStyle = '#ff7b72'; // Operator/Bracket
        } else {
          ctx.fillStyle = '#c9d1d9'; // Default
        }
        ctx.fillText(token, codeX, codeY);
        codeX += ctx.measureText(token).width;
      });
      codeY += 24;
    });

    // Horizontal divider for footer
    ctx.strokeStyle = '#30363d';
    ctx.beginPath();
    ctx.moveTo(52, 545);
    ctx.lineTo(W - 52, 545);
    ctx.stroke();

    // Footer Branch Indicator
    ctx.fillStyle = '#8b949e';
    ctx.font = '20px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText('⌥  main', 52, 580);

    // Footer - Primary Action Button (GitHub Green)
    const btnX = W - 300, btnY = 555, btnW = 248, btnH = 48;
    ctx.fillStyle = '#238636';
    ctx.beginPath();
    ctx.roundRect(btnX, btnY, btnW, btnH, 8);
    ctx.fill();
    ctx.strokeStyle = '#2ea44f';
    ctx.lineWidth = 1.5;
    ctx.stroke();

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('VIEW ON GITHUB ↗', btnX + btnW / 2, btnY + btnH / 2 + 1);

    // Decorative corner triangle
    ctx.beginPath();
    ctx.moveTo(W - 60, H);
    ctx.lineTo(W, H - 60);
    ctx.lineTo(W, H);
    ctx.closePath();
    ctx.fillStyle = hex;
    ctx.globalAlpha = 0.25;
    ctx.fill();
    ctx.globalAlpha = 1;

    return new THREE.CanvasTexture(cv);
  }

  projects.forEach((proj, i) => {
    const texture = makeProjectCardTexture(proj, cardAccentHues[i]);

    const cardW = 38, cardH = 24;
    const geo = new THREE.PlaneGeometry(cardW, cardH);

    const mat = new THREE.MeshStandardMaterial({
      map: texture,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      roughness: 1.0,
      metalness: 0.0,
      envMapIntensity: 0.0,
      toneMapped: true,
    });

    const mesh = new THREE.Mesh(geo, mat);
    const wp = letterWaypoints[i];
    mesh.position.set(wp.x, wp.y, wp.z);
    mesh.rotation.set(wp.rx, wp.ry, 0);
    mesh.userData = {
      index: i,
      baseX: wp.x, baseY: wp.y, baseZ: wp.z,
      baseRY: wp.ry, baseRX: wp.rx,
      floatOffset: Math.random() * Math.PI * 2,
      floatSpeed: 0.28 + Math.random() * 0.12,
      url: proj.url || 'https://github.com/Aryamanironman'
    };
    mesh.visible = true;
    projectGroup.add(mesh);
    projectLetters.push(mesh);

    const accentColor = new THREE.Color().setHSL(cardAccentHues[i], 0.9, 0.65);
    const hw = cardW / 2 + 0.25, hh = cardH / 2 + 0.25;
    const borderPts = [
      new THREE.Vector3(-hw, -hh, 0.05),
      new THREE.Vector3( hw, -hh, 0.05),
      new THREE.Vector3( hw,  hh, 0.05),
      new THREE.Vector3(-hw,  hh, 0.05),
      new THREE.Vector3(-hw, -hh, 0.05),
    ];
    const borderGeo = new THREE.BufferGeometry().setFromPoints(borderPts);
    const borderMat = new THREE.LineBasicMaterial({
      color: accentColor,
      transparent: true,
      opacity: 0,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    });
    const border = new THREE.Line(borderGeo, borderMat);
    border.userData.isBorder = true;
    mesh.add(border);
  });
  startExperience();
}, undefined, () => {
  fontReady = true;
  startExperience();
});

// ─── FAKE LOAD PROGRESS ──────────────────────────────────────────────────────
const bar = document.getElementById('bar');
const pct = document.getElementById('pct');
let fakeLoad = 0;
const loadInt = setInterval(() => {
  fakeLoad += Math.random() * 8;
  if (fakeLoad >= 90) { fakeLoad = 90; clearInterval(loadInt); }
  bar.style.width = fakeLoad + '%';
  pct.textContent = Math.floor(fakeLoad) + '%';
}, 120);

function startExperience() {
  fakeLoad = 100;
  bar.style.width = '100%';
  pct.textContent = '100%';
  setTimeout(() => {
    const loadEl = document.getElementById('loading');
    loadEl.style.opacity = '0';
    setTimeout(() => loadEl.remove(), 1200);
  }, 600);
}

// ─── GLOW RINGS AROUND LETTERS ───────────────────────────────────────────────
function makeGlowRing(color, radius, tube) {
  const geo = new THREE.TorusGeometry(radius, tube, 8, 48);
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.3, blending: THREE.AdditiveBlending });
  return new THREE.Mesh(geo, mat);
}

// ─── INNER WORLD (AI PROJECT SCENE) ──────────────────────────────────────────
const innerWorldGroup = new THREE.Group();
innerWorldGroup.name = 'innerWorld';
innerWorldGroup.visible = false;
scene.add(innerWorldGroup);

function buildInnerWorld() {
  const gridSize = 200;
  const gridDiv = 40;
  const gridGeo = new THREE.PlaneGeometry(gridSize, gridSize, gridDiv, gridDiv);
  const gridMat = new THREE.MeshBasicMaterial({
    color: 0x00ffcc, wireframe: true,
    transparent: true, opacity: 0.12,
    blending: THREE.AdditiveBlending
  });
  const grid = new THREE.Mesh(gridGeo, gridMat);
  grid.rotation.x = -Math.PI / 2;
  grid.position.y = -20;
  grid.name = 'grid';
  innerWorldGroup.add(grid);

  const coreGeo = new THREE.IcosahedronGeometry(4, 5);
  const coreMat = new THREE.MeshPhysicalMaterial({
    color: 0x40ffee, emissive: 0x00aaff, emissiveIntensity: 2,
    metalness: 0.8, roughness: 0.1, transmission: 0.4, thickness: 2
  });
  const core = new THREE.Mesh(coreGeo, coreMat);
  core.name = 'aiCore';
  innerWorldGroup.add(core);

  for (let r = 0; r < 3; r++) {
    const ringGeo = new THREE.TorusGeometry(6 + r * 2.5, 0.12, 8, 80);
    const ringMat = new THREE.MeshBasicMaterial({
      color: [0x00ffcc, 0xc084fc, 0x7af0ff][r],
      transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending
    });
    const ring = new THREE.Mesh(ringGeo, ringMat);
    ring.rotation.x = Math.PI / 2 * (r * 0.4 + 0.1);
    ring.rotation.z = r * 0.7;
    ring.name = `ring_${r}`;
    innerWorldGroup.add(ring);
  }

  const panelColors = [0x002244, 0x110033, 0x002233];
  const panelData = [
    { x: -18, y: 5, z: -10, rx: 0, ry: 0.3, label: 'NEURAL NET' },
    { x: 18, y: 3, z: -8, rx: 0, ry: -0.3, label: 'DATA STREAM' },
    { x: 0, y: 12, z: -20, rx: -0.1, ry: 0, label: 'AI CORE v2.1' },
  ];
  panelData.forEach((pd, i) => {
    const panelGeo = new THREE.PlaneGeometry(12, 7);
    const panelMat = new THREE.MeshBasicMaterial({
      color: panelColors[i], transparent: true, opacity: 0.7, side: THREE.DoubleSide
    });
    const panel = new THREE.Mesh(panelGeo, panelMat);
    panel.position.set(pd.x, pd.y, pd.z);
    panel.rotation.set(pd.rx, pd.ry, 0);
    panel.name = `panel_${i}`;
    innerWorldGroup.add(panel);

    const borderGeo = new THREE.EdgesGeometry(panelGeo);
    const borderMat = new THREE.LineBasicMaterial({
      color: [0x00ffcc, 0xc084fc, 0x7af0ff][i],
      transparent: true, opacity: 0.9
    });
    const border = new THREE.LineSegments(borderGeo, borderMat);
    panel.add(border);

    for (let l = 0; l < 4; l++) {
      const lineGeo = new THREE.BufferGeometry().setFromPoints([
        new THREE.Vector3(-4.5, 2.5 - l * 1.2, 0.01),
        new THREE.Vector3(4.5 * (0.3 + Math.random() * 0.7), 2.5 - l * 1.2, 0.01)
      ]);
      const lineMat = new THREE.LineBasicMaterial({
        color: [0x00ffcc, 0xc084fc, 0x7af0ff][i],
        transparent: true, opacity: 0.5
      });
      panel.add(new THREE.Line(lineGeo, lineMat));
    }
  });

  for (let o = 0; o < 25; o++) {
    const size = 0.2 + Math.random() * 0.6;
    const geo = new THREE.SphereGeometry(size, 8, 8);
    const colors = [0x00ffcc, 0xc084fc, 0x7af0ff, 0xff66ff];
    const mat = new THREE.MeshBasicMaterial({
      color: colors[Math.floor(Math.random() * colors.length)],
      transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending
    });
    const orb = new THREE.Mesh(geo, mat);
    orb.position.set(
      (Math.random() - 0.5) * 50,
      (Math.random() - 0.5) * 30,
      (Math.random() - 0.5) * 40
    );
    orb.userData.floatOffset = Math.random() * Math.PI * 2;
    orb.userData.floatSpeed = 0.5 + Math.random() * 0.5;
    orb.name = `orb_${o}`;
    innerWorldGroup.add(orb);
  }

  for (let b = 0; b < 3; b++) {
    const count = 300;
    const beamGeo = new THREE.BufferGeometry();
    const bPos = new Float32Array(count * 3);
    for (let j = 0; j < count; j++) {
      bPos[j * 3]     = (Math.random() - 0.5) * 2;
      bPos[j * 3 + 1] = -15 + j * 0.1;
      bPos[j * 3 + 2] = (Math.random() - 0.5) * 2;
    }
    beamGeo.setAttribute('position', new THREE.BufferAttribute(bPos, 3));
    const beamMat = new THREE.PointsMaterial({
      color: [0x00ffcc, 0x7af0ff, 0xc084fc][b],
      size: 0.12, transparent: true, opacity: 0.7,
      blending: THREE.AdditiveBlending
    });
    const beam = new THREE.Points(beamGeo, beamMat);
    beam.position.x = (b - 1) * 12;
    beam.name = `beam_${b}`;
    innerWorldGroup.add(beam);
  }

  const iLight1 = new THREE.PointLight(0x00ffcc, 5, 60);
  iLight1.position.set(0, 0, 0);
  innerWorldGroup.add(iLight1);
  const iLight2 = new THREE.PointLight(0xc084fc, 4, 80);
  iLight2.position.set(-20, 10, -20);
  innerWorldGroup.add(iLight2);
}
buildInnerWorld();

// ─── CAMERA ANIMATION STATE ──────────────────────────────────────────────────
const projectStart = 0.25;
let hoveredProject = null;
let lastHoveredProject = null;
let lastActiveIndex = -1;
let clickStartX = 0;
let clickStartY = 0;

const camState = {
  targetPos: new THREE.Vector3(0, 0, 120),
  targetLook: new THREE.Vector3(0, 0, 0),
  currentPos: new THREE.Vector3(0, 0, 120),
  currentLook: new THREE.Vector3(0, 0, 0),
};
let cameraFollow = new THREE.Vector2(0, 0);
const mouse = { x: 0, y: 0, tx: 0, ty: 0 };
const hoverRaycaster = new THREE.Raycaster();
const hoverPointer = new THREE.Vector2();
const dragPlane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
const dragPoint = new THREE.Vector3();
const dragOffset = new THREE.Vector3();
const dragIntersection = new THREE.Vector3();
const particleAttractor = new THREE.Vector3();
let particleInteraction = 'repel';
let lastMouseX = 0;
let lastMouseY = 0;
let hoveredLetter = null;
let lastHoveredLetter = null;
let draggedLetter = null;
let audioContext = null;

window.addEventListener('keydown', (e) => {
  if (e.key === 'g') particleInteraction = 'attract';
  else if (e.key === 'r') particleInteraction = 'repel';
  else if (e.key === 'n') particleInteraction = 'none';
});

function ensureAudioContext() {
  if (!audioContext) {
    const AudioContextCtor = window.AudioContext || window.webkitAudioContext;
    audioContext = AudioContextCtor ? new AudioContextCtor() : null;
  }
  if (audioContext && audioContext.state === 'suspended') audioContext.resume();
  return audioContext;
}

function playPianoNote(letter, index = 0) {
  const context = ensureAudioContext();
  if (!context) return;
  const baseFrequencies = [261.63, 293.66, 329.63, 392.0, 440.0, 523.25, 587.33];
  const frequency = baseFrequencies[index % baseFrequencies.length];
  const now = context.currentTime;
  const output = context.createGain();
  output.gain.setValueAtTime(0.0001, now);
  output.gain.exponentialRampToValueAtTime(0.18, now + 0.01);
  output.gain.exponentialRampToValueAtTime(0.0001, now + 0.45);
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 2200;
  filter.Q.value = 0.7;
  const fundamental = context.createOscillator();
  fundamental.type = 'triangle';
  fundamental.frequency.setValueAtTime(frequency, now);
  const sparkle = context.createOscillator();
  sparkle.type = 'sine';
  sparkle.frequency.setValueAtTime(frequency * 2, now);
  const fundamentalGain = context.createGain();
  fundamentalGain.gain.value = 0.85;
  const sparkleGain = context.createGain();
  sparkleGain.gain.value = 0.18;
  fundamental.connect(fundamentalGain).connect(filter);
  sparkle.connect(sparkleGain).connect(filter);
  filter.connect(output).connect(context.destination);
  fundamental.start(now); sparkle.start(now);
  fundamental.stop(now + 0.5); sparkle.stop(now + 0.5);
}

window.addEventListener('mousemove', (e) => {
  mouse.tx = (e.clientX / innerWidth - 0.5) * 2;
  mouse.ty = -(e.clientY / innerHeight - 0.5) * 2;
  hoverPointer.x = (e.clientX / innerWidth) * 2 - 1;
  hoverPointer.y = -(e.clientY / innerHeight) * 2 + 1;
  hoverRaycaster.setFromCamera(hoverPointer, camera);
  
  const hits = hoverRaycaster.intersectObjects(letterMeshes, false);
  hoveredLetter = hits.length > 0 ? hits[0].object : null;
  if (hoveredLetter && hoveredLetter !== lastHoveredLetter) {
    playPianoNote(hoveredLetter, hoveredLetter.userData.index);
    lastHoveredLetter = hoveredLetter;
  } else if (!hoveredLetter) {
    lastHoveredLetter = null;
  }

  if (scrollT >= projectStart && projectGroup.visible) {
    const hitsProject = hoverRaycaster.intersectObjects(projectLetters, false);
    hoveredProject = hitsProject.length > 0 ? hitsProject[0].object : null;
    if (hoveredProject && hoveredProject !== lastHoveredProject) {
      lastHoveredProject = hoveredProject;
    } else if (!hoveredProject) {
      lastHoveredProject = null;
    }
  } else {
    hoveredProject = null;
    lastHoveredProject = null;
  }

  if (draggedLetter) {
    hoverRaycaster.ray.intersectPlane(dragPlane, dragIntersection);
    draggedLetter.position.copy(dragIntersection).add(dragOffset);
    document.body.style.cursor = 'grabbing';
  } else {
    document.body.style.cursor = (hoveredLetter || hoveredProject) ? 'pointer' : 'default';
  }
});

window.addEventListener('mousedown', (e) => {
  clickStartX = e.clientX;
  clickStartY = e.clientY;

  if (!hoveredLetter) return;
  draggedLetter = hoveredLetter;
  hoverRaycaster.ray.intersectPlane(dragPlane, dragPoint);
  dragOffset.copy(draggedLetter.position).sub(dragPoint);
  draggedLetter.userData.dragging = true;
  document.body.style.cursor = 'grabbing';
});

window.addEventListener('mouseup', (e) => {
  const diffX = Math.abs(e.clientX - clickStartX);
  const diffY = Math.abs(e.clientY - clickStartY);
  if (diffX < 5 && diffY < 5) {
    if (hoveredProject && hoveredProject.userData && hoveredProject.userData.url) {
      window.open(hoveredProject.userData.url, '_blank');
    }
  }

  if (!draggedLetter) return;
  draggedLetter.userData.dragging = false;
  draggedLetter.userData.velocity = new THREE.Vector3(
    (Math.random() - 0.5) * 0.25,
    (Math.random() - 0.5) * 0.25,
    (Math.random() - 0.5) * 0.08
  );
  draggedLetter = null;
  document.body.style.cursor = (hoveredLetter || hoveredProject) ? 'pointer' : 'default';
});

// ─── SCROLL LOGIC ────────────────────────────────────────────────────────────
const scrollContainer = document.getElementById('scroll-container');
let scrollT = 0;
let targetScrollT = 0;
let totalScrolled = 0;
let lastScrollTop = 0;

scrollContainer.addEventListener('scroll', () => {
  const st = scrollContainer.scrollTop;
  const maxScroll = scrollContainer.scrollHeight - innerHeight;
  const delta = st - lastScrollTop;
  lastScrollTop = st;
  totalScrolled += delta;
  const raw = totalScrolled / maxScroll;
  // Multiply by 1.8 so the full experience is reached with less scrolling
  targetScrollT = (((raw * 1.8) % 1) + 1) % 1;
  if (st >= maxScroll - 2) {
    scrollContainer.scrollTop = 1;
    lastScrollTop = 1;
  }
});

const scrollHint = document.getElementById('scroll-hint');
const soundHint = document.getElementById('sound-hint');
const interactHint = document.getElementById('interact-hint');
const projectInfo = document.getElementById('project-info');

// ─── PARTICLE Z TRACKING ──────────────────────────────────────────────────────
// We track the camera's Z separately so we can smoothly shift particle groups
let particleCameraZ = 0;

// ─── MAIN ANIMATION LOOP ─────────────────────────────────────────────────────
const clock = new THREE.Clock();

function animate() {
  requestAnimationFrame(animate);
  const t = clock.getElapsedTime();
  clock.getDelta(); // consume delta
  const arrowStart = 0.05;
  const arrowEnd = 0.25;
  const projectStart = arrowEnd;
  const globalMotionAmp = 12.0;
  const _projNDC = new THREE.Vector3();

  // Smooth scroll with wraparound shortest-path
  let scrollDelta = targetScrollT - scrollT;
  if (scrollDelta > 0.5) scrollDelta -= 1;
  if (scrollDelta < -0.5) scrollDelta += 1;
  scrollT = ((scrollT + scrollDelta * 0.06) % 1 + 1) % 1;

  const prevMouseX = mouse.x;
  const prevMouseY = mouse.y;
  mouse.x += (mouse.tx - mouse.x) * 0.22;
  mouse.y += (mouse.ty - mouse.y) * 0.22;
  const mouseMotionX = mouse.x - prevMouseX;
  const mouseMotionY = mouse.y - prevMouseY;
  lastMouseX = mouse.x;
  lastMouseY = mouse.y;

  const phase = scrollT;

  if (phase > 0.05) {
    scrollHint.style.opacity = '0';
    soundHint.style.opacity = '0';
    interactHint.style.opacity = '0';
  } else {
    scrollHint.style.opacity = '1';
    soundHint.style.opacity = '1';
    interactHint.style.opacity = '1';
  }

  const projectCounter = document.getElementById('project-counter');
  if (phase > projectStart) {
    projectInfo.classList.add('visible');
    if (projectCounter) projectCounter.classList.add('visible');
  } else {
    projectInfo.classList.remove('visible');
    if (projectCounter) projectCounter.classList.remove('visible');
  }

  // ── Floating letters ──────────────────────────────────────────────────────
  letterMeshes.forEach((mesh) => {
    const d = mesh.userData;
    const isHovered = hoveredLetter === mesh;
    const isDragged = draggedLetter === mesh;
    if (!d.dragging && !isDragged) {
      mesh.position.x = d.baseX;
      mesh.position.y = d.baseY;
      mesh.rotation.set(0, 0, 0);
      if (isHovered) {
        mesh.rotation.y += 0.03;
        mesh.rotation.x += 0.015;
        mesh.scale.lerp(new THREE.Vector3(1.12, 1.12, 1.12), 0.16);
        mesh.material.emissiveIntensity = 0.7;
      } else {
        mesh.material.emissiveIntensity = 0.45;
      }
      if (phase > 0.35) {
        const fadeOut = 1 - Math.min((phase - 0.35) / 0.25, 1);
        mesh.scale.setScalar(isHovered ? Math.max(fadeOut, 1.12) : fadeOut);
        if (!isHovered) mesh.material.opacity = 0.92 * fadeOut;
      } else {
        mesh.scale.setScalar(isHovered ? 1.12 : 1);
        mesh.material.opacity = 0.92;
      }
    }
  });

  letterTrails.forEach(({ source, trail }) => {
    trail.position.lerp(source.position, 0.18);
    trail.rotation.copy(source.rotation);
    trail.scale.copy(source.scale).multiplyScalar(1.05);
    const active = source === hoveredLetter || source === draggedLetter;
    trail.material.opacity = active ? 0.06 : Math.max(trail.material.opacity * 0.82, 0.01);
  });

  if (phase > 0.35) letterGroup.visible = phase < 0.65;
  else letterGroup.visible = true;

  // ── Camera animation ──────────────────────────────────────────────────────
  if (phase < projectStart) {
    if (phase <= 0.35) {
      const approachZ = 120 - phase * 80;
      const approachY = phase * 5;
      camState.targetPos.set(mouse.x * 3, mouse.y * 2 + approachY, Math.max(approachZ, 30));
      camState.targetLook.set(mouse.x * 0.5, mouse.y * 0.5, 0);
      bloom.strength = 0.85 + phase * 0.25;
      scene.fog.density = 0.0015;
    } else if (phase <= 0.65) {
      const zp = (phase - 0.35) / 0.3;
      const eased = zp < 0.5 ? 4 * zp * zp * zp : 1 - Math.pow(-2 * zp + 2, 3) / 2;
      const targetX = -25.5;
      camState.targetPos.set(
        THREE.MathUtils.lerp(mouse.x * 3, targetX, eased),
        THREE.MathUtils.lerp(mouse.y * 2 + 0.35 * 5, 0, eased),
        THREE.MathUtils.lerp(30, -1, eased)
      );
      camState.targetLook.set(THREE.MathUtils.lerp(mouse.x * 0.5, targetX, eased), 0, 0);
      bloom.strength = 1.05 + eased * 1.1;
      scene.fog.density = 0.0015 + eased * 0.008;
    } else {
      const wp = (phase - 0.65) / 0.35;
      const eased = 1 - Math.pow(1 - wp, 3);
      camState.targetPos.set(mouse.x * 4, mouse.y * 3 + eased * 5, THREE.MathUtils.lerp(-1, 25, eased));
      camState.targetLook.set(mouse.x * 0.3, mouse.y * 0.3, -20);
      bloom.strength = 1.15 - eased * 0.15;
      scene.fog.density = 0.01 - eased * 0.004;
    }
  }

  innerWorldGroup.visible = phase > 0.55 && phase < projectStart;

  camState.currentPos.lerp(camState.targetPos, 0.04);
  camState.currentLook.lerp(camState.targetLook, 0.04);
  camera.position.copy(camState.currentPos);
  camera.lookAt(camState.currentLook);

  const motionMag = Math.min(1, Math.sqrt(mouseMotionX * mouseMotionX + mouseMotionY * mouseMotionY) * globalMotionAmp * 4);
  const followAmp = 14.0;
  cameraFollow.x = THREE.MathUtils.lerp(cameraFollow.x, mouse.x * followAmp * motionMag, 0.14);
  cameraFollow.y = THREE.MathUtils.lerp(cameraFollow.y, mouse.y * followAmp * motionMag, 0.14);
  camera.position.x = camState.currentPos.x + cameraFollow.x;
  camera.position.y = camState.currentPos.y + cameraFollow.y;

  const pulseTarget = Math.min(4.0, 1.0 + motionMag * 4.0);
  bloom.strength = THREE.MathUtils.lerp(bloom.strength, pulseTarget, 0.14);
  bloom.radius = THREE.MathUtils.lerp(bloom.radius, 0.45 + motionMag * 0.6, 0.06);

  // ── Dust animation ────────────────────────────────────────────────────────
  const dPos = dustGeo.attributes.position.array;
  for (let i = 0; i < 2000; i++) {
    dPos[i * 3]     += dustVel[i * 3];
    dPos[i * 3 + 1] += dustVel[i * 3 + 1];
    dPos[i * 3 + 2] += dustVel[i * 3 + 2];
    if (Math.abs(dPos[i * 3])     > 100) dustVel[i * 3]     *= -1;
    if (Math.abs(dPos[i * 3 + 1]) > 50)  dustVel[i * 3 + 1] *= -1;
    if (Math.abs(dPos[i * 3 + 2]) > 100) dustVel[i * 3 + 2] *= -1;
  }
  dustGeo.attributes.position.needsUpdate = true;

  // ── Smoothly track camera Z for particle group offsetting ─────────────────
  // Target is the actual camera Z so stars stay centred around the viewer
  particleCameraZ = THREE.MathUtils.lerp(particleCameraZ, camera.position.z, 0.06);

  // Shift every particle group along Z to follow the camera
  reactiveParticleFields.forEach((fld) => {
    fld.points.position.z = particleCameraZ;
  });
  // Also shift the dust group so it stays around the camera
  dust.position.z = particleCameraZ;

  // ── Background particle reaction ─────────────────────────────────────────
  const mouseTiltX = mouse.y * 0.03;
  const mouseTiltY = mouse.x * 0.04;
  const mouseAttractor = new THREE.Vector3(mouse.x * 28, mouse.y * 16, 0);
  const letterAttractor = hoveredLetter || draggedLetter;
  const activeAttractor = letterAttractor ? letterAttractor.position : mouseAttractor;
  particleAttractor.lerp(activeAttractor, 0.24);
  const particleBoost = draggedLetter ? 1.6 : hoveredLetter ? 1.3 : 1.0;
  const mousePulse = 0.75 + Math.sin(t * 3.2) * 0.08;

  reactiveParticleFields.forEach(({ kind, positions, basePositions, points, strength, radius }) => {
    const count = positions.length / 3;
    const kindBoost = kind === 'stars' ? 2.8 : 0.6;

    // Attractor in the particle group's local space (group is shifted by particleCameraZ on Z)
    const localAttractorX = particleAttractor.x;
    const localAttractorY = particleAttractor.y;
    // attractor Z in local space — centre it at 0 within the group
    const localAttractorZ = particleAttractor.z - particleCameraZ;

    for (let i = 0; i < count; i++) {
      const idx = i * 3;
      const baseX = basePositions[idx];
      const baseY = basePositions[idx + 1];
      const baseZ = basePositions[idx + 2];

      const dx = baseX - localAttractorX * (kind === 'stars' ? 0.28 : 0.7);
      const dy = baseY - localAttractorY * (kind === 'stars' ? 0.28 : 0.7);
      const dz = baseZ - (kind === 'stars' ? 0 : localAttractorZ);
      const distance = Math.sqrt(dx * dx + dy * dy + dz * dz) + 0.0001;
      const influence = Math.max(0, 1 - distance / (kind === 'stars' ? radius * 1.8 : radius * 1.2));
      const swirl = influence * influence * particleBoost * mousePulse * strength * kindBoost;

      const normX = dx / distance;
      const normY = dy / distance;
      const normZ = dz / distance;
      const orbitX = -normY;
      const orbitY = normX;

      const jitter = (kind === 'stars' ? 0.28 : 0.12) * globalMotionAmp * 1.6;
      const flowX = mouseMotionX * (kind === 'stars' ? 160 : 50) * globalMotionAmp * 2.0;
      const flowY = mouseMotionY * (kind === 'stars' ? 120 : 36) * globalMotionAmp * 2.0;
      let targetX = baseX + flowX * influence + orbitX * influence * 12 * globalMotionAmp * 1.6 + Math.sin(t * 2.0 + i * 0.03) * influence * jitter;
      let targetY = baseY + flowY * influence + orbitY * influence * 10 * globalMotionAmp * 1.6 + Math.cos(t * 1.8 + i * 0.025) * influence * jitter;
      let targetZ = baseZ + normZ * swirl * 10 * globalMotionAmp * 1.6 + Math.sin(t * 1.4 + i * 0.02) * influence * jitter * 0.7;

      const wildBurst = (Math.random() - 0.5) * 80 * globalMotionAmp * influence;
      targetX += wildBurst * (kind === 'stars' ? 1.4 : 0.9);
      targetY += (Math.random() - 0.5) * 60 * globalMotionAmp * influence * (kind === 'stars' ? 1.4 : 0.9);
      targetZ += (Math.random() - 0.5) * 36 * globalMotionAmp * influence;
      targetX += mouseMotionX * 600 * globalMotionAmp * influence;
      targetY += mouseMotionY * 480 * globalMotionAmp * influence;

      const curX = positions[idx];
      const curY = positions[idx + 1];
      const curZ = positions[idx + 2];

      // Distance to attractor in local space
      const ldX = curX - localAttractorX;
      const ldY = curY - localAttractorY;
      const ldZ = curZ - localAttractorZ;
      const localDist = Math.sqrt(ldX * ldX + ldY * ldY + ldZ * ldZ) + 0.0001;
      let localInfluence = Math.max(0, 1 - localDist / (radius * (kind === 'stars' ? 1.0 : 0.6)));

      // Screen-space influence — project local pos + group offset to get world pos
      _projNDC.set(curX, curY, curZ + particleCameraZ).project(camera);
      const ndcDx = _projNDC.x - hoverPointer.x;
      const ndcDy = _projNDC.y - hoverPointer.y;
      const ndcDist = Math.sqrt(ndcDx * ndcDx + ndcDy * ndcDy);
      const ndcRadius = kind === 'stars' ? 0.07 : 0.12;
      const ndcInfluence = Math.max(0, 1 - ndcDist / ndcRadius);
      localInfluence = Math.max(localInfluence, ndcInfluence);

      if (localInfluence > 0.01) {
        const mm = Math.min(1.0, Math.sqrt(mouseMotionX * mouseMotionX + mouseMotionY * mouseMotionY) * 8);
        const bendFactor = (0.6 + mm) * 1.6 * localInfluence;
        targetX += orbitX * swirl * bendFactor * (kind === 'stars' ? 1.1 : 0.6);
        targetY += orbitY * swirl * bendFactor * (kind === 'stars' ? 1.1 : 0.6);
        targetZ += (orbitX + orbitY) * 0.02 * swirl * bendFactor;
      }

      if (particleInteraction === 'repel') {
        let dirX = curX - localAttractorX;
        let dirY = curY - localAttractorY;
        let dirZ = curZ - localAttractorZ;
        dirX /= localDist; dirY /= localDist; dirZ /= localDist;
        const fall = Math.pow(Math.max(0, 1 - localDist / (radius * (kind === 'stars' ? 1.2 : 1.0))), 2.2);
        const baseForce = kind === 'stars' ? 1200 : 420;
        const force = baseForce * fall * particleBoost;
        if (localInfluence > 0.01) {
          targetX += dirX * force;
          targetY += dirY * force;
          targetZ += dirZ * (force * 0.45);
        }
        positions[idx]     = THREE.MathUtils.lerp(positions[idx],     targetX, 0.99);
        positions[idx + 1] = THREE.MathUtils.lerp(positions[idx + 1], targetY, 0.99);
        positions[idx + 2] = THREE.MathUtils.lerp(positions[idx + 2], targetZ, 0.99);
      } else if (particleInteraction === 'attract') {
        const interactionBase = kind === 'stars' ? 48 : 22;
        const pull = -interactionBase * influence * particleBoost * 0.9;
        targetX += normX * pull;
        targetY += normY * pull;
        targetZ += normZ * pull * 0.45;
        positions[idx]     = THREE.MathUtils.lerp(positions[idx],     targetX, 0.98);
        positions[idx + 1] = THREE.MathUtils.lerp(positions[idx + 1], targetY, 0.98);
        positions[idx + 2] = THREE.MathUtils.lerp(positions[idx + 2], targetZ, 0.98);
      } else {
        positions[idx]     = THREE.MathUtils.lerp(positions[idx],     targetX, 0.98);
        positions[idx + 1] = THREE.MathUtils.lerp(positions[idx + 1], targetY, 0.98);
        positions[idx + 2] = THREE.MathUtils.lerp(positions[idx + 2], targetZ, 0.98);
      }
    }

    points.rotation.x = THREE.MathUtils.lerp(points.rotation.x, mouseTiltX, 0.28);
    points.rotation.y = THREE.MathUtils.lerp(points.rotation.y, mouseTiltY, 0.28);
    points.geometry.attributes.position.needsUpdate = true;

    // Keep opacity full at all times
    if (points.material.opacity !== undefined) {
      points.material.opacity = THREE.MathUtils.lerp(points.material.opacity, 0.95, 0.04);
    }
  });

  // ── Arrow formation ───────────────────────────────────────────────────────
  let arrowProgress = 0;
  if (scrollT >= arrowStart && scrollT <= arrowEnd) {
    const p = (scrollT - arrowStart) / (arrowEnd - arrowStart);
    arrowProgress = 1 - Math.pow(1 - p, 3);
  } else if (scrollT > arrowEnd) arrowProgress = 1;

  function seededRandom(n) {
    const x = Math.sin(n * 12.9898) * 43758.5453;
    return x - Math.floor(x);
  }

  function arrowTargetForIndex(i, count) {
    const s = i / Math.max(1, count - 1);
    const height = 70;
    const maxW = 36;
    const shaftW = 6;
    const y = (s - 0.5) * height;
    const headFrac = 0.42;
    let w = shaftW;
    if (s < headFrac) {
      const tt = s / headFrac;
      w = shaftW + (1 - tt) * (maxW - shaftW);
    }
    const r = seededRandom(i * 1.2345);
    const x = (r - 0.5) * w * 0.95;
    const z = (seededRandom(i * 3.21) - 0.5) * 6;
    return [x, y - 8, z];
  }

  if (arrowProgress > 0.01) {
    const fields = reactiveParticleFields.slice().sort((a, b) => a.radius - b.radius);
    for (let f = 0; f < Math.min(2, fields.length); f++) {
      const fld = fields[f];
      const pos = fld.positions;
      const ct = pos.length / 3;
      for (let i = 0; i < ct; i++) {
        const j = i * 3;
        const [tx, ty, tz] = arrowTargetForIndex(i, ct);
        pos[j]     = THREE.MathUtils.lerp(pos[j],     tx, 0.02 + arrowProgress * 0.28);
        pos[j + 1] = THREE.MathUtils.lerp(pos[j + 1], ty, 0.02 + arrowProgress * 0.28);
        pos[j + 2] = THREE.MathUtils.lerp(pos[j + 2], tz, 0.02 + arrowProgress * 0.28);
      }
      fld.points.geometry.attributes.position.needsUpdate = true;
    }
  }

  // ── Project journey ───────────────────────────────────────────────────────
  if (scrollT >= projectStart) {
    const slideFrac = (scrollT - projectStart) / Math.max(1e-6, (1 - projectStart));
    const pathPos = slideFrac * (projectCount - 1);
    const slideIndex = Math.floor(pathPos);
    const slideLocal = pathPos - slideIndex;

    const activeIndex = Math.round(pathPos);
    if (activeIndex !== lastActiveIndex) {
      lastActiveIndex = activeIndex;
      const activeProject = projects[activeIndex];
      if (activeProject) {
        const projectCounter = document.getElementById('project-counter');
        if (projectCounter) {
          projectCounter.textContent = `${String(activeIndex + 1).padStart(2, '0')} / ${String(projectCount).padStart(2, '0')}`;
        }

        // ── New GitHub-style UI updates ─────────────────────────────────────
        const labelEl   = document.getElementById('project-label');
        const titleEl   = document.getElementById('project-title');
        const descEl    = document.getElementById('project-desc');
        const starsEl   = document.getElementById('stars-count');
        const forksEl   = document.getElementById('forks-count');
        const langDot   = document.getElementById('lang-dot');
        const langName  = document.getElementById('lang-name');
        const yearEl    = document.getElementById('year-text');
        const chipsEl   = document.getElementById('tech-chips');
        const ghBtn     = document.getElementById('gh-repo-btn');
        const cloneBtn  = document.getElementById('gh-clone-btn');
        const topbarRepo = document.getElementById('topbar-repo');

        const repoSlug = activeProject.title.toLowerCase().replace(/\s+/g, '-');
        const repoUrl  = activeProject.url || `https://github.com/Aryamanironman/${repoSlug}`;
        const cloneUrl = repoUrl;

        if (labelEl)    labelEl.textContent = `Aryamanironman / ${repoSlug}`;
        if (titleEl)    titleEl.textContent = activeProject.title;
        if (descEl)     descEl.textContent  = activeProject.desc;
        if (starsEl)    starsEl.textContent = activeProject.stars || 0;
        if (forksEl)    forksEl.textContent = activeProject.forks || 0;
        if (yearEl)     yearEl.textContent  = activeProject.year || 2024;
        if (topbarRepo) topbarRepo.textContent = repoSlug;

        // Language dot color
        const langColors = {
          python: '#3572A5', javascript: '#f1e05a', typescript: '#3178c6',
          react: '#61dafb', solidity: '#aa6746', 'c++': '#f34b7d',
          html: '#e34c26', css: '#563d7c', swift: '#f05138',
          rust: '#dea584', web: '#58a6ff', kotlin: '#A97BFF',
          java: '#b07219'
        };
        const primaryLang = activeProject.tech.split(' · ')[0];
        const dotColor = langColors[primaryLang.toLowerCase()] || '#8b949e';
        if (langDot)  { langDot.style.background = dotColor; }
        if (langName) { langName.textContent = primaryLang; }

        // Tech chips
        if (chipsEl) {
          chipsEl.innerHTML = '';
          activeProject.tech.split(' · ').forEach(t => {
            const chip = document.createElement('span');
            chip.className = 'tech-chip';
            chip.textContent = t;
            chipsEl.appendChild(chip);
          });
        }

        // Buttons
        if (ghBtn)    { ghBtn.href    = repoUrl;  }
        if (cloneBtn) { cloneBtn.href = cloneUrl + '/archive/refs/heads/main.zip'; }
      }
    }

    projectGroup.visible = true;

    projectLetters.forEach((mesh, i) => {
      const d = mesh.userData;
      mesh.position.y = d.baseY + Math.sin(t * d.floatSpeed + d.floatOffset) * 1.8;
      mesh.rotation.y = d.baseRY + Math.sin(t * 0.18 + d.floatOffset) * 0.06;
      mesh.rotation.x = d.baseRX + Math.cos(t * 0.14 + d.floatOffset) * 0.03;

      const distFromCamera = Math.abs(i - pathPos);
      let targetOpacity = 0;
      if (distFromCamera < 1.8) targetOpacity = Math.max(0, 1 - distFromCamera * 0.7);
      if (i === Math.round(pathPos)) targetOpacity = Math.max(targetOpacity, 0.95);

      const isHovered = hoveredProject === mesh;
      if (isHovered) {
        targetOpacity = 1.0;
      }
      mesh.material.opacity = THREE.MathUtils.lerp(mesh.material.opacity || 0, targetOpacity, 0.08);
      mesh.visible = true;

      // Fade border in/out with the card
      const border = mesh.children.find(c => c.userData.isBorder);
      if (border) {
        const borderOpacity = isHovered ? 1.0 : targetOpacity * 0.9;
        border.material.opacity = THREE.MathUtils.lerp(border.material.opacity || 0, borderOpacity, 0.08);
      }

      const isCurrent = i === Math.round(pathPos);
      let targetScale = isCurrent ? 1.0 + Math.sin(t * 1.2 + d.floatOffset) * 0.04 : 0.88;
      if (isHovered) {
        targetScale *= 1.08;
      }
      mesh.scale.setScalar(THREE.MathUtils.lerp(mesh.scale.x, targetScale, 0.06));
    });

    const curIdx = Math.min(slideIndex, projectCount - 1);
    const nxtIdx = Math.min(curIdx + 1, projectCount - 1);
    const curMesh = projectLetters[curIdx];
    const nxtMesh = projectLetters[nxtIdx];

    const easeLocal = slideLocal < 0.5
      ? 4 * slideLocal * slideLocal * slideLocal
      : 1 - Math.pow(-2 * slideLocal + 2, 3) / 2;

    const camX = THREE.MathUtils.lerp(curMesh.userData.baseX, nxtMesh.userData.baseX, easeLocal) + mouse.x * 2.5;
    const camY = THREE.MathUtils.lerp(curMesh.userData.baseY, nxtMesh.userData.baseY, easeLocal) + mouse.y * 1.8;
    const camZ = THREE.MathUtils.lerp(curMesh.userData.baseZ + 55, nxtMesh.userData.baseZ + 55, easeLocal);

    const lookIdx = Math.min(curIdx + 1, projectCount - 1);
    const lookMesh = projectLetters[lookIdx];
    const lookX = THREE.MathUtils.lerp(curMesh.userData.baseX, lookMesh.userData.baseX, 0.55) + mouse.x * 0.4;
    const lookY = THREE.MathUtils.lerp(curMesh.userData.baseY, lookMesh.userData.baseY, 0.55) + mouse.y * 0.3;
    const lookZ = lookMesh.userData.baseZ;

    camState.targetPos.set(camX, camY, camZ);
    camState.targetLook.set(lookX, lookY, lookZ);
    bloom.strength = 1.1 + Math.sin(t * 0.6) * 0.15;
    bloom.threshold = 0.55;
    scene.fog.density = 0.0035 + slideFrac * 0.002;

  } else {
    lastActiveIndex = -1;
    bloom.threshold = 0.08;
    projectGroup.visible = false;
  }

  // ── Inner world animations ────────────────────────────────────────────────
  if (innerWorldGroup.visible) {
    const core = innerWorldGroup.getObjectByName('aiCore');
    if (core) {
      core.rotation.x = t * 0.6;
      core.rotation.y = t * 1.0;
      core.rotation.z = t * 0.4;
      core.material.emissiveIntensity = 2 + Math.sin(t * 3) * 0.8;
    }
    for (let r = 0; r < 3; r++) {
      const ring = innerWorldGroup.getObjectByName(`ring_${r}`);
      if (ring) ring.rotation.z = t * (0.5 + r * 0.25);
    }
    for (let o = 0; o < 25; o++) {
      const orb = innerWorldGroup.getObjectByName(`orb_${o}`);
      if (orb) orb.position.y += Math.sin(t * orb.userData.floatSpeed + orb.userData.floatOffset) * 0.03;
    }
    for (let b = 0; b < 3; b++) {
      const beam = innerWorldGroup.getObjectByName(`beam_${b}`);
      if (beam) {
        const bArr = beam.geometry.attributes.position.array;
        for (let j = 0; j < 300; j++) {
          bArr[j * 3 + 1] -= 0.18;
          if (bArr[j * 3 + 1] < -15) bArr[j * 3 + 1] = 15;
        }
        beam.geometry.attributes.position.needsUpdate = true;
      }
    }
    const grid = innerWorldGroup.getObjectByName('grid');
    if (grid) grid.material.opacity = 0.08 + Math.sin(t * 0.9) * 0.06;
  }

  // ── Starfield slow rotation ───────────────────────────────────────────────
  scene.traverse((obj) => {
    if (obj instanceof THREE.Points && obj.name !== 'dust') {
      obj.rotation.y = t * 0.01;
    }
  });

  // ── Dynamic lights ────────────────────────────────────────────────────────
  rimL.intensity = 3 + Math.sin(t * 0.7) * 0.5;
  rimR.intensity = 3 + Math.cos(t * 0.9) * 0.5;
  frontL.position.x = Math.sin(t * 0.4) * 10;
  frontL.position.y = Math.cos(t * 0.3) * 5;

  composer.render();
}

animate();

// ─── RESIZE ──────────────────────────────────────────────────────────────────
window.addEventListener('resize', () => {
  camera.aspect = innerWidth / innerHeight;
  camera.updateProjectionMatrix();
  renderer.setSize(innerWidth, innerHeight);
  composer.setSize(innerWidth, innerHeight);
  bloom.resolution.set(innerWidth, innerHeight);
});