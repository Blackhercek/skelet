import {useEffect,type RefObject} from 'react';

const FOCUSABLE='button:not([disabled]),a[href],input:not([disabled]),select,textarea,[tabindex]:not([tabindex="-1"])';
const visible=(el:HTMLElement)=>el.offsetParent!==null&&getComputedStyle(el).visibility!=='hidden';

/** Keeps Tab inside a dialog, moves focus into it when it opens and gives focus back when it closes. */
export function useFocusTrap(root:RefObject<HTMLElement|null>,initial?:RefObject<HTMLElement|null>){
 useEffect(()=>{
  const container=root.current;if(!container)return;
  const previous=document.activeElement instanceof HTMLElement?document.activeElement:null;
  (initial?.current??[...container.querySelectorAll<HTMLElement>(FOCUSABLE)].find(visible))?.focus();
  const key=(e:KeyboardEvent)=>{
   if(e.key!=='Tab')return;
   const items=[...container.querySelectorAll<HTMLElement>(FOCUSABLE)].filter(visible);
   if(!items.length)return;
   const first=items[0],last=items[items.length-1],active=document.activeElement;
   if(e.shiftKey&&(active===first||!container.contains(active))){e.preventDefault();last.focus();}
   else if(!e.shiftKey&&(active===last||!container.contains(active))){e.preventDefault();first.focus();}
  };
  document.addEventListener('keydown',key);
  return()=>{document.removeEventListener('keydown',key);previous?.focus?.();};
 },[root,initial]);
}
