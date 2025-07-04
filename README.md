# Drawing Canvas App

A React Native Expo app with drawing canvas functionality using React Native Skia and gesture handling.

## Features

- **Drawing Canvas**: 1000x1000 fixed-size canvas that starts fitted to screen
- **Touch Interactions**:
  - Single finger drawing with black lines (Draw Mode)
  - Pinch-to-zoom and two-finger pan (Pan & Zoom Mode)
- **Mode Toggle**: Switch between "Draw Mode" and "Pan & Zoom Mode"
- **Clear Button**: Clear all drawings from the canvas
- **Zoom Display**: Shows current zoom level (e.g., "Zoom: 1.5x")

## Setup

1. **Install dependencies**:
   ```bash
   npm install
   ```

2. **Start the development server**:
   ```bash
   npx expo start
   ```

3. **Run on device/simulator**:
   - Scan the QR code with Expo Go app (iOS/Android)
   - Press `i` for iOS simulator
   - Press `a` for Android emulator
   - Press `w` for web browser

## Dependencies

- **Expo**: ~50.0.0
- **React Native Skia**: @shopify/react-native-skia
- **Gesture Handler**: react-native-gesture-handler
- **Reanimated**: react-native-reanimated

## Usage

1. **Draw Mode**: Touch the screen with one finger to draw black lines
2. **Pan & Zoom Mode**: 
   - Pinch with two fingers to zoom in/out
   - Pan with two fingers to move around the canvas
3. **Toggle Mode**: Tap the mode button to switch between drawing and pan/zoom
4. **Clear**: Tap the Clear button to remove all drawings
5. **Zoom Level**: Monitor the current zoom level in the header

## Technical Details

- Canvas size: 1000x1000 pixels
- Drawing coordinates are properly transformed for zoom/pan
- Smooth gesture handling with react-native-gesture-handler
- Canvas rendering with React Native Skia
- TypeScript support 

## Implementation Notes

### Drawing Coordinate System Fix
When implementing the drawing functionality with React Native Skia, we encountered and solved an interesting issue with path coordinates. Initially, all drawn lines would start from the top-left corner (0,0) regardless of the actual touch position. This was caused by relying on SVG string manipulation for path creation.

The solution involved:
1. Creating a custom path data structure to maintain the actual touch coordinates:
```typescript
interface PathWithData {
  path: SkiaPath;
  startX: number;
  startY: number;
  points: [number, number][];
}
```

2. Instead of using SVG strings, we now:
   - Store the initial touch point when drawing starts
   - Maintain an array of all points in the path
   - Recreate the path from the original coordinates for each update
   - This ensures the path always starts from the actual touch point

This approach provides more precise control over the drawing coordinates and prevents the (0,0) coordinate issue that can occur when manipulating SVG path strings directly.

## A/B Testing: VectorSummary Removal (January 2025)

### Background
We're testing whether the `vectorSummary` feature is necessary for AI drawing quality. The vectorSummary analyzes user drawings and provides geometric context (angles, bounding box, segment lengths) to the AI. However, since the AI already receives a canvas screenshot, this analysis might be redundant.

### Hypothesis
**H0**: VectorSummary improves AI drawing quality by providing geometric context  
**H1**: Canvas screenshot alone is sufficient; vectorSummary is redundant overhead

### Expected Benefits of Removal
- **Latency**: Save ~800 tokens per AI call ≈ 0.25-0.3s improvement
- **Simplicity**: Remove ~100 lines of geometric analysis code
- **Bug elimination**: VectorSummary currently affected by command duplication bug

### Test Implementation
Set environment variable to disable vectorSummary:
```bash
# In .env file or environment
EXPO_PUBLIC_DISABLE_VECTOR_SUMMARY=1
```

### Files Modified for A/B Test
1. **src/api/openai/riffOnSketch.ts**:
   - Made `summary` parameter optional in `RiffReq` interface
   - Added conditional prompt construction
   - Fallback prompt when no summary provided

2. **App.tsx**:
   - Added environment check before calling `vectorSummary()`
   - Conditional summary parameter to `riffOnSketch()`

### How to Revert
**If AI quality degrades without vectorSummary:**

1. **Quick revert**: Remove or set `EXPO_PUBLIC_DISABLE_VECTOR_SUMMARY=0`
2. **Manual revert**: 
   - In `App.tsx` line ~88: Remove environment check, always call `vectorSummary()`
   - In `riffOnSketch.ts` line ~26: Change `summary?: VectorSummary` back to `summary: VectorSummary`
   - In `riffOnSketch.ts` line ~50: Remove conditional prompt, use original summary-based prompt

