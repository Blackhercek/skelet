import {useCallback,useEffect,useMemo,useRef,useState} from 'react';
import {ArrowLeft,Check,Lightbulb,SkipForward,X} from 'lucide-react';
import {REGIONS} from './regions';
import {SYSTEMS,explanation,type AnatomySex,type Atlas,type Part,type SystemId} from './anatomy';
import {ROUND_LENGTH,SCOPES,buildPool,makeOptions,makeRound,verdict,type QuizLevel,type QuizMode,type QuizScope} from './quiz-logic';
import {loadQuizStats,saveQuizStats,type QuizStats} from './settings';

/** What the quiz asks the 3D scene to show. */
export interface QuizScene {/** name for the label, when it is shown */label?:string;selected:string[];visible:SystemId[];/** show the name label */callout:boolean;/** go back to the whole-body view */resetView:boolean}
interface Props {atlas:Atlas;sex:AnatomySex;/** the last structure the user tapped in 3D */tap:{id:string;n:number}|null;onScene:(scene:QuizScene)=>void;onOpenStructure:(part:Part)=>void;onClose:()=>void}
type Phase='setup'|'ask'|'answered'|'done';
interface Round {parts:Part[];index:number;results:boolean[];options:Part[];picked:string|null;tapped:Part|null;hint:boolean}

const MODES:{id:QuizMode;title:string;text:string}[]=[
 {id:'identify',title:'Что подсвечено?',text:'Структура подсвечена на модели — выберите её название из четырёх.'},
 {id:'locate',title:'Найди на модели',text:'Вам называют структуру — нажмите на неё на 3D-модели.'},
];
const plural=(n:number)=>{const a=n%10,b=n%100;return a===1&&b!==11?'вопрос':a>=2&&a<=4&&(b<10||b>=20)?'вопроса':'вопросов';};

