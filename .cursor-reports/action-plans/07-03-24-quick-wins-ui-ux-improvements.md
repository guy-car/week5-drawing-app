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

### Phase 1: Basic Structure with Color Picker
1. **Initial Toolbar Setup**
   • File(s): `components/BottomToolbar.tsx` (new), `App.tsx`
   • Create basic toolbar with three buttons using Phosphor icons:
     - "palette" for color picker
     - "pencil-circle" for thickness (placeholder)
     - "eraser" for eraser mode (placeholder)
   • Style buttons similar to existing undo/redo buttons
   • Position toolbar at bottom of screen with evenly spaced buttons

2. **Color Picker Implementation**
   • File(s): `components/ColorPicker.tsx` (new)
   • Features:
     - Color spectrum picker component
     - Pops up above the toolbar when color button is pressed
     - Recently used colors row (8 slots) - stretch goal
   • State:
     - Lift color state to App.tsx
     - Track active state for picker visibility

3. **State Management in App.tsx**
   • Add new state:
     ```typescript
     const [currentColor, setCurrentColor] = useState('#000000');
     const [activeControl, setActiveControl] = useState<'color' | 'thickness' | null>(null);
     ```
   • Pass state and handlers to BottomToolbar
   • Update DrawingCanvas to use selected color

### Phase 2 (Future)
4. **Thickness Control**
   • Implement slider for stroke width adjustment
   • Range: -15% to +200% of default width

5. **Eraser Mode**
   • Toggle between drawing and erasing
   • Use background color (#E6F3FF) for eraser strokes

### Implementation Notes
- Skip SafeArea handling as orientation is locked
- Match button styling with existing undo/redo buttons:
  ```typescript
  {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 8,
    backgroundColor: '#007AFF'  // or contextual color
  }
  ```
- Active state styling:
  - Button background changes when control is active
  - Consistent with current UI patterns
- Testing Strategy:
  - Manual testing of color picker interaction
  - Verify color changes affect new strokes
  - Check button layout and spacing
  - Ensure picker closes on color selection

### Dependencies
- @phosphor-icons/react-native (to be added)
- Existing style system for consistency
- No additional UI framework dependencies

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