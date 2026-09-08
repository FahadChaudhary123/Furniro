import { describe, it, expect } from 'vitest';
import { addLine, setLineQuantity, removeLine, MAX_LINE_QUANTITY } from './storage.js';

/**
 * Cart line reducers.
 *
 * These are pure and they guard money-adjacent behaviour, so they are worth testing
 * directly rather than through a browser: quantity clamping, merging rather than
 * duplicating, and never producing a line that cannot be rendered.
 *
 * `loadCart`/`saveCart` touch localStorage and are covered end-to-end instead — including
 * the tampering case, which needs a real browser to be meaningful.
 */

describe('addLine', () => {
  it('adds a new line', () => {
    expect(addLine([], 'syltherine')).toEqual([{ slug: 'syltherine', quantity: 1 }]);
  });

  it('merges into an existing line rather than duplicating it', () => {
    const once = addLine([], 'syltherine');
    expect(addLine(once, 'syltherine')).toEqual([{ slug: 'syltherine', quantity: 2 }]);
  });

  it('keeps unrelated lines untouched and ordered', () => {
    const lines = addLine(addLine([], 'a'), 'b');
    expect(addLine(lines, 'a')).toEqual([
      { slug: 'a', quantity: 2 },
      { slug: 'b', quantity: 1 },
    ]);
  });

  it('does not mutate the input', () => {
    const before = [{ slug: 'a', quantity: 1 }];
    const snapshot = structuredClone(before);
    addLine(before, 'a');
    addLine(before, 'b');
    expect(before).toEqual(snapshot);
  });

  it('clamps to the maximum quantity', () => {
    const [line] = addLine([], 'a', 10_000);
    expect(line.quantity).toBe(MAX_LINE_QUANTITY);
  });

  it('ignores a non-positive quantity for a new line', () => {
    expect(addLine([], 'a', 0)).toEqual([]);
    expect(addLine([], 'a', -5)).toEqual([]);
  });

  it('truncates a fractional quantity', () => {
    // A quantity of 2.7 chairs is not orderable.
    expect(addLine([], 'a', 2.7)).toEqual([{ slug: 'a', quantity: 2 }]);
  });
});

describe('setLineQuantity', () => {
  const lines = [{ slug: 'a', quantity: 3 }, { slug: 'b', quantity: 1 }];

  it('sets an absolute quantity', () => {
    expect(setLineQuantity(lines, 'a', 7)).toEqual([
      { slug: 'a', quantity: 7 },
      { slug: 'b', quantity: 1 },
    ]);
  });

  it('removes the line when set to zero', () => {
    // The cart page's number input allows 0; it must mean "remove", not "a line of nothing".
    expect(setLineQuantity(lines, 'a', 0)).toEqual([{ slug: 'b', quantity: 1 }]);
  });

  it('removes the line when set to a negative number', () => {
    expect(setLineQuantity(lines, 'a', -3)).toEqual([{ slug: 'b', quantity: 1 }]);
  });

  it('clamps to the maximum', () => {
    expect(setLineQuantity(lines, 'a', 1000)[0].quantity).toBe(MAX_LINE_QUANTITY);
  });

  it('is a no-op for a slug that is not present', () => {
    expect(setLineQuantity(lines, 'missing', 5)).toEqual(lines);
  });
});

describe('removeLine', () => {
  it('removes only the named line', () => {
    const lines = [{ slug: 'a', quantity: 1 }, { slug: 'b', quantity: 2 }];
    expect(removeLine(lines, 'a')).toEqual([{ slug: 'b', quantity: 2 }]);
  });

  it('is a no-op for an absent slug', () => {
    const lines = [{ slug: 'a', quantity: 1 }];
    expect(removeLine(lines, 'zzz')).toEqual(lines);
  });

  it('empties cleanly', () => {
    expect(removeLine([{ slug: 'a', quantity: 1 }], 'a')).toEqual([]);
  });
});

describe('what a line may contain', () => {
  it('never carries anything but slug and quantity', () => {
    // The decision in docs/decisions/0007: a cart holding its own price shows yesterday's
    // price after a repricing. Assert the shape so nothing creeps in.
    const lines = setLineQuantity(addLine(addLine([], 'a'), 'b'), 'a', 4);
    for (const line of lines) {
      expect(Object.keys(line).sort()).toEqual(['quantity', 'slug']);
    }
  });
});
