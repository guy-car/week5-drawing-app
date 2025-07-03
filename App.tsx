import React, { useState, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import DrawingCanvas from './components/DrawingCanvas';
import { analyzeThenDraw, analyzeThenDrawWithContext } from './src/api/openai';
import { riffOnSketch, testStreamingParser } from './src/api/openai/riffOnSketch';
import { DrawingCommand } from './src/api/openai/types';
import { vectorSummary } from './src/utils/vectorSummary';
import { streamLog } from './src/api/openai/config';

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
}

export default function App() {
  const [mode, setMode] = useState<'draw' | 'pan'>('draw');
  const [zoom, setZoom] = useState(1);
  const [isTestingAI, setIsTestingAI] = useState(false);
  const canvasRef = useRef<DrawingCanvasRef>(null);

  const handleClear = () => {
    if (canvasRef.current) {
      canvasRef.current.clear();
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
    } catch (error: unknown) {
      const errorMessage = error instanceof Error ? error.message : 'An unknown error occurred';
      streamLog.warn('❌ Error during AI analysis:', errorMessage);
      Alert.alert('Error', errorMessage);
    } finally {
      setIsTestingAI(false);
    }
  };

  const testStreaming = async () => {
    try {
      const commands = await testStreamingParser();
      console.log('🎉 Streaming parser works!', commands);
      alert(`Success! Parsed ${commands.length} commands`);
    } catch (error) {
      console.error('❌ Streaming parser failed:', error);
      alert(`Failed: ${error.message}`);
    }
  };

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
          <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* AI Button */}
      <View style={styles.aiTestContainer}>
        <TouchableOpacity onPress={testStreaming}>
          <Text>🧪 Test Streaming Parser</Text>
        </TouchableOpacity>
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
          screenHeight={screenHeight - 160} // Account for header + AI button
        />
      </View>
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
    justifyContent: 'space-between',
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
    backgroundColor: '#ff4444',
  },
  clearButtonText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#fff',
  },
  aiTestContainer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
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
}); 