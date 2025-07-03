import { DrawingCommand } from '../api/openai/types';

export interface VectorSummary {
  commandCount: number;
  boundingBox: {
    minX: number;
    minY: number;
    maxX: number;
    maxY: number;
  };
  avgSegment: number;
  dominantAngles: number[];  // Top 3 angles in degrees
  shapeHistogram: {
    moveTo: number;
    lineTo: number;
    quadTo: number;
    cubicTo: number;
    addCircle: number;
  };
}

function calculateEuclideanDistance(x1: number, y1: number, x2: number, y2: number): number {
  return Math.sqrt(Math.pow(x2 - x1, 2) + Math.pow(y2 - y1, 2));
}

function calculateAngle(x1: number, y1: number, x2: number, y2: number): number {
  return Math.round(Math.atan2(y2 - y1, x2 - x1) * (180 / Math.PI) / 15) * 15;
}

export function vectorSummary(commands: DrawingCommand[]): VectorSummary {
  const summary: VectorSummary = {
    commandCount: commands.length,
    boundingBox: {
      minX: Infinity,
      minY: Infinity,
      maxX: -Infinity,
      maxY: -Infinity,
    },
    avgSegment: 0,
    dominantAngles: [],
    shapeHistogram: {
      moveTo: 0,
      lineTo: 0,
      quadTo: 0,
      cubicTo: 0,
      addCircle: 0,
    }
  };

  let totalSegmentLength = 0;
  let segmentCount = 0;
  const angles: number[] = [];
  let lastX = 0, lastY = 0;

  commands.forEach((cmd) => {
    // Update shape histogram
    summary.shapeHistogram[cmd.type]++;

    // Update bounding box and calculate segments
    switch (cmd.type) {
      case 'moveTo':
        lastX = cmd.x;
        lastY = cmd.y;
        summary.boundingBox.minX = Math.min(summary.boundingBox.minX, cmd.x);
        summary.boundingBox.minY = Math.min(summary.boundingBox.minY, cmd.y);
        summary.boundingBox.maxX = Math.max(summary.boundingBox.maxX, cmd.x);
        summary.boundingBox.maxY = Math.max(summary.boundingBox.maxY, cmd.y);
        break;

      case 'lineTo':
        const distance = calculateEuclideanDistance(lastX, lastY, cmd.x, cmd.y);
        totalSegmentLength += distance;
        segmentCount++;
        angles.push(calculateAngle(lastX, lastY, cmd.x, cmd.y));
        lastX = cmd.x;
        lastY = cmd.y;
        summary.boundingBox.minX = Math.min(summary.boundingBox.minX, cmd.x);
        summary.boundingBox.minY = Math.min(summary.boundingBox.minY, cmd.y);
        summary.boundingBox.maxX = Math.max(summary.boundingBox.maxX, cmd.x);
        summary.boundingBox.maxY = Math.max(summary.boundingBox.maxY, cmd.y);
        break;

      case 'addCircle':
        summary.boundingBox.minX = Math.min(summary.boundingBox.minX, cmd.cx - cmd.radius);
        summary.boundingBox.minY = Math.min(summary.boundingBox.minY, cmd.cy - cmd.radius);
        summary.boundingBox.maxX = Math.max(summary.boundingBox.maxX, cmd.cx + cmd.radius);
        summary.boundingBox.maxY = Math.max(summary.boundingBox.maxY, cmd.cy + cmd.radius);
        break;
    }
  });

  // Calculate average segment length
  summary.avgSegment = segmentCount > 0 ? totalSegmentLength / segmentCount : 0;

  // Find dominant angles
  const angleHistogram: { [key: number]: number } = {};
  angles.forEach(angle => {
    angleHistogram[angle] = (angleHistogram[angle] || 0) + 1;
  });

  summary.dominantAngles = Object.entries(angleHistogram)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 3)
    .map(([angle]) => Number(angle));

  return summary;
} 