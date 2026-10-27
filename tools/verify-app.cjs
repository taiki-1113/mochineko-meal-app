// Meaningful browser checks for timing, persistence, content, layout and offline assets.
const {chromium} = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
let BASE = process.env.MOCHI_TEST_URL, server, runningBrowser;
const output = path.resolve(__dirname,'../output/verification');
fs.mkdirSync(output,{recursive:true});
const seed = {children:[{id:'test-child',name:'たろう'}],durations:{breakfast:10,lunch:10,dinner:10},soundEnabled:false,selectedChildId:'test-child'};
const saved = page => page.evaluate(()=>JSON.parse(localStorage.getItem('mochineko.session')));
const nextFrame = page => page.clock.fastForward(300);
const sleepCheck = ms => new Promise(r=>setTimeout(r,ms));

(async()=>{
  if(!BASE){
    const root=path.resolve(__dirname,'..');
    server=http.createServer((req,res)=>{
      const name=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
      const file=path.resolve(root,'.'+(name==='/'?'/index.html':name));
      if(!file.startsWith(root+path.sep)){res.writeHead(403);res.end();return;}
      const mime={'.js':'application/javascript','.css':'text/css','.html':'text/html','.json':'application/json','.png':'image/png','.svg':'image/svg+xml','.wav':'audio/wav','.webmanifest':'application/manifest+json'};
      fs.readFile(file,(err,content)=>{res.writeHead(err?404:200,{'Content-Type':mime[path.extname(file)]||'text/plain'});res.end(err?'missing':content);});
    });
    await new Promise(resolve=>server.listen(0,'127.0.0.1',resolve));
    BASE=`http://127.0.0.1:${server.address().port}/`;
  }
  const browser = await chromium.launch({headless:true,executablePath:process.env.MOCHI_CHROME || 'C:/Program Files/Google/Chrome/Application/chrome.exe'});
  runningBrowser=browser;
  const errors=[];
  const context=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));
  await page.clock.install({time:new Date('2026-10-27T03:00:00Z')});
  await page.clock.pauseAt(new Date('2026-10-27T03:00:01Z'));
  await page.goto(BASE);await page.locator('#home-cat image').waitFor();
  await page.locator('#start-button').click();
  assert.equal(await page.locator('#settings-modal').isVisible(),true,'unregistered start guides to settings');
  await page.locator('#sound-enabled').uncheck({force:true}); // Virtual-clock scenarios use silent mode; real audio is checked below.
  await page.locator('#child-name').fill('太郎');await page.locator('#child-submit').click();
  assert.match(await page.locator('#name-error').innerText(),/ひらがな/);
  await page.locator('#child-name').fill('たろう');await page.locator('#child-submit').click();
  assert.equal(await page.locator('#meal-screen').isVisible(),true,'registration completes pending start');
  assert.equal(await page.locator('#bubble-text').innerText(),'てを あわせて、いただきます');
  const initial=await saved(page);assert.equal(initial.phase,'opening');assert.equal(initial.duration,30);
  await page.clock.fastForward(7900);assert.equal((await saved(page)).phase,'opening');
  await page.clock.fastForward(200);assert.equal((await saved(page)).phase,'active');
  await page.locator('#meal-cat').click({force:true});assert.equal(await page.locator('#speech-bubble').isVisible(),false,'opening cooldown blocks taps');
  await page.clock.fastForward(3000);await page.locator('#meal-cat').click({force:true});
  const tap=await page.locator('#bubble-text').innerText();assert.match(tap,/よんだか|くすぐったい|じょうず/);
  await page.locator('#meal-cat').click({force:true});assert.equal(await page.locator('#bubble-text').innerText(),tap,'tap cannot interrupt a bubble');
  await page.clock.fastForward(8100);assert.equal(await page.locator('#speech-bubble').isVisible(),false);
  await page.clock.fastForward(2900);await page.locator('#meal-cat').click({force:true});assert.equal(await page.locator('#speech-bubble').isVisible(),true,'tap allowed after expiry plus 3 seconds');
  await page.clock.fastForward(8200);
  const lines=[];
  for(let i=1;i<=4;i++){
    const gap=await page.evaluate(()=>JSON.parse(localStorage.getItem('mochineko.session')).nextMessageAt-Date.now());
    await page.clock.fastForward(Math.max(1,gap)+500);
    const s=await saved(page);assert.equal(s.messageCount,i);
    const text=await page.locator('#bubble-text').innerText();lines.push(text);
    assert.equal(text.includes('たろう'),i===4,'only fourth normal message uses name');
    if(i===4){await page.clock.runFor(1000);assert.equal(await page.locator('#speech-bubble').isVisible(),true);await page.screenshot({path:path.join(output,'meal.png'),animations:'disabled'});}
    await page.clock.fastForward(8200);
  }
  assert.equal(new Set(lines).size,4);
  // Check all nine boundaries against actual visible asset, with no test-only app hooks.
  for(let stage=2;stage<=9;stage++){
    const s=await saved(page);const at=s.startedAt+s.duration*60000*(stage-1)/8;
    const gap=at-await page.evaluate(()=>Date.now());
    if(gap>0)await page.clock.fastForward(gap+400);
    if(gap>0)assert.match(await page.locator('#cat-visual image').last().getAttribute('href'),new RegExp(`stage-0${stage}\\.png$`));
  }
  const s=await saved(page);const sleepAt=s.startedAt+s.duration*60000+180000;
  await page.clock.fastForward(sleepAt-await page.evaluate(()=>Date.now())+500);
  assert.match(await page.locator('#meal-screen').getAttribute('class'),/sleeping/);
  assert.match(await page.locator('#cat-visual image').last().getAttribute('href'),/stage-10/);
  assert.equal(await page.locator('#speech-bubble').isVisible(),false);
  await page.clock.runFor(1000);
  await page.screenshot({path:path.join(output,'sleep.png'),animations:'disabled'});
  await page.locator('#meal-cat').click({force:true});assert.equal(await page.locator('#speech-bubble').isVisible(),false,'sleep tap only stirs');
  await page.locator('#finish-button').click();await page.locator('#confirm-continue').click();assert.ok(await saved(page),'continue preserves session');
  await page.locator('#finish-button').click();await page.locator('#confirm-finish').click();
  assert.equal(await page.locator('#bubble-text').innerText(),'てを あわせて、ごちそうさまでした');
  await page.clock.fastForward(7900);assert.ok(await saved(page));await page.clock.fastForward(300);
  assert.equal(await saved(page),null);assert.equal(await page.locator('#home-screen').isVisible(),true);
  assert.match(await page.locator('#home-cat image').getAttribute('href'),/stage-05/);
  await page.screenshot({path:path.join(output,'home.png'),animations:'disabled'});
  // Edit, retain ID, 3-child cap, delete and persistent audio switch.
  await page.locator('#children-settings').click();await page.locator('[data-edit]').first().click();await page.locator('#child-name').fill('はる');await page.locator('#child-submit').click();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mochineko.v1')).children[0].id),initial.childId);
  for(const name of ['あお','そら']){await page.locator('#child-name').fill(name);await page.locator('#child-submit').click();}
  assert.equal(await page.locator('#child-form').isVisible(),false);
  await page.locator('[data-remove]').last().click();assert.equal(await page.locator('#child-form').isVisible(),true);
  await page.locator('#sound-enabled').uncheck({force:true});await page.locator('#settings-done').click();await page.reload();
  assert.equal(await page.evaluate(()=>JSON.parse(localStorage.getItem('mochineko.v1')).soundEnabled),false);
  // Layout checks cover small iPhones, landscape and desktop, including a 12-char name.
  for(const viewport of [{width:320,height:568},{width:375,height:667},{width:844,height:390},{width:1280,height:900}]){
    await page.setViewportSize(viewport);
    assert.ok(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1),'no horizontal overflow');
    const box=await page.locator('#start-button').boundingBox();assert.ok(box.width>=44&&box.x>=0&&box.x+box.width<=viewport.width+1);
  }
  assert.deepEqual(errors,[]);
  await context.close();

  // Reload resumes sleep, then an ending in progress completes rather than restarting.
  const resumed=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  await resumed.addInitScript(({seed})=>{localStorage.setItem('mochineko.v1',JSON.stringify(seed));localStorage.setItem('mochineko.session',JSON.stringify({childId:'test-child',meal:'lunch',duration:10,startedAt:Date.now()-781000,phase:'active'}));},{seed});
  const p=await resumed.newPage();await p.goto(BASE);assert.match(await p.locator('#meal-screen').getAttribute('class'),/sleeping/);await resumed.close();

  const boundaries=await browser.newContext({viewport:{width:320,height:568},serviceWorkers:'block'});
  const longName={...seed,children:[{id:'test-child',name:'あいうえおかきくけこさし'}]};
  await boundaries.addInitScript(({seed})=>localStorage.setItem('mochineko.v1',JSON.stringify(seed)),{seed:longName});
  const bp=await boundaries.newPage();await bp.clock.install({time:new Date('2026-10-27T03:00:00Z')});await bp.clock.pauseAt(new Date('2026-10-27T03:00:01Z'));await bp.goto(BASE);await bp.locator('#start-button').click();
  const bs=await saved(bp);
  for(let stage=1;stage<=9;stage++){
    if(stage>1)await bp.clock.fastForward(bs.startedAt+600000*(stage-1)/8-await bp.evaluate(()=>Date.now())+400);
    await bp.clock.runFor(750);
    assert.match(await bp.locator('#cat-visual image').last().getAttribute('href'),new RegExp(`stage-0${stage}\\.png$`));
  }
  // Force the next normal message to be named through persisted production state.
  await bp.evaluate(()=>{const s=JSON.parse(localStorage.getItem('mochineko.session'));s.messageCount=3;localStorage.setItem('mochineko.session',JSON.stringify(s));});
  await bp.reload();await bp.clock.fastForward(121000);await bp.clock.runFor(500);
  const bubbleBox=await bp.locator('#speech-bubble').boundingBox(),catBox=await bp.locator('#meal-cat').boundingBox();
  await bp.screenshot({path:path.join(output,'small-screen.png'),animations:'disabled'});
  if(!bubbleBox||!catBox||bubbleBox.y+bubbleBox.height>catBox.y+6) console.log('Small-screen layout',JSON.stringify({bubbleBox,catBox,session:await saved(bp),text:await bp.locator('#bubble-text').innerText()}));
  assert.ok(bubbleBox&&catBox&&bubbleBox.y+bubbleBox.height<=catBox.y+6,'long name bubble leaves room for the character');
  await boundaries.close();

  // Real AudioContext timing is not controlled by Playwright's virtual clock.
  const audible=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  await audible.addInitScript(({seed})=>{
    localStorage.setItem('mochineko.v1',JSON.stringify({...seed,soundEnabled:true}));
    window.__audioActive=0;window.__audioPeak=0;window.__audioStarts=0;
    const create=AudioContext.prototype.createBufferSource;
    AudioContext.prototype.createBufferSource=function(){
      const node=create.call(this),start=node.start.bind(node),stop=node.stop.bind(node);let active=false;
      const ended=()=>{if(active){active=false;window.__audioActive--;}};
      node.start=(...args)=>{if(node.buffer?.length>1){active=true;window.__audioActive++;window.__audioStarts++;window.__audioPeak=Math.max(window.__audioPeak,window.__audioActive);}return start(...args);};
      node.stop=(...args)=>{ended();return stop(...args);};node.addEventListener('ended',ended);return node;
    };
  },{seed});
  const ap=await audible.newPage();await ap.goto(BASE);await ap.locator('#start-button').click();
  await ap.waitForFunction(()=>window.__audioStarts>0);
  await ap.locator('#finish-button').click();await ap.locator('#confirm-finish').click();
  const finishTime=Date.now();await sleepCheck(7500);assert.ok(await saved(ap),'ending stays visible before 8 seconds');
  await ap.locator('#home-screen').waitFor({state:'visible',timeout:5000});
  assert.ok(Date.now()-finishTime>=7900);assert.equal(await ap.evaluate(()=>window.__audioPeak),1,'real audio never overlaps');
  await audible.close();

  // Real SW cache is exercised in a new browser profile, including all bundled sounds.
  const offline=await browser.newContext({viewport:{width:390,height:844}});
  const off=await offline.newPage();await off.goto(BASE);
  await off.waitForFunction(()=>!!navigator.serviceWorker.controller,null,{timeout:60000});
  await sleepCheck(500);
  await offline.setOffline(true);await off.reload();
  await off.locator('#home-cat image').waitFor();
  const result=await off.evaluate(async()=>{
    const keys=await caches.keys();const cache=await caches.open('mochineko-shell-v8');const requests=await cache.keys();
    return {keys,audio:requests.filter(r=>r.url.endsWith('.wav')).length,images:requests.filter(r=>/stage-\d+\.png$/.test(r.url)).length,status:(await fetch('./assets/audio/happy-1.wav')).status,manifest:(await fetch('./assets/character/manifest.json')).status};
  });
  assert.equal(result.audio,13);assert.equal(result.images,10);assert.equal(result.status,200);assert.equal(result.manifest,200);
  await off.locator('#start-button').click();await off.locator('#child-name').fill('ゆい');await off.locator('#child-submit').click();assert.equal(await off.locator('#meal-screen').isVisible(),true,'offline start works');
  await offline.close();await browser.close();server?.close();
  console.log(JSON.stringify({status:'PASS',normalLines:lines,offline:result,screenshots:output},null,2));
})().catch(async e=>{console.error(e);await runningBrowser?.close();server?.close();process.exitCode=1;});
