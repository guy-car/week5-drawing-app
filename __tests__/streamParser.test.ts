import { streamParser, openAIStreamParser } from '../src/api/openai/streamParser';

describe('streamParser', () => {
  it('should parse complete JSON objects', () => {
    const callback = jest.fn();
    const parser = streamParser(callback);
    
    parser('{"type":"moveTo","x":10,"y":20}');
    
    expect(callback).toHaveBeenCalledWith({
      type: 'moveTo',
      x: 10,
      y: 20
    });
  });

  it('should handle JSON objects split across multiple chunks', () => {
    const callback = jest.fn();
    const parser = streamParser(callback);
    
    parser('{"type":"line');
    parser('To","x":30,');
    parser('"y":40}');
    
    expect(callback).toHaveBeenCalledWith({
      type: 'lineTo',
      x: 30,
      y: 40
    });
  });

  it('should handle multiple complete objects in one chunk', () => {
    const callback = jest.fn();
    const parser = streamParser(callback);
    
    parser('{"type":"moveTo","x":0,"y":0}{"type":"lineTo","x":10,"y":10}');
    
    expect(callback).toHaveBeenCalledTimes(2);
    expect(callback).toHaveBeenNthCalledWith(1, {
      type: 'moveTo',
      x: 0,
      y: 0
    });
    expect(callback).toHaveBeenNthCalledWith(2, {
      type: 'lineTo',
      x: 10,
      y: 10
    });
  });

  it('should ignore braces inside strings', () => {
    const callback = jest.fn();
    const parser = streamParser(callback);
    
    parser('{"type":"test","content":"Hello {world} with }braces{"}');
    
    expect(callback).toHaveBeenCalledWith({
      type: 'test',
      content: 'Hello {world} with }braces{'
    });
  });

  it('should handle nested objects', () => {
    const callback = jest.fn();
    const parser = streamParser(callback);
    
    parser('{"type":"complex","data":{"nested":{"value":42}}}');
    
    expect(callback).toHaveBeenCalledWith({
      type: 'complex',
      data: {
        nested: {
          value: 42
        }
      }
    });
  });

  it('should handle escaped quotes in strings', () => {
    const callback = jest.fn();
    const parser = streamParser(callback);
    
    parser('{"type":"test","message":"Say \\"hello\\" to {brackets}"}');
    
    expect(callback).toHaveBeenCalledWith({
      type: 'test',
      message: 'Say "hello" to {brackets}'
    });
  });

  it('should handle escaped backslashes', () => {
    const callback = jest.fn();
    const parser = streamParser(callback);
    
    parser('{"type":"test","path":"C:\\\\folder\\\\file.txt"}');
    
    expect(callback).toHaveBeenCalledWith({
      type: 'test',
      path: 'C:\\folder\\file.txt'
    });
  });

  it('should handle invalid JSON gracefully', () => {
    const callback = jest.fn();
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    const parser = streamParser(callback);
    
    parser('{"type":"test","invalid":}');
    
    expect(callback).not.toHaveBeenCalled();
    expect(consoleSpy).toHaveBeenCalledWith(
      'Failed to parse JSON chunk:',
      '{"type":"test","invalid":}',
      expect.any(Error)
    );
    
    consoleSpy.mockRestore();
  });

  it('should continue parsing after invalid JSON', () => {
    const callback = jest.fn();
    const consoleSpy = jest.spyOn(console, 'warn').mockImplementation();
    const parser = streamParser(callback);
    
    parser('{"invalid":}{"type":"valid","x":1}');
    
    expect(callback).toHaveBeenCalledWith({
      type: 'valid',
      x: 1
    });
    
    consoleSpy.mockRestore();
  });

  it('should handle empty chunks', () => {
    const callback = jest.fn();
    const parser = streamParser(callback);
    
    parser('');
    parser('{"type":"test"}');
    parser('');
    
    expect(callback).toHaveBeenCalledTimes(1);
    expect(callback).toHaveBeenCalledWith({
      type: 'test'
    });
  });

  it('should handle objects with arrays', () => {
    const callback = jest.fn();
    const parser = streamParser(callback);
    
    parser('{"type":"quadTo","points":[1,2,3,4]}');
    
    expect(callback).toHaveBeenCalledWith({
      type: 'quadTo',
      points: [1, 2, 3, 4]
    });
  });
});

