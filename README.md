# Chazzy Extension

A Chrome browser extension built with TypeScript and React.

## Features

- Chrome extension with popup UI built in React
- TypeScript for type safety
- Background script for handling web requests
- Content script for interacting with web pages
- API utilities for making HTTP requests

## Development

### Prerequisites

- Node.js (v14.0.0 or higher)
- npm (v6.0.0 or higher)

### Installation

1. Clone this repository
2. Install dependencies:

```bash
npm install
```

### Development Build

To build the extension in development mode with watch mode:

```bash
npm start
```

This will create a `dist` folder with the extension files.

### Production Build

To build the extension for production:

```bash
npm run build
```

### Loading the extension in Chrome

1. Open Chrome and navigate to `chrome://extensions`
2. Enable "Developer mode" by toggling the switch in the top right corner
3. Click "Load unpacked" and select the `dist` directory from this project
4. The extension should now be loaded and ready to use

## Project Structure

- `src/popup`: React components for the popup UI
- `src/background`: Background script
- `src/contentScript`: Content script that runs on web pages
- `src/api`: API utilities for making web requests
- `src/static`: Static assets like icons and manifest.json

## Making Web Requests

This extension is set up to make web requests from both the background script and React components.

- For background requests, use the messaging system as shown in the content script example
- For direct requests from React components, use the API utilities in `src/api/api.ts`

## License

MIT 