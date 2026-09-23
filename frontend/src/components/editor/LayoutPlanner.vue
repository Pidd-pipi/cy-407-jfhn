<template>
  <section class="layout-planner">
    <header>
      <div>
        <h3>布置方案</h3>
        <small>每件展品占用 1-{{ GALLERY_SLOT_COUNT }} 号唯一槽位，可设置朝向与缩放；发布时需覆盖全部已选展品。</small>
      </div>
      <n-button size="small" secondary :disabled="artifacts.length === 0" @click="autoAssign">自动分配槽位</n-button>
    </header>

    <div class="slot-map">
      <div v-for="group in slotGroups" :key="group.wall" class="slot-group">
        <span class="wall-label">{{ group.wall }}</span>
        <div class="slot-cells">
          <span
            v-for="cell in group.cells"
            :key="cell.slot"
            class="slot-cell"
            :class="{ occupied: cell.names.length > 0, duplicated: cell.names.length > 1 }"
            :title="cell.names.length > 0 ? cell.names.join('、') : `槽位 ${cell.slot} 空闲`"
          >
            {{ cell.slot }}
          </span>
        </div>
      </div>
    </div>

    <div v-if="artifacts.length > 0" class="planner-list">
      <div class="planner-row planner-head">
        <span>展品</span>
        <span>槽位</span>
        <span>朝向（度）</span>
        <span>缩放</span>
      </div>
      <div v-for="artifact in artifacts" :key="artifact.id" class="planner-row">
        <span class="artifact-name" :title="artifact.name">{{ artifact.name }}</span>
        <n-select
          size="small"
          clearable
          placeholder="未分配"
          :value="placementOf(artifact.id)?.slot ?? null"
          :options="slotOptions"
          @update:value="setSlot(artifact.id, $event)"
        />
        <n-input-number
          size="small"
          :show-button="false"
          :min="-180"
          :max="180"
          :step="5"
          :disabled="!placementOf(artifact.id)"
          :value="placementOf(artifact.id)?.rotation ?? 0"
          @update:value="setRotation(artifact.id, $event)"
        />
        <n-input-number
          size="small"
          :show-button="false"
          :min="MIN_PLACEMENT_SCALE"
          :max="MAX_PLACEMENT_SCALE"
          :step="0.1"
          :disabled="!placementOf(artifact.id)"
          :value="placementOf(artifact.id)?.scale ?? 1"
          @update:value="setScale(artifact.id, $event)"
        />
      </div>
    </div>
    <p v-else class="empty-hint">请先在上方勾选展品，再为每件展品分配槽位。</p>

    <n-alert v-if="problems.length > 0" type="warning" :show-icon="false" class="problem-alert">
      <p v-for="problem in problems" :key="problem">{{ problem }}</p>
    </n-alert>
  </section>
</template>

<script setup lang="ts">
import { computed, watch } from 'vue';
import type { Artifact, LayoutPlacement } from '@/types';
import {
  GALLERY_SLOT_COUNT,
  MAX_PLACEMENT_SCALE,
  MIN_PLACEMENT_SCALE,
  getSlotWall,
  validateExhibitionLayout
} from '@/utils/exhibition-layout';

const props = defineProps<{
  artifacts: Artifact[];
  modelValue: LayoutPlacement[];
}>();

const emit = defineEmits<{
  'update:modelValue': [placements: LayoutPlacement[]];
}>();

const placementMap = computed(() => new Map(props.modelValue.map((placement) => [placement.artifactId, placement])));

const slotOptions = computed(() =>
  Array.from({ length: GALLERY_SLOT_COUNT }, (_, index) => {
    const slot = index + 1;
    return { label: `${slot} 号位 · ${getSlotWall(slot)}`, value: slot };
  })
);

const slotGroups = computed(() => {
  const namesBySlot = new Map<number, string[]>();
  for (const placement of props.modelValue) {
    const artifact = props.artifacts.find((item) => item.id === placement.artifactId);
    if (!artifact) continue;
    const names = namesBySlot.get(placement.slot) ?? [];
    names.push(artifact.name);
    namesBySlot.set(placement.slot, names);
  }
  const walls = ['后墙', '左墙', '右墙'];
  return walls.map((wall) => ({
    wall,
    cells: Array.from({ length: GALLERY_SLOT_COUNT }, (_, index) => index + 1)
      .filter((slot) => getSlotWall(slot) === wall)
      .map((slot) => ({ slot, names: namesBySlot.get(slot) ?? [] }))
  }));
});

