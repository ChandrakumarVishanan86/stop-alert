/* Stop Alert - front-end logic
   Real GPS tracking + demo ride simulation, Leaflet map, alarm (sound + vibration). */
(() => {
'use strict';

const API = 'api.php';
const BASE_MPS = 40 / 3.6;                       // demo bus speed: 40 km/h
const DIST_OPTIONS = [500, 1000, 2000, 3000, 5000];
const SPEEDS = [{ k: 40, label: 'Slow' }, { k: 100, label: 'Normal' }, { k: 250, label: 'Fast' }];

const $ = (s, el = document) => el.querySelector(s);
const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) =>
  ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

const S = {
  routes: [], stops: [], route: null, dest: null,
  alertM: 1000, mode: 'live', speed: 100,
  tracking: false, tripId: null, watchId: null, simTimer: null, sim: null, wake: null,
  d0: null, firstFix: true, pos: null,
  alarmOn: false, alarmDone: false, alarmTest: false, sirenTimer: null, vibTimer: null,
};

/* ---------- device id (no login needed) ---------- */
let deviceId = '';
try { deviceId = localStorage.getItem('sa_device') || ''; } catch (e) {}
if (!deviceId) {
  deviceId = 'dev-' + Math.random().toString(36).slice(2, 10) + Date.now().toString(36);
  try { localStorage.setItem('sa_device', deviceId); } catch (e) {}
}

/* ---------- helpers ---------- */
function haversine(a, b) {
  const R = 6371000, r = Math.PI / 180;
  const dLat = (b.lat - a.lat) * r, dLng = (b.lng - a.lng) * r;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * r) * Math.cos(b.lat * r) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(x));
}
function fmtDist(m) {
  if (m >= 10000) return Math.round(m / 1000) + ' km';
  if (m >= 1000) return (m / 1000).toFixed(1) + ' km';
  return Math.round(m) + ' m';
}
function fmtEta(sec) {
  if (sec == null) return 'ETA --';
  const min = Math.round(sec / 60);
  if (min < 1) return 'ETA under 1 min';
  if (min < 60) return 'ETA ' + min + ' min';
  return 'ETA ' + Math.floor(min / 60) + ' h ' + (min % 60) + ' min';
}
let toastT;
function toast(msg) {
  const t = $('#toast');
  t.textContent = msg; t.hidden = false;
  clearTimeout(toastT);
  toastT = setTimeout(() => { t.hidden = true; }, 4000);
}
async function api(action, { method = 'GET', params = {}, body } = {}) {
  const qs = new URLSearchParams({ action, ...params });
  const res = await fetch(`${API}?${qs}`, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : {},
    body: body ? JSON.stringify(body) : undefined,
  });
  let data = null;
  try { data = await res.json(); } catch (e) {}
  if (!res.ok || data === null) throw new Error((data && data.error) || ('Server error (' + res.status + ')'));
  return data;
}

/* ---------- map ---------- */
const hasMap = typeof L !== 'undefined';
let map, overview, layers, trail, destCircle, userMarker, tileDark, tileLight, tileMode = 'dark';
const markers = {};
const mkIcon = (cls, size) => L.divIcon({
  className: '', html: `<div class="mk ${cls}"></div>`, iconSize: [size, size], iconAnchor: [size / 2, size / 2],
});

if (hasMap) {
  map = L.map('map', { zoomControl: false, minZoom: 6 }).setView([7.8731, 80.7718], 7);   // Sri Lanka
  L.control.zoom({ position: 'bottomright' }).addTo(map);
  const attr = '&copy; OpenStreetMap contributors &copy; CARTO';
  tileDark = L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png',
    { attribution: attr, subdomains: 'abcd', maxZoom: 19 }).addTo(map);
  tileLight = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/voyager/{z}/{x}/{y}{r}.png',
    { attribution: attr, subdomains: 'abcd', maxZoom: 19 });
  overview = L.layerGroup().addTo(map);
  layers = L.layerGroup().addTo(map);
  trail = L.polyline([], { color: '#4da3ff', weight: 5, opacity: 0.9 }).addTo(map);
} else {
  $('#map').innerHTML = '<div class="nomap">Map load aagala. Internet connection check pannunga (Leaflet + OpenStreetMap map internet la irundhu varum).</div>';
}

