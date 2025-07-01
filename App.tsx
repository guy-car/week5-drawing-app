import React, { useState, useRef } from 'react';
import { StyleSheet, View, Text, TouchableOpacity, Dimensions, Alert } from 'react-native';
import { StatusBar } from 'expo-status-bar';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import DrawingCanvas from './components/DrawingCanvas';

const { width: screenWidth, height: screenHeight } = Dimensions.get('window');

const OPENAI_API_KEY = process.env.EXPO_PUBLIC_OPENAI_API_KEY;

// Define the ref type to match DrawingCanvas
interface DrawingCanvasRef {
  clear: () => void;
  handleZoom: (increment: boolean) => void;
  exportCanvas: () => Promise<string | null>;
  addAIPath: (commands: any[]) => void;
}

export default function App() {
  const [mode, setMode] = useState<'draw' | 'pan'>('draw');
  const [zoom, setZoom] = useState(1);
  const [isTestingAI, setIsTestingAI] = useState(false);
  const canvasRef = useRef<DrawingCanvasRef>(null);

  const handleClear = () => {
    if (canvasRef.current) {
      canvasRef.current.clear();
    }
  };

  const handleZoom = (increment: boolean) => {
    if (canvasRef.current) {
      canvasRef.current.handleZoom(increment);
    }
  };

  const toggleMode = () => {
    setMode(mode === 'draw' ? 'pan' : 'draw');
  };

  const testAIIntegration = async () => {
    if (!canvasRef.current) {
      Alert.alert('Error', 'Canvas not available');
      return;
    }

    // Check if API key is available
    if (!OPENAI_API_KEY) {
      Alert.alert(
        'API Key Missing', 
        'OpenAI API key not found. Please add your API key to the .env file:\nEXPO_PUBLIC_OPENAI_API_KEY=your-key-here',
        [{ text: 'OK' }]
      );
      return;
    }

    // 🚨 SECURITY WARNING for development
    Alert.alert(
      '🚨 Development Mode Warning',
      'This is for DEVELOPMENT ONLY!\n\n⚠️ Your OpenAI API key will be visible in:\n• Network requests\n• App bundle\n• Developer tools\n\nNever distribute this build!',
      [
        { text: 'Cancel', style: 'cancel' },
        { 
          text: 'Continue (Dev Only)', 
          style: 'destructive',
          onPress: () => proceedWithAPICall()
        }
      ]
    );
  };

  const proceedWithAPICall = async () => {
    setIsTestingAI(true);
    console.log('🧪 Starting AI integration test...');
    console.log('🔑 Using API key:', OPENAI_API_KEY?.substring(0, 10) + '...');

    try {
      // Step 1: Export canvas as base64 image
      console.log('📸 Exporting canvas...');
      const base64Image = await canvasRef.current?.exportCanvas();
      
      if (!base64Image) {
        throw new Error('Failed to export canvas image');
      }

      console.log('✅ Canvas exported successfully');

      // Step 2: Send to OpenAI Vision API
      console.log('🤖 Sending to OpenAI Vision API...');
      
      const response = await fetch('https://api.openai.com/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${OPENAI_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'gpt-4o',
          messages: [
            {
              role: 'user',
              content: [
                {
                  type: 'text',
                  text: 'Looking at this drawing, add ONE continuous line/shape that complements what\'s already drawn. Respond with ONLY a JSON array of commands in this exact format: [{"type": "moveTo", "x": number, "y": number}, {"type": "lineTo", "x": number, "y": number}, ...]. The response should be ONLY the JSON array, no other text.'
                },
                {
                  type: 'image_url',
                  image_url: {
                    url: base64Image
                  }
                }
              ]
            }
          ],
          max_tokens: 1000
        })
      });

      if (!response.ok) {
        const errorData = await response.text();
        console.error('❌ OpenAI API Error:', response.status, errorData);
        
        if (response.status === 401) {
          throw new Error('Invalid API key. Please check your EXPO_PUBLIC_OPENAI_API_KEY in .env file.');
        } else if (response.status === 429) {
          throw new Error('Rate limit exceeded. Please try again later.');
        } else {
          throw new Error(`OpenAI API error (${response.status}): ${errorData}`);
        }
      }

      const data = await response.json();
      console.log('🎉 OpenAI API Response:', JSON.stringify(data, null, 2));

      if (data.choices && data.choices[0] && data.choices[0].message) {
        let aiResponse = data.choices[0].message.content;
        console.log('🤖 AI Generated Commands:', aiResponse);
        
        try {
          // Remove backticks and parse the JSON
          aiResponse = aiResponse.replace(/```json|```/g, '').trim();
          const commands = JSON.parse(aiResponse);
          
          if (Array.isArray(commands)) {
            console.log('✅ Successfully parsed AI commands:', commands);
            
            // Use our addAIPath method to render the commands
            canvasRef.current?.addAIPath(commands);
            
            Alert.alert(
              'AI Test Success!', 
              `✅ Canvas exported and AI commands rendered!\n\nAI added ${commands.length} drawing commands.\n\nCheck console for full response.`,
              [{ text: 'OK' }]
            );
          } else {
            throw new Error('AI response is not an array of commands');
          }
        } catch (parseError) {
          console.error('⚠️ Failed to parse AI response:', parseError);
          console.log('Raw AI response:', aiResponse);
          Alert.alert(
            'AI Response Error', 
            'The AI response was not in the expected format. Check console for details.',
            [{ text: 'OK' }]
          );
        }
      } else {
        throw new Error('Unexpected API response format');
      }

    } catch (error) {
      console.error('❌ AI Integration Test Failed:', error);
      Alert.alert(
        'AI Test Failed', 
        error instanceof Error ? error.message : 'Unknown error occurred',
        [{ text: 'OK' }]
      );
    } finally {
      setIsTestingAI(false);
    }
  };

  return (
    <GestureHandlerRootView style={styles.container}>
      <StatusBar style="auto" />
      
      {/* Header Controls */}
      <View style={styles.header}>
        <View style={styles.leftControls}>
          <TouchableOpacity 
            style={[styles.button, mode === 'draw' && styles.activeButton]} 
            onPress={toggleMode}
          >
            <Text style={[styles.buttonText, mode === 'draw' && styles.activeButtonText]}>
              {mode === 'draw' ? 'Draw' : 'Move'}
            </Text>
          </TouchableOpacity>
        </View>

        <View style={styles.zoomControls}>
          <TouchableOpacity 
            style={[styles.zoomButton, styles.marginLeft]} 
            onPress={() => handleZoom(false)}
          >
            <Text style={styles.zoomButtonText}>-</Text>
          </TouchableOpacity>
          <Text style={styles.zoomText}>{zoom.toFixed(1)}x</Text>
          <TouchableOpacity 
            style={styles.zoomButton} 
            onPress={() => handleZoom(true)}
          >
            <Text style={styles.zoomButtonText}>+</Text>
          </TouchableOpacity>
        </View>

        <View style={styles.rightControls}>
          <TouchableOpacity style={styles.clearButton} onPress={handleClear}>
            <Text style={styles.clearButtonText}>Clear</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* AI Test Button */}
      <View style={styles.aiTestContainer}>
        <TouchableOpacity 
          style={[styles.aiTestButton, isTestingAI && styles.aiTestButtonDisabled]} 
          onPress={testAIIntegration}
          disabled={isTestingAI}
        >
          <Text style={styles.aiTestButtonText}>
            {isTestingAI ? '🧪 Testing AI...' : '🤖 Test AI Integration'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Canvas */}
      <View style={styles.canvasContainer}>
        <DrawingCanvas
          ref={canvasRef}
          mode={mode}
          onZoomChange={setZoom}
          screenWidth={screenWidth}
          screenHeight={screenHeight - 160} // Account for header + AI button
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
  leftControls: {
    flex: 1,
  },
  rightControls: {
    flex: 1,
    alignItems: 'flex-end',
  },
  zoomControls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    flex: 1,
  },
  button: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#e0e0e0',
    alignSelf: 'flex-start',
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
  zoomButton: {
    width: 30,
    height: 30,
    backgroundColor: '#007AFF',
    borderRadius: 15,
    justifyContent: 'center',
    alignItems: 'center',
  },
  marginLeft: {
    marginLeft: 15,
  },
  zoomButtonText: {
    color: '#fff',
    fontSize: 20,
    fontWeight: 'bold',
  },
  zoomText: {
    fontSize: 16,
    fontWeight: '600',
    color: '#333',
    minWidth: 50,
    textAlign: 'center',
    marginHorizontal: 10,
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
  aiTestContainer: {
    backgroundColor: '#fff',
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#e0e0e0',
  },
  aiTestButton: {
    backgroundColor: '#28a745',
    paddingHorizontal: 20,
    paddingVertical: 12,
    borderRadius: 8,
    alignItems: 'center',
  },
  aiTestButtonDisabled: {
    backgroundColor: '#6c757d',
  },
  aiTestButtonText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '600',
  },
  canvasContainer: {
    flex: 1,
    backgroundColor: '#ffff',
  },
}); 