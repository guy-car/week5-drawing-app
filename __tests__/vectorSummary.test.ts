import { vectorSummary } from '../src/utils/vectorSummary';

describe('vectorSummary', () => {
  test('basic command analysis', () => {
    const cmds = [
      { type: 'moveTo', x: 0, y: 0 },
      { type: 'lineTo', x: 3, y: 4 },
      { type: 'addCircle', cx: 5, cy: 5, radius: 2 }
    ];
    
    const summary = vectorSummary(cmds as any);
    
    // Test command count
    expect(summary.commandCount).toBe(3);
    
    // Test average segment length (3-4-5 triangle)
    expect(summary.avgSegment).toBeCloseTo(5);
    
    // Test shape histogram
    expect(summary.shapeHistogram.moveTo).toBe(1);
    expect(summary.shapeHistogram.lineTo).toBe(1);
    expect(summary.shapeHistogram.addCircle).toBe(1);
    
    // Test bounding box
    expect(summary.boundingBox.minX).toBe(0);
    expect(summary.boundingBox.minY).toBe(0);
    expect(summary.boundingBox.maxX).toBe(7); // 5 + 2 (circle radius)
    expect(summary.boundingBox.maxY).toBe(7); // 5 + 2 (circle radius)
    
    // Test angle calculation (for the single line segment)
    expect(summary.dominantAngles).toHaveLength(1);
    expect(summary.dominantAngles[0]).toBe(60); // atan2(4,3) ≈ 53.13° rounded to nearest 15° = 60°
  });

  test('empty command list', () => {
    const summary = vectorSummary([]);
    
    expect(summary.commandCount).toBe(0);
    expect(summary.avgSegment).toBe(0);
    expect(summary.dominantAngles).toHaveLength(0);
    expect(summary.shapeHistogram.moveTo).toBe(0);
    expect(summary.boundingBox.minX).toBe(Infinity);
    expect(summary.boundingBox.maxX).toBe(-Infinity);
  });
}); 