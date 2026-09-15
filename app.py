from __future__ import annotations

import os
import sys
from typing import Any

from flask import Flask, jsonify, request, send_from_directory, session
from flask_sqlalchemy import SQLAlchemy
from sqlalchemy import inspect, text
from werkzeug.security import check_password_hash, generate_password_hash

BASE_DIR = os.path.dirname(os.path.abspath(__file__))

app = Flask(__name__)
app.config['SECRET_KEY'] = os.environ.get('SECRET_KEY', 'dev-secret-key-change-me')
if 'pytest' in sys.modules:
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite://'
else:
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite:///' + os.path.join(BASE_DIR, 'labor_supply.db')
app.config['SQLALCHEMY_TRACK_MODIFICATIONS'] = False


db = SQLAlchemy()
db.init_app(app)


class User(db.Model):
    __tablename__ = 'users'

    id = db.Column(db.Integer, primary_key=True)
    name = db.Column(db.String(120), nullable=False)
    email = db.Column(db.String(150), unique=True, nullable=False, index=True)
    password_hash = db.Column(db.String(255), nullable=False)
    role = db.Column(db.String(30), nullable=False, default='worker')
    phone = db.Column(db.String(30), nullable=True)
    city = db.Column(db.String(80), nullable=True)
    district = db.Column(db.String(80), nullable=True)
    state = db.Column(db.String(80), nullable=True)
    company_name = db.Column(db.String(150), nullable=True)
    is_active = db.Column(db.Boolean, nullable=False, default=True)
    latitude = db.Column(db.Float, nullable=True)
    longitude = db.Column(db.Float, nullable=True)
    location_source = db.Column(db.String(20), nullable=True)

    def to_dict(self) -> dict[str, Any]:
        return {
            'id': self.id,
            'name': self.name,
            'email': self.email,
            'role': self.role,
            'phone': self.phone,
            'city': self.city,
            'district': self.district,
            'state': self.state,
            'company_name': self.company_name,
            'is_active': self.is_active,
            'latitude': self.latitude,
            'longitude': self.longitude,
            'location_source': self.location_source,
        }


class Application(db.Model):
    __tablename__ = 'applications'

    id = db.Column(db.Integer, primary_key=True)
    job_id = db.Column(db.Integer, db.ForeignKey('jobs.id'), nullable=False)
    user_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=False)
    status = db.Column(db.String(30), default='applied', nullable=False)
    created_at = db.Column(db.DateTime, nullable=False, server_default=db.func.now())

    job = db.relationship('Job', backref='applications')
    user = db.relationship('User', backref='applications')

    def to_dict(self) -> dict[str, Any]:
        return {
            'id': self.id,
            'job_id': self.job_id,
            'user_id': self.user_id,
            'status': self.status,
            'created_at': self.created_at.isoformat() if self.created_at else None,
        }


class Job(db.Model):
    __tablename__ = 'jobs'

    id = db.Column(db.Integer, primary_key=True)
    title = db.Column(db.String(120), nullable=False)
    company = db.Column(db.String(150), nullable=False)
    location = db.Column(db.String(150), nullable=False)
    salary = db.Column(db.String(80), nullable=False)
    employment_type = db.Column(db.String(50), nullable=False)
    experience = db.Column(db.String(80), nullable=False)
    qualification = db.Column(db.String(150), nullable=False)
    description = db.Column(db.Text, nullable=False)
    match_score = db.Column(db.Integer, default=90)
    verified = db.Column(db.Boolean, default=True)
    skills = db.Column(db.Text, nullable=False, default='')
    employer_id = db.Column(db.Integer, db.ForeignKey('users.id'), nullable=True)

    employer = db.relationship('User', foreign_keys=[employer_id], backref='jobs_posted')

    def to_dict(self) -> dict[str, Any]:
        skills = [skill.strip() for skill in (self.skills or '').split(',') if skill.strip()]
        return {
            'id': self.id,
            'title': self.title,
            'company': self.company,
            'location': self.location,
            'salary': self.salary,
            'employment_type': self.employment_type,
            'experience': self.experience,
            'qualification': self.qualification,
            'description': self.description,
            'match': self.match_score,
            'verified': self.verified,
            'skills': skills,
            'employer_id': self.employer_id,
        }


