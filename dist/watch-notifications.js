(function(root){
 const KEY='watch-signals-v1',SUFFIX='非买入确认 · 下一日重核';
 function completed(date,now){const parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:'America/New_York',year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',hourCycle:'h23'}).formatToParts(new Date(now)).map(p=>[p.type,p.value]));const day=`${parts.year}-${parts.month}-${parts.day}`;return /^\d{4}-\d{2}-\d{2}$/.test(date||'')&&(date<day||date===day&&Number(parts.hour)>=17)&&now-Date.parse(date+'T00:00:00Z')<=5*86400000;}
 function read(storage){try{const x=JSON.parse(storage.getItem(KEY));return x&&x.previous&&typeof x.previous==='object'&&x.sent&&typeof x.sent==='object'?{...x,recent:Array.isArray(x.recent)?x.recent:[]}: {previous:{},sent:{},recent:[]};}catch{return{previous:{},sent:{},recent:[]};}}
 function update(storage,rows,options={}){
  if(options.cached||options.sample)return{events:[],recent:read(storage).recent,skipped:true};
  const now=options.now??Date.now(),state=read(storage),events=[];
  for(const r of rows){if(r.status!=='ok'||r.blocking||!completed(r.date,now)||!['at','near','observe'].includes(r.position))continue;
   const prev=state.previous[r.symbol];if(prev?.date>r.date)continue;
   const add=(type,label)=>{const key=`${r.symbol}:${type}:${r.date}`;if(state.sent[key])return;state.sent[key]=now;const event={key,symbol:r.symbol,type,date:r.date,label,observedAt:new Date(now).toISOString(),message:`${r.symbol} · ${label} · 日线 ${r.date} · ${SUFFIX}`};events.push(event);state.recent.unshift(event);};
   if(prev){if(prev.position==='observe'&&['at','near'].includes(r.position))add('price_'+r.position,r.position==='at'?'到价':'接近规则区间');
    if(!prev.buy&&r.buy&&!r.observeOnly&&!!prev.observeOnly===!!r.observeOnly)add('suggestion_buy','规则满足 · '+(r.path==='panic'?'回撤路径':'趋势路径'));}
   state.previous[r.symbol]={date:r.date,position:r.position,buy:!!r.buy,observeOnly:!!r.observeOnly};
  }
  state.recent=state.recent.slice(0,30);
  for(const key of Object.keys(state.sent))if(now-state.sent[key]>90*86400000)delete state.sent[key];
  try{storage.setItem(KEY,JSON.stringify(state));return{events,recent:state.recent,persisted:true};}catch{return{events:[],recent:[],persisted:false};}
 }
 root.WatchNotifications={read,update,completed,SUFFIX};if(typeof module!=='undefined')module.exports=root.WatchNotifications;
})(globalThis);
