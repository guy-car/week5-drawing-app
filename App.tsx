import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Modal from 'react-native-modal';
import { useFonts } from 'expo-font';
import { Alien, MagnifyingGlassPlus, MagnifyingGlassMinus, ArrowUDownLeft, ArrowUDownRight, TrashSimple } from 'phosphor-react-native';
import DrawingCanvas from './components/DrawingCanvas';
import { analyzeThenDrawWithContext } from './src/api/openai';
import { riffOnSketch } from './src/api/openai/riffOnSketch';
import { DrawingCommand } from './src/api/openai/types';
import { vectorSummary } from './src/utils/vectorSummary';
import { streamLog } from './src/api/openai/config';
import { stamp, printPerf } from './src/utils/performance';
import BottomToolbar from './components/BottomToolbar';
import LinearGradient from 'react-native-linear-gradient';
import { DEFAULT_CANVAS_BG, DEFAULT_STROKE_COL, DEFAULT_APP_BG } from './src/constants/canvas';
import IntroOverlay from './components/IntroOverlay';
import CustomText from './components/CustomText';


const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

// Define the ref type to match DrawingCanvas
interface DrawingCanvasRef {
  clear: () => void;
  handleZoom: (increment: boolean) => void;
  exportCanvas: () => Promise<string | null>;
  exportCanvasWithCommands: () => Promise<{ image: string | null; commands: DrawingCommand[] }>;
  addAIPath: (commands: any[]) => void;
  addDebugGrid: () => void;
  addAICommandIncremental: (command: DrawingCommand) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
  isEmpty: () => boolean;
}

