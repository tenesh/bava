import { describe, expect, it } from 'vitest';
import { onlineVideo, playsInPage, thumbnail } from './online-video';

describe('an online video, by its address', () => {
  it('is a YouTube video in each of its address forms, played without cookies', () => {
    for (const address of [
      'https://www.youtube.com/watch?v=abc123',
      'https://youtube.com/watch?feature=share&v=abc123',
      'http://m.youtube.com/watch?v=abc123',
      'https://youtu.be/abc123?si=x',
      'https://www.youtube.com/shorts/abc123',
    ]) {
      expect(onlineVideo(address), address).toEqual({ provider: 'YouTube', id: 'abc123', player: 'https://www.youtube-nocookie.com/embed/abc123?autoplay=1' });
    }
  });

  it('is a Vimeo or a Loom video', () => {
    expect(onlineVideo('https://vimeo.com/76979871')).toEqual({ provider: 'Vimeo', id: '76979871', player: 'https://player.vimeo.com/video/76979871?autoplay=1&dnt=1' });
    expect(onlineVideo('https://www.loom.com/share/0281766fa2d04bb788eaf19e65135184')).toEqual({
      provider: 'Loom',
      id: '0281766fa2d04bb788eaf19e65135184',
      player: 'https://www.loom.com/embed/0281766fa2d04bb788eaf19e65135184?autoplay=1',
    });
  });

  it('is nothing for any other address, or an id that could carry more than an id', () => {
    for (const address of [
      'https://example.com/watch?v=abc123',
      'https://www.youtube.com/channel/abc',
      'https://youtube.com.evil.test/watch?v=abc',
      'https://vimeo.com/about',
      'https://www.youtube.com/watch?v=a"b',
      'https://youtu.be/a%2Fb',
      'clip.mp4',
      'javascript:alert(1)',
    ]) {
      expect(onlineVideo(address), address).toBeNull();
    }
  });
});

describe('where an online video plays', () => {
  it("is in the page, unless it is YouTube and the page's address is not a web one", () => {
    expect(playsInPage('YouTube', 'https:')).toBe(true);
    expect(playsInPage('YouTube', 'http:')).toBe(true);
    // Bava's window on macOS: YouTube refuses to play there, so the browser does.
    expect(playsInPage('YouTube', 'wails:')).toBe(false);
    expect(playsInPage('Vimeo', 'wails:')).toBe(true);
  });
});

describe("an online video's picture", () => {
  it("is YouTube's own thumbnail, by the video's id", () => {
    expect(thumbnail(onlineVideo('https://youtu.be/abc123')!)).toBe('https://i.ytimg.com/vi/abc123/hqdefault.jpg');
  });

  it('is none for a site that publishes no address for one', () => {
    expect(thumbnail(onlineVideo('https://vimeo.com/76979871')!)).toBeNull();
    expect(thumbnail(onlineVideo('https://www.loom.com/share/0281766fa2d04bb788eaf19e65135184')!)).toBeNull();
  });
});
