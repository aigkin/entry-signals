const DAY=86400000;
const sessionFormatter=new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'});
let sessionMinute=null,sessionDay=null,sessionClosed=false;
export function completedSession(date,now=Date.now()){
 const minute=Math.floor(now/60000);
 if(minute!==sessionMinute){
  const parts=Object.fromEntries(sessionFormatter.formatToParts(new Date(now)).map(p=>[p.type,p.value]));
  sessionMinute=minute;sessionDay=`${parts.year}-${parts.month}-${parts.day}`;sessionClosed=Number(parts.hour)>=17;
 }
 return date<sessionDay||(date===sessionDay&&sessionClosed);
}
export function parseHistory(html,now=Date.now()){
 const found=html.match(/data:\[([^\]]+)\]/g)||[];let rows=[];
 for(const block of found){const items=[...block.matchAll(/\{([^{}]+)\}/g)].map(m=>{const t=m[1].match(/(?:^|,)t:"(\d{4}-\d{2}-\d{2})"/);if(!t)return null;const r={date:t[1]};for(const k of ['o','h','l','c','v','a']){const n=m[1].match(new RegExp('(?:^|,)'+k+':(-?(?:[0-9]+(?:\\.[0-9]*)?|\\.[0-9]+))(?=,|$)'));r[k]=n?Number(n[1]):null;}return r;}).filter(r=>r&&r.c>0&&r.h>0&&r.l>0&&r.v>=0&&r.v!==null&&completedSession(r.date,now));if(items.length>rows.length)rows=items;}
 rows=[...new Map(rows.map(r=>[r.date,r])).values()].sort((a,b)=>a.date.localeCompare(b.date));if(rows.length<21)throw Error('可用历史不足');return rows;
}
export function priceMetrics(rows,now=Date.now()){
 if(rows.length<21)return {date:rows.at(-1)?.date,count:rows.length,close:rows.at(-1)?.c,stale:true};
 const last=rows.at(-1),prev=rows.at(-2);const mean=a=>a.reduce((s,v)=>s+v,0)/a.length;const closes=rows.map(r=>r.c);const volumes=rows.slice(-21,-1).map(r=>r.v);const avgVolume=volumes.every(Number.isFinite)?mean(volumes):null;
 const out={date:last.date,count:rows.length,close:last.c,stale:now-Date.parse(last.date+'T00:00:00Z')>5*DAY,stabilize:(last.c/prev.h-1)*100,volume:avgVolume>0&&Number.isFinite(last.v)?last.v/avgVolume:null,return20:(last.c/rows.at(-21).c-1)*100};
 if(rows.length>=50)out.ma50=(last.c/mean(closes.slice(-50))-1)*100;if(rows.length>=60)out.drawdown=(last.c/Math.max(...closes.slice(-60))-1)*100;if(rows.length>=200)out.ma200=(last.c/mean(closes.slice(-200))-1)*100;
 // Raw OHLC is used consistently. Obvious split discontinuities invalidate signals.
 out.discontinuity=rows.slice(-200).some((r,i,a)=>i>0&&Math.abs(r.c/a[i-1].c-1)>.45);return out;
}
const priceCache=new Map();
export async function getPrices(symbol){const cached=priceCache.get(symbol);if(cached&&Date.now()-cached.time<900000)return cached.promise;const promise=fetchPrices(symbol);priceCache.set(symbol,{time:Date.now(),promise});const result=await promise;if(result.status!=="ok")priceCache.delete(symbol);return result;}
export function parseNasdaqHistory(payload,symbol,now=Date.now()) {
 const data=payload?.data;
 if(data?.symbol!==symbol||!Array.isArray(data?.tradesTable?.rows))throw Error('Nasdaq 历史响应无效');
 const num=x=>typeof x==='string'&&/^\$?[\d,]+(?:\.\d+)?$/.test(x.trim())?Number(x.replace(/[$,]/g,'')):NaN;
 const bars=data.tradesTable.rows.map(r=>{const m=r.date?.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);return m?{date:`${m[3]}-${m[1]}-${m[2]}`,o:num(r.open),h:num(r.high),l:num(r.low),c:num(r.close),v:r.volume==='N/A'?null:num(r.volume)}:null;}).filter(r=>r&&completedSession(r.date,now)&&[r.o,r.h,r.l,r.c].every(Number.isFinite)&&(r.v===null||Number.isFinite(r.v))&&r.o>0&&r.c>0&&r.l>0&&r.v>=0&&r.h>=Math.max(r.o,r.c,r.l)&&r.l<=Math.min(r.o,r.c));
 const ordered=[...new Map(bars.map(r=>[r.date,r])).values()].sort((a,b)=>a.date.localeCompare(b.date));
 if(ordered.length<21)throw Error('Nasdaq 可用历史不足');
 return ordered;
}
async function fetchPrices(symbol){
 const etf=['SPY','SOXX','DRAM'].includes(symbol),today=new Date(),from=new Date(today);from.setUTCFullYear(from.getUTCFullYear()-2);
 const nasdaqUrl=`https://api.nasdaq.com/api/quote/${symbol}/historical?assetclass=${etf?'etf':'stocks'}&fromdate=${from.toISOString().slice(0,10)}&todate=${today.toISOString().slice(0,10)}&limit=600`;
 const url=`https://stockanalysis.com/${etf?'etf':'stocks'}/${symbol.toLowerCase()}/history/`;
 const headers={'user-agent':'Mozilla/5.0 (compatible; EntrySignals/1.0)','accept':'application/json,text/html'};
 for(const candidate of [{url:nasdaqUrl,source:'Nasdaq 历史行情',parse:async r=>parseNasdaqHistory(await r.json(),symbol)},{url,source:'Stock Analysis 历史行情',parse:async r=>parseHistory(await r.text())}]){
  try{const response=await fetch(candidate.url,{headers,signal:AbortSignal.timeout(8000),cf:{cacheTtl:900,cacheEverything:true}});if(!response.ok)throw Error(`HTTP ${response.status}`);const bars=await candidate.parse(response),metrics=priceMetrics(bars);return{symbol,url:candidate.url,bars,retrievedAt:new Date().toISOString(),source:candidate.source,...metrics,status:metrics.stale?'stale':metrics.discontinuity?'review':'ok'};}
  catch(error){console.error('market history fetch failed',symbol,candidate.source,String(error?.message||error).slice(0,160));}
 }
 return{symbol,url,source:'Nasdaq 历史行情',status:'missing',sourceError:'行情来源暂不可用'};
}
