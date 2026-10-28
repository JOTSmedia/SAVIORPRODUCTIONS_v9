const host = document.getElementById('preview-model');
const back = document.getElementById('preview-back');
const reset = document.getElementById('preview-reset');
let scene;
let rear = false;
const options = {
  onShutter() { window.top.location.href = new URL('./index.html', location.href).href; },
  onInteraction() { scene?.setAutoRotate(false); },
};
try {
  const { createStudioScene } = await import('./scene.js');
  scene = createStudioScene(host, options);
  host.querySelector('.loader')?.remove();
} catch {
  try {
    const { createCSSScene } = await import('./css-scene.js');
    host.replaceChildren();
    scene = createCSSScene(host, options);
  } catch {
    host.innerHTML = '<img class="fallback-photo" src="./assets/reference.png" alt="Canon EOS camera with Sigma lens">';
    back.disabled = true;
    reset.disabled = true;
  }
}
if (scene) {
  scene.setAutoRotate(!matchMedia('(prefers-reduced-motion: reduce)').matches);
  back.addEventListener('click', () => {
    rear = !rear;
    back.setAttribute('aria-pressed', String(rear));
    back.textContent = rear ? 'Front view' : 'Rear view';
    scene.setAutoRotate(false);
    scene.setView(rear ? 'back' : 'front');
  });
  reset.addEventListener('click', () => {
    rear = false;
    back.setAttribute('aria-pressed', 'false');
    back.textContent = 'Rear view';
    scene.setAutoRotate(false);
    scene.reset();
  });
  document.addEventListener('visibilitychange', () => { if (document.hidden) scene.setAutoRotate(false); });
  window.addEventListener('pagehide', () => scene.dispose?.(), {once:true});
}
