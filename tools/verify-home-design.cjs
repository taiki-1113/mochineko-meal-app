const {chromium}=require('playwright');
const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const root=path.resolve(__dirname,'..'),out=path.join(root,'output','verification');
let browser,server;
(async()=>{
  fs.mkdirSync(out,{recursive:true});
  server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost');const file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}fs.readFile(file,(err,body)=>{res.writeHead(err?404:200,{'Content-Type':({'.js':'application/javascript','.css':'text/css','.html':'text/html','.png':'image/png','.json':'application/json','.svg':'image/svg+xml'})[path.extname(file)]||'application/octet-stream'});res.end(err?'missing':body);});});
  await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
  const base=`http://127.0.0.1:${server.address().port}/`;
  browser=await chromium.launch({headless:true,executablePath:process.env.MOCHI_CHROME||'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  const context=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Tokyo',serviceWorkers:'block'});
  await context.addInitScript(()=>localStorage.setItem('mochineko.v1',JSON.stringify({children:[{id:'preview',name:'たろう'}],durations:{breakfast:30,lunch:30,dinner:30},soundEnabled:false,selectedChildId:'preview'})));
  const page=await context.newPage(),errors=[];page.on('pageerror',e=>errors.push(e.message));await page.clock.setFixedTime(new Date('2026-10-27T03:00:00Z'));
  await page.goto(base);await page.waitForFunction(()=>!!document.querySelector('#home-cat image')?.getAttribute('href'));
  await page.waitForTimeout(250);
  const measure=()=>page.evaluate(()=>({controls:document.querySelector('.home-controls').getBoundingClientRect().height,hero:document.querySelector('.home-hero').getBoundingClientRect().height,cat:document.querySelector('.home-cat').getBoundingClientRect().height}));
  const size=await measure();
  if(process.argv.includes('--before')){fs.writeFileSync(path.join(out,'home-layout-before.json'),JSON.stringify(size));console.log(JSON.stringify({before:size}));}
  else {
    const before=JSON.parse(fs.readFileSync(path.join(out,'home-layout-before.json'),'utf8'));
    const ratio=size.controls/before.controls;
    assert.ok(ratio>=.70&&ratio<=.79,`controls should be around 3/4 height: ${ratio}`);
    assert.ok(size.hero>before.hero&&size.cat>before.cat,'more space for the cat');
    assert.equal(await page.locator('.child-card label>span').first().innerText(),'子どもの選択');
    assert.equal((await page.locator('#children-settings').innerText()).trim(),'子どもの設定');
    assert.match(await page.locator('.child-icon use').getAttribute('href'),/icon-child/);
    assert.match(await page.locator('#home-screen').evaluate(el=>getComputedStyle(el,'::before').backgroundImage),/home-sky/);
    for(const viewport of [{width:390,height:844},{width:375,height:667},{width:320,height:568},{width:844,height:390},{width:1280,height:900}]){
      await page.setViewportSize(viewport);
      const b=await page.locator('#start-button').boundingBox(),t=await page.locator('#start-label').boundingBox();
      assert.ok(Math.abs(t.x+t.width/2-b.x-b.width/2)<1,'start text is geometrically centered');
      assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow');
      assert.ok(b.height>=44,'start tap area preserved');
      assert.ok(await page.locator('.meal-option').first().evaluate(el=>el.getBoundingClientRect().height>=44),'meal tap areas preserved');
      if(viewport.width===390)await page.screenshot({path:path.join(out,'home-refined.png'),animations:'disabled'});
      if(viewport.width===320)await page.screenshot({path:path.join(out,'home-refined-small.png'),animations:'disabled',fullPage:true});
    }
    await page.setViewportSize({width:390,height:844});await page.locator('#children-settings').click();
    assert.equal(await page.locator('#child-section h3').innerText(),'子どもの設定');
    await page.screenshot({path:path.join(out,'settings-refined.png'),animations:'disabled'});
    await page.locator('#settings-done').click();await page.locator('#start-button').click();
    assert.equal(await page.locator('#meal-screen').isVisible(),true);
    assert.equal(await page.locator('#bubble-text').innerText(),'てを あわせて、いただきます','child-facing copy stays hiragana');
    assert.deepEqual(errors,[]);
    const offline=await browser.newContext({viewport:{width:390,height:844}}),off=await offline.newPage();
    await off.goto(base);await off.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:60000});await off.waitForTimeout(300);
    await offline.setOffline(true);await off.reload();
    const cached=await off.evaluate(async()=>({keys:await caches.keys(),sky:(await fetch('./assets/background/home-sky.png')).status}));
    assert.ok(cached.keys.includes('mochineko-shell-v12'));assert.equal(cached.sky,200);await offline.close();
    console.log(JSON.stringify({status:'PASS',before,after:size,controlsRatio:ratio,offline:cached,screenshots:out},null,2));
  }
  await browser.close();server.close();
})().catch(async e=>{console.error(e);await browser?.close();server?.close();process.exitCode=1;});