describe('openAIStreamParser', () => {
  it('should parse OpenAI SSE format', () => {
    const onChunk = jest.fn();
    const onComplete = jest.fn();
    const parser = openAIStreamParser(onChunk, onComplete);
    
    parser('data: {"type":"moveTo","x":10,"y":20}\n\n');
    
    expect(onChunk).toHaveBeenCalledWith({
      type: 'moveTo',
      x: 10,
      y: 20
    });
  });

  it('should handle [DONE] signal', () => {
    const onChunk = jest.fn();
    const onComplete = jest.fn();
    const parser = openAIStreamParser(onChunk, onComplete);
    
    parser('data: [DONE]\n\n');
    
    expect(onComplete).toHaveBeenCalled();
    expect(onChunk).not.toHaveBeenCalled();
  });

  it('should ignore objects without type field', () => {
    const onChunk = jest.fn();
    const parser = openAIStreamParser(onChunk);
    
    parser('data: {"id":"test","content":"hello"}\n\n');
    parser('data: {"type":"moveTo","x":1,"y":2}\n\n');
    
    expect(onChunk).toHaveBeenCalledTimes(1);
    expect(onChunk).toHaveBeenCalledWith({
      type: 'moveTo',
      x: 1,
      y: 2
    });
  });

  it('should handle multiple SSE events in one chunk', () => {
    const onChunk = jest.fn();
    const parser = openAIStreamParser(onChunk);
    
    parser('data: {"type":"moveTo","x":0,"y":0}\n\ndata: {"type":"lineTo","x":10,"y":10}\n\n');
    
    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(onChunk).toHaveBeenNthCalledWith(1, {
      type: 'moveTo',
      x: 0,
      y: 0
    });
    expect(onChunk).toHaveBeenNthCalledWith(2, {
      type: 'lineTo',
      x: 10,
      y: 10
    });
  });

  it('should handle partial JSON in SSE format', () => {
    const onChunk = jest.fn();
    const parser = openAIStreamParser(onChunk);
    
    parser('data: {"type":"move');
    parser('To","x":15,"y":25}\n\n');
    
    expect(onChunk).toHaveBeenCalledWith({
      type: 'moveTo',
      x: 15,
      y: 25
    });
  });

  it('should handle lines without data prefix', () => {
    const onChunk = jest.fn();
    const parser = openAIStreamParser(onChunk);
    
    parser('event: message\ndata: {"type":"test","x":1}\n\n');
    
    expect(onChunk).toHaveBeenCalledWith({
      type: 'test',
      x: 1
    });
  });

  it('should handle empty data lines', () => {
    const onChunk = jest.fn();
    const parser = openAIStreamParser(onChunk);
    
    parser('data: \n\ndata: {"type":"test","x":1}\n\n');
    
    expect(onChunk).toHaveBeenCalledTimes(1);
    expect(onChunk).toHaveBeenCalledWith({
      type: 'test',
      x: 1
    });
  });

  it('should handle real OpenAI streaming response format', () => {
    const onChunk = jest.fn();
    const onComplete = jest.fn();
    const parser = openAIStreamParser(onChunk, onComplete);
    
    // Simulate real OpenAI response
    const mockResponse = `data: {"id":"test","object":"chat.completion.chunk","choices":[{"delta":{"content":"{"}}]}

data: {"type":"moveTo","x":100,"y":200}

data: {"type":"lineTo","x":150,"y":250}

data: [DONE]

`;
    
    parser(mockResponse);
    
    expect(onChunk).toHaveBeenCalledTimes(2);
    expect(onChunk).toHaveBeenNthCalledWith(1, {
      type: 'moveTo',
      x: 100,
      y: 200
    });
    expect(onChunk).toHaveBeenNthCalledWith(2, {
      type: 'lineTo',
      x: 150,
      y: 250
    });
    expect(onComplete).toHaveBeenCalled();
  });
}); 

describe('Integration Tests - Realistic OpenAI Streams', () => {
  it('should handle realistic OpenAI streaming response with drawing commands', () => {
    const receivedCommands: any[] = [];
    let streamComplete = false;

    const parser = openAIStreamParser(
      (command) => {
        receivedCommands.push(command);
        console.log('🎨 Received command:', command);
      },
      () => {
        streamComplete = true;
        console.log('✅ Stream complete!');
      }
    );

    // Simulate realistic OpenAI streaming chunks
    const streamChunks = [
      // OpenAI metadata (should be ignored)
      'data: {"id":"chatcmpl-abc123","object":"chat.completion.chunk","created":1699999999,"model":"gpt-4","choices":[{"index":0,"delta":{"role":"assistant","content":""},"finish_reason":null}]}\n\n',
      
      // First drawing command - SPLIT ACROSS CHUNKS (the real test!)
      'data: {"type":"move',
      'To","x":100,"y":150}\n\n',
      
      // Complete command in one chunk
      'data: {"type":"lineTo","x":200,"y":150}\n\n',
      
      // Complex command with multiple parameters
      'data: {"type":"quadTo","x1":250,"y1":100,"x2":300,"y2":200}\n\n',
      
      // Command split in tricky way (breaks in middle of property)
      'data: {"type":"cubic',
      'To","x1":300,"y1":200,"x2":350,"y2":50,"x3":400,"y3":150}\n\n',
      
      // Circle command
      'data: {"type":"addCircle","cx":500,"cy":100,"radius":25}\n\n',
      
      // End stream
      'data: [DONE]\n\n'
    ];

    // Process chunks as they arrive from network
    streamChunks.forEach(chunk => {
      console.log('📡 Processing chunk:', JSON.stringify(chunk));
      parser(chunk);
    });

    // Verify results
    expect(receivedCommands).toHaveLength(5);
    expect(streamComplete).toBe(true);

    // Verify specific commands
    expect(receivedCommands[0]).toEqual({ type: 'moveTo', x: 100, y: 150 });
    expect(receivedCommands[1]).toEqual({ type: 'lineTo', x: 200, y: 150 });
    expect(receivedCommands[4]).toEqual({ type: 'addCircle', cx: 500, cy: 100, radius: 25 });
    
    console.log('🎉 ALL COMMANDS PARSED SUCCESSFULLY!');
  });

  it('should handle extremely fragmented JSON', () => {
    const receivedCommands: any[] = [];
    const parser = openAIStreamParser((command) => receivedCommands.push(command));

    // Split ONE command into tiny fragments (worst case scenario)
    const fragments = [
      'data: {',
      '"type"',
      ':',
      '"moveTo"',
      ',',
      '"x":',
      '150',
      ',',
      '"y"',
      ':',
      '250',
      '}\n\n'
    ];

    fragments.forEach(fragment => parser(fragment));

    expect(receivedCommands).toHaveLength(1);
    expect(receivedCommands[0]).toEqual({ type: 'moveTo', x: 150, y: 250 });
    console.log('🎯 Extreme fragmentation test PASSED!');
  });
});