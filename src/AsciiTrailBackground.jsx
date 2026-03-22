import { useEffect, useRef } from "react";

const GRID_X = 12;
const GRID_Y = 16;
const TRAIL_LIMIT = 42;
const BASE_RADIUS = 10;
const IDLE_SETTLE_MS = 42;
const SETTLE_DISTANCE = 18;

function hexToRgb(hex) {
  const value = Number.parseInt(hex.replace("#", ""), 16);

  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
}

function mixColors(start, end, ratio) {
  const clamped = Math.max(0, Math.min(1, ratio));

  return {
    r: Math.round(start.r + (end.r - start.r) * clamped),
    g: Math.round(start.g + (end.g - start.g) * clamped),
    b: Math.round(start.b + (end.b - start.b) * clamped),
  };
}

function pickColor(x, width, startColor, midColor, endColor) {
  const ratio = width === 0 ? 0.5 : x / width;

  return ratio < 0.5
    ? mixColors(startColor, midColor, ratio / 0.5)
    : mixColors(midColor, endColor, (ratio - 0.5) / 0.5);
}

function glyphForDistance(distanceRatio) {
  if (distanceRatio < 0.2) {
    return "o";
  }

  if (distanceRatio < 0.45) {
    return ">";
  }

  return "_";
}

function glyphPriority(glyph) {
  if (glyph === "o") {
    return 3;
  }

  if (glyph === ">") {
    return 2;
  }

  return 1;
}

function strengthForDistance(distanceRatio) {
  return Math.max(0, 1 - distanceRatio);
}

function evolveGlyph(baseGlyph, ageRatio) {
  if (baseGlyph === "o") {
    if (ageRatio < 0.38) {
      return "o";
    }

    if (ageRatio < 0.73) {
      return ">";
    }

    if (ageRatio < 1) {
      return "_";
    }

    return null;
  }

  if (baseGlyph === ">") {
    if (ageRatio < 0.58) {
      return ">";
    }

    if (ageRatio < 1) {
      return "_";
    }

    return null;
  }

  return ageRatio < 1 ? "_" : null;
}

function glyphAlpha(glyph) {
  if (glyph === "o") {
    return 1;
  }

  if (glyph === ">") {
    return 1;
  }

  return 1;
}

function hashNoise(x, y, seed) {
  const value = Math.sin(x * 12.9898 + y * 78.233 + seed * 0.013) * 43758.5453;

  return value - Math.floor(value);
}

