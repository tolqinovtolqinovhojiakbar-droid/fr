'use strict';

/* ===========================================================
   SMART LEARNING & EXAM SYSTEM — APP.JS
   Vanilla ES6+. No dependencies. No frameworks.
   Sections:
     1. Storage / data model
     2. Content banks (tasks + quiz questions)
     3. Helpers (date, xp/level/grade math, toast, ripple)
     4. Login / auth
     5. Navigation (views, sidebar, topbar)
     6. Dashboard rendering
     7. Tasks view + task engine
     8. Quiz engine
     9. Analytics view + canvas chart
     10. Profile view
     11. Confirm modal (reset)
     12. Init
   =========================================================== */

/* ---------------------------------------------------------
   1. STORAGE / DATA MODEL
   --------------------------------------------------------- */
const DB_KEY = 'sles_db_v1';        // all users live here
const SESSION_KEY = 'sles_session_v1'; // which username is currently active

function todayStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function blankUser(username) {
  return {
    username,
    joinedDate: todayStr(),
    xp: 0,
    tasksCompleted: 0,
    quizzesTaken: 0,
    correctAnswers: 0,
    wrongAnswers: 0,
    completedTaskIds: [],          // task ids already solved correctly
    mistakesByTopic: {},           // { html: n, css: n, js: n }
    dailyLogins: {},               // { 'YYYY-MM-DD': count }
    dailyActivity: {},             // { 'YYYY-MM-DD': tasksOrQuestionsCount }
    lastLoginDate: null
  };
}

function loadDB() {
  try {
    const raw = localStorage.getItem(DB_KEY);
    if (!raw) return {};
    return JSON.parse(raw);
  } catch (err) {
    console.warn('Smart Learning System: could not read saved data, starting fresh.', err);
    return {};
  }
}

function saveDB() {
  try {
    localStorage.setItem(DB_KEY, JSON.stringify(db));
  } catch (err) {
    console.warn('Smart Learning System: could not save data (storage may be full or disabled).', err);
  }
}

let db = loadDB();             // { [username]: userObject }
let currentUsername = null;    // active session username

function getCurrentUser() {
  return db[currentUsername];
}

function persist() {
  saveDB();
}

/* ---------------------------------------------------------
   2. CONTENT BANKS
   --------------------------------------------------------- */

// ----- Tasks: multiple choice + code-input exercises -----
const TASKS = [
  {
    id: 't-html-1', topic: 'html', xp: 10, type: 'mcq',
    title: 'The root element',
    desc: 'Which tag wraps the entire content of an HTML document?',
    options: ['<body>', '<html>', '<head>', '<document>'],
    answerIndex: 1
  },
  {
    id: 't-html-2', topic: 'html', xp: 10, type: 'mcq',
    title: 'Image attribute',
    desc: 'Which attribute provides alternative text for an <img> tag?',
    options: ['title', 'alt', 'src', 'label'],
    answerIndex: 1
  },
  {
    id: 't-html-3', topic: 'html', xp: 15, type: 'code',
    title: 'Self-closing tag',
    desc: 'Type the HTML tag used to insert a horizontal line break (no closing tag needed).',
    answer: '<hr>'
  },
  {
    id: 't-html-4', topic: 'html', xp: 10, type: 'mcq',
    title: 'Semantic sectioning',
    desc: 'Which element is the most semantically correct choice for a page footer?',
    options: ['<div id="footer">', '<bottom>', '<footer>', '<section>'],
    answerIndex: 2
  },
  {
    id: 't-css-1', topic: 'css', xp: 10, type: 'mcq',
    title: 'Box model',
    desc: 'Which CSS property adds space inside an element, between its content and border?',
    options: ['margin', 'padding', 'gap', 'inset'],
    answerIndex: 1
  },
  {
    id: 't-css-2', topic: 'css', xp: 15, type: 'mcq',
    title: 'Flexbox alignment',
    desc: 'Which property aligns flex items along the main axis?',
    options: ['align-items', 'justify-content', 'flex-direction', 'align-content'],
    answerIndex: 1
  },
  {
    id: 't-css-3', topic: 'css', xp: 15, type: 'code',
    title: 'Centering text',
    desc: 'Type the CSS value used with `text-align` to center inline text.',
    answer: 'center'
  },
  {
    id: 't-css-4', topic: 'css', xp: 10, type: 'mcq',
    title: 'Units',
    desc: 'Which unit is relative to the root element\'s font size?',
    options: ['em', 'rem', 'vh', '%'],
    answerIndex: 1
  },
  {
    id: 't-js-1', topic: 'js', xp: 10, type: 'mcq',
    title: 'Equality checks',
    desc: 'Which operator checks both value and type in JavaScript?',
    options: ['==', '===', '=', '!='],
    answerIndex: 1
  },
  {
    id: 't-js-2', topic: 'js', xp: 15, type: 'mcq',
    title: 'Array methods',
    desc: 'Which array method creates a new array with the results of calling a function on every element?',
    options: ['forEach', 'filter', 'map', 'reduce'],
    answerIndex: 2
  },
  {
    id: 't-js-3', topic: 'js', xp: 20, type: 'code',
    title: 'Declaring a constant',
    desc: 'Type the keyword used to declare a block-scoped variable that cannot be reassigned.',
    answer: 'const'
  },
  {
    id: 't-js-4', topic: 'js', xp: 15, type: 'mcq',
    title: 'Storage API',
    desc: 'Which Web Storage API persists data with no expiration, even after the browser closes?',
    options: ['sessionStorage', 'cookies', 'localStorage', 'cache'],
    answerIndex: 2
  }
];

