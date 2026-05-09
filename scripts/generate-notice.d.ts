export type ParsedAttributionEntry = {
  name: string;
  url: string;
  author: string;
  license: string;
  sectionTitle: string;
};

export function parseAttributionsMarkdown(markdown: string): ParsedAttributionEntry[];

export function buildNoticeMarkdown(options?: {
  workspaceRoot?: string;
  attributionsMarkdown?: string;
}): string;

export function generateNoticeFile(options?: {
  workspaceRoot?: string;
}): string;