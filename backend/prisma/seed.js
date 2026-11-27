import { disconnectDatabase, prisma } from '../src/config/prisma.js'
import { hashPassword } from '../src/utils/auth.js'

function daysFromNow(days) {
  const date = new Date()
  date.setUTCDate(date.getUTCDate() + days)
  return date
}

const AUTHENTIC_OPPORTUNITIES = [
  {
    title: 'SSC CGL 2026-27 Tier-I',
    description:
      'Combined Graduate Level Examination (Tier-I) for recruitment to Group B and Group C non-technical and gazetted posts across ministries, departments, and organizations of the Government of India.',
    category: 'GOVT_EXAM',
    eligibility: "Bachelor's Degree from a recognized University or equivalent. Age: 18-32 years depending on post.",
    educationLevels: ['Graduation', "Bachelor's Degree"],
    eligibleStates: ['All India'],
    applicationStartDate: daysFromNow(-5),
    applicationDeadline: daysFromNow(45),
    requiredDocuments: ['Degree Certificate / Provisional Marksheet', 'Government Photo ID (Aadhaar/PAN)', 'Recent Passport Size Photograph', 'Signature Specimen'],
    applicationProcedure:
      'Apply online at https://ssc.gov.in using One-Time Registration (OTR). Fill out examination preferences and upload photograph and signature as per official guidelines.',
    officialSourceUrl: 'https://ssc.gov.in',
    sourceName: 'Staff Selection Commission (GoI)',
    verificationStatus: 'VERIFIED',
    lastVerifiedAt: daysFromNow(0),
    status: 'OPEN',
  },
  {
    title: 'UPSC Civil Services Examination (CSE) 2027',
    description:
      'National competitive examination conducted by Union Public Service Commission for recruitment to Indian Administrative Service (IAS), Indian Police Service (IPS), and Indian Foreign Service (IFS).',
    category: 'GOVT_EXAM',
    eligibility: 'Bachelor\'s Degree in any discipline from a recognized University. Age: 21-32 years (age relaxation for reserved categories).',
    educationLevels: ['Graduation', "Bachelor's Degree"],
    eligibleStates: ['All India'],
    applicationStartDate: daysFromNow(-10),
    applicationDeadline: daysFromNow(30),
    requiredDocuments: ['Degree Certificate', 'Aadhaar / Voter ID', 'Category Certificate (if applicable)'],
    applicationProcedure:
      'Candidates must complete One Time Registration (OTR) on upsconline.nic.in and submit the online application form before the closing deadline.',
    officialSourceUrl: 'https://upsc.gov.in',
    sourceName: 'Union Public Service Commission (UPSC)',
    verificationStatus: 'VERIFIED',
    lastVerifiedAt: daysFromNow(0),
    status: 'OPEN',
  },
  {
    title: 'TNPSC Combined Civil Services (Group II / IIA)',
    description:
      'Recruitment examination conducted by Tamil Nadu Public Service Commission for executive and non-executive posts including Municipal Commissioner, Sub-Registrar, Revenue Inspector, and Assistant Section Officer.',
    category: 'GOVT_EXAM',
    eligibility: 'Any degree from a recognized University. Tamil Nadu domicile preferred; knowledge of Tamil language required.',
    educationLevels: ['Graduation', "Bachelor's Degree"],
    eligibleStates: ['Tamil Nadu'],
    applicationStartDate: daysFromNow(-8),
    applicationDeadline: daysFromNow(22),
    requiredDocuments: ['Degree Certificate / Provisional Marksheet', 'SSLC & HSC Marksheets', 'Community Certificate (Tamil Nadu)'],
    applicationProcedure:
      'Apply online through TNPSC portal at https://www.tnpsc.gov.in via One Time Registration (OTR).',
    officialSourceUrl: 'https://www.tnpsc.gov.in',
    sourceName: 'Tamil Nadu Public Service Commission',
    verificationStatus: 'VERIFIED',
    lastVerifiedAt: daysFromNow(0),
    status: 'OPEN',
  },
  {
    title: 'IBPS Probationary Officer (CRP PO/MT)',
    description:
      'Common Recruitment Process for selection of Probationary Officers / Management Trainees across 11 participating Public Sector Commercial Banks in India.',
    category: 'GOVT_EXAM',
    eligibility: 'A Degree (Graduation) in any discipline from a recognized University. Age: 20-30 years.',
    educationLevels: ['Graduation', "Bachelor's Degree"],
    eligibleStates: ['All India'],
    applicationStartDate: daysFromNow(-2),
    applicationDeadline: daysFromNow(28),
    requiredDocuments: ['Graduation Degree Certificate', 'Photo and Signature', 'Left Thumb Impression', 'Handwritten Declaration'],
    applicationProcedure:
      'Register and apply online at https://ibps.in. Pay examination fees and save registration confirmation slip.',
    officialSourceUrl: 'https://ibps.in',
    sourceName: 'Institute of Banking Personnel Selection',
    verificationStatus: 'VERIFIED',
    lastVerifiedAt: daysFromNow(0),
    status: 'OPEN',
  },
  {
    title: 'Railway Recruitment Board (RRB NTPC)',
    description:
      'Centralized recruitment for Non-Technical Popular Categories including Station Master, Goods Train Manager, Senior Commercial cum Ticket Clerk, and Accounts Assistant.',
    category: 'GOVT_EXAM',
    eligibility: '12th Pass or Bachelor\'s Degree depending on specific post level. Age: 18-33 years.',
    educationLevels: ['12th Pass', 'Graduation'],
    eligibleStates: ['All India'],
    applicationStartDate: daysFromNow(-15),
    applicationDeadline: daysFromNow(35),
    requiredDocuments: ['10th / 12th / Degree Certificate', 'Caste Certificate (SC/ST/OBC)', 'Passport Photograph'],
    applicationProcedure:
      'Apply online through designated RRB regional websites (e.g. https://indianrailways.gov.in/).',
    officialSourceUrl: 'https://indianrailways.gov.in/',
    sourceName: 'Ministry of Railways (Railway Recruitment Boards)',
    verificationStatus: 'VERIFIED',
    lastVerifiedAt: daysFromNow(0),
    status: 'OPEN',
  },
  {
    title: 'National Scholarship Portal (NSP) Central Sector Scheme',
    description:
      'Ministry of Education scholarship scheme for meritorious college and university students belonging to low-income families to meet day-to-day college expenses.',
    category: 'SCHOLARSHIP',
    eligibility: 'Students scoring above 80th percentile in Class 12 board examination pursuing regular degree courses with family income ≤ ₹4.5 Lakh per annum.',
    educationLevels: ['Undergraduate', 'Postgraduate'],
    eligibleStates: ['All India'],
    applicationStartDate: daysFromNow(-20),
    applicationDeadline: daysFromNow(40),
    requiredDocuments: ['Class 12 Marksheet', 'Income Certificate', 'Bank Passbook Copy', 'Bonafide Student Certificate'],
    applicationProcedure:
      'Apply through National Scholarship Portal at https://scholarships.gov.in. Verification required by respective educational institution.',
    officialSourceUrl: 'https://scholarships.gov.in',
    sourceName: 'Ministry of Education (Government of India)',
    verificationStatus: 'VERIFIED',
    lastVerifiedAt: daysFromNow(0),
    status: 'OPEN',
  },
  {
    title: 'AICTE Pragati Scholarship for Girls',
    description:
      'All India Council for Technical Education scholarship scheme providing ₹50,000 per annum to empower female students pursuing technical degree or diploma courses.',
    category: 'SCHOLARSHIP',
    eligibility: 'Female students admitted to 1st year of technical degree/diploma program with family annual income less than ₹8 Lakh.',
    educationLevels: ['Diploma', 'Undergraduate (B.E./B.Tech)'],
    eligibleStates: ['All India'],
    applicationStartDate: daysFromNow(-14),
    applicationDeadline: daysFromNow(32),
    requiredDocuments: ['Tuition Fee Receipt', 'Income Certificate (<8 LPA)', 'Class 10/12 Marksheet', 'College Admission Letter'],
    applicationProcedure:
      'Apply through National Scholarship Portal (NSP) under AICTE schemes section at https://scholarships.gov.in or https://aicte.gov.in/.',
    officialSourceUrl: 'https://aicte.gov.in/',
    sourceName: 'All India Council for Technical Education (AICTE)',
    verificationStatus: 'VERIFIED',
    lastVerifiedAt: daysFromNow(0),
    status: 'OPEN',
  },
  {
    title: 'National Overseas Scholarship (NOS)',
    description:
      'Central sector financial assistance scheme for meritorious Indian students to pursue Master\'s degree and Ph.D. level courses in top international universities abroad.',
    category: 'SCHOLARSHIP',
    eligibility: 'SC/ST and traditional artisan community students with minimum 60% marks in qualifying degree. Annual family income < ₹8 Lakh.',
    educationLevels: ["Postgraduate (Master's)", 'Doctorate (Ph.D.)'],
    eligibleStates: ['All India'],
    applicationStartDate: daysFromNow(-5),
    applicationDeadline: daysFromNow(50),
    requiredDocuments: ['Unconditional Offer Letter from Top 500 QS World Ranked University', 'Caste Certificate', 'Income Certificate', 'Degree Certificate & Marksheets'],
    applicationProcedure:
      'Submit application online via portal https://www.dosje.gov.in/schemes-and-services/central-sector-scheme-of-national-overseas-scholarship/ along with foreign university unconditional offer letter.',
    officialSourceUrl: 'https://www.dosje.gov.in/schemes-and-services/central-sector-scheme-of-national-overseas-scholarship/',
    sourceName: 'Ministry of Social Justice & Empowerment',
    verificationStatus: 'VERIFIED',
    lastVerifiedAt: daysFromNow(0),
    status: 'OPEN',
  },
  {
    title: 'ISRO Summer Research & Young Scientist Internship',
    description:
      'Indian Space Research Organisation student internship and research training program at centers across India (VSSC, URSC, SAC, NRSC) in space technology and computing.',
    category: 'INTERNSHIP',
    eligibility: 'Regular B.E./B.Tech (3rd or 4th year) or M.Sc/M.Tech students in STEM disciplines with minimum 60% or 6.5 CGPA.',
    educationLevels: ['Undergraduate', 'Postgraduate'],
    eligibleStates: ['All India'],
    applicationStartDate: daysFromNow(-7),
    applicationDeadline: daysFromNow(25),
    requiredDocuments: ['Recommendation Letter from Head of Department / Principal', 'All Semesters Consolidated Marksheet', 'Curriculum Vitae (CV)'],
    applicationProcedure:
      'Apply online at official ISRO careers/internship portal https://www.isro.gov.in with recommendation letter from Head of Department.',
    officialSourceUrl: 'https://www.isro.gov.in',
    sourceName: 'Indian Space Research Organisation (ISRO)',
    verificationStatus: 'VERIFIED',
    lastVerifiedAt: daysFromNow(0),
    status: 'OPEN',
  },
  {
    title: 'NITI Aayog Policy & Research Internship Scheme',
    description:
      'Government of India premier policy internship exposing students to public policy formulation, governance analysis, and national developmental initiatives.',
    category: 'INTERNSHIP',
    eligibility: 'Undergraduate students (completed 2nd year with ≥85% in 12th) or Postgraduate/Research scholars with minimum 70% marks.',
    educationLevels: ['Undergraduate', 'Postgraduate', 'Ph.D.'],
    eligibleStates: ['All India'],
    applicationStartDate: daysFromNow(-3),
    applicationDeadline: daysFromNow(38),
    requiredDocuments: ['NOC from Educational Institution', 'Resume / Academic CV', 'Statement of Purpose (SOP)'],
    applicationProcedure:
      'Applications open online on the 1st to 10th of every month at https://www.niti.gov.in.',
    officialSourceUrl: 'https://www.niti.gov.in',
    sourceName: 'NITI Aayog (Government of India)',
    verificationStatus: 'VERIFIED',
    lastVerifiedAt: daysFromNow(0),
    status: 'OPEN',
  },
  {
    title: 'RBI Summer Internship Program',
    description:
      'Reserve Bank of India annual summer placement for bright students to work on macroeconomic research, financial regulation, and monetary analysis.',
    category: 'INTERNSHIP',
    eligibility: 'Postgraduate students or students pursuing 5-year integrated courses in Economics, Finance, Management, Law, or Data Science.',
    educationLevels: ['Postgraduate', 'Integrated Degree'],
    eligibleStates: ['All India'],
    applicationStartDate: daysFromNow(-12),
    applicationDeadline: daysFromNow(20),
    requiredDocuments: ['Curriculum Vitae', 'Letter of Recommendation from Dean / Professor', 'Academic Transcripts'],
    applicationProcedure:
      'Apply online at https://opportunities.rbi.org.in. Shortlisted candidates are interviewed across RBI regional offices.',
    officialSourceUrl: 'https://opportunities.rbi.org.in',
    sourceName: 'Reserve Bank of India',
    verificationStatus: 'VERIFIED',
    lastVerifiedAt: daysFromNow(0),
    status: 'OPEN',
  },
  {
    title: 'GATE (Graduate Aptitude Test in Engineering) Admit Card & Exam',
    description:
      'National level examination for admission to Master\'s and Direct Doctoral programs in Engineering/Technology and direct recruitment into top Maharatna & Navratna PSUs.',
    category: 'ADMIT_CARD',
    eligibility: 'Currently studying in 3rd or higher year of undergraduate engineering or already completed degree in Engineering/Technology/Science.',
    educationLevels: ['Undergraduate', 'Graduation'],
    eligibleStates: ['All India'],
    applicationStartDate: daysFromNow(-4),
    applicationDeadline: daysFromNow(18),
    requiredDocuments: ['Enrollment ID & Password', 'Valid Photo ID as declared during application'],
    applicationProcedure:
      'Download hall ticket/admit card from official GATE Online Application Processing System (GOAPS) using enrollment ID and password.',
    officialSourceUrl: 'https://gate2025.iitr.ac.in/',
    sourceName: 'GATE Organizing Institute / IIT Roorkee',
    verificationStatus: 'VERIFIED',
    lastVerifiedAt: daysFromNow(0),
    status: 'OPEN',
  },
  {
    title: 'UPSC Civil Services Prelims Result & Scorecard',
    description:
      'Declaration of official list of candidates qualified for Civil Services (Main) Examination along with category-wise cutoff marks and scorecards.',
    category: 'RESULT',
    eligibility: 'Candidates who appeared for the Civil Services Preliminary Examination.',
    educationLevels: ['Graduation'],
    eligibleStates: ['All India'],
    applicationStartDate: daysFromNow(-1),
    applicationDeadline: daysFromNow(29),
    requiredDocuments: ['UPSC Roll Number', 'Date of Birth credentials'],
    applicationProcedure:
      'Check merit roll numbers and download official result PDF from the What\'s New section at https://upsc.gov.in.',
    officialSourceUrl: 'https://upsc.gov.in',
    sourceName: 'Union Public Service Commission',
    verificationStatus: 'VERIFIED',
    lastVerifiedAt: daysFromNow(0),
    status: 'OPEN',
  },
]

