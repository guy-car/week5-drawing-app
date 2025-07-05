import React, { useState, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Modal, Alert } from 'react-native';
import ColorPicker from 'react-native-wheel-color-picker';
import { Palette, Eraser, PencilCircle, DownloadSimple } from 'phosphor-react-native';
import Slider from '@react-native-community/slider';
import GlowButton from './GlowButton';
import * as MediaLibrary from 'expo-media-library';
import * as FileSystem from 'expo-file-system';

interface BottomToolbarProps {
  color: string;
  onColorChange: (color: string) => void;
  backgroundColor?: string;
  onToolChange?: (tool: 'draw' | 'erase') => void;
  onStrokeWidthChange?: (width: number) => void;
  defaultStrokeWidth?: number;
  canErase?: boolean;
  canvasRef?: any;
  canvasEmpty?: boolean;
}

const ERASER_WIDTH = 48;
const DEFAULT_DRAW_WIDTH = 2;
const MIN_WIDTH = 2;
const MAX_WIDTH = 48;

const BottomToolbar: React.FC<BottomToolbarProps> = ({ 
  color, 
  onColorChange,
  backgroundColor = "#E6F3FF",
  onToolChange,
  onStrokeWidthChange,
  defaultStrokeWidth = DEFAULT_DRAW_WIDTH,
  canErase = false,
  canvasRef,
  canvasEmpty = true,
}) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  const [showWidthPicker, setShowWidthPicker] = useState(false);
  const [activeTool, setActiveTool] = useState<'draw' | 'erase'>('draw');
  const [currentWidth, setCurrentWidth] = useState(defaultStrokeWidth);
  const lastDrawWidth = useRef(defaultStrokeWidth);
  
  const handleToolChange = (newTool: 'draw' | 'erase') => {
    const nextTool = activeTool === newTool ? 'draw' : newTool;
    setActiveTool(nextTool);
    if (onToolChange) onToolChange(nextTool);
    if (nextTool === 'erase') {
      lastDrawWidth.current = currentWidth; // remember current draw width
      if (onStrokeWidthChange) onStrokeWidthChange(ERASER_WIDTH);
    } else {
      setCurrentWidth(lastDrawWidth.current);
      if (onStrokeWidthChange) onStrokeWidthChange(lastDrawWidth.current);
    }
  };

  const handleWidthChange = (width: number) => {
    setCurrentWidth(width);
    lastDrawWidth.current = width;
    if (onStrokeWidthChange) onStrokeWidthChange(width);
  };

  const handleSave = async () => {
    try {
      const { status } = await MediaLibrary.requestPermissionsAsync();
      if (status !== 'granted') {
        Alert.alert('Permission needed', 'Please grant camera roll access to save your drawing');
        return;
      }

      const imageUri = await canvasRef?.current?.exportCanvas();
      if (!imageUri) {
        Alert.alert('Error', 'Failed to export canvas');
        return;
      }

      // Convert base64 to file URI
      const base64Data = imageUri.split(',')[1];
      const fileUri = `${FileSystem.cacheDirectory}drawing-${Date.now()}.png`;
      await FileSystem.writeAsStringAsync(fileUri, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });

      await MediaLibrary.saveToLibraryAsync(fileUri);
      await FileSystem.deleteAsync(fileUri); // Clean up temp file
      Alert.alert('Success', 'Drawing saved to camera roll');
    } catch (error) {
      console.error('Save error:', error);
      Alert.alert('Error', 'Failed to save drawing');
    }
  };

  return (
    <View style={styles.container}>
      {/* Eraser Button */}
      <GlowButton
        style={[
          styles.toolButton,
          (!canErase || activeTool === 'erase') && styles.disabledButton,
          (canErase && activeTool !== 'erase') && styles.activeButton
        ]}
        glowLevel={(canErase && activeTool !== 'erase') ? 'medium' : 'none'}
        glowColor="rgba(255, 255, 255, 0.4)"
        onPress={() => handleToolChange('erase')}
        disabled={!canErase}
      >
        <Eraser 
          color={(!canErase || activeTool === 'erase') ? "#666666" : "#FFFFFF"}
          size={28} 
        />
      </GlowButton>

      {/* Color Picker Button */}
      <GlowButton
        style={[
          styles.toolButton,
          styles.activeButton
        ]}
        glowLevel="medium"
        glowColor={`${color}80`}
        onPress={() => {
          if (activeTool === 'erase') {
            handleToolChange('draw');
          }
          setShowColorPicker(true);
          setShowWidthPicker(false);
        }}
      >
        <Palette color={color} size={28} />
      </GlowButton>

      {/* Pencil Width Button */}
      <GlowButton
        style={[styles.toolButton, styles.activeButton]}
        glowLevel="medium"
        glowColor={`${color}80`}
        onPress={() => {
          if (activeTool === 'erase') {
            handleToolChange('draw');
          }
          setShowWidthPicker(true);
          setShowColorPicker(false);
        }}
      >
        <PencilCircle color={color} size={28} />
      </GlowButton>

      {/* Download Button */}
      <GlowButton
        style={[
          styles.toolButton,
          !canvasEmpty && styles.activeButton,
          canvasEmpty && styles.disabledButton
        ]}
        glowLevel={!canvasEmpty ? 'medium' : 'none'}
        glowColor="rgba(255, 255, 255, 0.4)"
        onPress={handleSave}
        disabled={canvasEmpty}
      >
        <DownloadSimple 
          color={!canvasEmpty ? "#FFFFFF" : "#666666"}
          size={28} 
        />
      </GlowButton>

      {/* Color Picker Modal */}
      <Modal
        visible={showColorPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowColorPicker(false)}
      >
        <TouchableOpacity 
          style={styles.modalContainer} 
          activeOpacity={1} 
          onPress={() => setShowColorPicker(false)}
        >
          <TouchableOpacity 
            activeOpacity={1} 
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.pickerContainer}>
              <ColorPicker
                color={color}
                onColorChange={onColorChange}
                thumbSize={40}
                sliderSize={40}
                noSnap={false}
                row={false}
                swatchesLast={true}
                swatches={true}
                discrete={false}
                sliderHidden={true}
                autoResetSlider={true}
                gapSize={30}
              />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Width Picker Modal */}
      <Modal
        visible={showWidthPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowWidthPicker(false)}
      >
        <TouchableOpacity 
          style={styles.widthModalContainer} 
          activeOpacity={1} 
          onPress={() => setShowWidthPicker(false)}
        >
          <TouchableOpacity 
            activeOpacity={1} 
            onPress={(e) => e.stopPropagation()}
          >
            <View style={styles.widthPickerContainer}>
              {/* Width Preview Circle */}
              <View style={styles.previewContainer}>
                <View 
                  style={[
                    styles.previewCircle,
                    { 
                      width: currentWidth,
                      height: currentWidth,
                      borderRadius: currentWidth / 2,
                      backgroundColor: color
                    }
                  ]} 
                />
              </View>
              
              {/* Width Slider */}
              <Slider
                style={styles.widthSlider}
                minimumValue={MIN_WIDTH}
                maximumValue={MAX_WIDTH}
                value={currentWidth}
                onValueChange={handleWidthChange}
                minimumTrackTintColor="#000000"
                maximumTrackTintColor="#000000"
              />
            </View>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-evenly',
    height: 60,
  },
  toolButton: {
    width: 60,
    height: 60,
    borderRadius: 8,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeButton: {
    backgroundColor: '#000000',
  },
  inactiveButton: {
    backgroundColor: '#e0e0e0',
  },
  disabledButton: {
    backgroundColor: '#e0e0e0',
    opacity: 0.5,
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  widthModalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'flex-end',
    alignItems: 'center',
    paddingBottom: 100,
  },
  pickerContainer: {
    backgroundColor: 'transparent',
    padding: 20,
    borderRadius: 10,
    width: 400,
    maxWidth: '100%',
  },
  widthPickerContainer: {
    backgroundColor: '#e0e0e0',
    padding: 20,
    borderRadius: 10,
    width: 300,
    alignItems: 'center',
  },
  previewContainer: {
    height: 35,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 20,
  },
  previewCircle: {
    backgroundColor: '#000000',
  },
  widthSlider: {
    width: '100%',
    height: 40,
  },
});

export default BottomToolbar; 