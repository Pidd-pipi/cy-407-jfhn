import { defineStore } from 'pinia';
import { exhibitionRepository } from '@/api/storage';
import { ExhibitionStatus, type Exhibition, type ExhibitionDraft, type ExhibitionSnapshot } from '@/types';
import { validateExhibitionLayout } from '@/utils/exhibition-layout';
import { createId } from '@/utils/storage';
import { useArtifactStore } from './artifact';

function createSeedExhibition(artifactIds: string[]): Exhibition {
  const now = new Date().toISOString();
  const layout = artifactIds.slice(0, 12).map((artifactId, index) => ({
    artifactId,
    slot: index + 1,
    rotation: 0,
    scale: 1
  }));
  return {
    id: 'exhibition-heritage-hall',
    title: '手作纹理常设展',
    intro: '围绕陶、绣、漆、竹四类工艺组织展陈，强调材料、手势和纹样的对照关系。',
    curator: '云上工艺馆',
    artifactIds,
    themeColor: '#173f35',
    backgroundMusicUrl: '',
    status: ExhibitionStatus.Published,
    layout,
    publishedSnapshot: {
      artifactIds: [...artifactIds],
      themeColor: '#173f35',
      layout: layout.map((placement) => ({ ...placement })),
      publishedAt: now
    },
    createdAt: now,
    updatedAt: now
  };
}

export const useExhibitionStore = defineStore('exhibition', {
  state: () => ({
    exhibitions: [] as Exhibition[],
    loaded: false
  }),
  getters: {
    getById: (state) => (id: string) => state.exhibitions.find((exhibition) => exhibition.id === id),
    published: (state) => state.exhibitions.filter((exhibition) => exhibition.status === ExhibitionStatus.Published)
  },
  actions: {
    async load() {
      const records = await exhibitionRepository.list();
      if (records.length === 0) {
        const artifactStore = useArtifactStore();
        const seed = createSeedExhibition(artifactStore.artifacts.map((artifact) => artifact.id));
        await exhibitionRepository.save(seed);
        this.exhibitions = [seed];
      } else {
        this.exhibitions = records;
      }
      this.loaded = true;
    },
    async createExhibition(draft: ExhibitionDraft) {
      const now = new Date().toISOString();
      const exhibition: Exhibition = {
        ...draft,
        id: createId('exhibition'),
        createdAt: now,
        updatedAt: now
      };
      this.exhibitions.unshift(exhibition);
      await exhibitionRepository.save(exhibition);
      return exhibition;
    },
    async updateExhibition(id: string, patch: Partial<ExhibitionDraft>) {
      const current = this.getById(id);
      if (!current) return;
      const updated: Exhibition = { ...current, ...patch, updatedAt: new Date().toISOString() };
      this.exhibitions = this.exhibitions.map((exhibition) => (exhibition.id === id ? updated : exhibition));
      await exhibitionRepository.save(updated);
    },
    async deleteExhibition(id: string) {
      this.exhibitions = this.exhibitions.filter((exhibition) => exhibition.id !== id);
      await exhibitionRepository.remove(id);
    },
    async reorderArtifacts(id: string, artifactIds: string[]) {
      await this.updateExhibition(id, { artifactIds });
    },
    async publishExhibition(id: string): Promise<{ ok: true } | { ok: false; reason: string }> {
      const current = this.getById(id);
      if (!current) return { ok: false, reason: '展览不存在' };

      const layout = (current.layout ?? []).map((placement) => ({ ...placement }));
      const problems = validateExhibitionLayout(current.artifactIds, layout);
      if (problems.length > 0) {
        // 发布失败：草稿与既有快照保持不变
        return { ok: false, reason: problems.join('；') };
      }

      const snapshot: ExhibitionSnapshot = {
        artifactIds: [...current.artifactIds],
        themeColor: current.themeColor,
        layout,
        publishedAt: new Date().toISOString()
      };
      const updated: Exhibition = {
        ...current,
        status: ExhibitionStatus.Published,
        publishedSnapshot: snapshot,
        updatedAt: new Date().toISOString()
      };
      this.exhibitions = this.exhibitions.map((exhibition) => (exhibition.id === id ? updated : exhibition));
      await exhibitionRepository.save(updated);
      return { ok: true };
    },
    async unpublishExhibition(id: string) {
      await this.updateExhibition(id, { status: ExhibitionStatus.Draft });
    }
  }
});
