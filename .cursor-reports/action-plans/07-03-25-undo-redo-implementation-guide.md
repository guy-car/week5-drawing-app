# Undo/Redo Implementation Guide (07-03-25)

## Overall Goal
Implement a robust undo/redo system that tracks the last 15 completed drawing strokes using complete canvas state snapshots. This will provide users with intuitive stroke-level undo/redo functionality while maintaining memory efficiency and seamless integration with existing AI drawing features.

---

## Actions to Implement

### 1. **Add History State Management to DrawingCanvas**
   • **File**: `components/DrawingCanvas.tsx`
   • Add new state variables for managing drawing history
   • Create constants for history management

**Implementation Details:**
```typescript
// Add after existing useState declarations
const [pathHistory, setPathHistory] = useState<{paths: any[], userCommands: DrawingCommand[]}[]>([]);
const [historyIndex, setHistoryIndex] = useState(-1);
const MAX_HISTORY_SIZE = 15;
```

### 2. **Implement Core History Management Functions**
   • **File**: `components/DrawingCanvas.tsx`
   • Create helper functions for saving, undoing, and redoing operations

**Implementation Details:**
```typescript
const saveToHistory = () => {
  const currentState = {
    paths: [...paths],
    userCommands: [...userCommands]
  };
  
  // Remove any "future" history if we're not at the end
  const newHistory = pathHistory.slice(0, historyIndex + 1);
  newHistory.push(currentState);
  
  // Keep only the last 15 states
  if (newHistory.length > MAX_HISTORY_SIZE) {
    newHistory.shift(); // Remove oldest entry
  } else {
    setHistoryIndex(historyIndex + 1);
  }
  
  setPathHistory(newHistory);
};

const undo = () => {
  if (historyIndex > 0) {
    const newIndex = historyIndex - 1;
    const previousState = pathHistory[newIndex];
    
    setPaths(previousState.paths);
    setUserCommands(previousState.userCommands);
    setHistoryIndex(newIndex);
    
    // Clear any active AI path reference when undoing
    aiPathRef.current = null;
  }
};

const redo = () => {
  if (historyIndex < pathHistory.length - 1) {
    const newIndex = historyIndex + 1;
    const nextState = pathHistory[newIndex];
    
    setPaths(nextState.paths);
    setUserCommands(nextState.userCommands);
    setHistoryIndex(newIndex);
    
    // Clear any active AI path reference when redoing
    aiPathRef.current = null;
  }
};

const canUndo = () => historyIndex > 0;
const canRedo = () => historyIndex < pathHistory.length - 1;
```

### 3. **Integrate History Saving with Drawing Events**
   • **File**: `components/DrawingCanvas.tsx`
   • Modify the `onTouchEnd` function to save history after completing each stroke

**Implementation Details:**
```typescript
const onTouchEnd = () => {
  if (mode !== 'draw' || !currentPath?.path) return;
  setPaths(prevPaths => [...prevPaths, currentPath.path]);
  setCurrentPath(null);
  
  // Save to history after completing a stroke
  // Use setTimeout to ensure state updates are processed first
  setTimeout(() => {
    saveToHistory();
  }, 0);
};
```

### 4. **Update Clear Function to Reset History**
   • **File**: `components/DrawingCanvas.tsx`
   • Modify the clear function in `useImperativeHandle` to reset history state

**Implementation Details:**
```typescript
clear: () => {
  setPaths([]);
  setCurrentPath(null);
  setUserCommands([]);
  setPathHistory([]);
  setHistoryIndex(-1);
  aiPathRef.current = null;
},
```

### 5. **Expose Undo/Redo Methods via Component Ref**
   • **File**: `components/DrawingCanvas.tsx`
   • Add undo/redo methods and capability checkers to the ref interface

**Implementation Details:**
```typescript
// Update the DrawingCanvasRef interface
interface DrawingCanvasRef {
  clear: () => void;
  handleZoom: (increment: boolean) => void;
  exportCanvas: (canvasRef: any) => Promise<string | null>;
  exportCanvasWithCommands: () => Promise<{ image: string | null; commands: DrawingCommand[] }>;
  addAIPath: (commands: DrawingCommand[]) => void;
  addDebugGrid: () => void;
  addAICommandIncremental: (command: DrawingCommand) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}

// Update useImperativeHandle
useImperativeHandle(ref, () => ({
  clear: () => {
    setPaths([]);
    setCurrentPath(null);
    setUserCommands([]);
    setPathHistory([]);
    setHistoryIndex(-1);
    aiPathRef.current = null;
  },
  handleZoom,
  exportCanvas: () => exportCanvas(canvasRef, { resize: 256, format: 'jpeg', quality: 0.6 }),
  exportCanvasWithCommands,
  addAIPath,
  addDebugGrid,
  addAICommandIncremental,
  undo,
  redo,
  canUndo,
  canRedo,
}));
```