export default function App() {
  const [fontsLoaded, fontError] = useFonts({
    'Exo2-Light': require('./assets/fonts/Exo2-Light.ttf'),
    'Exo2-Medium': require('./assets/fonts/Exo2-Medium.ttf'),
    'Exo2-MediumItalic': require('./assets/fonts/Exo2-MediumItalic.ttf'),
    'Exo2-Regular': require('./assets/fonts/Exo2-Medium.ttf'),
  });

  const [mode, setMode] = useState<'draw' | 'pan'>('draw');
  const [zoom, setZoom] = useState(1.25); // Match initial zoom level from DrawingCanvas
  const [isTestingAI, setIsTestingAI] = useState(false);
  const [canvasEmpty, setCanvasEmpty] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const [selectedColor, setSelectedColor] = useState(DEFAULT_STROKE_COL);
  const [activeTool, setActiveTool] = useState<'draw' | 'erase'>('draw');
  const [strokeWidth, setStrokeWidth] = useState(2);
  const canvasRef = useRef<DrawingCanvasRef>(null);
  const [showIntro, setShowIntro] = useState(true);
  const [showMainContent, setShowMainContent] = useState(false);
  
  // Zoom button state
  const MIN_ZOOM = 0.5;
  const MAX_ZOOM = 3;
  const canZoomIn = zoom < MAX_ZOOM;
  const canZoomOut = zoom > MIN_ZOOM;

  // Poll canvas empty state
  useEffect(() => {
    const interval = setInterval(() => {
      if (canvasRef.current) {
        setCanvasEmpty(canvasRef.current.isEmpty());
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  const handleClear = () => {
    if (canvasRef.current && !canvasEmpty) {
      setShowConfirm(true);
    }
  };

  const handleZoom = (increment: boolean) => {
    if (canvasRef.current) {
      canvasRef.current.handleZoom(increment);
    }
  };

  const toggleMode = () => {
    setMode(mode === 'draw' ? 'pan' : 'draw');
  };

  const proceedWithAPICallHandler = async () => {
    if (!canvasRef.current) {
      Alert.alert('Error', 'Canvas not available');
      return;
    }

    setIsTestingAI(true);
    streamLog.info('🎨 Starting AI analysis...');

    try {
      const canvasData = await canvasRef.current.exportCanvasWithCommands();
      if (!canvasData.image) throw new Error('Failed to export canvas');

      let commands: DrawingCommand[];
      
      stamp('upload-start');

      if (process.env.EXPO_PUBLIC_RIFF_ON_SKETCH === '1') {
        streamLog.info('🎨 Using riff-on-sketch mode');
        
        // A/B Test: Conditionally use vectorSummary based on environment variable
        const useVectorSummary = process.env.EXPO_PUBLIC_DISABLE_VECTOR_SUMMARY !== '1';
        
        if (useVectorSummary) {
          streamLog.info('🔍 Using vectorSummary analysis');
          const summary = vectorSummary(canvasData.commands);
          commands = await riffOnSketch({ 
            image: canvasData.image!,
            summary,
            onIncrementalDraw: canvasRef.current.addAICommandIncremental,
            selectedColor
          });
        } else {
          streamLog.info('📸 Using image-only analysis (no vectorSummary)');
          commands = await riffOnSketch({ 
            image: canvasData.image!,
            // summary omitted for A/B test
            onIncrementalDraw: canvasRef.current.addAICommandIncremental,
            selectedColor
          });
        }
      } else {
        streamLog.info('📊 Using standard mode');
        commands = await analyzeThenDrawWithContext(canvasData.image, canvasData.commands, selectedColor);
      }

      canvasRef.current.addAIPath(commands);

      stamp('done');
      printPerf();
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      streamLog.warn('❌ Error during AI analysis:', errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setIsTestingAI(false);
    }
  };

  const handleUndo = () => {
    if (canvasRef.current) {
      canvasRef.current.undo();
    }
  };

  const handleRedo = () => {
    if (canvasRef.current) {
      canvasRef.current.redo();
    }
  };

  const [canUndo, setCanUndo] = useState(false);
  const [canRedo, setCanRedo] = useState(false);

  // Poll undo/redo state
  useEffect(() => {
    const interval = setInterval(() => {
      if (canvasRef.current) {
        setCanUndo(canvasRef.current.canUndo());
        setCanRedo(canvasRef.current.canRedo());
      }
    }, 100);
    return () => clearInterval(interval);
  }, []);

  // Debug font loading
  useEffect(() => {
    console.log('Font loading status:', { fontsLoaded, fontError });
    if (fontError) {
      console.error('Font loading error:', fontError);
    }
  }, [fontsLoaded, fontError]);

  // Don't render anything until fonts are loaded
  if (fontError) {
    console.error('Font error, falling back to system fonts');
    // Continue with rendering using system fonts
  } else if (!fontsLoaded) {
    return null;
  }

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar style="auto" />
      
      {showMainContent && (
        <>
          {/* Header Controls */}
          <View style={styles.header}>
            {/* Left Column */}
            <View style={styles.column}>
              <TouchableOpacity 
                style={[styles.button, mode === 'draw' && styles.activeButton]} 
                onPress={toggleMode}
              >
                <CustomText style={[styles.buttonText, mode === 'draw' && styles.activeButtonText]}>
                  {mode === 'draw' ? 'Move' : 'Draw'}
                </CustomText>
              </TouchableOpacity>

              <View style={styles.buttonGroup}>
                <TouchableOpacity 
                  style={[styles.iconButton, canUndo && styles.activeButton, !canUndo && styles.disabledButton]} 
                  onPress={handleUndo}
                  disabled={!canUndo}
                >
                  <ArrowUDownLeft
                    size={24}
                    color={canUndo ? "#FFFFFF" : "#666666"}
                    weight="bold"
                  />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.iconButton, canRedo && styles.activeButton, !canRedo && styles.disabledButton]} 
                  onPress={handleRedo}
                  disabled={!canRedo}
                >
                  <ArrowUDownRight
                    size={24}
                    color={canRedo ? "#FFFFFF" : "#666666"}
                    weight="bold"
                  />
                </TouchableOpacity>
              </View>
            </View>

            {/* Center Column */}
            <View style={styles.column}>
              <TouchableOpacity 
                style={[styles.aiButton, isTestingAI && styles.disabledButton]} 
                onPress={proceedWithAPICallHandler}
                disabled={isTestingAI}
              >
                <Alien 
                  size={32}
                  color={selectedColor}
                  // color={selectedColor === DEFAULT_STROKE_COL ? '#2eff4d' : selectedColor}
                  weight="fill"
                />
              </TouchableOpacity>
            </View>

            {/* Right Column */}
            <View style={styles.column}>
              <TouchableOpacity 
                style={[styles.button, !canvasEmpty && styles.activeButton, canvasEmpty && styles.disabledButton]} 
                onPress={handleClear}
                disabled={canvasEmpty}
                accessibilityLabel="Clear canvas"
              >
                <TrashSimple
                  size={28}
                  color={!canvasEmpty ? "#FFFFFF" : "#666666"}
                  weight="bold"
                />
              </TouchableOpacity>

              <View style={styles.buttonGroup}>
                <TouchableOpacity 
                  style={[styles.iconButton, canZoomOut && styles.activeButton, !canZoomOut && styles.disabledButton]} 
                  onPress={() => handleZoom(false)}
                  disabled={!canZoomOut}
                >
                  <MagnifyingGlassMinus
                    size={24}
                    color={canZoomOut ? "#FFFFFF" : "#666666"}
                    weight="bold"
                  />
                </TouchableOpacity>
                <TouchableOpacity 
                  style={[styles.iconButton, canZoomIn && styles.activeButton, !canZoomIn && styles.disabledButton]} 
                  onPress={() => handleZoom(true)}
                  disabled={!canZoomIn}
                >
                  <MagnifyingGlassPlus
                    size={24}
                    color={canZoomIn ? "#FFFFFF" : "#666666"}
                    weight="bold"
                  />
                </TouchableOpacity>
              </View>
            </View>
          </View>

          {/* Main Canvas */}
          <View style={styles.canvasContainer}>
            <DrawingCanvas
              ref={canvasRef}
              mode={mode}
              onZoomChange={setZoom}
              selectedColor={selectedColor}
              onModeChange={setMode}
              backgroundColor={DEFAULT_CANVAS_BG}
              tool={activeTool}
              strokeWidth={strokeWidth}
            />
          </View>

          {/* Bottom Toolbar */}
          <View style={styles.bottomToolbar}>
            <BottomToolbar
              color={selectedColor}
              onColorChange={setSelectedColor}
              backgroundColor={DEFAULT_CANVAS_BG}
              onToolChange={setActiveTool}
              onStrokeWidthChange={setStrokeWidth}
              defaultStrokeWidth={strokeWidth}
              canErase={!canvasEmpty}
            />
          </View>

          {/* Clear Confirmation Modal */}
          <Modal
            isVisible={showConfirm}
            onBackdropPress={() => setShowConfirm(false)}
            style={styles.modal}
          >
            <View style={styles.modalCard}>
              <CustomText style={styles.modalTitle}>Clear canvas?</CustomText>
              <CustomText style={styles.modalMsg}>This will erase all strokes.</CustomText>
              <View style={styles.modalRow}>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalCancel]}
                  onPress={() => setShowConfirm(false)}
                >
                  <CustomText style={styles.modalCancelTxt}>Cancel</CustomText>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.modalBtn, styles.modalDanger]}
                  onPress={() => {
                    canvasRef.current?.clear();
                    setShowConfirm(false);
                  }}
                >
                  <CustomText style={styles.modalDangerTxt}>Clear</CustomText>
                </TouchableOpacity>
              </View>
            </View>
          </Modal>
        </>
      )}
      
      {showIntro && (
        <IntroOverlay 
          onComplete={() => {
            setShowIntro(false);
            // Small delay to ensure smooth transition
            setTimeout(() => setShowMainContent(true), 100);
          }} 
        />
      )}
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: DEFAULT_APP_BG,
  },
  header: {
    flexDirection: 'row',
    backgroundColor: DEFAULT_APP_BG,
    paddingTop: 50,
    paddingBottom: 10,
  },
  column: {
    flex: 1,
    flexDirection: 'column',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: 10,
    gap: 8,
  },
  button: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#e0e0e0',
    minWidth: 80,
    alignItems: 'center',
  },
  activeButton: {
    backgroundColor: 'black',
  },
  buttonText: {
    color: '#000000',
    fontSize: 16,
    fontWeight: '400',
  },
  activeButtonText: {
    color: '#ffffff',
    fontWeight: '400',
  },
  buttonGroup: {
    flexDirection: 'row',
    gap: 10,
  },
  iconButton: {
    padding: 8,
    borderRadius: 8,
    backgroundColor: '#e0e0e0',
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  disabledButton: {
    backgroundColor: '#e0e0e0',
    opacity: 0.5,
  },
  aiButton: {
    width: 80,
    height: 80,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'black',
    borderRadius: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  canvasContainer: {
    flex: 1,
    backgroundColor: DEFAULT_APP_BG,
  },
  bottomToolbar: {
    backgroundColor: 'transparent',
    paddingTop: 16,
    paddingBottom: 20,
    paddingHorizontal: 16,
  },
  modal: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalCard: { 
    width: 280, 
    backgroundColor: '#fff', 
    borderRadius: 12, 
    padding: 20,
    alignItems: 'center'
  },
  modalTitle: { 
    fontSize: 18, 
    fontWeight: '700', 
    marginBottom: 8,
    textAlign: 'center'
  },
  modalMsg: { 
    fontSize: 14, 
    color: '#555', 
    marginBottom: 20,
    textAlign: 'center'
  },
  modalRow: { 
    flexDirection: 'row', 
    justifyContent: 'center',
    width: '100%',
    gap: 8
  },
  modalBtn: { 
    paddingVertical: 8, 
    paddingHorizontal: 16,
    borderRadius: 6,
    minWidth: 80,
    alignItems: 'center',
    backgroundColor: 'black'
  },
  modalCancel: { 
    backgroundColor: '#e0e0e0',
    marginRight: 8
  },
  modalDanger: { 
    backgroundColor: '#fc6d6d'
  },
  modalCancelTxt: { 
    color: '#333', 
    fontWeight: '600',
    fontSize: 16
  },
  modalDangerTxt: { 
    color: '#fff', 
    fontWeight: '600',
    fontSize: 16
  },
}); 