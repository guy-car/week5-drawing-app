import React, { useState, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import DrawingCanvas from './components/DrawingCanvas';
import { analyzeThenDraw } from './src/api/openai';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

// Define the ref type to match DrawingCanvas
interface DrawingCanvasRef {
  clear: () => void;
  handleZoom: (increment: boolean) => void;
  exportCanvas: () => Promise<string | null>;
  addAIPath: (commands: any[]) => void;
  addDebugGrid: () => void;
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
    console.log('🔍 Starting two-step AI analysis...');

    try {
      const base64Image = await canvasRef.current.exportCanvas();
      if (!base64Image) throw new Error('Failed to export canvas');

      const commands = await analyzeThenDraw(base64Image);
      console.log('✅ Successfully parsed AI commands:', commands);

      // Use our addAIPath method to render the commands
      canvasRef.current.addAIPath(commands);

      Alert.alert('AI Test Success!', `✅ Canvas exported and AI commands rendered!\n\nAI added ${commands.length} drawing commands.\n\nCheck console for full response.`, [{ text: 'OK' }]);
    } catch (error) {
      console.error('❌ AI Integration Test Failed:', error);
      Alert.alert('AI Test Failed', error instanceof Error ? error.message : 'Unknown error occurred', [{ text: 'OK' }]);
    } finally {
      setIsTestingAI(false);
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
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
    alignItems: 'center',
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