import type { EntryGenerator } from './$types';

/** Halaman statis: pre-render ID + EN agar TTFB cepat dan ramah crawler. */
export const prerender = true;

export const entries: EntryGenerator = () => [{ lang: 'id' }, { lang: 'en' }];
