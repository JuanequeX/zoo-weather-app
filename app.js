const API_BASE  = 'https://geocoding-api.open-meteo.com/v1/search';
const DEBOUNCE  = 400;

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
