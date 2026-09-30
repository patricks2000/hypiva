// After "expo export": the app moves to app.html and the homepage (public/home.html) becomes index.html,
// so hypiva.com shows the homepage and every app route (/sign-in, /home, ...) is served by app.html.
import { renameSync, copyFileSync, rmSync, existsSync } from 'node:fs';

const dist = new URL('../dist/', import.meta.url);
if (!existsSync(new URL('home.html', dist))) throw new Error('dist/home.html missing: is public/home.html there?');
renameSync(new URL('index.html', dist), new URL('app.html', dist));
copyFileSync(new URL('home.html', dist), new URL('index.html', dist));
rmSync(new URL('home.html', dist));
console.log('Homepage at /, app at /app.html');
