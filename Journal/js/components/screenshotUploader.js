/**
 * screenshotUploader.js
 * 交易截图管理器：
 * - 拖拽上传 (Drag & Drop)
 * - 点击上传 (Click Upload)
 * - 多图管理 (Multiple images)
 * - 图片本地预览 (Image preview)
 * - 全屏大图查看 (Fullscreen lightbox)
 * - 删除截图 (Delete image)
 * - 图片以原始 Blob 存入 IndexedDB，绝无外部网络请求
 */

export class ScreenshotUploader {
  constructor(options = {}) {
    this.container = options.container;
    this.screenshots = options.initialScreenshots ? [...options.initialScreenshots] : [];
    this.onChange = options.onChange || (() => {});
    this.readOnly = options.readOnly || false;
    this.init();
  }

  init() {
    this.render();
  }

  setScreenshots(screenshots) {
    this.screenshots = [...screenshots];
    this.render();
  }

  getScreenshots() {
    return this.screenshots;
  }

  render() {
    if (!this.container) return;
    this.container.innerHTML = '';

    const wrapper = document.createElement('div');
    wrapper.className = 'screenshot-manager';

    if (!this.readOnly) {
      // 拖拽上传区域
      const dropZone = document.createElement('div');
      dropZone.className = 'screenshot-upload-zone';
      dropZone.innerHTML = `
        <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" style="margin-bottom: 4px; color: var(--text-secondary);">
          <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
          <polyline points="17 8 12 3 7 8"></polyline>
          <line x1="12" y1="3" x2="12" y2="15"></line>
        </svg>
        <div style="font-size: 11.5px; font-weight: 600; color: var(--text-main);">Click or drag & drop screenshots</div>
        <div style="font-size: 10.5px; color: var(--text-tertiary);">PNG, JPG, WebP supported (Stored locally)</div>
        <input type="file" multiple accept="image/*" style="display: none;" class="screenshot-file-input">
      `;

      const fileInput = dropZone.querySelector('.screenshot-file-input');
      dropZone.addEventListener('click', () => fileInput.click());

      fileInput.addEventListener('change', (e) => {
        this.handleFiles(e.target.files);
        fileInput.value = '';
      });

      dropZone.addEventListener('dragover', (e) => {
        e.preventDefault();
        dropZone.classList.add('dragover');
      });

      dropZone.addEventListener('dragleave', () => {
        dropZone.classList.remove('dragover');
      });

      dropZone.addEventListener('drop', (e) => {
        e.preventDefault();
        dropZone.classList.remove('dragover');
        if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
          this.handleFiles(e.dataTransfer.files);
        }
      });

      wrapper.appendChild(dropZone);
    }

    // 缩略图列表
    if (this.screenshots.length > 0) {
      const previewList = document.createElement('div');
      previewList.className = 'screenshot-preview-list';

      this.screenshots.forEach((imgItem, index) => {
        const card = document.createElement('div');
        card.className = 'screenshot-card';

        let url = '';
        if (imgItem.image_blob instanceof Blob) {
          url = URL.createObjectURL(imgItem.image_blob);
        } else if (imgItem.url) {
          url = imgItem.url;
        }

        const img = document.createElement('img');
        img.src = url;
        img.alt = imgItem.original_name || `Screenshot ${index + 1}`;
        card.appendChild(img);

        // 点击全屏查看
        card.addEventListener('click', (e) => {
          if (e.target.closest('.screenshot-card-delete')) return;
          this.openLightbox(url, imgItem.original_name);
        });

        // 删除按钮
        if (!this.readOnly) {
          const delBtn = document.createElement('button');
          delBtn.className = 'screenshot-card-delete';
          delBtn.innerHTML = '&times;';
          delBtn.title = 'Remove image';
          delBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.removeImage(index);
          });
          card.appendChild(delBtn);
        }

        previewList.appendChild(card);
      });

      wrapper.appendChild(previewList);
    } else if (this.readOnly) {
      const emptyNote = document.createElement('div');
      emptyNote.style.fontSize = '11.5px';
      emptyNote.style.color = 'var(--text-tertiary)';
      emptyNote.textContent = 'No screenshots uploaded for this trade.';
      wrapper.appendChild(emptyNote);
    }

    this.container.appendChild(wrapper);
  }

  handleFiles(files) {
    if (!files) return;
    const validFiles = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (validFiles.length === 0) return;

    for (const file of validFiles) {
      this.screenshots.push({
        id: `img_${Date.now()}_${Math.random().toString(36).substring(2, 7)}`,
        original_name: file.name,
        image_blob: file,
        mime_type: file.type,
        display_order: this.screenshots.length
      });
    }

    this.render();
    this.onChange(this.screenshots);
  }

  removeImage(index) {
    this.screenshots.splice(index, 1);
    this.render();
    this.onChange(this.screenshots);
  }

  openLightbox(src, title) {
    const overlay = document.createElement('div');
    overlay.className = 'lightbox-overlay';
    overlay.innerHTML = `
      <button class="lightbox-close">&times;</button>
      <div class="lightbox-content">
        <img class="lightbox-img" src="${src}" alt="${title || 'Fullscreen Preview'}">
      </div>
    `;

    overlay.querySelector('.lightbox-close').addEventListener('click', () => {
      document.body.removeChild(overlay);
    });

    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) {
        document.body.removeChild(overlay);
      }
    });

    document.body.appendChild(overlay);
  }
}
