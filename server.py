# ============================================================
#  LibraryOS — Flask REST API Backend
#  Serves the frontend at / and the API at /api/*
# ============================================================

from flask import Flask, request, jsonify, session, send_from_directory
from flask_cors import CORS
import mysql.connector
from mysql.connector import Error
from werkzeug.security import generate_password_hash, check_password_hash
from datetime import date, timedelta
from functools import wraps
import os, config

app = Flask(__name__, static_folder='.', static_url_path='')
app.secret_key       = config.SECRET_KEY
app.config['SESSION_COOKIE_SAMESITE'] = 'Lax'
CORS(app, supports_credentials=True)

FINE_RATE       = 2      # ₹ per overdue day
MAX_LOANS       = 3
LOAN_DAYS       = 14
STARTING_WALLET = 1000.0

# ── DB helpers ────────────────────────────────────────────────

def get_db():
    return mysql.connector.connect(
        host     = config.DB_HOST,
        user     = config.DB_USER,
        password = config.DB_PASS,
        database = config.DB_NAME,
        charset  = 'utf8mb4'
    )

def q(sql, params=None, fetch=True, many=False):
    """Run a query. fetch=False for INSERT/UPDATE/DELETE (returns lastrowid)."""
    conn = get_db()
    cur  = conn.cursor(dictionary=True)
    try:
        cur.execute(sql, params or ())
        if fetch:
            return cur.fetchall() if many else cur.fetchone()
        conn.commit()
        return cur.lastrowid
    finally:
        cur.close(); conn.close()

def serialize(obj):
    """Make dates JSON-serialisable."""
    if isinstance(obj, (date,)):
        return obj.isoformat()
    return obj

def clean(rows):
    """Stringify date fields in a list of dicts."""
    for r in rows:
        for k, v in r.items():
            if isinstance(v, (date,)):
                r[k] = v.isoformat()
    return rows

# ── Auth decorators ───────────────────────────────────────────

def login_required(f):
    @wraps(f)
    def dec(*a, **kw):
        if 'uid' not in session:
            return jsonify({'error': 'Login required'}), 401
        return f(*a, **kw)
    return dec

def admin_required(f):
    @wraps(f)
    def dec(*a, **kw):
        if session.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        return f(*a, **kw)
    return dec

# ── Serve frontend ────────────────────────────────────────────

@app.route('/')
def index():
    return send_from_directory('.', 'index.html')

# ═══════════════════════════════════════════════════════════════
#  AUTH
# ═══════════════════════════════════════════════════════════════

@app.route('/api/login', methods=['POST'])
def login():
    d    = request.json or {}
    user = q("SELECT * FROM users WHERE email=%s", (d.get('email',''),))
    if not user or not check_password_hash(user['password_hash'], d.get('password','')):
        return jsonify({'error': 'Invalid email or password'}), 401
    session['uid']  = user['user_id']
    session['role'] = user['role']
    session['name'] = user['full_name']
    return jsonify({'id': user['user_id'], 'name': user['full_name'],
                    'email': user['email'], 'role': user['role']})

@app.route('/api/register', methods=['POST'])
def register():
    d        = request.json or {}
    name     = d.get('name','').strip()
    email    = d.get('email','').strip()
    code     = d.get('memberCode','').strip()
    password = d.get('password','')

    if not all([name, email, code, password]):
        return jsonify({'error': 'All fields are required'}), 400
    if len(password) < 8:
        return jsonify({'error': 'Password must be at least 8 characters'}), 400
    if q("SELECT 1 FROM users   WHERE email=%s",       (email,)):
        return jsonify({'error': 'Email already registered'}), 409
    if q("SELECT 1 FROM members WHERE member_code=%s", (code,)):
        return jsonify({'error': 'Member code already in use'}), 409

    pw_hash = generate_password_hash(password)
    conn = get_db(); cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO users (full_name, email, password_hash, role) VALUES (%s,%s,%s,'member')",
            (name, email, pw_hash))
        uid = cur.lastrowid
        cur.execute(
            "INSERT INTO members (user_id, member_code, wallet_balance) VALUES (%s,%s,%s)",
            (uid, code, STARTING_WALLET))
        conn.commit()
        session['uid'] = uid; session['role'] = 'member'; session['name'] = name
        return jsonify({'id': uid, 'name': name, 'email': email, 'role': 'member'}), 201
    except Error as e:
        conn.rollback(); return jsonify({'error': str(e)}), 500
    finally:
        cur.close(); conn.close()

