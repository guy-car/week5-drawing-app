import React, { useState, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import DrawingCanvas from './components/DrawingCanvas';
import { debugAIVision, debugDrawingIntention, testCoordinates, proceedWithAPICall } from './src/api/openai';

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
    console.log('🧪 Starting AI integration test...');

    try {
      const base64Image = await canvasRef.current.exportCanvas();
      if (!base64Image) throw new Error('Failed to export canvas');

      const commands = await proceedWithAPICall(base64Image);
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

  const debugAIVisionHandler = async () => {
    if (!canvasRef.current) {
      Alert.alert('Error', 'Canvas not available');
      return;
    }
    setIsTestingAI(true);
    console.log('🔍 Debugging AI Vision...');

    try {
      const base64Image = await canvasRef.current.exportCanvas();
      if (!base64Image) throw new Error('Failed to export canvas');

      const description = await debugAIVision(base64Image);
      console.log('🤖 AI Vision Analysis:', description);
      Alert.alert('AI Vision Debug', description, [{ text: 'OK' }]);
    } catch (error) {
      console.error('❌ AI Vision Debug Failed:', error);
      Alert.alert('Debug Failed', error instanceof Error ? error.message : 'Unknown error', [{ text: 'OK' }]);
    } finally {
      setIsTestingAI(false);
    }
  };

  const debugDrawingIntentionHandler = async () => {
    if (!canvasRef.current) {
      Alert.alert('Error', 'Canvas not available');
      return;
    }
    setIsTestingAI(true);
    console.log('🎯 Debugging AI Drawing Intention...');

    try {
      const base64Image = await canvasRef.current.exportCanvas();
      if (!base64Image) throw new Error('Failed to export canvas');

      const intention = await debugDrawingIntention(base64Image);
      console.log('🎯 AI Drawing Intention:', intention);
      Alert.alert('AI Drawing Intention', intention, [{ text: 'OK' }]);
    } catch (error) {
      console.error('❌ AI Drawing Intention Debug Failed:', error);
      Alert.alert('Intention Debug Failed', error instanceof Error ? error.message : 'Unknown error', [{ text: 'OK' }]);
    } finally {
      setIsTestingAI(false);
    }
  };

  const testCoordinatesHandler = async () => {
    if (!canvasRef.current) {
      Alert.alert('Error', 'Canvas not available');
      return;
    }
    setIsTestingAI(true);
    console.log('📏 Testing Coordinate Understanding...');

    try {
      const commands = await testCoordinates();
      console.log('✅ Successfully parsed AI commands:', commands);

      // Validate all commands have valid coordinates
      const hasInvalidCommands = commands.some(
        cmd => isNaN(cmd.x) || isNaN(cmd.y) || 
              cmd.x < 0 || cmd.x > 1000 || 
              cmd.y < 0 || cmd.y > 1000
      );

      if (hasInvalidCommands) {
        throw new Error('Some commands have invalid coordinates');
      }

      // Use our addAIPath method to render the commands
      canvasRef.current.addAIPath(commands);

      Alert.alert('Coordinate Test Complete', `✅ AI generated ${commands.length} commands to draw a circle.\n\nCheck the canvas to verify the circle position and shape.`, [{ text: 'OK' }]);
    } catch (error) {
      console.error('❌ Coordinate Test Failed:', error);
      Alert.alert('Test Failed', error instanceof Error ? error.message : 'Unknown error occurred', [{ text: 'OK' }]);
    } finally {
      setIsTestingAI(false);
    }
  };

  const addDebugGrid = () => {
    if (canvasRef.current) {
      canvasRef.current.addDebugGrid();
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

      {/* AI Test and Debug Buttons */}
      <View style={styles.aiTestContainer}>
        <View style={styles.buttonRow}>
          <TouchableOpacity 
            style={[styles.debugButton]} 
            onPress={debugAIVisionHandler}
            disabled={isTestingAI}
          >
            <Text style={styles.debugButtonText}>
              🔍 Vision
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.intentionButton]} 
            onPress={debugDrawingIntentionHandler}
            disabled={isTestingAI}
          >
            <Text style={styles.intentionButtonText}>
              🎯 Intent
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.coordButton]} 
            onPress={testCoordinatesHandler}
            disabled={isTestingAI}
          >
            <Text style={styles.coordButtonText}>
              📏 Test
            </Text>
          </TouchableOpacity>
          
          <TouchableOpacity 
            style={[styles.gridButton]} 
            onPress={addDebugGrid}
          >
            <Text style={styles.gridButtonText}>
              📐 Grid
            </Text>
          </TouchableOpacity>

          <TouchableOpacity 
            style={[styles.aiTestButton, isTestingAI && styles.aiTestButtonDisabled]} 
            onPress={proceedWithAPICallHandler}
            disabled={isTestingAI}
          >
            <Text style={styles.aiTestButtonText}>
              {isTestingAI ? '🧪 Test' : '🤖 AI'}
            </Text>
          </TouchableOpacity>
        </View>
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
  },
  buttonRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    gap: 10,
  },
  debugButton: {
    backgroundColor: '#007AFF',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 0.8,
    alignItems: 'center',
  },
  debugButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  intentionButton: {
    backgroundColor: '#ff6b35',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 1,
    alignItems: 'center',
  },
  intentionButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  coordButton: {
    backgroundColor: '#e83e8c',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 0.8,
    alignItems: 'center',
  },
  coordButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  gridButton: {
    backgroundColor: '#6f42c1',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 0.6,
    alignItems: 'center',
  },
  gridButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  aiTestButton: {
    backgroundColor: '#28a745',
    paddingHorizontal: 15,
    paddingVertical: 10,
    borderRadius: 8,
    flex: 0.8,
    alignItems: 'center',
  },
  aiTestButtonDisabled: {
    backgroundColor: '#6c757d',
  },
  aiTestButtonText: {
    color: '#fff',
    fontSize: 14,
    fontWeight: '600',
  },
  canvasContainer: {
    flex: 1,
    backgroundColor: '#ffff',
  },
}); 