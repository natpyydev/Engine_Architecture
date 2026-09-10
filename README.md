# 3D V8 Engine Lab

**3D V8 Engine Lab** is an English-first, highly interactive educational web laboratory built with React, TypeScript, Three.js, and procedural 3D geometry. It provides an engineering-grade, real-time visual simulation of a four-stroke 90-degree crossplane V8 internal combustion engine, explaining how chemical fuel energy is converted into mechanical torque through slider-crank kinematics and Otto-cycle thermodynamics.

---

## Key Features

### 1. Fully Procedural 3D Crossplane V8 Assembly
- **Zero external 3D asset dependencies**: All components are synthesized procedurally via Three.js geometry buffers and realistic metallic PBR materials.
- **Components Included**:
  - 90° Vee cylinder block with bored cylinder sleeves and oil pan
  - Forged crossplane crankshaft with 90° crankpins (0°, 90°, 270°, 180°) and dynamic counterweights
  - Flywheel with starter ring gear and front harmonic balancer pulley
  - 8 Pistons with wrist pins and compression/oil ring grooves
  - 8 H-beam connecting rods with split rod caps and ARP bolts
  - Double Overhead Camshafts (DOHC) with pear-shaped lobes rotating at half crankshaft speed ($\omega_{cam} = \omega / 2$)
  - 16 Poppet valves with helical compression springs and retainers
  - High-rise intake manifold with central plenum and rotating throttle butterfly blade
  - Tuned 4-into-1 equal-pulse stainless steel exhaust headers
  - Spark plugs with high-voltage ignition spark animation

### 2. Exact Slider-Crank Kinematics & Valve Dynamics
- **Piston Displacement**:
  $$s(\theta) = r(1 - \cos\theta) + l\left(1 - \sqrt{1 - \lambda^2 \sin^2\theta}\right)$$
  where $r = 43\text{ mm}$, $l = 150\text{ mm}$, $\lambda = r/l \approx 0.2867$.
- **Connecting Rod Angular Tilt**: $\beta(\theta) = \arcsin(\lambda \sin\theta)$.
- **Standard Firing Order**: **1-8-4-3-6-5-7-2** firing every 90° across the 720° four-stroke cycle:
  - Bank 1 (Left, +45°): Cylinders 1, 3, 5, 7
  - Bank 2 (Right, -45°): Cylinders 2, 4, 6, 8
  - Asymmetric bank pulse pattern (L-R-R-L-R-L-L-R) producing the iconic American muscle car low-frequency rumble.

### 3. Fluid & Combustion Shaders
- **Intake**: Swirling cyan vapor streaming through the throttle blade and open intake valve.
- **Compression**: Transition from cool cyan to dense, shimmering amber charge.
- **Power (Combustion)**: Electric violet-blue spark flash triggering an expanding incandescent flame front (up to 2,500 K / 95 bar).
- **Exhaust**: Smoky dark-crimson/orange exhaust gas pulse rushing into headers.
- **Kinetic Energy Vectors**: Real-time force arrows showing combustion gas pressure $\to$ piston crown $\to$ connecting rod $\to$ crankpin moment $\to$ flywheel momentum.

### 4. Synchronized Thermodynamic Diagrams ($P\text{–}v$ and $T\text{–}s$)
- Real-time 60fps Canvas renderers tracing the active cylinder state point $(v(\theta), P(\theta))$ and $(s(\theta), T(\theta))$.
- Formulated with KaTeX:
  - Ideal thermal efficiency: $\eta_{th} = 1 - \frac{1}{r_c^{\gamma - 1}} \approx 56.2\%$
  - Net work: $W_{net} = \oint P \, dv = Q_{in} - Q_{out}$
  - Instantaneous torque: $\tau(\theta) = F_{gas}(\theta) \cdot r \cdot \left(\sin\theta + \frac{\lambda \sin 2\theta}{2\sqrt{1-\lambda^2\sin^2\theta}}\right)$
  - Brake Horsepower: $\text{BHP} = \frac{\tau \times \text{RPM}}{5252}$

### 5. Procedural Web Audio API Sound Synthesizer
- Synthesizes realistic 4-pulse-per-rev crossplane exhaust tone with sub-harmonic bank pulses, throttle lowpass filter sweep, mechanical valve clicking, and starter motor cranking sound.

### 6. Guided Lessons & Diagnostic Fault Challenges
- **6 Educational Chapters**: V8 Architecture, Otto Cycle, Crossplane vs. Flatplane, Valvetrain & Gas Exchange, Combustion Physics, and Kinetic Energy Transfer.
- **5 Diagnostic Fault Scenarios**: Cylinder #3 Misfire, High-RPM Valve Float, Pre-Ignition Knock, Lean Fuel Mixture, and Blown Head Gasket.
- **Interactive Quiz Challenge Mode**: Blind fault injection where users diagnose root causes from telemetry and execute mechanical repairs.

---

## Getting Started

### Development Server
```bash
npm install
npm run dev
```

### Production Build & Preview
```bash
npm run build
npm run preview
```
Open [http://localhost:4173/](http://localhost:4173/) in any modern web browser.
