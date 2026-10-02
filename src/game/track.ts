export type Quat = { x: number; y: number; z: number; w: number };

export type TrackBox = {
  x: number;
  y: number;
  z: number;
  hx: number;
  hy: number;
  hz: number;
  q: Quat;
  color: string;
  friction: number;
  restitution: number;
};

export type TrackCyl = {
  x: number;
  y: number;
  z: number;
  hh: number;
  r: number;
  color: string;
  friction: number;
  restitution: number;
};

export type TrackMesh = {
  x: number;
  y: number;
  z: number;
  holeR: number;
  color: string;
};

export type Track = {
  name: string;
  blurb: string;
  boxes: TrackBox[];
  cyls: TrackCyl[];
  meshes: TrackMesh[];
  spawns: { x: number; y: number; z: number }[];
  gate: TrackBox;
  finishX: number;
  finishY: number;
  startX: number;
  fallY: number;
  rescue: { x: number; y: number; z: number };
  goal: { x0: number; x1: number; y0: number; y1: number; zMax: number };
};

export const MARBLE_R = 0.1;
export const COURSE_COUNT = 4;

const ID: Quat = { x: 0, y: 0, z: 0, w: 1 };
const BLUE = "#3ec6ff";
const YELLOW = "#ffd23c";
const PINK = "#ff73c7";
const ORANGE = "#ff9f43";
const MINT = "#5ee6a8";
const PEG = "#ff5a7a";

const PLASTIC = { friction: 0.055, restitution: 0.08 };

type V3 = { x: number; y: number; z: number };

const SPECS = [
  { bowls: 1, waves: 3, bumpers: false, name: "Sunny Bowl", blurb: "One funnel, then three mouths." },
  { bowls: 2, waves: 3, bumpers: false, name: "Double Dip", blurb: "Two bowls. Pink still takes the long way." },
  { bowls: 1, waves: 4, bumpers: true, name: "Bumper Bend", blurb: "Pegs knock the pack around before the bowl." },
  { bowls: 2, waves: 4, bumpers: true, name: "Wiggly Wild", blurb: "Bowls, bumpers, and a long pink snake." },
];

export const COURSE_NAMES = SPECS.map((spec) => spec.name);

function quatAlignX(dx: number, dy: number, dz: number): Quat {
  const len = Math.hypot(dx, dy, dz) || 1;
  const tx = dx / len;
  const ty = dy / len;
  const tz = dz / len;
  let ax = 0;
  let ay = -tz;
  let az = ty;
  const al = Math.hypot(ax, ay, az);
  if (al < 1e-8) {
    if (tx > 0) return ID;
    return { x: 0, y: 1, z: 0, w: 0 };
  }
  ax /= al;
  ay /= al;
  az /= al;
  const dot = Math.min(1, Math.max(-1, tx));
  const ang = Math.acos(dot);
  const s = Math.sin(ang / 2);
  let q: Quat = { x: ax * s, y: ay * s, z: az * s, w: Math.cos(ang / 2) };
  const up = rotate(q, 0, 1, 0);
  if (up.y < 0) q = quatMul(q, { x: 1, y: 0, z: 0, w: 0 });
  return q;
}

function rotate(q: Quat, x: number, y: number, z: number) {
  const tx = 2 * (q.y * z - q.z * y);
  const ty = 2 * (q.z * x - q.x * z);
  const tz = 2 * (q.x * y - q.y * x);
  return {
    x: x + q.w * tx + (q.y * tz - q.z * ty),
    y: y + q.w * ty + (q.z * tx - q.x * tz),
    z: z + q.w * tz + (q.x * ty - q.y * tx),
  };
}

function addBox(
  boxes: TrackBox[],
  x: number,
  y: number,
  z: number,
  hx: number,
  hy: number,
  hz: number,
  q: Quat,
  color: string,
  surface: { friction: number; restitution: number },
) {
  boxes.push({ x, y, z, hx, hy, hz, q, color, friction: surface.friction, restitution: surface.restitution });
}

function quatMul(a: Quat, b: Quat): Quat {
  return {
    x: a.w * b.x + a.x * b.w + a.y * b.z - a.z * b.y,
    y: a.w * b.y - a.x * b.z + a.y * b.w + a.z * b.x,
    z: a.w * b.z + a.x * b.y - a.y * b.x + a.z * b.w,
    w: a.w * b.w - a.x * b.x - a.y * b.y - a.z * b.z,
  };
}

