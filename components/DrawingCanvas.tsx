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
import { DrawingCommand } from '../src/api/openai/types';

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
  exportCanvasWithCommands: () => Promise<{ image: string | null; commands: DrawingCommand[] }>;
  addAIPath: (commands: DrawingCommand[]) => void;
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
    const [userCommands, setUserCommands] = useState<DrawingCommand[]>([]);
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

    const exportCanvasWithCommands = async (): Promise<{ image: string | null; commands: DrawingCommand[] }> => {
      try {
        // Get the canvas image using the existing exportCanvas function
        const image = await exportCanvas();
        
        // Return both image and captured commands
        const result = {
          image,
          commands: [...userCommands] // Create a copy of the commands array
        };
        
        console.log('✅ Canvas with commands exported successfully');
        console.log(`📊 Image: ${image ? 'Success' : 'Failed'}, Commands: ${result.commands.length} total`);
        console.log('🎯 Commands preview:', result.commands.slice(0, 5)); // Show first 5 commands
        
        return result;
      } catch (error) {
        console.error('❌ Error exporting canvas with commands:', error);
        return {
          image: null,
          commands: []
        };
      }
    };

    const addAIPath = (commands: DrawingCommand[]) => {
      try {
        console.log('🎯 AI Commands received:', commands);
        
        const aiPath = Skia.Path.Make();
        
        commands.forEach((command, index) => {
          console.log(`📍 Processing command ${index}: ${command.type}`);
          
          switch (command.type) {
            case 'moveTo': {
              // Validate and clamp coordinates
              const x = Math.max(0, Math.min(BASE_CANVAS_SIZE, command.x));
              const y = Math.max(0, Math.min(BASE_CANVAS_SIZE, command.y));
              
              if (x !== command.x || y !== command.y) {
                console.warn(`⚠️ MoveTo command ${index}: Clamped (${command.x}, ${command.y}) to (${x}, ${y})`);
              }
              
              aiPath.moveTo(x, y);
              console.log(`✅ MoveTo: (${x}, ${y})`);
              break;
            }
            
            case 'lineTo': {
              // Validate and clamp coordinates
              const x = Math.max(0, Math.min(BASE_CANVAS_SIZE, command.x));
              const y = Math.max(0, Math.min(BASE_CANVAS_SIZE, command.y));
              
              if (x !== command.x || y !== command.y) {
                console.warn(`⚠️ LineTo command ${index}: Clamped (${command.x}, ${command.y}) to (${x}, ${y})`);
              }
              
              aiPath.lineTo(x, y);
              console.log(`✅ LineTo: (${x}, ${y})`);
              break;
            }
            
            case 'quadTo': {
              // Validate and clamp control point and end point coordinates
              const x1 = Math.max(0, Math.min(BASE_CANVAS_SIZE, command.x1));
              const y1 = Math.max(0, Math.min(BASE_CANVAS_SIZE, command.y1));
              const x2 = Math.max(0, Math.min(BASE_CANVAS_SIZE, command.x2));
              const y2 = Math.max(0, Math.min(BASE_CANVAS_SIZE, command.y2));
              
              if (x1 !== command.x1 || y1 !== command.y1 || x2 !== command.x2 || y2 !== command.y2) {
                console.warn(`⚠️ QuadTo command ${index}: Clamped coordinates`);
                console.warn(`  Control: (${command.x1}, ${command.y1}) to (${x1}, ${y1})`);
                console.warn(`  End: (${command.x2}, ${command.y2}) to (${x2}, ${y2})`);
              }
              
              aiPath.quadTo(x1, y1, x2, y2);
              console.log(`✅ QuadTo: control(${x1}, ${y1}) end(${x2}, ${y2})`);
              break;
            }
            
            case 'cubicTo': {
              // Validate and clamp all control points and end point coordinates
              const x1 = Math.max(0, Math.min(BASE_CANVAS_SIZE, command.x1));
              const y1 = Math.max(0, Math.min(BASE_CANVAS_SIZE, command.y1));
              const x2 = Math.max(0, Math.min(BASE_CANVAS_SIZE, command.x2));
              const y2 = Math.max(0, Math.min(BASE_CANVAS_SIZE, command.y2));
              const x3 = Math.max(0, Math.min(BASE_CANVAS_SIZE, command.x3));
              const y3 = Math.max(0, Math.min(BASE_CANVAS_SIZE, command.y3));
              
              if (x1 !== command.x1 || y1 !== command.y1 || x2 !== command.x2 || 
                  y2 !== command.y2 || x3 !== command.x3 || y3 !== command.y3) {
                console.warn(`⚠️ CubicTo command ${index}: Clamped coordinates`);
                console.warn(`  Control1: (${command.x1}, ${command.y1}) to (${x1}, ${y1})`);
                console.warn(`  Control2: (${command.x2}, ${command.y2}) to (${x2}, ${y2})`);
                console.warn(`  End: (${command.x3}, ${command.y3}) to (${x3}, ${y3})`);
              }
              
              aiPath.cubicTo(x1, y1, x2, y2, x3, y3);
              console.log(`✅ CubicTo: control1(${x1}, ${y1}) control2(${x2}, ${y2}) end(${x3}, ${y3})`);
              break;
            }
            
            case 'addCircle': {
              // Validate and clamp center coordinates and radius
              const cx = Math.max(0, Math.min(BASE_CANVAS_SIZE, command.cx));
              const cy = Math.max(0, Math.min(BASE_CANVAS_SIZE, command.cy));
              const radius = Math.max(1, Math.min(BASE_CANVAS_SIZE / 2, command.radius)); // Ensure positive radius
              
              if (cx !== command.cx || cy !== command.cy || radius !== command.radius) {
                console.warn(`⚠️ AddCircle command ${index}: Clamped (${command.cx}, ${command.cy}, r=${command.radius}) to (${cx}, ${cy}, r=${radius})`);
              }
              
              aiPath.addCircle(cx, cy, radius);
              console.log(`✅ AddCircle: center(${cx}, ${cy}) radius=${radius}`);
              break;
            }
            
            default:
              console.warn(`❌ Unknown command type: ${(command as any).type}`);
          }
        });
        
        setPaths(prevPaths => [...prevPaths, aiPath]);
        console.log(`✅ AI path added successfully with ${commands.length} commands`);
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
        setUserCommands([]);
        console.log('🧹 Cleared canvas and user commands');
      },
      handleZoom,
      exportCanvas,
      exportCanvasWithCommands,
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
        
        // Round coordinates to integers to match validation expectations
        const roundedX = Math.round(canvasCoords.x);
        const roundedY = Math.round(canvasCoords.y);
        
        const path = Skia.Path.Make();
        path.moveTo(roundedX, roundedY);
        
        setCurrentPath({
          path,
          startX: roundedX,
          startY: roundedY,
          points: [[roundedX, roundedY]]
        });

        // Capture moveTo command for AI context
        const moveToCommand: DrawingCommand = {
          type: 'moveTo',
          x: roundedX,
          y: roundedY
        };
        
        setUserCommands(prevCommands => [...prevCommands, moveToCommand]);
        console.log('📝 Captured moveTo command:', moveToCommand);
        console.log(`📊 Total user commands captured: ${userCommands.length + 1}`);
      }
    };

    const onTouchMove = (event: any) => {
      if (mode !== 'draw' || !currentPath) return;

      const touch = event.nativeEvent;
      const { locationX, locationY } = touch;
      
      if (locationX !== undefined && locationY !== undefined) {
        // Convert screen coordinates to canvas coordinates
        const canvasCoords = screenToCanvas(locationX, locationY);
        
        // Round coordinates to integers to match validation expectations
        const roundedX = Math.round(canvasCoords.x);
        const roundedY = Math.round(canvasCoords.y);
        
        const newPath = Skia.Path.Make();
        newPath.moveTo(currentPath.startX, currentPath.startY);
        
        currentPath.points.forEach(([x, y]) => {
          newPath.lineTo(x, y);
        });
        
        newPath.lineTo(roundedX, roundedY);
        
        setCurrentPath({
          path: newPath,
          startX: currentPath.startX,
          startY: currentPath.startY,
          points: [...currentPath.points, [roundedX, roundedY]]
        });

        // Capture lineTo command for AI context
        const lineToCommand: DrawingCommand = {
          type: 'lineTo',
          x: roundedX,
          y: roundedY
        };
        
        setUserCommands(prevCommands => [...prevCommands, lineToCommand]);
        console.log('📝 Captured lineTo command:', lineToCommand);
        console.log(`📊 Total user commands captured: ${userCommands.length + 1}`);
      }
    };

    const onTouchEnd = () => {
      if (mode !== 'draw' || !currentPath?.path) return;
      setPaths(prevPaths => [...prevPaths, currentPath.path]);
      setCurrentPath(null);
      console.log(`✅ Path completed. Total user commands captured: ${userCommands.length}`);
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