// App logic
const USERS = {
  'atharv@301.com': {name:'Atharv', pw:'atharv301', color:'dot-atharv'},
  'chetan@301.com': {name:'Chetan', pw:'chetan301', color:'dot-chetan'},
  'vedant@301.com': {name:'Vedant', pw:'vedant301', color:'dot-vedant'},
  'pratik@301.com': {name:'Pratik', pw:'pratik301', color:'dot-pratik'}
};


const STORAGE_KEY = 'water_fill_records_v1'; // stores object: { "YYYY-MM-DD": "username" }

function q(sel){return document.querySelector(sel)}
function qa(sel){return document.querySelectorAll(sel)}

// Helpers for India timezone (IST)
function datePartsInIST(date){
  const fmt = new Intl.DateTimeFormat('en-CA', { // en-CA yields YYYY-MM-DD order when we join
    timeZone: 'Asia/Kolkata', year: 'numeric', month: '2-digit', day: '2-digit'
  });
  const parts = fmt.formatToParts(date).reduce((acc, p)=>{ acc[p.type]=p.value; return acc; }, {});
  return { y: parts.year, m: parts.month, d: parts.day };
}
function toISODateIST(date){
  const {y,m,d} = datePartsInIST(date);
  return `${y}-${m}-${d}`; // YYYY-MM-DD in IST
}
function todayISO(offsetDays=0){
  const d = new Date();
  d.setDate(d.getDate()+offsetDays);
  return toISODateIST(d);
}

// load records
function loadRecords(){
  const raw = localStorage.getItem(STORAGE_KEY);
  return raw? JSON.parse(raw) : {};
}
function saveRecords(obj){
  localStorage.setItem(STORAGE_KEY, JSON.stringify(obj));
}

// login (restrict to Chetan only)
q('#login-form').addEventListener('submit', (e)=>{
  e.preventDefault();
  const email = q('#email').value.trim().toLowerCase();
  const pw = q('#password').value.trim();
  if(!(email in USERS) || USERS[email].pw !== pw){
    alert('Invalid email/password.');
    return;
  }
  if(email !== 'chetan@301.com'){
    alert('Only Chetan can access this board.');
    return;
  }
  localStorage.setItem('current_user', email);
  showBoard();
});

// logout
q('#logout').addEventListener('click', ()=>{
  localStorage.removeItem('current_user');
  location.reload();
});

function showBoard(){
  const cur = localStorage.getItem('current_user');
  if(!cur) return;
  q('#login-section').classList.add('hidden');
  q('#board-section').classList.remove('hidden');
  q('#user-badge').textContent = USERS[cur].name + ' • ' + cur;
  renderSelector();
  autoBackfillNoNeed();
  renderStatus();
  buildCalendar();
  // disable fill button if already actioned
  maybeDisableAction();
}

// render today's status list
function renderStatus(){
  const records = loadRecords();
  const today = todayISO();
  const container = q('#status-list');
  container.innerHTML = '';
  // list order fixed
  Object.keys(USERS).forEach(email=>{
    const u = USERS[email];
    const row = document.createElement('div'); row.className='status-row';
    const left = document.createElement('div'); left.className='status-name';
    const dot = document.createElement('i'); dot.className='pulse ' + u.color;
    const name = document.createElement('div'); name.textContent = u.name;
    left.appendChild(dot); left.appendChild(name);
    const right = document.createElement('div');
    const badge = document.createElement('div'); badge.className='badge';
    // determine status
    if(records[today] === 'No Need'){
      badge.textContent = 'No Need';
      badge.style.opacity = '0.7';
    } else if(records[today] === u.name){
      badge.textContent = 'Filled';
      badge.style.background = 'linear-gradient(90deg, rgba(255,255,255,0.03), rgba(255,255,255,0.01))';
      badge.style.color = 'white';
    } else if(records[today] && records[today] !== u.name){
      badge.textContent = 'Not Filled';
      badge.style.opacity = '0.7';
    } else {
      badge.textContent = 'Pending';
      badge.style.opacity = '0.9';
    }
    right.appendChild(badge);
    row.appendChild(left); row.appendChild(right);
    container.appendChild(row);
  });
}

