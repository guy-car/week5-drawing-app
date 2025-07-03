# Detailed Action Plan – "Riff on whatever the user just sketched" (07-02-25)

## Overall goal  
Deliver a fast (< 3 s-to-first-stroke) AI-assist feature that:
1. Captures a light-weight representation of the current canvas (small JPEG + vector summary).  
2. Sends **one** streaming OpenAI request that returns both analysis and new drawing commands.  
3. Parses the stream incrementally and animates strokes in real time.  

---

## Actions & Pseudocode


### 1  Light-weight canvas snapshot  
*File(s):* `components/DrawingCanvas.tsx`

1.1 Extend export utility  
```ts
// NEW overloaded signature
exportCanvas(opts?: { resize?: number; format?: 'png'|'jpeg'; quality?: number }): Promise<string | null>;
```

1.2 Implementation sketch  
```ts
const exportCanvas = async ({resize = 256, format='jpeg', quality=0.6} = {}) => {
  const img = canvasRef.current.makeImageSnapshot();
  const scaled = img.scaleTo(resize / BASE_CANVAS_SIZE);   // ← Skia helper
  const bytes  = scaled.encodeToBytes(format.toUpperCase(), quality * 100); // 0–100 quality
  return `data:image/${format};base64,` + base64FromBytes(bytes);
};
```
*Outcome:* ~40 kB payload instead of 1–2 MB PNG.

---

### 2  Generate vector-style summary  
*File(s):*  `src/utils/vectorSummary.ts` (new)   & `DrawingCanvas.tsx`

2.1 Utility  
```ts
export interface VectorSummary {
  commandCount: number;
  bbox: { minX:number; minY:number; maxX:number; maxY:number };
  avgSegment: number;
  dominantAngles: number[];    // top 3 in degrees
  shapeHistogram: Record<string, number>;
}

export const vectorSummary = (cmds: DrawingCommand[]): VectorSummary => {
  // iterate → compute bbox, lengths, angles, counts …
};
```

2.2 Collect before API call  
```ts
const { image, commands } = await exportCanvasWithCommands();
const summary = vectorSummary(commands);
proceedRiff({ image, summary });
```

---

### 3  Single-pass, streaming OpenAI call  
*File(s):* `src/api/openai/riffOnSketch.ts` (new)

3.1 Request body (truncated)  
```ts
const body = {
  model: 'gpt-4o',
  stream: true,
  response_format: { type: 'json_schema', json_schema: DrawingCommandsSchema },
  messages: [{
    role: 'user',
    content: [
      { type: 'text', text: PROMPT.replace('{{summary}}', JSON.stringify(summary, null, 2)) },
      { type: 'image_url', image_url: { url: image } }
    ]
  }]
};
fetch(BASE_URL, { method:'POST', headers:HEADERS, body:JSON.stringify(body) });
```

3.2 Prompt skeleton  
```
Return JSON **in this exact order**:
{
  "analysis": { /* vision + style */ },
  "commands": [ /* 3–20 new commands */ ]
}
```

---

### 4  Incremental SSE / JSON parser  
*File(s):* `src/utils/streamJsonParser.ts`

4.1 Pseudo-state machine  
```ts
export const streamParser = (onCommand: (cmd:DrawingCommand)=>void) => {
  let buffer = '';
  let depth = 0;
  return chunk => {
    buffer += chunk;
    for (let i=0;i<buffer.length;i++){
      const ch = buffer[i];
      if (ch === '{') depth++;
      if (ch === '}') depth--;
      if (depth === 0 && ch === '}'){           // one JSON object complete
        const obj = JSON.parse(buffer.slice(0, i+1));
        if (obj.type) onCommand(obj);
        buffer = buffer.slice(i+1);
        i = -1;
      }
    }
  };
};
```

4.2 Attach to fetch  
```ts
for await (const chunk of resp.body) {
  parser(chunk.toString('utf8'));
}
```

---

### 5  Real-time drawing animation  
*File(s):* `components/DrawingCanvas.tsx`

5.1 API  
```ts
addAICommandIncremental = (cmd: DrawingCommand) => {
  addCommandToPath(cmd);                 // existing switch logic
  requestAnimationFrame(() => redraw()); // 16 ms frame
};
```

5.2 Driver  
```ts
riffOnSketch(summary, image, cmd => {
  setTimeout(() => addAICommandIncremental(cmd), index * 40); // 25 fps draw-in
});
```

---

### 6  Update command schema & validation  
*File(s):* `src/api/openai/types.ts`

```ts
export const commandSchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('addRect'), x:z.number(), y:z.number(), width:z.number(), height:z.number() }),
  // … addOval, addArc, addRoundRect …
  EXISTING_SCHEMAS
]);
```
Call `zodToJsonSchema(commandSchema)` for the `response_format`.

---

### 7  Prompt template constants  
*File(s):* `src/api/openai/prompts.ts` (new)

Include examples, style rules, and explicit ordering note:
> "Key order MUST be `analysis` then `commands`; do not emit the closing bracket of `analysis` until it is fully populated."

---

### 8  Fallback for non-stream environments  
*File(s):* `riffOnSketch.ts`

```ts
const supportsStream = !Platform.OS.startsWith('web') || fetchSupportsStream();
if (!supportsStream) delete body.stream;   // legacy blocking mode
```

On completion parse JSON once and call `addAIPath`.

---

### 9  README & Dev Docs  
*File(s):* `README.md`

Add:
* env var `EXPO_PUBLIC_OPENAI_API_KEY`  
* new architecture diagram  
* Troubleshooting (`stream:true` behind corporate proxy, etc.)

---

### 10  Performance instrumentation  
*File(s):* `components/DrawingCanvas.tsx`, `riffOnSketch.ts`

```ts
const stamp = label => console.timeStamp ? console.timeStamp(label) : console.log(label);
stamp('tap');
… exportCanvas …
stamp('img-ready');
… first SSE chunk …
stamp('first-chunk');
… first stroke drawn …
stamp('first-stroke');
… last stroke …
stamp('done');
```
Analyze with React-Native perf tools; adjust JPEG size/quality or animation delay to hit the < 3 s KPI.

---

> **Next agent:** implement steps in order; run perf log after step 5 to ensure latency target is met before continuing to refactors.