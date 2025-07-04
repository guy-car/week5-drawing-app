/**
 * 🐛 DEBUG MODE: Extensive logging added to investigate color-related bugs
 * 
 * Look for these log patterns:
 * 🎯 STROKE START/MOVE - Tracks command accumulation per stroke
 * 🚨 CRITICAL BUG CHECK - Shows if ALL commands are captured per stroke (should only be current stroke)
 * 🚨 RENDER BUG - Shows path-stroke mapping failures (fallback to #000000)
 * 🤖 AI PATH - Shows AI stroke color handling
 * 🚨 INCREMENTAL AI - Shows incremental AI drawing issues (missing stroke entries)
 * ↩️↪️ UNDO/REDO - Shows undo/redo color preservation
 * 🧹 CLEAR - Shows canvas clearing behavior
 */

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
  selectedColor: string;
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
}

// ----- Undo/Redo -----
interface Stroke {
  path: any;                        // Skia.Path
  commands: DrawingCommand[];       // for export
  color: string;                    // stroke color
}

const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(
  ({ mode, onZoomChange, screenWidth, screenHeight, selectedColor }, ref) => {
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
        console.log('🤖 AI PATH - Received commands:', commands.length);
        console.log('🤖 AI PATH - Selected color for AI stroke:', selectedColor);
        
        const aiPath = buildPathFromCommands(commands);
        const stroke: Stroke = { 
          path: aiPath, 
          commands,
          color: selectedColor  // Use current selected color for AI strokes
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

        console.log(`✅ AI path added successfully with ${commands.length} commands and color ${stroke.color}`);
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
        console.log('🚨 INCREMENTAL AI - Processing command:', command.type);
        console.log('🚨 INCREMENTAL AI - Current selectedColor:', selectedColor);
        
        if (!aiPathRef.current) {
          aiPathRef.current = Skia.Path.Make();
          console.log('🚨 INCREMENTAL AI - Created new AI path');
        }
        
        buildPathFromCommands([command], aiPathRef.current);
        setPaths(prev => {
          const newPaths = [...prev.filter(p => p !== aiPathRef.current), aiPathRef.current];
          console.log('🚨 INCREMENTAL AI - Updated paths, total:', newPaths.length);
          console.log('🚨 INCREMENTAL AI BUG - This AI path has NO stroke entry with color info!');
          return newPaths;
        });
      } catch (error) {
        console.log('❌ Error processing incremental AI command:', error);
        streamLog.warn('❌ Error processing AI command:', error);
      }
    };

    const canUndo = () => undoStack.current.length > 0;
    const canRedo = () => redoStack.current.length > 0;

    const undo = () => {
      if (!canUndo()) return;
      const last = undoStack.current.pop()!;
      console.log('↩️  UNDO - Removing stroke with color:', last.color, 'commands:', last.commands.length);
      redoStack.current.push(last);
      setStrokes(prev => {
        const newStrokes = prev.slice(0, -1);
        console.log('↩️  UNDO - Strokes count:', prev.length, '→', newStrokes.length);
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
        
        setPaths([]);
        setStrokes([]);
        setCurrentPath(null);
        setUserCommands([]);
        undoStack.current = [];
        redoStack.current = [];
        aiPathRef.current = null;
        
        console.log('🧹 CLEAR - Canvas cleared, selectedColor preserved');
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
        
        // Create new path with color
        const path = Skia.Path.Make();
        path.moveTo(canvasCoords.x, canvasCoords.y);

        console.log('🎯 STROKE START - selectedColor:', selectedColor, 'userCommands count before:', userCommands.length);

        setCurrentPath({
          path,
          startX: canvasCoords.x,
          startY: canvasCoords.y,
          points: [[canvasCoords.x, canvasCoords.y]],
          color: selectedColor
        });

        // Add moveTo command
        setUserCommands(prev => {
          const newCommands = [...prev, {
            type: 'moveTo' as const,
            x: Math.round(canvasCoords.x),
            y: Math.round(canvasCoords.y)
          }];
          console.log('🎯 STROKE START - userCommands count after adding moveTo:', newCommands.length);
          return newCommands;
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
        const roundedX = Math.round(canvasCoords.x);
        const roundedY = Math.round(canvasCoords.y);

        // Update path
        currentPath.path.lineTo(roundedX, roundedY);
        
        // Update current path data
        setCurrentPath({
          path: currentPath.path,
          startX: currentPath.startX,
          startY: currentPath.startY,
          points: [...currentPath.points, [roundedX, roundedY]],
          color: currentPath.color
        });

        // Add lineTo command
        setUserCommands(prev => {
          const newCommands = [...prev, {
            type: 'lineTo' as const,
            x: roundedX,
            y: roundedY
          }];
          console.log('🎯 STROKE MOVE - userCommands count after adding lineTo:', newCommands.length);
          return newCommands;
        });
      }
    };

    const onTouchEnd = () => {
      if (currentPath) {
        console.log('🚨 CRITICAL BUG CHECK - onTouchEnd:');
        console.log('  🎯 Current stroke color:', currentPath.color);
        console.log('  🎯 Current stroke points count:', currentPath.points.length);
        console.log('  🚨 TOTAL userCommands being captured:', userCommands.length);
        console.log('  🚨 All userCommands:', userCommands.map(cmd => `${cmd.type}(...)`).join(', '));
        
        const stroke: Stroke = {
          path: currentPath.path,
          commands: [...userCommands], // ❌ POTENTIAL BUG: capturing ALL commands
          color: currentPath.color
        };
        
        console.log('  ✅ Stroke created with', stroke.commands.length, 'commands and color', stroke.color);
        
        setStrokes(prev => {
          const newStrokes = [...prev, stroke];
          console.log('  ✅ Total strokes now:', newStrokes.length);
          return newStrokes;
        });
        setPaths(prev => {
          const newPaths = [...prev, currentPath.path];
          console.log('  ✅ Total paths now:', newPaths.length);
          return newPaths;
        });
        
        undoStack.current.push(stroke);
        redoStack.current = [];
        if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
        
        setCurrentPath(null);
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
          {paths.map((path, index) => {
            const matchingStroke = strokes.find(stroke => stroke.path === path);
            
            // Log path-stroke mapping issues
            if (!matchingStroke) {
              console.log('🚨 RENDER BUG - No matching stroke found for path index:', index);
              console.log('  🎯 Total paths:', paths.length, 'Total strokes:', strokes.length);
              console.log('  🚨 Using fallback color #000000');
            } else {
              console.log('✅ RENDER OK - Path', index, 'matched with color:', matchingStroke.color);
            }
            
            return (
              <Path
                key={index}
                path={path}
                color={matchingStroke ? matchingStroke.color : '#000000'}
                style="stroke"
                strokeWidth={2}
              />
            );
          })}
          {currentPath && (
            <Path
              path={currentPath.path}
              color={currentPath.color}
              style="stroke"
              strokeWidth={2}
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