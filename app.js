const API_BASE    = 'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_API = 'https://api.open-meteo.com/v1/forecast';
const DEBOUNCE    = 400;

// ── Datos crudos guardados globalmente (siempre en métrico) ──
let rawData = null; // { current, hourly, daily, cityName }

// ── Iconos según WMO weathercode ──
const WMO_ICON = {
  0:  'icon-sunny.webp',   1: 'icon-sunny.webp',
  2:  'icon-partly-cloudy.webp', 3: 'icon-overcast.webp',
  45: 'icon-fog.webp',    48: 'icon-fog.webp',
  51: 'icon-drizzle.webp', 53: 'icon-drizzle.webp', 55: 'icon-drizzle.webp',
  61: 'icon-rain.webp',   63: 'icon-rain.webp',    65: 'icon-rain.webp',
  71: 'icon-snow.webp',   73: 'icon-snow.webp',    75: 'icon-snow.webp',
  80: 'icon-rain.webp',   81: 'icon-rain.webp',    82: 'icon-rain.webp',
  95: 'icon-storm.webp',  96: 'icon-storm.webp',   99: 'icon-storm.webp',
};

function getWeatherIcon(code) {
  return `assets/images/${WMO_ICON[code] ?? 'icon-overcast.webp'}`;
}


const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function shortDay(dateStr) {
  return DAY_NAMES[new Date(dateStr + 'T12:00:00').getDay()];
}

// ════════════════════════════════════════
// CONVERSIONES
// ════════════════════════════════════════
function toTemp(celsius) {
  if (currentUnits.temp === 'fahrenheit') return Math.round(celsius * 9/5 + 32) + '°F';
  return Math.round(celsius) + '°C';
}

function toTempBare(celsius) {
  // Solo el número + símbolo, sin etiqueta de unidad (para forecast)
  if (currentUnits.temp === 'fahrenheit') return Math.round(celsius * 9/5 + 32) + '°';
  return Math.round(celsius) + '°';
}

function toWind(kmh) {
  if (currentUnits.wind === 'mph') return (kmh * 0.621371).toFixed(1) + ' mph';
  return Math.round(kmh) + ' km/h';
}

function toPrecip(mm) {
  if (currentUnits.precip === 'inches') return (mm * 0.0393701).toFixed(2) + ' in';
  return mm + ' mm';
}

// ════════════════════════════════════════
// RE-RENDER con unidades actuales
// ════════════════════════════════════════
function refreshDisplayedUnits() {
  if (!rawData) return;

  const { current, hourly, daily, cityName } = rawData;

  // 1. Tarjeta principal — temperatura actual
  document.querySelector('.weather-temp').textContent = toTempBare(current.temperature);

  // 2. Tarjetas de stats — buscar hora actual en hourly
  const nowISO = new Date().toISOString().slice(0, 13);
  const idx = hourly.time.findIndex(t => t.startsWith(nowISO));
  const i = idx !== -1 ? idx : 0;

  document.getElementById('statFeelsLike').textContent = toTempBare(hourly.apparent_temperature[i]);
  document.getElementById('statHumidity').textContent  = `${hourly.relativehumidity_2m[i]}%`;
  document.getElementById('statWind').textContent      = toWind(hourly.windspeed_10m[i]);
  document.getElementById('statPrecip').textContent    = toPrecip(hourly.precipitation[i]);

  // 3. Forecast diario
  const cards = document.querySelectorAll('.forecast-card');
  daily.time.forEach((_, idx) => {
    const card = cards[idx];
    if (!card) return;
    card.querySelector('.fc-high').textContent = toTempBare(daily.temperature_2m_max[idx]);
    card.querySelector('.fc-low').textContent  = toTempBare(daily.temperature_2m_min[idx]);
  });

  // 4. Forecast horario
  const hourlyItems = document.querySelectorAll('.hourly-item');
  hourlyItems.forEach((item, idx) => {
    const tempEl = item.querySelector('.hourly-temp');
    if (tempEl && item._rawTemp !== undefined) {
      tempEl.textContent = toTempBare(item._rawTemp);
    }
  });
}

// ════════════════════════════════════════
// SEARCH
// ════════════════════════════════════════
const input     = document.getElementById('cityInput');
const list      = document.getElementById('resultsList');
const dropdown  = document.getElementById('dropdown');
const noResults = document.getElementById('noResults');
const loader    = document.getElementById('loader');
const searchBtn = document.getElementById('searchBtn');

let debounceTimer = null;


input.addEventListener('input', () => {
  clearTimeout(debounceTimer);
  const q = input.value.trim();
  if (!q) { reset(); return; }
  debounceTimer = setTimeout(() => fetchCities(q), DEBOUNCE);
});

input.addEventListener('keydown', e => {
  if (e.key === 'Enter') { clearTimeout(debounceTimer); fetchCities(input.value.trim()); }
  if (e.key === 'Escape') reset();
});

searchBtn.addEventListener('click', () => {
  clearTimeout(debounceTimer);
  fetchCities(input.value.trim());
});


