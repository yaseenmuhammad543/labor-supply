document.addEventListener('DOMContentLoaded', () => {
  const state = {
    jobs: [],
  };

  const searchButton = document.querySelector('.btn-search');
  const jobCards = Array.from(document.querySelectorAll('.job-card'));

  const renderJobs = (jobs = state.jobs) => {
    const container = document.querySelector('.job-grid');
    if (!container || !jobs.length) return;

    container.innerHTML = jobs
      .map((job) => `
        <article class="job-card card-shadow">
          <div class="job-top-row">
            <span class="job-title">${job.title}</span>
            <span class="match-pill">${job.match || 90}% Match</span>
          </div>
          <h3>${job.company} ${job.verified ? '<span class="verified-badge"><i class="fa-solid fa-circle-check"></i> Verified</span>' : ''}</h3>
          <p class="location"><i class="fa-solid fa-location-dot"></i> ${job.location}</p>
          <div class="salary-row">
            <span class="price">${job.salary}</span>
            <span class="employment-type">${job.employment_type}</span>
          </div>
          <ul class="job-meta-list">
            <li><i class="fa-solid fa-briefcase"></i> Experience: ${job.experience}</li>
            <li><i class="fa-solid fa-graduation-cap"></i> Qualification: ${job.qualification}</li>
          </ul>
          <div class="skills-wrap">
            ${(job.skills || []).map((skill) => `<span>${skill}</span>`).join('')}
          </div>
          <div class="job-card-actions">
            <a href="pages/job-details.html?id=${job.id}" class="btn btn-outline-primary">View Job</a>
            <button class="btn btn-primary apply-btn" type="button" data-job-id="${job.id}">Apply Now</button>
          </div>
        </article>
      `)
      .join('');

    document.querySelectorAll('.apply-btn').forEach((button) => {
      button.addEventListener('click', async () => {
        button.disabled = true;
        button.textContent = 'Applying...';
        try {
          const response = await fetch(`/api/jobs/${button.dataset.jobId}/apply`, { method: 'POST' });
          const result = await response.json();
          if (!response.ok) throw new Error(result.message || 'Unable to apply');
          button.textContent = result.application.status === 'applied' ? 'Applied' : result.application.status;
          button.classList.add('btn-success');
        } catch (error) {
          button.disabled = false;
          button.textContent = 'Apply Now';
          alert(error.message);
        }
      });
    });
  };

  const loadApplications = async () => {
    const tableBody = document.querySelector('[data-applications-body]');
    if (!tableBody) return;

    try {
      const response = await fetch('/api/my-applications');
      const result = await response.json();
      if (!response.ok) throw new Error(result.message || 'Unable to load applications');
      tableBody.innerHTML = result.applications.length
        ? result.applications.map((application) => `
          <tr>
            <td>${application.job?.title || 'Job'}</td>
            <td>${application.job?.company || '-'}</td>
            <td>${application.job?.location || '-'}</td>
            <td>${application.created_at ? new Date(application.created_at).toLocaleDateString() : '-'}</td>
            <td>${application.job?.match || 90}%</td>
            <td><span class="status-badge ${application.status === 'accepted' ? 'accepted' : application.status === 'shortlisted' ? 'shortlisted' : 'review'}">${application.status}</span></td>
          </tr>
        `).join('')
        : '<tr><td colspan="6">No applications yet. Browse jobs to get started.</td></tr>';
    } catch (error) {
      tableBody.innerHTML = `<tr><td colspan="6">${error.message}</td></tr>`;
    }
  };

  const adminRequest = async (url, options = {}) => {
    const response = await fetch(url, options);
    const result = await response.json();
    if (!response.ok) throw new Error(result.message || 'Admin request failed');
    return result;
  };

  const loadAdminOverview = async () => {
    if (!document.querySelector('[data-admin-stat]')) return;
    try {
      const result = await adminRequest('/api/admin/overview');
      Object.entries(result.stats).forEach(([key, value]) => {
        const target = document.querySelector(`[data-admin-stat="${key}"]`);
        if (target) target.textContent = value;
      });
    } catch (error) {
      console.warn(error.message);
    }
  };

  const loadAdminUsers = async () => {
    const tableBody = document.querySelector('[data-admin-users-body]');
    if (!tableBody) return;
    try {
      const result = await adminRequest('/api/admin/users');
      tableBody.innerHTML = result.users.map((user) => `
        <tr>
          <td>${user.name}</td>
          <td>${user.email}</td>
          <td>${user.city || user.state || '-'}</td>
          <td><span class="status-badge ${user.is_active ? 'verified' : 'pending'}">${user.is_active ? 'ACTIVE' : 'DISABLED'}</span></td>
          <td><button class="small-btn admin-user-toggle" data-user-id="${user.id}" data-active="${user.is_active}">${user.is_active ? 'Disable' : 'Enable'}</button></td>
        </tr>
      `).join('');
      tableBody.querySelectorAll('.admin-user-toggle').forEach((button) => {
        button.addEventListener('click', async () => {
          try {
            await adminRequest(`/api/admin/users/${button.dataset.userId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ is_active: button.dataset.active !== 'true' }),
            });
            await loadAdminUsers();
          } catch (error) {
            alert(error.message);
          }
        });
      });
    } catch (error) {
      tableBody.innerHTML = `<tr><td colspan="5">${error.message}</td></tr>`;
    }
  };

  const loadAdminJobs = async () => {
    const tableBody = document.querySelector('[data-admin-jobs-body]');
    if (!tableBody) return;
    try {
      const result = await adminRequest('/api/admin/jobs');
      tableBody.innerHTML = result.jobs.map((job) => `
        <tr>
          <td>${job.title}</td>
          <td>${job.company}</td>
          <td>${job.location}</td>
          <td><span class="status-badge ${job.verified ? 'verified' : 'pending'}">${job.verified ? 'VISIBLE' : 'HIDDEN'}</span></td>
          <td><button class="small-btn admin-job-toggle" data-job-id="${job.id}" data-verified="${job.verified}">${job.verified ? 'Hide' : 'Publish'}</button></td>
        </tr>
      `).join('');
      tableBody.querySelectorAll('.admin-job-toggle').forEach((button) => {
        button.addEventListener('click', async () => {
          try {
            await adminRequest(`/api/admin/jobs/${button.dataset.jobId}`, {
              method: 'PATCH',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ verified: button.dataset.verified !== 'true' }),
            });
            await loadAdminJobs();
          } catch (error) {
            alert(error.message);
          }
        });
      });
    } catch (error) {
      tableBody.innerHTML = `<tr><td colspan="5">${error.message}</td></tr>`;
    }
  };

  const postJobForm = document.querySelector('[data-post-job-form]');
  if (postJobForm) {
    postJobForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(postJobForm).entries());
      payload.salary = `${document.getElementById('minimum-salary')?.value || ''} - ${document.getElementById('maximum-salary')?.value || ''}`;
      const submitButton = postJobForm.querySelector('button[type="submit"]');
      submitButton.disabled = true;
      submitButton.textContent = 'POSTING...';
      try {
        const response = await fetch('/api/jobs', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const result = await response.json();
        if (!response.ok) throw new Error(result.message || 'Unable to post job');
        alert('Job posted successfully.');
        window.location.href = 'employer-dashboard.html';
      } catch (error) {
        submitButton.disabled = false;
        submitButton.textContent = 'POST JOB';
        alert(error.message);
      }
    });
  }

  const loadJobs = async () => {
    try {
      const response = await fetch('/api/jobs');
      if (!response.ok) throw new Error('Unable to fetch jobs');
      const result = await response.json();
      state.jobs = result.jobs || [];
      renderJobs(state.jobs);
    } catch (error) {
      console.warn('Using fallback job data:', error);
      if (jobCards.length) {
        return;
      }
    }
  };

  const filterJobs = () => {
    const keywordInput = document.getElementById('jobKeyword');
    const locationInput = document.getElementById('jobLocation');
    const qualificationInput = document.getElementById('qualificationFilter');
    const skillInput = document.getElementById('skillFilter');

    if (!keywordInput || !locationInput || !qualificationInput || !skillInput) {
      return;
    }

    const keyword = keywordInput.value.trim().toLowerCase();
    const location = locationInput.value.trim().toLowerCase();
    const qualification = qualificationInput.value.trim().toLowerCase();
    const skill = skillInput.value.trim().toLowerCase();

    if (!state.jobs.length) {
      const fallback = Array.from(document.querySelectorAll('.job-card'));
      fallback.forEach((card) => {
        const title = card.querySelector('.job-title')?.textContent.toLowerCase() || '';
        const locationText = card.querySelector('.location')?.textContent.toLowerCase() || '';
        const skillText = card.querySelector('.skills-wrap')?.textContent.toLowerCase() || '';
        const qualificationText = card.querySelector('.job-meta-list')?.textContent.toLowerCase() || '';

        const showCard = (!keyword || title.includes(keyword) || skillText.includes(keyword)) &&
          (!location || locationText.includes(location)) &&
          (!qualification || qualificationText.includes(qualification)) &&
          (!skill || skillText.includes(skill));
        card.style.display = showCard ? 'block' : 'none';
      });
      return;
    }

    const filtered = state.jobs.filter((job) => {
      const title = (job.title || '').toLowerCase();
      const locationText = (job.location || '').toLowerCase();
      const skillsText = (job.skills || []).join(' ').toLowerCase();
      const qualificationText = (job.qualification || '').toLowerCase();

      return (!keyword || title.includes(keyword) || skillsText.includes(keyword)) &&
        (!location || locationText.includes(location)) &&
        (!qualification || qualificationText.includes(qualification)) &&
        (!skill || skillsText.includes(skill));
    });

    renderJobs(filtered);
  };

  if (searchButton) {
    searchButton.addEventListener('click', filterJobs);
  }

  document.querySelectorAll('.apply-btn').forEach((button) => {
    button.addEventListener('click', () => {
      button.textContent = 'Applied';
      button.disabled = true;
      button.classList.add('btn-success');
    });
  });

  const navToggler = document.querySelector('.navbar-toggler');
  if (navToggler) {
    navToggler.addEventListener('click', () => {
      const nav = document.getElementById('mainNav');
      if (nav) nav.classList.toggle('show');
    });
  }

  document.querySelectorAll('.password-toggle').forEach((button) => {
    button.addEventListener('click', () => {
      const target = document.getElementById(button.dataset.target);
      if (!target) return;
      const isPassword = target.type === 'password';
      target.type = isPassword ? 'text' : 'password';
      button.textContent = isPassword ? 'Hide' : 'Show';
    });
  });

  const forms = document.querySelectorAll('form');
  forms.forEach((form) => {
    form.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (form === postJobForm) return;
      const payload = Object.fromEntries(new FormData(form).entries());
      const email = payload.email;
      const password = payload.password;
      const role = form.querySelector('#company-name') || form.querySelector('#employer-email')
        ? 'employer'
        : form.querySelector('#admin-email')
          ? 'admin'
          : 'worker';

      const isLogin = form.querySelector('#email') || form.querySelector('#wemail') || form.querySelector('#employer-email') || form.querySelector('#admin-email');

      if (isLogin) {
        const response = await fetch('/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ email, password, role })
        });
        const result = await response.json();
        if (response.ok) {
          window.location.href = result.user.role === 'employer'
            ? 'employer-dashboard.html'
            : result.user.role === 'admin'
              ? 'admin-dashboard.html'
              : 'worker-dashboard.html';
        } else {
          alert(result.message || 'Login failed');
        }
        return;
      }

      const registerPayload = {
        name: payload.fullname || payload.company_name || payload.contact_person || 'New User',
        email,
        password,
        role,
      };

      const response = await fetch('/api/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(registerPayload)
      });
      const result = await response.json();
      if (response.ok) {
        window.location.href = result.user.role === 'employer' ? 'employer-dashboard.html' : 'worker-dashboard.html';
      } else {
        alert(result.message || 'Registration failed');
      }
    });
  });

  loadJobs();
  loadApplications();
  loadAdminOverview();
  loadAdminUsers();
  loadAdminJobs();
});
