import { openaiConfig } from './config';
import { OpenAIResponseSchema, OpenAIResponse, commandSchema, validateDrawingCommands, DrawingCommands } from './types';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { z } from 'zod';

// Error class for API-related errors
class DrawingAPIError extends Error {
  constructor(message: string, public status?: number, public response?: string) {
    super(message);
    this.name = 'DrawingAPIError';
  }
}

// Error class for validation errors
class DrawingValidationError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = 'DrawingValidationError';
  }
}

export async function testCoordinates(): Promise<DrawingCommands> {
  try {
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
                text: `Draw a circle centered at x=500, y=500 with radius 100.

Respond with an array of drawing commands following this structure:
- Each command must have a "type" field
- Use integer coordinates only
- Available command types: moveTo, lineTo, quadTo, cubicTo, addCircle
- Coordinates must be within canvas bounds (0-1000 for both x and y)
- Circle radius must be between 1 and 500

For a circle, use a single addCircle command:
{"type": "addCircle", "cx": 500, "cy": 500, "radius": 100}

Or for lines use moveTo/lineTo:
{"type": "moveTo", "x": 600, "y": 500}
{"type": "lineTo", "x": 550, "y": 550}`
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
              commands: z.array(commandSchema)
            }).strict())
          }
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API error:', response.status, errorText);
      throw new DrawingAPIError(`API request failed with status ${response.status}`, response.status, errorText);
    }

    const data: OpenAIResponse = await response.json();
    console.log('Raw Response Data:', data);

    try {
      OpenAIResponseSchema.parse(data);
    } catch (error) {
      console.error('OpenAI response validation failed:', error);
      throw new DrawingValidationError('Invalid OpenAI response format', error);
    }

    let aiResponse = data.choices[0].message.content;

    // Clean the response
    aiResponse = aiResponse.replace(/```json|```/g, '').trim();
    console.log('Parsed AI Response:', aiResponse);

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(aiResponse);
    } catch (error) {
      console.error('JSON parsing failed:', error);
      throw new DrawingValidationError('Failed to parse AI response as JSON', error);
    }

    if (!parsedResponse.commands || !Array.isArray(parsedResponse.commands)) {
      console.error('Invalid commands array:', parsedResponse);
      throw new DrawingValidationError('AI response does not contain a valid commands array');
    }

    // Validate and transform the commands using our enhanced validation
    const validatedCommands = validateDrawingCommands(parsedResponse.commands);
    console.log('Validated commands:', validatedCommands);

    return validatedCommands;
  } catch (error) {
    if (error instanceof DrawingAPIError || error instanceof DrawingValidationError) {
      throw error;
    }
    console.error('Unexpected error:', error);
    throw new Error('An unexpected error occurred while processing drawing commands');
  }
}

export async function testCreativeDrawing(): Promise<DrawingCommands> {
  try {
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
                text: `Draw a sun in the top-left corner of a 1000x1000 pixel canvas.

The canvas coordinate system:
- Top-left corner: (0, 0)
- Top-right corner: (1000, 0)  
- Bottom-left corner: (0, 1000)
- Bottom-right corner: (1000, 1000)

Create a detailed, recognizable sun with:
- A central circle for the sun's body
- Multiple rays extending outward
- Make it artistic and substantial (not minimal)

Use these drawing commands:
- Each command must have a "type" field
- Use integer coordinates only
- Available command types: moveTo, lineTo, quadTo, cubicTo, addCircle
- ALL coordinates must be within canvas bounds (0-1000 for both x and y)
- Circle radius must be between 1 and 500
- Feel free to use many commands to create a detailed sun

Examples:
For a circle: {"type": "addCircle", "cx": 200, "cy": 200, "radius": 50}
For lines: {"type": "moveTo", "x": 100, "y": 100}, {"type": "lineTo", "x": 200, "y": 200}`
              }
            ]
          }
        ],
        max_tokens: 2000,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'DrawingCommandsSchema',
            schema: zodToJsonSchema(z.object({
              commands: z.array(commandSchema)
            }).strict())
          }
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API error:', response.status, errorText);
      throw new DrawingAPIError(`API request failed with status ${response.status}`, response.status, errorText);
    }

    const data: OpenAIResponse = await response.json();
    console.log('Creative Drawing Response:', data);

    try {
      OpenAIResponseSchema.parse(data);
    } catch (error) {
      console.error('OpenAI response validation failed:', error);
      throw new DrawingValidationError('Invalid OpenAI response format', error);
    }

    let aiResponse = data.choices[0].message.content;
    aiResponse = aiResponse.replace(/```json|```/g, '').trim();
    console.log('Creative AI Response:', aiResponse);

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(aiResponse);
    } catch (error) {
      console.error('JSON parsing failed:', error);
      throw new DrawingValidationError('Failed to parse AI response as JSON', error);
    }

    if (!parsedResponse.commands || !Array.isArray(parsedResponse.commands)) {
      console.error('Invalid commands array:', parsedResponse);
      throw new DrawingValidationError('AI response does not contain a valid commands array');
    }

    const validatedCommands = validateDrawingCommands(parsedResponse.commands);
    console.log('Validated creative commands:', validatedCommands);

    return validatedCommands;
  } catch (error) {
    if (error instanceof DrawingAPIError || error instanceof DrawingValidationError) {
      throw error;
    }
    console.error('Unexpected error:', error);
    throw new Error('An unexpected error occurred while processing creative drawing commands');
  }
}

export async function testPurposefulAdditions(): Promise<DrawingCommands> {
  try {
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
                text: `Please analyze what's currently drawn and add one or two complementary elements that naturally enhance the drawing. You can create simple shapes, lines, or details that feel appropriate to the existing artwork.

Command guidance: "3-15 commands total, focusing on purposeful additions"`
              }
            ]
          }
        ],
        max_tokens: 2000,
        response_format: {
          type: 'json_schema',
          json_schema: {
            name: 'DrawingCommandsSchema',
            schema: zodToJsonSchema(z.object({
              commands: z.array(commandSchema)
            }).strict())
          }
        }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('API error:', response.status, errorText);
      throw new DrawingAPIError(`API request failed with status ${response.status}`, response.status, errorText);
    }

    const data: OpenAIResponse = await response.json();
    console.log('Purposeful Additions Response:', data);

    try {
      OpenAIResponseSchema.parse(data);
    } catch (error) {
      console.error('OpenAI response validation failed:', error);
      throw new DrawingValidationError('Invalid OpenAI response format', error);
    }

    let aiResponse = data.choices[0].message.content;
    aiResponse = aiResponse.replace(/```json|```/g, '').trim();
    console.log('Purposeful AI Response:', aiResponse);

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(aiResponse);
    } catch (error) {
      console.error('JSON parsing failed:', error);
      throw new DrawingValidationError('Failed to parse AI response as JSON', error);
    }

    if (!parsedResponse.commands || !Array.isArray(parsedResponse.commands)) {
      console.error('Invalid commands array:', parsedResponse);
      throw new DrawingValidationError('AI response does not contain a valid commands array');
    }

    const validatedCommands = validateDrawingCommands(parsedResponse.commands);
    console.log('Validated purposeful commands:', validatedCommands);

    return validatedCommands;
  } catch (error) {
    if (error instanceof DrawingAPIError || error instanceof DrawingValidationError) {
      throw error;
    }
    console.error('Unexpected error:', error);
    throw new Error('An unexpected error occurred while processing purposeful drawing commands');
  }
} 