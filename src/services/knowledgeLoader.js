const path = require('path');
const fs = require('fs');
const RAGService = require('./ragService');
const logger = require('../core/utils/logger');

class KnowledgeLoader {
  constructor() {
    this.ragService = new RAGService();
  }

  async initialize() {
    await this.ragService.initialize();
  }

  async loadKoziKnowledge() {
    try {
      await this.initialize();

      // Core Kozi Information
      await this.loadCoreInfo();

      // Profile Completion Guidance
      await this.loadProfileGuidance();

      // Job Application Process
      await this.loadJobApplicationInfo();

      // CV Writing Guidance
      await this.loadCVGuidance();

      // Document Upload Process
      await this.loadDocumentInfo();

      // Contract and Legal Information (seeded text)
      await this.loadContractInfo();

      // NEW: Index local PDFs placed under data/docs
      await this.loadLocalDocuments();

      logger.info('Kozi knowledge base loaded successfully');
      return true;
    } catch (error) {
      logger.error('Failed to load knowledge base', { error: error.message });
      throw error;
    }
  }

  async loadCoreInfo() {
    const coreInfo = [
      {
        id: 'kozi-about',
        content: `Kozi is an innovative digital platform that connects employees with employers in Rwanda. Founded in 2021, Kozi operates in the domestic services industry, specifically within housekeeping and personal care services. The platform serves businesses of all sizes across multiple industries with a commitment to transparency and efficiency.`,
        metadata: { type: 'company_info', category: 'about' }
      },
      {
        id: 'kozi-mission',
        content: `Kozi's mission is to bridge the gap between employers and job seekers by providing a smart, data-driven recruitment platform that ensures a faster, fairer, and more reliable hiring process.`,
        metadata: { type: 'company_info', category: 'mission' }
      },
      {
        id: 'kozi-contact',
        content: `Contact Kozi: Phone: +250 788 719 678, Email: info@kozi.rw, Address: Kigali-Kacyiru, KG 647 St. Website: www.kozi.rw. For support, contact support@kozi.rw`,
        metadata: { type: 'contact_info', category: 'support' }
      }
    ];

    for (const item of coreInfo) {
      await this.ragService.addKnowledgeDocument(item.id, item.content, item.metadata);
    }
  }

  async loadProfileGuidance() {
    const profileGuidance = [
      {
        id: 'profile-completion',
        content: `To complete your Kozi profile: 1) Add personal information (full name, phone, location), 2) Select job category and experience level, 3) Upload required documents (CV and ID card), 4) Add profile photo (optional), 5) Complete skills and work experience sections. Profile completion increases your visibility with employers.`,
        metadata: { type: 'guidance', category: 'profile' }
      },
      {
        id: 'profile-benefits',
        content: `Completing your profile gives you: Job placement opportunities, steady income potential, flexible work options, career advancement, professional development, training opportunities, safety and protection, management support. A complete profile boosts your chances of being hired.`,
        metadata: { type: 'guidance', category: 'benefits' }
      },
      {
        id: 'required-documents',
        content: `Required documents for Kozi registration: 1) CV (PDF, DOC, or DOCX format, max 5MB), 2) National ID card (JPG, PNG, or PDF, max 2MB), 3) Profile photo (JPG or PNG, max 1MB, optional but recommended). All documents help verify your identity and qualifications.`,
        metadata: { type: 'guidance', category: 'documents' }
      }
    ];

    for (const item of profileGuidance) {
      await this.ragService.addKnowledgeDocument(item.id, item.content, item.metadata);
    }
  }

  async loadJobApplicationInfo() {
    const jobInfo = [
      {
        id: 'job-categories',
        content: `Kozi offers two main job categories: Advanced Workers (graphic designers, accountants, professional chefs, software developers, marketing experts) and Basic Workers (professional cleaners, housemaids, babysitters, security guards, pool cleaners). Choose the category that matches your skills and experience.`,
        metadata: { type: 'jobs', category: 'categories' }
      },
      {
        id: 'application-process',
        content: `Job application process on Kozi: 1) Register and complete your profile, 2) Pay registration fees if required, 3) Fill in all information completely, 4) Apply to published jobs matching your skills, 5) Wait for employer selection, 6) Get hired through Kozi's managed process.`,
        metadata: { type: 'jobs', category: 'process' }
      }
    ];

    for (const item of jobInfo) {
      await this.ragService.addKnowledgeDocument(item.id, item.content, item.metadata);
    }
  }

