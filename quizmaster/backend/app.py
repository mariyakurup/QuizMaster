from flask import Flask, request, jsonify, session, send_from_directory
from flask_cors import CORS
import mysql.connector
import bcrypt
import os
from datetime import datetime, timedelta
from functools import wraps

app = Flask(__name__, static_folder='../frontend/static')
app.secret_key = 'quizmaster_secret_key_2025'
app.permanent_session_lifetime = timedelta(hours=8)
CORS(app, supports_credentials=True)

# ── DB CONFIG ──────────────────────────────────────────
DB_CONFIG = {
    'host':     'localhost',
    'user':     'root',
    'password': 'Mariy@57_75',   # ← Change to YOUR MySQL root password
    'database': 'quizmaster',
    'autocommit': True
}

def get_db():
    return mysql.connector.connect(**DB_CONFIG)

# ── AUTH DECORATORS ────────────────────────────────────
def login_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Not logged in'}), 401
        return f(*args, **kwargs)
    return decorated

def admin_required(f):
    @wraps(f)
    def decorated(*args, **kwargs):
        if 'user_id' not in session:
            return jsonify({'error': 'Not logged in'}), 401
        if session.get('role') != 'admin':
            return jsonify({'error': 'Admin access required'}), 403
        return f(*args, **kwargs)
    return decorated

# ── SERVE FRONTEND ─────────────────────────────────────
@app.route('/')
def index():
    return send_from_directory('../frontend', 'index.html')

@app.route('/<path:path>')
def static_files(path):
    return send_from_directory('../frontend', path)

# ══════════════════════════════════════════════════════
#  AUTH ROUTES
# ══════════════════════════════════════════════════════

@app.route('/api/register', methods=['POST'])
def register():
    data     = request.json
    name     = data.get('name', '').strip()
    email    = data.get('email', '').strip().lower()
    password = data.get('password', '')
    role     = data.get('role', 'student')

    if not name or not email or not password:
        return jsonify({'error': 'All fields required'}), 400
    if len(password) < 6:
        return jsonify({'error': 'Password must be at least 6 characters'}), 400

    hashed = bcrypt.hashpw(password.encode(), bcrypt.gensalt()).decode()

    try:
        db  = get_db()
        cur = db.cursor()
        cur.execute("INSERT INTO users (name, email, password, role) VALUES (%s,%s,%s,%s)",
                    (name, email, hashed, role))
        user_id = cur.lastrowid
        db.close()
        session.permanent = True
        session['user_id'] = user_id
        session['name']    = name
        session['email']   = email
        session['role']    = role
        return jsonify({'message': 'Registered successfully',
                        'user': {'id': user_id, 'name': name, 'email': email, 'role': role}})
    except mysql.connector.IntegrityError:
        return jsonify({'error': 'Email already registered'}), 400
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/login', methods=['POST'])
def login():
    data     = request.json
    email    = data.get('email', '').strip().lower()
    password = data.get('password', '')

    if not email or not password:
        return jsonify({'error': 'Email and password required'}), 400

    try:
        db  = get_db()
        cur = db.cursor(dictionary=True)
        cur.execute("SELECT * FROM users WHERE email=%s", (email,))
        user = cur.fetchone()
        db.close()

        if not user or not bcrypt.checkpw(password.encode(), user['password'].encode()):
            return jsonify({'error': 'Invalid email or password'}), 401

        session.permanent  = True
        session['user_id'] = user['id']
        session['name']    = user['name']
        session['email']   = user['email']
        session['role']    = user['role']

        return jsonify({'message': 'Login successful',
                        'user': {'id': user['id'], 'name': user['name'],
                                 'email': user['email'], 'role': user['role']}})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'message': 'Logged out'})


@app.route('/api/me', methods=['GET'])
def me():
    if 'user_id' not in session:
        return jsonify({'user': None}), 200
    return jsonify({'user': {
        'id':    session['user_id'],
        'name':  session['name'],
        'email': session['email'],
        'role':  session['role']
    }})

