import type {AnatomySex,Quality} from './anatomy';

const QUALITY_KEY='atlas.quality',HINT_KEY='atlas.install-hint';

const read=(key:string)=>{try{return localStorage.getItem(key);}catch{return null;}};
const write=(key:string,value:string)=>{try{localStorage.setItem(key,value);}catch{/* private mode: the setting just is not remembered */}};

/** A phone (not a tablet): it gets the lighter model by default. */
export const isPhone=()=>/iPhone|iPod|Android.+Mobile/i.test(navigator.userAgent)||(matchMedia('(pointer: coarse)').matches&&Math.min(screen.width,screen.height)<700);
export const isIOS=()=>/iPhone|iPad|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
export const isInstalled=()=>matchMedia('(display-mode: standalone)').matches||(navigator as Navigator&{standalone?:boolean}).standalone===true;

export function loadQuality():Quality{const saved=read(QUALITY_KEY);return saved==='high'||saved==='lite'?saved:isPhone()?'lite':'high';}
export const saveQuality=(quality:Quality)=>write(QUALITY_KEY,quality);
export const installHintDismissed=()=>read(HINT_KEY)==='1';
export const dismissInstallHint=()=>write(HINT_KEY,'1');

export interface Favorite {sex:AnatomySex;id:string;name:string;nameEn?:string;nameLa?:string;elements:string[]}
const FAVORITES_KEY='atlas.favorites';
export function loadFavorites():Favorite[]{
 try{const list=JSON.parse(read(FAVORITES_KEY)??'[]');return Array.isArray(list)?list.filter(f=>f&&typeof f.id==='string'&&Array.isArray(f.elements)):[];}catch{return [];}
}
export const saveFavorites=(list:Favorite[])=>write(FAVORITES_KEY,JSON.stringify(list));

export interface QuizStats {rounds:number;answered:number;correct:number;best:number}
const QUIZ_KEY='atlas.quiz';
export function loadQuizStats():QuizStats{
 try{const s=JSON.parse(read(QUIZ_KEY)??'{}');return {rounds:+s.rounds||0,answered:+s.answered||0,correct:+s.correct||0,best:+s.best||0};}catch{return {rounds:0,answered:0,correct:0,best:0};}
}
export const saveQuizStats=(stats:QuizStats)=>write(QUIZ_KEY,JSON.stringify(stats));
