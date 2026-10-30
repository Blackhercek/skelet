/** Detailed organ models (heart, lungs, brain) from the Human Reference Atlas, with layers and annotated hotspots. */
export const ORGANS_URL='/organs/organs.json';
export type OrganId='lungs'|'brain'|'heart';
export interface OrganPart {id:string;name:string;organ:OrganId;vertexCount:number;indexCount:number;bounds:[number[],number[]];positions:number;normals:number;indices:number}
export interface OrganPack {version:string;bytes:number;url:string;gzip:string;gzipBytes:number;parts:OrganPart[]}
export interface Look {color:string;roughness:number;clearcoat:number;clearcoatRoughness?:number;sheen?:number}
export interface OrganGroup {id:string;label:string;color:string}
export interface Hotspot {id:string;title:string;text:string;/** matches ids of the pieces the marker belongs to */match:RegExp;color:string;/** direction to look from when placing the marker (default: outward from the organ's centre) */aim?:[number,number,number]}
export interface OrganDef {
 id:OrganId;name:string;latin:string;tagline:string;
 groups:OrganGroup[];groupOf:(partId:string)=>string;look:(partId:string,group:string)=>Look;
 hotspots:Hotspot[];
 /** direction from which the organ is first seen */view:[number,number,number];
}
const has=(id:string,...parts:string[])=>parts.some(p=>id.includes(p));
const glossy=(color:string,roughness=.34,clearcoat=.55):Look=>({color,roughness,clearcoat,clearcoatRoughness:.28});
const matte=(color:string,roughness=.62):Look=>({color,roughness,clearcoat:.08,clearcoatRoughness:.6});
const BLUE='#4f8cff',PINK='#f06bb0',AMBER='#f5a524',GREEN='#34c98b',VIOLET='#a07bf0',CYAN='#25b8d8';

