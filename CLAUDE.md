# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Simple Gmail Notes is a Chrome extension and Firefox addon that adds note-taking functionality to Gmail conversations. Each conversation can have one note stored in the user's Google Drive account.

## Architecture

### Core Components

- **manifest.json**: Extension configuration using Manifest V2
- **background.js**: Background service worker handling authentication and API calls
- **content.js**: Content script injected into Gmail pages for DOM manipulation
- **page.js**: Page script for direct Gmail DOM access
- **popup.js/popup.html**: Extension popup interface
- **options.js/options.html**: Settings/preferences page

### Key Modules

- **common/shared-common.js**: Core utilities and SimpleGmailNotes namespace
- **common/gmail-sgn-dom.js**: Gmail DOM manipulation utilities
- **common/gmail-sgn-page.js**: Page-level Gmail integration
- **background-event.js**: Background event handlers

### External Dependencies

All dependencies are bundled in the `lib/` directory:
- jQuery 3.1.0 for DOM manipulation
- TinyMCE for rich text editing
- Featherlight for modal dialogs
- Bulma CSS for styling
- Moment.js for date handling
- js-lru for caching

## Development Commands

### Linting
- **JSHint**: `jshint <file>` (config in `.jshintrc`)
- **CSS Lint**: `csslint <file>` (config in `.csslintrc`)

### Testing
No automated test framework is configured. Testing is done manually by:
1. Loading the extension in Chrome/Firefox developer mode
2. Testing on Gmail pages at https://mail.google.com/*

## Code Style Guidelines

- Uses JSHint configuration allowing browser globals and jQuery ($)
- CSS follows Bulma framework conventions
- JavaScript uses ES5 syntax for compatibility
- Strong naming conventions with SimpleGmailNotes namespace

## Extension Loading

For development testing:
1. Chrome: Load unpacked extension from project root
2. Firefox: Load temporary addon using manifest.json

## Google Drive Integration

- Uses Google Drive API for note storage
- OAuth 2.0 authentication with offline tokens
- Client ID configured in `common/shared-common.js`
- Notes stored as files created by the extension only

## Internationalization

Supports 48+ languages via `_locales/` directory with `messages.json` files for each locale.