import type RAPIER from "@dimforge/rapier3d-compat";
import type { MarbleDef } from "./roster";
import { MARBLE_R, buildTrack, type Track } from "./track";

type Rapier = typeof RAPIER;

export type MarbleBody = {
  id: string;
  name: string;
  color: string;
  highlight: string;
  pattern: MarbleDef["pattern"];
  mass: number;
  x: number;
  y: number;
  z: number;
  qx: number;
  qy: number;
  qz: number;
  qw: number;
  vx: number;
  vy: number;
  vz: number;
  finished: boolean;
  place: number | null;
  time: number | null;
  progress: number;
  stuck: number;
};

export type Clack = { mag: number };

let rapier: Rapier | null = null;

async function loadRapier() {
  if (!rapier) {
    const mod = await import("@dimforge/rapier3d-compat");
    rapier = mod.default;
    await rapier.init();
  }
  return rapier;
}

export class PhysicsRace {
  track: Track = buildTrack(0);
  marbles: MarbleBody[] = [];
  gateOpen = false;
  over = false;
  time = 0;
  fast = false;
  private R: Rapier | null = null;
  private world: InstanceType<Rapier["World"]> | null = null;
  private bodies: InstanceType<Rapier["RigidBody"]>[] = [];
  private gateCollider: InstanceType<Rapier["Collider"]> | null = null;
  private acc = 0;
  private finishCount = 0;
  private prevSpeed: number[] = [];
  private fx: Clack[] = [];
  private ready = false;

  async init() {
    this.R = await loadRapier();
    this.ready = true;
  }

  load(track: Track, defs: MarbleDef[], gateOpen: boolean) {
    if (!this.R) return;
    this.freeWorld();
    const R = this.R;
    this.track = track;
    this.gateOpen = gateOpen;
    this.over = false;
    this.time = 0;
    this.acc = 0;
    this.finishCount = 0;
    this.fx = [];
    const world = new R.World({ x: 0, y: -12.5, z: 0 });
    world.timestep = 1 / 60;
    world.numSolverIterations = 8;
    this.world = world;
    const fixed = world.createRigidBody(R.RigidBodyDesc.fixed());
    for (const box of track.boxes) {
      const desc = R.ColliderDesc.cuboid(box.hx, box.hy, box.hz)
        .setTranslation(box.x, box.y, box.z)
        .setRotation(box.q)
        .setFriction(box.friction)
        .setRestitution(box.restitution);
      world.createCollider(desc, fixed);
    }
    for (const cyl of track.cyls) {
      const desc = R.ColliderDesc.cylinder(cyl.hh, cyl.r)
        .setTranslation(cyl.x, cyl.y, cyl.z)
        .setFriction(cyl.friction)
        .setRestitution(cyl.restitution);
      world.createCollider(desc, fixed);
    }
    this.gateCollider = null;
    if (!gateOpen) {
      const g = track.gate;
      const desc = R.ColliderDesc.cuboid(g.hx, g.hy, g.hz)
        .setTranslation(g.x, g.y, g.z)
        .setRotation(g.q)
        .setFriction(g.friction)
        .setRestitution(g.restitution);
      this.gateCollider = world.createCollider(desc, fixed);
    }
    this.bodies = [];
    this.marbles = defs.map((def, i) => {
      const spawn = track.spawns[i % track.spawns.length]!;
      const body = world.createRigidBody(
        R.RigidBodyDesc.dynamic()
          .setTranslation(spawn.x, spawn.y, spawn.z)
          .setLinvel((i - 3.5) * 0.02, -0.12, ((i % 4) - 1.5) * 0.02)
          .setLinearDamping(0.035)
          .setAngularDamping(0.05)
          .setCcdEnabled(true)
          .setCanSleep(false),
      );
      world.createCollider(
        R.ColliderDesc.ball(MARBLE_R).setMass(def.mass).setFriction(0.22).setRestitution(Math.min(0.32, def.bounce)),
        body,
      );
      this.bodies.push(body);
      return {
        id: def.id,
        name: def.name,
        color: def.color,
        highlight: def.highlight,
        pattern: def.pattern,
        mass: def.mass,
        x: spawn.x,
        y: spawn.y,
        z: spawn.z,
        qx: 0,
        qy: 0,
        qz: 0,
        qw: 1,
        vx: 0,
        vy: 0,
        vz: 0,
        finished: false,
        place: null,
        time: null,
        progress: 0,
        stuck: 0,
      };
    });
    this.prevSpeed = this.marbles.map(() => 0);
  }

