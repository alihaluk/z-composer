import { saveAs } from 'file-saver';

/** Saves JSON with the File System Access API where available, else as a download. */
export async function saveJson(data: unknown, fileName: string, description: string): Promise<void> {
  const json = JSON.stringify(data, null, 2);
  const picker = window as Window & { showSaveFilePicker?: (options: object) => Promise<FileSystemFileHandle> };
  if (picker.showSaveFilePicker) {
    try {
      const handle = await picker.showSaveFilePicker({ suggestedName: fileName, types: [{ description, accept: { 'application/json': ['.json'] } }] });
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
      return;
    } catch (err) {
      if (err instanceof Error && err.name === 'AbortError') return;
    }
  }
  saveAs(new Blob([json], { type: 'application/json;charset=utf-8' }), fileName);
}

/** Well above a template with images; a larger file would only freeze the page while it is read. */
const MAX_JSON_BYTES = 50 * 1024 * 1024;

export const readJsonFile = async (file: File): Promise<unknown> => {
  if (file.size > MAX_JSON_BYTES) throw new Error(`The file is too large (limit ${MAX_JSON_BYTES / 1024 / 1024} MB)`);
  return JSON.parse(await file.text());
};
