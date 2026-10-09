export function auditPrices(bars=[],now=Date.now(),rejected=0){
 const recent=bars.slice(-200),last=bars.at(-1),jumps=[],gaps=[];
 for(let i=1;i<recent.length;i++){const a=recent[i-1],b=recent[i],change=(b.c/a.c-1)*100,days=(Date.parse(b.date)-Date.parse(a.date))/86400000;if(Math.abs(change)>45)jumps.push({date:b.date,previousDate:a.date,change});if(days>7)gaps.push({from:a.date,to:b.date,days});}
 const missingVolume=bars.slice(-21).filter(b=>!Number.isFinite(b.v)||b.v<=0).length;
 const age=last?Math.floor((now-Date.parse(last.date+'T00:00:00Z'))/86400000):null;
 const reasons=[];
 if(rejected)reasons.push(`来源中有 ${rejected} 根无效或未完成日线，已排除，需核实。`);
 if(jumps.length)reasons.push(...jumps.slice(-3).map(j=>`${j.previousDate} → ${j.date} 收盘变化 ${j.change>=0?'+':''}${j.change.toFixed(2)}%，超过45%异常检查线；原因未确认。`));
 if(gaps.length)reasons.push(...gaps.slice(-3).map(g=>`${g.from} 至 ${g.to} 相隔 ${g.days} 个自然日，需核实停牌或数据缺口。`));
 if(missingVolume)reasons.push(`最近最多21根日线中有 ${missingVolume} 根成交量缺失或为零，量比暂不可靠。`);
 if(bars.length<60)reasons.push(`只有 ${bars.length} 根日线，60日回撤所需历史不足。`);
 if(age===null||now-Date.parse(last.date+'T00:00:00Z')>5*86400000)reasons.push('最新行情超过5个自然日或尚无数据，暂停本次价格判断。');
 return {count:bars.length,latestDate:last?.date||null,ageDays:age,rejected,missingVolume,jumps:jumps.slice(-3),gaps:gaps.slice(-3),blocking:rejected>0||jumps.length>0||gaps.length>0||missingVolume>0,reasons,adjustment:'未复权；拆股与分红尚未自动核实',scope:'检查最近200根内的跳价和大于7个自然日的间隔。未接交易所日历，小缺口和公司行动可能未检出。'};
}