### 6. **Update App.tsx Interface Type**
   • **File**: `App.tsx`
   • Update the DrawingCanvasRef interface to include new undo/redo methods

**Implementation Details:**
```typescript
// Update the interface definition near the top of App.tsx
interface DrawingCanvasRef {
  clear: () => void;
  handleZoom: (increment: boolean) => void;
  exportCanvas: () => Promise<string | null>;
  exportCanvasWithCommands: () => Promise<{ image: string | null; commands: DrawingCommand[] }>;
  addAIPath: (commands: any[]) => void;
  addDebugGrid: () => void;
  addAICommandIncremental: (command: DrawingCommand) => void;
  undo: () => void;
  redo: () => void;
  canUndo: () => boolean;
  canRedo: () => boolean;
}
```

### 7. **Add State Management for Button States**
   • **File**: `App.tsx`
   • Add state variables to track undo/redo availability and update them periodically

**Implementation Details:**
```typescript
// Add after existing useState declarations
const [canUndo, setCanUndo] = useState(false);
const [canRedo, setCanRedo] = useState(false);

// Add useEffect to periodically check undo/redo availability
useEffect(() => {
  const interval = setInterval(() => {
    if (canvasRef.current) {
      setCanUndo(canvasRef.current.canUndo());
      setCanRedo(canvasRef.current.canRedo());
    }
  }, 100);
  
  return () => clearInterval(interval);
}, []);
```

### 8. **Add Undo/Redo Buttons to Header UI**
   • **File**: `App.tsx`
   • Modify the header's leftControls section to include undo/redo buttons

**Implementation Details:**
```typescript
// Replace the leftControls View in the header
<View style={styles.leftControls}>
  <View style={styles.undoRedoContainer}>
    <TouchableOpacity 
      style={[styles.undoRedoButton, !canUndo && styles.disabledButton]}
      onPress={() => canvasRef.current?.undo()}
      disabled={!canUndo}
    >
      <Text style={[styles.undoRedoText, !canUndo && styles.disabledText]}>↶</Text>
    </TouchableOpacity>
    <TouchableOpacity 
      style={[styles.undoRedoButton, !canRedo && styles.disabledButton]}
      onPress={() => canvasRef.current?.redo()}
      disabled={!canRedo}
    >
      <Text style={[styles.undoRedoText, !canRedo && styles.disabledText]}>↷</Text>
    </TouchableOpacity>
  </View>
  
  <TouchableOpacity 
    style={[styles.button, mode === 'draw' && styles.activeButton]} 
    onPress={toggleMode}
  >
    <Text style={[styles.buttonText, mode === 'draw' && styles.activeButtonText]}>
      {mode === 'draw' ? 'Draw' : 'Move'}
    </Text>
  </TouchableOpacity>
</View>
```

### 9. **Add Styling for Undo/Redo Buttons**
   • **File**: `App.tsx`
   • Add new styles for the undo/redo UI components

**Implementation Details:**
```typescript
// Add to the styles object
undoRedoContainer: {
  flexDirection: 'row',
  marginRight: 15,
},
undoRedoButton: {
  width: 36,
  height: 36,
  borderRadius: 18,
  backgroundColor: '#007AFF',
  justifyContent: 'center',
  alignItems: 'center',
  marginHorizontal: 2,
},
disabledButton: {
  backgroundColor: '#C7C7CC',
},
undoRedoText: {
  fontSize: 18,
  color: '#fff',
  fontWeight: 'bold',
},
disabledText: {
  color: '#8E8E93',
},
```

### 10. **Handle AI Drawing Integration**
   • **File**: `components/DrawingCanvas.tsx`
   • Ensure AI paths don't interfere with user history tracking

**Implementation Details:**
```typescript
// Modify addAIPath to optionally save to history
const addAIPath = (commands: DrawingCommand[]) => {
  try {
    console.log('🎯 AI Commands received:', commands);
    const aiPath = buildPathFromCommands(commands);
    setPaths(prevPaths => [...prevPaths, aiPath]);
    
    // Save AI drawing to history so user can undo it
    setTimeout(() => {
      saveToHistory();
    }, 0);
    
    console.log(`✅ AI path added successfully with ${commands.length} commands`);
  } catch (error) {
    console.error('❌ Error adding AI path:', error);
  }
};
```

### 11. **Add Import Statement for useEffect**
   • **File**: `App.tsx`
   • Add useEffect to the React imports if not already present

**Implementation Details:**
```typescript
// Update the import statement at the top of App.tsx
import React, { useState, useRef, useEffect } from 'react';
```

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