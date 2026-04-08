const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, '..', 'data', 'run.json');

let debounceTimer = null;

function load() {
  try {
    const raw = fs.readFileSync(DATA_PATH, 'utf8');
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function save(state, conquestRunState) {
  clearTimeout(debounceTimer);
  debounceTimer = setTimeout(() => {
    const serializable = { ...state };
    // Strip in-memory-only fields
    delete serializable.streakTimerHandle;
    delete serializable.pendingLevelUpChoices;
    delete serializable.pendingGameOverChoices;

    if (conquestRunState !== undefined) {
      serializable.conquest = conquestRunState;
    }

    fs.mkdirSync(path.dirname(DATA_PATH), { recursive: true });
    fs.writeFile(DATA_PATH, JSON.stringify(serializable, null, 2), () => {});
  }, 300);
}

module.exports = { load, save };
