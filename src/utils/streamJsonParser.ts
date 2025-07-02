import { DrawingCommand } from '../api/openai/types';

interface ParserCallbacks {
  onCommand?: (cmd: DrawingCommand) => void;
  onAnalysis?: (analysis: Record<string, any>) => void;
}

// Helper to strip OpenAI SSE framing ("data: ...")
const stripSSE = (chunk: string): string[] => {
  return chunk
    .split(/\n/)
    .map(line => line.trim())
    .filter(line => line.startsWith('data:'))
    .map(line => line.replace(/^data:\s*/, ''))
    .filter(line => line !== '[DONE]');
};

export class StreamJsonParser {
  private callbacks: ParserCallbacks;

  private rootBuffer = '';
  private depth = 0;

  private collectingAnalysis = false;
  private analysisBuffer = '';
  private analysisDepth = 0;

  constructor(callbacks: ParserCallbacks) {
    this.callbacks = callbacks;
  }

  // Feed raw text chunk (may contain multiple SSE lines)
  processChunk(rawChunk: string) {
    const payloads = stripSSE(rawChunk);
    for (const payload of payloads) {
      this._processPayload(payload);
    }
  }

  private _processPayload(payload: string) {
    // Append to root buffer for depth tracking
    for (let i = 0; i < payload.length; i++) {
      const ch = payload[i];
      if (ch === '{') this.depth++;
      if (ch === '}') this.depth--;

      // Detect start of analysis object
      if (!this.collectingAnalysis && payload.slice(i).startsWith('"analysis"')) {
        // Move index to first '{' after analysis key
        const braceIndex = payload.indexOf('{', i);
        if (braceIndex !== -1) {
          this.collectingAnalysis = true;
          this.analysisDepth = 0;
          this.analysisBuffer = '';
          i = braceIndex - 1; // loop will increment
          continue;
        }
      }

      if (this.collectingAnalysis) {
        if (ch === '{') this.analysisDepth++;
        if (ch === '}') this.analysisDepth--;
        this.analysisBuffer += ch;

        if (this.analysisDepth === 0) {
          // Completed analysis object
          try {
            const analysisObj = JSON.parse(this.analysisBuffer);
            this.callbacks.onAnalysis?.(analysisObj);
          } catch (_) {
            // ignore parse errors – analysis will be parsed in fallback full mode
          }
          this.collectingAnalysis = false;
          this.analysisBuffer = '';
          continue;
        }
        continue; // Don't attempt to parse commands while in analysis capture
      }

      // Collect command objects – look for complete {...} inside commands array
      if (payload.slice(i).startsWith('"type"')) {
        // Step back to beginning of object
        const objStart = payload.lastIndexOf('{', i);
        if (objStart !== -1) {
          // Attempt to find matching closing brace using simple counter
          let braceDepth = 0;
          let j = objStart;
          for (; j < payload.length; j++) {
            if (payload[j] === '{') braceDepth++;
            if (payload[j] === '}') braceDepth--;
            if (braceDepth === 0) break;
          }
          if (braceDepth === 0) {
            const jsonStr = payload.slice(objStart, j + 1);
            try {
              const cmdObj = JSON.parse(jsonStr) as DrawingCommand;
              if (cmdObj.type) {
                this.callbacks.onCommand?.(cmdObj);
              }
            } catch (_) {
              // Ignore parse error – incomplete command
            }
            i = j; // Skip processed chars
          }
        }
      }
    }
  }

  reset() {
    this.rootBuffer = '';
    this.depth = 0;
    this.collectingAnalysis = false;
    this.analysisBuffer = '';
  }
} 