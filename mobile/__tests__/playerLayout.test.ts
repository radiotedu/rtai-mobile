import {playerBottomOffset} from '../src/navigation/playerLayout';

test('waits for measured tab bar and keeps player above it', () => {
  expect(playerBottomOffset(true, 0, 34)).toBeNull();
  expect(playerBottomOffset(true, 96, 34)).toBe(104);
  expect(playerBottomOffset(true, 72, 0)).toBe(80);
  expect(playerBottomOffset(false, 96, 34)).toBe(42);
});
