import { forwardRef, useImperativeHandle, useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Canvas, Path, Skia, Group, Rect } from '@shopify/react-native-skia';
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
    
    const initialScale = Math.min(screenWidth / BASE_CANVAS_SIZE, screenHeight / BASE_CANVAS_SIZE) * 0.9;
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const scale = useSharedValue(1);

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

    useEffect(() => {
      if (mode === 'draw') {
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
      }
    }, [mode]);

    useImperativeHandle(ref, () => ({
      clear: () => {
        setPaths([]);
        setCurrentPath(null);
      },
      handleZoom,
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
      .onUpdate((e) => {
        translateX.value = e.translationX;
        translateY.value = e.translationY;
      })
      .runOnJS(true);

    const canvasContent = (
      <Canvas
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