const socket = io();

// DOM refs — XP in persistentem Header
const levelNum       = document.getElementById('xp-level-number');
const xpFill         = document.getElementById('xp-bar-fill');
const xpNumbers      = document.getElementById('xp-numbers');
const ticketsMini    = document.getElementById('xp-tickets-count');
const upgradesGrid   = document.getElementById('upgrades-grid');
const noUpgrades     = document.getElementById('no-upgrades');
const streakDisplay  = document.getElementById('streak-display');
const streakFlame    = document.getElementById('streak-flame');
const streakCount    = document.getElementById('streak-count');
const streakLabel    = document.getElementById('streak-label');
const shrineDisplay  = document.getElementById('shrine-display');
const shrineTime     = document.getElementById('shrine-time');
const shrineStatus   = document.getElementById('shrine-status');
const ticketsCount   = document.getElementById('tickets-count');
const levelupModal   = document.getElementById('levelup-modal');
const levelupCards   = document.getElementById('levelup-cards');
const gameoverModal  = document.getElementById('gameover-modal');
const gameoverCards  = document.getElementById('gameover-cards');
const gameoverFlash  = document.getElementById('gameover-flash');
const btnReset       = document.getElementById('btn-reset');

// Stats
const statKills   = document.getElementById('stat-kills');
const statChests  = document.getElementById('stat-chests');
const statKrogs   = document.getElementById('stat-krogs');
const statQuests  = document.getElementById('stat-quests');
const statCooks   = document.getElementById('stat-cooks');
const statShrines = document.getElementById('stat-shrines');
const statTotalXp = document.getElementById('stat-total-xp');

let shrineInterval = null;
let shrineStartedAt = null;
let currentUpgrades = [];

// ── State Rendering ──────────────────────────────────────────
function renderState(s) {
  levelNum.textContent = s.level;
  const pct = s.xpToNextLevel > 0 ? (s.xp / s.xpToNextLevel * 100).toFixed(1) : 100;
  xpFill.style.width = pct + '%';
  xpNumbers.textContent = `${s.xp} / ${s.xpToNextLevel} XP`;
  ticketsCount.textContent = s.teleportTickets;
  if (ticketsMini) ticketsMini.textContent = s.teleportTickets;
  renderUpgrades(s.ownedUpgrades);
  renderStreak(s.streak, s.streakMultiplier, s.streakLabel);

  statKills.textContent = Object.values(s.kills).reduce((a, b) => a + b, 0);
  statChests.textContent = s.chestsOpened;
  statKrogs.textContent = s.krogsFound;
  statQuests.textContent = s.questsCompleted;
  statCooks.textContent = s.cookSuccesses;
  statShrines.textContent = s.shrinesCompleted;
  statTotalXp.textContent = s.totalXpEarned;

  if (s.shrineActive && !shrineInterval) {
    startShrineDisplay(s.shrineStartedAt);
  }

  if (s.pendingLevelUpChoices && s.pendingLevelUpChoices.length > 0) {
    showLevelUpModal(s.pendingLevelUpChoices);
  }
  if (s.pendingGameOverChoices && s.pendingGameOverChoices.length > 0) {
    showGameOverModal(s.pendingGameOverChoices);
  }
}

// ── Upgrades Grid ─────────────────────────────────────────────
function renderUpgrades(ownedUpgrades) {
  currentUpgrades = ownedUpgrades;
  upgradesGrid.innerHTML = '';
  if (ownedUpgrades.length === 0) {
    upgradesGrid.appendChild(noUpgrades);
    return;
  }
  // We need display info — fetch from server or use minimal inline map
  ownedUpgrades.forEach(id => {
    const info = UPGRADE_DISPLAY[id] || { name: id, icon: '❓' };
    const card = document.createElement('div');
    card.className = 'upgrade-card';
    card.innerHTML = `<span class="icon">${info.icon}</span><span class="name">${info.name}</span>`;
    upgradesGrid.appendChild(card);
  });
}

// Inline display map (mirrors upgrades.js)
const UPGRADE_DISPLAY = {
  'zeitumkehr':          { name: 'Zeitumkehr',      icon: '⏪' },
  'shield-fuse':         { name: 'Shield Fuse',     icon: '🛡️' },
  'weapon-fuse':         { name: 'Weapon Fuse',     icon: '⚔️' },
  'arrow-fuse':          { name: 'Arrow Fuse',      icon: '🏹' },
  'deckensprung':        { name: 'Deckensprung',    icon: '⬆️' },
  'ultrahand':           { name: 'Ultrahand',       icon: '🤝' },
  'zonai-bauteile':      { name: 'Zonai Bauteile',  icon: '⚙️' },
  'ruestung-hose':       { name: 'Rüstung: Hose',   icon: '👖' },
  'ruestung-torso':      { name: 'Rüstung: Torso',  icon: '🧥' },
  'ruestung-kopf':       { name: 'Rüstung: Kopf',   icon: '⛑️' },
  'koch-limit-tier1':    { name: 'Koch-Limit 6',    icon: '🍳' },
  'koch-limit-tier2':    { name: 'Koch-Limit 10',   icon: '🍳' },
  'koch-limit-tier3':    { name: 'Koch-Limit 15',   icon: '🍳' },
  'teleport-ticket-pack':{ name: 'Ticket Pack',     icon: '🎫' }
};

