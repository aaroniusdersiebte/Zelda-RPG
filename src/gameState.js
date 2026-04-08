const { v4: uuidv4 } = require('uuid');
const { getLevelUpChoices, getGameOverChoices } = require('./upgrades');
const persistence = require('./persistence');
const conquest = require('./conquest');

// XP per enemy tier
const ENEMY_XP = { klein: 10, normal: 25, stark: 50, miniboss: 150, boss: 400 };
const CHEST_XP = { normal: 30, treasure: 80 };
const KROG_XP = 15;
const QUEST_XP = 150;
const COOK_XP = 20;
const SHRINE_BASE_XP = 100;
const SHRINE_BONUS_MAX_XP = 100;
const SHRINE_BONUS_TIME_LIMIT = 360; // 6 minutes in seconds

// Streak tier thresholds
const STREAK_TIERS = [
  { min: 1, multiplier: 1.0, label: '' },
  { min: 2, multiplier: 1.5, label: 'COMBO' },
  { min: 5, multiplier: 2.0, label: 'KILLING SPREE' },
  { min: 10, multiplier: 2.5, label: 'UNSTOPPABLE' },
  { min: 15, multiplier: 3.0, label: 'LEGENDARY' },
  { min: 20, multiplier: 3.0, label: 'GODLIKE' }
];

function xpForLevel(level) {
  return Math.floor(100 * Math.pow(1.2, level - 1));
}

function getStreakInfo(streak) {
  let info = STREAK_TIERS[0];
  for (const tier of STREAK_TIERS) {
    if (streak >= tier.min) info = tier;
  }
  return info;
}

function freshState() {
  return {
    runId: uuidv4(),
    startedAt: Date.now(),
    level: 1,
    xp: 0,
    xpToNextLevel: xpForLevel(1),
    totalXpEarned: 0,
    streak: 0,
    lastKillAt: null,
    streakTimerHandle: null, // in-memory only
    shrineActive: false,
    shrineStartedAt: null,
    teleportTickets: 0,
    ownedUpgrades: [],
    pendingLevelUpChoices: [], // in-memory only
    pendingGameOverChoices: [], // in-memory only
    kills: { klein: 0, normal: 0, stark: 0, miniboss: 0, boss: 0 },
    chestsOpened: 0,
    krogsFound: 0,
    questsCompleted: 0,
    cookSuccesses: 0,
    shrinesCompleted: 0
  };
}

let state = freshState();
let emitFn = null; // set by server.js

function setEmitter(fn) {
  emitFn = fn;
  conquest.setEmitter(fn);
}

function emit(event, data) {
  if (emitFn) emitFn(event, data);
}

function getPublicState() {
  const streakInfo = getStreakInfo(state.streak);
  return {
    runId: state.runId,
    startedAt: state.startedAt,
    level: state.level,
    xp: state.xp,
    xpToNextLevel: state.xpToNextLevel,
    totalXpEarned: state.totalXpEarned,
    streak: state.streak,
    streakMultiplier: streakInfo.multiplier,
    streakLabel: streakInfo.label,
    shrineActive: state.shrineActive,
    shrineStartedAt: state.shrineStartedAt,
    teleportTickets: state.teleportTickets,
    ownedUpgrades: state.ownedUpgrades,
    pendingLevelUpChoices: state.pendingLevelUpChoices,
    pendingGameOverChoices: state.pendingGameOverChoices,
    kills: state.kills,
    chestsOpened: state.chestsOpened,
    krogsFound: state.krogsFound,
    questsCompleted: state.questsCompleted,
    cookSuccesses: state.cookSuccesses,
    shrinesCompleted: state.shrinesCompleted,
    conquest: conquest.getState()
  };
}

