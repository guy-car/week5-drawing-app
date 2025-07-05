import React, { useRef, useEffect } from 'react';
import { 
  View, 
  StyleSheet, 
  Animated, 
  TouchableOpacity,
  ScrollView,
  Dimensions
} from 'react-native';
import StarField from './StarField';
import CustomText from './CustomText';
import GlowButton from './GlowButton';

const { height: SCREEN_HEIGHT } = Dimensions.get('window');

const INTRO_TEXT = `Entities have made contact with Fractal Tech.

We know little about their intentions. 
Their visual language is a mystery.

Yet communication attempts have shown they respond 
to typical human shapes.

Your device has been selected for the experimental contact protocol. 

Draw something. Use colors, change pencil width and press the transmission button at the top.

Report all your findings to the Tech Hub.`;

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
            <CustomText fontFamily="Exo2-MediumItalic" style={styles.title}>DRAW BEYOND</CustomText>
            <CustomText fontFamily="Exo2-Light" style={styles.text}>{INTRO_TEXT}</CustomText>
            <View style={styles.spacer} />
          </View>
        </ScrollView>
      </View>

      {/* Button section */}
      <View style={styles.buttonSection}>
        <Animated.View style={{
          opacity: startGlowAnim.interpolate({
            inputRange: [0.3, 1],
            outputRange: [0.7, 1]
          })
        }}>
          <GlowButton
            style={styles.startButton}
            glowLevel="high"
            onPress={handleStart}
          >
            <CustomText fontFamily="Exo2-Medium" style={styles.startText}>BEGIN TRANSMISSION</CustomText>
          </GlowButton>
        </Animated.View>
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
    paddingTop: SCREEN_HEIGHT - 240,
    paddingHorizontal: 40,
    paddingBottom: 20,
  },
  title: {
    color: 'white',
    fontSize: 32,
    textAlign: 'center',
    marginBottom: 40,
  },
  text: {
    color: 'white',
    fontSize: 20,
    lineHeight: 28,
    textAlign: 'center',
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
  },
  startText: {
    color: 'white',
    fontSize: 24,
    textAlign: 'center',
  },
}); 