// ------------------------------------------------------------------------------------------------ Lungs
const lobeOf=(id:string)=>{
 if(has(id,'right_apical_bronchopulmonary','right_posterior_bronchopulmonary','right_anterior_bronchopulmonary','hilum_upper_R'))return 'right-upper';
 if(has(id,'right_lateral_bronchopulmonary','right_medial_bronchopulmonary','hilum_middle_R'))return 'right-middle';
 if(has(id,'right_superior_bronchopulmonary','right_medial_basal','right_anterior_basal','right_lateral_basal','right_posterior_basal','hilum_lower_R','hilum_R'))return 'right-lower';
 if(has(id,'left_apical_bronchopulmonary','left_posterior_bronchopulmonary','left_anterior_bronchopulmonary','lingula_','hilum_upper_L'))return 'left-upper';
 return 'left-lower';
};
const isLungTissue=(id:string)=>has(id,'bronchopulmonary','hilum');
const LUNG_TONES:Record<string,string>={'right-upper':'#d65e4d','right-middle':'#c9533f','right-lower':'#d8685a','left-upper':'#d55b4b','left-lower':'#db6858'};
export const LUNGS:OrganDef={
 id:'lungs',name:'Лёгкие',latin:'Pulmones',tagline:'Газообмен: кислород поступает в кровь, углекислый газ выводится.',view:[.12,.08,1],
 groups:[{id:'tissue',label:'Ткань лёгких',color:'#e0806f'},{id:'airways',label:'Дыхательные пути',color:'#ead8bd'},{id:'larynx',label:'Гортань',color:'#cdbfa5'}],
 groupOf:id=>has(id,'arytenoid','epiglotic','cricoid','thyroid_cartilage','corniculate')?'larynx':isLungTissue(id)?'tissue':'airways',
 look:(id,group)=>{
  if(group==='tissue')return glossy(LUNG_TONES[lobeOf(id)],.4,.5);
  if(group==='larynx')return matte('#d7ccb6',.5);
  if(has(id,'cartilage'))return matte('#efe8d6',.5);
  return glossy('#e8cdb0',.45,.35);
 },
 hotspots:[
  {id:'trachea',title:'Трахея',text:'Дыхательное горло. Проводит воздух от гортани вниз; хрящевые полукольца не дают ей спадаться.',match:/^VH_F_(trachea|tracheal_cartilage)$/,color:BLUE,aim:[0,.1,1]},
  {id:'larynx',title:'Гортань',text:'Верхняя часть дыхательных путей. Защищает их при глотании и содержит голосовые складки.',match:/^VH_F_thyroid_cartilage$/,color:CYAN,aim:[0,.1,1]},
  {id:'carina',title:'Бифуркация трахеи',text:'Место, где трахея делится на правый и левый главные бронхи.',match:/^VH_F_carina$/,color:PINK,aim:[0,.1,1]},
  {id:'rmb',title:'Правый главный бронх',text:'Короче, шире и расположен вертикальнее левого, поэтому инородные тела чаще попадают в правое лёгкое.',match:/^VH_F_(right_main_bronchus|cartilage_of_main_bronchus_R)$/,color:AMBER,aim:[0,.1,1]},
  {id:'lmb',title:'Левый главный бронх',text:'Длиннее и расположен более горизонтально, чем правый. Перед входом в левое лёгкое он проходит под дугой аорты.',match:/^VH_F_(left_main_bronchus|cartilage_of_main_bronchus_L)$/,color:GREEN,aim:[0,.1,1]},
  {id:'rul',title:'Верхняя доля правого лёгкого',text:'В правом лёгком три доли: верхняя, средняя и нижняя. Их разделяют горизонтальная и косая щели.',match:/^VH_F_right_(apical|posterior|anterior)_bronchopulmonary/,color:BLUE},
  {id:'rml',title:'Средняя доля правого лёгкого',text:'Небольшая доля, которая есть только справа, между горизонтальной и косой щелями.',match:/^VH_F_right_(lateral|medial)_bronchopulmonary/,color:PINK},
  {id:'rll',title:'Нижняя доля правого лёгкого',text:'Самая большая доля правого лёгкого. Образует большую часть его задней и нижней поверхностей и лежит на диафрагме.',match:/^VH_F_right_(posterior_basal|lateral_basal)_bronchopulmonary/,color:AMBER},
  {id:'lul',title:'Верхняя доля левого лёгкого',text:'В левом лёгком две доли. В верхней доле находится язычок — аналог средней доли правого лёгкого.',match:/^VH_F_(left_apical|left_anterior)_bronchopulmonary/,color:GREEN},
  {id:'lingula',title:'Язычок левого лёгкого',text:'Язычковидный выступ верхней доли левого лёгкого, прилежащий к сердцу.',match:/^VH_F_lingula_(superior|inferior)_bronchopulmonary/,color:VIOLET},
  {id:'lll',title:'Нижняя доля левого лёгкого',text:'Лежит позади и ниже косой щели и опирается на диафрагму.',match:/^VH_F_left_(posterior_basal|lateral_basal)_bronchopulmonary/,color:CYAN},
  {id:'hilum',title:'Ворота лёгкого',text:'Место, где в лёгкое входят бронх, лёгочные артерии и вены, нервы и лимфатические сосуды.',match:/^VH_F_hilum_R$/,color:BLUE},
  {id:'segment',title:'Бронхолёгочный сегмент',text:'Каждая доля делится на сегменты, у каждого из которых свой сегментарный бронх и артерия. Сегмент можно удалить хирургически.',match:/^VH_F_right_apical_bronchopulmonary/,color:PINK},
 ],
};

