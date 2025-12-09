/**
 * HRMS Utilities Module
 * Contains helper functions used across the application
 */

const Utils = (function() {
    'use strict';
    
    // =========================================
    // Toast Notifications
    // =========================================
    
    /**
     * Show toast notification
     */
    function showToast(message, type = 'info', duration = CONFIG.TOAST_DURATION) {
        // Get or create toast container
        let container = document.getElementById('toast-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'toast-container';
            container.className = 'toast-container';
            document.body.appendChild(container);
        }
        
        // Create toast element
        const toast = document.createElement('div');
        toast.className = `toast toast-${type}`;
        
        // Icon based on type
        const icons = {
            success: '<i class="fas fa-check-circle"></i>',
            error: '<i class="fas fa-exclamation-circle"></i>',
            warning: '<i class="fas fa-exclamation-triangle"></i>',
            info: '<i class="fas fa-info-circle"></i>'
        };
        
        toast.innerHTML = `
            ${icons[type] || icons.info}
            <span class="toast-message">${escapeHtml(message)}</span>
            <button class="toast-close" onclick="this.parentElement.remove()">
                <i class="fas fa-times"></i>
            </button>
        `;
        
        container.appendChild(toast);
        
        // Trigger animation
        requestAnimationFrame(() => {
            toast.classList.add('show');
        });
        
        // Auto remove
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 300);
        }, duration);
    }
    
    // =========================================
    // Date/Time Utilities
    // =========================================
    
    /**
     * Format date to display format
     */
    function formatDate(date, format = CONFIG.DISPLAY_DATE_FORMAT) {
        if (!date) return '';
        
        const d = new Date(date);
        if (isNaN(d.getTime())) return '';
        
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        const day = String(d.getDate()).padStart(2, '0');
        const month = months[d.getMonth()];
        const year = d.getFullYear();
        const hours = String(d.getHours()).padStart(2, '0');
        const minutes = String(d.getMinutes()).padStart(2, '0');
        
        switch(format) {
            case 'YYYY-MM-DD':
                return `${year}-${String(d.getMonth() + 1).padStart(2, '0')}-${day}`;
            case 'DD MMM YYYY':
                return `${day} ${month} ${year}`;
            case 'DD MMM YYYY, HH:mm':
                return `${day} ${month} ${year}, ${hours}:${minutes}`;
            case 'HH:mm':
                return `${hours}:${minutes}`;
            default:
                return `${day} ${month} ${year}`;
        }
    }
    
    /**
     * Get relative time (e.g., "2 hours ago")
     */
    function relativeTime(date) {
        if (!date) return '';
        
        const d = new Date(date);
        const now = new Date();
        const diff = now - d;
        
        const seconds = Math.floor(diff / 1000);
        const minutes = Math.floor(seconds / 60);
        const hours = Math.floor(minutes / 60);
        const days = Math.floor(hours / 24);
        
        if (seconds < 60) return 'Just now';
        if (minutes < 60) return `${minutes} minute${minutes > 1 ? 's' : ''} ago`;
        if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;
        if (days < 7) return `${days} day${days > 1 ? 's' : ''} ago`;
        
        return formatDate(date);
    }
    
    /**
     * Get today's date in YYYY-MM-DD format
     */
    function getToday() {
        return formatDate(new Date(), 'YYYY-MM-DD');
    }
    
    /**
     * Get current time in HH:mm format
     */
    function getCurrentTime() {
        return formatDate(new Date(), 'HH:mm');
    }
    
    // =========================================
    // String Utilities
    // =========================================
    
    /**
     * Escape HTML to prevent XSS
     */
    function escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
    
    /**
     * Truncate text with ellipsis
     */
    function truncate(text, maxLength = 50) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength) + '...';
    }
    
    /**
     * Capitalize first letter
     */
    function capitalize(text) {
        if (!text) return '';
        return text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
    }
    
    /**
     * Convert to title case
     */
    function titleCase(text) {
        if (!text) return '';
        return text.split(' ').map(capitalize).join(' ');
    }
    
    /**
     * Slugify string
     */
    function slugify(text) {
        if (!text) return '';
        return text
            .toLowerCase()
            .replace(/[^\w\s-]/g, '')
            .replace(/[\s_-]+/g, '-')
            .replace(/^-+|-+$/g, '');
    }
    
    /**
     * Generate random string
     */
    function randomString(length = 8) {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        let result = '';
        for (let i = 0; i < length; i++) {
            result += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return result;
    }
    
    // =========================================
    // Number Utilities
    // =========================================
    
    /**
     * Format number with commas
     */
    function formatNumber(num) {
        if (num === null || num === undefined) return '';
        return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    }
    
    /**
     * Format phone number
     */
    function formatPhone(phone) {
        if (!phone) return '';
        const cleaned = phone.replace(/\D/g, '');
        if (cleaned.length === 10) {
            return `${cleaned.slice(0, 5)}-${cleaned.slice(5)}`;
        }
        return phone;
    }
    
    /**
     * Generate random number between min and max
     */
    function randomNumber(min, max) {
        return Math.floor(Math.random() * (max - min + 1)) + min;
    }
    
    // =========================================
    // Validation Utilities
    // =========================================
    
    /**
     * Validate email
     */
    function isValidEmail(email) {
        const regex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
        return regex.test(email);
    }
    
    /**
     * Validate phone number (Indian format)
     */
    function isValidPhone(phone) {
        const regex = /^[6-9]\d{9}$/;
        return regex.test(phone.replace(/\D/g, ''));
    }
    
    /**
     * Validate file extension
     */
    function isValidFileType(filename, allowedExtensions) {
        const ext = '.' + filename.split('.').pop().toLowerCase();
        return allowedExtensions.includes(ext);
    }
    
    /**
     * Validate file size
     */
    function isValidFileSize(fileSize, maxSize = CONFIG.MAX_FILE_SIZE) {
        return fileSize <= maxSize;
    }
    
    // =========================================
    // DOM Utilities
    // =========================================
    
    /**
     * Query selector shorthand
     */
    function $(selector, parent = document) {
        return parent.querySelector(selector);
    }
    
    /**
     * Query selector all shorthand
     */
    function $$(selector, parent = document) {
        return Array.from(parent.querySelectorAll(selector));
    }
    
    /**
     * Create element with attributes
     */
    function createElement(tag, attributes = {}, children = []) {
        const element = document.createElement(tag);
        
        Object.entries(attributes).forEach(([key, value]) => {
            if (key === 'className') {
                element.className = value;
            } else if (key === 'dataset') {
                Object.entries(value).forEach(([dataKey, dataValue]) => {
                    element.dataset[dataKey] = dataValue;
                });
            } else if (key.startsWith('on')) {
                element.addEventListener(key.slice(2).toLowerCase(), value);
            } else {
                element.setAttribute(key, value);
            }
        });
        
        children.forEach(child => {
            if (typeof child === 'string') {
                element.appendChild(document.createTextNode(child));
            } else {
                element.appendChild(child);
            }
        });
        
        return element;
    }
    
    /**
     * Show element
     */
    function show(element) {
        if (typeof element === 'string') {
            element = $(element);
        }
        if (element) {
            element.classList.remove('hidden');
        }
    }
    
    /**
     * Hide element
     */
    function hide(element) {
        if (typeof element === 'string') {
            element = $(element);
        }
        if (element) {
            element.classList.add('hidden');
        }
    }
    
    /**
     * Toggle element visibility
     */
    function toggle(element) {
        if (typeof element === 'string') {
            element = $(element);
        }
        if (element) {
            element.classList.toggle('hidden');
        }
    }
    
    /**
     * Add event listener to multiple elements
     */
    function addEventListeners(selector, event, handler, parent = document) {
        $$(selector, parent).forEach(el => el.addEventListener(event, handler));
    }
    
    /**
     * Delegate event handling
     */
    function delegate(parent, selector, event, handler) {
        if (typeof parent === 'string') {
            parent = $(parent);
        }
        if (parent) {
            parent.addEventListener(event, (e) => {
                const target = e.target.closest(selector);
                if (target && parent.contains(target)) {
                    handler.call(target, e);
                }
            });
        }
    }
    
    // =========================================
    // Storage Utilities
    // =========================================
    
    /**
     * Get from localStorage
     */
    function getStorage(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (e) {
            return defaultValue;
        }
    }
    
    /**
     * Set to localStorage
     */
    function setStorage(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (e) {
            return false;
        }
    }
    
    /**
     * Remove from localStorage
     */
    function removeStorage(key) {
        localStorage.removeItem(key);
    }
    
    // =========================================
    // URL Utilities
    // =========================================
    
    /**
     * Get URL parameters
     */
    function getUrlParams() {
        const params = new URLSearchParams(window.location.search);
        const result = {};
        params.forEach((value, key) => {
            result[key] = value;
        });
        return result;
    }
    
    /**
     * Get specific URL parameter
     */
    function getUrlParam(key, defaultValue = null) {
        const params = new URLSearchParams(window.location.search);
        return params.get(key) || defaultValue;
    }
    
    /**
     * Update URL parameter without reload
     */
    function updateUrlParam(key, value) {
        const url = new URL(window.location);
        if (value === null || value === undefined) {
            url.searchParams.delete(key);
        } else {
            url.searchParams.set(key, value);
        }
        window.history.pushState({}, '', url);
    }
    
    // =========================================
    // Form Utilities
    // =========================================
    
    /**
     * Get form data as object
     */
    function getFormData(form) {
        if (typeof form === 'string') {
            form = $(form);
        }
        if (!form) return {};
        
        const formData = new FormData(form);
        const data = {};
        formData.forEach((value, key) => {
            if (data[key]) {
                if (!Array.isArray(data[key])) {
                    data[key] = [data[key]];
                }
                data[key].push(value);
            } else {
                data[key] = value;
            }
        });
        return data;
    }
    
    /**
     * Set form data from object
     */
    function setFormData(form, data) {
        if (typeof form === 'string') {
            form = $(form);
        }
        if (!form || !data) return;
        
        Object.entries(data).forEach(([key, value]) => {
            const field = form.elements[key];
            if (field) {
                if (field.type === 'checkbox') {
                    field.checked = Boolean(value);
                } else if (field.type === 'radio') {
                    const radio = form.querySelector(`input[name="${key}"][value="${value}"]`);
                    if (radio) radio.checked = true;
                } else {
                    field.value = value;
                }
            }
        });
    }
    
    /**
     * Reset form
     */
    function resetForm(form) {
        if (typeof form === 'string') {
            form = $(form);
        }
        if (form) {
            form.reset();
        }
    }
    
    /**
     * Validate form
     */
    function validateForm(form) {
        if (typeof form === 'string') {
            form = $(form);
        }
        if (!form) return false;
        
        // Clear previous errors
        $$('.form-error', form).forEach(el => el.remove());
        $$('.is-invalid', form).forEach(el => el.classList.remove('is-invalid'));
        
        let isValid = true;
        
        // Check required fields
        $$('[required]', form).forEach(field => {
            if (!field.value.trim()) {
                showFieldError(field, 'This field is required');
                isValid = false;
            }
        });
        
        // Check email fields
        $$('input[type="email"]', form).forEach(field => {
            if (field.value && !isValidEmail(field.value)) {
                showFieldError(field, 'Please enter a valid email');
                isValid = false;
            }
        });
        
        // Check phone fields
        $$('input[type="tel"]', form).forEach(field => {
            if (field.value && !isValidPhone(field.value)) {
                showFieldError(field, 'Please enter a valid phone number');
                isValid = false;
            }
        });
        
        return isValid;
    }
    
    /**
     * Show field error
     */
    function showFieldError(field, message) {
        field.classList.add('is-invalid');
        const error = createElement('span', { className: 'form-error' }, [message]);
        field.parentNode.appendChild(error);
    }
    
    // =========================================
    // Debounce & Throttle
    // =========================================
    
    /**
     * Debounce function
     */
    function debounce(func, wait = 300) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        };
    }
    
    /**
     * Throttle function
     */
    function throttle(func, limit = 300) {
        let inThrottle;
        return function executedFunction(...args) {
            if (!inThrottle) {
                func(...args);
                inThrottle = true;
                setTimeout(() => inThrottle = false, limit);
            }
        };
    }
    
    // =========================================
    // Copy to Clipboard
    // =========================================
    
    /**
     * Copy text to clipboard
     */
    async function copyToClipboard(text) {
        try {
            await navigator.clipboard.writeText(text);
            showToast('Copied to clipboard', 'success');
            return true;
        } catch (e) {
            // Fallback for older browsers
            const textArea = document.createElement('textarea');
            textArea.value = text;
            textArea.style.position = 'fixed';
            textArea.style.left = '-999999px';
            document.body.appendChild(textArea);
            textArea.select();
            try {
                document.execCommand('copy');
                showToast('Copied to clipboard', 'success');
                return true;
            } catch (err) {
                showToast('Failed to copy', 'error');
                return false;
            } finally {
                textArea.remove();
            }
        }
    }
    
    // =========================================
    // Modal Utilities
    // =========================================
    
    /**
     * Open modal
     */
    function openModal(modalId) {
        const modal = typeof modalId === 'string' ? $(`#${modalId}`) : modalId;
        if (modal) {
            modal.classList.add('active');
            document.body.classList.add('modal-open');
        }
    }
    
    /**
     * Close modal
     */
    function closeModal(modalId) {
        const modal = typeof modalId === 'string' ? $(`#${modalId}`) : modalId;
        if (modal) {
            modal.classList.remove('active');
            document.body.classList.remove('modal-open');
        }
    }
    
    /**
     * Confirm dialog
     */
    function confirm(message, title = 'Confirm') {
        return new Promise((resolve) => {
            const modal = createElement('div', { className: 'modal active', id: 'confirm-modal' }, [
                createElement('div', { className: 'modal-overlay', onclick: () => {
                    closeModal('confirm-modal');
                    resolve(false);
                }}),
                createElement('div', { className: 'modal-container' }, [
                    createElement('div', { className: 'modal-header' }, [
                        createElement('h3', { className: 'modal-title' }, [title])
                    ]),
                    createElement('div', { className: 'modal-body' }, [
                        createElement('p', {}, [message])
                    ]),
                    createElement('div', { className: 'modal-footer' }, [
                        createElement('button', { 
                            className: 'btn btn-secondary',
                            onclick: () => {
                                modal.remove();
                                document.body.classList.remove('modal-open');
                                resolve(false);
                            }
                        }, ['Cancel']),
                        createElement('button', { 
                            className: 'btn btn-danger',
                            onclick: () => {
                                modal.remove();
                                document.body.classList.remove('modal-open');
                                resolve(true);
                            }
                        }, ['Confirm'])
                    ])
                ])
            ]);
            
            document.body.appendChild(modal);
            document.body.classList.add('modal-open');
        });
    }
    
    // =========================================
    // Table Utilities
    // =========================================
    
    /**
     * Sort table by column
     */
    function sortTable(tableId, columnIndex, direction = 'asc') {
        const table = $(`#${tableId}`);
        if (!table) return;
        
        const tbody = $('tbody', table);
        const rows = Array.from($$('tr', tbody));
        
        rows.sort((a, b) => {
            const aVal = $$('td', a)[columnIndex]?.textContent.trim() || '';
            const bVal = $$('td', b)[columnIndex]?.textContent.trim() || '';
            
            // Try numeric comparison
            const aNum = parseFloat(aVal);
            const bNum = parseFloat(bVal);
            
            if (!isNaN(aNum) && !isNaN(bNum)) {
                return direction === 'asc' ? aNum - bNum : bNum - aNum;
            }
            
            // String comparison
            return direction === 'asc' 
                ? aVal.localeCompare(bVal)
                : bVal.localeCompare(aVal);
        });
        
        tbody.innerHTML = '';
        rows.forEach(row => tbody.appendChild(row));
    }
    
    /**
     * Filter table rows
     */
    function filterTable(tableId, searchTerm, columnIndices = []) {
        const table = $(`#${tableId}`);
        if (!table) return;
        
        const term = searchTerm.toLowerCase();
        
        $$('tbody tr', table).forEach(row => {
            const cells = $$('td', row);
            let found = false;
            
            if (columnIndices.length === 0) {
                // Search all columns
                found = cells.some(cell => cell.textContent.toLowerCase().includes(term));
            } else {
                // Search specific columns
                found = columnIndices.some(index => 
                    cells[index]?.textContent.toLowerCase().includes(term)
                );
            }
            
            row.style.display = found ? '' : 'none';
        });
    }
    
    // Public API
    return {
        // Toast
        showToast,
        
        // Date/Time
        formatDate,
        relativeTime,
        getToday,
        getCurrentTime,
        
        // String
        escapeHtml,
        truncate,
        capitalize,
        titleCase,
        slugify,
        randomString,
        
        // Number
        formatNumber,
        formatPhone,
        randomNumber,
        
        // Validation
        isValidEmail,
        isValidPhone,
        isValidFileType,
        isValidFileSize,
        
        // DOM
        $,
        $$,
        createElement,
        show,
        hide,
        toggle,
        addEventListeners,
        delegate,
        
        // Storage
        getStorage,
        setStorage,
        removeStorage,
        
        // URL
        getUrlParams,
        getUrlParam,
        updateUrlParam,
        
        // Form
        getFormData,
        setFormData,
        resetForm,
        validateForm,
        showFieldError,
        
        // Functions
        debounce,
        throttle,
        
        // Clipboard
        copyToClipboard,
        
        // Modal
        openModal,
        closeModal,
        confirm,
        
        // Table
        sortTable,
        filterTable
    };
})();

// Make Utils globally available
window.Utils = Utils;

// Shorthand access
window.$ = Utils.$;
window.$$ = Utils.$$;
