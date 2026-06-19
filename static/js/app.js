// App state variables
let allUpdates = [];
let filteredUpdates = [];
let activeUpdate = null;
let currentFilter = 'all';
let searchQuery = '';

// DOM Elements
const refreshBtn = document.getElementById('refreshBtn');
const refreshIcon = document.getElementById('refreshIcon');
const syncStatus = document.getElementById('syncStatus');
const syncStatusText = syncStatus.querySelector('.status-text');
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearchBtn');
const filterChips = document.querySelectorAll('.chip');
const resultsCount = document.getElementById('resultsCount');
const feedList = document.getElementById('feedList');
const shimmerLoader = document.getElementById('shimmerLoader');

// Composer DOM Elements
const composerContainer = document.getElementById('composerContainer');
const composerEmptyState = document.getElementById('composerEmptyState');
const composerActivePanel = document.getElementById('composerActivePanel');
const selectedBadge = document.getElementById('selectedBadge');
const selectedDate = document.getElementById('selectedDate');
const selectedHtml = document.getElementById('selectedHtml');
const selectedOriginalLink = document.getElementById('selectedOriginalLink');
const copyRawBtn = document.getElementById('copyRawBtn');
const tweetTextArea = document.getElementById('tweetTextArea');
const charCount = document.getElementById('charCount');
const charProgressRing = document.getElementById('charProgressRing');
const tweetBtn = document.getElementById('tweetBtn');
const toast = document.getElementById('toast');

// Character limits for Twitter
const MAX_CHAR_LIMIT = 280;
const CIRCUMFERENCE = 69.1; // 2 * Math.PI * 11 (radius of progress ring circle)

// Initialize
document.addEventListener('DOMContentLoaded', () => {
    fetchReleaseNotes();
    setupEventListeners();
});

// Event Listeners Setup
function setupEventListeners() {
    // Refresh button
    refreshBtn.addEventListener('click', () => {
        fetchReleaseNotes(true);
    });

    // Search query
    searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value.toLowerCase().trim();
        clearSearchBtn.style.display = searchQuery ? 'block' : 'none';
        applyFiltersAndSearch();
    });

    // Clear search
    clearSearchBtn.addEventListener('click', () => {
        searchInput.value = '';
        searchQuery = '';
        clearSearchBtn.style.display = 'none';
        applyFiltersAndSearch();
        searchInput.focus();
    });

    // Filter chips
    filterChips.forEach(chip => {
        chip.addEventListener('click', (e) => {
            filterChips.forEach(c => c.classList.remove('active'));
            chip.classList.add('active');
            currentFilter = chip.getAttribute('data-type');
            applyFiltersAndSearch();
        });
    });

    // Tweet text area character count
    tweetTextArea.addEventListener('input', updateTweetComposerStats);

    // Tweet action button
    tweetBtn.addEventListener('click', publishTweet);

    // Copy raw update text button
    copyRawBtn.addEventListener('click', copyUpdateToClipboard);
}

// Fetch notes from Flask API
async function fetchReleaseNotes(forceRefresh = false) {
    setLoadingState(true);
    
    try {
        const url = forceRefresh ? '/api/release-notes?refresh=true' : '/api/release-notes';
        const response = await fetch(url);
        
        if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
        }
        
        const result = await response.json();
        
        if (result.success) {
            processAndStoreUpdates(result.data);
            setOnlineStatus(result.source, result.last_fetched);
        } else {
            throw new Error(result.error || 'Unknown API error');
        }
        
    } catch (error) {
        console.error('Error fetching release notes:', error);
        setOfflineStatus(error.message);
        showToast(`Error: ${error.message}`, true);
    } finally {
        setLoadingState(false);
    }
}

// Processing daily feeds into individual sub-updates (e.g. splitting daily logs by <h3> headers)
function processAndStoreUpdates(entries) {
    allUpdates = [];
    
    entries.forEach(entry => {
        const entryUpdates = parseEntryUpdates(entry);
        allUpdates = allUpdates.concat(entryUpdates);
    });
    
    applyFiltersAndSearch();
}

