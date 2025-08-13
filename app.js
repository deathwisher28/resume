/* app.js (v8 - Refined Audio System) */

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
let isMuted = false;
let isSearching = false;
let currentQuestionIndex = -1;
let sequence = [];
let hotspots = {};
let revealed = new Set();
let pendingReveal = null;
let totalQuestions = 0;

/* ======================================================= */
/*               REFINED AUDIO FILE SYSTEM (V2)            */
/* ======================================================= */

const audioTracks = {};
// NEW: State to remember volumes before muting
let storedVolumes = { bgmDialogue: 1, bgmSearch: 0 };

function initAudio() {
  audioTracks['bgmDialogue'] = new Audio('assets/audio/music-dialogue.mp3');
  audioTracks['bgmDialogue'].loop = true;

  audioTracks['bgmSearch'] = new Audio('assets/audio/music-search.mp3');
  audioTracks['bgmSearch'].loop = true;

  audioTracks['bgmFinal'] = new Audio('assets/audio/music-final.mp3');
  audioTracks['bgmFinal'].loop = false;

  audioTracks['sfxCorrect'] = new Audio('assets/audio/sfx-correct.mp3');
  audioTracks['sfxWrong'] = new Audio('assets/audio/sfx-wrong.mp3');

  for (const key in audioTracks) { audioTracks[key].load(); }
}

// NEW: This function now just plays one-shot sounds or the final track
function playSfx(name) {
  if (isMuted || !audioTracks[name]) return;
  const track = audioTracks[name];
  track.currentTime = 0;
  track.play().catch(e => console.error("SFX play failed:", e));
}

// NEW: Function to fade between the two main BGM tracks
function setBgm(mode) { // mode can be 'dialogue', 'search', or 'stop'
  const dialogueVol = (mode === 'dialogue') ? 1 : 0;
  const searchVol = (mode === 'search') ? 1 : 0;
  
  if (mode === 'stop') {
    audioTracks['bgmDialogue'].pause();
    audioTracks['bgmSearch'].pause();
    return;
  }

  // Store the volumes so we can restore them after unmuting
  storedVolumes = { bgmDialogue: dialogueVol, bgmSearch: searchVol };
  
  if (isMuted) return; // Don't adjust volume if muted

  audioTracks['bgmDialogue'].volume = dialogueVol;
  audioTracks['bgmSearch'].volume = searchVol;
}

// These are unchanged
function playCorrectSfx() { playSfx('sfxCorrect'); }
function playWrongSfx() { playSfx('sfxWrong'); }

/* ======================================================= */
/*             END OF REFINED AUDIO FILE SYSTEM              */
/* ======================================================= */


