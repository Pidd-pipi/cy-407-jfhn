import * as THREE from 'three';
import type { ArtifactPlacement, LayoutSlot } from '@/types';

export const MIN_SLOT = 1;
export const MAX_SLOT = 12;
export const SLOT_NUMBERS = Array.from({ length: MAX_SLOT }, (_, index) => index + 1) as LayoutSlot[];

export type WallId = 'back' | 'left' | 'right';

export const wallLabels: Record<WallId, string> = {
  back: '后墙',
  left: '左墙',
  right: '右墙'
};

/** 墙面分组：后墙 1-6，左墙 7-9，右墙 10-12 */
export const slotWalls: Record<LayoutSlot, WallId> = {
  1: 'back',
  2: 'back',
  3: 'back',
  4: 'back',
  5: 'back',
  6: 'back',
  7: 'left',
  8: 'left',
  9: 'left',
  10: 'right',
  11: 'right',
  12: 'right'
};

export const wallSlots: Record<WallId, LayoutSlot[]> = {
  back: [1, 2, 3, 4, 5, 6],
  left: [7, 8, 9],
  right: [10, 11, 12]
};

interface SlotGeometry {
  position: [number, number, number];
  /** 槽位默认朝向（度），展品朝向墙面内方向 */
  facing: number;
}

/** 12 个墙面槽位在展厅中的固定坐标与默认朝向 */
const slotGeometry: Record<LayoutSlot, SlotGeometry> = {
  1: { position: [-7.5, 0, -6.6], facing: 0 },
  2: { position: [-4.5, 0, -6.6], facing: 0 },
  3: { position: [-1.5, 0, -6.6], facing: 0 },
  4: { position: [1.5, 0, -6.6], facing: 0 },
  5: { position: [4.5, 0, -6.6], facing: 0 },
  6: { position: [7.5, 0, -6.6], facing: 0 },
  7: { position: [-7.85, 0, -4.2], facing: 90 },
  8: { position: [-7.85, 0, -0.2], facing: 90 },
  9: { position: [-7.85, 0, 3.8], facing: 90 },
  10: { position: [7.85, 0, -4.2], facing: -90 },
  11: { position: [7.85, 0, -0.2], facing: -90 },
  12: { position: [7.85, 0, 3.8], facing: -90 }
};

export function isSlot(value: number): value is LayoutSlot {
  return Number.isInteger(value) && value >= MIN_SLOT && value <= MAX_SLOT;
}

export function defaultFacing(slot: LayoutSlot): number {
  return slotGeometry[slot].facing;
}

export function createPlacement(artifactId: string, slot: LayoutSlot): ArtifactPlacement {
  return { artifactId, slot, facing: defaultFacing(slot), scale: 1 };
}

export interface LayoutValidationResult {
  valid: boolean;
  errors: string[];
}

/**
 * 发布校验：每件已选展品都必须占用 1-12 号中的唯一槽位。
 * 未覆盖全部展品、槽位重复或超过十二个时均不通过。
 */
export function validateLayout(artifactIds: string[], layout: ArtifactPlacement[]): LayoutValidationResult {
  const errors: string[] = [];
  const byArtifact = new Map(layout.map((placement) => [placement.artifactId, placement]));

  if (artifactIds.length > MAX_SLOT) {
    errors.push(`展品超过 ${MAX_SLOT} 件（当前 ${artifactIds.length} 件），墙面槽位不足`);
  }

  const missing = artifactIds.filter((id) => {
    const placement = byArtifact.get(id);
    return !placement || !isSlot(placement.slot);
  });
  if (missing.length > 0) {
    errors.push(`有 ${missing.length} 件展品未分配有效槽位（1-${MAX_SLOT} 号）`);
  }

  const usedSlots = new Map<number, string[]>();
  for (const id of artifactIds) {
    const slot = byArtifact.get(id)?.slot;
    if (typeof slot !== 'number' || !isSlot(slot)) continue;
    const owners = usedSlots.get(slot) ?? [];
    owners.push(id);
    usedSlots.set(slot, owners);
  }
  const duplicates = [...usedSlots.entries()].filter(([, owners]) => owners.length > 1);
  if (duplicates.length > 0) {
    errors.push(`槽位重复：${duplicates.map(([slot]) => `${slot} 号`).join('、')}`);
  }

  return { valid: errors.length === 0, errors };
}

/**
 * 已选展品变化时同步布置方案：保留策展人已设定的墙面位置（含槽位、朝向、缩放），
 * 移除被取消展品，为新增展品分配当前未占用的最低槽位。
 */
export function syncPlacements(artifactIds: string[], layout: ArtifactPlacement[]): ArtifactPlacement[] {
  const retained = artifactIds
    .map((id) => layout.find((placement) => placement.artifactId === id))
    .filter((placement): placement is ArtifactPlacement => Boolean(placement));

  const usedSlots = new Set(retained.map((placement) => placement.slot));
  const next = [...retained];
  for (const id of artifactIds) {
    if (retained.some((placement) => placement.artifactId === id)) continue;
    const freeSlot = SLOT_NUMBERS.find((slot) => !usedSlots.has(slot));
    if (!freeSlot) {
      next.push({ artifactId: id, slot: MIN_SLOT as LayoutSlot, facing: 0, scale: 1 });
      continue;
    }
    usedSlots.add(freeSlot);
    next.push(createPlacement(id, freeSlot));
  }
  return artifactIds.map((id) => next.find((placement) => placement.artifactId === id) as ArtifactPlacement);
}

/**
 * 解析某批展品实际生效的布置：每件展品恰好对应一个 1-12 号的唯一槽位时返回槽位映射，
 * 否则返回 undefined，调用方沿用自动排位（兼容旧展览）。
 */
export function resolveSlotPlacements(
  artifactIds: string[],
  layout: ArtifactPlacement[]
): Map<string, ArtifactPlacement> | undefined {
  const byArtifact = new Map<string, ArtifactPlacement>();
  const usedSlots = new Set<number>();
  for (const id of artifactIds) {
    const placement = layout.find((item) => item.artifactId === id);
    if (!placement || !isSlot(placement.slot) || usedSlots.has(placement.slot)) return undefined;
    usedSlots.add(placement.slot);
    byArtifact.set(id, placement);
  }
  return byArtifact;
}

/** 应用槽位布置到 3D 对象：固定墙面位置 + 策展人朝向与缩放 */
export function applySlotPlacement(object: THREE.Object3D, placement: ArtifactPlacement): void {
  const geometry = slotGeometry[placement.slot];
  object.position.set(...geometry.position);
  object.rotation.y = THREE.MathUtils.degToRad(placement.facing);
  object.scale.multiplyScalar(placement.scale);
}

/** 旧展览无布置数据时沿用的自动排位（按展品顺序分列两侧展线） */
export function applyAutoPosition(
  object: THREE.Object3D,
  index: number,
  total: number,
  spacing = 4.1
): void {
  object.position.set((index - (total - 1) / 2) * spacing, 0, index % 2 === 0 ? -1.35 : 1.2);
  object.rotation.y = index % 2 === 0 ? 0.16 : -0.24;
}
