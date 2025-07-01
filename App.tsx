import React, { useState, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import DrawingCanvas from './components/DrawingCanvas';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

export default function App() {
  const [mode, setMode] = useState<'draw' | 'pan'>('draw');
  const [zoom, setZoom] = useState(1);
  const canvasRef = useRef<any>(null);

  const handleClear = () => {
    if (canvasRef.current) {
      canvasRef.current.clear();
    }
  };

  const toggleMode = () => {
    setMode(mode === 'draw' ? 'pan' : 'draw');
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar style="auto" />
      
      {/* Header Controls */}
      <View style={styles.header}>
        <TouchableOpacity 
          style={[styles.button, mode === 'draw' && styles.activeButton]} 
          onPress={toggleMode}
        >
          <Text style={[styles.buttonText, mode === 'draw' && styles.activeButtonText]}>
            {mode === 'draw' ? 'Draw Mode' : 'Pan & Zoom Mode'}
          </Text>
        </TouchableOpacity>
        
        <Text style={styles.zoomText}>Zoom: {zoom.toFixed(1)}x</Text>
        
        <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
          <Text style={styles.clearButtonText}>Clear</Text>
        </TouchableOpacity>
      </View>

      {/* Canvas */}
      <View style={styles.canvasContainer}>
        <DrawingCanvas
          ref={canvasRef}
          mode={mode}
          onZoomChange={setZoom}
          screenWidth={screenWidth}
          screenHeight={screenHeight - 100} // Account for header
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
  button: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#e0e0e0',
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
  zoomText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
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
  canvasContainer: {
    flex: 1,
    backgroundColor: '#fff',
  },
}); 