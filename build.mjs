import {readFile,mkdir,writeFile,cp} from 'node:fs/promises';
const assets={};
const names=['watch-notifications.js','watch-cache.js','theme.css','index.html','detail-checks.js','price-clues.js','clue-chart.js','watch.css','watch-model.js','watch.js','stock-overview.js','demo.html','workspace.html','demo.css','demo.js','clarity.css','clarity.js','style.css','refinement.css','layer-style.css','engine.js','completeness.js','layers.js','app.js','insights.js','insights.css','study.js','study.css','macro.js','macro.css','fundamentals.js','decision-card.js','decision-card.css','history.js','history.css','research.js','research.css'];
for(const name of names){const type=name.endsWith('.html')?'text/html':name.endsWith('.css')?'text/css':'application/javascript';assets['/'+name]={body:await readFile('dist/'+name,'utf8'),type:type+'; charset=utf-8'};}
const modules=['breadth.mjs','access.mjs','watch-cache.mjs','dist/price-clues.js','dist/technical-review.js','dist/engine.js','dist/watch-model.js','observations.mjs','fundamentals.mjs','profile.mjs','macro.mjs','study.mjs','watchlist.mjs','prices.mjs','quality.mjs','storage.mjs','research.mjs','market.mjs'];
let backend='';for(const file of modules)backend+='\n'+(await readFile(file,'utf8')).replace(/^import .*?;\s*$/gm,'');
await mkdir('dist/server',{recursive:true});await mkdir('dist/.openai',{recursive:true});
await cp('.openai/hosting.json','dist/.openai/hosting.json');
await cp('drizzle','dist/.openai/drizzle',{recursive:true});
await writeFile('dist/server/index.js',backend+'\nconst assets='+JSON.stringify(assets)+`;\nexport default {async fetch(request,env){
 const u=new URL(request.url),symbol=u.searchParams.get('symbol')||'SPY';
 if(u.pathname==='/api/research')return researchApi(request,env);
 if(request.method!=='GET')return new Response('Method not allowed',{status:405});
 if(u.pathname==='/api/profile')return profile(symbol);
 if(u.pathname==='/api/fundamentals')return fundamentals(symbol);
 if(u.pathname==='/api/macro')return macro();
 if(u.pathname==='/api/study')return study(symbol,Number(u.searchParams.get('horizon')||60),env);
 if(u.pathname==='/api/observations')return observationHistory(symbol,env);
 if(u.pathname==='/api/watchlist')return u.searchParams.get('saved')==='1'?savedWatchlist(env):watchlist(env);
 if(u.pathname==='/api/access')return Response.json({canWriteResearch:canWriteResearch(request,env)},{headers:{'cache-control':'no-store'}});
 if(u.pathname==='/api/market')return market(symbol,env);
 if(u.pathname==='/api/history')return historyApi(symbol,env,u.searchParams.get('saved')==='1');
 if(u.pathname==='/api/db-status'){
  try{if(!env?.DB)throw Error();const result=await env.DB.prepare('SELECT COUNT(*) AS count FROM daily_bars').first();return Response.json({enabled:true,ready:true,bars:result.count});}
  catch{return Response.json({enabled:!!env?.DB,ready:false},{status:503});}
 }
 const a=assets[u.pathname==='/'?'/index.html':u.pathname];return a?new Response(a.body,{headers:{'content-type':a.type}}):new Response('Not found',{status:404});
}};`);
