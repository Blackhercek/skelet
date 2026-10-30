import {useEffect,useRef,type RefObject} from 'react';
import * as T from 'three';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {mergeGeometries} from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import {createExplosionLayout} from './explosion-layout';
import {chunkReceived,fetchChunk} from './model-cache';
import {PointerTap} from './pointer-tap';
import {SYSTEMS,isPartVisible,type Atlas,type FreeRect,type SceneState,type SystemId} from './anatomy';

/** What the page can ask of the scene. */
export interface SceneApi {capture:()=>HTMLCanvasElement|null}

interface Props {
 atlas:Atlas;state:SceneState;
 /** Filled in by the scene: take a picture of what is on screen. */
 apiRef:{current:SceneApi|null};
 /** Hide the name label (quiz mode). */
 showCallout:boolean;
 /** The part of the canvas not covered by panels. The body is framed inside it. */
 free:FreeRect;
 /** Element that follows the selected structure (label + leader line). */
 calloutRef:RefObject<HTMLDivElement|null>;
 onSelect:(id:string)=>void;onProgress:(n:number)=>void;onError:(s:string)=>void;
}
interface Framing {target:T.Vector3;position:T.Vector3}
interface ScreenTarget {index:number;x:number;y:number;left:number;right:number;top:number;bottom:number}

const BACKGROUND='#090c12';
const GHOST_ALPHA=.085;
const VIEW_DIRECTIONS:Record<string,[number,number,number]>={front:[0,.02,1],back:[0,.02,-1],side:[1,.02,0],'three-quarter':[.35,.06,1]};

