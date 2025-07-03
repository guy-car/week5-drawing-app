# Quick-win UI / UX & Prompt Optimisation Plan (07-03-24)

## Overall goal
Deliver a polished demo-ready drawing experience in the next 14 h that feels responsive (<3 s to first AI stroke) and intuitive, while adding core usability features (undo/redo, colour choice, save, etc.) and trimming prompt bloat.

---

## Actions to take

0. clean up:
-  info screen after AI responded
- 

1. ✅ **Undo / Redo stack** (COMPLETED)  
   • Implementation: Two-stack approach with `undoStack` and `redoStack` for O(1) operations
   • Stores last 15 strokes (both user & AI) with their paths and commands
   • UI: Added undo/redo buttons next to AI controls
   • Files changed: `components/DrawingCanvas.tsx`, `App.tsx`

2. ✅ **Clear-all with confirmation** (COMPLETED)
   • File(s): `App.tsx`  
   • Replaced direct `canvasRef.current.clear()` call with a themed confirmation dialog using `react-native-modal` before clearing.

3. **Colour palette (user & AI)**  
   • File(s): `components/ColorPicker.tsx` (new), `App.tsx`, `components/DrawingCanvas.tsx`  
   • Horizontal list of coloured circles; selected colour stored in React state and passed to drawing functions & AI prompt.

4. **Brush thickness slider**  
   • File(s): `components/ThicknessSlider.tsx` (new), `components/DrawingCanvas.tsx`  
   • Use `Slider` from `@react-native-community/slider`; update `paint.setStrokeWidth` accordingly.

5. **Eraser tool**  
   • File(s): `components/DrawingCanvas.tsx`, `App.tsx` (toggle button)  
   • When eraser mode is active, draw in background colour (`#E6F3FF`) with same APIs.

6. **Responsive rectangular canvas**  
   • File(s): `src/constants/canvas.ts`, `components/DrawingCanvas.tsx`  
   • Change `BASE_CANVAS_SIZE` to e.g. `1200 × 1800` and recalc initialScale with aspect ratio.

7. **Save / share snapshot**  
   • File(s): `components/DrawingCanvas.tsx`, maybe new `utils/share.ts`  
   • After `exportCanvas()`, call `Sharing.shareAsync()` (Expo) or write to `CameraRoll`.

8. **Inline bottom toolbar (⏩ replaces bottom-sheet idea)**  
   • File(s): `components/BottomToolbar.tsx` (new), `App.tsx`, `components/ColorSwatches.tsx`, `components/ThicknessSlider.tsx`  
   • Row contains 🎨 Colour, ↔️ Thickness, 🩹 Eraser. Pop-outs appear above icons; no external dependency.

9. **Prompt slimming (latency cut)**  
   • File(s): `src/api/openai/riffOnSketch.ts`, `src/api/openai/types.ts`  
   • Replace pretty-printed `vectorSummary` with compact keys (`bb`, `avg`, `ang`).  
   • Trim RULES to one line; property rename in JSON schema (`cmd`, `x1`, …).  
   • Target ≤1 k input tokens, 20-30 command limit already set.

10. **Early spinner dismiss**  
    • File(s): `App.tsx`  
    • Stop "Processing…" spinner right after `first-stroke` stamp; user can keep drawing while AI finishes.

11. **Documentation updates**  
    • File(s): `README.md`, `NOTES.MD`  
    • Explain new UI controls and note latency levers.

---

## Detailed implementation plan – Inline Bottom Toolbar
1. **Scaffold component**  
   • New: `components/BottomToolbar.tsx` (copy scaffold below).  
   • Props: `color`, `setColor`, `strokeWidth`, `setStrokeWidth`, `isEraser`, `setIsEraser`.  
   • Local state: `active` (`'color' | 'width' | null`) to track open pop-out.