function parseEntryUpdates(entry) {
    const updates = [];
    const parser = new DOMParser();
    const doc = parser.parseFromString(entry.content, 'text/html');
    
    const children = Array.from(doc.body.childNodes);
    let currentType = 'Other';
    let currentHtml = '';
    
    children.forEach((node) => {
        // Look for heading tag representing update types (Features, Announcements, Deprecations)
        if (node.nodeType === Node.ELEMENT_NODE && /^H[1-6]$/.test(node.tagName)) {
            // Save preceding update if it has content
            if (currentHtml.trim()) {
                updates.push(createUpdateObject(entry, currentType, currentHtml, updates.length));
            }
            currentType = node.textContent.trim();
            currentHtml = '';
        } else {
            // Accumulate nodes
            if (node.nodeType === Node.ELEMENT_NODE) {
                currentHtml += node.outerHTML;
            } else if (node.nodeType === Node.TEXT_NODE) {
                currentHtml += node.textContent;
            }
        }
    });
    
    // Save last update
    if (currentHtml.trim()) {
        updates.push(createUpdateObject(entry, currentType, currentHtml, updates.length));
    }
    
    // Fallback if content did not split into any elements
    if (updates.length === 0 && entry.content.trim()) {
        updates.push(createUpdateObject(entry, 'Other', entry.content.trim(), 0));
    }
    
    return updates;
}

function createUpdateObject(entry, type, html, index) {
    const normalizedType = getNormalizedType(type);
    const rawText = stripHtmlTags(html);
    return {
        id: `${entry.id}_${index}`,
        originalId: entry.id,
        date: entry.title,
        link: entry.link,
        type: type,
        normalizedType: normalizedType,
        html: html,
        text: rawText
    };
}

function getNormalizedType(typeText) {
    const type = typeText.toLowerCase().trim();
    if (type.includes('feature')) return 'feature';
    if (type.includes('announcement')) return 'announcement';
    if (type.includes('deprecation')) return 'deprecation';
    return 'other';
}

function stripHtmlTags(html) {
    const temp = document.createElement('div');
    temp.innerHTML = html;
    // Replace anchor links with their text for plain text extraction
    const anchors = temp.querySelectorAll('a');
    anchors.forEach(a => {
        a.replaceWith(a.textContent);
    });
    return temp.textContent || temp.innerText || "";
}

// Filter and search application logic
function applyFiltersAndSearch() {
    filteredUpdates = allUpdates.filter(update => {
        // Filter by badge type
        const matchesFilter = currentFilter === 'all' || update.normalizedType === currentFilter;
        
        // Filter by keyword query search (check type, date, and description text)
        const matchesSearch = !searchQuery || 
            update.text.toLowerCase().includes(searchQuery) ||
            update.type.toLowerCase().includes(searchQuery) ||
            update.date.toLowerCase().includes(searchQuery);
            
        return matchesFilter && matchesSearch;
    });
    
    resultsCount.textContent = `Showing ${filteredUpdates.length} update${filteredUpdates.length === 1 ? '' : 's'}`;
    renderUpdatesList();
}

