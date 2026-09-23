<template>
  <section class="layout-planner">
    <header>
      <div>
        <h3>墙面布置方案</h3>
        <small>每件展品占用 1-12 号唯一槽位，可单独设置朝向与缩放；草稿可重复，发布时统一校验。</small>
      </div>
      <n-button size="small" secondary :disabled="artifacts.length === 0" @click="autoFill">一键补全空槽位</n-button>
    </header>

    <div class="slot-map">
      <div class="wall wall-back">
        <span class="wall-label">后墙</span>
        <button
          v-for="slot in wallSlots.back"
          :key="slot"
          type="button"
          class="slot-chip"
          :class="chipClass(slot)"
          @click="focusSlot(slot)"
        >
          <i>{{ slot }}</i>
          <em>{{ occupantName(slot) }}</em>
        </button>
      </div>
      <div class="side-walls">
        <div class="wall wall-left">
          <span class="wall-label">左墙</span>
          <button
            v-for="slot in wallSlots.left"
            :key="slot"
            type="button"
            class="slot-chip"
            :class="chipClass(slot)"
            @click="focusSlot(slot)"
          >
            <i>{{ slot }}</i>
            <em>{{ occupantName(slot) }}</em>
          </button>
        </div>
        <div class="hall-center">展厅</div>
        <div class="wall wall-right">
          <span class="wall-label">右墙</span>
          <button
            v-for="slot in wallSlots.right"
            :key="slot"
            type="button"
            class="slot-chip"
            :class="chipClass(slot)"
            @click="focusSlot(slot)"
          >
            <i>{{ slot }}</i>
            <em>{{ occupantName(slot) }}</em>
          </button>
        </div>
      </div>
    </div>

    <div class="placement-list">
      <div v-for="artifact in artifacts" :key="artifact.id" :data-artifact-slot="artifact.id" class="placement-row">
        <strong class="artifact-name">{{ artifact.name }}</strong>
        <n-select
          :value="placementOf(artifact.id).slot"
          :options="slotOptions"
          size="small"
          class="slot-select"
          @update:value="(slot: number) => updateSlot(artifact.id, slot)"
        />
        <div class="facing-field">
          <span>朝向 {{ Math.round(placementOf(artifact.id).facing) }}°</span>
          <n-slider
            :value="placementOf(artifact.id).facing"
            :min="-180"
            :max="180"
            :step="5"
            @update:value="(facing: number) => updateField(artifact.id, { facing })"
          />
        </div>
        <div class="scale-field">
          <span>缩放 {{ placementOf(artifact.id).scale.toFixed(2) }}×</span>
          <n-slider
            :value="placementOf(artifact.id).scale"
            :min="0.5"
            :max="2"
            :step="0.05"
            @update:value="(scale: number) => updateField(artifact.id, { scale })"
          />
        </div>
      </div>
      <p v-if="artifacts.length === 0" class="empty-hint">先在上方勾选展品，再为其分配墙面槽位。</p>
    </div>
  </section>
</template>

<script setup lang="ts">
import { computed } from 'vue';
import type { Artifact, ArtifactPlacement, LayoutSlot } from '@/types';
import {
  SLOT_NUMBERS,
  defaultFacing,
  isSlot,
  syncPlacements,
  wallLabels,
  wallSlots
} from '@/utils/exhibition-layout';

const props = defineProps<{
  artifacts: Artifact[];
  modelValue: ArtifactPlacement[];
}>();

const emit = defineEmits<{
  'update:modelValue': [layout: ArtifactPlacement[]];
}>();

const artifactIds = computed(() => props.artifacts.map((artifact) => artifact.id));

const slotOptions = (Object.keys(wallSlots) as Array<keyof typeof wallSlots>).map((wall) => ({
  type: 'group' as const,
  label: wallLabels[wall],
  key: wall,
  children: wallSlots[wall].map((slot) => ({ label: `${slot} 号槽位`, value: slot }))
}));

function placementOf(artifactId: string): ArtifactPlacement {
  const found = props.modelValue.find((placement) => placement.artifactId === artifactId);
  if (found && isSlot(found.slot)) return found;
  const fallbackSlot = SLOT_NUMBERS[0];
  return { artifactId, slot: fallbackSlot, facing: defaultFacing(fallbackSlot), scale: 1 };
}

function emitLayout(next: ArtifactPlacement[]) {
  emit('update:modelValue', syncPlacements(artifactIds.value, next));
}