const problems = computed(() =>
  validateExhibitionLayout(
    props.artifacts.map((artifact) => artifact.id),
    props.modelValue
  )
);

// 取消勾选展品时同步移除其布置，避免遗留无效槽位占用
watch(
  () => props.artifacts.map((artifact) => artifact.id),
  (ids) => {
    const idSet = new Set(ids);
    const next = props.modelValue.filter((placement) => idSet.has(placement.artifactId));
    if (next.length !== props.modelValue.length) {
      emit('update:modelValue', next);
    }
  }
);

function placementOf(artifactId: string): LayoutPlacement | undefined {
  return placementMap.value.get(artifactId);
}

function upsert(artifactId: string, patch: Partial<Omit<LayoutPlacement, 'artifactId'>>) {
  const current = placementMap.value.get(artifactId);
  const base: LayoutPlacement = current ?? { artifactId, slot: 0, rotation: 0, scale: 1 };
  const merged = { ...base, ...patch };
  const next = current
    ? props.modelValue.map((placement) => (placement.artifactId === artifactId ? merged : placement))
    : [...props.modelValue, merged];
  emit('update:modelValue', next);
}

function setSlot(artifactId: string, slot: number | null) {
  if (slot === null) {
    emit(
      'update:modelValue',
      props.modelValue.filter((placement) => placement.artifactId !== artifactId)
    );
    return;
  }
  upsert(artifactId, { slot });
}

function setRotation(artifactId: string, rotation: number | null) {
  if (rotation === null) return;
  upsert(artifactId, { rotation });
}

function setScale(artifactId: string, scale: number | null) {
  if (scale === null) return;
  upsert(artifactId, { scale });
}

function autoAssign() {
  const used = new Set(props.modelValue.map((placement) => placement.slot));
  const next = [...props.modelValue];
  for (const artifact of props.artifacts) {
    if (placementMap.value.has(artifact.id)) continue;
    let slot = 1;
    while (used.has(slot) && slot <= GALLERY_SLOT_COUNT) slot += 1;
    if (slot > GALLERY_SLOT_COUNT) break;
    used.add(slot);
    next.push({ artifactId: artifact.id, slot, rotation: 0, scale: 1 });
  }
  emit('update:modelValue', next);
}
</script>

<style scoped>
.layout-planner {
  display: grid;
  gap: 12px;
}

header {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}

header h3,
header small {
  margin: 0;
}

header small {
  color: rgba(31, 46, 41, 0.62);
}

.slot-map {
  display: grid;
  gap: 8px;
  padding: 10px;
  background: rgba(250, 246, 236, 0.74);
  border: 1px solid rgba(23, 63, 53, 0.12);
  border-radius: 6px;
}

.slot-group {
  display: grid;
  grid-template-columns: 44px 1fr;
  gap: 10px;
  align-items: center;
}

.wall-label {
  color: var(--museum-brass);
  font-size: 12px;
  font-weight: 800;
}

.slot-cells {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 6px;
}

.slot-cell {
  display: grid;
  place-items: center;
  height: 26px;
  color: rgba(31, 46, 41, 0.56);
  font-size: 12px;
  background: #fbf5e8;
  border: 1px dashed rgba(23, 63, 53, 0.28);
  border-radius: 4px;
}

.slot-cell.occupied {
  color: #fbf5e8;
  background: var(--museum-green);
  border-style: solid;
}

.slot-cell.duplicated {
  background: var(--museum-brass);
  border-color: var(--museum-brass);
}

.planner-list {
  display: grid;
  gap: 6px;
}

.planner-row {
  display: grid;
  grid-template-columns: minmax(0, 1.2fr) minmax(0, 1.1fr) minmax(0, 0.9fr) minmax(0, 0.8fr);
  gap: 8px;
  align-items: center;
}

.planner-head {
  color: rgba(31, 46, 41, 0.56);
  font-size: 12px;
}

.artifact-name {
  overflow: hidden;
  font-size: 13px;
  text-overflow: ellipsis;
  white-space: nowrap;
}

.empty-hint {
  margin: 0;
  color: rgba(31, 46, 41, 0.56);
  font-size: 13px;
}

.problem-alert p {
  margin: 0;
}

.problem-alert p + p {
  margin-top: 4px;
}

@media (max-width: 680px) {
  .planner-row {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