// ── Streak ────────────────────────────────────────────────────
function renderStreak(streak, multiplier, label) {
  if (streak <= 0) {
    streakDisplay.classList.add('inactive');
    return;
  }
  streakDisplay.classList.remove('inactive');
  streakCount.textContent = streak;
  streakLabel.textContent = label || 'STREAK';

  const scale = Math.min(1 + streak * 0.04, 2.0);
  const glow = Math.min(streak * 2, 20);
  streakFlame.style.transform = `scale(${scale})`;
  streakFlame.style.filter = `drop-shadow(0 0 ${glow}px #ff6600)`;

  if (multiplier >= 3.0) streakCount.style.color = '#ff2000';
  else if (multiplier >= 2.5) streakCount.style.color = '#ff4010';
  else if (multiplier >= 2.0) streakCount.style.color = '#ff7010';
  else if (multiplier >= 1.5) streakCount.style.color = '#ffa020';
  else streakCount.style.color = '#ff8c00';
}

// ── Shrine Timer ──────────────────────────────────────────────
function startShrineDisplay(startedAt) {
  shrineStartedAt = startedAt;
  shrineDisplay.classList.add('active');
  shrineStatus.textContent = 'Läuft...';
  shrineTime.textContent = '0:00';
  shrineInterval = setInterval(updateShrineTime, 100);
  updateShrineTime();
}

function stopShrineDisplay() {
  clearInterval(shrineInterval);
  shrineInterval = null;
  shrineStartedAt = null;
  shrineDisplay.classList.remove('active', 'warning');
  shrineTime.textContent = '–';
  shrineStatus.textContent = 'Inaktiv';
}

function updateShrineTime() {
  if (!shrineStartedAt) return;
  const elapsed = (Date.now() - shrineStartedAt) / 1000;
  const mins = Math.floor(elapsed / 60);
  const secs = Math.floor(elapsed % 60).toString().padStart(2, '0');
  shrineTime.textContent = `${mins}:${secs}`;
  if (elapsed >= 300) shrineDisplay.classList.add('warning');
}

// ── Level Up Modal ────────────────────────────────────────────
function showLevelUpModal(choices) {
  levelupCards.innerHTML = '';
  levelupModal.classList.add('active');

  choices.forEach((upg, i) => {
    const card = document.createElement('div');
    card.className = 'choice-card';
    card.innerHTML = `
      <span class="card-icon">${upg.icon}</span>
      <span class="card-name">${upg.name}</span>
      <span class="card-desc">${upg.description}</span>
    `;
    card.addEventListener('click', () => chooseLevelUpUpgrade(upg.id, card));
    levelupCards.appendChild(card);

    // Staggered slide-in
    setTimeout(() => card.classList.add('visible'), 60 + i * 80);
  });
}

function chooseLevelUpUpgrade(upgradeId, cardEl) {
  cardEl.classList.add('selected');
  spawnParticles(cardEl);

  fetch(`/api/levelup/choose/${upgradeId}`, { method: 'POST' })
    .then(() => {
      setTimeout(() => {
        levelupModal.classList.remove('active');
        levelupCards.innerHTML = '';
      }, 400);
    });
}

function spawnParticles(cardEl) {
  const rect = cardEl.getBoundingClientRect();
  const cx = rect.left + rect.width / 2;
  const cy = rect.top + rect.height / 2;

  for (let i = 0; i < 14; i++) {
    const p = document.createElement('div');
    p.className = 'particle';
    const angle = (i / 14) * Math.PI * 2;
    const dist = 60 + Math.random() * 60;
    p.style.left = cx + 'px';
    p.style.top = cy + 'px';
    p.style.setProperty('--tx', `${Math.cos(angle) * dist}px`);
    p.style.setProperty('--ty', `${Math.sin(angle) * dist}px`);
    p.style.background = Math.random() > 0.5 ? '#f0c040' : '#fff';
    document.body.appendChild(p);
    p.addEventListener('animationend', () => p.remove());
  }
}

