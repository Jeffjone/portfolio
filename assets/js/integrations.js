(() => {
  'use strict';
  // Optional owner-selected public Spotify URL. Visitors can also tune the radio themselves.
  const featuredSpotifyUrl = '';
  const clock = document.getElementById('town-clock');
  const formatClock = new Intl.DateTimeFormat('en-US', { timeZone: 'America/Chicago', hour: 'numeric', minute: '2-digit', timeZoneName: 'short' });
  function updateClock() { clock.textContent = formatClock.format(new Date()); }
  updateClock(); setInterval(updateClock, 30000);

  const status = document.getElementById('radio-status');
  function tuneRadio(value) {
    let url;
    try { url = new URL(value); } catch { status.textContent = 'That station is missing! Paste a full Spotify share link.'; return false; }
    const match = url.pathname.match(/^\/(?:intl-[a-z-]+\/)?(playlist|album|track|artist)\/([A-Za-z0-9]{22})\/?$/);
    if (url.protocol !== 'https:' || url.hostname !== 'open.spotify.com' || !match) {
      status.textContent = 'Use an https://open.spotify.com link to a public playlist, album, track, or artist.'; return false;
    }
    const frame = document.createElement('iframe');
    frame.title = 'Spotify radio player'; frame.src = `https://open.spotify.com/embed/${match[1]}/${match[2]}?utm_source=generator&theme=0`;
    frame.allow = 'autoplay; clipboard-write; encrypted-media; fullscreen; picture-in-picture'; frame.allowFullscreen = true;
    document.getElementById('spotify-player').replaceChildren(frame);
    status.textContent = 'Station tuned. Press play in Spotify. Playback availability depends on Spotify and your region.';
    const fallback = document.createElement('a'); fallback.href = `https://open.spotify.com/${match[1]}/${match[2]}`; fallback.target = '_blank'; fallback.rel = 'noopener'; fallback.textContent = ' Player not loading? Open in Spotify ↗'; status.append(fallback);
    return true;
  }
  document.getElementById('spotify-form').addEventListener('submit', event => {
    event.preventDefault(); tuneRadio(document.getElementById('spotify-url').value.trim());
  });
  if (featuredSpotifyUrl) {
    document.getElementById('spotify-url').value = featuredSpotifyUrl;
    const button = document.createElement('button'); button.className = 'game-button'; button.textContent = 'Tune in to Jeffrey’s playlist';
    button.addEventListener('click', () => { tuneRadio(featuredSpotifyUrl); button.remove(); });
    document.getElementById('spotify-player').before(button);
  }
  const weatherButton = document.getElementById('weather-button');
  weatherButton.addEventListener('click', async () => {
    const weatherStatus = document.getElementById('weather-status');
    weatherButton.disabled = true; weatherStatus.textContent = 'Checking the forecast at the Pokémon Center…';
    const controller = new AbortController(); const timeout = setTimeout(() => controller.abort(), 8000);
    try {
      const response = await fetch('https://api.open-meteo.com/v1/forecast?latitude=33.02&longitude=-96.70&current=temperature_2m,weather_code&temperature_unit=fahrenheit&timezone=America%2FChicago', { signal: controller.signal });
      if (!response.ok) throw new Error('Weather unavailable');
      const data = await response.json();
      const temperature = data.current?.temperature_2m;
      const code = data.current?.weather_code;
      if (!Number.isFinite(temperature) || !Number.isFinite(code)) throw new Error('Invalid weather');
      const condition = code === 0 ? 'Clear skies' : code <= 3 ? 'A few clouds' : code <= 48 ? 'Foggy' : code <= 67 ? 'Rainy' : code <= 77 ? 'Snowy' : code <= 82 ? 'Rain showers' : code <= 86 ? 'Snow showers' : 'Thunderstorms';
      weatherStatus.textContent = `${Math.round(temperature)}°F · ${condition}. ${code < 4 ? 'A fine day for a side quest.' : 'Maybe an indoor side quest today.'} Checked just now.`;
    } catch { weatherStatus.textContent = 'The weather station is offline. Try again in a moment. Your adventure can continue.'; }
    finally { clearTimeout(timeout); weatherButton.disabled = false; weatherButton.textContent = 'Refresh local weather'; }
  });
})();
