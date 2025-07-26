// ===== APPLICATION CONFIGURATION =====
const CONFIG = {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/tiff'],
    toastDuration: 4000,
    maxHistoryItems: 10
};

// ===== APPLICATION STATE =====
const appState = {
    selectedFile: null,
    isUploading: false,
    currentResult: null
};

// ===== DOM ELEMENTS CACHE =====
const elements = {
    uploadArea: null,
    fileInput: null,
    fileInfo: null,
    fileName: null,
    resetBtn: null,
    checkBtn: null,
    progressBar: null,
    uploadSection: null,
    analysisResults: null,
    previewImage: null,
    resultTitle: null,
    confidenceBadge: null,
    confidenceText: null,
    probabilityBars: null,
    loadingOverlay: null,
    toast: null,
    scanAnotherBtn: null,
    historyContent: null
};

// ===== INITIALIZATION =====
class TumorDetectionApp {
    constructor() {
        this.init();
    }

    init() {
        this.cacheElements();
        this.bindEvents();
        this.initializeEnhancements();
    }

    cacheElements() {
        const elementIds = Object.keys(elements);
        elementIds.forEach(key => {
            const id = key.charAt(0).toLowerCase() + key.slice(1);
            elements[key] = document.getElementById(id) || document.querySelector(`.${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`);
        });
        
        // Handle existing history items
        this.bindHistoryItems();
    }