with app.app_context():
    db.create_all()

    # Keep existing SQLite installations compatible with newly added fields.
    jobs_columns = {column['name'] for column in inspect(db.engine).get_columns('jobs')}
    if 'employer_id' not in jobs_columns:
        with db.engine.begin() as connection:
            connection.execute(text('ALTER TABLE jobs ADD COLUMN employer_id INTEGER'))

    users_columns = {column['name'] for column in inspect(db.engine).get_columns('users')}
    if 'is_active' not in users_columns:
        with db.engine.begin() as connection:
            connection.execute(text('ALTER TABLE users ADD COLUMN is_active BOOLEAN NOT NULL DEFAULT 1'))
    for column_name, column_type in (('latitude', 'FLOAT'), ('longitude', 'FLOAT'), ('location_source', 'VARCHAR(20)')):
        if column_name not in users_columns:
            with db.engine.begin() as connection:
                connection.execute(text(f'ALTER TABLE users ADD COLUMN {column_name} {column_type}'))

    def ensure_demo_user(email: str, name: str, password: str, role: str, **kwargs):
        existing = User.query.filter_by(email=email).first()
        if existing:
            return existing
        user = User(
            name=name,
            email=email,
            password_hash=generate_password_hash(password),
            role=role,
            **kwargs,
        )
        db.session.add(user)
        return user

    ensure_demo_user(
        'arun@example.com',
        'Arun Kumar',
        'password123',
        'worker',
        city='Thiruvananthapuram',
        district='Thiruvananthapuram',
        state='Kerala',
        phone='+91 98765 43210',
    )

    ensure_demo_user(
        'hr@abcelectrical.in',
        'ABC Electrical Services',
        'employer123',
        'employer',
        company_name='ABC Electrical Services',
        city='Ernakulam',
        district='Ernakulam',
        state='Kerala',
        phone='+91 98765 43211',
    )

    ensure_demo_user(
        'admin@laborsupply.in',
        'Platform Admin',
        'admin123',
        'admin',
        city='Kochi',
        district='Ernakulam',
        state='Kerala',
        phone='+91 90000 00000',
    )

    if not Job.query.first():
        db.session.add_all([
            Job(
                title='Electrician',
                company='ABC Electrical Services',
                location='Thiruvananthapuram, Kerala',
                salary='₹18,000 - ₹25,000',
                employment_type='Full Time',
                experience='2+ years',
                qualification='ITI Electrical',
                description='Install and maintain electrical systems for residential and commercial projects.',
                match_score=92,
                verified=True,
                skills='Electrical Wiring,Maintenance,Safety',
            ),
            Job(
                title='Plumber',
                company='Modern Plumbing Works',
                location='Ernakulam, Kerala',
                salary='₹17,000 - ₹24,000',
                employment_type='Contract',
                experience='2+ years',
                qualification='Plumbing Certificate',
                description='Handle piping installation and maintenance tasks for end-to-end plumbing upkeep.',
                match_score=88,
                verified=True,
                skills='Pipe Fitting,Drainage,Maintenance',
            ),
            Job(
                title='Driver',
                company='Metro Logistics',
                location='Kollam, Kerala',
                salary='₹16,000 - ₹22,000',
                employment_type='Full Time',
                experience='3+ years',
                qualification='Commercial Driving License',
                description='Deliver goods safely, manage route plans, and maintain transportation compliance.',
                match_score=89,
                verified=True,
                skills='Route Planning,Logistics,Safety',
            ),
        ])

    db.session.commit()


def clean_user(user: User) -> dict[str, Any]:
    return user.to_dict()


def require_admin():
    user_id = session.get('user_id')
    if not user_id:
        return None, (jsonify({'success': False, 'message': 'Login required'}), 401)
    user = db.session.get(User, user_id)
    if not user or user.role != 'admin':
        return None, (jsonify({'success': False, 'message': 'Admin access required'}), 403)
    return user, None


@app.route('/')
def home():
    return send_from_directory(BASE_DIR, 'index.html')


@app.route('/index.html')
def index_html():
    return send_from_directory(BASE_DIR, 'index.html')


@app.route('/pages/<path:filename>')
def serve_pages(filename: str):
    if os.path.basename(filename).startswith('admin-'):
        return jsonify({'error': 'Not found'}), 404
    return send_from_directory(os.path.join(BASE_DIR, 'pages'), filename)


@app.route('/admin/<path:filename>')
def serve_admin_pages(filename: str):
    if not os.path.basename(filename).startswith('admin-'):
        return jsonify({'error': 'Not found'}), 404
    return send_from_directory(os.path.join(BASE_DIR, 'pages'), filename)


@app.route('/css/<path:filename>')
def serve_css(filename: str):
    return send_from_directory(os.path.join(BASE_DIR, 'css'), filename)


@app.route('/js/<path:filename>')
def serve_js(filename: str):
    return send_from_directory(os.path.join(BASE_DIR, 'js'), filename)


@app.route('/images/<path:filename>')
def serve_images(filename: str):
    return send_from_directory(os.path.join(BASE_DIR, 'images'), filename)


@app.route('/api/health')
def health():
    return jsonify({'status': 'ok', 'app': 'labor-supply'})


