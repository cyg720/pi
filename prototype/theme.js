/* 首屏先应用主题，避免刷新时先显示亮色。主题与演示数据分开保存。 */
(() => {
  let theme = "dark";
  try {
    const saved = localStorage.getItem("lg-workbench.theme.v1");
    if (saved === "light" || saved === "dark") theme = saved;
  } catch { /* 存储不可用时默认暗色，仍可在本页切换。 */ }
  document.documentElement.dataset.theme = theme;
})();
