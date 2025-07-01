import { openaiConfig } from './config';
import { OpenAIResponseSchema, OpenAIResponse } from './types';

export async function proceedWithAPICall(base64Image: string): Promise<any[]> {
  console.log('🧪 Starting AI integration test...');
  console.log('🔑 Using API key:', openaiConfig.apiKey?.substring(0, 10) + '...');

  // Step 1: Export canvas as base64 image
  console.log('📸 Exporting canvas...');
  if (!base64Image) {
    throw new Error('Failed to export canvas image');
  }

  console.log('✅ Canvas exported successfully');

  // Step 2: Send to OpenAI Vision API
  console.log('🤖 Sending to OpenAI Vision API...');

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

Please:
1. Analyze what's currently drawn
2. Add ONE simple complementary line or shape
3. Ensure ALL coordinates are within 0-1000 range
4. Respond with ONLY a JSON array of drawing commands

Format: [{"type": "moveTo", "x": number, "y": number}, {"type": "lineTo", "x": number, "y": number}, ...]

Important: 
- x and y must be integers between 0 and 1000
- Start with moveTo, then use lineTo commands
- Keep it simple (3-8 commands max)`
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
      max_tokens: 1000
    })
  });

  if (!response.ok) {
    const errorData = await response.text();
    console.error('❌ OpenAI API Error:', response.status, errorData);

    if (response.status === 401) {
      throw new Error('Invalid API key. Please check your EXPO_PUBLIC_OPENAI_API_KEY in .env file.');
    } else if (response.status === 429) {
      throw new Error('Rate limit exceeded. Please try again later.');
    } else {
      throw new Error(`OpenAI API error (${response.status}): ${errorData}`);
    }
  }

  const data: OpenAIResponse = await response.json();
  OpenAIResponseSchema.parse(data);
  console.log('🎉 OpenAI API Response:', JSON.stringify(data, null, 2));

  if (data.choices && data.choices[0] && data.choices[0].message) {
    let aiResponse = data.choices[0].message.content;
    console.log('🤖 AI Generated Commands:', aiResponse);

    // Remove backticks and parse the JSON
    aiResponse = aiResponse.replace(/```json|```/g, '').trim();
    const commands = JSON.parse(aiResponse);

    if (!Array.isArray(commands)) {
      throw new Error('AI response is not an array of commands');
    }

    console.log('✅ Successfully parsed AI commands:', commands);

    // Convert array-format commands to object format
    return commands.map(cmd => {
      const type = Object.keys(cmd)[0];
      const [x, y] = cmd[type];

      return {
        type: type,
        x: x,
        y: y
      };
    });
  } else {
    throw new Error('Unexpected API response format');
  }
} 