# Enhance AI Drawing Commands - Action Plan

## Overall Goal
Improve the AI's drawing capabilities by expanding its available Skia commands and refining the prompt engineering to generate more natural and expressive drawings.

## Action Items

### 1. Expand Skia Command Types
**Files to modify:** `src/api/openai/types.ts`
- Add new Skia-compatible command types:
  - `addRect` for rectangular shapes
  - `addOval` for oval/elliptical shapes
  - `addArc` for curved segments
  - `addRoundRect` for rounded rectangles
  - Update the command union type to include new commands
  - Add appropriate zod validation schemas for each new command

### 2. Update Drawing Canvas Implementation
**Files to modify:** `components/DrawingCanvas.tsx`
- Implement handlers for new command types
- Add support for rendering:
  - Rectangles with `addRect`
  - Ovals with `addOval`
  - Arcs with `addArc`
  - Rounded rectangles with `addRoundRect`

### 3. Enhance Prompt Engineering
**Files to modify:** `src/api/openai/drawingCommands.ts`
- Update system prompt to:
  - Introduce the new command types
  - Provide examples of when to use each command type
  - Add guidelines for natural shape composition
  - Include context about command combinations for complex shapes

Here's how I'd improve the current prompt in proceedWithAPICall.ts:
const enhancedPrompt = `
Based on your previous context-aware analysis:

"${analysis}"

Now generate ONLY the NEW elements you want to add (do not redraw existing shapes).

ARTISTIC APPROACH:
You are a creative artist collaborating with a human. Your goal is to add ONE meaningful element that enhances the artistic composition.

EXPANDED COMMAND PALETTE:
You now have these expressive tools:

GEOMETRIC SHAPES:
- addCircle: Perfect circles (eyes, dots, suns)
- addOval: Ellipses (faces, eggs, organic shapes)  
- addRect: Rectangles (buildings, frames, geometric elements)
- addArc: Partial circles (smiles, eyebrows, rainbows)

FLOWING LINES:
- moveTo + lineTo: Sharp, precise lines
- moveTo + quadTo: Smooth curves (hair, flowing elements)
- moveTo + cubicTo: Complex curves (artistic flourishes)

COMPLEX SHAPES:
- pathFromSVG: Any shape you can imagine using SVG syntax

STYLE MATCHING RULES:
1. SCALE: User draws around coordinates ${getCoordinateRange(existingCommands)}
2. STYLE: ${analyzeDrawingStyle(existingCommands)}
3. ENERGY: ${analyzeDrawingEnergy(existingCommands)}

CREATIVE GUIDELINES:
- If the drawing feels geometric, add geometric elements
- If it feels organic, use curves and flowing lines
- If it's sketchy, embrace imperfection
- If it's precise, match that precision
- Consider negative space and composition balance

ENHANCED EXAMPLES:

For a smile: 
{"type": "addArc", "x": 470, "y": 480, "width": 60, "height": 30, "startAngle": 0, "sweepAngle": 180}

For flowing hair:
{"type": "moveTo", "x": 400, "y": 300},
{"type": "cubicTo", "x1": 350, "y1": 280, "x2": 320, "y2": 320, "x3": 340, "y3": 360}

For a complex shape using SVG:
{"type": "pathFromSVG", "svgPath": "M 450 420 Q 500 380 550 420 T 600 450"}

CREATIVE FREEDOM:
- Generate 3-20 commands based on what feels right artistically
- Focus on enhancing the overall composition
- Consider what would make a human smile when they see it
- Trust your artistic instincts while respecting the user's style

Create something that feels like a natural continuation of the user's artistic vision.
`;

Improved Constraints
Instead of rigid constraints, use guiding principles:
const creativityConstraints = {
  // Instead of "3-15 commands max"
  commandGuidance: "Use as many commands as needed to express your artistic vision (typically 3-20)",
  
  // Instead of rigid coordinate bounds  
  spatialGuidance: "Respect the canvas bounds while embracing the full space creatively",
  
  // Instead of limiting creativity
  styleGuidance: "Match the user's artistic energy while adding your own creative flair",
  
  // Add positive encouragement
  encouragement: "Be bold, be creative, surprise and delight the user"
};



### 4. Refine Command Generation Context
**Files to modify:** `src/api/openai/proceedWithAPICall.ts`
- Update the command generation context to:
  - Include examples of the new command types
  - Add guidance on command selection based on drawing intent
  - Enhance the response format to support new commands

### 5. Testing and Validation
**Files to modify:** No file changes, but test with:
- Simple geometric shapes using new commands
- Complex drawings combining multiple command types
- Edge cases for each new command type
- Verify proper coordinate handling
- Check command sequence optimization

### 6. Documentation Updates
**Files to modify:** `README.md`, `NOTES.MD`
- Document new command types
- Add examples of command usage
- Update API reference
- Include best practices for command combinations 