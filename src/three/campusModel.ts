import {
  BoxGeometry,
  BufferGeometry,
  CircleGeometry,
  Color,
  ConeGeometry,
  CylinderGeometry,
  EdgesGeometry,
  Group,
  Line,
  LineBasicMaterial,
  LineDashedMaterial,
  LineSegments,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  QuadraticBezierCurve3,
  RingGeometry,
  SphereGeometry,
  Vector3,
} from 'three';
import type { Camera } from 'three';
import { CAMPUS_BUILDINGS, FLOOR_HEIGHT, PATH_ANGLES, ROUTES, TREES } from './layout.ts';

export interface Palette {
  ink: Color;
  face: Color;
  ground: Color;
  path: Color;
  lawn: Color;
  signal: Color;
  tag: Color;
  backdrop: Color;
}

export function readPalette(el: Element): Palette {
  const style = getComputedStyle(el);
  const color = (name: string, fallback: string) =>
    new Color(style.getPropertyValue(name).trim() || fallback);
  return {
    ink: color('--scene-ink', '#0f172a'),
    face: color('--scene-face', '#ffffff'),
    ground: color('--scene-ground', '#e2e8f0'),
    path: color('--scene-path', '#cbd5e1'),
    lawn: color('--scene-lawn', '#ccfbf1'),
    signal: color('--scene-signal', '#0f766e'),
    tag: color('--scene-tag', '#f59e0b'),
    backdrop: color('--scene-backdrop', '#f1f5f9'),
  };
}

export function hasWebGL(): boolean {
  try {
    const canvas = document.createElement('canvas');
    return !!(canvas.getContext('webgl2') ?? canvas.getContext('webgl'));
  } catch {
    return false;
  }
}

export class Disposer {
  private readonly items: { dispose(): void }[] = [];
  track<T extends { dispose(): void }>(item: T): T {
    this.items.push(item);
    return item;
  }
  disposeAll(): void {
    this.items.forEach((item) => item.dispose());
    this.items.length = 0;
  }
}

export interface BuildingModel {
  departmentId: string;
  meshes: Mesh[];
  material: MeshStandardMaterial;
  roof: Vector3;
}

export interface Parcel {
  curve: QuadraticBezierCurve3;
  mesh: Mesh;
  offset: number;
  speed: number;
}

export function addGround(root: Group, p: Palette, d: Disposer): void {
  const slab = new Mesh(
    d.track(new BoxGeometry(12, 0.3, 10.5)),
    d.track(new MeshStandardMaterial({ color: p.ground, roughness: 0.92 })),
  );
  slab.position.y = -0.15;
  root.add(slab);

  const edge = new LineSegments(
    d.track(new EdgesGeometry(slab.geometry)),
    d.track(new LineBasicMaterial({ color: p.path })),
  );
  edge.position.copy(slab.position);
  root.add(edge);

  const quad = new Mesh(
    d.track(new CircleGeometry(1.75, 40)),
    d.track(new MeshStandardMaterial({ color: p.lawn, roughness: 0.95 })),
  );
  quad.rotation.x = -Math.PI / 2;
  quad.position.y = 0.01;
  root.add(quad);

  const ring = new Mesh(
    d.track(new RingGeometry(1.75, 1.9, 48)),
    d.track(new MeshBasicMaterial({ color: p.path })),
  );
  ring.rotation.x = -Math.PI / 2;
  ring.position.y = 0.015;
  root.add(ring);

  const spokeGeo = d.track(new PlaneGeometry(0.16, 2.2));
  const spokeMat = d.track(new MeshBasicMaterial({ color: p.path }));
  for (const angle of PATH_ANGLES) {
    const spoke = new Mesh(spokeGeo, spokeMat);
    spoke.rotation.x = -Math.PI / 2;
    spoke.rotation.z = -angle;
    spoke.position.set(Math.sin(angle) * 2.8, 0.012, Math.cos(angle) * 2.8);
    root.add(spoke);
  }
}

export function addBuildings(root: Group, p: Palette, d: Disposer): BuildingModel[] {
  const edgeMat = d.track(new LineBasicMaterial({ color: p.ink }));
  const bandMat = d.track(new LineBasicMaterial({ color: p.path }));
  const models: BuildingModel[] = [];

  for (const b of CAMPUS_BUILDINGS) {
    const mat = d.track(new MeshStandardMaterial({ color: p.face, roughness: 0.78 }));
    const meshes: Mesh[] = [];

    for (const [x, z, w, depth, h] of b.blocks) {
      const geo = d.track(new BoxGeometry(w, h, depth));
      const mesh = new Mesh(geo, mat);
      mesh.position.set(x, h / 2, z);
      mesh.userData.departmentId = b.departmentId;
      root.add(mesh);
      meshes.push(mesh);

      const outline = new LineSegments(d.track(new EdgesGeometry(geo)), edgeMat);
      outline.position.copy(mesh.position);
      root.add(outline);

      for (let y = FLOOR_HEIGHT; y < h - 0.1; y += FLOOR_HEIGHT) {
        const band = new LineSegments(
          d.track(new EdgesGeometry(new PlaneGeometry(w + 0.005, depth + 0.005))),
          bandMat,
        );
        band.rotation.x = Math.PI / 2;
        band.position.set(x, y, z);
        root.add(band);
      }
    }

    const [mx, mz, , , mh] = b.blocks[0]!;
    models.push({
      departmentId: b.departmentId,
      meshes,
      material: mat,
      roof: new Vector3(mx, mh + 0.05, mz),
    });
  }

  return models;
}