2. **Colour picker**  
   • Phase 1: horizontal swatch list of 6–8 preset colours (`ColorSwatches.tsx`).  
   • Auto-collapse after `onSelect`.  
   • Leave extension point for wheel picker later (no extra libs yet).

3. **Thickness slider**  
   • Use `@react-native-community/slider` (Expo default).  
   • Vertical orientation (`transform: rotate(-90deg)`) to rise above icon.  
   • Collapse on `onSlidingComplete`.

4. **Eraser toggle**  
   • Toggles `isEraser` boolean.  
   • Filled icon background when active; automatically unselect if user chooses a colour.

5. **SafeArea & orientation**  
   • Wrap toolbar with `SafeAreaView` and set `pointerEvents="box-none"`.  
   • Lock portrait for demo:  
     ```ts
     import * as ScreenOrientation from 'expo-screen-orientation';
     useEffect(() => {
       ScreenOrientation.lockAsync(ScreenOrientation.OrientationLock.PORTRAIT_UP);
     }, []);
     ```

6. **State wiring**  
   • Lift colour / width / eraser state to `App.tsx` (or small `DrawingContext`).

7. **Regression checkpoints**  
   1. Run jest (`npm test`) — all suites green.  
   2. Manual smoke: draw → change colour → draw → undo/redo → toggle eraser → adjust width.  
   3. Check gesture conflicts (drawing vs. toolbar).  
   4. Minimum iPhone SE height: ensure pop-outs clear home indicator.

8. **Scaffold code**  
   ```tsx
// components/BottomToolbar.tsx
import { useState } from 'react';
import { View, TouchableOpacity, Animated } from 'react-native';
import { Feather } from '@expo/vector-icons';
import ColorSwatches from './ColorSwatches';
import ThicknessSlider from './ThicknessSlider';

export default function BottomToolbar({
  color, setColor,
  strokeWidth, setStrokeWidth,
  isEraser, setIsEraser,
}) {
  const [active, setActive] = useState<'color' | 'width' | null>(null);

  return (
    <View style={styles.container} pointerEvents="box-none">
      {/* Colour */}
      <TouchableOpacity
        onPress={() => setActive(active === 'color' ? null : 'color')}
        style={[styles.icon, active === 'color' && styles.active]}
      >
        <Feather name="droplet" size={20} color={color} />
      </TouchableOpacity>

      {/* Thickness */}
      <TouchableOpacity
        onPress={() => setActive(active === 'width' ? null : 'width')}
        style={[styles.icon, active === 'width' && styles.active]}
      >
        <Feather name="minus" size={20} color="#333" />
      </TouchableOpacity>

      {/* Eraser */}
      <TouchableOpacity
        onPress={() => setIsEraser(!isEraser)}
        style={[styles.icon, isEraser && styles.selected]}
      >
        <Feather name="trash-2" size={20} color={isEraser ? '#fff' : '#333'} />
      </TouchableOpacity>

      {/* Pop-outs */}
      {active === 'color' && (
        <ColorSwatches
          current={color}
          onSelect={c => { setColor(c); setActive(null); }}
        />
      )}

      {active === 'width' && (
        <ThicknessSlider
          value={strokeWidth}
          onChange={setStrokeWidth}
          onDone={() => setActive(null)}
        />
      )}
    </View>
  );
}
   ```

9. **Stretch goals**  
   • Landscape support: reposition toolbar to right edge when `width > height`.  
   • Replace swatches with `react-native-color-picker` wheel if needed.

### Suggested order (remaining estimate)
1. Clear-all confirm (0.2 h)  
2. Colour picker + eraser (1 h)  
3. Rect canvas (0.4 h)  
4. Brush slider (0.6 h)  
5. Inline toolbar polish (1 h)  
6. Save/share (0.6 h)  
7. Prompt slimming (0.8 h)  
8. Early spinner dismiss (0.2 h)  
9. Docs (0.3 h)

Total ≈ 5.1 h – leaves buffer for testing & demo recording. 