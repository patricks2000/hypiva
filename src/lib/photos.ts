import { Directory, File, Paths } from 'expo-file-system';
import { Asset, requestPermissionsAsync } from 'expo-media-library';

/** Saves slide images to the phone's photos. Returns how many were saved. */
export async function saveToPhotos(urls: string[]): Promise<number> {
  const perm = await requestPermissionsAsync(true);
  if (!perm.granted) throw new Error('Allow Viewtra to add photos in Settings to save the slides.');
  const dir = new Directory(Paths.cache, 'slides');
  if (!dir.exists) dir.create();
  let saved = 0;
  for (const [i, url] of urls.entries()) {
    const ext = (url.split('?')[0].match(/\.(jpe?g|png|webp|heic)$/i)?.[1] ?? 'jpg').toLowerCase();
    const target = new File(dir, `slide-${Date.now()}-${i}.${ext}`);
    const file = await File.downloadFileAsync(url, target);
    await Asset.create(file.uri);
    saved++;
  }
  return saved;
}
