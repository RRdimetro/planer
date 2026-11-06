import { useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { CalendarDays, Landmark, RefreshCw, Link2, Unplug } from "lucide-react";
import type { State, Item } from "../../../../packages/contracts";
import type { CalendarAction } from "../../../../packages/google-calendar/types";
import { externalCalendarInfo } from "../../../../packages/google-calendar/view";
import { Modal } from "../shared/ui";
import "./google-calendar.css";

export function GoogleCalendarIntegration({s}:{s:State}) {
  const status=s.googleCalendar,qc=useQueryClient();
  const [busy,setBusy]=useState(false),[error,setError]=useState(""),[choice,setChoice]=useState("");
  const [before,setBefore]=useState(status?.commuteBefore??90),[after,setAfter]=useState(status?.commuteAfter??90),[period,setPeriod]=useState(status?.intervalMinutes??15);
  useEffect(()=>{setBefore(status?.commuteBefore??90);setAfter(status?.commuteAfter??90);setPeriod(status?.intervalMinutes??15);},[status?.commuteBefore,status?.commuteAfter,status?.intervalMinutes]);
  const run=async(action:CalendarAction)=>{
    setBusy(true);setError("");
    try {qc.setQueryData(["state"],await window.focusAPI.calendar(action));}
    catch(e){setError(e instanceof Error?e.message:"Не удалось выполнить действие Google Calendar.");}
    finally{setBusy(false);void qc.invalidateQueries({queryKey:["state"]});}
  };
  const demo=s.diagnostics.workspace==="demo";
  return <section className="gcal-integration" aria-label="Настройки → Интеграции → Google Calendar">
    <span className="eyebrow">ИНТЕГРАЦИИ</span>
    <h3><CalendarDays size={20}/> Google Calendar</h3>
    <div className="gcal-connection-state" role="status"><span className={"dot "+(status?.connected?"connected":"")}/>
      {status?.syncing?"Синхронизация…":status?.connected?"Подключено":status?.lastSuccess?"Отключено · сохранённое расписание доступно":"Не подключено"}
    </div>
    <dl className="gcal-details"><dt>Календарь</dt><dd><Landmark size={15}/> {status?.calendar?.summary??"расписание Дима"}</dd>
      <dt>Последняя синхронизация</dt><dd>{status?.lastSuccess?new Date(status.lastSuccess).toLocaleString("ru-RU"):"Ещё не выполнялась"}</dd>
      {status?.windowStart&&status.windowEnd&&<><dt>Доступное расписание</dt><dd>{new Date(status.windowStart).toLocaleDateString("ru-RU")} — {new Date(status.windowEnd).toLocaleDateString("ru-RU")}</dd></>}
    </dl>
    <p className="hint">Только чтение Google → FOCUS. Изменения и отмены обновляются из Google Calendar. При отсутствии сети используется сохранённое расписание.</p>
    {demo&&<p className="hint">Подключение доступно в рабочем пространстве.</p>}
    {(error||status?.error)&&<p className="error" role="alert">{error||status?.error}</p>}
    <div className="row wrap gcal-actions">
      <button disabled={demo||busy} onClick={()=>void run({action:"importClient"})}>{status?.configured?"Заменить OAuth-клиент":"Выбрать OAuth Desktop JSON"}</button>
      <button className="primary" disabled={demo||busy||!status?.configured} onClick={()=>void run({action:"connect"})}><Link2 size={15}/> {status?.connected?"Переподключить":"Подключить Google"}</button>
      <button disabled={demo||busy||status?.syncing||!status?.connected} onClick={()=>void run({action:"sync"})}><RefreshCw size={15}/> Синхронизировать</button>
      <button disabled={demo||(!status?.connected&&!busy&&!status?.choices.length)} onClick={()=>void run({action:"disconnect"})}><Unplug size={15}/> Отключить</button>
    </div>
    {!!status?.choices.length&&<div className="gcal-choice"><label className="field">Выберите календарь с точным названием «расписание Дима»
      <select value={choice} onChange={e=>setChoice(e.target.value)}><option value="">Выберите календарь…</option>{status.choices.map(c=><option key={c.id} value={c.id}>{c.summary} · {c.timeZone} · {c.id}</option>)}</select></label>
      <button disabled={busy||!choice} onClick={()=>void run({action:"choose",calendarId:choice})}>Использовать этот календарь</button>
    </div>}
    <p className="hint">Вход открывается в системном браузере. Пароль получает только Google; OAuth-токены защищены средствами Windows и не включаются в экспорт данных.</p>
    <h4>Дорога до университета</h4>
    <div className="gcal-commute"><label className="field">Туда, минут<input type="number" min={0} max={600} value={before} onChange={e=>setBefore(Number(e.target.value))}/></label>
      <label className="field">Обратно, минут<input type="number" min={0} max={600} value={after} onChange={e=>setAfter(Number(e.target.value))}/></label>
      <label className="field">Обновлять каждые, минут<input type="number" min={5} max={1440} value={period} onChange={e=>setPeriod(Number(e.target.value))}/></label></div>
    <p className="hint">Дорога учитывается перед первым и после последнего занятия дня. Задачи не переносятся автоматически: изменения расписания нужно подтвердить в предпросмотре планировщика.</p>
    <button disabled={busy||demo||![before,after,period].every(Number.isInteger)||before<0||after<0||before>600||after>600||period<5||period>1440} onClick={()=>void run({action:"settings",commuteBefore:before,commuteAfter:after,intervalMinutes:period})}>Сохранить параметры</button>
  </section>;
}

export function GoogleCalendarDetails({item,onClose}:{item:Item;onClose:()=>void}) {
  const data=externalCalendarInfo(item);
  return <Modal title={item.title} onClose={onClose}>
    <p className="hint">{data?.virtual?"Виртуальный интервал дороги. Длительность меняется в Настройках → Интеграции.":"Событие Google Calendar · только чтение. Измените или отмените его в Google Calendar, затем синхронизируйте."}</p>
    <dl className="gcal-details"><dt>Календарь</dt><dd>{data?.calendarName}</dd>
      <dt>Когда</dt><dd>{data?.allDay?`${item.date} · весь день`:data?.sourceStart?.dateTime??data?.segmentStart} — {data?.allDay?data?.sourceEnd?.date:data?.sourceEnd?.dateTime??data?.segmentEnd}</dd>
      <dt>Часовой пояс источника</dt><dd>{data?.sourceTimeZone??data?.displayZone}</dd>
      {data?.location&&<><dt>Место</dt><dd>{data.location}</dd></>}
    </dl>
    {item.description&&<p className="gcal-description">{item.description}</p>}
    {data?.recurringEventId&&<p className="hint">Повторяющееся занятие. Даты и исключения получены из Google Calendar.</p>}
  </Modal>;
}
