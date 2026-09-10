# 3D Engine Lab

**3D Engine Lab** is an engineering-grade, highly interactive educational web simulator built with **React**, **TypeScript**, **Three.js**, and **procedural 3D geometry**. It provides real-time, physics-based simulations of iconic internal combustion engine architectures, illustrating how chemical energy is transformed into mechanical torque through slider-crank kinematics, gas exchange, and Otto-cycle thermodynamics.

🔗 **Live Demo**: [https://shuen-05.github.io/Engine_Architecture/](https://shuen-05.github.io/Engine_Architecture/)

---

## Supported Engine Architectures

| Architecture | Engine Code | Vehicle Model | Displacement & Aspiration | Power / Torque | Firing Order | Transmission |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **90° Crossplane V8** | `2UR-GSE` | Lexus LC 500 (URZ100) | 5.0L (4,969 cc) Naturally Aspirated | 471 HP / 540 Nm | `1-5-6-3-4-2-7-8` | DirectShift 10-Speed AT |
| **Straight-6 (Inline-6)** | `S58B30T0` | BMW M3 Competition (G80) | 3.0L (2,993 cc) Twin-Turbo | 503 HP / 650 Nm | `1-5-3-6-2-4` | M Steptronic 8-Speed |
| **180° Flat-4 (Boxer-4)** | `EJ257` | Subaru WRX STI (VAB) | 2.5L (2,457 cc) Single Twin-Scroll Turbo | 310 HP / 393 Nm | `1-3-2-4` | TY85 6-Speed Manual |

---

## Key Features

### 1. Multi-Engine Procedural 3D Assemblies
* **Zero External 3D Asset Dependencies**: All crankshafts, connecting rods, pistons, camshafts, poppet valves, manifolds, and cylinder blocks are synthesized procedurally at runtime via Three.js geometry buffers and realistic metallic PBR materials.
* **Architecture-Specific Mechanical Geometry**:
  * **90° Crossplane V8**: 90° Vee block with staggered cylinder sleeves, 4-throw 90° crossplane crankshaft, dynamic counterweights, dual overhead camshafts, 32 valves, high-rise intake plenum, and 4-into-1 tuned exhaust headers.
  * **Inline-6**: 6-cylinder inline block, 120° forged crankshaft with 7 main bearing journals (inherent primary and secondary harmonic balance), twin monoscroll turbochargers with wastegates, and integrated liquid charge-air cooler.
  * **180° Boxer-4**: Horizontally-opposed flat-4 layout with opposing pistons canceling primary forces, dual cylinder heads, top-mount intercooler, and unequal length (UEL) exhaust runners.
* **Viewport Modes**:
  * **Cutaway View**: Longitudinal and cross-sectional slicing revealing internal combustion chambers and valvetrain.
  * **X-Ray / Translucent View**: Ghosted engine block with visible moving internal assemblies.
  * **Interactive Exploded View**: Smooth slider expanding all components outwards along their spatial axes.
  * **Wireframe Mode**: Full structural polygon mesh visualization.

---

### 2. Exact Slider-Crank Kinematics & Valvetrain Timing
* **Piston Displacement Equation**:
  $$s(\theta) = r(1 - \cos\theta) + l\left(1 - \sqrt{1 - \lambda^2 \sin^2\theta}\right)$$
  where $r$ is the crank radius (stroke / 2), $l$ is the connecting rod length, and $\lambda = r/l$ is the rod-to-stroke ratio.
* **Connecting Rod Angular Tilt**:
  $$\beta(\theta) = \arcsin(\lambda \sin\theta)$$
* **Piston Velocity & Acceleration**:
  $$v(\theta) = \omega r \left(\sin\theta + \frac{\lambda \sin 2\theta}{2\sqrt{1 - \lambda^2\sin^2\theta}}\right)$$
* **Valvetrain Synchronicity**:
  * Camshafts rotate at exact half-crankshaft speed ($\omega_{cam} = \frac{1}{2}\omega_{crank}$).
  * True eccentric cam lobes driving spring-loaded poppet intake and exhaust valves with realistic lift and overlap profiles.

---

### 3. Four-Stroke Fluid Dynamics & Combustion Shaders
* **Intake Stroke ($0^\circ - 180^\circ$)**: Swirling cyan air-fuel vapor streams into the cylinder through open intake valves.
* **Compression Stroke ($180^\circ - 360^\circ$)**: Chamber volume decreases as charge temperature and pressure rise, transitioning to glowing compressed amber.
* **Power / Combustion Stroke ($360^\circ - 540^\circ$)**: Timed high-voltage electric ignition spark initiates an expanding spherical turbulent flame front (up to 2,500 K and 95 bar peak pressure).
* **Exhaust Stroke ($540^\circ - 720^\circ$)**: Burnt gases pulse out into the exhaust headers in an incandescent crimson flame plume.
* **Dynamic Kinetic Force Vectors**: Real-time 3D force arrows visually trace instantaneous torque transmission:
  $$\text{Combustion Gas Pressure} \longrightarrow \text{Piston Crown} \longrightarrow \text{Connecting Rod} \longrightarrow \text{Crankpin Moment} \longrightarrow \text{Flywheel}$$

---

### 4. Live Thermodynamic Diagrams ($P\text{–}v$ & $T\text{–}s$)
* Synchronized 60 FPS Canvas renderers tracing the real-time state points $(v(\theta), P(\theta))$ and $(s(\theta), T(\theta))$ for any selected cylinder.
* Real-time thermodynamic computations rendered with **KaTeX**:
  * **Ideal Thermal Efficiency**: $\eta_{th} = 1 - \frac{1}{r_c^{\gamma - 1}}$
  * **Net Work per Cycle**: $W_{net} = \oint P \, dv = Q_{in} - Q_{out}$
  * **Instantaneous Torque**: $\tau(\theta) = F_{gas}(\theta) \cdot r \cdot \left(\sin\theta + \frac{\lambda \sin 2\theta}{2\sqrt{1-\lambda^2\sin^2\theta}}\right)$
  * **Brake Horsepower**: $\text{BHP} = \frac{\tau \times \text{RPM}}{5252}$

---

### 5. Interactive Driving Cockpit & Powertrain Simulation
* **Realistic Controls**: Starter ignition switch, throttle pedal with smooth return spring, hydraulic brake pedal, and interactive gear selector.
* **Multi-Speed Transmissions**:
  * Lexus LC 500: DirectShift 10-speed automatic with torque converter lockup.
  * BMW M3: ZF 8-speed M Steptronic with launch control characteristics.
  * Subaru WRX STI: 6-speed close-ratio manual gearbox.
* **Instrument Cluster**: High-resolution analog tachometer gauge, digital speed HUD (km/h & mph), road load resistive friction, and drive mode selector (Comfort, Sport, Track).

---

### 6. Procedural Web Audio Engine Synthesizer
* Built natively with the **Web Audio API** (no pre-recorded sound loops):
  * **Crossplane V8 Profile**: Asymmetric bank pulse pattern (`L-R-R-L-R-L-L-R`) delivering the signature deep, burbling American/Japanese V8 rumble.
  * **Inline-6 Profile**: Perfectly spaced 120° pulses producing a creamy, mechanical high-frequency scream.
  * **Boxer-4 Profile**: Unequal length exhaust manifold pulse delay generating the distinct Subaru off-beat boxer thrum.
  * **Dynamic Effects**: Starter motor cranking, cold-start rev flare, high-RPM throttle filter sweeps, and mechanical valve ticking.

---

### 7. Educational Modules & Diagnostic Lab
* **6 Interactive Lessons**:
  1. Engine Architectures (V8 vs. I-6 vs. Boxer-4 layout trade-offs)
  2. Four-Stroke Otto Cycle Principles
  3. Crankshaft Physics & Balance (Primary & Secondary harmonic forces)
  4. Valvetrain & Gas Exchange Dynamics
  5. Combustion Physics & Flame Propagation
  6. Kinetic Energy & Powertrain Mechanics
* **5 Real-Time Fault Diagnostics**:
  * Cylinder Misfire (ignition/fuel delivery failure)
  * High-RPM Valve Float (spring resonance limit)
  * Pre-Ignition Knock / Detonation
  * Lean Air-Fuel Mixture (high EGT thermal overload)
  * Blown Cylinder Head Gasket (combustion gas crossover)
* **Interactive Quiz & Challenge Mode**: Blind diagnostic fault injection where users interpret telemetry graphs, pinpoint mechanical failures, and perform repairs.

---

## Tech Stack

* **Frontend Framework**: React 18 with TypeScript
* **3D Graphics Engine**: Three.js (Procedural geometries, PBR materials, custom particle shaders)
* **Styling**: Tailwind CSS & Lucide Icons
* **Math & Formulas**: KaTeX LaTeX typesetting
* **Audio**: Native Web Audio API procedural synthesis (oscillators, biquad filters, waveshapers)
* **Build System**: Vite 5
* **CI/CD**: GitHub Actions deploying to GitHub Pages

---

## Getting Started

### Prerequisites
* Node.js 18+ (Node 22 recommended)
* npm, pnpm, or yarn

### Installation
```bash
# Clone the repository
git clone https://github.com/shuen-05/Engine_Architecture.git
cd Engine_Architecture

# Install dependencies
npm install

# Start the local development server
npm run dev
```

### Production Build
```bash
# Build production bundle
npm run build

# Preview production build locally
npm run preview
```

---

## License

This project is licensed under the MIT License.