### Files NOT Modified
- `src/utils/vectorSummary.ts` - Kept intact for easy revert
- `__tests__/vectorSummary.test.ts` - Tests still pass
- Any other imports or references - Minimal footprint approach

### Success Metrics
- **AI drawing quality**: Subjective assessment over 1 week
- **Latency improvement**: Measure with existing `stamp()` + `printPerf()` tools
- **Token reduction**: Monitor API usage/costs 

## Comprehensive Cleanup Plan (January 2025)

### 🎯 **PRIORITY 1: Remove Vector Summary Logic (HIGH IMPACT)**

**Evidence**: A/B test shows improved AI quality without vectorSummary. Token savings: ~800 tokens ≈ 0.25-0.3s improvement.

**Files to Remove Completely:**
- `src/utils/vectorSummary.ts` (107 lines) - Main implementation
- `__tests__/vectorSummary.test.ts` (45 lines) - Tests

**Files to Modify:**
1. **`src/api/openai/riffOnSketch.ts`**:
   - Remove `summary?: VectorSummary` parameter (line ~26)
   - Remove `import { VectorSummary } from '../../utils/vectorSummary'` (line ~4)
   - Remove conditional prompt logic (lines ~50-116)
   - Keep only the simplified prompt version (without vectorSummary)

2. **`App.tsx`**:
   - Remove `import { vectorSummary } from './src/utils/vectorSummary'` (line ~9)
   - Remove `vectorSummary()` call and conditional logic (lines ~88-95)
   - Always pass `image` only to `riffOnSketch()`

3. **`__tests__/aiPromptColor.test.ts`**:
   - Remove `summaryStub` definition (lines ~22-32)
   - Update `riffOnSketch` test to not pass `summary` parameter (line ~69)

**Expected Outcome**: 
- Remove ~150 lines of geometric analysis code
- Eliminate command duplication bug impact on vectorSummary
- Faster AI responses, better quality (proven by A/B test)

---

### 🎯 **PRIORITY 2: Simplify UserCommands System (CRITICAL BUG FIX)**

**Critical Bug Found**: `components/DrawingCanvas.tsx` line ~393 in `onTouchEnd()`:
```typescript
commands: [...userCommands], // ❌ CAPTURES ALL COMMANDS instead of just current stroke
```

**Evidence**: 1st stroke = 27 commands (correct), 2nd stroke = 56 commands (27 old + 29 new). Exponential growth!

**Key Insight**: `userCommands` is **exclusively** used for AI context and has **zero impact** on undo/redo functionality!

**Undo/Redo System Works Independently:**
- Uses `undoStack`/`redoStack` with `Stroke` objects containing `path` + `color`
- Only manipulates `strokes` and `paths` arrays for rendering
- The `commands` field in `Stroke` is only used for AI export + debug logs

**With Vector Summary Removed, UserCommands Becomes Completely Unnecessary:**
- `exportCanvasWithCommands()` only needs to export image (no commands needed)
- AI gets all context from screenshot alone
- Command history bug becomes irrelevant
- **Undo/redo continues working perfectly** without any command tracking

**Files to Modify:**
1. **`components/DrawingCanvas.tsx`**:
   - Remove `[userCommands, setUserCommands]` state (line ~66)
   - Remove `setUserCommands()` calls in `onTouchStart()` and `onTouchMove()` (lines ~361, ~388)
   - Remove `commands: [...userCommands]` from `onTouchEnd()` (line ~393)
   - Update `exportCanvasWithCommands()` to return `commands: []` (line ~125)
   - Simplify `clear()` to not reset userCommands
   - **BONUS**: Simplify `Stroke` interface by removing `commands` field entirely

2. **`src/api/openai/proceedWithAPICall.ts`**:
   - Remove `analyzeThenDrawWithContext()` function (lines ~290-484) - depends on userCommands
   - Keep simpler functions that only need image

3. **`App.tsx`**:
   - Remove `analyzeThenDrawWithContext()` call (line ~105)
   - Always use `riffOnSketch()` or `proceedWithAPICall()` (image-only)

**Expected Outcome**:
- Fix exponential command duplication bug
- Remove ~200 lines of unnecessary command tracking code
- Eliminate path-stroke alignment issues
- **Undo/redo unaffected** - continues working perfectly
- Even simpler `Stroke` interface

---

### 🎯 **PRIORITY 3: Remove Old API Routes (MEDIUM IMPACT)**

**proceedWithAPICall Analysis**:
- `src/api/openai/proceedWithAPICall.ts` contains 3 functions:
  - `proceedWithAPICall()` - Basic AI integration (keep as fallback)
  - `analyzeThenDraw()` - Two-step analysis (old approach, can remove)
  - `analyzeThenDrawWithContext()` - Uses userCommands (remove with Priority 2)

