const socket = io();

const levelNum        = document.getElementById('level-number');
const xpFill          = document.getElementById('xp-bar-fill');
const streakSection   = document.getElementById('streak-section');
const streakFlame     = document.getElementById('streak-flame');
const streakCount     = document.getElementById('streak-count');
const streakXpEl      = document.getElementById('streak-xp');
const streakTimerFill = document.getElementById('streak-timer-fill');
const shrineSection   = document.getElementById('shrine-section');
const shrineTime      = document.getElementById('shrine-time');
const ticketsCount    = document.getElementById('tickets-count');
const floatContainer  = document.getElementById('float-container');
const lvlFlash        = document.getElementById('levelup-flash');
const teleportFlash   = document.getElementById('teleport-flash');
const hudEl           = document.getElementById('hud');

const STREAK_DURATION = 60000; // ms

let shrineInterval    = null;
let shrineStart       = null;
let streakTimerIntvl  = null;   // setInterval handle for streak bar
let streakLastKill    = null;
let streakXp          = 0;
let streakXpDisplay   = 0;
let countUpRaf        = null;

// ── Audio ─────────────────────────────────────────────────────
let audioCtx = null;
function audio() {
  if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
  return audioCtx;
}
function tone(freq, t, dur, vol = 0.22, type = 'sine') {
  try {
    const ctx = audio(), osc = ctx.createOscillator(), g = ctx.createGain();
    osc.connect(g); g.connect(ctx.destination);
    osc.type = type; osc.frequency.value = freq;
    g.gain.setValueAtTime(0, t);
    g.gain.linearRampToValueAtTime(vol, t + 0.015);
    g.gain.exponentialRampToValueAtTime(0.001, t + dur);
    osc.start(t); osc.stop(t + dur + 0.01);
  } catch(e) {}
}
const sounds = {
  xp:         () => { const t = audio().currentTime; tone(880, t, 0.10, 0.08); },
  levelUp:    () => { const t = audio().currentTime; [523.25,659.25,783.99,1046.50].forEach((f,i) => tone(f, t+i*0.11, 0.30, 0.24)); },
  gameOver:   () => { const t = audio().currentTime; tone(440,t,0.40,0.30); tone(349.23,t+0.38,0.40,0.30); tone(293.66,t+0.74,0.70,0.30); tone(80,t+0.74,0.90,0.14,'sawtooth'); },
  shrineStart:() => { const t = audio().currentTime; tone(783.99,t,0.24,0.20); tone(1046.50,t+0.18,0.34,0.20); },
  shrineEnd:  () => { const t = audio().currentTime; tone(523.25,t,0.20,0.22); tone(659.25,t+0.13,0.20,0.22); tone(783.99,t+0.26,0.34,0.22); },
  teleport:   () => { const t = audio().currentTime; tone(1200,t,0.08,0.15); tone(900,t+0.07,0.14,0.12); }
};

// ── State rendering ───────────────────────────────────────────
function renderState(s) {
  levelNum.textContent = s.level;
  updateXpBar(s.xp, s.xpToNextLevel);
  ticketsCount.textContent = s.teleportTickets;
  renderStreak(s.streak, s.streakMultiplier, s.streakLabel);
  if (s.shrineActive && !shrineInterval) startShrineDisplay(s.shrineStartedAt);
  if (s.pendingLevelUpChoices && s.pendingLevelUpChoices.length > 0)
    levelNum.classList.add('levelup-pending');
}

function updateXpBar(xp, xpToNext) {
  const pct = xpToNext > 0 ? (xp / xpToNext * 100).toFixed(2) : 100;
  xpFill.style.width = pct + '%';
}

