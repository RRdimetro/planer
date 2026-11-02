import React,{useState} from 'react';
import {createRoot} from 'react-dom/client';
import '../shared/theme.css';
function App(){const [page,setPage]=useState('Главная');const [status,setStatus]=useState('Загрузка');React.useEffect(()=>{window.focusAPI.state().then(s=>setStatus(s.diagnostics.integrity));},[]);return <div className="shell"><aside><h2>FOCUS OS PRO</h2>{['Главная','Планировщик','Задачи','Проекты','Учёба','Тренировки','Аналитика','Фокус','Заметки','Настройки'].map(p=><button key={p} onClick={()=>setPage(p)}>{p}</button>)}</aside><div className="workspace"><main><h1>{page}</h1><section><h2>Основа вашего пространства</h2><p>SQLite · {status} · Миграция 1</p><p>Модуль будет реализован на следующем этапе. Данные не подменяются демонстрационными.</p></section></main></div></div>};
createRoot(document.getElementById('root')!).render(<App/>);
