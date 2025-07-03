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

2. **Clear-all with confirmation**  
   • File(s): `App.tsx`  
   • Replace direct `canvasRef.current.clear()` call with `Alert.alert('Clear?', …)` before clearing.

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

8. **Bottom-sheet options panel**  
   • File(s): `components/OptionsSheet.tsx` (new), `App.tsx`  
   • Use `@gorhom/bottom-sheet` to host colour picker, thickness slider, eraser toggle.

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

### Suggested order (remaining estimate)
1. Clear-all confirm (0.2 h)  
2. Colour picker + eraser (1 h)  
3. Rect canvas (0.4 h)  
4. Brush slider (0.6 h)  
5. Bottom sheet polish (1 h)  
6. Save/share (0.6 h)  
7. Prompt slimming (0.8 h)  
8. Early spinner dismiss (0.2 h)  
9. Docs (0.3 h)

Total ≈ 5.1 h – leaves buffer for testing & demo recording. 