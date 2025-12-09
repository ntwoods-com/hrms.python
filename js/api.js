/**
 * HRMS API Module
 * Handles all API requests to the Flask backend
 */

const API = (function() {
    'use strict';
    
    /**
     * Make HTTP request
     */
    async function request(endpoint, options = {}) {
        const url = `${CONFIG.API_BASE_URL}${endpoint}`;
        
        // Default headers
        const headers = {
            'Content-Type': 'application/json',
            ...options.headers
        };
        
        // Add authorization token if available
        const token = Auth.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        // Build request config
        const config = {
            method: options.method || 'GET',
            headers,
            credentials: 'include', // Include cookies for CORS
            ...options
        };
        
        // Add body for non-GET requests
        if (options.body && config.method !== 'GET') {
            config.body = JSON.stringify(options.body);
        }
        
        try {
            const response = await fetch(url, config);
            
            // Handle 401 Unauthorized
            if (response.status === 401) {
                const refreshed = await Auth.refreshToken();
                if (refreshed) {
                    // Retry request with new token
                    headers['Authorization'] = `Bearer ${Auth.getToken()}`;
                    const retryResponse = await fetch(url, { ...config, headers });
                    return handleResponse(retryResponse);
                } else {
                    Auth.logout();
                    throw new Error('Session expired. Please login again.');
                }
            }
            
            return handleResponse(response);
        } catch (error) {
            console.error('API Request Error:', error);
            throw error;
        }
    }
    
    /**
     * Handle API response
     */
    async function handleResponse(response) {
        const contentType = response.headers.get('content-type');
        
        let data;
        if (contentType && contentType.includes('application/json')) {
            data = await response.json();
        } else {
            data = await response.text();
        }
        
        if (!response.ok) {
            const error = new Error(data.message || 'An error occurred');
            error.status = response.status;
            error.data = data;
            throw error;
        }
        
        return data;
    }
    
    /**
     * GET request
     */
    function get(endpoint, params = {}) {
        let url = endpoint;
        
        // Add query parameters
        const queryString = Object.entries(params)
            .filter(([_, value]) => value !== undefined && value !== null)
            .map(([key, value]) => `${encodeURIComponent(key)}=${encodeURIComponent(value)}`)
            .join('&');
        
        if (queryString) {
            url += `?${queryString}`;
        }
        
        return request(url, { method: 'GET' });
    }
    
    /**
     * POST request
     */
    function post(endpoint, body = {}) {
        return request(endpoint, {
            method: 'POST',
            body
        });
    }
    
    /**
     * PUT request
     */
    function put(endpoint, body = {}) {
        return request(endpoint, {
            method: 'PUT',
            body
        });
    }
    
    /**
     * PATCH request
     */
    function patch(endpoint, body = {}) {
        return request(endpoint, {
            method: 'PATCH',
            body
        });
    }
    
    /**
     * DELETE request
     */
    function del(endpoint) {
        return request(endpoint, { method: 'DELETE' });
    }
    
    /**
     * Upload file(s)
     */
    async function uploadFiles(endpoint, files, additionalData = {}) {
        const url = `${CONFIG.API_BASE_URL}${endpoint}`;
        const formData = new FormData();
        
        // Add files
        if (Array.isArray(files)) {
            files.forEach((file, index) => {
                formData.append(`file_${index}`, file);
            });
        } else {
            formData.append('file', files);
        }
        
        // Add additional data
        Object.entries(additionalData).forEach(([key, value]) => {
            formData.append(key, typeof value === 'object' ? JSON.stringify(value) : value);
        });
        
        const headers = {};
        const token = Auth.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        try {
            const response = await fetch(url, {
                method: 'POST',
                headers,
                body: formData,
                credentials: 'include'
            });
            
            return handleResponse(response);
        } catch (error) {
            console.error('File Upload Error:', error);
            throw error;
        }
    }
    
    /**
     * Download file
     */
    async function downloadFile(endpoint, filename) {
        const url = `${CONFIG.API_BASE_URL}${endpoint}`;
        
        const headers = {};
        const token = Auth.getToken();
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        
        try {
            const response = await fetch(url, {
                method: 'GET',
                headers,
                credentials: 'include'
            });
            
            if (!response.ok) {
                throw new Error('Download failed');
            }
            
            const blob = await response.blob();
            const downloadUrl = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = downloadUrl;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(downloadUrl);
            
            return true;
        } catch (error) {
            console.error('Download Error:', error);
            throw error;
        }
    }
    
    // =========================================
    // Specific API Endpoints
    // =========================================
    
    // Authentication
    const auth = {
        login: (token) => post('/auth/google/login', { token }),
        logout: () => post('/auth/logout'),
        refreshToken: () => post('/auth/refresh-token'),
        getProfile: () => get('/auth/profile')
    };
    
    // Users (Admin)
    const users = {
        getAll: () => get('/admin/users'),
        getById: (id) => get(`/admin/users/${id}`),
        create: (data) => post('/admin/users', data),
        update: (id, data) => put(`/admin/users/${id}`, data),
        delete: (id) => del(`/admin/users/${id}`),
        updateRole: (id, role) => patch(`/admin/users/${id}/role`, { role })
    };
    
    // Permissions (Admin)
    const permissions = {
        getAll: () => get('/admin/permissions'),
        getByUserId: (userId) => get(`/admin/permissions/${userId}`),
        update: (userId, permissions) => put(`/admin/permissions/${userId}`, permissions),
        getModules: () => get('/admin/permissions/modules')
    };
    
    // Templates (Admin)
    const templates = {
        getAll: () => get('/admin/templates'),
        getById: (id) => get(`/admin/templates/${id}`),
        create: (data) => post('/admin/templates', data),
        update: (id, data) => put(`/admin/templates/${id}`, data),
        delete: (id) => del(`/admin/templates/${id}`),
        getByType: (type) => get(`/admin/templates/type/${type}`)
    };
    
    // Settings (Admin)
    const settings = {
        getAll: () => get('/admin/settings'),
        update: (data) => put('/admin/settings', data),
        getAuditLogs: (params) => get('/admin/audit-logs', params)
    };
    
    // Requirements (EA & HR)
    const requirements = {
        getAll: (params) => get('/requirements', params),
        getById: (id) => get(`/requirements/${id}`),
        create: (data) => post('/ea/requirements', data),
        update: (id, data) => put(`/requirements/${id}`, data),
        delete: (id) => del(`/requirements/${id}`),
        getIncomplete: () => get('/ea/requirements/incomplete'),
        approve: (id, data) => post(`/hr/requirements/${id}/approve`, data),
        reject: (id, data) => post(`/hr/requirements/${id}/reject`, data),
        jobPost: (id, data) => post(`/hr/requirements/${id}/job-post`, data)
    };
    
    // Candidates (HR)
    const candidates = {
        getAll: (params) => get('/hr/candidates', params),
        getById: (id) => get(`/hr/candidates/${id}`),
        uploadCVs: (files, data) => uploadFiles('/hr/cv/upload', files, data),
        shortlist: (id, data) => post(`/hr/candidates/${id}/shortlist`, data),
        updateTelephonic: (id, data) => post(`/hr/candidates/${id}/telephonic`, data),
        updateOwnerDiscussion: (id, data) => post(`/hr/candidates/${id}/owner-discussion`, data),
        scheduleInterview: (id, data) => post(`/hr/candidates/${id}/schedule`, data),
        updateWalkin: (id, data) => post(`/hr/candidates/${id}/walkin`, data),
        updateHRInterview: (id, data) => post(`/hr/candidates/${id}/hr-interview`, data),
        updateTests: (id, data) => post(`/hr/candidates/${id}/tests`, data),
        reject: (id, data) => post(`/hr/candidates/${id}/reject`, data),
        getByStage: (stage) => get('/hr/candidates/stage', { stage }),
        getByRequirement: (reqId) => get(`/hr/candidates/requirement/${reqId}`),
        generateMessage: (id, type) => get(`/hr/candidates/${id}/message`, { type })
    };
    
    // Walk-in Candidate Form
    const walkin = {
        submitForm: (data) => post('/candidate/walkin-form', data),
        getMathQuestion: () => get('/candidate/math-question'),
        verifyMathAnswer: (data) => post('/candidate/verify-math', data),
        getAvailableSlots: (date) => get('/candidate/available-slots', { date })
    };
    
    // Dashboard
    const dashboard = {
        getStats: () => get('/dashboard/stats'),
        getRecentActivity: (limit) => get('/dashboard/recent-activity', { limit }),
        getPipelineData: () => get('/dashboard/pipeline'),
        getUpcomingInterviews: (days) => get('/dashboard/upcoming-interviews', { days })
    };
    
    // Reports
    const reports = {
        getHiringReport: (params) => get('/reports/hiring', params),
        getSourceAnalysis: (params) => get('/reports/source-analysis', params),
        getTimeToHire: (params) => get('/reports/time-to-hire', params),
        exportReport: (type, params) => downloadFile(`/reports/${type}/export`, `${type}_report.xlsx`)
    };
    
    // Public API
    return {
        // HTTP methods
        get,
        post,
        put,
        patch,
        delete: del,
        uploadFiles,
        downloadFile,
        
        // Specific endpoints
        auth,
        users,
        permissions,
        templates,
        settings,
        requirements,
        candidates,
        walkin,
        dashboard,
        reports
    };
})();

// Make API globally available
window.API = API;
