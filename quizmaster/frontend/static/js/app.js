/* ══════════════════════════════════════════════
   QUIZMASTER — Frontend JS (Flask REST API)
══════════════════════════════════════════════ */

const API = '';
let currentUser = null;
let activeQuiz  = null;
let attemptId   = null;
let currentQIdx = 0;
let userAnswers = [];
let timerInt    = null;
let timeLeft    = 30;
let qBlockCount = 0;

// ── INIT ──
document.addEventListener('DOMContentLoaded', async () => {
  await checkSession();
  loadHomeStats();
});

async function checkSession() {
  try {
    const r = await fetch(`${API}/api/me`, { credentials: 'include' });
    const d = await r.json();
    if (d.user) setUser(d.user);
    else clearUser();
  } catch { clearUser(); }
}

function setUser(user) {
  currentUser = user;
  document.getElementById('nav-auth-btns').style.display = 'none';
  document.getElementById('nav-user').style.display = 'flex';
  document.getElementById('user-greeting').textContent = `Hi, ${user.name.split(' ')[0]}`;
  document.getElementById('nav-quizzes').style.display = '';
  document.getElementById('nav-history').style.display = '';
  if (user.role === 'admin') document.getElementById('nav-admin').style.display = '';
}

function clearUser() {
  currentUser = null;
  document.getElementById('nav-auth-btns').style.display = 'flex';
  document.getElementById('nav-user').style.display = 'none';
  document.getElementById('nav-quizzes').style.display = 'none';
  document.getElementById('nav-history').style.display = 'none';
  document.getElementById('nav-admin').style.display = 'none';
}

// ── NAVIGATION ──
function navigate(page) {
  document.querySelectorAll('.page').forEach(p => p.classList.remove('active'));
  window.scrollTo({ top: 0, behavior: 'smooth' });
  const map = {
    home:'page-home', quizzes:'page-quizzes', quiz:'page-quiz',
    result:'page-result', history:'page-history', admin:'page-admin'
  };
  const el = document.getElementById(map[page]);
  if (el) el.classList.add('active');
  if (page === 'quizzes') loadQuizGrid();
  if (page === 'history') loadHistory();
  if (page === 'admin')   loadAdmin();
}

function requireLogin(cb) {
  if (currentUser) cb();
  else openModal('login-modal');
}

// ── AUTH ──
async function doLogin() {
  const email = document.getElementById('l-email').value.trim();
  const pass  = document.getElementById('l-pass').value;
  if (!email || !pass) return toast('Fill in all fields', 'error');
  try {
    const r = await fetch(`${API}/api/login`, {
      method:'POST', credentials:'include',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ email, password: pass })
    });
    const d = await r.json();
    if (!r.ok) return toast(d.error || 'Login failed', 'error');
    setUser(d.user);
    closeModal('login-modal');
    toast(`Welcome back, ${d.user.name.split(' ')[0]}!`, 'success');
    loadHomeStats();
  } catch { toast('Connection error', 'error'); }
}

async function doRegister() {
  const name  = document.getElementById('r-name').value.trim();
  const email = document.getElementById('r-email').value.trim();
  const pass  = document.getElementById('r-pass').value;
  const role  = document.getElementById('r-role').value;
  if (!name || !email || !pass) return toast('Fill in all fields', 'error');
  try {
    const r = await fetch(`${API}/api/register`, {
      method:'POST', credentials:'include',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ name, email, password: pass, role })
    });
    const d = await r.json();
    if (!r.ok) return toast(d.error || 'Registration failed', 'error');
    setUser(d.user);
    closeModal('register-modal');
    toast(`Welcome, ${d.user.name.split(' ')[0]}!`, 'success');
    loadHomeStats();
  } catch { toast('Connection error', 'error'); }
}

async function logout() {
  await fetch(`${API}/api/logout`, { method:'POST', credentials:'include' });
  clearUser();
  navigate('home');
  toast('Logged out', 'success');
}

// ── HOME STATS ──
async function loadHomeStats() {
  try {
    const r = await fetch(`${API}/api/quizzes`, { credentials:'include' });
    if (!r.ok) return;
    const d = await r.json();
    const quizzes = d.quizzes || [];
    document.getElementById('home-quiz-count').textContent = quizzes.length || '—';
    const totalQ = quizzes.reduce((s,q) => s + (q.question_count || 0), 0);
    document.getElementById('home-q-count').textContent = totalQ || '—';
  } catch {}
}

