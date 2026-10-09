const test=require('node:test'),assert=require('node:assert/strict');
require('../dist/price-clues.js');const {indicators,review}=require('../dist/technical-review.js');
const bars=(n=230)=>Array.from({length:n},(_,i)=>({date:new Date(Date.UTC(2025,0,1+i)).toISOString().slice(0,10),o:100,h:102,l:98,c:100,v:100}));
const row=b=>({status:'ok',bars:b});
test('EMA seed, Wilder ATR and flat averages have exact known values',()=>{const p=indicators(bars());assert.equal(p[18].ema20,null);assert.equal(p[19].ema20,100);assert.equal(p[13].atr14,null);assert.equal(p[14].atr14,4);assert.equal(p[199].sma200,100);assert.equal(p[198].sma200,null);assert.equal(p.at(-1).slope50,0);assert.equal(p.at(-1).extensionATR,0);const a=bars(21);a[20].c=121;assert.equal(indicators(a).at(-1).ema20,102);});
test('ATR includes overnight gaps and uses Wilder smoothing',()=>{const a=bars(16);a[15]={...a[15],o:110,h:112,l:108,c:110};assert.equal(indicators(a).at(-1).atr14,(4*13+12)/14);});
test('same-day market confirmation, historical onset and current blockers',()=>{const s=bars(80),p=bars(80),b=bars(80);for(let i=60;i<80;i++){p[i].c=102;b[i].c=103;}s[60].c=102;s[60].v=120;s[61].c=103;s[61].v=150;const r=review(row(s),row(p),row(b));assert.equal(r.events.length,1);assert.equal(r.latest.date,s[60].date);assert.equal(r.latest.current,'unmet');assert.ok(r.latest.blockers.some(x=>x.label==='当日量比'));assert.equal(r.latest.age,19);});
test('peer volume is not a market trend requirement; missing dates remain unknown',()=>{const s=bars(80),p=bars(80),b=bars(80);s[79].c=102;s[79].v=150;p[79].c=102;b[79].c=102;for(const x of p)x.v=null;const r=review(row(s),row(p),row(b));assert.equal(r.latest.current,'met');const missing=review(row(s),row(p.slice(0,-1)),row(b));assert.equal(missing.latest,null);assert.ok(missing.checks.every(c=>c.status==='unknown'));});
test('future data do not rewrite historical indicators or candidate dates',()=>{const s=bars(90),p=bars(90),b=bars(90);for(let i=60;i<90;i++){p[i].c=102;b[i].c=103;}s[60].c=102;s[60].v=150;s[85].c=200;assert.deepEqual(indicators(s.slice(0,70)),indicators(s).slice(0,70));assert.deepEqual(review(row(s.slice(0,70)),row(p.slice(0,70)),row(b.slice(0,70))).events,review(row(s),row(p),row(b)).events.filter(x=>x.index<70));});
test('cached and abnormal prices cannot become current candidates or indicators',()=>{const s=bars(80),p=bars(80);s[79].c=102;s[79].v=150;p[79].c=102;const r=review({status:'cached',bars:s},row(p),row(p));assert.equal(r.latest.current,'unknown');assert.equal(r.indicators,null);s[79].c=200;const bad=review({status:'review',bars:s},row(p),row(p));assert.equal(bad.indicators,null);assert.equal(bad.latest,null);});
test('relative strength uses matching start and end dates',()=>{const s=bars(80),p=bars(80);s[79].c=110;p[79].c=105;const r=review(row(s),row(p),row(p));assert.ok(Math.abs(r.indicators.relative20-((1.1/1.05-1)*100))<1e-10);const missing=p.filter(x=>x.date!==s[59].date);assert.equal(review(row(s),row(p),row(missing)).indicators.relative20,null);});
test('RSI Wilder reference, rising/falling/flat boundaries and missing data',()=>{
 const closes=[44.34,44.09,44.15,43.61,44.33,44.83,45.1,45.42,45.84,46.08,45.89,46.03,45.61,46.28,46.28,46];
 const a=closes.map((c,i)=>({...bars(16)[i],c}));const p=indicators(a);assert.equal(p[13].rsi14,null);assert.ok(Math.abs(p[14].rsi14-70.46413502109705)<1e-9);assert.ok(Math.abs(p[15].rsi14-66.24961855355505)<1e-9);
 assert.equal(indicators(bars(20)).at(-1).rsi14,50);assert.equal(indicators(bars(20).map((b,i)=>({...b,c:100+i}))).at(-1).rsi14,100);assert.equal(indicators(bars(20).map((b,i)=>({...b,c:100-i}))).at(-1).rsi14,0);
 a[5].c=null;assert.equal(indicators(a).at(-1).rsi14,null);
});
test('52-week range needs full calendar coverage and uses intraday high low',()=>{const a=bars(400),p=bars(400);a[399].h=120;a[399].l=95;a[399].c=110;const r=review(row(a),row(p),row(p));assert.equal(r.indicators.range52.high,120);assert.equal(r.indicators.range52.low,95);assert.equal(r.indicators.range52.position,60);assert.equal(review(row(a.slice(-200)),row(p),row(p)).indicators.range52,null);});
test('20-week average excludes incomplete current trading week',()=>{
 // Use sufficient daily history for review, while weekly grouping stays explicit.
 const daily=bars(217).filter(x=>new Date(x.date+'T00:00:00Z').getUTCDay()>=1&&new Date(x.date+'T00:00:00Z').getUTCDay()<=5);const last=daily.at(-1);last.c=110;
 const r=review(row(daily),row(daily),row(daily));assert.equal(r.indicators.sma20week,100);assert.ok(Math.abs(r.indicators.week20Pct-10)<1e-9);
});