# ══════════════════════════════════════════════════════
#  QUIZ ROUTES
# ══════════════════════════════════════════════════════

@app.route('/api/quizzes', methods=['GET'])
@login_required
def get_quizzes():
    try:
        db  = get_db()
        cur = db.cursor(dictionary=True)
        if session['role'] == 'admin':
            cur.execute("""
                SELECT q.*, u.name as creator_name,
                       COUNT(DISTINCT qu.id) as question_count
                FROM quizzes q
                JOIN users u ON q.created_by = u.id
                LEFT JOIN questions qu ON qu.quiz_id = q.id
                GROUP BY q.id ORDER BY q.created_at DESC
            """)
        else:
            cur.execute("""
                SELECT q.*, u.name as creator_name,
                       COUNT(DISTINCT qu.id) as question_count
                FROM quizzes q
                JOIN users u ON q.created_by = u.id
                LEFT JOIN questions qu ON qu.quiz_id = q.id
                WHERE q.is_active = 1
                GROUP BY q.id ORDER BY q.created_at DESC
            """)
        quizzes = cur.fetchall()
        db.close()
        return jsonify({'quizzes': quizzes})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/quizzes/<int:quiz_id>', methods=['GET'])
@login_required
def get_quiz(quiz_id):
    try:
        db  = get_db()
        cur = db.cursor(dictionary=True)
        cur.execute("SELECT * FROM quizzes WHERE id=%s", (quiz_id,))
        quiz = cur.fetchone()
        if not quiz:
            db.close()
            return jsonify({'error': 'Quiz not found'}), 404

        cur.execute("SELECT * FROM questions WHERE quiz_id=%s ORDER BY position", (quiz_id,))
        questions = cur.fetchall()

        for q in questions:
            cur.execute("SELECT * FROM options WHERE question_id=%s ORDER BY option_order", (q['id'],))
            q['options'] = cur.fetchall()

        quiz['questions'] = questions
        db.close()
        return jsonify({'quiz': quiz})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/quizzes', methods=['POST'])
@admin_required
def create_quiz():
    data       = request.json
    title      = data.get('title', '').strip()
    desc       = data.get('description', '').strip()
    category   = data.get('category', '').strip()
    time_per_q = int(data.get('time_per_q', 30))
    questions  = data.get('questions', [])

    if not title:
        return jsonify({'error': 'Title is required'}), 400
    if not questions:
        return jsonify({'error': 'At least one question required'}), 400

    try:
        db  = get_db()
        cur = db.cursor()
        cur.execute("""INSERT INTO quizzes (title, description, category, time_per_q, created_by)
                       VALUES (%s,%s,%s,%s,%s)""",
                    (title, desc, category, time_per_q, session['user_id']))
        quiz_id = cur.lastrowid

        for pos, q in enumerate(questions, 1):
            cur.execute("""INSERT INTO questions (quiz_id, question_text, q_type, explanation, position)
                           VALUES (%s,%s,%s,%s,%s)""",
                        (quiz_id, q['text'], q['type'], q.get('explanation',''), pos))
            q_id = cur.lastrowid
            for o_idx, opt in enumerate(q['options'], 1):
                cur.execute("""INSERT INTO options (question_id, option_text, is_correct, option_order)
                               VALUES (%s,%s,%s,%s)""",
                            (q_id, opt['text'], 1 if opt.get('is_correct') else 0, o_idx))

        db.close()
        return jsonify({'message': 'Quiz created', 'quiz_id': quiz_id})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/quizzes/<int:quiz_id>', methods=['PUT'])
