const API_BASE  = 'https://geocoding-api.open-meteo.com/v1/search';
const WEATHER_API = 'https://api.open-meteo.com/v1/forecast';
const DEBOUNCE  = 400;

// Iconos según WMO weathercode (open-meteo)
const WMO_ICON = {
  0:  'icon-sunny.webp',
  1:  'icon-sunny.webp',
  2:  'icon-partly-cloudy.webp',
  3:  'icon-overcast.webp',
  45: 'icon-fog.webp',
  48: 'icon-fog.webp',
  51: 'icon-drizzle.webp',
  53: 'icon-drizzle.webp',
  55: 'icon-drizzle.webp',
  61: 'icon-rain.webp',
  63: 'icon-rain.webp',
  65: 'icon-rain.webp',
  71: 'icon-snow.webp',
  73: 'icon-snow.webp',
  75: 'icon-snow.webp',
  80: 'icon-rain.webp',
  81: 'icon-rain.webp',
  82: 'icon-rain.webp',
  95: 'icon-storm.webp',
  96: 'icon-storm.webp',
  99: 'icon-storm.webp',
};

function getWeatherIcon(code) {
  return `assets/images/${WMO_ICON[code] ?? 'icon-overcast.webp'}`;
}

// Nombres cortos de día (en-US)
const DAY_NAMES = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
function shortDay(dateStr) {
  return DAY_NAMES[new Date(dateStr + 'T12:00:00').getDay()];
}

const input     = document.getElementById('cityInput');
const list      = document.getElementById('resultsList');
const dropdown  = document.getElementById('dropdown');
const noResults = document.getElementById('noResults');
const loader    = document.getElementById('loader');
const searchBtn = document.getElementById('searchBtn');

let debounceTimer = null;

/* ── Events ── */
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

// Close dropdown on outside click
document.addEventListener('click', e => {
  if (!e.target.closest('.search-wrap')) reset();
});

/* ── Fetch ── */
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

/* ── Render ── */
function renderResults(cities) {
  clearDropdown();

  if (!cities.length) {
    closeDropdown();
    showNoResults();
    return;
  }

  hideNoResults();

  cities.forEach(city => {
    const li     = document.createElement('li');
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
      <div class="result-coords">${lat}, ${lon}</div>
    `;

    li.addEventListener('click', () => onSelect(city));
    list.appendChild(li);
  });

  openDropdown();
}

/* ── Select ── */
function onSelect(city) {
  const region = [city.admin1, city.country].filter(Boolean).join(', ');
  input.value  = `${city.name}${region ? ', ' + region : ''}`;
  closeDropdown();
  console.log('Selected:', city);
  alert(
    `📍 ${city.name}${region ? ', ' + region : ''}\n` +
    `Lat: ${city.latitude}   Lon: ${city.longitude}\n\n` +
    `Hook this up to your weather endpoint!`
  );
}

/* ── Helpers ── */
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

// ── AGREGAR: Forecast de Berlin al cargar la página ──
async function loadBerlinForecast() {
  showForecastSkeleton();

  try {
    const url = `${WEATHER_API}?latitude=52.5244&longitude=13.4105` +
            `&daily=temperature_2m_max,temperature_2m_min,weathercode` +
            `&current_weather=true` +
            `&timezone=auto&forecast_days=7`;
    const res  = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    renderForecast(data.daily);
    renderWeatherCard('Berlin, Germany', data.current_weather);
  } catch (err) {
    console.error('[forecast]', err);
    hideForecastSkeleton(); // deja el skeleton visible o muestra error
  }
}

function renderForecast(daily) {
  const grid = document.getElementById('forecastGrid');
  grid.innerHTML = '';

  daily.time.forEach((dateStr, i) => {
    const isToday = i === 0;
    const card = document.createElement('div');
    card.className = 'forecast-card' + (isToday ? ' is-today' : '');

    const high = Math.round(daily.temperature_2m_max[i]);
    const low  = Math.round(daily.temperature_2m_min[i]);
    const icon = getWeatherIcon(daily.weathercode[i]);

    card.innerHTML = `
      <span class="fc-day">${shortDay(dateStr)}</span>
      <img class="fc-icon" src="${icon}" alt="weather icon" />
      <div class="fc-temps">
        <span class="fc-high">${high}°</span>
        <span class="fc-low">${low}°</span>
      </div>`;

    grid.appendChild(card);
  });

  hideForecastSkeleton();
}

function renderWeatherCard(cityName, current) {
  // Fecha legible: "Tuesday, Aug 5, 2025"
  const now = new Date();
  const dateStr = now.toLocaleDateString('en-US', {
    weekday: 'long', month: 'short', day: 'numeric', year: 'numeric'
  });

  document.querySelector('.weather-city').textContent = cityName;
  document.querySelector('.weather-date').textContent = dateStr;
  document.querySelector('.weather-temp').textContent = `${Math.round(current.temperature)}°`;

  const iconEl = document.querySelector('.weather-card .weather-icon');
  iconEl.src = getWeatherIcon(current.weathercode);
  iconEl.alt = WMO_ICON[current.weathercode] ?? 'weather icon';
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
// ── Units Dropdown ──
const unitsBtn    = document.getElementById('unitsBtn');
const unitsMenu   = document.getElementById('unitsMenu');
const unitsSwitchBtn = document.getElementById('unitsSwitchBtn');

// Estado actual de unidades
const currentUnits = {
  temp:   'celsius',
  wind:   'kmh',
  precip: 'mm'
};

// Abrir / cerrar al hacer clic en el botón
unitsBtn.addEventListener('click', (e) => {
  e.stopPropagation();
  unitsMenu.classList.toggle('open');
});

// Cerrar si el usuario hace clic fuera
document.addEventListener('click', (e) => {
  if (!e.target.closest('.units-dropdown')) {
    unitsMenu.classList.remove('open');
  }
});

// Clic en una opción individual
document.querySelectorAll('.units-option').forEach(option => {
  option.addEventListener('click', () => {
    const group = option.dataset.group;
    const value = option.dataset.value;

    // Quitar active de todas las opciones del mismo grupo
    document.querySelectorAll(`.units-option[data-group="${group}"]`)
      .forEach(opt => opt.classList.remove('active'));

    // Poner active en la elegida
    option.classList.add('active');

    // Guardar en estado
    currentUnits[group] = value;

    // Actualizar texto del botón switch
    updateSwitchBtn();

    console.log('Unidades actuales:', currentUnits);
  });
});

// Botón "Switch to Imperial" / "Switch to Metric"
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
});

// Función para cambiar una unidad y actualizar el DOM
function setUnit(group, value) {
  document.querySelectorAll(`.units-option[data-group="${group}"]`)
    .forEach(opt => opt.classList.remove('active'));

  document.querySelector(`.units-option[data-group="${group}"][data-value="${value}"]`)
    .classList.add('active');

  currentUnits[group] = value;
}

// Actualiza el texto del botón switch según el estado actual
function updateSwitchBtn() {
  const isMetric = currentUnits.temp === 'celsius';
  unitsSwitchBtn.textContent = isMetric ? 'Switch to Imperial' : 'Switch to Metric';
}