@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'ok': True})

@app.route('/api/me')
@login_required
def me():
    user = q("SELECT user_id,full_name,email,role FROM users WHERE user_id=%s", (session['uid'],))
    if user: user['created_at'] = ''
    return jsonify(user)

# ═══════════════════════════════════════════════════════════════
#  METADATA
# ═══════════════════════════════════════════════════════════════

@app.route('/api/categories')
def categories():
    return jsonify(q("SELECT * FROM categories ORDER BY category_name", many=True))

@app.route('/api/publishers')
def publishers():
    return jsonify(q("SELECT * FROM publishers ORDER BY publisher_name", many=True))

# ═══════════════════════════════════════════════════════════════
#  BOOKS
# ═══════════════════════════════════════════════════════════════

@app.route('/api/books')
def books():
    term   = request.args.get('q', '')
    cat_id = request.args.get('category_id', '')
    like   = f'%{term}%'
    rows = q("""
        SELECT b.*, c.category_name, c.icon as cat_icon,
               COUNT(CASE WHEN cp.status='available' THEN 1 END) AS available_copies,
               COUNT(cp.copy_id) AS total_copies
        FROM books b
        LEFT JOIN categories c  ON b.category_id   = c.category_id
        LEFT JOIN copies     cp ON b.book_id        = cp.book_id
        WHERE (%s='' OR b.title LIKE %s OR b.author LIKE %s OR b.isbn LIKE %s)
          AND (%s='' OR b.category_id=%s)
        GROUP BY b.book_id
        ORDER BY b.title
    """, (term, like, like, like, cat_id, cat_id), many=True)
    return jsonify(clean(rows))

@app.route('/api/books', methods=['POST'])
@login_required
@admin_required
def add_book():
    d     = request.json or {}
    title = d.get('title','').strip()
    isbn  = d.get('isbn','').strip()
    author= d.get('author','').strip()
    acc   = d.get('accessionNo','').strip()
    if not all([title, isbn, author, acc]):
        return jsonify({'error': 'Title, ISBN, author and accession number are required'}), 400
    if q("SELECT 1 FROM books  WHERE isbn=%s",        (isbn,)):
        return jsonify({'error': 'ISBN already exists'}), 409
    if q("SELECT 1 FROM copies WHERE accession_no=%s",(acc,)):
        return jsonify({'error': 'Accession number already in use'}), 409

    conn = get_db(); cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO books (title,isbn,author,year,edition,category_id,publisher_id,link) VALUES (%s,%s,%s,%s,%s,%s,%s,%s)",
            (title, isbn, author, d.get('year', date.today().year),
             d.get('edition','1st'), d.get('categoryId') or None,
             d.get('publisherId') or None, d.get('link','')))
        book_id = cur.lastrowid
        cur.execute("INSERT INTO copies (book_id, accession_no) VALUES (%s,%s)", (book_id, acc))
        conn.commit()
        return jsonify({'book_id': book_id}), 201
    except Error as e:
        conn.rollback(); return jsonify({'error': str(e)}), 500
    finally:
        cur.close(); conn.close()

@app.route('/api/books/<int:bid>', methods=['PUT'])
@login_required
@admin_required
def edit_book(bid):
    d = request.json or {}
    q("UPDATE books SET title=%s,author=%s,edition=%s,year=%s,category_id=%s WHERE book_id=%s",
      (d.get('title'), d.get('author'), d.get('edition'), d.get('year'),
       d.get('categoryId') or None, bid), fetch=False)
    return jsonify({'ok': True})

