(() => {
'use strict';
const $ = (s,r=document)=>r.querySelector(s), $$=(s,r=document)=>[...r.querySelectorAll(s)];
const storage={get:(s,k)=>{try{return s.getItem(k)}catch{return null}},set:(s,k,v)=>{try{s.setItem(k,v)}catch{}}};
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let paused=storage.get(localStorage,'savior-motion')==='paused'||reduced.matches;
function motion(){document.body.classList.toggle('motion-enabled',!paused);document.body.classList.toggle('motion-paused',paused);$('#motion-toggle').textContent=paused?'Enable motion':'Pause motion';$('#motion-toggle').setAttribute('aria-pressed',String(paused));}
motion();$('#motion-toggle').addEventListener('click',()=>{paused=!paused;storage.set(localStorage,'savior-motion',paused?'paused':'enabled');motion();});
reduced.addEventListener('change',e=>{paused=e.matches;motion();});
const intro=$('#intro'),introCamera=$('#intro-camera');
let introTimer,introFrame,introHideTimer,introStarted=0,introClosing=false,cameraReady=false,cameraReadyAt=0,cameraSequenceComplete=false;
const cameraOrigin=location.origin==='null'?'*':location.origin;
function cameraMessage(type){introCamera.contentWindow?.postMessage({type,motion:!paused},cameraOrigin);}
function closeIntro(){
 if(introClosing||intro.hidden)return;
 introClosing=true;clearTimeout(introTimer);cancelAnimationFrame(introFrame);
 $('#intro-bar').style.transform='scaleX(1)';$('#intro-percent').value='100%';$('.intro-progress').setAttribute('aria-valuenow','100');
 intro.classList.add('leaving');
 introHideTimer=setTimeout(()=>{intro.hidden=true;intro.classList.remove('leaving');cameraMessage('savior-camera-pause');window.dispatchEvent(new Event('savior-ready'));},500);
 storage.set(sessionStorage,'savior-intro','seen');
}
function showIntro(){
 clearTimeout(introTimer);clearTimeout(introHideTimer);cancelAnimationFrame(introFrame);
 intro.hidden=false;intro.classList.remove('leaving');introClosing=false;cameraReady=false;cameraReadyAt=0;cameraSequenceComplete=false;introStarted=performance.now();
 $('#intro-bar').style.transform='scaleX(0)';$('#intro-percent').value='0%';$('.intro-progress').setAttribute('aria-valuenow','0');
 if(!introCamera.getAttribute('src'))introCamera.src=introCamera.dataset.src;
 else cameraMessage('savior-camera-resume');
 const tick=now=>{
  const elapsed=now-introStarted,canFinish=cameraReady&&cameraSequenceComplete,pct=Math.min(canFinish?100:96,Math.floor(elapsed/50));
  $('#intro-bar').style.transform=`scaleX(${pct/100})`;$('#intro-percent').value=pct+'%';$('.intro-progress').setAttribute('aria-valuenow',String(pct));
  if(elapsed>=5000&&canFinish)closeIntro();else introFrame=requestAnimationFrame(tick);
 };
 introFrame=requestAnimationFrame(tick);introTimer=setTimeout(closeIntro,12000);
}
window.addEventListener('message',event=>{
 if(event.source===introCamera.contentWindow&&event.origin===location.origin&&event.data?.type==='savior-camera-sequence-complete')cameraSequenceComplete=true;
 if(event.source===introCamera.contentWindow&&event.origin===location.origin&&event.data?.type==='savior-camera-ready'&&!cameraReady){cameraReady=true;cameraReadyAt=performance.now();}
 if(event.source===introCamera.contentWindow&&event.origin===location.origin&&event.data?.type==='savior-camera-flash'&&!paused&&!intro.hidden&&!introClosing){const flash=$('#intro-flash');flash.getAnimations().forEach(a=>a.cancel());flash.animate([{opacity:0},{opacity:.55,offset:.16},{opacity:0}],{duration:170,easing:'ease-out'});}
});
introCamera.addEventListener('load',()=>{if(!intro.hidden&&!introClosing)cameraMessage('savior-camera-resume');});
showIntro();
$('#replay-intro').addEventListener('click',showIntro);
$('#year').textContent=new Date().getFullYear();
const menu=$('.menu-toggle'),nav=$('#navigation');function closeMenu(){nav.classList.remove('open');menu.setAttribute('aria-expanded','false');}
menu.addEventListener('click',()=>{const open=nav.classList.toggle('open');menu.setAttribute('aria-expanded',String(open));});$$('a',nav).forEach(a=>a.addEventListener('click',closeMenu));document.addEventListener('keydown',e=>{if(e.key==='Escape')closeMenu();});
let toastTimer;function toast(message){$('#toast').textContent=message;$('#toast').classList.add('visible');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3200);}
if('IntersectionObserver' in window){const io=new IntersectionObserver(entries=>entries.forEach(e=>{if(e.isIntersecting){e.target.classList.add('revealing');io.unobserve(e.target);}}),{threshold:.08});$$('[data-reveal]').forEach((el,i)=>{el.style.animationDelay=`${i%3*65}ms`;io.observe(el);});}
const photos=[
 ['editorial-portrait.jpg','A point of view, made personal.','Editorial portrait against red velvet','portraits'],
 ['key-west-wedding.jpg','For the once-in-a-lifetime.','A couple on the beach on their wedding day','weddings'],
 ['live-music-confetti.jpg','For the unforgettable nights.','A concert under a shower of confetti','music'],
 ['rusty-lemmon-studio.jpg','In the studio — Rusty Lemmon','Rusty Lemmon playing guitar in a recording studio','music'],
 ['roller-derby-portrait.jpg','Character in frame','Portrait of a roller derby athlete','portraits'],
 ['islamorada-wedding.jpg','A day in Islamorada','Wedding photograph in Islamorada','weddings'],
 ['engagement-shoreline.jpg','Just the two of you','An engaged couple beside the water','engagements'],
 ['rusty-lemmon-portrait.jpg','Rusty Lemmon','A close portrait of musician Rusty Lemmon','music'],
 ['wedding-first-dance.jpg','The first dance','Newlyweds sharing a first dance','weddings'],
 ['engagement-guitar.jpg','A song for two','A couple sharing a musical moment','engagements'],
 ['engagement-couple.jpg','A new chapter','Engagement portrait of a couple','engagements'],
 ['guitar-session.jpg','Inside the session','A guitar in a recording room','music']
];let activeFilter='all',photoIndex=0,lastTrigger;
const lightbox=$('#lightbox');function galleryList(){return photos.filter(p=>activeFilter==='all'||p[3]===activeFilter)}
function showPhoto(step=0){const list=galleryList();photoIndex=(photoIndex+step+list.length)%list.length;const p=list[photoIndex];$('#lightbox-photo').src='assets/photos/'+p[0];$('#lightbox-photo').alt=p[2];$('#lightbox-caption').textContent=`${p[1]} · ${photoIndex+1} of ${list.length}`;}
$$('[data-gallery]').forEach(b=>b.addEventListener('click',()=>{lastTrigger=b;let list=galleryList();if(!list.some(p=>p[0]===b.dataset.gallery)){activeFilter='all';list=galleryList();}photoIndex=list.findIndex(p=>p[0]===b.dataset.gallery);showPhoto();lightbox.showModal();document.body.style.overflow='hidden';$('#close-lightbox').focus();}));
function closeGallery(){lightbox.close();}lightbox.addEventListener('close',()=>{document.body.style.overflow='';lastTrigger?.focus();});$('#close-lightbox').addEventListener('click',closeGallery);$('#previous-photo').addEventListener('click',()=>showPhoto(-1));$('#next-photo').addEventListener('click',()=>showPhoto(1));lightbox.addEventListener('keydown',e=>{if(e.key==='ArrowLeft'){e.preventDefault();showPhoto(-1);}if(e.key==='ArrowRight'){e.preventDefault();showPhoto(1);}});let touchX=0;lightbox.addEventListener('touchstart',e=>touchX=e.changedTouches[0].clientX,{passive:true});lightbox.addEventListener('touchend',e=>{const d=e.changedTouches[0].clientX-touchX;if(Math.abs(d)>60)showPhoto(d<0?1:-1);},{passive:true});
$$('[data-filter]').forEach(b=>b.addEventListener('click',()=>{activeFilter=b.dataset.filter;$$('[data-filter]').forEach(f=>{const on=f===b;f.classList.toggle('active',on);f.setAttribute('aria-pressed',String(on));});let count=0;$$('.work-item').forEach(el=>{el.hidden=activeFilter!=='all'&&el.dataset.category!==activeFilter;if(!el.hidden)count++;});$('.work-grid').classList.toggle('filtered',activeFilter!=='all');$('#filter-status').textContent=`${count} photographs shown`;}));
$('#play-film').addEventListener('click',()=>{const iframe=document.createElement('iframe');iframe.src='https://www.youtube-nocookie.com/embed/G4DrXlprwEs?autoplay=1&rel=0';iframe.title='Leesta Vall Office Sessions — Direct to Vinyl';iframe.allow='accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture';iframe.allowFullscreen=true;iframe.referrerPolicy='strict-origin-when-cross-origin';$('#film-player').replaceChildren(iframe);});
$$('.add-service').forEach(b=>b.addEventListener('click',()=>{$('#service').value=b.dataset.service;$('#contact').scrollIntoView({behavior:paused?'instant':'smooth'});toast(b.dataset.service+' added to your brief.');}));
let brief='';$('#brief-form').addEventListener('submit',e=>{e.preventDefault();const f=new FormData(e.currentTarget);brief=`SAVIOR PRODUCTIONS — PROJECT BRIEF\n\nName: ${String(f.get('name')).trim()}\nEmail: ${String(f.get('email')).trim()}\nProject: ${f.get('service')}\nWhen: ${String(f.get('date')).trim()||'To be discussed'}\nWhere: ${String(f.get('location')).trim()||'To be discussed'}\n\n${String(f.get('message')).trim()}`;$('#brief-text').textContent=brief;$('#brief-result').hidden=false;$('#brief-result').scrollIntoView({behavior:paused?'instant':'smooth',block:'center'});$('#brief-feedback').textContent='Brief prepared. Nothing has been sent.';});
$('#copy-brief').addEventListener('click',async()=>{try{if(!navigator.clipboard)throw new Error('No clipboard');await navigator.clipboard.writeText(brief);$('#brief-feedback').textContent='Copied. Paste it into a message to Beth.';}catch{const r=document.createRange();r.selectNodeContents($('#brief-text'));const s=window.getSelection();s.removeAllRanges();s.addRange(r);$('#brief-feedback').textContent='Your brief is selected. Use Copy, or choose Save as text.';}});
$('#download-brief').addEventListener('click',()=>{const url=URL.createObjectURL(new Blob([brief],{type:'text/plain;charset=utf-8'}));const a=document.createElement('a');a.href=url;a.download='savior-productions-project-brief.txt';a.click();setTimeout(()=>URL.revokeObjectURL(url),1500);$('#brief-feedback').textContent='Your brief has been saved. Nothing has been sent.';});

// Idle scrolling is opt-out, stops on interaction and never runs over forms or a camera session.
let autoEnabled=!reduced.matches;
let lastActivity=performance.now(),lastTick=0,autoMoving=false,ownScrollUntil=0,scrollCarry=0;
function activity(){lastActivity=performance.now();if(autoMoving){autoMoving=false;}}
['pointerdown','pointermove','touchstart','wheel','keydown','focusin'].forEach(type=>window.addEventListener(type,activity,{passive:true}));
window.addEventListener('scroll',()=>{if(performance.now()>ownScrollUntil)activity();},{passive:true});
window.addEventListener('savior-ready',activity);
document.addEventListener('visibilitychange',activity);
$('#motion-toggle').addEventListener('click',()=>{activity();});
reduced.addEventListener('change',()=>{if(reduced.matches)autoEnabled=false;activity();});
function autoStep(now){const delta=Math.min(40,now-(lastTick||now));lastTick=now;const tag=document.activeElement?.tagName;const blocked=['INPUT','TEXTAREA','SELECT','IFRAME'].includes(tag)||lightbox.open||!intro.hidden||nav.classList.contains('open')||document.hidden||paused;const canMove=autoEnabled&&!blocked&&now-lastActivity>12000;const bottom=window.scrollY+innerHeight>=document.documentElement.scrollHeight-2;if(canMove&&!bottom){if(!autoMoving){autoMoving=true;}scrollCarry+=delta*.024;if(scrollCarry>=1){ownScrollUntil=now+150;const amount=Math.floor(scrollCarry);scrollCarry-=amount;window.scrollBy({top:amount,behavior:'instant'});}}else if(autoMoving){autoMoving=false;if(bottom){autoEnabled=false;}}requestAnimationFrame(autoStep);}
requestAnimationFrame(autoStep);
// A restrained depth response keeps the photographs feeling like prints.
if(matchMedia('(hover:hover) and (pointer:fine)').matches){$$('.image-link').forEach(el=>{el.addEventListener('pointermove',e=>{if(paused)return;const r=el.getBoundingClientRect();el.style.setProperty('--tilt-x',`${(e.clientY-r.top-r.height/2)/r.height*-4}deg`);el.style.setProperty('--tilt-y',`${(e.clientX-r.left-r.width/2)/r.width*4}deg`);});el.addEventListener('pointerleave',()=>{el.style.setProperty('--tilt-x','0deg');el.style.setProperty('--tilt-y','0deg');});});}
})();
