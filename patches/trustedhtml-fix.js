(function() {
  if (typeof Element === 'undefined') {
    return;
  }

  var descriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML') ||
                   Object.getOwnPropertyDescriptor(HTMLElement.prototype, 'innerHTML');

  if (!descriptor || typeof descriptor.set !== 'function') {
    return;
  }

  var originalSetter = descriptor.set;
  var originalGetter = descriptor.get;
  var outerDescriptor = Object.getOwnPropertyDescriptor(Element.prototype, 'outerHTML');
  var originalOuterSetter = outerDescriptor && outerDescriptor.set;
  var originalOuterGetter = outerDescriptor && outerDescriptor.get;
  var originalInsertAdjacentHTML = Element.prototype.insertAdjacentHTML;

  function importNodesInto(target, sourceBody, ownerDocument) {
    var doc = target.ownerDocument || ownerDocument || document;
    while (sourceBody.firstChild) {
      var node = sourceBody.firstChild;
      sourceBody.removeChild(node);
      target.appendChild(doc.importNode(node, true));
    }
  }

  function parseHTML(value, ownerDocument) {
    if (value === null || value === undefined) {
      return value;
    }

    if (typeof value !== 'string') {
      return value;
    }

    try {
      var test = ownerDocument.createElement('div');
      originalSetter.call(test, value);
      return value;
    } catch (err) {
      try {
        var sandboxDoc = document.implementation.createHTMLDocument('trustedhtml');
        sandboxDoc.body.innerHTML = value;
        return function(target) {
          target.textContent = '';
          importNodesInto(target, sandboxDoc.body, ownerDocument);
        };
      } catch (err2) {
        var doc = ownerDocument || document;
        return doc.createTextNode(String(value));
      }
    }
  }

  Object.defineProperty(Element.prototype, 'innerHTML', {
    configurable: true,
    enumerable: descriptor.enumerable,
    get: originalGetter,
    set: function(value) {
      var parsed = parseHTML(value, this.ownerDocument || document);
      if (typeof parsed === 'function') {
        parsed(this);
      } else if (parsed && parsed.nodeType) {
        this.textContent = '';
        this.appendChild(parsed);
      } else {
        originalSetter.call(this, parsed);
      }
    }
  });

  if (originalOuterSetter) {
    Object.defineProperty(Element.prototype, 'outerHTML', {
      configurable: true,
      enumerable: outerDescriptor.enumerable,
      get: originalOuterGetter,
      set: function(value) {
        var parsed = parseHTML(value, this.ownerDocument || document);
        if (typeof parsed === 'function') {
          var parent = this.parentNode;
          if (!parent) {
            return;
          }
          var host = document.createElement('div');
          parsed(host);
          while (host.firstChild) {
            parent.insertBefore(host.firstChild, this);
          }
          parent.removeChild(this);
        } else if (parsed && parsed.nodeType) {
          var parentNode = this.parentNode;
          if (!parentNode) {
            return;
          }
          parentNode.replaceChild(parsed, this);
        } else {
          originalOuterSetter.call(this, parsed);
        }
      }
    });
  }

  if (typeof originalInsertAdjacentHTML === 'function') {
    Element.prototype.insertAdjacentHTML = function(position, value) {
      try {
        return originalInsertAdjacentHTML.call(this, position, value);
      } catch (err) {
        var parsed = parseHTML(value, this.ownerDocument || document);
        if (typeof parsed === 'function') {
          var host = document.createElement('div');
          parsed(host);
          switch ((position || '').toLowerCase()) {
            case 'beforebegin':
              if (this.parentNode) {
                while (host.firstChild) {
                  this.parentNode.insertBefore(host.firstChild, this);
                }
              }
              break;
            case 'afterbegin':
              while (host.firstChild) {
                this.insertBefore(host.firstChild, this.firstChild);
              }
              break;
            case 'beforeend':
              while (host.firstChild) {
                this.appendChild(host.firstChild);
              }
              break;
            case 'afterend':
              if (this.parentNode) {
                while (host.firstChild) {
                  this.parentNode.insertBefore(host.firstChild, this.nextSibling);
                }
              }
              break;
            default:
              throw err;
          }
        } else if (parsed && parsed.nodeType) {
          switch ((position || '').toLowerCase()) {
            case 'beforebegin':
              if (this.parentNode) {
                this.parentNode.insertBefore(parsed, this);
              }
              break;
            case 'afterbegin':
              this.insertBefore(parsed, this.firstChild);
              break;
            case 'beforeend':
              this.appendChild(parsed);
              break;
            case 'afterend':
              if (this.parentNode) {
                this.parentNode.insertBefore(parsed, this.nextSibling);
              }
              break;
            default:
              throw err;
          }
        } else {
          originalInsertAdjacentHTML.call(this, position, parsed);
        }
      }
    };
  }
})();
