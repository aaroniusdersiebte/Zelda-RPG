const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

const SHRINES = require('./data/shrines.json');
const TOWERS = require('./data/towers.json');
const REGIONS_PATH = path.join(__dirname, '..', 'data', 'regions.json');

const KILL_TIERS_MANDATORY = ['klein', 'normal', 'stark'];
const CONQUEST_XP = 500;

// --- Persistence ---

function loadRegions() {
  try {
    const raw = fs.readFileSync(REGIONS_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

function saveRegions(regions) {
  fs.writeFileSync(REGIONS_PATH, JSON.stringify(regions, null, 2));
}

// --- State ---

let regions = loadRegions();
let conquestRunState = {}; // { [regionId]: { roll, progress, conquered } }
let activeRegionId = null;
let emitFn = null;

function setEmitter(fn) {
  emitFn = fn;
}

function emit(event, data) {
  if (emitFn) emitFn(event, data);
}

// --- Helpers ---

function dist(x1, z1, x2, z2) {
  return Math.sqrt((x2 - x1) ** 2 + (z2 - z1) ** 2);
}

function nearestShrines(region, count = 8) {
  return [...SHRINES]
    .map(s => ({ ...s, d: dist(region.centerX, region.centerZ, s.x, s.z) }))
    .sort((a, b) => a.d - b.d)
    .slice(0, count);
}

function nearestTower(region) {
  return [...TOWERS]
    .map(t => ({ ...t, d: dist(region.centerX, region.centerZ, t.x, t.z) }))
    .sort((a, b) => a.d - b.d)[0];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// --- Roll ---

function rollChallenges(region) {
  const candidates = nearestShrines(region, 8);
  const shrineCount = randomInt(2, Math.min(5, candidates.length));
  const pickedShrines = shuffle(candidates).slice(0, shrineCount).map(s => s.id);

  // klein, normal, stark immer dabei; miniboss zufällig (max 1)
  const killRequirements = {};
  for (const tier of KILL_TIERS_MANDATORY) {
    killRequirements[tier] = randomInt(5, 20);
  }
  if (Math.random() < 0.5) {
    killRequirements['miniboss'] = 1;
  }

  const tower = nearestTower(region);

  return {
    shrineIds: pickedShrines,
    killRequirements,
    towerId: tower.id,
    towerRequired: true,
    korokRequired: randomInt(1, 5)
  };
}

function freshProgress(roll) {
  const killsDone = {};
  for (const tier of Object.keys(roll.killRequirements)) {
    killsDone[tier] = 0;
  }
  return {
    shrinesDone: [],
    killsDone,
    towerDone: false,
    koroksDone: 0
  };
}

// --- Run Reset ---

function onRunReset() {
  conquestRunState = {};
  for (const region of regions) {
    const roll = rollChallenges(region);
    conquestRunState[region.id] = {
      roll,
      progress: freshProgress(roll),
      conquered: false
    };
  }
  activeRegionId = null;
}

// --- Persistence of run state (called by gameState persistence) ---

function getConquestRunState() {
  return { activeRegionId, regions: conquestRunState };
}

function loadConquestRunState(saved) {
  if (!saved) return;
  activeRegionId = saved.activeRegionId || null;
  conquestRunState = saved.regions || {};

  // Ensure all current regions have run state (new regions added after run start)
  for (const region of regions) {
    if (!conquestRunState[region.id]) {
      const roll = rollChallenges(region);
      conquestRunState[region.id] = {
        roll,
        progress: freshProgress(roll),
        conquered: false
      };
    }
  }
}

// --- Region CRUD ---

function getRegions() {
  return regions;
}

function createRegion(name, centerX, centerZ) {
  const region = { id: uuidv4(), name, centerX, centerZ };
  regions.push(region);
  saveRegions(regions);

  // Roll for current run immediately
  const roll = rollChallenges(region);
  conquestRunState[region.id] = {
    roll,
    progress: freshProgress(roll),
    conquered: false
  };

  emit('conquest:regionCreated', region);
  return region;
}

function updateRegion(id, updates) {
  const idx = regions.findIndex(r => r.id === id);
  if (idx === -1) return null;
  regions[idx] = { ...regions[idx], ...updates, id };
  saveRegions(regions);
  emit('conquest:regionUpdated', regions[idx]);
  return regions[idx];
}

function deleteRegion(id) {
  regions = regions.filter(r => r.id !== id);
  saveRegions(regions);
  delete conquestRunState[id];
  if (activeRegionId === id) activeRegionId = null;
  emit('conquest:regionDeleted', { regionId: id });
  return true;
}

// --- Activate / Deactivate ---

function activateRegion(id) {
  if (!regions.find(r => r.id === id)) return null;
  activeRegionId = id;
  const state = conquestRunState[id];
  emit('conquest:activated', { regionId: id, roll: state?.roll, progress: state?.progress });
  return state;
}

function deactivateRegion() {
  activeRegionId = null;
  emit('conquest:deactivated', {});
}

// --- Progress Tracking ---

function checkConquered(regionId) {
  const s = conquestRunState[regionId];
  if (!s || s.conquered) return false;
  const { roll, progress } = s;

  const shrinesDone = roll.shrineIds.every(id => progress.shrinesDone.includes(id));
  const killsDone = Object.entries(roll.killRequirements).every(
    ([tier, req]) => (progress.killsDone[tier] || 0) >= req
  );
  const towerDone = !roll.towerRequired || progress.towerDone;
  const koroksDone = progress.koroksDone >= roll.korokRequired;

  if (shrinesDone && killsDone && towerDone && koroksDone) {
    s.conquered = true;
    emit('conquest:regionConquered', {
      regionId,
      name: regions.find(r => r.id === regionId)?.name,
      xpBonus: CONQUEST_XP
    });
    return true;
  }
  return false;
}

function emitProgress(regionId) {
  const s = conquestRunState[regionId];
  if (!s) return;
  emit('conquest:progressUpdate', { regionId, progress: s.progress, conquered: s.conquered });
}

function trackKill(tier) {
  if (!activeRegionId) return null;
  const s = conquestRunState[activeRegionId];
  if (!s || s.conquered) return null;
  if (!(tier in (s.progress.killsDone))) return null; // not required for this region

  s.progress.killsDone[tier] = (s.progress.killsDone[tier] || 0) + 1;
  emitProgress(activeRegionId);
  checkConquered(activeRegionId);
  return { regionId: activeRegionId, tier, count: s.progress.killsDone[tier] };
}

function trackKrog() {
  if (!activeRegionId) return null;
  const s = conquestRunState[activeRegionId];
  if (!s || s.conquered) return null;

  s.progress.koroksDone += 1;
  emitProgress(activeRegionId);
  checkConquered(activeRegionId);
  return { regionId: activeRegionId, koroksDone: s.progress.koroksDone };
}

function completeShrineDirect(shrineId) {
  if (!activeRegionId) return null;
  const s = conquestRunState[activeRegionId];
  if (!s || s.conquered) return null;
  if (!s.roll.shrineIds.includes(shrineId)) return null;
  if (s.progress.shrinesDone.includes(shrineId)) return null;

  s.progress.shrinesDone.push(shrineId);
  emitProgress(activeRegionId);
  const wasConquered = checkConquered(activeRegionId);
  return { regionId: activeRegionId, shrineId, xpBonus: wasConquered ? CONQUEST_XP : 0 };
}

function completeTower() {
  if (!activeRegionId) return null;
  const s = conquestRunState[activeRegionId];
  if (!s || s.conquered || s.progress.towerDone) return null;

  s.progress.towerDone = true;
  emitProgress(activeRegionId);
  checkConquered(activeRegionId);
  return { regionId: activeRegionId };
}

// --- Public State ---

function getState() {
  return {
    activeRegionId,
    regions: conquestRunState
  };
}

function getRegionDefinitions() {
  return regions;
}

function getShrines() {
  return SHRINES;
}

function getTowers() {
  return TOWERS;
}

module.exports = {
  setEmitter,
  onRunReset,
  getConquestRunState,
  loadConquestRunState,
  getRegions,
  getRegionDefinitions,
  createRegion,
  updateRegion,
  deleteRegion,
  activateRegion,
  deactivateRegion,
  trackKill,
  trackKrog,
  completeShrineDirect,
  completeTower,
  getState,
  getShrines,
  getTowers,
  CONQUEST_XP
};
