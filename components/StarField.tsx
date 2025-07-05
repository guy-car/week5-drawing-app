import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Dimensions } from 'react-native';

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const NUMBER_OF_STARS = 40;

// Generate random star positions
const stars = Array.from({ length: NUMBER_OF_STARS }, () => ({
  left: Math.random() * SCREEN_WIDTH,
  top: Math.random() * SCREEN_HEIGHT,
  size: Math.random() * 2 + 1, // 1-3px
}));

export default function StarField() {
  // Create refs for all star opacities
  const starOpacities = useRef(
    stars.map(() => new Animated.Value(Math.random()))
  ).current;

  useEffect(() => {
    // Animate each star independently
    const animations = starOpacities.map((opacity) => {
      return Animated.loop(
        Animated.sequence([
          Animated.timing(opacity, {
            toValue: Math.random() * 0.5 + 0.5, // Random brightness between 0.5 and 1
            duration: Math.random() * 1000 + 1000, // Random duration between 1-2s
            useNativeDriver: true,
          }),
          Animated.timing(opacity, {
            toValue: Math.random() * 0.3, // Dim to random value between 0-0.3
            duration: Math.random() * 1000 + 1000,
            useNativeDriver: true,
          }),
        ])
      );
    });

    // Start all animations
    animations.forEach(anim => anim.start());

    return () => {
      // Clean up animations on unmount
      animations.forEach(anim => anim.stop());
    };
  }, []);

  return (
    <View style={styles.container} pointerEvents="none">
      {stars.map((star, index) => (
        <Animated.View
          key={index}
          style={[
            styles.star,
            {
              left: star.left,
              top: star.top,
              width: star.size,
              height: star.size,
              opacity: starOpacities[index],
            },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'transparent',
  },
  star: {
    position: 'absolute',
    backgroundColor: 'white',
    borderRadius: 4,
  },
}); 