import * as THREE from 'three';
import { RoundedBoxGeometry } from './vendor/RoundedBoxGeometry.js';

// A dimensional interpretation of the supplied EOS / Sigma reference.
// The lens faces +Z; all parts stay in the same object for orbit inspection.
export function createCameraModel() {
  const group = new THREE.Group();
  group.name = 'Canon EOS camera';
  const lensGroup = new THREE.Group();
  lensGroup.position.set(-0.35, -0.07, 0);
  group.add(lensGroup);

  const texture = makeGrain();
  const paint = new THREE.MeshStandardMaterial({ color: 0x242527, roughness: 0.39, metalness: 0.28, bumpMap: texture, bumpScale: 0.018 });
  const rubber = new THREE.MeshStandardMaterial({ color: 0x18191b, roughness: 0.77, metalness: 0.04, bumpMap: texture, bumpScale: 0.033 });
  const softRubber = new THREE.MeshStandardMaterial({ color: 0x131416, roughness: 0.78, metalness: 0.02 });
  const blackMetal = new THREE.MeshStandardMaterial({ color: 0x17181a, roughness: 0.29, metalness: 0.68 });
  const darkMetal = new THREE.MeshStandardMaterial({ color: 0x303337, roughness: 0.3, metalness: 0.8 });
  const brushed = new THREE.MeshStandardMaterial({ color: 0x9b9e9e, roughness: 0.27, metalness: 0.9 });
  const screwMetal = new THREE.MeshStandardMaterial({ color: 0x414346, roughness: 0.25, metalness: 0.88 });
  const white = new THREE.MeshStandardMaterial({ color: 0xe5e4dd, roughness: 0.7 });
  const red = new THREE.MeshStandardMaterial({ color: 0xc92b27, roughness: 0.45, metalness: 0.18 });

  function add(geometry, material, x, y, z, parent = group) {
    const m = new THREE.Mesh(geometry, material);
    m.position.set(x, y, z);
    m.castShadow = true;
    m.receiveShadow = true;
    parent.add(m);
    return m;
  }
  function box(w, h, d, r, material, x, y, z, parent = group) {
    return add(new RoundedBoxGeometry(w, h, d, 4, r), material, x, y, z, parent);
  }
  function cylinder(radius, depth, material, x, y, z, parent = group, radiusBack = radius, openEnded = false) {
    const m = add(new THREE.CylinderGeometry(radius, radiusBack, depth, 96, 1, openEnded), material, x, y, z, parent);
    m.rotation.x = Math.PI / 2;
    return m;
  }
  function ring(radius, tube, material, z, parent = lensGroup) {
    return add(new THREE.TorusGeometry(radius, tube, 12, 128), material, 0, 0, z, parent);
  }
  function label(text, width, height, x, y, z, opts = {}) {
    const cnv = document.createElement('canvas');
    cnv.width = 1024; cnv.height = Math.max(128, Math.round(1024 * height / width));
    const ctx = cnv.getContext('2d');
    ctx.clearRect(0, 0, cnv.width, cnv.height);
    ctx.fillStyle = opts.color || '#e9e8e3';
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = `${opts.weight || '600'} ${Math.round(cnv.height * (opts.fontScale || 0.72))}px ${opts.font || 'Arial, sans-serif'}`;
    ctx.fillText(text, cnv.width / 2, cnv.height / 2, cnv.width * .98);
    const tex = new THREE.CanvasTexture(cnv); tex.colorSpace = THREE.SRGBColorSpace;
    const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false, opacity: opts.opacity ?? 1 });
    const mesh = add(new THREE.PlaneGeometry(width, height), mat, x, y, z, opts.parent || group);
    mesh.castShadow = false; mesh.receiveShadow = false;
    if (opts.rear) mesh.rotation.y = Math.PI;
    if (opts.top) mesh.rotation.x = -Math.PI / 2;
    return mesh;
  }

  // Main magnesium body, rear shell seam, and deeply textured hand grip.
  box(4.4, 2.4, 1.47, .23, paint, 0, -.03, -.02);
  box(4.31, 2.28, .26, .19, rubber, 0, -.04, -.72);
  box(4.18, .2, 1.33, .08, softRubber, 0, -1.22, -.01);
  box(1.04, 2.49, 1.84, .28, rubber, 1.64, -.04, .22);
  box(.84, 2.08, .34, .19, rubber, 1.8, -.13, 1.04);
  box(.28, 1.89, .7, .12, paint, -2.08, -.09, -.01);
  const fingerGroove = box(.13, 1.96, .16, .06, softRubber, 1.13, -.14, .83);
  fingerGroove.rotation.z = -.035;
  box(1.17, .17, 1.35, .07, blackMetal, 1.56, 1.19, .27);
  // The sloping pentaprism is the DSLR's defining silhouette.
  const prismShape = new THREE.Shape();
  prismShape.moveTo(-1.12, .81);
  prismShape.bezierCurveTo(-1.06, 1.01, -.99, 1.14, -.91, 1.28);
  prismShape.lineTo(-.76, 1.65);
  prismShape.quadraticCurveTo(-.7, 1.82, -.47, 1.83);
  prismShape.lineTo(.34, 1.83);
  prismShape.quadraticCurveTo(.53, 1.81, .6, 1.65);
  prismShape.lineTo(.78, 1.22);
  prismShape.quadraticCurveTo(.86, 1.04, .99, .83);
  prismShape.closePath();
  const prismGeo = new THREE.ExtrudeGeometry(prismShape, { depth: 1.28, bevelEnabled: true, bevelSegments: 5, steps: 1, bevelSize: .10, bevelThickness: .1, curveSegments: 20 });
  prismGeo.translate(-.22, 0, -.64);
  add(prismGeo, paint, 0, 0, 0);
  // Flash housing rim, with a separate front cap and fine seams.
  box(1.1, .18, 1.18, .07, paint, -.35, 1.73, -.01);
  label('Canon', 1.01, .36, -.35, 1.41, .83, {font: 'Georgia, serif', weight: 'bold', fontScale: .83});
  label('EOS', .44, .2, 1.06, .66, .77, {weight: '700'});
  label('5D', .34, .18, 1.055, .415, .79, {weight: '500'});
  label('Mark IV', .42, .105, 1.06, .26, .79, {color: '#a2a3a3', weight: '500'});

  // Lens mount, release button, and bayonet rings.
  cylinder(1.155, .11, darkMetal, -.35, -.07, .76);
  cylinder(1.085, .18, blackMetal, -.35, -.07, .89);
  ring(1.13, .024, brushed, .835);
  ring(1.06, .034, softRubber, .97);
  cylinder(.115, .10, softRubber, .95, -.36, .79);
  cylinder(.067, .025, paint, 1.02, -.82, .78);
  add(new THREE.SphereGeometry(.035, 16, 10), red, .48, .8, .85);
  box(.105, .08, .025, .006, white, -.35, 1.04, .85);

  // Short, wide, deeply ribbed Sigma prime lens, matching the reference.
  cylinder(.996, .57, paint, 0, 0, 1.24, lensGroup);
  cylinder(1.025, .1, softRubber, 0, 0, 1.53, lensGroup);
  cylinder(1.075, .19, blackMetal, 0, 0, 1.65, lensGroup);
  cylinder(1.105, .81, rubber, 0, 0, 2.13, lensGroup);
  cylinder(1.095, .13, blackMetal, 0, 0, 2.6, lensGroup);
  cylinder(1.155, .24, paint, 0, 0, 2.78, lensGroup, 1.095, true);
  cylinder(1.183, .09, blackMetal, 0, 0, 2.955, lensGroup, 1.183, true);
  add(new THREE.RingGeometry(1.008, 1.183, 128), blackMetal, 0, 0, 3.0, lensGroup);
  ring(1.175, .024, darkMetal, 2.985);
  ring(1.116, .021, softRubber, 2.96);
  ring(1.078, .017, darkMetal, 2.957);
  ring(1.025, .014, blackMetal, 2.94);
  ring(1.104, .014, darkMetal, 1.725);
  ring(1.104, .014, darkMetal, 2.535);
  ring(1.022, .008, brushed, 1.55);

  const ribGeo = new THREE.BoxGeometry(.016, .019, .772);
  const ribs = new THREE.InstancedMesh(ribGeo, rubber, 188);
  const dummy = new THREE.Object3D();
  for (let i = 0; i < 188; i++) {
    const a = i / 188 * Math.PI * 2;
    dummy.position.set(Math.cos(a) * 1.106, Math.sin(a) * 1.106, 2.13);
    dummy.rotation.set(0, 0, a - Math.PI / 2);
    dummy.updateMatrix(); ribs.setMatrixAt(i, dummy.matrix);
  }
  ribs.castShadow = true; ribs.receiveShadow = true;
  lensGroup.add(ribs);
  // Smaller knurling on the lens's rear collar.
  const rearRibs = new THREE.InstancedMesh(new THREE.BoxGeometry(.042, .035, .26), paint, 52);
  for (let i = 0; i < 52; i++) {
    const a = i / 52 * Math.PI * 2;
    dummy.position.set(Math.cos(a) * 1.003, Math.sin(a) * 1.003, 1.14);
    dummy.rotation.set(0, 0, a - Math.PI / 2); dummy.updateMatrix(); rearRibs.setMatrixAt(i, dummy.matrix);
  }
  rearRibs.castShadow = true; rearRibs.receiveShadow = true; lensGroup.add(rearRibs);
  // Distance window and AF/MF switch on the barrel's upper-left face.
  const distancePanel = box(.58, .035, .25, .018, blackMetal, 0, 1.014, 1.34, lensGroup);
  label('∞  5  2  1', .49, .1, 0, 1.04, 1.34, {top:true, parent:lensGroup, weight:'500', color:'#c6cfca'});
  label('SIGMA', .48, .15, -.1, 1.019, 1.57, {top:true, parent:lensGroup, weight:'700'});
  box(.18, .2, .29, .03, softRubber, -1.0, .0, 1.37, lensGroup);
  box(.07, .16, .11, .02, darkMetal, -1.105, .0, 1.34, lensGroup);
  const switchLabel = label('AF  MF', .34, .095, -1.04, .24, 1.38, {parent:lensGroup, color:'#cccac5'});
  switchLabel.rotation.y = -Math.PI / 2;
  label('50mm 1:1.4 DG', .67, .12, .0, -1.017, 1.39, {parent:lensGroup, color:'#b5b5b0'}).rotation.x = Math.PI / 2;

  // A real depth stack gives the glass reflections parallax while orbiting.
  const opticalBlack = new THREE.MeshStandardMaterial({color:0x020508, roughness:.19, metalness:.35});
  cylinder(1.008, .08, opticalBlack, 0, 0, 2.75, lensGroup);
  for (let i = 0; i < 7; i++) {
    const radius = .93 - i * .078;
    ring(radius, .012, i % 2 ? darkMetal : blackMetal, 2.937 - i * .021);
  }
  const iris = new THREE.Group(); iris.position.z = 2.856; lensGroup.add(iris);
  const bladeMaterial = new THREE.MeshStandardMaterial({color:0x293030, metalness:.8, roughness:.38});
  for (let i = 0; i < 9; i++) {
    const a = i * Math.PI * 2 / 9;
    const shape = new THREE.Shape();
    shape.moveTo(.21, -.065); shape.lineTo(.57, -.23); shape.lineTo(.67,.16); shape.lineTo(.35,.26); shape.closePath();
    const blade = new THREE.Mesh(new THREE.ShapeGeometry(shape), bladeMaterial);
    blade.rotation.z = a; blade.position.z = i * .0004; iris.add(blade);
  }
  const center = add(new THREE.CircleGeometry(.224, 9), new THREE.MeshBasicMaterial({color:0x020307}), 0, 0, 2.871, lensGroup);
  center.rotation.z = .16;
  const glassMat = new THREE.MeshPhysicalMaterial({ color:0x22353d, metalness:.63, roughness:.075, clearcoat:1, clearcoatRoughness:.04, transparent:true, opacity:.49, depthWrite:false, envMapIntensity:1.8 });
  const frontGlass = add(new THREE.CircleGeometry(.982, 128), glassMat, 0, 0, 2.96, lensGroup);
  frontGlass.castShadow = false;
  const glassInset = add(new THREE.CircleGeometry(.65, 96), new THREE.MeshPhysicalMaterial({color:0x352c48, metalness:.7, roughness:.09, clearcoat:1, transparent:true, opacity:.23, depthWrite:false}), 0, 0, 2.935, lensGroup);
  glassInset.castShadow = false;
  const opticalRing = new THREE.MeshBasicMaterial({color:0x2e7374, transparent:true, opacity:.34, depthWrite:false});
  ring(.71,.009,opticalRing,2.968);
  ring(.565,.007,new THREE.MeshBasicMaterial({color:0x70619d,transparent:true,opacity:.35,depthWrite:false}),2.969);
  // Subtle optical coating highlights, soft enough not to resemble flat stickers.
  const reflection = makeReflectionTexture();
  const refl = add(new THREE.PlaneGeometry(1.52,1.52), new THREE.MeshBasicMaterial({map:reflection,transparent:true,opacity:.55,depthWrite:false,toneMapped:false,blending:THREE.AdditiveBlending}), -.16,.08,2.976,lensGroup);
  refl.castShadow = false;
  const lensLettering = makeLensLettering();
  const lettering = add(new THREE.PlaneGeometry(2.37,2.37),new THREE.MeshBasicMaterial({map:lensLettering,transparent:true,depthWrite:false,toneMapped:false}),0,0,3.008,lensGroup);
  lettering.castShadow = false;

  // The supplied 4K iris is the only eye surface. Until it loads, show plain optical glass.
  const eyeDetails=new THREE.Group();eyeDetails.name="Lens eye";eyeDetails.visible=false;lensGroup.add(eyeDetails);
  eyeDetails.scale.setScalar(.58);eyeDetails.position.z=3.015*(1-.58);
  const scleraMaterial = new THREE.MeshPhysicalMaterial({color:0xc0c2ce, roughness:.3, metalness:0, clearcoat:.85, clearcoatRoughness:.08});
  const eyeball = add(new THREE.SphereGeometry(.985,64,40),scleraMaterial,0,0,3.015,eyeDetails);
  eyeball.scale.z=.22;
  const eyeIris = add(new THREE.CircleGeometry(.615,128),new THREE.MeshStandardMaterial({color:0xffffff,roughness:.36,metalness:0}),0,0,3.241,eyeDetails);
  eyeIris.name='Purple iris';
  const irisTint={value:new THREE.Color(0xffffff)},irisGrade={value:0};
  eyeIris.material.onBeforeCompile=shader=>{
    shader.uniforms.irisTint=irisTint;shader.uniforms.irisGrade=irisGrade;
    shader.fragmentShader='uniform vec3 irisTint; uniform float irisGrade;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>',`#include <color_fragment>
      float irisLuma=dot(diffuseColor.rgb,vec3(.2126,.7152,.0722));
      float irisMax=max(diffuseColor.r,max(diffuseColor.g,diffuseColor.b));
      float irisMin=min(diffuseColor.r,min(diffuseColor.g,diffuseColor.b));
      float irisSaturation=(irisMax-irisMin)/max(irisMax,.001);
      float keepCatchlight=smoothstep(.38,.8,irisLuma)*(1.0-smoothstep(.12,.38,irisSaturation));
      vec3 gradedIris=irisTint*irisLuma/max(dot(irisTint,vec3(.2126,.7152,.0722)),.04);
      gradedIris=mix(gradedIris,vec3(irisLuma),keepCatchlight);
      diffuseColor.rgb=mix(diffuseColor.rgb,gradedIris,irisGrade);`);
  };
  eyeIris.material.customProgramCacheKey=()=> 'uploaded-iris-color-grade-v1';
  const cornea=add(new THREE.SphereGeometry(.99,64,40),new THREE.MeshPhysicalMaterial({color:0xffffff,roughness:.025,metalness:0,clearcoat:1,clearcoatRoughness:.015,transmission:0,thickness:.035,ior:1.38,transparent:true,opacity:.08,depthWrite:false,envMapIntensity:1.25}),0,0,3.015,eyeDetails);
  cornea.scale.z=.285;cornea.castShadow=false;cornea.receiveShadow=false;cornea.renderOrder=9;cornea.name='Clear corneal dome';
  const lensOptics=add(new THREE.SphereGeometry(.995,64,40),new THREE.MeshPhysicalMaterial({color:0x183342,roughness:.025,metalness:.45,clearcoat:1,clearcoatRoughness:.02,transmission:0,thickness:.06,ior:1.48,transparent:true,opacity:.12,depthWrite:false,envMapIntensity:1.4}),0,0,3.025,lensGroup);
  lensOptics.scale.z=.20;lensOptics.castShadow=false;lensOptics.receiveShadow=false;lensOptics.renderOrder=10;lensOptics.name='Curved front optical glass';
  const opticalGlint=add(new THREE.TorusGeometry(.83,.012,8,72,Math.PI*.30),new THREE.MeshBasicMaterial({color:0xd9e5f5,transparent:true,opacity:.20,depthWrite:false,toneMapped:false}),0,0,3.223,lensGroup);
  opticalGlint.rotation.z=1.1;opticalGlint.castShadow=false;opticalGlint.renderOrder=11;
  let irisTexture=null,modelDisposed=false,irisSource='glass-only';
  const irisReady=new Promise(resolve=>{
    new THREE.TextureLoader().load(new URL('./assets/purple-iris-reference-4k.webp',import.meta.url).href,texture=>{
      if(modelDisposed){texture.dispose();resolve();return;}
      irisTexture=texture;texture.colorSpace=THREE.SRGBColorSpace;texture.anisotropy=4;
      eyeIris.material.map=texture;eyeIris.material.color.set(0xffffff);eyeIris.material.metalness=0;eyeIris.material.roughness=.36;eyeIris.material.alphaTest=.02;eyeIris.material.needsUpdate=true;
      eyeDetails.visible=true;
      irisSource='photographic';resolve();
    },undefined,()=>resolve());
  });

  // Clipped circular metal plates form lids without ever extending outside the lens.
  const upperClip=new THREE.Plane(new THREE.Vector3(0,1,0),-2);
  const lowerClip=new THREE.Plane(new THREE.Vector3(0,-1,0),-2);
  const lidMaterial=new THREE.MeshStandardMaterial({color:0x101116,roughness:.34,metalness:.62,clippingPlanes:[upperClip],clipShadows:true});
  const lowerLidMaterial=lidMaterial.clone();lowerLidMaterial.clippingPlanes=[lowerClip];
  const upperLid=add(new THREE.CircleGeometry(1.006,128),lidMaterial,0,0,3.305,eyeDetails);
  const lowerLid=add(new THREE.CircleGeometry(1.006,128),lowerLidMaterial,0,0,3.307,eyeDetails);
  upperLid.name='Upper mechanical eyelid';lowerLid.name='Lower mechanical eyelid';
  upperLid.castShadow=false;lowerLid.castShadow=false;

  // Mode dial and its engraved legend, with individually machined teeth.
  const modeDial = add(new THREE.CylinderGeometry(.395,.4,.20,64),blackMetal,-1.55,1.32,-.05);
  knurledDial(-1.55,1.33,-.05,.395,.18,56,darkMetal);
  add(new THREE.CylinderGeometry(.365,.365,.015,64),paint,-1.55,1.428,-.05);
  const dialLegend = makeDialTexture();
  const dialDisc = add(new THREE.CircleGeometry(.353,64),new THREE.MeshBasicMaterial({map:dialLegend,transparent:true}),-1.55,1.441,-.05);
  dialDisc.rotation.x = -Math.PI/2;
  add(new THREE.CylinderGeometry(.075,.075,.025,32),softRubber,-1.55,1.447,-.05);
  const modeIndex = add(new THREE.BoxGeometry(.028,.019,.10),white,-1.55,1.235,.46);
  // Shutter on the shoulder, accessible as a raycast target.
  const shutterGroup = new THREE.Group(); shutterGroup.position.set(1.63,1.2,.83); shutterGroup.rotation.x=.14; group.add(shutterGroup);
  add(new THREE.CylinderGeometry(.285,.30,.10,64),softRubber,0,0,0,shutterGroup);
  const shutter = add(new THREE.CylinderGeometry(.235,.25,.095,64),brushed,0,.075,0,shutterGroup);
  shutter.name = 'Take photo'; shutter.userData.action = 'shutter';
  const shutterCap = add(new THREE.CylinderGeometry(.187,.195,.035,64),paint,0,.129,0,shutterGroup);
  shutterCap.name='Take photo'; shutterCap.userData.action='shutter';
  const shutterTargets = [shutter,shutterCap];
  // Small top wheel immediately behind the shutter.
  add(new THREE.CylinderGeometry(.18,.18,.25,40),blackMetal,1.63,1.32,.30).rotation.z = Math.PI / 2;
  // Exposure readout on the upper shoulder.
  box(.85,.06,.56,.05,softRubber,.96,1.232,-.31);
  const topLCD = makeTopLCD();
  const lcd = add(new THREE.PlaneGeometry(.72,.43),new THREE.MeshBasicMaterial({map:topLCD}),.96,1.269,-.31);
  lcd.rotation.x=-Math.PI/2; lcd.castShadow=false;
  for(let i=0;i<3;i++) add(new THREE.CylinderGeometry(.065,.07,.045,24),softRubber,.64+i*.30,1.27,-.69);
  // Hotshoe and contacts.
  box(.66,.06,.62,.015,blackMetal,-.35,1.87,-.03);
  box(.60,.025,.52,.008,brushed,-.35,1.912,-.025);
  box(.07,.08,.65,.012,brushed,-.66,1.946,-.04);
  box(.07,.08,.65,.012,brushed,-.04,1.946,-.04);
  box(.41,.026,.33,.008,softRubber,-.35,1.936,-.12);
  const gold = new THREE.MeshStandardMaterial({color:0xcbb375,metalness:.9,roughness:.27});
  [[-.35,.07],[-.49,-.11],[-.35,-.17],[-.21,-.11]].forEach(([x,z])=>add(new THREE.SphereGeometry(.035,12,8),gold,x,1.96,z));

  // A compact physical speedlight is mounted on the existing hot shoe.
  box(.49,.36,.43,.055,blackMetal,-.35,2.12,-.04);
  box(.69,.22,.54,.07,paint,-.35,2.36,-.04);
  box(1.76,.76,.87,.12,paint,-.35,2.73,-.055);
  box(1.59,.57,.07,.055,softRubber,-.35,2.74,.405);
  const flashMaterial=new THREE.MeshStandardMaterial({color:0xc4c7d3,roughness:.32,metalness:.08,emissive:0xf2e9ff,emissiveIntensity:0});
  const flashWindow=box(1.42,.40,.032,.035,flashMaterial,-.35,2.77,.454);
  flashWindow.name='External flash diffuser';
  for(let i=0;i<9;i++)box(.013,.35,.012,.004,new THREE.MeshStandardMaterial({color:0xa9adb9,roughness:.55}),-.93+i*.145,2.77,.475);
  const flashLight=new THREE.PointLight(0xf1e8ff,0,5,2);
  flashLight.position.set(-.35,2.74,.85);group.add(flashLight);
  const flashGlowMaterial=new THREE.ShaderMaterial({
    uniforms:{strength:{value:0}},transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,
    vertexShader:'varying vec2 glowUV; void main(){glowUV=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}',
    fragmentShader:'varying vec2 glowUV; uniform float strength; void main(){vec2 p=(glowUV-.5)*2.0;float soft=pow(max(0.0,1.0-dot(p,p)),2.5);gl_FragColor=vec4(1.0,.94,1.0,soft*strength);}'
  });
  const flashGlow=add(new THREE.PlaneGeometry(2.7,1.35),flashGlowMaterial,-.35,2.77,.49);
  flashGlow.castShadow=false;flashGlow.receiveShadow=false;

  // Rear LCD and realistic rear controls. The screen map can become a VideoTexture.
  box(2.81,1.92,.14,.10,softRubber,-.58,-.17,-.844);
  box(2.60,1.72,.018,.05,blackMetal,-.58,-.11,-.923);
  const standbyTexture = makeStandbyScreen();
  const screenMaterial = new THREE.MeshBasicMaterial({map:standbyTexture,toneMapped:false});
  const screenMesh = add(new THREE.PlaneGeometry(2.43,1.62),screenMaterial,-.58,-.10,-.938);
  screenMesh.rotation.y=Math.PI; screenMesh.castShadow=false; screenMesh.receiveShadow=false;
  screenMesh.name='Live view LCD';
  label('Canon',.48,.14,-.58,-1.06,-.93,{rear:true,font:'Georgia, serif',weight:'bold'});
  box(1.08,.58,.32,.12,softRubber,-.36,1.19,-.85);
  box(.76,.30,.025,.07,blackMetal,-.36,1.21,-1.023);
  const viewfinderMat = new THREE.MeshPhysicalMaterial({color:0x1e3240,roughness:.12,metalness:.62,clearcoat:1});
  box(.55,.20,.013,.03,viewfinderMat,-.36,1.21,-1.043);
  // Rear buttons left of the LCD.
  const rearButton = (x,y,r=.085) => cylinder(r,.07,softRubber,x,y,-.879);
  rearButton(-1.57,1.01,.105); rearButton(-1.98,1.01,.105);
  label('MENU',.25,.08,-1.57,1.21,-.89,{rear:true,color:'#c2c3c4',weight:'500'});
  label('INFO.',.25,.08,-1.98,1.21,-.89,{rear:true,color:'#c2c3c4',weight:'500'});
  const sideIcons=['▣','⌕','−','▶','▥'];
  for(let i=0;i<5;i++) { rearButton(-2.06,.60-i*.35,.075); label(sideIcons[i],.14,.11,-1.87,.6-i*.35,-.884,{rear:true,color:i===3?'#87b2dc':'#babdbf'}); }
  rearButton(.97,.78,.09);
  label('Q',.11,.12,.97,.78,-.922,{rear:true});
  cylinder(.34,.095,blackMetal,1.18,-.18,-.887);
  const wheel = new THREE.Group(); wheel.position.set(1.18,-.18,-.951); wheel.rotation.x=Math.PI/2; group.add(wheel);
  const rearWheelKnurl = new THREE.InstancedMesh(new THREE.BoxGeometry(.022,.032,.055),darkMetal,48);
  for(let i=0;i<48;i++) {const a=i/48*Math.PI*2;dummy.position.set(Math.cos(a)*.327,0,Math.sin(a)*.327);dummy.rotation.set(0,-a,0);dummy.updateMatrix();rearWheelKnurl.setMatrixAt(i,dummy.matrix);}
  wheel.add(rearWheelKnurl);
  cylinder(.20,.035,paint,1.18,-.18,-.954);
  cylinder(.12,.035,softRubber,1.18,-.18,-.979);
  label('SET',.17,.08,1.18,-.18,-1.001,{rear:true,color:'#babdc0',weight:'500'});
  rearButton(1.04,.43,.10);
  rearButton(1.69,.92,.085);rearButton(1.95,.92,.085);
  label('AF-ON',.27,.09,1.39,1.12,-.84,{rear:true,color:'#bdbdbd',weight:'500'});
  rearButton(1.36,.93,.11);
  box(.65,.40,.16,.07,rubber,1.81,.43,-.83);
  box(.38,.13,.08,.025,softRubber,1.15,-.83,-.875);
  label('LOCK',.27,.08,1.15,-1.01,-.886,{rear:true,color:'#96999b',weight:'500'});
  const rearLED = add(new THREE.SphereGeometry(.029,12,8),new THREE.MeshBasicMaterial({color:0x64372b}),1.68,-.78,-.87);

  // Rubber port covers and structural seams at the left side.
  box(.07,1.37,.81,.04,rubber,-2.243,-.20,.01);
  const portLine = box(.018,1.24,.027,.006,blackMetal,-2.282,-.2,.04);
  box(.075,.21,.63,.018,paint,-2.245,.65,.0);
  for(const y of [.17,-.23,-.62]) { const l=label(y===.17?'HDMI':y===-.23?'USB':'MIC',.28,.085,-2.285,y,-.13,{color:'#55585b',weight:'600'});l.rotation.y=-Math.PI/2;}
  // Strap eyelets and black webbing tabs.
  for(const side of [-1,1]) {
    box(.15,.31,.29,.045,paint,side*2.18,.76,-.01);
    const lug=add(new THREE.TorusGeometry(.115,.036,12,32),brushed,side*2.27,.76,-.015);lug.rotation.y=Math.PI/2;
    const strap=box(.07,.63,.20,.035,rubber,side*2.30,.35,-.01);strap.rotation.z=side*.13;
    const keeper=box(.10,.12,.235,.025,blackMetal,side*2.32,.36,-.01);keeper.rotation.z=side*.13;
  }
  // Tiny screws, seam lines, and a tripod socket on the underside.
  for (const [x,y,z,rear] of [[-1.98,-1.03,.72,false],[2,-1.03,.9,false],[-1.93,-1.06,-.87,true],[1.98,-1.06,-.82,true],[-1.94,.91,.72,false]]) {
    cylinder(.045,.015,screwMetal,x,y,z);
    const slot=add(new THREE.BoxGeometry(.058,.010,.005),softRubber,x,y,z+(rear?-.011:.011));slot.rotation.z=.65;
  }
  const socket=add(new THREE.CylinderGeometry(.12,.12,.035,32),brushed,-.3,-1.338,.05);
  add(new THREE.CylinderGeometry(.075,.075,.041,32),blackMetal,-.3,-1.347,.05);
  box(1.2,.022,.7,.025,blackMetal,1.2,-1.329,.08);

  function knurledDial(x,y,z,radius,height,count,mat) {
    const teeth = new THREE.InstancedMesh(new THREE.BoxGeometry(.025,height,.025),mat,count);
    for(let i=0;i<count;i++){const a=i/count*Math.PI*2;dummy.position.set(x+Math.cos(a)*radius,y,z+Math.sin(a)*radius);dummy.rotation.set(0,-a,0);dummy.updateMatrix();teeth.setMatrixAt(i,dummy.matrix);}
    teeth.castShadow=true;teeth.receiveShadow=true;group.add(teeth);
  }
  let live=false,loaderMotion=false,loaderStarted=0,blink=0,flash=0,eyePhase='open',flashPeak=false;
  let shotCount=0,sequenceComplete=false,sequenceFinished=false,timingOffset=0,lastActualFlash=-Infinity,sequence=[];
  let eyeColor='purple',shotAim={yaw:0,pitch:0,roll:0,recoil:0};
  const shotPoses=[[-5,1.5,-.8],[5.5,-1.8,1.1],[-2.8,2.3,-1.2],[6,-1.1,.8],[-5.5,.6,-.7]];
  const colorNames=['purple','green','blue','brown','red'];
  const colorValues=['#8957bd','#328852','#2c58a9','#7b482c','#c51d2b'];
  function setIrisColor(index){eyeColor=colorNames[index];irisTint.value.set(colorValues[index]);irisGrade.value=index===0?0:1;}
  function newSequence(){
    let start=.30+Math.random()*.06;
    return Array.from({length:5},(_,index)=>{
      if(index)start+=.74+Math.random()*.14;
      const close=.10+Math.random()*.06,hold=.05+Math.random()*.02,open=.10+Math.random()*.08;
      return {start,close,hold,open,peak:start+close+hold/2,end:start+close+hold+open};
    });
  }
  const smooth=value=>{const t=Math.max(0,Math.min(1,value));return t*t*(3-2*t);};
  function setEyeFrame(closed,brightness,phase='open'){
    blink=closed;flash=brightness;
    eyePhase=phase;
    const gap=1.015-(1.035*closed);
    upperClip.constant=.07-gap*.58;lowerClip.constant=-.07-gap*.58;
    flashMaterial.emissiveIntensity=brightness*3.8;
    flashLight.intensity=brightness*2.2;
    flashGlowMaterial.uniforms.strength.value=brightness*.62;
  }
  setEyeFrame(0,0);
  return {
    group, shutterTargets, screenMesh, lensGroup,ready:irisReady,
    dispose(){modelDisposed=true;irisTexture?.dispose();},
    setLoaderMotion(enabled,time=performance.now()/1000){
      const next=Boolean(enabled);
      if(next&&!loaderMotion){
        loaderStarted=time;sequence=newSequence();timingOffset=0;lastActualFlash=-Infinity;
        shotCount=0;sequenceComplete=false;sequenceFinished=false;setIrisColor(0);
      }
      loaderMotion=next;
      if(!next){
        setEyeFrame(0,0);shotAim={yaw:0,pitch:0,roll:0,recoil:0};flashPeak=false;
        const justCompleted=!sequenceComplete;sequenceComplete=true;return justCompleted;
      }
      return false;
    },
    getLoaderState(){return {motion:loaderMotion,phase:eyePhase,flash:flash>.1,flashPeak,aim:shotAim,iris:irisSource,irisResolution:irisTexture?`${irisTexture.image.width}x${irisTexture.image.height}`:'',shotCount,color:eyeColor,sequenceComplete,sequenceFinished,shotTimes:sequence.map(shot=>Math.round(shot.peak*1000))};},
    setScreenTexture(next) {
      screenMaterial.map=next || standbyTexture;
      screenMaterial.needsUpdate=true;
      live=Boolean(next);
      rearLED.material.color.set(live?0x80ae8c:0x64372b);
    },
    animateShutter(progress) {
      const depression=Math.sin(Math.max(0,Math.min(1,progress))*Math.PI)*.065;
      shutter.position.y=.075-depression;
      shutterCap.position.y=.129-depression;
    },
    update(time) {
      flashPeak=false;sequenceFinished=false;
      if(live) rearLED.material.color.setRGB(.22,.49+.12*Math.sin(time*1.8),.31);
      if(loaderMotion&&!sequenceComplete){
        let elapsed=time-loaderStarted-timingOffset;
        const next=sequence[shotCount];
        if(next&&elapsed>=next.peak&&time-lastActualFlash>=.65){
          // A delayed frame shifts the remaining schedule instead of skipping a shot.
          const lateness=Math.max(0,elapsed-next.peak);
          if(lateness>.03){timingOffset+=lateness;elapsed-=lateness;}
          setIrisColor(shotCount);shotCount++;lastActualFlash=time;flashPeak=true;
        }
        let index=sequence.findIndex(shot=>elapsed<shot.end);
        if(index<0)index=4;
        const shot=sequence[index],phase=elapsed-shot.start;
        let closed=0,brightness=0,state='open';
        if(phase>=0&&phase<shot.close){closed=smooth(phase/shot.close);state='closing';}
        else if(phase>=shot.close&&phase<shot.close+shot.hold){closed=1;state='closed';}
        else if(phase>=shot.close+shot.hold&&phase<shot.close+shot.hold+shot.open){closed=1-smooth((phase-shot.close-shot.hold)/shot.open);state='opening';}
        const peakPhase=shot.close+shot.hold/2;
        if(phase>=shot.close&&phase<shot.close+shot.hold+.05)brightness=Math.exp(-Math.pow((phase-peakPhase)/.035,2));
        if(flashPeak){closed=1;brightness=1;state='closed';}
        setEyeFrame(closed,brightness,state);
        const previous=index===0?[0,0,0]:shotPoses[index-1];
        const from=elapsed<shot.start?previous:shotPoses[index];
        const to=shotPoses[index];
        const gapStart=index===0?0:sequence[index-1].end;
        const blend=elapsed<shot.start?smooth((elapsed-gapStart)/(shot.start-gapStart)):1;
        const angle=i=>(from[i]+(to[i]-from[i])*blend)*Math.PI/180;
        shotAim={yaw:angle(0),pitch:angle(1),roll:angle(2),recoil:brightness};
        if(shotCount===5&&elapsed>=sequence[4].end){
          setEyeFrame(0,0);shotAim.recoil=0;sequenceComplete=true;sequenceFinished=true;
        }
      }
    }

  };
}

