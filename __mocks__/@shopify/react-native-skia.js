class StubPath {
  constructor() { this.cmds = []; }
  moveTo(x, y) { this.cmds.push(['M', x, y]); }
  lineTo(x, y) { this.cmds.push(['L', x, y]); }
  quadTo(...a) { this.cmds.push(['Q', ...a]); }
  cubicTo(...a) { this.cmds.push(['B', ...a]); }
  addCircle(cx, cy, r) { this.cmds.push(['C', cx, cy, r]); }
  toJSON() { return this.cmds; }
}

module.exports = {
  Skia: { Path: { Make: () => new StubPath() } },
  Path: () => null,
  Canvas: () => null,
  Rect: () => null,
  Group: () => null,
  useCanvasRef: () => ({ current: { makeImageSnapshot: () => ({ encodeToBytes: () => [] }) } }),
}; 