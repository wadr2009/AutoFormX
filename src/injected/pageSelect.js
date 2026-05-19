/**
 * 页面主世界：接收 postMessage，在 React 上下文中点击 Ant Design 选项
 */
(function () {
  if (window.__autoformxPageSelect) return;
  window.__autoformxPageSelect = true;

  const SOURCE = 'autoformx-extension';

  function getOptions(listboxId) {
    const listbox = listboxId ? document.getElementById(listboxId) : null;
    const container =
      listbox ||
      document.querySelector('.ant-select-dropdown:not(.ant-select-dropdown-hidden)');

    if (!container) return [];

    return Array.from(
      container.querySelectorAll(
        '.ant-select-item-option:not(.ant-select-item-option-disabled), [role="option"]:not([aria-disabled="true"])'
      )
    ).filter((node) => {
      const text = node.textContent?.trim();
      return text && !['请选择', '请选择所属行业'].includes(text);
    });
  }

  function clickNode(node) {
    if (!node) return false;
    node.scrollIntoView({ block: 'center', inline: 'nearest' });
    const target = node.querySelector('.ant-select-item-option-content') || node;
    target.dispatchEvent(
      new MouseEvent('mousedown', { bubbles: true, cancelable: true, view: window })
    );
    target.dispatchEvent(
      new MouseEvent('mouseup', { bubbles: true, cancelable: true, view: window })
    );
    target.click();
    return true;
  }

  function reply(requestId, payload) {
    window.postMessage({ source: SOURCE, requestId, ...payload }, '*');
  }

  window.addEventListener('message', (event) => {
    if (event.source !== window) return;
    const data = event.data;
    if (!data || data.source !== SOURCE || !data.action) return;

    const { action, requestId, listboxId, optionIndex, marker } = data;

    if (action === 'select-option') {
      let ok = false;
      let label = '';
      try {
        const options = getOptions(listboxId);
        const option = options[optionIndex];
        label =
          option?.querySelector('.ant-select-item-option-content')?.textContent?.trim() ||
          option?.textContent?.trim() ||
          '';
        ok = clickNode(option);
      } catch (error) {
        console.error('[AutoFormX][page] select-option failed', error);
      }
      reply(requestId, { action: 'select-option-result', ok, label });
      return;
    }

    if (action === 'keyboard-select') {
      let ok = false;
      try {
        const combobox = document.querySelector(
          `[data-autoformx-marker="${marker}"] [role="combobox"]`
        );
        if (combobox) {
          combobox.focus();
          for (let i = 0; i <= optionIndex; i++) {
            combobox.dispatchEvent(
              new KeyboardEvent('keydown', {
                key: 'ArrowDown',
                code: 'ArrowDown',
                keyCode: 40,
                bubbles: true,
                cancelable: true
              })
            );
          }
          combobox.dispatchEvent(
            new KeyboardEvent('keydown', {
              key: 'Enter',
              code: 'Enter',
              keyCode: 13,
              bubbles: true,
              cancelable: true
            })
          );
          ok = true;
        }
      } catch (error) {
        console.error('[AutoFormX][page] keyboard-select failed', error);
      }
      reply(requestId, { action: 'keyboard-select-result', ok });
      return;
    }

    if (action === 'fill-file') {
      (async () => {
        let ok = false;
        try {
          const input = document.querySelector(`[data-autoformx-file-marker="${data.marker}"]`);
          if (input) {
            const response = await fetch(data.fileUrl);
            const blob = await response.blob();
            const file = new File([blob], data.fileName, { type: data.mimeType });
            const dataTransfer = new DataTransfer();
            dataTransfer.items.add(file);
            input.files = dataTransfer.files;
            input.dispatchEvent(new Event('input', { bubbles: true }));
            input.dispatchEvent(new Event('change', { bubbles: true }));
            ok = !!(input.files && input.files.length > 0);
          }
        } catch (error) {
          console.error('[AutoFormX][page] fill-file failed', error);
        }
        reply(requestId, { action: 'fill-file-result', ok });
      })();
    }
  });
})();
