import { openaiConfig } from './config';
import { OpenAIResponseSchema, OpenAIResponse } from './types';

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
              text: 'Draw a circle centered at x=200, y=200 with radius 50. \nUse these exact commands:\nmoveTo 250 200\nlineTo commands to approximate a circle\n\nRespond with ONLY a JSON array of commands.\nIMPORTANT: Use INTEGER coordinates only, no decimals.\nFormat: [{"moveTo": [x, y]}, {"lineTo": [x, y]}, ...]\n\nExample:\n[{"moveTo": [250, 200]}, {"lineTo": [225, 225]}]'
            }
          ]
        }
      ],
      max_tokens: 500
    })
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data: OpenAIResponse = await response.json();
  OpenAIResponseSchema.parse(data);
  let aiResponse = data.choices[0].message.content;

  // Clean the response
  aiResponse = aiResponse.replace(/```json|```/g, '').trim();
  const commands = JSON.parse(aiResponse);

  if (!Array.isArray(commands)) {
    throw new Error('AI response is not an array of commands');
  }

  // Convert array-format commands to object format
  return commands.map(cmd => {
    const type = Object.keys(cmd)[0];
    const [x, y] = cmd[type];
    return {
      type: type,
      x: Math.round(x),
      y: Math.round(y)
    };
  });
} 