// ── Streak ────────────────────────────────────────────────────
function renderStreak(streak, multiplier, label) {
  if (streak <= 0) { streakSection.classList.remove('visible'); return; }
  streakSection.classList.add('visible');
  streakCount.textContent = streak;

  const scale = Math.min(1 + streak * 0.045, 2.1);
  const glow  = Math.min(streak * 2, 22);
  streakFlame.style.transform = `scale(${scale})`;
  streakFlame.style.filter    = `drop-shadow(0 0 ${glow}px #ff6600)`;

  if      (multiplier >= 3.0) streakCount.style.color = '#ff2000';
  else if (multiplier >= 2.5) streakCount.style.color = '#ff4010';
  else if (multiplier >= 2.0) streakCount.style.color = '#ff7010';
  else if (multiplier >= 1.5) streakCount.style.color = '#ffa020';
  else                         streakCount.style.color = '#ff8c00';
}

// Streak countdown bar — setInterval (more reliable than RAF in OBS)
function resetStreakTimer() {
  streakLastKill = Date.now();
  if (streakTimerIntvl) return; // already ticking, just reset the timestamp
  streakTimerIntvl = setInterval(() => {
    if (!streakLastKill) return;
    const elapsed   = Date.now() - streakLastKill;
    const remaining = Math.max(0, 1 - elapsed / STREAK_DURATION);
    streakTimerFill.style.width = (remaining * 100).toFixed(1) + '%';

    if      (remaining > 0.60) streakTimerFill.style.background = '#40e060';
    else if (remaining > 0.35) streakTimerFill.style.background = '#e0c040';
    else if (remaining > 0.15) streakTimerFill.style.background = '#e07020';
    else                        streakTimerFill.style.background = '#e02020';

    if (remaining <= 0) stopStreakTimer();
  }, 50);
}

function stopStreakTimer() {
  if (streakTimerIntvl) { clearInterval(streakTimerIntvl); streakTimerIntvl = null; }
  streakLastKill = null;
  streakTimerFill.style.width = '0%';
}

// Streak XP count-up
function countUpStreakXp(target) {
  if (countUpRaf) cancelAnimationFrame(countUpRaf);
  const start = streakXpDisplay, diff = target - start;
  const dur   = Math.min(280 + Math.abs(diff) * 0.3, 500);
  const t0    = performance.now();
  function step(now) {
    const p = Math.min((now - t0) / dur, 1), e = 1 - (1-p)*(1-p);
    streakXpDisplay = Math.round(start + diff * e);
    streakXpEl.textContent = `${streakXpDisplay} XP`;
    streakXpEl.classList.remove('counting');
    void streakXpEl.offsetWidth;
    streakXpEl.classList.add('counting');
    if (p < 1) countUpRaf = requestAnimationFrame(step);
    else { streakXpDisplay = target; countUpRaf = null; }
  }
  countUpRaf = requestAnimationFrame(step);
}

// ── XP Float ─────────────────────────────────────────────────
function spawnFloat(text, mulClass, x, y, extraClass) {
  const el = document.createElement('div');
  el.className = (extraClass || 'xp-float') + (mulClass ? ' ' + mulClass : '');
  el.textContent = text;
  el.style.left = x + 'px';
  el.style.top  = y + 'px';
  floatContainer.appendChild(el);
  el.addEventListener('animationend', () => el.remove());
}

function spawnXpFloat(amount, multiplier) {
  let cls;
  if      (multiplier >= 3.0) cls = 'mul-3';
  else if (multiplier >= 2.5) cls = 'mul-25';
  else if (multiplier >= 2.0) cls = 'mul-2';
  else if (multiplier >= 1.5) cls = 'mul-15';
  else                         cls = 'mul-1';

  const text = multiplier > 1 ? `+${amount} XP ×${multiplier}` : `+${amount} XP`;
  const rect = hudEl.getBoundingClientRect();
  const x = rect.left + 80 + Math.random() * (rect.width - 200);
  const y = rect.top - 4;
  spawnFloat(text, cls, x, y);
}

function spawnTicketFloat() {
  const el = document.getElementById('tickets-section');
  const rect = el ? el.getBoundingClientRect() : hudEl.getBoundingClientRect();
  spawnFloat('–1', null, rect.left + rect.width / 2 - 16, rect.top - 4, 'ticket-float');
}

