const host = document.getElementById('preview-model');
const back = document.getElementById('preview-back');
const reset = document.getElementById('preview-reset');
const loadingMode = new URLSearchParams(location.search).get('loading') === '1';
const reducedMotion = matchMedia('(prefers-reduced-motion: reduce)');
const parentOrigin = location.origin === 'null' ? '*' : location.origin;
let scene;
let rear = false;
let wantsRunning = true;
let generation = 0;
let readyFrame = 0;
let rendererKind = '';
let allowRotation = !reducedMotion.matches;
let loaderMotion = true;

if (loadingMode) {
  document.title = 'SAVIOR PRODUCTIONS — 3D CANON EOS';
  host.tabIndex = -1;
  host.setAttribute('aria-label', '3D Canon EOS camera with a purple iris eye and a shutter-synchronized flash');
  document.querySelector('.preview-controls').hidden = true;
}

function notify(type, extra = {}) {
  if (loadingMode && window.parent !== window) {
    window.parent.postMessage({ type, mode: 'loader', renderer: rendererKind, generation, ...extra }, parentOrigin);
  }
}

const options = {
  onShutter() { /* Display-only model; the full studio is preserved separately. */ },
  onInteraction() { allowRotation = false; scene?.setAutoRotate(false); },
  onFlash(details) { if(wantsRunning&&loaderMotion&&!reducedMotion.matches&&!document.hidden)notify('savior-camera-flash',details); },
  onSequenceComplete(details) { if(wantsRunning&&!document.hidden)notify('savior-camera-sequence-complete',details); },
};

function signalReady(token) {
  // The scene schedules its renderer first; the second frame is after its initial paint.
  readyFrame = requestAnimationFrame(() => {
    readyFrame = requestAnimationFrame(() => {
      readyFrame = 0;
      if (token !== generation || !wantsRunning || document.hidden) return;
      host.dataset.state = 'ready';
      notify('savior-camera-ready');
      if(scene?.setLoaderMotion)scene.setLoaderMotion(loadingMode && loaderMotion && !reducedMotion.matches);
      else if(loadingMode)notify('savior-camera-sequence-complete',{shots:0,color:'purple'});
    });
  });
}

async function start() {
  if (!wantsRunning || document.hidden || scene || host.dataset.state === 'loading') return;
  const token = ++generation;
  host.dataset.state = 'loading';
  host.replaceChildren();
  rendererKind = '';
  back.disabled = false;
  reset.disabled = false;
  if (!loadingMode) {
    const label = document.createElement('div');
    label.className = 'loader';
    label.textContent = 'Preparing the camera…';
    host.append(label);
  }
  try {
    const { createStudioScene } = await import('./scene.js?v=9.11');
    if (token !== generation) return;
    scene = createStudioScene(host, options);
    rendererKind = 'webgl';
  } catch {
    try {
      const { createCSSScene } = await import('./css-scene.js?v=9.11');
      if (token !== generation) return;
      host.replaceChildren();
      scene = createCSSScene(host, options);
      rendererKind = 'css';
    } catch {
      if (token !== generation) return;
      host.innerHTML = '<img class="fallback-photo" src="./assets/reference.png" alt="Canon EOS camera with Sigma lens">';
      rendererKind = 'image';
      back.disabled = true;
      reset.disabled = true;
      try { await host.querySelector('img').decode(); } catch { /* Parent may still finish its own loader. */ }
    }
  }
  if (token !== generation) return;
  host.querySelector('.loader')?.remove();
  host.dataset.renderer = rendererKind;
  if (scene) {
    if (loadingMode) {
      scene.zoom(0.98);
      host.querySelectorAll('button,[tabindex]').forEach(control => { control.tabIndex = -1; control.setAttribute('aria-hidden','true'); });
      host.setAttribute('role','img');
    } else if (rear) {
      scene.setView('back', true);
    }
    scene.setAutoRotate(rendererKind==='webgl' && allowRotation && !reducedMotion.matches);
  }
  if(scene?.ready)await scene.ready;
  if(token!==generation)return;
  signalReady(token);
}

function suspend() {
  generation += 1;
  cancelAnimationFrame(readyFrame);
  readyFrame = 0;
  scene?.dispose?.();
  scene = null;
  host.replaceChildren();
  host.dataset.state = 'paused';
  notify('savior-camera-paused');
}

back.addEventListener('click', () => {
  if (!scene) return;
  rear = !rear;
  allowRotation = false;
  back.setAttribute('aria-pressed', String(rear));
  back.textContent = rear ? 'Front view' : 'Rear view';
  scene.setAutoRotate(false);
  scene.setView(rear ? 'back' : 'front');
});
reset.addEventListener('click', () => {
  rear = false;
  allowRotation = false;
  back.setAttribute('aria-pressed', 'false');
  back.textContent = 'Rear view';
  scene?.setAutoRotate(false);
  scene?.reset();
});

window.addEventListener('message', event => {
  if (!loadingMode || event.source !== window.parent || event.origin !== location.origin) return;
  if (event.data?.type === 'savior-camera-pause') {
    wantsRunning = false;
    suspend();
  } else if (event.data?.type === 'savior-camera-resume') {
    wantsRunning = true;
    loaderMotion = event.data.motion !== false;
    allowRotation = loaderMotion && !reducedMotion.matches;
    scene?.setAutoRotate(rendererKind==='webgl' && allowRotation);
    if(host.dataset.state==='ready')scene?.setLoaderMotion?.(allowRotation);
    if (host.dataset.state === 'ready') notify('savior-camera-ready');
    else start();
  }
});
reducedMotion.addEventListener('change', () => {
  allowRotation = (!loadingMode || loaderMotion) && !reducedMotion.matches;
  scene?.setAutoRotate(rendererKind==='webgl' && allowRotation);
  if(host.dataset.state==='ready')scene?.setLoaderMotion?.(loadingMode && allowRotation);
});
document.addEventListener('visibilitychange', () => {
  if (document.hidden) suspend();
  else start();
});
window.addEventListener('pagehide', suspend);
window.addEventListener('pageshow', () => start());
start();
