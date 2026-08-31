import {describe, expect, it} from '@jest/globals';
import {getHeaderAccountLabel} from '../src/components/headerAccountLabel';

describe('shared header account label', () => {
  it('shows the authenticated account display name', () => {
    expect(
      getHeaderAccountLabel({
        display_name: 'Tuna Özsarı',
        email: 'tuna.ozsari@tedu.edu.tr',
      }),
    ).toBe('Tuna Özsarı');
  });

  it('falls back to the email local part for older account payloads', () => {
    expect(
      getHeaderAccountLabel({
        display_name: '  ',
        email: 'tuna.ozsari@tedu.edu.tr',
      }),
    ).toBe('tuna.ozsari');
  });

  it('does not render an account label before login', () => {
    expect(getHeaderAccountLabel(null)).toBeNull();
  });
});
