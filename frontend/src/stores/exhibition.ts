import { defineStore } from 'pinia';
import { exhibitionRepository } from '@/api/storage';
import { ExhibitionStatus, type Exhibition, type ExhibitionDraft, type ExhibitionSnapshot } from '@/types';
import { createId } from '@/utils/storage';
import { validateLayout } from '@/utils/exhibition-layout';
import { useArtifactStore } from './artifact';

function createSeedExhibition(artifactIds: string[]): Exhibition {
  const now = new Date().toISOString();
  return {
    id: 'exhibition-heritage-hall',
    title: '手作纹理常设展',
    intro: '围绕陶、绣、漆、竹四类工艺组织展陈，强调材料、手势和纹样的对照关系。',
    curator: '云上工艺馆',
    artifactIds,
    themeColor: '#173f35',
    backgroundMusicUrl: '',
    layout: [],
    status: ExhibitionStatus.Published,
    createdAt: now,
    updatedAt: now
  };
}

export type PublishResult = { ok: true } | { ok: false; errors: string[] };

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
        this.exhibitions = records.map((record) => ({ ...record, layout: record.layout ?? [] }));
      }
      this.loaded = true;
    },
    async createExhibition(draft: ExhibitionDraft) {
      const now = new Date().toISOString();
      const exhibition: Exhibition = {
        ...draft,
        layout: draft.layout ?? [],
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
      const updated: Exhibition = {
        ...current,
        ...patch,
        layout: patch.layout ?? current.layout ?? [],
        updatedAt: new Date().toISOString()
      };
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
    /**
     * 发布：先校验布置方案，通过后冻结顺序、主题色和布置快照。
     * 校验失败（未覆盖全部展品、槽位重复、超过十二个）时返回错误，
     * 草稿与既有快照均保持不变。
     */
    async publishExhibition(id: string, draftPatch?: Partial<ExhibitionDraft>): Promise<PublishResult> {
      const current = this.getById(id);
      if (!current) return { ok: false, errors: ['展览不存在'] };

      const candidate: ExhibitionDraft = {
        title: draftPatch?.title ?? current.title,
        intro: draftPatch?.intro ?? current.intro,
        curator: draftPatch?.curator ?? current.curator,
        artifactIds: draftPatch?.artifactIds ?? current.artifactIds,
        themeColor: draftPatch?.themeColor ?? current.themeColor,
        backgroundMusicUrl: draftPatch?.backgroundMusicUrl ?? current.backgroundMusicUrl,
        layout: draftPatch?.layout ?? current.layout ?? [],
        status: ExhibitionStatus.Published
      };

      const validation = validateLayout(candidate.artifactIds, candidate.layout);
      if (!validation.valid) {
        return { ok: false, errors: validation.errors };
      }

      const snapshot: ExhibitionSnapshot = {
        artifactIds: [...candidate.artifactIds],
        themeColor: candidate.themeColor,
        layout: candidate.artifactIds
          .map((artifactId) =>
            candidate.layout.find((placement) => placement.artifactId === artifactId)
          )
          .filter((placement): placement is NonNullable<typeof placement> => Boolean(placement))
          .map((placement) => ({ ...placement })),
        publishedAt: new Date().toISOString()
      };

      const updated: Exhibition = {
        ...current,
        ...candidate,
        publishedSnapshot: snapshot,
        updatedAt: snapshot.publishedAt
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
