import { CaptureEngine, cameraErrorMessage } from './capture-engine.js';
import { drawPhotoFrame, resolvePhotoPose } from './photo-frame.js';

const $ = selector => document.querySelector(selector);
const $$ = selector => [...document.querySelectorAll(selector)];
const video = $('#live-video');
const photoPreview = $('#photo-preview');
const engine = new CaptureEngine(video);
const photos = [];
const emptyRoll = $('#roll-strip').firstElementChild;
const lookNames = { color: 'True to life', mono: 'Timeless, in black & white', warm: 'A little golden hour' };
let filter = 'color';
let exposure = 0;
let scene = null;
let soundEnabled = true;
let audioContext = null;
let shooting = false;
let cameraPending = false;
let cameraOperation = 0;
let timerController = null;
let toastTimeout;
let shotNumber = 0;
let selectedPhoto = null;
let autoRotate = false;
let clearConfirmUntil = 0;
let cameraPose = { yaw: 0, pitch: 0, zoom: 1 };
let previewAnimation = 0;
let lastPreviewTime = 0;
let captureMode = false;
let studioScrollY = 0;
const panel = $('.shoot-panel');
const adjustments = document.createElement('div');
adjustments.id = 'camera-adjustments';
adjustments.className = 'camera-adjustments';
adjustments.innerHTML = `<div class="capture-adjustments-heading"><strong>CAMERA SETTINGS</strong><button type="button" id="capture-settings-close" aria-label="Close camera settings">DONE</button></div>`;
$('.angle-control').before(adjustments);
adjustments.append($('.angle-control'), $('.exposure-control'));
const poseControls = document.createElement('div');
poseControls.className = 'capture-pose-controls';
poseControls.innerHTML = `<label for="capture-yaw">HORIZONTAL ANGLE<input id="capture-yaw" type="range" min="-90" max="90" step="1" value="0"></label><label for="capture-pitch">VERTICAL ANGLE<input id="capture-pitch" type="range" min="-60" max="60" step="1" value="0"></label><label for="capture-zoom">ZOOM<input id="capture-zoom" type="range" min="1" max="1.6" step="0.05" value="1"></label><button type="button" id="capture-pose-reset">RESET FRAMING</button>`;
adjustments.append(poseControls);
const captureControls = document.createElement('div');
captureControls.className = 'capture-controls';
panel.append(captureControls);
captureControls.append($('.look-control'), $('.capture-options'), $('.shutter-row'), $('.privacy-note'));

function setCaptureSettings(open) {
  adjustments.hidden = captureMode && !open;
  $('#capture-settings-toggle').setAttribute('aria-expanded', String(open));
  if (open) $('#capture-settings-close').focus({preventScroll:true});
  else if (captureMode) $('#capture-settings-toggle').focus({preventScroll:true});
}
function syncCaptureMode(active) {
  // A lens switch releases its old stream briefly; keep the viewport steady.
  const next = active || (captureMode && cameraPending);
  if (next === captureMode) return;
  if (next) studioScrollY = window.scrollY;
  captureMode = next;
  document.body.classList.toggle('capture-mode', next);
  $('#capture-header').hidden = !next;
  $('#capture-photos').hidden = !next;
  if (next) {
    autoRotate = false;
    scene?.setAutoRotate(false);
    $('#auto-rotate').setAttribute('aria-pressed','false');
    $('#capture-yaw').value = String(Math.max(-90, Math.min(90, cameraPose.yaw)));
    $('#capture-pitch').value = String(Math.max(-60, Math.min(60, cameraPose.pitch)));
    $('#capture-zoom').value = String(Math.max(1, Math.min(1.6, cameraPose.zoom)));
    panel.setAttribute('role','dialog');
    panel.setAttribute('aria-modal','true');
    panel.setAttribute('aria-labelledby','capture-title');
    adjustments.hidden = true;
    $('#capture-settings-toggle').setAttribute('aria-expanded','false');
    panel.focus({preventScroll:true});
  } else {
    panel.removeAttribute('role'); panel.removeAttribute('aria-modal'); panel.removeAttribute('aria-labelledby');
    adjustments.hidden = false;
    cameraPose = scene?.getPose?.() || cameraPose;
    updateAngleReadout();
    $('#capture-settings-toggle').setAttribute('aria-expanded','false');
    window.scrollTo({top:studioScrollY,behavior:'instant'});
    $('#enable-camera').focus({preventScroll:true});
  }
}
$('#capture-settings-toggle').addEventListener('click', () => setCaptureSettings(adjustments.hidden));
$('#capture-settings-close').addEventListener('click', () => setCaptureSettings(false));
$('#capture-close').addEventListener('click', () => $('#stop-camera').click());
$('#capture-photos').addEventListener('click', () => { if (photos.length) openPhoto(photos[photos.length - 1]); });
for (const [id,key] of [['capture-yaw','yaw'],['capture-pitch','pitch'],['capture-zoom','zoom']]) {
  $('#' + id).addEventListener('input', event => {
    cameraPose = {...cameraPose, [key]: Number(event.target.value)};
    updateAngleReadout(); applyPreviewLook();
  });
}
$('#capture-pose-reset').addEventListener('click', () => {
  cameraPose = {yaw:0,pitch:0,zoom:1};
  $('#capture-yaw').value='0'; $('#capture-pitch').value='0'; $('#capture-zoom').value='1';
  updateAngleReadout(); applyPreviewLook();
});
document.addEventListener('keydown', event => {
  if (!captureMode || $('dialog[open]')) return;
  if (event.key === 'Escape') {
    event.preventDefault();
    if (shooting) { timerController?.abort(); return; }
    if (!adjustments.hidden) setCaptureSettings(false);
    else $('#stop-camera').click();
  }
  if (event.key === 'Tab') {
    const focusable = [...panel.querySelectorAll('button:not(:disabled),a[href],input:not(:disabled),[tabindex="0"]')].filter(el=>el.getClientRects().length);
    const first = focusable[0], last = focusable[focusable.length-1];
    if (event.shiftKey && (document.activeElement === first || document.activeElement === panel)) { event.preventDefault(); last?.focus(); }
    else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first?.focus(); }
  }
});

