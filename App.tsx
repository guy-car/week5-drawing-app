import React, { useState, useRef, useEffect } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import Modal from 'react-native-modal';
import DrawingCanvas from './components/DrawingCanvas';
import { analyzeThenDrawWithContext } from './src/api/openai';
import { riffOnSketch } from './src/api/openai/riffOnSketch';
import { DrawingCommand } from './src/api/openai/types';
import { vectorSummary } from './src/utils/vectorSummary';
import { streamLog } from './src/api/openai/config';
import { stamp, printPerf } from './src/utils/performance';

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
  const [mode, setMode] = useState<'draw' | 'pan'>('draw');
  const [zoom, setZoom] = useState(1);
  const [isTestingAI, setIsTestingAI] = useState(false);
  const [canvasEmpty, setCanvasEmpty] = useState(true);
  const [showConfirm, setShowConfirm] = useState(false);
  const canvasRef = useRef<DrawingCanvasRef>(null);

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
        const summary = vectorSummary(canvasData.commands);
        commands = await riffOnSketch({ 
          image: canvasData.image!,
          summary,
          onIncrementalDraw: canvasRef.current.addAICommandIncremental
        });
      } else {
        streamLog.info('📊 Using standard mode');
        commands = await analyzeThenDrawWithContext(canvasData.image, canvasData.commands);
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

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar style="auto" />
      
      {/* Header Controls */}
      <View style={styles.header}>
        <View style={styles.leftControls}>
          <TouchableOpacity 
            style={[styles.button, mode === 'draw' && styles.activeButton]} 
            onPress={toggleMode}
          >
            <Text style={[styles.buttonText, mode === 'draw' && styles.activeButtonText]}>
              {mode === 'draw' ? 'Draw' : 'Move'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.zoomControls}>
          <TouchableOpacity 
            style={[styles.zoomButton, styles.marginLeft]} 
            onPress={() => handleZoom(false)}
          >
            <Text style={styles.zoomButtonText}>-</Text>
          </TouchableOpacity>
          <Text style={styles.zoomText}>{zoom.toFixed(1)}x</Text>
          <TouchableOpacity 
            style={styles.zoomButton} 
            onPress={() => handleZoom(true)}
          >
            <Text style={styles.zoomButtonText}>+</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.rightControls}>
          <TouchableOpacity 
            style={[styles.clearButton, canvasEmpty && styles.disabledButton]} 
            onPress={handleClear}
            disabled={canvasEmpty}
          >
            <Text style={[styles.clearButtonText, canvasEmpty && styles.disabledButtonText]}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* AI Button and History Controls */}
      <View style={styles.aiTestContainer}>
        <View style={styles.historyControls}>
          <TouchableOpacity 
            style={[styles.undoButton, !canUndo && styles.disabledButton]} 
            onPress={handleUndo}
            disabled={!canUndo}
          >
            <Text style={[styles.buttonText, !canUndo && styles.disabledButtonText]}>↩</Text>
          </TouchableOpacity>
          <TouchableOpacity 
            style={[styles.redoButton, !canRedo && styles.disabledButton]} 
            onPress={handleRedo}
            disabled={!canRedo}
          >
            <Text style={[styles.buttonText, !canRedo && styles.disabledButtonText]}>↪</Text>
          </TouchableOpacity>
        </View>
        <TouchableOpacity 
          style={[styles.aiTestButton, isTestingAI && styles.aiTestButtonDisabled]} 
          onPress={proceedWithAPICallHandler}
          disabled={isTestingAI}
        >
          <Text style={styles.aiTestButtonText}>
            {isTestingAI ? '🧪 Processing...' : '🤖 AI Draw'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Canvas */}
      <View style={styles.canvasContainer}>
        <DrawingCanvas
          ref={canvasRef}
          mode={mode}
          onZoomChange={setZoom}
          screenWidth={screenWidth}
          screenHeight={screenHeight - 160}
        />
      </View>

      <Modal
        isVisible={showConfirm}
        onBackdropPress={() => setShowConfirm(false)}
        animationIn="zoomIn"
        animationOut="zoomOut"
        backdropColor="transparent"
        backdropOpacity={0.5}
        style={styles.modalContainer}
      >
        <View style={styles.modalCard}>
          <Text style={styles.modalTitle}>Clear canvas?</Text>
          <Text style={styles.modalMsg}>This will erase all strokes.</Text>
          <View style={styles.modalRow}>
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalCancel]}
              onPress={() => setShowConfirm(false)}
            >
              <Text style={styles.modalCancelTxt}>Cancel</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, styles.modalDanger]}
              onPress={() => {
                canvasRef.current?.clear();
                setShowConfirm(false);
              }}
            >
              <Text style={styles.modalDangerTxt}>Clear</Text>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </GestureHandlerRootView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#f5f5f5',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    paddingHorizontal: 20,
    paddingVertical: 15,
    paddingTop: 50,
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  leftControls: {
    flex: 1,
  },
  rightControls: {
    flex: 1,
    alignItems: 'flex-end',
  },
  zoomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  button: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#e0e0e0',
    alignSelf: 'flex-start',
  },
  activeButton: {
    backgroundColor: '#007AFF',
  },
  buttonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#333',
  },
  activeButtonText: {
    color: '#fff',
  },
  zoomButton: {
    width: 30,
    height: 30,
    backgroundColor: '#007AFF',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  marginLeft: {
    marginLeft: 15,
  },
  zoomButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  zoomText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    minWidth: 50,
    textAlign: 'center',
    marginHorizontal: 10,
  },
  clearButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#fc6d6d',
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  aiTestContainer: {
    flexDirection: 'row',
    justifyContent: 'space-evenly',
    alignItems: 'center',
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  aiTestButton: {
    backgroundColor: '#28a745',
    paddingHorizontal: 30,
    paddingVertical: 12,
    borderRadius: 8,
    minWidth: 150,
    alignItems: 'center',
  },
  aiTestButtonDisabled: {
    backgroundColor: '#6c757d',
  },
  aiTestButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  canvasContainer: {
    flex: 1,
    backgroundColor: '#ffff',
  },
  historyControls: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 10,
  },
  undoButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    marginRight: 8,
  },
  redoButton: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#007AFF',
    marginLeft: 8,
  },
  disabledButton: {
    backgroundColor: '#e0e0e0',
  },
  disabledButtonText: {
    color: '#999',
  },
  modalContainer: {
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
    alignItems: 'center'
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