// ── Game Over Modal ───────────────────────────────────────────
function showGameOverModal(choices) {
  gameoverCards.innerHTML = '';
  gameoverModal.classList.add('active');

  gameoverFlash.classList.remove('active');
  void gameoverFlash.offsetWidth;
  gameoverFlash.classList.add('active');

  if (choices.length === 0) {
    // No upgrades to remove, just close after a moment
    const msg = document.createElement('p');
    msg.style.cssText = 'color:var(--muted);font-size:14px;margin-top:20px;';
    msg.textContent = 'Keine Fähigkeiten zum Entfernen.';
    gameoverCards.appendChild(msg);
    setTimeout(() => gameoverModal.classList.remove('active'), 2500);
    return;
  }

  choices.forEach(upg => {
    const card = document.createElement('div');
    card.className = 'removal-card';
    card.innerHTML = `
      <span class="card-icon">${upg.icon}</span>
      <span class="card-name">${upg.name}</span>
      <span class="card-desc">${upg.description}</span>
      <div class="skull-overlay">💀</div>
    `;
    card.addEventListener('click', () => chooseGameOverRemoval(upg.id, card, choices));
    gameoverCards.appendChild(card);
  });
}

function chooseGameOverRemoval(upgradeId, chosenCard, allCards) {
  // Dismiss all cards visually
  gameoverCards.querySelectorAll('.removal-card').forEach(c => {
    if (c !== chosenCard) c.classList.add('dismissed');
  });

  fetch(`/api/gameover/choose/${upgradeId}`, { method: 'POST' })
    .then(() => {
      setTimeout(() => {
        gameoverModal.classList.remove('active');
        gameoverCards.innerHTML = '';
      }, 800);
    });
}

// ── Reset ─────────────────────────────────────────────────────
btnReset.addEventListener('click', () => {
  if (!confirm('Run wirklich zurücksetzen?')) return;
  fetch('/api/run/reset', { method: 'POST' }).then(r => r.json()).then(d => renderState(d.state));
});

// ── Socket Events ─────────────────────────────────────────────
let mapInitialized = false;
socket.on('state:full', (s) => {
  renderState(s);
  if (window.mapModule) {
    window.mapModule.setConquestState(s.conquest);
    if (!mapInitialized) {
      mapInitialized = true;
      window.mapModule.loadMapData();
      window.mapModule.initSocketEvents(socket);
    }
  }
});

socket.on('level:up', ({ newLevel, choices }) => {
  levelNum.textContent = newLevel;

  xpFill.classList.remove('level-up-flash');
  void xpFill.offsetWidth;
  xpFill.classList.add('level-up-flash');

  window.sfx?.levelUp();

  if (choices && choices.length > 0) {
    showLevelUpModal(choices);
  }
});

socket.on('streak:update', ({ streak, multiplier, label }) => {
  renderStreak(streak, multiplier, label);
  statKills.textContent = parseInt(statKills.textContent || 0) + 1;
  window.sfx?.streakUp(streak);
});

socket.on('streak:reset', () => {
  streakDisplay.classList.add('inactive');
  streakCount.textContent = '0';
  streakFlame.style.transform = 'scale(1)';
  streakFlame.style.filter = 'none';
  window.sfx?.streakReset();
});

socket.on('shrine:start', ({ startedAt }) => {
  startShrineDisplay(startedAt);
  window.sfx?.shrineStart();
});
socket.on('shrine:end', ({ bonusXp, totalXp }) => {
  stopShrineDisplay();
  statShrines.textContent = parseInt(statShrines.textContent || 0) + 1;
  window.sfx?.shrineEnd();
});

socket.on('gameover:start', ({ choices }) => {
  window.sfx?.gameOver();
  showGameOverModal(choices);
  // Drain XP bar
  xpFill.style.transition = 'width 800ms ease-in';
  xpFill.style.width = '0%';
  fetch('/api/state').then(r => r.json()).then(s => {
    xpNumbers.textContent = `0 / ${s.xpToNextLevel} XP`;
  });
});

socket.on('ticket:granted', ({ tickets }) => {
  ticketsCount.textContent = tickets;
  if (ticketsMini) ticketsMini.textContent = tickets;
});

socket.on('xp:gained', ({ streak } = {}) => {
  window.sfx?.xpGain(streak ?? 0);
  // Refresh XP bar from state
  fetch('/api/state').then(r => r.json()).then(s => {
    const pct = s.xpToNextLevel > 0 ? (s.xp / s.xpToNextLevel * 100).toFixed(1) : 100;
    xpFill.style.width = pct + '%';
    xpNumbers.textContent = `${s.xp} / ${s.xpToNextLevel} XP`;
    statTotalXp.textContent = s.totalXpEarned;
  });
});

socket.on('level:choiceMade', ({ newOwnedUpgrades }) => {
  renderUpgrades(newOwnedUpgrades);
});

socket.on('gameover:choiceMade', ({ remainingUpgrades }) => {
  renderUpgrades(remainingUpgrades);
});

socket.on('run:reset', () => {
  stopShrineDisplay();
  levelupModal.classList.remove('active');
  gameoverModal.classList.remove('active');
  window.sfx?.runReset();
});
