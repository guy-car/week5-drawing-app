import { z } from 'zod';

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

// Define individual command schemas
const moveToSchema = z.object({
  moveTo: z.tuple([z.number().int(), z.number().int()]),
});

const lineToSchema = z.object({
  lineTo: z.tuple([z.number().int(), z.number().int()]),
});

const quadToSchema = z.object({
  quadTo: z.tuple([z.number().int(), z.number().int(), z.number().int(), z.number().int()]),
});

const cubicToSchema = z.object({
  cubicTo: z.tuple([z.number().int(), z.number().int(), z.number().int(), z.number().int(), z.number().int(), z.number().int()]),
});

const addCircleSchema = z.object({
  addCircle: z.tuple([z.number().int(), z.number().int(), z.number().int()]),
});

// Define a union of all command schemas
const commandSchema = z.union([
  moveToSchema,
  lineToSchema,
  quadToSchema,
  cubicToSchema,
  addCircleSchema,
]);

// Define the schema for an array of commands
export const drawingCommandsSchema = z.array(commandSchema); 