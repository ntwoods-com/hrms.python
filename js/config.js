/**
 * HRMS Configuration File
 * Contains all configuration settings for the frontend
 */

const CONFIG = {
    // API Configuration
    API_BASE_URL: 'http://localhost:5000/api',  // Change in production
    
    // Google OAuth Client ID
    GOOGLE_CLIENT_ID: '1029752642188-ku0k9krbdbsttj9br238glq8h4k5loj3.apps.googleusercontent.com',
    
    // Token Settings
    TOKEN_KEY: 'hrms_token',
    USER_KEY: 'hrms_user',
    
    // Session Settings
    SESSION_TIMEOUT: 24 * 60 * 60 * 1000, // 24 hours in milliseconds
    TOKEN_REFRESH_INTERVAL: 55 * 60 * 1000, // 55 minutes
    
    // Routes
    ROUTES: {
        LOGIN: '/index.html',
        DASHBOARD: '/pages/dashboard.html',
        EA_REQUIREMENTS: '/pages/ea/requirements.html',
        EA_INCOMPLETE: '/pages/ea/incomplete-requirements.html',
        HR_REVIEW: '/pages/hr/review-requirements.html',
        HR_JOB_POSTING: '/pages/hr/job-posting.html',
        HR_CV_UPLOAD: '/pages/hr/cv-upload.html',
        HR_SHORTLISTING: '/pages/hr/shortlisting.html',
        HR_TELEPHONIC: '/pages/hr/telephonic.html',
        HR_OWNER_DISCUSSION: '/pages/hr/owner-discussion.html',
        HR_SCHEDULE: '/pages/hr/schedule-interviews.html',
        HR_WALKINS: '/pages/hr/walk-ins.html',
        HR_INTERVIEW: '/pages/hr/hr-interview.html',
        HR_TESTS: '/pages/hr/tests.html',
        ADMIN_USERS: '/pages/admin/users.html',
        ADMIN_PERMISSIONS: '/pages/admin/permissions.html',
        ADMIN_TEMPLATES: '/pages/admin/templates.html',
        ADMIN_SETTINGS: '/pages/admin/settings.html',
        CANDIDATE_FORM: '/pages/candidate-form.html'
    },
    
    // User Roles
    ROLES: {
        ADMIN: 'admin',
        EA: 'ea',
        HR: 'hr'
    },
    
    // Job Roles
    JOB_ROLES: [
        'CRM',
        'MIS',
        'Jr. Accountant',
        'Sr. Accountant',
        'CCE',
        'PC'
    ],
    
    // Job Portals
    JOB_PORTALS: [
        'Naukri.com',
        'Indeed',
        'Work India',
        'Apna',
        'LinkedIn',
        'Direct'
    ],
    
    // Candidate Stages
    CANDIDATE_STAGES: [
        'Shortlisting',
        'Telephonic',
        'Owner Discussion',
        'Schedule Interview',
        'Walk-in',
        'HR Interview',
        'Tests',
        'Final Review',
        'Selected',
        'Rejected'
    ],
    
    // Telephonic Call Statuses
    TELEPHONIC_STATUSES: [
        'Pending',
        'Recommended for Owners',
        'Switched Off',
        'No Answer',
        'No Incoming',
        'Reject'
    ],
    
    // Owner Discussion Decisions
    OWNER_DECISIONS: [
        'Approved for Walk-in',
        'Rejected',
        'Hold'
    ],
    
    // Schedule Interview Statuses
    SCHEDULE_STATUSES: [
        'Pending',
        'Confirmed',
        'Hold due to Timing issue',
        'Not Picked',
        'Rescheduled',
        'Rejected'
    ],
    
    // Rejection Tags
    REJECTION_TAGS: [
        'Shortlisting',
        'On Call Conversation',
        'Owner Rejected before Walk-in',
        'No Show for Interview',
        'HR Interview Failed',
        'Test Failed',
        'Document Verification Failed'
    ],
    
    // File Upload Settings
    MAX_FILE_SIZE: 5 * 1024 * 1024, // 5 MB
    ALLOWED_CV_EXTENSIONS: ['.pdf', '.doc', '.docx'],
    ALLOWED_IMAGE_EXTENSIONS: ['.png', '.jpg', '.jpeg', '.gif'],
    
    // Date Formats
    DATE_FORMAT: 'YYYY-MM-DD',
    DISPLAY_DATE_FORMAT: 'DD MMM YYYY',
    TIME_FORMAT: 'HH:mm',
    DATETIME_FORMAT: 'DD MMM YYYY, HH:mm',
    
    // Company Info
    COMPANY: {
        NAME: 'N.T Woods Pvt. Ltd.',
        ADDRESS: 'Near Dr. Gyan Prakash, Kalai Compound, NT Woods, Gandhi Park, Aligarh (202 001)',
        PHONE: '+91 XXXXXXXXXX',
        EMAIL: 'hr@ntwoods.com'
    },
    
    // Toast Notification Duration
    TOAST_DURATION: 3000,
    
    // Pagination
    DEFAULT_PAGE_SIZE: 10,
    PAGE_SIZE_OPTIONS: [10, 25, 50, 100]
};

// Make CONFIG globally available
window.CONFIG = CONFIG;

// Environment detection
CONFIG.IS_DEVELOPMENT = window.location.hostname === 'localhost' || 
                         window.location.hostname === '127.0.0.1';

// Update API URL for production (GitHub Pages)
if (!CONFIG.IS_DEVELOPMENT) {
    // In production, your Flask backend should be hosted somewhere
    // Update this URL to your actual backend URL
    CONFIG.API_BASE_URL = 'https://unauthentic-loralee-interapophysal.ngrok-free.dev/api';
}

// Freeze configuration to prevent modifications
Object.freeze(CONFIG);
Object.freeze(CONFIG.ROUTES);
Object.freeze(CONFIG.ROLES);
Object.freeze(CONFIG.COMPANY);
