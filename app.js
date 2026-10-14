/* =========================================================
   LibraryOS — Full Application Logic
   Library Circulation & Digital Resource Management System
   =========================================================
   All data stored in localStorage (no backend required).
   Fine rate : ₹2 / day overdue
   Max loans : 3 active issues per member
   Loan period: 14 days default
   ========================================================= */

'use strict';

const FINE_RATE  = 2;   // ₹ per overdue day
const MAX_LOANS  = 3;
const LOAN_DAYS  = 14;

/* ─────────────────────────────────────────────────────────
   DATA STORE  (thin localStorage wrapper)
   ───────────────────────────────────────────────────────── */
const DB = {
  get(k)         { try { return JSON.parse(localStorage.getItem('lms_'+k)) || []; } catch { return []; } },
  set(k, v)      { localStorage.setItem('lms_'+k, JSON.stringify(v)); },
  getOne(k)      { try { return JSON.parse(localStorage.getItem('lms_'+k)); } catch { return null; } },
  setOne(k, v)   { localStorage.setItem('lms_'+k, JSON.stringify(v)); }
};

const Session = {
  get()    { return DB.getOne('session'); },
  set(u)   { DB.setOne('session', u); },
  clear()  { localStorage.removeItem('lms_session'); }
};

function nextId(key) {
  const ids = DB.getOne('nextId') || {};
  const id  = (ids[key] || 1);
  ids[key]  = id + 1;
  DB.setOne('nextId', ids);
  return id;
}

/* ─────────────────────────────────────────────────────────
   SEED DATA  (runs once on first visit)
   ───────────────────────────────────────────────────────── */
function initSeedData() {
  if (DB.getOne('seeded')) return;

  DB.set('users', [
    { id:1, name:'Dr. Anjali Sharma',  email:'admin@library.com',    password:'admin123', role:'admin',  createdAt:'2024-01-01' },
    { id:2, name:'Rahul Verma',        email:'student1@library.com', password:'pass123',  role:'member', createdAt:'2024-01-15' },
    { id:3, name:'Priya Nair',         email:'student2@library.com', password:'pass123',  role:'member', createdAt:'2024-02-10' },
    { id:4, name:'Arjun Singh',        email:'student3@library.com', password:'pass123',  role:'member', createdAt:'2024-03-05' },
    { id:5, name:'Meera Patel',        email:'student4@library.com', password:'pass123',  role:'member', createdAt:'2024-04-20' },
  ]);

  DB.set('members', [
    { id:2, memberId:'MEM2024001', status:'active',    phone:'9876543210', department:'Computer Science' },
    { id:3, memberId:'MEM2024002', status:'active',    phone:'9876543211', department:'Mathematics'       },
    { id:4, memberId:'MEM2024003', status:'suspended', phone:'9876543212', department:'Physics'            },
    { id:5, memberId:'MEM2024004', status:'active',    phone:'9876543213', department:'Literature'         },
  ]);

  DB.set('categories', [
    { id:1, name:'Computer Science', icon:'💻' },
    { id:2, name:'Mathematics',      icon:'📐' },
    { id:3, name:'Literature',       icon:'📖' },
    { id:4, name:'Physics',          icon:'⚛️'  },
    { id:5, name:'History',          icon:'🏛️'  },
    { id:6, name:'Biology',          icon:'🧬' },
  ]);

  DB.set('publishers', [
    { id:1, name:"McGraw-Hill",            city:'New York'    },
    { id:2, name:"Pearson Education",      city:'London'      },
    { id:3, name:"O'Reilly Media",         city:'Sebastopol'  },
    { id:4, name:"Oxford University Press",city:'Oxford'      },
    { id:5, name:"Springer",               city:'Berlin'      },
  ]);

  DB.set('books', [
    { id:1,  title:'Introduction to Algorithms',    isbn:'978-0-262-03384-8', categoryId:1, publisherId:1, author:'Cormen, Leiserson, Rivest, Stein', year:2022, edition:'4th'    },
    { id:2,  title:'Clean Code',                    isbn:'978-0-13-235088-4', categoryId:1, publisherId:3, author:'Robert C. Martin',                  year:2008, edition:'1st'    },
    { id:3,  title:'Calculus: Early Transcendentals',isbn:'978-1-285-74155-0',categoryId:2, publisherId:2, author:'James Stewart',                      year:2015, edition:'8th'    },
    { id:4,  title:'To Kill a Mockingbird',          isbn:'978-0-06-112008-4', categoryId:3, publisherId:4, author:'Harper Lee',                         year:1960, edition:'1st'    },
    { id:5,  title:'University Physics',             isbn:'978-0-13-397798-5', categoryId:4, publisherId:2, author:'Young & Freedman',                    year:2019, edition:'15th'   },
    { id:6,  title:'Design Patterns',                isbn:'978-0-20-163361-5', categoryId:1, publisherId:1, author:'Gang of Four',                        year:1994, edition:'1st'    },
    { id:7,  title:'A Brief History of Time',        isbn:'978-0-55-305505-8', categoryId:4, publisherId:4, author:'Stephen Hawking',                     year:1988, edition:'Updated'},
    { id:8,  title:'The Great Gatsby',               isbn:'978-0-74-327356-5', categoryId:3, publisherId:4, author:'F. Scott Fitzgerald',                 year:1925, edition:'1st'    },
    { id:9,  title:'Discrete Mathematics',           isbn:'978-0-07-288008-3', categoryId:2, publisherId:1, author:'Kenneth Rosen',                       year:2018, edition:'8th'    },
    { id:10, title:'The Art of War',                 isbn:'978-1-59-030963-1', categoryId:5, publisherId:4, author:'Sun Tzu',                             year:2002, edition:'Modern' },
  ]);

  DB.set('copies', [
    /* Intro to Algorithms */
    { id:1,  bookId:1, accessionNo:'CS-2024-001', status:'issued'    },
    { id:2,  bookId:1, accessionNo:'CS-2024-002', status:'reserved'  },
    { id:3,  bookId:1, accessionNo:'CS-2024-003', status:'available' },
    /* Clean Code */
    { id:4,  bookId:2, accessionNo:'CS-2024-004', status:'available' },
    { id:5,  bookId:2, accessionNo:'CS-2024-005', status:'available' },
    /* Calculus */
    { id:6,  bookId:3, accessionNo:'MA-2024-001', status:'available' },
    { id:7,  bookId:3, accessionNo:'MA-2024-002', status:'available' },
    { id:8,  bookId:3, accessionNo:'MA-2024-003', status:'issued'    },
    { id:9,  bookId:3, accessionNo:'MA-2024-004', status:'available' },
    /* To Kill a Mockingbird */
    { id:10, bookId:4, accessionNo:'LT-2024-001', status:'available' },
    { id:11, bookId:4, accessionNo:'LT-2024-002', status:'available' },
    /* University Physics */
    { id:12, bookId:5, accessionNo:'PH-2024-001', status:'available' },
    { id:13, bookId:5, accessionNo:'PH-2024-002', status:'issued'    },
    { id:14, bookId:5, accessionNo:'PH-2024-003', status:'available' },
    /* Design Patterns */
    { id:15, bookId:6, accessionNo:'CS-2024-006', status:'available' },
    { id:16, bookId:6, accessionNo:'CS-2024-007', status:'available' },
    /* A Brief History of Time */
    { id:17, bookId:7, accessionNo:'PH-2024-004', status:'available' },
    { id:18, bookId:7, accessionNo:'PH-2024-005', status:'issued'    },
    /* The Great Gatsby */
    { id:19, bookId:8, accessionNo:'LT-2024-003', status:'available' },
    { id:20, bookId:8, accessionNo:'LT-2024-004', status:'available' },
    { id:21, bookId:8, accessionNo:'LT-2024-005', status:'available' },
    /* Discrete Math */
    { id:22, bookId:9, accessionNo:'MA-2024-005', status:'available' },
    { id:23, bookId:9, accessionNo:'MA-2024-006', status:'available' },
    { id:24, bookId:9, accessionNo:'MA-2024-007', status:'available' },
    /* The Art of War */
    { id:25, bookId:10,accessionNo:'HI-2024-001', status:'available' },
    { id:26, bookId:10,accessionNo:'HI-2024-002', status:'available' },
  ]);

  /* Build seed issue dates */
  const todayStr   = today();
  const overDue    = addDays(todayStr, -20);
  const overDueEnd = addDays(overDue,   LOAN_DAYS);  // already past
  const recentIss  = addDays(todayStr, -5);
  const recentEnd  = addDays(recentIss,  LOAN_DAYS);

  DB.set('issues', [
    { id:1, copyId:1,  bookId:1, memberId:2, issueDate:overDue,   dueDate:overDueEnd, returnDate:null, status:'overdue' },
    { id:2, copyId:8,  bookId:3, memberId:3, issueDate:recentIss, dueDate:recentEnd,  returnDate:null, status:'active'  },
    { id:3, copyId:13, bookId:5, memberId:5, issueDate:recentIss, dueDate:recentEnd,  returnDate:null, status:'active'  },
    { id:4, copyId:18, bookId:7, memberId:2, issueDate:recentIss, dueDate:recentEnd,  returnDate:null, status:'active'  },
  ]);

  DB.set('reservations', [
    { id:1, bookId:1, memberId:3, reservedAt:addDays(todayStr,-2), queuePosition:1, status:'pending', copyId:2  },
    { id:2, bookId:1, memberId:4, reservedAt:addDays(todayStr,-1), queuePosition:2, status:'pending', copyId:null },
  ]);

  DB.set('fines', [
    { id:1, issueId:1, memberId:2, amount: daysBetween(overDueEnd, todayStr) * FINE_RATE, paid:false, paidAt:null, reason:'Overdue return' },
  ]);

  DB.set('digitalResources', [
    { id:1, title:'JSTOR Academic Database',     url:'https://www.jstor.org',    category:'Database', icon:'🗄️', desc:'Thousands of peer-reviewed academic journals' },
    { id:2, title:'IEEE Xplore Digital Library', url:'https://ieeexplore.ieee.org',category:'Database',icon:'⚡', desc:'Engineering and technology research papers'  },
    { id:3, title:'SpringerLink E-Books',        url:'https://link.springer.com', category:'E-Books',  icon:'📗', desc:'Mathematics and science textbooks online'      },
    { id:4, title:'Project MUSE',                url:'https://muse.jhu.edu',      category:'Database', icon:'🎭', desc:'Humanities and social sciences journals'       },
    { id:5, title:'ScienceDirect',               url:'https://sciencedirect.com', category:'Database', icon:'🔬', desc:'Scientific, technical and medical research'    },
    { id:6, title:'Khan Academy',                url:'https://khanacademy.org',   category:'Video',    icon:'🎥', desc:'Free educational video courses'                },
  ]);

  DB.set('accessLogs', [
    { id:1, resourceId:1, memberId:2, accessedAt: addDays(todayStr,-3)+'T10:22:00' },
    { id:2, resourceId:3, memberId:3, accessedAt: addDays(todayStr,-1)+'T14:05:00' },
    { id:3, resourceId:2, memberId:5, accessedAt: todayStr+'T09:40:00'              },
  ]);

  DB.setOne('nextId', { users:6, copies:27, books:11, issues:5, reservations:3, fines:2, resources:7, logs:4 });
  DB.setOne('seeded', true);
}

