"use client";

import ReactGridLayout, { noCompactor, useContainerWidth } from "react-grid-layout";
import "react-grid-layout/css/styles.css";
import "react-resizable/css/styles.css";

export default function GridLayout() {
  const { width, containerRef, mounted } = useContainerWidth();

  const layout = [
    { i: "a", x: 0, y: 0, w: 2, h: 2, static: true },
    { i: "b", x: 2, y: 4, w: 3, h: 2 }, // y 띄워서 빈공간 테스트
    { i: "c", x: 0, y: 8, w: 5, h: 2 },
  ];

  const compactor = { ...noCompactor, preventCollision: true };
  return (
    <div ref={containerRef}>
      {mounted && (
        <ReactGridLayout
          layout={layout}
          width={width}
          gridConfig={{ cols: 12, rowHeight: 30 }}
          compactor={compactor}
        >
          <div key="a">a테스트</div>
          <div key="b">b</div>
          <div key="c">c</div>
        </ReactGridLayout>
      )}
    </div>
  );
}
