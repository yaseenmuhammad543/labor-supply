document.addEventListener('DOMContentLoaded', () => {
  const state = {
    jobs: [],
  };

  const searchButton = document.querySelector('.btn-search');
  const jobCards = Array.from(document.querySelectorAll('.job-card'));

  const setupLocationSelectors = () => {
    const stateSelect = document.querySelector('[data-state-select]');
    const districtSelect = document.querySelector('[data-district-select]');
    if (!stateSelect || !districtSelect || !window.INDIA_LOCATIONS) return;

    const states = Object.keys(window.INDIA_LOCATIONS).sort();
    stateSelect.innerHTML = '<option value="">Select state or union territory</option>' +
      states.map((state) => `<option value="${state}">${state}</option>`).join('');

    const updateDistricts = (selectedDistrict = '') => {
      const districts = window.INDIA_LOCATIONS[stateSelect.value] || [];
      districtSelect.innerHTML = '<option value="">Select district</option>' +
        districts.map((district) => `<option value="${district}">${district}</option>`).join('');
      if (districts.includes(selectedDistrict)) districtSelect.value = selectedDistrict;
    };

    stateSelect.addEventListener('change', () => updateDistricts());
    updateDistricts();
  };

  const setupLocationPermission = () => {
    const button = document.querySelector('[data-location-button]');
    if (!button) return;
    const status = document.querySelector('[data-location-status]');
    const latitude = document.querySelector('[data-latitude]');
    const longitude = document.querySelector('[data-longitude]');
    const source = document.querySelector('[data-location-source]');
    const locationInput = document.querySelector('[name="location"]');
    const stateSelect = document.querySelector('[data-state-select]');
    const districtSelect = document.querySelector('[data-district-select]');

    button.addEventListener('click', () => {
      if (!navigator.geolocation) {
        if (status) status.textContent = 'GPS is not available in this browser. Please choose your location manually.';
        return;
      }
      button.disabled = true;
      button.textContent = 'Requesting location...';
      if (status) status.textContent = 'Please allow location access in your browser.';
      navigator.geolocation.getCurrentPosition(async (position) => {
        latitude.value = position.coords.latitude;
        longitude.value = position.coords.longitude;
        source.value = 'gps';
        try {
          const response = await fetch(`https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${position.coords.latitude}&lon=${position.coords.longitude}&zoom=10`, {
            headers: { Accept: 'application/json' },
          });
          const result = await response.json();
          const address = result.address || {};
          const detectedState = address.state;
          const detectedDistrict = address.state_district || address.county || address.city_district;
          const detectedLocation = address.city || address.town || address.village || address.suburb;
          if (locationInput && detectedLocation) locationInput.value = detectedLocation;
          if (stateSelect && window.INDIA_LOCATIONS[detectedState]) {
            stateSelect.value = detectedState;
            stateSelect.dispatchEvent(new Event('change'));
            if (districtSelect && detectedDistrict) {
              const matchingDistrict = window.INDIA_LOCATIONS[detectedState].find((district) =>
                detectedDistrict.toLowerCase().includes(district.toLowerCase()) || district.toLowerCase().includes(detectedDistrict.toLowerCase()));
              if (matchingDistrict) districtSelect.value = matchingDistrict;
            }
          }
          if (status) status.textContent = `Location detected from GPS: ${detectedLocation || 'coordinates saved'}`;
        } catch (error) {
          if (status) status.textContent = 'GPS coordinates saved. Please confirm your state and district manually.';
        } finally {
          button.disabled = false;
          button.textContent = 'Update my current location';
        }
      }, () => {
        source.value = 'manual';
        button.disabled = false;
        button.textContent = 'Use my current location';
        if (status) status.textContent = 'Location permission was not granted. You can choose your location manually.';
      }, { enableHighAccuracy: true, timeout: 10000, maximumAge: 300000 });
    });
  };

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

  const adminLoginForm = document.querySelector('[data-admin-login-form]');
  if (adminLoginForm) {
    adminLoginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      const payload = Object.fromEntries(new FormData(adminLoginForm).entries());
      try {
        const result = await adminRequest('/admin/api/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        window.location.href = '/admin/admin-dashboard.html';
      } catch (error) {
        alert(error.message);
      }
    });
  }

  const loadAdminOverview = async () => {
    if (!document.querySelector('[data-admin-stat]')) return;
    try {
      const result = await adminRequest('/admin/api/overview');
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
      const result = await adminRequest('/admin/api/users');
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
            await adminRequest(`/admin/api/users/${button.dataset.userId}`, {
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
      const result = await adminRequest('/admin/api/jobs');
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
            await adminRequest(`/admin/api/jobs/${button.dataset.jobId}`, {
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
    const districtInput = document.getElementById('districtFilter');
    const stateInput = document.getElementById('stateFilter');

    if (!keywordInput || !locationInput || !qualificationInput || !skillInput) {
      return;
    }

    const keyword = keywordInput.value.trim().toLowerCase();
    const location = locationInput.value.trim().toLowerCase();
    const qualification = qualificationInput.value.trim().toLowerCase();
    const skill = skillInput.value.trim().toLowerCase();
    const district = districtInput?.value.trim().toLowerCase() || '';
    const selectedState = stateInput?.value.trim().toLowerCase() || '';

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
          (!skill || skillText.includes(skill)) &&
          (!district || locationText.includes(district)) &&
          (!selectedState || locationText.includes(selectedState));
        card.style.display = showCard ? 'block' : 'none';
      });
      return;
    }

    const filtered = state.jobs.filter((job) => {
      const title = (job.title || '').toLowerCase();
      const locationText = (job.location || '').toLowerCase();
      const skillsText = (job.skills || []).join(' ').toLowerCase();
      const qualificationText = (job.qualification || '').toLowerCase();
      const jobLocation = locationText;

      return (!keyword || title.includes(keyword) || skillsText.includes(keyword)) &&
        (!location || locationText.includes(location)) &&
        (!qualification || qualificationText.includes(qualification)) &&
        (!skill || skillsText.includes(skill)) &&
        (!district || jobLocation.includes(district)) &&
        (!selectedState || jobLocation.includes(selectedState));
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
      if (form === postJobForm || form === adminLoginForm) return;
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
  setupLocationSelectors();
  setupLocationPermission();
});
