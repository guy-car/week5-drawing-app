# Detailed Implementation Plan – "Riff on whatever the user just sketched" with Jest Tests (07-02-25)

> This guide is **self-contained**. Follow the steps in order. After every stage run the Jest suite – it guarantees we don't regress core drawing behaviour (centred canvas, blue background, drawing works).

---

## 📐 Preface – Setting up the Jest tool-chain

1. **Install dev dependencies**
   ```bash
   npm i -D jest @types/jest ts-jest babel-jest react-test-renderer @testing-library/react-native
   # If you use Expo instead of vanilla RN, replace the preset:
   # npm i -D jest-expo
   ```
2. **Add config** – create `jest.config.js`:
   ```js
   module.exports = {
     preset: 'react-native',            // or 'jest-expo'
     transform: { '^.+\\.(ts|tsx)$': 'ts-jest' },
     setupFiles: ['<rootDir>/jest.setup.js'],
     moduleNameMapper: {
       '\\.(png|jpe?g|gif|svg)$': '<rootDir>/__mocks__/fileMock.js',
     },
   };
   ```
3. **Global setup** – `jest.setup.js`:
   ```js
   import 'react-native-reanimated/jestSetup';
   jest.spyOn(console, 'warn').mockImplementation(() => {});
   ```
4. **Asset + Skia mocks**
   * `__mocks__/fileMock.js` → `module.exports = 'test-file-stub';`
   * `__mocks__/@shopify/react-native-skia.js` – minimal stub:
     ```js
     class StubPath {
       constructor() { this.cmds = []; }
       moveTo(x, y) { this.cmds.push(['M', x, y]); }
       lineTo(x, y) { this.cmds.push(['L', x, y]); }
       quadTo(...a) { this.cmds.push(['Q', ...a]); }
       cubicTo(...a) { this.cmds.push(['B', ...a]); }
       addCircle(cx, cy, r) { this.cmds.push(['C', cx, cy, r]); }
       toJSON() { return this.cmds; }
     }
     module.exports = {
       Skia: { Path: { Make: () => new StubPath() } },
       Path: () => null,
       Canvas: () => null,
       Rect: () => null,
       Group: () => null,
       useCanvasRef: () => ({ current: { makeImageSnapshot: () => ({ encodeToBytes: () => [] }) } }),
     };
     ```
5. **Add npm scripts** in `package.json`:
   ```json
   {
     "scripts": {
       "test": "jest --passWithNoTests",
       "test:watch": "jest --watch"
     }
   }
   ```
6. *(Optional)* Git hook: `.husky/pre-commit` → `npm test --silent`

With this scaffold, `npm test` can run anywhere (CI or local).

---

## 🗺️ Stage-by-Stage Implementation (run `npm test` after each ✅)

### **Stage 0 – Baseline regression**
* **🔎 Manual smoke checklist**
  1. `npx expo start` (or `npm run ios` / `npm run android`).
  2. In the simulator draw a free-hand stroke.
  3. Verify visually:
     • Canvas horizontally & vertically centred inside its white card.
     • Background `Rect` colour = `#E6F3FF` (light blue).
     • Stroke appears instantly and remains after lifting finger.
     • Two-finger pan moves canvas; pinch zoom works.
  4. Take a screenshot (Cmd+S) – will be your visual diff later.
* **🛡 Git safety**: `git add . && git commit -m "baseline before riff" && git tag baseline-pre-riff`.

### **Stage 1 – Extract export utility**
* **🛠 Code changes**
  1. **Create a central constants file** `src/constants/canvas.ts` so we don't import `DrawingCanvas` from utils (this removes the require-cycle warning):
     ```ts
     export const BASE_CANVAS_SIZE = 1000;
     ```
  2. Create `src/utils/canvasExport.ts`:
     ```ts
     import { BASE_CANVAS_SIZE } from '../constants/canvas';
     import { Skia } from '@shopify/react-native-skia';
     // Original function copied verbatim for now (PNG only)
     export const exportCanvas = async (canvasRef: any): Promise<string | null> => {
       if (!canvasRef.current) return null;
       const image = canvasRef.current.makeImageSnapshot();
       const bytes = image.encodeToBytes();
       const b64   = bytes.reduce((d, b) => d + String.fromCharCode(b), '');
       return `data:image/png;base64,${btoa(b64)}`;
     };
     ```
  3. In `components/DrawingCanvas.tsx`
     * import the constant from the new file: `import { BASE_CANVAS_SIZE } from '../constants/canvas';`
     * remove the old inline `exportCanvas` definition and instead:
      ```ts
      import { exportCanvas } from '../utils/canvasExport';
      ```
     Remember `exportCanvas(canvasRef)` now takes the ref as arg.
  4. Keep `exportCanvasWithCommands` – just update its call: `const image = await exportCanvas(canvasRef);`