export default function AnatomyScene({atlas,state,free,apiRef,showCallout,calloutRef,onSelect,onProgress,onError}:Props){
 const host=useRef<HTMLDivElement>(null),latest=useRef(state),latestFree=useRef(free),select=useRef(onSelect),callouts=useRef(showCallout);
 latest.current=state;latestFree.current=free;select.current=onSelect;callouts.current=showCallout;
 useEffect(()=>{
  const el=host.current!;
  let disposed=false,frame=0,dirty=true,ready=false,amount=0,lastExtent=-1,layoutKey='',packingWidth=1,packingHeight=1;
  let lastState:SceneState|null=null,lastViewKey='',lastSizeKey='',lastFocusKey='',selection=new Set<string>(),tween:{from:Framing;to:Framing;t:number}|null=null;
  let renderer:T.WebGLRenderer;
  try{renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});}catch{onError('Этот браузер не смог запустить 3D-просмотр. Попробуйте браузер с поддержкой WebGL.');return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,innerWidth<768?1.5:2));renderer.setClearColor(0x000000,0);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.05;
  el.appendChild(renderer.domElement);renderer.domElement.tabIndex=0;
  renderer.domElement.setAttribute('aria-label','Интерактивная анатомия человека. Перетаскивайте, чтобы вращать, прокручивайте или разводите пальцы, чтобы приблизить, и нажимайте на структуру, чтобы рассмотреть её.');
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(34,1,.005,100),controls=new OrbitControls(camera,renderer.domElement);
  camera.position.set(1.4,1.05,3.6);controls.target.set(0,.9,0);controls.enableDamping=true;controls.dampingFactor=.085;controls.minDistance=.07;controls.maxDistance=40;controls.maxPolarAngle=Math.PI*.96;
  controls.addEventListener('change',()=>{dirty=true;});controls.addEventListener('start',()=>{tween=null;});controls.listenToKeyEvents(renderer.domElement);
  const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment(),env=pmrem.fromScene(room,.04);scene.environment=env.texture;room.dispose();pmrem.dispose();
  scene.add(new T.HemisphereLight(0xdfe8ff,0x1a2030,.9));
  const key=new T.DirectionalLight(0xfff3e6,2.1);key.position.set(-2,4,3);scene.add(key);
  const rim=new T.DirectionalLight(0x8fb4ff,2.2);rim.position.set(2,2,-3);scene.add(rim);
  const fill=new T.DirectionalLight(0xffffff,.55);fill.position.set(3,.5,3);scene.add(fill);
  const stage:T.Object3D[]=[];
  const platform=new T.Mesh(new T.CylinderGeometry(.68,.7,.028,100),new T.MeshStandardMaterial({color:0x151b27,metalness:.35,roughness:.5}));platform.position.y=-.016;stage.push(platform);
  const ring=new T.Mesh(new T.RingGeometry(.63,.634,128),new T.MeshBasicMaterial({color:0x4f7cff,transparent:true,opacity:.55,side:T.DoubleSide}));ring.rotation.x=-Math.PI/2;ring.position.y=.001;stage.push(ring);
  const innerRing=new T.Mesh(new T.RingGeometry(.5,.501,128),new T.MeshBasicMaterial({color:0x4f7cff,transparent:true,opacity:.18,side:T.DoubleSide}));innerRing.rotation.x=-Math.PI/2;innerRing.position.y=.001;stage.push(innerRing);
  stage.forEach(o=>scene.add(o));
  // Per-piece state lives in two small GPU textures: offset + visibility, and selected + ghosted.
  const width=T.MathUtils.ceilPowerOfTwo(atlas.parts.length),data=new Float32Array(width*4),partTexture=new T.DataTexture(data,width,1,T.RGBAFormat,T.FloatType);partTexture.needsUpdate=true;
  const selectedData=new Uint8Array(width*4),selectionTexture=new T.DataTexture(selectedData,width,1);selectionTexture.needsUpdate=true;
  const materials:T.Material[]=[],geometries:T.BufferGeometry[]=[],pickers:(T.Mesh|undefined)[]=[];
  const centers=atlas.parts.map(p=>new T.Vector3().fromArray(p.bounds[0]).add(new T.Vector3().fromArray(p.bounds[1])).multiplyScalar(.5));
  const offsets:T.Vector3[]=[],bounds=atlas.parts.map(p=>new T.Box3(new T.Vector3().fromArray(p.bounds[0]),new T.Vector3().fromArray(p.bounds[1])));
  const markerPositions=new Float32Array(atlas.parts.length*3),markerGeometry=new T.BufferGeometry();markerGeometry.setAttribute('position',new T.BufferAttribute(markerPositions,3));
  const markerMaterial=new T.PointsMaterial({color:0x8fb0ff,size:5,sizeAttenuation:false,transparent:true,opacity:.75,depthTest:false});
  markerMaterial.onBeforeCompile=shader=>{shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\nif (distance(gl_PointCoord, vec2(0.5)) > 0.5) discard;');};
  const markers=new T.Points(markerGeometry,markerMaterial);markers.frustumCulled=false;markers.renderOrder=10;markers.visible=false;scene.add(markers);
  const hover=document.createElement('div');hover.className='part-hover';hover.setAttribute('role','tooltip');hover.hidden=true;el.appendChild(hover);
  let targets:ScreenTarget[]=[];
  const projected=new T.Vector3(),offset=new T.Vector3();
  const findTarget=(x:number,y:number,radius:number)=>{
   let best=-1,score=Infinity;
   for(const t of targets){const dx=Math.max(t.left-x,0,x-t.right),dy=Math.max(t.top-y,0,y-t.bottom),distance=Math.hypot(dx,dy);if(distance>radius)continue;const candidate=distance+Math.hypot(t.x-x,t.y-y)*.025;if(candidate<score){score=candidate;best=t.index;}}
   return best;
  };

  /** One material per system and pass. "solid" draws the normal pieces; "ghost" draws everything that is not selected as a faint x-ray. */
  const materialFor=(system:SystemId,pass:'solid'|'ghost')=>{
   const skin=system==='integumentary',ghost=pass==='ghost';
   const m=new T.MeshStandardMaterial({color:SYSTEMS.find(s=>s.id===system)?.color??'#aebbb8',metalness:.06,roughness:.5,envMapIntensity:.8,side:ghost?T.FrontSide:T.DoubleSide,transparent:ghost||skin,opacity:skin?.12:1,depthWrite:!ghost&&!skin});
   // The two passes share the same onBeforeCompile source text, so they need distinct program cache keys.
   m.customProgramCacheKey=()=>`atlas-${pass}`;
   m.onBeforeCompile=shader=>{
    shader.uniforms.partState={value:partTexture};shader.uniforms.selectionState={value:selectionTexture};shader.uniforms.stateWidth={value:width};shader.uniforms.ghostAlpha={value:GHOST_ALPHA};
    shader.vertexShader='attribute float partIndex; uniform sampler2D partState; uniform sampler2D selectionState; uniform float stateWidth; varying float partVisible; varying float partSelected; varying float partGhost;\n'+shader.vertexShader;
    shader.vertexShader=shader.vertexShader.replace('#include <begin_vertex>','#include <begin_vertex>\nvec2 stateUv = vec2((partIndex + 0.5) / stateWidth, 0.5); vec4 state = texture2D(partState, stateUv); transformed += state.xyz; partVisible = state.w; vec4 flags = texture2D(selectionState, stateUv); partSelected = flags.r; partGhost = flags.g;');
    shader.fragmentShader='varying float partVisible; varying float partSelected; varying float partGhost; uniform float ghostAlpha;\n'+shader.fragmentShader;
    shader.fragmentShader=shader.fragmentShader.replace('#include <clipping_planes_fragment>','#include <clipping_planes_fragment>\n'+(ghost?'if (partVisible < 0.5 || partGhost < 0.5) discard;':'if (partVisible < 0.5 || partGhost > 0.5) discard;'));
    shader.fragmentShader=shader.fragmentShader.replace('#include <color_fragment>','#include <color_fragment>\n'+(ghost?'diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.50, 0.60, 0.80), 0.6); diffuseColor.a = ghostAlpha;':'diffuseColor.rgb = mix(diffuseColor.rgb, vec3(0.97, 0.66, 0.93), partSelected * 0.88);'));
    if(!ghost)shader.fragmentShader=shader.fragmentShader.replace('#include <emissivemap_fragment>','#include <emissivemap_fragment>\ntotalEmissiveRadiance += vec3(0.20, 0.07, 0.19) * partSelected;');
   };materials.push(m);return m;
  };
  const solids=new Map(SYSTEMS.map(s=>[s.id,materialFor(s.id,'solid')])),ghosts=new Map(SYSTEMS.filter(s=>s.id!=='integumentary').map(s=>[s.id,materialFor(s.id,'ghost')]));
  const ghostMeshes:T.Mesh[]=[];
  const finished=new Set<number>(),sizeOf=(i:number)=>atlas.chunks[i].gzipBytes??atlas.chunks[i].bytes,totalSize=atlas.chunks.reduce((sum,_,i)=>sum+sizeOf(i),0);
  // Percentage of downloaded bytes: it moves smoothly, not one chunk at a time. 100 only once every chunk is built into the scene.
  const report=()=>{
   if(finished.size===atlas.chunks.length){onProgress(100);clearInterval(ticker);return;}
   let got=0;atlas.chunks.forEach((c,i)=>{got+=finished.has(i)?sizeOf(i):Math.min(chunkReceived(c),sizeOf(i));});
   onProgress(Math.min(99,Math.floor(got/totalSize*100)));
  };
  const ticker=setInterval(report,150);
  const loadChunk=async(ci:number)=>{
   const chunk=atlas.chunks[ci],buffer=await fetchChunk(chunk);if(disposed)return;
   const groups=new Map<string,T.BufferGeometry[]>();
   atlas.parts.forEach((p,i)=>{
    if(p.chunk!==ci)return;
    const g=new T.BufferGeometry();g.setAttribute('position',new T.BufferAttribute(new Float32Array(buffer,p.positions,p.vertexCount*3),3));
    // GPU normalized signed-short normals keep the complete atlas compact in memory.
    g.setAttribute('normal',new T.BufferAttribute(new Int16Array(buffer,p.normals,p.vertexCount*3),3,true));g.setIndex(new T.BufferAttribute(new Uint32Array(buffer,p.indices,p.indexCount),1));
    g.boundingBox=bounds[i].clone();g.computeBoundingSphere();const pick=new T.Mesh(g);pick.matrixAutoUpdate=false;pickers[i]=pick;geometries.push(g);
    g.setAttribute('partIndex',new T.BufferAttribute(new Float32Array(p.vertexCount).fill(i),1));
    const list=groups.get(p.system)??[];list.push(g);groups.set(p.system,list);
   });
   groups.forEach((gs,system)=>{
    const geometry=mergeGeometries(gs,false);if(!geometry)throw new Error('Не удалось собрать геометрию анатомии.');geometries.push(geometry);
    const mesh=new T.Mesh(geometry,solids.get(system as SystemId));mesh.frustumCulled=false;scene.add(mesh);
    const ghostMaterial=ghosts.get(system as SystemId);
    if(ghostMaterial){const ghost=new T.Mesh(geometry,ghostMaterial);ghost.frustumCulled=false;ghost.renderOrder=2;ghost.visible=ghostActive;scene.add(ghost);ghostMeshes.push(ghost);}
   });
   lastState=null;finished.add(ci);report();dirty=true;
  };
  let ghostActive=false;
  (async()=>{try{let cursor=0;await Promise.all(Array.from({length:3},async()=>{while(!disposed&&cursor<atlas.chunks.length){const i=cursor++;await loadChunk(i);}}));if(!disposed){ready=true;dirty=true;}}catch(e){if(!disposed)onError(e instanceof Error?e.message:'Не удалось загрузить анатомию.');}})();

  // ---- Camera framing -------------------------------------------------------------------------
  const freeBox=()=>{
   const w=el.clientWidth,h=el.clientHeight,f=latestFree.current;
   const left=T.MathUtils.clamp(f.left,0,Math.max(0,w-120)),right=T.MathUtils.clamp(f.right,left+120,w),top=T.MathUtils.clamp(f.top,0,Math.max(0,h-120)),bottom=T.MathUtils.clamp(f.bottom,top+120,h);
   return {w,h,left,right,top,bottom,aw:right-left,ah:bottom-top};
  };
  /** Shift the projection so the camera target appears in the centre of the free area. */
  const applyViewOffset=()=>{const b=freeBox();camera.setViewOffset(b.w,b.h,b.w/2-(b.left+b.right)/2,b.h/2-(b.top+b.bottom)/2,b.w,b.h);};
  const tanHalf=()=>Math.tan(T.MathUtils.degToRad(camera.fov/2));
  const distanceFor=(sizeX:number,sizeY:number,depth=0)=>{const b=freeBox();return Math.max(sizeY*b.h/b.ah,sizeX*b.w/b.aw/camera.aspect,depth)/(2*tanHalf());};
  const defaultFraming=(view:string,extent:number):Framing=>{
   if(extent>.8)view='front';
   const dir=new T.Vector3(...(VIEW_DIRECTIONS[view]??VIEW_DIRECTIONS.front)).normalize();
   const bodyDistance=distanceFor(1.05,2.05)*1.05,inventoryDistance=Math.max(.2,distanceFor(packingWidth*1.04,packingHeight*1.04));
   const distance=T.MathUtils.lerp(bodyDistance,inventoryDistance,extent),target=new T.Vector3(0,T.MathUtils.lerp(.9,.85,extent),0);
   return {target,position:target.clone().addScaledVector(dir,distance)};
  };
  const selectionBox=()=>{
   const box=new T.Box3(),part=new T.Box3(),shift=new T.Vector3();
   atlas.parts.forEach((p,i)=>{if(selection.has(p.id)){shift.set(data[i*4],data[i*4+1],data[i*4+2]);box.union(part.copy(bounds[i]).translate(shift));}});
   return box;
  };
  /** Bounds of everything that is currently shown (used to frame a body region). */
  const shownBox=()=>{
   const box=new T.Box3(),part=new T.Box3(),shift=new T.Vector3();
   atlas.parts.forEach((p,i)=>{if(data[i*4+3]>.5){shift.set(data[i*4],data[i*4+1],data[i*4+2]);box.union(part.copy(bounds[i]).translate(shift));}});
   return box;
  };
  const viewDirection=(view:string)=>new T.Vector3(...(VIEW_DIRECTIONS[view]??VIEW_DIRECTIONS.front)).normalize();
  const regionFraming=(view:string)=>boxFraming(shownBox(),viewDirection(view),1.2,.3);
  const boxFraming=(box:T.Box3,direction:T.Vector3,margin:number,minDistance:number):Framing=>{
   if(box.isEmpty())return defaultFraming(latest.current.view,0);
   const center=box.getCenter(new T.Vector3()),size=box.getSize(new T.Vector3());
   const distance=Math.max(minDistance,distanceFor(size.x,size.y,size.z)*margin);
   return {target:center,position:center.clone().addScaledVector(direction,distance)};
  };
  const applyFraming=(f:Framing)=>{applyViewOffset();controls.target.copy(f.target);camera.position.copy(f.position);controls.update();dirty=true;};
  const glideTo=(to:Framing)=>{applyViewOffset();tween={from:{target:controls.target.clone(),position:camera.position.clone()},to,t:0};};
  const resize=()=>{layoutKey='';lastState=null;renderer.setPixelRatio(Math.min(devicePixelRatio,el.clientWidth<768||el.clientHeight<600?1.5:2));camera.aspect=el.clientWidth/el.clientHeight;camera.updateProjectionMatrix();renderer.setSize(el.clientWidth,el.clientHeight);lastSizeKey='';dirty=true;};
  const observer=new ResizeObserver(resize);observer.observe(el);

  // ---- Picking --------------------------------------------------------------------------------
  const raycaster=new T.Raycaster(),pointer=new T.Vector2(),tap=new PointerTap(),worldBox=new T.Box3(),hitPoint=new T.Vector3();
  const down=(e:PointerEvent)=>{hover.hidden=true;tap.down(e.pointerId,e.clientX,e.clientY,e.pointerType==='touch'?12:5);};
  const move=(e:PointerEvent)=>{tap.move(e.pointerId,e.clientX,e.clientY);if(e.buttons||amount<.5||e.pointerType==='touch'){hover.hidden=true;return;}const rect=el.getBoundingClientRect(),x=e.clientX-rect.left,y=e.clientY-rect.top,index=findTarget(x,y,12);hover.hidden=index<0;renderer.domElement.style.cursor=index<0?'grab':'pointer';if(index>=0){hover.textContent=atlas.parts[index].name;hover.style.left=`${Math.max(8,Math.min(x+14,el.clientWidth-260))}px`;hover.style.top=`${Math.max(8,Math.min(y+18,el.clientHeight-55))}px`;}};
  const cancel=(e:PointerEvent)=>tap.cancel(e.pointerId);
  const leave=()=>{hover.hidden=true;};
  const up=(e:PointerEvent)=>{
   const validTap=tap.up(e.pointerId,e.clientX,e.clientY);if(!validTap||!ready||(e.pointerType==='mouse'&&e.button!==0))return;const rect=renderer.domElement.getBoundingClientRect();pointer.set((e.clientX-rect.left)/rect.width*2-1,-(e.clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
   let nearest=Infinity,found=-1;const hasSolid=atlas.parts.some((p,i)=>p.system!=='integumentary'&&data[i*4+3]>.5);
   pickers.forEach((mesh,i)=>{if(!mesh||data[i*4+3]<.5||(hasSolid&&atlas.parts[i].system==='integumentary'))return;if(clipOn&&clipPlane.distanceToPoint(clipCenter.copy(centers[i]).add(mesh.position))<0)return;worldBox.copy(bounds[i]).translate(mesh.position);if(!raycaster.ray.intersectBox(worldBox,hitPoint))return;const hits=raycaster.intersectObject(mesh,false);if(hits[0]&&hits[0].distance<nearest){nearest=hits[0].distance;found=i;}});
   if(found<0&&amount>.45)found=findTarget(e.clientX-rect.left,e.clientY-rect.top,e.pointerType==='touch'?24:16);if(found>=0){hover.hidden=true;select.current(atlas.parts[found].id);}
  };
  renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('pointerup',up);renderer.domElement.addEventListener('pointercancel',cancel);renderer.domElement.addEventListener('pointerleave',leave);

  // ---- Per-frame updates ----------------------------------------------------------------------
  const updateParts=(s:SceneState)=>{
   selection=new Set(s.selected);
   const shown=atlas.parts.map(p=>isPartVisible(p,s,selection)),visibleParts=atlas.parts.filter((_,i)=>shown[i]);
   const nextLayoutKey=visibleParts.map(p=>p.id).join(',')+':'+camera.aspect.toFixed(3);
   if(nextLayoutKey!==layoutKey){
    const layout=createExplosionLayout(visibleParts,camera.aspect);packingWidth=layout.width;packingHeight=layout.height;
    atlas.parts.forEach((p,i)=>{const cell=layout.cells.get(p.id);offsets[i]=cell?new T.Vector3(cell.x,cell.y+.85,0):centers[i].clone();});
    layoutKey=nextLayoutKey;if(amount>.05&&!s.isolate)lastSizeKey='';
   }
   ghostActive=s.selected.length>0&&!s.isolate;ghostMeshes.forEach(m=>{m.visible=ghostActive;});
   atlas.parts.forEach((p,i)=>{
    const c=centers[i],destination=offsets[i];let dx=0,dy=0,dz=0;
    const group=SYSTEMS.findIndex(sys=>sys.id===p.system),angle=group/SYSTEMS.length*Math.PI*2;
    if(amount<=.45){const t=amount/.45;dx=Math.sin(angle)*t*.48;dy=(c.y-.85)*t*.28;dz=Math.cos(angle)*t*.48;}
    else{const t=(amount-.45)/.55;dx=T.MathUtils.lerp(Math.sin(angle)*.48,destination.x-c.x,t);dy=T.MathUtils.lerp((c.y-.85)*.28,destination.y-c.y,t);dz=T.MathUtils.lerp(Math.cos(angle)*.48,-c.z,t);}
    const selected=selection.has(p.id);
    data.set([dx,dy,dz,shown[i]?1:0],i*4);selectedData[i*4]=selected?255:0;selectedData[i*4+1]=ghostActive&&shown[i]&&!selected?255:0;
    markerPositions.set(shown[i]?[c.x+dx,c.y+dy,c.z+dz]:[10000,10000,10000],i*3);
    const mesh=pickers[i];if(mesh){mesh.position.set(dx,dy,dz);mesh.updateMatrix();mesh.updateMatrixWorld(true);}
   });
   partTexture.needsUpdate=true;selectionTexture.needsUpdate=true;markerGeometry.attributes.position.needsUpdate=true;lastState=s;lastExtent=amount;dirty=true;
  };
  const updateScreenTargets=()=>{
   targets=[];if(amount<=.45)return;
   const hasSolid=atlas.parts.some((p,i)=>p.system!=='integumentary'&&data[i*4+3]>.5),w=el.clientWidth,h=el.clientHeight;
   atlas.parts.forEach((p,i)=>{
    if(data[i*4+3]<.5||(hasSolid&&p.system==='integumentary'))return;
    let left=Infinity,right=-Infinity,top=Infinity,bottom=-Infinity;
    for(let corner=0;corner<8;corner++){projected.set(p.bounds[(corner&1)?1:0][0]+data[i*4],p.bounds[(corner&2)?1:0][1]+data[i*4+1],p.bounds[(corner&4)?1:0][2]+data[i*4+2]).project(camera);const x=(projected.x+1)*w/2,y=(1-projected.y)*h/2;left=Math.min(left,x);right=Math.max(right,x);top=Math.min(top,y);bottom=Math.max(bottom,y);}
    projected.copy(centers[i]).add(offset.set(data[i*4],data[i*4+1],data[i*4+2])).project(camera);if(projected.z< -1||projected.z>1)return;
    targets.push({index:i,x:(projected.x+1)*w/2,y:(1-projected.y)*h/2,left,right,top,bottom});
   });
  };
  // ---- Section: one global clipping plane through the whole body ------------------------------
  const bodyBox=new T.Box3();bounds.forEach(b=>bodyBox.union(b));
  const clipPlane=new T.Plane(),clipCenter=new T.Vector3();let clipOn=false,lastSection:SceneState['section']=null;
  const applySection=(section:SceneState['section'])=>{
   lastSection=section;dirty=true;
   if(!section){renderer.clippingPlanes=[];clipOn=false;return;}
   const value=T.MathUtils.lerp(bodyBox.min[section.axis],bodyBox.max[section.axis],section.position),sign=section.flip?1:-1;
   clipPlane.normal.set(section.axis==='x'?sign:0,section.axis==='y'?sign:0,section.axis==='z'?sign:0);clipPlane.constant=-sign*value;
   renderer.clippingPlanes=[clipPlane];clipOn=true;
  };
  apiRef.current={capture:()=>{renderer.render(scene,camera);return renderer.domElement;}};
  const box=new T.Box3();
  const updateCallout=()=>{
   const c=calloutRef.current;if(!c)return;
   const s=latest.current,hide=()=>{c.style.opacity='0';};
   if(!s.selected.length||s.isolate||!ready||!callouts.current)return hide();
   box.copy(selectionBox());if(box.isEmpty())return hide();
   box.getCenter(projected).project(camera);
   const w=el.clientWidth,h=el.clientHeight,x=(projected.x+1)*w/2,y=(1-projected.y)*h/2;
   if(projected.z>1||x<8||x>w-8||y<8||y>h-8)return hide();
   c.style.transform=`translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0)`;c.dataset.side=x>Math.min(w*.5,330)?'left':'right';c.style.opacity='1';
  };
  const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches;
  const clock=new T.Clock(),ease=(t:number)=>t<.5?4*t*t*t:1-Math.pow(-2*t+2,3)/2;
  const animate=()=>{
   if(disposed)return;frame=requestAnimationFrame(animate);const dt=Math.min(clock.getDelta(),.05),s=latest.current,f=latestFree.current;
   const moving=Math.abs(amount-s.explode)>.0001;
   const section=s.section&&amount<.45?s.section:null;if(section!==lastSection)applySection(section);
   if(moving){amount=T.MathUtils.damp(amount,s.explode,8,dt);dirty=true;}
   const changed=lastState?.visible!==s.visible||lastState?.selected!==s.selected||lastState?.isolate!==s.isolate||lastState?.region!==s.region;
   if(changed||moving||lastExtent<0)updateParts(s);
   // ---- Camera: what the user asked for decides where the camera goes -------------------------
   const extent=Math.max(0,(amount-.3)/.7);
   const viewKey=s.view+':'+s.reset,sizeKey=[f.left,f.top,f.right,f.bottom,el.clientWidth,el.clientHeight].join();
   const focusKey=s.isolate?'iso:'+s.selected.join():s.selected.length&&amount<.45?'sel:'+s.selected.join():s.region&&amount<.45?'reg:'+s.region:'none';
   /** Framing for the current mode; `direction` null keeps the way the user is looking. */
   const framingFor=(direction:T.Vector3|null):Framing=>{
    const look=direction??camera.position.clone().sub(controls.target).normalize();
    if(s.isolate)return boxFraming(selectionBox(),look,1.35,.07);
    if(s.selected.length&&amount<.45)return boxFraming(selectionBox(),look,1.9,.45);
    if(s.region&&amount<.45)return boxFraming(shownBox(),look,1.2,.3);
    return defaultFraming(s.view,extent);
   };
   if(moving&&!s.isolate){
    // The user is dragging the spread slider: keep the whole picture in view.
    tween=null;lastFocusKey='';lastViewKey=viewKey;lastSizeKey=sizeKey;applyFraming(defaultFraming(amount>.5?'front':s.view,extent));
   }else if(!moving){
    if(viewKey!==lastViewKey){const first=lastViewKey==='';lastViewKey=viewKey;lastSizeKey=sizeKey;const next=framingFor(viewDirection(s.view));if(first)applyFraming(next);else glideTo(next);}
    else if(sizeKey!==lastSizeKey){lastSizeKey=sizeKey;const next=framingFor(null);if(tween){applyViewOffset();tween.to=next;}else applyFraming(next);}
    // Move the camera to what was selected, or back to the body when the selection is cleared.
    if(focusKey!==lastFocusKey&&ready){const was=lastFocusKey;lastFocusKey=focusKey;if(focusKey!=='none'||was)glideTo(framingFor(focusKey==='none'?viewDirection(s.view):null));}
   }
   if(tween){tween.t=Math.min(1,tween.t+dt/(reduceMotion?.01:.7));const k=ease(tween.t);controls.target.lerpVectors(tween.from.target,tween.to.target,k);camera.position.lerpVectors(tween.from.position,tween.to.position,k);if(tween.t>=1)tween=null;dirty=true;}
   controls.enableRotate=amount<.8;controls.mouseButtons.LEFT=amount<.8?T.MOUSE.ROTATE:T.MOUSE.PAN;controls.touches.ONE=amount<.8?T.TOUCH.ROTATE:T.TOUCH.PAN;
   platform.visible=ring.visible=innerRing.visible=amount<.5&&!s.isolate&&!s.region;markers.visible=amount>.75;
   controls.autoRotate=s.rotate&&!s.isolate&&amount<.4;controls.autoRotateSpeed=.65;controls.update();if(controls.autoRotate)dirty=true;
   if(dirty){renderer.render(scene,camera);updateScreenTargets();updateCallout();dirty=false;}
  };animate();
  const contextLost=(e:Event)=>{if(disposed)return;e.preventDefault();onError('Устройство приостановило 3D-сеанс. Перезагрузите страницу, чтобы продолжить.');};renderer.domElement.addEventListener('webglcontextlost',contextLost);
  return()=>{disposed=true;clearInterval(ticker);apiRef.current=null;renderer.clippingPlanes=[];renderer.domElement.removeEventListener('webglcontextlost',contextLost);cancelAnimationFrame(frame);observer.disconnect();controls.dispose();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());scene.traverse(o=>{if(o instanceof T.Mesh&&!geometries.includes(o.geometry)){o.geometry.dispose();const ms=Array.isArray(o.material)?o.material:[o.material];ms.forEach(m=>m.dispose());}});env.dispose();partTexture.dispose();selectionTexture.dispose();markerGeometry.dispose();markerMaterial.dispose();hover.remove();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();};
 },[atlas]);
 return <div className="scene" ref={host} style={{background:`radial-gradient(120% 90% at 38% 42%, #131a2a 0%, ${BACKGROUND} 62%)`}}/>;
}
