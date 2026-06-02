/**
 * Efficient Database Manager
 * Uses debouncing for localStorage writes and provides IndexedDB fallback
 */

class DBManager {
    constructor() {
        this.dbKey = 'study_db';
        this.scratchpadKey = 'study_scratchpad';
        this.themeKey = 'theme';
        this.writeTimeout = null;
        this.scratchpadTimeout = null;
        this.writeDelay = 1000; // 1 second debounce
        this.pendingWrite = null;
        this.db = null;
        this.useIndexedDB = false;
        this.initIndexedDB();
    }

    /**
     * Initialize IndexedDB for better performance
     */
    initIndexedDB() {
        if (!window.indexedDB) {
            console.log('IndexedDB not available, using localStorage');
            return;
        }

        const request = indexedDB.open('FocusStationDB', 1);

        request.onerror = () => {
            console.log('IndexedDB initialization failed');
        };

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains('studyData')) {
                db.createObjectStore('studyData', { keyPath: 'date' });
            }
        };

        request.onsuccess = (event) => {
            this.db = event.target.result;
            this.useIndexedDB = true;
            console.log('IndexedDB initialized successfully');
        };
    }

    /**
     * Get study data with optional date filter
     */
    async getStudyData(dateStr = null) {
        try {
            if (this.useIndexedDB && this.db) {
                return new Promise((resolve) => {
                    const transaction = this.db.transaction(['studyData'], 'readonly');
                    const store = transaction.objectStore('studyData');
                    let request;

                    if (dateStr) {
                        request = store.get(dateStr);
                    } else {
                        request = store.getAll();
                    }

                    request.onsuccess = () => {
                        resolve(request.result || []);
                    };

                    request.onerror = () => {
                        resolve([]);
                    };
                });
            } else {
                // Fallback to localStorage
                const data = localStorage.getItem(this.dbKey);
                return data ? JSON.parse(data) : [];
            }
        } catch (e) {
            console.log('Error getting study data:', e);
            return [];
        }
    }

    /**
     * Save study data with debouncing
     */
    saveStudyData(data) {
        this.pendingWrite = data;

        // Clear existing timeout
        if (this.writeTimeout) {
            clearTimeout(this.writeTimeout);
        }

        // Set new debounced write
        this.writeTimeout = setTimeout(() => {
            this.commitWrite();
        }, this.writeDelay);
    }

    /**
     * Commit the write operation
     */
    async commitWrite() {
        if (!this.pendingWrite) return;

        const data = this.pendingWrite;
        this.pendingWrite = null;

        try {
            if (this.useIndexedDB && this.db) {
                const transaction = this.db.transaction(['studyData'], 'readwrite');
                const store = transaction.objectStore('studyData');
                data.forEach(item => {
                    store.put(item);
                });
            } else {
                // Fallback to localStorage
                localStorage.setItem(this.dbKey, JSON.stringify(data));
            }
        } catch (e) {
            console.log('Error saving study data:', e);
            // Fallback to localStorage if IndexedDB fails
            try {
                localStorage.setItem(this.dbKey, JSON.stringify(data));
            } catch (storageError) {
                console.log('Storage full or unavailable:', storageError);
            }
        }
    }

    /**
     * Force immediate write (for critical saves)
     */
    async forceWrite(data) {
        if (this.writeTimeout) {
            clearTimeout(this.writeTimeout);
            this.writeTimeout = null;
        }
        this.pendingWrite = data;
        await this.commitWrite();
    }

    /**
     * Save scratchpad with debouncing
     */
    saveScratchpad(text) {
        if (this.scratchpadTimeout) {
            clearTimeout(this.scratchpadTimeout);
        }
        this.scratchpadTimeout = setTimeout(() => {
            localStorage.setItem(this.scratchpadKey, text);
        }, 500);
    }

    /**
     * Get scratchpad content
     */
    getScratchpad() {
        return localStorage.getItem(this.scratchpadKey) || '';
    }

    /**
     * Save theme preference
     */
    setTheme(theme) {
        localStorage.setItem(this.themeKey, theme);
    }

    /**
     * Get theme preference
     */
    getTheme() {
        return localStorage.getItem(this.themeKey) || 'light';
    }

    /**
     * Export data to CSV
     */
    exportToCSV(data) {
        const escapeCSV = (str) => `"${str.replace(/"/g, '""')}"`;
        let csv = "\uFEFFتاریخ,اولین ورود,آخرین خروج,دقایق مطالعه,چک‌پوینت موفق,کل تست‌ها,جزئیات\n";
        
        data.forEach(r => {
            const detailsStr = r.breakdown.map(b => 
                `${b.name}(${b.desc}):${b.completed}/${b.total}[تست:${b.tests||0}]`
            ).join(" | ");
            
            csv += `${escapeCSV(r.date)},${escapeCSV(r.loginTime)},${escapeCSV(r.endTime || '-')},"${r.minutes}","${r.cpsFinished} از ${r.cpsPlanned}","${r.totalTests || 0}",${escapeCSV(detailsStr)}\n`;
        });

        return csv;
    }

    /**
     * Delete specific record
     */
    async deleteRecord(index, allData) {
        const data = allData.filter((_, i) => i !== index);
        await this.forceWrite(data);
    }

    /**
     * Cleanup on unload
     */
    cleanup() {
        if (this.writeTimeout) {
            clearTimeout(this.writeTimeout);
        }
        if (this.scratchpadTimeout) {
            clearTimeout(this.scratchpadTimeout);
        }
        if (this.db) {
            this.db.close();
        }
    }
}

// Export for use in main script
window.DBManager = DBManager;