// ── QUIZ GRID ──
async function loadQuizGrid() {
  const grid = document.getElementById('quiz-grid');
  grid.innerHTML = '<div class="loading-spinner">Loading quizzes…</div>';
  try {
    const r = await fetch(`${API}/api/quizzes`, { credentials:'include' });
    const d = await r.json();
    if (!r.ok) { grid.innerHTML = `<div class="empty-state">⚠️ ${d.error}</div>`; return; }
    if (!d.quizzes.length) { grid.innerHTML = '<div class="empty-state">No quizzes available yet.</div>'; return; }
    grid.innerHTML = d.quizzes.map(q => `
      <div class="quiz-card">
        <div class="qc-cat">${q.category || 'General'}</div>
        <div class="qc-title">${q.title}</div>
        <div class="qc-desc">${q.description || 'Test your knowledge!'}</div>
        <div class="qc-meta">
          <span>📝 ${q.question_count} Questions</span>
          <span>⏱ ${q.time_per_q}s each</span>
        </div>
        <button class="qc-btn" onclick="beginQuiz(${q.id})">Start Quiz →</button>
      </div>
    `).join('');
  } catch { grid.innerHTML = '<div class="empty-state">Could not load quizzes.</div>'; }
}

// ── QUIZ ENGINE ──
async function beginQuiz(quizId) {
  if (!currentUser) { openModal('login-modal'); return; }
  try {
    const r = await fetch(`${API}/api/quizzes/${quizId}`, { credentials:'include' });
    const d = await r.json();
    if (!r.ok) return toast(d.error, 'error');
    activeQuiz = d.quiz;

    const ar = await fetch(`${API}/api/attempts/start`, {
      method:'POST', credentials:'include',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ quiz_id: quizId })
    });
    const ad = await ar.json();
    attemptId   = ad.attempt_id;
    currentQIdx = 0;
    userAnswers = new Array(activeQuiz.questions.length).fill(null);

    navigate('quiz');
    document.getElementById('qtb-title').textContent = activeQuiz.title;
    document.getElementById('qtb-fill').style.width  = '0%';
    renderQuestion();
  } catch { toast('Could not start quiz', 'error'); }
}

function renderQuestion() {
  clearInterval(timerInt);
  const q     = activeQuiz.questions[currentQIdx];
  const total = activeQuiz.questions.length;

  document.getElementById('qtb-counter').textContent    = `${currentQIdx + 1} / ${total}`;
  document.getElementById('qtb-fill').style.width       = `${(currentQIdx / total) * 100}%`;
  document.getElementById('q-badge').textContent        = q.q_type === 'mcq' ? 'Multiple Choice' : 'True / False';
  document.getElementById('q-text').textContent         = q.question_text;
  document.getElementById('btn-next').style.display     = 'none';
  document.querySelector('.timeout-msg')?.remove();

  const labels = ['A','B','C','D'];
  document.getElementById('q-options').innerHTML = q.options.map((opt, i) => `
    <button class="q-opt" id="qopt_${i}" onclick="pickOption(${i}, ${opt.id})">
      <span class="opt-lbl">${q.q_type === 'tf' ? (i===0?'T':'F') : labels[i]}</span>
      ${opt.option_text}
    </button>
  `).join('');

  startTimer(activeQuiz.time_per_q);
}

function pickOption(idx, optionId) {
  if (userAnswers[currentQIdx] !== null) return;
  clearInterval(timerInt);
  const q = activeQuiz.questions[currentQIdx];
  userAnswers[currentQIdx] = { question_id: q.id, selected_option_id: optionId };

  q.options.forEach((opt, i) => {
    const btn = document.getElementById('qopt_' + i);
    if (!btn) return;
    btn.disabled = true;
    if (opt.is_correct)            btn.classList.add('correct');
    if (i === idx && !opt.is_correct) btn.classList.add('wrong');
    if (i === idx)                 btn.classList.add('selected');
  });
  showNextBtn();
}

function showNextBtn() {
  const btn = document.getElementById('btn-next');
  btn.style.display = 'block';
  btn.textContent   = currentQIdx >= activeQuiz.questions.length - 1 ? 'Finish Quiz 🏁' : 'Next Question →';
}

