import * as THREE from "three";
import type { PhysicsRace } from "./physics";
import { MARBLE_R, type Track, type TrackBox, type TrackCyl } from "./track";

function rotateQuat(q: { x: number; y: number; z: number; w: number }, x: number, y: number, z: number) {
  const tx = 2 * (q.y * z - q.z * y);
  const ty = 2 * (q.z * x - q.x * z);
  const tz = 2 * (q.x * y - q.y * x);
  return {
    x: x + q.w * tx + (q.y * tz - q.z * ty),
    y: y + q.w * ty + (q.z * tx - q.x * tz),
    z: z + q.w * tz + (q.x * ty - q.y * tx),
  };
}

function plasticMaterial(color: string) {
  return new THREE.MeshPhysicalMaterial({
    color: new THREE.Color(color),
    roughness: 0.22,
    metalness: 0,
    clearcoat: 0.85,
    clearcoatRoughness: 0.18,
    envMapIntensity: 0.7,
  });
}

function envTexture() {
  const c = document.createElement("canvas");
  c.width = 128;
  c.height = 64;
  const g = c.getContext("2d");
  if (!g) return null;
  const grd = g.createLinearGradient(0, 0, 0, 64);
  grd.addColorStop(0, "#fff7d6");
  grd.addColorStop(0.45, "#8fd8ff");
  grd.addColorStop(1, "#7dde8a");
  g.fillStyle = grd;
  g.fillRect(0, 0, 128, 64);
  g.fillStyle = "#ffffff";
  g.beginPath();
  g.arc(96, 16, 10, 0, Math.PI * 2);
  g.fill();
  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

export class RaceView {
  readonly renderer: THREE.WebGLRenderer;
  readonly scene: THREE.Scene;
  readonly camera: THREE.PerspectiveCamera;
  private world = new THREE.Group();
  private track: Track | null = null;
  private marbles = new Map<string, THREE.Group>();
  private ring: THREE.Mesh | null = null;
  private gate: THREE.Mesh | null = null;
  private gateLift = 0;
  private focus = new THREE.Vector3();
  private look = new THREE.Vector3();
  private camPos = new THREE.Vector3(2, 14, 8);
  private desired = new THREE.Vector3();
  private courseCam = new THREE.Vector3(2, 14, 8);
  private courseLook = new THREE.Vector3(8, 4, 0);
  private ready = false;
  private envMap: THREE.Texture | null = null;
  private pmrem: THREE.PMREMGenerator | null = null;

  constructor(canvas: HTMLCanvasElement) {
    this.renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: false, powerPreference: "high-performance" });
    this.renderer.setPixelRatio(Math.min(1.75, window.devicePixelRatio || 1));
    this.renderer.outputColorSpace = THREE.SRGBColorSpace;
    this.renderer.toneMapping = THREE.ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.05;
    this.scene = new THREE.Scene();
    this.scene.background = new THREE.Color("#8fd8ff");
    this.scene.fog = new THREE.Fog("#8fd8ff", 28, 120);
    this.camera = new THREE.PerspectiveCamera(50, 1, 0.08, 180);
    this.camera.up.set(1, 0, 0);
    this.scene.add(this.world);
    this.scene.add(new THREE.HemisphereLight("#fff6d8", "#6fbf78", 1.15));
    const sun = new THREE.DirectionalLight("#fffaf0", 1.35);
    sun.position.set(6, 14, 4);
    this.scene.add(sun);
    const fill = new THREE.DirectionalLight("#c9ecff", 0.45);
    fill.position.set(-5, 6, -3);
    this.scene.add(fill);
    const raw = envTexture();
    if (raw) {
      this.pmrem = new THREE.PMREMGenerator(this.renderer);
      this.envMap = this.pmrem.fromEquirectangular(raw).texture;
      raw.dispose();
      this.scene.environment = this.envMap;
    }
  }

  setSize(w: number, h: number) {
    const width = Math.max(1, w);
    const height = Math.max(1, h);
    this.renderer.setSize(width, height, false);
    this.camera.aspect = width / height;
    this.camera.fov = width < height ? 58 : 50;
    this.camera.updateProjectionMatrix();
  }

  private clearWorld() {
    this.world.traverse((obj) => {
      const mesh = obj as THREE.Mesh;
      if (mesh.geometry) mesh.geometry.dispose();
      const mat = mesh.material;
      if (Array.isArray(mat)) for (const m of mat) m.dispose();
      else if (mat) mat.dispose();
    });
    this.world.clear();
    this.marbles.clear();
    this.ring = null;
    this.gate = null;
  }

  private rebuild(race: PhysicsRace) {
    this.clearWorld();
    const track = race.track;
    this.track = track;
    const byColor = new Map<string, TrackBox[]>();
    for (const box of track.boxes) {
      const list = byColor.get(box.color) ?? [];
      list.push(box);
      byColor.set(box.color, list);
    }
    const dummy = new THREE.Object3D();
    const boxGeo = new THREE.BoxGeometry(1, 1, 1);
    for (const [color, list] of byColor) {
      const mesh = new THREE.InstancedMesh(boxGeo.clone(), plasticMaterial(color), list.length);
      list.forEach((b, i) => {
        dummy.position.set(b.x, b.y, b.z);
        dummy.quaternion.set(b.q.x, b.q.y, b.q.z, b.q.w);
        dummy.scale.set(b.hx * 2, b.hy * 2, b.hz * 2);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      this.world.add(mesh);
    }
    boxGeo.dispose();
    const cylGroups = new Map<string, TrackCyl[]>();
    for (const cyl of track.cyls) {
      const list = cylGroups.get(cyl.color) ?? [];
      list.push(cyl);
      cylGroups.set(cyl.color, list);
    }
    for (const [color, list] of cylGroups) {
      const geo = new THREE.CylinderGeometry(1, 1, 1, 16);
      const mesh = new THREE.InstancedMesh(geo, plasticMaterial(color), list.length);
      list.forEach((c, i) => {
        dummy.position.set(c.x, c.y, c.z);
        dummy.quaternion.set(0, 0, 0, 1);
        dummy.scale.set(c.r, c.hh * 2, c.r);
        dummy.updateMatrix();
        mesh.setMatrixAt(i, dummy.matrix);
      });
      mesh.instanceMatrix.needsUpdate = true;
      this.world.add(mesh);
    }
    for (const funnel of track.meshes) {
      const hole = new THREE.Mesh(
        new THREE.TorusGeometry(funnel.holeR, 0.03, 8, 24),
        new THREE.MeshStandardMaterial({ color: funnel.color, roughness: 0.4 }),
      );
      hole.rotation.x = Math.PI / 2;
      hole.position.set(funnel.x, funnel.y, funnel.z);
      this.world.add(hole);
    }
    const g = track.gate;
    this.gate = new THREE.Mesh(new THREE.BoxGeometry(g.hx * 2, g.hy * 2, g.hz * 2), plasticMaterial(g.color));
    this.gate.position.set(g.x, g.y, g.z);
    this.gate.quaternion.set(g.q.x, g.q.y, g.q.z, g.q.w);
    this.world.add(this.gate);
    this.gateLift = race.gateOpen ? 1 : 0;

    const sphere = new THREE.SphereGeometry(MARBLE_R, 28, 20);
    for (const m of race.marbles) {
      const group = new THREE.Group();
      const body = new THREE.Mesh(
        sphere,
        new THREE.MeshPhysicalMaterial({
          color: new THREE.Color(m.color),
          roughness: 0.18,
          metalness: 0,
          clearcoat: 1,
          clearcoatRoughness: 0.08,
          envMapIntensity: 0.9,
        }),
      );
      group.add(body);
      const stripeMat = new THREE.MeshPhysicalMaterial({
        color: new THREE.Color(m.highlight),
        roughness: 0.25,
        clearcoat: 0.6,
      });
      if (m.pattern === "ring" || m.pattern === "band" || m.pattern === "swirl") {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(MARBLE_R * 0.86, m.pattern === "band" ? 0.028 : 0.016, 8, 18), stripeMat);
        ring.rotation.y = 0.4;
        group.add(ring);
        if (m.pattern === "swirl") {
          const ring2 = ring.clone();
          ring2.rotation.x = 1.1;
          group.add(ring2);
        }
      } else if (m.pattern === "speck") {
        const dot = new THREE.Mesh(new THREE.SphereGeometry(MARBLE_R * 0.16, 8, 6), stripeMat);
        dot.position.set(MARBLE_R * 0.55, MARBLE_R * 0.35, MARBLE_R * 0.45);
        group.add(dot);
      }
      group.position.set(m.x, m.y, m.z);
      this.world.add(group);
      this.marbles.set(m.id, group);
    }
    this.frameCourse(track);
    this.ready = false;
  }

  private frameCourse(track: Track) {
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    let minZ = Infinity;
    let maxZ = -Infinity;
    const grow = (x: number, y: number, z: number, px: number, py: number, pz: number) => {
      minX = Math.min(minX, x - px);
      maxX = Math.max(maxX, x + px);
      minY = Math.min(minY, y - py);
      maxY = Math.max(maxY, y + py);
      minZ = Math.min(minZ, z - pz);
      maxZ = Math.max(maxZ, z + pz);
    };
    for (const b of track.boxes) {
      const ax = rotateQuat(b.q, b.hx, 0, 0);
      const ay = rotateQuat(b.q, 0, b.hy, 0);
      const az = rotateQuat(b.q, 0, 0, b.hz);
      grow(
        b.x,
        b.y,
        b.z,
        Math.abs(ax.x) + Math.abs(ay.x) + Math.abs(az.x),
        Math.abs(ax.y) + Math.abs(ay.y) + Math.abs(az.y),
        Math.abs(ax.z) + Math.abs(ay.z) + Math.abs(az.z),
      );
    }
    for (const c of track.cyls) grow(c.x, c.y, c.z, c.r, c.hh, c.r);
    for (const m of track.meshes) grow(m.x, m.y, m.z, m.holeR + 0.4, 0.2, m.holeR + 0.4);
    const spanX = Math.max(4, maxX - minX);
    const spanZ = Math.max(2.4, maxZ - minZ);
    const midY = (minY + maxY) / 2;
    const midZ = (minZ + maxZ) / 2;
    const dist = Math.min(9.5, Math.max(4.6, Math.max(spanX * 0.42, spanZ * 1.15)));
    this.courseLook.set(minX + spanX * 0.28, midY, midZ);
    this.courseCam.set(this.courseLook.x - dist * 0.42, maxY + dist, midZ);
  }

  render(race: PhysicsRace | null, dt: number, favoriteId: string) {
    if (!race) return;
    if (this.track !== race.track) this.rebuild(race);
    const k = 1 - Math.exp(-10 * dt);
    const target = race.gateOpen ? 1 : 0;
    this.gateLift += (target - this.gateLift) * (this.ready ? k : 1);
    if (this.gate) {
      const g = race.track.gate;
      this.gate.position.set(g.x, g.y + this.gateLift * 1.15, g.z);
      this.gate.visible = this.gateLift < 0.98;
    }
    let fav: { x: number; y: number; z: number } | null = null;
    for (const m of race.marbles) {
      const group = this.marbles.get(m.id);
      if (!group) continue;
      group.position.set(m.x, m.y, m.z);
      group.quaternion.set(m.qx, m.qy, m.qz, m.qw);
      if (m.id === favoriteId) fav = m;
    }
    if (fav) {
      if (!this.ring) {
        this.ring = new THREE.Mesh(
          new THREE.TorusGeometry(MARBLE_R * 1.55, 0.012, 6, 20),
          new THREE.MeshBasicMaterial({ color: "#ffffff" }),
        );
        this.ring.rotation.x = Math.PI / 2;
        this.world.add(this.ring);
      }
      this.ring.visible = true;
      this.ring.position.set(fav.x, fav.y - MARBLE_R * 0.2, fav.z);
    } else if (this.ring) this.ring.visible = false;

    this.aim(race, dt);
    this.renderer.render(this.scene, this.camera);
  }

  private aim(race: PhysicsRace, dt: number) {
    const all = race.marbles;
    const zip = race.fast;
    if (all.length === 0) {
      this.desired.copy(this.courseCam);
      this.focus.copy(this.courseLook);
    } else {
      const live = all.filter((m) => !m.finished);
      const pack = live.length > 0 ? live : all;
      let leadX = -Infinity;
      for (const m of pack) if (m.x > leadX) leadX = m.x;
      const window = zip ? 2.4 : 4.2;
      const near = pack.filter((m) => leadX - m.x <= window);
      const group = near.length > 0 ? near : pack;
      let minX = Infinity;
      let maxX = -Infinity;
      let minZ = Infinity;
      let maxZ = -Infinity;
      let sy = 0;
      for (const m of group) {
        minX = Math.min(minX, m.x);
        maxX = Math.max(maxX, m.x);
        minZ = Math.min(minZ, m.z);
        maxZ = Math.max(maxZ, m.z);
        sy += m.y;
      }
      const fy = sy / group.length;
      const cx = (minX + maxX) * 0.5;
      const cz = (minZ + maxZ) * 0.5;
      const spanX = Math.max(0.5, maxX - minX);
      const spanZ = Math.max(0.5, maxZ - minZ);
      const padX = zip ? 1.45 : 2.05;
      const padZ = zip ? 1.0 : 1.45;
      const fov = (this.camera.fov * Math.PI) / 180;
      const aspect = Math.max(0.45, this.camera.aspect || 1);
      const tanV = Math.tan(fov * 0.5);
      const tanH = tanV * aspect;
      const height = Math.min(
        zip ? 5.2 : 5.8,
        Math.max(zip ? 2.85 : 2.55, (spanX + padX) / (2 * tanV), (spanZ + padZ) / (2 * tanH)),
      );
      const ahead = zip ? 0.42 : 0.5;
      const back = Math.max(zip ? 1.05 : 0.85, height * (zip ? 0.4 : 0.34));
      this.focus.set(cx + ahead, fy - 0.02, cz);
      this.desired.set(this.focus.x - back, fy + height, cz);
    }
    const blend = !this.ready ? 1 : 1 - Math.exp(-(zip ? 6.5 : 2.6) * dt);
    this.camPos.lerp(this.desired, blend);
    this.look.lerp(this.focus, blend);
    this.ready = true;
    this.camera.position.copy(this.camPos);
    this.camera.lookAt(this.look);
  }

  dispose() {
    this.clearWorld();
    this.envMap?.dispose();
    this.pmrem?.dispose();
    this.renderer.dispose();
  }
}
