/** Draws the 3D canvas onto a dark card with a caption and offers it as an image (share sheet on phones, download elsewhere). */
export function saveSnapshot(capture:()=>HTMLCanvasElement|null,caption:string):'shared'|'downloaded'|'failed'{
 // Everything up to the share call is synchronous, so the browser still counts it as a tap (needed on iPhone).
 const source=capture();if(!source||!source.width)return 'failed';
 const w=source.width,h=source.height,out=document.createElement('canvas');out.width=w;out.height=h;
 const g=out.getContext('2d');if(!g)return 'failed';
 const glow=g.createRadialGradient(w*.4,h*.42,0,w*.4,h*.42,Math.max(w,h)*.8);glow.addColorStop(0,'#131a2a');glow.addColorStop(1,'#090c12');
 g.fillStyle=glow;g.fillRect(0,0,w,h);g.drawImage(source,0,0);
 const pad=Math.round(Math.min(w,h)*.04),size=Math.round(Math.min(w,h)*.034);
 g.textBaseline='bottom';g.fillStyle='rgba(255,255,255,.9)';g.font=`600 ${size}px -apple-system,"Helvetica Neue",Arial,sans-serif`;g.fillText(caption,pad,h-pad);
 g.textAlign='right';g.fillStyle='rgba(255,255,255,.45)';g.font=`${Math.round(size*.7)}px -apple-system,"Helvetica Neue",Arial,sans-serif`;g.fillText('Атлас тела человека',w-pad,h-pad);
 const base64=out.toDataURL('image/png').split(',')[1];
 const bytes=Uint8Array.from(atob(base64),c=>c.charCodeAt(0));
 const name=`${caption.replace(/[^\p{L}\p{N}]+/gu,'-').replace(/^-|-$/g,'').slice(0,60)||'anatomy'}.png`;
 const file=new File([bytes],name,{type:'image/png'});
 if(typeof navigator.canShare==='function'&&navigator.canShare({files:[file]})){
  navigator.share({files:[file],title:caption}).catch(()=>{/* the user closed the share sheet */});
  return 'shared';
 }
 const url=URL.createObjectURL(file),link=document.createElement('a');
 link.href=url;link.download=name;document.body.appendChild(link);link.click();link.remove();
 setTimeout(()=>URL.revokeObjectURL(url),10_000);
 return 'downloaded';
}
