// ============================================================
// DevReview AI — app.js (Fixed & Premium UI)
// Full frontend logic with glowing cursor, line numbers, tabs,
// loader, copy buttons, safe JSON parsing, backend-ready
// ============================================================

// ---------- CUSTOM CURSOR & TRAIL ----------
const cursor = document.getElementById('cursor');
const trail = document.getElementById('cursorTrail');
let mx = 0, my = 0, tx = 0, ty = 0;

document.addEventListener('mousemove', e => {
  mx = e.clientX; my = e.clientY;
  cursor.style.left = mx - 5 + 'px';
  cursor.style.top = my - 5 + 'px';
});

(function animateTrail() {
  tx += (mx - tx) * 0.12;
  ty += (my - ty) * 0.12;
  trail.style.left = tx - 13 + 'px';
  trail.style.top = ty - 13 + 'px';
  requestAnimationFrame(animateTrail);
})();

// ---------- STATE ----------
let selectedLang = 'python';
let lastResult = null;
let activeTab = 'all';

// ---------- LANGUAGE SELECTOR ----------
document.querySelectorAll('.lang-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    selectedLang = btn.dataset.lang;
  });
});

// ---------- LINE NUMBERS ----------
const codeInput = document.getElementById('codeInput');
const lineNums = document.getElementById('lineNums');
const lineCount = document.getElementById('lineCount');

function updateLineNumbers() {
  const lines = codeInput.value.split('\n').length;
  lineCount.textContent = lines + ' LINES';
  lineNums.innerHTML = Array.from({ length: lines }, (_, i) => i + 1).join('<br>');
  lineNums.scrollTop = codeInput.scrollTop;
}

codeInput.addEventListener('input', updateLineNumbers);
codeInput.addEventListener('scroll', () => { lineNums.scrollTop = codeInput.scrollTop; });
updateLineNumbers();

// ---------- FILE UPLOAD ----------
function loadFile(e) {
  const file = e.target.files[0];
  if (!file) return;
  const ext = file.name.split('.').pop().toLowerCase();
  const langMap = { py: 'python', js: 'javascript', c: 'c', cpp: 'cpp', java: 'java' };
  if (langMap[ext]) {
    selectedLang = langMap[ext];
    document.querySelectorAll('.lang-btn').forEach(b => {
      b.classList.toggle('active', b.dataset.lang === selectedLang);
    });
  }
  const reader = new FileReader();
  reader.onload = ev => { codeInput.value = ev.target.result; updateLineNumbers(); };
  reader.readAsText(file);
}

// ---------- CLEAR ----------
function clearAll() {
  codeInput.value = '';
  updateLineNumbers();
  showIdle();
  lastResult = null;
}

// ---------- TAB SWITCH ----------
function switchTab(el, tab) {
  document.querySelectorAll('.tab-btn').forEach(b => b.classList.remove('active'));
  el.classList.add('active');
  activeTab = tab;
  if (lastResult) renderResult(lastResult, tab);
}

// ---------- IDLE & LOADING STATES ----------
function showIdle() {
  document.getElementById('outputArea').innerHTML = `
    <div class="idle-state" id="idleState">
      <div class="idle-icon">⬡</div>
      <div class="idle-text">AWAITING CODE INPUT</div>
      <div style="font-family:'Share Tech Mono',monospace;font-size:0.6rem;letter-spacing:2px;color:var(--muted);opacity:0.4">
        PASTE CODE → SELECT LANGUAGE → CLICK ANALYZE
      </div>
    </div>`;
}

function showLoading() {
  document.getElementById('outputArea').innerHTML = `
    <div class="loading-state">
      <div class="loading-ring"></div>
      <div class="loading-text">ANALYZING CODE...</div>
      <div class="loading-sub">RUNNING 6 ANALYSIS LAYERS</div>
    </div>`;
}

