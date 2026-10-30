import {useCallback,useEffect,useLayoutEffect,useMemo,useRef,useState,type CSSProperties,type KeyboardEvent as ReactKeyboardEvent} from 'react';
import {ArrowLeft,ArrowUpRight,Camera,ChevronRight,Eye,EyeOff,Focus,GraduationCap,Info,Layers,Pause,RotateCcw,RotateCw,Scissors,Search,Share,Star,X} from 'lucide-react';
import AnatomyScene,{type SceneApi} from './scene';
import {saveSnapshot} from './snapshot';
import OrganViewer from './organ-viewer';
import AboutDialog from './about-dialog';
import StartScreen from './start-screen';
import QuizPanel,{type QuizScene} from './quiz';
import {OrganIcon} from './icons';
import {ORGANS,type OrganId} from './organs';
import {REGIONS,assignRegions} from './regions';
import {LATIN_URL,NAMES_URL,localizeAtlas,normalize,type NameDict} from './localize';
import {fetchJson} from './model-cache';
import {registerAtlasTools} from './agent-tools';
import {loadQuality,saveQuality,isIOS,isInstalled,installHintDismissed,dismissInstallHint,loadFavorites,saveFavorites,type Favorite} from './settings';
import {atlasUrl,SYSTEMS,defaultVisible,explanation,hasExplanation,isPartVisible,type AnatomySex,type Atlas,type Concept,type FreeRect,type RegionId,type Quality,type SceneState,type SectionState,type SystemId,type View} from './anatomy';

const COMPACT='(max-width: 900px), (max-height: 540px)';
const VIEWS:{id:View;label:string}[]=[{id:'front',label:'Спереди'},{id:'back',label:'Сзади'},{id:'side',label:'Сбоку'},{id:'three-quarter',label:'Перспектива'}];
const LAYERS:{id:string;name:string;blurb:string;systems:SystemId[]}[]=[
 {id:'surface',name:'Кожа и поверхность',blurb:'Внешняя поверхность тела',systems:['integumentary']},
 {id:'muscles',name:'Мышцы',blurb:'Скелетные мышцы',systems:['muscular']},
 {id:'skeleton',name:'Скелет',blurb:'Кости, хрящи, связки',systems:['skeletal','connective']},
 {id:'organs',name:'Внутренние органы',blurb:'Сердце, лёгкие, органы пищеварения и мочевыделения и другие',systems:['cardiac','respiratory','digestive','urinary','reproductive','endocrine','lymphatic','sensory']},
 {id:'vessels',name:'Кровеносные сосуды',blurb:'Артерии и вены',systems:['arterial','venous']},
 {id:'nerves',name:'Нервная система',blurb:'Мозг, спинной мозг, нервы',systems:['nervous']},
];
type Tab='layers'|'systems'|'regions'|'favorites';
const TAB_LABELS:Record<Tab,string>={layers:'Слои',systems:'Системы',regions:'Области',favorites:'Избранное'};
const SECTION_AXES:{axis:SectionState['axis'];label:string;start:number}[]=[{axis:'y',label:'Горизонтальный',start:.62},{axis:'x',label:'Сагиттальный',start:.5},{axis:'z',label:'Фронтальный',start:.5}];
const initialState=(sex:AnatomySex):SceneState=>({explode:0,visible:defaultVisible(sex),selected:[],isolate:false,view:'three-quarter',rotate:false,reset:0,region:null,section:null});
const sameRect=(a:FreeRect,b:FreeRect)=>a.left===b.left&&a.top===b.top&&a.right===b.right&&a.bottom===b.bottom;
/** Russian plural: 1 деталь, 2 детали, 5 деталей. */
const plural=(n:number,forms:[string,string,string])=>{const m10=n%10,m100=n%100;return m10===1&&m100!==11?forms[0]:m10>=2&&m10<=4&&(m100<10||m100>=20)?forms[1]:forms[2];};
const pieces=(n:number)=>`${n.toLocaleString('ru-RU')} ${plural(n,['деталь','детали','деталей'])}`;
const fillStyle=(value:number)=>({'--fill':`${value}%`} as CSSProperties);

