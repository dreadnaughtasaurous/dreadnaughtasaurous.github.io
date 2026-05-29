<script setup>
import { ref, onMounted, onUnmounted } from 'vue'

const visible   = ref(false)
const progress  = ref(0)   // 0–1

// SVG ring geometry
const SIZE      = 48
const STROKE    = 3
const RADIUS    = (SIZE / 2) - (STROKE / 2)
const CIRCUMFERENCE = 2 * Math.PI * RADIUS  // ≈ 131.9

function onScroll() {
  const scrollY  = window.scrollY
  const maxScroll = document.documentElement.scrollHeight - window.innerHeight
  visible.value  = scrollY > 200
  progress.value = maxScroll > 0 ? Math.min(scrollY / maxScroll, 1) : 0
}

function scrollToTop() {
  const prefersReduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  window.scrollTo({ top: 0, behavior: prefersReduced ? 'auto' : 'smooth' })
}

onMounted(()  => window.addEventListener('scroll', onScroll, { passive: true }))
onUnmounted(() => window.removeEventListener('scroll', onScroll))
</script>

<template>
  <ClientOnly>
    <Teleport to="body">
      <button
        class="stt-btn"
        :class="{ 'stt-btn--visible': visible }"
        @click="scrollToTop"
        aria-label="Return to top"
      >
        <!-- Progress ring -->
        <svg
          class="stt-ring"
          :width="SIZE" :height="SIZE"
          :viewBox="`0 0 ${SIZE} ${SIZE}`"
          aria-hidden="true"
        >
          <!-- Track (background circle) -->
          <circle
            class="stt-ring__track"
            :cx="SIZE/2" :cy="SIZE/2" :r="RADIUS"
            fill="none"
            :stroke-width="STROKE"
          />
          <!-- Progress arc — starts at 12 o'clock (rotate -90deg) -->
          <circle
            class="stt-ring__progress"
            :cx="SIZE/2" :cy="SIZE/2" :r="RADIUS"
            fill="none"
            :stroke-width="STROKE"
            :stroke-dasharray="CIRCUMFERENCE"
            :stroke-dashoffset="CIRCUMFERENCE * (1 - progress)"
          />
        </svg>

        <!-- Chevron icon -->
        <svg class="stt-icon" viewBox="0 0 24 24" fill="none"
             stroke="currentColor" stroke-width="2.5"
             stroke-linecap="round" stroke-linejoin="round"
             aria-hidden="true">
          <polyline points="18 15 12 9 6 15"/>
        </svg>
      </button>
    </Teleport>
  </ClientOnly>
</template>

<style scoped>
.stt-btn {
  position:        fixed;
  bottom:          2rem;
  right:           1.5rem;
  z-index:         9990;
  width:           48px;
  height:          48px;
  border-radius:   50%;
  border:          none;
  cursor:          pointer;
  padding:         0;
  display:         flex;
  align-items:     center;
  justify-content: center;
  background:      var(--vp-c-bg);
  box-shadow:      0 2px 12px oklch(0 0 0 / 0.18);

  /* Hidden state */
  opacity:         0;
  pointer-events:  none;
  transform:       translateY(8px);
  transition:      opacity 0.25s ease, transform 0.25s ease, box-shadow 0.15s ease;
}

.stt-btn--visible {
  opacity:        1;
  pointer-events: auto;
  transform:      translateY(0);
}

.stt-btn:hover {
  box-shadow: 0 4px 18px oklch(0 0 0 / 0.24);
}

.stt-btn:focus-visible {
  outline:        3px solid var(--vp-c-brand-1);
  outline-offset: 3px;
}

/* Ring SVG — absolutely positioned over the button */
.stt-ring {
  position: absolute;
  inset:    0;
  /* Start arc at 12 o'clock */
  transform: rotate(-90deg);
}

.stt-ring__track {
  stroke: var(--vp-c-divider);
}

.stt-ring__progress {
  stroke:           var(--vp-c-brand-1);
  stroke-linecap:   round;
  transition:       stroke-dashoffset 0.1s linear;
}

/* Chevron — sits on top of the ring SVG */
.stt-icon {
  position: relative;
  width:    18px;
  height:   18px;
  color:    var(--vp-c-text-1);
  flex-shrink: 0;
}

/* Clear MobileNav on small screens */
@media (max-width: 768px) {
  .stt-btn {
    bottom: 5rem;
    right:  1rem;
  }
}
</style>