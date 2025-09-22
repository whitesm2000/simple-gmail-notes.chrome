// Simple Gmail Notes MV3 service worker.
// Emulates the legacy MV2 background page by polyfilling the tiny jQuery surface
// the background scripts rely on and wiring chrome.storage to localStorage.

const localStorageCache = {};

// Provide a minimal browser-like global so legacy scripts can run.
if (typeof self.window === 'undefined') {
  self.window = self;
}

if (typeof window === 'undefined') {
  // eslint-disable-next-line no-var
  var window = self;
}

if (typeof self.document === 'undefined') {
  self.document = {
    createElement: function(tag) {
      return {
        tagName: (tag || '').toUpperCase(),
        style: {},
        setAttribute: function() {},
        getAttribute: function() { return null; },
        appendChild: function() { return this; },
        removeChild: function() { return this; },
        innerHTML: '',
        textContent: ''
      };
    },
    body: {
      appendChild: function() {},
      removeChild: function() {}
    },
    getElementById: function() { return null; },
    querySelector: function() { return null; },
    querySelectorAll: function() { return []; },
    addEventListener: function() {},
    removeEventListener: function() {}
  };
}

if (typeof document === 'undefined') {
  // eslint-disable-next-line no-var
  var document = self.document;
}

if (typeof window.location === 'undefined') {
  window.location = self.location || { href: '' };
}

if (typeof window.navigator === 'undefined' && typeof self.navigator !== 'undefined') {
  window.navigator = self.navigator;
}

if (typeof window.top === 'undefined') {
  window.top = window;
}

if (typeof top === 'undefined') {
  // eslint-disable-next-line no-var
  var top = window.top;
}

if (typeof window.chrome === 'undefined' && typeof chrome !== 'undefined') {
  window.chrome = chrome;
}

if (typeof window.document === 'undefined') {
  window.document = document;
}

if (typeof window.addEventListener === 'undefined' && typeof self.addEventListener === 'function') {
  window.addEventListener = function(type, listener, options) {
    return self.addEventListener(type, listener, options);
  };
}

if (typeof window.removeEventListener === 'undefined' && typeof self.removeEventListener === 'function') {
  window.removeEventListener = function(type, listener, options) {
    return self.removeEventListener(type, listener, options);
  };
}

function persistStorageKey(key, value) {
  const payload = {};
  payload[key] = value;
  chrome.storage.local.set(payload, () => {
    if (chrome.runtime.lastError) {
      console.warn('[SGN] storage set failed', key, chrome.runtime.lastError);
    }
  });
}

function removeStorageKey(key) {
  chrome.storage.local.remove(key, () => {
    if (chrome.runtime.lastError) {
      console.warn('[SGN] storage remove failed', key, chrome.runtime.lastError);
    }
  });
}

const localStorage = new Proxy({}, {
  get(target, prop) {
    if (prop === 'length') {
      return Object.keys(localStorageCache).length;
    }
    if (prop === 'getItem') {
      return (key) => (key in localStorageCache ? localStorageCache[key] : null);
    }
    if (prop === 'setItem') {
      return (key, value) => {
        localStorageCache[key] = String(value);
        persistStorageKey(key, localStorageCache[key]);
      };
    }
    if (prop === 'removeItem') {
      return (key) => {
        delete localStorageCache[key];
        removeStorageKey(key);
      };
    }
    if (prop === 'clear') {
      return () => {
        for (const key of Object.keys(localStorageCache)) {
          delete localStorageCache[key];
        }
        chrome.storage.local.clear();
      };
    }
    if (prop === 'key') {
      return (index) => Object.keys(localStorageCache)[index] || null;
    }
    return localStorageCache[prop];
  },
  set(target, prop, value) {
    localStorageCache[prop] = String(value);
    persistStorageKey(prop, localStorageCache[prop]);
    return true;
  },
  deleteProperty(target, prop) {
    delete localStorageCache[prop];
    removeStorageKey(prop);
    return true;
  }
});

self.localStorage = localStorage;
if (typeof window !== 'undefined') {
  window.localStorage = localStorage;
}