function selectedPose() {
  return $('#angle-toggle').checked ? { ...cameraPose } : null;
}

function formatAngle(pose, includeZoom = true) {
  const angle = resolvePhotoPose(pose);
  const signed = value => {
    const rounded = Math.round(value);
    return rounded > 0 ? `+${rounded}` : String(rounded);
  };
  const zoom = includeZoom && angle.zoom > 1.01 ? ` · ${angle.zoom.toFixed(2)}×` : '';
  return `H ${signed(angle.yaw)}° · V ${signed(angle.pitch)}°${zoom}`;
}

function updateAngleReadout() {
  const linked = $('#angle-toggle').checked;
  const label = linked ? formatAngle(cameraPose) : 'Original framing';
  if ($('#shot-angle').textContent !== label) $('#shot-angle').textContent = label;
  const hint = linked
    ? 'Perspective follows the EOS. Your photo saves this framing.'
    : 'Original camera framing. Turn on to follow the EOS.';
  if ($('#angle-hint').textContent !== hint) $('#angle-hint').textContent = hint;
}

function renderPhotoPreview() {
  if (!engine.active || video.readyState < 2 || !video.videoWidth || !video.videoHeight) return;
  const scale = Math.min(1, 720 / Math.max(video.videoWidth, video.videoHeight));
  const width = Math.max(2, Math.round(video.videoWidth * scale));
  const height = Math.max(2, Math.round(video.videoHeight * scale));
  if (photoPreview.width !== width || photoPreview.height !== height) {
    photoPreview.width = width;
    photoPreview.height = height;
  }
  drawPhotoFrame(photoPreview, video, {
    filter,
    exposure,
    mirror: $('#mirror-toggle').checked && engine.facingMode === 'user',
    pose: selectedPose(),
  });
}

function previewTick(time) {
  previewAnimation = 0;
  if (!engine.active) return;
  if (!document.hidden && time - lastPreviewTime >= 33) {
    renderPhotoPreview();
    lastPreviewTime = time;
  }
  previewAnimation = requestAnimationFrame(previewTick);
}

function stopPhotoPreview() {
  if (previewAnimation) cancelAnimationFrame(previewAnimation);
  previewAnimation = 0;
}

function toast(message) {
  const element = $('#toast');
  element.textContent = message;
  element.classList.add('visible');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => element.classList.remove('visible'), 3600);
}

