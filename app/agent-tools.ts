import type {Atlas,Concept} from './anatomy';
const normalize=(text:string)=>text.toLowerCase().replace(/ё/g,'е');
type Tool={name:string;description:string;inputSchema:object;annotations:{readOnlyHint:boolean};execute:(input:unknown)=>unknown};
function record(input:unknown):Record<string,unknown>{if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Ожидается объект.');return input as Record<string,unknown>;}
export function atlasTools(atlas:Atlas,inspect:(concept:Concept)=>void):Tool[]{return [
 {name:'find_anatomy',description:'Найти анатомические структуры в этом атласе по названию (русскому или английскому) или по коду.',inputSchema:{type:'object',properties:{query:{type:'string',minLength:1}},required:['query'],additionalProperties:false},annotations:{readOnlyHint:true},execute(input){const data=record(input);if(typeof data.query!=='string'||!data.query.trim())throw new Error('Нужен непустой запрос.');const q=normalize(data.query).trim();return atlas.concepts.filter(c=>normalize(c.name).includes(q)||c.nameEn?.toLowerCase().includes(q)||c.id.toLowerCase().includes(q)).slice(0,30).map(c=>({id:c.id,name:c.name,nameEn:c.nameEn,pieces:c.elements.length}));}},
 {name:'inspect_anatomical_structure',description:'Выбрать структуру атласа в 3D-анатомии и открыть панель с её описанием.',inputSchema:{type:'object',properties:{id:{type:'string'}},required:['id'],additionalProperties:false},annotations:{readOnlyHint:false},execute(input){const data=record(input);if(typeof data.id!=='string')throw new Error('Нужен код структуры в атласе.');const concept=atlas.concepts.find(c=>c.id===data.id);if(!concept)throw new Error('Такой структуры нет в этом атласе.');inspect(concept);return {id:concept.id,name:concept.name,selectedPieces:concept.elements.length};}}
 ];}
export function registerAtlasTools(atlas:Atlas,inspect:(concept:Concept)=>void){
 const context=(document as Document&{modelContext?:{registerTool:(tool:Tool,options:{signal:AbortSignal})=>void|Promise<void>}}).modelContext;
 if(!context?.registerTool)return;const lifecycle=new AbortController();
 for(const tool of atlasTools(atlas,inspect)){try{void Promise.resolve(context.registerTool(tool,{signal:lifecycle.signal})).catch(()=>{});}catch{/* Необязательная возможность браузера: видимый интерфейс работает и без неё. */}}
 return()=>lifecycle.abort();
}
