import { execFileSync } from 'node:child_process';
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const requiredPaths = [
  'mobile/package.json',
  'study-game/package.json',
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
  'mobile/src/services/config.ts',
  'mobile/src/services/studyWebViewService.ts',
  'mobile/src/services/votingWebViewService.ts',
  'mobile/src/services/jukeLocalWebViewService.ts',
];

const forbiddenSubsystems = [
  'backend',
  'kiosk',
  'tools/local-voting-agent',
  'wordpress',
];

const generatedPathSegments = new Set([
  'node_modules',
  'dist',
  'build',
  '.gradle',
]);

const endpointContracts = [
  {
    relativePath: 'mobile/src/services/config.ts',
    endpoint: 'https://radiotedu.com/jukebox/api/v1',
    patterns: [
      /SERVER_DOMAIN\s*=\s*['"]radiotedu\.com['"]/,
      /PROD_SERVER_ORIGIN\s*=\s*`https:\/\/\$\{SERVER_DOMAIN\}\/jukebox`/,
      /baseApi:\s*`\$\{serverOrigin\}\/api\/v1`/,
    ],
  },
  {
    relativePath: 'mobile/src/services/studyWebViewService.ts',
    endpoint: 'https://radiotedu.com/social/',
    patterns: [/['"]https:\/\/radiotedu\.com\/social\/['"]/],
  },
  {
    relativePath: 'mobile/src/services/votingWebViewService.ts',
    endpoint: 'https://radiotedu.com/vote/',
    patterns: [/['"]https:\/\/radiotedu\.com\/vote\/(?:\?[^'"]*)?['"]/],
  },
  {
    relativePath: 'mobile/src/services/jukeLocalWebViewService.ts',
    endpoint: 'https://radiotedu.com/juke-local/controller/',
    patterns: [
      /['"]https:\/\/radiotedu\.com\/juke-local\/controller\/['"]/,
    ],
  },
];

const listTrackedPaths = (root) =>
  execFileSync('git', ['-C', root, 'ls-files', '-z'], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  })
    .split('\0')
    .filter(Boolean);

const requiredIgnoreEntries = [
  'mobile/android/keystore.properties',
  '*.jks',
  '.env.*',
  'node_modules/',
];

export function verifyRepository(root) {
  const failures = [];

  for (const relativePath of requiredPaths) {
    if (!existsSync(path.join(root, relativePath))) {
      failures.push(`Missing required path: ${relativePath}`);
    }
  }

  let trackedPaths;
  try {
    trackedPaths = listTrackedPaths(root);
  } catch {
    failures.push('Unable to inspect tracked repository paths with git ls-files');
    trackedPaths = [];
  }

  for (const subsystem of forbiddenSubsystems) {
    if (
      trackedPaths.some(
        (trackedPath) =>
          trackedPath === subsystem || trackedPath.startsWith(`${subsystem}/`),
      )
    ) {
      failures.push(`Forbidden tracked subsystem: ${subsystem}`);
    }
  }

  for (const trackedPath of trackedPaths) {
    if (
      trackedPath
        .split('/')
        .some((segment) => generatedPathSegments.has(segment))
    ) {
      failures.push(`Forbidden tracked artifact: ${trackedPath}`);
    }
  }

  for (const { relativePath, endpoint, patterns } of endpointContracts) {
    const sourcePath = path.join(root, relativePath);
    if (!existsSync(sourcePath)) {
      continue;
    }

    const source = readFileSync(sourcePath, 'utf8');
    if (!patterns.every((pattern) => pattern.test(source))) {
      failures.push(
        `Missing endpoint contract for ${endpoint} in ${relativePath}`,
      );
    }
  }

  const gitignorePath = path.join(root, '.gitignore');
  if (!existsSync(gitignorePath)) {
    failures.push('Missing required path: .gitignore');
  } else {
    const ignoreEntries = new Set(
      readFileSync(gitignorePath, 'utf8')
        .split(/\r?\n/)
        .map((entry) => entry.trim())
        .filter((entry) => entry && !entry.startsWith('#')),
    );

    for (const entry of requiredIgnoreEntries) {
      if (!ignoreEntries.has(entry)) {
        failures.push(`Missing .gitignore entry: ${entry}`);
      }
    }
  }

  return failures;
}

const isCliEntrypoint =
  process.argv[1] &&
  path.resolve(process.argv[1]) === path.resolve(fileURLToPath(import.meta.url));

if (isCliEntrypoint) {
  const repositoryRoot = process.argv[2]
    ? path.resolve(process.argv[2])
    : process.cwd();
  const failures = verifyRepository(repositoryRoot);

  if (failures.length > 0) {
    for (const failure of failures) {
      console.error(failure);
    }
    process.exitCode = 1;
  } else {
    console.log('Repository contract verified.');
  }
}
