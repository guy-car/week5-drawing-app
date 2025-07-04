import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import ColorPicker from 'react-native-wheel-color-picker';
import { Palette, Eraser, PencilCircle, DownloadSimple } from 'phosphor-react-native';

interface BottomToolbarProps {
  color: string;
  onColorChange: (color: string) => void;
}

const BottomToolbar: React.FC<BottomToolbarProps> = ({ color, onColorChange }) => {
  const [showColorPicker, setShowColorPicker] = useState(false);
  
  return (
    <View style={styles.container}>
      {/* Eraser Button */}
      <TouchableOpacity
        style={[styles.toolButton, styles.inactiveButton]}
        onPress={() => {}}
      >
        <Eraser color="#000000" size={28} />
      </TouchableOpacity>

      {/* Color Picker Button */}
      <TouchableOpacity
        style={[styles.toolButton, styles.inactiveButton]}
        onPress={() => setShowColorPicker(true)}
      >
        <Palette color={color} size={28} />
      </TouchableOpacity>

      {/* Pencil Button */}
      <TouchableOpacity
        style={[styles.toolButton, styles.inactiveButton]}
        onPress={() => {}}
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
    backgroundColor: 'white',
    padding: 20,
    borderRadius: 10,
    width: 300,
    maxWidth: '90%',
  },
});

export default BottomToolbar; 