@admin_required
def update_quiz(quiz_id):
    data       = request.json
    title      = data.get('title', '').strip()
    desc       = data.get('description', '').strip()
    category   = data.get('category', '').strip()
    time_per_q = int(data.get('time_per_q', 30))
    is_active  = int(data.get('is_active', 1))
    questions  = data.get('questions', [])

    try:
        db  = get_db()
        cur = db.cursor()
        cur.execute("""UPDATE quizzes SET title=%s, description=%s, category=%s,
                       time_per_q=%s, is_active=%s WHERE id=%s""",
                    (title, desc, category, time_per_q, is_active, quiz_id))
        cur.execute("DELETE FROM questions WHERE quiz_id=%s", (quiz_id,))

        for pos, q in enumerate(questions, 1):
            cur.execute("""INSERT INTO questions (quiz_id, question_text, q_type, explanation, position)
                           VALUES (%s,%s,%s,%s,%s)""",
                        (quiz_id, q['text'], q['type'], q.get('explanation',''), pos))
            q_id = cur.lastrowid
            for o_idx, opt in enumerate(q['options'], 1):
                cur.execute("""INSERT INTO options (question_id, option_text, is_correct, option_order)
                               VALUES (%s,%s,%s,%s)""",
                            (q_id, opt['text'], 1 if opt.get('is_correct') else 0, o_idx))

        db.close()
        return jsonify({'message': 'Quiz updated'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/quizzes/<int:quiz_id>', methods=['DELETE'])
@admin_required
def delete_quiz(quiz_id):
    try:
        db  = get_db()
        cur = db.cursor()
        cur.execute("DELETE FROM quizzes WHERE id=%s", (quiz_id,))
        db.close()
        return jsonify({'message': 'Quiz deleted'})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ══════════════════════════════════════════════════════
#  ATTEMPT ROUTES
# ══════════════════════════════════════════════════════

@app.route('/api/attempts/start', methods=['POST'])
@login_required
def start_attempt():
    quiz_id = request.json.get('quiz_id')
    try:
        db  = get_db()
        cur = db.cursor(dictionary=True)
        cur.execute("SELECT COUNT(*) as cnt FROM questions WHERE quiz_id=%s", (quiz_id,))
        total_q = cur.fetchone()['cnt']
        cur.execute("INSERT INTO attempts (user_id, quiz_id, total_q) VALUES (%s,%s,%s)",
                    (session['user_id'], quiz_id, total_q))
        attempt_id = cur.lastrowid
        db.close()
        return jsonify({'attempt_id': attempt_id})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/attempts/submit', methods=['POST'])
@login_required
def submit_attempt():
    data       = request.json
    attempt_id = data.get('attempt_id')
    answers    = data.get('answers', [])

    try:
        db  = get_db()
        cur = db.cursor(dictionary=True)
        score = 0

        for ans in answers:
            q_id   = ans.get('question_id')
            opt_id = ans.get('selected_option_id')
            correct = 0

            if opt_id:
                cur.execute("SELECT is_correct FROM options WHERE id=%s AND question_id=%s", (opt_id, q_id))
                row = cur.fetchone()
                correct = int(row['is_correct']) if row else 0
                if correct:
                    score += 1

            cur.execute("""INSERT INTO attempt_answers
                           (attempt_id, question_id, selected_opt, is_correct)
                           VALUES (%s,%s,%s,%s)""",
                        (attempt_id, q_id, opt_id, correct))

        cur.execute("UPDATE attempts SET score=%s, finished_at=NOW() WHERE id=%s", (score, attempt_id))
        db.close()
        return jsonify({'message': 'Submitted', 'score': score})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/attempts/<int:attempt_id>/result', methods=['GET'])
@login_required
def get_result(attempt_id):
    try:
        db  = get_db()
        cur = db.cursor(dictionary=True)

        cur.execute("""
            SELECT a.*, q.title as quiz_title, q.category
            FROM attempts a JOIN quizzes q ON a.quiz_id = q.id
            WHERE a.id=%s AND a.user_id=%s
        """, (attempt_id, session['user_id']))
        attempt = cur.fetchone()
        if not attempt:
            db.close()
            return jsonify({'error': 'Not found'}), 404

        cur.execute("""
            SELECT aa.*, qs.question_text, qs.q_type, qs.explanation,
                   o.option_text as selected_text,
                   co.option_text as correct_text
            FROM attempt_answers aa
            JOIN questions qs ON aa.question_id = qs.id
            LEFT JOIN options o  ON aa.selected_opt = o.id
            LEFT JOIN options co ON co.question_id = qs.id AND co.is_correct = 1
            WHERE aa.attempt_id = %s
        """, (attempt_id,))
        answers = cur.fetchall()
        db.close()

        attempt['answers'] = answers
        return jsonify({'result': attempt})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/my-attempts', methods=['GET'])
@login_required
def my_attempts():
    try:
        db  = get_db()
        cur = db.cursor(dictionary=True)
        cur.execute("""
            SELECT a.id, a.score, a.total_q, a.started_at, a.finished_at,
                   q.title as quiz_title, q.category
            FROM attempts a JOIN quizzes q ON a.quiz_id = q.id
            WHERE a.user_id=%s ORDER BY a.started_at DESC LIMIT 20
        """, (session['user_id'],))
        rows = cur.fetchall()
        db.close()
        return jsonify({'attempts': rows})
    except Exception as e:
        return jsonify({'error': str(e)}), 500

# ══════════════════════════════════════════════════════
#  ADMIN STATS
# ══════════════════════════════════════════════════════

@app.route('/api/admin/stats', methods=['GET'])
@admin_required
def admin_stats():
    try:
        db  = get_db()
        cur = db.cursor(dictionary=True)
        cur.execute("SELECT COUNT(*) as total FROM users WHERE role='student'")
        students = cur.fetchone()['total']
        cur.execute("SELECT COUNT(*) as total FROM quizzes")
        total_quizzes = cur.fetchone()['total']
        cur.execute("SELECT COUNT(*) as total FROM attempts WHERE finished_at IS NOT NULL")
        total_attempts = cur.fetchone()['total']
        cur.execute("SELECT AVG(score/total_q*100) as avg FROM attempts WHERE finished_at IS NOT NULL")
        avg_score = round(cur.fetchone()['avg'] or 0, 1)

        cur.execute("""
            SELECT q.title, COUNT(a.id) as attempts,
                   AVG(a.score/a.total_q*100) as avg_score
            FROM quizzes q
            LEFT JOIN attempts a ON a.quiz_id = q.id AND a.finished_at IS NOT NULL
            GROUP BY q.id ORDER BY attempts DESC LIMIT 5
        """)
        top_quizzes = cur.fetchall()

        cur.execute("""
            SELECT u.name, u.email,
                   COUNT(a.id) as attempts,
                   AVG(a.score/a.total_q*100) as avg_score
            FROM users u
            LEFT JOIN attempts a ON a.user_id = u.id AND a.finished_at IS NOT NULL
            WHERE u.role='student'
            GROUP BY u.id ORDER BY avg_score DESC LIMIT 5
        """)
        top_students = cur.fetchall()
        db.close()

        return jsonify({
            'students': students, 'quizzes': total_quizzes,
            'attempts': total_attempts, 'avg_score': avg_score,
            'top_quizzes': top_quizzes, 'top_students': top_students
        })
    except Exception as e:
        return jsonify({'error': str(e)}), 500


@app.route('/api/admin/users', methods=['GET'])
@admin_required
def get_users():
    try:
        db  = get_db()
        cur = db.cursor(dictionary=True)
        cur.execute("""
            SELECT u.id, u.name, u.email, u.role, u.created_at,
                   COUNT(a.id) as total_attempts
            FROM users u
            LEFT JOIN attempts a ON a.user_id = u.id
            GROUP BY u.id ORDER BY u.created_at DESC
        """)
        users = cur.fetchall()
        db.close()
        return jsonify({'users': users})
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(debug=True, port=5000)