const $ = {
  param(obj) {
    const parts = [];
    Object.keys(obj || {}).forEach((key) => {
      const value = obj[key];
      if (value === undefined || value === null) {
        return;
      }
      if (Array.isArray(value)) {
        value.forEach((v) => {
          parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(v)}`);
        });
      } else {
        parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
      }
    });
    return parts.join('&');
  },
  each(collection, callback) {
    if (!collection) {
      return;
    }
    if (Array.isArray(collection)) {
      collection.forEach((value, index) => {
        callback.call(value, index, value);
      });
    } else {
      Object.keys(collection).forEach((key) => {
        const value = collection[key];
        callback.call(value, key, value);
      });
    }
  },
  ajax(config) {
    const method = (config.type || 'GET').toUpperCase();
    let url = config.url;
    const headers = new Headers(config.headers || {});
    let body;
    const isGetLike = method === 'GET' || method === 'HEAD';

    if (config.contentType && !headers.has('Content-Type')) {
      headers.set('Content-Type', config.contentType);
    }

    if (config.data && isGetLike) {
      const qs = typeof config.data === 'string' ? config.data : $.param(config.data);
      url += (url.includes('?') ? '&' : '?') + qs;
    } else if (config.data) {
      if (config.data instanceof FormData) {
        body = config.data;
      } else if (typeof config.data === 'string') {
        body = config.data;
      } else if ((config.contentType || '').includes('application/json')) {
        body = JSON.stringify(config.data);
        if (!headers.has('Content-Type')) {
          headers.set('Content-Type', 'application/json');
        }
      } else {
        body = $.param(config.data);
        if (!headers.has('Content-Type')) {
          headers.set('Content-Type', 'application/x-www-form-urlencoded; charset=UTF-8');
        }
      }
    }

    const controller = new AbortController();
    let timeoutId;
    if (config.timeout) {
      timeoutId = setTimeout(() => {
        controller.abort();
      }, config.timeout);
    }

    fetch(url, {
      method,
      headers,
      body,
      signal: controller.signal,
      redirect: config.redirect || 'follow'
    }).then(async (response) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      const ok = response.ok;
      const contentType = response.headers.get('content-type') || '';
      const inferredType = !config.dataType && contentType.includes('application/json')
        ? 'json'
        : (!config.dataType && contentType.startsWith('text/'))
          ? 'text'
          : undefined;
      const dataType = config.dataType || inferredType;
      let payload;
      let rawText;

      try {
        if (dataType === 'blob') {
          payload = await response.blob();
        } else if (dataType === 'json') {
          rawText = await response.text();
          if (rawText && rawText.trim() !== '') {
            try {
              payload = JSON.parse(rawText);
            } catch (parseErr) {
              if (config.dataType === 'json') {
                throw parseErr;
              }
              payload = rawText;
            }
          } else {
            payload = rawText ? rawText : null;
          }
        } else {
          payload = await response.text();
          rawText = payload;
        }
      } catch (err) {
        if (payload === undefined && rawText !== undefined) {
          payload = rawText;
        } else if (payload === undefined) {
          payload = null;
        }
        if (dataType === 'json' && config.dataType === 'json' && typeof config.error === 'function') {
          config.error(err, 'parsererror', err.message || 'parsererror');
          return;
        }
      }

      const responseText = rawText !== undefined
        ? rawText
        : (typeof payload === 'string' ? payload : undefined);

      if (ok) {
        if (typeof config.success === 'function') {
          config.success(payload, 'success', response);
        }
      } else if (typeof config.error === 'function') {
        config.error({
          status: response.status,
          statusText: response.statusText,
          response: payload,
          responseText
        }, 'error', response.statusText);
      }
    }).catch((err) => {
      if (timeoutId) {
        clearTimeout(timeoutId);
      }
      if (typeof config.error === 'function') {
        const isAbort = err && err.name === 'AbortError';
        config.error(err, isAbort ? 'timeout' : 'error', err.message || 'error');
      }
    });
  }
};

self.$ = self.jQuery = $;

let bootstrapped = false;

self.addEventListener('error', function(event) {
  console.error('[SGN] bootstrap script error', event.message || event, event.filename || '', event.lineno || 0, event.colno || 0);
});

self.addEventListener('unhandledrejection', function(event) {
  console.error('[SGN] bootstrap unhandled rejection', event.reason);
});

function finalizeBootstrap() {
  if (typeof SimpleGmailNotes !== 'undefined' && !SimpleGmailNotes.$) {
    SimpleGmailNotes.$ = $;
  }
}

function tryImportScripts(urls) {
  try {
    importScripts.apply(self, urls);
    return true;
  } catch (err) {
    console.error('[SGN] Failed to bootstrap background scripts', err && err.message ? err.message : err, err && err.stack ? err.stack : '');
    return false;
  }
}

function bootstrapBackground() {
  if (bootstrapped) {
    return;
  }
  bootstrapped = true;

  const sharedUrl = chrome.runtime.getURL('common/shared-common.js');
  const backgroundUrls = [
    chrome.runtime.getURL('background.js'),
    chrome.runtime.getURL('background-event.js')
  ];

  if (tryImportScripts([sharedUrl].concat(backgroundUrls))) {
    finalizeBootstrap();
    return;
  }

  fetch(sharedUrl)
    .then((resp) => {
      console.log('[SGN] Prefetch shared-common status', resp.status);
      if (!resp.ok) {
        throw new Error('HTTP ' + resp.status);
      }
      return resp.text();
    })
    .then((source) => {
      const globalUrl = typeof URL !== 'undefined' ? URL
        : (typeof self !== 'undefined' && (self.URL || self.webkitURL))
          ? (self.URL || self.webkitURL)
          : null;

      const canCreateObjectUrl = globalUrl && typeof globalUrl.createObjectURL === 'function';
      const canRevokeObjectUrl = globalUrl && typeof globalUrl.revokeObjectURL === 'function';

      if (canCreateObjectUrl) {
        const blobUrl = globalUrl.createObjectURL(new Blob([source], { type: 'text/javascript' }));
        const success = tryImportScripts([blobUrl].concat(backgroundUrls));
        if (canRevokeObjectUrl) {
          globalUrl.revokeObjectURL(blobUrl);
        }
        if (success) {
          finalizeBootstrap();
          return;
        }
      }

      // Fallback: evaluate inline, then load remaining scripts.
      try {
        const evaluate = new Function(source + '\n//# sourceURL=' + sharedUrl);
        evaluate();
      } catch (err) {
        console.error('[SGN] Failed to evaluate shared-common inline', err);
        return;
      }

      if (tryImportScripts(backgroundUrls)) {
        finalizeBootstrap();
      }
    })
    .catch((err) => {
      console.error('[SGN] Prefetch shared-common failed', err);
    });
}

function hydrateCache(callback) {
  chrome.storage.local.get(null, (items) => {
    if (chrome.runtime.lastError) {
      console.warn('[SGN] storage hydrate failed', chrome.runtime.lastError);
    } else if (items) {
      Object.keys(localStorageCache).forEach((key) => {
        delete localStorageCache[key];
      });
      Object.assign(localStorageCache, items);
    }

    if (typeof callback === 'function') {
      callback();
    }
  });
}

hydrateCache(bootstrapBackground);

chrome.runtime.onInstalled.addListener(() => {
  hydrateCache();
});

chrome.runtime.onStartup.addListener(() => {
  hydrateCache();
});
