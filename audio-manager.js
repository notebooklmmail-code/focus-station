/**
 * Centralized Audio Manager
 * Prevents memory leaks and manages audio context lifecycle
 */

class AudioManager {
    constructor() {
        this.audioContext = null;
        this.rainBuffer = null;
        this.rainNode = null;
        this.gainNode = null;
        this.filterNode = null;
        this.playlist = [];
        this.currentTrackIdx = 0;
    }

    /**
     * Initialize or get audio context
     */
    getAudioContext() {
        if (!this.audioContext) {
            const AudioContext = window.AudioContext || window.webkitAudioContext;
            this.audioContext = new AudioContext();
        }
        if (this.audioContext.state === 'suspended') {
            this.audioContext.resume().catch(e => console.log('AudioContext resume failed:', e));
        }
        return this.audioContext;
    }

    /**
     * Generate and cache white noise buffer
     */
    generateWhiteNoiseBuffer() {
        if (this.rainBuffer) return this.rainBuffer;
        
        const ctx = this.getAudioContext();
        const bufferSize = 2 * ctx.sampleRate; // 2 seconds of audio
        this.rainBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = this.rainBuffer.getChannelData(0);
        
        for (let i = 0; i < bufferSize; i++) {
            output[i] = Math.random() * 2 - 1;
        }
        
        return this.rainBuffer;
    }

    /**
     * Toggle white noise on/off
     */
    toggleWhiteNoise() {
        if (this.rainNode) {
            this.stopWhiteNoise();
            return false;
        }

        try {
            const ctx = this.getAudioContext();
            const buffer = this.generateWhiteNoiseBuffer();

            this.rainNode = ctx.createBufferSource();
            this.rainNode.buffer = buffer;
            this.rainNode.loop = true;

            // Create filter for white noise
            this.filterNode = ctx.createBiquadFilter();
            this.filterNode.type = 'lowpass';
            this.filterNode.frequency.value = 800;

            // Create gain for volume control
            this.gainNode = ctx.createGain();
            this.gainNode.gain.value = 0.3;

            // Connect nodes
            this.rainNode.connect(this.filterNode);
            this.filterNode.connect(this.gainNode);
            this.gainNode.connect(ctx.destination);

            this.rainNode.start();
            return true;
        } catch (e) {
            console.log('White noise error:', e);
            return false;
        }
    }

    /**
     * Stop white noise
     */
    stopWhiteNoise() {
        if (this.rainNode) {
            try {
                this.rainNode.stop();
                this.rainNode.disconnect();
                this.rainNode = null;
            } catch (e) {
                console.log('Error stopping white noise:', e);
            }
        }
    }

    /**
     * Play smart beep sound
     */
    playSmartBeep(type = 'cp') {
        try {
            const ctx = this.getAudioContext();
            if (!ctx) return;

            if (type === 'cp') {
                // Single beep for checkpoint
                const osc = ctx.createOscillator();
                const gain = ctx.createGain();
                osc.connect(gain);
                gain.connect(ctx.destination);
                osc.type = 'sine';
                osc.frequency.setValueAtTime(800, ctx.currentTime);
                gain.gain.setValueAtTime(0.3, ctx.currentTime);
                gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);
                osc.start(ctx.currentTime);
                osc.stop(ctx.currentTime + 0.1);
            } else if (type === 'row') {
                // Musical beep for row completion
                const frequencies = [440, 554, 659];
                frequencies.forEach((freq, idx) => {
                    const osc = ctx.createOscillator();
                    const gain = ctx.createGain();
                    osc.connect(gain);
                    gain.connect(ctx.destination);
                    osc.type = 'triangle';
                    osc.frequency.value = freq;
                    gain.gain.setValueAtTime(0, ctx.currentTime);
                    gain.gain.linearRampToValueAtTime(0.2, ctx.currentTime + 0.1 + (idx * 0.1));
                    gain.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.5 + (idx * 0.1));
                    osc.start(ctx.currentTime + (idx * 0.1));
                    osc.stop(ctx.currentTime + 0.5 + (idx * 0.1));
                });
            }
        } catch (e) {
            console.log('Beep error:', e);
        }
    }

    /**
     * Load audio playlist
     */
    loadPlaylist(files) {
        this.playlist = Array.from(files).map(file => URL.createObjectURL(file));
        this.currentTrackIdx = 0;
    }

    /**
     * Get current playlist
     */
    getPlaylist() {
        return this.playlist;
    }

    /**
     * Get current track index
     */
    getCurrentTrackIndex() {
        return this.currentTrackIdx;
    }

    /**
     * Set current track index
     */
    setCurrentTrackIndex(idx) {
        this.currentTrackIdx = idx;
    }

    /**
     * Cleanup on unload
     */
    cleanup() {
        this.stopWhiteNoise();
        
        // Revoke all object URLs
        this.playlist.forEach(url => URL.revokeObjectURL(url));
        this.playlist = [];
        
        // Close audio context if it exists
        if (this.audioContext && this.audioContext.state !== 'closed') {
            try {
                this.audioContext.close();
            } catch (e) {
                console.log('Error closing audio context:', e);
            }
        }
        this.audioContext = null;
    }
}

// Export for use in main script
window.AudioManager = AudioManager;