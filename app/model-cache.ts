import {decodeModelResponse} from './model-download';

/** Data files are listed as "/models/…": resolve them next to the page so the atlas works from any folder or host. */
export const asset=(url:string)=>url.startsWith('/')?`./${url.slice(1)}`:url;

export interface ChunkInfo {url:string;bytes:number;gzip?:string;gzipBytes?:number}

/** Decoded geometry chunks are kept for the whole session, so switching sex or opening an organ never downloads the same file twice. */
const chunks=new Map<string,Promise<ArrayBuffer>>();

export function fetchChunk(chunk:ChunkInfo):Promise<ArrayBuffer>{
 const known=chunks.get(chunk.url);
 if(known)return known;
 const compressed=!!chunk.gzip;
 const request=fetch(asset(compressed?chunk.gzip!:chunk.url)).then(response=>decodeModelResponse(response,chunk.bytes,compressed));
 chunks.set(chunk.url,request);
 request.catch(()=>chunks.delete(chunk.url));
 return request;
}

const catalogues=new Map<string,Promise<unknown>>();
export function fetchJson<T>(url:string):Promise<T>{
 const known=catalogues.get(url);
 if(known)return known as Promise<T>;
 const request=fetch(asset(url)).then(r=>{if(!r.ok)throw new Error('Не удалось загрузить каталог анатомии.');return r.json() as Promise<T>;});
 catalogues.set(url,request);
 request.catch(()=>catalogues.delete(url));
 return request;
}
