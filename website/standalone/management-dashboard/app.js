import * as THREE from 'three';
import { OrbitControls } from './node_modules/three/examples/jsm/controls/OrbitControls.js';
import { RoundedBoxGeometry } from './node_modules/three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { RoomEnvironment } from './node_modules/three/examples/jsm/environments/RoomEnvironment.js';

export function initStudio() {
const container = document.querySelector('#studioCanvas');
let visible = true;
let pendingFrame = 0;

const scene = new THREE.Scene();
scene.background = new THREE.Color(0xe8e8e2);

const camera = new THREE.PerspectiveCamera(32, 1, 0.1, 100);
camera.position.set(20, 19.5, 23);
camera.lookAt(6.4, 0, 5);

const renderer = new THREE.WebGLRenderer({ antialias: true, preserveDrawingBuffer: true, powerPreference: 'low-power' });
renderer.setPixelRatio(Math.min(devicePixelRatio, 1.5));
renderer.setSize(container.clientWidth, container.clientHeight);
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = THREE.PCFSoftShadowMap;
renderer.outputColorSpace = THREE.SRGBColorSpace;
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.05;
container.replaceChildren(renderer.domElement);

const pmrem = new THREE.PMREMGenerator(renderer);
scene.environment = pmrem.fromScene(new RoomEnvironment(), .035).texture;
pmrem.dispose();

const controls = new OrbitControls(camera, renderer.domElement);
controls.target.set(6.4, .25, 5);
controls.enableDamping = false;
controls.dampingFactor = .055;
controls.enablePan = false;
controls.minDistance = 14;
controls.maxDistance = 38;
controls.maxPolarAngle = Math.PI * .46;
controls.minPolarAngle = Math.PI * .25;
controls.autoRotate = false;
controls.saveState();

const world = new THREE.Group();
world.position.set(-.4, 0, 0);
scene.add(world);

function canvasTexture(draw, repeatX = 1, repeatY = 1) {
  const image = document.createElement('canvas');
  image.width = image.height = 256;
  const context = image.getContext('2d');
  draw(context, image.width, image.height);
  const texture = new THREE.CanvasTexture(image);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.wrapS = texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.anisotropy = renderer.capabilities.getMaxAnisotropy();
  return texture;
}

const slatTexture = canvasTexture((c,w,h) => {
  c.fillStyle = '#c6a56f'; c.fillRect(0,0,w,h);
  for (let x = 0; x < w; x += 10) {
    c.fillStyle = '#2f2922'; c.fillRect(x,0,2,h);
    c.fillStyle = 'rgba(255,255,255,.10)'; c.fillRect(x+2,0,1,h);
  }
}, 2.5, 1);
const tileTexture = canvasTexture((c,w,h) => {
  c.fillStyle = '#aeb5b8'; c.fillRect(0,0,w,h);
  c.strokeStyle = '#858d91'; c.lineWidth = 2;
  for (let i=0;i<=w;i+=64) { c.beginPath();c.moveTo(i,0);c.lineTo(i,h);c.stroke();c.beginPath();c.moveTo(0,i);c.lineTo(w,i);c.stroke(); }
}, 3, 2);
const carpetTexture = canvasTexture((c,w,h) => {
  c.fillStyle = '#4a86b2'; c.fillRect(0,0,w,h);
  for (let y=0;y<h;y+=3) for(let x=0;x<w;x+=3) {
    const v = (x*13+y*7)%21; c.fillStyle = `rgba(8,45,76,${.035+v/800})`; c.fillRect(x,y,2,2);
  }
}, 3, 2);

const MAT = {
  shell: new THREE.MeshStandardMaterial({ color: 0x162636, roughness: .68, metalness: .18 }),
  shellTop: new THREE.MeshStandardMaterial({ color: 0x263b4c, roughness: .56, metalness: .26 }),
  wall: new THREE.MeshStandardMaterial({ color: 0xd6cec0, roughness: .88 }),
  meetingBlue: new THREE.MeshStandardMaterial({ color: 0x28385b, roughness: .9 }),
  meetingRed: new THREE.MeshStandardMaterial({ color: 0xa22f31, roughness: .9 }),
  meetingChair: new THREE.MeshStandardMaterial({ color: 0x246579, roughness: .9 }),
  slats: new THREE.MeshStandardMaterial({ map: slatTexture, bumpMap: slatTexture, bumpScale: .07, color: 0xffffff, roughness: .74 }),
  tile: new THREE.MeshStandardMaterial({ map: tileTexture, color: 0xffffff, roughness: .82, emissive: 0x8b969b, emissiveIntensity: .025 }),
  carpet: new THREE.MeshStandardMaterial({ map: carpetTexture, color: 0xffffff, roughness: .96, emissive: 0x174366, emissiveIntensity: .025 }),
  studioFloor: new THREE.MeshStandardMaterial({ color: 0x6d7375, roughness: .9, emissive: 0x303435, emissiveIntensity: .012 }),
  white: new THREE.MeshStandardMaterial({ color: 0xe8edf0, roughness: .48 }),
  wood: new THREE.MeshStandardMaterial({ color: 0xcda257, roughness: .7 }),
  blue: new THREE.MeshStandardMaterial({ color: 0x0066b3, roughness: .42, metalness: .12 }),
  royal: new THREE.MeshStandardMaterial({ color: 0x004c97, roughness: .36, metalness: .2 }),
  dark: new THREE.MeshStandardMaterial({ color: 0x101b25, roughness: .66 }),
  black: new THREE.MeshStandardMaterial({ color: 0x070b0f, roughness: .38, metalness: .45 }),
  red: new THREE.MeshStandardMaterial({ color: 0xd92c40, emissive: 0x7a0712, emissiveIntensity: .35, roughness: .4 }),
  screen: new THREE.MeshStandardMaterial({ color: 0x063354, emissive: 0x00a7e8, emissiveIntensity: 1.8, roughness: .22 }),
  glass: new THREE.MeshPhysicalMaterial({ color: 0x8bdfff, transparent: true, opacity: .18, roughness: .05, transmission: .28, side: THREE.DoubleSide })
};

function meshBox(w, h, d, material, x, y, z, cast = true) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = cast;
  mesh.receiveShadow = true;
  world.add(mesh);
  return mesh;
}

