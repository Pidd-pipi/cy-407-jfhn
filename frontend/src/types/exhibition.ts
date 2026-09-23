import type { ExhibitionStatus } from './enums';

/** 墙面槽位编号，展厅三面墙共 12 个固定位置 */
export type LayoutSlot = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

/** 单件展品的布置：占用的墙面槽位、朝向（绕 Y 轴角度，度）与缩放 */
export interface ArtifactPlacement {
  artifactId: string;
  slot: LayoutSlot;
  facing: number;
  scale: number;
}

/** 发布时冻结的展览快照：展品顺序、主题色与布置方案 */
export interface ExhibitionSnapshot {
  artifactIds: string[];
  themeColor: string;
  layout: ArtifactPlacement[];
  publishedAt: string;
}

export interface Exhibition {
  id: string;
  title: string;
  intro: string;
  curator: string;
  artifactIds: string[];
  themeColor: string;
  backgroundMusicUrl?: string;
  /** 草稿态布置方案，随时可改，发布前不影响展厅 */
  layout: ArtifactPlacement[];
  /** 最近一次成功发布冻结的快照；未发布或发布校验失败时为空 */
  publishedSnapshot?: ExhibitionSnapshot;
  status: ExhibitionStatus;
  createdAt: string;
  updatedAt: string;
}

export type ExhibitionDraft = Omit<Exhibition, 'id' | 'createdAt' | 'updatedAt' | 'publishedSnapshot'>;