function quatRotX(ang: number): Quat {
  return { x: Math.sin(ang / 2), y: 0, z: 0, w: Math.cos(ang / 2) };
}

function addChute(
  boxes: TrackBox[],
  a: V3,
  b: V3,
  halfW: number,
  color: string,
  wallH = 0.46,
  bank = 0,
  trimStart = 0,
  trimEnd = 0,
) {
  const dx = b.x - a.x;
  const dy = b.y - a.y;
  const dz = b.z - a.z;
  const len = Math.hypot(dx, dy, dz);
  if (len < 0.1) return;
  let q = quatAlignX(dx, dy, dz);
  if (bank !== 0) q = quatMul(q, quatRotX(bank));
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2;
  const mz = (a.z + b.z) / 2;
  const hx = len / 2 + 0.08;
  const floorH = 0.07;
  const wallT = 0.06;
  addBox(boxes, mx, my, mz, hx, floorH, halfW, q, color, PLASTIC);
  const lift = wallH / 2;
  const side = halfW + wallT / 2;
  const trim = Math.min(len - 0.12, Math.max(0, trimStart) + Math.max(0, trimEnd));
  const whx = Math.max(0.05, (len - trim) / 2);
  const shift = (Math.max(0, trimStart) - Math.max(0, trimEnd)) / 2;
  const along = rotate(q, shift, 0, 0);
  const left = rotate(q, 0, lift, -side);
  const right = rotate(q, 0, lift, side);
  addBox(boxes, mx + along.x + left.x, my + along.y + left.y, mz + along.z + left.z, whx, lift, wallT / 2, q, color, PLASTIC);
  addBox(boxes, mx + along.x + right.x, my + along.y + right.y, mz + along.z + right.z, whx, lift, wallT / 2, q, color, PLASTIC);
}

function addCyl(cyls: TrackCyl[], x: number, y: number, z: number, hh: number, r: number, color: string) {
  cyls.push({ x, y, z, hh, r, color, friction: 0.22, restitution: 0.12 });
}

function norm(v: V3): V3 {
  const l = Math.hypot(v.x, v.y, v.z) || 1;
  return { x: v.x / l, y: v.y / l, z: v.z / l };
}

function cross(a: V3, b: V3): V3 {
  return { x: a.y * b.z - a.z * b.y, y: a.z * b.x - a.x * b.z, z: a.x * b.y - a.y * b.x };
}

function quatFromBasis(X: V3, Y: V3, Z: V3): Quat {
  const m00 = X.x;
  const m10 = X.y;
  const m20 = X.z;
  const m01 = Y.x;
  const m11 = Y.y;
  const m21 = Y.z;
  const m02 = Z.x;
  const m12 = Z.y;
  const m22 = Z.z;
  const tr = m00 + m11 + m22;
  if (tr > 0) {
    const s = Math.sqrt(tr + 1) * 2;
    return { w: 0.25 * s, x: (m21 - m12) / s, y: (m02 - m20) / s, z: (m10 - m01) / s };
  }
  if (m00 > m11 && m00 > m22) {
    const s = Math.sqrt(1 + m00 - m11 - m22) * 2;
    return { w: (m21 - m12) / s, x: 0.25 * s, y: (m01 + m10) / s, z: (m02 + m20) / s };
  }
  if (m11 > m22) {
    const s = Math.sqrt(1 + m11 - m00 - m22) * 2;
    return { w: (m02 - m20) / s, x: (m01 + m10) / s, y: 0.25 * s, z: (m12 + m21) / s };
  }
  const s = Math.sqrt(1 + m22 - m00 - m11) * 2;
  return { w: (m10 - m01) / s, x: (m02 + m20) / s, y: (m12 + m21) / s, z: 0.25 * s };
}

