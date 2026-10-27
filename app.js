(() => {
  'use strict';
  const STORAGE_KEY = 'mochineko.v1', SESSION_KEY = 'mochineko.session';
  const BUBBLE_MS = 8000, COOLDOWN_MS = 3000;
  const meals = {
    breakfast: { label: 'あさごはん', settingsLabel: '朝食', icon: '☀', theme: 'day-breakfast' },
    lunch: { label: 'ひるごはん', settingsLabel: '昼食', icon: '☀', theme: 'day-lunch' },
    dinner: { label: 'よるごはん', settingsLabel: '夕食', icon: '☾', theme: 'day-dinner' }
  };
  const $ = id => document.getElementById(id);
  const audio = window.MochiAudio, messages = window.MochiMessages;
  const validName = name => /^[ぁ-ゖー]{1,12}$/u.test(name);
  const duration = n => Math.max(10, Math.min(60, Math.round((Number(n) || 30) / 5) * 5));
  const defaults = () => ({ children: [], durations: { breakfast:30,lunch:30,dinner:30 }, soundEnabled:true, selectedChildId:null });
  let storageFailed = false;
  function load() {
    const base = defaults();
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!value || typeof value !== 'object') return base;
      // Keep old nicknames for explicit editing rather than silently deleting them.
      return { ...base, children: Array.isArray(value.children) ? value.children.filter(c => c && typeof c.id === 'string' && typeof c.name === 'string').slice(0,3) : [],
        durations: Object.fromEntries(Object.keys(meals).map(k => [k, duration(value.durations?.[k])])), soundEnabled:value.soundEnabled !== false, selectedChildId:value.selectedChildId || null };
    } catch { storageFailed = true; return base; }
  }
  let data = load(), selectedMeal = detectMeal();
  let selectedChildId = data.children.some(c => c.id === data.selectedChildId) ? data.selectedChildId : data.children[0]?.id || null;
  let session = null, cue = null, cueSerial = 0, cooldownUntil = 0, editingId = null;
  let pendingStart = false, tickTimer, cueTimer, toastTimer, wakeLock, previousFocus;
  let assets = {}, lastStage = -1, lastMilestone = 0, sleeping = false;
  let lastElapsed = 0, lastMono = 0, offlineReady = false;
  let bubbleLayoutFrame = 0;
  let diningAssets = null, diningPose = 2, diningStage = -1, diningClock = 0, lastDiningAt = 0, growthHintUntil = 0, artSerial = 0;
  const uid = () => globalThis.crypto?.randomUUID?.() || `child-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  const escapeHtml = s => String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  function detectMeal() { const h = new Date().getHours(); return h >= 5 && h < 11 ? 'breakfast' : h >= 11 && h < 17 ? 'lunch' : 'dinner'; }
  function write(key, value) {
    try { value === null ? localStorage.removeItem(key) : localStorage.setItem(key, JSON.stringify(value)); return true; }
    catch { if (!storageFailed) showToast('このたんまつに ほぞんできません'); storageFailed = true; return false; }
  }
  function persist() { data.selectedChildId = selectedChildId; write(STORAGE_KEY, data); }
  function saveSession() { if (session) write(SESSION_KEY, session); }
  function showToast(text) { $('toast').textContent = text; $('toast').classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => $('toast').classList.remove('show'), 3000); }
  function art(stage, pose = null) {
    const dining = pose !== null && diningAssets?.stages[String(stage)];
    if (dining) {
      const [x,y,w,h] = dining.frames[pose].box;
      const clip=`dining-clip-${++artSerial}`;
      return `<svg class="character-svg dining-sheet" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMax meet" aria-hidden="true"><defs><clipPath id="${clip}"><rect width="${w}" height="${h}"/></clipPath></defs><g clip-path="url(#${clip})"><image href="${dining.file}" x="${-x}" y="${-y}" width="${dining.width}" height="${dining.height}"/></g></svg>`;
    }
    const key = String(stage).padStart(2,'0'), a = assets[key];
    const path = `./assets/character/stage-${key}.png`;
    if (!a) return `<svg class="character-svg" viewBox="0 0 1254 1254" preserveAspectRatio="xMidYMax meet" aria-hidden="true"><image href="${path}" width="1254" height="1254"/></svg>`;
    return `<svg class="character-svg" viewBox="${a.box.join(' ')}" preserveAspectRatio="xMidYMax meet" aria-hidden="true"><image href="${path}" x="0" y="0" width="${a.width}" height="${a.height}"/></svg>`;
  }
  function queueBubbleLayout() {
    if (bubbleLayoutFrame) return;
    bubbleLayoutFrame = requestAnimationFrame(() => { bubbleLayoutFrame = 0; layoutBubble(); });
  }
  function layoutBubble() {
    const bubble = $('speech-bubble'), svg = $('cat-visual').lastElementChild?.querySelector('svg');
    if (!cue || bubble.classList.contains('hidden') || !svg || !svg.getScreenCTM()) return;
    const rect = bubble.getBoundingClientRect(), a = assets[String(lastStage).padStart(2,'0')];
    if (!a || !rect.width || !rect.height) return;
    // Face positions are expressed in each original image's coordinates.
    const faceFractions = [[.512,.303],[.53,.34],[.54,.36],[.53,.39],[.54,.40],[.54,.40],[.54,.40],[.54,.40],[.54,.41],[.34,.56]];
    const [fx,fy] = faceFractions[lastStage-1] || [.53,.38];
    const box = svg.viewBox.baseVal;
    const face = svg.classList.contains('dining-sheet')
      ? new DOMPoint(box.width*.51,box.height*.43).matrixTransform(svg.getScreenCTM())
      : new DOMPoint(a.width*fx,a.height*fy).matrixTransform(svg.getScreenCTM());
    const x = face.x-rect.left, y = face.y-rect.top, w = rect.width, h = rect.height;
    const clamp = (n,min,max) => Math.max(min,Math.min(max,n));
    const bottom = y >= h+8;
    const rootX = bottom ? clamp(x+38,w*.3,w*.72) : 12;
    const rootY = bottom ? h-12 : clamp(y+18,h*.3,h*.72);
    const dx = x-rootX, dy = y-rootY, distance = Math.hypot(dx,dy) || 1;
    const length = Math.min(52,distance*.4);
    const tipX = rootX+dx/distance*length, tipY = rootY+dy/distance*length;
    const tail = $('bubble-tail'); tail.setAttribute('viewBox',`0 0 ${w} ${h}`);
    const d = bottom
      ? `M ${rootX-15} ${rootY} Q ${rootX-9} ${rootY+12} ${tipX} ${tipY} Q ${rootX+20} ${rootY+22} ${rootX+15} ${rootY} Z`
      : `M ${rootX} ${rootY-15} Q ${rootX-10} ${rootY-8} ${tipX} ${tipY} Q ${rootX-12} ${rootY+20} ${rootX} ${rootY+15} Z`;
    tail.querySelector('path').setAttribute('d',d);
    tail.dataset.root = `${rootX},${rootY}`; tail.dataset.tip = `${tipX},${tipY}`; tail.dataset.target = `${x},${y}`;
  }
  function setStage(stage, animate = true, pose = diningPose) {
    const poseKey = stage === 10 ? 2 : pose;
    if (stage === lastStage && poseKey === diningPose && diningStage === stage) return;
    const changedBody = stage !== lastStage;
    const visual = $('cat-visual');
    const old = [...visual.children];
    const layer = document.createElement('span'); layer.className = `stage-layer${changedBody?' body-transition':''}`; layer.innerHTML = art(stage,poseKey); visual.append(layer);
    for (const el of old) { el.classList.add('leaving'); setTimeout(() => el.remove(), animate ? (changedBody ? 650 : 180) : 0); }
    lastStage = stage; diningStage = stage; diningPose = poseKey;
    $('meal-screen').dataset.stage = String(stage);
    $('meal-screen').dataset.pose = ['bite','chew','rest'][poseKey];
    queueBubbleLayout();
    $('meal-cat').setAttribute('aria-label', stage === 10 ? 'ねている もちねこを なでる' : 'もちねこを なでる');
  }
  function updateDining(secs, paused) {
    const now = performance.now();
    const satisfied = secs >= session.duration*60;
    if (!paused && !satisfied) diningClock += Math.max(0,now-lastDiningAt)/1000;
    lastDiningAt = now;
    const cycle = diningClock % 23, bite = cycle % 5;
    const action = sleeping ? 'sleep' : paused ? 'pause' : satisfied ? 'satisfied' : cycle >= 15 ? 'rest' : bite < 1.4 ? 'bite' : bite < 4.3 ? 'chew' : 'swallow';
    const pose = action === 'bite' ? 0 : action === 'chew' ? 1 : 2;
    setStage(lastStage,false,pose);
    const screen=$('meal-screen'); screen.dataset.action=action;
    const progress=Math.min(1,secs/(session.duration*60));
    const food=progress<.38?0:progress<.8?1:2;
    if(diningAssets && $('meal-plate').dataset.food!==String(food)){
      const [x,y,w,h]=diningAssets.plates[food], [sw,sh]=diningAssets.plateSize;
      $('meal-plate').innerHTML=`<svg viewBox="0 0 ${w} ${h}" aria-hidden="true"><defs><clipPath id="plate-clip"><rect width="${w}" height="${h}"/></clipPath></defs><g clip-path="url(#plate-clip)"><image href="./assets/dining/plates.png" x="${-x}" y="${-y}" width="${sw}" height="${sh}"/></g></svg>`;
      $('meal-plate').dataset.food=String(food);
    }
    $('meal-action-label').textContent = sleeping ? 'おなか いっぱい。すやすや…' : cue ? '' : Date.now()<growthHintUntil ? 'たべて おなかが まあるくなったにゃ' : ({bite:'いっしょに ひとくちにゃ',chew:'もぐもぐ、よく かんで',swallow:'ごっくん。おいしいにゃ',rest:'のんびり ひとやすみにゃ',satisfied:'おなか まんぞくにゃ',pause:''}[action]);
    if(!paused) session.diningClock=diningClock;
  }
  function renderHome() {
    $('home-cat').innerHTML = art(5);
    const select = $('child-picker'); select.replaceChildren();
    if (!data.children.length) select.add(new Option('ニックネームを登録', ''));
    else for (const child of data.children) select.add(new Option(child.name, child.id));
    select.value = selectedChildId || '';
    for (const b of document.querySelectorAll('.meal-option')) { const active = b.dataset.meal === selectedMeal; b.classList.toggle('active',active); b.setAttribute('aria-pressed', String(active)); }
    $('home-screen').classList.remove(...Object.values(meals).map(m => m.theme));
    $('home-screen').classList.add(meals[selectedMeal].theme);
    $('start-hint').textContent = data.children.length ? '' : 'はじめに子どもの名前を登録してください';
  }
  function cancelEdit() { editingId = null; $('child-name').value = ''; $('name-error').textContent = ''; $('child-submit').textContent = '追加'; $('child-cancel').classList.add('hidden'); }
  function renderSettings() {
    $('settings-children').innerHTML = data.children.length ? data.children.map(c => `<div class="setting-child-row"><span class="setting-child-name">${escapeHtml(c.name)}${validName(c.name)?'':' <small>（ひらがなに変更してください）</small>'}</span><button class="text-button" data-edit="${escapeHtml(c.id)}">変更</button><button class="text-button danger" data-remove="${escapeHtml(c.id)}" aria-label="${escapeHtml(c.name)}を削除">削除</button></div>`).join('') : '<p class="field-note">まだ登録されていません</p>';
    $('child-form').classList.toggle('hidden', data.children.length >= 3 && !editingId);
    $('duration-list').innerHTML = Object.entries(meals).map(([key,m]) => `<div class="duration-row"><span>${m.icon} ${m.settingsLabel}</span><div class="duration-control"><button data-duration="${key}" data-delta="-5" aria-label="${m.settingsLabel}を5分短く" ${data.durations[key] <= 10?'disabled':''}>−</button><strong>${data.durations[key]}分</strong><button data-duration="${key}" data-delta="5" aria-label="${m.settingsLabel}を5分長く" ${data.durations[key] >= 60?'disabled':''}>＋</button></div></div>`).join('');
    $('sound-enabled').checked = data.soundEnabled;
  }
  function showModal(id) {
    previousFocus = document.activeElement; $(id).classList.remove('hidden'); $('app').inert = true;
    $(id).querySelector('[role=dialog]').focus({preventScroll:true});
  }
  function hideModal(id) { $(id).classList.add('hidden'); $('app').inert = false; if (previousFocus?.isConnected) previousFocus.focus({preventScroll:true}); }
  function openSettings(target = 'child-section') {
    if (session) return;
    cancelEdit(); renderSettings(); showModal('settings-modal');
    $(target).scrollIntoView({block:'nearest'});
    if (target === 'child-section') $('child-name').focus({preventScroll:true});
  }
  function closeSettings() { pendingStart = false; cancelEdit(); hideModal('settings-modal'); renderHome(); }
  function requestWakeLock() {
    if (!navigator.wakeLock || document.hidden || !session || wakeLock) return;
    navigator.wakeLock.request('screen').then(lock => { if (!session || document.hidden) { lock.release().catch(()=>{}); return; } wakeLock = lock; lock.addEventListener('release',()=>{ if (wakeLock === lock) wakeLock = null; }); }).catch(()=>{});
  }
  function releaseWakeLock() { const lock = wakeLock; wakeLock = null; lock?.release().catch(()=>{}); }
  function elapsed() {
    if (!session) return 0;
    const mono = performance.now();
    const wall = Math.max(0, (Date.now() - session.startedAt) / 1000);
    lastElapsed = Math.max(wall, lastElapsed + Math.max(0, mono - lastMono) / 1000);
    lastMono = mono; return lastElapsed;
  }
  function clearCue() {
    cueSerial++; clearTimeout(cueTimer); cue = null; audio.stop();
    $('speech-bubble').classList.add('hidden'); $('meal-screen').classList.remove('meowing','saluting');
  }
  function finishCue(token) {
    if (!cue || token !== cue.token || !cue.audioDone || Date.now() < cue.endsAt) return;
    const kind = cue.kind;
    $('speech-bubble').classList.add('hidden'); $('meal-screen').classList.remove('meowing','saluting');
    cooldownUntil = Math.max(cooldownUntil, cue.endsAt + COOLDOWN_MS);
    cue = null;
    if (!session) return;
    if (kind === 'ending') { goHome(); return; }
    if (kind === 'opening') { session.phase = 'active'; saveSession(); }
    tick();
  }
  function beginCue(text, group, kind, remaining = BUBBLE_MS, play = true) {
    clearCue();
    const token = ++cueSerial;
    cue = { text, kind, token, endsAt:Date.now()+remaining, audioDone:!play };
    $('bubble-text').textContent = text;
    $('speech-bubble').classList.remove('hidden');
    queueBubbleLayout();
    $('meal-screen').classList.remove('eating');
    updateDining(elapsed(),true);
    if (play) {
      $('meal-screen').classList.add('meowing');
      audio.play(group).finally(() => {
        if (!cue || cue.token !== token) return;
        cue.audioDone = true; $('meal-screen').classList.remove('meowing'); finishCue(token);
      });
    }
    cueTimer = setTimeout(() => finishCue(token), remaining);
  }
  function scheduleMessage() { session.nextMessageAt = Date.now() + 60000 + Math.floor(Math.random()*60001); saveSession(); }
  function tick() {
    if (!session) return;
    const secs = elapsed(), target = session.duration * 60;
    const shouldSleep = secs >= target + 180 && session.phase !== 'ending';
    if (shouldSleep !== sleeping) {
      sleeping = shouldSleep;
      if (sleeping) { clearCue(); session.phase = 'active'; saveSession(); if (!document.hidden) audio.play('relaxed',{sleep:true}); }
      else audio.stop();
    }
    const stage = sleeping ? 10 : Math.min(9,1+Math.floor(Math.min(secs/target,1)*8));
    setStage(stage);
    const milestone = Math.min(4,Math.floor(secs/target*4));
    if (!sleeping && lastMilestone >= 0 && milestone > lastMilestone) { animate('growth-pop',750); growthHintUntil=Date.now()+8000; }
    lastMilestone = milestone;
    const screen = $('meal-screen'); screen.classList.toggle('sleeping',sleeping);
    $('sleep-mark').classList.toggle('hidden',!sleeping);
    const eating = !sleeping && !cue && session.phase === 'active' && Math.floor(secs % 23) < 15;
    screen.classList.toggle('eating',eating);
    updateDining(secs, sleeping || !!cue || session.phase !== 'active' || document.hidden || !$('confirm-modal').classList.contains('hidden'));
    if (cue) finishCue(cue.token);
    if (!session || session.phase !== 'active' || sleeping || cue || document.hidden || !$('confirm-modal').classList.contains('hidden')) return;
    if (Date.now() >= session.nextMessageAt) {
      const child = data.children.find(c=>c.id===session.childId);
      const message = messages.next(session, child?.name || '');
      scheduleMessage(); beginCue(message.text,message.group,'normal');
    }
  }
  function animate(className,ms) { const cat=$('meal-cat'); cat.classList.remove(className); void cat.offsetWidth; cat.classList.add(className); setTimeout(()=>cat.classList.remove(className),ms); }
  function setupMeal() {
    $('home-screen').classList.add('hidden'); $('meal-screen').className = `screen meal-screen ${meals[session.meal].theme}`;
    $('meal-label').textContent = meals[session.meal].label; $('meal-icon').textContent = meals[session.meal].icon;
    $('finish-button').disabled = false; lastStage = -1; sleeping = false; lastMilestone = -1;
    diningStage=-1; diningPose=2; diningClock=Number.isFinite(session.diningClock)?session.diningClock:0; lastDiningAt=performance.now(); growthHintUntil=0;
    $('cat-visual').replaceChildren(); lastElapsed = Math.max(0,(Date.now()-session.startedAt)/1000); lastMono = performance.now();
    clearInterval(tickTimer); tickTimer = setInterval(tick,250); tick(); requestWakeLock();
  }
  function openMeal() {
    if (session) return;
    const child = data.children.find(c=>c.id===selectedChildId);
    if (!child || !validName(child.name)) { openSettings(); pendingStart=true; showToast('ひらがなの名前を登録してください'); return; }
    audio.unlock(); audio.setEnabled(data.soundEnabled);
    session = { version:2, childId:child.id, meal:selectedMeal, duration:data.durations[selectedMeal], startedAt:Date.now(), phase:'opening', messageCount:0 };
    scheduleMessage(); setupMeal(); saveSession();
    beginCue('てを あわせて、いただきます','happy','opening');
  }
  function playTap() {
    if (!session || session.phase !== 'active' || document.hidden || !$('confirm-modal').classList.contains('hidden') || cue || Date.now()<cooldownUntil) return;
    audio.unlock();
    if (sleeping) { animate('stirring',1000); cooldownUntil = Date.now()+COOLDOWN_MS; audio.play('relaxed',{sleep:true}); return; }
    animate('reacting',700);
    const i=Math.floor(Math.random()*messages.tap.length), [text,group]=messages.tap[i];
    beginCue(text,group,'tap');
  }
  function askFinish() {
    if (!session || session.phase === 'ending') return;
    showModal('confirm-modal');
    updateDining(elapsed(),true);
  }
  function continueMeal() { hideModal('confirm-modal'); tick(); }
  function finishMeal() {
    if (!session || session.phase === 'ending') return;
    audio.unlock(); hideModal('confirm-modal'); clearCue();
    session.phase='ending'; session.finishAt=Date.now()+BUBBLE_MS; saveSession();
    $('finish-button').disabled=true;
    $('meal-screen').classList.remove('sleeping','eating'); $('sleep-mark').classList.add('hidden');
    if (sleeping) { sleeping=false; setStage(9); }
    beginCue('てを あわせて、ごちそうさまでした','happy','ending');
  }
  function goHome() {
    clearCue(); clearInterval(tickTimer); releaseWakeLock(); session=null; sleeping=false; lastStage=-1;
    write(SESSION_KEY,null); $('meal-screen').classList.add('hidden'); $('home-screen').classList.remove('hidden');
    renderHome(); $('start-button').focus({preventScroll:true});
  }
  function restoreSession() {
    try {
      const saved=JSON.parse(localStorage.getItem(SESSION_KEY)||'null');
      const child=data.children.find(c=>c.id===saved?.childId);
      if (!saved || !Number.isFinite(saved.startedAt) || saved.startedAt<=0 || !meals[saved.meal] || !child || !validName(child.name)) { if(saved) write(SESSION_KEY,null); return; }
      session={...saved,duration:duration(saved.duration),phase:['opening','active','ending'].includes(saved.phase)?saved.phase:'active'};
      session.nextMessageAt = Date.now()+60000+Math.floor(Math.random()*60001);
      selectedChildId=saved.childId; selectedMeal=saved.meal; setupMeal();
      if (session.phase==='ending') {
        const remaining=Math.max(0,(session.finishAt||Date.now())-Date.now());
        if (!remaining) { goHome(); return; }
        $('finish-button').disabled=true; beginCue('てを あわせて、ごちそうさまでした','happy','ending',remaining,false);
      } else if (session.phase==='opening' && Date.now()<session.startedAt+BUBBLE_MS) {
        beginCue('てを あわせて、いただきます','happy','opening',session.startedAt+BUBBLE_MS-Date.now(),false);
      } else { session.phase='active'; saveSession(); }
      showToast('ごはんの つづきに もどったよ');
    } catch { session=null; }
  }
  function recover() {
    if (!session) return;
    requestWakeLock();
    if (document.hidden) return;
    lastDiningAt=performance.now();
    // Missed messages are discarded; restoring never bursts queued meows.
    if (session.nextMessageAt<Date.now()) scheduleMessage();
    tick(); if (sleeping && audio.ready && data.soundEnabled) audio.play('relaxed',{sleep:true});
  }
  $('child-picker').addEventListener('change',e=>{ selectedChildId=e.target.value;persist(); });
  document.querySelectorAll('.meal-option').forEach(b=>b.addEventListener('click',()=>{selectedMeal=b.dataset.meal;renderHome();}));
  $('children-settings').addEventListener('click',()=>openSettings());
  $('time-settings').addEventListener('click',()=>openSettings('duration-section'));
  $('settings-close').addEventListener('click',closeSettings); $('settings-done').addEventListener('click',closeSettings);
  $('settings-modal').addEventListener('click',e=>{if(e.target===$('settings-modal'))closeSettings();});
  $('settings-children').addEventListener('click',e=>{
    const edit=e.target.closest('[data-edit]'), remove=e.target.closest('[data-remove]');
    if(edit){const child=data.children.find(c=>c.id===edit.dataset.edit);if(!child)return;editingId=child.id;renderSettings();$('child-name').value=child.name;$('child-submit').textContent='保存';$('child-cancel').classList.remove('hidden');$('child-name').focus();}
    if(remove){data.children=data.children.filter(c=>c.id!==remove.dataset.remove);if(selectedChildId===remove.dataset.remove)selectedChildId=data.children[0]?.id||null;cancelEdit();persist();renderSettings();renderHome();}
  });
  $('child-cancel').addEventListener('click',()=>{cancelEdit();renderSettings();});
  $('child-form').addEventListener('submit',e=>{
    e.preventDefault(); const name=$('child-name').value.normalize('NFC').trim();
    if(!validName(name)){ $('name-error').textContent='ひらがなで1〜12文字入力してください';$('child-name').focus();return; }
    if(editingId){const child=data.children.find(c=>c.id===editingId);if(child)child.name=name;}
    else {if(data.children.length>=3)return;const child={id:uid(),name};data.children.push(child);selectedChildId=child.id;}
    cancelEdit();persist();renderSettings();renderHome();
    if(pendingStart){pendingStart=false;hideModal('settings-modal');openMeal();}else $('child-name').focus();
  });
  $('duration-list').addEventListener('click',e=>{const b=e.target.closest('[data-duration]');if(!b)return;data.durations[b.dataset.duration]=duration(data.durations[b.dataset.duration]+Number(b.dataset.delta));persist();renderSettings();});
  $('sound-enabled').addEventListener('change',e=>{data.soundEnabled=e.target.checked;audio.setEnabled(data.soundEnabled);if(data.soundEnabled)audio.unlock();persist();});
  let previewIndex = 0;
  $('sound-preview').addEventListener('click',()=>{if(!data.soundEnabled){showToast('音をオンにすると試せます');return;}const groups=[['happy','ごきげん'],['relaxed','のんびり'],['affectionate','あまえる'],['surprised','びっくり']];const [group,label]=groups[previewIndex++%4];audio.unlock();audio.play(group);showToast(label+'の なきごえ');});
  $('reset-button').addEventListener('click',()=>{if(!confirm('この端末の名前・時間・音の設定を削除しますか？'))return;data=defaults();selectedChildId=null;selectedMeal=detectMeal();audio.setEnabled(true);cancelEdit();persist();renderSettings();renderHome();});
  $('start-button').addEventListener('click',openMeal);$('meal-cat').addEventListener('click',playTap);
  $('finish-button').addEventListener('click',askFinish);$('confirm-finish').addEventListener('click',finishMeal);$('confirm-continue').addEventListener('click',continueMeal);
  document.addEventListener('keydown',e=>{
    const modal=!$('confirm-modal').classList.contains('hidden')?$('confirm-modal'):!$('settings-modal').classList.contains('hidden')?$('settings-modal'):null;
    if(!modal)return;
    if(e.key==='Escape'){modal.id==='confirm-modal'?continueMeal():closeSettings();return;}
    if(e.key==='Tab'){const els=[...modal.querySelectorAll('button,input,select,[tabindex="0"]')].filter(el=>!el.disabled&&el.getClientRects().length);const first=els[0],last=els.at(-1);if(e.shiftKey&&(document.activeElement===first||document.activeElement===modal.querySelector('[role=dialog]'))){e.preventDefault();last?.focus();}else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first?.focus();}}
  });
  document.addEventListener('visibilitychange',()=>{if(document.hidden){audio.stop();releaseWakeLock();if(session)updateDining(elapsed(),true);}else recover();});
  window.addEventListener('pagehide',()=>{audio.stop();releaseWakeLock();clearInterval(tickTimer);});
  window.addEventListener('pageshow',()=>{if(session){clearInterval(tickTimer);tickTimer=setInterval(tick,250);recover();}});
  audio.setEnabled(data.soundEnabled);renderHome();
  window.addEventListener('resize',queueBubbleLayout);
  if ('ResizeObserver' in window) {
    const observer = new ResizeObserver(queueBubbleLayout);
    observer.observe($('speech-bubble')); observer.observe($('meal-cat'));
  }
  document.fonts?.ready.then(queueBubbleLayout);
  fetch('./assets/character/manifest.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(value=>{assets=value;renderHome();if(session){const stage=lastStage;lastStage=-1;setStage(stage,false);}}).catch(()=>{});
  fetch('./assets/dining/manifest.json').then(r=>{if(!r.ok)throw Error();return r.json();}).then(value=>{
    diningAssets=value;
    if(session){const stage=lastStage;diningStage=-1;setStage(stage,false);updateDining(elapsed(),true);}
  }).catch(()=>{});
  restoreSession();
  if(storageFailed)showToast('このたんまつでは せっていを ほぞんできません');
  if('serviceWorker' in navigator&&location.protocol.startsWith('http')){
    let reloading=false;
    navigator.serviceWorker.addEventListener('controllerchange',()=>{if(reloading)return;reloading=true;location.reload();});
    window.addEventListener('load',async()=>{
      try{await navigator.serviceWorker.register('./sw.js');await navigator.serviceWorker.ready;
        if(navigator.serviceWorker.controller){offlineReady=true;$('offline-status').textContent='オフラインで利用できます';}
      }catch{$('offline-status').textContent='オフライン準備には通信が必要です';}
    });
  }
})();
