/**
 * HRMS Dashboard Module
 * Handles dashboard functionality for all roles
 */

const Dashboard = (function() {
    'use strict';
    
    let currentUser = null;
    let statsData = {};
    let pipelineData = {};
    
    /**
     * Initialize dashboard
     */
    async function init() {
        // Check authentication
        if (!Auth.requireAuth()) return;
        
        currentUser = Auth.getUser();
        
        // Setup UI based on role
        setupRoleBasedUI();
        
        // Setup event listeners
        setupEventListeners();
        
        // Load dashboard data
        await loadDashboardData();
        
        // Setup sidebar
        setupSidebar();
        
        // Setup user profile
        setupUserProfile();
    }
    
    /**
     * Setup role-based UI elements
     */
    function setupRoleBasedUI() {
        const role = currentUser.role;
        
        // Hide/show menu items based on role
        const menuItems = Utils.$$('[data-role]');
        menuItems.forEach(item => {
            const allowedRoles = item.dataset.role.split(',');
            if (!allowedRoles.includes(role) && role !== CONFIG.ROLES.ADMIN) {
                item.style.display = 'none';
            }
        });
        
        // Show role-specific sections
        Utils.$$('[data-section-role]').forEach(section => {
            const allowedRoles = section.dataset.sectionRole.split(',');
            if (allowedRoles.includes(role) || role === CONFIG.ROLES.ADMIN) {
                section.classList.remove('hidden');
            }
        });
        
        // Update role badge
        const roleBadge = Utils.$('.role-badge');
        if (roleBadge) {
            roleBadge.textContent = Utils.titleCase(role);
            roleBadge.className = `role-badge badge badge-${role}`;
        }
    }
    
    /**
     * Setup event listeners
     */
    function setupEventListeners() {
        // Sidebar toggle
        const sidebarToggle = Utils.$('#sidebar-toggle');
        if (sidebarToggle) {
            sidebarToggle.addEventListener('click', toggleSidebar);
        }
        
        // User menu toggle
        const userMenuToggle = Utils.$('#user-menu-toggle');
        if (userMenuToggle) {
            userMenuToggle.addEventListener('click', toggleUserMenu);
        }
        
        // Logout button
        const logoutBtn = Utils.$('#logout-btn');
        if (logoutBtn) {
            logoutBtn.addEventListener('click', handleLogout);
        }
        
        // Close user menu when clicking outside
        document.addEventListener('click', (e) => {
            const userMenu = Utils.$('.user-menu');
            if (userMenu && !userMenu.contains(e.target)) {
                userMenu.classList.remove('active');
            }
        });
        
        // Quick action cards
        Utils.delegate('.dashboard-content', '.quick-action-card', 'click', handleQuickAction);
        
        // Refresh button
        const refreshBtn = Utils.$('#refresh-data');
        if (refreshBtn) {
            refreshBtn.addEventListener('click', loadDashboardData);
        }
    }
    
    /**
     * Load dashboard data
     */
    async function loadDashboardData() {
        try {
            Auth.showLoadingOverlay('Loading dashboard...');
            
            // Load data in parallel
            const [stats, pipeline, recentActivity, upcomingInterviews] = await Promise.all([
                API.dashboard.getStats(),
                API.dashboard.getPipelineData(),
                API.dashboard.getRecentActivity(10),
                API.dashboard.getUpcomingInterviews(7)
            ]);
            
            statsData = stats.data;
            pipelineData = pipeline.data;
            
            // Render dashboard components
            renderStats(stats.data);
            renderPipeline(pipeline.data);
            renderRecentActivity(recentActivity.data);
            renderUpcomingInterviews(upcomingInterviews.data);
            
            Auth.hideLoadingOverlay();
        } catch (error) {
            Auth.hideLoadingOverlay();
            console.error('Failed to load dashboard data:', error);
            Utils.showToast('Failed to load dashboard data', 'error');
        }
    }
    
    /**
     * Render statistics cards
     */
    function renderStats(data) {
        const statsGrid = Utils.$('#stats-grid');
        if (!statsGrid) return;
        
        const role = currentUser.role;
        let statsHtml = '';
        
        // Common stats for all roles
        if (role === CONFIG.ROLES.ADMIN || role === CONFIG.ROLES.HR) {
            statsHtml += `
                <div class="stat-card">
                    <div class="stat-icon bg-primary">
                        <i class="fas fa-users"></i>
                    </div>
                    <div class="stat-content">
                        <p class="stat-value">${data.totalCandidates || 0}</p>
                        <p class="stat-label">Total Candidates</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon bg-success">
                        <i class="fas fa-user-check"></i>
                    </div>
                    <div class="stat-content">
                        <p class="stat-value">${data.selectedCandidates || 0}</p>
                        <p class="stat-label">Selected</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon bg-warning">
                        <i class="fas fa-clock"></i>
                    </div>
                    <div class="stat-content">
                        <p class="stat-value">${data.pendingInterviews || 0}</p>
                        <p class="stat-label">Pending Interviews</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon bg-info">
                        <i class="fas fa-briefcase"></i>
                    </div>
                    <div class="stat-content">
                        <p class="stat-value">${data.activeRequirements || 0}</p>
                        <p class="stat-label">Active Requirements</p>
                    </div>
                </div>
            `;
        }
        
        // EA specific stats
        if (role === CONFIG.ROLES.EA || role === CONFIG.ROLES.ADMIN) {
            statsHtml += `
                <div class="stat-card">
                    <div class="stat-icon bg-secondary">
                        <i class="fas fa-file-alt"></i>
                    </div>
                    <div class="stat-content">
                        <p class="stat-value">${data.totalRequirements || 0}</p>
                        <p class="stat-label">Total Requirements</p>
                    </div>
                </div>
                <div class="stat-card">
                    <div class="stat-icon bg-warning">
                        <i class="fas fa-exclamation-circle"></i>
                    </div>
                    <div class="stat-content">
                        <p class="stat-value">${data.incompleteRequirements || 0}</p>
                        <p class="stat-label">Incomplete</p>
                    </div>
                </div>
            `;
        }
        
        // Admin specific stats
        if (role === CONFIG.ROLES.ADMIN) {
            statsHtml += `
                <div class="stat-card">
                    <div class="stat-icon bg-dark">
                        <i class="fas fa-user-shield"></i>
                    </div>
                    <div class="stat-content">
                        <p class="stat-value">${data.totalUsers || 0}</p>
                        <p class="stat-label">Total Users</p>
                    </div>
                </div>
            `;
        }
        
        statsGrid.innerHTML = statsHtml;
    }
    
    /**
     * Render pipeline data
     */
    function renderPipeline(data) {
        const pipelineContainer = Utils.$('#pipeline-container');
        if (!pipelineContainer) return;
        
        const stages = CONFIG.CANDIDATE_STAGES;
        let pipelineHtml = '<div class="pipeline-grid">';
        
        stages.forEach((stage, index) => {
            const count = data[stage.toLowerCase().replace(/\s+/g, '_')] || 0;
            const percentage = data.total > 0 ? Math.round((count / data.total) * 100) : 0;
            
            pipelineHtml += `
                <div class="pipeline-card" data-stage="${stage}">
                    <div class="pipeline-header">
                        <span class="pipeline-number">${index + 1}</span>
                        <span class="pipeline-title">${stage}</span>
                    </div>
                    <div class="pipeline-count">${count}</div>
                    <div class="progress-bar">
                        <div class="progress-fill" style="width: ${percentage}%"></div>
                    </div>
                    <span class="pipeline-percentage">${percentage}%</span>
                </div>
            `;
        });
        
        pipelineHtml += '</div>';
        pipelineContainer.innerHTML = pipelineHtml;
        
        // Add click handlers to pipeline cards
        Utils.$$('.pipeline-card', pipelineContainer).forEach(card => {
            card.addEventListener('click', () => {
                const stage = card.dataset.stage;
                navigateToStage(stage);
            });
        });
    }
    
    /**
     * Render recent activity
     */
    function renderRecentActivity(activities) {
        const activityList = Utils.$('#recent-activity');
        if (!activityList) return;
        
        if (!activities || activities.length === 0) {
            activityList.innerHTML = '<p class="no-data">No recent activity</p>';
            return;
        }
        
        let html = '';
        activities.forEach(activity => {
            html += `
                <div class="activity-item">
                    <div class="activity-icon ${activity.type}">
                        <i class="fas ${getActivityIcon(activity.type)}"></i>
                    </div>
                    <div class="activity-content">
                        <p class="activity-text">${Utils.escapeHtml(activity.description)}</p>
                        <span class="activity-time">${Utils.relativeTime(activity.timestamp)}</span>
                    </div>
                </div>
            `;
        });
        
        activityList.innerHTML = html;
    }
    
    /**
     * Get icon for activity type
     */
    function getActivityIcon(type) {
        const icons = {
            'requirement': 'fa-file-alt',
            'candidate': 'fa-user-plus',
            'interview': 'fa-calendar-check',
            'selection': 'fa-check-circle',
            'rejection': 'fa-times-circle',
            'upload': 'fa-upload',
            'update': 'fa-edit',
            'default': 'fa-circle'
        };
        return icons[type] || icons.default;
    }
    
    /**
     * Render upcoming interviews
     */
    function renderUpcomingInterviews(interviews) {
        const interviewsList = Utils.$('#upcoming-interviews');
        if (!interviewsList) return;
        
        if (!interviews || interviews.length === 0) {
            interviewsList.innerHTML = '<p class="no-data">No upcoming interviews</p>';
            return;
        }
        
        let html = '<table class="data-table"><thead><tr>';
        html += '<th>Candidate</th><th>Role</th><th>Date</th><th>Time</th><th>Status</th>';
        html += '</tr></thead><tbody>';
        
        interviews.forEach(interview => {
            html += `
                <tr>
                    <td>${Utils.escapeHtml(interview.candidate_name)}</td>
                    <td>${Utils.escapeHtml(interview.role)}</td>
                    <td>${Utils.formatDate(interview.date)}</td>
                    <td>${interview.time}</td>
                    <td><span class="badge badge-${interview.status.toLowerCase()}">${interview.status}</span></td>
                </tr>
            `;
        });
        
        html += '</tbody></table>';
        interviewsList.innerHTML = html;
    }
    
    /**
     * Setup sidebar
     */
    function setupSidebar() {
        // Highlight current page in sidebar
        const currentPath = window.location.pathname;
        Utils.$$('.sidebar-nav a').forEach(link => {
            if (link.getAttribute('href') === currentPath) {
                link.classList.add('active');
            }
        });
        
        // Handle submenu toggles
        Utils.$$('.sidebar-nav .has-submenu > a').forEach(link => {
            link.addEventListener('click', (e) => {
                e.preventDefault();
                link.parentElement.classList.toggle('open');
            });
        });
    }
    
    /**
     * Setup user profile
     */
    function setupUserProfile() {
        const userName = Utils.$('#user-name');
        const userEmail = Utils.$('#user-email');
        const userAvatar = Utils.$('#user-avatar');
        
        if (userName) userName.textContent = currentUser.name;
        if (userEmail) userEmail.textContent = currentUser.email;
        if (userAvatar && currentUser.picture) {
            userAvatar.src = currentUser.picture;
            userAvatar.alt = currentUser.name;
        }
    }
    
    /**
     * Toggle sidebar
     */
    function toggleSidebar() {
        const sidebar = Utils.$('.sidebar');
        const mainContent = Utils.$('.main-content');
        
        sidebar.classList.toggle('collapsed');
        mainContent.classList.toggle('expanded');
    }
    
    /**
     * Toggle user menu
     */
    function toggleUserMenu(e) {
        e.stopPropagation();
        const userMenu = Utils.$('.user-menu');
        userMenu.classList.toggle('active');
    }
    
    /**
     * Handle logout
     */
    async function handleLogout(e) {
        e.preventDefault();
        
        const confirmed = await Utils.confirm('Are you sure you want to logout?', 'Logout');
        if (confirmed) {
            await Auth.logout();
        }
    }
    
    /**
     * Handle quick action click
     */
    function handleQuickAction() {
        const action = this.dataset.action;
        
        const actionRoutes = {
            'add-requirement': CONFIG.ROUTES.EA_REQUIREMENTS,
            'upload-cv': CONFIG.ROUTES.HR_CV_UPLOAD,
            'schedule-interview': CONFIG.ROUTES.HR_SCHEDULE,
            'manage-users': CONFIG.ROUTES.ADMIN_USERS
        };
        
        if (actionRoutes[action]) {
            window.location.href = actionRoutes[action];
        }
    }
    
    /**
     * Navigate to stage page
     */
    function navigateToStage(stage) {
        const stageRoutes = {
            'Shortlisting': CONFIG.ROUTES.HR_SHORTLISTING,
            'Telephonic': CONFIG.ROUTES.HR_TELEPHONIC,
            'Owner Discussion': CONFIG.ROUTES.HR_OWNER_DISCUSSION,
            'Schedule Interview': CONFIG.ROUTES.HR_SCHEDULE,
            'Walk-in': CONFIG.ROUTES.HR_WALKINS,
            'HR Interview': CONFIG.ROUTES.HR_INTERVIEW,
            'Tests': CONFIG.ROUTES.HR_TESTS
        };
        
        if (stageRoutes[stage]) {
            window.location.href = stageRoutes[stage];
        }
    }
    
    // Public API
    return {
        init,
        loadDashboardData,
        renderStats,
        renderPipeline,
        toggleSidebar
    };
})();

// Make Dashboard globally available
window.Dashboard = Dashboard;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', Dashboard.init);
