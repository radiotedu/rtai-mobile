import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { fileURLToPath } from 'node:url';

import { verifyRepository } from '../scripts/verify-repository.mjs';

const repositoryRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);

const readRepositoryFile = (relativePath) =>
  readFileSync(path.join(repositoryRoot, relativePath), 'utf8');

const createGitFixture = () => {
  const root = mkdtempSync(path.join(tmpdir(), 'repository-contract-'));
  execFileSync('git', ['init', '--quiet', root]);
  return root;
};

const writeFixtureFile = (root, relativePath, content = 'fixture') => {
  const filePath = path.join(root, relativePath);
  mkdirSync(path.dirname(filePath), { recursive: true });
  writeFileSync(filePath, content);
};

test('standalone repository satisfies its public contract', () => {
  const configSource = readRepositoryFile('mobile/src/services/config.ts');
  const studyServiceSource = readRepositoryFile(
    'mobile/src/services/studyWebViewService.ts',
  );
  const votingServiceSource = readRepositoryFile(
    'mobile/src/services/votingWebViewService.ts',
  );
  const jukeLocalServiceSource = readRepositoryFile(
    'mobile/src/services/jukeLocalWebViewService.ts',
  );
  const gitignoreSource = readRepositoryFile('.gitignore');
  const androidColorsSource = readRepositoryFile(
    'mobile/android/app/src/main/res/values/colors.xml',
  );
  const androidStylesSource = readRepositoryFile(
    'mobile/android/app/src/main/res/values/styles.xml',
  );
  const iosLaunchScreenSource = readRepositoryFile(
    'mobile/ios/RadioTEDUMobile/LaunchScreen.storyboard',
  );
  const mobileReadmeSource = readRepositoryFile('mobile/README.md');

  assert.deepEqual(verifyRepository(repositoryRoot), []);
  assert.match(configSource, /SERVER_DOMAIN\s*=\s*['"]radiotedu\.com['"]/);
  assert.match(
    configSource,
    /PROD_SERVER_ORIGIN\s*=\s*`https:\/\/\$\{SERVER_DOMAIN\}\/jukebox`/,
  );
  assert.match(configSource, /baseApi:\s*`\$\{serverOrigin\}\/api\/v1`/);
  assert.match(
    studyServiceSource,
    /['"]https:\/\/radiotedu\.com\/study\/['"]/,
  );
  assert.match(
    votingServiceSource,
    /['"]https:\/\/radiotedu\.com\/vote\/(?:\?[^'"]*)?['"]/,
  );
  assert.match(
    jukeLocalServiceSource,
    /['"]https:\/\/radiotedu\.com\/juke-local\/controller\/['"]/,
  );

  const requiredPaths = [
    'mobile',
    'study-game',
    'mobile/android/app/src/main/res/xml/automotive_app_desc.xml',
    'mobile/src/assets/images/logo-radiotedu-splash.png',
    'mobile/src/assets/images/logo-rtai-splash.png',
    'mobile/logos/logo-radiotedu-splash.png',
    'mobile/logos/logo-rtai-splash.png',
    'mobile/__tests__/dualLogoSplashSource.test.ts',
    'mobile/android/app/src/main/res/values/colors.xml',
    'mobile/android/app/src/main/res/values/styles.xml',
    'mobile/ios/RadioTEDUMobile/LaunchScreen.storyboard',
    'mobile/README.md',
  ];

  for (const relativePath of requiredPaths) {
    assert.ok(
      existsSync(path.join(repositoryRoot, relativePath)),
      `Expected ${relativePath} to exist`,
    );
  }

  assert.match(mobileReadmeSource, /^## Startup branding$/m);
  assert.match(
    androidStylesSource,
    /<item name="android:windowDisablePreview">true<\/item>/,
  );
  assert.match(
    androidStylesSource,
    /<item name="android:windowBackground">@color\/startup_background<\/item>/,
  );
  assert.match(
    androidColorsSource,
    /<color name="startup_background">#070707<\/color>/,
  );
  assert.match(
    iosLaunchScreenSource,
    /<color key="backgroundColor" red="0\.027450980392156862" green="0\.027450980392156862" blue="0\.027450980392156862" alpha="1" colorSpace="custom" customColorSpace="sRGB"\/>/,
  );
  assert.doesNotMatch(iosLaunchScreenSource, /<label\b/);
  assert.doesNotMatch(iosLaunchScreenSource, /systemBackgroundColor/);

  for (const ignoredPath of [
    'mobile/android/keystore.properties',
    '*.jks',
    '.env.*',
    'node_modules/',
  ]) {
    assert.ok(
      gitignoreSource.split(/\r?\n/).includes(ignoredPath),
      `Expected .gitignore to contain ${ignoredPath}`,
    );
  }
});

test('rejects extra paths after owned service endpoint literals', () => {
  const fixtureRoot = createGitFixture();

  try {
    writeFixtureFile(
      fixtureRoot,
      'mobile/src/services/studyWebViewService.ts',
      "export const STUDY_REMOTE_ROOT = 'https://radiotedu.com/study/wrong';\n",
    );
    writeFixtureFile(
      fixtureRoot,
      'mobile/src/services/votingWebViewService.ts',
      "export const VOTING_WEBVIEW_URL = 'https://radiotedu.com/vote/wrong';\n",
    );
    writeFixtureFile(
      fixtureRoot,
      'mobile/src/services/jukeLocalWebViewService.ts',
      "export const JUKE_LOCAL_WEBVIEW_URL = 'https://radiotedu.com/juke-local/controller/wrong';\n",
    );

    const failures = verifyRepository(fixtureRoot);

    for (const [endpoint, relativePath] of [
      [
        'https://radiotedu.com/study/',
        'mobile/src/services/studyWebViewService.ts',
      ],
      [
        'https://radiotedu.com/vote/',
        'mobile/src/services/votingWebViewService.ts',
      ],
      [
        'https://radiotedu.com/juke-local/controller/',
        'mobile/src/services/jukeLocalWebViewService.ts',
      ],
    ]) {
      assert.ok(
        failures.includes(
          `Missing endpoint contract for ${endpoint} in ${relativePath}`,
        ),
        `Expected an extra path after ${endpoint} to fail`,
      );
    }
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('rejects tracked subsystems and generated artifacts', () => {
  const fixtureRoot = createGitFixture();
  const trackedSubsystems = [
    'backend/index.js',
    'kiosk/index.js',
    'tools/local-voting-agent/index.js',
    'wordpress/index.php',
  ];
  const trackedArtifacts = [
    'node_modules/root.js',
    'dist/root.js',
    'build/root.js',
    '.gradle/root.bin',
    'mobile/node_modules/pkg/index.js',
    'mobile/dist/app.js',
    'mobile/build/app.js',
    'mobile/android/.gradle/cache.bin',
    'mobile/android/build/output.bin',
    'mobile/android/app/build/app.apk',
    'study-game/node_modules/pkg/index.js',
    'study-game/dist/app.js',
    'study-game/build/app.js',
  ];

  try {
    for (const relativePath of [...trackedSubsystems, ...trackedArtifacts]) {
      writeFixtureFile(fixtureRoot, relativePath);
    }
    execFileSync(
      'git',
      ['-C', fixtureRoot, 'add', '--force', '--', ...trackedSubsystems, ...trackedArtifacts],
      { stdio: 'ignore' },
    );

    const failures = verifyRepository(fixtureRoot);

    for (const relativePath of trackedSubsystems) {
      const subsystem = relativePath.split('/')[0] === 'tools'
        ? 'tools/local-voting-agent'
        : relativePath.split('/')[0];
      assert.ok(
        failures.includes(`Forbidden tracked subsystem: ${subsystem}`),
        `Expected tracked subsystem ${subsystem} to fail`,
      );
    }

    for (const relativePath of trackedArtifacts) {
      assert.ok(
        failures.includes(`Forbidden tracked artifact: ${relativePath}`),
        `Expected tracked artifact ${relativePath} to fail`,
      );
    }
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});

test('allows untracked subsystems and generated output', () => {
  const fixtureRoot = createGitFixture();

  try {
    for (const relativePath of [
      'backend/notes.txt',
      'mobile/node_modules/pkg/index.js',
      'mobile/android/app/build/app.apk',
      'study-game/dist/app.js',
      'study-game/build/app.js',
    ]) {
      writeFixtureFile(fixtureRoot, relativePath);
    }

    assert.doesNotMatch(
      verifyRepository(fixtureRoot).join('\n'),
      /Forbidden/,
    );
  } finally {
    rmSync(fixtureRoot, { recursive: true, force: true });
  }
});
