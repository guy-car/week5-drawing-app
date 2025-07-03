## Dependency Stability Notes (added 2025-07-03)

1. For any library that contains native code (e.g. `react-native-reanimated`, `@shopify/react-native-skia`, `expo-camera`, etc.) **always install or upgrade via `npx expo install <package>`**.  Expo pins the exact version that matches the native binaries compiled into the current SDK.  Using `npm install` or `npm update` can pull in a newer JS version that doesn't match the native side and will crash Hermes at runtime.

2. Never move a native library to **devDependencies**.  Only modules listed in `dependencies` are bundled into the native build that ships to the device or simulator.

3. Keep React and React-Native versions in lock-step with your Expo SDK.  Expo 53 ships `react@19.0.0` and `react-native@0.79.4`.  Bumping React to 19.1.0 without matching the renderer produces the "Incompatible React versions" runtime error.

4. When adding image-manipulation or Skia features, check the Expo release notes to confirm the underlying native API is available.  For example, `SkImage.scaleTo` exists only in Skia ≥0.1.232 (Expo SDK 54+).  Provide graceful fallbacks for older SDKs.

5. Add shared constants/utilities in dedicated files to avoid circular imports.  Circular require cycles can slow startup and sometimes lead to partially-initialised modules.

## Jest Testing & Mocking Notes (added 2025-01-07)

### Critical: Import Order for Mocking
When writing Jest tests that mock modules used by imported functions, **import order matters**:

1. **Mock FIRST** - Define `jest.mock()` calls before any imports that use the mocked module
2. **Import AFTER** - Import modules that depend on mocked modules AFTER the mock is defined

**WRONG** (causes "TypeError: X is not a function"):
```typescript
import { myFunction } from '../utils/myModule'; // ❌ Imports Skia before mock is set up
jest.mock('@shopify/react-native-skia', () => ({ ... }));
```

**CORRECT**:
```typescript
jest.mock('@shopify/react-native-skia', () => ({ ... })); // ✅ Mock first
import { myFunction } from '../utils/myModule'; // ✅ Import after
```

### Inline Mocks vs Mock Files
- **Inline mocks** (in test files) are more reliable for complex dependencies like Skia
- **Mock files** in `__mocks__/` can have module resolution issues with scoped packages
- Use `moduleNameMapper` in `jest.config.js` as backup, but inline mocks are preferred

### Skia Mock Pattern
For `@shopify/react-native-skia`, use this inline mock pattern:
```typescript
jest.mock('@shopify/react-native-skia', () => {
  class MockPath {
    cmds: any[] = [];
    moveTo(x: number, y: number) { this.cmds.push(['M', x, y]); }
    lineTo(x: number, y: number) { this.cmds.push(['L', x, y]); }
    // ... other path methods
    toJSON() { return this.cmds; }
  }
  return {
    Skia: { Path: { Make: () => new MockPath() } },
    useCanvasRef: () => ({ current: { makeImageSnapshot: () => ({ encodeToBytes: () => new Uint8Array(5000) }) } }),
    // ... other exports
  };
});
```

### Skia resize fallback
* Current Expo SDK (<54) lacks `SkImage.scaleTo`; our export utility detects this.
* In dev builds we log a single `info` message once per session; production is silent.
* When upgrading to SDK 54+, remove the guarded fallback and test at least one export to confirm the message disappears.

### GPT model
'gpt-4-vision-preview' is deprecated
'gpt-4o' is the correct model to use

## OpenAI API Call Structure

When making API calls to OpenAI, ensure the `response_format` is structured correctly:

```typescript
response_format: {
  type: 'json_schema',
  json_schema: {
    name: 'DrawingCommandsSchema',
    schema: zodToJsonSchema(z.object({
      commands: z.array(commandSchema)
    }).strict())
  }
}
```

This ensures the response is validated correctly and matches the expected format. Incorrect structuring can lead to validation errors and unexpected behavior.

## Stream Parser Implementation (added 2024-03-21)

The stream parser system consists of two main components designed to handle real-time JSON parsing from OpenAI's streaming API responses. This implementation ensures robust handling of partial JSON objects and Server-Sent Events (SSE) format.

### Core JSON Stream Parser

The base `streamParser` handles incremental JSON parsing with these key features:

1. **State Tracking**
   - Maintains brace depth count for nested objects
   - Tracks string context to ignore braces in strings
   - Handles escape sequences properly
   - Buffers incomplete JSON across chunks

2. **Buffer Management**
   ```typescript
   // Example of partial JSON handling:
   Chunk 1: '{"type": "moveTo", "x'
   Chunk 2: '": 100, "y": 200}'
   // Parser correctly combines and emits: {"type": "moveTo", "x": 100, "y": 200}
   ```

3. **Error Handling**
   - Graceful recovery from malformed JSON
   - Maintains parser state across errors
   - Logs warnings for debugging

### OpenAI SSE Parser

The `openAIStreamParser` wraps the core parser to handle OpenAI's specific SSE format:

1. **SSE Format**
   ```
   data: {"type": "moveTo", "x": 100, "y": 200}

   data: {"type": "lineTo", "x": 150, "y": 250}

   data: [DONE]
   ```

2. **Features**
   - Strips "data: " prefix
   - Handles multi-line events
   - Processes [DONE] signal
   - Filters for drawing commands (objects with 'type' field)

### Usage Pattern

```typescript
const parser = openAIStreamParser(
  (command) => {
    // Handle each drawing command as it arrives
    processDrawingCommand(command);
  },
  () => {
    // Handle stream completion
    finishDrawing();
  }
);

// Feed chunks as they arrive from the API
response.on('data', chunk => parser(chunk.toString()));
```

### Implementation Notes

1. **Partial Object Handling**
   - Parser maintains state between chunks
   - Handles JSON split at any position
   - Preserves incomplete objects in buffer

2. **Memory Efficiency**
   - Cleans buffer after complete objects
   - Only retains necessary incomplete data
   - No unnecessary string copies

3. **Error Recovery**
   - Continues processing after parse errors
   - Maintains stream integrity
   - Logs issues without crashing

4. **Performance**
   - Single-pass character processing
   - Minimal string operations
   - Efficient buffer management

### Testing Considerations

When writing tests for streaming functionality:

1. **Edge Cases**
   - Split JSON at various positions
   - Nested objects and arrays
   - Escaped quotes and braces
   - Multiple commands in one chunk

2. **SSE Format**
   - Partial "data: " prefixes
   - Multi-line events
   - [DONE] signal handling
   - Invalid event formats

3. **Error Conditions**
   - Malformed JSON
   - Invalid UTF-8 sequences
   - Buffer overflow scenarios
   - Network interruptions