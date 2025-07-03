# Undo/Redo Implementation Guide (07-03-25)

## Overall Goal
Implement a robust undo/redo system that tracks the last 15 completed drawing strokes using complete canvas state snapshots. This will provide users with intuitive stroke-level undo/redo functionality while maintaining memory efficiency and seamless integration with existing AI drawing features.

---

## Actions to Implement (v2 – Two-Stack Stroke History)

> This revision **replaces** the original steps that relied on `pathHistory`, `historyIndex`, `saveToHistory`, `isUndoRedoOperation`, and a watcher `useEffect`. Those artefacts **must be removed** – see Step 0 below.

---

### 0. **Clean-up of Previous Attempts**
   • **File**: `components/DrawingCanvas.tsx`
   • Delete the following (and any code that references them):
      1. `pathHistory`, `setPathHistory`, `historyIndex`, `setHistoryIndex`, `isUndoRedoOperation`, `setIsUndoRedoOperation`
      2. The constant `MAX_HISTORY_SIZE` (we re-declare it later)
      3. All implementations of `saveToHistory`, `canUndo`, `canRedo` that used the index model
      4. The `useEffect` that watches `paths.length` to call `saveToHistory`
      5. Any `setTimeout(() => saveToHistory(), 0)` calls in `onTouchEnd`, `addAIPath`, etc.

   • Remove the undo/redo logic that manipulates `historyIndex` and slices arrays.

---

### 1. **Define Stroke and New State**
   • **File**: `components/DrawingCanvas.tsx`
   • **Add** the following just below other `useState` hooks:
```ts
// ----- Undo/Redo -----
interface Stroke {                  // one finished path
  path: any;                        // Skia.Path
  commands: DrawingCommand[];       // for export
}

const [strokes, setStrokes] = useState<Stroke[]>([]);
const undoStack = useRef<Stroke[]>([]);
const redoStack = useRef<Stroke[]>([]);
const MAX_HISTORY = 15;
```

---

### 2. **Collect Commands While Drawing**
   • The logic that builds `userCommands` while the finger moves already exists. Keep it – we'll store it in the `Stroke` object when the stroke finishes.

---

### 3. **Finish a Stroke (User)**
   • **Modify** `onTouchEnd` as follows:
```ts
const onTouchEnd = () => {
  if (mode !== 'draw' || !currentPath?.path) return;

  // 1. Create stroke object
  const stroke: Stroke = {
    path: currentPath.path,
    commands: [...userCommands.slice(-currentPath.points.length)] // last cmds for this stroke
  };

  // 2. Render it
  setStrokes(prev => [...prev, stroke]);
  setPaths(prev => [...prev, currentPath.path]); // existing render list if still needed
  setCurrentPath(null);

  // 3. History bookkeeping
  undoStack.current.push(stroke);
  redoStack.current = [];
  if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
};
```
> **Note**: If you render directly from `strokes` you can delete the separate `paths` array. If you wish to keep `paths`, keep it in sync as shown.

---

### 4. **Finish a Stroke (AI)**
   • **Replace** the body of `addAIPath` with:
```ts
const addAIPath = (commands: DrawingCommand[]) => {
  const aiPath = buildPathFromCommands(commands);
  const stroke: Stroke = { path: aiPath, commands };

  setStrokes(prev => [...prev, stroke]);
  setPaths(prev => [...prev, aiPath]);

  undoStack.current.push(stroke);
  redoStack.current = [];
  if (undoStack.current.length > MAX_HISTORY) undoStack.current.shift();
};
```

---

### 5. **Undo / Redo Functions**
```ts
const canUndo = () => undoStack.current.length > 0;
const canRedo = () => redoStack.current.length > 0;

const undo = () => {
  if (!canUndo()) return;
  const last = undoStack.current.pop()!;
  redoStack.current.push(last);
  setStrokes(prev => prev.slice(0, -1));
  setPaths(prev => prev.slice(0, -1));
};

const redo = () => {
  if (!canRedo()) return;
  const stroke = redoStack.current.pop()!;
  undoStack.current.push(stroke);
  setStrokes(prev => [...prev, stroke]);
  setPaths(prev => [...prev, stroke.path]);
};
```

---

### 6. **Expose the API via `useImperativeHandle`**
   Add/replace the properties so they map to the new `undo`, `redo`, `canUndo`, `canRedo` implementations.

---

### 7. **Clear Function**
```ts
clear: () => {
  setStrokes([]);
  setPaths([]);          // if still used
  setCurrentPath(null);
  setUserCommands([]);
  undoStack.current = [];
  redoStack.current = [];
},
```

---

### 8. **UI Changes in `App.tsx`**
   • No changes required to the existing buttons – the public API is unchanged.
   • You can **remove** the `setInterval` that polls `canUndo/canRedo` if you prefer; call them directly from the button `onPress` disabled prop, or keep the polling if debouncing is important.

---

### 9. **Tests & Validation**
   Reuse the testing steps from the original guide, but pay special attention to:
   1. Draw 3 strokes, undo 3×, redo 3× – count of rendered strokes should match.
   2. Mixed user + AI strokes.
   3. Memory: ensure `undoStack.current.length` never exceeds 15.

---

### 10. **Performance Notes**
   • Undo/redo are O(1) operations (simple array push/pop).
   • Stacks live in `useRef` – they do not trigger re-renders. Only `setStrokes`/`setPaths` updates the canvas.

---

**🎉 That's it!** This two-stack approach eliminates the race conditions and complex bookkeeping while preserving all existing functionality.

---

## Testing & Validation Steps

### 1. **Basic Functionality Testing**
   • Draw 3-4 strokes and verify undo button becomes enabled
   • Test undo to previous states and verify canvas renders correctly
   • Test redo functionality after undoing
   • Verify buttons are disabled when no undo/redo operations are available

### 2. **History Limit Testing**
   • Draw more than 15 strokes
   • Verify that oldest history entries are removed
   • Confirm memory usage doesn't grow indefinitely

### 3. **AI Integration Testing**
   • Draw user strokes, trigger AI drawing
   • Verify AI paths can be undone
   • Test mixed user/AI drawing scenarios

### 4. **Edge Case Testing**
   • Test clear function resets history properly
   • Test undo/redo when canvas is empty
   • Verify state consistency after multiple undo/redo operations

---

## Performance Considerations

- History snapshots are taken only on completed strokes (not during active drawing)
- Maximum 15 snapshots prevents excessive memory usage
- setTimeout ensures state updates complete before history saving
- Button state updates use 100ms intervals to balance responsiveness and performance

## Memory Estimation

With 15 snapshots of typical drawing data:
- Each snapshot: ~5-50KB (depending on complexity)
- Total history memory: ~75KB-750KB maximum
- Acceptable for mobile device constraints 