export const COLS = 10;
export const ROWS = 20;

export const PIECES = Object.freeze({
  I: {
    color: "#6bdbd2",
    matrix: [
      [0, 0, 0, 0],
      [1, 1, 1, 1],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  },
  O: {
    color: "#ffd34e",
    matrix: [
      [0, 1, 1, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  },
  T: {
    color: "#bd8cff",
    matrix: [
      [0, 1, 0, 0],
      [1, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  },
  S: {
    color: "#83dc78",
    matrix: [
      [0, 1, 1, 0],
      [1, 1, 0, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  },
  Z: {
    color: "#ff8173",
    matrix: [
      [1, 1, 0, 0],
      [0, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  },
  J: {
    color: "#73a4ff",
    matrix: [
      [1, 0, 0, 0],
      [1, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  },
  L: {
    color: "#ffad5c",
    matrix: [
      [0, 0, 1, 0],
      [1, 1, 1, 0],
      [0, 0, 0, 0],
      [0, 0, 0, 0],
    ],
  },
});

const TYPES = Object.keys(PIECES);
const SCORE_TABLE = [0, 100, 300, 500, 800];
const KICKS = [0, -1, 1, -2, 2];

export function cloneMatrix(matrix) {
  return matrix.map((row) => [...row]);
}

export function rotateMatrix(matrix, direction = 1) {
  const size = matrix.length;
  const result = Array.from({ length: size }, () => Array(size).fill(0));
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      if (direction > 0) result[y][x] = matrix[size - 1 - x][y];
      else result[y][x] = matrix[x][size - 1 - y];
    }
  }
  return result;
}

export class TetrisGame {
  constructor(random = Math.random) {
    this.random = random;
    this.reset();
  }

  reset() {
    this.board = Array.from({ length: ROWS }, () => Array(COLS).fill(null));
    this.score = 0;
    this.lines = 0;
    this.level = 1;
    this.state = "ready";
    this.holdType = null;
    this.holdUsed = false;
    this.queue = [];
    this.current = null;
    this.refillQueue();
    this.spawn();
  }

  start() {
    this.reset();
    this.state = "playing";
  }

  refillQueue() {
    const bag = [...TYPES];
    for (let index = bag.length - 1; index > 0; index -= 1) {
      const target = Math.floor(this.random() * (index + 1));
      [bag[index], bag[target]] = [bag[target], bag[index]];
    }
    this.queue.push(...bag);
  }

  nextType() {
    if (this.queue.length < 4) this.refillQueue();
    return this.queue.shift();
  }

  spawn(type = null) {
    const nextType = type ?? this.nextType();
    const shape = PIECES[nextType];
    this.current = {
      type: nextType,
      matrix: cloneMatrix(shape.matrix),
      x: 3,
      y: -1,
    };
    this.holdUsed = false;
    if (this.collides(this.current.matrix, this.current.x, this.current.y)) {
      this.state = "gameover";
      return false;
    }
    return true;
  }

  collides(matrix, x, y) {
    for (let row = 0; row < matrix.length; row += 1) {
      for (let col = 0; col < matrix[row].length; col += 1) {
        if (!matrix[row][col]) continue;
        const boardX = x + col;
        const boardY = y + row;
        if (boardX < 0 || boardX >= COLS || boardY >= ROWS) return true;
        if (boardY >= 0 && this.board[boardY][boardX]) return true;
      }
    }
    return false;
  }

  move(dx, dy = 0) {
    if (this.state !== "playing" || !this.current) return false;
    if (this.collides(this.current.matrix, this.current.x + dx, this.current.y + dy)) {
      return false;
    }
    this.current.x += dx;
    this.current.y += dy;
    return true;
  }

  step() {
    if (this.state !== "playing") return { moved: false, cleared: 0 };
    if (this.move(0, 1)) return { moved: true, cleared: 0 };
    const cleared = this.lock();
    return { moved: false, cleared };
  }

  hardDrop() {
    if (this.state !== "playing" || !this.current) return { distance: 0, cleared: 0 };
    let distance = 0;
    while (this.move(0, 1)) distance += 1;
    this.score += distance * 2;
    const cleared = this.lock();
    return { distance, cleared };
  }

  rotate(direction = 1) {
    if (this.state !== "playing" || !this.current) return false;
    const rotated = rotateMatrix(this.current.matrix, direction);
    for (const kick of KICKS) {
      if (!this.collides(rotated, this.current.x + kick, this.current.y)) {
        this.current.matrix = rotated;
        this.current.x += kick;
        return true;
      }
    }
    return false;
  }

  hold() {
    if (this.state !== "playing" || !this.current || this.holdUsed) return false;
    const currentType = this.current.type;
    const storedType = this.holdType;
    this.holdType = currentType;
    this.spawn(storedType);
    this.holdUsed = true;
    return true;
  }

  ghostY() {
    if (!this.current) return 0;
    let y = this.current.y;
    while (!this.collides(this.current.matrix, this.current.x, y + 1)) y += 1;
    return y;
  }

  lock() {
    if (!this.current) return 0;
    let blocked = false;
    for (let row = 0; row < this.current.matrix.length; row += 1) {
      for (let col = 0; col < this.current.matrix[row].length; col += 1) {
        if (!this.current.matrix[row][col]) continue;
        const boardX = this.current.x + col;
        const boardY = this.current.y + row;
        if (boardY < 0) blocked = true;
        else this.board[boardY][boardX] = this.current.type;
      }
    }

    const cleared = this.clearLines();
    if (blocked) {
      this.state = "gameover";
      return cleared;
    }
    this.spawn();
    return cleared;
  }

  clearLines() {
    const remaining = this.board.filter((row) => row.some((cell) => !cell));
    const cleared = ROWS - remaining.length;
    if (!cleared) return 0;
    while (remaining.length < ROWS) remaining.unshift(Array(COLS).fill(null));
    this.board = remaining;
    this.lines += cleared;
    this.score += SCORE_TABLE[cleared] * this.level;
    this.level = Math.floor(this.lines / 10) + 1;
    return cleared;
  }

  gravityMs() {
    return Math.max(90, 820 - (this.level - 1) * 68);
  }
}
