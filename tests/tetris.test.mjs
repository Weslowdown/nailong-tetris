import assert from "node:assert/strict";
import test from "node:test";

import {
  COLS,
  PIECES,
  ROWS,
  TetrisGame,
  rotateMatrix,
} from "../src/tetris.js";

test("defines the seven standard tetrominoes", () => {
  assert.deepEqual(Object.keys(PIECES).sort(), ["I", "J", "L", "O", "S", "T", "Z"]);
});

test("rotates a matrix clockwise", () => {
  const original = [
    [0, 1, 0, 0],
    [1, 1, 1, 0],
    [0, 0, 0, 0],
    [0, 0, 0, 0],
  ];
  const rotated = rotateMatrix(original, 1);
  const restored = rotateMatrix(rotateMatrix(rotateMatrix(rotated, 1), 1), 1);
  assert.notDeepEqual(rotated, original);
  assert.equal(rotated.flat().reduce((sum, value) => sum + value, 0), 4);
  assert.deepEqual(restored, original);
});

test("hard drop locks a piece and spawns another", () => {
  const game = new TetrisGame(() => 0.5);
  game.start();
  const firstType = game.current.type;
  const result = game.hardDrop();
  assert.ok(result.distance > 0);
  assert.ok(game.board.some((row) => row.includes(firstType)));
  assert.notEqual(game.current, null);
});

test("clears a completed row and awards points", () => {
  const game = new TetrisGame(() => 0.5);
  game.state = "playing";
  game.board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  game.board[ROWS - 1] = Array(COLS).fill("I");
  const cleared = game.clearLines();
  assert.equal(cleared, 1);
  assert.equal(game.lines, 1);
  assert.ok(game.score >= 100);
  assert.ok(game.board[0].every((cell) => cell === null));
});

test("cannot move through occupied cells", () => {
  const game = new TetrisGame(() => 0.5);
  game.start();
  game.board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
  game.current = {
    type: "O",
    matrix: PIECES.O.matrix.map((row) => [...row]),
    x: 0,
    y: 0,
  };
  game.board[0][1] = "T";
  assert.equal(game.move(-1, 0), false);
});