function showCameraError(error) {
  if (error?.name === 'AbortError') return;
  const element = $('#camera-error');
  element.textContent = cameraErrorMessage(error);
  if (['CameraPolicyError', 'CameraUnavailableError', 'SecurityError'].includes(error?.name)) {
    const link = document.createElement('a');
    link.href = window.location.href;
    link.target = '_blank';
    link.rel = 'noopener';
    link.className = 'text-button';
    link.style.display = 'flex';
    link.style.justifyContent = 'flex-start';
    link.textContent = 'Open studio in a browser tab ↗';
    element.append(link);
  }
  element.hidden = false;
}

function applyPreviewLook() {
  if (!engine.active) return;
  renderPhotoPreview();
  scene?.setLiveSource(photoPreview);
  if (!previewAnimation) previewAnimation = requestAnimationFrame(previewTick);
}

function syncCameraState() {
  const active = engine.active;
  $('#viewfinder').classList.toggle('is-live', active);
  $('#camera-idle').hidden = active;
  $('#camera-session').hidden = !active;
  $('#shutter-button').disabled = !active || cameraPending || shooting;
  $('#flip-camera').disabled = !active || cameraPending || shooting;
  $('#live-status').textContent = active ? 'LIVE' : 'LIVE VIEW';
  $('#camera-facing').textContent = engine.facingMode === 'environment' ? 'REAR CAMERA' : 'FRONT CAMERA';
  $('#device-label').textContent = engine.deviceLabel || 'Camera connected';
  $('#device-label').title = engine.deviceLabel;
  $('#video-dimensions').textContent = active ? `${video.videoWidth} × ${video.videoHeight}  /  JPEG` : 'READY WHEN YOU ARE';
  $('#enable-camera').innerHTML = cameraPending ? 'Cancel request <svg><use href="#i-close"/></svg>' : 'Enable camera <svg><use href="#i-arrow"/></svg>';
  $('#camera-idle p').textContent = cameraPending ? 'Allow camera access in your browser to continue.' : 'Your front camera. Your perspective.';
  if (active) applyPreviewLook();
  else {
    stopPhotoPreview();
    scene?.clearLiveSource();
    timerController?.abort();
  }
  syncCaptureMode(active);
}

async function enableCamera() {
  if (cameraPending) {
    cameraOperation++;
    cameraPending = false;
    engine.stop();
    syncCameraState();
    return;
  }
  const operation = ++cameraOperation;
  cameraPending = true;
  $('#camera-error').hidden = true;
  syncCameraState();
  try {
    await engine.start();
    if (operation !== cameraOperation) return;
    toast('You’re live. Find your light, then press the shutter.');
  } catch (error) {
    if (operation === cameraOperation) showCameraError(error);
  } finally {
    if (operation === cameraOperation) {
      cameraPending = false;
      syncCameraState();
    }
  }
}

$('#enable-camera').addEventListener('click', enableCamera);
$('#stop-camera').addEventListener('click', () => {
  cameraOperation++;
  cameraPending = false;
  timerController?.abort();
  engine.stop();
  syncCameraState();
  toast('Camera off. Your photographs are still in your roll.');
});
$('#flip-camera').addEventListener('click', async () => {
  if (cameraPending || shooting) return;
  const operation = ++cameraOperation;
  cameraPending = true;
  $('#camera-error').hidden = true;
  syncCameraState();
  try {
    await engine.switchCamera();
    if (operation === cameraOperation) toast(engine.facingMode === 'user' ? 'Front camera ready.' : 'Camera switched. A fresh perspective.');
  } catch (error) {
    if (operation === cameraOperation) {
      if (engine.active) toast(cameraErrorMessage(error));
      else showCameraError(error);
    }
  } finally {
    if (operation === cameraOperation) {
      cameraPending = false;
      syncCameraState();
    }
  }
});
engine.addEventListener('statechange', syncCameraState);
engine.addEventListener('ended', () => {
  cameraPending = false;
  syncCameraState();
  showCameraError({ name: 'NotReadableError' });
});
video.addEventListener('resize', () => { if (engine.active) syncCameraState(); });

$$('[data-filter]').forEach(button => button.addEventListener('click', () => {
  filter = button.dataset.filter;
  $$('[data-filter]').forEach(item => {
    const active = item === button;
    item.classList.toggle('active', active);
    item.setAttribute('aria-pressed', String(active));
  });
  $('#look-name').textContent = lookNames[filter];
  applyPreviewLook();
}));
$('#exposure').addEventListener('input', event => {
  exposure = Number(event.target.value);
  $('#exposure-value').textContent = `${exposure > 0 ? '+' : ''}${exposure.toFixed(1)} EV`;
  applyPreviewLook();
});
$('#mirror-toggle').addEventListener('change', applyPreviewLook);
$('#angle-toggle').addEventListener('change', () => {
  updateAngleReadout();
  applyPreviewLook();
});
$('#grid-toggle').addEventListener('click', () => {
  const show = $('#viewfinder-grid').hidden;
  $('#viewfinder-grid').hidden = !show;
  $('#grid-toggle').setAttribute('aria-pressed', String(show));
  $('#grid-toggle').setAttribute('aria-label', show ? 'Hide composition grid' : 'Show composition grid');
});

