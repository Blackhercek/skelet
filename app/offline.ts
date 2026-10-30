import {atlasUrl,type Atlas,type Quality} from './anatomy';
import {LATIN_URL,NAMES_URL} from './localize';
import {ORGANS_URL,type OrganPack} from './organs';
import {asset,fetchJson} from './model-cache';

const CACHE='atlas-data-v1'; // the same cache the service worker reads from

/** Offline copies need a secure page (https or localhost) and the Cache API. */
export const offlineSupported=()=>typeof caches!=='undefined'&&window.isSecureContext;

/** Approximate download size in MB. */
export const offlineSize=(quality:Quality)=>quality==='lite'?26:44;

/** Asks the service worker to keep the page and its scripts/styles/icons: before that only data is on the device and the first offline start finds no page. */
async function saveShell(){
 const timeout=(ms:number)=>new Promise<never>((_,reject)=>setTimeout(()=>reject(new Error('service worker')),ms));
 const worker=(await Promise.race([navigator.serviceWorker.ready,timeout(20000)])).active;
 if(!worker)throw new Error('service worker');
 const files=[...document.querySelectorAll<HTMLScriptElement|HTMLLinkElement>('script[src],link[href]')].map(el=>el instanceof HTMLScriptElement?el.src:el.href);
 const urls=[...new Set([new URL('./',location.href).href,new URL('./index.html',location.href).href,...files])];
 await Promise.race([new Promise<void>((resolve,reject)=>{
  const channel=new MessageChannel();
  channel.port1.onmessage=e=>e.data?.ok?resolve():reject(new Error(e.data?.error??'shell'));
  worker.postMessage({type:'cache-shell',urls},[channel.port2]);
 }),timeout(60000)]);
}

/** Saves everything the atlas needs (the page itself, the body at the chosen quality, the organs and the Russian names) on the device. */
export async function downloadForOffline(quality:Quality,onProgress:(done:number,total:number)=>void){
 await saveShell();
 const urls=[NAMES_URL,LATIN_URL,ORGANS_URL];
 const url=atlasUrl('male',quality),manifest=await fetchJson<Atlas>(url);
 urls.push(url,...manifest.chunks.map(c=>c.gzip??c.url));
 const pack=await fetchJson<OrganPack>(ORGANS_URL);urls.push(pack.gzip??pack.url);
 const absolute=[...new Set(urls.map(u=>new URL(asset(u),location.href).href))];
 const cache=await caches.open(CACHE);
 try{await navigator.storage?.persist?.();}catch{/* the browser may refuse: the copy still works until it is cleaned up */}
 let done=0;
 for(const url of absolute){if(!(await cache.match(url)))await cache.add(url);onProgress(++done,absolute.length);}
}
