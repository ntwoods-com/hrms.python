/**
 * HRMS Candidate Module
 * Handles candidate-facing functionality - walk-in form, tests
 */

const Candidate = (function() {
    'use strict';
    
    let mathQuestion = null;
    let candidateData = {};
    let currentStep = 1;
    let testData = {};
    
    // =========================================
    // Initialization
    // =========================================
    
    /**
     * Initialize candidate module
     */
    async function init() {
        setupEventListeners();
        
        // Determine which page we're on
        const page = getCandidatePage();
        
        switch(page) {
            case 'walkin-form':
                await initWalkinForm();
                break;
            case 'tests':
                await initTests();
                break;
        }
    }
    
    /**
     * Get current candidate page
     */
    function getCandidatePage() {
        const path = window.location.pathname;
        if (path.includes('test')) return 'tests';
        return 'walkin-form';
    }
    
    /**
     * Setup event listeners
     */
    function setupEventListeners() {
        // Walk-in form
        const walkinForm = Utils.$('#walkin-form');
        if (walkinForm) {
            walkinForm.addEventListener('submit', handleWalkinFormSubmit);
        }
        
        // Math verification
        const mathVerifyBtn = Utils.$('#verify-math');
        if (mathVerifyBtn) {
            mathVerifyBtn.addEventListener('click', verifyMathAnswer);
        }
        
        // Refresh math question
        const refreshMathBtn = Utils.$('#refresh-math');
        if (refreshMathBtn) {
            refreshMathBtn.addEventListener('click', generateMathQuestion);
        }
        
        // Photo capture
        const captureBtn = Utils.$('#capture-photo');
        if (captureBtn) {
            captureBtn.addEventListener('click', capturePhoto);
        }
        
        const retakeBtn = Utils.$('#retake-photo');
        if (retakeBtn) {
            retakeBtn.addEventListener('click', retakePhoto);
        }
        
        // Form steps navigation
        Utils.addEventListeners('.btn-next', 'click', nextStep);
        Utils.addEventListeners('.btn-prev', 'click', prevStep);
        
        // Test forms
        const excelTestForm = Utils.$('#excel-test-form');
        if (excelTestForm) {
            excelTestForm.addEventListener('submit', handleExcelTestSubmit);
        }
        
        const tallyTestForm = Utils.$('#tally-test-form');
        if (tallyTestForm) {
            tallyTestForm.addEventListener('submit', handleTallyTestSubmit);
        }
        
        const voiceTestForm = Utils.$('#voice-test-form');
        if (voiceTestForm) {
            voiceTestForm.addEventListener('submit', handleVoiceTestSubmit);
        }
        
        // Role selection for tests
        const roleSelect = Utils.$('#test-role');
        if (roleSelect) {
            roleSelect.addEventListener('change', handleTestRoleChange);
        }
    }
    
    // =========================================
    // Walk-in Form
    // =========================================
    
    /**
     * Initialize walk-in form
     */
    async function initWalkinForm() {
        // Generate math question
        await generateMathQuestion();
        
        // Initialize camera
        initializeCamera();
        
        // Show first step
        showStep(1);
    }
    
    /**
     * Generate random math question
     */
    async function generateMathQuestion() {
        try {
            const response = await API.walkin.getMathQuestion();
            mathQuestion = response.data;
            
            const questionEl = Utils.$('#math-question');
            if (questionEl) {
                questionEl.textContent = mathQuestion.question;
            }
            
            // Clear previous answer
            const answerInput = Utils.$('#math-answer');
            if (answerInput) {
                answerInput.value = '';
                answerInput.disabled = false;
            }
            
            // Reset verification status
            const verifyBtn = Utils.$('#verify-math');
            if (verifyBtn) {
                verifyBtn.disabled = false;
                verifyBtn.innerHTML = '<i class="fas fa-check"></i> Verify';
            }
            
            Utils.$('#math-status')?.classList.add('hidden');
        } catch (error) {
            // Generate locally as fallback
            generateLocalMathQuestion();
        }
    }
    
    /**
     * Generate math question locally (fallback)
     */
    function generateLocalMathQuestion() {
        const operations = ['+', '-', '×'];
        const operation = operations[Math.floor(Math.random() * operations.length)];
        
        let num1, num2, answer;
        
        switch(operation) {
            case '+':
                num1 = Utils.randomNumber(10, 99);
                num2 = Utils.randomNumber(10, 99);
                answer = num1 + num2;
                break;
            case '-':
                num1 = Utils.randomNumber(50, 99);
                num2 = Utils.randomNumber(10, num1);
                answer = num1 - num2;
                break;
            case '×':
                num1 = Utils.randomNumber(2, 12);
                num2 = Utils.randomNumber(2, 12);
                answer = num1 * num2;
                break;
        }
        
        mathQuestion = {
            question: `${num1} ${operation} ${num2} = ?`,
            answer: answer,
            id: Utils.randomString(8)
        };
        
        const questionEl = Utils.$('#math-question');
        if (questionEl) {
            questionEl.textContent = mathQuestion.question;
        }
    }
    
    /**
     * Verify math answer
     */
    async function verifyMathAnswer() {
        const answerInput = Utils.$('#math-answer');
        const userAnswer = parseInt(answerInput.value, 10);
        
        if (isNaN(userAnswer)) {
            Utils.showToast('Please enter a valid number', 'warning');
            return;
        }
        
        const statusEl = Utils.$('#math-status');
        
        try {
            const response = await API.walkin.verifyMathAnswer({
                question_id: mathQuestion.id,
                answer: userAnswer
            });
            
            if (response.data.correct) {
                statusEl.innerHTML = '<i class="fas fa-check-circle"></i> Correct!';
                statusEl.className = 'math-status success';
                statusEl.classList.remove('hidden');
                
                answerInput.disabled = true;
                Utils.$('#verify-math').disabled = true;
                
                // Enable next step
                candidateData.mathVerified = true;
            } else {
                statusEl.innerHTML = '<i class="fas fa-times-circle"></i> Incorrect. Try again.';
                statusEl.className = 'math-status error';
                statusEl.classList.remove('hidden');
            }
        } catch (error) {
            // Verify locally as fallback
            if (userAnswer === mathQuestion.answer) {
                statusEl.innerHTML = '<i class="fas fa-check-circle"></i> Correct!';
                statusEl.className = 'math-status success';
                statusEl.classList.remove('hidden');
                
                answerInput.disabled = true;
                Utils.$('#verify-math').disabled = true;
                candidateData.mathVerified = true;
            } else {
                statusEl.innerHTML = '<i class="fas fa-times-circle"></i> Incorrect. Try again.';
                statusEl.className = 'math-status error';
                statusEl.classList.remove('hidden');
            }
        }
    }
    
    // =========================================
    // Camera/Photo Capture
    // =========================================
    
    let videoStream = null;
    
    /**
     * Initialize camera
     */
    async function initializeCamera() {
        const video = Utils.$('#camera-preview');
        if (!video) return;
        
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ 
                video: { facingMode: 'user', width: 640, height: 480 },
                audio: false 
            });
            
            videoStream = stream;
            video.srcObject = stream;
            video.play();
            
            Utils.$('#camera-container').classList.remove('hidden');
        } catch (error) {
            console.error('Camera access denied:', error);
            Utils.$('#camera-error').classList.remove('hidden');
            Utils.showToast('Camera access denied. Please allow camera access.', 'error');
        }
    }
    
    /**
     * Capture photo from video stream
     */
    function capturePhoto() {
        const video = Utils.$('#camera-preview');
        const canvas = Utils.$('#photo-canvas');
        const preview = Utils.$('#photo-preview');
        
        if (!video || !canvas) return;
        
        const ctx = canvas.getContext('2d');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        ctx.drawImage(video, 0, 0);
        
        // Get image data
        const imageData = canvas.toDataURL('image/jpeg', 0.8);
        candidateData.photo = imageData;
        
        // Show preview
        preview.src = imageData;
        preview.classList.remove('hidden');
        
        Utils.$('#camera-preview').classList.add('hidden');
        Utils.$('#capture-photo').classList.add('hidden');
        Utils.$('#retake-photo').classList.remove('hidden');
    }
    
    /**
     * Retake photo
     */
    function retakePhoto() {
        const video = Utils.$('#camera-preview');
        const preview = Utils.$('#photo-preview');
        
        candidateData.photo = null;
        
        preview.classList.add('hidden');
        video.classList.remove('hidden');
        Utils.$('#capture-photo').classList.remove('hidden');
        Utils.$('#retake-photo').classList.add('hidden');
    }
    
    /**
     * Stop camera stream
     */
    function stopCamera() {
        if (videoStream) {
            videoStream.getTracks().forEach(track => track.stop());
            videoStream = null;
        }
    }
    
    // =========================================
    // Form Steps
    // =========================================
    
    /**
     * Show specific step
     */
    function showStep(step) {
        currentStep = step;
        
        // Hide all steps
        Utils.$$('.form-step').forEach(s => s.classList.remove('active'));
        
        // Show current step
        const currentStepEl = Utils.$(`.form-step[data-step="${step}"]`);
        if (currentStepEl) {
            currentStepEl.classList.add('active');
        }
        
        // Update progress indicators
        Utils.$$('.step-indicator').forEach(indicator => {
            const indicatorStep = parseInt(indicator.dataset.step, 10);
            indicator.classList.remove('active', 'completed');
            
            if (indicatorStep < step) {
                indicator.classList.add('completed');
            } else if (indicatorStep === step) {
                indicator.classList.add('active');
            }
        });
    }
    
    /**
     * Go to next step
     */
    function nextStep() {
        // Validate current step
        if (!validateStep(currentStep)) return;
        
        if (currentStep < 4) {
            showStep(currentStep + 1);
        }
    }
    
    /**
     * Go to previous step
     */
    function prevStep() {
        if (currentStep > 1) {
            showStep(currentStep - 1);
        }
    }
    
    /**
     * Validate current step
     */
    function validateStep(step) {
        switch(step) {
            case 1:
                // Math verification
                if (!candidateData.mathVerified) {
                    Utils.showToast('Please verify the math question first', 'warning');
                    return false;
                }
                return true;
                
            case 2:
                // Personal details
                const personalForm = Utils.$('#personal-details-form');
                if (!personalForm) return true;
                
                const requiredFields = personalForm.querySelectorAll('[required]');
                let valid = true;
                
                requiredFields.forEach(field => {
                    if (!field.value.trim()) {
                        field.classList.add('is-invalid');
                        valid = false;
                    } else {
                        field.classList.remove('is-invalid');
                    }
                });
                
                if (!valid) {
                    Utils.showToast('Please fill all required fields', 'warning');
                }
                
                // Store data
                if (valid) {
                    const formData = Utils.getFormData(personalForm);
                    candidateData = { ...candidateData, ...formData };
                }
                
                return valid;
                
            case 3:
                // Photo capture
                if (!candidateData.photo) {
                    Utils.showToast('Please capture your photo', 'warning');
                    return false;
                }
                return true;
                
            default:
                return true;
        }
    }
    
    /**
     * Handle walk-in form submit
     */
    async function handleWalkinFormSubmit(e) {
        e.preventDefault();
        
        // Get final step data
        const finalForm = Utils.$('#additional-info-form');
        if (finalForm) {
            const formData = Utils.getFormData(finalForm);
            candidateData = { ...candidateData, ...formData };
        }
        
        try {
            Auth.showLoadingOverlay('Submitting your information...');
            
            await API.walkin.submitForm(candidateData);
            
            // Stop camera
            stopCamera();
            
            Auth.hideLoadingOverlay();
            
            // Show success message
            showSuccessMessage();
        } catch (error) {
            Auth.hideLoadingOverlay();
            Utils.showToast('Failed to submit form. Please try again.', 'error');
        }
    }
    
    /**
     * Show success message after form submission
     */
    function showSuccessMessage() {
        const formContainer = Utils.$('.candidate-form-container');
        if (formContainer) {
            formContainer.innerHTML = `
                <div class="success-message">
                    <div class="success-icon">
                        <i class="fas fa-check-circle"></i>
                    </div>
                    <h2>Thank You!</h2>
                    <p>Your information has been submitted successfully.</p>
                    <p>Please wait for your turn. Our HR team will call you shortly.</p>
                    <div class="token-number">
                        <span>Your Token Number</span>
                        <strong>${candidateData.token || 'W-' + Utils.randomNumber(100, 999)}</strong>
                    </div>
                </div>
            `;
        }
    }
    
    // =========================================
    // Tests (Excel, Tally, Voice)
    // =========================================
    
    /**
     * Initialize tests
     */
    async function initTests() {
        const candidateId = Utils.getUrlParam('id');
        const testType = Utils.getUrlParam('type');
        
        if (!candidateId) {
            Utils.showToast('Invalid test link', 'error');
            return;
        }
        
        testData.candidateId = candidateId;
        testData.testType = testType;
        
        // Show appropriate test form
        if (testType) {
            showTestForm(testType);
        }
    }
    
    /**
     * Handle test role change
     */
    function handleTestRoleChange(e) {
        const role = e.target.value;
        
        // Determine which tests to show based on role
        const testConfig = {
            'CRM': ['excel', 'voice'],
            'MIS': ['excel', 'tally'],
            'Jr. Accountant': ['excel', 'tally'],
            'Sr. Accountant': ['excel', 'tally'],
            'CCE': ['voice'],
            'PC': ['excel', 'voice']
        };
        
        const tests = testConfig[role] || [];
        
        // Show/hide test sections
        Utils.$$('.test-section').forEach(section => {
            const sectionType = section.dataset.test;
            if (tests.includes(sectionType)) {
                section.classList.remove('hidden');
            } else {
                section.classList.add('hidden');
            }
        });
    }
    
    /**
     * Show specific test form
     */
    function showTestForm(type) {
        Utils.$$('.test-section').forEach(section => {
            section.classList.add('hidden');
        });
        
        const testSection = Utils.$(`.test-section[data-test="${type}"]`);
        if (testSection) {
            testSection.classList.remove('hidden');
        }
    }
    
    /**
     * Handle Excel test submit
     */
    async function handleExcelTestSubmit(e) {
        e.preventDefault();
        
        const formData = Utils.getFormData(this);
        formData.test_type = 'excel';
        formData.candidate_id = testData.candidateId;
        
        await submitTest(formData);
    }
    
    /**
     * Handle Tally test submit
     */
    async function handleTallyTestSubmit(e) {
        e.preventDefault();
        
        const formData = Utils.getFormData(this);
        formData.test_type = 'tally';
        formData.candidate_id = testData.candidateId;
        
        await submitTest(formData);
    }
    
    /**
     * Handle Voice test submit
     */
    async function handleVoiceTestSubmit(e) {
        e.preventDefault();
        
        const formData = Utils.getFormData(this);
        formData.test_type = 'voice';
        formData.candidate_id = testData.candidateId;
        
        await submitTest(formData);
    }
    
    /**
     * Submit test results
     */
    async function submitTest(formData) {
        try {
            Auth.showLoadingOverlay('Submitting test results...');
            
            await API.candidates.updateTests(formData.candidate_id, formData);
            
            Auth.hideLoadingOverlay();
            Utils.showToast('Test submitted successfully', 'success');
            
            // Move to next test or show completion
            showTestComplete();
        } catch (error) {
            Auth.hideLoadingOverlay();
            Utils.showToast('Failed to submit test', 'error');
        }
    }
    
    /**
     * Show test completion message
     */
    function showTestComplete() {
        const container = Utils.$('.test-container');
        if (container) {
            container.innerHTML = `
                <div class="success-message">
                    <div class="success-icon">
                        <i class="fas fa-check-circle"></i>
                    </div>
                    <h2>Test Completed!</h2>
                    <p>Your test has been submitted successfully.</p>
                    <p>Please wait for further instructions from our HR team.</p>
                </div>
            `;
        }
    }
    
    // Public API
    return {
        init,
        generateMathQuestion,
        capturePhoto,
        retakePhoto,
        nextStep,
        prevStep
    };
})();

// Make Candidate globally available
window.Candidate = Candidate;

// Initialize on DOM ready
document.addEventListener('DOMContentLoaded', Candidate.init);