    bindHistoryItems() {
        const historyItems = document.querySelectorAll('.history-item[data-filepath]');
        historyItems.forEach(item => {
            item.addEventListener('click', this.handleHistoryItemClick.bind(this));
            item.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    this.handleHistoryItemClick.call(this, event);
                }
            });
        });
    }

    handleHistoryItemClick(event) {
        const item = event.currentTarget;
        const filepath = item.dataset.filepath;
        const result = item.dataset.result;
        const resultType = item.dataset.resultType;
        const confidence = parseFloat(item.dataset.confidence);
        const filename = item.dataset.filename;
        
        this.showHistoryItem(filepath, result, resultType, confidence, filename);
    }

    bindEvents() {
        // File input events
        elements.fileInput?.addEventListener('change', this.handleFileSelect.bind(this));
        
        // Button events
        elements.resetBtn?.addEventListener('click', this.resetUpload.bind(this));
        elements.checkBtn?.addEventListener('click', this.handleAnalyzeClick.bind(this));
        elements.scanAnotherBtn?.addEventListener('click', this.scanAnother.bind(this));
    
    // Drag and drop events
        if (elements.uploadArea) {
            elements.uploadArea.addEventListener('dragover', this.handleDragOver.bind(this));
            elements.uploadArea.addEventListener('dragleave', this.handleDragLeave.bind(this));
            elements.uploadArea.addEventListener('drop', this.handleDrop.bind(this));
            elements.uploadArea.addEventListener('click', this.handleUploadAreaClick.bind(this));
        }
        
        // Global events
        document.addEventListener('dragover', this.preventDefault);
        document.addEventListener('drop', this.preventDefault);
        document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));
        window.addEventListener('resize', this.handleResize.bind(this));
    }

    preventDefault(event) {
        event.preventDefault();
    }

    // ===== FILE HANDLING =====
    handleFileSelect(event) {
    const file = event.target.files[0];
    if (file) {
            this.processFile(file);
    }
}

    handleDragOver(event) {
    event.preventDefault();
        elements.uploadArea?.classList.add('dragover');
}

    handleDragLeave(event) {
    event.preventDefault();
        elements.uploadArea?.classList.remove('dragover');
}

    handleDrop(event) {
    event.preventDefault();
        elements.uploadArea?.classList.remove('dragover');
    
    const files = event.dataTransfer.files;
    if (files.length > 0) {
            this.processFile(files[0]);
        }
    }

    handleUploadAreaClick() {
        if (!appState.selectedFile) {
            elements.fileInput?.click();
        }
    }

    processFile(file) {
    // Validate file type
        if (!CONFIG.allowedTypes.includes(file.type)) {
            this.showToast('Please select a valid image file (JPEG, PNG, GIF, BMP, TIFF).', 'error');
        return;
    }
    
        // Validate file size
        if (file.size > CONFIG.maxFileSize) {
            this.showToast('File size must be less than 10MB.', 'error');
        return;
    }
    
        appState.selectedFile = file;
        this.displayFileInfo(file);
    }

    displayFileInfo(file) {
        if (elements.fileName) {
            elements.fileName.textContent = file.name;
        }
        this.toggleDisplay(elements.fileInfo, true);
        this.toggleDisplay(elements.uploadArea, false);
    }

    // ===== UI CONTROL =====
    toggleDisplay(element, show) {
        if (element) {
            element.style.display = show ? 'block' : 'none';
        }
    }

    resetUpload() {
        if (appState.isUploading) {
            this.showToast('Cannot reset while uploading. Please wait...', 'error');
        return;
    }
    
        this.clearState();
        this.resetAPI();
        this.showToast('Image cleared successfully.', 'success');
    }

    clearState() {
        appState.selectedFile = null;
        appState.currentResult = null;
        
        if (elements.fileInput) {
            elements.fileInput.value = '';
        }
        
        this.toggleDisplay(elements.fileInfo, false);
        this.toggleDisplay(elements.uploadArea, true);
        this.toggleDisplay(elements.analysisResults, false);
    }

    async resetAPI() {
        try {
            await fetch('/reset', {
        method: 'POST',
                headers: { 'Content-Type': 'application/json' }
            });
        } catch (error) {
            console.warn('Reset API call failed:', error);
        }
    }

    // ===== ANALYSIS =====
    handleAnalyzeClick() {
        if (appState.selectedFile) {
            this.uploadFile(appState.selectedFile);
        }
    }

    async uploadFile(file) {
        if (appState.isUploading) return;
        
        appState.isUploading = true;
        this.showLoading(true);
        this.showProgressBar(true);
    
    const formData = new FormData();
    formData.append('file', file);
    
        try {
            const response = await fetch('/upload', {
        method: 'POST',
        body: formData
            });
            
            const data = await response.json();
            
        if (data.success) {
                this.displayResults(data);
                this.updateHistory();
                this.showToast('MRI scan analyzed successfully!', 'success');
        } else {
                this.showToast(data.error || 'An error occurred during analysis.', 'error');
                this.resetUpload();
            }
        } catch (error) {
            console.error('Upload error:', error);
            this.showToast('Network error. Please try again.', 'error');
            this.resetUpload();
        } finally {
            appState.isUploading = false;
            this.showLoading(false);
            this.showProgressBar(false);
        }
    }

    displayResults(data) {
    // Set preview image
        if (elements.previewImage) {
            elements.previewImage.src = data.filepath;
        }
    
    // Set result title and confidence
        if (elements.resultTitle) {
            elements.resultTitle.textContent = data.result;
        }
        if (elements.confidenceText) {
            elements.confidenceText.textContent = `${data.confidence.toFixed(1)}% confidence`;
        }
        
        // Set confidence badge styling
        this.updateConfidenceBadge(data.result_type);
        
        // Create probability bars
        this.createProbabilityBars(data.class_probabilities);
        
        // Update UI layout
        this.toggleDisplay(elements.uploadSection, false);
        this.toggleDisplay(elements.analysisResults, true);
        
        // Store current result
        appState.currentResult = data;
    }

    updateConfidenceBadge(resultType) {
        if (!elements.confidenceBadge) return;
        
        const styles = {
            healthy: {
                background: 'var(--color-success-500)',
                border: '1px solid var(--color-success-100)'
            },
            tumor: {
                background: 'var(--color-error-500)',
                border: '1px solid var(--color-error-100)'
            }
        };
        
        const style = styles[resultType] || styles.tumor;
        Object.assign(elements.confidenceBadge.style, style);
    }

    createProbabilityBars(probabilities) {
        if (!elements.probabilityBars) return;
        
        elements.probabilityBars.innerHTML = '';
    
    // Sort probabilities in descending order
    const sortedProbs = Object.entries(probabilities)
        .sort(([,a], [,b]) => b - a);
    
        const fragment = document.createDocumentFragment();
    
    sortedProbs.forEach(([className, probability]) => {
            const probabilityItem = this.createProbabilityItem(className, probability);
            fragment.appendChild(probabilityItem);
        });
        
        elements.probabilityBars.appendChild(fragment);
        
        // Animate bars
        requestAnimationFrame(() => {
            sortedProbs.forEach(([, probability], index) => {
                const fill = elements.probabilityBars.children[index]?.querySelector('.probability-fill');
                if (fill) {
                    fill.style.width = `${probability}%`;
                }
            });
        });
    }

    createProbabilityItem(className, probability) {
        const probabilityItem = document.createElement('div');
        probabilityItem.className = 'probability-item';
        
        const displayName = className === 'notumor' ? 'No Tumor' : 
                           className.charAt(0).toUpperCase() + className.slice(1);
        
        probabilityItem.innerHTML = `
            <div class="probability-label">${displayName}</div>
            <div class="probability-bar">
                <div class="probability-fill" style="width: 0%"></div>
            </div>
            <div class="probability-value">${probability.toFixed(1)}%</div>
        `;
        
        return probabilityItem;
    }

    // ===== HISTORY MANAGEMENT =====
    updateHistory() {
        if (!appState.currentResult || !elements.historyContent) return;
        
        const historyItem = this.createHistoryItem(appState.currentResult);
        
        // Remove empty history message
        const emptyHistory = elements.historyContent.querySelector('.empty-history');
        emptyHistory?.remove();
        
        // Add to top of history
        elements.historyContent.insertBefore(historyItem, elements.historyContent.firstChild);
        
        // Keep only last CONFIG.maxHistoryItems
        const items = elements.historyContent.querySelectorAll('.history-item');
        if (items.length > CONFIG.maxHistoryItems) {
            items[items.length - 1].remove();
        }
    }

    createHistoryItem(result) {
        const historyItem = document.createElement('div');
        historyItem.className = 'history-item';
        
        const filename = appState.selectedFile?.name || 'Recent scan';
        const timestamp = new Date().toLocaleString();
        
        historyItem.innerHTML = `
            <div class="history-image">
                <img src="${result.filepath}" alt="MRI scan" loading="lazy">
            </div>
            <div class="history-details">
                <div class="history-filename">${filename}</div>
                <div class="history-result ${result.result_type}">${result.result}</div>
                <div class="history-meta">
                    <span class="history-time">${timestamp}</span>
                    <span class="history-confidence">${result.confidence.toFixed(1)}% confidence</span>
                </div>
            </div>
        `;
        
        historyItem.addEventListener('click', () => {
            this.showHistoryItem(result.filepath, result.result, result.result_type, result.confidence, filename);
        });
        
        return historyItem;
    }

    showHistoryItem(imagePath, result, resultType, confidence, filename) {
        // Set preview image
        if (elements.previewImage) {
            elements.previewImage.src = imagePath;
        }
        
        // Set result title and confidence
        if (elements.resultTitle) {
            elements.resultTitle.textContent = result;
        }
        if (elements.confidenceText) {
            elements.confidenceText.textContent = `${confidence.toFixed(1)}% confidence`;
        }
        
        // Update confidence badge
        this.updateConfidenceBadge(resultType);
        
        // Show historical message for probability bars
        if (elements.probabilityBars) {
            elements.probabilityBars.innerHTML = `
                <p style="color: var(--color-gray-500); font-style: italic; text-align: center; padding: var(--spacing-5);">
                    Historical result - detailed probabilities not available.
                </p>
            `;
        }
        
        // Update UI layout
        this.toggleDisplay(elements.uploadSection, false);
        this.toggleDisplay(elements.analysisResults, true);
        
        this.showToast(`Viewing ${filename}`, 'success');
    }

    scanAnother() {
        this.clearState();
        this.toggleDisplay(elements.uploadSection, true);
        this.showToast('Ready for new scan', 'success');
    }

    // ===== UI FEEDBACK =====
    showLoading(show) {
        this.toggleDisplay(elements.loadingOverlay, show);
    }

    showProgressBar(show) {
        this.toggleDisplay(elements.progressBar, show);
        
        if (show && elements.progressBar) {
            const progressFill = elements.progressBar.querySelector('.progress-fill');
            if (progressFill) {
        progressFill.style.width = '0%';
                requestAnimationFrame(() => {
            progressFill.style.width = '100%';
                });
            }
        }
    }

    showToast(message, type = 'success') {
        if (!elements.toast) return;
        
        const toastIcon = elements.toast.querySelector('.toast-icon');
        const toastMessage = elements.toast.querySelector('.toast-message');
    
    // Set message
        if (toastMessage) {
    toastMessage.textContent = message;
        }
    
    // Set icon and class based on type
        elements.toast.className = `toast ${type}`;
        if (toastIcon) {
            toastIcon.className = type === 'success' ? 
                'toast-icon fas fa-check-circle' : 
                'toast-icon fas fa-exclamation-circle';
    }
    
    // Show toast
        elements.toast.classList.add('show');
    
        // Hide after configured duration
    setTimeout(() => {
            elements.toast.classList.remove('show');
        }, CONFIG.toastDuration);
    }

    // ===== EVENT HANDLERS =====
    handleKeyboardShortcuts(event) {
    // ESC key to reset upload
        if (event.key === 'Escape' && appState.selectedFile && !appState.isUploading) {
            this.resetUpload();
    }
    
    // Ctrl/Cmd + O to open file dialog
    if ((event.ctrlKey || event.metaKey) && event.key === 'o') {
        event.preventDefault();
            if (!appState.selectedFile) {
                elements.fileInput?.click();
            }
        }
    }

    handleResize() {
        // Handle responsive adjustments if needed
        // This method can be extended for specific responsive behavior
    }

    // ===== ACCESSIBILITY & ENHANCEMENTS =====
    initializeEnhancements() {
        // Add smooth scrolling
    document.documentElement.style.scrollBehavior = 'smooth';
    
    // Add focus management for accessibility
        this.setupFocusManagement();
        
        // Initialize tooltips or other enhancements if needed
        this.setupAccessibilityFeatures();
    }

    setupFocusManagement() {
    const focusableElements = document.querySelectorAll('button, input, [tabindex]');
        
    focusableElements.forEach(el => {
        el.addEventListener('focus', function() {
                this.style.outline = '2px solid var(--color-primary-500)';
            this.style.outlineOffset = '2px';
        });
        
        el.addEventListener('blur', function() {
            this.style.outline = 'none';
        });
    });
}

    setupAccessibilityFeatures() {
        // Add ARIA labels and descriptions where needed
        if (elements.uploadArea) {
            elements.uploadArea.setAttribute('aria-label', 'Upload MRI image for analysis');
            elements.uploadArea.setAttribute('role', 'button');
            elements.uploadArea.setAttribute('tabindex', '0');
        }
        
        if (elements.fileInput) {
            elements.fileInput.setAttribute('aria-describedby', 'file-upload-help');
        }
        
        // Add keyboard navigation for upload area
        elements.uploadArea?.addEventListener('keydown', (event) => {
            if (event.key === 'Enter' || event.key === ' ') {
                event.preventDefault();
                this.handleUploadAreaClick();
            }
        });
    }
}

// ===== UTILITY FUNCTIONS =====
const utils = {
    formatFileSize(bytes) {
        if (bytes === 0) return '0 Bytes';
        const k = 1024;
        const sizes = ['Bytes', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
    },

    formatTimestamp(timestamp) {
        const date = new Date(timestamp);
        return date.toLocaleDateString() + ' ' + date.toLocaleTimeString();
    },

    preloadImage(src) {
        const img = new Image();
        img.src = src;
        return img;
    },

    debounce(func, wait) {
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
};

// ===== GLOBAL FUNCTIONS FOR BACKWARDS COMPATIBILITY =====
function showHistoryItem(imagePath, result, resultType, confidence, filename) {
    if (window.tumorApp) {
        window.tumorApp.showHistoryItem(imagePath, result, resultType, confidence, filename);
    }
}

// ===== APPLICATION INITIALIZATION =====
document.addEventListener('DOMContentLoaded', function() {
    window.tumorApp = new TumorDetectionApp();
}); 