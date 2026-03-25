// ===== Hyrule Conquest Map =====
// Koordinaten-Formel (aus zelda2/totk-postman):
//   canvasX = ((gameX + 6000) / 12000) * canvasWidth
//   canvasY = ((gameZ + 5000) / 10000) * canvasHeight

(function () {
  const MAP_MIN_X = -6000, MAP_MAX_X = 6000;
  const MAP_MIN_Z = -5000, MAP_MAX_Z = 5000;

  const canvas = document.getElementById('map-canvas');
  const ctx = canvas.getContext('2d');
  const mapWrap = document.getElementById('map-canvas-wrap');

  // Icons
  const shrineIcon = new Image();
  shrineIcon.onload = () => render();
  shrineIcon.src = '/ui/assets/shrine.svg';
  const towerIcon = new Image();
  towerIcon.onload = () => render();
  towerIcon.src = '/ui/assets/tower.svg';

  // State
  let mapImage = null;
  let shrines = [];
  let towers = [];
  let regions = [];
  let conquestState = { activeRegionId: null, regions: {} };
  let editMode = false;
  let pendingPlacement = null; // { gameX, gameZ } while waiting for name input

  // ===== Koordinaten =====
  function toCanvas(gameX, gameZ) {
    const w = canvas.width, h = canvas.height;
    return {
      x: ((gameX - MAP_MIN_X) / (MAP_MAX_X - MAP_MIN_X)) * w,
      y: ((gameZ - MAP_MIN_Z) / (MAP_MAX_Z - MAP_MIN_Z)) * h
    };
  }

  function toGame(canvasX, canvasY) {
    const w = canvas.width, h = canvas.height;
    return {
      gameX: ((canvasX / w) * (MAP_MAX_X - MAP_MIN_X)) + MAP_MIN_X,
      gameZ: ((canvasY / h) * (MAP_MAX_Z - MAP_MIN_Z)) + MAP_MIN_Z
    };
  }

  // ===== Canvas-Größe =====
  function resizeCanvas() {
    const rect = mapWrap.getBoundingClientRect();
    // Abzug der Controls-Zeile
    const controlsH = document.getElementById('map-controls').offsetHeight || 36;
    canvas.width = rect.width;
    canvas.height = rect.height - controlsH;
    render();
  }

  // ===== Render =====
  function render() {
    if (!canvas.width || !canvas.height) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    if (mapImage) {
      ctx.drawImage(mapImage, 0, 0, canvas.width, canvas.height);
    } else {
      ctx.fillStyle = '#0a0a18';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    const activeId = conquestState.activeRegionId;
    const activeState = activeId ? conquestState.regions[activeId] : null;

    drawShrines(activeState);
    drawTowers(activeState);
    drawRegions(activeId);

    if (pendingPlacement) {
      const p = toCanvas(pendingPlacement.gameX, pendingPlacement.gameZ);
      ctx.beginPath();
      ctx.arc(p.x, p.y, 8, 0, Math.PI * 2);
      ctx.fillStyle = 'rgba(240,192,64,0.6)';
      ctx.fill();
      ctx.strokeStyle = '#f0c040';
      ctx.lineWidth = 2;
      ctx.stroke();
    }
  }

  function drawShrines(activeState) {
    const roll = activeState?.roll;
    const done = activeState?.progress?.shrinesDone || [];

    for (const shrine of shrines) {
      const p = toCanvas(shrine.x, shrine.z);
      const isTarget = roll?.shrineIds?.includes(shrine.id);
      const isDone = done.includes(shrine.id);

      let size, alpha, tint;
      if (isDone) {
        size = 24; alpha = 1; tint = '#44ff88';
      } else if (isTarget) {
        size = 26; alpha = 1; tint = '#f0c040';
      } else {
        size = 18; alpha = 0.45; tint = null;
      }

      ctx.globalAlpha = alpha;

      if (shrineIcon.complete && shrineIcon.naturalWidth > 0) {
        // Icon mit Farb-Overlay via compositing
        ctx.drawImage(shrineIcon, p.x - size / 2, p.y - size / 2, size, size);

        if (tint) {
          ctx.globalCompositeOperation = 'source-atop';
          ctx.fillStyle = tint;
          ctx.globalAlpha = 0.55;
          ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
          ctx.globalCompositeOperation = 'source-over';
        }
      } else {
        // Fallback: Dreieck
        ctx.beginPath();
        ctx.moveTo(p.x, p.y - size / 2);
        ctx.lineTo(p.x + size * 0.45, p.y + size * 0.4);
        ctx.lineTo(p.x - size * 0.45, p.y + size * 0.4);
        ctx.closePath();
        ctx.fillStyle = tint || '#4a4a6a';
        ctx.fill();
      }

      // Highlight-Ring bei aktivem Ziel
      if (isTarget && !isDone) {
        ctx.globalAlpha = 0.8;
        ctx.globalCompositeOperation = 'source-over';
        ctx.beginPath();
        ctx.arc(p.x, p.y, size / 2 + 3, 0, Math.PI * 2);
        ctx.strokeStyle = tint;
        ctx.lineWidth = 1.5;
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  function drawTowers(activeState) {
    const roll = activeState?.roll;
    const towerDone = activeState?.progress?.towerDone;

    for (const tower of towers) {
      const p = toCanvas(tower.x, tower.z);
      const isTarget = roll?.towerId === tower.id;
      const isDone = towerDone && isTarget;

      let size, alpha, tint;
      if (isDone) {
        size = 26; alpha = 1; tint = '#44ff88';
      } else if (isTarget) {
        size = 28; alpha = 1; tint = '#88aaff';
      } else {
        size = 20; alpha = 0.4; tint = null;
      }

      ctx.globalAlpha = alpha;

      if (towerIcon.complete && towerIcon.naturalWidth > 0) {
        ctx.drawImage(towerIcon, p.x - size / 2, p.y - size / 2, size, size);

        if (tint) {
          ctx.globalCompositeOperation = 'source-atop';
          ctx.fillStyle = tint;
          ctx.globalAlpha = 0.6;
          ctx.fillRect(p.x - size / 2, p.y - size / 2, size, size);
          ctx.globalCompositeOperation = 'source-over';
        }
      } else {
        // Fallback
        ctx.beginPath();
        ctx.arc(p.x, p.y, size / 2, 0, Math.PI * 2);
        ctx.strokeStyle = tint || '#2a2a5a';
        ctx.lineWidth = isTarget ? 2 : 1;
        ctx.stroke();
      }

      if (isTarget && !isDone) {
        ctx.globalAlpha = 0.8;
        ctx.globalCompositeOperation = 'source-over';
        ctx.beginPath();
        ctx.arc(p.x, p.y, size / 2 + 4, 0, Math.PI * 2);
        ctx.strokeStyle = tint;
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      ctx.globalAlpha = 1;
      ctx.globalCompositeOperation = 'source-over';
    }
  }

  function drawRegions(activeId) {
    for (const region of regions) {
      const p = toCanvas(region.centerX, region.centerZ);
      const isActive = region.id === activeId;
      const rState = conquestState.regions[region.id];
      const isConquered = rState?.conquered;

      // Halo
      if (isActive) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, 18, 0, Math.PI * 2);
        ctx.fillStyle = 'rgba(240,192,64,0.12)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(240,192,64,0.5)';
        ctx.lineWidth = 2;
        ctx.stroke();
      }

      // Marker
      const markerSize = 10;
      ctx.beginPath();
      ctx.arc(p.x, p.y, markerSize / 2, 0, Math.PI * 2);
      ctx.fillStyle = isConquered ? '#44ff88' : isActive ? '#f0c040' : '#aaaacc';
      ctx.fill();

      // Name-Label
      const labelText = (isConquered ? '✓ ' : '') + region.name;
      ctx.font = `bold ${isActive ? 13 : 11}px sans-serif`;
      ctx.textAlign = 'center';

      // Shadow
      ctx.fillStyle = 'rgba(0,0,0,0.8)';
      ctx.fillText(labelText, p.x + 1, p.y - markerSize - 4);
      ctx.fillText(labelText, p.x - 1, p.y - markerSize - 4);
      ctx.fillText(labelText, p.x, p.y - markerSize - 3);
      ctx.fillText(labelText, p.x, p.y - markerSize - 5);

      ctx.fillStyle = isConquered ? '#44ff88' : isActive ? '#f0c040' : '#ccccee';
      ctx.fillText(labelText, p.x, p.y - markerSize - 4);
      ctx.textAlign = 'left';
    }
  }

  // ===== Click-Handler =====
  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const cx = (e.clientX - rect.left) * (canvas.width / rect.width);
    const cy = (e.clientY - rect.top) * (canvas.height / rect.height);
    const { gameX, gameZ } = toGame(cx, cy);

    if (editMode) {
      handleEditClick(gameX, gameZ);
    } else {
      handlePlayClick(cx, cy, gameX, gameZ);
    }
  });

  function handleEditClick(gameX, gameZ) {
    pendingPlacement = { gameX, gameZ };
    render();
    const popup = document.getElementById('edit-name-popup');
    const input = document.getElementById('edit-name-input');
    popup.style.display = 'flex';
    input.value = '';
    input.focus();
  }

  function handlePlayClick(cx, cy, gameX, gameZ) {
    const HIT_RADIUS_PX = 14;

    // Prüfe Schrein-Klick (nur Ziel-Schreine)
    const activeId = conquestState.activeRegionId;
    const activeState = activeId ? conquestState.regions[activeId] : null;
    const roll = activeState?.roll;
    const done = activeState?.progress?.shrinesDone || [];

    if (roll) {
      for (const shrine of shrines) {
        if (!roll.shrineIds.includes(shrine.id)) continue;
        if (done.includes(shrine.id)) continue;
        const p = toCanvas(shrine.x, shrine.z);
        const d = Math.hypot(p.x - cx, p.y - cy);
        if (d < HIT_RADIUS_PX) {
          completeShrineOnMap(shrine.id);
          return;
        }
      }

      // Turm-Klick
      if (!activeState.progress.towerDone) {
        const targetTower = towers.find(t => t.id === roll.towerId);
        if (targetTower) {
          const p = toCanvas(targetTower.x, targetTower.z);
          const d = Math.hypot(p.x - cx, p.y - cy);
          if (d < HIT_RADIUS_PX) {
            completeTowerOnMap();
            return;
          }
        }
      }
    }

    // Region-Klick (zum Aktivieren)
    for (const region of regions) {
      const p = toCanvas(region.centerX, region.centerZ);
      const d = Math.hypot(p.x - cx, p.y - cy);
      if (d < 20) {
        activateRegion(region.id);
        return;
      }
    }
  }

  // ===== API Calls =====
  function completeShrineOnMap(shrineId) {
    fetch(`/api/conquest/shrine/${shrineId}`, { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        if (data.conquestState) {
          conquestState = data.conquestState;
          render();
          updateConquestPanel();
        }
      });
  }

  function completeTowerOnMap() {
    fetch('/api/conquest/tower', { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        if (data.conquestState) {
          conquestState = data.conquestState;
          render();
          updateConquestPanel();
        }
      });
  }

  function activateRegion(id) {
    fetch(`/api/conquest/activate/${id}`, { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        if (data.conquestState) {
          conquestState = data.conquestState;
          render();
          updateConquestPanel();
          updateActiveLabel();
        }
      });
  }

  function deactivateRegion() {
    fetch('/api/conquest/deactivate', { method: 'POST' })
      .then(r => r.json())
      .then(data => {
        if (data.conquestState) {
          conquestState = data.conquestState;
          render();
          updateConquestPanel();
          updateActiveLabel();
        }
      });
  }

  function createRegion(name, centerX, centerZ) {
    fetch('/api/regions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, centerX, centerZ })
    })
      .then(r => r.json())
      .then(data => {
        if (data.region) {
          regions.push(data.region);
          if (data.conquestState) conquestState = data.conquestState;
          render();
          updateRegionList();
        }
      });
  }

  function deleteRegion(id) {
    fetch(`/api/regions/${id}`, { method: 'DELETE' })
      .then(() => {
        regions = regions.filter(r => r.id !== id);
        if (conquestState.activeRegionId === id) conquestState.activeRegionId = null;
        delete conquestState.regions[id];
        render();
        updateConquestPanel();
        updateRegionList();
        updateActiveLabel();
      });
  }

  // ===== Edit Mode =====
  document.getElementById('btn-edit-mode').addEventListener('click', () => {
    editMode = !editMode;
    const btn = document.getElementById('btn-edit-mode');
    const regionList = document.getElementById('conquest-region-list');
    const regionInfo = document.getElementById('conquest-region-info');
    const noRegion = document.getElementById('conquest-no-region');

    btn.classList.toggle('active-edit', editMode);
    btn.textContent = editMode ? '✓ Fertig' : '✏ Gebiete bearbeiten';
    canvas.style.cursor = editMode ? 'crosshair' : 'default';

    if (editMode) {
      regionList.style.display = 'flex';
      regionInfo.style.display = 'none';
      noRegion.style.display = 'none';
      updateRegionList();
    } else {
      regionList.style.display = 'none';
      pendingPlacement = null;
      document.getElementById('edit-name-popup').style.display = 'none';
      updateConquestPanel();
    }
    render();
  });

  document.getElementById('edit-name-confirm').addEventListener('click', () => {
    const name = document.getElementById('edit-name-input').value.trim();
    if (!name || !pendingPlacement) return;
    createRegion(name, pendingPlacement.gameX, pendingPlacement.gameZ);
    pendingPlacement = null;
    document.getElementById('edit-name-popup').style.display = 'none';
    render();
  });

  document.getElementById('edit-name-cancel').addEventListener('click', () => {
    pendingPlacement = null;
    document.getElementById('edit-name-popup').style.display = 'none';
    render();
  });

  document.getElementById('edit-name-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('edit-name-confirm').click();
    if (e.key === 'Escape') document.getElementById('edit-name-cancel').click();
  });

  // Rename
  let renamingRegionId = null;

  function openRenamePopup(regionId, currentName) {
    renamingRegionId = regionId;
    document.getElementById('rename-input').value = currentName;
    document.getElementById('rename-popup').style.display = 'flex';
    document.getElementById('rename-input').focus();
    document.getElementById('rename-input').select();
  }

  document.getElementById('rename-confirm').addEventListener('click', () => {
    const name = document.getElementById('rename-input').value.trim();
    if (!name || !renamingRegionId) return;
    fetch(`/api/regions/${renamingRegionId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    }).then(r => r.json()).then(data => {
      if (data.region) {
        const idx = regions.findIndex(r => r.id === data.region.id);
        if (idx !== -1) regions[idx] = data.region;
      }
      render();
      updateRegionList();
      updateActiveLabel();
    });
    document.getElementById('rename-popup').style.display = 'none';
    renamingRegionId = null;
  });

  document.getElementById('rename-cancel').addEventListener('click', () => {
    document.getElementById('rename-popup').style.display = 'none';
    renamingRegionId = null;
  });

  document.getElementById('rename-input').addEventListener('keydown', (e) => {
    if (e.key === 'Enter') document.getElementById('rename-confirm').click();
    if (e.key === 'Escape') document.getElementById('rename-cancel').click();
  });

  document.getElementById('btn-deactivate').addEventListener('click', deactivateRegion);

  // ===== UI Updates =====
  function updateActiveLabel() {
    const label = document.getElementById('map-active-label');
    const deactivateBtn = document.getElementById('btn-deactivate');
    const activeId = conquestState.activeRegionId;
    const region = activeId ? regions.find(r => r.id === activeId) : null;

    if (region) {
      label.textContent = `Aktiv: ${region.name}`;
      deactivateBtn.style.display = '';
    } else {
      label.textContent = 'Kein aktives Gebiet';
      deactivateBtn.style.display = 'none';
    }
  }

  function updateConquestPanel() {
    if (editMode) return;
    const activeId = conquestState.activeRegionId;
    const noRegion = document.getElementById('conquest-no-region');
    const regionInfo = document.getElementById('conquest-region-info');

    if (!activeId) {
      noRegion.style.display = '';
      regionInfo.style.display = 'none';
      return;
    }

    const region = regions.find(r => r.id === activeId);
    const rState = conquestState.regions[activeId];
    if (!region || !rState) return;

    noRegion.style.display = 'none';
    regionInfo.style.display = 'flex';

    document.getElementById('conquest-region-name').textContent = region.name;

    const statusEl = document.getElementById('conquest-region-status');
    if (rState.conquered) {
      statusEl.textContent = '★ Befreit';
      statusEl.className = 'conquered';
    } else {
      statusEl.textContent = 'In Arbeit';
      statusEl.className = '';
    }

    // Schreine
    const shrinesList = document.getElementById('conquest-shrines-list');
    shrinesList.innerHTML = '';
    for (const sid of (rState.roll?.shrineIds || [])) {
      const shrine = shrines.find(s => s.id === sid);
      const isDone = rState.progress?.shrinesDone?.includes(sid);
      const el = document.createElement('div');
      el.className = 'conquest-item' + (isDone ? ' done' : ' clickable');
      el.textContent = shrine?.name || sid;
      if (!isDone) {
        el.title = 'Klick auf Karte oder hier';
        el.addEventListener('click', () => completeShrineOnMap(sid));
      }
      shrinesList.appendChild(el);
    }

    // Kills
    const killsList = document.getElementById('conquest-kills-list');
    killsList.innerHTML = '';
    const TIER_LABELS = { klein: 'Schwach', normal: 'Normal', stark: 'Stark', miniboss: 'Miniboss', boss: 'Boss' };
    for (const [tier, req] of Object.entries(rState.roll?.killRequirements || {})) {
      const done = rState.progress?.killsDone?.[tier] || 0;
      const isDone = done >= req;
      const el = document.createElement('div');
      el.className = 'conquest-item' + (isDone ? ' done' : '');
      el.textContent = `${TIER_LABELS[tier] || tier}: ${done} / ${req}`;
      killsList.appendChild(el);
    }

    // Turm
    const towerEl = document.getElementById('conquest-tower-status');
    const towerDone = rState.progress?.towerDone;
    const targetTower = towers.find(t => t.id === rState.roll?.towerId);
    towerEl.innerHTML = '';
    const tel = document.createElement('div');
    tel.className = 'conquest-item' + (towerDone ? ' done' : ' clickable');
    tel.textContent = targetTower?.name || 'Skyview Tower';
    if (!towerDone) tel.addEventListener('click', completeTowerOnMap);
    towerEl.appendChild(tel);

    // Koroks
    const krogEl = document.getElementById('conquest-krogs-status');
    const krogsDone = rState.progress?.koroksDone || 0;
    const krogsReq = rState.roll?.korokRequired || 0;
    const krogsDoneAll = krogsDone >= krogsReq;
    krogEl.innerHTML = '';
    const kel = document.createElement('div');
    kel.className = 'conquest-item' + (krogsDoneAll ? ' done' : '');
    kel.textContent = `${krogsDone} / ${krogsReq} Koroks gefunden`;
    krogEl.appendChild(kel);
  }

  function updateRegionList() {
    const list = document.getElementById('region-list-items');
    list.innerHTML = '';
    if (regions.length === 0) {
      list.innerHTML = '<div style="font-size:11px;color:#444;padding:4px">Noch keine Gebiete definiert.<br>Klick auf die Karte zum Erstellen.</div>';
      return;
    }
    for (const region of regions) {
      const item = document.createElement('div');
      item.className = 'region-list-item';

      const nameSpan = document.createElement('span');
      nameSpan.textContent = region.name;
      nameSpan.style.flex = '1';
      item.appendChild(nameSpan);

      const renameBtn = document.createElement('button');
      renameBtn.className = 'region-rename-btn';
      renameBtn.textContent = '✎';
      renameBtn.title = 'Umbenennen';
      renameBtn.addEventListener('click', () => openRenamePopup(region.id, region.name));
      item.appendChild(renameBtn);

      const del = document.createElement('button');
      del.className = 'region-delete-btn';
      del.textContent = '✕';
      del.title = 'Region löschen';
      del.addEventListener('click', () => {
        if (confirm(`Region "${region.name}" löschen?`)) deleteRegion(region.id);
      });
      item.appendChild(del);

      list.appendChild(item);
    }
  }

  // ===== Socket.io Events =====
  function initSocketEvents(socket) {
    socket.on('conquest:progressUpdate', ({ regionId, progress, conquered }) => {
      if (conquestState.regions[regionId]) {
        conquestState.regions[regionId].progress = progress;
        conquestState.regions[regionId].conquered = conquered;
      }
      render();
      updateConquestPanel();
    });

    socket.on('conquest:regionConquered', ({ regionId, name, xpBonus }) => {
      if (conquestState.regions[regionId]) {
        conquestState.regions[regionId].conquered = true;
      }
      render();
      updateConquestPanel();
      // Flash conquered panel
      const panel = document.getElementById('conquest-panel');
      panel.classList.remove('conquered-flash');
      void panel.offsetWidth;
      panel.classList.add('conquered-flash');
    });

    socket.on('conquest:activated', ({ regionId, roll, progress }) => {
      conquestState.activeRegionId = regionId;
      if (conquestState.regions[regionId]) {
        conquestState.regions[regionId].roll = roll;
        conquestState.regions[regionId].progress = progress;
      }
      render();
      updateConquestPanel();
      updateActiveLabel();
    });

    socket.on('conquest:deactivated', () => {
      conquestState.activeRegionId = null;
      render();
      updateConquestPanel();
      updateActiveLabel();
    });

    socket.on('conquest:regionCreated', (region) => {
      if (!regions.find(r => r.id === region.id)) regions.push(region);
      render();
      updateRegionList();
    });

    socket.on('conquest:regionDeleted', ({ regionId }) => {
      regions = regions.filter(r => r.id !== regionId);
      delete conquestState.regions[regionId];
      if (conquestState.activeRegionId === regionId) conquestState.activeRegionId = null;
      render();
      updateConquestPanel();
      updateRegionList();
      updateActiveLabel();
    });
  }

  // ===== Init =====
  function loadMapData() {
    fetch('/api/regions')
      .then(r => r.json())
      .then(data => {
        shrines = data.shrines || [];
        towers = data.towers || [];
        regions = data.regions || [];
        render();
        updateRegionList();
      });
  }

  function setConquestState(state) {
    if (!state) return;
    conquestState = state;
    render();
    updateConquestPanel();
    updateActiveLabel();
  }

  // Karte laden
  mapImage = new Image();
  mapImage.onload = () => {
    resizeCanvas();
    render();
  };
  mapImage.onerror = () => {
    render(); // Render ohne Karte
  };
  mapImage.src = '/ui/assets/map-background.webp';

  // Resize
  window.addEventListener('resize', resizeCanvas);
  const resizeObserver = new ResizeObserver(resizeCanvas);
  resizeObserver.observe(mapWrap);

  // Tab-Wechsel: Re-render beim Aktivieren
  document.querySelectorAll('.tab-btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
      document.querySelectorAll('.tab-content').forEach(c => c.classList.remove('active'));
      btn.classList.add('active');
      document.getElementById(`tab-${btn.dataset.tab}`).classList.add('active');
      if (btn.dataset.tab === 'map') {
        setTimeout(resizeCanvas, 10);
      }
    });
  });

  // Expose for renderer.js
  window.mapModule = {
    setConquestState,
    initSocketEvents,
    loadMapData
  };
})();
