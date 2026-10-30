import {gunzipSync} from 'fflate';

/** Static hosts may serve .gz as a compressed response or as a gzip file.
 * Fetch already decodes Content-Encoding; inspect the payload to avoid decoding twice.
 * Browsers without DecompressionStream (iOS before 16.4) use a small JavaScript decoder instead.
 */
export async function decodeModelResponse(response:Response,expectedBytes:number,compressed:boolean):Promise<ArrayBuffer>{
 if(!response.ok)throw new Error('Не удалось загрузить файл анатомии.');
 const payload=await response.arrayBuffer(),signature=new Uint8Array(payload,0,Math.min(2,payload.byteLength));
 const gzip=compressed&&signature[0]===0x1f&&signature[1]===0x8b;
 let buffer:ArrayBuffer=payload;
 if(gzip){
  if(typeof DecompressionStream!=='undefined')buffer=await new Response(new Blob([payload]).stream().pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  else{const out=gunzipSync(new Uint8Array(payload));buffer=out.buffer.slice(out.byteOffset,out.byteOffset+out.byteLength) as ArrayBuffer;}
 }
 if(buffer.byteLength!==expectedBytes)throw new Error('Файл анатомии загружен не полностью. Перезагрузите страницу.');
 return buffer;
}
