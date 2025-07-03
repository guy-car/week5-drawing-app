class StubPath {
  constructor() { this.cmds = []; console.log('StubPath instance created'); }
  moveTo(x, y) { this.cmds.push(['M', x, y]); console.log('moveTo called with:', x, y); }
  lineTo(x, y) { this.cmds.push(['L', x, y]); console.log('lineTo called with:', x, y); }
  quadTo(...a) { this.cmds.push(['Q', ...a]); console.log('quadTo called with:', a); }
  cubicTo(...a) { this.cmds.push(['B', ...a]); console.log('cubicTo called with:', a); }
  addCircle(cx, cy, r) { this.cmds.push(['C', cx, cy, r]); console.log('addCircle called with:', cx, cy, r); }
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