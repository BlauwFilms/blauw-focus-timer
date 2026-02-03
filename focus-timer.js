/**
 * Creative Focus Timer | Blauw Films
 * A focus instrument for deep creative work
 */
(function() {
  'use strict';

  const STORAGE_KEY = 'blauw_focus_timer';
  const STATS_KEY = 'blauw_focus_stats';

  const defaultSettings = {
    focusDuration: 25, shortBreakDuration: 5, longBreakDuration: 15,
    cyclesBeforeLongBreak: 4, soundEnabled: false, autoStartBreaks: true, autoStartFocus: true
  };

  const defaultStats = { date: new Date().toDateString(), focusTime: 0, tasksCompleted: 0, pomodoros: 0, sessions: 0 };

  let state = {
    mode: 'pomodoro', isRunning: false, isPaused: false, currentTime: 25 * 60, totalTime: 25 * 60,
    sessionType: 'focus', completedCycles: 0, tasks: [], activeTaskIndex: -1,
    settings: { ...defaultSettings }, stats: { ...defaultStats }
  };

  let timerInterval = null, draggedItem = null;

  let breatheState = { isRunning: false, pattern: 'relaxing', phase: 'idle', phaseTime: 0, currentCycle: 0, totalCycles: 4 };
  let breatheInterval = null;

  const breathePatterns = {
    relaxing: { inhale: 4, holdIn: 7, exhale: 8, holdOut: 0, cycles: 4 },
    box: { inhale: 4, holdIn: 4, exhale: 4, holdOut: 4, cycles: 4 },
    energizing: { inhale: 4, holdIn: 0, exhale: 4, holdOut: 0, cycles: 6 }
  };

  const $ = s => document.querySelector(s);
  const $$ = s => document.querySelectorAll(s);

  const el = {};
  function cacheElements() {
    const ids = ['timerDisplay','sessionLabel','activeTaskDisplay','taskTimeRemaining','playPauseBtn','playIcon','pauseIcon',
      'resetBtn','skipBtn','progressRing','progressContainer','breakButtons','shortBreakBtn','longBreakBtn','settingsToggle',
      'settingsPanel','taskList','taskNameInput','taskDurationInput','addTaskBtn','emptyTaskState','clearCompletedBtn',
      'fullscreenBtn','pipBtn','fullscreenOverlay','exitFullscreenBtn','fullscreenTimerDisplay','fullscreenSessionLabel',
      'fullscreenActiveTask','fullscreenTaskTimeRemaining','fullscreenPlayPauseBtn','fullscreenPlayIcon','fullscreenPauseIcon',
      'fullscreenResetBtn','fullscreenSkipBtn','fullscreenProgressRing','resumeModal','resumeSessionBtn','discardSessionBtn',
      'resetStatsBtn','notificationSound','focusDuration','shortBreakDuration','longBreakDuration','cyclesBeforeLongBreak',
      'soundEnabled','autoStartBreaks','autoStartFocus','statFocusTime','statTasksCompleted','statPomodoros','statSessions',
      'breatheSection','breatheInnerCircle','breatheInstruction','breatheTimer','breathePlayPauseBtn','breathePlayIcon',
      'breathePauseIcon','breatheResetBtn','breatheCycles','fullscreenBreathe','fullscreenBreatheInnerCircle',
      'fullscreenBreatheInstruction','fullscreenBreatheTimer','fullscreenBreatheCycles'];
    ids.forEach(id => el[id] = $('#' + id));
  }

  function formatTime(s) {
    const h = Math.floor(s/3600), m = Math.floor((s%3600)/60), sec = s%60;
    return h > 0 ? `${h}:${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}` : `${String(m).padStart(2,'0')}:${String(sec).padStart(2,'0')}`;
  }
  function formatDuration(m) { const h = Math.floor(m/60); return h > 0 ? `${h}h ${m%60}m` : `${m}m`; }
  function formatStatTime(s) { return `${Math.floor(s/3600)}h ${Math.floor((s%3600)/60)}m`; }
  function generateId() { return Date.now().toString(36) + Math.random().toString(36).substr(2); }
  function escapeHtml(t) { const d = document.createElement('div'); d.textContent = t; return d.innerHTML; }

  function saveState() { try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ mode: state.mode, currentTime: state.currentTime, totalTime: state.totalTime, sessionType: state.sessionType, completedCycles: state.completedCycles, tasks: state.tasks, activeTaskIndex: state.activeTaskIndex, settings: state.settings, isRunning: state.isRunning, savedAt: Date.now() })); } catch(e) {} }
  function loadState() { try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch(e) { return null; } }
  function clearSavedState() { try { localStorage.removeItem(STORAGE_KEY); } catch(e) {} }
  function saveStats() { try { localStorage.setItem(STATS_KEY, JSON.stringify(state.stats)); } catch(e) {} }
  function loadStats() { try { const s = JSON.parse(localStorage.getItem(STATS_KEY)); return s && s.date === new Date().toDateString() ? s : {...defaultStats}; } catch(e) { return {...defaultStats}; } }

  function startTimer() {
    if (timerInterval) return;
    state.isRunning = true; state.isPaused = false;
    if (state.sessionType === 'focus' && state.stats.sessions === 0) state.stats.sessions = 1;
    timerInterval = setInterval(() => {
      if (state.mode === 'stopwatch') { state.currentTime++; if (state.sessionType === 'focus') state.stats.focusTime++; }
      else { state.currentTime--; if (state.sessionType === 'focus') state.stats.focusTime++; if (state.currentTime <= 0) { timerComplete(); return; } }
      updateDisplay(); saveState(); if (state.currentTime % 60 === 0) saveStats();
    }, 1000);
    updatePlayPauseButton(); saveState();
  }

  function pauseTimer() {
    state.isRunning = false; state.isPaused = true;
    if (timerInterval) { clearInterval(timerInterval); timerInterval = null; }
    updatePlayPauseButton(); saveState();
  }

  function resetTimer() {
    pauseTimer();
    if (state.mode === 'pomodoro') { state.sessionType = 'focus'; state.currentTime = state.settings.focusDuration * 60; state.totalTime = state.currentTime; }
    else if (state.mode === 'countdown') { const t = state.tasks[state.activeTaskIndex]; state.currentTime = t?.duration ? t.duration * 60 : 25 * 60; state.totalTime = state.currentTime; }
    else { state.currentTime = 0; state.totalTime = 0; }
    state.isPaused = false; updateDisplay(); saveState();
  }

  function skipTimer() { if (state.mode === 'pomodoro') timerComplete(); else if (state.mode === 'countdown') { completeCurrentTask(); moveToNextTask(); } }

  function timerComplete() {
    pauseTimer(); playNotificationSound();
    if (state.mode === 'pomodoro') {
      if (state.sessionType === 'focus') {
        state.stats.pomodoros++; state.completedCycles++;
        if (state.activeTaskIndex >= 0) { const t = state.tasks[state.activeTaskIndex]; if (t && !t.completed) { t.timeSpent = (t.timeSpent||0) + state.settings.focusDuration; if (t.duration && t.timeSpent >= t.duration) completeCurrentTask(); } }
        if (state.completedCycles >= state.settings.cyclesBeforeLongBreak) { state.sessionType = 'longBreak'; state.currentTime = state.settings.longBreakDuration * 60; state.completedCycles = 0; }
        else { state.sessionType = 'shortBreak'; state.currentTime = state.settings.shortBreakDuration * 60; }
        state.totalTime = state.currentTime;
        if (state.settings.autoStartBreaks) setTimeout(startTimer, 500);
      } else {
        state.sessionType = 'focus'; state.currentTime = state.settings.focusDuration * 60; state.totalTime = state.currentTime; state.stats.sessions++;
        if (state.settings.autoStartFocus) setTimeout(startTimer, 500);
      }
    } else if (state.mode === 'countdown') { completeCurrentTask(); moveToNextTask(); }
    updateDisplay(); renderTaskList(); updateStats(); saveState(); saveStats();
  }

  function startBreak(type) { pauseTimer(); state.sessionType = type; state.currentTime = (type === 'shortBreak' ? state.settings.shortBreakDuration : state.settings.longBreakDuration) * 60; state.totalTime = state.currentTime; updateDisplay(); startTimer(); }

  function addTask(name, duration) {
    if (!name.trim()) return;
    state.tasks.push({ id: generateId(), name: name.trim(), duration: duration || null, timeSpent: 0, completed: false, createdAt: Date.now() });
    if (state.activeTaskIndex === -1) { state.activeTaskIndex = 0; setTimerForTask(state.tasks[0]); }
    renderTaskList(); saveState();
  }

  function deleteTask(id) {
    const i = state.tasks.findIndex(t => t.id === id); if (i === -1) return;
    state.tasks.splice(i, 1);
    if (state.tasks.length === 0) state.activeTaskIndex = -1;
    else if (i <= state.activeTaskIndex) state.activeTaskIndex = Math.max(0, state.activeTaskIndex - 1);
    renderTaskList(); updateDisplay(); saveState();
  }

  function setActiveTask(id) {
    const i = state.tasks.findIndex(t => t.id === id); if (i === -1) return;
    state.activeTaskIndex = i;
    if (state.mode === 'countdown' && !state.isRunning) setTimerForTask(state.tasks[i]);
    renderTaskList(); updateDisplay(); saveState();
  }

  function setTimerForTask(task) { if (state.mode === 'countdown' && task?.duration) { state.currentTime = task.duration * 60; state.totalTime = state.currentTime; updateDisplay(); } }
  function completeCurrentTask() { if (state.activeTaskIndex >= 0 && state.tasks[state.activeTaskIndex]) { state.tasks[state.activeTaskIndex].completed = true; state.stats.tasksCompleted++; } }
  function moveToNextTask() { const n = state.tasks.findIndex((t,i) => i > state.activeTaskIndex && !t.completed); if (n !== -1) { state.activeTaskIndex = n; setTimerForTask(state.tasks[n]); } else state.activeTaskIndex = -1; renderTaskList(); updateDisplay(); saveState(); }
  function clearCompletedTasks() { state.tasks = state.tasks.filter(t => !t.completed); if (state.tasks.length === 0) state.activeTaskIndex = -1; else if (!state.tasks[state.activeTaskIndex]) state.activeTaskIndex = 0; renderTaskList(); updateDisplay(); saveState(); }

  function updateDisplay() {
    const timeStr = formatTime(state.currentTime);
    el.timerDisplay.textContent = timeStr; el.fullscreenTimerDisplay.textContent = timeStr;
    let label = 'Focus Time';
    if (state.sessionType === 'shortBreak') label = 'Short Break';
    else if (state.sessionType === 'longBreak') label = 'Long Break';
    else if (state.mode === 'stopwatch') label = 'Elapsed Time';
    else if (state.mode === 'countdown') label = 'Countdown';
    el.sessionLabel.textContent = label; el.fullscreenSessionLabel.textContent = label;
    const t = state.tasks[state.activeTaskIndex];
    const taskText = t ? t.name : 'No task selected';
    el.activeTaskDisplay.textContent = taskText; el.fullscreenActiveTask.textContent = taskText;
    if (t?.duration && state.sessionType === 'focus') {
      const spent = t.timeSpent || 0;
      const rem = Math.max(0, t.duration * 60 - spent * 60 - (state.settings.focusDuration * 60 - state.currentTime));
      const txt = rem > 0 ? formatTime(rem) + ' remaining' : '';
      el.taskTimeRemaining.textContent = txt; el.fullscreenTaskTimeRemaining.textContent = txt;
    } else if (t?.duration && state.mode === 'countdown') {
      const txt = formatTime(state.currentTime) + ' remaining';
      el.taskTimeRemaining.textContent = txt; el.fullscreenTaskTimeRemaining.textContent = txt;
    } else { el.taskTimeRemaining.textContent = ''; el.fullscreenTaskTimeRemaining.textContent = ''; }
    updateProgressRing();
    const isBreak = state.sessionType !== 'focus';
    el.timerDisplay.classList.toggle('break-mode', isBreak); el.fullscreenTimerDisplay.classList.toggle('break-mode', isBreak);
    el.progressRing.classList.toggle('break-mode', isBreak); el.fullscreenProgressRing.classList.toggle('break-mode', isBreak);
    el.breakButtons.style.display = state.mode === 'pomodoro' ? 'flex' : 'none';
    el.progressContainer.style.display = state.mode === 'stopwatch' ? 'none' : 'block';
    document.title = state.isRunning ? `${timeStr} - Focus Timer` : 'Creative Focus Timer';
    updatePiPIfActive();
  }

  function updateProgressRing() {
    if (state.mode === 'stopwatch' || state.totalTime === 0) return;
    const p = state.currentTime / state.totalTime;
    el.progressRing.style.strokeDashoffset = 565.48 * (1 - p);
    el.fullscreenProgressRing.style.strokeDashoffset = 816.81 * (1 - p);
  }

  function updatePlayPauseButton() {
    const r = state.isRunning;
    el.playIcon.style.display = r ? 'none' : 'block'; el.pauseIcon.style.display = r ? 'block' : 'none';
    el.fullscreenPlayIcon.style.display = r ? 'none' : 'block'; el.fullscreenPauseIcon.style.display = r ? 'block' : 'none';
    el.playPauseBtn.setAttribute('aria-label', r ? 'Pause timer' : 'Start timer');
    el.fullscreenPlayPauseBtn.setAttribute('aria-label', r ? 'Pause timer' : 'Start timer');
  }

  function updateStats() {
    el.statFocusTime.textContent = formatStatTime(state.stats.focusTime);
    el.statTasksCompleted.textContent = state.stats.tasksCompleted;
    el.statPomodoros.textContent = state.stats.pomodoros;
    el.statSessions.textContent = state.stats.sessions;
  }

  function renderTaskList() {
    el.taskList.innerHTML = '';
    el.emptyTaskState.style.display = state.tasks.length === 0 ? 'block' : 'none';
    state.tasks.forEach((task, idx) => {
      const li = document.createElement('li');
      li.className = 'ft-task-item' + (idx === state.activeTaskIndex ? ' active' : '') + (task.completed ? ' completed' : '');
      li.dataset.id = task.id; li.draggable = true;
      li.innerHTML = `<div class="ft-task-drag-handle"><svg width="12" height="12" viewBox="0 0 24 24" fill="currentColor"><circle cx="9" cy="6" r="2"/><circle cx="15" cy="6" r="2"/><circle cx="9" cy="12" r="2"/><circle cx="15" cy="12" r="2"/><circle cx="9" cy="18" r="2"/><circle cx="15" cy="18" r="2"/></svg></div><div class="ft-task-content"><div class="ft-task-name">${escapeHtml(task.name)}</div>${task.duration ? `<div class="ft-task-duration">${formatDuration(task.duration)}</div>` : ''}</div><div class="ft-task-actions"><button class="ft-task-action-btn" data-action="select" aria-label="Select"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="5 3 19 12 5 21 5 3"/></svg></button><button class="ft-task-action-btn" data-action="delete" aria-label="Delete"><svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg></button></div>`;
      el.taskList.appendChild(li);
    });
    setupDragAndDrop();
  }

  function setMode(mode) {
    pauseTimer(); stopBreathing(); state.mode = mode; state.sessionType = 'focus';
    $$('.ft-mode-btn').forEach(btn => { btn.classList.toggle('active', btn.dataset.mode === mode); btn.setAttribute('aria-selected', btn.dataset.mode === mode); });
    const main = $('.ft-main:not(.ft-breathe-section)');
    if (mode === 'breathe') { main.style.display = 'none'; el.breatheSection.style.display = 'flex'; resetBreathing(); }
    else {
      main.style.display = 'flex'; el.breatheSection.style.display = 'none';
      if (mode === 'pomodoro') { state.currentTime = state.settings.focusDuration * 60; state.totalTime = state.currentTime; state.completedCycles = 0; }
      else if (mode === 'countdown') { const t = state.tasks[state.activeTaskIndex]; state.currentTime = t?.duration ? t.duration * 60 : 25 * 60; state.totalTime = state.currentTime; }
      else { state.currentTime = 0; state.totalTime = 0; }
    }
    updateDisplay(); saveState();
  }

  function loadSettings() {
    el.focusDuration.value = state.settings.focusDuration; el.shortBreakDuration.value = state.settings.shortBreakDuration;
    el.longBreakDuration.value = state.settings.longBreakDuration; el.cyclesBeforeLongBreak.value = state.settings.cyclesBeforeLongBreak;
    el.soundEnabled.checked = state.settings.soundEnabled; el.autoStartBreaks.checked = state.settings.autoStartBreaks; el.autoStartFocus.checked = state.settings.autoStartFocus;
  }

  function saveSettings() {
    state.settings.focusDuration = parseInt(el.focusDuration.value) || 25;
    state.settings.shortBreakDuration = parseInt(el.shortBreakDuration.value) || 5;
    state.settings.longBreakDuration = parseInt(el.longBreakDuration.value) || 15;
    state.settings.cyclesBeforeLongBreak = parseInt(el.cyclesBeforeLongBreak.value) || 4;
    state.settings.soundEnabled = el.soundEnabled.checked;
    state.settings.autoStartBreaks = el.autoStartBreaks.checked;
    state.settings.autoStartFocus = el.autoStartFocus.checked;
    if (!state.isRunning && state.mode === 'pomodoro' && state.sessionType === 'focus') { state.currentTime = state.settings.focusDuration * 60; state.totalTime = state.currentTime; updateDisplay(); }
    saveState();
  }

  function openFullscreen() { 
    const overlay = el.fullscreenOverlay;
    
    // If in breathe mode, switch the fullscreen content
    if (state.mode === 'breathe') {
      overlay.classList.add('open', 'breathe-mode');
    } else {
      overlay.classList.add('open');
      overlay.classList.remove('breathe-mode');
    }
    
    document.body.style.overflow = 'hidden';
    // Request native fullscreen
    const elem = overlay;
    if (elem.requestFullscreen) elem.requestFullscreen();
    else if (elem.webkitRequestFullscreen) elem.webkitRequestFullscreen();
    else if (elem.msRequestFullscreen) elem.msRequestFullscreen();
  }
  function closeFullscreen() { 
    el.fullscreenOverlay.classList.remove('open', 'breathe-mode'); 
    document.body.style.overflow = '';
    // Exit native fullscreen
    if (document.fullscreenElement || document.webkitFullscreenElement || document.msFullscreenElement) {
      if (document.exitFullscreen) document.exitFullscreen();
      else if (document.webkitExitFullscreen) document.webkitExitFullscreen();
      else if (document.msExitFullscreen) document.msExitFullscreen();
    }
  }
  function playNotificationSound() { 
    if (!state.settings.soundEnabled) return; 
    try { 
      // Use the wind chime sound from GitHub
      const sound = new Audio('https://cdn.jsdelivr.net/gh/BlauwFilms/blauw-focus-timer@v1.0.1/WindChime_Bell_Sound.mp3');
      sound.volume = 0.5;
      sound.play().catch(() => {}); 
    } catch(e) {} 
  }

  let pipVideo = null, pipAnimationFrame = null;
  function initPiP() { pipVideo = $('#pipVideo'); const c = $('#pipCanvas'); pipVideo.srcObject = c.captureStream(30); }
  function drawPiPCanvas() {
    const c = $('#pipCanvas'), ctx = c.getContext('2d');
    ctx.fillStyle = '#f9f9f9'; ctx.fillRect(0, 0, c.width, c.height);
    const timeStr = formatTime(state.mode === 'breathe' ? breatheState.phaseTime : state.currentTime);
    const t = state.tasks[state.activeTaskIndex];
    let label = state.mode === 'breathe' ? (getPhaseInstruction(breatheState.phase) || 'Breathe') : (state.sessionType === 'shortBreak' ? 'Short Break' : state.sessionType === 'longBreak' ? 'Long Break' : state.mode === 'stopwatch' ? 'Elapsed Time' : 'Focus Time');
    const cx = c.width / 2, cy = 120;
    if (state.mode !== 'stopwatch' && state.mode !== 'breathe' && state.totalTime > 0) {
      ctx.beginPath(); ctx.arc(cx, cy, 70, 0, Math.PI * 2); ctx.strokeStyle = '#e0e0e0'; ctx.lineWidth = 4; ctx.stroke();
      ctx.beginPath(); ctx.arc(cx, cy, 70, -Math.PI/2, -Math.PI/2 + Math.PI*2*(state.currentTime/state.totalTime)); ctx.strokeStyle = state.sessionType === 'focus' ? '#1451eb' : '#999'; ctx.lineWidth = 4; ctx.stroke();
    }
    if (state.mode === 'breathe') {
      ctx.beginPath(); ctx.arc(cx, cy, 70, 0, Math.PI*2); ctx.strokeStyle = '#e0e0e0'; ctx.lineWidth = 2; ctx.stroke();
      let r = 20; const p = breathePatterns[breatheState.pattern];
      if (breatheState.phase === 'inhale' && p.inhale > 0) r = 20 + 50*(1 - breatheState.phaseTime/p.inhale);
      else if (breatheState.phase === 'hold-in') r = 70;
      else if (breatheState.phase === 'exhale' && p.exhale > 0) r = 20 + 50*(breatheState.phaseTime/p.exhale);
      ctx.beginPath(); ctx.arc(cx, cy, r, 0, Math.PI*2); ctx.fillStyle = 'rgba(20,81,235,0.2)'; ctx.fill();
    }
    ctx.fillStyle = state.sessionType === 'focus' || state.mode === 'breathe' ? '#1a1a1a' : '#666';
    ctx.font = '300 48px Roboto, sans-serif'; ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(timeStr, cx, 220);
    ctx.fillStyle = '#999'; ctx.font = '400 12px Roboto, sans-serif'; ctx.fillText(label.toUpperCase(), cx, 255);
    if (t && state.mode !== 'breathe') { ctx.fillStyle = '#666'; ctx.font = '300 14px Roboto, sans-serif'; ctx.fillText(t.name.length > 35 ? t.name.substring(0,35)+'...' : t.name, cx, 280); }
    if (document.pictureInPictureElement) pipAnimationFrame = requestAnimationFrame(drawPiPCanvas);
  }
  async function togglePiP() {
    try {
      if (document.pictureInPictureElement) { await document.exitPictureInPicture(); if (pipAnimationFrame) { cancelAnimationFrame(pipAnimationFrame); pipAnimationFrame = null; } }
      else { if (!pipVideo) initPiP(); drawPiPCanvas(); await pipVideo.play(); await pipVideo.requestPictureInPicture(); pipVideo.addEventListener('leavepictureinpicture', () => { if (pipAnimationFrame) { cancelAnimationFrame(pipAnimationFrame); pipAnimationFrame = null; } }, { once: true }); }
    } catch(e) { alert('Picture-in-Picture not supported.'); }
  }
  function updatePiPIfActive() { if (document.pictureInPictureElement && !pipAnimationFrame) pipAnimationFrame = requestAnimationFrame(drawPiPCanvas); }

  function startBreathing() { if (breatheInterval) return; breatheState.isRunning = true; if (breatheState.phase === 'idle') { breatheState.currentCycle = 1; startBreathPhase('inhale'); } else continueBreathPhase(); updateBreathePlayButton(); }
  function stopBreathing() { breatheState.isRunning = false; if (breatheInterval) { clearInterval(breatheInterval); breatheInterval = null; } updateBreathePlayButton(); }
  function resetBreathing() { 
    stopBreathing(); 
    breatheState.phase = 'idle'; 
    breatheState.phaseTime = 0; 
    breatheState.currentCycle = 0; 
    const p = breathePatterns[breatheState.pattern]; 
    breatheState.totalCycles = p.cycles; 
    el.breatheInnerCircle.className = 'ft-breathe-inner-circle'; 
    el.breatheInstruction.textContent = 'Press start to begin'; 
    el.breatheTimer.textContent = `${p.inhale}s`; 
    el.breatheCycles.textContent = `Cycle 0 of ${breatheState.totalCycles}`; 
    // Sync fullscreen
    if (el.fullscreenBreatheInnerCircle) {
      el.fullscreenBreatheInnerCircle.className = 'ft-breathe-inner-circle';
      el.fullscreenBreatheInstruction.textContent = 'Press start to begin';
      el.fullscreenBreatheTimer.textContent = `${p.inhale}s`;
      el.fullscreenBreatheCycles.textContent = `Cycle 0 of ${breatheState.totalCycles}`;
    }
    updateBreathePlayButton(); 
  }
  function startBreathPhase(phase) {
    const p = breathePatterns[breatheState.pattern]; breatheState.phase = phase;
    let dur = 0, instr = '';
    if (phase === 'inhale') { dur = p.inhale; instr = 'Breathe in'; el.breatheInnerCircle.style.setProperty('--inhale-duration', `${dur}s`); if (el.fullscreenBreatheInnerCircle) el.fullscreenBreatheInnerCircle.style.setProperty('--inhale-duration', `${dur}s`); }
    else if (phase === 'hold-in') { dur = p.holdIn; instr = 'Hold'; }
    else if (phase === 'exhale') { dur = p.exhale; instr = 'Breathe out'; el.breatheInnerCircle.style.setProperty('--exhale-duration', `${dur}s`); if (el.fullscreenBreatheInnerCircle) el.fullscreenBreatheInnerCircle.style.setProperty('--exhale-duration', `${dur}s`); }
    else if (phase === 'hold-out') { dur = p.holdOut; instr = 'Hold'; }
    if (dur === 0) { nextBreathPhase(); return; }
    breatheState.phaseTime = dur; 
    el.breatheInnerCircle.className = 'ft-breathe-inner-circle ' + phase;
    el.breatheInstruction.textContent = instr; 
    el.breatheTimer.textContent = `${dur}s`; 
    el.breatheCycles.textContent = `Cycle ${breatheState.currentCycle} of ${breatheState.totalCycles}`;
    // Sync fullscreen
    if (el.fullscreenBreatheInnerCircle) {
      el.fullscreenBreatheInnerCircle.className = 'ft-breathe-inner-circle ' + phase;
      el.fullscreenBreatheInstruction.textContent = instr;
      el.fullscreenBreatheTimer.textContent = `${dur}s`;
      el.fullscreenBreatheCycles.textContent = `Cycle ${breatheState.currentCycle} of ${breatheState.totalCycles}`;
    }
    breatheInterval = setInterval(() => { 
      breatheState.phaseTime--; 
      if (breatheState.phaseTime <= 0) { clearInterval(breatheInterval); breatheInterval = null; nextBreathPhase(); } 
      else { 
        el.breatheTimer.textContent = `${breatheState.phaseTime}s`; 
        if (el.fullscreenBreatheTimer) el.fullscreenBreatheTimer.textContent = `${breatheState.phaseTime}s`;
        updatePiPIfActive(); 
      } 
    }, 1000);
  }
  function continueBreathPhase() { el.breatheInstruction.textContent = getPhaseInstruction(breatheState.phase); breatheInterval = setInterval(() => { breatheState.phaseTime--; if (breatheState.phaseTime <= 0) { clearInterval(breatheInterval); breatheInterval = null; nextBreathPhase(); } else { el.breatheTimer.textContent = `${breatheState.phaseTime}s`; updatePiPIfActive(); } }, 1000); }
  function getPhaseInstruction(p) { return p === 'inhale' ? 'Breathe in' : p === 'hold-in' ? 'Hold' : p === 'exhale' ? 'Breathe out' : p === 'hold-out' ? 'Hold' : ''; }
  function nextBreathPhase() { const p = breathePatterns[breatheState.pattern]; if (breatheState.phase === 'inhale') p.holdIn > 0 ? startBreathPhase('hold-in') : startBreathPhase('exhale'); else if (breatheState.phase === 'hold-in') startBreathPhase('exhale'); else if (breatheState.phase === 'exhale') p.holdOut > 0 ? startBreathPhase('hold-out') : completeCycle(); else completeCycle(); }
  function completeCycle() { if (breatheState.currentCycle >= breatheState.totalCycles) completeBreathingExercise(); else { breatheState.currentCycle++; startBreathPhase('inhale'); } }
  function completeBreathingExercise() { 
    stopBreathing(); 
    breatheState.phase = 'idle'; 
    el.breatheInnerCircle.className = 'ft-breathe-inner-circle'; 
    el.breatheInstruction.textContent = 'Complete'; 
    el.breatheTimer.textContent = '—'; 
    el.breatheCycles.textContent = `${breatheState.totalCycles} cycles completed`; 
    // Sync fullscreen
    if (el.fullscreenBreatheInnerCircle) {
      el.fullscreenBreatheInnerCircle.className = 'ft-breathe-inner-circle';
      el.fullscreenBreatheInstruction.textContent = 'Complete';
      el.fullscreenBreatheTimer.textContent = '—';
      el.fullscreenBreatheCycles.textContent = `${breatheState.totalCycles} cycles completed`;
    }
    if (state.settings.soundEnabled) playNotificationSound(); 
    setTimeout(() => { 
      if (breatheState.phase === 'idle' && !breatheState.isRunning) { 
        el.breatheInstruction.textContent = 'Press start to begin again'; 
        el.breatheTimer.textContent = `${breathePatterns[breatheState.pattern].inhale}s`; 
        breatheState.currentCycle = 0; 
        el.breatheCycles.textContent = `Cycle 0 of ${breatheState.totalCycles}`; 
        // Sync fullscreen
        if (el.fullscreenBreatheInstruction) {
          el.fullscreenBreatheInstruction.textContent = 'Press start to begin again';
          el.fullscreenBreatheTimer.textContent = `${breathePatterns[breatheState.pattern].inhale}s`;
          el.fullscreenBreatheCycles.textContent = `Cycle 0 of ${breatheState.totalCycles}`;
        }
      } 
    }, 3000); 
  }
  function setBreathingPattern(n) { if (breatheState.isRunning) stopBreathing(); breatheState.pattern = n; $$('.ft-breathe-pattern-btn').forEach(b => b.classList.toggle('active', b.dataset.pattern === n)); resetBreathing(); }
  function updateBreathePlayButton() { const r = breatheState.isRunning; el.breathePlayIcon.style.display = r ? 'none' : 'block'; el.breathePauseIcon.style.display = r ? 'block' : 'none'; el.breathePlayPauseBtn.setAttribute('aria-label', r ? 'Pause breathing' : 'Start breathing exercise'); }

  function setupDragAndDrop() {
    $$('.ft-task-item').forEach(item => {
      item.addEventListener('dragstart', function(e) { draggedItem = this; this.classList.add('dragging'); e.dataTransfer.effectAllowed = 'move'; });
      item.addEventListener('dragend', function() { this.classList.remove('dragging'); $$('.ft-task-item').forEach(i => i.classList.remove('drag-over')); draggedItem = null; });
      item.addEventListener('dragover', e => { e.preventDefault(); e.dataTransfer.dropEffect = 'move'; });
      item.addEventListener('dragenter', function(e) { e.preventDefault(); if (this !== draggedItem) this.classList.add('drag-over'); });
      item.addEventListener('dragleave', function() { this.classList.remove('drag-over'); });
      item.addEventListener('drop', function(e) { e.preventDefault(); this.classList.remove('drag-over'); if (draggedItem && this !== draggedItem) { const from = state.tasks.findIndex(t => t.id === draggedItem.dataset.id), to = state.tasks.findIndex(t => t.id === this.dataset.id); if (from !== -1 && to !== -1) { const [m] = state.tasks.splice(from, 1); state.tasks.splice(to, 0, m); if (state.activeTaskIndex === from) state.activeTaskIndex = to; else if (from < state.activeTaskIndex && to >= state.activeTaskIndex) state.activeTaskIndex--; else if (from > state.activeTaskIndex && to <= state.activeTaskIndex) state.activeTaskIndex++; renderTaskList(); saveState(); } } });
    });
  }

  function handleFullscreenChange() {
    // If we exited native fullscreen but overlay is still open, close it
    if (!document.fullscreenElement && !document.webkitFullscreenElement && !document.msFullscreenElement) {
      if (el.fullscreenOverlay.classList.contains('open')) {
        el.fullscreenOverlay.classList.remove('open');
        document.body.style.overflow = '';
      }
    }
  }

  function handleKeyboard(e) {
    if (e.target.tagName === 'INPUT') return;
    if (e.code === 'Space') { e.preventDefault(); state.mode === 'breathe' ? (breatheState.isRunning ? stopBreathing() : startBreathing()) : (state.isRunning ? pauseTimer() : startTimer()); }
    else if (e.code === 'KeyR' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); state.mode === 'breathe' ? resetBreathing() : resetTimer(); }
    else if (e.code === 'KeyS' && !e.metaKey && !e.ctrlKey && state.mode !== 'breathe') { e.preventDefault(); skipTimer(); }
    else if (e.code === 'KeyF' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); el.fullscreenOverlay.classList.contains('open') ? closeFullscreen() : openFullscreen(); }
    else if (e.code === 'KeyP' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); togglePiP(); }
    else if (e.code === 'Escape') closeFullscreen();
  }

  function setupEventListeners() {
    el.playPauseBtn.addEventListener('click', () => state.isRunning ? pauseTimer() : startTimer());
    el.fullscreenPlayPauseBtn.addEventListener('click', () => state.isRunning ? pauseTimer() : startTimer());
    el.resetBtn.addEventListener('click', resetTimer); el.fullscreenResetBtn.addEventListener('click', resetTimer);
    el.skipBtn.addEventListener('click', skipTimer); el.fullscreenSkipBtn.addEventListener('click', skipTimer);
    $$('.ft-mode-btn').forEach(b => b.addEventListener('click', () => setMode(b.dataset.mode)));
    el.shortBreakBtn.addEventListener('click', () => startBreak('shortBreak'));
    el.longBreakBtn.addEventListener('click', () => startBreak('longBreak'));
    el.settingsToggle.addEventListener('click', () => el.settingsPanel.classList.toggle('open'));
    $$('.ft-tab').forEach(tab => tab.addEventListener('click', () => { $$('.ft-tab').forEach(t => t.classList.remove('active')); $$('.ft-tab-content').forEach(c => c.classList.remove('active')); tab.classList.add('active'); $(`#${tab.dataset.tab}`).classList.add('active'); }));
    [el.focusDuration, el.shortBreakDuration, el.longBreakDuration, el.cyclesBeforeLongBreak, el.soundEnabled, el.autoStartBreaks, el.autoStartFocus].forEach(e => e.addEventListener('change', saveSettings));
    el.addTaskBtn.addEventListener('click', () => { addTask(el.taskNameInput.value, parseInt(el.taskDurationInput.value) || null); el.taskNameInput.value = ''; el.taskDurationInput.value = ''; el.taskNameInput.focus(); });
    el.taskNameInput.addEventListener('keypress', e => { if (e.key === 'Enter') { addTask(el.taskNameInput.value, parseInt(el.taskDurationInput.value) || null); el.taskNameInput.value = ''; el.taskDurationInput.value = ''; } });
    el.taskList.addEventListener('click', e => { const btn = e.target.closest('.ft-task-action-btn'); if (!btn) return; const id = btn.closest('.ft-task-item').dataset.id; if (btn.dataset.action === 'delete') deleteTask(id); if (btn.dataset.action === 'select') setActiveTask(id); });
    el.clearCompletedBtn.addEventListener('click', clearCompletedTasks);
    el.fullscreenBtn.addEventListener('click', openFullscreen); el.exitFullscreenBtn.addEventListener('click', closeFullscreen);
    el.pipBtn.addEventListener('click', togglePiP); if (!document.pictureInPictureEnabled) el.pipBtn.style.display = 'none';
    el.resumeSessionBtn.addEventListener('click', () => el.resumeModal.classList.remove('open'));
    el.discardSessionBtn.addEventListener('click', () => { el.resumeModal.classList.remove('open'); clearSavedState(); resetTimer(); });
    el.resetStatsBtn.addEventListener('click', () => { state.stats = {...defaultStats}; updateStats(); saveStats(); });
    el.breathePlayPauseBtn.addEventListener('click', () => breatheState.isRunning ? stopBreathing() : startBreathing());
    el.breatheResetBtn.addEventListener('click', resetBreathing);
    $$('.ft-breathe-pattern-btn').forEach(b => b.addEventListener('click', () => setBreathingPattern(b.dataset.pattern)));
    document.addEventListener('keydown', handleKeyboard);
    // Sync overlay state when native fullscreen is exited (e.g., via Escape)
    document.addEventListener('fullscreenchange', handleFullscreenChange);
    document.addEventListener('webkitfullscreenchange', handleFullscreenChange);
    document.addEventListener('msfullscreenchange', handleFullscreenChange);
    window.addEventListener('beforeunload', () => { saveState(); saveStats(); });
  }

  function init() {
    cacheElements();
    state.stats = loadStats();
    const saved = loadState();
    if (saved && saved.isRunning && (Date.now() - saved.savedAt) < 3600000) {
      Object.assign(state, { mode: saved.mode, currentTime: saved.currentTime, totalTime: saved.totalTime, sessionType: saved.sessionType, completedCycles: saved.completedCycles, tasks: saved.tasks || [], activeTaskIndex: saved.activeTaskIndex, settings: {...defaultSettings, ...saved.settings} });
      el.resumeModal.classList.add('open');
    } else if (saved) { state.tasks = saved.tasks || []; state.activeTaskIndex = saved.activeTaskIndex; state.settings = {...defaultSettings, ...saved.settings}; }
    loadSettings(); renderTaskList(); updateDisplay(); updateStats(); setupEventListeners();
    $$('.ft-mode-btn').forEach(b => b.classList.toggle('active', b.dataset.mode === state.mode));
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init); else init();
})();
