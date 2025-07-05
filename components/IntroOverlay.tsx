import React, { useRef, useEffect } from 'react';
import { 
  View, 
  Text, 
  StyleSheet, 
  Animated, 
  TouchableOpacity,
  ScrollView,
  Dimensions
} from 'react-native';
import StarField from './StarField';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const INTRO_TEXT = `Three days ago, Fractal Tech detected an unknown signal originating from beyond our solar system.

The transmission contained no audio, no text, no recognizable data patterns. Only visual elements—strange drawings that seem to respond to our own.

Our xenolinguistics team believes these entities communicate exclusively through visual art. They appear to be studying us, learning our patterns, reacting to our sketches with drawings of their own.

We don't know what they want. We don't know what their symbols mean. We don't know if they're friendly.

But they're waiting.

Your device has been selected for the experimental two-way visual communication protocol. Draw something. Anything. See how they respond.

Remember: Every mark you make is being transmitted across the void to an intelligence we cannot comprehend.

What will you show them about humanity?`;

interface Props {
  onComplete: () => void;
}

export default function IntroOverlay({ onComplete }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const startGlowAnim = useRef(new Animated.Value(0)).current;
  const scrollAnim = useRef(new Animated.Value(0)).current;
  
  // Auto-scroll animation
  useEffect(() => {
    const timeout = setTimeout(() => {
      Animated.timing(scrollAnim, {
        toValue: SCREEN_HEIGHT * 2,
        duration: 40000, // 40 seconds
        useNativeDriver: true,
      }).start();
    }, 1000);

    return () => clearTimeout(timeout);
  }, []);

  // Listen to scroll animation value
  useEffect(() => {
    scrollAnim.addListener(({ value }) => {
      scrollViewRef.current?.scrollTo({ y: value, animated: false });
    });

    return () => {
      scrollAnim.removeAllListeners();
    };
  }, []);

  // Start button glow animation
  useEffect(() => {
    Animated.loop(
      Animated.sequence([
        Animated.timing(startGlowAnim, {
          toValue: 1,
          duration: 1500,
          useNativeDriver: true,
        }),
        Animated.timing(startGlowAnim, {
          toValue: 0.3,
          duration: 1500,
          useNativeDriver: true,
        }),
      ])
    ).start();
  }, []);

  // Fade in animation
  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start();
  }, []);

  const handleStart = () => {
    Animated.timing(fadeAnim, {
      toValue: 0,
      duration: 800,
      useNativeDriver: true,
    }).start(onComplete);
  };

  return (
    <Animated.View style={[styles.container, { opacity: fadeAnim }]}>
      <StarField />
      
      {/* Main content area */}
      <View style={styles.mainSection}>
        <ScrollView 
          ref={scrollViewRef}
          style={styles.scrollView}
          showsVerticalScrollIndicator={false}
          scrollEventThrottle={16}
          onScrollBeginDrag={() => {
            // Stop auto-scroll when user touches
            scrollAnim.stopAnimation();
          }}
        >
          <View style={styles.content}>
            <Text style={styles.title}>Draw Beyond</Text>
            <Text style={styles.text}>{INTRO_TEXT}</Text>
            <View style={styles.spacer} />
          </View>
        </ScrollView>
      </View>

      {/* Button section */}
      <View style={styles.buttonSection}>
        <TouchableOpacity onPress={handleStart}>
          <Animated.View style={[
            styles.startButton,
            {
              opacity: startGlowAnim.interpolate({
                inputRange: [0.3, 1],
                outputRange: [0.7, 1]
              })
            }
          ]}>
            <Text style={styles.startText}>[START]</Text>
          </Animated.View>
        </TouchableOpacity>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  container: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.97)',
    display: 'flex',
    flexDirection: 'column',
    zIndex: 1000,
  },
  mainSection: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    paddingTop: SCREEN_HEIGHT - 280,
    paddingHorizontal: 40,
    paddingBottom: 20,
  },
  title: {
    color: 'white',
    fontSize: 32,
    textAlign: 'center',
    fontFamily: 'Exo2-Medium',
    fontStyle: 'italic',
    marginBottom: 40,
  },
  text: {
    color: 'white',
    fontSize: 18,
    lineHeight: 28,
    textAlign: 'center',
    fontFamily: 'Exo2-Light',
  },
  spacer: {
    height: SCREEN_HEIGHT,
  },
  buttonSection: {
    height: 200,
    justifyContent: 'center',
    alignItems: 'center',
    paddingBottom: 40,
  },
  startButton: {
    padding: 15,
    borderRadius: 8,
    boxShadow: `
      0 0 10px rgba(255, 255, 255, 0.4),
      0 0 20px rgba(255, 255, 255, 0.3),
      0 0 30px rgba(255, 255, 255, 0.2)
    `,
  },
  startText: {
    color: 'white',
    fontSize: 24,
    fontFamily: 'Exo2-Regular',
    textAlign: 'center',
  },
}); 