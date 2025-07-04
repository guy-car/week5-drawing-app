# Manual Test Observations & Broken Features

This file tracks the current issues we've observed during manual testing so we can fix them methodically.

## Colour-related Issues

| ID | Scenario | Expected | Actual | Notes |
|----|----------|----------|--------|-------|
| C-1 | AI incremental drawing (streaming) while a non-black colour is selected | Strokes appear in the selected colour as they stream | Streaming strokes render in **black**; when the final stroke is committed the colour switches to the selected colour | Likely due to incremental path not being paired with a `Stroke` object (colour lookup fails) |
| C-2 | User presses **Undo** on their own coloured stroke | The stroke disappears; nothing else changes | Stroke path sometimes switches to black for one undo step before disappearing; Redo restores colour correctly | Index mis-alignment or colour fallback in render loop |
| C-3 | User presses **Undo** after AI strokes | The most recent AI stroke disappears fully | First undo flips AI stroke to black; a second undo removes it | Same root cause as C-2 |

## Jest / Test Infrastructure Issues

| ID | Scenario | Expected | Actual | Notes |
|----|----------|----------|--------|-------|
| J-1 | Running `npm test` | All suites run | Crash: `TypeError: Cannot read properties of undefined (reading 'EXPO_PUBLIC_RIFF_ON_SKETCH')` coming from `jest.setup.js` when setting env defaults | Need bullet-proof `process.env` mock or move env flag stubs into individual test files |
| J-2 | Transforming `expo/virtual/env.js` | Jest handles import | SyntaxError on `export const env` (ESM) unless mocked | Global mock now in place, but verify across suites |

## Core Drawing Command History Bug (Investigation 2025-01-07)

**CRITICAL BUG CONFIRMED:** Each stroke captures ALL previous commands instead of just its own.

### Investigation Results from Console Logs