function roundedBox(w, h, d, radius, material, x, y, z) {
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w,h,d,5,radius), material);
  mesh.position.set(x,y,z); mesh.castShadow = true; mesh.receiveShadow = true; world.add(mesh);
  return mesh;
}

function cylinder(r, h, material, x, y, z, segments = 24) {
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, segments), material);
  mesh.position.set(x, y, z);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  world.add(mesh);
  return mesh;
}

function beam(a, b, radius = .035, material = MAT.black) {
  const start = new THREE.Vector3(...a);
  const end = new THREE.Vector3(...b);
  const mid = start.clone().add(end).multiplyScalar(.5);
  const length = start.distanceTo(end);
  const mesh = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, length, 10), material);
  mesh.position.copy(mid);
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), end.clone().sub(start).normalize());
  mesh.castShadow = true;
  world.add(mesh);
  return mesh;
}

const floors = {};
const floorBase = new Map();
const activeFloorTint = new THREE.Color(0xd98f95);
const activeFloorEmissive = new THREE.Color(0x77262b);
let activeFloors = new Set();
let selectedFloor = null;
function updateFloorAppearance() {
  Object.entries(floors).forEach(([name, item]) => {
    const base = floorBase.get(name);
    if (!base) return;
    item.material.color.copy(base.color);
    item.material.emissive.copy(base.emissive);
    if (activeFloors.has(name)) {
      item.material.color.lerp(activeFloorTint, .16);
      item.material.emissive.lerp(activeFloorEmissive, .35);
      item.material.emissiveIntensity = Math.max(base.emissiveIntensity, .19);
    } else {
      item.material.emissiveIntensity = name === selectedFloor ? .16 : base.emissiveIntensity;
    }
  });
  draw();
}
function floor(name, x, z, w, d, material) {
  const mat = material.clone();
  const item = meshBox(w, .16, d, mat, x + w / 2, .02, z + d / 2, false);
  floors[name] = item;
  floorBase.set(name, {color: mat.color.clone(), emissive: mat.emissive.clone(), emissiveIntensity: mat.emissiveIntensity});
}

floor('main', 0, 0, 7, 6, MAT.studioFloor);
floor('recording', 7, 0, 6, 3, MAT.carpet);
floor('production', 9, 3, 4, 3, MAT.carpet);
floor('corridor', 7, 3, 2, 3, MAT.tile);
floor('welcome', 0, 6, 13, 4, MAT.tile);

