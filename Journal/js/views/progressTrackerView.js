/**
 * progressTrackerView.js
 * Progress Tracker & Trader Growth Milestones (PRD Section 69):
 * - Target metrics vs current execution performance
 * - Visual progress bars & completion status
 * - Add, update & track quantitative trader milestones
 */

import { GoalRepo } from '../db/goalRepo.js';
import { LiveRepo } from '../db/liveRepo.js';
import { aggregateMetrics } from '../core/calculations.js';

export class ProgressTrackerView {
  constructor(options = {}) {
    this.container = options.container;
    this.goals = [];
    this.metrics = {};
  }

  async render() {
    this.goals = await GoalRepo.getAllGoals();
    const trades = await LiveRepo.getAllTrades();
    this.metrics = aggregateMetrics(trades);

    // Auto-update goals based on actual metrics
    for (const g of this.goals) {
      if (g.metric_type === 'win_rate') {
        g.current = Number((this.metrics.winRate || 0).toFixed(1));
      } else if (g.metric_type === 'discipline') {
        g.current = Number((this.metrics.planAdherenceRate || 0).toFixed(1));
      }
    }

    this.container.innerHTML = `
      <div class="view-header" style="padding: 16px 24px; border-bottom: 1px solid var(--border-default); background: var(--bg-panel); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px;">
        <div class="header-left" style="display: flex; align-items: center; gap: 12px;">
          <h1 class="view-title" style="font-size: 20px; font-weight: 700; margin: 0; color: var(--text-primary); letter-spacing: -0.02em;">Progress Tracker</h1>
          <span style="font-size: 10px; font-weight: 800; background: var(--accent); color: #FFF; padding: 2px 7px; border-radius: var(--radius-chip);">NEW</span>
        </div>

        <div class="header-right" style="display: flex; align-items: center; gap: 8px;">
          <button class="btn btn-primary" id="btn-add-goal" style="padding: 6px 14px; font-weight: 700; font-size: 12px; background: var(--accent); color: #FFF; border: none; border-radius: var(--radius-control); cursor: pointer; display: flex; align-items: center; gap: 6px;">
            <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
            + Set New Goal
          </button>
        </div>
      </div>

      <div class="view-content" id="progress-content" style="padding: 28px 24px; max-width: 1000px; margin: 0 auto; width: 100%;">
        <div id="goals-list-container" style="display: flex; flex-direction: column; gap: 16px;"></div>
      </div>
    `;

    this.bindEvents();
    this.renderGoals();
  }

  bindEvents() {
    this.container.querySelector('#btn-add-goal').addEventListener('click', () => {
      this.openAddGoalModal();
    });
  }

