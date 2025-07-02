import { DrawingCommand, riffResponseJsonSchema, RiffResponse } from './types';
import { VectorSummary } from '../../utils/vectorSummary';
import { OPENAI_API_KEY } from './config';
import { StreamJsonParser } from '../../utils/streamJsonParser';
import { RIFF_PROMPT } from './prompts';
import { Platform } from 'react-native';

const BASE_URL = 'https://api.openai.com/v1/chat/completions';

// Helper function to check if fetch supports streaming
const checkStreamSupport = async (): Promise<boolean> => {
  try {
    const response = await fetch('https://httpbin.org/stream/1');
    return response.body !== undefined;
  } catch (e) {
    return false;
  }
};

export async function riffOnSketch(
  image: string,
  summary: VectorSummary,
  onCommand: (cmd: DrawingCommand) => void
): Promise<void> {
  // Performance logging
  const stamp = (label: string) => console.timeStamp ? console.timeStamp(label) : console.log(label);
  stamp('riff-start');

  try {
    // Check if streaming is supported
    const supportsStream = !Platform.OS.startsWith('web') || await checkStreamSupport();
    
    const requestBody = {
      model: 'gpt-4o',
      stream: supportsStream,
      response_format: { 
        type: 'json_schema',
        json_schema: {
          name: 'RiffResponse',
          schema: riffResponseJsonSchema
        }
      },
      messages: [{
        role: 'user',
        content: [
          { 
            type: 'text', 
            text: RIFF_PROMPT.replace('{{summary}}', JSON.stringify(summary, null, 2))
          },
          { 
            type: 'image_url', 
            image_url: { url: image }
          }
        ]
      }]
    };

    const response = await fetch(BASE_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${OPENAI_API_KEY}`,
      },
      body: JSON.stringify(requestBody)
    });

    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }

    if (supportsStream && response.body) {
      stamp('first-chunk');

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      
      const parser = new StreamJsonParser({
        onCommand: (cmd) => {
          stamp('command-received');
          onCommand(cmd);
        },
        onAnalysis: (analysis) => {
          stamp('analysis-received');
          console.log('Sketch analysis:', analysis);
        }
      });

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        const chunk = decoder.decode(value, { stream: true });
        parser.processChunk(chunk);
      }
    } else {
      // Fallback for non-streaming environments
      stamp('non-streaming-response');
      const data = await response.json() as { choices: [{ message: { content: string } }] };
      const content = data.choices[0].message.content;
      const result = JSON.parse(content) as RiffResponse;

      // Log analysis
      console.log('Sketch analysis:', result.analysis);
      stamp('analysis-received');

      // Send commands with a small delay between each
      for (let i = 0; i < result.commands.length; i++) {
        const cmd = result.commands[i];
        setTimeout(() => {
          stamp('command-received');
          onCommand(cmd);
        }, i * 40); // 25fps animation
      }
    }

    stamp('riff-complete');
  } catch (error) {
    console.error('Error in riffOnSketch:', error);
    throw error;
  }
} 