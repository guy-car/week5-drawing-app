import { openaiConfig } from './config';
import { OpenAIResponseSchema, OpenAIResponse, commandSchema, validateDrawingCommands, DrawingCommands, DrawingCommand } from './types';
import { zodToJsonSchema } from 'zod-to-json-schema';
import { z } from 'zod';
import { expPrompt2, expPrompt1, expPrompt3, expPrompt4, expPrompt5 } from './experiments'

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
                text: expPrompt5
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

export async function analyzeThenDraw(base64Image: string): Promise<DrawingCommands> {
  console.log('🔍 Starting two-step AI analysis...');
  console.log('🔑 Using API key:', openaiConfig.apiKey?.substring(0, 10) + '...');

  if (!base64Image) {
    throw new DrawingAPIError('Failed to export canvas image');
  }

  try {
    // STEP 1: Combined Vision + Intention Analysis
    console.log('📋 Step 1: Getting AI understanding (vision + intention)...');
    
    const analysisResponse = await fetch(openaiConfig.baseUrl, {
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
                text: `Analyze this drawing on a 1000x1000 pixel canvas where (0,0) is top-left and (1000,1000) is bottom-right.

Please provide:

1. VISION: What do you see? Describe shapes, their approximate coordinates, and spatial relationships.

2. INTENTION: What would naturally complete or enhance this drawing? Be specific about:
   - What you want to add
   - Where it should go (approximate coordinates)
   - Why this addition makes sense

Be detailed and specific about locations using the 1000x1000 coordinate system.`
              },
              {
                type: 'image_url',
                image_url: { url: base64Image }
              }
            ]
          }
        ],
        max_tokens: 800
      })
    });

    if (!analysisResponse.ok) {
      const errorText = await analysisResponse.text();
      throw new DrawingAPIError(`Analysis API error (${analysisResponse.status}): ${errorText}`, analysisResponse.status, errorText);
    }

    const analysisData: OpenAIResponse = await analysisResponse.json();
    const analysis = analysisData.choices[0].message.content;
    console.log('🧠 AI Analysis:', analysis);

    // STEP 2: Generate Drawing Commands Based on Analysis
    console.log('⚡ Step 2: Generating drawing commands based on analysis...');
    
    const commandResponse = await fetch(openaiConfig.baseUrl, {
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
                text: `Based on your previous analysis:

"${analysis}"

Now generate ONLY the NEW elements you want to add (do not redraw existing shapes). 

IMPORTANT - Each shape must be a proper connected path:

FOR CIRCLES (like eyes): Use addCircle only
- Example: {"type": "addCircle", "cx": 525, "cy": 450, "radius": 20}

FOR LINES/CURVES (like hair, eyebrows, ears): Start with moveTo, then connect
- Example eyebrow: 
  {"type": "moveTo", "x": 470, "y": 430},
  {"type": "quadTo", "x1": 480, "y1": 425, "x2": 490, "y2": 430}

- Example ear:
  {"type": "moveTo", "x": 350, "y": 480},
  {"type": "quadTo", "x1": 330, "y1": 500, "x2": 350, "y2": 520}

RULES:
- Start each new shape with moveTo (except circles)
- Only add the NEW elements from your intention
- All coordinates 0-1000, radius 1-500
- Generate 3-15 commands total

Based on your analysis, create commands for the specific new elements you described.`
              },
              {
                type: 'image_url',
                image_url: { url: base64Image }
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

    if (!commandResponse.ok) {
      const errorText = await commandResponse.text();
      throw new DrawingAPIError(`Commands API error (${commandResponse.status}): ${errorText}`, commandResponse.status, errorText);
    }

    const commandData: OpenAIResponse = await commandResponse.json();
    console.log('🎨 AI Commands Response:', JSON.stringify(commandData, null, 2));

    // Validate and parse the commands
    OpenAIResponseSchema.parse(commandData);
    
    let aiResponse = commandData.choices[0].message.content;
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

    const validatedCommands = validateDrawingCommands(parsedResponse.commands);
    console.log('✅ Two-step analysis complete! Generated commands:', validatedCommands);

    return validatedCommands;

  } catch (error) {
    if (error instanceof DrawingAPIError || error instanceof DrawingValidationError) {
      throw error;
    }
    console.error('❌ Unexpected error in two-step analysis:', error);
    throw new Error('An unexpected error occurred during two-step drawing analysis');
  }
}


