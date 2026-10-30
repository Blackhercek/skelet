import {atlasUrl,type Atlas,type Quality} from './anatomy';
import {NAMES_URL} from './localize';
import {ORGANS_URL,type OrganPack} from './organs';
import {asset,fetchJson} from './model-cache';

const CACHE='atlas-data-v1'; // the same cache the service worker reads from

/** Offline copies need a secure page (https or localhost) and the Cache API. */
export const offlineSupported=()=>typeof caches!=='undefined'&&window.isSecureContext;

/** Approximate download size in MB. */
export const offlineSize=(quality:Quality)=>quality==='lite'?32:67;

/** Saves everything the atlas needs (both bodies at the chosen quality, the organs and the Russian names) on the device. */
export async function downloadForOffline(quality:Quality,onProgress:(done:number,total:number)=>void){
 const urls=[NAMES_URL,ORGANS_URL];
 for(const sex of ['male','female'] as const){
  const url=atlasUrl(sex,quality),manifest=await fetchJson<Atlas>(url);
  urls.push(url,...manifest.chunks.map(c=>c.gzip??c.url));
 }
 const pack=await fetchJson<OrganPack>(ORGANS_URL);urls.push(pack.gzip??pack.url);
 const absolute=[...new Set(urls.map(u=>new URL(asset(u),location.href).href))];
 const cache=await caches.open(CACHE);
 try{await navigator.storage?.persist?.();}catch{/* the browser may refuse: the copy still works until it is cleaned up */}
 let done=0;
 for(const url of absolute){if(!(await cache.match(url)))await cache.add(url);onProgress(++done,absolute.length);}
}
