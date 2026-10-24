/* Offline guide presentation: command text is copied only, never executed. */
function renderGuideBlocks(section, chapterId, index, esc) {
  return `${section.steps ? `<ol class="dev-steps">${section.steps.map(step => `<li>${esc(step)}</li>`).join('')}</ol>` : ''}${(section.commands || []).map((command, n) => `<div class="dev-command" data-command-shell="${esc(command.shell)}"><header><div><small>${esc(command.shell.toUpperCase())}</small><h3>${esc(command.title)}</h3></div><button class="quiet" data-copy-command="${chapterId}:${index}:${n}">复制</button></header><pre tabindex="0" aria-label="${esc(command.title)}"><code>${esc(command.code)}</code></pre><p class="dev-expected"><b>完成信号</b>${esc(command.expected)}</p></div>`).join('')}${section.callout ? `<div class="callout">${esc(section.callout)}</div>` : ''}${section.outcome ? `<p class="dev-outcome">${esc(section.outcome)}</p>` : ''}${section.external ? `<div class="dev-evidence">${section.external.map(link => `<a href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">${esc(link.title)}</a>`).join('')}</div>` : ''}`;
}

function readGuideCommand(chapters, key) {
  const match = /^([^:]+):(\d+):(\d+)$/.exec(key);
  if (!match) return undefined;
  return chapters.find(chapter => chapter.id === match[1])?.sections[Number(match[2])]?.commands?.[Number(match[3])]?.code;
}

function filterGuideCommands(host, shell) {
  host.querySelectorAll('[data-command-shell]').forEach(node => {
    node.hidden = ['powershell', 'bash'].includes(node.dataset.commandShell) && shell !== 'all' && node.dataset.commandShell !== shell;
  });
}
