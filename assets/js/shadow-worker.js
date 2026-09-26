// Geometry runs in a local metric frame (x east, y north, metres) around `origin`.
const MAX_SHADOW_M = 900;
const RAD = Math.PI / 180;

let origin = null;
let kx = 1;
let ky = 1;
let buildings = [];
let maxH = 1;
let pois = [];

function ringArea(r) {
  let a = 0;
  for (let i = 0, n = r.length; i < n; i += 2) {
    const j = (i + 2) % n;
    a += r[i] * r[j + 1] - r[j] * r[i + 1];
  }
  return a / 2;
}

function prepare(raw) {
  return raw.map((b) => {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    const rings = b.rings.map((r, idx) => {
      for (let i = 0; i < r.length; i += 2) {
        if (r[i] < minX) minX = r[i];
        if (r[i] > maxX) maxX = r[i];
        if (r[i + 1] < minY) minY = r[i + 1];
        if (r[i + 1] > maxY) maxY = r[i + 1];
      }
      // +1 when the solid lies to the left of each edge.
      const ccw = ringArea(r) > 0;
      return { pts: r, solidLeft: idx === 0 ? ccw : !ccw };
    });
    return { rings, h: b.h, minH: b.minH, minX, minY, maxX, maxY };
  });
}

const toLngLat = (x, y) => [origin[0] + x / kx, origin[1] + y / ky];

function shadowGeoJSON(az, alt) {
  const features = [];
  if (alt <= 0.5) return { type: 'FeatureCollection', features };
  const k = 1 / Math.tan(alt * RAD);
  const ux = -Math.sin(az * RAD);
  const uy = -Math.cos(az * RAD);

  for (const b of buildings) {
    const v0 = Math.min(b.minH * k, MAX_SHADOW_M);
    const v1 = Math.min(b.h * k, MAX_SHADOW_M);
    if (v1 - v0 < 0.3) continue;
    const sx = ux * v0;
    const sy = uy * v0;
    const ex = ux * v1;
    const ey = uy * v1;
    const polys = [];

    polys.push(
      b.rings.map(({ pts }) => {
        const ring = [];
        for (let i = 0; i < pts.length; i += 2) ring.push(toLngLat(pts[i] + sx, pts[i + 1] + sy));
        ring.push(ring[0]);
        return ring;
      }),
    );

    for (const { pts, solidLeft } of b.rings) {
      const n = pts.length;
      for (let i = 0; i < n; i += 2) {
        const j = (i + 2) % n;
        const ax = pts[i];
        const ay = pts[i + 1];
        const bx = pts[j];
        const by = pts[j + 1];
        const dx = bx - ax;
        const dy = by - ay;
        // Outward normal of the solid: right of the edge when the solid is on the left.
        const nx = solidLeft ? dy : -dy;
        const ny = solidLeft ? -dx : dx;
        if (nx * ux + ny * uy <= 0) continue;
        const a0 = toLngLat(ax + sx, ay + sy);
        polys.push([[a0, toLngLat(bx + sx, by + sy), toLngLat(bx + ex, by + ey), toLngLat(ax + ex, ay + ey), a0]]);
      }
    }
    features.push({ type: 'Feature', properties: {}, geometry: { type: 'MultiPolygon', coordinates: polys } });
  }
  return { type: 'FeatureCollection', features };
}

function pointInRing(x, y, pts) {
  let inside = false;
  for (let i = 0, n = pts.length, j = n - 2; i < n; j = i, i += 2) {
    const xi = pts[i];
    const yi = pts[i + 1];
    const xj = pts[j];
    const yj = pts[j + 1];
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside;
  }
  return inside;
}

function containingBuilding(x, y) {
  for (const b of buildings) {
    if (x < b.minX || x > b.maxX || y < b.minY || y > b.maxY) continue;
    if (!pointInRing(x, y, b.rings[0].pts)) continue;
    let inHole = false;
    for (let r = 1; r < b.rings.length; r++) if (pointInRing(x, y, b.rings[r].pts)) inHole = true;
    if (!inHole) return b;
  }
  return null;
}

// Moves a point that lies inside a footprint to just outside its nearest facade.
function toFacade(x, y) {
  const b = containingBuilding(x, y);
  if (!b) return { x, y, moved: false };
  let best = null;
  for (const { pts, solidLeft } of b.rings) {
    for (let i = 0, n = pts.length; i < n; i += 2) {
      const j = (i + 2) % n;
      const ax = pts[i];
      const ay = pts[i + 1];
      const dx = pts[j] - ax;
      const dy = pts[j + 1] - ay;
      const len2 = dx * dx + dy * dy || 1;
      const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / len2));
      const px = ax + dx * t;
      const py = ay + dy * t;
      const d = (px - x) ** 2 + (py - y) ** 2;
      if (!best || d < best.d) {
        const len = Math.sqrt(len2);
        const nx = (solidLeft ? dy : -dy) / len;
        const ny = (solidLeft ? -dx : dx) / len;
        best = { d, x: px + nx * 1.5, y: py + ny * 1.5 };
      }
    }
  }
  return { x: best.x, y: best.y, moved: true, building: b };
}

function inShade(x, y, az, alt) {
  if (alt <= 0) return true;
  const tanAlt = Math.tan(alt * RAD);
  const dx = Math.sin(az * RAD);
  const dy = Math.cos(az * RAD);
  const reach = Math.min(MAX_SHADOW_M, maxH / tanAlt);
  const ex = x + dx * reach;
  const ey = y + dy * reach;
  const minX = Math.min(x, ex);
  const maxX = Math.max(x, ex);
  const minY = Math.min(y, ey);
  const maxY = Math.max(y, ey);

  for (const b of buildings) {
    if (b.maxX < minX || b.minX > maxX || b.maxY < minY || b.minY > maxY) continue;
    for (const { pts } of b.rings) {
      for (let i = 0, n = pts.length; i < n; i += 2) {
        const j = (i + 2) % n;
        const ax = pts[i];
        const ay = pts[i + 1];
        const sx = pts[j] - ax;
        const sy = pts[j + 1] - ay;
        const denom = dx * sy - dy * sx;
        if (Math.abs(denom) < 1e-9) continue;
        const qx = ax - x;
        const qy = ay - y;
        const t = (qx * sy - qy * sx) / denom;
        const u = (qx * dy - qy * dx) / denom;
        if (t <= 0.05 || t > reach || u < 0 || u > 1) continue;
        const rayH = t * tanAlt;
        if (rayH < b.h && rayH >= b.minH) return true;
      }
    }
  }
  return false;
}

self.onmessage = ({ data }) => {
  switch (data.type) {
    case 'buildings': {
      origin = data.origin;
      kx = data.kx;
      ky = data.ky;
      buildings = prepare(data.buildings);
      maxH = buildings.reduce((m, b) => Math.max(m, b.h), 1);
      pois = data.pois.map((p) => ({ ...p, ...toFacade(p.x, p.y) }));
      break;
    }
    case 'shadows': {
      const geojson = shadowGeoJSON(data.az, data.alt);
      const poiSun = pois.map((p) => !inShade(p.x, p.y, data.az, data.alt));
      self.postMessage({ type: 'shadows', id: data.id, geojson, poiSun, buildingCount: buildings.length });
      break;
    }
    case 'sunhours': {
      const p = toFacade(data.x, data.y);
      const shade = data.samples.map((s) => inShade(p.x, p.y, s.az, s.alt));
      self.postMessage({ type: 'sunhours', id: data.id, shade, movedToFacade: p.moved, buildingHeight: p.building?.h ?? null });
      break;
    }
    default:
      break;
  }
};
