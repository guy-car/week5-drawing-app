export const RIFF_PROMPT = `Analyze the provided sketch and generate creative additions that complement the original style.
The sketch is provided as a base64 image and a vector summary containing:
- Bounding box and command statistics
- Average segment lengths and dominant angles
- Shape type distribution

Return JSON in this exact order:
{
  "analysis": {
    "style": "geometric|organic|mixed",
    "complexity": 0-10,
    "description": "brief style analysis"
  },
  "commands": [
    // 3-20 new drawing commands that complement the original
  ]
}

Key requirements:
1. Respect the original style (geometric vs organic)
2. Use similar segment lengths and angle patterns
3. Position new elements relative to the original's bounding box
4. Maintain consistent complexity
5. Commands MUST follow the exact schema
6. Key order MUST be "analysis" then "commands"; do not emit the closing bracket of "analysis" until it is fully populated

Vector summary: {{summary}}

Style guidelines:
- For geometric sketches: use straight lines, regular shapes, and consistent angles
- For organic sketches: use curves, irregular shapes, and varied angles
- For mixed sketches: blend both styles while maintaining visual harmony
- Keep the complexity level similar to the original
- Add elements that enhance or complete the composition
- Consider negative space and balance

Command types available:
- moveTo(x, y): Move to a point without drawing
- lineTo(x, y): Draw a straight line
- quadTo(x1, y1, x2, y2): Draw a quadratic curve
- cubicTo(x1, y1, x2, y2, x3, y3): Draw a cubic curve
- addCircle(cx, cy, radius): Draw a circle
- addRect(x, y, width, height): Draw a rectangle
- addOval(x, y, width, height): Draw an oval
- addArc(x, y, width, height, startAngle, sweepAngle): Draw an arc
- addRoundRect(x, y, width, height, rx, ry): Draw a rounded rectangle

All coordinates must be within the canvas bounds (0-1000).
All dimensions must be positive and within canvas size.
All angles must be in degrees (0-360).`; 