@app.route('/api/books/<int:bid>', methods=['DELETE'])
@login_required
@admin_required
def delete_book(bid):
    if q("SELECT 1 FROM copies WHERE book_id=%s AND status IN ('issued','reserved') LIMIT 1", (bid,)):
        return jsonify({'error': 'Cannot delete: active issues or reservations exist'}), 400
    conn = get_db(); cur = conn.cursor()
    try:
        cur.execute("DELETE FROM copies WHERE book_id=%s", (bid,))
        cur.execute("DELETE FROM books  WHERE book_id=%s", (bid,))
        conn.commit()
        return jsonify({'ok': True})
    finally:
        cur.close(); conn.close()

@app.route('/api/books/<int:bid>/copies')
@login_required
def book_copies(bid):
    return jsonify(q("SELECT * FROM copies WHERE book_id=%s ORDER BY accession_no", (bid,), many=True))

@app.route('/api/copies', methods=['POST'])
@login_required
@admin_required
def add_copy():
    d = request.json or {}
    acc = d.get('accessionNo','').strip(); bid = d.get('bookId')
    if not acc or not bid: return jsonify({'error': 'Missing fields'}), 400
    if q("SELECT 1 FROM copies WHERE accession_no=%s", (acc,)):
        return jsonify({'error': 'Accession number in use'}), 409
    q("INSERT INTO copies (book_id, accession_no) VALUES (%s,%s)", (bid, acc), fetch=False)
    return jsonify({'ok': True}), 201

@app.route('/api/copies/<int:cid>', methods=['DELETE'])
@login_required
@admin_required
def delete_copy(cid):
    cp = q("SELECT status FROM copies WHERE copy_id=%s", (cid,))
    if not cp or cp['status'] != 'available':
        return jsonify({'error': 'Can only delete available copies'}), 400
    q("DELETE FROM copies WHERE copy_id=%s", (cid,), fetch=False)
    return jsonify({'ok': True})

# ═══════════════════════════════════════════════════════════════
#  MEMBERS
# ═══════════════════════════════════════════════════════════════

@app.route('/api/members')
@login_required
@admin_required
def members():
    rows = q("""
        SELECT u.user_id, u.full_name, u.email, u.created_at,
               m.member_code, m.membership_status, m.phone, m.department, m.wallet_balance,
               COUNT(CASE WHEN i.status IN ('active','overdue') THEN 1 END) AS active_loans
        FROM users   u
        JOIN members m ON u.user_id = m.user_id
        LEFT JOIN issues i ON u.user_id = i.member_id
        WHERE u.role = 'member'
        GROUP BY u.user_id
        ORDER BY u.full_name
    """, many=True)
    return jsonify(clean(rows))

@app.route('/api/members/<int:uid>/status', methods=['PUT'])
@login_required
@admin_required
def toggle_member(uid):
    cur = q("SELECT membership_status FROM members WHERE user_id=%s", (uid,))
    if not cur: return jsonify({'error': 'Member not found'}), 404
    nxt = 'suspended' if cur['membership_status'] == 'active' else 'active'
    q("UPDATE members SET membership_status=%s WHERE user_id=%s", (nxt, uid), fetch=False)
    return jsonify({'status': nxt})

@app.route('/api/members/<int:uid>/history')
@login_required
def member_history(uid):
    if session.get('role') != 'admin' and session.get('uid') != uid:
        return jsonify({'error': 'Forbidden'}), 403
    rows = q("""
        SELECT i.*, b.title, b.isbn, cp.accession_no
        FROM issues i
        JOIN books  b  ON i.book_id  = b.book_id
        JOIN copies cp ON i.copy_id  = cp.copy_id
        WHERE i.member_id = %s
        ORDER BY i.issue_date DESC
    """, (uid,), many=True)
    return jsonify(clean(rows))

