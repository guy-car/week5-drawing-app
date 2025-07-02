import { z } from 'zod';

// Constants for coordinate validation
const CANVAS_MIN_X = 0;
const CANVAS_MAX_X = 1000; // Updated to match BASE_CANVAS_SIZE
const CANVAS_MIN_Y = 0;
const CANVAS_MAX_Y = 1000; // Updated to match BASE_CANVAS_SIZE
const MIN_RADIUS = 1;
const MAX_RADIUS = 500; // Updated to be half of canvas size
const BASE_CANVAS_SIZE = 1000; // Base canvas size constant

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

// Add new validation helpers for width and height
const validateDimension = (value: number): number => {
  if (value < 1 || value > BASE_CANVAS_SIZE) {
    console.warn(`Dimension ${value} out of bounds [1, ${BASE_CANVAS_SIZE}]. Clamping to bounds.`);
    return Math.max(1, Math.min(BASE_CANVAS_SIZE, value));
  }
  return value;
};

// Add validation helper for angles (in degrees)
const validateAngle = (value: number): number => {
  return value % 360;
};

// Add validation helper for corner radius
const validateCornerRadius = (value: number): number => {
  if (value < 0 || value > MAX_RADIUS) {
    console.warn(`Corner radius ${value} out of bounds [0, ${MAX_RADIUS}]. Clamping to bounds.`);
    return Math.max(0, Math.min(MAX_RADIUS, value));
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

const addRectSchema = z.object({
  type: z.literal('addRect'),
  x: z.number().int()
    .transform(x => validateCoordinate(x, 'x')),
  y: z.number().int()
    .transform(y => validateCoordinate(y, 'y')),
  width: z.number()
    .transform(validateDimension),
  height: z.number()
    .transform(validateDimension)
});

const addOvalSchema = z.object({
  type: z.literal('addOval'),
  x: z.number().int()
    .transform(x => validateCoordinate(x, 'x')),
  y: z.number().int()
    .transform(y => validateCoordinate(y, 'y')),
  width: z.number()
    .transform(validateDimension),
  height: z.number()
    .transform(validateDimension)
});

const addArcSchema = z.object({
  type: z.literal('addArc'),
  x: z.number().int()
    .transform(x => validateCoordinate(x, 'x')),
  y: z.number().int()
    .transform(y => validateCoordinate(y, 'y')),
  width: z.number()
    .transform(validateDimension),
  height: z.number()
    .transform(validateDimension),
  startAngle: z.number()
    .transform(validateAngle),
  sweepAngle: z.number()
    .transform(validateAngle)
});

const addRoundRectSchema = z.object({
  type: z.literal('addRoundRect'),
  x: z.number().int()
    .transform(x => validateCoordinate(x, 'x')),
  y: z.number().int()
    .transform(y => validateCoordinate(y, 'y')),
  width: z.number()
    .transform(validateDimension),
  height: z.number()
    .transform(validateDimension),
  rx: z.number()
    .transform(validateCornerRadius),
  ry: z.number()
    .transform(validateCornerRadius)
});

// Define a union of all command schemas
export const commandSchema = z.union([
  moveToSchema,
  lineToSchema,
  quadToSchema,
  cubicToSchema,
  addCircleSchema,
  addRectSchema,
  addOvalSchema,
  addArcSchema,
  addRoundRectSchema,
]);

// Define the schema for an array of commands
export const drawingCommandsSchema = z.array(commandSchema);

// Export TypeScript types for all command variants
export type MoveToCommand = z.infer<typeof moveToSchema>;
export type LineToCommand = z.infer<typeof lineToSchema>;
export type QuadToCommand = z.infer<typeof quadToSchema>;
export type CubicToCommand = z.infer<typeof cubicToSchema>;
export type AddCircleCommand = z.infer<typeof addCircleSchema>;
export type AddRectCommand = z.infer<typeof addRectSchema>;
export type AddOvalCommand = z.infer<typeof addOvalSchema>;
export type AddArcCommand = z.infer<typeof addArcSchema>;
export type AddRoundRectCommand = z.infer<typeof addRoundRectSchema>;
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

// Riff-specific types and schemas
export interface RiffAnalysis {
  style: 'geometric' | 'organic' | 'mixed';
  complexity: number;
  description: string;
}

export const riffAnalysisSchema = z.object({
  style: z.enum(['geometric', 'organic', 'mixed']),
  complexity: z.number().min(0).max(10),
  description: z.string()
});

export const riffResponseSchema = z.object({
  analysis: riffAnalysisSchema,
  commands: drawingCommandsSchema
});

export type RiffResponse = z.infer<typeof riffResponseSchema>;

// Export the JSON schema for OpenAI response format
export const riffResponseJsonSchema = {
  type: 'object',
  required: ['analysis', 'commands'],
  properties: {
    analysis: {
      type: 'object',
      required: ['style', 'complexity', 'description'],
      properties: {
        style: {
          type: 'string',
          enum: ['geometric', 'organic', 'mixed']
        },
        complexity: {
          type: 'number',
          minimum: 0,
          maximum: 10
        },
        description: {
          type: 'string'
        }
      }
    },
    commands: {
      type: 'array',
      items: {
        oneOf: [
          {
            type: 'object',
            required: ['type', 'x', 'y'],
            properties: {
              type: { const: 'moveTo' },
              x: { type: 'number' },
              y: { type: 'number' }
            }
          },
          {
            type: 'object',
            required: ['type', 'x', 'y'],
            properties: {
              type: { const: 'lineTo' },
              x: { type: 'number' },
              y: { type: 'number' }
            }
          },
          {
            type: 'object',
            required: ['type', 'x1', 'y1', 'x2', 'y2'],
            properties: {
              type: { const: 'quadTo' },
              x1: { type: 'number' },
              y1: { type: 'number' },
              x2: { type: 'number' },
              y2: { type: 'number' }
            }
          },
          {
            type: 'object',
            required: ['type', 'x1', 'y1', 'x2', 'y2', 'x3', 'y3'],
            properties: {
              type: { const: 'cubicTo' },
              x1: { type: 'number' },
              y1: { type: 'number' },
              x2: { type: 'number' },
              y2: { type: 'number' },
              x3: { type: 'number' },
              y3: { type: 'number' }
            }
          },
          {
            type: 'object',
            required: ['type', 'cx', 'cy', 'radius'],
            properties: {
              type: { const: 'addCircle' },
              cx: { type: 'number' },
              cy: { type: 'number' },
              radius: { type: 'number' }
            }
          },
          {
            type: 'object',
            required: ['type', 'x', 'y', 'width', 'height'],
            properties: {
              type: { const: 'addRect' },
              x: { type: 'number' },
              y: { type: 'number' },
              width: { type: 'number' },
              height: { type: 'number' }
            }
          },
          {
            type: 'object',
            required: ['type', 'x', 'y', 'width', 'height'],
            properties: {
              type: { const: 'addOval' },
              x: { type: 'number' },
              y: { type: 'number' },
              width: { type: 'number' },
              height: { type: 'number' }
            }
          },
          {
            type: 'object',
            required: ['type', 'x', 'y', 'width', 'height', 'startAngle', 'sweepAngle'],
            properties: {
              type: { const: 'addArc' },
              x: { type: 'number' },
              y: { type: 'number' },
              width: { type: 'number' },
              height: { type: 'number' },
              startAngle: { type: 'number' },
              sweepAngle: { type: 'number' }
            }
          },
          {
            type: 'object',
            required: ['type', 'x', 'y', 'width', 'height', 'rx', 'ry'],
            properties: {
              type: { const: 'addRoundRect' },
              x: { type: 'number' },
              y: { type: 'number' },
              width: { type: 'number' },
              height: { type: 'number' },
              rx: { type: 'number' },
              ry: { type: 'number' }
            }
          }
        ]
      }
    }
  }
}; 