// ------------------------------------------------------------------------------------------------ Heart
const heartGroupOf=(id:string)=>{
 if(has(id,'interventricular_septum','_ventricle','cardiac_atrium')&&!has(id,'vein'))return 'muscle';
 if(has(id,'papillary','_valve'))return 'inner';
 if(has(id,'coronary_artery','left_anterior_descending','left_circumflex','diagonal_branch','left_marginal','left_posterior_descending','posterior_left_ventricular','right_marginal','coronary_sinus','great_cardiac','oblique_vein','posterior_vein_of_left'))return 'coronary';
 return 'vessels';
};
export const HEART:OrganDef={
 id:'heart',name:'Сердце',latin:'Cor',tagline:'Четырёхкамерный насос, который гонит кровь по всему телу и через лёгкие.',view:[.3,.08,1],
 groups:[{id:'muscle',label:'Мышца сердца',color:'#c23b36'},{id:'vessels',label:'Крупные сосуды',color:'#5f78d6'},{id:'coronary',label:'Венечные сосуды',color:'#e5574e'},{id:'inner',label:'Клапаны и сосочковые мышцы',color:'#eadfc6'}],
 groupOf:heartGroupOf,
 look:(id,group)=>{
  if(group==='muscle'){
   if(has(id,'left_ventricle'))return glossy('#b7312e',.36,.5);
   if(has(id,'right_ventricle'))return glossy('#c4443f',.36,.5);
   if(has(id,'septum'))return glossy('#a92b2b',.4,.4);
   return glossy(has(id,'left_cardiac')?'#bd4742':'#cf5a52',.38,.5);
  }
  if(group==='inner')return has(id,'papillary')?matte('#c9806f',.5):glossy('#eadfc6',.4,.4);
  if(group==='coronary')return has(id,'sinus','vein')?glossy('#6a5fc0',.35,.5):glossy('#ee5a50',.32,.6);
  if(has(id,'pulmonary_trunk','pulmonary_artery'))return glossy('#6a73d2',.34,.55);
  if(has(id,'vena_cava'))return glossy('#4d6fb8',.34,.55);
  if(has(id,'pulmonary_vein'))return glossy('#d4524b',.34,.55);
  return glossy('#e0463c',.32,.6);
 },
 hotspots:[
  {id:'aorta',title:'Аорта',text:'Главная артерия, выходящая из сердца. Несёт насыщенную кислородом кровь от левого желудочка ко всему телу.',match:/^VH_F_aortic_arch$/,color:AMBER},
  {id:'branches',title:'Ветви дуги аорты',text:'От дуги аорты отходят три артерии: плечеголовной ствол, левая общая сонная и левая подключичная артерии.',match:/^VH_F_brachiocephalic_artery_b$/,color:PINK},
  {id:'ptrunk',title:'Лёгочный ствол',text:'Несёт бедную кислородом кровь от правого желудочка к лёгким. Делится на правую и левую лёгочные артерии.',match:/^VH_F_pulmonary_trunk$/,color:BLUE},
  {id:'svc',title:'Верхняя полая вена',text:'Возвращает кровь от головы, шеи и рук в правое предсердие.',match:/^VH_F_superior_vena_cava$/,color:CYAN},
  {id:'ivc',title:'Нижняя полая вена',text:'Возвращает кровь от нижней половины тела в правое предсердие.',match:/^VH_F_inferior_vena_cava_a$/,color:VIOLET},
  {id:'pveins',title:'Лёгочные вены',text:'Приносят насыщенную кислородом кровь из лёгких в левое предсердие. Это единственные вены взрослого человека, несущие артериальную кровь.',match:/^VH_F_pulmonary_vein_(L_sup|R_sup)$/,color:GREEN},
  {id:'ra',title:'Правое предсердие',text:'Принимает бедную кислородом кровь из тела по полым венам и передаёт её в правый желудочек.',match:/^VH_F_right_cardiac_atrium$/,color:BLUE},
  {id:'rv',title:'Правый желудочек',text:'Выталкивает бедную кислородом кровь к лёгким через клапан лёгочного ствола.',match:/^VH_F_right_ventricle$/,color:PINK},
  {id:'la',title:'Левое предсердие',text:'Принимает насыщенную кислородом кровь из лёгких по лёгочным венам.',match:/^VH_F_left_cardiac_atrium$/,color:AMBER},
  {id:'lv',title:'Левый желудочек',text:'Самая сильная камера. Выбрасывает насыщенную кислородом кровь в аорту; его стенка заметно толще, чем у правого желудочка.',match:/^VH_F_left_ventricle$/,color:GREEN},
  {id:'lad',title:'Венечные артерии',text:'Отходят от начала аорты и питают саму сердечную мышцу. Показана передняя межжелудочковая ветвь левой венечной артерии. Закупорка венечной артерии может привести к инфаркту миокарда.',match:/^VH_F_left_anterior_descending_artery$/,color:AMBER},
  {id:'sinus',title:'Венечный синус',text:'Собирает кровь из вен сердца и впадает в правое предсердие.',match:/^VH_F_coronary_sinus$/,color:VIOLET},
  {id:'septum',title:'Межжелудочковая перегородка',text:'Мышечная стенка, разделяющая левый и правый желудочки.',match:/^VH_F_interventricular_septum$/,color:CYAN},
  {id:'valve',title:'Клапан аорты',text:'Открывается, пропуская кровь из левого желудочка в аорту, и закрывается, не давая ей вернуться.',match:/^VH_F_aortic_valve$/,color:PINK},
  {id:'papillary',title:'Папиллярные (сосочковые) мышцы',text:'Мышцы внутри желудочков. Натягивают сухожильные нити, прикреплённые к створкам клапанов, чтобы створки не выворачивались назад.',match:/^VH_F_papillary_muscle_of_heart_antlat$/,color:GREEN},
 ],
};

