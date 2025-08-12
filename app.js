/* app.js (Modified Version) */

let CONFIG = null;

// --- DOM elements ---
const stage = document.getElementById('stage');
const banner = document.getElementById('banner');
const startBtn = document.getElementById('startBtn');
const controls = document.getElementById('controls');
const nextBtn = document.getElementById('nextBtn');
const skipBtn = document.getElementById('skipBtn');
const muteBtn = document.getElementById('muteBtn');
const progressEl = document.getElementById('progress');

const bossBubble = document.getElementById('bossBubble');
const empBubble = document.getElementById('empBubble');

const maskCanvas = document.getElementById('maskCanvas');
const iconsContainer = document.getElementById('iconsContainer');
const finalScreen = document.getElementById('finalScreen');
const finalPitch = document.getElementById('finalPitch');
const contactEmail = document.getElementById('contactEmail');
const plainResume = document.getElementById('plainResume');
const resumeList = document.getElementById('resumeList');
const closePlain = document.getElementById('closePlain');
const flashlightIcon = document.getElementById('flashlight-icon');
// --- State ---
let audioCtx = null;
let audioSynths = {};
let isMuted = false;
let isSearching = false;
let currentQuestionIndex = -1;
let sequence = [];
let hotspots = {};
let revealed = new Set();      // Holds IDs of committed reveals
let pendingReveal = null;      // Holds ID waiting to be committed after 'Next'
let totalQuestions = 0;

/* --- Audio (unchanged) --- */
function ensureAudioCtx() { if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)(); }
function makeBgmSynth(opts) { return { play() { ensureAudioCtx(); if (this.node) return; const ctx = audioCtx; const o1 = ctx.createOscillator(), o2 = ctx.createOscillator(), g = ctx.createGain(), lfo = ctx.createOscillator(), lfoGain = ctx.createGain(); o1.type = opts.type || 'sine'; o2.type = opts.type || 'sine'; o1.frequency.value = opts.baseFreq || 60; o2.frequency.value = (opts.baseFreq || 60) * (opts.detuneRatio || 1.02); g.gain.value = 0.0; g.connect(ctx.destination); lfo.type = 'sine'; lfo.frequency.value = opts.lfoFreq || 0.22; lfoGain.gain.value = (opts.lfoDepth || 0.03); lfo.connect(lfoGain); lfoGain.connect(g.gain); o1.connect(g); o2.connect(g); const now = ctx.currentTime; o1.start(now); o2.start(now + 0.02); lfo.start(now); g.gain.linearRampToValueAtTime((opts.volume || 0.04), now + 0.6); this.node = { o1, o2, lfo, lfoGain, g }; }, stop() { if (!this.node) return; const ctx = audioCtx; const { o1, o2, lfo, g } = this.node; const now = ctx.currentTime; try { g.gain.exponentialRampToValueAtTime(0.0001, now + 0.3); } catch (e) { } setTimeout(() => { try { o1.stop(); o2.stop(); lfo.stop(); } catch (e) { } }, 400); this.node = null; } }; }
function initAudioSynths() { audioSynths = { 'bgmSearch': makeBgmSynth({ type: 'sine', baseFreq: 80, detuneRatio: 1.018, lfoFreq: 0.25, volume: 0.06 }), 'bgmBoss': makeBgmSynth({ type: 'triangle', baseFreq: 120, detuneRatio: 1.01, lfoFreq: 0.16, volume: 0.04 }), 'bgmEmployee': makeBgmSynth({ type: 'sine', baseFreq: 200, detuneRatio: 1.007, lfoFreq: 0.2, volume: 0.03 }) }; }
function playAudio(name) { if (isMuted) return; if (!audioSynths[name]) return; audioSynths[name].play(); }
function stopAudio(name) { if (audioSynths[name]) audioSynths[name].stop(); }
function stopAllAudio() { for (const k in audioSynths) stopAudio(k); }

