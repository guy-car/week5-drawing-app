import { z } from 'zod';

// Constants for coordinate validation
const CANVAS_MIN_X = 0;
const CANVAS_MAX_X = 1000; // Updated to match BASE_CANVAS_SIZE
const CANVAS_MIN_Y = 0;
const CANVAS_MAX_Y = 1000; // Updated to match BASE_CANVAS_SIZE
const MIN_RADIUS = 1;
const MAX_RADIUS = 500; // Updated to be half of canvas size for maximum possible circle

// Validation helper for coordinates
const validateCoordinate = (value: number, axis: 'x' | 'y'): number => {
  const min = axis === 'x' ? CANVAS_MIN_X : CANVAS_MIN_Y;
  const max = axis === 'x' ? CANVAS_MAX_X : CANVAS_MAX_Y;
  if (value < min || value > max) {
    console.warn(`${axis} coordinate ${value} out of bounds [${min}, ${max}]. Clamping to bounds.`);
    return Math.max(min, Math.min(max, value));
  }
  return value;
};

// Validation helper for radius
const validateRadius = (value: number): number => {
  if (value < MIN_RADIUS || value > MAX_RADIUS) {
    console.warn(`Radius ${value} out of bounds [${MIN_RADIUS}, ${MAX_RADIUS}]. Clamping to bounds.`);
    return Math.max(MIN_RADIUS, Math.min(MAX_RADIUS, value));
  }
  return value;
};

export const OpenAIResponseSchema = z.object({
  choices: z.array(
    z.object({
      message: z.object({
        content: z.string(),
      }),
    })
  ),
});

export type OpenAIResponse = z.infer<typeof OpenAIResponseSchema>;

// Define individual command schemas using object-based format with validation
const moveToSchema = z.object({
  type: z.literal('moveTo'),
  x: z.number().int()
    .transform(x => validateCoordinate(x, 'x')),
  y: z.number().int()
    .transform(y => validateCoordinate(y, 'y'))
});

const lineToSchema = z.object({
  type: z.literal('lineTo'),
  x: z.number().int()
    .transform(x => validateCoordinate(x, 'x')),
  y: z.number().int()
    .transform(y => validateCoordinate(y, 'y'))
});

const quadToSchema = z.object({
  type: z.literal('quadTo'),
  x1: z.number().int()
    .transform(x => validateCoordinate(x, 'x')),
  y1: z.number().int()
    .transform(y => validateCoordinate(y, 'y')),
  x2: z.number().int()
    .transform(x => validateCoordinate(x, 'x')),
  y2: z.number().int()
    .transform(y => validateCoordinate(y, 'y'))
});

const cubicToSchema = z.object({
  type: z.literal('cubicTo'),
  x1: z.number().int()
    .transform(x => validateCoordinate(x, 'x')),
  y1: z.number().int()
    .transform(y => validateCoordinate(y, 'y')),
  x2: z.number().int()
    .transform(x => validateCoordinate(x, 'x')),
  y2: z.number().int()
    .transform(y => validateCoordinate(y, 'y')),
  x3: z.number().int()
    .transform(x => validateCoordinate(x, 'x')),
  y3: z.number().int()
    .transform(y => validateCoordinate(y, 'y'))
});

const addCircleSchema = z.object({
  type: z.literal('addCircle'),
  cx: z.number().int()
    .transform(x => validateCoordinate(x, 'x')),
  cy: z.number().int()
    .transform(y => validateCoordinate(y, 'y')),
  radius: z.number().int()
    .transform(validateRadius)
});

// Define a union of all command schemas
export const commandSchema = z.union([
  moveToSchema,
  lineToSchema,
  quadToSchema,
  cubicToSchema,
  addCircleSchema,
]);

// Define the schema for an array of commands
export const drawingCommandsSchema = z.array(commandSchema);

// Export TypeScript types for all command variants
export type MoveToCommand = z.infer<typeof moveToSchema>;
export type LineToCommand = z.infer<typeof lineToSchema>;
export type QuadToCommand = z.infer<typeof quadToSchema>;
export type CubicToCommand = z.infer<typeof cubicToSchema>;
export type AddCircleCommand = z.infer<typeof addCircleSchema>;
export type DrawingCommand = z.infer<typeof commandSchema>;
export type DrawingCommands = z.infer<typeof drawingCommandsSchema>;

// Export validation utilities for use in other files
export const validateDrawingCommands = (commands: unknown): DrawingCommands => {
  try {
    return drawingCommandsSchema.parse(commands);
  } catch (error) {
    console.error('Drawing commands validation failed:', error);
    throw new Error('Invalid drawing commands format');
  }
}; 