// ── Shrine ───────────────────────────────────────────────────
function startShrineDisplay(startedAt) {
  shrineStart = startedAt;
  shrineSection.classList.add('active');
  shrineSection.classList.remove('warning');
  updateShrineTime();
  shrineInterval = setInterval(updateShrineTime, 100);
}
function stopShrineDisplay() {
  clearInterval(shrineInterval);
  shrineInterval = null; shrineStart = null;
  shrineSection.classList.remove('active', 'warning');
}
function updateShrineTime() {
  if (!shrineStart) return;
  const elapsed = (Date.now() - shrineStart) / 1000;
  const mins = Math.floor(elapsed / 60);
  const secs = Math.floor(elapsed % 60).toString().padStart(2, '0');
  shrineTime.textContent = `${mins}:${secs}`;
  if (elapsed >= 300) shrineSection.classList.add('warning');
}

// ── Level Up ─────────────────────────────────────────────────
function triggerLevelUpFlash() {
  levelNum.classList.remove('bump', 'levelup-pending');
  void levelNum.offsetWidth;
  levelNum.classList.add('bump');
  setTimeout(() => { levelNum.classList.remove('bump'); levelNum.classList.add('levelup-pending'); }, 550);
  lvlFlash.classList.remove('active');
  void lvlFlash.offsetWidth;
  lvlFlash.classList.add('active');
}

// ── Teleport animation ───────────────────────────────────────
function animateTeleportUse() {
  // Flash the whole HUD blue
  teleportFlash.classList.remove('active');
  void teleportFlash.offsetWidth;
  teleportFlash.classList.add('active');
  // Ticket count bounce red
  ticketsCount.classList.remove('used');
  void ticketsCount.offsetWidth;
  ticketsCount.classList.add('used');
  spawnTicketFloat();
  sounds.teleport();
}

// ── Socket Events ─────────────────────────────────────────────
socket.on('state:full', renderState);

socket.on('xp:gained', ({ multiplied, streakMultiplier, source }) => {
  spawnXpFloat(multiplied, streakMultiplier);
  sounds.xp();
  if (source && source.startsWith('kill:') && streakSection.classList.contains('visible')) {
    streakXp += multiplied;
    countUpStreakXp(streakXp);
  }
  fetch('/api/state').then(r => r.json()).then(s => updateXpBar(s.xp, s.xpToNextLevel));
});

socket.on('level:up', ({ newLevel }) => {
  levelNum.textContent = newLevel;
  triggerLevelUpFlash();
  sounds.levelUp();
});

socket.on('streak:update', ({ streak, multiplier, label }) => {
  renderStreak(streak, multiplier, label);
  resetStreakTimer();
});

socket.on('streak:reset', () => {
  streakSection.classList.remove('visible');
  streakXp = 0; streakXpDisplay = 0;
  streakXpEl.textContent = '0 XP';
  if (countUpRaf) { cancelAnimationFrame(countUpRaf); countUpRaf = null; }
  stopStreakTimer();
});

socket.on('shrine:start', ({ startedAt }) => { startShrineDisplay(startedAt); sounds.shrineStart(); });
socket.on('shrine:end',   ()               => { stopShrineDisplay(); sounds.shrineEnd(); });

socket.on('ticket:granted', ({ tickets }) => { ticketsCount.textContent = tickets; });
socket.on('ticket:used',    ({ tickets }) => { ticketsCount.textContent = tickets; animateTeleportUse(); });

socket.on('level:choiceMade', () => {
  levelNum.classList.remove('levelup-pending');
  fetch('/api/state').then(r => r.json()).then(renderState);
});

socket.on('gameover:start', () => {
  sounds.gameOver();
  xpFill.classList.add('drain');
  xpFill.style.width = '0%';
  setTimeout(() => xpFill.classList.remove('drain'), 900);
  streakXp = 0; streakXpDisplay = 0;
  streakXpEl.textContent = '0 XP';
  stopStreakTimer();
  streakSection.classList.remove('visible');
});

socket.on('run:reset', () => {
  stopShrineDisplay(); stopStreakTimer();
  streakXp = 0; streakXpDisplay = 0;
  streakXpEl.textContent = '0 XP';
  levelNum.classList.remove('levelup-pending');
  xpFill.style.width = '0%';
});
