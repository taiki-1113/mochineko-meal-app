const CACHE_NAME = 'mochineko-shell-v13';
const STAGES = Array.from({length:10}, (_,i) => `./assets/character/stage-${String(i+1).padStart(2,'0')}.png`);
const MEOWS = ['happy','relaxed','affectionate','surprised'].flatMap(group => [1,2,3].map(n => `./assets/audio/${group}-${n}.wav`));
const APP_SHELL = ['./index.html?v=13','./styles.css?v=13','./app.js?v=13','./messages.js?v=13','./audio.js?v=13','./manifest.webmanifest','./icons/icon.svg','./assets/background/room.png','./assets/background/home-sky.png','./assets/background/dining-room.png','./assets/dining/early.png','./assets/dining/middle.png','./assets/dining/late.png','./assets/dining/plates.png','./assets/dining/manifest.json','./assets/character/manifest.json','./assets/fonts/ZenMaruGothic-Bold.ttf','./assets/fonts/OFL-ZenMaruGothic.txt',...STAGES,...MEOWS,'./assets/audio/sleep.wav'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache=>cache.addAll(APP_SHELL.map(url=>new Request(url,{cache:'reload'})))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(key=>key.startsWith('mochineko-shell-')&&key!==CACHE_NAME).map(key=>caches.delete(key)))).then(()=>self.clients.claim()));
});
self.addEventListener('fetch', event => {
  if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;
  // Serve a complete version from its own cache so old JS cannot mix with new CSS.
  event.respondWith(caches.open(CACHE_NAME).then(async cache=>{
    const cached=await cache.match(event.request.mode==='navigate'?'./index.html?v=13':event.request);
    return cached||fetch(event.request);
  }));
});
