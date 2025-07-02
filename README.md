# Drawing Canvas App

A React Native Expo app with drawing canvas functionality using React Native Skia and gesture handling.

## Features

- **Drawing Canvas**: 1000x1000 fixed-size canvas that starts fitted to screen
- **Touch Interactions**:
  - Single finger drawing with black lines (Draw Mode)
  - Pinch-to-zoom and two-finger pan (Pan & Zoom Mode)
- **Mode Toggle**: Switch between "Draw Mode" and "Pan & Zoom Mode"
- **Clear Button**: Clear all drawings from the canvas
- **Zoom Display**: Shows current zoom level (e.g., "Zoom: 1.5x")

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the development server**:
   ```bash
   npx expo start
   ```

3. **Run on device/simulator**:
   - Scan the QR code with Expo Go app (iOS/Android)
   - Press `i` for iOS simulator
   - Press `a` for Android emulator
   - Press `w` for web browser

## Dependencies

- **Expo**: ~50.0.0
- **React Native Skia**: @shopify/react-native-skia
- **Gesture Handler**: react-native-gesture-handler
- **Reanimated**: react-native-reanimated

## Usage

1. **Draw Mode**: Touch the screen with one finger to draw black lines
2. **Pan & Zoom Mode**: 
   - Pinch with two fingers to zoom in/out
   - Pan with two fingers to move around the canvas
3. **Toggle Mode**: Tap the mode button to switch between drawing and pan/zoom
4. **Clear**: Tap the Clear button to remove all drawings
5. **Zoom Level**: Monitor the current zoom level in the header

## Technical Details

- Canvas size: 1000x1000 pixels
- Drawing coordinates are properly transformed for zoom/pan
- Smooth gesture handling with react-native-gesture-handler
- Canvas rendering with React Native Skia
- TypeScript support 

## Implementation Notes

### Drawing Coordinate System Fix
When implementing the drawing functionality with React Native Skia, we encountered and solved an interesting issue with path coordinates. Initially, all drawn lines would start from the top-left corner (0,0) regardless of the actual touch position. This was caused by relying on SVG string manipulation for path creation.

The solution involved:
1. Creating a custom path data structure to maintain the actual touch coordinates:
```typescript
interface PathWithData {
  path: SkiaPath;
  startX: number;
  startY: number;
  points: [number, number][];
}
```

2. Instead of using SVG strings, we now:
   - Store the initial touch point when drawing starts
   - Maintain an array of all points in the path
   - Recreate the path from the original coordinates for each update
   - This ensures the path always starts from the actual touch point

This approach provides more precise control over the drawing coordinates and prevents the (0,0) coordinate issue that can occur when manipulating SVG path strings directly. 