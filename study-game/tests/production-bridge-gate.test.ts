import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {describe, expect, it} from 'vitest';

const dirname = path.dirname(fileURLToPath(import.meta.url));

describe('production Study access gate', () => {
  it('accepts only an injected app bridge or a verified same-origin web session', () => {
    const source = fs.readFileSync(path.join(dirname, '../src/main.ts'), 'utf8');

    expect(source).toContain(
      "const isHostedProduction = import.meta.env.PROD && window.location.protocol !== 'file:'",
    );
    expect(source).toContain('if (isHostedProduction && !secureBridge)');
    expect(source.indexOf('if (isHostedProduction && !secureBridge)')).toBeLessThan(
      source.indexOf("mode === 'engine-proof'"),
    );
    expect(source).toContain('bootStudyFromWebSession(entry)')
    expect(source).toContain('verifyStudyAccountSession()')
    expect(source).toContain('createStudyWebBridge(session, window.location)')
    expect(source).not.toContain(
      "import.meta.env.PROD && parameters.get('embedded') === 'mobile' && !secureBridge",
    );
    expect(source).toContain('Server-protected sign in')
    expect(source).toContain('data-study-auth-form')
    expect(source).toContain('loginStudyAccount')
    expect(source).toContain('registerStudyAccount')
    expect(source).toContain("new URL('/study/auth-callback.html', location.origin)")
    expect(source).not.toContain('location.assign(entryConfig.loginUrl)')
    expect(source).not.toContain('localStorage.setItem')
  });
});
