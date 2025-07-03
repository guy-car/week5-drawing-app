## Dependency Stability Notes (added 2025-07-03)

1. For any library that contains native code (e.g. `react-native-reanimated`, `@shopify/react-native-skia`, `expo-camera`, etc.) **always install or upgrade via `npx expo install <package>`**.  Expo pins the exact version that matches the native binaries compiled into the current SDK.  Using `npm install` or `npm update` can pull in a newer JS version that doesn't match the native side and will crash Hermes at runtime.

2. Never move a native library to **devDependencies**.  Only modules listed in `dependencies` are bundled into the native build that ships to the device or simulator.

3. Keep React and React-Native versions in lock-step with your Expo SDK.  Expo 53 ships `react@19.0.0` and `react-native@0.79.4`.  Bumping React to 19.1.0 without matching the renderer produces the "Incompatible React versions" runtime error.

4. When adding image-manipulation or Skia features, check the Expo release notes to confirm the underlying native API is available.  For example, `SkImage.scaleTo` exists only in Skia ≥0.1.232 (Expo SDK 54+).  Provide graceful fallbacks for older SDKs.

5. Add shared constants/utilities in dedicated files to avoid circular imports.  Circular require cycles can slow startup and sometimes lead to partially-initialised modules.
