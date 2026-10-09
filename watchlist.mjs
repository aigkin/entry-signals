import './dist/price-clues.js';
import './dist/technical-review.js';
import {compareAndStore} from './observations.mjs';
import {legacyMarket} from './market.mjs';
import {readResearch,researchValues} from './research.mjs';
import {saveWatchlistCache} from './watch-cache.mjs';
import {getStoredPrices} from './storage.mjs';
export function summarizeWatchlist(rows){
 const usable=rows.filter(r=>r.status==='ok'&&Number.isFinite(r.ma50));const counts=new Map();usable.forEach(r=>counts.set(r.date,(counts.get(r.date)||0)+1));const date=[...counts].sort((a,b)=>b[1]-a[1]||b[0].localeCompare(a[0]))[0]?.[0]||null;const aligned=usable.filter(r=>r.date===date);const above=aligned.filter(r=>r.ma50>0).length;
 return{date,above,covered:aligned.length,total:7,breadth:aligned.length>=5?100*above/aligned.length:null,rows:rows.map(({bars,...r})=>({...r,included:r.status==='ok'&&r.date===date&&Number.isFinite(r.ma50)}))};
}
export async function watchlist(env){const observedAt=new Date().toISOString();const baseTask=legacyMarket('SOXX').then(r=>r.json());const rows=await Promise.all(['MRVL','DRAM','NBIS','NVDA','ASX','INTC','AAOI'].map(async s=>{const price=await getStoredPrices(s,env);try{const research=await readResearch(env,s);const researchStatus=!research?'missing':research.expiresOn<new Date().toISOString().slice(0,10)?'expired':'ok';return {...price,entryResearch:researchValues(research,price.status==='ok'?price.close:null),researchAsOf:research?.asOf||null,researchStatus,researchExpiresOn:research?.expiresOn||null,researchRiskUnresolved:researchStatus==='expired'&&research?.broken==='yes',broken:researchStatus==='ok'?research.broken:'unknown'};}catch{return {...price,researchStatus:'error',broken:'unknown'};}}));await Promise.all(rows.map(async row=>{
 if(row.researchRiskUnresolved||(row.researchStatus==='ok'&&['yes','no'].includes(row.broken))||!env?.DB)return;
 try{const prior=await env.DB.prepare('SELECT data_json FROM watch_observations WHERE symbol=? AND rule_version=? ORDER BY id DESC LIMIT 1').bind(row.symbol,'watch-1').first();const data=prior?JSON.parse(prior.data_json):null;if(data&&(data.broken==='yes'||data.researchRiskUnresolved))row.researchRiskUnresolved=true;}catch{}
}));const [spy,semi,base]=await Promise.all([getStoredPrices('SPY',env),getStoredPrices('SOXX',env),baseTask]);
for(const row of rows){
 row.technicalReview=globalThis.TechnicalReview.review(row,spy,semi);
 row.entryValues={...base.values,...row.entryResearch,broken:row.broken,
  stock:row.status==='ok'?row.ma50:null,volume:row.status==='ok'?row.volume:null,drawdown:row.status==='ok'?row.drawdown:null,stabilize:row.status==='ok'?row.stabilize:null,
  market:spy.status==='ok'?spy.ma200:null,sector:semi.status==='ok'?semi.ma50:null,
  relative20:row.technicalReview.indicators?.relative20??null,
  aligned:row.status==='ok'&&spy.status==='ok'&&semi.status==='ok'&&row.date===spy.date&&row.date===semi.date,
  panicAligned:row.status==='ok'&&base.sources[0]?.status==='ok'&&row.date===base.sources[0]?.date};
 row.entrySources=[base.sources[0],...[row,spy,semi].map(p=>({label:p.symbol+' 日线',symbol:p.symbol,status:p.status,date:p.date,source:p.source||'行情来源未知',checkedAt:observedAt})),{label:'行业广度',status:'missing',source:'同日 SOXX 成分股',checkedAt:observedAt},{label:'研究依据',status:row.researchStatus,date:row.researchAsOf,source:'人工研究',checkedAt:observedAt}];
 delete row.entryResearch;
}const changes=await compareAndStore(rows,env,observedAt);const data={...summarizeWatchlist(rows),changes};await saveWatchlistCache(env,data);return Response.json(data,{headers:{'cache-control':'no-store'}});}
