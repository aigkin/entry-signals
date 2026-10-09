(function(root){
'use strict';
const finite=Number.isFinite,mean=a=>a.reduce((s,x)=>s+x,0)/a.length;
function indicators(bars){
 let ema=null,atr=null,gain=null,loss=null;const tr=[],gains=[],losses=[];
 return bars.map((b,i)=>{
  const closes=n=>bars.slice(i-n+1,i+1).map(x=>x.c);
  const sma=n=>i>=n-1&&closes(n).every(x=>finite(x)&&x>0)?mean(closes(n)):null;
  if(i===19)ema=sma(20);else if(i>19)ema=finite(ema)&&finite(b.c)?b.c*2/21+ema*19/21:null;
  const prior=bars[i-1];const range=prior&&[b.h,b.l,prior.c].every(finite)&&b.h>=b.l?Math.max(b.h-b.l,Math.abs(b.h-prior.c),Math.abs(b.l-prior.c)):null;
  tr.push(range);if(i===14)atr=tr.slice(1).every(finite)?mean(tr.slice(1)):null;else if(i>14)atr=finite(atr)&&finite(range)?(atr*13+range)/14:null;
  const delta=i>0&&finite(b.c)&&finite(prior.c)?b.c-prior.c:null;
  gains.push(finite(delta)?Math.max(0,delta):null);losses.push(finite(delta)?Math.max(0,-delta):null);
  if(i===14&&gains.slice(1).every(finite)&&losses.slice(1).every(finite)){gain=mean(gains.slice(1));loss=mean(losses.slice(1));}else if(i>14){gain=finite(gain)&&finite(delta)?(gain*13+Math.max(0,delta))/14:null;loss=finite(loss)&&finite(delta)?(loss*13+Math.max(0,-delta))/14:null;}
  const rsi14=finite(gain)&&finite(loss)?loss===0?(gain===0?50:100):100-100/(1+gain/loss):null;
  const ma50=sma(50),ma200=sma(200),old=i>=54?mean(bars.slice(i-54,i-4).map(x=>x.c)):null;
  return {date:b.date,rsi14,ema20:ema,sma50:ma50,sma200:ma200,slope50:old>0&&ma50>0?(ma50/old-1)*100:null,atr14:atr,atrPct:atr>0&&b.c>0?atr/b.c*100:null,extensionATR:atr>0&&finite(ema)?(b.c-ema)/atr:null};
 });
}
function review(stock,spy,semi){
 const bars=stock.bars||[],points=root.PriceClues.analyze(bars).points;
 const pm=new Map(root.PriceClues.analyze(spy.bars||[]).points.map(p=>[p.date,p]));
 const sm=new Map(root.PriceClues.analyze(semi.bars||[]).points.map(p=>[p.date,p]));
 const end=points.at(-1),events=[];let previous={dip:false,trend:false};
 for(const p of points){const a=pm.get(p.date),b=sm.get(p.date);const trendKnown=p.trendKnown&&a&&!a.review&&finite(a.stock)&&b&&!b.review&&finite(b.stock);const flags={dip:p.dip,trend:!!(trendKnown&&p.trend&&a.stock>0&&b.stock>0)};
  for(const type of ['dip','trend'])if(flags[type]&&!previous[type])events.push({date:p.date,index:p.index,type,name:type==='dip'?'回撤企稳候选':'趋势技术候选',close:p.c});previous=flags;
 }
 if(!end)return {status:'missing',events:[],latest:null,indicators:null};
 const a=pm.get(end.date),b=sm.get(end.date),usable=stock.status==='ok';
 const known=usable&&end.trendKnown&&spy.status==='ok'&&semi.status==='ok'&&a&&!a.review&&finite(a.stock)&&b&&!b.review&&finite(b.stock);
 const check=(label,value,pass,target)=>({label,value:finite(value)?value:null,status:!known||!finite(value)?'unknown':pass?'yes':'no',target});
 const checks=[check('SPY 高于 SMA50',a?.stock,a?.stock>0,'> 0%'),check('SOXX 高于 SMA50',b?.stock,b?.stock>0,'> 0%'),check('个股相对 SMA50',end.stock,end.stock>0&&end.stock<=10,'> 0% 且 ≤ 10%'),check('当日量比',end.volume,end.volume>=1.2,'≥ 1.20 倍')];
 const calculated=usable&&!end.review?indicators(bars):[];const ind=calculated.at(-1)||null;
 if(ind){const base=points.at(-21),benchmarkBase=base?sm.get(base.date):null;ind.relative20=known&&base?.c>0&&benchmarkBase?.c>0&&b.c>0?((end.c/base.c)/(b.c/benchmarkBase.c)-1)*100:null;ind.price=end.c;const prev=points.at(-2);ind.change=prev?.c>0?end.c-prev.c:null;ind.changePct=prev?.c>0?(end.c/prev.c-1)*100:null;ind.volume=end.volume;
  const cutoff=new Date(end.date+'T00:00:00Z');cutoff.setUTCDate(cutoff.getUTCDate()-364);const start52=cutoff.toISOString().slice(0,10),window52=bars.filter(r=>r.date>=start52);
  ind.range52=bars[0]?.date<=start52&&window52.length&&window52.every(r=>r.h>0&&r.l>0)?{low:Math.min(...window52.map(r=>r.l)),high:Math.max(...window52.map(r=>r.h)),start:start52,end:end.date}:null;
  if(ind.range52){const range=ind.range52;range.position=range.high>range.low?Math.max(0,Math.min(100,(end.c-range.low)/(range.high-range.low)*100)):50;range.fromHigh=(end.c/range.high-1)*100;range.fromLow=(end.c/range.low-1)*100;}
  const weeks=new Map();for(const r of bars){const d=new Date(r.date+'T00:00:00Z');d.setUTCDate(d.getUTCDate()+((5-d.getUTCDay()+7)%7));const key=d.toISOString().slice(0,10);if(key<=end.date)weeks.set(key,r.c);}
  const weekly=[...weeks.values()];ind.sma20week=weekly.length>=20?mean(weekly.slice(-20)):null;ind.week20Pct=ind.sma20week>0?(end.c/ind.sma20week-1)*100:null;
  ind.crossover=null;for(let i=1;i<calculated.length;i++){const x=calculated[i-1],y=calculated[i];if([x.sma50,x.sma200,y.sma50,y.sma200].every(finite)){if(x.sma50<=x.sma200&&y.sma50>y.sma200)ind.crossover={type:'golden',date:y.date,age:calculated.length-1-i};if(x.sma50>=x.sma200&&y.sma50<y.sma200)ind.crossover={type:'death',date:y.date,age:calculated.length-1-i};}}}
 const latest=events.at(-1)||null;
 const dipKnown=usable&&end.dipKnown;
 const dipChecks=[{label:'距60日高点回撤',value:end.drawdown,status:!dipKnown?'unknown':end.drawdown<=-15?'yes':'no',target:'≤ −15%'},{label:'收复前日高点',value:end.stabilize,status:!dipKnown?'unknown':end.stabilize>0?'yes':'no',target:'> 0%'},{label:'当日量比',value:end.volume,status:!dipKnown?'unknown':end.volume>=1?'yes':'no',target:'≥ 1.00 倍'}];
 const active=latest?.type==='dip'?dipChecks:checks;
 return {status:usable?'ok':stock.status,date:end.date,start:bars[0]?.date,ruleVersion:'技术条件 0.2',events:events.slice(-12),latest:latest?{...latest,age:points.length-1-latest.index,current:active.some(c=>c.status==='unknown')?'unknown':active.every(c=>c.status==='yes')?'met':'unmet',blockers:active.filter(c=>c.status!=='yes')}:null,checks,dipChecks,indicators:ind,scope:'按当前技术条件逐日回算，连续满足仅标记首日；不是当时发出的提醒，也不含估值、行业广度与经营核查。'};
}
root.TechnicalReview={indicators,review};if(typeof module!=='undefined')module.exports=root.TechnicalReview;
})(globalThis);
