#!/usr/bin/env node
/**
 * Version management script for Expo/EAS projects.
 * Updates version in app.json and optionally creates a git tag.
 *
 * Usage:
 *   node scripts/version.js patch    # 1.0.0 -> 1.0.1
 *   node scripts/version.js minor    # 1.0.0 -> 1.1.0
 *   node scripts/version.js major    # 1.0.0 -> 2.0.0
 *   node scripts/version.js 1.2.3    # Set specific version
 */

const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const APP_JSON_PATH = path.join(__dirname, '..', 'app.json');

function readAppJson() {
  const content = fs.readFileSync(APP_JSON_PATH, 'utf-8');
  return JSON.parse(content);
}

function writeAppJson(data) {
  const content = JSON.stringify(data, null, 2) + '\n';
  fs.writeFileSync(APP_JSON_PATH, content);
}

function parseVersion(version) {
  const parts = version.split('.').map(Number);
  if (parts.length !== 3 || parts.some(isNaN)) {
    throw new Error(`Invalid version format: ${version}`);
  }
  return { major: parts[0], minor: parts[1], patch: parts[2] };
}

function formatVersion({ major, minor, patch }) {
  return `${major}.${minor}.${patch}`;
}

function bumpVersion(current, type) {
  const v = parseVersion(current);
  switch (type) {
    case 'major':
      v.major++;
      v.minor = 0;
      v.patch = 0;
      break;
    case 'minor':
      v.minor++;
      v.patch = 0;
      break;
    case 'patch':
      v.patch++;
      break;
    default:
      // Assume it's a specific version
      return type;
  }
  return formatVersion(v);
}

function main() {
  const args = process.argv.slice(2);
  if (args.length === 0) {
    console.error('Usage: node scripts/version.js <patch|minor|major|version>');
    console.error('Example: node scripts/version.js patch');
    console.error('Example: node scripts/version.js 1.2.3');
    process.exit(1);
  }

  const type = args[0];
  const appJson = readAppJson();
  const currentVersion = appJson.expo.version;
  const newVersion = bumpVersion(currentVersion, type);

  console.log(`Current version: ${currentVersion}`);
  console.log(`New version: ${newVersion}`);

  // Update app.json
  appJson.expo.version = newVersion;
  writeAppJson(appJson);
  console.log('Updated app.json');

  // Update android versionCode if needed (for production builds)
  if (type !== 'patch' || args.includes('--increment-code')) {
    // versionCode = major * 10000 + minor * 100 + patch
    const v = parseVersion(newVersion);
    const versionCode = v.major * 10000 + v.minor * 100 + v.patch;
    if (!appJson.expo.android) appJson.expo.android = {};
    appJson.expo.android.versionCode = versionCode;
    writeAppJson(appJson);
    console.log(`Updated android.versionCode: ${versionCode}`);
  }

  // Update iOS buildNumber if needed
  if (type !== 'patch' || args.includes('--increment-code')) {
    const v = parseVersion(newVersion);
    const buildNumber = v.major * 10000 + v.minor * 100 + v.patch;
    if (!appJson.expo.ios) appJson.expo.ios = {};
    appJson.expo.ios.buildNumber = buildNumber.toString();
    writeAppJson(appJson);
    console.log(`Updated ios.buildNumber: ${buildNumber}`);
  }

  // Optionally create git tag
  if (args.includes('--tag')) {
    try {
      execSync(`git add ${APP_JSON_PATH}`, { stdio: 'inherit' });
      execSync(`git commit -m "chore: bump version to ${newVersion}"`, { stdio: 'inherit' });
      execSync(`git tag -a v${newVersion} -m "Release v${newVersion}"`, { stdio: 'inherit' });
      console.log(`Created git tag v${newVersion}`);
      console.log('Run "git push --follow-tags" to push changes and tags');
    } catch (e) {
      console.error('Failed to create git tag:', e.message);
    }
  }

  console.log('\nNext steps:');
  console.log('  1. Run "eas build" to build with the new version');
  console.log('  2. Run "eas submit" to submit to app stores');
}

main();