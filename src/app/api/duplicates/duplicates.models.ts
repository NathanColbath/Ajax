export interface DuplicateFile {
  id: string;
  name: string;
  path: string;
  sizeLabel: string;
  system: string;
}

export interface DuplicateGroup {
  id: string;
  hash: string;
  files: DuplicateFile[];
}
