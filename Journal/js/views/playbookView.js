/**
 * playbookView.js
 * Trading Playbook Strategy Center (PDF Page 5, PRD 54-58):
 * - Top Tabs: My Playbook, Shared Playbook
 * - Empty State matching PDF Page 5 illustration & text
 * - Playbook Strategy Cards: Rules, Market, Timeframe, Direction, Risk Model, Status
 * - Create & Edit Playbook Modal
 */

import { PlaybookRepo } from '../db/playbookRepo.js';
import { LiveRepo } from '../db/liveRepo.js';

export class PlaybookView {
  constructor(options = {}) {
    this.container = options.container;
    this.activeTab = 'my'; // 'my' | 'shared'
    this.playbooks = [];
    this.trades = [];
  }

  async render() {
    this.playbooks = await PlaybookRepo.getAllPlaybooks();
    this.trades = await LiveRepo.getAllTrades();

    this.container.innerHTML = `
      <div class="view-header" style="padding: 16px 24px; border-bottom: 1px solid var(--border-default); background: var(--bg-panel); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div class="header-left" style="display: flex; align-items: center; gap: 16px;">
          <h1 class="view-title" style="font-size: 20px; font-weight: 700; margin: 0; color: var(--text-primary); letter-spacing: -0.02em;">Playbook</h1>
          
          <!-- Segmented Tab: My Playbook vs Shared Playbook -->
          <div class="segmented-control" style="display: flex; background: var(--fill-subtle); padding: 2px; border-radius: var(--radius-control); border: 1px solid var(--border-default);">
            <button type="button" class="tab-btn ${this.activeTab === 'my' ? 'active' : ''}" data-tab="my" style="padding: 4px 14px; font-size: 11.5px; font-weight: 600; border: none; border-radius: 6px; background: ${this.activeTab === 'my' ? 'var(--bg-panel)' : 'transparent'}; color: var(--text-primary); cursor: pointer; box-shadow: ${this.activeTab === 'my' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'};">My Playbook</button>
            <button type="button" class="tab-btn ${this.activeTab === 'shared' ? 'active' : ''}" data-tab="shared" style="padding: 4px 14px; font-size: 11.5px; font-weight: 600; border: none; border-radius: 6px; background: ${this.activeTab === 'shared' ? 'var(--bg-panel)' : 'transparent'}; color: var(--text-primary); cursor: pointer; box-shadow: ${this.activeTab === 'shared' ? '0 1px 2px rgba(0,0,0,0.06)' : 'none'};">Shared Playbook</button>
          </div>
        </div>

        <div class="header-right" style="display: flex; align-items: center; gap: 8px;">
          <button class="btn btn-primary" id="btn-create-playbook" style="padding: 6px 14px; font-weight: 700; font-size: 12px; background: var(--accent); color: #FFF; border: none; border-radius: var(--radius-control); cursor: pointer; display: flex; align-items: center; gap: 6px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            + Create Playbook
          </button>
        </div>
      </div>

      <div class="view-content" id="playbook-content" style="padding: 32px 24px; max-width: 1200px; margin: 0 auto; width: 100%;">
        <div id="playbook-cards-host"></div>
      </div>
    `;

    this.bindEvents();
    this.renderCards();
  }

