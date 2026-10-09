import './dist/price-clues.js';
import './dist/technical-review.js';
import {getSOXXBreadth} from './breadth.mjs';
import {readResearch,researchValues} from './research.mjs';
import {completedSession} from './prices.mjs';
import {getStoredPrices,recordSnapshot} from './storage.mjs';
import './dist/engine.js';
export function parseVix(csv,now=Date.now()){const rows=csv.trim().split(/\r?\n/).slice(1).map(line=>{const a=line.split(',');return{date:new Date(a[0]+' UTC'),value:Number(a[4])};}).filter(r=>Number.isFinite(+r.date)&&Number.isFinite(r.value)&&r.value>0&&completedSession(r.date.toISOString().slice(0,10),now));if(rows.length<252)throw Error('历史样本不足');rows.sort((a,b)=>a.date-b.date);const last=rows.at(-1);const start=new Date(last.date);start.setUTCFullYear(start.getUTCFullYear()-3);const history=rows.filter(r=>r.date>=start);return{value:100*history.filter(r=>r.value<=last.value).length/history.length,close:last.value,date:last.date.toISOString().slice(0,10),stale:now-last.date>5*86400000};}
export async function legacyMarket(symbol){const allowed=['SPY','SOXX','MRVL','DRAM','NBIS','NVDA','ASX','INTC','AAOI'];if(!allowed.includes(symbol))return Response.json({error:'不支持的标的'},{status:400});const values={},sources=[];const url='https://cdn.cboe.com/api/global/us_indices/daily_prices/VIX_History.csv';try{const response=await fetch(url,{signal:AbortSignal.timeout(12000),cf:{cacheTtl:900,cacheEverything:true}});if(!response.ok)throw Error('来源暂不可用');const p=parseVix(await response.text());if(!p.stale)values.fear=p.value;sources.push({label:'市场情绪 · VIX',status:p.stale?'stale':'ok',date:p.date,source:'Cboe 官方历史数据',url,message:`收盘 ${p.close.toFixed(2)}，三年历史百分位 ${p.value.toFixed(1)}。${p.stale?'已过期，不参与判断。':'使用保守的已完成日线。'}`});}catch{sources.push({label:'市场情绪 · VIX',status:'missing',source:'Cboe 官方历史数据',url,message:'来源暂时不可用；稍后刷新重试。'});}sources.push({label:`${symbol} · 价格与成交`,status:'missing',message:'股票历史行情来源受限，均线、回撤和量比尚未接入。'},{label:'行业广度',status:'missing',message:'需要同日成分股与历史价格，目前尚无完整数据。'},{label:'估值与基本面',status:'missing',message:'需要同财年共识快照、估值假设和事件核实，暂不自动推断。'});return Response.json({symbol,values,sources,fetched_at:new Date().toISOString()},{headers:{'cache-control':'private, max-age=300'}});}

export async function market(symbol,env){
 const allowed=['SPY','SOXX','MRVL','DRAM','NBIS','NVDA','ASX','INTC','AAOI'];
 if(!allowed.includes(symbol))return Response.json({error:'不支持的标的'},{status:400});
 const names=[...new Set(['SPY','SOXX',symbol])];
 const [base,...prices]=await Promise.all([legacyMarket(symbol).then(r=>r.json()),...names.map(s=>getStoredPrices(s,env))]);
 const values={...base.values};const sources=base.sources.slice(0,1);
 for(const p of prices){
  sources.push({label:p.symbol+' · 日线行情',symbol:p.symbol,count:p.count||0,requiredHistory:p.symbol==='SPY'?200:60,status:p.status,storageStatus:p.storageStatus,date:p.date,source:p.source,url:p.url,message:p.status==='missing'?'暂时无法读取历史行情，稍后刷新重试。':p.status==='stale'?'最新记录已过期，未用于判断。':p.status==='cached'?'来源暂不可用，显示数据库历史；暂停本次买点判断。':p.status==='review'?'发现大幅价格跳变，需核实拆股或异常行情；暂停指标。':`收盘 ${p.close.toFixed(2)} · ${p.count} 个样本 · 50日偏离 ${p.ma50?.toFixed(1)??'缺失'}% · 量比 ${p.volume?.toFixed(2)??'缺失'}。${p.ma200===undefined?'样本不足200日，长期趋势未知。':''}`});
  if(p.status!=='ok')continue;
  if(p.symbol==='SPY'){values.market50=p.ma50;values.market=p.ma200;}
  if(p.symbol==='SOXX')values.sector=p.ma50;
  if(p.symbol===symbol){values.stock=p.ma50;values.drawdown=p.drawdown;values.volume=p.volume;values.stabilize=p.stabilize;}
 }
 const s=prices.find(p=>p.symbol===symbol),sector=prices.find(p=>p.symbol==='SOXX'),spy=prices.find(p=>p.symbol==='SPY');
 values.environmentAligned=!!(sector?.status==='ok'&&spy?.status==='ok'&&sector.date===spy.date);
 values.aligned=!!(s?.status==='ok'&&sector?.status==='ok'&&spy?.status==='ok'&&s.date===sector.date&&s.date===spy.date);
 if(s?.status==='ok'&&sector?.status==='ok'&&s.date===sector.date)values.relative20=((1+s.return20/100)/(1+sector.return20/100)-1)*100;
 values.panicAligned=!!(s?.status==='ok'&&base.sources[0]?.status==='ok'&&s.date===base.sources[0].date);
 const sectorBreadth=await getSOXXBreadth(env,sector?.status==='ok'?sector.date:null,prices);
 if(sectorBreadth.status==='ok'&&s?.status==='ok'&&s.date===sectorBreadth.date)values.breadth=sectorBreadth.value;
 sources.push({...sectorBreadth,status:s?.date===sectorBreadth.date?sectorBreadth.status:'missing',message:s?.date===sectorBreadth.date?sectorBreadth.message:'标的与广度日期未对齐，广度缺失。'});
 let research=null,researchStatus='missing';
 try{research=await readResearch(env,symbol);if(research){researchStatus=research.expiresOn<new Date().toISOString().slice(0,10)?'expired':'ok';Object.assign(values,researchValues(research,s?.status==='ok'?s.close:null));}}catch{researchStatus='error';}
 values.broken=values.broken||'unknown';
 sources.push({label:'我的研究记录',status:researchStatus==='ok'?'ok':researchStatus==='expired'?'stale':'missing',date:research?.asOf,source:'人工研究记录',url:research?.sourceUrl,message:researchStatus==='ok'?`截至 ${research.asOf}，有效至 ${research.expiresOn}。${research.rationale}`:researchStatus==='expired'?'研究记录已过期，请在研究页复核。':researchStatus==='error'?'研究记录暂时无法读取，未用于判断。':'尚未保存研究记录；可在研究页填写有依据的估值和经营核查。'});
 const observedAt=new Date().toISOString();sources.forEach(source=>{source.checkedAt=source.checkedAt||observedAt;});const snapshot=await recordSnapshot(env,{symbol,ruleVersion:'entry-0.2',observedAt,inputs:values,sources,result:globalThis.EntryEngine.evaluate(values)});
 return Response.json({symbol,values,sources,snapshot,researchStatus,research,technicalReview:globalThis.TechnicalReview.review(s,spy,sector),fetched_at:observedAt},{headers:{'cache-control':'private, max-age=300'}});
}
