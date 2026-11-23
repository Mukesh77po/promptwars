import { useEffect, useRef } from 'react';
import {
  DirectionalLight,
  Fog,
  Group,
  HemisphereLight,
  PerspectiveCamera,
  Raycaster,
  Scene,
  Vector2,
  WebGLRenderer,
} from 'three';
import type { Mesh } from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import {
  Disposer,
  addBuildings,
  addGround,
  addRoutes,
  addSelectionMarker,
  addTrees,
  animateParcels,
  createLabels,
  hasWebGL,
  readPalette,
  updateLabels,
} from '../three/campusModel.ts';

const CLICK_TOLERANCE = 5;

export interface CampusSceneProps {
  interactive?: boolean;
  selected?: string | null;
  onSelect?: (departmentId: string) => void;
  theme?: 'light' | 'dark';
}

interface SceneHandle {
  highlight(departmentId: string | null): void;
}

function createPicker(canvas: HTMLCanvasElement, camera: PerspectiveCamera, meshes: Mesh[]) {
  const raycaster = new Raycaster();
  const pointer = new Vector2();
  return (e: PointerEvent): string | undefined => {
    const rect = canvas.getBoundingClientRect();
    pointer.set(
      ((e.clientX - rect.left) / rect.width) * 2 - 1,
      -((e.clientY - rect.top) / rect.height) * 2 + 1,
    );
    raycaster.setFromCamera(pointer, camera);
    return raycaster.intersectObjects(meshes)[0]?.object.userData.departmentId as
      | string
      | undefined;
  };
}

export function CampusScene({
  interactive = false,
  selected = null,
  onSelect,
  theme,
}: CampusSceneProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const handleRef = useRef<SceneHandle | null>(null);
  const onSelectRef = useRef(onSelect);
  onSelectRef.current = onSelect;

  useEffect(() => {
    const host = hostRef.current;
    if (!host || !hasWebGL()) return;

    const palette = readPalette(host);
    const disposer = new Disposer();
    const renderer = disposer.track(new WebGLRenderer({ antialias: true }));
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    renderer.domElement.className = 'block h-full w-full';
    host.appendChild(renderer.domElement);

    const scene = new Scene();
    scene.background = palette.backdrop;
    scene.fog = new Fog(palette.backdrop, 15, 29);

    const camera = new PerspectiveCamera(35, 1, 0.1, 60);
    camera.position.set(8.2, 6.2, 8.8);
    camera.lookAt(0, 0.4, 0);

    scene.add(new HemisphereLight(0xffffff, palette.ground.getHex(), 0.95));
    const sun = new DirectionalLight(0xfffdf7, 0.9);
    sun.position.set(6, 11, 5);
    scene.add(sun);

    const root = new Group();
    scene.add(root);

    addGround(root, palette, disposer);
    const models = addBuildings(root, palette, disposer);
    addTrees(root, palette, disposer);
    const parcels = addRoutes(root, models, palette, disposer);
    const marker = addSelectionMarker(root, palette, disposer);
    const labels = createLabels(host, models);

    handleRef.current = {
      highlight(id) {
        for (const m of models) {
          m.material.color.copy(id === m.departmentId ? palette.signal : palette.face);
        }
        const hit = models.find((m) => m.departmentId === id);
        if (hit) {
          marker.position.set(hit.roof.x, hit.roof.y + 0.04, hit.roof.z);
          marker.visible = true;
        } else {
          marker.visible = false;
        }
      },
    };
    handleRef.current.highlight(selected);

    let controls: OrbitControls | undefined;
    if (interactive) {
      controls = disposer.track(new OrbitControls(camera, renderer.domElement));
      controls.enableDamping = true;
      controls.enablePan = false;
      controls.minDistance = 6.5;
      controls.maxDistance = 16;
      controls.minPolarAngle = Math.PI / 6;
      controls.maxPolarAngle = Math.PI / 2.4;
      controls.target.set(0, 0.4, 0);
    }

    const pick = createPicker(
      renderer.domElement,
      camera,
      models.flatMap((m) => m.meshes),
    );

    let down: { x: number; y: number } | undefined;
    const onDown = (e: PointerEvent) => {
      down = { x: e.clientX, y: e.clientY };
    };
    const onUp = (e: PointerEvent) => {
      if (!down) return;
      const moved = Math.hypot(e.clientX - down.x, e.clientY - down.y);
      down = undefined;
      if (moved > CLICK_TOLERANCE) return;
      const id = pick(e);
      if (id) onSelectRef.current?.(id);
    };
    const onMove = (e: PointerEvent) => {
      renderer.domElement.style.cursor = pick(e) ? 'pointer' : 'grab';
    };

    if (interactive) {
      renderer.domElement.addEventListener('pointerdown', onDown);
      renderer.domElement.addEventListener('pointerup', onUp);
      renderer.domElement.addEventListener('pointermove', onMove);
    }

    let size = { w: 1, h: 1 };
    const fit = () => {
      const w = Math.max(1, host.clientWidth);
      const h = Math.max(1, host.clientHeight);
      size = { w, h };
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h, false);
    };
    fit();
    const ro = new ResizeObserver(fit);
    ro.observe(host);

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let frameId = 0;
    let visible = true;
    const io = new IntersectionObserver(([entry]) => {
      visible = entry?.isIntersecting ?? true;
    });
    io.observe(host);

    const start = performance.now();
    const tick = (now: number) => {
      frameId = requestAnimationFrame(tick);
      if (!visible) return;
      const t = (now - start) / 1000;
      if (!interactive && !reducedMotion) {
        root.rotation.y = Math.sin(t * 0.14) * 0.28;
      }
      animateParcels(parcels, reducedMotion ? 0 : t);
      controls?.update();
      renderer.render(scene, camera);
      updateLabels(labels, camera, size.w, size.h);
    };

    if (reducedMotion && !interactive) {
      animateParcels(parcels, 0.25);
      renderer.render(scene, camera);
      updateLabels(labels, camera, size.w, size.h);
    } else {
      frameId = requestAnimationFrame(tick);
    }

    return () => {
      cancelAnimationFrame(frameId);
      ro.disconnect();
      io.disconnect();
      if (interactive) {
        renderer.domElement.removeEventListener('pointerdown', onDown);
        renderer.domElement.removeEventListener('pointerup', onUp);
        renderer.domElement.removeEventListener('pointermove', onMove);
      }
      disposer.disposeAll();
      host.innerHTML = '';
      handleRef.current = null;
    };
  }, [interactive, theme]);

  useEffect(() => {
    handleRef.current?.highlight(selected ?? null);
  }, [selected]);

  return (
    <div
      ref={hostRef}
      aria-hidden="true"
      className="relative h-full w-full select-none overflow-hidden rounded-lg bg-slate-100 dark:bg-slate-900"
    />
  );
}
