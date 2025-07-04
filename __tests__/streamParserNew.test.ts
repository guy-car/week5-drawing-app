import { streamParser, openAIStreamParser } from '../src/api/openai/streamParser';

describe('streamParser (new commands-array expectation)', () => {
  it('parses commands inside "commands" array', () => {
    const cb = jest.fn();
    const parser = streamParser(cb);

    const chunk = '{"commands":[{"type":"moveTo","x":10,"y":20},{"type":"lineTo","x":20,"y":30}]}';
    parser(chunk);

    expect(cb).toHaveBeenCalledTimes(2);
    expect(cb).toHaveBeenNthCalledWith(1, { type: 'moveTo', x: 10, y: 20 });
    expect(cb).toHaveBeenNthCalledWith(2, { type: 'lineTo', x: 20, y: 30 });
  });
});

describe('openAIStreamParser wrapper', () => {
  it('handles SSE format with [DONE]', () => {
    const onChunk = jest.fn();
    const onComplete = jest.fn();
    const parser = openAIStreamParser(onChunk, onComplete);

    const sseData = 'data: {"commands":[{"type":"moveTo","x":1,"y":2}]}\n\n';
    parser(sseData);
    parser('data: [DONE]\n\n');

    expect(onChunk).toHaveBeenCalledWith({ type: 'moveTo', x: 1, y: 2 });
    expect(onComplete).toHaveBeenCalled();
  });
}); 