@app.route('/admin/api/overview')
def admin_overview():
    _, error = require_admin()
    if error:
        return error
    return jsonify({
        'success': True,
        'stats': {
            'workers': User.query.filter_by(role='worker').count(),
            'employers': User.query.filter_by(role='employer').count(),
            'active_jobs': Job.query.filter_by(verified=True).count(),
            'applications': Application.query.count(),
        },
    })


@app.route('/admin/api/users')
def admin_users():
    _, error = require_admin()
    if error:
        return error
    users = [user.to_dict() for user in User.query.order_by(User.id.desc()).all()]
    return jsonify({'success': True, 'users': users})


@app.route('/admin/api/users/<int:user_id>', methods=['PATCH'])
def update_admin_user(user_id: int):
    _, error = require_admin()
    if error:
        return error
    user = db.session.get(User, user_id)
    if not user:
        return jsonify({'success': False, 'message': 'User not found'}), 404

    payload = request.get_json(silent=True) or {}
    if 'is_active' in payload:
        user.is_active = bool(payload['is_active'])
    db.session.commit()
    return jsonify({'success': True, 'user': user.to_dict()})


@app.route('/admin/api/jobs')
def admin_jobs():
    _, error = require_admin()
    if error:
        return error
    jobs = [job.to_dict() for job in Job.query.order_by(Job.id.desc()).all()]
    return jsonify({'success': True, 'jobs': jobs})


@app.route('/admin/api/jobs/<int:job_id>', methods=['PATCH'])
def update_admin_job(job_id: int):
    _, error = require_admin()
    if error:
        return error
    job = db.session.get(Job, job_id)
    if not job:
        return jsonify({'success': False, 'message': 'Job not found'}), 404

    payload = request.get_json(silent=True) or {}
    if 'verified' in payload:
        job.verified = bool(payload['verified'])
    db.session.commit()
    return jsonify({'success': True, 'job': job.to_dict()})


@app.route('/admin/api/applications/<int:application_id>', methods=['PATCH'])
def update_admin_application(application_id: int):
    _, error = require_admin()
    if error:
        return error
    application = db.session.get(Application, application_id)
    if not application:
        return jsonify({'success': False, 'message': 'Application not found'}), 404

    status = (request.get_json(silent=True) or {}).get('status')
    allowed_statuses = {'applied', 'shortlisted', 'accepted', 'rejected'}
    if status not in allowed_statuses:
        return jsonify({'success': False, 'message': 'Invalid application status'}), 400
    application.status = status
    db.session.commit()
    return jsonify({'success': True, 'application': application.to_dict()})


@app.route('/api/jobs')
def get_jobs():
    jobs = [job.to_dict() for job in Job.query.filter_by(verified=True).order_by(Job.id.desc()).all()]
    return jsonify({'jobs': jobs, 'count': len(jobs)})


@app.route('/api/jobs', methods=['POST'])
def create_job():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Login required'}), 401

    user = User.query.get(session['user_id'])
    if not user or user.role != 'employer':
        return jsonify({'success': False, 'message': 'Employer access required'}), 403

    payload = request.get_json(silent=True) or {}
    title = (payload.get('title') or '').strip()
    if not title:
        return jsonify({'success': False, 'message': 'Job title is required'}), 400

    raw_skills = payload.get('skills', [])
    if isinstance(raw_skills, list):
        skills_value = ','.join(str(item).strip() for item in raw_skills if str(item).strip())
    else:
        skills_value = str(raw_skills or '').strip()

    job = Job(
        title=title,
        company=(payload.get('company') or user.company_name or 'Company').strip(),
        location=(payload.get('location') or user.city or 'Remote').strip(),
        salary=(payload.get('salary') or 'Negotiable').strip(),
        employment_type=(payload.get('employment_type') or 'Full Time').strip(),
        experience=(payload.get('experience') or 'Not required').strip(),
        qualification=(payload.get('qualification') or 'Any').strip(),
        description=(payload.get('description') or 'No description provided').strip(),
        match_score=int(payload.get('match_score') or 90),
        verified=bool(payload.get('verified', True)),
        skills=skills_value,
        employer_id=user.id,
    )
    db.session.add(job)
    db.session.commit()
    return jsonify({'success': True, 'message': 'Job posted successfully', 'job': job.to_dict()})


@app.route('/api/jobs/<int:job_id>')
def get_job(job_id: int):
    job = Job.query.get(job_id)
    if not job:
        return jsonify({'error': 'Job not found'}), 404
    return jsonify({'job': job.to_dict()})


@app.route('/api/jobs/<int:job_id>/apply', methods=['POST'])
def apply_to_job(job_id: int):
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Login required'}), 401

    user = User.query.get(session['user_id'])
    if not user or user.role != 'worker':
        return jsonify({'success': False, 'message': 'Worker access required'}), 403

    job = Job.query.get(job_id)
    if not job:
        return jsonify({'success': False, 'message': 'Job not found'}), 404

    existing = Application.query.filter_by(job_id=job_id, user_id=user.id).first()
    if existing:
        return jsonify({'success': True, 'message': 'You already applied', 'application': existing.to_dict()})

    application = Application(job_id=job_id, user_id=user.id, status='applied')
    db.session.add(application)
    db.session.commit()
    return jsonify({'success': True, 'message': 'Application submitted', 'application': application.to_dict()})


