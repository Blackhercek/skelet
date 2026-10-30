import {useRef,useState} from 'react';
import {ArrowUpRight,X} from 'lucide-react';
import {useFocusTrap} from './focus';
import {downloadForOffline,offlineSize,offlineSupported} from './offline';
import type {Quality} from './anatomy';

interface Props {quality:Quality;onQuality:(quality:Quality)=>void;onClose:()=>void}

export default function AboutDialog({quality,onQuality,onClose}:Props){
 const dialog=useRef<HTMLElement>(null),close=useRef<HTMLButtonElement>(null);
 const [offline,setOffline]=useState<{state:'idle'|'working'|'done'|'error';done:number;total:number}>({state:'idle',done:0,total:0});
 useFocusTrap(dialog,close);
 const save=()=>{
  setOffline({state:'working',done:0,total:1});
  downloadForOffline(quality,(done,total)=>setOffline({state:'working',done,total})).then(()=>setOffline(o=>({...o,state:'done'}))).catch(()=>setOffline(o=>({...o,state:'error'})));
 };
 const supported=offlineSupported();
 return <div className="modal" role="presentation" onMouseDown={e=>{if(e.target===e.currentTarget)onClose();}}><section ref={dialog} className="about-dialog glass" role="dialog" aria-modal="true" aria-labelledby="about-title">
  <button ref={close} className="icon close" onClick={onClose} aria-label="Закрыть"><X size={18}/></button>
  <p className="eyebrow">Настройки и сведения</p><h2 id="about-title">Тело — деталь за деталью</h2>
  <p>Изучайте анатомию взрослого человека по частям: разводите каждую структуру в стороны, снимайте слои, ищите структуры по названию и открывайте сердце, лёгкие и головной мозг в 3D. Названия даны на русском, латинском (по Terminologia Anatomica, где есть устоявшийся термин) и английском языках.</p>

  <h3>Качество 3D-модели</h3>
  <div className="seg wide" role="group" aria-label="Качество модели">
   <button aria-pressed={quality==='lite'} onClick={()=>onQuality('lite')}>Лёгкое</button>
   <button aria-pressed={quality==='high'} onClick={()=>onQuality('high')}>Высокое</button>
  </div>
  <p className="note">{quality==='lite'?'Те же структуры, около 40 % треугольников: быстрее загружается и плавно работает на телефонах. Выбрано для вашего устройства автоматически.':'Максимальная детализация. Рекомендуется для компьютеров и новых планшетов; на телефоне может работать медленнее.'}</p>

  <h3>Работа без интернета</h3>
  {supported?<>
   <p>Скачайте модели на устройство один раз (≈{offlineSize(quality)} МБ), и атлас будет открываться без сети — в метро, самолёте или аудитории без Wi-Fi.</p>
   <button className="primary compact" onClick={save} disabled={offline.state==='working'}>{offline.state==='working'?`Скачиваем… ${Math.round(offline.done/Math.max(1,offline.total)*100)} %`:offline.state==='done'?'Готово — работает без интернета':'Скачать для работы без интернета'}</button>
   {offline.state==='error'&&<p className="note" role="alert">Не удалось скачать. Проверьте подключение и свободное место на устройстве и попробуйте ещё раз.</p>}
  </>:<p className="note">Офлайн-режим доступен, когда атлас открыт по защищённому адресу (https) или на этом же устройстве. Подробности — в файле «ЗАПУСК.md».</p>}

  <h3>Мужская модель — BodyParts3D</h3><p>2 234 отдельные детали и 3 432 названные структуры эталонной мужской анатомии. © The Database Center for Life Science, лицензия CC BY 4.0.</p>
  <h3>Женская модель и органы — Human Reference Atlas</h3><p>Женская эталонная сборка (888 деталей, скелет и мышцы представлены частично) и подробные модели сердца, лёгких и головного мозга взяты из 3D-эталонных органов проекта HuBMAP Human Reference Atlas (авторы Kristen Browne и Heidi Schlehlein, лицензия CC BY 4.0). Модели органов одинаковы для обеих моделей тела.</p>
  <p className="note">Геометрия упрощена для веб-просмотра, цвета и группировки подобраны для удобства изучения, а описания дают общие учебные сведения. Атлас не предназначен для диагностики или хирургического планирования.</p>
  <div className="links"><a href="https://dbarchive.biosciencedbc.jp/en/bodyparts3d/lic.html" target="_blank" rel="noreferrer">Лицензия BodyParts3D <ArrowUpRight size={13}/></a><a href="https://doi.org/10.48539/HBM352.BTSQ.586" target="_blank" rel="noreferrer">Human Reference Atlas <ArrowUpRight size={13}/></a><a href="https://github.com/ashemag/human-atlas" target="_blank" rel="noreferrer">Исходный открытый просмотрщик (MIT) <ArrowUpRight size={13}/></a></div>
 </section></div>;
}