  bindEvents() {
    this.container.querySelectorAll('.tab-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        this.container.querySelectorAll('.tab-btn').forEach(b => {
          b.classList.remove('active');
          b.style.background = 'transparent';
          b.style.boxShadow = 'none';
        });
        btn.classList.add('active');
        btn.style.background = 'var(--bg-panel)';
        btn.style.boxShadow = '0 1px 2px rgba(0,0,0,0.06)';
        this.activeTab = btn.dataset.tab;
        this.renderCards();
      });
    });

    this.container.querySelector('#btn-create-playbook').addEventListener('click', () => {
      this.openCreateModal();
    });
  }

  renderCards() {
    const host = this.container.querySelector('#playbook-cards-host');
    if (!host) return;

    if (this.activeTab === 'shared') {
      host.innerHTML = `
        <div style="padding: 60px 20px; text-align: center; color: var(--text-tertiary);">
          <div style="font-size: 32px; margin-bottom: 8px;">🤝</div>
          <div style="font-size: 15px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">Shared Playbooks</div>
          <div style="font-size: 12px;">No shared community playbooks active. Discover verified quant strategies here soon.</div>
        </div>
      `;
      return;
    }

    if (this.playbooks.length === 0) {
      // PDF Page 5 Empty State
      host.innerHTML = `
        <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; padding: 60px 20px; text-align: center;">
          <div style="width: 72px; height: 72px; border-radius: 50%; background: rgba(91, 85, 217, 0.1); display: flex; align-items: center; justify-content: center; margin-bottom: 16px;">
            <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="var(--accent)" stroke-width="2">
              <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path>
              <polyline points="14 2 14 8 20 8"></polyline>
              <line x1="12" y1="18" x2="12" y2="12"></line>
              <line x1="9" y1="15" x2="15" y2="15"></line>
            </svg>
          </div>
          <h2 style="font-size: 18px; font-weight: 700; color: var(--text-primary); margin-bottom: 6px;">Build your Trading Playbook</h2>
          <p style="font-size: 12px; color: var(--text-secondary); max-width: 380px; margin-bottom: 16px;">
            List your rules, track and optimize your playbook. Transition from subjective trading to systematic execution.
          </p>
          <button class="btn btn-primary" id="btn-empty-create" style="padding: 8px 18px; font-weight: 700; font-size: 12px; background: var(--accent); color: #FFF; border: none; border-radius: var(--radius-control); cursor: pointer;">
            + Create Playbook
          </button>
        </div>
      `;
      host.querySelector('#btn-empty-create').addEventListener('click', () => this.openCreateModal());
      return;
    }

    // Render Strategy Cards
    const cardsHtml = this.playbooks.map(pb => {
      // Find trades for this playbook
      const matchedTrades = this.trades.filter(t => t.setup === pb.name || (t.notes && t.notes.includes(pb.name)));
      const winTrades = matchedTrades.filter(t => (t.pnl || 0) > 0);
      const winRate = matchedTrades.length > 0 ? (winTrades.length / matchedTrades.length) * 100 : 0;
      const totalPnl = matchedTrades.reduce((acc, t) => acc + (t.pnl || 0), 0);

      return `
        <div class="kpi-card" style="padding: 18px 20px; display: flex; flex-direction: column; justify-content: space-between; gap: 14px; border: 1px solid var(--border-default); border-radius: var(--radius-panel);">
          <div>
            <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px;">
              <div>
                <span style="font-size: 15px; font-weight: 700; color: var(--text-primary);">${pb.name}</span>
                <div style="font-size: 11px; color: var(--text-secondary); margin-top: 2px;">${pb.market || 'Any Market'} · ${pb.timeframe || 'Any TF'} · ${pb.session || 'All Sessions'}</div>
              </div>
              <span style="font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: var(--radius-chip); background: rgba(34, 197, 94, 0.1); color: var(--color-profit);">
                ${pb.status || 'Active'}
              </span>
            </div>
            
            <p style="font-size: 12px; color: var(--text-secondary); line-height: 1.4; margin: 8px 0;">
              ${pb.description || 'Systematic entry and risk model.'}
            </p>

            <div style="background: var(--fill-subtle); border-radius: var(--radius-control); padding: 8px 10px; font-size: 11px; color: var(--text-primary); margin-top: 6px;">
              <span style="font-weight: 700; color: var(--text-secondary);">Rules: </span>${pb.rules || 'Strict risk validation before market entry.'}
            </div>
          </div>

          <!-- Bottom Performance & Actions -->
          <div style="border-top: 1px solid var(--border-default); padding-top: 10px; display: flex; justify-content: space-between; align-items: center; font-size: 11px;">
            <div style="display: flex; gap: 14px; font-family: var(--font-mono);">
              <span><strong>${matchedTrades.length}</strong> Trades</span>
              <span><strong>${winRate.toFixed(0)}%</strong> Win</span>
              <span style="color: ${totalPnl >= 0 ? 'var(--color-profit)' : 'var(--color-loss)'};"><strong>${totalPnl >= 0 ? '+' : ''}$${totalPnl.toFixed(0)}</strong></span>
            </div>
            <button type="button" class="btn btn-secondary btn-sm btn-delete-pb" data-id="${pb.id}" style="color: var(--color-loss); border: none; background: transparent; cursor: pointer; padding: 4px 6px;">
              Delete
            </button>
          </div>
        </div>
      `;
    }).join('');

    host.innerHTML = `
      <div style="display: grid; grid-template-columns: repeat(auto-fill, minmax(min(100%, 300px), 1fr)); gap: 16px;">
        ${cardsHtml}
      </div>
    `;

    host.querySelectorAll('.btn-delete-pb').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        if (confirm('Delete this playbook strategy?')) {
          await PlaybookRepo.deletePlaybook(id);
          this.playbooks = await PlaybookRepo.getAllPlaybooks();
          this.renderCards();
        }
      });
    });
  }

  openCreateModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-card" style="max-width: 520px; width: 92%;">
        <div class="modal-header">
          <div class="modal-title">Create Playbook Strategy</div>
          <button type="button" class="modal-close" id="modal-pb-close">&times;</button>
        </div>
        <div class="modal-body" style="display: flex; flex-direction: column; gap: 12px; padding: 18px 20px;">
          <div>
            <label class="modal-field-label">Strategy Name *</label>
            <input type="text" class="modal-input" id="pb-name" placeholder="e.g. London Breakout" required>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div>
              <label class="modal-field-label">Market / Symbol</label>
              <input type="text" class="modal-input" id="pb-market" placeholder="e.g. XAUUSD, GER40">
            </div>
            <div>
              <label class="modal-field-label">Timeframe</label>
              <input type="text" class="modal-input" id="pb-timeframe" placeholder="e.g. 5M / 15M">
            </div>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div>
              <label class="modal-field-label">Direction</label>
              <select class="modal-select" id="pb-direction">
                <option value="Both">Both (Long & Short)</option>
                <option value="Long">Long only</option>
                <option value="Short">Short only</option>
              </select>
            </div>
            <div>
              <label class="modal-field-label">Trading Session</label>
              <input type="text" class="modal-input" id="pb-session" placeholder="e.g. London / NY">
            </div>
          </div>
          <div>
            <label class="modal-field-label">Entry Rules & Conditions</label>
            <textarea class="modal-textarea" id="pb-rules" rows="3" placeholder="Define exact technical confirmation checklist..."></textarea>
          </div>
          <div>
            <label class="modal-field-label">Risk & Exit Model</label>
            <input type="text" class="modal-input" id="pb-risk" placeholder="e.g. Fixed 1R risk, 2R minimum target">
          </div>
        </div>
        <div class="modal-footer" style="padding: 14px 20px; border-top: 1px solid var(--border-default); display: flex; justify-content: flex-end; gap: 8px;">
          <button type="button" class="btn btn-secondary btn-sm" id="modal-pb-cancel">Cancel</button>
          <button type="button" class="btn btn-primary btn-sm" id="modal-pb-save" style="background: var(--accent); color: #FFF; border: none; padding: 6px 16px;">Save Strategy</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => {
      if (document.body.contains(modal)) document.body.removeChild(modal);
    };

    modal.querySelector('#modal-pb-close').addEventListener('click', close);
    modal.querySelector('#modal-pb-cancel').addEventListener('click', close);

    modal.querySelector('#modal-pb-save').addEventListener('click', async () => {
      const name = modal.querySelector('#pb-name').value.trim();
      if (!name) return alert('Strategy name is required');

      await PlaybookRepo.createPlaybook({
        name,
        market: modal.querySelector('#pb-market').value.trim(),
        timeframe: modal.querySelector('#pb-timeframe').value.trim(),
        direction: modal.querySelector('#pb-direction').value,
        session: modal.querySelector('#pb-session').value.trim(),
        rules: modal.querySelector('#pb-rules').value.trim(),
        risk_model: modal.querySelector('#pb-risk').value.trim()
      });

      close();
      this.playbooks = await PlaybookRepo.getAllPlaybooks();
      this.renderCards();
    });
  }
}
