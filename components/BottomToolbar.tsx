import React, { useState, useRef } from 'react';
import { View, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import ColorPicker from 'react-native-wheel-color-picker';
import { Palette, Eraser, PencilCircle, DownloadSimple } from 'phosphor-react-native';
import Slider from '@react-native-community/slider';

interface BottomToolbarProps {
  color: string;
  onColorChange: (color: string) => void;
  backgroundColor?: string;
  onToolChange?: (tool: 'draw' | 'erase') => void;
  onStrokeWidthChange?: (width: number) => void;
  defaultStrokeWidth?: number;
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
  defaultStrokeWidth = DEFAULT_DRAW_WIDTH
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
  
  return (
    <View style={styles.container}>
      {/* Eraser Button */}
      <TouchableOpacity
        style={[
          styles.toolButton,
          activeTool === 'erase' ? styles.activeButton : styles.inactiveButton
        ]}
        onPress={() => handleToolChange('erase')}
      >
        <Eraser 
          color={activeTool === 'erase' ? "#FFFFFF" : "#000000"} 
          size={28} 
        />
      </TouchableOpacity>

      {/* Color Picker Button */}
      <TouchableOpacity
        style={[
          styles.toolButton,
          styles.inactiveButton
        ]}
        onPress={() => {
          if (activeTool === 'erase') {
            handleToolChange('draw');
          }
          setShowColorPicker(true);
          setShowWidthPicker(false);
        }}
      >
        <Palette color={color} size={28} />
      </TouchableOpacity>

      {/* Pencil Width Button */}
      <TouchableOpacity
        style={[styles.toolButton, styles.inactiveButton]}
        onPress={() => {
          if (activeTool === 'erase') {
            handleToolChange('draw');
          }
          setShowWidthPicker(true);
          setShowColorPicker(false);
        }}
      >
        <PencilCircle color="#000000" size={28} />
      </TouchableOpacity>

      {/* Download Button */}
      <TouchableOpacity
        style={[styles.toolButton, styles.inactiveButton]}
        onPress={() => {}}
      >
        <DownloadSimple color="#000000" size={28} />
      </TouchableOpacity>

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
          style={styles.modalContainer} 
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
                      borderRadius: currentWidth / 2
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
    borderRadius: 30,
    justifyContent: 'center',
    alignItems: 'center',
  },
  activeButton: {
    backgroundColor: '#000000',
  },
  inactiveButton: {
    backgroundColor: '#e0e0e0',
  },
  modalContainer: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  pickerContainer: {
    backgroundColor: 'transparent',
    padding: 20,
    borderRadius: 10,
    width: 400,
    maxWidth: '100%',
  },
  widthPickerContainer: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    borderRadius: 10,
    width: 300,
    alignItems: 'center',
  },
  previewContainer: {
    height: 60,
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