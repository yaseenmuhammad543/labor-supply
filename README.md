# Labor Supply Marketplace

A responsive labor marketplace with a Flask backend, SQLite persistence, session-based authentication, employer job posting, worker applications, and a multi-page HTML/CSS/JavaScript frontend.

## Project structure

- `index.html` – homepage
- `app.py` - Flask application, SQLAlchemy models, authentication, and marketplace APIs
- `css/` - shared design system and responsive styling
- `js/main.js` - API-connected frontend behavior
- `pages/` - worker, employer, authentication, and admin pages
- `tests/test_app.py` - backend API tests

## Features

- Worker and employer registration/login
- Secure password hashing and session authentication
- Database-backed jobs and applications
- Employer job posting
- Worker application submission and application history
- Job search and filtering
- Responsive worker, employer, and admin pages

## Setup

Install dependencies:

```bash
python -m pip install Flask Flask-SQLAlchemy pytest
```

## Run the application

```bash
cd labor-supply-website
python app.py
```

Then visit http://localhost:8000/

## Run tests

```bash
python -m pytest -q
```

There are no built-in demo accounts. Create worker and employer accounts through the registration pages. Create an admin account directly in the production database and keep its credentials private.