function drawOverview() {
  if (!hasMap) return;
  overview.clearLayers();
  const seen = new Set();
  S.routes.forEach((r) => {
    const pts = r.stops.map((s) => [s.latitude, s.longitude]);
    L.polyline(pts, { color: '#1fd1b0', weight: 2, opacity: 0.35 }).addTo(overview);
    r.stops.forEach((s) => {
      if (seen.has(s.id)) return;
      seen.add(s.id);
      L.circleMarker([s.latitude, s.longitude], { radius: 3.5, color: '#1fd1b0', weight: 1, fillColor: '#0c1b2b', fillOpacity: 1, opacity: 0.7 })
        .addTo(overview).bindTooltip(s.name, { direction: 'top', className: 'tip' });
    });
  });
}

function drawRoute() {
  if (!hasMap) return;
  layers.clearLayers();
  Object.keys(markers).forEach((k) => delete markers[k]);
  if (!S.route) return;
  const pts = S.stops.map((s) => [s.latitude, s.longitude]);
  L.polyline(pts, { color: '#0c1b2b', weight: 9, opacity: 0.9 }).addTo(layers);
  L.polyline(pts, { color: '#1fd1b0', weight: 5, opacity: 0.95 }).addTo(layers);
  S.stops.forEach((s) => {
    const m = L.marker([s.latitude, s.longitude], { icon: mkIcon('mk-stop', 12) }).addTo(layers)
      .bindTooltip(s.name, { direction: 'top', className: 'tip' });
    m.on('click', () => selectDest(s.id));
    markers[s.id] = m;
  });
  map.fitBounds(L.latLngBounds(pts).pad(0.2));
}

function drawDest() {
  if (!hasMap) return;
  if (destCircle) { map.removeLayer(destCircle); destCircle = null; }
  Object.keys(markers).forEach((id) => {
    const on = S.dest && Number(id) === S.dest.id;
    markers[id].setIcon(mkIcon(on ? 'mk-dest' : 'mk-stop', on ? 20 : 12));
    markers[id].setZIndexOffset(on ? 1000 : 0);
  });
  if (!S.dest) return;
  destCircle = L.circle([S.dest.latitude, S.dest.longitude], {
    radius: S.alertM, color: '#ffb627', weight: 2, dashArray: '6 6', fillColor: '#ffb627', fillOpacity: 0.16,
  }).addTo(map);
}

function setUser(lat, lng) {
  if (!hasMap) return;
  if (!userMarker) {
    userMarker = L.marker([lat, lng], { icon: mkIcon('mk-user', 20), zIndexOffset: 2000 }).addTo(map);
  } else {
    userMarker.setLatLng([lat, lng]);
  }
}

/* ---------- setup UI ---------- */
function renderRoutes() {
  const box = $('#routes');
  box.innerHTML = '';
  S.routes.forEach((r) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'route'; b.dataset.id = r.id;
    b.innerHTML = `<span class="badge">${esc(r.route_number || '-')}</span>
      <span class="r-main"><b>${esc(r.name)}</b><small>${r.stop_count} stops &middot; ${esc(r.vehicle_type)}</small></span>`;
    b.onclick = () => selectRoute(r.id);
    box.appendChild(b);
  });
}

function showLoadError(msg) {
  $('#routes').innerHTML = `<div class="err"><b>Routes load aagala.</b><br>${esc(msg)}
    <ul><li>WAMP icon green ah irukka?</li><li>phpMyAdmin la <b>database.sql</b> import pannirukkeengala?</li>
    <li>Page ah <b>http://localhost/stop-alert/</b> nu open pannirukkeengala (file ah double click panna work aagadhu)?</li>
    <li><b>config.php</b> la DB_NAME correct ah?</li></ul></div>`;
}

