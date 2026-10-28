// Full CSS 3D camera for devices that cannot create a WebGL context.
// Every shell face and lens facet participates in native perspective transforms.
export function createCSSScene(host, { onShutter = () => {}, onInteraction = () => {}, onPoseChange = () => {} } = {}) {
  const style = document.createElement('style');
  style.textContent = `
  .eos-css-stage{position:absolute;inset:0;perspective:1100px;perspective-origin:50% 45%;touch-action:none;user-select:none;cursor:grab}
  .eos-css-stage:active{cursor:grabbing}.eos-css-world,.eos-css-part{position:absolute;left:50%;top:50%;width:0;height:0;transform-style:preserve-3d}
  .eos-css-world{will-change:transform}.eos-css-face{position:absolute;left:0;top:0;backface-visibility:hidden;transform-style:preserve-3d;box-sizing:border-box}
  .eos-css-shadow{position:absolute;left:50%;top:calc(50% + 141px);width:360px;height:55px;transform:translateX(-48%);border-radius:50%;background:radial-gradient(ellipse,rgba(24,29,24,.24),rgba(24,29,24,.09) 46%,transparent 72%);filter:blur(11px);pointer-events:none}
  .eos-css-grain{background-image:repeating-radial-gradient(ellipse at 23% 46%,rgba(255,255,255,.045) 0px,rgba(255,255,255,.025) .45px,rgba(0,0,0,.045) .8px,transparent 1.4px);background-size:4px 3px}
  .eos-css-logo{font-family:Georgia,serif;font-size:28px;font-weight:700;color:#e1e1da;letter-spacing:-1.8px;text-align:center;text-shadow:0 1px 1px #000;white-space:nowrap}
  .eos-css-small{font:600 10px Arial,sans-serif;letter-spacing:.5px;color:#c9cac8;text-align:center}
  .eos-css-lens-face{border-radius:50%;background:radial-gradient(circle at 48% 45%,#171e23 0%,#13181c 50%,#030609 61%,#292d31 62%,#090b0f 63.5%,#25282b 65%,#111316 66%,#2d3033 68%,#080a0d 69%,#26292b 72%);border:2px solid #55585a;box-shadow:0 0 0 2px #141719,inset 0 0 2px 1px #7779}
  .eos-css-optics{position:absolute;inset:15%;border-radius:50%;background:radial-gradient(ellipse at 34% 25%,rgba(119,183,205,.22),transparent 35%),radial-gradient(ellipse at 70% 78%,rgba(109,86,170,.18),transparent 31%),radial-gradient(circle,#03080c 0%,#03080c 23%,#202c30 24%,#121d23 28%,#122026 37%,#2c3639 38%,#102026 40%,#15272e 49%,#426065 50%,#162028 51%,#17242c 59%,#383342 60%,#0b1118 62%,#17232b 71%,#030509 72%);box-shadow:inset 0 0 16px #0009,inset 2px 3px 8px #9abcc725}
  .eos-css-optics:before{content:'';position:absolute;inset:33%;background:#020408;clip-path:polygon(28% 0,72% 0,100% 28%,100% 72%,72% 100%,28% 100%,0 72%,0 28%);box-shadow:0 0 15px #000}
  .eos-css-optics:after{content:'';position:absolute;width:48%;height:14%;left:8%;top:20%;border-radius:50%;background:linear-gradient(transparent,#b2d6e833,transparent);transform:rotate(-35deg);filter:blur(3px)}
  .eos-css-eye{visibility:hidden;position:absolute;inset:21%;border-radius:50%;background:radial-gradient(circle at 40% 35%,#eef0f7,#bec5d0);box-shadow:inset -3px -3px 8px #1c304e66,0 0 3px #000;overflow:hidden}.eos-css-eye img{position:absolute;width:64%;height:64%;left:18%;top:18%;border-radius:50%}.eos-css-eye:after{content:'';position:absolute;inset:0;border-radius:50%;background:linear-gradient(135deg,#e5f2ff33,transparent 36%,#31566a22 78%);box-shadow:inset 1px 1px 2px #d6e9fa66}
  .eos-css-lens-type{position:absolute;inset:0;width:100%;height:100%;fill:#b7bab7;stroke:none;overflow:visible}.eos-css-lens-type text{font:7px Arial,sans-serif;letter-spacing:1px}
  .eos-css-rear-screen{background:linear-gradient(140deg,#273137,#090e12);border:8px solid #111316;border-bottom-width:20px;border-radius:8px;box-shadow:0 0 0 2px #353739,inset 0 0 6px #000}
  .eos-css-rear-screen canvas{display:block;width:100%!important;height:100%!important;border-radius:2px}.eos-css-rear-screen:after{position:absolute;content:'Canon';bottom:-16px;left:0;right:0;text-align:center;font:700 11px Georgia,serif;color:#c6c8c4}
  .eos-css-wheel{border-radius:50%;background:repeating-conic-gradient(#36393c 0 4deg,#141618 4deg 9deg);border:3px solid #151719;box-shadow:0 1px 2px #7774,inset 0 0 0 6px #25282b,inset 0 0 0 7px #080a0c}
  .eos-css-wheel:after{content:'SET';position:absolute;inset:28%;border-radius:50%;background:#1a1d20;box-shadow:0 0 0 1px #4447;color:#aaa;font:5px Arial,sans-serif;display:grid;place-items:center}
  .eos-css-port{border-radius:5px;background:linear-gradient(90deg,#141719,#2c2e30);border:1px solid #111;box-shadow:inset 0 0 0 1px #393b3d;color:#636669;font:5px Arial,sans-serif;padding:9px 2px;text-align:center;line-height:27px}
  .eos-css-shutter-hit{display:block;border:0!important;padding:0!important;border-radius:50%;width:100%;height:100%;background:radial-gradient(ellipse at 35% 25%,#dedfdf,#93999c 50%,#4a5054 72%,#c1c4c3 74%,#777d81 84%,#2e3538);box-shadow:0 0 0 2px #101214,0 1px 3px #000;cursor:pointer;pointer-events:auto;outline-offset:3px}
  .eos-css-shutter-hit:after{content:'';position:absolute;inset:17%;border-radius:50%;background:radial-gradient(ellipse at 30% 20%,#5b5e5f,#24282c 70%);box-shadow:inset 0 0 1px #d3d6d6}
  .eos-css-flash{position:absolute;inset:15%;border-radius:50%;background:#fff;opacity:0;pointer-events:none}.eos-css-top-lcd{background:#7a847f;color:#27332e;font:11px monospace;padding:5px 5px 2px;border:3px solid #121517;border-radius:4px;box-shadow:0 0 0 1px #4c5050}.eos-css-top-lcd small{font-size:5px;display:block;margin-top:4px;letter-spacing:.3px}
  `;
  const previousRole=host.getAttribute('role');host.setAttribute('role','group');
  const stage = document.createElement('div');stage.className='eos-css-stage';
  const shadow=document.createElement('div');shadow.className='eos-css-shadow';shadow.setAttribute('aria-hidden','true');stage.append(shadow);
  const world=document.createElement('div');world.className='eos-css-world';stage.append(world);
  host.append(style,stage);

  function part(parent=world,x=0,y=0,z=0,rotation='') {const el=document.createElement('div');el.className='eos-css-part';el.style.transform=`translate3d(${x}px,${y}px,${z}px) ${rotation}`;parent.append(el);return el;}
  function face(parent,w,h,x,y,z,rotation='',bg='',radius=0,cls='') {
    const el=document.createElement('div');el.className=`eos-css-face ${cls}`;el.setAttribute('aria-hidden','true');el.style.width=`${w}px`;el.style.height=`${h}px`;el.style.marginLeft=`${-w/2}px`;el.style.marginTop=`${-h/2}px`;el.style.transform=`translate3d(${x}px,${y}px,${z}px) ${rotation}`;if(bg)el.style.background=bg;if(radius)el.style.borderRadius=`${radius}px`;parent.append(el);return el;
  }
  function cuboid(parent,w,h,d,x,y,z,rounded=8,colors={}){
    const g=part(parent,x,y,z);
    face(g,w,h,0,0,d/2,'',colors.front||'linear-gradient(130deg,#484b4d,#232628 45%,#171a1d)',rounded,'eos-css-grain');
    face(g,w,h,0,0,-d/2,'rotateY(180deg)',colors.back||'linear-gradient(140deg,#323638,#17191c)',rounded,'eos-css-grain');
    face(g,d,h,w/2,0,0,'rotateY(90deg)',colors.side||'linear-gradient(90deg,#343739,#212426)',rounded*.65,'eos-css-grain');
    face(g,d,h,-w/2,0,0,'rotateY(-90deg)','linear-gradient(90deg,#1d2022,#343638)',rounded*.65,'eos-css-grain');
    face(g,w,d,0,-h/2,0,'rotateX(90deg)',colors.top||'linear-gradient(110deg,#585b5c,#303436 55%,#24282a)',rounded*.7,'eos-css-grain');
    face(g,w,d,0,h/2,0,'rotateX(-90deg)','#16191c',rounded*.7);return g;
  }
  function cylinder(parent,r,length,x,y,z,{ribs=false,metal=false,front=true,back=true,count=64}={}){
    const g=part(parent,x,y,z);const facet=2*r*Math.tan(Math.PI/count)+.35;
    for(let i=0;i<count;i++){const a=i/count*Math.PI*2;const shade=Math.round((metal?46:28)+(metal?43:23)*(Math.cos(a)*.6-Math.sin(a)*.4+1)/2);const light=metal?shade+20:shade+6;const side=face(g,facet,length,Math.sin(a)*r,-Math.cos(a)*r,0,`rotateZ(${a*180/Math.PI}deg) rotateX(90deg)`,`linear-gradient(90deg,rgb(${shade-10},${shade-8},${shade-6}),rgb(${light},${light+2},${light+3}) 35%,rgb(${shade},${shade+2},${shade+3}) 85%,#131619)`);if(ribs)side.style.borderLeft='.7px solid #111518';}
    if(front)face(g,r*2,r*2,0,0,length/2,'',metal?'radial-gradient(circle at 30% 20%,#848b8d,#343a3e 60%,#a7adae 99%)':'radial-gradient(circle at 30% 20%,#3d4245,#15191c 70%,#44494a 98%)',r);
    if(back)face(g,r*2,r*2,0,0,-length/2,'rotateY(180deg)','#171b1e',r);return g;
  }
  function text(parent,label,w,h,x,y,z,{rotation='',font='',size=10,color='#c8cbc8',cls='eos-css-small'}={}){const el=face(parent,w,h,x,y,z,rotation,'',0,cls);el.textContent=label;el.style.lineHeight=`${h}px`;if(font)el.style.fontFamily=font;el.style.fontSize=`${size}px`;el.style.color=color;return el;}

  // Main shell and enlarged sculpted grip.
  cuboid(world,316,179,103,0,0,0,18);
  cuboid(world,76,183,129,122,2,14,21,{front:'linear-gradient(110deg,#383c3f,#161a1d 70%,#2d3033)',side:'linear-gradient(90deg,#34383a,#1b1e21)'});
  cuboid(world,60,155,15,129,8,84,17,{front:'linear-gradient(100deg,#303638,#202426 70%,#14181b)'});
  cuboid(world,301,8,91,-1,93,0,4,{front:'#131719'});
  face(world,5,133,86,8,70,'','linear-gradient(90deg,#131618,#525456,#15181a)',3);

  // Extruded trapezoidal pentaprism, including sloping side surfaces.
  const prism=part(world,-23,-113,0);
  for(const [z,rot,bg]of[[52,'','linear-gradient(130deg,#4c5052,#2a2d30 65%,#191d20)'],[-49,'rotateY(180deg)','#2b2f31']]){const el=face(prism,142,68,0,0,z,rot,bg,0,'eos-css-grain');el.style.clipPath='polygon(21% 0,79% 0,100% 100%,0 100%)';}
  face(prism,83,101,0,-34,1.5,'rotateX(90deg)','linear-gradient(100deg,#676b6c,#373b3e)',5);
  face(prism,101,74,56,0,1.5,'rotateZ(-23.5deg) rotateY(90deg)','linear-gradient(90deg,#3a3e40,#474b4d)',2);
  face(prism,101,74,-56,0,1.5,'rotateZ(23.5deg) rotateY(-90deg)','#414548',2);
  text(prism,'Canon',104,36,0,8,53.2,{cls:'eos-css-logo',size:29});
  text(world,'EOS',32,17,72,-41,53,{size:13});
  text(world,'5D',27,16,72,-19,53,{size:12});
  text(world,'Mark IV',36,10,72,-5,53,{size:6,color:'#a7aba8'});
  cuboid(world,32,28,29,-23,-156,-1,4);
  cuboid(world,123,51,57,-23,-190,-1,8);
  face(world,102,31,-23,-190,28.1,'','linear-gradient(115deg,#d7dce8,#a6adb9)',4);

  const lens=part(world,-28,10,0);
  cylinder(lens,78,18,0,0,57,{metal:true});
  cylinder(lens,75,32,0,0,81,{ribs:true});
  cylinder(lens,78,15,0,0,104,{metal:true});
  cylinder(lens,82,74,0,0,148,{ribs:true,count:96});
  cylinder(lens,82,10,0,0,190,{metal:true});
  cylinder(lens,87,18,0,0,203,{metal:false});
  cylinder(lens,89,6,0,0,215,{metal:true});
  const lensFace=face(lens,175,175,0,0,218.3,'','',88,'eos-css-lens-face');
  lensFace.innerHTML='<div class="eos-css-optics"></div><svg class="eos-css-lens-type" viewBox="0 0 200 200" aria-hidden="true"><defs><path id="eos-css-top-arc" d="M 27,94 A 74,74 0 0,1 173,94"/><path id="eos-css-bottom-arc" d="M 27,108 A 74,74 0 0,0 173,108"/></defs><text><textPath href="#eos-css-top-arc" startOffset="50%" text-anchor="middle">SIGMA 50mm 1:1.4 DG HSM</textPath></text><text style="font-size:5.8px;letter-spacing:1px"><textPath href="#eos-css-bottom-arc" startOffset="50%" text-anchor="middle">Ø77 · LENS MADE IN JAPAN</textPath></text></svg><div class="eos-css-flash"></div>';
  const flash=lensFace.querySelector('.eos-css-flash');
  const eye=document.createElement('span');eye.className='eos-css-eye';
  const irisImage=document.createElement('img');irisImage.alt='';irisImage.src=new URL('./assets/purple-iris-reference-4k.webp',import.meta.url).href;
  eye.append(irisImage);lensFace.querySelector('.eos-css-optics').append(eye);
  const eyeReady=irisImage.decode().then(()=>{eye.style.visibility='visible';host.dataset.iris='photographic';host.dataset.irisResolution=`${irisImage.naturalWidth}x${irisImage.naturalHeight}`;},()=>{});
  host.dataset.eyeState='open';host.dataset.flash='off';host.dataset.motion='off';host.dataset.iris='glass-only';host.dataset.shotCount='0';host.dataset.eyeColor='purple';host.dataset.sequenceComplete='true';
  face(lens,40,16,0,-77,94,'rotateX(90deg)','#090c0e',3);
  text(lens,'∞  5  2  1',38,10,0,-77.7,94,{rotation:'rotateX(90deg)',size:6,color:'#d6d8d0'});
  text(lens,'SIGMA',38,12,0,-79,111,{rotation:'rotateX(90deg)',size:8});
  cuboid(lens,7,16,28,-76,0,89,2);

  // Dials, shoulder LCD, and top-mounted clickable shutter.
  const mode=part(world,-110,-99,-3,'rotateX(90deg)');
  cylinder(mode,28,15,0,0,0,{ribs:true,count:48});
  const modeFace=face(mode,53,53,0,0,8.3,'','radial-gradient(circle,#303537 0%,#171b1d 70%,#4a4e4f 100%)',27);
  ['M','Av','Tv','P','A','C1','C2','C3'].forEach((l,i)=>{const a=i/8*Math.PI*2;const t=document.createElement('span');t.textContent=l;t.style.cssText=`position:absolute;left:${26+Math.sin(a)*19}px;top:${26-Math.cos(a)*19}px;font:5px Arial;color:${l==='A'?'#9dbbab':'#d0d3cf'};transform:translate(-50%,-50%) rotate(${i*45}deg)`;modeFace.append(t);});
  face(mode,10,10,0,0,8.6,'','#24292c',5);
  const topLCD=face(world,65,42,70,-94,-22,'rotateX(90deg)','','4','eos-css-top-lcd');topLCD.innerHTML='125 F4.0<small>ISO 100 &nbsp; [99]</small>';
  const shutterGroup=part(world,127,-104,58,'rotateX(75deg)');
  cylinder(shutterGroup,22,8,0,0,0,{metal:false,count:40});
  cylinder(shutterGroup,18,6,0,0,6,{metal:true,count:40});
  const shutterFace=face(shutterGroup,35,35,0,0,9.5);shutterFace.removeAttribute('aria-hidden');
  const shutterButton=document.createElement('button');shutterButton.className='eos-css-shutter-hit';shutterButton.setAttribute('aria-label','Take photo with the camera shutter');shutterButton.title='Take a photo';shutterFace.append(shutterButton);
  shutterButton.addEventListener('pointerdown',e=>e.stopPropagation());shutterButton.addEventListener('click',e=>{e.stopPropagation();onShutter();});
  const controlWheel=part(world,127,-99,22,'rotateY(90deg)');cylinder(controlWheel,14,12,0,0,0,{ribs:true,count:30});
  for(let i=0;i<3;i++){const b=part(world,47+i*22,-94,-53,'rotateX(90deg)');cylinder(b,4.4,3,0,0,0,{count:14});}
  cuboid(world,48,6,43,-23,-152,-5,1,{top:'linear-gradient(100deg,#b9bdbc,#737b7c)'});
  cuboid(world,5,7,47,-46,-157,-5,1,{front:'#9ca4a4',top:'#b7bdbc',side:'#737b7c'});
  cuboid(world,5,7,47,0,-157,-5,1,{front:'#9ca4a4',top:'#b7bdbc',side:'#737b7c'});
  face(world,27,24,-23,-156,-9,'rotateX(90deg)','#161c1f',1);
  for(let i=0;i<3;i++)face(world,3,3,-31+i*8,-156.2,-9,'rotateX(90deg)','#b5a46d',2);

  // Rear panel: an actual canvas in 3D, fed by the same camera stream as the app.
  const screenFace=face(world,217,151,-29,12,-53,'rotateY(180deg)','','0','eos-css-rear-screen');
  const screen=document.createElement('canvas');screen.width=768;screen.height=512;screenFace.append(screen);const ctx=screen.getContext('2d');
  const rearWheel=face(world,48,48,115,19,-56,'rotateY(180deg)','','24','eos-css-wheel');
  for(let i=0;i<5;i++){const b=face(world,11,11,-147,-41+i*26,-55,'rotateY(180deg)','radial-gradient(circle at 35% 25%,#404548,#181d21 70%)',6);text(world,['▣','⌕','−','▶','▥'][i],12,10,-132,-41+i*26,-55.5,{rotation:'rotateY(180deg)',size:6,color:i===3?'#8eb0ce':'#adb4b7'});}
  for(const [x,y,r]of[[103,-48,8],[112,-16,7],[100,-69,7],[123,-68,7],[143,-68,6],[-104,-73,7],[-137,-73,7]])face(world,r*2,r*2,x,y,-54,'rotateY(180deg)','radial-gradient(circle at 30% 25%,#43494a,#171c1e 75%)',r);
  text(world,'MENU',22,7,-104,-87,-54,{rotation:'rotateY(180deg)',size:5,color:'#d1d3cd'});text(world,'INFO.',22,7,-137,-87,-54,{rotation:'rotateY(180deg)',size:5,color:'#d1d3cd'});
  text(world,'Q',10,10,103,-48,-55,{rotation:'rotateY(180deg)',size:6});
  cuboid(world,72,37,21,-24,-95,-58,7,{back:'#111719'});
  face(world,49,19,-24,-95,-69,'rotateY(180deg)','radial-gradient(ellipse at 35% 20%,#50656a,#16272e 65%,#0b1217)',5);
  face(world,45,92,-159,9,0,'rotateY(-90deg)','','0','eos-css-port').innerHTML='HDMI<br>USB<br>MIC';
  face(world,4,110,-159.7,10,3,'rotateY(-90deg)','#171c1e',2);
  for(const side of[-1,1]){cuboid(world,8,21,18,side*163,-51,2,3);const lug=face(world,8,19,side*170,-49,2,'rotateY(90deg)','linear-gradient(100deg,#899192,#20272a)',4);cuboid(world,6,43,13,side*171,-20,2,2);}
  for(const [x,y,z,rot]of[[-139,73,53,''],[147,75,80,''],[-140,76,-53,'rotateY(180deg)'],[146,76,-53,'rotateY(180deg)']]){const s=face(world,5,5,x,y,z,rot,'#4f5659',3);s.style.boxShadow='inset 0 0 0 1px #111';s.innerHTML='<span style="position:absolute;left:1px;right:1px;top:2px;height:1px;background:#12191c;transform:rotate(35deg)"></span>';}

  let yaw=-5,pitch=-3,zoomAmount=1,baseScale=1,auto=false,disposed=false,activeSource=null,lastVideo=0,lastTime=performance.now(),frame=0;
  let transition=null,lastEmittedPose=null;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const wrapDegrees=degrees=>((degrees+180)%360+360)%360-180;
  const cleanZero=value=>Math.abs(value)<1e-9?0:value;
  function getPose(){return {yaw:cleanZero(wrapDegrees(yaw+32)),pitch:cleanZero(pitch+16),zoom:zoomAmount};}
  function emitPose(){
    const pose=getPose();
    if(!lastEmittedPose||Math.abs(wrapDegrees(pose.yaw-lastEmittedPose.yaw))>.0001||Math.abs(pose.pitch-lastEmittedPose.pitch)>.0001||Math.abs(pose.zoom-lastEmittedPose.zoom)>.00001){
      lastEmittedPose=pose;onPoseChange({...pose});
    }
  }
  function transform(){
    // State itself is tweened, keeping pose callbacks in sync with visible geometry.
    world.style.transition='none';
    world.style.transform=`translate3d(22px,16px,0) scale(${baseScale*zoomAmount}) rotateX(${pitch}deg) rotateY(${yaw}deg)`;
    shadow.style.opacity=String(Math.min(1,1/zoomAmount));emitPose();
  }
  function advanceTransition(time){
    if(!transition)return;
    const t=Math.min(Math.max((time-transition.start)/700,0),1);
    const ease=t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
    yaw=transition.fromYaw+(transition.toYaw-transition.fromYaw)*ease;
    pitch=transition.fromPitch+(transition.toPitch-transition.fromPitch)*ease;
    zoomAmount=transition.fromZoom+(transition.toZoom-transition.fromZoom)*ease;
    if(t===1)transition=null;
    transform();
  }
  function resize(){baseScale=Math.min(host.clientWidth/580,host.clientHeight/400,1.3);transform();}
  const observer=new ResizeObserver(resize);observer.observe(host);resize();
  function standby(){ctx.fillStyle='#111b20';ctx.fillRect(0,0,768,512);ctx.strokeStyle='#24363c';ctx.lineWidth=1;for(let i=1;i<3;i++){ctx.beginPath();ctx.moveTo(i*256,0);ctx.lineTo(i*256,512);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i*512/3);ctx.lineTo(768,i*512/3);ctx.stroke();}ctx.strokeStyle='#73958d';ctx.lineWidth=3;ctx.strokeRect(316,174,136,136);ctx.fillStyle='#bdd0c8';ctx.textAlign='center';ctx.font='24px Arial';ctx.fillText('LIVE VIEW',384,389);ctx.font='15px Arial';ctx.fillStyle='#728e85';ctx.fillText('CONNECT YOUR CAMERA',384,426);ctx.font='19px monospace';ctx.textAlign='left';ctx.fillStyle='#b0c7be';ctx.fillText('M',24,33);ctx.fillText('BETH ELISE',24,465);ctx.font='11px monospace';ctx.fillText('PHOTOGRAPHY',24,486);ctx.font='19px monospace';ctx.textAlign='right';ctx.fillText('READY',742,33);ctx.fillText('00',742,484);}
  standby();
  const pointers=new Map();let drag=null,pinchDistance=0;
  function down(event){if(event.target.closest('button'))return;transition=null;auto=false;onInteraction();pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});stage.setPointerCapture(event.pointerId);if(pointers.size===1)drag={x:event.clientX,y:event.clientY,pitch,yaw};if(pointers.size===2){const a=[...pointers.values()];pinchDistance=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);}}
  function move(event){if(!pointers.has(event.pointerId))return;pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});if(pointers.size===2){const a=[...pointers.values()];const d=Math.hypot(a[0].x-a[1].x,a[0].y-a[1].y);if(pinchDistance)zoomAmount=Math.max(.6,Math.min(1.8,zoomAmount*d/pinchDistance));pinchDistance=d;}else if(drag){yaw=drag.yaw+(event.clientX-drag.x)*.42;pitch=Math.max(-65,Math.min(65,drag.pitch-(event.clientY-drag.y)*.35));}transform();}
  function up(event){pointers.delete(event.pointerId);if(pointers.size===1){const a=[...pointers.values()][0];drag={x:a.x,y:a.y,pitch,yaw};}else drag=null;pinchDistance=0;}
  function wheel(event){event.preventDefault();transition=null;auto=false;onInteraction();zoomAmount=Math.max(.6,Math.min(1.8,zoomAmount*Math.exp(-event.deltaY*.001)));transform();}
  stage.addEventListener('pointerdown',down);stage.addEventListener('pointermove',move);stage.addEventListener('pointerup',up);stage.addEventListener('pointercancel',up);stage.addEventListener('wheel',wheel,{passive:false});
  function drawLiveScreen(time){
    if(!activeSource||time-lastVideo<50)return;
    const {source}=activeSource;
    const isVideo=typeof source.videoWidth==='number';
    if(isVideo&&source.readyState<2)return;
    const sourceWidth=isVideo?source.videoWidth:source.width;
    const sourceHeight=isVideo?source.videoHeight:source.height;
    if(!sourceWidth||!sourceHeight)return;
    // Canvas frames are already processed by the capture pipeline.
    const filter=isVideo?activeSource.filter||'none':'none';
    const mirror=isVideo?Boolean(activeSource.mirror):false;
    ctx.save();ctx.filter='none';ctx.fillStyle='#101717';ctx.fillRect(0,0,768,512);
    const scale=Math.min(768/sourceWidth,512/sourceHeight),w=sourceWidth*scale,h=sourceHeight*scale;
    ctx.translate(mirror?768:0,0);ctx.scale(mirror?-1:1,1);ctx.filter=filter;
    ctx.drawImage(source,(768-w)/2,(512-h)/2,w,h);ctx.restore();
    ctx.fillStyle='#d6e7d6';ctx.textAlign='left';ctx.font='17px monospace';ctx.fillText('LIVE VIEW',20,30);
    ctx.fillStyle='#94c697';ctx.beginPath();ctx.arc(738,25,5,0,Math.PI*2);ctx.fill();lastVideo=time;
  }
  function render(time){
    if(disposed)return;
    const delta=Math.min(50,time-lastTime);lastTime=time;
    if(!document.hidden){
      if(transition)advanceTransition(time);
      if(auto&&!pointers.size){yaw+=delta*.006;transform();}
      if(Math.cos(yaw*Math.PI/180)<.25)drawLiveScreen(time);
    }
    frame=requestAnimationFrame(render);
  }
  frame=requestAnimationFrame(render);
  function setView(name='front',immediate=false){
    auto=false;
    const target={front:[-5,-3,1],back:[153,-13,1.02],detail:[-7,-7,1.25]}[name]||[-5,-3,1];
    const targetYaw=yaw+wrapDegrees(target[0]-yaw);
    if(immediate||reduced){transition=null;yaw=targetYaw;pitch=target[1];zoomAmount=target[2];transform();}
    else transition={start:performance.now(),fromYaw:yaw,fromPitch:pitch,fromZoom:zoomAmount,toYaw:targetYaw,toPitch:target[1],toZoom:target[2]};
  }
  return {
    ready:eyeReady,
    setView,getPose,reset(){setView('front');},
    zoom(factor){if(!Number.isFinite(factor)||factor<=0)return;transition=null;zoomAmount=Math.max(.6,Math.min(1.8,zoomAmount/factor));transform();},
    setAutoRotate(value){transition=null;auto=Boolean(value);},
    setLiveSource(source,options={}){activeSource=source?{...options,source}:null;lastVideo=-Infinity;if(source)drawLiveScreen(performance.now());else standby();},
    clearLiveSource(){activeSource=null;standby();},
    shutter(){flash.animate([{opacity:.85},{opacity:0}],{duration:230,easing:'ease-out'});shutterButton.animate([{filter:'brightness(.7)'},{filter:'brightness(1)'}],{duration:230});},
    dispose(){disposed=true;cancelAnimationFrame(frame);observer.disconnect();stage.remove();style.remove();if(previousRole)host.setAttribute('role',previousRole);else host.removeAttribute('role');}
  };
}