@app.route('/api/members/<int:uid>/profile', methods=['PUT'])
@login_required
def update_profile(uid):
    if session.get('uid') != uid and session.get('role') != 'admin':
        return jsonify({'error': 'Forbidden'}), 403
    d = request.json or {}
    if d.get('name'):
        q("UPDATE users   SET full_name=%s  WHERE user_id=%s", (d['name'], uid), fetch=False)
        if session.get('uid') == uid: session['name'] = d['name']
    if 'department' in d:
        q("UPDATE members SET department=%s WHERE user_id=%s", (d['department'], uid), fetch=False)
    if 'phone' in d:
        q("UPDATE members SET phone=%s      WHERE user_id=%s", (d['phone'], uid), fetch=False)
    return jsonify({'ok': True})

@app.route('/api/members/<int:uid>')
@login_required
def get_member(uid):
    if session.get('uid') != uid and session.get('role') != 'admin':
        return jsonify({'error': 'Forbidden'}), 403
    user = q("""
        SELECT u.user_id, u.full_name, u.email, u.role, u.created_at,
               m.member_code, m.membership_status, m.phone, m.department, m.wallet_balance
        FROM users u JOIN members m ON u.user_id = m.user_id
        WHERE u.user_id = %s
    """, (uid,))
    if not user: return jsonify({'error': 'Not found'}), 404
    return jsonify(clean([user])[0])

# ═══════════════════════════════════════════════════════════════
#  ISSUES & RETURNS
# ═══════════════════════════════════════════════════════════════

def mark_overdue():
    q("UPDATE issues SET status='overdue' WHERE status='active' AND due_date < CURDATE()", fetch=False)

@app.route('/api/issues')
@login_required
def issues():
    mark_overdue()
    uid = session['uid']; role = session.get('role')
    if role == 'admin':
        rows = q("""
            SELECT i.*, b.title, b.isbn, cp.accession_no,
                   u.full_name, m.member_code
            FROM issues i
            JOIN books   b  ON i.book_id  = b.book_id
            JOIN copies  cp ON i.copy_id  = cp.copy_id
            JOIN users   u  ON i.member_id = u.user_id
            JOIN members m  ON i.member_id = m.user_id
            WHERE i.status IN ('active','overdue')
            ORDER BY i.issue_date DESC
        """, many=True)
    else:
        rows = q("""
            SELECT i.*, b.title, b.isbn, cp.accession_no
            FROM issues i
            JOIN books  b  ON i.book_id = b.book_id
            JOIN copies cp ON i.copy_id = cp.copy_id
            WHERE i.member_id = %s
            ORDER BY i.issue_date DESC
        """, (uid,), many=True)
    return jsonify(clean(rows))

@app.route('/api/issues', methods=['POST'])
@login_required
@admin_required
def issue_book():
    mark_overdue()
    d = request.json or {}
    mem_id  = d.get('memberId');  copy_id = d.get('copyId')
    iss_dt  = d.get('issueDate'); due_dt  = d.get('dueDate')
    if not all([mem_id, copy_id, iss_dt, due_dt]):
        return jsonify({'error': 'All fields are required'}), 400
    if iss_dt >= due_dt:
        return jsonify({'error': 'Due date must be after issue date'}), 400

    mem = q("SELECT membership_status FROM members WHERE user_id=%s", (mem_id,))
    if not mem or mem['membership_status'] == 'suspended':
        return jsonify({'error': 'Member is suspended — cannot borrow'}), 400

    active = q("SELECT COUNT(*) AS c FROM issues WHERE member_id=%s AND status IN ('active','overdue')",
               (mem_id,))['c']
    if active >= MAX_LOANS:
        return jsonify({'error': f'Member already has {MAX_LOANS} active loans (maximum)'}), 400

    cp = q("SELECT * FROM copies WHERE copy_id=%s", (copy_id,))
    if not cp or cp['status'] != 'available':
        return jsonify({'error': 'Copy is not available'}), 400

    conn = get_db(); cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO issues (copy_id,book_id,member_id,issue_date,due_date) VALUES (%s,%s,%s,%s,%s)",
            (copy_id, cp['book_id'], mem_id, iss_dt, due_dt))
        cur.execute("UPDATE copies SET status='issued' WHERE copy_id=%s", (copy_id,))
        conn.commit()
        return jsonify({'issue_id': cur.lastrowid}), 201
    except Error as e:
        conn.rollback(); return jsonify({'error': str(e)}), 500
    finally:
        cur.close(); conn.close()