function selectRoute(id) {
  if (S.tracking) return;
  const r = S.routes.find((x) => x.id === Number(id));
  if (!r) return;
  S.route = r; S.stops = r.stops; S.dest = null;
  document.querySelectorAll('.route').forEach((b) => b.classList.toggle('active', Number(b.dataset.id) === r.id));
  renderStops();
  drawRoute();
  drawDest();
  updateStart();
}

function renderStops() {
  const ul = $('#stops');
  ul.innerHTML = '';
  S.stops.forEach((s, i) => {
    const li = document.createElement('li');
    li.dataset.id = s.id;
    const def = i === 0 ? 'Start' : (i === S.stops.length - 1 ? 'End' : '');
    li.innerHTML = `<span>${esc(s.name)}</span><span class="tag" data-def="${def}">${def}</span>`;
    li.onclick = () => selectDest(s.id);
    ul.appendChild(li);
  });
}

function selectDest(id) {
  if (S.tracking) return;
  const s = S.stops.find((x) => x.id === Number(id));
  if (!s) return;
  S.dest = s;
  document.querySelectorAll('#stops li').forEach((li) => {
    const on = Number(li.dataset.id) === s.id;
    li.classList.toggle('dest', on);
    const tag = li.querySelector('.tag');
    if (tag) tag.textContent = on ? 'Get off here' : tag.dataset.def;
    if (on) li.scrollIntoView({ block: 'nearest' });
  });
  drawDest();
  if (hasMap) map.flyTo([s.latitude, s.longitude], 11, { duration: 0.7 });
  updateStart();
}

function updateStart() { $('#btnStart').disabled = !S.dest; }

function renderChips() {
  const box = $('#distChips');
  box.innerHTML = '';
  DIST_OPTIONS.forEach((m) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'chip' + (m === S.alertM ? ' active' : '');
    b.textContent = m >= 1000 ? (m / 1000) + ' km' : m + ' m';
    b.onclick = () => {
      S.alertM = m;
      box.querySelectorAll('.chip').forEach((c) => c.classList.toggle('active', c === b));
      drawDest();
    };
    box.appendChild(b);
  });
}

function renderMode() {
  document.querySelectorAll('#modeSeg button').forEach((b) => b.classList.toggle('on', b.dataset.mode === S.mode));
  const sp = $('#speedSeg');
  sp.hidden = S.mode !== 'demo';
  sp.innerHTML = '';
  SPEEDS.forEach((o) => {
    const b = document.createElement('button');
    b.type = 'button'; b.textContent = o.label;
    b.className = o.k === S.speed ? 'on' : '';
    b.onclick = () => { S.speed = o.k; renderMode(); };
    sp.appendChild(b);
  });
  $('#modeHint').textContent = S.mode === 'live'
    ? 'Uses your real GPS. Allow location when the browser asks. On a phone, the page must be opened over HTTPS for GPS to work.'
    : 'Simulates a bus driving along the route (straight lines between stops) so you can see the full alarm without travelling.';
}

/* ---------- audio + vibration ---------- */
let audio = null;
function unlockAudio() {
  try {
    if (!audio) audio = new (window.AudioContext || window.webkitAudioContext)();
    if (audio.state === 'suspended') audio.resume();
  } catch (e) {}
}
function startSiren() {
  unlockAudio();
  stopSiren();
  if (audio) {
    let hi = false;
    const tick = () => {
      try {
        const t = audio.currentTime;
        const o = audio.createOscillator(), g = audio.createGain();
        o.type = 'sawtooth';
        o.frequency.value = hi ? 988 : 659; hi = !hi;
        g.gain.setValueAtTime(0.0001, t);
        g.gain.exponentialRampToValueAtTime(0.5, t + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.38);
        o.connect(g); g.connect(audio.destination);
        o.start(t); o.stop(t + 0.4);
      } catch (e) {}
    };
    tick();
    S.sirenTimer = setInterval(tick, 420);
  }
  if (navigator.vibrate) {
    const pattern = [500, 200, 500, 200, 800];
    navigator.vibrate(pattern);
    S.vibTimer = setInterval(() => navigator.vibrate(pattern), 2500);
  }
}
function stopSiren() {
  clearInterval(S.sirenTimer); S.sirenTimer = null;
  clearInterval(S.vibTimer); S.vibTimer = null;
  if (navigator.vibrate) navigator.vibrate(0);
}