function makeGrain() {
  const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;
  const ctx=canvas.getContext('2d');const image=ctx.createImageData(256,256);
  let seed=23783;
  const random=()=>{seed=(seed*1664525+1013904223)>>>0;return seed/4294967296;};
  for(let i=0;i<image.data.length;i+=4){const v=80+Math.floor(random()*115);image.data[i]=v;image.data[i+1]=v;image.data[i+2]=v;image.data[i+3]=255;}
  ctx.putImageData(image,0,0);
  for(let i=0;i<1450;i++){const x=random()*256,y=random()*256,r=.3+random()*1.2;ctx.fillStyle=`rgba(0,0,0,${.15+random()*.25})`;ctx.beginPath();ctx.arc(x,y,r,0,Math.PI*2);ctx.fill();}
  const tex=new THREE.CanvasTexture(canvas);tex.wrapS=tex.wrapT=THREE.RepeatWrapping;tex.repeat.set(3,3);return tex;
}

function makeLensLettering() {
  const c=document.createElement('canvas');c.width=c.height=1024;const ctx=c.getContext('2d');
  ctx.fillStyle='#b9bcb9';ctx.font='500 30px Arial, sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';
  function arc(text,centerAngle,rad,reverse=false){
    const widths=[...text].map(ch=>ctx.measureText(ch).width+3);const total=widths.reduce((a,b)=>a+b,0);let a=centerAngle-(reverse?-1:1)*total/rad/2;
    [...text].forEach((ch,i)=>{a+=(reverse?-1:1)*widths[i]/rad/2;ctx.save();ctx.translate(512+Math.cos(a)*rad,512+Math.sin(a)*rad);ctx.rotate(a+(reverse?-Math.PI/2:Math.PI/2));ctx.fillText(ch,0,0);ctx.restore();a+=(reverse?-1:1)*widths[i]/rad/2;});
  }
  arc('SIGMA  50mm  1:1.4  DG  HSM',-Math.PI/2,461);
  ctx.font='400 26px Arial, sans-serif';arc('Ø77  •  LENS MADE IN JAPAN',Math.PI/2,461,true);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;t.anisotropy=8;return t;
}

