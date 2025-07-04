import React, { useState } from 'react';
import { View, TouchableOpacity, StyleSheet, Modal } from 'react-native';
import ColorPicker from 'react-native-wheel-color-picker';

interface BottomToolbarProps {
  color: string;
  onColorChange: (color: string) => void;
}

const BottomToolbar: React.FC<BottomToolbarProps> = ({ color, onColorChange }) => {
  const [showColorPicker, setShowColorPicker] = useState(false);

  return (
    <View style={styles.container}>
      <TouchableOpacity
        style={[styles.colorButton, { backgroundColor: color }]}
        onPress={() => setShowColorPicker(true)}
      />

      <Modal
        visible={showColorPicker}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowColorPicker(false)}
      >
        <View style={styles.modalContainer}>
          <View style={styles.pickerContainer}>
            <ColorPicker
              color={color}
              onColorChange={onColorChange}
              thumbSize={40}
              sliderSize={40}
              noSnap={true}
              row={false}
            />
            <TouchableOpacity
              style={styles.doneButton}
              onPress={() => setShowColorPicker(false)}
            >
              <View style={styles.doneButtonInner}>
                <View style={[styles.colorPreview, { backgroundColor: color }]} />
                <View style={styles.doneTextContainer}>
                  <View style={styles.doneText} />
                </View>
              </View>
            </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
};

const styles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
  },
  colorButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: '#e0e0e0',
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
    width: '80%',
    maxWidth: 400,
  },
  doneButton: {
    marginTop: 20,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#f0f0f0',
    overflow: 'hidden',
  },
  doneButtonInner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 15,
  },
  colorPreview: {
    width: 30,
    height: 30,
    borderRadius: 15,
    borderWidth: 1,
    borderColor: '#e0e0e0',
  },
  doneTextContainer: {
    flex: 1,
    alignItems: 'center',
  },
  doneText: {
    width: 20,
    height: 20,
    borderRadius: 2,
    borderColor: '#666',
    borderWidth: 2,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    transform: [{ rotate: '45deg' }, { translateX: -3 }],
  },
});

export default BottomToolbar; 