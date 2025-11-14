import { test, expect } from '@playwright/test';

/**
 * Test resume playback functionality after pause
 * This test verifies that videos correctly resume from the paused position
 * instead of restarting from the beginning
 */

async function testResumePlayback(
  page: any,
  testName: string,
  url: string,
  playDuration: number,
  pauseDuration: number = 1000
) {
    // Navigate to the test page
    await page.goto(url);

    // Wait for page to load
    await page.waitForLoadState('networkidle');
    await page.waitForTimeout(1000);

    // Get the play/pause button
    const playButton = page.locator('#play-pause-btn');
    await expect(playButton).toBeVisible();

    // Start playback
    console.log(`[${testName}] Starting playback...`);
    await playButton.click();
    await page.waitForTimeout(500);

    // Verify playback started
    let buttonText = await playButton.textContent();
    expect(buttonText).toContain('Pause');

    // Play for specified duration
    console.log(`[${testName}] Playing for ${playDuration}ms...`);
    await page.waitForTimeout(playDuration);

    // Get video elements and their current time before pause
    const videoTimeBeforePause = await page.evaluate(() => {
      const topVideo = document.querySelector('#top-video-player') as HTMLVideoElement;
      const bottomVideo = document.querySelector('#bottom-video-player') as HTMLVideoElement;
      return {
        top: topVideo?.currentTime || 0,
        bottom: bottomVideo?.currentTime || 0,
      };
    });

    console.log(`[${testName}] Video times before pause:`, videoTimeBeforePause);
    expect(videoTimeBeforePause.top).toBeGreaterThan(1.5); // Should have played at least 1.5 seconds

    // Pause playback
    console.log(`[${testName}] Pausing playback...`);
    await playButton.click();
    await page.waitForTimeout(pauseDuration);

    // Verify paused
    buttonText = await playButton.textContent();
    expect(buttonText).toContain('Play');

    // Get video times after pause (should be similar to before pause)
    const videoTimeAfterPause = await page.evaluate(() => {
      const topVideo = document.querySelector('#top-video-player') as HTMLVideoElement;
      const bottomVideo = document.querySelector('#bottom-video-player') as HTMLVideoElement;
      return {
        top: topVideo?.currentTime || 0,
        bottom: bottomVideo?.currentTime || 0,
      };
    });

    console.log(`[${testName}] Video times after pause:`, videoTimeAfterPause);

    // Resume playback
    console.log(`[${testName}] Resuming playback...`);
    await playButton.click();

    // Wait for videos to start playing and buffering to stabilize
    await page.waitForTimeout(2000);

    // Get video times after resume
    const videoTimeAfterResume = await page.evaluate(() => {
      const topVideo = document.querySelector('#top-video-player') as HTMLVideoElement;
      const bottomVideo = document.querySelector('#bottom-video-player') as HTMLVideoElement;
      return {
        top: topVideo?.currentTime || 0,
        bottom: bottomVideo?.currentTime || 0,
        topPaused: topVideo?.paused || true,
        bottomPaused: bottomVideo?.paused || true,
      };
    });

    console.log(`[${testName}] Video times after resume:`, videoTimeAfterResume);

    // Verify videos are playing (not paused)
    expect(videoTimeAfterResume.topPaused).toBe(false);
    expect(videoTimeAfterResume.bottomPaused).toBe(false);

    // CRITICAL CHECK: Videos should be near the paused position, NOT near 0
    // Allow tolerance of 3 seconds (for buffering delays)
    const topTimeDiff = Math.abs(videoTimeAfterResume.top - videoTimeAfterPause.top);
    const bottomTimeDiff = Math.abs(videoTimeAfterResume.bottom - videoTimeAfterPause.bottom);

    console.log(`[${testName}] Top video time difference: ${topTimeDiff.toFixed(2)}s`);
    console.log(`[${testName}] Bottom video time difference: ${bottomTimeDiff.toFixed(2)}s`);

    // Check that videos did NOT restart from beginning
    expect(videoTimeAfterResume.top).toBeGreaterThan(1.0);
    expect(videoTimeAfterResume.bottom).toBeGreaterThan(1.0);

    // Check that videos are near the paused position (within 3 seconds)
    expect(topTimeDiff).toBeLessThan(3.0);
    expect(bottomTimeDiff).toBeLessThan(3.0);

    // Cleanup: pause playback
    await playButton.click();
    await page.waitForTimeout(500);

    console.log(`[${testName}] ✓ Test passed: Videos correctly resumed from paused position`);
}

test.describe('Resume Playback Tests', () => {
  test.beforeEach(async ({ page }) => {
    // Set console logging
    page.on('console', (msg) => {
      if (msg.type() === 'log' && msg.text().includes('[NativeVideo]')) {
        console.log('Browser:', msg.text());
      }
    });
  });

  // Test 1: sync-test (short video, should work)
  test('sync-test: should resume playback from paused position', async ({ page }) => {
    const testName = 'sync-test';
    const url = '/?piece=test&tab=sync-test';
    const playDuration = 3000;
    const pauseDuration = 1000;

    await testResumePlayback(page, testName, url, playDuration, pauseDuration);
  });

  // Test 2: Liszt home tab (long video, the problematic case)
  test('Liszt home: should resume playback from paused position', async ({ page }) => {
    const testName = 'Liszt-home';
    const url = '/?piece=Liszt-Liebesträume-No.3&tab=home';
    const playDuration = 3000;
    const pauseDuration = 1000;

    await testResumePlayback(page, testName, url, playDuration, pauseDuration);
  });
});