@app.route('/api/issues/<int:iid>/return', methods=['PUT'])
@login_required
@admin_required
def return_book(iid):
    d = request.json or {}; ret_dt = d.get('returnDate')
    if not ret_dt: return jsonify({'error': 'Return date required'}), 400

    issue = q("SELECT * FROM issues WHERE issue_id=%s", (iid,))
    if not issue: return jsonify({'error': 'Issue not found'}), 404
    if issue['status'] == 'returned': return jsonify({'error': 'Already returned'}), 400

    iss_str = issue['issue_date'].isoformat() if not isinstance(issue['issue_date'], str) else issue['issue_date']
    due_str = issue['due_date'].isoformat() if not isinstance(issue['due_date'], str) else issue['due_date']
    if ret_dt < iss_str: return jsonify({'error': 'Return date before issue date'}), 400

    from datetime import datetime
    due_d = datetime.strptime(due_str, '%Y-%m-%d')
    ret_d = datetime.strptime(ret_dt, '%Y-%m-%d')
    fine  = max(0, (ret_d - due_d).days * FINE_RATE)

    conn = get_db(); cur = conn.cursor()
    try:
        cur.execute("UPDATE issues SET return_date=%s, status='returned' WHERE issue_id=%s", (ret_dt, iid))
        cur.execute("UPDATE copies SET status='available' WHERE copy_id=%s", (issue['copy_id'],))
        fine_id = None
        if fine > 0:
            cur.execute(
                "INSERT INTO fines (issue_id,member_id,amount,reason) VALUES (%s,%s,%s,'Overdue return')",
                (iid, issue['member_id'], fine))
            fine_id = cur.lastrowid
        conn.commit()
        _fulfill_next_reservation(issue['book_id'])
        return jsonify({'fine': fine, 'fine_id': fine_id})
    except Error as e:
        conn.rollback(); return jsonify({'error': str(e)}), 500
    finally:
        cur.close(); conn.close()

def _fulfill_next_reservation(book_id):
    nxt  = q("SELECT * FROM reservations WHERE book_id=%s AND status='pending' ORDER BY queue_position LIMIT 1", (book_id,))
    if not nxt: return
    avail = q("SELECT copy_id FROM copies WHERE book_id=%s AND status='available' LIMIT 1", (book_id,))
    if not avail: return
    conn = get_db(); cur = conn.cursor()
    try:
        cur.execute("UPDATE copies       SET status='reserved' WHERE copy_id=%s",         (avail['copy_id'],))
        cur.execute("UPDATE reservations SET status='ready', copy_id=%s WHERE reservation_id=%s",
                    (avail['copy_id'], nxt['reservation_id']))
        conn.commit()
    finally:
        cur.close(); conn.close()

# ═══════════════════════════════════════════════════════════════
#  RESERVATIONS
# ═══════════════════════════════════════════════════════════════

@app.route('/api/reservations')
@login_required
def reservations():
    uid = session['uid']; role = session.get('role')
    if role == 'admin':
        rows = q("""
            SELECT r.*, b.title, b.isbn, u.full_name, m.member_code
            FROM reservations r
            JOIN books   b  ON r.book_id   = b.book_id
            JOIN users   u  ON r.member_id = u.user_id
            JOIN members m  ON r.member_id = m.user_id
            ORDER BY r.reserved_at DESC
        """, many=True)
    else:
        rows = q("""
            SELECT r.*, b.title, b.isbn
            FROM reservations r
            JOIN books b ON r.book_id = b.book_id
            WHERE r.member_id = %s
            ORDER BY r.reserved_at DESC
        """, (uid,), many=True)
    return jsonify(clean(rows))

