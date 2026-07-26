import "../index.css";

const root = document.getElementById("fixture-root");
if (!root) {
    throw new Error("missing fixture root");
}

root.innerHTML = `
<div class="min-h-screen bg-surface p-4 md:p-6 lg:p-8">
  <section
    data-testid="spacing-shell"
    class="mx-auto flex max-w-5xl flex-col gap-4 rounded-xl border border-outline-variant bg-surface-bright p-4 md:gap-6 md:p-6 lg:gap-8 lg:p-8"
  >
    <header class="flex items-center justify-between gap-4">
      <h1 class="text-title text-on-surface">Geometry fixture</h1>
      <button
        type="button"
        data-testid="icon-button"
        aria-label="Close fixture"
        class="icon-btn"
      >
        ×
      </button>
    </header>
    <p class="text-body text-on-surface-variant">
      Visual baseline for spacing and keyboard focus checks.
    </p>
    <div data-testid="button-row" class="flex flex-wrap gap-4">
      <button type="button" class="btn btn-subtle">Secondary</button>
      <button type="button" class="btn btn-accent">Primary</button>
    </div>
    <div data-testid="empty-state" class="card card-pad">
      <h2 class="page-title">Empty section</h2>
      <p class="text-body text-on-surface-variant">No records available.</p>
    </div>
  </section>
</div>
`;
