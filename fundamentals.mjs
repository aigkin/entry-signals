const fundamentalFields=[['Market Cap','市值','USD'],['Forward PE','预期市盈率','倍'],['PS Ratio','市销率','倍'],['Revenue','收入 · TTM','USD'],['Net Income','净利润 · TTM','USD'],['Free Cash Flow','自由现金流 · TTM','USD'],['Cash & Cash Equivalents','现金及等价物','USD'],['Total Debt','总债务','USD']];
const fundamentalCache=new Map();
const cleanFundamental=s=>s.replace(/<[^>]*>/g,'').replace(/&amp;/g,'&').replace(/&nbsp;/g,' ').trim();
export function parseFundamentals(html){
 const found=new Map();
 for(const row of html.matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/g)){
  const cells=[...row[1].matchAll(/<td\b[^>]*>([\s\S]*?)<\/td>/g)];if(cells.length!==2)continue;
  const name=cleanFundamental(cells[0][1]),display=cleanFundamental(cells[1][1]);
  if(!fundamentalFields.some(f=>f[0]===name)||!/^-?\d[\d,.]*(?:[BMTK])?$/.test(display))continue;
  const raw=cells[1][0].match(/title="(-?[\d,.]+)"/),m=display.match(/^(-?[\d,.]+)([BMTK])?$/);
  const value=raw?Number(raw[1].replaceAll(',','')):Number(m[1].replaceAll(',',''))*({K:1e3,M:1e6,B:1e9,T:1e12}[m[2]]||1);
  if(Number.isFinite(value))found.set(name,{value,display});
 }
 return fundamentalFields.map(([id,label,unit])=>({id,label,unit,...(found.get(id)||{value:null,display:null}),status:found.has(id)?'available':'missing'}));
}
export async function fundamentals(symbol){
 if(!['SPY','SOXX','MRVL','DRAM','NBIS','NVDA','ASX','INTC','AAOI'].includes(symbol))return Response.json({error:'unsupported symbol'},{status:400});
 if(['SPY','SOXX','DRAM'].includes(symbol))return Response.json({symbol,status:'not_applicable',cards:[],note:'ETF不套用单家公司财务指标。基金穿透持仓与加权估值尚未接入。'});
 const cached=fundamentalCache.get(symbol);if(cached&&Date.now()-cached.time<3600000)return Response.json(cached.data);
 const url='https://stockanalysis.com/stocks/'+symbol.toLowerCase()+'/statistics/';
 try{
  const response=await fetch(url,{headers:{'user-agent':'Mozilla/5.0 (compatible; EntrySignals/1.0)','accept':'text/html'},signal:AbortSignal.timeout(15000)});if(!response.ok)throw Error('source unavailable');
  const cards=parseFundamentals(await response.text()),coverage=cards.filter(c=>c.status==='available').length;
  const data={symbol,status:coverage?'snapshot':'missing',cards,coverage,url,source:'Stock Analysis 公开统计页',retrievedAt:new Date().toISOString(),asOf:null,note:'当前来源快照，非实时行情；未核验各字段统计截止日。TTM指过去12个月，现金及债务为来源最近报告口径。Forward PE为来源预期口径，不能与GAAP净利润直接推算。'};
  if(coverage)fundamentalCache.set(symbol,{time:Date.now(),data});return Response.json(data);
 }catch{return Response.json({symbol,status:'missing',cards:[],url,note:'公开来源暂不可用，未使用模拟值补齐。'});}
}
