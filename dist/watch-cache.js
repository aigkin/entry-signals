(function(root){
 const SYMBOLS=['MRVL','DRAM','NBIS','NVDA','ASX','INTC','AAOI'],KEY='watchlist-cache-v1',HOLDINGS='watch-holdings-v1';
 function normalize(data,now=Date.now()){
  if(!data||!Array.isArray(data.rows))return [];
  return SYMBOLS.map(symbol=>{
   const r=data.rows.find(x=>x?.symbol===symbol);
   if(!r||!Number.isFinite(r.close)||r.close<=0)return{symbol,status:'loading'};
   const age=now-Date.parse(r.date+'T00:00:00Z');
   return {...r,status:!Number.isFinite(age)||age<0||age>5*86400000?'stale':r.status};
  });
 }
 function read(storage){try{const data=JSON.parse(storage.getItem(KEY));return normalize(data).some(r=>Number.isFinite(r.close))?data:null;}catch{return null;}}
 function save(storage,data){try{if(data.rows?.some(r=>r.status==='ok'))storage.setItem(KEY,JSON.stringify({rows:data.rows,savedAt:new Date().toISOString()}));}catch{}}
 function holdings(storage){try{const data=JSON.parse(storage.getItem(HOLDINGS));return new Set(Array.isArray(data)?data.filter(s=>SYMBOLS.includes(s)):[]);}catch{return new Set();}}
 function saveHoldings(storage,value){try{storage.setItem(HOLDINGS,JSON.stringify([...value]));return true;}catch{return false;}}
 root.WatchCache={normalize,read,save,holdings,saveHoldings};
 if(typeof module!=='undefined')module.exports=root.WatchCache;
})(globalThis);
