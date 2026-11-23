import { stores } from './stops.js';
import { getRoutePace } from './pace.js';
import { mapPins, routePaths } from './route-geometry.js';

const planned = stores.filter(stop => !stop.hint);
const optional = stores.filter(stop => stop.hint);
const stopsById = new Map(stores.map(stop => [stop.id, stop]));
const order = new Map(planned.map((stop, index) => [stop.id, index + 1]));
const storageKey = 'pappy-run-home-base-2026-v1';
const view = id => document.getElementById(id);
const nextPanel = view('next-panel');
const routeList = view('route-list');
const optionalList = view('optional-list');
const filterButtons = Array.from(document.querySelectorAll('[data-filter]'));
const viewButtons = Array.from(document.querySelectorAll('[data-route-view]'));
const locateButton = view('locate-button');
const nearestLink = view('nearest-directions');
const installButton = view('install-button');
const mapButtons = new Map();

let filter = 'all';
let storageAvailable = true;
let completed = readProgress();
let selectedMapStop = null;
let position = null;
let locationMessage = 'Find the closest unfinished stop.';
let installPrompt = null;

function parseProgress(value) {
  try {
    const saved = JSON.parse(value);
    const entries = Array.isArray(saved)
      ? saved.map(id => [id, null])
      : Object.entries(saved ?? {});
    return new Map(entries.filter(([id]) => stopsById.has(id))
      .map(([id, time]) => [id, Number.isFinite(time) && time > 0 ? time : null]));
  } catch {
    return new Map();
  }
}

function readProgress() {
  try {
    return parseProgress(localStorage.getItem(storageKey));
  } catch {
    storageAvailable = false;
    return new Map();
  }
}

function saveProgress() {
  try {
    localStorage.setItem(storageKey, JSON.stringify(Object.fromEntries(completed)));
    storageAvailable = true;
  } catch {
    storageAvailable = false;
  }
}

function element(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text) node.textContent = text;
  return node;
}

function icon(name) {
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg');
  svg.setAttribute('class', 'icon');
  svg.setAttribute('aria-hidden', 'true');
  const reference = document.createElementNS(ns, 'use');
  reference.setAttribute('href', '#icon-' + name);
  svg.append(reference);
  return svg;
}

function mapsUrl(stop) {
  const query = new URLSearchParams({
    api: '1',
    destination: stop.address + ', ' + stop.city + ', KY ' + stop.zip,
    travelmode: 'driving',
  });
  return 'https://www.google.com/maps/dir/?' + query;
}

function directionsLink(stop, featured = false) {
  const link = element('a', 'button ' + (featured ? 'button-primary' : 'maps'));
  link.href = mapsUrl(stop);
  link.target = '_blank';
  link.rel = 'noopener noreferrer';
  link.setAttribute('aria-label', 'Google Maps directions to ' + stop.name);
  link.append(icon('turn'), featured ? 'Google Maps' : 'Directions');
  return link;
}

function completeButton(stop, surface) {
  const done = completed.has(stop.id);
  const label = done ? 'Undo' : surface === 'list' ? 'Done' : 'Mark complete';
  const button = element('button', 'button button-outline' + (done ? ' undo' : ''));
  button.type = 'button';
  button.dataset.stop = stop.id;
  button.dataset.surface = surface;
  button.dataset.completed = String(done);
  button.setAttribute('aria-label', (done ? 'Undo completion for ' : 'Mark complete: ') + stop.name);
  if (!done) button.append(icon('check'));
  button.append(label);
  return button;
}

function actions(stop, surface = 'list') {
  const group = element('div', 'actions');
  group.append(directionsLink(stop, surface !== 'list'), completeButton(stop, surface));
  return group;
}

function stopCard(stop) {
  const done = completed.has(stop.id);
  const card = element('li', 'stop-card' + (done ? ' is-done' : ''));
  const badge = element('span', 'stop-number');
  badge.setAttribute('aria-hidden', 'true');
  if (done) badge.append(icon('check'));
  else badge.textContent = order.has(stop.id) ? String(order.get(stop.id)) : '+';
  const info = element('div', 'stop-info');
  info.append(element('h3', '', stop.name), element('p', 'address', stop.address));
  if (stop.hint) info.append(element('p', 'stop-hint', stop.hint));
  card.append(badge, info, actions(stop));
  return card;
}

function renderNext() {
  const next = planned.find(stop => !completed.has(stop.id));
  const copy = element('div');
  const title = element('h2', '', next ? next.name : 'Planned route complete');
  title.tabIndex = -1;
  if (next) {
    copy.append(element('p', 'next-label', 'Next in route · Stop ' + order.get(next.id)));
    copy.append(title, element('p', 'address', next.address));
    nextPanel.replaceChildren(copy, actions(next, 'next'));
  } else {
    copy.append(title);
    nextPanel.replaceChildren(copy);
  }
}