  async loadCVGuidance() {
    const cvGuidance = [
      {
        id: 'cv-structure',
        content: `Professional CV structure: 1) Contact Information (name, phone, email, location), 2) Professional Summary (2-3 lines about skills and goals), 3) Work Experience (past jobs with achievements), 4) Education (highest level first), 5) Skills (relevant to job category), 6) Certifications/Training, 7) Languages. Keep it clear, short, and targeted to the job.`,
        metadata: { type: 'guidance', category: 'cv' }
      },
      {
        id: 'cv-tips',
        content: `CV writing tips: Use action verbs, quantify achievements with numbers, keep it relevant to your job category, use clear formatting, avoid spelling errors, include only recent work experience (last 5-10 years), highlight skills that match job requirements. A good CV increases your hiring chances significantly.`,
        metadata: { type: 'guidance', category: 'cv' }
      }
    ];

    for (const item of cvGuidance) {
      await this.ragService.addKnowledgeDocument(item.id, item.content, item.metadata);
    }
  }

  async loadDocumentInfo() {
    const docInfo = [
      {
        id: 'upload-process',
        content: `Document upload process: 1) Go to your profile page, 2) Click on document upload section, 3) Select CV file (required), 4) Upload ID card photo or scan (required), 5) Add profile photo (optional), 6) Verify all uploads are successful. Documents are reviewed by Kozi team for verification.`,
        metadata: { type: 'process', category: 'documents' }
      },
      {
        id: 'upload-requirements',
        content: `Upload requirements: CV files must be PDF, DOC, or DOCX under 5MB. ID cards must be JPG, PNG, or PDF under 2MB. Profile photos must be JPG or PNG under 1MB. Ensure documents are clear, readable, and contain accurate information matching your profile details.`,
        metadata: { type: 'requirements', category: 'documents' }
      }
    ];

    for (const item of docInfo) {
      await this.ragService.addKnowledgeDocument(item.id, item.content, item.metadata);
    }
  }

  async loadContractInfo() {
    const contractInfo = [
      {
        id: 'kozi-management',
        content: `Kozi manages worker employment: All payments go through Kozi (not direct to client), Kozi takes 10% management fee transparently, Workers receive training and ongoing support, Contract duration is typically 6 months, Replacement guarantee within first 30 days if issues arise.`,
        metadata: { type: 'contract', category: 'management' }
      },
      {
        id: 'worker-benefits',
        content: `Worker benefits with Kozi: Job security and steady income, Professional development and training, Safety and worker protection, Management support and check-ins, Legal support documentation when needed, Community support network, Career advancement opportunities.`,
        metadata: { type: 'contract', category: 'benefits' }
      },
      {
        id: 'legal-support',
        content: `Kozi legal support policy: In case of incidents involving theft, damage, or loss of property, Kozi provides worker's full registration information, background details, and documents for legal proceedings. However, Kozi is not financially responsible for worker actions - clients must take security measures and report criminal matters to authorities.`,
        metadata: { type: 'contract', category: 'legal' }
      }
    ];

    for (const item of contractInfo) {
      await this.ragService.addKnowledgeDocument(item.id, item.content, item.metadata);
    }
  }

  // NEW: scan data/docs and index PDFs
  async loadLocalDocuments() {
    const docsDir = path.join(process.cwd(), 'data', 'docs');
    if (!fs.existsSync(docsDir)) {
      logger.info('knowledge-loader: no local docs folder found', { docsDir });
      return;
    }

    const files = fs.readdirSync(docsDir).filter(f => f.toLowerCase().endsWith('.pdf'));
    if (!files.length) {
      logger.info('knowledge-loader: no PDFs found in docs folder', { docsDir });
      return;
    }

    for (const filename of files) {
      const abs = path.join(docsDir, filename);
      try {
        await this.ragService.indexFile(abs, {
          source: 'pdf',
          tags: this._tagsFor(filename)
        });
        logger.info('Knowledge document added', { id: filename, type: 'pdf' });
      } catch (e) {
        logger.error('Failed to index PDF', { file: filename, error: e.message });
      }
    }
  }

  _tagsFor(filename) {
    const f = filename.toLowerCase();
    if (f.includes('agreement')) return ['contract', 'house cleaner', 'fees', 'payment', 'terms'];
    if (f.includes('request')) return ['job provider', 'form', 'requirements', 'fees'];
    if (f.includes('guidelines')) return ['worker', 'guidelines', 'conduct', 'benefits', 'process'];
    if (f.includes('business profile')) return ['company', 'about', 'services', 'contact'];
    return [];
  }
}

module.exports = KnowledgeLoader;
