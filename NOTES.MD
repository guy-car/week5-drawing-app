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