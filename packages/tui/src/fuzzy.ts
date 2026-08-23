/**
 * Fuzzy matching utilities.
 * Matches if all query characters appear in order (not necessarily consecutive).
 * Lower score = better match.
 */
/**
 * 【文件职责】模糊匹配工具集：判定查询串是否按序出现在目标文本中（可不相邻），
 *              并给出质量评分；提供按匹配质量过滤排序的列表过滤器。
 * 【技术维度】贪心顺序扫描 + 启发式评分（连续命中加分/间隔扣分/词边界加分/完全相等大幅加分）；
 *              “字母数字交换序”容错重试；多词元 AND 过滤。
 * 【产品维度】驱动命令面板、模型选择器、会话选择器等界面的搜索体验——
 *              输入 "sd" 就能快速定位 "settings" 之类的候选项。
 * 【逻辑维度】fuzzyMatch 主评分 → 主匹配失败时尝试字母/数字段交换后再评一次 →
 *              fuzzyFilter 把查询拆成空白或斜杠分隔的多个词元，全部命中才保留并按总分升序。
 * 【关键边界】评分越低越好（负分更优）；大小写不敏感；交换序匹配额外 +5 分惩罚；
 *              空查询直接原样返回全部条目。
 * 【新手阅读建议】先读 matchQuery 内层闭包理解四类加减分规则 → 再看交换序容错 →
 *              最后扫一眼 fuzzyFilter 的多词元循环。
 */

/** 模糊匹配结果（中文说明）：matches 是否命中；score 质量分（越小越好）。 */
export interface FuzzyMatch {
	matches: boolean;
	score: number;
}

// 模糊匹配主函数：query 是否按序出现在 text 中
export function fuzzyMatch(query: string, text: string): FuzzyMatch {
	// 双侧转小写，实现大小写不敏感
	const queryLower = query.toLowerCase();
	const textLower = text.toLowerCase();

	// 内层评分函数：给定归一化后的查询串进行贪心匹配
	const matchQuery = (normalizedQuery: string): FuzzyMatch => {
		if (normalizedQuery.length === 0) {
			return { matches: true, score: 0 };
		}

		if (normalizedQuery.length > textLower.length) {
			return { matches: false, score: 0 };
		}

		let queryIndex = 0;
		let score = 0;
		let lastMatchIndex = -1;
		let consecutiveMatches = 0;

		for (let i = 0; i < textLower.length && queryIndex < normalizedQuery.length; i++) {
			if (textLower[i] === normalizedQuery[queryIndex]) {
				const isWordBoundary = i === 0 || /[\s\-_./:]/.test(textLower[i - 1]!);

				// Reward consecutive matches
				// 连续命中奖励：连击越长减分越多
				if (lastMatchIndex === i - 1) {
					consecutiveMatches++;
					score -= consecutiveMatches * 5;
				} else {
					consecutiveMatches = 0;
					// Penalize gaps
					// 间隔惩罚：跳过的字符越多加的分越多
					if (lastMatchIndex >= 0) {
						score += (i - lastMatchIndex - 1) * 2;
					}
				}

				// Reward word boundary matches
				// 词边界命中额外奖励
				if (isWordBoundary) {
					score -= 10;
				}

				// Slight penalty for later matches
				// 命中位置越靠后轻微惩罚
				score += i * 0.1;

				lastMatchIndex = i;
				queryIndex++;
			}
		}

		if (queryIndex < normalizedQuery.length) {
			return { matches: false, score: 0 };
		}

		if (normalizedQuery === textLower) {
			score -= 100;
		}

		return { matches: true, score };
	};

	// 第一次尝试：原始顺序
	const primaryMatch = matchQuery(queryLower);
	if (primaryMatch.matches) {
		return primaryMatch;
	}

	// 容错重试：“字母+数字”或“数字+字母”的查询交换两段顺序再试
	const alphaNumericMatch = queryLower.match(/^(?<letters>[a-z]+)(?<digits>[0-9]+)$/);
	const numericAlphaMatch = queryLower.match(/^(?<digits>[0-9]+)(?<letters>[a-z]+)$/);
	const swappedQuery = alphaNumericMatch
		? `${alphaNumericMatch.groups?.digits ?? ""}${alphaNumericMatch.groups?.letters ?? ""}`
		: numericAlphaMatch
			? `${numericAlphaMatch.groups?.letters ?? ""}${numericAlphaMatch.groups?.digits ?? ""}`
			: "";

	if (!swappedQuery) {
		return primaryMatch;
	}

	const swappedMatch = matchQuery(swappedQuery);
	if (!swappedMatch.matches) {
		return primaryMatch;
	}

	return { matches: true, score: swappedMatch.score + 5 };
}

/**
 * Filter and sort items by fuzzy match quality (best matches first).
 * Supports whitespace- and slash-separated tokens: all tokens must match.
 */
/**
 * 按模糊匹配质量过滤并排序列表（中文说明）：查询按空白或斜杠拆成多个词元，
 * 条目必须全部词元命中才保留，按总分升序（最优在前）排列。
 * 参数 items —— 待过滤列表；query —— 查询串；getText —— 从条目提取参与匹配的文本。
 */
export function fuzzyFilter<T>(items: T[], query: string, getText: (item: T) => string): T[] {
	if (!query.trim()) {
		return items;
	}

	// 拆分非空词元
	const tokens = query
		.trim()
		.split(/[\s/]+/)
		.filter((t) => t.length > 0);

	if (tokens.length === 0) {
		return items;
	}

	const results: { item: T; totalScore: number }[] = [];

	for (const item of items) {
		const text = getText(item);
		let totalScore = 0;
		let allMatch = true;

		for (const token of tokens) {
			const match = fuzzyMatch(token, text);
			if (match.matches) {
				totalScore += match.score;
			} else {
				allMatch = false;
				break;
			}
		}

		if (allMatch) {
			results.push({ item, totalScore });
		}
	}

	results.sort((a, b) => a.totalScore - b.totalScore);
	return results.map((r) => r.item);
}