function makeReflectionTexture() {
  const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d');
  ctx.save();ctx.translate(190,150);ctx.rotate(-.65);ctx.scale(1,.38);const g=ctx.createRadialGradient(0,0,0,0,0,108);g.addColorStop(0,'rgba(177,211,220,.65)');g.addColorStop(.35,'rgba(132,182,198,.34)');g.addColorStop(1,'rgba(74,125,166,0)');ctx.fillStyle=g;ctx.fillRect(-150,-150,300,300);ctx.restore();
  const g2=ctx.createRadialGradient(353,350,0,353,350,80);g2.addColorStop(0,'rgba(116,94,170,.22)');g2.addColorStop(1,'rgba(40,10,80,0)');ctx.fillStyle=g2;ctx.fillRect(260,260,170,170);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}

function makeDialTexture() {
  const c=document.createElement('canvas');c.width=c.height=512;const ctx=c.getContext('2d');
  ctx.fillStyle='#d3d4d1';ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='500 47px Arial, sans-serif';
  ['M','Av','Tv','P','A','C1','C2','C3'].forEach((s,i)=>{const a=i/8*Math.PI*2-Math.PI/2;ctx.save();ctx.translate(256+Math.cos(a)*172,256+Math.sin(a)*172);ctx.rotate(a+Math.PI/2);ctx.fillStyle=s==='A'?'#88b59a':'#d3d4d1';ctx.fillText(s,0,0);ctx.restore();});
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}

