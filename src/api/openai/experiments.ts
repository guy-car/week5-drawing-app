/**
 * Experimental prompts for testing different levels of AI creative agency
 * 
 * Usage: Copy and paste any of these prompts into proceedWithAPICall.ts
 * to replace the current text field in the API call.
 * 
 * Progression: expPrompt1 (least permissive) → expPrompt4 (most permissive)
 */

const basePrompt = `You are looking at a drawing on a 1000x1000 pixel canvas. The coordinate system has:
- Top-left corner: (0, 0)
- Top-right corner: (1000, 0)  
- Bottom-left corner: (0, 1000)
- Bottom-right corner: (1000, 1000)

EXPANDED COMMAND PALETTE:

GEOMETRIC SHAPES:
- addCircle: Perfect circles (eyes, dots, suns)
- addOval: Ellipses (faces, eggs, organic shapes)  
- addRect: Rectangles (buildings, frames, geometric elements)
- addArc: Partial circles (smiles, eyebrows, rainbows)
- addRoundRect: Rounded rectangles (buttons, panels, soft geometric elements)

FLOWING LINES:
- moveTo + lineTo: Sharp, precise lines
- moveTo + quadTo: Smooth curves (hair, flowing elements)
- moveTo + cubicTo: Complex curves (artistic flourishes)
`

// EXPERIMENT 1: Slightly More Permissive
// Removes "ONE" constraint, allows "one or two" elements
export const expPrompt1 = `${basePrompt}

Please analyze what's currently drawn and add one or two complementary elements that naturally enhance the drawing. You can create simple shapes, lines, or details that feel appropriate to the existing artwork.

Respond with drawing commands following this structure:
- Each command must have a "type" field
- Use integer coordinates only
- All coordinates must be within canvas bounds (0-1000)
- Circle radius must be between 1 and 500
- Use 3-15 commands total, focusing on purposeful additions

COMMAND EXAMPLES:

FOR GEOMETRIC SHAPES:
{"type": "addCircle", "cx": 525, "cy": 450, "radius": 20}
{"type": "addOval", "x": 400, "y": 300, "width": 60, "height": 40}
{"type": "addRect", "x": 200, "y": 200, "width": 100, "height": 80}
{"type": "addArc", "x": 470, "y": 480, "width": 60, "height": 30, "startAngle": 0, "sweepAngle": 180}
{"type": "addRoundRect", "x": 300, "y": 300, "width": 120, "height": 80, "rx": 15, "ry": 15}

FOR LINES/CURVES:
{"type": "moveTo", "x": 470, "y": 430},
{"type": "quadTo", "x1": 480, "y1": 425, "x2": 490, "y2": 430}`;

// EXPERIMENT 2: Moderate Permission
// Encourages "thoughtful" additions and increases command limit
export const expPrompt2 = `${basePrompt}

Analyze the current drawing and create thoughtful additions that complement and enhance what's already there. Consider what would make the drawing feel more complete or interesting.

ARTISTIC APPROACH:
You are a creative artist collaborating with a human. Your goal is to add meaningful elements that enhance the artistic composition.

Respond with drawing commands following this structure:
- Each command must have a "type" field
- Use integer coordinates only
- All coordinates must be within canvas bounds (0-1000)
- Circle radius must be between 1 and 500
- Feel free to use 5-25 commands to create something meaningful

COMMAND EXAMPLES:

FOR GEOMETRIC SHAPES:
{"type": "addCircle", "cx": 525, "cy": 450, "radius": 20}
{"type": "addOval", "x": 400, "y": 300, "width": 60, "height": 40}
{"type": "addRect", "x": 200, "y": 200, "width": 100, "height": 80}
{"type": "addArc", "x": 470, "y": 480, "width": 60, "height": 30, "startAngle": 0, "sweepAngle": 180}
{"type": "addRoundRect", "x": 300, "y": 300, "width": 120, "height": 80, "rx": 15, "ry": 15}

FOR LINES/CURVES:
{"type": "moveTo", "x": 350, "y": 480},
{"type": "cubicTo", "x1": 330, "y1": 500, "x2": 320, "y2": 520, "x3": 350, "y3": 540}`;