function addFunnel(boxes: TrackBox[], meshes: TrackMesh[], x: number, y: number, z: number, rim: number, hole: number, depth: number, door: number) {
  const rings = 6;
  const segs = 18;
  const tilt = 0.5;
  const ct = Math.cos(tilt);
  const st = Math.sin(tilt);
  for (let i = 0; i < rings; i++) {
    const r0 = rim + (hole - rim) * (i / rings);
    const r1 = rim + (hole - rim) * ((i + 1) / rings);
    const rad = (r0 + r1) / 2;
    const py = -depth * ((i + 0.5) / rings);
    const radialSpan = Math.abs(r0 - r1) / 2 + 0.04;
    const chord = (Math.PI * 2 * Math.max(rad, hole + 0.04)) / segs;
    for (let j = 0; j < segs; j++) {
      const a = (j / segs) * Math.PI * 2;
      if (i < 2) {
        let d = Math.abs(a - door);
        if (d > Math.PI) d = Math.PI * 2 - d;
        if (d < 0.8) continue;
      }
      const inward = { x: -Math.cos(a), y: 0, z: -Math.sin(a) };
      const tangent = norm({ x: -Math.sin(a), y: 0, z: Math.cos(a) });
      const zAxis = norm({ x: inward.x * ct, y: -st, z: inward.z * ct });
      const yAxis = norm(cross(zAxis, tangent));
      const q = quatFromBasis(tangent, yAxis, zAxis);
      addBox(
        boxes,
        x + Math.cos(a) * rad,
        y + py,
        z + Math.sin(a) * rad,
        chord * 0.62,
        0.07,
        radialSpan,
        q,
        YELLOW,
        { friction: 0.1, restitution: 0.04 },
      );
    }
  }
  for (let j = 0; j < segs; j++) {
    const a = (j / segs) * Math.PI * 2;
    let d = Math.abs(a - door);
    if (d > Math.PI) d = Math.PI * 2 - d;
    if (d < 1.35) continue;
    addBox(
      boxes,
      x + Math.cos(a) * (rim + 0.1),
      y + 0.2,
      z + Math.sin(a) * (rim + 0.1),
      0.12,
      0.22,
      0.07,
      quatAlignX(-Math.sin(a), 0, Math.cos(a)),
      YELLOW,
      { friction: 0.16, restitution: 0.05 },
    );
  }
  meshes.push({ x, y: y - depth, z, holeR: hole, color: "#24324a" });
}

function addRun(boxes: TrackBox[], pts: V3[], halfW: number, color: string, wallH: number, trimFirst = 0, trimLast = 0) {
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[i]!;
    const p1 = pts[i + 1]!;
    let bank = 0;
    if (i + 1 < pts.length - 1) {
      const p2 = pts[i + 2]!;
      const dx1 = p1.x - p0.x;
      const dz1 = p1.z - p0.z;
      const dx2 = p2.x - p1.x;
      const dz2 = p2.z - p1.z;
      const scale = Math.hypot(dx1, dz1) * Math.hypot(dx2, dz2) + 0.0001;
      bank = Math.max(-0.5, Math.min(0.5, ((dx1 * dz2 - dz1 * dx2) / scale) * 0.85));
    }
    const trimStart = i === 0 ? trimFirst : 0.02;
    const trimEnd = i === pts.length - 2 ? trimLast : 0.02;
    addChute(boxes, p0, p1, halfW, color, wallH, bank, trimStart, trimEnd);
  }
}