// ----- Quiz: pool of questions for timed rounds -----
const QUIZ_POOL = [
  { topic: 'html', q: 'What does HTML stand for?', options: ['Hyper Text Markup Language', 'Home Tool Markup Language', 'Hyperlinks Text Mark Language', 'Hyper Tool Multi Language'], answerIndex: 0 },
  { topic: 'html', q: 'Which tag creates a hyperlink?', options: ['<link>', '<a>', '<href>', '<nav>'], answerIndex: 1 },
  { topic: 'html', q: 'Which attribute specifies a unique id for an HTML element?', options: ['class', 'name', 'id', 'key'], answerIndex: 2 },
  { topic: 'html', q: 'Which tag is used for the largest heading?', options: ['<h6>', '<heading>', '<h1>', '<head>'], answerIndex: 2 },
  { topic: 'html', q: 'Which input type shows a calendar picker?', options: ['type="date"', 'type="calendar"', 'type="time"', 'type="picker"'], answerIndex: 0 },
  { topic: 'css', q: 'Which property controls text size?', options: ['text-size', 'font-style', 'font-size', 'text-style'], answerIndex: 2 },
  { topic: 'css', q: 'Which value makes an element a flex container?', options: ['display: flex', 'position: flex', 'flex: true', 'display: flex-box'], answerIndex: 0 },
  { topic: 'css', q: 'What does CSS stand for?', options: ['Cascading Style Sheets', 'Computer Style Sheets', 'Creative Style System', 'Cascading Style System'], answerIndex: 0 },
  { topic: 'css', q: 'Which property changes text color?', options: ['background-color', 'color', 'text-color', 'font-color'], answerIndex: 1 },
  { topic: 'css', q: 'Which CSS layout system uses rows and columns?', options: ['Flexbox', 'Float', 'Grid', 'Table'], answerIndex: 2 },
  { topic: 'js', q: 'Which keyword declares a function?', options: ['func', 'function', 'def', 'lambda'], answerIndex: 1 },
  { topic: 'js', q: 'What does `typeof []` return?', options: ['"array"', '"object"', '"list"', '"undefined"'], answerIndex: 1 },
  { topic: 'js', q: 'Which method converts a JSON string into an object?', options: ['JSON.stringify', 'JSON.parse', 'JSON.object', 'JSON.toObject'], answerIndex: 1 },
  { topic: 'js', q: 'Which loop is best for iterating a known number of times?', options: ['while', 'for', 'do...while', 'forEach only'], answerIndex: 1 },
  { topic: 'js', q: 'Which method adds an item to the end of an array?', options: ['push', 'pop', 'shift', 'unshift'], answerIndex: 0 }
];

/* ---------------------------------------------------------
   3. HELPERS
   --------------------------------------------------------- */
function clamp(value, min, max) { return Math.max(min, Math.min(max, value)); }
function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
function shuffle(arr) {
  const a = arr.slice();
  for (let i = a.length - 1; i > 0; i--) {
    const j = randInt(0, i);
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

// XP needed to FINISH a given level (level 1 needs 100, scales up slightly each level)
function xpForLevel(level) {
  return 100 + (level - 1) * 40;
}

function levelFromXp(xp) {
  let level = 1;
  let remaining = xp;
  while (remaining >= xpForLevel(level)) {
    remaining -= xpForLevel(level);
    level += 1;
  }
  return { level, xpIntoLevel: remaining, xpNeeded: xpForLevel(level) };
}

function badgeForLevel(level) {
  if (level >= 6) return { name: 'Advanced', cls: 'advanced' };
  if (level >= 3) return { name: 'Intermediate', cls: 'intermediate' };
  return { name: 'Beginner', cls: 'beginner' };
}

function gradeFromAccuracy(accuracyPct, totalAnswered) {
  if (totalAnswered === 0) return '—';
  if (accuracyPct >= 90) return 'A';
  if (accuracyPct >= 80) return 'B';
  if (accuracyPct >= 70) return 'C';
  if (accuracyPct >= 60) return 'D';
  return 'F';
}

function computeAccuracy(user) {
  const total = user.correctAnswers + user.wrongAnswers;
  if (total === 0) return { pct: 0, total: 0 };
  return { pct: Math.round((user.correctAnswers / total) * 100), total };
}

function last7Dates() {
  const out = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    out.push(d.toISOString().slice(0, 10));
  }
  return out;
}

function dayStreak(user) {
  // Counts consecutive days up to and including today with at least one login
  let streak = 0;
  for (let i = 0; i < 365; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const key = d.toISOString().slice(0, 10);
    if (user.dailyLogins[key]) {
      streak += 1;
    } else {
      break;
    }
  }
  return streak;
}

/* ---------------------------------------------------------
   Toast + ripple (shared UI utilities)
   --------------------------------------------------------- */
const toastEl = document.getElementById('toast');
let toastTimer = null;

function showToast(message, duration = 2400) {
  if (!toastEl) return;
  toastEl.textContent = message;
  toastEl.classList.add('show');
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => toastEl.classList.remove('show'), duration);
}

