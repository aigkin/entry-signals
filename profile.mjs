const profileSymbols=new Set(['SPY','SOXX','MRVL','DRAM','NBIS','NVDA','ASX','INTC','AAOI']);
const profileCache=new Map();
export function parseProfile(payload,symbol){
 if(payload?.data?.symbol!==symbol)throw Error('wrong profile symbol');const s=payload.data.summaryData||{};
 const text=k=>typeof s[k]?.value==='string'&&s[k].value!=='N/A'?s[k].value.slice(0,120):null;
 const raw=text('MarketCap'),marketCap=raw&&/^\$?[\d,]+(?:\.\d+)?$/.test(raw)?Number(raw.replace(/[$,]/g,'')):null;
 return {industry:text('Industry'),sector:text('Sector'),marketCap:marketCap>0?marketCap:null,exchange:text('Exchange')};
}
export function parseEarningsDate(html,now=Date.now()){
 const clean=x=>x.replace(/<[^>]*>/g,' ').replace(/&nbsp;|&#160;/g,' ').replace(/\s+/g,' ').trim();
 for(const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)){
  const cells=[...row[1].matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/g)].map(x=>clean(x[1]));
  if(cells.length!==2||! /^(?:Est\. Earnings|Earnings Date|Next Earnings Date|Estimated Earnings Date)$/i.test(cells[0]))continue;
  const match=cells[1].match(/\b(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec)\s+(\d{1,2}),?\s+(\d{4})\b/i);if(!match)continue;
  const m=['jan','feb','mar','apr','may','jun','jul','aug','sep','oct','nov','dec'].indexOf(match[1].toLowerCase()),d=Number(match[2]),y=Number(match[3]),date=new Date(Date.UTC(y,m,d));if(date.getUTCMonth()!==m||date.getUTCDate()!==d)continue;
  const iso=date.toISOString().slice(0,10),today=new Date(now).toISOString().slice(0,10);if(iso<today||+date-now>370*86400000)continue;
  return {date:iso,status:'estimated',timing:'unknown',note:'来源预计日期，尚未核验公司正式公告；盘前或盘后时段待确认。'};
 }
 return {date:null,status:'missing',timing:'unknown',note:'未取得有效的下一次财报日期，请核对公司官方公告。'};
}
export async function profile(symbol){
 if(!profileSymbols.has(symbol))return Response.json({error:'unsupported symbol'},{status:400});
 if(['SPY','SOXX','DRAM'].includes(symbol))return Response.json({symbol,status:'not_applicable',earnings:{date:null,status:'not_applicable'},note:'ETF没有单一公司的财报日；请检查持仓成分的财报事件。'});
 const hit=profileCache.get(symbol);if(hit&&Date.now()-hit.at<3600000)return Response.json(hit.data);
 const summaryUrl=`https://api.nasdaq.com/api/quote/${symbol}/summary?assetclass=stocks`,earningsUrl=`https://stockanalysis.com/stocks/${symbol.toLowerCase()}/`;
 const headers={'user-agent':'Mozilla/5.0 (compatible; EntrySignals/1.0)','accept':'application/json,text/html'};
 const [summary,earnings]=await Promise.allSettled([
  fetch(summaryUrl,{headers,signal:AbortSignal.timeout(9000)}).then(async r=>{if(!r.ok)throw Error();return parseProfile(await r.json(),symbol);}),
  fetch(earningsUrl,{headers,signal:AbortSignal.timeout(9000)}).then(async r=>{if(!r.ok)throw Error();return parseEarningsDate(await r.text());})
 ]);
 const data={symbol,status:summary.status==='fulfilled'?'snapshot':'missing',...(summary.status==='fulfilled'?summary.value:{industry:null,sector:null,marketCap:null}),earnings:earnings.status==='fulfilled'?earnings.value:{date:null,status:'missing',note:'财报日期来源暂不可用；请核对公司官方公告。'},summaryUrl,earningsUrl,retrievedAt:new Date().toISOString(),note:'公司资料为来源快照，市值统计日期未独立核验；与日线收盘可能不同步。'};
 if(summary.status==='fulfilled'||data.earnings.date)profileCache.set(symbol,{at:Date.now(),data});return Response.json(data);
}
