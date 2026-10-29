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

 const kids={...seed,children:[{id:'a',name:'あいうえおかきくけこさし'},{id:'b',name:'たちつてとなにぬねのはひ'},{id:'c',name:'そら'}],selectedChildId:'a'};
 await page.evaluate(k=>localStorage.setItem('mochineko.v1',JSON.stringify(k)),kids);await page.reload();
 await page.locator('[data-child=b]').click();assert.equal(await page.locator('.child-option[aria-pressed=true]').count(),2);
 await page.locator('[data-child=c]').click();assert.equal(await page.locator('.child-option[aria-pressed=true]').count(),2);
 await page.reload();assert.equal(await page.locator('.child-option[aria-pressed=true]').count(),2);
 await page.locator('#start-button').click();assert.deepEqual(await page.evaluate(()=>JSON.parse(localStorage.getItem('mochineko.session')).childIds),['a','b']);
 await page.clock.runFor(8500);await page.evaluate(()=>{const s=JSON.parse(localStorage.getItem('mochineko.session'));s.messageCount=3;localStorage.setItem('mochineko.session',JSON.stringify(s));});await page.reload();await page.setViewportSize({width:320,height:568});await page.clock.fastForward(121000);await page.clock.runFor(500);
 const text=await page.locator('#bubble-text').innerText();assert.ok(text.includes(kids.children[0].name)&&text.includes(kids.children[1].name));await page.screenshot({path:path.join(out,'two-children-small.png'),animations:'disabled'});
 assert.deepEqual(errors,[]);await browser.close();server.close();console.log(JSON.stringify({status:'PASS',twoSelected:true,persisted:true,bothNames:text}));
})().catch(async e=>{console.error(e);await browser?.close();server?.close();process.exitCode=1;});