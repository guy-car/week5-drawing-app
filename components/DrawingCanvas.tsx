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

const DrawingCanvas = forwardRef<DrawingCanvasRef, DrawingCanvasProps>(
  ({ mode, onZoomChange, screenWidth, screenHeight }, ref) => {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const [isDrawing, setIsDrawing] = useState(false);
    
    // Mobile drawing state
    const [paths, setPaths] = useState<any[]>([]);
    const [currentPath, setCurrentPath] = useState<any>(null);
    
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
        const newPath = Skia.Path.Make();
        newPath.moveTo(locationX, locationY);
        setCurrentPath(newPath);
      }
    };

    const onTouchMove = (event: any) => {
      if (mode !== 'draw' || !currentPath) return;
      
      const { locationX, locationY } = event.nativeEvent;
      if (locationX !== undefined && locationY !== undefined) {
        const newPath = Skia.Path.MakeFromSVGString(currentPath.toSVGString())!;
        newPath.lineTo(locationX, locationY);
        setCurrentPath(newPath);
      }
    };

    const onTouchEnd = () => {
      if (currentPath && mode === 'draw') {
        setPaths(prevPaths => [...prevPaths, currentPath]);
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
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
        >
          <Canvas
            style={{
              width: '100%',
              height: '100%',
            }}
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
                path={currentPath}
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