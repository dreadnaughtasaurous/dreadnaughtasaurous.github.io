<script setup>
import { EBA_REGISTRY } from '../eba-registry.js'
const ebas = EBA_REGISTRY.filter(e => !e.archived)
</script>

<template>
  <div class="eba-browse-grid">
    <div v-for="e in ebas" :key="e.slug" class="ebg-card"
         :style="{ borderTopColor: e.color }">
      <div class="ebg-card-body">
        <span class="ebg-dot" :style="{ background: e.color }"></span>
        <div>
          <div class="ebg-name">{{ e.shortName }}</div>
          <div class="ebg-full">{{ e.name }}</div>
        </div>
      </div>
      <div class="ebg-actions">
        <a :href="e.indexPath" class="ebg-link">Browse clauses →</a>
        <a :href="e.pdfPath"
           :target="e.pdfExternal ? '_blank' : undefined"
           :rel="e.pdfExternal ? 'noopener noreferrer' : undefined"
           class="ebg-link">
          {{ e.pdfExternal ? 'View on FWC ↗' : 'Download PDF ↓' }}
        </a>
      </div>
    </div>
  </div>
</template>

<style scoped>
.eba-browse-grid {
  display: grid;
  grid-template-columns: repeat(3, 1fr);
  gap: 0.85rem;
  margin: 1rem 0 2rem;
}

.ebg-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  border: 1px solid var(--vp-c-divider);
  border-top-width: 3px;
  border-radius: 8px;
  padding: 0.85rem;
  background: var(--vp-c-bg-soft);
  transition: box-shadow 0.15s;
}
.ebg-card:hover {
  box-shadow: 0 3px 12px rgba(0,0,0,0.07);
}
.dark .ebg-card:hover {
  box-shadow: 0 3px 14px rgba(0,0,0,0.28);
}

.ebg-card-body {
  display: flex;
  align-items: flex-start;
  gap: 0.6rem;
  margin-bottom: 0.75rem;
}

.ebg-dot {
  flex-shrink: 0;
  margin-top: 0.3rem;
  width: 8px;
  height: 8px;
  border-radius: 50%;
}

.ebg-name {
  font-size: 0.875rem;
  font-weight: 600;
  color: var(--vp-c-text-1);
  line-height: 1.3;
}

.ebg-full {
  font-size: 0.75rem;
  color: var(--vp-c-text-3);
  margin-top: 0.15rem;
}

.ebg-actions {
  display: flex;
  gap: 1rem;
  padding-top: 0.6rem;
  border-top: 1px solid var(--vp-c-divider);
}

.ebg-link {
  font-size: 0.775rem;
  font-weight: 500;
  color: var(--vp-c-brand-1);
  text-decoration: none;
}
.ebg-link:hover { text-decoration: underline; }

@media (max-width: 768px) {
  .eba-browse-grid { grid-template-columns: repeat(2, 1fr); }
}
@media (max-width: 480px) {
  .eba-browse-grid { grid-template-columns: 1fr; }
}
</style>