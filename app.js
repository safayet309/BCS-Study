// Default BCS Subjects
const DEFAULT_SUBJECTS = [
    { id: 'sub_1', name: 'বাংলা', target: 20 },
    { id: 'sub_2', name: 'English', target: 20 },
    { id: 'sub_3', name: 'বাংলাদেশ বিষয়াবলি', target: 20 },
    { id: 'sub_4', name: 'আন্তর্জাতিক বিষয়াবলি', target: 15 },
    { id: 'sub_5', name: 'ভূগোল', target: 10 },
    { id: 'sub_6', name: 'সাধারণ বিজ্ঞান', target: 15 },
    { id: 'sub_7', name: 'ICT', target: 10 },
    { id: 'sub_8', name: 'গণিত', target: 15 },
    { id: 'sub_9', name: 'মানসিক দক্ষতা', target: 10 },
    { id: 'sub_10', name: 'নৈতিকতা, মূল্যবোধ ও সুশাসন', target: 10 }
];

// --- STORAGE MANAGER ---
class Store {
    static get(key) {
        return JSON.parse(localStorage.getItem(`bcs_${key}`)) || null;
    }
    static set(key, data) {
        localStorage.setItem(`bcs_${key}`, JSON.stringify(data));
    }
    static init() {
        if (!this.get('user')) {
            this.set('user', { name: '', goal: '', dailyTarget: 6 });
            this.set('subjects', DEFAULT_SUBJECTS);
            this.set('sessions', []);
            this.set('plans', []);
            return false; // Needs setup
        }
        return true; // Already setup
    }
}

// --- UTILITIES ---
const formatTime = (ms) => {
    let seconds = Math.floor(ms / 1000);
    let h = Math.floor(seconds / 3600);
    let m = Math.floor((seconds % 3600) / 60);
    let s = seconds % 60;
    return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
};

const msToHoursMins = (ms) => {
    let m = Math.floor(ms / 60000);
    let h = Math.floor(m / 60);
    m = m % 60;
    return `${h}h ${m}m`;
};

const showToast = (msg) => {
    const toast = document.getElementById('toast');
    toast.textContent = msg;
    toast.classList.remove('hidden');
    setTimeout(() => toast.classList.add('hidden'), 3000);
};

const getTodayStr = () => new Date().toISOString().split('T')[0];

// --- MAIN APP CLASS ---
class BCSApp {
    constructor() {
        this.charts = {};
        this.timerInterval = null;
        this.init();
    }

    init() {
        lucide.createIcons();
        if (!Store.init()) {
            document.getElementById('setup-screen').classList.remove('hidden');
            this.bindSetup();
        } else {
            this.startApp();
        }
    }

    bindSetup() {
        document.getElementById('btn-finish-setup').addEventListener('click', () => {
            const name = document.getElementById('setup-name').value || 'Student';
            const goal = document.getElementById('setup-goal').value;
            const target = parseInt(document.getElementById('setup-target').value) || 6;
            
            Store.set('user', { name, goal, dailyTarget: target });
            document.getElementById('setup-screen').classList.add('hidden');
            this.startApp();
        });
    }

    startApp() {
        document.getElementById('app-container').classList.remove('hidden');
        this.bindNavigation();
        this.bindGlobalEvents();
        this.updateDashboard();
        this.populateSubjectSelects();
        this.checkActiveTimer();
        
        // Settings prepopulate
        const user = Store.get('user');
        document.getElementById('setting-name').value = user.name;
        document.getElementById('setting-target').value = user.dailyTarget;
    }