function renderChecklist() {
  const visibleStops = planned.filter(stop => {
    if (filter === 'completed') return completed.has(stop.id);
    if (filter === 'remaining') return !completed.has(stop.id);
    return true;
  });
  routeList.replaceChildren(...visibleStops.map(stopCard));
  const empty = view('empty-message');
  empty.hidden = visibleStops.length > 0;
  empty.textContent = filter === 'completed' ? 'No stops completed yet.' : 'All planned stops are complete.';
  filterButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.filter === filter)));
  optionalList.replaceChildren(...optional.map(stopCard));
}

function setRouteView(routeView) {
  const showMap = routeView === 'map';
  view('route-map').hidden = !showMap;
  view('route-checklist').hidden = showMap;
  view('optional-section').hidden = showMap;
  viewButtons.forEach(button => button.setAttribute('aria-pressed', String(button.dataset.routeView === routeView)));
}

function mapShape(tag, attributes, label) {
  const shape = document.createElementNS('http://www.w3.org/2000/svg', tag);
  for (const [key, value] of Object.entries(attributes)) shape.setAttribute(key, value);
  if (label) shape.textContent = label;
  view('map-diagram').append(shape);
}

function buildMap() {
  mapShape('polyline', { points: routePaths.mudLane, class: 'map-detour' });
  mapShape('polyline', { points: routePaths.prospect, class: 'map-detour' });
  mapShape('polyline', { points: routePaths.planned, class: 'map-road-outline' });
  mapShape('polyline', { points: routePaths.planned, class: 'map-road' });
  const places = [[31, 120, 'LOUISVILLE'], [99, 97, 'ST. MATTHEWS'],
    [276, 191, 'MIDDLETOWN'], [23, 294, 'SOUTH LOUISVILLE']];
  for (const [x, y, name] of places) mapShape('text', { x, y, class: 'map-place' }, name);

  for (const [id, x, y, anchorX, anchorY] of mapPins) {
    mapShape('line', { x1: anchorX, y1: anchorY, x2: x, y2: y, class: 'map-leader' });
    const pin = element('button', 'map-pin');
    pin.type = 'button';
    pin.style.left = x / 360 * 100 + '%';
    pin.style.top = y / 350 * 100 + '%';
    pin.setAttribute('aria-controls', 'map-selection');
    const badge = element('span', '', order.has(id) ? String(order.get(id)) : '+');
    badge.setAttribute('aria-hidden', 'true');
    pin.append(badge);
    pin.addEventListener('click', () => {
      selectedMapStop = id;
      renderMap();
      const panel = view('map-selection');
      panel.querySelector('h3').focus({ preventScroll: true });
      panel.scrollIntoView({ block: 'nearest' });
    });
    view('map-pins').append(pin);
    mapButtons.set(id, pin);
  }
}

function renderMap() {
  const next = planned.find(stop => !completed.has(stop.id));
  const selected = stopsById.get(selectedMapStop) ?? next ?? planned[0];
  for (const [id, pin] of mapButtons) {
    const stop = stopsById.get(id);
    const isDone = completed.has(id);
    pin.classList.toggle('is-optional', Boolean(stop.hint));
    pin.classList.toggle('is-done', isDone);
    pin.setAttribute('aria-pressed', String(id === selected.id));
    const label = stop.hint ? 'Optional stop' : 'Stop ' + order.get(id);
    pin.setAttribute('aria-label', label + ': ' + stop.name + (isDone ? ', complete' : ''));
  }
  const panel = view('map-selection');
  const type = selected.hint ? 'Optional stop' : 'Stop ' + order.get(selected.id);
  const status = type + (completed.has(selected.id) ? ' · Complete' : '');
  const name = element('h3', '', selected.name);
  name.tabIndex = -1;
  panel.replaceChildren(element('p', 'map-status', status), name, element('p', 'address', selected.address));
  if (selected.hint) panel.append(element('p', 'stop-hint', selected.hint));
  panel.append(actions(selected, 'map'));
}

function renderPace() {
  const pace = getRoutePace(completed, Date.now(), planned.every(stop => completed.has(stop.id)));
  view('pace-clock').textContent = pace.clock;
  const detail = view('pace-detail');
  detail.textContent = pace.detail;
  detail.classList.toggle('is-behind', Boolean(pace.behind));
  const advice = view('pace-advice');
  const actionContainer = view('pace-actions');
  const suggestedId = pace.advice?.stop ?? '';
  advice.hidden = !suggestedId;
  if (actionContainer.dataset.stop === suggestedId) return;
  actionContainer.dataset.stop = suggestedId;
  if (!suggestedId) {
    actionContainer.replaceChildren();
    return;
  }
  view('pace-message').textContent = pace.advice.message;
  if (suggestedId === 'st-matthews') {
    actionContainer.replaceChildren(directionsLink(stopsById.get(suggestedId), true));
    return;
  }
  const button = element('button', 'button button-outline', 'Show Prospect on map');
  button.type = 'button';
  button.addEventListener('click', () => {
    selectedMapStop = suggestedId;
    setRouteView('map');
    renderMap();
    view('map-title').focus();
  });
  actionContainer.replaceChildren(button);
}