function addRipple(e) {
  const btn = e.currentTarget;
  const rect = btn.getBoundingClientRect();
  const ripple = document.createElement('span');
  const size = Math.max(rect.width, rect.height) * 1.2;
  ripple.className = 'ripple';
  ripple.style.width = ripple.style.height = `${size}px`;
  ripple.style.left = `${(e.clientX ?? rect.left + rect.width / 2) - rect.left - size / 2}px`;
  ripple.style.top = `${(e.clientY ?? rect.top + rect.height / 2) - rect.top - size / 2}px`;
  btn.appendChild(ripple);
  setTimeout(() => ripple.remove(), 650);
}

function attachRippleListeners(root = document) {
  root.querySelectorAll('.btn').forEach((btn) => {
    if (btn.dataset.rippleBound) return;
    btn.dataset.rippleBound = 'true';
    btn.style.position = btn.style.position || 'relative';
    btn.addEventListener('click', addRipple);
  });
}

function flyXpFloat(amount, anchorEl) {
  const float = document.getElementById('xpFloat');
  if (!float) return;
  let x = window.innerWidth / 2;
  let y = window.innerHeight / 2;
  if (anchorEl) {
    const rect = anchorEl.getBoundingClientRect();
    x = rect.left + rect.width / 2;
    y = rect.top;
  }
  float.style.left = `${x}px`;
  float.style.top = `${y}px`;
  float.textContent = `+${amount} XP`;
  float.classList.remove('fly');
  // restart animation
  void float.offsetWidth;
  float.classList.add('fly');
}

/* ---------------------------------------------------------
   4. LOGIN / AUTH
   --------------------------------------------------------- */
const loginScreen = document.getElementById('loginScreen');
const appShell = document.getElementById('appShell');
const loginForm = document.getElementById('loginForm');
const usernameInput = document.getElementById('usernameInput');
const loginHint = document.getElementById('loginHint');
const loginExisting = document.getElementById('loginExisting');
const existingUsersList = document.getElementById('existingUsersList');

function sanitizeUsername(raw) {
  return raw.trim().replace(/\s+/g, ' ').slice(0, 20);
}

function recordLoginForToday(user) {
  const today = todayStr();
  user.dailyLogins[today] = (user.dailyLogins[today] || 0) + 1;
  user.lastLoginDate = today;
}

function loginAs(username) {
  const clean = sanitizeUsername(username);
  if (!clean) {
    loginHint.textContent = 'Please enter a username to continue.';
    return;
  }
  if (!db[clean]) {
    db[clean] = blankUser(clean);
  }
  currentUsername = clean;
  recordLoginForToday(db[clean]);
  persist();
  try {
    sessionStorage.setItem(SESSION_KEY, clean);
  } catch (err) {
    console.warn('Smart Learning System: could not store session.', err);
  }
  enterApp();
}

function enterApp() {
  loginScreen.classList.add('hidden');
  appShell.classList.remove('hidden');
  renderAll();
}

function logout() {
  currentUsername = null;
  try { sessionStorage.removeItem(SESSION_KEY); } catch (err) { /* ignore */ }
  appShell.classList.add('hidden');
  loginScreen.classList.remove('hidden');
  usernameInput.value = '';
  loginHint.textContent = '';
  renderExistingUsers();
}

function renderExistingUsers() {
  const names = Object.keys(db);
  if (!names.length) {
    loginExisting.hidden = true;
    return;
  }
  loginExisting.hidden = false;
  existingUsersList.innerHTML = '';
  names.forEach((name) => {
    const chip = document.createElement('button');
    chip.type = 'button';
    chip.className = 'existing-user-chip';
    chip.textContent = name;
    chip.addEventListener('click', () => loginAs(name));
    existingUsersList.appendChild(chip);
  });
}

loginForm.addEventListener('submit', (e) => {
  e.preventDefault();
  loginAs(usernameInput.value);
});

document.getElementById('logoutBtn').addEventListener('click', logout);
document.getElementById('switchUserBtn').addEventListener('click', logout);