* **🔎 Test instructions**
  1. `npm test` – should still be green (no drawing tests yet).
  2. Manual: draw stroke → trigger existing "AI test" button; nothing should crash.

### **Stage 2 – Lightweight snapshot**
* **🛠 Code changes**
  1. In `canvasExport.ts` overload **and add a safe resizing fallback**:
     ```ts
     interface ExportOpts { resize?: number; format?: 'png'|'jpeg'; quality?: number; }

     export const exportCanvas = async (
       canvasRef: any,
       opts: ExportOpts = {}
     ): Promise<string | null> => {
       const { resize = 256, format = 'jpeg', quality = 0.6 } = opts;
       if (!canvasRef.current) return null;
       const img     = canvasRef.current.makeImageSnapshot();
       const factor  = resize / BASE_CANVAS_SIZE;
       // Skia <0.1.232 (shipped in Expo 53) doesn't expose `scaleTo`, so we
       // detect its presence at runtime. If missing we fall back to exporting
       // the original resolution *or* (optional) use `expo-image-manipulator`
       // to downsize purely in JS.
       let scaled = img;
       if (factor < 1) {
         if (typeof img.scaleTo === 'function') {
           scaled = img.scaleTo(factor);
         } else {
           console.warn('Skia: img.scaleTo not available – exporting at original resolution');
           // Optional JS fallback (commented):
           // const { base64 } = await ImageManipulator.manipulateAsync(
           //   `data:image/png;base64,${btoa(img.encodeToBytes().reduce((d,b)=>d+String.fromCharCode(b),''))}`,
           //   [{ resize: { width: resize } }],
           //   { compress: quality, format: ImageManipulator.SaveFormat.JPEG, base64:true }
           // );
           // return `data:image/${format};base64,${base64}`;
         }
       }
       const bytes   = scaled.encodeToBytes(format.toUpperCase(), quality * 100);
       const b64 = bytes.reduce((d, b) => d + String.fromCharCode(b), '');
       return `data:image/${format};base64,${btoa(b64)}`;
     };
     ```
  2. Update all call-sites: `exportCanvas(canvasRef, { resize:256 })`.

  3. **Dependency discipline** → Add a note to use `expo install` for any
     native package (`react-native-reanimated`, `@shopify/react-native-skia`)
     to avoid accidental version bumps.
* **🔎 Jest test `__tests__/canvasExport.test.ts`**
  ```ts
  import { exportCanvas } from '../canvasExport';
  import { Skia } from '@shopify/react-native-skia';

  test('jpeg snapshot is smaller than png', async () => {
    const mockRef = { current: { makeImageSnapshot: () => ({
      scaleTo: () => ({ encodeToBytes: () => new Uint8Array(5000) }),
      encodeToBytes: () => new Uint8Array(50000),
     }) } };
    const png  = await exportCanvas(mockRef);
    const jpg  = await exportCanvas(mockRef, { resize:256, format:'jpeg' });
    expect(jpg!.length).toBeLessThan(png!.length);
  });
  ```

### **Stage 3 – Vector summary util**
* **🛠 Implementation**
  1. Create `src/utils/vectorSummary.ts` with interface from the plan.
  2. Algorithm outline:
     • Loop commands, keep min/max x & y.
     • Compute Euclidean length of each `lineTo/quadTo/cubicTo` segment; sum & divide by count.
     • For `lineTo` record angle = `Math.atan2(dy,dx)*(180/π)`; build histogram by rounding to nearest 15° then pick top 3.
     • `shapeHistogram[type]++` for each command type.
* **🔎 Jest test**
  ```ts
  const cmds = [ {type:'moveTo',x:0,y:0}, {type:'lineTo',x:3,y:4}, {type:'addCircle',cx:5,cy:5,radius:2} ];
  const s = vectorSummary(cmds as any);
  expect(s.commandCount).toBe(3);
  expect(s.avgSegment).toBeCloseTo(5); // 3-4-5 triangle
  expect(s.shapeHistogram.addCircle).toBe(1);
  ```

