# AI Vision Debugging Implementation - January 25, 2024

## Original Request / Feature
The goal was to troubleshoot and understand why the AI-generated Skia commands don't match the user's drawings. For example, when a user draws a stick figure, the AI generates commands for a random straight line near the canvas border. We needed to implement debugging tools to:

1. Understand how the AI perceives and processes the image
2. Determine if the issue is with AI vision processing or command generation
3. Add comprehensive debugging capabilities to the drawing canvas integration

## Challenges
1. **Coordinate System Mismatch**: The 1000x1000 canvas coordinate system wasn't clearly communicated to the AI
2. **Vague AI Prompts**: The original prompt lacked context about canvas dimensions and coordinate expectations
3. **No Visibility into AI Perception**: Couldn't see what the AI was actually "seeing" or interpreting
4. **Lack of Coordinate Validation**: AI responses could contain out-of-bounds coordinates
5. **No Visual Debugging Tools**: No way to visualize the coordinate system for troubleshooting

## Successes
1. **Enhanced AI Prompt**: Created a detailed prompt with explicit coordinate system documentation
2. **AI Vision Debug Function**: Implemented a separate function to see exactly what the AI perceives
3. **Coordinate Validation**: Added comprehensive validation with logging for out-of-bounds coordinates
4. **Debug Grid System**: Implemented visual grid overlay to understand coordinate mapping
5. **Improved UI**: Created a clean 3-button layout for testing, debugging, and grid visualization
6. **Comprehensive Logging**: Added detailed console logging throughout the debugging pipeline

## Methods That Did Not Work
1. **Basic prompting without context**: The original vague prompt didn't provide enough coordinate system information
2. **Assuming coordinate accuracy**: Not validating AI-generated coordinates led to rendering issues
3. **No intermediate analysis**: Going directly from image to commands without understanding AI perception

## Methods That Did Work
1. **Detailed Coordinate Context**: Providing explicit canvas dimensions and coordinate system details in the prompt
2. **Separate Vision Analysis**: Creating a debug function that asks AI to describe what it sees before generating commands
3. **Coordinate Clamping and Validation**: Implementing bounds checking with detailed logging
4. **Visual Debug Tools**: Adding a grid overlay to visualize the coordinate system
5. **Structured Debugging Approach**: Creating separate functions for different types of debugging

## Codebase Changes

### DrawingCanvas.tsx
1. **Enhanced addAIPath method** with coordinate validation:
```typescript
// Pseudocode for coordinate validation
const validatedCommands = commands.map((command, index) => {
  const x = Math.max(0, Math.min(1000, command.x));
  const y = Math.max(0, Math.min(1000, command.y));
  
  if (x !== command.x || y !== command.y) {
    console.warn(`Command ${index}: Clamped coordinates`);
  }
  
  console.log(`Command ${index}: ${command.type} to (${x}, ${y})`);
  return { ...command, x, y };
});
```

2. **Added debug grid functionality**:
```typescript
const addDebugGrid = () => {
  const gridPath = Skia.Path.Make();
  // Add grid lines every 100 pixels
  for (let i = 0; i <= 1000; i += 100) {
    // Vertical and horizontal lines
    gridPath.moveTo(i, 0); gridPath.lineTo(i, 1000);
    gridPath.moveTo(0, i); gridPath.lineTo(1000, i);
  }
  setPaths(prevPaths => [...prevPaths, gridPath]);
};
```

3. **Updated interface** to include new debug method

### App.tsx
1. **Enhanced AI Integration Prompt**:
   - Added explicit 1000x1000 canvas documentation
   - Specified coordinate system with corner examples
   - Added constraints for coordinate ranges and command counts

2. **New Debug AI Vision Function**:
```typescript
// Pseudocode for vision debugging
const debugAIVision = async () => {
  // Export canvas image
  // Send to AI with descriptive prompt asking what it sees
  // Display AI's interpretation in an alert
  // Log detailed analysis to console
};
```

3. **Enhanced UI Layout**:
   - Created 3-button horizontal layout
   - Debug Vision button (blue)
   - Grid button (purple) 
   - AI Test button (green)
   - Added responsive flex styling

## Next Steps for Testing
1. **Test Vision Analysis**: Use "Debug Vision" to see what AI perceives in your stick figure
2. **Use Grid Overlay**: Enable grid to understand coordinate mapping
3. **Monitor Console Logs**: Check for coordinate clamping warnings
4. **Iterate Prompts**: Adjust AI prompts based on vision analysis results
5. **Test Edge Cases**: Try drawings in different areas of the canvas

## Debugging Workflow
1. Draw something (like your stick figure)
2. Click "Debug Vision" to see AI's interpretation
3. Click "Grid" to visualize coordinate system
4. Click "AI Test" to see generated commands
5. Check console for coordinate validation logs
6. Iterate based on findings

This implementation provides a comprehensive debugging pipeline to identify whether issues stem from AI vision processing or coordinate system mismatches. 