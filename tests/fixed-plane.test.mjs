import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';

const explorer = new URL('../public/visualizations/grassmannian-explorer/', import.meta.url);
const html = readFileSync(new URL('index.html', explorer), 'utf8');
const geometry = html.slice(html.indexOf('var Ou=2*Math.PI'), html.indexOf('var Mt='));
const api = new Function(geometry + ';return {basis:Hu,circuits:Wu,editable:editableMomentCircuit,move:Yu,phase:Xu,currentPhase:Da,phaseBasis:dc,preset:qu}')();
const globals = {};
new Function('window', readFileSync(new URL('fixed-plane.js', explorer), 'utf8'))(globals);
const solver = globals.createFixedPlaneSolver(api);
const points = state => api.circuits(...api.basis(state));
const circuit = (state,id) => points(state).find(p=>p.id===id);
const distance = (p,q) => Math.hypot(...p.map((x,i)=>x-q[i]));
function assertPin(state, pin) {
  const point = circuit(state,pin.id);
  assert.ok(point && distance(point.point,pin.point)<2e-8, pin.id+' moved');
}
function eachPair(values) {
  return values.flatMap((a,i)=>values.slice(i+1).map(b=>[a,b]));
}

test('a single fixed face allows every other face to move in its interior', () => {
  const initial=api.preset('shell');
  for(const fixed of points(initial)) {
    for (const dragged of points(initial).filter(p=>p.id!==fixed.id)) {
      const desired=dragged.point.map((x,i)=>x*([1.3,1.1,.75,1][i]));
      const total=desired.reduce((s,x)=>s+x);
      const result=solver.move(initial,dragged.id,desired.map(x=>x/total),[fixed]);
      assert.equal(result.blocked,false);
      assert.equal(result.limited,false);
      assertPin(result.state,fixed);
      assert.ok(distance(circuit(result.state,dragged.id).point,desired.map(x=>x/total))<2e-8);
    }
  }
});

test('with p123 and p124 fixed, p134 moves along its feasible interval and stops at its endpoint', () => {
  const state=api.preset('shell'), pins=['p123','p124'].map(id=>circuit(state,id));
  for(const [target,expected] of [
    [[.5,0,.25,.25],[.5,0,.25,.25]],
    [[.5,0,.4,.1],[.5,0,.25,.25]],
    [[1,0,0,0],[2/3,0,1/6,1/6]]
  ]) {
    const moved=solver.move(state,'p134',target,pins);
    assert.equal(moved.blocked,false);
    assert.ok(distance(circuit(moved.state,'p134').point,expected)<2e-8);
    assert.equal(moved.limited,distance(target,expected)>2e-8);
    pins.forEach(p=>assertPin(moved.state,p));
  }
  const ends=solver.locus(state,'p134',pins);
  assert.ok(ends.some(e=>distance(e,[2/3,0,1/6,1/6])<1e-8));
});

test('new gestures can leave a collapsed contact while keeping both fixed circuits', () => {
  const state=api.preset('shell'), pins=['p123','p124'].map(id=>circuit(state,id));
  const collapse=solver.move(state,'p134',[0,0,.5,.5],pins);
  assert.equal(collapse.blocked,false);
  assert.equal(collapse.state.movedCircuitId,'p34');
  const original=circuit(state,'p134');
  const restore=solver.move(collapse.state,'p34',original.point,pins);
  assert.equal(restore.blocked,false);
  assert.equal(restore.state.movedCircuitId,'p134');
  assertPin(restore.state,original);
  pins.forEach(p=>assertPin(restore.state,p));
});

test('switching to a pinned pair’s phase chart preserves every circuit and permits its phase variation',()=>{
  const state=api.preset('shell');
  for(const pins of eachPair(points(state))) {
    const chart=solver.preparePhase(state,pins);
    points(state).forEach(p=>assertPin(chart,p));
    assert.equal(solver.canChangePhase(state,pins),true);
    const angle=api.currentPhase(chart);
    const moved=solver.phase(state,angle < .45 ? .72 : .31,pins);
    assert.equal(moved.blocked,false);
    pins.forEach(p=>assertPin(moved.state,p));
    assert.ok(Math.abs(api.currentPhase(moved.state)-(angle < .45 ? .72 : .31))<2e-8);
  }
});

test('three independent fixed positions determine the remaining circuit',()=>{
  const state=api.preset('shell'), original=points(state);
  for(const free of original) {
    const pins=original.filter(p=>p.id!==free.id);
    assert.equal(solver.canChangePhase(state,pins),false);
    assert.equal(solver.canMove(state,free.id,pins),false);
    const result=solver.move(state,free.id,free.point.map((x,i)=>x*(i+1)),pins);
    assert.equal(result.blocked,true);
    assert.equal(result.state,state);
  }
});

test('fixing the independent contacts of a segment preserves the segment',()=>{
  const state=api.preset('segment'), pins=points(state);
  assert.equal(solver.canChangePhase(state,pins),false);
  for(const p of pins) {
    assert.equal(solver.canMove(state,p.id,pins),false);
    assert.equal(solver.move(state,p.id,p.point,pins).state,state);
  }
});

test('the merged contact in the three-contact preset can be dragged onto a feasible face',()=>{
  const state=api.preset('collision'), all=points(state);
  const pins=all.filter(p=>p.support.length===3);
  const free=all.find(p=>p.support.length===2);
  const handle=solver.editable(state,free,pins);
  assert.equal(handle.support.length,3);
  const interval=solver.locus(state,free.id,pins);
  const middle=interval[0].map((x,i)=>(x+interval[1][i])/2);
  const moved=solver.move(state,free.id,middle,pins);
  assert.equal(moved.blocked,false);
  assert.equal(moved.limited,false);
  assert.ok(distance(circuit(moved.state,moved.state.movedCircuitId).point,middle)<2e-8);
  pins.forEach(p=>assertPin(moved.state,p));
});