export default function Home(){
 const sex:AnatomySex='male'; // женская модель убрана; тип и код сохранены, чтобы её можно было вернуть
 const [atlas,setAtlas]=useState<Atlas|null>(null),[state,setState]=useState(()=>initialState('male'));
 const [progress,setProgress]=useState(0),[error,setError]=useState(''),[chosen,setChosen]=useState<Concept|null>(null);
 // The start screen covers the interface until the body is loaded for the first time; later reloads (quality) use the small card.
 const [booted,setBooted]=useState(false);
 useEffect(()=>{if(atlas&&progress>=100)setBooted(true);},[atlas,progress]);
 const [tab,setTab]=useState<Tab>('systems'),[query,setQuery]=useState(''),[searching,setSearching]=useState(false),[active,setActive]=useState(0);
 const [organ,setOrgan]=useState<OrganId|null>(null),[about,setAbout]=useState(false),[browseOpen,setBrowseOpen]=useState(false);
 const [quality,setQuality]=useState<Quality>(loadQuality),[hint,setHint]=useState(()=>isIOS()&&!isInstalled()&&!installHintDismissed());
 const [free,setFree]=useState<FreeRect>({left:16,top:84,right:Math.max(300,innerWidth-376),bottom:Math.max(300,innerHeight-190)});
 const calloutRef=useRef<HTMLDivElement>(null),searchRef=useRef<HTMLInputElement>(null),sceneApi=useRef<SceneApi|null>(null),savedVisible=useRef<SystemId[]>([]);
 const [quiz,setQuiz]=useState({on:false,callout:true}),[quizTap,setQuizTap]=useState<{id:string;n:number}|null>(null),[sectionOpen,setSectionOpen]=useState(false),[favorites,setFavorites]=useState<Favorite[]>(loadFavorites),[toast,setToast]=useState('');

 // ---- Data -----------------------------------------------------------------------------------
 useEffect(()=>{
  let live=true;setProgress(0);setError('');setAtlas(null);setChosen(null);setQuiz({on:false,callout:true});
  setState(s=>({...initialState(sex),explode:s.explode,view:s.view}));
  Promise.all([fetchJson<Atlas>(atlasUrl(sex,quality)),fetchJson<NameDict>(NAMES_URL),fetchJson<NameDict>(LATIN_URL).catch(()=>({} as NameDict))]).then(([a,names,latin])=>{if(live)setAtlas(a.localized?a:localizeAtlas(assignRegions(a),names,latin));}).catch(e=>{if(live)setError(e instanceof Error?e.message:'Не удалось загрузить каталог анатомии.');});
  return()=>{live=false;};
 },[sex,quality]);
 const parts=useMemo(()=>new Map(atlas?.parts.map(p=>[p.id,p])),[atlas]);
 const counts=useMemo(()=>Object.fromEntries(SYSTEMS.map(s=>[s.id,atlas?.parts.filter(p=>p.system===s.id).length??0])) as Record<SystemId,number>,[atlas]);
 const regionCounts=useMemo(()=>Object.fromEntries(REGIONS.map(r=>[r.id,atlas?.parts.filter(p=>p.region===r.id).length??0])) as Record<RegionId,number>,[atlas]);
 const activeSystems=SYSTEMS.filter(s=>counts[s.id]>0);
 const selectedParts=state.selected.map(id=>parts.get(id)).filter(p=>!!p),selected=selectedParts[0],system=SYSTEMS.find(s=>s.id===selected?.system);
 const visibleCount=useMemo(()=>{if(!atlas)return 0;const selection=new Set(state.selected);return atlas.parts.filter(p=>isPartVisible(p,state,selection)).length;},[atlas,state]);
 const hasSelection=selectedParts.length>0;

 // ---- Selecting ------------------------------------------------------------------------------
 const choose=useCallback((c:Concept)=>{setChosen(c);setState(s=>({...s,selected:c.elements,isolate:false,rotate:false}));setQuery('');setSearching(false);setBrowseOpen(false);searchRef.current?.blur();},[]);
 const choosePart=useCallback((id:string)=>{const p=parts.get(id);if(!p)return;choose({id:p.conceptId,name:p.name,nameEn:p.nameEn,nameLa:p.nameLa,elements:[id]});},[parts,choose]);
 const clearSelection=useCallback(()=>{setState(s=>({...s,selected:[],isolate:false}));setChosen(null);},[]);
 const wholeBody=useCallback(()=>{setState(s=>({...s,selected:[],isolate:false,region:null,reset:s.reset+1}));setChosen(null);},[]);
 const resetAll=useCallback(()=>{setState(s=>({...initialState(sex),reset:s.reset+1}));setChosen(null);setQuery('');setSearching(false);},[sex]);
 useEffect(()=>{if(!atlas)return;return registerAtlasTools(atlas,c=>choose(c));},[atlas,choose]);

 // ---- Snapshot, section, favorites ---------------------------------------------------------
 const notify=useCallback((text:string)=>{setToast(text);setTimeout(()=>setToast(t=>t===text?'':t),2600);},[]);
 const shoot=()=>{const result=saveSnapshot(()=>sceneApi.current?.capture()??null,chosen?.name??'Тело человека');notify(result==='failed'?'Не удалось сделать снимок':result==='shared'?'Выберите, куда сохранить снимок':'Снимок сохранён');};
 const setSection=(next:SectionState|null)=>setState(s=>({...s,section:next}));
 const isFavorite=!!chosen&&favorites.some(f=>f.sex===sex&&f.id===chosen.id&&f.elements.join()===chosen.elements.join());
 const toggleFavorite=()=>{if(!chosen)return;const same=(f:Favorite)=>f.sex===sex&&f.id===chosen.id&&f.elements.join()===chosen.elements.join();const next=isFavorite?favorites.filter(f=>!same(f)):[...favorites,{sex,id:chosen.id,name:chosen.name,nameEn:chosen.nameEn,nameLa:chosen.nameLa,elements:chosen.elements.slice(0,400)}].slice(-80);saveFavorites(next);setFavorites(next);notify(isFavorite?'Убрано из избранного':'Добавлено в избранное');};
 const myFavorites=favorites.filter(f=>f.sex===sex&&f.elements.some(id=>parts.has(id)));

 // ---- Quiz ------------------------------------------------------------------------------------
 const startQuiz=()=>{savedVisible.current=state.visible;setBrowseOpen(false);setSectionOpen(false);setChosen(null);setQuizTap(null);setQuiz({on:true,callout:false});setState(s=>({...s,selected:[],isolate:false,region:null,section:null,explode:0,rotate:false}));};
 const closeQuiz=useCallback(()=>{setQuiz({on:false,callout:true});setChosen(null);setState(s=>({...s,visible:savedVisible.current.length?savedVisible.current:defaultVisible(sex),selected:[],isolate:false,region:null,reset:s.reset+1}));},[sex]);
 const applyQuizScene=useCallback((scene:QuizScene)=>{
  setQuiz(q=>({...q,callout:scene.callout}));
  setChosen(scene.callout&&scene.label?{id:'quiz',name:scene.label,elements:scene.selected}:null);
  setState(s=>({...s,selected:scene.selected,visible:scene.visible,isolate:false,region:null,section:null,explode:0,rotate:false,reset:scene.resetView?s.reset+1:s.reset}));
 },[]);

 // ---- Layers, systems, regions ---------------------------------------------------------------
 const setVisible=(next:SystemId[])=>setState(s=>({...s,selected:[],isolate:false,visible:next}));
 const toggleSystem=(id:SystemId)=>{setChosen(null);setVisible(state.visible.includes(id)?state.visible.filter(x=>x!==id):[...state.visible,id]);};
 const layers=LAYERS.map(l=>({...l,present:l.systems.filter(id=>counts[id]>0)})).filter(l=>l.present.length>0);
 const layerOn=(l:{present:SystemId[]})=>l.present.every(id=>state.visible.includes(id));
 const toggleLayer=(l:{present:SystemId[]})=>{setChosen(null);setVisible(layerOn(l)?state.visible.filter(id=>!l.present.includes(id)):[...new Set([...state.visible,...l.present])]);};
 const chooseRegion=(id:RegionId)=>{setChosen(null);setBrowseOpen(false);setState(s=>({...s,selected:[],isolate:false,region:s.region===id?null:id,explode:0,reset:s.reset+(s.region===id?1:0)}));};

 // ---- Search ---------------------------------------------------------------------------------
 const results=useMemo(()=>{
  if(!atlas)return[];const term=normalize(query).trim();
  if(!term)return ['heart','brain','liver','stomach','spleen','pancreas','urinary bladder','trachea'].map(name=>atlas.concepts.find(c=>c.nameEn?.toLowerCase()===name)).filter((x):x is Concept=>!!x);
  return atlas.concepts.filter(c=>normalize(c.name).includes(term)||c.nameEn?.toLowerCase().includes(term)||c.nameLa?.toLowerCase().includes(term)||c.id.toLowerCase().includes(term)).sort((a,b)=>a.name.length-b.name.length||a.name.localeCompare(b.name,'ru')).slice(0,80);
 },[atlas,query]);
 useEffect(()=>{setActive(0);},[query]);
 const onSearchKey=(e:ReactKeyboardEvent<HTMLInputElement>)=>{
  if(e.key==='ArrowDown'){e.preventDefault();setActive(i=>Math.min(i+1,Math.max(0,results.length-1)));}
  else if(e.key==='ArrowUp'){e.preventDefault();setActive(i=>Math.max(i-1,0));}
  else if(e.key==='Enter'&&results[active]){e.preventDefault();choose(results[active]);}
  else if(e.key==='Escape'){setQuery('');setSearching(false);searchRef.current?.blur();e.stopPropagation();}
 };
 useEffect(()=>{document.getElementById(`result-${active}`)?.scrollIntoView({block:'nearest'});},[active]);

 // ---- Keyboard -------------------------------------------------------------------------------
 useEffect(()=>{
  const key=(e:KeyboardEvent)=>{
   if(e.metaKey||e.ctrlKey||e.altKey)return;
   const target=e.target instanceof HTMLElement?e.target:null,typing=!!target?.matches('input:not([type=range]),textarea,select,[contenteditable="true"]');
   if(e.key==='/'&&!typing&&!organ&&!about&&!hasSelection){e.preventDefault();setBrowseOpen(true);setSearching(true);setTimeout(()=>searchRef.current?.focus(),30);}
   else if(e.key==='Escape'&&!typing){if(about)setAbout(false);else if(organ)setOrgan(null);else if(quiz.on)closeQuiz();else if(browseOpen)setBrowseOpen(false);else if(hasSelection)clearSelection();else if(state.region)wholeBody();}
  };
  window.addEventListener('keydown',key);return()=>window.removeEventListener('keydown',key);
 },[organ,about,browseOpen,hasSelection,quiz.on,closeQuiz,state.region,clearSelection,wholeBody]);

 // ---- Free area of the canvas (everything not covered by panels) ------------------------------
 const measure=useCallback(()=>{
  const w=innerWidth,h=innerHeight,compact=matchMedia(COMPACT).matches;
  const rect=(selector:string)=>{const el=document.querySelector<HTMLElement>(selector);if(!el)return null;const style=getComputedStyle(el);return style.display==='none'||style.visibility==='hidden'?null:el.getBoundingClientRect();};
  const brand=rect('.brand'),dock=rect('.dock'),panel=rect('.side-panel');
  let right=w-16,bottom=h-16;const top=Math.round((brand?.bottom??56)+(compact?4:10));
  if(panel){if(compact)bottom=Math.min(bottom,panel.top-10);else right=Math.min(right,panel.left-16);}
  if(dock)bottom=Math.min(bottom,dock.top-10);
  const next:FreeRect={left:16,top,right:Math.round(right),bottom:Math.round(bottom)};
  setFree(prev=>sameRect(prev,next)?prev:next);
 },[]);
 useLayoutEffect(()=>{measure();});
 useEffect(()=>{
  const observer=new ResizeObserver(measure);
  document.querySelectorAll('.brand,.dock').forEach(el=>observer.observe(el));
  addEventListener('resize',measure);
  return()=>{observer.disconnect();removeEventListener('resize',measure);};
 },[measure]);

 const caption=state.isolate?(chosen?.name??'Выбранная структура'):state.explode>.95?'Все детали по отдельности':state.explode>.05?'Структуры разнесены':state.region?`Область · ${REGIONS.find(r=>r.id===state.region)?.name}`:'';
 const percent=Math.round(state.explode*100);
 const showBack=hasSelection||!!state.region||state.isolate;

 const starting=!booted&&!error;
 return <><main className="studio" inert={starting||undefined} data-compact-open={browseOpen||undefined} data-has-detail={hasSelection||quiz.on||undefined}>
  {atlas&&<AnatomyScene key={`${atlas.version}:${quality}`} atlas={atlas} state={state} free={free} calloutRef={calloutRef} apiRef={sceneApi} showCallout={!quiz.on||quiz.callout} onSelect={quiz.on?(id=>setQuizTap(t=>({id,n:(t?.n??0)+1}))):choosePart} onProgress={n=>{setProgress(n);if(n===100)setError('');}} onError={setError}/>}
  <div className="vignette"/>
  <div className="callout" ref={calloutRef} data-side="right" aria-hidden="true"><span className="callout-dot"/><span className="callout-line"/><span className="callout-label">{chosen?.name}</span></div>

  <header className="brand">
   <div className="brand-row"><h1>Атлас тела человека</h1><span className="beta">3D</span></div>
   <p className="brand-meta"><span className="status-dot"/>Видимых структур: {visibleCount.toLocaleString('ru-RU')}{caption&&<> <b>·</b> {caption}</>}</p>
  </header>
  <div className="canvas-tools">
   <button className="tool" onClick={()=>setState(s=>({...s,rotate:!s.rotate}))} disabled={state.explode>=.4||state.isolate} aria-pressed={state.rotate} aria-label={state.rotate?'Остановить вращение':'Вращать тело'} title="Автовращение">{state.rotate?<Pause size={17}/>:<RotateCw size={17}/>}</button>
   <button className="tool" onClick={resetAll} aria-label="Сбросить всё" title="Сбросить вид, слои и выбор"><RotateCcw size={17}/></button>
   <button className="tool" onClick={()=>setSectionOpen(o=>!o)} disabled={state.explode>=.45} aria-pressed={sectionOpen||!!state.section} aria-label="Срез тела" title="Срез тела"><Scissors size={17}/></button>
   <button className="tool" onClick={shoot} aria-label="Сохранить снимок" title="Сохранить снимок для презентации"><Camera size={17}/></button>
   <button className="tool compact-only" onClick={()=>{setBrowseOpen(true);}} aria-label="Обзор структур" title="Обзор"><Layers size={17}/></button>
  </div>

  {quiz.on&&atlas&&<QuizPanel atlas={atlas} sex={sex} tap={quizTap} onScene={applyQuizScene} onOpenStructure={part=>{closeQuiz();choosePart(part.id);}} onClose={closeQuiz}/>}
  {!hasSelection&&!quiz.on&&<aside className={`side-panel browse glass ${browseOpen?'open':''}`} aria-label="Обзор анатомии">
   <div className="panel-head"><h2>Обзор</h2><div className="panel-head-actions"><button className="icon" onClick={()=>setAbout(true)} aria-label="Настройки и сведения об атласе"><Info size={17}/></button><button className="icon compact-only" onClick={()=>setBrowseOpen(false)} aria-label="Закрыть обзор"><X size={17}/></button></div></div>
   <div className="search" role="search"><Search size={16}/><input ref={searchRef} value={query} placeholder="Найти структуру…" aria-label="Поиск по названиям анатомических структур" role="combobox" aria-expanded={searching||!!query} aria-controls="search-results" aria-activedescendant={(searching||query)&&results.length>0?`result-${active}`:undefined} autoComplete="off" spellCheck={false} onFocus={()=>setSearching(true)} onBlur={()=>{if(!query)setSearching(false);}} onChange={e=>{setQuery(e.target.value);setSearching(true);}} onKeyDown={onSearchKey}/>{query?<button className="icon" aria-label="Очистить поиск" onClick={()=>{setQuery('');searchRef.current?.focus();}}><X size={15}/></button>:<kbd>/</kbd>}</div>
   {(searching||query)?<div className="results" id="search-results" role="listbox" aria-label="Найденные структуры">
    {results.length===0&&<p className="empty">Ничего не найдено по запросу «{query}».</p>}
    {results.map((c,i)=><button key={c.id} id={`result-${i}`} role="option" aria-selected={i===active} className={i===active?'active':''} onMouseEnter={()=>setActive(i)} onMouseDown={e=>e.preventDefault()} onClick={()=>choose(c)}><span>{c.name}</span><small>{pieces(c.elements.length)}</small></button>)}
    {(results.length>=80||!query)&&<p className="foot-note">{query?'Показано до 80 совпадений. Уточните запрос, чтобы найти более мелкие структуры.':'Начните с крупного органа или ищите любую структуру по названию — по-русски или по-английски.'}</p>}
   </div>:<>
    <div className="section-label">Органы в 3D</div>
    <div className="organ-cards">{ORGANS.map(o=><button key={o.id} onClick={()=>{setOrgan(o.id);setBrowseOpen(false);}} data-organ={o.id}><span className="organ-badge" data-organ={o.id}><OrganIcon organ={o.id} size={22}/></span><span>{o.name}</span></button>)}</div>
    <button className="quiz-card" onClick={startQuiz} disabled={!atlas}><span className="organ-badge quiz"><GraduationCap size={22}/></span><span className="quiz-card-text"><strong>Проверь себя</strong><small>Тест по анатомии: узнавайте структуры и находите их на модели</small></span><ChevronRight size={16}/></button>
    <div className="tabs" role="tablist" aria-label="Способ обзора">{(['layers','systems','regions','favorites'] as Tab[]).map(t=><button key={t} role="tab" id={`tab-${t}`} aria-selected={tab===t} aria-controls="tab-body" onClick={()=>setTab(t)}>{TAB_LABELS[t]}{t==='favorites'&&myFavorites.length>0?` · ${myFavorites.length}`:''}</button>)}</div>
    <div className="tab-body" id="tab-body" role="tabpanel" aria-labelledby={`tab-${tab}`}>
     {tab==='layers'&&<>
      <p className="tab-hint">Снимайте слои тела один за другим — от поверхности до нервов.</p>
      {layers.map(l=><div key={l.id} className={`row ${layerOn(l)?'on':''}`}><button className="row-main" onClick={()=>toggleLayer(l)}><span className="row-title">{l.name}</span><span className="row-sub">{l.blurb}</span></button><span className="row-count">{l.present.reduce((n,id)=>n+counts[id],0)}</span><button className="icon eye" aria-pressed={layerOn(l)} aria-label={`${layerOn(l)?'Скрыть':'Показать'}: ${l.name.toLowerCase()}`} onClick={()=>toggleLayer(l)}>{layerOn(l)?<Eye size={17}/>:<EyeOff size={17}/>}</button></div>)}
     </>}
     {tab==='systems'&&<>
      <p className="tab-hint">Показывайте и скрывайте целые системы органов. Нажмите на название, чтобы увидеть только эту систему.</p>
      {activeSystems.map(s=><div key={s.id} className={`row ${state.visible.includes(s.id)?'on':''}`}><button className="row-main" title={`Показать только: ${s.name.toLowerCase()}`} onClick={()=>{setChosen(null);setVisible([s.id]);}}><span className="row-title"><i className="dot" style={{background:s.color}}/>{s.name}</span></button><span className="row-count">{counts[s.id]}</span><button className="icon eye" aria-pressed={state.visible.includes(s.id)} aria-label={`${state.visible.includes(s.id)?'Скрыть':'Показать'}: ${s.name.toLowerCase()}`} onClick={()=>toggleSystem(s.id)}>{state.visible.includes(s.id)?<Eye size={17}/>:<EyeOff size={17}/>}</button></div>)}
      <div className="presets"><button onClick={()=>setVisible(activeSystems.filter(s=>s.id!=='pregnancy').map(s=>s.id))}>Все</button><button onClick={()=>setVisible(['skeletal'])}>Скелет</button><button onClick={()=>setVisible(['cardiac','respiratory','digestive','urinary','endocrine','reproductive'].filter(id=>counts[id as SystemId]>0) as SystemId[])}>Органы</button><button onClick={()=>setVisible([])}>Скрыть всё</button></div>
     </>}
     {tab==='favorites'&&<>
      <p className="tab-hint">Структуры, которые вы отметили звёздочкой в карточке. Список хранится на этом устройстве.</p>
      {myFavorites.length===0&&<p className="empty">Пока пусто. Откройте любую структуру и нажмите ☆.</p>}
      {myFavorites.map(f=><div key={`${f.id}:${f.elements.join()}`} className="row on"><button className="row-main" onClick={()=>choose({id:f.id,name:f.name,nameEn:f.nameEn,nameLa:f.nameLa,elements:f.elements.filter(id=>parts.has(id))})}><span className="row-title">{f.name}</span>{f.nameLa&&<span className="row-sub latin">{f.nameLa}</span>}</button><button className="icon" aria-label={`Убрать из избранного: ${f.name}`} onClick={()=>{const next=favorites.filter(x=>x!==f);saveFavorites(next);setFavorites(next);}}><X size={16}/></button></div>)}
     </>}
     {tab==='regions'&&<>
      <p className="tab-hint">Выберите область тела, чтобы изучить её анатомические структуры.</p>
      {REGIONS.map(r=><div key={r.id} className={`row region ${state.region===r.id?'on':''}`}><button className="row-main" disabled={regionCounts[r.id]===0} aria-pressed={state.region===r.id} onClick={()=>chooseRegion(r.id)}><span className="row-title">{r.name}</span><span className="row-sub">{regionCounts[r.id]===0?'Нет в этой модели':r.detail}</span></button><span className="row-count">{regionCounts[r.id]}</span><ChevronRight size={16} className="chev"/></div>)}
     </>}
    </div>
    <div className="panel-foot"><span>Видно структур: {visibleCount.toLocaleString('ru-RU')}</span><button onClick={()=>setAbout(true)}>Источники и авторы <ArrowUpRight size={12}/></button></div>
   </>}
  </aside>}

  {hasSelection&&!quiz.on&&<aside className="side-panel detail glass" aria-label="Сведения о структуре">
   <button className="back-link" onClick={clearSelection}><ArrowLeft size={16}/> Назад к обзору</button>
   <div className="detail-head"><h2 className="detail-title">{chosen?.name}</h2><button className="icon star" aria-pressed={isFavorite} aria-label={isFavorite?'Убрать из избранного':'Добавить в избранное'} title={isFavorite?'Убрать из избранного':'Добавить в избранное'} onClick={toggleFavorite}><Star size={19} fill={isFavorite?'currentColor':'none'}/></button></div>
   <div className="chips"><span className="chip"><i className="dot" style={{background:system?.color}}/>{system?.name??'Анатомия'}</span><span className="chip">{selectedParts.length===1?'Отдельная структура':pieces(selectedParts.length)}</span>{selected?.region&&<span className="chip">{REGIONS.find(r=>r.id===selected.region)?.name}</span>}</div>
   <div className="detail-scroll" key={`${chosen?.id}-${state.isolate}`}>
    <h3>Описание</h3>
    <p className="about">{chosen&&selected?explanation(chosen.nameEn??chosen.name,selected.system,sex):''}</p>
    {chosen&&!hasExplanation(chosen.nameEn??chosen.name)&&<p className="note">Для этой структуры нет отдельного описания — показано описание её системы.</p>}
    <dl className="meta">{chosen?.nameLa&&<div><dt>Латинское название</dt><dd className="latin">{chosen.nameLa}</dd></div>}{chosen?.nameEn&&<div><dt>Английское название</dt><dd>{chosen.nameEn}</dd></div>}<div><dt>Код в атласе</dt><dd>{chosen?.id}</dd></div><div><dt>Источник</dt><dd>{atlas?.source??'BodyParts3D'}</dd></div></dl>
    {selectedParts.length>1&&<div className="members"><h3>Входящие структуры</h3>{selectedParts.slice(0,50).map(p=><button key={p.id} onClick={()=>choosePart(p.id)}><span>{p.name}</span><ChevronRight size={14}/></button>)}{selectedParts.length>50&&<p className="note">И ещё {pieces(selectedParts.length-50)}.</p>}</div>}
   </div>
   <div className="detail-actions"><button className={`primary ${state.isolate?'active':''}`} onClick={()=>setState(s=>({...s,isolate:!s.isolate,explode:0}))}><Focus size={17}/>{state.isolate?'Показать окружающие структуры':'Выделить отдельно'}</button><button className="ghost" onClick={wholeBody}>Вернуться ко всему телу</button></div>
  </aside>}

  <div className="dock glass">
   {showBack&&!quiz.on&&<button className="back-whole" onClick={wholeBody}><RotateCcw size={14}/> Ко всему телу</button>}
   <div className="dock-row">
    <div className="seg views" role="group" aria-label="Вид камеры">{VIEWS.map(v=><button key={v.id} aria-pressed={state.view===v.id} disabled={state.explode>.8&&v.id!=='front'} onClick={()=>setState(s=>({...s,view:v.id,reset:s.reset+1,rotate:false}))}>{v.label}</button>)}</div>
   </div>
   <div className="spread">
    <div className="spread-head"><label id="spread-label" htmlFor="spread">Развести структуры</label><span className="spread-tools"><button className="reassemble" onClick={()=>setState(s=>({...s,explode:0}))} disabled={state.explode===0}><RotateCcw size={13}/> Собрать</button><output className="pill" htmlFor="spread">{percent}%</output></span></div>
    <input id="spread" className="range" type="range" min={0} max={100} step={1} value={percent} style={fillStyle(percent)} aria-labelledby="spread-label" aria-valuetext={`${percent} ${plural(percent,['процент','процента','процентов'])}`} onChange={e=>{const v=Number(e.target.value);setState(s=>({...s,explode:v/100,view:v>80?'front':s.view,rotate:false}));}}/>
    <div className="range-ends"><span>Собрано</span><span>Каждая деталь</span></div>
   </div>
  </div>

  {sectionOpen&&<aside className="section-panel glass" aria-label="Срез тела">
   <div className="panel-head"><h2>Срез тела</h2><button className="icon" aria-label="Закрыть" onClick={()=>setSectionOpen(false)}><X size={17}/></button></div>
   <div className="seg wide" role="group" aria-label="Плоскость среза">{SECTION_AXES.map(a=><button key={a.axis} aria-pressed={state.section?.axis===a.axis} onClick={()=>setSection({axis:a.axis,position:state.section?.axis===a.axis?state.section.position:a.start,flip:state.section?.flip??false})}>{a.label}</button>)}</div>
   <label className="slider-label" htmlFor="section-position">Положение среза</label>
   <input id="section-position" className="range" type="range" min={0} max={100} step={1} value={Math.round((state.section?.position??.5)*100)} disabled={!state.section} style={fillStyle(Math.round((state.section?.position??.5)*100))} onChange={e=>state.section&&setSection({...state.section,position:Number(e.target.value)/100})}/>
   <div className="section-actions"><button className="ghost" disabled={!state.section} onClick={()=>state.section&&setSection({...state.section,flip:!state.section.flip})}>Другая сторона</button><button className="ghost" disabled={!state.section} onClick={()=>setSection(null)}>Убрать срез</button></div>
   <p className="note">Горизонтальный срез идёт сверху вниз, сагиттальный — слева направо, фронтальный — спереди назад. Вращайте тело, чтобы рассмотреть срез с разных сторон.</p>
  </aside>}
  {toast&&<div className="toast" role="status">{toast}</div>}
  {booted&&progress<100&&!error&&<div className="loading glass" role="status"><span className="spinner"/><div><strong>Готовим анатомию</strong><span>{progress}% · Загружаем {pieces(atlas?.parts.length??2234)}</span><div className="loading-track"><i style={{width:`${progress}%`}}/></div></div></div>}
  {error&&<div className="loading glass error" role="alert"><p>{error}</p><button className="plain" onClick={()=>location.reload()}>Перезагрузить</button></div>}

  {organ&&<OrganViewer organ={organ} onClose={()=>setOrgan(null)} onSwitch={setOrgan}/>}

  {about&&<AboutDialog quality={quality} onQuality={q=>{saveQuality(q);setQuality(q);}} onClose={()=>setAbout(false)}/>}
  {hint&&!organ&&progress>=100&&!hasSelection&&<aside className="install-hint glass" role="note"><div><strong>Поставьте атлас на экран «Домой»</strong><p>Нажмите <Share size={15} aria-hidden="true"/> «Поделиться» и выберите «На экран «Домой»». Атлас откроется без адресной строки и будет работать без интернета.</p></div><button className="icon" aria-label="Скрыть подсказку" onClick={()=>{dismissInstallHint();setHint(false);}}><X size={17}/></button></aside>}
 </main>{starting&&<StartScreen progress={progress}/>}</>;
}
