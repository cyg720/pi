/**
 * 文件职责：提供导出会话 HTML 页面中的浏览器端交互逻辑，负责解码数据、构建会话树、渲染消息和处理导航。
 * 技术维度：采用原生 JavaScript IIFE、DOM API、Marked、Highlight.js、URLSearchParams 与 localStorage，无需前端框架即可独立运行。
 * 产品维度：让用户在单个可分享 HTML 中搜索和浏览分支、查看工具输出与统计、复制深链并下载原始 JSONL。
 * 逻辑维度：依次完成数据加载、树结构准备与过滤、文本和消息渲染、统计头部、导航、Markdown 安全渲染及交互初始化。
 * 关键边界：会话数据和预渲染工具 HTML来自导出器；所有外部文本必须转义或校验 URL，树过滤后还需重新计算连接线结构。
 * 新手阅读建议：先读数据加载与 buildTree/getPath，再看 renderToolCall/renderEntry，随后理解 navigateTo，最后查看 Marked 安全配置和事件绑定。
 */
    (function() {
      'use strict';

      // ============================================================
      // DATA LOADING
      // ============================================================
      // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。

      /** 常量 base64 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
      const base64 = document.getElementById('session-data').textContent;
      /** 常量 binary 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
      const binary = atob(base64);
      /** 常量 bytes 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
      const bytes = new Uint8Array(binary.length);
      /** 循环变量 i 表示当前遍历项或索引，仅在循环体内有效。 */
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      /** 常量 data 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
      const data = JSON.parse(new TextDecoder('utf-8').decode(bytes));
      /** 常量 { header, entries, leafId 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
      const { header, entries, leafId: defaultLeafId, systemPrompt, tools, renderedTools } = data;

      // ============================================================
      // URL PARAMETER HANDLING
      // ============================================================
      // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。

      // Parse URL parameters for deep linking: leafId and targetId
      // Check for injected params (when loaded in iframe via srcdoc) or use window.location
      // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
      const injectedParams = document.querySelector('meta[name="pi-url-params"]');
      /** 常量 searchString 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
      const searchString = injectedParams ? injectedParams.content : window.location.search.substring(1);
      /** 常量 urlParams 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
      const urlParams = new URLSearchParams(searchString);
      /** 常量 urlLeafId 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
      const urlLeafId = urlParams.get('leafId');
      /** 常量 urlTargetId 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
      const urlTargetId = urlParams.get('targetId');
      // Use URL leafId if provided, otherwise fall back to session default
      // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
      const leafId = urlLeafId || defaultLeafId;

      // ============================================================
      // DATA STRUCTURES
      // ============================================================
      // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。

      // Entry lookup by ID
      // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
      const byId = new Map();
      /** 循环变量 entry 表示当前遍历项或索引，仅在循环体内有效。 */
      for (const entry of entries) {
        byId.set(entry.id, entry);
      }

      // Tool call lookup (toolCallId -> {name, arguments})
      // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
      const toolCallMap = new Map();
      /** 循环变量 entry 表示当前遍历项或索引，仅在循环体内有效。 */
      for (const entry of entries) {
        if (entry.type === 'message' && entry.message.role === 'assistant') {
          /** 常量 content 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
          const content = entry.message.content;
          if (Array.isArray(content)) {
            /** 循环变量 block 表示当前遍历项或索引，仅在循环体内有效。 */
            for (const block of content) {
              if (block.type === 'toolCall') {
                toolCallMap.set(block.id, { name: block.name, arguments: block.arguments });
              }
            }
          }
        }
      }

      // Label lookup (entryId -> label string)
      // Labels are stored in 'label' entries that reference their target via targetId
      // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
      const labelMap = new Map();
      /** 循环变量 entry 表示当前遍历项或索引，仅在循环体内有效。 */
      for (const entry of entries) {
        if (entry.type === 'label' && entry.targetId && entry.label) {
          labelMap.set(entry.targetId, entry.label);
        }
      }

      // ============================================================
      // TREE DATA PREPARATION (no DOM, pure data)
      // ============================================================
      // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。

      /**
       * Build tree structure from flat entries.
       * Returns array of root nodes, each with { entry, children, label }.
       */
// 中文说明：上方英文注释给出本段功能、前提或边界，下面代码按该说明执行。
      function buildTree() {
        /** 常量 nodeMap 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const nodeMap = new Map();
        /** 常量 roots 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const roots = [];

        // Create nodes
        // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
        for (const entry of entries) {
          nodeMap.set(entry.id, {
            entry,
            children: [],
            label: labelMap.get(entry.id)
          });
        }

        // Build parent-child relationships
        // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
        for (const entry of entries) {
          /** 常量 node 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
          const node = nodeMap.get(entry.id);
          if (entry.parentId === null || entry.parentId === undefined || entry.parentId === entry.id) {
            roots.push(node);
          } else {
            /** 常量 parent 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const parent = nodeMap.get(entry.parentId);
            if (parent) {
              parent.children.push(node);
            } else {
              roots.push(node);
            }
          }
        }

        // Sort children by timestamp
        // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
        function sortChildren(node) {
          node.children.sort((a, b) =>
            new Date(a.entry.timestamp).getTime() - new Date(b.entry.timestamp).getTime()
          );
          node.children.forEach(sortChildren);
        }
        roots.forEach(sortChildren);

        return roots;
      }

      /**
       * Build set of entry IDs on path from root to target.
       */
// 中文说明：上方英文注释给出本段功能、前提或边界，下面代码按该说明执行。
      function buildActivePathIds(targetId) {
        /** 常量 ids 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const ids = new Set();
        /** 变量 current 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        let current = byId.get(targetId);
        while (current) {
          ids.add(current.id);
          // Stop if no parent or self-referencing (root)
          // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
          if (!current.parentId || current.parentId === current.id) {
            break;
          }
          current = byId.get(current.parentId);
        }
        return ids;
      }

      /**
       * Get array of entries from root to target (the conversation path).
       */
// 中文说明：上方英文注释给出本段功能、前提或边界，下面代码按该说明执行。
      function getPath(targetId) {
        /** 常量 path 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const path = [];
        /** 变量 current 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        let current = byId.get(targetId);
        while (current) {
          path.unshift(current);
          // Stop if no parent or self-referencing (root)
          // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
          if (!current.parentId || current.parentId === current.id) {
            break;
          }
          current = byId.get(current.parentId);
        }
        return path;
      }

      // Tree node lookup for finding leaves
      // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
      let treeNodeMap = null;

      /**
       * Find the newest leaf node reachable from a given node.
       * This allows clicking any node in a branch to show the full branch.
       * Children are sorted by timestamp, so the newest is always last.
       */
// 中文说明：上方英文注释给出本段功能、前提或边界，下面代码按该说明执行。
      function findNewestLeaf(nodeId) {
        // Build tree node map lazily
        // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
        if (!treeNodeMap) {
          treeNodeMap = new Map();
          /** 常量 tree 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
          const tree = buildTree();
          /** mapNodes 执行当前测试辅助步骤；参数 node 按签名提供输入，返回值供调用方断言。示例：mapNodes(...)。 */
          function mapNodes(node) {
            treeNodeMap.set(node.entry.id, node);
            node.children.forEach(mapNodes);
          }
          tree.forEach(mapNodes);
        }

        /** 常量 node 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const node = treeNodeMap.get(nodeId);
        if (!node) return nodeId;

        // Follow the newest (last) child at each level
        // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
        let current = node;
        while (current.children.length > 0) {
          current = current.children[current.children.length - 1];
        }
        return current.entry.id;
      }

      /**
       * Flatten tree into list with indentation and connector info.
       * Returns array of { node, indent, showConnector, isLast, gutters, isVirtualRootChild, multipleRoots }.
       * Matches tree-selector.ts logic exactly.
       */
// 中文说明：上方英文注释给出本段功能、前提或边界，下面代码按该说明执行。
      function flattenTree(roots, activePathIds) {
        /** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const result = [];
        /** 常量 multipleRoots 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const multipleRoots = roots.length > 1;

        // Mark which subtrees contain the active leaf
        // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
        const containsActive = new Map();
        /** markActive 执行当前测试辅助步骤；参数 node 按签名提供输入，返回值供调用方断言。示例：markActive(...)。 */
        function markActive(node) {
          /** 变量 has 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
          let has = activePathIds.has(node.entry.id);
          /** 循环变量 child 表示当前遍历项或索引，仅在循环体内有效。 */
          for (const child of node.children) {
            if (markActive(child)) has = true;
          }
          containsActive.set(node, has);
          return has;
        }
        roots.forEach(markActive);

        // Stack: [node, indent, justBranched, showConnector, isLast, gutters, isVirtualRootChild]
        // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
        const stack = [];

        // Add roots (prioritize branch containing active leaf)
        // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
        const orderedRoots = [...roots].sort((a, b) =>
          Number(containsActive.get(b)) - Number(containsActive.get(a))
        );
        /** 循环变量 i 表示当前遍历项或索引，仅在循环体内有效。 */
        for (let i = orderedRoots.length - 1; i >= 0; i--) {
          /** 常量 isLast 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
          const isLast = i === orderedRoots.length - 1;
          stack.push([orderedRoots[i], multipleRoots ? 1 : 0, multipleRoots, multipleRoots, isLast, [], multipleRoots]);
        }

        while (stack.length > 0) {
          /** 常量 [node, indent, justBranched, showConnector, isLast, gutters, isVirtualRootChild] 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
          const [node, indent, justBranched, showConnector, isLast, gutters, isVirtualRootChild] = stack.pop();

          result.push({ node, indent, showConnector, isLast, gutters, isVirtualRootChild, multipleRoots });

          /** 常量 children 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
          const children = node.children;
          /** 常量 multipleChildren 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
          const multipleChildren = children.length > 1;

          // Order children (active branch first)
          // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
          const orderedChildren = [...children].sort((a, b) =>
            Number(containsActive.get(b)) - Number(containsActive.get(a))
          );

          // Calculate child indent (matches tree-selector.ts)
          // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
          let childIndent;
          if (multipleChildren) {
            // Parent branches: children get +1
            // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
            childIndent = indent + 1;
          } else if (justBranched && indent > 0) {
            // First generation after a branch: +1 for visual grouping
            // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
            childIndent = indent + 1;
          } else {
            // Single-child chain: stay flat
            // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
            childIndent = indent;
          }

          // Build gutters for children
          // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
          const connectorDisplayed = showConnector && !isVirtualRootChild;
          /** 常量 currentDisplayIndent 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
          const currentDisplayIndent = multipleRoots ? Math.max(0, indent - 1) : indent;
          /** 常量 connectorPosition 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
          const connectorPosition = Math.max(0, currentDisplayIndent - 1);
          /** 常量 childGutters 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
          const childGutters = connectorDisplayed
            ? [...gutters, { position: connectorPosition, show: !isLast }]
            : gutters;

          // Add children in reverse order for stack
          // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
          for (let i = orderedChildren.length - 1; i >= 0; i--) {
            /** 常量 childIsLast 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const childIsLast = i === orderedChildren.length - 1;
            stack.push([orderedChildren[i], childIndent, multipleChildren, multipleChildren, childIsLast, childGutters, false]);
          }
        }

        return result;
      }

      /**
       * Build ASCII prefix string for tree node.
       */
// 中文说明：上方英文注释给出本段功能、前提或边界，下面代码按该说明执行。
      function buildTreePrefix(flatNode) {
        /** 常量 { indent, showConnector, isLast, gutters, isVirtualRootChild, multipleRoots } 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const { indent, showConnector, isLast, gutters, isVirtualRootChild, multipleRoots } = flatNode;
        /** 常量 displayIndent 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const displayIndent = multipleRoots ? Math.max(0, indent - 1) : indent;
        /** 常量 connector 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const connector = showConnector && !isVirtualRootChild ? (isLast ? '└─ ' : '├─ ') : '';
        /** 常量 connectorPosition 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const connectorPosition = connector ? displayIndent - 1 : -1;

        /** 常量 totalChars 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const totalChars = displayIndent * 3;
        /** 常量 prefixChars 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const prefixChars = [];
        /** 循环变量 i 表示当前遍历项或索引，仅在循环体内有效。 */
        for (let i = 0; i < totalChars; i++) {
          /** 常量 level 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
          const level = Math.floor(i / 3);
          /** 常量 posInLevel 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
          const posInLevel = i % 3;

          /** 常量 gutter 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
          const gutter = gutters.find(g => g.position === level);
          if (gutter) {
            prefixChars.push(posInLevel === 0 ? (gutter.show ? '│' : ' ') : ' ');
          } else if (connector && level === connectorPosition) {
            if (posInLevel === 0) {
              prefixChars.push(isLast ? '└' : '├');
            } else if (posInLevel === 1) {
              prefixChars.push('─');
            } else {
              prefixChars.push(' ');
            }
          } else {
            prefixChars.push(' ');
          }
        }
        return prefixChars.join('');
      }

      // ============================================================
      // FILTERING (pure data)
      // ============================================================
      // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。

      /** 变量 filterMode 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
      let filterMode = 'default';
      /** 变量 searchQuery 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
      let searchQuery = '';

      /** hasTextContent 执行当前测试辅助步骤；参数 content 按签名提供输入，返回值供调用方断言。示例：hasTextContent(...)。 */
      function hasTextContent(content) {
        if (typeof content === 'string') return content.trim().length > 0;
        if (Array.isArray(content)) {
          /** 循环变量 c 表示当前遍历项或索引，仅在循环体内有效。 */
          for (const c of content) {
            if (c.type === 'text' && c.text && c.text.trim().length > 0) return true;
          }
        }
        return false;
      }

      /** extractContent 执行当前测试辅助步骤；参数 content 按签名提供输入，返回值供调用方断言。示例：extractContent(...)。 */
      function extractContent(content) {
        if (typeof content === 'string') return content;
        if (Array.isArray(content)) {
          return content
            .filter(c => c.type === 'text' && c.text)
            .map(c => c.text)
            .join('');
        }
        return '';
      }

      /**
       * Parse a skill block from message text.
       * Returns null if the text doesn't contain a skill block.
       * Matches the format: <skill name="..." location="...">\n...\n</skill>\n\nuser message
       */
// 中文说明：上方英文注释给出本段功能、前提或边界，下面代码按该说明执行。
      function parseSkillBlock(text) {
        /** 常量 match 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const match = text.match(/^<skill name="([^"]+)" location="([^"]+)">\n([\s\S]*?)\n<\/skill>(?:\n\n([\s\S]+))?$/);
        if (!match) return null;
        return {
          name: match[1],
          location: match[2],
          content: match[3],
          userMessage: match[4]?.trim() || undefined,
        };
      }

      /** getSearchableText 执行当前测试辅助步骤；参数 entry、label 按签名提供输入，返回值供调用方断言。示例：getSearchableText(..., ...)。 */
      function getSearchableText(entry, label) {
        /** 常量 parts 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const parts = [];
        if (label) parts.push(label);

        switch (entry.type) {
          case 'message': {
            /** 常量 msg 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const msg = entry.message;
            parts.push(msg.role);
            if (msg.content) parts.push(extractContent(msg.content));
            if (msg.role === 'bashExecution' && msg.command) parts.push(msg.command);
            break;
          }
          case 'custom_message':
            parts.push(entry.customType);
            parts.push(typeof entry.content === 'string' ? entry.content : extractContent(entry.content));
            break;
          case 'compaction':
            parts.push('compaction');
            break;
          case 'branch_summary':
            parts.push('branch summary', entry.summary);
            break;
          case 'model_change':
            parts.push('model', entry.modelId);
            break;
          case 'thinking_level_change':
            parts.push('thinking', entry.thinkingLevel);
            break;
        }

        return parts.join(' ').toLowerCase();
      }

      /**
       * Filter flat nodes based on current filterMode and searchQuery.
       */
// 中文说明：上方英文注释给出本段功能、前提或边界，下面代码按该说明执行。
      function filterNodes(flatNodes, currentLeafId) {
        /** 常量 searchTokens 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const searchTokens = searchQuery.toLowerCase().split(/\s+/).filter(Boolean);

        /** 常量 filtered 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const filtered = flatNodes.filter(flatNode => {
          /** 常量 entry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
          const entry = flatNode.node.entry;
          /** 常量 label 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
          const label = flatNode.node.label;
          /** 常量 isCurrentLeaf 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
          const isCurrentLeaf = entry.id === currentLeafId;

          // Always show current leaf
          // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
          if (isCurrentLeaf) return true;

          // Hide assistant messages with only tool calls (no text) unless error/aborted
          // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
          if (entry.type === 'message' && entry.message.role === 'assistant') {
            /** 常量 msg 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const msg = entry.message;
            /** 常量 hasText 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const hasText = hasTextContent(msg.content);
            /** 常量 isErrorOrAborted 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const isErrorOrAborted = msg.stopReason && msg.stopReason !== 'stop' && msg.stopReason !== 'toolUse';
            if (!hasText && !isErrorOrAborted) return false;
          }

          // Apply filter mode
          // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
          const isSettingsEntry = ['label', 'custom', 'model_change', 'thinking_level_change'].includes(entry.type);
          /** 变量 passesFilter 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
          let passesFilter = true;

          switch (filterMode) {
            case 'user-only':
              passesFilter = entry.type === 'message' && entry.message.role === 'user';
              break;
            case 'no-tools':
              passesFilter = !isSettingsEntry && !(entry.type === 'message' && entry.message.role === 'toolResult');
              break;
            case 'labeled-only':
              passesFilter = label !== undefined;
              break;
            case 'all':
              passesFilter = true;
              break;
            default: // 'default'
              passesFilter = !isSettingsEntry;
              break;
          }

          if (!passesFilter) return false;

          // Apply search filter
          // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
          if (searchTokens.length > 0) {
            /** 常量 nodeText 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const nodeText = getSearchableText(entry, label);
            if (!searchTokens.every(t => nodeText.includes(t))) return false;
          }

          return true;
        });

        // Recalculate visual structure based on visible tree
        // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
        recalculateVisualStructure(filtered, flatNodes);

        return filtered;
      }

      /**
       * Recompute indentation/connectors for the filtered view
       *
       * Filtering can hide intermediate entries; descendants attach to the nearest visible ancestor.
       * Keep indentation semantics aligned with flattenTree() so single-child chains don't drift right.
       */
// 中文说明：上方英文注释给出本段功能、前提或边界，下面代码按该说明执行。
      function recalculateVisualStructure(filteredNodes, allFlatNodes) {
        if (filteredNodes.length === 0) return;

        /** 常量 visibleIds 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const visibleIds = new Set(filteredNodes.map(n => n.node.entry.id));

        // Build entry map for parent lookup (using full tree)
        // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
        const entryMap = new Map();
        /** 循环变量 flatNode 表示当前遍历项或索引，仅在循环体内有效。 */
        for (const flatNode of allFlatNodes) {
          entryMap.set(flatNode.node.entry.id, flatNode);
        }

        // Find nearest visible ancestor for a node
        // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
        function findVisibleAncestor(nodeId) {
          /** 变量 currentId 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
          let currentId = entryMap.get(nodeId)?.node.entry.parentId;
          while (currentId != null) {
            if (visibleIds.has(currentId)) {
              return currentId;
            }
            currentId = entryMap.get(currentId)?.node.entry.parentId;
          }
          return null;
        }

        // Build visible tree structure
        // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
        const visibleParent = new Map();
        /** 常量 visibleChildren 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const visibleChildren = new Map();
        visibleChildren.set(null, []); // root-level nodes

        /** 循环变量 flatNode 表示当前遍历项或索引，仅在循环体内有效。 */
        for (const flatNode of filteredNodes) {
          /** 常量 nodeId 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
          const nodeId = flatNode.node.entry.id;
          /** 常量 ancestorId 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
          const ancestorId = findVisibleAncestor(nodeId);
          visibleParent.set(nodeId, ancestorId);

          if (!visibleChildren.has(ancestorId)) {
            visibleChildren.set(ancestorId, []);
          }
          visibleChildren.get(ancestorId).push(nodeId);
        }

        // Update multipleRoots based on visible roots
        // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
        const visibleRootIds = visibleChildren.get(null);
        /** 常量 multipleRoots 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const multipleRoots = visibleRootIds.length > 1;

        // Build a map for quick lookup: nodeId → FlatNode
        // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
        const filteredNodeMap = new Map();
        /** 循环变量 flatNode 表示当前遍历项或索引，仅在循环体内有效。 */
        for (const flatNode of filteredNodes) {
          filteredNodeMap.set(flatNode.node.entry.id, flatNode);
        }

        // DFS traversal of visible tree, applying same indentation rules as flattenTree()
        // Stack items: [nodeId, indent, justBranched, showConnector, isLast, gutters, isVirtualRootChild]
        // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
        const stack = [];

        // Add visible roots in reverse order (to process in forward order via stack)
        // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
        for (let i = visibleRootIds.length - 1; i >= 0; i--) {
          /** 常量 isLast 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
          const isLast = i === visibleRootIds.length - 1;
          stack.push([
            visibleRootIds[i],
            multipleRoots ? 1 : 0,
            multipleRoots,
            multipleRoots,
            isLast,
            [],
            multipleRoots
          ]);
        }

        while (stack.length > 0) {
          /** 常量 [nodeId, indent, justBranched, showConnector, isLast, gutters, isVirtualRootChild] 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
          const [nodeId, indent, justBranched, showConnector, isLast, gutters, isVirtualRootChild] = stack.pop();

          /** 常量 flatNode 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
          const flatNode = filteredNodeMap.get(nodeId);
          if (!flatNode) continue;

          // Update this node's visual properties
          // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
          flatNode.indent = indent;
          flatNode.showConnector = showConnector;
          flatNode.isLast = isLast;
          flatNode.gutters = gutters;
          flatNode.isVirtualRootChild = isVirtualRootChild;
          flatNode.multipleRoots = multipleRoots;

          // Get visible children of this node
          // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
          const children = visibleChildren.get(nodeId) || [];
          /** 常量 multipleChildren 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
          const multipleChildren = children.length > 1;

          // Calculate child indent using same rules as flattenTree():
          // - Parent branches (multiple children): children get +1
          // - Just branched and indent > 0: children get +1 for visual grouping
          // - Single-child chain: stay flat
          // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
          let childIndent;
          if (multipleChildren) {
            childIndent = indent + 1;
          } else if (justBranched && indent > 0) {
            childIndent = indent + 1;
          } else {
            childIndent = indent;
          }

          // Build gutters for children (same logic as flattenTree)
          // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
          const connectorDisplayed = showConnector && !isVirtualRootChild;
          /** 常量 currentDisplayIndent 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
          const currentDisplayIndent = multipleRoots ? Math.max(0, indent - 1) : indent;
          /** 常量 connectorPosition 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
          const connectorPosition = Math.max(0, currentDisplayIndent - 1);
          /** 常量 childGutters 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
          const childGutters = connectorDisplayed
            ? [...gutters, { position: connectorPosition, show: !isLast }]
            : gutters;

          // Add children in reverse order (to process in forward order via stack)
          // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
          for (let i = children.length - 1; i >= 0; i--) {
            /** 常量 childIsLast 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const childIsLast = i === children.length - 1;
            stack.push([
              children[i],
              childIndent,
              multipleChildren,
              multipleChildren,
              childIsLast,
              childGutters,
              false
            ]);
          }
        }
      }

      // ============================================================
      // TREE DISPLAY TEXT (pure data -> string)
      // ============================================================
      // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。

      /** shortenPath 执行当前测试辅助步骤；参数 p 按签名提供输入，返回值供调用方断言。示例：shortenPath(...)。 */
      function shortenPath(p) {
        if (typeof p !== 'string') return '';
        if (p.startsWith('/Users/')) {
          /** 常量 parts 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
          const parts = p.split('/');
          if (parts.length > 2) return '~' + p.slice(('/Users/' + parts[2]).length);
        }
        if (p.startsWith('/home/')) {
          /** 常量 parts 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
          const parts = p.split('/');
          if (parts.length > 2) return '~' + p.slice(('/home/' + parts[2]).length);
        }
        return p;
      }

      /** formatToolCall 执行当前测试辅助步骤；参数 name、args 按签名提供输入，返回值供调用方断言。示例：formatToolCall(..., ...)。 */
      function formatToolCall(name, args) {
        switch (name) {
          case 'read': {
            /** 常量 path 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const path = shortenPath(String(args.path || args.file_path || ''));
            /** 常量 offset 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const offset = args.offset;
            /** 常量 limit 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const limit = args.limit;
            /** 变量 display 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            let display = path;
            if (offset !== undefined || limit !== undefined) {
              /** 常量 start 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
              const start = offset ?? 1;
              /** 常量 end 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
              const end = limit !== undefined ? start + limit - 1 : '';
              display += `:${start}${end ? `-${end}` : ''}`;
            }
            return `[read: ${display}]`;
          }
          case 'write':
            return `[write: ${shortenPath(String(args.path || args.file_path || ''))}]`;
          case 'edit':
            return `[edit: ${shortenPath(String(args.path || args.file_path || ''))}]`;
          case 'bash': {
            /** 常量 rawCmd 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const rawCmd = String(args.command || '');
            /** 常量 cmd 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const cmd = rawCmd.replace(/[\n\t]/g, ' ').trim().slice(0, 50);
            return `[bash: ${cmd}${rawCmd.length > 50 ? '...' : ''}]`;
          }
          case 'grep':
            return `[grep: /${args.pattern || ''}/ in ${shortenPath(String(args.path || '.'))}]`;
          case 'find':
            return `[find: ${args.pattern || ''} in ${shortenPath(String(args.path || '.'))}]`;
          case 'ls':
            return `[ls: ${shortenPath(String(args.path || '.'))}]`;
          default: {
            /** 常量 argsStr 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const argsStr = JSON.stringify(args).slice(0, 40);
            return `[${name}: ${argsStr}${JSON.stringify(args).length > 40 ? '...' : ''}]`;
          }
        }
      }

      /** escapeHtml 执行当前测试辅助步骤；参数 text 按签名提供输入，返回值供调用方断言。示例：escapeHtml(...)。 */
      function escapeHtml(text) {
        return String(text)
          .replace(/&/g, '&amp;')
          .replace(/</g, '&lt;')
          .replace(/>/g, '&gt;')
          .replace(/"/g, '&quot;')
          .replace(/'/g, '&#39;');
      }

      /** sanitizeMarkdownUrl 执行当前测试辅助步骤；参数 value 按签名提供输入，返回值供调用方断言。示例：sanitizeMarkdownUrl(...)。 */
      function sanitizeMarkdownUrl(value) {
        /** 常量 href 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const href = String(value || '').trim().replace(/[\x00-\x1f\x7f]/g, '');
        if (!href) return href;

        /** 常量 scheme 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const scheme = href.match(/^([A-Za-z][A-Za-z0-9+.-]*):/);
        if (scheme && !/^(https?|mailto|tel|ftp)$/i.test(scheme[1])) {
          return null;
        }

        return href;
      }

      /**
       * Truncate string to maxLen chars, append "..." if truncated.
       */
// 中文说明：上方英文注释给出本段功能、前提或边界，下面代码按该说明执行。
      function truncate(s, maxLen = 100) {
        if (s.length <= maxLen) return s;
        return s.slice(0, maxLen) + '...';
      }

      /**
       * Get display text for tree node (returns HTML string).
       */
// 中文说明：上方英文注释给出本段功能、前提或边界，下面代码按该说明执行。
      function getTreeNodeDisplayHtml(entry, label) {
        /** normalize 封装当前回调或辅助步骤；参数 s 提供输入，返回值用于后续流程。示例：normalize(...)。 */
        const normalize = s => s.replace(/[\n\t]/g, ' ').trim();
        /** 常量 labelHtml 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const labelHtml = label ? `<span class="tree-label">[${escapeHtml(label)}]</span> ` : '';

        switch (entry.type) {
          case 'message': {
            /** 常量 msg 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const msg = entry.message;
            if (msg.role === 'user') {
              /** 常量 rawContent 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
              const rawContent = extractContent(msg.content);
              /** 常量 skillBlock 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
              const skillBlock = parseSkillBlock(rawContent);
              if (skillBlock) {
                /** 变量 treeHtml 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
                let treeHtml = labelHtml + `<span class="tree-role-skill">skill:</span> ${escapeHtml(skillBlock.name)}`;
                if (skillBlock.userMessage) {
                  treeHtml += ` · <span class="tree-role-user">user:</span> ${escapeHtml(truncate(normalize(skillBlock.userMessage)))}`;
                }
                return treeHtml;
              }
              /** 常量 content 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
              const content = truncate(normalize(rawContent));
              return labelHtml + `<span class="tree-role-user">user:</span> ${escapeHtml(content)}`;
            }
            if (msg.role === 'assistant') {
              /** 常量 textContent 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
              const textContent = truncate(normalize(extractContent(msg.content)));
              if (textContent) {
                return labelHtml + `<span class="tree-role-assistant">assistant:</span> ${escapeHtml(textContent)}`;
              }
              if (msg.stopReason === 'aborted') {
                return labelHtml + `<span class="tree-role-assistant">assistant:</span> <span class="tree-muted">(aborted)</span>`;
              }
              if (msg.errorMessage) {
                return labelHtml + `<span class="tree-role-assistant">assistant:</span> <span class="tree-error">${escapeHtml(truncate(msg.errorMessage))}</span>`;
              }
              return labelHtml + `<span class="tree-role-assistant">assistant:</span> <span class="tree-muted">(no text)</span>`;
            }
            if (msg.role === 'toolResult') {
              /** 常量 toolCall 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
              const toolCall = msg.toolCallId ? toolCallMap.get(msg.toolCallId) : null;
              if (toolCall) {
                return labelHtml + `<span class="tree-role-tool">${escapeHtml(formatToolCall(toolCall.name, toolCall.arguments))}</span>`;
              }
              return labelHtml + `<span class="tree-role-tool">[${escapeHtml(msg.toolName || 'tool')}]</span>`;
            }
            if (msg.role === 'bashExecution') {
              /** 常量 cmd 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
              const cmd = truncate(normalize(msg.command || ''));
              return labelHtml + `<span class="tree-role-tool">[bash]:</span> ${escapeHtml(cmd)}`;
            }
            return labelHtml + `<span class="tree-muted">[${escapeHtml(msg.role)}]</span>`;
          }
          case 'compaction':
            return labelHtml + `<span class="tree-compaction">[compaction: ${Math.round(entry.tokensBefore/1000)}k tokens]</span>`;
          case 'branch_summary': {
            /** 常量 summary 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const summary = truncate(normalize(entry.summary || ''));
            return labelHtml + `<span class="tree-branch-summary">[branch summary]:</span> ${escapeHtml(summary)}`;
          }
          case 'custom_message': {
            /** 常量 content 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const content = typeof entry.content === 'string' ? entry.content : extractContent(entry.content);
            return labelHtml + `<span class="tree-custom">[${escapeHtml(entry.customType)}]:</span> ${escapeHtml(truncate(normalize(content)))}`;
          }
          case 'model_change':
            return labelHtml + `<span class="tree-muted">[model: ${escapeHtml(entry.modelId)}]</span>`;
          case 'thinking_level_change':
            return labelHtml + `<span class="tree-muted">[thinking: ${escapeHtml(entry.thinkingLevel)}]</span>`;
          default:
            return labelHtml + `<span class="tree-muted">[${escapeHtml(entry.type)}]</span>`;
        }
      }

      // ============================================================
      // TREE RENDERING (DOM manipulation)
      // ============================================================
      // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。

      /** 变量 currentLeafId 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
      let currentLeafId = leafId;
      /** 变量 currentTargetId 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
      let currentTargetId = urlTargetId || leafId;
      /** 变量 treeRendered 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
      let treeRendered = false;

      /** renderTree 执行当前测试辅助步骤；参数 无 按签名提供输入，返回值供调用方断言。示例：renderTree()。 */
      function renderTree() {
        /** 常量 tree 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const tree = buildTree();
        /** 常量 activePathIds 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const activePathIds = buildActivePathIds(currentLeafId);
        /** 常量 flatNodes 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const flatNodes = flattenTree(tree, activePathIds);
        /** 常量 filtered 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const filtered = filterNodes(flatNodes, currentLeafId);
        /** 常量 container 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const container = document.getElementById('tree-container');

        // Full render only on first call or when filter/search changes
        // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
        if (!treeRendered) {
          container.innerHTML = '';

          /** 循环变量 flatNode 表示当前遍历项或索引，仅在循环体内有效。 */
          for (const flatNode of filtered) {
            /** 常量 entry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const entry = flatNode.node.entry;
            /** 常量 isOnPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const isOnPath = activePathIds.has(entry.id);
            /** 常量 isTarget 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const isTarget = entry.id === currentTargetId;

            /** 常量 div 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const div = document.createElement('div');
            div.className = 'tree-node';
            if (isOnPath) div.classList.add('in-path');
            if (isTarget) div.classList.add('active');
            div.dataset.id = entry.id;

            /** 常量 prefix 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const prefix = buildTreePrefix(flatNode);
            /** 常量 prefixSpan 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const prefixSpan = document.createElement('span');
            prefixSpan.className = 'tree-prefix';
            prefixSpan.textContent = prefix;

            /** 常量 marker 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const marker = document.createElement('span');
            marker.className = 'tree-marker';
            marker.textContent = isOnPath ? '•' : ' ';

            /** 常量 content 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const content = document.createElement('span');
            content.className = 'tree-content';
            content.innerHTML = getTreeNodeDisplayHtml(entry, flatNode.node.label);

            div.appendChild(prefixSpan);
            div.appendChild(marker);
            div.appendChild(content);
            // Navigate to the newest leaf through this node, but scroll to the clicked node
            // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
            div.addEventListener('click', () => {
              if (window.getSelection().toString()) return;
              /** 常量 leafId 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
              const leafId = findNewestLeaf(entry.id);
              navigateTo(leafId, 'target', entry.id);
            });

            container.appendChild(div);
          }

          treeRendered = true;
        } else {
          // Just update markers and classes
          // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
          const nodes = container.querySelectorAll('.tree-node');
          /** 循环变量 node 表示当前遍历项或索引，仅在循环体内有效。 */
          for (const node of nodes) {
            /** 常量 id 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const id = node.dataset.id;
            /** 常量 isOnPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const isOnPath = activePathIds.has(id);
            /** 常量 isTarget 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const isTarget = id === currentTargetId;

            node.classList.toggle('in-path', isOnPath);
            node.classList.toggle('active', isTarget);

            /** 常量 marker 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const marker = node.querySelector('.tree-marker');
            if (marker) {
              marker.textContent = isOnPath ? '•' : ' ';
            }
          }
        }

        document.getElementById('tree-status').textContent = `${filtered.length} / ${flatNodes.length} entries`;

        // Scroll active node into view after layout
        // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
        setTimeout(() => {
          /** 常量 activeNode 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
          const activeNode = container.querySelector('.tree-node.active');
          if (activeNode) {
            activeNode.scrollIntoView({ block: 'nearest' });
          }
        }, 0);
      }

      /** forceTreeRerender 执行当前测试辅助步骤；参数 无 按签名提供输入，返回值供调用方断言。示例：forceTreeRerender()。 */
      function forceTreeRerender() {
        treeRendered = false;
        renderTree();
      }

      // ============================================================
      // MESSAGE RENDERING
      // ============================================================
      // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。

      /** formatTokens 执行当前测试辅助步骤；参数 count 按签名提供输入，返回值供调用方断言。示例：formatTokens(...)。 */
      function formatTokens(count) {
        if (count < 1000) return count.toString();
        if (count < 10000) return (count / 1000).toFixed(1) + 'k';
        if (count < 1000000) return Math.round(count / 1000) + 'k';
        return (count / 1000000).toFixed(1) + 'M';
      }

      /** formatTimestamp 执行当前测试辅助步骤；参数 ts 按签名提供输入，返回值供调用方断言。示例：formatTimestamp(...)。 */
      function formatTimestamp(ts) {
        if (!ts) return '';
        /** 常量 date 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const date = new Date(ts);
        return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', second: '2-digit' });
      }

      /** replaceTabs 执行当前测试辅助步骤；参数 text 按签名提供输入，返回值供调用方断言。示例：replaceTabs(...)。 */
      function replaceTabs(text) {
        return text.replace(/\t/g, '   ');
      }

      /** Safely coerce value to string for display. Returns null if invalid type. */
// 中文说明：上方英文注释给出本段功能、前提或边界，下面代码按该说明执行。
      function str(value) {
        if (typeof value === 'string') return value;
        if (value == null) return '';
        return null;
      }

      /** getLanguageFromPath 执行当前测试辅助步骤；参数 filePath 按签名提供输入，返回值供调用方断言。示例：getLanguageFromPath(...)。 */
      function getLanguageFromPath(filePath) {
        /** 常量 ext 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const ext = filePath.split('.').pop()?.toLowerCase();
        /** 常量 extToLang 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const extToLang = {
          ts: 'typescript', tsx: 'typescript', js: 'javascript', jsx: 'javascript',
          py: 'python', rb: 'ruby', rs: 'rust', go: 'go', java: 'java',
          c: 'c', cpp: 'cpp', h: 'c', hpp: 'cpp', cs: 'csharp',
          php: 'php', sh: 'bash', bash: 'bash', zsh: 'bash',
          sql: 'sql', html: 'html', css: 'css', scss: 'scss',
          json: 'json', yaml: 'yaml', yml: 'yaml', xml: 'xml',
          md: 'markdown', dockerfile: 'dockerfile'
        };
        return extToLang[ext];
      }

      /** findToolResult 执行当前测试辅助步骤；参数 toolCallId 按签名提供输入，返回值供调用方断言。示例：findToolResult(...)。 */
      function findToolResult(toolCallId) {
        /** 循环变量 entry 表示当前遍历项或索引，仅在循环体内有效。 */
        for (const entry of entries) {
          if (entry.type === 'message' && entry.message.role === 'toolResult') {
            if (entry.message.toolCallId === toolCallId) {
              return entry.message;
            }
          }
        }
        return null;
      }

      /** formatExpandableOutput 执行当前测试辅助步骤；参数 text、maxLines、lang 按签名提供输入，返回值供调用方断言。示例：formatExpandableOutput(..., ..., ...)。 */
      function formatExpandableOutput(text, maxLines, lang) {
        text = replaceTabs(text);
        /** 常量 lines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const lines = text.split('\n');
        /** 常量 displayLines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const displayLines = lines.slice(0, maxLines);
        /** 常量 remaining 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const remaining = lines.length - maxLines;

        if (lang) {
          /** 变量 highlighted 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
          let highlighted;
          try {
            highlighted = hljs.highlight(text, { language: lang }).value;
          } catch {
            highlighted = escapeHtml(text);
          }

          if (remaining > 0) {
            /** 常量 previewCode 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const previewCode = displayLines.join('\n');
            /** 变量 previewHighlighted 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            let previewHighlighted;
            try {
              previewHighlighted = hljs.highlight(previewCode, { language: lang }).value;
            } catch {
              previewHighlighted = escapeHtml(previewCode);
            }

            return `<div class="tool-output expandable" onclick="if(window.getSelection().toString())return;this.classList.toggle('expanded')">
              <div class="output-preview"><pre><code class="hljs">${previewHighlighted}</code></pre>
              <div class="expand-hint">... (${remaining} more lines)</div></div>
              <div class="output-full"><pre><code class="hljs">${highlighted}</code></pre></div></div>`;
          }

          return `<div class="tool-output"><pre><code class="hljs">${highlighted}</code></pre></div>`;
        }

        // Plain text output
        // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
        if (remaining > 0) {
          /** 变量 out 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
          let out = '<div class="tool-output expandable" onclick="if(window.getSelection().toString())return;this.classList.toggle(\'expanded\')">';
          out += '<div class="output-preview">';
          /** 循环变量 line 表示当前遍历项或索引，仅在循环体内有效。 */
          for (const line of displayLines) {
            out += `<div>${escapeHtml(replaceTabs(line))}</div>`;
          }
          out += `<div class="expand-hint">... (${remaining} more lines)</div></div>`;
          out += '<div class="output-full">';
          /** 循环变量 line 表示当前遍历项或索引，仅在循环体内有效。 */
          for (const line of lines) {
            out += `<div>${escapeHtml(replaceTabs(line))}</div>`;
          }
          out += '</div></div>';
          return out;
        }

        /** 变量 out 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        let out = '<div class="tool-output">';
        /** 循环变量 line 表示当前遍历项或索引，仅在循环体内有效。 */
        for (const line of displayLines) {
          out += `<div>${escapeHtml(replaceTabs(line))}</div>`;
        }
        out += '</div>';
        return out;
      }

      /** renderToolCall 执行当前测试辅助步骤；参数 call 按签名提供输入，返回值供调用方断言。示例：renderToolCall(...)。 */
      function renderToolCall(call) {
        /** 常量 result 保存当前场景的结果数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const result = findToolResult(call.id);
        /** 常量 isError 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const isError = result?.isError || false;
        /** 常量 statusClass 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const statusClass = result ? (isError ? 'error' : 'success') : 'pending';

        /** getResultText 封装当前回调或辅助步骤；参数 无 提供输入，返回值用于后续流程。示例：getResultText()。 */
        const getResultText = () => {
          if (!result) return '';
          /** 常量 textBlocks 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
          const textBlocks = result.content.filter(c => c.type === 'text');
          return textBlocks.map(c => c.text).join('\n');
        };

        /** getResultImages 封装当前回调或辅助步骤；参数 无 提供输入，返回值用于后续流程。示例：getResultImages()。 */
        const getResultImages = () => {
          if (!result) return [];
          return result.content.filter(c => c.type === 'image');
        };

        /** renderResultImages 封装当前回调或辅助步骤；参数 无 提供输入，返回值用于后续流程。示例：renderResultImages()。 */
        const renderResultImages = () => {
          /** 常量 images 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
          const images = getResultImages();
          if (images.length === 0) return '';
          return '<div class="tool-images">' +
            images.map(img => `<img src="data:${escapeHtml(img.mimeType || 'image/png')};base64,${escapeHtml(img.data || '')}" class="tool-image" />`).join('') +
            '</div>';
        };

        /** 常量 toolDomId 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const toolDomId = `tool-call-${escapeHtml(call.id)}`;
        /** 变量 html 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        let html = `<div class="tool-execution ${statusClass}" id="${toolDomId}">`;
        /** 常量 args 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const args = call.arguments || {};
        /** 常量 name 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const name = call.name;

        /** 常量 invalidArg 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const invalidArg = '<span class="tool-error">[invalid arg]</span>';

        switch (name) {
          case 'bash': {
            /** 常量 command 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const command = str(args.command);
            /** 常量 cmdDisplay 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const cmdDisplay = command === null ? invalidArg : escapeHtml(command || '...');
            html += `<div class="tool-command">$ ${cmdDisplay}</div>`;
            if (result) {
              /** 常量 output 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
              const output = getResultText().trim();
              if (output) html += formatExpandableOutput(output, 5);
            }
            break;
          }
          case 'read': {
            /** 常量 filePath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const filePath = str(args.file_path ?? args.path);
            /** 常量 offset 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const offset = args.offset;
            /** 常量 limit 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const limit = args.limit;

            /** 变量 pathHtml 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            let pathHtml = filePath === null ? invalidArg : escapeHtml(shortenPath(filePath || ''));
            if (filePath !== null && (offset !== undefined || limit !== undefined)) {
              /** 常量 startLine 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
              const startLine = offset ?? 1;
              /** 常量 endLine 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
              const endLine = limit !== undefined ? startLine + limit - 1 : '';
              pathHtml += `<span class="line-numbers">:${startLine}${endLine ? '-' + endLine : ''}</span>`;
            }

            html += `<div class="tool-header"><span class="tool-name">read</span> <span class="tool-path">${pathHtml}</span></div>`;
            if (result) {
              html += renderResultImages();
              /** 常量 output 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
              const output = getResultText();
              /** 常量 lang 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
              const lang = filePath ? getLanguageFromPath(filePath) : null;
              if (output) html += formatExpandableOutput(output, 10, lang);
            }
            break;
          }
          case 'write': {
            /** 常量 filePath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const filePath = str(args.file_path ?? args.path);
            /** 常量 content 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const content = str(args.content);

            html += `<div class="tool-header"><span class="tool-name">write</span> <span class="tool-path">${filePath === null ? invalidArg : escapeHtml(shortenPath(filePath || ''))}</span>`;
            if (content !== null && content) {
              /** 常量 lines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
              const lines = content.split('\n');
              if (lines.length > 10) html += ` <span class="line-count">(${lines.length} lines)</span>`;
            }
            html += '</div>';

            if (content === null) {
              html += `<div class="tool-error">[invalid content arg - expected string]</div>`;
            } else if (content) {
              /** 常量 lang 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
              const lang = filePath ? getLanguageFromPath(filePath) : null;
              html += formatExpandableOutput(content, 10, lang);
            }
            if (result) {
              /** 常量 output 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
              const output = getResultText().trim();
              if (output) html += `<div class="tool-output"><div>${escapeHtml(output)}</div></div>`;
            }
            break;
          }
          case 'edit': {
            /** 常量 filePath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const filePath = str(args.file_path ?? args.path);
            html += `<div class="tool-header"><span class="tool-name">edit</span> <span class="tool-path">${filePath === null ? invalidArg : escapeHtml(shortenPath(filePath || ''))}</span></div>`;

            if (result?.details?.diff) {
              /** 常量 diffLines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
              const diffLines = result.details.diff.split('\n');
              html += '<div class="tool-diff">';
              /** 循环变量 line 表示当前遍历项或索引，仅在循环体内有效。 */
              for (const line of diffLines) {
                /** 常量 cls 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
                const cls = line.match(/^\+/) ? 'diff-added' : line.match(/^-/) ? 'diff-removed' : 'diff-context';
                html += `<div class="${cls}">${escapeHtml(replaceTabs(line))}</div>`;
              }
              html += '</div>';
            } else if (result) {
              /** 常量 output 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
              const output = getResultText().trim();
              if (output) html += `<div class="tool-output"><pre>${escapeHtml(output)}</pre></div>`;
            }
            break;
          }
          case 'ls': {
            /** 常量 dirPath 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const dirPath = str(args.path);
            /** 常量 limit 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const limit = args.limit;

            /** 变量 pathHtml 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            let pathHtml = dirPath === null ? invalidArg : escapeHtml(shortenPath(dirPath || '.'));
            if (limit !== undefined) {
              pathHtml += ` <span class="line-count">(limit ${escapeHtml(String(limit))})</span>`;
            }

            html += `<div class="tool-header"><span class="tool-name">ls</span> <span class="tool-path">${pathHtml}</span></div>`;
            if (result) {
              /** 常量 output 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
              const output = getResultText().trim();
              if (output) html += formatExpandableOutput(output, 20);
            }
            break;
          }
          default: {
            // Check for pre-rendered custom tool HTML
            // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
            const rendered = renderedTools?.[call.id];
            if (rendered?.callHtml || rendered?.resultHtmlCollapsed || rendered?.resultHtmlExpanded) {
              // Custom tool with pre-rendered HTML from TUI renderer
              // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
              if (rendered.callHtml) {
                html += `<div class="tool-header ansi-rendered">${rendered.callHtml}</div>`;
              } else {
                html += `<div class="tool-header"><span class="tool-name">${escapeHtml(name)}</span></div>`;
              }

              if (rendered.resultHtmlCollapsed && rendered.resultHtmlExpanded && rendered.resultHtmlCollapsed !== rendered.resultHtmlExpanded) {
                // Both collapsed and expanded differ - render expandable section
                // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
                html += `<div class="tool-output expandable ansi-rendered" onclick="if(window.getSelection().toString())return;this.classList.toggle('expanded')">
                  <div class="output-preview">${rendered.resultHtmlCollapsed}</div>
                  <div class="output-full">${rendered.resultHtmlExpanded}</div>
                </div>`;
              } else if (rendered.resultHtmlExpanded) {
                // Only expanded exists (or collapsed is identical) - show directly
                // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
                html += `<div class="tool-output ansi-rendered">${rendered.resultHtmlExpanded}</div>`;
              } else if (result) {
                // No pre-rendered result HTML - fallback to JSON
                // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
                const output = getResultText();
                if (output) html += formatExpandableOutput(output, 10);
              }
            } else {
              // Fallback to JSON display (existing behavior)
              // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
              html += `<div class="tool-header"><span class="tool-name">${escapeHtml(name)}</span></div>`;
              html += `<div class="tool-output"><pre>${escapeHtml(JSON.stringify(args, null, 2))}</pre></div>`;
              if (result) {
                /** 常量 output 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
                const output = getResultText();
                if (output) html += formatExpandableOutput(output, 10);
              }
            }
          }
        }

        html += '</div>';
        return html;
      }

      /**
       * Download the session data as a JSONL file.
       * Reconstructs the original format: header line + entry lines.
       */
// 中文说明：上方英文注释给出本段功能、前提或边界，下面代码按该说明执行。
      window.downloadSessionJson = function() {
        // Build JSONL content: header first, then all entries
        // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
        const lines = [];
        if (header) {
          lines.push(JSON.stringify({ type: 'header', ...header }));
        }
        /** 循环变量 entry 表示当前遍历项或索引，仅在循环体内有效。 */
        for (const entry of entries) {
          lines.push(JSON.stringify(entry));
        }
        /** 常量 jsonlContent 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const jsonlContent = lines.join('\n');

        // Create download
        // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
        const blob = new Blob([jsonlContent], { type: 'application/x-ndjson' });
        /** 常量 url 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const url = URL.createObjectURL(blob);
        /** 常量 a 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const a = document.createElement('a');
        a.href = url;
        a.download = `${header?.id || 'session'}.jsonl`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }

      /**
       * Build a shareable URL for a specific message.
       * URL format: base?gistId&leafId=<leafId>&targetId=<entryId>
       */
// 中文说明：上方英文注释给出本段功能、前提或边界，下面代码按该说明执行。
      function buildShareUrl(entryId) {
        // Check for injected base URL (used when loaded in iframe via srcdoc)
        // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
        const baseUrlMeta = document.querySelector('meta[name="pi-share-base-url"]');
        /** 常量 baseUrl 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const baseUrl = baseUrlMeta ? baseUrlMeta.content : window.location.href.split('?')[0];

        /** 常量 url 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const url = new URL(window.location.href);
        // Find the gist ID (first query param without value, e.g., ?abc123)
        // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
        const gistId = Array.from(url.searchParams.keys()).find(k => !url.searchParams.get(k));

        // Build the share URL
        // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
        const params = new URLSearchParams();
        params.set('leafId', currentLeafId);
        params.set('targetId', entryId);

        // If we have an injected base URL (iframe context), use it directly
        // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
        if (baseUrlMeta) {
          return `${baseUrl}&${params.toString()}`;
        }

        // Otherwise build from current location (direct file access)
        // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
        url.search = gistId ? `?${gistId}&${params.toString()}` : `?${params.toString()}`;
        return url.toString();
      }

      /**
       * Copy text to clipboard with visual feedback.
       * Uses navigator.clipboard with fallback to execCommand for HTTP contexts.
       */
// 中文说明：上方英文注释给出本段功能、前提或边界，下面代码按该说明执行。
      async function copyToClipboard(text, button) {
        /** 变量 success 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        let success = false;
        try {
          if (navigator.clipboard && navigator.clipboard.writeText) {
            await navigator.clipboard.writeText(text);
            success = true;
          }
        } catch (err) {
          // Clipboard API failed, try fallback
          // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
        }

        // Fallback for HTTP or when Clipboard API is unavailable
        // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
        if (!success) {
          try {
            /** 常量 textarea 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const textarea = document.createElement('textarea');
            textarea.value = text;
            textarea.style.position = 'fixed';
            textarea.style.opacity = '0';
            document.body.appendChild(textarea);
            textarea.select();
            success = document.execCommand('copy');
            document.body.removeChild(textarea);
          } catch (err) {
            console.error('Failed to copy:', err);
          }
        }

        if (success && button) {
          /** 常量 originalHtml 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
          const originalHtml = button.innerHTML;
          button.innerHTML = '✓';
          button.classList.add('copied');
          setTimeout(() => {
            button.innerHTML = originalHtml;
            button.classList.remove('copied');
          }, 1500);
        }
      }

      /**
       * Render the copy-link button HTML for a message.
       */
// 中文说明：上方英文注释给出本段功能、前提或边界，下面代码按该说明执行。
      function renderCopyLinkButton(entryId) {
        return `<button class="copy-link-btn" data-entry-id="${escapeHtml(entryId)}" title="Copy link to this message">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/>
            <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/>
          </svg>
        </button>`;
      }

      /** renderEntry 执行当前测试辅助步骤；参数 entry 按签名提供输入，返回值供调用方断言。示例：renderEntry(...)。 */
      function renderEntry(entry) {
        /** 常量 ts 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const ts = formatTimestamp(entry.timestamp);
        /** 常量 tsHtml 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const tsHtml = ts ? `<div class="message-timestamp">${ts}</div>` : '';
        /** 常量 entryDomId 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const entryDomId = `entry-${escapeHtml(entry.id)}`;
        /** 常量 copyBtnHtml 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const copyBtnHtml = renderCopyLinkButton(entry.id);

        if (entry.type === 'message') {
          /** 常量 msg 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
          const msg = entry.message;

          if (msg.role === 'user') {
            /** 常量 content 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const content = msg.content;
            /** 常量 text 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const text = typeof content === 'string' ? content :
              content.filter(c => c.type === 'text').map(c => c.text).join('\n');
            /** 常量 skillBlock 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const skillBlock = parseSkillBlock(text);

            if (skillBlock) {
              // Collect images from content array
              // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
              const images = Array.isArray(content) ? content.filter(c => c.type === 'image') : [];
              /** 常量 hasUserContent 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
              const hasUserContent = skillBlock.userMessage || images.length > 0;
              /** 变量 html 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
              let html = `<div class="skill-user-entry" id="${entryDomId}">${copyBtnHtml}${tsHtml}`;

              // Skill invocation (collapsed by default, click to expand)
              // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
              html += `<div class="skill-invocation" onclick="if(window.getSelection().toString())return;this.classList.toggle('expanded')">
                <div class="skill-invocation-label">[skill] ${escapeHtml(skillBlock.name)}</div>
                <div class="skill-invocation-collapsed">${escapeHtml(skillBlock.name)} (click to expand)</div>
                <div class="skill-invocation-content markdown-content">${safeMarkedParse(skillBlock.content)}</div>
              </div>`;

              // User message (separate block if present)
              // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
              if (hasUserContent) {
                html += '<div class="user-message">';
                if (images.length > 0) {
                  html += '<div class="message-images">';
                  /** 循环变量 img 表示当前遍历项或索引，仅在循环体内有效。 */
                  for (const img of images) {
                    html += `<img src="data:${escapeHtml(img.mimeType || 'image/png')};base64,${escapeHtml(img.data || '')}" class="message-image" />`;
                  }
                  html += '</div>';
                }
                if (skillBlock.userMessage) {
                  html += `<div class="markdown-content">${safeMarkedParse(skillBlock.userMessage)}</div>`;
                }
                html += '</div>';
              }

              html += '</div>';
              return html;
            }

            // No skill block - normal user message
            // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
            let html = `<div class="user-message" id="${entryDomId}">${copyBtnHtml}${tsHtml}`;

            if (Array.isArray(content)) {
              /** 常量 images 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
              const images = content.filter(c => c.type === 'image');
              if (images.length > 0) {
                html += '<div class="message-images">';
                /** 循环变量 img 表示当前遍历项或索引，仅在循环体内有效。 */
                for (const img of images) {
                  html += `<img src="data:${escapeHtml(img.mimeType || 'image/png')};base64,${escapeHtml(img.data || '')}" class="message-image" />`;
                }
                html += '</div>';
              }
            }

            if (text.trim()) {
              html += `<div class="markdown-content">${safeMarkedParse(text)}</div>`;
            }
            html += '</div>';
            return html;
          }

          if (msg.role === 'assistant') {
            /** 变量 html 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            let html = `<div class="assistant-message" id="${entryDomId}">${copyBtnHtml}${tsHtml}`;

            /** 循环变量 block 表示当前遍历项或索引，仅在循环体内有效。 */
            for (const block of msg.content) {
              if (block.type === 'text' && block.text.trim()) {
                html += `<div class="assistant-text markdown-content">${safeMarkedParse(block.text)}</div>`;
              } else if (block.type === 'thinking' && block.thinking.trim()) {
                html += `<div class="thinking-block">
                  <div class="thinking-text">${escapeHtml(block.thinking)}</div>
                  <div class="thinking-collapsed">Thinking ...</div>
                </div>`;
              }
            }

            /** 循环变量 block 表示当前遍历项或索引，仅在循环体内有效。 */
            for (const block of msg.content) {
              if (block.type === 'toolCall') {
                html += renderToolCall(block);
              }
            }

            if (msg.stopReason === 'aborted') {
              html += '<div class="error-text">Aborted</div>';
            } else if (msg.stopReason === 'error') {
              html += `<div class="error-text">Error: ${escapeHtml(msg.errorMessage || 'Unknown error')}</div>`;
            }

            html += '</div>';
            return html;
          }

          if (msg.role === 'bashExecution') {
            /** 常量 isError 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const isError = msg.cancelled || (msg.exitCode !== 0 && msg.exitCode !== null);
            /** 变量 html 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            let html = `<div class="tool-execution ${isError ? 'error' : 'success'}" id="${entryDomId}">${tsHtml}`;
            html += `<div class="tool-command">$ ${escapeHtml(msg.command)}</div>`;
            if (msg.output) html += formatExpandableOutput(msg.output, 10);
            if (msg.cancelled) {
              html += '<div style="color: var(--warning)">(cancelled)</div>';
            } else if (msg.exitCode !== 0 && msg.exitCode !== null) {
              html += `<div style="color: var(--error)">(exit ${msg.exitCode})</div>`;
            }
            html += '</div>';
            return html;
          }

          if (msg.role === 'toolResult') return '';
        }

        if (entry.type === 'model_change') {
          return `<div class="model-change" id="${entryDomId}">${tsHtml}Switched to model: <span class="model-name">${escapeHtml(entry.provider)}/${escapeHtml(entry.modelId)}</span></div>`;
        }

        if (entry.type === 'compaction') {
          return `<div class="compaction" id="${entryDomId}" onclick="if(window.getSelection().toString())return;this.classList.toggle('expanded')">
            <div class="compaction-label">[compaction]</div>
            <div class="compaction-collapsed">Compacted from ${entry.tokensBefore.toLocaleString()} tokens</div>
            <div class="compaction-content"><strong>Compacted from ${entry.tokensBefore.toLocaleString()} tokens</strong>\n\n${escapeHtml(entry.summary)}</div>
          </div>`;
        }

        if (entry.type === 'branch_summary') {
          return `<div class="branch-summary" id="${entryDomId}">${tsHtml}
            <div class="branch-summary-header">Branch Summary</div>
            <div class="markdown-content">${safeMarkedParse(entry.summary)}</div>
          </div>`;
        }

        if (entry.type === 'custom_message' && entry.display) {
          return `<div class="hook-message" id="${entryDomId}">${tsHtml}
            <div class="hook-type">[${escapeHtml(entry.customType)}]</div>
            <div class="markdown-content">${safeMarkedParse(typeof entry.content === 'string' ? entry.content : JSON.stringify(entry.content))}</div>
          </div>`;
        }

        return '';
      }

      // ============================================================
      // HEADER / STATS
      // ============================================================
      // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。

      /** computeStats 执行当前测试辅助步骤；参数 entryList 按签名提供输入，返回值供调用方断言。示例：computeStats(...)。 */
      function computeStats(entryList) {
        /** 变量 userMessages 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        let userMessages = 0, assistantMessages = 0, toolResults = 0;
        /** 变量 customMessages 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        let customMessages = 0, compactions = 0, branchSummaries = 0, toolCalls = 0;
        /** 常量 tokens 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const tokens = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
        /** 常量 cost 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const cost = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };
        /** 常量 models 保存当前场景的模型数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const models = new Set();

        /** 循环变量 entry 表示当前遍历项或索引，仅在循环体内有效。 */
        for (const entry of entryList) {
          if (entry.type === 'message') {
            /** 常量 msg 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const msg = entry.message;
            if (msg.role === 'user') userMessages++;
            if (msg.role === 'assistant') {
              assistantMessages++;
              if (msg.model) models.add(msg.provider ? `${msg.provider}/${msg.model}` : msg.model);
              if (msg.usage) {
                tokens.input += msg.usage.input || 0;
                tokens.output += msg.usage.output || 0;
                tokens.cacheRead += msg.usage.cacheRead || 0;
                tokens.cacheWrite += msg.usage.cacheWrite || 0;
                if (msg.usage.cost) {
                  cost.input += msg.usage.cost.input || 0;
                  cost.output += msg.usage.cost.output || 0;
                  cost.cacheRead += msg.usage.cost.cacheRead || 0;
                  cost.cacheWrite += msg.usage.cost.cacheWrite || 0;
                }
              }
              toolCalls += msg.content.filter(c => c.type === 'toolCall').length;
            }
            if (msg.role === 'toolResult') toolResults++;
          } else if (entry.type === 'compaction') {
            compactions++;
          } else if (entry.type === 'branch_summary') {
            branchSummaries++;
          } else if (entry.type === 'custom_message') {
            customMessages++;
          }
        }

        return { userMessages, assistantMessages, toolResults, customMessages, compactions, branchSummaries, toolCalls, tokens, cost, models: Array.from(models) };
      }

      /** 常量 globalStats 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
      const globalStats = computeStats(entries);

      /** renderHeader 执行当前测试辅助步骤；参数 无 按签名提供输入，返回值供调用方断言。示例：renderHeader()。 */
      function renderHeader() {
        /** 常量 totalCost 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const totalCost = globalStats.cost.input + globalStats.cost.output + globalStats.cost.cacheRead + globalStats.cost.cacheWrite;

        /** 常量 tokenParts 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const tokenParts = [];
        if (globalStats.tokens.input) tokenParts.push(`↑${formatTokens(globalStats.tokens.input)}`);
        if (globalStats.tokens.output) tokenParts.push(`↓${formatTokens(globalStats.tokens.output)}`);
        if (globalStats.tokens.cacheRead) tokenParts.push(`R${formatTokens(globalStats.tokens.cacheRead)}`);
        if (globalStats.tokens.cacheWrite) tokenParts.push(`W${formatTokens(globalStats.tokens.cacheWrite)}`);

        /** 常量 msgParts 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const msgParts = [];
        if (globalStats.userMessages) msgParts.push(`${globalStats.userMessages} user`);
        if (globalStats.assistantMessages) msgParts.push(`${globalStats.assistantMessages} assistant`);
        if (globalStats.toolResults) msgParts.push(`${globalStats.toolResults} tool results`);
        if (globalStats.customMessages) msgParts.push(`${globalStats.customMessages} custom`);
        if (globalStats.compactions) msgParts.push(`${globalStats.compactions} compactions`);
        if (globalStats.branchSummaries) msgParts.push(`${globalStats.branchSummaries} branch summaries`);

        /** 变量 html 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        let html = `
          <div class="header">
            <h1>Session: ${escapeHtml(header?.id || 'unknown')}</h1>
            <div class="help-bar">
              <span class="help-hint">T toggle thinking · O toggle tools</span>
              <div class="help-actions">
                <button type="button" class="header-toggle-btn" data-action="toggle-thinking" title="Toggle thinking (T)">Toggle thinking</button>
                <button type="button" class="header-toggle-btn" data-action="toggle-tools" title="Toggle tools (O)">Toggle tools</button>
                <button type="button" class="download-json-btn" onclick="downloadSessionJson()" title="Download session as JSONL">↓ JSONL</button>
              </div>
            </div>
            <div class="header-info">
              <div class="info-item"><span class="info-label">Date:</span><span class="info-value">${header?.timestamp ? new Date(header.timestamp).toLocaleString() : 'unknown'}</span></div>
              <div class="info-item"><span class="info-label">Models:</span><span class="info-value">${escapeHtml(globalStats.models.join(', ') || 'unknown')}</span></div>
              <div class="info-item"><span class="info-label">Messages:</span><span class="info-value">${msgParts.join(', ') || '0'}</span></div>
              <div class="info-item"><span class="info-label">Tool Calls:</span><span class="info-value">${globalStats.toolCalls}</span></div>
              <div class="info-item"><span class="info-label">Tokens:</span><span class="info-value">${tokenParts.join(' ') || '0'}</span></div>
              <div class="info-item"><span class="info-label">Cost:</span><span class="info-value">$${totalCost.toFixed(3)}</span></div>
            </div>
          </div>`;

        // Render system prompt (user's base prompt, applies to all providers)
        // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
        if (systemPrompt) {
          /** 常量 lines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
          const lines = systemPrompt.split('\n');
          /** 常量 previewLines 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
          const previewLines = 10;
          if (lines.length > previewLines) {
            /** 常量 preview 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const preview = lines.slice(0, previewLines).join('\n');
            /** 常量 remaining 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const remaining = lines.length - previewLines;
            html += `<div class="system-prompt expandable" onclick="if(window.getSelection().toString())return;this.classList.toggle('expanded')">
              <div class="system-prompt-header">System Prompt</div>
              <div class="system-prompt-preview">${escapeHtml(preview)}</div>
              <div class="system-prompt-expand-hint">... (${remaining} more lines, click to expand)</div>
              <div class="system-prompt-full">${escapeHtml(systemPrompt)}</div>
            </div>`;
          } else {
            html += `<div class="system-prompt">
              <div class="system-prompt-header">System Prompt</div>
              <div class="system-prompt-full" style="display: block">${escapeHtml(systemPrompt)}</div>
            </div>`;
          }
        }

        if (tools && tools.length > 0) {
          html += `<div class="tools-list">
            <div class="tools-header">Available Tools</div>
            <div class="tools-content">
              ${tools.map(t => {
                const hasParams = t.parameters && typeof t.parameters === 'object' && t.parameters.properties && Object.keys(t.parameters.properties).length > 0;
                if (!hasParams) {
                  return `<div class="tool-item"><span class="tool-item-name">${escapeHtml(t.name)}</span> - <span class="tool-item-desc">${escapeHtml(t.description)}</span></div>`;
                }
                const params = t.parameters;
                const properties = params.properties;
                const required = params.required || [];
                let paramsHtml = '';
                for (const [name, prop] of Object.entries(properties)) {
                  const isRequired = required.includes(name);
                  const typeStr = prop.type || 'any';
                  const reqLabel = isRequired ? '<span class="tool-param-required">required</span>' : '<span class="tool-param-optional">optional</span>';
                  paramsHtml += `<div class="tool-param"><span class="tool-param-name">${escapeHtml(name)}</span> <span class="tool-param-type">${escapeHtml(typeStr)}</span> ${reqLabel}`;
                  if (prop.description) {
                    paramsHtml += `<div class="tool-param-desc">${escapeHtml(prop.description)}</div>`;
                  }
                  paramsHtml += `</div>`;
                }
                return `<div class="tool-item" onclick="if(window.getSelection().toString())return;this.classList.toggle('params-expanded')"><span class="tool-item-name">${escapeHtml(t.name)}</span> - <span class="tool-item-desc">${escapeHtml(t.description)}</span> <span class="tool-params-hint"></span><div class="tool-params-content">${paramsHtml}</div></div>`;
              }).join('')}
            </div>
          </div>`;
        }

        return html;
      }

      // ============================================================
      // NAVIGATION
      // ============================================================
      // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。

      // Cache for rendered entry DOM nodes
      // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
      const entryCache = new Map();

      /** getScrollTargetElementId 执行当前测试辅助步骤；参数 entryId 按签名提供输入，返回值供调用方断言。示例：getScrollTargetElementId(...)。 */
      function getScrollTargetElementId(entryId) {
        /** 常量 entry 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const entry = byId.get(entryId);
        if (entry?.type === 'message' && entry.message.role === 'toolResult' && entry.message.toolCallId) {
          // getElementById() matches the parsed DOM id attribute, whose HTML entities
          // were already resolved from the escaped id rendered by renderToolCall().
          // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
          return `tool-call-${entry.message.toolCallId}`;
        }
        return `entry-${entryId}`;
      }

      /** renderEntryToNode 执行当前测试辅助步骤；参数 entry 按签名提供输入，返回值供调用方断言。示例：renderEntryToNode(...)。 */
      function renderEntryToNode(entry) {
        // Check cache first
        // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
        if (entryCache.has(entry.id)) {
          return entryCache.get(entry.id).cloneNode(true);
        }

        // Render to HTML string, then parse to node
        // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
        const html = renderEntry(entry);
        if (!html) return null;

        /** 常量 template 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const template = document.createElement('template');
        template.innerHTML = html;
        /** 常量 node 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const node = template.content.firstElementChild;

        // Cache the node
        // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
        if (node) {
          entryCache.set(entry.id, node.cloneNode(true));
        }
        return node;
      }

      /** navigateTo 执行当前测试辅助步骤；参数 targetId、scrollMode 、scrollToEntryId  按签名提供输入，返回值供调用方断言。示例：navigateTo(..., ..., ...)。 */
      function navigateTo(targetId, scrollMode = 'target', scrollToEntryId = null) {
        currentLeafId = targetId;
        currentTargetId = scrollToEntryId || targetId;
        /** 常量 path 保存当前场景的路径或文件数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const path = getPath(targetId);

        renderTree();

        document.getElementById('header-container').innerHTML = renderHeader();
        attachHeaderHandlers();

        // Build messages using cached DOM nodes
        // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
        const messagesEl = document.getElementById('messages');
        /** 常量 fragment 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const fragment = document.createDocumentFragment();

        /** 循环变量 entry 表示当前遍历项或索引，仅在循环体内有效。 */
        for (const entry of path) {
          /** 常量 node 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
          const node = renderEntryToNode(entry);
          if (node) {
            fragment.appendChild(node);
          }
        }

        messagesEl.innerHTML = '';
        messagesEl.appendChild(fragment);

        // Attach click handlers for copy-link buttons
        // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
        messagesEl.querySelectorAll('.copy-link-btn').forEach(btn => {
          btn.addEventListener('click', (e) => {
            e.stopPropagation();
            /** 常量 entryId 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const entryId = btn.dataset.entryId;
            /** 常量 shareUrl 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const shareUrl = buildShareUrl(entryId);
            copyToClipboard(shareUrl, btn);
          });
        });

        // Use setTimeout(0) to ensure DOM is fully laid out before scrolling
        // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
        setTimeout(() => {
          /** 常量 content 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
          const content = document.getElementById('content');
          if (scrollMode === 'bottom') {
            content.scrollTop = content.scrollHeight;
          } else if (scrollMode === 'target') {
            // If scrollToEntryId is provided, scroll to that specific entry.
            // Tool result entries are rendered inside their assistant tool-call block,
            // so route them to the visible tool-call element instead.
            // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
            const scrollTargetId = scrollToEntryId || targetId;
            /** 常量 targetEl 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const targetEl = document.getElementById(getScrollTargetElementId(scrollTargetId)) ||
              document.getElementById(`entry-${scrollTargetId}`);
            if (targetEl) {
              targetEl.scrollIntoView({ block: 'center' });
              // Briefly highlight the target message
              // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
              if (scrollToEntryId) {
                targetEl.classList.add('highlight');
                setTimeout(() => targetEl.classList.remove('highlight'), 2000);
              }
            }
          }
        }, 0);
      }

      // ============================================================
      // INITIALIZATION
      // ============================================================
      // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。

      // Configure marked with syntax highlighting and TUI-compatible HTML handling
      // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
      const strictStrikethroughRegex = /^(~~)(?=[^\s~])((?:\\.|[^\\])*?(?:\\.|[^\s~\\]))\1(?=[^~]|$)/;

      marked.use({
        breaks: true,
        gfm: true,
        tokenizer: {
          // Treat HTML-like input as plain text so tags are shown verbatim,
          // matching the TUI markdown renderer.
          // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
          html() {
            return undefined;
          },
          tag() {
            return undefined;
          },
          del(src) {
            /** 常量 match 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const match = strictStrikethroughRegex.exec(src);
            if (!match) return undefined;
            return {
              type: 'del',
              raw: match[0],
              text: match[2],
              tokens: this.lexer.inlineTokens(match[2])
            };
          }
        },
        renderer: {
          // Sanitize link URLs with a scheme allow-list. Browsers strip C0
          // controls from schemes, so strip them before checking and emitting.
          // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
          link(token) {
            /** 常量 href 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const href = sanitizeMarkdownUrl(token.href);
            if (href === null) {
              return this.parser.parseInline(token.tokens);
            }
            /** 变量 out 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            let out = '<a href="' + escapeHtml(href) + '"';
            if (token.title) {
              out += ' title="' + escapeHtml(token.title) + '"';
            }
            out += '>' + this.parser.parseInline(token.tokens) + '</a>';
            return out;
          },
          // Sanitize image src URLs with the same scheme allow-list.
          // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
          image(token) {
            /** 常量 href 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const href = sanitizeMarkdownUrl(token.href);
            if (href === null) {
              return escapeHtml(token.text || '');
            }
            /** 变量 out 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            let out = '<img src="' + escapeHtml(href) + '" alt="' + escapeHtml(token.text || '') + '"';
            if (token.title) {
              out += ' title="' + escapeHtml(token.title) + '"';
            }
            out += '>';
            return out;
          },
          // Code blocks: syntax highlight, no HTML escaping
          // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
          code(token) {
            /** 常量 code 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const code = token.text;
            /** 常量 lang 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            const lang = token.lang;
            /** 变量 highlighted 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
            let highlighted;
            if (lang && hljs.getLanguage(lang)) {
              try {
                highlighted = hljs.highlight(code, { language: lang }).value;
              } catch {
                highlighted = escapeHtml(code);
              }
            } else {
              // Auto-detect language if not specified
              // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
              try {
                highlighted = hljs.highlightAuto(code).value;
              } catch {
                highlighted = escapeHtml(code);
              }
            }
            return `<pre><code class="hljs">${highlighted}</code></pre>`;
          },
          // Inline code: escape HTML
          // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
          codespan(token) {
            return `<code>${escapeHtml(token.text)}</code>`;
          }
        }
      });

      // Simple marked parse (escaping handled in renderers)
      // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
      function safeMarkedParse(text) {
        return marked.parse(text);
      }

      // Search input
      // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
      const searchInput = document.getElementById('tree-search');
      searchInput.addEventListener('input', (e) => {
        searchQuery = e.target.value;
        forceTreeRerender();
      });

      // Filter buttons
      // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
      document.querySelectorAll('.filter-btn').forEach(btn => {
        btn.addEventListener('click', () => {
          document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
          btn.classList.add('active');
          filterMode = btn.dataset.filter;
          forceTreeRerender();
        });
      });

      // Sidebar toggle
      // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
      const sidebar = document.getElementById('sidebar');
      /** 常量 overlay 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
      const overlay = document.getElementById('sidebar-overlay');
      /** 常量 hamburger 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
      const hamburger = document.getElementById('hamburger');
      /** 常量 sidebarResizer 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
      const sidebarResizer = document.getElementById('sidebar-resizer');
      /** 常量 SIDEBAR_WIDTH_STORAGE_KEY 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
      const SIDEBAR_WIDTH_STORAGE_KEY = 'pi-share:v1:sidebar-width';
      /** 常量 MIN_CONTENT_WIDTH 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
      const MIN_CONTENT_WIDTH = 320;

      /** isMobileLayout 执行当前测试辅助步骤；参数 无 按签名提供输入，返回值供调用方断言。示例：isMobileLayout()。 */
      function isMobileLayout() {
        return window.matchMedia('(max-width: 900px)').matches;
      }

      /** getSidebarBounds 执行当前测试辅助步骤；参数 无 按签名提供输入，返回值供调用方断言。示例：getSidebarBounds()。 */
      function getSidebarBounds() {
        /** 常量 rootStyles 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const rootStyles = getComputedStyle(document.documentElement);
        /** 常量 minWidth 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const minWidth = parseFloat(rootStyles.getPropertyValue('--sidebar-min-width')) || 240;
        /** 常量 maxWidth 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const maxWidth = parseFloat(rootStyles.getPropertyValue('--sidebar-max-width')) || 720;
        /** 常量 viewportMaxWidth 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const viewportMaxWidth = window.innerWidth - MIN_CONTENT_WIDTH;
        return {
          minWidth,
          maxWidth: Math.max(minWidth, Math.min(maxWidth, viewportMaxWidth))
        };
      }

      /** clampSidebarWidth 执行当前测试辅助步骤；参数 width 按签名提供输入，返回值供调用方断言。示例：clampSidebarWidth(...)。 */
      function clampSidebarWidth(width) {
        /** 常量 { minWidth, maxWidth } 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const { minWidth, maxWidth } = getSidebarBounds();
        return Math.max(minWidth, Math.min(maxWidth, width));
      }

      /** applySidebarWidth 执行当前测试辅助步骤；参数 width 按签名提供输入，返回值供调用方断言。示例：applySidebarWidth(...)。 */
      function applySidebarWidth(width) {
        document.documentElement.style.setProperty('--sidebar-width', `${Math.round(clampSidebarWidth(width))}px`);
      }

      /** loadSidebarWidth 执行当前测试辅助步骤；参数 无 按签名提供输入，返回值供调用方断言。示例：loadSidebarWidth()。 */
      function loadSidebarWidth() {
        try {
          /** 常量 raw 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
          const raw = localStorage.getItem(SIDEBAR_WIDTH_STORAGE_KEY);
          if (raw === null) return null;
          /** 常量 width 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
          const width = Number(raw);
          return Number.isFinite(width) ? width : null;
        } catch {
          return null;
        }
      }

      /** saveSidebarWidth 执行当前测试辅助步骤；参数 width 按签名提供输入，返回值供调用方断言。示例：saveSidebarWidth(...)。 */
      function saveSidebarWidth(width) {
        try {
          localStorage.setItem(SIDEBAR_WIDTH_STORAGE_KEY, String(Math.round(clampSidebarWidth(width))));
        } catch {
          // Ignore storage failures (e.g. private browsing restrictions)
          // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
        }
      }

      /** setupSidebarResize 执行当前测试辅助步骤；参数 无 按签名提供输入，返回值供调用方断言。示例：setupSidebarResize()。 */
      function setupSidebarResize() {
        /** 常量 savedWidth 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const savedWidth = loadSidebarWidth();
        if (savedWidth !== null) {
          applySidebarWidth(savedWidth);
        }

        if (!sidebarResizer) return;

        /** 变量 cleanupDrag 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        let cleanupDrag = null;

        /** stopDrag 封装当前回调或辅助步骤；参数 pointerId 提供输入，返回值用于后续流程。示例：stopDrag(...)。 */
        const stopDrag = (pointerId) => {
          if (cleanupDrag) {
            cleanupDrag(pointerId);
            cleanupDrag = null;
          }
        };

        sidebarResizer.addEventListener('pointerdown', (e) => {
          if (isMobileLayout()) return;

          e.preventDefault();
          /** 常量 startX 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
          const startX = e.clientX;
          /** 常量 startWidth 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
          const startWidth = sidebar.getBoundingClientRect().width;
          document.body.classList.add('sidebar-resizing');
          sidebarResizer.setPointerCapture?.(e.pointerId);

          /** onPointerMove 封装当前回调或辅助步骤；参数 event 提供输入，返回值用于后续流程。示例：onPointerMove(...)。 */
          const onPointerMove = (event) => {
            applySidebarWidth(startWidth + (event.clientX - startX));
          };

          cleanupDrag = (pointerIdToRelease) => {
            document.body.classList.remove('sidebar-resizing');
            sidebarResizer.releasePointerCapture?.(pointerIdToRelease);
            window.removeEventListener('pointermove', onPointerMove);
            window.removeEventListener('pointerup', onPointerUp);
            window.removeEventListener('pointercancel', onPointerCancel);
            saveSidebarWidth(sidebar.getBoundingClientRect().width);
          };

          /** onPointerUp 封装当前回调或辅助步骤；参数 event 提供输入，返回值用于后续流程。示例：onPointerUp(...)。 */
          const onPointerUp = (event) => stopDrag(event.pointerId);
          /** onPointerCancel 封装当前回调或辅助步骤；参数 event 提供输入，返回值用于后续流程。示例：onPointerCancel(...)。 */
          const onPointerCancel = (event) => stopDrag(event.pointerId);

          window.addEventListener('pointermove', onPointerMove);
          window.addEventListener('pointerup', onPointerUp);
          window.addEventListener('pointercancel', onPointerCancel);
        });

        sidebarResizer.addEventListener('dblclick', () => {
          if (isMobileLayout()) return;
          applySidebarWidth(400);
          saveSidebarWidth(400);
        });

        window.addEventListener('resize', () => {
          if (isMobileLayout()) return;
          applySidebarWidth(sidebar.getBoundingClientRect().width);
        });
      }

      setupSidebarResize();

      hamburger.addEventListener('click', () => {
        sidebar.classList.add('open');
        overlay.classList.add('open');
        hamburger.style.display = 'none';
      });

      /** closeSidebar 封装当前回调或辅助步骤；参数 无 提供输入，返回值用于后续流程。示例：closeSidebar()。 */
      const closeSidebar = () => {
        sidebar.classList.remove('open');
        overlay.classList.remove('open');
        hamburger.style.display = '';
      };

      overlay.addEventListener('click', closeSidebar);
      document.getElementById('sidebar-close').addEventListener('click', closeSidebar);

      // Toggle states
      // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
      let thinkingExpanded = true;
      /** 变量 toolOutputsExpanded 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
      let toolOutputsExpanded = false;

      /** toggleThinking 封装当前回调或辅助步骤；参数 无 提供输入，返回值用于后续流程。示例：toggleThinking()。 */
      const toggleThinking = () => {
        thinkingExpanded = !thinkingExpanded;
        document.querySelectorAll('.thinking-text').forEach(el => {
          el.style.display = thinkingExpanded ? '' : 'none';
        });
        document.querySelectorAll('.thinking-collapsed').forEach(el => {
          el.style.display = thinkingExpanded ? 'none' : 'block';
        });
      };

      /** toggleToolOutputs 封装当前回调或辅助步骤；参数 无 提供输入，返回值用于后续流程。示例：toggleToolOutputs()。 */
      const toggleToolOutputs = () => {
        toolOutputsExpanded = !toolOutputsExpanded;
        document.querySelectorAll('.tool-output.expandable').forEach(el => {
          el.classList.toggle('expanded', toolOutputsExpanded);
        });
        document.querySelectorAll('.compaction').forEach(el => {
          el.classList.toggle('expanded', toolOutputsExpanded);
        });
        document.querySelectorAll('.skill-invocation').forEach(el => {
          el.classList.toggle('expanded', toolOutputsExpanded);
        });
      };

      /** attachHeaderHandlers 封装当前回调或辅助步骤；参数 无 提供输入，返回值用于后续流程。示例：attachHeaderHandlers()。 */
      const attachHeaderHandlers = () => {
        document.querySelector('[data-action="toggle-thinking"]')?.addEventListener('click', toggleThinking);
        document.querySelector('[data-action="toggle-tools"]')?.addEventListener('click', toggleToolOutputs);
      };

      /** isEditableTarget 封装当前回调或辅助步骤；参数 element 提供输入，返回值用于后续流程。示例：isEditableTarget(...)。 */
      const isEditableTarget = (element) => {
        if (!element) return false;
        /** 常量 tagName 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const tagName = element.tagName;
        if (tagName === 'INPUT' || tagName === 'TEXTAREA' || tagName === 'SELECT' || tagName === 'BUTTON') {
          return true;
        }
        return element.isContentEditable || Boolean(element.closest?.('[contenteditable="true"]'));
      };

      // Keyboard shortcuts
      // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
      document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') {
          searchInput.value = '';
          searchQuery = '';
          navigateTo(leafId, 'bottom');
        }

        if (isEditableTarget(document.activeElement)) {
          return;
        }

        /** 常量 key 保存当前场景的中间数据；取值由声明类型和本用例约束，注意隔离可变状态。 */
        const key = e.key.toLowerCase();
        if (key === 't') {
          e.preventDefault();
          toggleThinking();
        } else if (key === 'o') {
          e.preventDefault();
          toggleToolOutputs();
        }
      });

      // Initial render
      // If URL has targetId, scroll to that specific message; otherwise stay at top
      // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
      if (leafId) {
        if (urlTargetId && byId.has(urlTargetId)) {
          // Deep link: navigate to leaf and scroll to target message
          // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
          navigateTo(leafId, 'target', urlTargetId);
        } else {
          navigateTo(leafId, 'none');
        }
      } else if (entries.length > 0) {
        // Fallback: use last entry if no leafId
        // 中文说明：上方英文注释记录本段测试前提、预期行为或边界，修改时应同步核对下面断言。
        navigateTo(entries[entries.length - 1].id, 'none');
      }
    })();
