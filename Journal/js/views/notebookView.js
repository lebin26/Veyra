/**
 * notebookView.js
 * Professional Trading Notes & Psychology Log (PRD Section 67):
 * - Market observations, mistakes, psychological reflections, lessons
 * - Category filter chips & quick search
 * - Pinned notes support
 * - Add & Delete Note Modal
 */

import { NotebookRepo } from '../db/notebookRepo.js';

export class NotebookView {
  constructor(options = {}) {
    this.container = options.container;
    this.notes = [];
    this.activeCategory = 'ALL';
    this.searchQuery = '';
  }

  async render() {
    this.notes = await NotebookRepo.getAllNotes();

    this.container.innerHTML = `
      <div class="view-header" style="padding: 16px 24px; border-bottom: 1px solid var(--border-default); background: var(--bg-panel); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div class="header-left" style="display: flex; align-items: center; gap: 12px;">
          <h1 class="view-title" style="font-size: 20px; font-weight: 700; margin: 0; color: var(--text-primary); letter-spacing: -0.02em;">Notebook</h1>
          <span style="font-size: 11.5px; color: var(--text-secondary); background: var(--fill-subtle); padding: 3px 8px; border-radius: var(--radius-chip);" id="notebook-count-badge">
            ${this.notes.length} Notes
          </span>
        </div>

        <div class="header-right" style="display: flex; align-items: center; gap: 8px;">
          <input type="text" class="table-search-input" id="note-search" placeholder="Search notes..." style="padding: 5px 10px; font-size: 11.5px; width: 180px;">
          <button class="btn btn-primary" id="btn-add-note" style="padding: 6px 14px; font-weight: 700; font-size: 12px; background: var(--accent); color: #FFF; border: none; border-radius: var(--radius-control); cursor: pointer; display: flex; align-items: center; gap: 6px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            + Add Note
          </button>
        </div>
      </div>

      <div class="view-content" id="notebook-content" style="padding: 24px; max-width: 1200px; margin: 0 auto; width: 100%;">
        <!-- Category Filter Chips -->
        <div style="display: flex; gap: 8px; margin-bottom: 20px; flex-wrap: wrap;">
          <button class="chip-filter ${this.activeCategory === 'ALL' ? 'active' : ''}" data-cat="ALL">All Categories</button>
          <button class="chip-filter ${this.activeCategory === 'mistakes' ? 'active' : ''}" data-cat="mistakes">⚠️ Mistakes</button>
          <button class="chip-filter ${this.activeCategory === 'psychology' ? 'active' : ''}" data-cat="psychology">🧠 Psychology</button>
          <button class="chip-filter ${this.activeCategory === 'market' ? 'active' : ''}" data-cat="market">📈 Market</button>
          <button class="chip-filter ${this.activeCategory === 'lessons' ? 'active' : ''}" data-cat="lessons">💡 Lessons</button>
        </div>

        <div id="notes-grid" style="display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 16px;"></div>
      </div>
    `;

    this.bindEvents();
    this.renderNotes();
  }

  bindEvents() {
    this.container.querySelectorAll('.chip-filter').forEach(chip => {
      chip.addEventListener('click', () => {
        this.container.querySelectorAll('.chip-filter').forEach(c => c.classList.remove('active'));
        chip.classList.add('active');
        this.activeCategory = chip.dataset.cat;
        this.renderNotes();
      });
    });

    const searchInput = this.container.querySelector('#note-search');
    if (searchInput) {
      searchInput.addEventListener('input', (e) => {
        this.searchQuery = e.target.value.toLowerCase();
        this.renderNotes();
      });
    }

    this.container.querySelector('#btn-add-note').addEventListener('click', () => {
      this.openAddNoteModal();
    });
  }

