import test from 'node:test';
import assert from 'node:assert/strict';
import { getDemoVideoEmbedUrl } from '../src/lib/demo-video-url.mjs';

test('demo video preview converts youtu.be links with tracking parameters to safe embeds', () => {
  assert.equal(
    getDemoVideoEmbedUrl('https://youtu.be/RktJ5-y1A1w?si=some-tracking-value'),
    'https://www.youtube-nocookie.com/embed/RktJ5-y1A1w',
  );
});

test('demo video preview converts YouTube watch and shorts URLs to embeds', () => {
  assert.equal(getDemoVideoEmbedUrl('https://www.youtube.com/watch?v=AbCd_123-xy'), 'https://www.youtube-nocookie.com/embed/AbCd_123-xy');
  assert.equal(getDemoVideoEmbedUrl('https://www.youtube.com/shorts/AbCd_123-xy'), 'https://www.youtube-nocookie.com/embed/AbCd_123-xy');
});

test('demo video preview rejects insecure and unsupported URLs', () => {
  assert.equal(getDemoVideoEmbedUrl('http://youtu.be/RktJ5-y1A1w'), null);
  assert.equal(getDemoVideoEmbedUrl('https://example.com/video'), null);
  assert.equal(getDemoVideoEmbedUrl('not a URL'), null);
});
