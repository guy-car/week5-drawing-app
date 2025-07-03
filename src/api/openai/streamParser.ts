import { streamLog } from './config';

/**
 * Creates a streaming JSON parser that processes chunks of text and extracts complete JSON objects.
 * Handles OpenAI streaming responses where JSON objects may be split across multiple chunks.
 * 
 * @param callback Function to call with each complete parsed JSON object
 * @returns A function that accepts string chunks to parse
 */
export const streamParser = (callback: (obj: any) => void) => {
  let buffer = '';
  let foundCommandsArray = false;
  let processedCommands = new Set<string>(); // Track processed commands to avoid duplicates
  let totalCommandsEmitted = 0;

  return (chunk: string) => {
    buffer += chunk;
    streamLog.debug('🔄 Parser received chunk:', JSON.stringify(chunk));
    
    // First, check if we've found the commands array start
    if (!foundCommandsArray && buffer.includes('"commands":[')) {
      streamLog.debug('📍 Found commands array in buffer');
      foundCommandsArray = true;
      // Trim everything before the commands array
      const commandsStart = buffer.indexOf('"commands":[') + '"commands":['.length;
      buffer = buffer.slice(commandsStart);
      streamLog.debug('🔧 Buffer trimmed to start from commands array');
    }
    
    if (!foundCommandsArray) {
      streamLog.debug('⏳ Still waiting for commands array...');
      return;
    }
    
    // Now look for complete command objects
    let searchStart = 0;
    let objectsFoundInThisChunk = 0;
    
    streamLog.debug(`🔍 Starting search in buffer (length: ${buffer.length})`);
    
    while (true) {
      // Find the start of a potential command object
      const objectStart = buffer.indexOf('{', searchStart);
      if (objectStart === -1) {
        streamLog.debug('🔍 No more opening braces found in buffer');
        break;
      }
      
      // Find the matching closing brace
      let braceDepth = 0;
      let inString = false;
      let escaped = false;
      let objectEnd = -1;
      
      for (let i = objectStart; i < buffer.length; i++) {
        const char = buffer[i];
        
        if (escaped) {
          escaped = false;
          continue;
        }
        
        if (char === '\\') {
          escaped = true;
          continue;
        }
        
        if (char === '"') {
          inString = !inString;
          continue;
        }
        
        // Only process structural characters when not in a string
        if (!inString) {
          if (char === '{') {
            braceDepth++;
          } else if (char === '}') {
            braceDepth--;
            if (braceDepth === 0) {
              objectEnd = i;
              break;
            }
          }
        }
      }
      
      if (objectEnd === -1) {
        streamLog.debug('🔍 Incomplete object found, waiting for more data...');
        break;
      }
      
      // Extract the complete object
      const objectJson = buffer.slice(objectStart, objectEnd + 1);
      
      // Check for duplicates
      const objectHash = JSON.stringify(objectJson);
      if (processedCommands.has(objectHash)) {
        streamLog.debug('🚫 Skipping duplicate command');
        searchStart = objectEnd + 1;
        continue;
      }
      
      try {
        const parsed = JSON.parse(objectJson);
        if (parsed && typeof parsed === 'object' && 'type' in parsed) {
          // Mark as processed
          processedCommands.add(objectHash);
          totalCommandsEmitted++;
          objectsFoundInThisChunk++;
          
          streamLog.debug(`✅ Parsed command #${totalCommandsEmitted}`);
          callback(parsed);
        }
      } catch (error) {
        streamLog.warn('❌ Failed to parse object JSON:', error);
      }
      
      // Move search start past this object
      searchStart = objectEnd + 1;
      
      // Remove processed part from buffer to prevent memory buildup
      if (searchStart > 1000) {
        buffer = buffer.slice(searchStart);
        searchStart = 0;
        streamLog.debug('🧹 Buffer trimmed to prevent memory buildup');
      }
    }
  
  };
};

/**
 * Creates a parser for OpenAI Server-Sent Events (SSE) streaming format.
 * Handles the specific format: "data: {json}\n\ndata: [DONE]"
 * 
 * @param onChunk Callback for each drawing command object
 * @param onComplete Optional callback when stream ends with [DONE]
 * @returns Function that accepts SSE chunks
 */
export const openAIStreamParser = (
  onChunk: (obj: any) => void, 
  onComplete?: () => void
) => {
  const jsonParser = streamParser((obj) => {
    streamLog.debug('🎨 Received command from streamParser');
    onChunk(obj);
  });

  return (chunk: string) => {
    if (chunk.includes('[DONE]')) {
      streamLog.info('✨ SSE stream finished with [DONE]');
      onComplete?.();
      return;
    }
    
    streamLog.debug('📡 Received SSE chunk');
    jsonParser(chunk);
  };
}; 