/* ─────────────────────────────────────────────────────────
   UTILITY FUNCTIONS
   ───────────────────────────────────────────────────────── */
function today() {
  return new Date().toISOString().split('T')[0];
}

function addDays(dateStr, n) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + n);
  return d.toISOString().split('T')[0];
}

function daysBetween(a, b) {
  return Math.floor((new Date(b) - new Date(a)) / 86400000);
}

function fmtDate(d) {
  if (!d) return '—';
  return new Date(d).toLocaleDateString('en-IN', { day:'2-digit', month:'short', year:'numeric' });
}

function calcFine(dueDate, returnDate) {
  const ret  = returnDate || today();
  const days = daysBetween(dueDate, ret);
  return days > 0 ? days * FINE_RATE : 0;
}

function badge(status) {
  const map = {
    available:'badge-available', issued:'badge-issued', overdue:'badge-overdue',
    reserved:'badge-reserved',   returned:'badge-returned', active:'badge-active',
    suspended:'badge-suspended', expired:'badge-expired',   paid:'badge-paid',
    unpaid:'badge-unpaid',       admin:'badge-admin',       member:'badge-member',
    lost:'badge-lost',           pending:'badge-pending',   ready:'badge-ready',
    fulfilled:'badge-fulfilled', cancelled:'badge-cancelled'
  };
  return `<span class="badge ${map[status]||'badge-generic'}">${status}</span>`;
}

/* lookups */
const getBookById     = id => DB.get('books').find(b => b.id == id);
const getUserById     = id => DB.get('users').find(u => u.id == id);
const getMemberById   = id => DB.get('members').find(m => m.id == id);
const getCopyById     = id => DB.get('copies').find(c => c.id == id);
const getCategoryById = id => DB.get('categories').find(c => c.id == id);

function updateIssueStatuses() {
  const issues = DB.get('issues');
  let changed = false;
  issues.forEach(i => {
    if ((i.status === 'active') && i.dueDate < today()) { i.status = 'overdue'; changed = true; }
  });
  if (changed) DB.set('issues', issues);
}

/* recompute book.availableCopies / book.totalCopies from copies table */
function syncBookCounts() {
  const books  = DB.get('books');
  const copies = DB.get('copies');
  books.forEach(b => {
    const bc = copies.filter(c => c.bookId == b.id);
    b.totalCopies     = bc.length;
    b.availableCopies = bc.filter(c => c.status === 'available').length;
  });
  DB.set('books', books);
}

/* ─────────────────────────────────────────────────────────
   AUTH
   ───────────────────────────────────────────────────────── */
function handleLogin() {
  const email    = $('#loginEmail').value.trim();
  const password = $('#loginPassword').value;
  if (!email || !password) { toast('Please fill in all fields', 'error'); return; }

  const user = DB.get('users').find(u => u.email === email && u.password === password);
  if (!user) { toast('Invalid email or password', 'error'); return; }

  Session.set(user);
  bootApp(user);
  toast(`Welcome back, ${user.name.split(' ')[0]}! 👋`, 'success');
}

function handleRegister() {
  const name     = $('#regName').value.trim();
  const email    = $('#regEmail').value.trim();
  const code     = $('#regCode').value.trim();
  const password = $('#regPassword').value;

  if (!name || !email || !code || !password) { toast('Please fill all fields', 'error'); return; }
  if (password.length < 8)  { toast('Password must be at least 8 characters', 'error'); return; }

  const users = DB.get('users');
  if (users.find(u => u.email === email))       { toast('Email already registered', 'error'); return; }
  if (DB.get('members').find(m => m.memberId === code)) { toast('Member code already in use', 'error'); return; }

  const id = nextId('users');
  const user = { id, name, email, password, role:'member', createdAt: today() };
  users.push(user);
  DB.set('users', users);

  const members = DB.get('members');
  members.push({ id, memberId: code, status:'active', phone:'', department:'' });
  DB.set('members', members);

  Session.set(user);
  bootApp(user);
  toast(`Welcome to LibraryOS, ${name.split(' ')[0]}! 🎉`, 'success');
}

function handleLogout() {
  Session.clear();
  currentUser = null;
  $('#main-screen').classList.remove('visible');
  $('#auth-screen').style.display = 'flex';
  toast('Signed out successfully', 'info');
}

/* ─────────────────────────────────────────────────────────
   NAVIGATION
   ───────────────────────────────────────────────────────── */
let currentUser = null;
let currentView = '';

const ADMIN_NAV = [
  { id:'a-dashboard',   label:'Dashboard',        icon:'fa-tachometer-alt'       },
  { id:'a-books',       label:'Manage Books',      icon:'fa-book'                 },
  { id:'a-members',     label:'Members',           icon:'fa-users'                },
  { id:'a-issue',       label:'Issue & Return',    icon:'fa-exchange-alt'         },
  { id:'a-reservations',label:'Reservations',      icon:'fa-bookmark'             },
  { id:'a-fines',       label:'Fines',             icon:'fa-file-invoice-dollar'  },
  { id:'a-reports',     label:'Reports',           icon:'fa-chart-bar'            },
  { id:'a-digital',     label:'Digital Resources', icon:'fa-globe'                },
];

const MEMBER_NAV = [
  { id:'m-dashboard',   label:'My Dashboard',      icon:'fa-home'                 },
  { id:'m-browse',      label:'Browse Books',       icon:'fa-search'               },
  { id:'m-loans',       label:'My Borrowed Books',  icon:'fa-book-open'            },
  { id:'m-reservations',label:'My Reservations',    icon:'fa-bookmark'             },
  { id:'m-fines',       label:'My Fines',           icon:'fa-file-invoice-dollar'  },
  { id:'m-digital',     label:'Digital Resources',  icon:'fa-globe'                },
  { id:'m-profile',     label:'My Profile',         icon:'fa-user'                 },
];

const VIEW_MAP = {
  /* Admin */
  'a-dashboard':    { title:'Dashboard',          sub:'Library overview & statistics',          fn: vAdminDashboard    },
  'a-books':        { title:'Manage Books',        sub:'Add, edit and manage book catalogue',    fn: vAdminBooks        },
  'a-members':      { title:'Members',             sub:'Manage library members',                 fn: vAdminMembers      },
  'a-issue':        { title:'Issue & Return',      sub:'Issue books and process returns',        fn: vAdminIssue        },
  'a-reservations': { title:'Reservations',        sub:'Manage reservation queue',               fn: vAdminReservations },
  'a-fines':        { title:'Fines',               sub:'Track and collect overdue fines',        fn: vAdminFines        },
  'a-reports':      { title:'Reports',             sub:'Analytics and operational reports',      fn: vAdminReports      },
  'a-digital':      { title:'Digital Resources',   sub:'Manage online databases & e-resources',  fn: vAdminDigital      },
  /* Member */
  'm-dashboard':    { title:'My Dashboard',        sub:'Your library activity',                  fn: vMemberDashboard   },
  'm-browse':       { title:'Browse Books',         sub:'Search and discover books',              fn: vMemberBrowse      },
  'm-loans':        { title:'My Borrowed Books',    sub:'Your borrowing history',                 fn: vMemberLoans       },
  'm-reservations': { title:'My Reservations',      sub:'Your reservation queue',                 fn: vMemberReservations},
  'm-fines':        { title:'My Fines',             sub:'Outstanding and paid fines',             fn: vMemberFines       },
  'm-digital':      { title:'Digital Resources',    sub:'Access online databases & e-resources',  fn: vMemberDigital     },
  'm-profile':      { title:'My Profile',           sub:'Your library account details',           fn: vMemberProfile     },
};

function navigate(viewId) {
  currentView = viewId;
  const v = VIEW_MAP[viewId]; if (!v) return;

  document.querySelectorAll('.nav-item').forEach(el =>
    el.classList.toggle('active', el.dataset.view === viewId));

  $('#pageTitle').textContent = v.title;
  $('#pageSub').textContent   = v.sub;
  $('#viewContent').innerHTML = '';
  v.fn();
}

function bootApp(user) {
  currentUser = user;
  $('#auth-screen').style.display = 'none';
  $('#main-screen').classList.add('visible');

  const initials = user.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
  $('#sidebarAvatar').textContent   = initials;
  $('#sidebarName').textContent     = user.name;
  $('#sidebarRoleText').textContent = user.role === 'admin' ? 'Administrator' : 'Library Member';
  $('#sidebarRoleLabel').textContent= user.role === 'admin' ? 'ADMIN PORTAL' : 'MEMBER PORTAL';

  const items = user.role === 'admin' ? ADMIN_NAV : MEMBER_NAV;
  $('#sidebarNav').innerHTML = items.map(item => `
    <button class="nav-item" data-view="${item.id}" onclick="navigate('${item.id}')">
      <span class="nav-icon"><i class="fa ${item.icon}"></i></span>${item.label}
    </button>`).join('');

  navigate(user.role === 'admin' ? 'a-dashboard' : 'm-dashboard');
}

function toggleSidebar() {
  const sb  = $('#sidebar');
  const ov  = $('#sbOverlay');
  const open = sb.classList.toggle('open');
  ov.classList.toggle('open', open);
}

/* ─────────────────────────────────────────────────────────
   TOAST
   ───────────────────────────────────────────────────────── */
