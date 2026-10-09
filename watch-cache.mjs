const WATCH_SYMBOLS=['MRVL','DRAM','NBIS','NVDA','ASX','INTC','AAOI'];
export async function saveWatchlistCache(env,data){
 if(!env?.DB||!data.rows?.some(r=>r.status==='ok'))return;
 try{const savedAt=new Date().toISOString();await env.DB.prepare('INSERT INTO watchlist_cache(cache_key,saved_at,data_json) VALUES(?,?,?) ON CONFLICT(cache_key) DO UPDATE SET saved_at=excluded.saved_at,data_json=excluded.data_json WHERE excluded.saved_at>watchlist_cache.saved_at').bind('watch-1',savedAt,JSON.stringify({...data,changes:null})).run();}catch{console.error('Watchlist cache persistence unavailable');}
}
export async function savedWatchlist(env){
 let data=null,savedAt=null;
 if(env?.DB){try{const row=await env.DB.prepare('SELECT saved_at,data_json FROM watchlist_cache WHERE cache_key=?').bind('watch-1').first();if(row){data=JSON.parse(row.data_json);savedAt=row.saved_at;}}catch{}
 // Existing observation records also seed first visits before the new cache is populated.
 if(!data){const rows=await Promise.all(WATCH_SYMBOLS.map(async symbol=>{try{const r=await env.DB.prepare('SELECT data_json FROM watch_observations WHERE symbol=? AND rule_version=? ORDER BY id DESC LIMIT 1').bind(symbol,'watch-1').first();return r?JSON.parse(r.data_json):{symbol,status:'missing'};}catch{return{symbol,status:'missing'};}}));data={rows};savedAt=rows.map(r=>r.observedAt||'').sort().at(-1)||null;}}
 return Response.json({rows:data?.rows||[],savedAt,cached:true,changes:null},{headers:{'cache-control':'no-store'}});
}
