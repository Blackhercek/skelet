import {EXTRA_EXPLANATIONS} from './descriptions';
export type SystemId = 'skeletal'|'muscular'|'arterial'|'venous'|'nervous'|'digestive'|'respiratory'|'urinary'|'reproductive'|'lymphatic'|'endocrine'|'integumentary'|'connective'|'sensory'|'cardiac'|'pregnancy';
export type AnatomySex='male'|'female';
export type RegionId='head'|'neck'|'thorax'|'abdomen'|'pelvis'|'upper-limb'|'lower-limb';
export const SYSTEMS: {id:SystemId;name:string;color:string;description:string}[] = [
 {id:'skeletal',name:'Скелет',color:'#e2d9ba',description:'Кости образуют опору тела, защищают внутренние органы и служат местом прикрепления мышц. Внутри костей хранятся минералы и образуются клетки крови.'},
 {id:'muscular',name:'Мышцы',color:'#a85b50',description:'Скелетные мышцы создают движение: сокращаясь, они сближают места своего прикрепления. Вместе с сухожилиями они двигают суставы, удерживают позу и вырабатывают тепло.'},
 {id:'cardiac',name:'Сердце',color:'#b96760',description:'Сердце — мышечный насос с четырьмя камерами. Его клапаны направляют кровь вперёд по малому и большому кругам кровообращения.'},
 {id:'sensory',name:'Органы чувств',color:'#b0c8ce',description:'Эти структуры участвуют в зрении, слухе и равновесии. Специализированные ткани воспринимают раздражения и вместе с нервной системой передают информацию.'},
 {id:'arterial',name:'Артерии',color:'#c05245',description:'Сердце гонит кровь по сосудам. Артерии несут кровь от сердца к тканям, а в малом круге кровообращения — к лёгким.'},
 {id:'venous',name:'Вены',color:'#527c9f',description:'Вены возвращают кровь к сердцу. Поверхностные и глубокие венозные сети собирают кровь из тканей, а лёгочные вены приносят из лёгких насыщенную кислородом кровь.'},
 {id:'nervous',name:'Нервная система',color:'#d8b565',description:'Головной и спинной мозг и периферические нервы проводят и обрабатывают сигналы. Они обеспечивают чувствительность, движения, координацию и автоматическую регуляцию функций организма.'},
 {id:'respiratory',name:'Дыхательная система',color:'#b98991',description:'Дыхательные пути проводят воздух к лёгким, где между воздухом и кровью происходит обмен кислорода и углекислого газа. Дыхание зависит от перепадов давления, которые создают дыхательные мышцы.'},
 {id:'digestive',name:'Пищеварительная система',color:'#b8916b',description:'Пищеварительный тракт расщепляет пищу, всасывает питательные вещества и воду и выводит остатки. Железы (печень, поджелудочная железа) выделяют желчь и пищеварительные ферменты.'},
 {id:'urinary',name:'Мочевыделительная система',color:'#b47961',description:'Почки фильтруют кровь и регулируют баланс жидкости, электролитов и кислотно-щелочной баланс. Моча по мочеточникам попадает в мочевой пузырь и выводится по мочеиспускательному каналу.'},
 {id:'lymphatic',name:'Лимфатическая система',color:'#879f7c',description:'Лимфатические сосуды возвращают избыток тканевой жидкости в кровоток. Лимфатические узлы и другие лимфоидные органы обеспечивают иммунный надзор и иммунные реакции.'},
 {id:'endocrine',name:'Эндокринная система',color:'#c5a09a',description:'Эндокринные железы выделяют гормоны в кровь и координируют обмен веществ, рост, реакцию на стресс и размножение.'},
 {id:'reproductive',name:'Половая система',color:'#bda098',description:'Представленные здесь мужские половые органы участвуют в образовании, созревании и передвижении сперматозоидов и в выработке половых гормонов.'},
 {id:'integumentary',name:'Поверхность тела',color:'#ba9b7d',description:'Поверхность тела служит внешним анатомическим ориентиром. Кожа образует защитный барьер, участвует в чувствительности и терморегуляции.'},
 {id:'pregnancy',name:'Беременность (справочно)',color:'#b88380',description:'Плацента и пуповина обеспечивают обмен веществ между кровообращением матери и плода во время беременности. Эти справочные структуры показаны отдельно от обычной анатомии взрослого человека.'},
 {id:'connective',name:'Соединительная ткань',color:'#aec3bb',description:'Хрящи, связки и другие соединительные ткани поддерживают, соединяют и разделяют структуры. Они стабилизируют суставы и распределяют механическую нагрузку.'},
];
/** Female reference assembly: the reproductive system describes female structures. */
export const FEMALE_REPRODUCTIVE='Женские половые органы — яичники, маточные трубы, матка, шейка матки и влагалище. Они участвуют в созревании яйцеклеток, оплодотворении, развитии плода и выработке половых гормонов.';
export interface Part {id:string;name:string;conceptId:string;system:SystemId;chunk:number;positions:number;normals:number;indices:number;vertexCount:number;indexCount:number;bounds:[number[],number[]];region?:RegionId|null;/** Original English name (the display name is Russian) and the Latin name (Terminologia Anatomica) where one is known. */nameEn?:string;nameLa?:string}
export interface Concept {id:string;name:string;elements:string[];nameEn?:string;nameLa?:string}
export interface Atlas {localized?:boolean;version:string;sex?:'male'|'female';source?:string;scope?:string;parts:Part[];concepts:Concept[];chunks:{url:string;bytes:number;gzip?:string;gzipBytes?:number}[];triangles:number}
export type View = 'three-quarter'|'front'|'back'|'side';
export interface FreeRect {left:number;top:number;right:number;bottom:number}
/** A cutting plane through the body: axis, position (0…1 across the body) and which side is kept. */
export interface SectionState {axis:'x'|'y'|'z';position:number;flip:boolean}
export interface SceneState {section:SectionState|null;explode:number;visible:SystemId[];selected:string[];isolate:boolean;view:View;rotate:boolean;reset:number;region:RegionId|null}
export const DEFAULT_VISIBLE:SystemId[] = ['cardiac','sensory','skeletal','muscular','arterial','venous','nervous','respiratory','digestive','urinary','lymphatic','endocrine','reproductive','connective'];
export const EXPLANATIONS:Record<string,string> = {
 'uterus':'Полый мышечный орган малого таза. Его слизистая оболочка меняется в течение менструального цикла и может принять оплодотворённую яйцеклетку; в матке развивается плод.',
 'vagina':'Мышечный канал, соединяющий шейку матки с наружной средой. Служит путём для менструальных выделений и составляет часть родового канала.',
 'ovary':'Парная женская половая железа. В ней созревают яйцеклетки и вырабатываются гормоны, в том числе эстрогены и прогестерон.',
 'heart':'Мышечный насос в грудной клетке. Правая половина направляет кровь в лёгкие, левая — в большой круг кровообращения.',
 'liver':'Крупный орган под правым куполом диафрагмы. Перерабатывает всосавшиеся питательные вещества, вырабатывает желчь и синтезирует многие белки крови.',
 'brain':'Центральный орган нервной системы. Его взаимосвязанные отделы обеспечивают восприятие, движения, память, речь и регуляцию функций организма.',
 'stomach':'Мышечная камера между пищеводом и тонкой кишкой. Накапливает пищу и перемешивает её с кислотой и ферментами, прежде чем передать в двенадцатиперстную кишку.',
 'spleen':'Лимфоидный орган в верхней левой части живота. Фильтрует кровь, удаляет стареющие клетки крови и участвует в иммунных реакциях.',
 'pancreas':'Орган брюшной полости с пищеварительной и эндокринной функциями. Выделяет ферменты в тонкую кишку и вырабатывает гормоны, в том числе инсулин и глюкагон.',
 'urinary bladder':'Мышечный резервуар в малом тазу, где накапливается моча, поступающая из почек по мочеточникам.',
 'trachea':'Главный дыхательный путь между гортанью и бронхами. Хрящевые полукольца не дают ей спадаться при дыхании.',
 'diaphragm':'Широкая мышца, разделяющая грудную и брюшную полости. При сокращении увеличивает объём грудной клетки и помогает втягивать воздух в лёгкие.',
};
/** Description for a structure. Lookup uses the English name; "left/right" prefixes fall back to the plain structure. */
export function explanation(nameEn:string,system:SystemId,sex:AnatomySex='male'){
 const key=nameEn.toLowerCase().trim(),bare=key.replace(/^(left|right)\s+/,'');
 const own=EXPLANATIONS[key]??EXTRA_EXPLANATIONS[key]??EXPLANATIONS[bare]??EXTRA_EXPLANATIONS[bare];
 if(own)return own;
 if(system==='reproductive'&&sex==='female')return FEMALE_REPRODUCTIVE;
 return SYSTEMS.find(s=>s.id===system)?.description??'';
}
export function hasExplanation(nameEn:string){const key=nameEn.toLowerCase().trim(),bare=key.replace(/^(left|right)\s+/,'');return !!(EXPLANATIONS[key]??EXTRA_EXPLANATIONS[key]??EXPLANATIONS[bare]??EXTRA_EXPLANATIONS[bare]);}
/** Is this piece shown right now? Selection always wins; isolate hides everything else. */
export function isPartVisible(p:Part,s:Pick<SceneState,'visible'|'isolate'|'region'>,selection:ReadonlySet<string>){
 if(selection.has(p.id))return true;
 if(s.isolate)return false;
 return s.visible.includes(p.system)&&(!s.region||p.region===s.region);
}
export type Quality='high'|'lite';
/** "lite" is the same anatomy with about 40 % of the triangles: it loads faster and runs smoothly on phones. */
export const atlasUrl=(sex:AnatomySex,quality:Quality)=>`/models/atlas${sex==='female'?'-female':''}${quality==='lite'?'-lite':''}.json`;
export function defaultVisible(sex:AnatomySex):SystemId[]{return sex==='female'?[...DEFAULT_VISIBLE,'integumentary']:[...DEFAULT_VISIBLE];}