document.addEventListener('click', e => {
  if (!e.target.closest('.search-wrap')) reset();
});


async function fetchCities(query) {
  if (!query) return;
  setLoading(true);
  clearDropdown();
  hideNoResults();

  try {
    const res  = await fetch(`${API_BASE}?name=${encodeURIComponent(query)}&count=10`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    renderResults(data.results || []);
  } catch (err) {
    console.error('[weather-search]', err);
  } finally {
    setLoading(false);
  }
}


function renderResults(cities) {
  clearDropdown();
  if (!cities.length) { closeDropdown(); showNoResults(); return; }
  hideNoResults();

  cities.forEach(city => {
    const li = document.createElement('li');
    li.className = 'result-item';
    li.setAttribute('role', 'option');

    const region = [city.admin1, city.country].filter(Boolean).join(', ');
    const lat    = city.latitude  != null ? city.latitude.toFixed(4)  : '—';
    const lon    = city.longitude != null ? city.longitude.toFixed(4) : '—';

    li.innerHTML = `
      <div>
        <div class="result-city">${esc(city.name)}</div>
        <div class="result-region">${esc(region)}</div>
      </div>
      <div class="result-coords">${lat}, ${lon}</div>`;

    li.addEventListener('click', () => onSelect(city));
    list.appendChild(li);
  });

  openDropdown();
}


function onSelect(city) {
  const region = [city.admin1, city.country].filter(Boolean).join(', ');
  input.value = `${city.name}${region ? ', ' + region : ''}`;
  closeDropdown();
  loadCityForecast(city.latitude, city.longitude, city.name + (region ? ', ' + region : ''));
}


function openDropdown()  { dropdown.classList.add('open'); }
function closeDropdown() { dropdown.classList.remove('open'); }
function clearDropdown() { list.innerHTML = ''; closeDropdown(); }
function showNoResults() { noResults.textContent = 'No search result found!'; noResults.classList.add('visible'); }
function hideNoResults() { noResults.textContent = ''; noResults.classList.remove('visible'); }
function setLoading(on)  { loader.classList.toggle('active', on); }
function reset()         { clearDropdown(); hideNoResults(); }

function esc(str) {
  const d = document.createElement('div');
  d.textContent = str ?? '';
  return d.innerHTML;
}

// ════════════════════════════════════════
// FETCH FORECAST
// ════════════════════════════════════════
async function loadCityForecast(lat, lon, cityName) {

  showForecastSkeleton();

  try {
    const url = `${WEATHER_API}?latitude=${lat}&longitude=${lon}` +
      `&daily=temperature_2m_max,temperature_2m_min,weathercode` +
      `&hourly=temperature_2m,weathercode,apparent_temperature,relativehumidity_2m,precipitation,windspeed_10m` +
      `&current_weather=true&timezone=auto&forecast_days=7`;

    const res  = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // Guardar datos crudos
    rawData = { current: data.current_weather, hourly: data.hourly, daily: data.daily, cityName };

    renderWeatherCard(cityName, data.current_weather, data.hourly);
    renderForecast(data.daily);

    renderHourlyForecast(data.hourly);
  } catch (err) {
    console.error('[forecast]', err);
    hideForecastSkeleton();
  }
}


async function loadBerlinForecast() {
  showForecastSkeleton();

  try {
    const url = `${WEATHER_API}?latitude=52.5244&longitude=13.4105` +
      `&daily=temperature_2m_max,temperature_2m_min,weathercode` +
      `&hourly=temperature_2m,weathercode,apparent_temperature,relativehumidity_2m,precipitation,windspeed_10m` +
      `&current_weather=true&timezone=auto&forecast_days=7`;

    const res  = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();

    // Guardar datos crudos
    rawData = { current: data.current_weather, hourly: data.hourly, daily: data.daily, cityName: 'Berlin, Germany' };

    renderWeatherCard('Berlin, Germany', data.current_weather, data.hourly);
    renderForecast(data.daily);
    renderHourlyForecast(data.hourly);
  } catch (err) {
    console.error('[forecast]', err);
    hideForecastSkeleton();
  }
}

// ════════════════════════════════════════
// RENDER FUNCTIONS
// ════════════════════════════════════════
function renderWeatherCard(cityName, current, hourly) {
  const now     = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric', year: 'numeric'
  });

  document.querySelector('.weather-city').textContent = cityName;
  document.querySelector('.weather-date').textContent = dateStr;
  document.querySelector('.weather-temp').textContent = toTempBare(current.temperature);

  const iconEl = document.querySelector('.weather-card .weather-icon');
  iconEl.src = getWeatherIcon(current.weathercode);
  iconEl.alt = WMO_ICON[current.weathercode] ?? 'weather icon';

  if (hourly) {
    const nowISO = new Date().toISOString().slice(0, 13);
    const idx = hourly.time.findIndex(t => t.startsWith(nowISO));
    const i = idx !== -1 ? idx : 0;

    document.getElementById('statFeelsLike').textContent = toTempBare(hourly.apparent_temperature[i]);
    document.getElementById('statHumidity').textContent  = `${hourly.relativehumidity_2m[i]}%`;
    document.getElementById('statWind').textContent      = toWind(hourly.windspeed_10m[i]);
    document.getElementById('statPrecip').textContent    = toPrecip(hourly.precipitation[i]);
  }
}

