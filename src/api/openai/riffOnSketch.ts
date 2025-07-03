import { openaiConfig } from './config';
import { DrawingCommand, commandSchema, validateDrawingCommands, OpenAIResponse, OpenAIResponseSchema } from './types';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { VectorSummary } from '../../utils/vectorSummary';
import { z } from 'zod';

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
  summary: VectorSummary;
}

export async function riffOnSketch({ image, summary }: RiffReq): Promise<DrawingCommand[]> {
  console.log('🎨 Starting riff-on-sketch analysis...');
  console.log('🔑 Using API key:', openaiConfig.apiKey?.substring(0, 10) + '...');

  // Step 1: Validate inputs
  console.log('📊 Validating inputs...');
  if (!image) {
    throw new DrawingAPIError('Failed to export canvas image');
  }
  console.log('✅ Inputs validated successfully');
  console.log('📈 Vector summary:', JSON.stringify(summary, null, 2));

  // Step 2: Send to OpenAI Vision API
  console.log('🤖 Sending to OpenAI Vision API...');

  try {
    const res = await fetch(openaiConfig.baseUrl, {
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
                text: `Here is a vector summary of the drawing:
${JSON.stringify(summary, null, 2)}

Based on this analysis, please add creative elements that complement the existing drawing.
Focus on the dominant angles (${summary.dominantAngles.join(', ')}°) and work within the bounding box:
- minX: ${summary.boundingBox.minX}
- minY: ${summary.boundingBox.minY}
- maxX: ${summary.boundingBox.maxX}
- maxY: ${summary.boundingBox.maxY}

RULES:
- Start each new shape with moveTo (except circles)
- Generate 10-50 commands total
- All coordinates must be between 0-1000
- Circle radius must be between 1-500
- Use similar segment lengths (around ${Math.round(summary.avgSegment)} units)
- Respect the existing shape distribution in your additions`
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
      })
    });

    if (!res.ok) {
      const errorText = await res.text();
      console.error('❌ OpenAI API Error:', res.status, errorText);

      if (res.status === 401) {
        throw new DrawingAPIError('Invalid API key. Please check your EXPO_PUBLIC_OPENAI_API_KEY in .env file.', res.status, errorText);
      } else if (res.status === 429) {
        throw new DrawingAPIError('Rate limit exceeded. Please try again later.', res.status, errorText);
      } else {
        throw new DrawingAPIError(`OpenAI API error (${res.status}): ${errorText}`, res.status, errorText);
      }
    }

    const data: OpenAIResponse = await res.json();
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

import { openAIStreamParser } from './streamParser';

/**
 * TEST FUNCTION: Validates streaming parser with realistic OpenAI data
 * Call this from your drawing app to test before implementing full streaming
 */
export async function testStreamingParser(): Promise<DrawingCommand[]> {
  console.log('🧪 Testing streaming parser with realistic data...');
  
  const receivedCommands: DrawingCommand[] = [];
  let isComplete = false;

  const parser = openAIStreamParser(
    (command) => {
      console.log('🎨 Parsed command:', command);
      receivedCommands.push(command);
    },
    () => {
      console.log('✅ Stream parsing complete!');
      isComplete = true;
    }
  );

  // Simulate realistic OpenAI streaming response
  const mockStreamChunks = [
    // OpenAI metadata (should be ignored)
    'data: {"id":"chatcmpl-test","object":"chat.completion.chunk","created":1699999999,"model":"gpt-4o","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}\n\n',
    
    // Drawing commands - some split across chunks (REAL TEST!)
    'data: {"type":"move',  // Split command
    'To","x":100,"y":100}\n\n',  // Complete the split
    
    'data: {"type":"lineTo","x":200,"y":100}\n\n',  // Complete command
    
    'data: {"type":"lineTo","x":200,"y":200}\n\n',
    
    // Split in middle of property name (EDGE CASE!)
    'data: {"type":"quad',
    'To","x1":200,"y1":200,"x2":250,"y2":150,"x3":300,"y3":200}\n\n',
    
    'data: {"type":"addCircle","cx":150,"cy":150,"radius":30}\n\n',
    
    // More OpenAI metadata (should be ignored)
    'data: {"id":"chatcmpl-test","choices":[{"delta":{"content":""},"finish_reason":"stop"}]}\n\n',
    
    'data: [DONE]\n\n'
  ];

  // Process chunks sequentially (simulating network arrival)
  for (const chunk of mockStreamChunks) {
    console.log('📡 Processing chunk:', JSON.stringify(chunk.slice(0, 50)) + '...');
    parser(chunk);
    
    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 50));
  }

  console.log(`🎉 Test complete! Received ${receivedCommands.length} commands`);
  console.log('📋 Commands:', receivedCommands);
  
  if (!isComplete) {
    throw new Error('Stream did not complete properly');
  }

  if (receivedCommands.length !== 5) {
    throw new Error(`Expected 5 commands, got ${receivedCommands.length}`);
  }

  // Validate specific commands
  const expectedCommands = [
    { type: 'moveTo', x: 100, y: 100 },
    { type: 'lineTo', x: 200, y: 100 },
    { type: 'lineTo', x: 200, y: 200 },
    { type: 'quadTo', x1: 200, y1: 200, x2: 250, y2: 150, x3: 300, y3: 200 },
    { type: 'addCircle', cx: 150, cy: 150, radius: 30 }
  ];

  for (let i = 0; i < expectedCommands.length; i++) {
    const received = receivedCommands[i];
    const expected = expectedCommands[i];
    
    if (JSON.stringify(received) !== JSON.stringify(expected)) {
      throw new Error(`Command ${i} mismatch. Expected: ${JSON.stringify(expected)}, Got: ${JSON.stringify(received)}`);
    }
  }

  console.log('✅ ALL TESTS PASSED! Streaming parser is working correctly!');
  return receivedCommands;
}