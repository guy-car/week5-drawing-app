// @ts-nocheck
import React, { createRef } from 'react';
import renderer, { act } from 'react-test-renderer';
import { DrawingCommand } from '../src/api/openai/types';

// Global array to capture colours
(global as any).__renderColours = [];

// Mock Skia & related primitives BEFORE importing component
jest.mock('@shopify/react-native-skia', () => {
  const React = require('react');
  class MockPath {
    moveTo() {}
    lineTo() {}
  }
  return {
    Skia: { Path: { Make: () => new MockPath() } },
    Path: (props: any) => {
      if (props.color) (global as any).__renderColours.push(props.color);
      return null;
    },
    Canvas: (props: any) => React.createElement(React.Fragment, null, props.children),
    Group: (props: any) => React.createElement(React.Fragment, null, props.children),
    Rect: () => null,
    useCanvasRef: () => ({ current: { makeImageSnapshot: () => ({ encodeToBytes: () => new Uint8Array(0) }) } }),
  };
});

import DrawingCanvas from '../components/DrawingCanvas';

const dummyCmd: DrawingCommand = { type: 'moveTo', x: 0, y: 0 } as any;

describe('Undo/Redo colour integrity', () => {
  beforeEach(() => {
    (global as any).__renderColours = [];
  });

  it('maintains correct colours through undo/redo', () => {
    const ref = createRef<any>();

    const rendererInstance = renderer.create(
      <DrawingCanvas
        ref={ref}
        mode="draw"
        onZoomChange={() => {}}
        screenWidth={1000}
        screenHeight={1000}
        selectedColor="#FF0000"
      />
    );

    // First stroke (red)
    act(() => {
      ref.current.addAIPath([dummyCmd]);
    });
    expect((global as any).__renderColours).toContain('#FF0000');

    // Change selected color to blue and add second stroke
    act(() => {
      rendererInstance.update(
        <DrawingCanvas
          ref={ref}
          mode="draw"
          onZoomChange={() => {}}
          screenWidth={1000}
          screenHeight={1000}
          selectedColor="#0000FF"
        />
      );
    });

    act(() => {
      (global as any).__renderColours = [];
      ref.current.addAIPath([dummyCmd]);
    });

    expect((global as any).__renderColours).toEqual(expect.arrayContaining(['#FF0000', '#0000FF']));

    // Undo removes blue stroke
    act(() => {
      (global as any).__renderColours = [];
      ref.current.undo();
    });

    expect((global as any).__renderColours).toContain('#FF0000');
    expect((global as any).__renderColours).not.toContain('#0000FF');

    // Redo adds blue stroke back
    act(() => {
      (global as any).__renderColours = [];
      ref.current.redo();
    });

    expect((global as any).__renderColours).toEqual(expect.arrayContaining(['#FF0000', '#0000FF']));
  });
}); 