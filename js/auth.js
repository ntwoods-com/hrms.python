/**
 * HRMS Authentication Module
 * Handles Google OAuth, session management, and authorization
 */

const Auth = (function() {
    'use strict';
    
    let currentUser = null;
    let tokenRefreshTimer = null;
    
    /**
     * Initialize Google OAuth
     */
    function initGoogleAuth() {
        return new Promise((resolve, reject) => {
            if (typeof google === 'undefined') {
                // Load Google Sign-In library
                const script = document.createElement('script');
                script.src = 'https://accounts.google.com/gsi/client';
                script.async = true;
                script.defer = true;
                script.onload = () => {
                    setupGoogleSignIn();
                    resolve();
                };
                script.onerror = () => reject(new Error('Failed to load Google Sign-In'));
                document.head.appendChild(script);
            } else {
                setupGoogleSignIn();
                resolve();
            }
        });
    }
    
    /**
     * Setup Google Sign-In button
     */
    function setupGoogleSignIn() {
        google.accounts.id.initialize({
            client_id: CONFIG.GOOGLE_CLIENT_ID,
            callback: handleGoogleCallback,
            auto_select: false,
            cancel_on_tap_outside: true
        });
        
        // Render button if container exists
        const buttonContainer = document.getElementById('google-signin-button');
        if (buttonContainer) {
            google.accounts.id.renderButton(buttonContainer, {
                type: 'standard',
                theme: 'outline',
                size: 'large',
                text: 'signin_with',
                shape: 'rectangular',
                width: 300
            });
        }
    }
    
    /**
     * Handle Google Sign-In callback
     */
    async function handleGoogleCallback(response) {
        try {
            showLoadingOverlay('Signing in...');
            
            const result = await API.post('/auth/google/login', {
                token: response.credential
            });
            
            if (result.success) {
                // Store token and user info
                setToken(result.data.token);
                setUser(result.data.user);
                
                // Start token refresh timer
                startTokenRefresh();
                
                // Redirect to dashboard
                window.location.href = CONFIG.ROUTES.DASHBOARD;
            } else {
                hideLoadingOverlay();
                Utils.showToast(result.message || 'Login failed', 'error');
            }
        } catch (error) {
            hideLoadingOverlay();
            console.error('Login error:', error);
            Utils.showToast('Login failed. Please try again.', 'error');
        }
    }
    
    /**
     * Get stored token
     */
    function getToken() {
        return localStorage.getItem(CONFIG.TOKEN_KEY);
    }
    
    /**
     * Set token in storage
     */
    function setToken(token) {
        localStorage.setItem(CONFIG.TOKEN_KEY, token);
    }
    
    /**
     * Remove token from storage
     */
    function removeToken() {
        localStorage.removeItem(CONFIG.TOKEN_KEY);
    }
    
    /**
     * Get stored user
     */
    function getUser() {
        if (currentUser) return currentUser;
        
        const userStr = localStorage.getItem(CONFIG.USER_KEY);
        if (userStr) {
            try {
                currentUser = JSON.parse(userStr);
                return currentUser;
            } catch (e) {
                return null;
            }
        }
        return null;
    }
    
    /**
     * Set user in storage
     */
    function setUser(user) {
        currentUser = user;
        localStorage.setItem(CONFIG.USER_KEY, JSON.stringify(user));
    }
    
    /**
     * Remove user from storage
     */
    function removeUser() {
        currentUser = null;
        localStorage.removeItem(CONFIG.USER_KEY);
    }
    
    /**
     * Check if user is authenticated
     */
    function isAuthenticated() {
        const token = getToken();
        const user = getUser();
        return !!(token && user);
    }
    
    /**
     * Check if token is expired
     */
    function isTokenExpired() {
        const token = getToken();
        if (!token) return true;
        
        try {
            // Decode JWT token (base64)
            const payload = JSON.parse(atob(token.split('.')[1]));
            const expiry = payload.exp * 1000; // Convert to milliseconds
            return Date.now() >= expiry;
        } catch (e) {
            return true;
        }
    }
    
    /**
     * Refresh token
     */
    async function refreshToken() {
        try {
            const result = await API.post('/auth/refresh-token');
            if (result.success) {
                setToken(result.data.token);
                return true;
            }
            return false;
        } catch (error) {
            console.error('Token refresh error:', error);
            return false;
        }
    }
    
    /**
     * Start token refresh timer
     */
    function startTokenRefresh() {
        if (tokenRefreshTimer) {
            clearInterval(tokenRefreshTimer);
        }
        
        tokenRefreshTimer = setInterval(async () => {
            if (isAuthenticated() && !isTokenExpired()) {
                await refreshToken();
            }
        }, CONFIG.TOKEN_REFRESH_INTERVAL);
    }
    
    /**
     * Stop token refresh timer
     */
    function stopTokenRefresh() {
        if (tokenRefreshTimer) {
            clearInterval(tokenRefreshTimer);
            tokenRefreshTimer = null;
        }
    }
    
    /**
     * Logout user
     */
    async function logout() {
        try {
            await API.post('/auth/logout');
        } catch (error) {
            console.error('Logout error:', error);
        } finally {
            // Clear local storage
            removeToken();
            removeUser();
            stopTokenRefresh();
            
            // Revoke Google token if available
            if (typeof google !== 'undefined') {
                google.accounts.id.disableAutoSelect();
            }
            
            // Redirect to login
            window.location.href = CONFIG.ROUTES.LOGIN;
        }
    }
    
    /**
     * Check if user has role
     */
    function hasRole(role) {
        const user = getUser();
        if (!user) return false;
        
        if (Array.isArray(role)) {
            return role.includes(user.role);
        }
        return user.role === role;
    }
    
    /**
     * Check if user has permission
     */
    function hasPermission(module, action = 'view') {
        const user = getUser();
        if (!user) return false;
        
        // Admin has all permissions
        if (user.role === CONFIG.ROLES.ADMIN) return true;
        
        // Check specific permission
        if (user.permissions && user.permissions[module]) {
            return user.permissions[module][action] === true;
        }
        
        return false;
    }
    
    /**
     * Require authentication - redirect if not authenticated
     */
    function requireAuth() {
        if (!isAuthenticated() || isTokenExpired()) {
            window.location.href = CONFIG.ROUTES.LOGIN;
            return false;
        }
        return true;
    }
    
    /**
     * Require specific role
     */
    function requireRole(role) {
        if (!requireAuth()) return false;
        
        if (!hasRole(role)) {
            Utils.showToast('You do not have permission to access this page', 'error');
            window.location.href = CONFIG.ROUTES.DASHBOARD;
            return false;
        }
        return true;
    }
    
    /**
     * Guard route based on permission
     */
    function guardRoute(module, action = 'view') {
        if (!requireAuth()) return false;
        
        if (!hasPermission(module, action)) {
            Utils.showToast('You do not have permission to access this feature', 'error');
            return false;
        }
        return true;
    }
    
    /**
     * Show loading overlay
     */
    function showLoadingOverlay(message = 'Loading...') {
        let overlay = document.getElementById('loading-overlay');
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = 'loading-overlay';
            overlay.className = 'loading-overlay';
            overlay.innerHTML = `
                <div class="loading-content">
                    <div class="loading-spinner"></div>
                    <p class="loading-text">${message}</p>
                </div>
            `;
            document.body.appendChild(overlay);
        } else {
            overlay.querySelector('.loading-text').textContent = message;
            overlay.classList.remove('hidden');
        }
    }
    
    /**
     * Hide loading overlay
     */
    function hideLoadingOverlay() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.add('hidden');
        }
    }
    
    /**
     * Initialize authentication state
     */
    async function init() {
        // Check if already authenticated
        if (isAuthenticated() && !isTokenExpired()) {
            startTokenRefresh();
            return true;
        }
        
        // Check for token expiry
        if (isAuthenticated() && isTokenExpired()) {
            const refreshed = await refreshToken();
            if (!refreshed) {
                logout();
                return false;
            }
            startTokenRefresh();
            return true;
        }
        
        return false;
    }
    
    // Public API
    return {
        init,
        initGoogleAuth,
        handleGoogleCallback,
        getToken,
        getUser,
        setUser,
        isAuthenticated,
        isTokenExpired,
        refreshToken,
        logout,
        hasRole,
        hasPermission,
        requireAuth,
        requireRole,
        guardRoute,
        showLoadingOverlay,
        hideLoadingOverlay
    };
})();

// Make Auth globally available
window.Auth = Auth;