function prepareSound() {
  if (!soundEnabled) return;
  try {
    const AudioContext = window.AudioContext || window.webkitAudioContext;
    if (!AudioContext) return;
    audioContext ||= new AudioContext();
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
  } catch { /* Camera capture stays available without audio. */ }
}
function playShutterSound() {
  if (!soundEnabled || !audioContext || audioContext.state !== 'running') return;
  const sampleRate = audioContext.sampleRate;
  const buffer = audioContext.createBuffer(1, sampleRate * 0.16, sampleRate);
  const data = buffer.getChannelData(0);
  for (let i = 0; i < data.length; i++) {
    const t = i / sampleRate;
    const first = Math.exp(-t * 125);
    const second = t > 0.065 ? Math.exp(-(t - 0.065) * 100) * 0.65 : 0;
    data[i] = (Math.random() * 2 - 1) * (first + second) * 0.3;
  }
  const source = audioContext.createBufferSource();
  source.buffer = buffer;
  const band = audioContext.createBiquadFilter();
  band.type = 'bandpass';
  band.frequency.value = 1700;
  band.Q.value = 0.5;
  source.connect(band);
  band.connect(audioContext.destination);
  source.start();
  source.onended = () => { source.disconnect(); band.disconnect(); };
}
$('#sound-toggle').addEventListener('click', () => {
  soundEnabled = !soundEnabled;
  $('#sound-toggle').setAttribute('aria-pressed', String(soundEnabled));
  $('#sound-toggle').setAttribute('aria-label', soundEnabled ? 'Mute shutter sound' : 'Enable shutter sound');
  $('#sound-toggle span').textContent = soundEnabled ? 'Sound on' : 'Sound off';
  if (soundEnabled) prepareSound();
});

function delay(milliseconds, signal) {
  return new Promise((resolve, reject) => {
    const abort = () => { clearTimeout(id); reject(new DOMException('Capture cancelled', 'AbortError')); };
    const id = setTimeout(() => { signal.removeEventListener('abort', abort); resolve(); }, milliseconds);
    if (signal.aborted) abort();
    else signal.addEventListener('abort', abort, { once: true });
  });
}

async function takePhoto() {
  if (!engine.active) {
    toast('Enable your camera to take your first photograph.');
    $('#enable-camera').focus({ preventScroll: false });
    return;
  }
  if (shooting || cameraPending) return;
  if (photos.length >= 60) {
    toast('Your roll is full. Download your favorites and clear it to keep shooting.');
    return;
  }
  shooting = true;
  prepareSound();
  const controller = new AbortController();
  timerController = controller;
  syncCameraState();
  try {
    if ($('#timer-toggle').checked) {
      const countdown = $('#countdown');
      countdown.hidden = false;
      for (let number = 3; number > 0; number--) {
        countdown.textContent = String(number);
        await delay(1000, controller.signal);
      }
      countdown.hidden = true;
    }
    if (controller.signal.aborted || !engine.active) throw new DOMException('Capture cancelled', 'AbortError');
    const capturedFilter = filter;
    const capturedPose = $('#angle-toggle').checked ? { ...cameraPose } : null;
    const captureSettings = { filter: capturedFilter, exposure, mirror: $('#mirror-toggle').checked, pose: capturedPose };
    const photo = await engine.capture(captureSettings);
    photo.number = ++shotNumber;
    photo.filter = capturedFilter;
    photo.cameraPose = capturedPose;
    photos.push(photo);
    scene?.shutter();
    playShutterSound();
    $('#shutter-flash').classList.remove('flash');
    void $('#shutter-flash').offsetWidth;
    $('#shutter-flash').classList.add('flash');
    $('#viewfinder').classList.add('focusing');
    setTimeout(() => $('#viewfinder').classList.remove('focusing'), 400);
    addPhotoCard(photo);
    updateRoll();
    toast(`Frame ${String(photo.number).padStart(2, '0')} captured. A little moment, kept.`);
  } catch (error) {
    if (error.name !== 'AbortError') {
      showCameraError(error);
      toast(cameraErrorMessage(error));
    }
  } finally {
    $('#countdown').hidden = true;
    shooting = false;
    timerController = null;
    syncCameraState();
  }
}
$('#shutter-button').addEventListener('click', takePhoto);
document.addEventListener('keydown', event => {
  if (event.key === 'Escape') timerController?.abort();
  if (event.code !== 'Space' || event.repeat || event.ctrlKey || event.altKey || event.metaKey) return;
  if (event.target.closest('input, textarea, select, button, a, [contenteditable="true"]') || $('dialog[open]')) return;
  if (!engine.active) return;
  event.preventDefault();
  takePhoto();
});