@app.route('/api/reservations', methods=['POST'])
@login_required
def reserve():
    uid = session['uid']; d = request.json or {}; book_id = d.get('bookId')
    if not book_id: return jsonify({'error': 'Book ID required'}), 400

    mem = q("SELECT membership_status FROM members WHERE user_id=%s", (uid,))
    if not mem or mem['membership_status'] == 'suspended':
        return jsonify({'error': 'Account is suspended'}), 400
    if q("SELECT 1 FROM reservations WHERE book_id=%s AND member_id=%s AND status IN ('pending','ready')", (book_id, uid)):
        return jsonify({'error': 'Already have a reservation for this book'}), 409
    if q("SELECT 1 FROM issues i JOIN copies cp ON i.copy_id=cp.copy_id WHERE cp.book_id=%s AND i.member_id=%s AND i.status IN ('active','overdue')", (book_id, uid)):
        return jsonify({'error': 'You already have this book borrowed'}), 409

    avail     = q("SELECT copy_id FROM copies WHERE book_id=%s AND status='available' LIMIT 1", (book_id,))
    queue_pos = (q("SELECT COUNT(*) AS c FROM reservations WHERE book_id=%s AND status='pending'", (book_id,))['c']) + 1
    status    = 'ready' if avail else 'pending'
    copy_id   = avail['copy_id'] if avail else None

    conn = get_db(); cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO reservations (book_id,member_id,queue_position,status,copy_id) VALUES (%s,%s,%s,%s,%s)",
            (book_id, uid, queue_pos, status, copy_id))
        if avail:
            cur.execute("UPDATE copies SET status='reserved' WHERE copy_id=%s", (copy_id,))
        conn.commit()
        return jsonify({'status': status, 'queue_position': queue_pos}), 201
    except Error as e:
        conn.rollback(); return jsonify({'error': str(e)}), 500
    finally:
        cur.close(); conn.close()

@app.route('/api/reservations/<int:rid>/cancel', methods=['PUT'])
@login_required
def cancel_reservation(rid):
    uid = session['uid']; role = session.get('role')
    res = q("SELECT * FROM reservations WHERE reservation_id=%s", (rid,))
    if not res: return jsonify({'error': 'Not found'}), 404
    if role != 'admin' and res['member_id'] != uid:
        return jsonify({'error': 'Forbidden'}), 403
    conn = get_db(); cur = conn.cursor()
    try:
        cur.execute("UPDATE reservations SET status='cancelled' WHERE reservation_id=%s", (rid,))
        if res.get('copy_id'):
            cur.execute("UPDATE copies SET status='available' WHERE copy_id=%s AND status='reserved'", (res['copy_id'],))
        conn.commit()
        return jsonify({'ok': True})
    finally:
        cur.close(); conn.close()

@app.route('/api/reservations/<int:rid>/fulfill', methods=['PUT'])
@login_required
@admin_required
def fulfill_reservation(rid):
    res = q("SELECT * FROM reservations WHERE reservation_id=%s", (rid,))
    if not res: return jsonify({'error': 'Not found'}), 404
    if res['status'] != 'ready' or not res.get('copy_id'):
        return jsonify({'error': 'Reservation not ready'}), 400
    iss = date.today().isoformat()
    due = (date.today() + timedelta(days=LOAN_DAYS)).isoformat()
    conn = get_db(); cur = conn.cursor()
    try:
        cur.execute(
            "INSERT INTO issues (copy_id,book_id,member_id,issue_date,due_date) VALUES (%s,%s,%s,%s,%s)",
            (res['copy_id'], res['book_id'], res['member_id'], iss, due))
        cur.execute("UPDATE copies       SET status='issued'    WHERE copy_id=%s",        (res['copy_id'],))
        cur.execute("UPDATE reservations SET status='fulfilled' WHERE reservation_id=%s", (rid,))
        conn.commit()
        return jsonify({'ok': True})
    finally:
        cur.close(); conn.close()

# ═══════════════════════════════════════════════════════════════
#  FINES
# ═══════════════════════════════════════════════════════════════

