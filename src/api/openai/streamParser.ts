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
    console.log('🔄 Parser received chunk:', JSON.stringify(chunk));
    
    // First, check if we've found the commands array start
    if (!foundCommandsArray && buffer.includes('"commands":[')) {
      console.log('📍 Found commands array in buffer');
      foundCommandsArray = true;
      // Trim everything before the commands array
      const commandsStart = buffer.indexOf('"commands":[') + '"commands":['.length;
      buffer = buffer.slice(commandsStart);
      console.log('🔧 Buffer trimmed to start from commands array:', JSON.stringify(buffer.slice(0, 100)) + '...');
    }
    
    if (!foundCommandsArray) {
      console.log('⏳ Still waiting for commands array...');
      return;
    }
    
    // Now look for complete command objects
    // Pattern: {"type":"...","x":...,"y":...} or similar
    let searchStart = 0;
    let objectsFoundInThisChunk = 0;
    
    console.log(`🔍 Starting search in buffer (length: ${buffer.length}, searchStart: ${searchStart})`);
    
    while (true) {
      // Find the start of a potential command object
      const objectStart = buffer.indexOf('{', searchStart);
      if (objectStart === -1) {
        console.log('🔍 No more opening braces found in buffer');
        break;
      }
      
      console.log(`🎯 Found opening brace at position ${objectStart} (relative to searchStart: ${objectStart - searchStart})`);
      
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
              console.log(`✅ Found matching closing brace at position ${objectEnd} (depth returned to 0)`);
              break;
            }
          }
        }
      }
      
      if (objectEnd === -1) {
        console.log('🔍 Incomplete object found, waiting for more data...');
        break;
      }
      
      // Extract the complete object
      const objectJson = buffer.slice(objectStart, objectEnd + 1);
      console.log('🎯 Complete object found:', objectJson);
      
      // Check for duplicates
      const objectHash = JSON.stringify(objectJson); // Simple hash for duplicate detection
      if (processedCommands.has(objectHash)) {
        console.log('🚫 DUPLICATE DETECTED - skipping object:', objectJson);
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
          
          console.log(`✅ Successfully parsed command #${totalCommandsEmitted}:`, JSON.stringify(parsed));
          console.log('🚀 Sending command to callback:', parsed);
          callback(parsed);
        } else {
          console.log('⚠️ Object is not a drawing command:', parsed);
        }
      } catch (error) {
        console.warn('❌ Failed to parse object JSON:', objectJson, error);
      }
      
      // Move search start past this object
      const newSearchStart = objectEnd + 1;
      console.log(`➡️ Moving searchStart from ${searchStart} to ${newSearchStart}`);
      searchStart = newSearchStart;
      
      // Remove processed part from buffer to prevent memory buildup
      if (searchStart > 1000) { // Only trim if buffer is getting large
        const trimmedLength = searchStart;
        buffer = buffer.slice(searchStart);
        searchStart = 0;
        console.log(`🧹 Buffer trimmed by ${trimmedLength} characters to prevent memory buildup`);
      }
    }
    
    console.log(`📊 Chunk summary - objectsFound: ${objectsFoundInThisChunk}, totalEmitted: ${totalCommandsEmitted}, duplicatesTracked: ${processedCommands.size}, bufferLength: ${buffer.length}`);
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
  // Create a JSON parser that will accumulate chunks until it finds complete objects
  const jsonParser = streamParser((obj) => {
    console.log('🎨 openAIStreamParser received command from streamParser:', JSON.stringify(obj));
    onChunk(obj);
  });

  return (chunk: string) => {
    console.log('📡 openAIStreamParser received chunk:', JSON.stringify(chunk));
    jsonParser(chunk);
  };
}; 