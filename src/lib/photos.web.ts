import { Linking } from 'react-native';

/** Browsers cannot write to the photo library; open each image so it can be saved from there. */
export async function saveToPhotos(urls: string[]): Promise<number> {
  for (const u of urls) await Linking.openURL(u);
  return urls.length;
}