@app.route('/api/fines')
@login_required
def fines():
    uid = session['uid']; role = session.get('role')
    if role == 'admin':
        rows = q("""
            SELECT f.*, u.full_name, b.title
            FROM fines f
            JOIN users  u  ON f.member_id = u.user_id
            JOIN issues i  ON f.issue_id  = i.issue_id
            JOIN books  b  ON i.book_id   = b.book_id
            ORDER BY f.fine_id DESC
        """, many=True)
    else:
        rows = q("""
            SELECT f.*, b.title
            FROM fines f
            JOIN issues i ON f.issue_id = i.issue_id
            JOIN books  b ON i.book_id  = b.book_id
            WHERE f.member_id = %s
            ORDER BY f.fine_id DESC
        """, (uid,), many=True)
    return jsonify(clean(rows))

@app.route('/api/fines/<int:fid>/collect', methods=['PUT'])
@login_required
@admin_required
def collect_fine(fid):
    f = q("SELECT * FROM fines WHERE fine_id=%s", (fid,))
    if not f: return jsonify({'error': 'Not found'}), 404
    if f['paid']: return jsonify({'error': 'Already paid'}), 400
    q("UPDATE fines SET paid=1, paid_at=CURDATE() WHERE fine_id=%s", (fid,), fetch=False)
    return jsonify({'ok': True})

@app.route('/api/fines/<int:fid>/pay', methods=['PUT'])
@login_required
def pay_wallet(fid):
    uid = session['uid']
    f   = q("SELECT * FROM fines WHERE fine_id=%s AND member_id=%s", (fid, uid))
    if not f: return jsonify({'error': 'Fine not found'}), 404
    if f['paid']: return jsonify({'error': 'Already paid'}), 400

    wallet = float(q("SELECT wallet_balance FROM members WHERE user_id=%s", (uid,))['wallet_balance'])
    amount = float(f['amount'])
    if wallet < amount:
        return jsonify({'error': f'Insufficient balance. You have ₹{wallet:.0f}, fine is ₹{amount:.0f}'}), 400

    conn = get_db(); cur = conn.cursor()
    try:
        cur.execute("UPDATE members SET wallet_balance=wallet_balance-%s WHERE user_id=%s", (amount, uid))
        cur.execute("UPDATE fines   SET paid=1, paid_at=CURDATE()          WHERE fine_id=%s",  (fid,))
        conn.commit()
        new_bal = float(q("SELECT wallet_balance FROM members WHERE user_id=%s", (uid,))['wallet_balance'])
        return jsonify({'ok': True, 'newBalance': new_bal})
    except Error as e:
        conn.rollback(); return jsonify({'error': str(e)}), 500
    finally:
        cur.close(); conn.close()

# ═══════════════════════════════════════════════════════════════
#  STATS & REPORTS
# ═══════════════════════════════════════════════════════════════

@app.route('/api/stats')
@login_required
def stats():
    mark_overdue()
    uid = session['uid']; role = session.get('role')
    if role == 'admin':
        return jsonify({
            'titles':       q("SELECT COUNT(*) AS c FROM books")['c'],
            'copies':       q("SELECT COUNT(*) AS c FROM copies")['c'],
            'available':    q("SELECT COUNT(*) AS c FROM copies WHERE status='available'")['c'],
            'issued':       q("SELECT COUNT(*) AS c FROM issues WHERE status IN ('active','overdue')")['c'],
            'overdue':      q("SELECT COUNT(*) AS c FROM issues WHERE status='overdue'")['c'],
            'members':      q("SELECT COUNT(*) AS c FROM members")['c'],
            'reservations': q("SELECT COUNT(*) AS c FROM reservations WHERE status='pending'")['c'],
            'unpaid_fines': float(q("SELECT COALESCE(SUM(amount),0) AS s FROM fines WHERE paid=0")['s']),
        })
    else:
        mem = q("SELECT wallet_balance FROM members WHERE user_id=%s", (uid,))
        return jsonify({
            'active_loans': q("SELECT COUNT(*) AS c FROM issues WHERE member_id=%s AND status IN ('active','overdue')", (uid,))['c'],
            'overdue':      q("SELECT COUNT(*) AS c FROM issues WHERE member_id=%s AND status='overdue'", (uid,))['c'],
            'reservations': q("SELECT COUNT(*) AS c FROM reservations WHERE member_id=%s AND status IN ('pending','ready')", (uid,))['c'],
            'unpaid_fines': float(q("SELECT COALESCE(SUM(amount),0) AS s FROM fines WHERE member_id=%s AND paid=0", (uid,))['s']),
            'wallet':       float(mem['wallet_balance']) if mem else 0,
        })