function startTimer(secs) {
  timeLeft = secs;
  const circ = 276.46;
  const ring = document.getElementById('tcircle');
  const num  = document.getElementById('timer-num');

  const update = () => {
    num.textContent = timeLeft;
    ring.style.strokeDashoffset = circ - (timeLeft / secs) * circ;
    if      (timeLeft <= 5)  { ring.style.stroke = 'var(--red)';   num.style.color = 'var(--red)'; }
    else if (timeLeft <= 10) { ring.style.stroke = 'var(--gold)';  num.style.color = 'var(--gold)'; }
    else                     { ring.style.stroke = 'var(--pink-mid)'; num.style.color = ''; }
  };
  update();

  timerInt = setInterval(() => {
    timeLeft--;
    update();
    if (timeLeft <= 0) { clearInterval(timerInt); autoSkip(); }
  }, 1000);
}

function autoSkip() {
  const q = activeQuiz.questions[currentQIdx];
  q.options.forEach((opt, i) => {
    const btn = document.getElementById('qopt_' + i);
    if (btn) { btn.disabled = true; if (opt.is_correct) btn.classList.add('correct'); }
  });
  const msg = document.createElement('p');
  msg.className = 'timeout-msg';
  msg.textContent = "⏰ Time's up!";
  document.getElementById('q-card').appendChild(msg);
  showNextBtn();
}

function nextQ() {
  currentQIdx++;
  if (currentQIdx >= activeQuiz.questions.length) finishQuiz();
  else renderQuestion();
}

function quitQuiz() {
  if (!confirm('Quit this quiz? Progress will be lost.')) return;
  clearInterval(timerInt);
  activeQuiz = null; attemptId = null;
  navigate('quizzes');
}

async function finishQuiz() {
  clearInterval(timerInt);
  const answers = activeQuiz.questions.map((q, i) =>
    userAnswers[i] || { question_id: q.id, selected_option_id: null }
  );
  try {
    const r = await fetch(`${API}/api/attempts/submit`, {
      method:'POST', credentials:'include',
      headers:{'Content-Type':'application/json'},
      body: JSON.stringify({ attempt_id: attemptId, answers })
    });
    if (!r.ok) { toast('Error submitting quiz', 'error'); return; }
    loadResult(attemptId);
  } catch { toast('Submission error', 'error'); }
}

// ── RESULTS ──
async function loadResult(aid) {
  navigate('result');
  try {
    const r = await fetch(`${API}/api/attempts/${aid}/result`, { credentials:'include' });
    const d = await r.json();
    if (!r.ok) return;
    const res = d.result;

    const correct = res.answers.filter(a => a.is_correct).length;
    const skipped = res.answers.filter(a => !a.selected_opt).length;
    const wrong   = res.answers.length - correct - skipped;
    const pct     = Math.round((correct / res.total_q) * 100);

    document.getElementById('r-score-frac').textContent = `${correct}/${res.total_q}`;
    document.getElementById('r-score-pct').textContent  = `${pct}%`;
    document.getElementById('r-correct').textContent    = correct;
    document.getElementById('r-wrong').textContent      = wrong;
    document.getElementById('r-skip').textContent       = skipped;
    document.getElementById('r-quiz-name').textContent  = res.quiz_title;

    const grade = pct===100?'🏆 Perfect!':pct>=80?'🌟 Excellent!':pct>=60?'👍 Good Job!':pct>=40?'📚 Keep Practicing!':'💪 Try Again!';
    document.getElementById('r-grade').textContent = grade;

    setTimeout(() => {
      const ring = document.getElementById('rring');
      ring.style.strokeDashoffset = 376.99 - (pct/100)*376.99;
      ring.style.stroke = pct>=80?'var(--green)':pct>=50?'var(--gold)':'var(--red)';
    }, 300);

    document.getElementById('review-list').innerHTML = res.answers.map((a, i) => {
      const isCorrect = a.is_correct;
      const isSkipped = !a.selected_opt;
      const sc = isCorrect?'c':isSkipped?'s':'w';
      const si = isCorrect?'✓':isSkipped?'—':'✗';
      const body = !isCorrect ? `<div class="rv-body">
        ${!isSkipped?`<div class="rv-row"><span class="rv-lbl">Your Answer:</span><span class="rv-your">${a.selected_text||'—'}</span></div>`:''}
        <div class="rv-row"><span class="rv-lbl">Correct Answer:</span><span class="rv-correct">${a.correct_text}</span></div>
        <div class="rv-exp"><strong>💡 Explanation:</strong> ${a.explanation||'No explanation provided.'}</div>
      </div>` : '';
      return `<div class="rv-card">
        <div class="rv-head">
          <div class="rv-status ${sc}">${si}</div>
          <div class="rv-q-info">
            <small>Q${i+1} · ${a.q_type==='mcq'?'MCQ':'True/False'} · ${isCorrect?'Correct':isSkipped?'Skipped':'Wrong'}</small>
            ${a.question_text}
          </div>
        </div>${body}
      </div>`;
    }).join('');
  } catch(e) { console.error(e); }
}