/* ---------------------------------------------------------
   5. NAVIGATION (views, sidebar, topbar)
   --------------------------------------------------------- */
const VIEW_TITLES = {
  dashboard: 'Dashboard',
  tasks: 'Tasks',
  quiz: 'Quiz',
  analytics: 'Analytics',
  profile: 'Profile'
};

const sidebar = document.getElementById('sidebar');
const sidebarOverlay = document.getElementById('sidebarOverlay');
const sidebarToggle = document.getElementById('sidebarToggle');
const sidebarClose = document.getElementById('sidebarClose');
const topbarTitle = document.getElementById('topbarTitle');

function goToView(viewName) {
  document.querySelectorAll('.view').forEach((v) => v.classList.remove('active'));
  const target = document.getElementById(`view-${viewName}`);
  if (target) target.classList.add('active');

  document.querySelectorAll('.nav-item').forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.view === viewName);
  });

  topbarTitle.textContent = VIEW_TITLES[viewName] || 'Dashboard';
  closeSidebar();

  // Render the relevant view fresh each time it's opened
  if (viewName === 'dashboard') renderDashboard();
  if (viewName === 'tasks') renderTasks();
  if (viewName === 'analytics') renderAnalytics();
  if (viewName === 'profile') renderProfile();
  // quiz view keeps its own state machine; only reset if not mid-quiz
  if (viewName === 'quiz' && !quizState.active) resetQuizView();
}

document.querySelectorAll('.nav-item').forEach((btn) => {
  btn.addEventListener('click', () => goToView(btn.dataset.view));
});
document.querySelectorAll('[data-go]').forEach((btn) => {
  btn.addEventListener('click', () => goToView(btn.dataset.go));
});

function openSidebar() {
  sidebar.classList.add('open');
  sidebarOverlay.classList.add('show');
}
function closeSidebar() {
  sidebar.classList.remove('open');
  sidebarOverlay.classList.remove('show');
}
sidebarToggle.addEventListener('click', openSidebar);
sidebarClose.addEventListener('click', closeSidebar);
sidebarOverlay.addEventListener('click', closeSidebar);

/* ---------------------------------------------------------
   6. DASHBOARD RENDERING
   --------------------------------------------------------- */
const RING_CIRCUMFERENCE = 2 * Math.PI * 68; // matches r=68 in the SVG

function topicLabel(topic) {
  return { html: 'HTML', css: 'CSS', js: 'JavaScript' }[topic] || topic;
}

function buildSuggestion(user) {
  const topics = Object.entries(user.mistakesByTopic).filter(([, n]) => n > 0);
  if (!topics.length) {
    if (user.tasksCompleted === 0 && user.quizzesTaken === 0) {
      return 'Complete a task or quiz to get a personalized tip here.';
    }
    return "You're not showing any repeated mistakes yet — nice and consistent. Keep it up!";
  }
  topics.sort((a, b) => b[1] - a[1]);
  const [topTopic, count] = topics[0];
  return `You've missed ${count} ${topicLabel(topTopic)} question${count === 1 ? '' : 's'} so far. Try a few more ${topicLabel(topTopic)} tasks to lock it in.`;
}

function updateTopbar() {
  const user = getCurrentUser();
  if (!user) return;
  document.getElementById('topbarStreak').textContent = dayStreak(user);
  document.getElementById('topbarXp').textContent = user.xp;
  const initial = user.username.charAt(0).toUpperCase();
  document.getElementById('topbarInitial').textContent = initial;
}

function renderDashboard() {
  const user = getCurrentUser();
  if (!user) return;

  document.getElementById('dashboardGreeting').textContent = `Hi ${user.username} 👋`;

  const { level, xpIntoLevel, xpNeeded } = levelFromXp(user.xp);
  const badge = badgeForLevel(level);

  document.getElementById('ringLevel').textContent = level;
  document.getElementById('ringXpText').textContent = `${xpIntoLevel} / ${xpNeeded} XP`;
  const chip = document.getElementById('badgeChip');
  chip.textContent = badge.name;
  chip.className = `badge-chip ${badge.cls}`;

  const ratio = clamp(xpIntoLevel / xpNeeded, 0, 1);
  const ringFill = document.getElementById('ringFill');
  const offset = RING_CIRCUMFERENCE * (1 - ratio);
  // animate next frame so the transition actually plays from full to target
  requestAnimationFrame(() => { ringFill.style.strokeDashoffset = String(offset); });

  const { pct, total } = computeAccuracy(user);
  document.getElementById('statTotalXp').textContent = user.xp;
  document.getElementById('statTasksDone').textContent = user.tasksCompleted;
  document.getElementById('statQuizzesDone').textContent = user.quizzesTaken;
  document.getElementById('statAccuracy').textContent = total ? `${pct}%` : '—';
  document.getElementById('statGrade').textContent = gradeFromAccuracy(pct, total);

  const today = todayStr();
  document.getElementById('todayLogins').textContent = user.dailyLogins[today] || 0;
  document.getElementById('todayTasks').textContent = user.dailyActivity[today] || 0;
  document.getElementById('suggestionText').textContent = buildSuggestion(user);

  // Quick tasks: show up to 3 incomplete tasks
  const quickList = document.getElementById('quickTasksList');
  const incomplete = TASKS.filter((t) => !user.completedTaskIds.includes(t.id)).slice(0, 3);
  quickList.innerHTML = '';
  if (!incomplete.length) {
    const done = document.createElement('p');
    done.className = 'suggestion-text';
    done.textContent = "You've completed every available task! Try a quiz round instead.";
    quickList.appendChild(done);
  } else {
    incomplete.forEach((t) => {
      const row = document.createElement('div');
      row.className = 'quick-item';
      row.innerHTML = `
        <span>${t.title}</span>
        <span class="quick-item-tag">${topicLabel(t.topic)}</span>
        <span class="quick-item-xp">+${t.xp} XP</span>
      `;
      row.style.cursor = 'pointer';
      row.addEventListener('click', () => goToView('tasks'));
      quickList.appendChild(row);
    });
  }

  updateTopbar();
}

