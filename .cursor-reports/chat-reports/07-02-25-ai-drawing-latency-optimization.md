# AI Drawing Latency Optimization (07-02-25)

## Original Request / Feature
Improve the AI drawing feature to:
1. Reduce latency from 5-10s to 2-3s from click to first stroke
2. Enable more creative "riffing" on user's abstract drawings
3. Maintain or enhance the quality of style-matching and contextual additions

## Challenges
- Current two-pass approach (analysis then commands) adds significant latency
- Large PNG payloads (1-2MB) being sent twice
- Non-streaming responses mean waiting for complete generation
- Need to preserve creative quality while optimizing speed
- Abstract drawings require better style inference than just object detection

## Successes
- Identified major latency bottlenecks in current pipeline
- Designed single-pass streaming architecture that can hit 2-3s target
- Found way to maintain rich context while reducing payload size by ~96%
- Developed incremental parsing approach that enables real-time animation
- Created detailed implementation plan with fallbacks for different environments

## Methods Used That Did Not Work
- Current approach:
  - Two separate API calls with full PNG payload each time
  - Waiting for complete response before starting to draw
  - Treating analysis and command generation as separate steps

## Methods Used That Will Work
1. Light-weight representation:
   - 256×256 JPEG (~40kB) instead of 1000×1000 PNG
   - Computed vector summary (bbox, angles, etc.) instead of raw command list

2. Single streaming request:
   - One API call with both analysis and commands
   - Server-sent events for token-by-token processing
   - Start drawing as soon as first command arrives

3. Real-time animation:
   - Incremental JSON parsing
   - Command-by-command rendering with slight delays
   - Progressive reveal of AI additions

## Implementation Plan Overview
1. Canvas snapshot optimization
   ```ts
   exportCanvas({ resize: 256, format: 'jpeg', quality: 0.6 })
   ```

2. Vector summary generation
   ```ts
   interface VectorSummary {
     commandCount: number;
     bbox: { minX, minY, maxX, maxY };
     avgSegment: number;
     dominantAngles: number[];
     shapeHistogram: Record<string, number>;
   }
   ```

3. Streaming OpenAI integration
   ```ts
   {
     model: 'gpt-4o',
     stream: true,
     messages: [{
       content: [
         { type: 'text', text: prompt },
         { type: 'image_url', image_url: { url: jpegData }}
       ]
     }]
   }
   ```

4. Real-time rendering
   ```ts
   for await (const chunk of resp.body) {
     parser(chunk);
     if (command = parser.nextCommand()) {
       setTimeout(() => addAICommandIncremental(command), 
         index * 40); // 25fps animation
     }
   }
   ```

## Expected Performance Profile
- Click to first API response: ~1.8s
- First stroke on screen: ~2.0s
- Complete drawing finished: ~2.8s
- Network overhead: ~0.3s (40kB JPEG)

This represents a significant improvement over the current 5-10s latency while maintaining or enhancing the creative quality of the AI's contributions. 