// ── HISTORY ──
async function loadHistory() {
  const el = document.getElementById('history-list');
  el.innerHTML = '<div class="loading-spinner">Loading…</div>';
  try {
    const r = await fetch(`${API}/api/my-attempts`, { credentials:'include' });
    const d = await r.json();
    if (!r.ok) { el.innerHTML = `<div class="empty-state">${d.error}</div>`; return; }
    if (!d.attempts.length) { el.innerHTML = '<div class="empty-state">No attempts yet. Take your first quiz!</div>'; return; }
    el.innerHTML = d.attempts.map(a => {
      const pct  = a.total_q ? Math.round((a.score/a.total_q)*100) : 0;
      const cls  = pct>=80?'hi':pct>=50?'mid':'lo';
      const date = new Date(a.started_at).toLocaleDateString('en-IN',{day:'numeric',month:'short',year:'numeric'});
      return `<div class="history-row">
        <div>
          <div class="hr-title">${a.quiz_title}</div>
          <div class="hr-meta">${a.category} · ${date}</div>
        </div>
        <div class="hr-score ${cls}">${a.score}/${a.total_q} &nbsp;${pct}%</div>
      </div>`;
    }).join('');
  } catch { el.innerHTML = '<div class="empty-state">Error loading history.</div>'; }
}

// ── ADMIN ──
function adminSwitch(el) {
  document.querySelectorAll('.admin-nav li').forEach(l => l.classList.remove('an-active'));
  document.querySelectorAll('.admin-tab').forEach(t => t.classList.remove('at-active'));
  el.classList.add('an-active');
  const tab = el.getAttribute('data-tab');
  document.getElementById(tab).classList.add('at-active');
  if (tab==='tab-stats')   loadAdminStats();
  if (tab==='tab-quizzes') loadAdminQuizzes();
  if (tab==='tab-users')   loadAdminUsers();
}

async function loadAdmin() { loadAdminStats(); }

async function loadAdminStats() {
  try {
    const r = await fetch(`${API}/api/admin/stats`, { credentials:'include' });
    const d = await r.json();
    if (!r.ok) return;
    document.getElementById('st-students').textContent = d.students;
    document.getElementById('st-quizzes').textContent  = d.quizzes;
    document.getElementById('st-attempts').textContent = d.attempts;
    document.getElementById('st-avg').textContent      = d.avg_score + '%';
    document.getElementById('dt-top-quizzes').innerHTML = (d.top_quizzes||[]).map(q =>
      `<tr><td>${q.title}</td><td>${q.attempts}</td><td>${q.avg_score?Math.round(q.avg_score)+'%':'—'}</td></tr>`
    ).join('') || '<tr><td colspan="3" style="color:var(--muted);text-align:center">No data yet</td></tr>';
    document.getElementById('dt-top-students').innerHTML = (d.top_students||[]).map(s =>
      `<tr><td>${s.name}</td><td>${s.attempts}</td><td>${s.avg_score?Math.round(s.avg_score)+'%':'—'}</td></tr>`
    ).join('') || '<tr><td colspan="3" style="color:var(--muted);text-align:center">No data yet</td></tr>';
  } catch {}
}

