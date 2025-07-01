import { openaiConfig } from './config';
import { OpenAIResponseSchema, OpenAIResponse } from './types';

export async function debugDrawingIntention(base64Image: string): Promise<string> {
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
              text: 'Looking at this drawing, I want you to explain your creative process:\n\n1. What do you see in the image?\n2. What would you like to add to complement or enhance this drawing?\n3. Why did you choose that specific addition?\n4. Where approximately would you place it? (describe in general terms like "top-left", "center", "bottom-right")\n5. What shape or line would achieve your creative goal?\n\nPlease be specific about your reasoning and placement strategy. Do NOT generate coordinates yet - just explain your artistic intention.'
            },
            {
              type: 'image_url',
              image_url: { url: base64Image }
            }
          ]
        }
      ],
      max_tokens: 600
    })
  });

  if (!response.ok) {
    throw new Error(`API error: ${response.status}`);
  }

  const data: OpenAIResponse = await response.json();
  OpenAIResponseSchema.parse(data);
  return data.choices[0].message.content;
} 