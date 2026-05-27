export const webHtml = String.raw`<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>TwynIX OPC UA Simulator</title>
  <style>
    :root { color-scheme: light; font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif; }
    body { margin: 0; background: #f6f7f9; color: #172026; }
    header { background: #172026; color: #fff; padding: 18px 28px; display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    h1 { margin: 0; font-size: 22px; letter-spacing: 0; }
    main { max-width: 1240px; margin: 0 auto; padding: 24px; display: grid; gap: 18px; }
    section { background: #fff; border: 1px solid #d9dee5; border-radius: 8px; padding: 18px; }
    h2 { margin: 0 0 14px; font-size: 16px; }
    .grid { display: grid; gap: 14px; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); }
    label { display: grid; gap: 6px; font-size: 13px; color: #4b5863; }
    input, select, textarea { border: 1px solid #b8c1cc; border-radius: 6px; padding: 9px 10px; font: inherit; background: #fff; color: #172026; }
    textarea { min-height: 280px; font-family: ui-monospace, SFMono-Regular, Menlo, Consolas, monospace; font-size: 12px; }
    button { border: 1px solid #172026; border-radius: 6px; padding: 9px 12px; background: #172026; color: #fff; font: inherit; cursor: pointer; }
    button.secondary { background: #fff; color: #172026; }
    button.warn { background: #a33a2a; border-color: #a33a2a; }
    .actions { display: flex; flex-wrap: wrap; gap: 10px; align-items: center; }
    .stats { display: grid; gap: 10px; grid-template-columns: repeat(auto-fit, minmax(150px, 1fr)); }
    .stat { border: 1px solid #d9dee5; border-radius: 8px; padding: 12px; }
    .stat strong { display: block; font-size: 22px; margin-top: 4px; }
    .split { display: grid; gap: 18px; grid-template-columns: minmax(280px, 420px) 1fr; }
    table { width: 100%; border-collapse: collapse; font-size: 13px; }
    th, td { border-bottom: 1px solid #e8ebef; padding: 8px; text-align: left; }
    th { color: #4b5863; font-weight: 600; }
    tr { cursor: pointer; }
    tr:hover { background: #f1f4f7; }
    .status { font-size: 13px; color: #4b5863; }
    @media (max-width: 820px) { header { align-items: flex-start; flex-direction: column; } .split { grid-template-columns: 1fr; } main { padding: 14px; } }
  </style>
</head>
<body>
  <header>
    <h1>TwynIX OPC UA Simulator</h1>
    <div class="status" id="endpoint">Loading endpoint...</div>
  </header>
  <main>
    <section>
      <h2>Runtime</h2>
      <div class="actions">
        <button id="start">Start</button>
        <button class="secondary" id="restart">Restart</button>
        <button class="warn" id="stop">Stop</button>
        <button class="secondary" id="export">Export JSON</button>
        <input id="importFile" type="file" accept="application/json">
      </div>
    </section>

    <section>
      <h2>Status</h2>
      <div class="stats">
        <div class="stat">Tags<strong id="tagCount">0</strong></div>
        <div class="stat">Running<strong id="running">false</strong></div>
        <div class="stat">Update ms<strong id="updateDuration">0</strong></div>
        <div class="stat">Clients<strong id="clients">0</strong></div>
        <div class="stat">Uptime s<strong id="uptime">0</strong></div>
      </div>
    </section>

    <section>
      <h2>Configuration</h2>
      <div class="grid">
        <label>Areas<input id="areas" type="number" min="1"></label>
        <label>Lines per area<input id="linesPerArea" type="number" min="1"></label>
        <label>Machines per line<input id="machinesPerLine" type="number" min="1"></label>
        <label>Tags per machine<input id="tagsPerMachine" type="number" min="1" max="20"></label>
        <label>Update interval ms<input id="updateIntervalMs" type="number" min="100"></label>
        <label>Seed<input id="seed" type="number"></label>
        <label>OPC UA port<input id="opcPort" type="number" min="1" max="65535"></label>
        <label>Fault mode<select id="faultMode"><option value="false">Disabled</option><option value="true">Enabled</option></select></label>
      </div>
      <div class="actions" style="margin-top:14px">
        <button id="saveConfig">Save Configuration</button>
      </div>
    </section>

    <section class="split">
      <div>
        <h2>Live Tags</h2>
        <table>
          <thead><tr><th>Name</th><th>Value</th><th>Alarm</th></tr></thead>
          <tbody id="tagRows"></tbody>
        </table>
      </div>
      <div>
        <h2>Selected Tag</h2>
        <textarea id="selectedTag" spellcheck="false"></textarea>
      </div>
    </section>
  </main>

  <script>
    let config = null;
    let selectedTagId = null;

    const $ = (id) => document.getElementById(id);

    async function api(path, options = {}) {
      const response = await fetch('/api' + path, {
        headers: { 'Content-Type': 'application/json', ...(options.headers || {}) },
        ...options
      });
      if (!response.ok) throw new Error(await response.text());
      return response.json();
    }

    async function loadConfig() {
      config = await api('/config');
      $('areas').value = config.topology.areas;
      $('linesPerArea').value = config.topology.linesPerArea;
      $('machinesPerLine').value = config.topology.machinesPerLine;
      $('tagsPerMachine').value = config.topology.tagsPerMachine;
      $('updateIntervalMs').value = config.updateIntervalMs;
      $('seed').value = config.seed;
      $('opcPort').value = config.opcua.port;
      $('faultMode').value = String(config.faultMode);
    }

    async function refreshStatus() {
      const status = await api('/status');
      $('endpoint').textContent = status.endpointUrl;
      $('tagCount').textContent = status.metrics.tagCount;
      $('running').textContent = status.metrics.running;
      $('updateDuration').textContent = status.metrics.updateDurationMs;
      $('clients').textContent = status.metrics.connectedOpcUaClients;
      $('uptime').textContent = status.metrics.serverUptimeSeconds;
    }

    async function refreshTags() {
      const tags = await api('/tags');
      const rows = tags.slice(0, 50).map(tag => {
        const value = typeof tag.value === 'number' ? tag.value.toFixed(tag.dataType === 'Int32' ? 0 : 3) : tag.value;
        return '<tr data-id="' + tag.id + '"><td>' + tag.browsePath.join(' / ') + ' / ' + tag.name + '</td><td>' + value + '</td><td>' + (tag.alarm.active ? tag.alarm.severity : '') + '</td></tr>';
      }).join('');
      $('tagRows').innerHTML = rows;
      document.querySelectorAll('tr[data-id]').forEach(row => row.onclick = () => selectTag(row.dataset.id));
      if (selectedTagId) await selectTag(selectedTagId);
    }

    async function selectTag(id) {
      selectedTagId = id;
      const tag = await api('/tags/' + encodeURIComponent(id));
      $('selectedTag').value = JSON.stringify(tag, null, 2);
    }

    async function saveConfig() {
      const updated = {
        ...config,
        updateIntervalMs: Number($('updateIntervalMs').value),
        seed: Number($('seed').value),
        faultMode: $('faultMode').value === 'true',
        opcua: { ...config.opcua, port: Number($('opcPort').value) },
        topology: {
          ...config.topology,
          areas: Number($('areas').value),
          linesPerArea: Number($('linesPerArea').value),
          machinesPerLine: Number($('machinesPerLine').value),
          tagsPerMachine: Number($('tagsPerMachine').value)
        },
        tags: undefined
      };
      config = await api('/config', { method: 'PUT', body: JSON.stringify(updated) });
      await refreshStatus();
      await refreshTags();
    }

    $('start').onclick = async () => { await api('/simulator/start', { method: 'POST' }); await refreshStatus(); };
    $('stop').onclick = async () => { await api('/simulator/stop', { method: 'POST' }); await refreshStatus(); };
    $('restart').onclick = async () => { await api('/simulator/restart', { method: 'POST' }); await refreshStatus(); };
    $('saveConfig').onclick = saveConfig;
    $('export').onclick = async () => {
      const exported = await api('/config/export', { method: 'POST' });
      const blob = new Blob([JSON.stringify(exported, null, 2)], { type: 'application/json' });
      const a = document.createElement('a');
      a.href = URL.createObjectURL(blob);
      a.download = 'twynix-config.json';
      a.click();
      URL.revokeObjectURL(a.href);
    };
    $('importFile').onchange = async (event) => {
      const file = event.target.files[0];
      if (!file) return;
      const imported = JSON.parse(await file.text());
      config = await api('/config/import', { method: 'POST', body: JSON.stringify(imported) });
      await loadConfig();
      await refreshStatus();
      await refreshTags();
    };

    loadConfig().then(() => Promise.all([refreshStatus(), refreshTags()]));
    setInterval(() => { refreshStatus(); refreshTags(); }, 1000);
  </script>
</body>
</html>`;
