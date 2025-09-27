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

      // NEW: Fees & Payments (concise, grounded in Agreement)
      await this.loadFeesInfo();

      // NEW: Atomic knowledge pack (concise Q/A facts from PDFs)
      await this.loadKoziKnowledgePack();

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

  // NEW: concise Fees & Payments seed from Agreement
  async loadFeesInfo() {
    const content = `
FEES & PAYMENTS (HOUSE CLEANER AGREEMENT – KOZI RWANDA)

• One-time administrative service fee: 40,000 RWF (non-refundable) – covers vetting/background checks, contract preparation, onboarding/orientation, and access to ongoing management/support.
• Salary flow: Client pays salary to Kozi; Kozi disburses to worker (no direct payment to worker).
• Payment deadline: Salary due on or before the agreed date each month.
• Invoice rule: Settle invoices within 3 calendar days; late fee 5% per week; legal recovery after 30 days (client bears recovery/legal costs).
• Replacement: One free replacement within the first 30 days for valid issues; beyond 30 days a new service fee may apply.
• Early termination by client: 5 days’ written notice; no refund of the one-time fee.
• Direct payment prohibition: Paying worker directly is a breach; damages = 3–6 months of salary plus legal/administrative costs.
• Payment methods (as listed in the agreement at time of writing): MoMo code 067788 (Account Name: SANSON GROUP); Bank of Kigali account 100185006268 (Account Name: SANSON GROUP).
    `.trim();

    await this.ragService.addKnowledgeDocument(
      'fees-house-cleaner-agreement',
      content,
      { type: 'policy', category: 'fees', source: 'agreement' }
    );
  }

  // NEW: Atomic knowledge snippets from PDFs
  async loadKoziKnowledgePack() {
    const koziKnowledgePack = [
      // Agreement-derived
      {
        id: 'salary-payment-terms-agreement',
        content:
          'Client pays salary to Kozi; Kozi disburses to the worker. Salary must be paid on or before the agreed monthly date (no direct payment to the worker).',
        metadata: { type: 'policy', category: 'payments', source: 'agreement' }
      },
      {
        id: 'invoice-deadline-and-penalties',
        content:
          'Invoices must be settled within 3 calendar days. Late fee: 5% of total invoice per week of delay. Non-payment beyond 30 days may trigger legal recovery; client bears recovery/legal costs.',
        metadata: { type: 'policy', category: 'payments', source: 'agreement' }
      },
      {
        id: 'direct-payment-prohibition-and-penalty',
        content:
          'Direct payment to the outsourced worker is prohibited. Breach penalty: damages equal to not less than 3 months and up to 6 months of the worker’s salary, plus legal/administrative costs.',
        metadata: { type: 'policy', category: 'compliance', source: 'agreement' }
      },
      {
        id: 'employment-scope-and-duties-housecleaner',
        content:
          'Scope (example duties for House Cleaner/House Manager): clean house, do laundry & ironing, organize and keep house in order. No additional duties without Kozi consultation.',
        metadata: { type: 'contract', category: 'duties', source: 'agreement' }
      },
      {
        id: 'employment-term-and-schedule',
        content:
          'Term: 6 months from signing. Public holidays and rest days respected unless pre-arranged. Example terms shown: Monday–Friday, 8:00–14:00; agreed salary example 60,000 RWF.',
        metadata: { type: 'contract', category: 'terms', source: 'agreement' }
      },
      {
        id: 'monitoring-and-check-ins',
        content:
          'Kozi performs regular follow-ups with worker and client; may visit the home or conduct phone check-ins to ensure service delivery and worker welfare.',
        metadata: { type: 'process', category: 'monitoring', source: 'agreement' }
      },
      {
        id: 'replacement-policy-window',
        content:
          'If valid issues arise, Kozi may offer one free replacement within the first 30 days. Beyond 30 days, a new service fee may apply. Replacement target ~5 business days.',
        metadata: { type: 'policy', category: 'replacement', source: 'agreement' }
      },
      {
        id: 'early-termination-no-refund',
        content:
          'Early termination by client: 5 days written notice required. No refund of the one-time service fee.',
        metadata: { type: 'policy', category: 'termination', source: 'agreement' }
      },
      {
        id: 'legal-support-policy',
        content:
          'In incidents involving theft, damage, or loss, Kozi provides worker registration info and documents to support legal proceedings; Kozi is not financially responsible for losses. Client should take security measures and report crimes to authorities.',
        metadata: { type: 'policy', category: 'legal-support', source: 'agreement' }
      },
      {
        id: 'payroll-management-obligation',
        content:
          'Client must create and maintain an account on Kozi’s platform for payroll management; workers are assigned to the client in-system; salary disbursement and records are managed on-platform for transparency.',
        metadata: { type: 'policy', category: 'platform', source: 'agreement' }
      },
      {
        id: 'confidentiality-and-privacy',
        content:
          'Both parties must keep personal, professional, and contractual information confidential; no disclosure to third parties without written consent.',
        metadata: { type: 'policy', category: 'privacy', source: 'agreement' }
      },
      {
        id: 'governing-law',
        content:
          'Governing law: Republic of Rwanda — Labour Law No. 66/2018 of 30/08/2018 and relevant Civil Code provisions.',
        metadata: { type: 'policy', category: 'legal', source: 'agreement' }
      },

      // Business profile-derived
      {
        id: 'kozi-about-mission-vision',
        content:
          'Kozi is a digital platform connecting employees with employers, founded in 2021. Mission: data-driven recruitment that is faster, fairer, and more reliable. Vision: seamless, modern hiring experiences.',
        metadata: { type: 'company_info', category: 'about', source: 'business_profile' }
      },
      {
        id: 'kozi-services-overview',
        content:
          'Kozi simplifies recruitment using smart, data-driven matching; improves communication; accelerates hiring for businesses and job seekers.',
        metadata: { type: 'company_info', category: 'services', source: 'business_profile' }
      },
      {
        id: 'beneficiaries-who-uses-kozi',
        content:
          'Who benefits: Employers seeking talent and efficient hiring; Job Seekers looking for opportunities matching skills/experience.',
        metadata: { type: 'company_info', category: 'audience', source: 'business_profile' }
      },
      {
        id: 'worker-categories-and-examples',
        content:
          'Worker categories: Advanced (e.g., graphic designer, accountant, chef, software developer, marketing expert) and Basic (e.g., professional cleaners, housemaids, babysitters, security guards, pool cleaners).',
        metadata: { type: 'jobs', category: 'categories', source: 'business_profile' }
      },
      {
        id: 'why-choose-kozi',
        content:
          'Why Kozi: user-friendly and efficient; fast, smart hiring; cost-effective; reliable support.',
        metadata: { type: 'company_info', category: 'value', source: 'business_profile' }
      },
      {
        id: 'kozi-contact-info',
        content:
          'Contact: (+250) 788 719 678 · info@kozi.rw · Kigali–Kacyiru, KG 647 St · www.kozi.rw',
        metadata: { type: 'contact_info', category: 'general', source: 'business_profile' }
      },

      // Worker guidelines-derived
      {
        id: 'industry-overview-domestic-services',
        content:
          'Kozi operates in domestic services (housekeeping, childcare, personal care). Urban demand is high; focus on fair employment and safety; tech platforms like Kozi enable growth.',
        metadata: { type: 'guidance', category: 'industry', source: 'worker_guidelines' }
      },
      {
        id: 'employment-and-payment-structure-guidelines',
        content:
          'Payments are handled by Kozi; workers receive salary from Kozi, not clients. Kozi may deduct ongoing management fees supporting placement, training, and support.',
        metadata: { type: 'guidance', category: 'payments', source: 'worker_guidelines' }
      },
      {
        id: 'professionalism-training-and-conduct',
        content:
          'Kozi offers regular training/workshops; expects punctuality, respect, proper use of resources (e.g., uniforms), and adherence to workplace rules to maintain professionalism.',
        metadata: { type: 'guidance', category: 'conduct', source: 'worker_guidelines' }
      },
      {
        id: 'worker-rights-and-safety',
        content:
          'Workers should report mistreatment/unsafe conditions to Kozi. Kozi prioritizes safety and compliance and supports workers to maintain a secure environment.',
        metadata: { type: 'guidance', category: 'safety', source: 'worker_guidelines' }
      },
      {
        id: 'benefits-of-joining-kozi',
        content:
          'Benefits groups: Employment (placement, income, flexibility, advancement); Development (training, professionalism, networking, feedback); Support & Safety (support, safety, management, community); Resources & Recognition (tools, transparency, client trust, recognition).',
        metadata: { type: 'guidance', category: 'benefits', source: 'worker_guidelines' }
      },
      {
        id: 'worker-guidelines-contacts',
        content:
          'Support: +250 788 719 678 · info@kozi.rw · www.kozi.rw · Office: Kacyiru–KG 647 St.',
        metadata: { type: 'contact_info', category: 'support', source: 'worker_guidelines' }
      }
    ];

    for (const item of koziKnowledgePack) {
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
