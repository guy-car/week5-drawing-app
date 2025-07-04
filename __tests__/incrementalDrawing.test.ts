import { DrawingCommand } from '../src/api/openai/types';

// Mock the Skia module BEFORE importing anything that uses it
jest.mock('@shopify/react-native-skia', () => {
  class MockPath {
    cmds: any[] = [];
    moveTo(x: number, y: number) { this.cmds.push(['M', x, y]); }
    lineTo(x: number, y: number) { this.cmds.push(['L', x, y]); }
    quadTo(x1: number, y1: number, x2: number, y2: number) { this.cmds.push(['Q', x1, y1, x2, y2]); }
    cubicTo(x1: number, y1: number, x2: number, y2: number, x3: number, y3: number) { this.cmds.push(['B', x1, y1, x2, y2, x3, y3]); }
    addCircle(cx: number, cy: number, r: number) { this.cmds.push(['C', cx, cy, r]); }
    toJSON() { return this.cmds; }
  }
  
  return {
    Skia: { Path: { Make: () => new MockPath() } },
    Path: () => null,
    Canvas: () => null,
    Rect: () => null,
    Group: () => null,
    useCanvasRef: () => ({ current: { makeImageSnapshot: () => ({ encodeToBytes: () => new Uint8Array(5000) }) } }),
    ImageFormat: { JPEG: 'JPEG', PNG: 'PNG' }
  };
});

// NOW import buildPathFromCommands after the mock is set up
import { buildPathFromCommands } from '../components/pathBuilder';

test('buildPathFromCommands appends onto an existing path', () => {
  const first: DrawingCommand[] = [
    { type: 'moveTo', x: 0, y: 0 },
    { type: 'lineTo', x: 10, y: 0 },
  ];
  const second: DrawingCommand[] = [
    { type: 'lineTo', x: 10, y: 10 },
  ];

  const p1 = buildPathFromCommands(first);          // new path
  const p2 = buildPathFromCommands(second, p1);     // append to same path

  // Our Skia mock's toJSON() returns the command list
  expect(p2.toJSON()).toEqual([
    ['M', 0, 0],
    ['L', 10, 0],
    ['L', 10, 10],
  ]);
});