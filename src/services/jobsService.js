// src/services/jobsService.js
// Fetch jobs from external API and normalize to your JobCard shape.

const DEFAULT_CURRENCY = 'RWF';

/**
 * Normalize one raw job object from external API to your internal shape.
 * Tweak mappings if their fields are different.
 */
function normalizeJob(raw) {
  if (!raw || typeof raw !== 'object') return null;

  // Try common field names; adjust these if their JSON differs
  const j = {
    id: raw.id ?? raw.job_id ?? raw.ID ?? null,
    title: raw.title ?? raw.job_title ?? raw.position ?? 'Untitled',
    category: raw.category ?? raw.job_category ?? raw.function ?? 'General',
    description: raw.description ?? raw.job_description ?? raw.details ?? '',
    requirements: raw.requirements ?? raw.requirement ?? '',
    salary_min: numOrNull(raw.salary_min ?? raw.min_salary),
    salary_max: numOrNull(raw.salary_max ?? raw.max_salary),
    salary_currency: raw.salary_currency || DEFAULT_CURRENCY,
    location: raw.location ?? raw.city ?? raw.district ?? raw.area ?? 'Kigali',
    work_type: raw.work_type ?? raw.employment_type ?? 'full-time',
    experience_level: raw.experience_level ?? raw.level ?? 'entry',
    education_level: raw.education_level ?? raw.education ?? null,
    status: (raw.status ?? 'active') || 'active',
    positions_available: intOrNull(raw.positions_available ?? raw.slots ?? 1),
    positions_filled: intOrNull(raw.positions_filled ?? 0),
    posted_date: dateOrNull(raw.posted_date ?? raw.created_at ?? raw.date_posted),
    application_deadline: dateOrNull(raw.application_deadline ?? raw.deadline),
    start_date: dateOrNull(raw.start_date),
    views: intOrNull(raw.views ?? 0),
    applications_count: intOrNull(raw.applications_count ?? 0),
  };

  // ensure id exists
  if (j.id == null) return null;
  return j;
}

function numOrNull(v) {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}
function intOrNull(v) {
  const n = parseInt(v, 10);
  return Number.isFinite(n) ? n : null;
}
function dateOrNull(v) {
  if (!v) return null;
  const d = new Date(v);
  return isNaN(d.getTime()) ? null : d.toISOString().slice(0, 10); // YYYY-MM-DD
}

/**
 * Fetch external jobs. Optionally pass filters to apply client-side.
 */
async function fetchExternalJobs(filters = {}) {
  const url = process.env.JOBS_API_URL;
  if (!url) throw new Error('JOBS_API_URL is not set');

  // Node 18+ has global fetch
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 15000);

  let raw;
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) {
      throw new Error(`External jobs API failed: ${res.status} ${res.statusText}`);
    }
    raw = await res.json();
  } finally {
    clearTimeout(timeout);
  }

  // Some APIs return {data:[...]} — handle both
  const list = Array.isArray(raw) ? raw : Array.isArray(raw?.data) ? raw.data : [];

  // Normalize + filter
  let jobs = list.map(normalizeJob).filter(Boolean);

  // Optional lightweight filtering on our side
  if (filters.status) jobs = jobs.filter(j => (j.status || '').toLowerCase() === String(filters.status).toLowerCase());
  if (filters.category) jobs = jobs.filter(j => (j.category || '').toLowerCase() === String(filters.category).toLowerCase());
  if (filters.location) jobs = jobs.filter(j => (j.location || '').toLowerCase().includes(String(filters.location).toLowerCase()));

  // Sort newest first if posted_date exists
  jobs.sort((a, b) => String(b.posted_date || '').localeCompare(String(a.posted_date || '')));

  return jobs;
}

module.exports = {
  fetchExternalJobs,
  normalizeJob,
};
