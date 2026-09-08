import assert from 'node:assert/strict';
import test from 'node:test';

import {
  normalizeAssetBasePath,
  normalizeRouterBasename,
} from './deployPaths.ts';

test('keeps asset base path with a trailing slash', () => {
  assert.equal(normalizeAssetBasePath('/techfenixscoutapp'), '/techfenixscoutapp/');
});

test('keeps router basename without a trailing slash', () => {
  assert.equal(normalizeRouterBasename('/techfenixscoutapp/'), '/techfenixscoutapp');
});

test('keeps root deploy path as slash for assets and router', () => {
  assert.equal(normalizeAssetBasePath('/'), '/');
  assert.equal(normalizeRouterBasename('/'), '/');
});