export function addTrees(root: Group, p: Palette, d: Disposer): void {
  const trunkGeo = d.track(new CylinderGeometry(0.035, 0.045, 0.25, 6));
  const crownGeo = d.track(new ConeGeometry(0.18, 0.45, 7));
  const trunkMat = d.track(new MeshStandardMaterial({ color: p.ink, roughness: 0.9 }));
  const crownMat = d.track(new MeshStandardMaterial({ color: p.lawn, roughness: 0.85 }));

  for (const [x, z, scale] of TREES) {
    const tree = new Group();
    const trunk = new Mesh(trunkGeo, trunkMat);
    trunk.position.y = 0.125;
    const crown = new Mesh(crownGeo, crownMat);
    crown.position.y = 0.44;
    tree.add(trunk, crown);
    tree.position.set(x, 0, z);
    tree.scale.setScalar(scale);
    root.add(tree);
  }
}

export function addRoutes(
  root: Group,
  models: BuildingModel[],
  p: Palette,
  d: Disposer,
): Parcel[] {
  const lineMat = d.track(
    new LineDashedMaterial({ color: p.signal, dashSize: 0.22, gapSize: 0.14 }),
  );
  const parcelGeo = d.track(new SphereGeometry(0.085, 12, 12));
  const parcelMat = d.track(new MeshBasicMaterial({ color: p.tag }));

  return ROUTES.map(([fromIdx, toIdx], i) => {
    const a = models[fromIdx]!.roof;
    const b = models[toIdx]!.roof;
    const mid = a.clone().lerp(b, 0.5);
    mid.y = Math.max(a.y, b.y) + 1.15;

    const curve = new QuadraticBezierCurve3(a, mid, b);
    const arcGeo = d.track(new BufferGeometry().setFromPoints(curve.getPoints(32)));
    const arc = new Line(arcGeo, lineMat);
    arc.computeLineDistances();
    root.add(arc);

    const mesh = new Mesh(parcelGeo, parcelMat);
    mesh.position.copy(a);
    root.add(mesh);

    return {
      curve,
      mesh,
      offset: (i * 0.19) % 1,
      speed: 0.11 + (i % 3) * 0.03,
    };
  });
}

export function animateParcels(parcels: Parcel[], timeSeconds: number): void {
  for (const p of parcels) {
    const t = (timeSeconds * p.speed + p.offset) % 1;
    p.curve.getPoint(t, p.mesh.position);
  }
}

export function addSelectionMarker(root: Group, p: Palette, d: Disposer): Mesh {
  const marker = new Mesh(
    d.track(new RingGeometry(0.28, 0.42, 32)),
    d.track(new MeshBasicMaterial({ color: p.tag, side: 2 })),
  );
  marker.rotation.x = -Math.PI / 2;
  marker.visible = false;
  root.add(marker);
  return marker;
}

export interface LabelEntry {
  el: HTMLDivElement;
  anchor: Vector3;
}

export function createLabels(host: HTMLElement, models: BuildingModel[]): LabelEntry[] {
  const layer = document.createElement('div');
  layer.className = 'pointer-events-none absolute inset-0 overflow-hidden';
  host.appendChild(layer);

  return CAMPUS_BUILDINGS.map((b, i) => {
    const el = document.createElement('div');
    el.textContent = b.label;
    el.className =
      'absolute -translate-x-1/2 -translate-y-full rounded-md border border-slate-300/80 bg-white/90 px-2 py-0.5 font-mono text-[11px] font-semibold tracking-wider text-slate-800 shadow-xs backdrop-blur-xs dark:border-slate-700 dark:bg-slate-900/90 dark:text-slate-100';
    layer.appendChild(el);
    return { el, anchor: models[i]!.roof.clone().add(new Vector3(0, 0.25, 0)) };
  });
}

export function updateLabels(
  labels: LabelEntry[],
  camera: Camera,
  width: number,
  height: number,
): void {
  const v = new Vector3();
  for (const { el, anchor } of labels) {
    v.copy(anchor).project(camera);
    const x = (v.x * 0.5 + 0.5) * width;
    const y = (-v.y * 0.5 + 0.5) * height;
    el.style.transform = `translate3d(${x}px, ${y}px, 0) translate(-50%, -100%)`;
    el.style.opacity = v.z < 1 ? '1' : '0';
  }
}