**Files to Modify:**
1. **`src/api/openai/proceedWithAPICall.ts`**:
   - Remove `analyzeThenDraw()` function (lines ~115-227)
   - Remove `analyzeThenDrawWithContext()` function (lines ~229-484)
   - Keep only `proceedWithAPICall()` as non-streaming fallback

2. **`src/api/openai/index.ts`**:
   - Remove exports for deleted functions (lines ~4-7)

**Expected Outcome**:
- Remove ~370 lines of unused API code
- Simplify to 2 routes: `riffOnSketch()` (streaming) + `proceedWithAPICall()` (fallback)

---

### 🎯 **PRIORITY 4: Consolidate Prompt Experiments (LOW IMPACT)**

**Current State**: `src/api/openai/experiments.ts` has 5 experimental prompts (expPrompt1-5).
**Current Usage**: Only `expPrompt5` is used in `proceedWithAPICall.ts` line ~47.

**Consolidation Opportunities**:
1. **Extract Best Prompt**: `expPrompt5` seems most effective (focuses on missing elements)
2. **Remove Unused Prompts**: expPrompt1-4 are unused (96 lines)
3. **Inline Final Prompt**: Move `expPrompt5` directly into `proceedWithAPICall.ts`

**Files to Modify:**
1. **`src/api/openai/experiments.ts`**:
   - Remove entirely (113 lines) OR keep as documentation with clear "UNUSED" header

2. **`src/api/openai/proceedWithAPICall.ts`**:
   - Remove `import { expPrompt5 } from './experiments'` (line ~6)
   - Inline the prompt directly (replace `${expPrompt5}` with actual text)

**Expected Outcome**:
- Remove ~113 lines of unused experimental code
- Cleaner, more focused prompt engineering

---

### 🎯 **PRIORITY 5: Clean Up Debug Logging (LOW IMPACT)**

**Current State**: `components/DrawingCanvas.tsx` has extensive debug logging added for bug investigation.

**Post-Cleanup**: Many debug logs become irrelevant once bugs are fixed.

**Files to Clean**:
1. **`components/DrawingCanvas.tsx`**:
   - Remove debug header comment (lines ~1-10)
   - Remove command accumulation logs (now irrelevant)
   - Keep essential logs for AI integration monitoring

**Expected Outcome**:
- Cleaner console output
- Better performance (fewer console.log calls)

---

### 📊 **TOTAL CLEANUP IMPACT**

**Lines of Code Removed**: ~785 lines
- Vector summary logic: ~150 lines
- UserCommands system: ~200 lines  
- Old API routes: ~370 lines
- Prompt experiments: ~113 lines
- Debug logging: ~52 lines

**Files Removed Completely**: 2
- `src/utils/vectorSummary.ts`
- `__tests__/vectorSummary.test.ts`

**Files Significantly Modified**: 5
- `components/DrawingCanvas.tsx`
- `src/api/openai/riffOnSketch.ts`
- `src/api/openai/proceedWithAPICall.ts`
- `App.tsx`
- `src/api/openai/experiments.ts`

**Expected Benefits**:
- ✅ Fix critical command duplication bug
- ✅ Faster AI responses (0.25-0.3s improvement)
- ✅ Better AI quality (proven by A/B test)
- ✅ Simpler, more maintainable codebase
- ✅ Eliminate path-stroke alignment issues

**Risk Assessment**: LOW
- Vector summary removal already proven successful via A/B test
- UserCommands removal eliminates bugs rather than creating them
- Old API routes are unused fallbacks
- All changes are subtractive (removing complexity)

---

### 🔧 **CLEANUP EXECUTION ORDER**

**Phase 1**: Remove Vector Summary (30 min)
1. Delete `src/utils/vectorSummary.ts` and test file
2. Update `riffOnSketch.ts` to remove optional parameter
3. Update `App.tsx` to remove vectorSummary usage
4. Update test files

**Phase 2**: Simplify UserCommands (45 min)
1. Fix command duplication bug in `DrawingCanvas.tsx`
2. Remove userCommands state and related logic
3. Update `exportCanvasWithCommands()` to image-only
4. Remove `analyzeThenDrawWithContext()` usage

**Phase 3**: Remove Old Routes (20 min)
1. Delete unused functions from `proceedWithAPICall.ts`
2. Update index.ts exports
3. Inline experimental prompts

**Phase 4**: Clean Debug Logs (10 min)
1. Remove debug comments and excessive logging
2. Keep essential AI monitoring logs

**Total Estimated Time**: 1 hour 45 minutes
**Recommended Approach**: Execute phases sequentially with testing between each phase 