// ======================
// Stage 2: Canvas API
// ======================
(() => {
  const canvas = document.getElementById('mapCanvas');
  const ctx = canvas.getContext('2d');

  // UI
  const filterButtons = Array.from(document.querySelectorAll('.filter-btn'));
  const resetBtn = document.getElementById('resetBtn');

  // Current filter
  let activeCat = 'all';
  let selectedPinIndex = -1;

  // Device pixel ratio scaling for crisp canvas
  function resizeCanvasToDisplaySize() {
    const dpr = window.devicePixelRatio || 1;
    // CSS size
    const rect = canvas.getBoundingClientRect();
    const width  = Math.round(rect.width * dpr);
    const height = Math.round(rect.height * dpr);

    if (canvas.width !== width || canvas.height !== height) {
      canvas.width = width;
      canvas.height = height;
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); // draw in CSS pixels
    }
  }

  // Simple data model (normalized coords 0..1 so it scales nicely)
  // Each pin: {x, y, cat, label, emoji}
  const PINS = [
    { x: 0.25, y: 0.25, cat: 'restaurants', label: 'Burger Place', emoji: '🍔' },
    { x: 0.52, y: 0.22, cat: 'restaurants', label: 'Pasta Bar', emoji: '🍝' },
    { x: 0.70, y: 0.30, cat: 'gas',         label: 'Fuel Station', emoji: '⛽' },
    { x: 0.18, y: 0.62, cat: 'hospitals',   label: 'City Hospital', emoji: '🏥' },
    { x: 0.42, y: 0.70, cat: 'stores',      label: 'Mini Market', emoji: '🛒' },
    { x: 0.82, y: 0.68, cat: 'hotels',      label: 'Blue Hotel', emoji: '🏨' },
    { x: 0.60, y: 0.50, cat: 'parking',     label: 'Public Parking', emoji: '🅿' }
  ];

  // Simple "you are here" (center-ish)
  const YOU = { x: 0.5, y: 0.55 };

  function drawBackgroundGrid() {
    const { width, height } = canvas.getBoundingClientRect();
    // Fill background
    ctx.fillStyle = '#eef3fb';
    ctx.fillRect(0, 0, width, height);

    // Grid
    ctx.strokeStyle = '#dce6f6';
    ctx.lineWidth = 1;
    const step = 50;
    ctx.beginPath();
    for (let x = 0; x <= width; x += step) {
      ctx.moveTo(x, 0);
      ctx.lineTo(x, height);
    }
    for (let y = 0; y <= height; y += step) {
      ctx.moveTo(0, y);
      ctx.lineTo(width, y);
    }
    ctx.stroke();

    // Some "blocks/roads" accents
    ctx.fillStyle = '#e7edf8';
    for (let i = 0; i < 6; i++) {
      const rw = 120, rh = 28;
      const rx = (i * 150 + 40) % (width - rw);
      const ry = (i * 90 + 30) % (height - rh);
      ctx.fillRect(rx, ry, rw, rh);
    }
  }

  function normToPx(p) {
    const rect = canvas.getBoundingClientRect();
    return { x: p.x * rect.width, y: p.y * rect.height };
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

    // label
    ctx.fillStyle = '#1e3a5f';
    ctx.font = '12px system-ui, Arial';
    ctx.fillText('You are here', x + 12, y + 4);
    ctx.restore();
  }

  function drawPins() {
    const rect = canvas.getBoundingClientRect();
    PINS.forEach((p, idx) => {
      if (activeCat !== 'all' && p.cat !== activeCat) return;

      const { x, y } = normToPx(p);

      // pin base
      ctx.save();
      ctx.beginPath();
      ctx.arc(x, y, 10, 0, Math.PI * 2);
      ctx.fillStyle = (idx === selectedPinIndex) ? '#ffcc66' : '#ffffff';
      ctx.fill();
      ctx.lineWidth = 2;
      ctx.strokeStyle = '#1e90ff';
      ctx.stroke();

      // emoji
      ctx.font = '16px system-ui, Apple Color Emoji, Segoe UI Emoji';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = '#111';
      ctx.fillText(p.emoji, x, y);

      // label if selected
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

  // --- Interaction ---
  function setActiveCat(cat) {
    activeCat = cat;
    selectedPinIndex = -1;
    filterButtons.forEach(btn =>
      btn.setAttribute('aria-pressed', btn.dataset.cat === cat ? 'true' : 'false')
    );
    render();
  }

  filterButtons.forEach(btn => {
    btn.addEventListener('click', () => setActiveCat(btn.dataset.cat));
  });

  resetBtn.addEventListener('click', () => {
    setActiveCat('all');
  });

  canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    let bestIdx = -1;
    let bestDist2 = 99999;
    PINS.forEach((p, idx) => {
      if (activeCat !== 'all' && p.cat !== activeCat) return;
      const { x, y } = normToPx(p);
      const dx = x - mx, dy = y - my;
      const d2 = dx * dx + dy * dy;
      if (d2 < bestDist2) { bestDist2 = d2; bestIdx = idx; }
    });

    // within 22px radius
    selectedPinIndex = bestDist2 <= (22 * 22) ? bestIdx : -1;
    render();
  });

  // Redraw on resize
  window.addEventListener('resize', render);

  // First paint
  render();
})();