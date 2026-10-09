(function(root){
function layers(d){const limits={market50:[-100,100],sector:[-100,100],stock:[-100,100],drawdown:[-100,0],stabilize:[-100,100],volume:[0,20],upside:[-100,1000],revision:[-100,1000]};const known=k=>typeof d[k]==='number'&&Number.isFinite(d[k])&&(!limits[k]||(d[k]>=limits[k][0]&&d[k]<=limits[k][1]));const envKnown=known('market50')&&known('sector')&&d.environmentAligned!==false;const environment=!envKnown?'环境数据待补齐':d.market50>0&&d.sector>0?'中期环境偏强':d.market50<=0&&d.sector<=0?'中期环境偏弱':'市场与行业分化';
 const dipKeys=['drawdown','stabilize','volume'];const dipKnown=dipKeys.every(known);const dip=dipKnown&&d.drawdown<=-15&&d.stabilize>0&&d.volume>=1;
 const trendKeys=['market50','sector','stock','volume'];const trendKnown=trendKeys.every(known)&&d.aligned!==false;const trend=trendKnown&&d.market50>0&&d.sector>0&&d.stock>0&&d.stock<=10&&d.volume>=1.2;
 const technical=trend?'趋势技术候选':dip?'回撤企稳候选':!dipKnown&&!trendKnown?'技术数据待补齐':'暂未出现技术候选';
 const engine=root.EntryEngine||(typeof require==='function'?require('./engine.js'):null);
 const confirmations={panic:engine.confirmation(d,'panic'),trend:engine.confirmation(d,'trend')};
 const confirmation=d.broken==='yes'?'基本面已失效':dip&&!trend?'低吸：'+confirmations.panic.text:trend&&!dip?'趋势：'+confirmations.trend.text:'低吸：'+confirmations.panic.text+'；趋势：'+confirmations.trend.text;

 return{environment,technical,confirmation,confirmations,headline:d.broken==='yes'?'基本面拦截':technical,dip,trend,envKnown,dipKnown,trendKnown};
}root.EntryLayers=layers;if(typeof module!=='undefined')module.exports=layers;
})(globalThis);
