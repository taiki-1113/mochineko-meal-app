(() => {
  'use strict';

  const STORAGE_KEY = 'mochineko.v1';
  const mealTypes = {
    breakfast: { label: '朝ごはん', short: '朝', icon: '☀️', scene: 'day-breakfast' },
    lunch: { label: '昼ごはん', short: '昼', icon: '🌿', scene: 'day-lunch' },
    dinner: { label: '夜ごはん', short: '夜', icon: '🌙', scene: 'day-dinner' }
  };
  const catLines = [
    'まあ、のんびりね。', 'いい感じ。ぼくもここにいるよ。', 'ひとくちずつで大丈夫。',
    'ふむふむ。いい時間だね。', 'きみのペースでいいんだよ。', 'ぼくのおなかも、もちもち。',
    'あせらなくていいからね。', 'ゆっくり味わうのもいいね。', 'ここで見守っているよ。', 'おいしい時間になりますように。'
  ];
  const reactions = ['おっ、気づいたね。', 'なあに？ぼくはここだよ。', 'ふふん、いいこいいこ。'];
  let data = loadData();
  let selectedMeal = detectMeal();
  let selectedChildId = data.children[0]?.id || null;
  let activeSession = null;
  let speech = null;
  let toastTimer = null;
  let tickTimer = null;
  let wakeLock = null;
  let lastTapAt = 0;
  let sessionStartedAt = 0;
  let lastStage = -1;
  let lastLineIndex = -1;
  let voiceTimer = null;
  const $ = (id) => document.getElementById(id);

  function defaults() {
    return { children: [], durations: { breakfast: 30, lunch: 30, dinner: 30 }, mealOverride: null };
  }
  function loadData() {
    try {
      const value = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (!value || typeof value !== 'object') return defaults();
      const base = defaults();
      return {
        ...base, ...value,
        children: Array.isArray(value.children) ? value.children.slice(0, 3).filter(c => c && c.id && c.name) : [],
        durations: { ...base.durations, ...(value.durations || {}) }
      };
    } catch { return defaults(); }
  }
  function persist() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); return true; }
    catch { showToast('端末に保存できませんでした'); return false; }
  }
  function uid() { return globalThis.crypto?.randomUUID?.() || `child-${Date.now()}-${Math.random().toString(16).slice(2)}`; }
  function detectMeal() {
    const hour = new Date().getHours();
    return hour >= 5 && hour < 11 ? 'breakfast' : hour >= 11 && hour < 17 ? 'lunch' : 'dinner';
  }
  function selectedDuration() { return Number(data.durations[selectedMeal]) || 30; }

  function catSvg(stage = 1) {
    // Original vector illustration follows the adopted 3D character sheet: white base, warm brown patches and half-lidded face.
    if (stage >= 3) return `<svg class="cat-svg sleeping" viewBox="0 0 320 280" role="img" aria-label="眠っているもちねこ">
      <ellipse class="fur" cx="160" cy="220" rx="133" ry="39"/><path class="patch" d="M225 186c22-9 41 0 51 19-19 11-39 10-60 2z"/>
      <ellipse class="fur" cx="157" cy="201" rx="79" ry="47"/><path class="fur" d="M100 204c-11-43 6-86 55-91 48-5 72 29 68 75-4 39-31 57-66 57-29 0-49-12-57-41Z"/>
      <path class="patch" d="M111 153c-5-24 1-47 19-59l15 24 10-30c25-4 47 6 57 24-11 7-20 14-28 25-24-11-47-5-73 16Z"/><path class="inner-ear" d="m131 109 3-17 10 16m43 0 10-16 5 22"/>
      <path class="eye-line" d="M126 173q12 9 24 0m29 0q12 9 24 0"/><path class="nose" d="m158 183 7 0-3.5 5z"/><path class="mouth" d="M162 188q-5 8-11 3m11-3q5 8 11 3"/><ellipse class="blush" cx="124" cy="187" rx="10" ry="5"/><ellipse class="blush" cx="204" cy="187" rx="10" ry="5"/>
      <path class="fur" d="M101 228q-19 9-16 23 15 11 32-2m106-21q19 8 16 23-15 12-31-1"/><text x="243" y="96" font-size="25" fill="#bd8a5e">z</text><text x="263" y="75" font-size="18" fill="#bd8a5e">z</text>
    </svg>`;

    const progress = Math.max(0, Math.min(1, stage / 2));
    const rx = 78 + progress * 43;
    const bodyY = 227 - progress * 20;
    const bodyRy = 52 + progress * 26;
    const headRy = 70 + progress * 5;
    const headCy = 112 + progress * 14;
    const pawY = bodyY + bodyRy - 8;
    const cheeks = progress > .48 ? `<ellipse class="fur" cx="106" cy="158" rx="25" ry="22"/><ellipse class="fur" cx="214" cy="158" rx="25" ry="22"/>` : '';
    return `<svg class="cat-svg" viewBox="0 0 320 320" role="img" aria-label="もちねこ">
      <path class="fur" d="M81 238c-25 6-40-9-30-25 9-15 23-12 35-2"/><ellipse class="fur" cx="160" cy="${bodyY}" rx="${rx}" ry="${bodyRy}"/>
      <path class="fur" d="M91 ${headCy-28} 91 ${headCy-59}q1-13 14-5l23 24m70 0 23-24q13-8 14 5l1 31q-4 57-71 61-68-4-74-61Z"/>
      <path class="inner-ear" d="m101 ${headCy-59} 3 18 16-5m99 5 16 5 3-18"/>
      <path class="patch" d="M98 ${headCy-43}q11-23 35-28l14 20 11-22q35 1 52 22-7 8-13 21-30-12-49 2-24-13-50 7Z"/>
      ${cheeks}
      <path class="line" d="M116 ${headCy+3}q14-12 28-1m32 0q14-11 28 1"/><path class="eye" d="M116 ${headCy+1}q13-12 27-1l1 5q-14 7-28-1zM176 ${headCy}q14-11 28 1l-1 4q-13 7-27-1z"/>
      <ellipse class="blush" cx="113" cy="${headCy+22}" rx="12" ry="6"/><ellipse class="blush" cx="207" cy="${headCy+22}" rx="12" ry="6"/>
      <path class="nose" d="m157 ${headCy+16} 7 0-3.5 5z"/><path class="mouth" d="M160 ${headCy+21}q-5 8-12 3m12-3q5 8 12 3"/>
      <path class="line whisker" d="m104 ${headCy+16}-22-5m23 13-20 3m131-11 22-5m-23 13 20 3"/>
      <ellipse class="fur" cx="129" cy="${pawY}" rx="22" ry="12"/><ellipse class="fur" cx="191" cy="${pawY}" rx="22" ry="12"/>
    </svg>`;
  }

  function renderHome() {
    $('home-cat').innerHTML = catSvg(0);
    $('child-picker').innerHTML = data.children.length ? data.children.map(child => `<button class="child-chip ${child.id === selectedChildId ? 'selected' : ''}" data-child="${escapeAttr(child.id)}" aria-pressed="${child.id === selectedChildId}"><span class="chip-face">${child.id === selectedChildId ? '🐾' : '♡'}</span>${escapeHtml(child.name)}</button>`).join('') : '<div class="empty-children">まずは設定からニックネームを登録してね。</div>';
    document.querySelectorAll('.child-chip').forEach(button => button.addEventListener('click', () => {
      selectedChildId = button.dataset.child; renderHome();
    }));
    document.querySelectorAll('.meal-option').forEach(button => {
      button.classList.toggle('active', button.dataset.meal === selectedMeal);
      button.setAttribute('aria-pressed', button.dataset.meal === selectedMeal);
      button.onclick = () => { selectedMeal = button.dataset.meal; data.mealOverride = selectedMeal; persist(); renderHome(); };
    });
    $('meal-icon').textContent = mealTypes[selectedMeal].icon;
    $('meal-label').textContent = mealTypes[selectedMeal].label;
    $('start-hint').textContent = data.children.length ? `めやす ${selectedDuration()}分 · 準備ができたら、はじめよう` : '「いただきます」を押すと、ニックネームの設定へ進みます';
    $('start-button').disabled = false;
  }
  function renderSettings() {
    $('settings-children').innerHTML = data.children.length ? data.children.map(child => `<div class="setting-child-row"><span class="setting-child-name">🐾 ${escapeHtml(child.name)}</span><button data-remove-child="${escapeAttr(child.id)}" aria-label="${escapeAttr(child.name)}を削除">×</button></div>`).join('') : '<div class="no-children">まだ登録されていません</div>';
    document.querySelectorAll('[data-remove-child]').forEach(button => button.onclick = () => {
      const child = data.children.find(c => c.id === button.dataset.removeChild);
      if (!child) return;
      data.children = data.children.filter(c => c.id !== child.id);
      if (selectedChildId === child.id) selectedChildId = data.children[0]?.id || null;
      persist(); renderSettings(); renderHome();
    });
    $('child-form').classList.toggle('hidden', data.children.length >= 3);
    $('child-limit-note').textContent = data.children.length >= 3 ? '登録できるのは3人までです。' : 'お名前はこの端末の中だけに保存されます。';
    $('duration-list').innerHTML = Object.entries(mealTypes).map(([key, meal]) => `<div class="duration-row"><span class="duration-name">${meal.icon} ${meal.label}</span><div class="duration-control"><button data-duration="${key}" data-delta="-5" aria-label="${meal.label}を5分短く" ${data.durations[key] <= 10 ? 'disabled' : ''}>−</button><strong>${data.durations[key]}分</strong><button data-duration="${key}" data-delta="5" aria-label="${meal.label}を5分長く" ${data.durations[key] >= 60 ? 'disabled' : ''}>＋</button></div></div>`).join('');
    document.querySelectorAll('[data-duration]').forEach(button => button.onclick = () => {
      const key = button.dataset.duration; data.durations[key] = Math.max(10, Math.min(60, data.durations[key] + Number(button.dataset.delta))); persist(); renderSettings(); renderHome();
    });
  }
  function escapeHtml(value) { return String(value).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
  function escapeAttr(value) { return escapeHtml(value); }
  function showToast(message) { const el = $('toast'); el.textContent = message; el.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => el.classList.remove('show'), 2400); }
  function openSettings() { renderSettings(); $('settings-modal').classList.remove('hidden'); setTimeout(() => $('child-name').focus({ preventScroll: true }), 100); }
  function closeSettings() { $('settings-modal').classList.add('hidden'); renderHome(); }

  function getStage(elapsed, duration) {
    if (elapsed >= duration * 60 + 180) return 3;
    if (elapsed >= duration * 60) return 2;
    return Math.min(1, Math.floor(elapsed / (duration * 60) * 2));
  }
  function stageLabel(stage) { return ['食事中 · かりかり', '食事中 · まるまる', 'おなかいっぱい · もちもち', 'すやすや · おやすみ'][stage]; }
  function stageMessage(stage) { return ['もちねこも、いっしょにいただきます。','もちねこが、となりで見守っているよ。','ふう、おなかがもちもち。ゆっくりでいいよ。','すやすや…もちねこはここにいるよ。'][stage]; }
  function updateSessionView() {
    if (!activeSession) return;
    const elapsed = Math.max(0, (Date.now() - sessionStartedAt) / 1000);
    const stage = getStage(elapsed, activeSession.duration);
    if (stage !== lastStage) {
      lastStage = stage;
      $('meal-cat').innerHTML = catSvg(stage);
      $('meal-cat').classList.add('growth-pop'); setTimeout(() => $('meal-cat').classList.remove('growth-pop'), 700);
      $('stage-pill').textContent = stageLabel(stage); $('meal-message').textContent = stageMessage(stage);
      if (stage === 3) stopVoiceLoop();
    }
  }
  function requestWakeLock() {
    if (!('wakeLock' in navigator)) return;
    navigator.wakeLock.request('screen').then(lock => { wakeLock = lock; lock.addEventListener('release', () => { wakeLock = null; }); }).catch(() => {});
  }
  function releaseWakeLock() { if (wakeLock) { wakeLock.release().catch(() => {}); wakeLock = null; } }
  function say(text, { interrupt = true, onend } = {}) {
    if (!('speechSynthesis' in window) || !('SpeechSynthesisUtterance' in window)) { onend?.(); return false; }
    try {
      if (interrupt) window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text); utterance.lang = 'ja-JP'; utterance.rate = .88; utterance.pitch = .88;
      speech = utterance; utterance.onstart = () => $('meal-cat')?.classList.add('speaking');
      utterance.onend = utterance.onerror = () => { $('meal-cat')?.classList.remove('speaking'); speech = null; onend?.(); };
      window.speechSynthesis.speak(utterance); return true;
    } catch { onend?.(); return false; }
  }
  function stopSpeech() { if ('speechSynthesis' in window) window.speechSynthesis.cancel(); speech = null; $('meal-cat')?.classList.remove('speaking'); }
  function startVoiceLoop() {
    stopVoiceLoop();
    voiceTimer = setInterval(() => {
      if (!activeSession || document.hidden || $('confirm-modal').classList.contains('hidden') === false) return;
      const elapsed = Math.max(0, (Date.now() - sessionStartedAt) / 1000);
      if (getStage(elapsed, activeSession.duration) >= 3 || speech) return;
      let index = Math.floor(Math.random() * catLines.length);
      if (index === lastLineIndex) index = (index + 1 + Math.floor(Math.random() * (catLines.length - 1))) % catLines.length;
      lastLineIndex = index; say(catLines[index]);
    }, 120000);
  }
  function stopVoiceLoop() { clearInterval(voiceTimer); voiceTimer = null; }
  function playTapReaction() {
    const now = Date.now(); if (now - lastTapAt < 3300 || speech || !activeSession) return;
    lastTapAt = now;
    const cat = $('meal-cat'); cat.classList.remove('reacting'); void cat.offsetWidth; cat.classList.add('reacting');
    try { const ctx = new (window.AudioContext || window.webkitAudioContext)(); const osc = ctx.createOscillator(); const gain = ctx.createGain(); osc.type = 'sine'; osc.frequency.setValueAtTime(740, ctx.currentTime); osc.frequency.exponentialRampToValueAtTime(540, ctx.currentTime + .12); gain.gain.setValueAtTime(.055, ctx.currentTime); gain.gain.exponentialRampToValueAtTime(.001, ctx.currentTime + .16); osc.connect(gain).connect(ctx.destination); osc.start(); osc.stop(ctx.currentTime + .17); osc.onended = () => ctx.close(); } catch {}
    const text = reactions[Math.floor(Math.random() * reactions.length)]; say(text);
    $('tap-note').textContent = text; setTimeout(() => { if (activeSession) $('tap-note').textContent = 'タップしてみてね'; }, 2200);
  }
  function openMeal() {
    const child = data.children.find(c => c.id === selectedChildId);
    if (!child) { showToast('設定からニックネームを登録してね'); openSettings(); return; }
    activeSession = { childId: child.id, meal: selectedMeal, duration: selectedDuration(), startedAt: Date.now() };
    sessionStartedAt = activeSession.startedAt; lastStage = -1; lastLineIndex = -1; lastTapAt = 0;
    try { localStorage.setItem('mochineko.session', JSON.stringify(activeSession)); } catch {}
    $('home-screen').classList.add('hidden'); $('meal-screen').classList.remove('hidden');
    $('meal-screen-label').textContent = mealTypes[selectedMeal].label; $('meal-cat').classList.remove('growth-pop','reacting');
    $('meal-scene').className = `meal-scene ${mealTypes[selectedMeal].scene}`;
    $('tap-note').textContent = 'タップしてみてね';
    updateSessionView(); requestWakeLock();
    if (!('wakeLock' in navigator)) showToast('画面が消える場合は、自動ロック設定をご確認ください');
    startVoiceLoop(); say('手を合わせて、いただきます。');
    clearInterval(tickTimer); tickTimer = setInterval(updateSessionView, 1000);
  }
  function askFinish() { $('confirm-modal').classList.remove('hidden'); }
  function continueMeal() { $('confirm-modal').classList.add('hidden'); }
  function finishMeal() {
    if (!activeSession) return;
    stopVoiceLoop(); clearInterval(tickTimer); stopSpeech(); releaseWakeLock();
    $('confirm-modal').classList.add('hidden'); $('meal-title').textContent = 'ごちそうさま'; $('stage-pill').textContent = 'きょうも、よくがんばったね'; $('meal-message').textContent = 'もちねこと、ゆっくりひとやすみ。';
    $('meal-cat').innerHTML = catSvg(3); $('meal-cat').classList.remove('reacting');
    const goHome = () => {
      if (!activeSession) return;
      activeSession = null;
      try { localStorage.removeItem('mochineko.session'); } catch {}
      $('meal-screen').classList.add('hidden'); $('home-screen').classList.remove('hidden'); $('meal-title').textContent = 'いただきます'; renderHome();
    };
    say('手を合わせて、ごちそうさまでした。', { onend: goHome });
    setTimeout(goHome, 7000);
  }
  function restoreSession() {
    try {
      const saved = JSON.parse(localStorage.getItem('mochineko.session') || 'null');
      if (!saved || !saved.startedAt || !mealTypes[saved.meal] || !data.children.some(c => c.id === saved.childId)) return;
      activeSession = saved; selectedChildId = saved.childId; selectedMeal = saved.meal; sessionStartedAt = Number(saved.startedAt); lastStage = -1;
      $('home-screen').classList.add('hidden'); $('meal-screen').classList.remove('hidden'); $('meal-screen-label').textContent = mealTypes[selectedMeal].label;
      $('meal-scene').className = `meal-scene ${mealTypes[selectedMeal].scene}`; updateSessionView(); requestWakeLock(); startVoiceLoop(); clearInterval(tickTimer); tickTimer = setInterval(updateSessionView, 1000);
      showToast('食事のつづきに戻りました');
    } catch {}
  }

  $('settings-open').addEventListener('click', openSettings);
  $('settings-close').addEventListener('click', closeSettings); $('settings-done').addEventListener('click', closeSettings);
  $('settings-modal').addEventListener('click', e => { if (e.target === $('settings-modal')) closeSettings(); });
  $('child-form').addEventListener('submit', e => {
    e.preventDefault(); const field = $('child-name'); const name = field.value.trim();
    if (!name) { field.focus(); return; }
    if (data.children.length >= 3) return;
    const child = { id: uid(), name }; data.children.push(child); selectedChildId = child.id; field.value = ''; persist(); renderSettings(); renderHome(); field.focus();
  });
  $('reset-button').addEventListener('click', () => {
    if (!window.confirm('子どもの登録と食事時間の設定をすべて削除します。よろしいですか？')) return;
    data = defaults(); selectedChildId = null; selectedMeal = detectMeal(); persist(); renderSettings(); renderHome(); showToast('設定をリセットしました');
  });
  $('start-button').addEventListener('click', openMeal); $('finish-button').addEventListener('click', askFinish);
  $('confirm-continue').addEventListener('click', continueMeal); $('confirm-finish').addEventListener('click', finishMeal);
  $('meal-back').addEventListener('click', askFinish);
  $('meal-cat').addEventListener('click', playTapReaction); $('meal-cat').addEventListener('keydown', e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); playTapReaction(); } });
  document.addEventListener('visibilitychange', () => { if (!document.hidden && activeSession) { requestWakeLock(); updateSessionView(); } });
  window.addEventListener('pagehide', () => { if (activeSession) { stopVoiceLoop(); releaseWakeLock(); } });
  window.addEventListener('pageshow', () => { if (activeSession) { requestWakeLock(); updateSessionView(); } });
  document.addEventListener('keydown', e => { if (e.key === 'Escape') { if (!$('confirm-modal').classList.contains('hidden')) continueMeal(); else if (!$('settings-modal').classList.contains('hidden')) closeSettings(); } });
  renderHome();
  if (data.mealOverride && mealTypes[data.mealOverride]) selectedMeal = data.mealOverride;
  renderHome(); restoreSession();
  if ('serviceWorker' in navigator && location.protocol.startsWith('http')) {
    window.addEventListener('load', () => navigator.serviceWorker.register('./sw.js').catch(() => {}));
  }
})();