// ---------- MAIN REVIEW FUNCTION ----------
async function reviewCode() {
  const code = codeInput.value.trim();
  if (!code) {
    flashError('// No code detected. Paste some code first.');
    return;
  }
  if (code.length > 15000) {
    flashError('// Code too long. Max 15,000 characters.');
    return;
  }

  const btn = document.getElementById('reviewBtn');
  btn.disabled = true;
  btn.querySelector('span').textContent = '⟳ ANALYZING...';
  showLoading();

  try {
    const response = await fetch('/api/review', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      // ✅ Fixed: only send code & language, no prompt leak
      body: JSON.stringify({ code, language: selectedLang })
    });

    if (!response.ok) {
      const err = await response.json().catch(() => ({}));
      throw new Error(err.error || `HTTP ${response.status}`);
    }

    const data = await response.json();

    if (!data.review) throw new Error('Invalid API response');

    const parsed = parseAIResponse(data.review); // ✅ Fixed: read review from API
    lastResult = parsed;
    renderResult(parsed, activeTab);

  } catch (err) {
    document.getElementById('outputArea').innerHTML = `
      <div class="error-block">
        ⚠ ANALYSIS FAILED<br><br>
        ${escHtml(err.message)}<br><br>
        <span style="color:var(--muted);font-size:0.75rem">
          Check your API key in .env and ensure /api/review is deployed correctly.
        </span>
      </div>`;
  } finally {
    btn.disabled = false;
    btn.querySelector('span').textContent = '⚡ ANALYZE CODE';
  }
}

// ---------- SAFE JSON PARSER ----------
function parseAIResponse(raw) {
  let cleaned = raw.trim();
  cleaned = cleaned.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```\s*$/i, '');
  const start = cleaned.indexOf('{');
  const end = cleaned.lastIndexOf('}');
  if (start !== -1 && end !== -1) cleaned = cleaned.slice(start, end + 1);

  try {
    return JSON.parse(cleaned);
  } catch {
    return { raw: raw, parseError: true };
  }
}

// ---------- RENDER RESULTS ----------
function renderResult(data, tab = 'all') {
  if (data.parseError) {
    document.getElementById('outputArea').innerHTML = `
      <div class="result-block">
        <div class="result-block-header">⬡ RAW AI RESPONSE</div>
        <div class="result-block-body"><pre>${escHtml(data.raw)}</pre></div>
      </div>`;
    return;
  }

  const out = document.getElementById('outputArea');
  let html = '';

  if (tab === 'all' || tab === 'score') html += renderScore(data);
  if (tab === 'all') {
    html += renderSummary(data);
    html += renderBugs(data);
    html += renderComplexity(data);
    html += renderSecurity(data);
    html += renderImprovements(data);
    html += renderOptimized(data);
  } else if (tab === 'bugs') html += renderBugs(data) + renderSecurity(data);
  else if (tab === 'optimize') html += renderOptimized(data) + renderImprovements(data);
  else if (tab === 'security') html += renderSecurity(data);

  out.innerHTML = html;

  const fill = document.querySelector('.score-bar-fill');
  if (fill) setTimeout(() => { fill.style.width = (data.score / 10 * 100) + '%'; }, 100);
}

// ---------- ESCAPE HTML ----------
function escHtml(str) {
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ---------- COPY TO CLIPBOARD ----------
function copyCode(id) {
  const el = document.getElementById(id);
  if (!el) return;
  navigator.clipboard.writeText(el.textContent).then(() => {
    const btn = el.previousElementSibling;
    btn.textContent = '✓ COPIED';
    setTimeout(() => btn.textContent = '⎘ COPY', 2000);
  });
}

// ---------- FLASH ERROR ----------
function flashError(msg) {
  document.getElementById('outputArea').innerHTML = `
    <div class="error-block">${escHtml(msg)}</div>`;
}

// ---------- KEYBOARD SHORTCUT ----------
document.addEventListener('keydown', e => {
  if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') reviewCode();
});