function addXp(amount, source) {
  const multiplied = Math.round(amount * getStreakInfo(state.streak).multiplier);
  state.xp += multiplied;
  state.totalXpEarned += multiplied;

  emit('xp:gained', {
    amount,
    multiplied,
    source,
    streak: state.streak,
    streakMultiplier: getStreakInfo(state.streak).multiplier
  });

  persistence.save(state, conquest.getConquestRunState());

  // Check level up (may happen multiple times)
  while (state.xp >= state.xpToNextLevel) {
    state.xp -= state.xpToNextLevel;
    state.level += 1;
    state.xpToNextLevel = xpForLevel(state.level);
    state.teleportTickets += 1;

    const choices = getLevelUpChoices(state.ownedUpgrades);
    state.pendingLevelUpChoices = choices;

    emit('level:up', {
      newLevel: state.level,
      choices,
      teleportTickets: state.teleportTickets
    });
    emit('ticket:granted', { tickets: state.teleportTickets, delta: 1 });
    persistence.save(state, conquest.getConquestRunState());
  }

  return multiplied;
}

function addXpRaw(amount, source) {
  // No streak multiplier (shrine, krog, quest, cook)
  state.xp += amount;
  state.totalXpEarned += amount;

  emit('xp:gained', { amount, multiplied: amount, source, streakMultiplier: 1 });
  persistence.save(state, conquest.getConquestRunState());

  while (state.xp >= state.xpToNextLevel) {
    state.xp -= state.xpToNextLevel;
    state.level += 1;
    state.xpToNextLevel = xpForLevel(state.level);
    state.teleportTickets += 1;

    const choices = getLevelUpChoices(state.ownedUpgrades);
    state.pendingLevelUpChoices = choices;

    emit('level:up', {
      newLevel: state.level,
      choices,
      teleportTickets: state.teleportTickets
    });
    emit('ticket:granted', { tickets: state.teleportTickets, delta: 1 });
    persistence.save(state, conquest.getConquestRunState());
  }
}

function resetStreakTimer() {
  if (state.streakTimerHandle) clearTimeout(state.streakTimerHandle);
  state.streakTimerHandle = setTimeout(() => {
    const prev = state.streak;
    state.streak = 0;
    state.streakTimerHandle = null;
    emit('streak:reset', { previousStreak: prev });
    emit('streak:update', { streak: 0, multiplier: 1.0, label: '' });
  }, 60000);
}

// --- Public actions ---

function recordKill(tier) {
  if (!ENEMY_XP[tier]) return null;
  state.kills[tier] = (state.kills[tier] || 0) + 1;

  // Boss = +3 streak tiers (add 3 to streak count, capped at a sensible max)
  const streakBonus = tier === 'boss' ? 3 : 1;
  state.streak += streakBonus;
  state.lastKillAt = Date.now();
  resetStreakTimer();

  const streakInfo = getStreakInfo(state.streak);
  emit('streak:update', {
    streak: state.streak,
    multiplier: streakInfo.multiplier,
    label: streakInfo.label
  });

  const xpEarned = addXp(ENEMY_XP[tier], `kill:${tier}`);
  conquest.trackKill(tier);
  return { xpEarned, streak: state.streak, multiplier: streakInfo.multiplier };
}

function recordChest(type) {
  if (!CHEST_XP[type]) return null;
  state.chestsOpened += 1;
  addXpRaw(CHEST_XP[type], `chest:${type}`);
  return { xpEarned: CHEST_XP[type] };
}

function recordKrog() {
  state.krogsFound += 1;
  addXpRaw(KROG_XP, 'krog');
  conquest.trackKrog();
  return { xpEarned: KROG_XP };
}

function recordQuest() {
  state.questsCompleted += 1;
  addXpRaw(QUEST_XP, 'quest');
  return { xpEarned: QUEST_XP };
}

function recordCook() {
  state.cookSuccesses += 1;
  addXpRaw(COOK_XP, 'cook');
  return { xpEarned: COOK_XP };
}

function startShrine() {
  if (state.shrineActive) return null;
  state.shrineActive = true;
  state.shrineStartedAt = Date.now();
  emit('shrine:start', { startedAt: state.shrineStartedAt });
  persistence.save(state, conquest.getConquestRunState());
  return { startedAt: state.shrineStartedAt };
}

