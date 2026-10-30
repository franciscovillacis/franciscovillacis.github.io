import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';

// The standalone explorer ships its geometry inside the inline bundle. Exercise
// that exact, DOM-independent geometry code rather than a second implementation.
const html = readFileSync(new URL('../public/visualizations/grassmannian-explorer/index.html', import.meta.url), 'utf8');
const geometry = html.slice(html.indexOf('var Ou=2*Math.PI'), html.indexOf('var Mt='));
const { qu: preset, Yu: move, Zu: model, Xu: phase, Da: currentPhase, editableMomentCircuit: editable } =
  new Function(`${geometry}; return {qu, Yu, Zu, Xu, Da, editableMomentCircuit};`)();

function close(actual, expected, tolerance = 1e-8) {
  assert.equal(actual.length, expected.length);
  actual.forEach((value, index) => assert.ok(Math.abs(value - expected[index]) < tolerance,
    `${value} differs from ${expected[index]}`));
}

function sameImage(a, b) {
  close(a.center, b.center);
  // M M^T describes the image independently of the chosen basis of the plane.
  const covariance = ({ M }) => M.flatMap(row => M.map(other => row.reduce((sum, value, i) => sum + value * other[i], 0)));
  close(covariance(a), covariance(b));
}

test('every shell circuit can reach an edge, be released, and return to its face', () => {
  const initial = preset('shell');
  const shell = model(initial);
  for (const circuit of shell.circuits) {
    for (const zero of circuit.support) {
      const target = circuit.point.map((value, index) => index === zero ? 0 : value / (1 - circuit.point[zero]));
      const boundary = move(initial, circuit.id, target);
      const ellipse = model(boundary);
      assert.equal(ellipse.rank, 2);
      assert.equal(ellipse.circuits.length, 3);
      const edge = ellipse.circuits.find(point => point.id === boundary.movedCircuitId);
      assert.equal(edge.support.length, 2);
      const handle = editable(boundary, edge);
      assert.deepEqual(handle.support, circuit.support);
      assert.deepEqual(handle.actualSupport, edge.support);
      close(edge.point, target);

      // A new gesture starts from the boundary state and the new, shorter ID.
      const restored = model(move(structuredClone(boundary), edge.id, circuit.point));
      assert.equal(restored.rank, 3);
      assert.equal(restored.circuits.length, 4);
      sameImage(restored, shell);
    }
  }
});

test('retreat also works after a circuit reaches a vertex', () => {
  const initial = preset('shell');
  for (const circuit of model(initial).circuits) {
    const target = circuit.point.map((_, index) => index === circuit.support[0] ? 1 : 0);
    const boundary = move(initial, circuit.id, target);
    const restored = model(move(boundary, boundary.movedCircuitId, circuit.point));
    assert.equal(restored.rank, 3);
    sameImage(restored, model(initial));
  }
});

test('returning from a boundary preserves real and complex phase choices', () => {
  for (const value of [0, 0.15, 0.5, 0.85, 1]) {
    const initial = phase(preset('shell'), value);
    const circuit = model(initial).circuits.find(point => point.id === 'p134');
    const target = circuit.point.map((coordinate, index) => index === 0 ? 0 : coordinate / (1 - circuit.point[0]));
    const boundary = move(initial, circuit.id, target);
    const restored = model(move(boundary, boundary.movedCircuitId, circuit.point));
    assert.equal(restored.rank, model(initial).rank);
    sameImage(restored, model(initial));
  }
});

test('the three-contact preset exposes a phase without changing the current image', () => {
  const ellipse = preset('collision');
  assert.equal(model(ellipse).phaseAdjustable, true);
  sameImage(model(phase(ellipse, currentPhase(ellipse))), model(ellipse));
  assert.equal(model(phase(ellipse, 0.4)).rank, 3);
});

test('moving an edge contact of a flattened shell does not lock the phase', () => {
  const flattened = phase(preset('shell'), 0);
  const edge = model(flattened).circuits.find(point => point.support.length === 2);
  const target = [...edge.point];
  target[edge.support[0]] += 0.1;
  target[edge.support[1]] -= 0.1;
  const moved = move(flattened, edge.id, target);
  assert.equal(model(moved).rank, 2);
  assert.equal(model(moved).phaseAdjustable, true);
  sameImage(model(phase(moved, currentPhase(moved))), model(moved));
  assert.equal(model(phase(moved, 0.4)).rank, 3);
});

test('phase endpoints remain reversible and genuine line/edge presets stay fixed', () => {
  for (const endpoint of [0, 1]) {
    const flat = phase(preset('shell'), endpoint);
    assert.equal(model(flat).rank, 2);
    assert.equal(model(phase(flat, 0.4)).rank, 3);
  }
  for (const name of ['segment', 'edge']) {
    assert.equal(model(preset(name)).phaseAdjustable, false);
    assert.equal(model(phase(preset(name), 0.4)).rank, 1);
  }
});