/* --- Dialogue Bubble Logic (Unchanged) --- */
function positionBubble(actor) { const charEl = document.querySelector('.character.' + actor); if (!charEl) return; const bubbleEl = charEl.querySelector('.bubble'); if (!bubbleEl) return; const staticLeftCss = getComputedStyle(charEl).getPropertyValue('--bubble-static-left').trim(); const staticTopCss = getComputedStyle(charEl).getPropertyValue('--bubble-static-top').trim(); if (staticLeftCss || staticTopCss) { if (staticLeftCss) bubbleEl.style.left = staticLeftCss; if (staticTopCss) bubbleEl.style.top = staticTopCss; return; } const stageRect = stage.getBoundingClientRect(); const charRect = charEl.getBoundingClientRect(); const avatarEl = charEl.querySelector('.avatar'); if (!avatarEl) return; const avatarRect = avatarEl.getBoundingClientRect(); const clone = bubbleEl.cloneNode(true); clone.style.position = 'absolute'; clone.style.left = '-9999px'; clone.style.top = '-9999px'; clone.style.width = 'auto'; clone.style.maxWidth = getComputedStyle(bubbleEl).maxWidth || ''; clone.style.visibility = 'hidden'; clone.classList.remove('show'); document.body.appendChild(clone); const bRect = clone.getBoundingClientRect(); document.body.removeChild(clone); const currentHotspotId = (typeof currentQuestionIndex === 'number' && sequence[currentQuestionIndex]) ? sequence[currentQuestionIndex].hotspotId : null; let offsetX = 0; if (currentHotspotId && hotspots[currentHotspotId] && typeof hotspots[currentHotspotId].bubbleOffsetX === 'number') { offsetX = hotspots[currentHotspotId].bubbleOffsetX; } else { const varStr = getComputedStyle(charEl).getPropertyValue('--bubble-offset-x').trim(); if (varStr) { const parsed = parseInt(varStr, 10); if (!Number.isNaN(parsed)) offsetX = parsed; } } const prefersRight = (actor === 'boss'); const spaceRight = stageRect.right - avatarRect.right; const spaceLeft = avatarRect.left - stageRect.left; let placeRight = prefersRight; if (placeRight) { if (spaceRight < bRect.width + 12 && spaceLeft >= bRect.width + 12) placeRight = false; } else { if (spaceLeft < bRect.width + 12 && spaceRight >= bRect.width + 12) placeRight = true; } const gap = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--bubble-gap')) || 16; let anchorCenterX; if (placeRight) { const leftViewport = avatarRect.right + gap; anchorCenterX = leftViewport + (bRect.width / 2); } else { const leftViewport = avatarRect.left - gap - bRect.width; anchorCenterX = leftViewport + (bRect.width / 2); } anchorCenterX += offsetX; let leftViewport = anchorCenterX - (bRect.width / 2); const minLeft = stageRect.left + 8; const maxLeft = stageRect.right - bRect.width - 8; if (leftViewport < minLeft) leftViewport = minLeft; if (leftViewport > maxLeft) leftViewport = maxLeft; let topViewport = avatarRect.top + (avatarRect.height / 2) - (bRect.height / 2); const preferAboveThreshold = stageRect.top + stageRect.height * 0.65; if (avatarRect.bottom > preferAboveThreshold && (avatarRect.top - stageRect.top) >= (bRect.height + 12)) { topViewport = avatarRect.top - bRect.height - 12; } const spaceAbove = avatarRect.top - stageRect.top; const spaceBelow = stageRect.bottom - avatarRect.bottom; if (topViewport < stageRect.top + 8 && spaceAbove > spaceBelow) topViewport = avatarRect.top - bRect.height - 12; else if (topViewport + bRect.height > stageRect.bottom - 8 && spaceBelow > spaceAbove) topViewport = avatarRect.bottom + 12; const minTop = stageRect.top + 8; const maxTop = stageRect.bottom - bRect.height - 8; if (topViewport < minTop) topViewport = minTop; if (topViewport > maxTop) topViewport = maxTop; const leftRelativeToChar = leftViewport - charRect.left; const topRelativeToChar = topViewport - charRect.top; bubbleEl.style.left = `${Math.round(leftRelativeToChar)}px`; bubbleEl.style.top = `${Math.round(topRelativeToChar)}px`; }
function showBoss(text) { empBubble.classList.remove('show'); empBubble.style.visibility = 'hidden'; empBubble.style.opacity = '0'; bossBubble.textContent = text; bossBubble.style.visibility = 'visible'; bossBubble.classList.add('show'); bossBubble.style.opacity = '1'; bossBubble.style.display = 'block'; nextBtn.disabled = false; requestAnimationFrame(() => positionBubble('boss')); }
function hideBoss() { bossBubble.classList.remove('show'); bossBubble.style.opacity = '0'; bossBubble.style.visibility = 'hidden'; }
function showEmployee(text) { bossBubble.classList.remove('show'); bossBubble.style.visibility = 'hidden'; bossBubble.style.opacity = '0'; empBubble.textContent = text; empBubble.style.visibility = 'visible'; empBubble.classList.add('show'); empBubble.style.opacity = '1'; empBubble.style.display = 'block'; nextBtn.disabled = false; requestAnimationFrame(() => positionBubble('employee')); }
function hideEmployee() { empBubble.classList.remove('show'); empBubble.style.opacity = '0'; empBubble.style.visibility = 'hidden'; }

/* --- Layout (Unchanged) --- */
function positionIcons() {
  const rect = stage.getBoundingClientRect(); const sw = rect.width, sh = rect.height;
  for (const id in hotspots) {
    const cfg = hotspots[id]; const el = document.querySelector('.icon[data-hotspot-id="' + id + '"]'); if (!el) continue;
    const left = (cfg.iconPos.leftPct / 100) * sw; const top = (cfg.iconPos.topPct / 100) * sh; const w = (cfg.iconPos.widthPct / 100) * sw;
    el.style.left = left + 'px'; el.style.top = top + 'px'; el.style.width = Math.max(48, w) + 'px'; el.style.height = Math.max(48, w) + 'px';
  }
}

/* --- Canvas Mask (Unchanged) --- */
let ctx = maskCanvas.getContext('2d');
let pointer = null;
function fitCanvas() { const rect = stage.getBoundingClientRect(); maskCanvas.width = rect.width; maskCanvas.height = rect.height; maskCanvas.style.width = rect.width + 'px'; maskCanvas.style.height = rect.height + 'px'; }
function drawMask() {
  if (!isSearching) { maskCanvas.style.display = 'none'; return; }
  maskCanvas.style.display = 'block';
  const w = maskCanvas.width, h = maskCanvas.height;
  ctx.save();
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(0,0,0,0.95)';
  ctx.fillRect(0, 0, w, h);
  ctx.restore();
  if (pointer) {
    const r = Math.max(28, parseInt(getComputedStyle(document.documentElement).getPropertyValue('--flash-radius')) || 90);
    ctx.save(); ctx.globalCompositeOperation = 'destination-out'; ctx.beginPath(); ctx.arc(pointer.x, pointer.y, r, 0, Math.PI * 2); ctx.fill(); ctx.restore();
  }
}

// --- Event Handlers (Unchanged) ---
maskCanvas.addEventListener('mousemove', (ev) => {
    if (!isSearching) return;
    pointer = { x: ev.offsetX, y: ev.offsetY };
    flashlightIcon.style.left = (pointer.x + 70) + 'px';
    flashlightIcon.style.top = (pointer.y + 30) + 'px';
    requestAnimationFrame(drawMask);
});
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

/* --- Search / Reveal Flow --- */
async function startSearch(targetHotspotId) {
  setBgm('search'); // NEW: Switch to search music
  flashlightIcon.style.display = 'block';
  stage.classList.add('is-searching');
  isSearching = true; fitCanvas(); drawMask();
  showEmployee("Search the room. Click the object when you find it.");
  await new Promise(r => setTimeout(r, 900));
  hideEmployee();
  return new Promise((resolve) => { startSearch._resolve = resolve; startSearch._target = targetHotspotId; });
}

function endSearch() {
  setBgm('dialogue'); // NEW: Switch back to dialogue music
  flashlightIcon.style.display = 'none';
  stage.classList.remove('is-searching');
  isSearching = false;
  pointer = null;
  maskCanvas.style.display = 'none';
}

function handleHotspotClick(id) {
  const expectedHotspot = sequence[currentQuestionIndex].hotspotId;
  if (revealed.has(id) || pendingReveal === id) return;
  if (id === expectedHotspot) {
    playCorrectSfx();
    pendingReveal = id;
    if (startSearch._resolve) {
      startSearch._resolve(id);
      startSearch._resolve = null; startSearch._target = null;
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

/* --- Main Sequence Runner --- */
async function runSequence() {
  for (let i = 0; i < sequence.length; i++) { const item = sequence[i]; if (item.type === 'dialog') { if (item.actor === 'boss') { showBoss(item.text); await waitForNextClick(); hideBoss(); } else { showEmployee(item.text); await waitForNextClick(); hideEmployee(); } continue; } else { currentQuestionIndex = i; break; } }
  let qIndex = currentQuestionIndex; let done = 0; totalQuestions = sequence.filter(s => s.type === 'question').length; setProgress(done, totalQuestions);
  while (qIndex < sequence.length) {
    const q = sequence[qIndex]; if (q.type !== 'question') { qIndex++; continue; }
    currentQuestionIndex = qIndex;
    for (const bl of q.bossLines || []) { showBoss(bl.text); await waitForNextClick(); hideBoss(); }
    nextBtn.disabled = true;
    await startSearch(q.hotspotId);
    
    // NEW: Add a delay after finding the answer, before music changes
    await new Promise(r => setTimeout(r, 1000)); // 1 second delay
    
    endSearch();
    commitPendingRevealIfAny();
    if (q.employeeReveal) { showEmployee(q.employeeReveal); await waitForNextClick(); hideEmployee(); }
    if (q.bossConfirm) { showBoss(q.bossConfirm); await waitForNextClick(); hideBoss(); }
    done++; setProgress(done, totalQuestions);
    qIndex++;
  }
  setTimeout(() => {
    if (revealed.size >= totalQuestions) {
      finalScreen.hidden = false;
      finalPitch.textContent = CONFIG.finalPitch || finalPitch.textContent;
      contactEmail.textContent = CONFIG.contactEmail || contactEmail.textContent;
      
      setBgm('stop'); // NEW: Stop all looping BGM
      playSfx('bgmFinal'); // Play the final one-shot track
      
      document.getElementById('controls').classList.add('on-final-screen');
      document.getElementById('boss').classList.add('on-final-screen');
      document.getElementById('employee').classList.add('on-final-screen');
    }
  }, 500);
}

function waitForNextClick() { return new Promise((resolve) => { function handler() { nextBtn.disabled = true; nextBtn.removeEventListener('click', handler); document.removeEventListener('keydown', keyHandler); resolve(); } function keyHandler(e) { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); nextBtn.click(); } } nextBtn.addEventListener('click', handler); document.addEventListener('keydown', keyHandler); }); }
function setProgress(done, total) { progressEl.textContent = `${done} / ${total}`; }

/* --- Initialization --- */
async function initFromConfig(cfg) {
  CONFIG = cfg; hotspots = cfg.hotspots || {}; sequence = cfg.sequence || [];
  stage.classList.add('starting');
  initAudio();
  positionIcons();
  for (const id in hotspots) { const cfgHot = hotspots[id]; const el = document.querySelector('.icon[data-hotspot-id="' + id + '"]'); if (el && cfgHot.icon) el.src = cfgHot.icon; }
  banner.style.display = 'flex'; controls.style.display = 'none'; resumeList.innerHTML = '';
  for (const q of sequence) { if (q.type === 'question') { const li = document.createElement('li'); li.textContent = (q.employeeReveal || ''); resumeList.appendChild(li); } }
  
  startBtn.addEventListener('click', async () => {
    const startup = document.getElementById('startupOverlay');
    if (startup) { startup.classList.add('hidden'); setTimeout(() => startup.remove?.(), 420); }
    stage.classList.remove('starting');
    stage.classList.add('with-bg', 'blurred');
    
    // NEW: Start BOTH tracks but set search volume to 0
    audioTracks['bgmDialogue'].play().catch(e => {});
    audioTracks['bgmSearch'].play().catch(e => {});
    setBgm('dialogue');

    startBtn.disabled = true;
    banner.style.display = 'none';
    controls.style.display = 'flex';
    runSequence();
  });
  
  // UPDATED: Logic to stop/resume music for resume screen
  skipBtn.addEventListener('click', () => {
    plainResume.hidden = false;
    audioTracks['bgmDialogue'].pause();
    audioTracks['bgmSearch'].pause();
    audioTracks['bgmFinal'].pause(); // Also pause final music if it's playing
  });
  closePlain.addEventListener('click', () => {
    plainResume.hidden = true;
    // Only resume the main BGM tracks if not on the final screen
    if (finalScreen.hidden) {
        audioTracks['bgmDialogue'].play().catch(e => {});
        audioTracks['bgmSearch'].play().catch(e => {});
    }
  });
  
  // UPDATED: Mute button now works correctly for all states
  muteBtn.addEventListener('click', () => {
    isMuted = !isMuted;
    muteBtn.textContent = isMuted ? 'Unmute' : 'Mute';
    if (isMuted) {
      audioTracks['bgmDialogue'].volume = 0;
      audioTracks['bgmSearch'].volume = 0;
      audioTracks['bgmFinal'].muted = true; // Mute the one-shot final track
    } else {
      // Restore volumes to their correct pre-mute state
      audioTracks['bgmDialogue'].volume = storedVolumes.bgmDialogue;
      audioTracks['bgmSearch'].volume = storedVolumes.bgmSearch;
      audioTracks['bgmFinal'].muted = false;
    }
  });

  document.getElementById('restartBtn').addEventListener('click', () => { location.reload(); });
  window.addEventListener('resize', () => { positionIcons(); fitCanvas(); drawMask(); });
  fitCanvas();
}

// Unchanged
(async () => {
  try {
    const res = await fetch('config.json');
    if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
    const cfg = await res.json();
    await initFromConfig(cfg);
    maskCanvas.style.display = 'none';
    console.log('[init] ready');
  } catch (err) {
    console.error("Failed to load or initialize from config:", err);
    alert("Failed to load config.json — please ensure it exists and you're running this from a local server.");
  }
})();