// On edge ij, x_i : x_j = w_j : w_i. Fixing that circuit fixes a
// weight ratio. Every connected group of fixed ratios can scale as a unit.
globalThis.createFixedWeightSolver = function ({ normalize, circuits, editable, move, finish }) {
  function movement(state, id, pins) {
    const weights = normalize(state.weights);
    const circuit = editable(state, circuits(weights).find(point => point.id === id));
    if (!circuit?.draggable || pins.some(pin => pin.id === id)) return null;

    const [left, right] = circuit.support;
    const groups = weights.map((_, i) => [i]);
    for (const { support } of pins) {
      const [a, b] = support;
      if (b === undefined) {
        // A fixed vertex requires its weight to stay zero.
        if (a === left || a === right) return null;
      } else if (groups[a] !== groups[b]) {
        const joined = [...groups[a], ...groups[b]];
        for (const i of joined) groups[i] = joined;
      }
    }

    if (groups[left] === groups[right]) return null;
    return { weights, left, right, leftGroup: groups[left], rightGroup: groups[right] };
  }

  function constrainedMove(state, id, target, pins = []) {
    if (!pins.length) {
      const next = move(state, id, target);
      return { state: next, blocked: next === state };
    }
    const edit = movement(state, id, pins);
    const rejected = { state, blocked: true };
    if (!edit) return rejected;
    const { weights, left, right, leftGroup, rightGroup } = edit;
    const xLeft = target[left], xRight = target[right];
    if (!Number.isFinite(xLeft + xRight) || xLeft < 0 || xRight < 0 || xLeft + xRight === 0) {
      return rejected;
    }

    // Keep the combined mass of the two groups constant. Within each group
    // the endpoint's share is determined by its fixed ratios. A singleton
    // has unit share, even when it is reopening from a zero weight.
    const mass = group => group.reduce((sum, i) => sum + weights[i], 0);
    const pairMass = mass(leftGroup) + mass(rightGroup);
    const leftShare = leftGroup.length === 1 ? 1 : weights[left] / mass(leftGroup);
    const rightShare = rightGroup.length === 1 ? 1 : weights[right] / mass(rightGroup);
    const scale = pairMass / (xRight / leftShare + xLeft / rightShare);
    const next = [...weights];
    function setGroup(group, endpoint, newWeight) {
      if (group.length === 1) next[endpoint] = newWeight;
      else for (const i of group) next[i] = (weights[i] / weights[endpoint]) * newWeight;
    }
    setGroup(leftGroup, left, xRight * scale);
    setGroup(rightGroup, right, xLeft * scale);

    const nextWeights = normalize(next);
    // A requested interior point must still be on the edge after rounding.
    if ((xLeft > 0 && nextWeights[right] === 0) ||
        (xRight > 0 && nextWeights[left] === 0)) return rejected;
    // Endpoints may remove whole groups, and the model rounds very small
    // weights to zero. Verify the actual rendered circuits after normalization.
    const result = circuits(nextWeights);
    for (const pin of pins) {
      const kept = result.find(point => point.id === pin.id);
      if (!kept || !pin.point.every((x, i) => Math.abs(x - kept.point[i]) <= 1e-10)) {
        return rejected;
      }
    }
    return { state: finish(state, left, right, nextWeights), blocked: false };
  }

  return {
    canMove: (state, id, pins = []) => movement(state, id, pins) !== null,
    move: constrainedMove
  };
};