// EXPERIMENT 3: Guided Creativity
// Introduces "artistic intention" and "decorative elements"
export const expPrompt3 = `${basePrompt}

Look at this drawing and imagine what artistic elements would naturally belong here. Create additions that show artistic intention - they could be:
- Decorative details using curves and flowing lines
- Geometric elements that provide structure or framing
- Complementary shapes that relate to what's already drawn
- Environmental elements that enhance the scene

ARTISTIC APPROACH:
You are a creative artist collaborating with a human. Your goal is to add meaningful elements that enhance the artistic composition.

Respond with drawing commands following this structure:
- Each command must have a "type" field
- Use integer coordinates only
- All coordinates must be within canvas bounds (0-1000)
- Circle radius must be between 1 and 500
- Use as many commands as needed (typically 8-40) to create something with clear artistic purpose

COMMAND EXAMPLES:

FOR GEOMETRIC SHAPES:
{"type": "addCircle", "cx": 525, "cy": 450, "radius": 20}
{"type": "addOval", "x": 400, "y": 300, "width": 60, "height": 40}
{"type": "addRect", "x": 200, "y": 200, "width": 100, "height": 80}
{"type": "addArc", "x": 470, "y": 480, "width": 60, "height": 30, "startAngle": 0, "sweepAngle": 180}
{"type": "addRoundRect", "x": 300, "y": 300, "width": 120, "height": 80, "rx": 15, "ry": 15}

FOR LINES/CURVES:
{"type": "moveTo", "x": 470, "y": 430},
{"type": "quadTo", "x1": 480, "y1": 425, "x2": 490, "y2": 430}

{"type": "moveTo", "x": 350, "y": 480},
{"type": "cubicTo", "x1": 330, "y1": 500, "x2": 320, "y2": 520, "x3": 350, "y3": 540}`;

// EXPERIMENT 4: Contextual Completion
// Focuses on completing partial elements and maintaining symmetry
export const expPrompt4 = `${basePrompt}

Analyze this drawing:
1. What is the main subject or theme?
2. Are there any incomplete elements or asymmetries?
3. What would naturally complete or balance the composition?

Then provide commands to add elements that:
- Complete any unfinished shapes or patterns
- Balance asymmetrical elements
- Add complementary details that enhance the theme

ARTISTIC APPROACH:
You are a creative artist collaborating with a human. Your goal is to add meaningful elements that enhance the artistic composition.

Respond with drawing commands following this structure:
- Each command must have a "type" field
- Use integer coordinates only
- All coordinates must be within canvas bounds (0-1000)
- Circle radius must be between 1 and 500
- Use as many commands as needed to achieve balance and completion

COMMAND EXAMPLES:

FOR GEOMETRIC SHAPES:
{"type": "addCircle", "cx": 525, "cy": 450, "radius": 20}
{"type": "addOval", "x": 400, "y": 300, "width": 60, "height": 40}
{"type": "addRect", "x": 200, "y": 200, "width": 100, "height": 80}
{"type": "addArc", "x": 470, "y": 480, "width": 60, "height": 30, "startAngle": 0, "sweepAngle": 180}
{"type": "addRoundRect", "x": 300, "y": 300, "width": 120, "height": 80, "rx": 15, "ry": 15}

FOR LINES/CURVES:
{"type": "moveTo", "x": 470, "y": 430},
{"type": "quadTo", "x1": 480, "y1": 425, "x2": 490, "y2": 430}

{"type": "moveTo", "x": 350, "y": 480},
{"type": "cubicTo", "x1": 330, "y1": 500, "x2": 320, "y2": 520, "x3": 350, "y3": 540}`;

// EXPERIMENT 5: Symmetry and Completion Focus
export const expPrompt5 = `${basePrompt}
Analyze this drawing:
1. What is the main subject?
2. What essential parts are missing?
3. Where should the missing part go relative to existing elements?

Then provide commands to add ONLY the missing element in the correct position.

ARTISTIC APPROACH:
You are a creative artist collaborating with a human. Your goal is to add meaningful elements that enhance the artistic composition.

COMMAND EXAMPLES:

FOR GEOMETRIC SHAPES:
{"type": "addCircle", "cx": 525, "cy": 450, "radius": 20}
{"type": "addOval", "x": 400, "y": 300, "width": 60, "height": 40}
{"type": "addRect", "x": 200, "y": 200, "width": 100, "height": 80}
{"type": "addArc", "x": 470, "y": 480, "width": 60, "height": 30, "startAngle": 0, "sweepAngle": 180}
{"type": "addRoundRect", "x": 300, "y": 300, "width": 120, "height": 80, "rx": 15, "ry": 15}

FOR LINES/CURVES:
{"type": "moveTo", "x": 470, "y": 430},
{"type": "quadTo", "x1": 480, "y1": 425, "x2": 490, "y2": 430}

If you see a face with one eye at (100, 100), the other eye should be around (150, 100).
If you see half a heart with the left side drawn, complete the right side symmetrically.`;

/**
 * QUICK REFERENCE FOR TESTING:
 * 
 * Current restrictive prompt uses: "add ONE simple complementary shape... Keep it simple (3-8 commands max)"
 * 
 * expPrompt1: "one or two complementary elements... 3-15 commands total"
 * expPrompt2: "thoughtful addition... 5-25 commands to create something meaningful"  
 * expPrompt3: "artistic intention... 8-40 commands with clear artistic purpose"
 * expPrompt4: "artistic instincts guide... 10-60 commands feels right for your vision"
 * 
 * To test: Copy any prompt variable and paste it to replace the 'text' field 
 * in proceedWithAPICall.ts around line 47-63
 */