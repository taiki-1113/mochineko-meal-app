const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output/verification');let browser,server;
(async()=>{
 server=http.createServer((req,res)=>{const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname),file=path.resolve(root,'.'+(name==='/'?'/index.html':name));if(!file.startsWith(root+path.sep)){res.writeHead(403);return res.end();}fs.readFile(file,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':({'.js':'application/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.json':'application/json','.ttf':'font/ttf'})[path.extname(file)]||'application/octet-stream'});res.end(e?'missing':b);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=process.env.MOCHI_TEST_URL||`http://127.0.0.1:${server.address().port}/`;
 browser=await chromium.launch({headless:true,executablePath:'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'}),page=await ctx.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install({time:new Date('2026-10-27T03:00:00Z')});await page.clock.pauseAt(new Date('2026-10-27T03:00:01Z'));await page.goto(base);
 const seed={children:[{id:'test',name:'たろう'}],selectedChildId:'test',durations:{breakfast:30,lunch:30,dinner:30},soundEnabled:false};
 const results=[];
 for(const test of [
  {stage:1,clock:.1,w:390,h:844,pose:'bite',file:'dining-bite.png'},
  {stage:5,clock:2.2,w:390,h:844,pose:'chew',file:'dining-chew.png'},
  {stage:9,clock:17,w:390,h:844,pose:'rest',file:'dining-full.png'},
  {stage:1,clock:.1,w:320,h:568,pose:'bite',file:'dining-small.png'},
  {stage:5,clock:2.2,w:844,h:390,pose:'chew',file:'dining-landscape.png'},
  {stage:9,clock:17,w:600,h:900,pose:'rest',file:'dining-desktop.png'},
 ]){
  await page.setViewportSize({width:test.w,height:test.h});
  await page.evaluate(({seed,test})=>{localStorage.setItem('mochineko.v1',JSON.stringify(seed));localStorage.setItem('mochineko.session',JSON.stringify({childId:'test',meal:'lunch',duration:30,startedAt:Date.now()-((test.stage-1)/8*1800000+1000),phase:'active',diningClock:test.clock}));},{seed,test});
  await page.reload();await page.waitForFunction(()=>!!document.querySelector('.dining-sheet'));await page.clock.runFor(450);
  assert.equal(await page.locator('#meal-screen').getAttribute('data-stage'),String(test.stage));
  assert.equal(await page.locator('#meal-screen').getAttribute('data-pose'),test.pose);
  assert.equal(await page.locator('.greeting-paws').count(),0);
  const layout=await page.evaluate(()=>{
   const rect=id=>{const r=document.getElementById(id).getBoundingClientRect();return{x:r.x,y:r.y,w:r.width,h:r.height,b:r.bottom,r:r.right};};
   return {cat:rect('meal-cat'),plate:rect('meal-plate'),button:rect('finish-button'),label:rect('meal-action-label'),overflow:document.documentElement.scrollWidth>innerWidth+1,food:document.getElementById('meal-plate').dataset.food};
  });
  assert.equal(layout.overflow,false);assert.ok(layout.cat.b<layout.plate.b,'cat baseline sits behind plate');
  if(test.w<test.h)assert.ok(layout.plate.b<layout.button.y,'plate remains above finish button');
  await page.screenshot({path:path.join(out,test.file),animations:'disabled'});
  results.push({stage:test.stage,pose:test.pose,food:layout.food,screen:test.file});
 }
 // Verify all three poses for each of the nine body stages and pause/resume behavior.
 await page.setViewportSize({width:390,height:844});
 for(let stage=1;stage<=9;stage++)for(const [clock,pose] of [[.1,'bite'],[2.2,'chew'],[17,'rest']]){
  await page.evaluate(({stage,clock,seed})=>{localStorage.setItem('mochineko.v1',JSON.stringify(seed));localStorage.setItem('mochineko.session',JSON.stringify({childId:'test',meal:'lunch',duration:30,startedAt:Date.now()-((stage-1)/8*1800000+1000),phase:'active',diningClock:clock}));},{stage,clock,seed});
  await page.reload();await page.waitForFunction(()=>!!document.querySelector('.dining-sheet'));await page.clock.runFor(450);
  assert.equal(await page.locator('#meal-screen').getAttribute('data-stage'),String(stage));assert.equal(await page.locator('#meal-screen').getAttribute('data-pose'),stage===9?'rest':pose);
 }
 await page.locator('#meal-cat').click({force:true});await page.clock.runFor(300);
 assert.equal(await page.locator('#meal-screen').getAttribute('data-action'),'pause');assert.equal(await page.locator('#meal-screen').getAttribute('data-pose'),'rest');
 await page.clock.runFor(5000);assert.equal(await page.locator('#meal-screen').getAttribute('data-action'),'pause');
 await page.clock.runFor(3500);assert.notEqual(await page.locator('#meal-screen').getAttribute('data-action'),'pause');
 await page.locator('#finish-button').click();await page.clock.runFor(500);assert.equal(await page.locator('#meal-screen').getAttribute('data-action'),'pause');
 await page.locator('#confirm-continue').click();await page.clock.runFor(500);assert.notEqual(await page.locator('#meal-screen').getAttribute('data-action'),'pause');
 assert.deepEqual(errors,[]);await ctx.close();await browser.close();server.close();console.log(JSON.stringify({status:'PASS',bodyPoseCombinations:27,pauseResume:true,screens:results},null,2));
})().catch(async e=>{console.error(e);await browser?.close();server?.close();process.exitCode=1;});
