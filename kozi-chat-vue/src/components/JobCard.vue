<template>
  <div class="job-card-container">
    <!-- Job Listings Display -->
    <div v-if="jobs.length > 0" class="jobs-list">
      <div 
        v-for="(job, index) in jobs" 
        :key="job.id"
        class="job-card"
        @click="selectJob(job)"
      >
        <!-- Job Number Badge -->
        <div class="job-number">
          <span>#{{ index + 1 }}</span>
        </div>

        <!-- Job Header -->
        <div class="job-header">
          <h3 class="job-title">{{ job.title }}</h3>
          <span :class="['job-status', job.work_type]">
            {{ formatWorkType(job.work_type) }}
          </span>
        </div>

        <!-- Job Details -->
        <div class="job-details">
          <div class="detail-row">
            <i class="fas fa-map-marker-alt"></i>
            <span>{{ job.location }}</span>
          </div>

          <div class="detail-row" v-if="job.salary_min && job.salary_max">
            <i class="fas fa-money-bill-wave"></i>
            <span>{{ formatSalary(job) }}</span>
          </div>

          <div class="detail-row">
            <i class="fas fa-users"></i>
            <span>{{ job.positions_available - job.positions_filled }} positions</span>
          </div>

          <div class="detail-row" v-if="job.application_deadline">
            <i class="fas fa-clock"></i>
            <span>Deadline: {{ formatDate(job.application_deadline) }}</span>
          </div>
        </div>

        <!-- Job Category Tag -->
        <div class="job-footer">
          <span class="job-category">
            <i class="fas fa-tag"></i>
            {{ job.category }}
          </span>
          
          <button 
            class="apply-btn"
            @click.stop="applyToJob(job)"
          >
            <i class="fas fa-paper-plane"></i>
            Apply
          </button>
        </div>
      </div>
    </div>

    <!-- Empty State -->
    <div v-else class="no-jobs">
      <i class="fas fa-briefcase"></i>
      <p>No jobs available at the moment</p>
    </div>

    <!-- Job Detail Modal (optional) -->
    <div v-if="selectedJob" class="job-modal-overlay" @click="closeModal">
      <div class="job-modal" @click.stop>
        <button class="close-modal" @click="closeModal">
          <i class="fas fa-times"></i>
        </button>

        <div class="modal-content">
          <h2>{{ selectedJob.title }}</h2>
          
          <div class="modal-details">
            <div class="detail-item">
              <strong>Location:</strong> {{ selectedJob.location }}
            </div>
            <div class="detail-item">
              <strong>Type:</strong> {{ formatWorkType(selectedJob.work_type) }}
            </div>
            <div class="detail-item" v-if="selectedJob.salary_min">
              <strong>Salary:</strong> {{ formatSalary(selectedJob) }}
            </div>
            <div class="detail-item">
              <strong>Experience:</strong> {{ selectedJob.experience_level }}
            </div>
          </div>

          <div class="modal-description">
            <h3>Description</h3>
            <p>{{ selectedJob.description }}</p>
          </div>

          <div class="modal-requirements" v-if="selectedJob.requirements">
            <h3>Requirements</h3>
            <p>{{ selectedJob.requirements }}</p>
          </div>

          <button class="modal-apply-btn" @click="applyToJob(selectedJob)">
            <i class="fas fa-paper-plane"></i>
            Apply Now
          </button>
        </div>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref } from 'vue'

// Props
const props = defineProps({
  jobs: {
    type: Array,
    default: () => []
  }
})

// Emit events
const emit = defineEmits(['apply-job', 'view-job'])

// State
const selectedJob = ref(null)

// Methods
const formatWorkType = (type) => {
  const types = {
    'full-time': 'Full-Time',
    'part-time': 'Part-Time',
    'contract': 'Contract',
    'temporary': 'Temporary'
  }
  return types[type] || type
}

const formatSalary = (job) => {
  const min = parseInt(job.salary_min).toLocaleString()
  const max = parseInt(job.salary_max).toLocaleString()
  return `${min} - ${max} ${job.salary_currency || 'RWF'}`
}

const formatDate = (dateString) => {
  return new Date(dateString).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  })
}

const selectJob = (job) => {
  selectedJob.value = job
  emit('view-job', job)
}

const closeModal = () => {
  selectedJob.value = null
}

const applyToJob = (job) => {
  emit('apply-job', job)
  closeModal()
}
</script>

<style scoped>
/* Job Cards Container */
.jobs-list {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(320px, 1fr));
  gap: var(--space-4);
  padding: var(--space-4) 0;
  width: 100%;
}

/* Individual Job Card */
.job-card {
  background: white;
  border: 1px solid var(--gray-200);
  border-radius: var(--radius-xl);
  padding: var(--space-5);
  cursor: pointer;
  transition: all var(--transition-normal);
  position: relative;
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
  box-shadow: var(--shadow-sm);
}

.job-card:hover {
  transform: translateY(-4px);
  box-shadow: var(--shadow-lg);
  border-color: var(--primary-300);
}

