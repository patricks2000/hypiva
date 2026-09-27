import * as Clipboard from 'expo-clipboard';
import * as ImagePicker from 'expo-image-picker';
import { supabase } from './supabase';

export { saveToPhotos } from './photos';

export const copy = (text: string) => Clipboard.setStringAsync(text);

/** Lets an admin or brand pick images and uploads them to the "content" bucket. Returns public URLs. */
export async function pickAndUploadImages(campaignId: string): Promise<string[]> {
  const res = await ImagePicker.launchImageLibraryAsync({ mediaTypes: ['images'], allowsMultipleSelection: true, quality: 0.9, orderedSelection: true });
  if (res.canceled) return [];
  const urls: string[] = [];
  for (const [i, a] of res.assets.entries()) {
    const body = await (await fetch(a.uri)).arrayBuffer();
    const ext = (a.fileName?.split('.').pop() ?? a.mimeType?.split('/')[1] ?? 'jpg').toLowerCase();
    const path = `${campaignId}/${Date.now()}-${i}.${ext}`;
    const { error } = await supabase.storage.from('content').upload(path, body, { contentType: a.mimeType ?? 'image/jpeg' });
    if (error) throw error;
    urls.push(supabase.storage.from('content').getPublicUrl(path).data.publicUrl);
  }
  return urls;
}
