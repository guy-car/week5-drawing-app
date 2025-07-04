// Ensure process.env exists before anything else
if (typeof process === 'undefined') {
  // @ts-ignore
  global.process = { env: {} };
} else if (!process.env) {
  process.env = {};
}

// Silence warnings
jest.spyOn(console, 'warn').mockImplementation(() => {});

// Mock Skia
jest.mock('@shopify/react-native-skia', () => ({
  ImageFormat: {
    PNG: 'PNG',
    JPEG: 'JPEG',
  },
  Skia: {
    Path: {
      Make: () => ({})
    }
  },
  useCanvasRef: () => ({
    current: {
      makeImageSnapshot: () => ({
        scaleTo: () => ({
          encodeToBytes: (format, quality) => {
            return format === 'JPEG' ? new Uint8Array(5000) : new Uint8Array(50000);
          }
        }),
        encodeToBytes: (format, quality) => {
          return format === 'JPEG' ? new Uint8Array(5000) : new Uint8Array(50000);
        }
      })
    }
  })
}));

// Mock react-native-gesture-handler
jest.mock('react-native-gesture-handler', () => ({
  GestureDetector: () => null,
  Gesture: {
    Pan: () => ({ onStart: () => {}, onUpdate: () => {}, onEnd: () => {} }),
  },
}));

// Mock react-native-reanimated
jest.mock('react-native-reanimated', () => ({
  useSharedValue: jest.fn(),
  useAnimatedStyle: jest.fn(),
  withSpring: jest.fn(),
  useDerivedValue: jest.fn(),
  default: {
    View: 'View',
  },
}));

// Mock react-native-sse (EventSource) to prevent runtime errors in tests
jest.mock('react-native-sse', () => {
  return {
    __esModule: true,
    default: jest.fn().mockImplementation(() => ({
      addEventListener: jest.fn(),
      close: jest.fn(),
    }))
  };
});

// Provide a default global.fetch mock so tests that forget to stub fetch do not fail
if (!global.fetch) {
  global.fetch = jest.fn();
}

// Mock expo's env shim so Babel-transformed imports don't break under Jest
// Must be registered BEFORE modules that import 'expo/virtual/env'
jest.mock('expo/virtual/env', () => ({}), { virtual: true });

// Ensure env object still exists (some mocks may have overwritten it)
if (!process.env) {
  process.env = {};
}

// Provide stable defaults for env flags referenced in code
process.env.EXPO_PUBLIC_RIFF_ON_SKETCH = process.env.EXPO_PUBLIC_RIFF_ON_SKETCH || '0';
process.env.DEBUG_STREAM = process.env.DEBUG_STREAM || '0'; 