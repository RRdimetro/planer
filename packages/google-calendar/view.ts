import type { Item } from "../contracts";
export function externalCalendarInfo(item:Item):any|null {
  try {const value=JSON.parse(item.data||"{}").externalCalendar;return value?.provider==="google-calendar"?value:null;}catch{return null;}
}
export const isExternalCalendarItem=(item:Item)=>Boolean(externalCalendarInfo(item));
