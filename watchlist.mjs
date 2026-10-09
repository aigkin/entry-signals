import './dist/price-clues.js';
import './dist/technical-review.js';
import {compareAndStore} from './observations.mjs';
import {readResearch} from './research.mjs';
import {saveWatchlistCache} from './watch-cache.mjs';
import {getStoredPrices} from './storage.mjs';
export function summarizeWatchlist(rows){
 const usable=rows.filter(r=>r.status==='ok'&&Number.isFinite(r.ma50));const counts=new Map();usable.forEach(r=>counts.set(r.date,(counts.get(r.date)||0)+1));const date=[...counts].sort((a,b)=>b[1]-a[1]||b[0].localeCompare(a[0]))[0]?.[0]||null;const aligned=usable.filter(r=>r.date===date);const above=aligned.filter(r=>r.ma50>0).length;
 return{date,above,covered:aligned.length,total:7,breadth:aligned.length>=5?100*above/aligned.length:null,rows:rows.map(({bars,...r})=>({...r,included:r.status==='ok'&&r.date===date&&Number.isFinite(r.ma50)}))};
}
export async function watchlist(env){const observedAt=new Date().toISOString();const rows=await Promise.all(['MRVL','DRAM','NBIS','NVDA','ASX','INTC','AAOI'].map(async s=>{const price=await getStoredPrices(s,env);try{const research=await readResearch(env,s);const researchStatus=!research?'missing':research.expiresOn<new Date().toISOString().slice(0,10)?'expired':'ok';return {...price,researchStatus,researchExpiresOn:research?.expiresOn||null,researchRiskUnresolved:researchStatus==='expired'&&research?.broken==='yes',broken:researchStatus==='ok'?research.broken:'unknown'};}catch{return {...price,researchStatus:'error',broken:'unknown'};}}));await Promise.all(rows.map(async row=>{
 if(row.researchRiskUnresolved||(row.researchStatus==='ok'&&['yes','no'].includes(row.broken))||!env?.DB)return;
 try{const prior=await env.DB.prepare('SELECT data_json FROM watch_observations WHERE symbol=? AND rule_version=? ORDER BY id DESC LIMIT 1').bind(row.symbol,'watch-1').first();const data=prior?JSON.parse(prior.data_json):null;if(data&&(data.broken==='yes'||data.researchRiskUnresolved))row.researchRiskUnresolved=true;}catch{}
}));const [spy,semi]=await Promise.all(['SPY','SOXX'].map(s=>getStoredPrices(s,env)));for(const row of rows)row.technicalReview=globalThis.TechnicalReview.review(row,spy,semi);const changes=await compareAndStore(rows,env,observedAt);const data={...summarizeWatchlist(rows),changes};await saveWatchlistCache(env,data);return Response.json(data,{headers:{'cache-control':'no-store'}});}