// action button logic
q('#fill-btn').addEventListener('click', ()=>{
  const cur = localStorage.getItem('current_user');
  if(!cur) return alert('No user? Login again.');
  if(cur !== 'chetan@301.com') return alert('Only Chetan can mark.');
  const records = loadRecords();
  const today = todayISO();
  if(records[today]){
    alert('Today already marked by ' + records[today] + '. Actions are final.');
    maybeDisableAction();
    return;
  }
  // mark with selected user (from custom select list)
  let selectedName = '';
  const active = q('#selector .select-item.active');
  if(active) selectedName = active.getAttribute('data-name') || '';
  // fallback to old inputs if any
  if(!selectedName){
    const sel = q('#who-select');
    if(sel && sel.value){ selectedName = sel.value; }
    const picked = document.querySelector('input[name="who-filled"]:checked');
    if(!selectedName && picked) selectedName = picked.value;
  }
  if(!selectedName){
    alert('Select a name to mark who filled today.');
    return;
  }
  records[today] = selectedName; // stores user name
  saveRecords(records);
  renderStatus();
  buildCalendar();
  maybeDisableAction();
  triggerConfetti();
});

// disable action if already marked today or if user already marked earlier? requirement: when one user fill sign other are automatic not fill and cannot change. So disable button if record exists.
function maybeDisableAction(){
  const records = loadRecords();
  const today = todayISO();
  const cur = localStorage.getItem('current_user');
  const btn = q('#fill-btn');
  if(cur !== 'chetan@301.com'){
    btn.disabled = true;
    btn.classList.add('ghost');
    btn.textContent = 'Only Chetan can mark';
    return;
  }
  if(records[today]){
    btn.disabled = true;
    btn.classList.add('ghost');
    btn.textContent = records[today] === 'No Need' ? 'Marked No Need' : 'Already Marked';
  } else {
    btn.disabled = false;
    btn.classList.remove('ghost');
    btn.textContent = 'Mark Filled ✅';
  }
}