/* ---------------------------------------------------------
   Shared scoring/award logic (used by tasks + quiz)
   --------------------------------------------------------- */
function awardXp(amount) {
  const user = getCurrentUser();
  user.xp += amount;
}

function recordAnswer(topic, wasCorrect) {
  const user = getCurrentUser();
  if (wasCorrect) {
    user.correctAnswers += 1;
  } else {
    user.wrongAnswers += 1;
    user.mistakesByTopic[topic] = (user.mistakesByTopic[topic] || 0) + 1;
  }
  const today = todayStr();
  user.dailyActivity[today] = (user.dailyActivity[today] || 0) + 1;
}

/* ---------------------------------------------------------
   7. TASKS VIEW + TASK ENGINE
   --------------------------------------------------------- */
let currentTaskFilter = 'all';

function renderTasks() {
  const user = getCurrentUser();
  if (!user) return;
  const grid = document.getElementById('taskGrid');
  grid.innerHTML = '';

  const list = TASKS.filter((t) => currentTaskFilter === 'all' || t.topic === currentTaskFilter);

  list.forEach((task) => {
    const isDone = user.completedTaskIds.includes(task.id);
    const card = document.createElement('article');
    card.className = `task-card${isDone ? ' completed' : ''}`;
    card.dataset.taskId = task.id;

    const optionsHtml = task.type === 'mcq'
      ? `<div class="task-options">${task.options.map((opt, i) => `<button type="button" class="option-btn" data-index="${i}" ${isDone ? 'disabled' : ''}>${opt}</button>`).join('')}</div>`
      : `<div class="code-task-row">
           <input type="text" class="text-input code-task-input" placeholder="Type your answer…" ${isDone ? 'disabled' : ''} />
           <button type="button" class="btn btn-primary btn-sm code-task-submit" ${isDone ? 'disabled' : ''}>Check</button>
         </div>`;

    card.innerHTML = `
      <div class="task-card-head">
        <span class="task-topic-tag ${task.topic}">${topicLabel(task.topic)}</span>
        <span class="task-xp-tag">${isDone ? 'Completed' : `+${task.xp} XP`}</span>
      </div>
      <h3>${task.title}</h3>
      <p class="task-desc">${task.desc}</p>
      ${optionsHtml}
      <p class="task-feedback" data-feedback></p>
    `;
    grid.appendChild(card);

    if (isDone) {
      const fb = card.querySelector('[data-feedback]');
      fb.textContent = 'Already completed.';
      fb.className = 'task-feedback correct';
      return;
    }

    if (task.type === 'mcq') {
      card.querySelectorAll('.option-btn').forEach((btn) => {
        btn.addEventListener('click', () => handleMcqAnswer(task, card, Number(btn.dataset.index)));
      });
    } else {
      const input = card.querySelector('.code-task-input');
      const submitBtn = card.querySelector('.code-task-submit');
      const submit = () => handleCodeAnswer(task, card, input.value);
      submitBtn.addEventListener('click', submit);
      input.addEventListener('keydown', (e) => { if (e.key === 'Enter') submit(); });
    }
  });

  attachRippleListeners(grid);

  if (!list.length) {
    grid.innerHTML = '<p class="suggestion-text">No tasks in this category yet.</p>';
  }
}

function markTaskComplete(task) {
  const user = getCurrentUser();
  if (!user.completedTaskIds.includes(task.id)) {
    user.completedTaskIds.push(task.id);
    user.tasksCompleted += 1;
  }
}

