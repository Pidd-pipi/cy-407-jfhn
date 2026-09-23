import type { ExhibitionStatus } from './enums';

export interface LayoutPlacement {
  artifactId: string;
  /** 槽位号，取值 1-12 */
  slot: number;
  /** 朝向，相对槽位朝向的角度偏移（度） */
  rotation: number;
  /** 缩放倍率 */
  scale: number;
}

export interface ExhibitionSnapshot {
  artifactIds: string[];
  themeColor: string;
  layout: LayoutPlacement[];
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
  status: ExhibitionStatus;
  /** 布置方案草稿，旧数据可能缺失 */
  layout?: LayoutPlacement[];
  /** 最近一次发布时冻结的快照，发布后编辑只改草稿字段 */
  publishedSnapshot?: ExhibitionSnapshot;
  createdAt: string;
  updatedAt: string;
}

export type ExhibitionDraft = Omit<Exhibition, 'id' | 'createdAt' | 'updatedAt' | 'publishedSnapshot'> & {
  layout: LayoutPlacement[];
};
