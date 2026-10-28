(() => {
 'use strict';
 const section = document.querySelector('#work');
 if (!section) return;
 const stage = section.querySelector('#work-stage');
 const image = section.querySelector('#work-stage-photo');
 const items = [...section.querySelectorAll('.work-item')];
 if (!stage || !image || !items.length) return;
 const caption = section.querySelector('#work-stage-caption');
 const category = section.querySelector('#work-stage-category');
 const position = section.querySelector('#work-position');
 const status = section.querySelector('#work-selection-status');
 const previous = section.querySelector('#work-previous');
 const next = section.querySelector('#work-next');
 let current = items.find(item => item.querySelector('[data-work-select]')?.dataset.workSelect === stage.dataset.gallery) || items[0];
 const available = () => items.filter(item => !item.hidden);

 function select(item, announce = true) {
  if (!item || item.hidden) return;
  current = item;
  const button = item.querySelector('[data-work-select]');
  const thumbnail = button.querySelector('img');
  const labels = item.querySelectorAll('figcaption span');
  const name = labels[0].textContent.trim();
  const group = labels[1].textContent.trim();
  stage.dataset.gallery = button.dataset.workSelect;
  stage.setAttribute('aria-label', `View ${name} full screen`);
  image.src = thumbnail.getAttribute('src');
  image.alt = thumbnail.alt;
  image.width = Number(thumbnail.getAttribute('width'));
  image.height = Number(thumbnail.getAttribute('height'));
  caption.textContent = name;
  category.textContent = group;
  const visible = available();
  const index = visible.indexOf(item) + 1;
  position.value = `${index} / ${visible.length}`;
  previous.disabled = next.disabled = visible.length < 2;
  items.forEach(candidate => candidate.querySelector('[data-work-select]').setAttribute('aria-pressed', String(candidate === current)));
  if (announce) status.textContent = `${name}. ${group}. Photograph ${index} of ${visible.length}.`;
 }

 function step(direction) {
  const visible = available();
  if (!visible.length) return;
  select(visible[(visible.indexOf(current) + direction + visible.length) % visible.length]);
 }
 previous.addEventListener('click', () => step(-1));
 next.addEventListener('click', () => step(1));
 items.forEach(item => {
  const button = item.querySelector('[data-work-select]');
  button.addEventListener('click', () => select(item));
  button.addEventListener('keydown', event => {
   if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
   event.preventDefault();
   const visible = available();
   const index = visible.indexOf(item);
   const target = event.key === 'Home' ? visible[0] : event.key === 'End' ? visible[visible.length - 1] : visible[(index + (event.key === 'ArrowRight' ? 1 : -1) + visible.length) % visible.length];
   select(target);
   target.querySelector('[data-work-select]').focus();
  });
 });
 // app.js handles each filter button first; this delegated listener sees its updated hidden states.
 section.querySelector('.filters').addEventListener('click', event => {
  if (!event.target.closest('[data-filter]')) return;
  const visible = available();
  select(visible.includes(current) ? current : visible[0]);
 });
 select(current, false);
})();