function renderForecast(daily) {
  const grid = document.getElementById('forecastGrid');
  grid.innerHTML = '';

  daily.time.forEach((dateStr, i) => {

    const card = document.createElement('div');
    card.className = 'forecast-card' + (i === 0 ? ' is-today' : '');


    
    const icon = getWeatherIcon(daily.weathercode[i]);

    card.innerHTML = `
      <span class="fc-day">${shortDay(dateStr)}</span>
      <img class="fc-icon" src="${icon}" alt="weather icon" />
      <div class="fc-temps">
        <span class="fc-high">${toTempBare(daily.temperature_2m_max[i])}</span>
        <span class="fc-low">${toTempBare(daily.temperature_2m_min[i])}</span>
      </div>`;

    grid.appendChild(card);
  });

  hideForecastSkeleton();
}

function renderHourlyForecast(hourly) {
  const list = document.querySelector('.hourly-list');
  if (!list) return;

  const nowHour = new Date().getHours();
  const today   = new Date().toISOString().slice(0, 10);

  const slots = [];
  for (let i = 0; i < hourly.time.length && slots.length < 8; i++) {
    const slotDate = hourly.time[i].slice(0, 10);
    const slotHour = parseInt(hourly.time[i].slice(11, 13));

    if ((slotDate === today && slotHour >= nowHour) || slotDate > today) {
      slots.push({
        time: hourly.time[i],
        temp: hourly.temperature_2m[i],
        code: hourly.weathercode[i]
      });
    }
  }

  list.innerHTML = slots.map(slot => {
    const label = new Date(slot.time).toLocaleTimeString('en-US', { hour: 'numeric', hour12: true });
    const icon  = getWeatherIcon(slot.code);
    return `
      <div class="hourly-item" data-raw-temp="${slot.temp}">
        <div class="hourly-time-info">
          <img src="${icon}" alt="weather" class="weather-icon-mini">
          <span class="hourly-time">${label}</span>
        </div>
        <span class="hourly-temp">${toTempBare(slot.temp)}</span>
      </div>`;
  }).join('');

  // Guardar temp cruda en el elemento para refresh posterior
  list.querySelectorAll('.hourly-item').forEach(item => {
    item._rawTemp = parseFloat(item.dataset.rawTemp);
  });
}

function showForecastSkeleton() {
  document.getElementById('forecastSkeleton').classList.add('is-loading');
  document.getElementById('forecastGrid').classList.add('is-loading');
}

function hideForecastSkeleton() {
  document.getElementById('forecastSkeleton').classList.remove('is-loading');
  document.getElementById('forecastGrid').classList.remove('is-loading');
}

// Ejecutar al cargar
loadBerlinForecast();

// ════════════════════════════════════════
// UNITS DROPDOWN
// ════════════════════════════════════════
const unitsBtn       = document.getElementById('unitsBtn');
const unitsMenu      = document.getElementById('unitsMenu');
const unitsSwitchBtn = document.getElementById('unitsSwitchBtn');

const currentUnits = { temp: 'celsius', wind: 'kmh', precip: 'mm' };


unitsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  unitsMenu.classList.toggle('open');
});


document.addEventListener('click', (e) => {
  if (!e.target.closest('.units-dropdown')) unitsMenu.classList.remove('open');
});


document.querySelectorAll('.units-option').forEach(option => {
  option.addEventListener('click', () => {
    const group = option.dataset.group;
    const value = option.dataset.value;


    document.querySelectorAll(`.units-option[data-group="${group}"]`)
      .forEach(opt => opt.classList.remove('active'));
    
      option.classList.add('active');
    
      currentUnits[group] = value;
    updateSwitchBtn();
    refreshDisplayedUnits(); // ← re-renderiza con nuevas unidades
  });
});


unitsSwitchBtn.addEventListener('click', () => {
  const isMetric = currentUnits.temp === 'celsius';

  if (isMetric) {
    setUnit('temp',   'fahrenheit');
    setUnit('wind',   'mph');
    setUnit('precip', 'inches');
  } else {
    setUnit('temp',   'celsius');
    setUnit('wind',   'kmh');
    setUnit('precip', 'mm');
  }

  updateSwitchBtn();
  refreshDisplayedUnits(); // ← redirection new units
});


function setUnit(group, value) {
  document.querySelectorAll(`.units-option[data-group="${group}"]`)
  .forEach(opt => opt.classList.remove('active'));
  document.querySelector(`.units-option[data-group="${group}"][data-value="${value}"]`)
  .classList.add('active');
  currentUnits[group] = value;
}


function updateSwitchBtn() {
  unitsSwitchBtn.textContent = currentUnits.temp === 'celsius'
    ? 'Switch to Imperial'
    : 'Switch to Metric';
}
