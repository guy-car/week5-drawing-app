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
import { exportCanvas } from '../src/utils/canvasExport';
import { BASE_CANVAS_SIZE } from '../src/constants/canvas';
import { buildPathFromCommands } from './pathBuilder';
import { streamLog } from '../src/api/openai/config';
import { stamp } from '../src/utils/performance';

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
  exportCanvas: (canvasRef: any) => Promise<string | null>;
  exportCanvasWithCommands: () => Promise<{ image: string | null; commands: DrawingCommand[] }>;
  addAIPath: (commands: DrawingCommand[]) => void;
  addDebugGrid: () => void;
  addAICommandIncremental: (command: DrawingCommand) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  isEmpty: () => boolean;
}

interface PathWithData {
  path: any;
  startX: number;
  startY: number;
  points: [number, number][];
}

// ----- Undo/Redo -----
interface Stroke {
  path: any;                        // Skia.Path
  commands: DrawingCommand[];       // for export
}

const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(
  ({ mode, onZoomChange, screenWidth, screenHeight }, ref) => {
    const [paths, setPaths] = useState<any[]>([]);
    const [currentPath, setCurrentPath] = useState<PathWithData | null>(null);
    const [userCommands, setUserCommands] = useState<DrawingCommand[]>([]);
    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const undoStack = useRef<Stroke[]>([]);
    const redoStack = useRef<Stroke[]>([]);
    const MAX_HISTORY = 15;
    const canvasRef = useCanvasRef();
    const aiPathRef = useRef<any>(null);
    
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

    const exportCanvasWithCommands = async (): Promise<{ image: string | null; commands: DrawingCommand[] }> => {
      try {
        // Performance: mark snapshot start / end
        stamp('snapshot-start');

        // Export a lightweight 256-px JPEG snapshot to minimise upload time
        const image = await exportCanvas(canvasRef, { resize: 256, format: 'jpeg', quality: 0.6 });

        stamp('img-ready');
        
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
        const aiPath = buildPathFromCommands(commands);
        const stroke: Stroke = { path: aiPath, commands };

        setStrokes(prev => [...prev, stroke]);
        setPaths(prev => [...prev, aiPath]);

        undoStack.current.push(stroke);
        redoStack.current = [];
        if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();

        console.log(`✅ AI path added successfully with ${commands.length} commands`);
      } catch (error) {
        console.error('❌ Error adding AI path:', error);
      }
    };

    const addDebugGrid = () => {
      streamLog.debug('🔧 Adding debug grid');
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
    };

    const addAICommandIncremental = (command: DrawingCommand) => {
      try {
        streamLog.debug('📍 Processing AI command:', command.type);
        
        if (!aiPathRef.current) {
          aiPathRef.current = Skia.Path.Make();
        }
        
        buildPathFromCommands([command], aiPathRef.current);
        setPaths(prev => [...prev.filter(p => p !== aiPathRef.current), aiPathRef.current]);
      } catch (error) {
        streamLog.warn('❌ Error processing AI command:', error);
      }
    };

    const canUndo = () => undoStack.current.length > 0;
    const canRedo = () => redoStack.current.length > 0;

    const undo = () => {
      if (!canUndo()) return;
      const last = undoStack.current.pop()!;
      redoStack.current.push(last);
      setStrokes(prev => prev.slice(0, -1));
      setPaths(prev => prev.slice(0, -1));
    };

    const redo = () => {
      if (!canRedo()) return;
      const stroke = redoStack.current.pop()!;
      undoStack.current.push(stroke);
      setStrokes(prev => [...prev, stroke]);
      setPaths(prev => [...prev, stroke.path]);
    };

    useImperativeHandle(ref, () => ({
      clear: () => {
        setPaths([]);
        setStrokes([]);
        setCurrentPath(null);
        setUserCommands([]);
        undoStack.current = [];
        redoStack.current = [];
        aiPathRef.current = null;
      },
      handleZoom,
      exportCanvas: () => exportCanvas(canvasRef, { resize: 256, format: 'jpeg', quality: 0.6 }),
      exportCanvasWithCommands,
      addAIPath,
      addDebugGrid,
      addAICommandIncremental,
      undo,
      redo,
      canUndo,
      canRedo,
      isEmpty: () => paths.length === 0,
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
      }
    };

    const onTouchEnd = () => {
      if (mode !== 'draw' || !currentPath?.path) return;

      // 1. Create stroke object
      const stroke: Stroke = {
        path: currentPath.path,
        commands: [...userCommands.slice(-currentPath.points.length)] // last cmds for this stroke
      };

      // 2. Render it
      setStrokes(prev => [...prev, stroke]);
      setPaths(prev => [...prev, currentPath.path]); // existing render list
      setCurrentPath(null);

      // 3. History bookkeeping
      undoStack.current.push(stroke);
      redoStack.current = [];
      if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
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