# OpenAI-Skia Coordinate Validation Fix Action Plan

## Overall Goal

Fix the downstream coordinate validation issue where OpenAI's structured output format doesn't properly align with Skia's Path API requirements, causing command processing failures and incomplete rendering of AI-generated drawing commands.

## Actions to Take

### Phase 1: Schema Alignment and Unification

1. **Update schema format in types.ts to match working OpenAI output**
   - Files to alter: `src/api/openai/types.ts`
   - Change from tuple-based schemas `{moveTo: [x, y]}` to object-based `{type: "moveTo", x: number, y: number}`
   - Add comprehensive TypeScript types for all command variants
   - Export unified schemas for reuse across the application

2. **Remove duplicate schema definition in drawingCommands.ts**
   - Files to alter: `src/api/openai/drawingCommands.ts`
   - Remove the local `openAICommandSchema` definition
   - Import and use the unified `commandSchema` from types.ts
   - Update the JSON schema generation to use the unified schema

### Phase 2: Enhanced Command Processing

3. **Expand addAIPath function to handle all Skia command types**
   - Files to alter: `components/DrawingCanvas.tsx`
   - Update interface definition for `DrawingCanvasRef.addAIPath` to accept all command types
   - Add support for `quadTo`, `cubicTo`, and `addCircle` commands beyond current `moveTo`/`lineTo`
   - Implement proper coordinate validation and clamping for each command type

4. **Add direct Skia API transformation layer**
   - Files to alter: `components/DrawingCanvas.tsx`
   - Ensure each OpenAI command maps correctly to Skia Path API calls:
     - `{type: "moveTo", x, y}` → `path.moveTo(x, y)`
     - `{type: "addCircle", cx, cy, radius}` → `path.addCircle(cx, cy, radius)`
     - `{type: "quadTo", x1, y1, x2, y2}` → `path.quadTo(x1, y1, x2, y2)`
     - `{type: "cubicTo", x1, y1, x2, y2, x3, y3}` → `path.cubicTo(x1, y1, x2, y2, x3, y3)`

### Phase 3: Validation and Error Handling

5. **Implement comprehensive command validation**
   - Files to alter: `src/api/openai/drawingCommands.ts`
   - Add validation for each command using the unified schema
   - Provide detailed error messages for malformed commands
   - Add coordinate bounds checking and validation

6. **Enhanced error handling and logging**
   - Files to alter: `components/DrawingCanvas.tsx`, `src/api/openai/drawingCommands.ts`
   - Add detailed console logging for each command processing step
   - Implement graceful error handling for missing or invalid parameters
   - Add coordinate clamping with warning logs for out-of-bounds values

### Phase 4: Testing and Verification

7. **Test the complete pipeline**
   - Files to alter: None (testing phase)
   - Verify OpenAI API → schema validation → Skia rendering pipeline
   - Test all command types (moveTo, lineTo, quadTo, cubicTo, addCircle)
   - Validate coordinate transformation and bounds checking

8. **Update chat report with resolution**
   - Files to alter: `.cursor-reports/chat-reports/07-01-25-openai-structured-output-debugging.md`
   - Document the final resolution and successful integration
   - Update the "Current Status" section to reflect completion

## Success Criteria

- ✅ OpenAI structured output validates successfully against unified schema
- ✅ All 5 command types (moveTo, lineTo, quadTo, cubicTo, addCircle) render correctly
- ✅ Coordinate validation and transformation works seamlessly
- ✅ No downstream validation errors in the processing pipeline
- ✅ Comprehensive error handling and logging in place
- ✅ Complete integration test passes from API call to canvas rendering

## Priority

**High Priority** - This fix resolves the core integration issue preventing proper AI-generated drawing command rendering on the Skia canvas. 