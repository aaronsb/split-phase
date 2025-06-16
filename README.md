# AC Waveform & Inverter Simulator

An interactive educational tool for understanding AC electrical systems, split-phase power, and electrical faults. Designed for RV builders, off-grid enthusiasts, and anyone learning electrical systems.

## Features

### Split-Phase Visualization
- Real-time visualization of North American split-phase electrical systems
- Shows L1 and L2 hot legs (180° out of phase)
- Demonstrates 120V and 240V load connections

### Oscilloscope-Style Controls
- **No Trigger**: Free-running waveform sweep
- **Auto Trigger**: Edge-locked stable display
- **Manual Trigger**: User-controlled phase positioning
- Variable time base (0.01x to 5x speed)

### Comprehensive Fault Simulation
- **120V Load Faults**: Motor startups, arc faults, resistive switching
- **240V Load Faults**: Heavy motor startups, A/C compressors, load imbalances
- **System Faults**: Neutral loss, phase imbalance, ground faults
- **Inverter Faults**: MOSFET failures, transformer saturation, DC injection
- Multiple simultaneous faults supported

### Educational Tooltips
- Simple mode: Basic explanations
- Detailed mode: Technical details with specific failure modes
- Practical information for RV and off-grid installations

### Real-Time Parameters
- Peak-to-peak voltage
- RMS voltage calculations
- Zero crossing monitoring
- Safety alerts and warnings

## Usage

1. Open `index.html` in a web browser
2. Enable "Show Detailed Tooltips" for educational explanations
3. Toggle split-phase mode to see L1/L2 visualization
4. Experiment with different fault conditions
5. Use trigger controls to study waveform details

## Educational Value

Perfect for understanding:
- Shore power vs inverter power differences
- Why proper grounding is critical
- How electrical faults affect different device types
- Power quality issues in mobile/remote installations
- Component sizing and voltage tolerance requirements

## Technical Details

- Real-time 60 FPS simulation
- Accurate North American electrical standards (120V RMS, 60 Hz)
- Realistic fault modeling based on actual electrical behavior
- Oscilloscope-accurate trigger and display functions

## File Structure

- `index.html` - Main application interface
- `simulator.js` - Core simulation engine and fault modeling
- `README.md` - This documentation

## Live Demo

🚀 **[Try the live simulator here!](https://aaronsb.github.io/split-phase/)**

## License

Open source educational tool for learning electrical systems.