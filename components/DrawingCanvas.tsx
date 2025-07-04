import { forwardRef, useImperativeHandle, useState, useEffect, useRef } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Canvas, Path, Skia, Group, Rect, useCanvasRef, Circle } from '@shopify/react-native-skia';
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
  selectedColor: string;
  onModeChange?: (mode: 'draw' | 'pan') => void;
  backgroundColor?: string;
  tool?: 'draw' | 'erase';
  strokeWidth?: number;
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
  color: string;
  strokeWidth?: number;
  isEraser?: boolean;
}

// ----- Undo/Redo -----
interface Stroke {
  path: any;                        // Skia.Path
  commands: DrawingCommand[];       // for export
  color: string;                    // stroke color
  strokeWidth?: number;
  isEraser?: boolean;
}

const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(
  ({ mode, onZoomChange, selectedColor, onModeChange, backgroundColor, tool = 'draw', strokeWidth = 2 }, ref) => {
    const [paths, setPaths] = useState<any[]>([]);
    const [currentPath, setCurrentPath] = useState<PathWithData | null>(null);
    const [userCommands, setUserCommands] = useState<DrawingCommand[]>([]);
    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const undoStack = useRef<Stroke[]>([]);
    const redoStack = useRef<Stroke[]>([]);
    const MAX_HISTORY = 15;
    const canvasRef = useCanvasRef();
    const aiPathRef = useRef<any>(null);
    
    const [containerDimensions, setContainerDimensions] = useState({ width: 0, height: 0 });
    const translateX = useSharedValue(0);
    const translateY = useSharedValue(0);
    const scale = useSharedValue(1);

    // Set initial scale when container dimensions are available
    useEffect(() => {
      if (containerDimensions.width > 0 && containerDimensions.height > 0) {
        // Start at a zoom level that allows 3 zoom-outs to reach minimum
        // MIN_ZOOM = 0.5, ZOOM_STEP = 0.25, so 3 steps = 0.5 + (3 × 0.25) = 1.25
        const initialScale = MIN_ZOOM + (3 * ZOOM_STEP);
        
        // Only set if scale hasn't been changed by user yet
        if (scale.value === 1) {
          scale.value = initialScale;
          onZoomChange(initialScale);
        }
      }
    }, [containerDimensions]);

    // Add shared values to store the starting position when pan gesture begins
    const startTranslateX = useSharedValue(0);
    const startTranslateY = useSharedValue(0);

    // Canvas coordinates are already correct - no conversion needed!
    const screenToCanvas = (screenX: number, screenY: number) => {
      
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
      
      // Clamp current translation to new scale boundaries
      const bounds = getPanBounds(newScale);
      const clampedX = Math.max(-bounds.maxX, Math.min(bounds.maxX, translateX.value));
      const clampedY = Math.max(-bounds.maxY, Math.min(bounds.maxY, translateY.value));
      
      scale.value = withSpring(newScale);
      translateX.value = withSpring(clampedX);
      translateY.value = withSpring(clampedY);
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
        console.log('🤖 AI PATH - Received commands:', commands.length);
        console.log('🤖 AI PATH - Selected color for AI stroke:', selectedColor);
        
        const aiPath = buildPathFromCommands(commands);
        const stroke: Stroke = { 
          path: aiPath, 
          commands,
          color: selectedColor,  // Use current selected color for AI strokes
          strokeWidth: 2
        };

        console.log('🤖 AI PATH - Created stroke with color:', stroke.color);

        setStrokes(prev => {
          const newStrokes = [...prev, stroke];
          console.log('🤖 AI PATH - Total strokes after AI add:', newStrokes.length);
          return newStrokes;
        });
        setPaths(prev => {
          const newPaths = [...prev, aiPath];
          console.log('🤖 AI PATH - Total paths after AI add:', newPaths.length);
          return newPaths;
        });

        undoStack.current.push(stroke);
        redoStack.current = [];
        if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();

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
        
        if (!aiPathRef.current) {
          aiPathRef.current = Skia.Path.Make();
        }
        
        buildPathFromCommands([command], aiPathRef.current);
        setPaths(prev => {
          const newPaths = [...prev.filter(p => p !== aiPathRef.current), aiPathRef.current];
          return newPaths;
        });

        // 🎨 FIX: Ensure AI path has corresponding stroke entry with color info
        setStrokes(prev => {
          const existingStroke = prev.find(s => s.path === aiPathRef.current);
          if (!existingStroke) {
            return [...prev, { path: aiPathRef.current, commands: [], color: selectedColor, strokeWidth: 2 }];
          }

          return prev;
        });
      } catch (error) {
        console.log('❌ Error processing incremental AI command:', error);
        streamLog.warn('❌ Error processing AI command:', error);
      }
    };

    const canUndo = () => undoStack.current.length > 0;
    const canRedo = () => redoStack.current.length > 0;

    // Helper function to calculate pan boundaries based on current scale
    const getPanBounds = (currentScale: number) => {
      const scaledCanvas = BASE_CANVAS_SIZE * currentScale;
      
      // Calculate how much the canvas overflows the container
      const horizontalOverflow = scaledCanvas - containerDimensions.width;
      const verticalOverflow = scaledCanvas - containerDimensions.height;
      
      // MUCH more generous horizontal panning - allow seeing well beyond edges
      const maxX = horizontalOverflow > 0 ? horizontalOverflow / 2 + 300 : 200;
      // Keep vertical panning reasonable 
      const maxY = verticalOverflow > 0 ? verticalOverflow / 2 + 40 : 50;
      
      return { maxX, maxY };
    };

    const undo = () => {
      if (!canUndo()) return;
      const last = undoStack.current.pop()!;
      console.log('↩️  UNDO - Removing stroke with color:', last.color, 'commands:', last.commands.length);
      redoStack.current.push(last);
      setStrokes(prev => {
        const newStrokes = prev.slice(0, -1);
        return newStrokes;
      });
      setPaths(prev => {
        const newPaths = prev.slice(0, -1);
        console.log('↩️  UNDO - Paths count:', prev.length, '→', newPaths.length);
        return newPaths;
      });
    };

    const redo = () => {
      if (!canRedo()) return;
      const stroke = redoStack.current.pop()!;
      console.log('↪️  REDO - Restoring stroke with color:', stroke.color, 'commands:', stroke.commands.length);
      undoStack.current.push(stroke);
      setStrokes(prev => {
        const newStrokes = [...prev, stroke];
        console.log('↪️  REDO - Strokes count:', prev.length, '→', newStrokes.length);
        return newStrokes;
      });
      setPaths(prev => {
        const newPaths = [...prev, stroke.path];
        console.log('↪️  REDO - Paths count:', prev.length, '→', newPaths.length);
        return newPaths;
      });
    };

    useImperativeHandle(ref, () => ({
      clear: () => {
        console.log('🧹 CLEAR - Clearing canvas');
        console.log('🧹 CLEAR - Before: paths:', paths.length, 'strokes:', strokes.length, 'userCommands:', userCommands.length);
        console.log('🧹 CLEAR - Current selectedColor remains:', selectedColor);
        
        // Clear all drawing state
        setPaths([]);
        setStrokes([]);
        setCurrentPath(null);
        setUserCommands([]);
        undoStack.current = [];
        redoStack.current = [];
        aiPathRef.current = null;
        
        // Reset zoom to initial level and recenter canvas
        const initialScale = MIN_ZOOM + (3 * ZOOM_STEP); // 1.25
        translateX.value = withSpring(0);
        translateY.value = withSpring(0);
        scale.value = withSpring(initialScale);
        onZoomChange(initialScale);
        
        // Reset mode to draw
        if (onModeChange) {
          onModeChange('draw');
        }
        
        console.log('🧹 CLEAR - Canvas cleared, zoom reset to:', initialScale, 'position reset to center, mode reset to draw');
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

    const toolRef = useRef(tool);
    useEffect(()=>{ toolRef.current = tool; }, [tool]);

    const strokeWidthRef = useRef(strokeWidth);
    useEffect(()=>{ strokeWidthRef.current = strokeWidth; }, [strokeWidth]);

    const [cursorPos, setCursorPos] = useState<{x:number, y:number}>({ x: -1000, y: -1000 });
    const [cursorRadius, setCursorRadius] = useState(strokeWidth / 2);

    useEffect(() => {
      setCursorRadius(strokeWidth / 2);
    }, [strokeWidth]);

    const onTouchStart = (event: any) => {
      if (mode !== 'draw') return;

      const touch = event.nativeEvent;
      const { locationX, locationY } = touch;
      
      if (locationX !== undefined && locationY !== undefined) {
        const canvasCoords = screenToCanvas(locationX, locationY);
        const path = Skia.Path.Make();
        path.moveTo(canvasCoords.x, canvasCoords.y);

        const isEraser = toolRef.current === 'erase';
        const pathColor = isEraser ? '#000000' : selectedColor; // color irrelevant for eraser
        const width = strokeWidthRef.current;

        setCurrentPath({
          path,
          startX: canvasCoords.x,
          startY: canvasCoords.y,
          points: [[canvasCoords.x, canvasCoords.y]],
          color: pathColor,
          strokeWidth: width,
          isEraser,
        });

        if (isEraser) {
          setCursorPos({ x: canvasCoords.x, y: canvasCoords.y });
        } else {
          setCursorPos({ x: -1000, y: -1000 });
        }

        if(!isEraser){
          setUserCommands(prev => [...prev, { type:'moveTo', x: Math.round(canvasCoords.x), y: Math.round(canvasCoords.y) }]);
        }
      }
    };

    const onTouchMove = (event:any)=>{
      if (mode !== 'draw' || !currentPath) return;
      const touch=event.nativeEvent;
      const { locationX, locationY } = touch;
      if (locationX!==undefined&&locationY!==undefined){
        const canvasCoords = screenToCanvas(locationX, locationY);
        const roundedX = Math.round(canvasCoords.x);
        const roundedY = Math.round(canvasCoords.y);
        currentPath.path.lineTo(roundedX, roundedY);
        setCurrentPath({ ...currentPath, points:[...currentPath.points,[roundedX,roundedY]] });
        if (currentPath.isEraser) {
          setCursorPos({ x: roundedX, y: roundedY });
        }
        if(!currentPath.isEraser){
          setUserCommands(prev=>[...prev,{type:'lineTo',x:roundedX,y:roundedY}]);
        }
      }
    };

    const onTouchEnd = () => {
      if (currentPath){
        const stroke: Stroke = {
          path: currentPath.path,
          commands: currentPath.isEraser ? [] : [...userCommands],
          color: currentPath.color,
          strokeWidth: currentPath.strokeWidth,
          isEraser: currentPath.isEraser
        };
        setStrokes(prev=>[...prev,stroke]);
        setPaths(prev=>[...prev,currentPath.path]);
        undoStack.current.push(stroke);
        redoStack.current=[];
        if (undoStack.current.length>MAX_HISTORY) undoStack.current.shift();
        setCurrentPath(null);
        if(!currentPath.isEraser){
          setUserCommands([]);
        }

        // hide cursor when lift finger
        setCursorPos({ x: -1000, y: -1000 });
      }
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
        const newX = startTranslateX.value + e.translationX;
        const newY = startTranslateY.value + e.translationY;
        
        // Apply pan boundaries to prevent canvas from going off-screen
        const bounds = getPanBounds(scale.value);
        const clampedX = Math.max(-bounds.maxX, Math.min(bounds.maxX, newX));
        const clampedY = Math.max(-bounds.maxY, Math.min(bounds.maxY, newY));
        
        translateX.value = clampedX;
        translateY.value = clampedY;
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
            color={backgroundColor || "#E6F3FF"}
          />
          {/* Strokes isolated in their own layer so eraser clears strokes only */}
          <Group layer>
            {paths.map((path, index) => {
              const matchingStroke = strokes.find(s => s.path === path);
              if (!matchingStroke) return null;
              if (matchingStroke.isEraser) {
                return (
                  <Path
                    key={index}
                    path={path}
                    style="stroke"
                    strokeWidth={matchingStroke.strokeWidth}
                    blendMode="clear"
                  />
                );
              }
              return (
                <Path
                  key={index}
                  path={path}
                  color={matchingStroke.color}
                  style="stroke"
                  strokeWidth={matchingStroke.strokeWidth}
                />
              );
            })}
            {currentPath && (
              currentPath.isEraser ? (
                <Path
                  path={currentPath.path}
                  style="stroke"
                  strokeWidth={currentPath.strokeWidth}
                  blendMode="clear"
                />
              ) : (
                <Path
                  path={currentPath.path}
                  color={currentPath.color}
                  style="stroke"
                  strokeWidth={currentPath.strokeWidth}
                />
              )
            )}
          </Group>
        </Group>

        {/* Eraser cursor preview */}
        {toolRef.current === 'erase' && (
          <Circle
            cx={cursorPos.x}
            cy={cursorPos.y}
            r={cursorRadius}
            color="rgba(0,0,0,0.25)"
            style="stroke"
            strokeWidth={1}
          />
        )}
      </Canvas>
    );

    return (
      <View style={styles.container}>
        <View 
          style={styles.canvasContainer}
          onLayout={(event) => {
            const { width, height } = event.nativeEvent.layout;
            setContainerDimensions({ width, height });
          }}
        >
          <GestureDetector gesture={mode === 'pan' ? panGesture : Gesture.Tap()}>
            <Animated.View style={[styles.gestureContainer, animatedStyle]}>
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
    flex: 1,
    backgroundColor: 'white',
    borderRadius: 8,
    marginVertical: 16,
    marginHorizontal: 2,
    overflow: 'hidden',
    alignItems: 'center',
    justifyContent: 'center',
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