import { openaiConfig } from './config';
import { OpenAIResponseSchema, OpenAIResponse, commandSchema, validateDrawingCommands, DrawingCommands } from './types';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { z } from 'zod';

// Error classes (imported from drawingCommands.ts)
class DrawingAPIError extends Error {
  constructor(message: string, public status?: number, public response?: string) {
    super(message);
    this.name = 'DrawingAPIError';
  }
}

class DrawingValidationError extends Error {
  constructor(message: string, public details?: unknown) {
    super(message);
    this.name = 'DrawingValidationError';
  }
}

export async function proceedWithAPICall(base64Image: string): Promise<DrawingCommands> {
  console.log('🧪 Starting AI integration test...');
  console.log('🔑 Using API key:', openaiConfig.apiKey?.substring(0, 10) + '...');

  // Step 1: Validate base64 image
  console.log('📸 Validating canvas image...');
  if (!base64Image) {
    throw new DrawingAPIError('Failed to export canvas image');
  }
  console.log('✅ Canvas image validated successfully');

  // Step 2: Send to OpenAI Vision API
  console.log('🤖 Sending to OpenAI Vision API...');

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
                text: `You are looking at a drawing on a 1000x1000 pixel canvas. The coordinate system has:
- Top-left corner: (0, 0)
- Top-right corner: (1000, 0)  
- Bottom-left corner: (0, 1000)
- Bottom-right corner: (1000, 1000)

Please analyze what's currently drawn and add ONE simple complementary shape or line that naturally completes or enhances the drawing.

Respond with drawing commands following this structure:
- Each command must have a "type" field
- Use integer coordinates only
- Available command types: moveTo, lineTo, quadTo, cubicTo, addCircle
- ALL coordinates must be within canvas bounds (0-1000 for both x and y)
- Circle radius must be between 1 and 500
- Keep it simple (3-8 commands max for lines, or 1 addCircle command)

Examples:
For a circle: {"type": "addCircle", "cx": 500, "cy": 500, "radius": 100}
For lines: {"type": "moveTo", "x": 100, "y": 100}, {"type": "lineTo", "x": 200, "y": 200}`
              },
              {
                type: 'image_url',
                image_url: {
                  url: base64Image
                }
              }
            ]
          }
        ],
        max_tokens: 1000,
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
      console.error('❌ OpenAI API Error:', response.status, errorText);

      if (response.status === 401) {
        throw new DrawingAPIError('Invalid API key. Please check your EXPO_PUBLIC_OPENAI_API_KEY in .env file.', response.status, errorText);
      } else if (response.status === 429) {
        throw new DrawingAPIError('Rate limit exceeded. Please try again later.', response.status, errorText);
      } else {
        throw new DrawingAPIError(`OpenAI API error (${response.status}): ${errorText}`, response.status, errorText);
      }
    }

    const data: OpenAIResponse = await response.json();
    console.log('🎉 OpenAI API Response:', JSON.stringify(data, null, 2));

    // Validate OpenAI response structure
    try {
      OpenAIResponseSchema.parse(data);
    } catch (error) {
      console.error('OpenAI response validation failed:', error);
      throw new DrawingValidationError('Invalid OpenAI response format', error);
    }

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new DrawingValidationError('Unexpected API response format - missing choices or message');
    }

    let aiResponse = data.choices[0].message.content;
    console.log('🤖 AI Generated Commands:', aiResponse);

    // Clean the response (shouldn't need this with json_schema but keeping as fallback)
    aiResponse = aiResponse.replace(/```json|```/g, '').trim();

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
    console.log('✅ Successfully validated AI commands:', validatedCommands);

    return validatedCommands;

  } catch (error) {
    if (error instanceof DrawingAPIError || error instanceof DrawingValidationError) {
      throw error;
    }
    console.error('❌ Unexpected error:', error);
    throw new Error('An unexpected error occurred while processing drawing commands');
  }
} 