/* Job Number Badge */
.job-number {
  position: absolute;
  top: var(--space-3);
  right: var(--space-3);
  background: var(--primary-100);
  color: var(--primary-700);
  font-weight: 700;
  font-size: var(--font-size-sm);
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-full);
}

/* Job Header */
.job-header {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
  padding-right: var(--space-8);
}

.job-title {
  font-size: var(--font-size-lg);
  font-weight: 700;
  color: var(--gray-900);
  line-height: 1.3;
  margin: 0;
}

.job-status {
  display: inline-block;
  padding: var(--space-1) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--font-size-xs);
  font-weight: 600;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}

.job-status.full-time {
  background: #e0f2fe;
  color: #0369a1;
}

.job-status.part-time {
  background: #fef3c7;
  color: #b45309;
}

.job-status.contract {
  background: #f3e8ff;
  color: #7e22ce;
}

/* Job Details */
.job-details {
  display: flex;
  flex-direction: column;
  gap: var(--space-2);
}

.detail-row {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--gray-600);
}

.detail-row i {
  width: 16px;
  color: var(--primary-500);
}

/* Job Footer */
.job-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-top: var(--space-2);
  padding-top: var(--space-3);
  border-top: 1px solid var(--gray-200);
}

.job-category {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--font-size-sm);
  color: var(--gray-600);
  font-weight: 500;
}

.apply-btn {
  background: var(--primary-600);
  color: white;
  border: none;
  padding: var(--space-2) var(--space-4);
  border-radius: var(--radius-lg);
  font-size: var(--font-size-sm);
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  gap: var(--space-2);
  transition: all var(--transition-fast);
}

.apply-btn:hover {
  background: var(--primary-700);
  transform: scale(1.05);
}

/* Empty State */
.no-jobs {
  text-align: center;
  padding: var(--space-16);
  color: var(--gray-400);
}

.no-jobs i {
  font-size: var(--font-size-4xl);
  margin-bottom: var(--space-4);
  display: block;
}

/* Modal */
.job-modal-overlay {
  position: fixed;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background: rgba(0, 0, 0, 0.5);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 1000;
  padding: var(--space-4);
}

.job-modal {
  background: white;
  border-radius: var(--radius-2xl);
  max-width: 600px;
  width: 100%;
  max-height: 90vh;
  overflow-y: auto;
  position: relative;
  box-shadow: var(--shadow-xl);
}

.close-modal {
  position: absolute;
  top: var(--space-4);
  right: var(--space-4);
  background: var(--gray-100);
  border: none;
  width: 32px;
  height: 32px;
  border-radius: var(--radius-full);
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: all var(--transition-fast);
}

.close-modal:hover {
  background: var(--gray-200);
}

.modal-content {
  padding: var(--space-8);
}

.modal-content h2 {
  margin: 0 0 var(--space-4) 0;
  color: var(--gray-900);
  padding-right: var(--space-8);
}

.modal-details {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: var(--space-3);
  margin-bottom: var(--space-6);
}

.detail-item {
  font-size: var(--font-size-sm);
}

.detail-item strong {
  color: var(--gray-700);
  display: block;
  margin-bottom: var(--space-1);
}

.modal-description,
.modal-requirements {
  margin-bottom: var(--space-6);
}

.modal-description h3,
.modal-requirements h3 {
  font-size: var(--font-size-lg);
  margin: 0 0 var(--space-3) 0;
  color: var(--gray-900);
}

.modal-description p,
.modal-requirements p {
  color: var(--gray-600);
  line-height: 1.6;
  margin: 0;
}

.modal-apply-btn {
  width: 100%;
  background: var(--primary-600);
  color: white;
  border: none;
  padding: var(--space-4);
  border-radius: var(--radius-xl);
  font-size: var(--font-size-base);
  font-weight: 600;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: var(--space-2);
  transition: all var(--transition-fast);
}

.modal-apply-btn:hover {
  background: var(--primary-700);
  transform: translateY(-2px);
  box-shadow: var(--shadow-lg);
}

/* Dark Theme */
body.dark .job-card {
  background: #1a1a1a;
  border-color: #2a2a2a;
}

body.dark .job-card:hover {
  border-color: var(--primary-600);
}

body.dark .job-title {
  color: #ffffff;
}

body.dark .detail-row {
  color: #cccccc;
}

body.dark .job-category {
  color: #cccccc;
}

body.dark .job-footer {
  border-top-color: #2a2a2a;
}

body.dark .job-modal {
  background: #1a1a1a;
}

body.dark .modal-content h2,
body.dark .modal-description h3,
body.dark .modal-requirements h3 {
  color: #ffffff;
}

body.dark .modal-description p,
body.dark .modal-requirements p {
  color: #cccccc;
}

body.dark .close-modal {
  background: #2a2a2a;
  color: #ffffff;
}

body.dark .close-modal:hover {
  background: #3a3a3a;
}

/* Responsive */
@media (max-width: 768px) {
  .jobs-list {
    grid-template-columns: 1fr;
  }

  .modal-details {
    grid-template-columns: 1fr;
  }
}
</style>