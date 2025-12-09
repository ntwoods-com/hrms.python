/**
 * HRMS EA (Executive Assistant) Module
 * Handles EA functionality - requirement raising, incomplete requirements
 */

const EA = (function() {
    'use strict';
    
    let requirements = [];
    let incompleteRequirements = [];
    let selectedRequirementId = null;
    
    // =========================================
    // Initialization
    // =========================================
    
    /**
     * Initialize EA module
     */
    async function init() {
        if (!Auth.requireAuth()) return;
        
        const user = Auth.getUser();
        if (user.role !== CONFIG.ROLES.EA && user.role !== CONFIG.ROLES.ADMIN) {
            if (!Auth.hasPermission('requirements', 'view')) {
                Utils.showToast('You do not have permission to access this page', 'error');
                window.location.href = CONFIG.ROUTES.DASHBOARD;
                return;
            }
        }
        
        setupEventListeners();
        
        // Determine which EA page we're on
        const page = getEAPage();
        
        switch(page) {
            case 'requirements':
                await loadRequirements();
                break;
            case 'incomplete':
                await loadIncompleteRequirements();
                break;
        }
    }
    
    /**
     * Get current EA page
     */
    function getEAPage() {
        const path = window.location.pathname;
        if (path.includes('incomplete')) return 'incomplete';
        return 'requirements';
    }
    
    /**
     * Setup event listeners
     */
    function setupEventListeners() {
        // Requirement form
        const reqForm = Utils.$('#requirement-form');
        if (reqForm) {
            reqForm.addEventListener('submit', handleRequirementSubmit);
        }
        
        // Add requirement button
        const addReqBtn = Utils.$('#add-requirement-btn');
        if (addReqBtn) {
            addReqBtn.addEventListener('click', () => openRequirementModal());
        }
        
        // Role selection change
        const roleSelect = Utils.$('#requirement-role');
        if (roleSelect) {
            roleSelect.addEventListener('change', handleRoleChange);
            populateRoleSelect(roleSelect);
        }
        
        // Modal close buttons
        Utils.addEventListeners('.modal-close, .btn-cancel', 'click', closeModals);
        
        // Table action buttons (delegation)
        Utils.delegate('#requirements-table', '.btn-edit', 'click', handleEditRequirement);
        Utils.delegate('#requirements-table', '.btn-delete', 'click', handleDeleteRequirement);
        Utils.delegate('#requirements-table', '.btn-view', 'click', handleViewRequirement);
        
        // Incomplete requirements table
        Utils.delegate('#incomplete-table', '.btn-complete', 'click', handleCompleteRequirement);
        
        // Search requirements
        const searchInput = Utils.$('#search-requirements');
        if (searchInput) {
            searchInput.addEventListener('input', Utils.debounce(handleRequirementSearch, 300));
        }
        
        // Filter by status
        const statusFilter = Utils.$('#filter-status');
        if (statusFilter) {
            statusFilter.addEventListener('change', handleStatusFilter);
        }
        
        // Filter by role
        const roleFilter = Utils.$('#filter-role');
        if (roleFilter) {
            populateRoleSelect(roleFilter, true);
            roleFilter.addEventListener('change', handleRoleFilter);
        }
    }
    
    /**
     * Populate role select dropdown
     */
    function populateRoleSelect(select, includeAll = false) {
        let options = includeAll ? '<option value="">All Roles</option>' : '';
        CONFIG.JOB_ROLES.forEach(role => {
            options += `<option value="${role}">${role}</option>`;
        });
        select.innerHTML = options;
    }
    
    // =========================================
    // Requirements Management
    // =========================================
    
    /**
     * Load requirements list
     */
    async function loadRequirements() {
        try {
            Auth.showLoadingOverlay('Loading requirements...');
            const response = await API.requirements.getAll();
            requirements = response.data;
            renderRequirementsTable(requirements);
            updateRequirementStats(requirements);
            Auth.hideLoadingOverlay();
        } catch (error) {
            Auth.hideLoadingOverlay();
            Utils.showToast('Failed to load requirements', 'error');
        }
    }
    
    /**
     * Load incomplete requirements
     */
    async function loadIncompleteRequirements() {
        try {
            Auth.showLoadingOverlay('Loading incomplete requirements...');
            const response = await API.requirements.getIncomplete();
            incompleteRequirements = response.data;
            renderIncompleteTable(incompleteRequirements);
            Auth.hideLoadingOverlay();
        } catch (error) {
            Auth.hideLoadingOverlay();
            Utils.showToast('Failed to load incomplete requirements', 'error');
        }
    }
    
    /**
     * Render requirements table
     */
    function renderRequirementsTable(reqList) {
        const tbody = Utils.$('#requirements-table tbody');
        if (!tbody) return;
        
        if (!reqList || reqList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="8" class="text-center">No requirements found</td></tr>';
            return;
        }
        
        let html = '';
        reqList.forEach(req => {
            const statusClass = getStatusClass(req.status);
            html += `
                <tr data-req-id="${req.id}">
                    <td>${Utils.escapeHtml(req.id)}</td>
                    <td>${Utils.escapeHtml(req.role)}</td>
                    <td>${req.vacancy_count}</td>
                    <td>${Utils.formatDate(req.created_date)}</td>
                    <td>${Utils.escapeHtml(req.raised_by)}</td>
                    <td><span class="badge ${statusClass}">${req.status}</span></td>
                    <td>${Utils.formatDate(req.updated_date)}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-sm btn-icon btn-view" title="View">
                                <i class="fas fa-eye"></i>
                            </button>
                            ${req.status === 'Pending' ? `
                                <button class="btn btn-sm btn-icon btn-edit" title="Edit">
                                    <i class="fas fa-edit"></i>
                                </button>
                                <button class="btn btn-sm btn-icon btn-delete" title="Delete">
                                    <i class="fas fa-trash"></i>
                                </button>
                            ` : ''}
                        </div>
                    </td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
    }
    
    /**
     * Render incomplete requirements table
     */
    function renderIncompleteTable(reqList) {
        const tbody = Utils.$('#incomplete-table tbody');
        if (!tbody) return;
        
        if (!reqList || reqList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No incomplete requirements</td></tr>';
            return;
        }
        
        let html = '';
        reqList.forEach(req => {
            const missingFields = getMissingFields(req);
            html += `
                <tr data-req-id="${req.id}">
                    <td>${Utils.escapeHtml(req.id)}</td>
                    <td>${Utils.escapeHtml(req.role)}</td>
                    <td>${req.vacancy_count || '-'}</td>
                    <td>${Utils.formatDate(req.created_date)}</td>
                    <td><span class="text-danger">${missingFields.join(', ')}</span></td>
                    <td>
                        <button class="btn btn-sm btn-primary btn-complete" title="Complete">
                            <i class="fas fa-check"></i> Complete
                        </button>
                    </td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
    }
    
    /**
     * Get missing fields for incomplete requirement
     */
    function getMissingFields(req) {
        const missing = [];
        const requiredFields = ['role', 'vacancy_count', 'experience', 'salary_range', 'job_description'];
        
        requiredFields.forEach(field => {
            if (!req[field]) {
                missing.push(Utils.titleCase(field.replace('_', ' ')));
            }
        });
        
        return missing;
    }
    
    /**
     * Update requirement statistics
     */
    function updateRequirementStats(reqList) {
        const stats = {
            total: reqList.length,
            pending: reqList.filter(r => r.status === 'Pending').length,
            approved: reqList.filter(r => r.status === 'Approved').length,
            rejected: reqList.filter(r => r.status === 'Rejected').length,
            closed: reqList.filter(r => r.status === 'Closed').length
        };
        
        const statsContainer = Utils.$('#requirement-stats');
        if (statsContainer) {
            statsContainer.innerHTML = `
                <div class="stat-item">
                    <span class="stat-value">${stats.total}</span>
                    <span class="stat-label">Total</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value text-warning">${stats.pending}</span>
                    <span class="stat-label">Pending</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value text-success">${stats.approved}</span>
                    <span class="stat-label">Approved</span>
                </div>
                <div class="stat-item">
                    <span class="stat-value text-danger">${stats.rejected}</span>
                    <span class="stat-label">Rejected</span>
                </div>
            `;
        }
    }
    
    /**
     * Get status class for badge
     */
    function getStatusClass(status) {
        const classes = {
            'Pending': 'badge-warning',
            'Approved': 'badge-success',
            'Rejected': 'badge-danger',
            'Closed': 'badge-secondary',
            'In Progress': 'badge-info'
        };
        return classes[status] || 'badge-secondary';
    }
    
    /**
     * Open requirement modal
     */
    function openRequirementModal(requirement = null) {
        selectedRequirementId = requirement ? requirement.id : null;
        
        const modal = Utils.$('#requirement-modal');
        const modalTitle = Utils.$('#requirement-modal-title');
        const form = Utils.$('#requirement-form');
        
        if (requirement) {
            modalTitle.textContent = 'Edit Requirement';
            Utils.setFormData(form, requirement);
        } else {
            modalTitle.textContent = 'Raise New Requirement';
            Utils.resetForm(form);
            
            // Set default values
            const today = Utils.getToday();
            Utils.$('#requirement-date').value = today;
        }
        
        Utils.openModal('requirement-modal');
    }
    
    /**
     * Handle requirement form submit
     */
    async function handleRequirementSubmit(e) {
        e.preventDefault();
        
        if (!Utils.validateForm(this)) return;
        
        const formData = Utils.getFormData(this);
        formData.vacancy_count = parseInt(formData.vacancy_count, 10);
        
        try {
            Auth.showLoadingOverlay(selectedRequirementId ? 'Updating requirement...' : 'Creating requirement...');
            
            if (selectedRequirementId) {
                await API.requirements.update(selectedRequirementId, formData);
                Utils.showToast('Requirement updated successfully', 'success');
            } else {
                await API.requirements.create(formData);
                Utils.showToast('Requirement raised successfully', 'success');
            }
            
            closeModals();
            await loadRequirements();
        } catch (error) {
            Auth.hideLoadingOverlay();
            Utils.showToast(error.message || 'Failed to save requirement', 'error');
        }
    }
    
    /**
     * Handle edit requirement click
     */
    function handleEditRequirement(e) {
        const row = this.closest('tr');
        const reqId = row.dataset.reqId;
        const requirement = requirements.find(r => r.id === reqId);
        
        if (requirement) {
            openRequirementModal(requirement);
        }
    }
    
    /**
     * Handle view requirement click
     */
    function handleViewRequirement(e) {
        const row = this.closest('tr');
        const reqId = row.dataset.reqId;
        const requirement = requirements.find(r => r.id === reqId);
        
        if (requirement) {
            openViewModal(requirement);
        }
    }
    
    /**
     * Open view requirement modal
     */
    function openViewModal(requirement) {
        const modal = Utils.$('#view-requirement-modal');
        if (!modal) return;
        
        const content = Utils.$('#view-requirement-content');
        content.innerHTML = `
            <div class="detail-grid">
                <div class="detail-item">
                    <label>Requirement ID</label>
                    <p>${Utils.escapeHtml(requirement.id)}</p>
                </div>
                <div class="detail-item">
                    <label>Role</label>
                    <p>${Utils.escapeHtml(requirement.role)}</p>
                </div>
                <div class="detail-item">
                    <label>Vacancy Count</label>
                    <p>${requirement.vacancy_count}</p>
                </div>
                <div class="detail-item">
                    <label>Experience Required</label>
                    <p>${requirement.experience || '-'}</p>
                </div>
                <div class="detail-item">
                    <label>Salary Range</label>
                    <p>${requirement.salary_range || '-'}</p>
                </div>
                <div class="detail-item">
                    <label>Status</label>
                    <p><span class="badge ${getStatusClass(requirement.status)}">${requirement.status}</span></p>
                </div>
                <div class="detail-item">
                    <label>Raised By</label>
                    <p>${Utils.escapeHtml(requirement.raised_by)}</p>
                </div>
                <div class="detail-item">
                    <label>Created Date</label>
                    <p>${Utils.formatDate(requirement.created_date)}</p>
                </div>
                <div class="detail-item full-width">
                    <label>Job Description</label>
                    <p>${Utils.escapeHtml(requirement.job_description) || '-'}</p>
                </div>
                <div class="detail-item full-width">
                    <label>Special Requirements</label>
                    <p>${Utils.escapeHtml(requirement.special_requirements) || '-'}</p>
                </div>
            </div>
        `;
        
        Utils.openModal('view-requirement-modal');
    }
    
    /**
     * Handle delete requirement click
     */
    async function handleDeleteRequirement(e) {
        const row = this.closest('tr');
        const reqId = row.dataset.reqId;
        const requirement = requirements.find(r => r.id === reqId);
        
        if (!requirement) return;
        
        const confirmed = await Utils.confirm(
            `Are you sure you want to delete requirement "${reqId}"?`,
            'Delete Requirement'
        );
        
        if (confirmed) {
            try {
                Auth.showLoadingOverlay('Deleting requirement...');
                await API.requirements.delete(reqId);
                Utils.showToast('Requirement deleted successfully', 'success');
                await loadRequirements();
            } catch (error) {
                Auth.hideLoadingOverlay();
                Utils.showToast('Failed to delete requirement', 'error');
            }
        }
    }
    
    /**
     * Handle complete requirement click (for incomplete requirements)
     */
    function handleCompleteRequirement(e) {
        const row = this.closest('tr');
        const reqId = row.dataset.reqId;
        const requirement = incompleteRequirements.find(r => r.id === reqId);
        
        if (requirement) {
            openRequirementModal(requirement);
        }
    }
    
    /**
     * Handle requirement search
     */
    function handleRequirementSearch(e) {
        const searchTerm = e.target.value.toLowerCase();
        filterRequirements();
    }
    
    /**
     * Handle status filter change
     */
    function handleStatusFilter(e) {
        filterRequirements();
    }
    
    /**
     * Handle role filter change
     */
    function handleRoleFilter(e) {
        filterRequirements();
    }
    
    /**
     * Handle role selection change
     */
    function handleRoleChange(e) {
        const role = e.target.value;
        // You could load role-specific templates or defaults here
    }
    
    /**
     * Filter requirements based on search and filters
     */
    function filterRequirements() {
        const searchTerm = Utils.$('#search-requirements')?.value?.toLowerCase() || '';
        const statusFilter = Utils.$('#filter-status')?.value || '';
        const roleFilter = Utils.$('#filter-role')?.value || '';
        
        const filtered = requirements.filter(req => {
            // Search filter
            const matchesSearch = !searchTerm || 
                req.id.toLowerCase().includes(searchTerm) ||
                req.role.toLowerCase().includes(searchTerm) ||
                req.raised_by.toLowerCase().includes(searchTerm);
            
            // Status filter
            const matchesStatus = !statusFilter || req.status === statusFilter;
            
            // Role filter
            const matchesRole = !roleFilter || req.role === roleFilter;
            
            return matchesSearch && matchesStatus && matchesRole;
        });
        
        renderRequirementsTable(filtered);
    }
    
    /**
     * Close all modals
     */
    function closeModals() {
        Utils.$$('.modal').forEach(modal => {
            Utils.closeModal(modal);
        });
        selectedRequirementId = null;
    }
    
    // Public API
    return {
        init,
        loadRequirements,
        loadIncompleteRequirements,
        openRequirementModal
    };
})();

// Make EA globally available
window.EA = EA;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', EA.init);
