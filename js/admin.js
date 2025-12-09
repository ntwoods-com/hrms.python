/**
 * HRMS Admin Module
 * Handles admin functionality - users, permissions, templates, settings
 */

const Admin = (function() {
    'use strict';
    
    let users = [];
    let permissions = [];
    let templates = [];
    let selectedUserId = null;
    
    // =========================================
    // Initialization
    // =========================================
    
    /**
     * Initialize admin module
     */
    async function init() {
        if (!Auth.requireRole(CONFIG.ROLES.ADMIN)) return;
        
        setupEventListeners();
        
        // Determine which admin page we're on
        const page = getAdminPage();
        
        switch(page) {
            case 'users':
                await loadUsers();
                break;
            case 'permissions':
                await loadPermissions();
                break;
            case 'templates':
                await loadTemplates();
                break;
            case 'settings':
                await loadSettings();
                break;
        }
    }
    
    /**
     * Get current admin page
     */
    function getAdminPage() {
        const path = window.location.pathname;
        if (path.includes('users')) return 'users';
        if (path.includes('permissions')) return 'permissions';
        if (path.includes('templates')) return 'templates';
        if (path.includes('settings')) return 'settings';
        return 'users';
    }
    
    /**
     * Setup event listeners
     */
    function setupEventListeners() {
        // User form
        const userForm = Utils.$('#user-form');
        if (userForm) {
            userForm.addEventListener('submit', handleUserSubmit);
        }
        
        // Add user button
        const addUserBtn = Utils.$('#add-user-btn');
        if (addUserBtn) {
            addUserBtn.addEventListener('click', openUserModal);
        }
        
        // Permission form
        const permissionForm = Utils.$('#permission-form');
        if (permissionForm) {
            permissionForm.addEventListener('submit', handlePermissionSubmit);
        }
        
        // Template form
        const templateForm = Utils.$('#template-form');
        if (templateForm) {
            templateForm.addEventListener('submit', handleTemplateSubmit);
        }
        
        // Settings form
        const settingsForm = Utils.$('#settings-form');
        if (settingsForm) {
            settingsForm.addEventListener('submit', handleSettingsSubmit);
        }
        
        // Search users
        const searchInput = Utils.$('#search-users');
        if (searchInput) {
            searchInput.addEventListener('input', Utils.debounce(handleUserSearch, 300));
        }
        
        // Modal close buttons
        Utils.addEventListeners('.modal-close, .btn-cancel', 'click', closeModals);
        
        // Table action buttons (delegation)
        Utils.delegate('#users-table', '.btn-edit', 'click', handleEditUser);
        Utils.delegate('#users-table', '.btn-delete', 'click', handleDeleteUser);
        Utils.delegate('#templates-table', '.btn-edit', 'click', handleEditTemplate);
        Utils.delegate('#templates-table', '.btn-delete', 'click', handleDeleteTemplate);
    }
    
    // =========================================
    // Users Management
    // =========================================
    
    /**
     * Load users list
     */
    async function loadUsers() {
        try {
            Auth.showLoadingOverlay('Loading users...');
            const response = await API.users.getAll();
            users = response.data;
            renderUsersTable(users);
            Auth.hideLoadingOverlay();
        } catch (error) {
            Auth.hideLoadingOverlay();
            Utils.showToast('Failed to load users', 'error');
        }
    }
    
    /**
     * Render users table
     */
    function renderUsersTable(usersList) {
        const tbody = Utils.$('#users-table tbody');
        if (!tbody) return;
        
        if (!usersList || usersList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center">No users found</td></tr>';
            return;
        }
        
        let html = '';
        usersList.forEach(user => {
            html += `
                <tr data-user-id="${user.id}">
                    <td>
                        <div class="user-info">
                            <img src="${user.picture || '/assets/images/default-avatar.png'}" 
                                 alt="${Utils.escapeHtml(user.name)}" class="user-avatar">
                            <span>${Utils.escapeHtml(user.name)}</span>
                        </div>
                    </td>
                    <td>${Utils.escapeHtml(user.email)}</td>
                    <td><span class="badge badge-${user.role}">${Utils.titleCase(user.role)}</span></td>
                    <td>${user.is_active ? '<span class="badge badge-success">Active</span>' : '<span class="badge badge-danger">Inactive</span>'}</td>
                    <td>${Utils.formatDate(user.created_at)}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-sm btn-icon btn-edit" title="Edit">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-icon btn-delete" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
    }
    
    /**
     * Open user modal
     */
    function openUserModal(user = null) {
        selectedUserId = user ? user.id : null;
        
        const modal = Utils.$('#user-modal');
        const modalTitle = Utils.$('#user-modal-title');
        const form = Utils.$('#user-form');
        
        if (user) {
            modalTitle.textContent = 'Edit User';
            Utils.setFormData(form, {
                name: user.name,
                email: user.email,
                role: user.role,
                is_active: user.is_active
            });
        } else {
            modalTitle.textContent = 'Add New User';
            Utils.resetForm(form);
        }
        
        Utils.openModal('user-modal');
    }
    
    /**
     * Handle user form submit
     */
    async function handleUserSubmit(e) {
        e.preventDefault();
        
        if (!Utils.validateForm(this)) return;
        
        const formData = Utils.getFormData(this);
        formData.is_active = formData.is_active === 'on' || formData.is_active === true;
        
        try {
            Auth.showLoadingOverlay(selectedUserId ? 'Updating user...' : 'Creating user...');
            
            if (selectedUserId) {
                await API.users.update(selectedUserId, formData);
                Utils.showToast('User updated successfully', 'success');
            } else {
                await API.users.create(formData);
                Utils.showToast('User created successfully', 'success');
            }
            
            closeModals();
            await loadUsers();
        } catch (error) {
            Auth.hideLoadingOverlay();
            Utils.showToast(error.message || 'Failed to save user', 'error');
        }
    }
    
    /**
     * Handle edit user click
     */
    function handleEditUser(e) {
        const row = this.closest('tr');
        const userId = row.dataset.userId;
        const user = users.find(u => u.id === userId);
        
        if (user) {
            openUserModal(user);
        }
    }
    
    /**
     * Handle delete user click
     */
    async function handleDeleteUser(e) {
        const row = this.closest('tr');
        const userId = row.dataset.userId;
        const user = users.find(u => u.id === userId);
        
        if (!user) return;
        
        const confirmed = await Utils.confirm(
            `Are you sure you want to delete user "${user.name}"?`,
            'Delete User'
        );
        
        if (confirmed) {
            try {
                Auth.showLoadingOverlay('Deleting user...');
                await API.users.delete(userId);
                Utils.showToast('User deleted successfully', 'success');
                await loadUsers();
            } catch (error) {
                Auth.hideLoadingOverlay();
                Utils.showToast('Failed to delete user', 'error');
            }
        }
    }
    
    /**
     * Handle user search
     */
    function handleUserSearch(e) {
        const searchTerm = e.target.value.toLowerCase();
        
        if (!searchTerm) {
            renderUsersTable(users);
            return;
        }
        
        const filtered = users.filter(user => 
            user.name.toLowerCase().includes(searchTerm) ||
            user.email.toLowerCase().includes(searchTerm) ||
            user.role.toLowerCase().includes(searchTerm)
        );
        
        renderUsersTable(filtered);
    }
    
    // =========================================
    // Permissions Management
    // =========================================
    
    /**
     * Load permissions
     */
    async function loadPermissions() {
        try {
            Auth.showLoadingOverlay('Loading permissions...');
            
            const [usersResponse, modulesResponse] = await Promise.all([
                API.users.getAll(),
                API.permissions.getModules()
            ]);
            
            users = usersResponse.data;
            const modules = modulesResponse.data;
            
            renderPermissionsUI(users, modules);
            Auth.hideLoadingOverlay();
        } catch (error) {
            Auth.hideLoadingOverlay();
            Utils.showToast('Failed to load permissions', 'error');
        }
    }
    
    /**
     * Render permissions UI
     */
    function renderPermissionsUI(usersList, modules) {
        // Render user selector
        const userSelect = Utils.$('#permission-user-select');
        if (userSelect) {
            let options = '<option value="">Select a user</option>';
            usersList.forEach(user => {
                if (user.role !== CONFIG.ROLES.ADMIN) {
                    options += `<option value="${user.id}">${Utils.escapeHtml(user.name)} (${Utils.titleCase(user.role)})</option>`;
                }
            });
            userSelect.innerHTML = options;
            userSelect.addEventListener('change', handleUserSelectChange);
        }
        
        // Render modules
        const modulesContainer = Utils.$('#permissions-modules');
        if (modulesContainer) {
            let html = '';
            modules.forEach(module => {
                html += `
                    <div class="permission-module" data-module="${module.key}">
                        <h4 class="module-title">${module.name}</h4>
                        <div class="permission-actions">
                            <label class="checkbox-label">
                                <input type="checkbox" name="${module.key}_view" data-action="view">
                                <span>View</span>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" name="${module.key}_create" data-action="create">
                                <span>Create</span>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" name="${module.key}_edit" data-action="edit">
                                <span>Edit</span>
                            </label>
                            <label class="checkbox-label">
                                <input type="checkbox" name="${module.key}_delete" data-action="delete">
                                <span>Delete</span>
                            </label>
                        </div>
                    </div>
                `;
            });
            modulesContainer.innerHTML = html;
        }
    }
    
    /**
     * Handle user selection change for permissions
     */
    async function handleUserSelectChange(e) {
        const userId = e.target.value;
        if (!userId) {
            resetPermissionCheckboxes();
            return;
        }
        
        try {
            const response = await API.permissions.getByUserId(userId);
            updatePermissionCheckboxes(response.data);
        } catch (error) {
            Utils.showToast('Failed to load user permissions', 'error');
        }
    }
    
    /**
     * Reset permission checkboxes
     */
    function resetPermissionCheckboxes() {
        Utils.$$('#permissions-modules input[type="checkbox"]').forEach(cb => {
            cb.checked = false;
        });
    }
    
    /**
     * Update permission checkboxes based on user permissions
     */
    function updatePermissionCheckboxes(userPermissions) {
        resetPermissionCheckboxes();
        
        Object.entries(userPermissions).forEach(([module, actions]) => {
            Object.entries(actions).forEach(([action, allowed]) => {
                const checkbox = Utils.$(`input[name="${module}_${action}"]`);
                if (checkbox) {
                    checkbox.checked = allowed;
                }
            });
        });
    }
    
    /**
     * Handle permission form submit
     */
    async function handlePermissionSubmit(e) {
        e.preventDefault();
        
        const userSelect = Utils.$('#permission-user-select');
        const userId = userSelect.value;
        
        if (!userId) {
            Utils.showToast('Please select a user', 'warning');
            return;
        }
        
        // Build permissions object
        const permissions = {};
        Utils.$$('.permission-module').forEach(module => {
            const moduleName = module.dataset.module;
            permissions[moduleName] = {};
            
            Utils.$$('input[type="checkbox"]', module).forEach(cb => {
                const action = cb.dataset.action;
                permissions[moduleName][action] = cb.checked;
            });
        });
        
        try {
            Auth.showLoadingOverlay('Saving permissions...');
            await API.permissions.update(userId, permissions);
            Utils.showToast('Permissions saved successfully', 'success');
            Auth.hideLoadingOverlay();
        } catch (error) {
            Auth.hideLoadingOverlay();
            Utils.showToast('Failed to save permissions', 'error');
        }
    }
    
    // =========================================
    // Templates Management
    // =========================================
    
    /**
     * Load templates
     */
    async function loadTemplates() {
        try {
            Auth.showLoadingOverlay('Loading templates...');
            const response = await API.templates.getAll();
            templates = response.data;
            renderTemplatesTable(templates);
            Auth.hideLoadingOverlay();
        } catch (error) {
            Auth.hideLoadingOverlay();
            Utils.showToast('Failed to load templates', 'error');
        }
    }
    
    /**
     * Render templates table
     */
    function renderTemplatesTable(templatesList) {
        const tbody = Utils.$('#templates-table tbody');
        if (!tbody) return;
        
        if (!templatesList || templatesList.length === 0) {
            tbody.innerHTML = '<tr><td colspan="5" class="text-center">No templates found</td></tr>';
            return;
        }
        
        let html = '';
        templatesList.forEach(template => {
            html += `
                <tr data-template-id="${template.id}">
                    <td>${Utils.escapeHtml(template.name)}</td>
                    <td><span class="badge">${Utils.titleCase(template.type)}</span></td>
                    <td>${Utils.truncate(template.content, 100)}</td>
                    <td>${Utils.formatDate(template.updated_at)}</td>
                    <td>
                        <div class="action-buttons">
                            <button class="btn btn-sm btn-icon btn-edit" title="Edit">
                                <i class="fas fa-edit"></i>
                            </button>
                            <button class="btn btn-sm btn-icon btn-delete" title="Delete">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </td>
                </tr>
            `;
        });
        
        tbody.innerHTML = html;
    }
    
    /**
     * Handle edit template click
     */
    function handleEditTemplate(e) {
        const row = this.closest('tr');
        const templateId = row.dataset.templateId;
        const template = templates.find(t => t.id === templateId);
        
        if (template) {
            openTemplateModal(template);
        }
    }
    
    /**
     * Open template modal
     */
    function openTemplateModal(template = null) {
        const modal = Utils.$('#template-modal');
        const modalTitle = Utils.$('#template-modal-title');
        const form = Utils.$('#template-form');
        
        if (template) {
            modalTitle.textContent = 'Edit Template';
            Utils.setFormData(form, template);
            form.dataset.templateId = template.id;
        } else {
            modalTitle.textContent = 'Add New Template';
            Utils.resetForm(form);
            delete form.dataset.templateId;
        }
        
        Utils.openModal('template-modal');
    }
    
    /**
     * Handle template form submit
     */
    async function handleTemplateSubmit(e) {
        e.preventDefault();
        
        if (!Utils.validateForm(this)) return;
        
        const formData = Utils.getFormData(this);
        const templateId = this.dataset.templateId;
        
        try {
            Auth.showLoadingOverlay(templateId ? 'Updating template...' : 'Creating template...');
            
            if (templateId) {
                await API.templates.update(templateId, formData);
                Utils.showToast('Template updated successfully', 'success');
            } else {
                await API.templates.create(formData);
                Utils.showToast('Template created successfully', 'success');
            }
            
            closeModals();
            await loadTemplates();
        } catch (error) {
            Auth.hideLoadingOverlay();
            Utils.showToast(error.message || 'Failed to save template', 'error');
        }
    }
    
    /**
     * Handle delete template click
     */
    async function handleDeleteTemplate(e) {
        const row = this.closest('tr');
        const templateId = row.dataset.templateId;
        const template = templates.find(t => t.id === templateId);
        
        if (!template) return;
        
        const confirmed = await Utils.confirm(
            `Are you sure you want to delete template "${template.name}"?`,
            'Delete Template'
        );
        
        if (confirmed) {
            try {
                Auth.showLoadingOverlay('Deleting template...');
                await API.templates.delete(templateId);
                Utils.showToast('Template deleted successfully', 'success');
                await loadTemplates();
            } catch (error) {
                Auth.hideLoadingOverlay();
                Utils.showToast('Failed to delete template', 'error');
            }
        }
    }
    
    // =========================================
    // Settings Management
    // =========================================
    
    /**
     * Load settings
     */
    async function loadSettings() {
        try {
            Auth.showLoadingOverlay('Loading settings...');
            const response = await API.settings.getAll();
            Utils.setFormData('#settings-form', response.data);
            Auth.hideLoadingOverlay();
        } catch (error) {
            Auth.hideLoadingOverlay();
            Utils.showToast('Failed to load settings', 'error');
        }
    }
    
    /**
     * Handle settings form submit
     */
    async function handleSettingsSubmit(e) {
        e.preventDefault();
        
        if (!Utils.validateForm(this)) return;
        
        const formData = Utils.getFormData(this);
        
        try {
            Auth.showLoadingOverlay('Saving settings...');
            await API.settings.update(formData);
            Utils.showToast('Settings saved successfully', 'success');
            Auth.hideLoadingOverlay();
        } catch (error) {
            Auth.hideLoadingOverlay();
            Utils.showToast('Failed to save settings', 'error');
        }
    }
    
    /**
     * Close all modals
     */
    function closeModals() {
        Utils.$$('.modal').forEach(modal => {
            Utils.closeModal(modal);
        });
        selectedUserId = null;
    }
    
    // Public API
    return {
        init,
        loadUsers,
        loadPermissions,
        loadTemplates,
        loadSettings,
        openUserModal,
        openTemplateModal
    };
})();

// Make Admin globally available
window.Admin = Admin;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', Admin.init);