function addPhotoCard(photo) {
  emptyRoll.remove();
  const button = document.createElement('button');
  button.className = 'photo-card';
  button.setAttribute('aria-label', `View frame ${photo.number}, ${photo.width} by ${photo.height} pixels`);
  const img = document.createElement('img');
  img.src = photo.url;
  img.alt = `Captured frame ${photo.number}`;
  img.loading = 'lazy';
  const caption = document.createElement('span');
  caption.className = 'photo-card-caption';
  const number = document.createElement('span');
  number.textContent = `FRAME ${String(photo.number).padStart(3, '0')}`;
  caption.append(number);
  const arrow = document.createElement('span');
  arrow.textContent = '↗';
  caption.append(arrow);
  button.append(img, caption);
  button.addEventListener('click', () => openPhoto(photo));
  $('#roll-strip').append(button);
  $('#roll-strip').scrollTo({ left: $('#roll-strip').scrollWidth, behavior: 'smooth' });
}
function updateRoll() {
  const count = String(photos.length).padStart(2, '0');
  $('#header-count').textContent = count;
  $('#roll-count').textContent = ` / ${count}`;
  $('#roll-caption').textContent = photos.length ? `${photos.length} ${photos.length === 1 ? 'moment' : 'moments'} in this session. Click to keep.` : 'A fresh roll. Make it a good one.';
  $('#clear-roll').hidden = !photos.length;
  $('#capture-photo-count').textContent = `PHOTOS ${count}`;
  $('#capture-photos').disabled = !photos.length;
  $('#capture-photos').setAttribute('aria-label', photos.length ? `Review ${photos.length} saved photographs` : 'No photographs yet');
  $('#capture-latest').hidden = !photos.length;
  if (photos.length) $('#capture-latest').src = photos[photos.length - 1].url;
  else $('#capture-latest').removeAttribute('src');
}
function openPhoto(photo) {
  selectedPhoto = photo;
  $('#photo-full').src = photo.url;
  $('#photo-title').textContent = `FRAME ${String(photo.number).padStart(3, '0')} / ${photo.filter === 'color' ? 'ORIGINAL' : photo.filter.toUpperCase()}`;
  $('#photo-size').textContent = `${photo.width} × ${photo.height} px · JPEG`;
  $('#photo-time').textContent = new Date(photo.createdAt).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
  $('#photo-angle').textContent = photo.cameraPose ? `Camera perspective · ${formatAngle(photo.cameraPose)}` : 'Original camera framing';
  $('#download-photo').href = photo.url;
  $('#download-photo').download = `your-turn-behind-the-lens-${photo.createdAt.replace(/[:.]/g, '-')}-${String(photo.number).padStart(3, '0')}.jpg`;
  $('#photo-previous').disabled = photos.indexOf(photo) <= 0;
  $('#photo-next').disabled = photos.indexOf(photo) >= photos.length - 1;
  if (!$('#photo-dialog').open) $('#photo-dialog').showModal();
}
$('#photo-previous').addEventListener('click', () => { const i=photos.indexOf(selectedPhoto); if(i>0) openPhoto(photos[i-1]); });
$('#photo-next').addEventListener('click', () => { const i=photos.indexOf(selectedPhoto); if(i<photos.length-1) openPhoto(photos[i+1]); });
$('#download-photo').addEventListener('click', () => { if (selectedPhoto) toast('Your photo is ready to keep.'); });
$('#roll-link').addEventListener('click', () => $('#photo-roll').scrollIntoView({ behavior: 'smooth', block: 'start' }));
$('#clear-roll').addEventListener('click', () => {
  const now = performance.now();
  if (now > clearConfirmUntil) {
    clearConfirmUntil = now + 5000;
    $('#clear-roll').textContent = 'Click again to clear';
    toast('Download your favorites first. Click Clear again to remove this session’s photos.');
    setTimeout(() => { if (performance.now() >= clearConfirmUntil) $('#clear-roll').textContent = 'Clear roll'; }, 5100);
    return;
  }
  if ($('#photo-dialog').open) $('#photo-dialog').close();
  selectedPhoto = null;
  $('#photo-full').removeAttribute('src');
  $('#download-photo').removeAttribute('href');
  photos.forEach(photo => URL.revokeObjectURL(photo.url));
  photos.length = 0;
  $('#roll-strip').replaceChildren(emptyRoll);
  $('#clear-roll').textContent = 'Clear roll';
  clearConfirmUntil = 0;
  updateRoll();
  toast('A fresh roll. Ready for your next moment.');
});

