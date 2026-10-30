/** First screen: replaces the whole interface until the body is loaded. The same markup sits in web/index.html, so it shows before any script runs. */
export default function StartScreen({progress}:{progress:number}){
 return <div className="start" role="status" aria-label={`Загрузка ${progress}%`}>
  <strong className="start-title">Загрузка</strong>
  <span className="start-percent" aria-hidden="true">{progress}%</span>
  <div className="start-track" aria-hidden="true"><i style={{width:`${progress}%`}}/></div>
  <span className="start-credit">Сделано для Женьки</span>
 </div>;
}
