// ==========================================
// STAGE 1: HTML + CSS
// STAGE 2: Canvas API (interactive map)
// STAGE 3: Audio API (Web Audio)
// + Geolocation demo: "Locate Me" updates the "You" point
// ==========================================
(() => {
  // ----------------------
  // Audio API: Web Audio Engine
  // ----------------------
  const AudioEngine = (() => {
    let ctx = null;
    let master = null;

    let ambient = null;
    let ambientOn = false;

    const clamp01 = (x) => Math.max(0, Math.min(1, x));

    function ensure() {
      if (ctx) return;
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) throw new Error('Web Audio API not supported');
      ctx = new AC();
      master = ctx.createGain();
      master.gain.value = 0.35;
      master.connect(ctx.destination);
    }

    async function init() {
      ensure();
      if (ctx.state === 'suspended') await ctx.resume();
      return true;
    }

    const isEnabled = () => !!ctx;

    function setVolume(v) {
      if (!master) return;
      master.gain.value = clamp01(Number(v));
    }

    function tone({ freq = 440, type = 'sine', gain = 0.18, attack = 0.005, decay = 0.12, dur = 0.04, detune = 0 }) {
      if (!ctx || !master) return;
      const t0 = ctx.currentTime;

      const o = ctx.createOscillator();
      const g = ctx.createGain();

      o.type = type;
      o.frequency.setValueAtTime(freq, t0);
      if (detune) o.detune.setValueAtTime(detune, t0);

      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(gain, t0 + attack);
      g.gain.exponentialRampToValueAtTime(0.0001, t0 + attack + decay);

      o.connect(g);
      g.connect(master);

      const stopAt = t0 + attack + decay + dur;
      o.start(t0);
      o.stop(stopAt);

      o.onended = () => {
        try { o.disconnect(); } catch (_) {}
        try { g.disconnect(); } catch (_) {}
      };
    }

    const click = () => tone({ freq: 620, type: 'square', gain: 0.12, attack: 0.001, decay: 0.05, dur: 0.01 });

    function ping(cat) {
      const freqByCat = { restaurants: 660, gas: 330, hospitals: 880, stores: 550, hotels: 440, parking: 220, all: 520 };
      const base = freqByCat[cat] || 520;
      tone({ freq: base, type: 'sine', gain: 0.18, attack: 0.005, decay: 0.18, dur: 0.02 });
      tone({ freq: base * 1.5, type: 'triangle', gain: 0.08, attack: 0.005, decay: 0.20, dur: 0.02, detune: -7 });
    }

    function startAmbient() {
      if (!ctx || !master || ambientOn) return;

      const t0 = ctx.currentTime;
      const osc1 = ctx.createOscillator();
      const osc2 = ctx.createOscillator();
      const filter = ctx.createBiquadFilter();
      const g = ctx.createGain();

      const lfo = ctx.createOscillator();
      const lfoGain = ctx.createGain();

      osc1.type = 'sawtooth';
      osc2.type = 'triangle';
      osc1.frequency.setValueAtTime(55, t0);
      osc2.frequency.setValueAtTime(110, t0);
      osc2.detune.setValueAtTime(-6, t0);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(450, t0);
      filter.Q.setValueAtTime(0.8, t0);

      lfo.type = 'sine';
      lfo.frequency.setValueAtTime(0.08, t0);
      lfoGain.gain.setValueAtTime(140, t0);

      lfo.connect(lfoGain);
      lfoGain.connect(filter.frequency);

      g.gain.setValueAtTime(0.0001, t0);
      g.gain.exponentialRampToValueAtTime(0.06, t0 + 0.5);

      osc1.connect(filter);
      osc2.connect(filter);
      filter.connect(g);
      g.connect(master);

      osc1.start(t0);
      osc2.start(t0);
      lfo.start(t0);

      ambient = { osc1, osc2, filter, g, lfo, lfoGain };
      ambientOn = true;
    }

    function stopAmbient() {
      if (!ambientOn || !ambient || !ctx) return;

      const t0 = ctx.currentTime;
      try {
        ambient.g.gain.cancelScheduledValues(t0);
        ambient.g.gain.setValueAtTime(ambient.g.gain.value, t0);
        ambient.g.gain.exponentialRampToValueAtTime(0.0001, t0 + 0.4);
      } catch (_) {}

      setTimeout(() => {
        try { ambient.osc1.stop(); } catch (_) {}
        try { ambient.osc2.stop(); } catch (_) {}
        try { ambient.lfo.stop(); } catch (_) {}
        [ambient.osc1, ambient.osc2, ambient.filter, ambient.g, ambient.lfo, ambient.lfoGain].forEach(n => {
          try { n.disconnect(); } catch (_) {}
        });
        ambient = null;
        ambientOn = false;
      }, 450);
    }

    function toggleAmbient() {
      if (ambientOn) stopAmbient();
      else startAmbient();
      return ambientOn;
    }

    const isAmbientOn = () => ambientOn;

    return { init, isEnabled, setVolume, click, ping, toggleAmbient, isAmbientOn };
  })();

  // Audio UI
  const audioInitBtn = document.getElementById('audioInitBtn');
  const ambientBtn = document.getElementById('ambientBtn');
  const volumeSlider = document.getElementById('volumeSlider');
  const audioStatus = document.getElementById('audioStatus');

  function refreshAudioUI() {
    const enabled = AudioEngine.isEnabled();
    if (!enabled) {
      audioStatus.textContent = 'Audio is disabled (click “Enable Audio”).';
      ambientBtn.disabled = true;
      ambientBtn.textContent = 'Ambient: Off';
      volumeSlider.disabled = true;
      return;
    }
    audioStatus.textContent = AudioEngine.isAmbientOn()
      ? 'Audio is enabled — ambient ON.'
      : 'Audio is enabled.';
    ambientBtn.disabled = false;
    ambientBtn.textContent = `Ambient: ${AudioEngine.isAmbientOn() ? 'On' : 'Off'}`;
    volumeSlider.disabled = false;
  }

  audioInitBtn.addEventListener('click', async () => {
    try {
      await AudioEngine.init();
      AudioEngine.click();
      refreshAudioUI();
    } catch (e) {
      console.error(e);
      audioStatus.textContent = 'Could not enable audio (Web Audio API not supported).';
    }
  });

  ambientBtn.addEventListener('click', () => {
    AudioEngine.toggleAmbient();
    AudioEngine.click();
    refreshAudioUI();
  });

  volumeSlider.addEventListener('input', (e) => AudioEngine.setVolume(e.target.value));

  refreshAudioUI();

  // ----------------------
  // Canvas API: Map
  // ----------------------
  const canvas = document.getElementById('mapCanvas');
  const ctx = canvas.getContext('2d');

  const filterButtons = Array.from(document.querySelectorAll('.filter-btn'));
  const resetBtn = document.getElementById('resetBtn');

  let activeCat = 'all';
  let selectedPinIndex = -1;

  // "You" starts centered; can be updated with geolocation
  const YOU = { x: 0.5, y: 0.55 };

  const PINS = [
    { x: 0.25, y: 0.25, cat: 'restaurants', label: 'Burger Place', emoji: '🍔' },
    { x: 0.52, y: 0.22, cat: 'restaurants', label: 'Pasta Bar', emoji: '🍝' },
    { x: 0.70, y: 0.30, cat: 'gas',         label: 'Fuel Station', emoji: '⛽' },
    { x: 0.18, y: 0.62, cat: 'hospitals',   label: 'City Hospital', emoji: '🏥' },
    { x: 0.42, y: 0.70, cat: 'stores',      label: 'Mini Market', emoji: '🛒' },
    { x: 0.82, y: 0.68, cat: 'hotels',      label: 'Blue Hotel', emoji: '🏨' },
    { x: 0.60, y: 0.50, cat: 'parking',     label: 'Public Parking', emoji: '🅿' }
  ];

  function resizeCanvasToDisplaySize() {
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    const width  = Math.round(rect.width * dpr);
    const height = Math.round(rect.height * dpr);

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    }
  }

  function normToPx(p) {
    const rect = canvas.getBoundingClientRect();
    return { x: p.x * rect.width, y: p.y * rect.height };
  }

  function drawBackgroundGrid() {
    const { width, height } = canvas.getBoundingClientRect();
    ctx.fillStyle = '#eef3fb';
    ctx.fillRect(0, 0, width, height);

    ctx.strokeStyle = '#dce6f6';
    ctx.lineWidth = 1;
    const step = 50;
    ctx.beginPath();
    for (let x = 0; x <= width; x += step) { ctx.moveTo(x, 0); ctx.lineTo(x, height); }
    for (let y = 0; y <= height; y += step) { ctx.moveTo(0, y); ctx.lineTo(width, y); }
    ctx.stroke();

    ctx.fillStyle = '#e7edf8';
    for (let i = 0; i < 6; i++) {
      const rw = 120, rh = 28;
      const rx = (i * 150 + 40) % (width - rw);
      const ry = (i * 90 + 30) % (height - rh);
      ctx.fillRect(rx, ry, rw, rh);
    }
  }

  function drawYou() {
    const { x, y } = normToPx(YOU);
    ctx.save();
    ctx.beginPath();
    ctx.arc(x, y, 8, 0, Math.PI * 2);
    ctx.fillStyle = '#1e90ff';
    ctx.fill();
    ctx.lineWidth = 2;
    ctx.strokeStyle = '#ffffff';
    ctx.stroke();

    ctx.fillStyle = '#1e3a5f';
    ctx.font = '12px system-ui, Arial';
    ctx.fillText('You', x + 12, y + 4);
    ctx.restore();
  }

  function drawPins() {
    PINS.forEach((p, idx) => {
      if (activeCat !== 'all' && p.cat !== activeCat) return;

      const { x, y } = normToPx(p);
      ctx.save();

      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fillStyle = (idx === selectedPinIndex) ? '#ffcc66' : '#ffffff';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#1e90ff';
      ctx.stroke();

      ctx.font = '16px system-ui, Apple Color Emoji, Segoe UI Emoji';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#111';
      ctx.fillText(p.emoji, x, y);

      if (idx === selectedPinIndex) {
        const pad = 6;
        const text = p.label;
        ctx.font = '12px system-ui, Arial';
        const w = ctx.measureText(text).width + pad * 2;
        const h = 22;

        ctx.fillStyle = '#ffffff';
        ctx.strokeStyle = '#87b9ff';
        ctx.lineWidth = 1.5;

        const bx = x + 14, by = y - h / 2;
        ctx.fillRect(bx, by, w, h);
        ctx.strokeRect(bx, by, w, h);

        ctx.fillStyle = '#1b4e9b';
        ctx.fillText(text, bx + w / 2, by + h / 2 + 1);
      }

      ctx.restore();
    });
  }

  function render() {
    resizeCanvasToDisplaySize();
    drawBackgroundGrid();
    drawYou();
    drawPins();
  }

  function setActiveCat(cat) {
    activeCat = cat;
    selectedPinIndex = -1;

    filterButtons.forEach(btn =>
      btn.setAttribute('aria-pressed', btn.dataset.cat === cat ? 'true' : 'false')
    );

    AudioEngine.click();
    render();
  }

  filterButtons.forEach(btn => btn.addEventListener('click', () => setActiveCat(btn.dataset.cat)));
  resetBtn.addEventListener('click', () => setActiveCat('all'));

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    let bestIdx = -1;
    let bestDist2 = Infinity;

    PINS.forEach((p, idx) => {
      if (activeCat !== 'all' && p.cat !== activeCat) return;
      const { x, y } = normToPx(p);
      const dx = x - mx, dy = y - my;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDist2) { bestDist2 = d2; bestIdx = idx; }
    });

    selectedPinIndex = bestDist2 <= (22 * 22) ? bestIdx : -1;

    if (selectedPinIndex !== -1) AudioEngine.ping(PINS[selectedPinIndex].cat);
    else AudioEngine.click();

    render();
  });

  window.addEventListener('resize', render);
  render();

  // ----------------------
  // Geolocation: Locate Me
  // ----------------------
  const locateBtn = document.getElementById('locateBtn');
  const locationStatus = document.getElementById('locationStatus');

  function projectLatLonTo01(lat, lon) {
    // Simple projection into [0..1] range (not a real map)
    const x = (lon + 180) / 360;
    const y = 1 - ((lat + 90) / 180);
    return { x: Math.max(0, Math.min(1, x)), y: Math.max(0, Math.min(1, y)) };
  }

  locateBtn.addEventListener('click', () => {
    if (!navigator.geolocation) {
      locationStatus.textContent = 'Geolocation is not supported in this browser.';
      AudioEngine.click();
      return;
    }

    locationStatus.textContent = 'Requesting location permission...';
    AudioEngine.click();

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const { latitude, longitude, accuracy } = pos.coords;
        locationStatus.textContent = `Location: ${latitude.toFixed(5)}, ${longitude.toFixed(5)} (±${Math.round(accuracy)}m)`;

        const p = projectLatLonTo01(latitude, longitude);
        YOU.x = p.x;
        YOU.y = p.y;

        AudioEngine.ping('all');
        render();
      },
      (err) => {
        locationStatus.textContent = `Location error: ${err.message}`;
        AudioEngine.click();
      },
      { enableHighAccuracy: false, timeout: 8000 }
    );
  });
})();