function addSplit(boxes: TrackBox[], cyls: TrackCyl[], start: V3, waves: number) {
  const deckEnd: V3 = { x: start.x + 2.5, y: start.y - 1.05, z: 0 };
  addChute(boxes, start, deckEnd, 1.28, BLUE, 0.66, 0, 0, 0.04);
  for (let i = 0; i < 2; i++) {
    const t = 0.32 + i * 0.24;
    const x = start.x + (deckEnd.x - start.x) * t;
    const y = start.y + (deckEnd.y - start.y) * t + 0.2;
    const z = i === 0 ? -0.62 : 0.62;
    addCyl(cyls, x, y, z, 0.18, 0.09, PEG);
  }
  const along = (t: number) => start.y + (deckEnd.y - start.y) * t;
  for (const z of [-0.43, 0.43]) {
    const ax = start.x + 1.25;
    const bx = deckEnd.x - 0.45;
    const a = { x: ax, y: along((ax - start.x) / 2.5) + 0.18, z };
    const b = { x: bx, y: along((bx - start.x) / 2.5) + 0.18, z };
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const q = quatAlignX(dx, dy, 0);
    const up = rotate(q, 0, 0.15, 0);
    addBox(boxes, (a.x + b.x) / 2 + up.x, (a.y + b.y) / 2 + up.y, z + up.z, Math.hypot(dx, dy) / 2, 0.15, 0.04, q, BLUE, PLASTIC);
    addCyl(cyls, a.x, a.y, z, 0.18, 0.08, PEG);
  }

  const mouthX = deckEnd.x;
  const mouthY = deckEnd.y;
  const run = 3.35;
  const laps = waves >= 4 ? 3 : 2;
  const zNear = -0.86;
  const zFar = -1.78;
  const pink: V3[] = [{ x: mouthX, y: mouthY, z: zNear }];
  let x = mouthX;
  let y = mouthY;
  let z = zNear;
  for (let i = 0; i < laps; i++) {
    const dir = i % 2 === 0 ? 1 : -1;
    const x2 = x + dir * run;
    const y2 = y - 0.78;
    pink.push({ x: x2, y: y2, z });
    x = x2;
    y = y2;
    if (i < laps - 1) {
      const z2 = Math.abs(z - zNear) < 0.25 ? zFar : zNear;
      const radius = 1.15;
      for (let k = 1; k <= 4; k++) {
        const a = (k / 4) * Math.PI;
        pink.push({
          x: x + dir * Math.sin(a) * radius,
          y: y - 0.16 * k,
          z: z + (z2 - z) * (k / 4),
        });
      }
      y -= 0.64;
      z = z2;
    }
  }
  const c0x = mouthX + run + 1.2;
  const c0y = y - 0.82;
  const c1: V3 = { x: c0x + 3.15, y: c0y - 0.95, z: 0 };
  const onCollector = (px: number, pz: number): V3 => {
    const t = (px - c0x) / (c1.x - c0x);
    return { x: px, y: c0y + (c1.y - c0y) * t, z: pz };
  };
  pink.push(onCollector(c0x + 1.05, -0.52));
  addRun(boxes, pink, 0.38, PINK, 0.86, 0.05, 0.35);

  const mintEnd = onCollector(c0x + 0.85, 0.48);
  const mintDrop = mintEnd.y - mouthY;
  addRun(
    boxes,
    [
      { x: mouthX, y: mouthY, z: 0.86 },
      { x: mouthX + (mintEnd.x - mouthX) * 0.42, y: mouthY + mintDrop * 0.72, z: 0.64 },
      mintEnd,
    ],
    0.36,
    MINT,
    0.62,
    0.05,
    0.35,
  );

  const orangeEnd = onCollector(c0x + 0.95, 0);
  const orangeDrop = orangeEnd.y - mouthY;
  addRun(
    boxes,
    [
      { x: mouthX, y: mouthY, z: 0 },
      { x: mouthX + (orangeEnd.x - mouthX) * 0.48, y: mouthY + orangeDrop * 0.46, z: 0.04 },
      orangeEnd,
    ],
    0.34,
    ORANGE,
    0.62,
    0.05,
    0.35,
  );

  addChute(boxes, { x: c0x, y: c0y, z: 0 }, c1, 1.35, BLUE, 0.64);
  addBox(boxes, c1.x + 0.28, c1.y + 0.4, 0, 0.1, 0.48, 1.45, ID, BLUE, PLASTIC);
  return {
    fin: c1,
    rescue: { x: 1.15, y: 7.62, z: 0 },
  };
}

function addBowlRun(boxes: TrackBox[], meshes: TrackMesh[], cursor: V3) {
  const rim = 1.28;
  const hole = 0.52;
  const depth = 0.78;
  const door = Math.PI;
  const bowlX = cursor.x + rim + 2.45;
  const bowlY = cursor.y - 0.48;
  const from: V3 = { x: cursor.x, y: cursor.y, z: cursor.z };
  const gather: V3 = { x: bowlX - rim - 0.85, y: from.y - 0.55, z: 0 };
  const lip: V3 = { x: bowlX - 0.72, y: bowlY - 0.32, z: 0.12 };
  addChute(boxes, from, gather, 0.72, BLUE, 0.55, 0, 0, 0.08);
  addChute(boxes, gather, lip, 0.34, BLUE, 0.88, 0, 0, 0.1);
  const rail = (z0: number, z1: number) => {
    const a = { x: from.x + 0.35, y: from.y - 0.12, z: z0 };
    const b = { x: gather.x - 0.05, y: gather.y + 0.05, z: z1 };
    const dx = b.x - a.x;
    const dy = b.y - a.y;
    const dz = b.z - a.z;
    const q = quatAlignX(dx, dy, dz);
    const up = rotate(q, 0, 0.28, 0);
    addBox(
      boxes,
      (a.x + b.x) / 2 + up.x,
      (a.y + b.y) / 2 + up.y,
      (a.z + b.z) / 2 + up.z,
      Math.hypot(dx, dy, dz) / 2,
      0.28,
      0.045,
      q,
      BLUE,
      PLASTIC,
    );
  };
  rail(-0.62, -0.3);
  rail(0.62, 0.3);
  addFunnel(boxes, meshes, bowlX, bowlY, 0, rim, hole, depth, door);
  const holeY = bowlY - depth;
  const hopA: V3 = { x: bowlX - 0.62, y: holeY - 0.42, z: 0 };
  const hopB: V3 = { x: bowlX + 1.9, y: holeY - 1.15, z: 0 };
  addChute(boxes, hopA, hopB, 0.95, BLUE, 0.58);
  addBox(boxes, hopA.x - 0.2, hopA.y + 0.38, 0, 0.09, 0.4, 1.02, ID, BLUE, PLASTIC);
  cursor.x = hopB.x;
  cursor.y = hopB.y;
  cursor.z = 0;
}

