# Drawing Commands Context Implementation - January 2, 2025

## Overall Goal

Implement a feature that captures user drawing commands as they draw and provides both the canvas image and the actual Skia drawing commands to the AI. This will allow the AI to understand not just what the drawing looks like, but exactly how it was constructed, enabling it to generate better matching commands for new additions.

## Actions to Achieve Goal

### 1. Capture User Drawing Commands During Drawing
**Files to alter:** `components/DrawingCanvas.tsx`
- Add state to track user drawing commands: `const [userCommands, setUserCommands] = useState<DrawingCommand[]>([])`
- Modify `onTouchStart` handler to capture `moveTo` commands when user starts drawing
- Modify `onTouchMove` handler to capture `lineTo` commands as user continues drawing  
- Update `clear` function to also reset `userCommands` state
- Add proper coordinate rounding to match validation expectations

### 2. Enhanced Canvas Export Function
**Files to alter:** `components/DrawingCanvas.tsx`
- Create new function `exportCanvasWithCommands()` that returns both image and commands
- Update the interface `DrawingCanvasRef` to include the new export function
- Maintain backward compatibility with existing `exportCanvas()` function

### 3. Update AI API Interface to Accept Commands
**Files to alter:** `src/api/openai/proceedWithAPICall.ts`
- Create new function `analyzeThenDrawWithContext(base64Image: string, existingCommands: DrawingCommand[])`
- Modify Step 1 prompt to include command context analysis
- Modify Step 2 prompt to reference existing command patterns for generating new commands
- Keep existing `analyzeThenDraw` function for fallback/comparison

### 4. Update AI Function Exports
**Files to alter:** `src/api/openai/index.ts`
- Export the new `analyzeThenDrawWithContext` function
- Ensure all existing exports remain intact

### 5. Update App to Use New Context-Aware Function
**Files to alter:** `App.tsx`
- Import the new `analyzeThenDrawWithContext` function
- Modify `proceedWithAPICallHandler` to use `exportCanvasWithCommands()` instead of `exportCanvas()`
- Update the API call to pass both image and commands to the new function
- Add console logging to show command count being sent to AI

### 6. Add Drawing Command Types (if needed)
**Files to alter:** `src/api/openai/types.ts`
- Verify that `DrawingCommand` types support all necessary command types (`moveTo`, `lineTo`, `quadTo`, `cubicTo`, `addCircle`)
- Add any missing type definitions if needed

### 7. Test and Debug
**Files to alter:** `components/DrawingCanvas.tsx`, `App.tsx`
- Add debug logging to show commands being captured during drawing
- Add logging to show command array size being sent to AI
- Ensure error handling for cases where command capture might fail

## Expected Benefits

- **Better Scale Matching**: AI can see what size commands create what visual elements
- **Improved Spatial Understanding**: AI understands coordinate-to-visual mapping from examples
- **Command Structure Learning**: AI has working examples of proper Skia command sequences
- **Style Consistency**: AI can match existing drawing patterns and techniques

## Testing Strategy

1. Start with simple drawings (like the face example) to verify concept works
2. Check console logs to ensure commands are being captured correctly
3. Compare AI output quality with context vs without context
4. Monitor token usage to ensure we stay within context limits
5. Test with progressively more complex drawings

## Rollback Plan

- Keep existing `analyzeThenDraw` function as fallback
- Maintain backward compatibility with original `exportCanvas` function
- Can easily switch between context-aware and original implementations via import changes in `App.tsx`

This action plan provides a clear roadmap for implementing the drawing commands context feature. The approach maintains backward compatibility while adding the new functionality, and includes proper testing and rollback strategies. 