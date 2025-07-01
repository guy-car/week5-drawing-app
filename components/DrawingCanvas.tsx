import { forwardRef, useImperativeHandle, useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Canvas, Path, Skia, Group, Rect, useCanvasRef } from '@shopify/react-native-skia';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { 
  useSharedValue,
  useAnimatedStyle,
  withSpring,
  useDerivedValue
} from 'react-native-reanimated';

const BASE_CANVAS_SIZE = 1000;
const MIN_ZOOM = 0.5;
const MAX_ZOOM = 3;
const ZOOM_STEP = 0.25;

interface DrawingCanvasProps {
  mode: 'draw' | 'pan';
  onZoomChange: (zoom: number) => void;
  screenWidth: number;
  screenHeight: number;
}

interface DrawingCanvasRef {
  clear: () => void;
  handleZoom: (increment: boolean) => void;
  exportCanvas: () => Promise<string | null>;
  addAIPath: (commands: { type: string; x: number; y: number }[]) => void;
  addDebugGrid: () => void;
}

interface PathWithData {
  path: any;
  startX: number;
  startY: number;
  points: [number, number][];
}

const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(
  ({ mode, onZoomChange, screenWidth, screenHeight }, ref) => {
    const [paths, setPaths] = useState<any[]>([]);
    const [currentPath, setCurrentPath] = useState<PathWithData | null>(null);
    const canvasRef = useCanvasRef();
    
    const initialScale = Math.min(screenWidth / BASE_CANVAS_SIZE, screenHeight / BASE_CANVAS_SIZE) * 0.9;
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const scale = useSharedValue(1);

    // Add shared values to store the starting position when pan gesture begins
    const startTranslateX = useSharedValue(0);
    const startTranslateY = useSharedValue(0);

    // Canvas coordinates are already correct - no conversion needed!
    const screenToCanvas = (screenX: number, screenY: number) => {
      // Debug logging to confirm coordinates are already correct
      console.log('🔍 Using direct coordinates:');
      console.log(`Input: screenX=${screenX.toFixed(2)}, screenY=${screenY.toFixed(2)}`);
      console.log(`Transform state: translateX=${translateX.value.toFixed(2)}, translateY=${translateY.value.toFixed(2)}, scale=${scale.value.toFixed(2)}`);
      console.log('Using coordinates directly (no transformation needed)');
      console.log('---');
      
      // Return coordinates as-is since Canvas touch events are already in canvas space
      return {
        x: screenX,
        y: screenY
      };
    };

    // Use derived values for dimensions to ensure they're always valid
    const canvasWidth = useDerivedValue(() => BASE_CANVAS_SIZE);
    const canvasHeight = useDerivedValue(() => BASE_CANVAS_SIZE);

    const handleZoom = (increment: boolean) => {
      const newScale = increment 
        ? Math.min(scale.value + ZOOM_STEP, MAX_ZOOM)
        : Math.max(scale.value - ZOOM_STEP, MIN_ZOOM);
      
      scale.value = withSpring(newScale);
      onZoomChange(newScale);
    };

    const exportCanvas = async (): Promise<string | null> => {
      try {
        if (!canvasRef.current) {
          console.error('Canvas ref is not available');
          return null;
        }

        // Create an image snapshot of the current canvas
        const image = canvasRef.current.makeImageSnapshot();
        if (!image) {
          console.error('Failed to create image snapshot');
          return null;
        }

        // Encode the image as PNG and get base64 data
        const bytes = image.encodeToBytes();
        if (!bytes) {
          console.error('Failed to encode image to bytes');
          return null;
        }

        // Convert bytes to base64 string
        const base64 = bytes.reduce((data, byte) => data + String.fromCharCode(byte), '');
        const base64String = btoa(base64);
        
        console.log('✅ Canvas exported successfully, base64 length:', base64String.length);
        return `data:image/png;base64,${base64String}`;
      } catch (error) {
        console.error('❌ Error exporting canvas:', error);
        return null;
      }
    };

    const addAIPath = (commands: { type: string; x: number; y: number }[]) => {
      try {
        console.log('🎯 AI Commands received:', commands);
        
        // Validate and log coordinates
        const validatedCommands = commands.map((command, index) => {
          const x = Math.max(0, Math.min(1000, command.x));
          const y = Math.max(0, Math.min(1000, command.y));
          
          if (x !== command.x || y !== command.y) {
            console.warn(`⚠️ Command ${index}: Clamped (${command.x}, ${command.y}) to (${x}, ${y})`);
          }
          
          console.log(`📍 Command ${index}: ${command.type} to (${x}, ${y})`);
          return { ...command, x, y };
        });
        
        const aiPath = Skia.Path.Make();
        
        validatedCommands.forEach((command) => {
          switch (command.type.toLowerCase()) {
            case 'moveto':
              aiPath.moveTo(command.x, command.y);
              break;
            case 'lineto':
              aiPath.lineTo(command.x, command.y);
              break;
            default:
              console.warn(`Unknown command type: ${command.type}`);
          }
        });
        
        setPaths(prevPaths => [...prevPaths, aiPath]);
        console.log('✅ AI path added successfully');
      } catch (error) {
        console.error('❌ Error adding AI path:', error);
      }
    };

    const addDebugGrid = () => {
      console.log('🔧 Adding debug grid to visualize coordinate system');
      const gridPath = Skia.Path.Make();
      
      // Add grid lines every 100 pixels with labels
      for (let i = 0; i <= 1000; i += 100) {
        // Vertical lines
        gridPath.moveTo(i, 0);
        gridPath.lineTo(i, 1000);
        // Horizontal lines  
        gridPath.moveTo(0, i);
        gridPath.lineTo(1000, i);
      }
      
      setPaths(prevPaths => [...prevPaths, gridPath]);
      console.log('✅ Debug grid added - shows 100px intervals on 1000x1000 canvas');
    };

    useImperativeHandle(ref, () => ({
      clear: () => {
        setPaths([]);
        setCurrentPath(null);
      },
      handleZoom,
      exportCanvas,
      addAIPath,
      addDebugGrid,
    }));

    const animatedStyle = useAnimatedStyle(() => {
      return {
        transform: [
          { translateX: translateX.value },
          { translateY: translateY.value },
          { scale: scale.value }
        ]
      };
    });

    const onTouchStart = (event: any) => {
      if (mode !== 'draw') return;

      const touch = event.nativeEvent;
      const { locationX, locationY } = touch;
      
      if (locationX !== undefined && locationY !== undefined) {
        // Convert screen coordinates to canvas coordinates
        const canvasCoords = screenToCanvas(locationX, locationY);
        
        const path = Skia.Path.Make();
        path.moveTo(canvasCoords.x, canvasCoords.y);
        
        setCurrentPath({
          path,
          startX: canvasCoords.x,
          startY: canvasCoords.y,
          points: [[canvasCoords.x, canvasCoords.y]]
        });
      }
    };

    const onTouchMove = (event: any) => {
      if (mode !== 'draw' || !currentPath) return;

      const touch = event.nativeEvent;
      const { locationX, locationY } = touch;
      
      if (locationX !== undefined && locationY !== undefined) {
        // Convert screen coordinates to canvas coordinates
        const canvasCoords = screenToCanvas(locationX, locationY);
        
        const newPath = Skia.Path.Make();
        newPath.moveTo(currentPath.startX, currentPath.startY);
        
        currentPath.points.forEach(([x, y]) => {
          newPath.lineTo(x, y);
        });
        
        newPath.lineTo(canvasCoords.x, canvasCoords.y);
        
        setCurrentPath({
          path: newPath,
          startX: currentPath.startX,
          startY: currentPath.startY,
          points: [...currentPath.points, [canvasCoords.x, canvasCoords.y]]
        });
      }
    };

    const onTouchEnd = () => {
      if (mode !== 'draw' || !currentPath?.path) return;
      setPaths(prevPaths => [...prevPaths, currentPath.path]);
      setCurrentPath(null);
    };

    const panGesture = Gesture.Pan()
      .enabled(mode === 'pan')
      .minPointers(2)
      .onStart(() => {
        // Store the current canvas position when gesture starts
        startTranslateX.value = translateX.value;
        startTranslateY.value = translateY.value;
      })
      .onUpdate((e) => {
        // Add gesture translation to the stored starting position
        translateX.value = startTranslateX.value + e.translationX;
        translateY.value = startTranslateY.value + e.translationY;
      })
      .runOnJS(true);

    const canvasContent = (
      <Canvas
        ref={canvasRef}
        style={[styles.canvas, {
          width: BASE_CANVAS_SIZE,
          height: BASE_CANVAS_SIZE
        }]}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <Group>
          <Rect
            x={0}
            y={0}
            width={BASE_CANVAS_SIZE}
            height={BASE_CANVAS_SIZE}
            color="#E6F3FF"
          />
          {paths.map((path, index) => (
            <Path
              key={index}
              path={path}
              color="black"
              style="stroke"
              strokeWidth={2}
              strokeCap="round"
              strokeJoin="round"
            />
          ))}
          {currentPath && (
            <Path
              path={currentPath.path}
              color="black"
              style="stroke"
              strokeWidth={2}
              strokeCap="round"
              strokeJoin="round"
            />
          )}
        </Group>
      </Canvas>
    );

    return (
      <View style={styles.container}>
        <View 
          style={[styles.canvasContainer, {
            width: screenWidth * 0.9,
            height: screenHeight * 0.8,
            overflow: 'hidden',
            alignItems: 'center',
            justifyContent: 'center'
          }]}
        >
          <GestureDetector gesture={mode === 'pan' ? panGesture : Gesture.Tap()}>
            <Animated.View style={[styles.gestureContainer, animatedStyle, {
              alignItems: 'center',
              justifyContent: 'center'
            }]}>
              {canvasContent}
            </Animated.View>
          </GestureDetector>
        </View>
        <Text style={styles.hint}>
          {mode === 'draw' ? 'Tap and drag to draw' : 'Use two fingers to pan'}
        </Text>
      </View>
    );
  }
);

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvasContainer: {
    backgroundColor: 'white',
    borderRadius: 8,
  },
  gestureContainer: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  canvas: {
    backgroundColor: 'transparent',
  },
  hint: {
    marginTop: 10,
    color: '#666',
    fontSize: 14,
  },
});

export default DrawingCanvas; 