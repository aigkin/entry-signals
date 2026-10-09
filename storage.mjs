import { auditPrices } from './quality.mjs';
import { getPrices, priceMetrics, completedSession } from './prices.mjs';

export const ALLOWED_SYMBOLS = new Set(['SPY','SOXX','MRVL','DRAM','NBIS','NVDA','ASX','INTC','AAOI']);
const SOURCE = 'Stock Analysis 历史行情';
const validDate=d=>/^\d{4}-\d{2}-\d{2}$/.test(d)&&Number.isFinite(Date.parse(d+'T00:00:00Z'))&&new Date(d+'T00:00:00Z').toISOString().slice(0,10)===d;
const validBar = r => r && validDate(r.date) && /^\d{4}-\d{2}-\d{2}$/.test(r.date) && [r.o,r.h,r.l,r.c].every(Number.isFinite) && r.o>0 && r.h>0 && r.l>0 && r.c>0 && (r.v===null || Number.isFinite(r.v) && r.v>=0) && r.h>=Math.max(r.o,r.c,r.l) && r.l<=Math.min(r.o,r.c,r.h);
const rowBar = r => ({ date:r.date, o:Number(r.open), h:Number(r.high), l:Number(r.low), c:Number(r.close), v:r.volume===null?null:Number(r.volume) });
const sql = `INSERT INTO daily_bars(symbol,date,source,open,high,low,close,volume,retrieved_at) VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(symbol,date,source) DO UPDATE SET open=excluded.open,high=excluded.high,low=excluded.low,close=excluded.close,volume=excluded.volume,retrieved_at=excluded.retrieved_at WHERE daily_bars.open<>excluded.open OR daily_bars.high<>excluded.high OR daily_bars.low<>excluded.low OR daily_bars.close<>excluded.close OR daily_bars.volume IS NOT excluded.volume`;
async function writeBars(db, symbol, bars, retrievedAt, source=SOURCE) {
  const statements = bars.filter(validBar).map(r => db.prepare(sql).bind(symbol,r.date,source,r.o,r.h,r.l,r.c,r.v,retrievedAt));
  for (let i=0;i<statements.length;i+=40) await db.batch(statements.slice(i,i+40));
  return statements.length;
}
async function readBars(db,symbol,source=SOURCE) { const r=await db.prepare('SELECT date,open,high,low,close,volume,retrieved_at FROM daily_bars WHERE symbol=? AND source=? ORDER BY date DESC LIMIT 600').bind(symbol,source).all(); return (r.results||[]).reverse(); }
const storedPriceCache=new WeakMap();
const noStorageScope={};
export function getStoredPrices(symbol,env,now=Date.now(),loader=getPrices){
 const scope=env?.DB||noStorageScope;
 let cache=storedPriceCache.get(scope);if(!cache){cache=new Map();storedPriceCache.set(scope,cache);}
 const key=symbol,hit=cache.get(key);
 if(hit&&hit.loader===loader&&now>=hit.time&&now-hit.time<60000)return hit.promise;
 const entry={time:now,loader,promise:null};
 entry.promise=loadStoredPrices(symbol,env,now,loader).then(result=>{if(result.status!=='ok'||result.storageStatus==='error'){if(cache.get(key)===entry)cache.delete(key);}return result;},error=>{if(cache.get(key)===entry)cache.delete(key);throw error;});
 cache.set(key,entry);return entry.promise;
}
async function loadStoredPrices(symbol, env, now,loader) {
  if (!ALLOWED_SYMBOLS.has(symbol)) return {symbol,status:'missing',storageStatus:'rejected',message:'不支持的标的'};
  const db=env?.DB; const live=await loader(symbol); let storageStatus=db?'ok':'disabled'; let stored=[];
  const validLive=(live.bars||[]).filter(r=>validBar(r)&&completedSession(r.date,now));
  const invalid=validLive.length!==(live.bars||[]).length;
  let storageError=null;let selectedSource=live.source||SOURCE;
  if(db){try{
    stored=await readBars(db,symbol,selectedSource);
    const existing=new Map(stored.map(r=>[r.date,rowBar(r)]));
    const changed=validLive.filter(r=>{const old=existing.get(r.date);return !old||['o','h','l','c','v'].some(k=>old[k]!==r[k]);});
    if(changed.length){await writeBars(db,symbol,changed,live.retrievedAt||new Date(now).toISOString(),selectedSource);stored=await readBars(db,symbol,selectedSource);}
    if(!validLive.length){
      for(const source of ['Nasdaq 历史行情',SOURCE]){const rows=await readBars(db,symbol,source);if(rows.length&&(!stored.length||rows.at(-1).date>stored.at(-1).date||(rows.at(-1).date===stored.at(-1).date&&rows.length>stored.length))){stored=rows;selectedSource=source;}}
    }
  }catch(error){storageStatus='error';storageError=String(error?.message||error).slice(0,180);console.error('D1 daily bar persistence failed',storageError);}}
  const fresh=live.status!=='missing';
  // Prefer live data if persistence failed; never call old rows freshly fetched.
  const bars=(storageStatus==='ok'&&stored.length?stored.map(rowBar):validLive);
  const fallback=!fresh&&bars.length>0;
  const metrics=bars.length>=21?priceMetrics(bars,now):{date:bars.at(-1)?.date,count:bars.length,close:bars.at(-1)?.c,stale:true};
  const quality=auditPrices(bars,now,(live.bars||[]).length-validLive.length);
  const status=bars.length<21?'missing':invalid||quality.blocking||metrics.discontinuity?'review':metrics.stale?'stale':fallback?'cached':'ok';
  return {symbol,url:live.url,source:selectedSource,bars,...metrics,status,quality,dataStatus:fallback?'cached':fresh?'live':'missing',storageStatus,
    fetched_at:fallback?stored.at(-1)?.retrieved_at:live.retrievedAt||null,storageError};
}
export async function savedHistory(symbol,env,now=Date.now()){
 if(!ALLOWED_SYMBOLS.has(symbol))return {symbol,bars:[],status:'missing'};
 try{
  const candidates=await Promise.all(['Nasdaq 历史行情',SOURCE].map(async source=>({source,rows:env?.DB?await readBars(env.DB,symbol,source):[]})));
  candidates.sort((a,b)=>(b.rows.at(-1)?.date||'').localeCompare(a.rows.at(-1)?.date||'')||b.rows.length-a.rows.length);
  const best=candidates[0],bars=best.rows.map(rowBar),metrics=priceMetrics(bars,now);
  return {symbol,bars,source:best.source,status:bars.length<21?'missing':metrics.discontinuity?'review':metrics.stale?'stale':'cached',dataStatus:'cached',retrievedAt:best.rows.at(-1)?.retrieved_at||null};
 }catch{return {symbol,bars:[],status:'missing',dataStatus:'cached'};}
}
export async function historyApi(symbol, env, savedOnly=false) {
  if (!ALLOWED_SYMBOLS.has(symbol)) return Response.json({error:'不支持的标的'},{status:400});
  if(savedOnly)return Response.json(await savedHistory(symbol,env),{headers:{'cache-control':'no-store'}});
  const p=await getStoredPrices(symbol,env); return Response.json({symbol,bars:p.bars||[],status:p.status,dataStatus:p.dataStatus||'live',storageStatus:p.storageStatus||'disabled',storageError:p.storageError||null,quality:p.quality,source:p.source||SOURCE,retrievedAt:p.fetched_at||null},{headers:{'cache-control':'private, max-age=300'}});
}
export async function recordSnapshot(env,payload) {
  const db=env?.DB;if(!db) return {stored:false,storageStatus:'disabled'};
  const {symbol,envName='production',ruleVersion='v0.1',observedAt=new Date().toISOString(),inputs={},sources=[]}=payload||{};
  if (!ALLOWED_SYMBOLS.has(symbol)) return {stored:false,storageStatus:'rejected'};
  try { const day=observedAt.slice(0,10); const result=payload.result||{}; const r=await db.prepare('INSERT INTO signal_snapshots(symbol,env,rule_version,observed_at,observed_day,inputs_json,sources_json,result_json) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(symbol,env,rule_version,observed_day) DO NOTHING').bind(symbol,envName,ruleVersion,observedAt,day,JSON.stringify(inputs),JSON.stringify(sources),JSON.stringify(result)).run(); return {stored:!!r.meta?.changes,duplicate:!r.meta?.changes,storageStatus:'ok'}; } catch { return {stored:false,storageStatus:'error'}; }
}