meshBox(13.6, .22, 10.6, MAT.shell, 6.5, -.13, 5, false);
const wall = (x, z, w, d, h = 1.7, material = MAT.wall) => meshBox(w, h, d, material, x, h / 2, z);
wall(6.5, -.05, 13.4, .18, 1.9);
wall(-.05, 3, .18, 6.2, 1.9);
wall(-.05, 8, .18, 4, 1.9, MAT.meetingBlue);
wall(13.05, 3, .18, 6.2, 1.9);
wall(13.05, 8, .18, 4, 1.9, MAT.meetingRed);
wall(6.5, 10.05, 13.4, .18, .42);
// Door openings and the observation window connect the studio to the corridor.
wall(7, 1.05, .16, 2.1, 1.5);
wall(7, 4.5, .16, 3, .55);
meshBox(.04,.85,2.1,MAT.glass,7,1.05,4.5,false);
wall(10, 3, 6, .16, 1.5);
wall(9, 4.5, .16, 3, 1.5);
wall(3.5, 6, 7, .16, 1.34, MAT.meetingBlue);
wall(11, 6, 4, .16, 1.34, MAT.meetingBlue);

const cap = (x, z, w, d) => meshBox(w, .09, d, MAT.shellTop, x, 1.72, z);
cap(6.5,-.05,13.5,.28); cap(-.05,5,.28,10.3); cap(13.05,5,.28,10.3);
cap(7,1.05,.24,2.1); cap(10,3,6,.24); cap(9,4.5,.24,3); cap(3.5,6,7,.24);cap(11,6,4,.24);

// Slatted acoustic lining is visible in the supplied 31 August walkthrough.
meshBox(6.65,1.45,.045,MAT.slats,3.45,.78,.08,false);
meshBox(.045,1.45,5.65,MAT.slats,.08,.78,3,false);
meshBox(.045,1.45,1.8,MAT.slats,6.92,.78,1,false);
meshBox(5.7,1.42,.045,MAT.slats,10,.77,.08,false);
meshBox(.045,1.42,2.65,MAT.slats,12.92,.77,1.45,false);

// The meeting-area whiteboard sits against the red wall in the video.
meshBox(.045,1.05,2.1,MAT.black,12.91,.9,8);
meshBox(.025,.95,1.95,MAT.white,12.88,.9,8,false);


// White broadcast desk, mixer and microphone arms are visible in the video.
roundedBox(4.95,.18,2.05,.11,MAT.white,3.55,.57,2.9);
meshBox(3.0,.07,.52,new THREE.MeshStandardMaterial({color:0x697278,roughness:.48,metalness:.22}),3.55,.70,3.52);
meshBox(.42,.52,.42,MAT.dark,2.0,.27,2.85); meshBox(.42,.52,.42,MAT.dark,4.75,.27,2.85);
const chair = (x,z,rot=0,mat=MAT.dark) => {
  const seat = cylinder(.31,.18,mat,x,.43,z);
  const back = meshBox(.54,.62,.14,mat,x,.78,z+.27);
  back.rotation.y = rot;
  cylinder(.055,.4,MAT.black,x,.2,z);
  return seat;
};
chair(2,1.65); chair(3.35,1.55); chair(4.7,1.65); chair(2,4.2,Math.PI); chair(3.5,4.3,Math.PI); chair(5,4.15,Math.PI);
[[2.3,2.4,2.0,1.78],[3.6,2.4,3.35,1.7],[4.8,2.48,4.7,1.8],[2.45,3.35,2.05,4.0],[4.7,3.35,5.0,3.95]].forEach(([x1,z1,x2,z2]) => {
  beam([x1,.64,z1],[x2,1.18,z2],.035);
  const mic = cylinder(.09,.22,MAT.black,x2,1.15,z2); mic.rotation.z = Math.PI / 2;
});
for (let x=2.45;x<4.8;x+=.39) {
  meshBox(.14,.025,.12, x > 4.25 ? MAT.red : MAT.screen, x,.75,3.5,false);
  meshBox(.03,.03,.28,MAT.black,x+.15,.75,3.48,false);
}
meshBox(2.2,.6,.48,MAT.shell,1.2,.42,.55);
meshBox(.7,.44,.08,MAT.screen,.65,.87,.78); meshBox(.7,.44,.08,MAT.screen,1.42,.87,.78);

meshBox(3.8,.18,.72,MAT.wood,9.5,.62,.65);
meshBox(.42,.62,.42,MAT.dark,8.1,.31,.65); meshBox(.42,.62,.42,MAT.dark,10.9,.31,.65);
meshBox(.82,.52,.08,MAT.screen,8.65,1.06,.62); meshBox(.82,.52,.08,MAT.screen,9.6,1.06,.62);
chair(9.15,1.75,Math.PI);
meshBox(.95,.09,.35,MAT.black,10.65,.77,.95);
for(let x=10.28;x<11.05;x+=.16) cylinder(.035,.035,x>10.8?MAT.red:MAT.screen,x,.84,.95,10);
beam([10.8,.75,1.05],[10.05,1.25,1.8],.035);
const recMic = cylinder(.1,.25,MAT.black,10.05,1.23,1.8); recMic.rotation.z=Math.PI/2;
meshBox(2.2,.5,.72,MAT.blue,11.6,.36,2.35); meshBox(2.2,.65,.22,MAT.royal,11.6,.74,2.65);