/* --- Dialogue Bubble Logic (unchanged) --- */
function positionBubble(actor) { const charEl = document.querySelector('.character.' + actor); if (!charEl) return; const bubbleEl = charEl.querySelector('.bubble'); if (!bubbleEl) return; const staticLeftCss = getComputedStyle(charEl).getPropertyValue('--bubble-static-left').trim(); const staticTopCss = getComputedStyle(charEl).getPropertyValue('--bubble-static-top').trim(); if (staticLeftCss || staticTopCss) { if (staticLeftCss) bubbleEl.style.left = staticLeftCss; if (staticTopCss) bubbleEl.style.top = staticTopCss; return; } const stageRect = stage.getBoundingClientRect(); const charRect = charEl.getBoundingClientRect(); const avatarEl = charEl.querySelector('.avatar'); if (!avatarEl) return; const avatarRect = avatarEl.getBoundingClientRect(); const clone = bubbleEl.cloneNode(true); clone.style.position = 'absolute'; clone.style.left = '-9999px'; clone.style.top = '-9999px'; clone.style.width = 'auto'; clone.style.maxWidth = getComputedStyle(bubbleEl).maxWidth || ''; clone.style.visibility = 'hidden'; clone.classList.remove('show'); document.body.appendChild(clone); const bRect = clone.getBoundingClientRect(); document.body.removeChild(clone); const currentHotspotId = (typeof currentQuestionIndex === 'number' && sequence[currentQuestionIndex]) ? sequence[currentQuestionIndex].hotspotId : null; let offsetX = 0; if (currentHotspotId && hotspots[currentHotspotId] && typeof hotspots[currentHotspotId].bubbleOffsetX === 'number') { offsetX = hotspots[currentHotspotId].bubbleOffsetX; } else { const varStr = getComputedStyle(charEl).getPropertyValue('--bubble-offset-x').trim(); if (varStr) { const parsed = parseInt(varStr, 10); if (!Number.isNaN(parsed)) offsetX = parsed; } } const prefersRight = (actor === 'boss'); const spaceRight = stageRect.right - avatarRect.right; const spaceLeft = avatarRect.left - stageRect.left; let placeRight = prefersRight; if (placeRight) { if (spaceRight < bRect.width + 12 && spaceLeft >= bRect.width + 12) placeRight = false; } else { if (spaceLeft < bRect.width + 12 && spaceRight >= bRect.width + 12) placeRight = true; } const gap = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--bubble-gap')) || 16; let anchorCenterX; if (placeRight) { const leftViewport = avatarRect.right + gap; anchorCenterX = leftViewport + (bRect.width / 2); } else { const leftViewport = avatarRect.left - gap - bRect.width; anchorCenterX = leftViewport + (bRect.width / 2); } anchorCenterX += offsetX; let leftViewport = anchorCenterX - (bRect.width / 2); const minLeft = stageRect.left + 8; const maxLeft = stageRect.right - bRect.width - 8; if (leftViewport < minLeft) leftViewport = minLeft; if (leftViewport > maxLeft) leftViewport = maxLeft; let topViewport = avatarRect.top + (avatarRect.height / 2) - (bRect.height / 2); const preferAboveThreshold = stageRect.top + stageRect.height * 0.65; if (avatarRect.bottom > preferAboveThreshold && (avatarRect.top - stageRect.top) >= (bRect.height + 12)) { topViewport = avatarRect.top - bRect.height - 12; } const spaceAbove = avatarRect.top - stageRect.top; const spaceBelow = stageRect.bottom - avatarRect.bottom; if (topViewport < stageRect.top + 8 && spaceAbove > spaceBelow) topViewport = avatarRect.top - bRect.height - 12; else if (topViewport + bRect.height > stageRect.bottom - 8 && spaceBelow > spaceAbove) topViewport = avatarRect.bottom + 12; const minTop = stageRect.top + 8; const maxTop = stageRect.bottom - bRect.height - 8; if (topViewport < minTop) topViewport = minTop; if (topViewport > maxTop) topViewport = maxTop; const leftRelativeToChar = leftViewport - charRect.left; const topRelativeToChar = topViewport - charRect.top; bubbleEl.style.left = `${Math.round(leftRelativeToChar)}px`; bubbleEl.style.top = `${Math.round(topRelativeToChar)}px`; }
function showBoss(text) { empBubble.classList.remove('show'); empBubble.style.visibility = 'hidden'; empBubble.style.opacity = '0'; bossBubble.textContent = text; bossBubble.style.visibility = 'visible'; bossBubble.classList.add('show'); bossBubble.style.opacity = '1'; bossBubble.style.display = 'block';  nextBtn.disabled = false; playAudio('bgmBoss'); requestAnimationFrame(() => positionBubble('boss')); }
function hideBoss() { bossBubble.classList.remove('show'); bossBubble.style.opacity = '0'; bossBubble.style.visibility = 'hidden'; stopAudio('bgmBoss'); }
function showEmployee(text) { bossBubble.classList.remove('show'); bossBubble.style.visibility = 'hidden'; bossBubble.style.opacity = '0'; empBubble.textContent = text; empBubble.style.visibility = 'visible'; empBubble.classList.add('show'); empBubble.style.opacity = '1'; empBubble.style.display = 'block';  nextBtn.disabled = false; playAudio('bgmEmployee'); requestAnimationFrame(() => positionBubble('employee')); }
function hideEmployee() { empBubble.classList.remove('show'); empBubble.style.opacity = '0'; empBubble.style.visibility = 'hidden';  stopAudio('bgmEmployee'); }

/* --- Layout --- */
function positionIcons() {
  const rect = stage.getBoundingClientRect(); const sw = rect.width, sh = rect.height;
  for (const id in hotspots) {
    const cfg = hotspots[id]; const el = document.querySelector('.icon[data-hotspot-id="' + id + '"]'); if (!el) continue;
    const left = (cfg.iconPos.leftPct / 100) * sw; const top = (cfg.iconPos.topPct / 100) * sh; const w = (cfg.iconPos.widthPct / 100) * sw;
    el.style.left = left + 'px'; el.style.top = top + 'px'; el.style.width = Math.max(48, w) + 'px'; el.style.height = Math.max(48, w) + 'px';
  }
}

/* --- Canvas Mask (SIMPLIFIED LOGIC) --- */
let ctx = maskCanvas.getContext('2d');
let pointer = null;
function fitCanvas() { const rect = stage.getBoundingClientRect(); maskCanvas.width = rect.width; maskCanvas.height = rect.height; maskCanvas.style.width = rect.width + 'px'; maskCanvas.style.height = rect.height + 'px'; }

// The partition highlighting logic has been removed from the canvas.
// The background is now pure black during search via CSS.
function drawMask() {
  if (!isSearching) { maskCanvas.style.display = 'none'; return; }
  maskCanvas.style.display = 'block';
  const w = maskCanvas.width, h = maskCanvas.height;

  // 1. Draw the fully opaque black overlay
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
 ctx.fillStyle = 'rgba(0,0,0,0.95)';// Pure black
  ctx.fillRect(0, 0, w, h);
  ctx.restore();

  // 2. Punch out the hole for the flashlight
  if (pointer) {
    const r = Math.max(28, parseInt(getComputedStyle(document.documentElement).getPropertyValue('--flash-radius')) || 90);
    ctx.save();
    ctx.globalCompositeOperation = 'destination-out';
    ctx.beginPath();
    ctx.arc(pointer.x, pointer.y, r, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  }
}


// --- Event Handlers ---
maskCanvas.addEventListener('mousemove', (ev) => { if (!isSearching) return; pointer = { x: ev.offsetX, y: ev.offsetY }; 
  flashlightIcon.style.left = (pointer.x + 70) + 'px'; // 70px to the right of the cursor
  flashlightIcon.style.top = (pointer.y + 30) + 'px';  // 30px below the cursor
requestAnimationFrame(drawMask); });
maskCanvas.addEventListener('touchmove', (ev) => { if (!isSearching) return; ev.preventDefault(); const t = ev.touches[0]; const rect = maskCanvas.getBoundingClientRect(); pointer = { x: t.clientX - rect.left, y: t.clientY - rect.top }; requestAnimationFrame(drawMask); }, { passive: false });

maskCanvas.addEventListener('click', (ev) => {
  if (!isSearching) return;
  const pt = { x: ev.clientX, y: ev.clientY };
  maskCanvas.style.display = 'none';
  const el = document.elementFromPoint(pt.x, pt.y);
  maskCanvas.style.display = 'block';
  if (!el) return;
  const hotspotEl = el.closest('[data-hotspot-id]');
  if (hotspotEl) {
    handleHotspotClick(hotspotEl.dataset.hotspotId);
  } else {
    playWrongSfx();
    showEmployee("Not that one — keep looking.");
    setTimeout(() => { hideEmployee(); }, 900);
  }
});

/* --- SFX (unchanged) --- */
function playBeep(freq = 880, type = 'sine', duration = 0.12) { if (isMuted) return; ensureAudioCtx(); const o = audioCtx.createOscillator(), g = audioCtx.createGain(); o.type = type; o.frequency.value = freq; o.connect(g); g.connect(audioCtx.destination); g.gain.value = 0.001; const now = audioCtx.currentTime; g.gain.exponentialRampToValueAtTime(0.08, now + 0.01); o.start(now); g.gain.exponentialRampToValueAtTime(0.0001, now + duration); o.stop(now + duration + 0.02); }
function playWrongSfx() { playBeep(220, 'square', 0.18); }
function playCorrectSfx() { playBeep(1100, 'sine', 0.14); }

/* --- Search / Reveal Flow --- */
async function startSearch(targetHotspotId) {
    flashlightIcon.style.display = 'block';
  stage.classList.add('is-searching'); // NEW: Add class to hide partitions
  isSearching = true;
  fitCanvas();
  drawMask();
  playAudio('bgmSearch');
  showEmployee("Search the room. Click the object when you find it.");
  await new Promise(r => setTimeout(r, 900));
  hideEmployee();
  return new Promise((resolve) => { startSearch._resolve = resolve; startSearch._target = targetHotspotId; });
}

function endSearch() {
  flashlightIcon.style.display = 'none'; 
  stage.classList.remove('is-searching'); // NEW: Remove class
  isSearching = false;
  pointer = null;
  maskCanvas.style.display = 'none';
  stopAudio('bgmSearch');
}

// REPLACE the old handleHotspotClick function with this one

function handleHotspotClick(id) {
  const expectedHotspot = sequence[currentQuestionIndex].hotspotId;
  if (revealed.has(id) || pendingReveal === id) return; // Already found

  if (id === expectedHotspot) {
    playCorrectSfx();
    pendingReveal = id;
    
    // The promise is resolved, and the main sequence will take over.
    // We no longer show the employee reveal text from here.
    if (startSearch._resolve) {
      startSearch._resolve(id);
      startSearch._resolve = null;
      startSearch._target = null;
    }
  } else {
    playWrongSfx();
    showEmployee("Not that one — keep looking.");
    setTimeout(() => { hideEmployee(); }, 900);
  }
}

function commitPendingRevealIfAny() {
  if (!pendingReveal) return;
  const id = pendingReveal;
  if (revealed.has(id)) { pendingReveal = null; return; }
  revealed.add(id);
  const cfg = hotspots[id];
  if (cfg && cfg.pieceId) {
    const pieceEl = document.getElementById(cfg.pieceId);
    if (pieceEl) pieceEl.classList.add('revealed');
  }
  pendingReveal = null;
}

/* --- Main Sequence Runner (unchanged) --- */
async function runSequence() {
  for (let i = 0; i < sequence.length; i++) { const item = sequence[i]; if (item.type === 'dialog') { if (item.actor === 'boss') { showBoss(item.text); await waitForNextClick(); hideBoss(); } else { showEmployee(item.text); await waitForNextClick(); hideEmployee(); } continue; } else { currentQuestionIndex = i; break; } }
  let qIndex = currentQuestionIndex; let done = 0; totalQuestions = sequence.filter(s => s.type === 'question').length; setProgress(done, totalQuestions);
// In the runSequence function, find the `while (qIndex < sequence.length)` line
// and REPLACE the ENTIRE `while` block with the code below.

  while (qIndex < sequence.length) {
    const q = sequence[qIndex];
    if (q.type !== 'question') {
      qIndex++;
      continue;
    }
    currentQuestionIndex = qIndex;

    // 1. Boss asks the question
    for (const bl of q.bossLines || []) {
      showBoss(bl.text);
      await waitForNextClick();
      hideBoss();
    }

    // 2. Start search mode
    nextBtn.disabled = true;
    await startSearch(q.hotspotId); // This promise resolves on correct click

    // 3. Search is finished! Immediately exit search mode visuals.
    endSearch();
    commitPendingRevealIfAny();

    // 4. Now that the background is normal, show the employee's answer
    if (q.employeeReveal) {
      showEmployee(q.employeeReveal);
      await waitForNextClick();
      hideEmployee();
    }

    // 5. Show the boss's confirmation
    if (q.bossConfirm) {
      showBoss(q.bossConfirm);
      await waitForNextClick();
      hideBoss();
    }

    // 6. Update progress and move to the next question
    done++;
    setProgress(done, totalQuestions);
    qIndex++;
  }
  setTimeout(() => { if (revealed.size >= totalQuestions) { finalScreen.hidden = false; finalPitch.textContent = CONFIG.finalPitch || finalPitch.textContent; contactEmail.textContent = CONFIG.contactEmail || contactEmail.textContent; 
          // --- ADD THESE THREE LINES ---
      document.getElementById('controls').classList.add('on-final-screen');
      document.getElementById('boss').classList.add('on-final-screen');
      document.getElementById('employee').classList.add('on-final-screen');
      // --- END OF ADDED LINES ---
    playCorrectSfx(); stopAllAudio(); } }, 500);
}

function waitForNextClick() { return new Promise((resolve) => { function handler() { nextBtn.disabled = true; nextBtn.removeEventListener('click', handler); document.removeEventListener('keydown', keyHandler); resolve(); } function keyHandler(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nextBtn.click(); } } nextBtn.addEventListener('click', handler); document.addEventListener('keydown', keyHandler); }); }
function setProgress(done, total) { progressEl.textContent = `${done} / ${total}`; }

/* --- Initialization (MODIFIED) --- */
async function initFromConfig(cfg) {
  CONFIG = cfg; hotspots = cfg.hotspots || {}; sequence = cfg.sequence || [];
  stage.classList.add('starting'); initAudioSynths(); positionIcons();
  for (const id in hotspots) { const cfgHot = hotspots[id]; const el = document.querySelector('.icon[data-hotspot-id="' + id + '"]'); if (el && cfgHot.icon) el.src = cfgHot.icon; }
  banner.style.display = 'flex'; controls.style.display = 'none'; resumeList.innerHTML = '';
  for (const q of sequence) { if (q.type === 'question') { const li = document.createElement('li'); li.textContent = (q.employeeReveal || ''); resumeList.appendChild(li); } }
  startBtn.addEventListener('click', async () => {
    const startup = document.getElementById('startupOverlay');
    if (startup) { startup.classList.add('hidden'); setTimeout(() => startup.remove?.(), 420); }
    stage.classList.remove('starting');
    stage.classList.add('with-bg', 'blurred'); // NEW: Add classes for the background
    ensureAudioCtx(); if (audioCtx && audioCtx.state === 'suspended') await audioCtx.resume();
    startBtn.disabled = true;
    banner.style.display = 'none';
    controls.style.display = 'flex';
    runSequence();
  });
  skipBtn.addEventListener('click', () => { plainResume.hidden = false; });
  closePlain.addEventListener('click', () => { plainResume.hidden = true; });
  muteBtn.addEventListener('click', () => { isMuted = !isMuted; muteBtn.textContent = isMuted ? 'Unmute' : 'Mute'; if (isMuted) stopAllAudio(); });
  document.getElementById('restartBtn').addEventListener('click', () => { location.reload(); });
  window.addEventListener('resize', () => { positionIcons(); fitCanvas(); drawMask(); });
  fitCanvas();
}
(async () => { try { const res = await fetch('config.json'); if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`); const cfg = await res.json(); await initFromConfig(cfg); maskCanvas.style.display = 'none'; console.log('[init] ready'); } catch (err) { console.error("Failed to load or initialize from config:", err); alert("Failed to load config.json — please ensure it exists and you're running this from a local server."); } })();