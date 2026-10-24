// Produces private candidates and previews. Validate before replacing published decks.
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { resolve, join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import { compileDecks } from './src/slides.mjs';

const runtimeModules = process.env.RUNTIME_NODE_MODULES;
if (!runtimeModules) throw new Error('请设置 RUNTIME_NODE_MODULES 为包含 @oai/artifact-tool 的绝对路径');
const require = createRequire(join(resolve(runtimeModules), '__runtime__.cjs'));
const { PresentationFile, FileBlob } = require('@oai/artifact-tool');
const dir = dirname(fileURLToPath(import.meta.url));
const output = process.argv[2];
if (!output) throw new Error('需要独立的候选输出目录；不会覆盖已发布 PPTX');
const out = resolve(output);
const course = JSON.parse(await readFile(join(dir, 'data/mastery.json'), 'utf8'));
const features = JSON.parse(await readFile(join(dir, 'data/features.json'), 'utf8')).features;
const decks = compileDecks(course, features, course.plan.baseline);
await mkdir(out, { recursive: true });
await writeFile(join(out, 'content.json'), JSON.stringify(decks, null, 2));
for (const deck of decks) {
  if (process.argv[3] && !process.argv[3].split(',').includes(deck.stage)) continue;
  const preview = join(out, deck.stage);
  await mkdir(preview, { recursive: true });
  const presentation = await PresentationFile.importPptx(await FileBlob.load(join(dir, 'learning-slides', deck.filename)));
  if (presentation.slides.items.length !== deck.slides.length) throw new Error(`${deck.stage} 页数变化，需要审查模板`);
  for (const [index, slide] of presentation.slides.items.entries()) {
    const layout = JSON.parse(await (await slide.export({ format: 'layout' })).text());
    await writeFile(join(preview, `${index + 1}-before.json`), JSON.stringify(layout));
    await writeFile(join(preview, `${index + 1}-before.png`), new Uint8Array(await (await slide.export({ format: 'png', scale: 1 })).arrayBuffer()));
    const lesson = deck.slides[index];
    const existing = new Set(layout.elements.map(element => element.name));
    for (const [name, text] of Object.entries(lesson.text)) {
      const element = layout.elements.find(element => element.name === name);
      if (element) presentation.resolve(element.id).text.replace(element.text, text);
      else {
        const match = /^(responsibility|step|data)-(\d+)$/.exec(name);
        const reference = match && layout.elements.find(element => element.name === `${match[1]}-0`);
        if (!reference) throw new Error(`${deck.stage}:${index + 1} 缺少文本框 ${name}`);
        const stride = match[1] === 'responsibility' ? 48 : 81;
        const added = slide.shapes.add({ name, geometry: 'rect', position: { ...reference.position, top: reference.position.top + Number(match[2]) * stride }, fill: 'none', line: { fill: 'none', width: 0 } });
        added.text = text;
        added.text.style = reference.style;
      }
      existing.delete(name);
    }
    for (const name of existing) {
      if (!/^(responsibility|step|data)-\d+$/.test(name)) throw new Error(`${deck.stage}:${index + 1} 有未审查文本框 ${name}`);
      const element = layout.elements.find(element => element.name === name);
      presentation.resolve(element.id).text = '';
    }
    slide.speakerNotes.text = lesson.notes;
    await writeFile(join(preview, `${index + 1}.json`), await (await slide.export({ format: 'layout' })).text());
    await writeFile(join(preview, `${index + 1}.png`), new Uint8Array(await (await slide.export({ format: 'png', scale: 1 })).arrayBuffer()));
  }
  await (await PresentationFile.exportPptx(presentation)).save(join(out, deck.filename));
  console.log(`${deck.filename}: ${deck.slides.length} 页，正文、备注及前后预览已生成`);
}
