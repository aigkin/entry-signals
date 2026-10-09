(function(root){
const valid=x=>typeof x==='number'&&Number.isFinite(x),pct=x=>Math.abs(x).toFixed(1)+'%';
function analyze(r){
const missing=(why,next=r.status==='review'?'先核实是否存在拆股或异常行情，再恢复判断。':'等行情恢复后再判断；可以稍后刷新。')=>({kind:'missing',state:'数据待补',reason:why,next,rank:3});
 if(r.researchRiskUnresolved)return{kind:'risk',state:'历史风险待复核',reason:r.researchStatus==='expired'?'此前研究记录了经营风险，但依据已经过期。过期不表示风险已经解除。':'此前记录了经营风险，当前尚无有效依据确认解除。研究缺失或读取失败不等于风险消失。',next:'查看原研究来源，补充新的经营证据；复核前不把价格转强视为风险解除。',rank:1};
 if(r.researchStatus==='ok'&&r.broken==='yes')return{kind:'risk',state:'先复核公司风险',reason:'已保存的研究记录显示，原来的经营判断可能失效。价格表现不能消除这项风险。',next:'重新检查经营变化和研究依据，再决定是否继续观察。',rank:1};
 if(r.status==='review'&&r.quality?.reasons?.length)return missing(r.quality.reasons[0],'查看行情质量核查和公司公告，确认异常原因后再判断。');
 if(r.status!=='ok')return missing(({stale:'最新日线较旧，暂不用于价格判断。',cached:'目前只有上次保存的行情，暂不用于本次判断。',review:'价格出现较大跳变，先核实是否拆股或行情异常。',loading:'正在获取日线数据。'})[r.status]||'暂时没有足够的行情数据，无法判断价格线索。');
 if(!['ma50','volume','drawdown','stabilize'].every(k=>valid(r[k])))return missing('价格或成交量历史不完整，暂时无法判断。','等待足够的日线和成交量记录。');
 if(r.drawdown<=-15&&r.stabilize>0&&r.volume>=1)return{kind:'watch',state:'价格线索 · 回撤后有企稳迹象',reason:`过去约60个交易日内从高点回落 ${pct(r.drawdown)}；今天收盘高于前一交易日最高价，成交量约为此前20日均量的 ${r.volume.toFixed(1)} 倍。`,next:r.symbol==='DRAM'?'接着核实ETF持仓、行业环境和成分股估值；这条价格线索不代表买入。':'接着核实公司研究依据、行业变化和估值；这条价格线索不代表买入。',rank:0};
 if(r.ma50>10)return{kind:'wait',state:'继续观察 · 离近期均价较远',reason:`收盘高于近50个交易日平均收盘价 ${pct(r.ma50)}，超过当前试用规则设定的10%参考线。`,next:`目前偏离 ${r.ma50.toFixed(2)}%；规则参考线是10%。均价会随新行情变化，这不是通用买入标准。`,rank:2};
 if(r.ma50>0&&r.volume>=1.2)return{kind:'watch',state:'价格线索 · 趋势转强迹象',reason:`收盘高于近50个交易日平均收盘价，成交量约为此前20日均量的 ${r.volume.toFixed(1)} 倍。`,next:r.symbol==='DRAM'?'再核实大盘、行业和ETF持仓；这条价格线索不代表买入。':'再核实大盘、行业和公司研究依据；这条价格线索不代表买入。',rank:0};
 if(r.drawdown<=-15)return{kind:'wait',state:'继续观察 · 企稳迹象尚不完整',reason:`过去约60个交易日内从高点回落 ${pct(r.drawdown)}；${r.stabilize<=0?'今天收盘还没有高于前一交易日最高价':'成交量尚未达到此前20日均量'}。`,next:(r.stabilize<=0?`收盘距前一日最高价 ${r.stabilize.toFixed(2)}%，当前试用规则要求高于0%。`:'价格企稳条件已满足。')+` 成交量约为此前20日均量的 ${r.volume.toFixed(2)} 倍，试用参考线为1.00倍。`,rank:2};
 return{kind:'wait',state:'继续观察',reason:r.ma50<=0?`收盘低于近50个交易日平均收盘价 ${pct(r.ma50)}，暂未出现页面关注的价格线索。`:`收盘高于近50个交易日平均收盘价，但成交量约为此前20日均量的 ${r.volume.toFixed(1)} 倍，尚未达到试用参考线。`,next:(r.ma50<=0?`目前低于均价 ${Math.abs(r.ma50).toFixed(2)}%；当前规则参考范围是高于均价且偏离不超过10%。`:'价格位置已满足试用条件。')+` 成交量参考线为1.20倍；这些阈值尚未验证，不是通用标准。`,rank:2};
}
function priceReference(r){
 if(r.status!=='ok'||r.quality?.blocking||!valid(r.close)||r.close<=0||!valid(r.ma50)||r.ma50<=-100)return {available:false,reason:'行情异常、过期或均线不足，暂不提供参考价。'};
 if(r.researchRiskUnresolved||(r.researchStatus==='ok'&&r.broken==='yes'))return {available:false,reason:'公司风险尚待复核，暂停提供参考价。'};
 const lower=r.close/(1+r.ma50/100),upper=lower*1.1;
 if(!valid(lower)||!valid(upper)||lower<=0)return {available:false,reason:'计算依据不足。'};
 return {available:true,lower,upper,date:r.date,position:r.ma50>10?'above':r.ma50<=0?'below':'inside',distancePercent:r.ma50>10?(upper/r.close-1)*100:r.ma50<=0?(lower/r.close-1)*100:0};
}
function pricePosition(r){
 const p=priceReference(r);
 if(!p.available)return {state:'观察',kind:'observe',reference:p,note:r.researchRiskUnresolved||(r.researchStatus==='ok'&&r.broken==='yes')?'风险待核':r.status==='loading'?'待更新':'待数据'};
 if(p.position==='inside')return {state:'到价',kind:'at',reference:p,note:'其他条件待核'};
 const near=Math.abs(p.distancePercent)<=3;
 return {state:near?'接近':'观察',kind:near?'near':'observe',reference:p,note:p.position==='above'?'等回落至区间':'等站上区间'};
}
function baseSuggestion(r,options={}){
 const none=(blockers)=>({state:'暂无',available:false,blockers,range:null});
 if(options.cached||r.status!=='ok'||r.quality?.blocking)return none(['行情待更新']);
 if(r.symbol==='DRAM')return none(['ETF需独立规则']);
 if(r.researchRiskUnresolved)return none(['历史经营风险待复核']);
 if(!r.entryValues)return none(['完整证据待更新']);
 if(!valid(r.close)||r.close<=0)return none(['价格缺失']);
 const inspect=root.DetailChecks?.inspect||(typeof require==='function'?require('./detail-checks.js').inspect:null);
 const result=inspect(r.entryValues,r.entrySources||[],r.symbol);
 const path=result.paths.find(p=>p.complete)||result.paths.find(p=>p.name===result.selected);
 const blockers=path.checks.filter(c=>c.status!=='met').map(c=>(c.status==='missing'?'缺 ':'未达到：')+c.label);
 if(!path.complete)return {...none(blockers),path:path.name};
 const d=r.entryValues,fair=r.close*(1+d.upside/100);
 const lower=path.name==='trend'?r.close/(1+d.stock/100):r.close/(1+d.stabilize/100);
 const upper=path.name==='trend'?Math.min(lower*1.1,fair/1.05):Math.min(r.close/(1+d.drawdown/100)*.85,fair/1.15);
 if(!valid(lower)||!valid(upper)||lower<=0||upper<=lower||r.close<=lower||r.close>upper+1e-8)return none(['价区无法核实']);
 // Price boundaries hold other evidence fixed; touching them on another day requires a new full check.
 return {state:'建议买 · 规则满足',available:true,path:path.name,blockers:[],range:{lower,upper,lowerExclusive:true},date:r.date,note:'按当前证据计算，下限不含；下一日重新确认'};
}
function suggestion(r,options={}){const result=baseSuggestion(r,options);return options.observeOnly?{...result,state:'暂无',available:false,range:null,observeOnly:true,blockers:['本地只观察',...result.blockers]}:result;}
root.WatchModel={analyze,priceReference,pricePosition,suggestion};if(typeof module!=='undefined')module.exports={analyze,priceReference,pricePosition,suggestion};
})(globalThis);
