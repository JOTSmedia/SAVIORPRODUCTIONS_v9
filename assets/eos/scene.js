import * as THREE from 'three';
import { OrbitControls } from './vendor/OrbitControls.js';
import { RoomEnvironment } from './vendor/RoomEnvironment.js';
import { createCameraModel } from './camera-model.js?v=9.11';

export function createStudioScene(host, { onShutter = () => {}, onInteraction = () => {}, onPoseChange = () => {}, onFlash = () => {}, onSequenceComplete = () => {} } = {}) {
  const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.setClearColor(0x000000, 0);
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.25;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  renderer.localClippingEnabled = true;
  renderer.domElement.setAttribute('aria-hidden', 'true');
  host.append(renderer.domElement);

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(33, 1, 0.1, 100);
  const pmrem = new THREE.PMREMGenerator(renderer);
  const room = new RoomEnvironment();
  const environment = pmrem.fromScene(room, 0.04);
  scene.environment = environment.texture;
  scene.environmentIntensity = 0.8;
  room.dispose();
  pmrem.dispose();

  const ambient = new THREE.HemisphereLight(0xffffff, 0xb8b8b8, 2.6);
  scene.add(ambient);
  const key = new THREE.DirectionalLight(0xffffff, 4.5);
  key.position.set(-3, 7, 8);
  key.castShadow = true;
  key.shadow.mapSize.set(1024, 1024);
  key.shadow.camera.left = -7;
  key.shadow.camera.right = 7;
  key.shadow.camera.top = 7;
  key.shadow.camera.bottom = -7;
  key.shadow.normalBias = 0.035;
  key.shadow.bias = -0.0003;
  key.shadow.radius = 4;
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xf1f1f1, 4.1);
  rim.position.set(5, 4, -5);
  scene.add(rim);
  const frontFill = new THREE.DirectionalLight(0xffffff, 1.1);
  frontFill.position.set(-6, 1, 3);
  scene.add(frontFill);

  const model = createCameraModel();
  scene.add(model.group);
  const floor = new THREE.Mesh(new THREE.PlaneGeometry(35, 35), new THREE.ShadowMaterial({ opacity: 0.13 }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = -1.48;
  floor.receiveShadow = true;
  scene.add(floor);
  const shadowCanvas = document.createElement('canvas');
  shadowCanvas.width = 256;
  shadowCanvas.height = 256;
  const shadowContext = shadowCanvas.getContext('2d');
  const gradient = shadowContext.createRadialGradient(128, 128, 5, 128, 128, 125);
  gradient.addColorStop(0, 'rgba(23,23,23,.35)');
  gradient.addColorStop(0.38, 'rgba(23,23,23,.15)');
  gradient.addColorStop(1, 'rgba(23,23,23,0)');
  shadowContext.fillStyle = gradient;
  shadowContext.fillRect(0, 0, 256, 256);
  const softShadow = new THREE.Mesh(new THREE.PlaneGeometry(8.4, 6.6), new THREE.MeshBasicMaterial({ map: new THREE.CanvasTexture(shadowCanvas), transparent: true, depthWrite: false, opacity: 0.6 }));
  softShadow.rotation.x = -Math.PI / 2;
  softShadow.position.set(0, -1.46, 0.6);
  scene.add(softShadow);

  const controls = new OrbitControls(camera, renderer.domElement);
  controls.enableDamping = true;
  controls.dampingFactor = 0.08;
  controls.enablePan = false;
  controls.minDistance = 5.0;
  controls.maxDistance = 18;
  controls.minPolarAngle = 0.22;
  controls.maxPolarAngle = Math.PI * 0.81;
  controls.autoRotateSpeed = 0.55;
  controls.rotateSpeed = 0.65;
  controls.zoomSpeed = 0.7;
  controls.target.set(0, 0.12, 0.6);

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let transition = null;
  let gentleOrbit = null;
  let currentView = 'front';
  let disposed = false;
  let shotStarted = 0;
  let activeSource = null;
  let lastScreenUpdate = 0;
  let lastRenderTime = 0;
  let lastEmittedPose = null;
  const viewportDistanceScale = host.clientWidth < 540 ? 1.03 : 1;
  const screenCanvas = document.createElement('canvas');
  screenCanvas.width = 768;
  screenCanvas.height = 512;
  const screenContext = screenCanvas.getContext('2d');
  const screenTexture = new THREE.CanvasTexture(screenCanvas);
  screenTexture.colorSpace = THREE.SRGBColorSpace;
  screenTexture.minFilter = THREE.LinearFilter;
  screenTexture.magFilter = THREE.LinearFilter;

  function viewPosition(name) {
    const presets = {
      front: { position: new THREE.Vector3(-.35, 1.38, 10.6), target: new THREE.Vector3(-.35, .82, .6) },
      back: { position: new THREE.Vector3(-5.3, 3.0, -9.5), target: new THREE.Vector3(0, 0.17, 0) },
      detail: { position: new THREE.Vector3(1.2, 1.1, 8.3), target: new THREE.Vector3(-0.35, 0.04, 1.5) },
    };
    const preset = presets[name] || presets.front;
    // Apply responsive distance to the offset, preserving the pose's angles.
    preset.position.sub(preset.target).multiplyScalar(viewportDistanceScale).add(preset.target);
    return preset;
  }
  const initialFront = viewPosition('front');
  const initialOffset = initialFront.position.clone().sub(initialFront.target);
  const frontDistance = initialOffset.length();
  const frontYaw = -Math.atan2(initialOffset.x, initialOffset.z) * 180 / Math.PI;
  const frontPitch = -Math.atan2(initialOffset.y, Math.hypot(initialOffset.x, initialOffset.z)) * 180 / Math.PI;
  const poseOffset = new THREE.Vector3();
  const wrapDegrees = degrees => ((degrees + 180) % 360 + 360) % 360 - 180;
  const cleanZero = value => Math.abs(value) < 1e-9 ? 0 : value;
  function getPose() {
    poseOffset.copy(camera.position).sub(controls.target);
    return {
      yaw: cleanZero(wrapDegrees(-Math.atan2(poseOffset.x, poseOffset.z) * 180 / Math.PI - frontYaw)),
      pitch: cleanZero(-Math.atan2(poseOffset.y, Math.hypot(poseOffset.x, poseOffset.z)) * 180 / Math.PI - frontPitch),
      zoom: frontDistance / Math.max(poseOffset.length(), 0.000001),
    };
  }
  function emitPose() {
    const pose = getPose();
    if (!lastEmittedPose || Math.abs(wrapDegrees(pose.yaw - lastEmittedPose.yaw)) > 0.0001 || Math.abs(pose.pitch - lastEmittedPose.pitch) > 0.0001 || Math.abs(pose.zoom - lastEmittedPose.zoom) > 0.00001) {
      lastEmittedPose = pose;
      onPoseChange({ ...pose });
    }
  }
  controls.addEventListener('change', emitPose);
  function setView(name = 'front', immediate = false) {
    currentView = name;
    const next = viewPosition(name);
    controls.autoRotate = false;
    gentleOrbit = null;
    if (immediate || reducedMotion) {
      camera.position.copy(next.position);
      controls.target.copy(next.target);
      controls.update();
      transition = null;
      emitPose();
    } else {
      const fromSpherical = new THREE.Spherical().setFromVector3(camera.position.clone().sub(controls.target));
      const toSpherical = new THREE.Spherical().setFromVector3(next.position.clone().sub(next.target));
      toSpherical.theta = fromSpherical.theta + wrapDegrees((toSpherical.theta - fromSpherical.theta) * 180 / Math.PI) * Math.PI / 180;
      // Orbit around the model during presets; a straight line would zoom through it.
      transition = { start: performance.now(), fromTarget: controls.target.clone(), fromSpherical, toSpherical, target: next.target };
    }
  }
  function resize() {
    const width = host.clientWidth;
    const height = host.clientHeight;
    if (!width || !height) return;
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }
  const resizeObserver = new ResizeObserver(resize);
  resizeObserver.observe(host);
  resize();
  setView('front', true);
  controls.addEventListener('start', () => { transition = null; gentleOrbit = null; controls.autoRotate = false; onInteraction(); });

  const raycaster = new THREE.Raycaster();
  const pointer = new THREE.Vector2();
  let downPoint = null;
  const pointerDown = event => { downPoint = { x: event.clientX, y: event.clientY, time: performance.now() }; };
  const pointerUp = event => {
    if (!downPoint || Math.hypot(event.clientX - downPoint.x, event.clientY - downPoint.y) > 6 || performance.now() - downPoint.time > 600) { downPoint = null; return; }
    const rect = renderer.domElement.getBoundingClientRect();
    pointer.set(((event.clientX - rect.left) / rect.width) * 2 - 1, -((event.clientY - rect.top) / rect.height) * 2 + 1);
    raycaster.setFromCamera(pointer, camera);
    const nearest = raycaster.intersectObjects(model.group.children, true)[0];
    if (nearest && (nearest.object.userData.action === 'shutter' || model.shutterTargets.includes(nearest.object))) onShutter();
    downPoint = null;
  };
  renderer.domElement.addEventListener('pointerdown', pointerDown);
  renderer.domElement.addEventListener('pointerup', pointerUp);
  renderer.domElement.addEventListener('webglcontextlost', event => {
    event.preventDefault();
    host.dispatchEvent(new CustomEvent('sceneerror', { detail: 'The 3D graphics context was interrupted. Refresh to restore the model. Your camera can still take photos.' }));
  });

  function drawLiveScreen(time) {
    if (!activeSource || time - lastScreenUpdate < 50) return;
    const { source } = activeSource;
    const isVideo = typeof source.videoWidth === 'number';
    if (isVideo && source.readyState < 2) return;
    const w = isVideo ? source.videoWidth : source.width;
    const h = isVideo ? source.videoHeight : source.height;
    if (!w || !h) return;
    // A canvas is already the processed photo preview: never apply its look twice.
    const filter = isVideo ? activeSource.filter || 'none' : 'none';
    const mirror = isVideo ? Boolean(activeSource.mirror) : false;
    const scale = Math.min(screenCanvas.width / w, screenCanvas.height / h);
    const outW = w * scale;
    const outH = h * scale;
    screenContext.save();
    screenContext.filter = 'none';
    screenContext.fillStyle = '#11160f';
    screenContext.fillRect(0, 0, 768, 512);
    screenContext.translate(mirror ? 768 : 0, 0);
    screenContext.scale(mirror ? -1 : 1, 1);
    screenContext.filter = filter;
    screenContext.drawImage(source, (768 - outW) / 2, (512 - outH) / 2, outW, outH);
    screenContext.restore();
    screenContext.fillStyle = '#edf5dc';
    screenContext.font = '17px monospace';
    screenContext.fillText('LIVE VIEW', 20, 30);
    screenContext.fillStyle = '#a7d08c';
    screenContext.beginPath();
    screenContext.arc(737, 24, 5, 0, Math.PI * 2);
    screenContext.fill();
    screenTexture.needsUpdate = true;
    lastScreenUpdate = time;
  }
  renderer.setAnimationLoop(time => {
    if (disposed || document.hidden || time - lastRenderTime < 23) return;
    lastRenderTime = time;
    model.update(time / 1000);
    const eyeState=model.getLoaderState();
    if (transition) {
      const t = Math.min((time - transition.start) / 850, 1);
      const ease = t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2;
      controls.target.lerpVectors(transition.fromTarget, transition.target, ease);
      const spherical = new THREE.Spherical(
        THREE.MathUtils.lerp(transition.fromSpherical.radius, transition.toSpherical.radius, ease),
        THREE.MathUtils.lerp(transition.fromSpherical.phi, transition.toSpherical.phi, ease),
        THREE.MathUtils.lerp(transition.fromSpherical.theta, transition.toSpherical.theta, ease),
      );
      camera.position.setFromSpherical(spherical).add(controls.target);
      if (t === 1) transition = null;
    }
    if (gentleOrbit) {
      const spherical=gentleOrbit.base.clone();
      spherical.theta+=eyeState.aim.yaw;
      spherical.phi+=eyeState.aim.pitch+eyeState.aim.recoil*.009;
      spherical.radius+=eyeState.aim.recoil*.16;
      camera.position.setFromSpherical(spherical).add(controls.target);
    }
    controls.update();
    if(gentleOrbit)camera.rotateZ(eyeState.aim.roll);
    emitPose();
    if (shotStarted) {
      const progress = Math.min((time - shotStarted) / 340, 1);
      model.animateShutter(progress);
      if (progress === 1) shotStarted = 0;
    }
    host.dataset.eyeState=eyeState.phase;
    host.dataset.flash=eyeState.flash?'active':'off';
    host.dataset.motion=eyeState.motion?'on':'off';
    host.dataset.iris=eyeState.iris;
    host.dataset.irisResolution=eyeState.irisResolution;
    host.dataset.shotCount=String(eyeState.shotCount);
    host.dataset.eyeColor=eyeState.color;
    host.dataset.sequenceComplete=String(eyeState.sequenceComplete);
    host.dataset.shotTimes=eyeState.shotTimes.join(',');
    drawLiveScreen(time);
    renderer.render(scene, camera);
    if(eyeState.flashPeak)onFlash({shot:eyeState.shotCount,color:eyeState.color});
    if(eyeState.sequenceFinished)onSequenceComplete({shots:eyeState.shotCount,color:eyeState.color});
  });

  return {
    ready:model.ready,
    setView,
    getPose,
    reset() { setView('front'); },
    zoom(factor) {
      if (!Number.isFinite(factor) || factor <= 0) return;
      transition = null;
      const offset = camera.position.clone().sub(controls.target);
      const length = THREE.MathUtils.clamp(offset.length() * factor, controls.minDistance, controls.maxDistance);
      camera.position.copy(controls.target).add(offset.setLength(length));
      controls.update();
      emitPose();
    },
    setAutoRotate(value) {
      transition = null;
      controls.autoRotate = false;
      if(value){
        const view=viewPosition(currentView);
        const base=new THREE.Spherical().setFromVector3(view.position.sub(view.target));
        base.radius=camera.position.distanceTo(controls.target);
        gentleOrbit={base};
      }else gentleOrbit=null;
    },
    setLoaderMotion(value) { if(model.setLoaderMotion(Boolean(value))){const state=model.getLoaderState();onSequenceComplete({shots:state.shotCount,color:state.color});} },
    setLiveSource(source, options = {}) {
      activeSource = source ? { ...options, source } : null;
      lastScreenUpdate = -Infinity;
      model.setScreenTexture(source ? screenTexture : null);
      if (source) drawLiveScreen(performance.now());
    },
    clearLiveSource() { activeSource = null; model.setScreenTexture(null); },
    shutter() { shotStarted = performance.now(); },
    dispose() {
      disposed = true;
      renderer.setAnimationLoop(null);
      model.dispose();
      resizeObserver.disconnect();
      controls.dispose();
      environment.dispose();
      screenTexture.dispose();
      scene.traverse(object => {
        object.geometry?.dispose();
        if (Array.isArray(object.material)) object.material.forEach(material => material.dispose());
        else object.material?.dispose();
      });
      renderer.dispose();
      renderer.domElement.remove();
    },
  };
}