function render() {
  const doneCount = planned.filter(stop => completed.has(stop.id)).length;
  const optionalCount = optional.filter(stop => completed.has(stop.id)).length;
  view('done-count').textContent = doneCount;
  view('route-progress').value = doneCount;
  const extras = view('extra-count');
  extras.hidden = optionalCount === 0;
  extras.textContent = '+' + optionalCount + ' optional';
  view('optional-count').textContent = optionalCount ? optionalCount + ' / ' + optional.length : optional.length;
  view('storage-status').textContent = storageAvailable ?
    'Progress stays on this device.' : 'This browser could not save your progress. Keep this page open.';
  renderNext();
  renderChecklist();
  renderLocation();
  renderMap();
  renderPace();
}

function milesBetween(a, b) {
  const radians = degrees => degrees * Math.PI / 180;
  const lat1 = radians(a.latitude);
  const lat2 = radians(b.latitude);
  const deltaLon = radians(b.longitude - a.longitude);
  const h = Math.sin((lat2 - lat1) / 2) ** 2 +
    Math.cos(lat1) * Math.cos(lat2) * Math.sin(deltaLon / 2) ** 2;
  return 2 * 3958.76 * Math.asin(Math.sqrt(Math.min(1, h)));
}

function renderLocation() {
  const status = view('location-status');
  nearestLink.hidden = true;
  if (!position) {
    status.textContent = locationMessage;
    return;
  }
  const candidates = planned.filter(stop => !completed.has(stop.id))
    .map(stop => ({ stop, miles: milesBetween(position, stop) }))
    .sort((a, b) => a.miles - b.miles);
  const nearest = candidates[0];
  if (!nearest) {
    status.textContent = 'All planned stops are complete.';
    return;
  }
  const distance = nearest.miles < .1 ? 'under 0.1' : nearest.miles.toFixed(1);
  status.textContent = 'Closest: ' + nearest.stop.name + ' · ' + distance + ' mi straight-line';
  nearestLink.href = mapsUrl(nearest.stop);
  nearestLink.hidden = false;
}

view('route-app').addEventListener('click', event => {
  const button = event.target.closest('button[data-stop]');
  if (!button) return;
  const stop = stopsById.get(button.dataset.stop);
  const wasDone = button.dataset.completed === 'true';
  if (storageAvailable) {
    const latest = readProgress();
    if (storageAvailable) completed = latest;
  }
  if (wasDone) completed.delete(stop.id);
  else if (!completed.has(stop.id)) completed.set(stop.id, Date.now());
  saveProgress();
  render();
  view('completion-status').textContent = wasDone ? 'Reopened ' + stop.name : 'Completed ' + stop.name;
  const surface = button.dataset.surface;
  const control = 'button[data-stop="' + stop.id + '"][data-surface="' + surface + '"]';
  const heading = surface === 'map' ? view('map-title') : view('route-title');
  const restore = surface === 'next' ? nextPanel.querySelector('h2') : document.querySelector(control) ?? heading;
  restore?.focus({ preventScroll: true });
});

filterButtons.forEach(button => button.addEventListener('click', () => {
  filter = button.dataset.filter;
  renderChecklist();
}));

viewButtons.forEach(button => button.addEventListener('click', () => setRouteView(button.dataset.routeView)));

window.addEventListener('storage', event => {
  if (event.key !== storageKey && event.key !== null) return;
  completed = readProgress();
  render();
});

locateButton.addEventListener('click', () => {
  position = null;
  if (!window.isSecureContext || !navigator.geolocation) {
    locationMessage = 'Location requires HTTPS and a browser with location access.';
    renderLocation();
    return;
  }
  locationMessage = 'Getting your location…';
  locateButton.disabled = true;
  renderLocation();
  navigator.geolocation.getCurrentPosition(
    ({ coords }) => {
      position = { latitude: coords.latitude, longitude: coords.longitude };
      locateButton.disabled = false;
      view('locate-label').textContent = 'Refresh location';
      renderLocation();
    },
    error => {
      locateButton.disabled = false;
      view('locate-label').textContent = 'Use my location';
      locationMessage = error.code === 1
        ? 'Location is blocked. Allow it in your browser settings to find nearby stops.'
        : 'Could not get your location. Try again.';
      renderLocation();
    },
    { timeout: 10000, maximumAge: 30000, enableHighAccuracy: false },
  );
});

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault();
  installPrompt = event;
});
window.addEventListener('appinstalled', () => {
  installPrompt = null;
  installButton.hidden = true;
});
installButton.hidden = window.matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
installButton.addEventListener('click', async () => {
  if (!installPrompt) {
    view('install-dialog').showModal();
    return;
  }
  const prompt = installPrompt;
  installPrompt = null;
  try {
    await prompt.prompt();
  } catch {
    view('install-dialog').showModal();
  }
});

buildMap();
render();
window.setInterval(renderPace, 15_000);
document.addEventListener('visibilitychange', () => {
  if (!document.hidden) renderPace();
});

if ('serviceWorker' in navigator && window.isSecureContext) {
  navigator.serviceWorker.register('./sw.js').catch(error => {
    console.warn('Offline setup failed.', error);
  });
}
