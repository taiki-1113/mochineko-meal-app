/* One decoded Web Audio source at a time; assets are bundled and cached offline. */
window.MochiAudio = (() => {
  let context, source, sourceGain, settle, resumeTask, serial = 0, enabled = true;
  const buffers = new Map();
  const lastVariant = {};
  function unlock() {
    try {
      const AudioContext = window.AudioContext || window.webkitAudioContext;
      if (!AudioContext) return;
      context ||= new AudioContext();
      resumeTask = context.resume().catch(() => {});
      const silence = context.createBufferSource();
      silence.buffer = context.createBuffer(1, 1, context.sampleRate);
      silence.connect(context.destination); silence.start();
    } catch { /* Bubbles and timing continue when audio is unavailable. */ }
  }
  async function buffer(path) {
    if (!context) return null;
    if (!buffers.has(path)) buffers.set(path, fetch(path).then(r => {
      if (!r.ok) throw new Error('audio unavailable');
      return r.arrayBuffer();
    }).then(raw => context.decodeAudioData(raw)).catch(() => { buffers.delete(path); return null; }));
    return buffers.get(path);
  }
  function stop() {
    serial++;
    if (source) { source.onended = null; try { source.stop(); } catch {} source.disconnect(); source = null; }
    sourceGain?.disconnect(); sourceGain = null;
    if (settle) { settle(); settle = null; }
  }
  function setEnabled(value) { enabled = !!value; if (!enabled) stop(); }
  function select(group) {
    const choices = [1,2,3].filter(n => n !== lastVariant[group]);
    const n = choices[Math.floor(Math.random() * choices.length)];
    lastVariant[group] = n;
    return `./assets/audio/${group}-${n}.wav`;
  }
  async function play(group, { sleep = false } = {}) {
    stop();
    const token = serial;
    if (!enabled || !context || document.hidden) return;
    if (resumeTask) await Promise.race([resumeTask, new Promise(resolve => setTimeout(resolve, 2000))]);
    if (!enabled || !context || document.hidden || context.state !== 'running') return;
    if (token !== serial) return;
    // Bound decoding failures so the ending screen never depends on the network.
    const decoded = await Promise.race([buffer(sleep ? './assets/audio/sleep.wav' : select(group)), new Promise(resolve => setTimeout(() => resolve(null), 4000))]);
    if (!decoded || token !== serial || !enabled || document.hidden) return;
    const node = context.createBufferSource();
    const gain = context.createGain();
    node.buffer = decoded; node.loop = sleep;
    gain.gain.value = sleep ? .2 : .6;
    node.connect(gain); gain.connect(context.destination); source = node; sourceGain = gain;
    node.start();
    if (sleep) return;
    return new Promise(resolve => {
      let timer;
      const done = () => { clearTimeout(timer); node.disconnect(); gain.disconnect(); if (source === node) { source = null; sourceGain = null; settle = null; } resolve(); };
      settle = done; node.onended = done;
      timer = setTimeout(() => { if (source === node) stop(); }, (decoded.duration + .5) * 1000);
    });
  }
  return { unlock, stop, setEnabled, play, get ready() { return !!context && context.state === 'running'; } };
})();