/* ---------- alarm ---------- */
function triggerAlarm(test, dist) {
  if (S.alarmOn) return;
  S.alarmOn = true; S.alarmTest = !!test;
  if (!test) S.alarmDone = true;
  $('#alarmText').textContent = test ? 'This is a test alarm' : `${S.dest.name} is coming up`;
  $('#alarmDist').textContent = test ? 'Sound and vibration working? Great.' : `About ${fmtDist(dist)} to go. Get ready to get off.`;
  $('#alarm').hidden = false;
  startSiren();
  if (!test && 'Notification' in window && Notification.permission === 'granted') {
    try { new Notification('Stop Alert', { body: `${S.dest.name} is coming up. Wake up!`, requireInteraction: true }); } catch (e) {}
  }
  if (!test && S.tripId) api('update_trip', { method: 'POST', body: { id: S.tripId, status: 'alerted' } }).catch(() => {});
}
function dismissAlarm() {
  stopSiren();
  $('#alarm').hidden = true;
  const wasTest = S.alarmTest;
  S.alarmOn = false; S.alarmTest = false;
  if (!wasTest && S.tracking) finishTrip('completed');
}

/* ---------- trip flow ---------- */
async function lockScreen() {
  try { if ('wakeLock' in navigator) S.wake = await navigator.wakeLock.request('screen'); } catch (e) {}
}
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible' && S.tracking) lockScreen();
});

async function startTrip() {
  if (!S.dest || S.tracking) return;
  unlockAudio();
  if ('Notification' in window && Notification.permission === 'default') {
    try { Notification.requestPermission(); } catch (e) {}
  }
  if (S.mode === 'live' && !navigator.geolocation) { toast('This device has no GPS support.'); return; }
  if (navigator.vibrate) navigator.vibrate(60);

  try {
    const r = await api('start_trip', {
      method: 'POST',
      body: { device_id: deviceId, route_id: S.route.id, stop_id: S.dest.id, alert_distance_m: S.alertM, mode: S.mode },
    });
    S.tripId = r.id;
  } catch (e) {
    S.tripId = null;
    toast('Trip database la save aagala, but alarm work aagum.');
  }

  S.tracking = true; S.alarmDone = false; S.d0 = null; S.firstFix = true; S.pos = null;
  if (hasMap) trail.setLatLngs([]);

  $('#viewSetup').hidden = true;
  $('#viewTrack').hidden = false;
  $('#tDest').textContent = S.dest.name;
  $('#tAlertAt').textContent = fmtDist(S.alertM);
  $('#tDist').textContent = '--';
  $('#tEta').textContent = 'ETA --';
  $('#tNear').textContent = '';
  $('#tBar').style.width = '0%';
  const pill = $('#modePill');
  pill.textContent = S.mode === 'live' ? 'LIVE GPS' : 'DEMO RIDE';
  pill.classList.toggle('demo', S.mode === 'demo');
  $('#gpsStat').textContent = S.mode === 'live' ? 'Waiting for GPS...' : 'Simulated bus';
  document.getElementById('panel').scrollTop = 0;
  lockScreen();

  if (S.mode === 'live') {
    if (hasMap) map.flyTo([S.dest.latitude, S.dest.longitude], 9, { duration: 0.6 });
    S.watchId = navigator.geolocation.watchPosition(
      (p) => onFix({ lat: p.coords.latitude, lng: p.coords.longitude, acc: p.coords.accuracy, speed: p.coords.speed }),
      onGeoError,
      { enableHighAccuracy: true, maximumAge: 1000, timeout: 20000 }
    );
  } else {
    startSim();
  }
}

