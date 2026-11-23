import React, { useEffect, useRef, useState, useCallback } from 'react';
import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { createEngineMaterials, EngineMaterialPalette } from './materials';
import { V8Assembly } from './V8Assembly';
import { I6Assembly } from './I6Assembly';
import { Boxer4Assembly } from './Boxer4Assembly';
import { FlowVisualizer } from './FlowVisualizer';
import { CylinderTelemetry, ViewMode, SeeThroughMode, EngineId } from '../engine/types';
import { ENGINE_COMPONENTS } from '../engine/componentSpecs';
import { EngineParams, DEFAULT_ENGINE_PARAMS } from '../engine/engineParams';
import { Sparkles, Camera } from 'lucide-react';

interface EngineCanvasProps {
  engineId?: EngineId;
  telemetryList: CylinderTelemetry[];
  throttlePercent: number;
  crankAngle: number;
  viewMode: ViewMode;
  seeThroughMode: SeeThroughMode;
  explodedProgress: number;
  selectedComponentId: string | null;
  selectedCylinderId: number;
  cameraPreset: string;
  engineParams?: EngineParams;
  onSelectComponent: (componentId: string | null) => void;
  onSelectCylinder: (cylinderId: number) => void;
}

export const EngineCanvas: React.FC<EngineCanvasProps> = ({
  engineId = 'v8_lexus',
  telemetryList,
  throttlePercent,
  crankAngle,
  viewMode,
  seeThroughMode,
  explodedProgress,
  selectedComponentId,
  selectedCylinderId,
  cameraPreset,
  engineParams = DEFAULT_ENGINE_PARAMS,
  onSelectComponent: _onSelectComponent,
  onSelectCylinder: _onSelectCylinder,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<THREE.Scene | null>(null);
  const cameraRef = useRef<THREE.PerspectiveCamera | null>(null);
  const rendererRef = useRef<THREE.WebGLRenderer | null>(null);
  const controlsRef = useRef<OrbitControls | null>(null);
  const assemblyRef = useRef<V8Assembly | I6Assembly | Boxer4Assembly | null>(null);
  const visualizerRef = useRef<FlowVisualizer | null>(null);
  const materialsRef = useRef<EngineMaterialPalette | null>(null);
  const raycasterRef = useRef<THREE.Raycaster>(new THREE.Raycaster());
  const mouseRef = useRef<THREE.Vector2>(new THREE.Vector2());

  // Interactive Hover Tooltip State
  const [hoveredComponent, setHoveredComponent] = useState<{
    id: string;
    name: string;
    category: string;
    material: string;
    tempK?: number;
  } | null>(null);

  const latestProps = useRef({
    telemetryList,
    throttlePercent,
    crankAngle,
    viewMode,
    seeThroughMode,
    explodedProgress,
    selectedComponentId,
    selectedCylinderId,
    engineParams,
  });
  latestProps.current = {
    telemetryList,
    throttlePercent,
    crankAngle,
    viewMode,
    seeThroughMode,
    explodedProgress,
    selectedComponentId,
    selectedCylinderId,
    engineParams,
  };
  // Tracks which params object was last pushed into which assembly (re-applied after an assembly swap)
  const appliedParamsRef = useRef<{ asm: unknown; params: EngineParams } | null>(null);

  // Camera preset handler
  useEffect(() => {
    if (!cameraRef.current || !controlsRef.current) return;
    const cam = cameraRef.current;
    const ctrl = controlsRef.current;

    switch (cameraPreset) {
      case 'isometric':
        cam.position.set(13, 10, 16);
        ctrl.target.set(0, 3, 0);
        break;
      case 'front':
        cam.position.set(0, 4, 20);
        ctrl.target.set(0, 3, 0);
        break;
      case 'side_bank1':
        cam.position.set(-18, 6, 0);
        ctrl.target.set(0, 3, 0);
        break;
      case 'side_bank2':
        cam.position.set(18, 6, 0);
        ctrl.target.set(0, 3, 0);
        break;
      case 'top':
        cam.position.set(0, 22, 1);
        ctrl.target.set(0, 2, 0);
        break;
      case 'crankshaft':
        cam.position.set(0, -3, 14);
        ctrl.target.set(0, 0, 0);
        break;
      case 'cyl1':
        cam.position.set(-7, 7, 7);
        ctrl.target.set(-2, 4, 5);
        break;
    }
    ctrl.update();
  }, [cameraPreset]);

  // High-Resolution Screenshot Capture
  const handleCaptureScreenshot = useCallback(() => {
    if (!rendererRef.current || !sceneRef.current || !cameraRef.current) return;
    rendererRef.current.render(sceneRef.current, cameraRef.current);
    const dataUrl = rendererRef.current.domElement.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `3D_V8_Engine_Lab_${Date.now()}.png`;
    link.href = dataUrl;
    link.click();
  }, []);

  // Setup Three.js Scene, Camera, Renderer, IBL Environment, and Controls
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Scene
    const scene = new THREE.Scene();
    sceneRef.current = scene;
    scene.background = new THREE.Color(0x06080d);
    scene.fog = new THREE.FogExp2(0x06080d, 0.016);

    // Camera
    const camera = new THREE.PerspectiveCamera(
      45,
      container.clientWidth / container.clientHeight,
      0.1,
      100
    );
    camera.position.set(13, 10, 16);
    cameraRef.current = camera;

    // Renderer with Soft Shadows and High Dynamic Range Exposure
    const renderer = new THREE.WebGLRenderer({
      antialias: true,
      alpha: true,
      powerPreference: 'high-performance',
      preserveDrawingBuffer: true,
    });
    const initW = Math.max(10, container.clientWidth || window.innerWidth);
    const initH = Math.max(10, container.clientHeight || window.innerHeight);
    renderer.setSize(initW, initH, false);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.className = 'w-full h-full block';
    renderer.domElement.style.width = '100%';
    renderer.domElement.style.height = '100%';
    renderer.domElement.style.display = 'block';
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;
    container.appendChild(renderer.domElement);
    rendererRef.current = renderer;

    // HDR Environment Reflections via PMREMGenerator & RoomEnvironment
    const pmremGenerator = new THREE.PMREMGenerator(renderer);
    pmremGenerator.compileEquirectangularShader();
    const roomEnv = new RoomEnvironment();
    scene.environment = pmremGenerator.fromScene(roomEnv, 0.04).texture;

    // OrbitControls
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.06;
    controls.minDistance = 3.5;
    controls.maxDistance = 45;
    controls.target.set(0, 3, 0);
    controls.maxPolarAngle = Math.PI * 0.95;
    controlsRef.current = controls;

    // Studio Lighting
    const ambientLight = new THREE.AmbientLight(0xffffff, 0.5);
    scene.add(ambientLight);

    // Warm Key Light (Casts soft shadows)
    const keyLight = new THREE.DirectionalLight(0xfffaed, 2.0);
    keyLight.position.set(14, 22, 14);
    keyLight.castShadow = true;
    keyLight.shadow.mapSize.width = 2048;
    keyLight.shadow.mapSize.height = 2048;
    keyLight.shadow.camera.near = 0.5;
    keyLight.shadow.camera.far = 50;
    keyLight.shadow.camera.left = -15;
    keyLight.shadow.camera.right = 15;
    keyLight.shadow.camera.top = 15;
    keyLight.shadow.camera.bottom = -15;
    keyLight.shadow.bias = -0.0005;
    scene.add(keyLight);

    // Cool Fill Light
    const fillLight = new THREE.DirectionalLight(0x93c5fd, 1.3);
    fillLight.position.set(-16, 14, -12);
    scene.add(fillLight);

    // Cyan Rim Back-Light
    const rimLight = new THREE.DirectionalLight(0x0ea5e9, 1.5);
    rimLight.position.set(0, -12, -18);
    scene.add(rimLight);

    // Reflective Metallic Ground Grid & Shadow Receiver
    const floorGeo = new THREE.PlaneGeometry(60, 60);
    const floorMat = new THREE.ShadowMaterial({ opacity: 0.35 });
    const floor = new THREE.Mesh(floorGeo, floorMat);
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -4.5;
    floor.receiveShadow = true;
    scene.add(floor);

    const grid = new THREE.GridHelper(36, 36, 0x334155, 0x0f172a);
    grid.position.y = -4.49;
    scene.add(grid);

    // Initialize Procedural Materials, Active Engine Assembly, and Flow Visualizer
    const materials = createEngineMaterials();
    materialsRef.current = materials;

    let initialAssembly: V8Assembly | I6Assembly | Boxer4Assembly;
    if (engineId === 'i6_bmw') {
      initialAssembly = new I6Assembly(materials);
    } else if (engineId === 'boxer4_subaru') {
      initialAssembly = new Boxer4Assembly(materials);
    } else {
      initialAssembly = new V8Assembly(materials);
    }
    assemblyRef.current = initialAssembly;
    scene.add(initialAssembly.root);

    const visualizer = new FlowVisualizer(engineId);
    visualizerRef.current = visualizer;
    scene.add(visualizer.root);

    // Responsive Resize Handler with ResizeObserver (Buffered into RAF to prevent canvas blanking)
    let lastW = initW;
    let lastH = initH;
    let pendingResize = false;
    let targetW = initW;
    let targetH = initH;

    const handleResize = () => {
      if (!container) return;
      const w = container.clientWidth;
      const h = container.clientHeight;
      // Guard against zero/collapsed states (e.g. during layout reflows or tab switching)
      if (w < 10 || h < 10) return;
      // Avoid micro-jitter triggers (sub-pixel oscillation)
      if (Math.abs(w - lastW) < 2 && Math.abs(h - lastH) < 2) return;
      targetW = w;
      targetH = h;
      pendingResize = true;
    };
    window.addEventListener('resize', handleResize);
    const resizeObserver = new ResizeObserver(handleResize);
    resizeObserver.observe(container);

    // WebGL Context Lost / Restored Protection
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      console.warn('WebGL context lost, awaiting restoration...');
    };
    const handleContextRestored = () => {
      console.info('WebGL context restored');
      if (container) {
        targetW = container.clientWidth;
        targetH = container.clientHeight;
        pendingResize = true;
      }
    };
    renderer.domElement.addEventListener('webglcontextlost', handleContextLost);
    renderer.domElement.addEventListener('webglcontextrestored', handleContextRestored);

    // Mouse Pointer Move Handler (Raycasting for Interactive Hover Tooltip)
    const handlePointerMove = (e: MouseEvent) => {
      if (!container || !cameraRef.current || !assemblyRef.current) return;
      const rect = container.getBoundingClientRect();
      mouseRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
      mouseRef.current.y = -((e.clientY - rect.top) / rect.height) * 2 + 1;

      raycasterRef.current.setFromCamera(mouseRef.current, cameraRef.current);
      const intersects = raycasterRef.current.intersectObjects(assemblyRef.current.root.children, true);

      if (intersects.length > 0) {
        let current: THREE.Object3D | null = intersects[0].object;
        while (current && !current.userData?.componentId && current.parent) {
          current = current.parent;
        }

        if (current && current.userData?.componentId) {
          const compId = current.userData.componentId as string;
          const spec = ENGINE_COMPONENTS[compId];
          const cylId = current.userData.cylId as number | undefined;
          const cylTelem = cylId ? latestProps.current.telemetryList.find((c) => c.id === cylId) : undefined;

          if (spec) {
            setHoveredComponent({
              id: compId,
              name: cylId ? `${spec.name} (Cyl #${cylId})` : spec.name,
              category: spec.category,
              material: spec.material,
              tempK: cylTelem ? cylTelem.tempKelvin : undefined,
            });
            return;
          }
        }
      }
      setHoveredComponent(null);
    };
    container.addEventListener('mousemove', handlePointerMove);

    // 60 FPS Render Loop
    let animId: number;
    const animate = () => {
      animId = requestAnimationFrame(animate);
      controls.update();

      // Atomic Resize Execution: buffer is resized and immediately rendered in the same JS frame
      if (pendingResize) {
        lastW = targetW;
        lastH = targetH;
        camera.aspect = targetW / targetH;
        camera.updateProjectionMatrix();
        renderer.setSize(targetW, targetH, false);
        pendingResize = false;
      }

      const p = latestProps.current;
      if (assemblyRef.current && visualizerRef.current) {
        const isCutaway = p.viewMode === 'cutaway';
        const showKinetic = p.viewMode === 'kinetic';

        // Live displacement: push bore / stroke into the V8 meshes only when they changed (no rebuild).
        const asm = assemblyRef.current;
        if (asm instanceof V8Assembly) {
          const applied = appliedParamsRef.current;
          if (!applied || applied.asm !== asm || applied.params !== p.engineParams) {
            asm.setEngineParams(p.engineParams);
            appliedParamsRef.current = { asm, params: p.engineParams };
          }
        }

        assemblyRef.current.updateKinematics(
          p.telemetryList,
          p.throttlePercent,
          p.explodedProgress,
          p.seeThroughMode,
          isCutaway,
          p.selectedComponentId,
          p.selectedCylinderId,
          p.crankAngle
        );

        visualizerRef.current.update(p.telemetryList, showKinetic);
      }

      renderer.render(scene, camera);
    };
    animate();

    return () => {
      cancelAnimationFrame(animId);
      window.removeEventListener('resize', handleResize);
      resizeObserver.disconnect();
      renderer.domElement.removeEventListener('webglcontextlost', handleContextLost);
      renderer.domElement.removeEventListener('webglcontextrestored', handleContextRestored);
      container.removeEventListener('mousemove', handlePointerMove);
      renderer.dispose();
      pmremGenerator.dispose();
      if (container.contains(renderer.domElement)) {
        container.removeChild(renderer.domElement);
      }
    };
  }, []);

  // Hot-swap Engine Assembly and Flow Visualizer when engineId changes
  useEffect(() => {
    if (!sceneRef.current || !materialsRef.current) return;
    const scene = sceneRef.current;

    if (assemblyRef.current) {
      scene.remove(assemblyRef.current.root);
    }

    let newAssembly: V8Assembly | I6Assembly | Boxer4Assembly;
    if (engineId === 'i6_bmw') {
      newAssembly = new I6Assembly(materialsRef.current);
    } else if (engineId === 'boxer4_subaru') {
      newAssembly = new Boxer4Assembly(materialsRef.current);
    } else {
      newAssembly = new V8Assembly(materialsRef.current);
    }
    assemblyRef.current = newAssembly;
    scene.add(newAssembly.root);

    if (visualizerRef.current) {
      visualizerRef.current.setEngine(engineId);
    }
  }, [engineId]);

  return (
    <div className="relative w-full h-full overflow-hidden">
      <div
        ref={containerRef}
        className="absolute inset-0 w-full h-full cursor-grab active:cursor-grabbing overflow-hidden"
      />

      {/* Floating Holographic 3D Component Hover Badge */}
      {hoveredComponent && (
        <div className="absolute top-4 left-4 z-10 pointer-events-none bg-slate-900/90 backdrop-blur-md border border-sky-500/50 rounded-lg p-2.5 shadow-2xl shadow-sky-500/10 animate-in fade-in duration-150 flex items-start gap-2.5 max-w-xs text-xs font-sans">
          <div className="w-7 h-7 rounded-md bg-sky-950 border border-sky-600 flex items-center justify-center text-sky-400 shrink-0 mt-0.5">
            <Sparkles className="w-3.5 h-3.5" />
          </div>
          <div>
            <span className="font-mono text-[9px] text-sky-400 uppercase tracking-wider block">
              {hoveredComponent.category}
            </span>
            <span className="font-bold text-white text-xs block mt-0.5">
              {hoveredComponent.name}
            </span>
            <span className="text-[10px] text-slate-400 block mt-0.5">
              {hoveredComponent.material}
            </span>
            {hoveredComponent.tempK !== undefined && (
              <span className="text-[10px] font-mono text-amber-400 font-semibold block mt-0.5">
                Chamber Temp: {(hoveredComponent.tempK - 273.15).toFixed(0)} °C
              </span>
            )}
          </div>
        </div>
      )}

      {/* Screenshot Camera Button */}
      <button
        onClick={handleCaptureScreenshot}
        className="absolute bottom-4 left-[236px] z-10 bg-slate-900/80 hover:bg-slate-800 text-slate-300 hover:text-white border border-slate-700 hover:border-slate-500 rounded-lg p-2 shadow-lg backdrop-blur-md transition flex items-center gap-1.5 text-xs font-sans"
        title="Capture High-Res Viewport Screenshot (PNG)"
      >
        <Camera className="w-4 h-4 text-sky-400" />
        <span className="hidden sm:inline">Snapshot</span>
      </button>
    </div>
  );
};