function handleMcqAnswer(task, card, chosenIndex) {
  const user = getCurrentUser();
  const buttons = card.querySelectorAll('.option-btn');
  const isCorrect = chosenIndex === task.answerIndex;

  buttons.forEach((b) => { b.disabled = true; });
  buttons[task.answerIndex].classList.add('correct');
  if (!isCorrect) buttons[chosenIndex].classList.add('incorrect');

  const fb = card.querySelector('[data-feedback]');
  recordAnswer(task.topic, isCorrect);

  if (isCorrect) {
    awardXp(task.xp);
    markTaskComplete(task);
    fb.textContent = `Correct! +${task.xp} XP`;
    fb.className = 'task-feedback correct';
    flyXpFloat(task.xp, card);
    card.classList.add('completed');
  } else {
    fb.textContent = `Not quite — the correct answer is highlighted. No XP this time, but it won't count against retrying other tasks.`;
    fb.className = 'task-feedback incorrect';
  }

  card.querySelector('.task-xp-tag').textContent = isCorrect ? 'Completed' : `+${task.xp} XP`;
  persist();
  renderDashboard();
}

function handleCodeAnswer(task, card, rawValue) {
  const value = (rawValue || '').trim().toLowerCase();
  const expected = task.answer.trim().toLowerCase();
  const isCorrect = value === expected;

  const fb = card.querySelector('[data-feedback]');
  const input = card.querySelector('.code-task-input');
  const submitBtn = card.querySelector('.code-task-submit');

  recordAnswer(task.topic, isCorrect);

  if (isCorrect) {
    awardXp(task.xp);
    markTaskComplete(task);
    input.disabled = true;
    submitBtn.disabled = true;
    fb.textContent = `Correct! +${task.xp} XP`;
    fb.className = 'task-feedback correct';
    flyXpFloat(task.xp, card);
    card.classList.add('completed');
    card.querySelector('.task-xp-tag').textContent = 'Completed';
  } else {
    fb.textContent = `Not quite. Expected something like "${task.answer}" — try again.`;
    fb.className = 'task-feedback incorrect';
  }
  persist();
  renderDashboard();
}

document.getElementById('taskFilters').addEventListener('click', (e) => {
  const btn = e.target.closest('.chip');
  if (!btn) return;
  document.querySelectorAll('#taskFilters .chip').forEach((c) => c.classList.remove('active'));
  btn.classList.add('active');
  currentTaskFilter = btn.dataset.filter;
  renderTasks();
});

/* ---------------------------------------------------------
   8. QUIZ ENGINE
   --------------------------------------------------------- */
const QUIZ_LENGTH = 5;
const QUIZ_XP_PER_CORRECT = 12;

const quizIntro = document.getElementById('quizIntro');
const quizActive = document.getElementById('quizActive');
const quizResult = document.getElementById('quizResult');
const quizStartBtn = document.getElementById('quizStartBtn');
const quizRetryBtn = document.getElementById('quizRetryBtn');
const quizNextBtn = document.getElementById('quizNextBtn');

let quizState = {
  active: false,
  questions: [],
  index: 0,
  correctCount: 0,
  xpGained: 0,
  answered: false
};

function resetQuizView() {
  quizIntro.classList.remove('hidden');
  quizActive.classList.add('hidden');
  quizResult.classList.add('hidden');
  quizState = { active: false, questions: [], index: 0, correctCount: 0, xpGained: 0, answered: false };
}

function startQuiz() {
  quizState = {
    active: true,
    questions: shuffle(QUIZ_POOL).slice(0, QUIZ_LENGTH),
    index: 0,
    correctCount: 0,
    xpGained: 0,
    answered: false
  };
  quizIntro.classList.add('hidden');
  quizResult.classList.add('hidden');
  quizActive.classList.remove('hidden');
  renderQuizQuestion();
}

function renderQuizQuestion() {
  const q = quizState.questions[quizState.index];
  quizState.answered = false;

  document.getElementById('quizProgressText').textContent = `Question ${quizState.index + 1} of ${quizState.questions.length}`;
  document.getElementById('quizProgressFill').style.width = `${(quizState.index / quizState.questions.length) * 100}%`;
  document.getElementById('quizTopicTag').textContent = topicLabel(q.topic);
  document.getElementById('quizQuestion').textContent = q.q;

  const optionsWrap = document.getElementById('quizOptions');
  optionsWrap.innerHTML = '';
  q.options.forEach((opt, i) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'option-btn';
    btn.textContent = opt;
    btn.dataset.index = i;
    btn.addEventListener('click', () => handleQuizAnswer(i));
    optionsWrap.appendChild(btn);
  });

  const fb = document.getElementById('quizFeedback');
  fb.textContent = '';
  fb.className = 'quiz-feedback';
  quizNextBtn.classList.add('hidden');
}

