import { els } from "./core/dom.js";

const PULSE_DURATION = 18.5;

export function drawLinesAndShip(cardLayout, workspaceRect, shipY) {
  els.world.querySelector(".field-geometry")?.remove();

  if (!cardLayout.length) return;

  const worldWidth = Math.max(
    els.world.clientWidth,
    Math.round(workspaceRect.width),
  );

  const worldHeight = Math.max(els.world.offsetHeight, Math.round(shipY + 86));
  const shipX = worldWidth / 2;
  const trunkX = shipX;
  const shipTopY = shipY - 22;

  const svg = createSvgElement("svg");
  svg.classList.add("field-geometry");
  svg.setAttribute("width", String(worldWidth));
  svg.setAttribute("height", String(worldHeight));
  svg.setAttribute("viewBox", `0 0 ${worldWidth} ${worldHeight}`);
  svg.setAttribute("aria-hidden", "true");

  const defs = createSvgElement("defs");
  defs.innerHTML = `
    <filter id="shipSoftGlow" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="3.2" result="blur" />
      <feMerge>
        <feMergeNode in="blur" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
    <filter id="photonGlow" x="-80%" y="-80%" width="260%" height="260%">
      <feGaussianBlur stdDeviation="3.8" result="glow" />
      <feMerge>
        <feMergeNode in="glow" />
        <feMergeNode in="SourceGraphic" />
      </feMerge>
    </filter>
  `;
  svg.appendChild(defs);

  const points = cardLayout.map((card) => {
    const isRight = card.x >= trunkX;
    const cardWidth = card.cardWidth || 280;
    const cardHeight = card.cardHeight || 108;

    return {
      y: card.y + cardHeight / 2,
      edgeX: isRight ? card.x - cardWidth / 2 : card.x + cardWidth / 2,
    };
  });

  drawMainLine(svg, trunkX, shipTopY, points);
  drawPulseLine(svg, trunkX, shipTopY, points);
  drawShip(svg, shipX, shipY);

  els.world.insertBefore(svg, els.directionsLayer);
}

function drawMainLine(svg, trunkX, shipTopY, points) {
  const trunk = createSvgElement("path");
  trunk.classList.add("field-line", "field-line-main");
  trunk.setAttribute("d", `M ${trunkX} ${shipTopY} V -180`);
  svg.appendChild(trunk);

  for (const point of points) {
    const branch = createSvgElement("path");
    branch.classList.add("field-line", "field-line-main");
    branch.setAttribute("d", `M ${trunkX} ${point.y} H ${point.edgeX}`);
    svg.appendChild(branch);
  }
}

function drawPulseLine(svg, trunkX, shipTopY, points) {
  const mainDistance = shipTopY + 180;
  const pulseTrunk = createSvgElement("path");
  pulseTrunk.classList.add("field-line-pulse", "field-line-pulse-main");
  pulseTrunk.setAttribute("d", `M ${trunkX} ${shipTopY} V -180`);
  pulseTrunk.style.setProperty("--pulse-distance", Math.max(900, mainDistance + 260));
  pulseTrunk.style.setProperty("--pulse-delay", "0s");
  pulseTrunk.style.setProperty("--pulse-duration", `${PULSE_DURATION}s`);
  svg.appendChild(pulseTrunk);

  for (const point of points) {
    const branchLength = Math.abs(point.edgeX - trunkX);
    const branchDelay = Math.max(
      0.18,
      ((shipTopY - point.y) / Math.max(1, mainDistance)) * PULSE_DURATION * 0.58 + 0.18,
    );

    const pulseBranch = createSvgElement("path");
    pulseBranch.classList.add("field-line-pulse", "field-line-pulse-branch");
    pulseBranch.setAttribute("d", `M ${trunkX} ${point.y} H ${point.edgeX}`);
    pulseBranch.style.setProperty("--pulse-distance", Math.max(280, branchLength + 160));
    pulseBranch.style.setProperty("--pulse-delay", `${branchDelay.toFixed(2)}s`);
    pulseBranch.style.setProperty("--pulse-duration", `${PULSE_DURATION}s`);
    svg.appendChild(pulseBranch);
  }
}

function drawShip(svg, x, y) {
  const group = createSvgElement("g");
  group.classList.add("field-ship");

  const shadow = createSvgElement("ellipse");
  shadow.setAttribute("cx", String(x));
  shadow.setAttribute("cy", String(y + 18));
  shadow.setAttribute("rx", "20");
  shadow.setAttribute("ry", "4.5");
  shadow.setAttribute("fill", "rgba(0, 0, 0, 0.38)");
  group.appendChild(shadow);

  const glow = createSvgElement("path");
  glow.classList.add("field-triangle-glow");
  glow.setAttribute("d", roundedTrianglePath(x, y - 2, 23, 36, 7));
  glow.setAttribute("filter", "url(#shipSoftGlow)");
  group.appendChild(glow);

  const body = createSvgElement("path");
  body.classList.add("field-triangle");
  body.setAttribute("d", roundedTrianglePath(x, y - 3, 18, 29, 5.5));
  body.setAttribute("filter", "url(#shipSoftGlow)");
  group.appendChild(body);

  const inner = createSvgElement("path");
  inner.classList.add("field-triangle-inner");
  inner.setAttribute("d", roundedTrianglePath(x, y + 1, 8, 18, 4));
  group.appendChild(inner);

  svg.appendChild(group);
}

function roundedTrianglePath(cx, cy, halfWidth, height, radius) {
  const top = { x: cx, y: cy - height / 2 };
  const right = { x: cx + halfWidth, y: cy + height / 2 };
  const left = { x: cx - halfWidth, y: cy + height / 2 };

  const p1 = pointTowards(top, right, radius);
  const p2 = pointTowards(right, top, radius);
  const p3 = pointTowards(right, left, radius);
  const p4 = pointTowards(left, right, radius);
  const p5 = pointTowards(left, top, radius);
  const p6 = pointTowards(top, left, radius);

  return `
    M ${p1.x} ${p1.y}
    L ${p2.x} ${p2.y}
    Q ${right.x} ${right.y} ${p3.x} ${p3.y}
    L ${p4.x} ${p4.y}
    Q ${left.x} ${left.y} ${p5.x} ${p5.y}
    L ${p6.x} ${p6.y}
    Q ${top.x} ${top.y} ${p1.x} ${p1.y}
    Z
  `;
}

function pointTowards(from, to, distance) {
  const dx = to.x - from.x;
  const dy = to.y - from.y;
  const length = Math.hypot(dx, dy) || 1;

  return {
    x: from.x + (dx / length) * distance,
    y: from.y + (dy / length) * distance,
  };
}

function createSvgElement(tagName) {
  return document.createElementNS("http://www.w3.org/2000/svg", tagName);
}
