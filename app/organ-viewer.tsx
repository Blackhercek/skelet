import {useCallback,useEffect,useMemo,useRef,useState,type CSSProperties} from 'react';
import * as T from 'three';
import {ArrowLeft,Eye,EyeOff,RotateCcw,RotateCw,Pause} from 'lucide-react';
import {OrbitControls} from 'three/examples/jsm/controls/OrbitControls.js';
import {RoomEnvironment} from 'three/examples/jsm/environments/RoomEnvironment.js';
import {fetchChunk,fetchJson} from './model-cache';
import {NAMES_URL,russianName,type NameDict} from './localize';
import {PointerTap} from './pointer-tap';
import {OrganIcon} from './icons';
import {useFocusTrap} from './focus';
import {ORGANS,ORGANS_URL,ORGAN_BY_ID,displayName,type Hotspot,type OrganDef,type OrganId,type OrganPack} from './organs';

interface Props {organ:OrganId;onClose:()=>void;onSwitch:(organ:OrganId)=>void}
interface Marker {hotspot:Hotspot;group:string;position:T.Vector3;normal:T.Vector3;meshes:T.Mesh[]}
interface Info {kind:'hotspot'|'part';id:string;title:string;text:string;color:string}

/** Groups that hide an inside structure while they are visible. */
const COVERS:Record<OrganId,Record<string,string[]>>={
 lungs:{},
 heart:{inner:['muscle']},
 brain:{deep:['frontal','parietal','temporal','occipital','limbic']},
};