    bindNavigation() {
        document.querySelectorAll('.nav-item').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const target = e.currentTarget.dataset.target;
                this.navigate(target);
            });
        });
    }

    navigate(targetId) {
        document.querySelectorAll('.view').forEach(el => el.classList.remove('active'));
        document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
        
        document.getElementById(targetId).classList.add('active');
        document.querySelectorAll(`.nav-item[data-target="${targetId}"]`).forEach(el => el.classList.add('active'));

        if (targetId === 'home') this.updateDashboard();
        if (targetId === 'analytics') this.renderAnalytics();
        if (targetId === 'subjects') this.renderSubjects();
        if (targetId === 'history') this.renderHistory();
        window.scrollTo(0,0);
    }

    bindGlobalEvents() {
        // Study setup
        document.getElementById('btn-start-timer').addEventListener('click', () => this.startTimer());
        document.getElementById('btn-pause-timer').addEventListener('click', () => this.pauseTimer());
        document.getElementById('btn-resume-timer').addEventListener('click', () => this.resumeTimer());
        document.getElementById('btn-finish-timer').addEventListener('click', () => this.finishTimer());
        
        // Session saving
        document.getElementById('btn-save-session').addEventListener('click', () => this.saveSession());
        document.getElementById('btn-discard-session').addEventListener('click', () => this.discardSession());

        // Plan
        document.getElementById('btn-save-plan').addEventListener('click', () => this.savePlan());
        
        // Subject
        document.getElementById('btn-save-subject').addEventListener('click', () => this.saveSubject());

        // Settings
        document.getElementById('btn-save-settings').addEventListener('click', () => {
            const user = Store.get('user');
            user.name = document.getElementById('setting-name').value;
            user.dailyTarget = parseInt(document.getElementById('setting-target').value);
            Store.set('user', user);
            showToast('Settings saved!');
            this.updateDashboard();
        });

        // Export/Import/Clear
        document.getElementById('btn-export').addEventListener('click', () => this.exportData());
        document.getElementById('file-import').addEventListener('change', (e) => this.importData(e));
        document.getElementById('btn-clear-data').addEventListener('click', () => {
            if(confirm('Are you sure? This will delete all your study data.')) {
                localStorage.clear();
                location.reload();
            }
        });

        // History filter
        document.getElementById('history-date-filter').addEventListener('change', () => this.renderHistory());
        document.getElementById('btn-clear-filter').addEventListener('click', () => {
            document.getElementById('history-date-filter').value = '';
            this.renderHistory();
        });
    }

    // --- DASHBOARD ---
    updateDashboard() {
        const user = Store.get('user');
        const sessions = Store.get('sessions');
        const today = getTodayStr();
        
        // Greeting
        const hour = new Date().getHours();
        let greet = 'Good Evening';
        if(hour < 12) greet = 'Good Morning';
        else if(hour < 18) greet = 'Good Afternoon';
        document.getElementById('greeting').innerHTML = `${greet}, ${user.name} 👋`;
        document.getElementById('current-date').innerText = new Date().toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric' });

        // Calculate Today's Time
        const todaySessions = sessions.filter(s => s.date === today);
        const todayMs = todaySessions.reduce((acc, s) => acc + s.duration, 0);
        const targetMs = user.dailyTarget * 3600000;
        const progress = Math.min(100, Math.round((todayMs / targetMs) * 100));

        document.getElementById('today-studied').innerText = msToHoursMins(todayMs);
        document.getElementById('today-target').innerText = `${user.dailyTarget}h`;
        
        let remainingMs = targetMs - todayMs;
        document.getElementById('today-remaining').innerText = remainingMs > 0 ? msToHoursMins(remainingMs) : '0h 0m';
        
        document.getElementById('today-progress-circle').setAttribute('stroke-dasharray', `${progress}, 100`);
        document.getElementById('today-percentage').textContent = `${progress}%`;

        // Streak logic
        this.calculateStreak(sessions, targetMs);

        // Plans
        this.renderPlans();
    }

    calculateStreak(sessions, dailyTargetMs) {
        // Group study time by date
        const dailyData = {};
        sessions.forEach(s => {
            dailyData[s.date] = (dailyData[s.date] || 0) + s.duration;
        });

        const dates = Object.keys(dailyData).sort((a,b) => new Date(b) - new Date(a));
        let currentStreak = 0;
        let longestStreak = 0;
        let tempStreak = 0;
        const today = getTodayStr();
        const yesterday = new Date(Date.now() - 86400000).toISOString().split('T')[0];

        // Calc longest
        let currentIter = 0;
        const sortedAsc = Object.keys(dailyData).sort();
        let prevDate = null;
        for (let d of sortedAsc) {
            if (dailyData[d] >= dailyTargetMs) {
                if (!prevDate) { currentIter = 1; }
                else {
                    let diff = Math.floor((new Date(d) - new Date(prevDate)) / 86400000);
                    if (diff === 1) currentIter++;
                    else currentIter = 1;
                }
                longestStreak = Math.max(longestStreak, currentIter);
                prevDate = d;
            }
        }

        // Calc current
        let checkDate = new Date();
        while(true) {
            let dStr = checkDate.toISOString().split('T')[0];
            let dur = dailyData[dStr] || 0;
            if (dur >= dailyTargetMs) {
                currentStreak++;
                checkDate.setDate(checkDate.getDate() - 1);
            } else if (dStr === today) {
                // Ignore if today isn't met yet, but check yesterday
                checkDate.setDate(checkDate.getDate() - 1);
            } else {
                break;
            }
        }

        document.getElementById('current-streak').innerText = `${currentStreak} Days`;
        document.getElementById('longest-streak').innerText = longestStreak;
    }

    // --- PLANS ---
    renderPlans() {
        const plans = Store.get('plans');
        const today = getTodayStr();
        const todayPlans = plans.filter(p => p.date === today);
        const container = document.getElementById('plan-list');
        container.innerHTML = '';
        
        if (todayPlans.length === 0) {
            container.innerHTML = '<p class="text-muted text-sm text-center py-2">No plans for today.</p>';
            return;
        }

        todayPlans.forEach(p => {
            const div = document.createElement('div');
            div.className = 'plan-item';
            div.innerHTML = `
                <div class="plan-checkbox ${p.completed ? 'completed' : ''}" data-id="${p.id}">
                    <i data-lucide="check" style="width: 14px; height: 14px;"></i>
                </div>
                <div class="plan-details">
                    <div class="plan-title ${p.completed ? 'completed' : ''}">${p.title}</div>
                    <div class="plan-meta">${p.duration} mins • ${this.getSubjectName(p.subjectId) || 'General'}</div>
                </div>
                <button class="btn-icon delete-plan" data-id="${p.id}"><i data-lucide="x" style="width:14px; height:14px"></i></button>
            `;
            container.appendChild(div);
        });
        lucide.createIcons();

        // Bind events
        document.querySelectorAll('.plan-checkbox').forEach(chk => {
            chk.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                let plans = Store.get('plans');
                let plan = plans.find(x => x.id === id);
                if(plan) plan.completed = !plan.completed;
                Store.set('plans', plans);
                this.renderPlans();
            });
        });

        document.querySelectorAll('.delete-plan').forEach(btn => {
            btn.addEventListener('click', (e) => {
                const id = e.currentTarget.dataset.id;
                let plans = Store.get('plans');
                Store.set('plans', plans.filter(x => x.id !== id));
                this.renderPlans();
            });
        });
    }

    savePlan() {
        const title = document.getElementById('plan-title').value;
        if(!title) return;
        const plans = Store.get('plans');
        plans.push({
            id: 'p_' + Date.now(),
            date: getTodayStr(),
            title: title,
            subjectId: document.getElementById('plan-subject').value,
            duration: parseInt(document.getElementById('plan-duration').value),
            completed: false
        });
        Store.set('plans', plans);
        document.getElementById('modal-add-plan').classList.add('hidden');
        document.getElementById('plan-title').value = '';
        this.renderPlans();
        showToast('Plan added!');
    }

    // --- TIMER SYSTEM ---
    populateSubjectSelects() {
        const subjects = Store.get('subjects');
        const selects = ['timer-subject', 'plan-subject', 'finish-topic']; // finish-topic is input, oops.
        let html = '';
        subjects.forEach(s => html += `<option value="${s.id}">${s.name}</option>`);
        document.getElementById('timer-subject').innerHTML = html;
        document.getElementById('plan-subject').innerHTML = '<option value="">None</option>' + html;
    }

    getSubjectName(id) {
        if(!id) return '';
        const s = Store.get('subjects').find(x => x.id === id);
        return s ? s.name : 'Unknown';
    }

    startTimer() {
        const subjId = document.getElementById('timer-subject').value;
        const type = document.getElementById('timer-type').value;
        const mode = document.getElementById('timer-mode').value;
        
        const session = {
            id: 'sess_' + Date.now(),
            subjectId: subjId,
            type: type,
            mode: mode,
            startTime: Date.now(),
            accumulated: 0,
            status: 'running'
        };
        Store.set('activeTimer', session);
        this.renderTimerUI(session);
    }

    checkActiveTimer() {
        const active = Store.get('activeTimer');
        if (active) this.renderTimerUI(active);
    }

    renderTimerUI(session) {
        document.getElementById('study-setup').classList.add('hidden');
        document.getElementById('study-active').classList.remove('hidden');
        document.getElementById('active-subject-title').innerText = this.getSubjectName(session.subjectId);
        document.getElementById('active-type-title').innerText = session.type;

        if (this.timerInterval) clearInterval(this.timerInterval);
        
        const updateDisplay = () => {
            const active = Store.get('activeTimer');
            if(!active) { clearInterval(this.timerInterval); return; }
            let total = active.accumulated;
            if (active.status === 'running') {
                total += (Date.now() - active.startTime);
            }
            document.getElementById('timer-display').innerText = formatTime(total);
        };

        updateDisplay();
        if (session.status === 'running') {
            this.timerInterval = setInterval(updateDisplay, 1000);
            document.getElementById('btn-pause-timer').classList.remove('hidden');
            document.getElementById('btn-resume-timer').classList.add('hidden');
        } else {
            document.getElementById('btn-pause-timer').classList.add('hidden');
            document.getElementById('btn-resume-timer').classList.remove('hidden');
        }
    }

    pauseTimer() {
        let active = Store.get('activeTimer');
        if(!active) return;
        active.accumulated += (Date.now() - active.startTime);
        active.status = 'paused';
        Store.set('activeTimer', active);
        this.renderTimerUI(active);
    }

    resumeTimer() {
        let active = Store.get('activeTimer');
        if(!active) return;
        active.startTime = Date.now();
        active.status = 'running';
        Store.set('activeTimer', active);
        this.renderTimerUI(active);
    }

    finishTimer() {
        let active = Store.get('activeTimer');
        if(!active) return;
        
        if (active.status === 'running') {
            active.accumulated += (Date.now() - active.startTime);
        }
        active.status = 'finished';
        Store.set('activeTimer', active);
        clearInterval(this.timerInterval);
        
        // Open Modal
        document.getElementById('finish-duration-text').innerText = formatTime(active.accumulated);
        document.getElementById('modal-finish-session').classList.remove('hidden');
    }

    discardSession() {
        localStorage.removeItem('bcs_activeTimer');
        document.getElementById('modal-finish-session').classList.add('hidden');
        document.getElementById('study-setup').classList.remove('hidden');
        document.getElementById('study-active').classList.add('hidden');
        showToast('Session discarded.');
    }

    saveSession() {
        const active = Store.get('activeTimer');
        if(!active) return;

        const sessions = Store.get('sessions');
        sessions.push({
            id: active.id,
            date: getTodayStr(),
            subjectId: active.subjectId,
            studyType: active.type,
            duration: active.accumulated, // in ms
            topic: document.getElementById('finish-topic').value,
            notes: document.getElementById('finish-notes').value,
            confidence: document.getElementById('finish-confidence').value,
            timestamp: Date.now()
        });
        Store.set('sessions', sessions);
        localStorage.removeItem('bcs_activeTimer');
        
        // Reset UI
        document.getElementById('modal-finish-session').classList.add('hidden');
        document.getElementById('study-setup').classList.remove('hidden');
        document.getElementById('study-active').classList.add('hidden');
        document.getElementById('finish-topic').value = '';
        document.getElementById('finish-notes').value = '';
        
        showToast('Session saved!');
        if(document.getElementById('home').classList.contains('active')) this.updateDashboard();
    }

    // --- ANALYTICS ---
    renderAnalytics() {
        const sessions = Store.get('sessions');
        const subjects = Store.get('subjects');
        
        // Key Stats
        const totalMs = sessions.reduce((sum, s) => sum + s.duration, 0);
        document.getElementById('stat-total-time').innerText = msToHoursMins(totalMs);
        document.getElementById('stat-total-sessions').innerText = sessions.length;
        const avgMs = sessions.length ? totalMs / sessions.length : 0;
        document.getElementById('stat-avg-session').innerText = Math.floor(avgMs / 60000) + 'm';

        // Helper for colors
        const colors = ['#3b82f6', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316', '#64748b', '#14b8a6'];

        // 1. Weekly Chart
        const weeklyCtx = document.getElementById('chart-weekly').getContext('2d');
        if(this.charts.weekly) this.charts.weekly.destroy();
        
        let last7Days = [];
        let weekData = [];
        for(let i=6; i>=0; i--) {
            let d = new Date();
            d.setDate(d.getDate() - i);
            let dStr = d.toISOString().split('T')[0];
            last7Days.push(d.toLocaleDateString('en-US', {weekday:'short'}));
            let dayMs = sessions.filter(s => s.date === dStr).reduce((sum, s) => sum + s.duration, 0);
            weekData.push(dayMs / 3600000); // in hours
        }

        this.charts.weekly = new Chart(weeklyCtx, {
            type: 'line',
            data: {
                labels: last7Days,
                datasets: [{
                    label: 'Study Hours',
                    data: weekData,
                    borderColor: '#3b82f6',
                    backgroundColor: 'rgba(59, 130, 246, 0.1)',
                    tension: 0.4,
                    fill: true
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: {display: false} } }
        });

        // 2. Subject Distribution
        const subCtx = document.getElementById('chart-subjects').getContext('2d');
        if(this.charts.subjects) this.charts.subjects.destroy();
        
        let subLabels = [];
        let subData = [];
        subjects.forEach(sub => {
            let sum = sessions.filter(s => s.subjectId === sub.id).reduce((acc, s) => acc + s.duration, 0);
            if(sum > 0) {
                subLabels.push(sub.name);
                subData.push(Math.round(sum/60000)); // mins
            }
        });

        this.charts.subjects = new Chart(subCtx, {
            type: 'doughnut',
            data: {
                labels: subLabels,
                datasets: [{ data: subData, backgroundColor: colors }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: { position: 'right', labels: {boxWidth: 10, font: {size: 10}} } } }
        });

        // 3. Study Types
        const typeCtx = document.getElementById('chart-types').getContext('2d');
        if(this.charts.types) this.charts.types.destroy();
        
        let typeMap = {};
        sessions.forEach(s => { typeMap[s.studyType] = (typeMap[s.studyType] || 0) + s.duration; });
        
        this.charts.types = new Chart(typeCtx, {
            type: 'bar',
            data: {
                labels: Object.keys(typeMap),
                datasets: [{
                    label: 'Minutes',
                    data: Object.values(typeMap).map(v => Math.round(v/60000)),
                    backgroundColor: '#10b981'
                }]
            },
            options: { responsive: true, maintainAspectRatio: false, plugins: { legend: {display: false} } }
        });
    }

    // --- SUBJECTS ---
    renderSubjects() {
        const subjects = Store.get('subjects');
        const sessions = Store.get('sessions');
        const container = document.getElementById('subjects-list');
        container.innerHTML = '';

        subjects.forEach(sub => {
            const subSessions = sessions.filter(s => s.subjectId === sub.id);
            const totalMs = subSessions.reduce((sum, s) => sum + s.duration, 0);
            const lastSession = subSessions.sort((a,b) => b.timestamp - a.timestamp)[0];
            const targetMs = (sub.target || 0) * 3600000;
            const progress = targetMs ? Math.min(100, Math.round((totalMs/targetMs)*100)) : 0;

            const div = document.createElement('div');
            div.className = 'card';
            div.innerHTML = `
                <div class="flex-between mb-2">
                    <h3 class="text-primary">${sub.name}</h3>
                </div>
                <div class="text-sm text-muted mb-2">Target: ${sub.target || 0}h | Studied: ${msToHoursMins(totalMs)}</div>
                <div style="width: 100%; background: var(--secondary-color); height: 8px; border-radius: 4px; overflow: hidden; margin-bottom: 1rem;">
                    <div style="width: ${progress}%; background: var(--primary-color); height: 100%;"></div>
                </div>
                <div class="flex-between text-xs text-muted">
                    <span>${subSessions.length} Sessions</span>
                    <span>Last: ${lastSession ? new Date(lastSession.timestamp).toLocaleDateString() : 'Never'}</span>
                </div>
            `;
            container.appendChild(div);
        });
    }

    saveSubject() {
        const name = document.getElementById('new-subject-name').value;
        const target = parseInt(document.getElementById('new-subject-target').value);
        if(!name) return;
        const subjects = Store.get('subjects');
        subjects.push({ id: 'sub_' + Date.now(), name, target });
        Store.set('subjects', subjects);
        document.getElementById('modal-add-subject').classList.add('hidden');
        document.getElementById('new-subject-name').value = '';
        this.renderSubjects();
        this.populateSubjectSelects();
        showToast('Subject added!');
    }

    // --- HISTORY ---
    renderHistory() {
        const sessions = Store.get('sessions');
        const filterDate = document.getElementById('history-date-filter').value;
        const container = document.getElementById('history-list');
        container.innerHTML = '';

        let filtered = sessions.sort((a,b) => b.timestamp - a.timestamp);
        if (filterDate) {
            filtered = filtered.filter(s => s.date === filterDate);
        }

        if(filtered.length === 0) {
            container.innerHTML = '<p class="p-4 text-center text-muted">No sessions found.</p>';
            return;
        }

        filtered.forEach(s => {
            const div = document.createElement('div');
            div.className = 'history-item';
            div.innerHTML = `
                <div class="history-main">
                    <h4>${this.getSubjectName(s.subjectId)}</h4>
                    <div class="history-meta">
                        <span>${s.date}</span> • 
                        <span>${s.studyType}</span>
                        ${s.topic ? ` • <span>${s.topic}</span>` : ''}
                    </div>
                </div>
                <div class="history-duration">${msToHoursMins(s.duration)}</div>
            `;
            container.appendChild(div);
        });
    }

    // --- DATA MANAGEMENT ---
    exportData() {
        const data = {
            user: Store.get('user'),
            subjects: Store.get('subjects'),
            sessions: Store.get('sessions'),
            plans: Store.get('plans')
        };
        const blob = new Blob([JSON.stringify(data, null, 2)], {type: 'application/json'});
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `bcs-tracker-backup-${getTodayStr()}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    importData(e) {
        const file = e.target.files[0];
        if(!file) return;
        const reader = new FileReader();
        reader.onload = (event) => {
            try {
                const data = JSON.parse(event.target.result);
                if(data.user && data.subjects && data.sessions) {
                    Store.set('user', data.user);
                    Store.set('subjects', data.subjects);
                    Store.set('sessions', data.sessions);
                    Store.set('plans', data.plans || []);
                    showToast('Data imported successfully!');
                    setTimeout(() => location.reload(), 1500);
                } else {
                    alert('Invalid backup file structure.');
                }
            } catch(err) {
                alert('Error reading file.');
            }
        };
        reader.readAsText(file);
    }
}

// Init App
const app = new BCSApp();

// Register Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('sw.js').then(reg => {
            console.log('SW registered:', reg.scope);
        }).catch(err => console.log('SW registration failed:', err));
    });
                                             }
