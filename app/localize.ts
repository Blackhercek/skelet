import type {Atlas} from './anatomy';

/** English anatomical name (lower case, single spaces) → Russian name. Built by scripts/build-names-ru.mjs. */
export type NameDict=Record<string,string>;
export const NAMES_URL='/models/names-ru.json';
export const LATIN_URL='/models/names-la.json';

const key=(name:string)=>name.replace(/\s+/g,' ').trim().toLowerCase();
export const capitalize=(text:string)=>text.charAt(0).toLocaleUpperCase('ru')+text.slice(1);
/** Search should not care about "ё" vs "е" or letter case. */
export const normalize=(text:string)=>text.toLowerCase().replace(/ё/g,'е');

// The side labels of the Allen brain pieces do not match the side of the body in the source atlas, so they are not shown.
const SIDE_SUFFIX=/\s*\((левый|левая|левое|правый|правая|правое|слева|справа)\)\s*$/i;

export function russianName(dict:NameDict,name:string,brain=false){
 let text=dict[key(name)]??name;
 if(brain)text=text.replace(SIDE_SUFFIX,'');
 return capitalize(text);
}

/** Gives every piece and concept of the atlas a Russian display name and keeps the English one in `nameEn`. Safe to call twice. */
export function localizeAtlas(atlas:Atlas,dict:NameDict,latin:NameDict={}):Atlas{
 if(atlas.localized)return atlas;
 atlas.parts.forEach(p=>{p.nameEn=p.name;p.nameLa=latin[key(p.name)]||undefined;p.name=russianName(dict,p.name,p.id.startsWith('Allen_'));});
 atlas.concepts.forEach(c=>{c.nameEn=c.name;c.nameLa=latin[key(c.name)]||undefined;c.name=russianName(dict,c.name,c.elements.length>0&&c.elements.every(id=>id.startsWith('Allen_')));});
 atlas.localized=true;
 return atlas;
}
