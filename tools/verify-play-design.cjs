const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output','verification');let server,browser;
(async()=>{
 server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}fs.readFile(file,(e,b)=>{res.writeHead(e?404:200,{'Content-Type':({'.js':'application/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.json':'application/json','.ttf':'font/ttf'})[path.extname(file)]||'application/octet-stream'});res.end(e?'missing':b);});});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base=`http://127.0.0.1:${server.address().port}/`;
 browser=await chromium.launch({headless:true,executablePath:process.env.MOCHI_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
 const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Tokyo',serviceWorkers:'block'});
 await context.addInitScript(()=>{if(!localStorage.getItem('mochineko.v1'))localStorage.setItem('mochineko.v1',JSON.stringify({children:[{id:'preview',name:'たろう'}],durations:{breakfast:30,lunch:30,dinner:30},soundEnabled:false,selectedChildId:'preview'}));});
 const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));
 await page.clock.install({time:new Date('2026-10-27T03:00:00Z')});await page.clock.pauseAt(new Date('2026-10-27T03:00:01Z'));
 await page.goto(base);
 const results=[];
 for(const test of [{w:390,h:844,elapsed:900,file:'play-refined.png'},{w:320,h:568,elapsed:0,file:'play-refined-small.png'},{w:390,h:844,elapsed:1800,file:'play-refined-large-cat.png'},{w:844,h:390,elapsed:900,file:'play-refined-landscape.png'},{w:320,h:568,elapsed:900,name:'あいうえおかきくけこさし',file:'play-refined-longname.png'}]){
  await page.setViewportSize({width:test.w,height:test.h});
  await page.evaluate(elapsed=>localStorage.setItem('mochineko.session',JSON.stringify({version:2,childId:'preview',meal:'lunch',duration:30,startedAt:Date.now()-elapsed*1000,phase:'active',messageCount:3})),test.elapsed);
  await page.reload();await page.locator('#cat-visual image').last().waitFor();
  if(test.name)await page.evaluate(name=>{const d=JSON.parse(localStorage.getItem('mochineko.v1'));d.children[0].name=name;localStorage.setItem('mochineko.v1',JSON.stringify(d));},test.name);
  if(test.name)await page.reload();
  await page.evaluate(()=>document.fonts.ready);await page.clock.fastForward(121000);await page.clock.runFor(900);
  assert.equal(await page.locator('#speech-bubble').isVisible(),true);
  const layout=await page.evaluate(()=>{
   const tail=document.querySelector('#bubble-tail'),bubble=document.querySelector('#speech-bubble').getBoundingClientRect(),text=document.querySelector('#bubble-text').getBoundingClientRect(),icon=document.querySelector('#finish-button .cat-face').getBoundingClientRect(),labelNode=document.querySelector('#finish-button .finish-label'),label=labelNode.getBoundingClientRect(),arrow=document.querySelector('#finish-button .finish-chevron').getBoundingClientRect();
   const range=document.createRange();range.selectNodeContents(labelNode);const ink=range.getBoundingClientRect();
   return {root:tail.dataset.root?.split(',').map(Number),tip:tail.dataset.tip?.split(',').map(Number),font:getComputedStyle(document.querySelector('#bubble-text')).fontFamily,loaded:[...document.fonts].some(f=>f.family==='Mochi Maru'&&f.status==='loaded'),bubble:{x:bubble.x,y:bubble.y,w:bubble.width,h:bubble.height},text:{x:text.x,y:text.y,w:text.width,h:text.height},buttonOverlap:icon.right>label.left||ink.right>arrow.left,overflow:document.documentElement.scrollWidth>innerWidth+1};
  });
  assert.ok(layout.root&&layout.tip,'tail geometry calculated after font/image layout');
  if(test.w<test.h)assert.ok(layout.tip[1]>layout.root[1],'portrait tail points down toward cat');
  else assert.ok(layout.tip[0]<layout.root[0],'landscape tail points left toward cat');
  assert.equal(layout.loaded,true);assert.match(layout.font,/Mochi Maru/);assert.equal(layout.buttonOverlap,false);assert.equal(layout.overflow,false);
  assert.ok(layout.text.y>=layout.bubble.y&&layout.text.y+layout.text.h<=layout.bubble.y+layout.bubble.h,'copy stays inside bubble');
  await page.screenshot({path:path.join(out,test.file),animations:'disabled'});results.push({screen:test.file,...layout});
 }
 assert.deepEqual(errors,[]);
 await context.close();
 const offContext=await browser.newContext(),off=await offContext.newPage();await off.goto(base);await off.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:60000});await off.waitForTimeout(300);await offContext.setOffline(true);await off.reload();
 assert.equal(await off.evaluate(async()=>(await fetch('./assets/fonts/ZenMaruGothic-Bold.ttf')).status),200,'rounded font available offline');
 await offContext.close();await browser.close();server.close();console.log(JSON.stringify({status:'PASS',screens:results,offlineFont:true},null,2));
})().catch(async e=>{console.error(e);await browser?.close();server?.close();process.exitCode=1;});
