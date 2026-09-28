/**
 * Website version of "save slides".
 * On phones the share sheet is used, which has "Save image" (iPhone: straight into Photos).
 * On computers, or when sharing files is not supported, each slide is downloaded.
 */
export async function saveToPhotos(urls: string[]): Promise<number> {
  const files: File[] = [];
  for (const [i, url] of urls.entries()) {
    const blob = await (await fetch(url)).blob();
    const ext = (blob.type.split('/')[1] || 'jpg').replace('jpeg', 'jpg');
    files.push(new File([blob], `slide-${i + 1}.${ext}`, { type: blob.type || 'image/jpeg' }));
  }

  const nav = navigator as Navigator & { canShare?: (d: { files: File[] }) => boolean };
  if (nav.share && nav.canShare?.({ files })) {
    try {
      await nav.share({ files });
      return files.length;
    } catch (e) {
      if ((e as Error).name === 'AbortError') return 0; // the person closed the share sheet
    }
  }

  for (const f of files) {
    const href = URL.createObjectURL(f);
    const a = document.createElement('a');
    a.href = href;
    a.download = f.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(href), 10_000);
  }
  return files.length;
}
