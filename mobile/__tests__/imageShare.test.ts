import {NativeModules, findNodeHandle} from 'react-native';
import {shareCardImage} from '../src/components/ImageShareSheet';

jest.mock('react-native', () => {
  const actual = jest.requireActual('react-native');
  Object.defineProperty(actual, 'findNodeHandle', {configurable: true, value: jest.fn(() => 123)});
  actual.NativeModules.RadioTeduImageShare = {share: jest.fn(async () => 'content://cards/test.png')};
  return actual;
});
test('passes the rendered card to native PNG sharing', async () => {
  await shareCardImage({} as any, 'RadioTEDU');
  expect(NativeModules.RadioTeduImageShare.share).toHaveBeenCalledWith(123, 'RadioTEDU', false);
  await shareCardImage({} as any, 'RadioTEDU', true);
  expect(NativeModules.RadioTeduImageShare.share).toHaveBeenCalledWith(123, 'RadioTEDU', true);
});
test('rejects missing layout and propagates export errors', async () => {
  await expect(shareCardImage(null, 'RadioTEDU')).rejects.toThrow();
  (findNodeHandle as jest.Mock).mockReturnValueOnce(null);
  await expect(shareCardImage({} as any, 'RadioTEDU')).rejects.toThrow();
  NativeModules.RadioTeduImageShare.share.mockRejectedValueOnce(new Error('disk full'));
  await expect(shareCardImage({} as any, 'RadioTEDU')).rejects.toThrow('disk full');
});