export function buildTrack(index: number): Track {
  const spec = SPECS[Math.abs(index) % SPECS.length]!;
  const boxes: TrackBox[] = [];
  const cyls: TrackCyl[] = [];
  const meshes: TrackMesh[] = [];
  const penA: V3 = { x: 0.2, y: 7.7, z: 0 };
  const penB: V3 = { x: 2.75, y: 6.35, z: 0 };
  addChute(boxes, penA, penB, 0.7, BLUE, 0.7);
  const pdx = penB.x - penA.x;
  const pdy = penB.y - penA.y;
  const plen = Math.hypot(pdx, pdy) || 1;
  const gq = quatAlignX(pdx, pdy, 0);
  const gup = rotate(gq, 0, 0.28, 0);
  const gback = { x: (pdx / plen) * 0.42, y: (pdy / plen) * 0.42, z: 0 };
  const gate: TrackBox = {
    x: penB.x - gback.x + gup.x,
    y: penB.y - gback.y + gup.y,
    z: 0,
    hx: 0.07,
    hy: 0.32,
    hz: 0.92,
    q: gq,
    color: YELLOW,
    friction: 0.35,
    restitution: 0.02,
  };
  const spawns: { x: number; y: number; z: number }[] = [];
  for (const z of [-0.48, -0.16, 0.16, 0.48]) {
    for (const x of [0.58, 1.22]) {
      const t = (x - penA.x) / (penB.x - penA.x);
      const y = penA.y + (penB.y - penA.y) * t + 0.36;
      spawns.push({ x, y, z });
    }
  }
  const cursor: V3 = { x: penB.x, y: penB.y, z: 0 };
  if (spec.bumpers) {
    const next: V3 = { x: cursor.x + 3.4, y: cursor.y - 1.25, z: 0 };
    addChute(boxes, cursor, next, 0.85, BLUE, 0.6);
    for (let i = 0; i < 3; i++) {
      const t = 0.28 + i * 0.22;
      const x = cursor.x + (next.x - cursor.x) * t;
      const y = cursor.y + (next.y - cursor.y) * t + 0.2;
      const z = i === 1 ? 0.48 : -0.42;
      addCyl(cyls, x, y, z, 0.18, 0.09, PEG);
    }
    cursor.x = next.x;
    cursor.y = next.y;
  }
  for (let b = 0; b < spec.bowls; b++) {
    addBowlRun(boxes, meshes, cursor);
    if (b < spec.bowls - 1) {
      const next: V3 = { x: cursor.x + 1.7, y: cursor.y - 0.55, z: 0 };
      addChute(boxes, cursor, next, 0.5, BLUE, 0.48);
      cursor.x = next.x;
      cursor.y = next.y;
    }
  }
  const split = addSplit(boxes, cyls, cursor, spec.waves);
  let floorY = Infinity;
  for (const b of boxes) floorY = Math.min(floorY, b.y);
  for (const m of meshes) floorY = Math.min(floorY, m.y);
  const fin = split.fin;
  return {
    name: spec.name,
    blurb: spec.blurb,
    boxes,
    cyls,
    meshes,
    spawns,
    gate,
    finishX: fin.x - 0.7,
    finishY: fin.y,
    startX: penA.x,
    fallY: floorY - 2.2,
    rescue: split.rescue,
    goal: { x0: fin.x - 1.15, x1: fin.x + 0.55, y0: fin.y - 0.4, y1: fin.y + 0.85, zMax: 1.5 },
  };
}
