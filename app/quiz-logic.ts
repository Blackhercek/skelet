import type {Atlas,Part,SystemId} from './anatomy';

export type QuizMode='identify'|'locate';
export type QuizScope='all'|'bones'|'muscles'|'organs'|'vessels'|'nerves';
export type QuizLevel='main'|'all';

export const ROUND_LENGTH=10;
export const SCOPES:Record<QuizScope,{label:string;systems:SystemId[]}>={
 all:{label:'Всё тело',systems:['skeletal','muscular','cardiac','respiratory','digestive','urinary','reproductive','endocrine','lymphatic','sensory','arterial','venous','nervous','connective']},
 bones:{label:'Кости',systems:['skeletal']},
 muscles:{label:'Мышцы',systems:['muscular']},
 organs:{label:'Органы',systems:['cardiac','respiratory','digestive','urinary','reproductive','endocrine','lymphatic','sensory']},
 vessels:{label:'Сосуды',systems:['arterial','venous']},
 nerves:{label:'Нервы и мозг',systems:['nervous']},
};

// Machine-made groupings of the source data are not good quiz questions.
const OBSCURE=/\b(zone|set|content|hollow|organ|component|compound|subdivision|tributary|division|tree|region|boundary|surface|wall|cavity|lumen|segmental|interlobar)\b/i;
export const sizeOf=(p:Part)=>Math.max(p.bounds[1][0]-p.bounds[0][0],p.bounds[1][1]-p.bounds[0][1],p.bounds[1][2]-p.bounds[0][2]);

/** Structures that can be asked about: named uniquely, big enough to see (and, for "locate", to tap). */
export function buildPool(atlas:Atlas,scope:QuizScope,mode:QuizMode,level:QuizLevel):Part[]{
 const systems=new Set(SCOPES[scope].systems),minSize=mode==='locate'?.04:.015;
 const base=atlas.parts.filter(p=>systems.has(p.system)&&p.region&&sizeOf(p)>=minSize&&!OBSCURE.test(p.nameEn??p.name));
 const count=new Map<string,number>();
 base.forEach(p=>count.set(p.name,(count.get(p.name)??0)+1));
 const unique=base.filter(p=>count.get(p.name)===1);
 if(level==='all')return unique;
 const largest=[...unique].sort((a,b)=>sizeOf(b)-sizeOf(a));
 return largest.slice(0,Math.max(12,Math.ceil(largest.length*.4)));
}

export function shuffle<T>(items:readonly T[],random:()=>number=Math.random):T[]{
 const out=[...items];
 for(let i=out.length-1;i>0;i--){const j=Math.floor(random()*(i+1));[out[i],out[j]]=[out[j],out[i]];}
 return out;
}
export const makeRound=(pool:readonly Part[],length=ROUND_LENGTH,random:()=>number=Math.random)=>shuffle(pool,random).slice(0,Math.min(length,pool.length));

/** The right answer plus plausible wrong ones: same system and region first, then same system, then anything. */
export function makeOptions(target:Part,candidates:readonly Part[],count=4,random:()=>number=Math.random):Part[]{
 const others=candidates.filter(p=>p.id!==target.id&&p.name!==target.name);
 const tiers=[others.filter(p=>p.system===target.system&&p.region===target.region),others.filter(p=>p.system===target.system),others];
 const chosen:Part[]=[],names=new Set([target.name]);
 for(const tier of tiers){
  for(const p of shuffle(tier,random)){
   if(chosen.length>=count-1)break;
   if(!names.has(p.name)){names.add(p.name);chosen.push(p);}
  }
  if(chosen.length>=count-1)break;
 }
 return shuffle([target,...chosen],random);
}

export const verdict=(correct:number,total:number)=>{
 const share=total?correct/total:0;
 return share===1?'Безупречно!':share>=.8?'Отлично!':share>=.6?'Хорошо, но есть что повторить.':share>=.4?'Неплохое начало — повторите ошибки.':'Стоит ещё поизучать модель.';
};