  renderNotes() {
    const grid = this.container.querySelector('#notes-grid');
    if (!grid) return;

    let filtered = this.notes;
    if (this.activeCategory !== 'ALL') {
      filtered = filtered.filter(n => (n.category || '').toLowerCase() === this.activeCategory);
    }
    if (this.searchQuery) {
      filtered = filtered.filter(n => 
        (n.title && n.title.toLowerCase().includes(this.searchQuery)) ||
        (n.content && n.content.toLowerCase().includes(this.searchQuery)) ||
        (n.symbol && n.symbol.toLowerCase().includes(this.searchQuery))
      );
    }

    if (filtered.length === 0) {
      grid.innerHTML = `
        <div style="grid-column: 1 / -1; padding: 48px 16px; text-align: center; color: var(--text-tertiary); font-size: 12px;">
          No notes found in this category. Click "+ Add Note" to log your insights.
        </div>
      `;
      return;
    }

    grid.innerHTML = filtered.map(n => {
      const isPinned = n.pinned ? '📌 ' : '';
      return `
        <div class="kpi-card" style="padding: 16px; display: flex; flex-direction: column; justify-content: space-between; border-radius: var(--radius-panel); border: 1px solid var(--border-default); min-height: 140px;">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
              <span style="font-size: 14px; font-weight: 700; color: var(--text-primary);">${isPinned}${n.title}</span>
              <span style="font-size: 9.5px; font-weight: 700; text-transform: uppercase; padding: 2px 6px; border-radius: 4px; background: var(--fill-subtle); color: var(--text-secondary);">
                ${n.category || 'General'}
              </span>
            </div>
            <p style="font-size: 12px; color: var(--text-secondary); line-height: 1.45; margin: 6px 0; white-space: pre-wrap;">${n.content}</p>
          </div>

          <div style="border-top: 1px solid var(--border-default); padding-top: 8px; margin-top: 10px; display: flex; justify-content: space-between; align-items: center; font-size: 10.5px; color: var(--text-tertiary);">
            <span>${n.created_at ? n.created_at.substring(0, 10) : ''} ${n.symbol ? `· ${n.symbol}` : ''}</span>
            <button type="button" class="btn-delete-note" data-id="${n.id}" style="background: none; border: none; color: var(--color-loss); cursor: pointer; font-size: 10.5px;">Delete</button>
          </div>
        </div>
      `;
    }).join('');

    grid.querySelectorAll('.btn-delete-note').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        if (confirm('Delete this note?')) {
          await NotebookRepo.deleteNote(id);
          this.notes = await NotebookRepo.getAllNotes();
          this.renderNotes();
        }
      });
    });
  }

  openAddNoteModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-card" style="max-width: 480px; width: 90%;">
        <div class="modal-header">
          <div class="modal-title">Add Trading Note</div>
          <button type="button" class="modal-close" id="modal-note-close">&times;</button>
        </div>
        <div class="modal-body" style="display: flex; flex-direction: column; gap: 12px; padding: 18px 20px;">
          <div>
            <label class="modal-field-label">Title *</label>
            <input type="text" class="modal-input" id="note-title" placeholder="e.g. FOMC Volatility Observation" required>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div>
              <label class="modal-field-label">Category</label>
              <select class="modal-select" id="note-cat">
                <option value="market">Market</option>
                <option value="mistakes">Mistakes</option>
                <option value="psychology">Psychology</option>
                <option value="lessons">Lessons</option>
              </select>
            </div>
            <div>
              <label class="modal-field-label">Related Symbol</label>
              <input type="text" class="modal-input" id="note-sym" placeholder="e.g. XAUUSD">
            </div>
          </div>
          <div>
            <label class="modal-field-label">Content *</label>
            <textarea class="modal-textarea" id="note-content" rows="4" placeholder="Write observation, psychological triggers, or lesson learned..." required></textarea>
          </div>
        </div>
        <div class="modal-footer" style="padding: 14px 20px; border-top: 1px solid var(--border-default); display: flex; justify-content: flex-end; gap: 8px;">
          <button type="button" class="btn btn-secondary btn-sm" id="modal-note-cancel">Cancel</button>
          <button type="button" class="btn btn-primary btn-sm" id="modal-note-save" style="background: var(--accent); color: #FFF; border: none; padding: 6px 16px;">Save Note</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => {
      if (document.body.contains(modal)) document.body.removeChild(modal);
    };

    modal.querySelector('#modal-note-close').addEventListener('click', close);
    modal.querySelector('#modal-note-cancel').addEventListener('click', close);

    modal.querySelector('#modal-note-save').addEventListener('click', async () => {
      const title = modal.querySelector('#note-title').value.trim();
      const content = modal.querySelector('#note-content').value.trim();
      if (!title || !content) return alert('Title and content are required');

      await NotebookRepo.createNote({
        title,
        content,
        category: modal.querySelector('#note-cat').value,
        symbol: modal.querySelector('#note-sym').value.trim()
      });

      close();
      this.notes = await NotebookRepo.getAllNotes();
      this.renderNotes();
    });
  }
}