function makeTopLCD() {
  const c=document.createElement('canvas');c.width=512;c.height=300;const ctx=c.getContext('2d');
  ctx.fillStyle='#6c7773';ctx.fillRect(0,0,512,300);ctx.fillStyle='#1d2927';ctx.font='500 82px monospace';ctx.fillText('125  F4.0',22,110);ctx.font='500 35px monospace';ctx.fillText('ISO 100     [99]',24,180);ctx.font='500 30px monospace';ctx.fillText('−2···1···0···1···2+',20,249);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}

function makeStandbyScreen() {
  const c=document.createElement('canvas');c.width=900;c.height=600;const ctx=c.getContext('2d');
  const g=ctx.createLinearGradient(0,0,900,600);g.addColorStop(0,'#142329');g.addColorStop(1,'#090e12');ctx.fillStyle=g;ctx.fillRect(0,0,900,600);
  ctx.strokeStyle='rgba(176,211,209,.11)';ctx.lineWidth=1;for(let i=1;i<3;i++){ctx.beginPath();ctx.moveTo(i*300,0);ctx.lineTo(i*300,600);ctx.stroke();ctx.beginPath();ctx.moveTo(0,i*200);ctx.lineTo(900,i*200);ctx.stroke();}
  ctx.strokeStyle='#6a8f8a';ctx.lineWidth=3;const cx=450,cy=265,w=100;for(const [sx,sy]of[[-1,-1],[1,-1],[-1,1],[1,1]]){ctx.beginPath();ctx.moveTo(cx+sx*w,cy+sy*(w-24));ctx.lineTo(cx+sx*w,cy+sy*w);ctx.lineTo(cx+sx*(w-24),cy+sy*w);ctx.stroke();}
  ctx.fillStyle='#baccc7';ctx.textAlign='center';ctx.font='400 28px Arial, sans-serif';ctx.fillText('LIVE VIEW',450,442);ctx.fillStyle='#647d78';ctx.font='400 21px Arial, sans-serif';ctx.fillText('CONNECT YOUR CAMERA',450,482);
  ctx.fillStyle='#9eb6af';ctx.textAlign='left';ctx.font='500 23px monospace';ctx.fillText('M',29,43);ctx.fillText('BETH ELISE',29,546);ctx.font='500 13px monospace';ctx.fillText('PHOTOGRAPHY',29,569);ctx.textAlign='right';ctx.font='500 23px monospace';ctx.fillText('READY',869,43);ctx.fillText('00',869,569);
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