async function loadAdminQuizzes() {
  const el = document.getElementById('admin-quiz-list');
  el.innerHTML = '<div class="loading-spinner">Loading…</div>';
  try {
    const r = await fetch(`${API}/api/quizzes`, { credentials:'include' });
    const d = await r.json();
    if (!d.quizzes.length) { el.innerHTML = '<div class="empty-state">No quizzes yet.</div>'; return; }
    el.innerHTML = d.quizzes.map(q => `
      <div class="aq-card">
        <div class="aq-info">
          <h4>${q.title}</h4>
          <p>${q.category} · ${q.question_count} questions · ${q.time_per_q}s · ${q.is_active?'✅ Active':'⏸ Inactive'}</p>
        </div>
        <div class="aq-btns">
          <button class="btn-sm btn-edit" onclick="adminEditQuiz(${q.id})">✎ Edit</button>
          <button class="btn-sm btn-del"  onclick="adminDeleteQuiz(${q.id}, '${q.title.replace(/'/g,"\\'")}')">✕ Delete</button>
        </div>
      </div>
    `).join('');
  } catch {}
}

async function adminDeleteQuiz(id, title) {
  if (!confirm(`Delete "${title}"? Cannot be undone.`)) return;
  try {
    const r = await fetch(`${API}/api/quizzes/${id}`,{method:'DELETE',credentials:'include'});
    if (r.ok) { toast('Quiz deleted','success'); loadAdminQuizzes(); }
    else toast('Delete failed','error');
  } catch { toast('Error','error'); }
}

async function adminEditQuiz(id) {
  try {
    const r = await fetch(`${API}/api/quizzes/${id}`,{credentials:'include'});
    const d = await r.json();
    const q = d.quiz;
    document.getElementById('form-heading').textContent = 'Edit Quiz';
    document.getElementById('edit-id').value  = id;
    document.getElementById('f-title').value  = q.title;
    document.getElementById('f-desc').value   = q.description||'';
    document.getElementById('f-cat').value    = q.category||'';
    document.getElementById('f-time').value   = q.time_per_q;
    document.getElementById('q-blocks').innerHTML = '';
    qBlockCount = 0;
    q.questions.forEach(ques => addQ(ques.q_type, ques));
    adminSwitch(document.querySelector('[data-tab="tab-create"]'));
  } catch { toast('Could not load quiz','error'); }
}

function addQ(type, data=null) {
  qBlockCount++;
  const id = 'qb_' + qBlockCount;
  const el = document.createElement('div');
  el.className = 'q-block'; el.id = id;

  if (type === 'mcq') {
    const opts = data ? data.options : [{option_text:''},{option_text:''},{option_text:''},{option_text:''}];
    const ci   = data ? opts.findIndex(o => o.is_correct) : 0;
    el.innerHTML = `
      <div class="qb-head"><span class="qb-type">MCQ</span>
        <button class="qb-del" onclick="document.getElementById('${id}').remove()">✕</button></div>
      <input type="text" placeholder="Enter question…" value="${esc(data?.question_text)}"/>
      <p class="opt-hint">● = correct answer</p>
      ${opts.map((o,i)=>`<div class="opt-row">
        <input type="radio" name="cr_${id}" value="${i}" ${i===ci?'checked':''}/>
        <input type="text" placeholder="Option ${i+1}" value="${esc(o.option_text)}"/>
      </div>`).join('')}
      <textarea placeholder="Explanation for the correct answer…">${esc(data?.explanation)}</textarea>
      <input type="hidden" class="q-type-val" value="mcq"/>`;
  } else {
    const ci = data ? data.options.findIndex(o=>o.is_correct) : 0;
    el.innerHTML = `
      <div class="qb-head"><span class="qb-type">True / False</span>
        <button class="qb-del" onclick="document.getElementById('${id}').remove()">✕</button></div>
      <input type="text" placeholder="Enter statement…" value="${esc(data?.question_text)}"/>
      <p class="opt-hint">● = correct answer</p>
      <div class="opt-row"><input type="radio" name="cr_${id}" value="0" ${ci===0?'checked':''}/><input type="text" value="True" readonly/></div>
      <div class="opt-row"><input type="radio" name="cr_${id}" value="1" ${ci===1?'checked':''}/><input type="text" value="False" readonly/></div>
      <textarea placeholder="Explanation…">${esc(data?.explanation)}</textarea>
      <input type="hidden" class="q-type-val" value="tf"/>`;
  }
  document.getElementById('q-blocks').appendChild(el);
}