function handleQuizAnswer(chosenIndex) {
  if (quizState.answered) return;
  quizState.answered = true;

  const q = quizState.questions[quizState.index];
  const isCorrect = chosenIndex === q.answerIndex;
  const buttons = document.querySelectorAll('#quizOptions .option-btn');
  buttons.forEach((b) => { b.disabled = true; });
  buttons[q.answerIndex].classList.add('correct');
  if (!isCorrect) buttons[chosenIndex].classList.add('incorrect');

  recordAnswer(q.topic, isCorrect);

  const fb = document.getElementById('quizFeedback');
  if (isCorrect) {
    quizState.correctCount += 1;
    quizState.xpGained += QUIZ_XP_PER_CORRECT;
    awardXp(QUIZ_XP_PER_CORRECT);
    fb.textContent = `Correct! +${QUIZ_XP_PER_CORRECT} XP`;
    fb.className = 'quiz-feedback correct';
    flyXpFloat(QUIZ_XP_PER_CORRECT, quizNextBtn);
  } else {
    fb.textContent = `Incorrect. The correct answer is highlighted above.`;
    fb.className = 'quiz-feedback incorrect';
  }

  persist();
  renderDashboard();

  const isLast = quizState.index === quizState.questions.length - 1;
  quizNextBtn.textContent = isLast ? 'See results' : 'Next question';
  quizNextBtn.classList.remove('hidden');
}

function advanceQuiz() {
  if (quizState.index < quizState.questions.length - 1) {
    quizState.index += 1;
    renderQuizQuestion();
  } else {
    finishQuiz();
  }
}

function finishQuiz() {
  const user = getCurrentUser();
  user.quizzesTaken += 1;
  persist();

  document.getElementById('quizProgressFill').style.width = '100%';
  quizActive.classList.add('hidden');
  quizResult.classList.remove('hidden');
  document.getElementById('quizScoreText').textContent = `${quizState.correctCount} / ${quizState.questions.length} correct`;
  document.getElementById('quizXpGained').textContent = `+${quizState.xpGained} XP this round`;

  quizState.active = false;
  renderDashboard();
}

quizStartBtn.addEventListener('click', startQuiz);
quizRetryBtn.addEventListener('click', startQuiz);
quizNextBtn.addEventListener('click', advanceQuiz);

/* ---------------------------------------------------------
   9. ANALYTICS VIEW + CANVAS CHART
   --------------------------------------------------------- */
function renderAnalytics() {
  const user = getCurrentUser();
  if (!user) return;

  const { pct, total } = computeAccuracy(user);
  document.getElementById('analyticsAccuracy').textContent = `${pct}%`;
  requestAnimationFrame(() => {
    document.getElementById('analyticsAccuracyFill').style.width = `${pct}%`;
  });
  document.getElementById('analyticsAccuracySub').textContent = `${user.correctAnswers} correct · ${user.wrongAnswers} wrong`;

  const today = todayStr();
  document.getElementById('analyticsLoginsToday').textContent = user.dailyLogins[today] || 0;

  const week = last7Dates();
  const weekLogins = week.reduce((sum, d) => sum + (user.dailyLogins[d] || 0), 0);
  document.getElementById('analyticsLoginsWeek').textContent = weekLogins;
  document.getElementById('analyticsStreak').textContent = dayStreak(user);

  renderWeakAreas(user);
  drawActivityChart(user);
}

function renderWeakAreas(user) {
  const wrap = document.getElementById('weakAreasList');
  const entries = Object.entries(user.mistakesByTopic).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]);
  wrap.innerHTML = '';
  if (!entries.length) {
    wrap.innerHTML = '<p class="weak-areas-empty">No repeated mistakes recorded yet — keep going!</p>';
    return;
  }
  const max = entries[0][1];
  entries.forEach(([topic, count]) => {
    const row = document.createElement('div');
    row.className = 'weak-area-row';
    const widthPct = Math.max(8, Math.round((count / max) * 100));
    row.innerHTML = `
      <span class="wa-name">${topicLabel(topic)}</span>
      <div class="wa-bar-track"><div class="wa-bar-fill" style="width:${widthPct}%"></div></div>
      <span class="wa-count">${count} mistake${count === 1 ? '' : 's'}</span>
    `;
    wrap.appendChild(row);
  });
}