// Render the updates in the left list view pane grouped by Date
function renderUpdatesList() {
    feedList.innerHTML = '';
    
    if (filteredUpdates.length === 0) {
        feedList.innerHTML = `
            <div class="empty-state">
                <div class="empty-icon-wrapper">
                    <i class="fa-solid fa-magnifying-glass"></i>
                </div>
                <h3>No Matching Results</h3>
                <p>Try resetting the category filter or searching for another keyword.</p>
            </div>
        `;
        return;
    }
    
    // Group updates by date
    const groups = {};
    filteredUpdates.forEach(update => {
        if (!groups[update.date]) {
            groups[update.date] = [];
        }
        groups[update.date].push(update);
    });
    
    // Output DOM elements grouped chronologically (already sorted in XML feed order)
    Object.keys(groups).forEach(date => {
        const dateGroup = document.createElement('div');
        dateGroup.className = 'date-group';
        
        const header = document.createElement('div');
        header.className = 'date-group-header';
        header.innerHTML = `
            <span class="date-group-title">${date}</span>
            <div class="date-line"></div>
        `;
        dateGroup.appendChild(header);
        
        groups[date].forEach(update => {
            const card = document.createElement('div');
            card.className = `update-card ${activeUpdate && activeUpdate.id === update.id ? 'selected' : ''}`;
            card.dataset.id = update.id;
            
            // Build card html content
            card.innerHTML = `
                <div class="card-header">
                    <span class="badge ${update.normalizedType}">${update.type}</span>
                    <div class="card-actions">
                        <button class="btn-card-tweet" title="Compose Tweet for this update" onclick="event.stopPropagation(); quickSelectAndCompose('${update.id}')">
                            <i class="fa-brands fa-x-twitter"></i>
                        </button>
                    </div>
                </div>
                <div class="card-description">
                    ${update.text}
                </div>
            `;
            
            card.addEventListener('click', () => {
                selectUpdate(update);
            });
            
            dateGroup.appendChild(card);
        });
        
        feedList.appendChild(dateGroup);
    });
}

// Select an update to display details in the composer workspace
function selectUpdate(update) {
    activeUpdate = update;
    
    // Update active visual outline in lists
    document.querySelectorAll('.update-card').forEach(card => {
        if (card.dataset.id === update.id) {
            card.classList.add('selected');
        } else {
            card.classList.remove('selected');
        }
    });
    
    // Toggle composer view panel
    composerEmptyState.style.display = 'none';
    composerActivePanel.style.display = 'flex';
    
    // Set text details
    selectedBadge.className = `update-type-badge ${update.normalizedType}`;
    selectedBadge.textContent = update.type;
    selectedDate.innerHTML = `<i class="fa-regular fa-calendar"></i> ${update.date}`;
    selectedHtml.innerHTML = update.html;
    selectedOriginalLink.href = update.link;
    
    // Pre-fill Twitter Composer with customized draft
    const textSnippet = formatTextForTweet(update.text, update.date);
    tweetTextArea.value = `${textSnippet}\n\nRead more details:\n${update.link}`;
    
    // Trigger statistic counts and validation rules
    updateTweetComposerStats();
}

// Truncates text details nicely to fit inside Tweet intent limit (280 characters)
function formatTextForTweet(text, date) {
    const prefix = `BigQuery Release (${date}): `;
    const suffix = ` #BigQuery #GoogleCloud`;
    
    // Fixed lengths: prefix (approx 30 chars), link (usually 23 chars for Twitter t.co wrap), tags and spacers
    // Link is calculated as 23 characters regardless of actual length on twitter.com
    const twitterLinkPlaceholderLength = 23;
    const reservedChars = prefix.length + suffix.length + twitterLinkPlaceholderLength + 6; // extra buffer spacing
    
    const maxDescLength = MAX_CHAR_LIMIT - reservedChars;
    let cleanText = text.replace(/\s+/g, ' ').trim();
    
    if (cleanText.length > maxDescLength) {
        cleanText = cleanText.substring(0, maxDescLength - 3) + '...';
    }
    
    return `${prefix}${cleanText}${suffix}`;
}

// Handle Tweet composer text stats (characters count, progress bar ring offsets)
function updateTweetComposerStats() {
    const text = tweetTextArea.value;
    const length = text.length;
    const remaining = MAX_CHAR_LIMIT - length;
    
    // Update numerical indicator text
    charCount.textContent = remaining;
    
    // Handle status warnings styles
    charCount.className = 'char-count';
    if (remaining <= 20 && remaining >= 0) {
        charCount.classList.add('warning');
        charProgressRing.setAttribute('stroke', '#f59e0b');
    } else if (remaining < 0) {
        charCount.classList.add('danger');
        charProgressRing.setAttribute('stroke', '#ef4444');
    } else {
        charProgressRing.setAttribute('stroke', '#1d9bf0');
    }
    
    // Calculate circular ring fill dashoffset
    // If length exceeds limit, close the loop (offset = 0)
    const ratio = Math.min(length / MAX_CHAR_LIMIT, 1);
    const offset = CIRCUMFERENCE - (ratio * CIRCUMFERENCE);
    charProgressRing.style.strokeDashoffset = offset;
    
    // Handle action buttons disabled validation rules
    tweetBtn.disabled = length === 0 || remaining < 0;
}