function endShrine() {
  if (!state.shrineActive) return null;
  const elapsedSeconds = (Date.now() - state.shrineStartedAt) / 1000;
  const bonusXp = Math.max(0, Math.round(SHRINE_BONUS_MAX_XP * (1 - elapsedSeconds / SHRINE_BONUS_TIME_LIMIT)));
  const totalXp = SHRINE_BASE_XP + bonusXp;

  state.shrineActive = false;
  state.shrineStartedAt = null;
  state.shrinesCompleted += 1;

  addXpRaw(totalXp, 'shrine');
  emit('shrine:end', { elapsedSeconds, bonusXp, totalXp });
  return { elapsedSeconds, bonusXp, totalXp };
}

function triggerGameOver() {
  // Reset XP progress (keep level)
  state.xp = 0;
  const choices = getGameOverChoices(state.ownedUpgrades);
  state.pendingGameOverChoices = choices;
  persistence.save(state, conquest.getConquestRunState());
  emit('gameover:start', { choices, xpReset: true });
  return { choices };
}

function chooseLevelUpUpgrade(upgradeId) {
  const valid = state.pendingLevelUpChoices.find(u => u.id === upgradeId);
  if (!valid) return null;

  // Handle extra (teleport tickets)
  if (valid.type === 'extra' && upgradeId === 'teleport-ticket-pack') {
    state.teleportTickets += 3;
    emit('ticket:granted', { tickets: state.teleportTickets, delta: 3 });
  } else {
    if (!state.ownedUpgrades.includes(upgradeId)) {
      state.ownedUpgrades.push(upgradeId);
    }
  }

  state.pendingLevelUpChoices = [];
  emit('level:choiceMade', { chosenId: upgradeId, newOwnedUpgrades: state.ownedUpgrades });
  persistence.save(state, conquest.getConquestRunState());
  return { chosenId: upgradeId };
}

function chooseGameOverRemoval(upgradeId) {
  const valid = state.pendingGameOverChoices.find(u => u.id === upgradeId);
  if (!valid) return null;

  state.ownedUpgrades = state.ownedUpgrades.filter(id => id !== upgradeId);
  state.pendingGameOverChoices = [];
  emit('gameover:choiceMade', { removedId: upgradeId, remainingUpgrades: state.ownedUpgrades });
  persistence.save(state, conquest.getConquestRunState());
  return { removedId: upgradeId };
}

function useTicket() {
  if (state.teleportTickets <= 0) return null;
  state.teleportTickets -= 1;
  emit('ticket:used', { tickets: state.teleportTickets });
  persistence.save(state, conquest.getConquestRunState());
  return { tickets: state.teleportTickets };
}

function awardConquestXp(amount) {
  addXpRaw(amount, 'conquest');
}

function resetRun() {
  if (state.streakTimerHandle) clearTimeout(state.streakTimerHandle);
  state = freshState();
  conquest.onRunReset();
  persistence.save(state, conquest.getConquestRunState());
  emit('run:reset', { newRunId: state.runId });
  emit('state:full', getPublicState());
}

function loadSavedState() {
  const saved = persistence.load();
  if (saved) {
    state = {
      ...freshState(),
      ...saved,
      // Beim Start immer zurücksetzen
      streak: 0,
      shrineActive: false,
      shrineStartedAt: null,
      streakTimerHandle: null,
      pendingLevelUpChoices: [],
      pendingGameOverChoices: []
    };
    conquest.loadConquestRunState(saved.conquest);
  } else {
    conquest.onRunReset();
  }
}

module.exports = {
  setEmitter,
  getPublicState,
  loadSavedState,
  recordKill,
  recordChest,
  recordKrog,
  recordQuest,
  recordCook,
  startShrine,
  endShrine,
  triggerGameOver,
  chooseLevelUpUpgrade,
  chooseGameOverRemoval,
  useTicket,
  resetRun,
  awardConquestXp
};
