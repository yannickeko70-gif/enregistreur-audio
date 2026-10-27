import React, { useMemo } from 'react';
import { Canvas, Path, Skia } from '@shopify/react-native-skia';

export default function LiveWaveform({
  levels,
  width,
  height,
  color = '#4f9cff',
}) {
  const path = useMemo(() => {
    const p = Skia.Path.Make();
    const slot = width / levels.length;
    const barWidth = Math.max(2, slot * 0.6);
    levels.forEach((lvl, i) => {
      const h = Math.max(2, lvl * height); // barre minimale visible
      const x = i * slot + (slot - barWidth) / 2;
      const y = (height - h) / 2; // centrée verticalement
      p.addRRect(
        Skia.RRectXY(Skia.XYWHRect(x, y, barWidth, h), barWidth / 2, barWidth / 2)
      );
    });
    return p;
  }, [levels, width, height]);

  return (
    <Canvas style={{ width, height }}>
      <Path path={path} color={color} />
    </Canvas>
  );
}