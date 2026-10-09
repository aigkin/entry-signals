(function(root){
const definitions=[['fear','VIX 历史百分位',0,100,'分位','过去 3 年；越高代表波动预期越极端'],['drawdown','距 60 日高点回撤',-100,0,'%','使用收盘价；下跌填负值'],['stabilize','收盘距前日最高价',-100,100,'%','大于 0 代表收盘收复前日最高价'],['volume','成交量 / 20 日均量',0,20,'倍','1.2 表示高于均量 20%'],['upside','基准价值相对现价空间',-100,1000,'%','使用已折现、考虑稀释的股权价值'],['revision','收入共识 30 日修正',-100,1000,'%','比较同一财年、同一口径'],['market','大盘距 200 日均线',-100,100,'%','SPY 收盘价相对均线偏离'],['sector','行业距 50 日均线',-100,100,'%','SOXX 收盘价相对均线偏离'],['breadth','行业站上 50 日均线比例',0,100,'%','使用同日成分股数据'],['stock','个股距 50 日均线',-100,100,'%','过高时拦截趋势追涨']];
const presets={waiting:{fear:58,drawdown:-9,stabilize:-1,volume:0.9,upside:12,revision:2,market:3,sector:-2,breadth:43,stock:-3,broken:'no'},panic:{fear:91,drawdown:-24,stabilize:1.5,volume:1.4,upside:24,revision:-2,market:-4,sector:-7,breadth:28,stock:-8,broken:'no'},trend:{fear:43,drawdown:-4,stabilize:0.8,volume:1.5,upside:12,revision:5,market:6,sector:4,breadth:72,stock:5,broken:'no'},trap:{fear:96,drawdown:-31,stabilize:-3,volume:1.8,upside:28,revision:-12,market:-9,sector:-12,breadth:17,stock:-19,broken:'yes'},empty:{broken:'unknown'}};
function confirmationRules(d,path){
 const specs=path==='panic'?[['估值留有空间','upside',15],['收入预期未明显恶化','revision',-5]]:[['估值留有空间','upside',5],['收入预期稳定或上修','revision',0]];
 return specs.map(([label,key,min])=>{const f=definitions.find(x=>x[0]===key);const v=d[key];return{label,status:typeof v==='number'&&Number.isFinite(v)&&v>=f[2]&&v<=f[3]?(v>=min?'yes':'no'):'unknown'};});
}
function confirmation(d,path){
 if(d.broken==='yes')return{status:'blocked',text:'基本面已失效'};
 const rules=confirmationRules(d,path);
 if(d.broken!=='no'||rules.some(x=>x.status==='unknown'))return{status:'unknown',text:'估值与基本面待确认'};
 return rules.every(x=>x.status==='yes')?{status:'supported',text:'已有初步支持'}:{status:'unmet',text:'确认条件尚未满足'};
}
function actionState(d,r){
 if(d.broken==='yes')return{key:'blocked',label:'基本面拦截',size:'不计算',reason:'经营假设已失效，禁止买入与加仓。',next:'重新核实经营假设与盈利预期。'};
 if(d.broken!=='no')return{key:'observe',label:'观察',size:'不计算',reason:'基本面状态尚未核实，暂不生成仓位建议。',next:'补齐估值、盈利修正和基本面信息。'};
 const p=r.panic.every(x=>x.status==='yes'),t=r.trend.every(x=>x.status==='yes');
 if(p&&t)return{key:'review',label:'进入人工复核',size:'不计算仓位',reason:'两类价格与基本面条件均满足当前试用规则，仍需核实来源、风险和个人计划。',next:'检查数据日期、公司依据和可能推翻判断的情况。'};
 if(p||t)return{key:'review',label:'进入人工复核',size:'不计算仓位',reason:(p?'回撤企稳':'趋势转强')+'路径满足当前试用规则，仍需核实公司依据和风险。',next:'检查数据日期、公司依据和可能推翻判断的情况。'};
 return{key:'observe',label:'观察',size:'不计算',reason:'价格路径尚未完整，继续等待。',next:'等待价格条件或盈利预期改善。'};
}
function evaluate(d){const valid=k=>{const f=definitions.find(x=>x[0]===k);return typeof d[k]==='number'&&Number.isFinite(d[k])&&d[k]>=f[2]&&d[k]<=f[3]};const rule=(label,keys,fn)=>({label,status:keys.every(valid)?fn()?'yes':'no':'unknown'});const panic=[rule('恐慌进入极端区域',['fear'],()=>d.fear>=80),rule('价格回撤达到阈值',['drawdown'],()=>d.drawdown<=-15),rule('价格企稳与成交确认',['stabilize','volume'],()=>d.stabilize>0&&d.volume>=1),...confirmationRules(d,'panic')];const trend=[rule('市场与行业趋势同向',['market','sector'],()=>d.market>0&&d.sector>0),rule('行业上涨广度确认',['breadth'],()=>d.breadth>=60),rule('个股趋势与成交确认',['stock','volume'],()=>d.stock>0&&d.volume>=1.2),confirmationRules(d,'trend')[1],{label:'价格尚未过热',status:(()=>{const valuation=confirmationRules(d,'trend')[0];return valuation.status==='unknown'||!valid('stock')?'unknown':valuation.status==='yes'&&d.stock<=10?'yes':'no';})()}];
 // Each path owns its date gate. A missing peer date cannot suppress a complete dip path.
 if(d.panicAligned===false) panic[0]={label:'恐慌与价格日期待对齐',status:'unknown'};
 if(d.aligned===false) trend[0]={label:'市场与行业日期待对齐',status:'unknown'};
 const p=panic.every(x=>x.status==='yes'),t=trend.every(x=>x.status==='yes');let decision='继续观察',explanation='已有部分线索，当前试用路径尚未完整。';if(d.broken==='yes'){decision='先复核公司风险';explanation='研究标记的核心经营假设可能失效，先核实公司情况。'}else if(d.broken!=='no'){decision='公司依据待核实';explanation='先检查经营假设和研究来源，再看价格条件。'}else if(p||t){decision=p&&t?'两类价格线索均出现':p?'回撤企稳线索':'趋势转强线索';explanation='当前输入满足试用条件，可继续人工核实；这不是收益预测或买入结论。'}else if(panic.some(x=>x.status==='unknown')||trend.some(x=>x.status==='unknown')){decision='信息不足';explanation='关键输入未知，暂时无法核对完整路径。'}const result={panic,trend,panicComplete:p,trendComplete:t,decision,explanation,coverage:definitions.filter(f=>valid(f[0])).length+(d.broken==='yes'||d.broken==='no'?1:0)};return{...result,action:actionState(d,result)};}
root.EntryEngine={definitions,presets,evaluate,confirmationRules,confirmation,actionState};if(typeof module!=='undefined')module.exports=root.EntryEngine;
})(globalThis);