// ------------------------------------------------------------------------------------------------ Brain
const bid=(id:string)=>id.replace(/^Allen_/,'').replace(/_(L|R)$/,'');
const FRONTAL=/^(precentral_gyrus|superior_frontal_gyrus|middle_frontal_gyrus|inferior_frontal_gyrus|gyrus_rectus|medial_orbital|anterior_intermediate_orbital|posterior_intermediate_orbital|lateral_orbital|paracentral_lobule_rostral|frontal_operculum|rostral_gyrus|frontomarginal|frontal_pole|paracingulate|olfactory)/;
const PARIETAL=/^(postcentral_gyrus|supraparietal|supramarginal|angular_gyrus|precuneus|paracentral_lobule_caudal|parietal_operculum)/;
const TEMPORAL=/^(superior_temporal|middle_temporal|inferior_temporal|occipitotemporal_fusiform_gyrus_temporal|transverse_temporal|planum_|temporal_pole|perirhinal|lateral_olfactory_gyrus)/;
const OCCIPITAL=/^(occipital_pole|cuneus|lingual_gyrus|lateral_occipitotemporal_fusiform_gyrus_occipital|inferior_occipital|superior_occipital)/;
const LIMBIC=/^(cingulate|cingulo_parahippocampal|ingulo_parahippocampal|subcallosal|anterior_parahippocampal|posterior_parahippocampal|gyrus_ambiens|long_insular|short_insular|limen_insula|piriform|frontal_agranular|temporal_agranular)/;
const CEREBELLUM=/^(cerebellar_vermis|cerebellar_deep|paravermis|lateral_hemisphere_of_cerebellum|white_matter_of_hindbrain)/;
const BRAINSTEM=/^(midbrain_tegmentum|pontine_tegmentum|tegmentum_of_medulla|pyramidal_part_of_medulla|inferior_olive|cerebral_peduncle|superior_cerebellar_peduncle|middle_cerebellar_peduncle|inferior_cerebellar_peduncle|substantia_nigra|red_nucleus|superior_colliculus|inferior_colliculus|pretectal|cerebral_aqueduct|fourth_ventricle|central_canal)/;
const brainGroupOf=(id:string)=>{
 const b=bid(id);
 if(FRONTAL.test(b))return 'frontal';
 if(PARIETAL.test(b))return 'parietal';
 if(TEMPORAL.test(b))return 'temporal';
 if(OCCIPITAL.test(b))return 'occipital';
 if(LIMBIC.test(b))return 'limbic';
 if(CEREBELLUM.test(b))return 'cerebellum';
 if(BRAINSTEM.test(b))return 'brainstem';
 return 'deep';
};
const BRAIN_TONES:Record<string,string>={frontal:'#e59a9a',parietal:'#e8bb70',temporal:'#82c49b',occipital:'#7fa9e6',limbic:'#bf97d9',cerebellum:'#c9a27e',brainstem:'#d9c27a',deep:'#d4c9bf'};
export const BRAIN:OrganDef={
 id:'brain',name:'Головной мозг',latin:'Encephalon',tagline:'Центр управления организмом. Отключите доли, чтобы заглянуть внутрь.',view:[1,.18,.25],
 groups:[{id:'frontal',label:'Лобная доля',color:BRAIN_TONES.frontal},{id:'parietal',label:'Теменная доля',color:BRAIN_TONES.parietal},{id:'temporal',label:'Височная доля',color:BRAIN_TONES.temporal},{id:'occipital',label:'Затылочная доля',color:BRAIN_TONES.occipital},{id:'limbic',label:'Лимбическая система и островок',color:BRAIN_TONES.limbic},{id:'cerebellum',label:'Мозжечок',color:BRAIN_TONES.cerebellum},{id:'brainstem',label:'Ствол мозга',color:BRAIN_TONES.brainstem},{id:'deep',label:'Глубокие структуры',color:BRAIN_TONES.deep}],
 groupOf:brainGroupOf,
 look:(id,group)=>{
  if(group==='deep'){
   const b=bid(id);
   if(/ventricle|aqueduct/.test(b))return glossy('#7aa7d6',.3,.5);
   if(/hippocampus/.test(b))return glossy('#d98cc1',.4,.4);
   if(/amygdal/.test(b))return glossy('#e0705f',.4,.4);
   if(/thalamus|geniculate/.test(b))return glossy('#e6b457',.4,.4);
   if(/caudate|putamen|pallid|accumbens|claustrum/.test(b))return glossy('#7cc4a4',.4,.4);
   if(/corpus_callosum|commissure|fornix/.test(b))return matte('#f1ece4',.5);
   if(/white_matter/.test(b))return matte('#e9e2d8',.7);
   return glossy('#cfae9c',.42,.35);
  }
  return {color:BRAIN_TONES[group],roughness:.5,clearcoat:.35,clearcoatRoughness:.5};
 },
 hotspots:[
  {id:'motor',title:'Двигательная кора',text:'Предцентральная извилина управляет произвольными движениями противоположной половины тела.',match:/^Allen_precentral_gyrus_R$/,color:BLUE},
  {id:'frontal',title:'Лобная доля',text:'Планирование, принятие решений, личность и речь. Самая большая доля мозга.',match:/^Allen_superior_frontal_gyrus_R$/,color:PINK},
  {id:'sensory',title:'Чувствительная кора',text:'Постцентральная извилина получает ощущения прикосновения, давления, температуры и боли от противоположной половины тела.',match:/^Allen_postcentral_gyrus_R$/,color:AMBER},
  {id:'parietal',title:'Теменная доля',text:'Объединяет сенсорную информацию, обеспечивает ориентацию в пространстве и внимание.',match:/^Allen_supraparietal_lobule_R$/,color:GREEN},
  {id:'temporal',title:'Височная доля',text:'Участвует в слухе, понимании речи и памяти.',match:/^Allen_middle_temporal_gyrus_R$/,color:VIOLET},
  {id:'occipital',title:'Зрительная кора',text:'Затылочная доля обрабатывает зрительную информацию. Первичная зрительная кора расположена вокруг шпорной борозды.',match:/^Allen_(occipital_pole|cuneus)_R$/,color:CYAN},
  {id:'cerebellum',title:'Мозжечок',text:'Координирует движения, равновесие и позу и помогает отрабатывать двигательные навыки.',match:/^Allen_lateral_hemisphere_of_cerebellum_R$/,color:PINK},
  {id:'brainstem',title:'Ствол мозга',text:'Соединяет мозг со спинным мозгом и управляет дыханием, частотой сердцебиения и бодрствованием.',match:/^Allen_pontine_tegmentum_R$/,color:AMBER},
  {id:'callosum',title:'Мозолистое тело',text:'Широкая полоса примерно из 200 миллионов нервных волокон, соединяющая правое и левое полушария.',match:/^Allen_corpus_callosum_R$/,color:BLUE},
  {id:'thalamus',title:'Таламус',text:'«Передаточная станция», которая направляет сенсорные сигналы в кору больших полушарий и участвует в бодрствовании.',match:/^Allen_thalamus_R$/,color:GREEN},
  {id:'hippocampus',title:'Гиппокамп',text:'Необходим для формирования новых долговременных воспоминаний и для ориентации в пространстве.',match:/^Allen_body_of_hippocampus_R$/,color:VIOLET},
  {id:'amygdala',title:'Миндалевидное тело',text:'Обрабатывает эмоции, особенно страх, и придаёт воспоминаниям эмоциональную окраску.',match:/^Allen_amygdaloid_complex_R$/,color:PINK},
  {id:'basal',title:'Базальные ганглии',text:'Хвостатое ядро и скорлупа помогают выбирать и запускать движения и участвуют в формировании привычек.',match:/^Allen_putamen_R$/,color:CYAN},
  {id:'ventricle',title:'Боковой желудочек',text:'Полость мозга, заполненная спинномозговой жидкостью (ликвором). Она защищает мозг от ударов и участвует в его обмене веществ.',match:/^Allen_body_of_lateral_ventricle_R$/,color:AMBER},
 ],
};

export const ORGANS:OrganDef[]=[LUNGS,BRAIN,HEART];
export const ORGAN_BY_ID:Record<OrganId,OrganDef>={lungs:LUNGS,brain:BRAIN,heart:HEART};

/** Display name of a piece: the first letter is capitalised (the dictionary gives lower-case Russian names). */
export function displayName(name:string){
 const cleaned=name.replace(/\s+/g,' ').trim();
 return cleaned.charAt(0).toLocaleUpperCase('ru')+cleaned.slice(1);
}