function onGeoError(err) {
  let msg = 'GPS problem. ';
  if (err.code === 1) msg += 'Location permission block aagi irukku. Browser settings la Allow pannunga.';
  else if (err.code === 2) msg += 'Location kidaikala. Open sky kitta try pannunga.';
  else msg += 'GPS timeout aagiduchu.';
  if (location.protocol === 'http:' && !['localhost', '127.0.0.1'].includes(location.hostname)) {
    msg += ' (Phone la GPS ku HTTPS venum.)';
  }
  $('#gpsStat').textContent = msg;
  toast(msg);
}

/* demo ride: a pretend bus follows the route from its start to the chosen stop */
function startSim() {
  const list = S.stops;
  const di = list.findIndex((s) => s.id === S.dest.id);
  const seq = di === 0 ? list.slice().reverse() : list.slice(0, di + 1);
  const pts = seq.map((s) => ({ lat: s.latitude, lng: s.longitude }));
  const cum = [0];
  for (let i = 1; i < pts.length; i++) cum.push(cum[i - 1] + haversine(pts[i - 1], pts[i]));
  S.sim = { pts, cum, total: cum[cum.length - 1], dist: 0 };
  if (hasMap) map.fitBounds(L.latLngBounds(pts.map((p) => [p.lat, p.lng])).pad(0.25));
  const step = BASE_MPS * S.speed * 0.2;       // metres per 200 ms tick
  S.simTimer = setInterval(() => {
    const sim = S.sim;
    if (!sim) return;
    sim.dist = Math.min(sim.total, sim.dist + step);
    const p = pointAt(sim, sim.dist);
    onFix({ lat: p.lat, lng: p.lng, acc: 8, speed: BASE_MPS });
    if (sim.dist >= sim.total) { clearInterval(S.simTimer); S.simTimer = null; }
  }, 200);
}
function pointAt(sim, dist) {
  const { pts, cum } = sim;
  if (dist >= sim.total) return pts[pts.length - 1];
  let i = 1;
  while (i < cum.length - 1 && cum[i] < dist) i++;
  const a = pts[i - 1], b = pts[i];
  const seg = (cum[i] - cum[i - 1]) || 1;
  const t = (dist - cum[i - 1]) / seg;
  return { lat: a.lat + (b.lat - a.lat) * t, lng: a.lng + (b.lng - a.lng) * t };
}

/* every position update (real or simulated) comes here */
function onFix({ lat, lng, acc, speed }) {
  if (!S.tracking || !S.dest) return;
  S.pos = { lat, lng };
  setUser(lat, lng);
  if (hasMap) {
    trail.addLatLng([lat, lng]);
    if (S.firstFix && S.mode === 'live') {
      map.fitBounds(L.latLngBounds([[lat, lng], [S.dest.latitude, S.dest.longitude]]).pad(0.3));
    } else if (!map.getBounds().contains([lat, lng])) {
      map.panTo([lat, lng]);
    }
  }
  S.firstFix = false;

  const d = haversine(S.pos, { lat: S.dest.latitude, lng: S.dest.longitude });
  if (S.d0 === null) S.d0 = Math.max(d, 1);

  $('#tDist').textContent = fmtDist(d);
  $('#tEta').textContent = fmtEta(speed && speed > 1.5 ? d / speed : null);
  if (S.mode === 'live') $('#gpsStat').textContent = `GPS OK, accuracy ~${Math.round(acc)} m`;

  let prog = S.sim ? S.sim.dist / S.sim.total : 1 - d / S.d0;
  prog = Math.max(0, Math.min(1, prog));
  $('#tBar').style.width = (prog * 100).toFixed(1) + '%';

  let best = null;
  S.stops.forEach((s) => {
    const dd = haversine(S.pos, { lat: s.latitude, lng: s.longitude });
    if (!best || dd < best.d) best = { s, d: dd };
  });
  $('#tNear').textContent = best ? `Nearest: ${best.s.name} (${fmtDist(best.d)})` : '';

  if (!S.alarmDone && d <= S.alertM) triggerAlarm(false, d);
}

