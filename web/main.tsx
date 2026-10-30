/// <reference types="vite/client" />
import {createRoot} from 'react-dom/client';
import Home from '../app/page';
import '../app/globals.css';

createRoot(document.getElementById('root')!).render(<Home/>);

// Offline mode and "add to home screen" need the service worker; it is only used by the built app, never by the dev server.
if('serviceWorker' in navigator&&import.meta.env.PROD){
 addEventListener('load',()=>{navigator.serviceWorker.register('./sw.js').catch(()=>{/* not available here (for example plain http): the atlas still works online */});});
}
