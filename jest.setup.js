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