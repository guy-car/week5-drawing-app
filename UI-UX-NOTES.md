Clear should recenter canvas
Canvas should not be able to get out of the screen
Reaching max or min zoom should gray out buttons


TESTS:

Case 1: zooming out until I no longer could.
iOS Bundled 94ms node_modules/expo/AppEntry.js (1 module)
 LOG  📐 Container dimensions: {"height": 562.6666870117188, "width": 1000}
 LOG  🔍 Zoom change: {"containerSize": {"height": 562.6666870117188, "width": 1000}, "from": 1, "to": 0.75, "translation": {"x": 0, "y": 0}}
 LOG  🔍 Zoom change: {"containerSize": {"height": 562.6666870117188, "width": 1000}, "from": 0.75, "to": 0.5, "translation": {"x": 0, "y": 0}}
 LOG  🔍 Zoom change: {"containerSize": {"height": 562.6666870117188, "width": 1000}, "from": 0.5, "to": 0.5, "translation": {"x": 0, "y": 0}}
iOS Bundled 103ms node_modules/expo/AppEntry.js (1 module)

Case 2: move canvas all the way to the right (the left edge of the canvas was brought to the right edge of the screen)
 LOG  🔄 Pan update: {"canvasSize": 1000, "containerSize": {"height": 562.6666870117188, "width": 1000}, "scale": 1, "translation": {"x": 654.3333358764648, "y": 32.50001525878906}}
 LOG  🔄 Pan update: {"canvasSize": 1000, "containerSize": {"height": 562.6666870117188, "width": 1000}, "scale": 1, "translation": {"x": 654.3333358764648, "y": 32.833351135253906}}
 LOG  🔄 Pan update: {"canvasSize": 1000, "containerSize": {"height": 562.6666870117188, "width": 1000}, "scale": 1, "translation": {"x": 654.5000076293945, "y": 33.333351135253906}}
 LOG  🔄 Pan update: {"canvasSize": 1000, "containerSize": {"height": 562.6666870117188, "width": 1000}, "scale": 1, "translation": {"x": 654.8333358764648, "y": 33.833351135253906}}
 LOG  🔄 Pan update: {"canvasSize": 1000, "containerSize": {"height": 562.6666870117188, "width": 1000}, "scale": 1, "translation": {"x": 654.8333358764648, "y": 34.16667938232422}}
 LOG  🔄 Pan update: {"canvasSize": 1000, "containerSize": {"height": 562.6666870117188, "width": 1000}, "scale": 1, "translation": {"x": 654.8333358764648, "y": 34.16667938232422}}

Case 2: moving all the way to the left (the right edge of the canvas was brought to the left edge of the screen)
 LOG  🔄 Pan update: {"canvasSize": 1000, "containerSize": {"height": 562.6666870117188, "width": 1000}, "scale": 1, "translation": {"x": -665.3333282470703, "y": 32.333335876464844}}
 LOG  🔄 Pan update: {"canvasSize": 1000, "containerSize": {"height": 562.6666870117188, "width": 1000}, "scale": 1, "translation": {"x": -665.3333282470703, "y": 32.666664123535156}}
 LOG  🔄 Pan update: {"canvasSize": 1000, "containerSize": {"height": 562.6666870117188, "width": 1000}, "scale": 1, "translation": {"x": -665.3333282470703, "y": 32.99999237060547}}
 LOG  🔄 Pan update: {"canvasSize": 1000, "containerSize": {"height": 562.6666870117188, "width": 1000}, "scale": 1, "translation": {"x": -665.3333282470703, "y": 33.333335876464844}}
 LOG  🔄 Pan update: {"canvasSize": 1000, "containerSize": {"height": 562.6666870117188, "width": 1000}, "scale": 1, "translation": {"x": -665.3333282470703, "y": 33.666664123535156}}

Case 3: panning all the way to the bottom (top of the canvas brought to bottom edge of the screen)
LOG  🔄 Pan update: {"canvasSize": 1000, "containerSize": {"height": 562.6666870117188, "width": 1000}, "scale": 1, "translation": {"x": -13.166656494140625, "y": 759.8333206176758}}
 LOG  🔄 Pan update: {"canvasSize": 1000, "containerSize": {"height": 562.6666870117188, "width": 1000}, "scale": 1, "translation": {"x": -13.166656494140625, "y": 759.9999923706055}}
 LOG  🔄 Pan update: {"canvasSize": 1000, "containerSize": {"height": 562.6666870117188, "width": 1000}, "scale": 1, "translation": {"x": -13.166656494140625, "y": 760.1666564941406}}
 LOG  🔄 Pan update: {"canvasSize": 1000, "containerSize": {"height": 562.6666870117188, "width": 1000}, "scale": 1, "translation": {"x": -13.166656494140625, "y": 760.3333206176758}}
 LOG  🔄 Pan update: {"canvasSize": 1000, "containerSize": {"height": 562.6666870117188, "width": 1000}, "scale": 1, "translation": {"x": -13.166656494140625, "y": 760.4999923706055}}
