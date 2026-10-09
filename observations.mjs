import './dist/watch-model.js';
const WATCH_RULE='watch-1';
export function observationChange(row, previous){
 const current=globalThis.WatchModel.analyze(row);
 if(current.kind==='missing')return {symbol:row.symbol,type:'unavailable',label:'数据暂不可比',message:'本次数据不足，不记作退出观察，也不覆盖上次有效记录。'};
 if(!previous)return {symbol:row.symbol,type:'first',label:'首次记录',message:'已建立有效观察基线，下次获取时开始比较。'};
 if(row.date<previous.date)return {symbol:row.symbol,type:'older',label:'日期落后',message:'本次行情日期早于已有记录，不更新比较基线。'};
 const before=globalThis.WatchModel.analyze(previous);
 if(before.kind==='risk'&&current.kind!=='risk'&&!(row.researchStatus==='ok'&&row.broken==='no'))return{symbol:row.symbol,type:'unavailable',label:'原风险尚待复核',message:'当前研究依据缺失、过期或读取失败，不能据此判断原风险解除；保留上次有效记录。'};
 const type=before.kind==='missing'?'first':before.kind!=='watch'&&current.kind==='watch'?'entered':before.kind==='watch'&&current.kind==='wait'?'exited':current.kind==='risk'&&before.kind!=='risk'?'risk':before.state!==current.state?'changed':'unchanged';
 const labels={first:'首次记录',entered:'新出现价格线索',exited:'退出优先观察',risk:'新增风险提醒',changed:'观察状态变化',unchanged:'状态未变'};
 const delta=Number.isFinite(row.close)&&Number.isFinite(previous.close)&&previous.close>0?((row.close/previous.close-1)*100):null;
 return{symbol:row.symbol,type,label:labels[type],previousAt:previous.observedAt,previousDate:previous.date,previousState:before.state,currentState:current.state,message:type==='unchanged'?'仍为「'+current.state+'」。':before.state+' → '+current.state+'。',priceChange:delta};
}
export async function compareAndStore(rows,env,observedAt=new Date().toISOString()){
 if(!env?.DB)return {status:'disabled',items:[],observedAt};
 try{
 const usable=rows.filter(r=>globalThis.WatchModel.analyze(r).kind!=='missing'&&/^\d{4}-\d{2}-\d{2}$/.test(r.date||''));
 const statements=[];
 for(const r of usable){const data={symbol:r.symbol,date:r.date,close:r.close,ma50:r.ma50,volume:r.volume,drawdown:r.drawdown,stabilize:r.stabilize,status:r.status,researchStatus:r.researchStatus,broken:r.broken,researchRiskUnresolved:r.researchRiskUnresolved===true,observedAt};
 statements.push(env.DB.prepare('SELECT data_json, observed_at, market_date FROM watch_observations WHERE symbol=? AND rule_version=? ORDER BY id DESC LIMIT 1').bind(r.symbol,WATCH_RULE));
 statements.push(env.DB.prepare("INSERT INTO watch_observations(symbol,rule_version,market_date,observed_at,data_json) SELECT ?,?,?,?,? WHERE NOT EXISTS (SELECT 1 FROM watch_observations WHERE symbol=? AND rule_version=? AND (observed_at>=? OR market_date>?)) AND NOT (? AND COALESCE((SELECT (json_extract(data_json,'$.broken')='yes' OR json_extract(data_json,'$.researchRiskUnresolved')=1) FROM watch_observations WHERE symbol=? AND rule_version=? ORDER BY id DESC LIMIT 1),0))").bind(r.symbol,WATCH_RULE,r.date,observedAt,JSON.stringify(data),r.symbol,WATCH_RULE,observedAt,r.date,!(r.researchStatus==='ok'&&r.broken==='no')&&!r.researchRiskUnresolved&&!(r.researchStatus==='ok'&&r.broken==='yes')?1:0,r.symbol,WATCH_RULE));
 }
 const result=statements.length?await env.DB.batch(statements):[];const items=usable.map((r,i)=>{const old=result[i*2]?.results?.[0];if(old?.observed_at>=observedAt)return{symbol:r.symbol,type:'older',label:'已有更新记录',message:'另一次观察已完成，请刷新查看最新比较。'};return observationChange(r,old?JSON.parse(old.data_json):null);});
 for(const r of rows)if(!usable.includes(r))items.push(observationChange({...r,status:'missing'},null));
 return{status:'ok',items,observedAt};
 }catch(e){console.error('Observation persistence failed',String(e.message).slice(0,120));return{status:'error',items:[],observedAt};}
}

export function summarizeObservations(records){
 const parsed=records.map(r=>{try{return JSON.parse(r.data_json);}catch{return null;}}).filter(r=>r&&/^\d{4}-\d{2}-\d{2}$/.test(r.date||'')&&typeof r.observedAt==='string');
 const groups=[];
 for(const row of parsed){
  const view=globalThis.WatchModel.analyze(row),last=groups.at(-1);
  if(last&&last.marketDate===row.date&&last.state===view.state){last.count++;last.firstObservedAt=row.observedAt;continue;}
  groups.push({marketDate:row.date,observedAt:row.observedAt,firstObservedAt:row.observedAt,state:view.state,kind:view.kind,reason:view.reason,close:row.close,count:1,row});
 }
 const items=groups.slice(0,12).map((g,i)=>{const previous=groups[i+1];return {marketDate:g.marketDate,observedAt:g.observedAt,firstObservedAt:g.firstObservedAt,state:g.state,kind:g.kind,reason:g.reason,close:g.close,count:g.count,change:previous?observationChange(g.row,previous.row):null};});
 return {items,recordCount:parsed.length,marketDays:new Set(parsed.map(r=>r.date)).size,truncated:records.length>=60||groups.length>12};
}
export async function observationHistory(symbol,env){
 if(!['MRVL','DRAM','NBIS','NVDA','ASX','INTC','AAOI'].includes(symbol))return Response.json({error:'不支持的标的'},{status:400});
 if(!env?.DB)return Response.json({status:'disabled',items:[]});
 try{const r=await env.DB.prepare('SELECT data_json FROM watch_observations WHERE symbol=? AND rule_version=? ORDER BY id DESC LIMIT 60').bind(symbol,WATCH_RULE).all();return Response.json({status:'ok',symbol,...summarizeObservations(r.results||[])},{headers:{'cache-control':'no-store'}});}
 catch{return Response.json({status:'error',items:[]},{status:503});}
}
