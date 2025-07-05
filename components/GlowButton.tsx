import React from 'react';
import { TouchableOpacity, StyleSheet, ViewStyle, StyleProp } from 'react-native';

interface GlowButtonProps {
  style?: StyleProp<ViewStyle>;
  glowLevel?: 'none' | 'low' | 'medium' | 'high';
  glowColor?: string;
  onPress?: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}

const GlowButton: React.FC<GlowButtonProps> = ({
  style,
  glowLevel = 'medium',
  glowColor = 'rgba(255, 255, 255, 0.4)',
  onPress,
  disabled = false,
  children
}) => {
  const getGlowStyle = () => {
    if (glowLevel === 'none' || disabled) return {};
    
    const baseColor = glowColor;
    const mediumColor = glowColor.replace('0.4', '0.3');
    const lightColor = glowColor.replace('0.4', '0.2');
    
    switch (glowLevel) {
      case 'low':
        return {
          boxShadow: `0 0 5px ${baseColor}`
        };
      case 'medium':
        return {
          boxShadow: `
            0 0 10px ${baseColor},
            0 0 20px ${mediumColor}
          `
        };
      case 'high':
        return {
          boxShadow: `
            0 0 15px ${baseColor},
            0 0 25px ${mediumColor},
            0 0 40px ${lightColor}
          `
        };
      default:
        return {};
    }
  };

  return (
    <TouchableOpacity
      style={[
        styles.button,
        getGlowStyle(),
        style,
        disabled && styles.disabled
      ]}
      onPress={onPress}
      disabled={disabled}
    >
      {children}
    </TouchableOpacity>
  );
};

const styles = StyleSheet.create({
  button: {
    borderRadius: 8,
    alignItems: 'center',
    justifyContent: 'center',
  },
  disabled: {
    opacity: 0.5,
  },
});

export default GlowButton; 