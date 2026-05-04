<template>
  <a :href="href" target="_blank" rel="noopener noreferrer" class="file-attachment">
    <span class="file-attachment-icon">
      <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" 
           fill="none" stroke="currentColor" stroke-width="2" 
           stroke-linecap="round" stroke-linejoin="round">
        <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
        <polyline points="14 2 14 8 20 8"/>
        <line x1="12" y1="18" x2="12" y2="12"/>
        <line x1="9" y1="15" x2="12" y2="18"/>
        <line x1="15" y1="15" x2="12" y2="18"/>
      </svg>
    </span>
    <span class="file-attachment-body">
      <strong class="file-attachment-label">{{ label }}</strong>
      <span v-if="description" class="file-attachment-description">{{ description }}</span>
    </span>
    <span class="file-attachment-badge">{{ badge }}</span>
  </a>
</template>

<script setup>
defineProps({
  href:        { type: String, required: true },
  label:       { type: String, required: true },
  description: { type: String, default: '' },
  badge:       { type: String, default: 'PDF' },
})
</script>

<style scoped>
.file-attachment {
  display: inline-flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.75rem 1rem;
  margin: 0.5rem 0;
  border: 1px solid var(--vp-c-border);
  border-radius: 8px;
  text-decoration: none;
  color: var(--vp-c-text-1);
  background: var(--vp-c-bg-soft);
  transition: border-color 0.2s ease, background 0.2s ease;
  max-width: 480px;
  width: 100%;
}

.file-attachment:hover {
  border-color: var(--vp-c-brand-1);
  background: var(--vp-c-bg-alt);
}

.file-attachment-icon {
  flex-shrink: 0;
  color: var(--vp-c-brand-1);
}

.file-attachment-body {
  display: flex;
  flex-direction: column;
  gap: 0.15rem;
  flex: 1;
  min-width: 0;
}

.file-attachment-label {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--vp-c-text-1);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-attachment-description {
  font-size: 0.8rem;
  color: var(--vp-c-text-2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.file-attachment-badge {
  flex-shrink: 0;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.05em;
  text-transform: uppercase;
  padding: 0.2rem 0.45rem;
  border-radius: 4px;
  background: var(--vp-c-brand-soft);
  color: var(--vp-c-brand-1);
}
</style>