/**
 * HRMS HR Module
 * Handles HR functionality - CV upload, shortlisting, screening, interviews, etc.
 */

const HR = (function() {
    'use strict';
    
    let candidates = [];
    let requirements = [];
    let selectedCandidateId = null;
    let currentStage = '';
    
    // =========================================
    // Initialization
    // =========================================
    
    /**
     * Initialize HR module
     */
    async function init() {
        if (!Auth.requireAuth()) return;
        
        const user = Auth.getUser();
        if (user.role !== CONFIG.ROLES.HR && user.role !== CONFIG.ROLES.ADMIN) {
            if (!Auth.hasPermission('candidates', 'view')) {
                Utils.showToast('You do not have permission to access this page', 'error');
                window.location.href = CONFIG.ROUTES.DASHBOARD;
                return;
            }
        }
        
        setupEventListeners();
        
        // Determine which HR page we're on
        const page = getHRPage();
        currentStage = page;
        
        // Load requirements for dropdowns
        await loadRequirements();
        
        // Load page-specific data
        const pageLoaders = {
            'review': loadPendingRequirements,
            'cv-upload': setupCVUpload,
            'shortlisting': () => loadCandidatesByStage('Shortlisting'),
            'telephonic': () => loadCandidatesByStage('Telephonic'),
            'owner-discussion': () => loadCandidatesByStage('Owner Discussion'),
            'schedule': () => loadCandidatesByStage('Schedule Interview'),
            'walk-ins': () => loadCandidatesByStage('Walk-in'),
            'hr-interview': () => loadCandidatesByStage('HR Interview'),
            'tests': () => loadCandidatesByStage('Tests')
        };
        
        if (pageLoaders[page]) {
            await pageLoaders[page]();
        }
    }
    
    /**
     * Get current HR page
     */
    function getHRPage() {
        const path = window.location.pathname;
        if (path.includes('review')) return 'review';
        if (path.includes('cv-upload')) return 'cv-upload';
        if (path.includes('shortlisting')) return 'shortlisting';
        if (path.includes('telephonic')) return 'telephonic';
        if (path.includes('owner-discussion')) return 'owner-discussion';
        if (path.includes('schedule')) return 'schedule';
        if (path.includes('walk-in')) return 'walk-ins';
        if (path.includes('hr-interview')) return 'hr-interview';
        if (path.includes('tests')) return 'tests';
        return 'review';
    }
    
    /**
     * Setup event listeners
     */
    function setupEventListeners() {
        // CV Upload
        const cvUploadForm = Utils.$('#cv-upload-form');
        if (cvUploadForm) {
            cvUploadForm.addEventListener('submit', handleCVUpload);
        }
        
        // File drop zone
        const dropZone = Utils.$('#cv-drop-zone');
        if (dropZone) {
            setupDropZone(dropZone);
        }
        
        // File input
        const fileInput = Utils.$('#cv-files');
        if (fileInput) {
            fileInput.addEventListener('change', handleFileSelect);
        }
        
        // Requirement approval/rejection
        Utils.delegate('#pending-requirements', '.btn-approve', 'click', handleApproveRequirement);
        Utils.delegate('#pending-requirements', '.btn-reject', 'click', handleRejectRequirement);
        
        // Candidate actions (delegation for all tables)
        Utils.delegate('.candidates-table', '.btn-action', 'click', handleCandidateAction);
        Utils.delegate('.candidates-table', '.btn-view', 'click', handleViewCandidate);
        Utils.delegate('.candidates-table', '.btn-reject', 'click', handleRejectCandidate);
        Utils.delegate('.candidates-table', '.btn-message', 'click', handleGenerateMessage);
        
        // Modal close buttons
        Utils.addEventListeners('.modal-close, .btn-cancel', 'click', closeModals);
        
        // Action forms in modals
        const telephonicForm = Utils.$('#telephonic-form');
        if (telephonicForm) {
            telephonicForm.addEventListener('submit', handleTelephonicSubmit);
        }
        
        const ownerDiscussionForm = Utils.$('#owner-discussion-form');
        if (ownerDiscussionForm) {
            ownerDiscussionForm.addEventListener('submit', handleOwnerDiscussionSubmit);
        }
        
        const scheduleForm = Utils.$('#schedule-form');
        if (scheduleForm) {
            scheduleForm.addEventListener('submit', handleScheduleSubmit);
        }
        
        const hrInterviewForm = Utils.$('#hr-interview-form');
        if (hrInterviewForm) {
            hrInterviewForm.addEventListener('submit', handleHRInterviewSubmit);
        }
        
        const testForm = Utils.$('#test-form');
        if (testForm) {
            testForm.addEventListener('submit', handleTestSubmit);
        }
        
        // Search candidates
        const searchInput = Utils.$('#search-candidates');
        if (searchInput) {
            searchInput.addEventListener('input', Utils.debounce(handleCandidateSearch, 300));
        }
        
        // Filter by requirement
        const reqFilter = Utils.$('#filter-requirement');
        if (reqFilter) {
            reqFilter.addEventListener('change', handleRequirementFilter);
        }
        
        // Copy message button
        Utils.delegate('.message-container', '.btn-copy', 'click', handleCopyMessage);
    }
    
    // =========================================
    // Requirements Loading & Approval
    // =========================================
    
    /**
     * Load requirements for dropdowns
     */
    async function loadRequirements() {
        try {
            const response = await API.requirements.getAll({ status: 'Approved' });
            requirements = response.data;
            populateRequirementDropdowns();
        } catch (error) {
            console.error('Failed to load requirements:', error);
        }
    }
    
    /**
     * Populate requirement dropdowns
     */
    function populateRequirementDropdowns() {
        const dropdowns = Utils.$$('[data-populate="requirements"]');
        dropdowns.forEach(dropdown => {
            let options = '<option value="">Select Requirement</option>';
            requirements.forEach(req => {
                options += `<option value="${req.id}">${req.id} - ${req.role} (${req.vacancy_count} positions)</option>`;
            });
            dropdown.innerHTML = options;
        });
    }
    
    /**
     * Load pending requirements for HR review
     */
    async function loadPendingRequirements() {
        try {
            Auth.showLoadingOverlay('Loading pending requirements...');
            const response = await API.requirements.getAll({ status: 'Pending' });
            renderPendingRequirements(response.data);
            Auth.hideLoadingOverlay();
        } catch (error) {
            Auth.hideLoadingOverlay();
            Utils.showToast('Failed to load pending requirements', 'error');
        }
    }
    
    /**
     * Render pending requirements cards
     */
    function renderPendingRequirements(reqList) {
        const container = Utils.$('#pending-requirements');
        if (!container) return;
        
        if (!reqList || reqList.length === 0) {
            container.innerHTML = '<div class="empty-state"><i class="fas fa-check-circle"></i><p>No pending requirements</p></div>';
            return;
        }
        
        let html = '';
        reqList.forEach(req => {
            html += `
                <div class="requirement-card" data-req-id="${req.id}">
                    <div class="req-header">
                        <span class="req-id">${Utils.escapeHtml(req.id)}</span>
                        <span class="badge badge-warning">Pending</span>
                    </div>
                    <div class="req-body">
                        <h4>${Utils.escapeHtml(req.role)}</h4>
                        <div class="req-details">
                            <span><i class="fas fa-users"></i> ${req.vacancy_count} Positions</span>
                            <span><i class="fas fa-clock"></i> ${req.experience || 'Not specified'}</span>
                            <span><i class="fas fa-money-bill"></i> ${req.salary_range || 'Not specified'}</span>
                        </div>
                        <p class="req-description">${Utils.truncate(req.job_description || '', 150)}</p>
                        <p class="req-meta">Raised by ${Utils.escapeHtml(req.raised_by)} on ${Utils.formatDate(req.created_date)}</p>
                    </div>
                    <div class="req-footer">
                        <button class="btn btn-success btn-approve"><i class="fas fa-check"></i> Approve</button>
                        <button class="btn btn-danger btn-reject"><i class="fas fa-times"></i> Reject</button>
                    </div>
                </div>
            `;
        });
        
        container.innerHTML = html;
    }
    
    /**
     * Handle approve requirement
     */
    async function handleApproveRequirement(e) {
        const card = this.closest('.requirement-card');
        const reqId = card.dataset.reqId;
        
        try {
            Auth.showLoadingOverlay('Approving requirement...');
            await API.requirements.approve(reqId, { approved_by: Auth.getUser().name });
            Utils.showToast('Requirement approved successfully', 'success');
            card.remove();
            
            // Check if empty
            const container = Utils.$('#pending-requirements');
            if (container && !container.querySelector('.requirement-card')) {
                container.innerHTML = '<div class="empty-state"><i class="fas fa-check-circle"></i><p>No pending requirements</p></div>';
            }
            
            Auth.hideLoadingOverlay();
        } catch (error) {
            Auth.hideLoadingOverlay();
            Utils.showToast('Failed to approve requirement', 'error');
        }
    }
    
    /**
     * Handle reject requirement
     */
    async function handleRejectRequirement(e) {
        const card = this.closest('.requirement-card');
        const reqId = card.dataset.reqId;
        
        const reason = prompt('Please enter rejection reason:');
        if (!reason) return;
        
        try {
            Auth.showLoadingOverlay('Rejecting requirement...');
            await API.requirements.reject(reqId, { 
                rejected_by: Auth.getUser().name,
                reason: reason
            });
            Utils.showToast('Requirement rejected', 'success');
            card.remove();
            Auth.hideLoadingOverlay();
        } catch (error) {
            Auth.hideLoadingOverlay();
            Utils.showToast('Failed to reject requirement', 'error');
        }
    }
    
    // =========================================
    // CV Upload
    // =========================================
    
    let selectedFiles = [];
    
    /**
     * Setup CV upload area
     */
    function setupCVUpload() {
        selectedFiles = [];
        updateFileList();
    }
    
    /**
     * Setup file drop zone
     */
    function setupDropZone(dropZone) {
        ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, preventDefaults);
        });
        
        ['dragenter', 'dragover'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => dropZone.classList.add('highlight'));
        });
        
        ['dragleave', 'drop'].forEach(eventName => {
            dropZone.addEventListener(eventName, () => dropZone.classList.remove('highlight'));
        });
        
        dropZone.addEventListener('drop', handleDrop);
        dropZone.addEventListener('click', () => Utils.$('#cv-files').click());
    }
    
    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }
    
    /**
     * Handle file drop
     */
    function handleDrop(e) {
        const files = e.dataTransfer.files;
        handleFiles(files);
    }
    
    /**
     * Handle file select from input
     */
    function handleFileSelect(e) {
        const files = e.target.files;
        handleFiles(files);
    }
    
    /**
     * Handle files (validation and processing)
     */
    function handleFiles(files) {
        const validFiles = [];
        const errors = [];
        
        Array.from(files).forEach(file => {
            // Check extension
            if (!Utils.isValidFileType(file.name, CONFIG.ALLOWED_CV_EXTENSIONS)) {
                errors.push(`${file.name}: Invalid file type`);
                return;
            }
            
            // Check size
            if (!Utils.isValidFileSize(file.size)) {
                errors.push(`${file.name}: File too large (max ${CONFIG.MAX_FILE_SIZE / 1024 / 1024}MB)`);
                return;
            }
            
            // Check filename format (Name_Mobile_Source)
            const parsed = parseFilename(file.name);
            if (!parsed.isValid) {
                errors.push(`${file.name}: Invalid format (use Name_Mobile_Source.pdf)`);
                return;
            }
            
            validFiles.push({
                file: file,
                name: parsed.name,
                mobile: parsed.mobile,
                source: parsed.source,
                filename: file.name
            });
        });
        
        if (errors.length > 0) {
            errors.forEach(err => Utils.showToast(err, 'error'));
        }
        
        selectedFiles = [...selectedFiles, ...validFiles];
        updateFileList();
    }
    
    /**
     * Parse filename to extract candidate details
     * Format: Name_Mobile_Source.ext
     */
    function parseFilename(filename) {
        const withoutExt = filename.replace(/\.[^.]+$/, '');
        const parts = withoutExt.split('_');
        
        if (parts.length < 3) {
            return { isValid: false };
        }
        
        const name = parts[0].trim();
        const mobile = parts[1].trim();
        const source = parts.slice(2).join('_').trim();
        
        // Validate mobile (10 digits)
        if (!/^\d{10}$/.test(mobile)) {
            return { isValid: false };
        }
        
        return {
            isValid: true,
            name: name,
            mobile: mobile,
            source: source
        };
    }
    
    /**
     * Update file list UI
     */
    function updateFileList() {
        const fileList = Utils.$('#cv-file-list');
        if (!fileList) return;
        
        if (selectedFiles.length === 0) {
            fileList.innerHTML = '<p class="no-files">No files selected</p>';
            return;
        }
        
        let html = '<div class="file-list">';
        selectedFiles.forEach((fileData, index) => {
            html += `
                <div class="file-item" data-index="${index}">
                    <div class="file-info">
                        <i class="fas fa-file-pdf"></i>
                        <div class="file-details">
                            <span class="file-name">${Utils.escapeHtml(fileData.filename)}</span>
                            <span class="file-meta">
                                <span class="candidate-name">${Utils.escapeHtml(fileData.name)}</span>
                                <span class="candidate-mobile">${fileData.mobile}</span>
                                <span class="candidate-source">${Utils.escapeHtml(fileData.source)}</span>
                            </span>
                        </div>
                    </div>
                    <button type="button" class="btn btn-sm btn-icon btn-remove-file" onclick="HR.removeFile(${index})">
                        <i class="fas fa-times"></i>
                    </button>
                </div>
            `;
        });
        html += '</div>';
        html += `<p class="file-count">${selectedFiles.length} file(s) ready to upload</p>`;
        
        fileList.innerHTML = html;
    }
    
    /**
     * Remove file from list
     */
    function removeFile(index) {
        selectedFiles.splice(index, 1);
        updateFileList();
    }
    
    /**
     * Handle CV upload form submit
     */
    async function handleCVUpload(e) {
        e.preventDefault();
        
        if (selectedFiles.length === 0) {
            Utils.showToast('Please select files to upload', 'warning');
            return;
        }
        
        const requirementId = Utils.$('#upload-requirement').value;
        if (!requirementId) {
            Utils.showToast('Please select a requirement', 'warning');
            return;
        }
        
        try {
            Auth.showLoadingOverlay(`Uploading ${selectedFiles.length} files...`);
            
            const files = selectedFiles.map(f => f.file);
            const candidateData = selectedFiles.map(f => ({
                name: f.name,
                mobile: f.mobile,
                source: f.source
            }));
            
            await API.candidates.uploadCVs(files, {
                requirement_id: requirementId,
                candidates: candidateData
            });
            
            Utils.showToast(`${selectedFiles.length} CVs uploaded successfully`, 'success');
            selectedFiles = [];
            updateFileList();
            Utils.$('#upload-requirement').value = '';
            
            Auth.hideLoadingOverlay();
        } catch (error) {
            Auth.hideLoadingOverlay();
            Utils.showToast('Failed to upload CVs', 'error');
        }
    }
    
    // =========================================
    // Candidate Management by Stage
    // =========================================
    
    /**
     * Load candidates by stage
     */
    async function loadCandidatesByStage(stage) {
        try {
            Auth.showLoadingOverlay(`Loading ${stage} candidates...`);
            const response = await API.candidates.getByStage(stage);
            candidates = response.data;
            renderCandidatesTable(candidates, stage);
            Auth.hideLoadingOverlay();
        } catch (error) {
            Auth.hideLoadingOverlay();
            Utils.showToast('Failed to load candidates', 'error');
        }
    }
    
    /**
     * Render candidates table based on stage
     */
    function renderCandidatesTable(candidateList, stage) {
        const tbody = Utils.$('.candidates-table tbody');
        if (!tbody) return;
        
        if (!candidateList || candidateList.length === 0) {
            tbody.innerHTML = `<tr><td colspan="8" class="text-center">No candidates in ${stage} stage</td></tr>`;
            return;
        }
        
        let html = '';
        candidateList.forEach(candidate => {
            html += renderCandidateRow(candidate, stage);
        });
        
        tbody.innerHTML = html;
    }
    
    /**
     * Render individual candidate row based on stage
     */
    function renderCandidateRow(candidate, stage) {
        const statusBadge = getStatusBadge(candidate.status);
        
        let actionButtons = '';
        
        switch(stage) {
            case 'Shortlisting':
                actionButtons = `
                    <button class="btn btn-sm btn-primary btn-action" data-action="shortlist" title="Shortlist">
                        <i class="fas fa-check"></i>
                    </button>
                `;
                break;
            case 'Telephonic':
                actionButtons = `
                    <button class="btn btn-sm btn-primary btn-action" data-action="telephonic" title="Update Status">
                        <i class="fas fa-phone"></i>
                    </button>
                `;
                break;
            case 'Owner Discussion':
                actionButtons = `
                    <button class="btn btn-sm btn-primary btn-action" data-action="owner-discussion" title="Record Decision">
                        <i class="fas fa-user-tie"></i>
                    </button>
                `;
                break;
            case 'Schedule Interview':
                actionButtons = `
                    <button class="btn btn-sm btn-primary btn-action" data-action="schedule" title="Schedule">
                        <i class="fas fa-calendar-plus"></i>
                    </button>
                    <button class="btn btn-sm btn-secondary btn-message" data-message-type="interview" title="Generate Message">
                        <i class="fas fa-comment"></i>
                    </button>
                `;
                break;
            case 'Walk-in':
                actionButtons = `
                    <button class="btn btn-sm btn-primary btn-action" data-action="walkin" title="Mark Arrived">
                        <i class="fas fa-user-check"></i>
                    </button>
                `;
                break;
            case 'HR Interview':
                actionButtons = `
                    <button class="btn btn-sm btn-primary btn-action" data-action="hr-interview" title="Record Result">
                        <i class="fas fa-clipboard-check"></i>
                    </button>
                `;
                break;
            case 'Tests':
                actionButtons = `
                    <button class="btn btn-sm btn-primary btn-action" data-action="test" title="Record Test">
                        <i class="fas fa-file-alt"></i>
                    </button>
                `;
                break;
        }
        
        return `
            <tr data-candidate-id="${candidate.id}">
                <td>${Utils.escapeHtml(candidate.name)}</td>
                <td>${candidate.mobile}</td>
                <td>${Utils.escapeHtml(candidate.role)}</td>
                <td>${Utils.escapeHtml(candidate.source)}</td>
                <td>${Utils.formatDate(candidate.created_date)}</td>
                <td>${statusBadge}</td>
                <td>
                    <div class="action-buttons">
                        <button class="btn btn-sm btn-icon btn-view" title="View Details">
                            <i class="fas fa-eye"></i>
                        </button>
                        ${actionButtons}
                        <button class="btn btn-sm btn-icon btn-reject" title="Reject">
                            <i class="fas fa-times"></i>
                        </button>
                    </div>
                </td>
            </tr>
        `;
    }
    
    /**
     * Get status badge HTML
     */
    function getStatusBadge(status) {
        const statusClasses = {
            'Pending': 'badge-warning',
            'Shortlisted': 'badge-info',
            'Recommended': 'badge-primary',
            'Approved': 'badge-success',
            'Scheduled': 'badge-info',
            'Confirmed': 'badge-success',
            'Completed': 'badge-success',
            'Rejected': 'badge-danger',
            'No Show': 'badge-danger'
        };
        
        const badgeClass = statusClasses[status] || 'badge-secondary';
        return `<span class="badge ${badgeClass}">${status}</span>`;
    }
    
    // =========================================
    // Candidate Actions
    // =========================================
    
    /**
     * Handle candidate action button click
     */
    function handleCandidateAction(e) {
        const row = this.closest('tr');
        selectedCandidateId = row.dataset.candidateId;
        const action = this.dataset.action;
        const candidate = candidates.find(c => c.id === selectedCandidateId);
        
        if (!candidate) return;
        
        const actionModals = {
            'shortlist': 'shortlist-modal',
            'telephonic': 'telephonic-modal',
            'owner-discussion': 'owner-discussion-modal',
            'schedule': 'schedule-modal',
            'walkin': 'walkin-modal',
            'hr-interview': 'hr-interview-modal',
            'test': 'test-modal'
        };
        
        const modalId = actionModals[action];
        if (modalId) {
            openActionModal(modalId, candidate);
        }
    }
    
    /**
     * Open action modal and populate with candidate data
     */
    function openActionModal(modalId, candidate) {
        const modal = Utils.$(`#${modalId}`);
        if (!modal) return;
        
        // Populate candidate info in modal
        const nameEl = modal.querySelector('.candidate-name');
        if (nameEl) nameEl.textContent = candidate.name;
        
        const roleEl = modal.querySelector('.candidate-role');
        if (roleEl) roleEl.textContent = candidate.role;
        
        const mobileEl = modal.querySelector('.candidate-mobile');
        if (mobileEl) mobileEl.textContent = candidate.mobile;
        
        // Reset form if exists
        const form = modal.querySelector('form');
        if (form) Utils.resetForm(form);
        
        Utils.openModal(modalId);
    }
    
    /**
     * Handle telephonic form submit
     */
    async function handleTelephonicSubmit(e) {
        e.preventDefault();
        
        if (!Utils.validateForm(this)) return;
        
        const formData = Utils.getFormData(this);
        
        try {
            Auth.showLoadingOverlay('Updating telephonic status...');
            await API.candidates.updateTelephonic(selectedCandidateId, formData);
            Utils.showToast('Telephonic status updated', 'success');
            closeModals();
            await loadCandidatesByStage('Telephonic');
        } catch (error) {
            Auth.hideLoadingOverlay();
            Utils.showToast('Failed to update status', 'error');
        }
    }
    
    /**
     * Handle owner discussion form submit
     */
    async function handleOwnerDiscussionSubmit(e) {
        e.preventDefault();
        
        if (!Utils.validateForm(this)) return;
        
        const formData = Utils.getFormData(this);
        
        try {
            Auth.showLoadingOverlay('Recording owner decision...');
            await API.candidates.updateOwnerDiscussion(selectedCandidateId, formData);
            Utils.showToast('Owner decision recorded', 'success');
            closeModals();
            await loadCandidatesByStage('Owner Discussion');
        } catch (error) {
            Auth.hideLoadingOverlay();
            Utils.showToast('Failed to record decision', 'error');
        }
    }
    
    /**
     * Handle schedule form submit
     */
    async function handleScheduleSubmit(e) {
        e.preventDefault();
        
        if (!Utils.validateForm(this)) return;
        
        const formData = Utils.getFormData(this);
        
        try {
            Auth.showLoadingOverlay('Scheduling interview...');
            await API.candidates.scheduleInterview(selectedCandidateId, formData);
            Utils.showToast('Interview scheduled', 'success');
            closeModals();
            await loadCandidatesByStage('Schedule Interview');
        } catch (error) {
            Auth.hideLoadingOverlay();
            Utils.showToast('Failed to schedule interview', 'error');
        }
    }
    
    /**
     * Handle HR interview form submit
     */
    async function handleHRInterviewSubmit(e) {
        e.preventDefault();
        
        if (!Utils.validateForm(this)) return;
        
        const formData = Utils.getFormData(this);
        
        try {
            Auth.showLoadingOverlay('Recording HR interview result...');
            await API.candidates.updateHRInterview(selectedCandidateId, formData);
            Utils.showToast('HR interview result recorded', 'success');
            closeModals();
            await loadCandidatesByStage('HR Interview');
        } catch (error) {
            Auth.hideLoadingOverlay();
            Utils.showToast('Failed to record result', 'error');
        }
    }
    
    /**
     * Handle test form submit
     */
    async function handleTestSubmit(e) {
        e.preventDefault();
        
        if (!Utils.validateForm(this)) return;
        
        const formData = Utils.getFormData(this);
        
        try {
            Auth.showLoadingOverlay('Recording test result...');
            await API.candidates.updateTests(selectedCandidateId, formData);
            Utils.showToast('Test result recorded', 'success');
            closeModals();
            await loadCandidatesByStage('Tests');
        } catch (error) {
            Auth.hideLoadingOverlay();
            Utils.showToast('Failed to record result', 'error');
        }
    }
    
    /**
     * Handle view candidate details
     */
    function handleViewCandidate(e) {
        const row = this.closest('tr');
        const candidateId = row.dataset.candidateId;
        const candidate = candidates.find(c => c.id === candidateId);
        
        if (candidate) {
            openCandidateDetailModal(candidate);
        }
    }
    
    /**
     * Open candidate detail modal
     */
    function openCandidateDetailModal(candidate) {
        const modal = Utils.$('#candidate-detail-modal');
        if (!modal) return;
        
        const content = Utils.$('#candidate-detail-content', modal);
        content.innerHTML = `
            <div class="candidate-header">
                <h3>${Utils.escapeHtml(candidate.name)}</h3>
                ${getStatusBadge(candidate.status)}
            </div>
            <div class="detail-grid">
                <div class="detail-item">
                    <label>Mobile</label>
                    <p>${candidate.mobile}</p>
                </div>
                <div class="detail-item">
                    <label>Email</label>
                    <p>${candidate.email || '-'}</p>
                </div>
                <div class="detail-item">
                    <label>Role</label>
                    <p>${Utils.escapeHtml(candidate.role)}</p>
                </div>
                <div class="detail-item">
                    <label>Source</label>
                    <p>${Utils.escapeHtml(candidate.source)}</p>
                </div>
                <div class="detail-item">
                    <label>Experience</label>
                    <p>${candidate.experience || '-'}</p>
                </div>
                <div class="detail-item">
                    <label>Current Stage</label>
                    <p>${candidate.current_stage}</p>
                </div>
                <div class="detail-item">
                    <label>Created Date</label>
                    <p>${Utils.formatDate(candidate.created_date)}</p>
                </div>
                <div class="detail-item">
                    <label>Requirement ID</label>
                    <p>${Utils.escapeHtml(candidate.requirement_id)}</p>
                </div>
            </div>
            <div class="timeline">
                <h4>Activity Timeline</h4>
                ${renderTimeline(candidate.timeline || [])}
            </div>
        `;
        
        Utils.openModal('candidate-detail-modal');
    }
    
    /**
     * Render candidate timeline
     */
    function renderTimeline(timeline) {
        if (!timeline || timeline.length === 0) {
            return '<p class="no-data">No activity recorded</p>';
        }
        
        let html = '<div class="timeline-list">';
        timeline.forEach(item => {
            html += `
                <div class="timeline-item">
                    <div class="timeline-marker"></div>
                    <div class="timeline-content">
                        <p class="timeline-title">${Utils.escapeHtml(item.action)}</p>
                        <p class="timeline-meta">${Utils.formatDate(item.timestamp, 'DD MMM YYYY, HH:mm')} by ${Utils.escapeHtml(item.by)}</p>
                        ${item.notes ? `<p class="timeline-notes">${Utils.escapeHtml(item.notes)}</p>` : ''}
                    </div>
                </div>
            `;
        });
        html += '</div>';
        return html;
    }
    
    /**
     * Handle reject candidate
     */
    async function handleRejectCandidate(e) {
        const row = this.closest('tr');
        const candidateId = row.dataset.candidateId;
        const candidate = candidates.find(c => c.id === candidateId);
        
        if (!candidate) return;
        
        // Open rejection modal with tag selection
        openRejectionModal(candidate);
    }
    
    /**
     * Open rejection modal
     */
    function openRejectionModal(candidate) {
        selectedCandidateId = candidate.id;
        
        const modal = Utils.$('#rejection-modal');
        if (!modal) return;
        
        // Populate rejection tags
        const tagsContainer = modal.querySelector('#rejection-tags');
        if (tagsContainer) {
            let html = '';
            CONFIG.REJECTION_TAGS.forEach(tag => {
                html += `
                    <label class="tag-option">
                        <input type="radio" name="rejection_tag" value="${tag}" required>
                        <span>${tag}</span>
                    </label>
                `;
            });
            tagsContainer.innerHTML = html;
        }
        
        modal.querySelector('.candidate-name').textContent = candidate.name;
        Utils.openModal('rejection-modal');
        
        // Handle form submit
        const form = modal.querySelector('#rejection-form');
        form.onsubmit = async (e) => {
            e.preventDefault();
            
            const formData = Utils.getFormData(form);
            
            try {
                Auth.showLoadingOverlay('Rejecting candidate...');
                await API.candidates.reject(selectedCandidateId, formData);
                Utils.showToast('Candidate rejected', 'success');
                closeModals();
                await loadCandidatesByStage(currentStage);
            } catch (error) {
                Auth.hideLoadingOverlay();
                Utils.showToast('Failed to reject candidate', 'error');
            }
        };
    }
    
    /**
     * Handle generate message
     */
    async function handleGenerateMessage(e) {
        const row = this.closest('tr');
        const candidateId = row.dataset.candidateId;
        const messageType = this.dataset.messageType;
        
        try {
            Auth.showLoadingOverlay('Generating message...');
            const response = await API.candidates.generateMessage(candidateId, messageType);
            
            // Show message in modal
            const modal = Utils.$('#message-modal');
            if (modal) {
                const messageContent = modal.querySelector('#message-content');
                messageContent.textContent = response.data.message;
                Utils.openModal('message-modal');
            }
            
            Auth.hideLoadingOverlay();
        } catch (error) {
            Auth.hideLoadingOverlay();
            Utils.showToast('Failed to generate message', 'error');
        }
    }
    
    /**
     * Handle copy message
     */
    function handleCopyMessage(e) {
        const messageContent = Utils.$('#message-content');
        if (messageContent) {
            Utils.copyToClipboard(messageContent.textContent);
        }
    }
    
    /**
     * Handle candidate search
     */
    function handleCandidateSearch(e) {
        const searchTerm = e.target.value.toLowerCase();
        
        if (!searchTerm) {
            renderCandidatesTable(candidates, currentStage);
            return;
        }
        
        const filtered = candidates.filter(c => 
            c.name.toLowerCase().includes(searchTerm) ||
            c.mobile.includes(searchTerm) ||
            c.role.toLowerCase().includes(searchTerm)
        );
        
        renderCandidatesTable(filtered, currentStage);
    }
    
    /**
     * Handle requirement filter
     */
    async function handleRequirementFilter(e) {
        const reqId = e.target.value;
        
        if (!reqId) {
            await loadCandidatesByStage(currentStage);
            return;
        }
        
        try {
            Auth.showLoadingOverlay('Filtering candidates...');
            const response = await API.candidates.getByRequirement(reqId);
            const filtered = response.data.filter(c => c.current_stage === currentStage);
            renderCandidatesTable(filtered, currentStage);
            Auth.hideLoadingOverlay();
        } catch (error) {
            Auth.hideLoadingOverlay();
            Utils.showToast('Failed to filter candidates', 'error');
        }
    }
    
    /**
     * Close all modals
     */
    function closeModals() {
        Utils.$$('.modal').forEach(modal => {
            Utils.closeModal(modal);
        });
        selectedCandidateId = null;
    }
    
    // Public API
    return {
        init,
        loadCandidatesByStage,
        removeFile,
        loadRequirements
    };
})();

// Make HR globally available
window.HR = HR;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', HR.init);
