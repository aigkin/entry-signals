import { ALLOWED_SYMBOLS } from './storage.mjs';
import { canWriteResearch } from './access.mjs';
const DATE=/^\d{4}-\d{2}-\d{2}$/, MAX_AGE=90*86400000, day=n=>new Date(n).toISOString().slice(0,10), finite=x=>typeof x==='number'&&Number.isFinite(x);
const err=(m,s=400)=>Response.json({error:m},{status:s});
function validate(x,now){
 if(!x||typeof x!=='object'||Array.isArray(x))return'请求体必须是 JSON 对象';
 for(const [k,min,max] of [['fairValue',.01,1e7],['revision',-100,100]])if(x[k]!=null&&(!finite(x[k])||x[k]<min||x[k]>max))return`${k} 超出有效范围`;
 if(x.revision!=null&&!/^\d{4}$/.test(String(x.fiscalYear||'')))return'填写收入修正时必须填写财年';
 if(x.fiscalYear!=null&&!/^\d{4}$/.test(String(x.fiscalYear)))return'财年格式无效';
 if(!['unknown','no','yes'].includes(x.broken))return'基本面状态无效';
 if(typeof x.rationale!=='string'||!x.rationale.trim()||x.rationale.length>2000)return'依据必填且不超过 2000 字';
 if(typeof x.sourceUrl!=='string'||x.sourceUrl.length>2048)return'证据链接无效'; let u;try{u=new URL(x.sourceUrl)}catch{return'证据链接无效'}if(u.protocol!=='https:')return'证据链接必须使用 HTTPS';
 if(typeof x.asOf!=='string'||!DATE.test(x.asOf)||typeof x.expiresOn!=='string'||!DATE.test(x.expiresOn))return'日期格式无效';
 if(new Date(x.asOf+'T00:00:00Z').toISOString().slice(0,10)!==x.asOf||new Date(x.expiresOn+'T00:00:00Z').toISOString().slice(0,10)!==x.expiresOn)return'日期无效';
 const a=Date.parse(x.asOf+'T00:00:00Z'),e=Date.parse(x.expiresOn+'T00:00:00Z'),n=Date.parse(day(now)+'T00:00:00Z');if(!Number.isFinite(a)||!Number.isFinite(e)||a>n)return'asOf 不能是未来日期';if(e<a||e-a>MAX_AGE)return'expiresOn 必须不早于 asOf 且不超过 90 日';return null;
}
const fromRow=r=>r?{symbol:r.symbol,fairValue:r.fair_value==null?null:Number(r.fair_value),revision:r.revision==null?null:Number(r.revision),fiscalYear:r.fiscal_year,broken:r.broken,rationale:r.rationale,sourceUrl:r.source_url,asOf:r.as_of,expiresOn:r.expires_on,updatedAt:r.updated_at}:null;
export async function readResearch(env,symbol){if(!env?.DB||!ALLOWED_SYMBOLS.has(symbol))return null;const r=await env.DB.prepare('SELECT * FROM research_records WHERE symbol=?').bind(symbol).first();return fromRow(r)}
export function researchValues(record,close,now=Date.now()){if(!record||!DATE.test(record.expiresOn||'')||record.expiresOn<day(now))return{upside:null,revision:null,broken:'unknown'};const etf=['SPY','SOXX','DRAM'].includes(record.symbol);return{upside:etf?null:(finite(close)&&close>0&&finite(record.fairValue)?(record.fairValue/close-1)*100:null),revision:etf?null:(finite(record.revision)?record.revision:null),broken:etf?'unknown':(['unknown','no','yes'].includes(record.broken)?record.broken:'unknown')};}
export async function researchApi(request,env){
 const u=new URL(request.url),symbol=u.searchParams.get('symbol');if(!ALLOWED_SYMBOLS.has(symbol))return err('不支持的标的');const h={'cache-control':'no-store'};
 if(request.method==='GET'){if(!env?.DB)return Response.json({symbol,record:null,status:'disabled'},{headers:h});try{const r=await readResearch(env,symbol);const status=!r?'missing':r.expiresOn<day(Date.now())?'expired':'ok';return Response.json({symbol,record:r,status},{headers:h})}catch{return Response.json({symbol,record:null,status:'error'},{status:503,headers:h})}}
 if(request.method!=='POST')return err('Method not allowed',405);
 if(!canWriteResearch(request,env))return err('仅网站所有者可以保存研究记录',403);
 const origin=request.headers.get('origin');if(origin&&origin!==u.origin)return err('跨源请求被拒绝',403);if(!(request.headers.get('content-type')||'').toLowerCase().startsWith('application/json'))return err('请求必须是 JSON');const len=Number(request.headers.get('content-length'));if(Number.isFinite(len)&&len>16384)return err('请求体过大',413);
 let body;try{const raw=await request.text();if(new TextEncoder().encode(raw).byteLength>16384)return err('请求体过大',413);body=JSON.parse(raw)}catch{return err('JSON 无效')}const problem=validate(body,Date.now());if(problem)return err(problem);if(!env?.DB)return Response.json({symbol,record:null,status:'disabled'},{status:503,headers:h});
 const vals=[symbol,body.fairValue??null,body.revision??null,body.fiscalYear??null,body.broken,body.rationale.trim(),body.sourceUrl,body.asOf,body.expiresOn,new Date().toISOString()];try{await env.DB.prepare('INSERT INTO research_records(symbol,fair_value,revision,fiscal_year,broken,rationale,source_url,as_of,expires_on,updated_at) VALUES(?,?,?,?,?,?,?,?,?,?) ON CONFLICT(symbol) DO UPDATE SET fair_value=excluded.fair_value,revision=excluded.revision,fiscal_year=excluded.fiscal_year,broken=excluded.broken,rationale=excluded.rationale,source_url=excluded.source_url,as_of=excluded.as_of,expires_on=excluded.expires_on,updated_at=excluded.updated_at').bind(...vals).run();return Response.json({symbol,record:await readResearch(env,symbol),status:'saved'},{headers:h})}catch{return Response.json({symbol,record:null,status:'error'},{status:503,headers:h})}
}