function finishTrip(status) {
  const id = S.tripId;
  S.tracking = false; S.tripId = null;
  if (S.watchId !== null) { navigator.geolocation.clearWatch(S.watchId); S.watchId = null; }
  clearInterval(S.simTimer); S.simTimer = null; S.sim = null;
  if (S.wake) { S.wake.release().catch(() => {}); S.wake = null; }
  if (id) api('update_trip', { method: 'POST', body: { id, status } }).catch(() => {});
  if (hasMap) {
    trail.setLatLngs([]);
    if (userMarker) { map.removeLayer(userMarker); userMarker = null; }
  }
  S.d0 = null; S.pos = null;
  $('#viewTrack').hidden = true;
  $('#viewSetup').hidden = false;
  if (status === 'completed') toast('Trip completed. Safe journey!');
  if (hasMap && S.route) map.fitBounds(L.latLngBounds(S.stops.map((s) => [s.latitude, s.longitude])).pad(0.2));
}

/* ---------- my location button ---------- */
function locateMe() {
  if (!navigator.geolocation) { toast('This device has no GPS support.'); return; }
  navigator.geolocation.getCurrentPosition((p) => {
    const { latitude: lat, longitude: lng } = p.coords;
    if (!S.tracking) setUser(lat, lng);
    if (hasMap) map.flyTo([lat, lng], 13, { duration: 0.8 });
  }, onGeoError, { enableHighAccuracy: true, timeout: 15000 });
}

/* ---------- history ---------- */
async function showHistory() {
  const modal = $('#modal'), list = $('#historyList');
  modal.hidden = false;
  list.innerHTML = '<p class="empty">Loading...</p>';
  try {
    const rows = await api('history', { params: { device_id: deviceId } });
    if (!rows.length) { list.innerHTML = '<p class="empty">No trips yet. Start your first trip.</p>'; return; }
    list.innerHTML = rows.map((r) => `
      <div class="h-item">
        <div><b>${esc(r.stop_name)}</b>
          <small>${esc(r.route_name || 'Route')} &middot; ${esc(r.started_at)} &middot; ${esc(r.mode)}</small></div>
        <span class="st ${esc(r.status)}">${esc(r.status)}</span>
      </div>`).join('');
  } catch (e) {
    list.innerHTML = `<div class="err">${esc(e.message)}</div>`;
  }
}

/* ---------- events ---------- */
$('#btnStart').onclick = startTrip;
$('#btnStop').onclick = () => finishTrip('cancelled');
$('#btnDismiss').onclick = dismissAlarm;
$('#btnTest').onclick = () => { unlockAudio(); triggerAlarm(true, 0); };
$('#btnLocate').onclick = locateMe;
$('#btnHistory').onclick = showHistory;
$('#btnCloseModal').onclick = () => { $('#modal').hidden = true; };
$('#modal').onclick = (e) => { if (e.target.id === 'modal') $('#modal').hidden = true; };
$('#btnStyle').onclick = () => {
  if (!hasMap) return;
  if (tileMode === 'dark') { map.removeLayer(tileDark); tileLight.addTo(map); tileMode = 'light'; }
  else { map.removeLayer(tileLight); tileDark.addTo(map); tileMode = 'dark'; }
};
document.querySelectorAll('#modeSeg button').forEach((b) => {
  b.onclick = () => { S.mode = b.dataset.mode; renderMode(); };
});
window.addEventListener('resize', () => { if (hasMap) map.invalidateSize(); });

/* ---------- start ---------- */
async function init() {
  renderChips();
  renderMode();
  try {
    S.routes = await api('routes');
    if (!S.routes.length) { showLoadError('Routes table empty. database.sql import pannunga.'); return; }
    renderRoutes();
    drawOverview();
  } catch (e) {
    showLoadError(e.message);
  }
}
init();

})();