function toast(msg, type = 'success') {
  const icons = { success:'✓', error:'✕', info:'ℹ' };
  const el = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span class="toast-icon">${icons[type]}</span><span>${msg}</span>`;
  $('#toastContainer').appendChild(el);
  setTimeout(() => {
    el.style.animation = 'toastOut 0.28s ease forwards';
    setTimeout(() => el.remove(), 300);
  }, 3500);
}

/* ─────────────────────────────────────────────────────────
   MODAL
   ───────────────────────────────────────────────────────── */
function openModal(title, body, footer = '') {
  $('#modalTitle').textContent = title;
  $('#modalBody').innerHTML    = body;
  $('#modalFooter').innerHTML  = footer;
  $('#modalOverlay').classList.add('open');
}

function closeModal() { $('#modalOverlay').classList.remove('open'); }

function closeModalOverlay(e) {
  if (e.target === $('#modalOverlay')) closeModal();
}

/* ─────────────────────────────────────────────────────────
   SHORTHAND
   ───────────────────────────────────────────────────────── */
function $(sel) { return document.querySelector(sel.startsWith('#') ? sel : '#'+sel); }

/* ═══════════════════════════════════════════════════════════
   ██████████████   ADMIN VIEWS   ██████████████████████████
   ═══════════════════════════════════════════════════════════ */

/* ── ADMIN DASHBOARD ── */
function vAdminDashboard() {
  updateIssueStatuses(); syncBookCounts();

  const copies       = DB.get('copies');
  const issues       = DB.get('issues');
  const members      = DB.get('members');
  const fines        = DB.get('fines');
  const reservations = DB.get('reservations');

  const totalTitles  = DB.get('books').length;
  const totalCopies  = copies.length;
  const avail        = copies.filter(c => c.status === 'available').length;
  const activeIssues = issues.filter(i => i.status === 'active' || i.status === 'overdue').length;
  const overdue      = issues.filter(i => i.status === 'overdue').length;
  const unpaidFines  = fines.filter(f => !f.paid).reduce((s,f) => s+f.amount, 0);
  const pendingRes   = reservations.filter(r => r.status === 'pending').length;

  const recent = [...issues].sort((a,b) => b.id-a.id).slice(0,6);

  $('#viewContent').innerHTML = `
    <div class="stats-grid mb-24">
      ${sc('📚', totalTitles,  'Book Titles',     'c-purple')}
      ${sc('📋', totalCopies,  'Total Copies',    'c-teal'  )}
      ${sc('✅', avail,        'Available',        'c-green' )}
      ${sc('📤', activeIssues, 'Issued',           'c-gold'  )}
      ${sc('⏰', overdue,      'Overdue',          'c-red'   )}
      ${sc('👥', members.length,'Members',         'c-blue'  )}
      ${sc('🔖', pendingRes,   'Reservations',     'c-gold'  )}
      ${sc('💰','₹'+unpaidFines,'Unpaid Fines',   'c-red'   )}
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-header"><span class="card-title">Recent Activity</span></div>
        <div class="card-body">
          ${recent.map(i => {
            const bk = getBookById(i.bookId), u = getUserById(i.memberId);
            const over = i.status === 'overdue';
            return `<div class="activity-item">
              <div class="activity-dot" style="background:${over?'var(--danger)':'var(--success)'}"></div>
              <div>
                <div class="activity-text">
                  <strong>${u?.name||'?'}</strong>
                  ${i.returnDate ? 'returned' : 'borrowed'}
                  <strong>${bk?.title||'?'}</strong>
                  ${over ? '<span style="color:var(--danger);font-size:11px;"> OVERDUE</span>' : ''}
                </div>
                <div class="activity-time">${fmtDate(i.issueDate)}</div>
              </div>
            </div>`;
          }).join('') || '<p style="color:var(--text-muted);font-size:13px;">No activity yet.</p>'}
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Quick Actions</span></div>
        <div class="card-body">
          <div class="quick-actions">
            <button class="btn btn-primary btn-full"  onclick="navigate('a-issue')"><i class="fa fa-plus"></i> Issue a Book</button>
            <button class="btn btn-gold btn-full"     onclick="openAddBookModal()"><i class="fa fa-book"></i> Add New Book</button>
            <button class="btn btn-ghost btn-full"    onclick="navigate('a-members')"><i class="fa fa-users"></i> View Members</button>
            <button class="btn btn-ghost btn-full"    onclick="navigate('a-fines')"><i class="fa fa-money-bill-wave"></i> Collect Fines</button>
            <button class="btn btn-ghost btn-full"    onclick="navigate('a-reports')"><i class="fa fa-chart-bar"></i> View Reports</button>
          </div>
        </div>
      </div>
    </div>`;
}

/* stat card helper */
function sc(icon, val, label, col) {
  return `<div class="stat-card ${col}">
    <div class="stat-icon">${icon}</div>
    <div class="stat-value">${val}</div>
    <div class="stat-label">${label}</div>
  </div>`;
}

/* ── ADMIN BOOKS ── */
function vAdminBooks() {
  syncBookCounts();
  const books = DB.get('books');
  const cats  = DB.get('categories');
  const copies= DB.get('copies');

  $('#viewContent').innerHTML = `
    <div class="flex-between mb-20">
      <div class="flex-center" style="gap:10px;flex-wrap:wrap;">
        <div class="search-wrap">
          <i class="fa fa-search"></i>
          <input class="form-control" id="bSearch" placeholder="Search title, author, ISBN…" style="width:280px;" oninput="filterBooksTable()">
        </div>
        <select class="form-control" id="bCatFilter" style="width:160px;" onchange="filterBooksTable()">
          <option value="">All Categories</option>
          ${cats.map(c=>`<option value="${c.id}">${c.icon} ${c.name}</option>`).join('')}
        </select>
      </div>
      <button class="btn btn-primary" onclick="openAddBookModal()"><i class="fa fa-plus"></i> Add Book</button>
    </div>
    <div class="card">
      <div class="card-body" style="padding:0;">
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Book</th><th>ISBN</th><th>Author</th><th>Category</th><th style="text-align:center">Copies</th><th style="text-align:center">Avail.</th><th>Actions</th></tr>
            </thead>
            <tbody id="booksTbody">
              ${books.map(b => {
                const cat = getCategoryById(b.categoryId);
                const bc  = copies.filter(c=>c.bookId==b.id);
                const av  = bc.filter(c=>c.status==='available').length;
                return `<tr data-t="${b.title.toLowerCase()}" data-a="${b.author.toLowerCase()}" data-i="${b.isbn}" data-c="${b.categoryId}">
                  <td>
                    <div class="flex-center">
                      <div style="width:34px;height:34px;border-radius:8px;background:rgba(124,58,237,0.12);display:flex;align-items:center;justify-content:center;font-size:16px;flex-shrink:0;">📖</div>
                      <div>
                        <div style="font-weight:600;font-size:13px;">${b.title}</div>
                        <div style="font-size:10.5px;color:var(--text-muted);">${b.edition} Ed · ${b.year}</div>
                      </div>
                    </div>
                  </td>
                  <td><code style="font-size:11.5px;color:var(--text-muted);">${b.isbn}</code></td>
                  <td style="font-size:12.5px;">${b.author}</td>
                  <td>${cat?`<span style="font-size:12.5px;">${cat.icon} ${cat.name}</span>`:'—'}</td>
                  <td style="text-align:center;font-weight:600;">${bc.length}</td>
                  <td style="text-align:center;font-weight:700;color:${av>0?'var(--success)':'var(--danger)'};">${av}</td>
                  <td>
                    <div class="flex-center" style="gap:6px;">
                      <button class="btn btn-ghost btn-sm" onclick="openCopiesModal(${b.id})"><i class="fa fa-copy"></i> Copies</button>
                      <button class="btn btn-ghost btn-sm" onclick="openEditBookModal(${b.id})"><i class="fa fa-edit"></i></button>
                      <button class="btn btn-danger btn-sm" onclick="deleteBook(${b.id})"><i class="fa fa-trash"></i></button>
                    </div>
                  </td>
                </tr>`;
              }).join('') || `<tr><td colspan="7" class="table-empty">No books yet. Add your first book!</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
}

function filterBooksTable() {
  const term = ($('#bSearch')?.value||'').toLowerCase();
  const cat  = $('#bCatFilter')?.value||'';
  document.querySelectorAll('#booksTbody tr[data-t]').forEach(r => {
    r.hidden = !(!term || r.dataset.t.includes(term)||r.dataset.a.includes(term)||r.dataset.i.includes(term)) ||
               !(!cat  || r.dataset.c == cat);
    /* simplify */ r.hidden = !(
      (!term || r.dataset.t.includes(term) || r.dataset.a.includes(term) || r.dataset.i.includes(term)) &&
      (!cat  || r.dataset.c == cat)
    );
  });
}

function openAddBookModal() {
  const cats = DB.get('categories'), pubs = DB.get('publishers');
  openModal('Add New Book', `
    <div class="form-row">
      <div class="form-group"><label class="form-label">Title *</label><input class="form-control" id="mbTitle" placeholder="Book title"></div>
      <div class="form-group"><label class="form-label">ISBN *</label><input class="form-control" id="mbISBN" placeholder="978-x-xxx-xxxxx-x"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Author(s) *</label><input class="form-control" id="mbAuthor" placeholder="Author names"></div>
      <div class="form-group"><label class="form-label">Year</label><input class="form-control" id="mbYear" type="number" placeholder="${new Date().getFullYear()}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Edition</label><input class="form-control" id="mbEd" placeholder="1st"></div>
      <div class="form-group"><label class="form-label">Category</label>
        <select class="form-control" id="mbCat">${cats.map(c=>`<option value="${c.id}">${c.icon} ${c.name}</option>`).join('')}</select>
      </div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Publisher</label>
        <select class="form-control" id="mbPub">${pubs.map(p=>`<option value="${p.id}">${p.name}</option>`).join('')}</select>
      </div>
      <div class="form-group"><label class="form-label">Accession No. (1st copy) *</label><input class="form-control" id="mbAcc" placeholder="CS-2025-001"></div>
    </div>`,
  `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
   <button class="btn btn-primary" onclick="saveNewBook()"><i class="fa fa-save"></i> Save Book</button>`);
}

function saveNewBook() {
  const title = $('#mbTitle').value.trim(), isbn = $('#mbISBN').value.trim();
  const author= $('#mbAuthor').value.trim(), acc = $('#mbAcc').value.trim();
  const year  = parseInt($('#mbYear').value)||new Date().getFullYear();
  const ed    = $('#mbEd').value.trim()||'1st';
  const catId = parseInt($('#mbCat').value), pubId = parseInt($('#mbPub').value);

  if (!title||!isbn||!author||!acc) { toast('Fill required fields *', 'error'); return; }

  const books = DB.get('books');
  if (books.find(b=>b.isbn===isbn))               { toast('ISBN already exists', 'error'); return; }
  if (DB.get('copies').find(c=>c.accessionNo===acc)){ toast('Accession number in use', 'error'); return; }

  const bookId = nextId('books');
  books.push({ id:bookId, title, isbn, author, year, edition:ed, categoryId:catId, publisherId:pubId });
  DB.set('books', books);

  const copies = DB.get('copies');
  copies.push({ id:nextId('copies'), bookId, accessionNo:acc, status:'available' });
  DB.set('copies', copies);

  closeModal();
  toast(`"${title}" added to catalogue`, 'success');
  vAdminBooks();
}

function openEditBookModal(bookId) {
  const b = getBookById(bookId); if (!b) return;
  const cats = DB.get('categories');
  openModal('Edit Book', `
    <div class="form-group"><label class="form-label">Title</label><input class="form-control" id="ebTitle" value="${escHtml(b.title)}"></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Author</label><input class="form-control" id="ebAuthor" value="${escHtml(b.author)}"></div>
      <div class="form-group"><label class="form-label">Edition</label><input class="form-control" id="ebEd" value="${escHtml(b.edition)}"></div>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Year</label><input class="form-control" id="ebYear" type="number" value="${b.year}"></div>
      <div class="form-group"><label class="form-label">Category</label>
        <select class="form-control" id="ebCat">${cats.map(c=>`<option value="${c.id}" ${c.id==b.categoryId?'selected':''}>${c.icon} ${c.name}</option>`).join('')}</select>
      </div>
    </div>`,
  `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
   <button class="btn btn-primary" onclick="saveEditBook(${bookId})"><i class="fa fa-save"></i> Update</button>`);
}

function saveEditBook(id) {
  const books = DB.get('books');
  const idx   = books.findIndex(b=>b.id==id); if (idx<0) return;
  books[idx].title      = $('#ebTitle').value.trim()  || books[idx].title;
  books[idx].author     = $('#ebAuthor').value.trim() || books[idx].author;
  books[idx].edition    = $('#ebEd').value.trim()     || books[idx].edition;
  books[idx].year       = parseInt($('#ebYear').value)|| books[idx].year;
  books[idx].categoryId = parseInt($('#ebCat').value);
  DB.set('books', books);
  closeModal(); toast('Book updated', 'success'); vAdminBooks();
}

function deleteBook(bookId) {
  const b = getBookById(bookId); if (!b) return;
  const hasActive = DB.get('copies').some(c => c.bookId==bookId && (c.status==='issued'||c.status==='reserved'));
  if (hasActive) { toast('Cannot delete: active issues or reservations exist', 'error'); return; }
  if (!confirm(`Delete "${b.title}"? This cannot be undone.`)) return;
  DB.set('books',  DB.get('books').filter(x=>x.id!=bookId));
  DB.set('copies', DB.get('copies').filter(c=>c.bookId!=bookId));
  toast('Book deleted', 'info'); vAdminBooks();
}

function openCopiesModal(bookId) {
  const b = getBookById(bookId);
  const copies = DB.get('copies').filter(c=>c.bookId==bookId);
  openModal(`Copies — ${b.title}`, `
    <div class="table-wrap" style="margin-bottom:18px;">
      <table>
        <thead><tr><th>Accession No.</th><th>Status</th><th></th></tr></thead>
        <tbody>
          ${copies.map(c=>`<tr>
            <td><code style="color:var(--text-muted);font-size:12px;">${c.accessionNo}</code></td>
            <td>${badge(c.status)}</td>
            <td>${c.status==='available'?`<button class="btn btn-danger btn-sm" onclick="deleteCopy(${c.id},${bookId})"><i class="fa fa-trash"></i></button>`:'—'}</td>
          </tr>`).join('')}
        </tbody>
      </table>
    </div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">New Accession No.</label><input class="form-control" id="newAcc" placeholder="CS-2025-010"></div>
      <div class="form-group" style="display:flex;align-items:flex-end;">
        <button class="btn btn-primary btn-full" onclick="addCopy(${bookId})"><i class="fa fa-plus"></i> Add Copy</button>
      </div>
    </div>`);
}

function addCopy(bookId) {
  const acc = $('#newAcc').value.trim();
  if (!acc) { toast('Enter accession number', 'error'); return; }
  if (DB.get('copies').find(c=>c.accessionNo===acc)) { toast('Accession number in use', 'error'); return; }
  const copies = DB.get('copies');
  copies.push({ id:nextId('copies'), bookId, accessionNo:acc, status:'available' });
  DB.set('copies', copies);
  toast('Copy added', 'success'); closeModal(); vAdminBooks();
}

function deleteCopy(copyId, bookId) {
  if (!confirm('Delete this copy?')) return;
  DB.set('copies', DB.get('copies').filter(c=>c.id!=copyId));
  toast('Copy deleted', 'info'); closeModal(); vAdminBooks();
}

/* ── ADMIN MEMBERS ── */
function vAdminMembers() {
  const users   = DB.get('users').filter(u=>u.role==='member');
  const members = DB.get('members');
  const issues  = DB.get('issues');

  $('#viewContent').innerHTML = `
    <div class="flex-between mb-20">
      <div class="flex-center" style="gap:10px;flex-wrap:wrap;">
        <div class="search-wrap">
          <i class="fa fa-search"></i>
          <input class="form-control" id="mSearch" placeholder="Search name, email or code…" style="width:280px;" oninput="filterMembersTable()">
        </div>
        <select class="form-control" id="mStatusFilter" style="width:150px;" onchange="filterMembersTable()">
          <option value="">All Status</option>
          <option value="active">Active</option>
          <option value="suspended">Suspended</option>
          <option value="expired">Expired</option>
        </select>
      </div>
    </div>
    <div class="card">
      <div class="card-body" style="padding:0;">
        <div class="table-wrap">
          <table>
            <thead>
              <tr><th>Member</th><th>Code</th><th>Department</th><th>Status</th><th style="text-align:center">Active Loans</th><th>Actions</th></tr>
            </thead>
            <tbody id="membersTbody">
              ${users.map(u => {
                const m     = members.find(x=>x.id==u.id)||{};
                const loans = issues.filter(i=>i.memberId==u.id&&(i.status==='active'||i.status==='overdue')).length;
                const ini   = u.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
                return `<tr data-n="${u.name.toLowerCase()}" data-e="${u.email.toLowerCase()}" data-c="${(m.memberId||'').toLowerCase()}" data-s="${m.status||'active'}">
                  <td>
                    <div class="flex-center">
                      <div class="user-avatar" style="width:34px;height:34px;font-size:12px;">${ini}</div>
                      <div>
                        <div style="font-weight:600;font-size:13px;">${u.name}</div>
                        <div style="font-size:11px;color:var(--text-muted);">${u.email}</div>
                      </div>
                    </div>
                  </td>
                  <td><code style="font-size:11.5px;color:var(--text-muted);">${m.memberId||'—'}</code></td>
                  <td style="font-size:12.5px;">${m.department||'—'}</td>
                  <td>${badge(m.status||'active')}</td>
                  <td style="text-align:center;font-weight:700;color:${loans>0?'var(--gold)':'var(--text-muted)'};">${loans}</td>
                  <td>
                    <div class="flex-center" style="gap:6px;">
                      <button class="btn btn-ghost btn-sm" onclick="openMemberHistory(${u.id})"><i class="fa fa-history"></i> History</button>
                      <button class="btn btn-ghost btn-sm" onclick="toggleMember(${u.id})">${(m.status||'active')==='active'?'Suspend':'Activate'}</button>
                    </div>
                  </td>
                </tr>`;
              }).join('') || `<tr><td colspan="6" class="table-empty">No members found.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
}

function filterMembersTable() {
  const term   = ($('#mSearch')?.value||'').toLowerCase();
  const status = $('#mStatusFilter')?.value||'';
  document.querySelectorAll('#membersTbody tr[data-n]').forEach(r => {
    r.hidden = !(
      (!term   || r.dataset.n.includes(term)||r.dataset.e.includes(term)||r.dataset.c.includes(term)) &&
      (!status || r.dataset.s === status)
    );
  });
}

function toggleMember(userId) {
  const members = DB.get('members');
  const idx = members.findIndex(m=>m.id==userId); if (idx<0) return;
  const next = members[idx].status === 'active' ? 'suspended' : 'active';
  members[idx].status = next;
  DB.set('members', members);
  toast(`Member status set to ${next}`, 'info');
  vAdminMembers();
}

function openMemberHistory(userId) {
  const user   = getUserById(userId);
  const issues = DB.get('issues').filter(i=>i.memberId==userId);
  const fines  = DB.get('fines').filter(f=>f.memberId==userId);
  const totalF = fines.reduce((s,f)=>s+f.amount,0);
  const unpaidF= fines.filter(f=>!f.paid).reduce((s,f)=>s+f.amount,0);

  openModal(`${user.name} — Borrowing History`, `
    <div class="table-wrap">
      <table>
        <thead><tr><th>Book</th><th>Issued</th><th>Due</th><th>Returned</th><th>Status</th></tr></thead>
        <tbody>
          ${issues.map(i => {
            const bk = getBookById(i.bookId);
            return `<tr>
              <td style="font-size:12.5px;font-weight:500;">${bk?.title||'—'}</td>
              <td style="font-size:11.5px;">${fmtDate(i.issueDate)}</td>
              <td style="font-size:11.5px;color:${i.status==='overdue'?'var(--danger)':'inherit'};">${fmtDate(i.dueDate)}</td>
              <td style="font-size:11.5px;">${fmtDate(i.returnDate)}</td>
              <td>${badge(i.status)}</td>
            </tr>`;
          }).join('') || `<tr><td colspan="5" class="table-empty">No history</td></tr>`}
        </tbody>
      </table>
    </div>
    ${totalF ? `<div style="margin-top:16px;padding:12px;border-radius:9px;background:rgba(239,68,68,0.08);border:1px solid rgba(239,68,68,0.2);font-size:13px;">
      Total fines: <strong>₹${totalF}</strong> &nbsp;·&nbsp; Unpaid: <strong style="color:var(--danger)">₹${unpaidF}</strong>
    </div>` : ''}`);
}

/* ── ADMIN ISSUE & RETURN ── */
function vAdminIssue() {
  updateIssueStatuses();
  const issues      = DB.get('issues').filter(i=>i.status==='active'||i.status==='overdue');
  const users       = DB.get('users').filter(u=>u.role==='member');
  const members     = DB.get('members');
  const availCopies = DB.get('copies').filter(c=>c.status==='available');

  $('#viewContent').innerHTML = `
    <div class="grid-2 mb-24">
      <!-- Issue -->
      <div class="card">
        <div class="card-header"><span class="card-title">📤 Issue a Book</span></div>
        <div class="card-body">
          <div class="form-group"><label class="form-label">Member *</label>
            <select class="form-control" id="issueMemSel">
              <option value="">— Select member —</option>
              ${users.map(u=>{const m=members.find(x=>x.id==u.id);return `<option value="${u.id}">${u.name} (${m?.memberId||'?'})</option>`;}).join('')}
            </select>
          </div>
          <div class="form-group"><label class="form-label">Available Copy *</label>
            <select class="form-control" id="issueCopySel">
              <option value="">— Select copy —</option>
              ${availCopies.map(c=>{const b=getBookById(c.bookId);return `<option value="${c.id}">${b?.title||'?'} — ${c.accessionNo}</option>`;}).join('')}
            </select>
          </div>
          <div class="form-row">
            <div class="form-group"><label class="form-label">Issue Date</label><input class="form-control" type="date" id="issueDate" value="${today()}"></div>
            <div class="form-group"><label class="form-label">Due Date</label><input class="form-control" type="date" id="issueDue" value="${addDays(today(),LOAN_DAYS)}"></div>
          </div>
          <button class="btn btn-primary btn-full" onclick="doIssueBook()"><i class="fa fa-arrow-right"></i> Issue Book</button>
        </div>
      </div>

      <!-- Return -->
      <div class="card">
        <div class="card-header"><span class="card-title">📥 Process Return</span></div>
        <div class="card-body">
          <div class="form-group"><label class="form-label">Active Issue *</label>
            <select class="form-control" id="returnIssueSel" onchange="previewFine()">
              <option value="">— Select issue —</option>
              ${issues.map(i=>{const bk=getBookById(i.bookId),u=getUserById(i.memberId);return `<option value="${i.id}" data-due="${i.dueDate}">${u?.name||'?'} — ${bk?.title||'?'} (Due: ${fmtDate(i.dueDate)})</option>`;}).join('')}
            </select>
          </div>
          <div class="form-group"><label class="form-label">Return Date</label>
            <input class="form-control" type="date" id="returnDate" value="${today()}" onchange="previewFine()">
          </div>
          <div class="fine-preview-box" id="finePreview" style="display:none;">
            ⚠️ Fine: <strong id="fineAmt"></strong>
          </div>
          <button class="btn btn-success btn-full" onclick="doReturnBook()"><i class="fa fa-undo"></i> Process Return</button>
        </div>
      </div>
    </div>

    <!-- Active Issues Table -->
    <div class="card">
      <div class="card-header">
        <span class="card-title">All Active Issues</span>
        <span style="font-size:13px;color:var(--text-muted);">${issues.length} active</span>
      </div>
      <div class="card-body" style="padding:0;">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Member</th><th>Book</th><th>Accession</th><th>Issue Date</th><th>Due Date</th><th>Status</th><th>Fine (est.)</th></tr></thead>
            <tbody>
              ${issues.map(i=>{
                const bk=getBookById(i.bookId),u=getUserById(i.memberId),cp=getCopyById(i.copyId);
                const fine=calcFine(i.dueDate,null);
                return `<tr>
                  <td style="font-size:13px;">${u?.name||'—'}</td>
                  <td style="font-size:13px;font-weight:500;">${bk?.title||'—'}</td>
                  <td><code style="font-size:11.5px;color:var(--text-muted);">${cp?.accessionNo||'—'}</code></td>
                  <td style="font-size:12px;">${fmtDate(i.issueDate)}</td>
                  <td style="font-size:12px;color:${i.status==='overdue'?'var(--danger)':'inherit'};">${fmtDate(i.dueDate)}</td>
                  <td>${badge(i.status)}</td>
                  <td style="font-weight:700;color:${fine>0?'var(--danger)':'var(--text-muted)'};">${fine>0?'₹'+fine:'—'}</td>
                </tr>`;
              }).join('') || `<tr><td colspan="7" class="table-empty">No active issues</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
}

function previewFine() {
  const sel = $('#returnIssueSel'); if (!sel) return;
  const opt = sel.options[sel.selectedIndex];
  const ret = $('#returnDate')?.value;
  const box = $('#finePreview');
  if (!opt?.dataset?.due || !ret) { box.style.display='none'; return; }
  const fine = calcFine(opt.dataset.due, ret);
  if (fine > 0) {
    $('#fineAmt').textContent = `₹${fine} (${daysBetween(opt.dataset.due, ret)} days × ₹${FINE_RATE})`;
    box.style.display = 'block';
  } else { box.style.display = 'none'; }
}

function doIssueBook() {
  const memberId = parseInt($('#issueMemSel').value);
  const copyId   = parseInt($('#issueCopySel').value);
  const issDate  = $('#issueDate').value;
  const dueDate  = $('#issueDue').value;

  if (!memberId||!copyId||!issDate||!dueDate) { toast('Fill all required fields', 'error'); return; }
  if (dueDate <= issDate) { toast('Due date must be after issue date', 'error'); return; }

  const mem = getMemberById(memberId);
  if (!mem || mem.status==='suspended') { toast('Member is suspended — cannot borrow', 'error'); return; }

  const active = DB.get('issues').filter(i=>i.memberId==memberId&&(i.status==='active'||i.status==='overdue')).length;
  if (active >= MAX_LOANS) { toast(`Member already has ${MAX_LOANS} active loans (maximum)`, 'error'); return; }

  const copy = getCopyById(copyId);
  if (!copy||copy.status!=='available') { toast('Copy is no longer available', 'error'); return; }

  const issues = DB.get('issues');
  issues.push({ id:nextId('issues'), copyId, bookId:copy.bookId, memberId, issueDate:issDate, dueDate, returnDate:null, status:'active' });
  DB.set('issues', issues);

  const copies = DB.get('copies');
  copies.find(c=>c.id==copyId).status = 'issued';
  DB.set('copies', copies);

  const bk = getBookById(copy.bookId);
  toast(`"${bk?.title}" issued successfully`, 'success');
  vAdminIssue();
}

function doReturnBook() {
  const issueId  = parseInt($('#returnIssueSel').value);
  const retDate  = $('#returnDate').value;
  if (!issueId||!retDate) { toast('Select issue and return date', 'error'); return; }

  const issues = DB.get('issues');
  const idx    = issues.findIndex(i=>i.id==issueId); if (idx<0) return;
  const issue  = issues[idx];
  if (retDate < issue.issueDate) { toast('Return date cannot be before issue date', 'error'); return; }

  const fine = calcFine(issue.dueDate, retDate);

  issues[idx].returnDate = retDate;
  issues[idx].status     = 'returned';
  DB.set('issues', issues);

  const copies = DB.get('copies');
  const ci = copies.findIndex(c=>c.id==issue.copyId);
  if (ci>=0) copies[ci].status = 'available';
  DB.set('copies', copies);

  if (fine > 0) {
    const fines = DB.get('fines');
    fines.push({ id:nextId('fines'), issueId, memberId:issue.memberId, amount:fine, paid:false, paidAt:null, reason:'Overdue return' });
    DB.set('fines', fines);
    toast(`Returned. Fine created: ₹${fine}`, 'info');
  } else {
    toast('Book returned. No fine.', 'success');
  }

  fulfillNextReservation(issue.bookId);
  vAdminIssue();
}

function fulfillNextReservation(bookId) {
  const reservations = DB.get('reservations');
  const pending = reservations.filter(r=>r.bookId==bookId&&r.status==='pending').sort((a,b)=>a.queuePosition-b.queuePosition);
  if (!pending.length) return;
  const copies = DB.get('copies');
  const avail  = copies.find(c=>c.bookId==bookId&&c.status==='available');
  if (!avail) return;
  avail.status = 'reserved';
  DB.set('copies', copies);
  const ri = reservations.findIndex(r=>r.id==pending[0].id);
  reservations[ri].status = 'ready';
  reservations[ri].copyId = avail.id;
  DB.set('reservations', reservations);
}

/* ── ADMIN RESERVATIONS ── */
function vAdminReservations() {
  const reservations = DB.get('reservations');

  $('#viewContent').innerHTML = `
    <div class="flex-between mb-20">
      <div style="font-size:13px;color:var(--text-muted);">
        ${reservations.filter(r=>r.status==='pending').length} pending &nbsp;·&nbsp;
        ${reservations.filter(r=>r.status==='ready').length} ready to collect
      </div>
    </div>
    <div class="card">
      <div class="card-body" style="padding:0;">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Member</th><th>Book</th><th>Reserved On</th><th style="text-align:center">Queue #</th><th>Status</th><th>Actions</th></tr></thead>
            <tbody>
              ${reservations.map(r=>{
                const u=getUserById(r.memberId), bk=getBookById(r.bookId);
                return `<tr>
                  <td style="font-size:13px;">${u?.name||'—'}</td>
                  <td style="font-size:13px;font-weight:500;">${bk?.title||'—'}</td>
                  <td style="font-size:12px;">${fmtDate(r.reservedAt)}</td>
                  <td style="text-align:center;font-weight:700;color:var(--primary-light);">#${r.queuePosition}</td>
                  <td>${badge(r.status)}</td>
                  <td>
                    <div class="flex-center" style="gap:6px;">
                      ${(r.status==='pending'||r.status==='ready') ? `<button class="btn btn-danger btn-sm" onclick="adminCancelRes(${r.id})"><i class="fa fa-times"></i> Cancel</button>` : '—'}
                      ${r.status==='ready' ? `<button class="btn btn-primary btn-sm" onclick="adminFulfillRes(${r.id})"><i class="fa fa-check"></i> Issue</button>` : ''}
                    </div>
                  </td>
                </tr>`;
              }).join('') || `<tr><td colspan="6" class="table-empty">No reservations found.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
}

function adminCancelRes(resId) {
  if (!confirm('Cancel this reservation?')) return;
  const reservations = DB.get('reservations');
  const idx = reservations.findIndex(r=>r.id==resId); if (idx<0) return;
  const res = reservations[idx];
  if (res.copyId) {
    const copies = DB.get('copies');
    const ci = copies.findIndex(c=>c.id==res.copyId);
    if (ci>=0&&copies[ci].status==='reserved') copies[ci].status='available';
    DB.set('copies', copies);
  }
  reservations[idx].status = 'cancelled';
  DB.set('reservations', reservations);
  toast('Reservation cancelled', 'info');
  vAdminReservations();
}

function adminFulfillRes(resId) {
  const reservations = DB.get('reservations');
  const idx = reservations.findIndex(r=>r.id==resId); if (idx<0) return;
  const res = reservations[idx];
  if (!res.copyId) { toast('No copy assigned to reservation', 'error'); return; }

  const issues = DB.get('issues');
  const iss = today(), due = addDays(iss, LOAN_DAYS);
  issues.push({ id:nextId('issues'), copyId:res.copyId, bookId:res.bookId, memberId:res.memberId, issueDate:iss, dueDate:due, returnDate:null, status:'active' });
  DB.set('issues', issues);

  const copies = DB.get('copies');
  const ci = copies.findIndex(c=>c.id==res.copyId);
  if (ci>=0) copies[ci].status='issued';
  DB.set('copies', copies);

  reservations[idx].status = 'fulfilled';
  DB.set('reservations', reservations);

  toast(`Reservation fulfilled — book issued`, 'success');
  vAdminReservations();
}

/* ── ADMIN FINES ── */
function vAdminFines() {
  const fines = DB.get('fines');
  const unpaid= fines.filter(f=>!f.paid).reduce((s,f)=>s+f.amount,0);
  const paid  = fines.filter(f=>f.paid).reduce((s,f)=>s+f.amount,0);

  $('#viewContent').innerHTML = `
    <div class="stats-grid mb-24" style="grid-template-columns:repeat(3,1fr);">
      ${sc('💳','₹'+unpaid,'Outstanding','c-red')}
      ${sc('✅','₹'+paid,'Collected','c-green')}
      ${sc('📊',fines.length,'Total Fines','c-purple')}
    </div>
    <div class="card">
      <div class="card-header">
        <span class="card-title">All Fines</span>
        <span style="font-size:13px;color:var(--text-muted);">${fines.filter(f=>!f.paid).length} unpaid</span>
      </div>
      <div class="card-body" style="padding:0;">
        <div class="table-wrap">
          <table>
            <thead><tr><th>Member</th><th>Book</th><th>Amount</th><th>Reason</th><th>Status</th><th>Paid On</th><th>Action</th></tr></thead>
            <tbody>
              ${fines.map(f=>{
                const u=getUserById(f.memberId);
                const issue=DB.get('issues').find(i=>i.id==f.issueId);
                const bk=issue?getBookById(issue.bookId):null;
                return `<tr>
                  <td style="font-size:13px;">${u?.name||'—'}</td>
                  <td style="font-size:13px;">${bk?.title||'—'}</td>
                  <td style="font-weight:700;color:${f.paid?'var(--success)':'var(--danger)'};">₹${f.amount}</td>
                  <td style="font-size:12px;color:var(--text-muted);">${f.reason}</td>
                  <td>${badge(f.paid?'paid':'unpaid')}</td>
                  <td style="font-size:12px;">${f.paidAt?fmtDate(f.paidAt):'—'}</td>
                  <td>${!f.paid?`<button class="btn btn-success btn-sm" onclick="collectFine(${f.id})"><i class="fa fa-check"></i> Collect</button>`:'—'}</td>
                </tr>`;
              }).join('') || `<tr><td colspan="7" class="table-empty">No fines recorded.</td></tr>`}
            </tbody>
          </table>
        </div>
      </div>
    </div>`;
}

function collectFine(fineId) {
  const fines = DB.get('fines');
  const idx   = fines.findIndex(f=>f.id==fineId); if (idx<0) return;
  fines[idx].paid  = true;
  fines[idx].paidAt= today();
  DB.set('fines', fines);
  toast(`Fine of ₹${fines[idx].amount} collected`, 'success');
  vAdminFines();
}

/* ── ADMIN REPORTS ── */
function vAdminReports() {
  updateIssueStatuses();
  const issues  = DB.get('issues');
  const fines   = DB.get('fines');
  const logs    = DB.get('accessLogs');
  const overdue = issues.filter(i=>i.status==='overdue');

  /* popular books */
  const counts = {};
  issues.forEach(i=>{ counts[i.bookId]=(counts[i.bookId]||0)+1; });
  const popular = Object.entries(counts).sort((a,b)=>b[1]-a[1]).slice(0,8)
                    .map(([bid,cnt])=>({ bk:getBookById(parseInt(bid)), cnt }));

  $('#viewContent').innerHTML = `
    <div class="tab-bar">
      <button class="tab-btn active" id="rTab0" onclick="rTab(0)">Overdue Books</button>
      <button class="tab-btn"        id="rTab1" onclick="rTab(1)">Popular Titles</button>
      <button class="tab-btn"        id="rTab2" onclick="rTab(2)">Fine Collection</button>
      <button class="tab-btn"        id="rTab3" onclick="rTab(3)">Digital Access</button>
    </div>

    <div class="tab-pane active" id="rPane0">
      <div class="card">
        <div class="card-header">
          <span class="card-title">Overdue Books</span>
          <span style="font-size:13px;color:var(--danger);">${overdue.length} overdue</span>
        </div>
        <div class="card-body" style="padding:0;"><div class="table-wrap"><table>
          <thead><tr><th>Member</th><th>Book</th><th>Issue Date</th><th>Due Date</th><th>Days Overdue</th><th>Fine (est.)</th></tr></thead>
          <tbody>
            ${overdue.map(i=>{
              const u=getUserById(i.memberId),bk=getBookById(i.bookId);
              const days=daysBetween(i.dueDate,today());
              return `<tr>
                <td style="font-size:13px;">${u?.name||'—'}</td>
                <td style="font-size:13px;font-weight:500;">${bk?.title||'—'}</td>
                <td style="font-size:12px;">${fmtDate(i.issueDate)}</td>
                <td style="font-size:12px;color:var(--danger);">${fmtDate(i.dueDate)}</td>
                <td style="font-weight:700;color:var(--danger);">${days} days</td>
                <td style="font-weight:700;color:var(--gold);">₹${calcFine(i.dueDate,null)}</td>
              </tr>`;
            }).join('') || `<tr><td colspan="6" class="table-empty">No overdue books 🎉</td></tr>`}
          </tbody>
        </table></div></div>
      </div>
    </div>

    <div class="tab-pane" id="rPane1">
      <div class="card">
        <div class="card-header"><span class="card-title">Most Borrowed Titles</span></div>
        <div class="card-body" style="padding:0;"><div class="table-wrap"><table>
          <thead><tr><th>Rank</th><th>Title</th><th>Author</th><th>Category</th><th>Times Issued</th></tr></thead>
          <tbody>
            ${popular.map((p,i)=>{
              const cat=getCategoryById(p.bk?.categoryId);
              return `<tr>
                <td style="font-weight:800;color:var(--gold);font-size:20px;">#${i+1}</td>
                <td style="font-size:13px;font-weight:600;">${p.bk?.title||'—'}</td>
                <td style="font-size:12px;color:var(--text-muted);">${p.bk?.author||'—'}</td>
                <td style="font-size:12.5px;">${cat?cat.icon+' '+cat.name:'—'}</td>
                <td style="font-weight:700;color:var(--primary-light);">${p.cnt}</td>
              </tr>`;
            }).join('') || `<tr><td colspan="5" class="table-empty">No issue data yet.</td></tr>`}
          </tbody>
        </table></div></div>
      </div>
    </div>

    <div class="tab-pane" id="rPane2">
      <div class="stats-grid mb-20" style="grid-template-columns:repeat(3,1fr);">
        ${sc('💸','₹'+fines.filter(f=>!f.paid).reduce((s,f)=>s+f.amount,0),'Outstanding','c-red')}
        ${sc('✅','₹'+fines.filter(f=>f.paid).reduce((s,f)=>s+f.amount,0),'Collected','c-green')}
        ${sc('📊','₹'+fines.reduce((s,f)=>s+f.amount,0),'Total','c-purple')}
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Fine Collection Report</span></div>
        <div class="card-body" style="padding:0;"><div class="table-wrap"><table>
          <thead><tr><th>Member</th><th>Amount</th><th>Status</th><th>Collected On</th></tr></thead>
          <tbody>
            ${fines.map(f=>`<tr>
              <td style="font-size:13px;">${getUserById(f.memberId)?.name||'—'}</td>
              <td style="font-weight:700;">₹${f.amount}</td>
              <td>${badge(f.paid?'paid':'unpaid')}</td>
              <td style="font-size:12px;">${f.paidAt?fmtDate(f.paidAt):'—'}</td>
            </tr>`).join('') || `<tr><td colspan="4" class="table-empty">No fines.</td></tr>`}
          </tbody>
        </table></div></div>
      </div>
    </div>

    <div class="tab-pane" id="rPane3">
      <div class="card">
        <div class="card-header"><span class="card-title">Digital Resource Access Logs</span><span style="font-size:13px;color:var(--text-muted);">${logs.length} accesses</span></div>
        <div class="card-body" style="padding:0;"><div class="table-wrap"><table>
          <thead><tr><th>Member</th><th>Resource</th><th>Accessed At</th></tr></thead>
          <tbody>
            ${logs.map(l=>{
              const u=getUserById(l.memberId),r=DB.get('digitalResources').find(x=>x.id==l.resourceId);
              return `<tr>
                <td style="font-size:13px;">${u?.name||'—'}</td>
                <td style="font-size:13px;">${r?r.icon+' '+r.title:'—'}</td>
                <td style="font-size:12px;">${new Date(l.accessedAt).toLocaleString('en-IN')}</td>
              </tr>`;
            }).join('') || `<tr><td colspan="3" class="table-empty">No access logs.</td></tr>`}
          </tbody>
        </table></div></div>
      </div>
    </div>`;
}

function rTab(n) {
  for (let i=0;i<4;i++) {
    document.querySelector(`#rTab${i}`)?.classList.toggle('active', i===n);
    document.querySelector(`#rPane${i}`)?.classList.toggle('active', i===n);
  }
}

/* ── ADMIN DIGITAL RESOURCES ── */
function vAdminDigital() {
  const resources = DB.get('digitalResources');
  const logs      = DB.get('accessLogs');

  $('#viewContent').innerHTML = `
    <div class="flex-between mb-20">
      <div style="font-size:13px;color:var(--text-muted);">${resources.length} resources · ${logs.length} total accesses</div>
      <button class="btn btn-primary" onclick="openAddResourceModal()"><i class="fa fa-plus"></i> Add Resource</button>
    </div>
    <div style="display:grid;gap:14px;">
      ${resources.map(r=>`
        <div class="resource-card">
          <div class="resource-icon">${r.icon}</div>
          <div style="flex:1;">
            <div class="resource-title">${escHtml(r.title)}</div>
            <div class="resource-desc">${escHtml(r.desc)}</div>
            <span class="cat-tag">${r.category}</span>
            <span style="font-size:11px;color:var(--text-faint);margin-left:8px;">${logs.filter(l=>l.resourceId==r.id).length} accesses</span>
          </div>
          <button class="btn btn-danger btn-sm" onclick="deleteResource(${r.id})"><i class="fa fa-trash"></i></button>
        </div>
      `).join('') || `<div class="card"><div class="card-body table-empty">No resources yet.</div></div>`}
    </div>`;
}

function openAddResourceModal() {
  openModal('Add Digital Resource', `
    <div class="form-group"><label class="form-label">Title *</label><input class="form-control" id="rTitle" placeholder="Resource name"></div>
    <div class="form-row">
      <div class="form-group"><label class="form-label">Category</label>
        <select class="form-control" id="rCat"><option>Database</option><option>E-Books</option><option>Video</option><option>Journal</option></select>
      </div>
      <div class="form-group"><label class="form-label">Emoji Icon</label><input class="form-control" id="rIcon" placeholder="📚" maxlength="2"></div>
    </div>
    <div class="form-group"><label class="form-label">URL</label><input class="form-control" id="rUrl" placeholder="https://…"></div>
    <div class="form-group"><label class="form-label">Description</label><input class="form-control" id="rDesc" placeholder="Short description"></div>`,
  `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
   <button class="btn btn-primary" onclick="saveResource()">Save</button>`);
}

function saveResource() {
  const title = $('#rTitle').value.trim();
  if (!title) { toast('Title is required', 'error'); return; }
  const resources = DB.get('digitalResources');
  resources.push({
    id:nextId('resources'), title,
    category: $('#rCat').value,
    icon: $('#rIcon').value || '📁',
    url:  $('#rUrl').value  || '#',
    desc: $('#rDesc').value || ''
  });
  DB.set('digitalResources', resources);
  closeModal(); toast('Resource added', 'success'); vAdminDigital();
}

function deleteResource(id) {
  if (!confirm('Delete this resource?')) return;
  DB.set('digitalResources', DB.get('digitalResources').filter(r=>r.id!=id));
  toast('Resource deleted', 'info'); vAdminDigital();
}

/* ═══════════════════════════════════════════════════════════
   ██████████████   MEMBER VIEWS   ██████████████████████████
   ═══════════════════════════════════════════════════════════ */

/* ── MEMBER DASHBOARD ── */
function vMemberDashboard() {
  updateIssueStatuses();
  const uid         = currentUser.id;
  const issues      = DB.get('issues').filter(i=>i.memberId==uid);
  const active      = issues.filter(i=>i.status==='active'||i.status==='overdue');
  const overdue     = issues.filter(i=>i.status==='overdue');
  const reservations= DB.get('reservations').filter(r=>r.memberId==uid&&(r.status==='pending'||r.status==='ready'));
  const fines       = DB.get('fines').filter(f=>f.memberId==uid&&!f.paid);
  const unpaidF     = fines.reduce((s,f)=>s+f.amount,0);
  const member      = getMemberById(uid)||{};

  $('#viewContent').innerHTML = `
    <div class="stats-grid mb-24">
      ${sc('📤',active.length,'Active Loans','c-gold')}
      ${sc('⏰',overdue.length,'Overdue','c-red')}
      ${sc('🔖',reservations.length,'Reservations','c-blue')}
      ${sc('💰','₹'+unpaidF,'Unpaid Fines','c-red')}
    </div>
    <div class="grid-2">
      <div class="card">
        <div class="card-header"><span class="card-title">Currently Borrowed</span></div>
        <div class="card-body" style="padding:0;">
          ${active.length ? `<div class="table-wrap"><table>
            <thead><tr><th>Book</th><th>Due Date</th><th>Status</th></tr></thead>
            <tbody>
              ${active.map(i=>{
                const bk=getBookById(i.bookId);
                return `<tr>
                  <td style="font-size:13px;font-weight:500;">${bk?.title||'—'}</td>
                  <td style="font-size:12px;color:${i.status==='overdue'?'var(--danger)':'var(--text-muted)'};">${fmtDate(i.dueDate)}</td>
                  <td>${badge(i.status)}</td>
                </tr>`;
              }).join('')}
            </tbody>
          </table></div>` : `<div class="table-empty">No active loans.<br><a href="#" onclick="navigate('m-browse')" style="color:var(--primary-light);">Browse books →</a></div>`}
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Quick Actions</span></div>
        <div class="card-body">
          <div class="quick-actions">
            <button class="btn btn-primary btn-full" onclick="navigate('m-browse')"><i class="fa fa-search"></i> Browse & Reserve Books</button>
            <button class="btn btn-ghost btn-full"   onclick="navigate('m-loans')"><i class="fa fa-book-open"></i> My Borrowing History</button>
            <button class="btn btn-ghost btn-full"   onclick="navigate('m-reservations')"><i class="fa fa-bookmark"></i> My Reservations</button>
            <button class="btn btn-ghost btn-full"   onclick="navigate('m-fines')"><i class="fa fa-file-invoice-dollar"></i> My Fines</button>
            <button class="btn btn-ghost btn-full"   onclick="navigate('m-digital')"><i class="fa fa-globe"></i> Digital Resources</button>
          </div>
        </div>
      </div>
    </div>
    ${overdue.length ? `<div class="alert alert-danger" style="margin-top:20px;">
      <span>⚠️</span>
      <div>You have <strong>${overdue.length}</strong> overdue book(s). Please return them to avoid further fines (₹${FINE_RATE}/day).</div>
    </div>` : ''}`;
}

/* ── MEMBER BROWSE ── */
let memberCatFilter = 0;

function vMemberBrowse() {
  syncBookCounts();
  const books = DB.get('books');
  const cats  = DB.get('categories');
  memberCatFilter = 0;

  $('#viewContent').innerHTML = `
    <div class="hero-section">
      <div class="hero-eyebrow">LIBRARY CATALOGUE</div>
      <h1 class="hero-title">Find Your Next Read</h1>
      <p class="hero-sub">Browse ${books.length} titles across ${cats.length} subject areas</p>
      <div class="hero-search">
        <input class="form-control" id="browseSearch" placeholder="Title, author or ISBN…" oninput="filterBrowse()">
        <button class="btn btn-gold" onclick="filterBrowse()"><i class="fa fa-search"></i></button>
      </div>
    </div>

    <div class="flex-center mb-20" style="flex-wrap:wrap;gap:8px;">
      <button class="btn btn-ghost btn-sm" onclick="setBrowseCat(0)">All</button>
      ${cats.map(c=>`<button class="btn btn-ghost btn-sm" data-cid="${c.id}" onclick="setBrowseCat(${c.id})">${c.icon} ${c.name}</button>`).join('')}
    </div>

    <div class="book-grid" id="browseGrid">
      ${books.map((b,i)=>{
        const cat = getCategoryById(b.categoryId);
        const avail = b.availableCopies||0;
        return `<div class="book-card" data-t="${b.title.toLowerCase()}" data-a="${b.author.toLowerCase()}" data-isbn="${b.isbn}" data-cid="${b.categoryId}">
          <div class="book-cover cover-${(i%8)+1}">📖</div>
          <div class="book-card-body">
            <div class="book-card-title">${escHtml(b.title)}</div>
            <div class="book-card-auth">${escHtml(b.author)}</div>
            <div style="font-size:10.5px;color:var(--text-faint);margin-bottom:10px;">${cat?cat.icon+' '+cat.name:''} · ${b.edition} Ed · ${b.year}</div>
            <div class="book-card-meta">
              <span style="font-size:11.5px;color:${avail>0?'var(--success)':'var(--danger)'};">
                ${avail>0?`✅ ${avail} avail.`:'❌ None available'}
              </span>
              <button class="btn btn-primary btn-sm" onclick="memberReserve(${b.id})">
                ${avail>0?'Reserve':'Join Queue'}
              </button>
            </div>
          </div>
        </div>`;
      }).join('')}
    </div>`;
}

function filterBrowse() {
  const term = ($('#browseSearch')?.value||'').toLowerCase();
  document.querySelectorAll('#browseGrid .book-card').forEach(card => {
    const matchTerm = !term || card.dataset.t.includes(term)||card.dataset.a.includes(term)||card.dataset.isbn.includes(term);
    const matchCat  = !memberCatFilter || card.dataset.cid==memberCatFilter;
    card.style.display = (matchTerm && matchCat) ? '' : 'none';
  });
}

function setBrowseCat(catId) {
  memberCatFilter = catId;
  filterBrowse();
}

function memberReserve(bookId) {
  const uid  = currentUser.id;
  const book = getBookById(bookId);
  const mem  = getMemberById(uid);

  if (!mem || mem.status === 'suspended') { toast('Your account is suspended. Contact the library.', 'error'); return; }

  const existRes = DB.get('reservations').find(r=>r.bookId==bookId&&r.memberId==uid&&(r.status==='pending'||r.status==='ready'));
  if (existRes) { toast('You already have a reservation for this book', 'error'); return; }

  const existIssue = DB.get('issues').find(i=>i.bookId==bookId&&i.memberId==uid&&(i.status==='active'||i.status==='overdue'));
  if (existIssue) { toast('You already have this book borrowed', 'error'); return; }

  const copies = DB.get('copies');
  const avail  = copies.find(c=>c.bookId==bookId&&c.status==='available');
  const reservations = DB.get('reservations');
  const queuePos = reservations.filter(r=>r.bookId==bookId&&r.status==='pending').length + 1;

  reservations.push({
    id: nextId('reservations'), bookId, memberId: uid,
    reservedAt: today(), queuePosition: queuePos,
    status: avail ? 'ready' : 'pending',
    copyId: avail ? avail.id : null
  });
  DB.set('reservations', reservations);

  if (avail) {
    copies.find(c=>c.id==avail.id).status = 'reserved';
    DB.set('copies', copies);
    syncBookCounts();
    toast(`"${book.title}" reserved! Visit the library to collect.`, 'success');
  } else {
    toast(`Added to queue (#${queuePos}) for "${book.title}"`, 'info');
  }
  vMemberBrowse();
}

/* ── MEMBER LOANS ── */
function vMemberLoans() {
  updateIssueStatuses();
  const uid    = currentUser.id;
  const issues = DB.get('issues').filter(i=>i.memberId==uid);

  $('#viewContent').innerHTML = `
    <div class="card">
      <div class="card-header">
        <span class="card-title">Borrowing History</span>
        <span style="font-size:13px;color:var(--text-muted);">${issues.length} total</span>
      </div>
      <div class="card-body" style="padding:0;">
        <div class="table-wrap"><table>
          <thead><tr><th>Book</th><th>Issue Date</th><th>Due Date</th><th>Return Date</th><th>Status</th><th>Fine</th></tr></thead>
          <tbody>
            ${issues.length ? issues.map(i=>{
              const bk   = getBookById(i.bookId);
              const fine = (i.status==='overdue') ? calcFine(i.dueDate,null)
                         : (i.status==='returned'&&i.returnDate>i.dueDate) ? calcFine(i.dueDate,i.returnDate) : 0;
              return `<tr>
                <td style="font-size:13px;font-weight:500;">${bk?.title||'—'}</td>
                <td style="font-size:12px;">${fmtDate(i.issueDate)}</td>
                <td style="font-size:12px;color:${i.status==='overdue'?'var(--danger)':'inherit'};">${fmtDate(i.dueDate)}</td>
                <td style="font-size:12px;">${fmtDate(i.returnDate)}</td>
                <td>${badge(i.status)}</td>
                <td style="font-weight:700;color:${fine>0?'var(--danger)':'var(--text-muted)'};">${fine>0?'₹'+fine:'—'}</td>
              </tr>`;
            }).join('') : `<tr><td colspan="6" class="table-empty">No history yet. <a href="#" onclick="navigate('m-browse')" style="color:var(--primary-light);">Browse books →</a></td></tr>`}
          </tbody>
        </table></div>
      </div>
    </div>`;
}

/* ── MEMBER RESERVATIONS ── */
function vMemberReservations() {
  const uid  = currentUser.id;
  const res  = DB.get('reservations').filter(r=>r.memberId==uid);

  $('#viewContent').innerHTML = `
    <div class="card">
      <div class="card-header">
        <span class="card-title">My Reservations</span>
        <span style="font-size:13px;color:var(--text-muted);">${res.filter(r=>r.status==='pending'||r.status==='ready').length} active</span>
      </div>
      <div class="card-body" style="padding:0;">
        <div class="table-wrap"><table>
          <thead><tr><th>Book</th><th>Reserved On</th><th style="text-align:center">Queue #</th><th>Status</th><th>Action</th></tr></thead>
          <tbody>
            ${res.length ? res.map(r=>{
              const bk = getBookById(r.bookId);
              return `<tr>
                <td style="font-size:13px;font-weight:500;">${bk?.title||'—'}</td>
                <td style="font-size:12px;">${fmtDate(r.reservedAt)}</td>
                <td style="text-align:center;font-weight:700;color:var(--primary-light);">#${r.queuePosition}</td>
                <td>${badge(r.status)}</td>
                <td>${(r.status==='pending'||r.status==='ready')?`<button class="btn btn-danger btn-sm" onclick="memberCancelRes(${r.id})"><i class="fa fa-times"></i> Cancel</button>`:'—'}</td>
              </tr>`;
            }).join('') : `<tr><td colspan="5" class="table-empty">No reservations. <a href="#" onclick="navigate('m-browse')" style="color:var(--primary-light);">Browse books →</a></td></tr>`}
          </tbody>
        </table></div>
      </div>
    </div>
    ${res.find(r=>r.status==='ready') ? `<div class="alert alert-warning" style="margin-top:16px;">
      <span>🔔</span><div>A reserved book is ready for collection! Visit the library counter with your member ID.</div>
    </div>` : ''}`;
}

function memberCancelRes(resId) {
  if (!confirm('Cancel this reservation?')) return;
  const reservations = DB.get('reservations');
  const idx = reservations.findIndex(r=>r.id==resId); if (idx<0) return;
  const res = reservations[idx];
  if (res.copyId) {
    const copies = DB.get('copies');
    const ci = copies.findIndex(c=>c.id==res.copyId);
    if (ci>=0&&copies[ci].status==='reserved') copies[ci].status='available';
    DB.set('copies', copies);
    syncBookCounts();
  }
  reservations[idx].status = 'cancelled';
  DB.set('reservations', reservations);
  toast('Reservation cancelled', 'info');
  vMemberReservations();
}

/* ── MEMBER FINES ── */
function vMemberFines() {
  const uid   = currentUser.id;
  const fines = DB.get('fines').filter(f=>f.memberId==uid);
  const unpaid= fines.filter(f=>!f.paid).reduce((s,f)=>s+f.amount,0);
  const paid  = fines.filter(f=>f.paid).reduce((s,f)=>s+f.amount,0);

  $('#viewContent').innerHTML = `
    <div class="stats-grid mb-24" style="grid-template-columns:repeat(3,1fr);">
      ${sc('💳','₹'+unpaid,'Outstanding','c-red')}
      ${sc('✅','₹'+paid,'Paid','c-green')}
      ${sc('📊',fines.length,'Total Fines','c-purple')}
    </div>
    ${unpaid>0?`<div class="alert alert-danger mb-20">
      <span>⚠️</span>
      <div>You have <strong>₹${unpaid}</strong> in outstanding fines. Visit the library counter to pay. Fine rate: ₹${FINE_RATE}/day overdue.</div>
    </div>`:''}
    <div class="card">
      <div class="card-header"><span class="card-title">My Fines</span></div>
      <div class="card-body" style="padding:0;"><div class="table-wrap"><table>
        <thead><tr><th>Book</th><th>Amount</th><th>Reason</th><th>Status</th><th>Paid On</th></tr></thead>
        <tbody>
          ${fines.length ? fines.map(f=>{
            const issue = DB.get('issues').find(i=>i.id==f.issueId);
            const bk    = issue ? getBookById(issue.bookId) : null;
            return `<tr>
              <td style="font-size:13px;">${bk?.title||'—'}</td>
              <td style="font-weight:700;color:${f.paid?'var(--success)':'var(--danger)'};">₹${f.amount}</td>
              <td style="font-size:12px;color:var(--text-muted);">${f.reason}</td>
              <td>${badge(f.paid?'paid':'unpaid')}</td>
              <td style="font-size:12px;">${f.paidAt?fmtDate(f.paidAt):'—'}</td>
            </tr>`;
          }).join('') : `<tr><td colspan="5" class="table-empty">No fines 🎉 Keep returning books on time!</td></tr>`}
        </tbody>
      </table></div></div>
    </div>`;
}

/* ── MEMBER DIGITAL ── */
function vMemberDigital() {
  const resources = DB.get('digitalResources');
  $('#viewContent').innerHTML = `
    <div style="margin-bottom:22px;">
      <h2 style="font-size:20px;font-weight:700;margin-bottom:6px;">Digital Library Resources</h2>
      <p style="color:var(--text-muted);font-size:14px;">Access online databases, e-books, journals and video courses</p>
    </div>
    <div style="display:grid;gap:14px;">
      ${resources.map(r=>`
        <div class="resource-card">
          <div class="resource-icon">${r.icon}</div>
          <div style="flex:1;">
            <div class="resource-title">${escHtml(r.title)}</div>
            <div class="resource-desc">${escHtml(r.desc)}</div>
            <span class="cat-tag">${r.category}</span>
          </div>
          <button class="btn btn-primary btn-sm" onclick="accessResource(${r.id})">
            <i class="fa fa-external-link-alt"></i> Access
          </button>
        </div>
      `).join('') || `<div class="card"><div class="card-body table-empty">No resources available.</div></div>`}
    </div>`;
}

function accessResource(resourceId) {
  const logs = DB.get('accessLogs');
  logs.push({ id:nextId('logs'), resourceId, memberId:currentUser.id, accessedAt:new Date().toISOString() });
  DB.set('accessLogs', logs);
  const r = DB.get('digitalResources').find(x=>x.id==resourceId);
  toast(`Accessing "${r?.title}"…`, 'info');
  if (r?.url && r.url !== '#') window.open(r.url, '_blank');
}

/* ── MEMBER PROFILE ── */
function vMemberProfile() {
  const user   = currentUser;
  const member = getMemberById(user.id)||{};
  const issues = DB.get('issues').filter(i=>i.memberId==user.id);
  const initials = user.name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();

  $('#viewContent').innerHTML = `
    <div class="grid-2">
      <div class="card">
        <div class="card-header"><span class="card-title">Profile Details</span></div>
        <div class="card-body">
          <div class="profile-header">
            <div class="profile-avatar">${initials}</div>
            <div>
              <div style="font-size:20px;font-weight:700;">${escHtml(user.name)}</div>
              <div style="color:var(--text-muted);font-size:13px;margin-top:3px;">${user.email}</div>
              <div style="margin-top:8px;">${badge(member.status||'active')}</div>
            </div>
          </div>
          <div class="info-row"><div class="info-label">Member Code</div><div class="info-value" style="font-family:monospace;">${member.memberId||'—'}</div></div>
          <div class="info-row"><div class="info-label">Department</div><div class="info-value" id="profDept">${member.department||'—'}</div></div>
          <div class="info-row"><div class="info-label">Phone</div><div class="info-value" id="profPhone">${member.phone||'—'}</div></div>
          <div class="info-row"><div class="info-label">Member Since</div><div class="info-value">${fmtDate(user.createdAt)}</div></div>
          <button class="btn btn-primary btn-full" style="margin-top:16px;" onclick="openEditProfileModal()">
            <i class="fa fa-edit"></i> Edit Profile
          </button>
        </div>
      </div>
      <div class="card">
        <div class="card-header"><span class="card-title">Activity Summary</span></div>
        <div class="card-body">
          <div style="display:grid;gap:12px;">
            ${sc('📚',issues.length,'Books Borrowed','c-gold')}
            ${sc('✅',issues.filter(i=>i.status==='returned').length,'Returned','c-green')}
            ${sc('⏰',issues.filter(i=>i.status==='overdue').length,'Overdue','c-red')}
            ${sc('🔖',DB.get('reservations').filter(r=>r.memberId==user.id).length,'Reservations','c-purple')}
          </div>
        </div>
      </div>
    </div>`;
}

function openEditProfileModal() {
  const member = getMemberById(currentUser.id)||{};
  openModal('Edit Profile', `
    <div class="form-group"><label class="form-label">Full Name</label><input class="form-control" id="epName" value="${escHtml(currentUser.name)}"></div>
    <div class="form-group"><label class="form-label">Department</label><input class="form-control" id="epDept" value="${escHtml(member.department||'')}"></div>
    <div class="form-group"><label class="form-label">Phone</label><input class="form-control" id="epPhone" value="${escHtml(member.phone||'')}"></div>`,
  `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
   <button class="btn btn-primary" onclick="saveProfile()">Save Changes</button>`);
}

function saveProfile() {
  const name  = $('#epName').value.trim();
  const dept  = $('#epDept').value.trim();
  const phone = $('#epPhone').value.trim();
  if (!name) { toast('Name cannot be empty', 'error'); return; }

  const users = DB.get('users');
  const ui    = users.findIndex(u=>u.id==currentUser.id);
  if (ui>=0) { users[ui].name = name; DB.set('users', users); }

  const members = DB.get('members');
  const mi = members.findIndex(m=>m.id==currentUser.id);
  if (mi>=0) { members[mi].department=dept; members[mi].phone=phone; DB.set('members', members); }

  currentUser.name = name;
  Session.set(currentUser);

  const ini = name.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase();
  $('#sidebarName').textContent    = name;
  $('#sidebarAvatar').textContent  = ini;

  closeModal(); toast('Profile updated', 'success'); vMemberProfile();
}

/* ─────────────────────────────────────────────────────────
   AUTH TAB SWITCH
   ───────────────────────────────────────────────────────── */
function switchAuthTab(tab) {
  $('#loginForm').style.display    = tab==='login'    ? 'block' : 'none';
  $('#registerForm').style.display = tab==='register' ? 'block' : 'none';
  $('#tabLogin').classList.toggle('active',    tab==='login');
  $('#tabRegister').classList.toggle('active', tab==='register');
}

/* ─────────────────────────────────────────────────────────
   HELPERS
   ───────────────────────────────────────────────────────── */
function escHtml(str) {
  if (!str) return '';
  return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

/* ─────────────────────────────────────────────────────────
   INIT
   ───────────────────────────────────────────────────────── */
document.addEventListener('DOMContentLoaded', () => {
  initSeedData();
  updateIssueStatuses();

  /* Topbar date */
  $('#topbarDate').textContent = new Date().toLocaleDateString('en-IN', {
    weekday:'long', year:'numeric', month:'long', day:'numeric'
  });

  /* Enter key login */
  document.getElementById('loginPassword')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleLogin();
  });
  document.getElementById('loginEmail')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') handleLogin();
  });

  /* Restore session */
  const sess = Session.get();
  if (sess) { currentUser = sess; bootApp(sess); }
});
