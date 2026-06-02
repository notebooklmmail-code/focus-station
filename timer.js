/**
 * Consolidated Timer Manager
 * Replaces multiple setIntervals with a single RAF loop for better performance
 */

class TimerManager {
    constructor() {
        this.timers = {};
        this.animationFrameId = null;
        this.lastUpdateTime = Date.now();
        this.updateCallbacks = [];
        this.isRunning = false;
    }

    /**
     * Register a timer
     */
    registerTimer(timerId, duration) {
        this.timers[timerId] = {
            duration: duration * 60, // convert minutes to seconds
            remaining: duration * 60,
            state: 'idle', // idle, running, paused, finished
            elapsedSeconds: 0
        };
    }

    /**
     * Start a specific timer
     */
    startTimer(timerId) {
        if (this.timers[timerId]) {
            this.timers[timerId].state = 'running';
            if (!this.isRunning) {
                this.startLoop();
            }
        }
    }

    /**
     * Pause a specific timer
     */
    pauseTimer(timerId) {
        if (this.timers[timerId]) {
            this.timers[timerId].state = 'paused';
        }
    }

    /**
     * Reset a specific timer
     */
    resetTimer(timerId) {
        if (this.timers[timerId]) {
            const timer = this.timers[timerId];
            timer.state = 'idle';
            timer.remaining = timer.duration;
            timer.elapsedSeconds = 0;
        }
    }

    /**
     * Get timer state
     */
    getTimer(timerId) {
        return this.timers[timerId];
    }

    /**
     * Add a callback to be called on every update
     */
    onUpdate(callback) {
        this.updateCallbacks.push(callback);
    }

    /**
     * Start the main animation loop
     */
    startLoop() {
        if (this.isRunning) return;
        this.isRunning = true;
        this.lastUpdateTime = Date.now();
        this.tick();
    }

    /**
     * Main tick function using RAF
     */
    tick = () => {
        const now = Date.now();
        const deltaTime = (now - this.lastUpdateTime) / 1000; // convert to seconds
        this.lastUpdateTime = now;

        let hasRunningTimers = false;

        // Update all running timers
        for (const timerId in this.timers) {
            const timer = this.timers[timerId];
            if (timer.state === 'running') {
                hasRunningTimers = true;
                timer.remaining -= deltaTime;
                timer.elapsedSeconds += deltaTime;

                // Check if timer finished
                if (timer.remaining <= 0) {
                    timer.remaining = 0;
                    timer.state = 'finished';
                    this.notifyFinished(timerId);
                }
            }
        }

        // Notify all callbacks
        this.updateCallbacks.forEach(cb => cb(this.timers));

        // Continue loop if there are running timers
        if (hasRunningTimers) {
            this.animationFrameId = requestAnimationFrame(this.tick);
        } else {
            this.isRunning = false;
        }
    }

    /**
     * Notify when a timer finishes
     */
    notifyFinished(timerId) {
        const event = new CustomEvent('timerFinished', {
            detail: { timerId }
        });
        document.dispatchEvent(event);
    }

    /**
     * Stop all timers
     */
    stopAll() {
        for (const timerId in this.timers) {
            this.timers[timerId].state = 'idle';
        }
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.isRunning = false;
    }

    /**
     * Get all timers
     */
    getAllTimers() {
        return this.timers;
    }

    /**
     * Clear all timers
     */
    clearAll() {
        this.stopAll();
        this.timers = {};
        this.updateCallbacks = [];
    }
}

// Export for use in main script
window.TimerManager = TimerManager;