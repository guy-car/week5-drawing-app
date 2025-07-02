import { forwardRef, useImperativeHandle, useState, useEffect, useRef, ReactNode } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Canvas, Path, Skia, Group, Rect, useCanvasRef, ImageFormat, SkPath } from '@shopify/react-native-skia';
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
  exportCanvas: (opts?: { resize?: number; format?: 'png'|'jpeg'; quality?: number }) => Promise<string | null>;
  exportCanvasWithCommands: () => Promise<{ image: string | null; commands: DrawingCommand[]; summary: VectorSummary }>;
  addAIPath: (commands: DrawingCommand[]) => void;
  addAICommandIncremental: (command: DrawingCommand) => void;
  addDebugGrid: () => void;
}

interface PathWithData {
  path: any;
  startX: number;
  startY: number;
  points: [number, number][];
}

const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(({ mode, onZoomChange, screenWidth, screenHeight }, ref): ReactNode => {
  const [paths, setPaths] = useState<SkPath[]>([]);
  const [redrawCounter, setRedrawCounter] = useState<number>(0);
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

  const exportCanvas = async (opts?: { resize?: number; format?: 'png'|'jpeg'; quality?: number }): Promise<string | null> => {
    try {
      if (!canvasRef.current) {
        console.error('Canvas ref is not available');
        return null;
      }

      // Default options
      const { resize = 256, format = 'jpeg', quality = 0.6 } = opts || {};

      // Create an image snapshot of the current canvas
      const image = canvasRef.current.makeImageSnapshot();
      if (!image) {
        console.error('Failed to create image snapshot');
        return null;
      }

      // Create a surface for resizing
      const surface = Skia.Surface.Make(resize, resize);
      if (!surface) {
        console.error('Failed to create surface for resizing');
        return null;
      }

      // Create a paint object for drawing
      const paint = Skia.Paint();
      paint.setAntiAlias(true);

      // Draw the image scaled to fit the new size
      const srcRect = Skia.XYWHRect(0, 0, BASE_CANVAS_SIZE, BASE_CANVAS_SIZE);
      const dstRect = Skia.XYWHRect(0, 0, resize, resize);
      surface.getCanvas().drawImageRect(image, srcRect, dstRect, paint);

      // Get the resized image
      const finalImage = surface.makeImageSnapshot();
      if (!finalImage) {
        console.error('Failed to create resized image snapshot');
        return null;
      }

      // Encode the image with the specified format and quality
      const bytes = format === 'jpeg' 
        ? finalImage.encodeToBytes(ImageFormat.JPEG, quality * 100) // JPEG quality is 0-100
        : finalImage.encodeToBytes();

      if (!bytes) {
        console.error('Failed to encode image to bytes');
        return null;
      }

      // Convert bytes to base64 string
      const base64 = bytes.reduce((data: string, byte: number) => data + String.fromCharCode(byte), '');
      const base64String = btoa(base64);
      
      console.log(`✅ Canvas exported successfully as ${format.toUpperCase()}, base64 length:`, base64String.length);
      return `data:image/${format};base64,${base64String}`;
    } catch (error) {
      console.error('❌ Error exporting canvas:', error);
      return null;
    }
  };

  const exportCanvasWithCommands = async (): Promise<{ 
    image: string | null; 
    commands: DrawingCommand[];
    summary: VectorSummary;
  }> => {
    try {
      // Get the canvas image using the enhanced exportCanvas function
      const image = await exportCanvas({
        resize: 256,
        format: 'jpeg',
        quality: 0.6
      });
      
      // Generate vector summary
      const summary = vectorSummary([...userCommands]);
      
      // Return both image, commands, and summary
      const result = {
        image,
        commands: [...userCommands],
        summary
      };
      
      console.log('✅ Canvas with commands exported successfully');
      console.log(`📊 Image: ${image ? 'Success' : 'Failed'}, Commands: ${result.commands.length} total`);
      console.log('🎯 Commands preview:', result.commands.slice(0, 5)); // Show first 5 commands
      console.log('📐 Vector summary:', result.summary);
      
      return result;
    } catch (error) {
      console.error('❌ Error exporting canvas with commands:', error);
      return {
        image: null,
        commands: [],
        summary: vectorSummary([])
      };
    }
  };

  const addCommandToPath = (command: DrawingCommand) => {
    const path = Skia.Path.Make();
    switch (command.type) {
      case 'moveTo':
        path.moveTo(command.x, command.y);
        break;
      case 'lineTo':
        path.lineTo(command.x, command.y);
        break;
      case 'quadTo':
        path.quadTo(command.x1, command.y1, command.x2, command.y2);
        break;
      case 'cubicTo':
        path.cubicTo(command.x1, command.y1, command.x2, command.y2, command.x3, command.y3);
        break;
      case 'addCircle':
        path.addCircle(command.cx, command.cy, command.radius);
        break;
      case 'addRect':
        path.addRect({ x: command.x, y: command.y, width: command.width, height: command.height });
        break;
      case 'addOval':
        path.addOval({ x: command.x, y: command.y, width: command.width, height: command.height });
        break;
      case 'addArc':
        path.addArc({ x: command.x, y: command.y, width: command.width, height: command.height }, command.startAngle, command.sweepAngle);
        break;
      case 'addRoundRect':
        path.addRRect({
          rect: { x: command.x, y: command.y, width: command.width, height: command.height },
          rx: command.rx,
          ry: command.ry
        });
        break;
    }
    setPaths(prevPaths => [...prevPaths, path]);
  };

  const addAIPath = (commands: DrawingCommand[]) => {
    commands.forEach(command => {
      addCommandToPath(command);
    });
  };

  const addAICommandIncremental = (command: DrawingCommand) => {
    addCommandToPath(command);
    requestAnimationFrame(() => {
      setRedrawCounter((prev: number) => prev + 1);
    });
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
      console.log('Canvas and user commands cleared');
    },
    handleZoom,
    exportCanvas,
    exportCanvasWithCommands,
    addAIPath,
    addAICommandIncremental,
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

  return (
    <View style={styles.container}>
      {/* Rest of the component JSX code */}
    </View>
  );
});

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#fff',
  },
});

export default DrawingCanvas;