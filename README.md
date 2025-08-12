# fb2k-ESLyric-LyricGeminiStrip

Enhanced lyric retrieval plugins for ESLyric with Gemini AI-powered title normalization for more accurate lyric fetching.

## Overview

This project includes lyric retrieval plugins for the following music services:

- **kugou.js** - KuGou Music
- **musixmatch.js** - Musixmatch
- **netease.js** - NetEase Cloud Music
- **qqmusic.js** - QQ Music

## Features

- 🎵 Fetch lyrics from multiple music services
- 🧠 Gemini AI-powered song title normalization
- 🔍 Automatic removal of cover versions, remixes, and annotations
- 📝 Synchronized lyrics support (LRC, QRC)
- ⚙️ Configurable API keys and options

## Setup

### 1. ESLyric Configuration

To use these plugins with ESLyric:

1. Copy the `.js` files to your ESLyric plugins directory
2. Enable the plugins in ESLyric

### 2. Gemini AI Configuration (Optional)

For enhanced lyric search accuracy, configure Gemini AI:

1. Get an API key from [Google AI Studio](https://aistudio.google.com/app/apikey)
2. Configure in ESLyric:
   - `gemini_enabled` = "1"
   - `gemini_api_key` = "YOUR_API_KEY_HERE"

### 3. Manual Configuration (For Developers)

You can also edit the default values directly in each file:

```javascript
const DEFAULT_GEMINI_ENABLED = true; // true/false
const DEFAULT_GEMINI_API_KEY = "YOUR_API_KEY_HERE";
```

## Usage

1. Play a song in ESLyric
2. Trigger lyric retrieval
3. The plugins will automatically:
   - Normalize the song title
   - Search multiple services for lyrics
   - Return the best matching lyrics

## Gemini AI Normalization

### Processing Examples

- `少女レイ / みきとP cover 9Lana` → `少女レイ`
- `のだ covered by Mirea Sheltzs ・陽月るるふ・よしか⁂【歌ってみた】` → `のだ`
- `KING feat. Kanaria (Official MV)` → `KING`

### Removed Elements

- Artist names, composers, arrangers, producers
- feat./ft./featuring
- ver./version/MV/PV/live/remix/short/full
- Cover versions, covered by, 歌ってみた, 翻唱
- Hashtags, emojis, annotations 【】()[]
- Information after delimiters (/, ／, |, ｜, -, ・, ·, ~, 〜)

## Technical Specifications

### Supported Formats

- **LRC** - Standard lyric format
- **QRC** - QQ Music extended format
- **KRC** - KuGou Music proprietary format

### API Endpoints

- Gemini AI: `generativelanguage.googleapis.com`
- KuGou Music: `lyrics.kugou.com`
- Musixmatch: `apic-desktop.musixmatch.com`
- NetEase Cloud Music: `music.163.com`
- QQ Music: `c.y.qq.com`, `u.y.qq.com`

## Troubleshooting

### Common Issues

1. **No lyrics found**

   - The song title may contain extra information
   - Try enabling Gemini AI functionality

2. **Gemini AI not working**

   - Verify API key is correctly configured
   - Check if API quota is available

3. **Error messages**
   - Check ESLyric logs
   - Verify network connectivity

## License

This project is open source. Please use in accordance with each music service's terms of service.

## Credits

- NetEase Cloud Music API: [NeteaseCloudMusicApi](https://github.com/Binaryify/NeteaseCloudMusicApi)
- QQ Music API: [QQMusicApi](https://github.com/jsososo/QQMusicApi), [QRCD](https://github.com/xmcp/QRCD)
- Encryption: [crypto-es](https://github.com/entronad/crypto-es)

## Contributing

Pull requests and issue reports are welcome.
