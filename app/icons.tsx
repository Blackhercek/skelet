import {Brain,Heart} from 'lucide-react';
import type {OrganId} from './organs';

export function LungsIcon({size=22}:{size?:number}){
 return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
  <path d="M12 3v7.5"/><path d="M12 10.5 8.8 13M12 10.5l3.2 2.5"/>
  <path d="M9.6 8.6C6.6 9.2 3.5 13.6 3.5 18.3c0 1.6 1.1 2.5 2.5 2.5 2 0 3.6-1.5 3.6-4V8.6Z"/>
  <path d="M14.4 8.6c3 .6 6.1 5 6.1 9.7 0 1.6-1.1 2.5-2.5 2.5-2 0-3.6-1.5-3.6-4V8.6Z"/>
 </svg>;
}

export function OrganIcon({organ,size=22}:{organ:OrganId;size?:number}){
 if(organ==='lungs')return <LungsIcon size={size}/>;
 if(organ==='brain')return <Brain size={size} strokeWidth={1.7} aria-hidden="true"/>;
 return <Heart size={size} strokeWidth={1.7} aria-hidden="true"/>;
}
