> 历史资料：来自随附 workbench-dev / bfd39aee / 2026-10-20 导览。当前 checkout 无此路径；内容不能作为当前接口。

# R05 下拉控件样式

依据用户两张截图像素，仅美化下拉选择框：深灰圆角浮层、青绿色细边与柔和焦点光晕、展开向上箭头、留白、悬停/键盘活动项与已选勾号。不改 B 布局或十包范围；语言选项仍是中文 / English，默认中文。

- `Select.ts` 复用原生 select 的实际 value、label、disabled 和 input/change 事件，不复制另一份业务状态；原生控件在增强后隐藏，视觉控件提供 combobox/listbox 语义。
- `select-observer.ts` 处理后续页面渲染、动态模型列表和中英文原位更新；无匹配模型时禁用选择。
- `select-layout.ts` 负责固定浮层位置、上下翻转、视口边缘约束和最大滚动高度；菜单挂在 body，不被面板裁切。
- 键盘：方向键、Home/End、PageUp/PageDown、Enter/Space 确定、Escape 取消、Tab 确定并正常移焦、字符快速查找。DOM 焦点留在触发器，aria-activedescendant 指向活动项；已提交值另用勾号展示。
- 点击外部/失焦关闭且不抢焦点，同一时间只有一个菜单；关闭后移除浮层和全局临时监听。页面卸载或触发器滚出可见视口时清理。
- 窄屏触控目标至少 44px，支持 reduced-motion 和 forced-colors。

参考语义：[WAI-ARIA select-only combobox](https://www.w3.org/WAI/ARIA/apg/patterns/combobox/examples/combobox-select-only/)。点击外部取消未提交导航；Tab/Enter/Space 提交。

验证：原有 275 项 + 新增 18 项下拉结构/事件/定位测试，共 293 项；TypeScript、Biome、esbuild 通过。新测试使用轻量 DOM/EventTarget harness，不是浏览器、布局或读屏验证。真实浏览器截图、跨浏览器、触屏/读屏 QA 尚未完成；沿用环境已确认的浏览器启动限制，未重复绕过。未调用真实 API、密钥或 SDK runtime，未添加依赖，版本保持 TypeScript 7.0.2 / esbuild 0.28.2。
