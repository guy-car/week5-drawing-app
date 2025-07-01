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