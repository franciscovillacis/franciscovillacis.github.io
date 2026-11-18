import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import test from 'node:test';
import '../public/visualizations/grassmannian-explorer/fixed-weights.js';

const html = readFileSync(new URL('../public/visualizations/grassmannian-explorer/index.html', import.meta.url), 'utf8');
const geometry = html.slice(html.indexOf('var Ms=2*Math.PI'), html.indexOf('var Ou=2*Math.PI'));
const api = new Function(`${geometry}; return {
  normalize: Ia, circuits: s0, editable: editableWeightCircuit, move: Uu, finish: finishWeightMove
};`)();
const solver = globalThis.createFixedWeightSolver(api);
const state = weights => ({ weights: api.normalize(weights) });
const point = (s, id) => api.circuits(s.weights).find(circuit => circuit.id === id);

function close(actual, expected) {
  assert.ok(actual?.length === expected.length);
  actual.forEach((value, i) => assert.ok(Math.abs(value - expected[i]) < 1e-10));
}

test('Gr(2,3): fixing p12 rescales both weights while p13 moves', () => {
  const start = state([1, 2, 3]);
  const pin = point(start, 'p12');
  const next = solver.move(start, 'p13', [0.8, 0, 0.2], [pin]);
  assert.equal(next.blocked, false);
  close(next.state.weights, [1, 2, 4].map(x => x / 7));
  close(point(next.state, 'p12').point, pin.point);
  close(point(next.state, 'p13').point, [0.8, 0, 0.2]);
});

test('Gr(2,3): pinned ratios rule out indirect motion and a vanishing contact', () => {
  const start = state([1, 2, 3]);
  const pin = point(start, 'p12');
  const pins = [pin, point(start, 'p23')];
  for (const id of ['p12', 'p23', 'p13']) {
    assert.equal(solver.canMove(start, id, pins), false);
    const attempt = solver.move(start, id, [0.8, 0.1, 0.1], pins);
    assert.equal(attempt.blocked, true);
    assert.equal(attempt.state, start);
  }
  // Reaching e1 with p13 would remove the pinned p12.
  const endpoint = solver.move(start, 'p13', [1, 0, 0], [pin]);
  assert.equal(endpoint.blocked, true);
  assert.equal(endpoint.state, start);
});

test('Gr(2,3): a compatible vertex can be reached, released, pinned and later reopened', () => {
  const start = state([1, 2, 3]);
  const pin = point(start, 'p12');
  const original = point(start, 'p13').point;
  const boundary = solver.move(start, 'p13', [0, 0, 1], [pin]);
  assert.equal(boundary.blocked, false);
  assert.equal(boundary.state.movedCircuitId, 'p3');
  close(point(boundary.state, 'p12').point, pin.point);
  const vertex = point(boundary.state, 'p3');
  assert.equal(solver.canMove(boundary.state, 'p3', [pin, vertex]), false);
  assert.equal(solver.canMove(boundary.state, 'p3', [pin]), true);
  const back = solver.move(structuredClone(boundary.state), 'p3', original, [pin]);
  assert.equal(back.blocked, false);
  close(back.state.weights, start.weights);
});

test('Gr(2,4): a pair joining two pinned pairs can slide between their groups', () => {
  const start = state([1, 2, 3, 4]);
  const pins = ['p12', 'p34'].map(id => point(start, id));
  const next = solver.move(start, 'p13', [0.5, 0, 0.5, 0], pins);
  assert.equal(next.blocked, false);
  close(next.state.weights, [3, 6, 3, 4].map(x => x / 16));
  for (const pin of pins) close(point(next.state, pin.id).point, pin.point);
  for (const target of [[1, 0, 0, 0], [0, 0, 1, 0]]) {
    assert.equal(solver.move(next.state, 'p13', target, pins).blocked, true);
  }
});

test('Gr(2,4): fixed zero weights stay zero and a connected cycle still allows an outside pair to move', () => {
  const start = state([1, 2, 3, 4]);
  const pins = ['p12', 'p13', 'p23'].map(id => point(start, id));
  const boundary = solver.move(start, 'p24', [0, 0, 0, 1], pins);
  assert.equal(boundary.blocked, false);
  for (const pin of pins) close(point(boundary.state, pin.id).point, pin.point);
  const vertex = point(boundary.state, 'p4');
  assert.equal(solver.canMove(boundary.state, 'p4', [vertex]), false);
  const edit = solver.move(boundary.state, 'p23', [0, 0.8, 0.2, 0], [vertex]);
  assert.equal(edit.blocked, false);
  close(point(edit.state, 'p4').point, vertex.point);
  assert.equal(edit.state.weights[3], 0);
});

test('a small interior target cannot silently turn into a vertex', () => {
  const start = state([2e-10, 1e-10, 0.2, 0.8]);
  const pin = point(start, 'p34');
  const result = solver.move(start, 'p12', [0.001, 0.999, 0, 0], [pin]);
  assert.equal(result.blocked, true);
  assert.equal(result.state, start);
  assert.equal(solver.move(start, 'p12', [0, 1, 0, 0], [pin]).blocked, false);
});
