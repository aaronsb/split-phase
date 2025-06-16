class ACWaveformSimulator {
    constructor() {
        this.canvas = document.getElementById('waveform-canvas');
        this.ctx = this.canvas.getContext('2d');
        
        // Sub-visualization canvases
        this.phasorCanvas = document.getElementById('phasor-canvas');
        this.phasorCtx = this.phasorCanvas.getContext('2d');
        this.transformerCanvas = document.getElementById('transformer-canvas');
        this.transformerCtx = this.transformerCanvas.getContext('2d');
        this.transientCanvas = document.getElementById('transient-history-canvas');
        this.transientCtx = this.transientCanvas.getContext('2d');
        
        // Set canvas resolutions
        this.canvas.width = 800;
        this.canvas.height = 400;
        this.phasorCanvas.width = 400;
        this.phasorCanvas.height = 400;
        this.transformerCanvas.width = 400;
        this.transformerCanvas.height = 400;
        this.transientCanvas.width = 600;
        this.transientCanvas.height = 150;
        
        // Simulation parameters
        this.frequency = 60; // Hz
        this.amplitude = 170; // Peak voltage (340V peak-to-peak for North America)
        this.dcOffset = 0; // DC offset voltage
        this.chassisGrounded = true;
        
        // Animation state
        this.time = 0;
        this.animationSpeed = 1;
        this.isPlaying = true;
        this.lastFrameTime = performance.now();
        
        // Fault simulation state
        this.activeFaults = new Map(); // faultId -> {type, startTime, duration, intensity, persistent}
        this.faultIntensity = 0.5;
        this.faultIdCounter = 0;
        
        // Trigger settings
        this.triggerMode = 'auto'; // 'none', 'auto', 'manual'
        this.triggerLevel = 0;
        this.manualTriggerVoltage = 0; // voltage for manual trigger
        this.lastTriggerTime = 0;
        this.triggerDetected = false;
        
        // Split-phase settings
        this.splitPhaseMode = true;
        
        // Phase visualization settings
        this.showPhaseAngle = false;
        
        // Tooltip settings
        this.detailedTooltips = false;
        
        // Waveform history for trail effect
        this.waveformHistory = [];
        this.maxHistoryLength = 400;
        
        // Voltage statistics tracking
        this.voltageStats = {
            peakHigh: this.amplitude,
            peakHighTime: 0,
            peakLow: -this.amplitude,
            peakLowTime: 0,
            maxRMS: 120.2,
            maxRMSTime: 0,
            minRMS: 120.2,
            minRMSTime: 0
        };
        
        // Transient history tracking
        this.transientHistory = [];
        this.maxTransientHistory = 1000; // Maximum data points to store
        this.historyTimebase = 1000; // Current timebase in milliseconds
        this.lastTransientUpdate = 0;
        this.transientUpdateInterval = 16; // Update every ~16ms (60 FPS)
        
        // Previous measurements for transient event detection
        this.lastMeasuredRMS = 120.2;
        this.lastMeasuredL1 = 0;
        this.lastMeasuredL2 = 0;
        
        this.initializeControls();
        this.initializeTooltips();
        // Start animation with initial timestamp
        requestAnimationFrame((time) => {
            this.lastFrameTime = time;
            this.animate(time);
        });
    }
    
    initializeControls() {
        // Split-phase mode control
        const splitPhaseMode = document.getElementById('split-phase-mode');
        splitPhaseMode.addEventListener('change', (e) => {
            this.splitPhaseMode = e.target.checked;
            this.updateParameters();
        });
        
        // Phase angle visualization control
        const showPhaseAngle = document.getElementById('show-phase-angle');
        showPhaseAngle.addEventListener('change', (e) => {
            this.showPhaseAngle = e.target.checked;
        });
        
        // Frequency control
        const freqSlider = document.getElementById('frequency');
        const freqValue = document.getElementById('freq-value');
        freqSlider.addEventListener('input', (e) => {
            this.frequency = parseInt(e.target.value);
            freqValue.textContent = `${this.frequency} Hz`;
            this.updateParameters();
        });
        
        // Amplitude control
        const ampSlider = document.getElementById('amplitude');
        const ampValue = document.getElementById('amp-value');
        const voltageStandard = document.getElementById('voltage-standard');
        
        ampSlider.addEventListener('input', (e) => {
            this.amplitude = parseInt(e.target.value);
            ampValue.textContent = `${this.amplitude} V`;
            
            // Update voltage standard indicator
            if (this.amplitude === 170) {
                voltageStandard.textContent = '✓ North American Standard (120V RMS Split-Phase)';
                voltageStandard.style.color = '#4CAF50';
            } else if (this.amplitude === 155) {
                voltageStandard.textContent = '✓ European Standard (110V RMS Single-Phase)';
                voltageStandard.style.color = '#2196F3';
            } else if (this.amplitude === 230) {
                voltageStandard.textContent = '✓ European Standard (230V RMS Single-Phase)';
                voltageStandard.style.color = '#2196F3';
            } else {
                voltageStandard.textContent = 'Custom Voltage Level';
                voltageStandard.style.color = '#FF9800';
            }
            
            this.updateParameters();
        });
        
        // DC Offset control
        const offsetSlider = document.getElementById('dc-offset');
        const offsetValue = document.getElementById('offset-value');
        offsetSlider.addEventListener('input', (e) => {
            this.dcOffset = parseInt(e.target.value);
            offsetValue.textContent = `${this.dcOffset} V`;
            this.updateParameters();
        });
        
        // Chassis ground checkbox
        const chassisGround = document.getElementById('chassis-ground');
        chassisGround.addEventListener('change', (e) => {
            this.chassisGrounded = e.target.checked;
            this.updateParameters();
        });
        
        // Fault system controls
        const faultType = document.getElementById('fault-type');
        const faultIntensitySlider = document.getElementById('fault-intensity');
        const faultIntensityValue = document.getElementById('fault-intensity-value');
        
        // Note: No need to track selected fault in real-time anymore
        
        faultIntensitySlider.addEventListener('input', (e) => {
            this.faultIntensity = parseInt(e.target.value) / 100;
            faultIntensityValue.textContent = `${e.target.value}%`;
        });
        
        document.getElementById('trigger-fault-btn').addEventListener('click', () => {
            const selectedFault = document.getElementById('fault-type').value;
            if (selectedFault !== 'none') {
                this.triggerFault(selectedFault);
            }
        });
        
        document.getElementById('clear-faults-btn').addEventListener('click', () => {
            this.clearAllFaults();
        });
        
        // Simulation speed control
        const speedSlider = document.getElementById('sim-speed');
        const speedValue = document.getElementById('speed-value');
        speedSlider.addEventListener('input', (e) => {
            // Convert logarithmic slider (0-100) to speed (0.001-1.0)
            const sliderValue = parseInt(e.target.value);
            this.animationSpeed = this.sliderToSpeed(sliderValue);
            speedValue.textContent = `${this.animationSpeed.toFixed(3)}x`;
        });
        
        // Speed preset buttons
        document.getElementById('ultra-slow-btn').addEventListener('click', () => {
            this.setSpeed(0.001);
        });
        
        document.getElementById('slow-btn').addEventListener('click', () => {
            this.setSpeed(0.1);
        });
        
        document.getElementById('normal-btn').addEventListener('click', () => {
            this.setSpeed(1.0);
        });
        
        
        // Reset button
        document.getElementById('reset-btn').addEventListener('click', () => {
            this.resetWaveform();
        });
        
        // Statistics reset button
        document.getElementById('reset-stats-btn').addEventListener('click', () => {
            this.resetStatistics();
        });
        
        // History timebase control
        document.getElementById('history-timebase').addEventListener('change', (e) => {
            this.historyTimebase = parseInt(e.target.value);
        });
        
        // Trigger controls
        const triggerModeRadios = document.querySelectorAll('input[name="trigger-mode"]');
        const triggerLevelControl = document.getElementById('trigger-level-control');
        const manualTriggerControl = document.getElementById('manual-trigger-control');
        
        triggerModeRadios.forEach(radio => {
            radio.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.triggerMode = e.target.value;
                    
                    // Show/hide appropriate controls
                    if (this.triggerMode === 'manual') {
                        triggerLevelControl.style.display = 'block';
                        manualTriggerControl.style.display = 'block';
                    } else if (this.triggerMode === 'auto') {
                        triggerLevelControl.style.display = 'block';
                        manualTriggerControl.style.display = 'none';
                    } else {
                        triggerLevelControl.style.display = 'none';
                        manualTriggerControl.style.display = 'none';
                    }
                }
            });
        });
        
        const triggerLevel = document.getElementById('trigger-level');
        const triggerLevelValue = document.getElementById('trigger-level-value');
        triggerLevel.addEventListener('input', (e) => {
            this.triggerLevel = parseInt(e.target.value);
            triggerLevelValue.textContent = `${this.triggerLevel} V`;
        });
        
        const manualTrigger = document.getElementById('manual-trigger');
        const manualTriggerValue = document.getElementById('manual-trigger-value');
        manualTrigger.addEventListener('input', (e) => {
            this.manualTriggerVoltage = parseInt(e.target.value);
            manualTriggerValue.textContent = `${this.manualTriggerVoltage} V`;
        });
        
        document.getElementById('play-pause-btn').addEventListener('click', (e) => {
            this.isPlaying = !this.isPlaying;
            e.target.textContent = this.isPlaying ? 'Pause' : 'Play';
        });
    }
    
    initializeTooltips() {
        // Handle detailed tooltips toggle
        const detailedTooltipsCheckbox = document.getElementById('detailed-tooltips');
        detailedTooltipsCheckbox.addEventListener('change', (e) => {
            this.detailedTooltips = e.target.checked;
            this.updateTooltipVisibility();
        });
        
        // Initialize tooltip visibility
        this.updateTooltipVisibility();
    }
    
    updateTooltipVisibility() {
        const tooltips = document.querySelectorAll('.tooltip');
        tooltips.forEach(tooltip => {
            const technical = tooltip.querySelector('.tooltip-technical');
            if (technical) {
                technical.style.display = this.detailedTooltips ? 'block' : 'none';
            }
            
            if (this.detailedTooltips) {
                tooltip.classList.add('detailed');
            } else {
                tooltip.classList.remove('detailed');
            }
        });
    }
    
    calculateWaveformValue(t, phaseOffset = 0) {
        let baseValue = this.amplitude * Math.sin(2 * Math.PI * this.frequency * t + phaseOffset);
        
        // Apply DC offset (affected by grounding)
        let offset = this.chassisGrounded ? 0 : this.dcOffset;
        baseValue += offset;
        
        // Apply fault effects if any are active
        for (const [faultId, fault] of this.activeFaults) {
            baseValue += this.calculateFaultEffect(t, phaseOffset, baseValue, fault);
        }
        
        return baseValue;
    }
    
    calculateFaultEffect(t, phaseOffset, baseValue, fault) {
        const faultElapsed = t - fault.startTime;
        if (faultElapsed > fault.duration && !fault.persistent) {
            // Remove non-persistent expired faults
            setTimeout(() => {
                this.activeFaults.delete(fault.id);
                this.updateActiveFaultsList();
            }, 0);
            return 0;
        }
        
        const isL1 = phaseOffset === 0;
        const isL2 = phaseOffset === Math.PI;
        let faultEffect = 0;
        
        switch (fault.type) {
            case 'motor-start-l1':
                if (isL1) {
                    const dampingFactor = Math.exp(-faultElapsed * 5);
                    faultEffect = this.amplitude * fault.intensity * dampingFactor * 
                                Math.sin(2 * Math.PI * 180 * faultElapsed); // High freq oscillation
                }
                break;
                
            case 'motor-start-l2':
                if (isL2) {
                    const dampingFactor = Math.exp(-faultElapsed * 5);
                    faultEffect = this.amplitude * fault.intensity * dampingFactor * 
                                Math.sin(2 * Math.PI * 180 * faultElapsed);
                }
                break;
                
            case 'motor-start-240v':
            case 'ac-compressor':
                // Affects both phases with heavy inrush current
                const dampingFactor = Math.exp(-faultElapsed * 3);
                const currentSag = -this.amplitude * fault.intensity * 0.3 * dampingFactor;
                const oscillation = this.amplitude * fault.intensity * 0.5 * dampingFactor * 
                                  Math.sin(2 * Math.PI * 120 * faultElapsed);
                faultEffect = currentSag + oscillation;
                break;
                
            case 'resistive-switch-l1':
                if (isL1 && faultElapsed < 0.05) {
                    // Realistic switching transient - fast decay over 50ms
                    const dampingFactor = Math.exp(-faultElapsed * 40); // Fast decay
                    faultEffect = this.amplitude * fault.intensity * 0.3 * dampingFactor * 
                                Math.sin(2 * Math.PI * 1000 * faultElapsed);
                }
                break;
                
            case 'resistive-switch-l2':
                if (isL2 && faultElapsed < 0.05) {
                    // Realistic switching transient - fast decay over 50ms
                    const dampingFactor = Math.exp(-faultElapsed * 40); // Fast decay
                    faultEffect = this.amplitude * fault.intensity * 0.3 * dampingFactor * 
                                Math.sin(2 * Math.PI * 1000 * faultElapsed);
                }
                break;
                
            case 'arc-fault-l1':
                if (isL1) {
                    // More controlled arc fault - limit random component
                    const randomComponent = (Math.random() - 0.5) * 0.5; // Limit random to ±0.25
                    faultEffect = this.amplitude * fault.intensity * 0.2 * 
                                (randomComponent + 0.5 * Math.sin(2 * Math.PI * 500 * faultElapsed));
                }
                break;
                
            case 'arc-fault-l2':
                if (isL2) {
                    const randomComponent = (Math.random() - 0.5) * 0.5; // Limit random to ±0.25
                    faultEffect = this.amplitude * fault.intensity * 0.2 * 
                                (randomComponent + 0.5 * Math.sin(2 * Math.PI * 500 * faultElapsed));
                }
                break;
                
            case 'arc-fault-240v':
                // More controlled chaotic arcing between L1 and L2
                const randomComponent = (Math.random() - 0.5) * 0.3; // Limit random to ±0.15
                faultEffect = this.amplitude * fault.intensity * 0.15 * 
                            (randomComponent + 0.7 * Math.sin(2 * Math.PI * 300 * faultElapsed));
                break;
                
            case 'imbalanced-240v':
                // L1 normal, L2 reduced
                if (isL2) {
                    faultEffect = -this.amplitude * fault.intensity * 0.5;
                }
                break;
            
            case 'neutral-loss':
                // Voltage rises on both phases - very dangerous
                faultEffect = this.amplitude * fault.intensity * 0.6;
                break;
                
            case 'phase-imbalance':
                if (isL2) {
                    faultEffect = -this.amplitude * fault.intensity * 0.3;
                }
                break;
                
            case 'ground-fault':
                // Causes voltage shift
                faultEffect = this.amplitude * fault.intensity * 0.2;
                break;
                
            case 'harmonic-distortion':
                // Add 3rd and 5th harmonics
                faultEffect = this.amplitude * fault.intensity * 0.3 * 
                            (Math.sin(2 * Math.PI * this.frequency * 3 * t + phaseOffset) * 0.6 +
                             Math.sin(2 * Math.PI * this.frequency * 5 * t + phaseOffset) * 0.4);
                break;
                
            case 'mosfet-failure':
                // One switching leg fails - creates DC offset and distortion
                if (isL1) {
                    faultEffect = this.amplitude * fault.intensity * 0.5;
                    // Clamp negative half-cycle
                    if (Math.sin(2 * Math.PI * this.frequency * t) < 0) {
                        faultEffect += this.amplitude * fault.intensity * 0.8;
                    }
                }
                break;
                
            case 'transformer-saturation':
                // Saturation causes current spikes at peaks
                const satLevel = this.amplitude * (1 - fault.intensity * 0.3);
                if (Math.abs(baseValue) > satLevel) {
                    faultEffect = this.amplitude * fault.intensity * 0.8 * Math.sign(baseValue);
                }
                break;
                
            case 'dc-injection':
                // DC component injection
                faultEffect = this.amplitude * fault.intensity * 0.4;
                break;
                
            case 'feedback-oscillation':
                // High-frequency oscillation on both phases
                const oscFreq = 800 + (Math.random() * 200); // Variable frequency
                faultEffect = this.amplitude * fault.intensity * 0.3 * 
                            Math.sin(2 * Math.PI * oscFreq * faultElapsed) * 
                            Math.exp(-faultElapsed * 2);
                break;
        }
        
        return faultEffect;
    }
    
    drawWaveform() {
        const width = this.canvas.width;
        const height = this.canvas.height;
        const centerY = height / 2;
        const timeWindow = 4 / this.frequency; // Show 4 cycles
        
        // Clear canvas
        this.ctx.fillStyle = '#000';
        this.ctx.fillRect(0, 0, width, height);
        
        // Draw grid
        this.drawGrid();
        
        // Draw waveform history (trail effect)
        this.ctx.strokeStyle = 'rgba(76, 175, 80, 0.3)';
        this.ctx.lineWidth = 1;
        for (let i = 0; i < this.waveformHistory.length - 1; i++) {
            const alpha = i / this.waveformHistory.length * 0.3;
            this.ctx.strokeStyle = `rgba(76, 175, 80, ${alpha})`;
            this.drawWaveformSegment(this.waveformHistory[i], timeWindow, centerY, 0);
        }
        
        // Draw current waveform
        if (this.splitPhaseMode) {
            // Draw L1 (normal phase)
            this.ctx.strokeStyle = '#4CAF50';
            this.ctx.lineWidth = 2;
            this.drawWaveformSegment(this.time, timeWindow, centerY, 0);
            
            // Draw L2 (180° out of phase)
            this.ctx.strokeStyle = '#FF9800';
            this.ctx.lineWidth = 2;
            this.drawWaveformSegment(this.time, timeWindow, centerY, Math.PI);
            
            // Add phase labels
            this.ctx.fillStyle = '#4CAF50';
            this.ctx.font = '12px Arial';
            this.ctx.fillText('L1 (Hot)', 10, 20);
            this.ctx.fillStyle = '#FF9800';
            this.ctx.fillText('L2 (Hot) - 180°', 10, 35);
            this.ctx.fillStyle = '#2196F3';
            this.ctx.fillText('N (Neutral)', 10, 50);
        } else {
            // Single phase
            this.ctx.strokeStyle = '#4CAF50';
            this.ctx.lineWidth = 2;
            this.drawWaveformSegment(this.time, timeWindow, centerY, 0);
        }
        
        // Draw zero crossing line
        this.drawZeroCrossing(centerY);
        
        // Draw voltage markers
        this.drawVoltageMarkers(centerY);
        
        // Draw current time indicator
        this.drawTimeIndicator(timeWindow);
    }
    
    findTriggerTime() {
        // Find the most recent rising edge crossing of trigger level
        const period = 1 / this.frequency;
        const currentCycle = Math.floor(this.time / period);
        
        // Calculate when the sine wave crosses the trigger level on rising edge
        const effectiveOffset = this.chassisGrounded ? 0 : this.dcOffset;
        const adjustedTriggerLevel = this.triggerLevel - effectiveOffset;
        
        // Sine wave crosses trigger level at: sin(2πft) = adjustedTriggerLevel/amplitude
        if (Math.abs(adjustedTriggerLevel) <= this.amplitude) {
            const phase = Math.asin(adjustedTriggerLevel / this.amplitude);
            // Rising edge occurs at phase (not π - phase)
            const triggerTimeInCycle = phase / (2 * Math.PI * this.frequency);
            return currentCycle * period + triggerTimeInCycle;
        }
        
        // If trigger level is outside amplitude, trigger on zero crossing
        return currentCycle * period;
    }
    
    findManualTriggerTime() {
        // Find the most recent rising edge crossing of manual trigger voltage
        const period = 1 / this.frequency;
        const currentCycle = Math.floor(this.time / period);
        
        // Calculate when the sine wave crosses the manual trigger voltage on rising edge
        const effectiveOffset = this.chassisGrounded ? 0 : this.dcOffset;
        const adjustedTriggerLevel = this.manualTriggerVoltage - effectiveOffset;
        
        // Sine wave crosses trigger level at: sin(2πft) = adjustedTriggerLevel/amplitude
        if (Math.abs(adjustedTriggerLevel) <= this.amplitude) {
            const phase = Math.asin(adjustedTriggerLevel / this.amplitude);
            // Rising edge occurs at phase (not π - phase)
            const triggerTimeInCycle = phase / (2 * Math.PI * this.frequency);
            return currentCycle * period + triggerTimeInCycle;
        }
        
        // If trigger level is outside amplitude, trigger on zero crossing
        return currentCycle * period;
    }
    
    drawWaveformSegment(referenceTime, timeWindow, centerY, phaseOffset = 0) {
        const width = this.canvas.width;
        const pixelsPerSecond = width / timeWindow;
        const voltageScale = 100 / this.amplitude; // pixels per volt
        
        let startTime;
        
        if (this.triggerMode === 'auto') {
            // Auto trigger - center the trigger point in the display
            const triggerTime = this.findTriggerTime();
            startTime = triggerTime - timeWindow / 2;
        } else if (this.triggerMode === 'manual') {
            // Manual trigger - find trigger point based on manual voltage setting
            const triggerTime = this.findManualTriggerTime();
            startTime = triggerTime - timeWindow / 2;
        } else {
            // No trigger - free-running mode
            startTime = referenceTime - timeWindow;
        }
        
        this.ctx.beginPath();
        
        // Calculate sampling resolution based on simulation speed
        const pixelTimeStep = timeWindow / width;
        
        // Adjust resolution based on simulation speed:
        // Slower speeds = more time to compute = higher resolution
        // Faster speeds = less time to compute = lower resolution  
        let resolutionMultiplier;
        if (this.animationSpeed >= 0.5) {
            resolutionMultiplier = 1; // Real-time: pixel resolution only
        } else if (this.animationSpeed >= 0.1) {
            resolutionMultiplier = 2; // 2x pixel resolution
        } else if (this.animationSpeed >= 0.01) {
            resolutionMultiplier = 5; // 5x pixel resolution
        } else {
            resolutionMultiplier = 10; // Very slow: 10x pixel resolution
        }
        
        const timeStep = pixelTimeStep / resolutionMultiplier;
        
        const totalSamples = Math.ceil(timeWindow / timeStep);
        
        // Performance safeguard: scale max samples with animation speed
        // Slower speeds can handle more samples since frames are less frequent
        const baseSamples = 2000; // Base limit for real-time
        const maxSamples = Math.min(baseSamples / this.animationSpeed, 20000); // Scale with speed, cap at 20k
        const effectiveSamples = Math.min(totalSamples, maxSamples);
        const effectiveTimeStep = timeWindow / effectiveSamples;
        
        // Pre-calculate voltage samples
        const voltageData = [];
        for (let i = 0; i <= effectiveSamples; i++) {
            const t = startTime + (i * effectiveTimeStep);
            voltageData.push(this.calculateWaveformValue(t, phaseOffset));
        }
        
        // Draw waveform by sampling voltage data at pixel positions
        for (let x = 0; x < width; x++) {
            const timeAtPixel = (x / pixelsPerSecond);
            const sampleIndex = Math.floor(timeAtPixel / effectiveTimeStep);
            const voltage = voltageData[Math.min(sampleIndex, voltageData.length - 1)];
            const y = centerY - (voltage * voltageScale);
            
            if (x === 0) {
                this.ctx.moveTo(x, y);
            } else {
                this.ctx.lineTo(x, y);
            }
        }
        this.ctx.stroke();
    }
    
    drawGrid() {
        const width = this.canvas.width;
        const height = this.canvas.height;
        
        this.ctx.strokeStyle = '#333';
        this.ctx.lineWidth = 1;
        
        // Horizontal grid lines (voltage)
        for (let i = 0; i <= 10; i++) {
            const y = (height / 10) * i;
            this.ctx.beginPath();
            this.ctx.moveTo(0, y);
            this.ctx.lineTo(width, y);
            this.ctx.stroke();
        }
        
        // Vertical grid lines (time)
        for (let i = 0; i <= 20; i++) {
            const x = (width / 20) * i;
            this.ctx.beginPath();
            this.ctx.moveTo(x, 0);
            this.ctx.lineTo(x, height);
            this.ctx.stroke();
        }
    }
    
    drawZeroCrossing(centerY) {
        const effectiveOffset = this.chassisGrounded ? 0 : this.dcOffset;
        const offsetY = centerY - (effectiveOffset * 100 / this.amplitude);
        
        this.ctx.strokeStyle = effectiveOffset === 0 ? '#2196F3' : '#FF9800';
        this.ctx.lineWidth = 2;
        this.ctx.setLineDash([5, 5]);
        this.ctx.beginPath();
        this.ctx.moveTo(0, offsetY);
        this.ctx.lineTo(this.canvas.width, offsetY);
        this.ctx.stroke();
        this.ctx.setLineDash([]);
        
        // Label
        this.ctx.fillStyle = effectiveOffset === 0 ? '#2196F3' : '#FF9800';
        this.ctx.font = '12px Arial';
        this.ctx.fillText(`Zero: ${effectiveOffset}V`, 10, offsetY - 5);
    }
    
    drawVoltageMarkers(centerY) {
        const voltageScale = 100 / this.amplitude;
        
        this.ctx.fillStyle = '#888';
        this.ctx.font = '10px Arial';
        
        // Positive peak
        const posY = centerY - (this.amplitude * voltageScale);
        this.ctx.fillText(`+${this.amplitude}V`, this.canvas.width - 50, posY + 15);
        
        // Negative peak
        const negY = centerY + (this.amplitude * voltageScale);
        this.ctx.fillText(`-${this.amplitude}V`, this.canvas.width - 50, negY - 5);
    }
    
    drawTimeIndicator(timeWindow) {
        const width = this.canvas.width;
        let x;
        
        if (this.triggerMode === 'auto' || this.triggerMode === 'manual') {
            // When triggered, show the trigger point at center of screen
            x = width / 2;
            this.ctx.strokeStyle = this.triggerMode === 'auto' ? '#FF4444' : '#44FF44';
        } else {
            // Free-running mode - sweeping indicator
            x = width - (this.time % (timeWindow / 4)) * (width / (timeWindow / 4));
            this.ctx.strokeStyle = '#FF4444';
        }
        
        this.ctx.lineWidth = 2;
        this.ctx.beginPath();
        this.ctx.moveTo(x, 0);
        this.ctx.lineTo(x, this.canvas.height);
        this.ctx.stroke();
        
        // Add trigger level indicator when in auto trigger mode
        if (this.triggerMode === 'auto') {
            const centerY = this.canvas.height / 2;
            const effectiveOffset = this.chassisGrounded ? 0 : this.dcOffset;
            const triggerY = centerY - ((this.triggerLevel - effectiveOffset) * 100 / this.amplitude);
            
            this.ctx.fillStyle = '#FF4444';
            this.ctx.fillRect(x - 8, triggerY - 2, 16, 4);
            
            // Label
            this.ctx.fillStyle = '#FF4444';
            this.ctx.font = '10px Arial';
            this.ctx.fillText(`T: ${this.triggerLevel}V`, x + 10, triggerY + 4);
        }
        
        // Add manual trigger position indicator
        if (this.triggerMode === 'manual') {
            this.ctx.fillStyle = '#44FF44';
            this.ctx.font = '10px Arial';
            this.ctx.fillText(`Manual: ${this.manualTriggerPosition}°`, x + 10, 20);
        }
    }
    
    updateParameters() {
        const effectiveOffset = this.chassisGrounded ? 0 : this.dcOffset;
        const peakToPeak = this.amplitude * 2;
        const rmsVoltage = this.amplitude / Math.sqrt(2);
        const maxPositive = this.amplitude + effectiveOffset;
        const maxNegative = -this.amplitude + effectiveOffset;
        
        // Update display values
        document.getElementById('peak-to-peak').textContent = `${peakToPeak} V`;
        document.getElementById('rms-voltage').textContent = `${rmsVoltage.toFixed(1)} V`;
        document.getElementById('zero-crossing').textContent = `${effectiveOffset} V`;
        document.getElementById('max-positive').textContent = `+${maxPositive} V`;
        document.getElementById('max-negative').textContent = `${maxNegative} V`;
        document.getElementById('ground-state').textContent = this.chassisGrounded ? 'Bonded' : 'Floating';
        document.getElementById('sim-time').textContent = `${this.time.toFixed(2)}s`;
        document.getElementById('time-rate').textContent = `${this.animationSpeed.toFixed(3)}x`;
        
        // Safety alerts
        this.updateSafetyAlerts(effectiveOffset, maxPositive, maxNegative);
    }
    
    updateSafetyAlerts(offset, maxPos, maxNeg) {
        const alertsDiv = document.getElementById('safety-alerts');
        alertsDiv.innerHTML = '';
        
        if (Math.abs(offset) > 30) {
            const warningDiv = document.createElement('div');
            warningDiv.className = 'danger-zone';
            warningDiv.textContent = `DANGER: Zero crossing elevated to ${offset}V - Electrical hazard!`;
            alertsDiv.appendChild(warningDiv);
        }
        
        if (!this.chassisGrounded && Math.abs(this.dcOffset) > 10) {
            const warningDiv = document.createElement('div');
            warningDiv.className = 'warning';
            warningDiv.textContent = 'WARNING: Floating ground may cause waveform instability';
            alertsDiv.appendChild(warningDiv);
        }
        
        // Show warnings for active faults
        for (const [faultId, fault] of this.activeFaults) {
            const warningDiv = document.createElement('div');
            let faultDescription = this.getFaultDescription(fault.type);
            let className = this.getFaultSeverity(fault.type);
            
            warningDiv.className = className;
            warningDiv.textContent = faultDescription;
            alertsDiv.appendChild(warningDiv);
        }
    }
    
    triggerFault(faultType) {
        // Don't add duplicate persistent faults
        const isPersistent = this.isPersistentFault(faultType);
        if (isPersistent) {
            for (const [id, fault] of this.activeFaults) {
                if (fault.type === faultType) {
                    return; // Fault already active
                }
            }
        }
        
        const faultId = this.faultIdCounter++;
        const fault = {
            id: faultId,
            type: faultType,
            startTime: this.time,
            duration: this.getFaultDuration(faultType),
            intensity: this.faultIntensity,
            persistent: isPersistent
        };
        
        this.activeFaults.set(faultId, fault);
        this.updateActiveFaultsList();
    }
    
    clearAllFaults() {
        this.activeFaults.clear();
        this.updateActiveFaultsList();
    }
    
    getFaultDuration(faultType) {
        // Realistic fault durations based on actual electrical behavior
        switch (faultType) {
            case 'motor-start-l1':
            case 'motor-start-l2':
            case 'motor-start-240v':
            case 'ac-compressor':
                return 0.5; // Motor startup transients (realistic duration)
            case 'resistive-switch-l1':
            case 'resistive-switch-l2':
                return 0.05; // Brief switching transient (realistic duration)
            case 'arc-fault-l1':
            case 'arc-fault-l2':
            case 'arc-fault-240v':
                return 0.3; // Arc duration (realistic)
            case 'ground-fault':
                return 2; // Until protective device trips
            case 'harmonic-distortion':
                return 5; // Non-linear load effect
            case 'feedback-oscillation':
                return 0.8; // Control system response
            default:
                return 10; // Persistent faults
        }
    }
    
    isPersistentFault(faultType) {
        const persistentFaults = [
            'neutral-loss', 'phase-imbalance', 'imbalanced-240v',
            'mosfet-failure', 'transformer-saturation', 'dc-injection'
        ];
        return persistentFaults.includes(faultType);
    }
    
    getFaultDescription(faultType) {
        switch (faultType) {
            case 'motor-start-l1':
            case 'motor-start-l2':
                return 'Motor startup transient - High inrush current detected';
            case 'motor-start-240v':
            case 'ac-compressor':
                return 'Heavy 240V motor startup - Voltage sag on both phases';
            case 'arc-fault-l1':
            case 'arc-fault-l2':
            case 'arc-fault-240v':
                return 'ARC FAULT DETECTED - Fire hazard present!';
            case 'neutral-loss':
                return 'NEUTRAL LOSS - EXTREME DANGER! 240V on 120V circuits!';
            case 'ground-fault':
                return 'Ground fault detected - Protective device should trip';
            case 'phase-imbalance':
            case 'imbalanced-240v':
                return 'Phase imbalance detected - Uneven loading';
            case 'harmonic-distortion':
                return 'Harmonic distortion - Non-linear loads affecting power quality';
            case 'mosfet-failure':
                return 'MOSFET failure - Inverter malfunction detected';
            case 'transformer-saturation':
                return 'Transformer saturation - Core overflux condition';
            case 'dc-injection':
                return 'DC injection detected - Transformer heating risk';
            case 'feedback-oscillation':
                return 'Control feedback oscillation - System instability';
            default:
                return 'Electrical fault in progress';
        }
    }
    
    getFaultSeverity(faultType) {
        const dangerousFaults = [
            'arc-fault-l1', 'arc-fault-l2', 'arc-fault-240v',
            'neutral-loss', 'ground-fault', 'mosfet-failure'
        ];
        return dangerousFaults.includes(faultType) ? 'danger-zone' : 'warning';
    }
    
    updateActiveFaultsList() {
        const listElement = document.getElementById('active-faults-list');
        listElement.innerHTML = '';
        
        if (this.activeFaults.size === 0) {
            const noFaultsDiv = document.createElement('div');
            noFaultsDiv.style.color = '#888';
            noFaultsDiv.style.fontStyle = 'italic';
            noFaultsDiv.textContent = 'No active faults';
            listElement.appendChild(noFaultsDiv);
        } else {
            for (const [faultId, fault] of this.activeFaults) {
                const faultDiv = document.createElement('div');
                faultDiv.style.marginBottom = '3px';
                faultDiv.style.padding = '3px 6px';
                faultDiv.style.backgroundColor = this.getFaultSeverity(fault.type) === 'danger-zone' ? '#441111' : '#332200';
                faultDiv.style.borderRadius = '3px';
                faultDiv.style.borderLeft = `3px solid ${this.getFaultSeverity(fault.type) === 'danger-zone' ? '#f44336' : '#ff9800'}`;
                
                const elapsed = this.time - fault.startTime;
                const status = fault.persistent ? 'PERSISTENT' : `${elapsed.toFixed(1)}s / ${fault.duration.toFixed(1)}s`;
                
                faultDiv.innerHTML = `
                    <div style="font-weight: bold; color: ${this.getFaultSeverity(fault.type) === 'danger-zone' ? '#ff6666' : '#ffaa44'};">
                        ${this.getFaultDisplayName(fault.type)}
                    </div>
                    <div style="font-size: 10px; color: #aaa;">
                        ${status} | Intensity: ${(fault.intensity * 100).toFixed(0)}%
                    </div>
                `;
                listElement.appendChild(faultDiv);
            }
        }
    }
    
    getFaultDisplayName(faultType) {
        switch (faultType) {
            case 'motor-start-l1': return 'Motor Start (L1)';
            case 'motor-start-l2': return 'Motor Start (L2)';
            case 'motor-start-240v': return 'Heavy Motor (240V)';
            case 'ac-compressor': return 'A/C Compressor';
            case 'resistive-switch-l1': return 'Switch (L1)';
            case 'resistive-switch-l2': return 'Switch (L2)';
            case 'arc-fault-l1': return 'Arc Fault (L1)';
            case 'arc-fault-l2': return 'Arc Fault (L2)';
            case 'arc-fault-240v': return 'Arc Fault (240V)';
            case 'imbalanced-240v': return 'Imbalanced 240V';
            case 'neutral-loss': return 'NEUTRAL LOSS';
            case 'phase-imbalance': return 'Phase Imbalance';
            case 'ground-fault': return 'Ground Fault';
            case 'harmonic-distortion': return 'Harmonics';
            case 'mosfet-failure': return 'MOSFET Failure';
            case 'transformer-saturation': return 'Transformer Sat.';
            case 'dc-injection': return 'DC Injection';
            case 'feedback-oscillation': return 'Feedback Osc.';
            default: return faultType;
        }
    }
    
    // Convert logarithmic slider value (0-100) to speed (0.001-1.0)
    sliderToSpeed(sliderValue) {
        // Logarithmic scale: 0.001 to 1.0
        // log(0.001) = -6.907, log(1.0) = 0
        // Map 0-100 to -6.907 to 0
        const minLog = Math.log(0.001);
        const maxLog = Math.log(1.0);
        const scale = (maxLog - minLog) / 100;
        return Math.exp(minLog + scale * sliderValue);
    }
    
    // Convert speed (0.001-1.0) to logarithmic slider value (0-100)
    speedToSlider(speed) {
        const minLog = Math.log(0.001);
        const maxLog = Math.log(1.0);
        const scale = (maxLog - minLog) / 100;
        return Math.round((Math.log(speed) - minLog) / scale);
    }
    
    setSpeed(speed) {
        // Cap speed at 1.0x (real-time)
        this.animationSpeed = Math.min(speed, 1.0);
        // Update slider to corresponding logarithmic position
        document.getElementById('sim-speed').value = this.speedToSlider(this.animationSpeed);
        // Use 3 decimal places for better precision display
        document.getElementById('speed-value').textContent = `${this.animationSpeed.toFixed(3)}x`;
    }
    
    resetWaveform() {
        this.time = 0;
        this.lastFrameTime = performance.now();
        this.activeFaults.clear();
        this.waveformHistory = [];
        document.getElementById('dc-offset').value = 0;
        document.getElementById('offset-value').textContent = '0 V';
        document.getElementById('chassis-ground').checked = true;
        document.getElementById('fault-type').value = 'none';
        this.dcOffset = 0;
        this.chassisGrounded = true;
        this.updateParameters();
        this.updateActiveFaultsList();
    }
    
    animate(currentTime) {
        if (this.isPlaying) {
            // Calculate actual elapsed time since last frame
            const deltaTime = (currentTime - this.lastFrameTime) / 1000; // Convert to seconds
            this.lastFrameTime = currentTime;
            
            // Increment simulation time based on actual elapsed time and speed
            this.time += deltaTime * this.animationSpeed;
            
            // Store waveform history for trail effect
            if (this.waveformHistory.length >= this.maxHistoryLength) {
                this.waveformHistory.shift();
            }
            this.waveformHistory.push(this.time - deltaTime);
        }
        
        this.drawWaveform();
        this.drawPhasorDiagram();
        this.drawTransformerDiagram();
        this.updateVoltageStatistics();
        this.drawTransientHistory();
        this.updateParameters();
        this.updateActiveFaultsList();
        
        requestAnimationFrame((time) => this.animate(time));
    }
    
    drawPhasorDiagram() {
        const width = this.phasorCanvas.width;
        const height = this.phasorCanvas.height;
        const centerX = width / 2;
        const centerY = height / 2;
        const radius = 120;
        
        // Clear canvas
        this.phasorCtx.fillStyle = '#1a1a1a';
        this.phasorCtx.fillRect(0, 0, width, height);
        
        // Draw grid background like main visualization
        this.drawPhasorGrid();
        
        // Draw angle markers (0°, 90°, 180°, 270°)
        this.drawAngleMarkers(centerX, centerY, radius);
        
        // Draw circle
        this.phasorCtx.strokeStyle = '#444';
        this.phasorCtx.lineWidth = 2;
        this.phasorCtx.beginPath();
        this.phasorCtx.arc(centerX, centerY, radius, 0, 2 * Math.PI);
        this.phasorCtx.stroke();
        
        // Static phase angles (120° apart, North American colors)
        const phaseA = 0;                    // 0° (reference)
        const phaseB = -2 * Math.PI / 3;     // -120°
        const phaseC = -4 * Math.PI / 3;     // -240° (or +120°)
        
        // Draw static phasors with North American 3-phase colors
        this.drawPhasor(centerX, centerY, radius, phaseA, '#cccccc', 'A'); // Light Gray
        this.drawPhasor(centerX, centerY, radius, phaseB, '#ff4444', 'B'); // Red
        this.drawPhasor(centerX, centerY, radius, phaseC, '#4444ff', 'C'); // Blue
        
        // Draw rotating phase angle indicator if enabled
        if (this.showPhaseAngle) {
            // Use the same time calculation as the main waveform
            const currentAngle = this.time * 2 * Math.PI * this.frequency;
            this.drawPhaseAngleIndicator(centerX, centerY, radius * 0.8, currentAngle);
            
            // Display current angle in upper right corner
            const degrees = ((currentAngle * 180 / Math.PI) % 360 + 360) % 360;
            this.phasorCtx.fillStyle = '#4CAF50';
            this.phasorCtx.font = 'bold 16px Arial';
            this.phasorCtx.textAlign = 'right';
            this.phasorCtx.fillText(`${degrees.toFixed(1)}°`, width - 10, 25);
        }
    }
    
    drawPhasor(centerX, centerY, radius, angle, color, label) {
        const endX = centerX + radius * Math.cos(angle);
        const endY = centerY - radius * Math.sin(angle);
        
        // Draw phasor line
        this.phasorCtx.strokeStyle = color;
        this.phasorCtx.lineWidth = 3;
        this.phasorCtx.beginPath();
        this.phasorCtx.moveTo(centerX, centerY);
        this.phasorCtx.lineTo(endX, endY);
        this.phasorCtx.stroke();
        
        // Draw arrowhead
        const arrowSize = 8;
        const arrowAngle = Math.PI / 6;
        this.phasorCtx.fillStyle = color;
        this.phasorCtx.beginPath();
        this.phasorCtx.moveTo(endX, endY);
        this.phasorCtx.lineTo(
            endX - arrowSize * Math.cos(angle - arrowAngle),
            endY + arrowSize * Math.sin(angle - arrowAngle)
        );
        this.phasorCtx.lineTo(
            endX - arrowSize * Math.cos(angle + arrowAngle),
            endY + arrowSize * Math.sin(angle + arrowAngle)
        );
        this.phasorCtx.closePath();
        this.phasorCtx.fill();
        
        // Draw label
        this.phasorCtx.fillStyle = color;
        this.phasorCtx.font = 'bold 14px Arial';
        this.phasorCtx.textAlign = 'center';
        this.phasorCtx.fillText(label, endX + 15 * Math.cos(angle), endY - 15 * Math.sin(angle) + 5);
    }
    
    drawPhaseAngleIndicator(centerX, centerY, radius, angle) {
        const endX = centerX + radius * Math.cos(angle);
        const endY = centerY - radius * Math.sin(angle);
        
        // Draw rotating phase indicator line (orange)
        this.phasorCtx.strokeStyle = '#ff9800';
        this.phasorCtx.lineWidth = 2;
        this.phasorCtx.beginPath();
        this.phasorCtx.moveTo(centerX, centerY);
        this.phasorCtx.lineTo(endX, endY);
        this.phasorCtx.stroke();
        
        // Draw arrowhead
        const arrowSize = 6;
        const arrowAngle = Math.PI / 6;
        this.phasorCtx.fillStyle = '#ff9800';
        this.phasorCtx.beginPath();
        this.phasorCtx.moveTo(endX, endY);
        this.phasorCtx.lineTo(
            endX - arrowSize * Math.cos(angle - arrowAngle),
            endY + arrowSize * Math.sin(angle - arrowAngle)
        );
        this.phasorCtx.lineTo(
            endX - arrowSize * Math.cos(angle + arrowAngle),
            endY + arrowSize * Math.sin(angle + arrowAngle)
        );
        this.phasorCtx.closePath();
        this.phasorCtx.fill();
        
        // Draw small circle at center
        this.phasorCtx.fillStyle = '#ff9800';
        this.phasorCtx.beginPath();
        this.phasorCtx.arc(centerX, centerY, 3, 0, 2 * Math.PI);
        this.phasorCtx.fill();
    }
    
    drawPhasorGrid() {
        const width = this.phasorCanvas.width;
        const height = this.phasorCanvas.height;
        
        this.phasorCtx.strokeStyle = '#333';
        this.phasorCtx.lineWidth = 1;
        
        // Horizontal grid lines
        for (let i = 0; i <= 10; i++) {
            const y = (height / 10) * i;
            this.phasorCtx.beginPath();
            this.phasorCtx.moveTo(0, y);
            this.phasorCtx.lineTo(width, y);
            this.phasorCtx.stroke();
        }
        
        // Vertical grid lines
        for (let i = 0; i <= 10; i++) {
            const x = (width / 10) * i;
            this.phasorCtx.beginPath();
            this.phasorCtx.moveTo(x, 0);
            this.phasorCtx.lineTo(x, height);
            this.phasorCtx.stroke();
        }
    }
    
    drawAngleMarkers(centerX, centerY, radius) {
        const angles = [0, 90, 180, 270];
        const labels = ['0°', '90°', '180°', '270°'];
        
        this.phasorCtx.strokeStyle = '#666';
        this.phasorCtx.lineWidth = 1;
        this.phasorCtx.fillStyle = '#888';
        this.phasorCtx.font = '12px Arial';
        this.phasorCtx.textAlign = 'center';
        
        angles.forEach((deg, index) => {
            const angle = (deg * Math.PI) / 180;
            const x1 = centerX + (radius + 10) * Math.cos(angle);
            const y1 = centerY - (radius + 10) * Math.sin(angle);
            const x2 = centerX + (radius + 25) * Math.cos(angle);
            const y2 = centerY - (radius + 25) * Math.sin(angle);
            
            // Draw tick mark
            this.phasorCtx.beginPath();
            this.phasorCtx.moveTo(x1, y1);
            this.phasorCtx.lineTo(x2, y2);
            this.phasorCtx.stroke();
            
            // Draw label
            const labelX = centerX + (radius + 35) * Math.cos(angle);
            const labelY = centerY - (radius + 35) * Math.sin(angle) + 4;
            this.phasorCtx.fillText(labels[index], labelX, labelY);
        });
    }
    
    drawTransformerDiagram() {
        const width = this.transformerCanvas.width;
        const height = this.transformerCanvas.height;
        
        // Clear canvas
        this.transformerCtx.fillStyle = '#1a1a1a';
        this.transformerCtx.fillRect(0, 0, width, height);
        
        // Draw grid background like main visualization
        this.drawTransformerGrid();
        
        // Scale up positions for larger canvas
        const scale = width / 300;
        const centerY = height / 2 + 20 * scale; // Shift down by 20 scale units
        
        // Draw three transformers with scaled positions
        this.drawSingleTransformer(70 * scale, centerY, 'T1');
        this.drawSingleTransformer(150 * scale, centerY, 'T2');
        this.drawSingleTransformer(230 * scale, centerY, 'T3');
        
        // Draw 3-phase distribution lines (7200V) - each phase in its own color
        this.transformerCtx.lineWidth = 4; // Thicker for grid side
        
        // Calculate distribution line position (shift down by 20 scale units)
        const distributionY = 40 * scale + 20 * scale;
        
        // Phase A (light gray like phasor diagram)
        this.transformerCtx.strokeStyle = '#cccccc';
        this.transformerCtx.beginPath();
        this.transformerCtx.moveTo(10 * scale, distributionY - 5 * scale);
        this.transformerCtx.lineTo(280 * scale, distributionY - 5 * scale);
        this.transformerCtx.stroke();
        
        // Phase B (red)
        this.transformerCtx.strokeStyle = '#ff4444';
        this.transformerCtx.beginPath();
        this.transformerCtx.moveTo(10 * scale, distributionY);
        this.transformerCtx.lineTo(280 * scale, distributionY);
        this.transformerCtx.stroke();
        
        // Phase C (blue)
        this.transformerCtx.strokeStyle = '#4444ff';
        this.transformerCtx.beginPath();
        this.transformerCtx.moveTo(10 * scale, distributionY + 5 * scale);
        this.transformerCtx.lineTo(280 * scale, distributionY + 5 * scale);
        this.transformerCtx.stroke();
        
        // Connections to transformers with phase labels
        const phases = ['P1', 'P2', 'P3'];
        const phaseColors = ['#cccccc', '#ff4444', '#4444ff']; // Match the distribution line colors
        const xPositions = [70 * scale, 150 * scale, 230 * scale];
        xPositions.forEach((x, index) => {
            // Two connection lines from distribution to transformer - match phase colors
            this.transformerCtx.strokeStyle = phaseColors[index];
            this.transformerCtx.lineWidth = 4; // Keep grid side thickness
            
            // Get the correct Y position for each phase line (using the shifted positions)
            const phaseYPositions = [distributionY - 5 * scale, distributionY, distributionY + 5 * scale]; // Gray, Red, Blue
            
            // Left line
            this.transformerCtx.beginPath();
            this.transformerCtx.moveTo(x - 15 * scale, phaseYPositions[index]);
            this.transformerCtx.lineTo(x - 15 * scale, centerY - 20 * scale);
            this.transformerCtx.stroke();
            
            // Right line
            this.transformerCtx.beginPath();
            this.transformerCtx.moveTo(x + 15 * scale, phaseYPositions[index]);
            this.transformerCtx.lineTo(x + 15 * scale, centerY - 20 * scale);
            this.transformerCtx.stroke();
            
            // Add phase labels above the connection points (shifted down)
            this.transformerCtx.fillStyle = '#fff';
            this.transformerCtx.font = `bold ${14 * scale}px Arial`;
            this.transformerCtx.textAlign = 'center';
            this.transformerCtx.fillText(phases[index], x, distributionY - 10 * scale);
        });
        
        // Low voltage output lines (240V split-phase)
        this.transformerCtx.lineWidth = 2; // Thinner for subscriber side
        
        xPositions.forEach(x => {
            // L1 (hot - left line, red)
            this.transformerCtx.strokeStyle = '#ff0000'; // Red for L1
            this.transformerCtx.beginPath();
            this.transformerCtx.moveTo(x - 15 * scale, centerY + 20 * scale); // Start at secondary coil level
            this.transformerCtx.lineTo(x - 15 * scale, centerY + 70 * scale);
            this.transformerCtx.stroke();
            
            // L2 (hot - right line, gray)
            this.transformerCtx.strokeStyle = '#888888'; // Gray for L2
            this.transformerCtx.beginPath();
            this.transformerCtx.moveTo(x + 15 * scale, centerY + 20 * scale); // Start at secondary coil level
            this.transformerCtx.lineTo(x + 15 * scale, centerY + 70 * scale);
            this.transformerCtx.stroke();
            
            // Neutral (center tap)
            this.transformerCtx.strokeStyle = '#ffffff'; // White for neutral
            this.transformerCtx.beginPath();
            this.transformerCtx.moveTo(x, centerY + 20 * scale); // Start at secondary coil level
            this.transformerCtx.lineTo(x, centerY + 70 * scale); // Extend down to match L1/L2 length
            this.transformerCtx.stroke();
        });
        
        // Labels with larger, readable text
        this.transformerCtx.fillStyle = '#fff';
        this.transformerCtx.font = `${16 * scale}px Arial`;
        this.transformerCtx.textAlign = 'center';
        this.transformerCtx.fillText('7200V Grid Distribution', width / 2, 20 * scale);
        this.transformerCtx.fillText('240V Split Phase', width / 2, height - 15 * scale); // Moved down 15 units, removed "Service"
    }
    
    drawTransformerGrid() {
        const width = this.transformerCanvas.width;
        const height = this.transformerCanvas.height;
        
        this.transformerCtx.strokeStyle = '#333';
        this.transformerCtx.lineWidth = 1;
        
        // Horizontal grid lines
        for (let i = 0; i <= 10; i++) {
            const y = (height / 10) * i;
            this.transformerCtx.beginPath();
            this.transformerCtx.moveTo(0, y);
            this.transformerCtx.lineTo(width, y);
            this.transformerCtx.stroke();
        }
        
        // Vertical grid lines
        for (let i = 0; i <= 10; i++) {
            const x = (width / 10) * i;
            this.transformerCtx.beginPath();
            this.transformerCtx.moveTo(x, 0);
            this.transformerCtx.lineTo(x, height);
            this.transformerCtx.stroke();
        }
    }
    
    drawSingleTransformer(x, y, label) {
        const scale = this.transformerCanvas.width / 300;
        
        // Determine which transformer this is based on x position to get correct phase color
        const xPositions = [70 * scale, 150 * scale, 230 * scale];
        const phaseColors = ['#cccccc', '#ff4444', '#4444ff']; // Gray, Red, Blue
        let transformerIndex = 0;
        
        // Find which transformer this is
        for (let i = 0; i < xPositions.length; i++) {
            if (Math.abs(x - xPositions[i]) < 1) {
                transformerIndex = i;
                break;
            }
        }
        
        // Primary coil (top) - match phase color
        this.transformerCtx.strokeStyle = phaseColors[transformerIndex];
        this.transformerCtx.lineWidth = 3;
        this.transformerCtx.beginPath();
        this.transformerCtx.arc(x - 8 * scale, y - 20 * scale, 6 * scale, 0, 2 * Math.PI);
        this.transformerCtx.arc(x, y - 20 * scale, 6 * scale, 0, 2 * Math.PI);
        this.transformerCtx.arc(x + 8 * scale, y - 20 * scale, 6 * scale, 0, 2 * Math.PI);
        this.transformerCtx.stroke();
        
        // Secondary coil (bottom) - white
        this.transformerCtx.strokeStyle = '#ffffff';
        this.transformerCtx.lineWidth = 3;
        this.transformerCtx.beginPath();
        this.transformerCtx.arc(x - 8 * scale, y + 20 * scale, 6 * scale, 0, 2 * Math.PI);
        this.transformerCtx.arc(x, y + 20 * scale, 6 * scale, 0, 2 * Math.PI);
        this.transformerCtx.arc(x + 8 * scale, y + 20 * scale, 6 * scale, 0, 2 * Math.PI);
        this.transformerCtx.stroke();
        
        // Core (center line)
        this.transformerCtx.strokeStyle = '#888';
        this.transformerCtx.lineWidth = 4;
        this.transformerCtx.beginPath();
        this.transformerCtx.moveTo(x - 20 * scale, y);
        this.transformerCtx.lineTo(x + 20 * scale, y);
        this.transformerCtx.stroke();
        
        // Center tap indicator
        this.transformerCtx.fillStyle = '#2196F3';
        this.transformerCtx.beginPath();
        this.transformerCtx.arc(x, y + 20 * scale, 4 * scale, 0, 2 * Math.PI);
        this.transformerCtx.fill();
        
        // Label
        this.transformerCtx.fillStyle = '#fff';
        this.transformerCtx.font = `bold ${16 * scale}px Arial`;
        this.transformerCtx.textAlign = 'center';
        this.transformerCtx.fillText(label, x, y + 85 * scale); // Moved down 35 units total (from 50 to 85)
    }
    
    resetStatistics() {
        this.voltageStats = {
            peakHigh: this.amplitude,
            peakHighTime: this.time,
            peakLow: -this.amplitude,
            peakLowTime: this.time,
            maxRMS: this.amplitude / Math.sqrt(2),
            maxRMSTime: this.time,
            minRMS: this.amplitude / Math.sqrt(2),
            minRMSTime: this.time
        };
        this.transientHistory = [];
        
        // Reset previous measurements
        this.lastMeasuredRMS = this.amplitude / Math.sqrt(2);
        this.lastMeasuredL1 = 0;
        this.lastMeasuredL2 = 0;
    }
    
    updateVoltageStatistics() {
        // Calculate current instantaneous values
        const currentL1 = this.calculateWaveformValue(this.time, 0);
        const currentL2 = this.calculateWaveformValue(this.time, Math.PI);
        
        // Simple, stable RMS calculation based on actual amplitude
        // This tracks the effective RMS voltage including fault effects
        const baseRMS = this.amplitude / Math.sqrt(2);
        
        // For displaying in transient history, use a simple approach
        let currentRMS = baseRMS;
        
        // If we have active faults, adjust RMS based on fault type
        if (this.activeFaults.size > 0) {
            let faultAdjustment = 0;
            for (const [faultId, fault] of this.activeFaults) {
                switch (fault.type) {
                    case 'neutral-loss':
                        faultAdjustment += baseRMS * fault.intensity * 0.5; // RMS increases
                        break;
                    case 'phase-imbalance':
                        faultAdjustment -= baseRMS * fault.intensity * 0.2; // RMS decreases
                        break;
                    case 'motor-start-l1':
                    case 'motor-start-l2':
                    case 'motor-start-240v':
                    case 'ac-compressor':
                        faultAdjustment -= baseRMS * fault.intensity * 0.3; // Voltage sag
                        break;
                    case 'harmonic-distortion':
                        faultAdjustment += baseRMS * fault.intensity * 0.1; // Slight increase
                        break;
                    default:
                        // For other faults, minimal RMS impact
                        faultAdjustment += baseRMS * fault.intensity * 0.05;
                        break;
                }
            }
            currentRMS = Math.max(baseRMS + faultAdjustment, baseRMS * 0.3); // Don't go below 30%
        }
        
        // Track peak extremes with strict limits to prevent arc fault noise from dominating
        const maxReasonablePeak = this.amplitude * 1.5; // Limit to 1.5x nominal to avoid arc fault noise
        const minReasonablePeak = -this.amplitude * 1.5;
        
        // Only update peaks if we're not in an arc fault, or if the value is genuinely significant
        const hasArcFault = Array.from(this.activeFaults.values()).some(fault => 
            fault.type.includes('arc-fault'));
        
        if (!hasArcFault) {
            // Normal operation - track all peaks within reasonable limits
            if (currentL1 > this.voltageStats.peakHigh && currentL1 <= maxReasonablePeak) {
                this.voltageStats.peakHigh = currentL1;
                this.voltageStats.peakHighTime = this.time;
            }
            if (currentL1 < this.voltageStats.peakLow && currentL1 >= minReasonablePeak) {
                this.voltageStats.peakLow = currentL1;
                this.voltageStats.peakLowTime = this.time;
            }
            if (currentL2 > this.voltageStats.peakHigh && currentL2 <= maxReasonablePeak) {
                this.voltageStats.peakHigh = currentL2;
                this.voltageStats.peakHighTime = this.time;
            }
            if (currentL2 < this.voltageStats.peakLow && currentL2 >= minReasonablePeak) {
                this.voltageStats.peakLow = currentL2;
                this.voltageStats.peakLowTime = this.time;
            }
        } else {
            // During arc faults, only track truly extreme values that exceed arc noise
            const arcThreshold = this.amplitude * 1.8; // Must be significantly higher than normal
            if (currentL1 > arcThreshold && currentL1 > this.voltageStats.peakHigh) {
                this.voltageStats.peakHigh = currentL1;
                this.voltageStats.peakHighTime = this.time;
            }
            if (currentL1 < -arcThreshold && currentL1 < this.voltageStats.peakLow) {
                this.voltageStats.peakLow = currentL1;
                this.voltageStats.peakLowTime = this.time;
            }
            if (currentL2 > arcThreshold && currentL2 > this.voltageStats.peakHigh) {
                this.voltageStats.peakHigh = currentL2;
                this.voltageStats.peakHighTime = this.time;
            }
            if (currentL2 < -arcThreshold && currentL2 < this.voltageStats.peakLow) {
                this.voltageStats.peakLow = currentL2;
                this.voltageStats.peakLowTime = this.time;
            }
        }
        
        // Track RMS extremes with reasonable bounds
        const maxReasonableRMS = this.amplitude / Math.sqrt(2) * 1.5; // 150% of nominal
        const minReasonableRMS = this.amplitude / Math.sqrt(2) * 0.5; // 50% of nominal
        
        if (currentRMS > this.voltageStats.maxRMS && currentRMS <= maxReasonableRMS) {
            this.voltageStats.maxRMS = currentRMS;
            this.voltageStats.maxRMSTime = this.time;
        }
        if (currentRMS < this.voltageStats.minRMS && currentRMS >= minReasonableRMS) {
            this.voltageStats.minRMS = currentRMS;
            this.voltageStats.minRMSTime = this.time;
        }
        
        // Store current values for tracking (counters removed for simplicity)
        this.lastMeasuredRMS = currentRMS;
        this.lastMeasuredL1 = currentL1;
        this.lastMeasuredL2 = currentL2;
        
        // Update transient history data 
        if (performance.now() - this.lastTransientUpdate > this.transientUpdateInterval) {
            this.transientHistory.push({
                time: this.time,
                rms: currentRMS,  // Use the calculated stable RMS
                peakL1: Math.abs(currentL1), // Store peak magnitudes for display
                peakL2: Math.abs(currentL2),
                activeFaults: this.activeFaults.size, // Just count active faults
                timestamp: performance.now()
            });
            
            // Limit history size
            if (this.transientHistory.length > this.maxTransientHistory) {
                this.transientHistory.shift();
            }
            
            this.lastTransientUpdate = performance.now();
        }
        
        // Update display elements
        this.updateStatsDisplay();
    }
    
    updateStatsDisplay() {
        document.getElementById('peak-high').textContent = `+${Math.round(this.voltageStats.peakHigh)} V`;
        document.getElementById('peak-high-time').textContent = `${this.voltageStats.peakHighTime.toFixed(2)}s`;
        document.getElementById('peak-low').textContent = `${Math.round(this.voltageStats.peakLow)} V`;
        document.getElementById('peak-low-time').textContent = `${this.voltageStats.peakLowTime.toFixed(2)}s`;
        document.getElementById('max-rms').textContent = `${this.voltageStats.maxRMS.toFixed(1)} V`;
        document.getElementById('max-rms-time').textContent = `${this.voltageStats.maxRMSTime.toFixed(2)}s`;
        document.getElementById('min-rms').textContent = `${this.voltageStats.minRMS.toFixed(1)} V`;
        document.getElementById('min-rms-time').textContent = `${this.voltageStats.minRMSTime.toFixed(2)}s`;
    }
    
    drawTransientHistory() {
        const width = this.transientCanvas.width;
        const height = this.transientCanvas.height;
        
        // Clear canvas
        this.transientCtx.fillStyle = '#1a1a1a';
        this.transientCtx.fillRect(0, 0, width, height);
        
        if (this.transientHistory.length < 2) return;
        
        // Filter data based on current timebase
        const now = performance.now();
        const filteredData = this.transientHistory.filter(point => 
            now - point.timestamp <= this.historyTimebase
        );
        
        if (filteredData.length < 2) return;
        
        // Calculate scales
        const timeRange = this.historyTimebase / 1000; // Convert to seconds
        const voltageMin = 80;  // Minimum voltage to display
        const voltageMax = 180; // Maximum voltage to display
        const voltageRange = voltageMax - voltageMin;
        
        // Draw grid
        this.drawTransientGrid(width, height, voltageMin, voltageMax, timeRange);
        
        // Draw RMS voltage line
        this.transientCtx.strokeStyle = '#4CAF50';
        this.transientCtx.lineWidth = 2;
        this.transientCtx.beginPath();
        
        for (let i = 0; i < filteredData.length; i++) {
            const point = filteredData[i];
            const x = (i / (filteredData.length - 1)) * width;
            const y = height - ((point.rms - voltageMin) / voltageRange) * height;
            
            if (i === 0) {
                this.transientCtx.moveTo(x, y);
            } else {
                this.transientCtx.lineTo(x, y);
            }
        }
        this.transientCtx.stroke();
        
        // Peak values removed for clarity
        
        // Highlight transient events
        this.highlightTransientEvents(filteredData, width, height, voltageMin, voltageRange);
    }
    
    drawTransientGrid(width, height, voltageMin, voltageMax, timeRange) {
        this.transientCtx.strokeStyle = '#333';
        this.transientCtx.lineWidth = 1;
        
        // Horizontal voltage lines
        const voltageSteps = 5;
        for (let i = 0; i <= voltageSteps; i++) {
            const voltage = voltageMin + (voltageMax - voltageMin) * (i / voltageSteps);
            const y = height - (i / voltageSteps) * height;
            
            this.transientCtx.beginPath();
            this.transientCtx.moveTo(0, y);
            this.transientCtx.lineTo(width, y);
            this.transientCtx.stroke();
            
            // Voltage labels
            this.transientCtx.fillStyle = '#666';
            this.transientCtx.font = '10px Arial';
            this.transientCtx.textAlign = 'left';
            this.transientCtx.fillText(`${Math.round(voltage)}V`, 2, y - 2);
        }
        
        // Vertical time lines - simplified and fixed
        const timeSteps = 5; // Always use 5 divisions for clean appearance
        
        for (let i = 0; i <= timeSteps; i++) {
            const x = (i / timeSteps) * width;
            
            this.transientCtx.beginPath();
            this.transientCtx.moveTo(x, 0);
            this.transientCtx.lineTo(x, height);
            this.transientCtx.stroke();
            
            // Time labels based on the selected timebase
            const timeValue = (timeRange * i / timeSteps);
            let timeLabel;
            
            if (timeRange < 1) {
                // Show in milliseconds for sub-second ranges
                timeLabel = `${Math.round(timeValue * 1000)}ms`;
            } else {
                // Show in seconds for 1s and above
                if (timeValue === 0) {
                    timeLabel = '0s';
                } else if (timeValue >= 1) {
                    timeLabel = `${Math.round(timeValue)}s`;
                } else {
                    timeLabel = `${timeValue.toFixed(1)}s`;
                }
            }
            
            this.transientCtx.fillStyle = '#666';
            this.transientCtx.font = '10px Arial';
            this.transientCtx.textAlign = 'center';
            this.transientCtx.fillText(timeLabel, x, height - 2);
        }
    }
    
    highlightTransientEvents(data, width, height, voltageMin, voltageRange) {
        const nominalRMS = 120.2;
        const sagThreshold = nominalRMS * 0.9;
        const swellThreshold = nominalRMS * 1.1;
        
        for (let i = 0; i < data.length; i++) {
            const point = data[i];
            const x = (i / (data.length - 1)) * width;
            
            // Highlight voltage sags (orange)
            if (point.rms < sagThreshold) {
                this.transientCtx.fillStyle = '#ffaa00';
                this.transientCtx.globalAlpha = 0.3;
                this.transientCtx.fillRect(x - 1, 0, 2, height);
            }
            
            // Highlight voltage swells (red)
            if (point.rms > swellThreshold) {
                this.transientCtx.fillStyle = '#ff4444';
                this.transientCtx.globalAlpha = 0.3;
                this.transientCtx.fillRect(x - 1, 0, 2, height);
            }
        }
        
        this.transientCtx.globalAlpha = 1.0;
    }
}

// Initialize simulator when page loads
document.addEventListener('DOMContentLoaded', () => {
    new ACWaveformSimulator();
});