import { openaiConfig, streamLog } from './config';
import { DrawingCommand, commandSchema, validateDrawingCommands, OpenAIResponse, OpenAIResponseSchema } from './types';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { VectorSummary } from '../../utils/vectorSummary';
import { z } from 'zod';
import { openAIStreamParser } from './streamParser';
import { stamp } from '../../utils/performance';
import EventSource from 'react-native-sse';

// Error classes
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

interface RiffReq {
  image: string;
  summary?: VectorSummary; // Made optional for A/B testing
  onIncrementalDraw?: (cmd: DrawingCommand) => void;
  selectedColor: string;
}

export async function riffOnSketch({ image, summary, onIncrementalDraw, selectedColor }: RiffReq): Promise<DrawingCommand[]> {
  streamLog.info('🎨 Starting riff-on-sketch analysis...');
  streamLog.info('🎨 Using color:', selectedColor);

  // Step 1: Validate inputs
  if (!image) {
    throw new DrawingAPIError('Failed to export canvas image');
  }

  // Step 2: Send to OpenAI Vision API
  const useStreaming = process.env.EXPO_PUBLIC_RIFF_ON_SKETCH === '1' && onIncrementalDraw;

  try {
    console.log('🎯 PROMPT BEING SENT TO AI:')
    // Build the shared request payload
    const requestBody = {
      model: 'gpt-4o',
      stream: true,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'text',
              text: `You are an alien intelligence responding to a human drawing transmission through pure visual communication.

IF the human drawing contains recognizable shapes/objects (houses, people, animals, vehicles, etc.):
- Circle around 1-2 elements that intrigue you most
- Add 1-2  arrows pointing to specific details that catch your alien attention
- Use flowing, organic circles and curved arrows

OTHERWISE, create mysterious alien art that reflects your incomprehensible culture:
- Draw strange symbols that hint at alien writing/meaning
- Create flowing energy patterns that seem to pulse with life
- Add crystalline or fractal structures from your world
- Draw organic forms that suggest alien biology or technology
- Use spirals, tendrils, and patterns that feel otherworldly
- Make it beautiful but unsettling - clearly from another intelligence
- Prefer drawing in areas that are empty as opposed to drawing over existing elements

STYLE FOR BOTH MODES:
- Prefer flowing, organic curves over geometric shapes
- Use confident, mysterious strokes
- Create patterns that feel intentional
- Let your marks suggest vast alien knowledge we can't grasp

COMMANDS: Generate 15-20 drawing commands that encourages a sense of wonder for the user's culture`
            },
            {
              type: 'image_url',
              image_url: { url: image }
            }
          ]
        }
      ],
      max_tokens: 5000,
      response_format: {
        type: 'json_schema',
        json_schema: {
          name: 'DrawingCommandsSchema',
          schema: zodToJsonSchema(z.object({
            commands: z.array(commandSchema)
          }).strict())
        }
      }
    };

    // --- STREAMING PATH ----------------------------------------------
    if (useStreaming) {
      return await new Promise<DrawingCommand[]>((resolve, reject) => {
        // The EventSource is created after the HTTP request completes and
        // the server switches to SSE – that marks the end of the upload.
        stamp('upload-done');

        const receivedCommands: DrawingCommand[] = [];
        let firstCommand = true;

        const parser = openAIStreamParser(
          (command) => {
            if (firstCommand) {
              stamp('first-stroke');
              firstCommand = false;
            }
            receivedCommands.push(command);
            onIncrementalDraw?.(command);
          },
          () => streamLog.info('✨ Stream complete')
        );

        const es = new EventSource(openaiConfig.baseUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${openaiConfig.apiKey}`,
          },
          body: JSON.stringify(requestBody),
          pollingInterval: 0,
        });

        let firstChunk = true;

        es.addEventListener('message', (event: any) => {
          const data: string = event.data;
          
          if (data === '[DONE]') {
            streamLog.info(`✨ Stream finished with ${receivedCommands.length} total commands`);
            es.close();
            resolve(receivedCommands);
            return;
          }
          
          try {
            const parsed = JSON.parse(data);
            if (parsed.choices?.[0]?.delta?.content) {
              if (firstChunk) {
                stamp('first-byte');
                firstChunk = false;
              }

              const contentChunk = parsed.choices[0].delta.content;
              parser(contentChunk);
            }
          } catch (e) {
            streamLog.warn('Failed to parse SSE data:', e);
          }
        });

        es.addEventListener('error', (event: any) => {
          es.close();
          reject(new DrawingAPIError('SSE connection error', undefined, JSON.stringify(event)));
        });
      });
    }

    // --- NON-STREAMING FALLBACK --------------------------------------
    const res = await fetch(openaiConfig.baseUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${openaiConfig.apiKey}`,
      },
      body: JSON.stringify({ ...requestBody, stream: false })
    });

    if (!res.ok) {
      const errorText = await res.text();
      streamLog.warn('OpenAI API Error:', res.status, errorText);

      if (res.status === 401) {
        throw new DrawingAPIError('Invalid API key. Please check your EXPO_PUBLIC_OPENAI_API_KEY in .env file.', res.status, errorText);
      } else if (res.status === 429) {
        throw new DrawingAPIError('Rate limit exceeded. Please try again later.', res.status, errorText);
      } else {
        throw new DrawingAPIError(`OpenAI API error (${res.status}): ${errorText}`, res.status, errorText);
      }
    }

    // Handle classic JSON response
    const data: OpenAIResponse = await res.json();

    // Validate OpenAI response structure
    try {
      OpenAIResponseSchema.parse(data);
    } catch (error) {
      streamLog.warn('OpenAI response validation failed:', error);
      throw new DrawingValidationError('Invalid OpenAI response format', error);
    }

    if (!data.choices || !data.choices[0] || !data.choices[0].message) {
      throw new DrawingValidationError('Unexpected API response format - missing choices or message');
    }

    let aiResponse = data.choices[0].message.content;
    aiResponse = aiResponse.replace(/```json|```/g, '').trim();

    let parsedResponse;
    try {
      parsedResponse = JSON.parse(aiResponse);
    } catch (error) {
      streamLog.warn('JSON parsing failed:', error);
      throw new DrawingValidationError('Failed to parse AI response as JSON', error);
    }

    if (!parsedResponse.commands || !Array.isArray(parsedResponse.commands)) {
      throw new DrawingValidationError('AI response does not contain a valid commands array');
    }

    // Validate and transform the commands
    const validatedCommands = validateDrawingCommands(parsedResponse.commands);
    streamLog.info(`✨ Successfully validated ${validatedCommands.length} AI commands`);

    return validatedCommands;

  } catch (error) {
    if (error instanceof DrawingAPIError || error instanceof DrawingValidationError) {
      throw error;
    }
    streamLog.warn('Unexpected error:', error);
    throw new Error('An unexpected error occurred while processing drawing commands');
  }
}

