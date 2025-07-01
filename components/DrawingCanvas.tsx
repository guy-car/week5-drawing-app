import { forwardRef, useImperativeHandle, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Canvas, Path, Skia, Group } from '@shopify/react-native-skia';
import { GestureDetector, Gesture } from 'react-native-gesture-handler';
import Animated, { 
  useSharedValue,
  useAnimatedStyle,
  withSpring
} from 'react-native-reanimated';

const CANVAS_SIZE = 1000;
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
    
    const initialScale = Math.min(screenWidth / CANVAS_SIZE, screenHeight / CANVAS_SIZE) * 0.9;
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const scale = useSharedValue(1);

    const handleZoom = (increment: boolean) => {
      const newScale = increment 
        ? Math.min(scale.value + ZOOM_STEP, MAX_ZOOM)
        : Math.max(scale.value - ZOOM_STEP, MIN_ZOOM);
      
      scale.value = withSpring(newScale);
      onZoomChange(newScale);
    };

    useEffect(() => {
      console.log('Mode changed:', mode);
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

    // Drawing handlers using native touch events
    const onTouchStart = (event: any) => {
      if (mode !== 'draw') {
        console.log('Touch ignored - not in draw mode');
        return;
      }

      const touch = event.nativeEvent;
      console.log('Touch Start Raw Event:', {
        locationX: touch.locationX,
        locationY: touch.locationY,
        pageX: touch.pageX,
        pageY: touch.pageY,
        target: touch.target,
        timestamp: touch.timestamp
      });
      
      const { locationX, locationY } = touch;
      
      if (locationX !== undefined && locationY !== undefined) {
        console.log('Starting new path at:', { x: locationX, y: locationY });
        const path = Skia.Path.Make();
        path.moveTo(locationX, locationY);
        
        setCurrentPath({
          path,
          startX: locationX,
          startY: locationY,
          points: [[locationX, locationY]]
        });
      } else {
        console.log('Invalid touch coordinates');
      }
    };

    const onTouchMove = (event: any) => {
      if (mode !== 'draw' || !currentPath) {
        console.log('Move ignored - not in draw mode or no current path');
        return;
      }

      const touch = event.nativeEvent;
      console.log('Touch Move Raw Event:', {
        locationX: touch.locationX,
        locationY: touch.locationY,
        pageX: touch.pageX,
        pageY: touch.pageY
      });
      
      const { locationX, locationY } = touch;
      
      if (locationX !== undefined && locationY !== undefined) {
        console.log('Adding point to path:', { x: locationX, y: locationY });
        const newPath = Skia.Path.Make();
        newPath.moveTo(currentPath.startX, currentPath.startY);
        
        currentPath.points.forEach(([x, y]) => {
          newPath.lineTo(x, y);
        });
        
        newPath.lineTo(locationX, locationY);
        
        setCurrentPath({
          path: newPath,
          startX: currentPath.startX,
          startY: currentPath.startY,
          points: [...currentPath.points, [locationX, locationY]]
        });
      } else {
        console.log('Invalid move coordinates');
      }
    };

    const onTouchEnd = () => {
      if (mode !== 'draw') {
        console.log('Touch end ignored - not in draw mode');
        return;
      }

      console.log('Touch End Event:', {
        hasCurrentPath: !!currentPath?.path,
        totalPoints: currentPath?.points.length
      });

      if (currentPath?.path) {
        console.log('Finalizing path with points:', currentPath.points);
        setPaths(prevPaths => [...prevPaths, currentPath.path]);
        setCurrentPath(null);
      }
    };

    // Pan gesture
    const panGesture = Gesture.Pan()
      .enabled(mode === 'pan')
      .minPointers(2)
      .onBegin(() => {
        console.log('Pan gesture began');
      })
      .onUpdate((e) => {
        console.log('Pan update:', e.translationX, e.translationY);
        translateX.value = e.translationX;
        translateY.value = e.translationY;
      })
      .onEnd(() => {
        console.log('Pan gesture ended');
      })
      .runOnJS(true);

    const canvasContent = (
      <Canvas
        style={styles.canvas}
        onTouchStart={onTouchStart}
        onTouchMove={onTouchMove}
        onTouchEnd={onTouchEnd}
      >
        <Group>
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
          }]}
        >
          {mode === 'pan' ? (
            <GestureDetector gesture={panGesture}>
              <Animated.View style={[styles.gestureContainer, animatedStyle]}>
                {canvasContent}
              </Animated.View>
            </GestureDetector>
          ) : (
            canvasContent
          )}
        </View>
        <Text style={styles.hint}>Tap and drag to draw</Text>
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
    borderRadius: 10,
    overflow: 'hidden',
    elevation: 3,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.25,
    shadowRadius: 3.84,
  },
  canvas: {
    flex: 1,
    backgroundColor: 'white',
  },
  gestureContainer: {
    flex: 1,
  },
  hint: {
    marginTop: 10,
    color: '#666',
    fontSize: 16,
  },
});

export default DrawingCanvas; 