  renderGoals() {
    const list = this.container.querySelector('#goals-list-container');
    if (!list) return;

    if (this.goals.length === 0) {
      list.innerHTML = `
        <div style="padding: 60px 16px; text-align: center; color: var(--text-tertiary);">
          <div style="font-size: 32px; margin-bottom: 8px;">🎯</div>
          <div style="font-size: 15px; font-weight: 700; color: var(--text-primary); margin-bottom: 4px;">No Active Goals</div>
          <div style="font-size: 12px; margin-bottom: 16px;">Set targets for win rate, profit factor, or trade plan adherence.</div>
          <button class="btn btn-primary btn-sm" id="btn-empty-goal" style="background: var(--accent); color: #FFF; border: none; padding: 6px 16px;">+ Set New Goal</button>
        </div>
      `;
      list.querySelector('#btn-empty-goal').addEventListener('click', () => this.openAddGoalModal());
      return;
    }

    list.innerHTML = this.goals.map(g => {
      const pct = Math.min(100, Math.max(0, Math.round((g.current / (g.target || 1)) * 100)));
      const isCompleted = pct >= 100;

      return `
        <div class="kpi-card" style="padding: 18px 20px; border-radius: var(--radius-panel); border: 1px solid var(--border-default); display: flex; flex-direction: column; gap: 12px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start;">
            <div>
              <div style="font-size: 15px; font-weight: 700; color: var(--text-primary);">${g.title}</div>
              <div style="font-size: 11.5px; color: var(--text-secondary); margin-top: 2px;">
                Target: ${g.target} ${g.unit || ''} · Deadline: ${g.deadline || 'Ongoing'}
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="font-size: 10px; font-weight: 700; padding: 2px 8px; border-radius: var(--radius-chip); background: ${isCompleted ? 'rgba(34, 197, 94, 0.1)' : 'var(--fill-subtle)'}; color: ${isCompleted ? 'var(--color-profit)' : 'var(--text-secondary)'};">
                ${isCompleted ? 'COMPLETED' : `${pct}%`}
              </span>
              <button type="button" class="btn-delete-goal" data-id="${g.id}" style="background: none; border: none; color: var(--color-loss); cursor: pointer; font-size: 11px;">✕</button>
            </div>
          </div>

          <!-- Progress Bar -->
          <div>
            <div style="display: flex; justify-content: space-between; font-size: 11px; font-family: var(--font-mono); color: var(--text-secondary); margin-bottom: 4px;">
              <span>Current: <strong>${g.current} ${g.unit || ''}</strong></span>
              <span>Goal: <strong>${g.target} ${g.unit || ''}</strong></span>
            </div>
            <div style="height: 8px; width: 100%; background: var(--fill-subtle); border-radius: 999px; overflow: hidden;">
              <div style="width: ${pct}%; height: 100%; background: ${isCompleted ? 'var(--color-profit)' : 'var(--accent)'}; border-radius: 999px; transition: width 0.3s ease;"></div>
            </div>
          </div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.btn-delete-goal').forEach(btn => {
      btn.addEventListener('click', async (e) => {
        const id = e.target.dataset.id;
        if (confirm('Delete this goal?')) {
          await GoalRepo.deleteGoal(id);
          this.goals = await GoalRepo.getAllGoals();
          this.renderGoals();
        }
      });
    });
  }

  openAddGoalModal() {
    const modal = document.createElement('div');
    modal.className = 'modal-backdrop';
    modal.innerHTML = `
      <div class="modal-card" style="max-width: 460px; width: 90%;">
        <div class="modal-header">
          <div class="modal-title">Set Performance Goal</div>
          <button type="button" class="modal-close" id="modal-goal-close">&times;</button>
        </div>
        <div class="modal-body" style="display: flex; flex-direction: column; gap: 12px; padding: 18px 20px;">
          <div>
            <label class="modal-field-label">Goal Title *</label>
            <input type="text" class="modal-input" id="goal-title" placeholder="e.g. Keep Win Rate above 50%" required>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div>
              <label class="modal-field-label">Target Value *</label>
              <input type="number" class="modal-input" id="goal-target" placeholder="e.g. 50" step="any" required>
            </div>
            <div>
              <label class="modal-field-label">Unit</label>
              <input type="text" class="modal-input" id="goal-unit" placeholder="e.g. %, $, R">
            </div>
          </div>
          <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 10px;">
            <div>
              <label class="modal-field-label">Metric Type</label>
              <select class="modal-select" id="goal-metric">
                <option value="win_rate">Win Rate</option>
                <option value="discipline">Plan Adherence</option>
                <option value="pnl">P&L Amount</option>
                <option value="other">Custom Milestone</option>
              </select>
            </div>
            <div>
              <label class="modal-field-label">Deadline</label>
              <input type="date" class="modal-input" id="goal-deadline">
            </div>
          </div>
        </div>
        <div class="modal-footer" style="padding: 14px 20px; border-top: 1px solid var(--border-default); display: flex; justify-content: flex-end; gap: 8px;">
          <button type="button" class="btn btn-secondary btn-sm" id="modal-goal-cancel">Cancel</button>
          <button type="button" class="btn btn-primary btn-sm" id="modal-goal-save" style="background: var(--accent); color: #FFF; border: none; padding: 6px 16px;">Save Goal</button>
        </div>
      </div>
    `;

    document.body.appendChild(modal);

    const close = () => {
      if (document.body.contains(modal)) document.body.removeChild(modal);
    };

    modal.querySelector('#modal-goal-close').addEventListener('click', close);
    modal.querySelector('#modal-goal-cancel').addEventListener('click', close);

    modal.querySelector('#modal-goal-save').addEventListener('click', async () => {
      const title = modal.querySelector('#goal-title').value.trim();
      const target = Number(modal.querySelector('#goal-target').value);
      if (!title || isNaN(target)) return alert('Goal title and target are required');

      await GoalRepo.createGoal({
        title,
        target,
        unit: modal.querySelector('#goal-unit').value.trim(),
        metric_type: modal.querySelector('#goal-metric').value,
        deadline: modal.querySelector('#goal-deadline').value
      });

      close();
      this.goals = await GoalRepo.getAllGoals();
      this.renderGoals();
    });
  }
}