async function seed() {
  const adminPasswordHash = await hashPassword('Admin@12345')

  await prisma.user.upsert({
    where: { email: 'admin@edualert.dev' },
    update: {
      role: 'ADMIN',
    },
    create: {
      username: 'edualert_admin',
      email: 'admin@edualert.dev',
      passwordHash: adminPasswordHash,
      role: 'ADMIN',
    },
  })

  // Purge any lingering sample test records
  await prisma.opportunity.deleteMany({
    where: {
      OR: [
        { title: { contains: 'TEST DATA', mode: 'insensitive' } },
        { officialSourceUrl: { contains: 'example.org' } },
      ],
    },
  })

  let upsertedCount = 0

  for (const item of AUTHENTIC_OPPORTUNITIES) {
    await prisma.opportunity.upsert({
      where: {
        title_officialSourceUrl: {
          title: item.title,
          officialSourceUrl: item.officialSourceUrl,
        },
      },
      update: item,
      create: item,
    })
    upsertedCount += 1
  }

  console.log(
    `[SEED] Ensured dev admin (admin@edualert.dev) and seeded ${upsertedCount} authentic opportunity records in edualert_db.`,
  )
}

seed()
  .catch((error) => {
    console.error('[SEED] Failed to seed authentic opportunities:', error)
    process.exitCode = 1
  })
  .finally(disconnectDatabase)