// Opens Twitter (X) Share Intent modal with drafted composition text
function publishTweet() {
    if (!tweetTextArea.value || (MAX_CHAR_LIMIT - tweetTextArea.value.length < 0)) return;
    
    const tweetText = tweetTextArea.value;
    const twitterUrl = `https://twitter.com/intent/tweet?text=${encodeURIComponent(tweetText)}`;
    
    window.open(twitterUrl, '_blank', 'width=550,height=420,referrerpolicy=no-referrer');
    showToast('Redirected to X/Twitter intent!');
}

// Copy raw text of update card description to clipboard
async function copyUpdateToClipboard() {
    if (!activeUpdate) return;
    
    try {
        const textToCopy = `BigQuery Release [${activeUpdate.date}] - ${activeUpdate.type}\n\n${activeUpdate.text}\n\nRead details: ${activeUpdate.link}`;
        await navigator.clipboard.writeText(textToCopy);
        showToast('Successfully copied update text to clipboard!');
    } catch (err) {
        console.error('Failed to copy text: ', err);
        showToast('Failed to copy to clipboard', true);
    }
}

// Quick Select utility (for quick tweet icon on lists)
window.quickSelectAndCompose = function(updateId) {
    const update = allUpdates.find(u => u.id === updateId);
    if (update) {
        selectUpdate(update);
        tweetTextArea.focus();
    }
};

// UI helper: update spinner, buttons, status header states
function setLoadingState(isLoading) {
    if (isLoading) {
        refreshBtn.disabled = true;
        refreshIcon.classList.add('spinning');
        syncStatus.className = 'sync-status loading';
        syncStatusText.textContent = 'Syncing feed...';
        
        // Toggle view container visibilities
        shimmerLoader.style.display = 'flex';
        feedList.style.display = 'none';
    } else {
        refreshBtn.disabled = false;
        refreshIcon.classList.remove('spinning');
        
        shimmerLoader.style.display = 'none';
        feedList.style.display = 'block';
    }
}

function setOnlineStatus(source, epochTime) {
    syncStatus.className = 'sync-status online';
    
    const dateObj = new Date(epochTime * 1000);
    const timeStr = dateObj.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    
    if (source === 'cache') {
        syncStatusText.textContent = `Cached (Synced ${timeStr})`;
    } else if (source === 'live') {
        syncStatusText.textContent = `Synced ${timeStr}`;
    } else {
        syncStatusText.textContent = `Cached Fallback`;
    }
}

function setOfflineStatus(errMsg) {
    syncStatus.className = 'sync-status offline';
    syncStatusText.textContent = 'Offline / Synced Failed';
}

// Custom toaster notification alert
function showToast(message, isError = false) {
    const toastMessage = toast.querySelector('.toast-message');
    const toastIcon = toast.querySelector('.toast-icon');
    
    toastMessage.textContent = message;
    
    if (isError) {
        toast.style.borderColor = '#ef4444';
        toast.style.boxShadow = '0 8px 24px rgba(0, 0, 0, 0.3), 0 0 10px rgba(239, 68, 68, 0.2)';
        toastIcon.className = 'fa-solid fa-circle-exclamation toast-icon';
        toastIcon.style.color = '#ef4444';
    } else {
        toast.style.borderColor = 'var(--primary)';
        toast.style.boxShadow = 'var(--shadow-lg), 0 0 10px rgba(59, 130, 246, 0.2)';
        toastIcon.className = 'fa-solid fa-check-circle toast-icon';
        toastIcon.style.color = '#10b981';
    }
    
    toast.classList.add('show');
    
    setTimeout(() => {
        toast.classList.remove('show');
    }, 3000);
}
