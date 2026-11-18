import test from 'node:test';
import assert from 'node:assert/strict';
import {
  clampDockSettings,
  computeDockIconTransforms,
  computeProximityIntensity,
  DEFAULT_DOCK_SETTINGS,
  stepSpring,
  writeDockIconTargets,
} from './dockPhysics';

test('computeProximityIntensity returns 1 at zero distance, 0.5 at half radius, and 0 beyond radius', () => {
  assert.equal(computeProximityIntensity(0, 150), 1);
  assert.equal(computeProximityIntensity(150, 150), 0);
  assert.equal(computeProximityIntensity(240, 150), 0);
  const mid = computeProximityIntensity(75, 150);
  assert.ok(Math.abs(mid - 0.5) < 1e-9);
});

test('computeDockIconTransforms returns neutral transforms when pointerX is null', () => {
  const result = computeDockIconTransforms({
    count: 8,
    baseSize: 84,
    gap: 13,
    pointerX: null,
    settings: DEFAULT_DOCK_SETTINGS,
  });

  assert.equal(result.length, 8);
  for (const item of result) {
    assert.equal(item.scale, 1);
    assert.equal(item.translateY, 0);
    assert.equal(item.zIndex, 3);
    assert.equal(item.intensity, 0);
  }
});

test('computeDockIconTransforms peaks on hovered icon with smooth neighbor falloff', () => {
  const baseSize = 84;
  const gap = 13;
  const step = baseSize + gap;
  const hoveredIndex = 3;
  const pointerX = hoveredIndex * step + baseSize / 2;

  const result = computeDockIconTransforms({
    count: 8,
    baseSize,
    gap,
    pointerX,
    settings: DEFAULT_DOCK_SETTINGS,
  });

  // Hovered icon reaches max magnification, lift, and top z-index
  assert.ok(Math.abs(result[hoveredIndex].scale - DEFAULT_DOCK_SETTINGS.magnification) < 1e-6);
  assert.ok(Math.abs(result[hoveredIndex].translateY + DEFAULT_DOCK_SETTINGS.maxLift) < 1e-6);
  assert.equal(result[hoveredIndex].zIndex, 13);

  // Adjacent neighbors scale smoothly less than hovered icon and more than distant icons
  assert.ok(result[hoveredIndex - 1].scale > result[0].scale);
  assert.ok(result[hoveredIndex + 1].scale > result[7].scale);
  assert.ok(result[hoveredIndex].scale > result[hoveredIndex - 1].scale);
});

test('writeDockIconTargets matches computeDockIconTransforms without allocating', () => {
  const baseSize = 84;
  const gap = 13;
  const pointerX = 280;
  const expected = computeDockIconTransforms({
    count: 8,
    baseSize,
    gap,
    pointerX,
    settings: DEFAULT_DOCK_SETTINGS,
  });

  const outScales = new Array(8).fill(1);
  const outLifts = new Array(8).fill(0);
  const outZIndices = new Array(8).fill(3);

  writeDockIconTargets({
    count: 8,
    baseSize,
    gap,
    pointerX,
    settings: DEFAULT_DOCK_SETTINGS,
    outScales,
    outLifts,
    outZIndices,
  });

  for (let i = 0; i < 8; i++) {
    assert.ok(Math.abs(outScales[i] - expected[i].scale) < 1e-9);
    assert.ok(Math.abs(outLifts[i] - expected[i].translateY) < 1e-9);
    assert.equal(outZIndices[i], expected[i].zIndex);
  }
});

test('stepSpring converges smoothly to target and preserves continuous velocity on reversal', () => {
  let x = 1;
  let v = 0;

  // Accelerate toward 1.30
  for (let frame = 0; frame < 6; frame++) {
    const res = stepSpring(x, v, 1.3, 1 / 60);
    x = res.value;
    v = res.velocity;
  }
  assert.ok(x > 1.05 && x < 1.3);
  assert.ok(v > 0);

  // Reverse target to 1.0 mid-flight: velocity should decelerate smoothly rather than teleporting
  const rev = stepSpring(x, v, 1.0, 1 / 60);
  assert.ok(rev.velocity < v);

  // Run until settled
  let settled = false;
  for (let frame = 0; frame < 90; frame++) {
    const res = stepSpring(x, v, 1.0, 1 / 60);
    x = res.value;
    v = res.velocity;
    if (res.settled) {
      settled = true;
      break;
    }
  }
  assert.equal(settled, true);
  assert.equal(x, 1.0);
  assert.equal(v, 0);
});

test('clampDockSettings enforces safe bounds', () => {
  const clamped = clampDockSettings({
    magnification: 5.0,
    influenceRadius: 10,
    maxLift: -12,
    reflectionOpacity: 2.5,
    enableBounce: false,
  });
  assert.equal(clamped.magnification, 1.55);
  assert.equal(clamped.influenceRadius, 90);
  assert.equal(clamped.maxLift, 0);
  assert.equal(clamped.reflectionOpacity, 0.95);
  assert.equal(clamped.enableBounce, false);
});
