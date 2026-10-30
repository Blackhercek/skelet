import type {Atlas,Part,RegionId} from './anatomy';

export const REGIONS:{id:RegionId;name:string;detail:string}[]=[
 {id:'head',name:'Голова',detail:'Череп, мозг, лицо, глаза, уши'},
 {id:'neck',name:'Шея',detail:'Шейный отдел позвоночника, гортань, щитовидная железа, сосуды'},
 {id:'thorax',name:'Грудная клетка',detail:'Рёбра, сердце, лёгкие, крупные сосуды'},
 {id:'abdomen',name:'Живот',detail:'Желудок, печень, кишечник, почки'},
 {id:'pelvis',name:'Таз',detail:'Кости таза, мочевой пузырь, половые органы'},
 {id:'upper-limb',name:'Верхняя конечность',detail:'Плечевой пояс, плечо, предплечье, кисть'},
 {id:'lower-limb',name:'Нижняя конечность',detail:'Бедро, колено, голень, стопа'},
];

// Landmarks as fractions of standing height (Drillis & Contini proportions).
const HEAD_BASE=.87,NECK_BASE=.80,THORAX_BASE=.70,ABDOMEN_BASE=.56,CROTCH=.47,LIMB_MARGIN=.035;
const ARM_BONE=/\b(humerus|radius|ulna|scaphoid|lunate|triquetr|pisiform|trapezium|trapezoid|capitate|hamate|metacarpal|finger|thumb)/i;
const LEG_BONE=/\b(femur|tibia|fibula|patella|calcaneus|talus|navicular|cuboid|cuneiform bone|metatarsal|toe)/i;
const SHOULDER_GIRDLE=/\b(clavicle|clavicular|scapula|scapular|deltoid|supraspinatus|infraspinatus|subscapularis|teres|acromi|coracoid|glenoid|biceps brachii|triceps brachii|brachialis|coracobrachialis)/i;
// Trunk muscles and organs sit beside the arm but belong to the trunk.
const TRUNK=/\b(ribs?|costal|sternum|sternal|intercostal|thoracic|pleura|pericardi|mediastin|esophag|oesophag|diaphragm|pectoralis|serratus|latissimus|trapezius|rhomboid|levator scapulae|erector|longissimus|iliocostalis|spinalis|oblique|rectus abdominis|transversus|trachea|bronch|lung|pulmon|cardiac|heart|aort|segmental|lingular|lobar|hilum|hilus|thoracis|subclavius)/i;
const NECKISH=/\b(cervic|colli|capitis|laryn|arytenoid|cricothyroid|thyrohyoid|pharyn|levator scapulae|splenius|sternocleidomastoid|scalen)/i;
const ABDOMINAL=/\b(portal|biliary|bile|liver|hepat|spleen|splenic|stomach|gastr|pancrea|gallbladder|cystic|kidney|renal|adrenal|suprarenal|duoden|jejun|ileum|ileal|colon|colic|cecum|caecum|appendix|mesenter|omentum|omental)/i;
const VISCERA=new Set(['digestive','urinary','reproductive','respiratory','cardiac','endocrine','lymphatic']);
const GLUTEAL_THIGH=/\b(gluteus|gluteal|piriformis|sartorius|tensor fasciae|pectineus|adductor|gracilis|obturator externus|quadratus femoris|gemell|iliotibial)/i;
const PELVIC=/\b(pelvic|pelvis|sacr|coccy|pubic|ischi|iliac|ilium|bladder|ureter|urethra|prostate|rectum|anal|uter|ovar|vagin|vulva|testis|testes|scrot|penis|seminal|cervix|sigmoid)/i;

interface Box {lo:number[];hi:number[]}
const near=(box:Box,c:number[],margin:number)=>c.every((v,i)=>v>=box.lo[i]-margin&&v<=box.hi[i]+margin);

/** Region of every piece from where it sits on the standing body. Whole-body pieces (skin, hair) have no region. */
export function assignRegions(atlas:Atlas):Atlas{
 const height=Math.max(...atlas.parts.map(p=>p.bounds[1][1]));
 const limbBoxes=(bone:RegExp,top:number)=>atlas.parts.filter(p=>p.system==='skeletal'&&bone.test(p.nameEn??p.name)&&(p.bounds[0][1]+p.bounds[1][1])/2/height<top).map(p=>({lo:p.bounds[0],hi:p.bounds[1]}));
 const arms=limbBoxes(ARM_BONE,.84),legs=limbBoxes(LEG_BONE,.56),margin=LIMB_MARGIN*height;
 atlas.parts.forEach(p=>{p.region=classify(p,height,arms,legs,margin);});
 return atlas;
}

function classify(p:Part,height:number,arms:Box[],legs:Box[],margin:number):RegionId|null{
 const name=p.nameEn??p.name;
 if(p.system==='integumentary'||p.system==='pregnancy'||/\b(skin|hair|nail)\b/i.test(name))return null;
 const [lo,hi]=p.bounds,c=[(lo[0]+hi[0])/2,(lo[1]+hi[1])/2,(lo[2]+hi[2])/2],r=c[1]/height,span=(hi[1]-lo[1])/height;
 const trunk=TRUNK.test(name);
 if(NECKISH.test(name)&&r<HEAD_BASE&&r>=.7)return 'neck';
 if(!trunk&&GLUTEAL_THIGH.test(name)&&r<ABDOMEN_BASE+.04)return 'lower-limb';
 if(/\b(ribs?|costal cartilages?)\b/i.test(name)&&r>=.5)return 'thorax';
 if(ABDOMINAL.test(name)&&r>=.5&&r<NECK_BASE)return 'abdomen';
 if(!trunk&&r<HEAD_BASE&&!VISCERA.has(p.system)){
  if(SHOULDER_GIRDLE.test(name)&&r>.6)return 'upper-limb';
  if(arms.some(b=>near(b,c,margin)))return 'upper-limb';
  if(!GLUTEAL_THIGH.test(name)&&!PELVIC.test(name)&&legs.some(b=>near(b,c,margin)))return 'lower-limb';
 }
 if(span>.3&&!trunk)return null;
 if(r>=HEAD_BASE)return 'head';
 if(trunk&&r>=ABDOMEN_BASE)return r>=THORAX_BASE-.04?'thorax':'abdomen';
 if(r>=NECK_BASE)return 'neck';
 if(r>=THORAX_BASE)return 'thorax';

 if(PELVIC.test(name)&&r>=.38&&r<ABDOMEN_BASE+.03)return 'pelvis';
 if(r>=ABDOMEN_BASE)return 'abdomen';
 if(r>=CROTCH)return 'pelvis';
 return 'lower-limb';
}
