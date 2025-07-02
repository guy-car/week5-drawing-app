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
`

// EXPERIMENT 1: Slightly More Permissive
// Removes "ONE" constraint, allows "one or two" elements
export const expPrompt1 = `${basePrompt}

Please analyze what's currently drawn and add one or two complementary elements that naturally enhance the drawing. You can create simple shapes, lines, or details that feel appropriate to the existing artwork.

Respond with drawing commands following this structure:
- Each command must have a "type" field
- Use integer coordinates only
- Available command types: moveTo, lineTo, quadTo, cubicTo, addCircle
- ALL coordinates must be within canvas bounds (0-1000 for both x and y)
- Circle radius must be between 1 and 500
- Use 3-15 commands total, focusing on purposeful additions

Examples:
For a circle: {"type": "addCircle", "cx": 500, "cy": 500, "radius": 100}
For lines: {"type": "moveTo", "x": 100, "y": 100}, {"type": "lineTo", "x": 200, "y": 200}`;

// EXPERIMENT 2: Moderate Permission
// Encourages "thoughtful" additions and increases command limit
export const expPrompt2 = `${basePrompt}

Analyze the current drawing and create a thoughtful addition that complements and enhances what's already there. Consider what would make the drawing feel more complete or interesting.

Respond with drawing commands following this structure:
- Each command must have a "type" field
- Use integer coordinates only
- Available command types: moveTo, lineTo, quadTo, cubicTo, addCircle
- ALL coordinates must be within canvas bounds (0-1000 for both x and y)
- Circle radius must be between 1 and 500
- Feel free to use 5-25 commands to create something meaningful

Examples:
For a circle: {"type": "addCircle", "cx": 500, "cy": 500, "radius": 100}
For lines: {"type": "moveTo", "x": 100, "y": 100}, {"type": "lineTo", "x": 200, "y": 200}`;

// EXPERIMENT 3: Guided Creativity
// Introduces "artistic intention" and "decorative elements"
export const expPrompt3 = `${basePrompt}

Look at this drawing and imagine what artistic element would naturally belong here. Create an addition that shows artistic intention - it could be decorative details, environmental elements, or complementary shapes that relate to what's already drawn.

Respond with drawing commands following this structure:
- Each command must have a "type" field
- Use integer coordinates only
- Available command types: moveTo, lineTo, quadTo, cubicTo, addCircle
- ALL coordinates must be within canvas bounds (0-1000 for both x and y)
- Circle radius must be between 1 and 500
- Use as many commands as needed (typically 8-40) to create something with clear artistic purpose

Examples:
For a circle: {"type": "addCircle", "cx": 500, "cy": 500, "radius": 100}
For lines: {"type": "moveTo", "x": 100, "y": 100}, {"type": "lineTo", "x": 200, "y": 200}`;

// EXPERIMENT 4: Contextual Freedom
// Maximum creative freedom while maintaining technical constraints
export const expPrompt4 = `${basePrompt}

Analyze this artwork and create an addition that demonstrates understanding of artistic composition. What would make this drawing feel more balanced, complete, or visually interesting? Let your artistic instincts guide the creation.

Respond with drawing commands following this structure:
- Each command must have a "type" field
- Use integer coordinates only
- Available command types: moveTo, lineTo, quadTo, cubicTo, addCircle
- ALL coordinates must be within canvas bounds (0-1000 for both x and y)
- Circle radius must be between 1 and 500
- Create detailed work using whatever number of commands feels right for your artistic vision (usually 10-60 commands)

Examples:
For a circle: {"type": "addCircle", "cx": 500, "cy": 500, "radius": 100}
For lines: {"type": "moveTo", "x": 100, "y": 100}, {"type": "lineTo", "x": 200, "y": 200}`;

export const expPrompt5 = `${basePrompt}
Analyze this drawing:
1. What is the main subject?
2. What essential parts are missing?
3. Where should the missing part go relative to existing elements?

Then provide commands to add ONLY the missing element in the correct position.

If you see a face with one eye at (100, 100), the other eye should be around (150, 100).
If you see half a heart with the left side drawn, complete the right side symmetrically.
`

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