@app.route('/api/reports/overdue')
@login_required
@admin_required
def report_overdue():
    mark_overdue()
    rows = q(f"""
        SELECT i.*, b.title, u.full_name, m.member_code,
               DATEDIFF(CURDATE(), i.due_date) AS days_overdue,
               DATEDIFF(CURDATE(), i.due_date) * {FINE_RATE} AS fine_est
        FROM issues i
        JOIN books   b ON i.book_id   = b.book_id
        JOIN users   u ON i.member_id = u.user_id
        JOIN members m ON i.member_id = m.user_id
        WHERE i.status = 'overdue'
        ORDER BY days_overdue DESC
    """, many=True)
    return jsonify(clean(rows))

@app.route('/api/reports/popular')
@login_required
@admin_required
def report_popular():
    rows = q("""
        SELECT b.book_id, b.title, b.author, c.category_name, c.icon AS cat_icon,
               COUNT(i.issue_id) AS times_issued
        FROM books b
        LEFT JOIN issues     i ON b.book_id   = i.book_id
        LEFT JOIN categories c ON b.category_id = c.category_id
        GROUP BY b.book_id
        ORDER BY times_issued DESC
        LIMIT 10
    """, many=True)
    return jsonify(rows)

@app.route('/api/reports/access-logs')
@login_required
@admin_required
def report_access():
    rows = q("""
        SELECT l.*, u.full_name, r.title AS resource_title, r.icon
        FROM digital_access_logs l
        JOIN users            u ON l.member_id   = u.user_id
        JOIN digital_resources r ON l.resource_id = r.resource_id
        ORDER BY l.accessed_at DESC LIMIT 200
    """, many=True)
    return jsonify(clean(rows))

# ═══════════════════════════════════════════════════════════════
#  DIGITAL RESOURCES
# ═══════════════════════════════════════════════════════════════

@app.route('/api/digital-resources')
@login_required
def digital_resources():
    return jsonify(q("SELECT * FROM digital_resources ORDER BY title", many=True))

@app.route('/api/digital-resources', methods=['POST'])
@login_required
@admin_required
def add_resource():
    d = request.json or {}
    if not d.get('title'): return jsonify({'error': 'Title required'}), 400
    q("INSERT INTO digital_resources (title,url,category,icon,description) VALUES (%s,%s,%s,%s,%s)",
      (d['title'], d.get('url','#'), d.get('category','Database'), d.get('icon','📁'), d.get('desc','')),
      fetch=False)
    return jsonify({'ok': True}), 201

@app.route('/api/digital-resources/<int:rid>', methods=['DELETE'])
@login_required
@admin_required
def del_resource(rid):
    q("DELETE FROM digital_resources WHERE resource_id=%s", (rid,), fetch=False)
    return jsonify({'ok': True})

@app.route('/api/digital-resources/<int:rid>/access', methods=['POST'])
@login_required
def log_access(rid):
    q("INSERT INTO digital_access_logs (resource_id,member_id) VALUES (%s,%s)",
      (rid, session['uid']), fetch=False)
    return jsonify({'ok': True})

# ═══════════════════════════════════════════════════════════════
#  WALLET
# ═══════════════════════════════════════════════════════════════

@app.route('/api/wallet')
@login_required
def wallet():
    bal = q("SELECT wallet_balance FROM members WHERE user_id=%s", (session['uid'],))
    return jsonify({'balance': float(bal['wallet_balance']) if bal else 0})

# ── Run ───────────────────────────────────────────────────────

if __name__ == '__main__':
    print("\n  📚 LibraryOS backend starting…")
    print("  Open http://localhost:5000 in your browser\n")
    app.run(debug=True, port=5000)