///// CURRENT PROMPT
export async function analyzeThenDrawWithContext(base64Image: string, existingCommands: DrawingCommand[]): Promise<DrawingCommands> {
  console.log('🔍 Starting context-aware two-step AI analysis...');
  console.log('🔑 Using API key:', openaiConfig.apiKey?.substring(0, 10) + '...');
  console.log(`📊 Analyzing with ${existingCommands.length} existing drawing commands as context`);

  if (!base64Image) {
    throw new DrawingAPIError('Failed to export canvas image');
  }

  try {
    // STEP 1: Enhanced Vision + Command Context Analysis
    console.log('📋 Step 1: Getting AI understanding (vision + command context analysis)...');
    
    // Create a summary of existing commands for context
    const commandSummary = existingCommands.length > 0 
      ? `\n\nEXISTING DRAWING COMMAND CONTEXT:
The user has already drawn on this canvas using ${existingCommands.length} commands. Here are the drawing commands that created this image:

${existingCommands.map((cmd: any, i) => {
  switch (cmd.type) {
    case 'moveTo':
      return `${i + 1}. moveTo(${cmd.x}, ${cmd.y}) - Started drawing at position`;
    case 'lineTo':
      return `${i + 1}. lineTo(${cmd.x}, ${cmd.y}) - Drew line to position`;
    case 'quadTo':
      return `${i + 1}. quadTo(${cmd.x1}, ${cmd.y1}, ${cmd.x2}, ${cmd.y2}) - Drew curve via control point`;
    case 'cubicTo':
      return `${i + 1}. cubicTo(${cmd.x1}, ${cmd.y1}, ${cmd.x2}, ${cmd.y2}, ${cmd.x3}, ${cmd.y3}) - Drew cubic curve`;
    case 'addCircle':
      return `${i + 1}. addCircle(${cmd.cx}, ${cmd.cy}, r:${cmd.radius}) - Drew circle`;
    default:
      return `${i + 1}. ${cmd.type} - Unknown command`;
  }
}).join('\n')}

This gives you EXACT insight into:
- How the user draws (their scale preferences, coordinate ranges)
- What stroke patterns they use
- The typical size of elements they create
- Their drawing style and approach

Use this context to understand the existing drawing better and match the user's drawing style when adding new elements.`
      : '\n\nNOTE: This is a blank canvas with no existing drawing commands.';
    
    const analysisResponse = await fetch(openaiConfig.baseUrl, {
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
                text: `Analyze this drawing on a 1000x1000 pixel canvas where (0,0) is top-left and (1000,1000) is bottom-right.${commandSummary}

Please provide:

1. VISION: What do you see? Describe shapes, their approximate coordinates, and spatial relationships.

2. COMMAND ANALYSIS: Based on the existing drawing commands:
   - What scale does the user prefer? (look at coordinate ranges)
   - What drawing patterns do they use? (moveTo/lineTo sequences, circle sizes, etc.)
   - What's their typical stroke style?

3. INTENTION: What would naturally complete or enhance this drawing? Be specific about:
   - What you want to add
   - Where it should go (approximate coordinates that match user's scale)
   - Why this addition makes sense
   - How it should match the user's existing drawing style

Be detailed and specific about locations using the 1000x1000 coordinate system, and ensure your suggestions match the scale and style evident from the existing commands.`
              },
              {
                type: 'image_url',
                image_url: { url: base64Image }
              }
            ]
          }
        ],
        max_tokens: 1000
      })
    });

    if (!analysisResponse.ok) {
      const errorText = await analysisResponse.text();
      throw new DrawingAPIError(`Analysis API error (${analysisResponse.status}): ${errorText}`, analysisResponse.status, errorText);
    }

    const analysisData: OpenAIResponse = await analysisResponse.json();
    const analysis = analysisData.choices[0].message.content;
    console.log('🧠 AI Context Analysis:', analysis);

    // STEP 2: Generate Drawing Commands Based on Context-Aware Analysis
    console.log('⚡ Step 2: Generating context-aware drawing commands...');
    
    const commandResponse = await fetch(openaiConfig.baseUrl, {
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
                text: `Based on your previous context-aware analysis:

"${analysis}"

Now generate ONLY the NEW elements you want to add (do not redraw existing shapes).

ARTISTIC APPROACH:
You are a creative artist collaborating with a human. Your goal is to add meaningful elements that enhance the artistic composition.

EXPANDED COMMAND PALETTE:
You now have these expressive tools:

GEOMETRIC SHAPES:
- addCircle: Perfect circles (eyes, dots, suns)
- addOval: Ellipses (faces, eggs, organic shapes)  
- addRect: Rectangles (buildings, frames, geometric elements)
- addArc: Partial circles (smiles, eyebrows, rainbows)
- addRoundRect: Rounded rectangles (buttons, panels, soft geometric elements)

FLOWING LINES:
- moveTo + lineTo: Sharp, precise lines
- moveTo + quadTo: Smooth curves (hair, flowing elements)
- moveTo + cubicTo: Complex curves (artistic flourishes)

STYLE MATCHING: Match the user's drawing approach:
- If they use many small lineTo steps, use similar small steps
- If they use large coordinate jumps, match that style
- If they draw circles of certain sizes, use similar proportions
- Follow their spacing and positioning patterns

COMMAND EXAMPLES:

FOR GEOMETRIC SHAPES:
{"type": "addCircle", "cx": 525, "cy": 450, "radius": 20}
{"type": "addOval", "x": 400, "y": 300, "width": 60, "height": 40}
{"type": "addRect", "x": 200, "y": 200, "width": 100, "height": 80}
{"type": "addArc", "x": 470, "y": 480, "width": 60, "height": 30, "startAngle": 0, "sweepAngle": 180}
{"type": "addRoundRect", "x": 300, "y": 300, "width": 120, "height": 80, "rx": 15, "ry": 15}

FOR LINES/CURVES:
{"type": "moveTo", "x": 470, "y": 430},
{"type": "quadTo", "x1": 480, "y1": 425, "x2": 490, "y2": 430}

{"type": "moveTo", "x": 350, "y": 480},
{"type": "cubicTo", "x1": 330, "y1": 500, "x2": 320, "y2": 520, "x3": 350, "y3": 540}

RULES:
- Start each new shape with moveTo (except for geometric shapes)
- Only add the NEW elements from your intention
- All coordinates 0-1000
- Circle radius 1-500
- Generate 3-20 commands total
- MATCH the scale and style patterns from existing commands

Based on your context-aware analysis, create commands for the specific new elements you described, ensuring they match the user's established drawing style and scale.`
              },
              {
                type: 'image_url',
                image_url: { url: base64Image }
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

    if (!commandResponse.ok) {
      const errorText = await commandResponse.text();
      throw new DrawingAPIError(`Commands API error (${commandResponse.status}): ${errorText}`, commandResponse.status, errorText);
    }

    const commandData: OpenAIResponse = await commandResponse.json();
    console.log('🎨 AI Context-Aware Commands Response:', JSON.stringify(commandData, null, 2));

    // Validate and parse the commands
    OpenAIResponseSchema.parse(commandData);
    
    let aiResponse = commandData.choices[0].message.content;
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

    const validatedCommands = validateDrawingCommands(parsedResponse.commands);
    console.log('✅ Context-aware two-step analysis complete! Generated commands:', validatedCommands);
    console.log(`📊 Context used: ${existingCommands.length} existing commands → ${validatedCommands.length} new commands`);

    return validatedCommands;

  } catch (error) {
    if (error instanceof DrawingAPIError || error instanceof DrawingValidationError) {
      throw error;
    }
    console.error('❌ Unexpected error in context-aware analysis:', error);
    throw new Error('An unexpected error occurred during context-aware drawing analysis');
  }
} 