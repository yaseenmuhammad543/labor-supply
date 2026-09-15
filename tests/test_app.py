import pytest

from app import app, db, Job, User


@pytest.fixture
def client():
    app.config['TESTING'] = True
    app.config['SQLALCHEMY_DATABASE_URI'] = 'sqlite://'
    with app.app_context():
        db.create_all()
        seed_data()
    with app.test_client() as client:
        yield client


def seed_data():
    if not User.query.filter_by(email='arun@example.com').first():
        user = User(name='Arun Kumar', email='arun@example.com', password_hash='password123', role='worker')
        db.session.add(user)
    if not Job.query.first():
        db.session.add_all([
            Job(title='Electrician', company='ABC Electrical Services', location='Thiruvananthapuram, Kerala', salary='₹18,000 - ₹25,000', employment_type='Full Time', experience='2+ years', qualification='ITI Electrical', description='Install electrical systems', match_score=92, verified=True, skills='Electrical Wiring,Maintenance,Safety'),
            Job(title='Driver', company='Metro Logistics', location='Kollam, Kerala', salary='₹16,000 - ₹22,000', employment_type='Full Time', experience='3+ years', qualification='Commercial Driving License', description='Safe logistics delivery', match_score=89, verified=True, skills='Route Planning,Logistics,Safety'),
        ])
    db.session.commit()


def test_health_endpoint(client):
    response = client.get('/api/health')
    assert response.status_code == 200
    data = response.get_json()
    assert data['status'] == 'ok'


def test_jobs_endpoint(client):
    response = client.get('/api/jobs')
    assert response.status_code == 200
    jobs = response.get_json()['jobs']
    assert len(jobs) >= 2
    assert jobs[0]['title']


def test_worker_login(client):
    response = client.post('/api/login', json={
        'email': 'arun@example.com',
        'password': 'password123',
        'role': 'worker'
    })
    assert response.status_code == 200
    data = response.get_json()
    assert data['success'] is True
    assert data['user']['role'] == 'worker'


def test_employer_login(client):
    response = client.post('/api/login', json={
        'email': 'hr@abcelectrical.in',
        'password': 'employer123',
        'role': 'employer'
    })
    assert response.status_code == 200
    data = response.get_json()
    assert data['success'] is True
    assert data['user']['role'] == 'employer'


def test_register_user(client):
    response = client.post('/api/register', json={
        'name': 'Praveen Nair',
        'email': 'praveen@example.com',
        'password': 'securepass',
        'role': 'worker'
    })
    assert response.status_code == 200
    data = response.get_json()
    assert data['success'] is True
    assert data['user']['email'] == 'praveen@example.com'


def test_employer_can_create_job(client):
    login = client.post('/api/login', json={
        'email': 'hr@abcelectrical.in',
        'password': 'employer123',
        'role': 'employer'
    })
    assert login.status_code == 200

    response = client.post('/api/jobs', json={
        'title': 'HVAC Technician',
        'company': 'CoolAir Services',
        'location': 'Kochi, Kerala',
        'salary': '₹20,000 - ₹30,000',
        'employment_type': 'Full Time',
        'experience': '2+ years',
        'qualification': 'Diploma in HVAC',
        'description': 'Install and maintain HVAC systems.',
        'skills': 'Repair,Maintenance,Diagnostics'
    })
    assert response.status_code == 200
    data = response.get_json()
    assert data['success'] is True
    assert data['job']['title'] == 'HVAC Technician'


def test_worker_can_apply_to_job(client):
    login = client.post('/api/login', json={
        'email': 'arun@example.com',
        'password': 'password123',
        'role': 'worker'
    })
    assert login.status_code == 200

    response = client.post('/api/jobs/1/apply')
    assert response.status_code == 200
    data = response.get_json()
    assert data['success'] is True
    assert data['application']['status'] == 'applied'


def test_admin_can_view_platform_data_and_disable_user(client):
    login = client.post('/admin/api/login', json={
        'email': 'admin@laborsupply.in',
        'password': 'admin123',
    })
    assert login.status_code == 200

    dashboard = client.get('/admin/api/overview')
    assert dashboard.status_code == 200
    assert dashboard.get_json()['stats']['workers'] >= 1

    users = client.get('/admin/api/users')
    assert users.status_code == 200
    arun = next(user for user in users.get_json()['users'] if user['email'] == 'arun@example.com')

    response = client.patch(f"/admin/api/users/{arun['id']}", json={'is_active': False})
    assert response.status_code == 200
    assert response.get_json()['user']['is_active'] is False

    hide_job = client.patch('/admin/api/jobs/1', json={'verified': False})
    assert hide_job.status_code == 200
    public_jobs = client.get('/api/jobs')
    assert all(job['id'] != 1 for job in public_jobs.get_json()['jobs'])

    worker_login = client.post('/api/login', json={
        'email': 'arun@example.com',
        'password': 'password123',
        'role': 'worker'
    })
    assert worker_login.status_code == 403


def test_admin_has_separate_namespace(client):
    public_admin_page = client.get('/pages/admin-login.html')
    assert public_admin_page.status_code == 404

    admin_page = client.get('/admin/admin-login.html')
    assert admin_page.status_code == 200

    public_admin_api = client.get('/api/admin/overview')
    assert public_admin_api.status_code == 404

    admin_login = client.post('/admin/api/login', json={
        'email': 'admin@laborsupply.in',
        'password': 'admin123',
    })
    assert admin_login.status_code == 200

    overview = client.get('/admin/api/overview')
    assert overview.status_code == 200
