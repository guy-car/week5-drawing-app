import React from 'react';
import { Text as RNText, TextProps, StyleSheet } from 'react-native';

interface CustomTextProps extends TextProps {
  fontFamily?: 'Exo2-Light' | 'Exo2-Regular' | 'Exo2-Medium' | 'Exo2-MediumItalic';
}

const CustomText: React.FC<CustomTextProps> = ({ 
  style, 
  fontFamily = 'Exo2-Regular', 
  ...props 
}) => {
  return (
    <RNText 
      style={[
        { fontFamily }, 
        style
      ]} 
      {...props} 
    />
  );
};

export default CustomText; 