import {fileURLToPath} from 'node:url';
import fs from 'node:fs';
import {defineConfig,type Plugin} from 'vite';
import react from '@vitejs/plugin-react';

const path=(relative:string)=>fileURLToPath(new URL(relative,import.meta.url));

/** Every build gets its own service-worker version, so installed copies notice the update. */
const stampServiceWorker=():Plugin=>({
 name:'stamp-service-worker',apply:'build',
 closeBundle(){
  const file=path('./dist/sw.js');
  if(fs.existsSync(file))fs.writeFileSync(file,fs.readFileSync(file,'utf8').replace('__BUILD__',new Date().toISOString()));
 },
});

/** The built site only needs the compressed data: the app unpacks it itself (this halves what has to be uploaded). */
const dropRawData=():Plugin=>({
 name:'drop-raw-data',apply:'build',
 closeBundle(){
  for(const folder of ['models','organs']){
   const dir=path(`./dist/${folder}`);
   if(!fs.existsSync(dir))continue;
   for(const name of fs.readdirSync(dir))if(name.endsWith('.bin')&&fs.existsSync(`${dir}/${name}.gz`))fs.rmSync(`${dir}/${name}`);
  }
 },
});

export default defineConfig({
 root:path('./web'),
 // Relative URLs: the built atlas runs from any folder or host, also from a sub-path such as GitHub Pages.
 base:'./',
 publicDir:path('./public'),
 plugins:[react(),stampServiceWorker(),dropRawData()],
 resolve:{alias:{'@':path('./')}},
 server:{watch:{usePolling:true}},
 build:{outDir:path('./dist'),emptyOutDir:true,chunkSizeWarningLimit:1000},
});
