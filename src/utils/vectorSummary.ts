import { DrawingCommand } from '../api/openai/types';

export interface VectorSummary {
  commandCount: number;
  bbox: { minX: number; minY: number; maxX: number; maxY: number };
  avgSegment: number;
  dominantAngles: number[];    // top 3 in degrees
  shapeHistogram: Record<string, number>;
}

function calculateAngle(x1: number, y1: number, x2: number, y2: number): number {
  const angle = Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI);
  return (angle + 360) % 360; // Normalize to 0-360
}

function updateBBox(bbox: VectorSummary['bbox'], x: number, y: number) {
  bbox.minX = Math.min(bbox.minX, x);
  bbox.minY = Math.min(bbox.minY, y);
  bbox.maxX = Math.max(bbox.maxX, x);
  bbox.maxY = Math.max(bbox.maxY, y);
}

export const vectorSummary = (commands: DrawingCommand[]): VectorSummary => {
  const summary: VectorSummary = {
    commandCount: commands.length,
    bbox: { minX: Infinity, minY: Infinity, maxX: -Infinity, maxY: -Infinity },
    avgSegment: 0,
    dominantAngles: [],
    shapeHistogram: {}
  };

  let totalLength = 0;
  let segmentCount = 0;
  const angles: number[] = [];
  let lastX = 0, lastY = 0;

  // Process each command
  commands.forEach((cmd) => {
    // Update shape histogram
    summary.shapeHistogram[cmd.type] = (summary.shapeHistogram[cmd.type] || 0) + 1;

    // Update bounding box and collect angles
    switch (cmd.type) {
      case 'moveTo':
      case 'lineTo': {
        updateBBox(summary.bbox, cmd.x, cmd.y);
        if (cmd.type === 'lineTo') {
          const length = Math.sqrt(
            Math.pow(cmd.x - lastX, 2) + Math.pow(cmd.y - lastY, 2)
          );
          totalLength += length;
          segmentCount++;
          angles.push(calculateAngle(lastX, lastY, cmd.x, cmd.y));
        }
        lastX = cmd.x;
        lastY = cmd.y;
        break;
      }
      case 'quadTo': {
        updateBBox(summary.bbox, cmd.x1, cmd.y1);
        updateBBox(summary.bbox, cmd.x2, cmd.y2);
        const length = Math.sqrt(
          Math.pow(cmd.x2 - lastX, 2) + Math.pow(cmd.y2 - lastY, 2)
        );
        totalLength += length;
        segmentCount++;
        angles.push(calculateAngle(lastX, lastY, cmd.x2, cmd.y2));
        lastX = cmd.x2;
        lastY = cmd.y2;
        break;
      }
      case 'cubicTo': {
        updateBBox(summary.bbox, cmd.x1, cmd.y1);
        updateBBox(summary.bbox, cmd.x2, cmd.y2);
        updateBBox(summary.bbox, cmd.x3, cmd.y3);
        const length = Math.sqrt(
          Math.pow(cmd.x3 - lastX, 2) + Math.pow(cmd.y3 - lastY, 2)
        );
        totalLength += length;
        segmentCount++;
        angles.push(calculateAngle(lastX, lastY, cmd.x3, cmd.y3));
        lastX = cmd.x3;
        lastY = cmd.y3;
        break;
      }
      case 'addCircle': {
        updateBBox(summary.bbox, cmd.cx - cmd.radius, cmd.cy - cmd.radius);
        updateBBox(summary.bbox, cmd.cx + cmd.radius, cmd.cy + cmd.radius);
        totalLength += 2 * Math.PI * cmd.radius;
        segmentCount++;
        break;
      }
      case 'addRect': {
        updateBBox(summary.bbox, cmd.x, cmd.y);
        updateBBox(summary.bbox, cmd.x + cmd.width, cmd.y + cmd.height);
        totalLength += 2 * (cmd.width + cmd.height);
        segmentCount += 4;
        break;
      }
    }
  });

  // Calculate average segment length
  summary.avgSegment = segmentCount > 0 ? totalLength / segmentCount : 0;

  // Find dominant angles
  if (angles.length > 0) {
    // Group angles into 10-degree buckets
    const buckets: Record<number, number> = {};
    angles.forEach(angle => {
      const bucket = Math.floor(angle / 10) * 10;
      buckets[bucket] = (buckets[bucket] || 0) + 1;
    });

    // Sort buckets by frequency and take top 3
    summary.dominantAngles = Object.entries(buckets)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 3)
      .map(([angle]) => parseInt(angle));
  }

  return summary;
}; 