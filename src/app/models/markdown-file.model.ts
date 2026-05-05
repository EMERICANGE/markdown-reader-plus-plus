export interface MarkdownFile {
  name: string;
  path: string;
  content: string;
}

export interface TocHeading {
  level: number;
  text: string;
  id: string;
}
