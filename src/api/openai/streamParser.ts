/**
 * Creates a streaming JSON parser that processes chunks of text and extracts complete JSON objects.
 * Handles OpenAI streaming responses where JSON objects may be split across multiple chunks.
 * 
 * @param callback Function to call with each complete parsed JSON object
 * @returns A function that accepts string chunks to parse
 */
export const streamParser = (callback: (obj: any) => void) => {
  let buffer = '';

  return (chunk: string) => {
    buffer += chunk;
    
    let depth = 0;
    let inString = false;
    let escaped = false;
    let startIndex = 0;
    
    for (let i = 0; i < buffer.length; i++) {
      const char = buffer[i];
      
      // Handle string state to ignore braces inside strings
      if (char === '"' && !escaped) {
        inString = !inString;
      }
      
      // Handle escape sequences
      escaped = char === '\\' && !escaped;
      
      // Only count braces when not inside strings
      if (!inString) {
        if (char === '{') {
          // If this is the first opening brace, mark the start
          if (depth === 0) {
            startIndex = i;
          }
          depth++;
        } else if (char === '}') {
          depth--;
          
          // When depth reaches 0, we have a complete JSON object
          if (depth === 0) {
            const json = buffer.slice(startIndex, i + 1);
            try {
              const parsed = JSON.parse(json);
              callback(parsed);
            } catch (error) {
              console.warn('Failed to parse JSON chunk:', json, error);
            }
          }
        }
      }
    }
    
    // Clean up the buffer - keep only the incomplete part
    if (depth === 0) {
      // No incomplete JSON, clear the buffer
      buffer = '';
    } else {
      // Keep the incomplete JSON starting from startIndex
      buffer = buffer.slice(startIndex);
    }
  };
};

/**
 * Creates a parser for OpenAI Server-Sent Events (SSE) streaming format.
 * Handles the specific format: "data: {json}\n\ndata: [DONE]"
 * 
 * @param onChunk Callback for each JSON object with 'type' field
 * @param onComplete Optional callback when stream ends with [DONE]
 * @returns Function that accepts SSE chunks
 */
export const openAIStreamParser = (
  onChunk: (obj: any) => void, 
  onComplete?: () => void
) => {
  let sseBuffer = '';
  const jsonParser = streamParser((obj) => {
    // Only dispatch objects with a 'type' field (drawing commands)
    if (obj && typeof obj === 'object' && 'type' in obj) {
      onChunk(obj);
    }
  });

  return (chunk: string) => {
    sseBuffer += chunk;
    
    // Process complete SSE events (ending with \n\n)
    const events = sseBuffer.split('\n\n');
    // Keep the last incomplete event in the buffer
    sseBuffer = events.pop() || '';
    
    for (const event of events) {
      const lines = event.split('\n');
      
      for (const line of lines) {
        const trimmed = line.trim();
        
        if (trimmed.startsWith('data: ')) {
          const data = trimmed.slice(6); // Remove 'data: ' prefix
          
          if (data === '[DONE]') {
            onComplete?.();
            return;
          }
          
          // Try to parse the JSON directly first
          try {
            const parsed = JSON.parse(data);
            if (parsed && typeof parsed === 'object' && 'type' in parsed) {
              onChunk(parsed);
            }
          } catch {
            // If direct parsing fails, use the streaming parser for partial JSON
            jsonParser(data);
          }
        }
      }
    }
  };
}; 