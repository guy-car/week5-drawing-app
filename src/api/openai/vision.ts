import { openaiConfig } from './config';
import { OpenAIResponseSchema, OpenAIResponse } from './types';

export async function debugAIVision(base64Image: string): Promise<string> {
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
              text: 'Describe in detail what you see in this drawing. Include:\n1. What objects/shapes are drawn\n2. Their approximate positions (describe as percentages from top-left)\n3. The overall composition\n4. Any patterns or relationships between elements\n\nBe very specific about locations and shapes.'
            },
            {
              type: 'image_url',
              image_url: { url: base64Image }
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
  return data.choices[0].message.content;
} 