function drawActivityChart(user) {
  const canvas = document.getElementById('activityChart');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  // Set actual pixel size from CSS layout for crisp rendering
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  const cssWidth = canvas.clientWidth || 560;
  const cssHeight = 220;
  canvas.width = cssWidth * dpr;
  canvas.height = cssHeight * dpr;
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  ctx.clearRect(0, 0, cssWidth, cssHeight);

  const dates = last7Dates();
  const values = dates.map((d) => user.dailyActivity[d] || 0);
  const max = Math.max(1, ...values);

  const paddingLeft = 32;
  const paddingBottom = 28;
  const chartW = cssWidth - paddingLeft - 12;
  const chartH = cssHeight - paddingBottom - 14;
  const barGap = 14;
  const barWidth = (chartW - barGap * (values.length - 1)) / values.length;

  // gridlines
  ctx.strokeStyle = 'rgba(255,255,255,0.07)';
  ctx.lineWidth = 1;
  const gridLines = 4;
  for (let i = 0; i <= gridLines; i++) {
    const y = 14 + (chartH / gridLines) * i;
    ctx.beginPath();
    ctx.moveTo(paddingLeft, y);
    ctx.lineTo(cssWidth - 12, y);
    ctx.stroke();
  }

  values.forEach((val, i) => {
    const x = paddingLeft + i * (barWidth + barGap);
    const barH = (val / max) * chartH;
    const y = 14 + chartH - barH;

    const grad = ctx.createLinearGradient(0, y, 0, y + barH);
    grad.addColorStop(0, '#22D3EE');
    grad.addColorStop(1, '#3B82F6');
    ctx.fillStyle = val > 0 ? grad : 'rgba(255,255,255,0.06)';

    const r = 6;
    const top = y;
    const h = Math.max(barH, val > 0 ? 4 : 2);
    ctx.beginPath();
    ctx.moveTo(x, top + h);
    ctx.lineTo(x, top + r);
    ctx.arcTo(x, top, x + r, top, r);
    ctx.lineTo(x + barWidth - r, top);
    ctx.arcTo(x + barWidth, top, x + barWidth, top + r, r);
    ctx.lineTo(x + barWidth, top + h);
    ctx.closePath();
    ctx.fill();

    // value label
    if (val > 0) {
      ctx.fillStyle = '#9CA1BD';
      ctx.font = '11px Inter, sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(String(val), x + barWidth / 2, top - 6);
    }

    // day label
    const d = new Date(dates[i]);
    const label = d.toLocaleDateString(undefined, { weekday: 'short' }).slice(0, 3);
    ctx.fillStyle = '#696E8C';
    ctx.font = '11px Inter, sans-serif';
    ctx.textAlign = 'center';
    ctx.fillText(label, x + barWidth / 2, cssHeight - 8);
  });
}

window.addEventListener('resize', () => {
  const view = document.getElementById('view-analytics');
  if (view && view.classList.contains('active')) {
    const user = getCurrentUser();
    if (user) drawActivityChart(user);
  }
});

/* ---------------------------------------------------------
   10. PROFILE VIEW
   --------------------------------------------------------- */
function renderProfile() {
  const user = getCurrentUser();
  if (!user) return;

  const initial = user.username.charAt(0).toUpperCase();
  document.getElementById('profileAvatar').textContent = initial;
  document.getElementById('profileUsername').textContent = user.username;
  document.getElementById('profileJoined').textContent = `Joined ${new Date(user.joinedDate).toLocaleDateString(undefined, { year: 'numeric', month: 'long', day: 'numeric' })}`;

  const { level } = levelFromXp(user.xp);
  const badge = badgeForLevel(level);
  const badgeEl = document.getElementById('profileBadge');
  badgeEl.textContent = badge.name;
  badgeEl.className = `badge-chip ${badge.cls}`;

  document.getElementById('profileXp').textContent = user.xp;
  document.getElementById('profileLevel').textContent = level;
  document.getElementById('profileTasks').textContent = user.tasksCompleted;
  document.getElementById('profileQuizzes').textContent = user.quizzesTaken;
  const { pct, total } = computeAccuracy(user);
  document.getElementById('profileGrade').textContent = gradeFromAccuracy(pct, total);
}

/* ---------------------------------------------------------
   11. CONFIRM MODAL (reset progress)
   --------------------------------------------------------- */
const confirmOverlay = document.getElementById('confirmOverlay');
document.getElementById('resetDataBtn').addEventListener('click', () => {
  confirmOverlay.classList.add('open');
});
document.getElementById('confirmCancelBtn').addEventListener('click', () => {
  confirmOverlay.classList.remove('open');
});
document.getElementById('confirmOkBtn').addEventListener('click', () => {
  const username = currentUsername;
  db[username] = blankUser(username);
  recordLoginForToday(db[username]);
  persist();
  confirmOverlay.classList.remove('open');
  showToast('Progress reset for this account.');
  renderAll();
});
confirmOverlay.addEventListener('click', (e) => {
  if (e.target === confirmOverlay) confirmOverlay.classList.remove('open');
});
document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape' && confirmOverlay.classList.contains('open')) {
    confirmOverlay.classList.remove('open');
  }
});

/* ---------------------------------------------------------
   12. INIT
   --------------------------------------------------------- */
function renderAll() {
  renderDashboard();
  renderTasks();
  renderAnalytics();
  renderProfile();
  resetQuizView();
  goToView('dashboard');
}

function init() {
  attachRippleListeners(document);

  let savedUsername = null;
  try { savedUsername = sessionStorage.getItem(SESSION_KEY); } catch (err) { /* ignore */ }

  if (savedUsername && db[savedUsername]) {
    currentUsername = savedUsername;
    recordLoginForToday(db[savedUsername]);
    persist();
    enterApp();
  } else {
    renderExistingUsers();
  }
}

document.addEventListener('DOMContentLoaded', init);