// This adjoining area is not sufficiently visible to invent equipment for it.

meshBox(5.9,.18,1.18,MAT.wood,6.4,.55,7.78);
meshBox(.48,.54,.48,MAT.shell,4.15,.27,7.78); meshBox(.48,.54,.48,MAT.shell,8.65,.27,7.78);
chair(4.2,6.85,0,MAT.meetingChair); chair(5.7,6.8,0,MAT.meetingChair); chair(7.2,6.8,0,MAT.meetingChair); chair(8.7,6.85,0,MAT.meetingChair);
chair(4.2,8.72,Math.PI,MAT.meetingChair); chair(5.7,8.78,Math.PI,MAT.meetingChair); chair(7.2,8.78,Math.PI,MAT.meetingChair); chair(8.7,8.72,Math.PI,MAT.meetingChair);
meshBox(1.8,.43,.72,MAT.blue,1.45,.32,8.75); meshBox(1.8,.66,.22,MAT.royal,1.45,.67,9.02);
meshBox(1.3,.7,.5,MAT.wood,11.6,.42,8.9);

// No simulated on-air beacon: the ERP feed does not provide broadcast status.

scene.add(new THREE.HemisphereLight(0xcfe8f5, 0x15202a, 1.2));
const key = new THREE.DirectionalLight(0xfff1d7, 2.55);
key.position.set(-4, 14, 9); key.castShadow = true; key.shadow.mapSize.set(1024,1024);
key.shadow.camera.left = -16; key.shadow.camera.right = 16; key.shadow.camera.top = 16; key.shadow.camera.bottom = -16;
scene.add(key);
[[3.4,3],[9.6,1.5],[11,4.7],[6.5,8]].forEach(([x,z],i) => {
  const light = new THREE.PointLight(i === 0 ? 0xffc96e : 0xffe0a5, i === 0 ? 4.2 : 2.7, 6, 2);
  light.position.set(x, 2.35, z); light.castShadow = false; world.add(light);
});

const stage = new THREE.Mesh(new THREE.PlaneGeometry(200,200), new THREE.MeshStandardMaterial({ color: 0xe8e8e2, roughness: 1 }));
stage.rotation.x = -Math.PI/2; stage.position.set(6.5,-.3,5); stage.receiveShadow = true; scene.add(stage);

function selectRoom(name) {
  const target = { main: new THREE.Vector3(3.5,.25,3), recording: new THREE.Vector3(10,.25,1.5), welcome: new THREE.Vector3(6.5,.25,8) }[name];
  if (!target) return;
  selectedFloor = name;
  controls.target.copy(target);
  camera.position.copy(target).add(new THREE.Vector3(11,15,16));
  updateFloorAppearance();
  controls.update();draw();
}

function resize() {
  const w = container.clientWidth, h = container.clientHeight;
  if (!w || !h) return;
  camera.fov = w / h < 1.1 ? 42 : 32;
  camera.aspect = w / h;
  camera.updateProjectionMatrix(); renderer.setSize(w,h);draw();
}
function draw() {
  if (!visible || document.hidden || pendingFrame) return;
  pendingFrame=requestAnimationFrame(()=>{pendingFrame=0;if(visible&&!document.hidden)renderer.render(scene,camera);});
}
controls.addEventListener('change',draw);
new ResizeObserver(resize).observe(container);
resize();controls.update();draw();
return {
  selectRoom,
  setActiveRooms(names) {
    activeFloors = new Set(Array.isArray(names) ? names.filter(name => floorBase.has(name)) : []);
    updateFloorAppearance();
  },
  setTheme(dark) {const color=dark ? 0x303a34 : 0xe8e8e2;scene.background.setHex(color);stage.material.color.setHex(color);draw();},
  setVisible(value) {visible=value;controls.enabled=value;if(value){resize();draw();}},
  moveCamera(action) {
    if(action==='reset') {controls.reset();draw();return;}
    const offset=camera.position.clone().sub(controls.target);
    const spherical=new THREE.Spherical().setFromVector3(offset);
    if(action==='left')spherical.theta-=Math.PI/12;
    if(action==='right')spherical.theta+=Math.PI/12;
    if(action==='in')spherical.radius=Math.max(controls.minDistance,spherical.radius*.86);
    if(action==='out')spherical.radius=Math.min(controls.maxDistance,spherical.radius*1.16);
    camera.position.copy(controls.target).add(new THREE.Vector3().setFromSpherical(spherical));
    controls.update();draw();
  }
};
}