**Test Scenario:** Drew 2 strokes with different colors (#57ff0a green, then #00afef blue)

| Stroke | Points | Commands Start Count | Commands End Count | Expected Commands | Issue |
|--------|--------|--------------------|-------------------|-------------------|-------|
| 1st (Green) | 27 | 0 | 27 | 27 | ✅ **CORRECT** |
| 2nd (Blue) | 29 | 27 | 56 | 29 | ❌ **BUG: Captured 27 previous + 29 own = 56** |

### Log Evidence
```
🎯 STROKE START - selectedColor: #57ff0a userCommands count before: 0
🚨 TOTAL userCommands being captured: 27
✅ Stroke created with 27 commands and color #57ff0a

🎯 STROKE START - selectedColor: #00afef userCommands count before: 27  ← BUG!
🚨 TOTAL userCommands being captured: 56  ← BUG! Should be ~29
🎯 Current stroke points count: 29
✅ Stroke created with 56 commands and color #00afef
```

### Root Cause
In `DrawingCanvas.tsx` `onTouchEnd()`:
```typescript
const stroke: Stroke = {
  path: currentPath.path,
  commands: [...userCommands], // ❌ Captures ALL commands ever drawn
  color: currentPath.color
};
```

### Impact Assessment
- **Drawing functionality**: Works visually (paths render correctly)
- **Color functionality**: Works correctly (each stroke gets right color)
- **AI integration**: BROKEN - AI receives exponentially growing command history
- **Export**: BROKEN - exports contain duplicate/incorrect commands
- **Performance**: Gets worse with each stroke due to growing command arrays

### Status
- ✅ Bug confirmed and located
- ⏳ Fix needed: Track commands per stroke, not globally
- 🚨 **HIGH PRIORITY** - Affects AI functionality and export

## AI Streaming & Color Integration Issues (Investigation 2025-01-07)

### Test Scenario 1: Undo/Redo Without AI
**Result:** ✅ **WORKS CORRECTLY**
- Drew 3 strokes of same color
- Multiple undo/redo cycles 
- Colors persisted correctly throughout

### Test Scenario 2: AI Streaming with Colors
**Setup:** 2 user strokes (orange, then blue) + AI call

| Issue | Description | Log Evidence | Visual Behavior |
|-------|-------------|--------------|-----------------|
| **Streaming Colors** | AI strokes appear black during streaming, snap to correct color when complete | `🚨 INCREMENTAL AI BUG - This AI path has NO stroke entry with color info!`<br>`🚨 RENDER BUG - No matching stroke found for path index: 2` | Black during stream → Blue after completion |
| **AI Undo Issue** | First undo on AI stroke makes it black, second undo removes it | `↩️ UNDO - Removing stroke with color: #00afef`<br>`🚨 RENDER BUG - No matching stroke found` | Blue → Black → Gone |
| **AI Redo Issue** | Redo restores AI stroke with correct color | `↪️ REDO - Restoring stroke with color: #00afef` | Gone → Blue ✅ |
| **User Stroke Corruption** | After AI undo/redo, user strokes can turn black | `↩️ UNDO - Removing stroke with color: #00afef commands: 51`<br>`🚨 RENDER BUG - No matching stroke found for path index: 1` | Blue user stroke → Black |

### Root Causes Identified

#### 1. **Incremental AI Color Bug**
- **Problem**: `addAICommandIncremental()` adds paths but no stroke entries
- **Result**: Path index 2 has no matching stroke → fallback to black
- **Fix needed**: Create stroke entry for incremental AI paths

#### 2. **Path-Stroke Index Misalignment** 
- **Problem**: Paths array: `[user1, user2, aiIncremental, aiFinal]` vs Strokes array: `[user1, user2, aiFinal]`
- **Result**: Index-based lookup fails after aiIncremental path
- **Evidence**: `Total paths: 4 Total strokes: 3` + `🚨 RENDER BUG - No matching stroke found for path index: 2`

#### 3. **Command History Amplification**
- **Evidence**: `↩️ UNDO - Removing stroke with color: #00afef commands: 51` 
- **Problem**: Second user stroke has 51 commands (should be ~29 from earlier test)
- **Impact**: AI receives corrupted command history due to command accumulation bug

### Status
- ✅ **User-only undo/redo**: Works correctly
- ❌ **AI streaming colors**: Black during stream, correct after
- ❌ **AI undo/redo**: Color corruption and index misalignment
- ❌ **Command history**: Growing exponentially, affecting AI quality

## Bug Assessment & Implementation Plan (2025-01-07)

### 🚨 **Bug Priority Matrix**

| Bug | Severity | Fix Complexity | Risk | Impact on UX | Fix Priority |
|-----|----------|----------------|------|--------------|--------------|
| **#1: Command History** | CRITICAL | 🟡 Medium | 🟡 Medium | Massive (AI quality) | **1st - MUST FIX** |
| **#2: Incremental AI Colors** | HIGH | 🟢 Low | 🟢 Low | Medium (streaming UX) | **2nd - SHOULD FIX** |
| **#3: Path-Stroke Alignment** | MEDIUM | 🔴 High | 🔴 High | Low (undo/redo edge cases) | **3rd - CAN DEFER** |

### 📋 **Specific Implementation Plans**

#### **Phase 1: Fix Command History Bug (Priority 1)**
**Target:** Fix exponential command accumulation  
**Risk Level:** 🟡 Medium | **Estimated Time:** 30-45 minutes

**Current Problem:**
```typescript
// In onTouchEnd() - captures ALL commands ever drawn
commands: [...userCommands], // ❌ 27, then 56, then 84, etc.
```

**Implementation Plan:**
```typescript
// Step 1: Add stroke-specific command tracking
const [currentStrokeCommands, setCurrentStrokeCommands] = useState<DrawingCommand[]>([]);

// Step 2: Reset on stroke start
const onTouchStart = (event: any) => {
  // ... existing code ...
  setCurrentStrokeCommands([]); // ✅ Reset for new stroke
  
  const newCommand = { type: 'moveTo' as const, x: ..., y: ... };
  setCurrentStrokeCommands([newCommand]); // ✅ Track per stroke
  setUserCommands(prev => [...prev, newCommand]); // Keep global for export
};

// Step 3: Track moves per stroke
const onTouchMove = (event: any) => {
  // ... existing code ...
  const newCommand = { type: 'lineTo' as const, x: ..., y: ... };
  setCurrentStrokeCommands(prev => [...prev, newCommand]); // ✅ Add to current stroke
  setUserCommands(prev => [...prev, newCommand]); // Keep global
};

// Step 4: Use stroke-specific commands
const onTouchEnd = () => {
  const stroke: Stroke = {
    path: currentPath.path,
    commands: [...currentStrokeCommands], // ✅ Only current stroke commands
    color: currentPath.color
  };
};
```

**Testing Plan:**
- Draw 2 strokes, verify each has correct command count
- Test AI call - should receive clean, accurate command history
- Verify undo/redo still works

**Rollback Plan:** Revert to `[...userCommands]` if issues arise

---

#### **Phase 2: Fix Incremental AI Colors (Priority 2)**
**Target:** Show correct colors during AI streaming  
**Risk Level:** 🟢 Low | **Estimated Time:** 20-30 minutes

**Current Problem:**
```typescript
// addAICommandIncremental() creates paths but no stroke entries
setPaths(prev => [...prev.filter(p => p !== aiPathRef.current), aiPathRef.current]);
// ❌ Path exists but no matching stroke → black fallback
```

**Implementation Plan:**
```typescript
// Step 1: Track incremental AI stroke
const [incrementalAIStroke, setIncrementalAIStroke] = useState<Stroke | null>(null);

// Step 2: Create stroke entry for incremental AI
const addAICommandIncremental = (command: DrawingCommand) => {
  if (!aiPathRef.current) {
    aiPathRef.current = Skia.Path.Make();
    // ✅ Create stroke entry immediately
    const newStroke: Stroke = {
      path: aiPathRef.current,
      commands: [],
      color: selectedColor
    };
    setIncrementalAIStroke(newStroke);
    setStrokes(prev => [...prev, newStroke]);
  }
  
  // Update commands
  setIncrementalAIStroke(prev => prev ? {
    ...prev,
    commands: [...prev.commands, command]
  } : null);
  
  buildPathFromCommands([command], aiPathRef.current);
  setPaths(prev => [...prev.filter(p => p !== aiPathRef.current), aiPathRef.current]);
};

// Step 3: Clean up when final AI stroke arrives
const addAIPath = (commands: DrawingCommand[]) => {
  // Remove incremental stroke
  if (incrementalAIStroke) {
    setStrokes(prev => prev.filter(s => s !== incrementalAIStroke));
    setPaths(prev => prev.filter(p => p !== aiPathRef.current));
    setIncrementalAIStroke(null);
  }
  
  // Add final stroke (existing code)
  const finalStroke: Stroke = { path: aiPath, commands, color: selectedColor };
  setStrokes(prev => [...prev, finalStroke]);
  setPaths(prev => [...prev, aiPath]);
};
```

**Testing Plan:**
- Test AI streaming - should show correct color throughout
- Verify final stroke replaces incremental correctly
- Test interruption scenarios

---

#### **Phase 3: Path-Stroke Alignment Workaround (Priority 3)**
**Target:** Improve undo/redo reliability without architectural changes  
**Risk Level:** 🟢 Low (workaround approach) | **Estimated Time:** 15-20 minutes

**Current Problem:**
```typescript
// Arrays can get misaligned, causing render and undo/redo issues
paths: [user1, user2, aiIncremental, aiFinal]    // 4 items
strokes: [user1, user2, aiFinal]                 // 3 items
```

**Implementation Plan (Defensive Programming):**
```typescript
// Step 1: Improve render fallback
{paths.map((path, index) => {
  const matchingStroke = strokes.find(stroke => stroke.path === path);
  
  // ✅ Enhanced fallback strategy
  const strokeColor = matchingStroke?.color || 
                     strokes[index]?.color ||     // Try index-based lookup
                     strokes[strokes.length - 1]?.color || // Try last stroke
                     selectedColor ||              // Current selection
                     '#000000';                   // Final fallback
  
  return <Path key={index} path={path} color={strokeColor} ... />;
})}

// Step 2: Defensive undo/redo
const undo = () => {
  if (!canUndo()) return;
  const last = undoStack.current.pop()!;
  
  // ✅ Ensure arrays stay synchronized
  setStrokes(prev => {
    const newStrokes = prev.slice(0, -1);
    // Verify paths array has same length or adjust
    setPaths(currentPaths => {
      if (currentPaths.length > newStrokes.length) {
        return currentPaths.slice(0, newStrokes.length);
      }
      return currentPaths;
    });
    return newStrokes;
  });
};
```

**Note:** This is a **defensive workaround** that maintains UX while avoiding architectural changes. The real-time streaming experience is preserved.

### 🎯 **Deployment Strategy**

**Recommended Approach:**
1. **Phase 1 ONLY** initially - fixes the most critical issue
2. **Test thoroughly** with AI calls - verify clean command history
3. **Phase 2** if Phase 1 succeeds - improves streaming UX
4. **Phase 3** optional - only if undo/redo issues become problematic

**Safety Notes:**
- Each phase can be **independently reverted**
- Core drawing functionality remains **untouched**
- Real-time AI streaming UX is **preserved throughout**
- User experience for drawing (no AI) remains **perfect**

### ✅ **Risk Assessment Confirmed**
You're correct that **Phase 3 primarily affects undo/redo reliability** for AI strokes. Since:
- User stroke undo/redo works perfectly
- Drawing functionality is solid
- AI streaming UX is maintained with Phase 2 fix

**Phase 3 can definitely be deferred** without significant impact on core functionality.

Add any new findings below this line.

---

Feel free to append new observations in the same table format. 