function esc(s) { return (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }

async function submitQuizForm() {
  const title  = document.getElementById('f-title').value.trim();
  const desc   = document.getElementById('f-desc').value.trim();
  const cat    = document.getElementById('f-cat').value.trim();
  const time   = parseInt(document.getElementById('f-time').value);
  const editId = document.getElementById('edit-id').value;

  if (!title) return toast('Title is required','error');
  const blocks = document.querySelectorAll('.q-block');
  if (!blocks.length) return toast('Add at least one question','error');

  const questions = [];
  for (let i=0;i<blocks.length;i++) {
    const b    = blocks[i];
    const type = b.querySelector('.q-type-val').value;
    const text = b.querySelector('input[type=text]').value.trim();
    const expl = b.querySelector('textarea').value.trim();
    const cr   = b.querySelector('input[type=radio]:checked');
    if (!text) return toast(`Q${i+1}: Enter question text`,'error');
    if (!cr)   return toast(`Q${i+1}: Select correct answer`,'error');
    if (!expl) return toast(`Q${i+1}: Add an explanation`,'error');
    const ci   = parseInt(cr.value);
    const opts = [...b.querySelectorAll('.opt-row input[type=text]')].map((el,idx)=>({text:el.value.trim(),is_correct:idx===ci}));
    if (type==='mcq' && opts.some(o=>!o.text)) return toast(`Q${i+1}: Fill all options`,'error');
    questions.push({text,type,explanation:expl,options:opts});
  }

  const url    = editId ? `${API}/api/quizzes/${editId}` : `${API}/api/quizzes`;
  const method = editId ? 'PUT' : 'POST';
  try {
    const r = await fetch(url,{method,credentials:'include',headers:{'Content-Type':'application/json'},body:JSON.stringify({title,description:desc,category:cat,time_per_q:time,questions})});
    const d = await r.json();
    if (!r.ok) return toast(d.error||'Save failed','error');
    toast('Quiz saved! ✅','success');
    clearQuizForm();
    adminSwitch(document.querySelector('[data-tab="tab-quizzes"]'));
  } catch { toast('Error saving quiz','error'); }
}

function clearQuizForm() {
  ['f-title','f-desc','f-cat'].forEach(id => document.getElementById(id).value='');
  document.getElementById('f-time').value='30';
  document.getElementById('q-blocks').innerHTML='';
  document.getElementById('edit-id').value='';
  document.getElementById('form-heading').textContent='Create New Quiz';
  qBlockCount=0;
}

async function loadAdminUsers() {
  const wrap = document.getElementById('users-table-wrap');
  wrap.innerHTML = '<div class="loading-spinner">Loading…</div>';
  try {
    const r = await fetch(`${API}/api/admin/users`,{credentials:'include'});
    const d = await r.json();
    const rows = (d.users||[]).map(u=>`<tr>
      <td>${u.name}</td><td>${u.email}</td>
      <td><span class="role-badge role-${u.role}">${u.role}</span></td>
      <td>${u.total_attempts}</td>
      <td>${new Date(u.created_at).toLocaleDateString('en-IN')}</td>
    </tr>`).join('');
    wrap.innerHTML=`<table class="data-table">
      <thead><tr><th>Name</th><th>Email</th><th>Role</th><th>Attempts</th><th>Joined</th></tr></thead>
      <tbody>${rows||'<tr><td colspan="5" style="text-align:center;color:var(--muted)">No users yet</td></tr>'}</tbody>
    </table>`;
  } catch { wrap.innerHTML='<div class="empty-state">Error loading users.</div>'; }
}

// ── MODALS ──
function openModal(id)  { document.getElementById(id).classList.add('open'); }
function closeModal(id) { document.getElementById(id).classList.remove('open'); }
function closeModalOutside(e,id) { if(e.target.id===id) closeModal(id); }
function switchModal(from,to) { closeModal(from); openModal(to); }
document.addEventListener('keydown',e=>{
  if(e.key==='Escape') document.querySelectorAll('.modal-overlay.open').forEach(m=>m.classList.remove('open'));
});

// ── TOAST ──
let toastTimer;
function toast(msg, type='') {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.className   = 'toast show ' + type;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(()=>el.classList.remove('show'), 3000);
}
