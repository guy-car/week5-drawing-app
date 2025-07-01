import { openaiConfig } from './config';
import { OpenAIResponseSchema, OpenAIResponse } from './types';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { drawingCommandsSchema } from './types';
import { z } from 'zod';

// Create a schema specifically for OpenAI structured output
const openAICommandSchema = z.union([
  z.object({
    type: z.literal('moveTo'),
    x: z.number().int(),
    y: z.number().int()
  }),
  z.object({
    type: z.literal('lineTo'), 
    x: z.number().int(),
    y: z.number().int()
  }),
  z.object({
    type: z.literal('quadTo'),
    x1: z.number().int(),
    y1: z.number().int(),
    x2: z.number().int(),
    y2: z.number().int()
  }),
  z.object({
    type: z.literal('cubicTo'),
    x1: z.number().int(),
    y1: z.number().int(),
    x2: z.number().int(),
    y2: z.number().int(),
    x3: z.number().int(),
    y3: z.number().int()
  }),
  z.object({
    type: z.literal('addCircle'),
    cx: z.number().int(),
    cy: z.number().int(),
    radius: z.number().int()
  })
]);

export async function testCoordinates(): Promise<any[]> {
  const response = await fetch(openaiConfig.baseUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `Bearer ${openaiConfig.apiKey}`,
    },
    body: JSON.stringify({
      model: 'gpt-4o',
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `Draw a circle centered at x=200, y=200 with radius 50.

Respond with an array of drawing commands following this structure:
- Each command must have a "type" field
- Use integer coordinates only
- Available command types: moveTo, lineTo, quadTo, cubicTo, addCircle

For a circle, use a single addCircle command:
{"type": "addCircle", "cx": 200, "cy": 200, "radius": 50}

Or for lines use moveTo/lineTo:
{"type": "moveTo", "x": 250, "y": 200}
{"type": "lineTo", "x": 225, "y": 225}`
            }
          ]
        }
      ],
      max_tokens: 500,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'DrawingCommandsSchema',
          schema: zodToJsonSchema(z.object({
            commands: z.array(openAICommandSchema)
          }).strict())
        }
      }
    })
  });

  console.log('Request Body:', JSON.stringify({
    model: 'gpt-4o',
    messages: [
      {
        role: 'user',
        content: [
          {
            type: 'text',
            text: `Draw a circle centered at x=200, y=200 with radius 50.

Respond with an array of drawing commands following this structure:
- Each command must have a "type" field
- Use integer coordinates only
- Available command types: moveTo, lineTo, quadTo, cubicTo, addCircle

For a circle, use a single addCircle command:
{"type": "addCircle", "cx": 200, "cy": 200, "radius": 50}

Or for lines use moveTo/lineTo:
{"type": "moveTo", "x": 250, "y": 200}
{"type": "lineTo", "x": 225, "y": 225}`
          }
        ]
      }
    ],
    max_tokens: 500,
    response_format: {
      type: 'json_schema',
      json_schema: {
        name: 'DrawingCommandsSchema',
        schema: zodToJsonSchema(z.object({
          commands: z.array(openAICommandSchema)
        }).strict())
      }
    }
  }));

  if (!response.ok) {
    console.error('API error:', response.status, await response.text());
    throw new Error(`API error: ${response.status}`);
  }

  const data: OpenAIResponse = await response.json();
  console.log('Raw Response Data:', data);

  OpenAIResponseSchema.parse(data);
  let aiResponse = data.choices[0].message.content;

  // Clean the response
  aiResponse = aiResponse.replace(/```json|```/g, '').trim();
  console.log('Parsed AI Response:', aiResponse);

  const parsedResponse = JSON.parse(aiResponse);

  if (!parsedResponse.commands || !Array.isArray(parsedResponse.commands)) {
    console.error('Invalid commands array:', parsedResponse);
    throw new Error('AI response does not contain a valid commands array');
  }

  // The commands should now already be in the correct format
  return parsedResponse.commands;
} 