export default function QuizPanel({atlas,sex,tap,onScene,onOpenStructure,onClose}:Props){
 const [mode,setMode]=useState<QuizMode>('identify'),[scope,setScope]=useState<QuizScope>('bones'),[level,setLevel]=useState<QuizLevel>('main');
 const [phase,setPhase]=useState<Phase>('setup'),[round,setRound]=useState<Round|null>(null),[stats,setStats]=useState<QuizStats>(loadQuizStats);
 const pool=useMemo(()=>buildPool(atlas,scope,mode,level),[atlas,scope,mode,level]);
 const distractors=useMemo(()=>buildPool(atlas,scope,mode,'all'),[atlas,scope,mode]);
 const playable=pool.length>=5,systems=SCOPES[scope].systems;
 const lastTap=useRef(0),statsRef=useRef(stats);statsRef.current=stats;

 const show=useCallback((parts:Part[],index:number,first:boolean)=>{
  const target=parts[index];
  const options=mode==='identify'?makeOptions(target,distractors):[];
  setRound(r=>({parts,index,results:first||!r?[]:r.results,options,picked:null,tapped:null,hint:false}));
  setPhase('ask');
  onScene({selected:mode==='identify'?[target.id]:[],visible:systems,callout:false,resetView:first||mode==='locate'});
 },[mode,distractors,systems,onScene]);

 const start=(parts?:Part[])=>{const list=parts??makeRound(pool,ROUND_LENGTH);if(list.length)show(list,0,true);};
 const target=round?.parts[round.index]??null;

 const record=useCallback((ok:boolean)=>{
  const next={...statsRef.current,answered:statsRef.current.answered+1,correct:statsRef.current.correct+(ok?1:0)};
  saveQuizStats(next);setStats(next);
 },[]);
 const reveal=useCallback((ok:boolean,extra:Partial<Round>)=>{
  setRound(r=>r&&{...r,...extra,results:[...r.results,ok]});setPhase('answered');record(ok);
  if(target)onScene({selected:[target.id],visible:systems,callout:true,label:target.name,resetView:false});
 },[record,target,onScene,systems]);

 const choose=(part:Part)=>{if(phase!=='ask'||!round||!target)return;reveal(part.id===target.id,{picked:part.id});};
 // A tap on the 3D model answers "locate" questions.
 useEffect(()=>{
  if(!tap||tap.n===lastTap.current)return;lastTap.current=tap.n;
  if(mode!=='locate'||phase!=='ask'||!target)return;
  const tapped=atlas.parts.find(p=>p.id===tap.id);if(!tapped)return;
  reveal(tapped.id===target.id||tapped.name===target.name,{tapped});
 },[tap,mode,phase,target,atlas,reveal]);

 const skip=()=>{if(phase==='ask'&&round)reveal(false,{picked:null});};
 const next=()=>{
  if(!round)return;
  if(round.index+1<round.parts.length)show(round.parts,round.index+1,false);
  else{
   const correct=round.results.filter(Boolean).length,updated={...statsRef.current,rounds:statsRef.current.rounds+1,best:Math.max(statsRef.current.best,Math.round(correct/round.parts.length*100))};
   saveQuizStats(updated);setStats(updated);setPhase('done');onScene({selected:[],visible:systems,callout:false,resetView:true});
  }
 };
 const mistakes=round?round.parts.filter((_,i)=>round.results[i]===false):[];
 const correct=round?round.results.filter(Boolean).length:0;
 const ok=round&&phase==='answered'?round.results[round.results.length-1]:null;
 const share=stats.answered?Math.round(stats.correct/stats.answered*100):0;

 return <aside className="side-panel quiz glass" aria-label="Проверка знаний">
  <div className="panel-head"><button className="back-link inline" onClick={onClose}><ArrowLeft size={16}/> Выйти из теста</button></div>

  {phase==='setup'&&<div className="quiz-body">
   <h2 className="quiz-title">Проверь себя</h2>
   <p className="tab-hint">Раунд — {ROUND_LENGTH} {plural(ROUND_LENGTH)}. Названия на русском, латинское название и описание появятся после ответа.</p>
   <div className="section-label">Тип вопросов</div>
   <div className="quiz-modes" role="radiogroup" aria-label="Тип вопросов">{MODES.map(m=><button key={m.id} role="radio" aria-checked={mode===m.id} onClick={()=>setMode(m.id)}><strong>{m.title}</strong><span>{m.text}</span></button>)}</div>
   <div className="section-label">Раздел</div>
   <div className="chip-row" role="radiogroup" aria-label="Раздел">{(Object.keys(SCOPES) as QuizScope[]).map(s=><button key={s} role="radio" aria-checked={scope===s} onClick={()=>setScope(s)}>{SCOPES[s].label}</button>)}</div>
   <div className="section-label">Сложность</div>
   <div className="seg wide" role="radiogroup" aria-label="Сложность"><button role="radio" aria-checked={level==='main'} aria-pressed={level==='main'} onClick={()=>setLevel('main')}>Основные структуры</button><button role="radio" aria-checked={level==='all'} aria-pressed={level==='all'} onClick={()=>setLevel('all')}>Все структуры</button></div>
   {!playable&&<p className="note" role="status">В этой модели для выбранного раздела слишком мало структур. Выберите другой раздел или сложность{sex==='female'?' (в женской модели скелет и мышцы представлены частично)':''}.</p>}
   <button className="primary" disabled={!playable} onClick={()=>start()}>Начать раунд</button>
   {stats.answered>0&&<p className="quiz-stats">Всего ответов: {stats.answered} · верно {share}% · раундов: {stats.rounds} · лучший результат: {stats.best}%</p>}
  </div>}

  {(phase==='ask'||phase==='answered')&&round&&target&&<div className="quiz-body">
   <div className="quiz-progress" aria-live="polite"><span>Вопрос {round.index+1} из {round.parts.length}</span><span>Верно: {correct}</span></div>
   <div className="quiz-bar" aria-hidden="true"><i style={{width:`${(round.index+(phase==='answered'?1:0))/round.parts.length*100}%`}}/></div>

   {mode==='identify'?<>
    <h2 className="quiz-question">Что подсвечено на модели?</h2>
    <div className="quiz-options" role="group" aria-label="Варианты ответа">{round.options.map(o=>{
     const state=phase==='answered'?(o.id===target.id?'right':o.id===round.picked?'wrong':'dim'):'idle';
     return <button key={o.id} data-state={state} disabled={phase==='answered'} onClick={()=>choose(o)}>{o.name}{state==='right'&&<Check size={18}/>}{state==='wrong'&&<X size={18}/>}</button>;
    })}</div>
   </>:<>
    <h2 className="quiz-question">Найдите на модели</h2>
    <div className="quiz-target"><strong>{target.name}</strong>{target.nameLa&&<em>{target.nameLa}</em>}</div>
    {phase==='ask'&&<p className="note">Вращайте и приближайте модель, затем нажмите на нужную структуру.</p>}
    {phase==='ask'&&round.hint&&<p className="hint-line">Подсказка: {SYSTEMS.find(s=>s.id===target.system)?.name}{target.region?` · ${REGIONS.find(r=>r.id===target.region)?.name}`:''}</p>}
    {phase==='ask'&&<div className="quiz-actions"><button className="ghost" disabled={round.hint} onClick={()=>setRound(r=>r&&{...r,hint:true})}><Lightbulb size={16}/> Подсказка</button><button className="ghost" onClick={skip}><SkipForward size={16}/> Пропустить</button></div>}
   </>}

   {phase==='answered'&&<div className={`quiz-feedback ${ok?'good':'bad'}`} role="status">
    <strong>{ok?'Верно!':mode==='locate'&&round.tapped?`Неверно. Вы нажали: ${round.tapped.name}.`:mode==='identify'?'Неверно.':'Пропущено.'}</strong>
    <p><b>{target.name}</b>{target.nameLa&&<> — <em>{target.nameLa}</em></>}</p>
    <p className="about">{explanation(target.nameEn??target.name,target.system,sex)}</p>
    <p className="note">Правильная структура подсвечена на модели.</p>
    <button className="primary" onClick={next}>{round.index+1<round.parts.length?'Дальше':'Итоги'}</button>
   </div>}
  </div>}

  {phase==='done'&&round&&<div className="quiz-body">
   <h2 className="quiz-title">Раунд завершён</h2>
   <div className="quiz-score"><strong>{correct} из {round.parts.length}</strong><span>{Math.round(correct/round.parts.length*100)}%</span></div>
   <p className="about">{verdict(correct,round.parts.length)}</p>
   {mistakes.length>0&&<><div className="section-label">Над чем поработать</div><div className="quiz-mistakes">{mistakes.map(m=><button key={m.id} onClick={()=>onOpenStructure(m)}><span>{m.name}</span>{m.nameLa&&<em>{m.nameLa}</em>}</button>)}</div></>}
   <div className="quiz-actions column">
    {mistakes.length>0&&<button className="primary" onClick={()=>start(mistakes)}>Повторить ошибки</button>}
    <button className={mistakes.length?'ghost':'primary'} onClick={()=>start()}>Новый раунд</button>
    <button className="ghost" onClick={()=>{setPhase('setup');setRound(null);}}>Изменить настройки</button>
   </div>
   {stats.answered>0&&<p className="quiz-stats">Всего ответов: {stats.answered} · верно {share}% · лучший результат: {stats.best}%</p>}
  </div>}
 </aside>;
}
