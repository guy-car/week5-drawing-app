import { DrawingCommand } from '../api/openai/types';

interface ParserCallbacks {
  onCommand?: (cmd: DrawingCommand) => void;
  onAnalysis?: (analysis: { style: string; complexity: number; description: string }) => void;
}

export class StreamJsonParser {
  private buffer = '';
  private depth = 0;
  private inCommands = false;
  private inAnalysis = false;
  private callbacks: ParserCallbacks;

  constructor(callbacks: ParserCallbacks) {
    this.callbacks = callbacks;
  }

  processChunk(chunk: string) {
    this.buffer += chunk;

    for (let i = 0; i < this.buffer.length; i++) {
      const ch = this.buffer[i];
      
      if (ch === '{') this.depth++;
      if (ch === '}') this.depth--;

      // Look for analysis section
      if (this.buffer.slice(i - 11, i) === '"analysis":') {
        this.inAnalysis = true;
        continue;
      }

      // Look for commands array
      if (this.buffer.slice(i - 11, i) === '"commands":') {
        this.inCommands = true;
        continue;
      }

      // Process complete objects
      if (this.depth === 1 && ch === '}') {
        try {
          // Try to parse the current buffer up to this point
          const obj = JSON.parse(this.buffer.slice(0, i + 1));

          // Handle analysis object
          if (this.inAnalysis && obj.style && this.callbacks.onAnalysis) {
            this.callbacks.onAnalysis(obj);
            this.inAnalysis = false;
          }

          // Handle command object
          if (this.inCommands && obj.type && this.callbacks.onCommand) {
            this.callbacks.onCommand(obj);
          }

          // Remove processed part from buffer
          this.buffer = this.buffer.slice(i + 1);
          i = -1;
        } catch (e) {
          // Incomplete JSON, continue buffering
          continue;
        }
      }
    }
  }

  // Helper method to check if we're done processing
  isDone(): boolean {
    return this.buffer.trim().length === 0 && this.depth === 0;
  }

  // Helper method to reset parser state
  reset() {
    this.buffer = '';
    this.depth = 0;
    this.inCommands = false;
    this.inAnalysis = false;
  }
} 