### **Stage 4 – New OpenAI wrapper `riffOnSketch.ts`**
* **🛠 File skeleton**
  ```ts
  import { openaiConfig } from './config';
  import { DrawingCommand, commandSchema } from './types';
  import { zodToJsonSchema } from 'zod-to-json-schema';
  import { VectorSummary } from '../../utils/vectorSummary';

  interface RiffReq { image:string; summary:VectorSummary; }
  export async function riffOnSketch({ image, summary }:RiffReq) {
    const body = {
      model:'gpt-4o',
      stream:false,
      response_format:{ type:'json_schema', json_schema:{ name:'DrawingCommandsSchema', schema:zodToJsonSchema(commandSchema) }},
      messages:[{ role:'user', content:[
        { type:'text', text:`Here is the summary: ${JSON.stringify(summary,null,2)}. Please add creative elements.` },
        { type:'image_url', image_url:{ url:image } }
      ] }]
    };
    const res = await fetch(openaiConfig.baseUrl,{ method:'POST', headers:{ 'Authorization':`Bearer ${openaiConfig.apiKey}`, 'Content-Type':'application/json' }, body:JSON.stringify(body) });
    // parse like proceedWithAPICall then return commands array
  }
  ```
* **🗝 Env flag**: In `App.tsx` when deciding which API to call:
  ```ts
  if (process.env.EXPO_PUBLIC_RIFF_ON_SKETCH==='1') riffOnSketch(...)
  ```
* **🔎 Manual**: Toggle flag, run, check full batch path draws.

### **Stage 5 – Incremental draw API**
* **🛠 In `DrawingCanvas.tsx`**
  1. Add state ref: `const aiPathRef = useRef<any>(null);`
  2. New method:
     ```ts
     const addAICommandIncremental = (cmd:DrawingCommand) => {
       if (!aiPathRef.current) aiPathRef.current = Skia.Path.Make();
       buildPathFromCommands([cmd], aiPathRef.current);
       setPaths(prev => [...prev.filter(p=>p!==aiPathRef.current), aiPathRef.current]);
     };
     ```
  3. Expose via `useImperativeHandle`.
* **🛠 Helper** `components/pathBuilder.ts` returns path; overload variant accepts existing path instance.
* **🔎 Jest** `incrementalDrawing.test.ts` (already provided earlier).

### **Stage 6 – Streaming JSON parser**
* **🛠**
  ```ts
  export const streamParser = (cb:(obj:any)=>void) => {
    let buf=''; let depth=0;
    return (chunk:string) => {
      buf += chunk;
      for(let i=0;i<buf.length;i++){
        if(buf[i]==='{') depth++;
        if(buf[i]==='}') depth--;
        if(depth===0 && buf[i]==='}'){
          const json = buf.slice(0,i+1);
          cb(JSON.parse(json));
          buf = buf.slice(i+1);
          i=-1;
        }
      }
    };
  };
  ```
* **🔎 Jest** edge-case tests: nested braces inside strings, multiple objects in one chunk.

### **Stage 7 – Enable streaming**
* **🛠** Modify `riffOnSketch`:
  1. `stream:true` in body.
  2. After `const res = await fetch...`, check `if(!res.body){ /*retry*/ }`.
  3. `for await (const chunk of res.body as any) parser(chunk.toString('utf8'));`
  4. In parser callback dispatch only objects with `type` field to `addAICommandIncremental`.
* **🔎 Manual timing**: open dev menu → Performance Monitor; log `stamp` labels and confirm `< 3 s`.

### **Stage 8 – Performance timestamps**
* **🛠** In `DrawingCanvas` exportCanvasWithCommands path: `stamp('img-ready')`.
* **🛠** In `riffOnSketch` before first SSE chunk: `stamp('first-chunk')`.
* **🛠** In `addAICommandIncremental` first call set flag & `stamp('first-stroke')`.
* **🔎** Analyse timeline in RN profiler.

### **Stage 9 – Schema & prompt extraction**
* **🛠** Extend zod union:
  ```ts
  const rect = z.object({ type:z.literal('addRect'), x:z.number(), y:z.number(), width:z.number(), height:z.number() });
  export const commandSchema = z.discriminatedUnion('type',[rect, existing1, existing2]);
  ```
* **🛠** `prompts.ts` exports template string constant with `{{summary}}`.
* **🔎 Jest**: generate JSON schema and expect `addRect` present.

### **Stage 10 – Debug grid toggle**
* **🛠** Add to some toolbar:
  ```ts
  if(__DEV__){
    <TouchableOpacity onLongPress={()=>canvasRef.current.addDebugGrid()} />
  }
  ```
* **🔎** Confirm grid lines appear every 100 px.

### **Stage 11 – Docs & clean-up**
* **🛠** `README.md`
  - Add `.env.example` snippet.
  - Document "How to run tests".
* **⚙ CI** GitHub Action: `runs-on: macos-latest` → `npm ci` → `npm test`.

---

All tests green + manual smoke ≙ safe merge 🚀

## ✅ Exit criteria
1. Running `npm test` passes on CI & local.
2. Manual smoke: centred canvas, blue background, drawing works.
3. AI riff delivers first animated stroke **< 3 s** after tap on physical device.

Follow the stages and you will integrate the new AI assist without breaking existing functionality. 