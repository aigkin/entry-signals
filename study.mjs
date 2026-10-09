import {getStoredPrices} from './storage.mjs';
const meanStudy=a=>a.reduce((s,v)=>s+v,0)/a.length;
function atDate(series){return new Map(series.map((r,i)=>[r.date,i]));}
function technicalAt(rows,i){if(i<49)return null;const closes=rows.slice(i-49,i+1).map(r=>r.c);const volumes=rows.slice(i-20,i).map(r=>r.v);const v=volumes.every(Number.isFinite)?meanStudy(volumes):null;return{ma50:(rows[i].c/meanStudy(closes)-1)*100,volume:v>0&&Number.isFinite(rows[i].v)?rows[i].v/v:null,drawdown:i>=59?(rows[i].c/Math.max(...rows.slice(i-59,i+1).map(r=>r.c))-1)*100:null,stabilize:(rows[i].c/rows[i-1].h-1)*100};}
export function evaluateHistory(stock,spy,semi,horizon){
 if(![20,60].includes(horizon))throw Error('invalid horizon');const pi=atDate(spy),si=atDate(semi);const results={dip:{events:[],pending:0,skipped:0},trend:{events:[],pending:0,skipped:0}};const next={dip:0,trend:0};
 for(let i=49;i<stock.length;i++){
  const s=technicalAt(stock,i);const pindex=pi.get(stock[i].date),sindex=si.get(stock[i].date);const p=pindex===undefined?null:technicalAt(spy,pindex),b=sindex===undefined?null:technicalAt(semi,sindex);
  const flags={dip:s.drawdown!==null&&s.drawdown<=-15&&s.stabilize>0&&s.volume!==null&&s.volume>=1,trend:p&&b&&p.ma50>0&&b.ma50>0&&s.ma50>0&&s.ma50<=10&&s.volume!==null&&s.volume>=1.2};
  for(const path of ['dip','trend']){if(!flags[path]||i<next[path])continue;const entry=stock[i+1],exit=stock[i+horizon];if(!entry||!exit){results[path].pending++;next[path]=stock.length;continue;}const be=si.get(entry.date),bx=si.get(exit.date);if(!(entry.o>0)||be===undefined||bx===undefined||!(semi[be].o>0)){results[path].skipped++;continue;}const held=stock.slice(i+1,i+horizon+1);if(held.some(r=>!(r.l>0))){results[path].skipped++;continue;}
   const net=(exit.c/entry.o-1)*100-.2,benchmark=(semi[bx].c/semi[be].o-1)*100-.2;
   results[path].events.push({signal:stock[i].date,entry:entry.date,exit:exit.date,net,benchmark,excess:net-benchmark,mae:Math.min(0,(Math.min(...held.map(r=>r.l))/entry.o-1)*100)});next[path]=i+horizon;
  }
 }
 for(const path of ['dip','trend']){const r=results[path],n=r.events.length;r.count=n;r.meanReturn=n?meanStudy(r.events.map(e=>e.net)):null;r.meanExcess=n?meanStudy(r.events.map(e=>e.excess)):null;r.worstMAE=n?Math.min(...r.events.map(e=>e.mae)):null;r.positive=n>=10?r.events.filter(e=>e.net>0).length/n*100:null;r.sampleStatus=n===0?'无已完成样本':n<10?'样本不足，仅供逐笔观察':'探索性统计，未经样本外验证';}
 return{horizon,start:stock[0]?.date,end:stock.at(-1)?.date,bars:stock.length,results};
}
export async function study(symbol,horizon,env){if(!['SPY','SOXX','MRVL','DRAM','NBIS','NVDA','ASX','INTC','AAOI'].includes(symbol)||![20,60].includes(horizon))return Response.json({error:'不支持的标的或窗口'},{status:400});const names=[...new Set([symbol,'SPY','SOXX'])];const rows=await Promise.all(names.map(s=>getStoredPrices(s,env)));const by=new Map(rows.map(r=>[r.symbol,r]));if(rows.some(r=>r.status!=='ok'))return Response.json({available:false,message:'行情缺失、过期或存在价格跳变，本次不计算历史结果。'});const r=evaluateHistory(by.get(symbol).bars,by.get('SPY').bars,by.get('SOXX').bars,horizon);return Response.json({available:true,symbol,...r,sources:rows.map(r=>({symbol:r.symbol,url:r.url,date:r.date})),method:'技术规则v0.1；收盘确认，次日开盘进入，第N个持有交易日收盘退出；单路径持有区间不重叠。往返成本假设0.20个百分点，SOXX使用相同日期与成本。最大不利变动按持有期最低价相对入场价计算，不含费用。'}, {headers:{'cache-control':'private, max-age=900'}});}