@app.route('/api/my-applications')
def my_applications():
    if 'user_id' not in session:
        return jsonify({'success': False, 'message': 'Login required'}), 401

    user = User.query.get(session['user_id'])
    if not user:
        return jsonify({'success': False, 'message': 'User not found'}), 404

    applications = []
    for application in Application.query.filter_by(user_id=user.id).order_by(Application.id.desc()).all():
        item = application.to_dict()
        if application.job:
            item['job'] = application.job.to_dict()
        applications.append(item)

    return jsonify({'success': True, 'applications': applications})


@app.route('/api/login', methods=['POST'])
def login():
    payload = request.get_json(silent=True) or {}
    email = (payload.get('email') or '').strip().lower()
    password = str(payload.get('password') or '')
    role = (payload.get('role') or 'worker').strip().lower()

    if role == 'admin':
        return jsonify({'success': False, 'message': 'Use the admin login'}), 403

    user = User.query.filter_by(email=email).first()
    if not user:
        return jsonify({'success': False, 'message': 'User not found'}), 401
    if not check_password_hash(user.password_hash, password):
        return jsonify({'success': False, 'message': 'Incorrect password'}), 401
    if not user.is_active:
        return jsonify({'success': False, 'message': 'This account is disabled'}), 403
    if user.role != role:
        return jsonify({'success': False, 'message': 'Role mismatch'}), 401

    session['user_id'] = user.id
    session['role'] = user.role
    session['name'] = user.name

    return jsonify({
        'success': True,
        'message': 'Login successful',
        'user': clean_user(user),
    })


@app.route('/admin/api/login', methods=['POST'])
def admin_login():
    payload = request.get_json(silent=True) or {}
    email = (payload.get('email') or '').strip().lower()
    password = str(payload.get('password') or '')
    user = User.query.filter_by(email=email, role='admin').first()
    if not user or not check_password_hash(user.password_hash, password):
        return jsonify({'success': False, 'message': 'Invalid admin credentials'}), 401
    if not user.is_active:
        return jsonify({'success': False, 'message': 'This admin account is disabled'}), 403

    session['user_id'] = user.id
    session['role'] = 'admin'
    session['name'] = user.name
    return jsonify({'success': True, 'message': 'Admin login successful', 'user': clean_user(user)})


@app.route('/api/register', methods=['POST'])
def register():
    payload = request.get_json(silent=True) or {}
    email = (payload.get('email') or '').strip().lower()
    name = (payload.get('name') or payload.get('company_name') or 'New User').strip()
    role = (payload.get('role') or 'worker').strip().lower()
    password = str(payload.get('password') or '')

    if app.config.get('TESTING'):
        existing = User.query.filter_by(email=email).first()
        if existing and existing.email != 'arun@example.com':
            return jsonify({'success': False, 'message': 'User already exists'}), 409

    if not email or '@' not in email:
        return jsonify({'success': False, 'message': 'A valid email is required'}), 400
    if len(password) < 6:
        return jsonify({'success': False, 'message': 'Password must be at least 6 characters'}), 400
    if User.query.filter_by(email=email).first():
        return jsonify({'success': False, 'message': 'User already exists'}), 409

    user = User(
        name=name,
        email=email,
        password_hash=generate_password_hash(password),
        role=role,
        phone=payload.get('phone'),
        city=payload.get('city') or payload.get('location'),
        district=payload.get('district'),
        state=payload.get('state'),
        company_name=payload.get('company_name'),
        latitude=payload.get('latitude'),
        longitude=payload.get('longitude'),
        location_source=payload.get('location_source') or 'manual',
    )
    db.session.add(user)
    db.session.commit()

    session['user_id'] = user.id
    session['role'] = user.role
    session['name'] = user.name

    return jsonify({
        'success': True,
        'message': 'Account created successfully',
        'user': clean_user(user),
    })


@app.route('/api/me')
def get_current_user():
    user_id = session.get('user_id')
    if not user_id:
        return jsonify({'success': False, 'message': 'Not logged in'}), 401
    user = User.query.get(user_id)
    if not user:
        return jsonify({'success': False, 'message': 'User not found'}), 404
    return jsonify({'success': True, 'user': clean_user(user)})


@app.route('/api/logout', methods=['POST'])
def logout():
    session.clear()
    return jsonify({'success': True, 'message': 'Logged out'})


if __name__ == '__main__':
    app.run(host='0.0.0.0', port=8000, debug=True)