  openGate() {
    if (!this.world || this.gateOpen) return;
    if (this.gateCollider) {
      this.world.removeCollider(this.gateCollider, true);
      this.gateCollider = null;
    }
    this.gateOpen = true;
    for (const body of this.bodies) body.wakeUp();
  }

  pullFx() {
    const fx = this.fx;
    this.fx = [];
    return fx;
  }

  frame(dt: number) {
    if (!this.world || !this.ready) return;
    const scale = this.fast ? 2 : 1;
    this.acc += Math.min(0.08, dt) * scale;
    const step = 1 / 60;
    let n = 0;
    while (this.acc >= step && n < 5) {
      this.world.step();
      this.time += step;
      this.afterStep(step);
      this.acc -= step;
      n += 1;
    }
  }

  private afterStep(dt: number) {
    const span = Math.max(0.001, this.track.finishX - this.track.startX);
    let unfinished = 0;
    for (let i = 0; i < this.marbles.length; i++) {
      const m = this.marbles[i]!;
      const body = this.bodies[i]!;
      const t = body.translation();
      const r = body.rotation();
      const v = body.linvel();
      const speed = Math.hypot(v.x, v.y, v.z);
      const prev = this.prevSpeed[i] ?? speed;
      if (prev - speed > 1.35) this.fx.push({ mag: (prev - speed) * 180 });
      this.prevSpeed[i] = speed;
      if (speed > 3.1) {
        const s = 3.1 / speed;
        body.setLinvel({ x: v.x * s, y: v.y * s, z: v.z * s }, true);
      }
      m.x = t.x;
      m.y = t.y;
      m.z = t.z;
      m.qx = r.x;
      m.qy = r.y;
      m.qz = r.z;
      m.qw = r.w;
      m.vx = v.x;
      m.vy = v.y;
      m.vz = v.z;
      m.progress = Math.min(1, Math.max(0, (t.x - this.track.startX) / span));
      if (m.finished) {
        if (t.y < this.track.goal.y0 - 0.2) {
          body.setTranslation({ x: this.track.goal.x0 + 0.45, y: this.track.goal.y1 - 0.35, z: Math.max(-0.5, Math.min(0.5, t.z)) }, true);
          body.setLinvel({ x: 0.4, y: 0, z: 0 }, true);
          body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        }
        continue;
      }
      unfinished += 1;
      const goal = this.track.goal;
      if (t.x >= goal.x0 && t.x <= goal.x1 && t.y >= goal.y0 && t.y <= goal.y1 && Math.abs(t.z) <= goal.zMax) {
        this.finish(m);
        continue;
      }
      if (t.y < this.track.fallY) {
        const rescue = this.track.rescue;
        body.setTranslation({ x: rescue.x, y: rescue.y, z: ((i % 3) - 1) * 0.28 }, true);
        body.setLinvel({ x: 1.5, y: -0.15, z: ((i % 3) - 1) * 0.08 }, true);
        body.setAngvel({ x: 0, y: 0, z: 0 }, true);
        m.stuck = 0;
        continue;
      }
      if (this.gateOpen) {
        const spin = Math.hypot(body.angvel().x, body.angvel().y, body.angvel().z);
        if (speed < 0.15 && spin < 0.7) m.stuck += dt;
        else m.stuck = 0;
        if (m.stuck > 1.1) {
          body.setTranslation({ x: t.x + 0.45, y: t.y + 0.42, z: t.z * 0.55 }, true);
          body.setLinvel({ x: 1.35, y: 0.15, z: 0 }, true);
          body.setAngvel({ x: 0, y: 0, z: 0 }, true);
          m.stuck = 0;
        }
      }
    }
    if (!this.over && this.gateOpen && (unfinished === 0 || this.time > 70)) {
      if (unfinished > 0) {
        const rest = this.marbles
          .filter((m) => !m.finished)
          .sort((a, b) => b.x - a.x);
        for (const m of rest) this.finish(m);
      }
      this.over = true;
    }
  }

  private finish(m: MarbleBody) {
    if (m.finished) return;
    m.finished = true;
    this.finishCount += 1;
    m.place = this.finishCount;
    m.time = this.time;
    m.progress = 1;
  }

  private freeWorld() {
    this.world?.free();
    this.world = null;
    this.bodies = [];
    this.gateCollider = null;
  }

  dispose() {
    this.freeWorld();
  }
}
