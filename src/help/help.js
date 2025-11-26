/**
 * 帮助页面脚本 - AutoFormX
 */

document.addEventListener('DOMContentLoaded', () => {
  // 返回按钮 - 关闭当前标签页
  const backBtn = document.getElementById('backBtn');
  if (backBtn) {
    backBtn.addEventListener('click', (e) => {
      e.preventDefault();
      window.close();
    });
  }
});

