export const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

export const openaiConfig = {
  apiKey: OPENAI_API_KEY,
  baseUrl: 'https://api.openai.com/v1/chat/completions',
};

// Debug configuration
export const DEBUG_STREAM = process.env.DEBUG_STREAM === '1';

// Logging utilities
export const streamLog = {
  debug: (...args: any[]) => {
    if (DEBUG_STREAM) {
      console.log(...args);
    }
  },
  info: (...args: any[]) => {
    console.log(...args);
  },
  warn: (...args: any[]) => {
    console.warn(...args);
  }
}; 