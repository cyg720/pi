// Keep the original three-slide lesson structure; HTML and PPTX share route data.
export function compileDecks(course, features, baseline) {
  if (baseline !== course.plan.baseline) throw new Error('课件与课程基线不一致');
  const byId = new Map(features.map(feature => [feature.id, feature]));
  return course.stages.map(stage => ({
    stage: stage.id,
    filename: `${stage.id}.pptx`,
    slides: course.routes.filter(route => route.stage === stage.id).flatMap(route => {
      const notes = [
        `源码基线：${baseline}`,
        `课程：${stage.title} / ${route.id} / ${route.title}`,
        `场景：${route.scenario}`,
        '以下是教学追踪顺序，具体运行分支以源码为准。',
        ...route.steps.map((step, index) => [
          `${index + 1}. ${step.title}`, step.explain,
          `输入：${step.input}\n输出：${step.output}`,
          `入口：${step.entry}\n行为与边界：${step.behavior}`,
          ...step.refs.map(ref => `源码：${ref.path}:${ref.line}`)
        ].join('\n')),
        `失败与恢复：${route.failure}`,
        `练习：${route.exercise}\n参考判断：${route.answer}`,
        '关联专题与当前接口：',
        ...route.topicIds.map(id => {
          const topic = byId.get(id);
          if (!topic) throw new Error(`课件专题失效：${id}`);
          return `${topic.title}\n${topic.purpose}\n入口：${topic.entry}\n边界：${topic.behavior}`;
        }),
        '文档：', ...route.docs,
        '相关测试（列出路径不代表已运行）：', ...route.tests,
        '功能编号：', ...route.capabilities.map(cap => `${cap.title} [${cap.status}] ${cap.purpose}`)
      ].join('\n\n');
      return ['场景与职责', '步骤与数据', '失败与验证'].map((angle, page) => {
        const text = {
          eyebrow: `${stage.title}   /   ${angle}`, title: route.title,
          footer: `Pi 源码精通路线   /   ${route.id}   /   ${page + 1}     基线 ${baseline.slice(0, 9)} · 源码与参考答案见讲者备注`
        };
        if (page === 0) {
          Object.assign(text, { scenario: route.scenario, section: '各层负责什么' });
          route.steps.forEach((step, index) => { text[`responsibility-${index}`] = `${index + 1}. ${step.topicTitle}`; });
        } else if (page === 1) {
          route.steps.forEach((step, index) => {
            text[`step-${index}`] = `${index + 1}. ${step.title}`;
            text[`data-${index}`] = `输入：${step.input}    输出：${step.output}`;
          });
        } else {
          Object.assign(text, { 'failure-label': '失败与恢复', failure: route.failure, 'exercise-label': '动手练习', exercise: route.exercise });
          // Sentence boundaries keep the original large Chinese type from leaving an orphan character.
          if (['session-restore', 'prompt-resources'].includes(route.id)) text.failure = route.failure.replace('。', '。\n');
        }
        return { route: route.id, angle, text, notes };
      });
    })
  }));
}
