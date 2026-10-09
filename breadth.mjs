import {completedSession,parseNasdaqHistory} from './prices.mjs';
export const SOXX_HOLDINGS_URL='https://www.ishares.com/us/products/239705/ishares-phlx-semiconductor-etf/latest-holdings.csv';
const breadthCache=new Map();
const validBreadthDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d||'')&&Number.isFinite(Date.parse(d+'T00:00:00Z'));
function breadthCSV(text){
 const rows=[];let row=[],cell='',quoted=false;
 for(let i=0;i<text.length;i++){const c=text[i];if(c==='"'){if(quoted&&text[i+1]==='"'){cell+='"';i++;}else quoted=!quoted;}else if(!quoted&&(c===','||c==='\n')){row.push(cell.replace(/\r$/,''));cell='';if(c==='\n'){rows.push(row);row=[];}}else cell+=c;}
 if(cell||row.length){row.push(cell);rows.push(row);}if(quoted)throw Error('持仓 CSV 不完整');return rows;
}
export function parseSOXXHoldings(text){
 const rows=breadthCSV(text.replace(/^\uFEFF/,'')),asOf=rows.find(r=>r[0]==='Fund Holdings as of')?.[1];
 const months={Jan:'01',Feb:'02',Mar:'03',Apr:'04',May:'05',Jun:'06',Jul:'07',Aug:'08',Sep:'09',Oct:'10',Nov:'11',Dec:'12'};
 const match=asOf?.match(/^([A-Za-z]{3}) (\d{2}), (\d{4})$/),date=match&&months[match[1]]?`${match[3]}-${months[match[1]]}-${match[2]}`:null;
 const index=rows.findIndex(r=>r[0]==='Ticker'&&r.includes('Asset Class')),head=rows[index];
 if(!date||!head)throw Error('持仓日期或字段缺失');
 const equities=rows.slice(index+1).filter(r=>r[head.indexOf('Asset Class')]==='Equity');
 const symbols=[...new Set(equities.map(r=>r[0]?.trim()).filter(s=>/^[A-Z][A-Z0-9.-]{0,9}$/.test(s)))];
 // Never accept a truncated top-holdings sample as the complete fund universe.
 if(symbols.length<20||symbols.length>60||symbols.length!==equities.length)throw Error('完整股票成分未核实');
 return {date,symbols,source:'iShares SOXX 官方持仓 CSV',url:SOXX_HOLDINGS_URL};
}
export function calculateSOXXBreadth(holdings,prices,date,now=Date.now()){
 const checkedAt=new Date(now).toISOString(),symbols=holdings?.symbols||[],total=symbols.length;
 const common={label:'行业广度',source:'iShares SOXX 持仓 / Nasdaq 日线',url:SOXX_HOLDINGS_URL,date:date||null,holdingsDate:holdings?.date||null,checkedAt,total,covered:0,above:0,coverage:0,status:'missing',value:null};
 if(!validBreadthDate(date)||!completedSession(date,now)||now-Date.parse(date+'T00:00:00Z')>5*86400000||!total||holdings.date!==date)return {...common,message:'SOXX 成分日期与已完成日线未对齐，广度保持缺失。'};
 const usable=symbols.map(symbol=>prices.find(p=>p.symbol===symbol)).filter(p=>p?.status==='ok'&&p.date===date&&!p.quality?.blocking&&Number.isFinite(p.ma50));
 const covered=usable.length,coverage=100*covered/total,above=usable.filter(p=>p.ma50>0).length;
 const ok=coverage>=70,value=ok?100*above/covered:null;
 return {...common,covered,above,coverage,status:ok?'ok':'missing',value,message:ok?`广度 ${value.toFixed(1)}%（同日有效样本中 ${above}/${covered} 站上 SMA50）；覆盖 ${covered}/${total} 家 · ${coverage.toFixed(1)}%。`:`仅 ${covered}/${total} 家有同日 SMA50（${coverage.toFixed(1)}%，需 ≥70%），不生成广度。`};
}
async function fetchBreadthPrice(symbol,date,now){
 const from=new Date(date+'T00:00:00Z');from.setUTCDate(from.getUTCDate()-190);
 const url=`https://api.nasdaq.com/api/quote/${encodeURIComponent(symbol)}/historical?assetclass=stocks&fromdate=${from.toISOString().slice(0,10)}&todate=${date}&limit=120`;
 try{const r=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 (compatible; EntrySignals/1.0)','accept':'application/json'},signal:AbortSignal.timeout(9000),cf:{cacheTtl:900,cacheEverything:true}});if(!r.ok)throw Error();const bars=parseNasdaqHistory(await r.json(),symbol,now).filter(b=>b.date<=date),recent=bars.slice(-50);
  if(recent.length<50||recent.at(-1).date!==date||recent.some((b,i)=>i>0&&(Math.abs(b.c/recent[i-1].c-1)>.45||(Date.parse(b.date)-Date.parse(recent[i-1].date))/86400000>7)))throw Error();
  const mean=recent.reduce((n,b)=>n+b.c,0)/50;return {symbol,date,status:'ok',ma50:(recent.at(-1).c/mean-1)*100};
 }catch{return {symbol,date,status:'missing'};}
}
export async function getSOXXBreadth(env,date,known=[],now=Date.now(),dependencies={}){
 const hit=breadthCache.get(date);if(!dependencies.holdingsLoader&&hit&&now-hit.time<hit.ttl)return hit.promise;
 const entry={time:now,ttl:60000,promise:null};
 entry.promise=(async()=>{
  if(!dependencies.holdingsLoader&&env?.DB)try{const saved=await env.DB.prepare('SELECT saved_at,data_json FROM watchlist_cache WHERE cache_key=?').bind('breadth-soxx-v1').first();const d=saved?JSON.parse(saved.data_json):null;const age=now-Date.parse(saved?.saved_at||'');if(d?.date===date&&age>=0&&age<(d.status==='ok'?900000:60000)){entry.ttl=d.status==='ok'?900000:60000;return d;}}catch{}
  let result;
  try{const holdings=dependencies.holdingsLoader?await dependencies.holdingsLoader():await (async()=>{const r=await fetch(SOXX_HOLDINGS_URL,{signal:AbortSignal.timeout(6000),cf:{cacheTtl:900,cacheEverything:true}});if(!r.ok)throw Error();return parseSOXXHoldings(await r.text());})();
   if(holdings.date!==date||!validBreadthDate(date)||!completedSession(date,now))return calculateSOXXBreadth(holdings,[],date,now);
   const priceLoader=dependencies.priceLoader||fetchBreadthPrice;
   const prices=await Promise.all(holdings.symbols.map(symbol=>{const p=known.find(r=>r.symbol===symbol&&r.status==='ok'&&r.date===date&&Number.isFinite(r.ma50)&&!r.quality?.blocking);return p||Promise.resolve().then(()=>priceLoader(symbol,date,now)).catch(()=>({symbol,status:'missing'}));}));
   result=calculateSOXXBreadth(holdings,prices,date,now);
  }catch{result={...calculateSOXXBreadth(null,[],date,now),message:'官方 SOXX 完整成分读取失败，未用自选股代替。'};}
  entry.ttl=result.status==='ok'?900000:60000;
  if(env?.DB)try{await env.DB.prepare('INSERT INTO watchlist_cache(cache_key,saved_at,data_json) VALUES(?,?,?) ON CONFLICT(cache_key) DO UPDATE SET saved_at=excluded.saved_at,data_json=excluded.data_json WHERE excluded.saved_at>watchlist_cache.saved_at').bind('breadth-soxx-v1',result.checkedAt,JSON.stringify(result)).run();}catch{}
  return result;
 })();if(!dependencies.holdingsLoader){breadthCache.set(date,entry);if(breadthCache.size>4)breadthCache.delete(breadthCache.keys().next().value);}return entry.promise;
}