function updateSlot(artifactId: string, slot: number) {
  if (!isSlot(slot)) return;
  const current = placementOf(artifactId);
  const next = props.modelValue.filter((placement) => placement.artifactId !== artifactId);
  next.push({ ...current, slot, facing: current.facing, scale: current.scale });
  emitLayout(next);
}

function updateField(artifactId: string, patch: Partial<Pick<ArtifactPlacement, 'facing' | 'scale'>>) {
  const current = placementOf(artifactId);
  const next = props.modelValue.filter((placement) => placement.artifactId !== artifactId);
  next.push({ ...current, ...patch });
  emitLayout(next);
}

function autoFill() {
  emitLayout(syncPlacements(artifactIds.value, props.modelValue));
}

const slotOccupants = computed(() => {
  const map = new Map<number, string[]>();
  for (const artifact of props.artifacts) {
    const placement = props.modelValue.find((item) => item.artifactId === artifact.id);
    if (!placement || !isSlot(placement.slot)) continue;
    const owners = map.get(placement.slot) ?? [];
    owners.push(artifact.name);
    map.set(placement.slot, owners);
  }
  return map;
});

function occupantName(slot: number): string {
  return slotOccupants.value.get(slot)?.join('、') ?? '';
}

function chipClass(slot: number) {
  const owners = slotOccupants.value.get(slot);
  if (!owners || owners.length === 0) return 'empty';
  return owners.length > 1 ? 'conflict' : 'filled';
}

function focusSlot(slot: LayoutSlot) {
  const first = props.artifacts.find((artifact) => placementOf(artifact.id).slot === slot);
  if (first) {
    document
      .querySelector<HTMLElement>(`[data-artifact-slot="${first.id}"]`)
      ?.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }
}
</script>

<style scoped>
.layout-planner {
  display: grid;
  gap: 14px;
  padding: 14px;
  background: rgba(250, 246, 236, 0.74);
  border: 1px solid rgba(23, 63, 53, 0.12);
  border-radius: 6px;
}

.layout-planner header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

.layout-planner h3 {
  margin: 0;
  font-size: 15px;
}

.layout-planner header small {
  color: rgba(31, 46, 41, 0.62);
}

.slot-map {
  display: grid;
  gap: 10px;
}

.wall {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  align-items: center;
  padding: 10px;
  background: #f6efe2;
  border: 1px dashed rgba(23, 63, 53, 0.24);
  border-radius: 6px;
}

.wall-label {
  flex: 0 0 auto;
  color: var(--museum-brass);
  font-size: 12px;
  font-weight: 800;
}

.side-walls {
  display: grid;
  grid-template-columns: 1fr minmax(120px, 0.4fr) 1fr;
  gap: 10px;
}

.hall-center {
  display: grid;
  place-items: center;
  color: rgba(31, 46, 41, 0.4);
  font-size: 12px;
  letter-spacing: 0.4em;
}

.slot-chip {
  display: grid;
  min-width: 84px;
  flex: 1 1 84px;
  gap: 2px;
  padding: 6px 8px;
  text-align: left;
  border: 1px solid rgba(23, 63, 53, 0.18);
  border-radius: 6px;
  cursor: pointer;
}

.slot-chip i {
  font-style: normal;
  font-weight: 800;
  font-size: 12px;
}

.slot-chip em {
  overflow: hidden;
  font-style: normal;
  font-size: 11px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.slot-chip.empty {
  color: rgba(31, 46, 41, 0.45);
  background: transparent;
}

.slot-chip.filled {
  color: var(--museum-ink);
  background: #e4ede9;
  border-color: rgba(23, 63, 53, 0.42);
}

.slot-chip.conflict {
  color: #8a2b20;
  background: #f6e0dc;
  border-color: #bb4d3e;
}

.placement-list {
  display: grid;
  gap: 8px;
}

.placement-row {
  display: grid;
  grid-template-columns: minmax(120px, 1.1fr) 130px minmax(150px, 1.4fr) minmax(150px, 1.4fr);
  gap: 12px;
  align-items: center;
  padding: 10px 12px;
  background: #fbf5e8;
  border: 1px solid rgba(23, 63, 53, 0.1);
  border-radius: 6px;
}

.artifact-name {
  font-size: 13px;
}

.facing-field,
.scale-field {
  display: grid;
  gap: 4px;
  font-size: 12px;
  color: rgba(31, 46, 41, 0.72);
}

.empty-hint {
  margin: 0;
  color: rgba(31, 46, 41, 0.55);
  font-size: 13px;
}

@media (max-width: 900px) {
  .placement-row {
    grid-template-columns: 1fr 120px;
  }

  .side-walls {
    grid-template-columns: 1fr;
  }
}
</style>
