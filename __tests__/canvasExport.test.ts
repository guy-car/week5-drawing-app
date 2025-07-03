import { exportCanvas } from '../src/utils/canvasExport';
import { useCanvasRef, ImageFormat } from '@shopify/react-native-skia';

test('jpeg snapshot is smaller than png', async () => {
  const mockRef = useCanvasRef();
  expect(mockRef.current).toBeTruthy();
  
  // Get the raw byte arrays before base64 encoding
  const snapshot = mockRef.current!.makeImageSnapshot();
  const pngBytes = snapshot.encodeToBytes();  // Default is PNG
  const jpgBytes = snapshot.encodeToBytes(ImageFormat.JPEG, 60);  // JPEG at 60% quality
  
  expect(jpgBytes.length).toBeLessThan(pngBytes.length);
  
  // Also test the full export function
  const png = await exportCanvas(mockRef);
  const jpg = await exportCanvas(mockRef, { resize: 256, format: 'jpeg' });
  expect(jpg).toBeTruthy();
  expect(png).toBeTruthy();
  expect(jpg).toContain('data:image/jpeg;base64,');
  expect(png).toContain('data:image/png;base64,');
}); 