// calendar build: show current month days and color cells where records exist
function buildCalendar(){
  const cal = q('#calendar');
  cal.innerHTML = '';
  const now = new Date();
  // Compute year/month in IST by creating a date string in IST then parsing values
  const { y, m } = (function(){
    const parts = datePartsInIST(now); return { y: Number(parts.y), m: Number(parts.m)-1 };
  })();
  const year = y;
  const month = m;
  const first = new Date(year, month, 1);
  const last = new Date(year, month+1, 0);
  const startWeek = first.getDay(); // 0 Sun - 6 Sat
  const totalDays = last.getDate();
  // show weekdays header
  const daysOfWeek = ['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
  daysOfWeek.forEach(d=>{
    const h = document.createElement('div'); h.className='day'; h.style.fontSize='12px'; h.style.opacity='0.7'; h.innerHTML = '<div class="date">'+d+'</div>';
    cal.appendChild(h);
  });
  // fill blanks before first
  for(let i=0;i<startWeek;i++){
    const cell = document.createElement('div'); cell.className='day'; cell.innerHTML = '';
    cal.appendChild(cell);
  }
  const records = loadRecords();
  for(let d=1; d<=totalDays; d++){
    const dateISO = toISODateIST(new Date(year,month,d));
    const cell = document.createElement('div'); cell.className='day';
    const dateDiv = document.createElement('div'); dateDiv.className='date'; dateDiv.textContent = d;
    cell.appendChild(dateDiv);
    if(records[dateISO]){
      // find user color
      let user = records[dateISO];
      if(user === 'No Need'){
        const small = document.createElement('div'); small.style.marginTop='6px'; small.style.opacity='0.75'; small.innerHTML = '<strong>No Need</strong>';
        cell.appendChild(small);
      } else {
        let colorClass = '';
        for(const e in USERS){
          if(USERS[e].name === user){ colorClass = USERS[e].color; break;}
        }
        const small = document.createElement('div'); small.style.marginTop='6px'; small.innerHTML = '<span class="'+colorClass+'" style="display:inline-block;width:18px;height:18px;border-radius:6px"></span> <strong style="margin-left:8px">'+user+'</strong>';
        cell.appendChild(small);
      }
      // highlight todays cell border
      if(dateISO === todayISO()){
        cell.style.boxShadow = '0 8px 40px rgba(0,0,0,0.6), 0 0 0 4px rgba(255,255,255,0.02) inset';
        cell.style.border = '2px solid rgba(255,255,255,0.03)';
      }
    } else {
      // pending
      cell.style.opacity = '0.85';
    }
    cal.appendChild(cell);
  }
  maybeDisableAction();
}

// render radio selector to pick who filled (Chetan only)
function renderSelector(){
  const wrap = q('#selector');
  if(!wrap) return;
  wrap.innerHTML = '';
  const cur = localStorage.getItem('current_user');
  // Only show selector to Chetan
  if(cur !== 'chetan@301.com'){
    wrap.style.display = 'none';
    return;
  }
  wrap.style.display = 'block';
  const records = loadRecords();
  const today = todayISO();
  const disabled = !!records[today];
  // Compact selectable pills above the list
  const label = document.createElement('div');
  label.textContent = 'Who filled today?';
  label.style.color = 'var(--muted)';
  label.style.fontSize = '13px';
  label.style.margin = '6px 0 2px';
  wrap.appendChild(label);

  const list = document.createElement('div');
  list.className = 'select-list';
  Object.keys(USERS).forEach(email=>{
    const u = USERS[email];
    const item = document.createElement('div');
    item.className = 'select-item' + (disabled ? ' disabled' : '');
    item.setAttribute('data-name', u.name);
    const dot = document.createElement('i'); dot.className = 'dot ' + u.color;
    const txt = document.createElement('span'); txt.textContent = u.name;
    item.appendChild(dot);
    item.appendChild(txt);
    if(!disabled){
      item.addEventListener('click', ()=>{
        // toggle selection
        qa('#selector .select-item').forEach(el=> el.classList.remove('active'));
        item.classList.add('active');
      });
    }
    list.appendChild(item);
  });
  wrap.appendChild(list);
}

// Auto-mark past unfilled days as 'No Need'
function autoBackfillNoNeed(){
  const records = loadRecords();
  const today = new Date();
  let changed = false;
  // backfill last 60 days excluding today
  for(let i=60; i>=1; i--){
    const d = new Date();
    d.setDate(today.getDate() - i);
    const iso = toISODateIST(d);
    if(!records[iso]){
      records[iso] = 'No Need';
      changed = true;
    }
  }
  if(changed) saveRecords(records);
}

// confetti
function triggerConfetti(){
  const container = q('#confetti');
  container.innerHTML = '';
  const colors = ['#f97316','#06b6d4','#a78bfa','#34d399'];
  for(let i=0;i<40;i++){
    const p = document.createElement('div');
    p.className = 'confetti-piece';
    p.style.left = Math.random()*100 + '%';
    p.style.top = (-10 - Math.random()*10) + '%';
    p.style.background = colors[Math.floor(Math.random()*colors.length)];
    p.style.transform = 'rotate('+ (Math.random()*360) +'deg)';
    p.style.animationDelay = (Math.random()*400)+'ms';
    p.style.width = (6+Math.random()*12) + 'px';
    p.style.height = (8+Math.random()*18) + 'px';
    container.appendChild(p);
  }
  // remove after animation
  setTimeout(()=> container.innerHTML = '', 2000);
}

// init: if logged in, show board
window.addEventListener('DOMContentLoaded', ()=>{
  const cur = localStorage.getItem('current_user');
  // force dark theme only (no toggle)
  document.documentElement.classList.remove('theme-light');

  if(cur) showBoard();
  
});