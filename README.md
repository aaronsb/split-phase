# AC Waveform & Inverter Simulator

An interactive educational tool for understanding AC electrical systems, split-phase power, and electrical faults. Designed for RV builders, off-grid enthusiasts, and anyone learning electrical systems.

## Features

### Split-Phase Visualization
- Real-time 60 FPS oscilloscope-style waveform display
- Shows L1 and L2 hot legs (180° out of phase) with proper electrical color coding
- Demonstrates 120V and 240V load connections
- North American electrical standards (120V RMS, 60 Hz)

### 3-Phase Grid Source Visualization
- Interactive phasor diagram showing 3-phase power generation (Phases A, B, C)
- Visualizes how power plants generate electricity with 120° phase separation
- Shows 7200V distribution voltage feeding neighborhood transformers
- Optional phase angle display for educational purposes

### Distribution Transformer Diagram
- Visual representation of grid-to-residential power conversion
- Shows how single-phase transformers convert 7200V grid power to 240V/120V split-phase
- Demonstrates center-tapped secondary winding configuration
- Illustrates power flow from transmission lines to customer service

### Advanced Speed Control
- Logarithmic speed scaling from 0.001x to 1.0x for educational purposes
- Ultra-slow motion (0.001x) for detailed fault analysis
- Speed-adaptive high-resolution sampling maintains accuracy at all speeds
- Quick-access buttons for common speeds (0.001x, 0.1x, 1x)

### Oscilloscope-Style Controls
- **No Trigger**: Free-running waveform sweep
- **Auto Trigger**: Edge-locked stable display with voltage-based triggering
- **Manual Trigger**: Voltage-controlled phase positioning (±100V range)
- Performance-optimized rendering for browser-based simulation

### Fault Simulation
- **120V Load Faults**: Motor startups, arc faults, resistive switching
- **240V Load Faults**: Heavy motor startups, A/C compressor starts, load imbalances
- **System Faults**: Neutral loss, phase imbalance, ground faults, harmonic distortion
- **Inverter Faults**: MOSFET failures, transformer saturation, DC injection, feedback oscillation
- High-resolution fault modeling with speed-adaptive sampling
- Multiple simultaneous faults supported with intensity control

### Educational Tooltip System
- Two-level tooltip system: Simple explanations and detailed technical information
- Context-sensitive help for all controls and visualizations
- Practical information for RV, off-grid, and residential installations
- Complete power delivery chain explanations from generation to consumption

### Real-Time Parameter Monitoring
- Peak-to-peak voltage measurements
- RMS voltage calculations with accuracy indicators
- Zero crossing detection and grounding status
- Simulation time tracking with speed multiplier display
- Safety alerts and voltage standard compliance indicators

## Usage

1. **Getting Started**: Open `index.html` in a web browser or visit the live demo
2. **Enable Detailed Help**: Check "Show Detailed Tooltips" for educational explanations
3. **Explore the System**: 
   - Main visualization shows split-phase electrical output (L1/L2/Neutral)
   - 3-Phase Grid Source shows power generation and transmission
   - Distribution Transformers show grid-to-residential conversion
4. **Study Electrical Faults**: Select fault types and adjust intensity to see real-world failure modes
5. **Use Oscilloscope Controls**: 
   - Adjust simulation speed (logarithmic scale optimized for education)
   - Set trigger modes for stable waveform analysis
   - Manual trigger for precise phase examination
6. **Monitor Parameters**: Real-time voltage, RMS, and safety measurements

## Educational Value

This simulator provides hands-on understanding of:
- **Complete Power Delivery Chain**: From 3-phase generation through distribution transformers to split-phase residential service
- **Electrical System Safety**: Proper grounding, neutral bonding, and shock hazard prevention
- **Fault Analysis**: How different failures affect equipment and why they occur
- **Power Quality**: Voltage sags, harmonics, and their effects on sensitive electronics
- **RV/Off-Grid Systems**: Shore power vs inverter power differences and compatibility issues
- **Electrical Standards**: North American vs international electrical systems
- **Component Behavior**: Why motors, transformers, and electronics fail under specific conditions

## Technical Implementation

- **High-Performance Simulation**: Real-time 60 FPS simulation with speed-adaptive rendering
- **Accurate Modeling**: Based on actual electrical engineering principles and fault behavior
- **Educational Optimization**: Logarithmic speed control dedicates 95% of range to slow speeds for education
- **Browser-Based**: No installation required, works on desktop and mobile devices
- **Oscilloscope Accuracy**: Voltage-based triggering and manual trigger controls like real instruments

## File Structure

- `index.html` - Main application interface with 3 visualization panels and control system
- `simulator.js` - Core simulation engine with waveform, phasor, and transformer rendering
- `_config.yml` - Jekyll configuration for GitHub Pages deployment
- `.github/workflows/jekyll-gh-pages.yml` - Automated deployment workflow
- `README.md` - Project documentation

## Live Demo

🚀 **[Try the live simulator here!](https://aaronsb.github.io/split-phase/)**

## License

Open source educational tool for learning electrical systems.