function selectView(name) {
  autoRotate = false;
  $('#auto-rotate').setAttribute('aria-pressed', 'false');
  $$('[data-view]').forEach(button => {
    const active = button.dataset.view === name;
    button.classList.toggle('active', active);
    button.setAttribute('aria-pressed', String(active));
  });
  scene?.setView(name);
}
$$('[data-view]').forEach(button => button.addEventListener('click', () => selectView(button.dataset.view)));
$('#reset-view').addEventListener('click', () => selectView('front'));
$('#zoom-in').addEventListener('click', () => scene?.zoom(0.85));
$('#zoom-out').addEventListener('click', () => scene?.zoom(1.18));
$('#auto-rotate').addEventListener('click', () => {
  autoRotate = !autoRotate;
  $('#auto-rotate').setAttribute('aria-pressed', String(autoRotate));
  scene?.setAutoRotate(autoRotate);
});

$('#reference-button').addEventListener('click', () => $('#reference-dialog').showModal());
$('#help-button').addEventListener('click', () => $('#help-dialog').showModal());
$('#open-browser').href = window.location.href;
$$('[data-close-dialog]').forEach(button => button.addEventListener('click', () => button.closest('dialog').close()));
$$('dialog').forEach(dialog => dialog.addEventListener('click', event => {
  if (event.target !== dialog) return;
  const rect = dialog.getBoundingClientRect();
  if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) dialog.close();
}));
$('#model-host').addEventListener('sceneerror', event => toast(event.detail));

async function initializeScene() {
  const callbacks = {
    onShutter: takePhoto,
    onPoseChange: pose => {
      if (captureMode) return;
      cameraPose = { ...pose };
      updateAngleReadout();
    },
    onInteraction: () => {
      $('#orbit-hint').style.opacity = '0';
      autoRotate = false;
      $('#auto-rotate').setAttribute('aria-pressed', 'false');
      scene?.setAutoRotate(false);
    },
  };
  try {
    const { createStudioScene } = await import('./scene.js');
    scene = createStudioScene($('#model-host'), callbacks);
    $('#model-loading').remove();
    if (engine.active) applyPreviewLook();
  } catch (error) {
    console.info('Using the compatible CSS 3D renderer.');
    try {
      const { createCSSScene } = await import('./css-scene.js');
      $('#model-host').replaceChildren();
      scene = createCSSScene($('#model-host'), callbacks);
      if (engine.active) applyPreviewLook();
    } catch (fallbackError) {
      console.error('3D renderer unavailable:', fallbackError);
      $('#model-host').innerHTML = '<div class="model-fallback"><img src="./assets/reference.png" alt="Canon EOS reference camera"><p><b>The camera still works.</b>This browser couldn’t open the 3D view. Enable your camera to keep shooting, or open the studio in a browser with WebGL.</p></div>';
      $$('[data-view], #zoom-in, #zoom-out, #reset-view, #auto-rotate').forEach(button => { button.disabled = true; });
      $('#orbit-hint').hidden = true;
    }
  }
}
window.addEventListener('pagehide', event => {
  stopPhotoPreview();
  timerController?.abort();
  engine.stop();
  cameraPending = false;
  cameraOperation++;
  if (!event.persisted) photos.forEach(photo => URL.revokeObjectURL(photo.url));
});
window.addEventListener('pageshow', () => syncCameraState());
document.addEventListener('visibilitychange', () => { if (document.hidden) timerController?.abort(); });
syncCameraState();
updateAngleReadout();
initializeScene();
