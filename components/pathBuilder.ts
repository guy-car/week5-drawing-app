import { Skia } from '@shopify/react-native-skia';
import { DrawingCommand } from '../src/api/openai/types';
import { BASE_CANVAS_SIZE } from '../src/constants/canvas';

/**
 * Builds a Skia path from an array of drawing commands.
 * @param commands Array of drawing commands to process
 * @param existingPath Optional existing Skia path to append commands to
 * @returns The resulting Skia path
 */
export function buildPathFromCommands(commands: DrawingCommand[], existingPath?: any): any {
  const path = existingPath || Skia.Path.Make();
  
  commands.forEach(command => {
    switch (command.type) {
      case 'moveTo': {
        const x = Math.max(0, Math.min(BASE_CANVAS_SIZE, command.x));
        const y = Math.max(0, Math.min(BASE_CANVAS_SIZE, command.y));
        path.moveTo(x, y);
        break;
      }
      case 'lineTo': {
        const x = Math.max(0, Math.min(BASE_CANVAS_SIZE, command.x));
        const y = Math.max(0, Math.min(BASE_CANVAS_SIZE, command.y));
        path.lineTo(x, y);
        break;
      }
      case 'quadTo': {
        const x1 = Math.max(0, Math.min(BASE_CANVAS_SIZE, command.x1));
        const y1 = Math.max(0, Math.min(BASE_CANVAS_SIZE, command.y1));
        const x2 = Math.max(0, Math.min(BASE_CANVAS_SIZE, command.x2));
        const y2 = Math.max(0, Math.min(BASE_CANVAS_SIZE, command.y2));
        path.quadTo(x1, y1, x2, y2);
        break;
      }
      case 'cubicTo': {
        const x1 = Math.max(0, Math.min(BASE_CANVAS_SIZE, command.x1));
        const y1 = Math.max(0, Math.min(BASE_CANVAS_SIZE, command.y1));
        const x2 = Math.max(0, Math.min(BASE_CANVAS_SIZE, command.x2));
        const y2 = Math.max(0, Math.min(BASE_CANVAS_SIZE, command.y2));
        const x3 = Math.max(0, Math.min(BASE_CANVAS_SIZE, command.x3));
        const y3 = Math.max(0, Math.min(BASE_CANVAS_SIZE, command.y3));
        path.cubicTo(x1, y1, x2, y2, x3, y3);
        break;
      }
      case 'addCircle': {
        const cx = Math.max(0, Math.min(BASE_CANVAS_SIZE, command.cx));
        const cy = Math.max(0, Math.min(BASE_CANVAS_SIZE, command.cy));
        const radius = Math.max(1, Math.min(BASE_CANVAS_SIZE / 2, command.radius));
        path.addCircle(cx, cy, radius);
        break;
      }
    }
  });
  
  return path;
} 