export default function OrganViewer({organ,onClose,onSwitch}:Props){
 const def=ORGAN_BY_ID[organ],host=useRef<HTMLDivElement>(null),layer=useRef<HTMLDivElement>(null),card=useRef<HTMLDivElement>(null),root=useRef<HTMLDivElement>(null),backButton=useRef<HTMLButtonElement>(null);
 useFocusTrap(root,backButton);
 const [status,setStatus]=useState<'loading'|'ready'|'error'>('loading'),[error,setError]=useState('');
 const [hidden,setHidden]=useState<Set<string>>(new Set()),[info,setInfo]=useState<Info|null>(null),[rotate,setRotate]=useState(false),[labels,setLabels]=useState(true);
 const [markerList,setMarkerList]=useState<{id:string;title:string;color:string;group:string}[]>([]);
 const api=useRef<{reset:()=>void;refresh:()=>void;focus:(id:string)=>void;select:(id:string|null)=>void;setHidden:(h:Set<string>)=>void;setRotate:(r:boolean)=>void}|null>(null);
 const pendingFocus=useRef<string|null>(null);
 const hiddenRef=useRef(hidden);hiddenRef.current=hidden;
 const labelsRef=useRef(labels);labelsRef.current=labels;

 // New organ: show every layer again and clear the card.
 useEffect(()=>{setHidden(new Set());setInfo(null);setStatus('loading');setError('');setMarkerList([]);},[organ]);

 useEffect(()=>{
  const el=host.current!;let disposed=false,frame=0,dirty=true;
  let renderer:T.WebGLRenderer;
  try{renderer=new T.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});}catch{setError('Этот браузер не смог запустить 3D-просмотр. Попробуйте браузер с поддержкой WebGL.');setStatus('error');return;}
  renderer.setPixelRatio(Math.min(devicePixelRatio,2));renderer.setClearColor(0x000000,0);renderer.outputColorSpace=T.SRGBColorSpace;renderer.toneMapping=T.ACESFilmicToneMapping;renderer.toneMappingExposure=1.0;
  el.appendChild(renderer.domElement);renderer.domElement.tabIndex=0;renderer.domElement.setAttribute('aria-label',`Интерактивная 3D-модель: ${def.name.toLowerCase()}. Перетаскивайте, чтобы вращать, прокручивайте или разводите пальцы, чтобы приблизить, и нажимайте на метки, чтобы узнать о структуре.`);
  const scene=new T.Scene(),camera=new T.PerspectiveCamera(32,1,.002,20),controls=new OrbitControls(camera,renderer.domElement);
  controls.enableDamping=true;controls.dampingFactor=.09;controls.enablePan=false;controls.autoRotateSpeed=.8;
  controls.addEventListener('change',()=>{dirty=true;});
  const pmrem=new T.PMREMGenerator(renderer),room=new RoomEnvironment(),env=pmrem.fromScene(room,.04);scene.environment=env.texture;room.dispose();pmrem.dispose();
  scene.add(new T.HemisphereLight(0xdfe8ff,0x1a1520,.7));
  const key=new T.DirectionalLight(0xfff1e0,2.2);key.position.set(-1.5,2,3);scene.add(key);
  const rim=new T.DirectionalLight(0x7aa6ff,2.4);rim.position.set(2.5,1,-2.5);scene.add(rim);
  const fill=new T.DirectionalLight(0xffe4e0,.8);fill.position.set(2.5,-.5,2);scene.add(fill);
  const root=new T.Group();scene.add(root);
  const meshes:T.Mesh[]=[],byGroup=new Map<string,T.Mesh[]>(),markers:Marker[]=[];
  const geometries:T.BufferGeometry[]=[],materials:T.MeshPhysicalMaterial[]=[];
  let radius=1,home:{position:T.Vector3;target:T.Vector3}|null=null,tween:{from:T.Vector3;to:T.Vector3;t:number}|null=null,selectedId:string|null=null,ready=false;
  const raycaster=new T.Raycaster(),pointer=new T.Vector2(),tap=new PointerTap(),tooltip=document.createElement('div');
  tooltip.className='part-hover';tooltip.hidden=true;tooltip.setAttribute('role','tooltip');el.appendChild(tooltip);
  controls.addEventListener('start',()=>{tween=null;});controls.listenToKeyEvents(renderer.domElement);

  /** The part of the screen between the title bar and the layer chips; the organ is centred and fitted inside it. */
  const freeBox=()=>{
   const w=el.clientWidth,h=el.clientHeight,bar=document.querySelector('.organ-bar')?.getBoundingClientRect(),foot=document.querySelector('.organ-footer')?.getBoundingClientRect();
   const top=Math.min(h*.4,(bar?.bottom??0)+6),bottom=Math.max(h*.6,(foot?.top??h)-6);
   return {w,h,top,bottom,ah:bottom-top};
  };
  const applyViewOffset=()=>{const b=freeBox();camera.setViewOffset(b.w,b.h,0,b.h/2-(b.top+b.bottom)/2,b.w,b.h);};
  const homeDistance=()=>{const b=freeBox(),t=Math.tan(T.MathUtils.degToRad(camera.fov/2));return Math.max(radius*(b.h/b.ah)/t,radius/(t*camera.aspect))*1.02;};
  const frameHome=(animate:boolean)=>{
   const dir=new T.Vector3(...def.view).normalize(),to=dir.multiplyScalar(homeDistance());
   controls.minDistance=radius*.9;controls.maxDistance=radius*9;controls.target.set(0,0,0);applyViewOffset();
   if(animate){tween={from:camera.position.clone(),to,t:0};}else{camera.position.copy(to);controls.update();}
   dirty=true;
  };
  let lastW=0,lastH=0;
  const resize=()=>{const w=el.clientWidth,h=el.clientHeight;if(!w||!h)return;const changed=w!==lastW||h!==lastH;lastW=w;lastH=h;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);dirty=true;applyViewOffset();if(ready&&changed)frameHome(false);};

  const visibleMeshes=()=>meshes.filter(m=>m.visible);
  const applyHighlight=()=>{
   const marker=markers.find(m=>m.hotspot.id===selectedId),mine=new Set(marker?.meshes);
   meshes.forEach(m=>{const mat=m.material as T.MeshPhysicalMaterial,on=mine.has(m);mat.emissive.set(on?0x7a3a55:0x000000);mat.emissiveIntensity=on?.55:0;});
   dirty=true;
  };
  const isCovered=(m:Marker)=>(COVERS[organ][m.group]??[]).some(g=>!hiddenRef.current.has(g));
  const place=()=>{
   const w=el.clientWidth,h=el.clientHeight,view=new T.Vector3(),p=new T.Vector3();
   markers.forEach(m=>{
    const b=layer.current?.querySelector<HTMLButtonElement>(`[data-id="${m.hotspot.id}"]`);if(!b)return;
    const off=hiddenRef.current.has(m.group);
    p.copy(m.position).applyMatrix4(root.matrixWorld);view.copy(camera.position).sub(p).normalize();
    const facing=view.dot(m.normal.clone().transformDirection(root.matrixWorld));
    p.project(camera);
    const x=(p.x+1)*w/2,y=(1-p.y)*h/2,behind=facing<.04,inside=isCovered(m);
    b.style.transform=`translate3d(${x.toFixed(1)}px,${y.toFixed(1)}px,0) translate(-50%,-50%)`;
    b.dataset.state=off?'off':behind?'behind':inside?'inside':'front';
    b.hidden=!labelsRef.current&&selectedId!==m.hotspot.id;
    if(selectedId===m.hotspot.id&&card.current){
     const c=card.current,cw=c.offsetWidth,ch=c.offsetHeight;
     c.style.transform=`translate3d(${Math.max(12,Math.min(x-cw/2,w-cw-12)).toFixed(1)}px,${Math.max(72,Math.min(y-ch-26,h-ch-12)).toFixed(1)}px,0)`;
    }
   });
  };
  const reduceMotion=matchMedia('(prefers-reduced-motion: reduce)').matches,clock=new T.Clock();
  const loop=()=>{
   if(disposed)return;frame=requestAnimationFrame(loop);const dt=Math.min(clock.getDelta(),.05);
   if(tween){tween.t=Math.min(1,tween.t+dt/(reduceMotion?.01:.6));const k=tween.t<.5?4*tween.t**3:1-Math.pow(-2*tween.t+2,3)/2;const len=T.MathUtils.lerp(tween.from.length(),tween.to.length(),k);camera.position.copy(tween.from.clone().normalize().lerp(tween.to.clone().normalize(),k).normalize().multiplyScalar(len));if(tween.t>=1)tween=null;dirty=true;}
   controls.update();
   if(controls.autoRotate)dirty=true;
   if(dirty){renderer.render(scene,camera);if(ready)place();dirty=false;}
  };

  // ---- Interaction ----------------------------------------------------------------------------
  const pick=(clientX:number,clientY:number)=>{
   const rect=renderer.domElement.getBoundingClientRect();pointer.set((clientX-rect.left)/rect.width*2-1,-(clientY-rect.top)/rect.height*2+1);raycaster.setFromCamera(pointer,camera);
   return raycaster.intersectObjects(visibleMeshes(),false)[0];
  };
  const down=(e:PointerEvent)=>{tooltip.hidden=true;tap.down(e.pointerId,e.clientX,e.clientY,e.pointerType==='touch'?12:5);};
  let lastHover=0;
  const move=(e:PointerEvent)=>{
   tap.move(e.pointerId,e.clientX,e.clientY);
   if(e.buttons||e.pointerType==='touch'||!ready){tooltip.hidden=true;return;}
   const now=performance.now();if(now-lastHover<70)return;lastHover=now;
   const hit=pick(e.clientX,e.clientY),rect=el.getBoundingClientRect();
   tooltip.hidden=!hit;renderer.domElement.style.cursor=hit?'pointer':'grab';
   if(hit){tooltip.textContent=displayName(hit.object.userData.name as string);tooltip.style.left=`${Math.max(8,Math.min(e.clientX-rect.left+14,el.clientWidth-260))}px`;tooltip.style.top=`${Math.max(8,Math.min(e.clientY-rect.top+18,el.clientHeight-55))}px`;}
  };
  const cancel=(e:PointerEvent)=>tap.cancel(e.pointerId);
  const leave=()=>{tooltip.hidden=true;};
  const up=(e:PointerEvent)=>{
   if(!tap.up(e.pointerId,e.clientX,e.clientY)||!ready||(e.pointerType==='mouse'&&e.button!==0))return;
   const hit=pick(e.clientX,e.clientY);if(!hit){api.current?.select(null);return;}
   const id=hit.object.userData.id as string,marker=markers.find(m=>m.hotspot.match.test(id));
   if(marker)api.current?.select(marker.hotspot.id);else{api.current?.select(null);setInfo({kind:'part',id,title:displayName(hit.object.userData.name as string),text:'',color:'#8fb0ff'});}
  };
  renderer.domElement.addEventListener('pointerdown',down);renderer.domElement.addEventListener('pointermove',move);renderer.domElement.addEventListener('pointerup',up);renderer.domElement.addEventListener('pointercancel',cancel);renderer.domElement.addEventListener('pointerleave',leave);
  const contextLost=(e:Event)=>{if(disposed)return;e.preventDefault();setError('Устройство приостановило 3D-сеанс. Перезагрузите страницу, чтобы продолжить.');setStatus('error');};renderer.domElement.addEventListener('webglcontextlost',contextLost);
  const observer=new ResizeObserver(resize);observer.observe(el);document.querySelectorAll('.organ-bar,.organ-footer').forEach(n=>observer.observe(n));

  const focusMarker=(m:Marker)=>{
   const world=m.position.clone().applyMatrix4(root.matrixWorld),normal=m.normal.clone().transformDirection(root.matrixWorld),toCamera=camera.position.clone().sub(world).normalize();
   if(toCamera.dot(normal)<.35){const len=camera.position.length(),dir=normal.clone().lerp(new T.Vector3(0,.15,0),.2).normalize().multiplyScalar(len);tween={from:camera.position.clone(),to:dir,t:0};}
  };
  api.current={
   reset:()=>{setInfo(null);selectedId=null;applyHighlight();frameHome(true);},
   refresh:()=>{dirty=true;},
   select:id=>{
    selectedId=id;applyHighlight();
    if(!id){setInfo(null);return;}
    const m=markers.find(x=>x.hotspot.id===id);if(!m)return;
    setInfo({kind:'hotspot',id,title:m.hotspot.title,text:m.hotspot.text,color:m.hotspot.color});
    if(!hiddenRef.current.has(m.group)&&!isCovered(m))focusMarker(m);
   },
   focus:id=>{const m=markers.find(x=>x.hotspot.id===id);if(m&&!hiddenRef.current.has(m.group)&&!isCovered(m))focusMarker(m);},
   setHidden:h=>{byGroup.forEach((list,g)=>list.forEach(m=>{m.visible=!h.has(g);}));dirty=true;},
   setRotate:r=>{controls.autoRotate=r;dirty=true;},
  };

  // ---- Load the geometry and build the organ --------------------------------------------------
  (async()=>{
   try{
    const [pack,names]=await Promise.all([fetchJson<OrganPack>(ORGANS_URL),fetchJson<NameDict>(NAMES_URL)]);
    const buffer=await fetchChunk({url:pack.url,bytes:pack.bytes,gzip:pack.gzip,gzipBytes:pack.gzipBytes});
    if(disposed)return;
    const box=new T.Box3(),parts=pack.parts.filter(p=>p.organ===organ);
    for(const p of parts){
     const g=new T.BufferGeometry();
     g.setAttribute('position',new T.BufferAttribute(new Float32Array(buffer,p.positions,p.vertexCount*3),3));
     g.setAttribute('normal',new T.BufferAttribute(new Int16Array(buffer,p.normals,p.vertexCount*3),3,true));
     g.setIndex(new T.BufferAttribute(new Uint32Array(buffer,p.indices,p.indexCount),1));
     g.computeBoundingBox();g.computeBoundingSphere();box.union(g.boundingBox!);
     const group=def.groupOf(p.id),look=def.look(p.id,group);
     const mat=new T.MeshPhysicalMaterial({color:look.color,roughness:look.roughness,metalness:0,clearcoat:look.clearcoat,clearcoatRoughness:look.clearcoatRoughness??.3,side:T.DoubleSide,envMapIntensity:.7});
     const mesh=new T.Mesh(g,mat);mesh.userData={id:p.id,name:russianName(names,p.name,p.id.startsWith('Allen_')),group};root.add(mesh);
     meshes.push(mesh);geometries.push(g);materials.push(mat);(byGroup.get(group)??byGroup.set(group,[]).get(group)!).push(mesh);
    }
    const center=box.getCenter(new T.Vector3());root.position.copy(center).multiplyScalar(-1);root.updateMatrixWorld(true);
    radius=box.getBoundingSphere(new T.Sphere()).radius;
    // Markers: put each one on the outer surface of the pieces it belongs to.
    for(const h of def.hotspots){
     const mine=meshes.filter(m=>h.match.test(m.userData.id as string));if(!mine.length)continue;
     const part=new T.Box3();mine.forEach(m=>part.union(m.geometry.boundingBox!));
     const c=part.getCenter(new T.Vector3()),outward=c.clone().sub(center);if(outward.lengthSq()<1e-10)outward.set(0,0,1);outward.normalize();
     const aim=h.aim?new T.Vector3(...h.aim).normalize():outward;
     const origin=c.clone().addScaledVector(aim,radius*3).add(root.position);raycaster.set(origin,aim.clone().negate());
     const hit=raycaster.intersectObjects(mine,false)[0];
     let position:T.Vector3,normal:T.Vector3;
     if(hit){
      position=hit.point.clone().sub(root.position);normal=hit.face?hit.face.normal.clone().transformDirection(hit.object.matrixWorld):aim.clone();if(normal.dot(aim)<0)normal.negate();
     }else{
      // The line missed (hollow tubes, thin vessels): use the vertex that lies closest to it.
      let best=Infinity;position=c.clone();normal=aim.clone();const v=new T.Vector3();
      for(const m of mine){const pos=m.geometry.getAttribute('position');for(let i=0;i<pos.count;i++){v.fromBufferAttribute(pos,i).add(root.position);const d=raycaster.ray.distanceSqToPoint(v);if(d<best){best=d;position=v.clone().sub(root.position);}}}
     }
     markers.push({hotspot:h,group:def.groupOf(mine[0].userData.id as string),position,normal,meshes:mine});
    }
    setMarkerList(markers.map(m=>({id:m.hotspot.id,title:m.hotspot.title,color:m.hotspot.color,group:m.group})));
    ready=true;resize();frameHome(false);setStatus('ready');dirty=true;
   }catch(e){if(!disposed){setError(e instanceof Error?e.message:'Не удалось загрузить модель органа.');setStatus('error');}}
  })();
  loop();
  return()=>{
   disposed=true;api.current=null;renderer.domElement.removeEventListener('webglcontextlost',contextLost);cancelAnimationFrame(frame);observer.disconnect();controls.dispose();geometries.forEach(g=>g.dispose());materials.forEach(m=>m.dispose());env.dispose();tooltip.remove();renderer.dispose();renderer.forceContextLoss();renderer.domElement.remove();
  };
 },[organ,def]);

 // Marker buttons are React elements; hand them to the render loop through their data-id.
 useEffect(()=>{
  api.current?.setHidden(hidden);
  if(pendingFocus.current){const id=pendingFocus.current;pendingFocus.current=null;api.current?.focus(id);}
 },[hidden,status]);
 useEffect(()=>{api.current?.setRotate(rotate);},[rotate,status]);
 useEffect(()=>{api.current?.refresh();},[markerList,labels]);
 const closeCard=useCallback(()=>{api.current?.select(null);setInfo(null);},[]);

 const toggleGroup=useCallback((id:string)=>setHidden(h=>{const n=new Set(h);if(n.has(id))n.delete(id);else n.add(id);return n;}),[]);
 const covering=useMemo(()=>info?.kind==='hotspot'?markerList.find(m=>m.id===info.id):undefined,[info,markerList]);
 const coveredBy=covering?(COVERS[organ][covering.group]??[]).filter(g=>!hidden.has(g)):[];

 return <div className="organ-view" ref={root} data-organ={organ} role="dialog" aria-modal="true" aria-label={`${def.name} в 3D`}>
  <div className="organ-canvas" ref={host}/>
  <div className="hotspot-layer" ref={layer}>
   {markerList.map(m=><button key={m.id} className="hotspot" data-id={m.id} data-state="front" style={{'--tone':m.color} as CSSProperties} aria-label={m.title} aria-pressed={info?.id===m.id} onClick={()=>api.current?.select(info?.id===m.id?null:m.id)}><i/></button>)}
  </div>
  <header className="organ-bar">
   <button className="back-pill" ref={backButton} onClick={onClose}><ArrowLeft size={16}/> Назад к телу</button>
   <div className="organ-title"><span className="organ-badge" data-organ={organ}><OrganIcon organ={organ} size={20}/></span><div><h2>{def.name}</h2><em>{def.latin}</em></div></div>
   <nav className="organ-switch" aria-label="Выбор органа">{ORGANS.map((o:OrganDef)=><button key={o.id} aria-pressed={o.id===organ} onClick={()=>onSwitch(o.id)}><OrganIcon organ={o.id} size={16}/>{o.name}</button>)}</nav>
  </header>
  {info&&<div className="hotspot-card" key={`${info.kind}:${info.id}`} data-anchor={info.kind==='hotspot'?'marker':'none'} ref={card} style={{'--tone':info.color} as CSSProperties} role="status">
   <div className="hotspot-card-head"><i/><strong>{info.title}</strong><button aria-label="Закрыть" onClick={closeCard}>×</button></div>
   {info.text&&<p>{info.text}</p>}
   {coveredBy.length>0&&<p className="hint">Эта структура находится внутри. <button onClick={()=>{pendingFocus.current=info.id;setHidden(h=>new Set([...h,...coveredBy]));}}>Скройте внешние слои</button>, чтобы увидеть её.</p>}
  </div>}
  <div className="organ-footer">
   <p className="organ-tagline">{def.tagline}</p>
   <div className="layer-chips" role="group" aria-label="Слои">{def.groups.map(g=><button key={g.id} aria-pressed={!hidden.has(g.id)} onClick={()=>toggleGroup(g.id)}><i style={{background:g.color}}/>{g.label}{hidden.has(g.id)?<EyeOff size={14}/>:<Eye size={14}/>}</button>)}</div>
   <div className="organ-tools">
    <button onClick={()=>setLabels(v=>!v)} aria-pressed={labels} title="Показать или скрыть метки">Метки</button>
    <button onClick={()=>setRotate(v=>!v)} aria-pressed={rotate} aria-label={rotate?'Остановить вращение':'Вращать автоматически'} title="Автовращение">{rotate?<Pause size={16}/>:<RotateCw size={16}/>}</button>
    <button onClick={()=>api.current?.reset()} aria-label="Сбросить вид" title="Сбросить вид"><RotateCcw size={16}/></button>
   </div>
   <p className="credit">Модели органов: Human Reference Atlas (HuBMAP), CC BY 4.0 · только для обучения</p>
  </div>
  {status==='loading'&&<div className="loading glass" role="status"><span className="spinner"/><div><strong>Готовим модель: {def.name.toLowerCase()}</strong><span>Загружаем 3D-модель…</span></div></div>}
  {status==='error'&&<div className="loading glass error" role="alert"><p>{error}</p><button className="plain" onClick={onClose}>Назад к телу</button></div>}
 </div>;
}
