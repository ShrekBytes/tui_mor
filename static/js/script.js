// ===== APPLICATION CONFIGURATION =====
const CONFIG = {
    maxFileSize: 10 * 1024 * 1024, // 10MB
    allowedTypes: ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/bmp', 'image/tiff'],
    toastDuration: 3000,
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

    toast: null,
    scanAnotherBtn: null,
    historyContent: null
};

// ===== MAIN APPLICATION CLASS =====
class TumorDetectionApp {
    constructor() {
        this.init();
    }

    init() {
        this.cacheElements();
        this.bindEvents();
        this.bindHistoryItems();
    }

    cacheElements() {
        Object.keys(elements).forEach(key => {
            const id = key.charAt(0).toLowerCase() + key.slice(1);
            elements[key] = document.getElementById(id) || document.querySelector(`.${key.replace(/([A-Z])/g, '-$1').toLowerCase()}`);
        });
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
            elements.uploadArea.addEventListener('keydown', (event) => {
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    this.handleUploadAreaClick();
                }
            });
        }
        
        // Global events
        document.addEventListener('dragover', this.preventDefault);
        document.addEventListener('drop', this.preventDefault);
        document.addEventListener('keydown', this.handleKeyboardShortcuts.bind(this));
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
        
        // Restore visibility of result header elements
        if (elements.resultTitle) {
            elements.resultTitle.style.display = 'block';
        }
        if (elements.confidenceText) {
            elements.confidenceText.style.display = 'inline';
        }
        if (elements.confidenceBadge) {
            elements.confidenceBadge.style.display = 'inline-block';
        }
        
        // Reset upload section to initial state
        this.toggleDisplay(elements.fileInfo, false);
        this.toggleDisplay(elements.uploadArea, true);
        this.toggleDisplay(elements.analysisResults, false);
        
        // Ensure upload section is properly displayed
        if (elements.uploadSection) {
            elements.uploadSection.style.display = 'flex';
        }
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
            this.showProgressBar(false);
        }
    }

    displayResults(data) {
        // Set preview image
        if (elements.previewImage) {
            elements.previewImage.src = data.filepath;
        }

        // Show and set result title and confidence (ensure they're visible for new results)
        if (elements.resultTitle) {
            elements.resultTitle.style.display = 'block';
            elements.resultTitle.textContent = data.result;
        }
        if (elements.confidenceText) {
            elements.confidenceText.style.display = 'inline';
            elements.confidenceText.textContent = `${data.confidence.toFixed(1)}% confidence`;
        }
        if (elements.confidenceBadge) {
            elements.confidenceBadge.style.display = 'inline-block';
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
            healthy: { background: 'var(--color-success)' },
            tumor: { background: 'var(--color-error)' }
        };
        
        const style = styles[resultType] || styles.tumor;
        Object.assign(elements.confidenceBadge.style, style);
    }

    createProbabilityBars(probabilities) {
        if (!elements.probabilityBars) return;
        
        elements.probabilityBars.innerHTML = '';

        // Sort probabilities in descending order
        const sortedProbs = Object.entries(probabilities).sort(([,a], [,b]) => b - a);
        
        const fragment = document.createDocumentFragment();

        sortedProbs.forEach(([className, probability]) => {
            const probabilityItem = this.createProbabilityItem(className, probability);
            fragment.appendChild(probabilityItem);
        });
        
        elements.probabilityBars.appendChild(fragment);
        
        // Animate bars with a slight delay
        setTimeout(() => {
            sortedProbs.forEach(([, probability], index) => {
                const fill = elements.probabilityBars.children[index]?.querySelector('.probability-fill');
                if (fill) {
                    fill.style.width = `${probability}%`;
                }
            });
        }, 100);
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
        const timestamp = this.formatTimestamp(new Date());
        
        // Parse result to get tumor detection status and type
        let detectionStatus, tumorType, tumorClass;
        
        if (result.result_type === 'healthy') {
            detectionStatus = 'No Tumor';
            tumorType = null;
            tumorClass = 'healthy';
        } else {
            detectionStatus = 'Tumor Detected';
            // Extract tumor type from result
            if (result.result.toLowerCase().includes('pituitary')) {
                tumorType = 'Pituitary';
                tumorClass = 'pituitary';
            } else if (result.result.toLowerCase().includes('glioma')) {
                tumorType = 'Glioma';
                tumorClass = 'glioma';
            } else if (result.result.toLowerCase().includes('meningioma')) {
                tumorType = 'Meningioma';
                tumorClass = 'meningioma';
            }
        }

        historyItem.innerHTML = `
            <div class="history-image">
                <img src="${result.filepath}" alt="MRI scan" loading="lazy">
            </div>
            <div class="history-details">
                <div class="history-top-content">
                    <div class="history-filename">${filename}</div>
                    <div class="history-results-container">
                        <div class="history-result ${result.result_type}">${detectionStatus}</div>
                        ${tumorType ? `<div class="history-tumor-type ${tumorClass}">${tumorType}</div>` : ''}
                    </div>
                </div>
            </div>
            <div class="history-meta">
                <span class="history-time">${timestamp}</span>
                <span class="history-confidence">${result.confidence.toFixed(1)}% confidence</span>
            </div>
        `;
        
        historyItem.addEventListener('click', () => {
            this.showHistoryItem(result.filepath, result.result, result.result_type, result.confidence, filename);
        });
        
        return historyItem;
    }

    formatTimestamp(date) {
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        const dayName = days[date.getDay()];
        const day = date.getDate();
        const monthName = months[date.getMonth()];
        
        let hours = date.getHours();
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        
        hours = hours % 12;
        hours = hours ? hours : 12; // 0 should be 12
        
        // Format: "Sun 21 Jul, 11:26 PM"
        return `${dayName} ${day} ${monthName}, ${hours}:${minutes} ${ampm}`;
    }

    showHistoryItem(imagePath, result, resultType, confidence, filename) {
        // Set preview image
        if (elements.previewImage) {
            elements.previewImage.src = imagePath;
        }
        
        // Hide the regular result header since we'll show centered version
        if (elements.resultTitle) {
            elements.resultTitle.style.display = 'none';
        }
        if (elements.confidenceText) {
            elements.confidenceText.style.display = 'none';
        }
        if (elements.confidenceBadge) {
            elements.confidenceBadge.style.display = 'none';
        }
        
        // Create centered historical result display
        if (elements.probabilityBars) {
            elements.probabilityBars.innerHTML = `
                <div class="historical-result-display">
                    <div class="historical-result-title">${result}</div>
                    <div class="historical-confidence-badge ${resultType}">${confidence.toFixed(1)}% confidence</div>
                </div>
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
        
        // Ensure upload section has proper layout
        if (elements.uploadSection) {
            elements.uploadSection.style.display = 'flex';
            elements.uploadSection.style.flexDirection = 'column';
            elements.uploadSection.style.height = '100%';
        }
        
        // Reset upload area to initial state
        if (elements.uploadArea) {
            elements.uploadArea.style.display = 'flex';
            elements.uploadArea.style.alignItems = 'center';
            elements.uploadArea.style.justifyContent = 'center';
            elements.uploadArea.style.height = '100%';
        }
        
        this.showToast('Ready for new scan', 'success');
    }

    // ===== UI FEEDBACK =====
    showProgressBar(show) {
        this.toggleDisplay(elements.progressBar, show);
        
        if (show && elements.progressBar) {
            const progressFill = elements.progressBar.querySelector('.progress-fill');
            if (progressFill) {
                progressFill.style.width = '0%';
                setTimeout(() => {
                    progressFill.style.width = '100%';
                }, 50);
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
        const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        const months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 
                       'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
        
        const dayName = days[date.getDay()];
        const day = date.getDate();
        const monthName = months[date.getMonth()];
        
        let hours = date.getHours();
        const minutes = date.getMinutes().toString().padStart(2, '0');
        const ampm = hours >= 12 ? 'PM' : 'AM';
        
        hours = hours % 12;
        hours = hours ? hours : 12; // 0 should be 12
        
        // Format: "Sun 21 Jul, 11:26 PM"
        return `${dayName} ${day} ${monthName}, ${hours}:${minutes} ${ampm}`;
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