export default function AsciiTrailBackground() {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) {
      return undefined;
    }

    const context = canvas.getContext("2d");
    if (!context) {
      return undefined;
    }

    const startColor = hexToRgb("#edf6ff");
    const midColor = hexToRgb("#efe6ff");
    const endColor = hexToRgb("#ffe5f0");

    let width = 0;
    let height = 0;
    let dpr = 1;
    let animationFrameId = 0;
    let lastPointer = null;
    let lastMoveAt = 0;
    const trail = [];

    function resizeCanvas() {
      dpr = window.devicePixelRatio || 1;
      width = window.innerWidth;
      height = window.innerHeight;

      canvas.width = Math.floor(width * dpr);
      canvas.height = Math.floor(height * dpr);
      canvas.style.width = `${width}px`;
      canvas.style.height = `${height}px`;

      context.setTransform(dpr, 0, 0, dpr, 0, 0);
      context.font = '500 16px "IBM Plex Mono", monospace';
      context.textAlign = "center";
      context.textBaseline = "middle";
    }

    function pushTrailPoint(x, y, speed) {
      const color = pickColor(x, width, startColor, midColor, endColor);

      trail.unshift({
        x,
        y,
        speed,
        fadeStartedAt: null,
        seed: Math.random() * 100000,
        ttl: 28 + Math.min(18, speed * 0.05),
        color,
      });

      if (trail.length > TRAIL_LIMIT) {
        trail.length = TRAIL_LIMIT;
      }
    }

    function handlePointerMove(event) {
      const pointer = { x: event.clientX, y: event.clientY };
      lastMoveAt = performance.now();

      if (!lastPointer) {
        lastPointer = pointer;
        pushTrailPoint(pointer.x, pointer.y, 12);
        return;
      }

      const dx = pointer.x - lastPointer.x;
      const dy = pointer.y - lastPointer.y;
      const distance = Math.hypot(dx, dy);

      if (distance < 1) {
        lastPointer = pointer;
        return;
      }

      const steps = Math.max(1, Math.ceil(distance / 10));

      for (let step = 1; step <= steps; step += 1) {
        const ratio = step / steps;
        const sampleX = lastPointer.x + dx * ratio;
        const sampleY = lastPointer.y + dy * ratio;
        pushTrailPoint(sampleX, sampleY, distance);
      }

      lastPointer = pointer;
    }

    function updateTrailPoint(point, idleMs) {
      if (!lastPointer) {
        return Infinity;
      }

      const dx = lastPointer.x - point.x;
      const dy = lastPointer.y - point.y;
      const distance = Math.hypot(dx, dy);
      const isSettling = idleMs > IDLE_SETTLE_MS;
      const basePull = isSettling ? 0.28 : 0.14;
      const speedPull = Math.min(0.08, point.speed / 1200);
      const followStrength = Math.min(0.38, basePull + speedPull);

      point.x += dx * followStrength;
      point.y += dy * followStrength;

      const nextDistance = Math.hypot(
        lastPointer.x - point.x,
        lastPointer.y - point.y,
      );

      return nextDistance < distance ? nextDistance : distance;
    }

    function collectWavePoint(point, index, cellMap, now) {
      const fadeAge = point.fadeStartedAt
        ? (now - point.fadeStartedAt) / 16.6667
        : 0;
      const ageRatio = point.fadeStartedAt ? fadeAge / point.ttl : 0;
      const radius = BASE_RADIUS + index * 1.45 + fadeAge * 0.7;
      const minX = Math.floor((point.x - radius) / GRID_X) * GRID_X;
      const maxX = Math.ceil((point.x + radius) / GRID_X) * GRID_X;
      const minY = Math.floor((point.y - radius) / GRID_Y) * GRID_Y;
      const maxY = Math.ceil((point.y + radius) / GRID_Y) * GRID_Y;

      for (let x = minX; x <= maxX; x += GRID_X) {
        for (let y = minY; y <= maxY; y += GRID_Y) {
          const dx = x - point.x;
          const dy = y - point.y;
          const distance = Math.hypot(dx, dy);

          if (distance > radius) {
            continue;
          }

          const distanceRatio = distance / radius;
          const strength = strengthForDistance(distanceRatio);

          if (strength <= 0.08) {
            continue;
          }

          const baseGlyph = glyphForDistance(distanceRatio);
          const jitter = (hashNoise(x, y, point.seed) - 0.5) * 0.22;
          const shiftedAgeRatio = Math.max(0, ageRatio + jitter);
          const glyph = evolveGlyph(baseGlyph, shiftedAgeRatio);

          if (!glyph) {
            continue;
          }

          const fadeAlpha = point.fadeStartedAt
            ? Math.max(0, 1 - ageRatio * 0.92)
            : 1;
          const alpha = strength * glyphAlpha(glyph) * fadeAlpha;
          const key = `${x}:${y}`;
          const existing = cellMap.get(key);
          const candidate = {
            x,
            y,
            glyph,
            alpha,
            color: point.color,
            priority: glyphPriority(glyph),
            freshness: point.fadeStartedAt ? 1 - ageRatio : 1,
          };

          if (!existing) {
            cellMap.set(key, candidate);
            continue;
          }

          if (candidate.priority > existing.priority) {
            cellMap.set(key, candidate);
            continue;
          }

          if (
            candidate.priority === existing.priority &&
            candidate.alpha * candidate.freshness >
              existing.alpha * existing.freshness
          ) {
            cellMap.set(key, candidate);
          }
        }
      }
    }

    function render() {
      const now = performance.now();
      const idleMs = lastPointer ? now - lastMoveAt : Number.POSITIVE_INFINITY;

      context.clearRect(0, 0, width, height);
      const cellMap = new Map();

      for (let index = trail.length - 1; index >= 0; index -= 1) {
        const point = trail[index];
        const distanceToPointer = updateTrailPoint(point, idleMs);
        const fadeAge = point.fadeStartedAt
          ? (now - point.fadeStartedAt) / 16.6667
          : 0;

        if (
          !point.fadeStartedAt &&
          idleMs > IDLE_SETTLE_MS &&
          distanceToPointer <= SETTLE_DISTANCE
        ) {
          point.fadeStartedAt = now;
        }

        if (point.fadeStartedAt && fadeAge >= point.ttl) {
          trail.splice(index, 1);
          continue;
        }

        collectWavePoint(point, index, cellMap, now);
      }

      cellMap.forEach((cell) => {
        context.save();
        context.fillStyle = `rgba(${cell.color.r}, ${cell.color.g}, ${cell.color.b}, ${cell.alpha})`;
        context.fillText(cell.glyph, cell.x, cell.y);
        context.restore();
      });

      animationFrameId = window.requestAnimationFrame(render);
    }

    resizeCanvas();
    render();

    window.addEventListener("resize", resizeCanvas);
    window.addEventListener("pointermove", handlePointerMove, {
      passive: true,
    });

    return () => {
      window.cancelAnimationFrame(animationFrameId);
      window.removeEventListener("resize", resizeCanvas);
      window.removeEventListener("pointermove", handlePointerMove);
    };
  }, []);

  return (
    <canvas
      ref={canvasRef}
      className="ascii-trail-background"
      aria-hidden="true"
    />
  );
}
