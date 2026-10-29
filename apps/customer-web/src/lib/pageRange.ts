export interface PageRangeValidation {
  valid: boolean;
  count: number;
  message?: string;
}

export function validatePageRange(value: string, totalPages: number): PageRangeValidation {
  const input = value.trim().toUpperCase();
  if (!input || input === 'ALL') return { valid: true, count: totalPages };

  const pages = new Set<number>();
  for (const rawPart of input.split(',')) {
    const part = rawPart.trim();
    if (!/^\d+(?:-\d+)?$/.test(part)) {
      return { valid: false, count: 0, message: 'Use page numbers and ranges, such as 1-5, 8.' };
    }

    const [startText, endText] = part.split('-');
    const start = Number(startText);
    const end = endText ? Number(endText) : start;
    if (start < 1 || end < start || end > totalPages) {
      return { valid: false, count: 0, message: `Choose pages from 1 to ${totalPages}.` };
    }
    for (let page = start; page <= end; page++) pages.add(page);
  }

  if (!pages.size) return { valid: false, count: 0, message: 'Choose at least one page.' };
  return { valid: true, count: pages.size };
}
