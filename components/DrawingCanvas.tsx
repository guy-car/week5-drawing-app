import { forwardRef, useImperativeHandle, useState, useRef, useEffect } from 'react';
import { View, Platform, Text } from 'react-native';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';

const CANVAS_SIZE = 1000;

interface DrawingCanvasProps {
  mode: 'draw' | 'pan';
  onZoomChange: (zoom: number) => void;
  screenWidth: number;
  screenHeight: number;
}

interface DrawingCanvasRef {
  clear: () => void;
}

// Types for path data
interface PathWithData {
  path: any; // Skia.Path type
  startX: number;
  startY: number;
  points: [number, number][];
}

const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(
  ({ mode, onZoomChange, screenWidth, screenHeight }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    
    // Mobile drawing state
    const [paths, setPaths] = useState<any[]>([]);
    const [currentPath, setCurrentPath] = useState<PathWithData | null>(null);
    
    // Calculate initial scale to fit canvas in screen
    const initialScale = Math.min(screenWidth / CANVAS_SIZE, screenHeight / CANVAS_SIZE) * 0.9;

    useImperativeHandle(ref, () => ({
      clear: () => {
        if (Platform.OS === 'web' && canvasRef.current) {
          const ctx = canvasRef.current.getContext('2d');
          if (ctx) {
            ctx.clearRect(0, 0, canvasRef.current.width, canvasRef.current.height);
          }
        } else {
          // Clear mobile paths
          setPaths([]);
          setCurrentPath(null);
        }
      },
    }));

    // Update zoom level in parent
    const updateZoom = (newZoom: number) => {
      onZoomChange(newZoom / initialScale);
    };

    // Web-specific drawing handlers
    const handleMouseDown = (e: any) => {
      if (mode !== 'draw') return;
      setIsDrawing(true);
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect && canvasRef.current) {
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.beginPath();
          ctx.moveTo(x, y);
        }
      }
    };

    const handleMouseMove = (e: any) => {
      if (!isDrawing || mode !== 'draw') return;
      const rect = canvasRef.current?.getBoundingClientRect();
      if (rect && canvasRef.current) {
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.lineTo(x, y);
          ctx.stroke();
        }
      }
    };

    const handleMouseUp = () => {
      setIsDrawing(false);
    };

    // Mobile touch events for Skia
    const onTouchStart = (event: any) => {
      if (mode !== 'draw') return;
      
      const { locationX, locationY } = event.nativeEvent;
      
      if (locationX !== undefined && locationY !== undefined) {
        // Create path and store initial point
        const path = Skia.Path.Make();
        path.moveTo(locationX, locationY);
        
        // Store the initial point with the path
        const pathWithStart: PathWithData = {
          path,
          startX: locationX,
          startY: locationY,
          points: [[locationX, locationY]]
        };
        
        setCurrentPath(pathWithStart);
      }
    };

    const onTouchMove = (event: any) => {
      if (mode !== 'draw' || !currentPath) return;
      
      const { locationX, locationY } = event.nativeEvent;
      
      if (locationX !== undefined && locationY !== undefined) {
        // Create a new path starting from the original point
        const newPath = Skia.Path.Make();
        newPath.moveTo(currentPath.startX, currentPath.startY);
        
        // Add all existing points
        currentPath.points.forEach(([x, y]: [number, number]) => {
          newPath.lineTo(x, y);
        });
        
        // Add the new point
        newPath.lineTo(locationX, locationY);
        
        // Update the path and points array
        const updatedPath: PathWithData = {
          path: newPath,
          startX: currentPath.startX,
          startY: currentPath.startY,
          points: [...currentPath.points, [locationX, locationY]]
        };
        
        setCurrentPath(updatedPath);
      }
    };

    const onTouchEnd = () => {
      if (currentPath?.path && mode === 'draw') {
        setPaths(prevPaths => [...prevPaths, currentPath.path]);
        setCurrentPath(null);
      }
    };

    // Set up canvas context for web
    useEffect(() => {
      if (Platform.OS === 'web' && canvasRef.current) {
        const ctx = canvasRef.current.getContext('2d');
        if (ctx) {
          ctx.strokeStyle = 'black';
          ctx.lineWidth = 2;
          ctx.lineCap = 'round';
          ctx.lineJoin = 'round';
        }
      }
    }, []);

    // Web implementation with HTML5 Canvas
    if (Platform.OS === 'web') {
      return (
        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <canvas
            ref={canvasRef}
            width={screenWidth * 0.9}
            height={screenHeight * 0.8}
            style={{
              border: '1px solid #ccc',
              backgroundColor: 'white',
              cursor: mode === 'draw' ? 'crosshair' : 'grab',
            }}
            onMouseDown={handleMouseDown}
            onMouseMove={handleMouseMove}
            onMouseUp={handleMouseUp}
            onMouseLeave={handleMouseUp}
          />
        </View>
      );
    }

    // Mobile implementation with React Native Skia
    return (
      <View style={{ 
        flex: 1, 
        justifyContent: 'center', 
        alignItems: 'center',
        backgroundColor: 'white',
      }}>
        <View
          style={{
            width: screenWidth * 0.9,
            height: screenHeight * 0.8,
            backgroundColor: 'white',
            borderWidth: 1,
            borderColor: '#ccc',
          }}
        >
          <Canvas
            style={{
              width: '100%',
              height: '100%',
            }}
            onTouchStart={onTouchStart}
            onTouchMove={onTouchMove}
            onTouchEnd={onTouchEnd}
          >
            {/* Render all completed paths */}
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
            {/* Render current path being drawn */}
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
          </Canvas>
        </View>
        <Text style={{
          position: 'absolute',
          bottom: 20,
          fontSize: 14,
          color: '#666',
          textAlign: 'center',
        }}>
          {mode === 'draw' ? 'Tap and drag to draw' : 'Pan mode active'}
        </Text>
      </View>
    );
  }
);

export default DrawingCanvas; 