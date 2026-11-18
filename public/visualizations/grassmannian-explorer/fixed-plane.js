// In Gr(3,4) a circuit is the moment image of a vector in the complex
// two-plane. Two distinct circuits give independent vectors spanning it.
window.createFixedPlaneSolver = function createFixedPlaneSolver(geometry) {
  const indices = [0, 1, 2, 3];
  const tolerance = 2e-8;
  const distance = (p, q) => Math.hypot(...p.map((x, i) => x - q[i]));
  const contacts = state => geometry.circuits(...geometry.basis(state));
  const matches = (points, pin) => points.some(p => p.id === pin.id && distance(p.point, pin.point) < tolerance);
  const valid = (points, pins) => pins.every(pin => matches(points, pin));
  const blocked = state => ({state, blocked: true, limited: false});
  const normalized = v => {
    const sum = v.reduce((s, x) => s + x, 0);
    return sum > 1e-20 ? v.map(x => x / sum) : null;
  };
  const phases = vector => vector.map(([x, y]) => {
    const norm = Math.hypot(x, y);
    return norm > 1e-12 ? [x / norm, y / norm] : [1, 0];
  });
  const overlap = (a, b) => a.support.filter(i => b.support.includes(i)).length;

  // Make the displayed angle the angle between the pinned face circuits,
  // choosing a second face through the existing plane when only one is fixed.
  function preparePhase(state, pins) {
    if (!pins.length) return state;
    const points = contacts(state);
    const fixed = points.filter(p => pins.some(pin => pin.id === p.id));
    const partners = fixed.length > 1 ? fixed : points;
    for (const a of fixed) {
      const b = partners.find(p => p.id !== a.id && overlap(a, p) === 2);
      if (b) return {...state, basis: [a.vector, b.vector]};
    }
    return state;
  }

  function phase(state, value, pins) {
    const chart = preparePhase(state, pins);
    if (geometry.phaseBasis(chart).overlap.length !== 2) return blocked(state);
    const candidate = geometry.phase(chart, value);
    if (!valid(contacts(candidate), pins)) return blocked(state);
    return {state: candidate, blocked: false, limited: false};
  }

  function canChangePhase(state, pins) {
    const chart = preparePhase(state, pins);
    if (geometry.phaseBasis(chart).overlap.length !== 2) return false;
    // Each circuit row is affine in cos(theta) before normalization. A
    // nonconstant row cannot take the same barycentric value twice.
    const probe = geometry.currentPhase(chart) < 0.5 ? 0.75 : 0.25;
    return valid(contacts(geometry.phase(chart, probe)), pins);
  }

  // The circuit obtained by killing coordinate r has entries equal (up to
  // a common factor) to the minors P_rj of the two spanning vectors.
  function rowVector(state, r) {
    const [a, b] = state.basis;
    return indices.map(j => {
      const [ar, ai] = a[r], [br, bi] = b[r];
      const [aj, ak] = a[j], [bj, bk] = b[j];
      return [ar * bj - ai * bk - br * aj + bi * ak,
        ar * bk + ai * bj - br * ak - bi * aj];
    });
  }
  function row(state, index) {
    const weights = rowVector(state, index).map(([x, y]) => x*x + y*y);
    return {point: normalized(weights), mass: weights.reduce((s, x) => s + x, 0)};
  }

  // With two fixed vectors only their common coordinates can carry relative
  // phases, and distinct minimal circuits overlap in at most two coordinates.
  // Modulo a diagonal unitary action this leaves at most one angle. Only the
  // minor of those two common coordinates can vary. Its squared magnitude is
  // affine in cos(theta), so every normalized circuit row traces a segment.
  function family(state, point, pins) {
    const points = contacts(state);
    const fixed = points.filter(p => pins.some(pin => pin.id === p.id));
    const a = fixed[0];
    const b = fixed.find(p => p.id !== a?.id && overlap(a, p) === 2);
    if (!b) return null; // Two pinned vectors with at most one shared entry determine the image.
    const chart = {...state, basis: [a.vector, b.vector]};
    const angle = geometry.currentPhase(chart);
    const probe = geometry.phase(chart, angle < 0.5 ? 0.75 : 0.25);
    if (!valid(contacts(probe), pins)) return null;
    const ends = [geometry.phase(chart, 0), geometry.phase(chart, 1)];
    const segments = [];
    for (const index of indices.filter(j => !point.support.includes(j))) {
      const current = row(chart, index).point;
      if (!current || distance(current, point.point) > tolerance) continue;
      const [start, end] = ends.map(s => row(s, index));
      if (start.point && end.point && distance(start.point, end.point) > tolerance) {
        segments.push({index, start, end});
      }
    }
    return {chart, angle, segments};
  }

  // At a merger, a single visible edge contact can split into two face
  // contacts. Prefer the face the user dragged from. For a preset with no
  // drag history choose the first outgoing face and highlight that branch.
  function editable(state, point, pins) {
    if (!point || pins.length < 2 || point.support.length === 3 ||
        pins.some(pin => pin.id === point.id)) return point;
    const segments = family(state, point, pins)?.segments || [];
    const supports = segments.map(({start, end}) =>
      indices.filter(i => Math.max(start.point[i], end.point[i]) > 1e-9));
    if (supports.some(s => s.every(i => point.support.includes(i)))) return point;
    const support = supports.find(s => point.support.every(i => s.includes(i)));
    return support ? {...point, actualSupport: point.actualSupport || point.support, support} : point;
  }
  function dragPoint(state, current, pins) {
    return editable(state, geometry.editable(state, current), pins);
  }

  function canMove(state, id, pins) {
    if (pins.some(p => p.id === id)) return false;
    const point = dragPoint(state, contacts(state).find(p => p.id === id), pins);
    if (!point || point.support.length < 2) return false;
    if (pins.length < 2) return true;
    return Boolean(family(state, point, pins)?.segments.length);
  }

  function verify(state, id, expected, pins) {
    const points = contacts(state);
    const actual = points.find(p => p.id === id);
    return actual && distance(actual.point, expected) < tolerance && valid(points, pins);
  }

  // When an exact endpoint would destroy a pinned circuit, stop on the
  // admissible side of the boundary. Always recheck the rendered contacts.
  function approach(at) {
    const end = at(1);
    if (end) return end;
    let lo = 0, hi = 1, best = null;
    for (let i = 0; i < 27; i++) {
      const mid = (lo + hi) / 2, candidate = at(mid);
      if (candidate) { lo = mid; best = candidate; }
      else hi = mid;
    }
    return best;
  }

  function move(state, id, target, pins) {
    if (!pins.length) return {state: geometry.move(state, id, target), blocked: false, limited: false};
    if (pins.some(p => p.id === id)) return blocked(state);
    const points = contacts(state);
    const current = points.find(p => p.id === id);
    const point = dragPoint(state, current, pins);
    if (!point || point.support.length < 2 || !valid(points, pins)) return blocked(state);
    const desired = normalized(indices.map(i => point.support.includes(i) ? Math.max(0, Number(target[i]) || 0) : 0));
    if (!desired) return blocked(state);
    if (distance(desired, point.point) < 1e-12) return {state, blocked: false, limited: false};
    let best = null;
    const consider = (next, actual) => {
      if (!next || distance(actual, point.point) < 1e-10) return;
      const error = distance(actual, desired);
      if (!best || error < best.error) best = {state: next, error};
    };

    if (pins.length === 1) {
      // Choose the pinned vector as the independent anchor. The moved vector
      // retains its entrywise phases, just as in an unconstrained drag.
      const anchor = points.find(p => p.id === pins[0].id);
      const base = {...state, basis: [anchor.vector, current.vector]};
      if (state.circuitContinuation?.id === id) {
        base.circuitContinuation = {...state.circuitContinuation, anchor};
      }
      const next = approach(t => {
        const p = desired.map((x, i) => point.point[i] + t * (x - point.point[i]));
        try {
          const candidate = geometry.move(base, id, p);
          if (verify(candidate, candidate.movedCircuitId, p, pins)) return candidate;
        } catch (error) {
          // A singular pair of spanning vectors may occur at an endpoint.
          if (error.message !== 'The two-plane needs two independent nonzero vectors.') throw error;
        }
        return null;
      });
      if (next) consider(next, pointsForMove(next));
    } else {
      const f = family(state, point, pins);
      if (!f) return blocked(state);
      for (const {index, start, end} of f.segments) {
        const direction = end.point.map((x, i) => x - start.point[i]);
        const dot = (u, v) => u.reduce((s, x, i) => s + x * v[i], 0);
        const t = Math.min(1, Math.max(0, dot(desired.map((x, i) => x - start.point[i]), direction) / dot(direction, direction)));
        // Convert normalized segment parameter to interpolation of unnormalized rows.
        const fraction = t * start.mass / ((1-t) * end.mass + t * start.mass);
        const requested = Math.acos(Math.min(1, Math.max(-1, 1 - 2*fraction))) / Math.PI;
        const next = approach(amount => {
          const angle = f.angle + amount * (requested - f.angle);
          const candidate = geometry.phase(f.chart, angle);
          const p = row(candidate, index).point;
          if (!p) return null;
          const support = indices.filter(j => p[j] > 1e-9);
          const movedId = 'p' + support.map(j => j + 1).join('');
          if (!verify(candidate, movedId, p, pins)) return null;
          candidate.movedCircuitId = movedId;
          candidate.movedPoint = p;
          candidate.anchorCircuitId = pins[0].id;
          if (support.length < point.support.length) {
            const probe = geometry.phase(f.chart, 0.5);
            const anchor = contacts(candidate).find(c => c.support.some(j => !point.support.includes(j)));
            if (anchor) candidate.circuitContinuation = {
              id: movedId, support: [...point.support], phases: phases(rowVector(probe, index)), anchor
            };
          }
          return candidate;
        });
        if (next) consider(next, next.movedPoint);
      }
    }
    return best ? {state: best.state, blocked: false, limited: best.error > tolerance} : blocked(state);
  }

  function pointsForMove(state) {
    return contacts(state).find(p => p.id === state.movedCircuitId).point;
  }
  function locus(state, id, pins) {
    if (pins.length < 2 || pins.some(p => p.id === id)) return null;
    const point = dragPoint(state, contacts(state).find(p => p.id === id), pins);
    const segments = point && family(state, point, pins)?.segments;
    return segments?.length === 1 ? [segments[0].start.point, segments[0].end.point] : null;
  }
  return {move, phase, canMove, canChangePhase, preparePhase, locus, editable};
};
