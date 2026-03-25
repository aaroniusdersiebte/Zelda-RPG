const UPGRADES = [
  // Single-use
  { id: 'zeitumkehr', name: 'Zeitumkehr', description: 'Kehrt Objekte in der Zeit zurück', icon: '⏪', type: 'single', tiers: null },
  { id: 'shield-fuse', name: 'Shield Fuse', description: 'Schild mit Materialen fusionieren', icon: '🛡️', type: 'single', tiers: null },
  { id: 'weapon-fuse', name: 'Weapon Fuse', description: 'Waffen mit Materialen fusionieren', icon: '⚔️', type: 'single', tiers: null },
  { id: 'arrow-fuse', name: 'Arrow Fuse', description: 'Pfeile mit Materialen fusionieren', icon: '🏹', type: 'single', tiers: null },
  { id: 'deckensprung', name: 'Deckensprung', description: 'Durch Decken springen', icon: '⬆️', type: 'single', tiers: null },
  { id: 'ultrahand', name: 'Ultrahand', description: 'Objekte greifen und verbinden', icon: '🤝', type: 'single', tiers: null },
  { id: 'zonai-bauteile', name: 'Zonai Bauteile', description: 'Zonai-Geräte nutzen', icon: '⚙️', type: 'single', tiers: null },
  { id: 'ruestung-hose', name: 'Rüstung: Hose', description: 'Rüstungshosen tragen', icon: '👖', type: 'single', tiers: null },
  { id: 'ruestung-torso', name: 'Rüstung: Torso', description: 'Rüstungstorso tragen', icon: '🧥', type: 'single', tiers: null },
  { id: 'ruestung-kopf', name: 'Rüstung: Kopf', description: 'Rüstungshelm tragen', icon: '⛑️', type: 'single', tiers: null },

  // Tiered
  {
    id: 'koch-limit',
    name: 'Koch-Limit',
    description: 'Erhöht das Kochlimit',
    icon: '🍳',
    type: 'tiered',
    tiers: [
      { tier: 1, id: 'koch-limit-tier1', description: 'Kochlimit: 6', requires: null },
      { tier: 2, id: 'koch-limit-tier2', description: 'Kochlimit: 10', requires: 'koch-limit-tier1' },
      { tier: 3, id: 'koch-limit-tier3', description: 'Kochlimit: 15', requires: 'koch-limit-tier2' }
    ]
  },

  // Extra (repeatable)
  { id: 'teleport-ticket-pack', name: 'Teleport Tickets', description: '+3 Teleport Tickets', icon: '🎫', type: 'extra', tiers: null }
];

/**
 * Build the pool of available upgrades given owned upgrade IDs.
 * Returns array of upgrade objects (with tier info merged for tiered).
 */
function buildPool(ownedUpgrades) {
  const pool = [];

  for (const upg of UPGRADES) {
    if (upg.type === 'single') {
      if (!ownedUpgrades.includes(upg.id)) {
        pool.push(upg);
      }
    } else if (upg.type === 'tiered') {
      const nextTier = upg.tiers.find(t => !ownedUpgrades.includes(t.id));
      if (nextTier) {
        pool.push({
          id: nextTier.id,
          name: `${upg.name} (${nextTier.description})`,
          description: nextTier.description,
          icon: upg.icon,
          type: 'tiered',
          tiers: null
        });
      }
    } else if (upg.type === 'extra') {
      pool.push(upg);
    }
  }

  return pool;
}

/**
 * Pick N random upgrades from pool using Fisher-Yates.
 */
function pickRandom(pool, count) {
  const shuffled = [...pool];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  return shuffled.slice(0, Math.min(count, shuffled.length));
}

/**
 * Get 3 upgrade choices for level-up.
 */
function getLevelUpChoices(ownedUpgrades) {
  const pool = buildPool(ownedUpgrades);
  return pickRandom(pool, 3);
}

/**
 * Get 2 owned upgrades to choose from for game-over removal.
 * Returns upgrade objects with display info.
 */
function getGameOverChoices(ownedUpgrades) {
  if (ownedUpgrades.length === 0) return [];
  const shuffled = [...ownedUpgrades];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [shuffled[i], shuffled[j]] = [shuffled[j], shuffled[i]];
  }
  const chosen = shuffled.slice(0, Math.min(2, shuffled.length));
  return chosen.map(id => getUpgradeById(id)).filter(Boolean);
}

/**
 * Find upgrade display info by ID (searches singles, tiered tiers, extras).
 */
function getUpgradeById(id) {
  for (const upg of UPGRADES) {
    if (upg.type === 'tiered') {
      const tier = upg.tiers.find(t => t.id === id);
      if (tier) {
        return {
          id: tier.id,
          name: `${upg.name} (${tier.description})`,
          description: tier.description,
          icon: upg.icon,
          type: 'tiered'
        };
      }
    } else if (upg.id === id) {
      return upg;
    }
  }
  return null;
}

module.exports = { UPGRADES, buildPool, getLevelUpChoices, getGameOverChoices, getUpgradeById };
