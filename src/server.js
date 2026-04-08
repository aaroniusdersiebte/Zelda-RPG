const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const gameState = require('./gameState');
const conquest = require('./conquest');

function startServer(port) {
  return new Promise((resolve) => {
    const app = express();
    const httpServer = http.createServer(app);
    const io = new Server(httpServer, { cors: { origin: '*' } });

    app.use(express.json());

    // Static file serving
    app.get('/', (req, res) => res.redirect('/overlay'));
    app.get('/ui', (req, res) => res.sendFile(path.join(__dirname, '..', 'ui', 'index.html')));
    app.get('/overlay', (req, res) => res.sendFile(path.join(__dirname, '..', 'overlay', 'index.html')));
    app.use('/ui', express.static(path.join(__dirname, '..', 'ui')));
    app.use('/overlay', express.static(path.join(__dirname, '..', 'overlay')));

    // Wire socket.io emitter to gameState
    gameState.setEmitter((event, data) => io.emit(event, data));

    // Load persisted state
    gameState.loadSavedState();

    // Socket.io: send full state on connect
    io.on('connection', (socket) => {
      socket.emit('state:full', gameState.getPublicState());
    });

    // --- API Routes ---

    app.post('/api/kill/:tier', (req, res) => {
      const result = gameState.recordKill(req.params.tier);
      if (!result) return res.status(400).json({ error: 'Invalid tier' });
      res.json({ ...result, state: gameState.getPublicState() });
    });

    app.post('/api/chest/:type', (req, res) => {
      const result = gameState.recordChest(req.params.type);
      if (!result) return res.status(400).json({ error: 'Invalid type' });
      res.json({ ...result, state: gameState.getPublicState() });
    });

    app.post('/api/krog', (req, res) => {
      const result = gameState.recordKrog();
      res.json({ ...result, state: gameState.getPublicState() });
    });

    app.post('/api/quest', (req, res) => {
      const result = gameState.recordQuest();
      res.json({ ...result, state: gameState.getPublicState() });
    });

    app.post('/api/cook', (req, res) => {
      const result = gameState.recordCook();
      res.json({ ...result, state: gameState.getPublicState() });
    });

    app.post('/api/shrine/start', (req, res) => {
      const result = gameState.startShrine();
      if (!result) return res.status(400).json({ error: 'Shrine already active' });
      res.json({ ...result, state: gameState.getPublicState() });
    });

    app.post('/api/shrine/end', (req, res) => {
      const result = gameState.endShrine();
      if (!result) return res.status(400).json({ error: 'No shrine active' });
      res.json({ ...result, state: gameState.getPublicState() });
    });

    app.post('/api/teleport', (req, res) => {
      const result = gameState.useTicket();
      if (!result) return res.status(400).json({ error: 'No tickets left' });
      res.json({ ...result, state: gameState.getPublicState() });
    });

    app.post('/api/gameover', (req, res) => {
      const result = gameState.triggerGameOver();
      res.json({ ...result, state: gameState.getPublicState() });
    });

    app.post('/api/levelup/choose/:upgradeId', (req, res) => {
      const result = gameState.chooseLevelUpUpgrade(req.params.upgradeId);
      if (!result) return res.status(400).json({ error: 'Invalid upgrade choice' });
      res.json({ ...result, state: gameState.getPublicState() });
    });

    app.post('/api/gameover/choose/:upgradeId', (req, res) => {
      const result = gameState.chooseGameOverRemoval(req.params.upgradeId);
      if (!result) return res.status(400).json({ error: 'Invalid upgrade choice' });
      res.json({ ...result, state: gameState.getPublicState() });
    });

    app.post('/api/run/reset', (req, res) => {
      gameState.resetRun();
      res.json({ state: gameState.getPublicState() });
    });

    app.get('/api/state', (req, res) => {
      res.json(gameState.getPublicState());
    });

    // --- Conquest: Region Definitions ---

    app.get('/api/regions', (req, res) => {
      res.json({ regions: conquest.getRegions(), shrines: conquest.getShrines(), towers: conquest.getTowers() });
    });

    app.post('/api/regions', (req, res) => {
      const { name, centerX, centerZ } = req.body;
      if (!name || centerX === undefined || centerZ === undefined)
        return res.status(400).json({ error: 'name, centerX, centerZ required' });
      const region = conquest.createRegion(name, Number(centerX), Number(centerZ));
      io.emit('conquest:regionCreated', region);
      res.json({ region, conquestState: conquest.getState() });
    });

    app.put('/api/regions/:id', (req, res) => {
      const region = conquest.updateRegion(req.params.id, req.body);
      if (!region) return res.status(404).json({ error: 'Region not found' });
      io.emit('conquest:regionUpdated', region);
      res.json({ region });
    });

    app.delete('/api/regions/:id', (req, res) => {
      conquest.deleteRegion(req.params.id);
      io.emit('conquest:regionDeleted', { regionId: req.params.id });
      res.json({ ok: true });
    });

    // --- Conquest: Run Actions ---

    app.post('/api/conquest/activate/:id', (req, res) => {
      const state = conquest.activateRegion(req.params.id);
      if (!state) return res.status(404).json({ error: 'Region not found' });
      io.emit('conquest:activated', { regionId: req.params.id, roll: state.roll, progress: state.progress });
      res.json({ conquestState: conquest.getState() });
    });

    app.post('/api/conquest/deactivate', (req, res) => {
      conquest.deactivateRegion();
      io.emit('conquest:deactivated', {});
      res.json({ conquestState: conquest.getState() });
    });

    app.post('/api/conquest/shrine/:shrineId', (req, res) => {
      const result = conquest.completeShrineDirect(req.params.shrineId);
      if (!result) return res.status(400).json({ error: 'Shrine not completable (not in active region or already done)' });
      if (result.xpBonus > 0) {
        // Award conquest XP
        gameState.awardConquestXp(result.xpBonus);
      }
      res.json({ result, conquestState: conquest.getState() });
    });

    app.post('/api/conquest/tower', (req, res) => {
      const result = conquest.completeTower();
      if (!result) return res.status(400).json({ error: 'Tower not completable' });
      res.json({ result, conquestState: conquest.getState() });
    });

    httpServer.listen(port, () => {
      console.log(`Zelda RPG Tracker running on http://localhost:${port}`);
      resolve();
    });
  });
}

module.exports = { startServer };
