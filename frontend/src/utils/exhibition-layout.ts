import type { LayoutPlacement } from '@/types';

export const GALLERY_SLOT_COUNT = 12;
export const MIN_PLACEMENT_SCALE = 0.4;
export const MAX_PLACEMENT_SCALE = 2.5;

export interface SlotTransform {
  position: [number, number, number];
  /** 槽位朝向墙面的法线方向（弧度），展品自身朝向在此基础上叠加 */
  rotationY: number;
  wall: string;
}

const BACK_WALL_Z = -5.4;
const SIDE_WALL_X = 6.3;
const BACK_WALL_XS = [-5.4, -1.8, 1.8, 5.4];
const SIDE_WALL_ZS = [-4.5, -1.5, 1.5, 4.5];

/**
 * 12 个槽位沿三面墙分布：1-4 后墙，5-8 左墙，9-12 右墙。
 */
export function getSlotTransform(slot: number): SlotTransform {
  if (slot >= 1 && slot <= 4) {
    return { position: [BACK_WALL_XS[slot - 1], 0, BACK_WALL_Z], rotationY: 0, wall: '后墙' };
  }
  if (slot >= 5 && slot <= 8) {
    return { position: [-SIDE_WALL_X, 0, SIDE_WALL_ZS[slot - 5]], rotationY: Math.PI / 2, wall: '左墙' };
  }
  if (slot >= 9 && slot <= 12) {
    return { position: [SIDE_WALL_X, 0, SIDE_WALL_ZS[slot - 9]], rotationY: -Math.PI / 2, wall: '右墙' };
  }
  return { position: [0, 0, 0], rotationY: 0, wall: '未知' };
}

export function getSlotWall(slot: number): string {
  return getSlotTransform(slot).wall;
}

/**
 * 校验布置方案是否可发布：需覆盖全部已选展品、槽位 1-12 内且不重复。
 * 返回问题列表，空数组表示通过。
 */
export function validateExhibitionLayout(artifactIds: string[], placements: LayoutPlacement[]): string[] {
  const problems: string[] = [];
  const covered = new Set(placements.map((placement) => placement.artifactId));
  const missingCount = artifactIds.filter((id) => !covered.has(id)).length;
  if (missingCount > 0) {
    problems.push(`还有 ${missingCount} 件展品未分配槽位`);
  }

  const slots = placements.map((placement) => placement.slot);
  if (slots.some((slot) => !Number.isInteger(slot) || slot < 1 || slot > GALLERY_SLOT_COUNT)) {
    problems.push(`槽位必须在 1-${GALLERY_SLOT_COUNT} 之间`);
  }
  if (placements.length > GALLERY_SLOT_COUNT) {
    problems.push(`槽位数量超过 ${GALLERY_SLOT_COUNT} 个`);
  }
  if (new Set(slots).size !== slots.length) {
    problems.push('存在重复槽位');
  }
  return problems;
}
