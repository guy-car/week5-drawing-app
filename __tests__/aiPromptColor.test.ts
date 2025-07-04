// @ts-nocheck

jest.mock('expo/virtual/env', () => ({}), { virtual: true });

jest.mock('../src/api/openai/config', () => ({
  openaiConfig: { apiKey: 'test', baseUrl: 'https://example.com' },
  streamLog: { info: jest.fn(), warn: jest.fn(), debug: jest.fn() },
}));

import { proceedWithAPICall } from '../src/api/openai/proceedWithAPICall';
import { riffOnSketch } from '../src/api/openai/riffOnSketch';

// Utility to create a dummy OpenAI-like response
const createOpenAIResponse = () => ({
  choices: [
    {
      message: {
        content: JSON.stringify({ commands: [] })
      }
    }
  ]
});

describe('AI prompt colour propagation', () => {
  const base64Image = 'data:image/png;base64,ABC123';
  const summaryStub = {
    commandCount: 0,
    avgSegment: 0,
    dominantAngles: [],
    shapeHistogram: {},
    boundingBox: {
      minX: 0,
      minY: 0,
      maxX: 0,
      maxY: 0,
    },
  } as any;

  afterEach(() => {
    jest.clearAllMocks();
  });

  it('includes selectedColor in proceedWithAPICall prompt', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => createOpenAIResponse(),
    });
    // @ts-ignore
    global.fetch = mockFetch;

    const selectedColor = '#FF66AA';
    await proceedWithAPICall(base64Image, selectedColor);

    expect(mockFetch).toHaveBeenCalled();
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    const promptText: string = body.messages[0].content[0].text;
    expect(promptText).toContain(selectedColor);
  });

  it('includes selectedColor in riffOnSketch prompt', async () => {
    const mockFetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => createOpenAIResponse(),
    });
    // @ts-ignore
    global.fetch = mockFetch;

    const selectedColor = '#00FF00';
    await riffOnSketch({
      image: base64Image,
      summary: summaryStub,
      selectedColor,
    });

    expect(mockFetch).toHaveBeenCalled();
    const body = JSON.parse(mockFetch.mock.calls[0][1].body);
    const promptText: string = body.messages[0].content[0].text;
    expect(promptText).toContain(selectedColor);
  });
}); 