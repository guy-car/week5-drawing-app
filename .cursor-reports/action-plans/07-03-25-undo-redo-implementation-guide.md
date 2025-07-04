# Undo/Redo Implementation Guide (07-03-25)

## Overall Goal
Implement a robust undo/redo system that tracks the last 15 completed drawing strokes using per-stroke data (Skia Path + DrawingCommand list) rather than full canvas snapshots. This provides intuitive stroke-level undo/redo with minimal memory while integrating cleanly with existing AI drawing features.

---

## Actions to Implement (v2 – Two-Stack Stroke History)

> This revision **replaces** the original steps that relied on `pathHistory`, `historyIndex`, `saveToHistory`, `isUndoRedoOperation`, and a watcher `useEffect`. Those artefacts **must be removed** – see Step 0 below.

---

### 0. **Verify Current Code**
   The current codebase (as of July-2025) no longer contains the previous experimental state-history implementation (`pathHistory`, `historyIndex`, etc.). If you do happen to find any of those remnants in a feature branch, simply delete them. Otherwise, proceed directly to Step&nbsp;1.

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
   • You can remove the `setInterval` that polls `canUndo`/`canRedo` if you prefer; instead query them directly in the `disabled` prop of the buttons. Keep the interval if you still want debouncing.

---

### 9. **Manual Validation Steps**
   1. Draw 3 strokes, undo 3×, redo 3× – the number of rendered strokes should match expectations.
   2. Draw a mix of user strokes and one AI path, then undo and redo through the full history.
   3. Draw more than 15 strokes – verify the oldest entries are pruned (`undoStack.current.length` never exceeds 15).
   4. Tap **Clear** – both stacks should be emptied and undo/redo buttons disabled.

---

### 10. **Performance & Memory Notes**
   • Undo/redo are O(1) push/pop operations on two `useRef` stacks (no extra re-renders).
   • Each history entry stores only a Skia `Path` reference and its command list – <1 MB total for 15 entries under typical usage.
   • History is pushed synchronously at stroke completion (`onTouchEnd` and `addAIPath`); no timers or extra `useEffect` hooks required.
   • UI can compute `canUndo` / `canRedo` on demand or with a lightweight polling interval if desired.

---

**🎉 That's it!** Follow the steps above to add a simple, robust stroke-level undo/redo system with minimal code and zero performance regressions.